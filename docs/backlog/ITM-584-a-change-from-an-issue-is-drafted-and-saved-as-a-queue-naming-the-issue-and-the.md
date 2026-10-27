---
id: ITM-584
title: A change from an issue is drafted and saved as a queue naming the issue
level: module
realises:
  - UC-012
modules:
  - MOD-maintenance-pages
  - MOD-issue-handling
  - MOD-job-catalogue
builds_on:
  - ITM-582
  - ITM-1247
tests:
  - unit
  - component
origin:
  - the coverage of UC-001 to UC-020 (docs/measurements/2026-10-16_coverage-uc-001-020.md), at akmaier's request of 2026-10-16
---
# ITM-584 A change from an issue is drafted and saved as a queue naming the issue

**REGISTER**

## Outcome

UC-012 step 6 and its second postcondition; UC-033 steps 1 to 4. As accepted (the architecture a2fe0994, accepted in 6c0aa1ab):
on MOD-maintenance-pages' issue route, *Save* runs `change-requirements` with the parameter `issue` (the issue's number) and
the parameter `source` (the person's own source, which `personSource` finds for the account `personAccount` gives); without a
source the page shows the steps the precondition `person-source` names. The kind `change-requirements` names the recipe
`issue-context?` (MOD-job-catalogue), and `issue-context` gives no part to a job without the parameter `issue`
(MOD-issue-handling). *Move to backlog* is ITM-1250, since `moveToBacklog` writes through `saveItems`, which ITM-617 builds.

Not built: *Save* on the issue route; `issue-context` throws without `issue` (`src/issue-handling/strategies.mjs:59`);
`change-requirements`' `kind.md` names no `issue-context?`.

## Acceptance

- Unit tests naming MOD-issue-handling, MOD-maintenance-pages and MOD-job-catalogue: *Save* starts `change-requirements` with
  `issue` and the person's `source`, and without a source shows the precondition's steps; `issue-context` gives no part
  without `issue`. Counter-proof: before the change none of these exists.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/maintenance-pages/`, `src/issue-handling/`, `src/job-catalogue/kinds/change-requirements/` and the tests that name
  these modules change.
