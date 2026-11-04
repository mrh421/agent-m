// MOD-bridge-jobs' GET /v1/jobs (ITM-1097), as the accepted text of docs/architecture/MOD-bridge-jobs.md states it (:100): "`GET /v1/jobs`, `GET /v1/jobs/{id}/log` — the jobs it runs with their live states, and their logs as
// they grow", in the form MOD-bridge-client's `bridgeJobs` reads (docs/architecture/MOD-bridge-client.md:141-142: `{ id, product, kind, agent, state, started, usage }[]`, "the jobs the Bridge runs or ran since it started") and
// MOD-bridge-http's protocol gives it (docs/architecture/MOD-bridge-http.md:56). For MOD-desktop-shell's *Quit*, which names the jobs still running (ITM-1055).
// Run: node --test tests/bridge-jobs-list.test.mjs
//
// Module: MOD-bridge-jobs
// Guards: UC-044; UC-036; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// Level: unit
//
// The world is that of tests/bridge-jobs-watch.test.mjs, written again here (a test file imports no other test file): the instance and the products are bare repositories that git reaches through insteadOf, the agent is a
// fixture executable named opencode, and the kind is decide-gate with fixture strategies. Readings taken, named in the pull request: the Bridge lists the jobs it took since it started, in the order it took them, in memory
// only (a job another route took is not listed); a job's `state` is `running` while its agent works and, once it has ended, the `state` of its end — `done`, `failed` or `cancelled`; `started` is the moment it took the job, as
// an ISO date and time; `usage` is null while it runs and the usage its end records afterwards; `agent` is the name of the agent that ran it and `product` the product's address. With no job the answer is an empty list.
// The first test of this file is the one with no job: the list lives as long as the program. The counter-proofs are in the pull request.
// Each test states its input and its expected result before it runs (given / input / expect).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import * as bridgeJobs from "../src/bridge-jobs/index.mjs";
import { openEnclosures } from "./enclosure-fixture.mjs";
import { bridgeApi } from "../src/bridge-http/index.mjs";

const { jobHandlers, startWatching, stopWatching } = bridgeJobs;
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";
Object.assign(process.env, { GIT_AUTHOR_NAME: "Seed", GIT_AUTHOR_EMAIL: "seed@example.org", GIT_COMMITTER_NAME: "Seed", GIT_COMMITTER_EMAIL: "seed@example.org" });
const REAL_GIT = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
const REAL_SLEEP = spawnSync("sh", ["-c", "command -v sleep"], { encoding: "utf8" }).stdout.trim();

const INSTANCE = "https://github.com/acme/agent-m", PRODUCT_A = "https://github.com/acme/product-a", PRODUCT_B = "https://github.com/acme/product-b";

// ---------------------------------------------------------------- the strategies of decide-gate, as fixtures

registerStrategies("tests/bridge-jobs-list.test.mjs", {
  recipes: { "gate-inputs": async () => [{ name: "the gate", text: "Decide the gate.", sources: [], required: true, artifacts: [] }] },
  writers: { "gate-record": async (result, context) => {
    const marker = readFileSync(join(context.instance.checkout, "marker.md"), "utf8").trim();
    const path = `docs/gates/${context.jobId}.md`;
    const { defaultBranch } = await context.product.host.repositoryInfo();
    const { commit } = await context.product.host.commitFiles({ branch: defaultBranch, expectedHead: context.product.snapshot.commit,
      files: [{ path, text: `working folder: ${result.draft.reason}\ninstance marker: ${marker}\ninstance at: ${context.instance.snapshot.commit}\n` }],
      message: `gate ${context.jobId}` });
    return { commits: [commit], files: [path], pullRequest: null, shown: null, notes: [] };
  } },
});

// ---------------------------------------------------------------- the world of a test

