---
name: token-usage-best-practices
description: Guidelines to minimise token consumption by keeping prompts concise, pruning context, and retrieving large data through tools instead of inlining it. Use when about to embed large code blocks, logs, or JSON inline.
license: Internal project rule
---

# Token Usage Best Practices

This skill is the single source of truth for token-saving principles in this repository.

## When to Apply

- Before generating a prompt or a long response.
- When about to embed large data blocks (code, logs, JSON) inline.
- When reading files that may contain far more than the task needs.

## Principles

- **Concise prompts** - keep messages short while preserving meaning.
- **Context pruning** - retain only relevant history; summarise older parts.
- **External data via tools** - fetch large content with `read_file`, `grep_search`, `list_dir`, or `run_in_terminal` instead of inlining it.
- **Selective snippets** - include only the needed lines, preferring a single wide range read over many narrow reads.
- **Efficient formatting** - use bullet lists, tables, and code fences; avoid decorative prose.
- **Iterative steps** - break complex work into focused stages, re-using prior results via references.
- **Log management** - disable verbose logging unless explicitly needed; summarise logs.
- **Token budget awareness** - monitor usage returned by tools and set explicit limits for long-running commands.

## Enforcement

1. Apply these principles when constructing prompts and responses.
2. Reference this skill before embedding any large data block.
3. Update `README.md` when new practices affecting token usage are introduced.
