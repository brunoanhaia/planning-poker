export type DeckType = 'fibonacci' | 'modified_fibonacci' | 'tshirt' | 'powers_of_2' | 'custom';

export const PRESET_DECKS: Record<Exclude<DeckType, 'custom'>, (string | number)[]> = {
  fibonacci: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'],
  modified_fibonacci: [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
  powers_of_2: [1, 2, 4, 8, 16, 32, 64, '?', '☕'],
};

export interface Participant {
  id: string;
  name: string;
  avatar: string;
  color: string;
  vote: string | number | null;
  hasVoted: boolean;
  isSpectator: boolean;
  isHost: boolean;
  isOnline: boolean;
}

export interface Story {
  id: string;
  title: string;
  description?: string;
  finalEstimate?: string | number | null;
  status: 'pending' | 'estimating' | 'completed';
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
  createdAt: number;
}

export type WSMessageType =
  | 'CREATE_ROOM'
  | 'JOIN_ROOM'
  | 'VOTE'
  | 'REVEAL_VOTES'
  | 'RESET_VOTES'
  | 'ADD_STORY'
  | 'SET_CURRENT_STORY'
  | 'UPDATE_STORY_ESTIMATE'
  | 'DELETE_STORY'
  | 'TOGGLE_SPECTATOR'
  | 'CHANGE_DECK'
  | 'TRANSFER_HOST'
  | 'ROOM_STATE'
  | 'ERROR';

export interface WSMessage {
  type: WSMessageType;
  payload: any;
}
