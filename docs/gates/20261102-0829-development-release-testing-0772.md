---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - d81ea2e310476e23251b28bc946b08aa57ea570d
  - https://github.com/akmaier/agent-m/pull/1715
date: 2026-11-02 08:29 UTC
---
# Development → Release testing: ITM-772, #1715, the system and release tests of UC-027

**REGISTER**

## Reason

ITM-772 was written by developer-opus-e (`Agent-M-Participant` on `d81ea2e31`). I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41412864511 (`d81ea2e31`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:**
   - `tests/uc-027-harness.mjs`;
   - `system-uc-027-configure-continuous-integration` (TST-772201 to 772217);
   - `release-uc-027-configure-continuous-integration` (TST-772301 to 772311).

   The pull request changes nothing under `src/`. A planted fault left by the crash was restored before the commit.
4. **Who wrote what it tests.** opus-e built ITM-1265, the test counts per row. That behaviour is in `BUILT_BY_WRITER`,
   mapped to TST-476801 and TST-1307301, which other participants wrote. No case of this file guards it.
5. **The Acceptance holds:**
   - No alternative flow is left unwalked.
   - The pull request records 19 counter-proofs.
   - F04's catch is the time limit of the system file, and F10 was replaced, since the host returns only the newest run
     per event. Both are recorded.

## Findings, ruled

Each is an item, registered in this commit:
- **UC027-F1, TST-772217 → ITM-1418 (MOD-test-pages).** The page shows four occasions and leaves the release candidate to
  the release panel, where MOD-test-pages' `schedule` shows "the last run per occasion". A release candidate's run is a
  tag's push, and `CiRun` names no ref. MOD-test-pages' Uses name `listTags` and `listCiRuns`, so the item reads the
  release candidate's run as the newest on a commit a release tag names, with no new field. Only if the probe finds no
  commit to match does it stop for the Product Owner. Nothing is asked now.
- **UC027-F2, TST-772210 → ITM-1419 (MOD-test-schedule).** `configurationDrift` names a foreign GitHub workflow's triggers,
  but of a foreign `.gitlab-ci.yml` only that its include is missing. Its text gives the triggers "for a configuration
  Agent M did not generate", whatever the server.
- **The schedule page's *Save* and *Merge* act on a script's click → ITM-1420 (MOD-test-pages).** MOD-site-frame's forms
  and MOD-test-pages' own generate page check that a click is trusted, against `THE DASHBOARD WRITES ONLY ON A PERSON'S
  CLICK`. No case guards it yet, and the item writes one.

## Noted

- A paid service's commit box that was ticked by hand and then cleared stays enabled, while *Save* stays refused as long
  as it is ticked. No rule is broken. It is a candidate for the review, not registered.

## Readings taken

- The fixture server is an in-memory repository behind the host's interface.
- The secrets and runner pages are the host's `webLinks`.
- 3a's link is shown after the merge sets the schedule.
- 6a's failing tests are UC-028's page of a commit.
- 1b's offer is the drift's note, after which *Save* generates the configuration again.
- The default schedule is checked on what *Save* commits.
- The rule of green CI is read for the schedule's own pull request.

All are taken.
