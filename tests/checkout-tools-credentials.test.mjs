// Module: MOD-checkout-tools
// Module: MOD-endpoint-calls
// Module: MOD-workflow-entries
// Module: MOD-runtimes
// Module: MOD-agent-processes
// Level: unit
// Guards: NO MODEL READS A CREDENTIAL; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// No credential that the agent's machine of a hosted job holds is readable through a tool of the model: the machine's checkouts keep no token, a hand-over to a model
// endpoint runs as the model's own user, who holds no key and may not use sudo, beside the key holder, which adds the key to each request it forwards to the run's
// endpoint and to no other, and the tools that read files in the driver's process refuse every link that leads out of the checkout. A second OS user and sudo need a
// runner: this file checks the generated workflow's text and the commands built for that user, and runs the key holder and the tools with real servers and real files
// of this machine, in temporary folders. A coding agent's CLI on that side reaches its provider through the key holder, by the provider's base-URL setting, with a placeholder
// in its key variable; the CLIs here are controlled fixtures, never a vendor's agent. Every expected text is stated here.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { connect } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkoutStrategies } from "../src/checkout-tools/index.mjs";
import { agentDriver } from "../src/agent-processes/index.mjs";
import { holdKey } from "../src/endpoint-calls/index.mjs";
import { jobWorkflowFiles } from "../src/runtimes/index.mjs";
import { ciEnvironment, keyAvailable } from "../src/workflow-entries/compose.mjs";
import { heldOf, modelUserCommands, separates, separationOf } from "../src/workflow-entries/model-user.mjs";

const KEY = "sk-HELD-BY-THE-KEY-HOLDER-0123456789";
const TOKEN = "ghp_PERSONtoken0123456789abcdefABCDEF";
const INSTANCE = { repository: "alice/agent-m", commit: "a".repeat(40) };
const SECRETS = { token: "AGENT_M_TOKEN", keys: ["FIXTURE_KEY"] };

// The jobs of a generated workflow by their ids: { id: the job's lines }.
function jobsOf(text) {
  const jobs = {};
  let current = null;
  for (const line of text.split("\n")) {
    const id = /^ {2}([A-Za-z0-9_-]+):$/.exec(line)?.[1];
    if (id) { current = id; jobs[id] = []; continue; }
    if (current) jobs[current].push(line);
  }
  return Object.fromEntries(Object.entries(jobs).map(([id, lines]) => [id, lines.join("\n")]));
}
const count = (text, pattern) => (text.match(pattern) ?? []).length;

// TST-1243001 · level: unit · module: MOD-runtimes
// guards: NO MODEL READS A CREDENTIAL; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: the job workflow jobWorkflowFiles writes on GitHub for an instance at a commit, the token AGENT_M_TOKEN, the key FIXTURE_KEY and the self-hosted runner gpu
// input: the text of .github/workflows/agent-m-jobs.yml
// expect: every agent's job — hosted-agent-0, hosted-agent-1, runner-gpu-agent-0, runner-gpu-agent-1 — checks out the product and the instance with `persist-credentials:
//   false` on each of its two checkouts (two checkouts, two such lines), so that no token stays in their .git/config; every agent's job, the hosted and the self-hosted
//   runner's, names the model's user `AGENT_M_MODEL_USER: "agent-m-model"` (a self-hosted runner separates where it can, separationOf); counter-proof: the job that writes,
//   hosted, keeps its token on both checkouts (`token: ${{ secrets.AGENT_M_TOKEN }}`), has no `persist-credentials: false`, since it pushes, and names no model's user
test("TST-1243001: the agent's machine checks out without keeping a token, and every agent's job names the model's user", () => {
  const [file] = jobWorkflowFiles("github", INSTANCE, SECRETS, ["gpu"]);
  const jobs = jobsOf(file.text);
  for (const id of ["hosted-agent-0", "hosted-agent-1", "runner-gpu-agent-0", "runner-gpu-agent-1"]) {
    assert.ok(jobs[id], `the job ${id} is written`);
    assert.equal(count(jobs[id], /uses: actions\/checkout@v4/g), 2, `${id} checks out the product and the instance`);
    assert.equal(count(jobs[id], /^ {10}persist-credentials: false$/gm), 2, `${id} keeps no token in either checkout`);
  }
  for (const id of ["hosted-agent-0", "hosted-agent-1", "runner-gpu-agent-0", "runner-gpu-agent-1"]) assert.match(jobs[id], /^ {6}AGENT_M_MODEL_USER: "agent-m-model"$/m);
  assert.doesNotMatch(jobs.hosted, /AGENT_M_MODEL_USER/, "counter-proof: the job that writes names no model's user");
  assert.equal(count(jobs.hosted, /token: \$\{\{ secrets\.AGENT_M_TOKEN \}\}/g), 2, "counter-proof: the job that writes checks out with the token");
  assert.equal(count(jobs.hosted, /persist-credentials/g), 0, "counter-proof: the job that writes keeps its token");
});

// A fake endpoint on this machine that records every request it receives and answers `{"ok":true}`.
async function fakeEndpoint(t) {
  const seen = [];
  const server = createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      seen.push({ method: request.method, url: request.url, headers: request.headers, body: Buffer.concat(chunks).toString("utf8") });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ ok: true }));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { address: `http://127.0.0.1:${server.address().port}`, seen };
}

