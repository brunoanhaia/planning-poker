# Requirements Trace

> **Last verified:** 2026-11-26 against commit `4dd98ef`.
> The numbered, canonical list is
> [`requirements.md`](https://github.com/brunoanhaia/planning-poker/blob/main/requirements.md)
> in the repository. This page maps every requirement to the docs pages that document it, so
> "where is X described?" has one answer — and so a requirement without a page is visible the
> moment it is added.

The mapping is enforced: the repository's `requirements-trace` workflow fails a pull request
whose `requirements.md` holds a number this page does not carry — and a stale row nothing
backs. Run the same check locally with `npm run trace:check`.

## Functional requirements

| #   | Requirement (gist)                                                                         | Documented in                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Real-time native WebSocket synchronization                                                 | [Architecture Overview](./architecture-overview.md), [Real Time Protocol](./real-time-protocol.md)                                            |
| 2   | Room lifecycle: create, join, leave, idle reclaim                                          | [Hosting a Session](./hosting-a-session.md), [Joining a Session](./joining-a-session.md), [Limits and Ceilings](./limits-and-ceilings.md)     |
| 3   | Four roles, defined permissions                                                            | [Roles and Permissions](./roles-and-permissions.md)                                                                                           |
| 4   | Voting flow: vote, reveal, reset, finalize, frozen revealed cards, auto-progression        | [Voting and Results](./voting-and-results.md), [Roles and Permissions](./roles-and-permissions.md)                                            |
| 5   | Room settings: rename, lock, change deck                                                   | [Roles and Permissions](./roles-and-permissions.md), [Hosting a Session](./hosting-a-session.md)                                              |
| 6   | Participant management: kick, promote, transfer; offline rows and the clear-left action    | [Roles and Permissions](./roles-and-permissions.md)                                                                                           |
| 7   | Backlog: add, edit, delete, bulk import, manual estimate; active-story coherence on delete | [Hosting a Session](./hosting-a-session.md), [Voting and Results](./voting-and-results.md)                                                    |
| 8   | Synchronized countdown timer; a reset rewinds it, the end stops it                         | [Voting and Results](./voting-and-results.md), [Roles and Permissions](./roles-and-permissions.md)                                            |
| 9   | Responsive from 320px to 4K, no overlap                                                    | [Testing Strategy](./testing-strategy.md) (the overlap-axe gate)                                                                              |
| 10  | WAI-ARIA, keyboard navigable, WCAG AA                                                      | [Testing Strategy](./testing-strategy.md) (zero-violation axe gate)                                                                           |
| 11  | Session identity: tokens, one tab, one room per browser, 4001/4002                         | [Joining a Session](./joining-a-session.md), [Troubleshooting](./troubleshooting.md), [Security Model](./security-model.md)                   |
| 12  | Every inbound payload validated before logic                                               | [Real Time Protocol](./real-time-protocol.md)                                                                                                 |
| 13  | Server-side input limits                                                                   | [Limits and Ceilings](./limits-and-ceilings.md)                                                                                               |
| 14  | Safe CSV export                                                                            | [Session Summary and Export](./session-summary-and-export.md)                                                                                 |
| 15  | Per-socket message allowance, 1008 on excess                                               | [Limits and Ceilings](./limits-and-ceilings.md), [Real Time Protocol](./real-time-protocol.md)                                                |
| 16  | HTTP rate limit ahead of the body parser                                                   | [Limits and Ceilings](./limits-and-ceilings.md), [Architecture Overview](./architecture-overview.md)                                          |
| 17  | Resource ceilings, each with its own error code                                            | [Limits and Ceilings](./limits-and-ceilings.md), [Real Time Protocol](./real-time-protocol.md)                                                |
| 18  | Idle-room reclamation, never with someone inside                                           | [Limits and Ceilings](./limits-and-ceilings.md), [Operations Runbook](./operations-runbook.md)                                                |
| 19  | Kick cooldown, advisory by design                                                          | [Troubleshooting](./troubleshooting.md), [Security Model](./security-model.md), [Decisions](./decisions.md)                                   |
| 20  | Distinguishable failures (`ErrorCode`, `INVALID_STORY_INDEX`)                              | [Real Time Protocol](./real-time-protocol.md), [Roles and Permissions](./roles-and-permissions.md)                                            |
| 21  | Audit trail, ids only, no names/tokens/votes                                               | [Operations Runbook](./operations-runbook.md), [Security Model](./security-model.md)                                                          |
| 22  | First-party identity cookie                                                                | [Security Model](./security-model.md), [Troubleshooting](./troubleshooting.md)                                                                |
| 23  | Voting rounds, append-only, capped at 10                                                   | [Voting and Results](./voting-and-results.md), [Limits and Ceilings](./limits-and-ceilings.md)                                                |
| 24  | Session summary with CSV                                                                   | [Session Summary and Export](./session-summary-and-export.md)                                                                                 |
| 25  | Result statistics, symbolic cards excluded                                                 | [Voting and Results](./voting-and-results.md)                                                                                                 |
| 26  | Interface languages, CLDR plurals, persisted choice                                        | [Home](./README.md), [Adding a Language](./adding-a-language.md)                                                                              |
| 27  | Guided session setup, creator as spectator, waiting state                                  | [Hosting a Session](./hosting-a-session.md), [Joining a Session](./joining-a-session.md), [Roles and Permissions](./roles-and-permissions.md) |
| 28  | Connection lifecycle and cold start (queued create/join, announced states)                 | [Troubleshooting](./troubleshooting.md), [Real Time Protocol](./real-time-protocol.md)                                                        |

## Non-functional requirements

| #     | Requirement (gist)                                                          | Documented in                                                                                                |
| ----- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1–2   | Sub-200 ms interaction, hundreds of participants on lightweight `ws`        | [Architecture Overview](./architecture-overview.md)                                                          |
| 3     | Heartbeat detection of dead connections                                     | [Architecture Overview](./architecture-overview.md), [Real Time Protocol](./real-time-protocol.md)           |
| 4–5   | zod validation, strict typing, no `any`                                     | [Real Time Protocol](./real-time-protocol.md), [Onboarding](./onboarding.md)                                 |
| 6–7   | Unit, e2e, a11y coverage; modular architecture                              | [Testing Strategy](./testing-strategy.md), [Architecture Overview](./architecture-overview.md)               |
| 8     | Ant Design only, centralized theme                                          | [Decisions](./decisions.md), [Onboarding](./onboarding.md)                                                   |
| 9–10  | Documentation kept current; containers                                      | this site, [Deploy with Docker](./deploy-with-docker.md)                                                     |
| 11–13 | HTTP hardening, frame cap, explicit proxy trust                             | [Security Model](./security-model.md), [Deploy with Docker](./deploy-with-docker.md)                         |
| 14–15 | Bounded memory; auditability without participant data                       | [Limits and Ceilings](./limits-and-ceilings.md), [Operations Runbook](./operations-runbook.md)               |
| 16–18 | Availability under abuse; room codes as secrets; identity behind Cloudflare | [Security Model](./security-model.md), [Limits and Ceilings](./limits-and-ceilings.md)                       |
| 19–20 | Intent-based dispatch; read-only session closure                            | [Real Time Protocol](./real-time-protocol.md), [Session Summary and Export](./session-summary-and-export.md) |
| 21    | Translation architecture, with copy parity across locales                   | [Adding a Language](./adding-a-language.md), [Decisions](./decisions.md)                                     |
