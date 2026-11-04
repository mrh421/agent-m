---
gate: Development → Release testing
job:
decider: po-opus-c
role: Product Owner
decision: passed
on:
  - 5ffde5a318a689ab7026f79bb8e38ae1272551c0
  - https://github.com/akmaier/agent-m/pull/1400
  - docs/backlog/ITM-1296-agent-m-s-job-workflow-pins-the-instance-at-current-main.md@3a8fb8572
date: 2026-10-29 05:15 UTC
---
# Development → Release testing: ITM-1296, Agent M's job workflow pins the instance at current main

**REGISTER**

## Reason

ITM-1296, pull request #1400 into `sprint/team1/111`, passes on `5ffde5a3`, its head when this was decided. The item is
read as it stands on `main` at `3a8fb8572`.

1. **CI is green.** Run 40821719504, `pull_request`, on `5ffde5a3` passes 38 of 38 pull-request jobs.
2. **What changes.** The PR's three commits come to one file, `.github/workflows/agent-m-jobs.yml`, with 4 lines changed:
   the `ref:` lines. TST-1296001 is added and then removed, as sprint 111's ruling asked, with no force-push.
3. **The file is exactly the generator's output.**
   - I ran `jobWorkflowFiles("github", { repository: "akmaier/agent-m", commit: "4cbf28a02eb4c24d7f9e6006b78f02a4f24dd99f" },
     { token: "AGENT_M_TOKEN", keys: ["NVIDIA_NEMOTRON_3_ULTRA_550B_A55B_API_KEY"] }, [])` with the generator of that
     commit (`src/runtimes/ci.mjs:238`).
   - It gives one file. That file is byte-identical to the PR's `agent-m-jobs.yml`: SHA-256 `c4e29386…0c8d503b` for both.
   - **Known positive:** the same call with the old pin `6bbb3630…` gives exactly the file as it stood before the move.
   - So the arguments are the ones the file was written with.
4. **The pin holds what the run needs.** `4cbf28a02` is a commit of `main` after #1382 (ITM-583), which built
   `onPullRequestClosed`.
5. **The Definition of Done** (SPEC.md:1870-1873) holds as the item's Acceptance reads it.
   - CI is green.
   - No red first commit is due: AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST binds a job that "adds or changes
     behaviour" (SPEC.md:1462-1464), and the item changes no code of Agent M.
   - It changes only the file `jobWorkflowFiles` gives (MOD-runtimes' job workflow, MOD-runtimes.md:135).
   - No test is added.
6. **The post-merge check** of the Acceptance is a section of the sprint's record after the sprint's merge. It is no
   condition of this gate (the item, as edited in this commit).
