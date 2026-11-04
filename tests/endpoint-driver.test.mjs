// MOD-endpoint-calls — direct model-endpoint driver (ITM-316).
//
// Module: MOD-endpoint-calls
// Level: unit
// Guards: UC-005; UC-007; UC-010; UC-019; ONE DEFINITION, THREE DRIVERS; A RUNTIME IS INTERCHANGEABLE; NO COST IS GUESSED; AN UNSUPPORTED ENDPOINT SAYS SO
//
// Constructed fetch replies model each provider. They do not contact a provider, wait, or estimate usage.

import test, { after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { endpointDriver } from "../src/endpoint-calls/index.mjs";
import { formatFinding } from "../src/text-tools/index.mjs";

const FAULTS = {
  "TST-316-001": ["src/endpoint-calls/index.mjs", "maxTokens === null ?", "false ?"],
  "TST-316-002": ["src/endpoint-calls/index.mjs", 'config.kind === "anthropic" ? DRIVER_MAX_TOKENS : null', 'false ? DRIVER_MAX_TOKENS : null'],
  "TST-316-003": ["src/endpoint-calls/index.mjs", "throw new EndpointFailed(diagnosis);", "return {};"],
  "TST-316-004": ["src/endpoint-calls/index.mjs", "driverRequest(config, driverPrompt(input), options.signal), where, options.signal)", "driverRequest(config, driverPrompt(input)), where)"],
};

const OPENAI = { name: "example", kind: "openai-compatible", baseUrl: "https://models.example.test/v1", model: "tiny-model", key: "secret-key" };
const ANTHROPIC = { name: "claude", kind: "anthropic", baseUrl: "https://claude.example.test/v1", model: "claude-test", key: "anthropic-key" };
const PARTICIPANT = { name: "drafter", type: "model endpoint", model: "fixture-model", context: 1000, price: null, capabilities: ["draft text"], place: "test", route: "endpoint example" };
const INPUT = { prompt: "Write one checked requirement.", parts: [{ name: "source", text: "already placed in the prompt", size: 10, sources: [], required: true, recipe: "fixture", artifacts: [] }], output: null, findings: [], previous: null, workdir: null };

function reply(status, body) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function withFetch(t, implementation) {
  const previous = globalThis.fetch;
  globalThis.fetch = implementation;
  t.after(() => { globalThis.fetch = previous; });
}

function endpointFailure(reason) {
  return (error) => error?.name === "EndpointFailed" && error.diagnosis?.reason === reason;
}

const CONTEXT_PART = { ...INPUT.parts[0], text: "ENDPOINT_RECIPE_CONTEXT" };
const CONTEXT_INPUT = { ...INPUT, prompt: `Write the correction.\n\n### source\n\n${CONTEXT_PART.text}`, parts: [CONTEXT_PART] };
const CURRENT_DRAFT = JSON.stringify({ text: "ENDPOINT_CURRENT_DRAFT" }, null, 2);
const CONTEXT_FINDINGS = [
  { artifact: "UC-019", line: 7, kind: "error", rule: "A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT", what: "ENDPOINT_MISSING_CHECK", fix: "include the check" },
  { artifact: "SPEC", line: 8, kind: "warning", rule: "ONE STATEMENT PER REQUIREMENT", what: "ENDPOINT_TWO_STATEMENTS", fix: "split or justify the rule" },
];
const occurrences = (text, value) => text.split(value).length - 1;

async function contextRequests(t, config, extra = null) {
  const calls = [];
  withFetch(t, async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return reply(200, config.kind === "anthropic"
      ? { content: [{ type: "text", text: "fixture answer" }] }
      : { choices: [{ message: { content: "fixture answer" } }] });
  });
  const driver = endpointDriver(config, PARTICIPANT);
  const send = async (input) => {
    const before = calls.length;
    assert.equal((await driver.send(input)).text, "fixture answer");
    assert.equal(calls.length, before + 1, "one send makes one provider request");
    const request = calls.at(-1);
    assert.equal(request.url, `${config.baseUrl}/${config.kind === "anthropic" ? "messages" : "chat/completions"}`);
    assert.equal(request.body.messages.length, 1);
    const text = request.body.messages[0].content;
    assert.equal(occurrences(text, CONTEXT_INPUT.prompt), 1, "ordinary prompt reaches the provider once");
    assert.equal(occurrences(text, CONTEXT_PART.text), 1, "recipe parts already in prompt are not added again");
    return text;
  };
  assert.equal(await send(CONTEXT_INPUT), CONTEXT_INPUT.prompt, "known positive: ordinary DriverInput is unchanged");
  return extra === null ? CONTEXT_INPUT.prompt : send({ ...CONTEXT_INPUT, ...extra });
}

