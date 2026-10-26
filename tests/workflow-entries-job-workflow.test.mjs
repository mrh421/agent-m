// MOD-workflow-entries' entries onRecordsChanged and onDispatch, which take and run a job in a product's job workflow (ITM-365), as the
// accepted text of docs/architecture/MOD-workflow-entries.md states them: "onRecordsChanged(env) — on a push to docs/jobs/ or docs/gates/
// of a product: takes each queued job whose route is this CI service and runs it from its record alone — its kind, the parameters of its
// `## Parameters` and its pinned inputs —, with the driver of its participant, a coding-agent process or a model endpoint, the participant's
// key from its secret, appending its records. No person attends a job in CI: its kind's writer writes at once … A job whose writer
// committed nothing, since its result equals the current files, ends done, and its end record and the entry's summary say `no change`
// (UC-010 4a)"; "onDispatch(env) — on a run started from the CI service's own page with the inputs the dashboard named (UC-024): writes
// the job's start record, those inputs its parameters, and runs it as onRecordsChanged runs a job"; "A secret that is missing ends the entry
// at once with a status that names it, before anything is written (UC-010)"; Data: "In a product, … the person's Agent M token … and each
// CI participant's key". For UC-010 steps 1 to 4, 3a, 4a.
// Run: node --test tests/workflow-entries-job-workflow.test.mjs
//
// Module: MOD-workflow-entries
// Guards: UC-010; ONE DEFINITION, THREE DRIVERS; A RUNTIME IS INTERCHANGEABLE; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; A CI AGENT'S DRAFT ENTERS AS OPEN; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; NO SECRET IN THE REPOSITORY
// Level: unit
//
// Deterministic, no network: the product and the instance are temporary git repositories — each a bare origin, the clone the workflow's
// checkout stands for, and a seed clone —, laid out as the job workflow lays them out: the workspace holds `product/` and `instance/`. The
// model endpoint is a fake `fetch` that answers as an OpenAI-compatible endpoint does and records every request. The kind is MOD-job-catalogue's
// `decide-gate`, whose recipe and writer the module's own strategies do not give yet: the tests register a recipe `gate-inputs` and a writer
// `gate-record` of their own, with the runner's registry, which the entry fills with the strategies of the modules that offer them. The
// product, the instance and the participant are the small ones this file holds. Where the module file leaves a reading open, the test states
// the one it takes, and the pull request names it:
//   - The names the entry reads are those of the job workflow's template (src/runtimes/workflow/github.yml, MOD-runtimes' jobWorkflowFiles):
//     AGENT_M_RUNNER (the route's runner, `hosted` or a label), AGENT_M_PRODUCT_DIR (the product's checkout), AGENT_M_TOKEN_NAME (the name of
//     the secret that holds the person's token), AGENT_M_TOKEN (its value), AGENT_M_KEY_NAMES (the names of the key secrets, separated by
//     blanks) and each key secret by its own name; and GitHub's own: GITHUB_WORKSPACE, GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_REF_NAME,
//     GITHUB_SHA, GITHUB_RUN_ID, GITHUB_ACTOR, GITHUB_EVENT_NAME, GITHUB_EVENT_PATH. The instance's checkout is `instance/` of the workspace.
//   - This CI service's route is `ci hosted` for the runner `hosted` and `ci runner:<label>` for a label, as MOD-job-ledger writes a record's
//     route. A queued job is one MOD-job-ledger's jobState calls so; jobs are taken oldest first. `Taken` names the run's address.
//   - A CI participant's route is `ci hosted secret <NAME>` or `ci runner:<label> secret <NAME>` (MOD-participant-list, Data): its key is the
//     value of the variable NAME. A job whose participant's key is missing ends the whole entry, before any job is taken.
//   - A job's endpoint is given by its record: the parameter `endpoint` — `{ name, kind, baseUrl, model }` — whose key is the participant's
//     secret; a parameter `agent` names a supported coding agent instead. The module file says where CI gets an endpoint's settings; the
//     record's parameters are the only place a job carries.
//   - The End holds: the state; `results` the commits the writer made, or `no change` for an outcome without a commit; the draft of a kind
//     that hands its draft back; the rounds; the usage the endpoint reported and the run's address as `log`. The entry's status is `done` with a
//     summary that names each job and its result, `no change` among them; `failed` when a job ended failed.
//   - onDispatch takes the job's identifier from the input `job`; a record of that identifier that exists is run; else the inputs `kind`,
//     `participant`, `works_on` (identifiers separated by commas) and `parameters` (a JSON text) make its start record, written in one commit and run.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull
// request.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendToRecord, startRecord } from "../src/job-ledger/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const entries = await import("../src/workflow-entries/main.mjs").catch((error) => ({ error }));
const { runEntry } = entries;

