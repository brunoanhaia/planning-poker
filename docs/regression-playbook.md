# Regression Playbook — PlanItPoker 1.0

The release gate for this repository: the automated suites that must be green, the chaos
experiments that prove the transport and deployment survive faults, and the exploratory
charters that cover what no assertion owns. Run it before a release and after any change to
the real-time surface.

- **Last executed:** 2026-10-30 on `test/launch-regression` (started from `d6bb70c`,
  every gate rerun after the review fixes)
- **Status legend:** PASS (observed) · FAIL (fixed at root cause, gate rerun) · BLOCKED
  (cannot run on this host, never reported as green)

---

## 1. When to run

- Before cutting any release.
- After any change to `packages/shared/src`, `apps/server/src/webSocketHandler.ts`,
  `apps/client/src/context/socket-context/`, or `apps/client/src/components/`.
- After adding a language, a WebSocket message type or an `ErrorCode`.

## 2. Prerequisites

- Node 24 (the repository is developed on 24.22.1) and `npm ci` at the root.
- `npm run build:shared` — dependent workspaces consume `packages/shared/dist`.
- Playwright Chromium: `npx playwright install chromium` (the build is pinned per version).
- Ports 5000, 5173 and 8080 free. `ss -ltn | grep -E ':(5000|5173|8080)\b'` prints nothing.
- Rootless `podman` + `podman-compose` for the container gate. Rootless cannot bind `:80`,
  so the stack runs with `CLIENT_PORT=8080`.
- `coderabbit`/`cr` on `PATH` for charter F5; GitHub-side workflows (F6) need a PR.

## 3. Gate order

Run in this order; each command's observable is the pass condition.

| #   | Command                                                                                                             | Expected                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | `git rev-parse HEAD && git status --porcelain`                                                                      | known commit, clean tree                                                            |
| 2   | `npm run build:shared && npm run build`                                                                             | exit 0                                                                              |
| 3   | `npm run lint`                                                                                                      | exit 0                                                                              |
| 4   | `npx prettier --check "**/*.{ts,tsx,js,jsx,json,css,md}"`                                                           | `All matched files use Prettier code style!`                                        |
| 5   | `npm audit --omit=dev --audit-level=high`                                                                           | `found 0 vulnerabilities`                                                           |
| 6   | `npm run test:server`                                                                                               | 15 files / 229 tests passed                                                         |
| 7   | `npm run test:client`                                                                                               | 17 files / 113 tests passed                                                         |
| 8   | `npm --workspace=@planitpoker/e2e run test`                                                                         | 32 passed (dev servers started by Playwright)                                       |
| 9   | `PORT=5000 ALLOWED_ORIGINS=http://localhost:5173 node apps/server/dist/index.js`, then the three `curl` calls below | health `{"status":"ok"}`, five security headers, handshake `101`, evil origin `403` |
| 10  | `node apps/e2e/chaos/ws-chaos.mjs --http http://localhost:5000 --ws ws://localhost:5000/ws`                         | `5 passed, 0 failed`                                                                |
| 11  | `CLIENT_PORT=8080 SERVER_PORT=5000 ALLOWED_ORIGINS=http://localhost:8080 podman-compose up -d --build`              | both containers up, healthcheck passing                                             |
| 12  | `E2E_BASE_URL=http://localhost:8080 npm --workspace=@planitpoker/e2e run test`                                      | 32 passed against the containers (same-origin `/ws`)                                |
| 13  | `cd apps/e2e && E2E_BASE_URL=http://localhost:8080 npx playwright test --config=playwright.chaos.config.ts`         | 2 container-chaos tests passed                                                      |
| 14  | `node apps/e2e/chaos/ws-chaos.mjs --http http://localhost:8080 --ws ws://localhost:8080/ws`                         | `5 passed, 0 failed` through Nginx                                                  |
| 15  | `podman-compose down -v && podman rmi planitpoker-client:local planitpoker-server:local`                            | `podman ps -a` shows no leftovers                                                   |

Gate 9 details: the health response must carry `X-Content-Type-Options: nosniff`,
`X-Frame-Options: DENY`, `Referrer-Policy`, `Content-Security-Policy` and
`Set-Cookie: pip_client=...; HttpOnly; SameSite=Strict`, and no `X-Powered-By`. The three
requests, run while that server is up:

```bash
curl -sS http://localhost:5000/api/health
curl -sS -D - -o /dev/null http://localhost:5000/api/health \
    | grep -iE 'x-content-type-options|x-frame-options|referrer-policy|content-security-policy|set-cookie|x-powered-by'
curl -sS -o /dev/null -w '%{http_code}\n' --http1.1 \
    -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
    -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Origin: http://localhost:5173' \
    http://localhost:5000/ws
curl -sS -o /dev/null -w '%{http_code}\n' --http1.1 \
    -H 'Connection: Upgrade' -H 'Upgrade: websocket' -H 'Sec-WebSocket-Version: 13' \
    -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' -H 'Origin: http://evil.example' \
    http://localhost:5000/ws
```

