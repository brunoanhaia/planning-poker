import { RoomState } from '@planitpoker/shared';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import * as SocketContextModule from '../../context/socket-context/use-socket';
import { createMockSocketValue } from '../../tests/socket-context.mock';
import { MainContent } from './main-content';

const mockRoomState: RoomState = {
    activeDeck: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'],
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
    ],
    stories: [
        {
            description: 'Run initial migration script for postgres schema',
            id: 'story_1',
            status: 'estimating',
            title: 'Setup Database Migration',
        },
    ],
    timer: {
        duration: 60,
        isRunning: true,
        remaining: 45,
    },
    title: 'Sprint 10 Estimation',
    votesRevealed: false,
};

/** Renders the shell against a mocked socket session. */
const renderMainContent = () =>
    render(<MainContent colorMode="dark" onToggleColorMode={vi.fn()} />);

describe('MainContent', () => {
    it('renders the roster, the active story and the live timer for an admin', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ roomState: mockRoomState })
        );

        const screen = renderMainContent();

        expect(screen.getByText('Setup Database Migration')).toBeInTheDocument();
        expect(screen.getByText('Alice Host')).toBeInTheDocument();
        expect(screen.getByText('(you)')).toBeInTheDocument();
        expect(screen.getByText('Bob Voter')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Reveal Votes/i })).toBeInTheDocument();
        expect(screen.getByText('0:45')).toBeInTheDocument();
    });

    it.each(['fibonacci', 'custom'] as const)(
        'preserves votes when applying unchanged %s deck settings',
        (deckType) => {
            const socket = createMockSocketValue({
                roomState: {
                    ...mockRoomState,
                    customDeck: deckType === 'custom' ? [0, 1, '?'] : undefined,
                    deckType,
                },
            });
            vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);
            const screen = renderMainContent();
            fireEvent.click(screen.getByRole('button', { name: /Room Settings/i }));
            fireEvent.change(screen.getByLabelText('Room / Sprint Title'), {
                target: { value: 'Renamed sprint' },
            });
            if (deckType === 'custom') {
                fireEvent.change(screen.getByLabelText('Comma-Separated Custom Cards'), {
                    target: { value: ' 0, 1, ?, ' },
                });
            }
            fireEvent.click(screen.getByRole('button', { name: 'Apply Settings' }));
            expect(socket.updateRoomTitle).toHaveBeenCalledWith('Renamed sprint');
            expect(socket.changeDeck).not.toHaveBeenCalled();
        }
    );

    it('applies changes to custom card values', () => {
        const socket = createMockSocketValue({
            roomState: { ...mockRoomState, customDeck: [0, 1, '?'], deckType: 'custom' },
        });
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);
        const screen = renderMainContent();
        fireEvent.click(screen.getByRole('button', { name: /Room Settings/i }));
        fireEvent.change(screen.getByLabelText('Comma-Separated Custom Cards'), {
            target: { value: '0, 2, ?' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Apply Settings' }));
        expect(socket.changeDeck).toHaveBeenCalledWith('custom', [0, 2, '?']);
    });

    it('exports stable story IDs and intact CSV text containing a fragment delimiter', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({
                roomState: {
                    ...mockRoomState,
                    stories: [
                        {
                            id: 'stable-story-id',
                            title: 'Bug #42',
                            description: 'Keep #, ; and |',
                            status: 'completed',
                            finalEstimate: 0,
                        },
                    ],
                },
            })
        );
        let downloadUrl = '';
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement
        ) {
            downloadUrl = this.href;
        });
        const screen = renderMainContent();
        fireEvent.click(screen.getByRole('button', { name: 'Export backlog to CSV' }));
        expect(new URL(downloadUrl).hash).toBe('');
        expect(decodeURIComponent(downloadUrl.split(',')[1])).toBe(
            '"ID","Title","Description","Status","Final Estimate"\n"stable-story-id","Bug #42","Keep #, ; and |","completed","0"'
        );
        click.mockRestore();
    });

    it('allows resetting a zero score', () => {
        const socket = createMockSocketValue({
            roomState: {
                ...mockRoomState,
                stories: [{ ...mockRoomState.stories[0], finalEstimate: 0 }],
            },
        });
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);
        const screen = renderMainContent();
        fireEvent.click(screen.getByRole('button', { name: /Edit score for/ }));
        const reset = screen.getByRole('button', { name: 'Reset Score' });
        expect(reset).toBeEnabled();
        fireEvent.click(reset);
        expect(socket.updateStoryEstimate).toHaveBeenCalledWith('story_1', null);
    });

    it('waits for the host instead of offering reveal to a plain voter', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({
                currentUserId: 'user_2',
                isAdmin: false,
                isHost: false,
                roomState: mockRoomState,
            })
        );

        const screen = renderMainContent();

        expect(screen.queryByRole('button', { name: /Reveal Votes/i })).not.toBeInTheDocument();
        expect(screen.getByText(/Waiting for Host to reveal/i)).toBeInTheDocument();
    });
});
