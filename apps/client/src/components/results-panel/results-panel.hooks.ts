import { CardValue, RoomState } from '@planitpoker/shared';
import confetti from 'canvas-confetti';
import { useEffect, useMemo } from 'react';

import {
    VoteInput,
    VoteStats,
    computeVoteStats,
    formatStatValue,
} from '../../utils/estimation-stats';

/** Particle count and spread used for the full-consensus celebration. */
const CONFETTI_OPTIONS: confetti.Options = {
    origin: { y: 0.6 },
    particleCount: 100,
    spread: 70,
};

/** Minimum number of voters before unanimity counts as a consensus. */
const MIN_CONSENSUS_VOTERS = 2;

/** Decimals used for the mean, the median and the spread. */
const DECIMALS_MEAN = 1;

/** Decimals used for the standard deviation, which needs more resolution. */
const DECIMALS_DEVIATION = 2;

/** Statistics of the active story plus the participants behind them. */
export interface EstimationStats extends VoteStats {
    /** Mean rendered for display, or `N/A` when no card carries a number. */
    averageText: string;
    /** Whether at least one card carries a number. */
    hasNumeric: boolean;
    /** `true` when every voter chose the same card. */
    isFullConsensus: boolean;
    /** Median rendered for display, or `N/A` when no card carries a number. */
    medianText: string;
    /** Standard deviation rendered for display, or `N/A` without numbers. */
    deviationText: string;
}

/**
 * Aggregates the revealed votes of the active story and fires a celebration on
 * unanimity.
 *
 * A revealed round comes from the recorded snapshot, not from the live roster:
 * an administrator may clear an offline participant after the reveal, and the
 * card they showed must remain part of the statistics. Before the reveal there
 * is no snapshot yet, so the live cards are used.
 *
 * @param roomState - The live room, or `null` before a room is joined.
 * @returns The aggregate statistics for the current story.
 */
export const useEstimationStats = (roomState: null | RoomState): EstimationStats => {
    const votes = useMemo<VoteInput[]>(() => {
        if (!roomState) {
            return [];
        }

        const story = roomState.stories[roomState.currentStoryIndex ?? 0];
        const revealedRound = roomState.votesRevealed
            ? story?.rounds[story.rounds.length - 1]
            : undefined;
        if (revealedRound) {
            return revealedRound.votes.map((vote) => ({ name: vote.name, vote: vote.vote }));
        }

        return roomState.participants
            .filter((p) => {
                if (p.vote === null || p.vote === undefined) {
                    return false;
                }
                // A revealed round is frozen: a voter who switches to spectator afterwards
                // keeps the card they showed, so the role only filters the cards still being cast.
                return roomState.votesRevealed || !p.isSpectator;
            })
            .map((participant) => ({
                name: participant.name,
                vote: participant.vote as CardValue,
            }));
    }, [roomState]);

    const stats = useMemo(() => computeVoteStats(votes), [votes]);

    const isFullConsensus =
        stats.totalVotes >= MIN_CONSENSUS_VOTERS &&
        stats.totalVotes > 0 &&
        Object.keys(stats.voteCounts).length === 1;

    const isRevealed = roomState?.votesRevealed === true;

    useEffect(() => {
        if (isFullConsensus && isRevealed) {
            confetti(CONFETTI_OPTIONS);
        }
    }, [isFullConsensus, isRevealed]);

    return {
        ...stats,
        averageText: formatStatValue(stats.average, DECIMALS_MEAN),
        deviationText: formatStatValue(stats.standardDeviation, DECIMALS_DEVIATION),
        hasNumeric: stats.numericVotes.length > 0,
        isFullConsensus,
        medianText: formatStatValue(stats.median, DECIMALS_MEAN),
    };
};
