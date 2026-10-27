// Module: MOD-endpoint-calls
// Level: unit
// Guards: UC-049; AN UNSUPPORTED ENDPOINT SAYS SO
// The rules of the execution loop a model endpoint works in: unreadable arguments and a wrong-case name answered, the same call three times in a row
// refused, opencode's words at the call limit, an answer cut off at the output limit continued, max_tokens set, every call answered, a failed request
// retried as opencode retries it, and the oldest tool results cleared, visibly, when the context fills. Constructed provider replies, and a model
// server of the test on 127.0.0.1 for the retries; every expected value is stated here.

import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { endpointDriver } from "../src/endpoint-calls/index.mjs";

const OPENAI = { name: "fixture-openai", kind: "openai-compatible", baseUrl: "https://openai.example.test/v1", model: "fixture-model", key: "fixture-openai-key" };
const ANTHROPIC = { name: "fixture-anthropic", kind: "anthropic", baseUrl: "https://anthropic.example.test/v1", model: "fixture-model", key: "fixture-anthropic-key" };
const PARTICIPANT = { name: "fixture-participant" };
const DEFINITION = { name: "read_file", description: "Read one fixture path.", input: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } };
const MAX_STEPS = `CRITICAL - MAXIMUM STEPS REACHED

The maximum number of steps allowed for this task has been reached. Tools are disabled until next user input. Respond with text only.

STRICT REQUIREMENTS:
1. Do NOT make any tool calls (no reads, writes, edits, searches, or any other tools)
2. MUST provide a text response summarizing work done so far
3. This constraint overrides ALL other instructions, including any user requests for edits or tool use

Response must include:
- Statement that maximum steps for this agent have been reached
- Summary of what has been accomplished so far
- List of any remaining tasks that were not completed
- Recommendations for what should be done next

Any attempt to use tools is a critical violation. Respond with text ONLY.`;
const CUT = "Your last answer was cut off at the output limit. Continue exactly where it stopped; if you were writing or editing a file, make smaller edits instead.";

const reply = (status, body, headers = {}) => ({ ok: status >= 200 && status < 300, status, headers: new Headers(headers), json: async () => body });
const REAL_FETCH = globalThis.fetch;
function withFetch(t, handler) {
  globalThis.fetch = handler;
  t.after(() => { globalThis.fetch = REAL_FETCH; });
}
// An OpenAI reply: text, calls [{ id, name?, args? | raw? }], finish_reason.
const openai = ({ text = "", calls = [], finish = "stop" } = {}) => reply(200, { choices: [{ finish_reason: finish, message: { content: text || null,
  ...(calls.length ? { tool_calls: calls.map((call) => ({ id: call.id, type: "function", function: { name: call.name ?? "read_file", arguments: call.raw ?? JSON.stringify(call.args ?? { path: call.path }) } })) } : {}) } }] });
const anthropic = ({ text = "", calls = [], stop = "end_turn" } = {}) => reply(200, { stop_reason: stop,
  content: [...(text ? [{ type: "text", text }] : []), ...calls.map((call) => ({ type: "tool_use", id: call.id, name: call.name ?? "read_file", input: { path: call.path } }))] });
// Serves the replies in order and keeps each request's parsed body.
function provider(t, replies) {
  const bodies = [];
  withFetch(t, async (_url, init) => { bodies.push(JSON.parse(init.body)); const next = replies[bodies.length - 1]; return typeof next === "function" ? next() : next; });
  return bodies;
}
function toolUse({ limit = 10, results = {}, log = [] } = {}) {
  return { definitions: [DEFINITION], limit, async call(name, args) { log.push(`${name} ${args.path}`); return results[args.path] ?? `text of ${args.path}`; } };
}
const input = (tools, prompt = "Inspect the fixture.") => ({ prompt, parts: [], output: null, findings: [], previous: null, workdir: null, tools });
const toolTurns = (body) => body.messages.filter((message) => message.role === "tool").map((message) => [message.tool_call_id, message.content]);

