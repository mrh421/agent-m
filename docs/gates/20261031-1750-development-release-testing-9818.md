---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 9887bd16a7f8284f1ee378b6e0c182a99dd0b12b
  - https://github.com/akmaier/agent-m/pull/1589
date: 2026-10-31 17:50 UTC
---
# Development → Release testing: #1589, ITM-818 The old settings view and its endpoints section go

**REGISTER**

## Reason

ITM-818 was built by developer-sonnet-j, and I did none of it. It is declared as refactoring (its Acceptance, `3a1ca6196`).
1. **No failing first commit.** `A REFACTORING JOB BEGINS WITHOUT A FAILING TEST` applies, so check 1's red does not.
   The one commit is `9887bd16a`, based on the sprint branch's `9a53eb10d`.
2. **CI is green on it:** run 41226152296, at the first attempt.
3. **Scope:** `git diff --stat 9a53eb10d 9887bd16a` shows one file, the new
   `tests/settings-pages-product-token-name.test.mjs`, headed `Module: MOD-settings-pages`. No existing test changes,
   so no expected result changes (`A REFACTORING JOB CHANGES NO EXPECTED RESULT`).
4. **Each new test is read by MOD-test-document.** `testDeclarations` reads TST-818001 and TST-818002 with level
   `unit`, module MOD-settings-pages, and both guards: A PRODUCT'S TOKEN IS NAMED AFTER THE PRODUCT and UC-001.
   `testFindings` reports none. The control: the same reader on a copy with TST-818001's `level` and `expect` taken out
   reports "no level" and "no expected result". TST-818nnn was free. The four counter-proofs (planted in
   `products.mjs`) are recorded in the pull request.
5. **The Acceptance holds, as far as reading shows:**
   - Both old files are gone, and nothing reads them.
   - TST-818001 asserts the 40-character cut with UC-001:62-63's order (owner first, then the end of the name, no "…").
   - TST-818002 asserts the 1024-character limit.
   - The pull request names a keeper for each of the eight cases, and it names the halves of 2, 3 and 4 as gone with
     the old view.

## Noted

- SPEC.md:781-783 names `tests/dashboard-review-flows.test.mjs` as the Check of A PRODUCT'S TOKEN IS NAMED AFTER THE
  PRODUCT. That file asserts neither the name nor the description, so the Check does not check what the requirement says.
  TST-818001/002 now keep it in MOD-settings-pages. Changing the Check's pointer is a SPEC change, for akmaier.
