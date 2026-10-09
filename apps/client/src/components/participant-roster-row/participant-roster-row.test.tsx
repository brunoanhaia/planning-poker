import { Participant } from '@planitpoker/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import * as SocketContextModule from '../../context/socket-context/use-socket';
import { createMockSocketValue } from '../../tests/socket-context.mock';
import { ParticipantRosterRow } from './participant-roster-row';
import { buildParticipantMenuItems, isParticipantMenuAction } from './participant-roster-row.utils';

const participant: Participant = {
    avatar: '🎨',
    color: '#3b82f6',
    hasVoted: true,
    id: 'user_2',
    isAdmin: false,
    isHost: false,
    isOnline: true,
    isSpectator: false,
    name: 'Bob Voter',
    vote: 5,
};

/** Renders one roster row against a mocked socket session. */
const renderRow = (overrides?: {
    canManage?: boolean;
    canTransferHost?: boolean;
    participant?: Participant;
    showSeparator?: boolean;
}) => {
    const socket = createMockSocketValue();
    vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);
    const view = render(
        <ParticipantRosterRow
            canManage={overrides?.canManage ?? true}
            canTransferHost={overrides?.canTransferHost ?? false}
            isSelf={false}
            participant={overrides?.participant ?? participant}
            showSeparator={overrides?.showSeparator ?? false}
        />
    );
    return { socket, view };
};

describe('participant roster action menu', () => {
    it('offers role and co-admin toggles for every participant', () => {
        const items = buildParticipantMenuItems({
            canTransferHost: false,
            participant: participant,
        });

        expect(items).toEqual([
            { key: 'toggle-role', label: 'Make Spectator' },
            { key: 'toggle-co-admin', label: 'Promote to Co-Admin' },
            { type: 'divider' },
            { danger: true, key: 'kick', label: 'Kick from Room' },
        ]);
    });

    it('labels the toggles after the current state of the participant', () => {
        const spectator: Participant = { ...participant, isAdmin: true, isSpectator: true };
        const items = buildParticipantMenuItems({
            canTransferHost: false,
            participant: spectator,
        });

        expect(items).toEqual([
            { key: 'toggle-role', label: 'Make Voter' },
            { key: 'toggle-co-admin', label: 'Demote from Co-Admin' },
            { type: 'divider' },
            { danger: true, key: 'kick', label: 'Kick from Room' },
        ]);
    });

    it('adds the host hand-over only for the primary host', () => {
        const items = buildParticipantMenuItems({
            canTransferHost: true,
            participant: participant,
        });

        expect(
            items
                ?.filter((item) => item !== null)
                .map((item) => ('key' in item ? item.key : item.type))
        ).toEqual(['toggle-role', 'toggle-co-admin', 'transfer-host', 'divider', 'kick']);
    });

    it('recognises only the keys the menu emits', () => {
        expect(isParticipantMenuAction('kick')).toBe(true);
        expect(isParticipantMenuAction('transfer-host')).toBe(true);
        expect(isParticipantMenuAction('toggle-role')).toBe(true);
        expect(isParticipantMenuAction('toggle-co-admin')).toBe(true);
        expect(isParticipantMenuAction('reveal-votes')).toBe(false);
    });
});

describe('ParticipantRosterRow', () => {
    it('shows the identity and the voting state', () => {
        const { view } = renderRow();

        expect(view.getByText('Bob Voter')).toBeInTheDocument();
        expect(view.getByText('Voted')).toBeInTheDocument();
    });

    it('draws the separator rule only when the row follows another one', () => {
        const { view: plain } = renderRow();
        const { view: separated } = renderRow({ showSeparator: true });

        expect(plain.container.querySelector('li')).not.toHaveStyle({ borderTopStyle: 'solid' });
        expect(separated.container.querySelector('li')).toHaveStyle({
            borderTopStyle: 'solid',
            borderTopWidth: '1px',
        });
    });

    it('hides the management menu for non-administrators', () => {
        const { view } = renderRow({ canManage: false });

        expect(view.queryByRole('button', { name: 'Manage Bob Voter' })).not.toBeInTheDocument();
    });

    it.each([
        { item: 'Make Spectator', expected: 'toggleUserRole' },
        { item: 'Promote to Co-Admin', expected: 'promoteCoAdmin' },
        { item: 'Kick from Room', expected: 'kickParticipant' },
    ])('dispatches "$item" for the row participant', async ({ expected, item }) => {
        const { socket, view } = renderRow();

        fireEvent.click(view.getByRole('button', { name: 'Manage Bob Voter' }));
        fireEvent.click(await screen.findByText(item));

        expect(socket[expected as keyof typeof socket]).toHaveBeenCalledWith('user_2');
    });

    it('offers the host hand-over to the host only', async () => {
        const { socket, view } = renderRow({ canTransferHost: true });

        fireEvent.click(view.getByRole('button', { name: 'Manage Bob Voter' }));
        fireEvent.click(await screen.findByText('Transfer Primary Host'));

        expect(socket.transferAdmin).toHaveBeenCalledWith('user_2');
        expect(view.queryByText('Kick from Room')).toBeInTheDocument();
    });
});
