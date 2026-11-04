---
id: ITM-1322
title: The prompt bar's one-kind tests guard use cases by their identifier
level: module
realises:
  - A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
  - EVERY ARTIFACT NAMES ITS ORIGIN
modules:
  - MOD-prompt-bar
builds_on:
tests:
  - component
origin:
  - po-opus-c's gate of ITM-1187 (docs/gates/20261030-1013-development-release-testing-c1187.md, Noted), and team1's sprint 127 Review (docs/backlog/sprints/team1/127.md)
---
# ITM-1322 The prompt bar's one-kind tests guard use cases by their identifier

**REGISTER**

## Outcome

MOD-test-document's reader finds two errors in `tests/prompt-bar-one-kind.test.mjs`, under A REFERENCE NAMES THE
IDENTIFIER, NOT THE POSITION. Each guards a use case by a step:
- TST-1360003 guards "UC-019 4b";
- TST-1360004 guards "UC-049 3b".

MOD-test-document's `testFindings` reads "a use case written with its step, such as `UC-005 (alternative flow 6a)`" as
no identifier. The file's header joins its modules with " · " on one `Module:` line, which is read as its first module
only (sprint 125's note; MOD-test-document's Data: "`Module:` names the module it exercises", one per line).

With this item:
- TST-1360003 guards UC-019, beside what it guards already.
- TST-1360004 guards UC-049, beside what it guards already.
- The step each case concerns stays in its `given`, `input` or `expect`, where a step may stand.
- The header names its three modules one per line: MOD-prompt-bar, MOD-trace-pages and MOD-site-frame.

## Readiness

It is ready. It changes test declarations only, and no expected result or case body:
- MOD-test-document's reader names the two findings;
- the accepted form names what replaces each line.

It is no refactoring of code: no code file changes.

## Acceptance

- MOD-test-document's reader gives `tests/prompt-bar-one-kind.test.mjs` 5 declarations and 0 findings. Its header gives
  three modules.
  - Known positive: on the base the same reader gives 2 findings, TST-1360003 and TST-1360004.
- Every case of the file passes as before, and no assertion changes.
- One commit, which holds only the file. CI is green on it, since no expected result changes.
