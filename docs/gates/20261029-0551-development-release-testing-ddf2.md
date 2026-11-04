---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 6013499bb8b3c07262614bbfb2de94d451d78e30
  - https://github.com/akmaier/agent-m/pull/1405
  - docs/backlog/ITM-1255-a-backlog-s-module-files-and-list-fields-are-read-in-one-place.md@c5a4d1011
date: 2026-10-29 05:51 UTC
---
# Development → Release testing: ITM-1255, a backlog's module files and list fields are read in one place

**REGISTER**

## Reason

ITM-1255 as narrowed, pull request #1405 into `sprint/team1/112`, passes on `6013499b`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1870-1873). For a refactoring job it asks that "CI was green on every
commit and no expected result changed".

1. **CI is green on every commit.** The pull request has one commit, `6013499b`. Run 40825085006, `pull_request`, on it
   passes 38 of 38 pull-request jobs.
2. **No expected result changes.** The only test file is the new `tests/work-plans-one-definition.test.mjs`. No existing
   test changes.
3. **Only its module changes:** `src/work-plans/saves.mjs`, `sprints.mjs`, `states.mjs` and `strategies.mjs`, and a test
   whose header names MOD-work-plans, the item's one module.
4. **MOD-work-plans' interface is unchanged.**
   - `moduleFiles(snapshot)` is a function of `strategies.mjs` alone, and is not exported.
   - `ITEM_FILE` (`saves.mjs`) and `list` (`sprints.mjs`) are exported between the module's own files only.
   - `src/work-plans/index.mjs` is not changed, and exports none of the three. MOD-work-plans.md, whose `provides:` names
     none of them, is not changed.
5. **Each rule now stands once, and every read stays the same.**
   - **The item's file:** `ITEM_FILE` and `BACKLOG_ITEM` match the same paths, the capture group aside. The developer
     found them differing on none of 6,969 tracked paths.
   - **The module files:** the reads at `strategies.mjs:243` (backlog-checks), `:384` (backlog-items) and `sprintRecord`'s
     go into `moduleFiles`. `sprintRecord` read `ARCHITECTURE_FILE` with `/\/MOD-/`, which selects exactly the files
     `MODULE_FILE` selects.
   - **The list field:** the `list` of `sprints.mjs` is the one kept, and `states.mjs` and `saves.mjs` take it.
   - **What stays two:** `ANY_ITEM_FILE` and `ITEM_ID`, whose results differ, with the examples given. The
     `checks.mjs` list and `asList` stay too. The Acceptance allows both: one rule is kept "only where it gives every
     caller the same result as today".
   - The read at `strategies.mjs:197` reads decisions and modules together, each with its own schema. It is a rule of its
     own, and rightly stays.
6. **The test pins it.** TST-1255001 to 005 count each rule's definitions in `src/work-plans/*.mjs`, with a planted second
   copy as the counter-proof. 001, 004 and 005 fail on the old code. On the PR's checkout, 5 pass.
7. **The reader.** On the PR's checkout:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `tests/work-plans-one-definition.test.mjs`: 5 declarations, TST-1255001 to 005, and 0 findings.
