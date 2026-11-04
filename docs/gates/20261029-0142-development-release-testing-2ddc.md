---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: rejected
on:
  - 1a2d54c5840760b8c55fee7a0324ff177bd21283
  - https://github.com/akmaier/agent-m/pull/1388
date: 2026-10-29 01:42 UTC
---
# Development → Release testing: ITM-1266, a review page reads only the folders it shows of its commit's tree

**REGISTER**

## Reason

ITM-1266, pull request #1388 into `sprint/team1/110`, is returned on `1a2d54c5`, its head when this was decided. CI and
the code hold. The pull request changes tests of three modules the item does not name.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default, SPEC.md:1870-1873. It names "it changes only the job's modules", which is AN
IMPLEMENTATION JOB CHANGES ONLY ITS MODULES (SPEC.md:1478-1481): "changes only code files in the folders of the modules
the job was given, tests that name one of those modules, and the files outside every module that one of those modules'
files names as taken over". A test names its module in its header (EVERY CODE FILE BELONGS TO A MODULE, SPEC.md:1486-1487).

**The defect: three changed tests name none of the item's modules.** ITM-1266 names MOD-repository-hosts,
MOD-site-frame and MOD-review-pages.
- `tests/release-sprint-07-uc-047-notifications.test.mjs:222-223`. Its header names MOD-notifications (`:13`).
- `tests/dashboard-review-flows.test.mjs:136-137`. Its header names MOD-settings-pages (`:8`), and so does the case it
  changes, TST-474002 (`:110`). MOD-review-pages is named only by another case, TST-680207 (`:145`).
- `tests/system-itm-597-spec-traces.test.mjs:94-95`. Its header names MOD-trace-pages (`:6`).

**The changes themselves are right, and needed.**
- GitHub's query of the folders' entries is a read sent as POST to `/graphql`. Each of the three edits changes only a
  fake, or what the test counts as a write, so that it leaves that read out.
- No expected value of the behaviour these tests check changes in them.
- The fix is therefore not in the code. It is in the item: the Product Owner's edit of the open ITM-1266, committed with
  this record, names MOD-notifications, MOD-settings-pages and MOD-trace-pages among its modules. Its Acceptance allows
  only those fakes there, and no code of the three.
- Once that edit is on `main`, this pull request meets the rule as it stands, and nothing in it needs to change.
- The release test of MOD-notifications keeps its writer rule (SPEC.md:1537-1541). developer-opus-e implemented none of
  MOD-notifications, and its expected results are unchanged.

**What holds, read for the next decision.**
1. **CI.** Run 40801015509 on `1a2d54c5` passes 38 of 38 pull-request jobs. So does run 40800542408 on `0156a9eb`,
   before `sprint/team1/110` was merged in.
2. **Red first.** The first commit, `f615893a`, changes only `tests/app-harness.mjs`, `tests/load-per-view.test.mjs` and
   `tests/repository-hosts-snapshot-folders.test.mjs`. Run 40798082332 is red on it, from the logs of its three failing
   jobs:
   - component shard 4 (job 123199369453): the eleven new and rewritten cases of `load-per-view`;
   - unit shard 6 (job 123199369661): the five cases of `repository-hosts-snapshot-folders`;
   - unit shard 2 (job 123199369545): TST-1169002, over the declarations of the new TST-1266101 to 1266108 alone.
   - No test that existed before failed.
3. **The new tests** name MOD-repository-hosts and MOD-site-frame, and guard A PAGE LOAD READS THE REPOSITORY IN
   BATCHES, A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT and A REMOTE INTERFACE NAMES HOW IT FAILS.
4. **`tests/review-page.test.mjs:178-179`** changes a counted expectation, from `tree` 1 to `folders` 1 and `tree` 0.
   That is the change the item asks for, "no `git/trees`" in ITM-1266's Acceptance. Its header names MOD-site-frame. So
   "no expected value of behaviour changed" is not quite so for this file, but the change is the item's own.

## The developer's other points

- **The prompt bar's two files on the instance's page** (`src/site-frame/dashboard-app.mjs`, `BAR_FILES` in
  `foldersOf`). No text gives them.
  - MOD-site-frame.md:180-182 says the frame reads the page's snapshot with the route's folders, "so that its paths are
    the files of those folders". MOD-prompt-bar.md:309 says only that the bar reads the two files.
  - So this is a case of its own on one page, against AGENTS.md §2 principle 5.
  - It is needed because `pagesHost().readSnapshot(ref)` (`dashboard-app.mjs:656-661`) hands a caller that asks for the
    whole tree the load's snapshot, which is narrowed now. Reading the whole tree again instead would read the page's
    tree twice, against A PAGE LOAD READS THE REPOSITORY IN BATCHES.
  - It is no condition of the Definition of Done, and is not a reason for this return. It needs a draft of MOD-site-frame
    for akmaier: which files of the page's snapshot the frame's own parts, such as the prompt bar, add to a route's
    folders.
- **A truncated tree refused as `Unreachable { reason }`** (`src/repository-hosts/github.mjs`, `snapshot`) holds.
  - `Unreachable` is among `readSnapshot`'s failures (MOD-repository-hosts.md:204-205), and its reason names the
    truncation.
  - Noted: the text gives "the entries of all of them in one request". The adapter sends one request more for each
    `BATCH` of paths, and for a folder deeper than `TREE_DEPTH` (6) levels. No route of today names that many or that
    deep.
- **`tests/review-pages-release-limitations.test.mjs` is not shown flaky.**
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY (SPEC.md:1587-1589) asks for both outcomes on one commit.
  - It failed once, "waited for the tag", in run 40799673718 on `2f3238dc` (unit shard 7, job 123204544193). No other
    run of that commit holds its outcome.
  - The test uses a host of its own and passes on `0156a9eb` and on the head. Its wait counts 400 event-loop turns
    (`:119-124`), a likely cause, which a rerun of that job would show.
  - It is an open question, and no reason for this return.
