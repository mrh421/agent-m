// The CLI sessions a Bridge offers, declared on the route `bridge` (ITM-1186) — docs/architecture/MOD-settings-pages.md, `bridge`: "for each CLI session a Bridge offers (MOD-bridge-client's `testBridge`), the place where it
// processes data, its context in tokens, its model and its capabilities, prefilled as for a CLI agent (UC-017), kept under `session:<bridge>:<agent>`, and one lacking a place, a context or a model named as not offered in the
// prompt bar (UC-049 1b)."
// Run: node --test tests/settings-pages-bridge-sessions.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-049; UC-044; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// Level: unit
//
// These tests use only MOD-settings-pages' public `view`: the route `bridge` is drawn with Route.render(target, context, params) in the small DOM of tests/site-frame-dom.mjs, over a Map-backed localStorage and a stand-in for `fetch`
// that answers as a Bridge does and records every request. The readings, named in the pull request: the capabilities of a form are prefilled with the preset of a CLI agent and the place, the context and the model are left empty,
// so that a session is declared by the person; a session is written in the shape of an endpoint's declaration, each of place and model only where it is written and the context only where it is a whole number of tokens; what a session
// lacks is said in the words of an endpoint's line (`endpointLacks`). Each test states its input and its expected result before it runs (given / input / expect). Nothing reaches the network. The counter-proofs are recorded in the pull request.

import { installDocument, byClass, click, type, until } from "./settings-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";

installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, readSetting, writeSetting } = await import("../src/browser-store/index.mjs");

class Storage { constructor() { this.values = new Map(); } getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); }
  key(at) { return [...this.values.keys()][at] ?? null; } get length() { return this.values.size; } }
const ORIGIN = "https://published.example.test";
const PRESET = ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"];
const ALL = [...PRESET, "reach the web"];
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
const AGENTS = [{ name: "claude", version: "2", ready: true, loggedIn: true }, { name: "codex", version: "1", ready: false, loggedIn: false }];
const answer = (name) => (url) => (url.endsWith("/v1/pair") ? json({ bridge: { name, version: "1", platform: "linux" }, origin: ORIGIN }) : json({ agents: AGENTS, missing: [{ name: "opencode" }] }));

function freshStore() {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  const store = openStore("fixture/instance");
  writeSetting(store, "bridge:laptop", { address: "http://127.0.0.1:4711", token: "laptop-token" });
  writeSetting(store, "bridge:lab", { address: "http://127.0.0.1:9222", token: "lab-token" });
  return store;
}
function stand(t) {
  const calls = [];
  const prior = globalThis.fetch, priorLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return answer("Bridge")(String(url)); };
  Object.defineProperty(globalThis, "location", { configurable: true, value: { origin: ORIGIN } });
  t.after(() => { globalThis.fetch = prior; if (priorLocation) Object.defineProperty(globalThis, "location", priorLocation); else delete globalThis.location; });
  return calls;
}
async function bridgePage(store) {
  const target = document.createElement("div");
  document.body.append(target);
  await view.routes.find((route) => route.name === "bridge").render(target, { instance: { repository: "fixture/instance" }, store, go() {} }, {});
  return target;
}
const kept = (page, name) => byClass(page, "bridge-kept").find((section) => byClass(section, "bridge-kept-name")[0]?.textContent === name);
const sessionOf = (page, name, agent) => byClass(kept(page, name), "bridge-session").find((form) => byClass(form, "bridge-session-agent")[0]?.textContent === agent);
const tested = async (page, name) => { await click(byClass(kept(page, name), "bridge-kept-test")[0]); await until(() => byClass(kept(page, name), "bridge-session").length > 0, `the sessions of ${name}`); };
const checked = (form) => byClass(form, "bridge-session-capability").filter((box) => box.checked).map((box) => box.value);
const field = (form, name) => byClass(form, `bridge-session-${name}`)[0];
const declare = (form, { place, context, model }) => { type(field(form, "place"), place); type(field(form, "context"), context); type(field(form, "model"), model); };
const lacksOf = (form) => byClass(form, "bridge-session-lacks").map((node) => node.textContent).join(" ");

