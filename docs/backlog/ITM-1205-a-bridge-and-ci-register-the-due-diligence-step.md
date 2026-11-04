---
id: ITM-1205
title: A Bridge and CI register the due-diligence step of the architecture jobs
level: module
realises:
  - UC-022
  - UC-023
  - A REUSE DECISION RECORDS ITS DUE DILIGENCE
  - DUE DILIGENCE IS FETCHED, NOT RECALLED
modules:
  - MOD-desktop-shell
  - MOD-workflow-entries
builds_on:
tests:
  - unit
origin:
  - akmaier's request of 2026-10-25 "make sure that done items are flagged as done", where ITM-446 was read as not done
built_by:
  - a0732a6b4d9765f196bcfcfd2dc64e868542b258
  - dbf9956a0fc2632cd4a504f8ab099b1c9b1974f6
  - 6da35df1bc4b5e29453b9f11f8e25dc5dcca9e86
---
# ITM-1205 A Bridge and CI register the due-diligence step of the architecture jobs

**REGISTER**

## Outcome

The kinds `derive-architecture` and `change-architecture` name the step `due-diligence`
(`src/job-catalogue/kinds/derive-architecture/kind.md:24`, `src/job-catalogue/kinds/change-architecture/kind.md:30`),
which MOD-reuse-facts offers as `reuseStrategies` (`src/reuse-facts/index.mjs:678`). The tab registers it (MOD-review-pages,
MOD-prompt-bar), but neither the Bridge's composition nor the CI entry does:
- `src/desktop-shell/compose.mjs:16-18` (`STRATEGIES`) lists no `reuseStrategies`, though MOD-desktop-shell.md:219 names
  `MOD-reuse-facts.reuseStrategies` among the strategies registered with the runner;
- `src/workflow-entries/compose.mjs:153-155` (`OFFERED`) lists none either, though MOD-workflow-entries.md:323 names it.

So a derive- or change-architecture job on a Bridge or in CI fails in prepare: `src/job-runner/prepare.mjs:102` asks for
every strategy its kind names, and the step `due-diligence` is not registered. Both lists take MOD-reuse-facts'
`reuseStrategies`, as their module texts already say.

## Acceptance

- On a Bridge and in CI, the job runner's registry holds the step `due-diligence` after composition, and a
  derive-architecture job's prepare does not fail for a missing strategy; a unit test for each entry, with a counter-proof.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/desktop-shell/`, `src/workflow-entries/` and the tests that name MOD-desktop-shell or MOD-workflow-entries change.
