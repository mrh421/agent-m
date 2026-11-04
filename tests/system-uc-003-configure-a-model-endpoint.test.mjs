// System coverage for UC-003 Configure a model endpoint, walked as an author meets it on Settings -> Endpoints & Agents: the flow map (TST-266201) names, for every step of the main flow, every alternative flow and the
// postcondition, the executable tests that walk it, the finding where the page does otherwise, or the reason it is not walked; and the cases walk the use case as a whole on the dashboard — Configure a model endpoint, the
// form's fields, Save and test, a model that calls the tool it is offered (main flow 1 to 5), the page loaded afresh over the same browser (3), a model that answers without the tool or rejects it (5a), a browser that may not
// call the endpoint (4a), a wrong key (4b), Clear (2b), the name of a CI secret (2), and an endpoint reached through a Bridge chosen among the Bridges this browser keeps — the short test request, a wrong key, a rejected tool
// and Clear through it (2a). The page is the real dashboard over the real MOD-settings-pages, MOD-browser-store, MOD-endpoint-calls and MOD-bridge-client; a Bridge is the real composed program of MOD-desktop-shell
// (MOD-bridge-http's server and MOD-bridge-jobs' handlers), and a model server is a controlled HTTP server that counts what it receives (tests/uc-003-harness.mjs). No request leaves the process and no paid service is called.
// A job's request through the Bridge is the other file's: tests/system-uc-003-a-job-through-the-bridge.test.mjs.
// Run: node --test tests/system-uc-003-configure-a-model-endpoint.test.mjs
//
// Module: MOD-settings-pages
// Module: MOD-browser-store
// Module: MOD-endpoint-calls
// Module: MOD-bridge-client
// Module: MOD-bridge-http
// Module: MOD-bridge-jobs
// Module: MOD-desktop-shell
// Guards: UC-003
// Level: system
//
// Authored by developer-sonnet-k (ITM-266). The `Agent-M-Participant` trailers of the code UC-003's flow runs (src/settings-pages/endpoints.mjs and settings.mjs, src/browser-store, src/endpoint-calls, src/bridge-client,
// src/bridge-http, src/bridge-jobs, src/desktop-shell) name developer-sonnet-a, b, c and d, developer-opus-a, b and f, developer-terra-a and c, developer-sol-b and developer-sonnet-j, besides commits that carry no trailer;
// developer-sonnet-k built none of it (checked with `git log --format=%(trailers:key=Agent-M-Participant) -- <those folders>`; its commits on `src/` lie in MOD-runtimes, MOD-workflow-entries, MOD-review-pages, MOD-implementation-pages,
// MOD-work-plans, MOD-trace-pages, MOD-test-document and others). Of what UC-003 touches it built ITM-1378 and ITM-1381, how a job on the CI route reads the key an endpoint's CI secret names (MOD-runtimes, MOD-workflow-entries):
// no case guards it; the CI secret is walked here only as the name the form stores (TST-266208). Where the page and UC-003 disagree the case follows UC-003 and is marked `todo` with the word FINDING and its module (named in
// FLOW_FINDINGS). Each case states its input and its expected values in its own text and proves them against a known positive in the same case; none reads an expected result from the SPEC, a use case or an architecture file,
// but the flow map, which holds the expected passages itself and checks that UC-003 still says them. Readings the texts leave open, which the cases state:
//   - "The author opens the configuration screen" (1) is read as Settings -> Endpoints & Agents -> Configure a model endpoint, the route the dashboard's menu leads to.
//   - "the model's context in tokens" and "the place where the endpoint processes data" (2) are read as the form's Context and Processing place fields; "the name of the CI secret" as its CI secret field.
//   - "Agent M stores them" (3) is read as the record `endpoint:<name>` below the instance's prefix, written before the request of step 4 is sent; "sets no cookie" as no assignment to `document.cookie`.
//   - "Agent M names the reason and the runtimes that would work instead" (4a) is read as the page's sentence that the host does not accept calls from a web page and names GitHub Actions and a Bridge.
//   - "The key stays stored until the author changes or clears it" (4b) is read as the key being in the record after the refusal and after the page is loaded afresh, replaced by the new key once the author changes it.
//   - "confirms that nothing is stored" (2b) is read as the form's line that the configuration is cleared from this browser, and the endpoint's line leaving the tab.
//   - An endpoint that names a CI secret and no Bridge is tested as a test job on GitHub Actions (MOD-settings-pages, `endpoints`), and a Bridge's test is its own step 4; both are the "one short test request".

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { openStore } from "../src/browser-store/index.mjs";
import { endpointsOffered } from "../src/prompt-bar/index.mjs";
import { INSTANCE, PREFIX, PROBE_PROMPT, answers, callsTool, configure, dump, everythingDrawn, fill, forwardTo, holding, json, keptBridge, lastTest, ledgerText, lineOf, modelServer, openSettings,
  press, refusesBrowser, refusesKey, refusesTools, repositoryRequests, REPOSITORY_ORIGINS, saveAndTest, saysText, startBridge, stored } from "./uc-003-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-003-configure-a-model-endpoint.md";
const SELF = "tests/system-uc-003-configure-a-model-endpoint.test.mjs";
const JOB = "tests/system-uc-003-a-job-through-the-bridge.test.mjs";
const RELEASE = "tests/release-uc-003-configure-a-model-endpoint.test.mjs";
const DIRECT = "tests/system-uc-003-direct-endpoint.test.mjs", BRIDGE = "tests/system-uc-003-dashboard-bridge.test.mjs";

