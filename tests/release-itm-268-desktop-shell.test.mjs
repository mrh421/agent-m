// Independent release coverage for ITM-268's delivered shell composition.
// Module: MOD-desktop-shell
// Level: release
// Guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; NO SECRET IN THE REPOSITORY
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

const ssh2Cache = join(tmpdir(), "agent-m-291-release-268-ssh2-1.17.0");
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

const ORIGIN = "https://release-shell-owner.github.io";
const KEY = "transient-release-endpoint-key";
const listen = (server) => new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", () => resolve(server.address().port)); });
const close = (server) => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
const request = (bridge, token, args, origin = ORIGIN) => fetch(`${bridge.address}/v1/probes/endpoint-test`, { method: "POST", headers: { Origin: origin, "content-type": "application/json", [bridgeApi.tokenHeader]: token }, body: JSON.stringify({ args }) });

// Planted fault: temporarily replacing `jobHandlers()` with `{}` in src/desktop-shell/compose.mjs makes the paired
// 200/one-arrival guard fail with 404; byte-exact restoration makes this positive pass.
// TST-268901 · level: release · module: MOD-desktop-shell
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; NO SECRET IN THE REPOSITORY
// given: production compose.mjs and the real public loopback server start with an empty private folder; a controlled own-model endpoint accepts one OpenAI-compatible short request
// input: send an unpaired probe, a cross-origin probe, then one paired configured-origin endpoint-test probe
// expect: both boundary refusals arrive before dispatch; the paired request reaches jobHandlers and the endpoint once, unwraps its answer, and its key/base URL are absent from private retained data and bridge logs
test("TST-268901: real public compose pairs before dispatch and unwraps one controlled endpoint answer", async (t) => {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-release-268-"));
  const received = [], lines = [], previousInfo = console.info;
  const endpoint = http.createServer(async (incoming, outgoing) => {
    let body = ""; for await (const chunk of incoming) body += chunk;
    received.push({ url: incoming.url, authorization: incoming.headers.authorization, body: JSON.parse(body) });
    outgoing.writeHead(200, { "content-type": "application/json" });
    outgoing.end(JSON.stringify({ choices: [{ message: { content: "ok" } }] }));
  });
  const endpointPort = await listen(endpoint);
  const bridge = await compose({ instance: "release-shell-owner/agent-m", origin: ORIGIN, dataFolder: folder, port: 0 });
  console.info = (...values) => lines.push(values.join(" "));
  t.after(async () => { console.info = previousInfo; await bridge.close(); await close(endpoint); await rm(folder, { recursive: true, force: true }); });
  const config = { name: "own-model-server", kind: "openai-compatible", baseUrl: `http://127.0.0.1:${endpointPort}/v1`, model: "small", key: KEY };
  assert.match(bridge.address, /^http:\/\/127\.0\.0\.1:\d+$/, "known positive: public compose binds its real server to loopback");
  assert.equal((await request(bridge, "", config)).status, 401, "failure node: pairing refusal precedes job-handler dispatch");
  assert.equal((await request(bridge, bridge.token, config, "https://other.example")).status, 403, "failure node: origin refusal precedes job-handler dispatch");
  assert.deepEqual(received, [], "boundary refusals make no own-model request");
  const response = await request(bridge, bridge.token, config);
  assert.equal(response.status, 200, "failure node: paired public request reaches registered jobHandlers");
  assert.deepEqual(await response.json(), { answer: { works: true, model: "small", tools: false, toolMessage: "ok" } }, "the public protocol unwraps the short endpoint answer");
  assert.deepEqual(received, [{ url: "/v1/chat/completions", authorization: `Bearer ${KEY}`, body: { model: "small", messages: [{ role: "user", content: "Call agent_m_probe once. It is a harmless capability check." }], max_tokens: 64, tools: [{ type: "function", function: { name: "agent_m_probe", description: "Report that tool calling works without changing anything.", parameters: { type: "object", properties: {}, additionalProperties: false } } }], stream: false } }], "one paired probe reaches the controlled own-model endpoint once");
  assert.equal((await readFile(join(folder, "pairing-token"), "utf8")).includes(KEY), false, "endpoint key is absent from retained shell data");
  assert.equal(lines.join("\n").includes(KEY) || lines.join("\n").includes(config.baseUrl), false, "endpoint credentials are absent from bridge logs");
});
