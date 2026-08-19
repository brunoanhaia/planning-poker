import {
    Avatar,
    AvatarColor,
    CardValue,
    DeckType,
    Participant,
    PRESET_DECKS,
    RoomState,
    Story,
} from '@planitpoker/shared';

import { DEFAULT_AVATAR, DEFAULT_HOST_COLOR, DEFAULT_TIMER_DURATION_SECONDS } from './constants.js';
import { generateRoomId, generateStoryId, generateUserId } from './idGenerator.js';
import {
    joinParticipant,
    JoinParticipantResult,
    kickParticipant,
    leaveParticipant,
    promoteParticipantCoAdmin,
    sanitizeRoomStateForUser,
    submitVoteForParticipant,
    toggleParticipantSpectator,
    transferRoomAdmin,
} from './participantService.js';
import {
    addStoryToRoom,
    bulkAddStoriesToRoom,
    deleteStoryFromRoom,
    setRoomCurrentStory,
    updateStoryEstimateInRoom,
} from './storyService.js';

export interface CreateRoomResult {
    hostId: string;
    roomId: string;
    roomState: RoomState;
}

/**
 * Coordinates and manages active Planning Poker rooms in-memory.
 */
export class RoomManager {
    private readonly rooms: Map<string, RoomState> = new Map();

    /**
     * Resets the voting state of a room for a new round.
     *
     * @param room - The room state to reset.
     */
    private resetRoomVotes(room: RoomState): void {
        room.votesRevealed = false;
        room.participants.forEach((participant) => {
            participant.vote = null;
            participant.hasVoted = false;
        });
    }

    /**
     * Checks whether a user is the primary host or a co-administrator of the room.
     *
     * @param room - The active room state.
     * @param userId - The user identifier to verify.
     * @returns True if the user has administrative privileges.
     */
    public isUserAdmin(room: RoomState, userId: string): boolean {
        if (room.hostId === userId) {
            return true;
        }
        const participant = room.participants.find((p) => p.id === userId);
        return Boolean(participant?.isAdmin);
    }

    /**
     * Retrieves a room state by its room ID code.
     *
     * @param roomId - The room identifier code (case-insensitive).
     * @returns The RoomState or undefined if not found.
     */
    public getRoom(roomId: string): RoomState | undefined {
        return this.rooms.get(roomId.toUpperCase());
    }

    /**
     * Creates a new Planning Poker room with an initial user story.
     *
     * @param hostName - Name of the creator/host.
     * @param hostAvatar - Avatar emoji of the host.
     * @param hostColor - Theme color of the host.
     * @param roomTitle - Optional title for the planning room.
     * @param deckType - Estimation deck type (defaults to 'fibonacci').
     * @param customDeck - Optional custom card values if deckType is 'custom'.
     * @returns Object containing hostId, roomId, and the created roomState.
     */
    public createRoom(
        hostName: string,
        hostAvatar?: Avatar,
        hostColor?: AvatarColor,
        roomTitle?: string,
        deckType: DeckType = 'fibonacci',
        customDeck?: CardValue[]
    ): CreateRoomResult {
        const roomId = this.generateUniqueRoomId();
        const hostId = generateUserId();

        const host: Participant = {
            avatar: hostAvatar || DEFAULT_AVATAR,
            color: hostColor || DEFAULT_HOST_COLOR,
            hasVoted: false,
            id: hostId,
            isAdmin: true,
            isHost: true,
            isOnline: true,
            isSpectator: false,
            name: hostName,
            vote: null,
        };

        const activeDeck: CardValue[] =
            deckType === 'custom' && customDeck && customDeck.length > 0
                ? [...customDeck]
                : [
                      ...(PRESET_DECKS[deckType as Exclude<DeckType, 'custom'>] ||
                          PRESET_DECKS.fibonacci),
                  ];

        const initialStory: Story = {
            description: 'Welcome to Planit Poker! Add story details or estimate this topic.',
            id: generateStoryId(),
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

    /**
     * Generates a collision-free room code identifier.
     *
     * @returns A guaranteed unique room code.
     */
    private generateUniqueRoomId(): string {
        const candidateId = generateRoomId();
        if (this.rooms.has(candidateId)) {
            return this.generateUniqueRoomId();
        }
        return candidateId;
    }

    /**
     * Joins a participant to a room.
     *
     * @param roomId - The room identifier code.
     * @param userName - The participant's display name.
     * @param avatar - Optional avatar emoji.
     * @param color - Optional avatar color.
     * @param existingUserId - Optional ID for reconnecting users.
     * @returns Result object with participant/roomState or error message.
     */
    public joinRoom(
        roomId: string,
        userName: string,
        avatar?: Avatar,
        color?: AvatarColor,
        existingUserId?: string
    ): JoinParticipantResult | null {
        const room = this.getRoom(roomId);
        if (!room) {
            return null;
        }
        return joinParticipant(room, userName, avatar, color, existingUserId);
    }

    /**
     * Handles user disconnection from a room.
     *
     * @param roomId - The room identifier.
     * @param userId - The leaving user ID.
     * @returns Updated RoomState or null if room not found.
     */
    public leaveRoom(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room) {
            return null;
        }
        return leaveParticipant(room, userId);
    }

    /**
     * Renames the planning poker room.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin requesting the change.
     * @param newTitle - The new title text.
     * @returns Updated RoomState or null if unauthorized.
     */
    public updateRoomTitle(roomId: string, userId: string, newTitle: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }

        room.title = newTitle.trim() || room.title;
        return room;
    }