const KEY = "sk-campus-system-key-3141";
const HOST = "https://models.example.test";
const CAMPUS = { name: "campus", url: `${HOST}/v1`, model: "tiny-model", key: KEY, place: "Campus cluster, Germany", context: "32000" };
const TOOL_MESSAGE = "This model does not support tools.";
const bearer = (key) => `Bearer ${key}`;
const probeBody = (model) => ({ model, messages: [{ role: "user", content: PROBE_PROMPT }], max_tokens: 64, stream: false,
  tools: [{ type: "function", function: { name: "agent_m_probe", description: "Report that tool calling works without changing anything.", parameters: { type: "object", properties: {}, additionalProperties: false } } }] });
const keysOf = (name) => Object.keys(dump()).filter((key) => key.includes(`endpoint:${name}`)).map((key) => key.slice(PREFIX.length)).sort();
const optionsOf = (select) => select.children.map((option) => [option.value, option.textContent]);

// ---------------------------------------------------------------- the flow map

// The passages of UC-003 the system tests walk, each with the executable tests that walk it: this file's cases, the other system files', and the older tests of the endpoint form, which declare the level system or component.
const FLOW_EVIDENCE = {
  "main-1-open": { uc: "The author opens the configuration screen.", evidence: [[SELF, "TST-266202"], [DIRECT, "TST-292001"]] },
  "main-2-fields": { uc: "The author enters endpoint URL, model name and API key, the place where the endpoint processes data", evidence: [[SELF, "TST-266202"], [SELF, "TST-266208"]] },
  "main-3-stores": { uc: "Agent M stores them in the browser's `localStorage` of the Agent M site; it sets no cookie.", evidence: [[SELF, "TST-266202"], [DIRECT, "TST-292001"]] },
  "main-4-request": { uc: "Agent M sends one short test request to the endpoint, which offers the model one tool and asks it to call it.", evidence: [[SELF, "TST-266202"], [DIRECT, "TST-292001"]] },
  "main-5-working": { uc: "The endpoint answers; Agent M shows the configuration as working, and whether the model called the tool", evidence: [[SELF, "TST-266202"], [SELF, "TST-266204"]] },
  "main-5-offered": { uc: "The endpoint is offered in the prompt bar with its place (UC-049, step 1)", evidence: [[SELF, "TST-266202"], [JOB, "TST-266221"]] },
  "4a-browser": { uc: "- **4a. The endpoint refuses calls from a browser.** Agent M names the reason", evidence: [[SELF, "TST-266205"], [DIRECT, "TST-292003"]] },
  "2a-bridge": { uc: "The author names the Bridge that reaches it, chosen among the Bridges this browser keeps", evidence: [[SELF, "TST-266209"], [BRIDGE, "TST-266001"]] },
  "2a-test-through": { uc: "Step 4's test request goes through that Bridge, and so do the requests of the jobs that use the endpoint.", evidence: [[SELF, "TST-266209"], [JOB, "TST-266221"]] },
  "2a-no-bridge": { uc: "A server in the LAN that the browser can call — over HTTPS with a certificate the browser trusts, allowing the instance's address — needs no Bridge.", evidence: [[SELF, "TST-266202"]] },
  "5a-text-only": { uc: "- **5a. The endpoint answers but rejects the tool, or answers without calling it.** The configuration is shown as working, *text only*; the endpoint's message, if it gave one, is shown folded.", evidence: [[SELF, "TST-266204"], [SELF, "TST-266211"]] },
  "4b-key": { uc: "- **4b. The key is wrong.** Agent M shows the endpoint's error message; the key stays stored until the author changes or clears it.", evidence: [[SELF, "TST-266206"], [SELF, "TST-266210"], [DIRECT, "TST-292004"]] },
  "2b-clear": { uc: "- **2b. The author clears the configuration.** Agent M removes the entries from `localStorage`, not only from the form, and confirms that nothing is stored.", evidence: [[SELF, "TST-266207"], [SELF, "TST-266212"], [DIRECT, "TST-292004"]] },
  "2b-line": { uc: "and confirms that nothing is stored.", evidence: [[SELF, "TST-266213"]] },
  "post-browser": { uc: "The configuration exists only in this browser; an endpoint the browser cannot call names the Bridge that reaches it.", evidence: [[SELF, "TST-266203"], [SELF, "TST-266209"]] },
  "post-key": { uc: "The key has not appeared in a URL, a cookie, or any repository.", evidence: [[SELF, "TST-266202"], [SELF, "TST-266208"], [JOB, "TST-266221"]] },
};
// The passages the page does otherwise: the finding, its case, and the module it points to.
const FLOW_FINDINGS = {
};
// The passages no code of this product carries here, with the reason.
const NOT_WALKED = {
  "main-5-preset": { uc: "A participant on this endpoint is preset accordingly (UC-017, step 4).", reason: "presetting a participant from the endpoint's last test is UC-017's step, whose battery (tests/system-uc-017-configure-participants.test.mjs) walks it; this file shows the last test it presets from (TST-266202, TST-266204)" },
  "main-5-loop": { uc: "a model that can use tools works in its loop (UC-049, step 4)", reason: "the loop is UC-049's step 4, whose battery walks it; this file shows that the endpoint is offered with the capability use tools only where its test found the model calling the tool (TST-266202, TST-266204)" },
  "2a-forward": { uc: "reached through an SSH forward or through the jump host", reason: "the SSH forward and the jump host's web server are provisioned by UC-011 and UC-044, whose batteries walk them; the Bridge's address as Settings keeps it is walked here, the HTTPS forwarding fixture in tests/release-uc-003-a-job-through-the-https-route.test.mjs" },
};

