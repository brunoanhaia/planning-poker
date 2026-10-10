import { Participant, RoomState } from '@planitpoker/shared';
import confetti from 'canvas-confetti';
import { useEffect, useMemo } from 'react';

/** Particle count and spread used for the full-consensus celebration. */
const CONFETTI_OPTIONS: confetti.Options = {
    origin: { y: 0.6 },
    particleCount: 100,
    spread: 70,
};

/** Minimum number of voters before unanimity counts as a consensus. */
const MIN_CONSENSUS_VOTERS = 2;

interface EstimationStats {
    average: string;
    consensusPercentage: number;
    hasNumeric: boolean;
    isFullConsensus: boolean;
    modeVote: string;
    totalVotes: number;
    voteCounts: Record<string, number>;
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

    const {
        average,
        consensusPercentage,
        hasNumeric,
        isFullConsensus,
        modeVote,
        totalVotes,
        voteCounts,
    } = useMemo(() => {
        const counts: Record<string, number> = {};
        const numericVotes: number[] = [];

        votedParticipants.forEach((participant) => {
            const voteKey = String(participant.vote);
            counts[voteKey] = (counts[voteKey] || 0) + 1;

            const numeric = Number(participant.vote);
            if (!Number.isNaN(numeric) && typeof participant.vote !== 'symbol') {
                numericVotes.push(numeric);
            }
        });

        const total = votedParticipants.length;
        const hasNums = numericVotes.length > 0;
        const sum = numericVotes.reduce((acc, value) => acc + value, 0);
        const avg = hasNums ? (sum / numericVotes.length).toFixed(1) : 'N/A';

        const highestFreq = Math.max(0, ...Object.values(counts));
        const consensus = total > 0 ? Math.round((highestFreq / total) * 100) : 0;

        const mode = Object.keys(counts).reduce<null | string>(
            (best, key) => (best === null || counts[key] > counts[best] ? key : best),
            null
        );

        return {
            average: avg,
            consensusPercentage: consensus,
            hasNumeric: hasNums,
            isFullConsensus: consensus === 100 && total >= MIN_CONSENSUS_VOTERS,
            modeVote: mode ?? '-',
            totalVotes: total,
            voteCounts: counts,
        };
    }, [votedParticipants]);

    useEffect(() => {
        if (isFullConsensus && roomState?.votesRevealed) {
            confetti(CONFETTI_OPTIONS);
        }
    }, [isFullConsensus, roomState?.votesRevealed]);

    return {
        average,
        consensusPercentage,
        hasNumeric,
        isFullConsensus,
        modeVote,
        totalVotes,
        voteCounts,
        votedParticipants,
    };
};
