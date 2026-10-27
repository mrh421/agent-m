// Independent selected-item release coverage for ITM-323, ITM-324, and ITM-453.
//
// Module: MOD-bridge-http · MOD-bridge-client
// Level: release
// Guards: UC-011; UC-017; THE BRIDGE FINDS THE INSTALLED AGENTS; THE LOCAL BRIDGE REQUIRES A TOKEN; A REMOTE INTERFACE NAMES HOW IT FAILS
// Guards: A DATA FORMAT IS DEFINED ONCE

import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after } from "node:test";
import { serveBridge } from "../src/bridge-http/index.mjs";
import { BridgeError, ask, bridgeAt, handOver, probe, testBridge } from "../src/bridge-client/index.mjs";

const ORIGIN = "https://release.example.test";
const ADDRESS = "http://127.0.0.1:4711";
const TOKEN = "release-bridge-token";
const bridge = (token = TOKEN) => bridgeAt({ address: ADDRESS, token });
const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "content-type": "application/json" },
});
const FAULTS = {
  "TST-323901": ["src/bridge-http/protocol.mjs", 'path: "/v1/agents"', 'path: "/v1/agent"'],
  "TST-324901": ["src/bridge-http/protocol.mjs", 'method: "GET", path: "/v1/pair"', 'method: "POST", path: "/v1/pair"'],
  "TST-324902": ["src/bridge-client/index.mjs", "commit: job.commit", 'commit: "fault"'],
  "TST-324903": ["src/bridge-client/index.mjs", "typeof token !== \"string\" || !token", "typeof token !== \"string\" || false"],
};

function withFetch(t, fetchFn) {
  const prior = globalThis.fetch;
  globalThis.fetch = fetchFn;
  t.after(() => { globalThis.fetch = prior; });
}

async function running(t, jobs) {
  const folder = await mkdtemp(join(tmpdir(), "agent-m-bridge-release-21-"));
  const server = await serveBridge({ name: () => "lab-pc", host: "127.0.0.1", port: 0, origin: ORIGIN, dataFolder: folder, paused: () => false }, {
    jobs,
    mail: {},
    tunnels: {},
  });
  t.after(async () => {
    await server.close();
  });
  return server;
}

async function request(server, path, token = server.token) {
  return fetch(`${server.address}${path}`, {
    headers: { Origin: ORIGIN, "x-agent-m-bridge-token": token },
  });
}

// Module (as the case stated it): MOD-bridge-http · MOD-bridge-client
// TST-323901 · level: release · module: MOD-bridge-http
// guards: UC-011; UC-017; THE BRIDGE FINDS THE INSTALLED AGENTS; THE LOCAL BRIDGE REQUIRES A TOKEN; A REMOTE INTERFACE NAMES HOW IT FAILS; A DATA FORMAT IS DEFINED ONCE
// given: the exported paired Bridge server and a constructed agents handler with both offered and missing agents
// input: an unpaired GET /v1/agents followed by the paired public request
// expect: the token refusal reaches no handler; the paired request reaches the declared agents handler and preserves its answer
test("TST-323901: exported Bridge dispatches offered and missing agents only after token authentication", async (t) => {
  let calls = 0;
  const agents = {
    agents: [{ name: "codex", version: "1", ready: true, loggedIn: true }],
    missing: [{ name: "other-agent" }],
  };
  const server = await running(t, {
    "GET /v1/agents": async () => {
      calls += 1;
      return agents;
    },
  });

  const refused = await request(server, "/v1/agents", "");
  assert.deepEqual(await refused.json(), { error: "token-refused", message: "Bridge token refused." });
  assert.equal(calls, 0, "failure node: token refusal happens before the agents handler");

  const paired = await request(server, "/v1/agents");
  assert.equal(paired.status, 200);
  assert.deepEqual(await paired.json(), agents, "failure node: the declared public agents route preserves offered and missing agents");
  assert.equal(calls, 1);
});

