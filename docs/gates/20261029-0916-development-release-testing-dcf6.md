---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9343a0a5fb2c5291ac5250085b3ba53db018ee0e
  - https://github.com/akmaier/agent-m/pull/1422
  - docs/gates/20261029-0909-development-release-testing-7058.md
date: 2026-10-29 09:16 UTC
---
# Development → Release testing: ITM-1265, the schedule shows the counts of the tests stored for its commit

**REGISTER**

## Reason

ITM-1265, pull request #1422 into `sprint/team1/114`, passes on `9343a0a5`, its head when this was decided. My return of
`85a7abef` (`docs/gates/20261029-0909-development-release-testing-7058.md`) asked for one mend.
- The points under "What holds, to be checked again on the mended head" in that record stand for the commits before the
  mend.
- This record checks the mend.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40847787880, `pull_request`, on `9343a0a5` passes 38 of 38 pull-request jobs.
2. **The mend is exactly what the return asked, and nothing more.**
   - `85a7abef..9343a0a5` is one commit, `9343a0a5`, by developer-opus-e. It changes only TST-1265006 in
     `tests/test-pages-schedule-stored-view.test.mjs`, which names MOD-test-pages.
     - Its `guards:` add A PAGE LOAD READS THE REPOSITORY IN BATCHES.
     - Its `expect:` adds "both test files are read in a batch, and none by itself".
     - It adds two assertions: both test files stand in `srv.batches`, and `srv.requests` holds no `file tests/…`.
   - No other line, no code and no other test changes. Every earlier assertion stays, so no expectation is weakened.
3. **The counter-proof, run by me on `9343a0a5`.**
   - With `await snapshot.readMany?.(paths)` taken out of `src/test-pages/schedule.mjs:94`, the file runs 2 pass and
     1 fail. The failing case is TST-1265006.
   - Restored, it runs 3 pass.
   - The pull request records the same.
4. **The reader.** On `9343a0a5`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `test-pages-schedule-stored-view`: 3 declarations, TST-1265004 to 006, and 0 findings.

## Noted

- The counting held twice, by MOD-progress-measures' `scheduleView` and by the route's fallback, stays registered as
  ITM-1307. It waits for a draft of MOD-test-pages for akmaier.
