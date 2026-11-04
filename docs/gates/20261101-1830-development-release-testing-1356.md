---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 3bfc0a90512308e40e6b3b10a5d5136f411d984f
  - https://github.com/akmaier/agent-m/pull/1633
date: 2026-11-01 18:30 UTC
---
# Development → Release testing: ITM-1356, #1633

**REGISTER**

## Reason

ITM-1356 (the tests browser offers Arrange) may go on. The pull request is #1633 into `sprint/team1/141`, at
`3bfc0a905`, by developer-sonnet-j (`Agent-M-Participant` on `e8cc90abd`, `ff146132c` and `c63ef60a7`). The head is the
Scrum Master's merge of the sprint branch, with #1634. I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `e8cc90abd` adds only
   `tests/trace-pages-tests-arrange.test.mjs`. In run 41291964843 (pull_request) it fails TST-1356001 to 1356003, plus
   TST-738002, the sprint branch's clash at the time, which #1634 fixed.
2. **CI is green on the head:** run 41293256284 (pull_request, `3bfc0a905`), attempt 2.
   - Attempt 1 failed only two cases of `tests/review-pages-release-limitations.test.mjs`, a file the item does not touch.
   - That file is on the brief's list of known flips (ITM-1287), so a green rerun on the same commit counts.
   - `git merge-tree` with the sprint branch's current head is clean.
3. **Only the item's module changes:** `src/trace-pages/flow.mjs`. The test file is headed MOD-trace-pages.
   - `c63ef60a7` changes only how three absence checks compare: hrefs, not DOM nodes, so a failure does not hang. No
     expected value changes, and the test is new in this item.
   - TST-1224003 ("views right under the heading") is unchanged, since the link stands after the embedded views.
4. **The Acceptance holds:**
   - At the default branch's head, the tests view offers *Arrange* to `arrange/tests` with the product, read back by
     `addressParts` (TST-1356001).
   - It offers none at a tag or a commit (TST-1356002).
   - On the Host's default branch, even when that is not `main`, it offers *Arrange*; on `main`, where that is not the
     default branch, it offers none, and none for a Host without `repositoryInfo` (TST-1356003).
   - Counter-proofs: offering *Arrange* whenever the view is not at an earlier version fails 002 and 003, and dropping
     the product fails 001.

## Rulings

- **"As the review pages keep it"** is the form `/product=<encoded address>` of ITM-1355. Taken.
- **"An earlier commit's version".** The tests view reads no trace graph, so that case is covered by `onDefaultBranch`
  being false at a tag, a commit or a branch that is not the default. Taken.
- **TST-738003's `todo`.** When another participant takes it away, its expectation gains `/product=` with it, by this
  item's Acceptance.
- **The specification view's own *Arrange*, and MOD-trace-pages' other links to review routes, still leave the product
  out.** The same defect as ITM-1355, in MOD-trace-pages. New item: ITM-1364, which builds every such link through
  `reviewLink` with the product.
