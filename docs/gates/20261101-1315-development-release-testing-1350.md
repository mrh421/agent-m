---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 5a1cba0a03809cceaa8d230325499f251fb724aa
  - https://github.com/akmaier/agent-m/pull/1627
date: 2026-11-01 13:15 UTC
---
# Development → Release testing: ITM-1350, #1627

**REGISTER**

## Reason

ITM-1350 (a row of a product's list links that product's file) may go on. The pull request is #1627 into
`sprint/team1/141`, at `5a1cba0a0`. developer-sonnet-k wrote the code and the unit tests. developer-sonnet-l wrote the
system and release changes (`Agent-M-Participant` on each commit). I wrote none of it.
1. **The tests come first, and both tests-only commits are red for the item's reason:**
   - `1bb35050c` in run 41288453552, where only TST-1350101 and 103 fail (the product's lists). TST-1350102, the instance's
     counter-proof, passes.
   - `b1bdd3df9` in run 41288705052, with the moved TST-472678, TST-472606 and `review-pages-release-reports`, all headed
     MOD-review-pages.

   The code `00a800631` is one line of `rowFor` in `src/review-pages/flow.mjs`.
2. **CI is green on the head:** run 41289045906 (pull_request, `5a1cba0a0`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
3. **Only the item's module and its tests change.**
4. **The Acceptance holds:**
   - On a product's list each row links `#<route>/id=<id>/product=<the product's address, percent-encoded>`, the form
     `chosenProduct` reads back (MOD-site-frame.md:222).
   - The instance's list is as it was.
   - TST-372216 loses its `todo` in sonnet-l's commit, which went onto the branch before the gate.

## Rulings

- **sonnet-l's commit `5a1cba0a0`** is written from the pushed code by a participant who implemented none of the item.
  - TST-1273301 expects the row link with the product.
  - UC008-S2 moves from `FLOW_FINDINGS` to `FLOW_EVIDENCE`, so the findings are empty and the header line goes. No
    assertion changes.
  - Both changed cases fail on the base.

  Allowed.
- **New identifiers from TST-1350101,** since 1350001 to 024 stand in the history. Taken.
- **The page's other links still leave the product out** (*Review all*, *Draft*, *History*, *Older*, *Edit*, *All …*).
  That is outside this item's Acceptance. It is registered as ITM-1355 (`664a7b04a`), which builds every such link in one
  place, the row link's included.
