/**
 * Release automation for `develop`.
 *
 * Every push to `develop` runs `semantic-release`, which reads the commit
 * messages since the last tag, decides the next version with the same
 * Conventional Commits rules the `commit-msg` hook enforces, prepends the
 * release notes to `CHANGELOG.md`, bumps the root `package.json`, commits both,
 * and publishes the git tag and the GitHub release. The npm package is private,
 * so nothing is published to a registry.
 *
 * The commit written here carries `[skip ci]` so the release commit does not
 * start a second workflow run.
 */
export default {
    branches: ['develop'],
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
                // A custom rule list replaces the defaults, so the breaking rule
                // is restated first: `refactor!:` or `revert!:` is a major, even
                // for a type that would otherwise release nothing.
                releaseRules: [
                    { breaking: true, release: 'major' },
                    // commitlint accepts a plain `revert:` header, which the
                    // default rule only releases when the body carries the hash.
                    { type: 'revert', release: 'patch' },
                ],
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
