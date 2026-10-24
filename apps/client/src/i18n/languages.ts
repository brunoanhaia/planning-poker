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

/** Key that persists the chosen interface language in the browser. */
export const LANGUAGE_STORAGE_KEY = 'planit_language';
