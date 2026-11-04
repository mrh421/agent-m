---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 062c567da8f545a8ef2cb92d2bf2eabf62a6c388
  - https://github.com/akmaier/agent-m/pull/1683
date: 2026-11-01 16:33 UTC
---
# Development → Release testing: ITM-448, #1683, the system and release tests of UC-022

**REGISTER**

## Reason

ITM-448 was written by developer-sonnet-k (`Agent-M-Participant` on `a6d7f58ab`, `54c65cbb0` and `062c567da`). I wrote
none of it.
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41326023436 (`062c567da`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:** `tests/uc-022-harness.mjs`, `tests/system-uc-022-derive-the-architecture.test.mjs` (TST-448201
   to 448232) and `tests/release-uc-022-derive-the-architecture.test.mjs` (TST-448301 to 448339). MOD-test-document reads 71
   declarations with no finding. TST-4482nn and 4483nn had no history (known positive: TST-448001).
4. **Who wrote what it tests.** By `Agent-M-Participant` on `src/`, sonnet-k wrote code of 26 items. I compared them with
   the requirements this file's release cases guard. The overlaps are these:
   - `THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT`, through ITM-1318, which built the reviewer's input. The
     reviewer's input is mapped to sonnet-l's TST-1318102 and 1318103, and this file's case reads the drafter's request
     only.
   - `SEVERAL FILES ARE ACCEPTED IN ONE CLICK`, through ITM-1349, which built the tick for a file read. The case checks the
     records of *Accept all N shown*, not the tick.
   - `EVERY STEP EXPLAINS ITSELF`, through ITM-800 and ITM-1340, which built the progress page. The cases read the
     architecture's pages.
   - UC-022, through ITM-1271, which built a review page reading its job's record. No case asserts a job's notes, the
     links of ITM-1355 or the CI route's record of ITM-1378.

   The reading is the sprint's: the writer has built none of the behaviour a case guards.
5. **The Acceptance holds:** TST-448201 maps UC-022's flow. TST-448301 maps the 73 requirements UC-022 realises: 37 with a
   test check, each with a release case, and 36 guarded at review only, listed in `REVIEW`. The pull request records 61
   planted faults. Every case but the two maps, which have their own faults, and the seven `todo` cases fails on one.

## Findings, ruled

All seven point at a module whose accepted text assigns the route or function. Each is an item, registered in this commit:
- **F1, TST-448229 → ITM-1392 (MOD-review-pages).** `presentDerivation` (`src/review-pages/jobs.mjs:605-635`) never reads
  `outcome.forPerson`. A finding only the author decides is not shown, against UC-022 step 6 and
  `WHAT A PERSON DECIDES IS NOT SENT BACK`.
- **F2 and F3, TST-448230 and 448231 → ITM-1393 (MOD-review-pages), one item for the reuse choice.** The radio buttons have
  no listener (`jobs.mjs:703-725`), and `draftFromEditors` reads the text areas only (:612-615). `candidateChoices`
  (:687-701) offers a library that was not found, which 7a says "is not proposed".
- **F4 and F7, TST-448232 and 448332 → ITM-1394 (MOD-review-pages), one item for the draft's explanations.** The shown
  draft carries no folded explanation. The topics `licence-permits` and `due-diligence`, which 7c asks for, are shown on
  no page.
- **F5, TST-448312 → ITM-1395 (MOD-job-runner).** The correction loop (`src/job-runner/loop.mjs:178-190`) asks the reviewer
  even when its checks find the decision that states the whole architecture missing. `AN ARCHITECTURE IS CHECKED WHEN IT IS
  COMPLETE` says no review starts then. MOD-job-runner's text assigns the loop, "its checks and then its reviewing
  participants", but states no such condition; this is noted for akmaier (the reading of ITM-1061's gate). The reading
  that lets it be built is in the item.
- **F6, TST-448328 → ITM-1396 (MOD-documents).** `documentFindings` gives "for a `noHistory` schema, each mark of history"
  (MOD-documents), but `src/documents/checks.mjs` never calls `historyMarks`. Like ITM-1385, its probe first names every
  repository document that would gain a finding.

## Noted

- A drafted path outside the `ARC-`/`MOD-` convention fails at *Write proposals* with a `TypeError`, and nothing is written.
  No case guards it, and it is not registered now; it is a candidate for the review.

## Readings taken

The pull request and the files' headers name nine readings. Among them: in 3a the other participants stay choosable; in
7b the CI agent is offered without declaring *reach the web*; 10a is left out of *Accept all*. All nine are taken.
