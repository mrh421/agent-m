// MOD-settings-pages — the direct endpoint configuration route (ITM-265).
// Run: node --test tests/settings-pages-endpoints.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-003; CONFIGURATION LIVES IN THE BROWSER; CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE; A CREDENTIAL IS NEVER PLACED IN A URL; AN UNSUPPORTED ENDPOINT SAYS SO; A CLEAR IS A REAL CLEAR; NO SECRET IN THE REPOSITORY; EVERY SETTING IS REACHED FROM ONE PAGE; EVERY STEP EXPLAINS ITSELF; THE PAGE NAMES WHERE IT SENDS
// Level: unit
//
// These tests use only MOD-settings-pages' public `view` interface. An endpoint route is a Route, so every interaction
// goes through Route.render(target, context, params), uses the public browser-store format, and drives real controls.
// The browser DOM and store stand-ins follow tests/settings-pages-add-product.test.mjs; endpoint replies are constructed.

import test from "node:test";
import assert from "node:assert/strict";
import { view } from "../src/settings-pages/index.mjs";
import { openStore, readSetting, writeSetting } from "../src/browser-store/index.mjs";

class Element extends EventTarget {
  constructor(name) { super(); this.localName = name; this.childNodes = []; this.className = ""; this.value = ""; this.type = ""; this.disabled = false; this.checked = false; this.parentNode = null; }
  append(...nodes) { for (const node of nodes.flat()) { const child = typeof node === "string" ? new Text(node) : node; this.childNodes.push(child); child.parentNode = this; } }
  replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); }
  get textContent() { return this.childNodes.map((child) => child.textContent).join(""); }
  set textContent(value) { this.replaceChildren(String(value)); }
  focus() {}
}
class Text { constructor(value) { this.value = String(value); } get textContent() { return this.value; } }
const document = { createElement: (name) => new Element(name) };
globalThis.document = document;

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child instanceof Element) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => node.className.split(" ").includes(name));
const byTag = (root, name) => descendants(root, (node) => node.localName === name);
const type = (field, value) => { field.value = value; field.dispatchEvent(new Event("input")); };
const click = async (button) => { button.dispatchEvent(new Event("click")); await new Promise((resolve) => setImmediate(resolve)); };

class Storage { constructor() { this.values = new Map(); } getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); } get length() { return this.values.size; } key(index) { return [...this.values.keys()][index] ?? null; } }
function freshStore() { Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() }); return openStore("fixture/instance"); }
const contextOf = (store, { host = {}, navigations = [] } = {}) => ({
  page: "review", instance: { repository: "fixture/instance", host }, product: null, store,
  go(route, params) { navigations.push({ route, params }); },
});
async function render(store, params = {}, options = {}) { const target = document.createElement("div"); await endpointsRoute().render(target, contextOf(store, options), params); return target; }
async function renderSettings(store, options = {}) { const target = document.createElement("div"); await settingsRoute().render(target, contextOf(store, options), {}); return target; }
function scripted(responses, calls) { const remaining = [...responses]; return async (url, init = {}) => { calls.push({ url: String(url), init }); const next = remaining.shift(); if (!next) throw new Error("unexpected endpoint request"); return new Response(JSON.stringify(next.body ?? {}), { status: next.status, headers: { "content-type": "application/json" } }); }; }

const ENDPOINT = { url: "https://models.example.test/v1", kind: "openai-compatible", model: "tiny-model", key: "secret-key" };
const BRIDGED = { url: "http://127.0.0.1:11434", kind: "openai-compatible", model: "local-model", bridge: "local" };
// An endpoint stored before Bridges had names: it says it goes through a Bridge and names none.
const OLD_BRIDGED = { url: "http://127.0.0.1:11434/v1", kind: "openai-compatible", model: "local-model", throughBridge: true };

function endpointsRoute() {
  const route = view.routes.find((candidate) => candidate.name === "endpoints");
  assert.ok(route, "view exposes the public endpoints Route");
  assert.equal(route.entry, "settings");
  assert.equal(typeof route.render, "function");
  return route;
}

function settingsRoute() {
  const route = view.routes.find((candidate) => candidate.name === "settings");
  assert.ok(route, "view exposes the public settings Route");
  assert.equal(route.entry, "settings");
  assert.equal(typeof route.render, "function");
  return route;
}

