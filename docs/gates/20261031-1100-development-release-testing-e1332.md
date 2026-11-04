---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 3bbfcbec7c47ca9e8d011ac1c848d76e35fd66a8
  - https://github.com/akmaier/agent-m/pull/1552
date: 2026-10-31 11:00 UTC
---
# Development → Release testing: ITM-1332, a sprint ended by its items names the day it ended (rework)

**REGISTER**

## Reason

ITM-1332, pull request #1552 into `sprint/team1/131`, passes on `3bbfcbec7`, its reworked head. The first head,
`558a60de3`, was rejected on check 3 (`20261031-1050-development-release-testing-a1332.md`). Both commits carry
`Agent-M-Participant: developer-sonnet-j`.

1. **The first commit holds only tests and is red for the item's reason.**
   - `0e36cd746` adds `tests/progress-measures-sprint-ended-day.test.mjs` and changes TST-1330002's expected `ended` to
     `2026-10-21`.
   - **No CI run exists on `0e36cd746`.** Both commits were force-pushed at once, so `pull_request` CI ran on the head
     only. The check is decided on the records:
     - run 41193492851 was red on `f26226d5a`, whose new file is byte for byte the same (`git diff f26226d5a 0e36cd746`
       changes only TST-1330002), on TST-1332001 to 1332003;
     - on `0e36cd746` under Node 22.23.4, those three and TST-1330002 fail, for the item's reason (`ended` null).
2. **CI.** Run 41194488786 (`pull_request`, attempt 1) on `3bbfcbec7` succeeds: 41 jobs succeed, 17 are skipped.
3. **Only the item's scope changed.**
   - `src/progress-measures/measures.mjs` and `views.mjs`, the same code as `558a60de3`.
   - The new test.
   - TST-1330002, whose file names MOD-progress-measures. Its changed expectation stands in the tests-only commit, and
     ITM-1332's Acceptance names it, under the reading the item states (`da6dec4c0`).
4. **The new tests** TST-1332001 to 1332003 name their requirements and MOD-progress-measures. Their counter-proofs are
   in the pull request. Planted by me in an export of the head: with the end from the items removed (`|| text(byItems)`),
   all three fail, and TST-1330002 fails too.
5. **The Acceptance holds.**
   - The later merge day is `ended` and `lastEnded.end`, and the burn-down ends there.
   - Known positive: `## Ended` today names today.
   - On the base `ended` is null.
   - TST-1330104 passes under its `todo`, which developer-sonnet-l takes away.
6. **MOD-test-document's reader** on the head:
   - the new file: 3 declarations, 0 findings;
   - `progress-measures-sprint-ended`: 4 and 0;
   - the control: 4 and 0.
7. **The pages that draw the field** (sprint 130's agreement) pass on the head: `implementation-pages-progress` and
   `implementation-pages-backlog-end-sprint`.
