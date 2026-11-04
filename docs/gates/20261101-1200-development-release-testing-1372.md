---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 7ebd369aea2de02941b3a116602dea503e4cfe56
  - https://github.com/akmaier/agent-m/pull/1662
date: 2026-11-01 12:00 UTC
---
# Development → Release testing: ITM-1372, #1662

**REGISTER**

## Reason

ITM-1372 (a role for agents held by a person is a finding) may go on. The pull request is #1662 into `sprint/team1/141`, at
`7ebd369ae`. developer-opus-e wrote the tests-only commit `bcc206503` and the code `8d0ee8db8`; developer-sonnet-l wrote
`7ebd369ae`, the lift of TST-802312's `todo`, after the code was pushed (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `bcc206503` changes
   `tests/product-process-role-assignments.test.mjs` (MOD-product-process) only. In run 41303262893 its one new case,
   TST-1372001, fails, and no other.
2. **CI is green on the head:** run 41303926653 (`7ebd369ae`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only the item's module changes:** `src/product-process/assignments.mjs`. `roleAssignmentFindings` reports a holder
   of the type `person` of a role the model fills by `agent`, under `A PROCESS MODEL ORGANISES PEOPLE AND AGENTS`; a role
   filled by `either` takes a person.
4. **The Acceptance holds:**
   - TST-1372001 covers the finding and the `either` known positive. The pull request records three planted faults: the
     old code, `!== "person"` (fails on `either`), and `names.has`.
   - No existing expectation moved. No model of the instance fills a role by `agent` alone (grep for `| agent |` under
     `docs/process-models/` finds none; the same grep for `| either |` finds `scrum-wip.md`), so its role assignments gain
     no finding, as the green head shows.
   - TST-802312 loses its `todo` in sonnet-l's commit; without the code it fails (a person holds Scanner), with it the file
     passes 12 of 12.

## Noted

- MOD-product-process' list of findings (MOD-product-process.md:140-149) does not name this one, as the item states. Noted
  for akmaier; nothing waits on it.
