import { describe, expect, it } from 'vitest';

import { hasSameCards, parseCustomDeck, validateCustomDeck } from './deck-select.utils';

describe('parseCustomDeck', () => {
    it('accepts a mix of numeric and symbolic cards', () => {
        expect(parseCustomDeck('1, 2, 3, ?, ☕')).toEqual([1, 2, 3, '?', '☕']);
    });
});

describe('validateCustomDeck', () => {
    it('accepts a deck inside the shared bounds', () => {
        expect(validateCustomDeck([1, 2, 3, '?'])).toBeNull();
    });

    it('rejects a deck outside the shared card bounds', () => {
        expect(validateCustomDeck([])?.key).toBe('create.error.count');
        expect(validateCustomDeck([1])?.key).toBe('create.error.count');
        expect(validateCustomDeck(Array.from({ length: 31 }, (_, index) => index))?.key).toBe(
            'create.error.count'
        );
    });

    it('rejects an infinite number or an oversized label', () => {
        expect(validateCustomDeck([1, Infinity])?.key).toBe('create.error.label');
        expect(validateCustomDeck([1, 'x'.repeat(51)])?.key).toBe('create.error.label');
    });

    it('rejects duplicate cards after normalization', () => {
        expect(validateCustomDeck([1, 1, 2])?.key).toBe('create.error.duplicate');
    });
});

describe('hasSameCards', () => {
    it('compares both order and values', () => {
        expect(hasSameCards([1, 2, '?'], [1, 2, '?'])).toBe(true);
        expect(hasSameCards([1, 2], [2, 1])).toBe(false);
        expect(hasSameCards([1], undefined)).toBe(false);
    });
});
