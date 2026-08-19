# Token Usage Best Practices Rule

This rule defines guidelines for Gemini agents to minimise unnecessary token consumption during interactions.

## Principles

- **Concise Prompts** – keep system and user messages short while preserving meaning.
- **Context Pruning** – keep only the most relevant recent history; summarise older exchanges.
- **External Data via Tools** – retrieve large files or logs with `view_file`, `grep_search`, `run_command`, etc., instead of inlining them.
- **Selective Code Snippets** – embed only the minimal required lines (≈5‑10) rather than whole files.
- **Formatting Efficiency** – use bullet lists, tables, and fenced code blocks; avoid decorative prose.
- **Model Choice** – prefer the smallest capable model for the task; reserve larger models for complex reasoning.
- **Iterative Steps** – break complex work into focused stages, re‑using prior results via references.
- **Log Management** – disable verbose logging unless explicitly needed; summarise logs.
- **Token Budget Awareness** – monitor usage returned by tools and set explicit limits for long‑running commands.

## Enforcement

Agents should:

1. Apply these principles when constructing prompts and responses.
2. Reference this rule before embedding any large data block.
3. Update project documentation (e.g., `README.md`) when new practices affecting token usage are introduced.

---

_Rule file location: `.agents/rules/token-usage-best-practices.md`_
