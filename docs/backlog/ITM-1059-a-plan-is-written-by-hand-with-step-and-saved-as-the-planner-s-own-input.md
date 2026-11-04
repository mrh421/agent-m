---
id: ITM-1059
title: A plan is written by hand with + Step and saved as the planner's own input
level: module
realises:
  - UC-045
  - A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
  - EVERY ARTIFACT HAS AN IDENTIFIER
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-1057
  - ITM-614
tests:
  - unit
origin:
  - the gap analysis of UC-036 to UC-049 on main, proposal NEW-045-3, read against the accepted texts on main at 40e04d8d
  - akmaier's direction of 2026-10-18 ("fill the backlog to implement the remaining missing UC 36 to the end")
---
# ITM-1059 A plan is written by hand with + Step and saved as the planner's own input

**REGISTER**

## Outcome

MOD-implementation-pages.md:171: "*Save plan*, which ... writes a plan made by hand with `savePlan`; *+ Step*." UC-045
2a (UC-045.md:112-113): "They add steps with **+ Step**, each naming what it implements or integrates; the check of step 3
runs when they press **Save plan**, and the plan is committed as their own input." `savePlan` runs `planFindings` first and
writes nothing on an error finding (MOD-work-plans.md:215-221).

## Acceptance

- Unit tests that name MOD-implementation-pages, over a fake host: steps added with *+ Step* and saved commit one file per step
  and `docs/plan/order.md` with no provenance lines; a plan without a step for one module is refused, the finding shown, and
  nothing written.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/implementation-pages/` and the tests that name MOD-implementation-pages change.
