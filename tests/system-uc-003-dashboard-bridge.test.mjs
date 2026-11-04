// UC-003 public-dashboard system coverage for alternative 2a (ITM-266).
// Module: MOD-settings-pages -> MOD-browser-store -> MOD-bridge-client -> MOD-bridge-http -> MOD-bridge-jobs -> MOD-desktop-shell
// Level: system
// Guards: UC-003; CONFIGURATION LIVES IN THE BROWSER; CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE
// Guards: A CREDENTIAL IS NEVER PLACED IN A URL; NO SECRET IN THE REPOSITORY
//
// The model is a controlled loopback HTTP server. compose(), serveBridge(), jobHandlers(), and the dashboard are real.
// No Electron process, paid endpoint, TLS endpoint, or tunnel is launched by this test.

import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import Module from "node:module";
import test from "node:test";
import { openDashboard, press, repoServer, richDocument } from "./app-harness.mjs";
import { ssh2NodePath } from "./ssh2-fixture.mjs";

const ssh2Cache = join(tmpdir(), "agent-m-291-system-266-ssh2-1.17.0");
let sshRuntimeFailure;
function sshRuntime() {
  if (sshRuntimeFailure) throw sshRuntimeFailure;
  try {
    return ssh2NodePath(ssh2Cache);
  } catch (failure) { sshRuntimeFailure = failure; throw failure; }
}
process.env.NODE_PATH = sshRuntime();
Module._initPaths();
// The Bridge is a program of its own (MOD-desktop-shell), the dashboard another: each registers its strategies with the job runner once
// (MOD-job-runner's registry, "for the life of the program"). The real composed Bridge therefore runs in a child process of its own, as it does
// beside a browser, and answers here with its address and token; closing it ends that process. Nothing else of the Bridge is replaced.
const COMPOSE_URL = new URL("../src/desktop-shell/compose.mjs", import.meta.url).href;
const BRIDGE_PROGRAM = `
const { compose } = await import(process.env.AGENT_M_COMPOSE_URL);
const bridge = await compose(JSON.parse(process.env.AGENT_M_COMPOSE_OPTIONS));
process.stdout.write(JSON.stringify({ address: bridge.address, token: bridge.token }) + "\\n");
process.stdin.resume();
process.stdin.on("end", async () => { await bridge.close(); process.exit(0); });`;
async function compose(options) {
  const child = spawn(process.execPath, ["--input-type=module", "-e", BRIDGE_PROGRAM], { stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, AGENT_M_COMPOSE_URL: COMPOSE_URL, AGENT_M_COMPOSE_OPTIONS: JSON.stringify(options) } });
  const started = await new Promise((resolve, reject) => {
    let out = "";
    child.stdout.on("data", (chunk) => { out += chunk; if (out.includes("\n")) resolve(JSON.parse(out.slice(0, out.indexOf("\n")))); });
    child.once("exit", (code) => reject(new Error(`the composed Bridge ended with ${code} before it answered`)));
  });
  return { ...started, close: () => new Promise((resolve) => { child.once("exit", () => resolve()); child.stdin.end(); }) };
}

const ORIGIN = "https://akmaier.github.io";
const PREFIX = "agent-m:akmaier/agent-m:";
const nativeFetch = globalThis.fetch;
const listen = (server) => new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server.address().port)); });
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

async function dashboardFor(t, bridge, endpointOrigin) {
  const server = await repoServer({ files: {}, handlers: [async (url, init) => {
    if (url.origin !== bridge.address || url.pathname !== "/v1/probes/endpoint-test") return null;
    return nativeFetch(url.href, { ...init, headers: { ...init.headers, Origin: ORIGIN } });
  }, async (url, init) => {
    if (url.origin !== endpointOrigin) return null;
    return nativeFetch(url.href, init);
  }] });
  const page = await openDashboard({ server, hash: "#uc", entries: { [`${PREFIX}bridge:local`]: JSON.stringify({ address: bridge.address, token: bridge.token }) } });
  const dom = richDocument(), main = dom.byId("main"); let mounted = [];
  const replace = main.replaceChildren.bind(main); main.replaceChildren = (...children) => { mounted = children; replace(...children); };
  await page.go("#settings");
  const pane = mounted.find((node) => node.className === "settings-tab-panel" && /Endpoints & Agents/.test(node.textContent));
  const configure = pane?.querySelector("button.settings-endpoint-configure");
  assert.ok(configure, "known positive: public Endpoints & Agents mounts Configure");
  await press(server, configure);
  assert.equal(globalThis.location.hash, "#settings", "failure node: Settings Configure stays on the Settings page");
  assert.ok(main.querySelector(".endpoint-name"), "failure node: Settings Configure opens the endpoint form in place");
  return { server, page, main };
}

