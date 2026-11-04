---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - fd78df51ebf4cbd92a74432a8912dffb4e33207d
  - https://github.com/akmaier/agent-m/pull/1484
date: 2026-10-30 00:34 UTC
---
# Development → Release testing: ITM-987, closing a sprint adds the feedback's new items to the backlog

**REGISTER**

## Reason

ITM-987, pull request #1484 into `sprint/team1/123`, passes on `fd78df51`, its head when this was decided. It was returned
on `9cf8e9c9` (`docs/gates/20261030-0023-development-release-testing-a987.md`) because a close without new items read the
whole backlog. The mend asked for there stands as two commits.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **The mend.**
   - **Tests commit `ce512b6a`** adds TST-987004. Run 40979829996 (`pull_request`, attempt 1) fails, only in
     `unit-pull-request (9)` and only on TST-987004.
     - The snapshot's reads were the record and the item files, where `[ 'docs/backlog/sprints/team1/01.md' ]` was
       expected.
     - TST-987001 to 003 pass there.
   - **The commit's other change is the fake host's `read`, which now records each path it is asked for.** It still
     answers the same text. No assertion of TST-987001 to 003 changes, so nothing is weakened.
   - **Fix commit `fd78df51`:** `closeSprint` calls `itemFiles` only when `close.newItems` holds an item. Otherwise its
     items are `{ documents: [], files: [] }`. `saveItems` is unchanged.
   - **Head:** run 40979860553 (`pull_request`, attempt 1) succeeds, 58 jobs, 17 skipped, none failed.
2. **The path, read again on the head.**
   - For a close with `newItems: []`, `src/work-plans/saves.mjs` `closeSprint` no longer enters `itemFiles`. So no item
     file is read, `backlogFindings` does not run, and no history is asked.
   - My probe of the return, a record and 50 items over a counting snapshot: 1 read (the record), and the calls
     `readSnapshot`, `repositoryInfo` and `commitFiles`. That is the same as on `b65cefcc9`; on `9cf8e9c9` it was 51
     reads.
3. **Counter-proofs made by me on the head, each restored after:**
   - Calling `itemFiles` for every close again fails TST-987004.
   - Committing the items in a second `commitFiles` fails TST-987001.
   - Skipping the `ItemsRefused` throw fails TST-987002.
4. **What the return found holding still holds.**
   - The first commit holds only the tests; each later commit of tests stands before the code it checks.
   - Only `src/work-plans/saves.mjs`, `src/work-plans/index.mjs` and the new test file change, MOD-work-plans' own files.
   - `closeSprint`'s types and errors are as MOD-work-plans.md:261-271 states them.
   - Nothing of the open draft of MOD-work-plans is built.
5. **MOD-test-document's reader:**
   - `tests/work-plans-close-new-items.test.mjs` gives 4 declarations, 0 findings, and a header without findings.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 declarations, 0 findings.
   - TST-987001 to 003 are unchanged, printed in the return's record. The new declaration, as the reader reads it:
     - **TST-987004** —
       - given: "team1's open sprint 01 and a backlog of fifty items besides ITM-001 and ITM-003, on a fake host whose
         snapshot counts each read; known positive: TST-987001's close with two new items over the same backlog, which
         reads the item files";
       - input: "closeSprint(host, a close with newItems [], context at HEAD)";
       - expect: "one commit of the sprint's record only; the snapshot was asked to read the sprint's record and no item
         file, and readHistory was not asked; the known positive's close read item files and asked readHistory".
6. **Locally on the head:** these four files give 17 pass, 0 fail:
   - `tests/work-plans-close-new-items.test.mjs`;
   - `tests/test-document-one-line.test.mjs`;
   - `tests/work-plans-saves.test.mjs`;
   - `tests/work-plans-sprint-record-writer.test.mjs`.

## Noted

- Release testing of ITM-987 is developer-sonnet-l's, who implemented none of it.
