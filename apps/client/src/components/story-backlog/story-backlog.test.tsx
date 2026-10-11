import { MAX_STORIES_PER_ROOM, RoomState, Story } from '@planitpoker/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { App as AntApp } from 'antd';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import * as SocketContextModule from '../../context/socket-context/use-socket';
import { createMockSocketValue } from '../../tests/socket-context.mock';
import { StoryBacklog } from './story-backlog';

/** A room whose backlog already holds `storyCount` stories. */
const roomWithStories = (storyCount: number): RoomState => {
    const stories: Story[] = Array.from({ length: storyCount }, (_, index) => ({
        id: `story_${index}`,
        status: 'pending',
        title: `Story ${index}`,
    }));

    return {
        activeDeck: [1, 2, 3, 5, 8],
        autoReveal: false,
        createdAt: Date.now(),
        currentStoryIndex: 0,
        deckType: 'fibonacci',
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

    it('caps the paste at the capacity the room still has', { timeout: 30_000 }, () => {
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

    it('explains itself instead of closing when the backlog is full', { timeout: 30_000 }, () => {
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
