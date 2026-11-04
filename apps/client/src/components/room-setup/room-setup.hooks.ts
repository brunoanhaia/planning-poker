import { DeckType, MAX_STORIES_PER_ROOM, RoomState } from '@planitpoker/shared';
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

/** A message shown above the setup actions, styled by its outcome. */
export interface SetupNotice {
    /** Whether the message reports a success or something the admin must fix. */
    kind: 'success' | 'warning';
    /** Translated message. */
    message: string;
}

/** A start dispatch waiting for the room to report the staged stories. */
interface StartRequest {
    /** Total backlog size the room must report before Start is re-enabled. */
    storyCount: number;
}

/** Whether a start dispatch is still waiting for the room or a server error. */
const isStartPending = (
    request: null | StartRequest,
    room: null | RoomState,
    error: null | string
): boolean =>
    request !== null && (room?.stories.length ?? 0) < request.storyCount && error === null;

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
    /** True while the start dispatch waits for the room to report the stories. */
    isStarting: boolean;
    /** Feedback about a paste or a full backlog, or `null` when there is none. */
    notice: null | SetupNotice;
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
 * Title and deck are nullable drafts over the live room: an untouched field
 * follows changes made elsewhere, while an edit wins at Start. The staged
 * stories stay local until then, which keeps the backlog empty (and the setup
 * screen visible) until the first one activates in the domain.
 */
export const useRoomSetup = (): RoomSetupModel => {
    const { bulkAddStories, changeDeck, clearError, error, isAdmin, roomState, updateRoomTitle } =
        useSocket();
    const { t } = useTranslation();

    // Nullable drafts fall back to the live room for fields the admin has not
    // edited. That keeps a title or a deck applied from the settings modal (or
    // by a co-host) visible here, instead of Start reverting it to the values
    // the room held when this screen mounted.
    const [titleDraft, setTitleDraft] = useState<null | string>(null);
    const [deckTypeDraft, setDeckTypeDraft] = useState<DeckType | null>(null);
    const [customDeckDraft, setCustomDeckDraft] = useState<null | string>(null);
    const [customDeckError, setCustomDeckError] = useState<null | string>(null);
    const [storyTitle, setStoryTitle] = useState('');
    const [storyDescription, setStoryDescription] = useState('');
    const [bulkText, setBulkText] = useState('');
    const [stagedStories, setStagedStories] = useState<StagedStory[]>([]);
    const [notice, setNotice] = useState<null | SetupNotice>(null);
    const [startRequest, setStartRequest] = useState<null | StartRequest>(null);

    // A start request stays active until the room reports every staged story or
    // the server answers with an error. The count, rather than the room
    // reference, keeps the guard active across the title and deck broadcasts
    // that arrive before the stories.
    const isStarting = isStartPending(startRequest, roomState, error);

    const roomTitle = titleDraft ?? roomState?.title ?? '';
    const deckType = deckTypeDraft ?? roomState?.deckType ?? 'fibonacci';
    const customDeck = customDeckDraft ?? roomState?.customDeck?.join(', ') ?? '';

    const existingStories = roomState?.stories.length ?? 0;
    const remainingCapacity = Math.max(
        0,
        MAX_STORIES_PER_ROOM - existingStories - stagedStories.length
    );

    const changeCustomDeck = (value: string) => {
        setCustomDeckDraft(value);
        setCustomDeckError(null);
    };

    const changeDeckType = (nextDeckType: DeckType) => {
        setDeckTypeDraft(nextDeckType);
        setCustomDeckError(null);
    };

    const addStagedStory = () => {
        setStartRequest(null);
        const title = storyTitle.trim();
        if (!title) {
            return;
        }
        if (remainingCapacity === 0) {
            setNotice({
                kind: 'warning',
                message: t('backlog.imported.skipped', {
                    max: MAX_STORIES_PER_ROOM,
                    skipped: 1,
                }),
            });
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
        setStartRequest(null);
        const parsed = parseBulkStories(bulkText);
        const stories = parsed.slice(0, remainingCapacity);
        if (stories.length === 0) {
            // Nothing usable in the paste is a different problem from a full
            // backlog, and telling the admin the wrong one wastes their time.
            setNotice({
                kind: 'warning',
                message:
                    parsed.length === 0
                        ? t('backlog.imported.none')
                        : t('backlog.imported.skipped', {
                              max: MAX_STORIES_PER_ROOM,
                              skipped: parsed.length,
                          }),
            });
            return;
        }
        setStagedStories((current) => [
            ...current,
            ...stories.map((story) => ({ ...story, key: `staged_${++stagedStorySeed}` })),
        ]);
        setBulkText('');
        const skipped = parsed.length - stories.length;
        setNotice({
            kind: skipped > 0 ? 'warning' : 'success',
            message:
                skipped > 0
                    ? t('backlog.imported.skipped', {
                          max: MAX_STORIES_PER_ROOM,
                          skipped,
                      })
                    : t('setup.bulk.added', { count: stories.length }),
        });
    };

    const removeStagedStory = (index: number) => {
        setStartRequest(null);
        setStagedStories((current) => current.filter((_, position) => position !== index));
        // Removing an entry frees capacity, so a "backlog is full" warning no
        // longer describes the state the admin is looking at.
        setNotice(null);
    };

    const applyRoomTitle = (room: RoomState) => {
        const title = roomTitle.trim();
        if (title && title !== room.title) {
            updateRoomTitle(title);
        }
    };

    const applyDeck = (room: RoomState, cards: (number | string)[] | undefined) => {
        if (deckType !== room.deckType) {
            if (cards) {
                changeDeck(deckType, cards);
                return;
            }
            changeDeck(deckType);
            return;
        }
        if (deckType === 'custom' && cards && !hasSameCards(cards, room.customDeck)) {
            changeDeck('custom', cards);
        }
    };

    const resolveDeckCards = (): { cards?: (number | string)[]; isValid: boolean } => {
        if (deckType !== 'custom') {
            return { isValid: true };
        }
        const cards = parseCustomDeck(customDeck);
        const error = validateCustomDeck(cards);
        if (!error) {
            return { cards, isValid: true };
        }
        setCustomDeckError(t(error.key, error.params));
        return { isValid: false };
    };

    const startEstimating = () => {
        if (!roomState || stagedStories.length === 0 || isStarting) {
            return;
        }
        const { cards, isValid } = resolveDeckCards();
        if (!isValid) {
            return;
        }

        clearError();
        setStartRequest({
            storyCount: roomState.stories.length + stagedStories.length,
        });
        applyRoomTitle(roomState);
        applyDeck(roomState, cards);

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
        isStarting,
        notice,
        removeStagedStory,
        roomTitle,
        setBulkText,
        setCustomDeck: changeCustomDeck,
        setDeckType: changeDeckType,
        setRoomTitle: setTitleDraft,
        setStoryDescription,
        setStoryTitle,
        stagedStories,
        startEstimating,
        storyDescription,
        storyTitle,
    };
};
