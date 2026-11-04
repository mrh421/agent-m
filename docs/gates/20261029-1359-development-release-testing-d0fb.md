---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - fc87e8b7f5648c7125f3ec81323035c501d2ca84
  - https://github.com/akmaier/agent-m/pull/1452
date: 2026-10-29 13:59 UTC
---
# Development → Release testing: ITM-1308, the move tests guard UC-033 by identifier

**REGISTER**

## Reason

ITM-1308, pull request #1452 into `sprint/team1/118`, passes on `fc87e8b7`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874). The item is a refactoring of a test's declarations. So its
commits are green, as A REFACTORING JOB BEGINS WITHOUT A FAILING TEST asks (SPEC.md:1467-1469), and the sprint's brief
says so of ITM-1308.

1. **CI is green on its one commit.** Run 40886287180, `pull_request`, on `fc87e8b7` succeeds: 41 jobs pass and 17 are
   skipped.
2. **Only the item's file changes:** `tests/maintenance-pages-move-1250.test.mjs` (MOD-maintenance-pages), as the
   Acceptance says. The merge base is `sprint/team1/118` at `a88abf5e`. No code changes, no test of another module
   changes, and no test is removed.
3. **No expected result changes.** The diff is five `guards:` lines: TST-1250202, 1250203, 1250204, 1254201 and 1254202.
   "UC-033 2", "UC-033 1a" twice, "UC-033 4b" and "UC-033 4a" each become `UC-033`. No `given:`, `input:`, `expect:` or
   assertion changes. That satisfies A REFACTORING JOB CHANGES NO EXPECTED RESULT (SPEC.md:1473-1476).
4. **The Acceptance holds: the reader reads the file with no finding.** I ran MOD-test-document's `testDeclarations` and
   `testFindings` on `fc87e8b7`.
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - **Before:** the base's blob of the file (`7bfe456c`, the same on `main` at `59d5f7ee2`) gives 6 declarations and 5
     findings. Each finding falls under A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION, one for each entry above.
   - **After:** 6 declarations and 0 findings.
5. **The tests, run by me on `fc87e8b7`:** `tests/maintenance-pages-move-1250.test.mjs` and
   `tests/test-document-one-line.test.mjs`, 8 pass and 0 fail.
6. **The pull request's description** names only its own item, and quotes no `JOB-` identifier.

## Noted

- ITM-1308 changes a test and no behaviour, so no release test of it is due, as for ITM-1303 in sprint 117.
