import { describe, expect, it } from 'vitest';

import { validatePayload } from '../src/validation.js';

describe('WebSocket payload validation', () => {
    it('rejects an off-deck-shaped vote that is not a valid card value', () => {
        const result = validatePayload('VOTE', { vote: '' });
        expect(result.success).toBe(false);
        expect(result.error).toContain('VOTE');
    });

    it('accepts a numeric and a string vote', () => {
        expect(validatePayload('VOTE', { vote: 5 }).success).toBe(true);
        expect(validatePayload('VOTE', { vote: '☕' }).success).toBe(true);
    });

    it('rejects a timer duration below the minimum', () => {
        expect(validatePayload('START_TIMER', { duration: -5 }).success).toBe(false);
        expect(validatePayload('START_TIMER', { duration: 0 }).success).toBe(false);
    });

    it('rejects a timer duration above the maximum and non-integers', () => {
        expect(validatePayload('START_TIMER', { duration: 1e9 }).success).toBe(false);
        expect(validatePayload('START_TIMER', { duration: 12.5 }).success).toBe(false);
    });

    it('accepts a valid timer duration and an omitted duration', () => {
        expect(validatePayload('START_TIMER', { duration: 60 }).success).toBe(true);
        expect(validatePayload('START_TIMER', {}).success).toBe(true);
    });

    it('rejects a custom deck with too few or too many cards', () => {
        expect(
            validatePayload('CHANGE_DECK', { customDeck: [1], deckType: 'custom' }).success
        ).toBe(false);
        const tooMany = Array.from({ length: 31 }, (_, i) => i + 1);
        expect(
            validatePayload('CHANGE_DECK', { customDeck: tooMany, deckType: 'custom' }).success
        ).toBe(false);
    });

    it('rejects a custom deck with duplicate values', () => {
        const result = validatePayload('CHANGE_DECK', {
            customDeck: [1, 1, 2],
            deckType: 'custom',
        });
        expect(result.success).toBe(false);
    });

    it('requires a custom deck when deckType is custom', () => {
        expect(validatePayload('CHANGE_DECK', { deckType: 'custom' }).success).toBe(false);
        expect(validatePayload('CHANGE_DECK', { deckType: 'fibonacci' }).success).toBe(true);
    });

    it('rejects an unknown deck type', () => {
        expect(validatePayload('CHANGE_DECK', { deckType: 'not_a_deck' }).success).toBe(false);
    });

    it('enforces story title and description length limits', () => {
        expect(validatePayload('ADD_STORY', { title: 'x'.repeat(121) }).success).toBe(false);
        expect(validatePayload('ADD_STORY', { title: 'ok' }).success).toBe(true);
        expect(
            validatePayload('ADD_STORY', { description: 'x'.repeat(2001), title: 'ok' }).success
        ).toBe(false);
    });

    it('caps bulk story imports', () => {
        const stories = Array.from({ length: 51 }, (_, i) => ({ title: `Story ${i}` }));
        expect(validatePayload('BULK_ADD_STORIES', { stories }).success).toBe(false);
        expect(validatePayload('BULK_ADD_STORIES', { stories: [{ title: 'One' }] }).success).toBe(
            true
        );
    });

    it('enforces participant name length limits', () => {
        expect(
            validatePayload('JOIN_ROOM', { name: 'x'.repeat(51), roomId: 'ABC123' }).success
        ).toBe(false);
        expect(validatePayload('JOIN_ROOM', { name: 'Bob', roomId: 'ABC123' }).success).toBe(true);
    });

    it('passes through message types without a schema', () => {
        expect(validatePayload('REVEAL_VOTES', undefined).success).toBe(true);
    });

    it('returns the parsed, trimmed value on success', () => {
        const result = validatePayload('JOIN_ROOM', { name: '  Bob  ', roomId: 'ABC123' });
        expect(result.success).toBe(true);
        expect((result.data as { name: string }).name).toBe('Bob');
    });

    it('does not return data when validation fails', () => {
        const result = validatePayload('VOTE', { vote: '' });
        expect(result.success).toBe(false);
        expect(result.data).toBeUndefined();
    });

    it('rejects oversized avatar and color values', () => {
        expect(
            validatePayload('JOIN_ROOM', {
                avatar: 'x'.repeat(17),
                name: 'Bob',
                roomId: 'ABC123',
            }).success
        ).toBe(false);
        expect(
            validatePayload('JOIN_ROOM', {
                color: 'x'.repeat(33),
                name: 'Bob',
                roomId: 'ABC123',
            }).success
        ).toBe(false);
    });

    it('accepts normal avatar and color values', () => {
        expect(
            validatePayload('JOIN_ROOM', {
                avatar: '🚀',
                color: '#6366f1',
                name: 'Bob',
                roomId: 'ABC123',
            }).success
        ).toBe(true);
    });

    it('accepts null to clear a story estimate', () => {
        expect(
            validatePayload('UPDATE_STORY_ESTIMATE', { estimate: null, storyId: 'story_1' }).success
        ).toBe(true);
    });

    it('still accepts a concrete story estimate', () => {
        expect(
            validatePayload('UPDATE_STORY_ESTIMATE', { estimate: 5, storyId: 'story_1' }).success
        ).toBe(true);
    });
});
