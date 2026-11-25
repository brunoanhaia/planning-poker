import {
    EstimateValue,
    MAX_DESCRIPTION_LENGTH,
    MAX_STORIES_PER_ROOM,
    MAX_TITLE_LENGTH,
    RoomState,
    Story,
} from '@planitpoker/shared';

import { generateStoryId } from './idGenerator.js';

/**
 * Reports whether a room's backlog has reached its quota.
 *
 * @param room - The active room state.
 * @returns True when no further story can be added.
 */
export const isBacklogFull = (room: RoomState): boolean =>
    room.stories.length >= MAX_STORIES_PER_ROOM;

/**
 * Adds a new user story to the backlog of a room.
 *
 * @param room - The active room state.
 * @param title - The title or headline of the story.
 * @param description - Optional details or acceptance criteria.
 * @returns The updated RoomState, or null when the backlog is full.
 */
export const addStoryToRoom = (
    room: RoomState,
    title: string,
    description?: string
): RoomState | null => {
    if (isBacklogFull(room)) {
        return null;
    }

    const trimmedTitle = title.trim().slice(0, MAX_TITLE_LENGTH);
    if (!trimmedTitle) {
        // A blank title is a no-op, not a rejection: the caller reports a null
        // result as an authorization failure, which would be a lie.
        return room;
    }

    const newStory: Story = {
        description: description?.trim().slice(0, MAX_DESCRIPTION_LENGTH),
        id: generateStoryId(),
        rounds: [],
        status: 'pending',
        title: trimmedTitle,
    };

    room.stories.push(newStory);
    return room;
};

/**
 * Bulk adds multiple user stories to the backlog.
 *
 * Stops at the backlog quota: a room that already holds stories keeps the ones
 * it has and refuses the rest instead of accepting an unbounded import.
 *
 * @param room - The active room state.
 * @param storiesList - Array of story title and description pairs.
 * @returns The updated RoomState, or null when the backlog is already full.
 */
export const bulkAddStoriesToRoom = (
    room: RoomState,
    storiesList: { description?: string; title: string }[]
): RoomState | null => {
    if (!Array.isArray(storiesList) || isBacklogFull(room)) {
        return null;
    }

    const accepted: Story[] = [];
    for (const item of storiesList) {
        if (room.stories.length + accepted.length >= MAX_STORIES_PER_ROOM) {
            break;
        }
        const trimmedTitle = item.title?.trim().slice(0, MAX_TITLE_LENGTH);
        if (trimmedTitle) {
            accepted.push({
                description: item.description?.trim().slice(0, MAX_DESCRIPTION_LENGTH),
                id: generateStoryId(),
                rounds: [],
                status: 'pending',
                title: trimmedTitle,
            });
        }
    }

    if (accepted.length === 0) {
        return room;
    }

    room.stories.push(...accepted);
    return room;
};

/**
 * Sets the active story index for estimation and marks its status as 'estimating'.
 *
 * @param room - The active room state.
 * @param storyIndex - The target index in the stories array.
 * @returns The updated RoomState or null if index is out of bounds.
 */
export const setRoomCurrentStory = (room: RoomState, storyIndex: number): RoomState | null => {
    if (storyIndex < 0 || storyIndex >= room.stories.length) {
        return null;
    }

    room.currentStoryIndex = storyIndex;
    room.stories.forEach((story, index) => {
        if (index === storyIndex) {
            story.status = 'estimating';
            return;
        }
        // Only the active story is being estimated; leaving the previous one
        // behind made the backlog show two `estimating` badges at once.
        if (story.status === 'estimating') {
            story.status = 'pending';
        }
    });

    return room;
};

/**
 * Updates the final finalized estimate for a story and marks it as completed.
 *
 * @param room - The active room state.
 * @param storyId - The identifier of the story to update.
 * @param estimate - The agreed-upon estimate value.
 * @returns The updated RoomState or null if story was not found.
 */
export const updateStoryEstimateInRoom = (
    room: RoomState,
    storyId: string,
    estimate: EstimateValue
): RoomState | null => {
    const story = room.stories.find((s) => s.id === storyId);
    if (!story) {
        return null;
    }

    story.finalEstimate = estimate;
    story.status = estimate === null ? 'pending' : 'completed';
    return room;
};

/**
 * Deletes a story from the room backlog and keeps the active index coherent.
 *
 * Removing a story before the active one shifts every following index, so the
 * pointer has to move with the list. Removing the active story promotes the
 * story that takes its place (or the previous one when it was last) and marks
 * it as the one being estimated.
 *
 * @param room - The active room state.
 * @param storyId - The identifier of the story to delete.
 * @returns The updated RoomState, or null when the story does not exist.
 */
export const deleteStoryFromRoom = (room: RoomState, storyId: string): RoomState | null => {
    const deletedIndex = room.stories.findIndex((story) => story.id === storyId);
    if (deletedIndex === -1) {
        return null;
    }

    const wasCurrent = deletedIndex === room.currentStoryIndex;
    room.stories = room.stories.filter((story) => story.id !== storyId);

    if (deletedIndex < room.currentStoryIndex) {
        // The active story is still there, one position earlier.
        room.currentStoryIndex -= 1;
        return room;
    }

    if (!wasCurrent) {
        return room;
    }

    // The active story is gone: clamp to the last remaining position and make
    // that story the one under estimation, so the badge follows the room.
    room.currentStoryIndex = Math.max(0, Math.min(room.currentStoryIndex, room.stories.length - 1));
    const currentStory = room.stories[room.currentStoryIndex];
    if (currentStory) {
        currentStory.status = 'estimating';
    }

    return room;
};