// TST-1243002 · level: unit · module: MOD-endpoint-calls
// guards: NO MODEL READS A CREDENTIAL; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: a fake endpoint on 127.0.0.1 under the base address <fake>/v1; a key holder for an OpenAI-compatible endpoint there with the key KEY, and one for an Anthropic endpoint there with the same key
// input: POST <holder>/chat/completions with the body {"model":"m"} and the forged header `Authorization: Bearer forged`; POST <anthropic holder>/messages with the body {"model":"m"} and no key header
// expect: the fake endpoint receives POST /v1/chat/completions with `authorization: Bearer KEY` and the body unchanged, and POST /v1/messages with `x-api-key: KEY` and
//   no authorization header; each caller gets status 200 and the body {"ok":true}, which holds no key; the holder's address is http://127.0.0.1:<port>; counter-proof
//   of the check: the request that reaches the endpoint carries the key
test("TST-1243002: the key holder adds the key, in the endpoint kind's header, to each request it forwards to its endpoint", async (t) => {
  const fake = await fakeEndpoint(t);
  const openai = await holdKey({ kind: "openai-compatible", baseUrl: `${fake.address}/v1`, key: KEY });
  t.after(() => openai.close());
  const anthropic = await holdKey({ kind: "anthropic", baseUrl: `${fake.address}/v1/`, key: KEY });
  t.after(() => anthropic.close());
  assert.match(openai.address, /^http:\/\/127\.0\.0\.1:\d+$/);
  const first = await fetch(`${openai.address}/chat/completions`, { method: "POST", headers: { "content-type": "application/json", Authorization: "Bearer forged" }, body: '{"model":"m"}' });
  assert.equal(first.status, 200);
  const answered = await first.text();
  assert.equal(answered, '{"ok":true}');
  assert.equal(answered.includes(KEY), false, "the answer holds no key");
  const second = await fetch(`${anthropic.address}/messages`, { method: "POST", headers: { "content-type": "application/json" }, body: '{"model":"m"}' });
  assert.equal(second.status, 200);
  assert.equal(fake.seen.length, 2);
  assert.equal(fake.seen[0].method, "POST");
  assert.equal(fake.seen[0].url, "/v1/chat/completions");
  assert.equal(fake.seen[0].headers.authorization, `Bearer ${KEY}`, "counter-proof: the endpoint receives the key");
  assert.equal(fake.seen[0].body, '{"model":"m"}');
  assert.equal(fake.seen[1].url, "/v1/messages");
  assert.equal(fake.seen[1].headers["x-api-key"], KEY);
  assert.equal(fake.seen[1].headers.authorization, undefined);
});

// One raw HTTP request to the holder, as a caller that writes its own request line: -> the status code the holder answers.
function rawRequest(address, line) {
  const { hostname, port } = new URL(address);
  return new Promise((resolve, reject) => {
    const socket = connect(Number(port), hostname, () => socket.write(`${line}\r\nHost: ${hostname}:${port}\r\nConnection: close\r\n\r\n`));
    let answer = "";
    socket.on("data", (chunk) => { answer += chunk; });
    socket.on("end", () => resolve(Number(/^HTTP\/1\.1 (\d{3})/.exec(answer)?.[1] ?? 0)));
    socket.on("error", reject);
  });
}

// TST-1243003 · level: unit · module: MOD-endpoint-calls
// guards: NO MODEL READS A CREDENTIAL
// given: a fake endpoint, and a second fake server `elsewhere`, both on 127.0.0.1; a key holder with the key KEY for the endpoint <fake>/v1
// input: raw requests to the holder with the request targets http://127.0.0.1:<elsewhere>/steal, //127.0.0.1:<elsewhere>/steal and @127.0.0.1:<elsewhere>/steal; then /models as the known positive
// expect: the holder answers each of the three with status 400 and `elsewhere` receives no request; the known positive is answered 200 and reaches the endpoint as
//   GET /v1/models with the key
test("TST-1243003: the key holder sends the key to its endpoint only, whatever address a caller names", async (t) => {
  const fake = await fakeEndpoint(t);
  const elsewhere = await fakeEndpoint(t);
  const holder = await holdKey({ kind: "openai-compatible", baseUrl: `${fake.address}/v1`, key: KEY });
  t.after(() => holder.close());
  const other = elsewhere.address.slice("http://".length);
  for (const target of [`http://${other}/steal`, `//${other}/steal`, `@${other}/steal`]) {
    assert.equal(await rawRequest(holder.address, `GET ${target} HTTP/1.1`), 400, `${target} is refused`);
  }
  assert.equal(elsewhere.seen.length, 0, "no request reaches another server");
  assert.equal(await rawRequest(holder.address, "GET /models HTTP/1.1"), 200, "known positive: a path of the endpoint is forwarded");
  assert.equal(fake.seen.at(-1).url, "/v1/models");
  assert.equal(fake.seen.at(-1).headers.authorization, `Bearer ${KEY}`);
});

