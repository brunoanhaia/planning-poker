/**
 * Characters that spreadsheet applications interpret as the start of a formula.
 * Cells beginning with any of these are prefixed with a single quote to neutralize
 * CSV/formula injection (OWASP).
 */
const FORMULA_TRIGGER_CHARS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * A value that can be written to a CSV cell.
 */
export type CsvCellValue = string | number | boolean | null | undefined;

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
export const buildBacklogCsvFilename = (roomTitle: string | null | undefined): string => {
    const slug = (roomTitle || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, 60);

    return `${slug || 'backlog'}_Backlog_Estimates.csv`;
};
