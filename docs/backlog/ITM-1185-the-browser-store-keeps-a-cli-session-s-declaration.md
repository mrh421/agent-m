---
id: ITM-1185
title: The browser store keeps a CLI session's declaration and an endpoint's place, context and CI secret
level: module
realises:
  - UC-049
  - THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
modules:
  - MOD-browser-store
  - MOD-settings-pages
builds_on:
tests:
  - unit
origin:
  - akmaier's request, accepted in MOD-browser-store at blob aee64fc9 (f35b9903) and UC-049 at blob 0c086a47 (9559c14f), 2026-10-22
---
# ITM-1185 The browser store keeps a CLI session's declaration and an endpoint's place, context and CI secret

**REGISTER**

## Outcome

The accepted catalogue (`docs/architecture/MOD-browser-store.md:71-72`) adds:
- the key family `session:<bridge>:<agent>`, holding `{ place, context, model, capabilities }`, not secret;
- to `endpoint:<name>`, the fields `place`, `context` and `secret?`.

The endpoint's fields are kept: `endpoint:<name>` is a family of the catalogue whose value is kept whole, and since
`35f3485d` the settings page writes `place`, `context` and `secret` into it and the prompt bar reads them
(`src/prompt-bar/offer.mjs`, `endpointsOffered`, `endpointLacks`). The code does not keep the session family yet.
`src/browser-store/catalogue.mjs:12` names no `session:` family, so `writeSetting` refuses the key, and `listSettings` and
the export do not carry it.

## Acceptance

- `writeSetting` keeps a `session:<bridge>:<agent>` value, and `listSettings` lists it with what it grants, as not
  secret.
- The export and import carry it like every other non-secret setting.
- An `endpoint:<name>` value with `place`, `context` and `secret` is kept and read back whole, and only its `key` counts
  as secret.
- Counter-proof: a key outside the catalogue is still refused.
- Nothing beyond MOD-browser-store.md's catalogue is added.
- The first commit holds only the tests, and CI is red on it.
- The Product Owner's planning run, on `main` at `ecc7de406`, with a stand-in that adds the family to `KEY_FAMILIES` and
  its `settingInfo`, from the catalogue alone: 191 test files that name MOD-browser-store or one of its functions, and the
  tests of MOD-settings-pages and MOD-prompt-bar. No case fails that does not fail without it. No test of another module
  changes.
- A stored `session:<bridge>:<agent>` setting has its line on the page `settings`, as every key the store writes does
  (`EVERY SETTING IS REACHED FROM ONE PAGE`, SPEC.md:649-653; MOD-settings-pages.md:147-150, "one line per setting with its
  state", and "a browser setting has *Test*, *Change* and *Clear*"). The line is titled with the setting's label and
  shows no value. *Test* tests the Bridge `<bridge>` with `MOD-bridge-client.testBridge` and says whether it still offers
  `<agent>`; *Change* opens the route `bridge`, where a CLI session is set up (MOD-settings-pages.md:252-256); *Clear*
  clears the setting. `tests/test_settings_page.py` (MOD-settings-pages) gains `session:sample` in `PLACES` and `STORED`,
  and the line in `TestedAndCleared`'s titles, in a commit of tests of its own, red there, before the line is drawn.
- The setting's `setUpIn` is the page of the use case that sets it up (MOD-browser-store.md:49-50): UC-044, where a Bridge
  is paired, as UC-049 names it for a CLI session.
