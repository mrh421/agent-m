// MOD-workflow-entries' entries onDispatch and onRecordsChanged for a job whose task travels with a conversation's hand-over (ITM-498), as the accepted text
// of docs/architecture/MOD-workflow-entries.md states them: "onRecordsChanged … takes each queued job whose route is this CI service, except one whose task
// travels with its hand-over, which `onDispatch` takes"; "onDispatch … On a run a hand-over started (UC-049 4a), whose input `job` names a queued record
// whose task travels with the hand-over: takes that job and runs it with the input `task` as its instruction — for a model endpoint, the endpoint the input
// `endpoint` names, with the key from the CI secret the input `secret` names, called by Agent M's own job runner through MOD-endpoint-calls' `endpointDriver` —; it
// writes the task to no file, and a branch whose commit messages or pull request text hold the task's words is refused by name, the job then ending failed with
// nothing merged; it appends the job's end with its commits, files and pull request, and leaves the participant's answer in the run's summary and log … An endpoint
// the run cannot reach ends it `failed`, its summary naming the reason that MOD-endpoint-calls' `diagnoseEndpoint` gives and the routes that would work — a
// self-hosted runner, or a Bridge (UC-049 4d)." For UC-049 4a, 4d.
// Run: node --test tests/workflow-entries-hand-over.test.mjs
//
// Module: MOD-workflow-entries
// Guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; AN UNSUPPORTED ENDPOINT SAYS SO
// Level: component
//
// Deterministic, no network, no real agent and no real model: the product and the instance are temporary git repositories laid out as the job workflow lays them
// out (the fixture of tests/workflow-entries-job-workflow.test.mjs is the model): the model endpoint is a spy on `fetch` that answers, for the endpoint's address,
// as the case asks — a fixed draft, a refusal, or a connection that fails — and records every request; the waits between the retries of a failed request are
// shortened to nothing. The GitHub API, which the entry reaches for a pull request's facts, is a fake answering every other address. The kind is decide-gate, whose recipe `gate-inputs` and writer
// `gate-record` this file registers: the recipe gives the gate's fixture, the writer commits the gate's record, and where the case asks for it
// pushes a branch of its own with the commit message the case plants. A hand-over's task reaches a prompt only through the built-in recipe `instruction`, and a
// hand-over of a kind that takes none ends failed before the endpoint is asked (MOD-job-runner's taskRefusal; TST-8048006, with check-for-persons). decide-gate takes
// none in the catalogue, so this file gives it the slot implement's prompt has: its definition as kindOf keeps it for this program names `instruction?` first
// and its prompt holds `{{instruction}}` under `## The task as the person gave it` — the fixture of a kind that takes the task, its gate record the writer whose
// commits the cases plant. Where the module file leaves a reading open, the test states the one it takes, and the
// pull request names it:
//   - The inputs are those of the job workflow's template: `job`, `task`, `endpoint` (the JSON text of { kind, baseUrl, model }) and `secret` (a secret's name), read from the event's payload.
//   - The key of a hand-over with an endpoint is the value of the variable the input `secret` names, and no other; AGENT_M_KEY_NAMES passes it (ITM-1188: the workflow file names its keys when it is generated). A name AGENT_M_KEY_NAMES lacks is not run, naming the secret and saying that the job workflow is installed again from Settings.
//   - The answer is the draft's `answer` where it is a text, else the draft as JSON; it goes to the file GITHUB_STEP_SUMMARY names and to the log.
//   - A pull request is read by the number in the address the writer returned; its text is the title and the branch it carries, its commit messages those the
//     server lists for it.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { kindOf } from "../src/job-catalogue/index.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const entries = await import("../src/workflow-entries/main.mjs").catch((error) => ({ error }));
const { runEntry } = entries;
const REAL_GIT = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
const REAL_SLEEP = spawnSync("sh", ["-c", "command -v sleep"], { encoding: "utf8" }).stdout.trim();

// ---------------------------------------------------------------- the fixtures

const text = (...lines) => `${lines.join("\n")}\n`;
const NOW = new Date("2026-10-16T09:00:00Z");
const TOKEN = "ghp_ALICEagentMtoken0123456789abcdef";
const KEY = "sk-FIXTURE-KEY-0123456789abcdef";
const TASK = "Please widen the footer of the lending page to 960 pixels, token zebra-498";
const ANSWER = "The footer is widened, token otter-498";
const ENDPOINT = { kind: "openai-compatible", baseUrl: "https://llm.example.test/v1", model: "fixture-llm" };
const GATE_PATH = "docs/gates/GATE-fixture.md";
const NO_TASK = "the task travels with its hand-over, and this run was started without it";
const JOB = "JOB-20261016-0900-a1b2", IN_RECORD = "JOB-20261016-0901-c3d4";

const PARTICIPANTS = text("# Participants of this instance", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| hand-bot | Model endpoint | fixture-llm | 100000 | — | draft text, read the repository | GitHub's hosted runners | endpoint fixture secret FIXTURE_KEY |",
  "| ci-bot | CI agent | fixture-llm | 100000 | — | read the repository, write to the repository | GitHub's hosted runners | ci hosted secret FIXTURE_KEY |");

// The job's record names the commit of Agent M that runs — the instance's checkout is at it —, so the records are made once the instance exists.
const jobStart = (id, { agentM, participant = "hand-bot", task = "with the hand-over", params = {}, declares, kind = "decide-gate" }) => ({ id, ...(declares ? { declares } : {}), kind, worksOn: ["A LOAN HAS A DUE DATE"], participant,
  model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-16T08:00:00Z"), agentM, inputs: [], limit: 2, task,
  destinations: [{ participant, place: "GitHub's hosted runners", parts: ["gate-inputs"] }], params });

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
// A bare origin whose `main` holds `files`, and the clone of it the workflow checks out into `folder`. -> the origin's folder.
// Git starts `git maintenance run --auto --detach` after a push it receives, a commit and a fetch (git 2.55 on the CI runners). That process detaches and goes on
// writing into the repository (its lock, objects/) a moment after the command that started it has returned, so a repository removed straight after the command
// can still be written to (ENOTEMPTY). The repositories of these tests need no maintenance: it is off in each.
const NO_MAINTENANCE = ["-c", "gc.auto=0", "-c", "maintenance.auto=false", "-c", "receive.autogc=false"];
const quiet = (dir) => { for (const [key, value] of [["gc.auto", "0"], ["maintenance.auto", "false"], ["receive.autogc", "false"]]) git(dir, "config", key, value); };
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
  git(folder, "config", "user.name", "Alice Agent M token");
  git(folder, "config", "user.email", "alice@example.org");
  return origin;
}
const script = (bin, name, body) => writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });

// decide-gate as a kind that takes the task (see the head of this file): the recipe `instruction?` first, and its place in the prompt, as implement's prompt has it.
const gate = await kindOf("decide-gate");
gate.recipes = [{ name: "instruction", optional: true }, ...gate.recipes.filter((recipe) => recipe.name !== "instruction")];
gate.prompt = gate.prompt.replace("## The gate,", "## The task as the person gave it\n\nThe task, where one is given, is the work asked for, within what the inputs below allow.\n\n{{instruction}}\n\n## The gate,");

