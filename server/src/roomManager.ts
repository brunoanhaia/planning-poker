import { RoomState, Participant, Story, DeckType, PRESET_DECKS } from './types.js';

export class RoomManager {
  private rooms: Map<string, RoomState> = new Map();

  private generateRoomId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  }

  public createRoom(
    hostName: string,
    hostAvatar: string,
    hostColor: string,
    roomTitle?: string,
    deckType: DeckType = 'fibonacci',
    customDeck?: (string | number)[]
  ): { roomId: string; hostId: string; roomState: RoomState } {
    let roomId = this.generateRoomId();
    while (this.rooms.has(roomId)) {
      roomId = this.generateRoomId();
    }

    const hostId = `user_${Math.random().toString(36).substr(2, 9)}`;
    const host: Participant = {
      id: hostId,
      name: hostName,
      avatar: hostAvatar || '👤',
      color: hostColor || '#6366f1',
      vote: null,
      hasVoted: false,
      isSpectator: false,
      isHost: true,
      isOnline: true,
    };

    const activeDeck =
      deckType === 'custom' && customDeck && customDeck.length > 0
        ? customDeck
        : PRESET_DECKS[deckType as keyof typeof PRESET_DECKS] || PRESET_DECKS.fibonacci;

    const initialStory: Story = {
      id: `story_${Math.random().toString(36).substr(2, 9)}`,
      title: 'First User Story',
      description: 'Welcome to Planit Poker! Add story details or estimate this topic.',
      status: 'estimating',
    };

    const roomState: RoomState = {
      id: roomId,
      title: roomTitle || `${hostName}'s Planning Session`,
      hostId,
      deckType,
      customDeck,
      activeDeck,
      participants: [host],
      stories: [initialStory],
      currentStoryIndex: 0,
      votesRevealed: false,
      createdAt: Date.now(),
    };

    this.rooms.set(roomId, roomState);
    return { roomId, hostId, roomState };
  }

  public getRoom(roomId: string): RoomState | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  public joinRoom(
    roomId: string,
    userName: string,
    avatar: string,
    color: string,
    existingUserId?: string
  ): { participant: Participant; roomState: RoomState } | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    let participant: Participant | undefined;

    if (existingUserId) {
      participant = room.participants.find((p) => p.id === existingUserId);
      if (participant) {
        participant.isOnline = true;
        participant.name = userName || participant.name;
        participant.avatar = avatar || participant.avatar;
        participant.color = color || participant.color;
      }
    }

    if (!participant) {
      const newId = `user_${Math.random().toString(36).substr(2, 9)}`;
      const isHost = room.participants.length === 0;
      participant = {
        id: newId,
        name: userName,
        avatar: avatar || '👤',
        color: color || '#3b82f6',
        vote: null,
        hasVoted: false,
        isSpectator: false,
        isHost,
        isOnline: true,
      };
      room.participants.push(participant);
      if (isHost) {
        room.hostId = newId;
      }
    }

    return { participant, roomState: room };
  }

  public leaveRoom(roomId: string, userId: string): RoomState | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const pIndex = room.participants.findIndex((p) => p.id === userId);
    if (pIndex !== -1) {
      room.participants[pIndex].isOnline = false;
      if (room.hostId === userId) {
        const nextOnline = room.participants.find((p) => p.isOnline);
        if (nextOnline) {
          nextOnline.isHost = true;
          room.hostId = nextOnline.id;
        }
      }
    }

    return room;
  }

  public submitVote(roomId: string, userId: string, vote: string | number): RoomState | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const participant = room.participants.find((p) => p.id === userId);
    if (!participant || participant.isSpectator) return null;

    participant.vote = vote;
    participant.hasVoted = true;

    return room;
  }

  public revealVotes(roomId: string, userId: string): RoomState | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    room.votesRevealed = true;
    return room;
  }

  public resetVotes(roomId: string, userId: string): RoomState | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    room.votesRevealed = false;
    room.participants.forEach((p) => {
      p.vote = null;
      p.hasVoted = false;
    });

    return room;
  }

  public toggleSpectator(roomId: string, userId: string): RoomState | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const participant = room.participants.find((p) => p.id === userId);
    if (!participant) return null;

    participant.isSpectator = !participant.isSpectator;
    if (participant.isSpectator) {
      participant.vote = null;
      participant.hasVoted = false;
    }

    return room;
  }

  public addStory(roomId: string, title: string, description?: string): RoomState | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const newStory: Story = {
      id: `story_${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      status: 'pending',
    };

    room.stories.push(newStory);
    return room;
  }

  public setCurrentStory(roomId: string, storyIndex: number): RoomState | null {
    const room = this.getRoom(roomId);
    if (!room || storyIndex < 0 || storyIndex >= room.stories.length) return null;

    room.currentStoryIndex = storyIndex;
    room.stories.forEach((s, idx) => {
      if (idx === storyIndex) s.status = 'estimating';
    });

    room.votesRevealed = false;
    room.participants.forEach((p) => {
      p.vote = null;
      p.hasVoted = false;
    });

    return room;
  }

  public updateStoryEstimate(
    roomId: string,
    storyId: string,
    estimate: string | number
  ): RoomState | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    const story = room.stories.find((s) => s.id === storyId);
    if (story) {
      story.finalEstimate = estimate;
      story.status = 'completed';
    }

    return room;
  }

  public deleteStory(roomId: string, storyId: string): RoomState | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    room.stories = room.stories.filter((s) => s.id !== storyId);
    if (room.currentStoryIndex >= room.stories.length) {
      room.currentStoryIndex = Math.max(0, room.stories.length - 1);
    }
    return room;
  }

  public changeDeck(
    roomId: string,
    deckType: DeckType,
    customDeck?: (string | number)[]
  ): RoomState | null {
    const room = this.getRoom(roomId);
    if (!room) return null;

    room.deckType = deckType;
    if (deckType === 'custom' && customDeck) {
      room.customDeck = customDeck;
      room.activeDeck = customDeck;
    } else {
      room.activeDeck = PRESET_DECKS[deckType as keyof typeof PRESET_DECKS] || PRESET_DECKS.fibonacci;
    }

    room.votesRevealed = false;
    room.participants.forEach((p) => {
      p.vote = null;
      p.hasVoted = false;
    });

    return room;
  }

  public sanitizeStateForUser(roomState: RoomState, currentUserId: string): RoomState {
    const sanitizedParticipants = roomState.participants.map((p) => {
      if (roomState.votesRevealed || p.id === currentUserId) {
        return { ...p };
      }
      return {
        ...p,
        vote: null,
      };
    });

    return {
      ...roomState,
      participants: sanitizedParticipants,
    };
  }
}

export const roomManager = new RoomManager();
