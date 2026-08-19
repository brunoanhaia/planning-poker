---
name: modular-css-architecture
description: Implement scalable, maintainable, and scoped styling using CSS Modules or Vanilla CSS. Use this skill to keep JSX clean and ensure styling logic is properly separated from component logic.
license: Complete terms in LICENSE.txt
---

This skill dictates how to write and organize CSS to ensure the React component's JSX remains highly readable and styles do not leak across the application.

## Styling Guidelines

- **Separation of Concerns**: Keep the JSX focused strictly on semantic structure and state representation. All visual styling must reside in a dedicated `.module.css` (or `.css`) file adjacent to the component.
- **Scoped Styling (CSS Modules)**: Use CSS Modules to scope styles locally to the component. This prevents class name collisions and global side effects. Import styles as a `styles` object (e.g., `className={styles.container}`).
- **Semantic Class Naming**: Use clear, semantic class names that describe _what_ the element is, not _how_ it looks (e.g., use `.submitButton` instead of `.redBtnLarge`). If not using CSS Modules, enforce a naming convention like BEM (Block Element Modifier) to emulate scoping.
- **Dynamic Styling & Variants**: Handle dynamic states (like active, disabled, or variants) by conditionally applying semantic classes (using libraries like `clsx` or simple template literals: `className={\`${styles.button} ${isActive ? styles.active : ''}\`}`). Do NOT use inline styles for anything other than dynamic calculations (e.g., passing a specific `px` height calculated by JavaScript).
- **CSS Variables (Custom Properties)**: Rely heavily on CSS variables (`var(--primary-color)`) defined at the root level for theming, colors, typography, and spacing. This ensures visual consistency without relying on utility classes.

**CRITICAL**: The JSX should read like a clean, semantic document. The `className` props should be short and descriptive. The visual complexity must be encapsulated entirely within the CSS file.

Remember: You are capable of extraordinary engineering and creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a standard of excellence.