// TST-265001 · level: unit · module: MOD-settings-pages
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER
// given: an empty browser store and a constructed successful endpoint answer
// input: the author fills the public endpoints Route and presses Test
// expect: the Route stores endpoint:<name> before exactly one short test request, then shows the configured model working; as the endpoint declares no context, the test is followed only by GET /models and GET /model/info, which state none here, and the page says so
test("TST-265001: direct endpoint saves before its one short test", async () => {
  const store = freshStore(), calls = [], oldFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    assert.deepEqual(readSetting(store, "endpoint:campus"), ENDPOINT, "the configuration is stored when fetch starts");
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
  };
  try {
    const target = await render(store);
    type(byClass(target, "endpoint-name")[0], "campus"); type(byClass(target, "endpoint-url")[0], ENDPOINT.url);
    type(byClass(target, "endpoint-model")[0], ENDPOINT.model); type(byClass(target, "endpoint-key")[0], ENDPOINT.key);
    await click(byClass(target, "endpoint-test")[0]);
    assert.deepEqual(readSetting(store, "endpoint:campus"), ENDPOINT, "save precedes the request");
    assert.equal(calls[0].url, `${ENDPOINT.url}/chat/completions`);
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${ENDPOINT.key}`);
    assert.deepEqual(calls.slice(1).map((call) => [call.init.method, call.url]), [["GET", `${ENDPOINT.url}/models`], ["GET", `${ENDPOINT.url}/model/info`]]);
    assert.match(target.textContent, /working|tiny-model/i);
    assert.match(target.textContent, /does not state its model's context in tokens/);
  } finally { globalThis.fetch = oldFetch; }
});

// TST-265002 · level: unit · module: MOD-settings-pages
// guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO
// given: a constructed browser refusal that names cross-origin blocking and CI/Bridge routes
// input: the author presses Test on the public endpoints Route
// expect: the Route shows the observed reason and both named alternatives
test("TST-265002: browser refusal is shown with CI and Bridge alternatives", async () => {
  const store = freshStore(), oldFetch = globalThis.fetch, oldWindow = globalThis.window;
  globalThis.window = {}; globalThis.fetch = async () => { throw new TypeError("Blocked by CORS policy"); };
  try { const target = await render(store); type(byClass(target, "endpoint-name")[0], "campus"); type(byClass(target, "endpoint-url")[0], ENDPOINT.url); type(byClass(target, "endpoint-model")[0], ENDPOINT.model); await click(byClass(target, "endpoint-test")[0]); assert.match(target.textContent, /Blocked by CORS policy/); assert.match(target.textContent, /CI/); assert.match(target.textContent, /Bridge/); } finally { globalThis.fetch = oldFetch; globalThis.window = oldWindow; }
});

// TST-265003 · level: unit · module: MOD-settings-pages
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER
// given: a key that a constructed provider response refuses
// input: save and test, then reload the public endpoints Route
// expect: the provider message is visible and the stored key remains until the author changes or clears it
test("TST-265003: a refused key remains stored and reloads", async () => {
  const store = freshStore(), oldFetch = globalThis.fetch;
  globalThis.fetch = scripted([{ status: 401, body: { error: { message: "Invalid API key." } } }], []);
  try { let target = await render(store); type(byClass(target, "endpoint-name")[0], "campus"); type(byClass(target, "endpoint-url")[0], ENDPOINT.url); type(byClass(target, "endpoint-model")[0], ENDPOINT.model); type(byClass(target, "endpoint-key")[0], ENDPOINT.key); await click(byClass(target, "endpoint-test")[0]); assert.match(target.textContent, /Invalid API key/); assert.equal(readSetting(store, "endpoint:campus").key, ENDPOINT.key); target = await render(store, { name: "campus" }); assert.equal(byClass(target, "endpoint-key")[0].value, ENDPOINT.key); } finally { globalThis.fetch = oldFetch; }
});

// TST-265004 · level: unit · module: MOD-settings-pages
// guards: UC-003; A CLEAR IS A REAL CLEAR
// given: endpoint:<name> is stored in localStorage and the endpoint form is rendered
// input: the author presses Clear in the public endpoints Route
// expect: the form is empty and the actual endpoint:<name> browser-store entry is removed
test("TST-265004: Clear removes the stored endpoint and empties the form", async () => {
  const store = freshStore(); writeSetting(store, "endpoint:campus", ENDPOINT); const target = await render(store, { name: "campus" });
  await click(byClass(target, "endpoint-clear")[0]); assert.equal(readSetting(store, "endpoint:campus"), null); assert.equal(byClass(target, "endpoint-url")[0].value, "");
});

// TST-265005 · level: unit · module: MOD-settings-pages
// guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO
// given: a stored named-Bridge endpoint for a local model server
// input: the author opens the public endpoints Route and presses Test
// expect: no direct request reaches its model, the setting is retained, and the missing Bridge setup is named
test("TST-265005: a Bridge endpoint is retained and never called directly", async () => {
  const store = freshStore(), calls = [], oldFetch = globalThis.fetch; writeSetting(store, "endpoint:local", BRIDGED); globalThis.fetch = scripted([], calls);
  try { const target = await render(store, { name: "local" }); await click(byClass(target, "endpoint-test")[0]); assert.equal(calls.length, 0); assert.deepEqual(readSetting(store, "endpoint:local"), BRIDGED); assert.match(target.textContent, /Set up the Bridge|Bridge .*does not keep/i); } finally { globalThis.fetch = oldFetch; }
});

// TST-265006 · level: unit · module: MOD-settings-pages
// guards: UC-003; A CREDENTIAL IS NEVER PLACED IN A URL
// given: an endpoint form with an absent optional key
// input: the author saves and tests it through the public endpoints Route
// expect: the store keeps no key property and the call boundary receives EndpointConfig key null, never a URL credential
test("TST-265006: an absent key maps to null at the direct-call boundary", async () => {
  const store = freshStore(), calls = [], oldFetch = globalThis.fetch; globalThis.fetch = scripted([{ status: 200, body: { choices: [] } }], calls);
  try { const target = await render(store); type(byClass(target, "endpoint-name")[0], "public"); type(byClass(target, "endpoint-url")[0], ENDPOINT.url); type(byClass(target, "endpoint-model")[0], ENDPOINT.model); await click(byClass(target, "endpoint-test")[0]); assert.equal(Object.hasOwn(readSetting(store, "endpoint:public"), "key"), false); assert.equal(calls[0].init.headers.Authorization, undefined); } finally { globalThis.fetch = oldFetch; }
});

// TST-265007 · level: unit · module: MOD-settings-pages
// guards: NO SECRET IN THE REPOSITORY; A CREDENTIAL IS NEVER PLACED IN A URL; THE PAGE NAMES WHERE IT SENDS
// given: an endpoint key in the real password control
// input: the public endpoints Route renders before the author saves
// expect: destination disclosure precedes the action, the key is hidden, and neither a URL nor a repository writer receives it
test("TST-265007: disclosure precedes a hidden endpoint key without repository or navigation leakage", async () => {
  const store = freshStore(), writes = [], navigations = [], oldFetch = globalThis.fetch;
  const host = {
    commitFiles(...args) { writes.push({ operation: "commitFiles", args }); },
    startWorkflow(...args) { writes.push({ operation: "startWorkflow", args }); },
  };
  document.cookie = "";
  globalThis.fetch = scripted([{ status: 200, body: { choices: [{ message: { content: "ok" } }] } }], []);
  try {
    const target = await render(store, {}, { host, navigations });
    const key = byClass(target, "endpoint-key")[0], disclosure = byClass(target, "endpoint-disclosure")[0];
    const action = byClass(target, "endpoint-test")[0];
    const ordered = descendants(target, (node) => node === disclosure || node === action);
    assert.equal(key.type, "password");
    assert.ok(ordered.indexOf(disclosure) >= 0 && ordered.indexOf(disclosure) < ordered.indexOf(action), "the rendered disclosure precedes Test");
    assert.ok(byTag(target, "a").every((link) => !String(link.href).includes(ENDPOINT.key)), "rendered link destinations exclude the key");
    assert.equal(target.textContent.includes(ENDPOINT.key), false, "the rendered page does not disclose the key");
    type(byClass(target, "endpoint-name")[0], "campus"); type(byClass(target, "endpoint-url")[0], ENDPOINT.url);
    type(byClass(target, "endpoint-model")[0], ENDPOINT.model); type(key, ENDPOINT.key); await click(action);
    assert.deepEqual(readSetting(store, "endpoint:campus"), ENDPOINT, "save writes only the browser-store endpoint setting");
    assert.deepEqual(writes, [], "render, save, and test make no repository write");
    assert.deepEqual(navigations, [], "render, save, and test do not navigate away");
    assert.equal(document.cookie, "", "render, save, and test set no cookie");
  } finally { globalThis.fetch = oldFetch; }
});

// TST-265008 · level: unit · module: MOD-settings-pages
// guards: THE SHARED PAGES ORIGIN IS DISCLOSED; EVERY STEP EXPLAINS ITSELF
// given: the public endpoints Route for an instance whose Pages owner is fixture
// input: the author opens the Route before entering or storing a key
// expect: the shared-origin disclosure precedes Save and test, and the registered endpoint explanations are folded, the explanation of when the prompt bar appears among them (nine folds, each with the summary "What is this?")
test("TST-265008: endpoint storage is preceded by its Pages-origin notice and folded explanations", async () => {
  const target = await render(freshStore());
  const action = byClass(target, "endpoint-test")[0];
  const disclosure = byClass(target, "endpoint-shared-origin")[0];
  const ordered = descendants(target, (node) => node === disclosure || node === action);
  assert.match(disclosure.textContent, /fixture\.github\.io/);
  assert.ok(ordered.indexOf(disclosure) >= 0 && ordered.indexOf(disclosure) < ordered.indexOf(action), "the shared-origin notice precedes storage");
  const details = byTag(target, "details");
  assert.equal(details.length, 9, "every endpoint field and action has its registered folded explanation — the place, context and CI secret one together — and the prompt bar's");
  assert.ok(details.every((folded) => byTag(folded, "summary").some((summary) => summary.textContent === "What is this?")));
});

// TST-265009 · level: unit · module: MOD-settings-pages
// guards: A STORED SECRET IS HIDDEN UNTIL SHOWN
// given: an endpoint whose browser-store record contains a key
// input: the author reloads the public endpoints Route and presses Show
// expect: the key begins in a password field and is revealed in full only after Show
test("TST-265009: a stored endpoint key stays hidden until Show", async () => {
  const store = freshStore();
  writeSetting(store, "endpoint:campus", ENDPOINT);
  const target = await render(store, { name: "campus" });
  const key = byClass(target, "endpoint-key")[0], show = byClass(target, "endpoint-show")[0];
  assert.equal(key.type, "password");
  assert.equal(key.value, ENDPOINT.key);
  await click(show);
  assert.equal(key.type, "text");
  assert.equal(key.value, ENDPOINT.key);
});

// TST-265010 · level: unit · module: MOD-settings-pages
// guards: EVERY SETTING IS REACHED FROM ONE PAGE; A STORED SECRET IS HIDDEN UNTIL SHOWN
// given: an instance browser store with a canonical endpoint:campus record and a second instance with another endpoint
// input: the person opens the public settings Route and presses Show for campus
// expect: Settings lists campus from the canonical store enumeration, hides its key first, and exposes no other-instance endpoint
test("TST-265010: Settings lists its stored endpoint with a hidden key and Show", async () => {
  const store = freshStore();
  writeSetting(store, "endpoint:campus", ENDPOINT);
  const other = openStore("other/instance");
  writeSetting(other, "endpoint:other", { ...ENDPOINT, model: "other-model" });
  const target = await renderSettings(store);
  assert.match(target.textContent, /Endpoint: campus/);
  assert.doesNotMatch(target.textContent, /other-model/);
  const key = byClass(target, "settings-endpoint-key")[0], show = byClass(target, "settings-endpoint-show")[0];
  assert.equal(key.type, "password");
  assert.equal(key.value, ENDPOINT.key);
  await click(show);
  assert.equal(key.type, "text");
});

// TST-265011 · level: unit · module: MOD-settings-pages
// guards: A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a stored direct endpoint and a constructed successful endpoint answer
// input: the person presses Test, then Change on the public settings Route
// expect: Test makes one mapped direct test request without changing the stored record — followed, as no context is declared, only by GET /models and GET /model/info —, and Change opens that named endpoint's form in place
test("TST-265011: Settings tests a stored direct endpoint and changes its named route", async () => {
  const store = freshStore(), calls = [], navigations = [], oldFetch = globalThis.fetch;
  writeSetting(store, "endpoint:campus", ENDPOINT);
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); assert.deepEqual(readSetting(store, "endpoint:campus"), ENDPOINT); return new Response(JSON.stringify({ choices: [] }), { status: 200 }); };
  try {
    const target = await renderSettings(store, { navigations });
    await click(byClass(target, "settings-endpoint-test")[0]);
    assert.equal(calls[0].url, `${ENDPOINT.url}/chat/completions`);
    assert.deepEqual(calls.slice(1).map((call) => [call.init.method, call.url]), [["GET", `${ENDPOINT.url}/models`], ["GET", `${ENDPOINT.url}/model/info`]]);
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${ENDPOINT.key}`);
    assert.match(target.textContent, /working|tiny-model/i);
    await click(byClass(target, "settings-endpoint-change")[0]);
    assert.deepEqual(navigations, [], "Change stays on the Settings page");
    assert.equal(byClass(target, "endpoint-name")[0]?.value, "campus", "Change opens the form of the endpoint campus in place");
    assert.equal(byClass(target, "endpoint-url")[0]?.value, ENDPOINT.url, "with its stored address");
  } finally { globalThis.fetch = oldFetch; }
});

