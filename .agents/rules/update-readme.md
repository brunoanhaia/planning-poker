---
name: update-readme
description: Keep README.md accurate as a landing page after significant code changes; behavior prose belongs in the docs site.
---

# Update README Rule

**CRITICAL RULE**: After every feature or architectural change, verify that the README's
**landing page** facts still hold: the quick start, the monorepo structure map and the
"where everything lives" links. Do not ask the user for permission; include the check in your
final execution steps.

Behavior documentation goes to `docs/` under the `update-wiki` rule, **not** back into the README. The README is a landing page: it keeps the quick start and the links, and growing
feature prose back into it recreates the duplication this repository deliberately removed.
