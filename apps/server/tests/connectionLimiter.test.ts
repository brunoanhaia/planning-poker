import http from 'node:http';
import { describe, expect, it } from 'vitest';

import {
    ConnectionLimiter,
    normalizeAddress,
    resolvePeerAddress,
} from '../src/connectionLimiter.js';

/** Resolves an address the way the server does, Cloudflare in front or not. */
const resolve = (
    request: http.IncomingMessage,
    trustProxyHops: number,
    cloudflare = false
): string => resolvePeerAddress({ cloudflareEnabled: cloudflare, request, trustProxyHops });

/** A limiter with a roomy concurrency ceiling and a modest handshake allowance. */
const limiter = (maxConnections = 3, maxHandshakes = 2, windowMs = 60_000): ConnectionLimiter =>
    new ConnectionLimiter(maxConnections, maxHandshakes, windowMs, 10);

/** Builds the handshake shape the resolver reads. */
const handshake = (options: {
    remoteAddress?: string;
    forwardedFor?: string;
}): http.IncomingMessage =>
    ({
        headers:
            options.forwardedFor === undefined ? {} : { 'x-forwarded-for': options.forwardedFor },
        socket: { remoteAddress: options.remoteAddress ?? '127.0.0.1' },
    }) as unknown as http.IncomingMessage;

describe('resolvePeerAddress behind Cloudflare', () => {
    it('uses the address Cloudflare forwarded, with no configured hops', () => {
        // The claim is verifiable from the peer itself, so it needs no setting.
        const request = handshake({
            remoteAddress: '104.16.0.7',
            forwardedFor: '1.2.3.4',
        });
        request.headers['cf-connecting-ip'] = '203.0.113.7';

        expect(resolve(request, 0, true)).toBe('203.0.113.7');
    });

    it('ignores X-Forwarded-For once Cloudflare forwarded the client', () => {
        // What a client sent before Cloudflare overwrote it is not a claim worth
        // honouring, so the chain is not walked in front of Cloudflare.
        const request = handshake({
            remoteAddress: '104.16.0.7',
            forwardedFor: '10.0.0.9, 1.2.3.4',
        });
        request.headers['cf-connecting-ip'] = '203.0.113.7';

        expect(resolve(request, 2, true)).toBe('203.0.113.7');
    });

    it('falls back to the edge when Cloudflare forwarded nothing', () => {
        const request = handshake({ remoteAddress: '104.16.0.7' });

        expect(resolve(request, 0, true)).toBe('104.16.0.7');
    });

    it('recognises an IPv4 edge reached over IPv6', () => {
        // Node reports such a peer as `::ffff:…`, which never matches a range.
        const request = handshake({ remoteAddress: '::ffff:104.16.0.7' });
        request.headers['cf-connecting-ip'] = '203.0.113.7';

        expect(resolve(request, 0, true)).toBe('203.0.113.7');
    });

    it('ignores the header entirely when Cloudflare is not in front', () => {
        // Even from a real Cloudflare address, a deployment that did not say it
        // sits behind one must not read the header.
        const request = handshake({ remoteAddress: '104.16.0.7' });
        request.headers['cf-connecting-ip'] = '203.0.113.7';

        expect(resolve(request, 0, false)).toBe('104.16.0.7');
    });

    it('ignores a forged header from an address that is not Cloudflare', () => {
        // A client that reaches the listener directly must not be able to pick its
        // own bucket by setting the header.
        const request = handshake({ remoteAddress: '203.0.113.9' });
        request.headers['cf-connecting-ip'] = '1.2.3.4';

        expect(resolve(request, 0, true)).toBe('203.0.113.9');
    });
});

