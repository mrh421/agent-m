---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 5f5a9194c666374287d7cda621468520ce7b137d
  - https://github.com/akmaier/agent-m/pull/1630
date: 2026-11-01 16:30 UTC
---
# Development → Release testing: ITM-1354, #1630

**REGISTER**

## Reason

ITM-1354 (the form of a planned model has no flow control) may go on. The pull request is #1630 into
`sprint/team1/141`, at `5f5a9194c`. developer-opus-e wrote the code and the unit tests. developer-sonnet-l lifted the
release case's `todo` (`Agent-M-Participant` on each commit). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `290d3df60` is red in run 41291326130
   (pull_request). Only TST-1354001 and 1354002 in `tests/implementation-pages-models.test.mjs` fail.
2. **CI is green on the head:** run 41291641158 (pull_request, `5f5a9194c`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
   - The run of the code commit `77861e9f5` (41291501823) failed only TST-1314303 (`release-itm-1314`), apart from FINDING
     `todo`s. That test touches nothing this item changes, and it passes on the head.
   - It is counted as a flip on its first occurrence, as at ITM-1298's gate. If it flips again, it becomes an item that
     fixes its test.
3. **Only the item's module changes.** `src/implementation-pages/process.mjs` gains 5 lines, and the tests are headed
   MOD-implementation-pages. The preload check passes.
4. **The Acceptance holds:**
   - For a planned model the form shows no Flow control section. For a pulled one it shows it, as before (TST-1354001,
     with the known positive; TST-1354002, with the shipped scrum and v-model).
   - TST-779112 loses its `todo` in sonnet-l's commit, written from the pushed code before the gate. It fails on the base,
     and no assertion changes. TST-779110 (UC-031 4a) keeps its `todo`.

## Readings, ruled

- **The form follows the kind the definition is opened with.** UC-031 2a: "The author first picks the kind of work …,
  and Agent M adapts the form to it." Retyping the kind afterwards does not rebuild the form. Taken.
- **The section is taken out of the form, not out of the schema.** `schemaForm` and `documentFindings` take only a result
  of `loadSchema`, which is not among MOD-implementation-pages' Uses. A planned file's own Flow control section stays in
  its document. MOD-model-catalogue's schema gives the section "for `pulled` only" (MOD-model-catalogue.md:66), and
  `modelFindings` judges it. Taken.
