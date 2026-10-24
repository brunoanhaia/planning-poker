import { en } from '../i18n/dictionary';
import { Translate } from '../i18n/i18n-context';

/**
 * Translator bound to the English dictionary, for tests that assert copy.
 *
 * The English strings are the contract the tests check, so they are read from
 * the shipped dictionary instead of being duplicated in each spec.
 */
export const enTranslate: Translate = (key) => en[key];
