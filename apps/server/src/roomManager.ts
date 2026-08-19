import { DeckType, Participant, PRESET_DECKS, RoomState, Story } from '@planitpoker/shared';

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

    private resetRoomVotes(room: RoomState): void {
        room.votesRevealed = false;
        room.participants.forEach((p) => {
            p.vote = null;
            p.hasVoted = false;
        });
    }

    public isUserAdmin(room: RoomState, userId: string): boolean {
        if (room.hostId === userId) return true;
        const participant = room.participants.find((p) => p.id === userId);
        return !!participant?.isAdmin;
    }

    public getRoom(roomId: string): RoomState | undefined {
        return this.rooms.get(roomId.toUpperCase());
    }

    public createRoom(
        hostName: string,
        hostAvatar: string,
        hostColor: string,
        roomTitle?: string,
        deckType: DeckType = 'fibonacci',
        customDeck?: (string | number)[]
    ): { hostId: string; roomId: string; roomState: RoomState } {
        let roomId = this.generateRoomId();
        while (this.rooms.has(roomId)) {
            roomId = this.generateRoomId();
        }

        const hostId = `user_${Math.random().toString(36).substr(2, 9)}`;
        const host: Participant = {
            avatar: hostAvatar || '👤',
            color: hostColor || '#6366f1',
            hasVoted: false,
            id: hostId,
            isAdmin: true,
            isHost: true,
            isOnline: true,
            isSpectator: false,
            name: hostName,
            vote: null,
        };

        const activeDeck =
            deckType === 'custom' && customDeck && customDeck.length > 0
                ? customDeck
                : PRESET_DECKS[deckType as Exclude<DeckType, 'custom'>] || PRESET_DECKS.fibonacci;

        const initialStory: Story = {
            description: 'Welcome to Planit Poker! Add story details or estimate this topic.',
            id: `story_${Math.random().toString(36).substr(2, 9)}`,
            status: 'estimating',
            title: 'First User Story',
        };

        const roomState: RoomState = {
            activeDeck,
            autoReveal: false,
            createdAt: Date.now(),
            currentStoryIndex: 0,
            customDeck,
            deckType,
            hostId,
            id: roomId,
            isEnded: false,
            isLocked: false,
            participants: [host],
            stories: [initialStory],
            timer: null,
            title: roomTitle || `${hostName}'s Planning Session`,
            votesRevealed: false,
        };

        this.rooms.set(roomId, roomState);
        return { hostId, roomId, roomState };
    }

    public joinRoom(
        roomId: string,
        userName: string,
        avatar: string,
        color: string,
        existingUserId?: string
    ): { error?: string; participant?: Participant; roomState?: RoomState } | null {
        const room = this.getRoom(roomId);
        if (!room) return null;

        if (existingUserId) {
            const existingParticipant = room.participants.find((p) => p.id === existingUserId);
            if (existingParticipant) {
                existingParticipant.isOnline = true;
                existingParticipant.name = userName || existingParticipant.name;
                existingParticipant.avatar = avatar || existingParticipant.avatar;
                existingParticipant.color = color || existingParticipant.color;
                return { participant: existingParticipant, roomState: room };
            }
        }

        if (room.isLocked) {
            return { error: 'Room is locked by the administrator.' };
        }

        const newId = `user_${Math.random().toString(36).substr(2, 9)}`;
        const isFirstUser = room.participants.length === 0;

        const participant: Participant = {
            avatar: avatar || '👤',
            color: color || '#3b82f6',
            hasVoted: false,
            id: newId,
            isAdmin: isFirstUser,
            isHost: isFirstUser,
            isOnline: true,
            isSpectator: false,
            name: userName,
            vote: null,
        };

        room.participants.push(participant);
        if (isFirstUser) {
            room.hostId = newId;
        }

        return { participant, roomState: room };
    }

    public leaveRoom(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room) return null;

        const participant = room.participants.find((p) => p.id === userId);
        if (!participant) return room;

        participant.isOnline = false;

        if (room.hostId === userId) {
            const nextHost =
                room.participants.find((p) => p.isOnline && p.isAdmin) ||
                room.participants.find((p) => p.isOnline);

            if (nextHost) {
                nextHost.isHost = true;
                nextHost.isAdmin = true;
                room.hostId = nextHost.id;
            }
        }

        return room;
    }

    public updateRoomTitle(roomId: string, userId: string, newTitle: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) return null;

        room.title = newTitle.trim() || room.title;
        return room;
    }

    public toggleLockRoom(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) return null;

        room.isLocked = !room.isLocked;
        return room;
    }

    public toggleAutoReveal(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) return null;

        room.autoReveal = !room.autoReveal;
        return room;
    }

    public startTimer(roomId: string, userId: string, duration: number): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) return null;

        room.timer = {
            duration,
            isRunning: true,
            remaining: duration,
            startedAt: Date.now(),
        };
        return room;
    }

    public pauseTimer(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId) || !room.timer) return null;

        room.timer.isRunning = !room.timer.isRunning;
        return room;
    }

    public resetTimer(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) return null;

        if (room.timer) {
            room.timer.remaining = room.timer.duration;
            room.timer.isRunning = false;
        }
        return room;
    }

    public tickTimer(roomId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !room.timer || !room.timer.isRunning) return null;

        if (room.timer.remaining <= 1) {
            room.timer.remaining = 0;
            room.timer.isRunning = false;
            return room;
        }

        room.timer.remaining -= 1;
        return room;
    }

    public submitVote(roomId: string, userId: string, vote: string | number): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room) return null;

        const participant = room.participants.find((p) => p.id === userId);
        if (!participant || participant.isSpectator) return null;

        participant.vote = vote;
        participant.hasVoted = true;

        if (room.autoReveal) {
            const activeVoters = room.participants.filter((p) => !p.isSpectator && p.isOnline);
            const allVoted = activeVoters.length > 0 && activeVoters.every((p) => p.hasVoted);
            if (allVoted) {
                room.votesRevealed = true;
            }
        }

        return room;
    }

    public revealVotes(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) return null;

        room.votesRevealed = true;
        return room;
    }

    public resetVotes(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) return null;

        this.resetRoomVotes(room);
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

    public toggleUserRole(roomId: string, adminId: string, targetUserId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, adminId)) return null;

        const target = room.participants.find((p) => p.id === targetUserId);
        if (!target) return null;

        target.isSpectator = !target.isSpectator;
        if (target.isSpectator) {
            target.vote = null;
            target.hasVoted = false;
        }

        return room;
    }

    public kickParticipant(
        roomId: string,
        adminId: string,
        targetUserId: string
    ): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, adminId)) return null;
        if (room.hostId === targetUserId) return null;

        room.participants = room.participants.filter((p) => p.id !== targetUserId);
        return room;
    }

    public promoteCoAdmin(roomId: string, adminId: string, targetUserId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, adminId)) return null;

        const target = room.participants.find((p) => p.id === targetUserId);
        if (!target) return null;

        target.isAdmin = !target.isAdmin;
        return room;
    }

    public transferAdmin(roomId: string, adminId: string, targetUserId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || room.hostId !== adminId) return null;

        const target = room.participants.find((p) => p.id === targetUserId);
        if (!target) return null;

        const currentHost = room.participants.find((p) => p.id === adminId);
        if (currentHost) {
            currentHost.isHost = false;
        }

        target.isHost = true;
        target.isAdmin = true;
        room.hostId = target.id;

        return room;
    }

    public addStory(
        roomId: string,
        userId: string,
        title: string,
        description?: string
    ): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) return null;

        const newStory: Story = {
            description,
            id: `story_${Math.random().toString(36).substr(2, 9)}`,
            status: 'pending',
            title,
        };

        room.stories.push(newStory);
        return room;
    }

    public bulkAddStories(
        roomId: string,
        userId: string,
        storiesList: { description?: string; title: string }[]
    ): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId) || !Array.isArray(storiesList)) return null;

        storiesList.forEach((item) => {
            if (item.title && item.title.trim()) {
                room.stories.push({
                    description: item.description?.trim(),
                    id: `story_${Math.random().toString(36).substr(2, 9)}`,
                    status: 'pending',
                    title: item.title.trim(),
                });
            }
        });

        return room;
    }

    public setCurrentStory(roomId: string, userId: string, storyIndex: number): RoomState | null {
        const room = this.getRoom(roomId);
        if (
            !room ||
            !this.isUserAdmin(room, userId) ||
            storyIndex < 0 ||
            storyIndex >= room.stories.length
        ) {
            return null;
        }

        room.currentStoryIndex = storyIndex;
        room.stories.forEach((s, idx) => {
            if (idx === storyIndex) s.status = 'estimating';
        });

        this.resetRoomVotes(room);
        return room;
    }

    public updateStoryEstimate(
        roomId: string,
        userId: string,
        storyId: string,
        estimate: string | number
    ): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) return null;

        const story = room.stories.find((s) => s.id === storyId);
        if (!story) return null;

        story.finalEstimate = estimate;
        story.status = 'completed';

        return room;
    }

    public deleteStory(roomId: string, userId: string, storyId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) return null;

        room.stories = room.stories.filter((s) => s.id !== storyId);
        if (room.currentStoryIndex >= room.stories.length) {
            room.currentStoryIndex = Math.max(0, room.stories.length - 1);
        }
        return room;
    }

    public changeDeck(
        roomId: string,
        userId: string,
        deckType: DeckType,
        customDeck?: (string | number)[]
    ): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) return null;

        room.deckType = deckType;
        room.activeDeck =
            deckType === 'custom' && customDeck
                ? customDeck
                : PRESET_DECKS[deckType as Exclude<DeckType, 'custom'>] || PRESET_DECKS.fibonacci;

        if (deckType === 'custom' && customDeck) {
            room.customDeck = customDeck;
        }

        this.resetRoomVotes(room);
        return room;
    }

    public endSession(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) return null;

        room.isEnded = true;
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