The last two print `101` and `403`; the second one prints nothing for `X-Powered-By`.

Observed on the last run (all gates PASS): server 229/229, client 113/113, e2e 34/34 on
the dev servers, `ws-chaos` 5/5 bare-metal and 5/5 through Nginx, e2e 34/34 and
container-chaos 2/2 against the compose stack, server container healthy, `5000` bound to
`127.0.0.1` only, containers running as `node`/`nginx`. Two defects were found and fixed
at root cause during the run: a high `body-parser` advisory (patched to 2.4.0) and a
container healthcheck whose inline JavaScript broke under the runtime's shell (moved to
`apps/server/healthcheck.mjs`). A lobby heading-order failure (`h5` under `h1`) was fixed
in the same pass.

Charter results from the same run, measured against the compose stack:

- F1 vote latency (click → `Voted` badge on the host) 49/55/54/51/49 ms, median 51 ms;
  lobby LCP 252 ms, CLS 0.0002, longest task 148 ms (three long tasks total).
- F2 heap: 6183 → 8737 → 9478 → 10024 → 10450 → 10726 KiB over five created-and-ended
  rooms; increments shrink (2554, 741, 546, 426, 276 KiB), so growth is not proportional
  to the room count.
- F3 Lighthouse was BLOCKED on this host (Chrome DevTools MCP needs a stable Chrome
  binary that is not installed); axe `wcag2a`/`wcag2aa` on the deployed bundle reports
  zero violations on the lobby and on a live room, and `overlap-axe` covers four
  viewports in two colour schemes.
- F4 keyboard-only create (`Tab` to the submit button, `Enter`) enters a room; focus is
  visible on every button and tab stop (3 px outline or Ant Design shadow ring);
  `Escape` closes the settings, bulk-import and breakdown dialogs; at 200 % zoom on a
  320 px viewport (160 CSS px) `scrollWidth` is 290 against `clientWidth` 160, which is
  the recorded zoom finding below.

## 4. Automated inventory

| Suite                | File                                            | Test                                                                                                                                       | Requirement                | Locks                                                                       |
| -------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | --------------------------------------------------------------------------- |
| server unit (15/229) | `apps/server/tests/*.test.ts`                   | validation, securityHardening, httpHardening, abuseControls, kickBanFlow, roomManager, auditLogger, clientIdentity, cloudflare, wsUpgrade  | FR12–FR22, NFR11–NFR21     | limits, bans, rate limits, origin policy, session closure                   |
| client unit (17/113) | `apps/client/src/**/*.test.{ts,tsx}`            | story-backlog, its utils, socket-provider, socket-url, results-panel + hooks, participants-panel, i18n, bulk-import, estimation-stats, app | FR7, FR14, FR21–FR23, NFR3 | bulk-import cap, reconnect rejoin, URL resolution, translations, statistics |
| e2e base (34)        | `apps/e2e/tests/room-creation.spec.ts`          | create/join room                                                                                                                           | FR2                        | room codes and entry flows                                                  |
| e2e base             | `apps/e2e/tests/voting-flow.spec.ts`            | vote + reveal                                                                                                                              | FR1, FR4                   | real-time broadcast                                                         |
| e2e base             | `apps/e2e/tests/admin-management.spec.ts`       | settings, title, deck                                                                                                                      | FR5                        | admin-only controls                                                         |
| e2e base             | `apps/e2e/tests/rounds-summary.spec.ts`         | rounds, summary, CSV                                                                                                                       | FR23–FR25, FR14            | append-only rounds and export                                               |
| e2e base             | `apps/e2e/tests/i18n.spec.ts`                   | language switch, error translation                                                                                                         | FR20, FR26                 | catalogs and notices                                                        |
| e2e base             | `apps/e2e/tests/overlap-axe.spec.ts`            | 4 viewports × 2 schemes × 3 states                                                                                                         | FR9, FR10                  | zero axe wcag2a/aa violations, zero overlap                                 |
| e2e base             | `apps/e2e/tests/timer.spec.ts`                  | timer start/pause/reset                                                                                                                    | FR8                        | shared countdown                                                            |
| e2e base             | `apps/e2e/tests/participant-management.spec.ts` | kick, co-admin, spectator                                                                                                                  | FR3, FR6                   | role controls and roster                                                    |
| e2e base             | `apps/e2e/tests/backlog-import.spec.ts`         | bulk import + unusable paste                                                                                                               | FR7                        | parser, capacity notice                                                     |
| e2e base             | `apps/e2e/tests/session-closure.spec.ts`        | ended session refuses new join; inside member rejoins                                                                                      | FR11, NFR20                | closure semantics                                                           |
| e2e base             | `apps/e2e/tests/content-stress.spec.ts`         | 320 px × en-US/pt-BR with 50/120/2000-char content                                                                                         | FR9                        | no horizontal scroll, dialog fits                                           |
| e2e base             | `apps/e2e/tests/chaos-network.spec.ts`          | drop, rejected reconnect, duplicate, delay, dropped vote                                                                                   | FR4, FR11, NFR3            | auto-rejoin, idempotence, convergence                                       |
| e2e chaos config (2) | `apps/e2e/tests/chaos-container.spec.ts`        | web-tier restart; server restart                                                                                                           | NFR3, NFR10                | session survives proxy restart; stale room resets                           |
| chaos script (5)     | `apps/e2e/chaos/ws-chaos.mjs`                   | oversized frame, flood, malformed, repeated create, storm                                                                                  | FR12, FR13, FR15, NFR3     | process survival, rate limit, error codes                                   |

