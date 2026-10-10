import { DeckType, RoomState } from '@planitpoker/shared';
import { createContext } from 'react';

/** Everything a screen needs to talk to the room over the WebSocket session. */
export interface SocketContextValue {
    addStory: (title: string, description?: string) => void;
    bulkAddStories: (stories: { description?: string; title: string }[]) => void;
    changeDeck: (deckType: DeckType, customDeck?: (number | string)[]) => void;
    clearError: () => void;
    clearKickedMessage: () => void;
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
    promoteCoAdmin: (targetUserId: string) => void;
    resetTimer: () => void;
    resetVotes: () => void;
    revealVotes: () => void;
    roomState: null | RoomState;
    setCurrentStory: (index: number) => void;
    startTimer: (duration?: number) => void;
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