// TST-266201 · level: system · module: system
// guards: UC-003
// given: UC-003 as committed text, the executable tests named in FLOW_EVIDENCE, the findings named in FLOW_FINDINGS and the flows named in NOT_WALKED (the preset of a participant, the loop of a tool-calling model, the SSH forward and the jump host's web server)
// input: compare every passage of the main flow, steps 1 to 5, of the alternative flows and of the postcondition with its executable evidence, its finding or the reason it is not walked
// expect: every named passage stands in UC-003; every evidence file exists and declares its TST id; this file's cases declare the level system; every finding's case stands in its file with the todo naming FINDING and its module; every alternative flow UC-003 names is among the passages; known positive: UC-003 names exactly the five alternative flows 4a, 2a, 5a, 4b and 2b, and each of the five main steps has a passage
test("TST-266201: UC-003 every passage of the main flow and of each alternative flow has an executable test, a finding or a stated reason", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  const missing = [];
  for (const [name, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-003 says "${needle}"`);
    assert.ok(evidence.length > 0, `${name}: a test is named`);
    for (const [file, id] of evidence) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      if (!declared) missing.push(`${name}: ${id} in ${file}`);
      else assert.ok(["system", "component"].includes(declared.level), `${id} is a system or component test`);
      if (declared && [SELF, JOB].includes(file)) assert.equal(declared.level, "system", `${id} is a system test`);
    }
  }
  assert.deepEqual(missing, [], "every evidence test is declared in its file");
  for (const [name, { uc: needle, finding, file, test: id, module }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-003 says "${needle}"`);
    assert.ok(read(file).includes(`// ${id} `), `${name}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} (${module})`), `${name}: the todo of ${id} names FINDING ${finding} and ${module}`);
  }
  for (const [name, { uc: needle, reason }] of Object.entries(NOT_WALKED)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-003 says "${needle}"`);
    assert.ok(reason.length > 20, `${name}: its reason is stated`);
  }
  const flows = [...uc.matchAll(/- \*\*(\d+[a-z])\. /g)].map((match) => match[1]).sort();
  assert.deepEqual(flows, ["2a", "2b", "4a", "4b", "5a"], "known positive: UC-003 names these five alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS, ...NOT_WALKED }).map((key) => key.split("-")[0]));
  assert.deepEqual(flows.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
  const steps = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS, ...NOT_WALKED }).filter((key) => key.startsWith("main-")).map((key) => Number(key.split("-")[1])));
  assert.deepEqual([...steps].sort((a, b) => a - b), [1, 2, 3, 4, 5], "each step of the main flow is among the passages");
  for (const own of testDeclarations(SELF, read(SELF))) assert.deepEqual([own.level, own.guards.includes("UC-003")], ["system", true], own.id);
  assert.ok([JOB, RELEASE, "tests/release-uc-003-a-job-through-the-https-route.test.mjs"].every((file) => existsSync(new URL(`../${file}`, import.meta.url))), "the job file and the release files exist");
});

// ---------------------------------------------------------------- the main flow

// TST-266202 · level: system · module: system
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER; CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE; A CREDENTIAL IS NEVER PLACED IN A URL; NO SECRET IN THE REPOSITORY
// given: a dashboard browser with no endpoint configured and no Bridge kept, whose Settings tab Endpoints & Agents is open; https://models.example.test is a server the browser may call and whose model calls the tool it is offered
// input: the author presses Configure a model endpoint, enters the name campus, the address https://models.example.test/v1, the model tiny-model, the key sk-campus-system-key-3141, the place "Campus cluster, Germany" and the context 32000, and presses Save and test
// expect: known positive — the record endpoint:campus holds exactly url, kind openai-compatible, model, key, place and context 32000, below the instance's prefix, and it was already stored when the request arrived; exactly one request went to https://models.example.test/v1/chat/completions, with the key in the Authorization header alone and a body of the model, the one short message and the one tool agent_m_probe; the form reads "✓ tiny-model is working, can use tools."; the browser sent nothing to a Bridge or any other server than the repository servers and the endpoint; nothing was assigned to document.cookie; the repository server got no write, and no request to a repository server holds the key (the one request that holds it is the endpoint's); the address of the page holds no key; the prompt bar offers campus with its place "Campus cluster, Germany" and the capability use tools
test("TST-266202: UC-003 1 to 5 the author configures an endpoint, it is stored before one short request offers the model a tool, and the page shows it working and able to use tools", async () => {
  const ledger = [], atRequest = [];
  const world = await openSettings({ handlers: [answers(HOST, ledger, () => { atRequest.push(stored("campus")); return json(callsTool().body); })] });
  assert.equal(lineOf(world, "campus"), null, "known positive: no endpoint is configured yet");
  await configure(world);
  fill(world.main, CAMPUS);
  const shown = await saveAndTest(world);
  const record = { url: CAMPUS.url, kind: "openai-compatible", model: "tiny-model", key: KEY, place: CAMPUS.place, context: 32000 };
  assert.deepEqual(stored("campus"), record, "the record below the instance's prefix");
  assert.deepEqual(atRequest, [record], "failure node: the record was stored before the request arrived");
  assert.deepEqual(keysOf("campus"), ["endpoint:campus", "last-test:endpoint:campus"], "only the endpoint and its last test");
  assert.equal(ledger.length, 1, "one short test request");
  assert.deepEqual([ledger[0].method, ledger[0].url, ledger[0].headers.Authorization], ["POST", `${CAMPUS.url}/chat/completions`, bearer(KEY)], "known positive: the key is in the Authorization header");
  assert.deepEqual(JSON.parse(ledger[0].body), probeBody("tiny-model"), "the short message and the one tool");
  assert.equal(ledger[0].url.includes(KEY), false);
  assert.equal(shown, "✓ tiny-model is working, can use tools.");
  assert.deepEqual(lastTest("campus").tools, true);
  assert.deepEqual(world.sent.filter((request) => !REPOSITORY_ORIGINS.includes(request.origin) && request.origin !== HOST), [], "the browser sent nothing to a Bridge or any other server");
  assert.deepEqual(world.cookies, [], "no cookie was set");
  assert.deepEqual(world.server.writes, [], "the repository server got no write");
  assert.ok(repositoryRequests(world).length > 0, "known positive: the page's reads of the repository server are seen");
  assert.deepEqual(holding(repositoryRequests(world), KEY), [], "no request to a repository server holds the key");
  assert.equal(holding(world.sent, KEY).length, 1, "known positive: the one request that holds the key is the endpoint's");
  assert.equal(`${globalThis.location.href}`.includes(KEY), false, "the address of the page holds no key");
  const offered = endpointsOffered(openStore(INSTANCE));
  assert.deepEqual(offered.map((each) => [each.name, each.place, each.model, each.capabilities.includes("use tools")]), [["campus", "Campus cluster, Germany", "tiny-model", true]], "the prompt bar offers it with its place");
});

// TST-266203 · level: system · module: system
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER
// given: the endpoint campus of TST-266202 saved and working in a dashboard browser, and the same page loaded afresh over the same localStorage; and a second browser with an empty localStorage
// input: the page is loaded afresh and the author opens the Settings tab, and then the route of campus; the second browser opens the same
// expect: known positive — after the new load the tab lists campus with "Works. Last successful test", and the form reads every field as it was entered (name, address, model, key, place, context 32000) with the key hidden until Show; the second browser lists no campus and its form for campus is empty
test("TST-266203: UC-003 3 a configuration survives a fresh load of the page, in this browser only", async () => {
  const handler = answers(HOST, [], () => json(callsTool().body));
  const first = await openSettings({ handlers: [handler] });
  await configure(first);
  fill(first.main, CAMPUS);
  await saveAndTest(first);
  const again = await first.reload([handler]);
  const line = lineOf(again, "campus");
  assert.ok(line, "known positive: the tab lists campus after the page is loaded afresh");
  assert.match(line.querySelector(".settings-endpoint-status").textContent, /^Works\. Last successful test: \d{4}-\d\d-\d\dT/);
  await again.page.go("#endpoints/campus");
  const field = (name) => again.main.querySelector(`.endpoint-${name}`);
  assert.deepEqual(["name", "url", "model", "key", "place", "context"].map((name) => field(name).value), ["campus", CAMPUS.url, "tiny-model", KEY, CAMPUS.place, "32000"]);
  assert.equal(field("key").type, "password", "the key is hidden until Show");
  const empty = await openSettings({ handlers: [handler] });
  assert.equal(lineOf(empty, "campus"), null, "a second browser has no endpoint");
  await empty.page.go("#endpoints/campus");
  assert.deepEqual(["name", "url", "model", "key"].map((name) => empty.main.querySelector(`.endpoint-${name}`).value), ["campus", "", "", ""], "its form for campus is empty");
});

// ---------------------------------------------------------------- 5a, 4a, 4b, 2b

// TST-266204 · level: system · module: system
// guards: UC-003
// given: three servers the browser may call: plain answers with the text "I cannot call tools." and no tool call, strict rejects the request with HTTP 400 "This model does not support tools.", and the server of TST-266202 calls the tool
// input: the author configures plain and strict, one after the other, with a place and a context, and presses Save and test; and the server that calls the tool
// expect: known positive — the one that calls the tool reads "can use tools" and shows no message; plain reads "✓ plain-model is working, text only." with a folded "The endpoint's message" holding "I cannot call tools."; strict reads "✓ strict-model is working, text only." with the folded message "This model does not support tools."; the last test of both says working without the tool, so the prompt bar offers neither with the capability use tools
test("TST-266204: UC-003 5a a model that answers without the tool or rejects it is shown working, text only, with the endpoint's message folded", async () => {
  const reply = (url, init) => {
    if (url.hostname === "plain.example.test") return json(saysText("I cannot call tools.").body);
    if (url.hostname === "strict.example.test") return json(refusesTools(TOOL_MESSAGE).body, 400);
    return json(callsTool().body);
  };
  const world = await openSettings({ handlers: [async (url, init) => (url.origin.endsWith(".example.test") ? reply(url, init) : null)] });
  const result = async (fields) => { await configure(world); fill(world.main, fields); return saveAndTest(world); };
  assert.equal(await result({ ...CAMPUS, name: "capable", url: "https://capable.example.test/v1", model: "capable-model" }), "✓ capable-model is working, can use tools.");
  assert.equal(world.main.querySelector(".endpoint-tool-message"), null, "known positive: a model that calls the tool shows no message");
  assert.equal(await result({ ...CAMPUS, name: "plain", url: "https://plain.example.test/v1", model: "plain-model" }), "✓ plain-model is working, text only. The endpoint's messageI cannot call tools.");
  const plain = world.main.querySelector(".endpoint-tool-message");
  assert.deepEqual([plain.localName, plain.children[0].localName, plain.children[0].textContent, plain.textContent], ["details", "summary", "The endpoint's message", "The endpoint's messageI cannot call tools."], "folded");
  assert.equal(await result({ ...CAMPUS, name: "strict", url: "https://strict.example.test/v1", model: "strict-model" }), `✓ strict-model is working, text only. The endpoint's message${TOOL_MESSAGE}`);
  assert.equal(world.main.querySelector(".endpoint-tool-message").textContent, `The endpoint's message${TOOL_MESSAGE}`);
  assert.deepEqual(["capable", "plain", "strict"].map((name) => lastTest(name).tools), [true, false, false]);
  const offered = endpointsOffered(openStore(INSTANCE));
  assert.deepEqual(offered.map((each) => [each.name, each.capabilities.includes("use tools")]), [["capable", true], ["plain", false], ["strict", false]]);
});