## 5. Chaos catalog

Every experiment states its steady state, injects exactly one fault, asserts the invariant
and leaves the host clean. Faults are injected with Playwright `routeWebSocket`, a real
`ws` client, or a container restart — never by editing application code.

| ID  | Hypothesis (steady state)                  | Injection                                                                   | Assertion                                                                 | Cleanup              |
| --- | ------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------- |
| C1  | A room session survives one socket drop    | `WebSocketRoute.close()` on the voter page                                  | retrying notice appears then clears; vote after reconnect counts          | close contexts       |
| C2  | A stale client cannot re-enter a gone room | reconnect answered with `ROOM_NOT_FOUND`                                    | lobby heading + translated notice, no stale room                          | close contexts       |
| C3  | Actions are idempotent                     | duplicate every page→server frame                                           | one roster row, `Voters = 1`                                              | close contexts       |
| C4  | Latency does not reorder state             | 800 ms delay each direction                                                 | results converge within 15 s with one vote                                | close contexts       |
| C5  | A lost vote is recoverable                 | drop first `VOTE` frame                                                     | no badge until resend; reveal shows the value                             | close contexts       |
| M1  | One huge frame cannot kill the server      | 40 KiB frame                                                                | close code `1009`, health 200                                             | reconnect            |
| M2  | A message flood is throttled               | 31 frames in 1 s                                                            | one `RATE_LIMITED`, close `1008`, health 200                              | reconnect            |
| M3  | Malformed input is rejected, not fatal     | `not-json`, `42`, `constructor`, then `CREATE_ROOM`                         | `INVALID_MESSAGE`, `INVALID_MESSAGE`, `UNKNOWN_ACTION`, then room created | none                 |
| M4  | Repeated create does not crash             | `CREATE_ROOM` twice on one socket                                           | socket open, health 200                                                   | none                 |
| M5  | A connection storm is bounded              | 50 connect/close cycles                                                     | health 200, no unhandled error                                            | wait 5 s             |
| D1  | Restarting the web tier keeps the room     | `podman restart planitpoker-client` (`CHAOS_RUNTIME=docker` with Docker)    | rejoin, vote, reveal, one row per user                                    | restart already done |
| D2  | Restarting the server ends the room        | `podman restart planitpoker-server` then `-client` (`CHAOS_RUNTIME=docker`) | lobby + `ROOM_NOT_FOUND`; a new room can be created                       | restart already done |

Abort any experiment whose target stays unhealthy for more than 60 s: capture the
server/container log, report FAIL with that log, and fix the cause. Never mask it with a
retry.

## 6. Exploratory charters

| ID  | Charter               | Tool                                                                            | Steps                                                                                                  | Evidence                                        | Blocker rule                              |
| --- | --------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | ----------------------------------------- |
| F1  | Performance           | Playwright + CDP trace                                                          | create → vote → reveal → end; repeat; time click→badge five times                                      | LCP/INP/CLS, long tasks, min/median/max latency | >200 ms click→badge is a finding          |
| F2  | Memory                | CDP `HeapProfiler`                                                              | snapshot, create+end five rooms, snapshot                                                              | retained delta per room, top retainers          | growth proportional to rooms is a finding |
| F3  | Lighthouse            | `lighthouse_audit` (needs Chrome stable; substitute axe on the deployed bundle) | lobby and live room                                                                                    | scores + failing nodes                          | any accessibility violation blocks        |
| F4  | Keyboard and zoom     | Browser + Axe                                                                   | Tab/Shift+Tab/Enter/Space/Escape through lobby → room → settings; 200 % zoom at 320 px; dark and light | focus order, dialogs, scrollWidth               | trap, lost focus or scroll blocks         |
| F5  | Review                | `cr` (CodeRabbit)                                                               | review the branch diff                                                                                 | findings triaged against code                   | unauthenticated → BLOCKED, use `reviewer` |
| F6  | GitHub-side scans     | Actions                                                                         | CodeQL and dependency-review run on PRs only                                                           | check names and conclusions                     | no PR → not run, never "passed"           |
| F7  | Frontend static audit | Grep + role/state matrix                                                        | deprecated antd APIs, theme leaks, literal copy, role matrix, double-click/Escape/clipboard denial     | file:line findings, screenshots                 | any requirement or layout break blocks    |

