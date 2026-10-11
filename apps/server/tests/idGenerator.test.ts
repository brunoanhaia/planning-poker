import { describe, expect, it } from 'vitest';

import { ROOM_ID_CHARSET, ROOM_ID_LENGTH } from '../src/constants.js';
import { generateRoomId, generateStoryId, generateUserId } from '../src/idGenerator.js';

describe('generateRoomId', () => {
    it('is long enough to make guessing impractical', () => {
        // Eight characters from a 32-character alphabet is ~1.1×10¹² candidates.
        // Six was ~1.1×10⁹, which a single host could walk in minutes.
        expect(ROOM_ID_LENGTH).toBeGreaterThanOrEqual(8);
    });

    it('produces codes of exactly the configured length', () => {
        const codes = Array.from({ length: 200 }, () => generateRoomId());

        expect(codes.every((code) => code.length === ROOM_ID_LENGTH)).toBe(true);
    });

    it('only uses the characters of the room-code alphabet', () => {
        const codes = Array.from({ length: 200 }, () => generateRoomId());

        expect(
            codes.every((code) => [...code].every((char) => ROOM_ID_CHARSET.includes(char)))
        ).toBe(true);
    });

    it('does not reuse the ambiguous characters', () => {
        const ambiguous = new Set(['0', 'O', '1', 'I']);
        const codes = Array.from({ length: 200 }, () => generateRoomId());

        expect(codes.every((code) => ![...code].some((char) => ambiguous.has(char)))).toBe(true);
    });
});

describe('generateUserId and generateStoryId', () => {
    it('prefixes them and keeps them unpredictable', () => {
        expect(generateUserId()).toMatch(/^user_[0-9a-f]{9}$/);
        expect(generateStoryId()).toMatch(/^story_[0-9a-f]{9}$/);
    });

    it('mints a distinct identifier every time', () => {
        const ids = new Set(Array.from({ length: 200 }, () => generateUserId()));

        expect(ids.size).toBe(200);
    });
});
