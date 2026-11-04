---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - d9cca1771ee900463a7f0b59db23532eac10be93
  - https://github.com/akmaier/agent-m/pull/1721
date: 2026-11-02 09:01 UTC
---
# Development → Release testing: ITM-1422, #1721

**REGISTER**

## Reason

ITM-1422 (a case guards the generate page's trusted click) may go on. The pull request is #1721 into `sprint/team1/142`,
at `d9cca1771`, one commit by developer-sonnet-j (`Agent-M-Participant`). I wrote none of it.
1. **No failing first commit:** the item adds a case and no behaviour (its Acceptance).
2. **CI is green on the head:** run 41416171968 (`d9cca1771`), at attempt 2. Attempt 1 failed only a case of
   `bridge-build-build-platform`, at its limit of 60 s, which the pull request does not touch (below). `git merge-tree`
   with the sprint branch's head is clean.
3. **Only the item's test changes:** `tests/test-pages-generate.test.mjs` (MOD-test-pages). It adds TST-1422001 and a
   helper for a script's click beside the file's trusted click.
4. **The Acceptance holds:**
   - A script's click on *Write tests* writes no commit and queues nothing. A person's click then queues one job in one
     commit, and the page says so.
   - With the trusted-click check of `look.mjs:47` replaced by the bare listener, TST-1422001 is the generate file's only
     failing case, and ITM-1420's four cases of the schedule fail too. Restored, all pass.

## Reading taken

- "Its writing control" is *Write tests* (`generate.mjs:325`), the page's only control that writes to the repository
  through `look.mjs`'s `button`.
  - The run panel's *Run* belongs to MOD-site-frame and is not tested here.
  - *Remove*, *Show the run panel* and *Read the proposal* write nothing.

## Flips counted

- `bridge-build-build-platform` flipped a second time: in run 41416171968 at attempt 1 (job 125180545480) its case "the
  tunnel check starts the packaged Linux app without Electron's sandbox …" ran into 60 s. Its first flip (62 s) was
  counted at sprint 141's close. It is registered as ITM-1428 (MOD-bridge-build, its test only) in this commit.
