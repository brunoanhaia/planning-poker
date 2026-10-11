/**
 * How long an accepted token is remembered, to refuse a replayed one.
 *
 * Cloudflare refuses a token it already accepted for five minutes; matching that
 * window is enough to catch a replay without holding the token for longer.
 */
const CONSUMED_TOKEN_TTL_MS = 5 * 60 * 1000;

/** Bound on the siteverify call, so a stalled response cannot stall a join. */
const VERIFICATION_TIMEOUT_MS = 5_000;

/**
 * Verifies the Cloudflare Turnstile challenge a client solved before joining.
 *
 * Turnstile answers the question "is this a browser" without another secret to
 * keep, and it is what makes a room join cost something for a script: replaying
 * an old token does not work, because the token is single-use and bound to the
 * challenge it came from.
 *
 * **It is opt-in.** Without a secret the verification is a no-op and joins are
 * open, which is what development and a self-hosted deployment want. Setting
 * `TURNSTILE_SECRET` turns it on, and then it is enforced for participants who
 * cannot already prove who they are — a reconnecting participant holds a session
 * token and has no reason to solve a challenge again.
 *
 * Verification fails closed. If the challenge cannot be checked — Cloudflare
 * unreachable, malformed answer — the join is refused, because "fail open" would
 * let an attacker take the check offline by blocking it. An operator who prefers
 * availability over that can leave the secret empty.
 */
export class TurnstileVerifier {
    /**
     * Tokens already accepted, with when they were, so a replayed one is refused.
     *
     * Bounded by a TTL rather than by the process lifetime: a token that Cloudflare
     * accepted is refused by Cloudflare itself for five minutes, so remembering it
     * for longer only grows the set without buying anything.
     */
    private readonly consumed = new Map<string, number>();

    /**
     * @param secret - The Turnstile secret key; empty disables verification.
     * @param verifyUrl - Endpoint of the siteverify call, overridable for tests.
     * @param fetchImpl - Fetch implementation, overridable for tests.
     */
    constructor(
        private readonly secret: string | undefined,
        private readonly verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        private readonly fetchImpl: typeof fetch = fetch
    ) {}

    /** True when a secret is configured, so joins must carry a solved challenge. */
    public get enabled(): boolean {
        return Boolean(this.secret);
    }

    /**
     * Reports whether a join may proceed.
     *
     * @param token - The token the client solved, if any.
     * @param remoteIp - The address the join arrived from, for the optional check.
     * @returns True when verification is disabled, the token is absent while
     *   disabled, or Cloudflare accepted it.
     */
    public async verify(
        token: string | null | undefined,
        remoteIp?: string,
        now: number = Date.now()
    ): Promise<boolean> {
        if (!this.secret) {
            return true;
        }
        if (!token) {
            return false;
        }
        if (this.isConsumed(token, now)) {
            return false;
        }

        const body = new URLSearchParams({ secret: this.secret, response: token });
        if (remoteIp) {
            body.set('remoteip', remoteIp);
        }

        // A bounded timeout: a stalled siteverify must not leave the join waiting
        // forever, and the failure mode of refusing the join is the safe one.
        const timeout = AbortSignal.timeout(VERIFICATION_TIMEOUT_MS);
        try {
            const response = await this.fetchImpl(this.verifyUrl, {
                body,
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                method: 'POST',
                signal: timeout,
            });
            const verdict: unknown = await response.json();
            const accepted =
                typeof verdict === 'object' &&
                verdict !== null &&
                (verdict as { success?: unknown }).success === true;

            if (accepted) {
                this.consumed.set(token, now);
                this.evictExpired(now);
            }
            return accepted;
        } catch (error) {
            // A challenge that cannot be checked is a challenge that failed.
            console.error('Turnstile verification could not be completed:', error);
            return false;
        }
    }

    /**
     * Reports whether a token was already accepted inside its window.
     *
     * @param token - The token presented by the join attempt.
     * @param now - Current timestamp, in milliseconds.
     * @returns True while the token is remembered.
     */
    private isConsumed(token: string, now: number): boolean {
        const acceptedAt = this.consumed.get(token);
        return acceptedAt !== undefined && now - acceptedAt < CONSUMED_TOKEN_TTL_MS;
    }

    /** Drops the tokens whose window has elapsed. */
    private evictExpired(now: number): void {
        this.consumed.forEach((acceptedAt, token) => {
            if (now - acceptedAt >= CONSUMED_TOKEN_TTL_MS) {
                this.consumed.delete(token);
            }
        });
    }
}
