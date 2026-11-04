---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - 85a7abefc5b5eaa850acd0bf8b1fd5a04cc0126c
  - https://github.com/akmaier/agent-m/pull/1422
  - docs/backlog/ITM-1265-the-schedule-shows-the-counts-of-the-tests-stored-for-its-commit.md@a34e3bfa0
date: 2026-10-29 09:09 UTC
---
# Development → Release testing: ITM-1265, the schedule shows the counts of the tests stored for its commit

**REGISTER**

## Reason

ITM-1265, pull request #1422 into `sprint/team1/114`, is returned on `85a7abef`, its head when this was decided.
- CI is green, and the code does what the Outcome says.
- One defect is in the tests: the removed test file took with it the only guard of a behaviour the route keeps. The item
  ordered the removal, so the cause lies in my planning, not with the developer.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **What `tests/test-pages-schedule-stored-tests.test.mjs` guarded, and what guards it now.**
   - It held one case, TST-1119002 (MOD-test-pages, guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-027). Two
     parts of it still hold:
     - the counts are those of the test files;
     - "all 130 test files are told to the snapshot in one `readMany` before the first of them is read".
   - It also checked that no facts file is asked for. That part goes with `storedFacts`, as the Acceptance says.
   - **The counts:** TST-1265006 guards them where no view is stored.
   - **The batches: nothing guards them now.**
     - The route keeps the read (`src/test-pages/schedule.mjs:94`, `await snapshot.readMany?.(paths)`), and
       MOD-test-pages.md:123 keeps "counted from the test files where the repository stores none".
     - TST-1265006 asserts only that both files are read, whether in a batch or each by itself (`testFileReads`).
     - No other test of the route `schedule` asks for a batch. The Check of A PAGE LOAD READS THE REPOSITORY IN BATCHES
       counts the start page, `#arc`, `#spec` and `#backlog` (SPEC.md:688-691), not `#schedule`.
   - **The mend is possible as the code stands. I ran it on `85a7abef`:**
     - TST-1265006 with two assertions added passes: both test files stand in `srv.batches`, and `srv.requests` holds no
       `file tests/…`.
     - With `await snapshot.readMany?.(paths)` taken out of `schedule.mjs`, it fails (2 pass, 1 fail).
     - Restored, it passes.
   - **For developer-opus-e, on #1422, with no force-push:** one commit of its own, changing only TST-1265006:
     - its `guards:` names A PAGE LOAD READS THE REPOSITORY IN BATCHES besides THE TEST SCHEDULE IS DECLARED PER
       PRODUCT and UC-027;
     - its `expect:` adds "both test files are read in a batch, and none by itself";
     - it holds the two assertions.
     - The pull request records the planted fault above as its counter-proof (A NEW TEST IS SHOWN TO FAIL ON A PLANTED
       FAULT, SPEC.md:1527-1530).
     - It strengthens an expectation of behaviour that is built. So it is green, and needs no red commit.

## What holds, to be checked again on the mended head

1. **CI is green.** Run 40846294529, `pull_request`, on `85a7abef` passes 38 of 38 pull-request jobs.
2. **Red first, in two tests-only commits.**
   - `576e75ee` is red in run 40841777690, in 15 jobs. The jobs that hit the npm registry fault are ITM-1306.
   - `3af77846` is red in run 40843468480, in 7 jobs, with no registry fault. Exactly these cases fail:
     - TST-1265001, 002, 004 and 005;
     - TST-940004 and TST-1117009;
     - the cases of `progress-measures-publish-views` and `-build-and-waits`;
     - `onMainChanged … once` (`workflow-entries-main-changed`);
     - TST-684002 and 005 (`main-page-root-entry`).
   - TST-1265006 and TST-940005/010 do not fail there. They hold already, or, for 940005/010, they newly hold a file the
     code does not write yet.
   - **TST-1117009 in `3af77846`.** It is the same change as the others: the schedule's file added to its list of paths
     (`progress-measures-product-facts.test.mjs:991`). Its counter-proof still asserts `<commit>.json` and `latest.json`.
     It is red there, and the implementation commit makes it green. A second tests-only commit instead of an amend
     follows the brief, which forbids force-pushes.
   - The implementation commit `ed988c7c` changes no test.
     - In its pull-request run 40846097800, only TST-1260402 and 403 fail (release shard 6).
     - These are the release test's expectations, which `85a7abef` changes.
     - The ✖ of "UC-042 1a" there is a `todo` (FINDING R3), not a failure.
