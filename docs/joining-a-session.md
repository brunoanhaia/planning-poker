# Joining a Session

> **Last verified:** 2026-11-26 against commit `4dd98ef`.

## Getting in

- **The easy way** is the invite link — `https://the-host/#CODE` opens the landing screen
  with the join tab pre-filled and the code already typed in.
- **The manual way** is the code itself: 8 characters, uppercase-enforced as you type,
  case-insensitive on the wire. `0`/`O` and `1`/`I` never appear in a code, so a code read
  aloud cannot be misheard into another character.

Your display name, avatar and color are remembered from the last time, and a new joiner
enters as a **voter**.

## What the room does with you

- The server issues a **session token** bound to your participant, stored per tab and per
  room. Reopening the same room in the same browser rebinds the same participant — you keep
  your seat, your role and your revealed history instead of appearing twice in the roster.
- **One browser holds one room session.** Creating or joining a different room while one is
  active opens a confirmation: go back to the existing room, or end it and continue with the
  new one.
- **One tab owns your seat.** Opening the room in a second tab of the same browser transfers
  the participant there; the older tab receives a notice and stops updating instead of
  fighting for the connection.
- Join before the host staged the first story? You see a waiting card — the deck appears
  when the session starts.

## When the join is refused

| The app says                      | Why                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Room not found                    | The code is mistyped, or the room was reclaimed after 24 hours idle with everyone disconnected, or the session ended. |
| Room is locked                    | The host locked the room. Ask them to unlock.                                                                         |
| Room is full                      | The room holds its cap of 100 participants.                                                                           |
| This session has ended            | The host ended the session — ask for a new room.                                                                      |
| You are barred (removed recently) | A kick bars this browser for 5 minutes; wait and re-enter.                                                            |

A mistyped code in the lobby never drops the token of the room you already have — the two
are deliberately separate.

## If the connection drops

Nothing to do: the banner names the state (reconnecting, offline, or waking a sleeping server — with a retry once it answers), the browser retries every 2 seconds and re-presents the session token, which
rebinds your existing participant with the same seat and role. If you were the host, note
that the host role moves on disconnect — see [Roles and Permissions](./roles-and-permissions.md). Everything else that
can go wrong, including the two deliberate close codes, is in [Troubleshooting](./troubleshooting.md).
