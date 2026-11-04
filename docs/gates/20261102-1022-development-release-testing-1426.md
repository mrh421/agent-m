---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 234b30b3f96c17f9ae4136397fa117631bb58c32
  - https://github.com/akmaier/agent-m/pull/1730
date: 2026-11-02 10:22 UTC
---
# Development → Release testing: ITM-1426, #1730

**REGISTER**

## Reason

ITM-1426 (a job's pull request names its date) may go on. The pull request is #1730 into `sprint/team1/142`, at
`234b30b3f`, the Scrum Master's merge of the sprint branch. The commits (`Agent-M-Participant` on each):
- developer-sonnet-k: the tests-only commit `19109a012` and the code `a8a29379a`;
- developer-sonnet-l: `bea6c7745`, the lift of TST-771211's `todo`, after the code was pushed.

I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `19109a012` adds TST-1426001 to
   `tests/runtimes-pull-request.test.mjs` (MOD-runtimes). In run 41425153529 it is the only failing case. By a slip, the
   same commit deleted the sprint record's selection block of ITM-1426. The merge `234b30b3f` restores it, and the pull
   request's net change no longer touches `142.md`.
2. **CI is green on the head:** run 41427382596 (`234b30b3f`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes.** The net change is `src/runtimes/pull-request.mjs`, its test file, and the flow map
   of UC-026's system file from the lift.
   - `describe` (:79-91) wrote the job, its kind, the work, the guarded requirements and the provenance lines, but no date.
   - It now writes `Date: <YYYY-MM-DD>` after `Kind:`.
4. **The Acceptance holds:**
   - The description names the date its job ran, beside the version, the participant and the model.
   - The counter-proofs each fail a case: the wall clock, the date taken from the job's identifier, a day not in UTC, and
     the line after the provenance lines, which also fails TST-1411001.
   - TST-771211 loses its `todo`, and its case is strengthened from any date to `^Date: 2026-10-30$`, the harness's clock.
     It is red at `19109a012` and green at `a8a29379a`. sonnet-j wrote the case, and sonnet-l built none of the writer.

## Readings taken

- The date is the day in UTC of the job's `now`, which MOD-runtimes gives every strategy to read and MOD-workflow-entries
  sets. It is not the commit's (the snapshot gives none), nor the wall clock's, nor the job identifier's.
- A line may be added, since MOD-runtimes names what the description must hold, not all it may (ITM-1411's reading).
- It stands before the blank line, so the six provenance lines still close the description.

All are taken.
