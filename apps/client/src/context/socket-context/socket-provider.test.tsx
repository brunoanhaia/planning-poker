import { Participant, RoomState } from '@planitpoker/shared';
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../i18n/i18n-provider';
import { SocketProvider } from './socket-provider';
import { useSocket } from './use-socket';

/** Minimal stand-in for the browser WebSocket, driven by the test. */
class FakeWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    static instances: FakeWebSocket[] = [];

    readonly url: string;
    readyState = FakeWebSocket.CONNECTING;
    sent: string[] = [];
    onclose: ((event: { code: number }) => void) | null = null;
    onerror: ((error: unknown) => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;
    onopen: (() => void) | null = null;

    constructor(url: string) {
        this.url = url;
        FakeWebSocket.instances.push(this);
    }

    close(): void {
        this.readyState = FakeWebSocket.CLOSED;
    }

    /** Simulates the transport dropping: the browser fires `close`. */
    drop(): void {
        this.dropWithCode(1006);
    }

    /** Simulates the server closing the socket with a specific close code. */
    dropWithCode(code: number): void {
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.({ code });
    }

    /** Simulates the server accepting the connection. */
    open(): void {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.();
    }

    receive(payload: unknown): void {
        this.onmessage?.({ data: JSON.stringify(payload) });
    }

    send(data: string): void {
        this.sent.push(data);
    }
}

const participant: Participant = {
    avatar: '🦊',
    color: '#000000',
    hasVoted: false,
    id: 'u1',
    isAdmin: false,
    isHost: true,
    isOnline: true,
    isSpectator: false,
    name: 'Ana',
    vote: null,
};

const room: RoomState = {
    activeDeck: [1, 2, 3, 5, 8],
    autoReveal: false,
    createdAt: Date.now(),
    currentStoryIndex: 0,
    deckType: 'fibonacci',
    endedAt: null,
    hostId: 'u1',
    id: 'ROOM01',
    isEnded: false,
    isLocked: false,
    participants: [participant],
    stories: [],
    timer: null,
    title: 'Sprint 10',
    votesRevealed: false,
};

/** Renders the connection state the provider exposes. */
const Probe = () => {
    const {
        connectionStatus,
        createRoom,
        error,
        joinRoom,
        leaveRoom,
        pendingEntry,
        retryConnection,
        roomState,
        storedRoomStatus,
    } = useSocket();
    return (
        <>
            <span>{roomState ? 'room' : 'lobby'}</span>
            <span>{error ?? ''}</span>
            <span data-testid="connection">{connectionStatus}</span>
            <span data-testid="pending">{pendingEntry ?? 'none'}</span>
            <span data-testid="stored-room">{storedRoomStatus}</span>
            <button onClick={leaveRoom} type="button">
                leave
            </button>
            <button onClick={() => createRoom('Ana', 'avatar-1', '#1890ff')} type="button">
                create
            </button>
            <button onClick={retryConnection} type="button">
                retry
            </button>
            <button onClick={() => joinRoom('ROOM01', 'Ana', 'avatar-1', '#1890ff')} type="button">
                join
            </button>
            <button onClick={() => joinRoom('room01', 'Ana', 'avatar-1', '#1890ff')} type="button">
                join-lowercase
            </button>
            <button onClick={() => joinRoom('ROOM02', 'Ana', 'avatar-1', '#1890ff')} type="button">
                join-other
            </button>
        </>
    );
};

const renderProbe = () =>
    render(
        <I18nProvider>
            <SocketProvider>
                <Probe />
            </SocketProvider>
        </I18nProvider>
    );

/** Opens the first socket and puts the client inside a room with a token. */
const enterRoom = (): FakeWebSocket => {
    const socket = FakeWebSocket.instances[0];
    act(() => {
        socket.open();
    });
    act(() => {
        socket.receive({ payload: { sessionToken: 'tok', userId: 'u1' }, type: 'SESSION' });
    });
    act(() => {
        socket.receive({
            payload: { currentUserId: 'u1', roomState: room },
            type: 'ROOM_STATE',
        });
    });
    return socket;
};

