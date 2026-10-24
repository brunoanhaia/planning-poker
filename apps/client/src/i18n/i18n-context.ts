import { Language } from '@planitpoker/shared';
import { createContext } from 'react';

import { TranslationKey } from './dictionary';

/** Interpolates `{placeholder}` markers in a translated string. */
export type Translate = (
    key: TranslationKey,
    params?: Record<number | string, number | string>
) => string;

/** Everything a component needs to render in the active language. */
export interface I18nContextValue {
    /** Language currently rendering the interface. */
    language: Language;
    /** Switches the interface language, loading its dictionary if needed. */
    setLanguage: (language: Language) => void;
    /** Translates a key, interpolating placeholders and plural forms. */
    t: Translate;
}

export const I18nContext = createContext<I18nContextValue | undefined>(undefined);
