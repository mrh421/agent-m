---
id: ITM-1320
title: A change described in the prompt bar is reviewed by its own model
level: module
realises:
  - UC-023
  - NO REVIEWER IS THE DRAFTER
  - AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT
modules:
  - MOD-prompt-bar
  - MOD-job-runner
builds_on:
  - ITM-739
tests:
  - unit
origin:
  - po-opus-c's gate of ITM-739 (PR #1510), docs/gates/20261030-0753-development-release-testing-c739.md, finding UC023-S3; akmaier's ruling ("The same model"), accepted as the change of NO REVIEWER IS THE DRAFTER (queue docs/spec-freigaben/2026-10-30_a-change-described-in-the-prompt-bar-is-reviewed-by-its-own-model, f2e62ba3c) and in MOD-prompt-bar and MOD-job-runner (1b539d0fe)
---
# ITM-1320 A change described in the prompt bar is reviewed by its own model

**REGISTER**

## Outcome

The SPEC, §11: "The reviewing participant of an architecture draft, other than one of a change described in the prompt
bar, is not the participant that drafted it and does not use its model." Its check, `tests/test_architecture_review.py`,
names the counter-proof "and so is the drafter of a change described in the prompt bar".

The accepted modules state how. Neither is built yet.
- **MOD-prompt-bar** (MOD-prompt-bar.md:235-237) prepares a hand-over that runs in this tab with `prepareJob` for its
  kind. For a kind with reviewers, it adds "the participant itself as its one reviewer and `selfReview` set, since the
  change is described in the prompt bar".
  - Today `src/prompt-bar/hand-over.mjs:96` prepares every such hand-over with `reviewers: []`.
  - So the reviewer kind of `change-architecture` (`reviewers: 1`) never runs.
- **MOD-job-runner** (MOD-job-runner.md:298-305): `prepareJob` takes `selfReview?: boolean` in its choice. With it,
  `reviewers` is the drafter alone, and that reviewer is not asked to differ. Only MOD-prompt-bar sets it.
  - Today `src/job-runner/prepare.mjs:138-141` asks every reviewer to differ from the drafter.
  - `prepareJob` takes no `selfReview`.

This is UC-023's finding UC023-S3 (TST-739011, `todo`): *Describe the change* from the bar prepares the change with no
reviewer, so the change is not checked before the author sees it.

UC-023 says the same, accepted at its blob `b36d4f55` (`cebe3653a`).
- Its reviewing participant is, "for a change described in the prompt bar, the prompt bar's own participant".
- Its step 2 says "in the prompt bar, the bar's participant derives and reviews the change".

## Acceptance

- **MOD-job-runner:** `prepareJob(kind, context, { drafter, reviewers, limit?, selfReview? })`.
  - With `selfReview` and the drafter as the one reviewer, it gives no finding under NO REVIEWER IS THE DRAFTER.
  - Without `selfReview`, a reviewer that is the drafter or uses its model is refused as today.
  - With `selfReview` and any reviewer other than the drafter, or more than one, it is refused. `reviewers` is then
    "the drafter alone".
  - The types and errors are otherwise unchanged.
- **MOD-prompt-bar:** a hand-over that runs in this tab, of a kind with reviewers, is prepared with the participant itself
  as its one reviewer and `selfReview` set.
  - The reviewer's part runs before the person sees the draft.
  - A kind without reviewers, and every message of `converse`, is prepared as today, with `reviewers: []`.
- **Unit cases of each, in the tests-only commit, red there:**
  - `prepareJob` with `selfReview`, with its counter-proof: the same choice without `selfReview` is refused.
  - The bar's hand-over of `change-architecture` prepared with the participant as its reviewer. Its counter-proof: a
    hand-over of a kind without reviewers names none.
- **`tests/test_architecture_review.py`** gains the counter-proof case the SPEC's check names: "and so is the drafter of a
  change described in the prompt bar".
  - The drafter, prepared as its own reviewer with `selfReview`, gives no blocking error.
  - Its existing case keeps its three reviewers and what it asserts: the drafter itself and a same-model reviewer each
    give one blocking error, and another model gives none.
- **TST-739011** (`tests/system-uc-023-modify-the-architecture.test.mjs`) loses its `todo` and passes.
  - Its expectation follows the accepted text: the deriving participant is asked again, as the reviewer of
    `review-architecture`, before the author sees the draft. No second participant is asked.
  - Its known positive stays: the drafter received the instruction.
  - TST-739001's `FLOW_FINDINGS` entry `2-reviewing-participant` moves to `FLOW_EVIDENCE` with TST-739011 as its
    evidence. Its passage becomes UC-023 2's "in the prompt bar, the bar's participant derives and reviews the change".
  - These are changed on the item's branch, in a commit of their own, by a participant who implemented none of this
    item.
- **Shared file.** `tests/test_architecture_review.py` is also changed by ITM-1318. Whichever of the two is merged
  second makes its change on top of the other's.
- **Tests the change moves,** from the planning run below: TST-739005
  (`tests/system-uc-023-modify-the-architecture.test.mjs`, UC-023 2a) counts the endpoint's requests of *Describe the
  change*, 2 on the base. With the reviewer's part it is asked as the reviewer too, and the count is 7. Its count follows
  the accepted text, and its known positive stays. It is changed in the same commit as TST-739011, by the same
  participant.
- The first commit holds only the tests, and CI is red on it. No stub is committed.

## The planning run (sprint team1/128)

A stand-in:
- `prepareJob` with `selfReview` asks no reviewer to differ, and gives a blocking finding under NO REVIEWER IS THE
  DRAFTER when `reviewers` is not the drafter alone.
- `prepareHandOver` of `src/prompt-bar/send.mjs` reads the kind with `kindOf`, which MOD-prompt-bar's Uses name. For a
  kind with a reviewer it prepares `{ drafter, reviewers: [drafter], selfReview: true }`; for any other kind and for
  `converse`, `reviewers: []` as today.

On `main` at `2af740feb`, in an export, every test file of the repository but the six that hang on the planning machine:
1,008 files, 6,316 Node cases. The same files were run without the change.
- One Node case fails only with it, TST-739005, above.
- No Python check moves. `tests/test_architecture_review.py`, `tests/prompt-bar-hand-over.test.mjs`,
  `tests/prompt-bar-one-kind.test.mjs` and `tests/job-runner-prepare.test.mjs` pass unchanged.
- TST-739011 still fails as `todo`: its expectation changes with this item, as above.
- Of the six files that hang there, `system-uc-037-connect-mailbox` draws the bar. It hands nothing over, and it is read
  on CI.
