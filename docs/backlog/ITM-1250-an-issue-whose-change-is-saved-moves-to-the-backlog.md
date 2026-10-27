---
id: ITM-1250
title: An issue whose change is saved moves to the backlog
level: module
realises:
  - UC-012
  - UC-033
modules:
  - MOD-maintenance-pages
  - MOD-issue-handling
builds_on:
  - ITM-584
  - ITM-617
tests:
  - unit
origin:
  - the cut of ITM-584: `moveToBacklog` writes the item through MOD-work-plans' `saveItems` (MOD-issue-handling.md:78, :105,
    :120), which is not built (`src/work-plans/index.mjs:6`) and which ITM-617 builds
---
# ITM-1250 An issue whose change is saved moves to the backlog

**REGISTER**

## Outcome

UC-012's second postcondition; UC-033 step 4. As accepted (the architecture a2fe0994, accepted in 6c0aa1ab): on
MOD-maintenance-pages' issue route, *Move to backlog* prefills the item with `backlogItemFrom(issue, changed, …)`, `changed`
being the requirement names that `entryView` gives for the entries of the queues whose `issue` names this issue and the chosen
product; *Add* writes the item, and the issue's comment and label, with `moveToBacklog`, or names the comment to copy when the
token may not comment. `moveToBacklog` writes the item through MOD-work-plans' `saveItems` (MOD-issue-handling.md:78).

Not built: `backlogItemFrom`, `moveToBacklog`, *Move to backlog* and *Add* on the issue route.

## Acceptance

- Unit tests naming MOD-issue-handling and MOD-maintenance-pages: `backlogItemFrom` for a bug and for a change; *Move to
  backlog* prefills the item with the queues' changed requirements; *Add* writes the item through `saveItems`, the comment
  `item-added` and the label with `moveToBacklog`, or names the comment to copy. Counter-proof: before the change none of
  these exists.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/maintenance-pages/`, `src/issue-handling/` and the tests that name these modules change.