// TST-265012 · level: unit · module: MOD-settings-pages
// guards: A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A CLEAR IS A REAL CLEAR
// given: two endpoints stored for one instance
// input: the person presses Clear beside campus on the public settings Route
// expect: the actual campus entry is removed, its line disappears, and local remains stored and listed
test("TST-265012: Settings Clear removes only the selected endpoint entry", async () => {
  const store = freshStore();
  writeSetting(store, "endpoint:campus", ENDPOINT);
  writeSetting(store, "endpoint:local", BRIDGED);
  const target = await renderSettings(store);
  const lines = byClass(target, "settings-endpoint");
  const campus = lines.find((line) => /Endpoint: campus/.test(line.textContent));
  await click(byClass(campus, "settings-endpoint-clear")[0]);
  assert.equal(readSetting(store, "endpoint:campus"), null);
  assert.deepEqual(readSetting(store, "endpoint:local"), BRIDGED);
  assert.doesNotMatch(target.textContent, /Endpoint: campus/);
  assert.match(target.textContent, /Endpoint: local/);
});

// TST-265013 · level: unit · module: MOD-settings-pages
// guards: EVERY STEP EXPLAINS ITSELF
// given: a browser store with one canonical endpoint setting
// input: the person opens the public Settings Route
// expect: the browser section and its stored endpoint line each expose a registered folded explanation
test("TST-265013: Settings explains its browser section and each stored endpoint line", async () => {
  const store = freshStore();
  writeSetting(store, "endpoint:campus", ENDPOINT);
  const target = await renderSettings(store);
  const browserExplanation = byClass(target, "settings-browser-explanation");
  const line = byClass(target, "settings-endpoint")[0];
  const lineExplanation = byClass(line, "settings-endpoint-explanation");
  assert.equal(browserExplanation.length, 1, "the browser section has its folded explanation");
  assert.equal(lineExplanation.length, 1, "the stored endpoint line has its folded explanation");
  const folded = [...byTag(browserExplanation[0], "details"), ...byTag(lineExplanation[0], "details")];
  assert.equal(folded.length, 2, "both explanations use the public folded control");
  assert.ok(folded.every((detail) => byTag(detail, "summary").some((summary) => summary.textContent === "What is this?")));
});