// TST-1186001 · level: unit · module: MOD-settings-pages
// guards: UC-044; UC-049
// given: a browser that keeps two Bridges, laptop and lab, and a Bridge behind each address that answers and records every request
// input: the route bridge drawn
// expect: a Test for each Bridge under its name and no form of a CLI session before a Test; no request has been sent
// Planted fault: drawing the route with a request to each Bridge fails the request count; drawing no Test fails the Tests.
test("TST-1186001: the route bridge draws a Test for each Bridge this browser keeps and sends no request", async (t) => {
  const store = freshStore();
  const calls = stand(t);
  const page = await bridgePage(store);
  assert.deepEqual(byClass(page, "bridge-kept").map((section) => byClass(section, "bridge-kept-name")[0].textContent).sort(), ["lab", "laptop"]);
  for (const name of ["lab", "laptop"]) assert.equal(byClass(kept(page, name), "bridge-kept-test").length, 1, `${name} has one Test`);
  assert.equal(byClass(page, "bridge-session").length, 0, "no form of a CLI session before a Test");
  assert.equal(calls.length, 0, "drawing the route sends no request");
});

// TST-1186002 · level: unit · module: MOD-settings-pages
// guards: UC-049; UC-044; UC-017
// given: the Bridge laptop, which lists the agent claude ready and the agent codex not ready, and the Bridge lab, which is not tested
// input: Test on the line of laptop
// expect: exactly two requests, /v1/pair and /v1/agents of the address of laptop, with its token; a form for claude and none for codex; its capabilities checked as a CLI agent's preset is (draft text, read the repository, write to the repository, run code and tests, use tools) and reach the web not checked; place, context and model empty; no request to lab
// Planted fault: a form for the agent that is not ready, a request to another Bridge, a third request, or capabilities other than the preset fail it.
test("TST-1186002: Test of a Bridge sends the two requests of testBridge and draws a form for each ready agent, prefilled with a CLI agent's preset", async (t) => {
  const store = freshStore();
  const calls = stand(t);
  const page = await bridgePage(store);
  await tested(page, "laptop");
  assert.deepEqual(calls.map((call) => call.url), ["http://127.0.0.1:4711/v1/pair", "http://127.0.0.1:4711/v1/agents"]);
  assert.ok(calls.every((call) => call.init.headers["x-agent-m-bridge-token"] === "laptop-token"), "each request carries the token of laptop");
  assert.deepEqual(byClass(kept(page, "laptop"), "bridge-session").map((form) => byClass(form, "bridge-session-agent")[0].textContent), ["claude"]);
  const form = sessionOf(page, "laptop", "claude");
  assert.deepEqual(checked(form), PRESET);
  assert.deepEqual(byClass(form, "bridge-session-capability").map((box) => box.value).sort(), [...ALL].sort(), "every capability can be chosen");
  assert.deepEqual(["place", "context", "model"].map((name) => field(form, name).value), ["", "", ""]);
  assert.equal(byClass(kept(page, "lab"), "bridge-session").length, 0);
});

// TST-1186003 · level: unit · module: MOD-settings-pages
// guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; UC-049
// given: the tested Bridge laptop with the form of claude
// input: place "this machine", context "200000", model "claude-opus-5-5" and the capability reach the web added to the preset, Save session; then context "12.5" and run code and tests unchecked, Save session
// expect: the first save keeps session:laptop:claude as { place: "this machine", context: 200000, model: "claude-opus-5-5", capabilities: the preset and reach the web }; the second keeps it with no context (a number of tokens is whole) and capabilities without run code and tests; no other key is written
// Planted fault: keeping the context as the text typed, keeping 12.5, or keeping the key under another name fails.
test("TST-1186003: Save session keeps the declaration under session:<bridge>:<agent>, the context only where it is a whole number of tokens", async (t) => {
  const store = freshStore();
  stand(t);
  const page = await bridgePage(store);
  await tested(page, "laptop");
  const form = sessionOf(page, "laptop", "claude");
  declare(form, { place: "this machine", context: "200000", model: "claude-opus-5-5" });
  byClass(form, "bridge-session-capability").find((box) => box.value === "reach the web").checked = true;
  await click(field(form, "save"));
  assert.deepEqual(readSetting(store, "session:laptop:claude"), { place: "this machine", context: 200000, model: "claude-opus-5-5", capabilities: ALL });
  type(field(form, "context"), "12.5");
  byClass(form, "bridge-session-capability").find((box) => box.value === "run code and tests").checked = false;
  await click(field(form, "save"));
  assert.deepEqual(readSetting(store, "session:laptop:claude"), { place: "this machine", model: "claude-opus-5-5", capabilities: ["draft text", "read the repository", "write to the repository", "use tools", "reach the web"] });
  assert.equal(readSetting(store, "session:laptop:codex"), null);
  assert.equal(readSetting(store, "session:lab:claude"), null);
});

