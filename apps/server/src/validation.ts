import {
    DECK_TYPES,
    MAX_BULK_STORIES,
    MAX_CUSTOM_DECK_SIZE,
    MAX_DESCRIPTION_LENGTH,
    MAX_NAME_LENGTH,
    MAX_TIMER_DURATION_SECONDS,
    MAX_TITLE_LENGTH,
    MIN_CUSTOM_DECK_SIZE,
    MIN_TIMER_DURATION_SECONDS,
    WSMessageType,
} from '@planitpoker/shared';
import { z } from 'zod';

/**
 * A single estimation card value: a finite number or a non-empty string.
 */
const cardValueSchema = z.union([
    z.number().finite(),
    z.string().trim().min(1).max(MAX_NAME_LENGTH),
]);

/**
 * A custom deck: between {@link MIN_CUSTOM_DECK_SIZE} and {@link MAX_CUSTOM_DECK_SIZE}
 * unique card values.
 */
const customDeckSchema = z
    .array(cardValueSchema)
    .min(MIN_CUSTOM_DECK_SIZE)
    .max(MAX_CUSTOM_DECK_SIZE)
    .refine((deck) => new Set(deck.map(String)).size === deck.length, {
        message: 'Custom deck must not contain duplicate values.',
    });

const deckTypeSchema = z.enum(DECK_TYPES);

const nameSchema = z.string().trim().min(1).max(MAX_NAME_LENGTH);
const titleSchema = z.string().trim().min(1).max(MAX_TITLE_LENGTH);
const descriptionSchema = z.string().trim().max(MAX_DESCRIPTION_LENGTH);

/**
 * Validates that a custom deck is present whenever the deck type is `custom`.
 */
const withCustomDeckRequirement = <T extends { customDeck?: unknown; deckType?: string }>(
    schema: z.ZodType<T>
): z.ZodType<T> =>
    schema.refine((value) => value.deckType !== 'custom' || value.customDeck !== undefined, {
        message: 'A custom deck is required when deckType is "custom".',
        path: ['customDeck'],
    });

const createRoomSchema = withCustomDeckRequirement(
    z.object({
        avatar: z.string().optional(),
        color: z.string().optional(),
        customDeck: customDeckSchema.optional(),
        deckType: deckTypeSchema.optional(),
        name: nameSchema,
        title: titleSchema.optional(),
    })
);

const joinRoomSchema = z.object({
    avatar: z.string().optional(),
    color: z.string().optional(),
    name: nameSchema,
    roomId: z.string().trim().min(1).max(MAX_NAME_LENGTH),
    sessionToken: z.string().trim().min(1).optional().nullable(),
    userId: z.string().trim().min(1).optional().nullable(),
});

const voteSchema = z.object({
    vote: cardValueSchema,
});

const addStorySchema = z.object({
    description: descriptionSchema.optional(),
    title: titleSchema,
});

const bulkAddStoriesSchema = z.object({
    stories: z.array(addStorySchema).min(1).max(MAX_BULK_STORIES),
});

const setCurrentStorySchema = z.object({
    storyIndex: z.number().int().min(0),
});

const updateStoryEstimateSchema = z.object({
    estimate: cardValueSchema,
    storyId: z.string().trim().min(1),
});

const deleteStorySchema = z.object({
    storyId: z.string().trim().min(1),
});

const targetUserSchema = z.object({
    targetUserId: z.string().trim().min(1),
});

const changeDeckSchema = withCustomDeckRequirement(
    z.object({
        customDeck: customDeckSchema.optional(),
        deckType: deckTypeSchema,
    })
);

const updateRoomTitleSchema = z.object({
    title: titleSchema,
});

const startTimerSchema = z.object({
    duration: z
        .number()
        .int()
        .min(MIN_TIMER_DURATION_SECONDS)
        .max(MAX_TIMER_DURATION_SECONDS)
        .optional(),
});

/**
 * Zod schemas for every client-originated WebSocket message payload.
 *
 * Messages without a payload (e.g. `REVEAL_VOTES`) are intentionally absent and
 * require no validation.
 */
export const MESSAGE_SCHEMAS: Partial<Record<WSMessageType, z.ZodType>> = {
    ADD_STORY: addStorySchema,
    BULK_ADD_STORIES: bulkAddStoriesSchema,
    CHANGE_DECK: changeDeckSchema,
    CREATE_ROOM: createRoomSchema,
    DELETE_STORY: deleteStorySchema,
    JOIN_ROOM: joinRoomSchema,
    KICK_PARTICIPANT: targetUserSchema,
    PROMOTE_COADMIN: targetUserSchema,
    SET_CURRENT_STORY: setCurrentStorySchema,
    START_TIMER: startTimerSchema,
    TOGGLE_USER_ROLE: targetUserSchema,
    TRANSFER_ADMIN: targetUserSchema,
    UPDATE_ROOM_TITLE: updateRoomTitleSchema,
    UPDATE_STORY_ESTIMATE: updateStoryEstimateSchema,
    VOTE: voteSchema,
};

export interface ValidationResult {
    data?: unknown;
    error?: string;
    success: boolean;
}

/**
 * Validates a message payload against the schema registered for its type.
 *
 * On success the parsed (and normalized, e.g. trimmed) value is returned so
 * callers can dispatch sanitized data instead of the raw client payload.
 *
 * @param type - The WebSocket message type.
 * @param payload - The raw, untrusted payload received from the client.
 * @returns A result carrying the parsed data, or a human-readable error message.
 */
export const validatePayload = (type: WSMessageType, payload: unknown): ValidationResult => {
    const schema = MESSAGE_SCHEMAS[type];
    if (!schema) {
        return { data: payload, success: true };
    }

    const result = schema.safeParse(payload);
    if (result.success) {
        return { data: result.data, success: true };
    }

    const [issue] = result.error.issues;
    const path = issue.path.length > 0 ? `${issue.path.join('.')}: ` : '';
    return { error: `Invalid ${type} payload — ${path}${issue.message}`, success: false };
};
