---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 068a8cf74e6bbd15b8606bc9f055c18a0f1adf71
  - https://github.com/akmaier/agent-m/pull/1536
date: 2026-10-30 19:30 UTC
---
# Release testing → Sprint review: sprint 128's release tests

**REGISTER**

## Reason

The release tests of sprint 128's four items pass on `sprint/team1/128` at `068a8cf7`, the head of #1536.

The condition is "written by a participant other than the implementer of the behaviour they test, green on the sprint
branch" (`docs/process-models/scrum-wip.md:54`).

1. **Written by a participant other than the implementer.**

   | Item | Implementer | Release test | Pull request |
   |---|---|---|---|
   | ITM-1316 | developer-sonnet-j | `tests/release-itm-1316-done-item-marks.test.mjs`, TST-1316201 to 1316203 | #1532 |
   | ITM-1318 | developer-sonnet-k | `tests/release-itm-1318-reviewer-whole-architecture.test.mjs`, TST-1318101 to 1318103 | #1533 |
   | ITM-1320 | developer-opus-f | `tests/release-itm-1320-bar-self-review.test.mjs`, TST-1320101 to 1320103 | #1534 |
   | ITM-1319 | developer-opus-e | `tests/release-itm-1319-accepting-adds-items.test.mjs`, TST-1319201 to 1319203; `tests/release-itm-1319-page-reads.test.mjs`, TST-1319204 | #1535 |

   - Each release commit is developer-sonnet-l's (`Agent-M-Participant`, model claude-sonnet-5-5): `ef80a881`, `35f83c6a`,
     `83b10153` and `65b879c7`. Each adds its test files and nothing else.
   - developer-sonnet-l implemented none of the four. Of the commits since the sprint was cut (`cb5f0eed`), every one
     that changes a file under `src/` is the implementer's of its item. developer-sonnet-l's six commits, the two on #1528
     and #1529 among them, change only files under `tests/`.
2. **Green on the sprint branch.**
   - Run 41113947394 of #1536 on `068a8cf7` (`pull_request`, attempt 1): 41 jobs succeed, 17 are skipped, none failed.
   - Its result record (`test-results`, `runs/02e72e3f…/20261030-1919-pull-request-6669.md`) gives all 13 release cases
     `passed`, beside the items' unit and component cases and TST-739005, 739011, 739209 and 739210. Its four `failed`
     rows are `todo` cases that name a finding: TST-377011, 418121, 703008 and 739013 (UC023-S4, which ITM-1319 leaves
     as it is).
   - Each release pull request was green before its merge: #1532 in run 41110387530, #1533 in 41110396079, #1534 in
     41110401212, #1535 in 41111323097.
   - #1535's updated head `08e52372` was green in run 41112226901 on attempt 3. Attempt 1 failed only the job
     `agent-m records`, whose log names "Unable to download and extract artifact: Artifact download failed after 5
     retries"; every test job succeeded. Attempt 2 was cancelled. No test had two outcomes there.
3. **No test identifier repeats among the sprint's.** Read until ITM-1321 is built (`team1/128.md`, brief).
   - MOD-test-document's `testDeclarations`, over every test file of an export of `068a8cf7`: 1,485 files, 5,805
     declarations. None of TST-1316nnn, 1318nnn, 1319nnn or 1320nnn is declared twice.
   - Known positive: the same reading of `1f663e6d` finds TST-1187101 to 1187104 twice each, sprint 127's repeat.
   - Each new release identifier is first named by its own release commit (`git log --all -S`, oldest first). The same
     search for TST-1187201 gives `7d02fee9`, its known positive.
4. **MOD-test-document's reader,** at `068a8cf7`, 0 findings in each:
   - ITM-1316's file: 3 declarations, `release`, MOD-implementation-pages.
   - ITM-1318's file: 3 declarations, `release`, MOD-job-catalogue.
   - ITM-1320's file: 3 declarations, `release`, MOD-prompt-bar.
   - ITM-1319's two files: 3 and 1 declarations, `release`, MOD-review-pages.
   - Each header names one module and the level `release`.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
