---
id: ITM-1411
title: A job's pull request names what its item realises, and its issue
level: module
realises:
  - UC-034
  - AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
modules:
  - MOD-runtimes
builds_on:
  - ITM-805
tests:
  - unit
origin:
  - UC034-F4, TST-805213 of ITM-805's system tests of UC-034 (#1699), ruled at its gate in team1's sprint 142 (docs/gates/20261101-2000-development-release-testing-0805-1045.md)
---
# ITM-1411 A job's pull request names what its item realises, and its issue

**REGISTER**

## Outcome

UC-034 step 5.3: "The pull request names the item, the requirements it realises and, for an item from an issue, the issue
(UC-033)." MOD-runtimes' pull request gets "a description that names the job, the plan step or backlog item, its modules,
the requirements its new tests guard … and the provenance lines". `src/runtimes/pull-request.mjs`' `describe` names the
requirements the new tests guard, and neither those the item realises nor its issue.

## The reading taken

MOD-runtimes names what the description holds, not that it holds nothing else. So the description also names the
requirements and use cases the item realises and, for an item from an issue, the issue. The requirements the new tests
guard stay.

## Acceptance

- The description of a job's pull request names the item, the requirements and use cases it realises, and the issue of an
  item that came from one. The requirements the new tests guard are still named.
- TST-805213 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
