# Security Model

> **Last verified:** 2026-11-26 against commit `c557e49`.
> The full penetration report — findings, reproductions, and the abuse-test measurements — is
> [`docs/security-review.md`](https://github.com/brunoanhaia/planning-poker/blob/main/docs/security-review.md)
> in the repository. This page is the model; that document is the evidence.

## The assets being protected

An anonymous, credential-free product has three things worth protecting: **the identity of a
seat** (nobody can vote or moderate as you), **the hidden cards** (nobody learns a vote before
the reveal), and **the process itself** (one client cannot exhaust the server). Everything
below exists for one of those three.

## Identity before session

- **The session token is the only proof of identity.** On create/join the server issues an
  opaque token bound to the room and the participant; a reconnect must present it. A
  client-supplied `userId` alone never grants anything — a foreign `userId` with a valid
  token creates a second participant instead of impersonating the target.
- **Tokens are scoped to one room**, revoked on kick, and live at most as long as the room.
  They never expire on their own: a mid-session logout would be a product defect, not a
  security gain (the reasoning is recorded in the review).
- **One browser, one room session, one tab per seat.** Switching rooms requires the token of
  the room being left; a newer tab supersedes an older one, which is told to stand down with
  close code 4001 rather than being left to fight for the socket.

## Hidden cards stay hidden

The server sanitizes every broadcast **per recipient**: before a reveal, each client's state
carries only its own card — everyone else's `vote` is nulled on the way out. There is no
hidden history to leak either: a round is recorded only at the moment of reveal. (Who _has_
voted is public by design — it is the moderation affordance that tells the host who is still
thinking.)

## The room code is the secret

8 characters from a 32-character alphabet — about 1.1×10¹² candidates, with the ambiguous
`0`/`O` and `1`/`I` excluded so a code can be dictated. The length is pinned by a test, so a
future shortening cannot slip through. A failed-join budget charges **distinct** unknown
codes per address (one person's repeated typo is one entry, not a flood) and every lookup that
matched no room is audited.

**A join challenge was built, reviewed and deliberately removed.** The longer room code had
already made brute-force impractical, and the challenge cost ~900 lines and seven defects for
no additional coverage — the recorded decision, not an unexplained gap.

## The transport and the process

- Every inbound frame is validated against a zod schema before domain logic, and dispatch
  only honours message types the handler owns.
- Frames are capped at 32 KiB, each socket gets a message allowance, each address a socket
  ceiling, and a client that stops reading is dropped at a fixed write-buffer cap instead of
  being queued behind.
- A refused frame costs its sender, not the process: every connection carries an error
  listener, so an oversized or unreadable frame terminates that socket alone.
- The HTTP side carries the full header set (CSP, HSTS, `nosniff`, `X-Frame-Options: DENY`),
  a capped JSON body, a rate limit that runs **before** the body parser, and no
  `X-Powered-By`.
- Proxy trust is explicit: `X-Forwarded-For` is honoured for the number of hops configured
  (`TRUST_PROXY_HOPS`, default zero), and `CF-Connecting-IP` only for requests that genuinely
  arrive from a published Cloudflare range — a header a client forges itself is ignored.

The exact calibration of the per-address ceilings is intentionally not on this page; the
review document records it, together with why the values are sized for a shared office NAT
rather than against one.

## What the server writes down

One structured JSON line per security-relevant action — room creation and its rejection, idle
drops, kicks, promotions, host transfers, refused story indices, throttled sockets, refused
joins, socket errors. **Room and user identifiers only**: no display name, no token, no vote
ever reaches the log, so it can be retained and shipped without holding participant data.

## Accepted risks, on the record

- **The kick bar is advisory.** It holds the token, the participant id and the browser
  identity cookie; a client that discards all three is indistinguishable from a newcomer.
  Anything stronger would key on the address and punish everyone behind it.
- **Origin-less clients may create rooms.** Room creation is open by design; the origin gate
  exists to stop cross-site hijacking of _existing_ rooms, which still requires a token.
- **Room creation can be exhausted** up to the room cap; the sweep reclaims idle rooms, and
  the failure mode is "no new rooms", not data loss.
- **Broadcasts are whole-state**, so a very large room multiplies egress; the throttle, the
  connection cap and the story ceilings bound it, and an incremental-state rewrite is the
  recorded future fix.

## Verified during the review and still held

Origin allowlist on the handshake; tokens as the only identity for non-browser clients;
unrevealed votes never reaching another participant; no cross-room broadcast bleed; no
prototype pollution; authorization refused with no state change for all 19 privileged
actions; CORS never reflecting a hostile origin; `X-Forwarded-For` ignored when untrusted.
