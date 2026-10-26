---
id: ITM-1229
title: The Bridge's settings test waits for the new pairing
level: module
realises:
  - THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
  - A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
modules:
  - MOD-desktop-shell
builds_on: []
tests:
  - release
origin:
  - akmaier: "ok fix bridge" — tests/test_bridge_settings.py failed on CI in runs 40307729907, 40308936204 and 40279938613 and passed on the same code elsewhere
---
# ITM-1229 The Bridge's settings test waits for the new pairing

**REGISTER**

## Outcome

`tests/test_bridge_settings.py`, case "Settings set in the window", reads the result of *Pair anew* a fixed 30 ms after
the confirm click (`press` → `settle()`, then `app.token()` and the two requests). The click starts an asynchronous chain —
`src/desktop-shell/window.mjs:25` → `pair-anew` (`src/desktop-shell/main.mjs:134`) → `pairAnew()`
(`src/bridge-http/pairing.mjs:21–29`: mkdir, writeFile, chmod) → the window's state read and redraw — which on a loaded
CI runner takes longer: run 40307729907 (job 121520996976) and 40308936204 (job 121525031290) read the old token
(`differs: False, oldToken: 200`), run 40279938613 (job 121430804075) a window not yet redrawn (`shownInWindow: False`).
The Bridge behaves as the SPEC states; the test assumes a duration.

The test waits, with its own `until`, for the window to show a token other than the first before it reads the result,
and the same wherever it reads a result of a click after a fixed wait (the settings file after *Save settings* among
them). The expected results in `tests/test_bridge_settings.md` do not change; a pairing that never changes still fails
the case.

## Acceptance

- Only `tests/test_bridge_settings.py` changes; `tests/test_bridge_settings.md` and the Bridge's code do not.
- Counter-proof, stated in the PR: with a delay planted locally (not committed) in `pairAnew` before it writes, the test
  as it was fails at the case's `pairedAnew`, and the changed test passes; with `pairAnew` planted to keep the old token,
  the changed test still fails.
- CI is green on the head.
- Written by a participant who built none of the Bridge items (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
