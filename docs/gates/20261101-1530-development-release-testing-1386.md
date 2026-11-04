---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 3606995de43e0fab8d353ace6434f351fb9f8f6a
  - https://github.com/akmaier/agent-m/pull/1677
date: 2026-11-01 15:30 UTC
---
# Development → Release testing: ITM-1386, #1677

**REGISTER**

## Reason

ITM-1386 (the drafting page shows each round's findings) may go on. The pull request is #1677 into `sprint/team1/142`, at
`3606995de`. developer-opus-f wrote the tests-only commits `c464cd140` and `9e1f7a812` and the code `46e4fc969`;
developer-sonnet-l wrote `3606995de`, the lift of TST-580318's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commits hold only tests and are red for the item's reason.** `c464cd140` and `9e1f7a812` change
   `tests/review-pages-draft-use-cases.test.mjs` (MOD-review-pages) only. In runs 41319693032 and 41320336893 the only
   failing cases are the new TST-1386001 and TST-1386002. `9e1f7a812` changes how TST-1386002 counts the left list, not
   its expectation.
2. **CI is green on the head:** run 41321149767 (`3606995de`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only the item's module changes:** `src/review-pages/jobs.mjs`, `presentDraft`. It now appends the one
   `roundsSection` of `sections.mjs` and draws the findings left through the file's `findingsList("left", …)`, reused, not
   copied.
4. **The Acceptance holds:** after *Run*, the page shows the count and each round with its findings, as the
   architecture's are shown. No other expected result changes. Planted faults: no rounds section fails both cases;
   `rounds.slice(-1)` fails both; a stop reason forced to passed fails TST-1386002 and TST-472620. TST-1386001 and 1386002
   had no history before this pull request's own run records (known positive: TST-472619).
5. **TST-580318 loses its `todo`** in sonnet-l's commit, red at `9e1f7a812` ("the finding of round 1 is on the page") and
   green on `46e4fc969`. sonnet-k wrote the case; `presentDraft`'s authors by trailer are opus-f and sonnet-k, and
   `roundsSection` came with ITM-441; no trailer names sonnet-l. The release file gives 18 pass and 1 `todo`, TST-580305,
   which ITM-1385 owns.

## Reading taken

- The findings left are drawn with `findingsList`, as the architecture's draft draws them, and not beside the old list.
  The old list next to `roundsSection` counted each left finding twice and moved TST-580212, 580314 and 580316; the
  chosen form moves none of them. The `—` under a use case's *Extra sections* stays as the item reads it.

## Noted

- `sections.mjs`' `findingText` and `jobs.mjs`' `findingLine` both write the compiler-form line, which MOD-review-pages'
  Uses names as MOD-text-tools' `formatFinding`. That is not this item's work. It is a candidate for the review, not
  registered now.
