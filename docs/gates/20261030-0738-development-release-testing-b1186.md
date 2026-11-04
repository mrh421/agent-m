---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 8383866180720cd52d06a0d1939e3424cdd8b359
  - https://github.com/akmaier/agent-m/pull/1509
date: 2026-10-30 07:38 UTC
---
# Development → Release testing: ITM-1186, the Bridge page declares each CLI session a Bridge offers

**REGISTER**

## Reason

ITM-1186, pull request #1509 into `sprint/team1/126`, passes on `83838661`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `3308aeb9`:** run 41018662181 (`pull_request`) fails in three jobs, and only on the item's cases.
     - TST-1186001 to TST-1186005 of the new file fail.
     - The changed TST-265008 counts eight folds where it now expects nine.
     - The changed TST-1128001 asks for the fold on the endpoints page and for no prompt-bar sentence on the participants
       page.
     - That is the item's reason.
   - **Implementation commit `efdd320c`:** run 41018972438 fails in one job, only on TST-513025 of
     `system-uc-049-pages-of-mail-and-settings`.
     - That test still asked the participants page to name the prompt bar.
     - The planning run named it, and the Acceptance has it changed by a participant who implemented none of the item.
     - The `✖` lines of TST-377011, 377016 and 377017 in that job are `todo` findings, as on the base.
   - **Head `83838661`:** developer-sonnet-l's commit of its own changes TST-513025. Run 41019265884 (`pull_request`)
     succeeds: 41 jobs succeed, 17 are skipped, none failed.
2. **Only the item's files change.**
   - MOD-settings-pages: `bridge.mjs`, `endpoints.mjs` and `participants.mjs`.
   - The tests the Acceptance names: TST-1128001, TST-265008, TST-513025, and the new
     `tests/settings-pages-bridge-sessions.test.mjs`.
   - No top-level await is added.
   - `participants.mjs` now exports `CAPABILITIES` and `PRESETS` to `bridge.mjs`, a part of the same module.
     - The module's interface is `view` (MOD-settings-pages, `provides:`), and `index.mjs` exports neither.
     - So no interface changes, and the preset is the module's own, not a copy, as the planning's brief asks.
     - TST-106805 passes on the head.
3. **It builds the accepted text and the item's Acceptance** (MOD-settings-pages.md:206-207, :253-256;
   MOD-browser-store.md:72).
   - The route `bridge` draws, for each Bridge this browser keeps, *Test*, and drawing sends no request (TST-1186001).
   - *Test* sends the two requests of `testBridge` with the Bridge's token. It draws a form for each agent it lists ready,
     none for one not ready, and checks the CLI agent's preset (TST-1186002).
   - *Save session* keeps `session:<bridge>:<agent>`. The context is kept only where it is a whole number of tokens, as an
     endpoint's declaration keeps it (TST-1186003).
   - A session lacking a place, a context or a model is named as not offered in the prompt bar, with what it lacks, in
     `endpointLacks`' words (TST-1186004). The counter-proof is TST-1186005: a session declared with all three is not
     named as lacking.
   - The endpoints page carries the explanation in a fold with the summary *What is this?*, and the participants page no
     longer says it (TST-1128001, TST-265008, TST-513025). That is UC-049 1a as accepted: "The settings page says that it
     appears once an endpoint is configured or a Bridge offers a CLI session."
4. **The pull request's readings.**
   - **Only the capabilities are prefilled. It holds.**
     - The text asks the fields "prefilled as for a CLI agent (UC-017)" (MOD-settings-pages.md:254-255).
     - UC-017 step 5 has Agent M preset the place "where it can tell (*this machine* for a CLI agent)".
     - A Bridge kept here may run on another computer, reached through a forward or the jump host (UC-044 4d). The page
       cannot tell where that is, so it asks.
     - The participants page, whose CLI agent the text names, starts its place empty too.
     - An empty place is named as lacking (TST-1186004), so no session is offered with a place it does not declare.
   - ***Test* writes no `last-test:`. It holds.**
     - The text of `bridge` names a test of a Bridge and the sessions it lists, and no record of the test.
     - The session's line on `settings` keeps its own last test, as built by ITM-1185.
5. **Counter-proofs, made on the head and restored after.**
   - A form drawn for every agent, ready or not, fails TST-1186002.
   - A context kept as `null` where it is no whole number fails TST-1186003.
   - The red tests-only run is the code as it stood.
   - Restored: 76 of 76 pass on Node 26, across:
     - the four changed or new files;
     - `release-itm-1185-session-declaration` and `dashboard-settings-last-test`;
     - `trace-graph-import-uses` and `test-document-one-line`.
   - In this checkout: `test_no_backend`, `test_settings_page`, `test_settings_disclosure`, `test_self_sufficient`,
     `test_pages_layout` and `test_artifact_format`, OK.
6. **MOD-test-document's reader:**
   - `tests/settings-pages-bridge-sessions.test.mjs`: 5 declarations, 0 findings. The header gives MOD-settings-pages,
     level `unit`, and no finding.
   - `tests/settings-pages-endpoints.test.mjs`: 31 declarations, 0 findings.
   - `tests/settings-pages-prompt-bar-note.test.mjs`: 1 declaration, 0 findings.
   - `tests/system-uc-049-pages-of-mail-and-settings.test.mjs`: 5 declarations, 0 findings. Its header gives level
     `system`.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - Each declared known positive and counter-proof is asserted in its case.
7. **Reads, against the planning count** (`team1/126.md`). TST-1186001 asserts that drawing the route sends no request,
   and TST-1186002 that one *Test* sends exactly `/v1/pair` and `/v1/agents`. That is the count the planning's stand-in
   gave.

## Noted

- TST-513025's declaration still joins its modules as "MOD-prompt-bar · MOD-settings-pages", as on the base. The reader
  takes MOD-prompt-bar, as sprint 125 noted. The item did not write that line.
- The pull request's description names no `JOB-` identifier and gives no run's id; the runs are those above.
