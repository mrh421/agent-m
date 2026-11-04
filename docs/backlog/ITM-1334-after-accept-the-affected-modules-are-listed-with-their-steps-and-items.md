---
id: ITM-1334
title: After Accept the affected modules are listed, each with its plan steps and backlog items
level: module
realises:
  - UC-023
  - AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
modules:
  - MOD-review-pages
builds_on:
tests:
  - unit
origin:
  - akmaier's ruling "UC-23 build" on finding UC023-S4 (TST-739013), drafted in MOD-review-pages with 8cf3cdf03 (#1546) and accepted with d70cbd918 (docs/approvals/MOD-review-pages-160336739f35.md)
---
# ITM-1334 After Accept the affected modules are listed, each with its plan steps and backlog items

**REGISTER**

## Outcome

UC-023 step 6: "Agent M lists the affected modules, each with the steps of the implementation plan or the backlog items
that name it." The accepted MOD-review-pages: "Once *Accept* has recorded changed or removed decision or module files, the
page lists the modules of the impact lists it showed for them, each with the plan steps and backlog items of those lists
that name it in the graph of the commit shown (`storedGraph`) (UC-023 step 6)."

After *Accept*, the page says only that the file was accepted (`showOne`, `src/review-pages/flow.mjs`). TST-739013
(`tests/system-uc-023-modify-the-architecture.test.mjs`) follows UC-023 and stands `todo` with the finding UC023-S4.

With this item, once *Accept* — of one file, of the ticked ones or *Accept all N shown* — has recorded changed or removed
decision or module files, the page lists each module of the impact lists it showed for them, with the plan steps and
backlog items of those lists that name that module in the graph of the commit shown.

## Readiness

It is ready. The impact lists are those the page showed; the graph is the one the page reads already (`storedGraph`, in
MOD-review-pages' Uses). No request is added: the list is drawn from what the page has read. A list entry is a module, so
an item that names two modules of the lists stands under both.

## Acceptance

- A unit case of the review page: after *Accept* of a changed module file whose impact list names an item of the backlog
  and a plan step, each naming one module, the page lists each module with the one item that names it.
  - Known positive: before *Accept* the impact list names both items.
  - Counter-proof: on the base, after *Accept* no module is listed.
- TST-739013's `todo` is taken away, and TST-739001's `FLOW_FINDINGS` entry `6-affected-modules-with-their-steps` moves
  to `FLOW_EVIDENCE` with TST-739013, on the item's branch, in a commit of their own, by a participant who implemented
  none of the item.
- The first commit holds only the tests, and CI is red on it for the item's reason.
