// Release tests of ITM-1186 — UC-049 and UC-044: a CLI session a Bridge offers is declared on the dashboard's page of the Bridge, in this browser, with its place, context, model and capabilities (docs/architecture/MOD-settings-pages.md, `bridge`: "for each CLI
// session a Bridge offers (MOD-bridge-client's `testBridge`), the place where it processes data, its context in tokens, its model and its capabilities, prefilled as for a CLI agent (UC-017), kept under `session:<bridge>:<agent>`, and one lacking a place, a context or
// a model named as not offered in the prompt bar (UC-049 1b)"), and the settings page says that the prompt bar appears once an endpoint is configured or a Bridge offers a CLI session (UC-049 1a).
// Run: node --test tests/release-itm-1186-bridge-sessions.test.mjs
//
// Module: MOD-settings-pages
// Module: MOD-bridge-client
// Guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; CONFIGURATION LIVES IN THE BROWSER; EVERY STEP EXPLAINS ITSELF; UC-049; UC-044
// Level: release
//
// Written for the release testing of sprint 126 by developer-sonnet-l, who implemented none of ITM-1186 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the real dashboard (tests/app-harness.mjs: src/site-frame/dashboard-app.mjs over a counting fake
// GitHub) opened on the route `bridge`, with this browser keeping one paired Bridge, `lab`, which is a real controlled Bridge server on a loopback port (src/bridge-http, as tests/release-itm-280-dashboard-bridge-setup.test.mjs serves one) whose `/v1/agents` lists the
// agent claude ready and the agent codex not ready. Every request to that Bridge is kept. Readings the texts leave open, which the cases state:
//   - "Test" is the button of the Bridge's line; "Save session" the button of an agent's form; the form of an agent is the controls `.bridge-session-place`, `.bridge-session-context`, `.bridge-session-model` and `.bridge-session-capability`.
//   - "prefilled as for a CLI agent (UC-017)" is read, for the capabilities, as the preset of a CLI agent: draft text, read the repository, write to the repository, run code and tests, use tools; and for the place, context and model as empty (the person declares them).
//   - "not offered in the prompt bar" is read as a line of the form that says the prompt bar does not offer the agent and names what it lacks.
//   - What the Bridge sees of a drawn page is the requests it receives: the prompt bar of the page tests each Bridge this browser keeps when it is drawn (MOD-prompt-bar: MOD-bridge-client's testBridge, `GET /v1/pair` and `GET /v1/agents`), so a page that
//     is drawn sends those two and the route itself sends none besides.

import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { repoServer, openDashboard, press, richDocument } from "./app-harness.mjs";
import { serveBridge } from "../src/bridge-http/index.mjs";

const ORIGIN = "https://akmaier.github.io";
const INSTANCE = "akmaier/agent-m";
const key = (name) => `agent-m:${INSTANCE}:${name}`;
const PRESET = ["draft text", "read the repository", "write to the repository", "run code and tests", "use tools"];
// app-harness replaces global fetch for every dashboard; Node's own is kept, so that the dashboard's requests to the loopback Bridge reach it.
const nativeFetch = globalThis.fetch;
const AGENTS = { agents: [{ name: "claude", version: "2.1.300", ready: true, loggedIn: true }, { name: "codex", version: "1.0.0", ready: false, loggedIn: false }], missing: [{ name: "opencode" }] };

