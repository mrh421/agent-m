---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9c61f5d87b9e1acf648b2e3ce0db3f9401290ac5
  - https://github.com/akmaier/agent-m/pull/1728
date: 2026-11-02 10:04 UTC
---
# Development → Release testing: ITM-1419, #1728

**REGISTER**

## Reason

ITM-1419 (a foreign GitLab configuration is read for its triggers) may go on. The pull request is #1728 into
`sprint/team1/142`, at `9c61f5d87`. developer-sonnet-j wrote the tests-only commit `f3dd86cae` and the code `8aed78edf`;
developer-sonnet-l wrote `9c61f5d87`, the lift of TST-772210's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `f3dd86cae` adds TST-1419001 to 1419006 to
   `tests/test-schedule-configuration-drift.test.mjs` (MOD-test-schedule). In run 41424233129 they are the only failing
   cases.
2. **CI is green on the head:** run 41424933800 (`9c61f5d87`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/test-schedule/generate.mjs`.
   - `configurationDrift` read a foreign configuration's triggers only on GitHub (:303-307). On GitLab the entry named only
     the missing include.
   - Now GitHub and GitLab share one formatter and one table of events to occasions.
   - `gitlabTriggersOf` reads a job's `rules` (`$CI_PIPELINE_SOURCE` with `||` and `=~`), `only`/`except` and the
     `workflow` rules. Its reading is added to the entry of the missing include.
4. **The Acceptance holds:**
   - A foreign `.gitlab-ci.yml` is named with its triggers and the rows they run, besides the missing include.
   - The nine counter-proofs in the pull request each fail a case.
   - TST-772210 loses its `todo`: red at `f3dd86cae`, green at `8aed78edf`. UC-027's system file now has no `todo` left,
     20 of 20, and its release file 14 of 14. opus-e wrote the case, and sonnet-l built none of the function.

## Readings taken

- On GitLab the foreign configuration is the product's own `.gitlab-ci.yml`. Its triggers are named in the entry of the
  missing include, and not once the include stands: TST-745007 expects no entry then, and the item lets no other expected
  result move.
- A job naming no source, or a rule naming none, counts as a push, and so does a branch or tag in `only`.
- Hidden jobs and global keys are no jobs. Triggers are named as GitLab names them.
- The code stays in `generate.mjs`, since a new file would add a part to the module's text.

All are taken.

## Noted

- TST-772210 asserts the trigger, not the rows it runs. Its GitHub twin TST-772209 asserts both, and TST-1419001 asserts
  the whole text with the rows, so the rows are guarded.
