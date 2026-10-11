import { KICK_BAN_DURATION_MS, WS_THROTTLE_MAX_MESSAGES } from '@planitpoker/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocketServer } from 'ws';

import { ConnectionLimiter } from '../src/connectionLimiter.js';
import { JOIN_FAILURE_LIMIT } from '../src/constants.js';
import { TurnstileVerifier } from '../src/turnstile.js';
import { WebSocketHandler } from '../src/webSocketHandler.js';

/** One message the handler sent to a socket double. */
interface SentMessage {
    payload: {
        code?: string;
        message?: string;
        roomState?: { hostId: string; id: string };
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
    /** Close codes the handler asked the socket to use. */
    public readonly closeCodes: number[] = [];
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
    public close(code?: number, _reason?: string): void {
        // `ws` does nothing when close() arrives on a socket that is already
        // CLOSING or CLOSED, and leaves OPEN immediately otherwise.
        if (this.readyState !== 1) {
            return;
        }
        if (code !== undefined) {
            this.closeCodes.push(code);
        }
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
const boot = (options?: { turnstile?: TurnstileVerifier }) => {
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
        connections: new ConnectionLimiter(64, 1_000, 60_000, 100),
        turnstile: options?.turnstile ?? new TurnstileVerifier(undefined),
        trustProxyHops: 0,
    });
    handlers.push(handler);

    /**
     * Opens a connection the way the handler sees it.
     *
     * @param options - Origin presence, the identity cookie and the peer address.
     */
    const connect = (options?: {
        clientId?: string;
        hasOrigin?: boolean;
        remoteAddress?: string;
    }): SocketDouble => {
        const hasOrigin = options?.hasOrigin ?? true;
        // A browser always carries the identity the server issued it, unless a
        // test explicitly asks for one that has none.
        const clientId =
            options?.clientId ?? (hasOrigin ? '11111111-1111-4111-8111-111111111111' : undefined);
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
            socket: { remoteAddress: options?.remoteAddress ?? '127.0.0.1' },
        });
        return socket;
    };

    return { connect, handler, sockets };
};

/** Sends a message to a socket double. */
const send = (socket: SocketDouble, type: string, payload: unknown): void =>
    socket.emit('message', JSON.stringify({ payload, type }));

/** Sends a message and lets an asynchronous handler finish before asserting. */
const sendAndSettle = async (
    socket: SocketDouble,
    type: string,
    payload: unknown
): Promise<void> => {
    send(socket, type, payload);
    await new Promise((resolve) => setImmediate(resolve));
};

afterEach(() => {
    while (handlers.length > 0) {
        handlers.pop()?.shutdown();
    }
});

describe('Message dispatch hardening', () => {
    it('answers a type named after an inherited key instead of dispatching it', () => {
        // A plain object index resolves inherited keys, so these would otherwise
        // reach the dispatch table and be called as if they were handlers.
        const { connect } = boot();
        const host = connect();

        ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'].forEach((type) => {
            host.emit('message', JSON.stringify({ payload: { x: 1 }, type }));
        });

        const errors = messagesOf(host, 'ERROR');
        expect(errors).toHaveLength(5);
        errors.forEach((error) => {
            expect(error.payload.message).toContain('Unknown action type:');
            expect(error.payload.code).toBe('FORBIDDEN');
        });
        expect(messagesOf(host, 'ROOM_STATE')).toHaveLength(0);
    });

    it('answers a message that is not a JSON object', () => {
        const { connect } = boot();
        const host = connect();

        host.emit('message', JSON.stringify('just a string'));
        host.emit('message', '42');

        expect(messagesOf(host, 'ERROR')).toHaveLength(2);
        expect(lastMessage(host, 'ERROR')?.payload.message).toContain('JSON object');
    });
});

