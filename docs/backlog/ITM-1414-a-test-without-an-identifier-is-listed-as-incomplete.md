---
id: ITM-1414
title: A test without an identifier is listed as incomplete
level: module
realises:
  - UC-029
  - EVERY ARTIFACT HAS AN IDENTIFIER
modules:
  - MOD-test-document
  - MOD-trace-pages
builds_on:
  - ITM-774
tests:
  - unit
origin:
  - UC029-F1, TST-774209 of ITM-774's system tests of UC-029 (#1713), ruled at its gate in team1's sprint 142 (docs/gates/20261102-0823-development-release-testing-0774.md)
---
# ITM-1414 A test without an identifier is listed as incomplete

**REGISTER**

## Outcome

UC-029 1a: "A test declares no `TST-` identifier, no level or no guarded identifier. It is listed under **Incomplete**, with
what is missing." The tests view reads the declarations through `declarationsOf` (`src/trace-pages/tests.mjs:35-40`), which
takes MOD-test-document's `testDeclarations`. That yields nothing for a case whose comment names no `TST-` identifier, so
such a case is never listed as incomplete.

## How it is built

MOD-test-document's accepted text gives `unidentifiedDeclarations`: every comment block of a test file that is
written as a declaration but names no identifier, read with `id` `null`, its `path` and its `line`; `testDeclarations`
gives none of them. The tests view (`src/trace-pages/tests.mjs`) lists those blocks under **Incomplete**, with the missing
identifier that `testFindings` names. No caller of `testDeclarations` changes, and no stand-in identifier is inserted (the
rejection at `docs/gates/20261102-0903-development-release-testing-1414.md`). MOD-trace-pages already uses MOD-test-document;
its use of a second function of that module is read at module level, as TST-106805 reads Uses.

## Acceptance

- A test case whose declaration has a level and a guard but no `TST-` identifier is listed under **Incomplete**, naming the
  missing identifier. The other tests are listed as before.
- TST-774209 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
