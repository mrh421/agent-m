// Module: MOD-endpoint-calls
// Level: unit
// Guards: UC-049; ONE DEFINITION, THREE DRIVERS; NO COST IS GUESSED
// Constructed provider replies only; no network, paid service, document-derived oracle or real tool.
// Every expected value is stated in the test's own text.

import test from "node:test";
import assert from "node:assert/strict";
import { endpointDriver } from "../src/endpoint-calls/index.mjs";

const OPENAI = { name: "fixture-openai", kind: "openai-compatible", baseUrl: "https://openai.example.test/v1", model: "fixture-model", key: "fixture-openai-key" };
const ANTHROPIC = { name: "fixture-anthropic", kind: "anthropic", baseUrl: "https://anthropic.example.test/v1", model: "fixture-model", key: "fixture-anthropic-key" };
const PARTICIPANT = { name: "fixture-participant" };
const DEFINITION = { name: "read_file", description: "Read one fixture path.", input: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } };
const OPENAI_TOOLS = [{ type: "function", function: { name: "read_file", description: "Read one fixture path.", parameters: DEFINITION.input } }];
const ANTHROPIC_TOOLS = [{ name: "read_file", description: "Read one fixture path.", input_schema: DEFINITION.input }];

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

function withFetch(t, handler) {
  const previous = globalThis.fetch;
  globalThis.fetch = handler;
  t.after(() => { globalThis.fetch = previous; });
}

// A provider reply: text, calls [{ id, path }] of read_file, usage { in, out } or none.
function providerReply(kind, { text = "", calls = [], usage = null }) {
  if (kind === "anthropic") {
    return reply(200, {
      content: [...(text ? [{ type: "text", text }] : []), ...calls.map((call) => ({ type: "tool_use", id: call.id, name: "read_file", input: { path: call.path } }))],
      ...(usage ? { usage: { input_tokens: usage.in, output_tokens: usage.out } } : {}),
    });
  }
  return reply(200, {
    choices: [{ message: { content: text || null, ...(calls.length ? { tool_calls: calls.map((call) => ({ id: call.id, type: "function", function: { name: "read_file", arguments: JSON.stringify({ path: call.path }) } })) } : {}) } }],
    ...(usage ? { usage: { prompt_tokens: usage.in, completion_tokens: usage.out } } : {}),
  });
}

// Serves the replies in order and records each request's parsed body and the call order with the tool log.
function provider(t, kind, replies, log) {
  const bodies = [];
  withFetch(t, async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    log?.push(`request ${bodies.length}`);
    const next = replies[bodies.length - 1];
    if (typeof next === "function") return next();
    return next;
  });
  return bodies;
}

function toolUse({ limit = 10, results = {}, log = [], onCall = null } = {}) {
  return {
    definitions: [DEFINITION],
    limit,
    async call(name, args) {
      log.push(`call ${name} ${args.path}`);
      await onCall?.(args);
      return results[args.path] ?? `unexpected ${args.path}`;
    },
  };
}

const input = (tools) => ({ prompt: "Inspect the fixture.", parts: [], output: null, findings: [], previous: null, workdir: null, tools });
const send = (config, tools, options) => endpointDriver(config, PARTICIPANT).send(input(tools), options);