// TST-266001 · level: system · module: MOD-settings-pages
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER; CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE; A CREDENTIAL IS NEVER PLACED IN A URL; NO SECRET IN THE REPOSITORY
// given: a dashboard browser has a paired real composed Bridge and a controlled own-model server.
// input: Settings -> Configure, enter a local OpenAI-compatible model, select Bridge, and Save and test.
// expect: the canonical browser record is saved before one Bridge probe; compose's real HTTP server dispatches through jobHandlers to the controlled model, which receives the short request exactly once; all credentials stay out of URLs and repository writes.
// Module (as the file header stated it): MOD-settings-pages -> MOD-browser-store -> MOD-bridge-client -> MOD-bridge-http -> MOD-bridge-jobs -> MOD-desktop-shell
// Planted fault: replacing `jobHandlers()` with `{}` in src/desktop-shell/compose.mjs makes the visible working assertion fail
// with "Bridge could not test"; restoring source blob 04986a73ed6e23112d0db46668874d39e858eb2f restores this positive.
test("TST-266001: public Settings sends a local model test through the real composed Bridge", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-266-system-"));
  const received = [];
  let expectedStored;
  const endpoint = http.createServer(async (request, response) => {
    let body = ""; for await (const chunk of request) body += chunk;
    assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(`${PREFIX}endpoint:local`)), expectedStored, "failure node: canonical browser storage exists before the Bridge's model request");
    received.push({ path: request.url, authorization: request.headers.authorization, body: JSON.parse(body) });
    response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
  });
  const port = await listen(endpoint);
  const bridge = await compose({ instance: "akmaier/agent-m", origin: ORIGIN, dataFolder: folder, port: 0 });
  t.after(async () => { await bridge.close(); await close(endpoint); await rm(folder, { recursive: true, force: true }); });
  const { server, main } = await dashboardFor(t, bridge, `http://127.0.0.1:${port}`);
  const endpointUrl = `http://127.0.0.1:${port}/v1`, key = "system-local-key";
  globalThis.document.cookie = "";
  main.querySelector(".endpoint-name").value = "local";
  main.querySelector(".endpoint-url").value = endpointUrl;
  main.querySelector(".endpoint-model").value = "controlled-model";
  main.querySelector(".endpoint-key").value = key;
  main.querySelector(".endpoint-bridge").value = "local";
  main.querySelector(".endpoint-bridge").dispatchEvent(new Event("change"));
  expectedStored = { url: endpointUrl, kind: "openai-compatible", model: "controlled-model", key, bridge: "local" };
  await press(server, main.querySelector(".endpoint-test"));
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(`${PREFIX}endpoint:local`)), expectedStored, "the saved record persists after the completed request");
  assert.match(main.querySelector(".endpoint-result").textContent, /controlled-model is working/, "failure node: public dashboard renders the composed Bridge answer");
  assert.deepEqual(received, [{ path: "/v1/chat/completions", authorization: `Bearer ${key}`, body: { model: "controlled-model", messages: [{ role: "user", content: "Call agent_m_probe once. It is a harmless capability check." }], max_tokens: 64,
    tools: [{ type: "function", function: { name: "agent_m_probe", description: "Report that tool calling works without changing anything.", parameters: { type: "object", properties: {}, additionalProperties: false } } }], stream: false } }], "failure node: real jobHandlers made exactly one short controlled-model request");
  assert.equal(server.requests.some((request) => request.includes(key)), false, "the dashboard request ledger contains no endpoint credential");
  assert.equal(bridge.address.includes(key), false, "the Bridge address contains no credential");
  assert.equal(globalThis.document.cookie, "", "endpoint configuration did not create a cookie");
  assert.equal(server.writes.length, 0, "the system flow made no repository write");
});
