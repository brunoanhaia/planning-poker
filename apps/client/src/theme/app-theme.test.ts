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
    it('keeps the light error text readable on white and on the solid button', () => {
        const background = '#ffffff';
        const base = tokenOf('light', 'colorError');
        const hover = tokenOf('light', 'colorErrorHover');
        const active = tokenOf('light', 'colorErrorActive');

        expect(contrast(base, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(hover, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(active, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(background, base)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(background, hover)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(background, active)).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps the dark error text readable on the layout and on the solid button', () => {
        const background = '#141414';
        const base = tokenOf('dark', 'colorError');
        const hover = tokenOf('dark', 'colorErrorHover');
        const active = tokenOf('dark', 'colorErrorActive');

        expect(contrast(base, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(hover, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(active, background)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(background, base)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(background, hover)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(background, active)).toBeGreaterThanOrEqual(4.5);
    });
});