async function dashboard(t, hash = "#bridge") {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-1186-release-"));
  const seen = [];
  const bridge = await serveBridge({ name: () => "lab-pc", host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false },
    { jobs: { "GET /v1/agents": async () => AGENTS }, mail: {}, tunnels: {} });
  t.after(async () => bridge.close());
  const server = await repoServer({ files: {}, handlers: [async (url, init) => {
    if (url.hostname !== "127.0.0.1") return null;
    seen.push({ path: url.pathname, token: init.headers?.["x-agent-m-bridge-token"] ?? null });
    return nativeFetch(url.href, { ...init, headers: { ...init.headers, Origin: ORIGIN } });
  }] });
  const page = await openDashboard({ server, hash, entries: { [key("bridge:lab")]: JSON.stringify({ address: bridge.address, token: bridge.token }) } });
  const dom = richDocument();
  await page.go(hash);
  return { bridge, seen, page, server, main: dom.byId("main") };
}
const one = (main, selector) => { const found = main.querySelector(selector); assert.ok(found, `the page has ${selector}`); return found; };
const all = (main, selector) => main.querySelectorAll(selector);
const sessionKey = "session:lab:claude";
const stored = (name) => { const raw = globalThis.localStorage.getItem(key(name)); return raw === null ? null : JSON.parse(raw); };
const declare = (main, { place, context, model }) => { one(main, ".bridge-session-place").value = place; one(main, ".bridge-session-context").value = context; one(main, ".bridge-session-model").value = model; };

// TST-1186301 · level: release · module: MOD-settings-pages
// guards: UC-049; UC-044; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE
// given: this browser keeps the Bridge lab, a real Bridge that lists the agent claude ready and the agent codex not ready; known positive first — the Bridge answers a request
// input: the route bridge is drawn; the person presses Test on the line of lab
// expect: known positive — Test reached the Bridge; drawing the page sent the Bridge exactly the two requests of the prompt bar's test of it, /v1/pair and /v1/agents, and none of the route; Test then sent exactly /v1/pair and /v1/agents, each with the Bridge's token; the page then holds the form of claude and none for codex; claude's capabilities are the preset of a CLI agent (draft text, read the repository, write to the repository, run code and tests, use tools) and reach the web is not among them; its place, context and model are empty
test("TST-1186301: Test of a Bridge lists the CLI sessions it offers, a form for each ready one, prefilled as for a CLI agent", async (t) => {
  const { seen, server, main } = await dashboard(t);
  assert.deepEqual(seen.map((request) => request.path), ["/v1/pair", "/v1/agents"], "drawing the page sends the Bridge the prompt bar's two requests, and the route none besides");
  seen.length = 0;
  await press(server, one(main, ".bridge-kept-test"));
  assert.deepEqual(seen.map((request) => request.path), ["/v1/pair", "/v1/agents"], "known positive: Test reached the Bridge, with the two requests of testBridge");
  assert.ok(seen.every((request) => typeof request.token === "string" && request.token.length > 0), "each carries the Bridge's token");
  assert.deepEqual(all(main, ".bridge-session-agent").map((node) => node.textContent), ["claude"], "a form for the ready agent, none for the other");
  assert.deepEqual(all(main, ".bridge-session-capability").filter((box) => box.checked).map((box) => box.value), PRESET);
  assert.ok(all(main, ".bridge-session-capability").some((box) => box.value === "reach the web" && !box.checked), "reach the web can be chosen and is not");
  assert.deepEqual([".bridge-session-place", ".bridge-session-context", ".bridge-session-model"].map((selector) => one(main, selector).value), ["", "", ""]);
});

