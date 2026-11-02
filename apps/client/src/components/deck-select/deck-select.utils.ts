import {
    DeckType,
    MAX_CUSTOM_DECK_SIZE,
    MAX_NAME_LENGTH,
    MIN_CUSTOM_DECK_SIZE,
    PRESET_DECKS,
} from '@planitpoker/shared';

/** A custom-deck rule violation, paired with the key that explains it. */
export interface CustomDeckError {
    /** Translation key of the message shown under the custom-deck field. */
    key: 'create.error.count' | 'create.error.duplicate' | 'create.error.label';
    /** Placeholders the message interpolates. */
    params?: Record<string, number>;
}

/** Renders the card list preview for a deck, using the custom label when picked. */
export const deckPreview = (deckType: DeckType, customLabel: string): string => {
    if (deckType === 'custom') {
        return customLabel;
    }
    return PRESET_DECKS[deckType].join(', ');
};

/** Parses the comma separated custom deck into numbers where possible. */
export const parseCustomDeck = (raw: string): (number | string)[] =>
    raw
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => (Number.isNaN(Number(entry)) ? entry : Number(entry)));

/**
 * Checks a parsed custom deck against the shared deck rules.
 *
 * @param cards - The cards parsed from the comma separated field.
 * @returns The first violated rule, or `null` when the deck is valid.
 */
export const validateCustomDeck = (cards: readonly (number | string)[]): CustomDeckError | null => {
    if (cards.length < MIN_CUSTOM_DECK_SIZE || cards.length > MAX_CUSTOM_DECK_SIZE) {
        return {
            key: 'create.error.count',
            params: { max: MAX_CUSTOM_DECK_SIZE, min: MIN_CUSTOM_DECK_SIZE },
        };
    }
    if (
        cards.some((card) =>
            typeof card === 'number' ? !Number.isFinite(card) : card.length > MAX_NAME_LENGTH
        )
    ) {
        return { key: 'create.error.label', params: { max: MAX_NAME_LENGTH } };
    }
    if (new Set(cards.map(String)).size !== cards.length) {
        return { key: 'create.error.duplicate' };
    }
    return null;
};

/**
 * Compares two card lists by value.
 *
 * @param left - The cards about to be sent.
 * @param right - The cards the room currently holds, if any.
 * @returns `true` when both lists hold the same cards in the same order.
 */
export const hasSameCards = (
    left: readonly (number | string)[],
    right: readonly (number | string)[] | undefined
): boolean => {
    if (!right || left.length !== right.length) {
        return false;
    }
    return left.every((card, index) => card === right[index]);
};
