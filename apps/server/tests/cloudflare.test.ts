import { describe, expect, it } from 'vitest';

import {
    CLOUDFLARE_IPV4_RANGES,
    CLOUDFLARE_IPV6_RANGES,
    isCloudflareAddress,
    readCloudflareClientIp,
} from '../src/cloudflare.js';

describe('isCloudflareAddress', () => {
    it('recognises published Cloudflare addresses', () => {
        expect(isCloudflareAddress('173.245.48.1')).toBe(true);
        expect(isCloudflareAddress('104.16.0.1')).toBe(true);
        expect(isCloudflareAddress('162.158.0.1')).toBe(true);
        expect(isCloudflareAddress('188.114.99.5')).toBe(true);
    });

    it('accepts every address of a range', () => {
        expect(isCloudflareAddress('104.16.0.0')).toBe(true);
        expect(isCloudflareAddress('104.23.255.255')).toBe(true);
    });

    it('rejects the address just outside a range', () => {
        // 104.16.0.0/13 ends at 104.23.255.255, 104.24.0.0/14 at 104.27.255.255.
        expect(isCloudflareAddress('104.15.255.255')).toBe(false);
        expect(isCloudflareAddress('104.28.0.0')).toBe(false);
        expect(isCloudflareAddress('104.32.0.0')).toBe(false);
    });

    it('rejects ordinary addresses', () => {
        expect(isCloudflareAddress('203.0.113.7')).toBe(false);
        expect(isCloudflareAddress('127.0.0.1')).toBe(false);
        expect(isCloudflareAddress('10.0.0.1')).toBe(false);
    });

    it('treats anything it cannot parse as not Cloudflare', () => {
        expect(isCloudflareAddress(undefined)).toBe(false);
        expect(isCloudflareAddress('')).toBe(false);
        expect(isCloudflareAddress('::ffff:104.16.0.1')).toBe(false);
        expect(isCloudflareAddress('2400:cb00::1')).toBe(false);
        expect(isCloudflareAddress('not-an-address')).toBe(false);
        expect(isCloudflareAddress('104.16.0.999')).toBe(false);
        expect(isCloudflareAddress('104.16.0')).toBe(false);
    });
});

describe('readCloudflareClientIp', () => {
    it('reads the address Cloudflare forwarded', () => {
        expect(readCloudflareClientIp({ 'cf-connecting-ip': '203.0.113.7' })).toBe('203.0.113.7');
    });

    it('falls back to True-Client-IP when configured', () => {
        expect(readCloudflareClientIp({ 'true-client-ip': '198.51.100.9' })).toBe('198.51.100.9');
    });

    it('trims and takes the first value when a header repeats', () => {
        expect(readCloudflareClientIp({ 'cf-connecting-ip': ' 203.0.113.7 , 10.0.0.1 ' })).toBe(
            '203.0.113.7 , 10.0.0.1'
        );
        expect(readCloudflareClientIp({ 'cf-connecting-ip': [' 203.0.113.7 '] })).toBe(
            '203.0.113.7'
        );
    });

    it('reports nothing when Cloudflare forwarded nothing', () => {
        expect(readCloudflareClientIp({})).toBeNull();
        expect(readCloudflareClientIp({ 'cf-connecting-ip': '' })).toBeNull();
        expect(readCloudflareClientIp({ 'cf-connecting-ip': '   ' })).toBeNull();
    });

    it('prefers CF-Connecting-IP over True-Client-IP', () => {
        expect(
            readCloudflareClientIp({
                'cf-connecting-ip': '203.0.113.7',
                'true-client-ip': '198.51.100.9',
            })
        ).toBe('203.0.113.7');
    });
});

describe('Cloudflare ranges', () => {
    it('keeps the published list in shape', () => {
        [...CLOUDFLARE_IPV4_RANGES, ...CLOUDFLARE_IPV6_RANGES].forEach((cidr) => {
            const [address, prefix] = cidr.split('/');
            expect(address.length).toBeGreaterThan(0);
            expect(Number.isInteger(Number(prefix))).toBe(true);
            expect(Number(prefix)).toBeGreaterThanOrEqual(0);
            expect(Number(prefix)).toBeLessThanOrEqual(32);
        });
    });

    it('has no duplicated range', () => {
        const all = [...CLOUDFLARE_IPV4_RANGES, ...CLOUDFLARE_IPV6_RANGES];
        expect(new Set(all).size).toBe(all.length);
    });
});