// TST-265014 · level: unit · module: MOD-settings-pages
// guards: THE PAGE NAMES WHERE IT SENDS; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a stored direct endpoint in the public Settings Route
// input: the person reads its line before pressing Test
// expect: the line discloses the stored destination and what the request sends before its Test control
test("TST-265014: Settings discloses an endpoint Test destination before its control", async () => {
  const store = freshStore();
  writeSetting(store, "endpoint:campus", ENDPOINT);
  const target = await renderSettings(store);
  const line = byClass(target, "settings-endpoint")[0];
  const disclosure = byClass(line, "settings-endpoint-disclosure")[0];
  const action = byClass(line, "settings-endpoint-test")[0];
  const ordered = descendants(line, (node) => node === disclosure || node === action);
  assert.match(disclosure.textContent, new RegExp(ENDPOINT.url));
  assert.match(disclosure.textContent, /short test request/);
  assert.match(disclosure.textContent, /authorisation header/);
  assert.ok(ordered.indexOf(disclosure) >= 0 && ordered.indexOf(disclosure) < ordered.indexOf(action), "the disclosure precedes Test");
});

// TST-265015 · level: unit · module: MOD-settings-pages
// guards: A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN; A CLEAR IS A REAL CLEAR
// given: a stored direct endpoint and another endpoint with independent test metadata
// input: the person tests campus successfully, reloads Settings, then clears campus
// expect: the successful result and date persist on campus, then Clear removes campus and its metadata only
test("TST-265015: Settings persists a successful endpoint test and clears its metadata", async () => {
  const store = freshStore(), oldFetch = globalThis.fetch;
  writeSetting(store, "endpoint:campus", ENDPOINT);
  writeSetting(store, "endpoint:local", BRIDGED);
  writeSetting(store, "last-test:endpoint:local", { at: "2026-10-07T10:00:00.000Z", outcome: "working" });
  globalThis.fetch = scripted([{ status: 200, body: { choices: [] } }], []);
  try {
    let target = await renderSettings(store);
    await click(byClass(target, "settings-endpoint-test")[0]);
    const recorded = readSetting(store, "last-test:endpoint:campus");
    assert.equal(recorded.outcome, "working");
    assert.ok(Number.isFinite(Date.parse(recorded.at)), "the successful test keeps an ISO date");
    target = await renderSettings(store);
    assert.match(target.textContent, /works/i);
    assert.match(target.textContent, new RegExp(recorded.at));
    const campus = byClass(target, "settings-endpoint").find((line) => /Endpoint: campus/.test(line.textContent));
    await click(byClass(campus, "settings-endpoint-clear")[0]);
    assert.equal(readSetting(store, "endpoint:campus"), null);
    assert.equal(readSetting(store, "last-test:endpoint:campus"), null);
    assert.deepEqual(readSetting(store, "endpoint:local"), BRIDGED);
    assert.deepEqual(readSetting(store, "last-test:endpoint:local"), { at: "2026-10-07T10:00:00.000Z", outcome: "working" });
  } finally { globalThis.fetch = oldFetch; }
});

