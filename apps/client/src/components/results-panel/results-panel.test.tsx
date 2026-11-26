import { RoomState } from '@planitpoker/shared';
import { fireEvent, render } from '@testing-library/react';
import { App as AntApp } from 'antd';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import * as SocketContextModule from '../../context/socket-context/use-socket';
import { createMockSocketValue } from '../../tests/socket-context.mock';
import { ResultsPanel } from './results-panel';

// The real modal keeps its content mounted while the leave animation runs,
// which jsdom never completes. Render only the open modal so the session gate
// can be asserted deterministically.
vi.mock('antd', async (importOriginal) => {
    const actual = await importOriginal<typeof import('antd')>();
    const { createElement } = await import('react');
    const MockModal = (props: React.ComponentProps<typeof actual.Modal>) =>
        props.open ? createElement(actual.Modal, props) : null;

    return { ...actual, Modal: Object.assign(MockModal, actual.Modal) };
});

const mockRevealedRoomState: RoomState = {
    activeDeck: [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'],
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
            name: 'Alice',
            vote: 5,
        },
        {
            avatar: '🎨',
            color: '#3b82f6',
            hasVoted: true,
            id: 'user_2',
            isAdmin: false,
            isHost: false,
            isOnline: true,
            isSpectator: false,
            name: 'Bob',
            vote: 5,
        },
    ],
    stories: [
        {
            id: 'story_1',
            rounds: [],
            status: 'estimating',
            title: 'Setup Database Migration',
        },
    ],
    timer: null,
    title: 'Sprint 10 Estimation',
    votesRevealed: true,
};

describe('ResultsPanel', () => {
    it('reports unanimous voting and offers the admin to accept the average', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ roomState: mockRevealedRoomState })
        );

        const screen = render(
            <AntApp>
                <ResultsPanel />
            </AntApp>
        );

        expect(screen.getByText('Estimation Results')).toBeInTheDocument();
        expect(screen.getByText(/100% Consensus/i)).toBeInTheDocument();
        // Unanimous votes put the average and the median on the same figure.
        expect(screen.getAllByText('5.0')).toHaveLength(2);
        expect(screen.getByRole('button', { name: /Accept Avg/i })).toBeInTheDocument();
    });

    it('accepts the suggested estimate as a number, not the formatted text', () => {
        const socket = createMockSocketValue({ roomState: mockRevealedRoomState });
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);

        const screen = render(
            <AntApp>
                <ResultsPanel />
            </AntApp>
        );
        fireEvent.click(screen.getByRole('button', { name: /Accept Avg/i }));
        fireEvent.click(screen.getByRole('button', { name: /Save & Advance/i }));

        expect(socket.updateStoryEstimate).toHaveBeenCalledWith('story_1', 5);
    });

    it('closes the confirmation dialog when the session ends', async () => {
        const socket = createMockSocketValue({ roomState: mockRevealedRoomState });
        const socketSpy = vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);
        const view = render(
            <AntApp>
                <ResultsPanel />
            </AntApp>
        );

        fireEvent.click(view.getByRole('button', { name: /Accept Avg/i }));
        expect(
            await view.findByRole('dialog', { name: /Confirm Story Change/i })
        ).toBeInTheDocument();

        socketSpy.mockReturnValue(
            createMockSocketValue({
                roomState: { ...mockRevealedRoomState, isEnded: true },
            })
        );
        view.rerender(
            <AntApp>
                <ResultsPanel />
            </AntApp>
        );

        expect(
            view.queryByRole('dialog', { name: /Confirm Story Change/i })
        ).not.toBeInTheDocument();
        expect(socket.updateStoryEstimate).not.toHaveBeenCalled();
    });

    it('closes the custom-score dialog when the session ends', async () => {
        const socket = createMockSocketValue({ roomState: mockRevealedRoomState });
        const socketSpy = vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);
        const view = render(
            <AntApp>
                <ResultsPanel />
            </AntApp>
        );

        fireEvent.click(view.getByRole('button', { name: /Custom Score/i }));
        expect(
            await view.findByRole('dialog', { name: /Set Custom Story Score/i })
        ).toBeInTheDocument();

        socketSpy.mockReturnValue(
            createMockSocketValue({
                roomState: { ...mockRevealedRoomState, isEnded: true },
            })
        );
        view.rerender(
            <AntApp>
                <ResultsPanel />
            </AntApp>
        );

        expect(
            view.queryByRole('dialog', { name: /Set Custom Story Score/i })
        ).not.toBeInTheDocument();
        expect(socket.updateStoryEstimate).not.toHaveBeenCalled();
    });

    it('hides the accept action from non-admin participants', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({
                currentUserId: 'user_2',
                isAdmin: false,
                isHost: false,
                roomState: mockRevealedRoomState,
            })
        );

        const screen = render(
            <AntApp>
                <ResultsPanel />
            </AntApp>
        );

        expect(screen.getByText('Estimation Results')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Accept Avg/i })).not.toBeInTheDocument();
    });

    it('shows a finalized story with its saved estimate and no accept action', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({
                roomState: {
                    ...mockRevealedRoomState,
                    stories: [
                        {
                            ...mockRevealedRoomState.stories[0],
                            finalEstimate: 5,
                            status: 'completed',
                        },
                    ],
                },
            })
        );

        const screen = render(
            <AntApp>
                <ResultsPanel />
            </AntApp>
        );

        expect(screen.queryByRole('button', { name: /Accept Avg/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Custom Score/i })).not.toBeInTheDocument();
        expect(screen.getByText('Final estimate: 5')).toBeInTheDocument();
        // The statistics stay readable after the story is accepted.
        expect(screen.getAllByText('5.0')).toHaveLength(2);
    });
});
