---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - eb827f3bd5f72234b869ba9674bfa9cf14fca190
  - https://github.com/akmaier/agent-m/pull/1653
date: 2026-11-01 11:08 UTC
---
# Development → Release testing: ITM-804, #1653, the system and release tests of UC-033

**REGISTER**

## Reason

ITM-804 was written by two participants, as its selection gives it (141.md, the `## Selection` that adds ITM-804):
- developer-sonnet-j wrote `cf4ed6586`: the harness, the system cases TST-804201 to 804212, and the release cases
  TST-804301 to 804310. None of them exercises `backlogFindings`, which sonnet-j built (ITM-817). TST-804304 tests the
  modules the page prefills from the analysis, which the items of the issue route built, not ITM-817. By the developer's
  reading, the trailers of ITM-582, 583, 584, 617, 1250 and 1256 name no sonnet-j.
- developer-sonnet-l wrote `eb827f3bd`: the release cases TST-804311 to 804313 of `A BACKLOG ITEM NAMES THE MODULES IT
  CHANGES`, which exercise `backlogFindings`, and TST-804301's map. sonnet-l built none of `checks.mjs`, `saves.mjs` or
  `issues.mjs` (known positive: the same search finds sonnet-j).

I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (141.md, *Readings taken*).
2. **CI is green on both heads:** run 41299646664 (`cf4ed6586`) and run 41300094487 (`eb827f3bd`), each at the first
   attempt. `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:** `tests/uc-033-harness.mjs`, `tests/system-uc-033-move-an-issue-into-the-backlog.test.mjs`,
   `tests/release-uc-033-move-an-issue-into-the-backlog.test.mjs`.
4. **MOD-test-document's reader** reads 12 system and 13 release cases, each `module: system`, with no finding.
5. **The Acceptance holds:** TST-804301 maps every requirement UC-033 realises; the system file walks the main flow and the
   alternative flows; the pull request records a planted fault for every case that is not a `todo`.

## Findings, ruled

- **UC033-F1 (TST-804212) → ITM-1374 (MOD-job-catalogue, MOD-maintenance-pages), ready.** MOD-issue-handling reads the
  analysis as naming the violated requirement (`backlogItemFrom`'s `analysis.violated`; `fix-inputs`), and `analyse-issue`'s
  answer is "the class and its reasoning". The violated requirement is read as part of that reasoning.
- **UC033-F5 (TST-804211) → ITM-1375 (MOD-workflow-entries, MOD-maintenance-pages), ready.** `closeWithLinks` runs "when the
  pull request of a bug fix or of an item from the issue is merged", and `onPullRequestClosed` closes "the issues it names";
  both look at `fix-bug` jobs only.
- **UC033-F2 and F3 (TST-804206, 804207) → ITM-1376, for akmaier.** No accepted module text gives the issue route a way to
  remove an item or rewrite its `realises`, and MOD-work-plans marks only a `done` item whose requirement will not be
  accepted. The item names the general change: the mark of UC-032 1a, with *Point at* and *Remove*, for every item that
  names a requirement neither the SPEC nor an open queue holds.
- **UC033-F4 (TST-804210) → ITM-1377, for akmaier.** The issue route needs the declared model's kind, and
  MOD-maintenance-pages' Uses name nothing that reads the declaration. The general change: its Uses name
  `MOD-product-process.productWorkflow`.
- **sonnet-l's note, an item naming only MOD-ghost: not a finding.** `A BACKLOG ITEM NAMES THE MODULES IT CHANGES` asks that
  such an item be reported, and it is, with the rule and the correction. That the message does not name MOD-ghost is not
  required.

## Readings taken

- Step 5's states come from `itemStates` and `startable`.
- The controls of 2a and 2b are "Remove…" and "Update…".
- 1b: no *Move to backlog* for a model that plans its work.
- The note of step 6, as the pull request words it.
- *Add* is one commit on the default branch, with no branch of its own.

All are taken.
