import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('canvas-confetti', () => ({
    default: vi.fn(),
}));

/**
 * Component tests render one panel in isolation, so they get the English
 * dictionary through the same translator the provider exposes. Tests that need
 * another language mock the module themselves.
 */
vi.mock('./i18n/use-translation', async () => {
    // `vi.mock` is hoisted above the static imports, so the factory cannot close
    // over them; the provider is imported here to initialise i18next with the
    // shipped dictionaries, and the hook is bound to that instance.
    await import('./i18n/i18n-provider');
    const { default: i18n } = await import('i18next');

    return {
        useTranslation: () => ({
            language: 'en' as const,
            setLanguage: vi.fn(),
            t: (key: string, params?: Record<number | string, number | string>) =>
                i18n.t(key, params ?? {}) as string,
        }),
    };
});

/**
 * jsdom ships neither `matchMedia` nor `ResizeObserver`, both of which Ant Design
 * queries on mount. Both are stubbed as permanently "no match" so the responsive
 * grid resolves to its smallest breakpoint during unit tests.
 */
if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
            addEventListener: vi.fn(),
            addListener: vi.fn(),
            dispatchEvent: vi.fn(),
            matches: false,
            media: query,
            onchange: null,
            removeEventListener: vi.fn(),
            removeListener: vi.fn(),
        })),
    });
}

if (!window.ResizeObserver) {
    Object.defineProperty(window, 'ResizeObserver', {
        writable: true,
        value: class {
            observe() {
                // jsdom has no layout, so a resize is never observed.
            }
            unobserve() {
                // jsdom has no layout, so nothing can be unobserved.
            }
            disconnect() {
                // jsdom has no layout, so there are no observers to release.
            }
        },
    });
}