// TST-265016 · level: unit · module: MOD-settings-pages
// guards: EVERY SETTING IS REACHED FROM ONE PAGE
// given: one endpoint that has never been tested and one whose test was refused
// input: the person opens the public Settings Route
// expect: the lines state the accepted not-set and refused outcomes without exposing either key
test("TST-265016: Settings identifies untested and refused endpoint states", async () => {
  const store = freshStore();
  writeSetting(store, "endpoint:new", ENDPOINT);
  writeSetting(store, "endpoint:refused", { ...ENDPOINT, key: "other-secret" });
  writeSetting(store, "last-test:endpoint:refused", { at: "2026-10-07T10:00:00.000Z", outcome: "refused" });
  const target = await renderSettings(store);
  const pending = byClass(target, "settings-endpoint").find((line) => /Endpoint: new/.test(line.textContent));
  const refused = byClass(target, "settings-endpoint").find((line) => /Endpoint: refused/.test(line.textContent));
  assert.match(byClass(pending, "settings-endpoint-status")[0].textContent, /not set/i);
  assert.match(byClass(refused, "settings-endpoint-status")[0].textContent, /^Refused\.$/);
  assert.equal(target.textContent.includes("other-secret"), false);
});

// ---- ITM-512: the endpoints route says whether the model called the tool (UC-003 step 5, 5a) ----
// Readings these tests take, named in the pull request:
//   - The two answers are the words *can use tools* and *text only*, in the route's result paragraph (class endpoint-result); a failed test shows neither.
//   - "the endpoint's message ... shown folded" is a <details class="endpoint-tool-message"> that holds the message exactly, is not open, and is the only place the message stands in the page.
//     It stands only for *text only*, and only when the endpoint gave a message (not for an empty answer, and not for *can use tools*).
//   - A refusal of tools (HTTP 400 "tools are not supported") is a working endpoint with *text only* and the provider's message folded.
// The probe tool of testEndpoint is named agent_m_probe; a constructed answer that calls it is "the model called the tool".
const CALLED = { choices: [{ message: { content: null, tool_calls: [{ id: "1", type: "function", function: { name: "agent_m_probe", arguments: "{}" } }] } }] };
const textAnswer = (content) => ({ choices: [{ message: { content } }] });

async function testedDirect(answer) {
  const store = freshStore(), oldFetch = globalThis.fetch;
  globalThis.fetch = scripted([answer], []);
  try {
    const target = await render(store);
    type(byClass(target, "endpoint-name")[0], "campus"); type(byClass(target, "endpoint-url")[0], ENDPOINT.url);
    type(byClass(target, "endpoint-model")[0], ENDPOINT.model);
    await click(byClass(target, "endpoint-test")[0]);
    return target;
  } finally { globalThis.fetch = oldFetch; }
}
const resultOf = (target) => byClass(target, "endpoint-result")[0].textContent;
const foldedMessages = (target) => byClass(target, "endpoint-tool-message");

// TST-512001 · level: unit · module: MOD-settings-pages
// guards: UC-003
// given: a constructed answer in which the model calls the probe tool
// input: the author fills the endpoints Route and presses Save and test
// expect: the result says "can use tools" and not "text only", still says the model is working, and holds no folded message
test("TST-512001: a model that called the tool is shown as can use tools", async () => {
  const target = await testedDirect({ status: 200, body: CALLED });
  assert.match(resultOf(target), /tiny-model is working/);
  assert.match(resultOf(target), /can use tools/);
  assert.doesNotMatch(resultOf(target), /text only/);
  assert.equal(foldedMessages(target).length, 0);
});

// TST-512002 · level: unit · module: MOD-settings-pages
// guards: UC-003; EVERY STEP EXPLAINS ITSELF
// given: a constructed answer with the text "I cannot call tools." and no tool call
// input: the author fills the endpoints Route and presses Save and test
// expect: the result says "text only" and not "can use tools"; one details element of the class endpoint-tool-message holds exactly "I cannot call tools.", is not open, and the message stands once in the whole page
test("TST-512002: an answer without a tool call is text only, with the endpoint's message folded", async () => {
  const target = await testedDirect({ status: 200, body: textAnswer("I cannot call tools.") });
  assert.match(resultOf(target), /tiny-model is working/);
  assert.match(resultOf(target), /text only/);
  assert.doesNotMatch(resultOf(target), /can use tools/);
  const folded = foldedMessages(target);
  assert.equal(folded.length, 1);
  assert.equal(folded[0].localName, "details");
  assert.notEqual(folded[0].open, true, "folded");
  assert.ok(folded[0].textContent.includes("I cannot call tools."));
  assert.equal(target.textContent.split("I cannot call tools.").length - 1, 1, "the message stands once");
});

// TST-512003 · level: unit · module: MOD-settings-pages
// guards: UC-003
// given: a constructed answer with an empty text and no tool call
// input: the author fills the endpoints Route and presses Save and test
// expect: the result says "text only"; there is no folded message, since the endpoint gave none
test("TST-512003: an empty answer is text only with no folded message", async () => {
  const target = await testedDirect({ status: 200, body: textAnswer("") });
  assert.match(resultOf(target), /text only/);
  assert.doesNotMatch(resultOf(target), /can use tools/);
  assert.equal(foldedMessages(target).length, 0);
});

// TST-512004 · level: unit · module: MOD-settings-pages
// guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO
// given: a constructed HTTP 400 whose message is "tools are not supported by this model"
// input: the author fills the endpoints Route and presses Save and test
// expect: the endpoint is shown as working with "text only"; the provider's message is folded in one endpoint-tool-message details, and the result does not show a failure mark
test("TST-512004: an endpoint that rejects the tool is working, text only, with its message folded", async () => {
  const target = await testedDirect({ status: 400, body: { error: { message: "tools are not supported by this model" } } });
  assert.match(resultOf(target), /tiny-model is working/);
  assert.match(resultOf(target), /text only/);
  assert.doesNotMatch(resultOf(target), /✗/);
  const folded = foldedMessages(target);
  assert.equal(folded.length, 1);
  assert.ok(folded[0].textContent.includes("tools are not supported by this model"));
});

