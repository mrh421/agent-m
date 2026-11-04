---
id: ITM-1390
title: Merged candidates stay merged on the drafting page
level: module
realises:
  - UC-005
  - CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES
modules:
  - MOD-review-pages
builds_on:
  - ITM-579
tests:
  - unit
origin:
  - TST-579212 and TST-579321 of ITM-579's system and release tests of UC-005 (#1681), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1611-development-release-testing-0579.md)
---
# ITM-1390 Merged candidates stay merged on the drafting page

**REGISTER**

## Outcome

`CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES`: candidates of one run that state the same rule are merged into one, which
names every passage they came from. The correction loop merges them: the last round's class carries the `refs` of both
candidates. The drafting page of requirements then rebuilds the classes with one class per candidate
(`src/review-pages/candidates.mjs:149-168`, `editedResult`, called from `jobs.mjs` before *Write proposals*). So both
candidates stay on the panel, and both are written as requirements with the same rule.

## Acceptance

- Two candidates of one run with the same rule are shown as one candidate naming both passages, and *Write proposals*
  writes one requirement.
- TST-579212 and TST-579321 lose their `todo` in a commit by a participant other than the implementer, written after the
  code is pushed. TST-579321 is a release test.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