// TST-398011
// level: unit
// module: MOD-endpoint-calls
// guards: ONE DEFINITION, THREE DRIVERS; UC-019
// given: an OpenAI-compatible driver and a constructed reply, with a recipe part already in the prompt
// input: send ordinary DriverInput with no previous draft or findings
// expect: one captured chat request contains the exact prompt and its recipe part once
test("TST-398011: OpenAI ordinary DriverInput reaches the transport exactly once", async (t) => {
  await contextRequests(t, OPENAI);
});

// TST-398012
// level: unit
// module: MOD-endpoint-calls
// guards: UC-019; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT
// given: the same OpenAI driver after its known-positive ordinary exchange
// input: send DriverInput with the current draft in previous and no findings
// expect: the second request carries the entire current draft exactly once without duplicating prompt parts
test("TST-398012: OpenAI previous current draft reaches the transport exactly once", async (t) => {
  const text = await contextRequests(t, OPENAI, { previous: CURRENT_DRAFT });
  assert.equal(occurrences(text, CURRENT_DRAFT), 1, "OpenAI receives the complete previous current draft once");
});

// TST-398013
// level: unit
// module: MOD-endpoint-calls
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A FINDING READS LIKE A COMPILER MESSAGE
// given: the same OpenAI driver after its known-positive ordinary exchange
// input: send DriverInput with a previous draft and one error and one warning
// expect: each complete canonical formatFinding line and the current draft occur once in the second chat request
test("TST-398013: OpenAI canonical correction findings reach the transport exactly once", async (t) => {
  const text = await contextRequests(t, OPENAI, { previous: CURRENT_DRAFT, findings: CONTEXT_FINDINGS });
  for (const finding of CONTEXT_FINDINGS) assert.equal(occurrences(text, formatFinding(finding)), 1, `OpenAI receives canonical ${finding.kind} once`);
  assert.equal(occurrences(text, CURRENT_DRAFT), 1, "the findings travel with the draft they concern");
});

// TST-398014
// level: unit
// module: MOD-endpoint-calls
// guards: ONE DEFINITION, THREE DRIVERS; UC-019
// given: an Anthropic driver and a constructed reply, with a recipe part already in the prompt
// input: send ordinary DriverInput with no previous draft or findings
// expect: one captured Messages request contains the exact prompt and its recipe part once
test("TST-398014: Anthropic ordinary DriverInput reaches the transport exactly once", async (t) => {
  await contextRequests(t, ANTHROPIC);
});

// TST-398015
// level: unit
// module: MOD-endpoint-calls
// guards: UC-019; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT
// given: the same Anthropic driver after its known-positive ordinary exchange
// input: send DriverInput with the current draft in previous and no findings
// expect: the second request carries the entire current draft exactly once without duplicating prompt parts
test("TST-398015: Anthropic previous current draft reaches the transport exactly once", async (t) => {
  const text = await contextRequests(t, ANTHROPIC, { previous: CURRENT_DRAFT });
  assert.equal(occurrences(text, CURRENT_DRAFT), 1, "Anthropic receives the complete previous current draft once");
});

// TST-398016
// level: unit
// module: MOD-endpoint-calls
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A FINDING READS LIKE A COMPILER MESSAGE
// given: the same Anthropic driver after its known-positive ordinary exchange
// input: send DriverInput with a previous draft and one error and one warning
// expect: each complete canonical formatFinding line and the current draft occur once in the second Messages request
test("TST-398016: Anthropic canonical correction findings reach the transport exactly once", async (t) => {
  const text = await contextRequests(t, ANTHROPIC, { previous: CURRENT_DRAFT, findings: CONTEXT_FINDINGS });
  for (const finding of CONTEXT_FINDINGS) assert.equal(occurrences(text, formatFinding(finding)), 1, `Anthropic receives canonical ${finding.kind} once`);
  assert.equal(occurrences(text, CURRENT_DRAFT), 1, "the findings travel with the draft they concern");
});

