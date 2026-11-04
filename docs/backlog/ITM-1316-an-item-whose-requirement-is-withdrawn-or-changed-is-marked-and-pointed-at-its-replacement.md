---
id: ITM-1316
title: An item whose requirement is withdrawn or changed is marked, and pointed at its replacement or removed
level: module
realises:
  - UC-032
  - A BACKLOG ITEM NAMES WHAT IT REALISES
  - A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
modules:
  - MOD-work-plans
  - MOD-implementation-pages
builds_on:
  - ITM-782
tests:
  - unit
origin:
  - po-opus-c's planning of sprint team1/127, ITM-782's reading of UC-032 1a
---
# ITM-1316 An item whose requirement is withdrawn or changed is marked, and pointed at its replacement or removed

**REGISTER**

## Outcome

UC-032 1a: "A requirement an item realises is withdrawn or changed. The item is marked. Agent M offers to point it at
the replacing requirement, or to remove it. Nothing changes until the Product Owner decides."

MOD-work-plans states the mark: "A requirement or use case it realises that is withdrawn, changed or not accepted, or an
item it builds on that is not done, marks a `done` item: its `reason` names that" (MOD-work-plans.md:130-131).
`itemStates` gives a `done` item no reason at all (`src/work-plans/states.mjs:173-179`, `reason: null` for a merged pull
request and for `built_by`). MOD-implementation-pages offers, on the route `backlog`, "an item pointed at a replacing
requirement or removed, with `saveItems`" (MOD-implementation-pages.md:170-171); the route draws each row's `state` from
the stored `BacklogView`, whose rows carry the `ItemState` (MOD-progress-measures.md:280-286).

With this item, a `done` item whose realised requirement or use case is withdrawn, changed or not accepted carries that
in its `reason`, and the backlog page offers, on such a row, to point it at a replacing requirement or to remove it, with
`saveItems`, on the person's click.

## Acceptance

- Unit cases of MOD-work-plans: a done item that realises a requirement the SPEC no longer holds names it in its
  `reason`; known positive: a done item whose requirements stand has the reason it has today.
- A unit case of the route `backlog`: such a row offers *Point at* and *Remove*; a click writes one commit through
  `saveItems`; nothing is written before it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- **Tests of other modules the change moves:** none, by the planning run below.

## The reading of "changed"

`itemStates` keeps its types and its facts (MOD-work-plans.md:151-158). A `done` item is marked from what those facts
hold, the same reasons that keep an item not done `waiting for acceptance`, and an item it builds on that is not done:
- **withdrawn or not accepted:** a requirement or use case it realises that `facts.statuses` holds as no `accepted`
  text — a requirement the SPEC no longer holds, a use case with no file or whose file no record names;
- **A changed text** is read against the text that holds now. A use case is changed while its file differs from the text its newest
  approval record names (status `changed`). A requirement is changed while an entry of a change queue that is not yet
  in the SPEC changes it.
- A change already written into the SPEC is the requirement's text now, and marks nothing. A renamed requirement is
  withdrawn under its old name (A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED), which marks the item.
- A caller whose `statuses` hold no requirement — `workStrategies`' recipe `sprint-facts` reads `statuses(snapshot)` alone —
  sees every done item that realises a requirement marked. The Developer reads each caller of `itemStates` for this.

## The planning run (sprint team1/128)

A stand-in: `derivedState` gives a merged or `built_by` item the reasons above, joined, or `null`. The route `backlog`
draws, on a done row with a reason, *Point at* and *Remove* beside the state, without their saves.

On `main` at `2af740feb`, in an export, every test file of the repository but the six that hang on the planning machine:
1,008 files, 6,316 Node cases. The same files were run without the change.
- No case fails only with it.
- Its known positive, a probe of `itemStates`: a `built_by` item that realises a requirement no status names gives
  "GONE is not accepted" with the stand-in and `null` on the base; one whose requirement stands gives `null` on both.
- None of the six files that hang there names MOD-work-plans, `itemStates` or `#backlog`.
- The function is pure, and the page draws two buttons more on a marked row. No read or request is added.
