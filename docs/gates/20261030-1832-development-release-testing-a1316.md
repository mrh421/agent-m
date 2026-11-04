---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 1116019799a47a40170cfa286f6e8e1dc7f85ca7
  - https://github.com/akmaier/agent-m/pull/1530
date: 2026-10-30 18:32 UTC
---
# Development → Release testing: ITM-1316, a done item whose requirement is withdrawn or changed is marked, and pointed at its replacement or removed

**REGISTER**

## Reason

ITM-1316, pull request #1530 into `sprint/team1/128`, passes on `11160197`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1875-1880).

1. **CI.**
   - **Tests-only commit `bd3f7ce8`:** run 41103642963 (`pull_request`, attempt 1) was cancelled, with two jobs failed.
     Their only failing cases are the item's:
     - TST-1316001 to 1316006 of `tests/work-plans-done-marks.test.mjs`;
     - the five cases of `tests/implementation-pages-backlog-done-marks.test.mjs`, TST-1316101 to 1316105.
     - That is the item's reason: on the base a done item's `reason` is `null` (`src/work-plans/states.mjs`, `derivedState`).
   - **Head `11160197`:** run 41104173317. Attempt 1 was cancelled: 36 jobs succeed, 5 cancelled, none failed. Attempt 2 succeeds: 41 jobs
     succeed, 17 are skipped, none failed.
2. **Only the item's files change.**
   - MOD-work-plans: `states.mjs`. `doneMark` gives a merged or `built_by` item the reasons `acceptanceReasons` gives, and an
     item it builds on that is not done, joined, or `null`. The state stays `done`.
   - MOD-implementation-pages: `backlog.mjs`. A done row with a reason draws a field for the replacing requirement,
     *Point at* and *Remove*. Each writes one commit through `saveItems`, on the head read at the click.
   - Tests: the two new files, and `tests/implementation-pages-sprints.mjs`. That file is a helper whose header names
     MOD-implementation-pages. Its fake `commitFiles` now deletes a file that a commit deletes, which *Remove* needs. It
     changes no expected result.
   - `bd3f7ce8` holds only tests and `11160197` only code, both developer-sonnet-j's (`Agent-M-Participant`). No import is
     added, and no top-level await.
3. **It builds the accepted text and the item's Acceptance** (UC-032 1a; MOD-work-plans.md:130-131; the item's reading of
   "changed").
   - TST-1316001: a done item that realises a requirement no status names is marked; known positive, one whose
     requirement stands is not.
   - TST-1316002 to 1316006: a merged pull request still decides first and a changed use case marks the item; a queue
     entry not yet in the SPEC marks it, one written into the SPEC does not; a prerequisite not done marks it; both causes
     are named; a `built_by` item needs no pull request.
   - TST-1316101: the controls stand only on a marked done row, and a render writes nothing.
   - TST-1316102: *Remove* writes one commit that deletes the item's file.
   - TST-1316103 to 1316105: *Point at* writes one commit with the replacing requirement, replaces only the names the
     reason names, and writes nothing without a replacing requirement.
4. **The pull request's readings hold.**
   - "Changed" is the item's reading.
   - *Point at* replaces the names the row's reason names. A reason of a done item opens each part with "<name> is …", as
     `acceptanceReasons` writes it.
   - The control names `data-point-at`, `data-remove-item` and `data-point-to` are the module's own, in the shape of
     `data-add-item`.
5. **The point asked about: `sprint-facts` holds no requirement in its statuses.** It holds for this item.
   - `workStrategies`' `sprint-facts` calls `itemStates` with `statuses(snapshot)` alone. There every done item that
     realises a requirement now carries "<name> is not accepted".
   - No reader shows that reason. `sprintFacts` (`src/work-plans/facts.mjs`) reads an item's state, and a reason only for
     an item with no state. The callers that show a done row's reason, the route `backlog` and the progress page
     (`src/implementation-pages/progress.mjs`, `stateCell`), take statuses that hold the SPEC's requirements
     (`statusesOf`; MOD-progress-measures' `acceptanceStatuses`).
   - So nothing shown is wrong. Ruled: noted, no item. A caller that shows a done item's reason from `sprint-facts` must
     first add the requirements to its statuses.
6. **Counter-proofs, planted on the head in an export, each restored after.**
   - A done item's mark always `null`: all 11 new cases fail.
   - *Point at* keeping the withdrawn names: TST-1316103 and 1316104 fail.
   - The click's `isTrusted` guard removed: no case fails. The Acceptance asks that "nothing is written before" the click,
     which TST-1316101 asserts for the render. A script's click is not asked about. Noted.
7. **MOD-test-document's reader:**
   - `tests/work-plans-done-marks.test.mjs`: 6 declarations, 0 findings, each `unit`, MOD-work-plans.
   - `tests/implementation-pages-backlog-done-marks.test.mjs`: 5 declarations, 0 findings, each `unit`,
     MOD-implementation-pages.
   - `tests/implementation-pages-sprints.mjs`: no declaration, 0 findings. Its header names one module, level `component`.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - TST-1316001 to 1316006 and 1316101 to 1316105 are free in the history (`team1/128.md`).
8. **Reads, against the planning count** (`team1/128.md`): `itemStates` is pure, and drawing the route sends no request
   more. A click reads the head once and commits once.

## Noted

- No case asserts that a script's click on *Point at* or *Remove* writes nothing. The guard stands in the code.
