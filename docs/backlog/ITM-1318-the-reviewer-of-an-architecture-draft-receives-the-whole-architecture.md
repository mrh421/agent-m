---
id: ITM-1318
title: The reviewer of an architecture draft receives the whole architecture
level: module
realises:
  - UC-022
  - UC-023
  - THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT
  - A CHANGE ACROSS MODULES IS CHECKED AS A WHOLE
modules:
  - MOD-job-catalogue
builds_on:
  - ITM-739
tests:
  - unit
origin:
  - po-opus-c's gate of ITM-739 (PR #1510), docs/gates/20261030-0753-development-release-testing-c739.md, finding UC023-S2; akmaier's ruling ("draft the one line"), accepted in MOD-job-catalogue with d27b1e408
---
# ITM-1318 The reviewer of an architecture draft receives the whole architecture

**REGISTER**

## Outcome

The accepted table of kinds gives `review-architecture` the recipes `instruction?`, `whole-spec`, `accepted-use-cases`,
`whole-architecture`, `draft`, `chapters-for-architecture` (MOD-job-catalogue.md:92). The kind's file
(`src/job-catalogue/kinds/review-architecture/kind.md`) names no `whole-architecture`, and its prompt (`prompt.md`) has
no place for it. So the reviewer of a change receives the draft, the SPEC and the accepted use cases, and not the files
of the architecture the change leaves as they are: against THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT
(SPEC.md:1352-1356) and A CHANGE ACROSS MODULES IS CHECKED AS A WHOLE (SPEC.md:1382-1385). The release test of UC-023
holds this as the finding UC023-S2 (TST-739209, TST-739210, `todo`).

The recipe exists: MOD-approvals offers it (`src/approvals/strategies.mjs`), and `change-architecture` names it already
(MOD-job-catalogue.md:91). MOD-job-runner composes a reviewer's input from the reviewer kind's recipes, so no other
module changes. For a first derivation (UC-022) the precondition `architecture-ready` leaves no architecture file, and
the recipe gives no part.

With this item, `review-architecture` names `whole-architecture` after `accepted-use-cases`, and its prompt holds
`{{whole-architecture}}` under a heading of its own.

## Acceptance

- The kind's recipe line and the prompt's place, as above.
- The tests that state the kind's recipes give the new list: the table row of `tests/job-catalogue.test.mjs` and the
  expected recipes of `review-architecture` in `tests/job-catalogue-hand-over-instruction.test.mjs`.
- `tests/test_architecture_review.py` gains the case the SPEC names for A CHANGE ACROSS MODULES IS CHECKED AS A WHOLE: a
  change to two module files sends every file of the architecture to the reviewer. Its counter-proof is a planted fault,
  the recipe left out of the kind, under which the files the change leaves as they are are missing.
- TST-739209 and TST-739210 (`tests/release-uc-023-described-change.test.mjs`) lose their `todo` and pass, and
  TST-739001's `FLOW_FINDINGS` entry `2-checked-as-a-whole` moves to `FLOW_EVIDENCE` with TST-739209 as its evidence.
  They are changed on the item's branch, in a commit of their own, by a participant who implemented none of this item.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- **The tests of other modules the change moves,** from the planning run below. Their fixtures register no strategy
  `whole-architecture`, so `prepareJob` of `review-architecture` refuses them. Each gains it, empty for a product
  without an architecture, and keeps what it asserts:
  - MOD-job-runner: `tests/job-runner-prepare.test.mjs` (4 cases, TST-472335 among them),
    `tests/job-runner-run.test.mjs` (2) and `tests/job-runner-agents-first.test.mjs` (1);
  - MOD-spec-changes: `tests/spec-changes-whole-spec.test.mjs` (1);
  - the release checks `tests/test_architecture_review.py`, its case "a reviewer that is the drafter or uses its model
    is refused before anything is sent", and `tests/test_correction_loop.py`, whose class set-up fails. These are
    changed by a participant who implemented none of the item, in the same commit as TST-739209 and 739210.
  - MOD-job-catalogue's own: `tests/job-catalogue.test.mjs` (1) and `tests/job-catalogue-hand-over-instruction.test.mjs`
    (2).
- Only `src/job-catalogue/` and the tests named here change.

## The planning run (sprint team1/128)

A stand-in: `kind.md` names `whole-architecture` after `accepted-use-cases`, and `prompt.md` holds it under "The whole
architecture as it stands on the default branch", after the accepted use cases.

On `main` at `2af740feb`, in an export, every test file of the repository but the six that hang on the planning machine:
1,008 files, 6,316 Node cases. The same files were run without the change.
- 11 Node cases in 6 files, and two Python checks, fail only with the change, as listed above.
- TST-739209 and TST-739210 pass with it, still marked `todo`: their known positive.
- One more case failed in that run, the dpkg case of `tests/test-schedule-dpkg-time.test.mjs`, a timing under the
  parallel load; alone, its 9 cases pass with the change.
- None of the six files that hang there names MOD-job-catalogue, `review-architecture` or `prepareJob`.
- The base's own failures are the same with and without it.