    /**
     * Toggles the locked status of a room (prevents new joins).
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin requesting the change.
     * @returns Updated RoomState or null if unauthorized.
     */
    public toggleLockRoom(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }

        room.isLocked = !room.isLocked;
        return room;
    }

    /**
     * Toggles auto-reveal of votes once all active participants have voted.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin requesting the change.
     * @returns Updated RoomState or null if unauthorized.
     */
    public toggleAutoReveal(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }

        room.autoReveal = !room.autoReveal;
        return room;
    }

    /**
     * Starts or restarts the synchronized discussion countdown timer.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin requesting the timer.
     * @param duration - Timer duration in seconds.
     * @returns Updated RoomState or null if unauthorized.
     */
    public startTimer(
        roomId: string,
        userId: string,
        duration = DEFAULT_TIMER_DURATION_SECONDS
    ): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }

        room.timer = {
            duration,
            isRunning: true,
            remaining: duration,
            startedAt: Date.now(),
        };
        return room;
    }

    /**
     * Pauses or resumes the active countdown timer.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin.
     * @returns Updated RoomState or null if unauthorized/no timer.
     */
    public pauseTimer(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId) || !room.timer) {
            return null;
        }

        room.timer.isRunning = !room.timer.isRunning;
        return room;
    }

    /**
     * Resets the timer back to its initial duration and stops it.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin.
     * @returns Updated RoomState or null if unauthorized.
     */
    public resetTimer(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }

        if (room.timer) {
            room.timer.remaining = room.timer.duration;
            room.timer.isRunning = false;
        }
        return room;
    }

    /**
     * Incremental ticker called every second to decrement active room timers.
     *
     * @param roomId - The room identifier.
     * @returns Updated RoomState or null if timer is not active.
     */
    public tickTimer(roomId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !room.timer || !room.timer.isRunning) {
            return null;
        }

        if (room.timer.remaining <= 1) {
            room.timer.remaining = 0;
            room.timer.isRunning = false;
            return room;
        }

        room.timer.remaining -= 1;
        return room;
    }

    /**
     * Submits a card vote for a participant.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the voter.
     * @param vote - The chosen estimate value.
     * @returns Updated RoomState or null if invalid.
     */
    public submitVote(roomId: string, userId: string, vote: CardValue): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room) {
            return null;
        }
        return submitVoteForParticipant(room, userId, vote);
    }

    /**
     * Reveals all votes to the entire room.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin or co-host.
     * @returns Updated RoomState or null if unauthorized.
     */
    public revealVotes(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }

        room.votesRevealed = true;
        return room;
    }

    /**
     * Resets all participant votes and hides cards for a new estimation round.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin or co-host.
     * @returns Updated RoomState or null if unauthorized.
     */
    public resetVotes(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }

        this.resetRoomVotes(room);
        return room;
    }

    /**
     * Toggles self spectator status for a participant.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the participant.
     * @returns Updated RoomState or null if not found.
     */
    public toggleSpectator(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room) {
            return null;
        }
        return toggleParticipantSpectator(room, userId);
    }

    /**
     * Toggles another participant's role between Voter and Spectator (admin-only).
     *
     * @param roomId - The room identifier.
     * @param adminId - ID of the admin.
     * @param targetUserId - ID of the participant to modify.
     * @returns Updated RoomState or null if unauthorized.
     */
    public toggleUserRole(roomId: string, adminId: string, targetUserId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, adminId)) {
            return null;
        }
        return toggleParticipantSpectator(room, targetUserId);
    }

    /**
     * Removes a participant from the room.
     *
     * @param roomId - The room identifier.
     * @param adminId - ID of the admin.
     * @param targetUserId - ID of the participant to remove.
     * @returns Updated RoomState or null if unauthorized.
     */
    public kickParticipant(
        roomId: string,
        adminId: string,
        targetUserId: string
    ): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, adminId)) {
            return null;
        }
        return kickParticipant(room, targetUserId);
    }

    /**
     * Promotes or demotes a participant to/from Co-Administrator.
     *
     * @param roomId - The room identifier.
     * @param adminId - ID of the admin.
     * @param targetUserId - ID of the participant to update.
     * @returns Updated RoomState or null if unauthorized.
     */
    public promoteCoAdmin(roomId: string, adminId: string, targetUserId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, adminId)) {
            return null;
        }
        return promoteParticipantCoAdmin(room, targetUserId);
    }

    /**
     * Transfers primary room ownership to another participant.
     *
     * @param roomId - The room identifier.
     * @param adminId - ID of the current host.
     * @param targetUserId - ID of the target new host.
     * @returns Updated RoomState or null if unauthorized.
     */
    public transferAdmin(roomId: string, adminId: string, targetUserId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || room.hostId !== adminId) {
            return null;
        }
        return transferRoomAdmin(room, adminId, targetUserId);
    }

    /**
     * Adds a new story to the room's backlog.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin.
     * @param title - Story title.
     * @param description - Optional story details.
     * @returns Updated RoomState or null if unauthorized.
     */
    public addStory(
        roomId: string,
        userId: string,
        title: string,
        description?: string
    ): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }
        return addStoryToRoom(room, title, description);
    }

    /**
     * Adds multiple stories in bulk to the room's backlog.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin.
     * @param storiesList - Array of stories to import.
     * @returns Updated RoomState or null if unauthorized.
     */
    public bulkAddStories(
        roomId: string,
        userId: string,
        storiesList: { description?: string; title: string }[]
    ): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }
        return bulkAddStoriesToRoom(room, storiesList);
    }

    /**
     * Sets the active story for estimation.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin.
     * @param storyIndex - Target index in the stories list.
     * @returns Updated RoomState or null if unauthorized.
     */
    public setCurrentStory(roomId: string, userId: string, storyIndex: number): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }

        const updated = setRoomCurrentStory(room, storyIndex);
        if (updated) {
            this.resetRoomVotes(room);
        }
        return updated;
    }

    /**
     * Updates the finalized estimate on a story.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin.
     * @param storyId - ID of the story.
     * @param estimate - Final score/estimate value.
     * @returns Updated RoomState or null if unauthorized.
     */
    public updateStoryEstimate(
        roomId: string,
        userId: string,
        storyId: string,
        estimate: CardValue
    ): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }
        return updateStoryEstimateInRoom(room, storyId, estimate);
    }

    /**
     * Deletes a story from the room backlog.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin.
     * @param storyId - ID of the story to remove.
     * @returns Updated RoomState or null if unauthorized.
     */
    public deleteStory(roomId: string, userId: string, storyId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }
        return deleteStoryFromRoom(room, storyId);
    }

    /**
     * Changes the active card estimation deck.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin.
     * @param deckType - Chosen deck preset or 'custom'.
     * @param customDeck - Custom card values if deckType is 'custom'.
     * @returns Updated RoomState or null if unauthorized.
     */
    public changeDeck(
        roomId: string,
        userId: string,
        deckType: DeckType,
        customDeck?: CardValue[]
    ): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }

        room.deckType = deckType;
        room.activeDeck =
            deckType === 'custom' && customDeck
                ? [...customDeck]
                : [
                      ...(PRESET_DECKS[deckType as Exclude<DeckType, 'custom'>] ||
                          PRESET_DECKS.fibonacci),
                  ];

        if (deckType === 'custom' && customDeck) {
            room.customDeck = [...customDeck];
        }

        this.resetRoomVotes(room);
        return room;
    }

    /**
     * Marks a session as completed/ended.
     *
     * @param roomId - The room identifier.
     * @param userId - ID of the admin.
     * @returns Updated RoomState or null if unauthorized.
     */
    public endSession(roomId: string, userId: string): RoomState | null {
        const room = this.getRoom(roomId);
        if (!room || !this.isUserAdmin(room, userId)) {
            return null;
        }

        room.isEnded = true;
        return room;
    }

    /**
     * Sanitizes room state to hide unrevealed votes for recipient user.
     *
     * @param roomState - RoomState instance.
     * @param currentUserId - ID of the user receiving the update.
     * @returns Sanitized RoomState.
     */
    public sanitizeStateForUser(roomState: RoomState, currentUserId: string): RoomState {
        return sanitizeRoomStateForUser(roomState, currentUserId);
    }
}

export const roomManager = new RoomManager();
