---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 708e21b9d80611b3c566a3b1c2f2af19589ec32f
  - https://github.com/akmaier/agent-m/pull/1645
date: 2026-11-01 10:18 UTC
---
# Development → Release testing: ITM-585, #1645, the system and release tests of UC-012

**REGISTER**

## Reason

ITM-585 was written by developer-opus-e (`Agent-M-Participant` on `88775ca68` and `708e21b9d`). No commit of
`src/maintenance-pages/` or `src/issue-handling/` on the sprint branch carries that trailer; theirs name developer-opus-f
(9), developer-sonnet-f, developer-sonnet-k and scrum-master-opus-c (known positive: the same count finds opus-f). I wrote
none of it.
1. **No failing first commit:** a battery adds no behaviour (141.md, *Readings taken*).
2. **CI is green on the head:** run 41296149869 (`708e21b9d`), at the first attempt, and run 41296146000 on the same
   commit. `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:**
   - `tests/uc-012-harness.mjs`;
   - `tests/system-uc-012-handle-an-issue.test.mjs`;
   - `tests/release-uc-012-handle-an-issue.test.mjs`.
4. **MOD-test-document's reader:**
   - `testDeclarations` reads 7 system cases (TST-585201 to 585207) and 13 release cases (TST-585301 to 585313). Each
     declares `module: system`, and `testFindings` reports none.
   - `testHeader` gives MOD-maintenance-pages and MOD-issue-handling for all three files, with no finding.
5. **The Acceptance holds:**
   - Every requirement UC-012 realises has a release case (TST-585301 maps them).
   - The system file and the existing `tests/system-uc-012-fix-a-bug.test.mjs` (TST-583401, 583402) walk the main flow
     and every alternative flow (TST-585201 maps them).
   - The pull request records a planted fault for every case that is not a `todo`, and each fails on it.

## Finding, ruled

- **UC012-R1 (TST-585306) → ITM-1365**, registered in this commit. The issue page's run panels offer a person of the
  register (`src/maintenance-pages/issues.mjs:134-136`). UC-012's Actors hand the work to "the model endpoint or agent",
  and MOD-participant-list's interface tells a caller choosing who receives a job to ask among the four other types
  (MOD-participant-list.md:92-94). It is a defect of MOD-maintenance-pages against accepted texts, and it can be built.

## Readings taken

- CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI: the fix's Run writes only job records, and *Close
  with links* comes only once the fix's pull request is merged.
- A PROCESS MODEL ORGANISES PEOPLE AND AGENTS is read through UC-012's actors.
- ONE CLICK PER DECISION: a decision whose inputs are complete is written by its click.
- Step 6 is walked up to the item the move prefills; adding it is UC-033's.
- 3a: an issue that names no requirement sends the whole SPEC.
- 5a is shown from the fix job's open pull request.
- An issue from a mail lists its `MAIL-` identifier.

All are taken.

## Noted

- ITM-585's text says `tests/` holds no `system-uc-012*` file, while `tests/system-uc-012-fix-a-bug.test.mjs` (ITM-583)
  stands. The battery maps it into TST-585201 instead of repeating it.
