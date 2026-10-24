import { DeckType, ErrorCode, Language } from '@planitpoker/shared';

import enJson from './locales/en.json';
import ptBRJson from './locales/pt-BR.json';

/**
 * Shape every translation must implement, derived from the English catalog.
 *
 * The catalogs are plain JSON so a translator can open them in any i18next-aware
 * tool; the compiler still rejects a translation that is missing a key, and the
 * i18n spec rejects one that invents an extra key.
 */
export type Dictionary = Record<keyof typeof enJson, string>;

export const en: Dictionary = enJson;
export const ptBR: Dictionary = ptBRJson;

/**
 * Every dictionary the interface can render without a network round trip.
 *
 * English is the fallback and Brazilian Portuguese is the audience the product
 * already had, so both are bundled: a reload in either never flashes another
 * language.
 */
export const INLINE_DICTIONARIES: Partial<Record<Language, Dictionary>> = {
    en,
    'pt-BR': ptBR,
};

/**
 * Loaders for the dictionaries that ship as their own chunk.
 *
 * Anything added later is fetched when it is picked, so the initial bundle does
 * not grow with the language list.
 */
export const LOCALE_LOADERS: Partial<Record<Language, () => Promise<{ default: Dictionary }>>> = {
    es: () => import('./locales/es.json'),
};

/** Plural categories CLDR defines; a dictionary may use any subset. */
type PluralSuffix = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

/**
 * Strips an i18next plural suffix, turning `backlog.rounds_other` into the key
 * callers actually write (`backlog.rounds`).
 */
type StripPluralSuffix<Key extends string> = Key extends `${infer Base}_${infer Suffix}`
    ? Suffix extends PluralSuffix
        ? Base
        : Key
    : Key;

/** Keys a component may pass to `t`: a literal key, or the base of a plural. */
export type TranslationKey = keyof Dictionary | StripPluralSuffix<keyof Dictionary>;

/** Translation of a deck name, which the shared package only carries in English. */
export const deckLabelKey = (deckType: DeckType): keyof Dictionary =>
    `deck.type.${deckType}` as keyof Dictionary;

/**
 * Translation key per server error code.
 *
 * An explicit map, rather than building the key from the code, is what makes
 * the compiler catch a new `ErrorCode` nobody translated.
 */
export const ERROR_KEYS: Record<ErrorCode, keyof Dictionary> = {
    BANNED: 'error.BANNED',
    FORBIDDEN: 'error.FORBIDDEN',
    INVALID_DECK: 'error.INVALID_DECK',
    INVALID_MESSAGE: 'error.INVALID_MESSAGE',
    INVALID_PAYLOAD: 'error.INVALID_PAYLOAD',
    INVALID_STORY_INDEX: 'error.INVALID_STORY_INDEX',
    INVALID_VOTE: 'error.INVALID_VOTE',
    NO_SESSION: 'error.NO_SESSION',
    PARTICIPANT_LIMIT_REACHED: 'error.PARTICIPANT_LIMIT_REACHED',
    RATE_LIMITED: 'error.RATE_LIMITED',
    ROOM_FULL: 'error.ROOM_FULL',
    ROOM_LIMIT_REACHED: 'error.ROOM_LIMIT_REACHED',
    ROOM_LOCKED: 'error.ROOM_LOCKED',
    ROOM_NOT_FOUND: 'error.ROOM_NOT_FOUND',
    SESSION_ENDED: 'error.SESSION_ENDED',
    STORY_LIMIT_REACHED: 'error.STORY_LIMIT_REACHED',
    UNKNOWN_ACTION: 'error.UNKNOWN_ACTION',
};

/** Translation key of a server error code, defaulting to the generic message. */
export const errorKey = (code: ErrorCode | undefined): keyof Dictionary =>
    code ? ERROR_KEYS[code] : 'error.generic';
