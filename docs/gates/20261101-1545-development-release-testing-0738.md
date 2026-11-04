---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - df467e34cad65dc2ddf8696305c9e92713c4c03c
  - https://github.com/akmaier/agent-m/pull/1629
date: 2026-11-01 15:45 UTC
---
# Development → Release testing: ITM-738, #1629, the system and release tests of UC-021

**REGISTER**

## Reason

ITM-738 was written by developer-sonnet-j (`Agent-M-Participant` on `df467e34c`). No commit of `src/group-document/` or
`src/artifact-edits/` carries that trailer; theirs name developer-sonnet-c and developer-sonnet-e. I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (141.md, *Readings taken*). There is one commit.
2. **CI is green on it:** run 41291267154 (pull_request), at the first attempt. `git merge-tree` with the sprint branch's
   current head is clean.
3. **Only new test files:**
   - `tests/uc-021-harness.mjs`;
   - `tests/system-uc-021-group-artifacts-into-a-hierarchy.test.mjs`;
   - `tests/release-uc-021-group-artifacts-into-a-hierarchy.test.mjs`.
4. **MOD-test-document's reader:**
   - `testDeclarations` reads 22 system cases (TST-738001 to 738022) and 18 release cases (TST-738101 to 738118). Each
     declares `module: system`, and `testFindings` reports none.
   - `testHeader` gives MOD-review-pages, MOD-artifact-edits, MOD-group-document and MOD-trace-pages for all three files,
     with no finding.
   - TST-738nnn was free.
   - The pull request records 32 planted faults, and every case that is not a `todo` fails on at least one of them.
5. **The flow map** reads UC-021 and checks the battery's coverage of its passages, not what code returns. As in the
   batteries of UC-008, UC-025 and UC-035, it is allowed (`A TEST DOES NOT TAKE ITS EXPECTED RESULT FROM A DOCUMENT`
   binds "a test that checks code"). The pattern is noted for akmaier.

## Findings, ruled

Four are defects against accepted texts that can be built, so each is a new item. One needs a text, so it is a new item
that waits for akmaier.
- **F1 (TST-738003) → ITM-1356, MOD-trace-pages.** The tests browser offers no *Arrange*, though MOD-review-pages gives
  `arrange/tests` (MOD-review-pages.md:283-285).
- **F2 (TST-738012) → ITM-1357, MOD-review-pages.** No control deletes a group or lifts its content, though
  MOD-group-document gives the moves `delete` and `lift` (MOD-group-document.md:67-69).
- **F4 (TST-738006) → ITM-1358, MOD-review-pages.** A pending move does not say where the item came from (UC-021 step 3).
- **F5 (TST-738022, TST-738118) → ITM-1359, MOD-review-pages.** *Propose groups* on tests hands the record test
  identifiers, which `works_on` does not hold (MOD-job-ledger.md:70). The reading taken: the job works on the commit it
  read, which `works_on` holds. So MOD-job-ledger's form does not change.
- **F3 (TST-738015) → ITM-1360, waits for akmaier.** No `GroupMove` removes an unknown member (MOD-group-document.md:67-69,
  :78-81). The general cause: MOD-group-document needs a move that takes out a member matching no item.

## Noted for akmaier, with no case

MOD-identifiers gives `TST-<nnn>` (MOD-identifiers.md:52), while UC and ITM say "three or more digits". The code reads
`TST` as exactly three digits (`src/identifiers/scheme.mjs:15`, `:23`). This repository's tests use longer ones, such as
TST-738001. So such a test is listed but refused a move. Whether `TST` takes three or more digits, as UC and ITM do, is a
question of the module text. Nothing in this sprint waits on it.

## Readings taken

- 2a is reached through a participant's proposal.
- 5b is a SPEC commit without the requirement.
- 5c opens GitHub's edit page where the file exists and its new-file page where it does not.
- The harness writes fresh commits to avoid the trace graph's cache.
- The GitLab fixture answers the trace cache from its files.

All five are taken.
