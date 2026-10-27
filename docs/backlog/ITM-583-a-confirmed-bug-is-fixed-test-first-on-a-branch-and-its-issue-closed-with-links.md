---
id: ITM-583
title: A confirmed bug is fixed test first on a branch, and its issue closed with links once merged
level: module
realises:
  - UC-012
modules:
  - MOD-issue-handling
  - MOD-maintenance-pages
  - MOD-workflow-entries
builds_on:
  - ITM-582
  - ITM-567
  - ITM-1245
  - ITM-1248
tests:
  - unit
  - component
  - system
origin:
  - the coverage of UC-001 to UC-020 (docs/measurements/2026-10-16_coverage-uc-001-020.md), at akmaier's request of 2026-10-16
---
# ITM-583 A confirmed bug is fixed test first on a branch, and its issue closed with links once merged

**REGISTER**

## Outcome

UC-012 step 5, 5b and its first postcondition. The kind `fix-bug` exists. Not built: `fix-inputs`, which gives its modules to `implementation-inputs` as the parameter `modules` (ITM-1248), `closeWithLinks`, whose comment `closed-with` names no item for a bug's fix (ITM-1245), and `onPullRequestClosed`; `onDoneCheck` exists (`src/workflow-entries/product.mjs`). The writer `branch-and-pull-request` is ITM-567.

## Acceptance

- A failing regression test comes first.
- The pull request links the issue, and once it is merged the issue is closed with links.
- Without a participant that runs tests, the page says so and links UC-017.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
