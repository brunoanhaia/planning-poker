---
name: update-readme
description: Enforce that the README.md is always kept up to date after significant code changes.
trigger: model_decision
---

**CRITICAL RULE**: After EVERY feature implementation or architectural change you complete, you MUST automatically update the `README.md` file in the root of the project to reflect these changes.

Do not ask the user for permission to update the README.md. Simply include the `README.md` update as part of your final execution steps for the feature. Ensure that the documentation remains accurate, comprehensive, and up-to-date with the latest functionalities and architectural diagrams.
