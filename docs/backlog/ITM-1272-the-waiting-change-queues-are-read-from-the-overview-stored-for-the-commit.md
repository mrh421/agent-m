---
id: ITM-1272
title: The waiting change queues are read from the overview stored for the commit
level: module
realises:
  - UC-020
  - UC-047
  - OPEN PROPOSALS ARE SHOWN IN THE BROWSER
  - A PERSON IS TOLD WHAT WAITS FOR THEIR ACCEPTANCE
modules:
  - MOD-progress-measures
  - MOD-trace-pages
builds_on: []
tests:
  - unit
  - component
origin:
  - akmaier, 2026-10-28: "A lot of the stuff that is loaded on the new pages right now is actually never looked at. It is unlikely that a user needs all records at once." Then: "Please follow up. I want all pages fixed this way."
---
# ITM-1272 The waiting change queues are read from the overview stored for the commit

**REGISTER**

## Outcome

Two readers derive again which change queues wait, though `onMainChanged` stores them in the overview of each commit
(`queues` of `<commit>.json`, every queue with an entry not in the SPEC yet):

- `waitingForAcceptance` (`src/progress-measures/stages.mjs:234-242`), which the notifications call for every repository
  on each due check (`src/notifications/checks.mjs:79-80`), calls `queues(snapshot)`: every queue's `index.md` and
  `entscheidungen.md` — at Agent M's head 66 queues, 132 files, ~96 KB, two batches — and the targets and records of the
  entries not decided. The host keeps texts by blob for the page's life (`src/repository-hosts/index.mjs:228`), so this is
  paid on the first due check of each page, and later only for files that changed; the commit and the whole tree are
  read at every check, as before.
- the specification (`src/trace-pages/flow.mjs:591-604`, `waitingEntries`) already reads the overview, then the
  overview stored last, then every queue — a rule of its own that ITM-1273 would otherwise copy twice more.

After the change, as MOD-progress-measures says: `waitingQueues(snapshot)` gives `{ queues, asOf }` — the overview's
queues, else those of the overview stored last with its commit, else `queues` over every queue —; `storedOverview` is read
once for each commit in a page; `waitingForAcceptance` takes its SPEC changes from `waitingQueues`; `waitingEntries`
calls it in place of its own rule.

Design principles (AGENTS.md §2 *Designing*): §2.2 *nothing twice* — the waiting queues are derived once, in CI, and the
rule that reads them is written once; §2.5 *no special first case* — the same as-of fallback as `storedView`.

## Acceptance

Tests written first, each red on the commit that holds only them:

- `tests/progress-measures-waiting-queues.test.mjs` (MOD-progress-measures, unit), over a counting fake host with 66
  queues of which one waits: with the head's overview stored, `waitingQueues` gives that queue, `asOf` null, in one
  request and no read under `docs/spec-freigaben/`; with only c0's stored, c0's queues and `asOf` c0; with no branch
  `overview-cache`, every queue read as `queues` reads them. `waitingForAcceptance` gives the same SPEC changes in all
  three. Counter-proof: two snapshots of one commit read `<commit>.json` once.
- `tests/trace-pages-specification.test.mjs` keeps its waiting entries; its count of requests is unchanged.

Measurable outcome, on the live page of the instance: the first due check of notifications on a page reads one file of
`overview-cache` (~20 KB) instead of 132 queue files (~96 KB, two batches); a later check whose head moved reads one
overview instead of the queue files that changed.

- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only the folders of the two modules and the tests that name them change.
