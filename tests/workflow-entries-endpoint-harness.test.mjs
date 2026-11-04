// MOD-workflow-entries' entry onDispatch for a model endpoint's job of a kind that changes code or runs tests: it runs through Agent M's own harness — MOD-endpoint-calls'
// endpointDriver with its tool loop, the tools of MOD-checkout-tools in the product's checkout — and no longer through opencode. As the text of
// docs/architecture/MOD-workflow-entries.md states it (onDispatch): "for a model endpoint, the endpoint the input `endpoint` names, with the key from the CI secret the input
// `secret` names, runs through Agent M's own job runner, MOD-endpoint-calls' `endpointDriver` calling the endpoint …; a job of any other kind — one that changes code or runs tests
// — works in the job's checkout of the product with the tools of MOD-checkout-tools, which only the agent's machine registers, its system prompt MOD-checkout-tools'
// `checkoutPrompt`, and no command of `bash` receives a key or the token; where a restricted source whose content the product holds does not allow the participant's place, the
// job's parameter `refuses` names `bash`"; and ARC-046: "A model endpoint's handed-over work is done in Agent M's own loop with the tools of MOD-checkout-tools in the job's checkout".
// Run: node --test tests/workflow-entries-endpoint-harness.test.mjs
//
// Module: MOD-workflow-entries
// Guards: UC-049; ONE DEFINITION, THREE DRIVERS; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; EVERY MODEL READS AGENT M'S AGENTS.MD FIRST; NO MODEL READS A CREDENTIAL
// Level: component
//
// Deterministic, no network, no real agent and no real model: the product and the instance are temporary git repositories laid out as the job workflow lays them out on the agent's
// machine (AGENT_M_PART agent, its result's folder, the one key FIXTURE_KEY, no token), as tests/workflow-entries-hand-over.test.mjs lays them out. The model endpoint is a fake
// `fetch` that answers as an OpenAI-compatible endpoint does, from a script of tool calls, and records every request. An executable named opencode on the PATH notes every start, so
// that a start would be seen. The kind is check-resource, a kind that runs code and tests; its recipe `resource-check` is MOD-resource-list's, which the Workflows register, for the
// product's compute resource `cluster` the job's parameter `resource` names. Readings the texts leave open, which this file takes and the report names:
//   - The job is one a hand-over queued for an endpoint the instance does not list: its record declares the endpoint's capabilities (run code and tests) and its context; the
//     participant built from it gets `use tools` and the capabilities its kind's tools need.
//   - A restricted source's content in the product is the folder docs/sources/<id>/ (MOD-source-register's restrictedPlaces), read from the instance's register.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the report of the change.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRecord } from "../src/job-ledger/index.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const { runEntry } = await import("../src/workflow-entries/main.mjs");
const REAL_GIT = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();

// ---------------------------------------------------------------- the fixtures

const text = (...lines) => `${lines.join("\n")}\n`;
const NOW = new Date("2026-10-26T09:00:00Z");
const TOKEN = "ghp_HARNESSpersonToken0123456789abcd";
const KEY = "sk-HARNESS-KEY-0123456789abcdef";
const TASK = "Make the sum right and run its test, token heron-2026";
const ENDPOINT = { kind: "openai-compatible", baseUrl: "https://llm.example.test/v1", model: "fixture-llm" };
const JOB = "JOB-20261026-0900-b7c1";
const PLACE = "GitHub's hosted runners";
const SEVEN = ["read", "write", "edit", "bash", "grep", "glob", "webfetch"];
const AGENTS_MD = "# Agent M rules, fixture agents-2026\n";

