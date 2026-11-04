---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 637c0b31254cb181291301f80d12487769c5db50
  - https://github.com/akmaier/agent-m/pull/1404
date: 2026-10-29 05:47 UTC
---
# Development → Release testing: ITM-1279, Runs reads the records of its two commits and the test files in batches

**REGISTER**

## Reason

ITM-1279, pull request #1404 into `sprint/team1/112`, passes on `637c0b31`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1870-1873), with AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES
(SPEC.md:1478-1481).

1. **CI is green.** Run 40824898373, `pull_request`, on `637c0b31` passes 38 of 38 pull-request jobs.
2. **Red first.**
   - `f9099d02` changes only tests: the new `tests/test-pages-runs-reads.test.mjs`, and the fakes of
     `test-pages-runs`, `test-pages-run-on-commit`, `test-pages-user-checklist` and `uc-028-world.mjs`, each given
     `readMany: async () => {}`.
   - Run 40824550282 fails one job, component shard 5 (job 123284512212), in the two new cases only, TST-1279001 and
     002.
   - The implementation commit `637c0b31` changes only `src/test-pages/runs.mjs`.
3. **Only its module changes.** The code is MOD-test-pages'. Every changed test and helper names MOD-test-pages in its
   header, `tests/uc-028-world.mjs` included. SPEC.md:1486-1487 asks every test helper to name its module there.
   - The helper is shared with `release-uc-028-run-and-review` and `system-uc-028-run-and-review-the-tests`, whose headers
     name "MOD-test-pages; MOD-result-records". Its one change gives the fake snapshot a `readMany` that does nothing,
     and changes no expected result of those tests.
4. **The Outcome is the accepted text.** MOD-test-pages.md:140-142: "`runs/<commit>` reads, of the branch
   `test-results`, only the records of the commit shown and of the last release's commit, through a snapshot of that
   branch narrowed to their folders …, and the test files of the commit in batches (`readMany`)". The code does that, and
   the records go through `readMany` as well.
5. **The reader.** I ran MOD-test-document's `testDeclarations` and `testFindings` on the PR's checkout:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `test-pages-runs-reads`: TST-1279001 and 002, 0 findings.
   - `test-pages-runs`: 17. `test-pages-run-on-commit`: 11. `test-pages-user-checklist`: 6.
   - `release-uc-028-run-and-review`: 13. `system-uc-028-run-and-review-the-tests`: 11.
   - All with 0 findings. `uc-028-world.mjs` is a helper, with no declaration.

## The developer's readings

- **`listTags` inside the `try` holds.** The narrowed read needs the last release's tag before it can name its folder.
  So a failure of the tags now shows the notice of UC-028 2b, "The records cannot be read from the browser — for example
  a private repository without a token" (`UC-028…md:108`). It no longer fails the page.
  - The example the use case gives fails both reads, the tags and the branch.
  - The catch names no host's failure by its own message. That was so before for the branch, and is not this item's.
- **The tree is read once,** that of the commit shown. `test-results` is read narrowed, with no recursive tree.

## Noted

- **A product with no release tag yet** reads only the commit's folder (`lastRelease` null). The code handles it, and no
  test states it. It is for the release tests of ITM-1279.