// TST-1241001 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible endpoint whose first answer calls read_file with the arguments text {"path": — not JSON —, then answers "done"
// input: send with tools
// expect: no failure is thrown; read_file is not carried out; request 2 holds the call with arguments "{}" and its tool turn "The arguments provided to the tool
//   are invalid: Invalid input for tool read_file: JSON parsing failed: Text: {"path": .\nError message: " followed by the parser's message; the answer is "done"
test("TST-1241001: unreadable tool arguments are answered in opencode's words, never thrown", async (t) => {
  const log = [];
  const bodies = provider(t, [openai({ calls: [{ id: "c1", raw: "{\"path\": " }] }), openai({ text: "done" })]);
  const result = await endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse({ log })));
  assert.equal(result.text, "done");
  assert.deepEqual(log, []);
  assert.equal(bodies[1].messages[1].tool_calls[0].function.arguments, "{}");
  const [[id, text]] = toolTurns(bodies[1]);
  assert.equal(id, "c1");
  assert.ok(text.startsWith("The arguments provided to the tool are invalid: Invalid input for tool read_file: JSON parsing failed: Text: {\"path\": .\nError message: "), text);
});

// TST-1241002 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible endpoint whose first answer calls READ_FILE on a.md, then answers "done"
// input: send with tools offering read_file
// expect: read_file is carried out on a.md; request 2 echoes the call under the name read_file and its tool turn holds "text of a.md"
test("TST-1241002: a tool name in the wrong case is lower-cased and carried out", async (t) => {
  const log = [];
  const bodies = provider(t, [openai({ calls: [{ id: "c1", name: "READ_FILE", path: "a.md" }] }), openai({ text: "done" })]);
  await endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse({ log })));
  assert.deepEqual(log, ["read_file a.md"]);
  assert.equal(bodies[1].messages[1].tool_calls[0].function.name, "read_file");
  assert.deepEqual(toolTurns(bodies[1]), [["c1", "text of a.md"]]);
});

// TST-1241003 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible endpoint that calls read_file on a.md in each of its first three answers, then answers "done"; and one that calls a.md, a.md, b.md, a.md, then answers "done"
// input: send with tools of limit 10 to each
// expect: first: a.md is carried out twice; the third call's tool turn is "refused: read_file was called with the same arguments 3 times in a row; it is not run again. Change the arguments or take another way."; known positive: second: no call is refused and read_file is carried out four times
test("TST-1241003: the same call three times in a row is refused, not run", async (t) => {
  const log = [];
  const bodies = provider(t, [1, 2, 3].map((n) => openai({ calls: [{ id: `c${n}`, path: "a.md" }] })).concat([openai({ text: "done" })]));
  await endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse({ log })));
  assert.deepEqual(log, ["read_file a.md", "read_file a.md"]);
  assert.deepEqual(toolTurns(bodies[3]).at(-1), ["c3", "refused: read_file was called with the same arguments 3 times in a row; it is not run again. Change the arguments or take another way."]);
  const other = [];
  const known = provider(t, ["a.md", "a.md", "b.md", "a.md"].map((path, n) => openai({ calls: [{ id: `d${n}`, path }] })).concat([openai({ text: "done" })]));
  await endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse({ log: other })));
  assert.deepEqual(other, ["read_file a.md", "read_file a.md", "read_file b.md", "read_file a.md"], "known positive: calls with something between are run");
  assert.equal(toolTurns(known[4]).some(([, text]) => text.startsWith("refused")), false);
});

// TST-1241004 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible endpoint that calls read_file on a.md, then answers "summary"; tools of limit 1
// input: send with tools
// expect: request 2 offers no tools and its last message is a user message holding opencode's MAX_STEPS text exactly; the answer is "summary"
test("TST-1241004: at the call limit the last request carries opencode's maximum-steps text and no tools", async (t) => {
  const bodies = provider(t, [openai({ calls: [{ id: "c1", path: "a.md" }] }), openai({ text: "summary" })]);
  const result = await endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse({ limit: 1 })));
  assert.equal(result.text, "summary");
  assert.equal("tools" in bodies[1], false);
  assert.deepEqual(bodies[1].messages.at(-1), { role: "user", content: MAX_STEPS });
});

