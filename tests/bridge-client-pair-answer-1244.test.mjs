// MOD-bridge-client — the client reads the pair answer that names the Bridge and its release (ITM-1244): testBridge's `version` is
// `string | null`, and pair() returns the name the Bridge reports with the settings to store under it.
// Run: node --test tests/bridge-client-pair-answer-1244.test.mjs
//
// Module: MOD-bridge-client
// Guards: UC-044; UC-011; THE BRIDGE IS PAIRED ONCE
// Level: unit
//
// fetch is a stand-in that answers the Bridge's routes with constructed answers and records the paths asked; no request leaves the process.

import assert from "node:assert/strict";
import test from "node:test";
import { bridgeAt, pair, testBridge } from "../src/bridge-client/index.mjs";

const ORIGIN = "https://akmaier.github.io";
const ADDRESS = "http://127.0.0.1:4711";
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

function withBridge(t, pairAnswer) {
  const prior = globalThis.fetch, asked = [];
  globalThis.fetch = async (url) => {
    const path = new URL(url).pathname;
    asked.push(path);
    if (path === "/v1/pair") return json(pairAnswer);
    if (path === "/v1/agents") return json({ agents: [{ name: "claude", version: "2.1.0", ready: true, loggedIn: true }], missing: [] });
    return new Response(JSON.stringify({ error: "not-found", message: "no such route" }), { status: 404 });
  };
  t.after(() => { globalThis.fetch = prior; });
  return asked;
}

// TST-1244108 · level: unit · module: MOD-bridge-client
// guards: UC-044; UC-011
// given: a Bridge whose pair answer is { bridge: { name: "lab-pc", version: null, platform: "darwin" }, origin } — a start that names no release — and whose agents answer lists claude
// input: testBridge(bridgeAt({ name: "lab-pc", address, token }))
// expect: it resolves, and its bridge is { name: "lab-pc", version: null, platform: "darwin" } with the origin and the agents; it asked /v1/pair then /v1/agents
// Planted fault: refusing a pair answer whose version is not text, or putting a text in place of null, makes testBridge reject or the deepEqual fail.
test("TST-1244108: testBridge accepts a pair answer whose version is null", async (t) => {
  const asked = withBridge(t, { bridge: { name: "lab-pc", version: null, platform: "darwin" }, origin: ORIGIN });
  const result = await testBridge(bridgeAt({ name: "lab-pc", address: ADDRESS, token: "lab-token" }));
  assert.deepEqual(result, {
    bridge: { name: "lab-pc", version: null, platform: "darwin" }, origin: ORIGIN,
    agents: [{ name: "claude", version: "2.1.0", ready: true, loggedIn: true }], missing: [],
  });
  assert.deepEqual(asked, ["/v1/pair", "/v1/agents"]);
});

// TST-1244109 · level: unit · module: MOD-bridge-client
// guards: UC-044; UC-011; THE BRIDGE IS PAIRED ONCE
// given: a Bridge whose pair answer names it "Andreas-iMac-7.fritz.box", release 2026.10.0
// input: pair(address, token)
// expect: its name is "Andreas-iMac-7.fritz.box", and the settings to store under it are { name: "Andreas-iMac-7.fritz.box", address, token }
// Planted fault: storing the Bridge under a fixed name, or under the address, makes both assertions fail.
test("TST-1244109: pair() stores the Bridge under the name it reports", async (t) => {
  withBridge(t, { bridge: { name: "Andreas-iMac-7.fritz.box", version: "2026.10.0", platform: "darwin" }, origin: ORIGIN });
  const paired = await pair(ADDRESS, "lab-token");
  assert.equal(paired.name, "Andreas-iMac-7.fritz.box");
  assert.deepEqual(paired.settings, { name: "Andreas-iMac-7.fritz.box", address: ADDRESS, token: "lab-token" });
});
