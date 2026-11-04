// MOD-endpoint-calls — direct, one-request endpoint test and diagnosis (ITM-260).
// Run: node --test tests/endpoint-calls.test.mjs
//
// Module: MOD-endpoint-calls
// Guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO; A CREDENTIAL IS NEVER PLACED IN A URL; NO SECRET IN THE REPOSITORY
// Level: unit
//
// Constructed provider replies stand in for endpoint calls. Every test records its precondition (given), action (input),
// and observable result (expect); none reaches a provider or waits. Counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { diagnoseEndpoint, listModels, modelContext, testEndpoint } from "../src/endpoint-calls/index.mjs";

const OPENAI = { name: "example", kind: "openai-compatible", baseUrl: "https://models.example.test/v1", model: "tiny-model", key: "secret-key" };
const ANTHROPIC = { name: "claude", kind: "anthropic", baseUrl: "https://claude.example.test/v1", model: "claude-test", key: "anthropic-key" };

function reply(status, body = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function withFetch(t, implementation) {
  const previous = globalThis.fetch;
  globalThis.fetch = implementation;
  t.after(() => { globalThis.fetch = previous; });
}

// TST-260-001
// TST-472213 · level: unit · module: MOD-endpoint-calls
// guards: UC-003; A CREDENTIAL IS NEVER PLACED IN A URL
// given: an OpenAI-compatible endpoint configuration with a key and a constructed successful chat response
// input: testEndpoint(config)
// expect: exactly one short /chat/completions POST succeeds; its URL has no key and its Authorization header alone carries it
test("TST-260-001: an OpenAI-compatible test sends one short authorised chat request", async (t) => {
  const calls = [];
  withFetch(t, async (url, init) => { calls.push({ url, init }); return reply(200, { choices: [{ message: { content: "ok" } }] }); });

  assert.deepEqual(await testEndpoint(OPENAI), { works: true, model: "tiny-model", tools: false, toolMessage: "ok" });
  assert.equal(calls.length, 1, "one test makes one request");
  assert.equal(calls[0].url, "https://models.example.test/v1/chat/completions");
  assert.equal(calls[0].init.headers.Authorization, "Bearer secret-key");
  assert.equal(calls[0].init.headers["x-api-key"], undefined);
  assert.equal(calls[0].url.includes("secret-key"), false, "the key is never in the URL");
  assert.deepEqual(JSON.parse(calls[0].init.body), { model: "tiny-model", messages: [{ role: "user", content: "Call agent_m_probe once. It is a harmless capability check." }], max_tokens: 64,
    tools: [{ type: "function", function: { name: "agent_m_probe", description: "Report that tool calling works without changing anything.", parameters: { type: "object", properties: {}, additionalProperties: false } } }], stream: false });
});

// TST-260-002
// TST-472214 · level: unit · module: MOD-endpoint-calls
// guards: UC-003; A CREDENTIAL IS NEVER PLACED IN A URL
// given: an Anthropic configuration without a key and a constructed successful Messages response
// input: testEndpoint(config)
// expect: it sends one /messages request in Anthropic's format and sends no credential header
test("TST-260-002: an Anthropic test uses its Messages format and omits an absent key", async (t) => {
  const calls = [];
  withFetch(t, async (url, init) => { calls.push({ url, init }); return reply(200, { content: [{ type: "text", text: "ok" }] }); });

  assert.deepEqual(await testEndpoint({ ...ANTHROPIC, key: null }), { works: true, model: "claude-test", tools: false, toolMessage: "ok" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://claude.example.test/v1/messages");
  assert.equal(calls[0].init.headers["x-api-key"], undefined);
  assert.equal(calls[0].init.headers["anthropic-version"], "2023-06-01");
  assert.equal(calls[0].init.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.deepEqual(JSON.parse(calls[0].init.body), { model: "claude-test", max_tokens: 64, messages: [{ role: "user", content: "Call agent_m_probe once. It is a harmless capability check." }],
    tools: [{ name: "agent_m_probe", description: "Report that tool calling works without changing anything.", input_schema: { type: "object", properties: {}, additionalProperties: false } }] });
});

// TST-260-003
// TST-472215 · level: unit · module: MOD-endpoint-calls
// guards: UC-003
// given: an endpoint which refuses its supplied credential in its own error message
// input: testEndpoint(config) against a constructed 401 response
// expect: works is false and the diagnosis keeps the message as a refused key
test("TST-260-003: a refused key keeps the provider message", async (t) => {
  withFetch(t, async () => reply(401, { error: { message: "Invalid API key." } }));
  assert.deepEqual(await testEndpoint(OPENAI), { works: false, diagnosis: { reason: "key refused", message: "Invalid API key.", routes: [] } });
});

// TST-260-004
// TST-472216 · level: unit · module: MOD-endpoint-calls
// guards: UC-003
// given: an endpoint which says the selected model does not exist
// input: testEndpoint(config) against a constructed 404 response
// expect: works is false and diagnosis says model unknown in the provider's words
test("TST-260-004: an unknown model keeps the provider message", async (t) => {
  withFetch(t, async () => reply(404, { error: { message: "The model `tiny-model` does not exist." } }));
  assert.deepEqual(await testEndpoint(OPENAI), { works: false, diagnosis: { reason: "model unknown", message: "The model `tiny-model` does not exist.", routes: [] } });
});

// TST-260-005
// TST-472217 · level: unit · module: MOD-endpoint-calls
// guards: UC-003
// given: an endpoint which reports that its rate limit is exhausted
// input: testEndpoint(config) against a constructed 429 response
// expect: works is false and diagnosis says rate limited in the provider's words
test("TST-260-005: a rate limit keeps the provider message", async (t) => {
  withFetch(t, async () => reply(429, { error: { message: "Rate limit exceeded." } }));
  assert.deepEqual(await testEndpoint(OPENAI), { works: false, diagnosis: { reason: "rate limited", message: "Rate limit exceeded.", routes: [] } });
});

// TST-260-006
// TST-472218 · level: unit · module: MOD-endpoint-calls
// guards: UC-003
// given: an endpoint which rejects the request for another provider-stated reason
// input: testEndpoint(config) against a constructed 500 response
// expect: works is false and diagnosis says endpoint error without replacing its message
test("TST-260-006: another endpoint error keeps its provider message", async (t) => {
  withFetch(t, async () => reply(500, { error: { message: "Service temporarily unavailable." } }));
  assert.deepEqual(await testEndpoint(OPENAI), { works: false, diagnosis: { reason: "endpoint error", message: "Service temporarily unavailable.", routes: [] } });
});

// TST-260-007
// TST-472219 · level: unit · module: MOD-endpoint-calls
// guards: UC-003
// given: Node cannot connect to the configured address
// input: testEndpoint(config) where fetch rejects with the constructed network error
// expect: works is false and diagnosis reports not reachable, with no alternative route claimed
test("TST-260-007: a network failure is not reachable", async (t) => {
  withFetch(t, async () => { throw new TypeError("connect ECONNREFUSED"); });
  assert.deepEqual(await testEndpoint(OPENAI), { works: false, diagnosis: { reason: "not reachable", message: "connect ECONNREFUSED", routes: [] } });
});

// TST-260-008
// TST-472220 · level: unit · module: MOD-endpoint-calls
// guards: AN UNSUPPORTED ENDPOINT SAYS SO
// given: a browser-visible cross-origin refusal from an endpoint
// input: diagnoseEndpoint(error, config, "browser")
// expect: it names cross-origin refusal, preserves its observable reason, and offers CI and Bridge routes
test("TST-260-008: a browser cross-origin refusal offers CI and Bridge", () => {
  const error = new TypeError("Blocked by CORS policy: No 'Access-Control-Allow-Origin' header");
  assert.deepEqual(diagnoseEndpoint(error, OPENAI, "browser"), {
    reason: "cross-origin refused", message: error.message, routes: ["ci", "bridge"],
  });
});

// TST-260-009
// TST-472221 · level: unit · module: MOD-endpoint-calls
// guards: AN UNSUPPORTED ENDPOINT SAYS SO
// given: a browser-visible message that the provider's direct-browser opt-in header is missing
// input: diagnoseEndpoint(error, config, "browser")
// expect: it names the missing opt-in header and offers CI and Bridge routes
test("TST-260-009: a missing browser opt-in header offers CI and Bridge", () => {
  const error = new TypeError("anthropic-dangerous-direct-browser-access header is required for browser requests");
  assert.deepEqual(diagnoseEndpoint(error, ANTHROPIC, "browser"), {
    reason: "opt-in header missing", message: error.message, routes: ["ci", "bridge"],
  });
});

// TST-260-010
// TST-472222 · level: unit · module: MOD-endpoint-calls
// guards: AN UNSUPPORTED ENDPOINT SAYS SO
// given: a browser's opaque fetch failure, whose details the browser conceals
// input: diagnoseEndpoint(error, config, "browser")
// expect: it reports only blocked by the browser, preserves the observable reason, and offers CI and Bridge routes
test("TST-260-010: an opaque browser failure is not over-diagnosed", () => {
  const error = new TypeError("Failed to fetch");
  assert.deepEqual(diagnoseEndpoint(error, OPENAI, "browser"), {
    reason: "blocked by the browser", message: error.message, routes: ["ci", "bridge"],
  });
});

// TST-960001 · level: unit · module: MOD-endpoint-calls
// guards: UC-040; A CREDENTIAL IS NEVER PLACED IN A URL
// given: an OpenAI-compatible configuration with a key whose model "tiny-model" is not among the served ones, and a constructed list answer { data: [{ id }, { id }] }
// input: listModels(config)
// expect: one GET <baseUrl>/models carrying the key as Authorization only and no body; the answer is { models: ["served-a", "served-b"] }; config.model is not read
test("TST-960001: listModels asks GET /models once and returns the served identifiers", async (t) => {
  const calls = [];
  withFetch(t, async (url, init) => { calls.push({ url, init }); return reply(200, { data: [{ id: "served-a" }, { id: "served-b" }] }); });
  assert.deepEqual(await listModels(OPENAI), { models: ["served-a", "served-b"] });
  assert.equal(calls.length, 1, "one listing makes one request");
  assert.equal(calls[0].url, "https://models.example.test/v1/models");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers.Authorization, "Bearer secret-key");
  assert.equal(calls[0].init.body, undefined);
  assert.equal(calls[0].url.includes("secret-key"), false, "the key is never in the URL");
  assert.deepEqual(await listModels({ ...OPENAI, model: "" }), { models: ["served-a", "served-b"] }, "the configured model is not read");
});

// TST-960002 · level: unit · module: MOD-endpoint-calls
// guards: UC-040; A CREDENTIAL IS NEVER PLACED IN A URL
// given: an Anthropic configuration with a key and a constructed list answer
// input: listModels(config)
// expect: one GET <baseUrl>/models with the key as x-api-key and the anthropic-version header, no Authorization header; the identifiers are returned
test("TST-960002: listModels for Anthropic carries the key as x-api-key", async (t) => {
  const calls = [];
  withFetch(t, async (url, init) => { calls.push({ url, init }); return reply(200, { data: [{ id: "claude-test" }] }); });
  assert.deepEqual(await listModels(ANTHROPIC), { models: ["claude-test"] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://claude.example.test/v1/models");
  assert.equal(calls[0].init.headers["x-api-key"], "anthropic-key");
  assert.equal(calls[0].init.headers["anthropic-version"], "2023-06-01");
  assert.equal(calls[0].init.headers.Authorization, undefined);
});

// TST-960003 · level: unit · module: MOD-endpoint-calls
// guards: UC-040; AN UNSUPPORTED ENDPOINT SAYS SO
// given: an endpoint that refuses the key (401 with a message), and one that cannot be reached (fetch throws)
// input: listModels(config) for each
// expect: { diagnosis } with the reason "key refused" and the provider's message; and { diagnosis } with the reason "not reachable"; neither throws, neither retries
test("TST-960003: a failed listing is a diagnosis, as testEndpoint gives it", async (t) => {
  let calls = 0;
  withFetch(t, async () => { calls += 1; return reply(401, { error: { message: "Invalid API key." } }); });
  assert.deepEqual(await listModels(OPENAI), { diagnosis: { reason: "key refused", message: "Invalid API key.", routes: [] } });
  assert.equal(calls, 1);
  withFetch(t, async () => { throw new TypeError("connect ECONNREFUSED 127.0.0.1:9"); });
  const down = await listModels(OPENAI);
  assert.equal(down.diagnosis.reason, "not reachable");
  assert.match(down.diagnosis.message, /ECONNREFUSED/);
});

// TST-1202001 · level: unit · module: MOD-endpoint-calls
// guards: UC-003; A CREDENTIAL IS NEVER PLACED IN A URL
// given: (a) an endpoint whose /models entry for tiny-model states context_length 32768; (b) a LiteLLM gateway whose /models entry states nothing and whose /model/info entry for tiny-model has model_info.max_input_tokens 131072; (c) an endpoint that states nothing in either, as NVIDIA's listing does
// input: modelContext(config) for each
// expect: (a) 32768 after one GET /models; (b) 131072 after GET /models and GET /model/info, each with the key as Authorization only; (c) null
test("TST-1202001: modelContext reads the model's context from the listing, else from LiteLLM's model info, and null where neither states it", async (t) => {
  const calls = [];
  let answers = {};
  withFetch(t, async (url, init) => { calls.push({ url, init }); return reply(200, answers[url.replace(OPENAI.baseUrl, "")] ?? { data: [] }); });
  answers = { "/models": { data: [{ id: "other", context_length: 8 }, { id: "tiny-model", context_length: 32768 }] } };
  assert.equal(await modelContext(OPENAI), 32768);
  assert.deepEqual(calls.map((call) => call.url), ["https://models.example.test/v1/models"]);
  calls.length = 0;
  answers = { "/models": { data: [{ id: "tiny-model", object: "model" }] }, "/model/info": { data: [{ model_name: "tiny-model", model_info: { max_input_tokens: 131072, max_tokens: 131072 } }] } };
  assert.equal(await modelContext(OPENAI), 131072);
  assert.deepEqual(calls.map((call) => call.url), ["https://models.example.test/v1/models", "https://models.example.test/v1/model/info"]);
  assert.ok(calls.every((call) => call.init.headers.Authorization === "Bearer secret-key" && !call.url.includes("secret-key")));
  answers = { "/models": { data: [{ id: "tiny-model", object: "model", owned_by: "nvidia" }] } };
  assert.equal(await modelContext(OPENAI), null);
});