const PARTICIPANTS = text("# Participants of this instance", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| ci-bot | CI agent | fixture-llm | 100000 | — | read the repository, write to the repository | GitHub's hosted runners | ci hosted secret FIXTURE_KEY |");

// A register entry of the instance whose content may go only to `this machine`, held in the product's docs/sources/SRC-secret/.
const RESTRICTED = text("---", "id: SRC-secret", "title: SRC-secret title", "kind: document", "authority: informational", "licence: restricted - internal",
  "places:", "  - this machine", "content_repository: https://github.com/alice/thesis-tool", "---", "# SRC-secret SRC-secret title", "", "## Versions", "",
  "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| `1` | 2026-10-13 | fixture | here | one file, hashed only |");
const SECRET_LINE = "confidential clause kingfisher-77";

const PRODUCT = {
  "README.md": "# Thesis tool\n",
  // One compute resource, checked by a check job on the runner `gpu` (MOD-resource-list's checkPlan): what check-resource's recipe resource-check takes.
  "docs/resources.md": text("# Resources of this product", "", "**REGISTER**", "", "The resources.", "",
    "| Name | Kind | Address | Pin | Licence | Maintainer | Route | Processing place | Paid | Secret |", "|---|---|---|---|---|---|---|---|---|---|",
    "| cluster | compute | cluster.example.org | — | — | — | runner:gpu | NHR@FAU, Erlangen | — | — |"),
  "src/sum.mjs": "export const sum = (a, b) => a - b;\n",
  "test/sum.test.mjs": text('import test from "node:test";', 'import assert from "node:assert/strict";', 'import { sum } from "../src/sum.mjs";', "",
    'test("sum adds", () => assert.equal(sum(1, 2), 3));'),
};


function git(cwd, ...args) {
  const r = spawnSync(REAL_GIT, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
function write(root, files) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
}
const NO_MAINTENANCE = ["-c", "gc.auto=0", "-c", "maintenance.auto=false", "-c", "receive.autogc=false"];
const quiet = (dir) => { for (const [key, value] of [["gc.auto", "0"], ["maintenance.auto", "false"], ["receive.autogc", "false"]]) git(dir, "config", key, value); };
// A bare origin whose `main` holds `files`, and the clone of it the workflow checks out into `folder`.
function repository(root, name, files, folder) {
  const origin = join(root, `${name}.git`), seed = join(root, `${name}-seed`);
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  quiet(origin);
  git(root, "clone", "-q", ...NO_MAINTENANCE, origin, seed);
  quiet(seed);
  git(seed, "config", "user.name", "Seed");
  git(seed, "config", "user.email", "seed@example.org");
  write(seed, files);
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", "first");
  git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  mkdirSync(join(folder, ".."), { recursive: true });
  git(root, "clone", "-q", ...NO_MAINTENANCE, origin, folder);
  quiet(folder);
  git(folder, "config", "user.name", "Alice");
  git(folder, "config", "user.email", "alice@example.org");
  return origin;
}
const script = (bin, name, body) => writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });

// The answers of the fake endpoint: a tool call, or the final draft.
const call = (id, name, args) => ({ choices: [{ finish_reason: "tool_calls", message: { content: null, tool_calls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }] } }] });
const final = (answered) => ({ choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ draft: { answered }, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });

