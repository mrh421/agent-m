---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 22b1903a7f1081eafe0a0905f40c029b7b8a265d
  - https://github.com/akmaier/agent-m/pull/1763
date: 2026-11-02 21:21 UTC
---
# Development → Release testing: ITM-1446, #1763

**REGISTER**

## Reason

ITM-1446 (the maintenance pages' buttons and tables wear the site's one look) may go on. The pull request is #1763 into
`sprint/team1/143`, at `22b1903a7`. developer-sonnet-j wrote the tests-only commit `29e85acb9` and the code `22b1903a7`
(trailers on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** It adds `tests/maintenance-pages-look.test.mjs`.
   In run 41523188713 (attempt 2; attempt 1 was cancelled at the limit), only TST-1446002 to 1446005 fail. TST-1446001,
   the checks' known positive and negative, passes.
2. **CI is green on the head:** run 41525946313 (`22b1903a7`), at attempt 1. `git merge-tree` with the sprint branch's
   head `c0f53794b` is clean.
3. **Only the item's module changes:** one line each of `src/maintenance-pages/mail.mjs`, `replies.mjs` and `issues.mjs`
   (MOD-maintenance-pages), plus the new test file.
   - Before, the helpers `button(className, …)` (`mail.mjs:55-56`, `replies.mjs:61-62`; `issues.mjs` uses mail's) drew
     buttons without `btn`, and the table `fix-expectations` (`issues.mjs:424`) had no `list`.
   - Both helpers now add `btn`, and the table adds `list`. Drawing the pages confirms the probe's hits: 4 buttons on the
     mail page, 9 on the replies page and 4 on the issue pages.
   - No CSS is added, and no existing expected result changes.
4. **The new tests name `EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE` and MOD-maintenance-pages.** The pull request
   records five counter-proofs.
5. **The Acceptance holds:** every button of the mail, replies and issue pages carries `btn`, and the table
   `fix-expectations` carries `list`.

## Ruled

- **sonnet-j's reading stands.** Buttons the same helpers draw that the fixture world cannot reach (*Sign in again*, *Add
  report data* and the like) are covered by the shared helper's line, and no test names each.
- **The reads.** sonnet-j read the binding documents and chapters in full for ITM-1365, in the same context, and this
  item's files in full.
- `system-uc-038/039-bridge-route` hang in sonnet-j's local run but are green in CI. They are not counted as a flip.
