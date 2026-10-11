# Security Review — WebSocket & HTTP Attack Surface

- **Date:** 2026-10-10
- **Scope:** `apps/server` (Express + native `ws`), `apps/client`, `packages/shared`,
  `docker-compose.yml`, `apps/*/Dockerfile`, `apps/client/nginx.conf`
- **Method:** black-box penetration test against a running server (real `ws` clients and
  real HTTP requests) combined with a manual source review of every server module
- **Test server:** `PORT=5055 ALLOWED_ORIGINS=http://localhost:5173 TRUST_PROXY_HOPS=0`
- **Status legend:** `Open` (not fixed) · `Fixed` (code + regression test) ·
  `Accepted` (deliberate product decision, documented)

Every `Fixed` row below has a regression test in the repository, so the finding cannot
silently come back. Findings are ordered by severity, not by discovery order.

---

## 1. Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| SEC-01 | Critical | Unhandled `error` event on a WebSocket connection terminates the whole process | Fixed |
| SEC-02 | High | The documented bulk-import size cannot fit in one frame — every full import kills the server | Fixed |
| SEC-03 | Medium | Message dispatch resolves prototype-chain keys (`constructor`, `__proto__`, …) | Fixed |
| SEC-04 | Medium | No per-address connection cap and no handshake rate limit (connection flood) | Fixed |
| SEC-05 | Medium | Room codes can be brute-forced at ~1.4k guesses/second from one host | Fixed |
| SEC-06 | Low | Identity cookie accepts any value (unbounded key in the ban map) and is never `Secure` | Fixed |
| SEC-07 | Low | Ended sessions still accept joins and votes | Fixed |
| SEC-08 | Info | One `VOTE` on a full backlog broadcasts ~420 KiB to every participant | Accepted |
| SEC-09 | Info | A kicked browser returns by clearing one cookie (advisory ban) | Accepted |
| SEC-10 | Info | `MAX_ROOMS` can be filled to deny room creation for 24 h | Accepted |
| SEC-11 | Info | Origin-less clients may create rooms | Accepted |
| SEC-12 | Info | Session tokens have no expiry; they live as long as the room | Accepted |

---

## 2. Scenarios

### SEC-01 — Process death from a single oversized frame (Critical)

`ws` emits an `'error'` event on the connection when the receiver rejects a frame. The
connection handler in `apps/server/src/webSocketHandler.ts` only registered `pong`,
`message` and `close`, so the error event had no listener and Node treated it as an
unhandled exception, terminating the process. No origin, token or room was required.

**Reproduction** (unauthenticated, no session, no allowed origin needed):

```js
const ws = new WebSocket('ws://127.0.0.1:5055');           // no Origin header at all

// One frame over WS_MAX_PAYLOAD_BYTES (32 768): the envelope around the payload
// is 44 bytes, so this message is 32 769 bytes on the wire.
const oversized = JSON.stringify({ payload: { name: 'A'.repeat(32_769 - 44) }, type: 'CREATE_ROOM' });
ws.on('open', () => ws.send(oversized));
```

**Evidence:** `GET /api/health` returned `200` before the frame and `ECONNREFUSED`
after it. A frame of exactly 32 769 bytes — one byte above `WS_MAX_PAYLOAD_BYTES`
(32 768) — was enough. The socket did close with code 1009, but the process died right
after.

**Why the suite did not catch it:** `apps/server/tests/wsUpgrade.test.ts` asserted the
1009 close on a real server and stayed green, while vitest also reported an unhandled
error and `npm run test` exited `1`. The assertion was right, the process was not.

**Side effect:** `MAX_BULK_STORIES` (50) times the maximum story size
(120 + 2 000 characters) serializes to ~106 KB, far above the 32 KiB frame cap — so the
import feature was unusable and each attempt was also a crash (see SEC-02).

**Fix:** an `'error'` listener on every connection and on the `WebSocketServer`
(`webSocketHandler.ts`), which logs, audits and terminates the socket instead of the
process. Regression test: `apps/server/tests/wsUpgrade.test.ts` keeps serving after an
oversized frame.

### SEC-02 — Bulk import cannot fit in one frame (High)

A 50-story import at the documented maximum lengths is ~106 KB. The client sent it as a
single `BULK_ADD_STORIES` frame, which the server rejects at 32 KiB — turning a normal
admin action into SEC-01.

