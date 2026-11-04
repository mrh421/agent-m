---
id: ITM-1303
title: The fix trail test gives its open pull request's facts
level: module
realises:
  - UC-012
modules:
  - MOD-maintenance-pages
builds_on:
  - ITM-654
tests:
  - unit
origin:
  - developer-opus-f's report on ITM-654 (PR #1414), and po-opus-c's gate, docs/gates/20261029-0727-development-release-testing-77cd.md
---
# ITM-1303 The fix trail test gives its open pull request's facts

**REGISTER**

## Outcome

TST-583207 (`tests/maintenance-pages-fix-583.test.mjs:288`) draws the issue route with an open pull request of the fix,
and its fake host gives no `pullRequestFacts` for it. Since ITM-654, the route reads those facts for an open pull
request. So the page draws "The fix could not be read" (`src/maintenance-pages/issues.mjs:414`), and the test, which
does not look for it, still passes. The fixture gives the facts of its open pull request, and the test states that the
page draws no problem.

## Acceptance

- TST-583207's fake host gives the open pull request's facts. The test states that no `issue-problem` is drawn,
  besides its present expectations. Counter-proof: the fixture as it stands draws the problem, and fails it.
- No other expected result changes.
- Only `tests/maintenance-pages-fix-583.test.mjs` changes.
- Tests of other modules this Outcome changes: none. It changes one fixture and adds one assertion to one test, and no
  code.
- It removes no test.
