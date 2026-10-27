---
id: ITM-1232
title: A given-up increment holds no item
level: module
realises:
  - A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH
  - UC-041
modules:
  - MOD-work-plans
builds_on: []
tests:
  - unit
origin:
  - the check of the documents akmaier accepted since 2026-10-25 against the code: SPEC.md:1689-1693, UC-041 7b, MOD-work-plans' giveUpIncrement and MOD-implementation-pages' Give up increment are not implemented
---
# ITM-1232 A given-up increment holds no item

**REGISTER**

## Outcome

The accepted SPEC (`A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH`), UC-041 step 7b, MOD-work-plans
(`giveUpIncrement`, :136-137 and :256) and MOD-implementation-pages (:180, *Give up increment*) state that an increment
given up holds no item. In the code `heldItems` (`src/work-plans/sprints.mjs:141-161`) never reads `## Increment given
up`, and neither `giveUpIncrement` nor the button exists in `src/`. Implement `giveUpIncrement` and the hold as MOD-work-plans states them. The button belongs to the route
`sprint/<team>/<n>/close` (MOD-implementation-pages), which is not built yet: it comes with ITM-989, which builds that
route.

## Acceptance

- Tests naming MOD-work-plans, among them the case the SPEC sentence's check names in `tests/test_parallel_sprints.py`:
  a sprint whose increment is given up holds none of its items, and done items stay done; `giveUpIncrement` appends the
  section with a reason and refuses an open sprint or a merged increment. Counter-proof: before the change the sprint
  still holds its items.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/work-plans/` and the tests that name MOD-work-plans change.
