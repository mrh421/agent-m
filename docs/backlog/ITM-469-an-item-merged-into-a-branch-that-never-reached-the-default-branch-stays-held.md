---
id: ITM-469
title: An item merged into a branch that never reached the default branch stays held
level: module
realises:
  - UC-032
  - A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT BRANCH
  - SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES
modules:
  - MOD-work-plans
builds_on: []
tests:
  - unit
origin:
  - Sprint team1/26's start decision: ITM-292 read as not held, through #280
  - MOD-work-plans, Interfaces: heldItems
built_by:
  - 9ab15a195f36ef612b25632f20540384ef1d5a5c
  - 876eb45acc6bd0408f053ca23934c94a7a2ba6eb
---
# ITM-469 An item merged into a branch that never reached the default branch stays held

**REGISTER**

## Outcome

MOD-work-plans' `heldItems`, as its file states it: an item a team's sprint selects is held until its change is merged
into the default branch or its sprint's close sends it on (`A SPRINT HOLDS ITS ITEMS UNTIL THEY REACH THE DEFAULT
BRANCH`). A merge of the item into a branch that never reached the default branch does not end the hold.

Today `inDefaultBranch` in `src/work-plans/sprints.mjs` reads a merged pull request of the item into any branch other
than its sprint's own branch as a merge into the default branch. The known positive is this repository's: ITM-292,
selected by sprint team1/26 on `main` at `6c82de1`, is not among `heldItems` on `main`, because #280 (title `ITM-292
Read process roles and current gate decisions`) is merged into `sprint/19`, a branch no pull request ever merged on,
whose change never reached `main`. ITM-292 is held by team1/26.

`heldItems` receives the sprint records, the items, the module files and the pull requests, and no default branch. A
`PullRequest` (MOD-repository-hosts) names its `base` and `branch`, so the pull requests show that `sprint/19` was never
merged on, but not that it is not the default branch: `main` is never merged on either. The default branch is given by
MOD-repository-hosts' `repositoryInfo().defaultBranch`, which `heldItems`' signature does not take. The item waits for
akmaier's acceptance of a change of MOD-work-plans' file that hands `heldItems` the default branch, or names how it
tells it from the pull requests; until then it does not start.

## Acceptance

- Unit tests that name MOD-work-plans state, before the code exists, with the known positive's data: a sprint selecting
  ITM-292 and a merged pull request of ITM-292 into `sprint/19`, which no pull request merges on — ITM-292 is held by
  that sprint; the same pull request with `sprint/19` merged into the default branch after it — ITM-292 is not held;
  a merged pull request of the item straight into the default branch — not held, as today.
- The first commit holds only these tests, and CI is red on it; every new test's counter-proof is recorded in the pull
  request.
- The existing tests stay green, with no expected result changed.
- Only `src/work-plans/` and the tests that name MOD-work-plans change.

**Read at sprint team1/93 (developer-sonnet-e): built.** `heldItems` in `src/work-plans/sprints.mjs:67-95` (`reaches`,
`reachesDefaultBranch`, `inDefaultBranch`, `onDefault`), from the work of ITM-516 and ITM-1010 (`72287ffb`, `ad16310b`), meets
MOD-work-plans.md:156-157. `tests/work-plans-sprints.test.mjs:165` runs this item's own case: ITM-292 merged by #280 into
`sprint/19` stays held, is released once `sprint/19` reaches `main`, and is not held when merged straight into `main`. It
passes unchanged. A default branch of another name is handled through `onDefault`, as the text says. It is done.

