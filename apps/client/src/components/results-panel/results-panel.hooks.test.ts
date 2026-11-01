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
    endedAt: null,
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
        expect(result.current.averageText).toBe('5.0');
        expect(result.current.medianText).toBe('5.0');
        expect(result.current.totalVotes).toBe(1);
    });

    it('picks the most frequent vote as the mode and keeps the median between cards', () => {
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
        expect(result.current.medianText).toBe('5.0');
        expect(result.current.deviationText).toBe('1.41');
        expect(result.current.consensusPercentage).toBe(67);
    });

    it('ignores spectators and empty cards before the reveal', () => {
        const spectator: Participant = {
            ...buildVoter('user_2', 8),
            isSpectator: true,
        };
        const room = buildRoom([buildVoter('user_1', 3), spectator]);
        const { result } = renderHook(() => useEstimationStats({ ...room, votesRevealed: false }));

        expect(result.current.totalVotes).toBe(1);
        expect(result.current.votedParticipants).toHaveLength(1);
    });

    it('keeps a spectator card that was cast before the reveal', () => {
        const spectator: Participant = {
            ...buildVoter('user_3', 5),
            isSpectator: true,
        };
        const revealedRoom = buildRoom([
            buildVoter('user_1', 3),
            buildVoter('user_2', 5),
            spectator,
        ]);
        const hiddenRoom = { ...revealedRoom, votesRevealed: false };
        const revealed = renderHook(() => useEstimationStats(revealedRoom));
        const hidden = renderHook(() => useEstimationStats(hiddenRoom));

        expect(revealed.result.current.totalVotes).toBe(3);
        expect(revealed.result.current.averageText).toBe('4.3');
        expect(hidden.result.current.totalVotes).toBe(2);
    });

    it('reports unanimity only when every voter chose the same card', () => {
        const consensus = renderHook(() =>
            useEstimationStats(buildRoom([buildVoter('user_1', 5), buildVoter('user_2', 5)]))
        );
        const split = renderHook(() =>
            useEstimationStats(buildRoom([buildVoter('user_1', 5), buildVoter('user_2', 8)]))
        );

        expect(consensus.result.current.isFullConsensus).toBe(true);
        expect(split.result.current.isFullConsensus).toBe(false);
    });

    it('reports symbolic-only rounds as having no numeric figure', () => {
        const { result } = renderHook(() =>
            useEstimationStats(buildRoom([buildVoter('user_1', '?'), buildVoter('user_2', '☕')]))
        );

        expect(result.current.hasNumeric).toBe(false);
        expect(result.current.averageText).toBe('N/A');
        expect(result.current.medianText).toBe('N/A');
        expect(result.current.totalVotes).toBe(2);
    });
});
