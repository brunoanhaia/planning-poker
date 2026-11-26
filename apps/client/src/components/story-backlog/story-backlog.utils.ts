import { buildCsvFilename } from '../../utils/csv-filename';

/**
 * Characters that spreadsheet applications interpret as the start of a formula.
 * Cells beginning with any of these are prefixed with a single quote to neutralize
 * CSV/formula injection (OWASP).
 */
const FORMULA_TRIGGER_CHARS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * A value that can be written to a CSV cell.
 */
export type CsvCellValue = boolean | null | number | string | undefined;

/**
 * Escapes a single value for safe inclusion in a CSV cell.
 *
 * Neutralizes spreadsheet formula injection and doubles embedded quotes.
 *
 * @param value - The raw cell value.
 * @returns A quoted, escaped CSV cell.
 */
export const escapeCsvCell = (value: CsvCellValue): string => {
    const text = value === null || value === undefined ? '' : String(value);
    const needsFormulaGuard = FORMULA_TRIGGER_CHARS.some((char) => text.startsWith(char));
    const guarded = needsFormulaGuard ? `'${text}` : text;
    return `"${guarded.replace(/"/g, '""')}"`;
};

/**
 * Builds a safe, predictable CSV filename from an arbitrary room title.
 *
 * Delegates the sanitization to {@link buildCsvFilename} and fixes the export
 * marker, so a backlog export stays distinct from a session summary.
 *
 * @param roomTitle - The (untrusted) room title.
 * @returns A filesystem-safe filename ending in `.csv`.
 */
export const buildBacklogCsvFilename = (roomTitle: null | string | undefined): string =>
    buildCsvFilename(roomTitle, 'Backlog_Estimates', 'backlog');

/**
 * Parses pasted bulk-import text into stories.
 *
 * Each line is one story; a `;` or `|` separates the title from the
 * description. Commas stay inside the title, and blank lines as well as lines
 * without a title are ignored.
 *
 * @param bulkText - The raw pasted text.
 * @returns The parsed stories, in input order.
 */
export const parseBulkStories = (bulkText: string): { description?: string; title: string }[] =>
    bulkText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => {
            const separatorIndex = line.search(/[;|]/);
            const trimmedTitle = (separatorIndex < 0 ? line : line.slice(0, separatorIndex)).trim();
            const description = separatorIndex < 0 ? '' : line.slice(separatorIndex + 1).trim();
            return description ? { description, title: trimmedTitle } : { title: trimmedTitle };
        })
        .filter(({ title }) => title.length > 0);
