import http from 'node:http';

import { isCloudflareAddress, readCloudflareClientIp } from './cloudflare.js';

/**
 * Peer address of a connection, normalized so the same client counts once.
 *
 * Node reports an IPv4 client reached over IPv6 as `::ffff:127.0.0.1`; without
 * normalization one browser would occupy two buckets, one of which it could
 * never fill again.
 *
 * @param address - The `remoteAddress` of the socket, if the platform gave one.
 * @returns The address to count connections against.
 */
export const normalizeAddress = (address: string | undefined): string => {
    if (!address) {
        return 'unknown';
    }
    return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
};

/**
 * Resolves the address a connection should be charged to.
 *
 * A WebSocket upgrade bypasses Express, so `app.set('trust proxy', …)` never
 * applies to it and `request.socket.remoteAddress` is whatever the nearest hop
 * is — behind Nginx that is the proxy, and every client would look like one.
 * The header is therefore read here, but only as far as the operator declared.
 *
 * The chain is read from the socket outwards, exactly like Express: hop zero is
 * the socket itself, so `trustProxyHops = 1` means the value the closest proxy
 * appended, and each further trusted hop steps one entry further away from it.
 * A listener with no trusted hop never reads the header at all, so a client that
 * reaches it directly cannot pick its own bucket.
 *
 * Cloudflare is the exception that proves the rule: it replaces the peer address
 * with its own edge and the client in `CF-Connecting-IP`, so that header is read
 * only when the socket really comes from a Cloudflare range. `X-Forwarded-For` is
 * ignored in front of Cloudflare, because the client controls what it sent before
 * Cloudflare overwrote it, and the value Cloudflare set is the one to trust.
 *
 * @param request - The handshake request.
 * @param trustProxyHops - Proxy hops in front of this server that may be trusted.
 * @returns The normalized client address.
 */
export const resolvePeerAddress = (
    request: http.IncomingMessage,
    trustProxyHops: number
): string => {
    // Cloudflare is verified from the peer itself rather than from configuration,
    // so it is checked before everything else: the address it forwards is the one
    // to use, and `X-Forwarded-For` is then ignored, because what a client sent
    // before Cloudflare overwrote it is not a claim worth honouring.
    if (isCloudflareAddress(request.socket.remoteAddress)) {
        const clientIp = readCloudflareClientIp(request.headers);
        if (clientIp) {
            return normalizeAddress(clientIp);
        }
    }

    if (trustProxyHops < 1) {
        return normalizeAddress(request.socket.remoteAddress);
    }

    const forwarded = request.headers['x-forwarded-for'];
    const hops = (Array.isArray(forwarded) ? forwarded.join(',') : (forwarded ?? ''))
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        // The closest proxy appended last, so the chain is read back to front.
        .reverse();

    if (hops.length === 0) {
        return normalizeAddress(request.socket.remoteAddress);
    }

    // One hop trusts the closest proxy's entry, two hop one further out. A chain
    // shorter than the declared hops falls back to the earliest claim, which is
    // what Express does for the same configuration.
    const index = Math.min(trustProxyHops - 1, hops.length - 1);
    return normalizeAddress(hops[index]);
};

/**
 * Caps how many sockets one address may hold, and how fast it may open them.
 *
 * An upgrade never passes through the Express middleware, so the HTTP rate limit
 * does not cover it: a single host could otherwise open sockets until the
 * process ran out of file descriptors, and every other client would pay for it.
 *
 * Both limits are keyed on the peer address, which is a shared resource on
 * purpose: an office, a school or a mobile carrier all put many people behind
 * one address, and the ceilings are set high enough that a whole team connecting
 * at once is not mistaken for a flood. The concurrency limit answers the "how
 * many sockets can this address hold" question; the handshake limit answers the
 * "how fast is this address opening them" one, because a flood is a burst rather
 * than a crowd.
 */
export class ConnectionLimiter {
    /** Live sockets per address. */
    private readonly open = new Map<string, number>();
    /** Handshake timestamps inside the current window, per address. */
    private readonly handshakes = new Map<string, number[]>();

    /**
     * @param maxConnections - Sockets one address may hold at the same time.
     * @param maxHandshakesPerWindow - Connections one address may open per window.
     * @param windowMs - Window the handshake allowance is spent in, in milliseconds.
     * @param maxTrackedAddresses - Addresses held at once, so churn cannot grow the maps.
     */
    constructor(
        private readonly maxConnections: number,
        private readonly maxHandshakesPerWindow: number,
        private readonly windowMs: number,
        private readonly maxTrackedAddresses: number
    ) {}

    /**
     * Reports whether an address still has room for another connection.
     *
     * @param address - The normalized peer address.
     * @param now - Current timestamp, in milliseconds.
     * @returns True while the address is below both limits.
     */
    public hasCapacity(address: string, now: number): boolean {
        return (
            this.count(address) < this.maxConnections &&
            this.handshakesInWindow(address, now) < this.maxHandshakesPerWindow
        );
    }

    /**
     * Records one more open socket for an address.
     *
     * @param address - The normalized peer address.
     * @param now - Current timestamp, in milliseconds, for the handshake window.
     */
    public acquire(address: string, now: number): void {
        this.open.set(address, this.count(address) + 1);

        const windowStart = now - this.windowMs;
        const recent = [...(this.handshakes.get(address) ?? []), now].filter(
            (at) => at > windowStart
        );
        this.handshakes.set(address, recent);
        this.evictOverflow();
    }

    /**
     * Records one fewer open socket for an address, forgetting it when the last
     * one leaves so the map cannot grow without bound.
     *
     * @param address - The normalized peer address.
     */
    public release(address: string): void {
        const remaining = this.count(address) - 1;
        if (remaining > 0) {
            this.open.set(address, remaining);
            return;
        }
        this.open.delete(address);
    }

    /**
     * Sockets one address currently holds.
     *
     * @param address - The normalized peer address.
     * @returns The live count.
     */
    public count(address: string): number {
        return this.open.get(address) ?? 0;
    }

    /** Sockets one address opened inside the current window. */
    private handshakesInWindow(address: string, now: number): number {
        return (this.handshakes.get(address) ?? []).filter((at) => at > now - this.windowMs).length;
    }

    /** Addresses tracked in either map. Exposed for diagnostics and tests. */
    public get trackedAddresses(): number {
        return Math.max(this.open.size, this.handshakes.size);
    }

    /**
     * Drops the oldest handshake history once it passes its bound.
     *
     * Only the handshake map is bounded, and only entries whose address no longer
     * holds a socket. An entry in `open` always stands for at least one live
     * socket — a count that reaches zero is deleted the moment it does — so
     * evicting one would lose live state: the address would read as empty and be
     * handed a second full allowance, quietly doubling the ceiling for whoever
     * connected first. For the same reason the handshake history of a connected
     * address is kept even past the bound: forgetting it would hand that address a
     * fresh rate allowance while it is still talking to us. When every tracked
     * address is connected, the map is bounded by the connections it counts
     * instead — one entry per live socket at most.
     *
     * A `Map` keeps insertion order, so the first key is the one that was tracked
     * longest ago and is therefore closest to having its window expire anyway.
     */
    private evictOverflow(): void {
        while (this.handshakes.size > this.maxTrackedAddresses) {
            const disconnected = [...this.handshakes.keys()].find(
                (address) => this.count(address) === 0
            );
            if (disconnected === undefined) {
                return;
            }
            this.handshakes.delete(disconnected);
        }
    }
}
