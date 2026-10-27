// MOD-bridge-http — the paired loopback API for UC-003's endpoint-test (ITM-261).
// Run: node --test tests/bridge-http.test.mjs
//
// Module: MOD-bridge-http
// Guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE
// Guards: A CREDENTIAL IS NEVER PLACED IN A URL
// Level: unit

import assert from "node:assert/strict";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { bridgeApi, pairAnew, serveBridge } from "../src/bridge-http/index.mjs";

const ORIGIN = "https://akmaier.github.io";
const CONFIG = { name: "local", kind: "openai-compatible", baseUrl: "http://127.0.0.1:11434", model: "tiny", key: "key-only-in-body" };
const SUCCESS = { works: true, model: "tiny" };

async function running(t, { paused = () => false, jobs = {} } = {}) {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-bridge-http-"));
  const server = await serveBridge({ name: () => "lab-pc", host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder: folder, paused }, { jobs, mail: {}, tunnels: {} });
  t.after(() => server.close());
  return { ...server, folder };
}

async function request(server, path, { method = "POST", origin = ORIGIN, token = server.token, body } = {}) {
  return fetch(`${server.address}${path}`, {
    method,
    headers: {
      Origin: origin,
      "X-Agent-M-Bridge-Token": token,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

// TST-261001 · level: unit · module: MOD-bridge-http
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: the accepted Bridge API
// input: inspect its endpoint-test route definition
// expect: the route is POST /v1/probes/endpoint-test and defines the Bridge-owned configuration/result fields
test("TST-261001: bridgeApi defines the typed endpoint-test probe", () => {
  const probe = bridgeApi.routes.find((route) => route.method === "POST" && route.path === "/v1/probes/{kind}");
  assert.ok(probe);
  assert.deepEqual(probe.kinds, ["agent", "endpoint-models", "endpoint-test", "partitions"]);
  assert.deepEqual(probe.endpointTest.args, { name: "string", kind: ["openai-compatible", "anthropic"], baseUrl: "string", model: "string", key: ["string", "null"] });
  assert.deepEqual(probe.endpointTest.answer, { works: [true, false], model: "string", diagnosis: { reason: ["cross-origin refused", "opt-in header missing", "blocked by the browser", "not reachable", "key refused", "model unknown", "too long", "rate limited", "endpoint error"], message: "string", routes: ["ci", "bridge"] } });
  assert.deepEqual(bridgeApi.errors, { "token-refused": 401, "origin-refused": 403, "not-found": 404, "invalid-request": 422, "upstream-failed": 502, paused: 503 });
});

// TST-261010 · level: unit · module: MOD-bridge-http
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: the public module future Pages code imports for bridgeApi
// input: inspect its static dependency declarations
// expect: native browser loading has no Node import or dynamic loader; Node access starts only when operations are called
test("TST-261010: bridgeApi has a browser-loadable public entry", async () => {
  const entry = await readFile(new URL("../src/bridge-http/index.mjs", import.meta.url), "utf8");
  assert.match(entry, /^export \{ bridgeApi \} from "\.\/protocol\.mjs";/m);
  assert.doesNotMatch(entry, /node:|import\(/);
  for (const name of ["pairing.mjs", "server.mjs"]) {
    const implementation = await readFile(new URL(`../src/bridge-http/${name}`, import.meta.url), "utf8");
    assert.doesNotMatch(implementation, /^import .*node:/m);
    assert.match(implementation, /globalThis\.process\?\.getBuiltinModule/);
  }
});

// TST-261002 · level: unit · module: MOD-bridge-http
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a requested non-loopback bind address
// input: start the Bridge server
// expect: BindRefused is named and no server starts
test("TST-261002: serveBridge refuses a non-loopback bind", async () => {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-bridge-http-"));
  await assert.rejects(() => serveBridge({ name: () => "lab-pc", host: "0.0.0.0", port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false }, { jobs: {}, mail: {}, tunnels: {} }), { name: "BindRefused" });
});

// TST-261003 · level: unit · module: MOD-bridge-http
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: each accepted loopback address
// input: start the Bridge with that address
// expect: each bind succeeds and no non-loopback address is needed
test("TST-261003: serveBridge accepts every documented loopback bind", async (t) => {
  for (const host of ["127.0.0.1", "::1", "localhost"]) {
    const folder = await mkdtemp(join(tmpdir(), "agent-m-bridge-http-"));
    const bridge = await serveBridge({ host, port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false }, { jobs: {}, mail: {}, tunnels: {} });
    t.after(() => bridge.close());
    assert.ok(bridge.address);
  }
});

// TST-261011 · level: unit · module: MOD-bridge-http
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a loopback port already held by a Bridge
// input: start a second Bridge on that port
// expect: the requested socket failure is named PortInUse
test("TST-261011: serveBridge names a loopback port already in use", async (t) => {
  const first = await running(t);
  const port = Number(new URL(first.address).port);
  const folder = await mkdtemp(join(tmpdir(), "agent-m-bridge-http-"));
  await assert.rejects(() => serveBridge({ name: () => "lab-pc", host: "127.0.0.1", port, origin: ORIGIN, dataFolder: folder, paused: () => false }, { jobs: {}, mail: {}, tunnels: {} }), { name: "PortInUse" });
});

// TST-261004 · level: unit · module: MOD-bridge-http
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a new Bridge data folder and a running paired Bridge
// input: pairAnew rotates its persisted token
// expect: the old token is refused and the current token is accepted
test("TST-261004: pairAnew persists and rotates the token", async (t) => {
  const bridge = await running(t);
  const old = bridge.token;
  const next = await pairAnew(bridge.folder, "rotated-token");
  assert.equal(next, "rotated-token");
  assert.equal(await readFile(join(bridge.folder, "pairing-token"), "utf8"), "rotated-token");
  assert.equal((await stat(join(bridge.folder, "pairing-token"))).mode & 0o777, 0o600);
  assert.equal((await request(bridge, "/v1/pair", { method: "GET", token: old })).status, 401);
  const current = await request(bridge, "/v1/pair", { method: "GET", token: next });
  assert.equal(current.status, 200);
});

// TST-261005 · level: unit · module: MOD-bridge-http
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a Bridge restarted with its existing data folder
// input: use its persisted pairing token after restart
// expect: the token still pairs the person and remains in the user-only data folder
test("TST-261005: a restarted Bridge keeps its pairing token", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-bridge-http-"));
  const first = await serveBridge({ name: () => "lab-pc", host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false }, { jobs: {}, mail: {}, tunnels: {} });
  const token = first.token;
  await first.close();
  const second = await serveBridge({ name: () => "lab-pc", host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false }, { jobs: {}, mail: {}, tunnels: {} });
  t.after(() => second.close());
  assert.equal(second.token, token);
  assert.equal((await request(second, "/v1/pair", { method: "GET" })).status, 200);
});

// TST-261006 · level: unit · module: MOD-bridge-http
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a paired Bridge and an endpoint-test handler
// input: a preflight and a request from the paired instance origin
// expect: both are allowed and the request body reaches the supplied handler once
test("TST-261006: serveBridge allows the paired origin and dispatches endpoint-test", async (t) => {
  const seen = [];
  const bridge = await running(t, { jobs: { "POST /v1/probes/endpoint-test": async ({ body }) => { seen.push(body.args); return { answer: SUCCESS }; } } });
  const preflight = await fetch(`${bridge.address}/v1/probes/endpoint-test`, { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,x-agent-m-bridge-token", "Access-Control-Request-Private-Network": "true" } });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), ORIGIN);
  assert.match(preflight.headers.get("access-control-allow-headers"), /x-agent-m-bridge-token/i);
  assert.equal(preflight.headers.get("access-control-allow-private-network"), "true");
  const ordinaryPreflight = await fetch(`${bridge.address}/v1/probes/endpoint-test`, { method: "OPTIONS", headers: { Origin: ORIGIN, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type,x-agent-m-bridge-token" } });
  assert.equal(ordinaryPreflight.status, 204);
  assert.equal(ordinaryPreflight.headers.get("access-control-allow-private-network"), null);
  const response = await request(bridge, "/v1/probes/endpoint-test", { body: { args: CONFIG } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { answer: SUCCESS });
  assert.deepEqual(seen, [CONFIG]);
});

// TST-261007 · level: unit · module: MOD-bridge-http
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a paired Bridge
// input: an origin other than the paired instance, a missing token, and an invalid endpoint-test body
// expect: each is refused with its named status before any handler invocation
test("TST-261007: serveBridge names origin, token and body refusals", async (t) => {
  let calls = 0;
  const bridge = await running(t, { jobs: { "POST /v1/probes/endpoint-test": async () => { calls += 1; return { answer: SUCCESS }; } } });
  assert.equal((await request(bridge, "/v1/probes/endpoint-test", { origin: "https://other.example", body: { args: CONFIG } })).status, 403);
  const refusedPreflight = await fetch(`${bridge.address}/v1/probes/endpoint-test`, { method: "OPTIONS", headers: { Origin: "https://other.example", "Access-Control-Request-Method": "POST" } });
  assert.equal(refusedPreflight.status, 403);
  assert.equal((await request(bridge, "/v1/probes/endpoint-test", { token: "", body: { args: CONFIG } })).status, 401);
  assert.equal((await request(bridge, "/v1/probes/endpoint-test", { body: { args: { ...CONFIG, key: 7 } } })).status, 422);
  assert.equal(calls, 0);
});

// TST-261008 · level: unit · module: MOD-bridge-http
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a paused Bridge, a handler that raises an accepted named error, and one that raises a non-protocol failure
// input: endpoint-test requests
// expect: pause is 503, the named handler error keeps its status, and the generic failure is upstream-failed
test("TST-261008: serveBridge names pause and handler failures", async (t) => {
  const paused = await running(t, { paused: () => true, jobs: { "POST /v1/probes/endpoint-test": async () => ({ answer: SUCCESS }) } });
  assert.equal((await request(paused, "/v1/probes/endpoint-test", { body: { args: CONFIG } })).status, 503);
  const named = await running(t, { jobs: { "POST /v1/probes/endpoint-test": async () => { const refusal = new Error("configuration refused"); refusal.code = "invalid-request"; throw refusal; } } });
  const namedResponse = await request(named, "/v1/probes/endpoint-test", { body: { args: CONFIG } });
  assert.equal(namedResponse.status, 422);
  assert.deepEqual(await namedResponse.json(), { error: "invalid-request", message: "configuration refused" });
  const inherited = await running(t, { jobs: { "POST /v1/probes/endpoint-test": async () => { const refusal = new Error("non-protocol code"); refusal.code = "toString"; throw refusal; } } });
  const inheritedResponse = await request(inherited, "/v1/probes/endpoint-test", { body: { args: CONFIG } });
  assert.equal(inheritedResponse.status, 502);
  assert.deepEqual(await inheritedResponse.json(), { error: "upstream-failed", message: "non-protocol code" });
  const failed = await running(t, { jobs: { "POST /v1/probes/endpoint-test": async () => { throw new Error("local endpoint offline"); } } });
  const response = await request(failed, "/v1/probes/endpoint-test", { body: { args: CONFIG } });
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "upstream-failed", message: "local endpoint offline" });
});

// TST-261009 · level: unit · module: MOD-bridge-http
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a paired Bridge whose request logger is captured
// input: endpoint-test carries an endpoint key and pairing token
// expect: the log contains method, path, status and duration but neither secret nor body data
test("TST-261009: request logs exclude endpoint-test secrets", async (t) => {
  const lines = [], old = console.info;
  console.info = (...values) => lines.push(values.join(" "));
  t.after(() => { console.info = old; });
  const bridge = await running(t, { jobs: { "POST /v1/probes/endpoint-test": async () => ({ answer: SUCCESS }) } });
  await request(bridge, "/v1/probes/endpoint-test", { body: { args: CONFIG } });
  assert.match(lines.join("\n"), /POST.*\/v1\/probes\/endpoint-test.*200/);
  assert.equal(lines.join("\n").includes(CONFIG.key), false);
  assert.equal(lines.join("\n").includes(bridge.token), false);
});

// TST-960201 · level: unit · module: MOD-bridge-http
// guards: UC-040; THE LOCAL BRIDGE REQUIRES A TOKEN
// given: a paired Bridge whose handlers answer the probes endpoint-models and partitions
// input: each probe without the token, with an empty token, and with the paired token
// expect: 401 without and with an empty token, and neither handler runs; with the token each handler runs once and its answer is returned as { answer }
test("TST-960201: the probes endpoint-models and partitions are refused without the Bridge's token and answered with it", async (t) => {
  let models = 0, partitions = 0;
  const bridge = await running(t, { jobs: {
    "POST /v1/probes/endpoint-models": async () => { models += 1; return { answer: { models: ["served-a"] } }; },
    "POST /v1/probes/partitions": async () => { partitions += 1; return { answer: { partitions: [{ name: "debug", state: "up" }] } }; },
  } });
  for (const [kind, body] of [["endpoint-models", { args: CONFIG }], ["partitions", { args: {} }]]) {
    assert.equal((await request(bridge, `/v1/probes/${kind}`, { token: "", body })).status, 401, `${kind}: empty token`);
    assert.equal((await fetch(`${bridge.address}/v1/probes/${kind}`, { method: "POST", headers: { Origin: ORIGIN, "Content-Type": "application/json" }, body: JSON.stringify(body) })).status, 401, `${kind}: no token`);
  }
  assert.deepEqual([models, partitions], [0, 0]);
  const listed = await request(bridge, "/v1/probes/endpoint-models", { body: { args: CONFIG } });
  assert.deepEqual(await listed.json(), { answer: { models: ["served-a"] } });
  const parted = await request(bridge, "/v1/probes/partitions", { body: { args: {} } });
  assert.deepEqual(await parted.json(), { answer: { partitions: [{ name: "debug", state: "up" }] } });
  assert.deepEqual([models, partitions], [1, 1]);
});
