---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - d61495faf0745f96483269d2f3a3b092cc4645fd
  - https://github.com/akmaier/agent-m/pull/1578
date: 2026-10-31 14:44 UTC
---
# Development → Release testing: #1578, ITM-716 A route is handed the ref the frame read

**REGISTER**

## Reason

ITM-716 by developer-opus-e, with developer-sonnet-l's commit its Acceptance names, may be merged into
`sprint/team1/135`.
1. **The tests-only commit is red for the item's reason.** `c557ae13d` holds only `tests/load-per-view.test.mjs` and
   `tests/review-pages-handed-snapshot.test.mjs`. Run 41210116144 fails the ten load-per-view cases whose changed
   expectations the Acceptance names, TST-716005, and TST-716001 to 716004, and nothing else. `a6620cda1`
   (developer-sonnet-l) adds only TST-1319204's failure (41210201513). `a3b0f9ddd`, the fixture change alone, fails
   the same and no more (41210835106). The FINDING lines R3 and A3 that the failed-test log lists are `todo`s that
   were already there.
2. **CI is green on the head:** run 41210870314 on `d61495faf`.
3. **Scope:** `src/review-pages/common.mjs`, `flow.mjs`, `conversation-draft.mjs`, `arrange.mjs` (MOD-review-pages);
   `src/site-frame/dashboard-app.mjs` (MOD-site-frame); the new test file (header MOD-review-pages);
   `tests/load-per-view.test.mjs` (header MOD-site-frame): exactly the 13 expectations the Acceptance names, plus
   TST-716005; `tests/release-itm-1319-page-reads.test.mjs:57` as named; `tests/review-pages-release-reports.test.mjs`
   only how its fake host prepares the fixture. The branch is based on the sprint branch's head, `0e1ec9055`.
4. **Declarations:** MOD-test-document's reader gives 4 declarations and 0 findings on the new file, and 13 and 0 on
   load-per-view (12 and 0 on the base). Its control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0.
   Five counter-proofs stand in the pull request's description.
5. **Acceptance:** the review routes draw from the snapshot handed through `reads` (`handedPlace`, `readPlace`). After
   a write, they draw again with `readSnapshot` at the commit the write returned (TST-716002 to 716004). The UC-008 and
   UC-006 release cases are green unchanged. MOD-review-pages' kept `repositoryInfo` is `jobs.mjs:68` `loadStage`, for
   visibility.

## Noted

- Reading accepted from the description: a render the frame hands no snapshot (`embedRoute`), and one after a decision
  that wrote nothing, still read the default branch.
