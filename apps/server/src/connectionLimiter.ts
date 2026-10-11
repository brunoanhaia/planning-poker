import http from 'node:http';

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
 * @param request - The handshake request.
 * @param trustProxyHops - Proxy hops in front of this server that may be trusted.
 * @returns The normalized client address.
 */
export const resolvePeerAddress = (
    request: http.IncomingMessage,
    trustProxyHops: number
): string => {
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
 * Caps how many WebSocket connections one address may hold at the same time.
 *
 * An upgrade never passes through the Express middleware, so the HTTP rate limit
 * does not cover it: a single host could otherwise open sockets until the
 * process ran out of file descriptors, and every other client would pay for it.
 * The cap is enforced on the handshake and released on disconnect, so a browser
 * with a few tabs is never affected while a flood is answered with `429` before
 * the connection is ever upgraded.
 */
export class ConnectionLimiter {
    /** Live sockets per address. */
    private readonly open = new Map<string, number>();

    /**
     * @param maxConnections - Sockets one address may hold at the same time.
     */
    constructor(private readonly maxConnections: number) {}

    /**
     * Reports whether an address still has room for another connection.
     *
     * @param address - The normalized peer address.
     * @returns True while the address is below the cap.
     */
    public hasCapacity(address: string): boolean {
        return this.count(address) < this.maxConnections;
    }

    /**
     * Records one more open socket for an address.
     *
     * @param address - The normalized peer address.
     */
    public acquire(address: string): void {
        this.open.set(address, this.count(address) + 1);
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

    /** Addresses currently holding a socket. Exposed for diagnostics and tests. */
    public get trackedAddresses(): number {
        return this.open.size;
    }
}
