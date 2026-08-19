import { createTheme, ThemeProvider } from '@mui/material';
import { RoomState } from '@planitpoker/shared';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ResultsPanel } from '../components/ResultsPanel';
import * as SocketContextModule from '../context/SocketContext';

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

describe('ResultsPanel Component', () => {
    it('calculates 100% consensus, average score, and renders Accept Score for admin', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue({
            addStory: vi.fn(),
            bulkAddStories: vi.fn(),
            changeDeck: vi.fn(),
            clearError: vi.fn(),
            clearKickedMessage: vi.fn(),
            createRoom: vi.fn(),
            currentUserId: 'user_1',
            deleteStory: vi.fn(),
            endSession: vi.fn(),
            error: null,
            isAdmin: true,
            isConnected: true,
            isHost: true,
            joinRoom: vi.fn(),
            kickedMessage: null,
            kickParticipant: vi.fn(),
            leaveRoom: vi.fn(),
            pauseTimer: vi.fn(),
            promoteCoAdmin: vi.fn(),
            resetTimer: vi.fn(),
            resetVotes: vi.fn(),
            revealVotes: vi.fn(),
            roomState: mockRevealedRoomState,
            setCurrentStory: vi.fn(),
            startTimer: vi.fn(),
            submitVote: vi.fn(),
            toggleAutoReveal: vi.fn(),
            toggleLockRoom: vi.fn(),
            toggleSpectator: vi.fn(),
            toggleUserRole: vi.fn(),
            transferAdmin: vi.fn(),
            updateRoomTitle: vi.fn(),
            updateStoryEstimate: vi.fn(),
        });

        const theme = createTheme();
        render(
            <ThemeProvider theme={theme}>
                <ResultsPanel />
            </ThemeProvider>
        );

        expect(screen.getByText('Estimation Results')).toBeInTheDocument();
        expect(screen.getByText(/100% Consensus/i)).toBeInTheDocument();
        expect(screen.getByText('5.0')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Accept Avg/i })).toBeInTheDocument();
    });

    it('hides Accept Score button for non-admin participants', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue({
            addStory: vi.fn(),
            bulkAddStories: vi.fn(),
            changeDeck: vi.fn(),
            clearError: vi.fn(),
            clearKickedMessage: vi.fn(),
            createRoom: vi.fn(),
            currentUserId: 'user_2',
            deleteStory: vi.fn(),
            endSession: vi.fn(),
            error: null,
            isAdmin: false,
            isConnected: true,
            isHost: false,
            joinRoom: vi.fn(),
            kickedMessage: null,
            kickParticipant: vi.fn(),
            leaveRoom: vi.fn(),
            pauseTimer: vi.fn(),
            promoteCoAdmin: vi.fn(),
            resetTimer: vi.fn(),
            resetVotes: vi.fn(),
            revealVotes: vi.fn(),
            roomState: mockRevealedRoomState,
            setCurrentStory: vi.fn(),
            startTimer: vi.fn(),
            submitVote: vi.fn(),
            toggleAutoReveal: vi.fn(),
            toggleLockRoom: vi.fn(),
            toggleSpectator: vi.fn(),
            toggleUserRole: vi.fn(),
            transferAdmin: vi.fn(),
            updateRoomTitle: vi.fn(),
            updateStoryEstimate: vi.fn(),
        });

        const theme = createTheme();
        render(
            <ThemeProvider theme={theme}>
                <ResultsPanel />
            </ThemeProvider>
        );

        expect(screen.getByText('Estimation Results')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Accept Avg/i })).not.toBeInTheDocument();
    });
});