function git(cwd, ...args) {
  const r = spawnSync(REAL_GIT, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
const script = (bin, name, body) => writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
const ROW = (name, type, route) => `| ${name} | ${type} | example-model | 200000 | — | draft text, read the repository | this machine | ${route} |`;
const PARTICIPANTS = `# Participants of this instance

**REGISTER**

The participants of the test instance.

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
${[ROW("drafter", "CLI agent", "bridge lab-pc agent opencode"), ROW("other-drafter", "CLI agent", "bridge other-pc agent opencode"),
  ROW("codex-drafter", "CLI agent", "bridge lab-pc agent codex"), ROW("claude-drafter", "CLI agent", "bridge lab-pc agent claude"),
  ROW("ci-drafter", "CI agent", "ci hosted secret CI_KEY")].join("\n")}
`;

// A bare repository whose main holds the files given, and a seed clone of it that writes. -> { origin, seed }
function repository(root, name, files) {
  const origin = join(root, `${name}.git`), seed = join(root, `${name}-seed`);
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, seed);
  push(seed, files, "first");
  return { origin, seed };
}
function push(seed, files, message) {
  spawnSync(REAL_GIT, ["fetch", "-q", "origin"], { cwd: seed });
  spawnSync(REAL_GIT, ["reset", "-q", "--hard", "origin/main"], { cwd: seed });
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(seed, path, ".."), { recursive: true });
    writeFileSync(join(seed, path), text);
  }
  git(seed, "add", "-A");
  git(seed, "commit", "-q", "-m", message);
  git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  return git(seed, "rev-parse", "HEAD");
}

const JOB = (id, participant, route = "bridge lab-pc") => ({ id, kind: "decide-gate", worksOn: ["A JOB IS RECORDED IN ITS PRODUCT REPOSITORY"], participant, model: "example-model", route, run: null, retries: null,
  startedBy: "alice", start: new Date("2026-10-11T09:00:00Z"), agentM: { version: "2026.10.0", commit: null }, inputs: [], limit: 3,
  destinations: [{ participant, place: "this machine", parts: ["the gate"] }], params: {} });
const ID = (n) => `JOB-20261011-090${n}-aaa${n}`;

