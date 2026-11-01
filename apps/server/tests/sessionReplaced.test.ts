import { ROOM_SWITCHED_CLOSE_CODE, SESSION_REPLACED_CLOSE_CODE } from '@planitpoker/shared';
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

describe('Room switching', () => {
    it('ends the room a browser left when it opens another one', () => {
        const { connect } = boot();

        // The browser that will move rooms.
        const moving = connect({ clientId: '22222222-2222-4222-8222-222222222222' });
        send(moving, 'CREATE_ROOM', { name: 'Alice' });
        const leftRoomId = roomIdOf(moving);

        // A second browser keeps a window into the room being left, so the
        // eviction broadcast can be observed.
        const observer = connect({ clientId: '33333333-3333-4333-8333-333333333333' });
        send(observer, 'JOIN_ROOM', { name: 'Bob', roomId: leftRoomId });
        const observerParticipantId = participantIdOf(observer);

        // Another browser owns the room the first one is about to enter.
        const otherHost = connect({ clientId: '44444444-4444-4444-8444-444444444444' });
        send(otherHost, 'CREATE_ROOM', { name: 'Carol' });
        const nextRoomId = roomIdOf(otherHost);

        // The moving browser proves ownership of the room it leaves with its token.
        const moved = connect({ clientId: '22222222-2222-4222-8222-222222222222' });
        send(moved, 'JOIN_ROOM', {
            name: 'Alice',
            previousRoomToken: tokenOf(moving),
            roomId: nextRoomId,
        });

        // The socket that owned the old room is told why it lost the session.
        expect(moving.closes).toEqual([
            { code: ROOM_SWITCHED_CLOSE_CODE, reason: 'session moved' },
        ]);

        // The participant moved out of the room it left instead of lingering as
        // an offline row.
        const leftRoom = lastMessage(observer, 'ROOM_STATE')?.payload.roomState;
        expect(leftRoom?.id).toBe(leftRoomId);
        expect(leftRoom?.participants.map((it) => it.id)).toEqual([observerParticipantId]);

        // The browser appears once in the room it moved to, and still acts there.
        const movedParticipantId = participantIdOf(moved);
        const nextRoom = lastMessage(moved, 'ROOM_STATE')?.payload.roomState;
        expect(nextRoom?.id).toBe(nextRoomId);
        expect(nextRoom?.participants.filter((it) => it.id === movedParticipantId)).toHaveLength(1);
        send(moved, 'TOGGLE_SPECTATOR', {});
        const updated = lastMessage(moved, 'ROOM_STATE')?.payload.roomState?.participants;
        expect(updated?.find((it) => it.id === movedParticipantId)).toMatchObject({
            id: movedParticipantId,
            isSpectator: true,
        });

        // The detached socket's own close cannot touch the room it left.
        moving.emit('close');
        expect(observer.sent.filter((it) => it.type === 'ROOM_STATE')).toHaveLength(2);
        expect(
            lastMessage(observer, 'ROOM_STATE')?.payload.roomState?.participants.map((it) => it.id)
        ).toEqual([observerParticipantId]);
    });

    it('lets a room that was emptied by the switch take a new host', () => {
        const { connect } = boot();

        const mover = connect({ clientId: '55555555-5555-4555-8555-555555555555' });
        send(mover, 'CREATE_ROOM', { name: 'Alice' });
        const emptiedRoomId = roomIdOf(mover);

        const otherHost = connect({ clientId: '66666666-6666-4666-8666-666666666666' });
        send(otherHost, 'CREATE_ROOM', { name: 'Bob' });
        const nextRoomId = roomIdOf(otherHost);

        const moved = connect({ clientId: '55555555-5555-4555-8555-555555555555' });
        send(moved, 'JOIN_ROOM', {
            name: 'Alice',
            previousRoomToken: tokenOf(mover),
            roomId: nextRoomId,
        });

        // The room left behind is empty now, so the next joiner must own it
        // rather than inherit a host who is no longer there.
        const joiner = connect({ clientId: '77777777-7777-4777-8777-777777777777' });
        send(joiner, 'JOIN_ROOM', { name: 'Dana', roomId: emptiedRoomId });
        const joinerId = participantIdOf(joiner);
        const room = lastMessage(joiner, 'ROOM_STATE')?.payload.roomState;
        expect(room?.participants).toHaveLength(1);
        expect(room?.hostId).toBe(joinerId);
        expect(room?.participants[0]).toMatchObject({ id: joinerId, isAdmin: true, isHost: true });
    });
});

