import { describe, expect, it } from 'vitest';

import { parseCustomDeck } from './custom-deck';

describe('parseCustomDeck', () => {
    it('accepts a valid mix of numeric and symbolic cards', () => {
        expect(parseCustomDeck('1, 2, 3, ?, ☕')).toEqual({
            cards: [1, 2, 3, '?', '☕'],
            error: null,
        });
    });

    it('rejects a deck outside the shared card bounds', () => {
        expect(parseCustomDeck('').error).toBe('count');
        expect(parseCustomDeck('1').error).toBe('count');
        expect(
            parseCustomDeck(Array.from({ length: 31 }, (_, index) => index).join(',')).error
        ).toBe('count');
    });

    it('rejects an infinite number or an oversized label', () => {
        expect(parseCustomDeck('1, Infinity').error).toBe('label');
        expect(parseCustomDeck('1, x'.padEnd(60, 'x')).error).toBe('label');
    });

    it('rejects duplicate cards after normalization', () => {
        expect(parseCustomDeck('1, 1, 2').error).toBe('duplicate');
        expect(parseCustomDeck('1, 01, 2').error).toBe('duplicate');
    });

    it('keeps the parsed cards available when the deck is rejected', () => {
        expect(parseCustomDeck('1')).toEqual({ cards: [1], error: 'count' });
    });
});
