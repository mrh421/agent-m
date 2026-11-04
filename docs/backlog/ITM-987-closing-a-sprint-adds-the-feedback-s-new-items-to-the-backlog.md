---
id: ITM-987
title: Closing a sprint adds the feedback's new items to the backlog
level: module
realises:
  - UC-041
  - A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
  - A BACKLOG ITEM NAMES WHAT IT REALISES
modules:
  - MOD-work-plans
builds_on:
  - ITM-617
tests:
  - unit
origin:
  - the gap analysis of UC-036 to UC-049 on main, proposal NEW-041-2, verified against the accepted texts on main at ee5d1364
  - akmaier's direction of 2026-10-18 ("fill the backlog to implement the remaining missing UC 36 to the end")
---
# ITM-987 Closing a sprint adds the feedback's new items to the backlog

**REGISTER**

## Outcome

MOD-work-plans.md:245-255: `closeSprint` "adds the feedback's new items to the backlog as `saveItems` does, and records for
each unfinished item whether it goes back to the backlog or into the team's next sprint; all in one commit". UC-041 step 6
(UC-041.md:84-86) commits "the review and the retrospective ..., the new backlog items from the feedback, and the moved
items".

Today a close with any new item is refused: `src/work-plans/saves.mjs:232-235` throws `NotSupported` "New items from the
feedback are not added at a close yet: they need identifiers that no history holds." `saveItems` is built since `05dda744`
(ITM-617, `saves.mjs:299`), and gives the identifiers and `backlogFindings` first. This item lets `closeSprint` write the new items in the same commit as
the sprint record, with the same checks `saveItems` makes, and drops `NotSupported`.

## Acceptance

- Unit tests that name MOD-work-plans, over a fake host: a close with two new items commits the sprint record and both item
  files in one commit, each item with an identifier no history of `docs/backlog/` holds; a new item that realises nothing
  is refused with `ItemsRefused` and nothing is written.
- Counter-proof: writing the items in a second commit fails the one-commit test.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/work-plans/` and the tests that name MOD-work-plans change.
- It builds on `closeSprint` and `saveItems` as MOD-work-plans' accepted text states them. The open draft of
  MOD-work-plans (`backlogOf`, `moduleFiles`, `listField` and the new text of `backlogFindings`) leaves both sentences
  as they are; nothing of it is built here.
- The planning run (sprint team1/123), with a stand-in that moves `saveItems`' identifiers, findings and files into one
  function of `saves.mjs` that `closeSprint` also calls: the 116 test files that name MOD-work-plans, `work-plans/`,
  `closeSprint`, `saveItems`, the writers `backlog-items` and `sprint-record`, or the two modules that call `saveItems`
  (MOD-issue-handling, MOD-maintenance-pages). No case fails only with it.
