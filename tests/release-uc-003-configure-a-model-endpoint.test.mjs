// Release coverage for UC-003 Configure a model endpoint, one or more cases for each requirement the use case realises, written from the requirements and the use case as an auditor reads them, not from the code: the map (TST-266301)
// names for each of the six requirements the release cases that guard it, and the cases check the requirement on the dashboard as a person meets it on Settings -> Endpoints & Agents — the configuration lives in the browser and in
// no other store (TST-266302), sets no cookie in any flow (TST-266303), appears in no address, link or request line (TST-266304), a browser's refusal is told apart from the endpoint's own failures and named with the runtimes
// that work instead (TST-266305), Clear leaves no credential in the browser whichever route the endpoint took (TST-266306), and no key, token or secret reaches a repository (TST-266307). The page is the real dashboard (tests/uc-003-harness.mjs);
// a Bridge is the real composed program of MOD-desktop-shell; a model server is a controlled HTTP server on the loopback address; a server the browser may call is a handler of the harness. No paid service is called.
// The Bridge over the jump host's HTTPS address is tests/release-uc-003-a-job-through-the-https-route.test.mjs'.
// Run: node --test tests/release-uc-003-configure-a-model-endpoint.test.mjs
//
// Module: MOD-settings-pages
// Module: MOD-browser-store
// Module: MOD-endpoint-calls
// Module: MOD-bridge-client
// Module: MOD-bridge-http
// Module: MOD-bridge-jobs
// Module: MOD-desktop-shell
// Guards: UC-003
// Level: release
//
// Authored by developer-sonnet-k (ITM-266), who built none of the behaviour these cases guard: the `Agent-M-Participant` trailers of the code UC-003's flow runs are listed in
// tests/system-uc-003-configure-a-model-endpoint.test.mjs. What developer-sonnet-k built that UC-003 touches, ITM-1378 and ITM-1381 (how a job on the CI route reads the key an endpoint's CI secret names), no case here runs or guards.
// Readings the texts leave open, which the cases state:
//   - "no other store" (CONFIGURATION LIVES IN THE BROWSER) is read as: the key is held by one entry of localStorage and by no request to a repository server; a browser with its own localStorage does not see it.
//   - "sets no cookie carrying configuration or credentials" is read as no assignment to `document.cookie` in any step; the spy of the harness keeps what is assigned, and records a planted assignment (the known positive).
//   - "No key, token or credential appears in a query string, a fragment, or a link" is read as: in no address a request is sent to, in the page's own address, and in no `href` the page draws.
//   - "Agent M names the reason and the runtimes that would work instead; it does not report a generic failure" (AN UNSUPPORTED ENDPOINT SAYS SO) is read for a call the browser refuses as the page's sentence that the host does not
//     accept calls from a web page and names GitHub Actions and a Bridge, with the browser's own words after it; for any other failure as the endpoint's own message, without that claim.
//   - "No API key, access token or endpoint credential is written into a repository" is read as no request to a repository server that holds one, and no write to it.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { PREFIX, answers, callsTool, configure, dump, everythingDrawn, fill, forwardTo, holding, json, keptBridge, lineOf, modelServer, openSettings, press, refusesBrowser, repositoryRequests,
  saveAndTest, startBridge, stored } from "./uc-003-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-003-configure-a-model-endpoint.md";
const SELF = "tests/release-uc-003-configure-a-model-endpoint.test.mjs";
const DIRECT = "tests/release-uc-003-direct-endpoint.test.mjs", HTTPS = "tests/release-uc-003-a-job-through-the-https-route.test.mjs", OLDER_HTTPS = "tests/release-uc-003-dashboard-https-bridge.test.mjs";

const KEY = "sk-campus-release-key-5772";
const HOST = "https://models.example.test";
const CAMPUS = { name: "campus", url: `${HOST}/v1`, model: "tiny-model", key: KEY, place: "Campus cluster, Germany", context: "32000" };
const REFUSAL = (host, said) => `✗ ${host} does not accept calls from a web page; run it through GitHub Actions (CI secret) or a Bridge. (The browser said: ${said})`;

