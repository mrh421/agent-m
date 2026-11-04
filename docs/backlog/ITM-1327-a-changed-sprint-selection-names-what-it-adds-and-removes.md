---
id: ITM-1327
title: A changed sprint selection names what it adds and removes
level: module
realises:
  - UC-032
  - A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT
  - ONE CLICK PER DECISION
modules:
  - MOD-implementation-pages
builds_on:
tests:
  - unit
origin:
  - finding UC032-S4 of ITM-803's battery, ruled at its gate (docs/gates/20261030-2035-development-release-testing-d803.md, Noted), and team1's sprint 129 Review (docs/backlog/sprints/team1/129.md)
---
# ITM-1327 A changed sprint selection names what it adds and removes

**REGISTER**

## Outcome

UC-032 6a says: "Changing the sprint selection is a new **Start sprint** decision, and Agent M shows what it removes or
adds". MOD-work-plans' `startSprint` gives `added` and `removed`. The click of *Start sprint* on the route `backlog` draws
only "The selection of `<path>` is changed — commit `<sha>`". A done item, which the plan's list does not offer, leaves
the new `## Selection` without a word. TST-803014 follows UC-032 and stands `todo` with the finding.

With this item, the notice of a changed selection names the items it adds and those it removes, from `startSprint`'s
`added` and `removed`.

## Readiness

It is ready. The values are in the result the page receives already (MOD-work-plans, `startSprint`). Whether a done item
belongs among those `removed` is read from `startSprint`'s result as it stands, and the page adds no rule of its own. Its
build and planning run are made at the planning that selects it.

## Acceptance

- A unit case: a changed selection's notice names each added and each removed item.
  - Known positive: a sprint started anew names its selection as added.
  - Counter-proof: on the base the notice names neither.
- TST-803014's `todo` is taken away on the item's branch, in a commit of its own, by a participant who implemented none of
  the item.
  Its entry `6a-shows-what-it-removes-or-adds` leaves `FLOW_FINDINGS` of `tests/system-uc-032-maintain-the-backlog.test.mjs`
  and stands in `FLOW_EVIDENCE` with TST-803014, where TST-803001 needs it.
- **The existing tests whose expectation this changes:** none but TST-803014. Of the 12 test files that press
  `[data-start-sprint]`, one other case asserts the notice: TST-803013
  (`tests/system-uc-032-maintain-the-backlog.test.mjs:426`, `<path> is started`). It stays as it is, so the notice keeps
  the words "`<path>` is started" and "is changed" before the items it names.
- The first commit holds only the tests, and CI is red on it for the item's reason.
- It shares `src/implementation-pages/backlog.mjs` (`paint`) with ITM-1325, ITM-1326 and ITM-1328.
