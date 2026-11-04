---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 2f72b8838ee09e285ba250d7aab271cb0f093128
  - https://github.com/akmaier/agent-m/pull/1391
date: 2026-10-29 02:47 UTC
---
# Development → Release testing: ITM-1259, on GitLab a merged merge request closes the issues it names

**REGISTER**

## Reason

ITM-1259, pull request #1391 into `sprint/team1/111`, passes on `2f72b883`, its head when this was decided.

The Definition of Done is the default (SPEC.md:1870-1873): "its CI run is green, the job's first commit held only
failing tests …, it changes only the job's modules, every new test names the requirement it guards and the module it
exercises".

1. **CI is green.** Run 40805795668 on `2f72b883` passes 38 of 38 pull-request jobs.
2. **Red first.** `89063c98` holds only tests. Run 40805306049 fails one job, unit shard 13 (job 123222760481), and only
   in its own cases:
   - TST-1259001 and the case of `tests/runtimes-workflow.test.mjs` whose GitLab rules it rewrites;
   - TST-1259002 to 1259005 of `tests/workflow-entries-merge-request-closed.test.mjs`.
3. **Only its modules change.**
   - Code: `src/runtimes/workflow/gitlab.yml`, `src/workflow-entries/product.mjs` and `compose.mjs`.
   - Tests and helper: they name MOD-runtimes, MOD-workflow-entries, or MOD-workflow-entries with MOD-issue-handling.
4. **The new tests name their requirement and module:** GITLAB PRODUCTS ARE SUPPORTED and UC-012, on MOD-runtimes and
   MOD-workflow-entries.

## The developer's points

1. **The instance host connected without the person's token (`compose.mjs`) is in scope and is the module's text.**
   - MOD-workflow-entries.md:115-124: the instance is connected "through Access's local clone", which fetches "with its
     own credentials …. No further token is used."
   - Before, the person's token, a GitLab token in this case, went to a host addressed at the GitHub instance. That is
     against A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT.
   - The file is MOD-workflow-entries' (`## Parts`). TST-1259002 (`:50`) checks that every request to the GitLab
     server carries the person's token.
2. **A known limit, for a new item.** GitLab takes a job's first matching rule. So a merge whose changes include
   `docs/jobs/` or `docs/gates/` runs `writeResult` and not `onPullRequestClosed`, and closes no issue.
   - MOD-runtimes.md:141 asks for `onPullRequestClosed` on "a pull or merge request closed or merged", every one.
   - The item's Acceptance asks it "for the merge of a merge request". The common case holds, and that is not a
     condition of the Definition of Done.
3. **The reading, the push pipeline of the target branch as the merge, is taken.** GitLab starts no pipeline on the
   merge request for its merge. The rule is a push to the default branch, so a merge into another branch closes nothing
   on GitLab, while GitHub's event comes for every target. That difference is for the same new item.
4. **UC-012 was read only to line 80.** Its alternative flows and postcondition (`UC-012…md:83-98`) were not read in
   full, against AGENTS.md ("read them in the original") and sprint 110's team agreement. It is no condition of the
   Definition of Done. It goes to the retrospective.
