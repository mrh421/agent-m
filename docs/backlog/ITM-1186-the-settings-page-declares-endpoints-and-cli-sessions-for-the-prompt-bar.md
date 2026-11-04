---
id: ITM-1186
title: The settings page declares an endpoint's place, context and CI secret, and each CLI session a Bridge offers
level: module
realises:
  - UC-003
  - UC-044
  - UC-049
modules:
  - MOD-settings-pages
builds_on:
  - ITM-1185
tests:
  - unit
origin:
  - akmaier's request, accepted in MOD-settings-pages at blob d45280df (f35b9903), UC-003 at 4d58ee7b and UC-044 at 44308017 (9559c14f), 2026-10-22
---
# ITM-1186 The settings page declares an endpoint's place, context and CI secret, and each CLI session a Bridge offers

**REGISTER**

## Outcome

The accepted text, `docs/architecture/MOD-settings-pages.md`:
- `endpoints` (:191-207) asks, beside the address, model and key, the place where the endpoint processes data, the
  model's context in tokens, and the name of the CI secret that holds its key (UC-003 step 2).
- `bridge` (:240-253): for each CLI session a Bridge offers, as MOD-bridge-client's `testBridge` lists it, the page asks
  the place, the context, the model and the capabilities, prefilled as for a CLI agent (UC-017). It keeps them under
  `session:<bridge>:<agent>`. A session lacking a place, a context or a model is named as not offered in the prompt bar
  (UC-049 1b).

**Built on `main` since `35f3485d`** (with `fd01d2ee`, `d8242efa`, `6a787486`, `5db55fa7` and `ed547bd3`):
- the endpoint form keeps `place`, `context` and the name of the CI secret in `endpoint:<name>`, and an endpoint lacking a
  place, a context or a model is named on its line and its page (`endpointLacks`);
- the job workflow's *Install* (`jobWorkflowInput`, `src/settings-pages/settings.mjs:900-915`) names among its `keys`,
  beside the CI secrets of the participants' routes, the CI secret each of this browser's endpoints names.

What is left is the `bridge` section's CLI sessions.

## Acceptance

- The endpoint form and *Install*'s keys stand as built (`35f3485d`); their tests stay green, and neither is built
  again.
- The `bridge` section lists the CLI sessions of a tested Bridge and keeps each declaration under
  `session:<bridge>:<agent>`. Each lacking place, context or model is named where it is configured.
- Counter-proof: a session declared with all three is not named as lacking.
- The draft `668a3ce1` is accepted (MOD-settings-pages blob `51b5fa1f`): the endpoints page carries a folded explanation
  that the prompt bar appears once an endpoint is configured or a Bridge offers a CLI session (MOD-settings-pages.md:206-207,
  UC-049 1a), and the participants page no longer says it. Today `PROMPT_BAR_NOTE` (`src/settings-pages/endpoints.mjs:262`)
  still names "a model endpoint, a CLI agent or a sandboxed agent", and `tests/settings-pages-prompt-bar-note.test.mjs`
  (TST-1128001) pins it on both pages; that test follows the accepted text, the explanation standing on the endpoints page
  only.
- The tests of other cases the change moves, named by the planning run below:
  - TST-265008 (`tests/settings-pages-endpoints.test.mjs`) counts the endpoints page's folded explanations; it counts one
    more, the prompt bar's, whose summary is *What is this?* as every other fold of the page.
  - TST-513025 (`tests/system-uc-049-pages-of-mail-and-settings.test.mjs`, a system test) asks the participants page to name
    the prompt bar. It follows UC-049 1a as accepted, "The settings page says that it appears once an endpoint is
    configured or a Bridge offers a CLI session": the endpoints page says it, and the participants page does not. It is
    changed on the item's branch, in a commit of its own, by a participant who implemented none of this item.
- The first commit holds only the tests, and CI is red on it.

**The planning run (sprint team1/126).** A stand-in on `main` at `02fb1fe16`:
- `bridge.mjs` draws, for each Bridge kept under `bridge:<name>`, *Test*, which calls `testBridge` on `settingsOf` of that
  Bridge and the jump host, and a form for each agent it lists ready: place, context, model and the capabilities, prefilled
  with a CLI agent's preset when nothing is kept. *Save session* writes `session:<bridge>:<agent>` in the shape of an
  endpoint's declaration, the context only where it is a whole number of tokens. A line names what the session lacks, in
  `endpointLacks`' words.
- `endpoints.mjs` draws `PROMPT_BAR_NOTE`, "The prompt bar appears once an endpoint is configured in this browser or a
  Bridge it keeps offers a CLI session.", in a fold with the summary *What is this?*. `participants.mjs` no longer draws it.
- 268 test files that name MOD-settings-pages, its folder, `PROMPT_BAR_NOTE`, `prompt-bar-note`, MOD-site-frame, whose
  `dashboard-app.mjs` loads the module, `site-usability`, `site-accessibility` or a `session:` key. Three cases fail only
  with it: TST-1128001, TST-265008 and TST-513025, named above. `trace-graph-import-uses` passes with it.
- Reads: drawing the route `bridge` sends no request; each *Test* sends the two of `testBridge`, `/v1/pair` and
  `/v1/agents`.
