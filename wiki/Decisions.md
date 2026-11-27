# Decisions

> **Last verified:** 2026-11-26 against commit `4dd98ef`.
> Short records of the choices that shaped the system — each entry says what was chosen, why,
> and what it costs. The code comments cited below are the primary sources.

## Native `ws`, no socket.io

**Decision:** the transport is the native `ws` library with a thin handler.
**Why:** planning poker needs one duplex channel and rooms in memory — reconnect semantics,
fallbacks and a second protocol would be pure weight.
**Cost:** reconnection is the client's job (it retries every 2 s with the token, and it
works).

## One process, memory as the store

**Decision:** `RoomState` lives in server memory; there is no database.
**Why:** a single writer makes every invariant (hidden votes, append-only rounds, role
transitions) trivially correct, and the product has no persistence requirement.
**Cost:** a restart is a reset, and horizontal scaling is out until the state moves — both
recorded honestly on [[Architecture Overview]] and [[Operations Runbook]].

## Session tokens, never a trusted `userId`

**Decision:** reconnection is proven by an opaque, room-scoped, server-issued token; a
client-supplied `userId` alone grants nothing.
**Why:** identity in an anonymous product must be something the server issued, not something
the client claims.
**Cost:** token bookkeeping (issue, revoke, bar on kick) — `sessionService.ts` and
`banService.ts` own it.

## The room code is the secret; the join challenge was rejected

**Decision:** 8 characters from a 32-character alphabet (~1.1×10¹² candidates, ambiguous
characters excluded), and **no** browser-challenge on join.
**Why:** the code length already makes brute-force impractical, and the challenge — built,
reviewed, then removed — cost ~900 lines and seven defects for coverage the length had
already bought. The reasoning is recorded in `docs/security-review.md` (SEC-05) so the gap
never looks like an oversight.

## Rounds are append-only, capped at ten

**Decision:** a reveal records a round; resetting opens the next one instead of erasing; a
story keeps its 10 most recent rounds.
**Why:** re-voting exists to be compared, and the cap keeps the broadcast bounded.
**Cost:** `MAX_ROUNDS_PER_STORY` is a shared constant — see [[Limits and Ceilings]].

## Roles are two axes, not four

**Decision:** moderation (host / co-host / none) and participation (voter / spectator) are
independent flags; the host starts as a spectator.
**Why:** moderation must not wait for participation, and admins estimating with the team is
normal use, not an edge case. The full model — including the sharp edges this creates — is
[[Roles and Permissions]].

## Host succession on any disconnect

**Decision:** when the host's socket closes, the next online co-host (else the next online
participant) becomes host immediately; reconnection does not restore the crown.
**Why:** a room must never be unadministrable because one connection dropped.
**Cost:** a network blip moves the role — documented, not hidden.

## The kick bar is advisory, on the record

**Decision:** the bar holds the token, the participant id and the browser identity cookie
for 5 minutes, and a client that discards all three is admitted as a newcomer.
**Why:** anything stronger would key on the address and punish everyone behind it. Pretending
otherwise would be security theater — `docs/security-review.md` (SEC-09) records the
acceptance.

## Ant Design only, with WCAG corrections

**Decision:** the client is styled exclusively through Ant Design 6 components and tokens;
the stock palette values that fail AA contrast are overridden once, centrally, in
`theme/app-theme.ts`.
**Why:** one theming seam, and contrast fixes that apply everywhere instead of per page.
**Cost:** the e2e axe gate must stay green on every layout change — [[Testing Strategy]].

## Languages are chunks, not bundle weight

**Decision:** English and Brazilian Portuguese bundle inline; every other catalog is its own
chunk, fetched when picked; plural forms follow CLDR.
**Why:** the initial payload must not grow with the language list, and plurals must not be
hand-rolled per component. The recipe is [[Adding a Language]].

## The shared package is consumed from `dist/`

**Decision:** apps import `@planitpoker/shared` from its compiled output; only type-checking
resolves the source through `paths`.
**Why:** the runtime contract is exactly what was built, not what happens to be on disk.
**Cost:** `npm run build:shared` after any contract change — the number-one onboarding trap,
called out on [[Onboarding]].
