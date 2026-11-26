import { afterEach, describe, expect, it } from 'vitest';

import {
    boot,
    lastMessage,
    participantIdOf,
    roomIdOf,
    send,
    shutdownHandlers,
} from './support/socketHarness.js';

afterEach(() => {
    shutdownHandlers();
});

describe('Offline participants', () => {
    it('lets an admin drop the participants who disconnected', () => {
        const { connect } = boot();
        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);
        const hostId = participantIdOf(host);

        const guest = connect({ clientId: '22222222-2222-4222-8222-222222222222' });
        send(guest, 'JOIN_ROOM', { name: 'Bob', roomId });
        guest.emit('close');

        // The ghost is still in the roster until an administrator clears it.
        expect(lastMessage(host, 'ROOM_STATE')?.payload.roomState?.participants).toHaveLength(2);

        send(host, 'CLEAR_OFFLINE_PARTICIPANTS', {});

        const participants = lastMessage(host, 'ROOM_STATE')?.payload.roomState?.participants;
        expect(participants?.map((participant) => participant.id)).toEqual([hostId]);
    });

    it('refuses the cleanup for a participant who is not an administrator', () => {
        const { connect } = boot();
        const host = connect();
        send(host, 'CREATE_ROOM', { name: 'Alice' });
        const roomId = roomIdOf(host);

        const guest = connect({ clientId: '22222222-2222-4222-8222-222222222222' });
        send(guest, 'JOIN_ROOM', { name: 'Bob', roomId });
        guest.emit('close');

        const voter = connect({ clientId: '33333333-3333-4333-8333-333333333333' });
        send(voter, 'JOIN_ROOM', { name: 'Carol', roomId });
        send(voter, 'CLEAR_OFFLINE_PARTICIPANTS', {});

        expect(lastMessage(voter, 'ERROR')?.payload.code).toBe('FORBIDDEN');
        expect(lastMessage(host, 'ROOM_STATE')?.payload.roomState?.participants).toHaveLength(3);
    });
});