// The workflow's agent machine for one dispatched hand-over of check-resource to the unlisted endpoint `nvidia`: `register` adds the restricted source to the instance, and the
// product then holds its content; `script` is the endpoint's answers in turn, the last repeated. `holder` lays it out as the model's user's side of that machine: no key in its
// environment, and AGENT_M_KEY_HOLDER naming that address, at which the fake endpoint then answers; `key: false` leaves the key out without a holder.
async function world({ register = false, answers, holder = null, key = !holder }, run) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-harness-")));
  const workspace = join(root, "ws"), bin = join(root, "bin"), starts = join(root, "opencode-starts");
  mkdirSync(bin);
  writeFileSync(starts, "");
  script(bin, "opencode", `printf '%s\\n' "$*" >> ${starts}\ncase "$1" in --version) echo 1.4.0;; auth) echo '1 credentials';; models) echo opencode/big-pickle;; esac`);
  const instanceFiles = { "README.md": "# Instance\n", "AGENTS.md": AGENTS_MD, "docs/participants.md": PARTICIPANTS, ...(register ? { "docs/sources/SRC-secret.md": RESTRICTED } : {}) };
  repository(root, "instance", instanceFiles, join(workspace, "instance"));
  const instanceDir = join(workspace, "instance");
  const agentM = { version: "2026.10.0", commit: git(instanceDir, "rev-parse", "HEAD") };
  const { path, text: record } = startRecord({ id: JOB, declares: { context: 100000, capabilities: ["run code and tests"] }, kind: "check-resource",
    worksOn: ["https://github.com/alice/thesis-tool"], participant: "nvidia", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice",
    start: new Date("2026-10-26T08:00:00Z"), agentM, inputs: [], limit: 1, task: "with the hand-over", destinations: [{ participant: "nvidia", place: PLACE, parts: ["cluster"] }], params: { resource: "cluster" } });
  const productDir = join(workspace, "product");
  repository(root, "product", { ...PRODUCT, [path]: record, ...(register ? { "docs/sources/SRC-secret/notes.txt": `${SECRET_LINE}\n` } : {}) }, productDir);
  const requests = [];
  const saved = { PATH: process.env.PATH, FIXTURE_KEY: process.env.FIXTURE_KEY, AGENT_M_TOKEN: process.env.AGENT_M_TOKEN, FIXTURE_VISIBLE: process.env.FIXTURE_VISIBLE,
    NODE_TEST_CONTEXT: process.env.NODE_TEST_CONTEXT, fetch: globalThis.fetch };
  // The machine's environment as a command of bash would inherit it: the key and the token are in it, and a variable that is neither, as the known positive. The test
  // runner's own NODE_TEST_CONTEXT is not, so that the product's tests run by bash report as they do on a runner.
  Object.assign(process.env, { PATH: `${bin}:${process.env.PATH}`, AGENT_M_TOKEN: TOKEN, FIXTURE_VISIBLE: "seen-visible-2026", ...(key ? { FIXTURE_KEY: KEY } : {}) });
  if (!key) delete process.env.FIXTURE_KEY;
  delete process.env.NODE_TEST_CONTEXT;
  globalThis.fetch = async (address, init = {}) => {
    if (!String(address).startsWith(holder ?? ENDPOINT.baseUrl)) throw new TypeError(`uncontrolled request: ${address}`);
    requests.push({ address: String(address), headers: init.headers ?? {}, body: JSON.parse(String(init.body ?? "{}")) });
    const answer = answers[Math.min(requests.length - 1, answers.length - 1)];
    return new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const payload = join(root, "event.json");
    writeFileSync(payload, JSON.stringify({ inputs: { job: JOB, task: TASK, endpoint: JSON.stringify(ENDPOINT), secret: "FIXTURE_KEY" } }));
    const status = await runEntry("onDispatch", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_EVENT_PATH: payload, GITHUB_WORKSPACE: workspace,
      GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "alice/thesis-tool", GITHUB_REF_NAME: "main", GITHUB_SHA: agentM.commit, GITHUB_RUN_ID: "4711",
      GITHUB_ACTOR: "alice", AGENT_M_RUNNER: "hosted", AGENT_M_PRODUCT_DIR: productDir, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", AGENT_M_KEY_NAMES: "FIXTURE_KEY",
      AGENT_M_PART: "agent", AGENT_M_KEY: "1", AGENT_M_RESULT_DIR: join(root, "result"), ...(key ? { FIXTURE_KEY: KEY } : {}),
      ...(holder ? { AGENT_M_KEY_HOLDER: holder } : {}) }, { now: NOW });
    const deferred = join(root, "result", "deferred.json");
    return await run({ status, requests, productDir, instanceDir, bin,
      opencodeStarts: () => readFileSync(starts, "utf8").split("\n").filter(Boolean).filter((line) => !/^(--version|auth)/.test(line)),
      ends: () => (existsSync(deferred) ? JSON.parse(readFileSync(deferred, "utf8")).ends : []),
      // The text of every tool result the endpoint was sent, in the order sent.
      toolResults: () => requests.at(-1).body.messages.filter((message) => message.role === "tool").map((message) => message.content) });
  } finally {
    for (const name of ["PATH", "FIXTURE_KEY", "AGENT_M_TOKEN", "FIXTURE_VISIBLE", "NODE_TEST_CONTEXT"]) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
    globalThis.fetch = saved.fetch;
    rmSync(root, { recursive: true, force: true });
  }
}

// The endpoint's work in the checkout: read the function, edit it, run its test, look at the environment, answer.
const WORK = [
  call("c1", "read", { path: "src/sum.mjs" }),
  call("c2", "edit", { path: "src/sum.mjs", oldString: "a - b", newString: "a + b" }),
  call("c3", "bash", { command: "node --test test/sum.test.mjs" }),
  call("c4", "bash", { command: "export -p" }),
  final("the test passes"),
];

// ---------------------------------------------------------------- the harness

