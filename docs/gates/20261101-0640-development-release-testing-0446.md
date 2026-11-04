---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - b39b5eba670cb239a8c0798d5427c1e18c26d29f
  - https://github.com/akmaier/agent-m/pull/1609
date: 2026-11-01 06:40 UTC
---
# Development → Release testing: ITM-446, #1609, the check of the due diligence

**REGISTER**

## Reason

ITM-446 was written by developer-sonnet-j (`Agent-M-Participant` on `f5b8b30ad` and `b39b5eba6`). No commit of
`src/reuse-facts/` carries that trailer; the module's commits name developer-sonnet-b and developer-sonnet-c. I wrote none
of it.
1. **No red run, and none is required.** The item adds release tests over code that exists, and no behaviour. The
   Acceptance asks for no failing first commit. `AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST` binds a job "that adds
   or changes behaviour" (SPEC.md:1466-1469), as ITM-806's gate read it. Both heads are green: run 41280528899 on
   `f5b8b30ad` and run 41280621857 on `b39b5eba6` (pull_request, first attempt). The sprint branch is the head's ancestor.
2. **Only `tests/test_reuse_due_diligence.py` and its data file `tests/test_reuse_due_diligence.md` change**, as the
   Acceptance names them. The cases stand in the data file (AGENTS.md §7).
3. **MOD-test-document's reader:**
   - `testDeclarations` reads 4 cases (TST-446100 to 446103), each of level `release` with `module: system`.
     `testFindings` reports none.
   - `testHeader` gives MOD-reuse-facts, level `release` and the four requirements, with no finding.
   - The second commit changes only the declarations' `module` to `system` (MOD-test-document.md:59). No expectation
     changes.
4. **The Acceptance holds.**
   - TST-446103 reads the record that the step `due-diligence` writes. It passes on that record, and fails with exactly
     one finding when one *Read on* or one *Read from* is blanked. This is the Check of `DUE DILIGENCE IS FETCHED, NOT
     RECALLED`, read as the test itself (141.md, *The items set aside, read again*).
   - The pull request records 7 planted faults, each with the cases that fail on it.

## Readings, ruled

- **A PRODUCT DECLARES ITS LICENCE is covered by the case of a product without `LICENSE`.** That is what the item's
  Outcome names. Taken.
- **The blocked-registry mark is not tested.** The Outcome does not list it (YAGNI). Taken.
- **MOD-reuse-facts names a part `strategies.mjs` that does not exist.** The step lies in `src/reuse-facts/index.mjs`,
  inside the module's folder, so `A MODULE IS A FOLDER` holds. This is noted as a point of the module text, to be set right
  the next time MOD-reuse-facts' file is changed. No item.
- The reading was returned once, because SPEC.md and 141.md had been read only in part. Both are now read in full, as the
  brief asks.
