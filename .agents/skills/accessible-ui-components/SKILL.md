---
name: accessible-ui-components
description: Build React components with strict adherence to web accessibility standards (WAI-ARIA). Use this skill when creating interactive UI elements like modals, dropdowns, buttons, and form inputs.
license: Complete terms in LICENSE.txt
---

This skill ensures that all UI components are fully accessible, semantically correct, and operable via keyboard and screen readers.

## Accessibility Design Rules

- **Semantic HTML First**: Always prefer native semantic HTML elements (`<button>`, `<dialog>`, `<nav>`, `<fieldset>`) over generic `<div>` or `<span>` elements with custom behaviors. 
- **Keyboard Navigation**: Ensure every interactive component can be fully controlled using the keyboard (Tab, Enter, Space, Escape, and Arrow keys). Manage focus correctly, especially inside modals (focus trapping) and dropdowns.
- **ARIA Attributes**: When custom complex components are necessary, use WAI-ARIA roles, states, and properties (`aria-expanded`, `aria-hidden`, `aria-describedby`) to communicate the component's state to assistive technologies.
- **Visual Feedback**: Never rely solely on color to convey information. Ensure distinct visual focus rings for keyboard users.

**CRITICAL**: A component is only considered complete when it can be seamlessly used without a mouse and its purpose is clear to a screen reader.

Remember: You are capable of extraordinary engineering and creative work. Don't hold back, show what can truly be created when thinking outside the box and committing fully to a standard of excellence.