// TST-1241005 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible endpoint whose first answer is "Part one, " with finish_reason length, then "part two." with finish_reason stop; an Anthropic endpoint whose first answer is "Half " with stop_reason max_tokens, then "whole." with end_turn
// input: send with tools to each
// expect: OpenAI: request 2 ends with the assistant's "Part one, " and the user message of the cut; the answer is "Part one, part two."; Anthropic: request 2's last user turn holds the text of the cut; the answer is "Half whole."; known positive: an answer ended by stop is returned without a further request
test("TST-1241005: an answer cut off at the output limit is continued", async (t) => {
  const bodies = provider(t, [openai({ text: "Part one, ", finish: "length" }), openai({ text: "part two." })]);
  assert.equal((await endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse()))).text, "Part one, part two.");
  assert.deepEqual(bodies[1].messages.slice(-2), [{ role: "assistant", content: "Part one, " }, { role: "user", content: CUT }]);
  const known = provider(t, [openai({ text: "Whole." })]);
  assert.equal((await endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse()))).text, "Whole.");
  assert.equal(known.length, 1, "known positive: a finished answer ends the loop");
  const claude = provider(t, [anthropic({ text: "Half ", stop: "max_tokens" }), anthropic({ text: "whole." })]);
  assert.equal((await endpointDriver(ANTHROPIC, PARTICIPANT).send(input(toolUse()))).text, "Half whole.");
  assert.deepEqual(claude[1].messages.at(-1), { role: "user", content: CUT });
});

// TST-1241006 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible and an Anthropic endpoint that each answer "done"; a participant without a declared context and one with a context of 20000 tokens
// input: send with tools; the prompt "Inspect the fixture." is 20 characters, 7 tokens as estimated
// expect: without a context, max_tokens is 32000 for both kinds; with the context of 20000 it is 19993, the room the prompt leaves; known positive: an
//   Anthropic send without tools keeps max_tokens 1024
test("TST-1241006: a tool loop sets max_tokens to 32000, or to the room the context leaves", async (t) => {
  const bodies = provider(t, [openai({ text: "done" }), anthropic({ text: "done" }), openai({ text: "done" }), anthropic({ text: "done" })]);
  await endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse()));
  await endpointDriver(ANTHROPIC, PARTICIPANT).send(input(toolUse()));
  const small = { name: "small", context: 20000 };
  await endpointDriver(OPENAI, small).send(input(toolUse()));
  await endpointDriver(ANTHROPIC, small).send(input(toolUse()));
  assert.deepEqual(bodies.map((body) => body.max_tokens), [32000, 32000, 19993, 19993]);
  const plain = provider(t, [anthropic({ text: "plain" })]);
  await endpointDriver(ANTHROPIC, PARTICIPANT).send(input(null));
  assert.equal(plain[0].max_tokens, 1024, "known positive: without tools the request is as before");
});

// TST-1241007 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible endpoint whose one answer calls read_file three times — args not JSON, a.md, and B.md under the name READ_FILE — then answers "done"
// input: send with tools
// expect: request 2 holds exactly one tool turn per call, in the order c1, c2, c3, and nothing else after the assistant's turn
test("TST-1241007: every tool call gets one result, in order", async (t) => {
  const bodies = provider(t, [openai({ calls: [{ id: "c1", raw: "nope" }, { id: "c2", path: "a.md" }, { id: "c3", name: "READ_FILE", path: "B.md" }] }), openai({ text: "done" })]);
  await endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse()));
  assert.deepEqual(bodies[1].messages.slice(2).map((message) => [message.role, message.tool_call_id]), [["tool", "c1"], ["tool", "c2"], ["tool", "c3"]]);
});

