---
id: ITM-1415
title: A test's history marks the commits of the default branch
level: module
realises:
  - UC-029
  - EVERY TEST RUN LEAVES A RESULT RECORD
modules:
  - MOD-trace-pages
builds_on:
  - ITM-774
tests:
  - unit
origin:
  - UC029-F2, TST-774214 of ITM-774's system tests of UC-029 (#1713), ruled at its gate in team1's sprint 142 (docs/gates/20261102-0823-development-release-testing-0774.md)
---
# ITM-1415 A test's history marks the commits of the default branch

**REGISTER**

## Outcome

UC-029 step 5: below the test, its history shows "one mark per commit of the default branch where it ran". The detail of a
test (`src/trace-pages/test-detail.mjs:118-127, 139-149`) marks every commit that has a result record, including the head of
a pull request that is not on the default branch.

## The reading taken

MOD-trace-pages gives the tests view "its history across commits and releases", and does not say which commits. UC-029 says
which: those of the default branch. So the history marks only the default branch's commits that have a record.

## Acceptance

- A test's history marks each commit of the default branch with a result record for it, and no commit that is not on that
  branch.
- TST-774214 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
