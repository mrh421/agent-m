---
id: ITM-1393
title: The reuse candidate chosen is written, and one not found is not offered
level: module
realises:
  - UC-022
  - A REUSE DECISION RECORDS ITS DUE DILIGENCE
modules:
  - MOD-review-pages
builds_on:
  - ITM-448
tests:
  - unit
origin:
  - F2 and F3, TST-448230 and TST-448231 of ITM-448's system tests of UC-022 (#1683), ruled at its gate in team1's sprint 142 (docs/gates/20261101-1633-development-release-testing-0448.md)
---
# ITM-1393 The reuse candidate chosen is written, and one not found is not offered

**REGISTER**

## Outcome

UC-022 step 8 lets the author "pick a different alternative for a reuse decision", and 7a says a candidate not found in
its registry "is not proposed". On the shown architecture draft, the reuse candidates' radio buttons have no listener
(`src/review-pages/jobs.mjs:703-725`), and `draftFromEditors` reads only the text areas (:612-615). So picking another
library still writes the drafted one. `candidateChoices` (:687-701) also offers a library that was not found, which
MOD-reuse-facts and 7a leave out.

## Acceptance

- Choosing another candidate and pressing *Write proposals* writes the decision with the chosen candidate.
- A candidate whose package was not found is not offered as a choice. It is listed as "not found — the name may be
  invented", with the address that was queried.
- TST-448230 and TST-448231 lose their `todo` in a commit by a participant other than the implementer, written after the
  code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
