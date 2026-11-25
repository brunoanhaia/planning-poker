/**
 * commitlint config for the pull request title.
 *
 * The repository config extends `@commitlint/config-conventional`, whose default
 * ignores skip messages such as `Merge pull request …`, `Merge branch …`,
 * `Revert "…"`, `fixup!`, `squash!` and `amend!`. Those defaults exist for commit
 * ranges, where Git writes such messages; a pull request title is authored, and a
 * title that commitlint would skip must still be rejected, because a squash merge
 * turns it into the commit.
 */
import base from '../commitlint.config.mjs';

export default {
    ...base,
    defaultIgnores: false,
};
