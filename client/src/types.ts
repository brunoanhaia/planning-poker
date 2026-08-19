export type DeckType = 'fibonacci' | 'modified_fibonacci' | 'tshirt' | 'powers_of_2' | 'custom';

export const PRESET_DECKS: Record<DeckType, (string | number)[]> = {
  fibonacci: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'],
  modified_fibonacci: [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, '?', '☕'],
  tshirt: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '?', '☕'],
  powers_of_2: [1, 2, 4, 8, 16, 32, 64, '?', '☕'],
  custom: [1, 2, 3, 5, 8],
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
