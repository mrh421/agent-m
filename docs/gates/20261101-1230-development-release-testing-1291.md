---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - f512ba247a41ac87ee04f29a8b5e16c18c28ccc1
  - https://github.com/akmaier/agent-m/pull/1626
date: 2026-11-01 12:30 UTC
---
# Development → Release testing: ITM-1291, #1626

**REGISTER**

## Reason

ITM-1291 (the last accepted text is read in one request) may go on. The pull request is #1626 into `sprint/team1/141`,
at `f512ba247`. developer-opus-f wrote the code and the unit tests. developer-sonnet-l wrote the release cases
(`Agent-M-Participant` on each commit). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `eb1d763a9` is red in run 41287053862
   (pull_request). Only the moved and new cases of `lastAcceptedText`'s requests fail: the approvals, load-per-view,
   review-page and stored-impacts cases. The code `c383a8777` (run 41287156014) is red only on the release cases of
   ITM-1268 and ITM-1314, which the Acceptance gives to another participant, and on TST-600603's FINDING `todo`.
2. **CI is green on the head:** run 41288385672 (pull_request, `f512ba247`), attempt 2.
   - Attempt 1 failed only TST-2026271023, on the brief's list of known flips.
   - sonnet-l's commit `8718abad1` was green in run 41287992379.
   - `f512ba247` merges the sprint branch with ITM-1349 without a conflict, and `git merge-tree` with the branch's current
     head is clean.
3. **Only the item's modules and their tests change.**
   - The code is `src/approvals/status.mjs`: `lastAcceptedText` reads the older text with one
     `host.readFileAt(file, [last.commit])` and compares its blob.
   - The test files are those of MOD-approvals, MOD-site-frame, MOD-review-pages and MOD-repository-hosts
     (`tests/memory-host.mjs`), the last two for tests only (`94fda3c15`). No code of their folders changes.
4. **The Acceptance holds:**
   - One request for the older file, none for its commit or a tree with a token on GitHub (TST-1291101). Its known
     positive: three requests named it before (TST-1291102).
   - The moved counts are those the item lists: TST-929002 on GitLab, as the probe measured it (tree 2 → 1), and
     TST-1266104, 1266108, 1294009, 1294005, 942003 and 942004.
   - The fakes now serve `readFileAt`, with no expectation changed.

## The release commit, ruled

`8718abad1` (developer-sonnet-l, who implemented none of this item) was written from the pushed code before the gate, as
the Acceptance gives it.
- TST-1268301 to 303 expect the older text read in one batch that names exactly the file.
- TST-1268304 and 305 answer that batch with another text or with nothing. Their assertions are unchanged.
- In `release-itm-1314`, the fake gains only `readFileAt`.
- Against the base, TST-1268301 to 305 fail.
- The planted fault (the blob check disabled) fails TST-1268304 and 305.

Allowed.
