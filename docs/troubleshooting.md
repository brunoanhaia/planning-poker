# Troubleshooting

> **Last verified:** 2026-11-26 against commit `4dd98ef`.

Symptoms first, mechanics after. Every quoted message below is the exact text the
application shows (English catalog).

## How the connection behaves

Before the symptoms, the model behind them:

- **The client reconnects by itself.** A dropped socket is retried every 2 seconds. On
  reconnect the browser re-sends `JOIN_ROOM` with the session token it holds, and the server
  rebinds the **same participant** — same seat, same role, refreshed name/avatar/color. You
  do not lose your seat to a network blip. A banner announces the connection state — "Connecting to the server…", "Connection lost. Reconnecting…", "You are offline. Check your connection and retry.", "Waking the server. This can take up to a minute." — in a polite live region, and a create or join issued while the socket is down is queued and runs exactly once when it opens; a second click while the request is queued is ignored.
- **One token, two storages.** The session token lives in `sessionStorage`
  (`planit_session_token`) for the tab and in `localStorage`
  (`planit_room_token:<ROOM CODE>`) per room, so the same browser re-enters its existing
  participant instead of minting a duplicate. Which room this browser is in is tracked in
  `planit_active_room`.
- **One browser, one room session.** Opening a second room in the same browser asks what to
  do with the first; opening the same room in a second tab transfers your seat there.
- **Two close codes are deliberate, not errors.** 4001 and 4002 (below) tell the older tab to
  stand down instead of fighting for the socket.

## Symptoms and what they mean

| Participants who left still appear in the roster, collapsed behind a count | Presence: offline rows stay until cleared; a revealed card still appears in its round, but an offline voter does not count towards round completion. | An admin can "Clear left participants"; the rows are informational. |

| You see                                                                                                              | What happened                                                                                                                                                                                                               | What to do                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| "This room was opened in another tab. This tab stopped updating."                                                    | The same room was opened in a newer tab of this browser (close code 4001). The newer tab owns the participant.                                                                                                              | Use the newer tab, or close it and reload this one.                                                                             |
| "This session ended because the room was opened somewhere else in this browser."                                     | You confirmed opening a **different** room in the same browser (close code 4002). The old room's session was ended with your token.                                                                                         | Nothing to fix — the notice is the contract. Go back via the invite link if it was a mistake.                                   |
| A dialog: "Another session is open — This browser is already in room {{roomId}}. Continuing here ends that session." | You tried to create or join a second room while one is active.                                                                                                                                                              | "Rejoin" returns to the existing room; the danger button ends it and continues with the new one.                                |
| "You have been removed from the session."                                                                            | An administrator kicked you. The bar holds your session token, your participant id and the browser identity cookie for 5 minutes.                                                                                           | Wait 5 minutes and re-enter — or ask the host. A client that discards all three is admitted as a newcomer (advisory by design). |
| "Connection to server lost. Retrying..."                                                                             | The socket dropped; reconnection runs every 2 s.                                                                                                                                                                            | Wait. Your seat is marked offline, not removed — the token rebinds you.                                                         |
| The room code is "not found"                                                                                         | Mistyped code (codes are 8 characters, case-insensitive, with `0`/`O` and `1`/`I` excluded so they can be read aloud), or the room was reclaimed after 24 h idle with everyone disconnected, or the host ended the session. | Re-check the code with the host. A mistyped code in the lobby never drops the token of the room you already had.                |
| "Room is locked. Try again when somebody leaves."                                                                    | The host locked the room to block new joins.                                                                                                                                                                                | Ask the host to unlock.                                                                                                         |
| "Room is full. Try again when somebody leaves."                                                                      | The room holds its cap of 100 participants.                                                                                                                                                                                 | Wait for someone to leave or be kicked.                                                                                         |
| A banner: the session has ended, with a summary                                                                      | The host ended the session. New joins and votes are refused; a reconnecting existing participant is still honored.                                                                                                          | Read the summary, export the CSV, and ask for a new room.                                                                       |
| Your vote is not accepted                                                                                            | Votes are refused when revealed (`VOTES_REVEALED`), the card left the deck after a deck change (`INVALID_VOTE`), the session ended (`SESSION_ENDED`), or you are a spectator.                                               | Wait for the host to reset the round, re-pick from the active deck, or flip the voter/spectator switch in the top bar.          |
| "Waiting for Host to reveal"                                                                                         | Normal state for a non-admin before the reveal.                                                                                                                                                                             | Nothing — the host reveals (or enables auto-reveal).                                                                            |
| "Waiting for the host to set up the session"                                                                         | You joined before the host staged the first story.                                                                                                                                                                          | Look around; the deck appears when the host starts.                                                                             |
| "Too many messages. Slow down and try again in a few seconds."                                                       | The socket exceeded its message allowance and was closed with code 1008.                                                                                                                                                    | Reload the page. A human clicking cards cannot hit this; a script can.                                                          |
| A notice switches language mid-session                                                                               | Not a glitch: notices are stored as machine codes and translated on render, so a language change re-translates what is already on screen.                                                                                   | Nothing.                                                                                                                        |

## Kicked, and the 5-minute bar

The bar is **advisory by design**, and knowing what it holds explains its limits:

- The server revokes the kicked participant's session tokens and bars, for 5 minutes: the
  revoked tokens, the participant id, and the browser identity cookie (`HttpOnly`, issued on
  the first HTTP response and on the handshake).
- A browser that discards the token **and** clears the cookie is admitted as a brand-new
  participant. An open room cannot tell a stubborn returner from a genuine newcomer, and
  pretending otherwise would be security theater.
- If the deployment serves plain HTTP, the cookie is not `Secure` — that is expected; on TLS
  the host should set `CLIENT_ID_COOKIE_SECURE=true`.

## If you operate the deployment

Three host-side causes cover most "the app does not connect" reports:

- **The WebSocket URL must end in `/ws`.** With `VITE_WS_URL` empty the browser dials
  `window.location.host` at the `/ws` path — the only route Nginx proxies. A bare host serves
  the SPA, and the handshake fails silently.
- **The origin must be allowlisted.** A browser always sends `Origin`; the handshake answers
  `403` for anything outside `ALLOWED_ORIGINS`. Behind Nginx, share the alias URL, not a
  per-deployment one.
- **The token cookie needs HTTPS to be `Secure`.** On plain HTTP the kick bar degrades to the
  token alone — the cookie would be dropped by the browser if it were marked `Secure`.
