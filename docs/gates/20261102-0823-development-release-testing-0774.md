---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 073cc93fc7cd8fc1e90a16bfd3de56599077ca2f
  - https://github.com/akmaier/agent-m/pull/1713
date: 2026-11-02 08:23 UTC
---
# Development → Release testing: ITM-774, #1713, the system and release tests of UC-029

**REGISTER**

## Reason

ITM-774 was written by developer-opus-f (`Agent-M-Participant` on `073cc93fc`). I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41352303181 (`073cc93fc`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only new test files:** `tests/uc-029-harness.mjs`, `system-uc-029-browse-the-tests-of-a-product` (TST-774201 to
   774215) and `release-uc-029-browse-the-tests-of-a-product` (TST-774301 to 774311).
4. **Who wrote what it tests.** opus-f's only commit in the code the battery walks is ITM-600's comparison of the
   specification's gaps. The tests view does not use it: it compares releases through `compareReleases`
   (`tests.mjs:167`), and the specification's comparison is `flow.mjs:1064-1066`. So no release case guards behaviour
   opus-f built.
5. **The Acceptance holds:**
   - No alternative flow is left unwalked. 5a's "its identifier is not given to another test" is mapped to TST-1201004 of
     `tests/test_identifier_stability.py`.
   - The pull request records 21 planted faults, and each new case fails on one.

## Findings, ruled

Both point at MOD-trace-pages, whose accepted text assigns the tests view and the detail of a test. Each is an item,
registered in this commit:
- **UC029-F1, TST-774209 → ITM-1414.** A case whose comment names no `TST-` identifier yields no declaration
  (`tests.mjs:35-40`), so it is never listed under **Incomplete** (UC-029 1a).
- **UC029-F2, TST-774214 → ITM-1415.** The history marks every commit that has a record, a pull request's head off the
  default branch included (`test-detail.mjs:118-127, 139-149`).
  - MOD-trace-pages gives "its history across commits and releases" and does not say which commits. UC-029 step 5 says
    "of the default branch".
  - The two do not conflict, since the module text says no "every", so the item follows UC-029. No question to akmaier is
    needed.

## Readings taken

- The outcome "on the latest commit of the default branch" is that of the result records of the default branch's head,
  flaky where they disagree.
- "Marked as removed at the commit" is the detail's line naming that commit.
- 1a's missing identifier is a comment block with a level and guards whose first line names no `TST-` identifier.
- "Nothing written" is no write method of the host called.
- The comparison of a release's rates is UC-028's, not this page's.

All are taken.