// TST-488001 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; ONE DEFINITION, THREE DRIVERS
// given: an OpenAI-compatible endpoint that first calls read_file on one.md and two.md in one answer, then answers Final answer.
// input: send a DriverInput carrying tools with limit 10 whose call returns "ONE" for one.md and "TWO" for two.md
// expect: text Final answer.; calls in order one.md then two.md, each after request 1 and before request 2; exactly two requests;
//   request 1 holds the user prompt, the read_file definition and max_tokens 32000; request 2 holds user, assistant with both calls, then tool ONE for call-a and tool TWO for call-b, and max_tokens 32000
test("TST-488001: OpenAI endpoint works in a tool loop, calls in order, results returned", async (t) => {
  const log = [];
  const bodies = provider(t, "openai", [
    providerReply("openai", { text: "Reading.", calls: [{ id: "call-a", path: "one.md" }, { id: "call-b", path: "two.md" }] }),
    providerReply("openai", { text: "Final answer." }),
  ], log);
  const result = await send(OPENAI, toolUse({ log, results: { "one.md": "ONE", "two.md": "TWO" } }));
  assert.equal(result.text, "Final answer.");
  assert.deepEqual(log, ["request 1", "call read_file one.md", "call read_file two.md", "request 2"]);
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies[0], { model: "fixture-model", max_tokens: 32000, messages: [{ role: "user", content: "Inspect the fixture." }], tools: OPENAI_TOOLS });
  assert.deepEqual(bodies[1], { model: "fixture-model", max_tokens: 32000, tools: OPENAI_TOOLS, messages: [
    { role: "user", content: "Inspect the fixture." },
    { role: "assistant", content: "Reading.", tool_calls: [
      { id: "call-a", type: "function", function: { name: "read_file", arguments: "{\"path\":\"one.md\"}" } },
      { id: "call-b", type: "function", function: { name: "read_file", arguments: "{\"path\":\"two.md\"}" } },
    ] },
    { role: "tool", content: "ONE", tool_call_id: "call-a" },
    { role: "tool", content: "TWO", tool_call_id: "call-b" },
  ] });
});

// TST-488002 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; ONE DEFINITION, THREE DRIVERS
// given: an Anthropic endpoint that first calls read_file on one.md and two.md in one answer, then answers Final answer.
// input: send a DriverInput carrying tools with limit 10 whose call returns "ONE" for one.md and "TWO" for two.md
// expect: text Final answer.; calls in order one.md then two.md between request 1 and request 2; request 2 holds the user prompt,
//   the assistant's text and both tool_use blocks, then one user turn with tool_result ONE for call-a and TWO for call-b; both requests carry max_tokens 32000
test("TST-488002: Anthropic endpoint works in a tool loop, calls in order, results returned", async (t) => {
  const log = [];
  const bodies = provider(t, "anthropic", [
    providerReply("anthropic", { text: "Reading.", calls: [{ id: "call-a", path: "one.md" }, { id: "call-b", path: "two.md" }] }),
    providerReply("anthropic", { text: "Final answer." }),
  ], log);
  const result = await send(ANTHROPIC, toolUse({ log, results: { "one.md": "ONE", "two.md": "TWO" } }));
  assert.equal(result.text, "Final answer.");
  assert.deepEqual(log, ["request 1", "call read_file one.md", "call read_file two.md", "request 2"]);
  assert.equal(bodies.length, 2);
  assert.deepEqual(bodies[0], { model: "fixture-model", max_tokens: 32000, messages: [{ role: "user", content: "Inspect the fixture." }], tools: ANTHROPIC_TOOLS });
  assert.deepEqual(bodies[1], { model: "fixture-model", max_tokens: 32000, tools: ANTHROPIC_TOOLS, messages: [
    { role: "user", content: "Inspect the fixture." },
    { role: "assistant", content: [
      { type: "text", text: "Reading." },
      { type: "tool_use", id: "call-a", name: "read_file", input: { path: "one.md" } },
      { type: "tool_use", id: "call-b", name: "read_file", input: { path: "two.md" } },
    ] },
    { role: "user", content: [
      { type: "tool_result", tool_use_id: "call-a", content: "ONE" },
      { type: "tool_result", tool_use_id: "call-b", content: "TWO" },
    ] },
  ] });
});

// TST-488003 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; NO COST IS GUESSED
// given: an OpenAI-compatible endpoint answering request 1 with a call and usage 10 in / 2 out, request 2 with a call and usage 20 in / 3 out, request 3 with the answer and usage 7 in / 1 out
// input: send with tools of limit 10
// expect: usage { inputTokens: 37, outputTokens: 6, minutes: null, cost: null }, the sum over the three requests
test("TST-488003: usage is the sum of what each request reported", async (t) => {
  provider(t, "openai", [
    providerReply("openai", { calls: [{ id: "c1", path: "one.md" }], usage: { in: 10, out: 2 } }),
    providerReply("openai", { calls: [{ id: "c2", path: "two.md" }], usage: { in: 20, out: 3 } }),
    providerReply("openai", { text: "Done.", usage: { in: 7, out: 1 } }),
  ]);
  const result = await send(OPENAI, toolUse({ results: { "one.md": "ONE", "two.md": "TWO" } }));
  assert.equal(result.text, "Done.");
  assert.deepEqual(result.usage, { inputTokens: 37, outputTokens: 6, minutes: null, cost: null });
});

