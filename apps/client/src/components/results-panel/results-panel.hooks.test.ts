import { Participant, RoomState } from '@planitpoker/shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useEstimationStats } from './results-panel.hooks';

/** Builds a voter with a distinct id, so several votes can be aggregated. */
const buildVoter = (id: string, vote: null | number | string): Participant => ({
    avatar: '🚀',
    color: '#6366f1',
    hasVoted: vote !== null,
    id,
    isAdmin: false,
    isHost: false,
    isOnline: true,
    isSpectator: false,
    name: id,
    vote,
});

/** Builds a minimal revealed room around the given voters. */
const buildRoom = (participants: Participant[]): RoomState => ({
    activeDeck: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'],
    autoReveal: false,
    createdAt: Date.now(),
    currentStoryIndex: 0,
    deckType: 'fibonacci',
    hostId: participants[0]?.id ?? 'user_1',
    id: 'ROOM01',
    isEnded: false,
    isLocked: false,
    participants,
    stories: [],
    timer: null,
    title: 'Sprint 10 Estimation',
    votesRevealed: true,
});

describe('useEstimationStats', () => {
    it('reports the single cast vote as the mode', () => {
        const { result } = renderHook(() =>
            useEstimationStats(buildRoom([buildVoter('user_1', 5)]))
        );

        expect(result.current.modeVote).toBe('5');
        expect(result.current.average).toBe('5.0');
        expect(result.current.totalVotes).toBe(1);
    });

    it('picks the most frequent vote as the mode', () => {
        const { result } = renderHook(() =>
            useEstimationStats(
                buildRoom([
                    buildVoter('user_1', 5),
                    buildVoter('user_2', 5),
                    buildVoter('user_3', 8),
                ])
            )
        );

        expect(result.current.modeVote).toBe('5');
        expect(result.current.consensusPercentage).toBe(67);
        expect(result.current.isFullConsensus).toBe(false);
    });

    it('reports unanimity only when more than one voter agrees', () => {
        const single = renderHook(() => useEstimationStats(buildRoom([buildVoter('user_1', 8)])));
        expect(single.result.current.isFullConsensus).toBe(false);

        const pair = renderHook(() =>
            useEstimationStats(buildRoom([buildVoter('user_1', 8), buildVoter('user_2', 8)]))
        );
        expect(pair.result.current.isFullConsensus).toBe(true);
        expect(pair.result.current.consensusPercentage).toBe(100);
    });

    it('ignores spectators and handles a deck with no numeric votes', () => {
        const spectator: Participant = {
            ...buildVoter('user_2', null),
            isSpectator: true,
        };
        const { result } = renderHook(() =>
            useEstimationStats(buildRoom([buildVoter('user_1', 'XL'), spectator]))
        );

        expect(result.current.totalVotes).toBe(1);
        expect(result.current.hasNumeric).toBe(false);
        expect(result.current.average).toBe('N/A');
        expect(result.current.modeVote).toBe('XL');
    });

    it('falls back to a placeholder when nobody voted', () => {
        const { result } = renderHook(() => useEstimationStats(buildRoom([])));

        expect(result.current.modeVote).toBe('-');
        expect(result.current.average).toBe('N/A');
        expect(result.current.consensusPercentage).toBe(0);
        expect(result.current.totalVotes).toBe(0);
    });
});
