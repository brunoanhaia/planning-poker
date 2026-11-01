import { ROOM_SWITCHED_CLOSE_CODE, SESSION_REPLACED_CLOSE_CODE } from '@planitpoker/shared';
import { WebSocket } from 'ws';

import { roomManager } from './roomManager.js';
import { sessionService } from './sessionService.js';

/** A WebSocket connection carrying the identity the handler assigned to it. */
export interface ExtendedWebSocket extends WebSocket {
    isAlive?: boolean;
    roomId?: string;
    userId?: string;
    /** True when the handshake carried an `Origin` header (i.e. a browser client). */
    hasOrigin?: boolean;
    /** Stable identity of the browser profile, from its first-party cookie. */
    clientId?: string;
    /** Peer address of the connection, normalized for the abuse controls. */
    remoteAddress?: string;
}

/** The room and participant a connection acts for. */
export interface RoomSession {
    roomId: string;
    userId: string;
}

/**
 * Builds the lookup key used to track a participant's active socket.
 *
 * @param roomId - The room identifier.
 * @param userId - The participant identifier.
 * @returns A stable composite key.
 */
export const socketKey = (roomId: string, userId: string): string => `${roomId}:${userId}`;

/**
 * Decides whether a socket is the active owner of a participant connection.
 *
 * A socket that has been superseded by a newer connection for the same
 * participant is stale: it must not issue room-scoped commands, and its close
 * must not tear down the active session.
 *
 * @param activeSocket - The socket currently registered for the participant, if any.
 * @param candidate - The socket being checked.
 * @returns True when the candidate is the active owner (or none is registered).
 */
export const isActiveOwner = (activeSocket: unknown, candidate: unknown): boolean =>
    !activeSocket || activeSocket === candidate;

/**
 * Decides whether a closing socket should tear down its participant session.
 *
 * @param activeSocket - The socket currently registered for the participant, if any.
 * @param closingSocket - The socket that is closing.
 * @returns True when the closing socket still owns the active connection.
 */
export const shouldCleanupOnClose = (activeSocket: unknown, closingSocket: unknown): boolean =>
    isActiveOwner(activeSocket, closingSocket);

export interface SessionRegistryOptions {
    /** Announces that a room's membership changed, so the handler can broadcast it. */
    broadcastRoomState: (roomId: string) => void;
}

/**
 * Tracks which socket currently owns a participant, and which browser profile
 * sits behind it.
 *
 * The registry is the single owner of the live-socket map: a superseded socket
 * is detached here, so neither a late command nor its close can act on the
 * session a newer connection took over.
 */
export class SessionRegistry {
    private readonly broadcastRoomState: (roomId: string) => void;
    /** Live socket per `roomId:userId`, so a stale socket cannot outlive its replacement. */
    private readonly activeSockets: Map<string, ExtendedWebSocket> = new Map();
    /** Identity of the browser profile behind each `roomId:userId`, for the kick ban. */
    private readonly clientIdByUser = new Map<string, string>();

    /**
     * @param options - The broadcast the registry calls after it changes a room's membership.
     */
    constructor(options: SessionRegistryOptions) {
        this.broadcastRoomState = options.broadcastRoomState;
    }

    /**
     * Returns the room session bound to a connection, if any.
     *
     * A socket that has been superseded by a newer connection for the same
     * participant is no longer the active owner and is treated as having no
     * session, so it cannot issue room-scoped commands.
     *
     * @param ws - The sender's WebSocket connection.
     * @returns The room/user identifiers, or null when not in an active room session.
     */
    public sessionFor(ws: ExtendedWebSocket): RoomSession | null {
        if (!ws.roomId || !ws.userId) {
            return null;
        }
        const activeSocket = this.activeSockets.get(socketKey(ws.roomId, ws.userId));
        if (!isActiveOwner(activeSocket, ws)) {
            return null;
        }
        return { roomId: ws.roomId, userId: ws.userId };
    }

