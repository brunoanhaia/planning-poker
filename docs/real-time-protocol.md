# Real-Time Protocol

> **Last verified:** 2026-11-26 against commit `4dd98ef`.
> The authoritative definition of every type and payload is
> [`packages/shared/src/index.ts`](https://github.com/brunoanhaia/planning-poker/blob/main/packages/shared/src/index.ts);
> this page explains how they behave on the wire.

## Transport and envelope

Native WebSocket (no socket.io), at the `/ws` path in same-origin deployments. Every frame is
one JSON object:

```json
{ "type": "REVEAL_VOTES", "payload": {} }
```

A client that wants to integrate (a bot, a load test) may connect without an `Origin`
header — the handshake allows origin-less clients — but it plays by the same rules as a
browser: it must hold a room's session token to rebind an existing participant, and it lives
inside the same frame, throttle and rate ceilings.

## What the server does with a frame, in order

1. **Frame cap** — over 32 KiB, the socket is refused with close code `1009`.
2. **Throttle** — over its message allowance (`requirements.md`, FR 15), one `RATE_LIMITED` error and close code `1008`.
3. **Parse** — invalid JSON answers `INVALID_MESSAGE`.
4. **Dispatch** — only own-property handler keys resolve; anything else answers
   `UNKNOWN_ACTION` (a prototype-chain key cannot reach the table).
5. **Validate** — every payload passes its zod schema; failure answers `INVALID_PAYLOAD` and
   nothing is broadcast.
6. **Session** — room-scoped commands need an active session, else `NO_SESSION`.
7. **Domain guard** — the moderation check and the specific refusals
   ([Roles and Permissions](./roles-and-permissions.md)).

The order matters: a malformed frame still costs the sender budget, and an out-of-range story
index is answered as `INVALID_STORY_INDEX` before any permission check.

## Client → server

| Type                         | Payload                                                                   | Who may send                                      |
| ---------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------- |
| `CREATE_ROOM`                | name, avatar?, color?, title?, deckType?, customDeck?, previousRoomToken? | anyone — the token of the room being left ends it |
| `JOIN_ROOM`                  | roomId, name, avatar?, color?, sessionToken?, userId?, previousRoomToken? | anyone — the token rebinds the same participant   |
| `VOTE`                       | vote                                                                      | non-spectators                                    |
| `REVEAL_VOTES`               | —                                                                         | admins                                            |
| `RESET_VOTES`                | —                                                                         | admins                                            |
| `ADD_STORY`                  | title, description?                                                       | admins                                            |
| `BULK_ADD_STORIES`           | stories[]                                                                 | admins (sent in frame-sized batches)              |
| `SET_CURRENT_STORY`          | storyIndex                                                                | admins                                            |
| `UPDATE_STORY_ESTIMATE`      | storyId, estimate (null clears and reopens)                               | storyId, estimate                                 | admins |
| `DELETE_STORY`               | storyId                                                                   | admins                                            |
| `CHANGE_DECK`                | deckType, customDeck?                                                     | admins                                            |
| `TOGGLE_SPECTATOR`           | —                                                                         | anyone (self)                                     |
| `TOGGLE_USER_ROLE`           | targetUserId                                                              | admins (other's voter/spectator)                  |
| `PROMOTE_COADMIN`            | targetUserId                                                              | admins (promote or demote)                        |
| `TRANSFER_ADMIN`             | targetUserId                                                              | **host only**                                     |
| `KICK_PARTICIPANT`           | targetUserId                                                              | admins (never the host)                           |
| `CLEAR_OFFLINE_PARTICIPANTS` | —                                                                         | admins (removes the offline rows)                 |
| `UPDATE_ROOM_TITLE`          | title                                                                     | admins                                            |
| `TOGGLE_LOCK_ROOM`           | —                                                                         | admins                                            |
| `TOGGLE_AUTO_REVEAL`         | —                                                                         | admins                                            |
| `START_TIMER`                | duration? (5–3600 s, default 60)                                          | admins                                            |
| `PAUSE_TIMER`                | —                                                                         | admins (also resumes)                             |
| `RESET_TIMER`                | —                                                                         | admins                                            |
| `END_SESSION`                | —                                                                         | admins                                            |

## Server → client

| Type         | Payload                  | When                                                           |
| ------------ | ------------------------ | -------------------------------------------------------------- |
| `SESSION`    | sessionToken, userId     | After create/join: the token that proves this participant      |
| `ROOM_STATE` | roomState, currentUserId | After every accepted change — **sanitized per recipient**      |
| `KICKED`     | message                  | A kick: the client drops its token and shows the notice        |
| `ERROR`      | code?, message           | Any refusal; the code is the contract, the message is for logs |

There is no acknowledgment protocol: a successful action is answered by the broadcast, a
failed one by an `ERROR`. The client keeps no local room state to reconcile — it renders the
last `ROOM_STATE` it received.

## Error codes

| Code                  | Meaning                                                                                                                       |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `BANNED`              | The 5-minute kick bar still holds this browser/participant                                                                    |
| `FORBIDDEN`           | Authorization: the sender lacks the role the action requires                                                                  |
| `INVALID_MESSAGE`     | The frame is not a JSON object the dispatcher understands                                                                     |
| `INVALID_PAYLOAD`     | The payload failed its zod schema                                                                                             |
| `INVALID_STORY_INDEX` | Story index outside the backlog — a bad request, not a permission refusal                                                     |
| `INVALID_VOTE`        | Card not in the active deck, spectator vote, empty backlog                                                                    |
| `NO_SESSION`          | No active room session on this socket                                                                                         |
| `RATE_LIMITED`        | Socket over its message allowance; closed with 1008                                                                           |
| `ROOM_FULL`           | The room holds its participant cap                                                                                            |
| `ROOM_LIMIT_REACHED`  | The server holds its room cap                                                                                                 |
| `ROOM_LOCKED`         | The host locked the room                                                                                                      |
| `ROOM_NOT_FOUND`      | The code matches no live room                                                                                                 |
| `SESSION_ENDED`       | The session is closed and **read-only**: no joins, votes or content changes — the 14 mutating types answer this after the end | The session is closed: no new joins, no votes |
| `STORY_LIMIT_REACHED` | The backlog holds its quota                                                                                                   |
| `UNKNOWN_ACTION`      | No handler owns this type                                                                                                     |
| `VOTES_REVEALED`      | The round is public — reset before voting again                                                                               |

Reserved in the catalogue but not sent by the current server: `INVALID_DECK` (a bad deck
answers `FORBIDDEN` today) and `PARTICIPANT_LIMIT_REACHED` (joins answer `ROOM_FULL`). The
client still translates both, so a future server can adopt them without a client release.

## Close codes

| Code | Meaning                                                                                   |
| ---- | ----------------------------------------------------------------------------------------- |
| 1008 | Policy violation: the socket went over its message allowance                              |
| 1009 | The frame exceeded 32 KiB                                                                 |
| 4001 | This tab was superseded by a newer tab of the same browser — stand down, do not reconnect |
| 4002 | This browser confirmed a switch to another room — the token here is dead                  |
