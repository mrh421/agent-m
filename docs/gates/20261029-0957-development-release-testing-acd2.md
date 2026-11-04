---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - d6135684f5bbba3f2206688b54758f1b5a01d973
  - https://github.com/akmaier/agent-m/pull/1428
  - docs/backlog/ITM-1284-the-issue-pages-leads-open-agent-ms-own-use-cases.md@a2d5d0595
date: 2026-10-29 09:57 UTC
---
# Development → Release testing: ITM-1284, the issue page's leads open Agent M's own use cases

**REGISTER**

## Reason

ITM-1284, pull request #1428 into `sprint/team1/115`, passes on `d6135684`, its head when this was decided. The item is
read as it stands on `main` at `a2d5d0595`, with its release test named after the stop.

The Definition of Done is the default (SPEC.md:1869-1874).

1. **CI is green.** Run 40852552678, `pull_request`, on `d6135684` passes 38 of 38 pull-request jobs.
2. **Red first.** The tests-only commit `b3eae8b0` is red in run 40851986071, in component shards 4 and 6. There fail
   only:
   - the two new cases, TST-1284001 and 002;
   - the two changed expectations, `maintenance-pages-move-1250` ("led to UC-012, step 2") and
     `maintenance-pages-fix-583` ("leads to UC-017").
   - The implementation commit `b5e3a976` changes only `src/maintenance-pages/issues.mjs`, and no test.
3. **The changed expectations are the ones the Acceptance names, and they stand in the tests-only commit.**
   - `move-1250:291` and `fix-583:143` become `["use-case", { id: …, product: "" }]`, with their comments and
     `expect:`.
   - **TST-1254302** (`release-itm-1254-issue-move:161`, level `release`) is changed as ruled at the stop
     (`team1/115.md`, "ITM-1284's stop"):
     - it is changed by developer-sonnet-l, who implemented none of this item, in `d6135684`, a commit of its own;
     - only `:161` and its `expect:` (`:134`) change;
     - the check that the review pages serve the route stays.
4. **Only its module changes.**
   - Code: `src/maintenance-pages/issues.mjs`, at the two leads (`:436`, `:513`) and their comments.
   - Tests: the new `maintenance-pages-leads-1284`, then `-move-1250`, `-fix-583` and `release-itm-1254-issue-move`. The
     header of each names MOD-maintenance-pages.
   - No test of another module changes, and no test is removed.
   - The code adds no import. `go` is `MOD-site-frame.View`'s, which MOD-maintenance-pages' Uses name.
5. **The Outcome is the accepted text.** Each lead's `go` names the empty `product`, which "names the instance itself"
   (MOD-site-frame.md:192). That is UC-033 1a's "Agent M links to UC-012, step 2", and UC-012 5b's lead to UC-017.
6. **The Acceptance's counter-proof stands.**
   - TST-1284001 and 002 assert the fragment `use-case/id=UC-0…` with no `product=`.
   - Each was red on the lead without `product: ""`.
   - Each has a known positive: the product's own issue is shown first.
7. **The reading holds.** The "fragment" is what the frame writes after `#` into `location.href` on the main page. That
   is where the frame names a product (MOD-site-frame.md:192, "into the address unless `params` names a `product`").
8. **The reader.** On `d6135684`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `maintenance-pages-leads-1284`: 2 declarations, TST-1284001 and 002, and 0 findings.
   - `-fix-583`: 7 declarations and 0 findings.
   - `-move-1250`: 6 declarations and 5 findings, all under A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION:
     guards that name a step of UC-033 (`:161`, `:202`, `:230`, `:267`, `:299`).
     - The same 5 stand on `sprint/team1/115` before this pull request, in lines it does not change.
     - They came with ITM-1250 and ITM-1254.

## Noted

- **The five step guards of `maintenance-pages-move-1250` are registered as ITM-1308**, as ITM-1300 was for the
  progress page's. This item's Acceptance does not reach them, and they are no reason to hold it.
