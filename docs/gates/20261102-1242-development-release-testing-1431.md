---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 98dadace95d0c119d629508791535bb44ceae49f
  - https://github.com/akmaier/agent-m/pull/1737
date: 2026-11-02 12:42 UTC
---
# Development → Release testing: ITM-1431, #1737

**REGISTER**

## Reason

ITM-1431 (a process requirement's audit row names the artifacts its gate added) may go on. The pull request is #1737 into
`sprint/team1/142`, at `98dadace9`. developer-opus-e wrote the tests-only commit `d819e6ab8` and the code `9ba3e7b19`;
developer-sonnet-l wrote `98dadace9`, the lift of TST-775204's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `d819e6ab8` adds TST-1431001 and 1431002 to
   `tests/release-evidence-audit.test.mjs` (MOD-release-evidence) and TST-1431003 to `tests/trace-pages-audit.test.mjs`
   (MOD-trace-pages). In run 41445366364 they are the only failing cases.
2. **CI is green on the head:** run 41446165030 (`98dadace9`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's modules change:** `src/release-evidence/audit.mjs` and `src/trace-pages/audit.mjs`.
   - The path: an added gate carries its artifacts in the workflow (`workflow.mjs:107-109`). `gatesOf` dropped them
     (`trace-pages/audit.mjs:66-67`), `auditRows` kept the records only (`release-evidence/audit.mjs:160-161`), and the page
     drew the gate record only (:191).
   - Now `gatesOf` passes them on, and `auditRows` gives `row.artifacts` beside `row.gates`, as an added field.
   - The page draws them in an element of their own, and the gate's cell keeps its record. The exported document names
     them under each gate record.
4. **The Acceptance holds:**
   - A process requirement's row names the artifacts its gate asked for beside the gate record.
   - The counter-proofs F1 to F5 each fail a case. F5, the artifacts drawn inside the gate's cell, also fails TST-768006,
     768018 and a system case.
   - TST-775204 loses its `todo`: red at `d819e6ab8`, green at `9ba3e7b19`. sonnet-k wrote the case, and sonnet-l built
     none of either module. UC-030's release file gives 23 of 23, and its system file has one `todo` left, ITM-1433's.

## Readings taken

- The added field is the item's reading. An entry without artifacts gives "", drawn nowhere.
- The export names them too, since MOD-release-evidence's Data has the document hold "for a process requirement the gate
  records and artifacts it added".
- The artifacts are shown as the workflow writes them, one string.

All are taken.
