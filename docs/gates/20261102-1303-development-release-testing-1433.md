---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 52c2aaa16d1caebaade0c848c1fb770323dd5892
  - https://github.com/akmaier/agent-m/pull/1738
date: 2026-11-02 13:03 UTC
---
# Development → Release testing: ITM-1433, #1738

**REGISTER**

## Reason

ITM-1433 (a process requirement without a gate record has its audit row) may go on. It was built on the reading ruled in
142.md (`507d10f2c`). The pull request is #1738 into `sprint/team1/142`, at `52c2aaa16`. developer-opus-e wrote the
tests-only commits `bf01fccce` and `66f0c8420` and the code `ad03df86d`; developer-sonnet-l wrote `52c2aaa16`, the lift of
TST-775220's `todo`, after the code was pushed (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.**
   - `bf01fccce` adds TST-1433001 and 1433002 to `tests/release-evidence-audit.test.mjs` and TST-1433003 to
     `tests/trace-pages-audit.test.mjs`. Its helper `audit` takes the new input; no expectation moves. In run 41448046988
     the three new cases are the only failing ones.
   - `66f0c8420` corrects one number of opus-e's own new case: A PROCESS RULE has no test even with its record, so "no test"
     counts 2. The case was red before that line.
2. **CI is green on the head:** run 41449008306 (`52c2aaa16`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's modules change:** `src/release-evidence/audit.mjs` and `src/trace-pages/audit.mjs`.
   - `gatesOf` (:67) kept only gates with a record, and `auditRows` (:98-100) made process rows only from them. So A
     PROCESS RULE had no row.
   - Now `auditRows` takes an added, optional input `unrecorded: Array<{ requirement, gate }>`, by default empty. A gate
     with a record keeps `record: string`, and each row gains the gates no record holds.
   - `auditDocument` writes "Gate `<gate>`: no record holds it". `gatesOf` hands the gates without a record through, and
     the page draws them in an element of their own, so the gate's cell keeps records only (TST-768006, 775220).
4. **The Acceptance holds:**
   - Every process requirement valid at the release has a row, one whose gate has no record included, naming that no
     record holds it.
   - The four counter-proofs in the pull request each fail a case.
   - TST-775220 loses its `todo`: red at `bf01fccce`, green at `ad03df86d`. sonnet-k wrote the case, and sonnet-l built none
     of either module. UC-030's system file gives 20 of 20 and its release file 23 of 23; no `todo` is left in UC-030.

## Readings taken

- The item's reading of an extension: an added input and an added field of the row, the type of a recorded gate kept.
- "Outside the cell of gate records" is an element of its own in the column of gates, outside the gate records' elements.
- MOD-release-evidence's text lists neither the input nor the field, which stays noted for akmaier.

All are taken.