// The Bridge's computer: a PATH of the fixture agent and the wrappers, the instance (two commits; the record names the first) and the products. The
// agent answers with its working folder and, once started, waits for the gate file when `gated`; it writes a mark when it ends.
async function world(run, { gated = false, fails = false } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-1097-")));
  const bin = join(root, "bin"), calls = join(root, "calls"), gate = join(root, "gate"), finished = join(root, "finished");
  mkdirSync(bin);
  writeFileSync(calls, "");
  script(bin, "git", `exec ${REAL_GIT} "$@"`);
  script(bin, "sleep", `exec ${REAL_SLEEP} "$@"`);
  const event = JSON.stringify({ type: "text", part: { text: JSON.stringify({ draft: { decision: "passed", reason: "@PWD@" }, answers: [] }) } }).replace("@PWD@", `'"$PWD"'`);
  script(bin, "opencode", `case "$1" in --version) echo 1.4.0;; auth) echo '1 credentials';; models) echo opencode/big-pickle;;
run) printf '%s\\n' "$PWD $*" >> ${calls}; ${gated ? `while [ ! -e ${gate} ]; do sleep 0.02; done; ` : ""}${fails ? "echo boom >&2; exit 3; " : ""}printf '%s\\n' ok >> ${finished}
printf '%s\\n' '${event}' '{"type":"step_finish","part":{"tokens":{"input":11,"output":7}}}';; esac`);
  const instance = repository(root, "instance", { "docs/participants.md": PARTICIPANTS, "marker.md": "v1\n" });
  const first = git(instance.seed, "rev-parse", "HEAD");
  push(instance.seed, { "marker.md": "v2\n", "docs/participants.md": PARTICIPANTS.replace("bridge lab-pc agent opencode", "bridge elsewhere agent opencode") }, "second");
  const products = { [PRODUCT_A]: repository(root, "product-a", { "README.md": "A\n" }) };
  const queue = (product, job) => {
    const { path, text } = startRecord({ ...job, agentM: { version: "2026.10.0", commit: first } });
    return { path, text, id: job.id, product, commit: push(products[product].seed, { [path]: text }, `queue ${job.id}`) };
  };
  const mapping = () => {
    const pairs = [[INSTANCE, instance.origin], ...Object.entries(products).map(([address, { origin }]) => [address, origin])];
    if (!products[PRODUCT_B]) pairs.push([PRODUCT_B, join(root, "product-b.git")]);
    process.env.GIT_CONFIG_COUNT = String(pairs.length);
    pairs.forEach(([address, path], at) => { process.env[`GIT_CONFIG_KEY_${at}`] = `url.${path}.insteadOf`; process.env[`GIT_CONFIG_VALUE_${at}`] = address; });
  };
  mapping();
  const folder = (name) => { const path = join(root, name); mkdirSync(path); return path; };
  const originText = (product, path) => spawnSync(REAL_GIT, ["--git-dir", products[product].origin, "show", `main:${path}`], { encoding: "utf8" }).stdout;
  const originHead = (product) => git(root, "--git-dir", products[product].origin, "rev-parse", "main");
  const until = async (condition, what, ms = 30000) => {
    for (const end = Date.now() + ms; Date.now() < end;) {
      const found = await condition();
      if (found) return found;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail(`waited for ${what}`);
  };
  const ended = (job) => until(() => /^## End$/m.test(originText(job.product, job.path)), `${job.id} to end`);
  const prior = process.env.PATH;
  process.env.PATH = bin;
  try {
    return await run({ root, instance, products, first, queue, mapping, folder, originText, originHead, until, ended, calls: () => readFileSync(calls, "utf8").trim().split("\n").filter(Boolean),
      release: () => writeFileSync(gate, ""), close: () => rmSync(gate, { force: true }), finished: () => existsSync(finished), repository: (name, files) => repository(root, name, files) });
  } finally {
    await stopWatching("quit");
    try {
      // A job's end commit is on the server before the `git push` that made it has returned: that process updates the clone's remote-tracking ref in the
      // clone's `.git` once the server's receive-pack has exited. `stopWatching("pause")` leaves a running job to end, and the quit above finds no watcher
      // then to await it, so the folder is removed only when no job of the Bridge is listed running: the end of that process.
      await until(async () => (await list()).jobs.every(({ state }) => state !== "running"), "every job of the Bridge to end");
    } finally {
      process.env.PATH = prior;
      for (const key of Object.keys(process.env)) if (key.startsWith("GIT_CONFIG_") && key !== "GIT_CONFIG_GLOBAL" && key !== "GIT_CONFIG_SYSTEM") delete process.env[key];
      rmSync(root, { recursive: true, force: true });
    }
  }
}
const watch = (w, agents, extra = {}) => startWatching({ bridgeName: "lab-pc", agents, products: [{ address: PRODUCT_A }], every: 100, instance: INSTANCE, enclosures: openEnclosures(), ...extra });
const runs = (w) => w.calls().filter((line) => / run /.test(line));

const list = () => jobHandlers()["GET /v1/jobs"]({});

// TST-1097101 · level: unit · module: MOD-bridge-jobs
// guards: UC-044; UC-036
// given: a Bridge that has taken no job since it started
// input: GET /v1/jobs
// expect: { jobs: [] }
test("GET /v1/jobs answers an empty list while the Bridge has run no job", async () => {
  assert.equal(typeof jobHandlers()["GET /v1/jobs"], "function", "the handler exists");
  assert.deepEqual(await list(), { jobs: [] });
});

// TST-1097102 · level: unit · module: MOD-bridge-jobs
// guards: UC-044; UC-036
// given: a job that ran to its end (ended done, the agent reporting 11 and 7 tokens), and a second that the Bridge has taken and whose agent waits for a gate
// input: GET /v1/jobs while the second runs
// expect: both are answered in the order they were taken: the first { id, product, kind decide-gate, agent opencode, state done, started an ISO date and time, usage { inputTokens 11, outputTokens 7, minutes null, cost null } }, the second with state running and usage null; each entry has exactly the keys of MOD-bridge-http's answer; the keys of the protocol's entry are written out here: id, product, kind, agent, state, started, usage
test("GET /v1/jobs answers the job that ended and the job that runs, with their live states", async () => {
  await world(async (w) => {
    const first = w.queue(PRODUCT_A, JOB(ID(1), "drafter"));
    w.release();
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }], { every: 50 });
    await w.ended(first);
    w.close();
    const second = w.queue(PRODUCT_A, JOB(ID(2), "drafter"));
    await w.until(() => runs(w).length === 2, "the second agent to start");

    const { jobs } = await list();
    assert.deepEqual(jobs.map(({ id, state }) => [id, state]), [[first.id, "done"], [second.id, "running"]]);
    for (const job of jobs) {
      assert.deepEqual(Object.keys(job).sort(), ["agent", "id", "kind", "product", "started", "state", "usage"]);
      assert.deepEqual([job.product, job.kind, job.agent], [PRODUCT_A, "decide-gate", "opencode"]);
      assert.match(job.started, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    }
    assert.deepEqual(jobs[0].usage, { inputTokens: 11, outputTokens: 7, minutes: null, cost: null });
    assert.equal(jobs[1].usage, null);
    const protocol = bridgeApi.routes.find((route) => route.method === "GET" && route.path === "/v1/jobs").answer.jobs[0];
    assert.deepEqual(Object.keys(jobs[0]).sort(), Object.keys(protocol).sort(), "the form the protocol gives and bridgeJobs reads");
    w.release();
    await w.ended(second);
  }, { gated: true });
});

