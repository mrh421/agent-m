// MOD-bridge-jobs — POST /v1/jobs for a job whose task travels with the hand-over (ITM-492).
// Module: MOD-bridge-jobs
// Guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON; A CANCELLED JOB WRITES NOTHING MORE
// Level: unit
// Run: node --test tests/bridge-job-task-492.test.mjs
//
// Deterministic, no network, no real agent: the fixture of tests/bridge-jobs-watch.test.mjs is the model — the instance and the product are bare
// repositories in a temporary folder that git reaches through `url.<path>.insteadOf`; the agent is a fixture executable named opencode that
// appends the arguments it was started with and its standard input — its prompt, which MOD-agent-processes writes to the agent's standard
// input, never as an argument — to a file outside the repositories, with shell builtins only (PATH holds only the fixture's bin), and answers a
// fixed draft (with `files: []`, which converse's built-in checks read). The kind is converse,
// whose recipes name `instruction`. Every expected value is stated in the test's own text.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import { jobHandlers, startWatching, stopWatching } from "../src/bridge-jobs/index.mjs";
import { openEnclosures } from "./enclosure-fixture.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";
Object.assign(process.env, { GIT_AUTHOR_NAME: "Seed", GIT_AUTHOR_EMAIL: "seed@example.org", GIT_COMMITTER_NAME: "Seed", GIT_COMMITTER_EMAIL: "seed@example.org" });
const REAL_GIT = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
const REAL_SLEEP = spawnSync("sh", ["-c", "command -v sleep"], { encoding: "utf8" }).stdout.trim();

// converse names the recipe chapters-for-page, which no module registers in this program; the fixture gives no part.
registerStrategies("tests/bridge-job-task-492.test.mjs", { recipes: { "chapters-for-page": async () => [] } });

const INSTANCE = "https://github.com/acme/agent-m", PRODUCT = "https://github.com/acme/product-a";
const TASK = "Add a footer to the page, token zebra-492";
const FROM_RECORD = "Answer from the record, token otter-492";

