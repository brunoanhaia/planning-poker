/**
 * Budget of failed room joins granted to one address.
 *
 * The room code is the only secret a participant needs, and a miss is otherwise
 * free: no lockout, no audit, and the per-socket throttle resets with every new
 * socket. A client that probes the keyspace would therefore learn a live code at
 * thousands of guesses per second.
 *
 * The state it keeps is bounded by {@link JOIN_FAILURE_MAX_TRACKED_ADDRESSES}: a
 * client cycling through distinct addresses leaves one record each, and the
 * hourly sweep only reclaims them. Without the bound that churn would be a slow
 * memory leak on a shared server, so the oldest records are dropped instead —
 * which costs an attacker its history, never a legitimate user, because the
 * window is one minute.
 *
 * A successful join does not clear the budget: anybody can create a room, so a
 * reset on success would hand an attacker an oracle — spend the budget minus
 * one on guesses, join a room of its own, repeat. The window decays the misses
 * on its own, which is what protects the honest typist.
 */
export class JoinFailureLimiter {
    /** Timestamps of failed joins inside the current window, per address. */
    private readonly failures = new Map<string, number[]>();
    /** Addresses barred until their cool-down expires. */
    private readonly coolingUntil = new Map<string, number>();

    /**
     * @param maxFailures - Misses one address may spend inside the window.
     * @param windowMs - Sliding window the misses are counted in, in milliseconds.
     * @param cooldownMs - How long an address that spent its budget is barred.
     * @param maxTrackedAddresses - Addresses held at once, so churn cannot grow the maps.
     */
    constructor(
        private readonly maxFailures: number,
        private readonly windowMs: number,
        private readonly cooldownMs: number,
        private readonly maxTrackedAddresses: number
    ) {}

    /**
     * Reports whether an address may still attempt a join.
     *
     * @param address - The normalized peer address.
     * @param now - Current timestamp, in milliseconds.
     * @returns False while the address is serving its cool-down.
     */
    public allows(address: string, now: number): boolean {
        const until = this.coolingUntil.get(address);
        if (until === undefined) {
            return true;
        }
        if (until <= now) {
            this.coolingUntil.delete(address);
            return true;
        }
        return false;
    }

    /**
     * Records a join that found no room, and bars the address once it has spent
     * its budget inside the window.
     *
     * @param address - The normalized peer address.
     * @param now - Current timestamp, in milliseconds.
     */
    public recordFailure(address: string, now: number): void {
        const windowStart = now - this.windowMs;
        const recent = [...(this.failures.get(address) ?? []), now].filter(
            (at) => at > windowStart
        );
        this.failures.set(address, recent);

        if (recent.length >= this.maxFailures) {
            this.coolingUntil.set(address, now + this.cooldownMs);
            this.failures.delete(address);
        }
        this.evictOverflow();
    }

    /**
     * Drops the oldest tracked address once a map passes its bound.
     *
     * A `Map` keeps insertion order, so the first key is the one that was tracked
     * longest ago and is therefore closest to having its window expire anyway.
     */
    private evictOverflow(): void {
        [this.failures, this.coolingUntil].forEach((tracked) => {
            while (tracked.size > this.maxTrackedAddresses) {
                const oldest = tracked.keys().next();
                if (oldest.done) {
                    return;
                }
                tracked.delete(oldest.value);
            }
        });
    }

    /**
     * Drops every expired bar and every window that has elapsed.
     *
     * @param now - Current timestamp, in milliseconds.
     */
    public sweep(now: number): void {
        const windowStart = now - this.windowMs;
        this.coolingUntil.forEach((until, address) => {
            if (until <= now) {
                this.coolingUntil.delete(address);
            }
        });
        this.failures.forEach((timestamps, address) => {
            const recent = timestamps.filter((at) => at > windowStart);
            if (recent.length === 0) {
                this.failures.delete(address);
                return;
            }
            this.failures.set(address, recent);
        });
    }

    /** Addresses whose history is still tracked inside the window. */
    public get trackedAddresses(): number {
        return this.failures.size;
    }

    /** Addresses currently barred. Exposed for diagnostics and tests. */
    public get barredAddresses(): number {
        return this.coolingUntil.size;
    }
}
