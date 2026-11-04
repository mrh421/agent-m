---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 60c9b908ae953609c3069df59b4a64e8f956b658
  - https://github.com/akmaier/agent-m/pull/1734
date: 2026-11-02 12:05 UTC
---
# Development → Release testing: ITM-1430, #1734

**REGISTER**

## Reason

ITM-1430 (the audit shows whether a model-dependent test reached its rate) may go on. It was built under the reading
ruled in 142.md (`9da93e931`). The pull request is #1734 into `sprint/team1/142`, at `60c9b908a`. developer-opus-e wrote the
tests-only commit `7a3dbd7ff` and the code `8c87c609e`; developer-sonnet-l wrote `60c9b908a`, the lift of TST-775207's
`todo`, after the code was pushed (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.**
   - It adds TST-1430001 to 1430003 to `tests/release-evidence-audit.test.mjs` (MOD-release-evidence), and TST-1430004 and
     1430005 to `tests/trace-pages-audit.test.mjs` (MOD-trace-pages).
   - TST-756003's expected row gains `passed: true, lastRate: null`, as the item said.
   - In run 41435895368 these are the only failing cases.
2. **CI is green on the head:** run 41436600010 (`60c9b908a`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's modules change:** `src/release-evidence/audit.mjs` and `src/trace-pages/audit.mjs`.
   - `auditRows` (:145) gave a model-dependent test its rate as its outcome, and counted passing from the outcome (:154).
     The page counted as passing only an outcome `passed` (`trace-pages/audit.mjs:34`).
   - Now each test also gives `passed`, true when its outcome passed and its rate is no worse than the last release's, and
     `lastRate`. Its outcome stays the rate. The summary and the page count passing from `passed`.
   - The page counts as not passed a rate test that did not pass and is not worse. It shows the last release's rate and
     the verdict, and the export writes them.
4. **The Acceptance holds:**
   - A model-dependent test's row names its rate, the last release's rate and whether it passed. One that did not run is
     counted among those that did not pass.
   - The eight counter-proofs in the pull request each fail a new case.
   - TST-775207 loses its `todo`: red at `7a3dbd7ff`, green at `8c87c609e`. Its expectation's words are kept, and only the
     finding's label goes. sonnet-k wrote the case, and sonnet-l built none of either module.

## Readings taken

- The fields are named `passed` and `lastRate`. MOD-release-evidence's text lists neither, which stays noted for akmaier.
- The export names the verdict only for a rate test that carries `passed`, so TST-757103's fixture keeps its line.

Both are taken.

## Noted

- A model-dependent test that did not complete and whose rate is also worse counts on the page as worse only, while the
  summary also counts it as not passed. The fields cannot tell the two apart. It is a candidate for the review, not
  registered now.
