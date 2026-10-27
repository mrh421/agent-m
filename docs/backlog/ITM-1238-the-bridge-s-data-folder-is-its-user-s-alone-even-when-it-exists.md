---
id: ITM-1238
title: The Bridge's data folder is its user's alone, even when it exists
level: module
realises:
  - THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
modules:
  - MOD-desktop-shell
builds_on: []
tests:
  - unit
origin:
  - the live test of the Bridge on 2026-10-27: a data folder that existed with mode 755 stayed 755
---
# ITM-1238 The Bridge's data folder is its user's alone, even when it exists

**REGISTER**

## Outcome

MOD-desktop-shell (:125-126, :197): the Bridge's per-user data folder, which holds `settings.json` and the pairing
token, is "readable and writable by its user only". `src/desktop-shell/settings.mjs:96` gives it mode 700 only when it
creates it; a folder that exists, with a wider mode, stays so (755 seen on the live test). At start the Bridge makes the
folder its user's alone whether it created it or found it.

## Acceptance

- A unit test naming MOD-desktop-shell: a data folder that exists with mode 755 is 700 after the Bridge reads its
  settings (on Windows, where modes do not apply, the test is skipped as the module's other mode tests are).
  Counter-proof: before the change it stays 755.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/desktop-shell/` and the tests that name MOD-desktop-shell change.
