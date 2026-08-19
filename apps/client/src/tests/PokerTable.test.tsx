import { createTheme, ThemeProvider } from '@mui/material';
import { RoomState } from '@planitpoker/shared';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PokerTable } from '../components/PokerTable';
import * as SocketContextModule from '../context/SocketContext';

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

describe('PokerTable Component', () => {
  it('renders story title, reveal votes button, and live timer', () => {
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
      roomState: mockRoomState,
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
        <PokerTable />
      </ThemeProvider>
    );

    expect(screen.getByText('Setup Database Migration')).toBeInTheDocument();
    expect(screen.getByText('Alice Host (You)')).toBeInTheDocument();
    expect(screen.getByText('Bob Voter')).toBeInTheDocument();
    expect(screen.getByText(/Reveal Votes/i)).toBeInTheDocument();
    expect(screen.getByText('0:45')).toBeInTheDocument();
  });

  it('renders waiting status instead of reveal button for non-admin users', () => {
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
      roomState: mockRoomState,
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
        <PokerTable />
      </ThemeProvider>
    );

    expect(screen.queryByRole('button', { name: /Reveal Votes/i })).not.toBeInTheDocument();
    expect(screen.getByText(/Waiting for Host to reveal/i)).toBeInTheDocument();
  });
});
