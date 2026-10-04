import { describe, expect, it } from 'vitest';

import { isOriginAllowed, parseAllowedOrigins } from '../src/index.js';

describe('parseAllowedOrigins', () => {
    it('falls back to the default origin when the env var is unset', () => {
        expect(parseAllowedOrigins(undefined)).toEqual(['http://localhost:5173']);
    });

    it('splits a comma-separated list', () => {
        expect(parseAllowedOrigins('http://a.test,http://b.test')).toEqual([
            'http://a.test',
            'http://b.test',
        ]);
    });

    it('trims whitespace around entries', () => {
        expect(parseAllowedOrigins(' http://a.test , http://b.test ')).toEqual([
            'http://a.test',
            'http://b.test',
        ]);
    });

    it('drops empty entries so a blank value yields an empty allowlist', () => {
        expect(parseAllowedOrigins('')).toEqual([]);
        expect(parseAllowedOrigins(' , , ')).toEqual([]);
    });
});

describe('isOriginAllowed', () => {
    const allowed = ['http://localhost:5173'];

    it('allows a listed origin', () => {
        expect(isOriginAllowed('http://localhost:5173', allowed)).toBe(true);
    });

    it('rejects an unlisted origin', () => {
        expect(isOriginAllowed('https://evil.example', allowed)).toBe(false);
    });

    it('allows a missing Origin header through the handshake (identity enforced later)', () => {
        expect(isOriginAllowed(undefined, allowed)).toBe(true);
    });

    it('rejects every browser origin when the allowlist is empty (fails closed)', () => {
        expect(isOriginAllowed('http://localhost:5173', [])).toBe(false);
        expect(isOriginAllowed('https://planitpoker.vercel.app', [])).toBe(false);
    });

    it('allows the production origins when configured', () => {
        const prod = ['https://planitpoker.vercel.app', 'https://app.example.com'];
        expect(isOriginAllowed('https://planitpoker.vercel.app', prod)).toBe(true);
        expect(isOriginAllowed('https://app.example.com', prod)).toBe(true);
        expect(isOriginAllowed('https://evil.example', prod)).toBe(false);
    });
});
