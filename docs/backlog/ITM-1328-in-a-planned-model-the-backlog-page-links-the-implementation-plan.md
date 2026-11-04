---
id: ITM-1328
title: In a planned model the backlog page links the implementation plan and draws no backlog
level: module
realises:
  - UC-032
  - UC-045
modules:
  - MOD-implementation-pages
builds_on:
tests:
  - unit
origin:
  - finding UC032-S6 of ITM-803's battery, ruled at its gate (docs/gates/20261030-2035-development-release-testing-d803.md, Noted), and team1's sprint 129 Review (docs/backlog/sprints/team1/129.md)
---
# ITM-1328 In a planned model the backlog page links the implementation plan and draws no backlog

**REGISTER**

## Outcome

UC-032 1b says: "The product's model works from a plan. There is no backlog. Agent M links to the implementation plan
(UC-045)." For a model of kind `planned`, the route `backlog` writes "there is no backlog (UC-032 1b) — its progress is
shown on Progress", links `#progress`, and goes on to draw the backlog and the part of what no item realises
(`src/implementation-pages/backlog.mjs`, `paint`). TST-803024 follows UC-032 and stands `todo` with the finding.

With this item, for a planned model the route says there is no backlog and links the route `plan`, and draws neither the
backlog nor the planning of a sprint. It is the mirror of the route `plan`, which for a model that works from a backlog
gives "a link to `backlog`, and nothing else" (MOD-implementation-pages).

## Readiness

It is ready. No module text gives the route `backlog` the planned case. The route `plan` exists, and the change stays in
`paint`. Whether the route then reads less is counted at its planning run against the base.

## Acceptance

- A unit case: in a V-model product, `#backlog` links `#plan` and draws no part `backlog` or `uncovered`.
  - Known positive: in a Scrum product it draws both.
  - Counter-proof: on the base the V-model page draws the backlog.
- TST-803024's `todo` is taken away on the item's branch, in a commit of its own, by a participant who implemented none of
  the item.
  Its entry `1b-link-to-the-plan` leaves `FLOW_FINDINGS` of `tests/system-uc-032-maintain-the-backlog.test.mjs` and stands
  in `FLOW_EVIDENCE` with TST-803024, where TST-803001 needs it.
- **The existing tests whose expectation this changes:** TST-681008 (`tests/implementation-pages-backlog.test.mjs:301`)
  asserts that the planned product's warning links `#progress`. Its expectation changes, in the tests-only commit, to a
  link `#plan`; its `expect` line says so. TST-803024's known positive, the words "plans its work in advance: there is no
  backlog (UC-032 1b)", stays, and so does the warning's wording. No other test asserts the warning (`grep -rn "plans its
  work in advance" tests`: these two, and the comment lines of each).
- The first commit holds only the tests, and CI is red on it for the item's reason.
- It shares `src/implementation-pages/backlog.mjs` (`paint`) with ITM-1325, ITM-1326 and ITM-1327.
