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

import { roomManager } from './roomManager.js';

interface ExtendedWebSocket extends WebSocket {
    isAlive?: boolean;
    roomId?: string;
    userId?: string;
}

export class WebSocketHandler {
    private timerInterval: NodeJS.Timeout | null = null;
    private wss: WebSocketServer;

    constructor(wss: WebSocketServer) {
        this.wss = wss;
        this.init();
        this.startTimerTicker();
    }

    private init() {
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
                if (!ws.roomId || !ws.userId) return;
                const updatedRoom = roomManager.leaveRoom(ws.roomId, ws.userId);
                if (updatedRoom) {
                    this.broadcastRoomState(ws.roomId);
                }
            });
        });

        // Heartbeat ping interval
        setInterval(() => {
            this.wss.clients.forEach((client) => {
                const ws = client as ExtendedWebSocket;
                if (ws.isAlive === false) return ws.terminate();
                ws.isAlive = false;
                ws.ping();
            });
        }, 30000);
    }

    private startTimerTicker() {
        this.timerInterval = setInterval(() => {
            const activeRooms = new Set<string>();
            this.wss.clients.forEach((client) => {
                const ws = client as ExtendedWebSocket;
                if (ws.roomId) activeRooms.add(ws.roomId);
            });

            activeRooms.forEach((roomId) => {
                const updated = roomManager.tickTimer(roomId);
                if (updated) {
                    this.broadcastRoomState(roomId);
                }
            });
        }, 1000);
    }

    private handleMessage(ws: ExtendedWebSocket, msg: WSMessage) {
        const { payload, type } = msg;

        switch (type) {
            case 'CREATE_ROOM': {
                const { avatar, color, customDeck, deckType, name, title } =
                    payload as CreateRoomPayload;
                const { hostId, roomId, roomState } = roomManager.createRoom(
                    name,
                    avatar || '👤',
                    color || '#6366f1',
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
                break;
            }

            case 'JOIN_ROOM': {
                const { avatar, color, name, roomId, userId } = payload as JoinRoomPayload;
                const result = roomManager.joinRoom(
                    roomId,
                    name,
                    avatar || '👤',
                    color || '#3b82f6',
                    userId || undefined
                );

                if (!result) {
                    return this.sendError(
                        ws,
                        `Room "${roomId}" not found. Please check room code.`
                    );
                }

                if (result.error) {
                    return this.sendError(ws, result.error);
                }

                const { participant, roomState } = result;
                if (!participant || !roomState) {
                    return this.sendError(ws, 'Unable to join room.');
                }

                ws.roomId = roomState.id;
                ws.userId = participant.id;

                this.broadcastRoomState(roomState.id);
                break;
            }

            case 'UPDATE_ROOM_TITLE': {
                if (!ws.roomId || !ws.userId) return;
                const { title } = payload as UpdateRoomTitlePayload;
                const updated = roomManager.updateRoomTitle(ws.roomId, ws.userId, title);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators can rename the room.');
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'TOGGLE_LOCK_ROOM': {
                if (!ws.roomId || !ws.userId) return;
                const updated = roomManager.toggleLockRoom(ws.roomId, ws.userId);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators can lock/unlock the room.');
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'TOGGLE_AUTO_REVEAL': {
                if (!ws.roomId || !ws.userId) return;
                const updated = roomManager.toggleAutoReveal(ws.roomId, ws.userId);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators can toggle auto-reveal.');
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'START_TIMER': {
                if (!ws.roomId || !ws.userId) return;
                const { duration } = (payload as StartTimerPayload) || {};
                const updated = roomManager.startTimer(ws.roomId, ws.userId, duration || 60);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators can start the timer.');
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'PAUSE_TIMER': {
                if (!ws.roomId || !ws.userId) return;
                const updated = roomManager.pauseTimer(ws.roomId, ws.userId);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators can pause/resume the timer.');
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'RESET_TIMER': {
                if (!ws.roomId || !ws.userId) return;
                const updated = roomManager.resetTimer(ws.roomId, ws.userId);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators can reset the timer.');
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'VOTE': {
                if (!ws.roomId || !ws.userId) return;
                const { vote } = payload as VotePayload;
                const updated = roomManager.submitVote(ws.roomId, ws.userId, vote);
                if (updated) {
                    this.broadcastRoomState(ws.roomId);
                }
                break;
            }

            case 'REVEAL_VOTES': {
                if (!ws.roomId || !ws.userId) return;
                const updated = roomManager.revealVotes(ws.roomId, ws.userId);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators or co-hosts can reveal votes.');
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'RESET_VOTES': {
                if (!ws.roomId || !ws.userId) return;
                const updated = roomManager.resetVotes(ws.roomId, ws.userId);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators can reset votes.');
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'TOGGLE_SPECTATOR': {
                if (!ws.roomId || !ws.userId) return;
                const updated = roomManager.toggleSpectator(ws.roomId, ws.userId);
                if (updated) {
                    this.broadcastRoomState(ws.roomId);
                }
                break;
            }

            case 'TOGGLE_USER_ROLE': {
                if (!ws.roomId || !ws.userId) return;
                const { targetUserId } = payload as TargetUserPayload;
                const updated = roomManager.toggleUserRole(ws.roomId, ws.userId, targetUserId);
                if (!updated) {
                    return this.sendError(
                        ws,
                        'Only administrators can change other participants roles.'
                    );
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'KICK_PARTICIPANT': {
                if (!ws.roomId || !ws.userId) return;
                const { targetUserId } = payload as TargetUserPayload;
                const updated = roomManager.kickParticipant(ws.roomId, ws.userId, targetUserId);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators can remove participants.');
                }

                this.wss.clients.forEach((client) => {
                    const clientWs = client as ExtendedWebSocket;
                    if (clientWs.roomId === ws.roomId && clientWs.userId === targetUserId) {
                        this.send(clientWs, 'KICKED', {
                            message: 'You have been removed from the session by an administrator.',
                        });
                        clientWs.roomId = undefined;
                        clientWs.userId = undefined;
                    }
                });
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'PROMOTE_COADMIN': {
                if (!ws.roomId || !ws.userId) return;
                const { targetUserId } = payload as TargetUserPayload;
                const updated = roomManager.promoteCoAdmin(ws.roomId, ws.userId, targetUserId);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators can promote co-administrators.');
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'TRANSFER_ADMIN': {
                if (!ws.roomId || !ws.userId) return;
                const { targetUserId } = payload as TargetUserPayload;
                const updated = roomManager.transferAdmin(ws.roomId, ws.userId, targetUserId);
                if (!updated) {
                    return this.sendError(
                        ws,
                        'Only the primary room host can transfer administration.'
                    );
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'ADD_STORY': {
                if (!ws.roomId || !ws.userId) return;
                const { description, title } = payload as AddStoryPayload;
                const updated = roomManager.addStory(ws.roomId, ws.userId, title, description);
                if (!updated) {
                    return this.sendError(
                        ws,
                        'Only administrators can add stories to the backlog.'
                    );
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'BULK_ADD_STORIES': {
                if (!ws.roomId || !ws.userId) return;
                const { stories } = payload as BulkAddStoriesPayload;
                const updated = roomManager.bulkAddStories(ws.roomId, ws.userId, stories);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators can bulk import stories.');
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'SET_CURRENT_STORY': {
                if (!ws.roomId || !ws.userId) return;
                const { storyIndex } = payload as SetCurrentStoryPayload;
                const updated = roomManager.setCurrentStory(ws.roomId, ws.userId, storyIndex);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators can change the active story.');
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'UPDATE_STORY_ESTIMATE': {
                if (!ws.roomId || !ws.userId) return;
                const { estimate, storyId } = payload as UpdateStoryEstimatePayload;
                const updated = roomManager.updateStoryEstimate(
                    ws.roomId,
                    ws.userId,
                    storyId,
                    estimate
                );
                if (!updated) {
                    return this.sendError(
                        ws,
                        'Only administrators can finalize and accept story estimates.'
                    );
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'DELETE_STORY': {
                if (!ws.roomId || !ws.userId) return;
                const { storyId } = payload as DeleteStoryPayload;
                const updated = roomManager.deleteStory(ws.roomId, ws.userId, storyId);
                if (!updated) {
                    return this.sendError(
                        ws,
                        'Only administrators can delete stories from the backlog.'
                    );
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'CHANGE_DECK': {
                if (!ws.roomId || !ws.userId) return;
                const { customDeck, deckType } = payload as ChangeDeckPayload;
                const updated = roomManager.changeDeck(ws.roomId, ws.userId, deckType, customDeck);
                if (!updated) {
                    return this.sendError(
                        ws,
                        'Only administrators can change the estimation deck.'
                    );
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            case 'END_SESSION': {
                if (!ws.roomId || !ws.userId) return;
                const updated = roomManager.endSession(ws.roomId, ws.userId);
                if (!updated) {
                    return this.sendError(ws, 'Only administrators can end the session.');
                }
                this.broadcastRoomState(ws.roomId);
                break;
            }

            default:
                this.sendError(ws, `Unknown action type: ${type}`);
        }
    }

    public broadcastRoomState(roomId: string) {
        const rawState = roomManager.getRoom(roomId);
        if (!rawState) return;

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

    private send(ws: WebSocket, type: WSMessageType, payload: unknown) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ payload, type }));
        }
    }

    private sendError(ws: WebSocket, message: string) {
        this.send(ws, 'ERROR', { message });
    }
}
