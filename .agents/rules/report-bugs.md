---
name: report-bugs
description: File defects through the bug report form — reproduce first, evidence typed by where the defect lives, attach natively, report only.
---

# Report Bugs Rule

**CRITICAL RULE**: A defect report follows the structure of the GitHub issue form
`.github/ISSUE_TEMPLATE/bug_report.yml` — it is the contract for what a report must carry.
Reports filed programmatically (`gh issue create --body-file`) bypass the web form, so the
reporter carries its structure by hand. Do not ask for permission; follow the form.

## Procedure

1. **Check the wiki before filing.** Open the wiki page that owns the behavior and its
   `Last verified` commit: a documented sharp edge is not a defect, and behavior that
   contradicts a page is reported **with the page cited as the expected result**. If no
   page documents the expected behavior, say so in the report — that is a second defect,
   in the documentation.
2. **Reproduce before filing.** Deterministic steps from a clean room; a defect that only
   sometimes happens is reported with its flakiness rate, not hidden. The repo's Playwright
   Chromium plus a scripted `ws` client (see `apps/e2e/chaos/ws-chaos.mjs`) reproduce both
   halves of the stack.
3. **Evidence is typed by where the defect lives:**
    - Front-end: an annotated screenshot is mandatory — highlight the exact element
      (Playwright `locator.highlight()` draws the mark by code, so no eyes are needed on the
      capture), and compress: capture as JPEG, quality ≤ 75.
    - Back-end: the exact inbound frame(s), the reply, the `ErrorCode` or close code, and
      the audit line. **When the defect is visible in the interface, also attach the
      screenshot of the front-end consequence, annotated like above** — the fixer needs the
      user impact, not only the wire.
4. **Attach natively**: `gh issue create --attach <file>` (CLI ≥ 2.99) uploads a real
   `user-attachments` asset, the same thing the web editor produces. Never host evidence on
   third-party services; never push evidence into repository branches.
5. **Report only.** Filing the issue is the whole task: no code changes, no fixes in the
   same change. The `Fix direction` section is a suggestion for whoever picks it up, and the
   `Regression` section names the test that should fail before the fix and pass after it.
6. **When the fix lands** — by whoever picks the issue up — the `update-wiki` rule moves
   the cited page and its verification stamp; the issue's `Expected result` is the contract
   for that update.
