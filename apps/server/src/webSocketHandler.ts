import {
    AddStoryPayload,
    BulkAddStoriesPayload,
    ChangeDeckPayload,
    CreateRoomPayload,
    DeleteStoryPayload,
    JoinRoomPayload,
    SetCurrentStoryPayload,
    StartTimerPayload,
    TargetUserPayload,
    UpdateRoomTitlePayload,
    UpdateStoryEstimatePayload,
    VotePayload,
    WSMessage,
    WSMessageType,
} from '@planitpoker/shared';
import { WebSocket, WebSocketServer } from 'ws';

import {
    DEFAULT_AVATAR,
    DEFAULT_HOST_COLOR,
    DEFAULT_PARTICIPANT_COLOR,
    DEFAULT_TIMER_DURATION_SECONDS,
    HEARTBEAT_INTERVAL_MS,
    TIMER_TICK_INTERVAL_MS,
} from './constants.js';
import { roomManager } from './roomManager.js';

interface ExtendedWebSocket extends WebSocket {
    isAlive?: boolean;
    roomId?: string;
    userId?: string;
}

interface RoomSession {
    roomId: string;
    userId: string;
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

    constructor(wss: WebSocketServer) {
        this.wss = wss;
        this.init();
        this.startTimerTicker();
    }

    /**
     * Initializes WebSocket listeners and client heartbeat interval.
     */
    private init(): void {
        this.wss.on('connection', (ws: ExtendedWebSocket) => {
            ws.isAlive = true;

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
                if (!ws.roomId || !ws.userId) {
                    return;
                }
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
            this.sendError(ws, `Unknown action type: ${msg.type}`);
            return;
        }
        handler(ws, msg.payload);
    }

    /**
     * Returns the room session bound to a connection, if any.
     *
     * @param ws - The sender's WebSocket connection.
     * @returns The room/user identifiers, or null when not in a room.
     */
    private getSession(ws: ExtendedWebSocket): RoomSession | null {
        if (!ws.roomId || !ws.userId) {
            return null;
        }
        return { roomId: ws.roomId, userId: ws.userId };
    }

    /**
     * Broadcasts the room state when an operation succeeds, otherwise notifies the sender.
     *
     * @param ws - The sender's WebSocket connection.
     * @param roomId - The room identifier.
     * @param updated - Whether the domain operation succeeded.
     * @param errorMessage - Message sent to the requester when the operation fails.
     */
    private broadcastOrError(
        ws: ExtendedWebSocket,
        roomId: string,
        updated: unknown,
        errorMessage: string
    ): void {
        if (!updated) {
            this.sendError(ws, errorMessage);
            return;
        }
        this.broadcastRoomState(roomId);
    }

    /**
     * Handles room creation and binds the new session to the connection.
     */
    private handleCreateRoom(ws: ExtendedWebSocket, payload: CreateRoomPayload): void {
        const { avatar, color, customDeck, deckType, name, title } = payload;
        const { hostId, roomId, roomState } = roomManager.createRoom(
            name,
            avatar || DEFAULT_AVATAR,
            color || DEFAULT_HOST_COLOR,
            title,
            deckType,
            customDeck
        );

        ws.roomId = roomId;
        ws.userId = hostId;

        this.send(ws, 'ROOM_STATE', {
            currentUserId: hostId,
            roomState: roomManager.sanitizeStateForUser(roomState, hostId),
        });
    }

    /**
     * Handles joining an existing room and binds the session to the connection.
     */
    private handleJoinRoom(ws: ExtendedWebSocket, payload: JoinRoomPayload): void {
        const { avatar, color, name, roomId, userId } = payload;
        const result = roomManager.joinRoom(
            roomId,
            name,
            avatar || DEFAULT_AVATAR,
            color || DEFAULT_PARTICIPANT_COLOR,
            userId || undefined
        );

        if (!result) {
            this.sendError(ws, `Room "${roomId}" not found. Please check room code.`);
            return;
        }

        if (result.error) {
            this.sendError(ws, result.error);
            return;
        }

        const { participant, roomState } = result;
        if (!participant || !roomState) {
            this.sendError(ws, 'Unable to join room.');
            return;
        }

        ws.roomId = roomState.id;
        ws.userId = participant.id;

        this.broadcastRoomState(roomState.id);
    }

    /**
     * Handles room title updates.
     */
    private handleUpdateRoomTitle(ws: ExtendedWebSocket, payload: UpdateRoomTitlePayload): void {
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
        if (!session) {
            return;
        }
        const { duration } = payload || {};
        const updated = roomManager.startTimer(
            session.roomId,
            session.userId,
            duration || DEFAULT_TIMER_DURATION_SECONDS
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
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.submitVote(session.roomId, session.userId, payload.vote);
        if (updated) {
            this.broadcastRoomState(session.roomId);
        }
    }

    /**
     * Handles revealing all submitted votes.
     */
    private handleRevealVotes(ws: ExtendedWebSocket): void {
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
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
            'Only administrators can promote co-administrators.'
        );
    }

    /**
     * Handles transferring primary administration to another participant.
     */
    private handleTransferAdmin(ws: ExtendedWebSocket, payload: TargetUserPayload): void {
        const session = this.getSession(ws);
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
            'Only the primary room host can transfer administration.'
        );
    }

    /**
     * Handles adding a story to the backlog.
     */
    private handleAddStory(ws: ExtendedWebSocket, payload: AddStoryPayload): void {
        const session = this.getSession(ws);
        if (!session) {
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
            'Only administrators can add stories to the backlog.'
        );
    }

    /**
     * Handles bulk importing stories into the backlog.
     */
    private handleBulkAddStories(ws: ExtendedWebSocket, payload: BulkAddStoriesPayload): void {
        const session = this.getSession(ws);
        if (!session) {
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
        const session = this.getSession(ws);
        if (!session) {
            return;
        }
        const updated = roomManager.setCurrentStory(
            session.roomId,
            session.userId,
            payload.storyIndex
        );
        if (!updated) {
            this.sendError(ws, 'Only administrators can change the active story.');
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
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
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
        const session = this.getSession(ws);
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
     */
    private sendError(ws: WebSocket, message: string): void {
        this.send(ws, 'ERROR', { message });
    }
}
