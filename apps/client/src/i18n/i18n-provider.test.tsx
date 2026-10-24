import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import esJson from '../assets/locales/es.json';
import { Dictionary, LOCALE_LOADERS } from './dictionary';
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
            <button onClick={() => setLanguage('es')} type="button">
                Spanish
            </button>
            <button onClick={() => setLanguage('pt-BR')} type="button">
                switch
            </button>
        </div>
    );
};

describe('I18nProvider', () => {
    beforeEach(async () => {
        window.localStorage.clear();
        i18n.removeResourceBundle('es', 'translation');
        await i18n.changeLanguage('en');
    });

    afterEach(() => {
        vi.restoreAllMocks();
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

    it.each(['initial preference', 'user selection'])(
        'ignores a late dictionary from an earlier %s',
        async (request) => {
            let resolveDictionary!: (module: { default: Dictionary }) => void;
            const pendingDictionary = new Promise<{ default: Dictionary }>((resolve) => {
                resolveDictionary = resolve;
            });
            const loader = vi.spyOn(LOCALE_LOADERS, 'es').mockReturnValue(pendingDictionary);
            if (request === 'initial preference') {
                window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
            }

            render(
                <I18nProvider>
                    <Consumer />
                </I18nProvider>
            );
            if (request === 'user selection') {
                fireEvent.click(screen.getByRole('button', { name: 'Spanish' }));
            }
            expect(loader).toHaveBeenCalled();

            fireEvent.click(screen.getByRole('button', { name: 'switch' }));
            await waitFor(() => expect(screen.getByTestId('language')).toHaveTextContent('pt-BR'));

            await act(async () => {
                resolveDictionary({ default: esJson });
                await pendingDictionary;
            });

            expect(screen.getByTestId('language')).toHaveTextContent('pt-BR');
            expect(screen.getByTestId('label')).toHaveTextContent('Adicionar História');
            expect(i18n.language).toBe('pt-BR');
            expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pt-BR');
        }
    );

    it('starts in English when nothing is stored and the browser asks for it', async () => {
        render(
            <I18nProvider>
                <Consumer />
            </I18nProvider>
        );

        expect(screen.getByTestId('language')).toHaveTextContent('en');
        expect(screen.getByTestId('label')).toHaveTextContent('Add Story');
    });

    it('keeps the current language when the dictionary chunk fails to load', async () => {
        const loader = vi
            .spyOn(LOCALE_LOADERS, 'es')
            .mockRejectedValue(new Error('chunk rotated by a deploy'));

        render(
            <I18nProvider>
                <Consumer />
            </I18nProvider>
        );
        fireEvent.click(screen.getByRole('button', { name: 'Spanish' }));

        await waitFor(() => expect(loader).toHaveBeenCalled());
        expect(screen.getByTestId('language')).toHaveTextContent('en');
        expect(screen.getByTestId('label')).toHaveTextContent('Add Story');
        expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).not.toBe('es');
    });
});
