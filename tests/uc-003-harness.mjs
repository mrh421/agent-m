// The harness of the system and release tests of UC-003 (Configure a model endpoint): the dashboard as a person meets it on Settings -> Endpoints & Agents (the real app of MOD-site-frame over the real
// MOD-settings-pages, MOD-browser-store, MOD-endpoint-calls and MOD-bridge-client, behind tests/app-harness.mjs' repository servers in memory), a Bridge that is the real `compose()` of MOD-desktop-shell
// (MOD-bridge-http's server and MOD-bridge-jobs' handlers, run as a program of its own, as it runs beside a browser), and a model server that is a controlled HTTP server on the loopback address, which counts what
// it receives. Nothing reaches the network. It holds no test and no expected result: what it builds are inputs and ledgers, and every test states its own expected values.
// Imported by tests/system-uc-003-configure-a-model-endpoint.test.mjs, tests/system-uc-003-a-job-through-the-bridge.test.mjs, tests/release-uc-003-configure-a-model-endpoint.test.mjs and
// tests/release-uc-003-a-job-through-the-https-route.test.mjs; tests/uc-003-job-harness.mjs adds the prompt bar to it.
//
// Module: MOD-settings-pages
// Module: MOD-browser-store
// Module: MOD-endpoint-calls
// Module: MOD-bridge-client
// Module: MOD-bridge-http
// Module: MOD-bridge-jobs
// Module: MOD-desktop-shell
// Level: system
//
// Authored by developer-sonnet-k (ITM-266). The model server answers the short test request with a call of the tool it was offered (`callsTool`), with text alone (`saysText`), with a refusal of tools
// (`refusesTools`) or of the key (`refusesKey`), and every other request, the request of a job, with the one JSON answer a conversation reads. The browser cannot call a server on the loopback address over
// plain http (the case of UC-003 2a), so the dashboard's fetch refuses it as a browser does (TypeError "Failed to fetch") and passes a request to the Bridge on, with the Origin header a browser adds, to the real Bridge.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import Module from "node:module";
import { openDashboard, press, repoServer, richDocument } from "./app-harness.mjs";
import { ssh2NodePath } from "./ssh2-fixture.mjs";

export { press };
process.env.NODE_PATH = ssh2NodePath(join(tmpdir(), "agent-m-266-uc003-ssh2-1.17.0"));
Module._initPaths();

export const ORIGIN = "https://akmaier.github.io", INSTANCE = "akmaier/agent-m", PREFIX = `agent-m:${INSTANCE}:`;
export const nativeFetch = globalThis.fetch;
export const PROBE_PROMPT = "Call agent_m_probe once. It is a harmless capability check.";

const listen = (server) => new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server.address().port)); });
const close = (server) => new Promise((resolve, reject) => { server.closeAllConnections?.(); server.close((error) => error ? reject(error) : resolve()); });

// ---------------------------------------------------------------- the Bridge: the real composed program

const COMPOSE_URL = new URL("../src/desktop-shell/compose.mjs", import.meta.url).href;
const BRIDGE_PROGRAM = `
const { compose } = await import(process.env.AGENT_M_COMPOSE_URL);
const bridge = await compose(JSON.parse(process.env.AGENT_M_COMPOSE_OPTIONS));
process.stdout.write(JSON.stringify({ address: bridge.address, token: bridge.token }) + "\\n");
process.stdin.resume();
process.stdin.on("end", async () => { await bridge.close(); process.exit(0); });`;

