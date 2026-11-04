---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - aaa7827588f8f869d228d3e4c3f6170580a96dcb
  - https://github.com/akmaier/agent-m/pull/1746
date: 2026-11-02 14:18 UTC
---
# Development → Release testing: ITM-1438, #1746

**REGISTER**

## Reason

ITM-1438 (a price the participant list cannot read is not saved silently) may go on. The pull request is #1746 into
`sprint/team1/142`, at `aaa782758`. developer-opus-e wrote the tests-only commit `c72fccb67` and the code `e019f1061`.
developer-sonnet-l wrote `aaa782758`, the lift of TST-375215's `todo`, after the code was pushed (trailers on each). I
wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** In run 41456604879, only
   `unit-pull-request (16)` fails, and only on TST-1438001 and 1438002 in `settings-pages-participants`.
2. **CI is green on the head:** run 41459033077 (`aaa782758`), at attempt 2; attempt 1 was cancelled, and no step failed.
   `git merge-tree` with the sprint branch's head `3c5087c2d` is clean.
3. **Only the item's module changes:** `src/settings-pages/participants.mjs` (MOD-settings-pages), plus tests.
   - The hint "input / output USD per million tokens" led the author to type "2.00 / 8.00". `rowOf` wrote it, and no check
     judged it. MOD-participant-list's `participantsOf` reads only `<input> / <output> <currency> per million tokens`, so
     the price was `null` and the cost unknown.
   - `priceChecks` now reads the drafted row with the list's own `participantsOf`, so the page has no second parser. A
     filled price read as none is an error finding under `NO COST IS GUESSED`, which withholds *Save*.
   - `PRICE_HINT` ("2.00 / 8.00 USD per million tokens") is both the hint and the finding's example. An empty price stays
     allowed (UC-017 3).
4. **The new tests name UC-017, `NO COST IS GUESSED` and MOD-settings-pages.** The pull request records their
   counter-proofs: `priceChecks` returning `[]` fails TST-1438001, and the old hint fails TST-1438002.
5. **The Acceptance holds:**
   - An unreadable price is refused with the form named, the hint is a readable price, and the known positive saves and
     reads {2, 8, USD}.
   - TST-375215 loses its `todo`: red at `c72fccb67`, green at `e019f1061`. sonnet-l, who built none of the page, lifted
     it, and its flow-map entry moves to the evidence.

## Ruled

- **TST-375001 and 375004 change their inputs, not their expected results, and that stands.** They typed prices the list
  reads as none ("1.00 / 2.00", "2.00 / 8.00", "subscription"), which the page now refuses, as the Acceptance asks. They
  now type the list's form or no price. Neither asserts a price, and MOD-participant-list's Data gives a price only in
  that form or as "—". Their changes are in the code commit, not the tests-only commit. The job rules ask that a changed
  *expectation* go into the tests-only commit, and no expectation changed here.

## Noted

- **First flip:** `system-uc-026-*` TST-771207, 771208 and 771211 failed in run 41457352297, attempt 1
  (`system-pull-request (6)`: "main has moved on", "branch tests/extension-2 already exists"), together with the records
  job. The rerun passed. This item does not touch those tests. A second flip makes it an item.
