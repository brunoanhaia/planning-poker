import { CardValue, Participant, RoomState } from '@planitpoker/shared';
import confetti from 'canvas-confetti';
import { useEffect, useMemo } from 'react';

import { VoteStats, computeVoteStats, formatStatValue } from '../../utils/estimation-stats';

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
    /** Participants whose vote counts towards this story. */
    votedParticipants: Participant[];
}

/**
 * Aggregates the revealed votes of the active story and fires a celebration on
 * unanimity.
 *
 * @param roomState - The live room, or `null` before a room is joined.
 * @returns The aggregate statistics for the current story.
 */
export const useEstimationStats = (roomState: null | RoomState): EstimationStats => {
    const votedParticipants = useMemo(() => {
        if (!roomState) {
            return [];
        }
        return roomState.participants.filter(
            (p) => !p.isSpectator && p.vote !== null && p.vote !== undefined
        );
    }, [roomState]);

    const stats = useMemo(
        () =>
            computeVoteStats(
                votedParticipants.map((participant) => ({
                    name: participant.name,
                    vote: participant.vote as CardValue,
                }))
            ),
        [votedParticipants]
    );

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
        votedParticipants,
    };
};
