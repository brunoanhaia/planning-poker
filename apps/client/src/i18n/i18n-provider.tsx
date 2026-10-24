import { LANGUAGE_STORAGE_KEY, Language, LANGUAGES } from '@planitpoker/shared';
import i18n from 'i18next';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { initReactI18next } from 'react-i18next';

import { Dictionary, INLINE_DICTIONARIES, LOCALE_LOADERS, TranslationKey } from './dictionary';
import { I18nContext, I18nContextValue, Translate } from './i18n-context';

/** Language used when neither the browser nor storage names a supported one. */
const FALLBACK_LANGUAGE: Language = 'en';

/** Namespace every dictionary is registered under. */
const NAMESPACE = 'translation';

/**
 * Narrows an arbitrary tag to a supported interface language.
 *
 * Accepts a full tag (`pt-BR`), a bare language (`pt`) or a regional variant
 * (`pt-PT`), because browsers report all three and a Portuguese speaker should
 * be greeted in Portuguese rather than in English. A bare code picks the first
 * shipped variant that starts with it.
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
 * The single i18next instance.
 *
 * Placeholders stay `{name}` rather than i18next's default `{{name}}`, so the
 * dictionary syntax the components already use did not have to change. React
 * escapes every node we render, so HTML escaping is off: the values interpolated
 * are our own dictionary entries and typed parameters, not user HTML.
 */
i18n.use(initReactI18next).init({
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
    lng: INLINE_DICTIONARIES[readInitialLanguage()] ? readInitialLanguage() : FALLBACK_LANGUAGE,
    resources: Object.fromEntries(
        Object.entries(INLINE_DICTIONARIES).map(([language, dictionary]) => [
            language,
            { [NAMESPACE]: dictionary },
        ])
    ),
    returnNull: false,
    supportedLngs: [...LANGUAGES],
});

/** Registers one more dictionary, either from the inline map or from its chunk. */
const loadDictionary = async (language: Language): Promise<boolean> => {
    if (i18n.hasResourceBundle(language, NAMESPACE)) {
        return true;
    }
    const loader = LOCALE_LOADERS[language];
    if (!loader) {
        return false;
    }
    const module = await loader();
    i18n.addResourceBundle(language, NAMESPACE, module.default as Dictionary, true, true);
    return true;
};

/** Stores the choice, ignoring a browser that refuses the write. */
const storeLanguage = (language: Language): void => {
    try {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
        // Private mode can refuse the write; the session language still holds.
    }
};

/**
 * Provides the active language and the translator to the whole tree.
 *
 * The choice is stored on change, so a reload keeps the language the user
 * picked instead of falling back to the browser's preference. A language that
 * ships as its own chunk is fetched on demand; until it arrives the tree keeps
 * rendering the previous one instead of flashing empty copy.
 */
export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // The wanted language is read once, before anything can write to storage:
    // persisting the English fallback first would otherwise overwrite a stored
    // language whose chunk has not arrived yet.
    const [wantedLanguage] = useState<Language>(readInitialLanguage);
    const [language, setLanguage] = useState<Language>(() =>
        INLINE_DICTIONARIES[wantedLanguage] ? wantedLanguage : FALLBACK_LANGUAGE
    );

    // A language that is not inlined yet is fetched after the first paint; the
    // fallback rendered meanwhile is English, never a raw key. The guard keeps
    // this to one run: a later language change is the user's choice and must not
    // be overwritten by the starting preference.
    const didLoadInitialRef = useRef(false);
    useEffect(() => {
        if (didLoadInitialRef.current) {
            return;
        }
        didLoadInitialRef.current = true;
        if (wantedLanguage === language || INLINE_DICTIONARIES[wantedLanguage]) {
            return;
        }
        let isMounted = true;
        void loadDictionary(wantedLanguage).then((loaded) => {
            if (!isMounted || !loaded) {
                return;
            }
            void i18n.changeLanguage(wantedLanguage);
            setLanguage(wantedLanguage);
            storeLanguage(wantedLanguage);
        });
        return () => {
            isMounted = false;
            // React re-runs effects on mount in development; releasing the guard
            // lets the second run read the dictionary the first one started.
            didLoadInitialRef.current = false;
        };
    }, [language, wantedLanguage]);

    const changeLanguage = useCallback(async (next: Language) => {
        if (!(await loadDictionary(next))) {
            return;
        }
        await i18n.changeLanguage(next);
        setLanguage(next);
        storeLanguage(next);
    }, []);

    const t = useCallback<Translate>(
        (key, params) => i18n.t(key as TranslationKey, params ?? {}) as string,
        []
    );

    const value = useMemo<I18nContextValue>(
        () => ({ language, setLanguage: changeLanguage, t }),
        [changeLanguage, language, t]
    );

    return <I18nContext value={value}>{children}</I18nContext>;
};
