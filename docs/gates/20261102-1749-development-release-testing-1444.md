---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 8d2ddea089a2579d56c0aac13fcb2ce5bbdbd642
  - https://github.com/akmaier/agent-m/pull/1752
date: 2026-11-02 17:49 UTC
---
# Development → Release testing: ITM-1444, #1752

**REGISTER**

## Reason

ITM-1444 (every page's controls wear the site's one look, the mailbox page first) may go on. The pull request is #1752 into
`sprint/team1/143`, at `8d2ddea08`. developer-sonnet-j wrote all three commits (trailers on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `9acff3924` adds
   `tests/settings-pages-look.test.mjs`. In run 41481947586, only `unit-pull-request (9)` fails, and only on TST-1444002
   and 1444003.
2. **CI is green on the head:** run 41487526686 (`8d2ddea08`), at attempt 2. At attempt 1, `unit-pull-request (4)`, a
   shard this change does not touch, was cancelled at the two-minute limit with no step failed. `git merge-tree` with the
   sprint branch's head `6f17e08c0` is clean.
3. **Only the item's module changes:** eight files of `src/settings-pages/` (MOD-settings-pages) and the new test file.
   - Before, `mailbox.mjs`'s `route.render` drew a bare `h2` and bare `h3`s as the page's children, and the site's style
     sheet styles `.head`, `.panel` and `.step`.
   - Now every route's `h2` stands in `section.head`. The mailbox page's and the Bridge page's parts are `section.panel`,
     and the Bridge page's head comes first.
   - `74649b552` committed five `*.mjs-E` sed backups, and `8d2ddea08` removes them, so the pull request's diff holds none.
     No existing test changes.
4. **The new tests name `EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE` and MOD-settings-pages.** The pull request
   records a counter-proof for each of the four. TST-1444004 (every button carries `btn`) was green before, as the probe
   found every Settings button already with `btn`.
5. **The Acceptance holds:**
   - The Settings pages' heads, sections and buttons wear the look.
   - The probe's list stands in the pull request, by module, with `file:line`.
   - The fields (`select`, `input`) have no rule in the site's style sheet outside a few scoped classes (`look.css:50,
     :80`). As the item says, that part goes to an item of MOD-site-frame's: ITM-1445, registered with this record. No
     second style is added.

## Ruled

- **"Menu" read as `select`, "structuring element" as a heading in a panel or step.** These readings are sonnet-j's, and
  they stand. The Settings tab pane may hold a heading. `library.mjs:113` keeps its `h2` inside a panel, since no test
  names it; it is noted, not an item.
- **The reads.** sonnet-j read the SPEC requirements by `grep` and not the book chapters in full (AGENTS.md §1). This is not
  a condition of the gate (scrum-wip.md, Gates; `THE DEFAULT DEFINITION OF DONE IS THE JOB RULES`), and the work holds on
  every check above. It is the second time in a row (after ITM-1442), so it is a point for the retrospective.

## Noted

The probe's parts of other modules are registered as items, one per module: ITM-1445 (MOD-site-frame), 1446
(MOD-maintenance-pages), 1447 (MOD-implementation-pages), 1448 (MOD-trace-pages), 1449 (MOD-test-pages), 1450
(MOD-main-page) and 1451 (MOD-markdown-render).
