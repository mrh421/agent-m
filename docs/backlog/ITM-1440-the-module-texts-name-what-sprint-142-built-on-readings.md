---
id: ITM-1440
title: The module texts name what sprint 142 built on readings
level: system
realises:
  - A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES
  - AN INTERFACE STATES ITS TYPES
  - A DATA FORMAT IS DEFINED ONCE
modules:
  - MOD-release-evidence
  - MOD-work-plans
  - MOD-product-process
  - MOD-runtimes
  - MOD-result-records
  - MOD-test-document
  - MOD-job-runner
  - MOD-site-frame
  - MOD-review-pages
  - MOD-implementation-pages
  - MOD-test-pages
builds_on: []
tests:
  - unit
origin:
  - the readings team1's sprint 142 took where a module text named less than the code it built, each noted for akmaier at its gate; akmaier's direction that a module change is presented on the dashboard
---
# ITM-1440 The module texts name what sprint 142 built on readings

**REGISTER**

## Outcome

In sprint 142, items were built on readings where a module's accepted text named less than the code needed: an added
field, an added input, an added export, a condition, a use. Each gate noted the gap. A module file changes only when a
person accepts it on the dashboard (`A MODULE FILE IS REVIEWED AS AN ARCHITECTURE DECISION IS`). So this item drafts the
changes into `docs/architecture/`, where each changed file shows as open until accepted. It changes no code.

The drafts, each with the gate record that noted it:
- **MOD-release-evidence:** each test of `auditRows` with `passed` and `lastRate` (ITM-1430); the row's `artifacts`
  (ITM-1431); the optional input `unrecorded` and the row's field of gates no record holds (ITM-1433).
- **MOD-work-plans:** `ItemState`: a job a rejected gate ended leaves its item *ready* with the rejection's reason
  (ITM-1416).
- **MOD-product-process and MOD-runtimes:** a rejected gate record ends its job, as a passed one resumes it (ITM-1412).
- **MOD-runtimes, Uses:** `MOD-documents.artifactSchemas` (ITM-1411).
- **MOD-result-records, Uses:** `MOD-identifiers.kindOfIdentifier`, so that `test-proposals` tells a module from a test by
  it rather than by its own copy (ITM-1425).
- **MOD-test-document:** `TestDeclaration.id` may be `null`, as its Data's "a declaration missing a key is read with that
  key `null`" allows. Also one function that gives the blocks of a test file that look like a declaration but name no
  identifier, with path and line (ITM-1414), so that ITM-1414 can be built once accepted.
- **MOD-job-runner:** the correction loop asks its reviewers only for a draft its checks find complete (ITM-1395).
- **MOD-site-frame, Interfaces:** `routeProblem`, what stands in place of a route that cannot be drawn (ITM-1401).
- **MOD-review-pages:** the drafting page names a changed source and links registering its new version (ITM-1389).
- **MOD-implementation-pages:** *Start sprint work* on the backlog and the progress page (ITM-1408).
- **MOD-test-pages:** the generation page's acceptance through MOD-approvals' `statuses` (ITM-1423).

## Not in this item

- The shared definition of "accepted", whose rule now stands in `progress-measures/facts.mjs:235`,
  `implementation-pages/backlog.mjs:101` and MOD-work-plans' `sprint-facts` (ITM-1405). Where it would live depends on the
  modules' uses, so it is a design of its own, not a text that names built code.
- The SPEC packages and UC-018's step 6, whose texts are already drafted.

## Acceptance

- Each module file named above holds its draft, written from the code and the gate record that noted it. It names
  nothing the code does not do, and leaves out nothing the record names.
- Each draft follows the file's own form and the SPEC's rules for a module's file. No other text of the file changes.
- No code, test or other file changes; CI is green on every commit.
- The drafts are committed so that each changed file shows as open on the dashboard. The pull request names each file
  and the record it answers.
