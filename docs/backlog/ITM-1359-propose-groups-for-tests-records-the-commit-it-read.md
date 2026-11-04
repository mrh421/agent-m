---
id: ITM-1359
title: Propose groups for tests records the commit it read
level: module
realises:
  - UC-021
  - A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
modules:
  - MOD-review-pages
builds_on:
  - ITM-738
tests:
  - unit
origin:
  - finding F5 of ITM-738's system and release tests TST-738022 and TST-738118 (#1629), ruled at its gate in team1's sprint 141 (docs/gates/20261101-1545-development-release-testing-0738.md)
---
# ITM-1359 Propose groups for tests records the commit it read

**REGISTER**

## Outcome

UC-021 1b: *Propose groups*, with *Run*. For tests, the page hands the job's record the tests' identifiers as
`works_on` (`src/review-pages/arrange.mjs:338`). A job record's `works_on` holds "requirements, use cases, decisions,
modules, items, sources —, an issue's address or a commit" (MOD-job-ledger.md:70), and no test identifier. So the record is
refused, and *Run* fails.

## The reading taken

The job works on the version of the tests it read. So for the kind tests, `works_on` names the commit of the snapshot the
page read, which MOD-job-ledger's text allows. For the other kinds it stays as it is. The job record's form does not
change.

## Acceptance

- *Propose groups* on tests starts its job. The record's `works_on` is the commit the page read, and the proposal arrives
  as pending changes.
- For requirements, use cases, decisions and modules, `works_on` is as before.
- TST-738022 and TST-738118 lose their `todo`s in a commit by a participant other than the implementer, written after the
  code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
