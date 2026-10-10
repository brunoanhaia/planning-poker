import {
    AddStoryPayload,
    BulkAddStoriesPayload,
    ChangeDeckPayload,
    CreateRoomPayload,
    DeleteStoryPayload,
    ErrorCode,
    JoinRoomPayload,
    KICK_BAN_DURATION_MS,
    SetCurrentStoryPayload,
    StartTimerPayload,
    TargetUserPayload,
    UpdateRoomTitlePayload,
    UpdateStoryEstimatePayload,
    VotePayload,
    WS_THROTTLE_MAX_MESSAGES,
    WS_THROTTLE_WINDOW_MS,
    WSMessage,
    WSMessageType,
} from '@planitpoker/shared';
import http from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';

import { auditLog } from './auditLogger.js';
import { BanService } from './banService.js';
import {
    DEFAULT_AVATAR,
    DEFAULT_HOST_COLOR,
    DEFAULT_PARTICIPANT_COLOR,
    DEFAULT_TIMER_DURATION_SECONDS,
    HEARTBEAT_INTERVAL_MS,
    ROOM_CLEANUP_INTERVAL_MS,
    TIMER_TICK_INTERVAL_MS,
} from './constants.js';
import { roomManager } from './roomManager.js';
import { sessionService } from './sessionService.js';
import { isBacklogFull } from './storyService.js';
import { MessageThrottle } from './throttle.js';
import { validatePayload } from './validation.js';

interface ExtendedWebSocket extends WebSocket {
    isAlive?: boolean;
    roomId?: string;
    userId?: string;
    /** True when the handshake carried an `Origin` header (i.e. a browser client). */
    hasOrigin?: boolean;
}

interface RoomSession {
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

type MessageHandler = (ws: ExtendedWebSocket, payload: unknown) => void;

/**
 * Handles real-time WebSocket connections, message routing, and room state broadcasting.
 */
export class WebSocketHandler {
    private readonly messageHandlers: Partial<Record<WSMessageType, MessageHandler>> = {
        ADD_STORY: (ws, payload) => this.handleAddStory(ws, payload as AddStoryPayload),
        BULK_ADD_STORIES: (ws, payload) =>
            this.handleBulkAddStories(ws, payload as BulkAddStoriesPayload),
        CHANGE_DECK: (ws, payload) => this.handleChangeDeck(ws, payload as ChangeDeckPayload),
        CREATE_ROOM: (ws, payload) => this.handleCreateRoom(ws, payload as CreateRoomPayload),
        DELETE_STORY: (ws, payload) => this.handleDeleteStory(ws, payload as DeleteStoryPayload),
        END_SESSION: (ws) => this.handleEndSession(ws),
        JOIN_ROOM: (ws, payload) => this.handleJoinRoom(ws, payload as JoinRoomPayload),
        KICK_PARTICIPANT: (ws, payload) =>
            this.handleKickParticipant(ws, payload as TargetUserPayload),
        PAUSE_TIMER: (ws) => this.handlePauseTimer(ws),
        PROMOTE_COADMIN: (ws, payload) =>
            this.handlePromoteCoAdmin(ws, payload as TargetUserPayload),
        RESET_TIMER: (ws) => this.handleResetTimer(ws),
        RESET_VOTES: (ws) => this.handleResetVotes(ws),
        REVEAL_VOTES: (ws) => this.handleRevealVotes(ws),
        SET_CURRENT_STORY: (ws, payload) =>
            this.handleSetCurrentStory(ws, payload as SetCurrentStoryPayload),
        START_TIMER: (ws, payload) => this.handleStartTimer(ws, payload as StartTimerPayload),
        TOGGLE_AUTO_REVEAL: (ws) => this.handleToggleAutoReveal(ws),
        TOGGLE_LOCK_ROOM: (ws) => this.handleToggleLockRoom(ws),
        TOGGLE_SPECTATOR: (ws) => this.handleToggleSpectator(ws),
        TOGGLE_USER_ROLE: (ws, payload) =>
            this.handleToggleUserRole(ws, payload as TargetUserPayload),
        TRANSFER_ADMIN: (ws, payload) => this.handleTransferAdmin(ws, payload as TargetUserPayload),
        UPDATE_ROOM_TITLE: (ws, payload) =>
            this.handleUpdateRoomTitle(ws, payload as UpdateRoomTitlePayload),
        UPDATE_STORY_ESTIMATE: (ws, payload) =>
            this.handleUpdateStoryEstimate(ws, payload as UpdateStoryEstimatePayload),
        VOTE: (ws, payload) => this.handleVote(ws, payload as VotePayload),
    };
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private timerInterval: NodeJS.Timeout | null = null;
    private readonly wss: WebSocketServer;
    /** Tracks the live socket per `roomId:userId` so stale sockets cannot tear down a newer session. */
    private readonly activeSockets: Map<string, ExtendedWebSocket> = new Map();
    /** Caps how many messages a single socket may send inside a window. */
    private readonly throttle = new MessageThrottle(
        WS_THROTTLE_MAX_MESSAGES,
        WS_THROTTLE_WINDOW_MS
    );
    /** Bars a kicked participant from re-entering the room immediately. */
    private readonly bans = new BanService();
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(wss: WebSocketServer) {
        this.wss = wss;
        this.init();
        this.startTimerTicker();
        this.startCleanupTicker();
    }