// TST-2026101 · level: component · module: MOD-workflow-entries
// guards: UC-049; ONE DEFINITION, THREE DRIVERS; EVERY MODEL READS AGENT M'S AGENTS.MD FIRST
// given: the agent's machine of a run a hand-over started for a queued check-resource job (a kind that runs code and tests) of the endpoint nvidia, whose record declares run code and tests; the product's checkout holds src/sum.mjs, which subtracts, and test/sum.test.mjs, which expects 1 + 2 = 3; the instance holds AGENTS.md; a fixture opencode on the PATH notes every start; the endpoint calls read, edit (a - b → a + b), bash `node --test test/sum.test.mjs`, bash `export -p`, then answers its draft
// input: onDispatch with the inputs job, task, endpoint and secret FIXTURE_KEY
// expect: outcome `done`; opencode is never started (known positive: `command -v opencode` with the run's PATH finds the fixture); every request goes to https://llm.example.test/v1/chat/completions with the key FIXTURE_KEY's value as its bearer and the model fixture-llm; the first request offers exactly the tools read, write, edit, bash, grep, glob, webfetch, its system prompt names the product's checkout as the working folder, and its user message begins with AGENTS.md's text and names no path of the instance's checkout; the checkout's src/sum.mjs now adds; the result of the test command the endpoint was sent holds `exit code: 0` and `pass 1`
test("TST-2026101: a hosted endpoint's job of a code kind runs through the endpoint driver with the checkout tools: it edits a file and runs a test, and opencode is never started", async () => {
  await world({ answers: WORK }, async (w) => {
    assert.equal(w.status.outcome, "done", w.status.summary);
    const found = spawnSync("sh", ["-c", "command -v opencode"], { encoding: "utf8", env: { ...process.env, PATH: `${w.bin}:${process.env.PATH}` } }).stdout.trim();
    assert.equal(found, join(w.bin, "opencode"), "known positive: the run's PATH finds the fixture opencode");
    assert.deepEqual(w.opencodeStarts(), [], "opencode is never started to run the job");
    assert.equal(w.requests.length, 5, "one request per step of the loop");
    for (const request of w.requests) {
      assert.equal(request.address, "https://llm.example.test/v1/chat/completions");
      assert.equal(request.headers.Authorization, `Bearer ${KEY}`);
      assert.equal(request.body.model, "fixture-llm");
    }
    const first = w.requests[0].body;
    assert.deepEqual((first.tools ?? []).map((tool) => tool.function.name), SEVEN, "the seven tools of the checkout are offered");
    assert.equal(first.messages[0].role, "system");
    assert.ok(first.messages[0].content.includes(`Working folder: ${w.productDir}`), "the system prompt names the checkout");
    const user = first.messages.find((message) => message.role === "user").content;
    assert.ok(user.startsWith(AGENTS_MD.trimEnd()), "the input begins with AGENTS.md's text");
    assert.equal(user.includes(w.instanceDir), false, "no path of the instance's checkout is given");
    assert.equal(readFileSync(join(w.productDir, "src/sum.mjs"), "utf8"), "export const sum = (a, b) => a + b;\n", "the edit is in the checkout");
    const ran = w.toolResults()[2];
    assert.match(ran, /exit code: 0/);
    assert.match(ran, /pass 1/);
  });
});

// TST-2026102 · level: component · module: MOD-workflow-entries
// guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; NO SECRET IN THE REPOSITORY
// given: as TST-2026101; the machine's environment holds FIXTURE_KEY (the endpoint's key), AGENT_M_TOKEN (the token's name) and FIXTURE_VISIBLE
// input: onDispatch, whose endpoint calls bash `export -p`
// expect: the result of `export -p` the endpoint was sent holds FIXTURE_VISIBLE's value (the known positive that it lists the environment) and holds neither the key's value nor the token's, and declares neither FIXTURE_KEY nor AGENT_M_TOKEN; the requests still carry the key as their bearer
test("TST-2026102: the endpoint's key and the token are absent from bash's environment", async () => {
  await world({ answers: WORK }, async (w) => {
    assert.equal(w.status.outcome, "done", w.status.summary);
    const listed = w.toolResults()[3];
    assert.ok(listed.includes("seen-visible-2026"), "known positive: export -p lists the environment");
    assert.equal(listed.includes(KEY), false, "the key's value is not in the environment");
    assert.equal(listed.includes(TOKEN), false, "the token's value is not in the environment");
    assert.doesNotMatch(listed, /\bFIXTURE_KEY=|\bAGENT_M_TOKEN=/);
    assert.equal(w.requests[0].headers.Authorization, `Bearer ${KEY}`, "the key reaches the endpoint, and only there");
  });
});