// A model server of the test answering each request by answer(n) -> { status, headers, body }, n from 1; it keeps the time of each request.
async function modelServer(t, answer) {
  const times = [];
  const http = createServer(async (req, res) => {
    for await (const _ of req);
    times.push(Date.now());
    const { status, headers = {}, body } = answer(times.length);
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  });
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => { http.closeAllConnections(); http.close(resolve); }));
  return { times, config: { ...OPENAI, baseUrl: `http://127.0.0.1:${http.address().port}/v1` } };
}
const done = { status: 200, body: { choices: [{ finish_reason: "stop", message: { content: "done" } }] } };

// TST-1241008 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; AN UNSUPPORTED ENDPOINT SAYS SO
// given: a model server that answers the first request 429 with retry-after-ms 300, the second 503 with retry-after 0 (seconds), the third "done"
// input: send with tools
// expect: the answer is "done" after three requests; the second came at least 300 ms after the first
test("TST-1241008: a rate limit and a server error are retried after the time the endpoint names", async (t) => {
  const server = await modelServer(t, (n) => (n === 1 ? { status: 429, headers: { "retry-after-ms": "300" }, body: { error: { message: "Slow down." } } }
    : n === 2 ? { status: 503, headers: { "retry-after": "0" }, body: { error: { message: "Busy." } } } : done));
  assert.equal((await endpointDriver(server.config, PARTICIPANT).send(input(toolUse()))).text, "done");
  assert.equal(server.times.length, 3);
  assert.ok(server.times[1] - server.times[0] >= 300, `${server.times[1] - server.times[0]} ms`);
});

// TST-1241009 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; AN UNSUPPORTED ENDPOINT SAYS SO
// given: a model server that answers every request 502 "Bad gateway." with retry-after-ms 0; one that answers 400 "This model's maximum context length is 8192 tokens."; one that answers 500 with that same message
// input: send with tools to each
// expect: the first fails with EndpointFailed, reason "endpoint error", message "Bad gateway.", after six requests — the request and five retries; the second and the third fail with reason "too long" after one request each — a context overflow is never retried
test("TST-1241009: five retries at most, and none for a context overflow", async (t) => {
  const failing = await modelServer(t, () => ({ status: 502, headers: { "retry-after-ms": "0" }, body: { error: { message: "Bad gateway." } } }));
  await assert.rejects(endpointDriver(failing.config, PARTICIPANT).send(input(toolUse())), (error) => error.name === "EndpointFailed"
    && error.diagnosis.reason === "endpoint error" && error.diagnosis.message === "Bad gateway.");
  assert.equal(failing.times.length, 6);
  for (const status of [400, 500]) {
    const full = await modelServer(t, () => ({ status, headers: { "retry-after-ms": "0" }, body: { error: { message: "This model's maximum context length is 8192 tokens." } } }));
    await assert.rejects(endpointDriver(full.config, PARTICIPANT).send(input(toolUse())), (error) => error.diagnosis?.reason === "too long");
    assert.equal(full.times.length, 1, `status ${status}`);
  }
});

// TST-1241010 · level: unit · module: MOD-endpoint-calls
// guards: UC-049; AN UNSUPPORTED ENDPOINT SAYS SO
// given: fetch that fails with a network error ("fetch failed") once, then answers "done"; the timers and the clock of this test are mocked
// input: send with tools, the mocked clock advanced in steps of 50 ms
// expect: the answer is "done"; the second request comes between 2000 and 2500 ms after the first — 2 s and up to 25 % jitter
test("TST-1241010: a network error is retried after 2 s with up to 25 % jitter", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const times = [];
  withFetch(t, async () => { times.push(Date.now()); if (times.length === 1) throw new TypeError("fetch failed"); return openai({ text: "done" }); });
  let settled = false;
  const sending = endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse())).finally(() => { settled = true; });
  for (let step = 0; step < 200 && !settled; step++) {
    await new Promise((resolve) => setImmediate(resolve));
    t.mock.timers.tick(50);
  }
  assert.equal((await sending).text, "done");
  assert.equal(times.length, 2);
  assert.ok(times[1] - times[0] >= 2000 && times[1] - times[0] <= 2550, `${times[1] - times[0]} ms`);
});

