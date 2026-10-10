import { describe, expect, it } from 'vitest';

import {
    CLIENT_ID_COOKIE,
    CLIENT_ID_COOKIE_OPTIONS,
    issueClientId,
    parseClientId,
} from '../src/clientIdentity.js';

describe('parseClientId', () => {
    it('reads the identity out of a cookie header', () => {
        expect(parseClientId(`${CLIENT_ID_COOKIE}=abc-123`)).toBe('abc-123');
    });

    it('reads it alongside other cookies and extra spacing', () => {
        expect(parseClientId(`other=1; ${CLIENT_ID_COOKIE}=abc-123 ; theme=dark`)).toBe('abc-123');
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
});

describe('issueClientId', () => {
    it('mints a distinct identifier every time', () => {
        const issued = new Set(Array.from({ length: 20 }, () => issueClientId()));

        expect(issued.size).toBe(20);
    });
});

describe('CLIENT_ID_COOKIE_OPTIONS', () => {
    it('keeps the identity out of reach of the application', () => {
        expect(CLIENT_ID_COOKIE_OPTIONS.httpOnly).toBe(true);
        expect(CLIENT_ID_COOKIE_OPTIONS.sameSite).toBe('strict');
    });
});
