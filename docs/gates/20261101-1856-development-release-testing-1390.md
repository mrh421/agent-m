---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 82fa2e741bfbf86b2a55a5f6b142c2fa4b28e35f
  - https://github.com/akmaier/agent-m/pull/1690
date: 2026-11-01 18:56 UTC
---
# Development → Release testing: ITM-1390, #1690

**REGISTER**

## Reason

ITM-1390 (merged candidates stay merged on the drafting page) may go on. The pull request is #1690 into
`sprint/team1/142`, at `82fa2e741`, a merge of the sprint branch into the item. developer-sonnet-k wrote the tests-only
commit `324f38a3d` and the code `8a1475d03`; developer-sonnet-l wrote `b3f1a8701`, the lift of TST-579212's and
TST-579321's `todo`, after the code was pushed (`Agent-M-Participant` on each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `324f38a3d` adds
   `tests/review-pages-merged-candidates.test.mjs` (MOD-review-pages). In run 41337674635 its new cases fail, and so does
   TST-371318, which `main`'s tick change had moved and #1691 has since followed. Nothing else fails but the `todo` cases
   that name a finding.
2. **CI is green on the head:** run 41338291832 (`82fa2e741`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/review-pages/candidates.mjs` and `jobs.mjs`.
   - The path: `classifyCandidates` (`src/documents/candidates.mjs:40`) gives one class with the `refs` and passages of
     both candidates. `presentRequirements` then drew one item per candidate, and `editedResult` rebuilt one class per
     candidate.
   - Now `shownOnPanel` shows a class by its first candidate, and `passagesLine` names every passage of a class of two or
     more. `editedResult` keeps the class's `refs` and passages.
   - A class of one shows nothing new, so no existing expected result moves.
4. **The Acceptance holds:**
   - Two candidates that state one rule are one candidate naming both passages, and *Write proposals* writes one
     requirement.
   - Known positive: two different rules both stay (TST-1390003).
   - Five planted faults each fail a new case.
   - TST-1390001 to 1390005 had no history before this pull request's own commits.
   - TST-579212 and 579321 lose their `todo` in sonnet-l's commit: red at `324f38a3d` ("one candidate on the panel", 2 ≠ 1),
     green at `8a1475d03`. sonnet-j wrote both cases, and sonnet-l built none of the page.

## Reading taken

- UC-005 6.1, "merged into one, naming every passage": the panel shows the first candidate's rule and check with the line
  of passages. The other names are neither shown nor written.

## Noted

- `jobs.mjs`' `candidateClass` repeats `classOf` of `candidates.mjs`. It is left alone as outside the item; it is a
  candidate for the review, not registered now.
