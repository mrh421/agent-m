---
id: ITM-1406
title: A retrospective's process change is a SPEC queue entry
level: module
realises:
  - UC-041
  - AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF
modules:
  - MOD-work-plans
  - MOD-spec-changes
  - MOD-workflow-entries
  - MOD-implementation-pages
builds_on:
  - ITM-991
  - ITM-1397
tests:
  - unit
origin:
  - UC041-F4, TST-991306 of ITM-991's release tests of UC-041 (#1698), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1949-development-release-testing-0991.md)
---
# ITM-1406 A retrospective's process change is a SPEC queue entry

**REGISTER**

## Outcome

`AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF`: a rule of the development process changes only through a change of
the SPEC that a person accepts. Its check asks that every change a retrospective recommends is an open entry of a SPEC
change queue. The close writes such a change only as a line of the sprint record (`src/work-plans/saves.mjs:266`).

## How it is built

The accepted texts give it:
- **MOD-work-plans, `closeSprint`:** after the record's commit, each change of the retrospective that `goes` to the
  process model, the Definition of Done or a participant's instructions is written through MOD-spec-changes'
  `proposeSection`, as an open entry of the instance's SPEC. The entry is a new requirement whose rule is the change. It is
  appended to the section that holds the requirement governing what it changes, a section found by the requirement's
  name: `THE PROCESS MODEL IS DECLARED PER PRODUCT`, `A PRODUCT DECLARES ITS DEFINITION OF DONE` or
  `AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF`.
- **MOD-spec-changes, `proposeSection`:** a job whose SPEC rule asks for an open entry may call it. It computes the impact
  from the trace graph of the head it reads, which it builds with MOD-trace-graph's `traceGraph` where none is stored for
  that head. This ends the `GraphNotStored` that stopped the item in sprint 143 (`accept.mjs:83-84` → `build.mjs:201-206`).

MOD-workflow-entries and MOD-implementation-pages are named for TST-991209's system test only, which the implementer moves
in a tests-only commit, red there. TST-991406, a release case, is moved by a participant who built none of it, after the
code.

## Acceptance

- Each change a retrospective recommends to the process model, the Definition of Done or a participant's instructions is
  an open entry of a SPEC change queue. The model, the Definition of Done, the participants and the job definitions stay
  byte-identical.
- TST-991306 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
