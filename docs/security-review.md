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
silently come back — except SEC-16, which is a deployment template and is instead pinned by
the default `docker-compose.yml` already uses for the same variable. Findings are ordered by
severity, not by discovery order.

---

## 1. Findings

| ID     | Severity | Finding                                                                                      | Status   |
| ------ | -------- | -------------------------------------------------------------------------------------------- | -------- |
| SEC-01 | Critical | Unhandled `error` event on a WebSocket connection terminates the whole process               | Fixed    |
| SEC-02 | High     | The documented bulk-import size cannot fit in one frame — every full import kills the server | Fixed    |
| SEC-03 | Medium   | Message dispatch resolves prototype-chain keys (`constructor`, `__proto__`, …)               | Fixed    |
| SEC-04 | Medium   | No per-address connection cap and no handshake rate limit (connection flood)                 | Fixed    |
| SEC-05 | Medium   | Room codes can be brute-forced at ~1.4k guesses/second from one host                         | Fixed    |
| SEC-06 | Low      | Identity cookie accepts any value (unbounded key in the ban map) and is never `Secure`       | Fixed    |
| SEC-07 | Low      | Ended sessions still accept joins and votes                                                  | Fixed    |
| SEC-08 | Info     | One `VOTE` on a full backlog broadcasts ~420 KiB to every participant                        | Accepted |
| SEC-09 | Info     | A kicked browser returns by clearing one cookie (advisory ban)                               | Accepted |
| SEC-10 | Info     | `MAX_ROOMS` can be filled to deny room creation for 24 h                                     | Accepted |
| SEC-11 | Info     | Origin-less clients may create rooms                                                         | Accepted |
| SEC-12 | Info     | Session tokens have no expiry; they live as long as the room                                 | Accepted |
| SEC-13 | High     | A socket that switches rooms keeps its previous seat online, pinning rooms past `MAX_ROOMS`  | Fixed    |
| SEC-14 | Medium   | The failed-join budget does not gate the room lookup, so a barred address keeps probing      | Fixed    |
| SEC-15 | High     | Server writes have no backpressure check, so a non-reading client buffers unbounded memory   | Fixed    |
| SEC-16 | Medium   | `.env.example` ships `TRUST_PROXY_HOPS=0`, collapsing every client onto the proxy address    | Fixed    |
| SEC-17 | Low      | `TRANSFER_ADMIN` clears `isHost` but keeps `isAdmin`, so the previous host stays an admin    | Fixed    |

---

## 2. Scenarios

### SEC-01 — Process death from a single oversized frame (Critical)

`ws` emits an `'error'` event on the connection when the receiver rejects a frame. The
connection handler in `apps/server/src/webSocketHandler.ts` only registered `pong`,
`message` and `close`, so the error event had no listener and Node treated it as an
unhandled exception, terminating the process. No origin, token or room was required.

**Reproduction** (unauthenticated, no session, no allowed origin needed):

