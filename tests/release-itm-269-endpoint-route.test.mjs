// Independent release coverage for ITM-269's public endpoint Route.
// Run: node --test tests/release-itm-269-endpoint-route.test.mjs
// Module: MOD-settings-pages · MOD-browser-store · MOD-bridge-client · MOD-desktop-shell
// Level: release
// Guards: UC-003; UC-044; CONFIGURATION LIVES IN THE BROWSER; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR
// Guards: A CREDENTIAL IS NEVER PLACED IN A URL; AN UNSUPPORTED ENDPOINT SAYS SO
// Scope boundary: this exercises the public MOD-settings-pages Route with supplied context, not dashboard-app dispatch.
// Scope within UC-003: alternative 2a. Real local path: Route -> bridge-client -> compose -> bridge-http -> jobHandlers -> controlled own-model HTTP server.
// HTTPS is controlled at fetch because this test neither provisions a tunnel nor a browser-trusted certificate;
// UC-003/UC-044 remain separate.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import Module from "node:module";
import test from "node:test";
import { openStore, readSetting, writeSetting } from "../src/browser-store/index.mjs";
import { ssh2NodePath } from "./ssh2-fixture.mjs";

const ssh2Cache = join(tmpdir(), "agent-m-291-release-269-ssh2-1.17.0");
let sshRuntimeFailure;
function sshRuntime() {
  if (sshRuntimeFailure) throw sshRuntimeFailure;
  try {
    return ssh2NodePath(ssh2Cache);
  } catch (failure) { sshRuntimeFailure = failure; throw failure; }
}
process.env.NODE_PATH = sshRuntime();
Module._initPaths();
const { compose } = await import("../src/desktop-shell/compose.mjs");
import { view } from "../src/settings-pages/index.mjs";

const INSTANCE = "release-owner/agent-m", ORIGIN = "https://release-owner.github.io";
const LOCAL = { kind: "openai-compatible", model: "small", key: "release-local-key", bridge: "local" };
class Element extends EventTarget { constructor(name) { super(); this.localName = name; this.childNodes = []; this.className = ""; this.value = ""; this.type = ""; this.checked = false; } append(...nodes) { for (const node of nodes.flat()) this.childNodes.push(typeof node === "string" ? new Text(node) : node); } replaceChildren(...nodes) { this.childNodes = []; this.append(...nodes); } get textContent() { return this.childNodes.map((child) => child.textContent).join(""); } set textContent(value) { this.replaceChildren(String(value)); } focus() {} }
class Text { constructor(value) { this.value = String(value); } get textContent() { return this.value; } }
globalThis.document = { createElement: (name) => new Element(name) };
function all(root, className) { const found = []; (function visit(node) { for (const child of node.childNodes ?? []) if (child instanceof Element) { if (child.className.split(" ").includes(className)) found.push(child); visit(child); } })(root); return found; }
const click = async (button) => { button.dispatchEvent(new Event("click")); await new Promise((resolve) => setImmediate(resolve)); };
async function endpointSettles(target) { for (let i = 0; i < 100; i += 1) { if (!all(target, "endpoint-result")[0]?.textContent.startsWith("Testing")) return; await new Promise((resolve) => setTimeout(resolve, 5)); } throw new Error("endpoint Route did not settle"); }
class Storage { constructor() { this.values = new Map(); } getItem(key) { return this.values.get(key) ?? null; } setItem(key, value) { this.values.set(key, String(value)); } removeItem(key) { this.values.delete(key); } get length() { return this.values.size; } key(index) { return [...this.values.keys()][index] ?? null; } }
function store() { Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() }); return openStore(INSTANCE); }
function route() { const value = view.routes.find((entry) => entry.name === "endpoints"); assert.ok(value, "MOD-settings-pages publishes the endpoint Route"); return value; }
async function render(settings, params = {}, navigations = []) { const target = document.createElement("div"); await route().render(target, { instance: { repository: INSTANCE }, store: settings, go(name, routeParams) { navigations.push({ route: name, params: routeParams }); } }, params); return target; }
function fill(target, setting) { all(target, "endpoint-name")[0].value = "local"; all(target, "endpoint-url")[0].value = setting.url; all(target, "endpoint-kind")[0].value = setting.kind; all(target, "endpoint-model")[0].value = setting.model; all(target, "endpoint-key")[0].value = setting.key; all(target, "endpoint-bridge")[0].value = setting.bridge; all(target, "endpoint-bridge")[0].dispatchEvent(new Event("change")); }
const listen = (server) => new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server.address().port)); });
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
async function model(answer, observe) { const received = []; const server = http.createServer(async (request, response) => { let body = ""; for await (const chunk of request) body += chunk; const arrival = { path: request.url, authorization: request.headers.authorization, body: JSON.parse(body) }; received.push(arrival); observe?.(arrival); response.writeHead(answer.status, { "content-type": "application/json" }); response.end(JSON.stringify(answer.body)); }); const port = await listen(server); return { address: `http://127.0.0.1:${port}/v1`, received, close: () => close(server) }; }
async function realBridge(answer, t, observe) { const folder = await mkdtemp(join(tmpdir(), "agent-m-release-269-")); const ownModel = await model(answer, observe); const bridge = await compose({ instance: INSTANCE, origin: ORIGIN, dataFolder: folder, port: 0 }); const original = globalThis.fetch; globalThis.fetch = async (url, init = {}) => original(url, { ...init, headers: { ...init.headers, Origin: ORIGIN } }); t.after(async () => { globalThis.fetch = original; await bridge.close(); await ownModel.close(); await rm(folder, { recursive: true, force: true }); }); return { bridge, ownModel }; }