// TST-2026103 · level: component · module: MOD-workflow-entries
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: as TST-2026101, but the instance's register holds SRC-secret, restricted to `this machine`, whose content the product holds in docs/sources/SRC-secret/notes.txt, and the participant's place is GitHub's hosted runners; the endpoint calls bash `cat docs/sources/SRC-secret/notes.txt`, then read of src/sum.mjs, then answers
// input: onDispatch
// expect: outcome `done`; the first request offers read, write, edit, grep, glob and webfetch and not bash; the bash call is answered with a refusal that it is not offered, and the read is answered with the file (the known positive that tools still work); no request holds the restricted line; the job's end lists a note that bash is withheld, naming SRC-secret and the place; the restricted file is in the checkout (the known positive for the search)
test("TST-2026103: where a restricted source does not allow the endpoint's place, bash is refused in that job", async () => {
  const answers = [call("c1", "bash", { command: "cat docs/sources/SRC-secret/notes.txt" }), call("c2", "read", { path: "src/sum.mjs" }), final("checked")];
  await world({ register: true, answers }, async (w) => {
    assert.equal(w.status.outcome, "done", w.status.summary);
    assert.ok(readFileSync(join(w.productDir, "docs/sources/SRC-secret/notes.txt"), "utf8").includes(SECRET_LINE), "known positive: the checkout holds the restricted line");
    assert.deepEqual((w.requests[0].body.tools ?? []).map((tool) => tool.function.name), SEVEN.filter((name) => name !== "bash"));
    const [refused, read] = w.toolResults();
    assert.match(refused, /refused: bash is not offered here/);
    assert.match(read, /a - b/, "the read is answered");
    assert.equal(JSON.stringify(w.requests).includes(SECRET_LINE), false, "no request holds the restricted line");
    const results = w.ends().map((end) => end.part.part.results.join("\n")).join("\n");
    assert.match(results, /bash/);
    assert.match(results, /SRC-secret/);
    assert.match(results, /GitHub's hosted runners/);
  });
});

// TST-1243006 · level: component · module: MOD-workflow-entries
// guards: NO MODEL READS A CREDENTIAL; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: as TST-2026101, but laid out as the model's user's side of the agent's machine: FIXTURE_KEY is set neither in the entry's environment nor in the process's, and AGENT_M_KEY_HOLDER names http://127.0.0.1:9, a stand-in for the key holder at which the fake endpoint answers
// input: onDispatch with the inputs job, task, endpoint (https://llm.example.test/v1) and secret FIXTURE_KEY
// expect: outcome `done`; every request goes to http://127.0.0.1:9/chat/completions with the model fixture-llm and no Authorization header, none to the endpoint's own address; the checkout's src/sum.mjs now adds; counter-proof: laid out the same without AGENT_M_KEY_HOLDER, the entry ends `not run`, its summary naming FIXTURE_KEY as missing, and sends no request
test("TST-1243006: on the model's user's side the endpoint is reached through the key holder, with no key in that side's environment", async () => {
  await world({ answers: WORK, holder: "http://127.0.0.1:9" }, async (w) => {
    assert.equal(w.status.outcome, "done", w.status.summary);
    assert.equal(w.requests.length, 5);
    for (const request of w.requests) {
      assert.equal(request.address, "http://127.0.0.1:9/chat/completions");
      assert.equal(request.body.model, "fixture-llm");
      assert.equal(Object.keys(request.headers).some((name) => name.toLowerCase() === "authorization"), false, "the model's user's side sends no key");
    }
    assert.equal(readFileSync(join(w.productDir, "src/sum.mjs"), "utf8"), "export const sum = (a, b) => a + b;\n");
  });
  await world({ answers: WORK, key: false }, async (w) => {
    assert.equal(w.status.outcome, "not run", "counter-proof: without the holder and the key the job does not run");
    assert.match(w.status.summary, /FIXTURE_KEY is missing/);
    assert.equal(w.requests.length, 0);
  });
});
