---
id: ITM-1262
title: No code, explanation or comment names the withdrawn run page, close page or gate hand-over
level: module
realises:
  - UC-041
  - UC-043
  - UC-034
modules:
  - MOD-implementation-pages
  - MOD-site-frame
  - MOD-run-planner
  - MOD-product-process
  - MOD-workflow-entries
  - MOD-bridge-jobs
builds_on: []
tests:
  - unit
  - component
origin:
  - akmaier's request of 2026-10-28, "I want the leftovers gone too", after UC-032, UC-034, UC-041 and UC-043 withdrew the run page, the sprint close page and Agent M handing a gate to an agent
built_by:
  - b0e46153c64e7f1f6e9ddf91029894ac17523f2b
  - e91f4726f1cca1d0259671ebeb5822e226677a7e
  - b98331cdb26b32d03522ce665e9be3a2082fc1b9
---
# ITM-1262 No code, explanation or comment names the withdrawn run page, close page or gate hand-over

**REGISTER**

## Outcome

The route `progress` shows, for a team's ended sprint, that its review and retrospective are not recorded yet, without a
link to a close page. The explanations, the dashboard's table of views and the comments of code and tests name no run
page, no close page, no run limits raised on a page and no strategies for a gate handed to an agent.

## Acceptance

- A component test shows an ended sprint's panel without a link to `sprint/<team>/<n>/close`, red before the change.
- `src/site-frame/explanations.md` holds no topic of the withdrawn pages, and every topic a view names is still held.
- What MOD-run-planner, MOD-work-plans and MOD-job-catalogue still name stays.
