import { Language } from '@planitpoker/shared';
import { createContext } from 'react';

import { Dictionary } from './dictionary';

/** Interpolates `{placeholder}` markers in a translated string. */
export type Translate = (
    key: keyof Dictionary,
    params?: Record<number | string, number | string>
) => string;

/** Everything a component needs to render in the active language. */
export interface I18nContextValue {
    /** Language currently rendering the interface. */
    language: Language;
    /** Switches the interface language and persists the choice. */
    setLanguage: (language: Language) => void;
    /** Translates a dictionary key, interpolating any placeholders. */
    t: Translate;
}

export const I18nContext = createContext<I18nContextValue | undefined>(undefined);
