---
id: ITM-1251
title: The pull-request tests pass again with agents enclosed
level: module
realises:
  - UC-011
  - NO MODEL READS A CREDENTIAL
modules:
  - MOD-agent-processes
  - MOD-desktop-shell
  - MOD-agent-enclosure
builds_on: []
tests:
  - unit
  - component
origin:
  - the scrum master, from PR #1376's run 40563237104 on its head merged with main at 1e48fc52; main's push runs run only setup and records, so the break shows on pull requests only
---
# ITM-1251 The pull-request tests pass again with agents enclosed

**REGISTER**

## Outcome

Since a51bf7a8 ("every agent a Bridge starts runs enclosed", ARC-054 and MOD-agent-enclosure, accepted in 1e48fc52), every pull
request's run of "agent-m tests" fails in two jobs:

- `unit-pull-request (2)`: `tests/agent-processes-320.test.mjs:165`, "TST-320003: unique fault target". The fault's needle at
  `:35` ends in `"Reply with one word: ok.");`; `src/agent-processes/index.mjs:153` now passes a fifth argument, `enclosed`, so
  the needle matches no line.
- `component-pull-request (1)`: TST-367004 and TST-367006 (`tests/desktop-shell-bridge-jobs.test.mjs`) expect `state: done`;
  the job ends `failed` with "bubblewrap (bwrap) is not installed on this computer".

The tests follow the accepted texts again: TST-320003's fault targets the line as it is, and the Bridge's jobs in the component
tests run enclosed as MOD-agent-enclosure states, or the runner provides what the enclosure needs, as the accepted texts allow.

## Acceptance

- On a pull request, `unit-pull-request` and `component-pull-request` pass, with TST-320003, TST-367004 and TST-367006 run, not
  skipped. Counter-proof: TST-320003's fault still turns the test red.
- No test is weakened to pass without the enclosure where the accepted texts require it.
- Only the tests that name these modules, and the workflow's setup where needed, change.
