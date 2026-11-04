---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 66f1ac405f02ab74cbf326d39502a473b296bb56
  - https://github.com/akmaier/agent-m/pull/1387
date: 2026-10-29 01:18 UTC
---
# Development → Release testing: ITM-1152, the check `tests/test_issue_to_spec.py` is written, as the SPEC names it

**REGISTER**

## Reason

ITM-1152, pull request #1387 into `sprint/team1/110`, passes on `66f1ac40`, its head when this was decided.

The condition and the Definition of Done are those of `docs/process-models/scrum-wip.md:53` and SPEC.md:1870-1873.

1. **CI is green.** Run 40798649074 on `66f1ac40` passes 38 of 38 pull-request jobs.
   - The new check ran, in release shard 4 (job 123201216265). Its three cases passed:
     - `test_a_change_is_written_as_a_queue_naming_the_issue`;
     - `test_the_code_is_not_changed_by_a_change`;
     - `test_on_a_gitlab_server_the_class_of_a_change_is_only_a_label`.
   - TST-965202 passes without its `todo` mark.
2. **There is no red first commit, and the Definition of Done does not ask for one here.**
   - The reading: the clause "the job's first commit held only failing tests" is the rule AN IMPLEMENTATION JOB BEGINS
     WITH A FAILING TEST. That rule binds "an implementation job that adds or changes behaviour" (SPEC.md:1462-1464).
   - This pull request changes only tests, and the behaviour it checks was built by ITM-582 and ITM-584.
   - What stands in its place is A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT (SPEC.md:1527-1530). The description
     records eight planted faults, each with the field that turned red, and each declaration names its fault.
   - One field, `jobKinds`, has no planted fault of its own.
3. **Only tests change.** `tests/test_issue_to_spec.py`, its data file `tests/test_issue_to_spec.md` (AGENTS.md §7), and
   `tests/release-uc-038-turn-mails-into-issues.test.mjs`.
4. **Every new test names its requirement and module.** TST-1152001 to 1152003, level `release`, guard EVOLUTION
   ENTERS THROUGH THE SPECIFICATION and UC-012, on MOD-issue-handling, MOD-maintenance-pages and MOD-spec-changes.
5. **The writers implemented none of the behaviour** (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER, SPEC.md:1537-1541).
   - developer-sonnet-k wrote the check: `43a28d9b`, `b420bd2b`.
   - developer-sonnet-l, who did not write the file, removed TST-965202's `todo` in a commit of its own (`66f1ac40`),
     as the item's Acceptance asks.
   - In `6fe18b70`, l also emptied TST-965201's list of missing checks, which the new file makes untrue.
   - ITM-582 and ITM-584 were built in the coordinator's session; no commit names k or l.

## Noted

- **A gap the check names and does not close.** On a GitLab server only the class of an issue is checked
  (TST-1152003). The queue written for a change is not, because the repository holds no fake of GitLab's commit API.
  The SPEC sentence names "the product's GitLab server", and the code branches on it (`src/spec-changes/propose.mjs:400`,
  `:411`, `:468`). This is for a new item.
- **"A code change second"** is read through UC-012's postcondition. The check shows that nothing but the queue is
  committed and that no fix is offered. That no code job starts before acceptance is the check of NOTHING IS IMPLEMENTED
  BEFORE IT IS ACCEPTED.
