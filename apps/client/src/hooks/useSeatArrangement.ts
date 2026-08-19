import { Participant } from '@planitpoker/shared';
import { useMemo } from 'react';

export interface PositionedParticipant {
    left: number;
    participant: Participant;
    top: number;
}

export const useSeatArrangement = (
    participants: Participant[] = [],
    radiusX = 42,
    radiusY = 38
): PositionedParticipant[] => {
    return useMemo(() => {
        const total = participants.length;
        if (total === 0) {
            return [];
        }

        return participants.map((participant, index) => {
            const angle = (index / total) * 2 * Math.PI + Math.PI / 2;
            const left = 50 + radiusX * Math.cos(angle);
            const top = 50 + radiusY * Math.sin(angle);

            return {
                left,
                participant,
                top,
            };
        });
    }, [participants, radiusX, radiusY]);
};
