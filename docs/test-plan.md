# Test Plan — Ideal Behaviour

This document defines the target test strategy for PlanItPoker. It describes the behaviour the
product **should** have, not the behaviour observed today. A test is written against the
contract; when the implementation disagrees, the implementation is the defect.

The existing release gate lives in [`docs/regression-playbook.md`](./regression-playbook.md).
This plan extends it with the missing connectivity, deployment-contract, responsive, visual and
accessibility suites.

---

## 1. Principles

1. **The contract is the source of truth.** A current limitation is never encoded as the
   expected result of a new test.
2. **No arbitrary sleeps.** Tests wait for observable states, not for elapsed time.
3. **One room per test.** Every test starts from a clean room and closes every context.
4. **Local and remote are different targets.** A remote deployment test must survive realistic
   latency, a cold backend and TLS; it is not a copy of the local e2e suite with a different
   URL.
5. **Flaky is not a pass.** A failing or unstable test is either fixed at the root cause or
   explicitly marked as not run with the environment reason.
6. **The test suite is part of the product.** Test helpers, selectors and diagnostics are
   maintained with the same care as application code.

---

## 2. Ideal behaviour contracts

These are the contracts the new suites must assert.

### C1 — Connection lifecycle

- The client exposes one explicit state: `connecting`, `connected`, `reconnecting`,
  `offline` or `waking`.
- The state is visible in the UI and announced through an `aria-live` region.
- A create/join action is **never silently dropped**. If it is triggered before the socket is
  open, it is queued once and executed when the connection opens.
- Double-clicking the action cannot create two rooms or two participants.
- A reconnect restores the participant by token without duplicating the roster row.

### C2 — Cold start

- A sleeping backend is shown as `waking`, not as a frozen form.
- After a bounded wait the UI offers a retry action; it never spins forever.
- The first create/join after wake succeeds once and only once.
- A failed wake shows the underlying reason in the active language.

### C3 — Deployment contract

- `GET /api/health` on every published origin returns `200` **JSON**, not the SPA HTML.
- The WebSocket endpoint upgrades with the canonical origin and rejects an unknown origin with
  `403`.
- Security headers are present on the backend and on the public domain.
- The public client uses one documented backend URL; a deployment check fails when it points
  at a different environment by accident.
- The example URL in documentation serves this application, not a different product.

### C4 — Room setup and entry

- The setup screen names the host role explicitly. The host knows whether they are observing
  or voting.
- “Start Estimating” is enabled when the contract is satisfied (at least one staged story and
  the room state is synchronised); any transient disabled state has visible feedback.
- Joining with a lowercase room code works and keeps the returning participant’s identity.
- The waiting state for a participant who joins before the setup is complete is explicit.
- Before offering to re-enter a stored room, the client confirms it still exists
  (`CHECK_ROOM`/`ROOM_STATUS`). A room the server lost is forgotten without a switch dialog,
  while a live room still asks before switching.

### C5 — Responsive layout

- Support floor: **320 CSS px**; support ceiling: **4K**.
- No horizontal scrolling, clipping or overlapping text/controls at 320, 375, 768, 1024, 1280,
  1920 and 2560 px.
- Secondary header actions collapse before primary information is pushed or covered.
- Primary action labels stay on one line. A label wider than the button is ellipsized, never
  wrapped or pushed outside it; the full text stays in the accessible name and the native
  title.
- Tooltips never obscure the room code, title or primary action on touch-sized layouts.
- Touch targets are at least 24×24 CSS px, ideally 44×44 for primary actions.

### C6 — Accessibility

- WCAG 2.2 AA, axe `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`, `wcag22aa`.
- Full keyboard journey: lobby → setup → voting → reveal → summary.
- Focus is not lost when a row disappears, a dialog closes or a session ends.
- Live regions announce connection changes, offline participants, timer expiry and errors.
- Every icon-only control has an accessible name containing the visible purpose.

### C7 — Voting and results

- A revealed round is an immutable snapshot; later roster cleanup cannot change its statistics
  or the results panel.
- Offline voters do not block completion and are excluded from the progress denominator.
- Their cast cards remain in the revealed round.
- Ending a session freezes every content-mutating action, including actions already open in a
  dialog.
- Resetting votes rewinds the timer; ending the session stops it.

---

## 3. Suites to add