describe('Failed room joins', () => {
    it('spends a budget of distinct wrong codes and then refuses the guesses', () => {
        const { connect } = boot();

        for (let attempt = 0; attempt < JOIN_FAILURE_LIMIT; attempt += 1) {
            send(connect(), 'JOIN_ROOM', { name: `Probe ${attempt}`, roomId: `CODE${attempt}` });
        }

        const last = connect();
        send(last, 'JOIN_ROOM', { name: 'Probe', roomId: 'ONEMORE' });

        expect(lastMessage(last, 'ERROR')?.payload.code).toBe('RATE_LIMITED');
    });

    it('audits a code that matched no room', () => {
        const log = vi.spyOn(console, 'info').mockImplementation(() => {});

        const { connect } = boot();
        send(connect(), 'JOIN_ROOM', { name: 'Probe', roomId: 'ZZZZZZ' });

        const records = log.mock.calls.map((call) => JSON.parse(String(call[0])));
        expect(records).toContainEqual(
            expect.objectContaining({ action: 'join.rejected.room-not-found', outcome: 'denied' })
        );
        log.mockRestore();
    });

    it('counts a code once however often it is retyped', () => {
        // A shared address is not barred by its own users retyping one code.
        const { connect } = boot();

        for (let attempt = 0; attempt < JOIN_FAILURE_LIMIT * 2; attempt += 1) {
            send(connect(), 'JOIN_ROOM', { name: 'Retyper', roomId: 'ZZZZZZ' });
        }

        const honest = connect();
        send(honest, 'JOIN_ROOM', { name: 'Honest', roomId: 'ZZZZZZ' });

        expect(lastMessage(honest, 'ERROR')?.payload.code).toBe('ROOM_NOT_FOUND');
    });

    it('still admits a code that exists once the budget is spent', () => {
        // The bar is for guessing, never for joining: a room that exists is
        // looked up before the budget is consulted.
        const { connect } = boot();

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        for (let attempt = 0; attempt < JOIN_FAILURE_LIMIT; attempt += 1) {
            send(connect(), 'JOIN_ROOM', { name: `Probe ${attempt}`, roomId: `CODE${attempt}` });
        }

        const participant = connect();
        send(participant, 'JOIN_ROOM', { name: 'Bob', roomId });

        expect(lastMessage(participant, 'ERROR')).toBeUndefined();
        expect(participantIdOf(participant)).toBeTruthy();
    });

    it('does not let a successful join buy more misses', () => {
        // Room creation is open to anybody, so a reset on success would be an
        // oracle: spend the budget minus one on guesses, join a room of its own,
        // and start again with a full allowance.
        const { connect } = boot();

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        for (let attempt = 0; attempt < JOIN_FAILURE_LIMIT - 1; attempt += 1) {
            send(connect(), 'JOIN_ROOM', { name: `Miss ${attempt}`, roomId: `CODE${attempt}` });
        }

        send(connect(), 'JOIN_ROOM', { name: 'Bob', roomId });
        send(connect(), 'JOIN_ROOM', { name: 'Probe', roomId: 'LASTONE' });

        const last = connect();
        send(last, 'JOIN_ROOM', { name: 'Probe again', roomId: 'ANOTHER' });
        expect(lastMessage(last, 'ERROR')?.payload.code).toBe('RATE_LIMITED');
    });
});