**Fix:** the client now splits an import into frame-safe batches
(`chunkStoriesForImport` in `apps/client/src/components/story-backlog/story-backlog.utils.ts`),
packs them by measured serialized size inside a byte budget, clamps every field to the
server limits and keeps each batch at or below `MAX_BULK_STORIES`. The transport loop
lives in the socket provider, so the component stays unchanged. Regression tests:
`apps/client/src/components/story-backlog/story-backlog.utils.test.ts`.

### SEC-03 — Prototype-chain dispatch (Medium)

`this.messageHandlers[msg.type]` and `MESSAGE_SCHEMAS[type]` are plain object lookups,
so `type: "constructor"` resolved to `Object` and reached the handler while
`validatePayload` threw `TypeError: schema.safeParse is not a function`. Every such
frame produced a full stack trace in the log (`Failed to parse WebSocket message: …`),
which is log flooding, and it showed the dispatch was not intent-based.

**Evidence:** server log after five frames with `type` set to `constructor`, `__proto__`,
`toString`, `hasOwnProperty` and `valueOf`:

```
Failed to parse WebSocket message: TypeError: schema.safeParse is not a function
    at validatePayload (apps/server/src/validation.ts:172:27)
    at WebSocketHandler.handleMessage (apps/server/src/webSocketHandler.ts:308:28)
```

**Fix:** dispatch only honours own properties (`Object.hasOwn`) and non-object messages
are rejected before lookup. Regression tests: `apps/server/tests/validation.test.ts` and
`apps/server/tests/securityHardening.test.ts`.

### SEC-04 — Connection flood (Medium)

A WebSocket upgrade never passes through the Express middleware, so the HTTP rate limit
does not apply and there is no per-address socket cap. One process opened 1 500 sockets
in 3.1 s and another 200 afterwards, all accepted. The combined exposure is file
descriptor and memory exhaustion for every other client.

**Fix:** `ConnectionLimiter` (`apps/server/src/connectionLimiter.ts`) counts open sockets
per normalized peer address, enforced in `verifyClient` (429 before the upgrade) and
released on `close`. Limit: `WS_MAX_CONNECTIONS_PER_IP` in
`apps/server/src/constants.ts`. Regression tests:
`apps/server/tests/connectionLimiter.test.ts` and
`apps/server/tests/wsUpgrade.test.ts`.

### SEC-05 — Room-code brute force (Medium)

The room code is the only secret: 6 characters from a 32-character alphabet
(`ROOM_ID_CHARSET`, `ROOM_ID_LENGTH`) is ~1.07×10⁹ candidates, and up to 1 000 rooms are
live at once, so a hit is expected after ~1.07×10⁶ probes. Failed joins were free: no
lockout, no audit, and the per-socket throttle (30 per 10 s) resets with every new
socket.

**Measured:** 120 sockets × 30 codes = 3 600 probes answered in 2.6 s →
**1 376 guesses/second from a single host**, ~13 minutes to a live room at that rate.
Failed joins are not written to the audit log, so the attack is invisible.

**Fix:** `JoinFailureLimiter` (`apps/server/src/joinFailureLimiter.ts`) counts failed
joins per address in a sliding window and applies a cool-down when the budget is spent;
a successful join clears the counter. Failed lookups are audited
(`join.rejected.room-not-found`). Regression tests:
`apps/server/tests/joinFailureLimiter.test.ts` and
`apps/server/tests/kickBanFlow.test.ts`.

### SEC-06 — Identity cookie (Low)

`parseClientId` accepted any non-empty cookie value, so a scripted client could plant an
arbitrary (and arbitrarily long) string as a ban-map key, and the cookie was never sent
with `Secure`, so on an HTTP deployment the identity could travel in clear text.

**Fix:** only server-minted UUIDs are accepted (anything else reads as "no identity"),
and the `Secure` attribute is available through `CLIENT_ID_COOKIE_SECURE=true` for TLS
deployments. It stays off by default so the plain-HTTP compose stack keeps working.
Regression tests: `apps/server/tests/clientIdentity.test.ts`.

### SEC-07 — Ended sessions stay open (Low)

`joinParticipant` and `submitVoteForParticipant` never checked `room.isEnded`, so a room
whose host ended the session kept accepting participants and votes.

