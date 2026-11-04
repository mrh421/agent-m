---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 77d621f2459989378f4d4967782f61ef0dbe4487
  - https://github.com/akmaier/agent-m/pull/1640
date: 2026-11-01 21:00 UTC
---
# Development → Release testing: ITM-1364, #1640

**REGISTER**

## Reason

ITM-1364 (every link a product's trace page draws to a review route keeps the product) may go on. The pull request is
#1640 into `sprint/team1/141`, at `77d621f24`. developer-sonnet-j wrote the code and the unit tests. developer-sonnet-l
wrote the release changes (`Agent-M-Participant` on each commit). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `0974de430` is red in run 41294787669
   (pull_request). I read its failing lines:
   - the item's cases fail: TST-1364001 and 003, and the moved TST-360001, 360002, 737001, 738002 and 741007, with the
     modules view's cases of TST-073601, 073605 and 1353003;
   - every other ✖ line is a FINDING `todo` of that base (TST-1062009, 012, 017; TST-806012, 019; TST-738006, 012, 015,
     022; the UC-035 chain case).
2. **CI is green on the head:** run 41295286226 (pull_request, `77d621f24`), at the first attempt. `63ff32338` merges the
   sprint branch without a conflict, and `git merge-tree` with its current head is clean.
3. **Only the item's module and its tests change.**
   - The code is `src/trace-pages/flow.mjs`. `reviewProductOf(context)` hands `reviewLink` the product's address on a
     product's page, and nothing on the instance's.
   - The changed tests name MOD-trace-pages in their `Module:` lines.
4. **The Acceptance holds:**
   - On a product's trace page, *Edit*, *+ Requirement*, the waiting entry, *History* of SPEC changes, *Arrange* and
     *Change the architecture* carry `/product=<encoded address>` (TST-1364001, 003).
   - On the instance's pages they stay bare (TST-1364002). That case and 003's instance half are the counter-proofs.
   - TST-738002's `#arrange/kind=requirements` moves as the item names it.

## The release commit, ruled

`77d621f24` (developer-sonnet-l, who implemented none of the item) is written from the pushed code before the gate:
- TST-1180301 to 304, TST-1272302 and 303, TST-738108 and TST-741101 expect the product in the links to review routes;
- `#implement` stays bare;
- all eight fail on the base and pass with the code.

Allowed.

## Readings, ruled

- **"A route of MOD-review-pages"** is a route that `src/review-pages/routes.mjs` serves. `#implement`, `#release` and
  `#trace` are other modules' routes and stay bare. Taken.
- **"The instance's pages"** are those `ofInstance` recognises. Taken.
- **A test is the module's when its `Module:` header names it.** That is why `system-uc-025-validate-modules`
  (MOD-trace-pages; MOD-trace-graph) changes. Taken, as ruled before in this sprint.

## Noted

- **The header of `tests/release-itm-1272-waiting-queues.test.mjs`** writes its three modules on one `Module:` line,
  separated by `;`. MOD-test-document's `testHeader` reads that as MOD-progress-measures alone, while the text also names
  MOD-trace-pages, the module whose links the file asserts. It is taken as naming MOD-trace-pages. A later change of that
  file should give one module per line.
- **TST-741112's second assertion** fails as its own FINDING `todo` (UC025-R1) does, the same on the base.