describe('Join challenge', () => {
    /** A verifier whose check always succeeds, standing in for Cloudflare. */
    const accepting = (): TurnstileVerifier =>
        new TurnstileVerifier(
            'secret',
            'https://example.invalid/siteverify',
            async () => new Response(JSON.stringify({ success: true }), { status: 200 })
        );

    /** A verifier whose check always fails. */
    const rejecting = (): TurnstileVerifier =>
        new TurnstileVerifier(
            'secret',
            'https://example.invalid/siteverify',
            async () => new Response(JSON.stringify({ success: false }), { status: 200 })
        );

    it('leaves joins open when no secret is configured', async () => {
        const { connect } = boot();

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        const participant = connect();
        await sendAndSettle(participant, 'JOIN_ROOM', { name: 'Bob', roomId });

        expect(lastMessage(participant, 'ERROR')).toBeUndefined();
        expect(participantIdOf(participant)).toBeTruthy();
    });

    it('asks a fresh participant to solve the challenge', async () => {
        const { connect } = boot({ turnstile: accepting() });

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        const participant = connect();
        await sendAndSettle(participant, 'JOIN_ROOM', { name: 'Bob', roomId });

        expect(lastMessage(participant, 'ERROR')?.payload.code).toBe('CHALLENGE_FAILED');
        expect(participant.userId).toBeUndefined();
    });

    it('admits a participant that solved it', async () => {
        const { connect } = boot({ turnstile: accepting() });

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        const participant = connect();
        await sendAndSettle(participant, 'JOIN_ROOM', {
            name: 'Bob',
            roomId,
            turnstileToken: 'a-token',
        });

        expect(lastMessage(participant, 'ERROR')).toBeUndefined();
        expect(participantIdOf(participant)).toBeTruthy();
    });

    it('refuses a token the verifier rejects', async () => {
        const { connect } = boot({ turnstile: rejecting() });

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        const participant = connect();
        await sendAndSettle(participant, 'JOIN_ROOM', {
            name: 'Bob',
            roomId,
            turnstileToken: 'a-token',
        });

        expect(lastMessage(participant, 'ERROR')?.payload.code).toBe('CHALLENGE_FAILED');
    });

    it('refuses the same token twice', async () => {
        // Turnstile tokens are single-use, so a captured one cannot be replayed.
        const { connect } = boot({ turnstile: accepting() });

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        const first = connect();
        await sendAndSettle(first, 'JOIN_ROOM', {
            name: 'First',
            roomId,
            turnstileToken: 'a-token',
        });
        expect(lastMessage(first, 'ERROR')).toBeUndefined();

        const second = connect();
        await sendAndSettle(second, 'JOIN_ROOM', {
            name: 'Second',
            roomId,
            turnstileToken: 'a-token',
        });

        expect(lastMessage(second, 'ERROR')?.payload.code).toBe('CHALLENGE_FAILED');
    });

    it('does not ask a reconnecting participant to solve it again', async () => {
        const { connect } = boot({ turnstile: accepting() });

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        const solved = connect();
        await sendAndSettle(solved, 'JOIN_ROOM', {
            name: 'Bob',
            roomId,
            turnstileToken: 'a-token',
        });
        const bobToken = tokenOf(solved);
        const bobId = participantIdOf(solved);

        const reconnecting = connect();
        await sendAndSettle(reconnecting, 'JOIN_ROOM', {
            name: 'Bob',
            roomId,
            sessionToken: bobToken,
            userId: bobId,
        });

        expect(lastMessage(reconnecting, 'ERROR')).toBeUndefined();
        expect(participantIdOf(reconnecting)).toBe(bobId);
    });
});

describe('Ended sessions', () => {
    it('accepts no further votes once the host ended the session', () => {
        const { connect } = boot();

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        const bob = connect();
        send(bob, 'JOIN_ROOM', { name: 'Bob', roomId });

        send(host, 'END_SESSION', {});
        bob.sent.length = 0;

        send(bob, 'VOTE', { vote: 5 });

        const error = lastMessage(bob, 'ERROR');
        expect(error?.payload.code).toBe('SESSION_ENDED');
    });

    it('takes no new participant once the session has ended', () => {
        const { connect } = boot();

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        send(host, 'END_SESSION', {});

        const latecomer = connect();
        send(latecomer, 'JOIN_ROOM', { name: 'Late', roomId });

        expect(lastMessage(latecomer, 'ERROR')?.payload.code).toBe('SESSION_ENDED');
        expect(latecomer.userId).toBeUndefined();
    });
});

