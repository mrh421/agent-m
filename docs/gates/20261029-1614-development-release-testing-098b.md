---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 6a27980f724e85740b3b842eeb20afbb2ec556c4
  - https://github.com/akmaier/agent-m/pull/1462
date: 2026-10-29 16:14 UTC
---
# Development → Release testing: ITM-1289, on GitLab every merged merge request closes the issues it names

**REGISTER**

## Reason

ITM-1289, pull request #1462 into `sprint/team1/120`, passes on `6a27980f`, its head when this was decided.

The condition is "CI is green on it and the Definition of Done holds" (`docs/process-models/scrum-wip.md:53`). The
Definition of Done is the default (SPEC.md:1869-1874).

1. **The first commit holds only the tests, and CI is red on it for the item's reason.**
   - `80451685` changes only `tests/runtimes-workflow.test.mjs`.
   - Its run 40907819307 (`pull_request`) fails in `unit-pull-request (6)` alone, on three cases of that file:
     - TST-472724, "each event starts its entry";
     - TST-1259001, the rule that sets `onPullRequestClosed`;
     - the new TST-1289001.
   - The first two are the changed expectations that the item's planning run named. They stand in this commit, as the
     agreement asks.
2. **CI is green on the head.** Run 40908878030 (`pull_request`, head `6a27980f`) succeeds: 58 jobs, none failed.
3. **Only the item's files change.**
   - `6a27980f` changes `src/runtimes/workflow/gitlab.yml` alone. The write job's rule for `onPullRequestClosed` becomes a
     push of any branch. A script line runs `onPullRequestClosed` after `writeResult` on a push.
   - These are inside the item's limit: "Only `src/runtimes/`, `src/workflow-entries/` and their tests change".
   - MOD-workflow-entries needs no change. `eventPullRequest` finds the merged merge request by its commit on any branch
     (`src/workflow-entries/product.mjs:943-950`).
4. **No counter-proof is weakened.**
   - TST-472724 and TST-1259001 keep every assertion. Only the push condition of the closing rule changes, from the
     default branch to any branch, as the item's Outcome asks.
   - TST-1259001 still asserts that no rule runs on `merge_request_event`, and that the plan's and the agents' jobs have
     no such rule.
   - TST-1289001 runs the generated rules over five pipelines:
     - (1) a merge into `main` that changes `docs/jobs/` runs `writeResult` and then `onPullRequestClosed`;
     - (2) a merge into a sprint branch runs `onPullRequestClosed` alone;
     - (3) known positive: a push to `main` of code alone;
     - (4) counter-proof: an open merge request's own pipeline starts nothing;
     - (5) counter-proof: the schedule runs `onSchedule` alone.
   - Its counter-proof is the template as it stood, on which it fails in the red run above.
5. **Checked by me on `6a27980f`.**
   - `runtimes-workflow`, `release-itm-1259-merge-request-closes-issues`, `runtimes-gitlab-ci-merge`,
     `workflow-entries-gitlab-547`, `runtimes-job-workflow-machines-gitlab` and `test-document-one-line` give 44 pass and
     0 fail.
   - MOD-test-document's reader over `tests/runtimes-workflow.test.mjs` gives 14 declarations and 0 findings. Its
     control, `tests/release-itm-1254-issue-move.test.mjs`, gives 4 and 0.
   - The stand-in of the planning run made the same two rule changes (`docs/backlog/sprints/team1/120.md`). Its run of 227
     files found no failure beyond TST-472724 and TST-1259001, and the release test of ITM-1259 passed.

## The readings ruled

- **"Running both entries" for a merge that changes `docs/jobs/` is `writeResult` and `onPullRequestClosed` in the job
  that writes, and `onRecordsChanged` in the agent's job, unchanged.** MOD-runtimes' table gives a push to the default
  branch that changes the records `onRecordsChanged`, and a merged merge request `onPullRequestClosed`
  (MOD-runtimes.md:138-145). Such a push is both events. The agent's job keeps its records rule and so still runs
  `onRecordsChanged`, and `writeResult` writes that entry's result.
  - TST-1289001 (1) asserts only the jobs that write. The agent's rule is asserted by TST-472724. Right.
- **The job that holds the person's token now also starts on a push to a branch other than the default one.**
  - That job runs no agent, and checks out the instance at the commit the file names. So A HOSTED JOB WRITES WITH THE
    PERSON'S TOKEN FROM A CI SECRET (SPEC.md:790-798) still holds: "the token is read only on a runner machine on which
    no agent works".
  - Its start from the page or the API (`web`, `api`) already ran it on any ref.
  - Whoever may push a branch may already change that branch's `.gitlab-ci.yml`. So no one gains a reach to the token
    that they did not have.
  - Noted for the review: it adds one listing of the merged merge requests per push of any branch
    (`listPullRequests`, `product.mjs:948`).

## Noted

- developer-sonnet-l writes ITM-1289's release tests (`docs/backlog/sprints/team1/120.md`, Selection).
