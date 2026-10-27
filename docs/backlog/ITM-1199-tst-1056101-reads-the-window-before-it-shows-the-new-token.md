---
id: ITM-1199
title: TST-1056101 reads the Bridge's window for the new pairing token only once the window shows it
level: module
realises:
  - THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
modules:
  - MOD-desktop-shell
builds_on:
tests:
  - release
origin:
  - job 120420039999, python (5) of #1322 at b3d30c24, attempt 2; attempt 1 of the same commit passed (agreement 94)
built_by:
  - b47e81a4a328e179d8fab6d5f458173f075c9d25
---
# ITM-1199 TST-1056101 reads the Bridge's window for the new pairing token only once the window shows it

**REGISTER**

## Outcome

TST-1056101 (`tests/test_bridge_settings.py:236-242`, release; MOD-desktop-shell; case "Settings set in the window",
data in `tests/test_bridge_settings.md`) failed on the rerun of `b3d30c24` and passed on its first run. That makes it a
flaky test (SPEC.md:1560).

**From the full log of job 120420039999 (lines 251-262):** `AssertionError … 'ow': False … != … 'ow': True`. The only key
of the result that ends so is `pairedAnew.shownInWindow`, expected `true` (`tests/test_bridge_settings.md:60`).

**The test's own steps** (`tests/test_bridge_settings.py`, `setInTheWindow`, :136-139):
1. It presses *Pair anew* and confirms.
2. It reads the new token from the settings file (`app.token()`).
3. It asks the Bridge with the old and the new token.
4. It then reads `app.body.textContent` for the new token, once, without waiting for the window.

So the test waits on the settings file and on the Bridge's answers, and then reads a third source, the window, at one
instant.

**First task:** name, from the code the test runs (`src/desktop-shell/window.mjs` and what *Pair anew* calls), when the
window shows the new token relative to the write of the settings file. This is a data-flow path from the click to the
text, read before any change. It decides which this is:
- a test that reads too early, whose fix is in the test's wait;
- or a window that shows the old token after the new one is in force, whose fix is in MOD-desktop-shell, by its text.

## Acceptance

- The cause is named as that path, with the line where the window's text changes.
- The fix is in the place the cause names. No retry or longer timeout hides it.
- A case shows the order: a delayed render fails today's test, or today's window, whichever the cause names.
- **A release test is changed by a participant who did not implement the behaviour it tests** (RELEASE TESTS ARE NOT
  WRITTEN BY THE IMPLEMENTER).
- The first commit holds only the tests, and CI is red on it.
