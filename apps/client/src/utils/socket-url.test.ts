import { describe, expect, it } from 'vitest';

import { resolveSocketUrl } from './socket-url';

describe('resolveSocketUrl', () => {
    it('uses the configured URL verbatim, path included', () => {
        expect(
            resolveSocketUrl({
                configuredUrl: 'wss://api.example.com/socket',
                isDev: false,
                location: { host: 'app.example.com', protocol: 'https:' },
            })
        ).toBe('wss://api.example.com/socket');
    });

    it('dials the dev server directly, which needs no path', () => {
        expect(
            resolveSocketUrl({
                configuredUrl: '',
                isDev: true,
                location: { host: 'localhost:5173', protocol: 'http:' },
            })
        ).toBe('ws://localhost:5000');
    });

    it('keeps /ws in the same-origin fallback, which Nginx is the only one to proxy', () => {
        // Without the path the request lands on the SPA and the handshake gets a 200.
        expect(
            resolveSocketUrl({
                configuredUrl: '',
                isDev: false,
                location: { host: 'localhost', protocol: 'http:' },
            })
        ).toBe('ws://localhost/ws');
        expect(
            resolveSocketUrl({
                configuredUrl: '',
                isDev: false,
                location: { host: 'poker.example.com', protocol: 'https:' },
            })
        ).toBe('wss://poker.example.com/ws');
    });
});
