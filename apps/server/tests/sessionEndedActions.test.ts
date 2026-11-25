import { afterEach, describe, expect, it } from 'vitest';

import { boot, lastMessage, messagesOf, send, shutdownHandlers } from './support/socketHarness.js';

afterEach(() => {
    shutdownHandlers();
});

/** Content-changing actions that must be refused once the session is over. */
const FROZEN_ACTIONS: [string, Record<string, unknown>][] = [
    ['ADD_STORY', { title: 'Late story' }],
    ['BULK_ADD_STORIES', { stories: [{ title: 'Late story' }] }],
    ['CHANGE_DECK', { deckType: 'fibonacci' }],
    ['DELETE_STORY', { storyId: 'missing-story' }],
    ['PAUSE_TIMER', {}],
    ['RESET_TIMER', {}],
    ['RESET_VOTES', {}],
    ['REVEAL_VOTES', {}],
    ['SET_CURRENT_STORY', { storyIndex: 0 }],
    ['START_TIMER', { duration: 30 }],
    ['TOGGLE_AUTO_REVEAL', {}],
    ['TOGGLE_LOCK_ROOM', {}],
    ['UPDATE_ROOM_TITLE', { title: 'Late title' }],
    ['UPDATE_STORY_ESTIMATE', { estimate: 5, storyId: 'missing-story' }],
];

describe('Actions after the session ends', () => {
    it.each(FROZEN_ACTIONS)('refuses %s instead of applying it', (type, payload) => {
        const { connect } = boot();
        const host = connect();

        send(host, 'CREATE_ROOM', { name: 'Alice' });
        send(host, 'END_SESSION', {});
        const roomStatesAfterEnd = messagesOf(host, 'ROOM_STATE').length;

        send(host, type, payload);

        // The guard runs before the handler, so even an action that would
        // otherwise fail authorization reports the lifecycle reason.
        expect(lastMessage(host, 'ERROR')?.payload.code).toBe('SESSION_ENDED');
        expect(messagesOf(host, 'ROOM_STATE')).toHaveLength(roomStatesAfterEnd);
    });

    it('still accepts presence changes and a repeated end request', () => {
        const { connect } = boot();
        const host = connect();

        send(host, 'CREATE_ROOM', { name: 'Alice' });
        send(host, 'END_SESSION', {});
        const roomStatesAfterEnd = messagesOf(host, 'ROOM_STATE').length;

        // Spectator mode is a personal view, not room content; ending the
        // session again is idempotent and must not surface a spurious error.
        send(host, 'TOGGLE_SPECTATOR', {});
        send(host, 'END_SESSION', {});

        expect(messagesOf(host, 'ERROR')).toHaveLength(0);
        expect(messagesOf(host, 'ROOM_STATE').length).toBeGreaterThan(roomStatesAfterEnd);
    });

    it('keeps the vote-specific rejection for a vote sent after the end', () => {
        const { connect } = boot();
        const host = connect();

        send(host, 'CREATE_ROOM', { name: 'Alice' });
        send(host, 'END_SESSION', {});
        send(host, 'VOTE', { vote: 5 });

        expect(lastMessage(host, 'ERROR')?.payload.code).toBe('SESSION_ENDED');
        expect(lastMessage(host, 'ERROR')?.payload.message).toContain('no further votes');
    });
});
