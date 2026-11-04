---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - a16757c0358b846251e82be44cecc86a57d6eb82
  - https://github.com/akmaier/agent-m/pull/1493
date: 2026-10-30 04:32 UTC
---
# Development → Release testing: ITM-1292, a closed issue is noted once, whatever the number of routes

**REGISTER**

## Reason

ITM-1292, pull request #1493 into `sprint/team1/124`, passes on `a16757c0`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **CI.**
   - **Tests-only commit `dd4c2131`:** run 41002625832 fails, only on the four new cases, in three files:
     - `tests/issue-handling-close-with-links.test.mjs`, with TST-1292001 and TST-1292002;
     - `tests/workflow-entries-pull-request-closed.test.mjs`, with TST-1292003;
     - `tests/workflow-entries-merge-request-closed.test.mjs`, with TST-1292004.
     That is the item's reason: `closeWithLinks` reads no issue.
   - **Head:** run 41002904380 (`pull_request`, attempt 1) succeeds.
2. **Only the item's files change.**
   - Code: `src/issue-handling/classes.mjs` alone. `closeWithLinks` builds the note, reads the issue with
     `host.readIssue`, and returns where the issue is closed and a comment equals the note. Otherwise it notes and closes
     as before.
   - Tests: the two test files of MOD-workflow-entries and the one of MOD-issue-handling, both modules the item names.
     The shared fake `tests/workflow-entries-pull-request-world.mjs` also changes. Its header names
     `Module: MOD-workflow-entries` and `Level: unit`, so it is a test helper of the item's module ("tests that name one of
     those modules", SPEC.md:1478-1482).
3. **The change of the shared fake belongs to the item, and developer-sonnet-l's planned commit is not due.**
   - The plan gave the fakes `readIssue` "in the files its run names" (`team1/124.md`, ITM-1292). The planning run named
     the two release tests and the system test because they reach the fake through this world, not because their own
     text needs a change.
   - Changing the world once is the place the plan's change belongs: one fake, not a copy in each file that uses it.
   - With it, `release-itm-1259-merge-request-closes-issues`, `release-itm-1289-merged-merge-request-runs-entry` and
     `system-uc-012-fix-a-bug` pass unchanged. Locally on the head they give 11 of 11, with 39 of 39 across the item's
     files and `maintenance-pages-fix-583`.
   - No release test's text changes, so RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER (SPEC.md:1537-1541) is not
     touched, and nothing is left for developer-sonnet-l to change. Its release tests of this item read the world as it
     now stands.
4. **No expectation is weakened.**
   - The issue-handling `hostOf` gains `readIssue` and a separate `reads` list, so the existing `calls` assertions keep
     their values.
   - The fakes now keep what is written to an issue and serve it back. Every existing case of the three files passes with
     its expected values unchanged.
5. **It builds the item's Acceptance.**
   - "A unit case runs the entry twice for one merged pull request, as two routes do, and finds one close and one note":
     TST-1292003 on GitHub and TST-1292004 on GitLab. Each asserts four writes over two runs, all in the first, and each
     run reading each issue once.
   - Only `src/issue-handling/` and the tests of the two modules change.
   - `closeWithLinks` keeps its types and its errors (MOD-issue-handling.md:85-87). TST-1292002 shows that a refused read
     writes nothing.
6. **The pull request's three readings are right.**
   - `readIssue` is a function of the Host, "the object `connect` returns" (MOD-repository-hosts.md:111). It is called
     on the host the function is given, and nothing new is imported. That is the reading the item records.
   - "Already closed with that note" is read as state `closed` and a comment equal to the note. `noteText`'s
     `closed-with` holds no date, so the note written on another day still equals it.
   - Types and errors are unchanged.
7. **Counter-proofs, made on the head and restored after.**
   - Taking out the early return fails TST-1292001, TST-1292003 and TST-1292004; 16 pass, 3 fail.
   - Writing the note before the read fails TST-1292002 and the others of the file; 1 pass, 7 fail.
   - Restored, the file gives 8 of 8.
   - Each new case's known positive passes: another pull request's note, and an issue closed by hand with no note, are
     still noted and closed.
8. **MOD-test-document's reader:**
   - `tests/issue-handling-close-with-links.test.mjs`: 8 declarations, 0 findings.
   - `tests/workflow-entries-pull-request-closed.test.mjs`: 6 declarations, 0 findings.
   - `tests/workflow-entries-merge-request-closed.test.mjs`: 5 declarations, 0 findings.
   - The world gives none, and its header has no finding.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`: 4 declarations, 0 findings.
   - Each new declaration's `given`, `input` and `expect` stands on one line each, as the diff shows them (TST-1292001 to
     TST-1292004), and `tests/test-document-one-line.test.mjs` passes on the head.
9. **Reads,** as the plan counted them: one `readIssue` more per close, that is the issue and its comments. A second run
   writes nothing.

## Noted

- Taking out only the check of the state, so that a comment alone decides, fails no case: 19 of 19 pass. An issue a person
  reopened after it was closed with this note would then be left open by a later run of the entry. The Acceptance does
  not ask for that case, so it does not hold the gate; it is for the release tests to read.
- The pull request's description names no runs. The runs are those above.
