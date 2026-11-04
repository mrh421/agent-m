---
id: ITM-1418
title: The schedule page shows the last run of a release candidate
level: module
realises:
  - UC-027
  - A RELEASE RUNS EVERY TEST AT EVERY LEVEL
modules:
  - MOD-test-pages
builds_on:
  - ITM-772
tests:
  - unit
origin:
  - UC027-F1, TST-772217 of ITM-772's system tests of UC-027 (#1715), ruled at its gate in team1's sprint 142 (docs/gates/20261102-0829-development-release-testing-0772.md)
---
# ITM-1418 The schedule page shows the last run of a release candidate

**REGISTER**

## Outcome

UC-027 step 6: the page shows "the last run per occasion", and the occasions are every commit, pull request, nightly,
release candidate and on demand. MOD-test-pages' `schedule` route shows "the last run per occasion". The page shows four
occasions and leaves the release candidate to the release panel. A release candidate's run is the run of a tag's push, and
the host's `CiRun` names no ref.

## The reading taken

MOD-test-pages' Uses name MOD-repository-hosts' `listTags` and `listCiRuns`. A run on the commit a release tag names is the
release candidate's run. So the page takes the newest run whose commit a release tag names, with no new field of `CiRun`.
If the probe shows that a run names no commit the tags can be matched with, the item stops for the Product Owner, naming the
field it needs.

## Acceptance

- The schedule page shows the last run for each of the five occasions, the release candidate's being the newest run on a
  commit that a release tag names, and says so where none has run.
- TST-772217 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
