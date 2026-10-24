import i18n from 'i18next';

import { Translate } from '../i18n/i18n-context';

/**
 * Translator bound to the running i18next instance, for tests that call a pure
 * helper instead of rendering a component.
 *
 * `src/setupTests.ts` initialises i18next with the shipped dictionaries before
 * any spec runs, so this reads the same English copy the UI would.
 */
export const enTranslate: Translate = (key, params) =>
    i18n.t(key as string, params ?? {}) as string;
