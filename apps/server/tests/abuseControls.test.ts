import {
    MAX_PARTICIPANTS_PER_ROOM,
    MAX_ROOMS,
    MAX_STORIES_PER_ROOM,
    ROOM_IDLE_TTL_MS,
    WS_MAX_PAYLOAD_BYTES,
} from '@planitpoker/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BanService, banKey } from '../src/banService.js';
import { ROOM_CLEANUP_INTERVAL_MS } from '../src/constants.js';
import { RoomManager } from '../src/roomManager.js';
import { isBacklogFull } from '../src/storyService.js';
import { MessageThrottle } from '../src/throttle.js';

describe('Room caps', () => {
    it('stops creating rooms once the limit is reached', () => {
        const rm = new RoomManager();
        for (let i = 0; i < MAX_ROOMS; i += 1) {
            expect(rm.createRoom(`Host ${i}`)).not.toBeNull();
        }

        expect(rm.createRoom('Host one too many')).toBeNull();
        expect(rm.getRoomCount()).toBe(MAX_ROOMS);
    });

    it('admits no participant beyond the per-room cap', () => {
        const rm = new RoomManager();
        const { roomId } = rm.createRoom('Alice');

        // The host already occupies one seat.
        for (let i = 1; i < MAX_PARTICIPANTS_PER_ROOM; i += 1) {
            expect(rm.joinRoom(roomId, `Guest ${i}`)?.participant).toBeDefined();
        }

        const overflow = rm.joinRoom(roomId, 'Guest too many');
        expect(overflow?.participant).toBeUndefined();
        expect(overflow?.code).toBe('ROOM_FULL');
        expect(overflow?.error).toMatch(/full/i);
    });

    it('caps the backlog at MAX_STORIES_PER_ROOM', () => {
        const rm = new RoomManager();
        const { hostId, roomId } = rm.createRoom('Alice');

        // The room starts with one story.
        for (let i = 1; i < MAX_STORIES_PER_ROOM; i += 1) {
            expect(rm.addStory(roomId, hostId, `Story ${i}`)).not.toBeNull();
        }
        expect(isBacklogFull(rm.getRoom(roomId)!)).toBe(true);

        expect(rm.addStory(roomId, hostId, 'One story too many')).toBeNull();
        expect(rm.getRoom(roomId)!.stories).toHaveLength(MAX_STORIES_PER_ROOM);
    });

    it('refuses a bulk import once the backlog is full', () => {
        const rm = new RoomManager();
        const { hostId, roomId } = rm.createRoom('Alice');
        const room = rm.getRoom(roomId)!;
        room.stories = Array.from({ length: MAX_STORIES_PER_ROOM }, (_, index) => ({
            id: `story_${index}`,
            status: 'pending' as const,
            title: `Story ${index}`,
        }));

        expect(rm.bulkAddStories(roomId, hostId, [{ title: 'Imported' }])).toBeNull();
        expect(room.stories).toHaveLength(MAX_STORIES_PER_ROOM);
    });

    it('drops only the overflow of a bulk import', () => {
        const rm = new RoomManager();
        const { hostId, roomId } = rm.createRoom('Alice');
        const room = rm.getRoom(roomId)!;
        room.stories = Array.from({ length: MAX_STORIES_PER_ROOM - 2 }, (_, index) => ({
            id: `story_${index}`,
            status: 'pending' as const,
            title: `Story ${index}`,
        }));

        const updated = rm.bulkAddStories(roomId, hostId, [
            { title: 'Fits' },
            { title: 'Fits too' },
            { title: 'Does not fit' },
        ]);

        expect(updated).not.toBeNull();
        expect(room.stories).toHaveLength(MAX_STORIES_PER_ROOM);
        expect(room.stories.some((story) => story.title === 'Does not fit')).toBe(false);
    });
});