describe('resolvePeerAddress', () => {
    it('reads the entry the closest trusted proxy appended', () => {
        // The bundled Nginx overwrites the header with the address it accepted.
        const request = handshake({ forwardedFor: '203.0.113.7', remoteAddress: '10.0.0.4' });

        expect(resolve(request, 1)).toBe('203.0.113.7');
    });

    it('steps one entry further out for every extra trusted hop', () => {
        // client, then the two proxies that carried it, closest last.
        const request = handshake({
            forwardedFor: '203.0.113.7, 10.0.0.9, 10.0.0.4',
            remoteAddress: '10.0.0.2',
        });

        expect(resolve(request, 1)).toBe('10.0.0.4');
        expect(resolve(request, 2)).toBe('10.0.0.9');
        expect(resolve(request, 3)).toBe('203.0.113.7');
    });

    it('trims the entries it reads', () => {
        const request = handshake({
            forwardedFor: ' 203.0.113.7 , 10.0.0.4 ',
            remoteAddress: '10.0.0.2',
        });

        expect(resolve(request, 1)).toBe('10.0.0.4');
        expect(resolve(request, 2, true)).toBe('203.0.113.7');
    });

    it('falls back to the earliest claim when the chain is shorter than the hops', () => {
        const request = handshake({ forwardedFor: '203.0.113.7', remoteAddress: '10.0.0.2' });

        expect(resolve(request, 3)).toBe('203.0.113.7');
    });

    it('ignores the header when no hop is trusted', () => {
        const request = handshake({ forwardedFor: '203.0.113.7', remoteAddress: '10.0.0.4' });

        expect(resolve(request, 0)).toBe('10.0.0.4');
    });

    it('cannot be steered by a client-supplied header without a trusted hop', () => {
        // A listener reached directly must not let a client pick its own bucket.
        const request = handshake({ forwardedFor: '198.51.100.9', remoteAddress: '192.0.2.5' });

        expect(resolve(request, 0)).toBe('192.0.2.5');
        expect(resolve(request, 0)).not.toBe('198.51.100.9');
    });

    it('falls back to the socket when a trusted hop sent no header', () => {
        const request = handshake({ remoteAddress: '10.0.0.4' });

        expect(resolve(request, 1)).toBe('10.0.0.4');
    });

    it('normalizes an IPv4 client reached over IPv6', () => {
        const request = handshake({ remoteAddress: '::ffff:203.0.113.7' });

        expect(resolve(request, 0, true)).toBe('203.0.113.7');
    });
});

describe('normalizeAddress', () => {
    it('strips the IPv4-mapped IPv6 prefix so one client counts once', () => {
        expect(normalizeAddress('::ffff:127.0.0.1')).toBe('127.0.0.1');
        expect(normalizeAddress('127.0.0.1')).toBe('127.0.0.1');
    });

    it('keeps an IPv6 address intact', () => {
        expect(normalizeAddress('2001:db8::1')).toBe('2001:db8::1');
    });

    it('falls back to one bucket when the platform reports no address', () => {
        expect(normalizeAddress(undefined)).toBe('unknown');
    });
});

describe('ConnectionLimiter', () => {
    it('admits connections up to the cap and refuses the next one', () => {
        const budget = limiter();

        expect(budget.hasCapacity('10.0.0.1', 1_000)).toBe(true);
        budget.acquire('10.0.0.1', 1_000);
        budget.acquire('10.0.0.1', 1_000);
        budget.acquire('10.0.0.1', 1_000);

        expect(budget.count('10.0.0.1')).toBe(3);
        expect(budget.hasCapacity('10.0.0.1', 1_000)).toBe(false);
    });

    it('frees a slot as soon as a socket closes', () => {
        const budget = limiter(1, 10);
        budget.acquire('10.0.0.1', 1_000);

        budget.release('10.0.0.1');

        expect(budget.hasCapacity('10.0.0.1', 1_000)).toBe(true);
    });

    it('forgets an address whose last socket left', () => {
        const budget = limiter(2, 10);
        budget.acquire('10.0.0.1', 1_000);
        budget.release('10.0.0.1');

        // The socket is gone; the handshake record stays for its window, which
        // is what caps how fast the same address may connect again.
        expect(budget.count('10.0.0.1')).toBe(0);
    });

    it('never drops below zero when a socket is released twice', () => {
        const budget = limiter(2, 10);
        budget.acquire('10.0.0.1', 1_000);
        budget.release('10.0.0.1');
        budget.release('10.0.0.1');

        expect(budget.count('10.0.0.1')).toBe(0);
        expect(budget.trackedAddresses).toBeGreaterThanOrEqual(1);
    });

    it('counts addresses independently', () => {
        const budget = limiter(2, 10);
        budget.acquire('10.0.0.1', 1_000);
        budget.acquire('10.0.0.1', 1_000);
        budget.acquire('10.0.0.2', 1_000);

        expect(budget.hasCapacity('10.0.0.1', 1_000)).toBe(false);
        expect(budget.hasCapacity('10.0.0.2', 1_000)).toBe(true);
        expect(budget.trackedAddresses).toBe(2);
    });

    it('treats a mapped and a plain address as the same client', () => {
        const budget = limiter(1, 10);
        budget.acquire(normalizeAddress('::ffff:10.0.0.1'), 1_000);

        expect(budget.hasCapacity(normalizeAddress('10.0.0.1'), 1_000)).toBe(false);
    });
});