// The six requirements UC-003 realises, each with the release cases that guard it: this file's, the release cases of the direct endpoint (ITM-270) and of the HTTPS route.
const REQUIREMENT_CASES = {
  "CONFIGURATION LIVES IN THE BROWSER": [[SELF, "TST-266302"], [DIRECT, "TST-292005"], [OLDER_HTTPS, "TST-266002"]],
  "CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE": [[SELF, "TST-266303"], [DIRECT, "TST-292005"], [OLDER_HTTPS, "TST-266002"]],
  "A CREDENTIAL IS NEVER PLACED IN A URL": [[SELF, "TST-266304"], [DIRECT, "TST-292006"], [HTTPS, "TST-266311"]],
  "AN UNSUPPORTED ENDPOINT SAYS SO": [[SELF, "TST-266305"], [DIRECT, "TST-292007"], [HTTPS, "TST-266312"]],
  "A CLEAR IS A REAL CLEAR": [[SELF, "TST-266306"], [DIRECT, "TST-292008"]],
  "NO SECRET IN THE REPOSITORY": [[SELF, "TST-266307"], [DIRECT, "TST-292006"], [HTTPS, "TST-266311"]],
};

// TST-266301 · level: release · module: system
// guards: UC-003
// given: UC-003 as committed text, which realises six requirements, and the release cases that guard them: this file's, tests/release-uc-003-direct-endpoint.test.mjs', tests/release-uc-003-a-job-through-the-https-route.test.mjs' and tests/release-uc-003-dashboard-https-bridge.test.mjs'
// input: compare the requirements UC-003 realises with the requirements mapped to release cases, and each mapped case with its declaration
// expect: known positive — UC-003 realises exactly CONFIGURATION LIVES IN THE BROWSER, CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE, A CREDENTIAL IS NEVER PLACED IN A URL, AN UNSUPPORTED ENDPOINT SAYS SO, A CLEAR IS A REAL CLEAR and NO SECRET IN THE REPOSITORY; each has at least one case of this file; every mapped case is declared in its file at the level release and names the requirement among its guards
test("TST-266301: UC-003 each requirement it realises has a release case", () => {
  const front = /^realises:\n((?:  - .+\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^  - /, "").trim());
  assert.deepEqual([...realised].sort(), Object.keys(REQUIREMENT_CASES).sort(), "known positive: the six requirements");
  for (const [requirement, cases] of Object.entries(REQUIREMENT_CASES)) {
    assert.ok(cases.some(([file]) => file === SELF), `${requirement}: a case of this file`);
    for (const [file, id] of cases) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok(declared.guards.includes(requirement), `${id} guards ${requirement}`);
    }
  }
  for (const own of testDeclarations(SELF, read(SELF))) assert.deepEqual([own.level, own.guards.includes("UC-003")], ["release", true], own.id);
});

// TST-266302 · level: release · module: system
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER
// given: two browsers of the same Pages address, A and B, each with its own localStorage, and one repository server for the instance; a server the browser may call that calls the tool it is offered
// input: in A the author configures campus (address, model, key, place, context) and presses Save and test; A is loaded afresh; B opens Settings and the route of campus
// expect: known positive — A's localStorage holds the record, the key in exactly one stored value and the model, address, place and context beside it; A loaded afresh reads all of it back; B, over the same repository server, lists no campus and its form is empty, so that Agent M has no store but the browser; the repository server was sent no write and no request holding the key
test("TST-266302: UC-003 the endpoint, its model and its key live in the browser of the person and nowhere else", async () => {
  const handler = answers(HOST, [], () => json(callsTool().body));
  const a = await openSettings({ handlers: [handler] });
  await configure(a);
  fill(a.main, CAMPUS);
  assert.equal(await saveAndTest(a), "✓ tiny-model is working, can use tools.");
  const holders = Object.entries(dump()).filter(([, value]) => value.includes(KEY));
  assert.deepEqual(holders.map(([key]) => key), [`${PREFIX}endpoint:campus`], "known positive: the key is in one stored value");
  assert.deepEqual([stored("campus").url, stored("campus").model, stored("campus").place, stored("campus").context], [CAMPUS.url, "tiny-model", CAMPUS.place, 32000]);
  assert.deepEqual([a.server.writes, holding(repositoryRequests(a), KEY, CAMPUS.url)], [[], []], "no store but the browser");
  const reloaded = await a.reload([handler]);
  await reloaded.page.go("#endpoints/campus");
  assert.deepEqual(["name", "url", "model", "key", "place", "context"].map((name) => reloaded.main.querySelector(`.endpoint-${name}`).value), ["campus", CAMPUS.url, "tiny-model", KEY, CAMPUS.place, "32000"]);
  const b = await openSettings({ handlers: [handler] });
  assert.equal(lineOf(b, "campus"), null, "another browser of the same Pages address does not see it");
  await b.page.go("#endpoints/campus");
  assert.deepEqual(["url", "model", "key"].map((name) => b.main.querySelector(`.endpoint-${name}`).value), ["", "", ""]);
  assert.deepEqual(b.server.writes, []);
});

