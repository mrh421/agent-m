---
id: ITM-1435
title: A regular expression with a backquote hides no declaration
level: module
realises:
  - A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
modules:
  - MOD-test-document
builds_on: []
tests:
  - unit
origin:
  - noted by ITM-775's writer (#1733), ruled at its gate in team1's sprint 142 (docs/gates/20261102-1108-development-release-testing-0775.md)
---
# ITM-1435 A regular expression with a backquote hides no declaration

**REGISTER**

## Outcome

MOD-test-document's `testDeclarations` reads a regular-expression literal that holds a backquote as the start of a
template literal. So the declarations of the tests after it in the same file are not read. ITM-775's writer worked around
it with `new RegExp`.

## Acceptance

- A test file with a regular-expression literal holding a backquote gives every declaration after it. Known positive: the
  same file without the literal gives the same declarations.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
