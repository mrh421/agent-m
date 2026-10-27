---
id: ITM-499
title: A push of conversation records starts no CI run
level: module
realises:
  - UC-049
  - A JOB RECORD STARTS NO CI RUN
modules:
  - MOD-test-schedule
builds_on:
tests:
  - unit
origin:
  - the architecture of the prompt bar, accepted by akmaier at 7e893c63 (110d2499)
  - MOD-test-schedule, Data: the generated CI configuration
built_by:
  - 9cc8ae23bd3f4d8595c64b7fb47ee83e82dc18f7
  - 505bb81403f9d1e3da34cf8743f9ff8b31be46b1
---
# ITM-499 A push of conversation records starts no CI run

**REGISTER**

## Outcome

The CI configuration MOD-test-schedule generates starts nothing on a push to the default branch that changes only files
under `docs/jobs/` or `docs/conversations/`.

## Acceptance

- The generated file ignores both folders for GitHub and GitLab; a push that also changes another file starts the
  run.

## Met before it was built (sprint team2/96)

developer-sonnet-g found the Acceptance already holds on `main`:
- ITM-744 (`505bb814`) and `9cc8ae23` built it;
- `tests/test-schedule-ci-configuration.test.mjs` pins both points, for GitHub and GitLab: a push of only `docs/jobs/` or
  `docs/conversations/` starts nothing, and one that also changes another file starts the run.

Three faults g planted in the generator were each caught. No test is added and no pull request is opened. The item
leaves sprint 96 as met, as team 1 did with ITM-1028.
