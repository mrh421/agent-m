---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 7f3ea509ed8f090d65ca5c6e43a7f96844dd5166
  - https://github.com/akmaier/agent-m/pull/1606
date: 2026-11-01 06:13 UTC
---
# Development → Release testing: ITM-1062, #1606, the system and release tests of UC-046

**REGISTER**

## Reason

ITM-1062 was written by developer-sonnet-k (`Agent-M-Participant` on `7e464bea7` and `3fd201833`). No commit of
`src/main-page/` or `src/progress-measures/` carries that trailer. I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (141.md, *Readings taken*). The head `7f3ea509e` merges the
   sprint branch without a conflict.
2. **CI is green on the head:** run 41279204796 (pull_request), at the first attempt.
3. **Only new test files:**
   - `tests/system-uc-046-see-what-goes-on-in-the-instance.test.mjs`;
   - `tests/release-uc-046-menu-build-and-documents.test.mjs`;
   - `tests/release-uc-046-documents-under-docs.test.mjs`;
   - the helper `tests/uc-046-harness.mjs`.

   No existing file changes.
4. **MOD-test-document's reader:**
   - `testDeclarations` reads 19 system cases (TST-1062001 to 1062019) and 4 release cases (TST-1062101 to 1062104).
     Each declares `module: system`, and `testFindings` reports none.
   - `testHeader` gives each file its modules and level, with no finding.
   - The control is the one in the ITM-372 record of this sprint.
5. **The Acceptance holds, as far as reading shows:**
   - Each disagreement is a FINDING `todo`.
   - The counter-proofs are recorded in the pull request.

## Findings, ruled

In all three, the page does what the accepted module texts state, and the finding is that UC-046's wording reads stricter.
akmaier accepted those module texts after UC-046, and each was checked against the use cases. For each, there is a
reading of UC-046 under which the page meets it (AGENTS.md §6a.6, §6a.7). So none is a defect, and none gets an item.
- **UC046-S1 (TST-1062009), step 3, "Every share is derived … from the product's repository and its records; none is
  stored."** The card draws the overview that the workflow stored for the head. That overview was computed from the
  repository when the commit was pushed, and it is kept in the repository (MOD-main-page.md:118-125). The reading:
  - the shares are derived from the repository and what it holds;
  - "none is stored" means the page stores none, as `PROGRESS AND JOB STATE ARE DERIVED, NOT STORED` says: "Neither
    dashboard stores a status of its own" (SPEC.md:1846-1848).
- **UC046-S2 (TST-1062012), step 4, "a step or an item moves on to *done* when its pull request is merged."** The step
  is done in every reading of the page after the merge (MOD-progress-measures' `buildInProgress`: "a step or item leaves
  the list as done once its pull request is merged"). While the page stays open, it reads the jobs' records again "and
  nothing else" (MOD-main-page.md:92-98). The use case does not say "without reloading". Reading it in would add a word
  the text does not contain.
- **UC046-S3 (TST-1062017), 4a, "The card says that jobs running there are not shown."** The card lists such a job with
  the state its record gives, marked "not reachable" (MOD-progress-measures' `buildInProgress`; MOD-main-page.md:219).
  The reading: the mark is how the card says that what runs there is not shown.

The three `todo`s keep UC-046's wording beside the page. Whether to bring that wording in line with the module texts is
akmaier's choice. Nothing waits on it.
