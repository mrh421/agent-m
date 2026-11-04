---
id: ITM-1386
title: The drafting page shows each round's findings
level: module
realises:
  - THE ROUNDS ARE COUNTED AND SHOWN
  - UC-007
modules:
  - MOD-review-pages
builds_on:
  - ITM-580
tests:
  - unit
origin:
  - finding UC007-F3 of ITM-580's release test TST-580318 (#1672), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1459-development-release-testing-0580.md)
---
# ITM-1386 The drafting page shows each round's findings

**REGISTER**

## Outcome

`THE ROUNDS ARE COUNTED AND SHOWN` (SPEC.md:921-924): the number of correction rounds a draft needed, and the findings of
each round, are shown with the draft. After *Run*, the drafting page of the use cases shows the count and not each round's
findings (`src/review-pages/jobs.mjs:229-237`); `src/review-pages/sections.mjs:74` shows them for the architecture.

## The reading taken

The drafting page is MOD-review-pages' route that shows the draft after *Run*. The rounds of the job that drafted it are
what MOD-review-pages already shows for the architecture, so the drafting page shows them the same way, through the same
function. The `—` under *Extra sections* of a use case (MOD-review-pages.md:174) is the review of a saved file, not the draft.

## Acceptance

- After *Run*, the drafted use cases are shown with the number of rounds and, for each round, its findings, as the
  architecture's rounds are shown.
- TST-580318 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
