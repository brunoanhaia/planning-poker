/**
 * Counts *distinct* unknown room codes one address may probe in a window.
 *
 * The room code is the only secret a participant needs, and a miss is otherwise
 * free: no lockout, no audit, and the per-socket throttle resets with every new
 * socket. A client that probes the keyspace would therefore learn a live code at
 * thousands of guesses per second.
 *
 * Written in the repository rather than pulled from a library on purpose. The
 * candidates were checked (`rate-limiter-flexible`, `limiter`/`async-ratelimiter`,
 * `ws-rate-limit`): the first two are general counters that would need a store
 * and a rewrite of this shape, `ws-rate-limit` has been untouched since 2016 and
 * replaces the `message` handlers it throttles, and none of them counts
 * *distinct values* — which is the property that makes this safe on a shared
 * address, and is about fifteen lines of `Map`.
 *
 * Two properties keep this from punishing the innocent, and both were learned
 * the hard way — the first version counted *attempts* per address, which a NAT
 * shares:
 *
 * - **Distinct codes, not attempts.** A person who mistypes retypes the *same*
 *   wrong code once or twice; a brute-forcer generates thousands of *different*
 *   ones. Counting distinct codes collapses a whole office of typos into one
 *   entry, so a shared address cannot be barred by its own users.
 * - **The budget only ever gates a miss.** A caller that arrives with a code
 *   that exists is legitimate by definition, so the room is looked up first and
 *   the budget is consulted only when nothing matched. A barred address can
 *   still join the room it actually belongs to.
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
 * one on guesses, join a room of its own, repeat. The window decays the codes on
 * its own, which is what protects the honest typist.
 */
export class JoinFailureLimiter {
    /** Distinct unknown codes seen inside the window, with when each first appeared. */
    private readonly failures = new Map<string, Map<string, number>>();
    /** Addresses barred until their cool-down expires. */
    private readonly coolingUntil = new Map<string, number>();

    /**
     * @param maxFailures - Distinct unknown codes one address may probe in the window.
     * @param windowMs - Sliding window the codes are counted in, in milliseconds.
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
     * Reports whether an address may still probe a room code that does not exist.
     *
     * Only misses are answered with this. A code that matches a room is always
     * allowed through, so a bar never locks a legitimate participant out of the
     * room it is joining.
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
     * Records an unknown room code, and bars the address once it has probed its
     * budget of distinct codes inside the window.
     *
     * @param address - The normalized peer address.
     * @param roomCode - The code that matched no room.
     * @param now - Current timestamp, in milliseconds.
     */
    public recordFailure(address: string, roomCode: string, now: number): void {
        const windowStart = now - this.windowMs;
        const seen = new Map(
            [...(this.failures.get(address) ?? new Map<string, number>())].filter(
                ([, firstSeenAt]) => firstSeenAt > windowStart
            )
        );
        if (!seen.has(roomCode)) {
            seen.set(roomCode, now);
        }
        this.failures.set(address, seen);

        if (seen.size >= this.maxFailures) {
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
     * Drops every expired bar and every code whose window has elapsed.
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
        this.failures.forEach((seen, address) => {
            [...seen.keys()].forEach((roomCode) => {
                const firstSeenAt = seen.get(roomCode);
                if (firstSeenAt !== undefined && firstSeenAt <= windowStart) {
                    seen.delete(roomCode);
                }
            });
            if (seen.size === 0) {
                this.failures.delete(address);
            }
        });
    }

    /** Addresses whose history is still tracked inside the window. */
    public get trackedAddresses(): number {
        return this.failures.size;
    }

    /** Distinct unknown codes one address has probed inside the window. */
    public probedCodes(address: string): number {
        return this.failures.get(address)?.size ?? 0;
    }

    /** Addresses currently barred. Exposed for diagnostics and tests. */
    public get barredAddresses(): number {
        return this.coolingUntil.size;
    }
}
