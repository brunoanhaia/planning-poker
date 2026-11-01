import {
    Avatar,
    AvatarColor,
    CardValue,
    MAX_PARTICIPANTS_PER_ROOM,
    Participant,
    RoomState,
} from '@planitpoker/shared';

import { DEFAULT_AVATAR, DEFAULT_PARTICIPANT_COLOR } from './constants.js';
import { generateUserId } from './idGenerator.js';

/** Why a join attempt was refused. */
export type JoinRejection = 'ROOM_FULL' | 'ROOM_LOCKED' | 'SESSION_ENDED';

export interface JoinParticipantResult {
    /** Machine-readable reason, when the join was refused. */
    code?: JoinRejection;
    error?: string;
    participant?: Participant;
    roomState?: RoomState;
}

/**
 * Returns why the room refuses a new participant, if it does.
 *
 * Ending the session is the host's way of closing the room for good. A
 * reconnecting participant keeps its identity, but a room nobody may enter
 * anymore must not take a new one in either. Locking and the participant cap
 * are checked in the order a client experiences them.
 *
 * @param room - The active room state.
 * @returns The refusal and its client-facing message, or null when the room admits.
 */
const findJoinRefusal = (room: RoomState): JoinParticipantResult | null => {
    if (room.isEnded) {
        return {
            code: 'SESSION_ENDED',
            error: 'This session has ended. Ask the host for a new room.',
        };
    }

    if (room.isLocked) {
        return { code: 'ROOM_LOCKED', error: 'Room is locked by the administrator.' };
    }

    if (room.participants.length >= MAX_PARTICIPANTS_PER_ROOM) {
        return { code: 'ROOM_FULL', error: 'Room is full. Try again when somebody leaves.' };
    }

    return null;
};

/**
 * Brings a returning participant back online and refreshes the profile it presents.
 *
 * @param participant - The participant the session token identified.
 * @param profile - The name, avatar and colour the join presented.
 * @returns The same participant, updated in place.
 */
const reconnectParticipant = (
    participant: Participant,
    profile: { avatar?: Avatar; color?: AvatarColor; name: string }
): Participant => {
    participant.isOnline = true;
    participant.name = profile.name || participant.name;
    participant.avatar = profile.avatar || participant.avatar;
    participant.color = profile.color || participant.color;
    return participant;
};

/**
 * Adds a participant to the room, making the first one its host.
 *
 * @param room - The active room state.
 * @param name - The display name of the participant.
 * @param avatar - Optional avatar emoji.
 * @param color - Optional avatar background color.
 * @returns The participant that was added.
 */
const addParticipant = (
    room: RoomState,
    name: string,
    avatar?: Avatar,
    color?: AvatarColor
): Participant => {
    const participant: Participant = {
        avatar: avatar || DEFAULT_AVATAR,
        color: color || DEFAULT_PARTICIPANT_COLOR,
        hasVoted: false,
        id: generateUserId(),
        isAdmin: room.participants.length === 0,
        isHost: room.participants.length === 0,
        isOnline: true,
        isSpectator: false,
        name,
        vote: null,
    };

    room.participants.push(participant);
    if (participant.isHost) {
        room.hostId = participant.id;
    }

    return participant;
};

/**
 * Handles participant joining (or re-connecting) to a room.
 *
 * @param room - The active room state.
 * @param userName - The display name of the participant.
 * @param avatar - Optional avatar emoji.
 * @param color - Optional avatar background color.
 * @param existingUserId - Optional user ID for reconnection. Only honored when it
 *   matches the identity proven by a valid session token (see `WebSocketHandler`).
 * @returns An object containing participant and roomState, or an error message.
 */
export const joinParticipant = (
    room: RoomState,
    userName: string,
    avatar?: Avatar,
    color?: AvatarColor,
    existingUserId?: string
): JoinParticipantResult => {
    const existingParticipant = existingUserId
        ? room.participants.find((p) => p.id === existingUserId)
        : undefined;
    if (existingParticipant) {
        return {
            participant: reconnectParticipant(existingParticipant, {
                avatar,
                color,
                name: userName,
            }),
            roomState: room,
        };
    }

    const refused = findJoinRefusal(room);
    if (refused) {
        return refused;
    }

    return { participant: addParticipant(room, userName, avatar, color), roomState: room };
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
 * Removes a participant who moved to another room in the same browser.
 *
 * Handing the host role over first keeps the room administrable, then the row
 * disappears instead of lingering as an offline ghost.
 *
 * @param room - The active room state.
 * @param userId - The identifier of the participant to remove.
 * @returns The updated RoomState.
 */
export const removeParticipant = (room: RoomState, userId: string): RoomState => {
    leaveParticipant(room, userId);
    room.participants = room.participants.filter((participant) => participant.id !== userId);
    // An emptied room must not keep pointing at a host who is no longer in it;
    // the next joiner is made host by `joinParticipant`.
    if (room.participants.length === 0) {
        room.hostId = '';
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
 * A revealed round is frozen: a voter who becomes a spectator keeps the card they already showed,
 * so the displayed result does not change. Only Reset Votes can alter a revealed round.
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
    if (participant.isSpectator && !room.votesRevealed) {
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
 * The previous host is demoted to voter: both `isHost` and `isAdmin` are cleared,
 * so it keeps no moderation rights after the handover. Co-admins are unaffected
 * and keep the flag they were granted separately.
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
        currentHost.isAdmin = false;
    }

    target.isHost = true;
    target.isAdmin = true;
    room.hostId = target.id;

    return room;
};

/**
 * Sanitizes the room state for a specific client to hide other participants' votes before reveal.
 *
 * Only the card itself is withheld: another participant's `hasVoted` flag is
 * intentionally disclosed, because the roster renders it as the "Voted" chip
 * that tells a host who is still thinking. Hiding it would turn a moderation
 * affordance into an information leak removed by accident; disclosing it is a
 * recorded product decision (see issue #12), so the flag must keep flowing to
 * every client while `vote` stays `null` until the reveal.
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
