---
id: ITM-1375
title: An item's merged pull request closes its issues with links
level: module
realises:
  - UC-033
modules:
  - MOD-workflow-entries
  - MOD-maintenance-pages
builds_on:
  - ITM-804
tests:
  - unit
origin:
  - finding UC033-F5 of ITM-804's system test TST-804211 (#1653), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1108-development-release-testing-0804.md)
---
# ITM-1375 An item's merged pull request closes its issues with links

**REGISTER**

## Outcome

UC-033 step 6: when a pull request for the item is merged, the issue is closed with a link to the pull request and the
item. MOD-issue-handling's `closeWithLinks` is "run when the pull request of a bug fix or of an item from the issue is
merged" (MOD-issue-handling.md:85-87). MOD-workflow-entries' `onPullRequestClosed` closes "the issues it names" on a merge
(MOD-workflow-entries.md:257-259), and the issue route closes an issue "with links once its pull request is merged"
(MOD-maintenance-pages.md:130). Both look only at `fix-bug` jobs (`src/workflow-entries/product.mjs:970-976`,
`src/maintenance-pages/issues.mjs:429`) and close with `item: null` (`issues.mjs:443`).

## Acceptance

- When the pull request of a job that implements an item is merged, every issue the item names among its origins is closed
  with `closeWithLinks`, naming the pull request and the item: by `onPullRequestClosed`, and by *Close with links* on the
  issue's page.
- A bug fix's pull request closes its issue as before, with no item.
- TST-804211 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