// TST-1186004 · level: unit · module: MOD-settings-pages
// guards: UC-049; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// given: the tested Bridge laptop with the form of claude, nothing kept for it
// input: the form as drawn; then Save session with place and model written and no context; then with the context written and no place
// expect: the form names the session as not offered in the prompt bar and as lacking the place where it processes data, its context in tokens and its model; after the first save it names only its context in tokens; after the second only the place where it processes data
// Planted fault: naming nothing, naming all three after the first save, or naming a field that is written fails it.
test("TST-1186004: a session lacking a place, a context or a model is named as not offered in the prompt bar, with what it lacks", async (t) => {
  const store = freshStore();
  stand(t);
  const page = await bridgePage(store);
  await tested(page, "laptop");
  const form = sessionOf(page, "laptop", "claude");
  const drawn = lacksOf(form);
  assert.match(drawn, /prompt bar does not offer claude/);
  for (const lacking of ["the place where it processes data", "its context in tokens", "its model"]) assert.ok(drawn.includes(lacking), `drawn: ${lacking}`);
  declare(form, { place: "this machine", context: "", model: "claude-opus-5-5" });
  await click(field(form, "save"));
  const first = lacksOf(form);
  assert.ok(first.includes("its context in tokens"));
  assert.ok(!first.includes("the place where it processes data") && !first.includes("its model"), first);
  declare(form, { place: "", context: "200000", model: "claude-opus-5-5" });
  await click(field(form, "save"));
  const second = lacksOf(form);
  assert.ok(second.includes("the place where it processes data"));
  assert.ok(!second.includes("its context in tokens") && !second.includes("its model"), second);
});

// TST-1186005 · level: unit · module: MOD-settings-pages
// guards: UC-049; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// given: the tested Bridge laptop; a session claude declared with a place, a context and a model; the Bridge lab, whose session claude declares a place and a model only
// input: Save session on laptop's form; then the route drawn anew and Test on laptop and on lab
// expect: laptop's form names nothing as lacking after the save and again after the second Test, where it shows what is kept (place, context, model, capabilities); lab's form, drawn from what is kept, names its context in tokens as lacking
// Planted fault: naming a session that declares all three as lacking, or drawing the form again without what is kept, fails it.
test("TST-1186005: a session declared with a place, a context and a model is not named as lacking, and a Test shows what is kept", async (t) => {
  const store = freshStore();
  stand(t);
  writeSetting(store, "session:lab:claude", { place: "this machine", model: "claude-opus-5-5", capabilities: PRESET });
  const page = await bridgePage(store);
  await tested(page, "laptop");
  const form = sessionOf(page, "laptop", "claude");
  declare(form, { place: "this machine", context: "200000", model: "claude-opus-5-5" });
  await click(field(form, "save"));
  assert.equal(lacksOf(form), "", "nothing is lacking");
  const again = await bridgePage(store);
  await tested(again, "laptop");
  await tested(again, "lab");
  const laptop = sessionOf(again, "laptop", "claude");
  assert.deepEqual(["place", "context", "model"].map((name) => field(laptop, name).value), ["this machine", "200000", "claude-opus-5-5"]);
  assert.deepEqual(checked(laptop), PRESET);
  assert.equal(lacksOf(laptop), "");
  const lab = sessionOf(again, "lab", "claude");
  assert.match(lacksOf(lab), /its context in tokens/);
  assert.ok(!/place|its model/.test(lacksOf(lab)), lacksOf(lab));
});
