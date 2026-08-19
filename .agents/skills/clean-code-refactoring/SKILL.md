---
name: clean-code-refactoring
description: Enforce Clean Code principles, focusing on high readability, early returns, and eliminating deep nesting. Use this skill when refactoring existing code or implementing complex business logic.
license: Complete terms in LICENSE.txt
---

This skill guides the creation and refactoring of code to ensure it meets strict Clean Code standards, focusing on long-term maintainability and readability.

The user provides code to be written or refactored. You must analyze the logic and apply the following principles:

## Code Quality Principles

- **Early Returns (Bouncer Pattern)**: Prioritize early returns to handle edge cases, errors, or invalid states at the top of functions. This eliminates the need for `else` blocks and reduces cognitive load.
- **Flatten Nesting**: NEVER write code with more than 2 levels of indentation within a function. Extract logic into small, descriptively named private helper functions.
- **No Single-Line Ifs**: ALWAYS use explicit curly brace blocks `{ ... }` for all conditionals. Never omit braces or write single-line `if` statements.
- **No Magic Values**: Extract numbers, timeouts, and repeated strings into dedicated, well-named constants.
- **No Deprecated APIs**: Never use deprecated APIs (e.g., use `slice()` or `substring()` instead of `substr()`).
- **Strict Literal Types**: Use specific union literal types instead of generic `string` or `number` when values belong to a finite set.
- **Thorough Backend Documentation**: Add comprehensive TSDoc/JSDoc documentation for all backend classes, methods, and functions.
- **Class Decomposition**: Avoid huge monolithic classes. Break them down into cohesive, single-responsibility services and helpers.
- **Meaningful Naming**: Variables and functions must reveal their intent. Avoid abbreviations or generic names like `data`, `res`, or `val`. Functions should use strong verbs (e.g., `calculateEstimate`, `broadcastRoomState`).
- **Single Responsibility Principle**: A function should do one thing, do it well, and do it only. If a function contains sections divided by comments (e.g., `// validate`, `// process`, `// save`), extract them into separate functions.
- **Immutability by Default**: Prefer `const` over `let`. Use `let` only when variable re-assignment is strictly required. Avoid mutating state directly, especially in data transformations. Use array methods like `map`, `filter`, and `reduce` instead of `for` loops where applicable.

**CRITICAL**: Your primary goal is to make the code read like well-written prose. The next developer should understand the flow immediately without needing inline comments explaining _what_ the code does.

Remember: You are capable of extraordinary engineering and creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a standard of excellence.
