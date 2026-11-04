---
id: ITM-1333
title: A start refused as Moved names the collision at the moved head
level: module
realises:
  - UC-032
  - SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES
modules:
  - MOD-work-plans
builds_on:
  - ITM-1329
tests:
  - unit
origin:
  - akmaier's ruling "S5 yes" on finding UC032-S5, drafted in MOD-work-plans with 2de0ff176 (#1546) and accepted with d70cbd918 (docs/approvals/MOD-work-plans-b898fb9910e2.md)
---
# ITM-1333 A start refused as Moved names the collision at the moved head

**REGISTER**

## Outcome

The accepted `startSprint` (MOD-work-plans, Interfaces): "Where the host refuses the commit with `Moved { head }`, `held`
is read again at that head — `heldItems` of its sprint records, items and module files and of the product's pull
requests —, and an item `conflicts` names there refuses the start with `SprintRefused`; otherwise `Moved` stands."

`startSprint` (`src/work-plans/saves.mjs`) lets the host's `Moved` through as it is. When another team committed its
sprint in the meantime, the Product Owner reads "main has moved on … read it again", without the sprint, the held item or
the module (UC-032 6c).

With this item, on `Moved { head }` with a head, `startSprint` reads the snapshot at that head and the product's pull
requests (`listPullRequests`), derives `heldItems`, and checks each item it checked before with `conflicts`. A conflict
refuses the start with `SprintRefused`, its reasons naming the sprint, the held item and the module as the first check
names them. Nothing is written, and no branch is created (ITM-1329). Without a conflict, or with `Moved` naming no head,
`Moved` stands.

## Readiness

It is ready.
- **Readings.** The sentence names `heldItems` without `onDefault`, so the pull requests alone decide. It applies to both
  saves of `startSprint`, a new sprint's record and a running sprint's `## Selection`, since both are "the commit"; a
  running sprint checks the items it adds, as its first check does.
- **Uses.** `heldItems` and `conflicts` are the module's own; `readSnapshot` and `listPullRequests` are
  MOD-repository-hosts', named in MOD-work-plans' Uses.
- **Requests.** Only a refused start reads more: one snapshot and one pull-request listing. A start that is written
  sends what it sends today.
- **TST-803015 stays `todo`.** Its refusal part passes with this item. Its part "the marks of step 5 are shown anew"
  (UC-032 6c) is a redraw of the route `backlog`, which MOD-implementation-pages' text does not give; it waits for akmaier
  (`team1/131.md`).

## Acceptance

- A unit case over a fake host that refuses the commit with `Moved { head }`, at which head another team's sprint holds
  an item of the same module: `startSprint` rejects with `SprintRefused`, whose reasons name that sprint, item and module;
  no commit and no branch.
  - Known positive: on the base it rejects with `Moved`.
  - Counter-proof: at the moved head no sprint holds a colliding item, and `Moved` stands.
- The first commit holds only the tests, and CI is red on it for the item's reason.
