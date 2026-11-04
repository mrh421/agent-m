---
id: ARC-039
title: The workflows
refines: ARC-037
forced_by:
  - ONE DEFINITION, THREE DRIVERS
  - A RUNTIME IS INTERCHANGEABLE
  - AGENT M WORKS WITHOUT A LOCAL INSTALLATION
  - A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
  - A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
  - A SELF-HOSTED RUNNER SERVES AGENT M ONLY FROM A PRIVATE REPOSITORY
  - A CI AGENT'S DRAFT ENTERS AS OPEN
  - A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
  - A JOB STOPS AT EVERY GATE
  - A GATE NAMES WHO DECIDES IT
  - A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
  - A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF
  - WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE
  - A STALE APPROVAL IS NOT APPLIED
  - AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
  - THE BRIDGE IS SIGNED BY ITS PUBLISHER
  - UC-004
  - UC-006
  - UC-010
  - UC-019
  - UC-024
  - UC-034
  - UC-041
  - UC-043
  - UC-049
designs:
  - MOD-workflow-entries
---
# ARC-039 The workflows

## Context

Two kinds of work happen when nobody's browser is open. In each product repository, jobs of CI agents run in the
product's own CI, gates decided by a CI check must be recorded, the Definition of
Done must be checked on every pull request, and a sprint an agent closes must start when it ends (UC-010, UC-024,
UC-034, UC-041, UC-043). In the instance repository, an approval of the instance's own SPEC committed without a token
must be applied, EU legal texts must be fetched, and the Bridge must be built and signed on a release (UC-004, UC-006,
UC-044). All of it must run the same modules the page runs (`ONE DEFINITION, THREE DRIVERS`).

## Decision

The Workflows are the CI driver of ARC-037: **one module of entry points that compose the shared modules for one event
each**, run by Node in GitHub Actions or GitLab CI. The entries of a product's job workflow and those of the instance's
own workflows are of the same kind — read the event, compose, act, end with a status —, so they are one module. The
workflow files that call them are generated for products by MOD-runtimes (the job workflow) and MOD-test-schedule (the test configuration, with the Definition-of-Done check), and kept for the
instance under `.github/workflows/`. A product's workflow runs the modules of the instance repository at the commit its
file names; it reads the person's token and the participant's key only from the product's CI secrets.

### Responsibility within the system

Running in a product's CI: taking and running the queued jobs of CI routes, resuming them after their gate, recording the decision of gates a CI check decides, running a test job's share
of the product's tests with its own command, recording each test run's outcomes, checking pull requests against the
Definition of Done, and the events in time — a sprint's end. Running in the CI of a product and of the instance alike: storing,
for each commit of the default branch, what its pages read. Running in the instance's CI: applying approved
changes of the instance's own SPEC, fetching legal texts, building and publishing the Bridge.

### The interface it offers

| Module | Entry points CI runs |
|---|---|
| MOD-workflow-entries | in a product: `onRecordsChanged`, `onDoneCheck`, `onPullRequestClosed`, `onCheckCompleted`, `runTests`, `onTestsFinished`, `onSchedule`, `onDispatch`; in the instance: `onApprovalsCommitted`, `onSourcesCommitted`, `onReleaseTagged`; in both: `onMainChanged` |

Every entry reads its event, its secrets and the repository it runs in from the CI's environment, does its work through
the shared modules and ends with a status CI shows; it keeps nothing between runs.

### Its modules

| Module | Folder | Responsibility |
|---|---|---|
| MOD-workflow-entries | `src/workflow-entries/` | the entries of Agent M's job workflow in a product — on a commit to `docs/jobs/` or `docs/gates/`, take and run or resume the queued jobs of the CI route; on a pull request merged or closed, closing its issues with links and, on GitLab, the pipeline schedule; on a completed CI check that decides a gate, its gate record; on a schedule, the events in time; on dispatch, a job started from GitHub's Actions page, or one a conversation of the prompt bar handed over, run with the task its start carries and written to no file —, the entries the generated test configuration calls — a row's share of the tests run with the product's own command, on a machine without the token, the Definition-of-Done check of a pull request, and the result record of a test run —, and the entries of the instance's workflows — applying approval records of the instance's SPEC that the dashboard did not apply; fetching an EU legal text when its register entry asks for it; building the Bridge's release with MOD-bridge-build. It works on the repository it runs in through two of Access's adapters with the same person's token from a CI secret: the local clone of the checkout for files and commits, the server's API for pull requests, issues, checks and releases |

```mermaid
flowchart LR
  ev1["push to docs/jobs or docs/gates"] --> WE[MOD-workflow-entries]
  ev2["pull request merged or closed"] --> WE
  ev2b["the test configuration: Definition of Done, test results"] --> WE
  ev3["CI check completed"] --> WE
  ev4["schedule"] --> WE
  ev5["approval record pushed"] --> WE
  ev6["source entry pushed"] --> WE
  ev7["release tag"] --> WE
  WE --> run["Participants and jobs, Process"]
  WE --> svc["Specification and design, Tests and releases, Issues and mail, Sources and resources, the Bridge's build"]
```

## Alternatives

- **A separate implementation of jobs for CI, for example in Python.** Rejected: `ONE DEFINITION, THREE DRIVERS`; the
  instance's workflow applies an approved change of its SPEC with the same functions the dashboard uses.
- **A long-running workflow that waits at a gate.** Rejected: a gate may wait for days, longer than a CI job should run;
  a job stops at its gate and is resumed by the next event.
- **Separate modules for a product's and the instance's workflows.** Rejected: both are entries of the same shape; one
  module keeps the composition of the shared modules in one place.
- **A published package or action that products install.** Rejected: the instance is the product's Agent M; its own
  repository at a named commit is what a product's workflow runs, without a registry in between.

## Consequences

- A product's job workflow needs two CI secrets — the person's Agent M token and the agent's key — named by the
  dashboard, never asked for.
- Every append to a job record or a gate record starts a short run of the job workflow, which usually finds nothing to
  do; the test configuration starts none for such a commit (`A JOB RECORD STARTS NO CI RUN`).
- Jobs of CI agents run while nobody is online; scheduled workflows of public repositories may be paused by the
  server after inactivity, which the schedule page names (UC-027).
- Agent M's own development does not change a product's behaviour until the product's workflow is moved to a newer commit
  of the instance.
