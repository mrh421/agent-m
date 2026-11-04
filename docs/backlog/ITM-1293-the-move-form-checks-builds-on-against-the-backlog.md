---
id: ITM-1293
title: The move form checks builds_on against the backlog
level: module
realises:
  - UC-033
modules:
  - MOD-maintenance-pages
builds_on:
  - ITM-1257
tests:
  - unit
origin:
  - developer-sonnet-l's release tests of ITM-1257 (PR #1394), open question 4, ruled by po-opus-c in docs/backlog/sprints/team1/111.md
---
# ITM-1293 The move form checks builds_on against the backlog

**REGISTER**

## Outcome

The issue page's move form checks the drafted item with `backlogFindings([live], architecture)`
(`src/maintenance-pages/issues.mjs`), the item alone, so a `builds_on` that names an existing item of the backlog, such
as ITM-0900 in the test world, is reported as an item that does not exist and withholds *Move*. MOD-maintenance-pages.md:202
uses `backlogFindings` for "the item's marks while the person edits it": the marks are found with the backlog's items
beside the drafted one, so a named item that the backlog holds gives no mark.

## Acceptance

- A unit case types an existing item into `builds_on` and finds no mark, and types an item the backlog lacks and finds
  one; the first fails on the code as it stands.
- Only `src/maintenance-pages/` and its tests change.
- **The function it needs is named in MOD-maintenance-pages' Uses:** `MOD-work-plans.backlogFindings`. The backlog's items
  are those the page already reads for *Add* (ITM-1254).
- **Tests of other modules this Outcome changes: none.**
  - The search was every test file under `tests/` that names `backlogFindings`, `builds_on` with the issue page, or
    `ITM-0900`, on `sprint/team1/115` at `7f221301`, read to its end.
  - It finds the move form's tests `maintenance-pages-move-lists`, `-move-1250` and `release-itm-1254-issue-move`, all of
    MOD-maintenance-pages. None types a `builds_on`.
  - It also finds MOD-work-plans' and MOD-issue-handling's own tests of `backlogFindings`. Those call it directly and do
    not change.
  - Its known positive is `maintenance-pages-move-lists`.
- It removes no test.
