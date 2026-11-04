---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - e9c3d38d51e7580e54b777b6dd72a8bf1339328b
  - https://github.com/akmaier/agent-m/pull/1729
date: 2026-11-02 10:12 UTC
---
# Development → Release testing: ITM-1423, #1729

**REGISTER**

## Reason

ITM-1423 (the test generation page offers only accepted names) may go on. The pull request is #1729 into
`sprint/team1/142`, at `e9c3d38d5`. developer-opus-e wrote the tests-only commit `9f40756c5` and the code `12b9644de`;
developer-sonnet-l wrote `e9c3d38d5`, the lift of TST-771203's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** In run 41424578954 the failing cases are
   TST-1423001 (new), TST-763008 and TST-771202 (moved, below), besides the `todo` cases that name a finding.
2. **CI is green on the head:** run 41426324761 (`e9c3d38d5`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/test-pages/generate.mjs`.
   - `loadProduct` (:91) kept every requirement, use case and module of the stored graph, so the page listed a use case
     and modules no record accepts. Only the run panel later refused the use case, and never a module.
   - Now a use case or module is offered only when MOD-approvals' `statuses` gives it as accepted. A requirement counts as
     the SPEC holds it, as the run panel's own check reads it. No further copy of the rule of acceptance is made.
4. **The Acceptance holds:**
   - Only accepted names are offered. Known positive: the two rules and UC-001 are listed.
   - The four counter-proofs in the pull request each fail named cases: the filter removed, any reviewed file counted, a
     changed file counted, and only requirements offered.
   - TST-771203 loses its `todo`: red at `9f40756c5`, green at `12b9644de`. sonnet-j wrote the case, and sonnet-l built none
     of the page.

## Ruled

- **The moved expectations stand.** Each is in the tests-only commit and red there.
  - TST-763008 now expects UC-002 not offered and *Run* offered, where it expected the run panel to refuse UC-002.
  - TST-771202, sonnet-j's system case, has a header naming MOD-test-pages, the item's module. A system case may be moved
    by the implementer in the tests-only commit, as TST-739005 was at ITM-1395's gate; only a release case's move goes to
    another participant. It now lists the accepted names only (UC-026 step 1, "the accepted").
  - The `given` of TST-763001 and 1119003 gain records; their expected results stay.
  - Nothing is weaker for what the fixtures hold.
- **Noted:** TST-771202 no longer shows a module's row with its levels, since no module of its fixture is accepted. A
  fixture with an accepted module would show it again. That is a candidate for the review, not a condition here.

## Readings taken

- A use case or module is accepted by `statuses`, and a requirement by the SPEC holding it.
- `statuses` is imported by Uses read at the level of the module. MOD-test-pages' Uses name MOD-approvals, and
  `generate.mjs` already imports `participantsOf` and `isTestFile` this way.

Both are taken.

## Merge note

#1730 (ITM-1426) also changes the flow maps of UC-026's system file. Whichever merges second takes the sprint branch first.
