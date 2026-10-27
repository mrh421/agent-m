// ITM-1233: an exchange ask of MOD-bridge-jobs keeps the `cut` of an answer the endpoint ended at the output limit, so that MOD-endpoint-calls' continuation reaches a bridged endpoint.
// MOD-endpoint-calls states the exchange's answer as `{ text, calls, usage, cut?: true }` — "and `cut` where the endpoint ended the answer at the output limit" — and that "MOD-runtimes'
// `bridgeDriver` gives the Bridge's `ask` of one exchange, so that the loop of an endpoint a Bridge calls is this same loop, run in the tab"; its rule *The output limit* continues an answer
// ended at that limit. MOD-bridge-jobs answers an exchange ask "with `endpointExchange`, answered with the endpoint's text, its tool calls and the usage". The reading: the ask's answer is
// endpointExchange's answer, `cut` included where it holds one, and holds no `cut` otherwise.
// Run: node --test tests/bridge-jobs-cut-answer-1233.test.mjs
//
// Module: MOD-bridge-jobs
// Guards: UC-049; A RUNTIME IS INTERCHANGEABLE; ONE DEFINITION, THREE DRIVERS
// Level: unit
//
// The model server is a controlled HTTP server of the test on 127.0.0.1, so nothing leaves the computer. Each test states its input and its expected result before it runs
// (given / input / expect); the known positive — an answer that was not cut — runs beside it.

import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import { jobHandlers } from "../src/bridge-jobs/index.mjs";

async function server(answer) {
  const seen = [];
  const http = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    seen.push({ url: req.url, body: text ? JSON.parse(text) : null });
    const body = answer(seen.length);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  return { seen, base: `http://127.0.0.1:${http.address().port}/v1`, close: () => new Promise((resolve) => { http.closeAllConnections?.(); http.close(resolve); }) };
}
const endpointOf = (base, kind) => ({ name: "lab", kind, baseUrl: base, model: "small", key: null });
const EXCHANGE = { messages: [{ role: "user", text: "Write a.md." }], tools: [{ name: "write", description: "Writes a file.", input: { type: "object", properties: { path: { type: "string" } } } }], maxTokens: 32000 };
async function finished(handlers, ask) {
  for (let turn = 0; turn < 500; turn++) {
    const now = await handlers["GET /v1/ask/{ask}"]({ params: { ask }, query: {}, body: {} });
    if (now.state !== "running") return now;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail("waited for the ask to end");
}
const asked = async (handlers, endpoint) => finished(handlers, (await handlers["POST /v1/ask"]({ params: {}, query: {}, body: { endpoint, exchange: EXCHANGE } })).ask);

// TST-1233003 · level: unit · module: MOD-bridge-jobs
// guards: UC-049; A RUNTIME IS INTERCHANGEABLE
// given: an openai-compatible model server that answers "Part one, " with finish_reason "length", then "Done." with finish_reason "stop"; an Anthropic one that answers "Part one, " with stop_reason "max_tokens", then "Done." with stop_reason "end_turn"
// input: for each, POST /v1/ask with { endpoint, exchange } twice, GET until each ends
// expect: the first ask of each is { state: "done", text: "Part one, ", calls: [], usage, error: null, cut: true }; the second — the known positive — is done with "Done." and holds no key `cut`
test("TST-1233003: an exchange ask answered at the output limit is done with cut: true, one that was not holds no cut — MOD-bridge-jobs", async () => {
  const forms = {
    "openai-compatible": (n) => ({ choices: [{ message: { content: n === 1 ? "Part one, " : "Done." }, finish_reason: n === 1 ? "length" : "stop" }], usage: { prompt_tokens: 4, completion_tokens: 2 } }),
    anthropic: (n) => ({ content: [{ type: "text", text: n === 1 ? "Part one, " : "Done." }], stop_reason: n === 1 ? "max_tokens" : "end_turn", usage: { input_tokens: 4, output_tokens: 2 } }),
  };
  for (const [kind, answer] of Object.entries(forms)) {
    const model = await server(answer);
    try {
      const handlers = jobHandlers();
      const cut = await asked(handlers, endpointOf(model.base, kind));
      assert.deepEqual(cut, { state: "done", text: "Part one, ", calls: [], usage: { inputTokens: 4, outputTokens: 2, minutes: null, cost: null }, error: null, cut: true },
        `failure node (${kind}): the ask's answer keeps endpointExchange's cut`);
      const whole = await asked(handlers, endpointOf(model.base, kind));
      assert.equal(whole.state, "done");
      assert.equal(whole.text, "Done.");
      assert.equal(Object.hasOwn(whole, "cut"), false, `known positive (${kind}): an answer that was not cut holds no cut`);
    } finally { await model.close(); }
  }
});
