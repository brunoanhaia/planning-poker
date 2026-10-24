import { LANGUAGE_STORAGE_KEY, Language, LANGUAGES } from '@planitpoker/shared';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { DICTIONARIES, Dictionary } from './dictionary';
import { I18nContext, I18nContextValue, Translate } from './i18n-context';
import { interpolate } from './interpolate';

/** Language used when neither the browser nor storage names a supported one. */
const FALLBACK_LANGUAGE: Language = 'en';

/**
 * Narrows an arbitrary tag to a supported interface language.
 *
 * Accepts a full tag (`pt-BR`), a bare language (`pt`) or a regional variant
 * (`pt-PT`), because browsers report all three and a Portuguese speaker should
 * be greeted in Portuguese rather than in English.
 *
 * @param tag - Value read from storage or from the browser.
 * @returns The supported language, or `null` when the tag names none.
 */
export const normalizeLanguage = (tag: null | string): Language | null => {
    if (!tag) {
        return null;
    }
    const exact = LANGUAGES.find((language) => language.toLowerCase() === tag.toLowerCase());
    if (exact) {
        return exact;
    }
    const base = tag.split('-')[0].toLowerCase();
    return LANGUAGES.find((language) => language.split('-')[0].toLowerCase() === base) ?? null;
};

/** Resolves the starting language from storage, then the browser, then English. */
export const readInitialLanguage = (): Language => {
    if (typeof window === 'undefined') {
        return FALLBACK_LANGUAGE;
    }
    return (
        normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)) ??
        normalizeLanguage(window.navigator.language) ??
        FALLBACK_LANGUAGE
    );
};

/**
 * Provides the active language and the translator to the whole tree.
 *
 * The choice is stored on change, so a reload keeps the language the user
 * picked instead of falling back to the browser's preference.
 */
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [language, setLanguage] = useState<Language>(readInitialLanguage);

    useEffect(() => {
        try {
            window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
        } catch {
            // Private mode can refuse the write; the session language still holds.
        }
    }, [language]);

    const t = useCallback<Translate>(
        (key, params) => {
            const dictionary: Dictionary = DICTIONARIES[language];
            return interpolate(dictionary[key] ?? String(key), params);
        },
        [language]
    );

    const value = useMemo<I18nContextValue>(
        () => ({ language, setLanguage, t }),
        [language, setLanguage, t]
    );

    return <I18nContext value={value}>{children}</I18nContext>;
};
