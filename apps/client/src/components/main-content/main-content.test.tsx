import { RoomState } from '@planitpoker/shared';
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import * as SocketContextModule from '../../context/socket-context/use-socket';
import { createMockSocketValue } from '../../tests/socket-context.mock';
import { MainContent } from './main-content';

const mockRoomState: RoomState = {
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
            name: 'Alice Host',
            vote: 5,
        },
        {
            avatar: '🎨',
            color: '#3b82f6',
            hasVoted: false,
            id: 'user_2',
            isAdmin: false,
            isHost: false,
            isOnline: true,
            isSpectator: false,
            name: 'Bob Voter',
            vote: null,
        },
    ],
    stories: [
        {
            description: 'Run initial migration script for postgres schema',
            id: 'story_1',
            status: 'estimating',
            title: 'Setup Database Migration',
        },
    ],
    timer: {
        duration: 60,
        isRunning: true,
        remaining: 45,
    },
    title: 'Sprint 10 Estimation',
    votesRevealed: false,
};

/** Renders the shell against a mocked socket session. */
const renderMainContent = () =>
    render(<MainContent colorMode="dark" onToggleColorMode={vi.fn()} />);

describe('MainContent', () => {
    it('renders the roster, the active story and the live timer for an admin', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ roomState: mockRoomState })
        );

        const screen = renderMainContent();

        expect(screen.getByText('Setup Database Migration')).toBeInTheDocument();
        expect(screen.getByText('Alice Host')).toBeInTheDocument();
        expect(screen.getByText('(you)')).toBeInTheDocument();
        expect(screen.getByText('Bob Voter')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reveal Votes/i })).toBeInTheDocument();
        expect(screen.getByText('0:45')).toBeInTheDocument();
    });

    it('waits for the host instead of offering reveal to a plain voter', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({
                currentUserId: 'user_2',
                isAdmin: false,
                isHost: false,
                roomState: mockRoomState,
            })
        );

        const screen = renderMainContent();

        expect(screen.queryByRole('button', { name: /Reveal Votes/i })).not.toBeInTheDocument();
        expect(screen.getByText(/Waiting for Host to reveal/i)).toBeInTheDocument();
    });
});
