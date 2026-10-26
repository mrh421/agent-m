// MOD-bridge-jobs' POST /v1/ask and GET /v1/ask/{ask} for a model endpoint (ITM-408), as the accepted text of docs/architecture/MOD-bridge-jobs.md
// states them: "a request of the page's job runner: ... or to a model endpoint, whose configuration the request carries, sent with MOD-endpoint-calls'
// `endpointDriver` in Node and answered the same way (`A RUNTIME IS INTERCHANGEABLE`)", answered like an agent's ask — running, then done with its text
// and the usage the endpoint reported, or failed with its error —; and "An endpoint configuration and its key — of a test or of an ask — exist only for
// that request. The handler retains neither in a clone, job record, log, disk file, shell setting nor process command." For UC-003 2a and UC-011.
// Run: node --test tests/bridge-jobs-endpoint-ask.test.mjs
//
// Module: MOD-bridge-jobs
// Guards: UC-003; UC-011; A RUNTIME IS INTERCHANGEABLE; A CREDENTIAL IS NEVER PLACED IN A URL; NO SECRET IN THE REPOSITORY
// Level: unit
//
// The model server is a controlled HTTP server of the test on 127.0.0.1, so nothing leaves the computer; it records what it was asked and answers as
// each test says. The key of each endpoint is a marker no other text holds. Where the module file leaves a reading open, the test states the one it
// takes, and the pull request names it:
//   - The ask's body is `{ endpoint, input }` with `endpoint` bridgeApi's endpoint configuration and `input` the prompt, a text; the answer to the
//     post is `{ ask }`, and the read gives `{ state, text, usage, error }` as an agent's ask does.
//   - A failed ask's `error` is the endpoint's diagnosis: its reason, then its message, with the key, where the endpoint echoes it, replaced by `[key]`.
//   - A body with an `endpoint` is an endpoint ask whatever else it holds; an endpoint that is no configuration, or an input that is no text, is
//     invalid-request.
// Each test states its input and its expected result before it runs (given / input / expect); where a test expects something never to happen, the
// same call is first shown to make it happen. The counter-proofs are recorded in the pull request.

import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { mock } from "node:test";
import * as bridgeJobs from "../src/bridge-jobs/index.mjs";

const { jobHandlers } = bridgeJobs;
const fs = process.getBuiltinModule("node:fs");
const KEY = "sk-marker-408-0f3a9c";

// ---------------------------------------------------------------- the model server

// A server answering each request by `answer(request) -> { status, body }` after `hold` is released; records what it was asked.
async function server(answer, { hold = null } = {}) {
  const seen = [];
  const http = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    const request = { method: req.method, url: req.url, headers: req.headers, body: text ? JSON.parse(text) : null };
    seen.push(request);
    if (hold) await hold.promise;
    const { status, body, headers = {} } = answer(request);
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  });
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  return { seen, base: `http://127.0.0.1:${http.address().port}/v1`, close: () => new Promise((resolve) => { http.closeAllConnections?.(); http.close(resolve); }) };
}
const gate = () => { let release; const promise = new Promise((resolve) => { release = resolve; }); return { promise, release }; };
const endpointOf = (base, extra = {}) => ({ name: "local", kind: "openai-compatible", baseUrl: base, model: "small", key: KEY, ...extra });
const ok = (text, usage) => () => ({ status: 200, body: { choices: [{ message: { content: text } }], usage } });

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

// ---------------------------------------------------------------- the ask

// TST-472084 · level: unit · module: MOD-bridge-jobs
// guards: A RUNTIME IS INTERCHANGEABLE; UC-003; UC-011
// given: a model server (openai-compatible) that holds its answer until released, then answers "Drafted." with 5 prompt and 3 completion tokens
// input: POST /v1/ask with { endpoint, input }; GET /v1/ask/{ask} before the server answers and after it
// expect: the post answers { ask } alone; the first read { state: "running", text: null, usage: null, error: null }; then { state: "done", text: "Drafted.", usage: { inputTokens: 5, outputTokens: 3, minutes: null, cost: null }, error: null }; the server was asked once, at /v1/chat/completions, with the input as the user message and the model of the configuration
test("an endpoint ask is running, then done with the endpoint's text and usage", async () => {
  const hold = gate();
  const model = await server(ok("Drafted.", { prompt_tokens: 5, completion_tokens: 3 }), { hold });
  try {
    const handlers = jobHandlers();
    const posted = await post(handlers, { endpoint: endpointOf(model.base), input: "Draft the thing." });
    assert.deepEqual(Object.keys(posted), ["ask"]);
    await until(() => model.seen.length === 1, "the model server to be asked");
    assert.deepEqual(await read(handlers, posted.ask), { state: "running", text: null, usage: null, error: null });
    hold.release();
    const done = await finished(handlers, posted.ask);

    assert.deepEqual(done, { state: "done", text: "Drafted.", usage: { inputTokens: 5, outputTokens: 3, minutes: null, cost: null }, error: null });
    assert.deepEqual(await read(handlers, posted.ask), done);
    assert.equal(model.seen.length, 1);
    assert.equal(model.seen[0].url, "/v1/chat/completions");
    assert.deepEqual(model.seen[0].body, { model: "small", messages: [{ role: "user", content: "Draft the thing." }] });
  } finally { await model.close(); }
});

