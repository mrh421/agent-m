---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 2bb7f19593070efa149e90ff5d175005bc57d64d
  - https://github.com/akmaier/agent-m/pull/1681
date: 2026-11-01 16:11 UTC
---
# Development → Release testing: ITM-579, #1681, the system and release tests of UC-005

**REGISTER**

## Reason

ITM-579 was written by developer-sonnet-j (`Agent-M-Participant` on `2bb7f1959`). I wrote none of it.
1. **No failing first commit:** a battery adds no behaviour (142.md, *Readings taken*).
2. **CI is green on the head:** run 41324231493 (`2bb7f1959`), at attempt 2. Attempt 1 failed in one job,
   `unit-pull-request (7)`. Its one failing case was in `tests/review-pages-edit-architecture.test.mjs`, which the pull
   request does not touch. That is the file's second flip, which ITM-1387 covers (142.md, ITM-1387's start). `git merge-tree`
   with the sprint branch's head is clean.
3. **Only new test files:** `tests/uc-005-harness.mjs`, `tests/system-uc-005-derive-requirements.test.mjs` (TST-579201 to
   579219) and `tests/release-uc-005-derive-requirements.test.mjs` (TST-579301 to 579330). MOD-test-document reads 49
   declarations with no finding. TST-5792nn and 5793nn had no history (known positive: TST-371001).
4. **Who wrote what it tests.** By `Agent-M-Participant` on `src/`, sonnet-j wrote code of 25 items, ITM-659, 1274 and 1315
   among them. I compared them with the requirements this file's release cases guard. The only overlap is
   `ONE CLICK PER DECISION`, through ITM-1315 (*Accept* on a file's page). Its case presses *Run* and *Write proposals*,
   which ITM-1315 did not build, and no case walks *Accept* or an entry's page. TST-579322 guards the impact list. It reads
   the rationale that MOD-spec-changes writes, not ITM-1274's code, and is also mapped to TST-479201 and 1274301, which
   other participants wrote. Eight requirements are mapped to other writers' release tests.
5. **The Acceptance holds:** TST-579201 maps UC-005's flow, and TST-579301 maps the 29 requirements UC-005 realises. The
   pull request records 37 planted faults. Every case but the two maps and the five `todo` cases fails on one.

## Findings, ruled

- **TST-579204 (1a, a changed source) → ITM-1389 (MOD-review-pages), registered in this commit.** MOD-source-register's
  `content` throws `HashMismatch`, and the page shows it through MOD-site-frame's `readProblem` as a page that "could not
  be drawn". The requirements' drafting route `<k>/draft` is MOD-review-pages', and it reads the linked source's files
  (UC-005 2a). The text assigns the route, not the words UC-005 1a asks for, and that is noted for akmaier.
- **TST-579207 (2a, the refusal's counts) → ITM-561 (MOD-site-frame among its modules), added to its origin and
  Acceptance in this commit.** `src/site-frame/run-panel.mjs:44` names tokens only. This is the finding UC019-S10 (TST-377011)
  on the same panel. No second item is registered. ITM-561's readiness stays as that item states it.
- **TST-579212 and TST-579321 (6.1, `CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES`) → ITM-1390 (MOD-review-pages),
  registered in this commit.** `editedResult` (`src/review-pages/candidates.mjs:149-168`) rebuilds one class per candidate,
  so the drafting page undoes the merge the correction loop made.
- **TST-579219 (postcondition, the source version) → ITM-1391 (MOD-spec-changes), registered in this commit.**
  MOD-spec-changes' Data gives the rationale's origin as "the source passage and version". `rationaleOf`
  (`src/spec-changes/propose.mjs:195-196`) writes the passages and no version.

## Noted

- The tab's routes set `agentM.version` to the instance commit, where MOD-job-runner names a calendar version or
  "unreleased". No case guards it here, and it is not registered now; it is a candidate for the review.
- A duplicate of a requirement held only in an open queue is not written. No case guards it, and it is not ruled now.

## Readings taken

The pull request names five readings, each with the sentence it reads:
- the linked version;
- the version record, read from the proposal's section;
- the classification rate, which stays with `test_derivation_classes`;
- 2a, split into its parts;
- the map, which reads UC-005 as TST-371201 reads UC-006.

All are taken.