// TST-266303 · level: release · module: system
// guards: UC-003; CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE
// given: a dashboard browser whose document keeps every assignment to document.cookie; a server the browser may call, and a Bridge (the real composed one) in front of a model server on the loopback address
// input: the author, in one browser, saves and tests campus (working), changes its key to a wrong one (refused), reloads the page, and presses Clear; in another, saves and tests an endpoint through the Bridge lab; then a cookie is assigned on purpose
// expect: known positive — each of those steps stored or removed its record in localStorage; nothing was assigned to document.cookie in any step; the deliberate assignment "probe=1" is the only one the spy keeps, so that the spy would have kept a cookie of the page
test("TST-266303: UC-003 no step of the flow, through the browser or the Bridge, sets a cookie", async (t) => {
  const bridge = await startBridge(t);
  const model = await modelServer(t);
  let good = true;
  const handler = answers(HOST, [], () => (good ? json(callsTool().body) : json({ error: { message: "Invalid API key." } }, 401)));
  const direct = await openSettings({ handlers: [handler] });
  await configure(direct);
  fill(direct.main, CAMPUS);
  await saveAndTest(direct);
  assert.equal(stored("campus").key, KEY, "known positive: the record is in localStorage");
  good = false;
  fill(direct.main, { key: "sk-wrong-key-0000" });
  await saveAndTest(direct);
  assert.equal(stored("campus").key, "sk-wrong-key-0000");
  const reloaded = await direct.reload([handler]);
  await reloaded.page.go("#endpoints/campus");
  await press(reloaded.server, reloaded.main.querySelector(".endpoint-clear"));
  assert.equal(stored("campus"), null);
  const bridged = await openSettings({ entries: keptBridge("lab", bridge), handlers: [forwardTo(bridge, []), refusesBrowser(model.origin, [])] });
  await configure(bridged);
  fill(bridged.main, { ...CAMPUS, url: model.url, bridge: "lab" });
  assert.equal(await saveAndTest(bridged), "✓ tiny-model is working, can use tools.");
  assert.equal(stored("campus").bridge, "lab");
  assert.deepEqual([direct.cookies, reloaded.cookies, bridged.cookies], [[], [], []], "no cookie in any step");
  globalThis.document.cookie = "probe=1";
  assert.deepEqual(bridged.cookies, ["probe=1"], "known positive: the spy keeps an assignment");
});

