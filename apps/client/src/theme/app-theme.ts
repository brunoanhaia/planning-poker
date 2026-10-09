import { COLOR_MODE_STORAGE_KEY } from '@planitpoker/shared';
import { ThemeConfig, theme } from 'antd';

/** The colour schemes the application can be rendered in. */
export type ColorMode = 'dark' | 'light';

export { COLOR_MODE_STORAGE_KEY };

const DARK_MODE_ALGORITHM = theme.darkAlgorithm;
const LIGHT_MODE_ALGORITHM = theme.defaultAlgorithm;

/**
 * Alpha applied to Ant Design's description text, in both schemes.
 *
 * Ant Design ships `0.45`, which measures 4.42:1 against the dark layout
 * background — just below the 4.5:1 WCAG AA threshold. `0.65` clears it with
 * margin in both schemes.
 */
const DESCRIPTION_TEXT_ALPHA = 0.65;

/** Full-strength body text, matching Ant Design's own `colorText` per scheme. */
const PRIMARY_TEXT_COLOR: Record<ColorMode, string> = {
    dark: 'rgba(255, 255, 255, 0.85)',
    light: 'rgba(0, 0, 0, 0.88)',
};

/**
 * Brand blue, used in both schemes.
 *
 * Ant Design's light default (`#1677ff`) puts white button text at 4.10:1 and
 * its dark default (`#1668dc`) puts the same text at 4.86:1. `#1668dc` is the
 * one blue in Ant Design's ramp that clears 4.5:1 for white text, and it also
 * clears 4.5:1 as text on a white surface, so a single value serves both.
 */
const PRIMARY_COLOR = '#1668dc';

/** Toned-down but readable text used for descriptions, hints and idle tabs. */
const DESCRIPTION_TEXT_COLOR: Record<ColorMode, string> = {
    dark: `rgba(255, 255, 255, ${DESCRIPTION_TEXT_ALPHA})`,
    light: `rgba(0, 0, 0, ${DESCRIPTION_TEXT_ALPHA})`,
};

/**
 * Builds the global Ant Design theme for a colour scheme.
 *
 * Rendering uses stock Ant Design tokens; the only overrides are WCAG AA
 * contrast corrections for two combinations Ant Design itself does not pass:
 *
 * - description text, at 4.42:1 on the dark layout background;
 * - the selected tab label, which Ant Design paints in `colorPrimary`
 *   (3.55:1 on a dark card and 4.10:1 on white);
 * - white text on the light primary button, at 4.10:1.
 *
 * The selected tab is therefore marked with full-strength text against
 * toned-down siblings, while the primary underline still carries the brand
 * colour.
 *
 * @param mode - The colour scheme to render.
 * @returns A `ConfigProvider` theme configuration.
 */
export const getAppTheme = (mode: ColorMode): ThemeConfig => ({
    algorithm: mode === 'dark' ? DARK_MODE_ALGORITHM : LIGHT_MODE_ALGORITHM,
    components: {
        Tabs: {
            itemColor: DESCRIPTION_TEXT_COLOR[mode],
            itemSelectedColor: PRIMARY_TEXT_COLOR[mode],
        },
    },
    token: {
        colorPrimary: PRIMARY_COLOR,
        colorTextDescription: DESCRIPTION_TEXT_COLOR[mode],
    },
});

/**
 * Reads the persisted colour scheme, defaulting to dark when unset or unknown.
 *
 * @returns The stored colour scheme, or `dark` when there is nothing valid to read.
 */
export const readStoredColorMode = (): ColorMode =>
    localStorage.getItem(COLOR_MODE_STORAGE_KEY) === 'light' ? 'light' : 'dark';

/**
 * Persists the colour scheme so it survives a reload.
 *
 * @param mode - The colour scheme to persist.
 */
export const storeColorMode = (mode: ColorMode): void => {
    localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode);
};