```js
const ws = new WebSocket('ws://127.0.0.1:5055'); // no Origin header at all

// One frame over WS_MAX_PAYLOAD_BYTES (32 768): the envelope around the payload
// is 44 bytes, so this message is 32 769 bytes on the wire.
const oversized = JSON.stringify({
    payload: { name: 'A'.repeat(32_769 - 44) },
    type: 'CREATE_ROOM',
});
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
(`chunkStoriesForImport` in `apps/client/src/utils/bulk-import.ts`),
packs them by measured serialized size inside a byte budget, clamps every field to the
server limits and keeps each batch at or below `MAX_BULK_STORIES`. The transport loop
lives in the socket provider, so the component stays unchanged. Regression tests:
`apps/client/src/utils/bulk-import.test.ts`.

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
`apps/server/tests/kickBanFlow.test.ts`.

### SEC-04 — Connection flood (Medium)

A WebSocket upgrade never passes through the Express middleware, so the HTTP rate limit
does not apply and there is no per-address socket cap. One process opened 1 500 sockets
in 3.1 s and another 200 afterwards, all accepted. The combined exposure is file
descriptor and memory exhaustion for every other client.

**Fix:** `ConnectionLimiter` (`apps/server/src/connectionLimiter.ts`) counts open sockets
per normalized peer address, enforced in `verifyClient` (429 before the upgrade) and
released on `close`, alongside a handshake _rate_ that catches short-lived sockets — those
never accumulate concurrency, so they walked straight past a concurrency-only cap.
Regression tests: `apps/server/tests/connectionLimiter.test.ts` and
`apps/server/tests/wsUpgrade.test.ts`.

**Behind Cloudflare the address is the real client.** Cloudflare replaces the peer with its
own edge and the client in `CF-Connecting-IP`, so without that every client behind it would
look like one address and the limits would answer a whole region with 429. The header is
honoured only for requests that genuinely arrive from a published Cloudflare range, which
makes the claim verifiable rather than configured: a client that reaches the listener
directly and sets the header is still counted under its own address. `X-Forwarded-For` is
not walked in front of Cloudflare, because the value a client sent before Cloudflare
overwrote it is not worth honouring.

**The ceilings are sized for a shared address, not against it.** An office, a school or a
mobile carrier put hundreds of people behind one address, and a limit a crowd can reach
answers that crowd with 429: `WS_MAX_CONNECTIONS_PER_IP` (300 concurrent) is sized for a
100-person room plus several more rooms behind the same NAT, and
`WS_MAX_CONNECTIONS_PER_WINDOW` (600 per minute) for a large team arriving at once. Both
sit an order of magnitude above any plausible human burst and far below the measured flood
of 1 500 sockets in three seconds. They are source-level constants, so moving them is a
code change and a redeployment, not a deployment setting.

### SEC-05 — Room-code brute force (Medium)

The room code was the only secret: 6 characters from a 32-character alphabet
(`ROOM_ID_CHARSET`, `ROOM_ID_LENGTH`) is ~1.07×10⁹ candidates, and up to 1 000 rooms were
live at once, so a hit was expected after ~1.07×10⁶ probes. Failed joins were free: no
lockout, no audit, and the per-socket throttle (30 per 10 s) resets with every new socket.

**Measured:** 120 sockets × 30 codes = 3 600 probes answered in 2.6 s →
**1 376 guesses/second from a single host**, ~13 minutes to a live room at that rate.
Failed joins are not written to the audit log, so the attack is invisible.

**Fix, part one — the secret got longer.** The code is now 8 characters, which is
~1.1×10¹² candidates: at the ~1 400 guesses per second a single host could once reach,
walking the keyspace takes about nine days _with no other control in the way_, against
minutes before. That removes the reason to be aggressive with the per-address budget, so
the remaining limits are a backstop rather than the defence. The length is pinned by
`apps/server/tests/idGenerator.test.ts`, so a future shortening cannot slip through silently.

**Fix, part two — `JoinFailureLimiter`** (`apps/server/src/joinFailureLimiter.ts`) charges a budget
of **distinct** unknown codes per address, applies a cool-down when it is spent, and
audits every lookup that matched no room (`join.rejected.room-not-found`). The tracked
state is bounded by `JOIN_FAILURE_MAX_TRACKED_ADDRESSES`, because a client cycling through
distinct addresses leaves one record each and the hourly sweep only reclaims them.
Regression tests: `apps/server/tests/joinFailureLimiter.test.ts` and
`apps/server/tests/kickBanFlow.test.ts`.

**Why distinct codes and not attempts:** a person who mistypes retypes the _same_ wrong
code; a brute-forcer generates thousands of _different_ ones. The same code therefore
counts once however often it is submitted, while every new unknown code spends another
entry of the budget — which collapses a whole office of typos into a single entry, so a
shared address cannot be barred by its own users.

**The budget never blocks a code that exists.** The first version counted _attempts_ and
refused every join from a barred address, which punished everybody behind a shared
address: one office's typos locked their colleagues out of the room they were entering,
and a carrier-grade NAT would let a single stranger do it to thousands of people. The
room was therefore looked up _before_ the budget was consulted, so a code that matched a
room never saw the budget at all — measured against a live server, 21 wrong codes from
other users no longer stopped a participant holding the correct one from joining.

**That ordering is reversed in SEC-14.** Looking the room up first also let a barred
address keep probing and join on a hit, so the budget now gates the lookup; the cost is
that a shared address can be locked out for the cool-down window.

**A join challenge was evaluated and rejected.** Cloudflare Turnstile would have asked a
participant that arrives with nothing but a room code to prove it is a browser, with a
token that cannot be replayed. It was built, reviewed and then removed, and the reason is
worth recording rather than leaving as an unexplained gap: **the longer room code already
answers this finding.** Eight characters is ~1.1×10¹² candidates, about nine days of
guessing with no other control in the way, so the challenge was defending against an attack
that had stopped being practical.

What it cost was out of proportion to that. It forced the join handler onto an asynchronous
path, which took the handler's cognitive complexity over the limit and required extracting
its bars into a method of their own; it added ~900 lines across verifier, widget, shared
types, environment, compose and tests; and the async path is where seven defects came from,
several of them functional — a missing early return that admitted a participant the join had
just refused, a render target that was not a selector so the widget never appeared at all,
a spent token reused on retry, a script-load race, and a destructuring error that only
`tsc` caught. By comparison the code length is a ~73-line change that has produced no
defects at all.

The part of Cloudflare that stays is the address (`CF-Connecting-IP`), because per-address
limits genuinely cannot work without it. If a deployment needs a challenge — a public
instance under sustained automated pressure — the hook points are the join bar in
`refuseJoin` and the error code list, not a rewrite.

### SEC-06 — Identity cookie (Low)

`parseClientId` accepted any non-empty cookie value, so a scripted client could plant an
arbitrary (and arbitrarily long) string as a ban-map key, and the cookie was never sent
with `Secure`, so on an HTTP deployment the identity could travel in clear text.

**Fix:** only values shaped like the UUIDs the server mints are accepted — the check is
on the format, not on the value, so it bounds what a client can plant as a ban-map key
rather than proving provenance. Anything else reads as "no identity". The `Secure`
attribute is available through `CLIENT_ID_COOKIE_SECURE=true` for TLS deployments; it
stays off by default so the plain-HTTP compose stack keeps working.
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
idle TTL, because the sweep only drops a room once the TTL has passed _and_ every
participant is offline — so a participant who stays connected can hold a slot longer than
that. Nothing in the per-address controls removes this: the connection cap (SEC-04)
bounds how many sockets an address holds **at the same time**, not how many rooms it can
create in total, and a room outlives the socket that made it — a client that reconnects
can keep creating rooms until `MAX_ROOMS` is reached. Accepted: rooms are a few hundred
bytes each and the failure mode is denial of _new room creation_, not data loss.

**SEC-13 removes the permanent form of this.** A socket that switched rooms left its
previous seat marked online with no socket behind it, so that room could never be swept;
releasing the previous binding on switch lets the sweep reclaim it once the new room is
the only one the socket owns. The accepted ceiling stands for rooms held by a live
socket.

### SEC-11 — Origin-less room creation (Info, accepted)

A client with no `Origin` header may call `CREATE_ROOM` — room creation is open to
anyone by design, and the origin gate exists to stop cross-site WebSocket hijacking of
_existing_ rooms (which still requires a valid session token). A per-address connection
cap bounds concurrent sockets only; a client that reconnects can still create rooms until
`MAX_ROOMS` is reached (SEC-10).

### SEC-12 — Token lifetime (Info, accepted)

Session tokens never expire on their own; they live until the room is dropped or the
participant is kicked, i.e. at most the room lifetime. A reconnecting participant keeps
its identity, which is the product requirement. A maximum token lifetime would log
participants out mid-session without adding a real security boundary.

### SEC-13 — Room switching never released the previous seat (High)

`enterRoom` overwrote `ws.roomId` and `ws.userId` and `SessionRegistry.bind` only added the
new key: nothing removed the previous one, and `endPreviousRoom` returned early without a
token. The client's Leave was client-only, so no frame ever told the server the old seat was
vacant. The previous participant therefore stayed `isOnline: true` with no socket behind it,
and `sweepIdleRooms` refuses to reclaim a room that holds an online participant — so every
`CREATE_ROOM` that switched rooms pinned one more room permanently. No later connection owns
that seat, so nothing could ever take it offline again: repeated room creation walked the
server to `MAX_ROOMS` and kept it there (replacing the temporary denial of SEC-10 with a
permanent one).

**Fix:** `enterRoom` releases the socket's previous binding before binding the new one —
`leaveRoom` plus the room-state broadcast, and the registry entry for the old room is
dropped — so the abandoned room sees its last participant go offline and becomes reclaimable.
Where the browser still presents the old room's token, the existing `endPreviousRoom` path
revokes that row and broadcasts once instead, so the same change is not announced twice.
Regression tests: `apps/server/tests/sessionReplaced.test.ts` (`releases the seat a socket
left when it creates another room`, `releases the previous room when the socket joins
another one`).

**Still client-driven:** the "Leave" button stays a client-only action, so a browser that
closes the tab without switching rooms relies on the socket close, exactly as before. A
later review may add a `LEAVE_ROOM` message to make the client's Leave server-side and
release the seat at the moment the participant leaves the room.

### SEC-14 — The failed-join budget did not gate the room lookup (Medium)

`handleJoinRoom` called `seatParticipant` before `JoinAdmission.reportUnknownRoom`
consulted `joinFailures.allows`, so the budget only ever decided what to audit and throttle
_after_ the room had already been looked up. A barred address kept probing at the throttle
rate — with 300 sockets, the per-address ceiling of SEC-04, that is ~900 room lookups per
second — and a probe that hit a live room still joined it, because joining never reached the
check.

**Fix:** the budget is consulted before the lookup, so a barred address gets `RATE_LIMITED`
without the lookup running at all, and cannot distinguish a code that exists from one that
does not. Accepted trade-off: because the budget is keyed on the shared address, a NAT can be
locked out for the cool-down window by its own members (or by a stranger on the same address);
the window is one minute, and a legitimately barred user retries with the same code once it
passes. Regression tests: `apps/server/tests/kickBanFlow.test.ts` (`describe('Failed room
joins')` — `refuses a code that exists once the budget is spent`, `refuses a valid room code
from a barred address and admits a different address`).

### SEC-15 — Server writes had no backpressure check (High)

`WebSocketHandler.send` wrote to the socket unconditionally. `ws` never blocks: a frame for a
peer whose receive window is closed (a client that stopped reading — tab suspended, hang, or
a scripted participant that simply never reads) is queued in process memory, and every
subsequent broadcast queues another. Room state is whole-state on each change, so a single
non-reading participant in a busy room could grow the server heap without a bound until the
process died — taking every room with it.

**Fix:** `send` checks `ws.bufferedAmount` before writing and, once it exceeds
`WS_MAX_BUFFERED_BYTES` (1 MiB, `packages/shared`), never writes the payload and calls
`ws.terminate()` — the connection is destroyed and no close code is sent (`1013` and `4002`
alike), the same treatment as the oversized-frame error path of SEC-01. A socket sitting
exactly at the cap still receives its frame, so the constant is a ceiling rather than a
reservation. A stuck reader now costs at most that per-socket budget instead of the process,
and the room's other participants are unaffected. The ceiling is a source-level constant, not
a deployment setting, so it moves with a code change. Regression tests:
`apps/server/tests/writeBackpressure.test.ts` (`drops a client whose buffer is past the cap
instead of queueing more`, `still writes to a client sitting exactly at the cap`).

### SEC-16 — Env template shipped the proxy hop count wrong (Medium)

`.env.example` shipped `TRUST_PROXY_HOPS=0` while `docker-compose.yml` already defaulted the
same variable to `1` for the bundled Nginx stack. Copying the template — the documented
deployment path — therefore told the server not to trust `X-Forwarded-For`, even though
Nginx was the only thing it could see. Every client collapsed onto the Nginx address, so the
per-address connection cap and handshake rate (SEC-04), the failed-join budget (SEC-05,
SEC-14) and the browser-identity cookie all keyed on one address: the limits stopped being
per client and became a single global bucket. One client could spend the budget of the whole
deployment, and the NAT-lockout trade-off recorded in SEC-14 stopped being an edge case and
became the default.

**Fix:** the template ships `1`, matching `docker-compose.yml`; `0` remains documented as the
direct-listener setting, together with the consequence of leaving it at `0` behind the
bundled stack. This is the one `Fixed` row without a regression test — the finding lives in a
deployment template, and the compose default it must match is already in the repository.

### SEC-17 — Admin transfer kept the previous host's administrative rights (Low)

`TRANSFER_ADMIN` cleared `isHost` on the previous host but left `isAdmin = true`, and
`isUserAdmin` trusts `participant.isAdmin`. The host could therefore hand the room over and
keep every privileged action — kick, ban, deck change, reveal, end session — beside the new
host.

**Fix:** transfer demotes the previous host to a plain voter, clearing `isHost` _and_
`isAdmin` before the target is promoted, so the target is the only administrator.
Regression test: `apps/server/tests/roomManager.test.ts`, `should allow promoting
co-admins and transferring primary admin` (asserts the old host is neither host nor admin,
`isUserAdmin` is false for it, and a co-admin keeps its rights).

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
