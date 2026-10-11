import http from 'node:http';
import { describe, expect, it } from 'vitest';

import {
    ConnectionLimiter,
    normalizeAddress,
    resolvePeerAddress,
} from '../src/connectionLimiter.js';

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

describe('resolvePeerAddress', () => {
    it('reads the entry the closest trusted proxy appended', () => {
        // The bundled Nginx overwrites the header with the address it accepted.
        const request = handshake({ forwardedFor: '203.0.113.7', remoteAddress: '10.0.0.4' });

        expect(resolvePeerAddress(request, 1)).toBe('203.0.113.7');
    });

    it('steps one entry further out for every extra trusted hop', () => {
        // client, then the two proxies that carried it, closest last.
        const request = handshake({
            forwardedFor: '203.0.113.7, 10.0.0.9, 10.0.0.4',
            remoteAddress: '10.0.0.2',
        });

        expect(resolvePeerAddress(request, 1)).toBe('10.0.0.4');
        expect(resolvePeerAddress(request, 2)).toBe('10.0.0.9');
        expect(resolvePeerAddress(request, 3)).toBe('203.0.113.7');
    });

    it('trims the entries it reads', () => {
        const request = handshake({
            forwardedFor: ' 203.0.113.7 , 10.0.0.4 ',
            remoteAddress: '10.0.0.2',
        });

        expect(resolvePeerAddress(request, 1)).toBe('10.0.0.4');
        expect(resolvePeerAddress(request, 2)).toBe('203.0.113.7');
    });

    it('falls back to the earliest claim when the chain is shorter than the hops', () => {
        const request = handshake({ forwardedFor: '203.0.113.7', remoteAddress: '10.0.0.2' });

        expect(resolvePeerAddress(request, 3)).toBe('203.0.113.7');
    });

    it('ignores the header when no hop is trusted', () => {
        const request = handshake({ forwardedFor: '203.0.113.7', remoteAddress: '10.0.0.4' });

        expect(resolvePeerAddress(request, 0)).toBe('10.0.0.4');
    });

    it('cannot be steered by a client-supplied header without a trusted hop', () => {
        // A listener reached directly must not let a client pick its own bucket.
        const request = handshake({ forwardedFor: '198.51.100.9', remoteAddress: '192.0.2.5' });

        expect(resolvePeerAddress(request, 0)).toBe('192.0.2.5');
        expect(resolvePeerAddress(request, 0)).not.toBe('198.51.100.9');
    });

    it('falls back to the socket when a trusted hop sent no header', () => {
        const request = handshake({ remoteAddress: '10.0.0.4' });

        expect(resolvePeerAddress(request, 1)).toBe('10.0.0.4');
    });

    it('normalizes an IPv4 client reached over IPv6', () => {
        const request = handshake({ remoteAddress: '::ffff:203.0.113.7' });

        expect(resolvePeerAddress(request, 0)).toBe('203.0.113.7');
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
        const limiter = new ConnectionLimiter(3);

        expect(limiter.hasCapacity('10.0.0.1')).toBe(true);
        limiter.acquire('10.0.0.1');
        limiter.acquire('10.0.0.1');
        limiter.acquire('10.0.0.1');

        expect(limiter.count('10.0.0.1')).toBe(3);
        expect(limiter.hasCapacity('10.0.0.1')).toBe(false);
    });

    it('frees a slot as soon as a socket closes', () => {
        const limiter = new ConnectionLimiter(1);
        limiter.acquire('10.0.0.1');

        limiter.release('10.0.0.1');

        expect(limiter.hasCapacity('10.0.0.1')).toBe(true);
    });

    it('forgets an address whose last socket left', () => {
        const limiter = new ConnectionLimiter(2);
        limiter.acquire('10.0.0.1');
        limiter.release('10.0.0.1');

        expect(limiter.count('10.0.0.1')).toBe(0);
        expect(limiter.trackedAddresses).toBe(0);
    });

    it('never drops below zero when a socket is released twice', () => {
        const limiter = new ConnectionLimiter(2);
        limiter.acquire('10.0.0.1');
        limiter.release('10.0.0.1');
        limiter.release('10.0.0.1');

        expect(limiter.count('10.0.0.1')).toBe(0);
        expect(limiter.trackedAddresses).toBe(0);
    });

    it('counts addresses independently', () => {
        const limiter = new ConnectionLimiter(2);
        limiter.acquire('10.0.0.1');
        limiter.acquire('10.0.0.1');
        limiter.acquire('10.0.0.2');

        expect(limiter.hasCapacity('10.0.0.1')).toBe(false);
        expect(limiter.hasCapacity('10.0.0.2')).toBe(true);
        expect(limiter.trackedAddresses).toBe(2);
    });

    it('treats a mapped and a plain address as the same client', () => {
        const limiter = new ConnectionLimiter(1);
        limiter.acquire(normalizeAddress('::ffff:10.0.0.1'));

        expect(limiter.hasCapacity(normalizeAddress('10.0.0.1'))).toBe(false);
    });
});
