import { RoomState } from '@planitpoker/shared';
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import * as SocketContextModule from '../../context/socket-context/use-socket';
import { createMockSocketValue } from '../../tests/socket-context.mock';
import { ResultsPanel } from './results-panel';

const mockRevealedRoomState: RoomState = {
    activeDeck: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'],
    autoReveal: false,
    createdAt: Date.now(),
    currentStoryIndex: 0,
    deckType: 'fibonacci',
    hostId: 'user_1',
    id: 'ROOM01',
    isEnded: false,
    isLocked: false,
    participants: [
        {
            avatar: '🚀',
            color: '#6366f1',
            hasVoted: true,
            id: 'user_1',
            isAdmin: true,
            isHost: true,
            isOnline: true,
            isSpectator: false,
            name: 'Alice',
            vote: 5,
        },
        {
            avatar: '🎨',
            color: '#3b82f6',
            hasVoted: true,
            id: 'user_2',
            isAdmin: false,
            isHost: false,
            isOnline: true,
            isSpectator: false,
            name: 'Bob',
            vote: 5,
        },
    ],
    stories: [
        {
            id: 'story_1',
            status: 'estimating',
            title: 'Setup Database Migration',
        },
    ],
    timer: null,
    title: 'Sprint 10 Estimation',
    votesRevealed: true,
};

describe('ResultsPanel', () => {
    it('reports unanimous voting and offers the admin to accept the average', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ roomState: mockRevealedRoomState })
        );

        const screen = render(<ResultsPanel />);

        expect(screen.getByText('Estimation Results')).toBeInTheDocument();
        expect(screen.getByText(/100% Consensus/i)).toBeInTheDocument();
        expect(screen.getByText('5.0')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Accept Avg/i })).toBeInTheDocument();
    });

    it('hides the accept action from non-admin participants', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({
                currentUserId: 'user_2',
                isAdmin: false,
                isHost: false,
                roomState: mockRevealedRoomState,
            })
        );

        const screen = render(<ResultsPanel />);

        expect(screen.getByText('Estimation Results')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Accept Avg/i })).not.toBeInTheDocument();
    });
});
