---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 4318b0e1e47e579993527776f8b47991feeb39d6
  - https://github.com/akmaier/agent-m/pull/1545
date: 2026-10-31 05:27 UTC
---
# Development → Release testing: ITM-1321, one test identifier names one test case

**REGISTER**

## Reason

ITM-1321, pull request #1545 into `sprint/team1/130`, passes on `4318b0e1`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1875-1880).

1. **CI.** Run 41171919835 (`pull_request`, attempt 1) on `4318b0e1` succeeds: 41 jobs succeed, 17 are skipped, and none
   failed.
2. **The first commit holds only tests and is red for the item's reason.**
   - `341bab305` adds `tests/trace-graph-repeated-tests.test.mjs` alone.
   - Run 41171409106 on it fails in one job, `unit-pull-request (11)`, on TST-1321001 ("two files") and TST-1321002 ("the
     four identifiers, each at its two declarations").
3. **Only the item's module and its own test change**, by developer-opus-e (`Agent-M-Participant` on both commits).
   - `src/trace-graph/checks.mjs`, +25 −1: `repeatedTests`, called by `graphFindings` after `cycles`, under THE NAME IS
     THE ID AND IT SURVIVES.
   - It imports nothing new and changes no type. It is the check MOD-trace-graph's accepted text holds in
     `graphFindings`.
4. **The Acceptance holds.**
   - TST-1321001: over fixture graphs whose files declare TST-001 twice — in two files, twice in one file, and once with
     only an `exercises` edge — there is one error at each declaration, naming the other by path and line. The known
     positive with distinct identifiers gives none.
   - TST-1321002: the repository's committed test files, read as TST-292101 reads the gate records (`git ls-files`), give
     no finding. Its history's known positive, sprint 127's TST-1187101 to 1187104 declared again in
     `release-itm-1187-bar-offers-sessions`, gives 8 errors.
5. **Counter-proof, planted by me** on the head, in my checkout, and restored after.
   - With `repeatedTests` left out of `graphFindings`, TST-1321001 and 1321002 fail (0 pass, 2 fail).
   - Restored, in the checkout with `.git`: the new file, `trace-graph-import-uses` (TST-106805 among them) and
     `trace-graph-uses-provided` give 9 tests, 9 pass.
6. **MOD-test-document's reader,** in an export of `4318b0e1`:
   - The new file has 2 declarations and 0 findings, each `unit` and MOD-trace-graph. Its header gives one module at
     level `unit`.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, has 4 declarations and 0 findings.
   - **The repeat reading** finds 1,492 test files, 5,850 declarations, 5,850 identifiers and 0 repeats. `graphFindings`
     of the head over its 5,850 test nodes gives no repeat finding either.
7. **The tests of the callers,** in the export: `trace-graph-checks`, `-facts`, `-code`, `work-plans-plan-findings-graph`,
   `work-plans-plan-checks`, `job-runner-graph-checks`, `review-pages-edit-architecture` and `test-document-one-line`
   pass. The three files that read `git ls-files` fail there for want of `.git`, as on the base, and pass in the
   checkout (5 above).
8. **The readings of the pull request hold.**
   - **A place is a path and a line.** That is the text's "the path and line of its node and of its `guards` and
     `exercises` edges". The finding names the path as its artifact, as the import check of the same function does for a
     code file, and the identifier in its words.
   - **A repeated declaration that guards nothing and names no module has no place in the graph.** The text names the
     places as those of the node and its two kinds of edges. The node keeps the declaration read last, so such a
     declaration leaves none. MOD-test-document's `testFindings` already gives an error under EVERY ARTIFACT NAMES ITS
     ORIGIN for a test that guards nothing or names no module. So no repeat goes unreported by a clean declaration.

## Noted

- With ITM-1321 merged, the repeat reading by hand at the release gate is no longer needed: `graphFindings`, run by the
  workflow that stores the trace graph, and TST-1321002 on CI find a repeat.