// The strategies this file gives the runner for decide-gate. The recipe gives the gate's fixture. The writer commits the gate's record through
// the product's host — or, where `plan.pullRequest` is set, as an agent would: on a branch of its own, with a commit message that holds the task when `plan.plant`
// says so, and returns the address of a pull request.
let plan = { pullRequest: false, plant: null };
let pushed = null;
registerStrategies("tests/workflow-entries-hand-over.test.mjs", {
  recipes: { "gate-inputs": async () => [{ name: "gate-inputs", text: "gate fixture checks docs/a.md.", size: 0, sources: [], required: true }] },
  writers: { "gate-record": async (result, context) => {
    const body = text("# Gate fixture", "", `decision: ${result.draft.decision}`, `reason: ${result.draft.reason}`);
    if (!plan.pullRequest && !plan.branchOnly) {
      const host = context.product.host, head = await host.readSnapshot("HEAD");
      const { commit } = await host.commitFiles({ branch: "main", expectedHead: head.commit, files: [{ path: GATE_PATH, text: body }], message: "gate fixture decided" });
      return { commits: [commit], files: [GATE_PATH], pullRequest: null, shown: null, notes: [] };
    }
    // As an agent does: its own commit on its own branch, pushed from the checkout without moving the checkout's head.
    const dir = plan.dir, branch = `agent-m/${context.jobId}`;
    const blob = spawnSync(REAL_GIT, ["hash-object", "-w", "--stdin"], { cwd: dir, input: body, encoding: "utf8" }).stdout.trim();
    const index = join(dir, ".git", "fixture-index");
    spawnSync(REAL_GIT, ["read-tree", "HEAD"], { cwd: dir, env: { ...process.env, GIT_INDEX_FILE: index } });
    spawnSync(REAL_GIT, ["update-index", "--add", "--cacheinfo", `100644,${blob},${GATE_PATH}`], { cwd: dir, env: { ...process.env, GIT_INDEX_FILE: index } });
    const tree = spawnSync(REAL_GIT, ["write-tree"], { cwd: dir, env: { ...process.env, GIT_INDEX_FILE: index }, encoding: "utf8" }).stdout.trim();
    const base = context.product.snapshot.commit;
    const message = plan.plant === "message" ? `gate fixture decided: ${context.params.instruction}` : "gate fixture decided";
    let commit = git(dir, "commit-tree", tree, "-p", plan.branchOnly ? base : "HEAD", "-m", message);
    let taskCommit = plan.plant === "message" ? commit : null;
    if (plan.history === "earlier" || plan.history === "advanced-main") {
      if (plan.history === "advanced-main") git(dir, "push", "-q", "origin", `${commit}:refs/heads/main`);
      commit = git(dir, "commit-tree", tree, "-p", commit, "-m", "finish gate fixture");
    } else if (plan.history === "merge-side") {
      taskCommit = git(dir, "commit-tree", tree, "-p", base, "-m", `side fixture: ${context.params.instruction}`);
      commit = git(dir, "commit-tree", tree, "-p", commit, "-p", taskCommit, "-m", "merge fixture side branch");
    }
    if (plan.branchOnly) git(dir, "update-ref", `refs/heads/${branch}`, commit);
    git(dir, "push", "-q", "origin", `${commit}:refs/heads/${branch}`);
    pushed = { branch, commit, base, taskCommit, message, title: plan.plant === "title" ? `Gate fixture: ${context.params.instruction}` : "Gate fixture",
      body: plan.plant === "body" ? `Gate fixture description: ${context.params.instruction}` : "Gate fixture description" };
    return { commits: [commit], files: [GATE_PATH], pullRequest: plan.branchOnly ? null : "https://github.com/alice/thesis-tool/pull/7",
      shown: plan.branchOnly ? { branch } : null, notes: [] };
  } },
});

// The fake GitHub API: the pull request 7 of the product as `pushed` describes it, with no checks, files or reviews. It answers every request the world's spy does
// not send to the model endpoint.
let github = null;
function fakeGitHub(world = null) {
  const requests = [];
  requests.histories = [];
  const json = (value) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
  github = async (address) => {
    const url = new URL(String(address));
    const path = url.pathname.replace("/repos/alice/thesis-tool", "");
    requests.push(path);
    if (world && path === "/commits") {
      const ref = url.searchParams.get("sha");
      requests.histories.push({ ref, path: url.searchParams.get("path"), perPage: url.searchParams.get("per_page"), page: url.searchParams.get("page") });
      if (pushed && ((plan.failHistory === "branch" && ref === pushed.commit) || (plan.failHistory === "base" && ref === pushed.base))) {
        const message = `fixture history unavailable: ${TASK} ${KEY} ${TOKEN}`;
        return new Response(JSON.stringify({ message }), { status: 503, statusText: message });
      }
      const commits = git(world.root, "--git-dir", world.product, "log", "--format=%H", ref).split("\n");
      const perPage = Number(url.searchParams.get("per_page")), page = Number(url.searchParams.get("page"));
      return json(commits.slice((page - 1) * perPage, page * perPage).map((sha) => ({ sha,
        parents: git(world.root, "--git-dir", world.product, "log", "-1", "--format=%P", sha).split(" ").filter(Boolean).map((parent) => ({ sha: parent })),
        commit: { message: git(world.root, "--git-dir", world.product, "log", "-1", "--format=%B", sha), author: { name: "Fixture" }, committer: { date: NOW.toISOString() } }, author: { login: "alice" } })));
    }
    if (path === "/pulls/7") return json({ number: 7, title: pushed.title, head: { ref: pushed.branch, sha: pushed.commit }, base: { ref: "main", sha: "0".repeat(40) }, state: "open",
      merged_at: null, draft: false, body: pushed.body, html_url: "https://github.com/alice/thesis-tool/pull/7", created_at: "2026-10-16T09:00:00Z", closed_at: null });
    if (path === "/pulls/7/commits") return json([{ sha: pushed.commit, commit: { message: pushed.message, committer: { date: "2026-10-16T09:00:00Z" } }, parents: [] }]);
    if (path.endsWith("/check-runs")) return json({ check_runs: [] });
    if (/\/commits\/[0-9a-f]+$/.test(path)) return json({ files: [] });
    return json([]);
  };
  return requests;
}

// The fake model endpoint of the existing path (a job whose record names its endpoint): answers as an OpenAI-compatible one does and records every request.
function fakeEndpoint() {
  const requests = [];
  globalThis.fetch = async (address, init = {}) => {
    requests.push({ address: String(address), headers: init.headers ?? {} });
    const content = JSON.stringify({ draft: { decision: "passed", reason: "from the record" }, answers: [] });
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 120, completion_tokens: 30 } }), { status: 200 });
  };
  return requests;
}

