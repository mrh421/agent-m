---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - a4ee300d2dfb2cce045dc060049da7e143ea2b78
  - https://github.com/akmaier/agent-m/pull/1727
date: 2026-11-02 09:53 UTC
---
# Development → Release testing: ITM-1415, #1727

**REGISTER**

## Reason

ITM-1415 (a test's history marks the commits of the default branch) may go on. The pull request is #1727 into
`sprint/team1/142`, at `a4ee300d2`, with these commits (`Agent-M-Participant` on each):
- developer-sonnet-k: the tests-only commit `c7b8451a8`, a first code commit `9cc939507` that the Scrum Master sent back, a
  second tests-only commit `274a59c97`, and the code `8ab68e16e`;
- developer-sonnet-l: `a4ee300d2`, the lift of TST-774214's `todo`.

I wrote none of it.
1. **The tests-only commits are red for the item's reason.**
   - `c7b8451a8` adds TST-1415001 to 1415004. Its harness's host can say which commits the default branch holds, and five
     existing MOD-trace-pages files name their default branch's commits in their `given`; no assertion moves. In run
     41422295825 only the new cases fail.
   - `274a59c97` adds TST-1415005: the host is asked about each commit once, and the branch's history is not read whole.
     In run 41422783074 only the new cases fail.
2. **CI is green on the head:** run 41423420958 (`a4ee300d2`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/trace-pages/test-detail.mjs`.
   - `runsPage` (:118-127) gave the commits of every record, whatever the branch, and `addMarks` (:139-141) marked each.
     So a pull request's head got a mark.
   - Now `onDefaultBranch` asks `repositoryInfo` once and the host's `containsCommit` once per commit, all of a page at once,
     shared with *Earlier runs*.
   - An answer that cannot be read is named by the history's existing line, and the commit gets no mark.
   - The first version read the branch's whole history, about 108 requests in turn per opened test; it was sent back and
     is replaced.
4. **The Acceptance holds:**
   - Only the default branch's commits with a record are marked.
   - The nine counter-proofs in the pull request each fail named cases.
   - TST-774214 loses its `todo`: a pull request's head gets no mark, and the default branch's commits do. It is red at
     `c7b8451a8` and green at `8ab68e16e`. opus-f wrote the case, and sonnet-l built none of the page.

## Ruled

- **Two release files' `given` change in the tests-only commit:** `release-itm-1275-history-log-on-open` and
  `release-itm-1276-test-history-ten-at-a-time`. Each fixture's host now names the default branch's commits. No assertion
  and no expected result moves.
  - The behaviour those cases guard is ITM-1275's and ITM-1276's (a run's log read on opening; ten runs at a time), which
    developer-sonnet-j built and sonnet-k did not.
  - `RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER` binds the writer of the behaviour a case guards, so it is met.

## Readings taken

- A commit is the default branch's when `containsCommit` with `repositoryInfo`'s branch says so. MOD-trace-pages' Uses name
  MOD-repository-hosts, and `containsCommit` is a method of the host it already calls (as ruled at ITM-1411's gate, by
  TST-106805's reading).
- An answer that cannot be read is named by the history's line.
- The rows of release tags do not change.

All are taken.
