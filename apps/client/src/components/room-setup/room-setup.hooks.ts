import { DeckType, MAX_STORIES_PER_ROOM } from '@planitpoker/shared';
import { useState } from 'react';

import { useSocket } from '../../context/socket-context/use-socket';
import { useTranslation } from '../../i18n/use-translation';
import {
    parseCustomDeck,
    hasSameCards,
    validateCustomDeck,
} from '../deck-select/deck-select.utils';
import { parseBulkStories } from '../story-backlog/story-backlog.utils';

/** A story the admin staged locally, before the setup screen sends it. */
export interface StagedStory {
    description?: string;
    /** Stable React key; stripped before the stories travel to the server. */
    key: string;
    title: string;
}

/** Monotonic id for a locally staged story, so the list can be keyed by identity. */
let stagedStorySeed = 0;

/** Everything the setup screen renders, plus the actions it dispatches. */
export interface RoomSetupModel {
    /** Stages the story currently typed into the single-story fields. */
    addStagedStory: () => void;
    /** Parses the bulk field and appends the stories that fit. */
    addStoriesFromBulk: () => void;
    bulkText: string;
    customDeck: string;
    customDeckError: null | string;
    deckType: DeckType;
    isAdmin: boolean;
    /** Warning about a paste or a full backlog, or `null` when there is none. */
    notice: null | string;
    removeStagedStory: (index: number) => void;
    roomTitle: string;
    setBulkText: (value: string) => void;
    setCustomDeck: (value: string) => void;
    setDeckType: (deckType: DeckType) => void;
    setRoomTitle: (value: string) => void;
    setStoryDescription: (value: string) => void;
    setStoryTitle: (value: string) => void;
    /** Sends the title, the deck and the staged stories, then lets the room take over. */
    startEstimating: () => void;
    stagedStories: StagedStory[];
    storyDescription: string;
    storyTitle: string;
}

/**
 * Binds the setup screen to the live room and owns its local drafts.
 *
 * The title and deck start from the room, so "Start Estimating" only sends what
 * the admin actually changed; the staged stories stay local until then, which
 * keeps the backlog empty (and the setup screen visible) until the first one
 * activates in the domain.
 */
export const useRoomSetup = (): RoomSetupModel => {
    const { bulkAddStories, changeDeck, isAdmin, roomState, updateRoomTitle } = useSocket();
    const { t } = useTranslation();

    const [roomTitle, setRoomTitle] = useState(roomState?.title ?? '');
    const [deckType, setDeckType] = useState<DeckType>(roomState?.deckType ?? 'fibonacci');
    const [customDeck, setCustomDeck] = useState(roomState?.customDeck?.join(', ') ?? '');
    const [customDeckError, setCustomDeckError] = useState<null | string>(null);
    const [storyTitle, setStoryTitle] = useState('');
    const [storyDescription, setStoryDescription] = useState('');
    const [bulkText, setBulkText] = useState('');
    const [stagedStories, setStagedStories] = useState<StagedStory[]>([]);
    const [notice, setNotice] = useState<null | string>(null);

    const existingStories = roomState?.stories.length ?? 0;
    const remainingCapacity = Math.max(
        0,
        MAX_STORIES_PER_ROOM - existingStories - stagedStories.length
    );

    const changeCustomDeck = (value: string) => {
        setCustomDeck(value);
        setCustomDeckError(null);
    };

    const changeDeckType = (nextDeckType: DeckType) => {
        setDeckType(nextDeckType);
        setCustomDeckError(null);
    };

    const addStagedStory = () => {
        const title = storyTitle.trim();
        if (!title) {
            return;
        }
        if (remainingCapacity === 0) {
            setNotice(
                t('backlog.imported.skipped', {
                    max: MAX_STORIES_PER_ROOM,
                    skipped: 1,
                })
            );
            return;
        }
        const description = storyDescription.trim();
        const key = `staged_${++stagedStorySeed}`;
        setStagedStories((current) => [
            ...current,
            description ? { description, key, title } : { key, title },
        ]);
        setStoryTitle('');
        setStoryDescription('');
        setNotice(null);
    };

    const addStoriesFromBulk = () => {
        const parsed = parseBulkStories(bulkText);
        const stories = parsed.slice(0, remainingCapacity);
        if (stories.length === 0) {
            // Nothing usable in the paste is a different problem from a full
            // backlog, and telling the admin the wrong one wastes their time.
            setNotice(
                parsed.length === 0
                    ? t('backlog.imported.none')
                    : t('backlog.imported.skipped', {
                          max: MAX_STORIES_PER_ROOM,
                          skipped: parsed.length,
                      })
            );
            return;
        }
        setStagedStories((current) => [
            ...current,
            ...stories.map((story) => ({ ...story, key: `staged_${++stagedStorySeed}` })),
        ]);
        setBulkText('');
        const skipped = parsed.length - stories.length;
        setNotice(
            skipped > 0
                ? t('backlog.imported.skipped', { max: MAX_STORIES_PER_ROOM, skipped })
                : t('setup.bulk.added', { count: stories.length })
        );
    };

    const removeStagedStory = (index: number) => {
        setStagedStories((current) => current.filter((_, position) => position !== index));
    };

    const startEstimating = () => {
        if (!roomState || stagedStories.length === 0) {
            return;
        }

        let cards: (number | string)[] | undefined;
        if (deckType === 'custom') {
            cards = parseCustomDeck(customDeck);
            const error = validateCustomDeck(cards);
            if (error) {
                setCustomDeckError(t(error.key, error.params));
                return;
            }
        }

        const title = roomTitle.trim();
        if (title && title !== roomState.title) {
            updateRoomTitle(title);
        }
        if (deckType !== roomState.deckType) {
            if (cards) {
                changeDeck(deckType, cards);
            } else {
                changeDeck(deckType);
            }
        } else if (deckType === 'custom' && cards && !hasSameCards(cards, roomState.customDeck)) {
            changeDeck('custom', cards);
        }

        // The staged list is kept until the room reports the stories: the
        // server may still reject the import, and clearing early would hide
        // what the admin typed behind a screen that never leaves setup.
        bulkAddStories(
            stagedStories.map(({ description, title }) =>
                description ? { description, title } : { title }
            )
        );
        setNotice(null);
    };

    return {
        addStagedStory,
        addStoriesFromBulk,
        bulkText,
        customDeck,
        customDeckError,
        deckType,
        isAdmin,
        notice,
        removeStagedStory,
        roomTitle,
        setBulkText,
        setCustomDeck: changeCustomDeck,
        setDeckType: changeDeckType,
        setRoomTitle,
        setStoryDescription,
        setStoryTitle,
        stagedStories,
        startEstimating,
        storyDescription,
        storyTitle,
    };
};
