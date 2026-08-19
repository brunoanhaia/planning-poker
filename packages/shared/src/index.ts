export type DeckType = 'fibonacci' | 'modified_fibonacci' | 'tshirt' | 'powers_of_2' | 'custom';

export const PRESET_DECKS: Record<Exclude<DeckType, 'custom'>, (string | number)[]> = {
    fibonacci: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'],
    modified_fibonacci: [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, '?', '☕'],
    tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
    powers_of_2: [1, 2, 4, 8, 16, 32, 64, '?', '☕'],
};

export const AVATARS = ['🚀', '🦊', '🐱', '🐶', '🦁', '🐼', '🦄', '🤖', '👾', '🧙', '🦸', '🥷'];

export const AVATAR_COLORS = [
    '#6366f1',
    '#ec4899',
    '#8b5cf6',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#14b8a6',
];

export interface Participant {
    id: string;
    name: string;
    avatar: string;
    color: string;
    vote: string | number | null;
    hasVoted: boolean;
    isSpectator: boolean;
    isHost: boolean;
    isAdmin: boolean;
    isOnline: boolean;
}

export interface Story {
    id: string;
    title: string;
    description?: string;
    finalEstimate?: string | number | null;
    status: 'pending' | 'estimating' | 'completed';
}

export interface TimerState {
    duration: number; // total duration in seconds
    remaining: number; // remaining seconds
    isRunning: boolean;
    startedAt?: number;
}

export interface RoomState {
    id: string;
    title: string;
    hostId: string;
    deckType: DeckType;
    customDeck?: (string | number)[];
    activeDeck: (string | number)[];
    participants: Participant[];
    stories: Story[];
    currentStoryIndex: number;
    votesRevealed: boolean;
    isLocked: boolean;
    autoReveal: boolean;
    timer: TimerState | null;
    isEnded: boolean;
    createdAt: number;
}

export type WSMessageType =
    | 'CREATE_ROOM'
    | 'JOIN_ROOM'
    | 'VOTE'
    | 'REVEAL_VOTES'
    | 'RESET_VOTES'
    | 'ADD_STORY'
    | 'BULK_ADD_STORIES'
    | 'SET_CURRENT_STORY'
    | 'UPDATE_STORY_ESTIMATE'
    | 'DELETE_STORY'
    | 'TOGGLE_SPECTATOR'
    | 'TOGGLE_USER_ROLE'
    | 'CHANGE_DECK'
    | 'TRANSFER_ADMIN'
    | 'PROMOTE_COADMIN'
    | 'KICK_PARTICIPANT'
    | 'KICKED'
    | 'UPDATE_ROOM_TITLE'
    | 'TOGGLE_LOCK_ROOM'
    | 'TOGGLE_AUTO_REVEAL'
    | 'START_TIMER'
    | 'PAUSE_TIMER'
    | 'RESET_TIMER'
    | 'END_SESSION'
    | 'ROOM_STATE'
    | 'ERROR';

export interface CreateRoomPayload {
    avatar?: string;
    color?: string;
    customDeck?: (string | number)[];
    deckType?: DeckType;
    name: string;
    title?: string;
}

export interface JoinRoomPayload {
    avatar?: string;
    color?: string;
    name: string;
    roomId: string;
    userId?: string | null;
}

export interface VotePayload {
    vote: string | number;
}

export interface AddStoryPayload {
    description?: string;
    title: string;
}

export interface BulkAddStoriesPayload {
    stories: { description?: string; title: string }[];
}

export interface SetCurrentStoryPayload {
    storyIndex: number;
}

export interface UpdateStoryEstimatePayload {
    estimate: string | number;
    storyId: string;
}

export interface DeleteStoryPayload {
    storyId: string;
}

export interface TargetUserPayload {
    targetUserId: string;
}

export interface ChangeDeckPayload {
    customDeck?: (string | number)[];
    deckType: DeckType;
}

export interface UpdateRoomTitlePayload {
    title: string;
}

export interface StartTimerPayload {
    duration?: number;
}

export interface RoomStatePayload {
    currentUserId?: string;
    roomState: RoomState;
}

export interface KickedPayload {
    message?: string;
}

export interface ErrorPayload {
    message: string;
}

export interface WSMessage<T = unknown> {
    payload: T;
    type: WSMessageType;
}