// TST-266205 · level: system · module: system
// guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO
// given: a dashboard browser; the address https://models.example.test/v1 is a server the browser may not call: its fetch fails with the browser's TypeError "Failed to fetch"; the same server answers when the browser may call it
// input: the author configures campus with its key and presses Save and test; then the browser may call the server and the author presses Save and test again
// expect: known positive — the form reads "✗ models.example.test does not accept calls from a web page; run it through GitHub Actions (CI secret) or a Bridge. (The browser said: Failed to fetch)", naming the host, GitHub Actions and a Bridge; the record with its key is still stored, and the tab's line for campus reads "Refused:" and the same plain sentence; the second test reads "✓ tiny-model is working, can use tools." and the line reads "Works."
test("TST-266205: UC-003 4a a browser's refusal is named with the runtimes that would work instead", async () => {
  let open = false;
  const ledger = [];
  const world = await openSettings({ handlers: [answers(HOST, ledger, () => {
    if (!open) throw new TypeError("Failed to fetch");
    return json(callsTool().body);
  })] });
  await configure(world);
  fill(world.main, CAMPUS);
  const shown = await saveAndTest(world);
  assert.match(shown, /^✗ models\.example\.test does not accept calls from a web page; run it through GitHub Actions \(CI secret\) or a Bridge\. \(The browser said: Failed to fetch\)/);
  assert.equal(ledger.length, 1, "the request was tried once");
  assert.equal(stored("campus").key, KEY, "the key is still stored");
  assert.deepEqual([lastTest("campus").outcome, lastTest("campus").browser], ["refused", true]);
  const line = lineOf(world, "campus");
  assert.ok(line, "the tab lists the endpoint the browser may not call");
  assert.match(line.querySelector(".settings-endpoint-status").textContent, /^Refused: models\.example\.test does not accept calls from a web page; run it through GitHub Actions \(CI secret\) or a Bridge\./);
  open = true;
  assert.equal(await saveAndTest(world), "✓ tiny-model is working, can use tools.", "known positive: the same configuration works where the browser may call the server");
  assert.match(lineOf(world, "campus").querySelector(".settings-endpoint-status").textContent, /^Works\./);
});

