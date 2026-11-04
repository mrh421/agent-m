---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 3f149fbaff6726ea423ae99a77fb7a76c7a03790
  - https://github.com/akmaier/agent-m/pull/1397
date: 2026-10-29 04:54 UTC
---
# Development → Release testing: ITM-1285, a backquote inside a quoted string opens no template string for the declaration reader

**REGISTER**

## Reason

ITM-1285, pull request #1397 into `sprint/team1/111`, passes on `3f149fba`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1870-1873).

1. **CI is green.** Run 40813584499, `pull_request`, on `3f149fba`, attempt 2, passes 38 of 38 pull-request jobs.
   - Attempt 1 failed in one job, unit shard 7 (job 123249407673), in one case: TST-1097103,
     `tests/bridge-jobs-list.test.mjs:205`. Its cleanup ended with `ENOTEMPTY: directory not empty, rmdir
     '…/agent-work/products/github-com-acme-product-a/.git'`.
   - The same commit passed in attempt 2, and the test does not use the reader.
   - So it flips on one commit, which A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY (SPEC.md:1587-1589) calls flaky. It
     is registered as ITM-1295 in this commit.
2. **Red first.** `0631c75f` adds only `tests/test-document-backquote-in-string.test.mjs`. Its run, 40812490649, fails
   one job, unit shard 2, in four of that file's cases only:
   - a backquote inside a double-quoted string;
   - one inside a single-quoted string;
   - one inside a trailing `//` comment;
   - an escaped quote.

   The implementation commit changes one `given:` line of TST-1285005 to the input the case holds, and no assertion.
3. **Only its module changes.** `src/test-document/declarations.mjs`, whose counting of backquotes becomes
   `templateOpenAfter`, and a test whose header names MOD-test-document.
4. **The reader** (`testDeclarations(path, text)` and `testFindings`), run on the PR's checkout:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `tests/test-document-backquote-in-string.test.mjs`: 5 declarations, TST-1285001 to 005, and 0 findings.
   - `tests/review-pages-entry-own-queue.test.mjs`, the file sprint 111 sent here: 3 declarations, TST-1273101 to 103,
     and 0 findings. Before the mend, 0.
   - `tests/trace-pages-waiting-changes.test.mjs`, the item's own example: 6 declarations, TST-878001 to 006, and 0
     findings. Before, 0.
5. **The existing declarations pass unchanged, and the mend adds no finding.**
   - Over every test file under `tests/` (fixtures left out), the reader of `sprint/team1/111` gives 5,180 declarations
     and 31 findings. The PR's reader gives 5,330 declarations and the same 31 findings.
   - The 150 declarations it recovers stand in 30 files, among them `trace-pages-specification`, from 12 to 30, and
     `test_job_reading.py`, from 0 to 12.
   - None of them holds a finding. So nothing becomes a finding to name in the pull request, as sprint 111's note asked.
6. **The known limits** the description names are a regex literal holding a quote, a quote in a trailing Python `#`
   comment and a backquote inside `${…}`. They lie outside the Acceptance. The reader "is no JavaScript parser", as its
   comment states.
