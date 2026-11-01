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
import { parseClientId } from './clientIdentity.js';
import { ConnectionLimiter, resolvePeerAddress } from './connectionLimiter.js';
import {
    DEFAULT_AVATAR,
    DEFAULT_HOST_COLOR,
    DEFAULT_PARTICIPANT_COLOR,
    DEFAULT_TIMER_DURATION_SECONDS,
    HEARTBEAT_INTERVAL_MS,
    JOIN_FAILURE_COOLDOWN_MS,
    JOIN_FAILURE_LIMIT,
    JOIN_FAILURE_MAX_TRACKED_ADDRESSES,
    JOIN_FAILURE_WINDOW_MS,
    ROOM_CLEANUP_INTERVAL_MS,
    TIMER_TICK_INTERVAL_MS,
} from './constants.js';
import { JoinAdmission, resolveJoinAttempt } from './joinAdmission.js';
import { JoinFailureLimiter } from './joinFailureLimiter.js';
import { JoinParticipantResult } from './participantService.js';
import { roomManager } from './roomManager.js';
import { ExtendedWebSocket, RoomSession, SessionRegistry } from './sessionRegistry.js';
import { sessionService } from './sessionService.js';
import { isBacklogFull } from './storyService.js';
import { MessageThrottle } from './throttle.js';
import { validatePayload } from './validation.js';