describe('SocketProvider reconnection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        FakeWebSocket.instances = [];
        vi.stubGlobal('WebSocket', FakeWebSocket);
        sessionStorage.clear();
        localStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('sends nothing on a first connection, before a room exists', () => {
        renderProbe();

        act(() => {
            FakeWebSocket.instances[0].open();
        });

        expect(FakeWebSocket.instances[0].sent).toEqual([]);
    });

    it('rejoins with the stored session after the transport drops', () => {
        renderProbe();
        const first = enterRoom();

        act(() => {
            first.drop();
        });
        act(() => {
            vi.advanceTimersByTime(2000);
        });

        const second = FakeWebSocket.instances[1];
        act(() => {
            second.open();
        });

        expect(JSON.parse(second.sent[0])).toEqual({
            payload: {
                avatar: '🦊',
                color: '#000000',
                name: 'Ana',
                roomId: 'ROOM01',
                sessionToken: 'tok',
                userId: 'u1',
            },
            type: 'JOIN_ROOM',
        });
    });

    it('reuses the stored room token from a fresh tab', () => {
        // A second tab of the same browser has an empty session storage but the
        // room token local storage kept, so it must rebind the same participant.
        localStorage.setItem('planit_room_token:ROOM01', 'tok-room');
        renderProbe();
        const socket = FakeWebSocket.instances[0];
        act(() => {
            socket.open();
        });

        act(() => {
            screen.getByRole('button', { name: 'join' }).click();
        });

        expect(JSON.parse(socket.sent[0])).toEqual({
            payload: {
                avatar: 'avatar-1',
                color: '#1890ff',
                name: 'Ana',
                previousRoomToken: null,
                roomId: 'ROOM01',
                sessionToken: 'tok-room',
                userId: null,
            },
            type: 'JOIN_ROOM',
        });
    });

    it('persists the token under the room key once the room is entered', () => {
        renderProbe();
        enterRoom();

        expect(sessionStorage.getItem('planit_session_token')).toBe('tok');
        expect(localStorage.getItem('planit_room_token:ROOM01')).toBe('tok');
    });

    it('normalizes a lowercase room code before looking up the stored token', () => {
        // The server canonicalizes room ids to uppercase, so the token written
        // when this browser first joined is keyed under `ROOM01`. A lowercase
        // code typed elsewhere must still find it instead of minting a stranger.
        localStorage.setItem('planit_room_token:ROOM01', 'tok-room');
        renderProbe();
        const socket = FakeWebSocket.instances[0];
        act(() => {
            socket.open();
        });

        act(() => {
            screen.getByRole('button', { name: 'join-lowercase' }).click();
        });

        expect(JSON.parse(socket.sent[0])).toMatchObject({
            payload: { roomId: 'ROOM01', sessionToken: 'tok-room' },
            type: 'JOIN_ROOM',
        });
    });

    it('stops reconnecting and shows a notice when another tab takes over', () => {
        renderProbe();
        const first = enterRoom();

        act(() => {
            first.dropWithCode(4001);
        });
        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(screen.getByText('lobby')).toBeInTheDocument();
        expect(
            screen.getByText('This room was opened in another tab. This tab stopped updating.')
        ).toBeInTheDocument();
        // The surviving tab owns the token, so this tab must not delete it.
        expect(sessionStorage.getItem('planit_session_token')).toBe('tok');
        expect(localStorage.getItem('planit_room_token:ROOM01')).toBe('tok');
    });

    it('stops reconnecting and drops the room token when the browser switches rooms', () => {
        renderProbe();
        const first = enterRoom();

        act(() => {
            first.dropWithCode(4002);
        });
        act(() => {
            vi.advanceTimersByTime(5000);
        });

        expect(FakeWebSocket.instances).toHaveLength(1);
        expect(screen.getByText('lobby')).toBeInTheDocument();
        expect(
            screen.getByText(
                'This session ended because the room was opened somewhere else in this browser.'
            )
        ).toBeInTheDocument();
        // The server removed this participant, so the token cannot be replayed.
        expect(sessionStorage.getItem('planit_session_token')).toBeNull();
        expect(localStorage.getItem('planit_room_token:ROOM01')).toBeNull();
        // The room that took over owns the record; this tab must not clear it.
        expect(localStorage.getItem('planit_active_room')).toBe('ROOM01');
    });

    it('remembers the active room once the room is entered', () => {
        renderProbe();
        enterRoom();

        expect(localStorage.getItem('planit_active_room')).toBe('ROOM01');
    });

    it('forgets the active room when the user leaves', () => {
        renderProbe();
        enterRoom();

        act(() => {
            screen.getByRole('button', { name: 'leave' }).click();
        });

        expect(localStorage.getItem('planit_active_room')).toBeNull();
    });

    it('forgets the active room when the user is kicked', () => {
        renderProbe();
        const socket = enterRoom();

        act(() => {
            socket.receive({ payload: {}, type: 'KICKED' });
        });

        expect(localStorage.getItem('planit_active_room')).toBeNull();
    });

    it('clears both storages when the user is kicked', () => {
        renderProbe();
        const socket = enterRoom();

        act(() => {
            socket.receive({ payload: {}, type: 'KICKED' });
        });

        expect(screen.getByText('lobby')).toBeInTheDocument();
        expect(sessionStorage.getItem('planit_session_token')).toBeNull();
        expect(localStorage.getItem('planit_room_token:ROOM01')).toBeNull();
    });

    it('keeps the room token in both storages when the user leaves', () => {
        renderProbe();
        enterRoom();

        act(() => {
            screen.getByRole('button', { name: 'leave' }).click();
        });

        expect(screen.getByText('lobby')).toBeInTheDocument();
        expect(sessionStorage.getItem('planit_session_token')).toBe('tok');
        expect(localStorage.getItem('planit_room_token:ROOM01')).toBe('tok');
    });

    it('resets a session the server rejects and shows the translated notice', () => {
        renderProbe();
        const first = enterRoom();

        act(() => {
            first.drop();
        });
        act(() => {
            vi.advanceTimersByTime(2000);
        });

        const second = FakeWebSocket.instances[1];
        act(() => {
            second.open();
        });
        expect(screen.getByText('room')).toBeInTheDocument();

        act(() => {
            second.receive({
                payload: { code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
                type: 'ERROR',
            });
        });

        expect(screen.getByText('lobby')).toBeInTheDocument();
        expect(screen.getByText('Room not found. Please check the room code.')).toBeInTheDocument();
        expect(sessionStorage.getItem('planit_session_token')).toBeNull();
    });

    it.each(['BANNED', 'NO_SESSION'] as const)(
        'clears the stored session when the server answers %s',
        (code) => {
            renderProbe();
            const socket = enterRoom();

            act(() => {
                socket.receive({ payload: { code, message: 'rejected' }, type: 'ERROR' });
            });

            expect(screen.getByText('lobby')).toBeInTheDocument();
            expect(sessionStorage.getItem('planit_session_token')).toBeNull();
        }
    );

    it('keeps the stored session when a lobby join is rejected as not found', () => {
        // The user left a room but kept its token; a mistyped code on the lobby
        // must not cost them the participant that only that token can rebind.
        sessionStorage.setItem('planit_session_token', 'tok');
        renderProbe();
        const socket = FakeWebSocket.instances[0];
        act(() => {
            socket.open();
        });

        act(() => {
            socket.receive({
                payload: { code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
                type: 'ERROR',
            });
        });

        expect(screen.getByText('lobby')).toBeInTheDocument();
        expect(sessionStorage.getItem('planit_session_token')).toBe('tok');
    });

    it('checks the stored room on connect and drops it when the server says it is gone', () => {
        // The browser still records a room the server lost (an idle sweep or a
        // restart). The preflight must drop that record instead of showing the
        // switch dialog forever.
        localStorage.setItem('planit_active_room', 'ROOM01');
        localStorage.setItem('planit_room_token:ROOM01', 'tok-room');
        sessionStorage.setItem('planit_session_token', 'tok-room');
        renderProbe();
        const socket = FakeWebSocket.instances[0];
        act(() => {
            socket.open();
        });

        expect(JSON.parse(socket.sent[0])).toEqual({
            payload: { roomId: 'ROOM01' },
            type: 'CHECK_ROOM',
        });

        act(() => {
            socket.receive({
                payload: { exists: false, roomId: 'ROOM01' },
                type: 'ROOM_STATUS',
            });
        });

        expect(localStorage.getItem('planit_active_room')).toBeNull();
        expect(localStorage.getItem('planit_room_token:ROOM01')).toBeNull();
        expect(sessionStorage.getItem('planit_session_token')).toBeNull();
        expect(screen.getByTestId('stored-room')).toHaveTextContent('gone');
    });

    it('keeps the stored room when the preflight says it exists', () => {
        localStorage.setItem('planit_active_room', 'ROOM01');
        localStorage.setItem('planit_room_token:ROOM01', 'tok-room');
        sessionStorage.setItem('planit_session_token', 'tok-room');
        renderProbe();
        const socket = FakeWebSocket.instances[0];
        act(() => {
            socket.open();
        });

        act(() => {
            socket.receive({
                payload: { exists: true, roomId: 'ROOM01' },
                type: 'ROOM_STATUS',
            });
        });

        expect(localStorage.getItem('planit_active_room')).toBe('ROOM01');
        expect(localStorage.getItem('planit_room_token:ROOM01')).toBe('tok-room');
        expect(sessionStorage.getItem('planit_session_token')).toBe('tok-room');
        expect(screen.getByTestId('stored-room')).toHaveTextContent('exists');
    });

    it('clears the active room when the join still reports it as not found', () => {
        // The room can disappear between the check and the join; the join
        // rejection is the fallback that still clears the record.
        localStorage.setItem('planit_active_room', 'ROOM01');
        localStorage.setItem('planit_room_token:ROOM01', 'tok-room');
        sessionStorage.setItem('planit_session_token', 'tok-room');
        renderProbe();
        const socket = FakeWebSocket.instances[0];
        act(() => {
            socket.open();
        });
        act(() => {
            socket.receive({
                payload: { exists: true, roomId: 'ROOM01' },
                type: 'ROOM_STATUS',
            });
        });
        act(() => {
            screen.getByRole('button', { name: 'join' }).click();
        });

        act(() => {
            socket.receive({
                payload: { code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
                type: 'ERROR',
            });
        });

        expect(localStorage.getItem('planit_active_room')).toBeNull();
        expect(localStorage.getItem('planit_room_token:ROOM01')).toBeNull();
        expect(sessionStorage.getItem('planit_session_token')).toBeNull();
        expect(
            screen.getByText('That session no longer exists. Start a new one.')
        ).toBeInTheDocument();
        expect(screen.getByTestId('stored-room')).toHaveTextContent('gone');
    });

    it('falls back to the session when the preflight times out', () => {
        localStorage.setItem('planit_active_room', 'ROOM01');
        localStorage.setItem('planit_room_token:ROOM01', 'tok-room');
        renderProbe();
        act(() => {
            FakeWebSocket.instances[0].open();
        });

        act(() => {
            vi.advanceTimersByTime(3000);
        });

        expect(localStorage.getItem('planit_active_room')).toBe('ROOM01');
        expect(localStorage.getItem('planit_room_token:ROOM01')).toBe('tok-room');
        expect(screen.getByTestId('stored-room')).toHaveTextContent('exists');
    });

    it('keeps the active room when a different code is not found', () => {
        // A mistyped lobby code must not cost the browser the session it still
        // holds, so the active record and both tokens survive.
        localStorage.setItem('planit_active_room', 'ROOM01');
        localStorage.setItem('planit_room_token:ROOM01', 'tok-room');
        sessionStorage.setItem('planit_session_token', 'tok-room');
        renderProbe();
        const socket = FakeWebSocket.instances[0];
        act(() => {
            socket.open();
        });
        act(() => {
            socket.receive({
                payload: { exists: true, roomId: 'ROOM01' },
                type: 'ROOM_STATUS',
            });
        });
        act(() => {
            screen.getByRole('button', { name: 'join-other' }).click();
        });

        act(() => {
            socket.receive({
                payload: { code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
                type: 'ERROR',
            });
        });

        expect(localStorage.getItem('planit_active_room')).toBe('ROOM01');
        expect(localStorage.getItem('planit_room_token:ROOM01')).toBe('tok-room');
        expect(sessionStorage.getItem('planit_session_token')).toBe('tok-room');
        expect(screen.getByText('Room not found. Please check the room code.')).toBeInTheDocument();
    });

    it('keeps the credential when the user leaves, so nothing rejoins on its own', () => {
        renderProbe();
        const first = enterRoom();

        act(() => {
            screen.getByRole('button', { name: 'leave' }).click();
        });
        expect(screen.getByText('lobby')).toBeInTheDocument();
        // The server keeps the participant and only this token can rebind it, so
        // dropping it here would mint a duplicate on the next manual join.
        expect(sessionStorage.getItem('planit_session_token')).toBe('tok');

        act(() => {
            first.drop();
        });
        act(() => {
            vi.advanceTimersByTime(2000);
        });

        const second = FakeWebSocket.instances[1];
        act(() => {
            second.open();
        });

        expect(second.sent).toEqual([]);
    });

    it('proves the room it is leaving when another room opens', () => {
        renderProbe();
        const socket = enterRoom();

        // Another tab of this browser is the one holding room 2; joining room 1
        // from here has to hand the server room 2's token so it can end it.
        localStorage.setItem('planit_active_room', 'ROOM02');
        localStorage.setItem('planit_room_token:ROOM02', 'tok-room2');

        act(() => {
            screen.getByRole('button', { name: 'join' }).click();
        });

        const frame = JSON.parse(socket.sent[0]);
        expect(frame.payload).toMatchObject({
            previousRoomToken: 'tok-room2',
            roomId: 'ROOM01',
        });
    });

    it('rejoins with the kept token and no user id after leaving', () => {
        renderProbe();
        const socket = enterRoom();

        act(() => {
            screen.getByRole('button', { name: 'leave' }).click();
        });
        act(() => {
            screen.getByRole('button', { name: 'join' }).click();
        });

        expect(socket.sent).toHaveLength(1);
        const frame = JSON.parse(socket.sent[0]);
        expect(frame.type).toBe('JOIN_ROOM');
        expect(frame.payload).toEqual({
            avatar: 'avatar-1',
            color: '#1890ff',
            name: 'Ana',
            previousRoomToken: null,
            roomId: 'ROOM01',
            sessionToken: 'tok',
            userId: null,
        });
    });

    it('drops a notice raised on the lobby once the room is entered', () => {
        renderProbe();
        const socket = FakeWebSocket.instances[0];
        act(() => {
            socket.open();
        });

        act(() => {
            socket.receive({
                payload: { code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
                type: 'ERROR',
            });
        });
        expect(screen.getByText('Room not found. Please check the room code.')).toBeInTheDocument();

        act(() => {
            socket.receive({
                payload: { currentUserId: 'u1', roomState: room },
                type: 'ROOM_STATE',
            });
        });

        expect(screen.getByText('room')).toBeInTheDocument();
        expect(screen.queryByText('Room not found. Please check the room code.')).toBeNull();
    });

    it('queues a create while connecting and sends it once when the socket opens', () => {
        renderProbe();
        const socket = FakeWebSocket.instances[0];

        act(() => {
            screen.getByRole('button', { name: 'create' }).click();
        });

        expect(socket.sent).toHaveLength(0);
        expect(screen.getByTestId('pending')).toHaveTextContent('create');

        // A double click while the request is queued must not enqueue another.
        act(() => {
            screen.getByRole('button', { name: 'create' }).click();
        });
        act(() => {
            socket.open();
        });

        const frames = socket.sent.map((frame) => JSON.parse(frame));
        expect(frames).toHaveLength(1);
        expect(frames[0].type).toBe('CREATE_ROOM');

        // The spinner stays until the server confirms the room.
        expect(screen.getByTestId('pending')).toHaveTextContent('create');
        act(() => {
            socket.receive({
                payload: { currentUserId: 'u1', roomState: room },
                type: 'ROOM_STATE',
            });
        });
        expect(screen.getByTestId('pending')).toHaveTextContent('none');
    });

    it('ignores a second create after the first one is in flight', () => {
        renderProbe();
        const socket = FakeWebSocket.instances[0];
        act(() => {
            socket.open();
        });

        act(() => {
            screen.getByRole('button', { name: 'create' }).click();
        });
        act(() => {
            screen.getByRole('button', { name: 'create' }).click();
        });

        expect(socket.sent).toHaveLength(1);
    });

    it('keeps a queued create across a drop before it is sent', () => {
        renderProbe();
        act(() => {
            screen.getByRole('button', { name: 'create' }).click();
        });
        const first = FakeWebSocket.instances[0];

        act(() => {
            first.drop();
        });
        act(() => {
            vi.advanceTimersByTime(2000);
        });

        const second = FakeWebSocket.instances[1];
        act(() => {
            second.open();
        });

        expect(second.sent).toHaveLength(1);
        expect(JSON.parse(second.sent[0]).type).toBe('CREATE_ROOM');
    });

    it('clears the pending entry when the server rejects the queued action', () => {
        renderProbe();
        const socket = FakeWebSocket.instances[0];
        act(() => {
            screen.getByRole('button', { name: 'create' }).click();
        });
        act(() => {
            socket.open();
        });

        act(() => {
            socket.receive({
                payload: { code: 'ROOM_LIMIT_REACHED', message: 'limit' },
                type: 'ERROR',
            });
        });

        expect(screen.getByTestId('pending')).toHaveTextContent('none');
        expect(screen.getByText('The server is at capacity. Try again later.')).toBeInTheDocument();
    });

    it('reports a slow connection as a cold start and clears it once open', () => {
        renderProbe();
        expect(screen.getByTestId('connection')).toHaveTextContent('connecting');

        act(() => {
            vi.advanceTimersByTime(4000);
        });
        expect(screen.getByTestId('connection')).toHaveTextContent('waking');

        act(() => {
            FakeWebSocket.instances[0].open();
        });
        expect(screen.getByTestId('connection')).toHaveTextContent('connected');
    });

    it('retries a socket that is stuck connecting', () => {
        renderProbe();
        const first = FakeWebSocket.instances[0];
        act(() => {
            vi.advanceTimersByTime(4000);
        });
        expect(screen.getByTestId('connection')).toHaveTextContent('waking');

        act(() => {
            screen.getByRole('button', { name: 'retry' }).click();
        });

        expect(FakeWebSocket.instances).toHaveLength(2);
        expect(first.readyState).toBe(FakeWebSocket.CLOSED);
        const second = FakeWebSocket.instances[1];
        act(() => {
            second.open();
        });
        expect(screen.getByTestId('connection')).toHaveTextContent('connected');
    });

    it('reports reconnecting after a drop and connected after the retry opens', () => {
        renderProbe();
        const first = enterRoom();
        act(() => {
            first.drop();
        });
        expect(screen.getByTestId('connection')).toHaveTextContent('reconnecting');

        act(() => {
            vi.advanceTimersByTime(2000);
        });
        const second = FakeWebSocket.instances[1];
        act(() => {
            second.open();
        });
        expect(screen.getByTestId('connection')).toHaveTextContent('connected');
    });

    it('keeps the wake deadline across failed reconnect attempts', () => {
        renderProbe();

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        act(() => {
            FakeWebSocket.instances[0].drop();
        });
        act(() => {
            vi.advanceTimersByTime(2000);
        });
        act(() => {
            FakeWebSocket.instances[1].drop();
        });
        act(() => {
            vi.advanceTimersByTime(1000);
        });

        // Four seconds after the first dial, even though a second dial failed
        // in between; a reset deadline would still be in `connecting`.
        expect(screen.getByTestId('connection')).toHaveTextContent('waking');

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        act(() => {
            FakeWebSocket.instances[2].drop();
        });
        expect(screen.getByTestId('connection')).toHaveTextContent('waking');
    });

    it('releases an abandoned in-flight entry when retry replaces the socket', () => {
        renderProbe();
        const first = FakeWebSocket.instances[0];
        act(() => {
            first.open();
        });
        act(() => {
            screen.getByRole('button', { name: 'create' }).click();
        });
        expect(first.sent).toHaveLength(1);

        // The socket is left closed without a close event, so the retry replaces
        // it and the old identity guard would never resolve the entry.
        first.readyState = FakeWebSocket.CLOSED;
        act(() => {
            screen.getByRole('button', { name: 'retry' }).click();
        });
        expect(screen.getByTestId('pending')).toHaveTextContent('none');

        const second = FakeWebSocket.instances[1];
        act(() => {
            second.open();
        });
        act(() => {
            screen.getByRole('button', { name: 'create' }).click();
        });

        expect(
            second.sent.filter((frame) => JSON.parse(frame).type === 'CREATE_ROOM')
        ).toHaveLength(1);
    });

    it('still handles a takeover close when the browser is offline', () => {
        renderProbe();
        const socket = enterRoom();

        act(() => {
            window.dispatchEvent(new Event('offline'));
        });
        act(() => {
            socket.dropWithCode(4001);
        });

        expect(screen.getByText('lobby')).toBeInTheDocument();
        expect(
            screen.getByText('This room was opened in another tab. This tab stopped updating.')
        ).toBeInTheDocument();
    });
});
