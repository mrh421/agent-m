---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - d4caaaba70184e538cb6854654c2d621ad5e2ce4
  - https://github.com/akmaier/agent-m/pull/1687
date: 2026-11-01 18:31 UTC
---
# Development → Release testing: ITM-1400, #1687

**REGISTER**

## Reason

ITM-1400 (a requirement with empty fields is read and marked) may go on. The pull request is #1687 into
`sprint/team1/142`, at `d4caaaba7`. developer-sonnet-j wrote the tests-only commit `d9a930c51` and the code `4664d70b2`;
developer-sonnet-l wrote `d4caaaba7`, the lift of TST-376222's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `d9a930c51` adds
   `tests/spec-document-empty-fields.test.mjs` (MOD-spec-document). In run 41328370781 the only failing cases are its own,
   TST-1400001 to 1400005.
2. **CI is green on the head:** run 41329573736 (`d4caaaba7`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/spec-document/parse.mjs`. The name of `BOLD_NAME` may be empty, so `****` opens a
   requirement named "". `checkFollows` also accepts a `*Check:*` line that opens the next paragraph after an empty line,
   which is how the editor opens a new requirement. The path was `edit.mjs:24` `EMPTY_FIELDS` → `edit.mjs:88`
   `requirementFindings(parseSpec(…))` → `headAt`. Before, it read no requirement and gave no finding. Now it reads one
   requirement with source, rule and check `null`, and gives three findings.
4. **The Acceptance holds:**
   - The probe found that `SPEC.md` reads as the same 420 requirements before and after, and no file of the repository
     reads differently. No other expected result changes.
   - Seven planted faults each fail a new case.
   - TST-376222 loses its `todo` in sonnet-l's commit: red at `d9a930c51`, green on the head. opus-e wrote the case, and
     sonnet-l built none of `parseSpec`. The same commit moves `3d-empty-fields` from the open findings to the evidence of
     TST-376201's map, which asks every open finding to be a `todo`.

## Readings taken

- An empty name is read as "".
- A bare bold name followed by an empty line and then `*Check:*` is a requirement's head line.
- `**VERBINDLICH (SPEC)**` and other bold prose stay prose.

## Noted

- `formatFinding` writes a finding on the requirement "" as `:7:`, which `parseFinding` cannot read back (MOD-text-tools).
- `impactOf` would list a requirement "" (MOD-review-pages).

Neither is reached by a case today. Both are candidates for the review, and neither is registered now.