5. **The three points asked about #1535.**
   - **"Under the person's account" read as "through the product's host."** The reading holds.
     - UC-008 step 6 asks for the items "under the reviewer's account" (`docs/use-cases/UC-008-review-and-accept-a-use-case.md:49-51`).
       Its own diagram writes that commit as "backlog items of the modules it changes (reviewer's token)".
     - The fixture host keeps no token and no account, so no fixture can show one. The SPEC's own check,
       `tests/test_backlog_from_acceptance.py`, takes the same reading: "every commit of the page goes through with the
       token the person stored for the product, so that a commit it records is made under the accepting person's
       account".
     - The case asserts the product's host. The instance's host has no `commitFiles`, so a write there fails it, as
       #1535 states. The reading is named in the pull request (AGENTS.md §6a.6).
   - **The job's own commits between the approval and the items are not asserted.** That holds.
     - UC-008 step 6 and the item ask for the approval first and the items after it in the same click, and no item
       before the approval. TST-1319201 asserts both.
     - A JOB IS RECORDED IN ITS PRODUCT REPOSITORY (SPEC.md:1808-1811) asks for the job's record. So its commits are
       meant to stand between them, and that requirement's own check guards them.
   - ***Accept ticked* and *Accept all N shown* are not covered.** This does not stop the gate. The condition asks who
     wrote the release tests and that they are green, not which flows they walk.
     - The gap is real. The code runs one job per recorded use case on all three paths
       (`src/review-pages/flow.mjs:297-303`, `:442-447`, `:648-653`). A search of the tests at `068a8cf7` finds no case
       that clicks *Accept ticked* or *Accept all N shown* in a product that declares a pulled model.
       - TST-1319002 draws the two notes and does not click.
       - `load-per-view`'s *Accept all 3 shown* runs in a product without a declaration.
       - Known positive of the search: the single file's click is found in TST-1319201 and in
         `test_backlog_from_acceptance.py`.
     - **Ruled: a new item, for the Product Owner.** It is a release case of MOD-review-pages: *Accept ticked* and
       *Accept all N shown*, each over two use cases in a pulled product, run one job for each use case recorded and
       commit its items. It is written by a participant who implemented none of ITM-1319, and is registered with the
       close.
6. **The merge commit `82cf005b3` on #1529 carries no `Agent-M-` trailer.** It does not matter for this gate.
   - It is the merge of the sprint branch into #1529 that the gate of ITM-1320 ordered
     (`docs/gates/20261030-1832-development-release-testing-b1320.md`, point 5). It resolves two conflicts:
     `tests/system-uc-023-modify-the-architecture.test.mjs` and `tests/test_architecture_review.py`.
   - Its `git show --cc` shows what the merge wrote itself:
     - In the Python file, nothing. Every line comes from one parent: TST-1320005 from `7dce0026` (developer-opus-f)
       and TST-1318001 from `0424952a` (developer-sonnet-l).
     - In the system test, both parents' entries are kept: `2-reviewing-participant` and `2-checked-as-a-whole` move
       to `FLOW_EVIDENCE`.
     - The one line that neither parent holds is the header comment that now names UC023-S4 alone.
     - No declaration, no input and no expected result is written by it. CI was green on it (run 41110374422).
   - It touches no release test, so the authorship this condition reads stands on the trailered commits above.
   - The commit names no participant. developer-sonnet-l names it as "the merge head of #1529 (`82cf005b3`)" in #1534.
   - It is not rewritten: #1529 is merged, and the sprint branch's history is not rewritten.
   - Five other merges since the cut carry no trailer either: GitHub's branch updates `c4f7c76c`, `151d0444`, `3deb1bb8`
     and `08e52372`, and `c712487e` on #1531. Each has an empty `git show --cc` and writes nothing of its own.
   - Noted for the close (below).

## Noted

- **For the close:** a merge commit that resolves a conflict writes text, and `82cf005b3` names nobody who wrote it.
  Whether a merge that resolves a conflict carries its writer's trailer is for the team's retrospective to decide. This
  record does not write that agreement.
- **A repeat outside the sprint, found by the reading in point 3:** TST-1290001 and TST-1290002 are each declared in
  `tests/site-frame-preloads.test.mjs` (since `66afb81f`, 2026-10-24) and in
  `tests/site-frame-schema-form-missing-key.test.mjs` (ITM-1290, since `6b6d0a01`). The sprint changes neither file.
  - ITM-1321's Acceptance asks that "the repository's own tests at the item's head declare no identifier twice".
  - **Ruled: a new item, for the Product Owner.** ITM-1290's two cases take identifiers of their own, searched in the
    history first. It is registered with the close.
- TST-276901 (`release-itm-276-desktop-shell`) is a known flip since the gate of ITM-1318. It did not fail in the runs
  read here.
- akmaier's open point on ITM-1317 stays open. No release test of this sprint asserts either answer.
