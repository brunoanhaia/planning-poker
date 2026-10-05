import { vi } from 'vitest';

import { SocketContextValue } from '../context/socket-context/socket-context';

/**
 * Builds a complete `useSocket` value for component tests.
 *
 * Every command is a spy, so a test can assert on exactly what a component sent
 * without standing up a real WebSocket session.
 *
 * @param overrides - The fields a test wants to differ from the defaults.
 * @returns A fully populated socket context value.
 */
export const createMockSocketValue = (
    overrides: Partial<SocketContextValue> = {}
): SocketContextValue => ({
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
    roomState: null,
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
    ...overrides,
});
