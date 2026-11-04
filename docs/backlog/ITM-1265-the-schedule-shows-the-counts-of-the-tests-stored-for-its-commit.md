---
id: ITM-1265
title: The schedule shows the counts of the tests stored for its commit
level: module
realises:
  - UC-027
  - THE TEST SCHEDULE IS DECLARED PER PRODUCT
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-progress-measures
  - MOD-test-pages
  - MOD-main-page
  - MOD-workflow-entries
builds_on:
  - ITM-1260
  - ITM-1263
tests:
  - unit
  - component
origin:
  - akmaier, 2026-10-28: "Please follow up. I want all pages fixed this way." And: "I think I want the 20 mb facts file gone."
---
# ITM-1265 The schedule shows the counts of the tests stored for its commit

**REGISTER**

## Outcome

Tests → Schedule shows six numbers: the tests of each level — `unit`, `component`, `system`, `release`, `user` — and
those that call a paid service (`testCounts`, `src/test-pages/schedule.mjs:83-102`). It takes them from
`storedFacts(snapshot).tests` (`schedule.mjs:86`), the test declarations of the facts file. With the facts file gone (ITM-1263) it
reads every test file instead (`schedule.mjs:91-93`): at Agent M's head 1,542 files, 19.3 MB, 16 batches, to show six
numbers.

After the change, as MOD-progress-measures and MOD-test-pages say: `scheduleView(facts)` gives `{ commit, counts }`;
`publishOverview` adds `<commit>.schedule.json.gz` beside the other views, in the same commit; the route `schedule`
reads it with `storedView(snapshot, "schedule")`, with the as-of line while the head's is not stored yet, and counts
the test files only where the repository stores no view.

Design principles (AGENTS.md §2 *Designing*): §2.1 *one responsibility per file* — one view file per page, as ITM-1260
stores the progress and the backlog; §2.2 *nothing twice* — the counts are derived once, from the `tests` the workflow's
facts already hold; §2.5 *no special first case* — the view follows the format, branch, `latest.json` fallback and
as-of line of the other views.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/progress-measures-schedule-view.test.mjs` (MOD-progress-measures, unit): for facts whose `tests` hold two
  `unit`, one `system` and one `release` declaration of which one calls a paid service, `scheduleView` gives
  `{ unit: 2, component: 0, system: 1, release: 1, user: 0, paid: 1 }`; `publishOverview` over a fake host adds
  `<commit>.schedule.json.gz` in its one commit, and leaves it when the branch holds it. Counter-proof: a declaration of
  an unknown level is counted in no row.
- `tests/test-pages-schedule-stored-view.test.mjs` (MOD-test-pages, component), over a counting fake of GitHub: with the
  head's view stored, the counts `tests/test-pages-schedule.test.mjs` expects, one read of `overview-cache` and no batch
  of test files; with only c0's stored, the line `As of c0…`; with no branch `overview-cache`, the counts from the test
  files. `tests/test-pages-schedule-stored-tests.test.mjs` is removed with `storedFacts`.

Measurable outcome, on the live page of the instance in the browser's network panel:

| Route | Today, without the facts file | After |
|---|---|---|
| `#schedule` | 16 batches, 1,542 test files (19.3 MB) | 1 file of `overview-cache`, under 1 KB |

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/progress-measures/`, `src/test-pages/` and the tests that name MOD-progress-measures or MOD-test-pages change,
  besides the tests of other modules below.
- Tests of other modules this Outcome changes: the three that pin the files `publishOverview` adds, each only to add
  `<commit>.schedule.json.gz`. No code of MOD-main-page or MOD-workflow-entries changes.
  - `tests/main-page-root-entry.test.mjs:39` (MOD-main-page), the setup `cachedContext`;
  - `tests/workflow-entries-main-changed.test.mjs:298` (MOD-workflow-entries), the files `onMainChanged` adds;
  - `tests/release-itm-1260-stored-views.test.mjs:265`, `:290` and `:297` (MOD-progress-measures, level `release`).
    It is changed by a participant who implemented none of this item, in a commit of its own on the item's branch.
- **Reading taken:** `scheduleView`'s entry gives `publishOverview` the fourth file "in the same commit as the other
  views" (MOD-progress-measures.md:301-303). So `written` is `false` when the branch holds every file `publishOverview`
  adds, the schedule's view among them, where its own entry (:304-308) still names three.
