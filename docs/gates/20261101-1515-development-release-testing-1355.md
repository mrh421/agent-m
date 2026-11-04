---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - cb7485add0140d5c7a6ffa4d5563b03deeff6c6e
  - https://github.com/akmaier/agent-m/pull/1628
date: 2026-11-01 15:15 UTC
---
# Development → Release testing: ITM-1355, #1628

**REGISTER**

## Reason

ITM-1355 (every link a product's review page draws to another review route keeps the product) may go on. The pull
request is #1628 into `sprint/team1/141`, at `cb7485add`. developer-sonnet-k wrote the code and the unit tests.
developer-sonnet-l wrote the release changes (`Agent-M-Participant` on each commit). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `6670a5ee5` is red in run 41290229644
   (pull_request), and only the new `tests/review-pages-links-keep-product.test.mjs` and the eleven moved review-pages
   unit files fail. `9396d7e77` only puts each `expect:` of the new file on one line, so that the declaration is read
   whole.
2. **CI is green on the head:** run 41290858101 (pull_request, `cb7485add`), attempt 2. Attempt 1 failed only TST-1240031,
   on the brief's list of known flips. `git merge-tree` with the sprint branch's current head is clean.
3. **Only the item's module and its tests change.**
   - The code is in `src/review-pages/` (`common.mjs`, `flow.mjs`, `jobs.mjs`, `edit.mjs`, `entry-edit.mjs`).
   - Every changed test file is headed MOD-review-pages.
4. **The Acceptance holds:**
   - On a product's review page, every link to a route of MOD-review-pages carries `/product=<encoded address>`, which
     `chosenProduct` reads back. The instance's links are unchanged.
   - The links are built in one place, `reviewHref`/`reviewLink` in `common.mjs`, which ITM-1350's row link now uses too
     (AGENTS.md §2.2).

## Rulings

- **sonnet-l's commit `cb7485add`** is written from the pushed code by a participant who implemented none of the item.
  TST-1273301, 302, 304 and 305 expect the product in the links. All four fail on the base, and 303 is unchanged. Allowed.
- **The readings of the pull request** are taken:
  - `/product=` stands after the address's last part, as `menuOf` writes it;
  - links to other modules' routes are not this item's.
