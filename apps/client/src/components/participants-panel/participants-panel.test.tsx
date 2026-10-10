import { RoomState } from '@planitpoker/shared';
import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import * as SocketContextModule from '../../context/socket-context/use-socket';
import { createMockSocketValue } from '../../tests/socket-context.mock';
import { ParticipantsPanel } from './participants-panel';

const roomStateWithThreeParticipants: RoomState = {
    activeDeck: [1, 2, 3, 5, 8],
    autoReveal: false,
    createdAt: Date.now(),
    currentStoryIndex: 0,
    deckType: 'fibonacci',
    hostId: 'user_1',
    id: 'ROOM01',
    isEnded: false,
    isLocked: false,
    participants: [
        {
            avatar: '🚀',
            color: '#6366f1',
            hasVoted: true,
            id: 'user_1',
            isAdmin: true,
            isHost: true,
            isOnline: true,
            isSpectator: false,
            name: 'Alice Host',
            vote: 5,
        },
        {
            avatar: '🎨',
            color: '#3b82f6',
            hasVoted: false,
            id: 'user_2',
            isAdmin: false,
            isHost: false,
            isOnline: true,
            isSpectator: false,
            name: 'Bob Voter',
            vote: null,
        },
        {
            avatar: '🕵️',
            color: '#10b981',
            hasVoted: false,
            id: 'user_3',
            isAdmin: false,
            isHost: false,
            isOnline: true,
            isSpectator: true,
            name: 'Carla Spectator',
            vote: null,
        },
    ],
    stories: [],
    timer: null,
    title: 'Sprint 10 Estimation',
    votesRevealed: false,
};

describe('ParticipantsPanel', () => {
    it('lists every participant as a list item and nothing else', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ roomState: roomStateWithThreeParticipants })
        );
        const { container } = render(<ParticipantsPanel />);

        const list = container.querySelector('ul');
        expect(list).not.toBeNull();
        expect(Array.from(list?.children ?? []).every((child) => child.tagName === 'LI')).toBe(
            true
        );
        expect(list?.children).toHaveLength(3);
    });

    it('offers the management menu to an admin, but never for their own row', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({
                currentUserId: 'user_1',
                roomState: roomStateWithThreeParticipants,
            })
        );
        const { queryAllByRole } = render(<ParticipantsPanel />);

        const triggers = queryAllByRole('button', { name: /^Manage / });
        expect(triggers).toHaveLength(2);
        expect(queryAllByRole('button', { name: 'Manage Alice Host' })).toHaveLength(0);
    });
});
