import { RoomState, Story } from '@planitpoker/shared';
import { describe, expect, it } from 'vitest';

import { buildSessionSummary, computeVoteStats, formatStatValue } from './estimation-stats';

describe('computeVoteStats', () => {
    it('averages an even number of cards and splits the median between them', () => {
        const stats = computeVoteStats([
            { name: 'a', vote: 2 },
            { name: 'b', vote: 5 },
            { name: 'c', vote: 8 },
            { name: 'd', vote: 13 },
        ]);

        expect(stats.average).toBe(7);
        expect(stats.median).toBe(6.5);
        expect(stats.totalVotes).toBe(4);
    });

    it('uses the population deviation, not the sample one', () => {
        const stats = computeVoteStats([
            { name: 'a', vote: 2 },
            { name: 'b', vote: 4 },
            { name: 'c', vote: 4 },
            { name: 'd', vote: 4 },
            { name: 'e', vote: 5 },
            { name: 'f', vote: 5 },
            { name: 'g', vote: 7 },
            { name: 'h', vote: 9 },
        ]);

        expect(stats.standardDeviation).toBe(2);
    });

    it('flags the far card of a spread sample as an outlier, by name', () => {
        const stats = computeVoteStats([
            { name: 'a', vote: 1 },
            { name: 'b', vote: 2 },
            { name: 'c', vote: 2 },
            { name: 'd', vote: 3 },
            { name: 'e', vote: 21 },
        ]);

        expect(stats.outliers.map((outlier) => outlier.name)).toEqual(['e']);
    });

    it('never calls a card an outlier in a sample too small to have a fence', () => {
        const stats = computeVoteStats([
            { name: 'a', vote: 1 },
            { name: 'b', vote: 1 },
            { name: 'c', vote: 89 },
        ]);

        expect(stats.outliers).toEqual([]);
    });

    it('keeps symbolic cards in the distribution but out of the arithmetic', () => {
        const stats = computeVoteStats([
            { name: 'a', vote: '?' },
            { name: 'b', vote: '☕' },
            { name: 'c', vote: 5 },
        ]);

        expect(stats.average).toBe(5);
        expect(stats.median).toBe(5);
        expect(stats.totalVotes).toBe(3);
        expect(stats.voteCounts).toEqual({ '5': 1, '?': 1, '☕': 1 });
        expect(stats.consensusPercentage).toBe(33);
    });

    it('reports no figures at all when nobody cast a numeric card', () => {
        const stats = computeVoteStats([
            { name: 'a', vote: '?' },
            { name: 'b', vote: '?' },
        ]);

        expect(stats.average).toBeNull();
        expect(stats.median).toBeNull();
        expect(stats.standardDeviation).toBeNull();
        expect(formatStatValue(stats.median, 1)).toBe('N/A');
    });
});

/** Builds a room with one story, its rounds and an accepted estimate. */
const buildRoom = ({
    endedAt = 61_000,
    story = {},
}: { endedAt?: null | number; story?: Partial<Story> } = {}): RoomState => ({
    activeDeck: [1, 2, 3, 5, 8],
    autoReveal: false,
    createdAt: 1_000,
    currentStoryIndex: 0,
    deckType: 'fibonacci',
    endedAt,
    hostId: 'user_1',
    id: 'ROOM01',
    isEnded: true,
    isLocked: false,
    participants: [],
    stories: [
        {
            description: undefined,
            id: 'story_1',
            rounds: [],
            status: 'pending',
            title: 'One',
            ...story,
        },
    ],
    timer: null,
    title: 'Sprint 10 Estimation',
    votesRevealed: false,
});

describe('buildSessionSummary', () => {
    it('sums only the numeric accepted estimates and reports the session duration', () => {
        const room = buildRoom({ story: { finalEstimate: 8, status: 'completed' } });
        room.stories.push({
            finalEstimate: 'L',
            id: 'story_2',
            rounds: [],
            status: 'completed',
            title: 'Two',
        });
        room.stories.push({
            finalEstimate: 5,
            id: 'story_3',
            rounds: [],
            status: 'completed',
            title: 'Three',
        });

        const summary = buildSessionSummary(room);

        expect(summary.totalPoints).toBe(13);
        expect(summary.estimatedStories).toBe(3);
        expect(summary.durationMs).toBe(60_000);
    });

    it('numbers the rounds in the order they were revealed', () => {
        const room = buildRoom({
            story: {
                finalEstimate: 8,
                rounds: [
                    {
                        id: 'round_1',
                        revealedAt: 2_000,
                        votes: [{ name: 'a', participantId: 'user_1', vote: 8 }],
                    },
                    {
                        id: 'round_2',
                        revealedAt: 3_000,
                        votes: [{ name: 'a', participantId: 'user_1', vote: 5 }],
                    },
                ],
                status: 'completed',
            },
        });

        const summary = buildSessionSummary(room);

        expect(summary.stories[0].rounds.map((round) => round.number)).toEqual([1, 2]);
        expect(summary.stories[0].rounds[1].stats.average).toBe(5);
    });

    it('reports a missing duration while the session is still running', () => {
        const room = buildRoom({ endedAt: null });

        expect(buildSessionSummary(room).durationMs).toBeNull();
    });
});
