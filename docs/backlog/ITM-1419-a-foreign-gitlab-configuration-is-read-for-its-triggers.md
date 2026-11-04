---
id: ITM-1419
title: A foreign GitLab configuration is read for its triggers
level: module
realises:
  - UC-027
  - THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE
modules:
  - MOD-test-schedule
builds_on:
  - ITM-772
tests:
  - unit
origin:
  - UC027-F2, TST-772210 of ITM-772's system tests of UC-027 (#1715), ruled at its gate in team1's sprint 142 (docs/gates/20261102-0829-development-release-testing-0772.md)
---
# ITM-1419 A foreign GitLab configuration is read for its triggers

**REGISTER**

## Outcome

MOD-test-schedule's `configurationDrift` gives, "for a configuration Agent M did not generate, the triggers it has and which
rows they run, as far as they can be read". For a foreign GitHub workflow it names them. For a foreign `.gitlab-ci.yml` it
names only that the include entry is missing.

## Acceptance

- For a `.gitlab-ci.yml` that Agent M did not generate, `configurationDrift` names the triggers it has (its `rules`,
  `only`/`except` or `workflow` conditions, as far as they can be read) and which rows they run, besides the missing
  include.
- TST-772210 loses its `todo` in a commit by a participant other than the implementer, written after the code is pushed.
- No other existing expected result changes, unless a probe names it and the accepted text allows it.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
