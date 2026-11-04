---
id: ITM-1326
title: The backlog lists what the other teams' sprints hold without a plan open
level: module
realises:
  - UC-032
  - SPRINT PLANNING SHOWS WHAT THE OTHER TEAMS' SPRINTS HOLD
modules:
  - MOD-implementation-pages
builds_on:
tests:
  - unit
origin:
  - finding UC032-S3 of ITM-803's battery, ruled at its gate (docs/gates/20261030-2035-development-release-testing-d803.md, Noted), and team1's sprint 129 Review (docs/backlog/sprints/team1/129.md)
---
# ITM-1326 The backlog lists what the other teams' sprints hold without a plan open

**REGISTER**

## Outcome

UC-032 step 5 says: "Agent M lists beside the backlog every item that another team's sprint holds … each with its
sprint, its team, the modules it changes and the modules whose interfaces they use". MOD-implementation-pages gives the
route `backlog`, "in a product with several teams, what the other teams' sprints hold, from `heldItems`", with no planning
named.

`paint` draws `heldPanel` only under `planning && teams.length > 1`. The backlog's column *Held or kept* names a held
item's sprint, but not its team's modules. TST-803012 follows UC-032 and stands `todo` with the finding.

With this item, in a product with several teams, the list of held items is drawn beside the backlog whether or not a
team's planning is open. It is drawn from the view the route reads already, and reads nothing more.

## Readiness

It is ready. The change stays in `paint` and the parts it draws already.
- **The team.** `heldPanel` names each held item's sprint as `<team>/<nn>` (`Held.sprint`, MOD-work-plans), which names its
  team. That is the reading this item takes of "its sprint, its team": no column is added, and TST-803012's known
  positive, which reads the row's five cells, does not move.
- **Without a plan open,** `heldPanel` is called with no team, so it lists every item a team's sprint holds. With a plan
  open it lists those of the other teams, as today.
- **The planning stand-in** (sprint 130's planning, on `main` at `13e66ee14`): `paint` draws `heldPanel` under `sprints &&
  teams.length > 1` in place of `planning && teams.length > 1`. Nothing else changes.
  - TST-803012 passes with it, and fails on the base.
  - **Requests:** `heldPanel` draws from `ctx.view.rows` and sends none. `load-per-view` passes as on the base.
- Its planning run is in `team1/130.md`.

## Acceptance

- A unit case: with two teams and a held item, the backlog without a plan open lists the item with its sprint, team, the
  modules it changes and those they use.
  - Known positive: with one team, nothing is listed.
  - Counter-proof: on the base, nothing is listed without a plan.
- The requests of one load of `#backlog` are the base's (`tests/load-per-view.test.mjs`).
- TST-803012's `todo` is taken away on the item's branch, in a commit of its own, by a participant who implemented none of
  the item.
- The first commit holds only the tests, and CI is red on it for the item's reason.
- It shares `src/implementation-pages/backlog.mjs` (`paint`) with ITM-1325, ITM-1327 and ITM-1328.
