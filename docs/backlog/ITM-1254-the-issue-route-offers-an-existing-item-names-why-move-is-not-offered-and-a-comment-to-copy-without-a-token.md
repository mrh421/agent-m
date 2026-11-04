---
id: ITM-1254
title: The issue route offers an existing item, names why Move is not offered, and a comment to copy without a token
level: module
realises:
  - UC-033
modules:
  - MOD-maintenance-pages
  - MOD-issue-handling
builds_on:
  - ITM-1250
tests:
  - unit
origin:
  - the review of ITM-1250 (PR #1380) by reviewer-sonnet: UC-033 1a, 4a and the no-token half of 4b are not built
---
# ITM-1254 The issue route offers an existing item, names why Move is not offered, and a comment to copy without a token

**REGISTER**

## Outcome

UC-033 (UC-033.md:87-100):
- 1a: for an issue not classified yet, *Move to backlog* is not offered and "Agent M links to UC-012, step 2". The issue route
  hides the button and says nothing.
- 4a: the Product Owner "adds a second issue to an existing item instead", and both issues get the comment. `moveToBacklog`
  takes `existing` (`src/issue-handling/backlog.mjs`, TST-1250107), but the page offers no existing item.
- 4b: "No token for the issue tracker is stored, or the token may not comment" — the item is committed and the comment is
  shown to copy. Only a token that may not comment (`PermissionMissing`) returns the comment; without a token
  `commentOnIssue` fails `NotSupported` (`src/repository-hosts/index.mjs:350`), which passes through.

## Acceptance

- Unit tests naming MOD-maintenance-pages and MOD-issue-handling: an unclassified issue shows the link to classifying it; the
  move offers the backlog's items to add the issue to, and *Add* on one writes it through `moveToBacklog` with `existing`;
  without a token for the tracker the item is committed and the comment is returned to copy. Counter-proof: before the
  change none of these holds.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/maintenance-pages/`, `src/issue-handling/` and the tests that name these modules change.
