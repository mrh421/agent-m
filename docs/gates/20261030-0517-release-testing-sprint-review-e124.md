---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - f2430a50e96afe3d90ce4bae7b5c538c67650a46
  - https://github.com/akmaier/agent-m/pull/1499
  - tests/release-itm-1190-jobs-page-waiting.test.mjs
  - tests/release-itm-1280-jobs-list-batches.test.mjs
  - tests/release-itm-1277-library-fetch-logs.test.mjs
  - tests/release-itm-1292-closed-issue-noted-once.test.mjs
  - tests/release-itm-1111-replies-open-through-the-frame.test.mjs
date: 2026-10-30 05:17 UTC
---
# Release testing → Sprint review: team 1's sprint 124

**REGISTER**

## Reason

The release tests of sprint 124's items pass on `sprint/team1/124` at `f2430a50`, the head of #1499 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541).

1. **Green on the sprint branch.** Run 41006847738 on `f2430a50` (`pull_request`):
   - Attempt 1 was cancelled in `component-pull-request (2)` alone. There `tests/desktop-shell.test.mjs` stopped after
     TST-276006 until the job's limit of two minutes ended it. The sprint changes no file of MOD-desktop-shell: none of
     its 27 changed files names `desktop`, a search that finds its four `tests/main-page-*` files.
   - Attempt 2, the same commit, succeeds: 41 jobs succeed, 17 are skipped, none failed. The file passed there.
   - So `desktop-shell` has two outcomes on one commit, and is flaky (A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY,
     SPEC.md:1587-1590), not a failure of this increment.
   The release tests' own pull requests were green on their heads, and all four are merged into the sprint branch:
   - #1495 (ITM-1292) on `bc404571`: run 41005805635, attempt 1;
   - #1496 (ITM-1277) on `b75306ff`: run 41005833493, attempt 2. Attempt 1 failed only in `unit-pull-request (4)`, and
     there only in `tests/review-pages-release-limitations.test.mjs`, the known flip ITM-1287 (`team1/124.md`, the brief);
   - #1497 (ITM-1111) on `00502983`: run 41005851473, attempt 1;
   - #1498 (ITM-1190) on `b255fc6e`: run 41005861011, attempt 1.
   - `330a6d7b` on #1494, developer-sonnet-l's change of TST-1280305 and TST-1280306: run 41004124294, green on attempt 2
     (gate `20261030-0502-development-release-testing-d1190.md`).
2. **Written by a participant who implemented none of the behaviour they test.** Every release commit carries
   `Agent-M-Participant: developer-sonnet-l`, who implemented none of the four items:
   - ITM-1190 was built by developer-opus-e (`f1c0985e`, `8174fd0d`);
   - ITM-1277 by developer-sonnet-j (`5de0ebf7`, `64e4c841`);
   - ITM-1292 by developer-opus-f (`dd4c2131`, `a16757c0`);
   - ITM-1111 by developer-sonnet-k (`2b9d3aac`, `f4102347`).
3. **The release tests of each item.**
   - **ITM-1190: TST-1190301 to TST-1190305** (`tests/release-itm-1190-jobs-page-waiting.test.mjs`), and TST-1280305 and
     TST-1280306 as `330a6d7b` changed them. Over the fake GitHub of ITM-1280's release tests and the real routes, they
     walk from `home` to `jobs`:
     - `home` draws the button *Jobs* and no list of what waits; *Jobs* calls `go("jobs")`;
     - `jobs` draws what waits above the list, for the instance and each kept product, each *Open* calling `go` with the
       route that decides it;
     - the reads of `overview-cache` and the pull-request listings are counted per repository, `home` reading what it
       read before;
     - a refused repository adds no item and is named once.
   - **ITM-1277: TST-1277301 to TST-1277305** (`tests/release-itm-1277-library-fetch-logs.test.mjs`). The library is
     opened through the frame at `#library`, over the real GitHub host. The logs read are counted from the requests the
     fake received: none while nothing waits, then 1, 2, 3 and 6 in the cases of MOD-settings-pages.md:222-225.
   - **ITM-1292: TST-1292301 to TST-1292304** (`tests/release-itm-1292-closed-issue-noted-once.test.mjs`). The two writer
     jobs of the files `jobWorkflowFiles` generates, on GitHub and on GitLab, run the real `onPullRequestClosed` for one
     merge. Each issue ends closed with one note, and the second job writes nothing. A later merge request is noted once
     beside the first one's note.
   - **ITM-1111: TST-1111301 to TST-1111303** (`tests/release-itm-1111-replies-open-through-the-frame.test.mjs`). Through
     `startPage`, each *Open* sets the address the frame writes, and the frame then shows that issue. No element holds an
     address `#replies…`, and the address opens the same issue in a second session.
4. **TST-1292303's reading holds.**
   - The case: an issue a person reopened after the first job closed it with the note is noted again and closed again by
     the second job; an issue still closed is left as it is.
   - The texts:
     - `closeWithLinks` is "the comment `closed-with` and the issue closed; run when the pull request … is merged"
       (MOD-issue-handling.md:85-87);
     - UC-012 step 5 ends "the issue is closed with a link to the fix" (UC-012:57-58);
     - ITM-1292 leaves alone only "an issue already closed with links to that pull request" (its Outcome).
   - A reopened issue is not closed. So the accepted text's comment and close apply to it, and the item's exception does
     not. The other reading, that the note alone decides, adds a condition no text holds. It would also end a run of
     `closeWithLinks` with the issue open, against MOD-issue-handling.md:86.
   - A CLOSED ISSUE IS REOPENED ONLY BY A PERSON (SPEC.md:2159-2161) is about a closed issue returning to open. Here the
     person reopened it, and the closing that follows is the one UC-012 asks for on the merge.
   - The second note on that issue is the accepted behaviour for an issue that is not closed. "Noting once" is the item's
     stricter rule for a closed one only (ITM-1292, "The reading of the accepted text").
   - It also pins the half of the check that my Development gate of #1493 found unpinned. Counter-proof on the head:
     with `current.state === "closed" &&` taken out of `src/issue-handling/classes.mjs:53`, the file gives 3 pass and
     TST-1292303 fails; restored, 4 of 4.
5. **MOD-test-document's reader on the head:**
   - `release-itm-1190-jobs-page-waiting`: 5 declarations, 0 findings;
   - `release-itm-1280-jobs-list-batches`: 7 declarations, 0 findings;
   - `release-itm-1277-library-fetch-logs`: 5 declarations, 0 findings;
   - `release-itm-1292-closed-issue-noted-once`: 4 declarations, 0 findings;
   - `release-itm-1111-replies-open-through-the-frame`: 3 declarations, 0 findings;
   - each header gives level `release` and no finding;
   - the control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
6. **Locally on the head,** in an export of `f2430a50`: the five release files and `tests/test-document-one-line.test.mjs`
   give 26 pass, 0 fail.
7. **Nothing of the MOD-approvals draft is relied on.** No release test names MOD-approvals, and no file of the sprint
   lies under `src/approvals/` or `docs/architecture/`.

## Noted

- `tests/desktop-shell.test.mjs` stopped after TST-276006 in attempt 1 of run 41006847738 and passed in attempt 2. It is
  not among the sprint's known flips. For the close's feedback.
- Since the sprint's planning, `main` has gained `77495fd0f`, "accept MOD-approvals (Agent M dashboard)". The sprint
  changes nothing there. Whether #1499 still merges cleanly is read at the Retrospective → Sprint planning gate.
- `testHeader` gives one module for a line `Module: A; B; C`, the first. Each of the five files names its item's module
  first, and the control reads the same, so no finding stands here.
