/**
 * Conventional Commits rules for every commit in this repository.
 *
 * The rules come from `@commitlint/config-conventional`: a header with a type
 * and a subject, types limited to the set below, a blank line between the
 * header and the body, and a subject that starts lower case and carries no
 * trailing period. `commitlint.config-conventional` is the set the
 * `conventional-changelog` tooling turns into the changelog, so a message that
 * violates these rules is also a message that cannot be released properly.
 */
export default {
    extends: ['@commitlint/config-conventional'],
};