/** startBridge(t) -> Promise<{ address, token, close }> — MOD-desktop-shell's compose() in a program of its own (the job runner's registry is kept for the life of a program), answering at its loopback address with its pairing token. */
export async function startBridge(t) {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-266-uc003-"));
  const options = { instance: INSTANCE, origin: ORIGIN, dataFolder: folder, port: 0 };
  const child = spawn(process.execPath, ["--input-type=module", "-e", BRIDGE_PROGRAM], { stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, AGENT_M_COMPOSE_URL: COMPOSE_URL, AGENT_M_COMPOSE_OPTIONS: JSON.stringify(options) } });
  const started = await new Promise((resolve, reject) => {
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk; if (out.includes("\n")) resolve(JSON.parse(out.slice(0, out.indexOf("\n")))); });
    child.once("exit", (code) => reject(new Error(`the composed Bridge ended with ${code} before it answered`)));
  });
  const bridge = { ...started, close: () => new Promise((resolve) => { child.once("exit", () => resolve()); child.stdin.end(); }) };
  t.after(async () => { await bridge.close(); await rm(folder, { recursive: true, force: true }); });
  return bridge;
}

// ---------------------------------------------------------------- the model server: a controlled HTTP server that counts what it receives

/** The answer of a model that calls the tool it is offered. */
export const callsTool = () => ({ body: { choices: [{ message: { content: null, tool_calls: [{ id: "call-1", type: "function", function: { name: "agent_m_probe", arguments: "{}" } }] } }] } });
/** The answer of a model that answers with text and calls no tool. */
export const saysText = (text = "ok") => ({ body: { choices: [{ message: { content: text } }] } });
/** The answer of an endpoint that rejects the tool it is offered. */
export const refusesTools = (message) => ({ status: 400, body: { error: { message } } });
/** The answer of an endpoint that refuses the key. */
export const refusesKey = (message = "Invalid API key.") => ({ status: 401, body: { error: { message } } });
/** The answer of a conversation: the one JSON answer the kind `converse` reads. */
export const conversation = (text) => saysText(JSON.stringify({ draft: { answer: text }, answers: [] }));

const isProbe = (body) => Array.isArray(body?.tools) && body.tools.some((tool) => tool?.function?.name === "agent_m_probe");

/**
 * modelServer(t, answer?) -> Promise<{ origin, url, seen }> — a server on the loopback address that is no browser's to call: `answer(request, number)` gives its reply to the request it received (default: the short test
 * request, which offers the tool agent_m_probe, is answered with a call of it, every other request with a conversation's answer). `seen` holds each request as it arrived: `{ method, path, headers, body }`; the server sends no
 * cross-origin header.
 */
export async function modelServer(t, answer = (request) => (isProbe(request.body) ? callsTool() : conversation("The model answers."))) {
  const seen = [];
  const server = http.createServer(async (request, response) => {
    let text = ""; for await (const chunk of request) text += chunk;
    const entry = { method: request.method, path: request.url, headers: request.headers, body: text ? JSON.parse(text) : null };
    seen.push(entry);
    const { status = 200, body } = answer(entry, seen.length);
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  });
  const port = await listen(server);
  t.after(() => close(server));
  return { origin: `http://127.0.0.1:${port}`, url: `http://127.0.0.1:${port}/v1`, seen };
}

// ---------------------------------------------------------------- the dashboard on Settings

/** A cookie written by the page: the browser's document, with a `cookie` that keeps what is assigned to it. Returns the assignments. */
export function cookieSpy() {
  const written = [];
  Object.defineProperty(globalThis.document, "cookie", { configurable: true, get: () => "", set: (value) => { written.push(String(value)); } });
  return written;
}

/** dump() -> { key: raw value } — every entry of this browser's localStorage. */
export function dump() {
  const entries = {};
  for (let at = 0; at < globalThis.localStorage.length; at++) { const key = globalThis.localStorage.key(at); entries[key] = globalThis.localStorage.getItem(key); }
  return entries;
}
/** stored(name) -> the record of the endpoint `name` as localStorage holds it, or null. */
export const stored = (name) => JSON.parse(globalThis.localStorage.getItem(`${PREFIX}endpoint:${name}`));
export const lastTest = (name) => JSON.parse(globalThis.localStorage.getItem(`${PREFIX}last-test:endpoint:${name}`));
/** The entry of a Bridge as the settings page keeps it. */
export const bridgeEntry = (bridge) => ({ address: bridge.address, token: bridge.token });
export const keptBridge = (name, bridge) => ({ [`${PREFIX}bridge:${name}`]: JSON.stringify(bridgeEntry(bridge)) });

