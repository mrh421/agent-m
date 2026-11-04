---
id: ITM-1374
title: A bug's item realises the requirement its analysis names as violated
level: module
realises:
  - UC-033
  - UC-012
  - A BACKLOG ITEM NAMES WHAT IT REALISES
modules:
  - MOD-job-catalogue
  - MOD-maintenance-pages
builds_on:
  - ITM-804
tests:
  - unit
origin:
  - finding UC033-F1 of ITM-804's system test TST-804212 (#1653), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1108-development-release-testing-0804.md)
---
# ITM-1374 A bug's item realises the requirement its analysis names as violated

**REGISTER**

## Outcome

UC-033 step 2: a bug's item realises "the requirement that UC-012's analysis named as violated". MOD-issue-handling's
`backlogItemFrom` takes it as `analysis.violated` (MOD-issue-handling.md:70-77), and its recipe `fix-inputs` gives "the
confirmed analysis — the violated requirement, whether code or a test is wrong, the modules" (MOD-issue-handling.md:95-96).
The answer of the kind `analyse-issue` carries no violated requirement, so the page hands `violated: null`
(`src/maintenance-pages/issues.mjs:296`), and the item's `realises` stays empty.

## The reading taken

MOD-job-catalogue gives `analyse-issue` the answer "the class and its reasoning" (MOD-job-catalogue.md:105). The violated
requirement is part of that reasoning, as MOD-issue-handling reads the analysis. So the kind's answer names it, for a bug.

## Acceptance

- The answer of `analyse-issue` names, for a bug, the requirement the participant finds violated; the kind's instruction
  asks for it. The issue page hands it to `backlogItemFrom`, and *Move to backlog* prefills `realises` with it.
- An answer without it still reads, and `realises` then stays empty for the person to fill.
- TST-804212 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
