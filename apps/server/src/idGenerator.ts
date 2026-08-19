import { ROOM_ID_CHARSET, ROOM_ID_LENGTH } from './constants.js';

/**
 * Generates a random uppercase room identifier string.
 *
 * @returns A unique room code string of length ROOM_ID_LENGTH.
 */
export const generateRoomId = (): string => {
    return Array.from({ length: ROOM_ID_LENGTH }, () => {
        const randomIndex = Math.floor(Math.random() * ROOM_ID_CHARSET.length);
        return ROOM_ID_CHARSET.charAt(randomIndex);
    }).join('');
};

/**
 * Generates a unique participant user identifier string.
 *
 * @returns A unique user identifier prefixed with 'user_'.
 */
export const generateUserId = (): string => {
    const randomSegment = Math.random().toString(36).slice(2, 11);
    return `user_${randomSegment}`;
};

/**
 * Generates a unique story identifier string.
 *
 * @returns A unique story identifier prefixed with 'story_'.
 */
export const generateStoryId = (): string => {
    const randomSegment = Math.random().toString(36).slice(2, 11);
    return `story_${randomSegment}`;
};