| Suite                      | Location                                                                      | Level            | Target |
| -------------------------- | ----------------------------------------------------------------------------- | ---------------- | ------ |
| Connection lifecycle       | `apps/e2e/tests/connectivity.spec.ts`                                         | e2e              | C1     |
| Cold start and wake        | `apps/e2e/tests/cold-start.spec.ts`                                           | e2e              | C2     |
| Deployment contract        | `apps/e2e/tests/deployment-contract.spec.ts` + `scripts/deployment-smoke.mjs` | contract         | C3     |
| Responsive matrix          | `apps/e2e/tests/responsive.spec.ts`                                           | visual/e2e       | C5     |
| Accessibility journeys     | `apps/e2e/tests/a11y-journeys.spec.ts`                                        | e2e + axe        | C6     |
| Mobile header and touch    | `apps/e2e/tests/mobile-header.spec.ts`                                        | visual/e2e       | C5     |
| Setup and role discovery   | `apps/e2e/tests/setup-flow.spec.ts`                                           | e2e              | C4     |
| Stored room preflight      | `apps/e2e/tests/stale-session.spec.ts`                                        | e2e              | C4     |
| Results snapshot integrity | server test + `results-panel.hooks.test.ts`                                   | integration/unit | C7     |
| Dialog freeze matrix       | client component tests                                                        | component        | C7     |
| Remote staging smoke       | `apps/e2e/tests/remote-smoke.spec.ts`                                         | e2e, env-gated   | C1–C4  |

New shared helpers:

- `apps/e2e/tests/support/connection.ts` — `waitForConnection`, `createRoomReady`,
  `joinRoomReady`, `waitForRoom`, `expectNoDuplicateAction`.
- `apps/e2e/tests/support/layout.ts` — `expectNoHorizontalOverflow`, `expectNoOverlap`,
  `expectTouchTarget`.
- `apps/e2e/tests/support/visual.ts` — screenshot names and per-viewport snapshots.
- `apps/e2e/tests/support/remote.ts` — skip/require remote environment, health preflight,
  warm-up and bounded retry.

---

## 4. Scenario catalogue

### 4.1 Connectivity and cold start

1. Open the lobby with the WebSocket delayed by 0, 1, 5 and 15 seconds.
2. Click “Start Session” while the state is `connecting`.
    - The action must be queued or the button disabled with an explanation.
    - After the socket opens, exactly one room is created.
3. Double-click “Start Session” and “Join Room”.
    - Exactly one room/participant is created.
4. Drop the socket before create/join; assert the UI enters `reconnecting`/`offline`, then
   `connected`, and the queued action still runs.
5. Simulate a sleeping backend: no upgrade for 10 seconds, then open.
    - Assert `waking` feedback, no infinite spinner, and a retry path.
6. Reject the queued action with a server error; assert a translated notice and a clean retry.
7. Reconnect after a page reload; assert one participant and the same identity.

### 4.2 Deployment contract

1. `GET /api/health` on the canonical origin returns JSON `{"status":"ok"}`.
2. Security headers and the identity cookie are present on the canonical origin.
3. WebSocket upgrade with the canonical origin returns `101`.
4. WebSocket upgrade with an unknown origin returns `403`.
5. The public client’s configured backend URL matches the documented environment.
6. The documentation example URL serves the expected application title/build.

### 4.3 Responsive and visual

For each viewport `320`, `375`, `768`, `1024`, `1280`, `1920`, `2560` and each colour scheme:

1. Lobby.
2. Setup with no story.
3. Setup with multiple stories.
4. Room before voting.
5. Room with one vote.
6. Revealed results.
7. Ended session with summary.
8. Mobile header with secondary actions open.

Assertions:

- `scrollWidth === clientWidth` (no horizontal overflow).
- No overlapping interactive or text nodes.
- Header does not cover the room code or primary action.
- Screenshot snapshot differs only within the reviewed threshold.

### 4.4 Accessibility

1. Lobby → create → setup → start → vote → reveal → summary using only Tab/Shift+Tab,
   Enter and Space.
2. Escape closes every dialog and returns focus to its trigger.
3. Focus is preserved when a participant leaves or is cleared.
4. Axe scan on each state, both colour schemes.
5. Connection status, left-session count and errors are announced in a live region.
6. Every icon-only control has an accessible name containing its purpose.
7. 200% zoom at 320 px is documented as outside the floor or fixed; the gate must state which.

### 4.5 Setup and role discovery

1. The host starts as a spectator and the UI says so.
2. The host can become a voter in one obvious action.
3. “Start Estimating” is disabled only when the contract is not met, with visible reasoning.
4. A voter who joins before Start sees an explicit waiting state.
5. A lowercase code joins the canonical room and reuses the stored token.
6. The room code copy action keeps the visible text in its accessible name.
7. Reopen the browser with a stored room the server no longer has.
    - The lobby checks it before enabling Create/Join; the stale record and its tokens are
      dropped without a switch dialog, and the requested action proceeds.
