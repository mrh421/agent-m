---
gate: Release testing → Sprint review
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - b1bd827963f43d89c7bece29b41b686fb07a0f55
  - https://github.com/akmaier/agent-m/pull/1411
  - tests/release-itm-1255-work-plans-backlog-reads.test.mjs
  - tests/release-itm-1260-stored-views.test.mjs
  - tests/release-itm-1274-entry-impact-without-rationale.test.mjs
  - tests/release-itm-1279-runs-reads-two-commits.test.mjs
date: 2026-10-29 07:05 UTC
---
# Release testing → Sprint review: team 1's sprint 112

**REGISTER**

## Reason

The release tests of sprint 112's items pass on `sprint/team1/112` at `b1bd8279`, the head of #1411 into `main`.

The condition is "the release tests (TST) of the selected items — written by a participant other than the implementer
of the behaviour they test, green on the sprint branch" (`docs/process-models/scrum-wip.md:54`; SPEC.md:1537-1541).

1. **The release tests, each declaring the level `release`, all written by developer-sonnet-l:**

| Item | File | Cases | Commit |
|---|---|---|---|
| ITM-1255 | `tests/release-itm-1255-work-plans-backlog-reads.test.mjs` | TST-1255301 to 304 | `ca191fdd` (#1408) |
| ITM-1260 | `tests/release-itm-1260-stored-views.test.mjs` | TST-1260401 to 417 | `341c9cbf` (#1410) |
| ITM-1274 | `tests/release-itm-1274-entry-impact-without-rationale.test.mjs` | TST-1274301 to 305 | `94bf2c56` (#1409) |
| ITM-1279 | `tests/release-itm-1279-runs-reads-two-commits.test.mjs` | TST-1279301 to 306 | `a007941d` (#1407) |

2. **The writer built none of the behaviour.** These are the trailers of every commit under `src/`, `index.html` and
   `docs/index.html` in `origin/main..b1bd8279`:
   - ITM-1255 `6013499b`: developer-opus-f;
   - ITM-1260 `f37bf63e`: developer-opus-e;
   - ITM-1274 `ae98ea9e` and `b5946c18`: developer-sonnet-j;
   - ITM-1279 `637c0b31`: developer-sonnet-k.
   - developer-sonnet-l has none.
3. **Green on the sprint branch.** Run 40832591101, `pull_request`, on `b1bd8279` passes 38 of 38 pull-request jobs. In
   its release jobs:
   - 1255: 4 pass (job 123310050154);
   - 1274: 5 pass (job 123310050110);
   - 1279: 6 pass and 1260: 17 pass (job 123310050099).
   - 0 fail. All 32 cases pass.
4. **The reader.** I ran MOD-test-document's `testDeclarations(path, text)` and `testFindings` on `b1bd8279`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - The four files give 4, 17, 5 and 6 declarations, every case of the table, and 0 findings.

## The points put to this gate

1. **Which waiting entry marks a requirement on `#spec`, when two name it: no defect, and an item for the comment.**
   - OPEN PROPOSALS ARE SHOWN IN THE BROWSER (SPEC.md:129-131) asks that such a requirement be shown "with that entry's
     status and a link to it". The specification's first section lists every waiting entry, each with its status and a
     link (MOD-trace-pages.md:130). So both entries stand on the page.
   - For an opened requirement, UC-020 5c lists both.
   - Which entry gives the one mark beside the requirement, no text says. The page takes the first that `waitingQueues`
     gives, the newest queue's.
   - The comment in `src/trace-pages/flow.mjs:552`, "taken in the order of the entries, so that the first entry naming a
     requirement gives its status", does not say that this order is newest first. It is registered as **ITM-1301**, and
     is no reason to hold the increment.
2. **ITM-1260's release tests suffice for this gate.**
   - The condition asks for release tests of the item, by a participant who is not its implementer, green on the sprint
     branch. It does not ask that each module be named in their header.
   - They name MOD-progress-measures, MOD-implementation-pages and MOD-repository-hosts. They call `publishOverview` itself
     (`tests/release-itm-1260-stored-views.test.mjs:253`, `:264`), so the storing of the views is tested independently.
   - What they leave to the implementer's tests is `onMainChanged`'s naming of the views in its summary (MOD-workflow-entries,
     `tests/workflow-entries-main-changed.test.mjs`), and the frame's removed wave (MOD-site-frame, `load-per-view`).
   - Noted for the review, no condition of this gate.
