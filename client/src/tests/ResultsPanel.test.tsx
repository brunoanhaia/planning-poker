import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ResultsPanel } from '../components/ResultsPanel';
import * as SocketContextModule from '../context/SocketContext';
import { RoomState } from '../types';
import { ThemeProvider, createTheme } from '@mui/material';

const mockRevealedRoomState: RoomState = {
  id: 'ROOM01',
  title: 'Sprint 10 Estimation',
  hostId: 'user_1',
  deckType: 'fibonacci',
  activeDeck: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'],
  participants: [
    {
      id: 'user_1',
      name: 'Alice',
      avatar: '🚀',
      color: '#6366f1',
      vote: 5,
      hasVoted: true,
      isSpectator: false,
      isHost: true,
      isOnline: true,
    },
    {
      id: 'user_2',
      name: 'Bob',
      avatar: '🎨',
      color: '#3b82f6',
      vote: 5,
      hasVoted: true,
      isSpectator: false,
      isHost: false,
      isOnline: true,
    },
  ],
  stories: [
    {
      id: 'story_1',
      title: 'Setup Database Migration',
      status: 'estimating',
    },
  ],
  currentStoryIndex: 0,
  votesRevealed: true,
  createdAt: Date.now(),
};

describe('ResultsPanel Component', () => {
  it('calculates 100% consensus and average score correctly', () => {
    vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue({
      roomState: mockRevealedRoomState,
      currentUserId: 'user_1',
      isConnected: true,
      error: null,
      createRoom: vi.fn(),
      joinRoom: vi.fn(),
      submitVote: vi.fn(),
      revealVotes: vi.fn(),
      resetVotes: vi.fn(),
      toggleSpectator: vi.fn(),
      addStory: vi.fn(),
      setCurrentStory: vi.fn(),
      updateStoryEstimate: vi.fn(),
      deleteStory: vi.fn(),
      changeDeck: vi.fn(),
      leaveRoom: vi.fn(),
      clearError: vi.fn(),
    });

    const theme = createTheme();
    render(
      <ThemeProvider theme={theme}>
        <ResultsPanel />
      </ThemeProvider>
    );

    expect(screen.getByText('Estimation Results')).toBeInTheDocument();
    expect(screen.getByText(/100% Consensus/i)).toBeInTheDocument();
    expect(screen.getByText('5.0')).toBeInTheDocument(); // Average
  });
});
