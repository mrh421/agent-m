---
id: ITM-1313
title: The store writes a session key only with both its names
level: module
realises:
  - UC-049
  - THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
modules:
  - MOD-browser-store
  - MOD-settings-pages
builds_on:
  - ITM-1185
tests:
  - unit
origin:
  - po-opus-c's gate of sprint team1/121 (PR #1474), docs/gates/20261029-1806-release-testing-sprint-review-c1d3.md, from developer-sonnet-l's TST-1185304
---
# ITM-1313 The store writes a session key only with both its names

**REGISTER**

## Outcome

MOD-browser-store's catalogue names the key `session:<bridge>:<agent>` (MOD-browser-store.md:72), and `writeSetting`
"stores a value under a key of the catalogue. Throws `UnknownSetting` for any other key" (:116-117). ITM-1185 gave the
family as `/^session:.+$/` (`src/browser-store/catalogue.mjs:12`), so the store also writes `session:lab` (no agent),
`session:lab:` (an empty agent) and `session::claude` (an empty Bridge), which are no keys of that form.
TST-1185304 (`tests/release-itm-1185-session-declaration.test.mjs`) states the refusal, as a todo.

The family takes a key only with a non-empty Bridge name and a non-empty agent name. The settings page's split at the
last `:` (`sessionLine`, `src/settings-pages/settings.mjs`) then always finds both.

## Acceptance

- `writeSetting` throws `UnknownSetting` for `session:lab`, `session:lab:` and `session::claude`, and keeps
  `session:lab:claude`. TST-1185304's todo goes, and it passes.
- `tests/test_settings_page.py` finds the family by the shape `/^<prefix>:.+$/` (`keys_written`). Where the narrower
  family hides it from that check, the item names the test and its change in its Acceptance before its tests-only commit.
- **The planning run names that change** (sprint team1/122, on `main` at `0e928b61b`). A stand-in wrote the family as
  `/^session:.+:[^:]+$/`, beside the other families of `KEY_FAMILIES`. Over 255 files that name MOD-browser-store, its
  functions, MOD-settings-pages, MOD-prompt-bar or `session:`, three cases fail only with it, all in
  `tests/test_settings_page.py` (MOD-settings-pages, component): `test_every_key_the_store_writes_has_a_place_on_the_page`,
  `test_each_browser_setting_has_test_and_clear` and `test_the_paired_bridge_can_be_tested`. Each stores `session:sample`,
  which `writeSetting` now refuses, and `keys_written` no longer finds the family. TST-1185304 passes as a todo.
  - So that test changes, in the tests-only commit: `keys_written` also finds a family whose value ends in
    `:[^:]+`, sampled with both names (`session:sample:sample`), and `PLACES`, `STORED` and the titles of
    `TestedAndCleared` name that key and its line `CLI session: sample:sample` in place of `session:sample`. With that
    change on the stand-in, the file's 26 cases pass, its counter-proof among them.
  - The item therefore names MOD-settings-pages, for that one test; no code of MOD-settings-pages changes.
  - TST-1185304 is a release test: its todo is taken out by its writer, developer-sonnet-l, on the item's branch, in a
    commit of its own.
- Nothing beyond MOD-browser-store.md's catalogue is added.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
