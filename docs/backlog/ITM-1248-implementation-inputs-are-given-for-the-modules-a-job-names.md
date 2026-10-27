---
id: ITM-1248
title: Implementation inputs are given for the modules a job names
level: module
realises:
  - UC-012
modules:
  - MOD-run-planner
builds_on: []
tests:
  - unit
origin:
  - the developer of ITM-583, who found that a bug's fix cannot get its modules' inputs; the architecture a2fe0994, accepted in 6c0aa1ab
---
# ITM-1248 Implementation inputs are given for the modules a job names

**REGISTER**

## Outcome

MOD-run-planner's recipe `implementation-inputs`, as accepted, is given "for a step, an item, or the modules a job's parameter
`modules` names itself, as a bug's fix does (UC-012)", the same inputs for each module so named as for a module step, and
throws `NoWorkNamed` only for a job whose parameters name no step, no item and no module.

The code reads only `params.steps` and `params.items` and throws `NoWorkNamed` otherwise (`src/run-planner/inputs.mjs:45-47`):
with `{ modules: ["MOD-issue-handling"] }` it throws.

## Acceptance

- Unit tests naming MOD-run-planner: a job naming only modules gets each module's file, its subsystem's and the system's
  decision, the SPEC, the interfaces of the modules it uses, its code and its tests, as for a module step; an unknown module
  is `UnknownWork`; no step, item or module is `NoWorkNamed`. Counter-proof: before the change the first throws `NoWorkNamed`.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/run-planner/` and the tests that name MOD-run-planner change.
