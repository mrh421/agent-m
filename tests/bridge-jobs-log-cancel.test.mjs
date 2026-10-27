// MOD-bridge-jobs' GET /v1/jobs/{id}/log and POST /v1/jobs/{id}/cancel (ITM-1101), as the accepted text of docs/architecture/MOD-bridge-jobs.md states them (:100-102): "`GET /v1/jobs`, `GET /v1/jobs/{id}/log` — the jobs it runs
// with their live states, and their logs as they grow" and "`POST /v1/jobs/{id}/cancel` — stops the agent's process and confirms once it has ended; the job then commits nothing more (`A CANCELLED JOB WRITES NOTHING MORE`),
// and the person's page appends the record of the cancel", in the forms of MOD-bridge-http's protocol (docs/architecture/MOD-bridge-http.md:57-58: `{ lines, next, ended }` from `?from={line}`; `{ confirmed }`, "`true` once the
// agent's process has ended") that MOD-bridge-client's `bridgeJobLog` and `cancelOnBridge` read.
// Run: node --test tests/bridge-jobs-log-cancel.test.mjs
//
// Module: MOD-bridge-jobs
// Guards: UC-044; UC-036; A CANCELLED JOB WRITES NOTHING MORE
// Level: unit
//
// The world is that of tests/bridge-jobs-list.test.mjs, written again here (a test file imports no other test file): bare repositories that git reaches through insteadOf, a fixture agent named opencode, the kind
// decide-gate with fixture strategies. The agent prints a first event line at once, records its process identifier and, when `gated`, waits for the gate file before it answers. Readings taken, named in the pull request:
//   - A job's log is the lines the agent's process writes to its standard output, in order, without their line breaks, kept in memory as long as the Bridge runs; `from` is the index of the first line wanted, 0 where none is
//     given; `lines` are those from `from` on; `next` is the index after the last line, the `from` to ask next; `ended` is true once the job has ended, whatever way. A `from` that is no whole number of at least 0 is
//     `invalid-request`.
//   - A job the Bridge did not take is `not-found`, for the log and for the cancel.
//   - The cancel answers `{ confirmed: true }` after the agent's process has ended; the Bridge writes no end for a job cancelled through the page (ITM-1104: the person's page appends the record of the cancel); a job ended by a quit still
//     gets its `cancelled` end. For a job that has ended already there is nothing to stop and it answers `{ confirmed: true }` too.
// The counter-proofs are in the pull request. Each test states its input and its expected result before it runs (given / input / expect).

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import * as bridgeJobs from "../src/bridge-jobs/index.mjs";
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
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-1101-")));
  const bin = join(root, "bin"), calls = join(root, "calls"), gate = join(root, "gate"), finished = join(root, "finished"), pidfile = join(root, "pid");
  mkdirSync(bin);
  writeFileSync(calls, "");
  script(bin, "git", `exec ${REAL_GIT} "$@"`);
  script(bin, "sleep", `exec ${REAL_SLEEP} "$@"`);
  const event = JSON.stringify({ type: "text", part: { text: JSON.stringify({ draft: { decision: "passed", reason: "@PWD@" }, answers: [] }) } }).replace("@PWD@", `'"$PWD"'`);
  script(bin, "opencode", `case "$1" in --version) echo 1.4.0;; auth) echo '1 credentials';; models) echo opencode/big-pickle;;
run) printf '%s\\n' "$PWD $*" >> ${calls}; echo $$ > ${pidfile}; printf '%s\\n' '{"type":"step_start"}'; ${gated ? `while [ ! -e ${gate} ]; do sleep 0.02; done; ` : ""}${fails ? "echo boom >&2; exit 3; " : ""}printf '%s\\n' ok >> ${finished}
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
      release: () => writeFileSync(gate, ""), close: () => rmSync(gate, { force: true }), finished: () => existsSync(finished), pid: () => Number(readFileSync(pidfile, "utf8").trim()), repository: (name, files) => repository(root, name, files) });
  } finally {
    await stopWatching("quit");
    process.env.PATH = prior;
    for (const key of Object.keys(process.env)) if (key.startsWith("GIT_CONFIG_") && key !== "GIT_CONFIG_GLOBAL" && key !== "GIT_CONFIG_SYSTEM") delete process.env[key];
    rmSync(root, { recursive: true, force: true });
  }
}
const watch = (w, agents, extra = {}) => startWatching({ bridgeName: "lab-pc", agents, products: [{ address: PRODUCT_A }], every: 100, instance: INSTANCE, ...extra });
const runs = (w) => w.calls().filter((line) => / run /.test(line));

const list = () => jobHandlers()["GET /v1/jobs"]({});

// The first line the fixture agent prints, at once: an event the agent's output format allows and the job ignores.
const FIRST = '{"type":"step_start"}';
const log = (id, from) => jobHandlers()["GET /v1/jobs/{id}/log"]({ params: { id }, query: from === undefined ? {} : { from: String(from) } });
const cancel = (id) => jobHandlers()["POST /v1/jobs/{id}/cancel"]({ params: { id } });
const code = async (promise) => { try { await promise; return null; } catch (error) { return error.code ?? error.message; } };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

// TST-1101001 · level: unit · module: MOD-bridge-jobs
// guards: UC-044; UC-036
// given: a job whose agent has printed its first line and waits for a gate
// input: GET /v1/jobs/{id}/log, with no from, with from 0 and with from 1; then the gate opened, the job ended, and GET again from 1 and from the next
// expect: while it runs: lines [the agent's first event line], next 1, ended false (the same for from 0), and no lines for from 1 with next 1; once it has ended: lines from 1 on are the agent's other lines (the answer, then the usage line), next their count, ended true; from the next, no line and ended true
test("GET /v1/jobs/{id}/log gives the lines from a line on, as they grow, and says when the job has ended", async () => {
  await world(async (w) => {
    const job = w.queue(PRODUCT_A, JOB(ID(1), "drafter"));
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }], { every: 50 });
    await w.until(() => runs(w).length === 1, "the agent to start");
    const live = await w.until(async () => { const got = await log(job.id); return got.lines.length ? got : null; }, "the first line");
    assert.deepEqual(live, { lines: [FIRST], next: 1, ended: false });
    assert.deepEqual(await log(job.id, 0), live);
    assert.deepEqual(await log(job.id, 1), { lines: [], next: 1, ended: false });
    w.release();
    await w.ended(job);
    const done = await w.until(async () => { const got = await log(job.id, 1); return got.ended ? got : null; }, "the job to end in its log");
    assert.equal(done.lines.length, 2, "the answer and the usage line");
    assert.match(done.lines[0], /"type":"text"/);
    assert.equal(done.next, 3);
    assert.deepEqual(await log(job.id, done.next), { lines: [], next: 3, ended: true });
  }, { gated: true });
});

// TST-1101002 · level: unit · module: MOD-bridge-jobs
// guards: UC-044; UC-036
// given: a Bridge that took one job; an identifier it never took
// input: GET /v1/jobs/{id}/log and POST /v1/jobs/{id}/cancel for the unknown one; GET log with from -1, 1.5 and "x" for the known one
// expect: the unknown job is answered by the error not-found, for both; a from that is no whole number of at least 0 is invalid-request; the known job's log with a good from is answered (known positive)
test("the log and the cancel of a job the Bridge did not take are answered by not-found, and a bad from by invalid-request", async () => {
  await world(async (w) => {
    const job = w.queue(PRODUCT_A, JOB(ID(2), "drafter"));
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }], { every: 50 });
    await w.until(() => runs(w).length === 1, "the agent to start");
    assert.equal(typeof (await log(job.id, 0)).next, "number", "known positive");
    assert.equal(await code(log("JOB-20990101-0000-ffff", 0)), "not-found");
    assert.equal(await code(cancel("JOB-20990101-0000-ffff")), "not-found");
    for (const bad of [-1, 1.5, "x"]) assert.equal(await code(log(job.id, bad)), "invalid-request", String(bad));
    w.release();
    await w.ended(job);
  }, { gated: true });
});

// TST-1101003 · level: unit · module: MOD-bridge-jobs
// guards: UC-044; UC-036; A CANCELLED JOB WRITES NOTHING MORE
// given: a job whose agent waits for a gate, started
// input: POST /v1/jobs/{id}/cancel; at once, the agent's process; then the gate opened and some time given
// expect: the answer is { confirmed: true } and, at the moment it is given, the agent's process is gone; the job is listed cancelled; the Bridge commits nothing after the cancel is confirmed — the product's head is the one at the answer, the record holds no end (the person's page appends the record of the cancel), and no file of the kind's writer; the agent never reached its end mark
test("POST /v1/jobs/{id}/cancel stops the agent's process, answers once it has ended, and the Bridge commits nothing more", async () => {
  await world(async (w) => {
    const job = w.queue(PRODUCT_A, JOB(ID(3), "drafter"));
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }], { every: 50 });
    await w.until(() => runs(w).length === 1, "the agent to start");
    const pid = await w.until(() => { try { return w.pid(); } catch { return null; } }, "the agent's process identifier");
    assert.equal(alive(pid), true, "known positive: the process runs");
    const answer = await cancel(job.id);
    assert.deepEqual(answer, { confirmed: true });
    assert.equal(alive(pid), false, "the process has ended when the cancel is answered");
    assert.equal((await list()).jobs.find((each) => each.id === job.id).state, "cancelled");
    const head = w.originHead(PRODUCT_A);
    w.release();
    await new Promise((resolve) => setTimeout(resolve, 600));
    assert.equal(w.originHead(PRODUCT_A), head, "the Bridge commits nothing after the cancel is confirmed");
    assert.doesNotMatch(w.originText(PRODUCT_A, job.path), /^## End$/m, "the record holds no end: the page appends it");
    assert.equal(w.originText(PRODUCT_A, `docs/gates/${job.id}.md`), "", "the writer wrote no file");
    assert.equal(w.finished(), false, "the agent did not reach its end");
  }, { gated: true });
});

// TST-1104001 · level: unit · module: MOD-bridge-jobs
// guards: UC-044; UC-036; A CANCELLED JOB WRITES NOTHING MORE
// given: a job whose agent waits for a gate, started; the Bridge then quit (MOD-desktop-shell: the jobs still running "end as cancelled" with no page to write it)
// input: stopWatching("quit")
// expect: the job is listed cancelled and its record in the product ends with state cancelled, naming that the Bridge was quit; the writer of the kind wrote no file
test("a job ended by a quit still gets its cancelled end, naming the quit", async () => {
  await world(async (w) => {
    const job = w.queue(PRODUCT_A, JOB(ID(6), "drafter"));
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }], { every: 50 });
    await w.until(() => runs(w).length === 1, "the agent to start");
    await stopWatching("quit");
    assert.equal((await list()).jobs.find((each) => each.id === job.id).state, "cancelled");
    const record = w.originText(PRODUCT_A, job.path);
    assert.match(record, /^## End$/m);
    assert.match(record, /state: cancelled/);
    assert.match(record, /the Bridge was quit/);
    assert.equal(w.originText(PRODUCT_A, `docs/gates/${job.id}.md`), "");
  }, { gated: true });
});

// TST-1101004 · level: unit · module: MOD-bridge-jobs
// guards: UC-044; UC-036
// given: a job that has ended done
// input: POST /v1/jobs/{id}/cancel
// expect: { confirmed: true }; the job stays done, its log is as it was and its record is unchanged
test("the cancel of a job that has ended stops nothing and changes nothing", async () => {
  await world(async (w) => {
    const job = w.queue(PRODUCT_A, JOB(ID(4), "drafter"));
    w.release();
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }], { every: 50 });
    await w.ended(job);
    await w.until(async () => (await list()).jobs.find((each) => each.id === job.id)?.state === "done", "the job to be done", 8000);
    const before = { log: await log(job.id), record: w.originText(PRODUCT_A, job.path) };
    assert.deepEqual(await cancel(job.id), { confirmed: true });
    assert.equal((await list()).jobs.find((each) => each.id === job.id).state, "done");
    assert.deepEqual(await log(job.id), before.log);
    assert.equal(w.originText(PRODUCT_A, job.path), before.record);
  }, { gated: true });
});

// TST-1101005 · level: unit · module: MOD-bridge-jobs
// guards: UC-044; UC-036
// given: the routes bridgeApi gives for the log and the cancel
// input: their answer forms and the handlers jobHandlers gives
// expect: both handlers exist; the log answer of a running job has exactly the keys bridgeApi gives (lines, next, ended) and the cancel answer those it gives (confirmed): the form bridgeJobLog and cancelOnBridge read
test("the log and the cancel are answered in the form the protocol gives", async () => {
  const handlers = jobHandlers();
  for (const key of ["GET /v1/jobs/{id}/log", "POST /v1/jobs/{id}/cancel"]) assert.equal(typeof handlers[key], "function", key);
  const route = (method, path) => bridgeApi.routes.find((each) => each.method === method && each.path === path);
  await world(async (w) => {
    const job = w.queue(PRODUCT_A, JOB(ID(5), "drafter"));
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }], { every: 50 });
    await w.until(() => runs(w).length === 1, "the agent to start");
    assert.deepEqual(Object.keys(await log(job.id)).sort(), Object.keys(route("GET", "/v1/jobs/{id}/log").answer).sort());
    assert.deepEqual(Object.keys(await cancel(job.id)).sort(), Object.keys(route("POST", "/v1/jobs/{id}/cancel").answer).sort());
  }, { gated: true });
});