/**
 * forwardTo(bridge, ledger) -> handler — the dashboard's request to the Bridge at its address, kept in `ledger` and passed on to the real Bridge with the Origin header a browser adds.
 */
export const forwardTo = (bridge, ledger) => async (url, init) => {
  if (url.origin !== bridge.address) return null;
  ledger.push({ url: url.href, method: init.method ?? "GET", headers: { ...init.headers }, body: init.body ?? null });
  return nativeFetch(url.href, { ...init, headers: { ...init.headers, Origin: ORIGIN } });
};
export const JUMP_HOST = "https://jump.example.test", LOGIN = { user: "web-user", password: "web-password" };
/** The jump host's entry as Settings keeps it (UC-044): its HTTPS address and the web server's login, and the Bridge kept at a port of its range. */
export const jumpHostEntries = (bridge, name = "lab", login = LOGIN) => ({ [`${PREFIX}jump-host`]: JSON.stringify({ hostname: "jump.example.test", user: "ssh-user", sshPort: 22, portRange: [40100, 40199], httpsAddress: JUMP_HOST, login }),
  [`${PREFIX}bridge:${name}`]: JSON.stringify({ port: 40100, token: bridge.token }) });
/**
 * jumpHostFront(bridge, ledger, name?) -> handler — the jump host's web server at its HTTPS address (UC-044's already-configured route), a fixture in front of the real Bridge: a request to `/bridge/<name>/…` is kept in `ledger`, answered 401 with
 * a Basic challenge unless it carries the web server's own login, and otherwise passed on to the real Bridge's loopback address with the Origin header a browser adds.
 */
export const jumpHostFront = (bridge, ledger, name = "lab") => async (url, init) => {
  if (url.origin !== JUMP_HOST) return null;
  ledger.push({ url: url.href, method: init.method ?? "GET", headers: { ...init.headers }, body: init.body ?? null });
  if (init.headers?.Authorization !== `Basic ${Buffer.from(`${LOGIN.user}:${LOGIN.password}`).toString("base64")}`) {
    return new Response(JSON.stringify({ error: "login-refused" }), { status: 401, headers: { "www-authenticate": "Basic realm=jump-host" } });
  }
  return nativeFetch(`${bridge.address}${url.pathname.slice(`/bridge/${name}`.length)}${url.search}`, { ...init, headers: { ...init.headers, Origin: ORIGIN } });
};
/** refusesBrowser(origin, ledger) -> handler — a server the browser cannot call: the page's fetch to it fails as a browser's does. */
export const refusesBrowser = (origin, ledger) => async (url, init) => {
  if (url.origin !== origin) return null;
  ledger.push({ url: url.href, method: init?.method ?? "GET", headers: { ...init?.headers }, body: init?.body ?? null });
  throw new TypeError("Failed to fetch");
};
/** answers(origin, ledger, reply) -> handler — a server the browser may call: `reply(url, init)` is its Response; every request is kept in `ledger` with its headers and body. */
export const answers = (origin, ledger, reply) => async (url, init) => {
  if (url.origin !== origin) return null;
  ledger.push({ url: url.href, method: init?.method ?? "GET", headers: { ...init?.headers }, body: init?.body ?? null });
  return reply(url, init);
};
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/**
 * openSettings({ handlers, entries }) -> Promise<World> — a page load of the dashboard on Settings, a cookie spy installed, `entries` already in localStorage. World: { server, page, main, cookies, sent (every request the page sent, `{ origin, url,
 * method, headers, body }`), pane() (the Endpoints & Agents tab as drawn last), reload(handlers?) (the page loaded afresh over the same localStorage) }.
 */