// Module (as the case stated it): MOD-bridge-http · MOD-bridge-client
// TST-324901 · level: release · module: MOD-bridge-client
// guards: UC-011; UC-017; THE BRIDGE FINDS THE INSTALLED AGENTS; THE LOCAL BRIDGE REQUIRES A TOKEN; A REMOTE INTERFACE NAMES HOW IT FAILS; A DATA FORMAT IS DEFINED ONCE
// given: a public Bridge client and constructed pair then agents answers
// input: testBridge(bridge)
// expect: it resolves the public GET pair datum before GET agents, authenticates both calls, and combines their answers
test("TST-324901: public testBridge consumes the pair datum then the agents datum", async (t) => {
  const calls = [];
  withFetch(t, async (url, init) => {
    calls.push({ url: String(url), init });
    if (calls.length === 1) return response({ bridge: { name: "Bridge", version: "1", platform: "linux" }, origin: ORIGIN });
    return response({ agents: [{ name: "codex", version: "1", ready: true, loggedIn: true }], missing: [{ name: "other-agent" }] });
  });

  assert.deepEqual(await testBridge(bridge()), {
    bridge: { name: "Bridge", version: "1", platform: "linux" },
    origin: ORIGIN,
    agents: [{ name: "codex", version: "1", ready: true, loggedIn: true }],
    missing: [{ name: "other-agent" }],
  });
  assert.deepEqual(calls.map(({ url, init }) => [url, init.method, init.headers["x-agent-m-bridge-token"]]), [
    [`${ADDRESS}/v1/pair`, "GET", TOKEN],
    [`${ADDRESS}/v1/agents`, "GET", TOKEN],
  ], "failure node: the public client consumes the protocol's pair and agents declarations in order");
});

// Module (as the case stated it): MOD-bridge-http · MOD-bridge-client
// TST-324902 · level: release · module: MOD-bridge-client
// guards: UC-011; UC-017; THE BRIDGE FINDS THE INSTALLED AGENTS; THE LOCAL BRIDGE REQUIRES A TOKEN; A REMOTE INTERFACE NAMES HOW IT FAILS; A DATA FORMAT IS DEFINED ONCE
// given: a public Bridge client, one committed job identity, and constructed accepted, completed, and failed ask answers
// input: handOver(job), then agent asks that complete and fail
// expect: hand-over sends the exact committed identity; completed asks answer { text, calls, usage } with calls empty for a request that is not one exchange of a tool loop, and a failed ask is named AskFailed
test("TST-324902: public handOver and ask preserve committed identity and named ask outcomes", async (t) => {
  const calls = [];
  const answers = [
    { accepted: "JOB-901" },
    { ask: "ASK-done" },
    { state: "done", text: "draft", usage: { input: 2, output: 3 } },
    { ask: "ASK-failed" },
    { state: "failed", error: "agent unavailable" },
  ];
  withFetch(t, async (url, init = {}) => {
    calls.push({ url: String(url), init });
    return response(answers.shift());
  });

  assert.deepEqual(await handOver(bridge(), { product: "owner/product", record: "docs/jobs/JOB-901.md", commit: "a".repeat(40) }), { accepted: "JOB-901" });
  assert.deepEqual(await ask(bridge(), { agent: "codex" }, "draft"), { text: "draft", calls: [], usage: { input: 2, output: 3 } });
  await assert.rejects(() => ask(bridge(), { agent: "codex" }, "draft"),
    (error) => error instanceof BridgeError && error.name === "AskFailed" && error.message === "agent unavailable");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    product: "owner/product",
    record: "docs/jobs/JOB-901.md",
    commit: "a".repeat(40),
  }, "failure node: public handOver passes the committed job identity unchanged");
  assert.deepEqual(calls.slice(1).map(({ url, init }) => [new URL(url).pathname, init.method]), [
    ["/v1/ask", "POST"], ["/v1/ask/ASK-done", "GET"], ["/v1/ask", "POST"], ["/v1/ask/ASK-failed", "GET"],
  ]);
});

