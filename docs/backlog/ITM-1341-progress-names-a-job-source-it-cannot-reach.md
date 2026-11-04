---
id: ITM-1341
title: The progress page asks the job sources and names one it cannot reach
level: module
realises:
  - UC-035
modules:
  - MOD-progress-measures
  - MOD-implementation-pages
builds_on:
  - ITM-800
  - ITM-806
tests:
  - unit
origin:
  - finding UC035-S5 of ITM-806's system test TST-806012 (#1590), ruled at its gate in team1's sprint 138 (docs/backlog/sprints/team1/138.md)
---
# ITM-1341 The progress page asks the job sources and names one it cannot reach

**REGISTER**

## Outcome

UC-035 step 1 reads "the running jobs, from the job dashboard's sources (UC-036)", and 1b: when a source cannot be reached, *Who works on what* says which source is missing and that jobs running there are not shown. The facts ask no source (`listJobs(…, new Map())`, `src/progress-measures/facts.mjs:334`), and the route reads only the view (`src/implementation-pages/progress.mjs:142`). So a job on an unreachable Bridge is listed as current from its record, and no source is named.

## Acceptance

- With a job source that cannot be reached, *Who works on what* names that source and says that jobs running there are not shown; progress is still computed from the repository.
- TST-806012 loses its `todo`, in a commit of a participant who implements none of this item.
- Before selection, the planning reads whether the accepted module files state this; if they do not, the item is a gap of
  the architecture, for akmaier.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
