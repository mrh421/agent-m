---
id: ITM-1319
title: Accepting a use case puts the modules it changes into the backlog
level: module
realises:
  - UC-008
  - ACCEPTING A USE CASE PUTS THE MODULES IT CHANGES INTO THE BACKLOG
  - ONE CLICK PER DECISION
  - THE PAGE NAMES WHERE IT SENDS
modules:
  - MOD-review-pages
  - MOD-job-catalogue
  - MOD-work-plans
builds_on:
  - ITM-739
tests:
  - unit
origin:
  - po-opus-c's gate of ITM-739 (PR #1510), finding UC023-S4; akmaier's ruling ("When I accept the use case, I want the affected modules to be checked and entered into the backlog as tasks automatically."), accepted as the SPEC requirement in cc22de1e7
---
# ITM-1319 Accepting a use case puts the modules it changes into the backlog

**REGISTER**

## Outcome

The SPEC, §13: "In a model that pulls its work from a backlog, accepting a use case adds one backlog item for each module
whose implementation its accepted text changes, unless an item not yet done names that module." Its check is
`tests/test_backlog_from_acceptance.py`, which does not exist yet.

UC-008 step 6 says the same: "the same click has Agent M check which modules the accepted text changes — by the
participant that the page named, with its processing place, beside **Accept** — and add one backlog item for each of
them that no item not yet done names, realising the use case (UC-032), under the reviewer's account."

The accepted architecture states it in three modules. The code builds none of it yet.
- **MOD-job-catalogue** has the kind `check-affected-modules` (MOD-job-catalogue.md:96).
  - It serves UC-008, needs *draft text*, and has the precondition `rests-on-accepted`.
  - Its recipes are `use-case-with-neighbours` and `whole-architecture`, and its check is `backlog-checks`.
  - Its step is `leave-out-named-modules`, its review `none`, and its writer `backlog-items`.
  - Its result is one item for each module whose implementation the accepted text changes.
- **MOD-work-plans** gives the step `leave-out-named-modules`. It leaves out of the drafted items each item for a module
  that an item not yet done names — one whose state `itemStates` gives is not `done` —, with a finding naming that item
  and the module.
- **MOD-review-pages:**
  - In a product whose workflow's model is `pulled`, every *Accept* of a use case names beside it the participant that
    will check which modules each use case changes, with its place, as `prepareJob` of `check-affected-modules` gives
    it. This holds for the *Accept* of one file, of the ticked ones, and *Accept all N shown*.
  - Once the acceptance's commit is written, the same click runs one job of that kind in this tab for each use case it
    recorded. Its writer commits the items under the person's account.
  - In a `planned` model, none is named and nothing runs. The model's kind comes from
    `MOD-product-process.productWorkflow`, which its Uses now name.
  - MOD-approvals does not change: the acceptance stays its one commit, and the items follow as a second commit of the
    same click.

## Readiness

It is ready. akmaier accepted both texts it waited for:
- UC-008, at the blob `310103869e` its text has on `main` (`a52aff870`);
- the architecture above: MOD-job-catalogue, MOD-review-pages and MOD-work-plans, each at the blob its file has on `main`
  (`1b539d0fe`).

NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED holds for every text the item names. Its planning stand-in and run are
below.

## Acceptance

- `tests/test_backlog_from_acceptance.py`, the check the SPEC names, with its case and both counter-proofs:
  - accepting a fixture use case in a Scrum fixture, whose checking fixture participant names two modules its text
    changes, commits two items, each naming the use case and one of the modules, under the accepting person's account;
  - a module that an item not yet done names gets no item;
  - accepting the same use case in a V-model fixture adds none.
- Unit cases of the page `uc/<id>`:
  - the checking participant is named with its place beside *Accept* before the click;
  - nothing is sent before the click.
- UC-023's TST-739013 (UC023-S4) stays as it is, `todo`.
  - It asks for UC-023 step 6, a list of the affected modules after a decision's *Accept*.
  - The accepted texts state UC-008 step 6, a use case's *Accept*. UC-023 step 6 keeps its text, and no module states
    it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- **The tests of other modules the change moves,** from the planning run below. Each keeps what it asserts beside the
  new value:
  - MOD-job-catalogue's own: `tests/job-catalogue.test.mjs`, the stated table and its count of 26 kinds, which gain the
    row of `check-affected-modules` (MOD-job-catalogue.md:96); `tests/job-catalogue-tools.test.mjs`, the count of the
    kinds that name no tools, 15 on the base.
  - MOD-site-frame: `tests/load-per-view.test.mjs`, the folders `#use-case` and the start page read, once the pages of
    use cases read `docs/process.md`, which they must to know the model.
  - MOD-site-frame: TST-1290001 (`tests/site-frame-preloads.test.mjs`), if the change adds a file to
    `src/review-pages/`: the entry page's preloads are computed again (`docs/index.html`).
  - `tests/test_single_definition.py` refuses an answer schema that copies another kind's whole. The kind's own schema is
    written for its draft, not copied from `propose-items`.

## The planning run (sprint team1/128)

A stand-in, in three modules:
- MOD-job-catalogue: `kinds/check-affected-modules/` with `kind.md` as the table's row states it, a prompt with a place
  for each recipe, and a copy of `propose-items`' answer schema; its row in `kinds.md`.
- MOD-work-plans: the step `leave-out-named-modules` in `workStrategies`. It reads the product's items and pull requests,
  takes `itemStates`, and leaves out each drafted item for a module that an item not yet done names, with a warning.
- MOD-review-pages: a new part beside `flow.mjs`. For use cases, with a token, in a product whose `productWorkflow` model
  is `pulled`, the list's *Accept ticked*, a file's *Accept* and *Accept all N shown* name beside them the first eligible
  participant with a route to this tab and its place. The stand-in took them from `loadStage`, not from a `prepareJob`
  at the draw, as the accepted text asks. After the acceptance's commit, one job per use case recorded runs
  in this tab with `queueJob` and `runOnTab`, its parameter `useCase`. The pages of use cases read `docs/process.md`
  among their folders.

On `main` at `2af740feb`, in an export, every test file of the repository but the six that hang on the planning machine:
1,008 files, 6,316 Node cases. The same files were run without the change.
- Five Node cases and two Python cases fail only with it, as listed above: the two of MOD-job-catalogue, the two of
  `load-per-view`, TST-1290001, and the two cases of `test_single_definition`, which the copied schema moves.
- A first run without `docs/process.md` among the folders moved `tests/release-itm-1266-review-folders.test.mjs`
  instead: the page read outside its folders. With it among them, that file passes.
- No fixture of the run declares a pulled model on a use case's page. So no case shows the participant named, and the
  reads the stand-in adds were not counted in such a fixture. By its code, a page of use cases in a pulled product reads
  `docs/process.md`, the instance at the declaration's `model_version`, the instance's `SPEC.md`, the participant list
  and `repositoryInfo` once more; after the click, for each use case, the default branch, the job's record and the
  item's commit. They are counted at the Development gate against a pulled fixture.
- Of the six files that hang there, `release-uc-003-dashboard-https-bridge` and `system-uc-003-dashboard-bridge` open
  `#uc`. They are read on CI.
