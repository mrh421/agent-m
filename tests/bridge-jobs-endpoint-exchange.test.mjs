// MOD-bridge-jobs' POST /v1/ask and GET /v1/ask/{ask} for one exchange of a tool loop the page runs (ITM-497), as the accepted text of docs/architecture/MOD-bridge-jobs.md states it:
// "or, where the request carries one exchange of a tool loop, with `endpointExchange`, answered with the endpoint's text, its tool calls and the usage. The correction loop and the tool loop stay in the
// page, which carries every tool call out."; and "An endpoint configuration and its key — of a test or of an ask — exist only for that request."
// Run: node --test tests/bridge-jobs-endpoint-exchange.test.mjs
//
// Module: MOD-bridge-jobs
// Guards: UC-049; A RUNTIME IS INTERCHANGEABLE; A CREDENTIAL IS NEVER PLACED IN A URL; A REMOTE INTERFACE NAMES HOW IT FAILS
// Level: unit
//
// The model server is a controlled HTTP server of the test on 127.0.0.1, so nothing leaves the computer. The readings, each with the sentence it reads:
//   - "the request carries one exchange" is a body `{ endpoint, exchange }` with `exchange` = `{ messages, tools }`, as bridgeApi's table gives it (src/bridge-http/protocol.mjs, the third request form);
//     the post answers `{ ask }` alone, as every ask does.
//   - "answered with the endpoint's text, its tool calls and the usage": the entry the read gives is `{ state, text, calls, usage, error }`, `calls` being `{ id, name, args }` as endpointExchange
//     returns them, and `[]` while the ask runs or has failed.
//   - A failure is "read as an endpoint ask's failure is today, with the key replaced": the endpoint's diagnosis, its reason then its message, the key replaced by `[key]`.
//   - "a valid configuration, and `messages` and `tools` as lists" (the item's reading of the module file's request form): any other body of an exchange is invalid-request, and reaches the server not at all.
// Each test states its input and its expected result before it runs (given / input / expect); where a test expects something never to happen, the same call is first shown to make it happen.
// The counter-proofs are recorded in the pull request.

import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import * as bridgeJobs from "../src/bridge-jobs/index.mjs";

const { jobHandlers } = bridgeJobs;
const KEY = "sk-marker-497-7be1d2";

async function server(answer, { hold = null } = {}) {
  const seen = [];
  const http = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    const request = { method: req.method, url: req.url, headers: req.headers, body: text ? JSON.parse(text) : null };
    seen.push(request);
    if (hold) await hold.promise;
    const { status, body } = answer(request);
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(body));
  });
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  return { seen, base: `http://127.0.0.1:${http.address().port}/v1`, close: () => new Promise((resolve) => { http.closeAllConnections?.(); http.close(resolve); }) };
}
const gate = () => { let release; const promise = new Promise((resolve) => { release = resolve; }); return { promise, release }; };
const endpointOf = (base, extra = {}) => ({ name: "local", kind: "openai-compatible", baseUrl: base, model: "small", key: KEY, ...extra });
const TOOLS = [{ name: "read_file", description: "Reads a path.", input: { type: "object", properties: { path: { type: "string" } } } }];
const MESSAGES = [{ role: "user", text: "Read a.md." }];
const call = (handlers, key, { params = {}, body = {} } = {}) => handlers[key]({ params, query: {}, body });
const post = (handlers, body) => call(handlers, "POST /v1/ask", { body });
const read = (handlers, ask) => call(handlers, "GET /v1/ask/{ask}", { params: { ask } });
async function until(condition, what) {
  for (let turn = 0; turn < 500; turn++) {
    const found = await condition();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`waited for ${what}`);
}
const finished = (handlers, ask) => until(async () => { const now = await read(handlers, ask); return now.state === "running" ? null : now; }, "the ask to end");
async function rejection(promise) {
  try { await promise; } catch (error) { return error; }
  assert.fail("the call was not refused");
}

