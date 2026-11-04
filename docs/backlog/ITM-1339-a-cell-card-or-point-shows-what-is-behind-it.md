---
id: ITM-1339
title: A cell, a card or a point on the progress page shows the items behind it and their trace
level: module
realises:
  - UC-035
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-800
  - ITM-806
tests:
  - unit
origin:
  - finding UC035-S3 of ITM-806's system test TST-806009 (#1590), ruled at its gate in team1's sprint 138 (docs/backlog/sprints/team1/138.md)
---
# ITM-1339 A cell, a card or a point on the progress page shows the items behind it and their trace

**REGISTER**

## Outcome

UC-035 step 6: a click on a cell, a card or a point shows "the items or requirements behind it and their traceability". Every cell, card and chart links the same address, `#trace/key=specification/ref=<ref>` (`traceHref`, `src/implementation-pages/progress.mjs:244`), which names none of them.

## The reading taken

MOD-implementation-pages.md:204-206: "a cell, card or point leads to the trace page of what is behind it". What is behind a
cell of the grid is its requirement; behind a card, the requirements and use cases its item realises; behind a point, those
of the items merged that day. MOD-trace-pages opens a requirement with the use cases, decisions, modules and tests that
name it (MOD-trace-pages.md:113-134). So each cell, card and point leads to the trace page of the requirement or use case
behind it; a card or point with several leads to the first of them. The item and the pull request in
UC-035 step 6's chain are not shown on a trace page; the pull request names that as a finding, for akmaier, and
TST-806009 keeps a `todo` for that part only.

## Acceptance

- Each cell, card and point leads to the trace page of the requirement or use case behind it, as read above; two cells
  with different requirements lead to different places.
- TST-806009's `todo` is narrowed to the item and the pull request in the chain, in a commit of a participant who
  implements none of this item.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
