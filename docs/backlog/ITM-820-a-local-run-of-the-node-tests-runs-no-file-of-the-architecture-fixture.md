---
id: ITM-820
title: A local run of the node tests runs no file of the architecture fixture
level: module
realises:
  - A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
modules:
  - MOD-trace-graph
  - MOD-approvals
  - MOD-documents
  - MOD-review-pages
  - MOD-site-frame
builds_on:
tests:
  - unit
origin:
  - ITM-702's gate on pull request #746 (docs/gates/20261017-1911-development-release-testing-8943.md), and sprint team2/76's review
---
# ITM-820 A local run of the node tests runs no file of the architecture fixture

**REGISTER**

## Outcome

`node --test tests/` runs every `*.test.js` below `tests/`, so it also runs
`tests/fixtures/architecture/tests/reader.test.js`, which is a fixture product's file and not a test of Agent M. CI picks
its files by list and does not run it. The fixture's file keeps its contents and stops being matched as a test of this
repository, in the way ITM-702 took for the groups fixture: it is kept under another name, and its readers build it.

Its readers load the whole fixture, so each sees the file. Each is changed only by the module whose file names it as taken
over:
- MOD-trace-graph: `tests/test_coverage_report.py`, `tests/test_impact_list.py`, `tests/test_matrix_derived.py`,
  `tests/test_references.py`;
- MOD-approvals: `tests/architecture.test.mjs`, `tests/review-page-core.test.mjs`;
- MOD-documents: `tests/architecture-format.test.mjs`;
- MOD-review-pages: `tests/review-core.d/dashboard-writes.test.mjs`;
- MOD-site-frame: `tests/load-per-view.test.mjs`, `tests/review-page.test.mjs`.

The list is read again at the start, by every name a harness loads the fixture under.

## Acceptance

- `node --test tests/` runs no file below `tests/fixtures/architecture/`, and every reader finds the fixture as before.
- It is declared as refactoring: CI is green on every commit.
- **The list, read again at planning** (sprint team1/122, on `main` at `0e928b61b`). A search of `tests/` for the
  fixture's path, in both the JavaScript and the Python spelling, finds 19 files; known positive: it finds
  `tests/test_matrix_derived.py`, which the list above names.
  - `tests/test_coverage_report.py` and `tests/review-core.d/dashboard-writes.test.mjs` no longer read the fixture.
  - Of the 19, these load the whole folder and so see the file: `tests/architecture-format.test.mjs`,
    `tests/architecture.test.mjs`, `tests/load-per-view.test.mjs`, `tests/review-page.test.mjs`, the six
    `tests/site-frame-*` files that name it (`dashboard-item-digits`, `live-embed`, `live-entry-shown`,
    `maintenance-menu`, `replies-menu`, `tests-menu`), `tests/release-itm-1266-review-folders.test.mjs`,
    `tests/release-itm-1268-last-accepted-one-file.test.mjs`, `tests/release-itm-1311-job-record-batch.test.mjs`,
    `tests/test_impact_list.py`, `tests/test_matrix_derived.py` and `tests/test_references.py`. The others read named
    files of it: `tests/documents-identifier-described-unique.test.mjs`, `tests/test_architecture_files.py` and
    `tests/test_approval_records.py`. The developer confirms each by reading it.
  - Their headers name the same five modules as above.
- **The planning run.** With `reader.test.js` renamed and no reader changed, the 19 files give 75 pass in Node and 23 in
  Python, as without the rename. So no assertion reads the file by its name, and building it back changes no outcome;
  no test outside these readers changes.
- The three release tests among the readers are changed by developer-sonnet-l, who implemented none of ITM-1266,
  ITM-1268 or ITM-1311, on the item's branch in a commit of its own.
