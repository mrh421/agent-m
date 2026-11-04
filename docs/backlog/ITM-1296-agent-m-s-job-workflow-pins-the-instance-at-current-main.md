---
id: ITM-1296
title: Agent M's job workflow pins the instance at current main
level: module
realises:
  - UC-010
modules:
  - MOD-runtimes
builds_on:
  - ITM-583
tests:
  - unit
origin:
  - akmaier's decision of 2026-10-29, given in the coordinator's chat and relayed by scrum-master-opus-c, to move the instance pin of agent-m-jobs from 6bbb3630 to current main
---
# ITM-1296 Agent M's job workflow pins the instance at current main

**REGISTER**

## Outcome

`.github/workflows/agent-m-jobs.yml` checks out the instance at `6bbb3630172840efbb3c8c0330b30a3e01570437` (`:56`, `:89`, `:142`,
`:192`), a commit before #1382 (ITM-583). That commit has no entry `onPullRequestClosed`. So every pull request closed or
merged since then ends its run with "onPullRequestClosed: failed — There is no entry onPullRequestClosed." (for example run
40812375654).

MOD-runtimes.md:224: "Moving a product to a newer commit of the instance is writing the files again, on a person's
decision." akmaier has made that decision. The files are written again with MOD-runtimes' `jobWorkflowFiles`
(`src/runtimes/ci.mjs:238`), at the commit of `main` the job starts from.
- The instance is the commit the file names.
- The secrets and the runners are those the current file names.
- Every file `jobWorkflowFiles` gives for GitHub is written, the one beside it among them, where it gives that one.

## Acceptance

- The committed files are exactly what `jobWorkflowFiles("github", { repository, commit }, secrets, runners)` gives at that
  commit. The pull request names the commit and the call.
- No new test. Writing the generated files again at a newer commit changes no code of Agent M. AN IMPLEMENTATION JOB
  BEGINS WITH A FAILING TEST binds "an implementation job that adds or changes behaviour" (SPEC.md:1462-1464). A test of
  the entries at the pinned commit cannot run in CI: `.github/workflows/agent-m-tests.yml` checks out one commit, so no
  older commit is readable (PR #1400, run 40820852823).
- A test of the committed file against the generator at the checkout is also not wanted. It would fail on every change of
  the templates, while the pin moves only "on a person's decision" (MOD-runtimes.md:224).
- After the merge of the sprint into `main`, the next pull request closed runs `onPullRequestClosed` without "There is no
  entry". The run is named in a section of the sprint's record after the merge. It can only come after the sprint's
  review and merge gates, so it is no condition of them. A run that still fails is a new item.
- Only the workflow files `jobWorkflowFiles` gives change. No code of `src/runtimes/` and no test changes.
