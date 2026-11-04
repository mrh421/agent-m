---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 27f866a11c922fc6e3a7df65ae7c783dab481efb
  - https://github.com/akmaier/agent-m/pull/1698
date: 2026-11-01 19:49 UTC
---
# Development → Release testing: ITM-991, #1698, the system and release tests of UC-041

**REGISTER**

## Reason

ITM-991 was written by developer-opus-e (`Agent-M-Participant` on `6e4b56505` and `27f866a11`). I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41342890229 (`27f866a11`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:**
   - `tests/uc-041-harness.mjs`;
   - `tests/system-uc-041-close-a-sprint.test.mjs` (TST-991201 to 991212);
   - `tests/release-uc-041-close-a-sprint.test.mjs` (TST-991301 to 991306);
   - `tests/test_time_box_close.py` (level release, TST-991401 to 991404 and 991406), the check the SPEC names for the close.

   Their identifiers had no history (known positive: TST-1330101).
4. **Who wrote what it tests.** opus-e built ITM-987, 1171, 1260 and 1264. The five requirements whose UC-041 behaviour those
   built are in `BUILT_BY_WRITER` and mapped to other writers' release tests:
   - `A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT`: TST-987301 and 987302;
   - `A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN`: TST-1171101 and 472502;
   - and three more.
5. **The Acceptance holds:** every requirement UC-041 realises has a release test. TST-991201 maps the seven steps and the
   alternative flows, and TST-991301 maps the 14 requirements. Each of the planted faults P1 to P21 fails a named case.

## Ruled

- **The two cases left for another writer are not written now.** `tests/test_phase_branch.py` and the case of
  `test_time_box_close` for `A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT` would guard behaviour opus-e built (ITM-1171,
  ITM-987). Both requirements already have release tests by other writers, mapped above, which is what the item's
  Acceptance asks for.
  - Noted: the SPEC names `tests/test_phase_branch.py` as a check, and the file does not exist. That is a candidate for the
    review, not registered now.

Each finding points at a module whose accepted text assigns the function, so each is an item, registered in this commit:
- **UC041-F1, TST-991207 → ITM-1403 (MOD-work-plans).** `sprint-record` reads the sprint from the draft
  (`strategies.mjs:462`), which `close-sprint`'s answer does not name, so nothing is recorded.
- **UC041-F2, TST-991305 → ITM-1404 (MOD-work-plans).** An unattended close writes "Sources of the feedback: none."
  (`saves.mjs:214`), against `AN AGENT'S REVIEW NAMES WHERE ITS FEEDBACK CAME FROM`.
- **UC041-F3, TST-991203 → ITM-1405 (MOD-work-plans).** `sprint-facts` calls `itemStates` with the statuses alone
  (`strategies.mjs:145`), so the closer reads another state than Progress shows.
- **UC041-F4, TST-991306 → ITM-1406 (MOD-work-plans).** A retrospective's process change is written only as a line of the
  record (`saves.mjs:266`), where the SPEC's check asks for an open queue entry. MOD-work-plans says "the proposals of the
  retrospective stay proposals", and that is read as entries of a change queue; the reading is in the item. Noted for
  akmaier: the module text does not list this, and its Uses name MOD-spec-changes' `Queue` and `queues` but no writer of
  an entry.
- **UC041-F5, TST-991206 → ITM-1407 (MOD-job-catalogue).** `close-sprint`'s answer schema and prompt name no `newItems`
  (UC-041 step 6).

## Readings taken

- Step 2's "the closer derives" is the recipe `sprint-facts`.
- 7a and 7c are the host's work; Agent M's part is the hold.
- 6a is the runner's next request.
- The gate at the end is Sprint Retrospective → Sprint Planning, decided by the Product Owner.
- Queue entries are written only for changes to the process model, the Definition of Done or a participant's
  instructions.

All are taken.
