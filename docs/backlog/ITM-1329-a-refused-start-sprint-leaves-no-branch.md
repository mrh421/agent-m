---
id: ITM-1329
title: A refused Start sprint leaves no branch
level: module
realises:
  - UC-032
  - A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN
modules:
  - MOD-work-plans
builds_on:
tests:
  - unit
origin:
  - finding UC032-S5 of ITM-803's battery, its branch, ruled at its gate (docs/gates/20261030-2035-development-release-testing-d803.md, Noted), and team1's sprint 129 Review (docs/backlog/sprints/team1/129.md)
---
# ITM-1329 A refused Start sprint leaves no branch

**REGISTER**

## Outcome

`startSprint` (`src/work-plans/saves.mjs:131-132`) calls `createBranch(branch, head)` before it commits the sprint's
record with `commitFiles({ expectedHead: head })`. When the default branch has moved, the commit is refused (`Moved`).
The branch `sprint/<team>/<nn>` then stays at the old head. A later start finds it "where it does not exist yet" false
and keeps it there.

UC-032 6c says that such a start "is refused". With this item, a refused start writes nothing. The branch is created only
once the record's commit is written, from the head that commit was written on.

MOD-work-plans' text names no order ("created from the head where it does not exist yet; `docs/backlog/sprints/<team>/<nn>.md`
committed"). Naming the sprint, item and module that hold a refused start is UC032-S5's other part, which is akmaier's.
This item does not change it.

## Readiness

It is ready. The change stays in `startSprint`. If `createBranch` fails after the record's commit, the caller sees that
error as today.
- **How the record then reads.** The record stands on the default branch with its `branch` field. `targetBranch` names
  that branch for the sprint's items while it does not exist yet. Nothing else is written. That is the reading of
  `startSprint`'s text, which names the branch's creation and the record's commit and no undoing of either.
- **The planning stand-in** (sprint 130's planning, on `main` at `13e66ee14`): `createBranch(branch, head)` moves after
  `commitFiles`, from the same `head`. It imports nothing new: `createBranch` and `commitFiles` are MOD-repository-hosts',
  named in MOD-work-plans' Uses. It changes no type.
- **Requests.** A start that is written sends the same two writes as today, the commit first. A start refused as `Moved`
  sends no `createBranch`, one request fewer.
- Its planning run is in `team1/130.md`.

## Acceptance

- A unit case over a fake host whose head has moved: `startSprint` rejects with `Moved` and no branch is created.
  - Known positive: on the base, the branch is created before the refusal.
  - Counter-proof: a start on the current head creates the branch and commits the record.
- TST-803015 stays `todo`: its naming part waits for akmaier.
- The first commit holds only the tests, and CI is red on it for the item's reason.
