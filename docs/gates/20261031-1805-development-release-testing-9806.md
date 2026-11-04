---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 37b2b5dffe4dc6154c0926f0124c27c3ca255292
  - https://github.com/akmaier/agent-m/pull/1590
date: 2026-10-31 18:05 UTC
---
# Development → Release testing: #1590, ITM-806 The system and release tests of UC-035

**REGISTER**

## Reason

ITM-806 was written by developer-opus-f, who built none of UC-035's items (by the `Agent-M-Participant` trailers), and I
did none of it.
1. **No failing first commit:** an item of system and release tests adds no behaviour. There is one commit,
   `37b2b5dff`, based on `9a53eb10d`. `git merge-tree` with the sprint branch's `cd42a5bbd` is clean.
2. **CI is green on it:** run 41227147496, at the first attempt.
3. **Only test files** (`git diff --stat`: 4 files, +899): `tests/system-uc-035-follow-progress.test.mjs`,
   `tests/release-uc-035-progress.test.mjs`, `tests/test_progress_view.py` and its data file
   `tests/test_progress_view.md` (AGENTS.md §7). No existing test changes.
4. **MOD-test-document's reader:**
   - `testDeclarations` reads 20 system cases (TST-806001 to 806020), 8 release cases (TST-806101 to 806108) and 5
     Python cases (TST-806201 to 806205), each with level, module and guards.
   - `testFindings` reports none, and `testHeader` reports none for the three code files.
   - The control: the same reader on a copy with TST-806101's `expect` removed reports "no expected result".
   - TST-806nnn was free. The pull request records 26 counter-proofs, one for each passing case.
5. **The Acceptance (with `d9199ea63`) holds, as far as reading shows:**
   - Every requirement UC-035 realises has a release test.
   - SPEC.md:1849-1850's Check exists, with the unknown-measure case (TST-806204, through `modelFindings`) and its known
     positive.
   - 2c is tested.
   - Each disagreement with UC-035 is a FINDING `todo`.

## Findings, ruled

None of them is registered in an open item, so each is a new item for the module its code points into:
- UC035-S1, TST-806002 → ITM-1337
- UC035-S2, TST-806006 → ITM-1338
- UC035-S3, TST-806009 → ITM-1339
- UC035-S4, TST-806011 → ITM-1340
- UC035-S5, TST-806012 → ITM-1341 (MOD-progress-measures and MOD-implementation-pages)
- UC035-S6, TST-806019 → ITM-1342
- UC035-S7, TST-806020 → ITM-1343

Each new item has its first task: read whether the accepted module files state the behaviour. If they do not, the item
is a gap of the architecture, for akmaier.
