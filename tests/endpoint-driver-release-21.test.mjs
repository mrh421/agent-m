// MOD-endpoint-calls — independently authored release coverage for ITM-316.
// Module: MOD-endpoint-calls
// Level: release
// Guards: ONE DEFINITION, THREE DRIVERS; A RUNTIME IS INTERCHANGEABLE; NO COST IS GUESSED; AN UNSUPPORTED ENDPOINT SAYS SO
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { endpointDriver } from "../src/endpoint-calls/index.mjs";

const OPENAI = { name: "openai", kind: "openai-compatible", baseUrl: "https://models.example.test/v1", model: "tiny", key: "openai-key" };
const ANTHROPIC = { name: "anthropic", kind: "anthropic", baseUrl: "https://claude.example.test/v1", model: "claude", key: "anthropic-key" };
const PARTICIPANT = { name: "fixture", type: "model endpoint", model: "fixture", context: 100, price: null, capabilities: [], place: "test", route: "direct" };
const INPUT = {
  prompt: "Prepared prompt only.",
  parts: [{ name: "source", text: "must not be appended", size: 10, sources: [], required: true, recipe: "fixture", artifacts: [] }],
  output: null,
  findings: [],
  previous: null,
  workdir: null,
};
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function withFetch(t, fetch) { const prior = globalThis.fetch; globalThis.fetch = fetch; t.after(() => { globalThis.fetch = prior;
  });
  }
const FAULTS = {
  "TST-316901": ['driverRequest(config, driverPrompt(input), options.signal)', 'driverRequest(config, `${input.prompt} ${input.parts[0].text}`, options.signal)'],
  "TST-316902": ['return { text, usage: usageOf(body?.usage) };', 'return { text, usage: { inputTokens: 0, outputTokens: 0, minutes: null, cost: null } };'],
  "TST-316903": ['if (error?.name === "AbortError") throw error;\n      diagnosis = diagnoseEndpoint(error, config, where);', 'if (error?.name === "AbortError") return {};\n      diagnosis = diagnoseEndpoint(error, config, where);'],
  "TST-316904": ['throw new EndpointFailed(diagnosis);', 'return {};'],
};

// TST-316901 · level: release · module: MOD-endpoint-calls
// guards: ONE DEFINITION, THREE DRIVERS; A RUNTIME IS INTERCHANGEABLE; NO COST IS GUESSED; AN UNSUPPORTED ENDPOINT SAYS SO
// given: one prepared DriverInput and constructed OpenAI-compatible and Anthropic answers in Node.
// input: send the same public Driver input through each provider shape.
// expect: each makes one direct request containing the prepared prompt once and returns the provider answer kind.
test("TST-316901: prepared input is one direct request for both provider shapes", async (t) => {
  const calls = [];
  withFetch(t, async (url, init) => {
    calls.push({ url, init });
    return String(url).includes("claude")
      ? reply(200, { content: [{ type: "text", text: "anthropic" }] })
      : reply(200, { choices: [{ message: { content: "openai" } }], usage: { prompt_tokens: 3, completion_tokens: 2 } });
  });
  assert.deepEqual(await endpointDriver(OPENAI, PARTICIPANT).send(INPUT), {
    text: "openai", usage: { inputTokens: 3, outputTokens: 2, minutes: null, cost: null },
  });
  assert.deepEqual(await endpointDriver(ANTHROPIC, PARTICIPANT).send(INPUT), { text: "anthropic", usage: null });
  assert.equal(calls.length, 2);
  assert.ok(calls.every(({ init }) => JSON.parse(init.body).messages[0].content === INPUT.prompt
    && !init.body.includes(INPUT.parts[0].text)));
});

// TST-316902 · level: release · module: MOD-endpoint-calls
// guards: ONE DEFINITION, THREE DRIVERS; A RUNTIME IS INTERCHANGEABLE; NO COST IS GUESSED; AN UNSUPPORTED ENDPOINT SAYS SO
// given: a controlled browser-context driver and an endpoint answer without usage.
// input: send the same public DriverInput in browser context.
// expect: answer kind is unchanged and absent usage and cost remain null.
test("TST-316902: browser-context direct driver preserves absent usage as null", async (t) => {
  const prior = globalThis.window;
  globalThis.window = {};
  t.after(() => { globalThis.window = prior;
  });
  withFetch(t, async () => reply(200, { choices: [{ message: { content: "browser" } }] }));
  assert.deepEqual(await endpointDriver(OPENAI, PARTICIPANT).send(INPUT), { text: "browser", usage: null });
});

