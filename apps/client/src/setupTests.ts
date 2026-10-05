import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('canvas-confetti', () => ({
    default: vi.fn(),
}));

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
            observe() {}
            unobserve() {}
            disconnect() {}
        },
    });
}
