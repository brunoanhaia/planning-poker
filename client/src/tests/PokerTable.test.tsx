import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PokerTable } from '../components/PokerTable';
import * as SocketContextModule from '../context/SocketContext';
import { RoomState } from '../types';
import { ThemeProvider, createTheme } from '@mui/material';

const mockRoomState: RoomState = {
  id: 'ROOM01',
  title: 'Sprint 10 Estimation',
  hostId: 'user_1',
  deckType: 'fibonacci',
  activeDeck: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'],
  participants: [
    {
      id: 'user_1',
      name: 'Alice Host',
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
      name: 'Bob Voter',
      avatar: '🎨',
      color: '#3b82f6',
      vote: null,
      hasVoted: false,
      isSpectator: false,
      isHost: false,
      isOnline: true,
    },
  ],
  stories: [
    {
      id: 'story_1',
      title: 'Setup Database Migration',
      description: 'Run initial migration script for postgres schema',
      status: 'estimating',
    },
  ],
  currentStoryIndex: 0,
  votesRevealed: false,
  createdAt: Date.now(),
};

describe('PokerTable Component', () => {
  it('renders story title and reveal votes button', () => {
    vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue({
      roomState: mockRoomState,
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
        <PokerTable />
      </ThemeProvider>
    );

    expect(screen.getByText('Setup Database Migration')).toBeInTheDocument();
    expect(screen.getByText('Alice Host (You)')).toBeInTheDocument();
    expect(screen.getByText('Bob Voter')).toBeInTheDocument();
    expect(screen.getByText(/Reveal Votes/i)).toBeInTheDocument();
  });
});
