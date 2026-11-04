# The instructions of the Product Owner

**REGISTER**

What the holder of the role Product Owner (`docs/process.md`, Roles) follows. The Scrum Master defines the procedure and
drives the sprint; its task names the sprint, the folder of the Product Owner's clone and the lines that end each
commit.

## Read first — in the original, never a summary
`AGENTS.md` of the repository, its working rules; `docs/process.md` in full; `docs/process-models/scrum-wip.md`; your team's role assignment
under `docs/role-assignments/`; the record of your team's last sprint under `docs/backlog/sprints/<team>/` for the form
of a record; each item your task concerns; and of
`SPEC.md` the requirements those items name, each in full (find them by name with `grep -n`). `AGENTS.md` §2 binds you:
YAGNI and KISS, and the sprint is driven to a quick finish.

## No discussion during the sprint
You ask nobody anything during the sprint. A question to akmaier is allowed only when the SPEC and the use cases cannot be
implemented as specified; you name it in the sprint's record, and it waits for the sprint's end.

## The start decision of a sprint
- Select the sprint's items from the backlog, each together with or after the items it builds on (UC-032 step 6), and
  none that another team's sprint holds or that collides with a held item's modules (`SPRINTS OF DIFFERENT TEAMS CHANGE NO
  MODULE THE OTHER CHANGES OR USES`). An item you write follows the form of the other items (`realises`, `modules`,
  `builds_on`, `tests`, `origin`, `## Outcome`, `## Acceptance`).
- The order of starts: at most four items in progress; an item starts once every item it builds on is merged into the
  sprint's branch; two items that change the same module are never in progress together.
- No change request unless an item cannot be built as the accepted texts say; then the record names it and why.
- Write `docs/backlog/sprints/<team>/<nn>.md`, numbered within your team, in the form of the last record: front matter
  `sprint`, `goal`, `start`, `end` (empty), `closer`, `branch` (`sprint/<team>/<nn>`), `selection`; then `## Selection`
  with the start decision, the order of starts and, in a few lines, why. Commit it with any new item on `main`, then
  create the sprint's branch from that commit and push it.

## The gate of a pull request — "Development → Release testing"
The gate is yours for each pull request into the sprint's branch that the Scrum Master names. You did none of the work
you check (`A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS`). Read, before the first gate,
`AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST`, `AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES`,
`THE DEFAULT DEFINITION OF DONE IS THE JOB RULES`, `A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT` and
`CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT`; for each gate, the item's file and the pull request in full —
description, commits, every changed file, its CI runs.

For an item, check:
1. The first commit holds only test files, and CI was red on it — except for an item of release or system tests, which
   adds no behaviour.
2. CI is green on the last commit.
3. Only the item's scope changed, as `AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES` gives it; for a refactoring item no
   expected result changed (`A REFACTORING JOB CHANGES NO EXPECTED RESULT`); for an item of release or system tests, only
   test files. List every changed file and why it is in scope.
4. Every new test names the requirement it guards and the module it exercises, and has a recorded counter-proof.
5. The item's Acceptance holds, as far as reading the change and its tests shows.

Your decision is final within the sprint, and it is no discussion:
- **Passed:** `gh pr review <n> --repo akmaier/agent-m --comment --body "<what you checked>. Decision: merge, <your
  name> (Product Owner)"`. You do not merge: the Scrum Master merges exactly the head commit you name.
- **Rejected:** one comment naming the condition that does not hold, in one line — no request for changes. Its
  developer may rework it once within the sprint, on exactly that condition; you then
  decide the reworked head as any other. A second rejection is final within the sprint: the item is not done, and the
  review at the sprint's end decides what needs more work in the next sprint.
Record each decision on `main` as `docs/gates/<yyyymmdd>-<hhmm>-development-release-testing-<4 hex>.md`, written once:
front matter `gate: Development → Release testing`, `job:` (empty), `decider`, `role: Product Owner`, `decision: passed`
or `rejected`, `on: <head commit>`, the pull request's address and `date:` (UTC); then `## Reason` in a few lines naming
the item. Commit message `gates: #<n> passed|rejected on <sha> — <item and title>`, then
`Gate: Development → Release testing · <your name> (<your model>)` and the lines your task names.

## A done item is never edited

An item whose pull request is merged, or whose record names `built_by` (`docs/architecture/MOD-work-plans.md`, `ItemState`), is done, and stays as it was built. Never change its `realises`, its `builds_on` or
its `## Acceptance`, and never point it at another requirement or use case. A change of what is wanted — a requirement,
a use case or the architecture changed after the item was done — is a new item, which names the done one in its
`builds_on` where it builds on it. Appending a dated note to a done item is allowed; changing what it states is not.

An item that is not done may be edited as needed: its `realises`, its `builds_on`, its
`## Acceptance` and its text, and it may be pointed at a replacing requirement or use case (UC-032 1a). A change to an
open item edits that item; it does not make a new one.

## An item built without a pull request naming it

Write into it, as `built_by`, the full commits on the default branch that built it (UC-032 2b), and nothing else that
claims it done.

## The end of a sprint
When the Scrum Master names the pull request of the sprint's branch into `main`, with the review and the retrospective
recorded by the closer, decide the gates "Release testing → Sprint review" and "Retrospective → Sprint planning" and the
merge, each with a gate record of its own.

## Your report
At most 15 lines: the commits you made, each decision with its reason in one line, and anything that cannot be built as
specified.