// ---------------------------------------------------------------- the fixtures

const text = (...lines) => `${lines.join("\n")}\n`;
const NOW = new Date("2026-10-08T09:00:00Z");
const TOKEN = "ghp_ALICEagentMtoken0123456789abcdef";
const KEY = "sk-FIXTURE-KEY-0123456789abcdef";
const ENDPOINT = { name: "fixture", kind: "openai-compatible", baseUrl: "https://llm.example.test/v1", model: "fixture-llm" };
const GATE_PATH = "docs/gates/GATE-fixture.md";
const gateText = (decision, reason) => text("# Gate fixture", "", `decision: ${decision}`, `reason: ${reason}`);
const REASON = "every artifact meets the condition";

const PARTICIPANTS = text("# Participants of this instance", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  "| ci-bot | CI agent | fixture-llm | 100000 | — | read the repository, write to the repository | GitHub's hosted runners | ci hosted secret FIXTURE_KEY |");

// The job's record names the commit of Agent M that runs — the instance's checkout is at it —, so the records are made once the instance exists.
const jobStart = (id, { agentM, route = "ci hosted", params = { endpoint: ENDPOINT } } = {}) => ({ id, kind: "decide-gate", worksOn: ["A LOAN HAS A DUE DATE"], participant: "ci-bot",
  model: "fixture-llm", route, run: null, retries: null, startedBy: "alice", start: new Date("2026-10-08T08:00:00Z"), agentM, inputs: [], limit: 2,
  destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: ["gate-inputs"] }], params });
const JOB = "JOB-20261008-0800-a1b2", OTHER_RUNNER_JOB = "JOB-20261008-0801-c3d4", TAKEN_JOB = "JOB-20261008-0802-e5f6";
const recordFile = (start) => { const { path, text: body } = startRecord(start); return [path, body]; };
// A record another runner took already: it is no queued job.
const takenFile = (start) => { const [path, body] = recordFile(start); return [path, appendToRecord(body, { part: "taken", at: new Date("2026-10-08T08:30:00Z"), by: "https://github.com/alice/thesis-tool/actions/runs/1" })]; };

