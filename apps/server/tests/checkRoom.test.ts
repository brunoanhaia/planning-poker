import { afterEach, describe, expect, it } from 'vitest';

import { JOIN_FAILURE_LIMIT } from '../src/constants.js';
import { boot, lastMessage, messagesOf, send, shutdownHandlers } from './support/socketHarness.js';

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

    it('bars an address that spends the failed-join budget on unknown codes', () => {
        const { connect } = boot();
        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = lastMessage(host, 'ROOM_STATE')?.payload.roomState?.id;
        expect(roomId).toBeDefined();

        // The failed-join budget is per address, but the message throttle is per
        // socket; spread the probes so the test reaches the budget before the
        // socket allowance.
        const proberAddress = '203.0.113.9';
        let prober = connect({ remoteAddress: proberAddress });
        for (let index = 0; index < JOIN_FAILURE_LIMIT; index += 1) {
            if (index > 0 && index % 10 === 0) {
                prober = connect({ remoteAddress: proberAddress });
            }
            send(prober, 'CHECK_ROOM', { roomId: `ZZZ${String(index).padStart(5, '0')}` });
        }

        // The address is barred before the existing room is consulted, so the
        // check receives no existence answer at all.
        send(prober, 'CHECK_ROOM', { roomId });
        expect(lastMessage(prober, 'ERROR')?.payload.code).toBe('RATE_LIMITED');
        expect(messagesOf(prober, 'ROOM_STATUS').some((message) => message.payload.exists)).toBe(
            false
        );
    });
});
