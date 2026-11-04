---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - eaabd0bff8c6280738f370ee414abd705c2d63b3
  - https://github.com/akmaier/agent-m/pull/1420
date: 2026-10-29 08:34 UTC
---
# Development → Release testing: ITM-1275, a test's history reads a run's log only when the person opens it

**REGISTER**

## Reason

ITM-1275, pull request #1420 into `sprint/team1/114`, passes on `eaabd0bf`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green on the head.** Run 40841875847, `pull_request`, on `eaabd0bf` concludes `success` in its attempt 2. All
   38 of its pull-request jobs pass.
   - **Attempt 1 failed seven jobs, all for one cause outside this item.** These were component shards 1 to 3, system
     shards 1 and 2, and release shards 1 and 2.
     - Every failing case is in one of seven files that stage Electron:
       - `site-usability`, `site-accessibility` and `release-itm-1174-917-rendered` (MOD-site-frame);
       - `desktop-shell`, `desktop-shell-bridge-jobs` and `release-itm-276-desktop-shell` (MOD-desktop-shell);
       - `markdown-render-918-diagram-drawn` (MOD-markdown-render).
     - Every one fails at "Electron package acquisition". There, `npm install … electron@44.5.1`
       (`tests/site-usability.d/browser.mjs:74`) got `npm error 404` from one address, 370 times:
       `https://registry.npmjs.org/@electron-internal/extract-zip/-/extract-zip-1.0.8.tgz`.
     - No case of MOD-trace-pages failed, and no failure has another cause.
     - Attempt 2 reran the failed jobs on the same commit, and they passed.
   - **CI is green on the head.** The gate asks "CI is green on it" (`docs/process-models/scrum-wip.md:53`).
     - The run on this commit concludes `success`.
     - The failures of its first attempt are not this pull request's: they occur before any code of the item runs, in
       tests of other modules.
   - **Registry fault or flaky test: both.**
     - The cause is the registry. The same address answered 200 when the Scrum Master asked it after attempt 1.
     - The tests are still flaky by A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY (SPEC.md:1587-1589): each recorded a
       failing and a passing outcome on `eaabd0bf`. The rule asks for that outcome to be "shown as flaky, never as
       passed". It does not ask about the cause.
     - Their outcome depends on fetching a package at run time. That is a defect of those tests, not of #1420.
     - It is registered as **ITM-1306**, as the flips of ITM-1287 and ITM-1295 were. It is no reason to hold this item.
2. **Red first.** The commit `50a25ae8` holds only tests, and its run 40841417649 fails two jobs, each for the item's
   reason.
   - **Component shard 8:** of all its files, only `trace-pages-test-history-logs` fails, in its three cases.
     - TST-1275001 receives the jobs requests of runs 901 to 905 and the logs requests of their ten jobs, where it expects
       none.
     - This is the Acceptance's counter-proof, "today's page sends five".
   - **Unit shard 2:** only TST-1168001 fails.
   - The implementation commit `eaabd0bf` changes only `src/trace-pages/test-detail.mjs`, and no test.
3. **Only its module changes.**
   - Code: `src/trace-pages/test-detail.mjs`.
   - Tests: the new `tests/trace-pages-test-history-logs.test.mjs` and `tests/trace-pages-test-detail.test.mjs`. The
     headers of both name MOD-trace-pages.
   - As its Acceptance says, no test of another module changes.
   - The code adds no import. `historyLogLink` keeps calling `webLinks` and `ciRunLog`, which the Uses name
     (MOD-trace-pages.md:23-24).
4. **The Outcome is the accepted text** (MOD-trace-pages.md:162-164): "Whether the server still keeps the log is asked
   when the person opens the link, with `ciRunLog` for that run alone; where it gives `null`, the link reads *no longer
   available*, and the mark keeps its outcome".
   - The link is drawn reading "log", at `WebLinks`' `run`.
   - A click asks `ciRunLog(id)` once. A `null` sets the text to "no longer available".
   - A failed request leaves the link as it was, so that it can be asked again.
5. **No expectation is weakened, and the changed one was red first.**
   - TST-1168001's expectation changed in the tests-only commit: "log" when drawn, and "no longer available" once the
     link is opened. It was red there.
   - That keeps every earlier assertion: the outcome text, both addresses, and the kept log's "log". It adds the state
     before the click.
6. **The readings in the pull request hold.**
   - **"Opens" is a click on the link, which opens the run's page in a new tab.** UC-029 5b says that the link "is marked
     *no longer available*", not when. The item took that reading (ITM-1275, Outcome).
   - **TST-1275001 asserts no request under `…/actions/`.** That is stronger than the Acceptance's "no
     `actions/jobs/<id>/logs`", and TST-1275002 is its known positive.
7. **The reader.** On `eaabd0bf`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `trace-pages-test-history-logs`: 3 declarations, TST-1275001 to 003, and 0 findings.
   - `trace-pages-test-detail`: 13 declarations and 0 findings.

## Noted

- **ITM-1306** is registered in this commit: the seven test files that fetch Electron from the npm registry while they
  run, and fail whenever the registry fails.
