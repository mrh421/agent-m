---
id: ITM-1376
title: An item whose requirement will not be accepted is marked
level: module
realises:
  - UC-033
modules:
  - MOD-work-plans
  - MOD-maintenance-pages
builds_on:
  - ITM-804
tests:
  - unit
origin:
  - findings UC033-F2 and UC033-F3 of ITM-804's system tests TST-804206 and TST-804207 (#1653), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1108-development-release-testing-0804.md)
---
# ITM-1376 An item whose requirement will not be accepted is marked

**REGISTER**

## Outcome

UC-033 2a: a change item whose specification entries are rejected is marked, and Agent M offers to remove it and close the
issue with a link to the rejected entry. 2b: an item whose change is accepted under another name has its `realises`
updated when the Product Owner confirms. Neither is built (`src/maintenance-pages/issues.mjs:556-562`;
`src/issue-handling/backlog.mjs:78-93` rewrites only origins).

## Not ready — for akmaier

No accepted module text gives this. MOD-work-plans marks only a `done` item whose requirement is withdrawn, changed or not
accepted (MOD-work-plans.md:129-131), with *Point at* and *Remove* on the backlog page (UC-032 1a). A change item whose
entries are rejected or renamed is not done, so it stays `waiting for acceptance`. MOD-maintenance-pages' Uses give the
issue route no function that removes an item or rewrites its `realises`.

The general cause, and the general change it asks: the mark of UC-032 1a holds for `done` items only. If it held for every
item that names a requirement neither the SPEC nor an open queue holds, UC-033 2a and 2b would be that mark, with *Point
at* (2b) and *Remove* (2a) as the backlog page offers them, and closing the issue with `closeWithLinks`.

## Acceptance

- A change item whose every named requirement neither the SPEC nor an open queue holds is marked, with *Remove*, which also
  closes its issue with a link to the rejected entry (2a), and *Point at* the accepted name (2b).
- TST-804206 and TST-804207 lose their `todo`s in a commit by a participant other than the implementer, written after the
  code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
