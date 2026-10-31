import { SESSION_REPLACED_CLOSE_CODE } from '@planitpoker/shared';
import { afterEach, describe, expect, it } from 'vitest';

import {
    boot,
    lastMessage,
    participantIdOf,
    roomIdOf,
    send,
    shutdownHandlers,
    tokenOf,
} from './support/socketHarness.js';

afterEach(() => {
    shutdownHandlers();
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
