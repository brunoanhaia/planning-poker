import { MAX_STORIES_PER_ROOM, RoomState, Story } from '@planitpoker/shared';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App as AntApp } from 'antd';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import * as SocketContextModule from '../../context/socket-context/use-socket';
import { createMockSocketValue } from '../../tests/socket-context.mock';
import { StoryBacklog } from './story-backlog';

// The capacity tests only need the boundary, not 200 rendered Ant Design rows.
// The real ceiling stays enforced and tested on the server.
vi.mock('@planitpoker/shared', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, MAX_STORIES_PER_ROOM: 4 };
});

/** A room whose backlog already holds `storyCount` stories. */
const roomWithStories = (storyCount: number): RoomState => {
    const stories: Story[] = Array.from({ length: storyCount }, (_, index) => ({
        id: `story_${index}`,
        rounds: [],
        status: 'pending',
        title: `Story ${index}`,
    }));

    return {
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
        participants: [],
        stories,
        timer: null,
        title: 'Sprint 10 Estimation',
        votesRevealed: false,
    };
};

/** Opens the import dialog, pastes the text and confirms it. */
const runImport = (paste: string): void => {
    fireEvent.click(screen.getByRole('button', { name: 'Bulk import stories' }));
    fireEvent.change(screen.getByLabelText('User Stories (One per line)'), {
        target: { value: paste },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Import Stories' }));
};

describe('StoryBacklog bulk import', () => {
    it('sends a small paste as one import', () => {
        const bulkAddStories = vi.fn();
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ bulkAddStories, roomState: roomWithStories(0) })
        );
        render(
            <AntApp>
                <StoryBacklog />
            </AntApp>
        );

        runImport('Login API; Implement OAuth\nDashboard; Build widgets');

        expect(bulkAddStories).toHaveBeenCalledTimes(1);
        expect(bulkAddStories).toHaveBeenCalledWith([
            { description: 'Implement OAuth', title: 'Login API' },
            { description: 'Build widgets', title: 'Dashboard' },
        ]);
    });

    it('caps the paste at the capacity the room still has', () => {
        const bulkAddStories = vi.fn();
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({
                bulkAddStories,
                roomState: roomWithStories(MAX_STORIES_PER_ROOM - 2),
            })
        );
        render(
            <AntApp>
                <StoryBacklog />
            </AntApp>
        );

        runImport('One\nTwo\nThree\nFour');

        expect(bulkAddStories).toHaveBeenCalledWith([{ title: 'One' }, { title: 'Two' }]);
    });

    it('explains itself instead of closing when the backlog is full', () => {
        const bulkAddStories = vi.fn();
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({
                bulkAddStories,
                roomState: roomWithStories(MAX_STORIES_PER_ROOM),
            })
        );
        render(
            <AntApp>
                <StoryBacklog />
            </AntApp>
        );

        runImport('One\nTwo');

        expect(bulkAddStories).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Import Stories' })).toBeInTheDocument();
    });

    it('blames the paste, not the backlog, when nothing can be read', () => {
        const bulkAddStories = vi.fn();
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ bulkAddStories, roomState: roomWithStories(0) })
        );
        render(
            <AntApp>
                <StoryBacklog />
            </AntApp>
        );

        // Lines with no title parse to nothing, which is a different problem from
        // a full backlog and must not be reported as one.
        runImport('; description only\n   ');

        expect(bulkAddStories).not.toHaveBeenCalled();
        expect(screen.getByRole('button', { name: 'Import Stories' })).toBeInTheDocument();
    });
});

describe('StoryBacklog breakdown', () => {
    it('reflects updates and deletion of the selected story', async () => {
        const roomState = roomWithStories(2);
        const socket = vi
            .spyOn(SocketContextModule, 'useSocket')
            .mockReturnValue(createMockSocketValue({ roomState }));
        const backlog = (
            <AntApp>
                <StoryBacklog />
            </AntApp>
        );
        const { rerender } = render(backlog);

        fireEvent.click(screen.getAllByRole('button', { name: 'Breakdown' })[0]);
        expect(screen.getByRole('dialog')).toHaveTextContent('Story 0');

        const updatedStory: Story = {
            ...roomState.stories[0],
            finalEstimate: 8,
            rounds: [
                {
                    id: 'round_1',
                    revealedAt: Date.now(),
                    votes: [{ name: 'Alice', participantId: 'user_1', vote: 5 }],
                },
            ],
            title: 'Updated story',
        };
        socket.mockReturnValue(
            createMockSocketValue({
                roomState: { ...roomState, stories: [updatedStory, roomState.stories[1]] },
            })
        );
        rerender(
            <AntApp>
                <StoryBacklog />
            </AntApp>
        );

        const dialog = within(screen.getByRole('dialog'));
        expect(dialog.getByText(/Updated story/)).toBeInTheDocument();
        expect(dialog.getByText('Alice: 5')).toBeInTheDocument();
        expect(dialog.getByText('8')).toBeInTheDocument();

        socket.mockReturnValue(
            createMockSocketValue({
                roomState: { ...roomState, stories: [roomState.stories[1]] },
            })
        );
        rerender(
            <AntApp>
                <StoryBacklog />
            </AntApp>
        );

        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('clears the selection when closed', async () => {
        vi.spyOn(SocketContextModule, 'useSocket').mockReturnValue(
            createMockSocketValue({ roomState: roomWithStories(2) })
        );
        render(
            <AntApp>
                <StoryBacklog />
            </AntApp>
        );

        fireEvent.click(screen.getAllByRole('button', { name: 'Breakdown' })[0]);
        fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

        fireEvent.click(screen.getAllByRole('button', { name: 'Breakdown' })[1]);
        expect(screen.getByRole('dialog')).toHaveTextContent('Story 1');
    });
});
