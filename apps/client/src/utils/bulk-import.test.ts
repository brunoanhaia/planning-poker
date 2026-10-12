import { MAX_BULK_STORIES, MAX_DESCRIPTION_LENGTH, MAX_TITLE_LENGTH } from '@planitpoker/shared';
import { describe, expect, it } from 'vitest';

import {
    BULK_IMPORT_FRAME_BUDGET_BYTES,
    chunkStoriesForImport,
    ImportableStory,
} from './bulk-import';

/** Byte length of the message a batch actually travels in. */
const messageBytes = (batch: ImportableStory[]): number =>
    new TextEncoder().encode(
        JSON.stringify({ payload: { stories: batch }, type: 'BULK_ADD_STORIES' })
    ).length;

/** A story at the largest size the server accepts. */
const maxSizeStory = (index: number): ImportableStory => ({
    description: `d${index}${'D'.repeat(MAX_DESCRIPTION_LENGTH - 2)}`,
    title: `t${index}${'T'.repeat(MAX_TITLE_LENGTH - 2)}`,
});

describe('chunkStoriesForImport', () => {
    it('keeps a small import in a single batch', () => {
        const stories = [
            { title: 'Login API' },
            { description: 'Implement OAuth', title: 'Dashboard' },
        ];

        expect(chunkStoriesForImport(stories)).toEqual([stories]);
    });

    it('splits a full import so every message fits in one frame', () => {
        // Fifty stories at the documented maximum serialize to ~106 KB, which
        // is several times the largest frame the server reads.
        const batches = chunkStoriesForImport(
            Array.from({ length: MAX_BULK_STORIES }, (_, index) => maxSizeStory(index))
        );

        expect(batches.length).toBeGreaterThan(1);
        for (const batch of batches) {
            expect(messageBytes(batch)).toBeLessThanOrEqual(BULK_IMPORT_FRAME_BUDGET_BYTES);
        }
    });

    it('never sends more stories than one message accepts', () => {
        const batches = chunkStoriesForImport(
            Array.from({ length: 400 }, (_, index) => ({ title: `Story ${index}` }))
        );

        for (const batch of batches) {
            expect(batch.length).toBeLessThanOrEqual(MAX_BULK_STORIES);
        }
        expect(batches.flat()).toHaveLength(400);
    });

    it('keeps the input order and never drops a usable story', () => {
        const stories = Array.from({ length: 120 }, () => ({
            description: 'D'.repeat(MAX_DESCRIPTION_LENGTH),
            title: 'T'.repeat(MAX_TITLE_LENGTH),
        }));

        expect(chunkStoriesForImport(stories).flat()).toEqual(stories);
    });

    it('drops stories without a title', () => {
        expect(chunkStoriesForImport([{ title: '   ' }])).toEqual([]);
        expect(chunkStoriesForImport([])).toEqual([]);
    });

    it('clamps fields longer than the server accepts', () => {
        const [batch] = chunkStoriesForImport([
            {
                description: 'D'.repeat(MAX_DESCRIPTION_LENGTH * 2),
                title: 'T'.repeat(MAX_TITLE_LENGTH * 2),
            },
        ]);

        expect(batch[0].title).toHaveLength(MAX_TITLE_LENGTH);
        expect(batch[0].description).toHaveLength(MAX_DESCRIPTION_LENGTH);
    });

    it('always fits a single maximum-size story in its own frame', () => {
        const [batch] = chunkStoriesForImport([maxSizeStory(0)]);

        expect(batch).toHaveLength(1);
        expect(messageBytes(batch)).toBeLessThanOrEqual(BULK_IMPORT_FRAME_BUDGET_BYTES);
    });
});
