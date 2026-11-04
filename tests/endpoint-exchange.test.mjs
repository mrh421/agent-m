// Module: MOD-endpoint-calls
// Level: unit
// Guards: UC-003; UC-049; NO COST IS GUESSED; AN UNSUPPORTED ENDPOINT SAYS SO
// Constructed provider replies only; no network, paid service, document-derived oracle or tool execution.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as endpoints from "../src/endpoint-calls/index.mjs";

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/endpoint-calls/tool-exchanges.json", import.meta.url), "utf8"));
const INPUT = { prompt: "Known positive.", parts: [], output: null, findings: [], previous: null, workdir: null };
const PROBE = { name: "agent_m_probe", description: "Report that tool calling works without changing anything.", input: { type: "object", properties: {}, additionalProperties: false } };

function withFetch(t, handler) {
  const previous = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => { globalThis.fetch = previous; });
}

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const textReply = (kind, text) => kind === "anthropic" ? { content: [{ type: "text", text }] } : { choices: [{ message: { content: text } }] };
function exchange(config, input) {
  assert.equal(typeof endpoints.endpointExchange, "function", "public endpointExchange is available before its behavior is exercised");
  return endpoints.endpointExchange(config, input);
}

async function driverControl(t, provider) {
  const calls = [], { config } = fixtures[provider];
  withFetch(t, async (url, init) => { calls.push({ url, init }); return reply(200, textReply(config.kind, "Known answer.")); });
  const result = await endpoints.endpointDriver(config, { name: "fixture-participant" }).send(INPUT);
  assert.deepEqual(result, { text: "Known answer.", usage: null });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${config.baseUrl}/${provider === "openai" ? "chat/completions" : "messages"}`);
  assert.equal(JSON.parse(calls[0].init.body).messages[0].content, "Known positive.");
}

// TST-487001 · level: unit · module: MOD-endpoint-calls
// guards: NO COST IS GUESSED; UC-049
// given: the existing OpenAI-compatible driver and a constructed text answer without usage
// input: send the prepared Known positive. prompt through the public driver
// expect: exactly one chat request; Known answer. and null usage
test("TST-487001: OpenAI existing driver is a positive public transport control", async (t) => driverControl(t, "openai"));

// TST-487002 · level: unit · module: MOD-endpoint-calls
// guards: NO COST IS GUESSED; UC-049
// given: the existing Anthropic driver and a constructed text answer without usage
// input: send the prepared Known positive. prompt through the public driver
// expect: exactly one Messages request; Known answer. and null usage
test("TST-487002: Anthropic existing driver is a positive public transport control", async (t) => driverControl(t, "anthropic"));

async function historyCase(t, provider) {
  const calls = [], fixture = fixtures[provider], input = structuredClone(fixtures.exchange), before = structuredClone(input);
  withFetch(t, async (url, init) => { calls.push({ url, init }); return reply(200, fixture.response); });
  assert.deepEqual(await exchange(fixture.config, input), fixture.answer);
  assert.equal(calls.length, 1, "one exchange returns proposed calls without following or executing them");
  assert.equal(calls[0].url, `${fixture.config.baseUrl}/${provider === "openai" ? "chat/completions" : "messages"}`);
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), fixture.request, "literal provider history and tool-schema oracle");
  assert.equal(calls[0].url.includes(fixture.config.key), false);
  assert.equal(calls[0].init.body.includes(fixture.config.key), false);
  assert.equal(calls[0].init.headers[provider === "openai" ? "Authorization" : "x-api-key"], provider === "openai" ? `Bearer ${fixture.config.key}` : fixture.config.key);
  assert.deepEqual(input, before, "the public exchange does not mutate its caller's history");
}

// TST-487003 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; NO COST IS GUESSED; A CREDENTIAL IS NEVER PLACED IN A URL
// given: the JSON fixture's user/assistant/two correlated tool results and two returned OpenAI calls
// input: endpointExchange with the literal exchange and offered read_file schema
// expect: one exact chat body, two parsed calls, Inspecting., reported 13/5 tokens; no follow-up or input mutation
test("TST-487003: OpenAI exchange preserves tool history, calls and reported usage", async (t) => historyCase(t, "openai"));

// TST-487004 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; NO COST IS GUESSED; A CREDENTIAL IS NEVER PLACED IN A URL
// given: the JSON fixture's history with two tool results and mixed Anthropic text/tool_use blocks
// input: endpointExchange with the literal exchange and offered read_file schema
// expect: one exact Messages body with grouped tool_result blocks first, both calls, concatenated text and 17/7 tokens
test("TST-487004: Anthropic exchange preserves correlated blocks, all text and usage", async (t) => historyCase(t, "anthropic"));

// TST-487005 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; NO COST IS GUESSED
// given: an OpenAI response reporting zero input tokens and no output tokens, without calls
// input: one exchange offering no tools
// expect: text Only text., calls [], inputTokens 0, outputTokens/minutes/cost null and one unchanged user message
test("TST-487005: OpenAI empty call list preserves zero and unknown usage separately", async (t) => {
  const calls = [];
  withFetch(t, async (_url, init) => { calls.push(init); return reply(200, { ...textReply("openai-compatible", "Only text."), usage: { prompt_tokens: 0 } }); });
  assert.deepEqual(await exchange(fixtures.openai.config, { messages: [{ role: "user", text: "Finish." }], tools: [] }), {
    text: "Only text.", calls: [], usage: { inputTokens: 0, outputTokens: null, minutes: null, cost: null },
  });
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].body), { model: "fixture-model", messages: [{ role: "user", content: "Finish." }], stream: false });
});

// TST-487006 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; NO COST IS GUESSED
// given: an Anthropic response with no tool_use blocks and no usage
// input: one exchange offering no tools
// expect: text Only text., calls [], usage null; one Messages request, never a usage or cost estimate
test("TST-487006: Anthropic text-only exchange reports absent usage as null", async (t) => {
  const calls = [];
  withFetch(t, async (_url, init) => { calls.push(init); return reply(200, textReply("anthropic", "Only text.")); });
  assert.deepEqual(await exchange(fixtures.anthropic.config, { messages: [{ role: "user", text: "Finish." }], tools: [] }), { text: "Only text.", calls: [], usage: null });
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(calls[0].body), { model: "fixture-model", max_tokens: 1024, messages: [{ role: "user", content: "Finish." }] });
});

async function failureCase(t, provider) {
  let next = { status: 200, body: textReply(fixtures[provider].config.kind, "Positive.") }, calls = 0;
  withFetch(t, async () => { calls += 1; if (next.error) throw next.error; return { ...reply(next.status, next.body), headers: new Headers({ "retry-after-ms": "0" }) }; });
  const input = { messages: [{ role: "user", text: "Do not cut this input." }], tools: [] };
  assert.equal((await exchange(fixtures[provider].config, input)).text, "Positive.", "same-call positive before refusals");
  for (const [status, message, reason, requests] of [[401, "Key refused.", "key refused", 1], [413, "Input too long.", "too long", 1], [429, "Rate limit reached.", "rate limited", 6], [500, "Provider unavailable.", "endpoint error", 6]]) {
    next = { status, body: { error: { message } } };
    const before = calls;
    await assert.rejects(exchange(fixtures[provider].config, input), (error) => {
      assert.equal(error.name, "EndpointFailed");
      assert.deepEqual(error.diagnosis, { reason, message, routes: [] });
      return true;
    });
    assert.equal(calls, before + requests, requests === 1 ? "a refusal is not repeated" : "a rate limit and a server error are retried five times");
  }
  // A network error is retried too, after 2 s, 4 s, 8 s, 16 s and 30 s: the test's timers are mocked and advanced until the exchange ends.
  t.mock.timers.enable({ apis: ["setTimeout"] });
  next = { error: new TypeError("connect ECONNREFUSED") };
  const before = calls;
  let settled = false;
  const failing = exchange(fixtures[provider].config, input).then(() => null, (error) => error).finally(() => { settled = true; });
  for (let step = 0; step < 400 && !settled; step++) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(1000);
  }
  const error = await failing;
  assert.ok(error?.name === "EndpointFailed" && error.diagnosis.reason === "not reachable" && error.diagnosis.message === "connect ECONNREFUSED", String(error));
  assert.equal(calls, before + 6);
}

// TST-487007 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; AN UNSUPPORTED ENDPOINT SAYS SO
// given: one successful OpenAI exchange followed by constructed key, length, rate, provider and network failures, each answer with retry-after-ms 0
// input: the same public exchange for each refusal
// expect: EndpointFailed with the exact diagnosis/message; one request for a refused key and for a too-long input; six — the request and five retries — for a rate limit, a provider error and a network error
test("TST-487007: OpenAI exchange failures preserve their diagnosis, retried only where opencode retries", async (t) => failureCase(t, "openai"));

// TST-487008 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; AN UNSUPPORTED ENDPOINT SAYS SO
// given: one successful Anthropic exchange followed by constructed key, length, rate, provider and network failures, each answer with retry-after-ms 0
// input: the same public exchange for each refusal
// expect: EndpointFailed with the exact diagnosis/message; one request for a refused key and for a too-long input; six — the request and five retries — for a rate limit, a provider error and a network error
test("TST-487008: Anthropic exchange failures preserve their diagnosis, retried only where opencode retries", async (t) => failureCase(t, "anthropic"));

async function probeCase(t, provider, mode) {
  const { config } = fixtures[provider], calls = [];
  let response;
  if (mode === "called") response = provider === "openai"
    ? reply(200, { choices: [{ message: { content: null, tool_calls: [{ id: "probe-call", type: "function", function: { name: "agent_m_probe", arguments: "{}" } }] } }] })
    : reply(200, { content: [{ type: "tool_use", id: "probe-call", name: "agent_m_probe", input: {} }] });
  else if (mode === "text") response = reply(200, textReply(config.kind, "Text only."));
  else response = reply(400, { error: { type: "invalid_request_error", param: "tools", message: "This model does not support tools." } });
  withFetch(t, async (url, init) => { calls.push({ url, init }); return response; });
  assert.deepEqual(await endpoints.testEndpoint(config), { works: true, model: "fixture-model", tools: mode === "called",
    toolMessage: mode === "called" ? null : mode === "text" ? "Text only." : "This model does not support tools." });
  assert.equal(calls.length, 1, "one capability probe executes no tool and makes no fallback request");
  const body = JSON.parse(calls[0].init.body);
  assert.deepEqual(body.messages, [{ role: "user", content: "Call agent_m_probe once. It is a harmless capability check." }]);
  assert.equal(body.max_tokens, 64);
  assert.deepEqual(body.tools, provider === "openai"
    ? [{ type: "function", function: { name: PROBE.name, description: PROBE.description, parameters: PROBE.input } }]
    : [{ name: PROBE.name, description: PROBE.description, input_schema: PROBE.input }]);
}

// TST-487009 · level: unit · module: MOD-endpoint-calls
// guards: UC-003
// given: an OpenAI-compatible fixture returns the offered harmless agent_m_probe call
// input: testEndpoint(config)
// expect: works true, tools true, toolMessage null, one short request and no executed call
test("TST-487009: OpenAI capability probe recognizes an actual tool call", async (t) => probeCase(t, "openai", "called"));

// TST-487010 · level: unit · module: MOD-endpoint-calls
// guards: UC-003
// given: an OpenAI-compatible fixture answers Text only. without calling the offered tool
// input: testEndpoint(config)
// expect: works true, tools false and toolMessage Text only., without retry
test("TST-487010: OpenAI capability probe keeps a text-only answer", async (t) => probeCase(t, "openai", "text"));

// TST-487011 · level: unit · module: MOD-endpoint-calls
// guards: UC-003
// given: an OpenAI-compatible fixture rejects the tools parameter with its explicit unsupported-tool message
// input: testEndpoint(config)
// expect: working text-only configuration and the exact message, not a refused key or a fallback call
test("TST-487011: OpenAI tool rejection is a working text-only configuration", async (t) => probeCase(t, "openai", "refused"));

// TST-487012 · level: unit · module: MOD-endpoint-calls
// guards: UC-003
// given: an Anthropic fixture returns the offered harmless agent_m_probe tool_use block
// input: testEndpoint(config)
// expect: works true, tools true, toolMessage null, one short request and no executed call
test("TST-487012: Anthropic capability probe recognizes an actual tool use", async (t) => probeCase(t, "anthropic", "called"));

// TST-487013 · level: unit · module: MOD-endpoint-calls
// guards: UC-003
// given: an Anthropic fixture answers Text only. without calling the offered tool
// input: testEndpoint(config)
// expect: works true, tools false and toolMessage Text only., without retry
test("TST-487013: Anthropic capability probe keeps a text-only answer", async (t) => probeCase(t, "anthropic", "text"));

// TST-487014 · level: unit · module: MOD-endpoint-calls
// guards: UC-003
// given: an Anthropic fixture rejects the tools parameter with its explicit unsupported-tool message
// input: testEndpoint(config)
// expect: working text-only configuration and the exact message, not a refused key or a fallback call
test("TST-487014: Anthropic tool rejection is a working text-only configuration", async (t) => probeCase(t, "anthropic", "refused"));