// The computer of the workflow: the PATH holds git and sleep, and no coding agent. The model endpoint at ENDPOINT.baseUrl is the spy's `endpoint`, which answers the
// fixed draft (`works`), refuses, or fails as the case asks; every other address goes to the fake GitHub API where a case set it up, and is refused otherwise.
// `records` are the queued records of the product.
async function world({ records = [], endpoint = works, baseMessage = null }, run) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-ITM-498-")));
  const workspace = join(root, "ws"), bin = join(root, "bin"), summary = join(root, "summary.md");
  mkdirSync(bin);
  script(bin, "git", `exec ${REAL_GIT} "$@"`);
  script(bin, "sleep", `exec ${REAL_SLEEP} "$@"`);
  const instance = repository(root, "instance", { "README.md": "# Instance\n", "docs/participants.md": PARTICIPANTS }, join(workspace, "instance"));
  const agentM = { version: "2026.10.0", commit: git(join(workspace, "instance"), "rev-parse", "HEAD") };
  const files = Object.fromEntries(records.map((start) => { const { path, text: body } = startRecord(jobStart(start.id, { ...start, agentM })); return [path, body]; }));
  const product = repository(root, "product", { "README.md": "# Thesis tool\n", ...files }, join(workspace, "product"));
  const productDir = join(workspace, "product");
  if (baseMessage !== null) {
    git(productDir, "commit", "--allow-empty", "-q", "-m", baseMessage);
    git(productDir, "push", "-q", "origin", "HEAD:refs/heads/main");
  }
  const head = git(productDir, "rev-parse", "HEAD");
  plan = { pullRequest: false, plant: null, dir: productDir };
  pushed = null;
  github = null;
  const lines = [];
  const writers = [process.stdout, process.stderr].map((stream) => [stream, stream.write]);
  for (const [stream, write] of writers) stream.write = (chunk, ...rest) => { lines.push(String(chunk)); return write.call(stream, chunk, ...rest); };
  const saved = { PATH: process.env.PATH, CI: process.env.CI, FIXTURE_KEY: process.env.FIXTURE_KEY, fetch: globalThis.fetch, setTimeout: globalThis.setTimeout };
  Object.assign(process.env, { PATH: bin, CI: "true", FIXTURE_KEY: KEY });
  // A failed request of the endpoint is sent again after seconds (MOD-endpoint-calls' retries); here every wait of a second or more is made at once.
  globalThis.setTimeout = (callback, ms, ...rest) => saved.setTimeout(callback, ms >= 1000 ? 0 : ms, ...rest);
  const dir = ["--git-dir", product];
  // Every request the entry makes reaches this spy and nothing else: a request to the endpoint's address is recorded and answered by `endpoint`, any other by the fake
  // GitHub API or refused, and no request leaves the machine.
  const probes = [];
  globalThis.fetch = async (address, init = {}) => {
    if (!String(address).startsWith(ENDPOINT.baseUrl)) {
      if (github) return github(address, init);
      throw new TypeError(`uncontrolled request: ${address}`);
    }
    const request = { address: String(address), headers: init.headers ?? {}, body: String(init.body ?? ""), answered: null };
    probes.push(request);
    return endpoint(request);
  };
  try {
    return await run({ root, head, productDir, product, instance, summary, probes, lines: () => lines.join("\n"), agentM,
      originText: (path, ref = "main") => spawnSync(REAL_GIT, [...dir, "show", `${ref}:${path}`], { encoding: "utf8" }).stdout,
      subjects: () => git(root, ...dir, "log", "--format=%s", "main").split("\n"),
      mainHead: () => git(root, ...dir, "rev-parse", "main"),
      mainHolds: (commit) => spawnSync(REAL_GIT, [...dir, "merge-base", "--is-ancestor", commit, "main"]).status === 0,
      // Everything the product's repository holds anywhere: every commit message, and every file at every commit of every branch.
      everything: () => git(root, ...dir, "rev-list", "--all").split("\n").filter(Boolean).map((commit) => [git(root, ...dir, "log", "-1", "--format=%B", commit),
        ...git(root, ...dir, "ls-tree", "-r", "--name-only", commit).split("\n").filter(Boolean).map((file) => git(root, ...dir, "show", `${commit}:${file}`))].join("\n")).join("\n"),
      // The requests that reached the model endpoint, and all of them as one text: what the endpoint was sent.
      starts: () => probes,
      calls: () => probes.map((request) => `${request.address}\n${JSON.stringify(request.headers)}\n${request.body}`).join("\n"),
      dispatch: (inputs, env = {}) => {
        const payload = join(root, "event.json");
        writeFileSync(payload, JSON.stringify({ inputs }));
        return runEntry("onDispatch", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_EVENT_PATH: payload, GITHUB_WORKSPACE: workspace,
          GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "alice/thesis-tool", GITHUB_REF_NAME: "main", GITHUB_SHA: agentM.commit, GITHUB_RUN_ID: "4711",
          GITHUB_ACTOR: "alice", GITHUB_STEP_SUMMARY: summary, AGENT_M_RUNNER: "hosted", AGENT_M_PRODUCT_DIR: productDir, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN",
          AGENT_M_KEY_NAMES: "FIXTURE_KEY", AGENT_M_TOKEN: TOKEN, FIXTURE_KEY: KEY, ...env }, { now: NOW });
      },
      onRecordsChanged: () => runEntry("onRecordsChanged", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_WORKSPACE: workspace, GITHUB_SERVER_URL: "https://github.com",
        GITHUB_REPOSITORY: "alice/thesis-tool", GITHUB_REF_NAME: "main", GITHUB_SHA: agentM.commit, GITHUB_RUN_ID: "4712", GITHUB_ACTOR: "alice", AGENT_M_RUNNER: "hosted",
        AGENT_M_PRODUCT_DIR: productDir, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", AGENT_M_KEY_NAMES: "FIXTURE_KEY", AGENT_M_TOKEN: TOKEN, FIXTURE_KEY: KEY }, { now: NOW }),
    });
  } finally {
    for (const [stream, write] of writers) stream.write = write;
    for (const name of ["PATH", "CI", "FIXTURE_KEY"]) { if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name]; }
    globalThis.fetch = saved.fetch;
    globalThis.setTimeout = saved.setTimeout;
    github = null;
    rmSync(root, { recursive: true, force: true });
  }
}
// An answer of the spy: the status and JSON body of a model endpoint, recorded with the request.
const answer = (status, body) => (request) => { request.answered = JSON.stringify(body); return new Response(request.answered, { status, headers: { "content-type": "application/json" } }); };
// The default answer of the endpoint: the fixed draft, whose reason is the answer the run leaves in its summary and log.
const works = answer(200, { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ draft: { decision: "passed", reason: ANSWER }, answers: [] }) } }],
  usage: { prompt_tokens: 11, completion_tokens: 7 } });
// An endpoint that refuses the connection, as the endpoint of TST-498006 does.
const refuse = () => { throw new TypeError("fetch failed: connect ECONNREFUSED 10.0.0.5:8080"); };
const HAND_OVER = { id: JOB };
const INPUTS = { job: JOB, task: TASK, endpoint: JSON.stringify(ENDPOINT), secret: "FIXTURE_KEY" };
const holdsTask = (haystack) => haystack.includes("zebra-498");

// ---------------------------------------------------------------- a hand-over run with its task

