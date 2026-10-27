// ITM-1233: MOD-bridge-client's `ask` returns the `cut` of an exchange the Bridge answered, so that an answer of a bridged endpoint cut at the output limit is continued as on the tab and in
// CI. MOD-endpoint-calls states the exchange a caller gives the loop as returning `{ text, calls, usage, cut?: true }`, and that "MOD-runtimes' `bridgeDriver` gives the Bridge's `ask` of one
// exchange, so that the loop of an endpoint a Bridge calls is this same loop, run in the tab"; MOD-bridge-client's `ask` returns "the answer of a model endpoint the Bridge calls". The reading:
// `ask` returns `cut: true` where the Bridge's answer holds it, and no `cut` otherwise.
// Run: node --test tests/bridge-client-cut-answer-1233.test.mjs
//
// Module: MOD-bridge-client
// Guards: UC-049; A RUNTIME IS INTERCHANGEABLE; ONE DEFINITION, THREE DRIVERS
// Level: unit
//
// TST-1233004 answers the client from a fetch of the test's own. TST-1233005 runs MOD-endpoint-calls' loop with the exchange bridgeDriver gives it — `ask(bridge, { endpoint, exchange })`,
// MOD-runtimes' own line, written out here — with the client's fetch answered in this process by MOD-bridge-jobs' handlers, which call a controlled model server on 127.0.0.1; its known
// positive is the same loop calling the endpoint directly, as the tab and CI do. Nothing leaves the computer. Each test states its input and its expected result before it runs.

import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { ask, bridgeAt } from "../src/bridge-client/index.mjs";
import { jobHandlers } from "../src/bridge-jobs/index.mjs";
import { endpointDriver, endpointExchange } from "../src/endpoint-calls/index.mjs";
import { CUT_OFF } from "../src/endpoint-calls/loop.mjs";

const bridge = () => bridgeAt({ address: "http://127.0.0.1:4711", token: "bridge-token" });
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
function withFetch(t, fn) { const prior = globalThis.fetch; globalThis.fetch = fn; t.after(() => { globalThis.fetch = prior; }); return prior; }
const EXCHANGE = { messages: [{ role: "user", text: "Write." }], tools: [] };
const ENDPOINT = { name: "lab", kind: "openai-compatible", baseUrl: "http://127.0.0.1:1/v1", model: "small", key: null };

// TST-1233004 · level: unit · module: MOD-bridge-client
// guards: UC-049; A RUNTIME IS INTERCHANGEABLE
// given: a Bridge whose ask answers { ask: "A1" }, then { state: "done", text: "Part one, ", calls: [], usage: null, cut: true }; and, the known positive, one whose done answer holds no cut
// input: ask(bridge, { endpoint }, …) with an exchange, against each
// expect: the first returns { text: "Part one, ", calls: [], usage: null, cut: true }; the second exactly { text: "Done.", calls: [], usage: null }
test("TST-1233004: ask returns the cut of an exchange the Bridge answered at the output limit — MOD-bridge-client", async (t) => {
  let done = { state: "done", text: "Part one, ", calls: [], usage: null, error: null, cut: true };
  withFetch(t, async (url, init = {}) => (init.method === "POST" ? response({ ask: "A1" }) : response(done)));
  assert.deepEqual(await ask(bridge(), { endpoint: ENDPOINT, exchange: EXCHANGE }), { text: "Part one, ", calls: [], usage: null, cut: true }, "failure node: ask keeps the Bridge's cut");
  done = { state: "done", text: "Done.", calls: [], usage: null, error: null };
  assert.deepEqual(await ask(bridge(), { endpoint: ENDPOINT, exchange: EXCHANGE }), { text: "Done.", calls: [], usage: null });
});

// The model server: the first request answered "Part one, " at the output limit, every later one "part two." in full.
async function model() {
  const seen = [];
  const http = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    seen.push(JSON.parse(text));
    const first = seen.length === 1;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ choices: [{ message: { content: first ? "Part one, " : "part two." }, finish_reason: first ? "length" : "stop" }], usage: { prompt_tokens: 1, completion_tokens: 1 } }));
  });
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  return { seen, base: `http://127.0.0.1:${http.address().port}/v1`, close: () => new Promise((resolve) => { http.closeAllConnections?.(); http.close(resolve); }) };
}
const INPUT = (calls) => ({ prompt: "Write the file.", parts: [], output: null, findings: [], previous: null, workdir: null,
  tools: { definitions: [{ name: "write", description: "Writes a file.", input: { type: "object", properties: { path: { type: "string" } } } }], call: async (...args) => { calls.push(args); return "written"; }, limit: 10 } });
const PARTICIPANT = { name: "lab", type: "model endpoint", model: "small", capabilities: ["use tools"] };

// TST-1233005 · level: unit · module: MOD-bridge-client
// guards: UC-049; A RUNTIME IS INTERCHANGEABLE; ONE DEFINITION, THREE DRIVERS
// given: the model server above; a Bridge whose routes are MOD-bridge-jobs' handlers in this process, reached through the client's fetch; the endpoint configuration naming the server
// input: endpointDriver(config, participant, (endpoint, exchange) => ask(bridge, { endpoint, exchange })).send(input offering one tool); then, the known positive, endpointDriver(config, participant).send(the same input) against a fresh server
// expect: both return the text "Part one, part two."; the server was asked twice each time, its second request ending with the assistant's "Part one, " and the user message CUT_OFF; no tool was called
test("TST-1233005: a bridged answer cut at the output limit is continued as on the tab and in CI — MOD-bridge-client", async (t) => {
  const handlers = jobHandlers();
  const real = withFetch(t, async (url, init = {}) => {
    const path = new URL(String(url)).pathname;
    if (path.startsWith("/v1/ask")) {
      // A real request takes a turn of the event loop; without one, the client's polling would keep the model server from ever answering.
      await new Promise((resolve) => setImmediate(resolve));
      const route = init.method === "POST" ? "POST /v1/ask" : "GET /v1/ask/{ask}";
      return response(await handlers[route]({ params: { ask: path.split("/")[3] }, query: {}, body: init.body ? JSON.parse(init.body) : {} }));
    }
    return real(url, init);
  });
  for (const through of ["bridge", "direct"]) {
    const server = await model();
    try {
      const config = { ...ENDPOINT, baseUrl: server.base }, calls = [];
      const driver = through === "bridge" ? endpointDriver(config, PARTICIPANT, async (endpoint, exchange) => ask(bridge(), { endpoint, exchange })) : endpointDriver(config, PARTICIPANT);
      const answer = await driver.send(INPUT(calls));
      assert.equal(answer.text, "Part one, part two.", `failure node (${through}): the cut answer is continued and the parts joined`);
      assert.equal(server.seen.length, 2, through);
      assert.deepEqual(server.seen[1].messages.slice(-2), [{ role: "assistant", content: "Part one, " }, { role: "user", content: CUT_OFF }], through);
      assert.deepEqual(calls, []);
    } finally { await server.close(); }
  }
});