// TST-266206 · level: system · module: system
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER
// given: a server the browser may call that answers HTTP 401 {"error":{"message":"Invalid API key."}} to any key but sk-campus-system-key-3141
// input: the author configures campus with the key sk-wrong-key-0000 and presses Save and test; the page is loaded afresh; the author enters the right key and presses Save and test
// expect: known positive — the form reads "✗ Invalid API key." (the endpoint's message, and no claim that the browser refused); the record still holds sk-wrong-key-0000, and so does the form after the new load; after the right key is saved and tested the form reads "✓ tiny-model is working, can use tools." and no stored value holds the wrong key
test("TST-266206: UC-003 4b a wrong key shows the endpoint's message and stays stored until the author changes it", async () => {
  const handler = answers(HOST, [], (url, init) => init.headers.Authorization === bearer(KEY) ? json(callsTool().body) : json(refusesKey().body, 401));
  const world = await openSettings({ handlers: [handler] });
  await configure(world);
  fill(world.main, { ...CAMPUS, key: "sk-wrong-key-0000" });
  const shown = await saveAndTest(world);
  assert.equal(shown, "✗ Invalid API key.");
  assert.equal(shown.includes("web page"), false, "the browser is not blamed");
  assert.equal(stored("campus").key, "sk-wrong-key-0000", "known positive: the wrong key stays stored");
  assert.equal(lastTest("campus").outcome, "refused");
  const again = await world.reload([handler]);
  await again.page.go("#endpoints/campus");
  assert.equal(again.main.querySelector(".endpoint-key").value, "sk-wrong-key-0000", "the key survives a fresh load");
  fill(again.main, { key: KEY });
  assert.equal(await saveAndTest(again), "✓ tiny-model is working, can use tools.");
  assert.equal(stored("campus").key, KEY);
  assert.equal(Object.values(dump()).some((value) => value.includes("sk-wrong-key-0000")), false, "the wrong key is gone from the browser");
});

