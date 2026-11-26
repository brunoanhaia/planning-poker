# PlanItPoker

A real-time planning poker app for agile teams: create a room, share the link, and estimate
together. Cards stay hidden until the room reveals them, every revealed round is recorded for
round-over-round comparison, and a session ends with a summary you can export as CSV.

The interface ships in English, Brazilian Portuguese and Spanish, works from 320 px phones to
4K displays, and meets WCAG AA contrast.

## Start here

| I want to…                      | Read                                           |
| ------------------------------- | ---------------------------------------------- |
| Host a session                  | [[Hosting a Session]]                          |
| Join a session                  | [[Joining a Session]]                          |
| Understand who can do what      | [[Roles and Permissions]]                      |
| Vote, reveal, re-vote, accept   | [[Voting and Results]]                         |
| Close a room and export results | [[Session Summary and Export]]                 |
| Fix something that went wrong   | [[Troubleshooting]]                            |
| Understand the architecture     | [[Architecture Overview]]                      |
| Read the wire protocol          | [[Real-Time Protocol]]                         |
| Know the limits                 | [[Limits and Ceilings]]                        |
| Deploy and operate it           | [[Deploy with Docker]], [[Operations Runbook]] |
| Contribute                      | [[Onboarding]], [[Testing Strategy]]           |
| Understand a past choice        | [[Decisions]]                                  |

Every functional and non-functional requirement maps to a page: [[Requirements Trace]].

## How this wiki is maintained

- **This wiki is the source of truth for behavior.** Pages are written from the code, not
  from the README, and each carries a _Last verified_ stamp with the commit it was checked
  against. If a page and the code disagree, the code wins and the page gets fixed.
- **The repository keeps what must match the code exactly** — build and test commands, agent
  rules, requirements, changelog. Wiki pages link there instead of copying.
- Pages are written in English, like every other artifact in this repository.