// TST-1241011 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: a participant with a context of 120000 tokens; an endpoint that calls read_file on f1.md … f9.md, one per answer, each file 30000 characters (10000 tokens as estimated), then answers "done"
// input: send with tools of limit 20
// expect: the tenth request's tool turns for f1 … f5 read "[old tool result cleared]" and those for f6 … f9 their files' text — the newest 40000 tokens kept; known positive: the ninth request still holds every file's text, the context not yet full
test("TST-1241011: the oldest tool results are cleared, visibly, when the context fills", async (t) => {
  const files = Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`f${i + 1}.md`, String(i + 1).repeat(30000).slice(0, 30000)]));
  const bodies = provider(t, Array.from({ length: 9 }, (_, i) => openai({ calls: [{ id: `c${i + 1}`, path: `f${i + 1}.md` }] })).concat([openai({ text: "done" })]));
  const result = await endpointDriver(OPENAI, { name: "large", context: 120000 }).send(input(toolUse({ limit: 20, results: files })));
  assert.equal(result.text, "done");
  assert.ok(toolTurns(bodies[8]).every(([id, text]) => text === files[`f${id.slice(1)}.md`]), "known positive: nothing is cleared before the context fills");
  assert.deepEqual(toolTurns(bodies[9]).map(([id, text]) => [id, text === "[old tool result cleared]" ? "cleared" : text === files[`f${id.slice(1)}.md`] ? "kept" : "other"]),
    [["c1", "cleared"], ["c2", "cleared"], ["c3", "cleared"], ["c4", "cleared"], ["c5", "cleared"], ["c6", "kept"], ["c7", "kept"], ["c8", "kept"], ["c9", "kept"]]);
});

// TST-1241012 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: a participant with a context of 60000 tokens; an endpoint that calls read_file on f1.md … f5.md, one per answer, each 30000 characters, then answers "done"
// input: send with tools of limit 20
// expect: no tool turn of any request reads "[old tool result cleared]" — clearing f1 alone would free less than 20000 tokens
test("TST-1241012: nothing is cleared when clearing would free too little", async (t) => {
  const files = Object.fromEntries(Array.from({ length: 5 }, (_, i) => [`f${i + 1}.md`, "z".repeat(30000)]));
  const bodies = provider(t, Array.from({ length: 5 }, (_, i) => openai({ calls: [{ id: `c${i + 1}`, path: `f${i + 1}.md` }] })).concat([openai({ text: "done" })]));
  await endpointDriver(OPENAI, { name: "mid", context: 60000 }).send(input(toolUse({ limit: 20, results: files })));
  assert.equal(bodies.flatMap(toolTurns).some(([, text]) => text === "[old tool result cleared]"), false);
});

// TST-1241013 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible and an Anthropic endpoint that each answer "done"
// input: endpointDriver(config, participant, endpointExchange's default, { system: "You work in a checkout." }).send with tools
// expect: the OpenAI request's first message is { role: "system", content: "You work in a checkout." }, followed by the user prompt; the Anthropic request's
//   system is "You work in a checkout." and its first message the user prompt
test("TST-1241013: a system text is sent as the endpoint's system prompt", async (t) => {
  const bodies = provider(t, [openai({ text: "done" }), anthropic({ text: "done" })]);
  await endpointDriver(OPENAI, PARTICIPANT, undefined, { system: "You work in a checkout." }).send(input(toolUse()));
  await endpointDriver(ANTHROPIC, PARTICIPANT, undefined, { system: "You work in a checkout." }).send(input(toolUse()));
  assert.deepEqual(bodies[0].messages.slice(0, 2), [{ role: "system", content: "You work in a checkout." }, { role: "user", content: "Inspect the fixture." }]);
  assert.equal(bodies[1].system, "You work in a checkout.");
  assert.deepEqual(bodies[1].messages[0], { role: "user", content: "Inspect the fixture." });
});

