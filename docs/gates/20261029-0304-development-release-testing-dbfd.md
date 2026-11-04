---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 0eced1e22d4587813e1bd4095edbd0678b8cc08a
  - https://github.com/akmaier/agent-m/pull/1393
  - docs/backlog/ITM-1273-a-spec-entry-s-page-and-a-requirement-s-editor-read-their-own-queue-and-the-waiting-ones.md@15164331e
date: 2026-10-29 03:04 UTC
---
# Development → Release testing: ITM-1273, a SPEC entry's page and a requirement's editor read their own queue and the waiting ones

**REGISTER**

## Reason

ITM-1273, pull request #1393 into `sprint/team1/111`, passes on `0eced1e2`, its head when this was decided. The item is
read as it stands on `main` at `15164331e`: it names MOD-review-pages, MOD-spec-changes and MOD-site-frame.

The Definition of Done is the default (SPEC.md:1870-1873), with AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES
(SPEC.md:1478-1481).

1. **CI is green.** Run 40809452667, `pull_request`, on `0eced1e2` passes 38 of 38 pull-request jobs.
2. **Red first.** `f358d19e` adds only `tests/review-pages-entry-own-queue.test.mjs` and
   `tests/spec-changes-queue-at.test.mjs`. Run 40805459877 fails only their cases, TST-1273101 to 103 and TST-1273001 and
   002 (component shard 8, job 123223272807; unit shard 2, job 123223273155). No test that existed before failed.
3. **Only its modules change.**
   - Code: under `src/review-pages/` and `src/spec-changes/`.
   - `tests/app-harness.mjs` (MOD-site-frame) changes only as the Acceptance allows: a read without a token of a
     branch's file the fake does not hold is answered 404, as GitHub's raw host answers it (`github.mjs:407-408`), and no
     longer 500.
   - With that, `tests/dashboard-review-flows.test.mjs` and `tests/release-sprint-01-dashboard-app.test.mjs` pass
     unedited.
   - The other changed tests name MOD-review-pages in their headers: `system-uc-006-batched-reads`,
     `review-pages-read-problem` and `system-uc-006-instance-register-batch`.
4. **The release test is changed by a participant who implemented none of the item** (RELEASE TESTS ARE NOT WRITTEN BY
   THE IMPLEMENTER, SPEC.md:1537-1541; the item's Acceptance).
   - `0eced1e2` is developer-sonnet-l's, a commit of its own, touching only `tests/release-uc-006-batched-reads.test.mjs`.
   - TST-479201 now allows exactly `[<head>.json, latest.json]` from `overview-cache`, and at most 7 other requests.
   - Every other commit of the item is developer-opus-e's.
5. **The counts rise by the two overview reads only, where no overview is stored.** That is the reading of sprint 111's
   note (`team1/111.md`, "ITM-1273's stop"). `waitingQueues` gives it (MOD-progress-measures.md:322-327), and the
   Acceptance keeps "every queue as today" for that case.
6. **The new tests name their requirement and module:** TST-1273101 to 103 on MOD-review-pages and TST-1273001 and 002
   on MOD-spec-changes, guarding OPEN PROPOSALS ARE SHOWN IN THE BROWSER and A PAGE LOAD READS THE REPOSITORY IN
   BATCHES, among others.

## Noted

- The new fake answers 404 for every raw read at a branch it does not match, not only for `overview-cache`.
- `review-pages-read-problem` rises from 11 to 14 requests because its own test host keeps no texts. The test's
  comment names that.
