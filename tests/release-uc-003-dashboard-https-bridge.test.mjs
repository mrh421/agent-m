// UC-003 public-dashboard release coverage for alternative 2a through its configured UC-044 HTTPS route (ITM-266).
// Module: MOD-settings-pages -> MOD-browser-store -> MOD-bridge-client -> MOD-bridge-http -> MOD-bridge-jobs -> MOD-desktop-shell
// Level: release
// Guards: UC-003; CONFIGURATION LIVES IN THE BROWSER; CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE
// Guards: A CREDENTIAL IS NEVER PLACED IN A URL; NO SECRET IN THE REPOSITORY
//
// The browser-facing HTTPS address and forwarding proxy are controlled fixture boundaries: no certificate is provisioned
// and no browser reachability claim is made. The proxy's forwarding, Basic jump-host login, Bridge-token boundary,
// composed loopback Bridge transport, job handler, and model request are real in-process HTTP calls.

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

const ssh2Cache = join(tmpdir(), "agent-m-291-release-266-https-ssh2-1.17.0");
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

const ORIGIN = "https://akmaier.github.io", PREFIX = "agent-m:akmaier/agent-m:";
const HTTPS = "https://jump.example.test/bridge/local", LOGIN = { user: "web-user", password: "web-password" };
const nativeFetch = globalThis.fetch;
const listen = (server) => new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server.address().port)); });
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));

// TST-266002 · level: release · module: MOD-settings-pages
// guards: UC-003; CONFIGURATION LIVES IN THE BROWSER; CONFIGURATION IS STORED IN LOCALSTORAGE, NOT IN A COOKIE; A CREDENTIAL IS NEVER PLACED IN A URL; NO SECRET IN THE REPOSITORY
// given: the dashboard holds the separately configured HTTPS jump-host login and Bridge token; a controlled proxy forwards only authenticated requests to a real compose() Bridge and controlled model.
// input: Settings -> Configure saves and tests a through-Bridge local endpoint.
// expect: the dashboard uses the HTTPS address, Basic login and Bridge token as distinct headers; the proxy forwards one request and the model receives one short request, while no credential appears in the URL or repository ledger.
// Module (as the file header stated it): MOD-settings-pages -> MOD-browser-store -> MOD-bridge-client -> MOD-bridge-http -> MOD-bridge-jobs -> MOD-desktop-shell
// Planted fault: removing `...(login ? { login } : {})` from bridgeSettings in src/settings-pages/endpoints.mjs makes the
// controlled proxy returns 401 and the visible working assertion fails; byte-exact restoration restores this positive.
test("TST-266002: configured HTTPS forwarding keeps jump-host login separate from the Bridge token", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-266-release-")), received = [], forwarded = [];
  const endpoint = http.createServer(async (request, response) => {
    let body = ""; for await (const chunk of request) body += chunk;
    received.push({ path: request.url, authorization: request.headers.authorization, body: JSON.parse(body) });
    response.writeHead(200, { "content-type": "application/json" }); response.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
  });
  const port = await listen(endpoint);
  const bridge = await compose({ instance: "akmaier/agent-m", origin: ORIGIN, dataFolder: folder, port: 0 });
  t.after(async () => { await bridge.close(); await close(endpoint); await rm(folder, { recursive: true, force: true }); });
  const server = await repoServer({ files: {}, handlers: [async (url, init) => {
    if (url.href !== `${HTTPS}/v1/probes/endpoint-test`) return null;
    forwarded.push({ url: url.href, headers: init.headers });
    if (init.headers.Authorization !== `Basic ${Buffer.from(`${LOGIN.user}:${LOGIN.password}`).toString("base64")}`) {
      return new Response(JSON.stringify({ error: "login-refused" }), { status: 401, headers: { "www-authenticate": "Basic realm=jump-host" } });
    }
    return nativeFetch(`${bridge.address}/v1/probes/endpoint-test`, { ...init, headers: { ...init.headers, Origin: ORIGIN } });
  }, async (url, init) => {
    if (url.origin !== `http://127.0.0.1:${port}`) return null;
    return nativeFetch(url.href, init);
  }] });
  const entries = {
    [`${PREFIX}bridge:local`]: JSON.stringify({ port: 40100, token: bridge.token }),
    [`${PREFIX}jump-host`]: JSON.stringify({ hostname: "jump.example.test", user: "ssh-user", sshPort: 22, portRange: [40100, 40199], httpsAddress: "https://jump.example.test", login: LOGIN }),
  };
  const page = await openDashboard({ server, hash: "#uc", entries });
  const dom = richDocument(), main = dom.byId("main"); let mounted = [];
  globalThis.document.cookie = "";
  const replace = main.replaceChildren.bind(main); main.replaceChildren = (...children) => { mounted = children; replace(...children); };
  await page.go("#settings");
  const endpoints = mounted.find((node) => node.className === "settings-tab-panel" && /Endpoints & Agents/.test(node.textContent));
  const configure = endpoints?.querySelector("button.settings-endpoint-configure");
  assert.ok(configure, "known positive: public Endpoints & Agents exposes Configure");
  await press(server, configure);
  assert.equal(globalThis.location.hash, "#settings", "failure node: Settings Configure stays on the Settings page");
  assert.ok(main.querySelector(".endpoint-name"), "failure node: Settings Configure opens the endpoint form in place");
  const key = "release-local-key", endpointUrl = `http://127.0.0.1:${port}/v1`;
  main.querySelector(".endpoint-name").value = "https-local";
  main.querySelector(".endpoint-url").value = endpointUrl;
  main.querySelector(".endpoint-model").value = "release-controlled-model";
  main.querySelector(".endpoint-key").value = key;
  main.querySelector(".endpoint-bridge").value = "local";
  main.querySelector(".endpoint-bridge").dispatchEvent(new Event("change"));
  await press(server, main.querySelector(".endpoint-test"));
  assert.match(main.querySelector(".endpoint-result").textContent, /release-controlled-model is working/, "failure node: public dashboard renders the HTTPS-forwarded Bridge success");
  assert.equal(forwarded.length, 1, "the controlled forwarding fixture received exactly one dashboard request");
  assert.equal(forwarded[0].headers["x-agent-m-bridge-token"], bridge.token, "the Bridge pairing token remains its protocol header");
  assert.equal(forwarded[0].url.includes(bridge.token) || forwarded[0].url.includes(LOGIN.password) || forwarded[0].url.includes(key), false, "failure node: HTTPS request URL contains no credential");
  assert.deepEqual(received, [{ path: "/v1/chat/completions", authorization: `Bearer ${key}`, body: { model: "release-controlled-model", messages: [{ role: "user", content: "Call agent_m_probe once. It is a harmless capability check." }], max_tokens: 64, tools: [{ type: "function", function: { name: "agent_m_probe", description: "Report that tool calling works without changing anything.", parameters: { type: "object", properties: {}, additionalProperties: false } } }], stream: false } }], "the real Bridge server and job handler reach the controlled model once");
  assert.equal(server.requests.some((request) => request.includes(key) || request.includes(LOGIN.password) || request.includes(bridge.token)), false, "no credential entered the repository request ledger");
  assert.equal(globalThis.document.cookie, "", "the HTTPS configuration still writes no configuration cookie");
  assert.equal(server.writes.length, 0, "no repository write carried endpoint or forwarding credentials");
});
