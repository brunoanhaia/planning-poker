import { afterEach, describe, expect, it } from 'vitest';

import { boot, lastMessage, send, shutdownHandlers } from './support/socketHarness.js';

afterEach(() => {
    shutdownHandlers();
});

describe('CHECK_ROOM preflight', () => {
    it('reports an existing room without seating the caller', () => {
        const { connect } = boot();
        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = lastMessage(host, 'ROOM_STATE')?.payload.roomState?.id;
        expect(roomId).toBeDefined();

        const lobby = connect();
        send(lobby, 'CHECK_ROOM', { roomId });

        expect(lastMessage(lobby, 'ROOM_STATUS')?.payload).toEqual({ exists: true, roomId });
        // A check is a read: the caller gets no session and no room binding.
        expect(lobby.roomId).toBeUndefined();
        expect(lobby.sent.some((message) => message.type === 'SESSION')).toBe(false);
    });

    it('reports a missing room without failing the connection', () => {
        const { connect } = boot();
        const lobby = connect();

        send(lobby, 'CHECK_ROOM', { roomId: 'ZZZZZZZZ' });

        expect(lastMessage(lobby, 'ROOM_STATUS')?.payload).toEqual({
            exists: false,
            roomId: 'ZZZZZZZZ',
        });
        expect(lastMessage(lobby, 'ERROR')).toBeUndefined();
    });

    it('rejects an empty room code', () => {
        const { connect } = boot();
        const lobby = connect();

        send(lobby, 'CHECK_ROOM', { roomId: '   ' });

        expect(lastMessage(lobby, 'ERROR')?.payload.code).toBe('INVALID_PAYLOAD');
        expect(lastMessage(lobby, 'ROOM_STATUS')).toBeUndefined();
    });
});