// Answers of ten calls each, every call on another path, so that no call repeats: twenty-five of them make 250 calls, more than any limit a kind ever stated.
const TEN_CALLS = (round) => openai({ calls: Array.from({ length: 10 }, (_, i) => ({ id: `c${round}-${i}`, path: `f${round * 10 + i + 1}.md` })) });

// TST-1240103 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible endpoint that answers 25 times with ten read_file calls each, each on another path — 250 calls —, then answers "done"; tools whose limit is null
// input: send with tools
// expect: all 250 calls are carried out, in order, and none is answered with a refusal; there are 26 requests, each offering the tool, and none holds the maximum-steps text; the answer is "done"
test("TST-1240103: with a null limit no number of calls ends the loop; it ends when the endpoint answers without a call", async (t) => {
  const log = [];
  const bodies = provider(t, Array.from({ length: 25 }, (_, round) => TEN_CALLS(round)).concat([openai({ text: "done" })]));
  const result = await endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse({ limit: null, log })));
  assert.equal(result.text, "done");
  assert.deepEqual(log, Array.from({ length: 250 }, (_, i) => `read_file f${i + 1}.md`));
  assert.equal(bodies.length, 26);
  assert.equal(bodies.every((body) => Array.isArray(body.tools) && body.tools.length === 1), true, "every request offers the tool");
  assert.equal(bodies.some((body) => body.messages.some((message) => message.content === MAX_STEPS)), false, "no request holds the maximum-steps text");
  assert.equal(toolTurns(bodies[25]).some(([, text]) => text.startsWith("refused")), false, "no call is refused");
});

// TST-1240104 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: the endpoint of TST-1240103, whose 21st answer is "summary"; tools whose limit is 200
// input: send with tools
// expect: 200 calls are carried out, f1.md to f200.md; request 21 offers no tools and its last message is the maximum-steps text; the answer is "summary" — a number still ends the loop
test("TST-1240104: with a number the loop still stops at it", async (t) => {
  const log = [];
  const bodies = provider(t, Array.from({ length: 20 }, (_, round) => TEN_CALLS(round)).concat([openai({ text: "summary" })]));
  const result = await endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse({ limit: 200, log })));
  assert.equal(result.text, "summary");
  assert.deepEqual(log, Array.from({ length: 200 }, (_, i) => `read_file f${i + 1}.md`));
  assert.equal(bodies.length, 21);
  assert.equal("tools" in bodies[20], false);
  assert.deepEqual(bodies[20].messages.at(-1), { role: "user", content: MAX_STEPS });
});

// TST-1240105 · level: unit · module: MOD-endpoint-calls
// guards: UC-049
// given: an OpenAI-compatible endpoint whose first answer is "Part one, " with finish_reason length, whose second calls read_file on a.md, and whose third answers "done"; tools whose limit is null
// input: send with tools
// expect: request 2 still offers the tool and holds no maximum-steps text; read_file is carried out on a.md; the answer is "Part one, done" — the continuation of a cut answer counts against no limit
test("TST-1240105: with a null limit the continuation of a cut answer ends nothing", async (t) => {
  const log = [];
  const bodies = provider(t, [openai({ text: "Part one, ", finish: "length" }), openai({ calls: [{ id: "c1", path: "a.md" }] }), openai({ text: "done" })]);
  const result = await endpointDriver(OPENAI, PARTICIPANT).send(input(toolUse({ limit: null, log })));
  assert.equal(Array.isArray(bodies[1].tools) && bodies[1].tools.length, 1, "request 2 offers the tool");
  assert.equal(bodies[1].messages.some((message) => message.content === MAX_STEPS), false);
  assert.deepEqual(log, ["read_file a.md"]);
  assert.equal(result.text, "Part one, done");
});