// TST-316-001
// TST-472223 · level: unit · module: MOD-endpoint-calls
// guards: UC-005; UC-007; UC-010; UC-019; ONE DEFINITION, THREE DRIVERS; A RUNTIME IS INTERCHANGEABLE; NO COST IS GUESSED; AN UNSUPPORTED ENDPOINT SAYS SO
// given: a Node driver for an OpenAI-compatible endpoint and a constructed chat completion with reported token use
// input: send a DriverInput whose prompt already contains its recipe part
// expect: one exact provider request carries the prompt once, and the answer keeps only provider-reported usage
test("TST-316-001: OpenAI driver sends the prepared prompt once and returns reported usage in Node", async (t) => {
  const calls = [];
  withFetch(t, async (url, init) => {
    calls.push({ url, init });
    return reply(200, { choices: [{ message: { content: "REQUIREMENT" } }], usage: { prompt_tokens: 13, completion_tokens: 5 } });
  });

  const result = await endpointDriver(OPENAI, PARTICIPANT).send(INPUT);

  assert.deepEqual(result, { text: "REQUIREMENT", usage: { inputTokens: 13, outputTokens: 5, minutes: null, cost: null } });
  assert.equal(calls.length, 1, "one send makes one direct request");
  assert.equal(calls[0].url, "https://models.example.test/v1/chat/completions");
  assert.equal(calls[0].init.headers.Authorization, "Bearer secret-key");
  assert.equal(calls[0].url.includes("secret-key"), false, "the key is never in the URL");
  assert.deepEqual(JSON.parse(calls[0].init.body), { model: "tiny-model", messages: [{ role: "user", content: INPUT.prompt }], stream: false });
  assert.equal(calls[0].init.body.includes(INPUT.parts[0].text), false, "the driver does not append parts already in prompt");
});

// TST-316-002
// TST-472224 · level: unit · module: MOD-endpoint-calls
// guards: UC-005; UC-007; UC-010; UC-019; ONE DEFINITION, THREE DRIVERS; A RUNTIME IS INTERCHANGEABLE; NO COST IS GUESSED; AN UNSUPPORTED ENDPOINT SAYS SO
// given: an Anthropic endpoint with a constructed Messages response that reports no usage
// input: send the same prepared DriverInput
// expect: one Messages request carries the prompt and the returned usage is null, never an estimate
test("TST-316-002: Anthropic driver returns text and null for an unreported usage", async (t) => {
  const calls = [];
  withFetch(t, async (url, init) => {
    calls.push({ url, init });
    return reply(200, { content: [{ type: "text", text: "DRAFT" }] });
  });

  assert.deepEqual(await endpointDriver(ANTHROPIC, PARTICIPANT).send(INPUT), { text: "DRAFT", usage: null });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://claude.example.test/v1/messages");
  assert.equal(calls[0].init.headers["x-api-key"], "anthropic-key");
  assert.equal(calls[0].init.headers["anthropic-version"], "2023-06-01");
  assert.deepEqual(JSON.parse(calls[0].init.body), { model: "claude-test", max_tokens: 1024, messages: [{ role: "user", content: INPUT.prompt }] });
});

// TST-316-003
// TST-472225 · level: unit · module: MOD-endpoint-calls
// guards: UC-005; UC-007; UC-010; UC-019; ONE DEFINITION, THREE DRIVERS; A RUNTIME IS INTERCHANGEABLE; NO COST IS GUESSED; AN UNSUPPORTED ENDPOINT SAYS SO
// given: constructed provider refusals for a key and an overlong input
// input: send through the endpoint driver
// expect: each throws EndpointFailed with diagnoseEndpoint's reason and neither retry makes a second request
test("TST-316-003: refused and overlong requests fail once with their endpoint diagnoses", async (t) => {
  let calls = 0;
  withFetch(t, async () => {
    calls += 1;
    return calls === 1
      ? reply(401, { error: { message: "Invalid API key." } })
      : reply(413, { error: { message: "input too long" } });
  });
  const driver = endpointDriver(OPENAI, PARTICIPANT);

  await assert.rejects(driver.send(INPUT), endpointFailure("key refused"));
  await assert.rejects(driver.send(INPUT), endpointFailure("too long"));
  assert.equal(calls, 2, "each failed send made exactly one request");
});

