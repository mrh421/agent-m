// Module: MOD-desktop-shell
// Guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; NO SECRET IN THE REPOSITORY
// Level: unit
//
// This exercises the production compose entry. Its controlled endpoint is an in-process loopback server;
// no endpoint configuration or credential is written outside this test's temporary folder.

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import http from "node:http";
import Module from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { bridgeApi } from "../src/bridge-http/index.mjs";
import { ssh2NodePath } from "./ssh2-fixture.mjs";

const ssh2Cache = join(tmpdir(), "agent-m-291-desktop-endpoint-ssh2-1.17.0");
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

const ORIGIN = "https://shell-owner.github.io";
const KEY = "transient-shell-endpoint-key";

const listen = (server) => new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", () => resolve(server.address().port));
});
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
const request = (bridge, token, args, origin = ORIGIN) => fetch(`${bridge.address}/v1/probes/endpoint-test`, {
  method: "POST",
  headers: { Origin: origin, "content-type": "application/json", [bridgeApi.tokenHeader]: token },
  body: JSON.stringify({ args }),
});

// TST-268001 · level: unit · module: MOD-desktop-shell
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; NO SECRET IN THE REPOSITORY
// given: the production shell composition, its real paired loopback server, and a controlled local OpenAI-compatible endpoint
// input: an unpaired request, a cross-origin request, then a paired endpoint-test request through compose.mjs
// expect: pairing and origin refuse before dispatch; the paired request reaches the controlled endpoint once through jobHandlers, returns the endpoint-test result, and neither the endpoint key nor URL is retained in the pairing folder or logs
// Planted fault: leaving compose.mjs with jobs: {} makes the paired assertion fail with 404 before the controlled endpoint receives a request.
test("TST-268001: production compose registers endpoint-test with pairing, origin, loopback, and secret boundaries intact", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-268-shell-"));
  const received = [], lines = [], previousInfo = console.info;
  const endpoint = http.createServer(async (incoming, outgoing) => {
    let body = "";
    for await (const chunk of incoming) body += chunk;
    received.push({ url: incoming.url, authorization: incoming.headers.authorization, body: JSON.parse(body) });
    outgoing.writeHead(200, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
  });
  const endpointPort = await listen(endpoint);
  const bridge = await compose({ instance: "shell-owner/agent-m", origin: ORIGIN, dataFolder: folder, port: 0 });
  console.info = (...values) => lines.push(values.join(" "));
  t.after(async () => {
    console.info = previousInfo;
    await bridge.close();
    await close(endpoint);
    await rm(folder, { recursive: true, force: true });
  });

  const config = { name: "own-model-server", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${endpointPort}/v1`, model: "small", key: KEY };
  assert.match(bridge.address, /^http:\/\/127\.0\.0\.1:\d+$/, "known positive: compose starts the real server on loopback");
  assert.equal((await request(bridge, "", config)).status, 401, "a missing pairing token is refused before the endpoint handler");
  assert.equal((await request(bridge, bridge.token, config, "https://other.example")).status, 403, "a foreign origin is refused before the endpoint handler");
  assert.deepEqual(received, [], "known positive: boundary refusals make no endpoint request");

  const response = await request(bridge, bridge.token, config);
  assert.equal(response.status, 200, "the paired same-origin request reaches the registered production handler");
  assert.deepEqual(await response.json(), { answer: { works: true, model: "small", tools: false, toolMessage: "ok" } });
  assert.deepEqual(received, [{
    url: "/v1/chat/completions",
    authorization: `Bearer ${KEY}`,
    body: { model: "small", messages: [{ role: "user", content: "Call agent_m_probe once. It is a harmless capability check." }], max_tokens: 64,
      tools: [{ type: "function", function: { name: "agent_m_probe", description: "Report that tool calling works without changing anything.", parameters: { type: "object", properties: {}, additionalProperties: false } } }], stream: false },
  }], "one bridge probe makes one controlled endpoint request");
  assert.equal((await readFile(join(folder, "pairing-token"), "utf8")).includes(KEY), false, "the endpoint key is absent from retained shell data");
  assert.equal(lines.join("\n").includes(KEY), false, "the endpoint key is absent from bridge logs");
  assert.equal(lines.join("\n").includes(config.baseUrl), false, "the endpoint URL is absent from bridge logs");
});
