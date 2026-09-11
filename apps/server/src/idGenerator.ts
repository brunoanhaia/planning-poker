import { randomInt, randomUUID } from 'node:crypto';

import { ROOM_ID_CHARSET, ROOM_ID_LENGTH } from './constants.js';

/**
 * Generates a random uppercase room identifier string.
 * Uses a cryptographically secure random number generator so room codes
 * cannot be predicted by observing previous values.
 *
 * @returns A unique room code string of length ROOM_ID_LENGTH.
 */
export const generateRoomId = (): string => {
    return Array.from({ length: ROOM_ID_LENGTH }, () => {
        return ROOM_ID_CHARSET.charAt(randomInt(ROOM_ID_CHARSET.length));
    }).join('');
};

/**
 * Generates a unique participant user identifier string.
 * Uses a cryptographically secure random UUID segment.
 *
 * @returns A unique user identifier prefixed with 'user_'.
 */
export const generateUserId = (): string => {
    const randomSegment = randomUUID().replaceAll('-', '').slice(0, 9);
    return `user_${randomSegment}`;
};

/**
 * Generates a unique story identifier string.
 * Uses a cryptographically secure random UUID segment.
 *
 * @returns A unique story identifier prefixed with 'story_'.
 */
export const generateStoryId = (): string => {
    const randomSegment = randomUUID().replaceAll('-', '').slice(0, 9);
    return `story_${randomSegment}`;
};
