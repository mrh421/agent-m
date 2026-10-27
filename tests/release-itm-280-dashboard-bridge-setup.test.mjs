// Independent release coverage for ITM-280's public dashboard Bridge setup.
// Run: node --test tests/release-itm-280-dashboard-bridge-setup.test.mjs
//
// Module: MOD-settings-pages · MOD-browser-store · MOD-bridge-client · MOD-bridge-http
// Level: release
// Guards: UC-003; UC-044; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A STORED SECRET IS HIDDEN UNTIL SHOWN
// Guards: A CLEAR IS A REAL CLEAR

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
// app-harness replaces global fetch for every dashboard. Keep Node's fetch before the first load, so each
// independently created repoServer handler reaches its own controlled loopback Bridge.
const publicControl = (root, className) => {
  for (const child of root?.children ?? []) {
    if (typeof child !== "object") continue;
    if (child.className?.split(" ").includes(className)) return child;
    const found = publicControl(child, className);
    if (found) return found;
  }
  return null;
};

const nativeFetch = globalThis.fetch;

async function dashboardAtBridge(t) {
  // Capture native fetch before the dashboard replaces global fetch. The repository handler forwards only the
  // controlled loopback Bridge request and supplies the same Pages-origin context as bridge-http's HTTP tests.
  const folder = await mkdtemp(join(tmpdir(), "agent-m-280-release-"));
  const bridge = await serveBridge({ name: () => "lab-pc", host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false }, { jobs: {}, mail: {}, tunnels: {} });
  const calls = [];
  const server = await repoServer({ files: {}, handlers: [async (url, init) => {
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/v1/pair") return null;
    calls.push({ url: url.href, init });
    return nativeFetch(url.href, { ...init, headers: { ...init.headers, Origin: ORIGIN } });
  }] });
  t.after(async () => bridge.close());
  const page = await openDashboard({ server, hash: "#settings" });
  const dom = richDocument();
  const main = dom.byId("main");
  let mounted = [];
  const replace = main.replaceChildren.bind(main);
  main.replaceChildren = (...children) => { mounted = children; replace(...children); };
  await page.go("#settings");
  const endpoints = mounted.find((node) => node.className === "settings-tab-panel" && /Endpoints & Agents/.test(node.textContent));
  const configure = publicControl(endpoints, "settings-bridge-configure");
  assert.ok(configure, "known positive: empty Settings exposes the actual Configure control");
  await configure.fire("click");
  await page.go("#bridge");
  return { bridge, calls, dom, main, page, server, mounted: () => mounted.find((node) => node.className === "settings-tab-panel" && /Endpoints & Agents/.test(node.textContent)) };
}

// Planted fault: replacing writeSetting(context.store, "bridge", settings) in src/settings-pages/bridge.mjs with a
// no-op makes the post-pair raw-storage assertion fail; restoring it returns this case to green.
// Module (as the case stated it): MOD-settings-pages · MOD-browser-store · MOD-bridge-client · MOD-bridge-http
// TST-280901 · level: release · module: MOD-settings-pages
// guards: UC-003; UC-044; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR
// given: the relevant canonical browser settings are empty and a real controlled loopback Bridge is paired to the dashboard's Pages origin
// input: Settings → Configure the Agent M Bridge → Pair Bridge with the copied token, reload, use Change, then Clear
// expect: the public Route calls the real /v1/pair API once, persists only the returned address/token, reloads it hidden, Change returns to the route, and Clear removes the raw localStorage record
test("TST-280901: public Settings pairs a real Bridge, reloads through Change, and clears raw browser storage", async (t) => {
  const { bridge, calls, main, page, server, mounted } = await dashboardAtBridge(t);
  assert.equal(globalThis.localStorage.getItem(key("bridge")), null, "precondition: no Bridge setting was seeded");
  const address = main.querySelector(".bridge-address"), token = main.querySelector(".bridge-token");
  assert.ok(address && token, "failure node: #bridge dispatches to MOD-settings-pages' public route");
  address.value = bridge.address;
  token.value = bridge.token;
  await press(server, main.querySelector(".bridge-pair"));
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(key("bridge"))), { address: bridge.address, token: bridge.token }, "failure node: pair success reaches MOD-browser-store's canonical Bridge key");
  assert.deepEqual(calls.map(({ url }) => new URL(url).pathname), ["/v1/pair"], "the public dashboard used the real controlled Bridge pairing API once");
  assert.ok(server.requests.some((request) => request.startsWith("handler GET http://127.0.0.1:")), "known positive: repoServer records the controlled real Bridge request");
  assert.equal(calls[0].url.includes(bridge.token), false, "the copied token never enters the request address");

  await page.go("#bridge");
  assert.equal(main.querySelector(".bridge-address").value, bridge.address, "reload reads the paired address from canonical browser storage");
  assert.equal(main.querySelector(".bridge-token").type, "password", "reload keeps the pairing token hidden");
  await press(server, main.querySelector(".bridge-show"));
  assert.equal(main.querySelector(".bridge-token").type, "text", "Show reveals the stored token only after the person's action");

  await page.go("#settings");
  const change = publicControl(mounted(), "settings-bridge-change");
  assert.ok(change, "known positive: Settings exposes Change for the stored Bridge");
  await change.fire("click");
  await page.go("#bridge");
  await press(server, main.querySelector(".bridge-clear"));
  assert.equal(globalThis.localStorage.getItem(key("bridge")), null, "failure node: Clear removes the actual browser storage entry");
});

