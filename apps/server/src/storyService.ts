import { CardValue, RoomState, Story } from '@planitpoker/shared';

import { generateStoryId } from './idGenerator.js';

/**
 * Adds a new user story to the backlog of a room.
 *
 * @param room - The active room state.
 * @param title - The title or headline of the story.
 * @param description - Optional details or acceptance criteria.
 * @returns The updated RoomState.
 */
export const addStoryToRoom = (room: RoomState, title: string, description?: string): RoomState => {
    const newStory: Story = {
        description,
        id: generateStoryId(),
        status: 'pending',
        title,
    };

    room.stories.push(newStory);
    return room;
};

/**
 * Bulk adds multiple user stories to the backlog.
 *
 * @param room - The active room state.
 * @param storiesList - Array of story title and description pairs.
 * @returns The updated RoomState.
 */
export const bulkAddStoriesToRoom = (
    room: RoomState,
    storiesList: { description?: string; title: string }[]
): RoomState => {
    if (!Array.isArray(storiesList)) {
        return room;
    }

    storiesList.forEach((item) => {
        const trimmedTitle = item.title?.trim();
        if (trimmedTitle) {
            room.stories.push({
                description: item.description?.trim(),
                id: generateStoryId(),
                status: 'pending',
                title: trimmedTitle,
            });
        }
    });

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
    estimate: CardValue
): RoomState | null => {
    const story = room.stories.find((s) => s.id === storyId);
    if (!story) {
        return null;
    }

    story.finalEstimate = estimate;
    story.status = 'completed';
    return room;
};

/**
 * Deletes a story from the room backlog and adjusts the active index if needed.
 *
 * @param room - The active room state.
 * @param storyId - The identifier of the story to delete.
 * @returns The updated RoomState.
 */
export const deleteStoryFromRoom = (room: RoomState, storyId: string): RoomState => {
    room.stories = room.stories.filter((s) => s.id !== storyId);
    if (room.currentStoryIndex >= room.stories.length) {
        room.currentStoryIndex = Math.max(0, room.stories.length - 1);
    }
    return room;
};