**Fix:** joins are refused with the new `SESSION_ENDED` code, and votes in an ended
session are rejected at the handler. Regression tests:
`apps/server/tests/roomManager.test.ts` and
`apps/server/tests/kickBanFlow.test.ts`.

### SEC-08 — Broadcast amplification (Info, accepted)

One `VOTE` on a 197-story backlog produced a 420 KiB frame for every listener; with
100 participants and the 30-messages-per-10-seconds allowance that is ~126 MB/s of
server egress from a single participant. Mitigated in practice by the per-socket
throttle, the per-address connection cap (SEC-04) and the room cap; a full fix would
need incremental room-state updates instead of whole-state broadcasts.

### SEC-09 — Advisory kick ban (Info, accepted)

A kicked browser is re-admitted when it returns with a fresh identity cookie. This is
inherent to an anonymous, credential-free product: there is no server-side secret the
client cannot discard. The token, the participant id and the browser profile bars all
hold; a client that discards all three is indistinguishable from a newcomer. IP-keyed
bars would punish the whole room behind a shared proxy.

### SEC-10 — Room-creation denial of service (Info, accepted)

Creating 1 000 rooms (`MAX_ROOMS`) blocks legitimate room creation for at least the 24 h
idle TTL, because the sweep only drops a room once the TTL has passed *and* every
participant is offline — so a participant who stays connected can hold a slot longer than
that. Nothing in the per-address controls removes this: the connection cap (SEC-04)
bounds how many sockets an address holds **at the same time**, not how many rooms it can
create in total, and a room outlives the socket that made it — a client that reconnects
can keep creating rooms until `MAX_ROOMS` is reached. Accepted: rooms are a few hundred
bytes each and the failure mode is denial of *new room creation*, not data loss.

### SEC-11 — Origin-less room creation (Info, accepted)

A client with no `Origin` header may call `CREATE_ROOM` — room creation is open to
anyone by design, and the origin gate exists to stop cross-site WebSocket hijacking of
*existing* rooms (which still requires a valid session token). A per-address connection
cap bounds concurrent sockets only; a client that reconnects can still create rooms until
`MAX_ROOMS` is reached (SEC-10).

### SEC-12 — Token lifetime (Info, accepted)

Session tokens never expire on their own; they live until the room is dropped or the
participant is kicked, i.e. at most the room lifetime. A reconnecting participant keeps
its identity, which is the product requirement. A maximum token lifetime would log
participants out mid-session without adding a real security boundary.

---

## 3. Controls verified as working

These were attacked during the review and held:

- Origin allowlist on the handshake — a page on `http://evil.example` gets `403`
  (cross-site WebSocket hijacking blocked)
- Session tokens are the only accepted proof of identity for non-browser clients; a
  foreign `userId` combined with a valid token creates a second participant instead of
  impersonating the target
- Unrevealed votes never reach another participant (`vote` stays `null`)
- No cross-room broadcast bleed — each socket only receives its own room state
- No prototype pollution from message payloads (no deep merge of client objects)
- Per-socket message throttle disconnects the offender with close code 1008
- CORS does not reflect a hostile origin, and `credentials: true` is scoped to the
  allowlist
- `X-Forwarded-For` is ignored with `TRUST_PROXY_HOPS=0`; the HTTP rate limit keys on
  the real socket address even when the header is rotated
- Full HTTP hardening headers (`X-Frame-Options: DENY`, CSP, HSTS, nosniff, …) and no
  `X-Powered-By`
- Authorization: all 19 privileged actions (`REVEAL_VOTES`, `KICK_PARTICIPANT`,
  `TRANSFER_ADMIN`, `PROMOTE_COADMIN`, `CHANGE_DECK`, `END_SESSION`, …) are refused for
  a non-admin participant with no state change
- Kick flow revokes the token and bars the credential, the participant id and the
  browser profile

---

## 4. Reproducing the review

The review was run against a live server:

```bash
cd apps/server
PORT=5055 ALLOWED_ORIGINS=http://localhost:5173 TRUST_PROXY_HOPS=0 npx tsx src/index.ts
```

and driven with real `ws` and `fetch` clients (disallowed origin, origin-less client,
privilege sweep, kick/rejoin, cross-room token replay, prototype payloads, oversized
frames, handshake floods, room-code probing, HTTP header and rate-limit checks). The
repository test suite covers every `Fixed` finding above, so the review can be repeated
with:

```bash
npm test
npm run lint
```
