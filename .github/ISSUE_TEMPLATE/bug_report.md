---
name: Bug report
about: Report a reproducible defect — behavior that does not match what the wiki documents
title: "[bug] <area>: <one-line symptom>"
labels: bug
assignees: ''
---

<!--
A bug is behavior that does not match the documented truth. Before filing, check
the wiki page for the feature (source of truth) and its "Last verified" commit:
what looks like a bug may be a documented sharp edge, and what looks intended
may contradict a page that has not caught up with the code.
-->

## Summary

<!-- One or two sentences: what is broken, for whom, and since when (if known). -->

## Criticality

<!-- Keep exactly one. -->

- [ ] **S1** — data loss, crash, security regression, or a core flow blocked with no workaround
- [ ] **S2** — a documented feature is broken; a workaround exists
- [ ] **S3** — a misleading or broken affordance, a wrong message, or a documented behavior not honored; work continues
- [ ] **S4** — cosmetic; no functional impact

## Environment

- **Deployment:** compose / hosted / local dev — URL if reachable
- **Client:** browser + version, OS, viewport width, interface language
- **Room state:** your role, how many participants, deck, backlog size
- **Build:** commit hash or image tag, if known

## Preconditions

<!-- The state the room must be in for the steps below to work. Include roles:
many defects only reproduce as host, co-host or spectator. -->

## Steps to reproduce

<!-- Numbered, from a clean room, no step depending on undocumented state.
If you cannot reproduce it deterministically, say so — a flaky bug is reported
with its flakiness rate, not hidden. -->

1.
2.
3.

## Actual result and consequences

<!-- What happens, what the room is left with, and who is affected.
Consequences matter more than the symptom: a wrong error message on an
admin action misleads the person running the session. -->

## Expected result

<!-- What should happen, and the document that says so: the wiki page that owns
the behavior (the source of truth) and/or the requirement number in
requirements.md. If nothing documents the expected behavior, say so —
that is a second defect in the documentation. -->

## Evidence

<!-- Evidence is typed by where the defect lives. A report without evidence is
a hypothesis, and hypotheses do not get scheduled. -->

**Front-end defect — an annotated screenshot is mandatory:**

- [ ] Screenshot with the problem **highlighted** (arrow, circle or box) and a
      one-line caption naming the element and its location.
- [ ] When the bug is a diff against another state, a second capture of the
      expected state, annotated the same way.
- [ ] At 320 px wide as well, whenever layout is involved.

**Back-end defect:**

- [ ] The exact inbound frame(s) sent (the JSON), and the reply or broadcast
      that came back.
- [ ] The `ErrorCode` or WebSocket close code, and the audit line the server
      logged, when one applies.
- [ ] **If the defect is visible in the interface, also attach a screenshot of
      the front-end consequence, annotated like above** — the fixer needs the
      user impact, not only the wire.

<!-- Where to capture: browser DevTools → Network → WS tab shows every frame in
both directions; apps/e2e/chaos/ws-chaos.mjs is a working example of a scripted
client for back-end-only reproduction. -->

## Fix direction (optional — for whoever picks it up)

<!-- This issue reports the defect; it does not fix it. A suggestion for the
fixer is welcome — code changes belong to the assignee's own branch. -->

## Regression

<!-- The test that should fail before the fix and pass after it, named by suite
and intent (e.g. "admin-management: re-selecting the active story must not
discard in-flight votes"). -->