describe('Kick ban, end to end', () => {
    it('refuses the rejoin the kicked client attempts with its own token', () => {
        const { connect } = boot();

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const hostToken = tokenOf(host);
        const roomId = roomIdOf(host);
        expect(roomId).toMatch(/^[A-Z0-9]{8}$/);

        const bob = connect();
        send(bob, 'JOIN_ROOM', { name: 'Bob', roomId });
        const bobToken = tokenOf(bob);
        const bobId = participantIdOf(bob);
        expect(bobToken).toBeTruthy();
        expect(bobId).toBeDefined();

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
            const roomId = roomIdOf(host);

            const bob = connect();
            send(bob, 'JOIN_ROOM', { name: 'Bob', roomId });
            const bobToken = tokenOf(bob);
            const bobId = participantIdOf(bob);

            send(host, 'KICK_PARTICIPANT', { targetUserId: bobId });

            // Still barred with the very token that was revoked.
            const barred = connect();
            send(barred, 'JOIN_ROOM', { name: 'Bob', roomId, sessionToken: bobToken });
            expect(lastMessage(barred, 'ERROR')?.payload.code).toBe('BANNED');

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
        const roomId = roomIdOf(host);

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

describe('Message throttle, end to end', () => {
    it('disconnects the socket instead of answering every message', () => {
        const { connect } = boot();

        // Creating the room already spends one message of the allowance.
        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });

        const spent = 1;
        for (let i = spent; i < WS_THROTTLE_MAX_MESSAGES; i += 1) {
            send(host, 'TOGGLE_AUTO_REVEAL', {});
        }
        send(host, 'TOGGLE_AUTO_REVEAL', {});

        expect(messagesOf(host, 'ERROR')).toHaveLength(1);
        expect(lastMessage(host, 'ERROR')?.payload.code).toBe('RATE_LIMITED');
        // 1008: WebSocket policy violation.
        expect(host.closeCodes).toEqual([1008]);

        // Whatever the socket keeps sending is never answered again.
        for (let i = 0; i < 5; i += 1) {
            send(host, 'TOGGLE_AUTO_REVEAL', {});
        }
        expect(messagesOf(host, 'ERROR')).toHaveLength(1);
        expect(host.closeCodes).toEqual([1008]);
    });

    it('ignores frames that arrive once the socket is closing', () => {
        const { connect } = boot();

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });

        // Spend the whole allowance and go one frame over, which closes it.
        for (let i = 1; i < WS_THROTTLE_MAX_MESSAGES; i += 1) {
            send(host, 'TOGGLE_AUTO_REVEAL', {});
        }
        send(host, 'TOGGLE_AUTO_REVEAL', {});
        expect(messagesOf(host, 'ERROR')).toHaveLength(1);

        // Whatever is still in flight must not reach the audit log again.
        const auditLines = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        for (let i = 0; i < 5; i += 1) {
            send(host, 'TOGGLE_AUTO_REVEAL', {});
        }
        auditLines.mockRestore();

        expect(messagesOf(host, 'ERROR')).toHaveLength(1);
    });

    it('does not disconnect a socket that stays inside the allowance', () => {
        const { connect } = boot();

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });

        for (let i = 0; i < WS_THROTTLE_MAX_MESSAGES - 1; i += 1) {
            send(host, 'TOGGLE_AUTO_REVEAL', {});
        }

        expect(messagesOf(host, 'ERROR')).toHaveLength(0);
        expect(host.closeCodes).toEqual([]);
    });
});

/** Identities a browser would carry, shaped as the server mints them. */
const HOST_CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const BOB_CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const CAROL_CLIENT_ID = '33333333-3333-4333-8333-333333333333';

