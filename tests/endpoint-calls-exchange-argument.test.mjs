// Module: MOD-endpoint-calls
// Level: unit
// Guards: UC-049; ONE DEFINITION, THREE DRIVERS
// Run: node --test tests/endpoint-calls-exchange-argument.test.mjs
//
// endpointDriver's optional third argument (ITM-497). Reading, quoted from docs/architecture/MOD-endpoint-calls.md, `endpointDriver`: "Each request of the loop is one `endpointExchange` — or one call of
// `exchange` where the caller gives it". So with an `exchange` and an input that carries `tools`, each request of the loop is a call of `exchange(config, { messages, tools })` and no request goes to
// the endpoint's own address; "Where the input carries `tools`" is the only case the loop runs in, so an input without tools is one direct request whatever `exchange` is given.
// The exchanges are constructed in the test; fetch is a spy that fails the test when the loop calls it. Each test states its input and expected result (given / input / expect) in its own text.
// The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { endpointDriver } from "../src/endpoint-calls/index.mjs";

const CONFIG = { name: "ep", kind: "openai-compatible", baseUrl: "https://ep.example.test/v1", model: "m", key: "k-497" };
const PARTICIPANT = { name: "drafter" };
const DEFINITION = { name: "read_file", description: "Read one path.", input: { type: "object", properties: { path: { type: "string" } } } };
const realFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = realFetch; });
const spy = () => { const seen = []; globalThis.fetch = async (url) => { seen.push(String(url)); throw new Error(`the network was reached: ${url}`); }; return seen; };
const toolsOf = (log, limit = 10) => ({ definitions: [DEFINITION], limit, async call(name, args) { log.push(`${name}:${args.path}`); return `text of ${args.path}`; } });
const inputOf = (tools) => ({ prompt: "Inspect.", parts: [], output: null, findings: [], previous: null, workdir: null, ...(tools ? { tools } : {}) });

// TST-497001 · level: unit · module: MOD-endpoint-calls
// guards: ONE DEFINITION, THREE DRIVERS; UC-049
// given: an input carrying tools (read_file, limit 10) and an exchange that answers a call c1 read_file("a.md") (3 in, 1 out) and then the text "done" (4 in, 2 out); fetch is a spy
// input: endpointDriver(CONFIG, PARTICIPANT, exchange).send(input)
// expect: exchange is called twice with CONFIG; the first call's request is { messages: [{ role: "user", text: "Inspect." }], tools: [DEFINITION], maxTokens: 32000 }; the second's messages end with the assistant turn { role: "assistant", text: "", calls: [c1] } and the tool turn { role: "tool", text: "text of a.md", callId: "c1" }; the tool ran once, "read_file:a.md"; the result is { text: "done", usage: { inputTokens: 7, outputTokens: 3, minutes: null, cost: null } }; fetch was not called
test("endpointDriver — with an exchange, each request of the tool loop is one call of it and no request reaches the endpoint", async () => {
  const fetched = spy(), log = [], given = [];
  const replies = [{ text: "", calls: [{ id: "c1", name: "read_file", args: { path: "a.md" } }], usage: { inputTokens: 3, outputTokens: 1, minutes: null, cost: null } },
    { text: "done", calls: [], usage: { inputTokens: 4, outputTokens: 2, minutes: null, cost: null } }];
  const exchange = async (config, request) => { given.push([config, structuredClone(request)]); return replies[given.length - 1]; };
  const result = await endpointDriver(CONFIG, PARTICIPANT, exchange).send(inputOf(toolsOf(log)));
  assert.equal(given.length, 2);
  assert.ok(given.every(([config]) => config === CONFIG));
  assert.deepEqual(given[0][1], { messages: [{ role: "user", text: "Inspect." }], tools: [DEFINITION], maxTokens: 32000 });
  assert.deepEqual(given[1][1].messages.slice(-2), [{ role: "assistant", text: "", calls: [{ id: "c1", name: "read_file", args: { path: "a.md" } }] }, { role: "tool", text: "text of a.md", callId: "c1" }]);
  assert.deepEqual(log, ["read_file:a.md"]);
  assert.deepEqual(result, { text: "done", usage: { inputTokens: 7, outputTokens: 3, minutes: null, cost: null } });
  assert.deepEqual(fetched, []);
});