// TST-1186302 · level: release · module: MOD-settings-pages
// guards: CONFIGURATION LIVES IN THE BROWSER; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; UC-049
// given: the tested Bridge lab with the form of claude, and nothing kept for it
// input: the person writes place "this machine", context "200000", model "claude-opus-5-5" and presses Save session; then writes the context "12.5" and presses Save session
// expect: the first save keeps, in this browser's localStorage under session:lab:claude, { place: "this machine", context: 200000, model: "claude-opus-5-5", capabilities: the preset }, the context a number; the second keeps it with no context, since a number of tokens is whole; no other session key is written; the Bridge received no request but the two of the prompt bar's test when the page was drawn and the two of Test
test("TST-1186302: Save session keeps the declaration under session:<bridge>:<agent>, the context only as a whole number", async (t) => {
  const { seen, server, main } = await dashboard(t);
  await press(server, one(main, ".bridge-kept-test"));
  declare(main, { place: "this machine", context: "200000", model: "claude-opus-5-5" });
  await press(server, one(main, ".bridge-session-save"));
  assert.deepEqual(stored(sessionKey), { place: "this machine", context: 200000, model: "claude-opus-5-5", capabilities: PRESET });
  declare(main, { place: "this machine", context: "12.5", model: "claude-opus-5-5" });
  await press(server, one(main, ".bridge-session-save"));
  assert.deepEqual(stored(sessionKey), { place: "this machine", model: "claude-opus-5-5", capabilities: PRESET });
  const keys = Array.from({ length: globalThis.localStorage.length }, (_, at) => globalThis.localStorage.key(at)).filter((name) => name.includes(":session:"));
  assert.deepEqual(keys, [key(sessionKey)], "no other session is written");
  assert.deepEqual(seen.map((request) => request.path), ["/v1/pair", "/v1/agents", "/v1/pair", "/v1/agents"], "the prompt bar's two when the page was drawn, then the two of Test");
});

// TST-1186303 · level: release · module: MOD-settings-pages
// guards: THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; UC-049
// given: the tested Bridge lab with the form of claude, nothing kept for it
// input: the form as drawn; Save session with a place and a model and no context; Save session with all three
// expect: the form says the prompt bar does not offer claude and names what it lacks — the place where it processes data, its context in tokens and its model; after the first save only its context in tokens; after the third (counter-proof) it names nothing as lacking
test("TST-1186303: a session lacking a place, a context or a model is named as not offered in the prompt bar; a complete one is not", async (t) => {
  const { server, main } = await dashboard(t);
  await press(server, one(main, ".bridge-kept-test"));
  const lacks = () => all(main, ".bridge-session-lacks").map((node) => node.textContent).join(" ");
  assert.match(lacks(), /prompt bar does not offer claude/);
  for (const lacking of ["the place where it processes data", "its context in tokens", "its model"]) assert.ok(lacks().includes(lacking), `drawn: ${lacking}`);
  declare(main, { place: "this machine", context: "", model: "claude-opus-5-5" });
  await press(server, one(main, ".bridge-session-save"));
  assert.ok(lacks().includes("its context in tokens") && !lacks().includes("the place where it processes data") && !lacks().includes("its model"), lacks());
  declare(main, { place: "this machine", context: "200000", model: "claude-opus-5-5" });
  await press(server, one(main, ".bridge-session-save"));
  assert.equal(lacks(), "", "counter-proof: a complete declaration is not named");
});

// TST-1186304 · level: release · module: MOD-settings-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-049
// given: the dashboard's settings pages of a browser that keeps one endpoint-less Bridge
// input: the page of the endpoints and the page of the participants are drawn
// expect: UC-049 1a says "The settings page says that it appears once an endpoint is configured or a Bridge offers a CLI session": the endpoints page carries a folded explanation with the summary "What is this?" that says the prompt bar appears once an endpoint is configured or a Bridge it keeps offers a CLI session; the participants page does not say it
test("TST-1186304: the endpoints page explains when the prompt bar appears, in a fold, and the participants page does not", async (t) => {
  const said = /prompt bar appears once an endpoint is configured[^.<]*Bridge[^.<]*offers a CLI session/i;
  const endpoints = await dashboard(t, "#endpoints");
  const folds = (html) => [...html.matchAll(/<details[^>]*class="[^"]*\bexplain\b[^"]*"[^>]*>([^]*?)<\/details>/g)].map((match) => match[1]);
  const html = endpoints.page.main();
  assert.ok(folds(html).some((fold) => /<summary>What is this\?<\/summary>/.test(fold) && said.test(fold)), "the endpoints page folds the explanation");
  const participants = await dashboard(t, "#participants");
  assert.doesNotMatch(participants.page.main(), said, "the participants page does not say it");
});
