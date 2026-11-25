import {
    CardValue,
    MAX_CUSTOM_DECK_SIZE,
    MAX_NAME_LENGTH,
    MIN_CUSTOM_DECK_SIZE,
} from '@planitpoker/shared';

import { Translate } from '../i18n/i18n-context';

/** Why a comma-separated custom deck could not be accepted. */
export type CustomDeckError = 'count' | 'duplicate' | 'label';

/** Outcome of reading a custom deck from its text field. */
export interface CustomDeckParseResult {
    /** Cards read from the field, even when the deck was rejected. */
    cards: CardValue[];
    /** Rejection reason, or `null` when the deck may be applied. */
    error: CustomDeckError | null;
}

/**
 * Parses the comma-separated custom deck into numbers where possible.
 *
 * Validation mirrors the server's `customDeckSchema`: the same card bounds,
 * label length and uniqueness rules. Running both halves here means the dialog
 * reports a fixable problem instead of silently substituting a different deck
 * the administrator never chose.
 *
 * @param raw - The text currently in the custom deck field.
 * @returns The parsed cards and, when present, the reason they are unusable.
 */
export const parseCustomDeck = (raw: string): CustomDeckParseResult => {
    const cards = raw
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
        .map((entry) => (Number.isNaN(Number(entry)) ? entry : Number(entry)));

    if (cards.length < MIN_CUSTOM_DECK_SIZE || cards.length > MAX_CUSTOM_DECK_SIZE) {
        return { cards, error: 'count' };
    }

    const hasInvalidCard = cards.some((card) =>
        typeof card === 'number' ? !Number.isFinite(card) : card.length > MAX_NAME_LENGTH
    );
    if (hasInvalidCard) {
        return { cards, error: 'label' };
    }

    if (new Set(cards.map(String)).size !== cards.length) {
        return { cards, error: 'duplicate' };
    }

    return { cards, error: null };
};

/**
 * Renders a custom deck rejection in the active language.
 *
 * The messages are shared with the create-session form, so both entry points
 * explain the same rule with the same wording.
 *
 * @param error - The rejection returned by {@link parseCustomDeck}.
 * @param t - Translator bound to the active language.
 * @returns The human-readable reason the deck cannot be applied.
 */
export const translateCustomDeckError = (error: CustomDeckError, t: Translate): string => {
    if (error === 'count') {
        return t('create.error.count', { max: MAX_CUSTOM_DECK_SIZE, min: MIN_CUSTOM_DECK_SIZE });
    }
    if (error === 'label') {
        return t('create.error.label', { max: MAX_NAME_LENGTH });
    }
    return t('create.error.duplicate');
};