// TST-512005 · level: unit · module: MOD-settings-pages
// guards: UC-003
// given: a constructed 401 "Invalid API key."
// input: the author fills the endpoints Route and presses Save and test
// expect: the result shows the refusal and neither "can use tools" nor "text only", and no folded message (counter-proof of the cases above)
test("TST-512005: a refused key shows neither answer about tools", async () => {
  const target = await testedDirect({ status: 401, body: { error: { message: "Invalid API key." } } });
  assert.match(resultOf(target), /Invalid API key/);
  assert.doesNotMatch(resultOf(target), /can use tools|text only/);
  assert.equal(foldedMessages(target).length, 0);
});

// The Bridge path: a paired loopback Bridge answers the endpoint-test probe with the same result testEndpoint gives.
async function testedThroughBridge(answer) {
  const store = freshStore(), oldFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ answer }), { status: 200, headers: { "Content-Type": "application/json" } });
  try {
    writeSetting(store, "bridge:local", { address: "http://127.0.0.1:4711", token: "bridge-token" });
    const target = await render(store);
    type(byClass(target, "endpoint-name")[0], "local"); type(byClass(target, "endpoint-url")[0], BRIDGED.url);
    type(byClass(target, "endpoint-model")[0], BRIDGED.model);
    byClass(target, "endpoint-bridge")[0].value = "local"; byClass(target, "endpoint-bridge")[0].dispatchEvent(new Event("change"));
    await click(byClass(target, "endpoint-test")[0]);
    return target;
  } finally { globalThis.fetch = oldFetch; }
}

// TST-512006 · level: unit · module: MOD-settings-pages
// guards: UC-003
// given: a paired Bridge that answers the probe with { works: true, model: "local-model", tools: true, toolMessage: null }
// input: the author fills the endpoints Route, chooses the Bridge and presses Save and test
// expect: the result says "can use tools" and not "text only"
test("TST-512006: through a Bridge, a model that called the tool is shown as can use tools", async () => {
  const target = await testedThroughBridge({ works: true, model: "local-model", tools: true, toolMessage: null });
  assert.match(resultOf(target), /local-model is working/);
  assert.match(resultOf(target), /can use tools/);
  assert.doesNotMatch(resultOf(target), /text only/);
});

// TST-512007 · level: unit · module: MOD-settings-pages
// guards: UC-003
// given: a paired Bridge that answers the probe with { works: true, model: "local-model", tools: false, toolMessage: "no tools here" }
// input: the author fills the endpoints Route, chooses the Bridge and presses Save and test
// expect: the result says "text only" and not "can use tools"; one endpoint-tool-message details holds "no tools here" and is not open
test("TST-512007: through a Bridge, text only shows the endpoint's message folded", async () => {
  const target = await testedThroughBridge({ works: true, model: "local-model", tools: false, toolMessage: "no tools here" });
  assert.match(resultOf(target), /text only/);
  assert.doesNotMatch(resultOf(target), /can use tools/);
  const folded = foldedMessages(target);
  assert.equal(folded.length, 1);
  assert.notEqual(folded[0].open, true, "folded");
  assert.ok(folded[0].textContent.includes("no tools here"));
});

// TST-512008 · level: unit · module: MOD-settings-pages
// guards: UC-003; A BROWSER SETTING IS TESTED AND CLEARED WHERE IT IS SHOWN
// given: a constructed text-only answer
// input: the author tests the endpoint "campus" on the endpoints Route
// expect: the last test kept beside the endpoint is exactly { at, outcome: "working", tools: false } with at an ISO date and no other field (MOD-browser-store: `last-test:<key>` is { at, outcome, tools? })
test("TST-512008: showing the answer about tools keeps the stored last test as { at, outcome, tools }", async () => {
  const store = freshStore(), oldFetch = globalThis.fetch;
  globalThis.fetch = scripted([{ status: 200, body: textAnswer("plain") }], []);
  try {
    const target = await render(store);
    type(byClass(target, "endpoint-name")[0], "campus"); type(byClass(target, "endpoint-url")[0], ENDPOINT.url);
    type(byClass(target, "endpoint-model")[0], ENDPOINT.model);
    await click(byClass(target, "endpoint-test")[0]);
    const recorded = readSetting(store, "last-test:endpoint:campus");
    assert.deepEqual(Object.keys(recorded).sort(), ["at", "outcome", "tools"]);
    assert.equal(recorded.tools, false);
    assert.equal(recorded.outcome, "working");
  } finally { globalThis.fetch = oldFetch; }
});

// TST-269007 · level: unit · module: MOD-settings-pages
// guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO; CONFIGURATION LIVES IN THE BROWSER
// given: an old bridged value { url, kind, model, throughBridge: true } that names no Bridge, and two Bridges (lab, local) this browser keeps
// input: the person opens the public endpoints Route for it and presses Save and test without choosing a Bridge
// expect: no request of any kind is made (no direct call to the model, no call to either Bridge), the stored value is unchanged, and the page asks the person to choose the Bridge
test("TST-269007: an old bridged value asks for a named Bridge before testing and never falls back to a direct call", async () => {
  const store = freshStore(), calls = [], oldFetch = globalThis.fetch;
  writeSetting(store, "endpoint:old", OLD_BRIDGED);
  writeSetting(store, "bridge:lab", { address: "http://127.0.0.1:4711", token: "lab-token" });
  writeSetting(store, "bridge:local", { address: "http://127.0.0.1:4712", token: "local-token" });
  globalThis.fetch = scripted([], calls);
  try {
    const target = await render(store, { name: "old" });
    await click(byClass(target, "endpoint-test")[0]);
    assert.equal(calls.length, 0, "failure node: the direct call that settingFrom/testEndpoint made without a bridge name");
    assert.deepEqual(readSetting(store, "endpoint:old"), OLD_BRIDGED, "the stored value is left as it was");
    assert.match(byClass(target, "endpoint-result")[0].textContent, /choose the Bridge/i);
  } finally { globalThis.fetch = oldFetch; }
});

