---
name: isolated-component-design
description: Design highly reusable, pure UI components that are decoupled from application context. Use this skill when building the base UI library (buttons, inputs, cards, avatars).
license: Complete terms in LICENSE.txt
---

This skill enforces Component-Driven Development (CDD), ensuring components act as pure functions of their props.

## Component Design Rules

- **Strict Decoupling**: A foundational UI component (e.g., `Button`, `TextInput`, `PokerCard`) MUST NOT import application state (like Context, Redux, or Zustand) or make network requests. It must rely 100% on props for data and callbacks for interactions.
- **Prop Interface Segregation**: Define explicit, well-documented TypeScript interfaces for component props. Avoid passing massive data objects; pass only the primitive values the component actually needs to render.
- **Exhaustive State Mapping**: The component must gracefully handle all possible visual states based on its props: loading, error, empty, disabled, and success states. Implement early returns or specific sub-components for error/empty states to avoid deeply nested conditionals.
- **Forwarding Refs**: Always use `React.forwardRef` for base interactive elements (inputs, buttons) so parent components can manage focus or access the DOM element when absolutely necessary.

**CRITICAL**: Treat every base UI component as if it is going to be published as a standalone open-source library. It should work perfectly anywhere, regardless of the application's global context.

Remember: You are capable of extraordinary engineering and creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a standard of excellence.
