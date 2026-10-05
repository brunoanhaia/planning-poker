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
 * Strips path separators and control characters, collapses whitespace, and always
 * appends a fixed `.csv` extension so the title cannot influence the file type.
 *
 * @param roomTitle - The (untrusted) room title.
 * @returns A filesystem-safe filename ending in `.csv`.
 */
export const buildBacklogCsvFilename = (roomTitle: null | string | undefined): string => {
    const slug = (roomTitle || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 60);

    return `${slug || 'backlog'}_Backlog_Estimates.csv`;
};

/**
 * Parses pasted bulk-import text into stories.
 *
 * Each line is one story; a `;`, `,` or `|` separates the title from the
 * description. Blank lines are ignored.
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
            const [title, ...rest] = line.split(/[;,|]/);
            const trimmedTitle = title.trim();
            const description = rest.join(' - ').trim();
            return description ? { description, title: trimmedTitle } : { title: trimmedTitle };
        });
