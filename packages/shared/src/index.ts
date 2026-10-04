export type DeckType = 'fibonacci' | 'modified_fibonacci' | 'tshirt' | 'powers_of_2' | 'custom';

export type CardValue = string | number;
export type EstimateValue = string | number | null;
export type StoryStatus = 'pending' | 'estimating' | 'completed';

/** All supported deck identifiers, including the custom deck. */
export const DECK_TYPES = [
    'fibonacci',
    'modified_fibonacci',
    'tshirt',
    'powers_of_2',
    'custom',
] as const satisfies readonly DeckType[];

/** Maximum length (in characters) for a participant display name. */
export const MAX_NAME_LENGTH = 50;

/** Maximum length (in characters) for a room title. */
export const MAX_TITLE_LENGTH = 120;

/** Maximum length (in characters) for a story description. */
export const MAX_DESCRIPTION_LENGTH = 2000;

/** Maximum length (in characters) for an avatar emoji/string. */
export const MAX_AVATAR_LENGTH = 16;

/** Maximum length (in characters) for an avatar color value. */
export const MAX_COLOR_LENGTH = 32;

/** Maximum number of stories accepted in a single bulk import. */
export const MAX_BULK_STORIES = 50;

/** Minimum number of cards required for a custom deck. */
export const MIN_CUSTOM_DECK_SIZE = 2;

/** Maximum number of cards allowed in a custom deck. */
export const MAX_CUSTOM_DECK_SIZE = 30;

/** Minimum allowed countdown timer duration, in seconds. */
export const MIN_TIMER_DURATION_SECONDS = 5;

/** Maximum allowed countdown timer duration, in seconds. */
export const MAX_TIMER_DURATION_SECONDS = 3600;

/** Default countdown timer duration, in seconds. */
export const DEFAULT_TIMER_DURATION_SECONDS = 60;

export const PRESET_DECKS: Record<Exclude<DeckType, 'custom'>, readonly CardValue[]> = {
    fibonacci: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'] as const,
    modified_fibonacci: [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, '?', '☕'] as const,
    powers_of_2: [1, 2, 4, 8, 16, 32, 64, '?', '☕'] as const,
    tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'] as const,
};

export const AVATARS = [
    '🚀',
    '🦊',
    '🐱',
    '🐶',
    '🦁',
    '🐼',
    '🦄',
    '🤖',
    '👾',
    '🧙',
    '🦸',
    '🥷',
] as const;

export type Avatar = (typeof AVATARS)[number] | (string & {});

export const AVATAR_COLORS = [
    '#6366f1',
    '#ec4899',
    '#8b5cf6',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#14b8a6',
] as const;

export type AvatarColor = (typeof AVATAR_COLORS)[number] | (string & {});

export interface Participant {
    avatar: Avatar;
    color: AvatarColor;
    hasVoted: boolean;
    id: string;
    isAdmin: boolean;
    isHost: boolean;
    isOnline: boolean;
    isSpectator: boolean;
    name: string;
    vote: EstimateValue;
}

export interface Story {
    description?: string;
    finalEstimate?: EstimateValue;
    id: string;
    status: StoryStatus;
    title: string;
}

export interface TimerState {
    duration: number;
    isRunning: boolean;
    remaining: number;
    startedAt?: number;
}

export interface RoomState {
    activeDeck: CardValue[];
    autoReveal: boolean;
    createdAt: number;
    currentStoryIndex: number;
    customDeck?: CardValue[];
    deckType: DeckType;
    hostId: string;
    id: string;
    isEnded: boolean;
    isLocked: boolean;
    participants: Participant[];
    stories: Story[];
    timer: TimerState | null;
    title: string;
    votesRevealed: boolean;
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
    | 'SESSION'
    | 'ERROR';

export interface CreateRoomPayload {
    avatar?: Avatar;
    color?: AvatarColor;
    customDeck?: CardValue[];
    deckType?: DeckType;
    name: string;
    title?: string;
}

export interface JoinRoomPayload {
    avatar?: Avatar;
    color?: AvatarColor;
    name: string;
    roomId: string;
    sessionToken?: string | null;
    userId?: string | null;
}

export interface VotePayload {
    vote: CardValue;
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
    estimate: CardValue;
    storyId: string;
}

export interface DeleteStoryPayload {
    storyId: string;
}

export interface TargetUserPayload {
    targetUserId: string;
}

export interface ChangeDeckPayload {
    customDeck?: CardValue[];
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

export interface SessionPayload {
    sessionToken: string;
    userId: string;
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