describe('Idle room sweep', () => {
    it('drops a room that nobody touched for the whole TTL', () => {
        const rm = new RoomManager();
        const { roomId } = rm.createRoom('Alice');

        rm.sweepIdleRooms(Date.now() + ROOM_IDLE_TTL_MS + 1);

        expect(rm.getRoom(roomId)).toBeUndefined();
        expect(rm.getRoomCount()).toBe(0);
    });

    it('survives the sweep while it is still being read', () => {
        vi.useFakeTimers();
        try {
            const rm = new RoomManager();
            const { hostId, roomId } = rm.createRoom('Alice');

            // A room that is merely being polled never joins nor creates
            // anything, so only a read can prove it is alive. The sweep runs
            // before any vote on purpose: voting reads the room too and would
            // refresh the timestamp by itself, hiding what the read proved.
            vi.advanceTimersByTime(ROOM_IDLE_TTL_MS - 1);
            rm.getRoom(roomId);
            vi.advanceTimersByTime(1);

            rm.sweepIdleRooms(Date.now());
            expect(rm.getRoom(roomId)).toBeDefined();
            expect(rm.getRoomCount()).toBe(1);

            // Still usable after a sweep that came for it.
            expect(rm.submitVote(roomId, hostId, 5)).not.toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('drops a room that is never read again', () => {
        vi.useFakeTimers();
        try {
            const rm = new RoomManager();
            const { roomId } = rm.createRoom('Alice');
            vi.advanceTimersByTime(ROOM_IDLE_TTL_MS + 1);

            rm.sweepIdleRooms(Date.now());

            expect(rm.getRoom(roomId)).toBeUndefined();
        } finally {
            vi.useRealTimers();
        }
    });

    it('keeps a room that was touched recently', () => {
        const rm = new RoomManager();
        const { roomId } = rm.createRoom('Alice');
        const now = Date.now();

        rm.joinRoom(roomId, 'Bob');
        rm.sweepIdleRooms(now + ROOM_IDLE_TTL_MS - 1);

        expect(rm.getRoom(roomId)).toBeDefined();
    });

    it('reports the rooms it dropped', () => {
        const rm = new RoomManager();
        const { roomId } = rm.createRoom('Alice');

        expect(rm.sweepIdleRooms(Date.now() + ROOM_IDLE_TTL_MS + 1)).toEqual([roomId]);
    });
});

describe('Per-socket message throttle', () => {
    const WINDOW_MS = 10_000;
    const MAX_MESSAGES = 3;
    let throttle: MessageThrottle;
    const socket = Object.freeze({ id: 'socket-a' });
    const other = Object.freeze({ id: 'socket-b' });

    beforeEach(() => {
        throttle = new MessageThrottle(MAX_MESSAGES, WINDOW_MS);
    });

    it('allows a budget of messages per window', () => {
        for (let i = 0; i < MAX_MESSAGES; i += 1) {
            expect(throttle.allows(socket, 1_000)).toBe(true);
        }
    });

    it('drops the message that exceeds the budget', () => {
        for (let i = 0; i < MAX_MESSAGES; i += 1) {
            throttle.allows(socket, 1_000);
        }
        expect(throttle.allows(socket, 1_500)).toBe(false);
    });

    it('restores the budget once the window elapses', () => {
        for (let i = 0; i < MAX_MESSAGES; i += 1) {
            throttle.allows(socket, 1_000);
        }
        expect(throttle.allows(socket, 1_000 + WINDOW_MS)).toBe(true);
    });

    it('keeps sockets independent', () => {
        for (let i = 0; i < MAX_MESSAGES; i += 1) {
            throttle.allows(socket, 1_000);
        }
        expect(throttle.allows(other, 1_000)).toBe(true);
    });

    it('forgets a socket when it closes', () => {
        for (let i = 0; i < MAX_MESSAGES; i += 1) {
            throttle.allows(socket, 1_000);
        }
        throttle.forget(socket);

        expect(throttle.allows(socket, 1_200)).toBe(true);
    });

    it('sweeps entries whose window elapsed', () => {
        throttle.allows(socket, 1_000);
        throttle.sweep(1_000 + WINDOW_MS + 1);

        expect(throttle.allows(socket, 1_000 + WINDOW_MS + 2)).toBe(true);
    });
});

describe('Kick ban', () => {
    const BAN_MS = 5 * 60_000;
    let bans: BanService;
    const NOW = 1_000_000;

    beforeEach(() => {
        bans = new BanService();
    });

    it('bars the kicked participant from rejoining', () => {
        bans.ban('ROOM01', 'user_2', NOW, BAN_MS);

        expect(bans.isBanned('ROOM01', 'user_2', NOW + BAN_MS - 1)).toBe(true);
    });

    it('lets the participant back once the ban expires', () => {
        bans.ban('ROOM01', 'user_2', NOW, BAN_MS);

        expect(bans.isBanned('ROOM01', 'user_2', NOW + BAN_MS)).toBe(false);
    });

    it('is scoped to the room it was issued in', () => {
        bans.ban('ROOM01', 'user_2', NOW, BAN_MS);

        expect(bans.isBanned('ROOM02', 'user_2', NOW)).toBe(false);
    });

    it('does not bar other participants of the same room', () => {
        bans.ban('ROOM01', 'user_2', NOW, BAN_MS);

        expect(bans.isBanned('ROOM01', 'user_3', NOW)).toBe(false);
    });

    it('drops expired bans on sweep', () => {
        bans.ban('ROOM01', 'user_2', NOW, BAN_MS);
        bans.sweep(NOW + BAN_MS + 1);

        expect(bans.isBanned('ROOM01', 'user_2', NOW + BAN_MS + 1)).toBe(false);
    });

    it('builds a distinct key per room and participant', () => {
        expect(banKey('ROOM01', 'user_2')).toBe('ROOM01:user_2');
        expect(banKey('ROOM01', 'user_2')).not.toBe(banKey('ROOM01', 'user_3'));
        expect(banKey('ROOM01', 'user_2')).not.toBe(banKey('ROOM02', 'user_2'));
    });
});

describe('Server limits', () => {
    it('sets a WebSocket frame cap', () => {
        expect(WS_MAX_PAYLOAD_BYTES).toBe(32 * 1024);
    });

    it('runs the idle sweep once per hour', () => {
        expect(ROOM_CLEANUP_INTERVAL_MS).toBe(60 * 60 * 1000);
    });
});
