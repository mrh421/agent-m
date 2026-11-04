// System coverage for UC-003 Configure a model endpoint, alternative flow 2a, "and so do the requests of the jobs that use the endpoint": the author configures an endpoint on Settings with the Bridge lab chosen among the
// Bridges this browser keeps, and the prompt bar, which offers the endpoint with its place, sends a message as a job (the kind `converse`) whose request reaches the model server through the same Bridge. The Settings page is the real
// dashboard (tests/uc-003-harness.mjs); the Bridge is the real composed program of MOD-desktop-shell (MOD-bridge-http's server and MOD-bridge-jobs' handlers); the model server is a controlled HTTP server on the loopback address
// that counts what it receives; the prompt bar's page is MOD-site-frame's real `startPage` with the real MOD-prompt-bar, MOD-job-runner and MOD-runtimes, opened over the very records Settings stored (tests/uc-003-job-harness.mjs).
// No request leaves the process and no paid service is called.
// Run: node --test tests/system-uc-003-a-job-through-the-bridge.test.mjs
//
// Module: MOD-settings-pages
// Module: MOD-browser-store
// Module: MOD-bridge-client
// Module: MOD-bridge-http
// Module: MOD-bridge-jobs
// Module: MOD-desktop-shell
// Module: MOD-prompt-bar
// Module: MOD-runtimes
// Guards: UC-003
// Level: system
//
// Authored by developer-sonnet-k (ITM-266), who built none of the code this walks (the trailers are listed in tests/system-uc-003-configure-a-model-endpoint.test.mjs; MOD-prompt-bar and MOD-runtimes, which the job's request
// runs through, were built by others than developer-sonnet-k except ITM-1378, how a CI route reads the key, which this file does not run). Readings the texts leave open, which the case states:
//   - "the requests of the jobs that use the endpoint" (2a) is read as a message of the prompt bar, a job of the kind `converse` run in the tab (MOD-prompt-bar), the one job that uses a model endpoint configured in this browser.
//   - "goes through that Bridge" is read as the page's requests POST /v1/ask and GET /v1/ask/<id> to the address and with the pairing token of the Bridge named in the endpoint's record, and the model server's request coming from
//     the Bridge's program, not from the page.
//   - The prompt bar's page keeps the Bridge record Settings stored, with its address replaced by the one address its fixture network lets through (http://127.0.0.1:9418), from which the page's requests are passed to the real Bridge.

import test from "node:test";
import assert from "node:assert/strict";
import { callsTool, configure, conversation, dump, fill, forwardTo, keptBridge, modelServer, openSettings, refusesBrowser, saveAndTest, startBridge } from "./uc-003-harness.mjs";
import { barOf, barOver, conversationLines, outside, recordsOf, sendMessage, statusOf, toTheBridge } from "./uc-003-job-harness.mjs";

const KEY = "sk-campus-job-key-2718";
const PLACE = "Campus cluster, Germany";
const WORDS = "Which model are you, and where do you run?";

// TST-266221 · level: system · module: system
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER; A CREDENTIAL IS NEVER PLACED IN A URL; NO SECRET IN THE REPOSITORY
// given: a dashboard browser that keeps the Bridge lab (the real composed Bridge) and a model server on the loopback address that the browser cannot call, which calls the tool it is offered and answers a conversation "I am the campus model."
// input: the author configures campus on Settings with the key sk-campus-job-key-2718, the place "Campus cluster, Germany", the context 200000 and the Bridge lab, and presses Save and test; then, on the prompt bar's page over the records Settings stored, the bar is read and the author writes "Which model are you, and where do you run?" and presses Send
// expect: known positive — the test request reached the model server once, through lab; the bar offers "campus — Campus cluster, Germany" before anything is sent and, after Send, names "Sent to: campus — Campus cluster, Germany"; the page sent its requests only to the Bridge's address, POST /v1/ask and GET /v1/ask/<id>, each with lab's pairing token and the key in none of them as an address; the model server received a second request, from the Bridge (no Origin header, the key as the Authorization header) holding the author's words; the answer "I am the campus model." stands in the conversation; no request left the fixtures, and the repository servers got no write
test("TST-266221: UC-003 2a a job's request to an endpoint configured through a Bridge goes through the same Bridge", async (t) => {
  const bridge = await startBridge(t);
  const model = await modelServer(t, (request) => (Array.isArray(request.body?.tools) && request.body.tools.some((tool) => tool?.function?.name === "agent_m_probe") ? callsTool() : conversation("I am the campus model.")));
  const settingsToBridge = [];
  const world = await openSettings({ entries: keptBridge("lab", bridge), handlers: [forwardTo(bridge, settingsToBridge), refusesBrowser(model.origin, [])] });
  await configure(world);
  fill(world.main, { name: "campus", url: model.url, model: "tiny-model", key: KEY, place: PLACE, context: "200000", bridge: "lab" });
  assert.equal(await saveAndTest(world), "✓ tiny-model is working, can use tools.");
  assert.equal(model.seen.length, 1, "known positive: the test request reached the model server, through the Bridge");
  assert.equal(settingsToBridge.filter((each) => each.method === "POST").length, 1);
  const records = recordsOf(dump());
  assert.deepEqual(Object.keys(records).sort(), ["bridge:lab", "endpoint:campus", "last-test:endpoint:campus"]);
  assert.equal(records["endpoint:campus"].bridge, "lab");

  const { s, seen } = await barOver(records, { forward: toTheBridge(bridge) });
  assert.match(barOf(s).textContent, new RegExp(`campus — ${PLACE}`), "the bar offers the endpoint with its place");
  assert.deepEqual(seen.map((request) => `${request.method} ${request.path}`).filter((each) => each.startsWith("POST")), [], "nothing is sent while the bar is only read");
  await sendMessage(s, "campus", WORDS);
  assert.match(statusOf(s).textContent, new RegExp(`^Sent to:campus — ${PLACE}`));
  const asks = seen.filter((request) => request.path.startsWith("/v1/ask"));
  assert.equal(asks.filter((request) => request.method === "POST").length, 1, "one job's request to the Bridge");
  assert.ok(asks.length >= 2 && asks.every((request) => request.headers["x-agent-m-bridge-token"] === records["bridge:lab"].token), "each carries the pairing token of the Bridge the endpoint names");
  assert.deepEqual(outside, [], "the page sent nothing to the model server itself");
  assert.equal(model.seen.length, 2, "the model server received the job's request");
  const request = model.seen[1];
  assert.deepEqual([request.method, request.path, request.headers.authorization, request.headers.origin], ["POST", "/v1/chat/completions", `Bearer ${KEY}`, undefined], "from the Bridge's program, with the key");
  assert.ok(JSON.stringify(request.body).includes(WORDS), "it holds the author's words");
  assert.ok(conversationLines(s).some((line) => line.includes("I am the campus model.")), conversationLines(s).join(" | "));
  assert.equal(seen.some((each) => `${each.path}`.includes(KEY)), false, "no address holds the key");
  assert.deepEqual([s.instance.writes, s.product.writes], [[], []], "nothing is written to a repository");
  assert.equal(JSON.stringify([s.instance.requests, s.product.requests]).includes(KEY), false);
});
