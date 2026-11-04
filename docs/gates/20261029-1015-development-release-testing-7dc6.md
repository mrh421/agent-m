---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 1f76b7ed514ff536f9f4a47a4d228da6d904565c
  - https://github.com/akmaier/agent-m/pull/1429
date: 2026-10-29 10:15 UTC
---
# Development → Release testing: ITM-1276, a test's history reads the records of the newest ten runs and earlier ones on request

**REGISTER**

## Reason

ITM-1276, pull request #1429 into `sprint/team1/115`, passes on `1f76b7ed`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40852593755, `pull_request`, on `1f76b7ed` passes 38 of 38 pull-request jobs.
2. **Red first, with one deviation, checked again by me.**
   - **The run.** `8c0045be` holds only tests: the new `trace-pages-test-history-newest` and the harness. It had no
     pull-request run, since it was pushed before the pull request was opened. Draft #1432 at that commit gave it run
     40855381481. That run fails only TST-1276001 to 004 (component job 123385026858), each for the item's reason:
     - "one history of the branch" (actual 0);
     - "the whole tree of the branch is read once, for the outcomes of the tests tree, and not for the history"
       (actual 2);
     - "the marks come from the one history read of the newest ten commits".
   - **The deviation.** The implementation commit `1f76b7ed` also changes the test file.
     - Its helper `narrowedOfResults` counted every snapshot of `test-results`, the tests tree's whole tree among them.
       It now counts the narrowed ones only.
     - `wholeTrees` now reads the log itself.
     - So TST-1276004's "known positive" changes from 2 to 1.
     - Against the implementation, the tests-only version fails TST-1276001 and 002 on "one snapshot of the branch"
       (actual 2, expected 1). I ran it on `1f76b7ed`: 2 pass, 2 fail.
     - So that helper was a defect of the tests, mended in the implementation commit. The agreement asks that a changed
       expectation stand in the tests-only commit (`team1/115.md`, the brief).
   - **No expectation is weakened.**
     - The `expect:` lines are unchanged, and each already says "one narrowed snapshot".
     - Before, TST-1276004 asserted one whole tree and two snapshots in all. Now it asserts one whole tree and one
       narrowed snapshot: the same facts.
     - TST-1276001 and 002 now count what their declaration says they count.
   - **The red that the agreement asks for, shown on the final tests.** I ran the test file of `1f76b7ed` against
     `src/trace-pages/test-detail.mjs` of `8c0045be`, the code before the item. It runs 0 pass and 4 fail, on "one history
     of the branch", "the whole tree … is read once" and "the marks come from the one history". These are the item's
     reasons.
3. **Only its module changes.**
   - Code: `src/trace-pages/test-detail.mjs` (`runsPage`, and `historyPart` reworked).
   - Tests: the new `trace-pages-test-history-newest` and the helper `trace-pages-harness`. The harness, as the
     Acceptance names it, gains the history of `test-results`, `readSnapshot` with `folders`, and `log.narrowed`. Both
     name MOD-trace-pages.
   - `trace-pages-test-detail`, `trace-pages-test-history-logs` and `release-itm-1275-history-log-on-open` are unchanged
     and green, as the Acceptance asks of the release test.
   - No test of another module changes, and no test is removed.
   - The code adds no import. It calls `readHistory`, `readSnapshot` (with `folders`) and `testHistory`, which
     MOD-trace-pages' Uses name (MOD-trace-pages.md:19-20, and MOD-result-records.testHistory).
4. **The Outcome is the accepted text** (MOD-trace-pages.md:164-167).
   - The history reads the records that the newest ten commits of `test-results` added (`readHistory` with their
     changes), and those of the release tags' commits.
   - It reads them through a snapshot narrowed to them, in one batch (`readMany`).
   - *Earlier runs* reads the next ten.
   - `testHistory` is unchanged and is given that snapshot.
5. **The readings in the pull request hold.**
   - **The cursor of *Earlier runs*** is `readHistory` from the first parent of the last commit of a page, with
     `limit: 10`. That is the paging of the review pages' *Older* (ITM-1276's Outcome, §2.5).
   - **A commit whose records straddle two pages** is marked by the first page that holds it, and not again. Its
     outcome is the one `testHistory` gives for the records that page reads.
   - **Marks are newest first,** the order of the history.
6. **The reader.** On `1f76b7ed`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `trace-pages-test-history-newest`: 4 declarations, TST-1276001 to 004, and 0 findings.
   - `trace-pages-harness` is a helper, with no declaration of its own.

## Noted

- **The developer's point: the tests tree still reads the whole tree of `test-results`.**
  - It does so once, for the outcomes on the version's commit (`src/trace-pages/tests.mjs:48`).
  - ITM-1276's Outcome does not name it.
  - It needs no change of a text: MOD-trace-pages names that it reads the result records (:150-151), not how, and
    `readSnapshot` with `folders` and `resultsAt` are in its Uses.
  - It is registered as **ITM-1309**, ready, in MOD-trace-pages.
- **For the review:** a tests-only commit pushed before its pull request exists gets no pull-request run. The red run
  then needs a pull request opened at that commit.