describe('ConnectionLimiter handshake allowance', () => {
    it('lets a whole organisation connect at once', () => {
        // A NAT'd office of three hundred opens a tab each in the same minute;
        // that is a crowd, not a flood, and must not be answered with 429.
        const budget = limiter(300, 600);
        const now = 1_000;

        for (let person = 0; person < 300; person += 1) {
            budget.acquire('203.0.113.7', now);
        }

        expect(budget.count('203.0.113.7')).toBe(300);
    });

    it('refuses the socket that would pass the ceiling', () => {
        const budget = limiter(300, 600);
        const now = 1_000;

        for (let person = 0; person < 300; person += 1) {
            budget.acquire('203.0.113.7', now);
        }

        expect(budget.hasCapacity('203.0.113.7', now)).toBe(false);
    });

    it('still refuses a burst of short-lived sockets', () => {
        // Sockets that close immediately never accumulate concurrency, so only the
        // handshake rate catches a flood of short-lived connections.
        const budget = limiter(300, 600);

        for (let burst = 0; burst < 600; burst += 1) {
            budget.acquire('198.51.100.9', 1_000);
            budget.release('198.51.100.9');
        }

        expect(budget.hasCapacity('198.51.100.9', 1_000)).toBe(false);
    });

    it('refuses a burst of handshakes even under the concurrency ceiling', () => {
        // Sockets that close immediately never accumulate concurrency, so only the
        // handshake rate catches a flood of short-lived connections.
        const budget = limiter(100, 120);

        for (let burst = 0; burst < 120; burst += 1) {
            budget.acquire('198.51.100.9', 1_000);
            budget.release('198.51.100.9');
        }

        expect(budget.hasCapacity('198.51.100.9', 1_000)).toBe(false);
    });

    it('restores the allowance once the window elapses', () => {
        const budget = limiter(100, 2, 60_000);

        budget.acquire('10.0.0.1', 1_000);
        budget.acquire('10.0.0.1', 1_100);
        expect(budget.hasCapacity('10.0.0.1', 1_200)).toBe(false);

        expect(budget.hasCapacity('10.0.0.1', 1_000 + 60_000 + 1)).toBe(true);
    });

    it('keeps the handshake history of an address that is still connected', () => {
        // Forgetting it would hand a connected address a fresh rate allowance, so
        // a map past its bound is preferred over evicting a live address.
        const budget = new ConnectionLimiter(10, 2, 60_000, 3);

        for (let address = 0; address < 10; address += 1) {
            budget.acquire(`10.0.${address}.1`, 1_000);
        }

        expect(budget.trackedAddresses).toBe(10);
        budget.acquire('10.0.0.1', 1_001);

        // Still charged for its history: two handshakes inside the window.
        expect(budget.hasCapacity('10.0.0.1', 1_002)).toBe(false);
    });

    it('bounds the handshake history it keeps', () => {
        // Sockets that closed leave only their handshake history, and that is
        // what the bound exists for.
        const budget = new ConnectionLimiter(100, 100, 60_000, 10);

        for (let address = 0; address < 200; address += 1) {
            budget.acquire(`10.0.${address}.1`, 1_000);
            budget.release(`10.0.${address}.1`);
        }

        expect(budget.trackedAddresses).toBe(10);
    });

    it('never evicts an address that still holds a socket', () => {
        // An entry in `open` is a live socket, so dropping it would hand that
        // address a second full allowance and quietly double the ceiling.
        const budget = new ConnectionLimiter(1, 100, 60_000, 3);

        for (let address = 0; address < 10; address += 1) {
            budget.acquire(`10.0.${address}.1`, 1_000);
        }

        expect(budget.count('10.0.0.1')).toBe(1);
        expect(budget.hasCapacity('10.0.0.1', 1_000)).toBe(false);
        expect(budget.count('10.0.9.1')).toBe(1);
    });
});
