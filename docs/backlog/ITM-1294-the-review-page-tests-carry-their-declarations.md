---
id: ITM-1294
title: The review-page tests carry their declarations
level: module
realises:
  - A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
modules:
  - MOD-site-frame
builds_on:
  - ITM-1285
tests:
  - unit
origin:
  - po-opus-c's gate of ITM-1268 (PR #1398), docs/gates/20261029-0347-development-release-testing-8768.md
---
# ITM-1294 The review-page tests carry their declarations

**REGISTER**

## Outcome

MOD-test-document's reader finds 0 declarations in `tests/review-page.test.mjs`: its cases carry no TST identifier, so
none of them names what it guards and the module it exercises, and the traces do not reach them. The case "opening one
use case …" of `tests/load-per-view.test.mjs` has none either. Each such case carries a declaration as the repository's
tests do — identifier, level, module, guards, given, input, expect — and its assertions stay as they are.

## Acceptance

- The reader finds one declaration per case of `tests/review-page.test.mjs` and for that case of `load-per-view`, with no
  findings; no assertion changes.
- Only those two test files change.
- Tests of other modules this Outcome changes: none. The run was made on `main` at `b40c5059d` with nine stand-in
  declarations, one before each of the eight cases of `review-page` and one before the case of `load-per-view`. The
  reader then gives 8 declarations in `review-page` (0 before) and 11 in `load-per-view` (10 before), with 0 findings;
  its known positive, `release-itm-1254-issue-move`, gives 4 and 0.
  - The run took the two files, the seven tests that name either by its path, `test-document-one-line` and
    `test-document-declarations`: 81 pass, 0 fail.
  - It also took the Python checks of the test corpus (`test_references`, `test_test_battery`, `test_origin_links`,
    `test_test_levels`, `test_identifiers`, `test_identifier_stability`): OK.
- The new identifiers are free: on `main` no test declares an identifier beginning `TST-1294`.
