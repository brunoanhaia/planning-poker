---
name: update-gemini-config
description: Enforce that the GEMINI.md file is updated whenever a new skill or rule is created or modified.
trigger: model_decision
---

**CRITICAL RULE**: Whenever you create a new custom skill, define a new rule, modify an existing skill/rule, or make a significant change to the repository's workflow, you MUST automatically update the `GEMINI.md` file in the root of the project to reflect these changes.

Ensure that the `GEMINI.md` file accurately documents all available skills and rules, their purpose, and any new architectural guidelines introduced to the repository. Do not ask for permission; include the `GEMINI.md` update as part of your execution steps.
