import { RoomState } from '@planitpoker/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import * as SocketContextModule from '../../context/socket-context/use-socket';
import { createMockSocketValue } from '../../tests/socket-context.mock';
import { RoomSetup } from './room-setup';

const buildRoomState = (overrides: Partial<RoomState> = {}): RoomState => ({
    activeDeck: [1, 2, 3, 5, 8, 13, 21],
    autoReveal: false,
    createdAt: Date.now(),
    currentStoryIndex: 0,
    deckType: 'fibonacci',
    endedAt: null,
    hostId: 'user_1',
    id: 'ROOM01',
    isEnded: false,
    isLocked: false,
    participants: [],
    stories: [],
    timer: null,
    title: 'Sprint 42',
    votesRevealed: false,
    ...overrides,
});

/** Renders the setup screen against a mocked socket session. */
const renderSetup = () => render(<RoomSetup onOpenSettings={vi.fn()} />);

/** Fills the single-story fields and stages the story. */
const stageStory = (title: string, description?: string) => {
    fireEvent.change(screen.getByLabelText('Story Title'), { target: { value: title } });
    if (description) {
        fireEvent.change(screen.getByLabelText('Description / Acceptance Criteria'), {
            target: { value: description },
        });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Add Story' }));
};

/** Picks a deck through the Ant Design select. */
const pickDeck = async (label: string) => {
    fireEvent.mouseDown(screen.getByLabelText('Estimation Deck Type'));
    fireEvent.click(
        await screen.findByText(label, { selector: '.ant-select-item-option-content' })
    );
};

describe('RoomSetup', () => {
    it('renders the setup with a disabled start while nothing is staged', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ roomState: buildRoomState() })
        );

        renderSetup();

        expect(screen.getByLabelText('Room / Sprint Title')).toHaveValue('Sprint 42');
        expect(screen.getByLabelText('Estimation Deck Type')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start Estimating' })).toBeDisabled();
    });

    it('stages a story and removes it again', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ roomState: buildRoomState() })
        );

        renderSetup();
        stageStory('Checkout flow', 'Guest checkout works');

        expect(screen.getByText('Checkout flow')).toBeInTheDocument();
        expect(screen.getByText('Guest checkout works')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start Estimating' })).toBeEnabled();

        fireEvent.click(screen.getByRole('button', { name: 'Remove Checkout flow' }));

        expect(screen.queryByText('Checkout flow')).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Start Estimating' })).toBeDisabled();
    });

    it('caps a bulk paste at the room capacity and warns when nothing parses', () => {
        const stories = Array.from({ length: 199 }, (_, index) => ({
            id: `story_${index}`,
            rounds: [],
            status: 'estimating' as const,
            title: `Story ${index}`,
        }));
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ roomState: buildRoomState({ stories }) })
        );

        renderSetup();
        fireEvent.change(screen.getByLabelText('User Stories (One per line)'), {
            target: { value: 'A\nB\nC' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Add Stories' }));

        expect(screen.getByText('A')).toBeInTheDocument();
        expect(screen.queryByText('B')).not.toBeInTheDocument();
        expect(
            screen.getByText('The backlog holds at most 200 stories; 2 were skipped.')
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Add Stories' }));

        expect(
            screen.getByText(
                'No story could be read. Give each line a title, as "Title; Description".'
            )
        ).toBeInTheDocument();
    });

    it('sends the changed title, the changed deck and then the staged stories, in order', async () => {
        const socket = createMockSocketValue({ roomState: buildRoomState() });
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);

        renderSetup();
        fireEvent.change(screen.getByLabelText('Room / Sprint Title'), {
            target: { value: 'Sprint 43' },
        });
        await pickDeck('T-Shirt Sizes');
        stageStory('Checkout flow');

        fireEvent.click(screen.getByRole('button', { name: 'Start Estimating' }));

        expect(socket.updateRoomTitle).toHaveBeenCalledWith('Sprint 43');
        expect(socket.changeDeck).toHaveBeenCalledWith('tshirt');
        expect(socket.bulkAddStories).toHaveBeenCalledWith([{ title: 'Checkout flow' }]);
        expect(vi.mocked(socket.updateRoomTitle).mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(socket.changeDeck).mock.invocationCallOrder[0]
        );
        expect(vi.mocked(socket.changeDeck).mock.invocationCallOrder[0]).toBeLessThan(
            vi.mocked(socket.bulkAddStories).mock.invocationCallOrder[0]
        );
    });

    it('skips the title and deck messages when neither changed', () => {
        const socket = createMockSocketValue({ roomState: buildRoomState() });
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);

        renderSetup();
        stageStory('Checkout flow');

        fireEvent.click(screen.getByRole('button', { name: 'Start Estimating' }));

        expect(socket.updateRoomTitle).not.toHaveBeenCalled();
        expect(socket.changeDeck).not.toHaveBeenCalled();
        expect(socket.bulkAddStories).toHaveBeenCalledWith([{ title: 'Checkout flow' }]);
    });

    it('picks up title and deck changes made elsewhere instead of reverting them', () => {
        const socket = createMockSocketValue({ roomState: buildRoomState() });
        const useSocket = vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);
        const { rerender } = renderSetup();
        stageStory('Checkout flow');

        // The settings modal, or a co-host, applies a new title and a custom
        // deck while this screen is open. The setup drafts are still untouched.
        const updatedSocket = createMockSocketValue({
            roomState: buildRoomState({
                customDeck: [2, 3, 5],
                deckType: 'custom',
                title: 'Sprint 43',
            }),
        });
        useSocket.mockReturnValue(updatedSocket);
        rerender(<RoomSetup onOpenSettings={vi.fn()} />);

        expect(screen.getByLabelText('Room / Sprint Title')).toHaveValue('Sprint 43');
        expect(screen.getByLabelText('Comma-Separated Custom Cards')).toHaveValue('2, 3, 5');

        fireEvent.click(screen.getByRole('button', { name: 'Start Estimating' }));

        expect(updatedSocket.updateRoomTitle).not.toHaveBeenCalled();
        expect(updatedSocket.changeDeck).not.toHaveBeenCalled();
        expect(updatedSocket.bulkAddStories).toHaveBeenCalledWith([{ title: 'Checkout flow' }]);
    });

    it('blocks the dispatch when the custom deck is invalid', async () => {
        const socket = createMockSocketValue({ roomState: buildRoomState() });
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(socket);

        renderSetup();
        await pickDeck('Custom Deck');
        fireEvent.change(screen.getByLabelText('Comma-Separated Custom Cards'), {
            target: { value: '1' },
        });
        stageStory('Checkout flow');

        fireEvent.click(screen.getByRole('button', { name: 'Start Estimating' }));

        expect(screen.getByRole('alert')).toHaveTextContent('Enter between 2 and 30 cards.');
        expect(socket.changeDeck).not.toHaveBeenCalled();
        expect(socket.bulkAddStories).not.toHaveBeenCalled();
    });

    it('shows the waiting state to a non-admin instead of the form', () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({
                isAdmin: false,
                isHost: false,
                roomState: buildRoomState(),
            })
        );

        renderSetup();

        expect(screen.getByText('Waiting for the host to set up the session')).toBeInTheDocument();
        expect(screen.queryByLabelText('Story Title')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Start Estimating' })).not.toBeInTheDocument();
    });
});
