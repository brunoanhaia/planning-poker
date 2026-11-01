import { WS_MAX_BUFFERED_BYTES } from '@planitpoker/shared';
import { afterEach, describe, expect, it } from 'vitest';

import { boot, lastMessage, send, shutdownHandlers } from './support/socketHarness.js';

afterEach(() => {
    shutdownHandlers();
});

describe('WebSocket write backpressure', () => {
    it('drops a client whose buffer is past the cap instead of queueing more', () => {
        const { connect } = boot();

        const stalled = connect();
        stalled.bufferedAmount = WS_MAX_BUFFERED_BYTES + 1;
        send(stalled, 'CREATE_ROOM', { name: 'Alice' });

        // Nothing is written into a buffer that is already over the cap, and
        // the connection is terminated instead of kept for a client that has
        // stopped reading.
        expect(stalled.sent).toEqual([]);
        expect(stalled.readyState).toBe(3);

        // A client that reads its socket is served exactly as before.
        const healthy = connect();
        send(healthy, 'CREATE_ROOM', { name: 'Bob' });
        expect(lastMessage(healthy, 'SESSION')?.payload.sessionToken).toBeDefined();
        expect(lastMessage(healthy, 'ROOM_STATE')?.payload.roomState?.id).toBeDefined();
    });

    it('still writes to a client sitting exactly at the cap', () => {
        const { connect } = boot();

        const atCap = connect();
        atCap.bufferedAmount = WS_MAX_BUFFERED_BYTES;
        send(atCap, 'CREATE_ROOM', { name: 'Alice' });

        expect(lastMessage(atCap, 'SESSION')?.payload.sessionToken).toBeDefined();
        expect(atCap.readyState).toBe(1);
    });
});