// TST-472085 · level: unit · module: MOD-bridge-jobs
// guards: A RUNTIME IS INTERCHANGEABLE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a model server of the Anthropic kind, answering a text part and 7 input and 2 output tokens, and an openai-compatible one; each endpoint with a key
// input: POST /v1/ask to each; GET until done
// expect: each ask done with its server's text and usage; each server received the key in its own header — x-api-key, Authorization: Bearer — and in no url
test("an endpoint ask sends the key in the provider's header and in no url", async () => {
  const anthropic = await server(() => ({ status: 200, body: { content: [{ type: "text", text: "From Anthropic." }], usage: { input_tokens: 7, output_tokens: 2 } } }));
  const compatible = await server(ok("From a compatible server.", { prompt_tokens: 1, completion_tokens: 1 }));
  try {
    const handlers = jobHandlers();
    const first = await post(handlers, { endpoint: endpointOf(anthropic.base, { kind: "anthropic" }), input: "Hello." });
    const second = await post(handlers, { endpoint: endpointOf(compatible.base), input: "Hello." });
    assert.deepEqual(await finished(handlers, first.ask), { state: "done", text: "From Anthropic.", usage: { inputTokens: 7, outputTokens: 2, minutes: null, cost: null }, error: null });
    assert.equal((await finished(handlers, second.ask)).text, "From a compatible server.");

    assert.equal(anthropic.seen[0].headers["x-api-key"], KEY);
    assert.equal(compatible.seen[0].headers.authorization, `Bearer ${KEY}`);
    for (const request of [...anthropic.seen, ...compatible.seen]) assert.equal(request.url.includes(KEY), false);
  } finally { await anthropic.close(); await compatible.close(); }
});

// TST-472086 · level: unit · module: MOD-bridge-jobs
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-003
// given: a model server that refuses the key with 401 and a message that quotes the key; one that cannot be reached (its port closed); one that answers every
//   request with a rate limit and retry-after-ms 0
// input: POST /v1/ask to each; GET until it ends — for the unreachable one, with this test's timers mocked and advanced, since its five retries wait 2 s to 30 s
// expect: refused: state failed, text and usage null, an error that names "key refused" and the endpoint's words with the key replaced by [key], after one
//   request; unreachable: failed naming "not reachable"; rate-limited: failed naming "rate limited", after six requests — the request and five retries
test("a refused key, an unreachable server and a rate limit are failed asks with the endpoint's own words", async (t) => {
  const refusing = await server(() => ({ status: 401, body: { error: { message: `Incorrect API key provided: ${KEY}.` } } }));
  const limited = await server(() => ({ status: 429, headers: { "retry-after-ms": "0" }, body: { error: { message: "Too many requests today." } } }));
  const closed = await server(ok("never", null));
  const closedBase = closed.base;
  await closed.close();
  try {
    const handlers = jobHandlers();
    const refused = await finished(handlers, (await post(handlers, { endpoint: endpointOf(refusing.base), input: "Hello." })).ask);
    assert.equal(refused.state, "failed");
    assert.equal(refused.text, null);
    assert.equal(refused.usage, null);
    assert.match(refused.error, /key refused/);
    assert.match(refused.error, /Incorrect API key provided: \[key\]\./);
    assert.equal(refused.error.includes(KEY), false);
    assert.equal(refusing.seen.length, 1);

    const slow = await finished(handlers, (await post(handlers, { endpoint: endpointOf(limited.base), input: "Hello." })).ask);
    assert.equal(slow.state, "failed");
    assert.match(slow.error, /rate limited/);
    assert.match(slow.error, /Too many requests today\./);
    assert.equal(limited.seen.length, 6);

    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { ask } = await post(handlers, { endpoint: endpointOf(closedBase), input: "Hello." });
    let unreachable = await read(handlers, ask);
    for (let step = 0; step < 400 && unreachable.state === "running"; step++) {
      await new Promise((resolve) => setImmediate(resolve));
      t.mock.timers.tick(1000);
      unreachable = await read(handlers, ask);
    }
    t.mock.timers.reset();
    assert.equal(unreachable.state, "failed");
    assert.match(unreachable.error, /not reachable/);
  } finally { await refusing.close(); await limited.close(); }
});

