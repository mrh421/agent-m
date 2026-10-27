// MOD-bridge-http — the pair answer names the Bridge and its release (ITM-1244): serveBridge's config carries `name: () => string` and
// `version: string | null`, and `GET /v1/pair` answers with name() at the time of the request, with version, and with the platform it runs on.
// Run: node --test tests/bridge-http-pair-answer-1244.test.mjs
//
// Module: MOD-bridge-http
// Guards: UC-044; UC-011; THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
// Level: unit
//
// Each case starts the real server on 127.0.0.1 at a free port (port 0) with a temporary data folder, and closes it at the end.

import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { bridgeApi, serveBridge } from "../src/bridge-http/index.mjs";

const ORIGIN = "https://akmaier.github.io";

async function running(t, { name, version }) {
  const dataFolder = await mkdtemp(join(tmpdir(), "agent-m-bridge-http-1244-"));
  const server = await serveBridge({ host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder, paused: () => false, name, version }, { jobs: {}, mail: {}, tunnels: {} });
  t.after(() => server.close());
  return server;
}

const pairAnswer = async (server) => {
  const answer = await fetch(`${server.address}/v1/pair`, { headers: { Origin: ORIGIN, "X-Agent-M-Bridge-Token": server.token } });
  assert.equal(answer.status, 200, "known positive: the pairing route answers the origin with the token in force");
  return answer.json();
};

// TST-1244101 · level: unit · module: MOD-bridge-http
// guards: UC-044; THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
// given: a Bridge server started with name () => "lab-pc" and version "2026.10.0"
// input: GET /v1/pair from the origin with the token in force
// expect: the answer is { bridge: { name: "lab-pc", version: "2026.10.0", platform: process.platform }, origin: the origin }
// Planted fault: answering the fixed name "Bridge" and version "unreleased" makes the deepEqual fail on name and version.
test("TST-1244101: GET /v1/pair answers with the name and the version the server was given, and its platform", async (t) => {
  const server = await running(t, { name: () => "lab-pc", version: "2026.10.0" });
  assert.deepEqual(await pairAnswer(server), { bridge: { name: "lab-pc", version: "2026.10.0", platform: process.platform }, origin: ORIGIN });
});

// TST-1244102 · level: unit · module: MOD-bridge-http
// guards: UC-044; THE BRIDGE IS CONFIGURED IN ITS WINDOW OR FROM AN EXPORT
// given: a Bridge server started with a name function that returns "lab-pc", then, after the first request, "gpu-box"
// input: GET /v1/pair; the name changed; GET /v1/pair again
// expect: the first answer's bridge.name is "lab-pc", the second's "gpu-box"
// Planted fault: reading name() once at the start, and answering that value, makes the second answer "lab-pc" and fails.
test("TST-1244102: GET /v1/pair answers with name() at the time of the request", async (t) => {
  let current = "lab-pc";
  const server = await running(t, { name: () => current, version: "2026.10.0" });
  assert.equal((await pairAnswer(server)).bridge.name, "lab-pc");
  current = "gpu-box";
  assert.equal((await pairAnswer(server)).bridge.name, "gpu-box", "failure node: the name in force at the second request");
});

// TST-1244103 · level: unit · module: MOD-bridge-http
// guards: UC-044; UC-011
// given: a Bridge server started with name () => "lab-pc" and version null, a start that names no release
// input: GET /v1/pair from the origin with the token in force
// expect: the answer's bridge carries the key version with the value null, beside name "lab-pc" and the platform
// Planted fault: answering "unreleased" for a start without a version makes the deepEqual fail on version.
test("TST-1244103: a start that names no release answers version null", async (t) => {
  const server = await running(t, { name: () => "lab-pc", version: null });
  const { bridge } = await pairAnswer(server);
  assert.ok(Object.hasOwn(bridge, "version"), "the answer names the version, null included");
  assert.deepEqual(bridge, { name: "lab-pc", version: null, platform: process.platform });
});

// TST-1244104 · level: unit · module: MOD-bridge-http
// guards: UC-044; UC-011
// given: the protocol as data, bridgeApi
// input: the answer of its route GET /v1/pair
// expect: the answer's bridge is { name: "string", version: ["string", "null"], platform: "string" } — a version of text or null, written as the protocol writes the endpoint key's
// Planted fault: typing the version "string" alone makes the deepEqual fail.
test("TST-1244104: the protocol's pair answer allows a null version", () => {
  const route = bridgeApi.routes.find((candidate) => candidate.method === "GET" && candidate.path === "/v1/pair");
  assert.ok(route, "known positive: bridgeApi defines GET /v1/pair");
  assert.deepEqual(route.answer.bridge, { name: "string", version: ["string", "null"], platform: "string" });
});
