import { describe, expect, it } from 'vitest';

import { ColorMode, getAppTheme } from './app-theme';

/** WCAG relative luminance of a `#rrggbb` colour. */
const luminance = (color: string): number => {
    const channels = [1, 3, 5].map((offset) => {
        const channel = Number.parseInt(color.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

/** WCAG contrast ratio between two colours. */
const contrast = (foreground: string, background: string): number => {
    const [lighter, darker] = [luminance(foreground), luminance(background)].sort(
        (left, right) => right - left
    );
    return (lighter + 0.05) / (darker + 0.05);
};

const tokenOf = (mode: ColorMode, name: 'colorError' | 'colorErrorActive' | 'colorErrorHover') => {
    const token = getAppTheme(mode).token;
    const value = token?.[name];
    if (typeof value !== 'string') {
        throw new Error(`missing ${name} token for ${mode}`);
    }
    return value;
};

describe('danger palette contrast', () => {
    it.each([
        { background: '#ffffff', label: 'light', mode: 'light' as const, solidText: '#ffffff' },
        { background: '#141414', label: 'dark', mode: 'dark' as const, solidText: '#141414' },
    ])(
        'keeps the $label danger palette readable as text and on the solid button',
        ({ background, mode, solidText }) => {
            const colors = [
                tokenOf(mode, 'colorError'),
                tokenOf(mode, 'colorErrorHover'),
                tokenOf(mode, 'colorErrorActive'),
            ];

            colors.forEach((color) => {
                expect(contrast(color, background)).toBeGreaterThanOrEqual(4.5);
                expect(contrast(solidText, color)).toBeGreaterThanOrEqual(4.5);
            });
        }
    );
});
