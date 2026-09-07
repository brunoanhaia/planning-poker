# Requirements

## Functional Requirements

1. **Real-time communication**: Clients and server must exchange state updates via native WebSocket (`ws`) ensuring low-latency synchronization of rooms, participants, and vote results.
2. **Room lifecycle**: Users can create a new room, join an existing room via a unique URL, and leave a room. The server tracks active rooms and participants.
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

## Non‑Functional Requirements

1. **Performance**: UI interactions and WebSocket message latency should be perceptible under 200 ms for a smooth planning experience.
2. **Scalability**: The server must handle multiple concurrent rooms and hundreds of participants using the lightweight `ws` library.
3. **Reliability**: Heartbeat/ping‑pong mechanism ensures detection of dead connections and automatic cleanup of stale participants.
4. **Security**: Input validation on all inbound messages, sandboxed server logic, and protection against injection attacks.
5. **Code Quality**: Strict TypeScript typing via `@planitpoker/shared`, ESLint/Prettier compliance, and clean‑code conventions (no magic values, early returns, explicit blocks).
6. **Testing**: Comprehensive unit, integration, and end‑to‑end tests using Vitest, Playwright, and Axe‑core covering functional flows and accessibility.
7. **Maintainability**: Modular architecture with separate client, server, and shared packages; custom skills (`realtime‑websocket‑manager`, `react‑clean‑architecture`, etc.) enforce separation of concerns.
8. **Documentation**: Up‑to‑date README, AGENTS.md, and requirements file reflecting the native WebSocket stack.

_This file should be updated whenever new functional or non‑functional requirements are added._
