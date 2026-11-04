---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - aefb6ee3cbff1b1d35fb218e14ca05cfeb0a869f
  - https://github.com/akmaier/agent-m/pull/1418
  - tests/release-itm-654-fix-expectations-old-beside-new.test.mjs
  - tests/release-itm-1297-dash-declarations-read.test.mjs
  - tests/release-itm-1301-newest-queue-marks.test.mjs
  - tests/release-itm-1264-implement-stored-view.test.mjs
date: 2026-10-29 08:10 UTC
---
# Release testing → Sprint review: team 1's sprint 113

**REGISTER**

## Reason

The release tests of sprint 113's items pass on `sprint/team1/113` at `aefb6ee3`, the head of #1418 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541).

1. **The release tests, each declaring the level `release`, all written by developer-sonnet-l:**

| Item | File | Cases | Commit |
|---|---|---|---|
| ITM-654 | `tests/release-itm-654-fix-expectations-old-beside-new.test.mjs` | TST-654301 to 303 | `ec232a31` (#1416) |
| ITM-1297 | `tests/release-itm-1297-dash-declarations-read.test.mjs` | TST-1297301, 302 | `ec232a31` (#1416) |
| ITM-1301 | `tests/release-itm-1301-newest-queue-marks.test.mjs` | TST-1301301, 302 | `ec232a31` (#1416) |
| ITM-1264 | `tests/release-itm-1264-implement-stored-view.test.mjs` | TST-1264301 to 308 | `c515062d` (#1417) |

2. **The writer built none of the behaviour.** These are the trailers of every commit under `src/` in
   `origin/main..aefb6ee3`:
   - ITM-654 `2b1caa22`: developer-opus-f;
   - ITM-1264 `bcd05b1a`, `dbfa8a93` and `aba1b459`: developer-opus-e;
   - ITM-1301 `c042f1ce`: developer-sonnet-k.
   - ITM-1297 changed test files only, by developer-sonnet-j (`b1c5921c`, #1413).
   - developer-sonnet-l has none.
3. **Green on the sprint branch.** Run 40839733046, `pull_request`, on `aefb6ee3` passes 38 of 38 pull-request jobs. In
   its release jobs:
   - 654: 3 pass and 1297: 2 pass (job 123332992532);
   - 1301: 2 pass (job 123332992573);
   - 1264: 8 pass (job 123332992554).
   - 0 fail.
4. **The reader.** I ran MOD-test-document's `testDeclarations(path, text)` and `testFindings` on `aefb6ee3`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - The four files give 3, 2, 2 and 8 declarations, every case of the table, and 0 findings.

## The readings of ITM-1264's release tests

1. **The model's file read by `readFileAt`, outside the product's batch, holds.** The file stands in the instance at the
   commit the declaration names, not in the product's snapshot, so no batch of the product holds it. This was ruled at
   the item's stop (`team1/113.md`, "ITM-1264's stop").
2. **A pending or absent `agent-m done` counts as not passed.** ITM-1264's Acceptance offers *Merge* "with the run green",
   and none without it.
3. **The as-of path still lists the open pull requests.** The Acceptance asks of it the as-of line and no *Start jobs*. It
   does not withhold the listing.
