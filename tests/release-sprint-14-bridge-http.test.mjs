// The selected Bridge endpoint-test slice through its public entry (ITM-261).
//
// Module: MOD-bridge-http
// Guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE
// Guards: A CREDENTIAL IS NEVER PLACED IN A URL
// Level: release

import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { bridgeApi, pairAnew, serveBridge } from "../src/bridge-http/index.mjs";

const ORIGIN = "https://akmaier.github.io";
const CONFIG = { name: "local", kind: "openai-compatible", baseUrl: "http://127.0.0.1:11434", model: "small", key: "endpoint-key-in-body-only" };
const ANSWER = { works: true, model: "small" };

async function probe(bridge, token) {
  return fetch(`${bridge.address}/v1/probes/endpoint-test`, {
    method: "POST",
    headers: { Origin: ORIGIN, "Content-Type": "application/json", [bridgeApi.tokenHeader]: token },
    body: JSON.stringify({ args: CONFIG }),
  });
}

// CASE ITM-261-RELEASE-01
// TST-472515 · level: release · module: MOD-bridge-http
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; THE BRIDGE IS PAIRED ONCE; A CREDENTIAL IS NEVER PLACED IN A URL
// given: the public Bridge entry, a real loopback server, a constructed endpoint-test handler and a fresh data folder
// input: a missing-token probe, a paired endpoint-test probe, then pairAnew and probes with the old and new tokens
// expect: authentication refuses before dispatch; the paired body reaches the handler once and returns its answer; rotation takes effect on the running server, all endpoint configuration stays out of URL/logs, and the server closes
test("the public paired Bridge dispatches endpoint-test over loopback and enforces token rotation", async () => {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-release-bridge-"));
  const received = [], lines = [], previous = console.info;
  console.info = (...values) => lines.push(values.join(" "));
  const bridge = await serveBridge({ host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false }, {
    jobs: { "POST /v1/probes/endpoint-test": async ({ body }) => { received.push(body.args); return { answer: ANSWER }; } },
    mail: {}, tunnels: {},
  });
  try {
    assert.match(bridge.address, /^http:\/\/127\.0\.0\.1:\d+$/, "known positive: the public server binds a real loopback address");
    const missing = await probe(bridge, "");
    assert.equal(missing.status, 401, "a missing pairing token is refused before dispatch");
    assert.deepEqual(received, [], "the refusal reaches no handler");

    const success = await probe(bridge, bridge.token);
    assert.equal(success.status, 200, "the paired loopback request succeeds");
    assert.deepEqual(await success.json(), { answer: ANSWER });
    assert.deepEqual(received, [CONFIG], "the constructed handler receives the protocol body once");

    const rotated = await pairAnew(folder, "rotated-release-token");
    assert.equal((await probe(bridge, bridge.token)).status, 401, "the old token is refused after rotation");
    assert.equal((await probe(bridge, rotated)).status, 200, "the rotated token is accepted by the running server");
    assert.equal(received.length, 2, "only the paired requests dispatch");
    assert.ok(lines.every((line) => !line.includes(CONFIG.key) && !line.includes(bridge.token) && !line.includes(rotated)), "logs exclude endpoint and pairing secrets");
    assert.ok(lines.every((line) => !line.includes("?") && !line.includes(CONFIG.baseUrl)), "logs contain no URL query or endpoint configuration");
  } finally {
    await bridge.close();
    console.info = previous;
  }
});
