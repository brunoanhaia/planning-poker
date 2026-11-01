import { vi } from 'vitest';
import { WebSocketServer } from 'ws';

import { ConnectionLimiter } from '../../src/connectionLimiter.js';
import { WebSocketHandler } from '../../src/webSocketHandler.js';

/** Identity a browser carries when a test does not ask for another one. */
export const DEFAULT_CLIENT_ID = '11111111-1111-4111-8111-111111111111';

/** One message the handler sent to a socket double. */
export interface SentMessage {
    payload: {
        code?: string;
        message?: string;
        roomState?: {
            hostId: string;
            id: string;
            participants: { id: string; isSpectator: boolean; name: string }[];
        };
        sessionToken?: string;
        userId?: string;
    };
    type: string;
}

/** A socket double that records what the handler sends it. */
export class SocketDouble {
    public static readonly OPEN = 1;
    public readyState = 1;
    public isAlive = true;
    public hasOrigin = true;
    public roomId?: string;
    public userId?: string;
    /** Identity the handler read from the handshake cookie. */
    public clientId?: string;
    public readonly sent: SentMessage[] = [];
    /** Close codes the handler asked the socket to use. */
    public readonly closeCodes: number[] = [];
    /** Close frames the handler asked the socket to use, code and reason included. */
    public readonly closes: { code?: number; reason?: string }[] = [];
    /** Keepalive probes the handler sent. */
    public pingCount = 0;
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

    /** Marks the socket CLOSED, as `ws` does when it drops a connection. */
    public terminate(): void {
        this.readyState = 3;
    }
    public close(code?: number, reason?: string): void {
        // `ws` does nothing when close() arrives on a socket that is already
        // CLOSING or CLOSED, and leaves OPEN immediately otherwise.
        if (this.readyState !== 1) {
            return;
        }
        this.closes.push({ code, reason });
        if (code !== undefined) {
            this.closeCodes.push(code);
        }
        this.readyState = 2;
    }
    /** Counts the keepalive probes the handler sends. */
    public ping(): void {
        this.pingCount += 1;
    }
    /** Drops one listener, so a double cannot accumulate handlers across reconnects. */
    public removeListener(event: string, listener: (...args: unknown[]) => void): void {
        this.listeners.set(
            event,
            (this.listeners.get(event) ?? []).filter((it) => it !== listener)
        );
    }
}

/** Options a connection may be opened with. */
export interface ConnectOptions {
    /** Identity cookie the handshake carries. */
    clientId?: string;
    /** Whether the handshake carries an `Origin` header. */
    hasOrigin?: boolean;
    /** Peer address the handler sees. */
    remoteAddress?: string;
}

/** The handler, the sockets it knows about, and a connection factory. */
export interface Harness {
    connect: (options?: ConnectOptions) => SocketDouble;
    handler: WebSocketHandler;
    sockets: SocketDouble[];
}

/** Messages of one type the handler sent to a socket. */
export const messagesOf = (socket: SocketDouble, type: string): SentMessage[] =>
    socket.sent.filter((message) => message.type === type);

/** The last message of one type, if any. */
export const lastMessage = (socket: SocketDouble, type: string): SentMessage | undefined => {
    const matching = messagesOf(socket, type);
    return matching.at(-1);
};

/** The room id of the last `ROOM_STATE` a socket received. */
export const roomIdOf = (socket: SocketDouble): string => {
    const roomState = lastMessage(socket, 'ROOM_STATE')?.payload.roomState;
    if (!roomState) {
        throw new Error('no ROOM_STATE was received');
    }
    return roomState.id;
};

/** The participant id of the last `SESSION` a socket received. */
export const participantIdOf = (socket: SocketDouble): string => {
    const participantId = lastMessage(socket, 'SESSION')?.payload.userId;
    if (!participantId) {
        throw new Error('no SESSION was received');
    }
    return participantId;
};

/** The token of the last `SESSION` a socket received. */
export const tokenOf = (socket: SocketDouble): string => {
    const token = lastMessage(socket, 'SESSION')?.payload.sessionToken;
    if (!token) {
        throw new Error('no SESSION was received');
    }
    return token;
};

const handlers: WebSocketHandler[] = [];

/**
 * Boots the real handler against a socket double harness.
 *
 * @param defaults - Connection options every {@link Harness.connect} call starts from.
 */
export const boot = (defaults?: ConnectOptions): Harness => {
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

    /**
     * Opens a connection the way the handler sees it.
     *
     * @param options - Origin presence, the identity cookie and the peer address.
     */
    const connect = (options?: ConnectOptions): SocketDouble => {
        const hasOrigin = options?.hasOrigin ?? defaults?.hasOrigin ?? true;
        // A browser always carries the identity the server issued it, unless a
        // test explicitly asks for one that has none.
        const clientId =
            options?.clientId ?? defaults?.clientId ?? (hasOrigin ? DEFAULT_CLIENT_ID : undefined);
        const socket = new SocketDouble();
        socket.hasOrigin = hasOrigin;
        if (clientId) {
            socket.clientId = clientId;
        }
        sockets.push(socket);
        listeners.get('connection')?.(socket, {
            headers: {
                ...(hasOrigin ? { origin: 'http://localhost:5173' } : {}),
                ...(clientId ? { cookie: `pip_client=${clientId}` } : {}),
            },
            socket: {
                remoteAddress: options?.remoteAddress ?? defaults?.remoteAddress ?? '127.0.0.1',
            },
        });
        return socket;
    };

    return { connect, handler, sockets };
};

/** Shuts down every handler this module booted. */
export const shutdownHandlers = (): void => {
    while (handlers.length > 0) {
        handlers.pop()?.shutdown();
    }
};

/** Sends a message to a socket double. */
export const send = (socket: SocketDouble, type: string, payload: unknown): void =>
    socket.emit('message', JSON.stringify({ payload, type }));