// TST-316-004
// TST-472226 · level: unit · module: MOD-endpoint-calls
// guards: UC-005; UC-007; UC-010; UC-019; ONE DEFINITION, THREE DRIVERS; A RUNTIME IS INTERCHANGEABLE; NO COST IS GUESSED; AN UNSUPPORTED ENDPOINT SAYS SO
// given: a browser-visible fetch block and an already-aborted signal
// input: send through the driver with that signal
// expect: the block is named EndpointFailed, and the aborted request passes its signal to fetch and preserves AbortError
test("TST-316-004: a blocked browser call and cancellation are named without a retry", async (t) => {
  const previousWindow = globalThis.window;
  globalThis.window = {};
  t.after(() => { globalThis.window = previousWindow; });
  const calls = [];
  withFetch(t, async (url, init) => {
    calls.push({ url, init });
    if (calls.length === 1) throw new TypeError("Failed to fetch");
    throw Object.assign(new Error("The operation was aborted."), { name: "AbortError" });
  });
  const controller = new AbortController();
  controller.abort();
  const driver = endpointDriver(OPENAI, PARTICIPANT);

  await assert.rejects(driver.send(INPUT), endpointFailure("blocked by the browser"));
  await assert.rejects(driver.send(INPUT, { signal: controller.signal }), { name: "AbortError" });
  assert.equal(calls.length, 2, "neither failure is retried");
  assert.equal(calls[1].init.signal, controller.signal, "the cancellation signal reaches the direct request");
});

after(() => {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.AGENT_M_316_FAULT_CHILD) return;
  const temporary = mkdtempSync(join(tmpdir(), "agent-m-316-fault-")), copied = join(temporary, "repo");
  try {
    cpSync(process.cwd(), copied, { recursive: true, filter: (path) => !path.includes("/.git") && !path.includes("/node_modules") });
    for (const [id, [file, needle, replacement]] of Object.entries(FAULTS)) {
      const source = join(copied, file), original = readFileSync(source), digest = (value) => createHash("sha256").update(value).digest("hex");
      assert.equal(original.toString().split(needle).length - 1, 1, `${id}: unique fault target`);
      const invoke = () => { const env = { ...process.env, AGENT_M_316_FAULT_CHILD: "1" }; delete env.NODE_TEST_CONTEXT;
        return spawnSync(process.execPath, ["--test", "--test-name-pattern", id, "tests/endpoint-driver.test.mjs"], { cwd: copied, encoding: "utf8", timeout: 15_000, env }); };
      const originalHash = digest(original), testHash = digest(readFileSync(join(copied, "tests/endpoint-driver.test.mjs")));
      let faultHash, failed, faultEnded, restoreStarted, restoredHash, passed, positiveEnded, restoredEnded; const faultStarted = new Date().toISOString();
      try { writeFileSync(source, original.toString().replace(needle, replacement)); faultHash = digest(readFileSync(source)); failed = invoke(); faultEnded = new Date().toISOString(); }
      finally { restoreStarted = new Date().toISOString(); writeFileSync(source, original); restoredHash = digest(readFileSync(source)); restoredEnded = new Date().toISOString(); }
      passed = invoke(); positiveEnded = new Date().toISOString();
      console.log("TST316-counterproof " + JSON.stringify({ id, file, needle, replacement, testHash, originalHash, faultHash, restoredHash, faultStarted, faultEnded, restoreStarted, restoredEnded, positiveEnded, argv: [process.execPath, "--test", "--test-name-pattern", id, "tests/endpoint-driver.test.mjs"], cwd: copied, childflag: "AGENT_M_316_FAULT_CHILD=1", failed: { status: failed.status, signal: failed.signal, error: failed.error?.message ?? null, stdout: failed.stdout, stderr: failed.stderr }, passed: { status: passed.status, signal: passed.signal, error: passed.error?.message ?? null, stdout: passed.stdout, stderr: passed.stderr } }));
      assert.equal(failed.status, 1, id); assert.match(`${failed.stdout}\n${failed.stderr}`, new RegExp(`not ok \\d+ - ${id}\\b`));
      assert.equal(restoredHash, originalHash, `${id}: exact restoration`); assert.equal(passed.status, 0, id); assert.match(`${passed.stdout}\n${passed.stderr}`, new RegExp(`ok \\d+ - ${id}\\b`));
    }
  } finally { rmSync(temporary, { recursive: true, force: true }); }
});
