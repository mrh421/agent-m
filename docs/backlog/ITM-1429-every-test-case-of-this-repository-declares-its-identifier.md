---
id: ITM-1429
title: Every test case of this repository declares its identifier
level: module
realises:
  - EVERY ARTIFACT HAS AN IDENTIFIER
  - A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
modules:
  - MOD-implementation-pages
  - MOD-site-frame
  - MOD-review-pages
  - MOD-settings-pages
  - MOD-markdown-render
  - MOD-model-catalogue
  - MOD-source-register
builds_on: []
tests:
  - unit
origin:
  - the probe of ITM-1414's rework (#1720), ruled in team1's sprint 142 (docs/backlog/sprints/team1/142.md, the Selection that removes ITM-1414)
---
# ITM-1429 Every test case of this repository declares its identifier

**REGISTER**

## Outcome

`EVERY ARTIFACT HAS AN IDENTIFIER`. The probe of ITM-1414 found 57 comment blocks of `key: value` lines in this repository's
tests whose first line names no `TST-` identifier. They are real test cases with guards and a precondition, and none of
them is read as a declaration.

| File | Blocks |
|---|---|
| `dashboard-backlog-teams` | 15 |
| `load-per-view` | 11 |
| `model-catalogue-batch` | 7 |
| `markdown-render-918-diagram-drawn` | 6 |
| `site-accessibility` | 5 |
| `markdown-render-931-preview-focus` | 3 |
| `review-pages-draft-without-token` | 3 |
| `site-usability` | 3 |
| `test_settings_disclosure.py` | 3 |
| `dashboard-process-view` | 1 |
| a `source-register` test | 1 |

The item names the modules of these files for their tests only.

## Acceptance

- Each of the 57 blocks begins with a `TST-` identifier that no other test holds (searched in the history, with a known
  positive). Each block holds every key MOD-test-document's Data requires — level, module, guards, given, input, expect —
  as its case already asserts.
- MOD-test-document reads each as a declaration with no finding. Known positive: a case of the same file that already had
  its identifier.
- No test changes what it asserts, and no code changes. The item begins without a failing test, and CI is green on every
  commit.