// TST-472087 · level: unit · module: MOD-bridge-jobs
// guards: NO SECRET IN THE REPOSITORY; A CREDENTIAL IS NEVER PLACED IN A URL; UC-003
// given: a model server that answers one ask and refuses another with a message quoting the key; the file functions that write or create files, stdout and stderr, and the three agent commands watched (a PATH of canaries that log a call); an empty folder of the test
// input: POST /v1/ask for each, and GET until both have ended
// expect: both ended as they should; no file function was called by the handler; nothing written to stdout or stderr holds the key; no agent command or other process was started; no answer of any read holds the key; the test's folder holds nothing
test("the key and the configuration of an endpoint ask are kept in no file, log line or command", async (t) => {
  const model = await server((request) => (request.body.messages[0].content === "refuse" ? { status: 401, body: { error: { message: `bad key ${KEY}` } } }
    : { status: 200, body: { choices: [{ message: { content: "Drafted." } }], usage: null } }));
  const folder = mkdtempSync(join(tmpdir(), "agent-m-408-"));
  const bin = join(folder, "bin"), work = join(folder, "work"), calls = join(folder, "calls");
  mkdirSync(bin); mkdirSync(work); writeFileSync(calls, "");
  for (const name of ["claude", "codex", "opencode", "git", "sh"]) writeFileSync(join(bin, name), `#!/bin/sh\necho ${name} >> ${calls}\n`, { mode: 0o755 });
  const prior = process.env.PATH;
  const written = [], printed = [];
  for (const [owner, names] of [[fs, ["writeFile", "writeFileSync", "appendFile", "appendFileSync", "mkdir", "mkdirSync", "createWriteStream", "open", "openSync"]],
    [fs.promises, ["writeFile", "appendFile", "mkdir", "open"]]]) {
    for (const name of names) mock.method(owner, name, (...args) => { written.push(`${name} ${String(args[0])}`); });
  }
  for (const stream of [process.stdout, process.stderr]) {
    const original = stream.write.bind(stream);
    mock.method(stream, "write", (chunk, ...rest) => { printed.push(String(chunk)); return original(chunk, ...rest); });
  }
  t.after(() => mock.restoreAll());
  try {
    process.env.PATH = bin;
    const handlers = jobHandlers();
    const answers = [];
    for (const input of ["Draft.", "refuse"]) {
      const { ask } = await post(handlers, { endpoint: endpointOf(model.base), input });
      answers.push(await finished(handlers, ask), await read(handlers, ask));
    }
    process.env.PATH = prior;
    const mine = written.filter((line) => !line.includes(folder));
    mock.restoreAll();

    assert.deepEqual(answers.map(({ state }) => state), ["done", "done", "failed", "failed"], "known positive: both asks were answered");
    assert.deepEqual(mine, [], "the handler called no function that writes a file");
    assert.equal(printed.some((line) => line.includes(KEY)), false);
    assert.equal(JSON.stringify(answers).includes(KEY), false);
    assert.equal(readFileSync(calls, "utf8"), "", "no process was started");
    assert.deepEqual(readdirSync(work), []);
    for (const name of readdirSync(folder, { recursive: true })) {
      const path = join(folder, name);
      if (statSync(path).isFile() && path !== calls) assert.equal(readFileSync(path, "utf8").includes(KEY), false, name);
    }
  } finally { process.env.PATH = prior; await model.close(); rmSync(folder, { recursive: true, force: true }); }
});

// TST-472088 · level: unit · module: MOD-bridge-jobs
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a model server and a handler; one valid endpoint ask
// input: POST /v1/ask with the valid endpoint; then with an endpoint whose key is a number, whose kind is unknown, an input that is an object, and no input
// expect: the valid ask is answered with an ask; each other is invalid-request and reaches the server not at all
test("an endpoint that is no configuration, or an input that is no text, is invalid-request", async () => {
  const model = await server(ok("Drafted.", null));
  try {
    const handlers = jobHandlers();
    const good = endpointOf(model.base);
    assert.equal(typeof (await post(handlers, { endpoint: good, input: "Draft." })).ask, "string", "known positive");
    await until(() => model.seen.length === 1, "the server to be asked");
    for (const body of [{ endpoint: { ...good, key: 7 }, input: "Draft." }, { endpoint: { ...good, kind: "other" }, input: "Draft." },
      { endpoint: good, input: { prompt: "Draft." } }, { endpoint: good }, { endpoint: "http://127.0.0.1", input: "Draft." }]) {
      assert.equal((await rejection(post(handlers, body))).code, "invalid-request", JSON.stringify(body).replaceAll(KEY, "[key]"));
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(model.seen.length, 1);
  } finally { await model.close(); }
});