// TST-269008 · level: unit · module: MOD-settings-pages
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER; A CREDENTIAL IS NEVER PLACED IN A URL
// given: the same old bridged value and the same two kept Bridges
// input: the person chooses the Bridge lab in the Bridge control and presses Save and test
// expect: the value is saved as { url, kind, model, bridge: "lab" } without throughBridge, before exactly one request, which goes to the Bridge lab's probe address and to nothing else
test("TST-269008: after the person names a Bridge, the old bridged value is saved in the named form and tested through that Bridge only", async () => {
  const store = freshStore(), calls = [], oldFetch = globalThis.fetch;
  writeSetting(store, "endpoint:old", OLD_BRIDGED);
  writeSetting(store, "bridge:lab", { address: "http://127.0.0.1:4711", token: "lab-token" });
  writeSetting(store, "bridge:local", { address: "http://127.0.0.1:4712", token: "local-token" });
  const named = { url: OLD_BRIDGED.url, kind: OLD_BRIDGED.kind, model: OLD_BRIDGED.model, bridge: "lab" };
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    assert.deepEqual(readSetting(store, "endpoint:old"), named, "failure node: the named form is stored before the request");
    return new Response(JSON.stringify({ answer: { works: true, model: OLD_BRIDGED.model } }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const target = await render(store, { name: "old" });
    const bridge = byClass(target, "endpoint-bridge")[0];
    bridge.value = "lab"; bridge.dispatchEvent(new Event("change"));
    await click(byClass(target, "endpoint-test")[0]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "http://127.0.0.1:4711/v1/probes/endpoint-test");
    assert.equal(calls[0].init.headers["x-agent-m-bridge-token"], "lab-token");
    assert.deepEqual(readSetting(store, "endpoint:old"), named);
    assert.equal(Object.hasOwn(readSetting(store, "endpoint:old"), "throughBridge"), false);
    assert.match(byClass(target, "endpoint-result")[0].textContent, /working/i);
  } finally { globalThis.fetch = oldFetch; }
});

// TST-269009 · level: unit · module: MOD-settings-pages
// guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO
// given: an old bridged value that names no Bridge, and no Bridge kept in this browser
// input: the person opens the public endpoints Route for it and presses Save and test
// expect: no request is made, the stored value is unchanged, and the page offers to set up a Bridge
test("TST-269009: an old bridged value with no Bridge kept offers the Bridge setup and makes no request", async () => {
  const store = freshStore(), calls = [], navigations = [], oldFetch = globalThis.fetch;
  writeSetting(store, "endpoint:old", OLD_BRIDGED);
  globalThis.fetch = scripted([], calls);
  try {
    const target = await render(store, { name: "old" }, { navigations });
    await click(byClass(target, "endpoint-test")[0]);
    assert.equal(calls.length, 0);
    assert.deepEqual(readSetting(store, "endpoint:old"), OLD_BRIDGED);
    const setup = byClass(target, "endpoint-bridge-setup")[0];
    assert.equal(typeof setup, "object", "a Set up the Bridge control is offered");
    await click(setup);
    assert.deepEqual(navigations.map((step) => step.route), ["bridge"], "it leads to the Bridge page");
  } finally { globalThis.fetch = oldFetch; }
});

// TST-269010 · level: unit · module: MOD-settings-pages
// guards: UC-003; AN UNSUPPORTED ENDPOINT SAYS SO; THE PAGE NAMES WHERE IT SENDS
// given: the Settings page lists an old bridged value { url, kind, model, throughBridge: true } that names no Bridge
// input: the person reads the line's disclosure, then presses the line's Test
// expect: the disclosure does not claim a request to the model's address; Test makes no request of any kind, records no test, leaves the stored value unchanged, and asks the person to choose the Bridge
test("TST-269010: the Settings line's Test of an old bridged value asks for a named Bridge and never calls the model directly", async () => {
  const store = freshStore(), calls = [], oldFetch = globalThis.fetch;
  writeSetting(store, "endpoint:old", OLD_BRIDGED);
  writeSetting(store, "bridge:lab", { address: "http://127.0.0.1:4711", token: "lab-token" });
  globalThis.fetch = scripted([], calls);
  try {
    const target = await renderSettings(store);
    const line = byClass(target, "settings-endpoint")[0];
    assert.equal(byClass(line, "settings-endpoint-disclosure")[0].textContent.includes(OLD_BRIDGED.url), false, "no request to the model's address is announced");
    await click(byClass(line, "settings-endpoint-test")[0]);
    assert.equal(calls.length, 0, "failure node: settings.mjs falls to testEndpoint when setting.bridge is absent");
    assert.equal(readSetting(store, "last-test:endpoint:old"), null);
    assert.deepEqual(readSetting(store, "endpoint:old"), OLD_BRIDGED);
    assert.match(byClass(line, "settings-endpoint-result")[0].textContent, /choose the Bridge/i);
  } finally { globalThis.fetch = oldFetch; }
});

// TST-269011 · level: unit · module: MOD-settings-pages
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER
// given: the Settings page lists an endpoint that names the kept Bridge lab
// input: the person presses the line's Test
// expect: exactly one request, to lab's probe address, and none to the model
test("TST-269011: the Settings line's Test of a named-Bridge endpoint still goes through that Bridge only", async () => {
  const store = freshStore(), calls = [], oldFetch = globalThis.fetch;
  writeSetting(store, "endpoint:named", { url: OLD_BRIDGED.url, kind: OLD_BRIDGED.kind, model: OLD_BRIDGED.model, bridge: "lab" });
  writeSetting(store, "bridge:lab", { address: "http://127.0.0.1:4711", token: "lab-token" });
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify({ answer: { works: true, model: OLD_BRIDGED.model } }), { status: 200, headers: { "Content-Type": "application/json" } }); };
  try {
    const target = await renderSettings(store);
    await click(byClass(target, "settings-endpoint-test")[0]);
    assert.deepEqual(calls.map((call) => call.url), ["http://127.0.0.1:4711/v1/probes/endpoint-test"]);
  } finally { globalThis.fetch = oldFetch; }
});