// Module (as the case stated it): MOD-bridge-http · MOD-bridge-client
// TST-324903 · level: release · module: MOD-bridge-client
// guards: UC-011; UC-017; THE BRIDGE FINDS THE INSTALLED AGENTS; THE LOCAL BRIDGE REQUIRES A TOKEN; A REMOTE INTERFACE NAMES HOW IT FAILS; A DATA FORMAT IS DEFINED ONCE
// given: a public Bridge client with a pairing token, then one without a token
// input: probe agent with a constructed successful answer, then probe agent without its token
// expect: the agent probe sends its declared body and unwraps its answer; missing token is TokenMissing before fetch
test("TST-324903: public agent probe unwraps its answer and missing token sends no request", async (t) => {
  let calls = 0;
  withFetch(t, async (url, init) => {
    calls += 1;
    assert.equal(String(url), `${ADDRESS}/v1/probes/agent`);
    assert.equal(init.method, "POST");
    assert.equal(init.headers["x-agent-m-bridge-token"], TOKEN);
    assert.deepEqual(JSON.parse(init.body), { args: { prompt: "ok" } });
    return response({ answer: { works: true, agent: "codex" } });
  });

  assert.deepEqual(await probe(bridge(), "agent", { prompt: "ok" }), { works: true, agent: "codex" });
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(() => probe(bridgeAt({ address: ADDRESS, token: "" }), "agent", { prompt: "ok" }),
    (error) => error instanceof BridgeError && error.name === "TokenMissing");
  assert.equal(calls, 0, "failure node: missing pairing token prevents a probe request");
});

after(() => {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.AGENT_M_BRIDGE_RELEASE21_FAULT_CHILD) return;
  const temporary = mkdtempSync(join(tmpdir(), "agent-m-bridge-release-21-fault-"));
  const copied = join(temporary, "repo");
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const testPath = "tests/bridge-release-21.test.mjs";
  try {
    cpSync(process.cwd(), copied, { recursive: true, filter: (path) => !path.includes("/.git") && !path.includes("/node_modules") });
    for (const [id, [file, needle, replacement]] of Object.entries(FAULTS)) {
      const source = join(copied, file);
      const original = readFileSync(source);
      assert.equal(original.toString().split(needle).length - 1, 1, `${id}: unique fault target`);
      const argv = [process.execPath, "--test", "--test-name-pattern", id, testPath];
      const invoke = () => {
        const env = { ...process.env, AGENT_M_BRIDGE_RELEASE21_FAULT_CHILD: "1" };
        delete env.NODE_TEST_CONTEXT;
        return spawnSync(argv[0], argv.slice(1), { cwd: copied, encoding: "utf8", timeout: 15_000, env });
      };
      const sourceHash = digest(original);
      const testHash = digest(readFileSync(join(copied, testPath)));
      let failed, passed, faultHash, restoredHash, faultEnded, restoreStarted, restoredEnded, positiveEnded;
      const faultStarted = new Date().toISOString();
      try {
        writeFileSync(source, original.toString().replace(needle, replacement));
        faultHash = digest(readFileSync(source));
        failed = invoke();
        faultEnded = new Date().toISOString();
      } finally {
        restoreStarted = new Date().toISOString();
        writeFileSync(source, original);
        restoredHash = digest(readFileSync(source));
        restoredEnded = new Date().toISOString();
      }
      passed = invoke();
      positiveEnded = new Date().toISOString();
      console.log("TST-bridge-release-21-counterproof " + JSON.stringify({
        id,
        file,
        needle,
        replacement,
        sourceHash,
        testHash,
        faultHash,
        restoredHash,
        faultStarted,
        faultEnded,
        restoreStarted,
        restoredEnded,
        positiveEnded,
        argv,
        cwd: copied,
        childflag: "AGENT_M_BRIDGE_RELEASE21_FAULT_CHILD=1",
        failed: { status: failed.status, signal: failed.signal, error: failed.error?.message ?? null, stdout: failed.stdout, stderr: failed.stderr },
        passed: { status: passed.status, signal: passed.signal, error: passed.error?.message ?? null, stdout: passed.stdout, stderr: passed.stderr },
      }));
      assert.equal(failed.status, 1, id);
      assert.match(`${failed.stdout}\n${failed.stderr}`, new RegExp(`not ok \\d+ - ${id}\\b`));
      assert.equal(restoredHash, sourceHash, `${id}: exact restoration`);
      assert.equal(passed.status, 0, id);
      assert.match(`${passed.stdout}\n${passed.stderr}`, new RegExp(`ok \\d+ - ${id}\\b`));
    }
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
