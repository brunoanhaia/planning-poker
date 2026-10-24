import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Repository root, from this workspace's test directory (apps/server/tests). */
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

const CATALOGS_DIR = join(REPO_ROOT, 'apps', 'client', 'src', 'i18n');

/**
 * SonarQube Cloud excludes the translation catalogs from copy-paste detection.
 *
 * The detector ignores string literals, so every locale — which repeats the
 * English keys by design — looks like a copy of the others, and a new language
 * that is not listed in `.sonarcloud.properties` fails the quality gate with a
 * message unrelated to the code under review. This test keeps the list honest;
 * it lives in the server suite because the client build has no Node types.
 */
describe('translation catalogs', () => {
    it('lists every locale as a copy-paste exclusion', () => {
        const properties = readFileSync(join(REPO_ROOT, '.sonarcloud.properties'), 'utf8');

        expect(properties).toContain('apps/client/src/i18n/dictionary.ts');

        const locales = readdirSync(join(CATALOGS_DIR, 'locales')).filter((file) =>
            file.endsWith('.ts')
        );
        expect(locales.length).toBeGreaterThan(0);

        locales.forEach((file) => {
            expect(
                properties,
                `add apps/client/src/i18n/locales/${file} to sonar.cpd.exclusions`
            ).toContain(`apps/client/src/i18n/locales/${file}`);
        });
    });
});
