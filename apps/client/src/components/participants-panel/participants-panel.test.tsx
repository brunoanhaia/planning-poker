import { Participant, RoomState } from '@planitpoker/shared';
import { fireEvent, render, screen } from '@testing-library/react';
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
    endedAt: null,
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

const departedParticipant: Participant = {
    avatar: '👻',
    color: '#f59e0b',
    hasVoted: true,
    id: 'user_4',
    isAdmin: false,
    isHost: false,
    isOnline: false,
    isSpectator: false,
    name: 'Dora Departed',
    vote: 8,
};

const roomStateWithDepartedParticipant: RoomState = {
    ...roomStateWithThreeParticipants,
    participants: [...roomStateWithThreeParticipants.participants, departedParticipant],
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

    it('collapses departed participants and reports the online count', async () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ roomState: roomStateWithDepartedParticipant })
        );
        render(<ParticipantsPanel />);

        expect(screen.getByText('Participants (3 online / 4)')).toBeInTheDocument();
        expect(screen.queryByText('Dora Departed')).not.toBeInTheDocument();

        fireEvent.click(screen.getByText('1 participant left'));

        expect(await screen.findByText('Dora Departed')).toBeInTheDocument();
        expect(screen.getByText('Left')).toBeInTheDocument();
        // Only Alice, who is still online, keeps the "Voted" badge.
        expect(screen.getAllByText('Voted')).toHaveLength(1);
    });

    it('lets an admin clear the departed participants', async () => {
        const socket = createMockSocketValue({ roomState: roomStateWithDepartedParticipant });
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);
        render(<ParticipantsPanel />);

        fireEvent.click(screen.getByText('1 participant left'));
        fireEvent.click(await screen.findByRole('button', { name: 'Clear left participants' }));

        expect(socket.clearOfflineParticipants).toHaveBeenCalledTimes(1);
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
