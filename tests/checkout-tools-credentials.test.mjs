// Module: MOD-checkout-tools
// Module: MOD-endpoint-calls
// Module: MOD-workflow-entries
// Module: MOD-runtimes
// Level: unit
// Guards: NO MODEL READS A CREDENTIAL; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// No credential that the agent's machine of a hosted job holds is readable through a tool of the model: the machine's checkouts keep no token, a hand-over to a model
// endpoint runs as the model's own user, who holds no key and may not use sudo, beside the key holder, which adds the key to each request it forwards to the run's
// endpoint and to no other, and the tools that read files in the driver's process refuse every link that leads out of the checkout. A second OS user and sudo need a
// runner: this file checks the generated workflow's text and the commands built for that user, and runs the key holder and the tools with real servers and real files
// of this machine, in temporary folders. Every expected text is stated here.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { connect } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkoutStrategies } from "../src/checkout-tools/index.mjs";
import { holdKey } from "../src/endpoint-calls/index.mjs";
import { jobWorkflowFiles } from "../src/runtimes/index.mjs";
import { ciEnvironment } from "../src/workflow-entries/compose.mjs";
import { modelUserCommands, separates } from "../src/workflow-entries/model-user.mjs";

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
//   false` on each of its two checkouts (two checkouts, two such lines), so that no token stays in their .git/config; the hosted agent's jobs name the model's user
//   `AGENT_M_MODEL_USER: "agent-m-model"`, the self-hosted runner's name none (`AGENT_M_MODEL_USER: ""`); counter-proof: the job that writes, hosted, keeps its token on
//   both checkouts (`token: ${{ secrets.AGENT_M_TOKEN }}`) and has no `persist-credentials: false`, since it pushes
test("TST-1243001: the agent's machine checks out without keeping a token, and the hosted one names the model's user", () => {
  const [file] = jobWorkflowFiles("github", INSTANCE, SECRETS, ["gpu"]);
  const jobs = jobsOf(file.text);
  for (const id of ["hosted-agent-0", "hosted-agent-1", "runner-gpu-agent-0", "runner-gpu-agent-1"]) {
    assert.ok(jobs[id], `the job ${id} is written`);
    assert.equal(count(jobs[id], /uses: actions\/checkout@v4/g), 2, `${id} checks out the product and the instance`);
    assert.equal(count(jobs[id], /^ {10}persist-credentials: false$/gm), 2, `${id} keeps no token in either checkout`);
  }
  for (const id of ["hosted-agent-0", "hosted-agent-1"]) assert.match(jobs[id], /^ {6}AGENT_M_MODEL_USER: "agent-m-model"$/m);
  for (const id of ["runner-gpu-agent-0", "runner-gpu-agent-1"]) assert.match(jobs[id], /^ {6}AGENT_M_MODEL_USER: ""$/m);
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
