---
id: ITM-1258
title: The pull-request tests pass again after the progress route and the hand-over
level: module
realises:
  - UC-041
  - UC-049
modules:
  - MOD-implementation-pages
  - MOD-prompt-bar
  - MOD-workflow-entries
builds_on: []
tests:
  - unit
  - component
  - system
origin:
  - the scrum master, from PR #1382's run 40639391268 on its head merged with main, and a local run on main at 9f0e07fd; main's push runs run only setup and records, so the break shows on pull requests only
---
# ITM-1258 The pull-request tests pass again after the progress route and the hand-over

**REGISTER**

## Outcome

Since the commits of ITM-1252 (79f1cc15, e29d5239) and of UC-049 4a.2 and 4f (6bbb3630), every pull request's run of
"agent-m tests" fails in three jobs, and the same tests fail on main:

- `unit-pull-request (16)`: TST-1169002 (`tests/test-document-one-line.test.mjs`), "6 declarations are read without a
  field": declarations wrap a field over two lines in the prompt-bar and workflow-entries tests (`prompt-bar-hand-over`,
  `prompt-bar-spawn-reads`, `workflow-entries-converse-proposals`, `workflow-entries-hand-over-in-run`).
- `system-pull-request (2)`: `tests/test_progress_derived.py`, `test_the_page_shows_the_derived_states` (:95) and
  `test_counter_proof_a_state_planted_into_local_storage_changes_nothing_shown` (:103): the page shows no states.
- `component-pull-request (5)`: TST-904116 (`tests/site-usability.test.mjs`), "#backlog at a phone's width: a "ITM-001" is
  60 x 17 px".

The tests and the code follow the accepted texts again, ITM-1252's and UC-049's among them.

## Acceptance

- On a pull request, every unit, component and system job passes, with these tests run, not skipped; no expectation is
  weakened where an accepted text requires it, and where a test checks what an accepted text no longer says, it follows
  the text and names it.
- Only the code and tests of the modules above, and the tests named, change.
