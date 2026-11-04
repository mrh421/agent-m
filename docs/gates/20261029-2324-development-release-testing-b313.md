---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 81a17d2ac0b2d73699989ea65ccc135d2a5497ae
  - https://github.com/akmaier/agent-m/pull/1475
date: 2026-10-29 23:24 UTC
---
# Development → Release testing: ITM-1313, the store writes a session key only with both its names

**REGISTER**

## Reason

ITM-1313, pull request #1475 into `sprint/team1/122`, passes on `81a17d2a`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **The first commit holds only tests, and CI is red on it for the item's reason.** `2789a7b1` adds
   `tests/browser-store-session-key-names.test.mjs` and changes `tests/test_settings_page.py`, nothing else. Run
   40932280290 (`pull_request`) fails:
   - TST-1313001: "Missing expected exception: \"session:lab\"";
   - `test_every_key_the_store_writes_has_a_place_on_the_page` and its counter-proof: `session:sample` without a place,
     since the changed `keys_written` reads the old family as before and the place now names `session:sample:sample`.
2. **CI is green on the head.** Run 40934337232 (`pull_request`, attempt 1) on `81a17d2a` succeeds: 58 jobs, 17 skipped,
   none failed. `c3ae1a18` was green as well (run 40932445398).
3. **Only the item's files change.**
   - `src/browser-store/catalogue.mjs` (MOD-browser-store): the family `/^session:.+$/` becomes `/^session:.+:[^:]+$/`,
     the planning stand-in's form. Nothing else of the module changes.
   - `tests/test_settings_page.py` (MOD-settings-pages), as the Acceptance names: `keys_written` also samples a family
     ending in `:[^:]+` with both names, and `PLACES`, `STORED` and the titles of `TestedAndCleared` name
     `session:sample:sample` and `CLI session: sample:sample`. No other assertion of it changes.
   - `tests/release-itm-1185-session-declaration.test.mjs`: TST-1185304's todo and its `Todo:` line go, in `81a17d2a`,
     whose trailer names developer-sonnet-l, the writer of that release test, who implemented none of ITM-1313. Its
     `given`, `input` and `expect` are unchanged.
4. **The new and changed declarations**, read by MOD-test-document's reader on the head, 0 findings each:
   - TST-1313001 (unit, MOD-browser-store). given: an instance store that holds the setting products and the session
     lab:claude. input: writeSetting(store, key, declaration) for session:lab (no agent), session:lab: (an empty agent) and
     session::claude (an empty Bridge). expect: each throws a StoreError named UnknownSetting whose key is the key written,
     and localStorage is, entry for entry, what it was before.
   - TST-1313002 (unit, MOD-browser-store). given: an empty instance store (counter-proof of TST-1313001: the refusal does
     not take the key with both names). input: writeSetting(store, "session:lab:claude", declaration), then readSetting and
     listSettings on a store opened again. expect: the write is accepted and stands in localStorage under the instance's
     prefix; the declaration is read back whole; the setting is listed as "CLI session: lab:claude".
   - TST-1185304 (release, MOD-browser-store), unchanged: given: a store, and the catalogue's form
     session:<bridge>:<agent>. input: writeSetting of session:lab, session:lab: and session::claude. expect: each throws
     UnknownSetting naming the key, since none gives both names of the form.
   - The reader's control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 declarations and 0 findings.
5. **Counter-proofs.** The pull request records none of its own; I made them on the head.
   - TST-1313001 fails on the code without the change: the red run above.
   - TST-1313002: with the family planted as `/^session:[^:]+$/`, which refuses `session:lab:claude`, both cases fail;
     with the file restored, both pass.
6. **Checked by me on `81a17d2a`.** The new file, `tests/release-itm-1185-session-declaration.test.mjs` and
   `tests/test-document-one-line.test.mjs`: 14 pass, 0 fail, 0 todo. `tests/test_settings_page.py`: OK. My planning run
   had named the same three cases of that file, and no other.

## Noted

- Release testing of ITM-1313: TST-1185304 now checks the refusal at release level; developer-sonnet-l decides whether a
  further release case is needed.