// The agent's machine of a hosted run that a hand-over to a model endpoint started, as the job workflow gives it: its key, the names of its secrets, the model's user.
const MACHINE = {
  PATH: "/opt/hostedtoolcache/node/22.0.0/x64/bin:/usr/bin:/bin", GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_EVENT_PATH: "/home/runner/work/_temp/_github_workflow/event.json", GITHUB_WORKSPACE: "/home/runner/work/product/product",
  GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "alice/product", GITHUB_REF_NAME: "main", GITHUB_SHA: "b".repeat(40), GITHUB_RUN_ID: "4711",
  GITHUB_ACTOR: "alice", GITHUB_STEP_SUMMARY: "/home/runner/work/_temp/_runner_file_commands/step_summary_1", GITHUB_TOKEN: TOKEN,
  AGENT_M_RUNNER: "hosted", AGENT_M_PART: "agent", AGENT_M_PRODUCT_DIR: "/home/runner/work/product/product/product",
  AGENT_M_RESULT_DIR: "/home/runner/work/product/product/result", AGENT_M_KEY_NAMES: "FIXTURE_KEY OTHER_KEY", AGENT_M_KEY: "1", FIXTURE_KEY: KEY,
  AGENT_M_MODEL_USER: "agent-m-model", AGENT_M_TOKEN: TOKEN,
};
const INPUTS = { job: "JOB-20261027-0900-a1b2", task: "fix the sum", endpoint: JSON.stringify({ kind: "openai-compatible", baseUrl: "https://llm.example.test/v1", model: "m" }), secret: "FIXTURE_KEY" };
// That machine's environment with its event's payload `inputs` written to the file GITHUB_EVENT_PATH names, and the CiEnvironment an entry reads from it.
function machine(t, given, inputs) {
  const folder = mkdtempSync(join(tmpdir(), "agent-m-event-"));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const env = { ...given, GITHUB_EVENT_PATH: join(folder, "event.json") };
  writeFileSync(env.GITHUB_EVENT_PATH, JSON.stringify({ inputs }));
  return { env, at: (name) => ciEnvironment(name, env, new Date("2026-10-27T09:00:00Z")) };
}

// TST-1243004 · level: unit · module: MOD-workflow-entries
// guards: NO MODEL READS A CREDENTIAL; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: the hosted agent's machine above (the key FIXTURE_KEY in its environment, GITHUB_TOKEN and AGENT_M_TOKEN as stand-ins for any token, the model's user agent-m-model), a key holder at http://127.0.0.1:45678, node at /opt/node/bin/node, the committer alice <1+alice@users.noreply.github.com>
// input: separates for onDispatch of a hand-over to a model endpoint; modelUserCommands for that machine and its entry onDispatch
// expect: separates is true; it is false for leaveResult, for a start without `endpoint`, on the writing machine (AGENT_M_PART write), on a route without a model's user
//   (AGENT_M_MODEL_USER empty) and on the model's user's own side (AGENT_M_KEY_HOLDER set, AGENT_M_MODEL_USER not); the user is made with `useradd --create-home --home-dir
//   /home/agent-m-model --user-group --shell /bin/bash agent-m-model` and no other group, so that it may not use sudo; the entry runs as `sudo -n -u agent-m-model --
//   /usr/bin/env -i …` with node and /home/agent-m-model/instance/src/workflow-entries/main.mjs onDispatch; no argument of any command holds the key's or the token's
//   value or sets FIXTURE_KEY, OTHER_KEY, GITHUB_TOKEN, AGENT_M_TOKEN or AGENT_M_MODEL_USER; the entry's variables name the holder (AGENT_M_KEY_HOLDER), the model's
//   user's home as GITHUB_WORKSPACE and HOME, its product, result, event and summary there, and the committer; the product's checkout, the instance's checkout and the
//   event are copied there, and the home is given to the user; the files of the result and the summary are read back as that user; the user's processes are ended
test("TST-1243004: a hand-over to a model endpoint runs as the model's user, whose command holds no key and no token", (t) => {
  const { env, at } = machine(t, MACHINE, INPUTS);
  assert.equal(separates("onDispatch", at("onDispatch")), true);
  assert.equal(separates("leaveResult", at("leaveResult")), false, "leaveResult runs where the workflow runs it");
  assert.equal(separates("onDispatch", machine(t, MACHINE, { job: INPUTS.job }).at("onDispatch")), false, "a start of a recorded job without an endpoint");
  assert.equal(separates("onDispatch", machine(t, { ...MACHINE, AGENT_M_PART: "write" }, INPUTS).at("onDispatch")), false, "the writing machine");
  assert.equal(separates("onDispatch", machine(t, { ...MACHINE, AGENT_M_MODEL_USER: "" }, INPUTS).at("onDispatch")), false, "a self-hosted runner");
  const own = { ...MACHINE, AGENT_M_KEY_HOLDER: "http://127.0.0.1:45678" };
  delete own.AGENT_M_MODEL_USER;
  assert.equal(separates("onDispatch", machine(t, own, INPUTS).at("onDispatch")), false, "the model's user's own side");

  const commands = modelUserCommands({ user: "agent-m-model", env, ci: at("onDispatch"), holder: "http://127.0.0.1:45678", execPath: "/opt/node/bin/node",
    identity: { name: "alice", email: "1+alice@users.noreply.github.com" } });
  const home = "/home/agent-m-model";
  assert.equal(commands.home, home);
  const [command, args] = commands.entry("onDispatch");
  assert.equal(command, "sudo");
  assert.deepEqual(args.slice(0, 6), ["-n", "-u", "agent-m-model", "--", "/usr/bin/env", "-i"]);
  assert.deepEqual(args.slice(-3), ["/opt/node/bin/node", `${home}/instance/src/workflow-entries/main.mjs`, "onDispatch"]);
  const variables = Object.fromEntries(args.slice(6, -3).map((each) => [each.slice(0, each.indexOf("=")), each.slice(each.indexOf("=") + 1)]));
  assert.equal(variables.AGENT_M_KEY_HOLDER, "http://127.0.0.1:45678");
  assert.equal(variables.HOME, home);
  assert.equal(variables.GITHUB_WORKSPACE, home);
  assert.equal(variables.AGENT_M_PRODUCT_DIR, `${home}/product`);
  assert.equal(variables.AGENT_M_RESULT_DIR, `${home}/result`);
  assert.equal(variables.GITHUB_EVENT_PATH, `${home}/event.json`);
  assert.equal(variables.GITHUB_STEP_SUMMARY, `${home}/summary.md`);
  assert.equal(variables.AGENT_M_PART, "agent");
  assert.equal(variables.AGENT_M_KEY_NAMES, "FIXTURE_KEY OTHER_KEY", "the names of the keys, not their values");
  assert.equal(variables.PATH, MACHINE.PATH);
  assert.equal(variables.GIT_AUTHOR_NAME, "alice");
  assert.equal(variables.GIT_COMMITTER_EMAIL, "1+alice@users.noreply.github.com");
  for (const name of ["FIXTURE_KEY", "OTHER_KEY", "GITHUB_TOKEN", "AGENT_M_TOKEN", "AGENT_M_MODEL_USER"]) assert.equal(Object.hasOwn(variables, name), false, `${name} is not set`);

  const all = [...commands.prepare, commands.entry("onDispatch"), commands.entry("leaveResult"), commands.stop, commands.read(`${home}/result/out/result.json`)];
  for (const [, each] of all) {
    for (const arg of each) {
      assert.equal(arg.includes(KEY) || arg.includes(TOKEN), false, `no argument holds a credential: ${arg}`);
      assert.doesNotMatch(arg, /^(FIXTURE_KEY|OTHER_KEY|GITHUB_TOKEN|AGENT_M_TOKEN)=/);
    }
  }
  assert.deepEqual(commands.prepare, [
    ["sudo", ["-n", "useradd", "--create-home", "--home-dir", home, "--user-group", "--shell", "/bin/bash", "agent-m-model"]],
    ["sudo", ["-n", "cp", "-a", MACHINE.AGENT_M_PRODUCT_DIR, `${home}/product`]],
    ["sudo", ["-n", "cp", "-a", `${MACHINE.GITHUB_WORKSPACE}/instance`, `${home}/instance`]],
    ["sudo", ["-n", "cp", env.GITHUB_EVENT_PATH, `${home}/event.json`]],
    ["sudo", ["-n", "mkdir", "-p", `${home}/result`]],
    ["sudo", ["-n", "chown", "-R", "agent-m-model:agent-m-model", home]],
  ]);
  assert.deepEqual(commands.stop, ["sudo", ["-n", "pkill", "-KILL", "-u", "agent-m-model"]]);
  assert.deepEqual(commands.read(`${home}/summary.md`), ["sudo", ["-n", "-u", "agent-m-model", "--", "cat", `${home}/summary.md`]]);
});