// Module (as the case stated it): MOD-settings-pages · MOD-browser-store · MOD-bridge-client · MOD-desktop-shell
// TST-269901 · level: release · module: MOD-settings-pages
// guards: UC-003; UC-044; CONFIGURATION LIVES IN THE BROWSER; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A CREDENTIAL IS NEVER PLACED IN A URL; AN UNSUPPORTED ENDPOINT SAYS SO
// given: public endpoint Route, paired production compose/jobHandlers and a controlled own-model HTTP server
// input: Save and test a local endpoint; reload it; Show its key; Clear it
// expect: Save precedes one real Bridge/model request; reload/Show retain it; raw Clear removes it
test("TST-269901: Route persists, shows, and clears an endpoint through the composed Bridge", async (t) => {
  let settings, setting; const savedAtModelArrival = [];
  const { bridge, ownModel } = await realBridge({ status: 200, body: { choices: [{ message: { content: "ok" } }] } }, t, () => savedAtModelArrival.push(readSetting(settings, "endpoint:local")));
  settings = store(); setting = { ...LOCAL, url: ownModel.address }; writeSetting(settings, "bridge:local", { address: bridge.address, token: bridge.token });
  let target = await render(settings); fill(target, setting); await click(all(target, "endpoint-test")[0]); await endpointSettles(target);
  assert.deepEqual(savedAtModelArrival, [setting], "failure node: Route saves before the model request");
  assert.deepEqual(readSetting(settings, "endpoint:local"), setting, "failure node: Route saves before probing");
  assert.match(all(target, "endpoint-result")[0].textContent, /small is working/i, "failure node: actual model success becomes the Route working result");
  assert.deepEqual(ownModel.received, [{ path: "/v1/chat/completions", authorization: `Bearer ${LOCAL.key}`, body: { model: LOCAL.model, messages: [{ role: "user", content: "Call agent_m_probe once. It is a harmless capability check." }], max_tokens: 64, tools: [{ type: "function", function: { name: "agent_m_probe", description: "Report that tool calling works without changing anything.", parameters: { type: "object", properties: {}, additionalProperties: false } } }], stream: false } }], "failure node: compose dispatches via jobHandlers to the controlled model exactly once");
  assert.equal(ownModel.received[0].path.includes(LOCAL.key), false, "endpoint key is absent from the model URL");
  target = await render(settings, { name: "local" }); const key = all(target, "endpoint-key")[0]; assert.equal(key.value, LOCAL.key, "reload reads the stored endpoint key"); assert.equal(key.type, "password", "stored key starts hidden"); await click(all(target, "endpoint-show")[0]); assert.equal(key.type, "text", "Show reveals only after click"); await click(all(target, "endpoint-clear")[0]); assert.equal(readSetting(settings, "endpoint:local"), null, "failure node: Clear removes the raw browser entry");
});

// Module (as the case stated it): MOD-settings-pages · MOD-browser-store · MOD-bridge-client · MOD-desktop-shell
// TST-269902 · level: release · module: MOD-settings-pages
// guards: UC-003; UC-044; CONFIGURATION LIVES IN THE BROWSER; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A CREDENTIAL IS NEVER PLACED IN A URL; AN UNSUPPORTED ENDPOINT SAYS SO
// given: same Route and real compose, but controlled model refuses its API key
// input: Save and test, then reload the Route
// expect: named provider refusal and retained setting
test("TST-269902: Route preserves provider refusal and saved endpoint through real Bridge", async (t) => {
  const { bridge, ownModel } = await realBridge({ status: 401, body: { error: { message: "provider refused this key" } } }, t);
  const settings = store(), setting = { ...LOCAL, url: ownModel.address }; writeSetting(settings, "bridge:local", { address: bridge.address, token: bridge.token }); const target = await render(settings); fill(target, setting); await click(all(target, "endpoint-test")[0]); await endpointSettles(target);
  assert.match(all(target, "endpoint-result")[0].textContent, /provider refused this key/i, "failure node: named provider diagnosis returns through compose/jobHandlers"); const reloaded = await render(settings, { name: "local" }); assert.equal(all(reloaded, "endpoint-key")[0].value, LOCAL.key, "provider refusal does not discard key on reload"); assert.equal(ownModel.received.length, 1, "one Route test gives one model request");
});

