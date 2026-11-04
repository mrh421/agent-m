---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - d7c236ec9df5d559d38c0c2b87fc423ed321ac42
  - https://github.com/akmaier/agent-m/pull/1719
date: 2026-11-02 08:47 UTC
---
# Development → Release testing: ITM-1420, #1719

**REGISTER**

## Reason

ITM-1420 (the schedule page writes only on a person's click) may go on. The pull request is #1719 into `sprint/team1/142`,
at `d7c236ec9`. developer-opus-e wrote the tests-only commit `961a22688` and the code `d7c236ec9` (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.**
   - `961a22688` adds TST-1420001 and 1420002 to `tests/test-pages-schedule-save.test.mjs` (MOD-test-pages). Each runs on
     GitHub and on GitLab.
   - It makes the click helpers of that file and of `tests/uc-027-harness.mjs` send a trusted click, as their comments
     already said. The harness names MOD-test-pages and MOD-test-schedule, and only its one-line click helper changes.
   - In run 41414151833 the only failing cases are the four new ones. The system and release files of UC-027 stayed green
     there, and no expectation moved.
2. **CI is green on the head:** run 41414612387 (`d7c236ec9`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **Only the item's module changes:** `src/test-pages/schedule.mjs`, `look.mjs` and `generate.mjs`.
   - The path: `scheduleForm`'s click listener (`schedule.mjs:228`) never read the event, so *Save* went on to
     `proposeSchedule`. `drawProposal`'s listener (:380) went on to `mergeAndSchedule`. A script's click wrote.
   - Now *Save* and *Merge* use the module's one `button`, which calls its listener only for a trusted click. It is moved
     from `generate.mjs` into `look.mjs`, not copied, and `generate.mjs` imports it.
4. **The Acceptance holds:**
   - A script's click on *Save* or *Merge* writes nothing, and a person's click writes, on both servers.
   - The three counter-proofs each fail named cases: a button that answers any click, *Merge* back to a plain listener,
     and a button that refuses every click.

## Readings taken

- The shared button belongs in `look.mjs`, "what this module's routes share of the site's look". A new file would add a
  part to the module's text.
- The harness's one-line click helper changes, although its header also names MOD-test-schedule, which no item in
  progress holds.

Both are taken.

## Noted

- The generate page's own trusted-click check has no case that guards it: planted fault 1 stripped it and no case of that
  page failed. It is registered as ITM-1422 (MOD-test-pages, its tests only) in this commit.
