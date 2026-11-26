/**
 * Maximum number of characters kept from an untrusted title in a filename.
 *
 * Long titles are truncated instead of rejected: the filename is a convenience,
 * while the data itself is already inside the file.
 */
const MAX_SLUG_LENGTH = 60;

/**
 * Builds a filesystem-safe CSV filename from an untrusted title.
 *
 * Strips path separators and control characters, collapses whitespace, and
 * always appends a fixed `.csv` extension so the title cannot influence the
 * file type. The caller supplies the export marker and the fallback slug,
 * because a summary and a backlog must not share a filename shape.
 *
 * @param title - The (untrusted) title, usually the room name.
 * @param suffix - Fixed marker describing the export, e.g. `Session_Summary`.
 * @param fallback - Slug used when the title yields no usable characters.
 * @returns A filesystem-safe filename ending in `.csv`.
 */
export const buildCsvFilename = (
    title: null | string | undefined,
    suffix: string,
    fallback: string
): string => {
    const slug = (title || '')
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        .slice(0, MAX_SLUG_LENGTH);

    return `${slug || fallback}_${suffix}.csv`;
};
