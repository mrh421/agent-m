---
id: ITM-1383
title: Every release shard of a pull request finishes within two minutes
level: module
realises:
  - A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
modules:
  - MOD-test-schedule
builds_on:
  - ITM-373
  - ITM-1382
tests:
  - unit
origin:
  - the cancelled `release-pull-request (7)` of #1663 and #1670 (runs 41305048154, 41309166410), noted in team1's sprint 141 release gate (docs/gates/20261101-1313-release-testing-sprint-review-r141.md)
---
# ITM-1383 Every release shard of a pull request finishes within two minutes

**REGISTER**

## Outcome

`release-pull-request (7)` took 82 s at ITM-373's gate and 120 s on #1670, and the limit of two minutes cancelled it on
#1663 and #1670 with no step failed. The batteries of sprint 141 added release files to the row `release`, whose shards
the instance's schedule declares (`docs/tests/schedule.md`, MOD-test-schedule).

## Acceptance

- Before the job starts, its probe measures each release shard's time on a pull request run and names the files of the
  slowest.
- The row `release` gets the shards, or the partition, that keeps each of its pull-request jobs under the limit with a
  margin, through the schedule and the configuration generated from it.
- The configuration is generated on a commit that holds ITM-1382, so its pinned instance commit (`instanceCommit`,
  MOD-test-schedule's `ciConfiguration`) moves to one whose Definition of Done check reads the job first.
- No expected result changes. It adds no behaviour, so it begins without a failing test.