// TST-316903 · level: release · module: MOD-endpoint-calls
// guards: ONE DEFINITION, THREE DRIVERS; A RUNTIME IS INTERCHANGEABLE; NO COST IS GUESSED; AN UNSUPPORTED ENDPOINT SAYS SO
// given: a browser blocked before a response and an already aborted signal.
// input: send the public driver once for each constructed failure.
// expect: browser blockage is named with working routes, cancellation is preserved, and neither retries.
test("TST-316903: blocked and cancelled direct calls remain named single requests", async (t) => {
  const prior = globalThis.window;
  globalThis.window = {};
  t.after(() => { globalThis.window = prior;
  });
  let calls = 0;
  withFetch(t, async (_url, init) => {
    calls += 1;
    if (calls === 1) throw new TypeError("Failed to fetch");
    assert.ok(init.signal.aborted);
    throw Object.assign(new Error("aborted"), { name: "AbortError" });
  });
  const driver = endpointDriver(OPENAI, PARTICIPANT);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(driver.send(INPUT), (error) => error.name === "EndpointFailed"
    && error.diagnosis.reason === "blocked by the browser" && error.diagnosis.routes.join(",") === "ci,bridge");
  await assert.rejects(driver.send(INPUT, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls, 2);
});

// TST-316904 · level: release · module: MOD-endpoint-calls
// guards: ONE DEFINITION, THREE DRIVERS; A RUNTIME IS INTERCHANGEABLE; NO COST IS GUESSED; AN UNSUPPORTED ENDPOINT SAYS SO
// given: constructed key-refused and input-too-long provider replies.
// input: send once for each reply through the public direct driver.
// expect: each keeps its diagnosis, does not cut input, and makes no retry.
test("TST-316904: refused key and length remain diagnosed single requests", async (t) => {
  const bodies = [];
  withFetch(t, async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return bodies.length === 1
      ? reply(401, { error: { message: "key refused" } })
      : reply(413, { error: { message: "input too long" } });
  });
  const driver = endpointDriver(OPENAI, PARTICIPANT);
  await assert.rejects(driver.send(INPUT), (error) => error.name === "EndpointFailed" && error.diagnosis.reason === "key refused");
  await assert.rejects(driver.send(INPUT), (error) => error.name === "EndpointFailed" && error.diagnosis.reason === "too long");
  assert.equal(bodies.length, 2);
  for (const body of bodies) assert.equal(body.messages[0].content, INPUT.prompt);
});

after(() => { if (process.env.GITHUB_ACTIONS !== "true" || process.env.AGENT_M_316_RELEASE_FAULT_CHILD) return;
  const temporary = mkdtempSync(join(tmpdir(), "agent-m-316-release-fault-")), copied = join(temporary, "repo"), digest = (value) => createHash("sha256").update(value).digest("hex");
  try { cpSync(process.cwd(), copied, { recursive: true, filter: (path) => !path.includes("/.git") && !path.includes("/node_modules") });
  for (const [id, [needle, replacement]] of Object.entries(FAULTS)) { const source = join(copied, "src/endpoint-calls/index.mjs"), original = readFileSync(source), argv = [process.execPath, "--test", "--test-name-pattern", id, "tests/endpoint-driver-release-21.test.mjs"];
  assert.equal(original.toString().split(needle).length - 1, 1, `${id}: unique fault target`);
  const invoke = () => { const env = { ...process.env, AGENT_M_316_RELEASE_FAULT_CHILD: "1" };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(argv[0], argv.slice(1), { cwd: copied, encoding: "utf8", timeout: 15_000, env });
  };
  const sourceHash = digest(original), testHash = digest(readFileSync(join(copied, "tests/endpoint-driver-release-21.test.mjs")));
  let failed, passed, faultHash, restoredHash, faultEnded, restoreStarted, restoredEnded, positiveEnded;
  const faultStarted = new Date().toISOString();
  try { writeFileSync(source, original.toString().replace(needle, replacement));
  faultHash = digest(readFileSync(source));
  failed = invoke();
  faultEnded = new Date().toISOString();
  } finally { restoreStarted = new Date().toISOString();
  writeFileSync(source, original);
  restoredHash = digest(readFileSync(source));
  restoredEnded = new Date().toISOString();
  } passed = invoke();
  positiveEnded = new Date().toISOString();
  console.log("TST316-release-counterproof " + JSON.stringify({ id, needle, replacement, source, sourceHash, testHash, faultHash, restoredHash, faultStarted, faultEnded, restoreStarted, restoredEnded, positiveEnded, argv, cwd: copied, childflag: "AGENT_M_316_RELEASE_FAULT_CHILD=1", failed: { status: failed.status, signal: failed.signal, error: failed.error?.message ?? null, stdout: failed.stdout, stderr: failed.stderr }, passed: { status: passed.status, signal: passed.signal, error: passed.error?.message ?? null, stdout: passed.stdout, stderr: passed.stderr } }));
  assert.equal(failed.status, 1, id);
  assert.match(`${failed.stdout}\n${failed.stderr}`, new RegExp(`not ok \\d+ - ${id}\\b`));
  assert.equal(restoredHash, sourceHash);
  assert.equal(passed.status, 0, id);
  assert.match(`${passed.stdout}\n${passed.stderr}`, new RegExp(`ok \\d+ - ${id}\\b`));
  } } finally { rmSync(temporary, { recursive: true, force: true });
  } });