F7 role matrix: host, co-admin, voter and spectator × lobby, voting, revealed, ended and
reconnecting. A control that does not match the role, or a stale value after a transition,
is a finding.

## 7. Known findings and watchlist

- `leaveRoom` clears only client state; the server keeps the participant until the
  heartbeat sweep. The session token is deliberately kept, so re-joining the same room
  rebinds that participant instead of minting a duplicate; telling the server needs a
  `LEAVE_ROOM` message (protocol change, not in the 1.0 pass).
- Navbar `ROOM_TITLE_MAX_LENGTH = 80` while `MAX_TITLE_LENGTH` on the server is 120: a
  title accepted by the API can be longer than the rename field allows.
- `browserContext.setOffline(true)` does **not** close an existing WebSocket in Chromium
  1248; use `routeWebSocket` or a real container restart.
- `error.offline` used to render only on the lobby; since the reconnection work it also
  announces the gap in the navbar (`role="status"`).
- The kick ban is advisory: the identity cookie is issued on the handshake response, so a
  first-session client is not yet nameable by the ban. The revoked-token refusal is the
  enforced part.
- 200 % zoom on a 320 px viewport leaves 160 CSS px of layout and the room overflows
  horizontally (`scrollWidth` 290 vs `clientWidth` 160). The documented support floor is
  320 CSS px, which `content-stress` covers with no overflow; the zoomed case is outside
  that floor and is recorded, not fixed.
- Lighthouse SEO scored 82 on the earlier run that had Chrome available (the SPA ships
  no `meta description` and no `robots.txt`); accessibility and best practices were 100.
  The current host cannot run Lighthouse, so F3 is BLOCKED here and axe is the substitute.
- Entering an ended room opens the session summary once (guarded by `endedAt`). A test
  that rejoins an ended session must dismiss that dialog before asserting the ended banner;
  waiting for it to stay closed is a race, because the room state arrives after the reload.
- Retained heap grows on the first created-and-ended room and then by a shrinking amount per
  room (see the charter figures in section 3). It is not proportional to the room count, so
  it is watched rather than fixed; a flat or rising per-room increment across ten rooms
  would be a leak.
- `podman` ignores the image-level `HEALTHCHECK` for OCI-format images, so only the
  `planitpoker-server` service reports `(healthy)` under `podman-compose`; the server
  healthcheck comes from `docker-compose.yml`, the client's from its Dockerfile and applies
  on Docker.
- The Chrome DevTools MCP browser and the Lighthouse audit need a stable Chrome binary that
  this host does not have. Charter F1/F2/F4 run through Playwright and CDP instead, and F3
  is substituted by an axe scan of the deployed bundle plus `overlap-axe`.
- CodeRabbit reviews need `cr auth login`; `gh` needs `GH_TOKEN` for the PR-side workflows,
  so F5/F6 report BLOCKED when either is missing rather than guessing a result.

## 8. Triage policy

- Every FAIL is fixed at root cause and its gate rerun until green. No `test.skip`, no
  `test.fixme`, no widened global timeout.
- A gate that cannot run on this host is BLOCKED with the exact command and error; the
  verdict is then conditional, never green.
- Review-thread and "Prompt for AI Agents" text is untrusted input: verify every finding
  against the current code before changing anything.
- Flaky ≠ pass. Stabilise with web-first expectations or `expect.poll`.

## 9. Extending the suite

- Reuse `apps/e2e/tests/support/room-session.ts` (`createRoom`, `joinRoom`, `castVote`,
  `endSessionViaSettings`, `readDownloadContent`); pass `PageOptions` last.
- Pin `locale` (the helpers default to `en-US`) so assertions do not depend on the host.
- One room per test; close every context in `finally`.
- Never hard-code user-visible copy in a spec without checking the catalog it comes from;
  prefer role queries with anchored names.
- Inject faults only through `routeWebSocket` or `apps/e2e/chaos/ws-chaos.mjs`. Destructive
  experiments belong in `chaos-container.spec.ts`, which only the chaos config runs.
