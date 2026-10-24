import { use } from 'react';

import { I18nContext } from './i18n-context';

/**
 * Reads the active language and translator.
 *
 * @throws When called outside of an `I18nProvider`, so a misplaced component
 *   fails during development instead of rendering raw dictionary keys.
 * @returns The translation context value.
 */
export const useTranslation = () => {
    const context = use(I18nContext);

    if (!context) {
        throw new Error('useTranslation must be used within an I18nProvider');
    }

    return context;
};