// TST-488004 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; NO COST IS GUESSED
// given: an OpenAI-compatible endpoint whose request 1 reports no usage and whose request 2 reports 7 in / 3 out
// input: send with tools
// expect: usage { inputTokens: 7, outputTokens: 3, minutes: null, cost: null }, the requests that reported it only, never an estimate for request 1
test("TST-488004: a request without usage adds nothing and is not estimated", async (t) => {
  provider(t, "openai", [
    providerReply("openai", { calls: [{ id: "c1", path: "one.md" }] }),
    providerReply("openai", { text: "Done.", usage: { in: 7, out: 3 } }),
  ]);
  const result = await send(OPENAI, toolUse({ results: { "one.md": "ONE" } }));
  assert.deepEqual(result.usage, { inputTokens: 7, outputTokens: 3, minutes: null, cost: null });
});

// TST-488005 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; NO COST IS GUESSED
// given: an Anthropic endpoint whose two requests report no usage at all
// input: send with tools
// expect: usage null, not zero and not an object of nulls
test("TST-488005: usage is null when no request reported any", async (t) => {
  provider(t, "anthropic", [
    providerReply("anthropic", { calls: [{ id: "c1", path: "one.md" }] }),
    providerReply("anthropic", { text: "Done." }),
  ]);
  const result = await send(ANTHROPIC, toolUse({ results: { "one.md": "ONE" } }));
  assert.equal(result.text, "Done.");
  assert.equal(result.usage, null);
});

// TST-488006 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible endpoint that makes one call, then would answer; tools of limit 1
// input: send with tools of limit 1
// expect: the one call is carried out; request 2 is sent with no tools offered (no tools key in its body), its tool turn ONE followed by a user message of the
//   maximum-steps text that begins "CRITICAL - MAXIMUM STEPS REACHED", and its text Limit answer. is the answer; two requests
test("TST-488006: at the limit one more request follows without tools", async (t) => {
  const log = [];
  const bodies = provider(t, "openai", [
    providerReply("openai", { calls: [{ id: "c1", path: "one.md" }] }),
    providerReply("openai", { text: "Limit answer." }),
  ], log);
  const result = await send(OPENAI, toolUse({ limit: 1, log, results: { "one.md": "ONE" } }));
  assert.equal(result.text, "Limit answer.");
  assert.deepEqual(log, ["request 1", "call read_file one.md", "request 2"]);
  assert.deepEqual(bodies[0].tools, OPENAI_TOOLS);
  assert.equal("tools" in bodies[1], false, "the request after the limit offers no tools");
  assert.deepEqual(bodies[1].messages.at(-2), { role: "tool", content: "ONE", tool_call_id: "c1" });
  assert.equal(bodies[1].messages.at(-1).role, "user");
  assert.ok(bodies[1].messages.at(-1).content.startsWith("CRITICAL - MAXIMUM STEPS REACHED"));
});

// TST-488007 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible endpoint that makes one call in request 1 and two calls (b.md, c.md) in request 2; tools of limit 2
// input: send with tools of limit 2
// expect: a.md and b.md are carried out, in that order; c.md is not carried out and its tool turn reads
//   "refused: the limit of 2 tool calls is reached" with its call id, followed by the maximum-steps text; request 3 offers no tools; the answer is Third answer.; three requests
test("TST-488007: a call beyond the limit is refused in its tool turn and the next request offers no tools", async (t) => {
  const log = [];
  const bodies = provider(t, "openai", [
    providerReply("openai", { calls: [{ id: "c1", path: "a.md" }] }),
    providerReply("openai", { text: "More.", calls: [{ id: "c2", path: "b.md" }, { id: "c3", path: "c.md" }] }),
    providerReply("openai", { text: "Third answer." }),
  ], log);
  const result = await send(OPENAI, toolUse({ limit: 2, log, results: { "a.md": "A", "b.md": "B", "c.md": "C" } }));
  assert.equal(result.text, "Third answer.");
  assert.deepEqual(log, ["request 1", "call read_file a.md", "request 2", "call read_file b.md", "request 3"]);
  assert.equal(bodies.length, 3);
  assert.equal("tools" in bodies[2], false, "request 3 offers no tools");
  assert.deepEqual(bodies[2].messages.slice(-4, -1), [
    { role: "assistant", content: "More.", tool_calls: [
      { id: "c2", type: "function", function: { name: "read_file", arguments: "{\"path\":\"b.md\"}" } },
      { id: "c3", type: "function", function: { name: "read_file", arguments: "{\"path\":\"c.md\"}" } },
    ] },
    { role: "tool", content: "B", tool_call_id: "c2" },
    { role: "tool", content: "refused: the limit of 2 tool calls is reached", tool_call_id: "c3" },
  ]);
});

