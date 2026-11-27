# Limits and Ceilings

> **Last verified:** 2026-11-26 against commit `4dd98ef`.
> The numbers live in [`packages/shared/src/index.ts`](https://github.com/brunoanhaia/planning-poker/blob/main/packages/shared/src/index.ts); this page restates them so nobody has to grep for them.

## Input limits

| Field             | Limit                        | Refusal                   |
| ----------------- | ---------------------------- | ------------------------- |
| Participant name  | 50 characters                | `INVALID_PAYLOAD`         |
| Room title        | 120 characters               | `INVALID_PAYLOAD`         |
| Story title       | 120 characters               | `INVALID_PAYLOAD`         |
| Story description | 2000 characters              | `INVALID_PAYLOAD`         |
| Avatar / color    | 16 / 32 characters           | `INVALID_PAYLOAD`         |
| Bulk import       | 50 stories per message       | `INVALID_PAYLOAD` / quota |
| Custom deck       | 2–30 unique, non-empty cards | `FORBIDDEN` on the change |

Overlong room and story titles are **silently trimmed** by the domain layer rather than
refused; a blank title is a no-op. A custom deck with duplicates or empty cards is refused.

## Resource ceilings

| Resource              | Ceiling                       | Refusal                        |
| --------------------- | ----------------------------- | ------------------------------ |
| Rooms held in memory  | 1000                          | `ROOM_LIMIT_REACHED` on create |
| Participants per room | 100                           | `ROOM_FULL` on a new join      |
| Stories per backlog   | 200                           | `STORY_LIMIT_REACHED`          |
| Revealed rounds kept  | 10 per story (oldest dropped) | —                              |
| Timer duration        | 5–3600 s, default 60 s        | clamped, not refused           |

A bulk import **stops at the quota** instead of overrunning it: the backlog keeps what it had
and refuses the rest. A room untouched for **24 hours** is dropped with its session tokens —
but only once every participant has disconnected; a room with somebody in it is never
reclaimed, however long it sits.

## Transport and abuse ceilings

| Control                    | Value / behavior                                                       | Refusal                      |
| -------------------------- | ---------------------------------------------------------------------- | ---------------------------- |
| WebSocket frame            | 32 KiB maximum                                                         | close `1009`                 |
| Messages per socket        | 30 per 10 s                                                            | `RATE_LIMITED`, close `1008` |
| HTTP requests              | 300 per 15 min per client, ahead of the body parser                    | HTTP `429`                   |
| JSON body                  | 50 KiB                                                                 | HTTP `413`                   |
| Buffered writes per socket | 1 MiB before a stalled client is dropped                               | connection terminated        |
| Sockets per address        | bounded (sized for a shared office NAT)                                | handshake `429`              |
| Failed joins per address   | budgeted per minute; a code that matches a room is never refused by it | `RATE_LIMITED`               |
| Kick bar                   | 5 minutes, advisory (token + participant id + browser cookie)          | `BANNED`                     |

The per-address ceilings are deliberately not quoted to the byte: they are calibrated for a
crowd behind one NAT, and the exact tuning belongs to the server's own constants. What the
table guarantees is the shape — a flood or a room-code brute force is slowed, while the
people sharing the address are not locked out.