export async function openSettings({ handlers = [], entries = {} } = {}) {
  const server = await repoServer({ files: {}, handlers });
  const page = await openDashboard({ server, hash: "#uc", entries });
  const cookies = cookieSpy();
  // Every request the page sends from here on, with its headers and body, whichever server it goes to (the repository server's own ledger keeps a label per request, not what it carried).
  const sent = [], behind = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    sent.push({ origin: url.origin, url: url.href, method: String(init.method ?? "GET").toUpperCase(), headers: { ...init.headers }, body: typeof init.body === "string" ? init.body : null });
    return behind(input, init);
  };
  const main = richDocument().byId("main");
  let mounted = [];
  const replace = main.replaceChildren.bind(main);
  main.replaceChildren = (...children) => { mounted = children; replace(...children); };
  await page.go("#settings");
  const world = { server, page, main, cookies, sent,
    pane: () => mounted.find((node) => node.className === "settings-tab-panel" && /Endpoints & Agents/.test(node.textContent)),
    reload: (again = handlers) => openSettings({ handlers: again, entries: dump() }) };
  assert.ok(world.pane(), "known positive: the Endpoints & Agents tab is drawn");
  return world;
}
/** configure(world) — the person presses Configure a model endpoint on the Endpoints & Agents tab; the form opens in place. */
export async function configure(world) {
  const start = world.pane().querySelector("button.settings-endpoint-configure");
  assert.ok(start, "known positive: the tab offers Configure");
  await press(world.server, start);
  assert.equal(globalThis.location.hash, "#settings", "Configure stays on the Settings page");
  assert.ok(world.main.querySelector(".endpoint-name"), "Configure opens the endpoint form in place");
}
/** fill(main, fields) — the person types into the form; a field not named keeps what the form shows. */
export function fill(main, fields) {
  for (const [field, value] of Object.entries(fields)) {
    const control = main.querySelector(`.endpoint-${field}`);
    assert.ok(control, `the form has a field ${field}`);
    control.value = value;
    if (field === "bridge") control.dispatchEvent(Object.assign(new Event("change"), { scripted: true }));
  }
}
/** saveAndTest(world) -> the text the form shows as the outcome. */
export async function saveAndTest(world) {
  await press(world.server, world.main.querySelector(".endpoint-test"));
  return world.main.querySelector(".endpoint-result").textContent;
}
/** The line of the stored endpoint `name` on the Endpoints & Agents tab, or null. */
export function lineOf(world, name) {
  const lines = [];
  const walk = (node) => { if (typeof node !== "object" || !node) return; if (node.className === "settings-endpoint panel") lines.push(node); for (const child of node.children ?? []) walk(child); };
  walk(world.pane());
  return lines.find((line) => line.querySelector("h3")?.textContent.includes(name)) ?? null;
}
/** The text of everything a page node draws, with the address of every link and control it holds. */
export function everythingDrawn(root) {
  const out = [];
  const walk = (node) => { if (typeof node === "string") { out.push(node); return; } if (!node) return; for (const key of ["href", "src", "action", "value", "placeholder"]) if (typeof node[key] === "string") out.push(node[key]); for (const child of node.children ?? []) walk(child); };
  walk(root);
  return out.join("\n");
}
/** One string of everything a ledger of requests holds: addresses, headers and bodies. */
export const ledgerText = (ledger) => ledger.map((request) => `${request.url}\n${JSON.stringify(request.headers)}\n${request.body ?? ""}`).join("\n");
/** The addresses of a ledger. */
export const addressesOf = (ledger) => ledger.map((request) => request.url);

/** The origins of the repository servers the dashboard reads and writes (the instance's and its products'). */
export const REPOSITORY_ORIGINS = ["https://api.github.com", "https://raw.githubusercontent.com", "https://github.com"];
/** repositoryRequests(world) -> the requests the page sent to a repository server. */
export const repositoryRequests = (world) => world.sent.filter((request) => REPOSITORY_ORIGINS.includes(request.origin));
/** holding(requests, ...secrets) -> the requests whose address, headers or body hold one of the secrets. */
export const holding = (requests, ...secrets) => requests.filter((request) => secrets.some((secret) => ledgerText([request]).includes(secret)));
