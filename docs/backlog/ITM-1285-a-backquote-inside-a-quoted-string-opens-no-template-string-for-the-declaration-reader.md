---
id: ITM-1285
title: A backquote inside a quoted string opens no template string for the declaration reader
level: module
realises:
  - A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
modules:
  - MOD-test-document
builds_on: []
tests:
  - unit
origin:
  - developer-sonnet-l's release tests of ITM-1254 and ITM-1272 (PR #1389)
---
# ITM-1285 A backquote inside a quoted string opens no template string for the declaration reader

**REGISTER**

## Outcome

`src/test-document/declarations.mjs:101-118` counts a line's unescaped backquotes: an odd number opens or closes a
template string that spans lines, and no line inside it is read as a comment. A line `const TICK = "`";`
(`tests/trace-pages-waiting-changes.test.mjs:25`) holds one backquote inside a double-quoted string, so every declaration
after it is lost and the file reads as holding none. A backquote inside a `"…"` or `'…'` literal, or inside a `//`
comment, opens no template string.

## Acceptance

- A unit case reads a file with that line followed by a declaration, and finds the declaration; it fails on the
  current reader.
- The existing declaration tests pass unchanged. Only `src/test-document/` and its tests change.
