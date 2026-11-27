---
name: update-requirements
description: Ensure that the `requirements.md` file is updated whenever new functional or non‑functional requirements are added to the project documentation or code comments.
license: Internal project rule
---

# Update Requirements Rule

Whenever a developer adds a new requirement (functional or non‑functional) to any part of the codebase, documentation, issue tracker, or design discussion, they must also update the `requirements.md` file located at the repository root.

## Enforcement

- This rule should be referenced in code review checklists.
- The `requirements-trace` workflow enforces the mapping mechanically: it fails a pull
  request whose `requirements.md` holds a numbered requirement without a matching row in
  `docs/requirements-trace.md`, and a stale trace row no requirement backs. Run it locally
  with `npm run trace:check`.
- The rule is part of the repository's custom rules set and should be kept up to date in `AGENTS.md` via the existing `update-agents.md` rule.

## Usage

1. Add the new requirement in the appropriate documentation or issue.
2. Immediately edit `requirements.md` to include the new entry in the correct section.
3. Add the matching row to `docs/requirements-trace.md` naming the docs page that documents
   the behavior, and update that page under the `update-wiki` rule — the workflow above
   fails the pull request otherwise.
4. Commit both changes together with a clear commit message, e.g., `feat: add new voting timer requirement and update requirements.md`.

## Rationale

Keeping `requirements.md` current ensures that stakeholders, developers, and automated tools have a single source of truth for project requirements, facilitating accurate planning, testing, and compliance checks.

---
