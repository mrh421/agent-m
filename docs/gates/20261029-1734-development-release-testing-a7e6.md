---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9ff29dace635b65f12d84bd351bfa30a153a2ba3
  - https://github.com/akmaier/agent-m/pull/1469
date: 2026-10-29 17:34 UTC
---
# Development → Release testing: ITM-699, the old process-model reader and job file go

**REGISTER**

## Reason

ITM-699, pull request #1469 into `sprint/team1/121`, passes on `9ff29dac`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874). The item is declared as refactoring, so CI is green on every
commit and no expected result changes.

1. **CI is green on every commit.**
   - `7f48cdbb`, the test change: run 40920069080 (`pull_request`, attempt 1) succeeds, 58 jobs, none failed.
   - `9ff29dac`, the removal: run 40920171022 (`pull_request`, attempt 1) succeeds, 58 jobs, none failed.
2. **Only the item's files change:** `docs/assets/jobs/propose-backlog-items/job.json` goes, as MOD-job-catalogue.md:45
   says, and `tests/test_backlog_item_fields.py` (MOD-work-plans), which the item's Acceptance names for this one test.
   No code of a module changes.
3. **No expected result of a remaining test changes.** The three cases of `TestTheJobThatDraftsItems` that read the file go
   with it, with their helper `definition()`, the constant `JOB` and the docstring's sentence on the folder. The class's
   counter-proof case reads no job file, and stays as it was.
4. **What the removed cases guarded stays guarded,** as the pull request names it, case by case. I read both cases on the
   head.
   - TST-472283 (`tests/job-catalogue.test.mjs`) checks each shipped kind against its row, `propose-items` among them: the
     use cases it serves, what its participant needs, its recipes, checks, review, writer and limit.
   - TST-472284 checks that each kind's prompt has a named place for exactly its recipes, and that its draft's schema is
     an object in the five keywords.
   - The file passes here, 9 of 9.
5. **Checked by me on `9ff29dac`.**
   - `python3 -m unittest test_backlog_item_fields test_artifact_format test_coverage_report`: OK.
   - `tests/test_artifact_format.py:123` names the path as a string and reads no file, so it passes unchanged, as the
     Acceptance says.
   - MOD-test-document's reader over `tests/test_backlog_item_fields.py` reads its header, MOD-work-plans at level `unit`,
     with 0 findings. The file holds no declaration, before or after. Its control, `tests/release-itm-1254-issue-move.test.mjs`,
     gives 4 declarations and 0 findings.
   - My planning run had named the same three cases, and no other.

## Noted

- `docs/assets/jobs/propose-backlog-items/prompt.md` now stands alone in its folder. No module's Parts name it, and nothing
  reads it. It is a file outside every module that no item names; for the review.
- Release testing of ITM-699 needs no release test: it changes no behaviour.