3. **Each test of another module changes as the Acceptance names it, and only by the schedule's file.**
   - `main-page-root-entry.test.mjs:39` (MOD-main-page): the sorted list of `cachedContext` gains `<head>.schedule.json.gz`.
   - `workflow-entries-main-changed.test.mjs:298` (MOD-workflow-entries): the files `onMainChanged` adds gain it.
   - `release-itm-1260-stored-views.test.mjs` (MOD-progress-measures, level `release`) is changed in `85a7abef` by
     developer-sonnet-l, who wrote no code of this item:
     - TST-1260401 (`:265`) is unchanged; it checks with `includes` and so needs no change;
     - TST-1260402 (`:290`, `:297`) adds SCHEDULE to the files written;
     - TST-1260403 adds SCHEDULE to the files the branch holds, and its title says "all four".
     - **TST-1260403 is not among the lines the Acceptance names** (`:306`, `:310-311` on the sprint branch). Its
       change is of the kind the Acceptance allows ("only to add `<commit>.schedule.json.gz`"), in the file it names,
       and its expectation is unchanged: `written: false`, no commit, and `latest.json` as it was. The line list
       of my planning missed it.
   - `progress-measures-publish-views`, `-product-facts` and `-build-and-waits` name MOD-progress-measures, a module of
     the item.
   - No code of MOD-main-page or MOD-workflow-entries changes.
4. **No counter-proof is weakened.** Every changed assertion adds the schedule's file, to a list of files written or
   held. The planted faults of TST-1260402 and 403 stand as written.
5. **The code is the accepted text, within the Uses.**
   - `scheduleView` gives `{ commit, counts }` (MOD-progress-measures.md:297-303).
   - `publishOverview` adds `<commit>.schedule.json.gz` in the same commit.
   - `storedView` takes the page `schedule` (:328).
   - `schedule.mjs` imports `storedView`, which MOD-test-pages' Uses name (MOD-test-pages.md:36), and draws the as-of
     line (:120-123).
6. **The readings hold.**
   - **`written` is `false` only when all four files are held.** `scheduleView`'s entry puts the schedule's file in
     the same commit "as the other views" (:301-303). `publishOverview`'s entry (:304-308) names three, and the
     Acceptance takes the reading.
   - **An unknown level counts in no row**, as the Acceptance's counter-proof asks.
   - **`scheduleView` throws a `TypeError` when `facts.tests` is not read.** The interface gives "the counts of
     `facts.tests`", and there are none to count when they were not read; zeros would show a count that was never made.
     Its one caller, `publishOverview`, is given facts of the scope `all` (:307), which reads them.
7. **The reader.** On `85a7abef`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - The new and changed files give, all with 0 findings:
     - `progress-measures-schedule-view` 2, `test-pages-schedule-stored-view` 3;
     - `-publish-views` 2, `-product-facts` 39, `-build-and-waits` 7;
     - `main-page-root-entry` 4, `workflow-entries-main-changed` 10;
     - `release-itm-1260-stored-views` 17.

## Noted

- **The developer's point: the counting exists twice, and that is a defect of the accepted texts.**
  - MOD-progress-measures counts `facts.tests` in `scheduleView` (:297-303).
  - MOD-test-pages has the route count the test files itself where no view is stored (:120-123).
  - Its Uses name `storedView` and not `scheduleView` (:36). So the route cannot call the one rule without a change of
    its module file.
  - The two copies already differ: the route counts a declaration of the level `paid` under `paid`, while `scheduleView`
    counts it in no row.
  - This is against AGENTS.md §2 principle 2 and DON'T REPEAT YOURSELF (SPEC.md:1250-1252). It is no condition of this
    item, whose Acceptance asks for exactly this fallback.
  - It is registered as **ITM-1307**, which waits for a draft of MOD-test-pages for akmaier.
