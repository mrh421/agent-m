---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - d96f49417c6d8b1ae9fce5ed27fe697fdd6467bd
  - https://github.com/akmaier/agent-m/pull/1682
date: 2026-11-01 16:37 UTC
---
# Development → Release testing: ITM-376, #1682, the system and release tests of UC-018

**REGISTER**

## Reason

ITM-376 was written by developer-opus-e (`Agent-M-Participant` on `ead8f1945`, `efdf72741`, `755e05c88` and `d96f49417`). I
wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41326091007 (`d96f49417`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:** `tests/uc-018-harness.mjs`, `tests/system-uc-018-edit-a-specification-or-use-case.test.mjs`
   (TST-376201 to 376222) and `tests/release-uc-018-edit-a-specification-or-use-case.test.mjs` (TST-376301 to 376320).
   MOD-test-document reads 42 declarations with no finding. TST-3762nn and 3763nn had no history (known positive:
   TST-740201).
4. **Who wrote what it tests.** On UC-018's path opus-e built ITM-1273, 1266 and 1314. `NO PROPOSAL WITHOUT THE CURRENT
   TEXT BESIDE IT` and `STATUS IS DERIVED FROM THE RECORDS` are in `BUILT_BY_WRITER` and are mapped to TST-371303, 690001
   and 1266301, which other participants wrote. TST-376301 checks that no case of this file guards them.

   I compared every item whose code opus-e wrote, by `Agent-M-Participant` on `src/`, with the requirements this file's
   release cases guard. The overlaps are `ONE CLICK PER DECISION` (ITM-1058, 1319, 779) and `EVERY STEP EXPLAINS ITSELF`
   (ITM-779, 1379), through the plan page, the backlog, the process-model editor and a CI job. The cases guarding them
   walk the editors' *Save* and their folded explanations, which those items did not build. Through ITM-1273 (the
   requirement's editor reads its own queue), UC-018's one open queue is guarded by TST-376320. It is a `todo` that names
   UC018-F1, and the editor's line it names (`src/review-pages/edit.mjs:96`) is ITM-359's and ITM-611's, not opus-e's.
5. **The Acceptance holds:** TST-376201 maps the seven steps and the thirteen alternative flows, the existing unit tests
   among them. TST-376301 maps the 22 requirements UC-018 realises. The pull request records 26 planted faults, and every
   case but the two maps and the five `todo` cases fails on one. P25's catch is the time limit.

## Findings, ruled

Each one points at a module whose accepted text assigns the route or function, so each is an item, registered in this
commit:
- **UC018-F1, TST-376206 and 376320 → ITM-1397 (MOD-review-pages).** The editor hands the token's name as the person
  (`edit.mjs:96`), which `openQueueIn` never matches with a queue's creating account. So each edit opens a new queue,
  against `A PERSON'S EDITS COLLECT IN ONE OPEN QUEUE`.
- **UC018-F2, TST-376217 → ITM-1398 (MOD-review-pages).** After a refused save, the editors compare with the blob first
  opened (`edit.mjs:64`, `file-edit.mjs:143`), where UC-018 5a compares "against the newer SHA". The module's "every save
  only on the blob the file or section was opened on" is read as the newer version the refusal shows; the reading is in
  the item.
- **UC018-F3, TST-376213 → ITM-1399 (MOD-review-pages).** The editors carry no link to the arrangement that 3e names; only
  the lists do (`flow.mjs:326`).
- **UC018-F4, TST-376222 → ITM-1400 (MOD-spec-document).** `parseSpec` reads no requirement from an empty name or a bare
  bold name (`src/spec-document/parse.mjs:22,26`), so the empty fields of `requirements/new` (3d) get no mark. Its text
  says a requirement missing a field is read with that field `null`.

## Readings taken

- Step 7's "opens" is the new entry.
- 3c's mark stays visible when the file is opened again.
- 4a's text stands beside GitHub's page.
- 6b is GitHub's work.
- A queue's person is the account that created its index.
- *Save* is one click once its inputs are given.

All are taken.
