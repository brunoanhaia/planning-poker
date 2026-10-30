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
    onclose: (() => void) | null = null;
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
        this.readyState = FakeWebSocket.CLOSED;
        this.onclose?.();
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
    const { error, roomState } = useSocket();
    return (
        <>
            <span>{roomState ? 'room' : 'lobby'}</span>
            <span>{error ?? ''}</span>
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
    act(() => socket.open());
    act(() => socket.receive({ payload: { sessionToken: 'tok', userId: 'u1' }, type: 'SESSION' }));
    act(() =>
        socket.receive({
            payload: { currentUserId: 'u1', roomState: room },
            type: 'ROOM_STATE',
        })
    );
    return socket;
};

describe('SocketProvider reconnection', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        FakeWebSocket.instances = [];
        vi.stubGlobal('WebSocket', FakeWebSocket);
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('sends nothing on a first connection, before a room exists', () => {
        renderProbe();

        act(() => FakeWebSocket.instances[0].open());

        expect(FakeWebSocket.instances[0].sent).toEqual([]);
    });

    it('rejoins with the stored session after the transport drops', () => {
        renderProbe();
        const first = enterRoom();

        act(() => first.drop());
        act(() => vi.advanceTimersByTime(2000));

        const second = FakeWebSocket.instances[1];
        act(() => second.open());

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

    it('resets a session the server rejects and shows the translated notice', () => {
        renderProbe();
        const first = enterRoom();

        act(() => first.drop());
        act(() => vi.advanceTimersByTime(2000));

        const second = FakeWebSocket.instances[1];
        act(() => second.open());
        expect(screen.getByText('room')).toBeInTheDocument();

        act(() =>
            second.receive({
                payload: { code: 'ROOM_NOT_FOUND', message: 'Room not found.' },
                type: 'ERROR',
            })
        );

        expect(screen.getByText('lobby')).toBeInTheDocument();
        expect(screen.getByText('Room not found. Please check the room code.')).toBeInTheDocument();
        expect(sessionStorage.getItem('planit_session_token')).toBeNull();
    });
});
