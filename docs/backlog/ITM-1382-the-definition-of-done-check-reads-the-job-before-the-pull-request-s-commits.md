---
id: ITM-1382
title: The Definition of Done check reads the job before the pull request's commits
level: module
realises:
  - A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
  - A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
modules:
  - MOD-workflow-entries
builds_on:
  - ITM-1381
tests:
  - unit
origin:
  - the cancelled `agent-m done` of the sprint pull request #1670 (runs 41309166410, 41310248681, 41315557790), ruled at team1's sprint 141 merge gate (docs/gates/20261101-1430-retrospective-sprint-planning-h141.md)
---
# ITM-1382 The Definition of Done check reads the job before the pull request's commits

**REGISTER**

## Outcome

`onDoneCheck` (`src/workflow-entries/product.mjs:916-918`) calls `pullRequestFacts(number)` before it reads the job's
identifier from the pull request's title and body. `pullRequestFacts` reads each commit's checks and changes one after
another (`src/repository-hosts/github.mjs:610-625`), so on a pull request of many commits that names no job — a sprint
branch's into `main`, 100 commits — the step is cancelled by the job's limit of two minutes
(`.github/workflows/agent-m-tests.yml:1145`) before it can answer that it has nothing to do.

## Acceptance

- `onDoneCheck` reads the job's identifier from the event's pull request (its title and body, as `eventPullRequest` reads
  them) first, and a pull request that names no job ends with *nothing to do* without reading its commits.
- A pull request that names a job is checked as before.
- The pinned instance commit of the product's CI moves to the merged code only through MOD-test-schedule's own step; that
  move is not this item's.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
