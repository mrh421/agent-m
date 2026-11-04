---
id: ITM-1321
title: One test identifier names one test case
level: module
realises:
  - THE NAME IS THE ID AND IT SURVIVES
  - A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
modules:
  - MOD-trace-graph
builds_on:
tests:
  - unit
origin:
  - po-opus-c's release gate of team1's sprint 127 (docs/gates/20261030-1051-release-testing-sprint-review-e127r.md), and the sprint's Review (docs/backlog/sprints/team1/127.md)
---
# ITM-1321 One test identifier names one test case

**REGISTER**

## Outcome

In sprint 127, `tests/release-itm-1187-bar-offers-sessions.test.mjs` declared TST-1187101 to 1187104. Four other cases of
`tests/prompt-bar-endpoints.test.mjs` held those identifiers already. Nothing reported it:
- MOD-test-document's `testDeclarations` and `testFindings` read one file and one declaration at a time;
- no check of the repository compares the declarations of several files;
- CI was green.

The release gate found it by reading the declarations for repeats, and #1526 gave the release cases TST-1187201 to
1187204.

With this item, a test identifier that two declarations hold, in one file or in two, is reported as an error.
- The report names each declaration by its path and line.
- A reference to such an identifier names two cases, so neither is named (A REFERENCE NAMES THE IDENTIFIER, NOT THE
  POSITION).
- The name is the artifact's (THE NAME IS THE ID AND IT SURVIVES). MOD-identifiers decides a requirement's name given
  twice under the same rule (`tests/test_identifiers.py`, its reading).

## Readiness

It is ready. Its module is MOD-trace-graph, the owner of "the checks across artifacts, each decided from the graph alone"
(`graphFindings`). It reads every test file through MOD-test-document's `testDeclarations`. Neither MOD-test-document, which
reads one file, nor MOD-identifiers, which sees no declaration, can see a repeat.

MOD-trace-graph's accepted text holds the check in `graphFindings`: "a test identifier declared at more than one place —
the path and line of its node and of its `guards` and `exercises` edges, each the place of the declaration it was read
from —, as an error at each place that names the other places by path and line (`THE NAME IS THE ID AND IT SURVIVES`)".
The approval record `docs/approvals/MOD-trace-graph-034c5a34a59b.md` names that text.

The repository's own test files declare no identifier twice: ITM-1324 is done, and the repeat reading over every test file
finds none.

**The planning stand-in** (sprint 130's planning, on `main` at `13e66ee14`): `graphFindings` gains a check of its own in
`checks.mjs`. It collects, for each `TST` node, the places of its node and of its `guards` and `exercises` edges, and gives
an error at each place that names the others, under THE NAME IS THE ID AND IT SURVIVES. It imports nothing new and changes
no type.
- Over every file of `13e66ee14` (7,264 paths, 5,848 test nodes) it gives 0 repeats.
- Known positive: over `4c27ee9e2`, before ITM-1324, it gives 4 errors, two for each of TST-1290001 and 1290002, each
  naming the other place.
- **Callers:** MOD-job-runner's `graph-checks` leaves out what the repository holds already (`notHeld`); `planFindings`
  keeps only the steps' level and a cycle; the editor of MOD-review-pages keeps the findings of the file it edits. So no
  caller shows a finding of the repository's own, and none exists.
- Its planning run is in `team1/130.md`.

## Acceptance

- A unit case of `graphFindings` over a fixture graph whose two test files declare the same identifier gives one error at
  each declaration, naming the other.
  - Known positive: the same fixture with distinct identifiers gives none.
  - Counter-proof: with the check left out, the case fails.
- The repository's own tests at the item's head declare no identifier twice. The case reads them as TST-292101 reads the
  gate records, with sprint 127's TST-1187101 to 1187104 as its history's known positive.
- Each test of other modules the change moves is named by the item's planning run before selection.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
