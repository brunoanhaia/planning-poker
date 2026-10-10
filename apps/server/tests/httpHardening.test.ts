import { HTTP_RATE_LIMIT_MAX_REQUESTS } from '@planitpoker/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { RunningServer } from '../src/index.js';

import { parseTrustProxyHops, startServer } from '../src/index.js';

/**
 * Boots the real server on an ephemeral port so the security headers and the
 * rate limiter can be asserted against actual responses.
 */
const running: { current?: RunningServer } = {};
let baseUrl: string;

beforeAll(() => {
    running.current = startServer({
        allowedOrigins: ['http://localhost:5173'],
        port: 0,
        // A tiny allowance keeps the 429 test fast without weakening the check.
        rateLimitMaxRequests: 3,
    });
    const address = running.current.server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => {
    running.current?.handler.shutdown();
    running.current?.server.close();
});

/**
 * Boots a server on an ephemeral port with its own limiter, so a test can
 * spend the whole allowance without depending on what came before it.
 *
 * @param trustProxyHops - Proxy hops the limiter should trust.
 * @param rateLimitMaxRequests - Requests accepted per window.
 * @returns The base URL and the handles needed to shut it down.
 */
const bootIsolated = (trustProxyHops: number, rateLimitMaxRequests: number) => {
    const isolated = startServer({
        allowedOrigins: ['http://localhost:5173'],
        port: 0,
        rateLimitMaxRequests,
        trustProxyHops,
    });
    const address = isolated.server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return { baseUrl: `http://127.0.0.1:${port}`, running: isolated };
};

/** Fetches `/api/health` once and returns the status. */
const healthStatus = async (baseUrl: string, headers?: Record<string, string>) =>
    (await fetch(`${baseUrl}/api/health`, { headers })).status;

describe('HTTP hardening', () => {
    it('does not advertise the framework', async () => {
        const response = await fetch(`${baseUrl}/api/health`);

        expect(response.headers.get('x-powered-by')).toBeNull();
    });

    it('sends the baseline security headers on the health endpoint', async () => {
        const response = await fetch(`${baseUrl}/api/health`);

        expect(response.headers.get('x-content-type-options')).toBe('nosniff');
        expect(response.headers.get('x-frame-options')).toBe('DENY');
        expect(response.headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin');
        expect(response.headers.get('content-security-policy')).toContain("default-src 'self'");
        expect(response.headers.get('strict-transport-security')).toContain('max-age=');
    });

    it('still serves the health payload', async () => {
        const response = await fetch(`${baseUrl}/api/health`);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ status: 'ok' });
    });

    it('answers a burst of requests with 429 once the allowance is spent', async () => {
        const { baseUrl: isolatedUrl, running: isolated } = bootIsolated(0, 3);

        try {
            const statuses: number[] = [];
            for (let i = 0; i < 4; i += 1) {
                statuses.push(await healthStatus(isolatedUrl));
            }

            expect(statuses).toEqual([200, 200, 200, 429]);
        } finally {
            isolated.handler.shutdown();
            isolated.server.close();
        }
    });

    it('caps the accepted JSON body', async () => {
        // Its own limiter, so the 413 comes from the parser and not from an
        // allowance the earlier tests spent.
        const { baseUrl: isolatedUrl, running } = bootIsolated(0, 5);

        try {
            const response = await fetch(`${isolatedUrl}/api/health`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ padding: 'x'.repeat(60 * 1024) }),
            });

            expect(response.status).toBe(413);
        } finally {
            running.handler.shutdown();
            running.server.close();
        }
    });

    it('spends request allowance on an oversized body instead of parsing it for free', async () => {
        const { baseUrl: isolatedUrl, running } = bootIsolated(0, 2);

        try {
            const oversized = {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ padding: 'x'.repeat(60 * 1024) }),
            };

            const statuses: number[] = [];
            for (let i = 0; i < 3; i += 1) {
                statuses.push((await fetch(`${isolatedUrl}/api/health`, oversized)).status);
            }

            // The body parser sees the payload, but only after the limiter has
            // charged for it, so the third attempt is refused rather than parsed.
            expect(statuses).toEqual([413, 413, 429]);
        } finally {
            running.handler.shutdown();
            running.server.close();
        }
    });

    it('uses the production allowance by default', () => {
        expect(HTTP_RATE_LIMIT_MAX_REQUESTS).toBe(300);
    });

    it('ignores X-Forwarded-For when it is told nothing about a proxy', async () => {
        // Nothing passes the option, so the default must be zero hops: honouring
        // the header would let a direct client choose its own rate-limit bucket.
        const { baseUrl: bareUrl, running } = bootIsolated(0, 2);

        try {
            const statuses: number[] = [];
            for (const forged of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) {
                statuses.push(await healthStatus(bareUrl, { 'X-Forwarded-For': forged }));
            }

            expect(statuses).toEqual([200, 200, 429]);
        } finally {
            running.handler.shutdown();
            running.server.close();
        }
    });
});

describe('parseTrustProxyHops', () => {
    it('defaults to zero trusted hops', () => {
        expect(parseTrustProxyHops(undefined)).toBe(0);
        expect(parseTrustProxyHops('')).toBe(0);
        expect(parseTrustProxyHops('not-a-number')).toBe(0);
        expect(parseTrustProxyHops('-1')).toBe(0);
        expect(parseTrustProxyHops('1.5')).toBe(0);
    });

    it('accepts an explicit non-negative integer', () => {
        expect(parseTrustProxyHops('0')).toBe(0);
        expect(parseTrustProxyHops('1')).toBe(1);
        expect(parseTrustProxyHops('2')).toBe(2);
    });
});

describe('Rate limiting behind a proxy', () => {
    it('keys the limit on the client even when X-Forwarded-For is forged', async () => {
        const { baseUrl: proxiedUrl, running } = bootIsolated(1, 2);
        // The address the trusted proxy appended; a client controls everything
        // sent to the left of it, which `trust proxy: true` would happily use
        // as the bucket key.
        const appendedByProxy = '203.0.113.7';

        try {
            const statuses: number[] = [];
            for (const forged of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) {
                statuses.push(
                    await healthStatus(proxiedUrl, {
                        'X-Forwarded-For': `${forged}, ${appendedByProxy}`,
                    })
                );
            }

            expect(statuses).toEqual([200, 200, 429]);
        } finally {
            running.handler.shutdown();
            running.server.close();
        }
    });

    it('ignores the header entirely when no proxy hop is trusted', async () => {
        const { baseUrl: directUrl, running } = bootIsolated(0, 2);

        try {
            const statuses: number[] = [];
            for (const forged of [
                '1.1.1.1, 203.0.113.7',
                '2.2.2.2, 203.0.113.7',
                '3.3.3.3, 203.0.113.7',
            ]) {
                statuses.push(await healthStatus(directUrl, { 'X-Forwarded-For': forged }));
            }

            expect(statuses).toEqual([200, 200, 429]);
        } finally {
            running.handler.shutdown();
            running.server.close();
        }
    });
});
