/** Values a translation template can interpolate. */
export type TranslationParams = Record<number | string, number | string>;

/**
 * Replaces `{placeholder}` markers with their values.
 *
 * A placeholder without a matching parameter is left untouched instead of
 * becoming `undefined`, which makes a missing parameter visible in the UI.
 *
 * @param template - The translated string.
 * @param params - Values keyed by placeholder name.
 * @returns The interpolated string.
 */
export const interpolate = (template: string, params?: TranslationParams): string => {
    if (!params) {
        return template;
    }
    return template.replace(/\{(\w+)\}/g, (match: string, name: string) =>
        Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
    );
};
