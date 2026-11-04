---
id: ITM-1304
title: A declaration's value stands on its one line
level: module
realises:
  - A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
modules:
  - MOD-test-document
  - MOD-agent-processes
  - MOD-bridge-build
  - MOD-bridge-http
  - MOD-bridge-jobs
  - MOD-browser-store
  - MOD-checkout-tools
  - MOD-desktop-shell
  - MOD-documents
  - MOD-endpoint-calls
  - MOD-implementation-pages
  - MOD-issue-handling
  - MOD-job-catalogue
  - MOD-job-runner
  - MOD-main-page
  - MOD-maintenance-pages
  - MOD-markdown-render
  - MOD-participant-list
  - MOD-personal-data
  - MOD-product-process
  - MOD-progress-measures
  - MOD-prompt-bar
  - MOD-release-evidence
  - MOD-repository-hosts
  - MOD-resource-list
  - MOD-reuse-facts
  - MOD-review-pages
  - MOD-run-planner
  - MOD-runtimes
  - MOD-settings-pages
  - MOD-site-frame
  - MOD-source-register
  - MOD-spec-changes
  - MOD-test-pages
  - MOD-trace-graph
  - MOD-trace-pages
  - MOD-work-plans
  - MOD-workflow-entries
builds_on: []
tests:
  - unit
origin:
  - developer-opus-f's report on ITM-654 (PR #1414), and po-opus-c's gate, docs/gates/20261029-0727-development-release-testing-77cd.md
---
# ITM-1304 A declaration's value stands on its one line

**REGISTER**

## Outcome

MOD-test-document states a declaration as lines of `key: value`: "each following line is `key: value`"
(MOD-test-document.md:45), and a declaration "ends at the first line that is not a comment line of this form" (:68).
The reader follows that.

Many declarations under `tests/` continue a value onto the next comment line, almost all of them `expect:`. The reader
cuts each such value at its first line, with no finding, so what a test states as its expected result is partly unread.
ITM-654's comparison of old and new expectations sees only the first line of such a value.

**The count, read to its end at sprint team1/123's planning** (`main` at `b65cefcc9`). For each declaration the reader
finds under `tests/`, the comment lines of its block after its last key line were listed and read, line by line:
- 5,615 declarations; 870 have such lines.
- 408 of them hold only notes that begin with a label, almost all `Planted fault:`. They are no value, and stay.
- 462 declarations in 173 files have lines after them that are not such notes, 637 lines in all; after 458 of them the
  reader's last key line is `expect:`. Of these:
  - 437 declarations in 168 files continue a value, some of them before a note.
  - In three, a continuation line begins with a lowercase word and a colon, which the reader takes for a key it passes
    over (`truncated:` in TST-1240042, `https:` in TST-587020, `http:` in TST-1041010). Their `expect:` is cut at its
    first line too; the value is joined from the `expect:` line.
  - 23 declarations are followed by a lowercase `counter-proof:` note after a value that has ended (TST-934001 and
    TST-1301001 after a continued one), in
    `tests/release-evidence.test.mjs`, `tests/release-evidence-audit.test.mjs`, `tests/job-ledger.test.mjs` and
    `tests/trace-pages-newest-queue-marks.test.mjs`, and three by another note: `fault:` and `counter-proof:` in
    TST-342008, `covered cases:` in TST-290122, and the sentence "GitHub Ubuntu additionally …" in TST-294001. These
    notes are no value, and stay.
  - TST-354001 (`tests/settings-pages-participants.test.mjs`) is followed by five lines that repeat the end of its
    `given`, its `input` and its `expect` as they stood before they were put on one line each. Those five lines go.

## Acceptance

- Every declaration under `tests/` holds each value on its one line. The reader, run over `tests/`, reads every value
  whole: no key line is followed by a continuation of its value. What stays after a declaration is a note, and the pull
  request names each note it leaves and the reading by which it is one.
- No expected result of a test changes, and CI is green on every commit (refactoring).
- Only the test files whose declarations are continued change. The pull request names each file and its module, since
  they lie in many modules.
- The six release test files among them (`tests/release-uc-006-batched-reads.test.mjs`,
  `tests/release-uc-014-get-your-own.test.mjs`, `tests/release-uc-014-setup-route.test.mjs`,
  `tests/release-sprint-14-bridge-http.test.mjs`, `tests/release-uc-040-declare-the-products-resources.test.mjs`,
  `tests/test_bridge_release.py`) are changed by developer-sonnet-l, on the item's branch, in a commit of its own.
- A continued value that cannot stand on one line, for its length, is named in the pull request. Letting a value continue
  would be a change of MOD-test-document's text, for akmaier.
- **The planning run** (sprint team1/123), with a stand-in that joins the 437 values and removes TST-354001's five lines:
  - MOD-test-document's reader over `tests/` finds the same 5,615 declarations, each with the same identifier, level,
    module, guards, given, input and title; 437 `expect:` values are longer and begin with the old value; 22 findings
    before and after.
  - Every test file under `tests/` but the six that hang on the planning machine, 993 files, with and without the
    stand-in: no case fails only with it. The cases that failed only without it, TST-1159301 to 305, are the parallel
    run's load.
