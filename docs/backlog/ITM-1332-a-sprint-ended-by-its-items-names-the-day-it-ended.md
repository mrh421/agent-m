---
id: ITM-1332
title: A sprint ended by its items names the day it ended
level: module
realises:
  - UC-032
  - UC-035
  - PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
modules:
  - MOD-progress-measures
builds_on:
  - ITM-1330
tests:
  - unit
origin:
  - finding ITM-1330-A of ITM-1330's release test TST-1330104 (#1549), ruled at ITM-1326's gate of team1's sprint 130 (docs/gates/20261031-0550-development-release-testing-d1326.md)
---
# ITM-1332 A sprint ended by its items names the day it ended

**REGISTER**

## Outcome

With ITM-1330, a sprint without a time box is final once every item it selects is done (`sprintsToClose`). Its
`ProgressView` sprint has no day for that end. `ended` is its `end`, else the `at` of its `## Ended`, else null
(`src/progress-measures/views.mjs`, `progressView`). So Progress draws "It ended on ; its review and retrospective are not
recorded yet." (`src/implementation-pages/progress.mjs`, which draws `ended` as it is given).

Backlog names a day for the same sprint: `lastEnded.end`, the last day of its final burn-down. For such a sprint that
burn-down runs to today, so the day moves with every day the sprint waits for its close. TST-1330104 follows ITM-1330's
release reading and stands `todo` with the finding.

With this item, a sprint that ended because every item it selects is done ended on the day the last of those items was
merged.
- Its `ProgressView` sprint names that day in `ended`.
- Its final burn-down ends on that day, so `BacklogView`'s `lastEnded.end` names the same day.

## Readiness

It is ready.
- **No text fixes the day.** MOD-progress-measures types `ended` as `string | null` and names no rule for it. It gives
  `lastEnded.end` as "the last day of its final burn-down", and the burn-down of a sprint without a time box "until the
  sprint ends". The day the last selected item was merged is the day `sprintsToClose` first names the sprint as ended,
  so both views take the end from the one rule ITM-1330 uses.
- **The module.** The view gives the page no day, and the page draws what the view gives. So the defect is
  MOD-progress-measures', the module whose code the finding points into (sprint 129's agreement).
- **What it reads.** Each item's merge is in the facts already (`mergesOf`, the views' `merges`). The view reads nothing
  more.
- Its build and planning run are made at the planning that selects it.
- **TST-1330002 changes.** It asserts `ended` null for a sprint ended by its two merged items
  (`tests/progress-measures-sprint-ended.test.mjs`). That null is the defect the finding ITM-1330-A names, not behaviour
  the module file gives: the accepted MOD-progress-measures types `ended` as `string | null` and gives no rule for this
  case. `AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES` allows "tests that name one of those modules", and TST-1330002
  names MOD-progress-measures. So the item changes its expected result.

## Acceptance

- Unit cases of `progressView` and `backlogView`: a sprint without a time box whose two items were merged on two days
  names the later day as `ended` and as `lastEnded.end`, and its burn-down ends there.
  - Known positive: a sprint whose `## Ended` is today names today.
  - Counter-proof: on the base `ended` is null.
- TST-1330002's expected `ended` changes from null to the day of the later merge, in the tests-only commit.
- TST-1330104's `todo` is taken away on the item's branch, in a commit of its own, by a participant who implemented none
  of the item.
- The first commit holds only the tests, and CI is red on it for the item's reason.
