import { WebSocketServer, WebSocket } from 'ws';

import { roomManager } from './roomManager.js';
import { WSMessage, RoomState } from './types.js';

interface ExtendedWebSocket extends WebSocket {
  roomId?: string;
  userId?: string;
  isAlive?: boolean;
}

export class WebSocketHandler {
  private wss: WebSocketServer;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.init();
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
        if (ws.roomId && ws.userId) {
          const updatedRoom = roomManager.leaveRoom(ws.roomId, ws.userId);
          if (updatedRoom) {
            this.broadcastRoomState(ws.roomId);
          }
        }
      });
    });

    // Heartbeat ping interval
    setInterval(() => {
      this.wss.clients.forEach((ws: ExtendedWebSocket) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  private handleMessage(ws: ExtendedWebSocket, msg: WSMessage) {
    const { type, payload } = msg;

    switch (type) {
      case 'CREATE_ROOM': {
        const { name, avatar, color, title, deckType, customDeck } = payload;
        const { roomId, hostId, roomState } = roomManager.createRoom(
          name,
          avatar,
          color,
          title,
          deckType,
          customDeck
        );

        ws.roomId = roomId;
        ws.userId = hostId;

        // Reply to creator
        this.send(ws, 'ROOM_STATE', {
          roomState: roomManager.sanitizeStateForUser(roomState, hostId),
          currentUserId: hostId,
        });
        break;
      }

      case 'JOIN_ROOM': {
        const { roomId, name, avatar, color, userId } = payload;
        const result = roomManager.joinRoom(roomId, name, avatar, color, userId);

        if (!result) {
          return this.sendError(ws, `Room "${roomId}" not found. Please check room code.`);
        }

        const { participant, roomState } = result;
        ws.roomId = roomState.id;
        ws.userId = participant.id;

        // Broadcast to all room members
        this.broadcastRoomState(roomState.id);
        break;
      }

      case 'VOTE': {
        if (!ws.roomId || !ws.userId) return;
        const updated = roomManager.submitVote(ws.roomId, ws.userId, payload.vote);
        if (updated) {
          this.broadcastRoomState(ws.roomId);
        }
        break;
      }

      case 'REVEAL_VOTES': {
        if (!ws.roomId || !ws.userId) return;
        const updated = roomManager.revealVotes(ws.roomId, ws.userId);
        if (updated) {
          this.broadcastRoomState(ws.roomId);
        }
        break;
      }

      case 'RESET_VOTES': {
        if (!ws.roomId || !ws.userId) return;
        const updated = roomManager.resetVotes(ws.roomId, ws.userId);
        if (updated) {
          this.broadcastRoomState(ws.roomId);
        }
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

      case 'ADD_STORY': {
        if (!ws.roomId) return;
        const updated = roomManager.addStory(ws.roomId, payload.title, payload.description);
        if (updated) {
          this.broadcastRoomState(ws.roomId);
        }
        break;
      }

      case 'SET_CURRENT_STORY': {
        if (!ws.roomId) return;
        const updated = roomManager.setCurrentStory(ws.roomId, payload.storyIndex);
        if (updated) {
          this.broadcastRoomState(ws.roomId);
        }
        break;
      }

      case 'UPDATE_STORY_ESTIMATE': {
        if (!ws.roomId) return;
        const updated = roomManager.updateStoryEstimate(
          ws.roomId,
          payload.storyId,
          payload.estimate
        );
        if (updated) {
          this.broadcastRoomState(ws.roomId);
        }
        break;
      }

      case 'DELETE_STORY': {
        if (!ws.roomId) return;
        const updated = roomManager.deleteStory(ws.roomId, payload.storyId);
        if (updated) {
          this.broadcastRoomState(ws.roomId);
        }
        break;
      }

      case 'CHANGE_DECK': {
        if (!ws.roomId) return;
        const updated = roomManager.changeDeck(ws.roomId, payload.deckType, payload.customDeck);
        if (updated) {
          this.broadcastRoomState(ws.roomId);
        }
        break;
      }

      default:
        this.sendError(ws, `Unknown action type: ${type}`);
    }
  }

  public broadcastRoomState(roomId: string) {
    const rawState = roomManager.getRoom(roomId);
    if (!rawState) return;

    this.wss.clients.forEach((client: ExtendedWebSocket) => {
      if (client.readyState === WebSocket.OPEN && client.roomId === roomId && client.userId) {
        const sanitized = roomManager.sanitizeStateForUser(rawState, client.userId);
        this.send(client, 'ROOM_STATE', {
          roomState: sanitized,
          currentUserId: client.userId,
        });
      }
    });
  }

  private send(ws: WebSocket, type: string, payload: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }

  private sendError(ws: WebSocket, message: string) {
    this.send(ws, 'ERROR', { message });
  }
}
