import { describe, expect, it } from 'vitest';

import { RoomManager } from '../src/roomManager.js';
import { SessionService } from '../src/sessionService.js';
import { isActiveOwner, shouldCleanupOnClose, socketKey } from '../src/webSocketHandler.js';

describe('RoomManager security hardening', () => {
    it('clamps a negative timer duration to the minimum', () => {
        const rm = new RoomManager();
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');

        const room = rm.startTimer(roomId, hostId, -5)!;
        expect(room.timer!.duration).toBeGreaterThan(0);
        expect(room.timer!.remaining).toBe(room.timer!.duration);
    });

    it('clamps an oversized timer duration to the maximum', () => {
        const rm = new RoomManager();
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');

        const room = rm.startTimer(roomId, hostId, 1e9)!;
        expect(room.timer!.duration).toBeLessThanOrEqual(3600);
    });

    it('falls back to the default for a non-finite timer duration', () => {
        const rm = new RoomManager();
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');

        const room = rm.startTimer(roomId, hostId, Number.NaN)!;
        expect(room.timer!.duration).toBe(60);
    });

    it('rejects a custom deck that is too small', () => {
        const rm = new RoomManager();
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');

        expect(rm.changeDeck(roomId, hostId, 'custom', [1])).toBeNull();
    });

    it('rejects a custom deck with duplicates', () => {
        const rm = new RoomManager();
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');

        expect(rm.changeDeck(roomId, hostId, 'custom', [1, 1, 2])).toBeNull();
    });

    it('accepts a valid custom deck and updates the active deck', () => {
        const rm = new RoomManager();
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');

        const room = rm.changeDeck(roomId, hostId, 'custom', [1, 2, 3])!;
        expect(room.activeDeck).toEqual([1, 2, 3]);
        expect(room.deckType).toBe('custom');
    });

    it('rejects an unknown deck type without silently falling back', () => {
        const rm = new RoomManager();
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');

        expect(rm.changeDeck(roomId, hostId, 'not_a_deck' as never)).toBeNull();
    });

    it('truncates an over-long room title', () => {
        const rm = new RoomManager();
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');

        const room = rm.updateRoomTitle(roomId, hostId, 'x'.repeat(500))!;
        expect(room.title.length).toBeLessThanOrEqual(120);
    });

    it('truncates over-long story titles and descriptions', () => {
        const rm = new RoomManager();
        const { hostId, roomId } = rm.createRoom('Alice', '🚀', '#6366f1');

        const room = rm.addStory(roomId, hostId, 'x'.repeat(500), 'y'.repeat(5000))!;
        const story = room.stories[room.stories.length - 1];
        expect(story.title.length).toBeLessThanOrEqual(120);
        expect((story.description || '').length).toBeLessThanOrEqual(2000);
    });
});

describe('SessionService', () => {
    it('issues opaque tokens that resolve to their binding', () => {
        const sessions = new SessionService();
        const token = sessions.issue('ROOM01', 'user_1');

        expect(token).not.toBe('user_1');
        expect(sessions.resolve(token)).toEqual({ roomId: 'ROOM01', userId: 'user_1' });
    });

    it('does not resolve unknown or empty tokens', () => {
        const sessions = new SessionService();
        expect(sessions.resolve('nope')).toBeNull();
        expect(sessions.resolve(null)).toBeNull();
        expect(sessions.resolve(undefined)).toBeNull();
    });

    it('revokes a single token', () => {
        const sessions = new SessionService();
        const token = sessions.issue('ROOM01', 'user_1');

        sessions.revoke(token);
        expect(sessions.resolve(token)).toBeNull();
    });

    it('revokes every token bound to a user', () => {
        const sessions = new SessionService();
        const first = sessions.issue('ROOM01', 'user_1');
        const second = sessions.issue('ROOM01', 'user_1');
        const other = sessions.issue('ROOM01', 'user_2');

        sessions.revokeByUser('ROOM01', 'user_1');
        expect(sessions.resolve(first)).toBeNull();
        expect(sessions.resolve(second)).toBeNull();
        expect(sessions.resolve(other)).not.toBeNull();
    });

    it('replaces the previous token when re-issuing for the same participant', () => {
        const sessions = new SessionService();
        const first = sessions.issue('ROOM01', 'user_1');
        const second = sessions.issue('ROOM01', 'user_1');

        expect(sessions.resolve(first)).toBeNull();
        expect(sessions.resolve(second)).toEqual({ roomId: 'ROOM01', userId: 'user_1' });
    });

    it('keeps at most one live token per participant', () => {
        const sessions = new SessionService();
        const tokens = Array.from({ length: 25 }, () => sessions.issue('ROOM01', 'user_1'));

        const live = tokens.filter((token) => sessions.resolve(token) !== null);
        expect(live).toHaveLength(1);
    });
});

describe('Reconnection ownership on socket close', () => {
    it('builds a stable composite key per room and participant', () => {
        expect(socketKey('ROOM01', 'user_1')).toBe('ROOM01:user_1');
        expect(socketKey('ROOM01', 'user_1')).toBe(socketKey('ROOM01', 'user_1'));
        expect(socketKey('ROOM01', 'user_1')).not.toBe(socketKey('ROOM01', 'user_2'));
    });

    it('cleans up when the closing socket is the active one', () => {
        const active = { id: 'socket-a' };
        expect(shouldCleanupOnClose(active, active)).toBe(true);
    });

    it('cleans up when no socket is registered for the participant', () => {
        expect(shouldCleanupOnClose(undefined, { id: 'socket-a' })).toBe(true);
    });

    it('does not clean up when a stale socket closes after a newer one joined', () => {
        const newer = { id: 'socket-b' };
        const stale = { id: 'socket-a' };
        expect(shouldCleanupOnClose(newer, stale)).toBe(false);
    });

    it('preserves the reconnectable token across an ordinary disconnect', () => {
        const sessions = new SessionService();
        const token = sessions.issue('ROOM01', 'user_1');

        // A normal disconnect must not revoke the token, otherwise the client
        // cannot reclaim its identity on reload.
        expect(sessions.resolve(token)).toEqual({ roomId: 'ROOM01', userId: 'user_1' });
    });

    it('still revokes the token when the participant is kicked', () => {
        const sessions = new SessionService();
        const token = sessions.issue('ROOM01', 'user_1');

        sessions.revokeByUser('ROOM01', 'user_1');
        expect(sessions.resolve(token)).toBeNull();
    });
});

describe('Superseded socket ownership', () => {
    it('treats a socket that is not the active owner as having no session', () => {
        const newer = { id: 'socket-b' };
        const stale = { id: 'socket-a' };

        expect(isActiveOwner(newer, stale)).toBe(false);
        expect(isActiveOwner(newer, newer)).toBe(true);
    });

    it('treats a socket as owner when no active socket is registered', () => {
        expect(isActiveOwner(undefined, { id: 'socket-a' })).toBe(true);
    });
});
