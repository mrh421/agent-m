---
id: ITM-1243
title: An agent's usage is the sum of what each step reported
level: module
realises:
  - NO COST IS GUESSED
  - A RUN HAS LIMITS FIXED AT ITS START
modules:
  - MOD-agent-processes
builds_on:
  - ITM-1239
tests:
  - unit
origin:
  - akmaier: "Fix the known problems too." — the usage of an opencode job that called a tool counted one step only
---
# ITM-1243 An agent's usage is the sum of what each step reported

**REGISTER**

## Outcome

MOD-job-runner.md:228-229: `Usage` is "exactly what a runtime reported"; MOD-agent-processes.md:78: the driver returns
"the usage it reported". opencode reports usage per step: measured on this Mac, opencode 2.1.4 with `opencode/big-pickle`,
`opencode run --format json` with a task on standard input that reads two files printed `step_start`, two `tool_use`,
`step_finish` (reason `tool-calls`, `tokens` `{input, output, reasoning, cache}`), `step_start`, `text` — one
`step_finish` for each step that called tools; a task of several such steps prints several.

`usageFor` (`src/agent-processes/index.mjs:86-99`) keeps only the last matching event (`values.at(-1)`, `:91`), so a job
of several steps reports the tokens of one of them. It sums the matching events instead — each of input and output, a
count `null` only where no event reports it. A runtime that reports once, as Claude Code's `result` line, gives the same
as before.

## Acceptance

- Unit tests naming MOD-agent-processes, with a fixture `opencode` that prints two `step_finish` events with different
  tokens and a `text`: the usage is their sum; with one event, that event's counts; with none, `null`. Claude's single
  `result` line gives its counts as before. Counter-proof: before the change the two-step usage is the last step's.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/agent-processes/` and the tests that name MOD-agent-processes change.
