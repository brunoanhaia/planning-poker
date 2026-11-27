# Operations Runbook

> **Last verified:** 2026-11-26 against commit `4dd98ef`.

How to run a deployment day to day. Everything here assumes one of the two shapes described
in [Deploy with Docker](./deploy-with-docker.md) or [Hosted Test Deployment](./hosted-test-deployment.md).

## The operational model

- **Room state is memory.** One process owns every room; a restart or a redeploy **empties
  all rooms**, tokens included. Schedule deploys when rooms are quiet, and say so in the
  announcement — "sessions in progress end" is the honest sentence.
- **The 24-hour sweep keeps the footprint bounded**: a room untouched for a day is dropped
  with its tokens, but only once every participant has disconnected. A room with somebody in
  it is never reclaimed, however long it sits.
- **There is no database and no admin API.** Room state is not inspectable from outside; the
  health endpoint and the audit log are the two observability surfaces.

## Health

`GET /api/health` answers `{"status":"ok","timestamp":…}`. Both container images and the
Render service check it every 30 s. A container that fails three consecutive checks (after
the 10 s start period) is marked unhealthy.

## The audit log

One structured JSON line per security-relevant action, keyed by **room and user identifiers
only** — no display name, no token, no vote is ever written:

| Action                                                                                     | Recorded when                                                    |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `room.created`                                                                             | a room is created                                                |
| `room.creation.rejected.limit`                                                             | the room cap is hit                                              |
| `room.dropped.idle`                                                                        | the sweep reclaims an idle room                                  |
| `join.rejected.banned` / `room-full` / `room-not-found` / `rate-limited` / `token-missing` | each specific join refusal                                       |
| `user.kicked`                                                                              | a participant is removed                                         |
| `user.promoted`                                                                            | co-host granted                                                  |
| `user.transferred-host`                                                                    | primary host moved                                               |
| `user.role-changed`                                                                        | another participant's voter/spectator role is toggled            |
| `story.rejected.limit`                                                                     | the backlog quota refuses a story                                |
| `story.index.rejected`                                                                     | an out-of-range story index — a bad request, not a power grab    |
| `message.throttled`                                                                        | a socket went over its message allowance (also closed with 1008) |
| `socket.error`                                                                             | a frame the receiver refused — the socket, not the process, died |
| `connection.rejected.limit`                                                                | the per-address ceiling refused a handshake                      |

Reading it is diagnosis: a burst of `connection.rejected.limit` is a flood or a very large
team behind one NAT; `join.rejected.room-not-found` clusters are code brute-force (or a
mis-shared link); `story.index.rejected` on one user is usually a stale tab.

## Upgrading

1. Announce: rooms in progress end at the restart.
2. Build and roll: `docker compose up --build` (or let the hosted platforms redeploy on
   push).
3. Verify `GET /api/health`, then open a room and run one vote-reveal-reset-accept cycle —
   that single cycle exercises the whole transport.
4. Before a release, the repository's own gate applies: the regression playbook
   ([`docs/regression-playbook.md`](./regression-playbook.md))
   — automated inventory, chaos experiments, exploratory charters.

## The limits an operator gets asked about

All of them are in [Limits and Ceilings](./limits-and-ceilings.md). The three that generate support tickets: the
100-participant room cap (`ROOM_FULL`), the 24-hour idle drop ("my room disappeared"), and
the free-tier spin-down on the hosted stack ("the site is up but nothing connects" — wait a
minute for the wake).