function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
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
// The workspace of a job workflow: product/ and instance/, the product holding the records given.
async function withWorkspace({ records = () => [], extra = {} } = {}, run) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-jobs-"));
  const workspace = join(root, "ws");
  try {
    const instance = repository(root, "instance", { "README.md": "# Instance\n", "docs/participants.md": PARTICIPANTS }, join(workspace, "instance"));
    const agentM = { version: "2026.10.0", commit: git(join(workspace, "instance"), "rev-parse", "HEAD") };
    const product = repository(root, "product", { "README.md": "# Thesis tool\n", ...Object.fromEntries(records(agentM)), ...extra }, join(workspace, "product"));
    return await run({ root, workspace, product, instance, agentM, head: git(join(workspace, "product"), "rev-parse", "HEAD"), productDir: join(workspace, "product") });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
// What the job workflow's job gives the entry (src/runtimes/workflow/github.yml), with the secrets it filled.
const environment = (w, extra = {}) => ({ GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_WORKSPACE: w.workspace, GITHUB_SERVER_URL: "https://github.com",
  GITHUB_REPOSITORY: "alice/thesis-tool", GITHUB_REF_NAME: "main", GITHUB_SHA: w.head, GITHUB_RUN_ID: "4711", GITHUB_ACTOR: "alice",
  AGENT_M_RUNNER: "hosted", AGENT_M_PRODUCT_DIR: w.productDir, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", AGENT_M_KEY_NAMES: "FIXTURE_KEY", AGENT_M_TOKEN: TOKEN,
  FIXTURE_KEY: KEY, ...extra });
const headOf = (w) => git(w.product, "rev-parse", "main");
const subjects = (w) => git(w.product, "log", "--format=%s", "main").split("\n");
const fileAt = (w, path) => git(w.product, "show", `main:${path}`).concat("\n");
// Whether main holds the file: git's exit status and its listing decide, never the words of its refusal, which follow the machine's language.
const isWritten = (w, path) => git(w.product, "ls-tree", "--name-only", "main", "--", path) === path;

// The fake model endpoint: answers as an OpenAI-compatible one does and records every request.
function fakeEndpoint({ reason = REASON } = {}) {
  const requests = [];
  globalThis.fetch = async (address, init = {}) => {
    requests.push({ address: String(address), method: init.method, headers: init.headers ?? {}, body: init.body ?? "" });
    const content = JSON.stringify({ draft: { decision: "passed", reason }, answers: [] });
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 120, completion_tokens: 30 } }), { status: 200 });
  };
  return requests;
}

// The strategies this file gives the runner for decide-gate: its recipe, which keeps the context it was given, and its writer, which commits the
// gate's record through the product's host on the head it reads — or commits nothing where the record stands already.
let seen = null;
registerStrategies("tests/workflow-entries-job-workflow.test.mjs", {
  recipes: { "gate-inputs": async (context) => { seen = context; return [{ name: "gate-inputs", text: "gate fixture checks docs/a.md", size: 0, sources: [], required: true }]; } },
  writers: { "gate-record": async (result, context) => {
    const host = context.product.host, head = await host.readSnapshot("HEAD"), body = gateText(result.draft.decision, result.draft.reason);
    if ((await head.read(GATE_PATH)) === body) return { commits: [], files: [], pullRequest: null, shown: null, notes: [] };
    const { commit } = await host.commitFiles({ branch: "main", expectedHead: head.commit, files: [{ path: GATE_PATH, text: body }], message: "gate fixture decided" });
    return { commits: [commit], files: [GATE_PATH], pullRequest: null, shown: null, notes: [] };
  } },
});
const run = (w, extra) => { assert.ok(runEntry, `runEntry: ${entries.error?.message}`); return runEntry("onRecordsChanged", environment(w, extra), { now: NOW }); };

// ---------------------------------------------------------------- a queued job, taken and run