function git(cwd, ...args) {
  const r = spawnSync(REAL_GIT, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
const script = (bin, name, body) => writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
const PARTICIPANTS = `# Participants of this instance

**REGISTER**

The participants of the test instance.

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| drafter | CLI agent | example-model | 200000 | — | draft text, read the repository | this machine | bridge lab-pc agent opencode |
`;

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

const JOB = (id, task, params = {}) => ({ id, kind: "converse", worksOn: ["UC-049"], participant: "drafter", model: "example-model", route: "bridge lab-pc", run: null,
  retries: null, startedBy: "alice", start: new Date("2026-10-16T09:00:00Z"), agentM: { version: "2026.10.0", commit: null }, inputs: [], limit: 3, task,
  destinations: [{ participant: "drafter", place: "this machine", parts: ["instruction"] }], params });
const ID = (n) => `JOB-20261016-090${n}-bbb${n}`;

// The Bridge's computer. `lines` collects what the Bridge says about itself: every skipped product's reason and every write to stdout or stderr.
async function world(run) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-ITM-492-")));
  const bin = join(root, "bin"), calls = join(root, "calls");
  mkdirSync(bin);
  writeFileSync(calls, "");
  script(bin, "git", `exec ${REAL_GIT} "$@"`);
  script(bin, "sleep", `exec ${REAL_SLEEP} "$@"`);
  const event = JSON.stringify({ type: "text", part: { text: JSON.stringify({ draft: { answer: "Done.", edits: [], files: [] }, answers: [] }) } });
  script(bin, "opencode", `case "$1" in --version) echo 1.4.0;; auth) echo '1 credentials';; models) echo opencode/big-pickle;;
run) { printf 'RUN %s\\n' "$*"; while IFS= read -r l || [ -n "$l" ]; do printf '%s\\n' "$l"; done; } >> ${calls}
printf '%s\\n' '${event}' '{"type":"step_finish","part":{"tokens":{"input":11,"output":7}}}';; esac`);
  const instance = repository(root, "instance", { "docs/participants.md": PARTICIPANTS });
  const first = git(instance.seed, "rev-parse", "HEAD");
  const product = repository(root, "product-a", { "README.md": "A\n" });
  const pairs = [[INSTANCE, instance.origin], [PRODUCT, product.origin]];
  process.env.GIT_CONFIG_COUNT = String(pairs.length);
  pairs.forEach(([address, path], at) => { process.env[`GIT_CONFIG_KEY_${at}`] = `url.${path}.insteadOf`; process.env[`GIT_CONFIG_VALUE_${at}`] = address; });
  const lines = [];
  const writers = [process.stdout, process.stderr].map((stream) => [stream, stream.write]);
  for (const [stream, write] of writers) stream.write = (chunk, ...rest) => { lines.push(String(chunk)); return write.call(stream, chunk, ...rest); };
  const queue = (job) => {
    const { path, text } = startRecord({ ...job, agentM: { version: "2026.10.0", commit: first } });
    return { path, text, id: job.id, product: PRODUCT, commit: push(product.seed, { [path]: text }, `queue ${job.id}`) };
  };
  const originText = (path) => spawnSync(REAL_GIT, ["--git-dir", product.origin, "show", `main:${path}`], { encoding: "utf8" }).stdout;
  // Everything the product's repository holds anywhere: every commit message, and every file at every commit of every branch.
  const everything = () => {
    const dir = ["--git-dir", product.origin];
    const commits = git(root, ...dir, "rev-list", "--all").split("\n").filter(Boolean);
    return commits.map((commit) => [git(root, ...dir, "log", "-1", "--format=%B", commit),
      ...git(root, ...dir, "ls-tree", "-r", "--name-only", commit).split("\n").filter(Boolean).map((file) => git(root, ...dir, "show", `${commit}:${file}`))].join("\n")).join("\n");
  };
  const until = async (condition, what, ms = 30000) => {
    for (const end = Date.now() + ms; Date.now() < end;) {
      if (await condition()) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.fail(`waited for ${what}`);
  };
  const ended = (job) => until(() => /^## End$/m.test(originText(job.path)), `${job.id} to end`);
  const prior = process.env.PATH;
  process.env.PATH = bin;
  try {
    const agents = [{ name: "opencode", folder: join(root, "agent-work") }];
    mkdirSync(agents[0].folder);
    const watch = (every) => startWatching({ bridgeName: "lab-pc", agents, products: [{ address: PRODUCT }], every, instance: INSTANCE, enclosures: openEnclosures(), onSkipped: ({ reason }) => lines.push(reason) });
    const handOver = (job, task) => jobHandlers({ agents })["POST /v1/jobs"]({ params: {}, query: {},
      body: { product: job.product, record: job.path, commit: job.commit, ...(task === undefined ? {} : { task }) } });
    return await run({ queue, originText, everything, ended, until, watch, handOver, lines: () => lines.join("\n"),
      starts: () => readFileSync(calls, "utf8").split(/^RUN /m).filter(Boolean) });
  } finally {
    await stopWatching("quit");
    for (const [stream, write] of writers) stream.write = write;
    process.env.PATH = prior;
    for (const key of Object.keys(process.env)) if (key.startsWith("GIT_CONFIG_") && key !== "GIT_CONFIG_GLOBAL" && key !== "GIT_CONFIG_SYSTEM") delete process.env[key];
    rmSync(root, { recursive: true, force: true });
  }
}

// TST-492001 · level: unit · module: MOD-bridge-jobs
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: a product with a queued job of kind converse whose record says task `with the hand-over`; a Bridge watching with an interval of an hour
// input: POST /v1/jobs for the job with the task "Add a footer to the page, token zebra-492"; wait for the job's end
// expect: the answer is { accepted: <the job's id> }; the agent was started once and its prompt holds the token zebra-492 once; the record ends `state: done`; every commit message and every file at every commit of the product's repository, and everything the Bridge wrote to its output and to onSkipped, lacks the token
test("TST-492001: a handed-over task is the agent's instruction and is written nowhere", async () => {
  await world(async (w) => {
    const job = w.queue(JOB(ID(1), "with the hand-over"));
    w.watch(3_600_000);
    assert.deepEqual(await w.handOver(job, TASK), { accepted: job.id });
    await w.ended(job);
    assert.equal(w.starts().length, 1);
    assert.equal(w.starts()[0].split("zebra-492").length - 1, 1, "the agent's prompt holds the task once");
    assert.match(w.originText(job.path), /^state: done$/m);
    assert.equal(w.everything().includes("zebra-492"), false, "no file or commit message of the product holds the task");
    assert.equal(w.lines().includes("zebra-492"), false, "nothing the Bridge says of itself holds the task");
  });
});

// TST-492002 · level: unit · module: MOD-bridge-jobs
// guards: UC-049; A CONVERSATION IS WRITTEN TO A REPOSITORY ONLY WHEN RECORDING IS ON
// given: a product with a queued job of kind converse that says task `with the hand-over` and a queued job of kind converse that says `in parameters` with the instruction "Answer from the record, token otter-492"; a Bridge watching with an interval of 100 ms
// input: wait for the in-parameters job's end, then four more intervals
// expect: the in-parameters job ends `state: done` (the known positive) and its prompt holds otter-492; the other record is exactly as queued; the agent was started once
test("TST-492002: the Bridge's own reading leaves a job whose task travels with the hand-over queued", async () => {
  await world(async (w) => {
    const handed = w.queue(JOB(ID(1), "with the hand-over"));
    const mine = w.queue(JOB(ID(2), "in parameters", { instruction: FROM_RECORD }));
    w.watch(100);
    await w.ended(mine);
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.match(w.originText(mine.path), /^state: done$/m);
    assert.match(w.starts()[0], /otter-492/);
    assert.equal(w.originText(handed.path), handed.text);
    assert.equal(w.starts().length, 1);
  });
});

// TST-492003 · level: unit · module: MOD-bridge-jobs
// guards: UC-049
// given: a product with a queued job of kind converse that says task `with the hand-over`; a Bridge watching with an interval of 100 ms
// input: POST /v1/jobs for the job without a task, then with the task ""
// expect: each is rejected with code invalid-request; after four intervals the record is exactly as queued and the agent was never started
test("TST-492003: a hand-over of a job whose task travels with it, without a task, is invalid-request", async () => {
  await world(async (w) => {
    const job = w.queue(JOB(ID(1), "with the hand-over"));
    w.watch(100);
    await assert.rejects(w.handOver(job), (error) => error?.code === "invalid-request");
    await assert.rejects(w.handOver(job, ""), (error) => error?.code === "invalid-request");
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(w.originText(job.path), job.text);
    assert.equal(w.starts().length, 0);
  });
});

// TST-492004 · level: unit · module: MOD-bridge-jobs
// guards: UC-049
// given: a product with a queued job of kind converse that says task `in parameters`, with the instruction "Answer from the record, token otter-492"; a Bridge watching with an interval of an hour
// input: POST /v1/jobs for the job with the task "Add a footer to the page, token zebra-492"; wait for the end
// expect: the agent's prompt holds otter-492 and lacks zebra-492; the record ends `state: done` and its end holds the draft, the agent's fenced JSON block with "answer": "Done." (as today for a job run from its record)
test("TST-492004: a task sent for a job whose record says in parameters is ignored", async () => {
  await world(async (w) => {
    const job = w.queue(JOB(ID(1), "in parameters", { instruction: FROM_RECORD }));
    w.watch(3_600_000);
    assert.deepEqual(await w.handOver(job, TASK), { accepted: job.id });
    await w.ended(job);
    assert.match(w.starts()[0], /otter-492/);
    assert.doesNotMatch(w.starts()[0], /zebra-492/);
    const record = w.originText(job.path);
    assert.match(record, /^state: done$/m);
    assert.match(record.split(/^## End$/m)[1], /"answer": "Done\."/);
  });
});

// TST-492005 · level: unit · module: MOD-bridge-jobs
// guards: UC-049
// given: as TST-492001
// input: POST /v1/jobs with the task; wait for the end
// expect: the record's `## End` says `state: done`, holds no fenced draft block and does not hold the agent's answer "Done."
test("TST-492005: the end of a job run from a handed-over task holds no draft", async () => {
  await world(async (w) => {
    const job = w.queue(JOB(ID(1), "with the hand-over"));
    w.watch(3_600_000);
    await w.handOver(job, TASK);
    await w.ended(job);
    const end = w.originText(job.path).split(/^## End$/m)[1];
    assert.match(end, /^state: done$/m);
    assert.doesNotMatch(end, /```json/);
    assert.doesNotMatch(end, /Done\./);
  });
});