// TST-266207 · level: system · module: system
// guards: UC-003; A CLEAR IS A REAL CLEAR
// given: two working endpoints, campus and keeper, stored in a dashboard browser, each with a last test; the key of campus is sk-campus-system-key-3141
// input: the author opens campus in the form and presses Clear; the page is loaded afresh; the author presses Clear on keeper's line of the tab
// expect: known positive — before Clear localStorage holds the key of campus, in endpoint:campus; after the form's Clear no entry of campus is left (neither the endpoint nor its last test), no stored value holds its key, keeper is untouched, the form is empty and reads "The endpoint configuration is cleared from this browser.", and the tab no longer lists campus; after the new load campus is still gone; after the line's Clear no entry of keeper is left either
test("TST-266207: UC-003 2b Clear removes the entries from localStorage, from the form and from the tab", async () => {
  const handler = answers(HOST, [], () => json(callsTool().body));
  const world = await openSettings({ handlers: [handler] });
  for (const fields of [CAMPUS, { ...CAMPUS, name: "keeper", key: "sk-keeper-key-2718" }]) { await configure(world); fill(world.main, fields); await saveAndTest(world); }
  assert.equal(Object.values(dump()).some((value) => value.includes(KEY)), true, "known positive: localStorage holds the key");
  assert.deepEqual([keysOf("campus"), keysOf("keeper")], [["endpoint:campus", "last-test:endpoint:campus"], ["endpoint:keeper", "last-test:endpoint:keeper"]]);
  await world.page.go("#endpoints/campus");
  assert.equal(world.main.querySelector(".endpoint-key").value, KEY);
  await press(world.server, world.main.querySelector(".endpoint-clear"));
  assert.deepEqual(keysOf("campus"), [], "no entry of campus is left in localStorage");
  assert.equal(Object.values(dump()).some((value) => value.includes(KEY)), false, "no stored value holds its key");
  assert.deepEqual(keysOf("keeper"), ["endpoint:keeper", "last-test:endpoint:keeper"], "keeper is untouched");
  assert.deepEqual(["name", "url", "model", "key", "place", "context", "secret", "bridge"].map((name) => world.main.querySelector(`.endpoint-${name}`).value), ["", "", "", "", "", "", "", ""]);
  assert.equal(world.main.querySelector(".endpoint-result").textContent, "The endpoint configuration is cleared from this browser.");
  const again = await world.reload([handler]);
  assert.equal(lineOf(again, "campus"), null, "campus is not listed after a fresh load");
  const line = lineOf(again, "keeper");
  assert.ok(line, "known positive: keeper is");
  await press(again.server, line.querySelector("button.settings-endpoint-clear"));
  assert.deepEqual(keysOf("keeper"), []);
  assert.equal(lineOf(again, "keeper"), null, "the line leaves the tab");
  assert.equal(Object.values(dump()).some((value) => value.includes("sk-keeper-key-2718")), false);
});

// ---------------------------------------------------------------- the CI secret

// TST-266208 · level: system · module: system
// guards: UC-003; NO SECRET IN THE REPOSITORY; CONFIGURATION LIVES IN THE BROWSER
// given: a dashboard browser whose repository server is the instance's, with no product; https://models.example.test is a server the browser may call
// input: the author enters campus with the key sk-campus-system-key-3141 and the CI secret name CAMPUS_API_KEY, and presses Save and test
// expect: known positive — the record holds the secret name CAMPUS_API_KEY and, beside it, the key, which stays in this browser; the key is not the secret field's value; the form says the endpoint names the CI secret CAMPUS_API_KEY and runs through GitHub Actions; the endpoint's line says "Runs through GitHub Actions with the CI secret CAMPUS_API_KEY"; no request went to the model server from the page; the repository server got no write and no request holding the key
test("TST-266208: UC-003 2 the name of the CI secret is stored beside the key, and the key goes to no repository", async () => {
  const ledger = [];
  const world = await openSettings({ handlers: [answers(HOST, ledger, () => json(callsTool().body))] });
  await configure(world);
  fill(world.main, { ...CAMPUS, secret: "CAMPUS_API_KEY" });
  const shown = await saveAndTest(world);
  assert.deepEqual(stored("campus"), { url: CAMPUS.url, kind: "openai-compatible", model: "tiny-model", key: KEY, place: CAMPUS.place, context: 32000, secret: "CAMPUS_API_KEY" });
  assert.notEqual(stored("campus").secret, KEY);
  assert.match(shown, /^Stored\. campus names the CI secret CAMPUS_API_KEY: it runs through GitHub Actions/);
  assert.match(lineOf(world, "campus").querySelector(".settings-endpoint-status").textContent, /^Runs through GitHub Actions with the CI secret CAMPUS_API_KEY\./);
  assert.deepEqual(ledger, [], "the page does not call the endpoint it hands to CI");
  assert.deepEqual(world.server.writes, [], "the repository server got no write");
  assert.ok(repositoryRequests(world).length > 0, "known positive: the page's reads of the repository server are seen");
  assert.deepEqual(holding(repositoryRequests(world), KEY, "CAMPUS_API_KEY"), [], "no request to a repository server holds the key or the secret's name");
  assert.deepEqual(holding(world.sent, KEY), [], "the key left the page in no request at all");
  assert.equal(Object.values(dump()).filter((value) => value.includes(KEY)).length, 1, "known positive: the key is in the browser's one record");
});

// ---------------------------------------------------------------- 2a: through a Bridge

