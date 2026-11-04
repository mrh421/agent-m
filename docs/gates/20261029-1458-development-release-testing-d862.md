---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 0569b407e68a2cfa5e0efaeffb4c26692afa9b0b
  - https://github.com/akmaier/agent-m/pull/1458
date: 2026-10-29 14:58 UTC
---
# Development → Release testing: ITM-1294, the review-page tests carry their declarations

**REGISTER**

## Reason

ITM-1294, pull request #1458 into `sprint/team1/119`, passes on `0569b407`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1869-1874). The item is a refactoring of two test files' declarations. So
its commits are green, as A REFACTORING JOB BEGINS WITHOUT A FAILING TEST asks (SPEC.md:1467-1469), and the sprint's
brief says so of ITM-1294.

1. **CI is green on its one commit.** Run 40895983736, `pull_request`, on `0569b407` succeeds: 41 jobs pass and 17 are
   skipped. The merge base is `sprint/team1/119` at `87842213`.
2. **Only the item's two files change:** `tests/review-page.test.mjs` and `tests/load-per-view.test.mjs`, both of
   MOD-site-frame. Every changed line is a comment line, and no assertion, setup or title changes. No test is removed.
3. **The Acceptance holds.** I ran MOD-test-document's `testDeclarations` and `testFindings` on `0569b407`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings;
   - `review-page`: 8 declarations, TST-1294001 to 008, one per case, and 0 findings (0 before);
   - `load-per-view`: 11 declarations, 0 findings (10 before).
   - No identifier beginning `TST-1294` is held twice. A reader over every test file finds the 17 identifiers held twice
     that ITM-1302 renumbers, and no other.
4. **The tests, run by me on `0569b407`:** `review-page`, `load-per-view` and `test-document-one-line`, 36 pass and 0
   fail.
5. **The pull request's description** quotes no `JOB-` identifier.

## The readings ruled

1. **TST-1294009 stands on the right case.** The item names "opening one use case …" of `load-per-view` as undeclared.
   That case carries TST-1266108 (`:516`). The case after it, "opening a changed module …", carried a declaration
   without its first line: `guards:`, `given:`, `input:` and `expect:`, and no identifier, so the reader read none. That
   is the case the item's count of 11 needs, and the developer's reading is right.
   - **The miss was mine.** My planning stand-in put a declaration above TST-1266108's lines, and I counted 11 without
     reading which case gained it.
2. **The declarations already present without their first line keep what they expected.** Two such blocks gained their
   identifier: TST-1294005 in `review-page` and TST-1294009. Their values now stand on one line each, as the brief asks.
   - TST-1294009's `expect:` keeps every expectation. Only the quotations of MOD-review-pages go.
   - TST-1294005's `input:` and `expect:` add the second load with the same caches. The case already asserts that load
     (`warm`, the same requests and the same page). Its other expectations stay: one batch, the stored graph once, the
     SPEC at most once, no use case or queue file, the commit and the repository once, the folders twice, and no tree.
   - No assertion changes, so A REFACTORING JOB CHANGES NO EXPECTED RESULT holds (SPEC.md:1473-1476).

## Noted

- ITM-1294 changes tests and no behaviour, so no release test of it is due.
- Twelve other cases of `tests/load-per-view.test.mjs` carry no declaration (report on #1458). For the review.
