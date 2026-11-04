---
id: ITM-818
title: The old settings view and its endpoints section go
level: module
realises:
  - CODE OUTSIDE THE ARCHITECTURE IS MOVED INTO IT
modules:
  - MOD-settings-pages
  - MOD-site-frame
builds_on:
  - ITM-810
  - ITM-713
  - ITM-690
tests:
  - unit
origin:
  - ITM-810's draft stop (sprint team1/75), stop 1 and 2
---
# ITM-818 The old settings view and its endpoints section go

**REGISTER**

## Outcome

`docs/assets/dashboard/settings-view.mjs` and `docs/assets/dashboard/settings/endpoints.mjs` were removed by `28d00c697`,
and no file of `src/` or `tests/` reads them; only comments and fixture items name them. That commit removed nine cases of
`tests/review-core.d/dashboard-app.test.mjs` and `tests/load-per-view.test.mjs` and named the keeper of one: the GitLab
server check, moved to `tests/repository-hosts.test.mjs:870`. For the other eight, neither the commit nor a test names the test that keeps its
requirement:
- load-per-view's "Clear everything also removes the kept file texts", whose keepers TST-819001 and TST-819002 are
  (`tests/settings-pages-clear-everything.test.mjs`, `tests/settings-pages-clear-everything-live.test.mjs`);
- dashboard-app's "A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN — the GitLab check reports reach, branch and role…",
  "THE TOKEN LINK IS PREFILLED · ONE GITHUB TOKEN SERVES EVERY FEATURE…", "THE REPOSITORY CHOICE IS SPELLED OUT…",
  "ONE GITHUB TOKEN SERVES EVERY FEATURE — the link, the steps and the guidance…", "UC-014: setup names only the
  instance", and the two cases of "A PRODUCT'S TOKEN IS NAMED AFTER THE PRODUCT".

This item names, for each of the eight, the test of MOD-settings-pages, MOD-site-frame or MOD-repository-hosts that
keeps its requirement, and where none keeps it, adds one to the module's tests.

## Acceptance

- No file reads `settings-view.mjs` or `settings/endpoints.mjs`, and both are removed.
- Every removed case names the test that keeps its requirement.
- **Read at sprint team1/138's probe** (developer-sonnet-j, not pushed; no moved expectation, no break). Both files are
  already gone, so the item adds no behaviour. It is declared as refactoring: CI is green on every commit, and no
  existing expected result changes.
- Its one new test file, of MOD-settings-pages, keeps what no test keeps of A PRODUCT'S TOKEN IS NAMED AFTER THE
  PRODUCT (SPEC.md:778-783) and UC-001 step 3: `productTokenName` stays within 40 characters, a longer name drops the
  owner and then the end of the repository's name, as UC-001:62-63 says (the removed case's "…" is not in that text);
  `productTokenDescription` stays within 1024 characters.
- The pull request names, for each of the eight cases, its keeper: TST-819001, TST-819002, TST-476076, TST-472734,
  TST-476073, TST-588001, TST-588002, TST-627002, TST-627004, TST-627005, TST-478029 and the new test. A half of a case
  that no accepted text asks for any more (the old exact `note` and `tokenUsed`, a link written from
  `requiredPermissions`, the instance named once as its own product) is named there as gone with the old view, with no
  test. A half that an accepted sentence still asks for and no test keeps is a finding.
