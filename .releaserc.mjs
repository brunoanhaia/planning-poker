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
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
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
