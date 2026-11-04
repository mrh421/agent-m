---
id: ITM-1058
title: The plan is drafted, reviewed and saved on the plan page
level: module
realises:
  - UC-045
  - A GENERATED ARTIFACT IS A PROPOSAL
  - THE PAGE NAMES WHERE IT SENDS
  - ONE CLICK PER DECISION
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-1057
  - ITM-613
  - ITM-614
tests:
  - unit
origin:
  - the gap analysis of UC-036 to UC-049 on main, proposal NEW-045-2, read against the accepted texts on main at 40e04d8d
  - akmaier's direction of 2026-10-18 ("fill the backlog to implement the remaining missing UC 36 to the end")
---
# ITM-1058 The plan is drafted, reviewed and saved on the plan page

**REGISTER**

## Outcome

MOD-implementation-pages.md:169-171: "*Draft the plan* with its run panel, run in this tab and attended, whose result waits
for the planner; the draft reviewed in order, reordered, split, merged or edited where its dependencies allow; *Save plan*,
which lets the drafted plan go on as the planner left it". MOD-job-catalogue.md:135: for a kind of `review: person` the
click is "*Save plan* (UC-045) — ... through MOD-job-runner's `writeResult`". UC-045 steps 2, 4 and 5 (UC-045.md:67-69,
:80-84).

## Acceptance

- Unit tests that name MOD-implementation-pages, with a fixture drafting participant:
  - the run panel names the participant, its processing place and the parts `architecture-and-model` sends;
  - the returned draft is shown in its order with a diagram; a reorder that puts a module before one whose interface it
    uses is refused with that finding;
  - *Save plan* calls `writeResult` with the draft as the planner left it, which writes one commit through `plan-steps`.
- Counter-proof: a save that writes the draft as returned, ignoring the planner's edit, fails.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/implementation-pages/` and the tests that name MOD-implementation-pages change.
