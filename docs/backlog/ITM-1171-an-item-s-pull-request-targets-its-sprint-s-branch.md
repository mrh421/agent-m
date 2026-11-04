---
id: ITM-1171
title: An item's pull request targets its sprint's branch where the sprint has one
level: module
realises:
  - UC-034
  - A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN
  - WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET
modules:
  - MOD-work-plans
  - MOD-product-process
  - MOD-implementation-pages
  - MOD-runtimes
builds_on:
tests:
  - unit
origin:
  - the gate of #1267 (ITM-734, team 2's sprint 102), developer-sonnet-f's finding
---
# ITM-1171 An item's pull request targets its sprint's branch where the sprint has one

**REGISTER**

## Outcome

UC-034 8a reads: "The sprint has a branch of its own. The item's pull request targets that branch"
(`docs/use-cases/UC-034-*.md:201-203`).
- The process model's gate reads "the item's pull request into the sprint branch" (`docs/process-models/scrum-wip.md:53`).
- MOD-runtimes' writer of a job's pull request opens every pull request into the default branch that `repositoryInfo`
  names (`src/runtimes/pull-request.mjs:56`, `:86-87`).

So this item began with a draft of MOD-runtimes for akmaier; it is accepted (below). It gives the writer the base: the branch of the sprint that
holds the item (MOD-work-plans' sprint record, `branch`), and the default branch where there is none. That has to be
stated with the interface it reads, so that the module does not read sprint records by hand.

## Acceptance

- An implementation job for an item of a sprint with a branch opens its pull request into that branch. Without one, it
  opens into the default branch. A test checks both, with a counter-proof.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- **The one existing expected result it changes, named at sprint team1/133's planning:** TST-733002
  (`tests/implementation-pages-implement-plan-start.test.mjs:162-170`). With the declaration's `test/<item>` for the phase
  Testing, ITM-012's target branch is `test/<item>` as declared, no longer `test/ITM-012`, since the placeholder goes. The
  change stands in the tests-only commit.
- Searched and staying: `Target branch: main` (`tests/implementation-pages-implement.test.mjs:191`, a sprint without a
  branch) and the base `develop` of `tests/runtimes-pull-request.test.mjs:130` (no sprint record in its snapshot). Where the
  writer's new reads of the snapshot need it, only how such a test prepares its fixture changes.

**The draft (team 2's sprint 102's close, po-opus-b, reviewed twice by a2fd6f0bd4f5027fd), accepted:** MOD-work-plans.md:203
(`targetBranch`), MOD-runtimes.md:345 and MOD-implementation-pages.md:254 use it.
- MOD-work-plans gains `targetBranch`. It gives the open sprint's branch, else the phase's declared branch, else the
  default branch.
- The implement page's two derivations and the writer use it.
- MOD-product-process provides `branchesOf`, the one reader of the declaration's `## Branches`.
- The item's modules are now the four.
- **The code that follows:**
  - the page's `<item>` placeholder (`implement.mjs:181`) goes, since no accepted text defines per-item branch names;
  - `branchesOf` is exported (`src/product-process/declaration.mjs:88`), and `workflowOf` keeps using it — this stands on
    `main` already.
  - Not on `main` yet: `targetBranch` (no code of `src/work-plans/` defines it), and the writer and the page using it.

