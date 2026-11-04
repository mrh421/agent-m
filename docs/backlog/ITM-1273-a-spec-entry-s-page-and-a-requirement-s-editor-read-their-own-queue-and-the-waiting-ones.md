---
id: ITM-1273
title: A SPEC entry's page and a requirement's editor read their own queue and the waiting ones
level: module
realises:
  - UC-006
  - UC-018
  - OPEN PROPOSALS ARE SHOWN IN THE BROWSER
  - NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT
modules:
  - MOD-review-pages
  - MOD-spec-changes
  - MOD-site-frame
builds_on:
  - ITM-1272
tests:
  - unit
  - component
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at. It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1273 A SPEC entry's page and a requirement's editor read their own queue and the waiting ones

**REGISTER**

## Outcome

- `#spec-entry/id=spec-<queue>-<NN>`: `queueService.view` (`src/review-pages/spec-entries.mjs:125-133`) calls
  `queues(snapshot)` to find the one queue that holds the entry and the other open entries on its anchor
  (`described`, `:72-75`); its subject (`src/review-pages/subjects.mjs:63-66`, `entryFacts`) calls `queues` again. At
  Agent M's head that is every queue's two files — 132 files, ~96 KB —, and the targets and records of every entry not
  decided, to show one entry, its queue's order and the others on its section.
- `requirement/<name>/edit` (`src/review-pages/edit.mjs:55-57`) calls `queues(snapshot)` to list the other open
  proposals on the one section it edits (`:63-71`).

The entry's own queue is named by its identifier (`entryId`, `spec-entries.mjs:24`); MOD-spec-changes already reads one
queue alone (`queueAt`, `src/spec-changes/queues.mjs:327`), which is not yet in its interface. The other proposals are
entries not in the SPEC, which ITM-1272's `waitingQueues` gives.

After the change, as MOD-review-pages and MOD-spec-changes say: `queueAt` is in MOD-spec-changes' interface; the entry's
page and its subject read the entry's queue with `queueAt`, and the others on its section from `waitingQueues`, with the
as-of line while those are of an earlier commit; the editor lists the others from `waitingQueues`. The list `spec-entry`
and *Review all*, which show every queue and every waiting entry at the head, are unchanged. The stored graph is still
read for the impact list, which both pages show (`A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST`).

Design principles (AGENTS.md §2 *Designing*): §2.1 — showing one entry and listing every queue are two
responsibilities; ch. 10 *a module interface is minimal* — one queue read by its folder; §2.2 — the waiting entries come
from the one reading ITM-1272 makes.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/review-pages-entry-own-queue.test.mjs` (MOD-review-pages, component), over a counting fake of GitHub with 66
  queues, the head's overview stored: `#spec-entry/id=spec-<q>-02` shows what `tests/review-pages-edit-entry.test.mjs`
  expects, another queue's open entry on the same anchor among the others, and reads the two files of `<q>` and one
  overview, no other queue's `index.md`. `requirement/<name>/edit` lists the same other proposal and reads no
  `index.md`. Counter-proofs: with c0's overview only, the as-of line; with no `overview-cache`, every queue as today.
- `tests/spec-changes-queue-at.test.mjs` (MOD-spec-changes, unit): `queueAt` gives the queue `queues` gives for that
  folder, reading only its files and what its entries name; `null` for a folder the snapshot lacks.

Measurable outcome, on the live page of the instance: opening one entry or one requirement's editor reads 2 queue files
and one ~20 KB overview (already held after `#spec`) instead of 132 queue files (~96 KB, two batches) read twice over.

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only the folders of MOD-review-pages and MOD-spec-changes and the tests that name them change, and, of MOD-site-frame,
  only `tests/app-harness.mjs`'s fake of GitHub's raw host: a read of a branch's file it does not hold is answered 404,
  as GitHub answers it, and no longer 500. No code of MOD-site-frame changes.
- A release test whose count of requests changes is changed by a participant who implemented none of this item, in a
  commit of its own.
