---
id: ITM-1372
title: A role for agents held by a person is a finding
level: module
realises:
  - A PROCESS MODEL ORGANISES PEOPLE AND AGENTS
  - UC-048
modules:
  - MOD-product-process
builds_on:
  - ITM-802
tests:
  - unit
origin:
  - finding UC031-R2 of ITM-802's release test TST-802312 (#1651), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1043-development-release-testing-0802.md)
---
# ITM-1372 A role for agents held by a person is a finding

**REGISTER**

## Outcome

`A PROCESS MODEL ORGANISES PEOPLE AND AGENTS` (SPEC.md:360-363): a model names for each role "whether a person, an agent, or
either may fill it". `roleAssignmentFindings` (`src/product-process/assignments.mjs:154-160`) reports a role that needs a
person and has none, and nothing for a role that agents fill given to a person.

## The reading taken

`roleAssignmentFindings` is the check of a product's role assignments that MOD-product-process gives
(MOD-product-process.md:140-149), and the SPEC states who may fill a role. The check is built there. That the module's list
of findings does not name it is noted for akmaier, and nothing waits on it.

## Acceptance

- `roleAssignmentFindings` reports, as an error under `A PROCESS MODEL ORGANISES PEOPLE AND AGENTS`, a holder of the type
  `person` of a role the model fills by `agent`, naming the role and the holder. A role filled by `either` gives none.
- Before the job starts, its probe runs the tests that call `roleAssignmentFindings`, and the instance's own role
  assignments through them, and names every one that gains a finding.
- TST-802312 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
