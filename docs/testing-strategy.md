# Testing Strategy

> **Last verified:** 2026-11-26 against commit `4dd98ef`.

Three layers, each with a different job: unit tests own the logic, e2e owns the behavior a
user can reach, chaos owns the faults no assertion covers.

## Unit — Vitest, per workspace

`@planitpoker/client` (jsdom) and `@planitpoker/server` own their logic: the statistics
math, the bulk-import batching, the zod validation, the room/participant services, the
join/limiter/ban machinery, the sanitization that hides votes. The suites import the built
`packages/shared/dist`, which is why the shared build comes first.

## End-to-end — Playwright, driven from the repo

The config auto-starts both dev servers (5000/5173); the base URL is the Vite client.
`E2E_BASE_URL` points the suite at an already-running stack instead. The inventory, by
concern:

| Spec                          | Owns                                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `room-creation`, `room-setup` | the create flow, the guided setup, the first story activating at once                                                       |
| `voting-flow`                 | vote → reveal → reset → re-vote → accept                                                                                    |
| `rounds-summary`              | append-only rounds, the statistics grid, the end-of-session summary                                                         |
| `session-closure`             | the frozen end timestamp, refused joins and votes afterwards                                                                |
| `admin-management`            | the 19 privileged actions and their refusals                                                                                |
| `participant-management`      | roster, roles, kick/promote/transfer                                                                                        |
| `session-identity`            | tokens, tab supersession (4001), room switch (4002), the switch modal                                                       |
| `backlog-import`              | paste parsing, batching, the backlog quota                                                                                  |
| `timer`                       | start/pause/reset and the shared countdown                                                                                  |
| `i18n` (e2e)                  | language selection and rendered translations — the key-set, plural and JSON-only checks run in the client unit spec instead |
| `content-stress`              | long titles, long descriptions, many stories — the layout under load                                                        |

## The accessibility gate

`overlap-axe.spec.ts` scans the lobby, the setup screen, the room and the revealed results on **eight
viewports — 320 px to 4K — in both colour schemes**, asserting **zero** axe `wcag2a`/`wcag2aa` violations, **zero overlapping text or
interactive elements** and **zero horizontal overflow**. It is the safety net under every layout and
colour decision: if a change regresses contrast or breaks the 320px experience, this spec
fails. Any layout or colour change needs the full e2e suite.

## Chaos — the faults no assertion owns

- **WebSocket chaos**: a real-client script hammering the transport (oversized frames,
  floods, malformed envelopes) against a live server — through Nginx or direct.
- **Container chaos**: the compose stack under faults, proving the deployment survives what
  the process-level suites never see.

Both, plus the automated inventory, the exploratory charters and the ideal-behaviour
[`docs/test-plan.md`](./test-plan.md),
are part of the release gate: the
[regression playbook](./regression-playbook.md)
records when it was last executed and what it proved.

## Conventions enforced here too

`vitest/no-focused-tests` is an error — a `test.only` cannot sneak a red suite into green.
After moving or recreating client files, restart the Vite dev server before running e2e: a
long-lived server holds a stale module graph and serves a blank page.
