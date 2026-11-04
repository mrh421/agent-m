---
id: ITM-782
title: Items are proposed, written by hand and added on the backlog page
level: module
realises:
  - UC-032
  - A BACKLOG ITEM NAMES WHAT IT REALISES
  - A BACKLOG ITEM NAMES THE MODULES IT CHANGES
  - A GENERATED ARTIFACT IS A PROPOSAL
  - A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
  - THE PAGE NAMES WHERE IT SENDS
  - ONE CLICK PER DECISION
modules:
  - MOD-implementation-pages
builds_on:
  - ITM-681
  - ITM-615
  - ITM-616
  - ITM-617
tests:
  - unit
origin:
  - akmaier's request of 2026-10-17 to implement UC-021 to UC-035
---
# ITM-782 Items are proposed, written by hand and added on the backlog page

**REGISTER**

## Outcome

UC-032 steps 2 to 4 and 2a. The module's route `backlog` (`src/implementation-pages/backlog.mjs`) offers
neither *Propose items* nor *+ Item*. This item adds them as MOD-implementation-pages'
file states the route (MOD-implementation-pages.md:167-171):
- *Propose items for uncovered requirements* with its run panel (`prepareJob` of the kind `propose-items`), whose
  drafts wait for the Product Owner, with their findings from `backlogFindings`; *Add to backlog* lets them go on as
  edited, through the writer of the kind (`writeResult`);
- *+ Item*, a form from the item schema (`artifactSchemas`, `schemaForm`), saved with `saveItems` as the person's own
  input.

UC-032 1a — an item whose requirement was withdrawn or changed, pointed at the replacing requirement or removed — is
ITM-1316. It needs the mark MOD-work-plans gives a `done` item (MOD-work-plans.md:130-131), which `itemStates` does not
give yet (`src/work-plans/states.mjs:173-179`: a done item's `reason` is `null`), and MOD-work-plans is no module of this
item.

## Acceptance

- A drafted item that realises nothing, names no module of the architecture or builds on an item that does not exist is
  shown with its finding and cannot be added; a restatement is flagged.
- *+ Item* and *Add to backlog* each write one commit of item files under `docs/backlog/`.
- Drawing the route reads nothing more: the run panel and the form read only on their click.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/implementation-pages/` and the tests that name MOD-implementation-pages change.

## The planning run (sprint team1/127)

A stand-in draws the two controls: *Propose items for uncovered requirements* in the panel "Accepted, and realised by
no item yet" where it names anything, and *+ Item* below the backlog's table, each a `button` of type `button` with the
class `btn` of the page's other buttons, and an empty place for the panel or the form they open. The clicks are new and
are tested by the item's new cases.

On `main` at `99584273d`, in an export, beside the same 271 files without it (those that name MOD-implementation-pages,
its folder, `#backlog`, the uncovered panel, `dashboard-backlog`, MOD-site-frame, `dashboard-app`, `site-usability`,
`site-accessibility` or `load-per-view`): no case fails only with it. Its known positive: with a throw planted where the
stand-in draws *Propose items*, 18 cases of the 20 files that open `#backlog` fail, among them TST-1260406, which counts
the route's requests, and TST-1174101, its accessibility. So no existing test changes.
