---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 18461a97f52308e04a50cb96b2e133f86be8f148
  - https://github.com/akmaier/agent-m/pull/1618
date: 2026-11-01 09:30 UTC
---
# Development → Release testing: ITM-1351, #1618

**REGISTER**

## Reason

ITM-1351 (a module's row realises the requirements its tests guard) may go on. The pull request is #1618 into
`sprint/team1/141`, at `18461a97f`, by developer-sonnet-j (`Agent-M-Participant` on both commits). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `5e7a3c45c` is red in run 41284159216
   (pull_request). It fails exactly the six cases the item names:
   - TST-692001, 692002, 692008 and the new TST-1351001 in `tests/trace-graph-module-rows.test.mjs`;
   - the table case at `tests/trace-pages-modules-table.test.mjs:74-80`;
   - TST-073603 at `tests/trace-pages-modules-next-step.test.mjs:98-101`.
2. **CI is green on the head:** run 41284441020 (pull_request, `18461a97f`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
3. **Only the item's modules change.**
   - The code is two lines of `moduleRows` in `src/trace-graph/derive.mjs`.
   - The two tests of MOD-trace-pages are the ones the item names for that module (`0c20d8973`), and no code of
     `src/trace-pages/` changes.
4. **The Acceptance holds:**
   - A row's *realises* is the requirements that the module's tests guard (TST-1351001, whose known positive fails on the
     old code).
   - `realises-nothing` and `requirement-without-module` follow from that set. The moved cases match the Acceptance's
     list exactly.

## Readings, ruled

- **Requirement nodes only.** A name that a test guards and the SPEC does not hold stays a gap of its own, `unknown-name`
  (UC-025 4b: "named as not in the SPEC"). A guard on an architecture decision is not a realised requirement. Taken.
- **The module file's own `realises` stays in the graph,** for its edges, `tracesTo`, `coverageGaps` and `unknown-name`.
  Only the row of UC-025 step 3 changes. Taken.

## Next

TST-741003 now passes under its `todo`. Under the Acceptance, a participant other than the implementer takes the `todo`
away after the code: developer-sonnet-l, who implemented none of this item.
