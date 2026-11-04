---
id: ITM-1307
title: The schedule counts its tests by one rule
level: module
realises:
  - DON'T REPEAT YOURSELF
  - UC-027
modules:
  - MOD-test-pages
builds_on:
  - ITM-1265
tests:
  - unit
origin:
  - developer-opus-e's point on ITM-1265 (PR #1422), and po-opus-c's gate, docs/gates/20261029-0909-development-release-testing-7058.md
---
# ITM-1307 The schedule counts its tests by one rule

**REGISTER**

## Outcome

The rule by which a schedule row counts the tests is stated and built twice: each level counts the declarations of that
level, and the row `paid` counts those that call a paid service.
- **MOD-progress-measures** builds `scheduleView(facts)` from it (MOD-progress-measures.md:297-303,
  `src/progress-measures/views.mjs`). `publishOverview` stores the result.
- **MOD-test-pages** keeps its own copy. Where the repository stores no view, the route `schedule` counts the test files
  itself (MOD-test-pages.md:120-123, `testCounts` in `src/test-pages/schedule.mjs`).

The two copies already differ. The route adds to `paid` a declaration whose level is written `paid`. `scheduleView`
counts it in no row.

So one function should give the counts, and the route should call it where no view is stored. That function is
`scheduleView`, given the declarations the route reads.

## The reading of the accepted text

- MOD-test-pages' Uses name MOD-progress-measures (`storedView`, MOD-test-pages.md:36). The accepted check reads a
  module's Uses at the level of the module: it reports "a code file's `imports` edge to a module of which the file's own
  module names no interface among its `uses`" (MOD-trace-graph.md:212-213; TST-106805, "the module before the dot"). So
  the route may call `scheduleView`, which MOD-progress-measures provides.
- `scheduleView(facts: Facts)` gives "the counts of `facts.tests`" (MOD-progress-measures.md:301). Where no view is
  stored, the route gives it `Facts` of its snapshot whose `tests` are the declarations it reads; every other field is
  `"unknown"` where its type allows it (:151-161), and empty where it does not.

## Acceptance

- A unit test of MOD-test-pages: where no view is stored, the route's counts equal
  `scheduleView`'s for the same declarations, one of them of the level `paid`. Its counter-proof is the route's own
  counting as it stands, which counts that declaration under `paid`.
- The first commit holds only the tests, and CI is red on it.
- Only `src/test-pages/` and the tests that name MOD-test-pages change.
- Tests of other modules this Outcome changes: none (the planning run below).

**The planning run (sprint team1/125).** A stand-in on `main` at `785019f50` gives `scheduleView` `Facts` whose `snapshot`
is the route's and whose `tests` are the declarations it reads, every other field `"unknown"` where its type allows it and
empty where it does not, and shows its `counts`.
- 84 test files that name MOD-test-pages, MOD-progress-measures, `scheduleView`, `#schedule` or their folders: all 827 Node
  cases and 19 Python cases pass with it.
- Reads: none change; the declarations are read as before, once.