/** Dependencies the handler needs to account for the sockets it serves. */
export interface WebSocketHandlerOptions {
    /** Caps how many sockets one address may hold at the same time. */
    connections: ConnectionLimiter;
    /** Proxy hops in front of this server that may be trusted on the handshake. */
    trustProxyHops: number;
    /** True when the real client arrives in `CF-Connecting-IP` from a Cloudflare edge. */
    cloudflareEnabled: boolean;
}

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
    /** Caps how many sockets one address may hold at the same time. */
    private readonly connections: ConnectionLimiter;
    /** Proxy hops in front of this server that may be trusted on the handshake. */
    private readonly trustProxyHops: number;
    /** True when the deployment sits behind Cloudflare and asks for its client header. */
    private readonly cloudflareEnabled: boolean;
    /** Tracks the live socket per participant and the browser profile behind it. */
    private readonly sessions: SessionRegistry;
    /** Caps how many messages a single socket may send inside a window. */
    private readonly throttle = new MessageThrottle(
        WS_THROTTLE_MAX_MESSAGES,
        WS_THROTTLE_WINDOW_MS
    );
    /** Bars a kicked participant from re-entering the room immediately. */
    private readonly bans = new BanService();
    /** Budget of failed room joins granted to one address. */
    private readonly joinFailures = new JoinFailureLimiter(
        JOIN_FAILURE_LIMIT,
        JOIN_FAILURE_WINDOW_MS,
        JOIN_FAILURE_COOLDOWN_MS,
        JOIN_FAILURE_MAX_TRACKED_ADDRESSES
    );
    /** The bars a join has to pass before the room is even consulted. */
    private readonly admission: JoinAdmission;
    private cleanupInterval: NodeJS.Timeout | null = null;

    /**
     * @param wss - The server whose connections this handler serves.
     * @param options - Connection accounting, the proxy hops to trust, the challenge verifier.
     */
    constructor(wss: WebSocketServer, options: WebSocketHandlerOptions) {
        this.wss = wss;
        this.connections = options.connections;
        this.trustProxyHops = options.trustProxyHops;
        this.cloudflareEnabled = options.cloudflareEnabled;
        // The registry announces membership changes by broadcasting them, exactly
        // as the rest of the handler does.
        this.sessions = new SessionRegistry({
            broadcastRoomState: (roomId) => this.broadcastRoomState(roomId),
        });
        this.admission = new JoinAdmission({
            bans: this.bans,
            joinFailures: this.joinFailures,
            sendError: (ws, message, code) => this.sendError(ws, message, code),
        });
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
            this.joinFailures.sweep(now);
            roomManager.sweepIdleRooms(now).forEach((roomId) => {
                auditLog({ action: 'room.dropped.idle', outcome: 'allowed', roomId });
            });
            this.throttle.sweep(now);
            this.sessions.sweepClientIds();
        }, ROOM_CLEANUP_INTERVAL_MS);
    }

    /**
     * Initializes WebSocket listeners and client heartbeat interval.
     */
    private init(): void {
        // A failure on the server object itself — not on one connection — must
        // not take the process down either: there is no socket to terminate, so
        // the record is the whole response.
        this.wss.on('error', (error: Error) => {
            console.error('WebSocket server error:', error.message);
        });

        this.wss.on('connection', (ws: ExtendedWebSocket, request: http.IncomingMessage) => {
            ws.isAlive = true;
            ws.hasOrigin = Boolean(request.headers.origin);
            // The handshake has already happened by the time we get here, so the
            // identity is whatever the browser sent. Minting one for a cookieless
            // client happens in `startServer`, which owns the upgrade.
            ws.clientId = parseClientId(request.headers.cookie) ?? undefined;
            ws.remoteAddress = resolvePeerAddress({
                cloudflareEnabled: this.cloudflareEnabled,
                request,
                trustProxyHops: this.trustProxyHops,
            });
            // The handshake already reserved one of this address's slots; the
            // same bookkeeping is what releases it again on disconnect.
            this.connections.acquire(ws.remoteAddress, Date.now());

            ws.on('pong', () => {
                ws.isAlive = true;
            });

            // `ws` reports a frame it refuses to read — over the payload cap, or
            // one it cannot parse — as an `error` event on the connection. With
            // no listener, Node turns that into an unhandled exception and the
            // whole process dies, which makes a single oversized frame a remote
            // denial of service. Answering it here keeps the blast radius to
            // the offending socket.
            ws.on('error', (error: Error) => {
                this.reportConnectionError(ws, error);
            });

            ws.on('message', (message: string) => {
                // Frames already in flight when the socket started closing are
                // still delivered, and each of them would otherwise write
                // another audit record — the amplification being prevented.
                if (ws.readyState !== WebSocket.OPEN) {
                    return;
                }
                // The limit sits before parsing, so a frame that never becomes
                // a message — malformed JSON, an unknown type — still costs the
                // sender budget and cannot buy an answer per frame.
                if (!this.allowsMessage(ws)) {
                    return;
                }
                try {
                    const parsed: WSMessage = JSON.parse(message.toString());
                    this.handleMessage(ws, parsed);
                } catch (err) {
                    console.error('Failed to parse WebSocket message:', err);
                    this.sendError(ws, 'Invalid JSON message payload format', 'INVALID_MESSAGE');
                }
            });

            ws.on('close', () => {
                this.throttle.forget(ws);
                if (ws.remoteAddress) {
                    this.connections.release(ws.remoteAddress);
                }
                // A stale socket (superseded by a newer connection for the same
                // participant) must not tear down the active session.
                const released = this.sessions.release(ws);
                if (!released) {
                    return;
                }

                const updatedRoom = roomManager.leaveRoom(released.roomId, released.userId);
                if (updatedRoom) {
                    this.broadcastRoomState(released.roomId);
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
     * Records one incoming frame for a socket and decides whether it may be
     * processed at all.
     *
     * A socket that goes over its budget is told once and disconnected: every
     * further frame would otherwise cost another error frame and another audit
     * record — the amplification the limit exists to stop.
     *
     * @param ws - The sender's WebSocket connection.
     * @returns True when the frame is inside the allowance.
     */
    private allowsMessage(ws: ExtendedWebSocket): boolean {
        if (this.throttle.allows(ws, Date.now())) {
            return true;
        }

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
        // 1008 is the WebSocket "policy violation" close code.
        ws.close(1008, 'Rate limit exceeded');
        return false;
    }

    /**
     * Reports a failed connection without letting it reach the process.
     *
     * Every receiver failure — an oversized frame, a frame that cannot be read —
     * arrives here. The socket is terminated, which is what the peer already
     * expects, and the record is what an operator needs: which participant, if
     * any, was behind it.
     *
     * @param ws - The connection that failed.
     * @param error - The failure reported by `ws`.
     */
    private reportConnectionError(ws: ExtendedWebSocket, error: Error): void {
        auditLog({
            action: 'socket.error',
            outcome: 'denied',
            roomId: ws.roomId,
            userId: ws.userId,
        });
        console.error('WebSocket connection error:', error.message);
        ws.terminate();
    }

    /**
     * Routes incoming WebSocket messages to domain operations.
     *
     * The lookup is restricted to own properties: a plain object index resolves
     * inherited keys as well, so `type: "constructor"` would otherwise reach the
     * dispatch table and hand the handler a value that is not a handler at all.
     *
     * @param ws - The sender's WebSocket connection.
     * @param msg - The parsed incoming message.
     */
    private handleMessage(ws: ExtendedWebSocket, msg: WSMessage): void {
        if (typeof msg !== 'object' || msg === null) {
            this.sendError(
                ws,
                'Invalid message format. Expected a JSON object.',
                'INVALID_MESSAGE'
            );
            return;
        }

        const handler = Object.hasOwn(this.messageHandlers, msg.type)
            ? this.messageHandlers[msg.type]
            : undefined;
        if (!handler) {
            this.sendError(ws, `Unknown action type: ${String(msg.type)}`, 'UNKNOWN_ACTION');
            return;
        }

        const validation = validatePayload(msg.type, msg.payload);
        if (!validation.success) {
            this.sendError(
                ws,
                validation.error || `Invalid ${msg.type} payload.`,
                'INVALID_PAYLOAD'
            );
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
        const session = this.sessions.sessionFor(ws);
        if (!session) {
            this.sendError(ws, 'No active room session. Join a room first.', 'NO_SESSION');
        }
        return session;
    }

    /**
     * Binds a connection to a participant slot and issues its session token.
     *
     * The socket is registered as the participant's active connection first, so
     * the session it is leaving is torn down without touching the new one, and
     * the token that is issued last can no longer be confused with it.
     *
     * @param ws - The connection entering the room.
     * @param roomId - The room identifier.
     * @param userId - The participant identifier.
     * @param previousRoomToken - Token of the room the browser is leaving, if any.
     * @returns The session token issued for the new session.
     */
    private enterRoom(
        ws: ExtendedWebSocket,
        roomId: string,
        userId: string,
        previousRoomToken: string | null
    ): string {
        ws.roomId = roomId;
        ws.userId = userId;
        this.sessions.bind(ws, roomId, userId);
        this.sessions.endPreviousRoom(previousRoomToken, { roomId, userId });
        return sessionService.issue(roomId, userId);
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
        const sessionToken = this.enterRoom(ws, roomId, hostId, payload.previousRoomToken ?? null);
        this.send(ws, 'SESSION', { sessionToken, userId: hostId });

        this.send(ws, 'ROOM_STATE', {
            currentUserId: hostId,
            roomState: roomManager.sanitizeStateForUser(roomState, hostId),
        });
    }

    /**
     * Handles joining an existing room and binds the session to the connection.
     *
     * The admission bars run before the room is even consulted, and the
     * failed-join budget is spent only on codes that match no room.
     */
    private handleJoinRoom(ws: ExtendedWebSocket, payload: JoinRoomPayload): void {
        const attempt = resolveJoinAttempt(payload, ws.remoteAddress);
        if (this.admission.refuse(ws, attempt)) {
            return;
        }

        const result = this.seatParticipant(payload, attempt.provenUserId);
        if (!result) {
            this.admission.reportUnknownRoom(ws, attempt);
            return;
        }
        if (result.error) {
            this.sendError(ws, result.error, result.code);
            return;
        }

        const { participant, roomState } = result;
        if (!participant || !roomState) {
            this.sendError(ws, 'Unable to join room.', 'FORBIDDEN');
            return;
        }

        // Remember which browser profile this participant is, so a kick can bar
        // it even when the participant comes back without its token.
        if (ws.clientId) {
            this.sessions.rememberClientId(roomState.id, participant.id, ws.clientId);
        }

        const issuedToken = this.enterRoom(
            ws,
            roomState.id,
            participant.id,
            payload.previousRoomToken ?? null
        );
        this.send(ws, 'SESSION', { sessionToken: issuedToken, userId: participant.id });

        this.broadcastRoomState(roomState.id);
    }

    /**
     * Asks the room manager to seat the join, applying the default look when the
     * request leaves the avatar or the colour out.
     *
     * @param payload - The join request.
     * @param provenUserId - The participant the join proved, if any.
     * @returns The join result, or null when the room code matches no room.
     */
    private seatParticipant(
        payload: JoinRoomPayload,
        provenUserId?: string
    ): JoinParticipantResult | null {
        return roomManager.joinRoom(
            payload.roomId,
            payload.name,
            payload.avatar || DEFAULT_AVATAR,
            payload.color || DEFAULT_PARTICIPANT_COLOR,
            provenUserId
        );
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
        if (room?.isEnded) {
            // A closed session takes no more votes: the result is final.
            this.sendError(
                ws,
                'This session has ended, so no further votes are accepted.',
                'SESSION_ENDED'
            );
            return;
        }
        if (room?.votesRevealed) {
            // A revealed round is closed: the cards are public and the result is
            // being discussed, so accepting another vote would rewrite history.
            this.sendError(
                ws,
                'Votes are already revealed for this story. Reset them to vote again.',
                'VOTES_REVEALED'
            );
            return;
        }
        if (!room?.activeDeck.includes(payload.vote)) {
            this.sendError(ws, 'Vote value is not part of the active deck.', 'INVALID_VOTE');
            return;
        }

        const updated = roomManager.submitVote(session.roomId, session.userId, payload.vote);
        if (updated) {
            this.broadcastRoomState(session.roomId);
            return;
        }
        this.sendError(ws, 'Your vote was not accepted for the active story.', 'INVALID_VOTE');
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
            this.sendError(ws, 'Only administrators can remove participants.', 'FORBIDDEN');
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

        // The browser profile, when the kicked participant was ever seen with
        // one: this is the bar that a tab without a token cannot walk past.
        const clientId = this.sessions.clientIdFor(session.roomId, payload.targetUserId);
        if (clientId) {
            this.bans.banClient(session.roomId, clientId, Date.now(), KICK_BAN_DURATION_MS);
        }
        this.sessions.forgetClientId(session.roomId, payload.targetUserId);
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