describe('Kick ban against a browser profile', () => {
    it('still bars a rejoin that presents no token at all', () => {
        const { connect } = boot();

        const host = connect({ clientId: HOST_CLIENT_ID });
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        const bob = connect({ clientId: BOB_CLIENT_ID });
        send(bob, 'JOIN_ROOM', { name: 'Bob', roomId });
        const bobId = participantIdOf(bob);

        send(host, 'KICK_PARTICIPANT', { targetUserId: bobId });

        // A fresh tab: no Origin-less escape, no token, same browser.
        const bobAgain = connect({ clientId: BOB_CLIENT_ID });
        send(bobAgain, 'JOIN_ROOM', { name: 'Bob', roomId });

        expect(lastMessage(bobAgain, 'ERROR')?.payload.code).toBe('BANNED');
        expect(bobAgain.userId).toBeUndefined();
    });

    it('lets a different browser through', () => {
        const { connect } = boot();

        const host = connect({ clientId: HOST_CLIENT_ID });
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        const bob = connect({ clientId: BOB_CLIENT_ID });
        send(bob, 'JOIN_ROOM', { name: 'Bob', roomId });
        const bobId = participantIdOf(bob);

        send(host, 'KICK_PARTICIPANT', { targetUserId: bobId });

        const newcomer = connect({ clientId: CAROL_CLIENT_ID });
        send(newcomer, 'JOIN_ROOM', { name: 'Carol', roomId });

        expect(lastMessage(newcomer, 'SESSION')).toBeDefined();
        expect(newcomer.userId).toBeTruthy();
    });

    it('releases the profile once the bar expires', () => {
        vi.useFakeTimers();
        try {
            const { connect } = boot();

            const host = connect({ clientId: HOST_CLIENT_ID });
            send(host, 'CREATE_ROOM', { name: 'Alice' });
            const roomId = roomIdOf(host);

            const bob = connect({ clientId: BOB_CLIENT_ID });
            send(bob, 'JOIN_ROOM', { name: 'Bob', roomId });
            const bobId = participantIdOf(bob);

            send(host, 'KICK_PARTICIPANT', { targetUserId: bobId });
            const barred = connect({ clientId: BOB_CLIENT_ID });
            send(barred, 'JOIN_ROOM', { name: 'Bob', roomId });
            expect(lastMessage(barred, 'ERROR')?.payload.code).toBe('BANNED');

            vi.advanceTimersByTime(KICK_BAN_DURATION_MS + 1);

            const bobAgain = connect({ clientId: BOB_CLIENT_ID });
            send(bobAgain, 'JOIN_ROOM', { name: 'Bob', roomId });

            expect(lastMessage(bobAgain, 'SESSION')).toBeDefined();
            expect(bobAgain.userId).not.toBe(bobId);
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('Throttle before parsing', () => {
    it('charges a malformed frame against the budget', () => {
        const { connect } = boot();

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });

        // Creating the room already spent one message of the allowance.
        for (let i = 1; i < WS_THROTTLE_MAX_MESSAGES; i += 1) {
            host.emit('message', 'not json at all');
        }

        expect(messagesOf(host, 'ERROR')).toHaveLength(WS_THROTTLE_MAX_MESSAGES - 1);

        // The one frame that goes over is the one that pays for the disconnect.
        host.emit('message', 'still not json');
        expect(messagesOf(host, 'ERROR')).toHaveLength(WS_THROTTLE_MAX_MESSAGES);
        expect(host.closeCodes).toEqual([1008]);
    });

    it('charges an unknown message type against the budget', () => {
        const { connect } = boot();

        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });

        for (let i = 1; i < WS_THROTTLE_MAX_MESSAGES; i += 1) {
            host.emit('message', JSON.stringify({ payload: {}, type: 'NOT_A_TYPE' }));
        }
        expect(messagesOf(host, 'ERROR')).toHaveLength(WS_THROTTLE_MAX_MESSAGES - 1);

        host.emit('message', JSON.stringify({ payload: {}, type: 'NOT_A_TYPE' }));
        expect(messagesOf(host, 'ERROR')).toHaveLength(WS_THROTTLE_MAX_MESSAGES);
        expect(host.closeCodes).toEqual([1008]);
    });
});
