import i18n from 'i18next';
import { afterEach, describe, expect, it } from 'vitest';

import { INLINE_DICTIONARIES, LOCALE_LOADERS, en } from './dictionary';
import { normalizeLanguage, readInitialLanguage } from './i18n-provider';
import { LANGUAGE_STORAGE_KEY, LANGUAGES } from './languages';

describe('language selection', () => {
    afterEach(() => {
        window.localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    });

    it('accepts a full tag, a bare language and a regional variant', () => {
        expect(normalizeLanguage('pt-BR')).toBe('pt-BR');
        expect(normalizeLanguage('pt')).toBe('pt-BR');
        expect(normalizeLanguage('pt-PT')).toBe('pt-BR');
        expect(normalizeLanguage('es-AR')).toBe('es');
        expect(normalizeLanguage('en-GB')).toBe('en');
    });

    it('reports no language for a tag nobody ships', () => {
        expect(normalizeLanguage('fr-FR')).toBeNull();
        expect(normalizeLanguage('')).toBeNull();
        expect(normalizeLanguage(null)).toBeNull();
    });

    it('prefers the stored choice over the browser', () => {
        window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'es');
        expect(readInitialLanguage()).toBe('es');
    });
});

describe('dictionaries', () => {
    it('ships a dictionary for every offered language, inline or as a chunk', () => {
        LANGUAGES.forEach((language) => {
            const source = INLINE_DICTIONARIES[language] ? 'inline' : LOCALE_LOADERS[language];
            expect(source, `no dictionary for ${language}`).toBeDefined();
        });
    });

    it('puts exactly one JSON catalog per offered language in assets/locales', () => {
        // Vite resolves the glob, so the assertion needs no Node filesystem types
        // and runs against the same files the bundler sees.
        const catalogs = Object.keys(
            import.meta.glob('../assets/locales/*.json', { eager: true })
        ).map((path) => path.split('/').pop()!.replace('.json', ''));

        expect(catalogs.sort()).toEqual([...LANGUAGES].sort());
    });

    it('keeps everything else out of assets/locales', () => {
        // The folder is excluded from the Sonar scan on the premise that it holds
        // translation data only; a stray module there would be analysed by nobody.
        const entries = Object.keys(
            import.meta.glob('../assets/locales/*', {
                eager: true,
                import: 'default',
                query: '?url',
            })
        );

        expect(entries.length).toBeGreaterThan(0);
        entries.forEach((path) => {
            expect(path.endsWith('.json'), `${path} is not a catalog`).toBe(true);
        });
    });

    it('has a locale module per lazy language, with the same keys as English', async () => {
        const english = Object.keys(en).sort();

        expect(Object.keys(LOCALE_LOADERS)).toEqual(['es']);
        for (const loader of Object.values(LOCALE_LOADERS)) {
            const module = await loader!();
            expect(Object.keys(module.default).sort()).toEqual(english);
        }
    });

    it('has the same keys in every inline dictionary', () => {
        const english = Object.keys(en).sort();
        for (const dictionary of Object.values(INLINE_DICTIONARIES)) {
            expect(Object.keys(dictionary ?? {}).sort()).toEqual(english);
        }
    });

    it('carries a plural form for every key that interpolates a count', () => {
        const pluralBases = Object.keys(en)
            .filter((key) => key.endsWith('_one'))
            .map((key) => key.slice(0, -'_one'.length));

        expect(pluralBases.length).toBeGreaterThan(0);
        pluralBases.forEach((base) => {
            expect(
                en[`${base}_other` as keyof typeof en],
                `${base} has no _other form`
            ).toBeDefined();
        });
    });
});

describe('translation', () => {
    it('picks the plural form of the active language', async () => {
        await i18n.changeLanguage('en');
        expect(i18n.t('results.votes', { count: 1 })).toBe('1 vote');
        expect(i18n.t('results.votes', { count: 3 })).toBe('3 votes');

        await i18n.changeLanguage('pt-BR');
        expect(i18n.t('results.votes', { count: 1 })).toBe('1 voto');
        expect(i18n.t('results.votes', { count: 3 })).toBe('3 votos');
    });

    it('interpolates with the library default double-brace syntax', async () => {
        await i18n.changeLanguage('en');
        expect(i18n.t('nav.room', { code: 'ABCD1234' })).toBe('Room: ABCD1234');
        expect(i18n.t('estimation.progress.count', { percent: 50, total: 4, voted: 2 })).toBe(
            '2 of 4 voted (50%)'
        );
    });
});