// TST-497002 · level: unit · module: MOD-endpoint-calls
// guards: ONE DEFINITION, THREE DRIVERS; UC-049
// given: tools of limit 2 and an exchange that makes the call c1, then the calls c2 and c3, then answers the text "end"; fetch is a spy
// input: endpointDriver(CONFIG, PARTICIPANT, exchange).send(input)
// expect: three exchanges; the third offers no tools ([]); the tool ran for c1 and c2 only; the tool turn of c3 holds "refused: the limit of 2 tool calls is reached" and that of c2 its result, and the maximum-steps text follows them; the text is "end"
test("endpointDriver — the limit holds for the calls of an exchange the caller gives", async () => {
  spy();
  const log = [], given = [];
  const answers = [{ text: "", calls: [{ id: "c1", name: "read_file", args: { path: "1" } }], usage: null },
    { text: "", calls: [{ id: "c2", name: "read_file", args: { path: "2" } }, { id: "c3", name: "read_file", args: { path: "3" } }], usage: null }, { text: "end", calls: [], usage: null }];
  const exchange = async (_config, request) => { given.push(structuredClone(request)); return answers[given.length - 1]; };
  const result = await endpointDriver(CONFIG, PARTICIPANT, exchange).send(inputOf(toolsOf(log, 2)));
  assert.equal(given.length, 3);
  assert.deepEqual(given[2].tools, []);
  assert.deepEqual(log, ["read_file:1", "read_file:2"]);
  assert.deepEqual(given[2].messages.slice(-3, -1).map((turn) => [turn.callId, turn.text]), [["c2", "text of 2"], ["c3", "refused: the limit of 2 tool calls is reached"]]);
  assert.ok(given[2].messages.at(-1).text.startsWith("CRITICAL - MAXIMUM STEPS REACHED"));
  assert.equal(result.text, "end");
});

// TST-497003 · level: unit · module: MOD-endpoint-calls
// guards: ONE DEFINITION, THREE DRIVERS; UC-049
// given: an exchange that records its calls; known positive first — the driver given an input with tools calls it; then an input without tools, with fetch answering a plain OpenAI reply "direct" (5 in, 1 out)
// input: endpointDriver(CONFIG, PARTICIPANT, exchange).send(input) for each
// expect: the input with tools calls the exchange once (the known positive); the input without tools calls it not at all, sends one request to https://ep.example.test/v1/chat/completions, and returns { text: "direct", usage: { inputTokens: 5, outputTokens: 1, minutes: null, cost: null } }
test("endpointDriver — an input without tools is one direct request, whatever exchange is given", async () => {
  const calls = [];
  const exchange = async () => { calls.push("exchange"); return { text: "x", calls: [], usage: null }; };
  spy();
  await endpointDriver(CONFIG, PARTICIPANT, exchange).send(inputOf(toolsOf([])));
  assert.deepEqual(calls, ["exchange"], "known positive: with tools the exchange is used");
  calls.length = 0;
  const urls = [];
  globalThis.fetch = async (url) => { urls.push(String(url)); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "direct" } }], usage: { prompt_tokens: 5, completion_tokens: 1 } }) }; };
  const result = await endpointDriver(CONFIG, PARTICIPANT, exchange).send(inputOf(null));
  assert.deepEqual(calls, []);
  assert.deepEqual(urls, ["https://ep.example.test/v1/chat/completions"]);
  assert.deepEqual(result, { text: "direct", usage: { inputTokens: 5, outputTokens: 1, minutes: null, cost: null } });
});

// TST-497004 · level: unit · module: MOD-endpoint-calls
// guards: ONE DEFINITION, THREE DRIVERS; UC-049
// given: tools, and an exchange that throws an error named "EndpointFailed"; known positive — an exchange that answers "fine"
// input: send with each
// expect: the working exchange gives the text "fine"; the failing one's error reaches the caller as the same object, after one call of the exchange, with the tool never run
test("endpointDriver — a failure of the exchange the caller gives is the driver's failure, unrepeated", async () => {
  spy();
  const log = [];
  const ok = await endpointDriver(CONFIG, PARTICIPANT, async () => ({ text: "fine", calls: [], usage: null })).send(inputOf(toolsOf(log)));
  assert.equal(ok.text, "fine");
  const failure = Object.assign(new Error("key refused"), { name: "EndpointFailed", diagnosis: { reason: "key refused", message: "key refused", routes: [] } });
  let calls = 0;
  await assert.rejects(endpointDriver(CONFIG, PARTICIPANT, async () => { calls += 1; throw failure; }).send(inputOf(toolsOf(log))), (error) => error === failure);
  assert.equal(calls, 1);
  assert.deepEqual(log, []);
});
