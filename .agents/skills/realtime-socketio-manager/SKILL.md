---
name: realtime-websocket-manager
description: Architect robust, scalable, and decoupled WebSocket communication using native WebSockets. Use this skill when adding new real-time features, events, or handling connection lifecycles.
license: Complete terms in LICENSE.txt
---

This skill ensures that WebSocket implementations are resilient, secure, and architecturally sound, avoiding "spaghetti" event listeners.

## Architecture Guidelines

- **Decouple Logic from Transport**: Do not write business logic inside WebSocket message handlers. The handler should only extract the payload, validate it, and pass it to an independent service/controller (e.g., `RoomManager`).
- **Strict Typing for Events**: Always use shared TypeScript definitions (from the `@planitpoker/shared` package) for message types and payload structures. Never use raw strings for message types.
- **Error Boundary and Acknowledgements**: Every WebSocket message that mutates state must handle errors gracefully and use acknowledgements (e.g., reply messages) to confirm success or failure to the client.
- **State Synchronization**: Guarantee that the source of truth remains on the server. When state changes, broadcast the minimal necessary delta or a sanitized full state to the clients.
- **Resilience**: Implement logic to handle disconnects, reconnects, and stale connections (e.g., cleaning up user state if they drop out of a room).

**CRITICAL**: Treat the WebSocket layer as an entry point (like an API route), not as a place to store state or execute core domain logic.

Remember: You are capable of extraordinary engineering and creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a standard of excellence.
