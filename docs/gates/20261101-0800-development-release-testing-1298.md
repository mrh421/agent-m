---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 264f685654eb242171e773701e01b5c6343f8fb2
  - https://github.com/akmaier/agent-m/pull/1611
date: 2026-11-01 08:00 UTC
---
# Development → Release testing: ITM-1298, #1611

**REGISTER**

## Reason

ITM-1298 (the issue route reads the backlog through MOD-documents' schemas) may go on. The pull request is #1611 into
`sprint/team1/141`, at `264f68565`, by developer-opus-f (`Agent-M-Participant` on both commits). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `d6b73d291` adds
   `tests/issue-handling-backlog-schemas-1298.test.mjs` and `tests/maintenance-pages-backlog-schemas-1298.test.mjs`. In run
   41281648532 (pull_request) the only failures are TST-1298001, 1298002, 1298101 and 1298102.
2. **CI is green on the head:** run 41282315824 (pull_request, `264f68565`), attempt 2. `git merge-tree` with the sprint
   branch's current head is clean. See *The failed first attempt* below.
3. **Only the item's modules and their tests change.** The code is `src/issue-handling/backlog.mjs` and
   `src/maintenance-pages/issues.mjs`; each new test names its module. `src/work-plans/` is untouched.
4. **The Acceptance holds, as the item's reading gives it.**
   - Both modules tell module files, items and plan steps, and their identifiers, by `readDocument` over
     `artifactSchemas()`.
   - The pull request removes `MODULE_FILE`, `ITEM_IDENTIFIER`, `ITEM_FILE`, `BACKLOG_ITEM` and `listOf`. Only the
     folder name `docs/backlog/` stays, which is the SPEC's own (`THE BACKLOG LIVES IN THE PRODUCT REPOSITORY`).
   - No existing test changes.
   - Two defects fall away with this. `moveToBacklog` no longer takes the plan step ITM-002 for an existing item: it gives
     NotFound and writes nothing. `drawForm` no longer counts `docs/notes/ITM-950-aside.md` as an item: the provisional
     identifier is ITM-901, not ITM-951.

## Rulings

- **The failed first attempt.** Attempt 1 failed only `tests/settings-pages-participants.test.mjs` ("each participant
  type is added through the schema form …": the list read "No participants are registered yet."). The rerun of the same
  commit passed. Neither that test nor `src/settings-pages/` names MOD-issue-handling or MOD-maintenance-pages (grep: 0).
  It is a flip on the same commit (`A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY`), not this item's failure, so the head
  counts as green.
  - It is reported to the Scrum Master with this one occurrence.
  - If the flip is seen again, it becomes an item that fixes its test.
- **TST-1298002 and 1298102 read the modules' own source.** They read it for item and module-file path patterns, with
  planted lines as their known positives. The Acceptance asks that the modules "keep no path rule … of their own". That
  is a property of the code, and reading the code checks it, as TST-106805 reads imports. The tests read no SPEC, use
  case or architecture file (`A TEST DOES NOT TAKE ITS EXPECTED RESULT FROM A DOCUMENT`). Allowed.
- **The pull request's readings.** All three are taken:
  - the folder `docs/backlog/` is the SPEC's;
  - `namesOf` stays, since it splits the modules field a person types, not a backlog file;
  - the provisional `ITM-<n>` form stays, since `nextIdentifier` is not among MOD-maintenance-pages' Uses.
- **MOD-documents was read in part** (its Data and Interfaces), which is the part the change calls. No further read is
  asked.
