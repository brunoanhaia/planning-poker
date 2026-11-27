# Requirements Trace

> **Last verified:** 2026-11-26 against commit `c557e49`.
> The numbered, canonical list is
> [`requirements.md`](https://github.com/brunoanhaia/planning-poker/blob/main/requirements.md)
> in the repository. This page maps every requirement to the wiki pages that document it, so
> "where is X described?" has one answer — and so a requirement without a page is visible the
> moment it is added.

The mapping is enforced: the repository's `requirements-trace` workflow fails a pull request
whose `requirements.md` holds a number this page does not carry — and a stale row nothing
backs. Run the same check locally with `npm run trace:check`.

## Functional requirements

| #   | Requirement (gist)                                                                  | Documented in                                                           |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 1   | Real-time native WebSocket synchronization                                          | [[Architecture Overview]], [[Real-Time Protocol]]                       |
| 2   | Room lifecycle: create, join, leave, idle reclaim                                   | [[Hosting a Session]], [[Joining a Session]], [[Limits and Ceilings]]   |
| 3   | Four roles, defined permissions                                                     | [[Roles and Permissions]]                                               |
| 4   | Voting flow: vote, reveal, reset, finalize, frozen revealed cards, auto-progression | [[Voting and Results]], [[Roles and Permissions]]                       |
| 5   | Room settings: rename, lock, change deck                                            | [[Roles and Permissions]], [[Hosting a Session]]                        |
| 6   | Participant management: kick, promote, transfer                                     | [[Roles and Permissions]]                                               |
| 7   | Backlog: add, edit, delete, bulk import, manual estimate                            | [[Hosting a Session]], [[Voting and Results]]                           |
| 8   | Synchronized countdown timer                                                        | [[Voting and Results]], [[Roles and Permissions]]                       |
| 9   | Responsive from 320px to 4K, no overlap                                             | [[Testing Strategy]] (the overlap-axe gate)                             |
| 10  | WAI-ARIA, keyboard navigable, WCAG AA                                               | [[Testing Strategy]] (zero-violation axe gate)                          |
| 11  | Session identity: tokens, one tab, one room per browser, 4001/4002                  | [[Joining a Session]], [[Troubleshooting]], [[Security Model]]          |
| 12  | Every inbound payload validated before logic                                        | [[Real-Time Protocol]]                                                  |
| 13  | Server-side input limits                                                            | [[Limits and Ceilings]]                                                 |
| 14  | Safe CSV export                                                                     | [[Session Summary and Export]]                                          |
| 15  | Per-socket message allowance, 1008 on excess                                        | [[Limits and Ceilings]], [[Real-Time Protocol]]                         |
| 16  | HTTP rate limit ahead of the body parser                                            | [[Limits and Ceilings]], [[Architecture Overview]]                      |
| 17  | Resource ceilings, each with its own error code                                     | [[Limits and Ceilings]], [[Real-Time Protocol]]                         |
| 18  | Idle-room reclamation, never with someone inside                                    | [[Limits and Ceilings]], [[Operations Runbook]]                         |
| 19  | Kick cooldown, advisory by design                                                   | [[Troubleshooting]], [[Security Model]], [[Decisions]]                  |
| 20  | Distinguishable failures (`ErrorCode`, `INVALID_STORY_INDEX`)                       | [[Real-Time Protocol]], [[Roles and Permissions]]                       |
| 21  | Audit trail, ids only, no names/tokens/votes                                        | [[Operations Runbook]], [[Security Model]]                              |
| 22  | First-party identity cookie                                                         | [[Security Model]], [[Troubleshooting]]                                 |
| 23  | Voting rounds, append-only, capped at 10                                            | [[Voting and Results]], [[Limits and Ceilings]]                         |
| 24  | Session summary with CSV                                                            | [[Session Summary and Export]]                                          |
| 25  | Result statistics, symbolic cards excluded                                          | [[Voting and Results]]                                                  |
| 26  | Interface languages, CLDR plurals, persisted choice                                 | [[Home]], [[Adding a Language]]                                         |
| 27  | Guided session setup, creator as spectator, waiting state                           | [[Hosting a Session]], [[Joining a Session]], [[Roles and Permissions]] |

## Non-functional requirements

| #     | Requirement (gist)                                                          | Documented in                                          |
| ----- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| 1–2   | Sub-200 ms interaction, hundreds of participants on lightweight `ws`        | [[Architecture Overview]]                              |
| 3     | Heartbeat detection of dead connections                                     | [[Architecture Overview]], [[Real-Time Protocol]]      |
| 4–5   | zod validation, strict typing, no `any`                                     | [[Real-Time Protocol]], [[Onboarding]]                 |
| 6–7   | Unit, e2e, a11y coverage; modular architecture                              | [[Testing Strategy]], [[Architecture Overview]]        |
| 8     | Ant Design only, centralized theme                                          | [[Decisions]], [[Onboarding]]                          |
| 9–10  | Documentation kept current; containers                                      | this wiki, [[Deploy with Docker]]                      |
| 11–13 | HTTP hardening, frame cap, explicit proxy trust                             | [[Security Model]], [[Deploy with Docker]]             |
| 14–15 | Bounded memory; auditability without participant data                       | [[Limits and Ceilings]], [[Operations Runbook]]        |
| 16–18 | Availability under abuse; room codes as secrets; identity behind Cloudflare | [[Security Model]], [[Limits and Ceilings]]            |
| 19–20 | Intent-based dispatch; final session closure                                | [[Real-Time Protocol]], [[Session Summary and Export]] |
| 21    | Translation architecture                                                    | [[Adding a Language]], [[Decisions]]                   |