// Planted fault: omitting the HTTPS save's writeSetting("bridge", ...) makes the separate Bridge-storage assertion fail;
// restoring that exact write returns the positive result.
// Module (as the case stated it): MOD-settings-pages · MOD-browser-store · MOD-bridge-client · MOD-bridge-http
// TST-280902 · level: release · module: MOD-settings-pages
// guards: UC-003; UC-044; CONFIGURATION LIVES IN THE BROWSER; EVERY SETTING IS REACHED FROM ONE PAGE; A STORED SECRET IS HIDDEN UNTIL SHOWN; A CLEAR IS A REAL CLEAR
// given: the public Bridge route starts with empty relevant storage; its real controlled Bridge rejects a wrong token
// input: Pair a refused token, then an unreadable address; separately save the trusted HTTPS address and nested login
// expect: neither failure stores a fake success; HTTPS save makes no request, remains untested, keeps login under jump-host and the copied Bridge token under bridge, reloads hidden, and Settings Change/Clear reaches/removes jump-host
test("TST-280902: failures do not pair, while configured HTTPS storage stays separate and untested", async (t) => {
  const { bridge, calls, main, page, server, mounted } = await dashboardAtBridge(t);
  main.querySelector(".bridge-address").value = bridge.address;
  main.querySelector(".bridge-token").value = "wrong-token";
  await press(server, main.querySelector(".bridge-pair"));
  assert.match(main.querySelector(".bridge-result").textContent, /refused/i);
  assert.equal(globalThis.localStorage.getItem(key("bridge")), null, "a refused token does not create a successful pairing");
  main.querySelector(".bridge-address").value = "http://127.0.0.1:1";
  main.querySelector(".bridge-token").value = "copied-token";
  await press(server, main.querySelector(".bridge-pair"));
  assert.match(main.querySelector(".bridge-result").textContent, /gave no answer/i);
  assert.equal(globalThis.localStorage.getItem(key("bridge")), null, "an unreadable Bridge does not create a successful pairing");

  main.querySelector(".jump-host-name").value = "jump.example.test";
  main.querySelector(".jump-host-user").value = "alice";
  main.querySelector(".jump-host-https-address").value = "https://jump.example.test/bridge/demo";
  main.querySelector(".jump-host-bridge-token").value = "https-copied-token";
  main.querySelector(".jump-host-login-user").value = "web-user";
  main.querySelector(".jump-host-login-password").value = "web-password";
  const requestsBeforeSave = server.requests.length;
  await press(server, main.querySelector(".jump-host-save"));
  assert.match(main.querySelector(".jump-host-result").textContent, /remains untested/i, "HTTPS saving is explicitly untested");
  assert.deepEqual(server.requests.slice(requestsBeforeSave), [], "saving configured HTTPS access makes no hidden request, including to its configured HTTPS address");
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(key("jump-host"))), { hostname: "jump.example.test", user: "alice", sshPort: 22, portRange: [40100, 40199], httpsAddress: "https://jump.example.test/bridge/demo", login: { user: "web-user", password: "web-password" } });
  assert.deepEqual(JSON.parse(globalThis.localStorage.getItem(key("bridge"))), { address: "https://jump.example.test/bridge/demo", token: "https-copied-token" }, "the Bridge address/token are separate from the jump-host login");

  await page.go("#bridge");
  assert.equal(main.querySelector(".jump-host-bridge-token").type, "password", "reloaded HTTPS token is hidden");
  await press(server, main.querySelector(".jump-host-bridge-show"));
  assert.equal(main.querySelector(".jump-host-bridge-token").type, "text");
  await page.go("#settings");
  const change = publicControl(mounted(), "settings-jump-host-change");
  assert.ok(change, "Settings names the jump-host configuration before action");
  await change.fire("click");
  await page.go("#bridge");
  await page.go("#settings");
  const clear = publicControl(mounted(), "settings-jump-host-clear");
  assert.ok(clear, "Settings exposes jump-host Clear");
  await clear.fire("click");
  assert.equal(globalThis.localStorage.getItem(key("jump-host")), null, "failure node: jump-host Clear removes the login-bearing raw entry");
});
