import { HTTP_RATE_LIMIT_MAX_REQUESTS } from '@planitpoker/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { RunningServer } from '../src/index.js';

import { startServer } from '../src/index.js';

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
        // The limiter is shared across the tests above, so a single extra
        // request is enough to exhaust the tiny allowance.
        const response = await fetch(`${baseUrl}/api/health`);

        expect(response.status).toBe(429);
    });

    it('caps the accepted JSON body', async () => {
        const response = await fetch(`${baseUrl}/api/health`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ padding: 'x'.repeat(60 * 1024) }),
        });

        expect(response.status).toBe(413);
    });

    it('uses the production allowance by default', () => {
        expect(HTTP_RATE_LIMIT_MAX_REQUESTS).toBe(300);
    });
});

describe('Rate limiting behind a proxy', () => {
    /** Boots a second, isolated limiter so it does not share the bucket above. */
    const bootIsolated = (trustProxyHops: number, rateLimitMaxRequests: number) => {
        const running = startServer({
            allowedOrigins: ['http://localhost:5173'],
            port: 0,
            rateLimitMaxRequests,
            trustProxyHops,
        });
        const address = running.server.address();
        const port = typeof address === 'object' && address !== null ? address.port : 0;
        return { baseUrl: `http://127.0.0.1:${port}`, running };
    };

    it('keys the limit on the client even when X-Forwarded-For is forged', async () => {
        const { baseUrl: proxiedUrl, running } = bootIsolated(1, 2);
        // The address the trusted proxy appended; a client controls everything
        // sent to the left of it, which `trust proxy: true` would happily use
        // as the bucket key.
        const appendedByProxy = '203.0.113.7';

        try {
            const statuses: number[] = [];
            for (const forged of ['1.1.1.1', '2.2.2.2', '3.3.3.3']) {
                const response = await fetch(`${proxiedUrl}/api/health`, {
                    headers: { 'X-Forwarded-For': `${forged}, ${appendedByProxy}` },
                });
                statuses.push(response.status);
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
                const response = await fetch(`${directUrl}/api/health`, {
                    headers: { 'X-Forwarded-For': forged },
                });
                statuses.push(response.status);
            }

            expect(statuses).toEqual([200, 200, 429]);
        } finally {
            running.handler.shutdown();
            running.server.close();
        }
    });
});
