---
id: ITM-1187
title: The prompt bar offers this browser's endpoints and CLI sessions
level: module
realises:
  - UC-049
  - UC-019
  - THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
modules:
  - MOD-prompt-bar
builds_on:
  - ITM-1185
tests:
  - unit
  - system
origin:
  - akmaier's request, accepted in MOD-prompt-bar at blob e6007c77 (f35b9903), UC-049 at 0c086a47 and UC-019 at db5a9f34 (9559c14f), and the SPEC sentence in akmaier's chat of 2026-10-22; the findings UC019-S14 and S15 of #1308
---
# ITM-1187 The prompt bar offers this browser's endpoints and CLI sessions

**REGISTER**

## Outcome

Since `35f3485d` and `fd01d2ee` the bar offers first this browser's endpoints that declare a place, a context and a model
(`endpointsOffered`, `endpointLacks`), and an endpoint that names a CI secret and no Bridge spawns its own job (*Spawn
job*). Beside them it still reads the instance's participant list and offers the participants this browser reaches
(`src/prompt-bar/bar.mjs:501-505`), as MOD-prompt-bar.md:206-208 says, "until the offer of CLI sessions is built". It offers no
CLI session, and where none can do the kind its link goes to `participants` (`bar.mjs:457-462`). The accepted text,
`docs/architecture/MOD-prompt-bar.md:190-208`, says instead:
- It first reads this browser's configuration, and reads no participant list for the offer (UC-049 1).
- It offers each `endpoint:<name>` and each CLI session a stored Bridge offers (`testBridge`) whose configuration
  declares a place, a context and a model. One lacking any of them is not offered (1b), and with none it draws nothing
  (1a).
- It hands each to the job runner in MOD-participant-list's `Participant` shape:
  - for an endpoint, the route is `endpoint <name>`, with ` secret <NAME>`;
  - for a CLI session, it is `bridge <bridge> agent <agent>`, with the model, capabilities, context and place that
    `session:<bridge>:<agent>` declares (MOD-prompt-bar.md:201-202).
- Where none can do the kind, its link goes to the route `endpoints` (UC-019 3a).
- Once the CLI sessions are offered, the participants of the instance's list are no longer offered beside them
  (MOD-prompt-bar.md:206-208).

A hand-over stays as built: one whose result waits for the person runs in this tab (UC-049 4a.1), any other is queued
as a job of the endpoint or CLI session itself (4a.2; MOD-prompt-bar.md:239-244). This item changes nothing of it.

## Acceptance

- `tests/prompt-bar-endpoints.test.mjs` is written. It is the check SPEC.md:413-419 names for THE PROMPT BAR'S
  ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE, and holds the cases and the counter-proof that check names.
- **The system findings close:** TST-377016 (UC019-S14) and TST-377017 (UC019-S15) in
  `tests/system-uc-019-change-by-prompt.test.mjs` lose their `todo` and pass.
- **The release test changes by a participant who did not build this item** (RELEASE TESTS ARE NOT WRITTEN BY THE
  IMPLEMENTER):
  - `tests/prompt-bar-endpoints.test.mjs` leaves `MISSING_CHECKS` in
    `tests/release-uc-049-talk-to-an-agent-in-the-prompt-bar.test.mjs`;
  - the requirement goes into `COVERED_BY_RELEASE`;
  - TST-513202 loses its `todo`.
- The offer is unit-tested with a store holding an endpoint, a Bridge offering a CLI session, and one of each lacking a
  model. Counter-proof: the instance's participant list is not read for the offer.
- The endpoint offer and *Spawn job* stand as built (`35f3485d`) and are not built again.
- Nothing beyond the accepted text. No new route, setting or driver.
- The first commit holds only the tests, and CI is red on it.
- **The tests the change moves,** from the planning run below. Each fixture that offers the bar through a row of
  `docs/participants.md` now declares it in this browser's store instead, and each case that presses *Set up
  participants* presses the link to `endpoints`.
  - In the tests-only commit, by the Developer (7 files, 69 cases): `tests/prompt-bar.test.mjs` (22),
    `prompt-bar-hand-over.test.mjs` (27), `prompt-bar-fixed.test.mjs` (5), `prompt-bar-one-kind.test.mjs` (4),
    `site-frame-prompt-bar.test.mjs` (7) and `site-frame-settings-subject.test.mjs` (2) of MOD-site-frame, and
    `main-page-jobs.test.mjs` (2) of MOD-main-page.
  - On the item's branch, in a commit of its own, by a participant who implemented none of the item (11 Node files,
    113 cases, and 2 Python files, 7 cases), the system and release tests:
    `system-uc-019-change-by-prompt` (11, TST-377016 and 377017 among them), `system-uc-019-change-requirements-by-prompt`
    (8), `system-uc-023-modify-the-architecture` (8), `system-uc-049-pages-of-mail-and-settings` (4),
    `system-uc-049-talk-to-an-agent-in-the-prompt-bar` (22), `release-uc-019-change-by-prompt` (7),
    `release-uc-019-change-requirements-by-prompt` (25), `release-uc-023-review-pages` (14), `release-uc-023-reject` (3),
    `release-uc-049-talk-to-an-agent-in-the-prompt-bar` (9), `release-itm-1186-bridge-sessions` (2: TST-1186301 and
    1186302), `tests/test_job_record.py` (2) and `tests/test_conversation_not_recorded.py` (5). The UC-023 battery's
    participants stand in its helper `tests/uc-023-harness.mjs`, which is changed with them.
  - Read in the run: most cases fail where they wait for the bar to be drawn with a participant of the list; TST-377010
    asks for the link to `participants`; TST-1186301 and 1186302 assert that drawing the route `bridge` sends the Bridge
    no request, and the bar on that page now sends the two below. Each expectation that changes, beyond a fixture's
    offer, is named in the pull request with its reason.
- **Requests counted:** drawing the bar sends, for each Bridge the store keeps, the two requests of `testBridge`,
  `/v1/pair` and `/v1/agents` (MOD-prompt-bar.md:191-194); with no Bridge stored, none, as today. The bar no longer
  reads `docs/participants.md` for the offer, so its draw reads one file fewer of the instance's snapshot. Each count is
  asserted in the new tests, base beside change.

## The planning run (sprint team1/127)

A stand-in: `sessionsOffered(store)` in `offer.mjs` tests each `bridge:<name>` the store keeps with `testBridge(bridgeAt(
settingsOf(…)))`, and offers each ready agent whose `session:<bridge>:<agent>` lacks nothing by `endpointLacks`, as a
*CLI agent* with the route `bridge <bridge> agent <agent>`; a Bridge that cannot be tested offers none. `bar.mjs` offers
`endpointsOffered` and then `sessionsOffered`, reads no participant list for the offer, and links `endpoints` with *Set up
endpoints*. It imports `bridgeAt`, `settingsOf` and `testBridge` of MOD-bridge-client, which the module's Uses name, and
adds no top-level await. `readParticipants` and `offeredAmong` stay for the hand-over and their own tests.

On `main` at `99584273d`, in an export, beside the same 406 files without it (those that name MOD-prompt-bar, its
folder, `startPromptBar`, the offer's functions, *Set up participants*, and the modules that import MOD-prompt-bar —
MOD-site-frame, MOD-settings-pages, MOD-review-pages, MOD-maintenance-pages, MOD-main-page, MOD-run-planner —, with
`site-usability`, `site-accessibility` and `load-per-view`): 182 Node cases in 18 files and 7 Python cases fail only
with it, as listed above. The base's own failures are the same with and without it.