// A checkout with one file and two links that lead out of it — one to a file, one to a folder —, and the file outside that stands for the driver's environment.
function linked(t) {
  const base = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-links-")));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const root = join(base, "checkout");
  mkdirSync(root);
  execFileSync("git", ["init", "-q", root]);
  writeFileSync(join(base, "environ"), `FIXTURE_KEY=${KEY}\n`);
  mkdirSync(join(base, "proc"));
  writeFileSync(join(base, "proc", "environ"), `FIXTURE_KEY=${KEY}\n`);
  writeFileSync(join(root, "inside.txt"), "FIXTURE_VISIBLE=seen-inside\n");
  symlinkSync(join(base, "environ"), join(root, "environ-link"));
  symlinkSync(join(base, "proc"), join(root, "proc-link"));
  return { root, context: { product: { checkout: root } } };
}

// TST-1243005 · level: unit · module: MOD-checkout-tools
// guards: NO MODEL READS A CREDENTIAL
// given: a git checkout holding inside.txt (FIXTURE_VISIBLE=seen-inside) and links a command could make: environ-link to a file outside holding the key, proc-link to a folder outside whose file environ holds it, on Linux also self-link to /proc/self/environ of the process running the tools, whose environment then holds the key
// input: read, write, edit and grep with the path of each link; grep and glob over the whole checkout for `FIXTURE_`
// expect: read, write, edit and grep of environ-link and of proc-link/environ answer `refused: … is outside the checkout …`; grep over the checkout answers
//   inside.txt's line (the known positive) and no line that holds the key, naming environ-link (and self-link) as outside the checkout; glob answers paths only; no answer
//   holds the key, and the file outside still holds it unchanged
test("TST-1243005: the tools that read in the driver's process refuse every link that leads out of the checkout", async (t) => {
  const { root, context } = linked(t);
  const { tools } = checkoutStrategies({ hidden: [] });
  const linux = existsSync("/proc/self/environ");
  if (linux) symlinkSync("/proc/self/environ", join(root, "self-link"));
  const saved = process.env.FIXTURE_KEY;
  process.env.FIXTURE_KEY = KEY;
  t.after(() => { if (saved === undefined) delete process.env.FIXTURE_KEY; else process.env.FIXTURE_KEY = saved; });
  const answers = [];
  for (const path of ["environ-link", "proc-link/environ", ...(linux ? ["self-link"] : [])]) {
    for (const answer of [await tools.read({ path }, context), await tools.write({ path, content: "x" }, context),
      await tools.edit({ path, oldString: "FIXTURE_KEY", newString: "X" }, context), await tools.grep({ pattern: "FIXTURE_", path }, context)]) {
      assert.match(answer, /^refused: .* is outside the checkout /, `${path}: ${answer}`);
      answers.push(answer);
    }
  }
  const searched = await tools.grep({ pattern: "FIXTURE_" }, context);
  assert.match(searched, /inside\.txt:\n {2}Line 1: FIXTURE_VISIBLE=seen-inside/, "known positive: grep reads the checkout's files");
  assert.match(searched, /refused: environ-link is outside the checkout /);
  answers.push(searched, await tools.glob({ pattern: "**/*" }, context));
  for (const answer of answers) assert.equal(answer.includes(KEY), false, `no answer holds the key: ${answer}`);
  assert.equal(readFileSync(join(root, "..", "environ"), "utf8"), `FIXTURE_KEY=${KEY}\n`, "the file outside is unchanged");
});

