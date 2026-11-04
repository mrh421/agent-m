// The selected endpoint-test job through the public Bridge and jobs entries (ITM-262).
//
// Module: MOD-bridge-jobs
// Guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; A CREDENTIAL IS NEVER PLACED IN A URL
// Level: release

import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import http from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { jobHandlers } from "../src/bridge-jobs/index.mjs";
import { bridgeApi, serveBridge } from "../src/bridge-http/index.mjs";

const ORIGIN = "https://akmaier.github.io";
const CONFIG = { name: "local", kind: "openai-compatible", baseUrl: "http://127.0.0.1:11434", model: "small", key: "endpoint-key-in-body-only" };

function probe(bridge, token, args) {
  return new Promise((resolve, reject) => {
    const request = http.request(`${bridge.address}/v1/probes/endpoint-test`, { method: "POST", headers: {
      Origin: ORIGIN, "content-type": "application/json", [bridgeApi.tokenHeader]: token,
    } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
    });
    request.on("error", reject);
    request.end(JSON.stringify({ args }));
  });
}

// CASE ITM-262-RELEASE-01
// TST-472517 · level: release · module: MOD-bridge-jobs
// guards: UC-003; THE LOCAL BRIDGE BINDS TO LOOPBACK ONLY; THE LOCAL BRIDGE REQUIRES A TOKEN; A CREDENTIAL IS NEVER PLACED IN A URL
// given: the public jobHandlers default, a real paired loopback Bridge, and a constructed provider response through global fetch
// input: an unpaired request, then paired success and provider-refusal endpoint-test requests through Node HTTP
// expect: the public protocol refuses before dispatch; its default handler maps typed args into one provider call and preserves success and diagnosis results
test("the public default endpoint-test job crosses a paired loopback Bridge and preserves provider results", async () => {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-release-jobs-"));
  const providerCalls = [], originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    providerCalls.push({ url: String(url), init });
    assert.equal(String(url), `${CONFIG.baseUrl}/chat/completions`, "the Node endpoint driver calls the constructed provider endpoint");
    const body = JSON.parse(init.body);
    if (body.model === "refused") return new Response(JSON.stringify({ error: { message: "provider refused this key" } }), { status: 401 });
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
  };
  const bridge = await serveBridge({ host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false },
    { jobs: jobHandlers(), mail: {}, tunnels: {} });
  try {
    assert.match(bridge.address, /^http:\/\/127\.0\.0\.1:\d+$/, "known positive: the public Bridge is a real loopback server");
    const denied = await probe(bridge, "", CONFIG);
    assert.deepEqual(denied, { status: 401, body: { error: "token-refused", message: "Bridge token refused." } },
      "the named token refusal occurs before the default job handler");
    assert.deepEqual(providerCalls, [], "the refusal made no provider call");

    const success = await probe(bridge, bridge.token, CONFIG);
    assert.deepEqual(success, { status: 200, body: { answer: { works: true, model: "small", tools: false, toolMessage: "ok" } } }, "the default handler preserves the typed success result");
    assert.equal(providerCalls.length, 1, "one paired probe makes exactly one provider call");
    assert.deepEqual(JSON.parse(providerCalls[0].init.body), { model: "small", messages: [{ role: "user", content: "Call agent_m_probe once. It is a harmless capability check." }], max_tokens: 64, tools: [{ type: "function", function: { name: "agent_m_probe", description: "Report that tool calling works without changing anything.", parameters: { type: "object", properties: {}, additionalProperties: false } } }], stream: false });
    assert.equal(providerCalls[0].init.headers.Authorization, "Bearer endpoint-key-in-body-only", "the typed key reaches the provider header");
    assert.ok(!providerCalls[0].url.includes(CONFIG.key), "the credential is not in the provider URL");

    const refused = await probe(bridge, bridge.token, { ...CONFIG, model: "refused" });
    assert.deepEqual(refused, { status: 200, body: { answer: { works: false, diagnosis: {
      reason: "key refused", message: "provider refused this key", routes: [],
    } } } }, "the default job keeps the endpoint driver's named diagnosis result");
    assert.equal(providerCalls.length, 2, "the second paired probe is one additional provider call");
  } finally {
    await bridge.close();
    globalThis.fetch = originalFetch;
  }
});
