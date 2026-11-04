---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 3617a7416886657d9c9fe1d6afec994078fa33c2
  - https://github.com/akmaier/agent-m/pull/1647
date: 2026-11-01 10:24 UTC
---
# Development → Release testing: ITM-1359, #1647

**REGISTER**

## Reason

ITM-1359 (*Propose groups* on the tests records the commit it read) may go on. The pull request is #1647 into
`sprint/team1/141`, at `3617a7416`. developer-sonnet-k wrote the tests and the code (`Agent-M-Participant` on both
commits). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `c9fe751e4` changes
   `tests/review-pages-arrange-propose.test.mjs` (MOD-review-pages) only. In run 41296792334 only TST-1359001 fails.
2. **CI is green on the head:** run 41296891647 (`3617a7416`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only the item's module changes:** `src/review-pages/arrange.mjs`. `proposeGroups` takes `snapshot` from what the page
   already holds and hands `worksOn: kind === "tests" ? [snapshot.commit] : items`. It reads nothing more than the base.
4. **The Acceptance holds:**
   - On the tests, the model is asked once, the proposal arrives as a pending change, and the record's `works_on` is the
     commit the page read (TST-1359001).
   - For use cases and requirements, `works_on` is the items, without the commit (TST-1359002, 1359003).
   - The pull request records three planted faults: the tests keeping `items`, every kind recording the commit, and
     another sha recorded.
   - No existing expectation moves. TST-1359nnn had no history (known positive: TST-1358nnn).
   - TST-738022 and TST-738118 pass locally under their `todo`s. A participant other than sonnet-k lifts them after the
     merge, from the merged code, as #1646 did for TST-370214.

## Reading taken

- The item's reading, with MOD-job-ledger.md:70 ("… an issue's address or a commit"): for the tests, `works_on` is the
  commit of the snapshot the page read. The record's form does not change. Taken.
