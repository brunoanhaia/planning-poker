# Hosting a Session

> **Last verified:** 2026-11-26 against commit `4dd98ef`.

From an empty browser to a running estimation session, as the host experiences it.

## Creating the room

The landing screen asks for two things, in this order:

1. **Your profile** — display name, avatar and color. The browser remembers them
   (`localStorage`: `planit_name`, `planit_avatar`, `planit_color`), so your next room starts
   already filled in.
2. **The room** — an optional title (up to 120 characters) and the estimation deck:

| Deck                | Cards                                         |
| ------------------- | --------------------------------------------- |
| Fibonacci (default) | 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, ?, ☕      |
| Modified Fibonacci  | 0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, ?, ☕ |
| Powers of 2         | 1, 2, 4, 8, 16, 32, 64, ?, ☕                 |
| T-Shirt Sizes       | XS, S, M, L, XL, XXL, ?, ☕                   |
| Custom              | 2–30 unique non-empty cards you define        |

Clicking while the socket is still connecting is safe: the request is queued and runs exactly once when the socket opens — a second click while it is queued is ignored.

The room is created and you enter as **host and spectator** — you have every moderation
power and no vote until you flip your own voter/spectator switch. Voting starts when the
team does, not when the room is minted.

## The setup screen

A brand-new room has no stories, so it opens on the guided setup instead of a voting table.
There you name the room, pick the deck (you can change it later too), and stage the first
backlog:

- **One by one**: title + optional description.
- **Pasted bulk import**: one story per line, with a `;` or `|` separating the title from the
  description — commas stay inside the title, and blank or title-less lines are skipped. Up
  to 50 stories per import; a larger import is split into frame-sized batches automatically,
  and everything stops at the 200-story backlog quota.

The **first story staged starts estimating immediately**; the rest wait as `pending`. Delete
the last story and the room returns to the setup screen. Participants who join before you
stage anything see a waiting card instead of an empty deck.

## Getting people in

Click the room code in the top bar to copy the invite link (`https://your-host/#CODE`).
The code is 8 characters, case-insensitive, with `0`/`O` and `1`/`I` excluded so it can be
read aloud without ambiguity.

Two gates you control:

- **Lock the room** — blocks new joins. Reconnects of existing participants still work.
- **End the session** — closes the room for good: no new joins, no votes, and everyone gets
  the summary (see [[Session Summary and Export]]).

## Running the session

Everything the host and co-hosts can do — reveal, reset, accept, timer, kick, promote,
transfer — is in [[Roles and Permissions]]; the round mechanics and statistics are in
[[Voting and Results]]. Two host-specific habits worth adopting:

- **Appoint a co-host early.** If your connection drops, even for a moment, the host role
  moves to the next online admin and does not come back on reconnect.
- **Use the timer** for timeboxing: presets of 30/60/120/300 seconds, or a custom duration;
  everyone sees the countdown, only you control it.