// ---------------------------------------------------------------- the last test keeps whether the model called the tool (ITM-998)

async function storeAfterTest(answer) {
  const store = freshStore(), oldFetch = globalThis.fetch;
  globalThis.fetch = scripted([answer], []);
  try {
    const target = await render(store);
    type(byClass(target, "endpoint-name")[0], "campus"); type(byClass(target, "endpoint-url")[0], ENDPOINT.url);
    type(byClass(target, "endpoint-model")[0], ENDPOINT.model);
    await click(byClass(target, "endpoint-test")[0]);
    return store;
  } finally { globalThis.fetch = oldFetch; }
}

// TST-998001 · level: unit · module: MOD-settings-pages
// guards: UC-003; UC-017
// given: an endpoint tested directly three times: the model calls the probe tool; it answers in text only; the key is refused (401)
// input: the author fills the endpoints Route and presses Save and test
// expect: last-test:endpoint:campus holds tools true for the first, tools false for the second, and no `tools` key for the refused test (the test did not reach the model); each keeps its outcome as before
test("TST-998001: the last test of an endpoint keeps whether the model called the tool, and nothing where the test did not reach it", async () => {
  const called = readSetting(await storeAfterTest({ status: 200, body: CALLED }), "last-test:endpoint:campus");
  assert.equal(called.outcome, "working");
  assert.equal(called.tools, true);
  const text = readSetting(await storeAfterTest({ status: 200, body: textAnswer("I cannot call tools.") }), "last-test:endpoint:campus");
  assert.equal(text.outcome, "working");
  assert.equal(text.tools, false);
  const refused = readSetting(await storeAfterTest({ status: 401, body: { error: { message: "Invalid API key." } } }), "last-test:endpoint:campus");
  assert.equal(refused.outcome, "refused");
  assert.equal(Object.hasOwn(refused, "tools"), false);
});

// TST-1202002 · level: unit · module: MOD-settings-pages
// guards: UC-003; UC-049
// given: a stored direct endpoint with a place and no context, which the prompt bar does not offer, and a LiteLLM gateway: the test answers, GET /models states no context, GET /model/info states max_input_tokens 131072 for tiny-model
// input: the person presses Test on the Settings page
// expect: endpoint:campus keeps everything it had and gains context 131072; the result says so; the line no longer says the prompt bar does not offer it
test("TST-1202002: a working test keeps the context the endpoint states, and the endpoint is then offered", async () => {
  const store = freshStore(), calls = [], oldFetch = globalThis.fetch;
  writeSetting(store, "endpoint:campus", { ...ENDPOINT, place: "Campus, Germany" });
  globalThis.fetch = scripted([
    { status: 200, body: { choices: [{ message: { content: "ok" } }] } },
    { status: 200, body: { data: [{ id: "tiny-model", object: "model" }] } },
    { status: 200, body: { data: [{ model_name: "tiny-model", model_info: { max_input_tokens: 131072 } }] } },
  ], calls);
  try {
    const target = await renderSettings(store);
    assert.match(target.textContent, /The prompt bar does not offer it: it lacks its context in tokens/);
    await click(byClass(target, "settings-endpoint-test")[0]);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(readSetting(store, "endpoint:campus"), { ...ENDPOINT, place: "Campus, Germany", context: 131072 });
    assert.match(target.textContent, /Context: 131072 tokens, as the endpoint states it\./);
    assert.doesNotMatch(target.textContent, /The prompt bar does not offer it/);
  } finally { globalThis.fetch = oldFetch; }
});

// TST-1441001 · level: unit · module: MOD-settings-pages
// guards: UC-003; A CLEAR IS A REAL CLEAR
// given: two endpoints stored, campus and local, each with its last test
// input: the person presses Clear in the form of campus; then presses Clear on the line of local on the Settings page
// expect: known positive — the form's Clear removes campus and its last test and its result reads the form's confirmation; the line's Clear removes local and its last test, the line leaves the page, and the page reads that same confirmation, "The endpoint configuration is cleared from this browser."
test("TST-1441001: Clear on an endpoint's line confirms that nothing is stored, as the form's Clear does", async () => {
  const store = freshStore();
  for (const [name, setting] of [["campus", ENDPOINT], ["local", BRIDGED]]) {
    writeSetting(store, `endpoint:${name}`, setting);
    writeSetting(store, `last-test:endpoint:${name}`, { at: "2026-10-07T10:00:00.000Z", outcome: "working" });
  }
  const form = await render(store, { name: "campus" });
  await click(byClass(form, "endpoint-clear")[0]);
  assert.deepEqual([readSetting(store, "endpoint:campus"), readSetting(store, "last-test:endpoint:campus")], [null, null]);
  const confirmation = byClass(form, "endpoint-result")[0].textContent;
  assert.equal(confirmation, "The endpoint configuration is cleared from this browser.", "known positive: the form confirms");
  const target = await renderSettings(store);
  const local = byClass(target, "settings-endpoint").find((line) => /Endpoint: local/.test(line.textContent));
  assert.ok(local, "known positive: local has its line");
  assert.equal(target.textContent.includes(confirmation), false, "known negative: before the Clear the page does not confirm");
  await click(byClass(local, "settings-endpoint-clear")[0]);
  assert.deepEqual([readSetting(store, "endpoint:local"), readSetting(store, "last-test:endpoint:local")], [null, null], "the line's Clear removed the entries");
  assert.doesNotMatch(target.textContent, /Endpoint: local/, "the line leaves the page");
  assert.ok(target.textContent.includes(confirmation), "failure node: the page confirms that nothing is stored, as the form does");
});
