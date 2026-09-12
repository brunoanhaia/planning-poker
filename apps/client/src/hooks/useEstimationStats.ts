import { Participant, RoomState } from '@planitpoker/shared';
import confetti from 'canvas-confetti';
import { useEffect, useMemo } from 'react';

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

export const useEstimationStats = (roomState: RoomState | null): EstimationStats => {
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

        votedParticipants.forEach((p) => {
            const voteKey = String(p.vote);
            counts[voteKey] = (counts[voteKey] || 0) + 1;

            const num = Number(p.vote);
            if (!Number.isNaN(num) && typeof p.vote !== 'symbol') {
                numericVotes.push(num);
            }
        });

        const total = votedParticipants.length;
        const hasNums = numericVotes.length > 0;
        const sum = numericVotes.reduce((acc, n) => acc + n, 0);
        const avg = hasNums ? (sum / numericVotes.length).toFixed(1) : 'N/A';

        const highestFreq = Math.max(0, ...Object.values(counts));
        const consensus = total > 0 ? Math.round((highestFreq / total) * 100) : 0;
        const fullConsensus = consensus === 100 && total > 1;

        const mode =
            Object.keys(counts).length > 0
                ? Object.keys(counts).reduce((a, b) => (counts[a] > counts[b] ? a : b), '')
                : '-';

        return {
            average: avg,
            consensusPercentage: consensus,
            hasNumeric: hasNums,
            isFullConsensus: fullConsensus,
            modeVote: mode,
            totalVotes: total,
            voteCounts: counts,
        };
    }, [votedParticipants]);

    useEffect(() => {
        if (isFullConsensus && roomState?.votesRevealed) {
            confetti({
                origin: { y: 0.6 },
                particleCount: 100,
                spread: 70,
            });
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