/** A room the mover leaves, an observer inside it, and the room it moves to. */
interface SwitchSetup {
    connect: ReturnType<typeof boot>['connect'];
    leftParticipantId: string;
    leftRoomId: string;
    mover: ReturnType<ReturnType<typeof boot>['connect']>;
    nextRoomId: string;
    observer: ReturnType<ReturnType<typeof boot>['connect']>;
}

/** Boots two rooms and an observer, so a switch can be asserted from both sides. */
const setupSwitch = (): SwitchSetup => {
    const { connect } = boot();

    const mover = connect({ clientId: '88888888-8888-4888-8888-888888888888' });
    send(mover, 'CREATE_ROOM', { name: 'Alice' });
    const leftRoomId = roomIdOf(mover);
    const leftParticipantId = participantIdOf(mover);

    // A second window keeps a view of the room the mover leaves.
    const observer = connect({ clientId: '99999999-9999-4999-8999-999999999999' });
    send(observer, 'JOIN_ROOM', { name: 'Bob', roomId: leftRoomId });

    const otherHost = connect({ clientId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    send(otherHost, 'CREATE_ROOM', { name: 'Carol' });
    const nextRoomId = roomIdOf(otherHost);

    return { connect, leftParticipantId, leftRoomId, mover, nextRoomId, observer };
};

describe('Room switching without a token', () => {
    it('marks the seat offline when the socket creates another room', () => {
        const { leftParticipantId, leftRoomId, mover, observer } = setupSwitch();

        // The same socket opens a second room without proving the first one,
        // which is what a client-only Leave leaves behind.
        send(mover, 'CREATE_ROOM', { name: 'Alice' });

        const leftRoom = lastMessage(observer, 'ROOM_STATE')?.payload.roomState;
        expect(leftRoom?.id).toBe(leftRoomId);
        // The seat is offline, not a ghost the idle sweep would have to trust.
        expect(leftRoom?.participants.find((it) => it.id === leftParticipantId)).toMatchObject({
            id: leftParticipantId,
            isOnline: false,
        });
    });

    it('releases the room a socket created when it joins another one', () => {
        const { leftParticipantId, leftRoomId, mover, nextRoomId, observer } = setupSwitch();

        send(mover, 'JOIN_ROOM', { name: 'Alice', roomId: nextRoomId });

        const leftRoom = lastMessage(observer, 'ROOM_STATE')?.payload.roomState;
        expect(leftRoom?.id).toBe(leftRoomId);
        expect(leftRoom?.participants.find((it) => it.id === leftParticipantId)?.isOnline).toBe(
            false
        );

        // The socket is bound to the room it joined and still acts there.
        const joinedParticipantId = participantIdOf(mover);
        expect(roomIdOf(mover)).toBe(nextRoomId);
        send(mover, 'TOGGLE_SPECTATOR', {});
        const joinedRoom = lastMessage(mover, 'ROOM_STATE')?.payload.roomState;
        expect(joinedRoom?.id).toBe(nextRoomId);
        const joinedParticipant = joinedRoom?.participants.find(
            (it) => it.id === joinedParticipantId
        );
        expect(joinedParticipant).toMatchObject({ id: joinedParticipantId, isSpectator: true });
    });

    it('switches the socket itself when it proves the room it leaves with a token', () => {
        const { leftParticipantId, leftRoomId, mover, nextRoomId, observer } = setupSwitch();

        // Same socket, old-room token: the seat is removed by the token path,
        // so the moving socket must survive and the room must hear of it once.
        send(mover, 'JOIN_ROOM', {
            name: 'Alice',
            previousRoomToken: tokenOf(mover),
            roomId: nextRoomId,
        });

        expect(mover.closes).toEqual([]);
        expect(roomIdOf(mover)).toBe(nextRoomId);
        expect(observer.sent.filter((it) => it.type === 'ROOM_STATE')).toHaveLength(2);
        const leftRoom = lastMessage(observer, 'ROOM_STATE')?.payload.roomState;
        expect(leftRoom?.id).toBe(leftRoomId);
        expect(leftRoom?.participants.map((it) => it.id)).not.toContain(leftParticipantId);
    });
});
