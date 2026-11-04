---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - fe06a6509a0fd04231a09aa50276a843c329fd8a
  - https://github.com/akmaier/agent-m/pull/1529
date: 2026-10-30 18:32 UTC
---
# Development → Release testing: ITM-1320, a change described in the prompt bar is reviewed by its own model

**REGISTER**

## Reason

ITM-1320, pull request #1529 into `sprint/team1/128`, passes on `fe06a650`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1875-1880).

1. **CI.**
   - **Tests-only commit `7dce0026`:** run 41103476063 (`pull_request`, attempt 1) was cancelled, with two jobs failed.
     Their only failing cases are the item's: TST-1320001 and 1320002 (`tests/job-runner-self-review.test.mjs`) and
     TST-1320003 (`tests/prompt-bar-self-review.test.mjs`).
     - That is the item's reason: `prepareJob` took no `selfReview`, and the bar prepared every hand-over with
       `reviewers: []`.
     - The Python case TST-1320005 stood in a cancelled job. In an export of the head, with `selfReview` planted away, it
       fails (point 6).
   - **Implementation commit `85f42a88`:** run 41104339239 fails in one job, `system-pull-request (5)`, on TST-739005. The
     planning named that case for a participant who did not build the item.
   - **Head `fe06a650`:** run 41105002788 (`pull_request`, attempt 1) succeeds: 41 jobs succeed, 17 are skipped, none
     failed.
2. **Only the item's files change.**
   - MOD-job-runner: `prepare.mjs`. With `selfReview` no reviewer is asked to differ. A choice whose reviewers are not the
     drafter alone gets a blocking finding under NO REVIEWER IS THE DRAFTER.
   - MOD-prompt-bar: `send.mjs`. `prepareHandOver` reads the kind with `kindOf`, which MOD-prompt-bar's Uses name. A kind
     with a reviewer is prepared with `{ reviewers: [participant], selfReview: true }`. A message of `converse` and every
     other kind are prepared with `reviewers: []`, as before.
   - Tests: the two new files, and the counter-proof case TST-1320005 in `tests/test_architecture_review.py` (MOD-job-runner's).
   - `7dce0026` holds only tests and `85f42a88` only code, both developer-opus-f's. `fe06a650` is developer-sonnet-l's
     and changes only `tests/system-uc-023-modify-the-architecture.test.mjs` (`Agent-M-Participant`).
   - No top-level await is added. `prepareHandOver` becomes `async`; it returned a promise before.
3. **It builds the accepted text and the item's Acceptance** (NO REVIEWER IS THE DRAFTER, SPEC.md:1410-1415;
   MOD-job-runner.md:298-305; MOD-prompt-bar.md:235-237; UC-023 2).
   - TST-1320001: with `selfReview` the drafter alone reviews and is not asked to differ. Counter-proof in the case: the
     same choice without it is refused.
   - TST-1320002: with `selfReview`, reviewers other than the drafter alone are refused.
   - TST-1320003 and 1320004: the bar's hand-over of `change-architecture` is prepared with the participant as its one
     reviewer, and nothing blocks it; a kind without reviewers names none.
   - TST-1320005: the drafter prepared as its own reviewer with `selfReview` gives no blocking error. TST-475001 keeps its
     three reviewers and what it asserts.
   - developer-sonnet-l's commit, which the Acceptance gives to a participant who did not build the item:
     - TST-739011 loses its `todo`. It asserts that the bar's own model is asked again as the reviewer, with the draft,
       before the author opens it, and that model-b's endpoint receives no request. Its known positive stays.
     - `2-reviewing-participant` moves to `FLOW_EVIDENCE` with TST-739011, and its passage is UC-023 2's sentence.
     - TST-739005 now asserts 2 requests as the drafter and 2 as the reviewer, where the base asserted 2 in all. It is as
       strict as before: each part is counted exactly. Its finding and draft assertions are unchanged.
     - The planning stand-in counted 7 requests there. Its fixture answered the reviewer's requests with drafts, so the
       loop went on. The changed case answers the reviewer with no finding, as UC-023 2 describes.
4. **The pull request's readings hold.**
   - **Refusal is a blocking finding, not a thrown error.** `prepareJob` names what keeps a job from starting in `blocking`
     (MOD-job-runner.md:298-305: "sends nothing"), and its listed errors are for a kind, a strategy and a recipe. "It is
     refused", in the item, is met as every other refusal of a destination is.
   - **"A kind with reviewers" is `kindOf(kind).reviewer !== null`.** The catalogue states a reviewer kind and its count
     together (`reviewer: review-architecture`, `reviewers: 1`).
   - **The queued route is unchanged.** MOD-prompt-bar.md:235-237 gives `selfReview` to the hand-over "that runs in this
     tab" only.
5. **Shared files, ordered as planned** (`team1/128.md`). #1528 (ITM-1318) also changes
   `tests/system-uc-023-modify-the-architecture.test.mjs` and `tests/test_architecture_review.py`. Whichever of the two
   is merged second takes the other's change by a merge commit of developer-sonnet-l. That commit changes no case's
   expectation, and CI is read again on it.
6. **Counter-proofs, planted on the head in an export, each restored after.**
   - `selfReview` ignored, so the reviewer is asked to differ: TST-1320001 to 1320003 fail, with TST-739003, 739005, 739010
     and 739011, and TST-1320005 fails in the Python check.
   - Other reviewers accepted with `selfReview`: TST-1320002 fails.
   - Every hand-over given a reviewer: TST-1320004 fails, and so does TST-1360002 (a hand-over of `change-requirements`).
   - Unplanted: `test_architecture_review` and `test_correction_loop` pass.
7. **MOD-test-document's reader:**
   - `tests/job-runner-self-review.test.mjs`: 2 declarations, 0 findings, `unit`, MOD-job-runner.
   - `tests/prompt-bar-self-review.test.mjs`: 2 declarations, 0 findings, `unit`, MOD-prompt-bar.
   - `tests/test_architecture_review.py`: 2 declarations, 0 findings.
   - `tests/system-uc-023-modify-the-architecture.test.mjs`: 13 declarations, 0 findings. Its header names four modules,
     one per line.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
8. **Reads and requests, against the planning count** (`team1/128.md`): *Describe the change* now asks the bar's endpoint
   as the reviewer in each round, which TST-739005 counts. A message of `converse` and a kind without reviewers send what
   they sent before (TST-1320004, and the bar's files unchanged). `system-uc-037-connect-mailbox`, which hangs on the
   planning machine, passes in the head's CI run.
