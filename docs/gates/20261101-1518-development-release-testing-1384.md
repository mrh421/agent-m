---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - b8174c4836b14f1376a190db501f8a848181d08b
  - https://github.com/akmaier/agent-m/pull/1676
date: 2026-11-01 15:18 UTC
---
# Development → Release testing: ITM-1384, #1676

**REGISTER**

## Reason

ITM-1384 (a removed realised name ends the job with its note) may go on. The pull request is #1676 into
`sprint/team1/142`, at `b8174c483`. developer-sonnet-k wrote the tests-only commit `09dcfa7c5` and the code `e5e5e4cd7`;
developer-sonnet-l wrote `b8174c483`, the lift of TST-580209's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `09dcfa7c5` changes
   `tests/artifact-edits-open-files.test.mjs` (MOD-artifact-edits) only. In run 41319529673 its failing cases are the new
   TST-1384001 and the moved TST-472036. The same run failed one case of `tests/settings-pages-participants.test.mjs`, which
   the commit does not touch and which passes on the head: its second flip, now ITM-1388 (below).
2. **CI is green on the head:** run 41319899387 (`b8174c483`), at the first attempt. `git merge-tree` with the sprint
   branch's head is clean.
3. **Only the item's module changes:** `src/artifact-edits/strategies.mjs`, one line and a comment. The probe placed the
   change there: the note `<id> realised "<name>", which matches no requirement; removed` reached the `## End`'s results,
   whose list `writeDocument` refuses with a comma (`src/documents/checks.mjs:80-81`). The note now reads
   `<id> realised "<name>" which matches no requirement; removed`, the wording the fixtures of
   `review-pages-job-notes-one-record` and `release-itm-1311` already use, and a comma in a name shows as `;`.
   MOD-job-ledger does not change.
4. **The Acceptance holds:** the use case is written and the job ends `done`, its note naming the use case and the name.
   TST-472036's expectation moves in the tests-only commit; MOD-artifact-edits states that the notes name the use case and
   the name (MOD-artifact-edits.md:136-138), not their words. Planted faults: the comma restored fails both cases;
   `replaceAll` dropped fails TST-1384001 alone. TST-580209 loses its `todo`: red at `09dcfa7c5`, where the page shows the
   comma's `DocumentError`, green on the head.

## Reading not taken

- The `## End`'s `notes` field keeps commas, but no caller writes it, and using it would change three other modules. The
  note's wording is the smaller change.

## Finding, ruled

- **`settings-pages-participants` flipped a second time → ITM-1388 (MOD-settings-pages, its test only), registered in
  this commit.** It failed at `:329` with "No participants are registered yet." and passed on the next commit; sprint 141
  counted its first flip.
