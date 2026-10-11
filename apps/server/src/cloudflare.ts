import http from 'node:http';

/**
 * Cloudflare network ranges and the identity it forwards.
 *
 * Cloudflare terminates the connection at one of its edges, so a server behind it
 * sees a Cloudflare address in `remoteAddress` and the real client in
 * `CF-Connecting-IP`. The header is only worth anything if the claim is
 * verifiable: a header is trivially forged, so it is honoured **only** when the
 * socket really comes from a Cloudflare address, and ignored otherwise — a client
 * that reaches the listener directly cannot choose its own identity by setting
 * `CF-Connecting-IP`.
 *
 * The ranges are the published list from <https://www.cloudflare.com/ips/>. They
 * change rarely and are checked by a test, so a stale list is a visible failure
 * rather than a silent trust of a forged header.
 */

/** Published Cloudflare IPv4 ranges. */
export const CLOUDFLARE_IPV4_RANGES = [
    '173.245.48.0/20',
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '141.101.64.0/18',
    '108.162.192.0/18',
    '190.93.240.0/20',
    '188.114.96.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
    '162.158.0.0/15',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '172.64.0.0/13',
    '131.0.72.0/22',
] as const;

/** Published Cloudflare IPv6 ranges. */
export const CLOUDFLARE_IPV6_RANGES = [
    '2400:cb00::/32',
    '2606:4700::/32',
    '2803:f800::/32',
    '2405:b500::/32',
    '2405:8100::/32',
    '2a06:98c0::/29',
    '2c0f:f248::/32',
] as const;

/**
 * Parses an IPv4 address into its four octets.
 *
 * @param address - The dotted-quad address.
 * @returns The octets, or null when the address is not a well-formed IPv4.
 */
const parseIpv4 = (address: string): number[] | null => {
    const octets = address.split('.');
    if (octets.length !== 4) {
        return null;
    }
    const parsed = octets.map((octet) => Number(octet));
    const wellFormed =
        octets.every((octet) => /^\d{1,3}$/.test(octet)) &&
        parsed.every((value) => value >= 0 && value <= 255);
    return wellFormed ? parsed : null;
};

/** Parses a CIDR block into the address it starts at and the prefix length. */
const parseIpv4Cidr = (cidr: string): { base: number[]; prefix: number } | null => {
    const [address, prefixText] = cidr.split('/');
    const base = parseIpv4(address);
    const prefix = Number(prefixText);
    if (!base || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
        return null;
    }
    return { base, prefix };
};

/** Packs four octets into one 32-bit integer. */
const packIpv4 = (octets: number[]): number =>
    octets.reduce((packed, octet) => (packed << 8) | octet, 0) >>> 0;

/**
 * Reports whether an address falls inside a Cloudflare range.
 *
 * Only IPv4 is matched, which covers every Cloudflare edge address; anything else
 * — IPv6, a hostname, garbage — is treated as "not Cloudflare" rather than as a
 * reason to trust the header.
 *
 * @param address - The peer address, as Node reports it.
 * @returns True when the address belongs to Cloudflare.
 */
export const isCloudflareAddress = (address: string | undefined): boolean => {
    const octets = address ? parseIpv4(address) : null;
    if (!octets) {
        return false;
    }
    const packed = packIpv4(octets);

    return CLOUDFLARE_IPV4_RANGES.some((cidr) => {
        const block = parseIpv4Cidr(cidr);
        if (!block) {
            return false;
        }
        const base = packIpv4(block.base);
        // A /0 block has no mask to apply, and shifting by 32 is undefined in JS.
        const mask = block.prefix === 0 ? 0 : (0xffffffff << (32 - block.prefix)) >>> 0;
        return (packed & mask) === (base & mask);
    });
};

/**
 * Reads the client address Cloudflare forwarded, when it forwarded one.
 *
 * Cloudflare sets `CF-Connecting-IP`, and also `True-Client-IP` when configured to.
 * The value is used as-is: Cloudflare puts a single address there, so there is no
 * chain to walk, and an operator who adds their own proxy behind it keeps using
 * `X-Forwarded-For` through the hop count instead.
 *
 * @param headers - The handshake request headers.
 * @returns The forwarded address, or null when none was forwarded.
 */
export const readCloudflareClientIp = (headers: http.IncomingHttpHeaders): string | null => {
    const forwarded = headers['cf-connecting-ip'] ?? headers['true-client-ip'];
    const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const address = value?.trim();
    return address && address.length > 0 ? address : null;
};
