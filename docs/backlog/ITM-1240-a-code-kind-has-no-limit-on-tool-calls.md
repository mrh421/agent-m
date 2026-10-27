---
id: ITM-1240
title: A code kind has no limit on tool calls
level: module
realises:
  - UC-049
modules:
  - MOD-job-catalogue
  - MOD-job-runner
  - MOD-endpoint-calls
builds_on: []
tests:
  - unit
origin:
  - akmaier: "The tool limit of 200 calls per code job is wrong remove it"; the architecture draft 547bcaa6, accepted in 72945fdb
---
# ITM-1240 A code kind has no limit on tool calls

**REGISTER**

## Outcome

MOD-job-catalogue.md:70: `tool_limit` is "a number, or left out", and "left out, no number of calls ends the exchange";
:130: the code kinds have "no `tool_limit`"; :213: `toolLimit` is `null` wherever the definition leaves `tool_limit` out.
MOD-job-runner: `ToolUse.limit` is `number | null`. MOD-endpoint-calls.md:95: "Where `tools.limit` is a number, it makes at
most that many calls"; :102: the continuation of a cut answer counts as one call of the limit, "where there is one".

The code does otherwise:
- the code kinds' definitions state `tool_limit: 200`: `src/job-catalogue/kinds/{implement,refactor,fix-bug,write-tests,
  propose-tests,run-tests,check-resource}/kind.md`;
- `src/job-catalogue/definition.schema.md:18-19` names no form where `tool_limit` is left out with `tools` given;
- `src/job-catalogue/index.mjs:110` reads a left-out `tool_limit` as `0`, and the `KindDefinition` type at `:25` says
  `toolLimit: number`;
- `src/job-runner/tools.mjs:43` passes `kind.toolLimit` on as `limit`;
- `src/endpoint-calls/loop.mjs:102` (`atLimit`) and `:138` compare the calls made with `limit` as a number, so a `null`
  limit would refuse every call (`carriedOut >= null` is true for 0).

The code kinds leave `tool_limit` out; `toolLimit` is `null` where it is left out; the loop applies a limit only where it
is a number. The read-and-draft kinds keep their 30.

## Acceptance

- Unit tests naming the modules: each code kind's definition gives `toolLimit: null` and a read-and-draft kind 30; the
  runner's `ToolUse.limit` is `null` for a code kind; the loop with a `null` limit carries out more calls than any former
  limit (e.g. 250) and ends when the endpoint answers without a call; with a number it still stops at it. Counter-proof:
  before the change a code kind reads 200 and a `null` limit refuses the first call.
- Existing tests that assert 200 or the fallback 0 (`tests/job-catalogue-tools.test.mjs`, `tests/job-runner-tools.test.mjs`)
  are changed to the accepted texts.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/job-catalogue/`, `src/job-runner/`, `src/endpoint-calls/` and the tests that name these modules change;
  preloads, where needed, in a commit of their own.
