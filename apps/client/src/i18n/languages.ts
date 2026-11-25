/**
 * Languages the client can render.
 *
 * These live with the client, not in `@planitpoker/shared`: the server never
 * reads a language. It answers an `ERROR` with a stable `ErrorCode` and a
 * language-neutral log line, and the client turns the code into copy.
 */
export type Language = 'en' | 'pt-BR' | 'es';

/** Languages offered in the interface, in the order the picker shows them. */
export const LANGUAGES = ['en', 'pt-BR', 'es'] as const satisfies readonly Language[];

/**
 * Compact code shown on the language button itself.
 *
 * Kept as data next to {@link LANGUAGES} instead of in the catalogs: a language
 * code is not copy and must not be translated into another language. The full
 * native name stays in the menu and in the button's accessible label.
 */
export const LANGUAGE_SHORT_LABELS: Record<Language, string> = {
    en: 'EN',
    'pt-BR': 'PT-BR',
    es: 'ES',
};

/** Key that persists the chosen interface language in the browser. */
export const LANGUAGE_STORAGE_KEY = 'planit_language';