// TST-266304 · level: release · module: system
// guards: UC-003; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a server the browser may call (an OpenAI-compatible and an Anthropic endpoint), and the Bridge lab (the real composed Bridge) in front of a model server on the loopback address
// input: the author saves and tests an OpenAI-compatible endpoint with the key sk-campus-release-key-5772, an Anthropic one with the key sk-ant-release-key-8, and one through lab; presses Show on the first; and opens each route
// expect: known positive — the OpenAI-compatible key travels as the Authorization header and the Anthropic key as the x-api-key header (with the anthropic-version header), the Bridge request carries lab's pairing token as a header and the key in its body; no address any request was sent to holds a key or the token, whether in its path, its query or its fragment; the page's own address, after each step, holds none; and no link or address the page draws holds one
test("TST-266304: UC-003 no key or token is placed in an address, a query string, a fragment or a link", async (t) => {
  const bridge = await startBridge(t);
  const model = await modelServer(t);
  const ANTHROPIC = { ...CAMPUS, name: "claude", url: "https://claude.example.test/v1", model: "claude-tiny", key: "sk-ant-release-key-8", kind: "anthropic" };
  const toBridge = [];
  const handlers = [forwardTo(bridge, toBridge), refusesBrowser(model.origin, []),
    answers("https://claude.example.test", [], () => json({ content: [{ type: "tool_use", id: "t1", name: "agent_m_probe", input: {} }] })), answers(HOST, [], () => json(callsTool().body))];
  const world = await openSettings({ entries: keptBridge("lab", bridge), handlers });
  const addresses = [];
  for (const fields of [CAMPUS, ANTHROPIC, { ...CAMPUS, name: "bridged", url: model.url, key: "sk-bridged-release-key-3", bridge: "lab" }]) {
    await configure(world);
    fill(world.main, fields);
    assert.match(await saveAndTest(world), /is working, can use tools\.$/, fields.name);
    await press(world.server, world.main.querySelector(".endpoint-show"));
    addresses.push(globalThis.location.href, everythingDrawn(world.main));
  }
  const secrets = [KEY, ANTHROPIC.key, "sk-bridged-release-key-3", bridge.token];
  const carried = world.sent.filter((request) => request.origin === "https://claude.example.test" || request.url.startsWith(HOST));
  assert.deepEqual(carried.map((request) => [request.url, request.headers.Authorization, request.headers["x-api-key"], request.headers["anthropic-version"]]),
    [[`${HOST}/v1/chat/completions`, `Bearer ${KEY}`, undefined, undefined], ["https://claude.example.test/v1/messages", undefined, ANTHROPIC.key, "2023-06-01"]], "known positive: each key travels in its header");
  const posts = toBridge.filter((request) => request.method === "POST");
  assert.deepEqual([posts.length, posts[0].headers["x-agent-m-bridge-token"], posts[0].body.includes("sk-bridged-release-key-3")], [1, bridge.token, true], "known positive: the token as a header, the key in the body");
  assert.deepEqual(world.sent.filter((request) => secrets.some((secret) => request.url.includes(secret) || decodeURIComponent(request.url).includes(secret))), [], "no address holds a key or the token");
  assert.deepEqual(world.sent.filter((request) => new URL(request.url).search !== "" && request.origin !== "https://api.github.com").map((request) => request.url), [], "the endpoint and Bridge requests carry no query string");
  assert.deepEqual(addresses.filter((text) => secrets.slice(0, 3).some((secret) => text.includes(secret)) && text.startsWith("http")), [], "the page's own address holds no key");
  assert.equal(world.main.querySelector(".endpoint-key").type, "text", "known positive: Show revealed the key in its field, and the field is no link");
  assert.equal(everythingDrawn(world.main).includes("href"), false);
});