// TST-497005 · level: unit · module: MOD-bridge-jobs
// guards: UC-049; A RUNTIME IS INTERCHANGEABLE
// given: an openai-compatible model server that holds its answer, then makes one tool call c1 read_file({ path: "a.md" }) with the text "Reading." and 5 prompt and 3 completion tokens
// input: POST /v1/ask with { endpoint, exchange: { messages: MESSAGES, tools: TOOLS } }; GET before the server answers and after
// expect: the post answers { ask } alone; the first read { state: "running", text: null, calls: [], usage: null, error: null }; then { state: "done", text: "Reading.", calls: [{ id: "c1", name: "read_file", args: { path: "a.md" } }], usage: { inputTokens: 5, outputTokens: 3, minutes: null, cost: null }, error: null }; the server was asked once, at /v1/chat/completions, with the user message "Read a.md." and the tool read_file in the OpenAI form, and the call was not carried out
test("an exchange ask is running, then done with the endpoint's text, its tool calls and the usage", async () => {
  const hold = gate();
  const model = await server(() => ({ status: 200, body: { choices: [{ message: { content: "Reading.", tool_calls: [{ id: "c1", type: "function", function: { name: "read_file", arguments: JSON.stringify({ path: "a.md" }) } }] } }],
    usage: { prompt_tokens: 5, completion_tokens: 3 } } }), { hold });
  try {
    const handlers = jobHandlers();
    const posted = await post(handlers, { endpoint: endpointOf(model.base), exchange: { messages: MESSAGES, tools: TOOLS } });
    assert.deepEqual(Object.keys(posted), ["ask"]);
    await until(() => model.seen.length === 1, "the model server to be asked");
    assert.deepEqual(await read(handlers, posted.ask), { state: "running", text: null, calls: [], usage: null, error: null });
    hold.release();
    const done = await finished(handlers, posted.ask);
    assert.deepEqual(done, { state: "done", text: "Reading.", calls: [{ id: "c1", name: "read_file", args: { path: "a.md" } }],
      usage: { inputTokens: 5, outputTokens: 3, minutes: null, cost: null }, error: null });
    assert.deepEqual(await read(handlers, posted.ask), done);
    assert.equal(model.seen.length, 1);
    assert.equal(model.seen[0].url, "/v1/chat/completions");
    assert.deepEqual(model.seen[0].body.messages, [{ role: "user", content: "Read a.md." }]);
    assert.deepEqual(model.seen[0].body.tools, [{ type: "function", function: { name: "read_file", description: "Reads a path.", parameters: TOOLS[0].input } }]);
  } finally { await model.close(); }
});

// TST-497006 · level: unit · module: MOD-bridge-jobs
// guards: UC-049; A RUNTIME IS INTERCHANGEABLE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a model server of the Anthropic kind that answers a tool_use block t1 read_file({ path: "b.md" }); an exchange whose messages hold the user turn, the assistant turn that made t1 and its tool turn
// input: POST /v1/ask with { endpoint (anthropic), exchange }; GET until done
// expect: done with text "", calls [{ id: "t1", name: "read_file", args: { path: "b.md" } }]; the server received the key in x-api-key and in no url, at /v1/messages, with the tool in the Anthropic form (input_schema) and a user turn holding the tool_result for t1
test("an exchange ask of an Anthropic endpoint returns its tool_use block as a call, the key in its header only", async () => {
  const model = await server(() => ({ status: 200, body: { content: [{ type: "tool_use", id: "t1", name: "read_file", input: { path: "b.md" } }], usage: { input_tokens: 2, output_tokens: 1 } } }));
  try {
    const handlers = jobHandlers();
    const messages = [{ role: "user", text: "Read." }, { role: "assistant", text: "", calls: [{ id: "t0", name: "read_file", args: { path: "a.md" } }] }, { role: "tool", text: "alpha", callId: "t0" }];
    const { ask } = await post(handlers, { endpoint: endpointOf(model.base, { kind: "anthropic" }), exchange: { messages, tools: TOOLS } });
    const done = await finished(handlers, ask);
    assert.deepEqual([done.state, done.text, done.calls], ["done", "", [{ id: "t1", name: "read_file", args: { path: "b.md" } }]]);
    assert.equal(model.seen[0].url, "/v1/messages");
    assert.equal(model.seen[0].headers["x-api-key"], KEY);
    assert.equal(model.seen[0].url.includes(KEY), false);
    assert.deepEqual(model.seen[0].body.tools, [{ name: "read_file", description: "Reads a path.", input_schema: TOOLS[0].input }]);
    assert.deepEqual(model.seen[0].body.messages.at(-1), { role: "user", content: [{ type: "tool_result", tool_use_id: "t0", content: "alpha" }] });
  } finally { await model.close(); }
});