    /**
     * Registers a socket as the active connection for a participant, detaching any
     * socket it replaces so the superseded connection can no longer act.
     *
     * @param ws - The newly active socket.
     * @param roomId - The room identifier.
     * @param userId - The participant identifier.
     */
    public bind(ws: ExtendedWebSocket, roomId: string, userId: string): void {
        const key = socketKey(roomId, userId);
        const previous = this.activeSockets.get(key);
        if (previous && !isActiveOwner(previous, ws)) {
            previous.roomId = undefined;
            previous.userId = undefined;
            // The newer socket owns the participant: tell the old one why it is
            // going away instead of letting it fight for the slot. Clearing the
            // session first keeps the close handler from tearing it down.
            previous.close(SESSION_REPLACED_CLOSE_CODE, 'session replaced');
        }
        this.activeSockets.set(key, ws);
    }

    /**
     * Releases the participant slot a closing socket owns.
     *
     * A stale socket (superseded by a newer connection for the same participant)
     * must not tear down the active session, so it is reported as owning nothing.
     *
     * @param ws - The socket that is closing.
     * @returns The session it owned, or null when it was stale or unbound.
     */
    public release(ws: ExtendedWebSocket): RoomSession | null {
        if (!ws.roomId || !ws.userId) {
            return null;
        }
        const key = socketKey(ws.roomId, ws.userId);
        if (!shouldCleanupOnClose(this.activeSockets.get(key), ws)) {
            return null;
        }
        this.activeSockets.delete(key);
        return { roomId: ws.roomId, userId: ws.userId };
    }

    /**
     * Ends the room session a browser still holds when it opens a different room.
     *
     * The client proves ownership with the token it already has, so the server
     * never trusts a client-supplied identity. The participant leaves the old
     * room (its row disappears, host included) and the socket that held it is
     * closed with `ROOM_SWITCHED_CLOSE_CODE`, which that tab turns into a notice
     * instead of a reconnect.
     *
     * @param previousRoomToken - Token of the room the browser is leaving.
     * @param current - Room and participant of the session just opened.
     */
    public endPreviousRoom(previousRoomToken: string | null, current: RoomSession): void {
        if (!previousRoomToken) {
            return;
        }
        const binding = sessionService.resolve(previousRoomToken);
        if (!binding) {
            return;
        }
        if (binding.roomId === current.roomId && binding.userId === current.userId) {
            return;
        }

        const previousKey = socketKey(binding.roomId, binding.userId);
        const previousSocket = this.activeSockets.get(previousKey);
        if (previousSocket) {
            previousSocket.roomId = undefined;
            previousSocket.userId = undefined;
            this.activeSockets.delete(previousKey);
            previousSocket.close(ROOM_SWITCHED_CLOSE_CODE, 'session moved');
        }

        // Revoked, so the token cannot rebind the participant the switch removed.
        sessionService.revoke(previousRoomToken);
        const updatedRoom = roomManager.removeParticipant(binding.roomId, binding.userId);
        if (updatedRoom) {
            this.broadcastRoomState(binding.roomId);
        }
    }

    /**
     * Remembers which browser profile a participant is, so a kick can bar it
     * even when the participant comes back without its token.
     *
     * @param roomId - The room identifier.
     * @param userId - The participant identifier.
     * @param clientId - The stable identity of the browser profile.
     */
    public rememberClientId(roomId: string, userId: string, clientId: string): void {
        this.clientIdByUser.set(socketKey(roomId, userId), clientId);
    }

    /**
     * Returns the browser profile seen behind a participant, if any.
     *
     * @param roomId - The room identifier.
     * @param userId - The participant identifier.
     * @returns The browser profile identity, or undefined when never seen.
     */
    public clientIdFor(roomId: string, userId: string): string | undefined {
        return this.clientIdByUser.get(socketKey(roomId, userId));
    }

    /**
     * Forgets the browser profile recorded for a participant.
     *
     * @param roomId - The room identifier.
     * @param userId - The participant identifier.
     */
    public forgetClientId(roomId: string, userId: string): void {
        this.clientIdByUser.delete(socketKey(roomId, userId));
    }

    /**
     * Drops the browser profiles whose room no longer exists.
     */
    public sweepClientIds(): void {
        this.clientIdByUser.forEach((_clientId, key) => {
            if (!roomManager.hasRoom(key.slice(0, key.indexOf(':')))) {
                this.clientIdByUser.delete(key);
            }
        });
    }
}
