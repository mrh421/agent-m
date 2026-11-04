// Release coverage for UC-003 Configure a model endpoint, alternative flow 2a over the jump host's HTTPS address (UC-044's already-configured route): "the browser only talks to the Bridge — directly, or in Safari over the jump host's
// HTTPS address. Step 4's test request goes through that Bridge, and so do the requests of the jobs that use the endpoint." The jump host's web server is a fixture in front of the real composed Bridge (MOD-desktop-shell,
// MOD-bridge-http, MOD-bridge-jobs): it keeps every request, answers 401 with a Basic challenge unless the request carries the web server's own login, and passes the rest on with the Origin header a browser adds; no certificate is
// provisioned and no tunnel opened (CI/Bridge job execution and tunnel provisioning remain their own use cases'). The Settings page is the real dashboard (tests/uc-003-harness.mjs), the prompt bar's page the real startPage
// with the real MOD-prompt-bar and MOD-runtimes over the records Settings stored (tests/uc-003-job-harness.mjs); the model server is a controlled HTTP server on the loopback address. No paid service is called.
// Run: node --test tests/release-uc-003-a-job-through-the-https-route.test.mjs
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
// Level: release
//
// Authored by developer-sonnet-k (ITM-266), who built none of the behaviour these cases guard (the Agent-M-Participant trailers of the code UC-003's flow runs are listed in
// tests/system-uc-003-configure-a-model-endpoint.test.mjs; the one thing it built that UC-003 touches, ITM-1378 and ITM-1381, how a job on the CI route reads the key an endpoint's CI secret names, is not run here). Readings
// the texts leave open, which the cases state:
//   - "directly, or in Safari over the jump host's HTTPS address (UC-044, 6a 5)" is read as the Bridge record `bridge:<name>` that holds a port, with the jump host's record holding its HTTPS address and web login: every request
//     of the page to that Bridge goes to https://jump.example.test/bridge/<name>/… with the web server's login as the Authorization header and the pairing token as the Bridge's own header.
//   - "the requests of the jobs that use the endpoint" is read as a message of the prompt bar, a job of the kind `converse` run in the tab.

import test from "node:test";
import assert from "node:assert/strict";
import { JUMP_HOST, LOGIN, callsTool, configure, conversation, dump, fill, jumpHostEntries, jumpHostFront, lastTest, modelServer, openSettings, refusesBrowser, saveAndTest, startBridge, stored } from "./uc-003-harness.mjs";
import { barOf, barOver, conversationLines, inFrontOf, outside, recordsOf, sendMessage, statusOf } from "./uc-003-job-harness.mjs";

const KEY = "sk-campus-https-key-1414";
const PLACE = "Campus cluster, Germany";
const WORDS = "Which model are you, and where do you run?";
const BASIC = `Basic ${Buffer.from(`${LOGIN.user}:${LOGIN.password}`).toString("base64")}`;
const isProbe = (body) => Array.isArray(body?.tools) && body.tools.some((tool) => tool?.function?.name === "agent_m_probe");
const model = (t) => modelServer(t, (request) => (isProbe(request.body) ? callsTool() : conversation("I am the campus model.")));

