---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 39b013419ca63227cb2a7a021d3781fe040d4bcb
  - https://github.com/akmaier/agent-m/pull/1468
  - docs/backlog/ITM-1185-the-browser-store-keeps-a-cli-session-s-declaration.md
date: 2026-10-29 17:46 UTC
---
# Development → Release testing: ITM-1185, the browser store keeps a CLI session's declaration

**REGISTER**

## Reason

ITM-1185, pull request #1468 into `sprint/team1/121`, passes on `39b01341`, its head when this was decided. It is mended
as ruled in `docs/backlog/sprints/team1/121.md`, "ITM-1185's red head: decided".

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40923666849 (`pull_request`, head `39b01341`, attempt 1) succeeds: 58 jobs, 17 skipped, none
   failed.
2. **Each tests commit is red for its reason, and each comes before its code.**
   - `497e01a4`, the store's cases: run 40920066280 fails on TST-1185001 to 003.
   - `3f900f7d`, the settings page's: run 40923354598 fails in `component-pull-request (7)` only, on
     `test_every_key_the_store_writes_has_a_place_on_the_page` and `test_each_browser_setting_has_test_and_clear`.
   - Nothing is force-pushed. The four commits stand in the order of the ruling.
3. **Only the item's files change** (the diff against the merge base): `src/browser-store/catalogue.mjs` and `index.mjs`,
   `src/settings-pages/settings.mjs`, the new `tests/browser-store-session-declaration.test.mjs`, and
   `tests/test_settings_page.py` of MOD-settings-pages, which the item now names.
4. **The settings page's change is the ruling's, and its expectation is not weakened.** `test_settings_page.py` gains
   `session:sample` in `PLACES` and `STORED` and the title "CLI session: sample" among the lines that are tested and
   cleared; no other expectation changes. `sessionLine` shows the label and no value; *Test* tests the Bridge with
   `settingsOf`, `bridgeAt` and `testBridge` and asks whether it still offers the agent; *Change* opens `bridge`; *Clear*
   clears the setting and its last test. Each function it imports is named in MOD-settings-pages' Uses
   (MOD-settings-pages.md:19-21, :40-43).
5. **The new cases name what they guard and the module they exercise.** MOD-test-document's reader over the new file gives
   5 declarations, TST-1185001 to 005, MOD-browser-store, level `unit`, and 0 findings, each value on one line. Its
   control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0.
6. **Checked by me on `39b01341`.**
   - The new file passes, 5 of 5; `python3 -m unittest test_settings_page` is OK.
   - With `/^session:.+$/` taken out of `KEY_FAMILIES`, TST-1185001 to 003 fail and 004 and 005 pass. With it back, the
     tree is clean.

## The readings taken

- **The Bridge and the agent are split at the last `:`.** The catalogue writes the key as `session:<bridge>:<agent>`
  (MOD-browser-store.md:72); the reading takes the agent as what follows the last `:`, and no text says that either name may hold one. The family accepts any `session:` key, so a key written
  without its agent would be split wrongly on *Test* only; no writer makes such a key. Noted, not a condition.
- **No folded explanation for the line.** The explanations are MOD-site-frame's data (MOD-site-frame.md:123), outside the
  item's modules, and the line asks nothing of the person. That is right.

## Noted

- developer-sonnet-l writes ITM-1185's release tests: a stored CLI session's declaration, and its line on the settings
  page.
