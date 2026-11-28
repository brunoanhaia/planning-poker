# PlanItPoker

A real-time planning poker app for agile teams: create a room, share the link, and estimate
together. Cards stay hidden until the room reveals them, every revealed round is recorded for
round-over-round comparison, and a session ends with a summary you can export as CSV.

The interface ships in English, Brazilian Portuguese and Spanish, works from 320 px phones to
4K displays, and meets WCAG AA contrast.

## Start here

| I want to…                      | Read                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| Host a session                  | [Hosting a Session](./hosting-a-session.md)                                                  |
| Join a session                  | [Joining a Session](./joining-a-session.md)                                                  |
| Understand who can do what      | [Roles and Permissions](./roles-and-permissions.md)                                          |
| Vote, reveal, re-vote, accept   | [Voting and Results](./voting-and-results.md)                                                |
| Close a room and export results | [Session Summary and Export](./session-summary-and-export.md)                                |
| Fix something that went wrong   | [Troubleshooting](./troubleshooting.md)                                                      |
| Understand the architecture     | [Architecture Overview](./architecture-overview.md)                                          |
| Read the wire protocol          | [Real Time Protocol](./real-time-protocol.md)                                                |
| Know the limits                 | [Limits and Ceilings](./limits-and-ceilings.md)                                              |
| Deploy and operate it           | [Deploy with Docker](./deploy-with-docker.md), [Operations Runbook](./operations-runbook.md) |
| Contribute                      | [Onboarding](./onboarding.md), [Testing Strategy](./testing-strategy.md)                     |
| Understand a past choice        | [Decisions](./decisions.md)                                                                  |

Every functional and non-functional requirement maps to a page: [Requirements Trace](./requirements-trace.md).

## How these docs are maintained

- **These pages are the source of truth for behavior.** They are written from the code, not
  from the README, and each carries a _Last verified_ stamp with the commit it was checked
  against. If a page and the code disagree, the code wins and the page gets fixed.
- **One source, two audiences.** The pages live in `docs/` and travel through pull requests
  like any other change. Agents read them straight from the tree; people read the same
  pages rendered at <https://brunoanhaia.github.io/planning-poker/> — built on merge, never
  edited there.
- **The repository keeps what must match the code exactly** — build and test commands, agent
  rules, requirements, changelog. The pages link there instead of copying.
- Pages are written in English, like every other artifact in this repository.
