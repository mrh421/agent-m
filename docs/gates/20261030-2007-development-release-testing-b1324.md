---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 02809df7e8a6179a03226681b4aa007d140b578b
  - https://github.com/akmaier/agent-m/pull/1538
date: 2026-10-30 20:07 UTC
---
# Development → Release testing: ITM-1324, the schema form's missing-key cases take identifiers of their own

**REGISTER**

## Reason

ITM-1324, pull request #1538 into `sprint/team1/129`, passes on `02809df7`, its head and only commit when this was
decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1875-1880).

1. **CI.** Run 41119086739 (`pull_request`) on `02809df7`:
   - Attempt 1 was cancelled. Two jobs, `system-pull-request (1)` and `unit-pull-request (13)`, are cancelled, with no
     step failed.
   - Attempt 2 succeeds: 41 jobs succeed, 17 are skipped, and none failed.
2. **No failing first commit is due.** AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST (SPEC.md:1460-1463) binds a job
   "that adds or changes behaviour". This one renames two declaration lines and changes no case body, assertion or code.
   That is the item's reading ("One commit, which holds only the file. CI is green on it").
3. **Only the item's file changes:** `tests/site-frame-schema-form-missing-key.test.mjs`, +2 −2, by developer-sonnet-j
   (`Agent-M-Participant`). The declaration lines `:43` and `:59` become TST-1290011 and TST-1290012. The cases' names
   carry no identifier and stay as they are.
4. **No identifier is repeated.** The repeat reading of MOD-test-document's `testDeclarations`, in an export of
   `02809df7`, finds 1,485 test files, 5,805 declarations, 5,805 identifiers and 0 repeats. TST-1290001 and TST-1290002
   stand once each, in `tests/site-frame-preloads.test.mjs`.
   - Known positive: on `main` at `4c27ee9e2` the same reading finds 2 repeats, TST-1290001 at
     `site-frame-preloads:22` and `site-frame-schema-form-missing-key:43`, and TST-1290002 at `:32` and `:59`.
5. **MOD-test-document's reader:**
   - The file has 2 declarations and 0 findings, each `unit` and MOD-site-frame. Its header gives one module.
   - The control, `tests/release-itm-1254-issue-move.test.mjs`, has 4 declarations and 0 findings.
6. **Every case passes as before.** In the export, `node --test` on the file gives 2 pass and 0 fail, and on
   `tests/site-frame-preloads.test.mjs` gives 3 pass and 0 fail.
7. **The new identifiers are free.** The pull request's history search finds no commit naming TST-1290011 or TST-1290012.
   The same search finds TST-1290003, its known positive, as the item also records. The records that name ITM-1290's
   cases by their old identifiers stay (A RECORD IS EVIDENCE, NOT A PROPOSAL).