// ---------------------------------------------------------------- a coding agent's CLI, GitLab, and where a runner can separate

const PLACEHOLDER = "agent-m-key-holder";
const PARTICIPANT = { name: "ci-cli", type: "CI agent", model: "fixture", context: 1, price: null, capabilities: ["draft text"], place: "fixture",
  route: "ci runner:gpu secret ANTHROPIC_API_KEY" };
const PROMPT = { prompt: "Fix the sum.", parts: [], output: null, findings: [], previous: null, workdir: null };
const installed = (name) => ({ name, installed: true, version: "1.0.0", loggedIn: false, login: `${name} login`,
  install: { macos: "https://example.test/mac", windows: "https://example.test/windows", linux: "https://example.test/linux" } });

// A folder of controlled CLIs: each notes its arguments, the variables it was given and whether any of its variables holds KEY; claude also sends one request to
// `$ANTHROPIC_BASE_URL/v1/messages` with `x-api-key: $ANTHROPIC_API_KEY`, as the CLI does, and notes the status the endpoint answered.
function clis(t) {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-clis-")));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const record = join(folder, "record.jsonl");
  const note = (name, request = "const status = null;") => `
    import { appendFileSync } from "node:fs";
    const args = process.argv.slice(2);
    let stdin = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) stdin += chunk;
    ${request}
    appendFileSync(${JSON.stringify(record)}, JSON.stringify({ name: ${JSON.stringify(name)}, args, status, env: { ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL ?? null,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? null, CODEX_API_KEY: process.env.CODEX_API_KEY ?? null },
      holdsKey: Object.values(process.env).some((value) => String(value).includes(${JSON.stringify(KEY)})) }) + "\\n");
  `;
  const program = {
    claude: note("claude", `const status = process.env.ANTHROPIC_BASE_URL ? (await fetch(process.env.ANTHROPIC_BASE_URL + "/v1/messages", { method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "content-type": "application/json" }, body: "{}" })).status : null;`)
      + `process.stdout.write(JSON.stringify({ type: "result", result: "ok", usage: { input_tokens: 1, output_tokens: 1 } }) + "\\n");`,
    codex: `${note("codex")}process.stdout.write("ok\\n");`,
    opencode: `${note("opencode")}process.stdout.write(JSON.stringify({ type: "text", part: { text: "ok" } }) + "\\n");`,
  };
  for (const [name, text] of Object.entries(program)) {
    writeFileSync(join(folder, `${name}.mjs`), text);
    writeFileSync(join(folder, name), `#!/bin/sh\nexec '${process.execPath}' '${join(folder, `${name}.mjs`)}' "$@"\n`, { mode: 0o755 });
  }
  return { folder, notes: () => (existsSync(record) ? readFileSync(record, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : []) };
}
// `values` set in this process's environment while `run` runs; undefined removes a variable.
async function withEnvironment(values, run) {
  const before = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  try {
    for (const [name, value] of Object.entries(values)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
    return await run();
  } finally {
    for (const [name, value] of Object.entries(before)) if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
}

// TST-1243007 · level: component · module: MOD-agent-processes
// guards: NO MODEL READS A CREDENTIAL; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: controlled claude, codex and opencode on PATH; a fake endpoint, and a key holder for it of the kind anthropic with KEY; CI=true and, as a variable the CLI could inherit, ANTHROPIC_API_KEY=KEY
// input: agentDriver for claude with keyVariable ANTHROPIC_API_KEY and keyHolder the holder's address, send; the same for codex (keyVariable CODEX_API_KEY) and for opencode; then claude without keyHolder, as the counter-proof of the check
// expect: claude is started with its task's arguments only, ANTHROPIC_BASE_URL the holder's address and ANTHROPIC_API_KEY the placeholder `agent-m-key-holder`, and no
//   variable of it holds KEY; its request reaches the fake endpoint as POST /v1/messages with `x-api-key: KEY` and is answered 200 (counter-proof: the endpoint receives the
//   key); codex is started with `-c openai_base_url="<holder>"` before `exec -`, CODEX_API_KEY the placeholder and no variable holding KEY; opencode, which names no key
//   variable and no provider, is refused with KeyHolderUnsupported and not started; without keyHolder, claude's variables hold KEY — the gap this test closes
test("TST-1243007: a coding agent's CLI reaches its provider through the key holder, with a placeholder for its key", async (t) => {
  const { folder, notes } = clis(t);
  const fake = await fakeEndpoint(t);
  const holder = await holdKey({ kind: "anthropic", baseUrl: fake.address, key: KEY });
  t.after(() => holder.close());
  const send = (name, keyVariable, keyHolder) => agentDriver(installed(name), { workdir: folder, keyVariable, keyHolder }, PARTICIPANT).send({ ...PROMPT, workdir: folder });
  await withEnvironment({ PATH: `${folder}:/usr/bin:/bin`, CI: "true", ANTHROPIC_API_KEY: KEY }, async () => {
    await send("claude", "ANTHROPIC_API_KEY", holder.address);
    await send("codex", "CODEX_API_KEY", holder.address);
    await assert.rejects(send("opencode", "ANTHROPIC_API_KEY", holder.address), { name: "KeyHolderUnsupported" });
    await send("claude", "ANTHROPIC_API_KEY", null);
  });
  const [claude, codex, unheld, ...rest] = notes();
  assert.equal(rest.length, 0, "opencode was not started");
  assert.equal(claude.name, "claude");
  assert.deepEqual(claude.args, ["-p", "--output-format", "json"]);
  assert.equal(claude.env.ANTHROPIC_BASE_URL, holder.address);
  assert.equal(claude.env.ANTHROPIC_API_KEY, PLACEHOLDER);
  assert.equal(claude.holdsKey, false, "no variable of the CLI holds the key");
  assert.equal(claude.status, 200);
  assert.equal(fake.seen.length, 1);
  assert.equal(fake.seen[0].url, "/v1/messages");
  assert.equal(fake.seen[0].headers["x-api-key"], KEY, "counter-proof: the endpoint receives the key");
  assert.equal(codex.name, "codex");
  assert.deepEqual(codex.args, ["-c", `openai_base_url="${holder.address}"`, "exec", "-"]);
  assert.equal(codex.env.CODEX_API_KEY, PLACEHOLDER);
  assert.equal(codex.holdsKey, false);
  assert.equal(unheld.name, "claude");
  assert.equal(unheld.holdsKey, true, "counter-proof of the check: without the holder the CLI inherits the key");
});

// The agent's machine of a self-hosted runner whose participant is a coding agent: the key ANTHROPIC_API_KEY, the second key CODEX_API_KEY, the model's user named.
const CLI_MACHINE = { ...MACHINE, AGENT_M_RUNNER: "gpu", AGENT_M_KEY_NAMES: "ANTHROPIC_API_KEY CODEX_API_KEY", AGENT_M_KEY: "1", ANTHROPIC_API_KEY: KEY, GITHUB_EVENT_NAME: "push" };
delete CLI_MACHINE.FIXTURE_KEY;

// TST-1243008 · level: unit · module: MOD-workflow-entries
// guards: NO MODEL READS A CREDENTIAL; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: the agent's machine above, given the key ANTHROPIC_API_KEY (KEY); the same machine given the second key, CODEX_API_KEY; the hosted machine of TST-1243004, whose key FIXTURE_KEY is no CLI's key variable
// input: separates and heldOf for onRecordsChanged and for onDispatch of a recorded job (input `job` only); heldOf for a hand-over to an endpoint; keyAvailable on the model's user's side (AGENT_M_KEY_HOLDER set, no key's value) and on the machine's
// expect: with ANTHROPIC_API_KEY both entries separate and the holder is for { kind anthropic, baseUrl https://api.anthropic.com, key KEY }; with CODEX_API_KEY for
//   { kind openai-compatible, baseUrl https://api.openai.com/v1 }; a hand-over's input `endpoint` takes precedence; with FIXTURE_KEY and no endpoint neither separates
//   and heldOf is null; leaveResult and the writing machine never separate; on the model's user's side keyAvailable is true for the machine's key only, the holder
//   holding it, and on the machine true where the variable holds a value
test("TST-1243008: a run of a coding agent whose key a CLI reads runs as the model's user, beside a key holder for that CLI's provider", (t) => {
  const anthropic = machine(t, CLI_MACHINE, {});
  assert.equal(separates("onRecordsChanged", anthropic.at("onRecordsChanged")), true);
  const recorded = machine(t, { ...CLI_MACHINE, GITHUB_EVENT_NAME: "workflow_dispatch" }, { job: INPUTS.job });
  assert.equal(separates("onDispatch", recorded.at("onDispatch")), true);
  assert.deepEqual(heldOf(recorded.at("onDispatch")), { kind: "anthropic", baseUrl: "https://api.anthropic.com", key: KEY });
  const codex = machine(t, { ...CLI_MACHINE, AGENT_M_KEY: "2", CODEX_API_KEY: KEY, ANTHROPIC_API_KEY: "" }, {});
  assert.deepEqual(heldOf(codex.at("onRecordsChanged")), { kind: "openai-compatible", baseUrl: "https://api.openai.com/v1", key: KEY });
  const handOver = machine(t, { ...CLI_MACHINE, GITHUB_EVENT_NAME: "workflow_dispatch" }, { ...INPUTS, secret: "ANTHROPIC_API_KEY" });
  assert.deepEqual(heldOf(handOver.at("onDispatch")), { kind: "openai-compatible", baseUrl: "https://llm.example.test/v1", key: KEY }, "the hand-over's endpoint");
  const fixture = machine(t, { ...MACHINE, GITHUB_EVENT_NAME: "push" }, {});
  assert.equal(separates("onRecordsChanged", fixture.at("onRecordsChanged")), false, "a key no CLI reads");
  assert.equal(heldOf(fixture.at("onRecordsChanged")), null);
  assert.equal(separates("leaveResult", anthropic.at("leaveResult")), false);
  assert.equal(separates("onRecordsChanged", machine(t, { ...CLI_MACHINE, AGENT_M_PART: "write" }, {}).at("onRecordsChanged")), false, "the writing machine");

  const side = { ...CLI_MACHINE, AGENT_M_KEY_HOLDER: "http://127.0.0.1:45678" };
  delete side.AGENT_M_MODEL_USER;
  delete side.ANTHROPIC_API_KEY;
  const own = machine(t, side, {}).at("onRecordsChanged");
  assert.equal(separates("onRecordsChanged", own), false, "the model's user's own side does not split again");
  assert.equal(keyAvailable(own.job, "ANTHROPIC_API_KEY"), true, "the holder holds the machine's key");
  assert.equal(keyAvailable(own.job, "CODEX_API_KEY"), false);
  assert.equal(keyAvailable(anthropic.at("onRecordsChanged").job, "ANTHROPIC_API_KEY"), true);
  assert.equal(keyAvailable(anthropic.at("onRecordsChanged").job, "CODEX_API_KEY"), false);
});

// The agent's job of a GitLab pipeline the API started, in a container that runs as root: its variables, among them GitLab's tokens.
const GITLAB = {
  PATH: "/usr/local/bin:/usr/bin:/bin", CI: "true", GITLAB_CI: "true", CI_PIPELINE_SOURCE: "api", CI_PROJECT_DIR: "/builds/alice/thesis-tool",
  CI_PROJECT_URL: "https://gitlab.example.test/alice/thesis-tool", CI_COMMIT_REF_NAME: "main", CI_COMMIT_SHA: "c".repeat(40),
  CI_PIPELINE_URL: "https://gitlab.example.test/alice/thesis-tool/-/pipelines/7", GITLAB_USER_LOGIN: "alice",
  CI_JOB_TOKEN: TOKEN, CI_REGISTRY_PASSWORD: TOKEN, CI_DEPENDENCY_PROXY_PASSWORD: TOKEN,
  AGENT_M_RUNNER: "hosted", AGENT_M_PART: "agent", AGENT_M_PRODUCT_DIR: "/builds/alice/thesis-tool", AGENT_M_RESULT_DIR: "/builds/alice/agent-m-result",
  AGENT_M_KEY_NAMES: "FIXTURE_KEY", AGENT_M_KEY: "1", FIXTURE_KEY: KEY, AGENT_M_MODEL_USER: "agent-m-model",
  AGENT_M_INPUT_JOB: INPUTS.job, AGENT_M_INPUT_TASK: INPUTS.task, AGENT_M_INPUT_ENDPOINT: INPUTS.endpoint, AGENT_M_INPUT_SECRET: "FIXTURE_KEY",
};

// TST-1243009 · level: unit · module: MOD-workflow-entries
// guards: NO MODEL READS A CREDENTIAL
// given: the GitLab agent's job above, run as root (no sudo), a key holder at http://127.0.0.1:45678, node at /usr/local/bin/node; and the hosted GitHub machine of TST-1243004, run with sudo
// input: modelUserCommands for onDispatch with `root: true`; ciEnvironment of the variables its entry is given; modelUserCommands of the GitHub machine without `root`
// expect: as root no command is sudo: the user is made with `useradd …` directly, the entry and every read run as `runuser -u agent-m-model -- …`; `clear`, run before and
//   after, ends the user's processes and removes the user (`pkill -KILL -u`, `userdel --force --remove`); no event file is copied; the folder that holds the project's clone
//   and GitLab's files beside it, /builds/alice, is closed to every other user (chmod 0700, the last step of `prepare`; `closes` names it, `close(mode)` sets it back);
//   the entry is given CI_PROJECT_DIR and AGENT_M_PRODUCT_DIR <home>/product, AGENT_M_RESULT_DIR <home>/result, GITLAB_CI, the pipeline's source, the inputs
//   AGENT_M_INPUT_* and the holder, and none of CI_JOB_TOKEN, CI_REGISTRY_PASSWORD, CI_DEPENDENCY_PROXY_PASSWORD, FIXTURE_KEY, AGENT_M_MODEL_USER, GITHUB_WORKSPACE,
//   GITHUB_EVENT_PATH; no argument of any command holds KEY or TOKEN; the CiEnvironment that side reads has the checkout <home>/product, the instance <home>/instance, the
//   inputs unchanged, no key's value and the holder, and does not split again; on GitHub with sudo, `clear` is the same two commands under `sudo -n` and no folder is closed
test("TST-1243009: in a GitLab job that runs as root, the model's user is made and run without sudo, and gets no GitLab token", (t) => {
  const ci = ciEnvironment("onDispatch", GITLAB, new Date("2026-10-27T09:00:00Z"));
  assert.equal(separates("onDispatch", ci), true);
  const home = "/home/agent-m-model";
  const commands = modelUserCommands({ user: "agent-m-model", env: GITLAB, ci, holder: "http://127.0.0.1:45678", execPath: "/usr/local/bin/node",
    identity: { name: "alice", email: "alice@example.test" }, root: true });
  const all = [...commands.clear, ...commands.prepare, commands.entry("onDispatch"), commands.entry("leaveResult"), commands.read(`${home}/result/out/result.json`),
    commands.close(0o755)];
  for (const [command, args] of all) {
    assert.notEqual(command, "sudo");
    for (const arg of args) assert.equal(arg.includes(KEY) || arg.includes(TOKEN), false, `no argument holds a credential: ${arg}`);
  }
  assert.deepEqual(commands.clear, [["pkill", ["-KILL", "-u", "agent-m-model"]], ["userdel", ["--force", "--remove", "agent-m-model"]]]);
  assert.deepEqual(commands.prepare, [
    ["useradd", ["--create-home", "--home-dir", home, "--user-group", "--shell", "/bin/bash", "agent-m-model"]],
    ["cp", ["-a", "/builds/alice/thesis-tool", `${home}/product`]],
    ["cp", ["-a", "/builds/alice/instance", `${home}/instance`]],
    ["mkdir", ["-p", `${home}/result`]],
    ["chown", ["-R", "agent-m-model:agent-m-model", home]],
    ["chmod", ["0700", "/builds/alice"]],
  ]);
  assert.equal(commands.closes, "/builds/alice");
  assert.deepEqual(commands.close(0o755), ["chmod", ["0755", "/builds/alice"]]);
  assert.deepEqual(commands.read(`${home}/summary.md`), ["runuser", ["-u", "agent-m-model", "--", "cat", `${home}/summary.md`]]);
  const [command, args] = commands.entry("onDispatch");
  assert.equal(command, "runuser");
  assert.deepEqual(args.slice(0, 5), ["-u", "agent-m-model", "--", "/usr/bin/env", "-i"]);
  assert.deepEqual(args.slice(-3), ["/usr/local/bin/node", `${home}/instance/src/workflow-entries/main.mjs`, "onDispatch"]);
  const variables = Object.fromEntries(args.slice(5, -3).map((each) => [each.slice(0, each.indexOf("=")), each.slice(each.indexOf("=") + 1)]));
  assert.equal(variables.CI_PROJECT_DIR, `${home}/product`);
  assert.equal(variables.AGENT_M_PRODUCT_DIR, `${home}/product`);
  assert.equal(variables.AGENT_M_RESULT_DIR, `${home}/result`);
  assert.equal(variables.GITLAB_CI, "true");
  assert.equal(variables.CI_PIPELINE_SOURCE, "api");
  assert.equal(variables.AGENT_M_INPUT_TASK, INPUTS.task);
  assert.equal(variables.AGENT_M_KEY_HOLDER, "http://127.0.0.1:45678");
  for (const name of ["CI_JOB_TOKEN", "CI_REGISTRY_PASSWORD", "CI_DEPENDENCY_PROXY_PASSWORD", "FIXTURE_KEY", "AGENT_M_MODEL_USER", "GITHUB_WORKSPACE", "GITHUB_EVENT_PATH"]) {
    assert.equal(Object.hasOwn(variables, name), false, `${name} is not set`);
  }
  const side = ciEnvironment("onDispatch", variables, new Date("2026-10-27T09:00:00Z"));
  assert.equal(side.checkout, `${home}/product`);
  assert.equal(side.job.instanceDir, `${home}/instance`);
  assert.deepEqual(side.event.payload.inputs, { job: INPUTS.job, task: INPUTS.task, endpoint: INPUTS.endpoint, secret: "FIXTURE_KEY" });
  assert.deepEqual(side.job.keys, { FIXTURE_KEY: null });
  assert.equal(side.job.keyHolder, "http://127.0.0.1:45678");
  assert.equal(separates("onDispatch", side), false);

  const github = machine(t, MACHINE, INPUTS);
  const sudo = modelUserCommands({ user: "agent-m-model", env: github.env, ci: github.at("onDispatch"), holder: null, execPath: "/opt/node/bin/node", identity: {} });
  assert.deepEqual(sudo.clear, [["sudo", ["-n", "pkill", "-KILL", "-u", "agent-m-model"]], ["sudo", ["-n", "userdel", "--force", "--remove", "agent-m-model"]]]);
  assert.equal(sudo.closes, null, "GitHub's checkouts keep no token: no folder is closed");
});

// The jobs of a generated GitLab file by their ids, which stand at the line's start: { id: the job's lines }.
function gitlabJobsOf(text) {
  const jobs = {};
  let current = null;
  for (const line of text.split("\n")) {
    const id = /^([A-Za-z0-9_-]+):$/.exec(line)?.[1];
    if (id) { current = id; jobs[id] = []; continue; }
    if (current) jobs[current].push(line);
  }
  return Object.fromEntries(Object.entries(jobs).map(([id, lines]) => [id, lines.join("\n")]));
}

// TST-1243010 · level: unit · module: MOD-runtimes
// guards: NO MODEL READS A CREDENTIAL
// given: the job workflow jobWorkflowFiles writes on GitLab for the instance, the token AGENT_M_TOKEN, the key FIXTURE_KEY and the self-hosted runner gpu
// input: the text of .gitlab/agent-m-jobs.yml
// expect: every agent's job — agent-m-hosted-agent-0/1, agent-m-runner-gpu-agent-0/1 — names the model's user `AGENT_M_MODEL_USER: "agent-m-model"` and, before its
//   first entry runs, sets the clone's remote to the project's address without the job's token, `git remote set-url origin "$CI_PROJECT_URL.git"`; counter-proof: the
//   job that writes, agent-m-hosted, names no model's user
test("TST-1243010: GitLab's agent's job keeps no token in its clone and names the model's user", () => {
  const [file] = jobWorkflowFiles("gitlab", INSTANCE, SECRETS, ["gpu"]);
  const jobs = gitlabJobsOf(file.text);
  for (const id of ["agent-m-hosted-agent-0", "agent-m-hosted-agent-1", "agent-m-runner-gpu-agent-0", "agent-m-runner-gpu-agent-1"]) {
    assert.ok(jobs[id], `the job ${id} is written`);
    assert.match(jobs[id], /^ {4}AGENT_M_MODEL_USER: "agent-m-model"$/m, id);
    const strip = jobs[id].indexOf('    - git remote set-url origin "$CI_PROJECT_URL.git"\n');
    const entry = jobs[id].indexOf('node src/workflow-entries/main.mjs "$AGENT_M_ENTRY"');
    assert.ok(strip > 0 && entry > strip, `${id} strips the token from its clone before the entry runs`);
  }
  assert.doesNotMatch(jobs["agent-m-hosted"], /AGENT_M_MODEL_USER/, "counter-proof: the job that writes names no model's user");
});

// TST-1243011 · level: unit · module: MOD-workflow-entries
// guards: NO MODEL READS A CREDENTIAL
// given: the facts of a machine: its platform, whether its user is root, whether `sudo -n true` succeeded there
// input: separationOf for linux as root, linux with sudo, linux without either, darwin with sudo
// expect: `root`, `sudo`, null, null — the model's user is made where the machine's user is root or may use sudo without a password, on Linux; elsewhere the entry
//   runs as the machine's user, as before
test("TST-1243011: the model's user is made where the machine allows it, and only there", () => {
  assert.equal(separationOf({ platform: "linux", root: true, sudo: false }), "root");
  assert.equal(separationOf({ platform: "linux", root: false, sudo: true }), "sudo");
  assert.equal(separationOf({ platform: "linux", root: false, sudo: false }), null);
  assert.equal(separationOf({ platform: "darwin", root: false, sudo: true }), null);
});