    /**
     * Starts the periodic sweep that drops idle rooms and expired bans.
     */
    private startCleanupTicker(): void {
        this.cleanupInterval = setInterval(() => {
            const now = Date.now();
            this.bans.sweep(now);
            roomManager.sweepIdleRooms(now).forEach((roomId) => {
                auditLog({ action: 'room.dropped.idle', outcome: 'allowed', roomId });
            });
            this.throttle.sweep(now);
        }, ROOM_CLEANUP_INTERVAL_MS);
    }

    /**
     * Initializes WebSocket listeners and client heartbeat interval.
     */
    private init(): void {
        this.wss.on('connection', (ws: ExtendedWebSocket, request: http.IncomingMessage) => {
            ws.isAlive = true;
            ws.hasOrigin = Boolean(request.headers.origin);

            ws.on('pong', () => {
                ws.isAlive = true;
            });

            ws.on('message', (message: string) => {
                try {
                    const parsed: WSMessage = JSON.parse(message.toString());
                    this.handleMessage(ws, parsed);
                } catch (err) {
                    console.error('Failed to parse WebSocket message:', err);
                    this.sendError(ws, 'Invalid JSON message payload format');
                }
            });

            ws.on('close', () => {
                this.throttle.forget(ws);
                if (!ws.roomId || !ws.userId) {
                    return;
                }

                // A stale socket (superseded by a newer connection for the same
                // participant) must not tear down the active session.
                const key = socketKey(ws.roomId, ws.userId);
                if (!shouldCleanupOnClose(this.activeSockets.get(key), ws)) {
                    return;
                }
                this.activeSockets.delete(key);

                const updatedRoom = roomManager.leaveRoom(ws.roomId, ws.userId);
                if (updatedRoom) {
                    this.broadcastRoomState(ws.roomId);
                }
            });
        });

        this.heartbeatInterval = setInterval(() => {
            this.wss.clients.forEach((client) => {
                const ws = client as ExtendedWebSocket;
                if (ws.isAlive === false) {
                    return ws.terminate();
                }
                ws.isAlive = false;
                ws.ping();
            });
        }, HEARTBEAT_INTERVAL_MS);
    }

    /**
     * Starts the 1-second countdown ticker for active room timers.
     */
    private startTimerTicker(): void {
        this.timerInterval = setInterval(() => {
            const activeRooms = new Set<string>();
            this.wss.clients.forEach((client) => {
                const ws = client as ExtendedWebSocket;
                if (ws.roomId) {
                    activeRooms.add(ws.roomId);
                }
            });

            activeRooms.forEach((roomId) => {
                const updated = roomManager.tickTimer(roomId);
                if (updated) {
                    this.broadcastRoomState(roomId);
                }
            });
        }, TIMER_TICK_INTERVAL_MS);
    }

    /**
     * Routes incoming WebSocket messages to domain operations.
     *
     * @param ws - The sender's WebSocket connection.
     * @param msg - The parsed incoming message.
     */
    private handleMessage(ws: ExtendedWebSocket, msg: WSMessage): void {
        const handler = this.messageHandlers[msg.type];
        if (!handler) {
            this.sendError(ws, `Unknown action type: ${msg.type}`, 'FORBIDDEN');
            return;
        }

        // A flooded socket is answered once and dropped, so one abusive client
        // cannot amplify the work of the others.
        if (!this.throttle.allows(ws, Date.now())) {
            auditLog({
                action: 'message.throttled',
                outcome: 'denied',
                roomId: ws.roomId,
                userId: ws.userId,
            });
            this.sendError(
                ws,
                'Too many messages. Slow down and try again in a few seconds.',
                'RATE_LIMITED'
            );
            return;
        }

        const validation = validatePayload(msg.type, msg.payload);
        if (!validation.success) {
            this.sendError(ws, validation.error || `Invalid ${msg.type} payload.`, 'FORBIDDEN');
            return;
        }

        handler(ws, validation.data);
    }

