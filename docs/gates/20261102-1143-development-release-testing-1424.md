---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 434ec07336864eda0536e2afb5c3c75f1013a3d2
  - https://github.com/akmaier/agent-m/pull/1732
date: 2026-11-02 11:43 UTC
---
# Development → Release testing: ITM-1424, #1732

**REGISTER**

## Reason

ITM-1424 (the release tests' writer is no implementer of the selection) may go on. The pull request is #1732 into
`sprint/team1/142`, at `434ec0733`, the Scrum Master's merge of the sprint branch, which keeps every lifted entry of
UC-026's flow maps in the evidence. The commits (`Agent-M-Participant` on each):
- developer-opus-e: the tests-only commit `a64254761` and the code `15fbf2e73`;
- developer-sonnet-l: `6397c442b`, the lift of TST-771309's `todo`, after the code was pushed.

I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `a64254761` adds TST-1424001 to
   `tests/test-pages-generate.test.mjs` (MOD-test-pages). In run 41427756561 it is the only failing case.
2. **CI is green on the head:** run 41434836940 (`434ec0733`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/test-pages/generate.mjs`. `implementersOf` asks the trace graph (`tracesTo`)
   about every selected name, not only requirements. It reuses the page's edges and takes the items that realise or change
   what is selected.
4. **The Acceptance holds:**
   - The implementer of an item that realises a selected use case or changes a selected module is not offered as the
     writer of its release tests.
   - The four counter-proofs in the pull request each fail a case.
   - TST-771309 loses its `todo`: red at `a64254761`, green at `15fbf2e73`. sonnet-j wrote the case, and sonnet-l built
     none of the page.
     - Its product gains an approval record that accepts MOD-loans, so that its step about MOD-loans still tests what it
       says once ITM-1423 offers only accepted names.
     - One line of the system file's flow map moves to the evidence, since TST-771201 read the release file's finding.

## Reading taken

- `tracesTo` is asked for every selected name. It may also return use cases that name a selected use case or module, but
  the graph holds no such edge.
