---
id: ITM-1412
title: A rejected gate ends its job
level: module
realises:
  - UC-034
  - UC-024
  - A JOB STOPS AT EVERY GATE
modules:
  - MOD-workflow-entries
  - MOD-runtimes
builds_on:
  - ITM-805
tests:
  - unit
origin:
  - UC034-F5, TST-805218 of ITM-805's system tests of UC-034 (#1699), ruled at its gate in team1's sprint 142 (docs/gates/20261101-2000-development-release-testing-0805-1045.md)
---
# ITM-1412 A rejected gate ends its job

**REGISTER**

## Outcome

UC-034 7a and UC-024 10a: when the gate's decider rejects, "the gate record states the rejection and its reason. The job
ends", and the step or item returns to *ready* with the reason. The CI entry resumes a waiting job only on a record of
decision `passed` (`src/workflow-entries/product.mjs:332`). A job whose gate was rejected waits for ever.

## The reading taken

MOD-product-process says the waiting job "is resumed by its route once the record is on the branch (MOD-runtimes'
`resumeJob`; on CI the record's push)". MOD-runtimes resumes a job "after its gate". A gate that is rejected is decided too,
so its record ends the job, with the record named as its end, where a passed one resumes it. The module texts do not list
the rejection, and that is noted for akmaier at the gate.

## Acceptance

- A job waiting at a gate whose record is `rejected` ends `failed`, naming the gate record and its reason, and its step or
  item shows *ready* again. Counter-proof: a `passed` record still resumes the job.
- TST-805218 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
