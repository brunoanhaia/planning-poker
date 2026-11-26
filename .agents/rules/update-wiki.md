---
name: update-wiki
description: Enforce that the GitHub Wiki is updated whenever observable behavior changes, keeping it the source of truth the repository treats it as.
---

# Update Wiki Rule

**CRITICAL RULE**: Whenever a change alters observable behavior — roles or permissions,
message flows, input limits, resource ceilings, `ErrorCode` values, WebSocket close codes,
voting or round mechanics, deployment settings, UI behavior — the author MUST also update the
matching page(s) in `wiki/` as part of the same change. Do not ask for permission; include the
wiki update in the execution steps.

## Procedure

1. Identify the affected page(s) from `wiki/_Sidebar.md`; check
   `wiki/Requirements Trace.md` when the change touches a numbered requirement, and add the
   row when a new requirement has no page yet.
2. Rewrite the affected sections so every claim matches the code **after** the change.
   Verify against the source, not against the old page: a page updated by copying another
   page is how the wiki rots.
3. Move the page's `Last verified: <date> against commit <hash>` stamp to the new commit.
4. Run `npm run format` over the touched files.
5. Publish per `wiki/README.md` (push to the `planning-poker.wiki.git` remote), or leave the
   staged files for the next publish — but commit the staging copy together with the code
   change so the two cannot drift apart.

## Rationale

The wiki is the source of truth for behavior, and the README is a landing page that links to
it. A behavior change without its wiki update silently forks the truth back into prose that
reviewers cannot check against the code, which is the exact duplication this layout removed.
The verification stamp is the drift detector: a page whose stamp names an old commit is a
page that was not checked when the code moved.
