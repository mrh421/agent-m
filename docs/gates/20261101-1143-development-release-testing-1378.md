---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - ec32c5ea4a73172f868b844e44de0cc7dd38fdd7
  - https://github.com/akmaier/agent-m/pull/1659
date: 2026-11-01 11:43 UTC
---
# Development → Release testing: ITM-1378, #1659

**REGISTER**

## Reason

ITM-1378 (a CI start record names its participant's driver) may go on. The pull request is #1659 into `sprint/team1/141`,
at `ec32c5ea4`. developer-sonnet-k wrote the tests and the code (`Agent-M-Participant` on both commits). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `43df23b70` changes `tests/runtimes-ci.test.mjs`
   (MOD-runtimes) only. In run 41301903430 it fails TST-1378001. The same run failed one case of
   `tests/review-pages-release-limitations.test.mjs`, a known flip of the brief (ITM-1287), in a file not touched, which
   passes on the head.
2. **CI is green on the head:** run 41302810089 (`ec32c5ea4`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only the item's module changes:** `src/runtimes/ci.mjs`, `index.mjs` and `tab.mjs`. `queueJob` on the CI route adds
   to the start the endpoint `{ kind, baseUrl, model }` stored for the participant, read with `readSetting` (among the
   module's Uses), and the name of its key's secret; no key. A start that names them already, no store, or nothing stored
   leaves the start as it is.
4. **The Acceptance holds:**
   - TST-1378001 to 1378003: the CI start names the endpoint and the secret's name and no key; without a stored endpoint
     the start's own parameters stay; the tab's route gets nothing. The pull request records four planted faults.
   - The probe over 1031 files moved no page's start.
5. **Reading noted:** sonnet-k read the lines of 141.md on ITM-1378 only, where the brief asks for the record in full.
   The brief's rules the item touches — scope, the tests-only first commit, the `todo` by another participant — hold in the
   pull request. Noted for the retrospective.

## Rulings

- **TST-373211 needs a second fix → ITM-1381 (MOD-workflow-entries), registered in this commit.** The entry reads a queued
  job's key's secret only from a route `ci <runner> secret <NAME>` (`src/workflow-entries/product.mjs:36`, `:201`, `:302`),
  while a model endpoint's route names its secret as `endpoint <name> secret <NAME>` (MOD-participant-list) and the entry
  runs a job with "the participant's key from its secret". The secret's name is read from the participant's route in the
  register, which holds it; the record's `secret` is not needed for that. ITM-1378's Acceptance now gives TST-373211's lift
  to ITM-1381.
- **`endpoint:ci-bot` in `tests/uc-010-harness.mjs`** is fixture data of that lift, written in the same commit by the
  participant who lifts the `todo`.

## Reading taken

- The endpoint is found by `endpoint:<participant's name>`, the name the prompt bar's `endpointsOffered` gives; a
  participant whose endpoint is stored under another name is not found, and its start is unchanged. Taken.
