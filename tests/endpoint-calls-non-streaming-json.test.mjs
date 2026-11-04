// ITM-1177 — an OpenAI-compatible endpoint that answers in server-sent events unless the request asks otherwise.
// Run: node --test tests/endpoint-calls-non-streaming-json.test.mjs
//
// Module: MOD-endpoint-calls
// Guards: UC-003; UC-049; A RUNTIME IS INTERCHANGEABLE; AN UNSUPPORTED ENDPOINT SAYS SO
// Level: unit
//
// The transport is constructed: it answers the single JSON answer when the request's body holds `stream: false`, and otherwise the recorded
// server-sent-events form, as an endpoint whose `stream` defaults to true does. Each answer is a real Response, so the public functions read it with
// their own response.json() — the failure node. No provider is called. Every expected value is stated in the test's own text.

import test from "node:test";
import assert from "node:assert/strict";
import { endpointDriver, endpointExchange, testEndpoint } from "../src/endpoint-calls/index.mjs";

const OPENAI = { name: "fixture-openai", kind: "openai-compatible", baseUrl: "https://openai.example.test/v1", model: "fixture-model", key: "fixture-openai-key" };
const SSE = 'data: {"choices":[{"index":0,"delta":{"role":"assistant","content":"Known answer."}}]}\n\ndata: [DONE]\n\n';

// The endpoint: `json` is the answer it gives a request whose body holds stream: false; any other request gets the SSE form.
function endpoint(t, json) {
  const bodies = [];
  const previous = globalThis.fetch;
  globalThis.fetch = async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return body.stream === false
      ? new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } })
      : new Response(SSE, { status: 200, headers: { "content-type": "text/event-stream" } });
  };
  t.after(() => { globalThis.fetch = previous; });
  return bodies;
}

const PROBE_CALL = { choices: [{ message: { content: null, tool_calls: [{ id: "probe-call", type: "function", function: { name: "agent_m_probe", arguments: "{}" } }] } }] };
const KNOWN_ANSWER = { choices: [{ message: { content: "Known answer." } }] };

// TST-1177001 · level: unit · module: MOD-endpoint-calls
// guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO
// given: an OpenAI-compatible endpoint that answers the probe's agent_m_probe call as JSON only to a body with stream false, else in SSE; known negative: the SSE form is not read by response.json()
// input: testEndpoint(config)
// expect: { works: true, model: "fixture-model", tools: true, toolMessage: null }; exactly one request, whose body holds stream false
test("TST-1177001: the endpoint test asks for one JSON answer and reads the model's tool call", async (t) => {
  const bodies = endpoint(t, PROBE_CALL);
  await assert.rejects((await fetch("https://openai.example.test/v1/chat/completions", { method: "POST", body: "{}" })).json(), SyntaxError,
    "known negative: the SSE form that a body without stream false gets cannot be read as JSON");
  bodies.length = 0;
  assert.deepEqual(await testEndpoint(OPENAI), { works: true, model: "fixture-model", tools: true, toolMessage: null });
  assert.equal(bodies.length, 1, "one test makes one request, no retry");
  assert.equal(bodies[0].stream, false);
});

// TST-1177002 · level: unit · module: MOD-endpoint-calls
// guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO
// given: an OpenAI-compatible endpoint that answers the text Known answer. as JSON only to a body with stream false, else in SSE
// input: testEndpoint(config)
// expect: { works: true, model: "fixture-model", tools: false, toolMessage: "Known answer." }; exactly one request, whose body holds stream false
test("TST-1177002: the endpoint test asks for one JSON answer and reads a text-only answer", async (t) => {
  const bodies = endpoint(t, KNOWN_ANSWER);
  assert.deepEqual(await testEndpoint(OPENAI), { works: true, model: "fixture-model", tools: false, toolMessage: "Known answer." });
  assert.equal(bodies.length, 1, "one test makes one request, no retry");
  assert.equal(bodies[0].stream, false);
});

// TST-1177003 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; A RUNTIME IS INTERCHANGEABLE
// given: an OpenAI-compatible endpoint that answers Inspecting. with one read_file call on three.md and usage 13 in / 5 out as JSON only to a body with stream false, else in SSE
// input: endpointExchange(config, { messages: [user Inspect the fixture.], tools: [read_file] })
// expect: { text: "Inspecting.", calls: [{ id: "next-a", name: "read_file", args: { path: "three.md" } }], usage: { inputTokens: 13, outputTokens: 5, minutes: null, cost: null } }; exactly one request, whose body holds stream false
test("TST-1177003: an exchange asks for one JSON answer and returns the endpoint's tool call", async (t) => {
  const bodies = endpoint(t, { choices: [{ message: { content: "Inspecting.", tool_calls: [{ id: "next-a", type: "function", function: { name: "read_file", arguments: "{\"path\":\"three.md\"}" } }] } }],
    usage: { prompt_tokens: 13, completion_tokens: 5 } });
  const tools = [{ name: "read_file", description: "Read one fixture path.", input: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } }];
  assert.deepEqual(await endpointExchange(OPENAI, { messages: [{ role: "user", text: "Inspect the fixture." }], tools }), {
    text: "Inspecting.", calls: [{ id: "next-a", name: "read_file", args: { path: "three.md" } }], usage: { inputTokens: 13, outputTokens: 5, minutes: null, cost: null },
  });
  assert.equal(bodies.length, 1, "one exchange makes one request, no retry");
  assert.equal(bodies[0].stream, false);
});

// TST-1177004 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; A RUNTIME IS INTERCHANGEABLE
// given: an OpenAI-compatible endpoint that answers the text Known answer. without usage as JSON only to a body with stream false, else in SSE
// input: endpointDriver(config, participant).send of a DriverInput whose prompt is Known positive. and which offers no tools
// expect: { text: "Known answer.", usage: null }; exactly one request, whose body holds stream false
test("TST-1177004: the ordinary driver asks for one JSON answer and returns its text", async (t) => {
  const bodies = endpoint(t, KNOWN_ANSWER);
  const input = { prompt: "Known positive.", parts: [], output: null, findings: [], previous: null, workdir: null };
  assert.deepEqual(await endpointDriver(OPENAI, { name: "fixture-participant" }).send(input), { text: "Known answer.", usage: null });
  assert.equal(bodies.length, 1, "one send makes one request, no retry");
  assert.equal(bodies[0].stream, false);
});