// TST-497007 · level: unit · module: MOD-bridge-jobs
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-049; NO SECRET IN THE REPOSITORY
// given: a model server that refuses the key with 401 and a message quoting the key; one that cannot be reached; known positive — one that answers
// input: POST /v1/ask with an exchange to each; GET until it ends — for the unreachable one with this test's timers mocked and advanced, since its five
//   retries wait 2 s to 30 s
// expect: the answering one is done; the refused one is { state: "failed", text: null, calls: [], usage: null } with an error naming "key refused" and the words "Incorrect API key provided: [key]." and not the key, after one request; the unreachable one is failed naming "not reachable"
test("a refused key or an unreachable server is a failed exchange ask with the endpoint's own words and the key replaced", async (t) => {
  const good = await server(() => ({ status: 200, body: { choices: [{ message: { content: "ok" } }] } }));
  const refusing = await server(() => ({ status: 401, body: { error: { message: `Incorrect API key provided: ${KEY}.` } } }));
  const closed = await server(() => ({ status: 200, body: {} }));
  const closedBase = closed.base;
  await closed.close();
  try {
    const handlers = jobHandlers();
    const exchange = { messages: MESSAGES, tools: TOOLS };
    assert.equal((await finished(handlers, (await post(handlers, { endpoint: endpointOf(good.base), exchange })).ask)).state, "done", "known positive");
    const refused = await finished(handlers, (await post(handlers, { endpoint: endpointOf(refusing.base), exchange })).ask);
    assert.deepEqual([refused.state, refused.text, refused.calls, refused.usage], ["failed", null, [], null]);
    assert.match(refused.error, /key refused/);
    assert.match(refused.error, /Incorrect API key provided: \[key\]\./);
    assert.equal(refused.error.includes(KEY), false);
    assert.equal(refusing.seen.length, 1);
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { ask } = await post(handlers, { endpoint: endpointOf(closedBase), exchange });
    let unreachable = await read(handlers, ask);
    for (let step = 0; step < 400 && unreachable.state === "running"; step++) {
      await new Promise((resolve) => setImmediate(resolve));
      t.mock.timers.tick(1000);
      unreachable = await read(handlers, ask);
    }
    t.mock.timers.reset();
    assert.equal(unreachable.state, "failed");
    assert.match(unreachable.error, /not reachable/);
  } finally { await good.close(); await refusing.close(); }
});

// TST-497008 · level: unit · module: MOD-bridge-jobs
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-049
// given: a model server and a handler; one valid exchange ask
// input: POST /v1/ask with the valid exchange; then with an exchange whose messages are an object, whose tools are text, with no tools, with no messages, with an endpoint whose kind is unknown, and with an endpoint that is text
// expect: the valid ask is answered with an ask; each other is invalid-request and reaches the server not at all
test("an exchange whose endpoint is no configuration, or whose messages or tools are no lists, is invalid-request", async () => {
  const model = await server(() => ({ status: 200, body: { choices: [{ message: { content: "ok" } }] } }));
  try {
    const handlers = jobHandlers();
    const good = endpointOf(model.base);
    assert.equal(typeof (await post(handlers, { endpoint: good, exchange: { messages: MESSAGES, tools: TOOLS } })).ask, "string", "known positive");
    await until(() => model.seen.length === 1, "the server to be asked");
    for (const body of [{ endpoint: good, exchange: { messages: { role: "user" }, tools: TOOLS } }, { endpoint: good, exchange: { messages: MESSAGES, tools: "read_file" } },
      { endpoint: good, exchange: { messages: MESSAGES } }, { endpoint: good, exchange: { tools: TOOLS } }, { endpoint: { ...good, kind: "other" }, exchange: { messages: MESSAGES, tools: TOOLS } },
      { endpoint: "http://127.0.0.1", exchange: { messages: MESSAGES, tools: TOOLS } }]) {
      assert.equal((await rejection(post(handlers, body))).code, "invalid-request", JSON.stringify(body).replaceAll(KEY, "[key]"));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(model.seen.length, 1);
  } finally { await model.close(); }
});