// TST-266209 · level: system · module: system
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER; CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE; A CREDENTIAL IS NEVER PLACED IN A URL; NO SECRET IN THE REPOSITORY
// given: a dashboard browser that keeps two Bridges, lab (the real composed Bridge) and laptop (an address nothing answers at); a model server on the loopback address that the browser cannot call over plain http and that sends no cross-origin header
// input: the author configures campus at that address, first with the Bridge choice "Direct browser request" and then with lab chosen, and presses Save and test each time
// expect: known positive — the Bridge choice offers "Direct browser request", lab and laptop; direct, the form says the host does not accept calls from a web page and the model server received nothing; through lab, the form reads "✓ tiny-model is working, can use tools.", the model server received exactly one request, from the Bridge (no Origin header, the key as the Authorization header, the short message and the one tool); the page sent one POST /v1/probes/endpoint-test to lab, carrying lab's pairing token as a header and the key in its body and in no address; laptop received no test request and never saw the key (the page only reads its pairing); the record names bridge lab; no cookie, no repository write
test("TST-266209: UC-003 2a an endpoint the browser cannot call is tested through the Bridge chosen among the Bridges this browser keeps", async (t) => {
  const bridge = await startBridge(t);
  const model = await modelServer(t);
  const toBridge = [], toLaptop = [], toModel = [];
  const world = await openSettings({ entries: { ...keptBridge("lab", bridge), [`${PREFIX}bridge:laptop`]: JSON.stringify({ address: "http://127.0.0.1:9", token: "laptop-token" }) },
    handlers: [forwardTo(bridge, toBridge), refusesBrowser("http://127.0.0.1:9", toLaptop), refusesBrowser(model.origin, toModel)] });
  await configure(world);
  assert.deepEqual(optionsOf(world.main.querySelector(".endpoint-bridge")).sort(), [["", "Direct browser request"], ["lab", "lab"], ["laptop", "laptop"]], "the Bridges this browser keeps");
  fill(world.main, { ...CAMPUS, url: model.url });
  assert.match(await saveAndTest(world), /^✗ 127\.0\.0\.1:\d+ does not accept calls from a web page; run it through GitHub Actions \(CI secret\) or a Bridge\./, "known positive: the browser cannot call the server");
  assert.deepEqual([model.seen.length, toModel.length], [0, 1]);
  fill(world.main, { bridge: "lab" });
  assert.equal(await saveAndTest(world), "✓ tiny-model is working, can use tools.");
  assert.equal(model.seen.length, 1, "the model server received one request");
  assert.deepEqual([model.seen[0].method, model.seen[0].path, model.seen[0].headers.authorization, model.seen[0].headers.origin], ["POST", "/v1/chat/completions", bearer(KEY), undefined], "from the Bridge, with the key, and no cross-origin header needed");
  assert.deepEqual(model.seen[0].body, probeBody("tiny-model"));
  const probes = toBridge.filter((each) => each.method === "POST");
  assert.deepEqual(toBridge.filter((each) => each.method !== "POST").map((each) => new URL(each.url).pathname), ["/v1/pair", "/v1/agents"], "beside it the page's own reads of the Bridge");
  assert.equal(probes.length, 1, "one test request went to the Bridge");
  assert.deepEqual([new URL(probes[0].url).pathname, probes[0].headers["x-agent-m-bridge-token"]], ["/v1/probes/endpoint-test", bridge.token]);
  assert.equal(probes[0].body.includes(KEY), true, "known positive: the key is in the body of the request to the Bridge");
  assert.equal(toBridge.some((each) => each.url.includes(KEY) || each.url.includes(bridge.token)), false, "and in no address");
  assert.deepEqual(toLaptop.filter((each) => each.method === "POST" || ledgerText([each]).includes(KEY)), [], "laptop got no test request and never saw the key (the page only reads its pairing)");
  assert.deepEqual(stored("campus"), { url: model.url, kind: "openai-compatible", model: "tiny-model", key: KEY, bridge: "lab", place: CAMPUS.place, context: 32000 });
  assert.deepEqual([world.cookies, world.server.writes], [[], []]);
  assert.deepEqual(holding(repositoryRequests(world), KEY, bridge.token), [], "no request to a repository server holds the key or the pairing token");
  assert.equal(everythingDrawn(world.main).includes(bridge.token), false, "the page draws no pairing token");
});

// TST-266210 · level: system · module: system
// guards: UC-003
// given: a dashboard browser that keeps the Bridge lab (the real composed Bridge); a model server on the loopback address that refuses every key but sk-campus-system-key-3141 with HTTP 401 "Invalid API key."
// input: the author configures campus through lab with the key sk-wrong-key-0000 and presses Save and test; then enters the right key and presses Save and test
// expect: known positive — the form reads "✗ Invalid API key." and neither says the key nor that the browser refused it; the record through lab still holds sk-wrong-key-0000; the model server received the wrong key once; after the right key the form reads "✓ tiny-model is working, can use tools." and the record holds the right key
test("TST-266210: UC-003 4b a wrong key through the Bridge shows the endpoint's message and stays stored", async (t) => {
  const bridge = await startBridge(t);
  const model = await modelServer(t, (request) => request.headers.authorization === bearer(KEY) ? callsTool() : refusesKey());
  const world = await openSettings({ entries: keptBridge("lab", bridge), handlers: [forwardTo(bridge, [])] });
  await configure(world);
  fill(world.main, { ...CAMPUS, url: model.url, bridge: "lab", key: "sk-wrong-key-0000" });
  const shown = await saveAndTest(world);
  assert.equal(shown, "✗ Invalid API key.");
  assert.equal(shown.includes("sk-wrong-key-0000"), false);
  assert.deepEqual(model.seen.map((request) => request.headers.authorization), [bearer("sk-wrong-key-0000")], "known positive: the Bridge sent the wrong key to the model server");
  assert.deepEqual([stored("campus").key, stored("campus").bridge], ["sk-wrong-key-0000", "lab"]);
  fill(world.main, { key: KEY });
  assert.equal(await saveAndTest(world), "✓ tiny-model is working, can use tools.");
  assert.equal(stored("campus").key, KEY);
});