// TST-488008 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible endpoint that would call read_file, and a signal that is already aborted
// input: send with tools and that signal
// expect: send rejects with an error named AbortError; no request is sent and no call is carried out
test("TST-488008: a signal aborted before the first request sends nothing", async (t) => {
  const log = [];
  const bodies = provider(t, "openai", [providerReply("openai", { calls: [{ id: "c1", path: "one.md" }] })], log);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(send(OPENAI, toolUse({ log }), { signal: controller.signal }), (error) => error.name === "AbortError");
  assert.equal(bodies.length, 0);
  assert.deepEqual(log, []);
});

// TST-488009 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; A CANCELLED JOB WRITES NOTHING MORE
// given: an OpenAI-compatible endpoint that makes two calls (one.md, two.md) in request 1; the carrying out of one.md aborts the signal
// input: send with tools and that signal
// expect: send rejects with an error named AbortError; one.md was carried out, two.md was not; only request 1 was sent
test("TST-488009: a cancel during a call stops before the next call and the next request", async (t) => {
  const log = [], controller = new AbortController();
  const bodies = provider(t, "openai", [
    providerReply("openai", { calls: [{ id: "c1", path: "one.md" }, { id: "c2", path: "two.md" }] }),
    providerReply("openai", { text: "Never asked." }),
  ], log);
  const tools = toolUse({ log, results: { "one.md": "ONE", "two.md": "TWO" }, onCall: (args) => { if (args.path === "one.md") controller.abort(); } });
  await assert.rejects(send(OPENAI, tools, { signal: controller.signal }), (error) => error.name === "AbortError");
  assert.deepEqual(log, ["request 1", "call read_file one.md"]);
  assert.equal(bodies.length, 1);
});

// TST-488010 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; A CANCELLED JOB WRITES NOTHING MORE
// given: an OpenAI-compatible endpoint that makes one call in request 1; the carrying out of that call aborts the signal
// input: send with tools and that signal
// expect: send rejects with an error named AbortError before request 2 is sent; one request
test("TST-488010: a cancel after the last call of an answer sends no further request", async (t) => {
  const log = [], controller = new AbortController();
  const bodies = provider(t, "openai", [
    providerReply("openai", { calls: [{ id: "c1", path: "one.md" }] }),
    providerReply("openai", { text: "Never asked." }),
  ], log);
  const tools = toolUse({ log, results: { "one.md": "ONE" }, onCall: () => controller.abort() });
  await assert.rejects(send(OPENAI, tools, { signal: controller.signal }), (error) => error.name === "AbortError");
  assert.equal(bodies.length, 1);
});

// TST-488011 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; AN UNSUPPORTED ENDPOINT SAYS SO
// given: an OpenAI-compatible endpoint that makes one call in request 1 and answers every later request with HTTP 500 "Provider unavailable." and retry-after-ms 0
// input: send with tools
// expect: send rejects with EndpointFailed whose diagnosis is { reason: "endpoint error", message: "Provider unavailable.", routes: [] };
//   seven requests — the failed one retried five times, then given up —; the one call was carried out once
test("TST-488011: a request that still fails after five retries ends send with its diagnosis", async (t) => {
  const log = [];
  const bodies = provider(t, "openai", [
    providerReply("openai", { calls: [{ id: "c1", path: "one.md" }] }),
    ...Array.from({ length: 6 }, () => () => ({ ...reply(500, { error: { message: "Provider unavailable." } }), headers: new Headers({ "retry-after-ms": "0" }) })),
    providerReply("openai", { text: "Never asked." }),
  ], log);
  await assert.rejects(send(OPENAI, toolUse({ log, results: { "one.md": "ONE" } })), (error) => {
    assert.equal(error.name, "EndpointFailed");
    assert.deepEqual(error.diagnosis, { reason: "endpoint error", message: "Provider unavailable.", routes: [] });
    return true;
  });
  assert.equal(bodies.length, 7);
  assert.deepEqual(log, ["request 1", "call read_file one.md", "request 2", "request 3", "request 4", "request 5", "request 6", "request 7"]);
});