// TST-266305 · level: release · module: system
// guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO
// given: servers that fail in the browser's way — fetch fails with "Failed to fetch", with "Blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present", and (an Anthropic endpoint) with "anthropic-dangerous-direct-browser-access header is required" — and servers that answer in their own: HTTP 401 "Invalid API key.", 404 "The model tiny-model does not exist.", 429 "Rate limit reached." and 500 "The upstream server failed."
// input: the author presses Save and test for each, one after the other
// expect: known positive — for each failure of the browser the form reads "✗ <host> does not accept calls from a web page; run it through GitHub Actions (CI secret) or a Bridge. (The browser said: <its words>)" and the endpoint's line reads "Refused: <host> does not accept calls…"; for each answer of the endpoint the form reads "✗ <its own message>" and neither names a web page, GitHub Actions nor a Bridge, and the line reads "Refused."; each sent one request
test("TST-266305: UC-003 a browser's refusal names the reason and the runtimes that would work, an endpoint's own failure is its own message", async () => {
  const failures = [
    { name: "failed", host: "failed.example.test", fails: new TypeError("Failed to fetch") },
    { name: "blocked", host: "blocked.example.test", fails: new TypeError("Blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present") },
    { name: "optin", host: "optin.example.test", kind: "anthropic", fails: new TypeError("anthropic-dangerous-direct-browser-access header is required") },
  ];
  const answered = [["key", 401, "Invalid API key."], ["missing", 404, "The model tiny-model does not exist."], ["limited", 429, "Rate limit reached."], ["down", 500, "The upstream server failed."]];
  const ledger = [];
  const handler = async (url, init) => {
    if (!url.hostname.endsWith(".example.test")) return null;
    ledger.push(url.hostname);
    const failure = failures.find((each) => each.host === url.hostname);
    if (failure) throw failure.fails;
    const [, status, message] = answered.find(([name]) => `${name}.example.test` === url.hostname);
    return json({ error: { message } }, status);
  };
  const world = await openSettings({ handlers: [handler] });
  const shown = {};
  for (const [name, host, kind] of [...failures.map((each) => [each.name, each.host, each.kind]), ...answered.map(([name]) => [name, `${name}.example.test`, undefined])]) {
    await configure(world);
    fill(world.main, { ...CAMPUS, name, url: `https://${host}/v1`, kind: kind ?? "openai-compatible" });
    shown[name] = await saveAndTest(world);
  }
  for (const each of failures) {
    assert.equal(shown[each.name], REFUSAL(each.host, each.fails.message), each.name);
    assert.equal(lineOf(world, each.name).querySelector(".settings-endpoint-status").textContent.startsWith(`Refused: ${each.host} does not accept calls from a web page; run it through GitHub Actions (CI secret) or a Bridge.`), true, each.name);
  }
  for (const [name, , message] of answered) {
    assert.equal(shown[name], `✗ ${message}`, name);
    assert.doesNotMatch(shown[name], /web page|GitHub Actions|Bridge/);
    assert.equal(lineOf(world, name).querySelector(".settings-endpoint-status").textContent, "Refused.", name);
  }
  assert.deepEqual(ledger, [...failures.map((each) => each.host), ...answered.map(([name]) => `${name}.example.test`)], "one request each");
});

// TST-266306 · level: release · module: system
// guards: UC-003; A CLEAR IS A REAL CLEAR
// given: three endpoints stored and tested in one dashboard browser, one reached directly, one through the Bridge lab (the real composed Bridge) and one naming a CI secret, each with its own key
// input: the author clears the first and the second in their form, loads the page afresh, and clears the third on its line of the tab; the page is loaded afresh again
// expect: known positive — before the first Clear localStorage holds all three keys; after each Clear no entry of that endpoint (neither its record nor its last test) is left and no stored value holds its key; the entry of the Bridge lab stays; after the last Clear no stored value holds any of the three keys, and the tab, loaded afresh, lists none of them
test("TST-266306: UC-003 Clear removes the stored credentials, whichever route the endpoint took, not only the form's fields", async (t) => {
  const bridge = await startBridge(t);
  const model = await modelServer(t);
  const keys = { direct: "sk-direct-release-key-1", bridged: "sk-bridged-release-key-2", ci: "sk-ci-release-key-3" };
  const handlers = [forwardTo(bridge, []), refusesBrowser(model.origin, []), answers(HOST, [], () => json(callsTool().body))];
  const world = await openSettings({ entries: keptBridge("lab", bridge), handlers });
  for (const fields of [{ ...CAMPUS, name: "direct", key: keys.direct }, { ...CAMPUS, name: "bridged", url: model.url, key: keys.bridged, bridge: "lab" }, { ...CAMPUS, name: "ci", key: keys.ci, secret: "CI_RELEASE_KEY" }]) {
    await configure(world);
    fill(world.main, fields);
    await saveAndTest(world);
  }
  const holdersOf = (key) => Object.entries(dump()).filter(([, value]) => value.includes(key)).map(([entry]) => entry.slice(PREFIX.length));
  assert.deepEqual([holdersOf(keys.direct), holdersOf(keys.bridged), holdersOf(keys.ci)], [["endpoint:direct"], ["endpoint:bridged"], ["endpoint:ci"]], "known positive: localStorage holds all three keys");
  assert.deepEqual(Object.keys(dump()).filter((entry) => entry.includes("last-test")).length, 2, "known positive: two of them have a last test (the one handed to CI is not called from the page)");
  for (const name of ["direct", "bridged"]) {
    await world.page.go(`#endpoints/${name}`);
    await press(world.server, world.main.querySelector(".endpoint-clear"));
    assert.deepEqual(Object.keys(dump()).filter((entry) => entry.includes(`endpoint:${name}`)), [], `${name}: no entry is left`);
    assert.deepEqual(holdersOf(keys[name]), [], `${name}: no stored value holds its key`);
  }
  assert.ok(dump()[`${PREFIX}bridge:lab`], "the Bridge's entry stays");
  const again = await world.reload(handlers);
  assert.deepEqual([lineOf(again, "direct"), lineOf(again, "bridged")], [null, null]);
  const line = lineOf(again, "ci");
  assert.ok(line, "known positive: the third is still listed");
  await press(again.server, line.querySelector("button.settings-endpoint-clear"));
  assert.deepEqual(Object.values(dump()).filter((value) => Object.values(keys).some((key) => value.includes(key))), [], "no stored value holds any of the three keys");
  const last = await again.reload(handlers);
  assert.deepEqual(["direct", "bridged", "ci"].map((name) => lineOf(last, name)), [null, null, null]);
});

