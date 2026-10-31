import { SESSION_REPLACED_CLOSE_CODE } from '@planitpoker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

import { ConnectionLimiter } from '../src/connectionLimiter.js';
import { WebSocketHandler } from '../src/webSocketHandler.js';

/** One message the handler sent to a socket double. */
interface SentMessage {
    payload: {
        code?: string;
        message?: string;
        roomState?: {
            id: string;
            participants: { id: string; isSpectator: boolean; name: string }[];
        };
        sessionToken?: string;
        userId?: string;
    };
    type: string;
}

/** A socket double that records what the handler sends it. */
class SocketDouble {
    public static readonly OPEN = 1;
    public readyState = 1;
    public isAlive = true;
    public hasOrigin = true;
    public roomId?: string;
    public userId?: string;
    /** Identity the handler read from the handshake cookie. */
    public clientId?: string;
    public readonly sent: SentMessage[] = [];
    /** Close frames the handler asked the socket to use. */
    public readonly closes: { code?: number; reason?: string }[] = [];
    private readonly listeners = new Map<string, ((...args: unknown[]) => void)[]>();

    public on(event: string, listener: (...args: unknown[]) => void): this {
        this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
        return this;
    }

    public emit(event: string, ...args: unknown[]): void {
        (this.listeners.get(event) ?? []).forEach((listener) => listener(...args));
    }

    public send(data: string): void {
        this.sent.push(JSON.parse(data) as SentMessage);
    }

    public terminate(): void {}
    public close(code?: number, reason?: string): void {
        if (this.readyState !== 1) {
            return;
        }
        this.closes.push({ code, reason });
        this.readyState = 2;
    }
    public ping(): void {}
    public removeListener(): void {}
}

/** Messages of one type the handler sent to a socket. */
const messagesOf = (socket: SocketDouble, type: string): SentMessage[] =>
    socket.sent.filter((message) => message.type === type);

/** The last message of one type, if any. */
const lastMessage = (socket: SocketDouble, type: string): SentMessage | undefined => {
    const matching = messagesOf(socket, type);
    return matching.length > 0 ? matching[matching.length - 1] : undefined;
};

/** The room id of the last `ROOM_STATE` a socket received. */
const roomIdOf = (socket: SocketDouble): string => {
    const roomState = lastMessage(socket, 'ROOM_STATE')?.payload.roomState;
    if (!roomState) {
        throw new Error('no ROOM_STATE was received');
    }
    return roomState.id;
};

/** The participant id of the last `SESSION` a socket received. */
const participantIdOf = (socket: SocketDouble): string => {
    const participantId = lastMessage(socket, 'SESSION')?.payload.userId;
    if (!participantId) {
        throw new Error('no SESSION was received');
    }
    return participantId;
};

/** The token of the last `SESSION` a socket received. */
const tokenOf = (socket: SocketDouble): string => {
    const token = lastMessage(socket, 'SESSION')?.payload.sessionToken;
    if (!token) {
        throw new Error('no SESSION was received');
    }
    return token;
};

const handlers: WebSocketHandler[] = [];

/** Boots the real handler against a socket double harness. */
const boot = () => {
    const sockets: SocketDouble[] = [];
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const wss = {
        clients: sockets,
        close: vi.fn(),
        on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
            listeners.set(event, listener);
        }),
    } as unknown as WebSocketServer;

    const handler = new WebSocketHandler(wss, {
        cloudflareEnabled: false,
        connections: new ConnectionLimiter(64, 1_000, 60_000, 100),
        trustProxyHops: 0,
    });
    handlers.push(handler);

    /** Opens a connection the way the handler sees it. */
    const connect = (): SocketDouble => {
        const clientId = '11111111-1111-4111-8111-111111111111';
        const socket = new SocketDouble();
        socket.clientId = clientId;
        sockets.push(socket);
        listeners.get('connection')?.(socket, {
            headers: {
                cookie: `pip_client=${clientId}`,
                origin: 'http://localhost:5173',
            },
            socket: { remoteAddress: '127.0.0.1' },
        });
        return socket;
    };

    return { connect, handler, sockets };
};

/** Sends a message to a socket double. */
const send = (socket: SocketDouble, type: string, payload: unknown): void =>
    socket.emit('message', JSON.stringify({ payload, type }));

afterEach(() => {
    while (handlers.length > 0) {
        handlers.pop()?.shutdown();
    }
});

describe('Session replacement', () => {
    it('closes the superseded socket and keeps the participant in the room', () => {
        const { connect } = boot();

        const first = connect();
        send(first, 'CREATE_ROOM', { name: 'Alice' });
        const token = tokenOf(first);
        const roomId = roomIdOf(first);
        const participantId = participantIdOf(first);

        const second = connect();
        send(second, 'JOIN_ROOM', { name: 'Alice', roomId, sessionToken: token });

        // The older connection is told why it lost the participant instead of
        // being left to keep issuing commands.
        expect(first.closes).toEqual([
            { code: SESSION_REPLACED_CLOSE_CODE, reason: 'session replaced' },
        ]);

        // The newcomer took over the same participant rather than adding one.
        expect(participantIdOf(second)).toBe(participantId);
        expect(lastMessage(second, 'ROOM_STATE')?.payload.roomState?.participants).toHaveLength(1);

        // The superseded socket's own close event must not evict the participant:
        // its session was detached before the close was requested.
        first.emit('close');
        const afterClose = lastMessage(second, 'ROOM_STATE')?.payload.roomState?.participants;
        expect(afterClose).toHaveLength(1);

        // The surviving connection still acts on the room.
        send(second, 'TOGGLE_SPECTATOR', {});
        const updated = lastMessage(second, 'ROOM_STATE')?.payload.roomState?.participants;
        expect(updated).toHaveLength(1);
        expect(updated?.[0]).toMatchObject({ id: participantId, isSpectator: true });
    });
});
