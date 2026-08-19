---
name: token-usage-best-practices
description: Provides Gemini agents with guidelines to minimise token consumption.
---

# Token Usage Best Practices Skill

This skill offers a concise reference for Gemini agents to follow token‑saving principles during interactions.

## When to Apply
- Before generating prompts or responses.
- When embedding large data blocks (code, logs, JSON) in messages.
- When selecting a model for a task.

## Guideline Summary
- **Concise prompts** – keep messages short.
- **Context pruning** – retain only relevant history; summarise older parts.
- **External data via tools** – fetch large content with `view_file`, `grep_search`, `run_command` instead of inlining.
- **Selective snippets** – include only the needed lines of code (5‑10 lines).
- **Efficient formatting** – use bullet points, tables, code fences.
- **Model choice** – use the smallest capable model.
- **Iterative steps** – break complex tasks into focused steps.
- **Log management** – disable verbose logs unless required; summarise logs.
- **Token budget awareness** – monitor usage; set limits for long‑running commands.

## Enforcement (pseudo‑code)
```yaml
apply:
  when: "prompt_generated"
  actions:
    - enforce_max_prompt_tokens: 200
    - prune_history: keep_last: 5
    - summarize_older: token_threshold: 1000
    - replace_large_inline: with_tool: view_file
    - enforce_model: allowed: [gpt-mini, gpt-small]
```

---
*Skill file location: `.agents/skills/token-usage-best-practices/SKILL.md`.*
