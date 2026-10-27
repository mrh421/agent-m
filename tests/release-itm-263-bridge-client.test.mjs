// Independent release coverage for ITM-263's public Bridge client.
// Run: node --test tests/release-itm-263-bridge-client.test.mjs
//
// Module: MOD-bridge-client · MOD-bridge-http
// Level: release
// Guards: UC-003; A CREDENTIAL IS NEVER PLACED IN A URL; A REMOTE INTERFACE NAMES HOW IT FAILS; THE LOCAL BRIDGE REQUIRES A TOKEN

import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { BridgeError, bridgeAt, pair, probe } from "../src/bridge-client/index.mjs";
import { serveBridge } from "../src/bridge-http/index.mjs";

const ORIGIN = "https://akmaier.github.io";
const CONFIG = { name: "local", kind: "openai-compatible", baseUrl: "http://127.0.0.1:11434", model: "small", key: "release-endpoint-key" };

function withOrigin(t, observed = []) {
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    observed.push({ url: String(url), init });
    return original(url, { ...init, headers: { ...init.headers, Origin: ORIGIN } });
  };
  t.after(() => { globalThis.fetch = original; });
}

// Planted fault: changing `JSON.stringify({ args })` in src/bridge-client/index.mjs to `JSON.stringify(args)` makes the
// server's captured body assertion fail.
// Module (as the case stated it): MOD-bridge-client · MOD-bridge-http
// TST-263901 · level: release · module: MOD-bridge-client
// guards: UC-003; A CREDENTIAL IS NEVER PLACED IN A URL; A REMOTE INTERFACE NAMES HOW IT FAILS; THE LOCAL BRIDGE REQUIRES A TOKEN
// given: a real paired loopback Bridge exposes the protocol's pair route and a constructed endpoint-test handler
// input: pair through the public client, make a Bridge handle from those returned settings, then probe endpoint-test
// expect: pair and probe traverse the real protocol, keep token/configuration out of their addresses, send the configuration only as { args }, and preserve a provider diagnosis as the client result
test("TST-263901: public pair and endpoint-test traverse the paired loopback Bridge without URL credentials", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-release-client-"));
  const requests = [], received = [];
  const bridge = await serveBridge({ name: () => "lab-pc", host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false }, {
    jobs: { "POST /v1/probes/endpoint-test": async ({ body }) => {
      received.push(body);
      return { answer: { works: false, diagnosis: { reason: "not reachable", message: "local model stopped", routes: ["bridge"] } } };
    } },
    mail: {}, tunnels: {},
  });
  withOrigin(t, requests);
  t.after(() => bridge.close());

  const settings = await pair(bridge.address, bridge.token);
  assert.deepEqual(settings, { address: bridge.address, token: bridge.token }, "known positive: public pairing returns reusable client settings");
  const answer = await probe(bridgeAt(settings), "endpoint-test", CONFIG);
  assert.deepEqual(answer, { works: false, diagnosis: { reason: "not reachable", message: "local model stopped", routes: ["bridge"] } });
  assert.deepEqual(received, [{ args: CONFIG }], "failure node: the real protocol handler receives exactly its declared wrapper");
  assert.deepEqual(requests.map(({ url }) => new URL(url).pathname), ["/v1/pair", "/v1/probes/endpoint-test"]);
  assert.ok(requests.every(({ url }) => !url.includes(bridge.token) && !url.includes(CONFIG.key)), "pairing and endpoint credentials never enter an address");
  assert.equal(requests[1].init.headers["x-agent-m-bridge-token"], bridge.token, "the Bridge token travels only in its protocol header");
});

// Planted fault: moving `body = await answerJson(answer)` outside call's try block makes the body-timeout assertion receive
// the raw TimeoutError instead of BridgeError Timeout.
// Module (as the case stated it): MOD-bridge-client · MOD-bridge-http
// TST-263902 · level: release · module: MOD-bridge-client
// guards: UC-003; A CREDENTIAL IS NEVER PLACED IN A URL; A REMOTE INTERFACE NAMES HOW IT FAILS; THE LOCAL BRIDGE REQUIRES A TOKEN
// given: one known-positive public pair and probe have reached a real loopback Bridge
// input: the next pair request times out before fetch resolves, then the next probe response times out while its body reads
// expect: both timeout stages become the named BridgeError Timeout rather than NoAnswer or a raw DOMException
test("TST-263902: public pair and probe name both fetch and response-body timeouts", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-release-client-timeout-"));
  const bridge = await serveBridge({ name: () => "lab-pc", host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false }, {
    jobs: { "POST /v1/probes/endpoint-test": async () => ({ answer: { works: true, model: "small" } }) }, mail: {}, tunnels: {},
  });
  const originalFetch = globalThis.fetch, originalTimeout = AbortSignal.timeout;
  t.after(async () => { globalThis.fetch = originalFetch; AbortSignal.timeout = originalTimeout; await bridge.close(); });
  globalThis.fetch = (url, init = {}) => originalFetch(url, { ...init, headers: { ...init.headers, Origin: ORIGIN } });
  const settings = await pair(bridge.address, bridge.token);
  assert.deepEqual(await probe(bridgeAt(settings), "endpoint-test", CONFIG), { works: true, model: "small" }, "known positive: the real paired protocol answers before timeout injection");

  const timeout = new DOMException("The request timed out", "TimeoutError");
  AbortSignal.timeout = () => AbortSignal.abort(timeout);
  globalThis.fetch = async (_url, init) => { throw init.signal.reason; };
  await assert.rejects(() => pair(bridge.address, bridge.token), (error) => error instanceof BridgeError && error.name === "Timeout",
    "failure node: a timed-out fetch is named Timeout");

  globalThis.fetch = async () => ({ ok: true, text: async () => { throw timeout; } });
  await assert.rejects(() => probe(bridgeAt(settings), "endpoint-test", CONFIG), (error) => error instanceof BridgeError && error.name === "Timeout",
    "failure node: a timed-out response body is named Timeout");
});