// TST-266211 · level: system · module: system
// guards: UC-003
// given: a dashboard browser that keeps the Bridge lab (the real composed Bridge); a model server on the loopback address that rejects the offered tool with HTTP 400 "This model does not support tools."
// input: the author configures campus through lab and presses Save and test
// expect: known positive — the form reads "✓ tiny-model is working, text only." with the folded "The endpoint's message" holding "This model does not support tools."; the last test says working without the tool
test("TST-266211: UC-003 5a a model that rejects the tool through the Bridge is shown working, text only, with the message folded", async (t) => {
  const bridge = await startBridge(t);
  const model = await modelServer(t, () => refusesTools(TOOL_MESSAGE));
  const world = await openSettings({ entries: keptBridge("lab", bridge), handlers: [forwardTo(bridge, [])] });
  await configure(world);
  fill(world.main, { ...CAMPUS, url: model.url, bridge: "lab" });
  assert.equal(await saveAndTest(world), `✓ tiny-model is working, text only. The endpoint's message${TOOL_MESSAGE}`);
  assert.equal(model.seen.length, 1, "known positive: the request reached the model server through the Bridge");
  const folded = world.main.querySelector(".endpoint-tool-message");
  assert.deepEqual([folded.localName, folded.children[0].textContent], ["details", "The endpoint's message"]);
  assert.deepEqual([lastTest("campus").outcome, lastTest("campus").tools], ["working", false]);
});

// TST-266212 · level: system · module: system
// guards: UC-003; A CLEAR IS A REAL CLEAR
// given: a dashboard browser that keeps the Bridge lab (the real composed Bridge) and the endpoint campus, working through lab, with its last test
// input: the author opens campus and presses Clear; then configures another endpoint again through lab and presses Save and test
// expect: known positive — before Clear the browser holds endpoint:campus and last-test:endpoint:campus; after it neither is left, and no stored value holds the key, while the entry of the Bridge lab is still there; the next endpoint through lab works (the model server received a second request)
test("TST-266212: UC-003 2b Clear of an endpoint reached through a Bridge removes its entries and leaves the Bridge", async (t) => {
  const bridge = await startBridge(t);
  const model = await modelServer(t);
  const world = await openSettings({ entries: keptBridge("lab", bridge), handlers: [forwardTo(bridge, [])] });
  await configure(world);
  fill(world.main, { ...CAMPUS, url: model.url, bridge: "lab" });
  await saveAndTest(world);
  assert.deepEqual(keysOf("campus"), ["endpoint:campus", "last-test:endpoint:campus"], "known positive");
  await world.page.go("#endpoints/campus");
  await press(world.server, world.main.querySelector(".endpoint-clear"));
  assert.deepEqual(keysOf("campus"), []);
  assert.equal(Object.values(dump()).some((value) => value.includes(KEY)), false);
  assert.ok(dump()[`${PREFIX}bridge:lab`], "the Bridge is still kept");
  await world.page.go("#settings");
  await configure(world);
  fill(world.main, { ...CAMPUS, name: "again", url: model.url, bridge: "lab", key: "sk-again-key-1618" });
  assert.equal(await saveAndTest(world), "✓ tiny-model is working, can use tools.");
  assert.equal(model.seen.length, 2, "the Bridge still reaches the server");
});

// TST-266213 · level: system · module: system
// guards: UC-003; A CLEAR IS A REAL CLEAR
// given: two working endpoints stored in a dashboard browser, campus and keeper, each shown as a line of the Endpoints & Agents tab and as a form
// input: the author presses Clear in the form of campus; then presses Clear on keeper's line of the tab
// expect: known positive — the form of campus reads "The endpoint configuration is cleared from this browser." and no entry of campus is left; after the line's Clear no entry of keeper is left, and the tab's text says that keeper is cleared or that nothing is stored
test("TST-266213: UC-003 2b Clear on the endpoint's line of the tab confirms that nothing is stored, as the form's Clear does", async () => {
  const world = await openSettings({ handlers: [answers(HOST, [], () => json(callsTool().body))] });
  for (const fields of [CAMPUS, { ...CAMPUS, name: "keeper", key: "sk-keeper-key-2718" }]) { await configure(world); fill(world.main, fields); await saveAndTest(world); }
  await world.page.go("#endpoints/campus");
  await press(world.server, world.main.querySelector(".endpoint-clear"));
  assert.equal(world.main.querySelector(".endpoint-result").textContent, "The endpoint configuration is cleared from this browser.", "known positive: the form confirms");
  assert.deepEqual(keysOf("campus"), []);
  await world.page.go("#settings");
  await press(world.server, lineOf(world, "keeper").querySelector("button.settings-endpoint-clear"));
  assert.deepEqual(keysOf("keeper"), [], "known positive: the line's Clear removed the entries");
  assert.match(world.pane().textContent, /cleared|nothing is stored/i, "the tab confirms that the endpoint is cleared and nothing is stored");
});
