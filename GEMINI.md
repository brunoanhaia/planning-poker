# PlanItPoker - Agent Guidelines

Welcome to the PlanItPoker repository! As an AI agent working in this project, you are expected to act as a Senior Full Stack Engineer. Your primary goal is to maintain the highest standard of code quality, architecture, and maintainability.

## Project Context

- **Type**: Real-time Planning Poker application.
- **Architecture**: Monorepo using npm Workspaces.
    - `apps/client`: React, Vite, Tailwind CSS (or Vanilla CSS based on preference), Socket.io-client.
    - `apps/server`: Node.js, Express, Socket.io.
    - `packages/shared`: TypeScript types, enums, and constants.

## General Guidelines

1. **Clean Code Principles**: Always write highly readable code. Avoid deep nesting, use early returns (bouncer pattern), and ensure variables/functions have meaningful names.
2. **No Single-Line Ifs & Explicit Blocks**: Always use explicit curly brace blocks `{ ... }` for all `if` statements. Never write single-line `if` statements.
3. **No Magic Values**: Never use magic numbers or arbitrary strings directly in logic. Extract them into named constants or config files.
4. **No Deprecated APIs**: Never use deprecated JavaScript/TypeScript or framework APIs (e.g., use `slice()` or `substring()` instead of `substr()`).
5. **Strict Literal Typing**: Avoid generic `string` types when only a specific set of string values is valid; use TypeScript string literal unions or enums.
6. **Backend Documentation**: Document all backend methods, classes, interfaces, and service functions with comprehensive TSDoc/JSDoc comments describing purpose, parameters, and return types.
7. **Class & Module Decomposition**: Avoid huge monolithic classes. Decompose responsibilities into cohesive, single-purpose services or helper modules.
8. **Immutability & Minimal `let`**: Prefer `const` over `let` across all files. Use `let` strictly when re-assignment is unavoidable.
9. **Imports Strategy**: Prefer named imports for better clarity. However, be cautious when importing from barrel files (`index.ts`), as named imports from them can import the entire module and negatively impact tree-shaking. Import directly from the specific file when appropriate.
10. **Type Safety**: Strictly utilize the shared `@planitpoker/shared` package for all Socket events, payloads, and domain models. Avoid using `any` or redefining types locally.
11. **Component Architecture**: Keep React components "dumb". Extract complex logic into custom hooks. Ensure styling is modular and does not pollute the JSX. Enforce single responsibility by having strictly one component per file.
12. **Real-time Communication**: Never put core business logic inside socket event listeners. Keep the transport layer decoupled from the domain logic.
13. **Accessibility**: All UI components must be fully accessible (WAI-ARIA compliant, keyboard navigable).
14. **Responsive Design**: All UI layouts, components, and interactive controls must be strictly responsive across all device viewports (mobile 320px+, tablet, and desktop) without horizontal scrolling, clipping, or component overlaps.

## Custom Skills and Rules

This repository implements the **Antigravity Customization System**.

- Custom **Skills** are located in `.agents/skills/`. You should proactively utilize these skills when performing related tasks:
    - `clean-code-refactoring`: For strict clean code adherence.
    - `realtime-socketio-manager`: For robust WebSocket management.
    - `react-clean-architecture`: For separating React logic into custom hooks.
    - `accessible-ui-components`: For WAI-ARIA compliant frontend components.
    - `modular-css-architecture`: For scoped, vanilla CSS/Modules styling.
    - `isolated-component-design`: For decoupled, pure UI components.
- Custom **Rules** are located in `.agents/rules/`. For instance, you must always respect the `update-readme.md` rule to keep documentation updated, and the `update-gemini-config.md` rule to maintain this `GEMINI.md` file updated whenever new skills are created.

By adhering to this `GEMINI.md` file and the available skills/rules, you will ensure the long-term success and scalability of the PlanItPoker project.
