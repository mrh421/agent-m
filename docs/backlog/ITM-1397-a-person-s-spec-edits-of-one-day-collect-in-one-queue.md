---
id: ITM-1397
title: Every SPEC change is an entry of its section's queue
level: module
realises:
  - UC-018
  - UC-005
  - UC-012
  - A SPEC EDIT IS SAVED AS A PROPOSAL
modules:
  - MOD-spec-changes
  - MOD-approvals
  - MOD-review-pages
  - MOD-maintenance-pages
  - MOD-site-frame
  - MOD-repository-hosts
  - MOD-trace-pages
  - MOD-documents
  - MOD-workflow-entries
builds_on:
  - ITM-376
tests:
  - unit
origin:
  - akmaier's acceptance of the SPEC packages' texts (#1704; on main b657b4baa, d04d6a451, 532f11190, f0389c1bb), which withdraws A PERSON'S EDITS COLLECT IN ONE OPEN QUEUE and gives every SPEC section a queue of its own; UC018-F1, TST-376206 (#1750)
---
# ITM-1397 Every SPEC change is an entry of its section's queue

**REGISTER**

## Outcome

The accepted MOD-spec-changes, Data: a queue is the package of one SPEC section, `docs/spec-freigaben/<package>/`. Each
change is added there as an entry. UC-018 step 6 reads "Agent M adds an entry to the section's queue". UC-005 step 8,
UC-012 step 6 and UC-019 6b read alike.

The code still writes a new dated queue per person and day:
- `src/spec-changes/propose.mjs:142-160, 347` builds `<date><letter>_<slug>` folders and runs `openQueueOf`/`openQueueIn`;
- `Queue.issue` lies on the queue, where the text puts it on each entry;
- `src/review-pages/edit.mjs`, `requirements-draft.mjs`, `entry-edit.mjs` and `src/maintenance-pages/issues.mjs` hand on
  the person or read the queue's issue;
- `src/site-frame/explanations.md:340` tells the person that edits collect in the newest queue of the day.

TST-376206 is `todo` as FINDING UC018-F1 (MOD-spec-changes). The preamble's entry can already be accepted (`d7d3d4b16`).

## Acceptance

- `proposeSection` and the writer `queue-entries` write each entry into its section's queue
  `docs/spec-freigaben/<package>/`, or start that queue with entry 01. The writer makes one commit per SPEC.
  - An entry's number is one more than any the queue's index or decisions name, so a number is never reused.
  - `openQueueOf` is gone.
  - `Queue` and `entryView` carry `issue` per entry, from the rationale's `**Issue:**` line, and `createdBy` as
    `{ queue, entry } | null`.
  - `queues` lists the queues in the order of their folders' names.
  - `applyApproved` works only on records whose queue the snapshot holds.
- The prose of `queue-index.schema.md` and `queue-decisions.schema.md` gives the title lines the Data names. The prose
  examples of `src/approvals/approval-record.schema.md` and MOD-approvals name `configuration-and-secrets/01-…`, and their
  ```json blocks stay as they are.
- The review pages and the issue page use the section's queue and the entry's issue, and name no `openQueueOf`.
  `explanations.md` says that a saved edit is an entry of its section's queue.
- No folder outside the convention is left under `docs/spec-freigaben/`. A dated folder's open entries are moved into
  their sections' queues, then the folder is deleted. The history keeps it (`THE REPLACED TEXT STAYS REACHABLE`).
- The guards of the withdrawn requirement move with the code: `spec-changes-propose-section`,
  `review-pages-edit-requirement` and, for its test only, `repository-hosts-history`. The pull request names each case it
  moves and the accepted sentence it now follows. A check that reads a queue's issue or a dated folder follows the
  convention, and the pull request names it.
- TST-376206 loses its `todo` in a commit by a participant who built none of this, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
