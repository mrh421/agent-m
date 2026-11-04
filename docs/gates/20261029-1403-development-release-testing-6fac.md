---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9d1f7b43db3130c461daa5a1701e47c83091423c
  - https://github.com/akmaier/agent-m/pull/1454
date: 2026-10-29 14:03 UTC
---
# Development → Release testing: ITM-1310, the frame's style names no class the pages no longer draw

**REGISTER**

## Reason

ITM-1310, pull request #1454 into `sprint/team1/118`, passes on `9d1f7b43`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874). The item is a refactoring of a style sheet. So its commits are
green, as A REFACTORING JOB BEGINS WITHOUT A FAILING TEST asks (SPEC.md:1467-1469), and the sprint's brief says so of
ITM-1310.

1. **CI is green on its one commit.** Run 40886473848, `pull_request`, on `9d1f7b43` succeeds: 41 jobs pass and 17 are
   skipped.
2. **Only the item's file changes:** `src/site-frame/look.css` (MOD-site-frame), one line. `.spec-entries-link` leaves
   the `:is(…)` rule at `:76`, and the other seven classes stay. That is what the Acceptance says. No test changes and
   none is removed. The merge into `sprint/team1/118` has no conflict (`git merge-tree`).
3. **No expected result changes.** No test file is touched. A REFACTORING JOB CHANGES NO EXPECTED RESULT holds
   (SPEC.md:1473-1476).
4. **The Acceptance holds.** On `9d1f7b43`, a search of `src/` and `tests/` for `spec-entries-link`, read to its end,
   finds only `tests/release-itm-1180-spec-view-links.test.mjs`, at `:18`, `:83`, `:84` and `:97`. That test asserts that
   no anchor has the class. Before, the search found `look.css:76` as well; that is the known positive.
5. **The tests, run by me on `9d1f7b43`:**
   - Node: every test that names a site style sheet, with `release-itm-1180-spec-view-links`, `test-document-one-line`,
     `site-usability` and `site-accessibility` (17 files). 467 pass, 0 fail and 2 todo; the two todos are `site-usability`'s
     `# FINDING` cases of ITM-1159.
   - Python: `test_no_backend`, `test_main_page` and `test_single_definition`, OK.
   - This is the run that planning made with the same change applied (`docs/backlog/sprints/team1/118.md`). The blob of
     `look.css` is `7e4d30c9e` in both.
6. **The reader.** No test file is new or changed. Its known positive, `tests/release-itm-1254-issue-move.test.mjs`, reads
   4 declarations and 0 findings.
7. **The pull request's description** quotes no `JOB-` identifier.

## Noted

- ITM-1310 changes a style and no behaviour, so no release test of it is due.
- The pull request reads "the existing code and tests of those modules" as `look.css`, the test that names the class,
  and the two checks of the realised requirement, not all of MOD-site-frame's test files. Planning's run covered every
  test that reads a style sheet of the site, so the reading leaves nothing unrun.