// TST-1097103 · level: unit · module: MOD-bridge-jobs
// guards: UC-044; UC-036; A CANCELLED JOB WRITES NOTHING MORE
// given: a job whose agent waits for a gate and has been started; then the same Bridge quit
// input: GET /v1/jobs before and after stopWatching("quit")
// expect: before, the job is listed running; after, it is listed cancelled; a job that failed earlier in the file stays listed failed
test("GET /v1/jobs lists a running job as running and, once the Bridge was quit, as cancelled", async () => {
  await world(async (w) => {
    const failed = w.queue(PRODUCT_A, JOB(ID(3), "drafter"));
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }], { every: 50 });
    await w.ended(failed);
    await stopWatching("pause");
  }, { fails: true });
  await world(async (w) => {
    const job = w.queue(PRODUCT_A, JOB(ID(4), "drafter"));
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }]);
    await w.until(() => runs(w).length === 1, "the agent to start");
    assert.equal((await list()).jobs.find((each) => each.id === job.id).state, "running");
    await stopWatching("quit");
    const after = (await list()).jobs;
    assert.equal(after.find((each) => each.id === job.id).state, "cancelled");
    assert.equal(after.find((each) => each.id === ID(3)).state, "failed");
  }, { gated: true });
});

// TST-1097104 · level: unit · module: MOD-bridge-jobs
// guards: UC-044; UC-036
// given: a job whose agent works to its answer, in a product whose server refuses the commit that ends the record (a hook of the bare repository), so that the Bridge cannot write the end
// input: startWatching; wait until the agent has finished; GET /v1/jobs
// expect: the job is not listed running — nothing works on it any more — but failed
test("GET /v1/jobs does not list a job as running when its end could not be written", async () => {
  await world(async (w) => {
    const hook = join(w.products[PRODUCT_A].origin, "hooks", "pre-receive");
    mkdirSync(join(hook, ".."), { recursive: true });
    writeFileSync(hook, `#!/bin/sh\nwhile read old new ref; do case "$(git log -1 --format=%s "$new")" in end\\ *) echo "refused" >&2; exit 1;; esac; done\n`, { mode: 0o755 });
    const job = w.queue(PRODUCT_A, JOB(ID(5), "drafter"));
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }], { every: 50 });
    await w.until(() => w.finished(), "the agent to finish");
    const listed = await w.until(async () => (await list()).jobs.find((each) => each.id === job.id && each.state !== "running"), "the job to leave running");
    assert.equal(listed.state, "failed");
    assert.equal(/^## End$/m.test(w.originText(PRODUCT_A, job.path)), false, "the end was refused");
  });
});

// TST-1295001 · level: unit · module: MOD-bridge-jobs
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: a job whose end commit the product's server answers at once and then keeps working on (a post-receive hook of the bare repository that sleeps for a second), and a test body that pauses the Bridge as soon as the end is on the server
// input: the world's cleanup, run when the test body returns
// expect: the cleanup returns only after the job has ended, which is then listed done and not running, and its folder is gone: nothing of the job writes into the folder any more
test("the world of a test is removed only after the job it started has ended", async () => {
  let root = null;
  await world(async (w) => {
    root = w.root;
    const hook = join(w.products[PRODUCT_A].origin, "hooks", "post-receive");
    mkdirSync(join(hook, ".."), { recursive: true });
    writeFileSync(hook, `#!/bin/sh\nwhile read old new ref; do case "$(git log -1 --format=%s "$new")" in end\\ *) sleep 1;; esac; done\n`, { mode: 0o755 });
    const job = w.queue(PRODUCT_A, JOB(ID(6), "drafter"));
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }], { every: 50 });
    await w.ended(job);
    await stopWatching("pause");
  });
  assert.equal(existsSync(root), false, "the folder is removed");
  assert.equal((await list()).jobs.find((each) => each.id === ID(6)).state, "done", "the job has ended when the cleanup returns");
});
