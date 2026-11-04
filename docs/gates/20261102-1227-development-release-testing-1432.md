---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 16473260e45140ab7116742a112185ba5890f6e3
  - https://github.com/akmaier/agent-m/pull/1736
date: 2026-11-02 12:27 UTC
---
# Development → Release testing: ITM-1432, #1736

**REGISTER**

## Reason

ITM-1432 (the audit's rows link their limitation, their log and their accepted text) may go on. The pull request is #1736
into `sprint/team1/142`, at `16473260e`. developer-opus-e wrote the tests-only commit `fe3495743` and the code `4c9e110c6`;
developer-sonnet-l wrote `16473260e`, the lift of TST-775205's, 775214's and 775217's `todo`, after the code was pushed
(`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `fe3495743` adds TST-1432001 to 1432003 to
   `tests/trace-pages-audit.test.mjs` (MOD-trace-pages). In run 41442762254 they are the only failing cases.
2. **CI is green on the head:** run 41444004312 (`16473260e`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/trace-pages/audit.mjs` and `test-detail.mjs`, which now offers its `runIdOf`
   to the audit.
   - **F4:** `rowOf` (:121) drew who accepted and when. The row's detail now names the accepted text's blob SHA, and the
     cell of the acceptance is unchanged.
   - **F2:** the limitations (:202) were plain items. Each now links the rows of the test it names, which pressing opens.
     Its text is unchanged.
   - **F3:** the view drew the runs (:136) and never asked for a log. It now finds the runs that the release commit's
     records cite for each row and asks `ciRunLog` once per run, all at once. A row whose cited logs are all gone reads
     "unavailable", and its outcomes stay.
4. **The Acceptance holds:**
   - The five counter-proofs in the pull request each fail only their case: no blob, plain limitations, no log asked, logs
     asked one after another, and unavailable when any log is gone.
   - TST-775205, 775214 and 775217 lose their `todo`: each red at `fe3495743`, green at `4c9e110c6`. Their expectations'
     words are kept. sonnet-k wrote them, and sonnet-l built none of the page.
   - The release file of UC-030 gives 23 of 23. Its system file has two `todo` left, for ITM-1431 and ITM-1433.

## Readings taken

1. **When the log is asked.** MOD-trace-pages asks `ciRunLog` "when the person opens the link" for a mark of a test's
   history (UC-029 5b), and its Uses say the same of UC-029. Its text sets no such moment for the audit of a release, and
   UC-030 2d marks the link unavailable on the audit itself. So the audit asks once per cited run, all at once, when it
   is drawn. That is a request per run of the release, not per test.
2. A row reads "unavailable" only when none of its cited logs is kept.
3. `runIdOf` checks an identifier against `WebLinks`' `run` where the host builds run addresses, and leaves it unchecked
   where it builds none.
4. A limitation concerns the rows that hold the test it names.
5. The blob stands in the row's detail.

All are taken.
