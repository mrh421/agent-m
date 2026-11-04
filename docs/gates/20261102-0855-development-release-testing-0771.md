---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 835d957a695d859958be101e08c301fa8d9c8897
  - https://github.com/akmaier/agent-m/pull/1718
date: 2026-11-02 08:55 UTC
---
# Development → Release testing: ITM-771, #1718, the system and release tests of UC-026

**REGISTER**

## Reason

ITM-771 was written by developer-sonnet-j (`Agent-M-Participant` on `ed6b03077` and `835d957a6`). I wrote none of it. It
was rejected on `ed6b03077` for 13 cases without a counter-proof (`20261102-0843-development-release-testing-0771.md`).
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41415665265 (`835d957a6`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:**
   - `tests/uc-026-harness.mjs`;
   - `system-uc-026-generate-a-multi-level-test-battery` (TST-771201 to 771213);
   - `release-uc-026-generate-a-multi-level-test-battery` (TST-771301 to 771316);
   - the checks the SPEC names, `test_test_generation_context.py` and `test_counter_proof.py`, each with its data file.

   Nothing under `src/` changed after the planted faults were restored.
4. **Who wrote what it tests.** By the trailers of UC-026's code, others built the flow. sonnet-j's one commit on these
   modules, ITM-1351's `moduleRows` of MOD-trace-graph, lies off it.
5. **The rejection's reason is met.**
   - The pull request now records a planted fault for each of the 13 cases, each naming the case it fails.
   - TST-771311 could not fail, since *Run* disables itself after the first press. It was strengthened in a commit of
     its own: a second click leaves no refusal and starts nothing, and with both guards removed it now fails.
   - Together with the seven faults recorded before, every passing case has its counter-proof. The `todo` cases get
     theirs when they are lifted.

## Findings, ruled

Each points at a module whose accepted text assigns the function, so each is an item, registered in this commit:
- **UC026-F1, TST-771203 → ITM-1423 (MOD-test-pages):** the generation page lists names that are not accepted.
- **UC026-F2, TST-771309 → ITM-1424 (MOD-test-pages):** `implementersOf` misses the implementer of an item that realises
  the selected use case or changes the selected module, against `RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER`.
- **UC026-F3 and F4, TST-771210 and 771314 → ITM-1425 (MOD-result-records):** one item for the checks of the test
  proposals.
  - A case that exercises a module cannot pass both `testFindings` and `differences`. A test names what it guards and the
    module it exercises as two fields (`EVERY ARTIFACT NAMES ITS ORIGIN`), so `differences` follows MOD-test-document.
  - `test-proposals` checks no case's identifier.
- **UC026-F5, TST-771211 → ITM-1426 (MOD-runtimes):** a job's pull request names no date (UC-026 step 8, UC-034 5.3). It
  builds on ITM-1411, which wrote that description.
- **UC026-F6, TST-771209 → ITM-1427 (MOD-workflow-entries):** a CI `write-tests` job's end record holds no draft, so what
  it did not write never reaches `docs/jobs/`.

## Not walked, ruled

- Step 9 belongs to UC-027 and UC-002, whose batteries walk it.
- UC-043's part is the run that akmaier withdrew (`3a3938318`; ITM-1045's gate).
- The planting of faults by the participant stands outside Agent M's code.
- 8a's mark "awaiting implementation" is placed by no text, and 8a's later counter-proof follows that mark. Noted for
  akmaier as a text gap; no item.

## Readings taken

- "Accepted" is read as the text says.
- The existing tests "of the same identifier" are the case's own `TST-` identifier.
- The proposal is made on CI, not in the tab, since an attended tab job ends with no draft.
- A model endpoint stands in for the CI agent.
- TST-771205's existing tests are TST-312 alone.

All are taken.

## Noted

These two are candidates for the review and are not registered now:
- A case classed as a duplicate of an existing test does not draw that test beside it.
- Job identifiers of one minute sort by their random suffix, so the "newest" proposal can be the wrong one when two
  proposing jobs share a minute.
