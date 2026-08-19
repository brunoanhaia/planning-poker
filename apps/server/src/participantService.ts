import { Avatar, AvatarColor, CardValue, Participant, RoomState } from '@planitpoker/shared';

import { DEFAULT_AVATAR, DEFAULT_PARTICIPANT_COLOR } from './constants.js';
import { generateUserId } from './idGenerator.js';

export interface JoinParticipantResult {
    error?: string;
    participant?: Participant;
    roomState?: RoomState;
}

/**
 * Handles participant joining (or re-connecting) to a room.
 *
 * @param room - The active room state.
 * @param userName - The display name of the participant.
 * @param avatar - Optional avatar emoji.
 * @param color - Optional avatar background color.
 * @param existingUserId - Optional user ID for reconnection.
 * @returns An object containing participant and roomState, or an error message.
 */
export const joinParticipant = (
    room: RoomState,
    userName: string,
    avatar?: Avatar,
    color?: AvatarColor,
    existingUserId?: string
): JoinParticipantResult => {
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

    const newId = generateUserId();
    const isFirstUser = room.participants.length === 0;

    const participant: Participant = {
        avatar: avatar || DEFAULT_AVATAR,
        color: color || DEFAULT_PARTICIPANT_COLOR,
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
};

/**
 * Handles participant disconnection and promotes a new host if the primary host leaves.
 *
 * @param room - The active room state.
 * @param userId - The identifier of the leaving participant.
 * @returns The updated RoomState.
 */
export const leaveParticipant = (room: RoomState, userId: string): RoomState => {
    const participant = room.participants.find((p) => p.id === userId);
    if (!participant) {
        return room;
    }

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
};

/**
 * Submits an estimation vote for a participant and handles auto-reveal triggers.
 *
 * @param room - The active room state.
 * @param userId - The identifier of the voting participant.
 * @param vote - The selected card value.
 * @returns The updated RoomState or null if user is not eligible to vote.
 */
export const submitVoteForParticipant = (
    room: RoomState,
    userId: string,
    vote: CardValue
): RoomState | null => {
    const participant = room.participants.find((p) => p.id === userId);
    if (!participant || participant.isSpectator) {
        return null;
    }

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
};

/**
 * Toggles a participant's spectator status (voter <-> observer).
 *
 * @param room - The active room state.
 * @param userId - The identifier of the participant.
 * @returns The updated RoomState or null if participant not found.
 */
export const toggleParticipantSpectator = (room: RoomState, userId: string): RoomState | null => {
    const participant = room.participants.find((p) => p.id === userId);
    if (!participant) {
        return null;
    }

    participant.isSpectator = !participant.isSpectator;
    if (participant.isSpectator) {
        participant.vote = null;
        participant.hasVoted = false;
    }

    return room;
};

/**
 * Removes a participant from the room (kick action).
 *
 * @param room - The active room state.
 * @param targetUserId - The identifier of the participant to kick.
 * @returns The updated RoomState or null if target is primary host.
 */
export const kickParticipant = (room: RoomState, targetUserId: string): RoomState | null => {
    if (room.hostId === targetUserId) {
        return null;
    }

    room.participants = room.participants.filter((p) => p.id !== targetUserId);
    return room;
};

/**
 * Promotes or demotes a participant to/from Co-Administrator.
 *
 * @param room - The active room state.
 * @param targetUserId - The identifier of the participant to update.
 * @returns The updated RoomState or null if participant not found.
 */
export const promoteParticipantCoAdmin = (
    room: RoomState,
    targetUserId: string
): RoomState | null => {
    const target = room.participants.find((p) => p.id === targetUserId);
    if (!target) {
        return null;
    }

    target.isAdmin = !target.isAdmin;
    return room;
};

/**
 * Transfers the primary Room Administrator role to another participant.
 *
 * @param room - The active room state.
 * @param currentAdminId - The identifier of the current primary host.
 * @param targetUserId - The identifier of the target new host.
 * @returns The updated RoomState or null if host/target not found.
 */
export const transferRoomAdmin = (
    room: RoomState,
    currentAdminId: string,
    targetUserId: string
): RoomState | null => {
    const target = room.participants.find((p) => p.id === targetUserId);
    if (!target) {
        return null;
    }

    const currentHost = room.participants.find((p) => p.id === currentAdminId);
    if (currentHost) {
        currentHost.isHost = false;
    }

    target.isHost = true;
    target.isAdmin = true;
    room.hostId = target.id;

    return room;
};

/**
 * Sanitizes the room state for a specific client to hide other participants' votes before reveal.
 *
 * @param roomState - The original RoomState from the server.
 * @param currentUserId - The recipient user's ID.
 * @returns A sanitized RoomState clone with hidden votes where appropriate.
 */
export const sanitizeRoomStateForUser = (
    roomState: RoomState,
    currentUserId: string
): RoomState => {
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
};
