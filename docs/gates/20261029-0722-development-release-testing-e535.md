---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - b1c5921ccc888109da1d62019619df361f935424
  - https://github.com/akmaier/agent-m/pull/1413
date: 2026-10-29 07:22 UTC
---
# Development → Release testing: ITM-1297, the declarations written with a dash are written in the stated form

**REGISTER**

## Reason

ITM-1297, pull request #1413 into `sprint/team1/113`, passes on `b1c5921c`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1870-1873). For a refactoring job it asks that "CI was green on every
commit and no expected result changed".

1. **CI is green on every commit.** The pull request has one commit, `b1c5921c`. Run 40834257474, `pull_request`, on it
   passes 38 of 38 pull-request jobs.
2. **No expected result changes.** The diff against `sprint/team1/113` changes 80 lines, 40 removed and 40 added. Every
   one is a comment line (`//`): 28 first lines of a declaration and 12 guards. No assertion and no code changes.
3. **Only the item's files change:** `tests/reuse-facts.test.mjs`, `review-pages-draft-architecture`,
   `review-pages-draft-requirements`, `source-register-version-fetch` and `workflow-entries-sources`. Each is named by one
   of the item's modules.
4. **The reader.** I ran MOD-test-document's `testDeclarations` and `testFindings` on `b1c5921c`:
   - **Known positive:** `tests/release-itm-1254-issue-move.test.mjs`, 4 declarations and 0 findings.
   - `reuse-facts`: 15. `review-pages-draft-requirements`: 10. `source-register-version-fetch`: 13.
     `workflow-entries-sources`: 6. `review-pages-draft-architecture`: 27.
   - All with 0 findings. Before, the five gave 6, 5, 7, 3 and 22, and 12 findings once read in the stated form.
5. **No identifier is claimed twice.** Over every test file under `tests/` (fixtures left out):
   - `sprint/team1/113` holds 5,391 declarations under 5,375 identifiers;
   - `b1c5921c` holds 5,419 under 5,403.
   - So the 28 recovered declarations bring 28 identifiers of their own.
   - The identifiers held by more than one declaration are the same 16 before and after, and none is in the five files.
   - The developer's twin declarations, such as TST-361001 beside TST-584009, are two identifiers of like content. That
     is no claim of one test on another's identifier.

## Noted

- **16 identifiers are each held by two declarations, before this pull request.** That is against EVERY ARTIFACT HAS AN
  IDENTIFIER (SPEC.md:52-54), each artifact carrying one of its own. It is registered as **ITM-1302**, with the list.
