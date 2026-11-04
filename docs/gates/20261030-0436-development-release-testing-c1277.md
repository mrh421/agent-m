---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 64e4c841c7a51561ae73ad434de0cbc3fa01d18e
  - https://github.com/akmaier/agent-m/pull/1491
date: 2026-10-30 04:36 UTC
---
# Development → Release testing: ITM-1277, the library reads a failed fetch's log only while a legal text waits for it

**REGISTER**

## Reason

ITM-1277, pull request #1491 into `sprint/team1/124`, passes on `64e4c841`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `5de0ebf7`:** run 41002280798 fails, only in `tests/settings-pages-library-fetch-logs.test.mjs`,
     on its five cases TST-1277001 to TST-1277005. That is the item's reason: the page reads the log of every failed run.
   - **Head:** run 41003376499 (`pull_request`, attempt 1) succeeds.
2. **Only the item's files change.**
   - `src/settings-pages/library.mjs`: `fetchFailures` alone, +7/−1.
     - It sorts the runs by `started`, newest first.
     - It stops once every waiting text has its line, which is at once when none waits, or at the first successful run
       of the event `push`.
     - It reads the log of failed runs only. The one `listCiRuns` stays.
   - The new `tests/settings-pages-library-fetch-logs.test.mjs`.
   - Both are MOD-settings-pages', the item's one module. No existing test changes, as the planning run found.
3. **It builds the accepted text and the item's Acceptance.** MOD-settings-pages.md:222-225: "the logs are read only
   while a legal text waits without its line, newest failed run first, no further back than the newest successful run
   started by a push, and none is read while no legal text waits".
   - The Acceptance's three counts each stand in a case:
     - none read with no text waiting (TST-1277001);
     - one read where the line is in the newest run (TST-1277002);
     - at most two read with a successful push run third newest (TST-1277003: two).
   - TST-1277004 adds two waiting texts, and TST-1277005 a successful dispatch run.
   - No interface changes.
4. **The pull request's three readings are right.**
   - `listCiRuns` and `ciRunLog` are functions of the Host, "the object `connect` returns" (MOD-repository-hosts.md:111),
     as the item records.
   - "Newest" is `started`, since `listCiRuns` states no order (MOD-repository-hosts.md:251-252). The test hands the runs
     oldest first, so the page's own order is what is checked.
   - "A successful run started by a push" is `state` `success` and `event` `push`. That is the accepted text's own
     words, and `CiRun` carries `event` (MOD-repository-hosts.md:144-145). A dispatch run fetches only the text given as
     its input, so it is no bound.
5. **Counter-proofs, made on the head and restored after.**
   - Without the sort, 4 of 5 fail.
   - With every successful run taken as a bound, TST-1277005 fails.
   - Without the stop once each text has its line, 3 of 5 fail, TST-1277001 among them.
   - Restored, 5 of 5 pass. The test's own counter-proof is the page as it stood: the tests-only run above.
6. **MOD-test-document's reader:**
   - `tests/settings-pages-library-fetch-logs.test.mjs`: 5 declarations, 0 findings. Its header gives MOD-settings-pages,
     level `component`, and no finding.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - Each value stands on one line, and `tests/test-document-one-line.test.mjs` passes. The `given`, `input` and `expect`
     of the five, as the reader reads them, are those of the file's declarations:
     - **TST-1277001** — given "a register of one EU legal text that is fetched (it has a version row), and ten failed
       runs of fetch-sources.yml, each of whose logs names that text's identifier"; input "the route `library` rendered";
       expect "the one listing of the runs (the workflow fetch-sources.yml on the branch main) and no log read, since no
       legal text waits; the text is shown Fetched; counter-proof: the page as it stands reads the ten logs".
     - **TST-1277002** — given "a register of one waiting EU legal text SRC-ai-waiting (no version row), and ten failed
       runs on pushes of which only the newest, run-10, has a log naming it"; input "the route `library` rendered"; expect
       "the one listing and one log read, the newest run's (run-10); the text is shown `Fetch failed:` with the line of
       that log which names it; counter-proof: the page as it stands reads the ten logs".
     - **TST-1277003** — given "a register of one waiting EU legal text SRC-ai-waiting, ten runs of which run-08, the
       third newest, succeeded on a push and the others failed on pushes, and no log names the text"; input "the route
       `library` rendered"; expect "the one listing and two logs read, run-10 then run-09, newest first, none further back
       than run-08; the text is shown `Waiting for fetch.`; counter-proof: the page as it stands reads the nine logs of
       the failed runs".
     - **TST-1277004** — given "a register of two waiting EU legal texts, SRC-ai-first and SRC-ai-second, and ten failed
       runs on pushes; the log of run-10 names the first, the log of run-08 names the second"; input "the route `library`
       rendered"; expect "the logs of run-10, run-09 and run-08 are read, in this order, and no older one, since each text
       has its line by then; the first shows the line of run 10 and the second the line of run 8".
     - **TST-1277005** — given "a register of one waiting EU legal text, and ten runs of which run-08, the third newest,
       succeeded but was started by a dispatch, run-03 succeeded on a push, and the others failed on pushes; no log names
       the text"; input "the route `library` rendered"; expect "the logs of the failed runs newer than run-03 are read,
       newest first — run-10, run-09, run-07, run-06, run-05, run-04 — and none of run-03 or older: a successful run that
       no push started is no bound, the newest one that a push started is (the known positive of TST-1277003)".
7. **Locally on the head:** the new file, `settings-pages-library`, `-library-batches`, `-library-versions` and
   `test-document-one-line` give 52 pass, 0 fail.
8. **Reads:** one listing in every case, as before. The logs read fall to 0, 1 and 2 in the Acceptance's three cases,
   against 10 on the base, as the planning probe counted.

## Noted

- The pull request's description says the runs are "to be recorded by the Scrum Master". The runs are those above.
