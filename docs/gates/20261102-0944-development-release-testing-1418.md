---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 5540f2f45348fde28f70b8b5816117fe0cfa5bac
  - https://github.com/akmaier/agent-m/pull/1725
date: 2026-11-02 09:44 UTC
---
# Development → Release testing: ITM-1418, #1725

**REGISTER**

## Reason

ITM-1418 (the schedule page shows the last run of a release candidate) may go on. The pull request is #1725 into
`sprint/team1/142`, at `5540f2f45`. developer-opus-e wrote the tests-only commit `17cfd89f0` and the code `d5271a091`;
developer-sonnet-l wrote `5540f2f45`, the lift of TST-772217's `todo`, after the code was pushed (`Agent-M-Participant` on
each). I wrote none of it.
1. **The first commit holds only tests and is red for the item's reason.** `17cfd89f0` adds TST-1418001 (on GitHub and
   GitLab), 1418002 and 1418003 to `tests/test-pages-schedule-save.test.mjs` (MOD-test-pages). Its fixture host gains
   `listTags` and runs per commit, and no existing expectation moves. In run 41420750094 the new cases are the only failing
   ones.
2. **CI is green on the head:** run 41421872921 (`5540f2f45`), at the first attempt. No job failed or was cancelled.
   `git merge-tree` with the sprint branch's head is clean.
3. **The probe did not stop the item.** A run's commit and a tag's commit can be matched on both servers: GitHub's run
   names its head's commit and `listTags` its tag's dereferenced commit; GitLab's pipeline and tag name theirs. So the
   reading the item gave builds with no new field of `CiRun`.
4. **Only the item's module changes:** `src/test-pages/schedule.mjs`.
   - The block of last runs drew four occasions and "shown on the release panel" (:58, :328). It now draws all five.
   - The release candidate's run is the newest push run on a commit that a candidate tag names, read per tagged commit.
   - Where none has run, or the tags or their runs cannot be read, the row says so. The other rows are unchanged.
5. **The Acceptance holds:**
   - The counter-proofs F1 to F7 in the pull request each fail a case: the tag pattern widened, no event filter, the first
     commit only, the row left out, unreadable shown as no run, the oldest run taken, and the empty row silent.
   - TST-772217 loses its `todo`: red at `17cfd89f0`, green at `d5271a091`. Its case now shows no run before any tag. With a
     candidate tag on a pull request's head, the row links exactly that tag's push run, and *every commit* still links the
     head's newer push run.
   - The lift changes `tests/uc-027-harness.mjs`, whose header names MOD-test-pages, to give it `listTags`.
   - opus-e wrote the case, and sonnet-l built none of the page. The system file of UC-027 gives 19 passing and one
     `todo`, and the release file 14.

## Readings taken

- A release candidate's tag is `v<version>-rc.<N>` (MOD-release-evidence, Data). The release's own tag lands later on the
  same commit.
- The newest run over all tagged commits counts.
- Only push events count; a tag's pipeline on GitLab is a push too.

All are taken.

## Noted

- *Every commit* still reads the newest push run, which can be a tag's push, since `CiRun` names no ref. Changing that
  would move existing expectations, and no case asks it. It is a candidate for the review.