// TST-266311 · level: release · module: system
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER; A CREDENTIAL IS NEVER PLACED IN A URL; NO SECRET IN THE REPOSITORY
// given: a dashboard browser that keeps the jump host (its HTTPS address https://jump.example.test and the web login web-user) and the Bridge lab at a port of its range, reached through the jump host's web server in front of the real composed Bridge; a model server on the loopback address that the browser cannot call
// input: the author configures campus with the key sk-campus-https-key-1414, the place and the context 200000 and the Bridge lab, and presses Save and test; then, on the prompt bar's page over the records Settings stored, writes "Which model are you, and where do you run?" and presses Send
// expect: known positive — the form reads "✓ tiny-model is working, can use tools." and the model server received the test request once; the job's request then reached it a second time, holding the author's words, with the key as the Authorization header and no Origin header; every request of the page to the Bridge, the test's and the job's, went to https://jump.example.test/bridge/lab/ with the web login as the Authorization header and lab's pairing token as the Bridge's own header, and none carried the key, the token or the password in its address; the page sent nothing else out; the answer stands in the conversation; no cookie was set and the repository servers got no write
test("TST-266311: UC-003 2a over the jump host's HTTPS address both the test request and a job's request go through the Bridge the endpoint names", async (t) => {
  const bridge = await startBridge(t);
  const served = await model(t);
  const ledger = [];
  const front = jumpHostFront(bridge, ledger);
  const world = await openSettings({ entries: jumpHostEntries(bridge), handlers: [front, refusesBrowser(served.origin, [])] });
  await configure(world);
  fill(world.main, { name: "campus", url: served.url, model: "tiny-model", key: KEY, place: PLACE, context: "200000", bridge: "lab" });
  assert.equal(await saveAndTest(world), "✓ tiny-model is working, can use tools.");
  assert.equal(served.seen.length, 1, "known positive: the test request reached the model server");
  const records = recordsOf(dump());
  assert.deepEqual([records["endpoint:campus"].bridge, records["bridge:lab"].port, typeof records["bridge:lab"].address], ["lab", 40100, "undefined"], "the Bridge is kept at a port, reached through the jump host");
  const tested = ledger.length;
  assert.ok(tested >= 1);
  assert.deepEqual(world.cookies, []);
  assert.deepEqual(world.server.writes, []);

  const restore = inFrontOf(front);
  try {
    const { s } = await barOver(records, { forward: () => { throw new Error("the page must not use the fixture Bridge"); } });
    assert.match(barOf(s).textContent, new RegExp(`campus — ${PLACE}`));
    await sendMessage(s, "campus", WORDS);
    assert.match(statusOf(s).textContent, new RegExp(`^Sent to:campus — ${PLACE}`));
    assert.equal(served.seen.length, 2, "the job's request reached the model server");
    const job = served.seen[1];
    assert.deepEqual([job.method, job.path, job.headers.authorization, job.headers.origin], ["POST", "/v1/chat/completions", `Bearer ${KEY}`, undefined]);
    assert.ok(JSON.stringify(job.body).includes(WORDS));
    assert.ok(conversationLines(s).some((line) => line.includes("I am the campus model.")), conversationLines(s).join(" | "));
    assert.deepEqual(outside, [], "the page sent nothing out but to the jump host");
    assert.deepEqual([s.instance.writes, s.product.writes], [[], []]);
  } finally { restore(); }
  assert.ok(ledger.length > tested, "the job's request went through the jump host too");
  assert.ok(ledger.every((request) => request.url.startsWith(`${JUMP_HOST}/bridge/lab/`)), "every request of the page to the Bridge goes to the HTTPS address");
  assert.ok(ledger.every((request) => request.headers.Authorization === BASIC && request.headers["x-agent-m-bridge-token"] === bridge.token), "each carries the web login and the pairing token, as distinct headers");
  assert.equal(ledger.some((request) => [KEY, bridge.token, LOGIN.password].some((secret) => request.url.includes(secret))), false, "none in an address");
  assert.equal(ledger.filter((request) => request.method === "POST").some((request) => (request.body ?? "").includes(KEY)), true, "known positive: the key travels in the body of the request to the Bridge");
});

// TST-266312 · level: release · module: system
// guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO; CONFIGURATION LIVES IN THE BROWSER
// given: a dashboard browser that keeps the Bridge lab behind the jump host's HTTPS address, with a web login the jump host's web server refuses (web-user with another password); a model server on the loopback address
// input: the author configures campus through lab and presses Save and test; then the page is loaded afresh over a jump host entry that holds the right login, and the author presses Save and test again
// expect: known positive — the form reads "The jump host refused its web login. Check that login in Bridge settings and save it again." and the model server received nothing; the record of campus, with its key and its Bridge, is still stored; with the right login the form reads "✓ tiny-model is working, can use tools." and the model server received one request
test("TST-266312: UC-003 2a a jump host that refuses the web login is named, nothing reaches the model and the configuration stays stored", async (t) => {
  const bridge = await startBridge(t);
  const served = await model(t);
  const wrong = jumpHostEntries(bridge, "lab", { user: LOGIN.user, password: "another-password" });
  const front = jumpHostFront(bridge, []);
  const world = await openSettings({ entries: wrong, handlers: [front, refusesBrowser(served.origin, [])] });
  await configure(world);
  fill(world.main, { name: "campus", url: served.url, model: "tiny-model", key: KEY, place: PLACE, context: "200000", bridge: "lab" });
  assert.equal(await saveAndTest(world), "The jump host refused its web login. Check that login in Bridge settings and save it again.");
  assert.equal(served.seen.length, 0, "nothing reached the model server");
  assert.deepEqual([stored("campus").key, stored("campus").bridge], [KEY, "lab"], "the configuration stays stored");
  assert.equal(lastTest("campus"), null, "the earlier test of the name does not stick, and none was recorded");
  const mended = await openSettings({ entries: { ...dump(), ...jumpHostEntries(bridge) }, handlers: [front, refusesBrowser(served.origin, [])] });
  await mended.page.go("#endpoints/campus");
  assert.equal(await saveAndTest(mended), "✓ tiny-model is working, can use tools.", "known positive: with the right login the same configuration works");
  assert.equal(served.seen.length, 1);
});
