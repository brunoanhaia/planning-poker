import { KICK_BAN_DURATION_MS } from '@planitpoker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

import { WebSocketHandler } from '../src/webSocketHandler.js';

/** One message the handler sent to a socket double. */
interface SentMessage {
    payload: { code?: string; message?: string; sessionToken?: string; userId?: string } & {
        roomState?: { id?: string };
    };
    type: string;
}

/** A socket double that records what the handler sends it. */
class SocketDouble {
    public static readonly OPEN = 1;
    public readonly readyState = 1;
    public isAlive = true;
    public hasOrigin = true;
    public roomId?: string;
    public userId?: string;
    public readonly sent: SentMessage[] = [];
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
    public close(): void {}
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

    const handler = new WebSocketHandler(wss);
    handlers.push(handler);

    /** Opens a connection the way the handler sees it. */
    const connect = (hasOrigin = true): SocketDouble => {
        const socket = new SocketDouble();
        socket.hasOrigin = hasOrigin;
        sockets.push(socket);
        listeners.get('connection')?.(socket, {
            headers: hasOrigin ? { origin: 'http://localhost:5173' } : {},
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

describe('Kick ban, end to end', () => {
    it('refuses the rejoin the kicked client attempts with its own token', () => {
        const { connect } = boot();

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const session = lastMessage(host, 'SESSION');
        const hostToken = session?.payload.sessionToken as string;
        const roomId = lastMessage(host, 'ROOM_STATE')?.payload.roomState.id as string;
        expect(roomId).toMatch(/^[A-Z0-9]{6}$/);

        const bob = connect();
        send(bob, 'JOIN_ROOM', { name: 'Bob', roomId });
        const bobToken = lastMessage(bob, 'SESSION')?.payload.sessionToken as string;
        const bobId = lastMessage(bob, 'SESSION')?.payload.userId as string;
        expect(bobToken).toBeTruthy();
        expect(bobId).not.toBe(undefined);

        // Alice kicks Bob, which revokes his token.
        send(host, 'KICK_PARTICIPANT', { targetUserId: bobId });
        expect(messagesOf(host, 'ERROR')).toHaveLength(0);
        expect(lastMessage(bob, 'KICKED')).toBeDefined();

        // Bob comes straight back with the very token that was just revoked.
        const bobAgain = connect();
        send(bobAgain, 'JOIN_ROOM', { name: 'Bob', roomId, sessionToken: bobToken });

        const error = lastMessage(bobAgain, 'ERROR');
        expect(error?.payload.code).toBe('BANNED');
        expect(bobAgain.userId).toBeUndefined();

        // The host is unaffected.
        expect(hostToken).toBeTruthy();
    });

    it('lets the same client back once the bar expires', () => {
        vi.useFakeTimers();
        try {
            const { connect } = boot();

            const host = connect();
            send(host, 'CREATE_ROOM', { name: 'Alice' });
            const roomId = lastMessage(host, 'ROOM_STATE')?.payload.roomState.id as string;

            const bob = connect();
            send(bob, 'JOIN_ROOM', { name: 'Bob', roomId });
            const bobId = lastMessage(bob, 'SESSION')?.payload.userId as string;

            send(host, 'KICK_PARTICIPANT', { targetUserId: bobId });
            vi.advanceTimersByTime(KICK_BAN_DURATION_MS + 1);

            const bobAgain = connect();
            send(bobAgain, 'JOIN_ROOM', { name: 'Bob', roomId });
            expect(lastMessage(bobAgain, 'ERROR')?.payload.code).toBeUndefined();
            expect(lastMessage(bobAgain, 'SESSION')).toBeDefined();
            expect(bobAgain.userId).toBeTruthy();
            expect(bobAgain.userId).not.toBe(bobId);
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not bar a client that was never in the room', () => {
        const { connect } = boot();

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = lastMessage(host, 'ROOM_STATE')?.payload.roomState.id as string;

        const stranger = connect();
        send(stranger, 'JOIN_ROOM', {
            name: 'Stranger',
            roomId,
            sessionToken: 'a-token-the-server-never-issued',
        });

        // An unknown token is not a bar: the client is let in as a new
        // participant, exactly as before the ban existed.
        expect(lastMessage(stranger, 'ERROR')).toBeUndefined();
        expect(lastMessage(stranger, 'SESSION')).toBeDefined();
    });
});