// Module (as the case stated it): MOD-settings-pages · MOD-browser-store
// TST-269903 · level: release · module: MOD-settings-pages
// guards: UC-003; UC-044; CONFIGURATION LIVES IN THE BROWSER; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A CREDENTIAL IS NEVER PLACED IN A URL; AN UNSUPPORTED ENDPOINT SAYS SO
// given: completed local endpoint, no paired Bridge
// input: Save/test then Set up the Bridge
// expect: no direct model request; saved record and actionable supplied-context setup handoff
test("TST-269903: absent pairing stores endpoint and emits setup contract without fallback", async (t) => {
  const settings = store(), navigations = [], original = globalThis.fetch; let calls = 0; globalThis.fetch = async () => { calls += 1; throw new Error("direct fallback"); }; t.after(() => { globalThis.fetch = original; }); const target = await render(settings, {}, navigations); fill(target, { ...LOCAL, url: "http://127.0.0.1:11434/v1" }); await click(all(target, "endpoint-test")[0]); assert.equal(calls, 0, "failure node: absent Bridge makes no direct model request"); assert.equal(readSetting(settings, "endpoint:local").bridge, "local", "missing pairing retains the named endpoint Bridge"); await click(all(target, "endpoint-bridge-setup")[0]); assert.deepEqual(navigations, [{ route: "bridge", params: { name: "local" } }], "failure node: Route emits its setup handoff");
});

// Module (as the case stated it): MOD-settings-pages · MOD-bridge-client
// TST-269904 · level: release · module: MOD-settings-pages
// guards: UC-003; UC-044; CONFIGURATION LIVES IN THE BROWSER; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR; A CREDENTIAL IS NEVER PLACED IN A URL; AN UNSUPPORTED ENDPOINT SAYS SO
// given: accepted HTTPS Bridge address/token and separate jump-host login; HTTPS transport controlled at fetch
// input: endpoint test, then refused-token and unavailable transport
// expect: header/body mapping and named diagnoses
test("TST-269904: Route maps configured HTTPS credentials and names refused/unavailable Bridge", async (t) => {
  const settings = store(), original = globalThis.fetch, calls = []; let mode = "success"; globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); if (mode === "refused") return new Response(JSON.stringify({ error: "token-refused" }), { status: 401 }); if (mode === "unavailable") throw new TypeError("network down"); return new Response(JSON.stringify({ answer: { works: true, model: LOCAL.model } }), { status: 200 }); }; t.after(() => { globalThis.fetch = original; }); const address = "https://jump.example.test"; writeSetting(settings, "bridge:local", { port: 40100, token: "bridge-token" }); writeSetting(settings, "jump-host", { hostname: "jump.example.test", user: "ssh-user", sshPort: 22, portRange: [40100, 40199], httpsAddress: address, login: { user: "web-user", password: "web-password" } }); let target = await render(settings); fill(target, { ...LOCAL, url: "http://127.0.0.1:11434/v1" }); await click(all(target, "endpoint-test")[0]); assert.equal(calls[0].url, `${address}/bridge/local/v1/probes/endpoint-test`); assert.equal(calls[0].init.headers["x-agent-m-bridge-token"], "bridge-token"); assert.equal(calls[0].init.headers.Authorization, `Basic ${Buffer.from("web-user:web-password").toString("base64")}`); assert.deepEqual(JSON.parse(calls[0].init.body), { args: { name: "local", kind: LOCAL.kind, baseUrl: "http://127.0.0.1:11434/v1", model: LOCAL.model, key: LOCAL.key } }); assert.equal(calls[0].url.includes("bridge-token") || calls[0].url.includes("web-password") || calls[0].url.includes(LOCAL.key), false, "credentials stay out of controlled HTTPS URL"); mode = "refused"; target = await render(settings, { name: "local" }); await click(all(target, "endpoint-test")[0]); assert.match(all(target, "endpoint-result")[0].textContent, /refused.*token|token.*refused/i, "failure node: refused pairing stays named"); mode = "unavailable"; target = await render(settings, { name: "local" }); await click(all(target, "endpoint-test")[0]); assert.match(all(target, "endpoint-result")[0].textContent, /gave no answer|not running|wrong address/i, "failure node: unavailable Bridge stays actionable");
});
