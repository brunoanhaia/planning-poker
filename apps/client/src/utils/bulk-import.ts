import {
    BulkAddStoriesPayload,
    MAX_BULK_STORIES,
    MAX_DESCRIPTION_LENGTH,
    MAX_TITLE_LENGTH,
    WS_MAX_PAYLOAD_BYTES,
} from '@planitpoker/shared';

/** One story as the bulk import accepts it. */
export type ImportableStory = BulkAddStoriesPayload['stories'][number];

/**
 * Head-room kept inside a frame for its own envelope and masking overhead.
 *
 * The measured size of a message is the serialized payload it carries, so the
 * difference against {@link WS_MAX_PAYLOAD_BYTES} is pure slack for the
 * transport: the frame header, the client mask and JSON escaping the transport
 * may add on top.
 */
const FRAME_ENVELOPE_BYTES = 2 * 1024;

/** Largest serialized message one import batch may produce. */
export const BULK_IMPORT_FRAME_BUDGET_BYTES = WS_MAX_PAYLOAD_BYTES - FRAME_ENVELOPE_BYTES;

/** Builds the exact message a batch travels in, so its size can be measured. */
const messageFor = (batch: ImportableStory[]): string =>
    JSON.stringify({ payload: { stories: batch }, type: 'BULK_ADD_STORIES' });

/** Byte length of a string as the transport counts it, not as JavaScript counts it. */
const utf8Length = (value: string): number => new TextEncoder().encode(value).length;

/**
 * Normalizes one story to what the server accepts.
 *
 * The server trims and truncates these fields itself; doing it here as well keeps
 * the frame inside the budget and keeps a story the server would discard from
 * being reported as imported.
 *
 * @param story - The story as parsed from the pasted text.
 * @returns The clamped story, or null when it carries no usable title.
 */
const normalizeImportStory = (story: ImportableStory): ImportableStory | null => {
    const title = story.title.trim().slice(0, MAX_TITLE_LENGTH);
    if (!title) {
        return null;
    }
    const description = story.description?.trim().slice(0, MAX_DESCRIPTION_LENGTH);
    return description ? { description, title } : { title };
};

/**
 * Splits an import into batches that each fit in one WebSocket frame.
 *
 * A single frame is capped at {@link WS_MAX_PAYLOAD_BYTES}, and fifty full-size
 * stories serialize to several times that — so an import sent as one message was
 * refused by the transport before it ever reached the room. Each batch is
 * measured as the message it will become, which makes the guarantee exact rather
 * than an estimate: no batch exceeds the budget or the {@link MAX_BULK_STORIES}
 * card limit.
 *
 * A story that alone would not fit cannot be split further, so it travels on its
 * own for the server to answer. That cannot happen inside the documented field
 * limits, which this function enforces.
 *
 * @param stories - The stories to import, in input order.
 * @returns The batches, in input order, with every usable story preserved.
 */
export const chunkStoriesForImport = (stories: ImportableStory[]): ImportableStory[][] => {
    const batches: ImportableStory[][] = [];
    let current: ImportableStory[] = [];

    for (const story of stories) {
        const normalized = normalizeImportStory(story);
        if (!normalized) {
            continue;
        }

        const candidate = [...current, normalized];
        const overCardLimit = current.length >= MAX_BULK_STORIES;
        const overBudget = utf8Length(messageFor(candidate)) > BULK_IMPORT_FRAME_BUDGET_BYTES;

        if (current.length > 0 && (overCardLimit || overBudget)) {
            batches.push(current);
            current = [normalized];
            continue;
        }

        current = candidate;
    }

    if (current.length > 0) {
        batches.push(current);
    }
    return batches;
};
