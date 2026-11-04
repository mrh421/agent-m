---
id: ITM-1279
title: Runs reads the records of its two commits and the test files in batches
level: module
realises:
  - UC-028
  - EVERY TEST RUN LEAVES A RESULT RECORD
  - A PAGE LOAD READS THE REPOSITORY IN BATCHES
modules:
  - MOD-test-pages
builds_on:
  - ITM-1266
tests:
  - component
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at. It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1279 Runs reads the records of its two commits and the test files in batches

**REGISTER**

## Outcome

`runs/<commit>` (`src/test-pages/runs.mjs:341-395`, `detail`) reads the whole tree of `test-results` (`:349`; 3,186
entries, ~146 KB gzipped) to find the records of two commits — the one shown and the last release's
(`rateComparison`) —, and every test file of the commit one request each (`:362`: 1,542 files, 19.3 MB at Agent M's head),
whose declarations it shows (level, guards; a candidate's user tests' expected results).

After the change, as MOD-test-pages says: `test-results` is read narrowed to `runs/<commit>/` and `runs/<release
commit>/` (ITM-1266's `folders`); the test files are named to `readMany` first and read in batches of a hundred. The
declarations are still read: the page shows a row for every test, and the stored graph holds no test's level.

Design principles (AGENTS.md §2 *Designing*): akmaier — the records of the commits shown, not of every run; SPEC `A PAGE
LOAD READS THE REPOSITORY IN BATCHES` — files in batches.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/test-pages-runs-reads.test.mjs` (MOD-test-pages, component), over a counting fake whose `test-results` holds 40
  commits' records: `#runs/commit=<c>` shows what `tests/test-pages-runs.test.mjs` expects, reads no recursive tree of
  `test-results`, one folders request, and its 150 test files in two batches. Counter-proof: a record of a third commit
  is not read.

Measurable outcome: `#runs/commit=…` sends no tree of `test-results` (~146 KB gzipped) and 16 batches of test files
instead of 1,542 requests.

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/test-pages/` and the tests that name MOD-test-pages change.
