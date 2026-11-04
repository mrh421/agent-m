---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 0424952aba0c786c67f9775be3fc6302488e27df
  - https://github.com/akmaier/agent-m/pull/1528
date: 2026-10-30 18:32 UTC
---
# Development → Release testing: ITM-1318, the reviewer of an architecture draft receives the whole architecture

**REGISTER**

## Reason

ITM-1318, pull request #1528 into `sprint/team1/128`, passes on `0424952a`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1875-1880).

1. **CI.**
   - **Tests-only commit `77ed4350`:** run 41103093658 (`pull_request`, attempt 1) fails in two jobs. The changed test files
     run in an export of that commit fail exactly two cases, the item's reason:
     - the stated table of `tests/job-catalogue.test.mjs`, whose `review-architecture` row now names `whole-architecture`;
     - TST-8048003 of `tests/job-catalogue-hand-over-instruction.test.mjs`.
     - The fixtures that gain an empty `whole-architecture` pass on the base: a recipe registered and not named is not
       read.
   - **Implementation commit `989b5323`:** run 41103172030 fails in three jobs:
     - `test_architecture_review`'s TST-475001 and `test_correction_loop`'s set-up, `UnknownStrategy whole-architecture`. The
       Acceptance gives both to a participant who did not build the item.
     - TST-1240031 (`checkout-tools-bash`), a known flip.
   - **Head `0424952a`:** run 41104535937.
     - Attempt 1 failed one job, `release-pull-request (4)`. Its one failing case, as the Scrum Master read the log, is
       TST-276901 of `release-itm-276-desktop-shell`, an Electron case that ran past its 32 s.
     - Attempt 2 succeeds: 41 jobs succeed, 17 are skipped, none failed.
     - The item changes nothing of the desktop shell. A test with both outcomes on one commit is flaky (A TEST THAT FLIPS
       ON THE SAME COMMIT IS FLAKY), so CI is green on the head. TST-276901 joins the known flips of the brief.
2. **Only the item's files change.**
   - MOD-job-catalogue: `kinds/review-architecture/kind.md` names `whole-architecture` after `accepted-use-cases`.
     `prompt.md` holds `{{whole-architecture}}` under "The whole architecture as it stands on the default branch", after
     the accepted use cases.
   - developer-sonnet-k's tests-only commit changes the eight test files the Acceptance names:
     - `job-catalogue` (1) and `job-catalogue-hand-over-instruction` (2 cases);
     - `job-runner-prepare` (fixtures and TST-472335's `given`), `job-runner-run`, `job-runner-agents-first`;
     - `spec-changes-whole-spec`.
   - developer-sonnet-l's commit `0424952a` (`Agent-M-Participant`) changes:
     - `release-uc-023-described-change`;
     - `system-uc-023-modify-the-architecture`;
     - `test_architecture_review.py` and `test_correction_loop.py`.
   - No code imports anything new.
3. **It builds the accepted text and the item's Acceptance** (MOD-job-catalogue.md:92; THE ARCHITECTURE'S PARTICIPANTS
   RECEIVE THE WHOLE PROJECT, SPEC.md:1352-1356; A CHANGE ACROSS MODULES IS CHECKED AS A WHOLE, SPEC.md:1382-1385).
   - TST-1318001 (`tests/test_architecture_review.py`) is the case that check names. A change to the two module files
     MOD-sync and MOD-desk sends all six files of the architecture to the reviewer, with MOD-approvals' and
     MOD-spec-changes' own recipes.
     - Known positives in the case: the two changed files of the draft and the SPEC are sent.
     - Counter-proof in the case: with `whole-architecture` taken out of `review-architecture`, none of the six files is
       sent as the architecture holds them.
     - TST-1318001 is free in the history (`team1/128.md`).
   - TST-739209 and 739210 lose their `todo` and pass. Their FINDING sentences go; their bodies and inputs are unchanged.
   - `2-checked-as-a-whole` moves from `FLOW_FINDINGS` to `FLOW_EVIDENCE` with TST-739209. The headers of both UC-023 files
     no longer name UC023-S2.
   - The two Python set-ups register the recipe `whole-architecture`, empty, as the Acceptance asks, and keep what they
     assert.
4. **The point asked about: the prompt's heading.** "The whole architecture as it stands on the default branch" stays.
   - The item asks for "a heading of its own" and states no words. No accepted text gives the words of a prompt's heading.
   - In `review-architecture` the draft stands under "The architecture draft". The longer heading tells the reviewer that
     the other block is the architecture before the change, which "The whole architecture" alone does not.
   - `change-architecture` has no draft under review beside it, so its shorter heading names nothing ambiguous. No change
     is asked.
5. **Shared files, ordered as planned** (`team1/128.md`).
   - `tests/system-uc-023-modify-the-architecture.test.mjs` and `tests/test_architecture_review.py` are shared with #1529
     (ITM-1320). `tests/job-catalogue.test.mjs` is shared with #1531 (ITM-1319).
   - Whichever is merged second takes the other's change by a merge commit of its writer. That commit changes no
     expectation, and CI is read again on it.
6. **Counter-proofs, planted on the head in an export, each restored after.**
   - `whole-architecture` taken out of `kind.md`:
     - TST-739209, TST-739210 and three cases of `job-catalogue` fail, the stated table among them;
     - TST-1318001 fails.
   - Unplanted, `test_architecture_review` and `test_correction_loop` pass, as do the eight test files the Acceptance
     names.
7. **MOD-test-document's reader,** over every changed file: 0 findings in each.
   - `test_architecture_review.py` gives 2 declarations. `release-uc-023-described-change` gives 11 and
     `system-uc-023-modify-the-architecture` gives 13.
   - `job-catalogue` gives 9, `job-catalogue-hand-over-instruction` 3, `job-runner-prepare` 9, `job-runner-run` 12,
     `job-runner-agents-first` 5, `spec-changes-whole-spec` 4 and `test_correction_loop.py` 8.
   - Each header names its modules one per line.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
8. **Reads, against the planning count** (`team1/128.md`): the reviewer's destination gains one part per architecture
   file, read from the job's snapshot. No page request is added.

## Noted

- developer-sonnet-k's first report lacked the reads in full. The Scrum Master returned it. The Developer then read the
  SPEC, chapters 9, 11, 12 and 13 and MOD-job-catalogue in full, and found no change needed.
- TST-276901 (`release-itm-276-desktop-shell`), an Electron case past its 32 s, is a known flip from here on.
