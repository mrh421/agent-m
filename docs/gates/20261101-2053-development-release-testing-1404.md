---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 6e94ef6f98c25a023a0f8979e36e6c0f347d7706
  - https://github.com/akmaier/agent-m/pull/1707
date: 2026-11-01 20:53 UTC
---
# Development → Release testing: ITM-1404, #1707

**REGISTER**

## Reason

ITM-1404 (an agent's review names the sources of its feedback) may go on. The pull request is #1707 into
`sprint/team1/142`, at `6e94ef6f9`. developer-opus-e wrote the tests-only commit `edeb5a79d` and the code `d28774a17`;
developer-sonnet-l wrote `6e94ef6f9`, the lift of TST-991305's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `edeb5a79d` adds TST-1404001 and 1404002 to
   `tests/work-plans-sprint-record-writer.test.mjs` (MOD-work-plans) and widens the file's `Guards` line. In run
   41347710831 the two new cases are the only failing ones.
2. **CI is green on the head:** run 41348392614 (`6e94ef6f9`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/work-plans/strategies.mjs`, the writer `sprint-record`. It runs the existing
   `sprintRecordChecks` first. While a finding under `AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM` remains, it
   throws `ReviewRefused { findings }` before `closeSprint`, and nothing is written. Before, an unattended close whose loop
   ended with that finding open wrote "Sources of the feedback: none."
4. **The Acceptance holds:**
   - A review that names no source, or does not say that no stakeholder took part when none did, is refused by name, and
     nothing is recorded.
   - A review that names its sources is recorded.
   - Counter-proofs P1 and P2 are in the pull request.
   - TST-991305 loses its `todo`, and its flow-map entry moves to the evidence: red at `edeb5a79d`, green at `d28774a17`.
     opus-e wrote the case and implemented the item; sonnet-l, who lifted it, built none of the writer.
5. **The reads.** opus-e first skipped chapters 9, 11, 12 and 13. The Scrum Master sent it back, and it read them in full
   and checked the pull request against them, with no change.

## Readings taken

- The refusal sits in the writer, as MOD-job-runner says a writer "refuses by name what it must not write".
- The error is named `ReviewRefused`, beside `ItemsRefused` and `PlanRefused`.
- The item's "records none of it as a review" is read as: nothing of the close is written, and the sprint stays open.

All are taken.
