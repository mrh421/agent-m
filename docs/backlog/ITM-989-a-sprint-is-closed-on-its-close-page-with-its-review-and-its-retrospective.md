---
id: ITM-989
title: A sprint is closed on its close page, with its review and its retrospective
level: module
realises:
  - UC-041
  - A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT
  - A SPRINT ENDS WITH A RETROSPECTIVE
  - ONE CLICK PER DECISION
  - A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-681
  - ITM-986
  - ITM-987
  - ITM-988
tests:
  - unit
origin:
  - the gap analysis of UC-036 to UC-049 on main, proposal NEW-041-3, verified against the accepted texts on main at ee5d1364
  - akmaier's direction of 2026-10-18 ("fill the backlog to implement the remaining missing UC 36 to the end")
---
# ITM-989 A sprint is closed on its close page, with its review and its retrospective

**REGISTER**

## Outcome

MOD-implementation-pages.md:167-169: "`sprint/<team>/<n>/close` — the increment and the items not done, the feedback lines,
the unfinished items' decisions, the retrospective with the sprint's numbers as material; *Close sprint* with
`closeSprint`, offered only with a retrospective entry and a decision for every unfinished item". UC-041 steps 1 to 6 and
6a (UC-041.md:64-87, :142-143).

The route is not built: `src/implementation-pages/index.mjs:3`. The backlog route (ITM-681) leads to it for the person's
team's running sprint. The page shows `sprintFacts` (ITM-986) and calls `closeSprint`, which already refuses a close
without a retrospective or with an undecided item (`src/work-plans/saves.mjs:214-223`). The increment carries the folded
*What is this?* of ITM-988. After the close, for an increment not merged, the page offers *Give up increment* with a
reason, through MOD-work-plans' `giveUpIncrement` (ITM-1232) (MOD-implementation-pages, the same route; UC-041 7b).

## Acceptance

- Unit tests that name MOD-implementation-pages, over a fake host with a running sprint:
  - the page lists the increment with each item's pull request, requirements and tests, and the items not done with their
    reasons;
  - *Close sprint* is disabled, saying why, until the retrospective has an entry and every unfinished item a decision;
  - one click commits through `closeSprint` with the feedback lines, the decisions and the retrospective as entered;
  - for a closed sprint whose increment is not merged, *Give up increment* is offered, refused without a reason, and one
    click commits through `giveUpIncrement`.
- Counter-proof: a page that offers *Close sprint* without a retrospective entry fails.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/implementation-pages/` and the tests that name MOD-implementation-pages change.
