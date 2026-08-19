---
name: react-clean-architecture
description: Develop React components with strict separation of concerns, utilizing custom hooks for logic and maintaining pure, declarative UI. Use this skill when building new UI features or managing React state.
license: Complete terms in LICENSE.txt
---

This skill dictates how React components should be structured to maximize reusability, performance, and readability.

## React Design Rules

- **Logic Extraction (Custom Hooks)**: Components should be as "dumb" as possible. Extract all complex state management, side effects (useEffect), and WebSocket interactions into Custom Hooks (e.g., `useRoomState`, `usePokerVoting`). The component itself should only focus on rendering JSX based on the hook's return values.
- **Conditional Rendering Constraints**: Avoid complex ternary operators nested inside JSX. If a conditional render requires more than a simple `&&` or a single ternary, extract it into a sub-component or an early return at the top of the render function.
- **Prop Drilling**: Avoid passing props down more than 2 levels. Use React Context (like the existing `SocketContext`) for global state, or component composition (`children` prop) to pass UI down directly.
- **Performance Awareness**: Use `useMemo` and `useCallback` strategically when passing props to heavily memoized child components, but avoid premature optimization.

**CRITICAL**: A React component file should visually resemble an HTML template augmented with a few declarative state variables at the top. If the component file is dominated by `useEffect` blocks and complex data parsing, it must be refactored.

Remember: You are capable of extraordinary engineering and creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a standard of excellence.