    /**
     * Returns the room session bound to a connection and tells the client why it
     * cannot act when there is none.
     *
     * A socket that has been superseded by a newer connection for the same
     * participant is no longer the active owner and is treated as having no
     * session, so it cannot issue room-scoped commands.
     *
     * @param ws - The sender's WebSocket connection.
     * @returns The room/user identifiers, or null when not in an active room session.
     */
    private requireSession(ws: ExtendedWebSocket): RoomSession | null {
        const session = this.getSession(ws);
        if (!session) {
            this.sendError(ws, 'No active room session. Join a room first.', 'NO_SESSION');
        }
        return session;
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
    private getSession(ws: ExtendedWebSocket): RoomSession | null {
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
    private bindActiveSocket(ws: ExtendedWebSocket, roomId: string, userId: string): void {
        const key = socketKey(roomId, userId);
        const previous = this.activeSockets.get(key);
        if (previous && !isActiveOwner(previous, ws)) {
            previous.roomId = undefined;
            previous.userId = undefined;
        }
        this.activeSockets.set(key, ws);
    }

    /**
     * Broadcasts the room state when an operation succeeds, otherwise notifies the sender.
     *
     * @param ws - The sender's WebSocket connection.
     * @param roomId - The room identifier.
     * @param updated - Whether the domain operation succeeded.
     * @param errorMessage - Message sent to the requester when the operation fails.
     * @param errorCode - Machine-readable reason, defaulting to authorization.
     */
    private broadcastOrError(
        ws: ExtendedWebSocket,
        roomId: string,
        updated: unknown,
        errorMessage: string,
        errorCode: ErrorCode = 'FORBIDDEN'
    ): void {
        if (!updated) {
            this.sendError(ws, errorMessage, errorCode);
            return;
        }
        this.broadcastRoomState(roomId);
    }

    /**
     * Handles room creation and binds the new session to the connection.
     */
    private handleCreateRoom(ws: ExtendedWebSocket, payload: CreateRoomPayload): void {
        const { avatar, color, customDeck, deckType, name, title } = payload;
        const created = roomManager.createRoom(
            name,
            avatar || DEFAULT_AVATAR,
            color || DEFAULT_HOST_COLOR,
            title,
            deckType,
            customDeck
        );

        if (!created) {
            auditLog({ action: 'room.creation.rejected.limit', outcome: 'denied' });
            this.sendError(ws, 'The server is at capacity. Try again later.', 'ROOM_LIMIT_REACHED');
            return;
        }

        const { hostId, roomId, roomState } = created;

        auditLog({ action: 'room.created', outcome: 'allowed', roomId, userId: hostId });
        ws.roomId = roomId;
        ws.userId = hostId;
        this.bindActiveSocket(ws, roomId, hostId);

        const sessionToken = sessionService.issue(roomId, hostId);
        this.send(ws, 'SESSION', { sessionToken, userId: hostId });

        this.send(ws, 'ROOM_STATE', {
            currentUserId: hostId,
            roomState: roomManager.sanitizeStateForUser(roomState, hostId),
        });
    }

    /**
     * Handles joining an existing room and binds the session to the connection.
     */
    private handleJoinRoom(ws: ExtendedWebSocket, payload: JoinRoomPayload): void {
        const { avatar, color, name, roomId, sessionToken, userId } = payload;

        const normalizedRoomId = roomId.toUpperCase();
        const binding = sessionService.resolve(sessionToken);
        const isRoomBound = binding?.roomId === normalizedRoomId;
        const isUserBound = !userId || binding?.userId === userId;
        const provenUserId = isRoomBound && isUserBound ? binding?.userId : undefined;
        const now = Date.now();

        // A kick revokes the token the client is holding, so the bar has to be
        // checked on the presented credential: without this the client would
        // come back with a dead token, have no identity to match, and be
        // handed a brand-new participant.
        const tokenBan = sessionToken ? this.bans.tokenBanFor(sessionToken, now) : null;
        if (tokenBan) {
            auditLog({
                action: 'join.rejected.banned',
                outcome: 'denied',
                roomId: tokenBan.roomId,
                userId: tokenBan.userId,
            });
            this.sendError(
                ws,
                'You were removed from this session. Try again in a few minutes.',
                'BANNED'
            );
            return;
        }

        // Non-browser clients (no Origin) bypass the handshake origin check, so
        // they must prove identity with a valid session token bound to this room.
        if (!ws.hasOrigin && !provenUserId) {
            auditLog({ action: 'join.rejected.token-missing', outcome: 'denied' });
            this.sendError(
                ws,
                'A valid session token is required to join from a non-browser client.'
            );
            return;
        }

        // Same bar, reached when the join still proves its identity with a live
        // token — for instance a ban issued without the token being revoked.
        if (provenUserId && this.bans.isBanned(normalizedRoomId, provenUserId, now)) {
            auditLog({
                action: 'join.rejected.banned',
                outcome: 'denied',
                roomId: normalizedRoomId,
                userId: provenUserId,
            });
            this.sendError(
                ws,
                'You were removed from this session. Try again in a few minutes.',
                'BANNED'
            );
            return;
        }

        const result = roomManager.joinRoom(
            roomId,
            name,
            avatar || DEFAULT_AVATAR,
            color || DEFAULT_PARTICIPANT_COLOR,
            provenUserId
        );

        if (!result) {
            this.sendError(
                ws,
                `Room "${roomId}" not found. Please check room code.`,
                'ROOM_NOT_FOUND'
            );
            return;
        }

        if (result.error) {
            this.sendError(ws, result.error, result.code);
            return;
        }

        const { participant, roomState } = result;
        if (!participant || !roomState) {
            this.sendError(ws, 'Unable to join room.');
            return;
        }

        ws.roomId = roomState.id;
        ws.userId = participant.id;
        this.bindActiveSocket(ws, roomState.id, participant.id);

        const issuedToken = sessionService.issue(roomState.id, participant.id);
        this.send(ws, 'SESSION', { sessionToken: issuedToken, userId: participant.id });

        this.broadcastRoomState(roomState.id);
    }

    /**
     * Handles room title updates.
     */
    private handleUpdateRoomTitle(ws: ExtendedWebSocket, payload: UpdateRoomTitlePayload): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.updateRoomTitle(session.roomId, session.userId, payload.title);
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can rename the room.'
        );
    }

