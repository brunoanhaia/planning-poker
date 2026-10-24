import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from './i18n-provider';
import { LANGUAGE_STORAGE_KEY } from './languages';
import { useTranslation } from './use-translation';

// The panel specs mock the hook; these tests exercise the provider itself.
vi.unmock('./use-translation');

/** Minimal consumer that exposes the active language and a way to switch it. */
const Consumer: React.FC = () => {
    const { language, setLanguage, t } = useTranslation();

    return (
        <div>
            <span data-testid="language">{language}</span>
            <span data-testid="label">{t('backlog.add')}</span>
            <button onClick={() => setLanguage('pt-BR')} type="button">
                switch
            </button>
        </div>
    );
};

describe('I18nProvider', () => {
    beforeEach(async () => {
        window.localStorage.clear();
        await i18n.changeLanguage('en');
    });

    it('loads a stored language that ships as its own chunk', async () => {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');

        render(
            <I18nProvider>
                <Consumer />
            </I18nProvider>
        );

        await waitFor(() => expect(screen.getByTestId('language')).toHaveTextContent('es'));
        expect(screen.getByTestId('label')).toHaveTextContent('Agregar Historia');
        expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es');
    });

    it('keeps the language the user picks, instead of the one it started with', async () => {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');

        render(
            <I18nProvider>
                <Consumer />
            </I18nProvider>
        );
        await waitFor(() => expect(screen.getByTestId('language')).toHaveTextContent('es'));

        fireEvent.click(screen.getByRole('button', { name: 'switch' }));

        await waitFor(() => expect(screen.getByTestId('language')).toHaveTextContent('pt-BR'));
        expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt-BR');
        expect(screen.getByTestId('label')).toHaveTextContent('Adicionar História');
    });

    it('starts in English when nothing is stored and the browser asks for it', async () => {
        render(
            <I18nProvider>
                <Consumer />
            </I18nProvider>
        );

        expect(screen.getByTestId('language')).toHaveTextContent('en');
        expect(screen.getByTestId('label')).toHaveTextContent('Add Story');
    });
});
