---
id: ITM-1239
title: Claude Code reports its usage
level: module
realises:
  - NO COST IS GUESSED
  - A RUN HAS LIMITS FIXED AT ITS START
  - A LOCAL AGENT USES THE PERSON'S OWN LOGIN
modules:
  - MOD-agent-processes
builds_on:
  - ITM-1230
tests:
  - unit
origin:
  - the live test of the Bridge with Claude Code 2.1.292 on akmaier's Mac (akmaier: "I allow the Claude test"): `/v1/ask` answered `{"state":"done","text":"Blue","calls":[],"usage":null,"error":null}`
---
# ITM-1239 Claude Code reports its usage

**REGISTER**

## Outcome

MOD-agent-processes.md:78: the driver "returns its final answer and the usage it reported, or `null` usage";
MOD-job-runner.md:228-229: `Usage` is "exactly what a runtime reported". Claude Code reports its usage, but the register
never asks for it, so every Claude job's usage, and with it a run's reported cost, is unknown.

Data flow: `src/bridge-jobs/handlers.mjs:97-100` takes `{ text, usage }` from `drafted()` → `agentDriver(...).send`
(`src/agent-processes/processes.mjs:157`) → `usageFor(row.task, stdout)` (`src/agent-processes/index.mjs:86-99`), whose
first line returns `null` where the row has no `usage` rule (`:87`). The claude row's Task cell
(`src/agent-processes/agents.md:9`) is `{"args":["-p"],"finalAnswer":{"format":"text","oneWord":true}}`: no `usage`, and
no output format, so `claude -p` prints the answer alone.

Measured on this Mac, Claude Code 2.1.292: `claude -p --output-format json` with the prompt on stdin prints one line, a
JSON object with `"type":"result"`, the answer in `result`, and `usage.input_tokens`, `usage.output_tokens`; status 0.

The claude row's Task cell asks for that output and reads it with the register's existing rules, as opencode's row does:
`--output-format json`; `finalAnswer` `json-lines` on the event `result`, path `["result"]`; `usage` on the event
`result`, path `["usage"]`, `input_tokens` and `output_tokens`. This is a changed row of the register (MOD-agent-processes,
Data: "a changed CLI is a changed row"); the code changes only where a rule form the row needs is missing. The cost
Claude Code reports (`total_cost_usd`) is not mapped; the register's usage rule has no form for it, and the cost stays
unknown (`NO COST IS GUESSED`).

## Acceptance

- Unit tests naming MOD-agent-processes, with a fixture `claude` on a controlled path that prints Claude Code's `result`
  line: the driver returns the answer and `{ inputTokens, outputTokens }` as printed, `minutes` and `cost` `null`; the
  arguments include `--output-format json`. TST-321001, which expects `["-p"]` and `usage: null`, is changed to the new row.
  Counter-proof: before the change the usage is `null`.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/agent-processes/` and the tests that name MOD-agent-processes change. A test of another module whose fake
  `claude` prints plain text and breaks is reported, not fixed (another participant fixes it).