// TST-473201 · level: unit · module: MOD-workflow-entries
// guards: ONE DEFINITION, THREE DRIVERS; A RUNTIME IS INTERCHANGEABLE; A CI AGENT'S DRAFT ENTERS AS OPEN; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: a product whose `main` holds a queued job of the route `ci hosted`, another of the route `ci runner:lab` and one a runner took already, an instance holding the participant ci-bot, a fixture endpoint, and the job workflow's environment for the hosted runner with the person's token and the key
// input: onRecordsChanged
// expect: outcome `done`, the summary naming the job; on the origin's main in order: the commit that takes the job, the writer's commit — the gate's record, open —, and the commit that ends it; the record names the run's address as the route that took it, ends `done` with the writer's commit as its result, the usage the endpoint reported and the run's address as its log; the other job is not taken; the one taken already is left as it is; everything committed on main, no other branch; the endpoint asked once, at its address, with the key in its authorisation header
test("onRecordsChanged — a queued job of this route is taken and run: its writer's commit and its end appended", async () => {
  const requests = fakeEndpoint();
  await withWorkspace({ records: (agentM) => [recordFile(jobStart(JOB, { agentM })), recordFile(jobStart(OTHER_RUNNER_JOB, { agentM, route: "ci runner:lab" })),
    takenFile(jobStart(TAKEN_JOB, { agentM }))] }, async (w) => {
    const taken = fileAt(w, `docs/jobs/${TAKEN_JOB}.md`);
    const status = await run(w);
    assert.equal(status.outcome, "done");
    assert.match(status.summary, new RegExp(JOB));
    assert.deepEqual(subjects(w).slice(0, 3), [`end ${JOB}: done`, "gate fixture decided", `take ${JOB} (https://github.com/alice/thesis-tool/actions/runs/4711)`]);
    assert.equal(fileAt(w, GATE_PATH), gateText("passed", REASON));
    const record = fileAt(w, `docs/jobs/${JOB}.md`);
    assert.match(record, /## Taken[^]*by: https:\/\/github\.com\/alice\/thesis-tool\/actions\/runs\/4711/);
    assert.match(record, /## End[^]*state: done/);
    const writerCommit = git(w.product, "log", "-1", "--format=%H", "--grep=gate fixture decided", "main");
    assert.ok(record.includes(writerCommit), "the writer's commit is the End's result");
    assert.match(record, /log: https:\/\/github\.com\/alice\/thesis-tool\/actions\/runs\/4711/);
    assert.match(record, /120/);
    assert.ok(!fileAt(w, `docs/jobs/${OTHER_RUNNER_JOB}.md`).includes("## Taken"), "the job of another route is not taken");
    assert.equal(fileAt(w, `docs/jobs/${TAKEN_JOB}.md`), taken, "a job taken already is left as it is");
    assert.equal(git(w.product, "branch", "--list").replace(/[* ]/g, ""), "main", "everything is committed on the branch the workflow runs for");
    assert.equal(requests.length, 1, "the endpoint was asked once");
    assert.equal(requests[0].address, "https://llm.example.test/v1/chat/completions");
    assert.equal(requests[0].headers.Authorization, `Bearer ${KEY}`);
  });
});

// TST-473202 · level: unit · module: MOD-workflow-entries
// guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: a product with a queued job of the route `ci hosted` and another of the route `ci runner:lab`, and the job workflow's environment of the self-hosted runner `lab`
// input: onRecordsChanged
// expect: the job of the route `ci runner:lab` is taken and run; the job of `ci hosted` is left as it is
test("onRecordsChanged — a self-hosted runner takes the jobs of its own label", async () => {
  fakeEndpoint();
  await withWorkspace({ records: (agentM) => [recordFile(jobStart(JOB, { agentM })), recordFile(jobStart(OTHER_RUNNER_JOB, { agentM, route: "ci runner:lab" }))] }, async (w) => {
    const hosted = fileAt(w, `docs/jobs/${JOB}.md`);
    const status = await run(w, { AGENT_M_RUNNER: "lab" });
    assert.equal(status.outcome, "done");
    assert.match(fileAt(w, `docs/jobs/${OTHER_RUNNER_JOB}.md`), /## End[^]*state: done/);
    assert.equal(fileAt(w, `docs/jobs/${JOB}.md`), hosted);
  });
});

// ---------------------------------------------------------------- a missing secret

// TST-473203 · level: unit · module: MOD-workflow-entries
// guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; NO SECRET IN THE REPOSITORY
// given: the product with a queued job, and the environment without the participant's key; and without the person's token
// input: onRecordsChanged for each; and, as the known positive, with both
// expect: outcome `not run` each time, the summary naming the secret — FIXTURE_KEY, then AGENT_M_TOKEN — before anything is written: the origin's main as it was, the job not taken, the endpoint not asked; with both the job is run
test("onRecordsChanged — a missing secret ends the entry not run, naming it, with nothing written", async () => {
  const requests = fakeEndpoint();
  await withWorkspace({ records: (agentM) => [recordFile(jobStart(JOB, { agentM }))] }, async (w) => {
    for (const [missing, name] of [["FIXTURE_KEY", "FIXTURE_KEY"], ["AGENT_M_TOKEN", "AGENT_M_TOKEN"]]) {
      const status = await run(w, { [missing]: undefined });
      assert.equal(status.outcome, "not run", missing);
      assert.match(status.summary, new RegExp(name), missing);
      assert.equal(headOf(w), w.head, `${missing}: the origin is as it was`);
      assert.equal(git(w.productDir, "status", "--porcelain"), "", `${missing}: the checkout is clean`);
      assert.equal(requests.length, 0, `${missing}: the endpoint is not asked`);
    }
    assert.equal((await run(w)).outcome, "done", "known positive: with both secrets the job is run");
    assert.equal(requests.length, 1);
  });
});

// ---------------------------------------------------------------- the context

// TST-473204 · level: unit · module: MOD-workflow-entries
// guards: ONE DEFINITION, THREE DRIVERS; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the product with a queued job and the workspace of the job workflow
// input: onRecordsChanged; the recipe of the kind keeps the context the entry gives the runner
// expect: the context names the product's address and no instance checkout — the job's participant is a model endpoint in Agent M's own tool loop, which reads no
//   files of a checkout itself (MOD-job-runner: `instance.checkout` is the folder in which the participant works and reads files itself) —, with the instance's snapshot read from the workspace's instance/ folder, holding the participants' register, the job's identifier, the person who started it, Agent M's version and commit as the record names them, and the participants the register lists
test("onRecordsChanged — the job's context of an endpoint in Agent M's own tool loop names no instance checkout", async () => {
  fakeEndpoint();
  seen = null;
  await withWorkspace({ records: (agentM) => [recordFile(jobStart(JOB, { agentM }))] }, async (w) => {
    await run(w);
    assert.ok(seen, "the recipe was given a context");
    assert.equal(seen.instance.checkout, undefined);
    assert.equal(await seen.instance.snapshot.read("docs/participants.md"), PARTICIPANTS);
    assert.equal(seen.product.address, "https://github.com/alice/thesis-tool");
    assert.equal(seen.jobId, JOB);
    assert.equal(seen.person, "alice");
    assert.deepEqual(seen.agentM, w.agentM);
    assert.deepEqual(seen.participants.map((participant) => participant.name), ["ci-bot"]);
  });
});

// ---------------------------------------------------------------- no change

// TST-473205 · level: unit · module: MOD-workflow-entries
// guards: A CI AGENT'S DRAFT ENTERS AS OPEN; UC-010
// given: the product already holds the gate's record exactly as the writer would write it, and a queued job
// input: onRecordsChanged
// expect: outcome `done`; no commit of the writer; the job taken and ended `done` with the result `no change`; the summary says `no change`
test("onRecordsChanged — a result equal to the current files ends done with no change", async () => {
  fakeEndpoint();
  await withWorkspace({ records: (agentM) => [recordFile(jobStart(JOB, { agentM }))], extra: { [GATE_PATH]: gateText("passed", REASON) } }, async (w) => {
    const status = await run(w);
    assert.equal(status.outcome, "done");
    assert.match(status.summary, /no change/);
    assert.deepEqual(subjects(w).slice(0, 3), [`end ${JOB}: done`, `take ${JOB} (https://github.com/alice/thesis-tool/actions/runs/4711)`, "first"]);
    assert.match(fileAt(w, `docs/jobs/${JOB}.md`), /## End[^]*state: done[^]*results:[^]*no change/);
  });
});

// ---------------------------------------------------------------- a dispatched job

// TST-473206 · level: unit · module: MOD-workflow-entries
// guards: UC-010; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A CI AGENT'S DRAFT ENTERS AS OPEN
// given: a product with another queued job and no record of the one started, and a start from the server's own page with the inputs job, kind, participant, works_on and the parameters
// input: onDispatch, the event's payload read from the file GITHUB_EVENT_PATH names
// expect: outcome `done`; the start record committed at docs/jobs/<job>.md — route `ci hosted`, started by the actor, the inputs' parameters —, then taken and run as a queued job is: the writer's commit and the End; the other queued job is left as it is
test("onDispatch — a dispatched job is started and run", async () => {
  fakeEndpoint();
  const id = "JOB-20261008-0900-d1e2";
  await withWorkspace({ records: (agentM) => [recordFile(jobStart(JOB, { agentM }))] }, async (w) => {
    const payload = join(w.root, "event.json");
    const queued = fileAt(w, `docs/jobs/${JOB}.md`);
    writeFileSync(payload, JSON.stringify({ inputs: { job: id, kind: "decide-gate", participant: "ci-bot", works_on: "A LOAN HAS A DUE DATE", parameters: JSON.stringify({ endpoint: ENDPOINT }) } }));
    assert.ok(runEntry, `runEntry: ${entries.error?.message}`);
    const status = await runEntry("onDispatch", environment(w, { GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_EVENT_PATH: payload }), { now: NOW });
    assert.equal(status.outcome, "done");
    const log = subjects(w);
    assert.ok(log[0].startsWith(`end ${id}`) && log[1] === "gate fixture decided" && log[2].startsWith(`take ${id}`) && log[3].includes(id), log.join(" | "));
    const record = fileAt(w, `docs/jobs/${id}.md`);
    assert.match(record, /kind: decide-gate/);
    assert.match(record, /route: ci hosted/);
    assert.match(record, /started_by: alice/);
    assert.match(record, /baseUrl/);
    assert.match(record, /## End[^]*state: done/);
    assert.equal(fileAt(w, GATE_PATH), gateText("passed", REASON));
    assert.equal(fileAt(w, `docs/jobs/${JOB}.md`), queued, "another queued job is left as it is");
  });
});

// ---------------------------------------------------------------- no secret in any commit

// TST-473207 · level: unit · module: MOD-workflow-entries
// guards: NO SECRET IN THE REPOSITORY; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: the job run as in the first test; and a job whose endpoint, a leaky one, quotes the key it was given in the reason of its decision
// input: onRecordsChanged for each; every commit of the product's origin searched for the person's token and the key
// expect: in neither run does a commit hold either; the first run's gate record is on main; in the second the writer's commit is refused — nothing of the decision is written — and the job ends `failed`, the status `failed`
test("onRecordsChanged — no secret value in any commit", async () => {
  const holdsSecret = (w) => [TOKEN, KEY].some((secret) => git(w.product, "log", "-p", "--all").includes(secret));
  fakeEndpoint();
  await withWorkspace({ records: (agentM) => [recordFile(jobStart(JOB, { agentM }))] }, async (w) => {
    assert.equal((await run(w)).outcome, "done");
    assert.equal(holdsSecret(w), false, "a normal run");
    assert.equal(isWritten(w, GATE_PATH), true, "known positive: a normal run writes the gate's record");
  });
  fakeEndpoint({ reason: `authorised with ${KEY}` });
  await withWorkspace({ records: (agentM) => [recordFile(jobStart(JOB, { agentM }))] }, async (w) => {
    const status = await run(w);
    assert.equal(status.outcome, "failed");
    assert.equal(holdsSecret(w), false, "a leaky endpoint");
    assert.equal(isWritten(w, GATE_PATH), false, "nothing of the decision is written");
    assert.match(fileAt(w, `docs/jobs/${JOB}.md`), /## End[^]*state: failed/);
  });
});

// ---------------------------------------------------------------- the two machines of GitHub's job workflow

// The agent's machine (AGENT_M_PART agent): no token, the one key at its place among the names, the result's folder. The writing machine (AGENT_M_PART write): its
// own workspace, cloned from the same origins, the token and every key, the same result's folder, into whose `out/` the agent's result was downloaded.
const agentMachine = (w, extra = {}) => environment(w, { AGENT_M_PART: "agent", AGENT_M_TOKEN: undefined, AGENT_M_RESULT_DIR: join(w.root, "result"), AGENT_M_KEY: "1", ...extra });
function writingMachine(w) {
  const workspace = join(w.root, "ws-write");
  for (const [name, origin] of [["product", w.product], ["instance", w.instance]]) {
    git(w.root, "clone", "-q", ...NO_MAINTENANCE, origin, join(workspace, name));
    quiet(join(workspace, name));
    git(join(workspace, name), "config", "user.name", "Alice Agent M token");
    git(join(workspace, name), "config", "user.email", "alice@example.org");
  }
  return environment({ ...w, workspace, productDir: join(workspace, "product") }, { AGENT_M_PART: "write", AGENT_M_RESULT_DIR: join(w.root, "result") });
}
const entry = (name, env) => { assert.ok(runEntry, `runEntry: ${entries.error?.message}`); return runEntry(name, env, { now: NOW }); };

// TST-0124201 · level: unit · module: MOD-workflow-entries
// guards: A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the product with a queued job of `ci hosted`, run first on the agent's machine — onRecordsChanged, then leaveResult —, then on the writing machine — writeResult
// input: the three entries in that order; the origin's main read after each
// expect: after the agent's machine the origin's main is as it was and the endpoint was asked with the key; leaveResult names one branch and one end; after writeResult the origin's main holds, in order, the taking, the writer's commit and the end, the record ending `done` and naming the writer's commit as it stands on main
test("the agent's machine writes nothing to the origin; the writing machine writes its result with the job's end", async () => {
  const requests = fakeEndpoint();
  await withWorkspace({ records: (agentM) => [recordFile(jobStart(JOB, { agentM }))] }, async (w) => {
    assert.equal((await entry("onRecordsChanged", agentMachine(w))).outcome, "done");
    assert.equal(headOf(w), w.head, "the origin's main is as it was");
    assert.equal(requests[0].headers.Authorization, `Bearer ${KEY}`);
    const left = await entry("leaveResult", agentMachine(w));
    assert.equal(left.outcome, "done");
    assert.match(left.summary, /1 branch\(es\), 1 end\(s\)/);
    assert.equal(headOf(w), w.head, "still as it was");

    const written = await entry("writeResult", writingMachine(w));
    assert.equal(written.outcome, "done", written.summary);
    assert.deepEqual(subjects(w).slice(0, 3), [`end ${JOB}: done`, "gate fixture decided", `take ${JOB} (https://github.com/alice/thesis-tool/actions/runs/4711)`]);
    const writerCommit = git(w.product, "log", "-1", "--format=%H", "--grep=gate fixture decided", "main");
    assert.match(fileAt(w, `docs/jobs/${JOB}.md`), new RegExp(`## End[^]*state: done[^]*${writerCommit}`));
  });
});

// TST-0124202 · level: unit · module: MOD-workflow-entries
// guards: A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: the same run, and someone pushes a commit to the origin's main while the agent works
// input: onRecordsChanged and leaveResult on the agent's machine, the other commit, writeResult
// expect: done; the origin's main holds the other commit, then the taking, the writer's commit and the end; the end names the writer's commit by the identifier it has on main, not by the one the agent's machine made
test("writeResult — on a main that moved, the commits are picked onto it and the end names them as they now stand", async () => {
  fakeEndpoint();
  await withWorkspace({ records: (agentM) => [recordFile(jobStart(JOB, { agentM }))] }, async (w) => {
    await entry("onRecordsChanged", agentMachine(w));
    await entry("leaveResult", agentMachine(w));
    const made = git(join(w.root, "result", "result.git"), "log", "-1", "--format=%H", "--grep=gate fixture decided", "main");
    const seed = join(w.root, "product-seed");
    write(seed, { "README.md": "# Thesis tool, renamed\n" });
    git(seed, "commit", "-q", "-am", "someone else");
    git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");

    const written = await entry("writeResult", writingMachine(w));
    assert.equal(written.outcome, "done", written.summary);
    assert.deepEqual(subjects(w).slice(0, 4), [`end ${JOB}: done`, "gate fixture decided", `take ${JOB} (https://github.com/alice/thesis-tool/actions/runs/4711)`, "someone else"]);
    const onMain = git(w.product, "log", "-1", "--format=%H", "--grep=gate fixture decided", "main");
    assert.notEqual(onMain, made);
    const record = fileAt(w, `docs/jobs/${JOB}.md`);
    assert.ok(record.includes(onMain) && !record.includes(made), "the end names the commit as it stands on main");
  });
});

// TST-0124203 · level: unit · module: MOD-workflow-entries
// guards: A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: the same run, after which the agent — led astray — commits a change of .github/workflows/ on a branch of its own and pushes it, as its checkout pushes
// input: leaveResult, then writeResult
// expect: writeResult ends `failed`, naming the workflow file; the origin holds neither the branch nor the taking nor the writer's commit; the queued record gets one end, `failed`, whose reason names the refusal
test("writeResult — a result that changes a workflow file writes nothing but the job's failed end", async () => {
  fakeEndpoint();
  await withWorkspace({ records: (agentM) => [recordFile(jobStart(JOB, { agentM }))] }, async (w) => {
    await entry("onRecordsChanged", agentMachine(w));
    git(w.productDir, "checkout", "-q", "-b", "led-astray");
    write(w.productDir, { ".github/workflows/steal.yml": "on: push\n" });
    git(w.productDir, "add", "-A");
    git(w.productDir, "commit", "-q", "-m", "a workflow of its own");
    git(w.productDir, "push", "-q", "origin", "led-astray");
    await entry("leaveResult", agentMachine(w));

    const written = await entry("writeResult", writingMachine(w));
    assert.equal(written.outcome, "failed");
    assert.match(written.summary, /\.github\/workflows\/steal\.yml/);
    assert.equal(spawnSync("git", ["rev-parse", "--verify", "--quiet", "refs/heads/led-astray"], { cwd: w.product }).status, 1, "the branch is not on the origin");
    assert.deepEqual(subjects(w).slice(0, 2), [`end ${JOB}: failed`, "first"]);
    const record = fileAt(w, `docs/jobs/${JOB}.md`);
    assert.ok(!record.includes("## Taken"), "the taking was not written");
    assert.match(record, /## End[^]*state: failed[^]*reason: the result of the agent's machine is refused: [^\n]*steal\.yml/);
  });
});

// TST-0124204 · level: unit · module: MOD-workflow-entries
// guards: A HOSTED JOB AUTHENTICATES ITS AGENT WITH A CI SECRET
// given: the product with a queued job whose participant reads FIXTURE_KEY, and a file that reads the keys OTHER_KEY and FIXTURE_KEY
// input: chooseAgentKey on a push, its output file read; onRecordsChanged on the agent's machine given OTHER_KEY (1), then given FIXTURE_KEY (2)
// expect: the output is `agent=2`; given OTHER_KEY the job is left queued and the endpoint not asked (`nothing to do`); given FIXTURE_KEY it is run
test("chooseAgentKey and the agent's machine — the machine of the job's own key runs it, another leaves it queued", async () => {
  const requests = fakeEndpoint();
  await withWorkspace({ records: (agentM) => [recordFile(jobStart(JOB, { agentM }))] }, async (w) => {
    const output = join(w.root, "output.txt");
    writeFileSync(output, "");
    const chosen = await entry("chooseAgentKey", environment(w, { AGENT_M_TOKEN: undefined, FIXTURE_KEY: undefined, AGENT_M_KEY_NAMES: "OTHER_KEY FIXTURE_KEY", GITHUB_OUTPUT: output }));
    assert.equal(chosen.outcome, "done", chosen.summary);
    assert.equal(readFileSync(output, "utf8"), "agent=2\n");

    const other = await entry("onRecordsChanged", agentMachine(w, { AGENT_M_KEY_NAMES: "OTHER_KEY FIXTURE_KEY", AGENT_M_KEY: "1", FIXTURE_KEY: undefined, OTHER_KEY: "other-key-value-0123" }));
    assert.equal(other.outcome, "nothing to do", other.summary);
    assert.equal(requests.length, 0);
    const own = await entry("onRecordsChanged", agentMachine(w, { AGENT_M_KEY_NAMES: "OTHER_KEY FIXTURE_KEY", AGENT_M_KEY: "2" }));
    assert.equal(own.outcome, "done", own.summary);
    assert.equal(requests.length, 1);
  });
});
