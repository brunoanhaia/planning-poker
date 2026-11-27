import { DeckType, RoomState } from '@planitpoker/shared';
import { createContext } from 'react';

/**
 * Transport state the client renders and announces.
 *
 * `waking` is the cold-start state: the socket has not opened within the grace
 * period, so the backend is probably asleep rather than merely slow.
 */
export type ConnectionStatus = 'connected' | 'connecting' | 'offline' | 'reconnecting' | 'waking';

/**
 * State of the room the browser remembers from a previous visit.
 *
 * `checking` holds the lobby entry actions until the server confirms the room
 * still exists; `gone` means the record and its tokens were dropped.
 */
export type StoredRoomStatus = 'checking' | 'exists' | 'gone' | 'none';

/** Everything a screen needs to talk to the room over the WebSocket session. */
export interface SocketContextValue {
    addStory: (title: string, description?: string) => void;
    bulkAddStories: (stories: { description?: string; title: string }[]) => void;
    changeDeck: (deckType: DeckType, customDeck?: (number | string)[]) => void;
    clearError: () => void;
    clearKickedMessage: () => void;
    clearOfflineParticipants: () => void;
    connectionStatus: ConnectionStatus;
    createRoom: (
        name: string,
        avatar: string,
        color: string,
        title?: string,
        deckType?: DeckType,
        customDeck?: (number | string)[]
    ) => void;
    currentUserId: null | string;
    deleteStory: (storyId: string) => void;
    endSession: () => void;
    error: null | string;
    isAdmin: boolean;
    isConnected: boolean;
    isHost: boolean;
    joinRoom: (roomId: string, name: string, avatar: string, color: string) => void;
    kickedMessage: null | string;
    kickParticipant: (targetUserId: string) => void;
    leaveRoom: () => void;
    pauseTimer: () => void;
    pendingEntry: null | 'create' | 'join';
    promoteCoAdmin: (targetUserId: string) => void;
    resetTimer: () => void;
    resetVotes: () => void;
    retryConnection: () => void;
    revealVotes: () => void;
    roomState: null | RoomState;
    setCurrentStory: (index: number) => void;
    startTimer: (duration?: number) => void;
    /** Whether the room remembered from a previous visit still exists. */
    storedRoomStatus: StoredRoomStatus;
    submitVote: (vote: number | string) => void;
    toggleAutoReveal: () => void;
    toggleLockRoom: () => void;
    toggleSpectator: () => void;
    toggleUserRole: (targetUserId: string) => void;
    transferAdmin: (targetUserId: string) => void;
    updateRoomTitle: (title: string) => void;
    updateStoryEstimate: (storyId: string, estimate: number | string | null) => void;
}

export const SocketContext = createContext<SocketContextValue | undefined>(undefined);