async function withoutToolsCase(t, config, tools, expectedBody) {
  const log = [];
  const bodies = provider(t, config.kind, [providerReply(config.kind, { text: "Plain answer.", usage: { in: 4, out: 2 } })], log);
  const result = await send(config, tools);
  assert.deepEqual(result, { text: "Plain answer.", usage: { inputTokens: 4, outputTokens: 2, minutes: null, cost: null } });
  assert.equal(bodies.length, 1);
  assert.deepEqual(bodies[0], expectedBody);
  assert.deepEqual(log, ["request 1"]);
}

// TST-488012 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; ONE DEFINITION, THREE DRIVERS
// given: an OpenAI-compatible endpoint answering Plain answer. with usage 4 in / 2 out; an input whose tools is null
// input: send
// expect: one request with body { model, messages: [user prompt] } and no tools key; { text: Plain answer., usage 4 in / 2 out }
test("TST-488012: input with tools null makes the one request it made before", async (t) => {
  await withoutToolsCase(t, OPENAI, null, { model: "fixture-model", messages: [{ role: "user", content: "Inspect the fixture." }] });
});

// TST-488014 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; ONE DEFINITION, THREE DRIVERS
// given: an OpenAI-compatible endpoint answering Plain answer. with usage 4 in / 2 out; an input that has no tools property
// input: send
// expect: one request with body { model, messages: [user prompt] } and no tools key; { text: Plain answer., usage 4 in / 2 out }
test("TST-488014: input without a tools property makes the one request it made before", async (t) => {
  await withoutToolsCase(t, OPENAI, undefined, { model: "fixture-model", messages: [{ role: "user", content: "Inspect the fixture." }] });
});

// TST-488013 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; ONE DEFINITION, THREE DRIVERS
// given: an Anthropic endpoint answering Plain answer. with usage 4 in / 2 out; a ToolUse with no definitions
// input: send
// expect: one request with body { model, max_tokens: 1024, messages: [user prompt] } and no tools key; no call is carried out; { text: Plain answer., usage 4/2 }
test("TST-488013: a ToolUse with no definitions makes the one request it made before", async (t) => {
  const log = [];
  await withoutToolsCase(t, ANTHROPIC, { definitions: [], limit: 5, async call(name, args) { log.push(`${name} ${args.path}`); return ""; } },
    { model: "fixture-model", max_tokens: 1024, messages: [{ role: "user", content: "Inspect the fixture." }] });
  assert.deepEqual(log, []);
});

// TST-1206001 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: a participant whose context holds 2000 tokens; the model asks to read big.md, whose text has 30000 characters (about 10000 tokens), then answers
// input: the driver's send with a read_file tool
// expect: the second request carries, as the tool's result, a refusal naming about 10000 tokens and the tokens left — not the file's text; the answer is returned;
// counter-proof: the same exchange for a participant without a declared context carries the file's text
test("TST-1206001: a tool result that would carry the conversation past the participant's context is refused, naming its size", async (t) => {
  const big = "x".repeat(30000);
  for (const [participant, refused] of [[{ name: "small", context: 2000 }, true], [PARTICIPANT, false]]) {
    const bodies = provider(t, "openai-compatible", [providerReply("openai-compatible", { calls: [{ id: "c1", path: "big.md" }] }), providerReply("openai-compatible", { text: "done" })]);
    const result = await endpointDriver(OPENAI, participant).send(input(toolUse({ results: { "big.md": big } })));
    assert.equal(result.text, "done");
    const toolMessage = bodies[1].messages.find((message) => message.role === "tool");
    if (refused) {
      assert.match(toolMessage.content, /^refused: the result of read_file holds about 10000 tokens, and about \d+ of the context's 2000 tokens are left/);
      assert.equal(toolMessage.content.includes(big), false);
    } else assert.equal(toolMessage.content, big);
  }
});
