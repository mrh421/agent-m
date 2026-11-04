---
id: ITM-1369
title: A plan orders the modules, then the integrations, then the system
level: module
realises:
  - UC-045
  - AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
modules:
  - MOD-work-plans
builds_on:
  - ITM-1061
tests:
  - unit
origin:
  - finding UC045-F3 of ITM-1061's system test TST-1061021 (#1650), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1036-development-release-testing-1061.md)
---
# ITM-1369 A plan orders the modules, then the integrations, then the system

**REGISTER**

## Outcome

`AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES` (SPEC.md:1651-1656): a plan "orders the modules of each
subsystem by the interfaces they use, then the integration of each subsystem, then the system". `planFindings`
(`src/work-plans/checks.mjs:113-148`) checks that each module, subsystem and the system has a step, and the order of the
modules among themselves. A plan whose system step stands first, or whose integration of a subsystem stands before that
subsystem's modules, is saved.

## The reading taken

`planFindings` is the check of the plan's steps that MOD-work-plans gives (MOD-work-plans.md:180-187), and the SPEC's rule
states the order. A check of that order is built there. MOD-work-plans' list of findings names the order of the modules only;
that its text does not list this finding is noted for akmaier, and nothing waits on it.

## Acceptance

- `planFindings` reports, as an error under `AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES`, a subsystem's
  integration step ordered before a step of one of its modules, and the system's step ordered before any other step.
- Before the job starts, its probe runs the tests that call `planFindings` and `savePlan`, and names every fixture plan that
  gains a finding.
- TST-1061021 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
