---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - fc27e82f8f604675762baf4d7401b5c493033470
  - https://github.com/akmaier/agent-m/pull/1644
date: 2026-11-01 21:45 UTC
---
# Development → Release testing: ITM-1358, #1644

**REGISTER**

## Reason

ITM-1358 (a pending move names where the item came from) may go on. The pull request is #1644 into `sprint/team1/141`, at
`fc27e82f8`. developer-sonnet-k wrote the code and the unit tests. developer-sonnet-l wrote the UC-021 changes and the
merges (`Agent-M-Participant` on each commit). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `76448f6f4` changes
   `tests/review-pages-arrange.test.mjs` and `tests/review-pages-arrange-propose.test.mjs` (MOD-review-pages). In run
   41295136848 (pull_request) only TST-1358001 to 1358004 and the moved TST-072702, 072706 and 072707 fail.
2. **CI is green on the head:** run 41295742559 (pull_request, `fc27e82f8`), at the first attempt. `git merge-tree` with
   the sprint branch's current head is clean.
3. **Only the item's module changes:** `src/review-pages/arrange.mjs` (`8a8408a83`).
   - `originOf` reads where an item or group stood before the move.
   - `drawSide` replays the pending moves on the tree read and describes each against the tree before it: "Move X from
     "A" to "B"", or from the top level. A group's move reads the same way.
4. **The Acceptance holds:**
   - A pending move names the item, the group it came from and the group it goes to, and a group's move names it the same
     way (TST-1358001 to 1358004).
   - The pull request records four planted faults: an item's origin forced to the top level, a group's origin forced to
     the top level, no replay, and an empty tree.
   - TST-738006 loses its `todo` in sonnet-l's `60f583704`, written from the pushed code. There, TST-738005 and 738009
     take the new wording and `main-3-from-group` moves to `FLOW_EVIDENCE`. All three fail on the base, and no assertion
     is weakened.

## Readings, ruled

- **"A pending move" excludes a refused one.** A refused move keeps "Move X to "G": reason", so TST-738010, TST-072706's
  refused line and `release-uc-021`:121 are unchanged. Taken.
- **A group's label stays its path of titles.** Taken.
