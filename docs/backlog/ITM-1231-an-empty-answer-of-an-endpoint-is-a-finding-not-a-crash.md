---
id: ITM-1231
title: An empty answer of an endpoint is a finding, not a crash
level: module
realises:
  - A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
modules:
  - MOD-endpoint-calls
builds_on: []
tests:
  - unit
origin:
  - akmaier: an endpoint that answers with empty content crashes the job ("Cannot read properties of null"), where it should be named
---
# ITM-1231 An empty answer of an endpoint is a finding, not a crash

**REGISTER**

## Outcome

A job whose model endpoint answers with no text — OpenAI-compatible `choices[0].message.content: null`, Anthropic
`content: []` — ends with `TypeError: Cannot read properties of null (reading 'trim')`. Path: `endpointDriver(...).send`
without tools (`src/endpoint-calls/index.mjs:190`) → `answerOf(body, kind)` (`:127-128`) returns `content` unguarded,
`null` (or `undefined` for Anthropic's `[]`) → `runJob` (`src/job-runner/loop.mjs:149-150`) → `readAnswer`
(`:60`) `text.trim()` throws. `Driver.send` promises `{ text: string, … }` (MOD-endpoint-calls; MOD-job-runner); the
tool path's `exchangeAnswer` (`index.mjs:146-148`) already gives `""`, and joins every Anthropic text part where
`answerOf` takes the first.

`send` returns its text as a string, extracted once, as `exchangeAnswer` does; an empty answer is then the runner's
finding "the answer cannot be read", sent back to the participant, and after the last round `unusable`, its `raw` kept
(MOD-job-runner, *Reading an answer*).

## Acceptance

- Unit tests naming MOD-endpoint-calls: a direct `send` against a local endpoint answering `content: null`
  (OpenAI-compatible) and `content: []` (Anthropic) gives `text === ""`; an Anthropic answer of two text parts gives them
  joined. A test that `runJob` over such a driver ends `unusable` with the finding, not a TypeError. Counter-proof:
  before the change the first gives `null` and `runJob` throws.
- The first commit holds only the tests, and CI is red on it. No stub is committed.
- Only `src/endpoint-calls/` and the tests that name MOD-endpoint-calls change.