// TST-498001 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: a product whose `main` holds a queued job of kind decide-gate for the model endpoint hand-bot, route `ci hosted`, whose record says task `with the hand-over` and holds no instruction; the instance's participants list hand-bot with the route `endpoint fixture secret FIXTURE_KEY`; the fixture endpoint answers the fixed draft; no coding agent on the PATH; the job workflow's environment with the person's token, the key FIXTURE_KEY and a file for GITHUB_STEP_SUMMARY
// input: onDispatch with the inputs job, task "Please widen the footer of the lending page to 960 pixels, token zebra-498" and endpoint the JSON text of { kind openai-compatible, baseUrl https://llm.example.test/v1, model fixture-llm }
// expect: outcome `done`; the endpoint is asked once, at https://llm.example.test/v1/chat/completions, for the model fixture-llm, with the key FIXTURE_KEY's value as its bearer, its body holding the token zebra-498 once; on main in order: the commit that takes the job, the writer's commit, the commit that ends it; the record's End says `state: done`, names the writer's commit and the file as results, holds no draft; every commit message and every file at every commit of the product holds no zebra-498 — while the request the endpoint was sent does, which shows that the search finds the token where it is; nothing the entry printed holds zebra-498; the file GITHUB_STEP_SUMMARY names holds the answer "The footer is widened, token otter-498", and so does the log
test("TST-498001: a dispatched hand-over runs Agent M's own loop with the task and the endpoint, and writes the task nowhere", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    const status = await w.dispatch(INPUTS);
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(w.starts().length, 1, "the endpoint was asked once");
    const [request] = w.starts();
    assert.equal(request.address, "https://llm.example.test/v1/chat/completions");
    assert.equal(JSON.parse(request.body).model, "fixture-llm");
    assert.equal(request.headers.Authorization, `Bearer ${KEY}`, "the key of the named secret is the bearer");
    assert.equal(request.body.split("zebra-498").length - 1, 1, "its prompt holds the task once");
    assert.deepEqual(w.subjects().slice(0, 3), [`end ${JOB}: done`, "gate fixture decided", `take ${JOB} (https://github.com/alice/thesis-tool/actions/runs/4711)`]);
    const record = w.originText(`docs/jobs/${JOB}.md`);
    const writerCommit = git(w.root, "--git-dir", w.product, "log", "-1", "--format=%H", "--grep=gate fixture decided", "main");
    const end = record.split(/^## End$/m)[1];
    assert.match(end, /state: done/);
    assert.ok(end.includes(writerCommit), "the writer's commit is a result");
    assert.ok(end.includes(GATE_PATH), "the file is a result");
    assert.doesNotMatch(end, /```json/, "no draft in the end");
    assert.ok(holdsTask(w.calls()), "known positive: the search finds the task where the endpoint was sent it");
    assert.equal(holdsTask(w.everything()), false, "no commit message and no file of the product holds the task");
    assert.equal(holdsTask(w.lines() + status.summary), false, "nothing the entry printed holds the task");
    assert.ok(readFileSync(w.summary, "utf8").includes(ANSWER), "the run's summary holds the answer");
    assert.ok(w.lines().includes(ANSWER), "the log holds the answer");
    assert.equal(holdsTask(readFileSync(w.summary, "utf8")), false, "the run's summary holds no task");
  });
});

// TST-498002 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: as TST-498001; and the same dispatch for each of the inputs without task, with task "" and with task "   "
// input: onDispatch for each
// expect: outcome `failed` each time, the summary holds "the task travels with its hand-over, and this run was started without it"; the one commit on main is `end <job>: failed`, whose record End says `state: failed` and holds that reason; the job is not taken (no Taken part); the endpoint is never asked
test("TST-498002: a hand-over dispatched without its task ends failed with the reason and writes only the end", async () => {
  for (const inputs of [{ job: JOB, endpoint: INPUTS.endpoint }, { ...INPUTS, task: "" }, { ...INPUTS, task: "   " }]) {
    await world({ records: [HAND_OVER] }, async (w) => {
      const status = await w.dispatch(inputs);
      assert.equal(status.outcome, "failed");
      assert.ok(status.summary.includes(NO_TASK), status.summary);
      assert.deepEqual(w.subjects().slice(0, 2), [`end ${JOB}: failed`, "first"], JSON.stringify(inputs));
      const record = w.originText(`docs/jobs/${JOB}.md`);
      assert.match(record, /## End[^]*state: failed/);
      assert.ok(record.includes(NO_TASK));
      assert.doesNotMatch(record, /## Taken/);
      assert.equal(w.starts().length, 0, "the endpoint was not asked");
    });
  }
});

// TST-498003 · level: component · module: MOD-workflow-entries
// guards: UC-049; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: as TST-498001, but the environment lacks the key FIXTURE_KEY; and, as the known positive, the same with the key
// input: onDispatch with the task and the endpoint
// expect: without the key outcome `not run`, the summary naming FIXTURE_KEY, main as it was and the endpoint never asked; with it outcome `done`
test("TST-498003: a hand-over whose participant's key is missing is not run, naming the secret, with nothing written", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    const status = await w.dispatch(INPUTS, { FIXTURE_KEY: undefined });
    assert.equal(status.outcome, "not run");
    assert.match(status.summary, /FIXTURE_KEY/);
    assert.equal(w.mainHead(), w.head, "main is as it was");
    assert.equal(w.starts().length, 0);
    assert.equal((await w.dispatch(INPUTS)).outcome, "done", "known positive: with the key the job is run");
  });
});

// ---------------------------------------------------------------- onRecordsChanged leaves it

// TST-498004 · level: component · module: MOD-workflow-entries
// guards: UC-049
// given: a product whose `main` holds a queued job of the route `ci hosted` that says task `with the hand-over`, and another that says task `in parameters` and names its endpoint in its parameters, for the CI agent ci-bot; the fixture endpoint
// input: onRecordsChanged
// expect: outcome `done`; the job that says `in parameters` is taken and ends `state: done` (the known positive) after one request to the endpoint — the only request, so that the hand-over job was not run —; the record of the hand-over job is exactly as queued
test("TST-498004: onRecordsChanged leaves a job whose task travels with its hand-over queued", async () => {
  await world({ records: [HAND_OVER, { id: IN_RECORD, participant: "ci-bot", task: "in parameters", params: { endpoint: { name: "fixture", ...ENDPOINT } } }] }, async (w) => {
    const asked = fakeEndpoint();
    const queued = w.originText(`docs/jobs/${JOB}.md`);
    const status = await w.onRecordsChanged();
    assert.equal(status.outcome, "done", status.summary);
    assert.match(w.originText(`docs/jobs/${IN_RECORD}.md`), /## End[^]*state: done/);
    assert.equal(w.originText(`docs/jobs/${JOB}.md`), queued, "the hand-over job is left as it was queued");
    assert.equal(asked.length, 1, "the endpoint was asked once, for the job that says in parameters");
  });
});

// ---------------------------------------------------------------- a branch that holds the task

// TST-498005 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: as TST-498001, but the writer pushes the branch agent-m/<job> with its commit and returns the address of pull request 7, whose facts the fake GitHub API gives from that branch; the case plants the task in the commit message, in the pull request's title, or nowhere
// input: onDispatch with the task and the endpoint, for each case
// expect: planted in the commit message or in the title: outcome `failed`, the summary and the record's End name the branch agent-m/<job> and say it is refused, hold no zebra-498, and the record ends `state: failed`; the branch's commit is not on main; nowhere (the known positive): outcome `done`, the pull request's address is among the End's results, and the facts were read
test("TST-498005: a branch whose commit message or pull request text holds the task is refused by name, nothing merged", async () => {
  for (const plant of ["message", "title", null]) {
    await world({ records: [HAND_OVER] }, async (w) => {
      const api = fakeGitHub();
      plan = { pullRequest: true, plant, dir: w.productDir };
      const status = await w.dispatch(INPUTS);
      const branch = `agent-m/${JOB}`;
      assert.ok(api.includes("/pulls/7"), "the pull request's facts were read");
      const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
      if (plant === null) {
        assert.equal(status.outcome, "done", status.summary);
        assert.match(end, /state: done/);
        assert.ok(end.includes("https://github.com/alice/thesis-tool/pull/7"), "the pull request is among the results");
        return;
      }
      assert.equal(status.outcome, "failed", plant);
      for (const said of [status.summary, end]) {
        assert.ok(said.includes(branch), `${plant}: names the branch`);
        assert.match(said, /refused/, plant);
        assert.equal(holdsTask(said), false, `${plant}: the refusal does not repeat the task`);
      }
      assert.match(end, /state: failed/);
      assert.equal(w.mainHolds(pushed.commit), false, `${plant}: nothing is merged`);
      assert.equal(holdsTask(w.originText(`docs/jobs/${JOB}.md`)), false, `${plant}: the record holds no task`);
    });
  }
});

// ---------------------------------------------------------------- an answer that cannot be read

// TST-2026271046 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: as TST-498001, but the endpoint answers, in every round, JSON whose envelope has no `draft` — `{ "answers": [], "said": "kestrel-raw" }` —; known positive: TST-498001, whose endpoint answers a draft, ends `done`
// input: onDispatch with the task and the endpoint
// expect: outcome `failed`, its summary naming "the participant's answer could not be read: the answer has no draft"; on main the commit that ends the job is `end <job>: failed`, and the writer's commit is not there; the record's End says `state: failed`, `reason:` that text — MOD-job-runner's failedBecause —, no result, and `stopped because: unusable`; the answer as received, kestrel-raw, is in the run's summary and log, where the prompt bar reads the answer, and in no commit message and no file of the product — while the request the endpoint answered holds it, the known positive of the search; the task is written nowhere
test("TST-2026271046: a hand-over whose answer has no draft ends failed with the reason, its answer left in the run and not in the record", async () => {
  const raw = answer(200, { choices: [{ finish_reason: "stop", message: { content: JSON.stringify({ answers: [], said: "kestrel-raw" }) } }], usage: { prompt_tokens: 11, completion_tokens: 7 } });
  await world({ records: [HAND_OVER], endpoint: raw }, async (w) => {
    const status = await w.dispatch(INPUTS);
    assert.equal(status.outcome, "failed", status.summary);
    assert.match(status.summary, /the participant's answer could not be read: the answer has no draft/);
    assert.equal(w.subjects()[0], `end ${JOB}: failed`);
    assert.ok(!w.subjects().includes("gate fixture decided"), "the writer did not run");
    const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
    assert.match(end, /^state: failed$/m);
    assert.match(end, /^reason: the participant's answer could not be read: the answer has no draft$/m);
    assert.match(end, /stopped because: unusable/);
    assert.ok(w.starts().some((request) => (request.answered ?? "").includes("kestrel-raw")), "known positive: the search finds the answer where the endpoint gave it");
    assert.ok(readFileSync(w.summary, "utf8").includes("kestrel-raw"), "the run's summary holds the answer as received");
    assert.ok(w.lines().includes("kestrel-raw"), "the log holds the answer as received");
    assert.equal(w.everything().includes("kestrel-raw"), false, "no commit message and no file of the product holds the answer");
    assert.equal(holdsTask(w.everything()), false, "the task is written nowhere");
  });
});

// ---------------------------------------------------------------- an endpoint the run cannot reach

// TST-498006 · level: component · module: MOD-workflow-entries
// guards: UC-049; AN UNSUPPORTED ENDPOINT SAYS SO; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: as TST-498001, but every request to the endpoint fails with the connection error "fetch failed: connect ECONNREFUSED 10.0.0.5:8080"
// input: onDispatch with the task and the endpoint
// expect: outcome `failed`; the summary and the record's End hold the reason `not reachable` that diagnoseEndpoint gives for an error without status run in Node, and name "a self-hosted runner" and "a Bridge"; the record ends `state: failed`; no zebra-498 in the summary, the record, any commit or anything the entry printed; the requests sent to the endpoint, which hold the task, are where the search finds it (the known positive)
test("TST-498006: an endpoint the run cannot reach ends it failed with the diagnosis and the routes that would work, without the task", async () => {
  await world({ records: [HAND_OVER], endpoint: refuse }, async (w) => {
    const status = await w.dispatch(INPUTS);
    assert.equal(status.outcome, "failed");
    const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
    for (const said of [status.summary, end]) {
      assert.match(said, /not reachable/);
      assert.match(said, /a self-hosted runner/);
      assert.match(said, /a Bridge/);
    }
    assert.match(end, /state: failed/);
    assert.ok(holdsTask(w.calls()), "known positive: the endpoint was sent the task");
    assert.equal(holdsTask(status.summary + w.lines() + w.everything()), false, "the task reaches no summary, record, commit or output");
  });
});

// ---------------------------------------------------------------- the endpoint's own failure is the reason (ITM-539)

// TST-539001 · level: component · module: MOD-workflow-entries
// guards: UC-049; AN UNSUPPORTED ENDPOINT SAYS SO
// given: as TST-498001, but the endpoint answers the job's request with 401 and the message "Invalid API key."
// input: onDispatch with the task and the endpoint
// expect: outcome `failed`; the summary and the record's End hold the reason `key refused` and the message "Invalid API key.", do not hold `not reachable`, and name "a self-hosted runner" and "a Bridge"; exactly one request reached the endpoint — a refused key is not asked again, and no test request follows —, at https://llm.example.test/v1, carrying the key FIXTURE_KEY's value and the model fixture-llm; the record ends `state: failed`; no zebra-498 in the summary, the record, any commit or anything the entry printed (known positive: the request holds the task)
test("TST-539001: a refused key is named as refused, not as unreachable", async () => {
  await world({ records: [HAND_OVER], endpoint: answer(401, { error: { message: "Invalid API key." } }) }, async (w) => {
    const status = await w.dispatch(INPUTS);
    assert.equal(status.outcome, "failed");
    const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
    for (const said of [status.summary, end]) {
      assert.match(said, /key refused/);
      assert.match(said, /Invalid API key\./);
      assert.doesNotMatch(said, /not reachable/);
      assert.match(said, /a self-hosted runner/);
      assert.match(said, /a Bridge/);
    }
    assert.match(end, /state: failed/);
    assert.equal(w.probes.length, 1, "the endpoint was asked once");
    assert.ok(w.probes[0].address.startsWith("https://llm.example.test/v1"), w.probes[0].address);
    assert.ok(JSON.stringify(w.probes[0].headers).includes(KEY), "the request carries the key");
    assert.ok(w.probes[0].body.includes("fixture-llm"), "the request names the model");
    assert.ok(holdsTask(w.calls()), "known positive: the endpoint was sent the task");
    assert.equal(holdsTask(status.summary + w.lines() + w.everything()), false, "the task reaches no summary, record, commit or output");
  });
});

// TST-539002 · level: component · module: MOD-workflow-entries
// guards: UC-049; AN UNSUPPORTED ENDPOINT SAYS SO
// given: as TST-539001, but the endpoint answers 404 with the message "The model fixture-llm does not exist (asked: <the task>)", which repeats the task
// input: onDispatch with the task and the endpoint
// expect: outcome `failed`; the summary and the record's End hold the reason `model unknown` and "The model fixture-llm does not exist", not `not reachable`, and "[the task]" where the endpoint repeated the task; one request reached the endpoint; no zebra-498 in the summary, the record, any commit or anything the entry printed (known positive: the endpoint's answer, as the spy recorded it, holds the task)
test("TST-539002: an unknown model is named as unknown, and the task an endpoint repeats is hidden", async () => {
  await world({ records: [HAND_OVER], endpoint: answer(404, { error: { message: `The model fixture-llm does not exist (asked: ${TASK})` } }) }, async (w) => {
    const status = await w.dispatch(INPUTS);
    assert.equal(status.outcome, "failed");
    const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
    for (const said of [status.summary, end]) {
      assert.match(said, /model unknown/);
      assert.match(said, /The model fixture-llm does not exist/);
      assert.doesNotMatch(said, /not reachable/);
      assert.ok(said.includes("[the task]"), "the task the endpoint repeated is hidden");
    }
    assert.equal(w.probes.length, 1, "the endpoint was asked once");
    assert.ok(holdsTask(w.probes[0].answered), "known positive: the endpoint's answer holds the task");
    assert.equal(holdsTask(status.summary + w.lines() + w.everything()), false, "the task reaches no summary, record, commit or output");
  });
});

// TST-539003 · level: component · module: MOD-workflow-entries
// guards: UC-049; AN UNSUPPORTED ENDPOINT SAYS SO
// given: as TST-539001, but every request to the endpoint is refused by a connection error with the message "connect ECONNREFUSED 10.0.0.9:9"
// input: onDispatch with the task and the endpoint
// expect: outcome `failed`; the summary and the record's End hold the reason `not reachable` and the message "connect ECONNREFUSED 10.0.0.9:9", and name "a self-hosted runner" and "a Bridge"; six requests reached the endpoint — the job's request and the five retries a network error is given (MOD-endpoint-calls) —; the record ends `state: failed`
test("TST-539003: an endpoint nothing answers is named as not reachable in the words of the failed request", async () => {
  await world({ records: [HAND_OVER], endpoint: () => { throw new TypeError("connect ECONNREFUSED 10.0.0.9:9"); } }, async (w) => {
    const status = await w.dispatch(INPUTS);
    assert.equal(status.outcome, "failed");
    const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
    for (const said of [status.summary, end]) {
      assert.match(said, /not reachable/);
      assert.match(said, /connect ECONNREFUSED 10\.0\.0\.9:9/);
      assert.match(said, /a self-hosted runner/);
      assert.match(said, /a Bridge/);
    }
    assert.match(end, /state: failed/);
    assert.equal(w.probes.length, 6, "the request and its five retries");
  });
});

// TST-539005 · level: component · module: MOD-workflow-entries
// guards: UC-049
// given: as TST-498001: the endpoint answers the job's request with the fixed draft
// input: onDispatch with the task and the endpoint
// expect: outcome `done`; exactly one request reached the endpoint: no test request follows a run that worked
test("TST-539005: a hand-over run whose endpoint answers asks it once, and sends no test request", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    const status = await w.dispatch(INPUTS);
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(w.probes.length, 1);
  });
});

// ---------------------------------------------------------------- the branch history of this hand-over (ITM-538)

const historyOf = (w, ref) => connect(parseAddress("https://github.com/alice/thesis-tool"), { token: TOKEN, clone: w.productDir }).readHistory(null, { ref });

// TST-538001 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: the existing controlled hand-over fixture; pull request 7 has a clean title and commit message, and its description alone contains the task
// input: public onDispatch with the usual endpoint and task padded by two spaces on each side
// expect: failed; the refusal and End name agent-m/JOB-20261016-0900-a1b2, never repeat the trimmed task or either secret, and End says state: failed; the pushed commit is not merged; the API's description and the agent's calls are known positives for the task search
test("TST-538001: a task found only in the pull request description refuses the branch", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    const api = fakeGitHub(w);
    plan = { pullRequest: true, plant: "body", dir: w.productDir };
    const status = await w.dispatch({ ...INPUTS, task: `  ${TASK}  ` });
    assert.ok(holdsTask(pushed.body), "known positive: the description holds the task");
    assert.ok(holdsTask(w.calls()), "known positive: the endpoint was sent the task");
    assert.equal(holdsTask(pushed.title + pushed.message), false, "neither the title nor commit message holds it");
    assert.ok(api.includes("/pulls/7"));
    assert.equal(status.outcome, "failed", status.summary);
    const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
    assert.match(end, /state: failed/);
    for (const said of [status.summary, end]) {
      assert.ok(said.includes(`agent-m/${JOB}`), "the refused branch is named");
      assert.match(said, /refused/);
      assert.equal(holdsTask(said), false);
      assert.equal(said.includes(KEY) || said.includes(TOKEN), false);
    }
    assert.equal(w.mainHolds(pushed.commit), false, "nothing is merged");
  });
});

// TST-538002 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: the same agent pushes a branch with no pull request, a task-bearing commit and then a clean tip; shown.branch reports that branch; the public Host history is backed by the fixture's real git commits
// input: public onDispatch with the task and endpoint
// expect: failed, not done; the refusal and failed End name the branch without task or secrets; its tip is not merged; the guard's history requests name the pinned branch commit and the pre-run snapshot, with no path filter; the non-tip task message is a known positive
test("TST-538002: a no-PR branch is refused for a task in a non-tip commit", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    const api = fakeGitHub(w);
    plan = { branchOnly: true, plant: "message", history: "earlier", dir: w.productDir };
    const status = await w.dispatch(INPUTS);
    const guardRequests = [...api.histories];
    const snapshot = await connect(parseAddress("https://github.com/alice/thesis-tool"), { token: TOKEN, clone: w.productDir }).readSnapshot(pushed.branch);
    assert.equal(snapshot.commit, pushed.commit, "known positive: public readSnapshot pins the reported branch");
    const history = await historyOf(w, pushed.commit);
    assert.ok(history.find((row) => row.commit === pushed.taskCommit).message.includes(TASK), "known positive: public history holds the task in the earlier commit");
    assert.equal(holdsTask(history[0].message), false, "the tip is clean");
    assert.ok(holdsTask(w.calls()), "the endpoint was sent the task");
    assert.equal(status.outcome, "failed", "a task-bearing no-PR branch must fail");
    const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
    assert.match(end, /state: failed/);
    for (const said of [status.summary, end]) {
      assert.ok(said.includes(`agent-m/${JOB}`));
      assert.match(said, /refused/);
      assert.equal(holdsTask(said), false);
      assert.equal(said.includes(KEY) || said.includes(TOKEN), false);
    }
    for (const ref of [pushed.commit, pushed.base]) assert.ok(guardRequests.some((request) => request.ref === ref && request.path === null), `history is read at pinned commit ${ref}`);
    assert.equal(w.mainHolds(pushed.commit), false);
    assert.equal(api.includes("/pulls/7"), false, "there is no pull request to inspect");
  });
});

// TST-538003 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: a no-PR branch with a clean first-parent history; only a merged side commit contains the task, and the side commit is absent from the job's pre-run base
// input: public onDispatch with the task and endpoint
// expect: failed by the named branch, failed End without task or secrets, and nothing merged; public complete history finds the task-bearing side commit while first-parent history demonstrably does not
test("TST-538003: a task on merged side history is new branch history too", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    fakeGitHub(w);
    plan = { branchOnly: true, history: "merge-side", dir: w.productDir };
    const status = await w.dispatch(INPUTS);
    const history = await historyOf(w, pushed.commit);
    assert.ok(history.find((row) => row.commit === pushed.taskCommit).message.includes(TASK), "known positive: public history includes the task-bearing side commit");
    assert.equal(holdsTask(git(w.root, "--git-dir", w.product, "log", "--first-parent", "--format=%B", pushed.commit)), false);
    assert.equal((await historyOf(w, pushed.base)).some((row) => row.commit === pushed.taskCommit), false, "the side commit is not shared base history");
    assert.equal(status.outcome, "failed", "a side-branch task must not be ignored");
    const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
    assert.match(end, /state: failed/);
    for (const said of [status.summary, end]) {
      assert.ok(said.includes(`agent-m/${JOB}`));
      assert.match(said, /refused/);
      assert.equal(holdsTask(said), false);
      assert.equal(said.includes(KEY) || said.includes(TOKEN), false);
    }
    assert.equal(w.mainHolds(pushed.commit), false);
  });
});

// TST-538004 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: a clean no-PR branch; once with clean shared history and once with the task already present only in a shared base commit before the job runs
// input: public onDispatch with the task and endpoint for each fixture
// expect: done in both runs, done End listing the writer's tip with no pull request, task or secret; branch tip remains unmerged; the endpoint is sent the task, and the shared-task variant's public branch/base histories positively contain the same task-bearing commit
test("TST-538004: clean no-PR work succeeds and shared base task text is not new work", async () => {
  for (const baseMessage of [null, `earlier recorded work: ${TASK}`]) {
    await world({ records: [HAND_OVER], baseMessage }, async (w) => {
      fakeGitHub(w);
      plan = { branchOnly: true, dir: w.productDir };
      const status = await w.dispatch(INPUTS);
      const branchHistory = await historyOf(w, pushed.commit), baseHistory = await historyOf(w, pushed.base);
      assert.ok(holdsTask(w.calls()), "known positive: the endpoint is sent the task");
      if (baseMessage !== null) {
        const shared = branchHistory.find((row) => row.message.includes(TASK));
        assert.ok(shared, "known positive: branch history contains the old task message");
        assert.ok(baseHistory.some((row) => row.commit === shared.commit), "that exact commit belongs to the pre-run base");
      }
      assert.equal(status.outcome, "done", status.summary);
      const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
      assert.match(end, /state: done/);
      assert.ok(end.includes(pushed.commit));
      assert.doesNotMatch(end, /\/pull\/7/);
      assert.equal(holdsTask(status.summary + end + w.lines()), false);
      assert.equal((status.summary + end).includes(KEY) || (status.summary + end).includes(TOKEN), false);
      assert.equal(w.mainHolds(pushed.commit), false);
    });
  }
});

// TST-538005 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: after the job's context snapshot is fixed, the fixture's writer pushes a task-bearing commit to main and a clean tip above it to its reported no-PR branch
// input: public onDispatch with the task and endpoint
// expect: failed, because the task-bearing commit is absent from the pinned pre-run base even though moving main now contains it; the refusal and failed End hide task and secrets and name the branch; the reported branch tip is not merged
test("TST-538005: a moving main does not replace the job's pre-run comparison base", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    fakeGitHub(w);
    plan = { branchOnly: true, plant: "message", history: "advanced-main", dir: w.productDir };
    const status = await w.dispatch(INPUTS);
    assert.ok((await historyOf(w, pushed.commit)).find((row) => row.commit === pushed.taskCommit).message.includes(TASK), "known positive: the branch's new commit holds the task");
    assert.equal((await historyOf(w, pushed.base)).some((row) => row.commit === pushed.taskCommit), false, "the job's pinned base predates it");
    assert.equal(w.mainHolds(pushed.taskCommit), true, "the fixture advanced main after that base was pinned");
    assert.equal(status.outcome, "failed", "moving main must not erase this run's task-bearing commit");
    const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
    assert.match(end, /state: failed/);
    for (const said of [status.summary, end]) {
      assert.ok(said.includes(`agent-m/${JOB}`));
      assert.match(said, /refused/);
      assert.equal(holdsTask(said), false);
      assert.equal(said.includes(KEY) || said.includes(TOKEN), false);
    }
    assert.equal(w.mainHolds(pushed.commit), false, "the entry merges no branch tip");
  });
});

// TST-538006 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; NO SECRET IN THE REPOSITORY
// given: the public Host history successfully reads the fixture's existing commit; after the agent pushes a clean no-PR branch, the same API refuses either the pinned branch history or the pre-run base history with 503 and a message quoting task and secrets
// input: public onDispatch with the task and endpoint, once per failed history
// expect: failed, never a clean result; the entry and End name "fixture history unavailable", End says state: failed, task and secrets are redacted, and no branch tip is merged
test("TST-538006: a branch or base history failure ends the hand-over failed and redacted", async () => {
  for (const failHistory of ["branch", "base"]) {
    await world({ records: [HAND_OVER] }, async (w) => {
      fakeGitHub(w);
      assert.ok((await historyOf(w, w.head)).some((row) => row.commit === w.head), "known positive: this public history API reads the existing fixture commit");
      plan = { branchOnly: true, failHistory, dir: w.productDir };
      const status = await w.dispatch(INPUTS);
      assert.ok(holdsTask(w.calls()), "known positive: the endpoint was sent the task");
      assert.equal(status.outcome, "failed", `${failHistory} history failure is not a clean branch`);
      const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
      assert.match(end, /state: failed/);
      for (const said of [status.summary, end]) {
        assert.match(said, /fixture history unavailable/);
        assert.equal(holdsTask(said), false);
        assert.equal(said.includes(KEY) || said.includes(TOKEN), false);
      }
      assert.equal(w.mainHolds(pushed.commit), false);
    });
  }
});

// ---------------------------------------------------------------- the commit-message check reads no commit's changes (ITM-944)

// TST-944001 · level: component · module: MOD-workflow-entries
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: as TST-538002 — a no-PR branch whose earlier commit holds the task; the fake GitHub API lists the repository's commits and answers a request for one commit's files, which it records
// input: public onDispatch; then, as the counter-proof, the same history read through the API host without `changes: false`
// expect: the entry is refused as in TST-538002, and the API got no request for a single commit's files, since the check uses only each entry's commit and message; the counter-proof read gets one such request per commit, so the count finds them where they are made
test("TST-944001: the branch check reads the history without the changes of any commit", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    const api = fakeGitHub(w);
    plan = { branchOnly: true, plant: "message", history: "earlier", dir: w.productDir };
    const status = await w.dispatch(INPUTS);
    assert.equal(status.outcome, "failed", status.summary);
    const perCommit = () => api.filter((path) => /^\/commits\/[0-9a-f]{40}$/.test(path)).length;
    assert.equal(api.histories.length > 0, true, "the history was read");
    assert.equal(perCommit(), 0, "no commit's files were requested");
    const host = connect(parseAddress("https://github.com/alice/thesis-tool"), { token: TOKEN });
    const entries = await host.readHistory(null, { ref: pushed.commit });
    assert.equal(perCommit(), entries.length, "known positive: reading the changes costs one request per commit");
    assert.ok(entries.length >= 2);
  });
});

// ---------------------------------------------------------------- the key comes from the secret the input names (ITM-1189)

const INPUT_KEY_VALUE = "sk-INPUT-KEY-9f8e7d6c5b4a";
const BOTH = { AGENT_M_KEY_NAMES: "FIXTURE_KEY INPUT_KEY", INPUT_KEY: INPUT_KEY_VALUE };
const ASKS_FOR_INPUT_KEY = { ...INPUTS, secret: "INPUT_KEY" };

// TST-1189001 · level: component · module: MOD-workflow-entries
// guards: UC-049; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: as TST-498001, whose participant's route names FIXTURE_KEY, but the workflow file names two keys, FIXTURE_KEY and INPUT_KEY, each with a value of its own, and the dispatch's input secret is INPUT_KEY; and a second run whose endpoint answers 401
// input: onDispatch with the task, the endpoint and the secret INPUT_KEY; and, for the second run, the same
// expect: outcome `done`, the endpoint asked once with INPUT_KEY's value as its bearer, and FIXTURE_KEY's value in no request; no commit or file of the product holds the task or either value; in the second run the one request that reached the endpoint carries INPUT_KEY's value and not FIXTURE_KEY's
test("TST-1189001: the endpoint's key is the one the input secret names, not the participant's", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    const status = await w.dispatch(ASKS_FOR_INPUT_KEY, BOTH);
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(w.starts().length, 1);
    assert.equal(w.starts()[0].headers.Authorization, `Bearer ${INPUT_KEY_VALUE}`, "the key of the named secret is the bearer");
    assert.equal(w.calls().includes(KEY), false, "the participant's key is in no request");
    assert.equal(holdsTask(w.everything()) || w.everything().includes(INPUT_KEY_VALUE) || w.everything().includes(KEY), false, "no commit or file holds the task or a key");
  });
  await world({ records: [HAND_OVER], endpoint: answer(401, { error: { message: "Invalid API key." } }) }, async (w) => {
    const status = await w.dispatch(ASKS_FOR_INPUT_KEY, BOTH);
    assert.equal(status.outcome, "failed");
    assert.equal(w.probes.length, 1);
    const sent = JSON.stringify(w.probes[0].headers);
    assert.ok(sent.includes(INPUT_KEY_VALUE), "the request carries the key of the named secret");
    assert.equal(sent.includes(KEY), false, "and not the participant's");
  });
});

// TST-1189002 · level: component · module: MOD-workflow-entries
// guards: UC-049; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: as TST-1189001, but the workflow file names INPUT_KEY and the repository holds no value for it (the variable is empty); and, as the known positive, the same with the value
// input: onDispatch with the secret INPUT_KEY
// expect: outcome `not run`; the summary names INPUT_KEY in the form `<SECRET> is missing`, so that "not run — " + the summary matches /not run — (\S+) is missing/ with INPUT_KEY; main is as it was, the job is not taken, the endpoint is never asked; the summary does not say that the workflow names no such key; with the value outcome `done`
test("TST-1189002: a named secret the repository lacks ends the run not run, naming it", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    const status = await w.dispatch(ASKS_FOR_INPUT_KEY, { ...BOTH, INPUT_KEY: "" });
    assert.equal(status.outcome, "not run");
    assert.equal(/not run — (\S+) is missing/.exec(`not run — ${status.summary}`)?.[1], "INPUT_KEY");
    assert.doesNotMatch(status.summary, /names no such key/);
    assert.equal(w.mainHead(), w.head, "main is as it was");
    assert.equal(w.starts().length, 0);
    assert.equal((await w.dispatch(ASKS_FOR_INPUT_KEY, BOTH)).outcome, "done", "known positive: with the value the job is run");
  });
});

// TST-1189003 · level: component · module: MOD-workflow-entries
// guards: UC-049; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: as TST-1189001, but the workflow file names only FIXTURE_KEY (AGENT_M_KEY_NAMES), although a variable INPUT_KEY with a value is in the environment
// input: onDispatch with the secret INPUT_KEY
// expect: outcome `not run`; the summary names INPUT_KEY as missing in the form `<SECRET> is missing`, says that the job workflow names no such key and that it is installed again from Settings; main is as it was, the endpoint is never asked, and the value of INPUT_KEY is in no output
test("TST-1189003: a name the workflow file does not name ends the run not run, and says to install the job workflow again from Settings", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    const status = await w.dispatch(ASKS_FOR_INPUT_KEY, { INPUT_KEY: INPUT_KEY_VALUE });
    assert.equal(status.outcome, "not run");
    assert.equal(/not run — (\S+) is missing/.exec(`not run — ${status.summary}`)?.[1], "INPUT_KEY");
    assert.match(status.summary, /job workflow names no such key/);
    assert.match(status.summary, /installed again from Settings/);
    assert.equal(w.mainHead(), w.head, "main is as it was");
    assert.equal(w.starts().length, 0);
    assert.equal((status.summary + w.lines()).includes(INPUT_KEY_VALUE), false);
  });
});

// TST-1189004 · level: component · module: MOD-workflow-entries
// guards: UC-049; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: as TST-1189001, with the person's token AGENT_M_TOKEN and the participant's FIXTURE_KEY in the environment; and, as the known positive, the same with the secret INPUT_KEY
// input: onDispatch with the secret AGENT_M_TOKEN; with the secret `constructor`; with the secret INPUT_KEY
// expect: for the first two outcome `not run`, naming that name as missing, the endpoint never asked, main as it was, and neither the token's value nor any other key's in the summary or output; for INPUT_KEY outcome `done`
test("TST-1189004: no other secret is read: the person's token and a name that is no key are not run", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    for (const name of ["AGENT_M_TOKEN", "constructor"]) {
      const status = await w.dispatch({ ...INPUTS, secret: name }, BOTH);
      assert.equal(status.outcome, "not run", name);
      assert.equal(/not run — (\S+) is missing/.exec(`not run — ${status.summary}`)?.[1], name);
      assert.equal(w.starts().length, 0, name);
      assert.equal(w.mainHead(), w.head, name);
      assert.equal((status.summary + w.lines()).includes(TOKEN) || (status.summary + w.lines()).includes(KEY), false, name);
    }
    assert.equal((await w.dispatch(ASKS_FOR_INPUT_KEY, BOTH)).outcome, "done", "known positive");
  });
});

// ---------------------------------------------------------------- an endpoint the instance does not list (ITM-1192)

const DECLARED = { context: 100000, capabilities: ["draft text", "read the repository"] };

// TST-1192001 · level: component · module: MOD-workflow-entries
// guards: UC-049; THE PROMPT BAR'S ENDPOINTS AND CLI SESSIONS ARE BOUND AS PARTICIPANTS ARE; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: as TST-498001, but the queued job's participant is "nvidia", whom the instance's participants do not list, and its record declares the context 100000 and the capabilities draft text and read the repository (`declares`), its place in ## Destinations
// input: onDispatch with the task, the endpoint and the secret FIXTURE_KEY
// expect: outcome `done`; the endpoint is asked once, at its address, for its model, with FIXTURE_KEY's value as its bearer; the log holds the answer between the lines `--- answer of <job> ---` and `--- end of the answer of <job> ---`
test("TST-1192001: a hand-over of an endpoint the instance does not list runs as the participant its record declares", async () => {
  await world({ records: [{ ...HAND_OVER, participant: "nvidia", declares: DECLARED }] }, async (w) => {
    const status = await w.dispatch(INPUTS);
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(w.starts().length, 1, "the endpoint was asked once");
    const [request] = w.starts();
    assert.equal(request.address, "https://llm.example.test/v1/chat/completions");
    assert.equal(JSON.parse(request.body).model, "fixture-llm");
    assert.equal(request.headers.Authorization, `Bearer ${KEY}`);
    const log = w.lines();
    const from = log.indexOf(`--- answer of ${JOB} ---`), to = log.indexOf(`--- end of the answer of ${JOB} ---`);
    assert.ok(from !== -1 && to > from, "the answer stands between its two lines");
    assert.ok(log.slice(from, to).includes(ANSWER));
  });
});

// TST-1192002 · level: component · module: MOD-workflow-entries
// guards: UC-049; A JOB GOES ONLY TO A HOLDER OF ITS ROLE
// given: as TST-1192001, but the record of the unlisted "nvidia" declares nothing — the form of a job handed to a participant of the instance's list —; and, as the known positive, TST-1192001's record
// input: onDispatch with the task, the endpoint and the secret FIXTURE_KEY
// expect: outcome `failed`, the summary says the instance does not list nvidia; the endpoint is never asked and main is as it was
test("TST-1192002: a hand-over to an unlisted participant whose record declares nothing still fails", async () => {
  await world({ records: [{ ...HAND_OVER, participant: "nvidia" }] }, async (w) => {
    const status = await w.dispatch(INPUTS);
    assert.equal(status.outcome, "failed");
    assert.match(status.summary, /names the participant nvidia, whom the instance does not list/);
    assert.equal(w.starts().length, 0);
    assert.equal(w.mainHead(), w.head, "main is as it was");
  });
});

// ---------------------------------------------------------------- a hand-over of a kind that takes no instruction

// TST-8048006 · level: component · module: MOD-workflow-entries
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: as TST-498001, but the queued job is of kind check-for-persons, whose recipes do not name `instruction` — a run dispatched with a task for it, which the dashboard would have refused; known positive first — the decide-gate job of TST-498001, which takes the task, asks the endpoint once
// input: onDispatch with the task and the endpoint
// expect: outcome `failed`; the endpoint is never asked; on main: the commit that takes the job, then the one that ends it, `end <job>: failed`, and no other; the record's End says `state: failed` and its reason, as the summary does, says that the kind check-for-persons takes no instruction and names UC-049; no zebra-498 in the summary, the record, any commit or anything the entry printed
test("TST-8048006: a dispatched hand-over of a kind that takes no instruction ends failed before the endpoint is asked", async () => {
  await world({ records: [HAND_OVER] }, async (w) => {
    const status = await w.dispatch(INPUTS);
    assert.equal(status.outcome, "done", `known positive: ${status.summary}`);
    assert.equal(w.starts().length, 1, "known positive: the endpoint was asked");
  });
  await world({ records: [{ ...HAND_OVER, kind: "check-for-persons" }] }, async (w) => {
    const status = await w.dispatch(INPUTS);
    assert.equal(status.outcome, "failed", status.summary);
    assert.equal(w.starts().length, 0, "the endpoint was never asked");
    assert.deepEqual(w.subjects().slice(0, 3), [`end ${JOB}: failed`, `take ${JOB} (https://github.com/alice/thesis-tool/actions/runs/4711)`, "first"]);
    const end = w.originText(`docs/jobs/${JOB}.md`).split(/^## End$/m)[1];
    assert.match(end, /state: failed/);
    for (const said of [end, status.summary]) assert.match(said, /the kind check-for-persons takes no instruction[^\n]*UC-049/);
    assert.equal(holdsTask(w.everything() + w.lines() + status.summary), false, "the task is written and printed nowhere");
  });
});
