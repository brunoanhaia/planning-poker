<!--
Title: keep it in Conventional Commit form, e.g. `fix(server): reject stale origins`.
It becomes the squash message.
-->

## What changed

<!-- A short summary. Why is this needed? Link the issue if there is one. -->

Closes #

## How to test

<!-- Exact steps a reviewer can follow: commands, URLs, what to click, what to expect. -->

## Risk

<!--
What could this break? Be specific about blast radius: shared types, socket
payloads, persisted data, deployment. Say "low" only if you can justify it.
-->

## Checklist

- [ ] `npm run lint` passes
- [ ] `npm run test` passes (note below if a workspace was skipped)
- [ ] `npm run build:shared` run if anything under `packages/shared/` changed
- [ ] PR title and description are in English
- [ ] No `any` introduced; shared types used for socket events and payloads
- [ ] Accessibility considered for UI changes (keyboard reachable, ARIA)
- [ ] Layout checked from 320px to 4K without clipping or overlap
- [ ] Documentation updated if behaviour or requirements changed

## Notes for reviewers

<!-- Anything you are unsure about, or would like a second opinion on. -->
