import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Repository root, from this workspace's test directory (apps/server/tests). */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

const CATALOGS_DIR = join(REPO_ROOT, 'apps', 'client', 'src', 'i18n', 'locales');

/**
 * `i18n/locales/` is excluded from the Sonar scan as a whole, on the premise
 * that it holds nothing but translation catalogs. This test keeps the premise
 * true: a stray module with logic in there would be analysed by nobody.
 */
describe('translation catalogs directory', () => {
    it('holds nothing but JSON catalogs', () => {
        const entries = readdirSync(CATALOGS_DIR, { withFileTypes: true });

        expect(entries.length).toBeGreaterThan(0);
        entries.forEach((entry) => {
            expect(entry.isFile(), `${entry.name} is not a file`).toBe(true);
            expect(entry.name.endsWith('.json'), `${entry.name} is not a catalog`).toBe(true);
        });
    });

    it('parses every catalog into a flat map of strings', () => {
        const catalogs = readdirSync(CATALOGS_DIR).map((file) => ({
            entries: Object.entries(
                JSON.parse(readFileSync(join(CATALOGS_DIR, file), 'utf8')) as Record<
                    string,
                    unknown
                >
            ),
            file,
        }));

        catalogs.forEach(({ entries, file }) => {
            expect(entries.length, `${file} is empty`).toBeGreaterThan(0);
            entries.forEach(([key, value]) => {
                expect(typeof value, `${file}: ${key} is not a string`).toBe('string');
            });
        });
    });
});