    /**
     * Handles locking/unlocking the room.
     */
    private handleToggleLockRoom(ws: ExtendedWebSocket): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.toggleLockRoom(session.roomId, session.userId);
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can lock/unlock the room.'
        );
    }

    /**
     * Handles toggling automatic vote reveal.
     */
    private handleToggleAutoReveal(ws: ExtendedWebSocket): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.toggleAutoReveal(session.roomId, session.userId);
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can toggle auto-reveal.'
        );
    }

    /**
     * Handles starting the countdown timer.
     */
    private handleStartTimer(ws: ExtendedWebSocket, payload: StartTimerPayload): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const { duration } = payload || {};
        const updated = roomManager.startTimer(
            session.roomId,
            session.userId,
            duration ?? DEFAULT_TIMER_DURATION_SECONDS
        );
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can start the timer.'
        );
    }

    /**
     * Handles pausing/resuming the countdown timer.
     */
    private handlePauseTimer(ws: ExtendedWebSocket): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.pauseTimer(session.roomId, session.userId);
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can pause/resume the timer.'
        );
    }

    /**
     * Handles resetting the countdown timer.
     */
    private handleResetTimer(ws: ExtendedWebSocket): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.resetTimer(session.roomId, session.userId);
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can reset the timer.'
        );
    }

    /**
     * Handles vote submission.
     */
    private handleVote(ws: ExtendedWebSocket, payload: VotePayload): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }

        const room = roomManager.getRoom(session.roomId);
        if (!room?.activeDeck.includes(payload.vote)) {
            this.sendError(ws, 'Vote value is not part of the active deck.');
            return;
        }

        const updated = roomManager.submitVote(session.roomId, session.userId, payload.vote);
        if (updated) {
            this.broadcastRoomState(session.roomId);
            return;
        }
        this.sendError(ws, 'Your vote was not accepted for the active story.', 'FORBIDDEN');
    }

    /**
     * Handles revealing all submitted votes.
     */
    private handleRevealVotes(ws: ExtendedWebSocket): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.revealVotes(session.roomId, session.userId);
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators or co-hosts can reveal votes.'
        );
    }

    /**
     * Handles clearing all submitted votes.
     */
    private handleResetVotes(ws: ExtendedWebSocket): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.resetVotes(session.roomId, session.userId);
        this.broadcastOrError(ws, session.roomId, updated, 'Only administrators can reset votes.');
    }

    /**
     * Handles toggling spectator mode for the sender.
     */
    private handleToggleSpectator(ws: ExtendedWebSocket): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.toggleSpectator(session.roomId, session.userId);
        if (updated) {
            this.broadcastRoomState(session.roomId);
        }
    }

    /**
     * Handles toggling another participant's role.
     */
    private handleToggleUserRole(ws: ExtendedWebSocket, payload: TargetUserPayload): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.toggleUserRole(
            session.roomId,
            session.userId,
            payload.targetUserId
        );
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can change other participants roles.'
        );
    }

    /**
     * Handles removing a participant and notifying their connection.
     */
    private handleKickParticipant(ws: ExtendedWebSocket, payload: TargetUserPayload): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.kickParticipant(
            session.roomId,
            session.userId,
            payload.targetUserId
        );
        if (!updated) {
            this.sendError(ws, 'Only administrators can remove participants.');
            return;
        }

        const revokedTokens = sessionService.revokeByUser(session.roomId, payload.targetUserId);
        this.bans.banTokens(
            revokedTokens,
            session.roomId,
            payload.targetUserId,
            Date.now(),
            KICK_BAN_DURATION_MS
        );
        this.bans.ban(session.roomId, payload.targetUserId, Date.now(), KICK_BAN_DURATION_MS);
        auditLog({
            action: 'user.kicked',
            outcome: 'allowed',
            roomId: session.roomId,
            userId: payload.targetUserId,
        });
        this.notifyKickedClient(session.roomId, payload.targetUserId);
        this.broadcastRoomState(session.roomId);
    }

    /**
     * Notifies and detaches the kicked participant's connection.
     *
     * @param roomId - The room identifier.
     * @param targetUserId - The kicked participant identifier.
     */
    private notifyKickedClient(roomId: string, targetUserId: string): void {
        this.wss.clients.forEach((client) => {
            const clientWs = client as ExtendedWebSocket;
            if (clientWs.roomId === roomId && clientWs.userId === targetUserId) {
                this.send(clientWs, 'KICKED', {
                    message: 'You have been removed from the session by an administrator.',
                });
                clientWs.roomId = undefined;
                clientWs.userId = undefined;
            }
        });
    }

    /**
     * Handles promoting a participant to co-administrator.
     */
    private handlePromoteCoAdmin(ws: ExtendedWebSocket, payload: TargetUserPayload): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.promoteCoAdmin(
            session.roomId,
            session.userId,
            payload.targetUserId
        );
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can promote co-administrators.',
            'FORBIDDEN'
        );
        if (updated) {
            auditLog({
                action: 'user.promoted',
                outcome: 'allowed',
                roomId: session.roomId,
                userId: payload.targetUserId,
            });
        }
    }

    /**
     * Handles transferring primary administration to another participant.
     */
    private handleTransferAdmin(ws: ExtendedWebSocket, payload: TargetUserPayload): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.transferAdmin(
            session.roomId,
            session.userId,
            payload.targetUserId
        );
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only the primary room host can transfer administration.',
            'FORBIDDEN'
        );
        if (updated) {
            auditLog({
                action: 'user.transferred-host',
                outcome: 'allowed',
                roomId: session.roomId,
                userId: payload.targetUserId,
            });
        }
    }

    /**
     * Handles adding a story to the backlog.
     */
    private handleAddStory(ws: ExtendedWebSocket, payload: AddStoryPayload): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const room = roomManager.getRoom(session.roomId);
        if (room && isBacklogFull(room)) {
            auditLog({
                action: 'story.rejected.limit',
                outcome: 'denied',
                roomId: session.roomId,
                userId: session.userId,
            });
            this.sendError(
                ws,
                'The backlog is full. Delete a story before adding a new one.',
                'STORY_LIMIT_REACHED'
            );
            return;
        }
        const updated = roomManager.addStory(
            session.roomId,
            session.userId,
            payload.title,
            payload.description
        );
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can add stories to the backlog.',
            'FORBIDDEN'
        );
    }

    /**
     * Handles bulk importing stories into the backlog.
     */
    private handleBulkAddStories(ws: ExtendedWebSocket, payload: BulkAddStoriesPayload): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const room = roomManager.getRoom(session.roomId);
        if (room && isBacklogFull(room)) {
            auditLog({
                action: 'story.rejected.limit',
                outcome: 'denied',
                roomId: session.roomId,
                userId: session.userId,
            });
            this.sendError(
                ws,
                'The backlog is full. Delete a story before importing.',
                'STORY_LIMIT_REACHED'
            );
            return;
        }
        const updated = roomManager.bulkAddStories(session.roomId, session.userId, payload.stories);
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can bulk import stories.'
        );
    }

    /**
     * Handles changing the active story and resetting the timer.
     */
    private handleSetCurrentStory(ws: ExtendedWebSocket, payload: SetCurrentStoryPayload): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }

        // An index outside the backlog is a bad request, not an authorization
        // failure: answering "only admins" for both makes real abuse invisible.
        const room = roomManager.getRoom(session.roomId);
        const isIndexValid =
            room && payload.storyIndex >= 0 && payload.storyIndex < room.stories.length;
        if (room && !isIndexValid) {
            auditLog({
                action: 'story.index.rejected',
                outcome: 'denied',
                roomId: session.roomId,
                userId: session.userId,
            });
            this.sendError(ws, 'That story does not exist in this room.', 'INVALID_STORY_INDEX');
            return;
        }

        const updated = roomManager.setCurrentStory(
            session.roomId,
            session.userId,
            payload.storyIndex
        );
        if (!updated) {
            this.sendError(ws, 'Only administrators can change the active story.', 'FORBIDDEN');
            return;
        }

        roomManager.resetTimer(session.roomId, session.userId);
        this.broadcastRoomState(session.roomId);
    }

    /**
     * Handles finalizing a story estimate.
     */
    private handleUpdateStoryEstimate(
        ws: ExtendedWebSocket,
        payload: UpdateStoryEstimatePayload
    ): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.updateStoryEstimate(
            session.roomId,
            session.userId,
            payload.storyId,
            payload.estimate
        );
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can finalize and accept story estimates.'
        );
    }

    /**
     * Handles deleting a story from the backlog.
     */
    private handleDeleteStory(ws: ExtendedWebSocket, payload: DeleteStoryPayload): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.deleteStory(session.roomId, session.userId, payload.storyId);
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can delete stories from the backlog.'
        );
    }

    /**
     * Handles changing the estimation deck.
     */
    private handleChangeDeck(ws: ExtendedWebSocket, payload: ChangeDeckPayload): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.changeDeck(
            session.roomId,
            session.userId,
            payload.deckType,
            payload.customDeck
        );
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can change the estimation deck.'
        );
    }

    /**
     * Handles ending the estimation session.
     */
    private handleEndSession(ws: ExtendedWebSocket): void {
        const session = this.requireSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.endSession(session.roomId, session.userId);
        this.broadcastOrError(
            ws,
            session.roomId,
            updated,
            'Only administrators can end the session.'
        );
    }

    /**
     * Stops the heartbeat and timer tickers and closes all WebSocket connections.
     * Used for graceful shutdown on process termination signals.
     */
    public shutdown(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.wss.close();
    }

    /**
     * Broadcasts the sanitized room state to all clients connected to a room.
     *
     * @param roomId - The room identifier.
     */
    public broadcastRoomState(roomId: string): void {
        const rawState = roomManager.getRoom(roomId);
        if (!rawState) {
            return;
        }

        this.wss.clients.forEach((client) => {
            const ws = client as ExtendedWebSocket;
            if (ws.readyState === WebSocket.OPEN && ws.roomId === roomId && ws.userId) {
                const sanitized = roomManager.sanitizeStateForUser(rawState, ws.userId);
                this.send(ws, 'ROOM_STATE', {
                    currentUserId: ws.userId,
                    roomState: sanitized,
                });
            }
        });
    }

    /**
     * Sends a typed message to a specific WebSocket client.
     *
     * @param ws - Target client.
     * @param type - WebSocket message type.
     * @param payload - Payload data.
     */
    private send(ws: WebSocket, type: WSMessageType, payload: unknown): void {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ payload, type }));
        }
    }

    /**
     * Sends an error notification message to a specific WebSocket client.
     *
     * @param ws - Target client.
     * @param message - Error description.
     * @param code - Machine-readable reason, when one applies.
     */
    private sendError(ws: WebSocket, message: string, code?: ErrorCode): void {
        this.send(ws, 'ERROR', { code, message });
    }
}
