/**
 * Release automation for `main`.
 *
 * Every push to `main` runs `semantic-release`, which reads the commit
 * messages since the last tag, decides the next version with the same
 * Conventional Commits rules the `commit-msg` hook enforces, prepends the
 * release notes to `CHANGELOG.md`, bumps the root `package.json`, commits the
 * changelog, `package.json` and `package-lock.json`, and publishes the git tag
 * and the GitHub release. The npm package is private, so nothing is published
 * to a registry.
 *
 * The commit written here carries `[skip ci]` so the release commit does not
 * start a second workflow run.
 */
export default {
    branches: ['main'],
    tagFormat: 'v${version}',
    plugins: [
        // Same parser as commitlint: `conventionalcommits` is the preset
        // `@commitlint/config-conventional` follows, and it understands the `!`
        // breaking marker. The bare Angular preset of the default rule set
        // scores `feat!: …` as a feature instead of a major.
        [
            '@semantic-release/commit-analyzer',
            {
                preset: 'conventionalcommits',
                // Custom rules are tried first and the analyzer falls back to
                // its defaults. Those defaults already treat any breaking change
                // as major, so only the plain `revert:` header needs a rule:
                // commitlint accepts it, while the default revert rule expects
                // the body to carry the hash.
                releaseRules: [{ type: 'revert', release: 'patch' }],
            },
        ],
        [
            '@semantic-release/release-notes-generator',
            {
                preset: 'conventionalcommits',
            },
        ],
        [
            '@semantic-release/changelog',
            {
                changelogFile: 'CHANGELOG.md',
                changelogTitle: '# Changelog',
            },
        ],
        [
            '@semantic-release/npm',
            {
                npmPublish: false,
            },
        ],
        [
            '@semantic-release/git',
            {
                assets: ['CHANGELOG.md', 'package.json', 'package-lock.json'],
                message: 'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
            },
        ],
        '@semantic-release/github',
    ],
};
