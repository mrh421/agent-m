---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - af80a2600ffea89da917098ebb3b33be9741fcc4
  - https://github.com/akmaier/agent-m/pull/1502
date: 2026-10-30 06:20 UTC
---
# Development → Release testing: ITM-1307, the schedule counts its tests by one rule

**REGISTER**

## Reason

ITM-1307, pull request #1502 into `sprint/team1/125`, passes on `af80a260`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `944ca543`:** run 41010724260 fails in one job, and there only on TST-1307001 of
     `tests/test-pages-schedule-one-rule.test.mjs`: "the route's counts are scheduleView's", with `paid: 2` shown against
     `paid: 1`. That is the item's reason: the route counts the declaration of the level `paid` under the row `paid`, and
     `scheduleView` counts it under none.
   - **Head:** run 41010905607 (`pull_request`, attempt 1) succeeds.
2. **Only the item's files change.**
   - `src/test-pages/schedule.mjs`: `testCounts` returns `scheduleView(testFacts(snapshot, declared)).counts` where no view
     is stored, and its own loop goes. The stored path and the reading of the files are unchanged.
   - It imports `scheduleView` beside `storedView` from MOD-progress-measures' index. MOD-test-pages names
     MOD-progress-measures among its Uses (MOD-test-pages.md:36), which the agreement of sprint 124 reads at the level of
     the module.
   - The one new test file, whose header names MOD-test-pages. No existing test changes; the item's planning run named
     none of another module.
3. **`testFacts` answers the type of `Facts`** (MOD-progress-measures.md:150-160). Read field by field, as the agreement of
   sprint 120 asks: it holds every one of the type's 30 fields, and no other.
   - `"unknown"` where the type allows it:
     - `info`, `graph`, `requirements`, `workflow`, `model`, `modelSince`;
     - `pullRequests`, `schedule`, `ci`, `tags`, `results`;
     - `resourceNeeds`, `resultCommits`.
   - Empty where it does not:
     - `address: string` is `""`;
     - `statuses: Map` is an empty `Map`;
     - `queues`, `participants`, `sprints`, `assignments`, `held`, `gates`, `gateStates`, `jobs` and `modules`, all arrays,
       are `[]`;
     - `declaration: Document | null` and `modelUnread: {…} | null` are `null`;
     - `plan: { order: Document | null, items: Document[], states: ItemState[] }` is `{ order: null, items: [], states: [] }`.
   - `own: boolean` is `false`: a boolean has no empty value, and the field is not read by `scheduleView`.
   - `snapshot` is the route's, and `tests` the declarations it reads: the two fields `scheduleView` reads
     (`src/progress-measures/views.mjs:189-197`).
4. **The pull request's readings are right.**
   - "The same declarations" are those `testDeclarations` reads from the product's test files, given as `tests`. That is
     the item's reading: "the route gives it `Facts` of its snapshot whose `tests` are the declarations it reads".
   - The module files relied on were read on `origin/main`. They have not changed since this sprint's planning.
5. **It builds the item's Acceptance.**
   - "Where no view is stored, the route's counts equal `scheduleView`'s for the same declarations, one of them of the
     level `paid`": TST-1307001 draws the route over a product with no stored view. It finds 2, 1, 0, 1, 0 and 0, which
     are `scheduleView`'s counts for the four declarations.
   - Its counter-proof is "the route's own counting as it stands": the tests-only run above.
   - The case asserts its known positives: the four declarations are read, one of them of the level `paid`.
   - Only `src/test-pages/` and a test that names MOD-test-pages change.
6. **Counter-proof, made on the head and restored after.**
   - `scheduleView` given no declarations (`testFacts(snapshot, [])`): TST-1307001 fails on "the route's counts are
     scheduleView's".
   - Restored, 1 of 1.
7. **MOD-test-document's reader:**
   - `tests/test-pages-schedule-one-rule.test.mjs`: 1 declaration, 0 findings. The header gives MOD-test-pages, level
     `unit`, and no finding.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - **TST-1307001**, as the reader reads it:
     - given: "a product whose repository stores no view, and whose test file holds two unit tests (one calling the paid
       service oracle), one component test and one declaration of the level paid that calls no paid service";
     - input: "the route schedule rendered for the product; and scheduleView of Facts whose snapshot is the product's and
       whose tests are the declarations of its test file";
     - expect: "known positive: the file is read as four declarations, one of the level paid; the rows unit, component,
       system, paid, release and user show 2, 1, 0, 1, 0 and 0, which are the counts scheduleView gives for the same
       declarations; the declaration of the level paid counts under no row".
8. **Locally on the head:** the new file, the `test-pages-schedule` files and `tests/test-document-one-line.test.mjs` give
   47 pass, 0 fail. My planning run of the same change, over 84 files, found no case that fails.
9. **Reads:** none change. The test files are read as before, in one batch, and `scheduleView` reads nothing.

## Noted

- The test gives `scheduleView` an object of `snapshot` and `tests` alone, for its expected counts. That is a test's own
  input, not a caller of the interface; the route gives the full `Facts`.
- The pull request's description names no runs. The runs are those above.