// TST-266307 · level: release · module: system
// guards: UC-003; NO SECRET IN THE REPOSITORY
// given: a dashboard browser whose repository server is the instance's; a server the browser may call; an endpoint reached through the Bridge lab (the real composed Bridge) kept with a pairing token; an endpoint naming the CI secret CAMPUS_API_KEY
// input: the author saves and tests the three endpoints (direct, through lab, naming a CI secret), once working and once refused, and clears one
// expect: known positive — the keys and the pairing token are sent to the model server, the Bridge and the browser's storage; the page sent the repository servers reads only and no write, and no request to a repository server holds a key, the token, the CI secret's name as a value, or the address of the endpoint; no write reached the repository server
test("TST-266307: UC-003 no key, token or endpoint credential reaches a repository", async (t) => {
  const bridge = await startBridge(t);
  const model = await modelServer(t);
  let open = true;
  const toBridge = [];
  const keys = ["sk-direct-release-key-1", "sk-bridged-release-key-2", "sk-ci-release-key-3"];
  const world = await openSettings({ entries: keptBridge("lab", bridge), handlers: [forwardTo(bridge, toBridge), refusesBrowser(model.origin, []),
    answers(HOST, [], () => (open ? json(callsTool().body) : json({ error: { message: "Invalid API key." } }, 401)))] });
  const flows = [{ ...CAMPUS, name: "direct", key: keys[0] }, { ...CAMPUS, name: "bridged", url: model.url, key: keys[1], bridge: "lab" }, { ...CAMPUS, name: "ci", key: keys[2], secret: "CAMPUS_API_KEY" }];
  for (const round of [true, false]) {
    open = round;
    for (const fields of flows) { await configure(world); fill(world.main, fields); await saveAndTest(world); }
  }
  await world.page.go("#endpoints/direct");
  await press(world.server, world.main.querySelector(".endpoint-clear"));
  assert.ok(keys.every((key) => holding(world.sent, key).length > 0 || key === keys[2]), "known positive: the keys of the first two were sent, to the model server and to the Bridge");
  assert.equal(holding(world.sent, bridge.token).length > 0, true, "known positive: the pairing token was sent, to the Bridge");
  assert.ok(repositoryRequests(world).length > 0, "known positive: the page read the repository server");
  const writes = repositoryRequests(world).filter((request) => request.method !== "GET" && !(request.url.endsWith("/graphql") && !/mutation/.test(request.body ?? "")));
  assert.deepEqual(writes, [], "no write was sent to a repository server (a GraphQL query reads)");
  assert.ok(repositoryRequests(world).some((request) => request.method === "POST" && request.url.endsWith("/graphql")), "known positive: the filter sees a request that is no GET");
  assert.deepEqual(holding(repositoryRequests(world), ...keys, bridge.token, CAMPUS.url, model.url), [], "no request to a repository server holds a key, the token or an endpoint's address");
  assert.deepEqual(world.server.writes, [], "the repository server got no write");
});
