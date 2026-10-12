import { describe, expect, it } from 'vitest';

import {
    buildClientIdCookie,
    CLIENT_ID_COOKIE,
    CLIENT_ID_COOKIE_OPTIONS,
    issueClientId,
    parseClientId,
} from '../src/clientIdentity.js';

const serverMintedId = '3f8b1c2e-9a4d-4e7b-8c1a-2d5f6a7b8c9d';

describe('parseClientId', () => {
    it('reads the identity out of a cookie header', () => {
        expect(parseClientId(`${CLIENT_ID_COOKIE}=${serverMintedId}`)).toBe(serverMintedId);
    });

    it('reads it alongside other cookies and extra spacing', () => {
        expect(parseClientId(`other=1; ${CLIENT_ID_COOKIE}=${serverMintedId} ; theme=dark`)).toBe(
            serverMintedId
        );
    });

    it('returns null when the header carries no identity', () => {
        expect(parseClientId('other=1')).toBeNull();
        expect(parseClientId(`${CLIENT_ID_COOKIE}=`)).toBeNull();
    });

    it('returns null for a missing header', () => {
        expect(parseClientId(undefined)).toBeNull();
        expect(parseClientId(null)).toBeNull();
        expect(parseClientId('')).toBeNull();
    });

    it('round-trips a header it is handed back', () => {
        const issued = issueClientId();
        expect(parseClientId(`${CLIENT_ID_COOKIE}=${issued}`)).toBe(issued);
    });

    it('refuses an identity the server never minted', () => {
        // A scripted client can send any header it likes; anything that is not a
        // server-shaped identifier must read as "no identity" rather than be
        // planted as a key in the ban map.
        expect(parseClientId(`${CLIENT_ID_COOKIE}=abc-123`)).toBeNull();
        expect(parseClientId(`${CLIENT_ID_COOKIE}=not-a-uuid`)).toBeNull();
        expect(parseClientId(`${CLIENT_ID_COOKIE}=x`.repeat(10))).toBeNull();
    });
});

describe('issueClientId', () => {
    it('mints a distinct identifier every time', () => {
        const issued = new Set(Array.from({ length: 20 }, () => issueClientId()));

        expect(issued.size).toBe(20);
    });

    it('mints an identifier it reads back unchanged', () => {
        const issued = issueClientId();

        expect(parseClientId(`${CLIENT_ID_COOKIE}=${issued}`)).toBe(issued);
    });
});

describe('buildClientIdCookie', () => {
    it('carries the identity the application cannot read', () => {
        const cookie = buildClientIdCookie(serverMintedId, false);

        expect(cookie).toContain(`${CLIENT_ID_COOKIE}=${serverMintedId}`);
        expect(cookie).toContain('HttpOnly');
        expect(cookie).toContain('SameSite=Strict');
        expect(cookie).toContain('Path=/');
        expect(cookie).not.toContain('Secure');
    });

    it('adds Secure when the deployment is served over TLS', () => {
        expect(buildClientIdCookie(serverMintedId, true)).toContain('Secure');
    });
});

describe('CLIENT_ID_COOKIE_OPTIONS', () => {
    it('keeps the identity out of reach of the application', () => {
        expect(CLIENT_ID_COOKIE_OPTIONS.httpOnly).toBe(true);
        expect(CLIENT_ID_COOKIE_OPTIONS.sameSite).toBe('strict');
        expect(CLIENT_ID_COOKIE_OPTIONS.path).toBe('/');
    });
});
