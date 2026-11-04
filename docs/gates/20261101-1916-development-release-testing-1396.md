---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - f5ac2225ceaff9332d4f74e32e1acf3477e5b91f
  - https://github.com/akmaier/agent-m/pull/1689
date: 2026-11-01 19:16 UTC
---
# Development → Release testing: ITM-1396, #1689

**REGISTER**

## Reason

ITM-1396 (the document check finds marks of history) may go on. The pull request is #1689 into `sprint/team1/142`, at
`f5ac2225c`, with these commits (`Agent-M-Participant` on each):
- developer-opus-e: the tests-only commit `e73daa05e`, the merge `9a51f6fd1` that brought ITM-1402, and the code
  `e4b948df2`, the code held while ITM-1402 was built;
- developer-sonnet-l: `f5ac2225c`, the lift of TST-448328's `todo`.

I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `e73daa05e` adds
   `tests/documents-history-marks.test.mjs` (MOD-documents). In run 41329751450 the only failing cases are its own,
   TST-1396001 to 1396003.
2. **CI is green on the head:** run 41340486792 (`f5ac2225c`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/documents/checks.mjs`. For a schema with `noHistory: true`, `documentFindings`
   runs MOD-text-tools' `historyMarks` over the document's text: its front matter, rebuilt with `formatFrontMatter`, and
   its body. Each mark is an error at its line under `A DOCUMENT HOLDS NO HISTORY` (`checks.mjs:417` → `historyText`,
   :331).
4. **The Acceptance holds:**
   - The probe that stopped the item named the records that gained findings. ITM-1402, merged, took `noHistory` from the
     record schemas, which `A DOCUMENT HOLDS NO HISTORY` and MOD-documents' Data leave out.
   - `test_approval_records` passes again. MOD-documents' 168 cases and 130 Python cases pass. Of 523 files that call
     `documentFindings` or are headed by its callers' modules, 516 pass locally, and the other seven fail the same way
     without the code (packages missing on this machine, or files that hang here). CI runs them green.
   - Four planted faults each fail a new case.
   - TST-448328 loses its `todo`: red at `9a51f6fd1` ("the draft with the stamp goes back", 1 ≠ 2), green on the head.
     sonnet-k wrote the case, and sonnet-l built none of the check.

## Readings taken

- A mark is what `historyMarks` finds, over the whole text.
- A record of `key: value` lines is checked as its text.
- Only `noHistory: true` asks for the check.

All are taken.

## Noted

- The candidate schema of `src/release-evidence/report.mjs` keeps `noHistory: true`, as ITM-1402's gate left it. MOD-release-evidence
  calls no `documentFindings`, so nothing moves.
