---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - aba1b45904709b94ffb08c627003104c0cee765c
  - https://github.com/akmaier/agent-m/pull/1415
  - docs/backlog/ITM-1264-implement-retry-and-pass-gate-judge-items-from-the-head-s-backlog-view.md@81a2ff96e
date: 2026-10-29 07:53 UTC
---
# Development → Release testing: ITM-1264, implement judges its items from the head's backlog view

**REGISTER**

## Reason

ITM-1264 as narrowed, pull request #1415 into `sprint/team1/113`, passes on `aba1b459`, its head when this was decided.
The item is read as it stands on `main` at `81a2ff96e`: MOD-implementation-pages alone, the workflow built with
`workflowOf`.

The Definition of Done is the default (SPEC.md:1870-1873).

1. **CI is green.** Run 40837757674, `pull_request`, on `aba1b459` passes 38 of 38 pull-request jobs.
2. **Red first.** The tests-only commit `f839a55c` is red in run 40835504670 for `#implement`'s tests. Its TST-1169002
   failure was the new declarations' two-line fields, mended in `bcd05b1a` with no expectation changed (sprint 113's
   ruling).
3. **Only the item's module changes.**
   - Code: `src/implementation-pages/backlog.mjs` and `implement.mjs`.
   - Tests: `implementation-pages-implement-stored-view`, `-implement-merge`, `-implement`, `-implement-places`,
     `-implement-plan`, and the helper `implementation-pages-sprints.mjs`, all named MOD-implementation-pages.
   - `src/main-page/jobs.mjs` is unchanged. `tests/main-page-job-stored-view.test.mjs` is removed (`21c4969b`); its
     behaviour is ITM-1305's.
4. **The workflow is built within the Uses.** `aba1b459` builds it with `workflowOf`, as `process` does. Every function
   `implement.mjs` imports is named in MOD-implementation-pages' Uses:
   - `readDocument` (MOD-implementation-pages.md:30);
   - `catalogue` and `modelSchema` (:35-36);
   - `declarationSchema` and `roleAssignmentSchema` (:40, :42);
   - `workflowOf` (:44);
   - and `readFileAt` (:70), through `plan`'s `declaredModelOf`.
   - `productWorkflow` is no longer imported.
5. **No expectation is weakened after the tests-only commit** (sprint 112's agreement). The test changes since `f839a55c`
   are:
   - `readFileAt` added to the in-memory hosts of `-implement`, `-implement-places`, `-implement-plan` and
     `-implement-merge`;
   - two `given:` comment lines of `-implement-merge` written on one line;
   - the removed job-page test.
   - No assertion changes. `-implement-merge`'s changed expectations stand in the tests-only commit.
6. **The reader.** On `aba1b459`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `-implement-stored-view` 4, `-implement-merge` 5, `-implement` 6, `-implement-places` 6, `-implement-plan` 5.
   - All with 0 findings.
7. **The reading on the instance SPEC passed as `""`** stands, as ruled. A gate a process requirement adds keeps
   `addedBy.source` null (MOD-product-process.md:159-160), which `startable` and `#implement` do not read.
