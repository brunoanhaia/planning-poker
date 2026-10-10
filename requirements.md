# Requirements

## Functional Requirements

1. **Real-time communication**: Clients and server must exchange state updates via native WebSocket (`ws`) ensuring low-latency synchronization of rooms, participants, and vote results.
2. **Room lifecycle**: Users can create a new room, join an existing room via a unique URL, and leave a room. The server tracks active rooms and participants, and reclaims rooms that go idle (see item 18) so the set of live rooms stays bounded.
3. **User roles**: Four roles are supported – Administrator, Co‑host, Voter, Spectator – each with defined permissions for room settings, participant management, and voting.
4. **Voting flow**:
    - Voters can select a card to submit an estimate.
    - Administrator/Co‑host can reveal all votes, reset the voting session, and finalize the estimate.
    - Automatic progression to the next story after finalization.
5. **Room settings**: Admin/Co‑host can rename the room, lock/unlock the room, and change the estimation deck type (e.g., Fibonacci, T‑Shirt sizes).
6. **Participant management**: Admin/Co‑host can kick users, promote users to Co‑host, and transfer the Administrator role.
7. **Backlog management**: Add, edit, delete, and bulk‑import stories; manually adjust story estimates.
8. **Timer**: Synchronized countdown timer that can be started, stopped, and reset by Admin/Co‑host.
9. **Responsive UI**: The client UI must adapt fluidly from 320 px mobile screens up to desktop/4K displays without horizontal scrolling or component overlap.
10. **Accessibility**: All interactive elements must be WAI‑ARIA compliant, keyboard navigable, and meet WCAG AA contrast requirements.
11. **Session identity**: Reconnection must be proven by an opaque, server‑issued session token. A client‑supplied `userId` alone must never grant access to an existing participant (prevents impersonation and admin takeover).
12. **Input validation**: Every inbound WebSocket payload must be validated against a schema before reaching domain logic; invalid payloads are rejected with an `ERROR` and never broadcast.
13. **Input limits**: Participant names (≤50), room titles (≤120), story titles (≤120), story descriptions (≤2000), bulk imports (≤50 stories), custom decks (2–30 unique cards), and timer durations (5–3600 s) are enforced server‑side.
14. **Safe export**: CSV exports must neutralize spreadsheet formula injection (`=`, `+`, `-`, `@`, tab, CR) and derive the download filename from a sanitized slug with a fixed `.csv` extension.
15. **Socket abuse control**: Every WebSocket frame — valid, malformed or of unknown type — is charged against a per-socket allowance of 30 messages per 10 s. The message that exceeds it is answered once with `RATE_LIMITED` and the socket is closed with code 1008 (policy violation).
16. **HTTP rate limiting**: The API enforces 300 requests per client per 15 minutes. The limiter runs ahead of the body parser, so an oversized or malformed payload cannot be rejected without spending the allowance.
17. **Resource ceilings**: Room creation is refused once 1000 rooms are held, joins beyond 100 participants per room are refused, and a backlog stops at 200 stories; a bulk import halts at the quota instead of overrunning it. Each refusal is reported with its own error code.
18. **Idle-room reclamation**: A room untouched for 24 h is dropped together with its session tokens, but only once every participant has disconnected — a room with somebody still connected is never reclaimed, however long it sits idle.
19. **Kick cooldown**: A removed participant may not rejoin the same room for 5 minutes. The bar is advisory by design: it holds the revoked session token and, where the deployment serves the page and the socket from the same origin, a server-issued browser identity. A client that discards all of them is admitted as a new participant, which an open room cannot distinguish from a genuine newcomer.
20. **Distinguishable failures**: Every `ERROR` carries a machine-readable code (`ErrorCode` in `@planitpoker/shared`) so a quota rejection, an authorization refusal, a validation failure and an unknown session are never conflated. In particular, an out-of-range story index is reported as `INVALID_STORY_INDEX` rather than as an administrative permission problem.
21. **Audit trail**: Security-relevant server actions — room creation and its rejection at the limit, idle-room drops, kicks, role changes, host transfers, refused story indices, throttled sockets and refused joins — are written as one structured JSON line each, keyed by room and user. No display name, session token or vote is ever recorded.
22. **Client identity**: The server issues a first-party, `HttpOnly` identity cookie on the first HTTP response and on the WebSocket handshake. The application never reads it; it exists so a kick can name the browser it was issued to rather than only the session it revoked.

## Non‑Functional Requirements

1. **Performance**: UI interactions and WebSocket message latency should be perceptible under 200 ms for a smooth planning experience.
2. **Scalability**: The server must handle multiple concurrent rooms and hundreds of participants using the lightweight `ws` library.
3. **Reliability**: Heartbeat/ping‑pong mechanism ensures detection of dead connections and automatic cleanup of stale participants.
4. **Security**: Input validation on all inbound messages, sandboxed server logic, and protection against injection attacks. Runtime validation is implemented with `zod` schemas in `apps/server/src/validation.ts`, and session tokens are issued/revoked by `apps/server/src/sessionService.ts`.
5. **Code Quality**: Strict TypeScript typing via `@planitpoker/shared`, ESLint/Prettier compliance, and clean‑code conventions (no magic values, early returns, explicit blocks).
6. **Testing**: Comprehensive unit, integration, and end‑to‑end tests using Vitest, Playwright, and Axe‑core covering functional flows and accessibility.
7. **Maintainability**: Modular architecture with separate client, server, and shared packages; custom skills (`realtime‑websocket‑manager`, `react‑clean‑architecture`, etc.) enforce separation of concerns.
8. **UI consistency**: The client must render exclusively with Ant Design 6 components. Theming is centralised in a single `ConfigProvider` configuration (`apps/client/src/theme/app-theme.ts`); components must not ship their own stylesheets, and any component-scoped token override must be documented and must not leak to other components.
9. **Documentation**: Up‑to‑date README, AGENTS.md, and requirements file reflecting the native WebSocket stack.
10. **Deployability**: Shippable as containers — versioned `apps/server/Dockerfile` (Node 24) and `apps/client/Dockerfile` (Nginx + SPA fallback, `/api` + `/ws` reverse proxy) composed via `docker-compose.yml` with healthchecks and env-driven ports/origins.
11. **HTTP hardening**: Every response carries security headers — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Content-Security-Policy` and `Strict-Transport-Security` — supplied by `helmet` on the API and repeated at `server` level by Nginx, whose own `Cache-Control` for `/assets/` would otherwise suppress the inherited set. `X-Powered-By` is disabled and JSON bodies are explicitly capped at 50 kb.
12. **WebSocket frame limit**: Frames larger than 32 kb are refused, which disconnects the offending client with code 1009.
13. **Proxy trust**: The server honours `X-Forwarded-For` only for the number of hops it is told to trust (`TRUST_PROXY_HOPS`), and defaults to none — a listener reached directly must not let a client choose its own address, and with it its own rate-limit bucket. The bundled compose stack sets one hop because its Nginx is guaranteed, and publishes the API port on loopback so nothing but that proxy can reach it.
14. **Memory bounds**: In-memory state is bounded by the ceilings above and reclaimed by the idle sweep, so the resident footprint does not grow without limit as rooms are created and abandoned.
15. **Auditability**: Audit records are line-oriented JSON with room and user identifiers only, so the log can be retained and shipped without holding participant data.

_This file should be updated whenever new functional or non‑functional requirements are added._