8. Reopen with a stored room that still exists.
    - The switch confirmation is shown, and the rejoin works.
9. Delay the socket during the preflight.
    - Create/Join stay disabled with visible progress; after the socket opens and the check
      resolves, a stale room is cleared and the action can proceed.

### 4.6 Voting integrity

1. Offline voter is excluded from completion and the denominator.
2. Offline voter’s card remains in the revealed round.
3. Clearing a voter before or after reveal does not change the recorded round.
4. Results panel reads the recorded revealed round, not the live roster.
5. Reset votes rewinds the timer; end session stops it.
6. Every content mutation is refused after end, including dialogs already open.

---

## 5. Phases

### Phase 0 — Contract and documentation

- Add this plan to the docs index.
- Add the ideal contracts to `requirements.md` where they are missing.
- Mark the current gaps as defects, not expectations.

### Phase 1 — Test foundation

- Add the shared connection/layout/visual/remote helpers.
- Add a connection-state test id or accessible status contract, whichever the implementation
  exposes.
- Centralise `expectNoHorizontalOverflow` and `expectNoOverlap`.

### Phase 2 — P0 connection and cold start

- Implement the product readiness/queue contract.
- Add `connectivity.spec.ts` and `cold-start.spec.ts`.
- Add remote preflight and bounded warm-up to the staging smoke.

### Phase 3 — Responsive and accessibility

- Add the responsive matrix and visual snapshots.
- Add the keyboard journey and per-state axe scans.
- Add mobile header/target-size checks.

### Phase 4 — Deployment contract

- Add `deployment-smoke.mjs` and the remote smoke spec.
- Assert health JSON, headers, WebSocket origin and documented backend URL.
- Add a scheduled staging run.

### Phase 5 — Performance and chaos

- Add click→vote latency and LCP/INP/CLS budgets.
- Add cold-start and reconnect latency measurements.
- Include the existing chaos catalogue in the staging run.

---

## 6. CI and execution

| Target            | Trigger        | Suites                                                                     |
| ----------------- | -------------- | -------------------------------------------------------------------------- |
| Pull request      | every push     | lint, build, unit, component, local e2e, axe, responsive snapshots         |
| Merge to `main`   | every merge    | full regression playbook on containers                                     |
| Staging (nightly) | schedule       | remote smoke, connectivity/cold start, deployment contract, responsive/axe |
| Release           | tag/release PR | full regression + staging smoke + performance and chaos                    |

Rules:

- Remote tests require an explicit `E2E_BASE_URL`; without it they are skipped with a reason,
  never reported as passed.
- A failing deployment contract blocks the release.
- Visual snapshots are reviewed on intentional design changes, never blindly updated.
- Test workers are capped per host so resource contention cannot be reported as a product
  failure.

---

## 7. Definition of done

- All suites above exist and are green against the ideal contracts.
- The remote smoke passes against the published test server from a cold start.
- `GET /api/health` on the published origin returns JSON.
- 320 px–4K layouts have no overflow or overlap; axe is clean in both schemes.
- Keyboard-only flow reaches the summary.
- A create/join action during `connecting` is queued or blocked with feedback and never lost.
- The regression playbook links this plan, and the README documents the new remote gate.

## 8. Implementation status

- [x] C5: the primary lobby action uses the same short label in every locale ("Enter Room" /
      "Entrar na Sala" / "Entrar en la Sala"), stays on one line, ellipsizes any longer label
      and keeps a 44 px touch target; covered in `content-stress` at 320 px and in
      `overlap-axe` across 320, 375, 768, 1024, 1280, 1920, 2560 and 3840 px in both schemes.
- [x] C1/C2: connection lifecycle, action queue and cold-start feedback, covered by
      `connectivity.spec.ts` (queued create exactly once, waking/retry, offline recovery) and
      the provider unit tests.
- [x] Phase 1: `support/connection.ts` provides the delayed-open helper used to simulate a
      cold backend without delaying the real server connection.
- [x] C4 (stored-room preflight): `CHECK_ROOM`/`ROOM_STATUS` plus `stale-session.spec.ts` and
      provider unit tests; the `ROOM_NOT_FOUND` join fallback remains for a room that vanishes
      between the check and the join.
- [ ] C3: public-origin health contract and deployment smoke.
- [ ] C4/C6: setup discovery, keyboard journeys and per-state axe.
- [ ] C7: remaining dialog and snapshot regression matrix.

The unchecked contracts are targets, not accepted current behaviour.
