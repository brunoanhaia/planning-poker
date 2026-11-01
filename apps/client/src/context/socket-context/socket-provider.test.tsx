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
    const { error, joinRoom, leaveRoom, roomState } = useSocket();
    return (
        <>
            <span>{roomState ? 'room' : 'lobby'}</span>
            <span>{error ?? ''}</span>
            <button onClick={leaveRoom} type="button">
                leave
            </button>
            <button onClick={() => joinRoom('ROOM01', 'Ana', 'avatar-1', '#1890ff')} type="button">
                join
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
});
