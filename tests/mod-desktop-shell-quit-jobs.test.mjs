// Quitting the Bridge ends the jobs it names as cancelled (ITM-1055), as MOD-desktop-shell's accepted text states it (docs/architecture/MOD-desktop-shell.md:179-181: "*Quit* names the jobs still running, which then end as
// cancelled, and stops the watching, the tunnels and the server") and UC-044 7b (docs/use-cases/UC-044*.md:143-144): "Jobs running there end as *cancelled*". This file starts the app's real entry, src/desktop-shell/main.mjs,
// over a constructed Electron (tests/desktop-shell.d/entry.mjs) with the real composition: two jobs queued in a product repository run on two fixture agents (opencode and claude) that wait for a gate; the window's request
// running-jobs names both; the quit the window asks for after the person's confirmation (`quit`, then Electron's before-quit) stops the Bridge.
// Run: node --test tests/mod-desktop-shell-quit-jobs.test.mjs
//
// Module: MOD-desktop-shell
// Guards: THE BRIDGE RUNS AS AN APP; A CANCELLED JOB WRITES NOTHING MORE; UC-044
// Level: unit
//
// Deterministic, no network, no real agent (the test waits for its agents as long as the Bridge goes on working, see `until`): the instance and the product are bare repositories in a temporary folder that git reaches through its own `url.<path>.insteadOf`; the agents are fixture executables named
// opencode and claude, which with two wrappers for git and sleep are the whole PATH of the test. The kind is decide-gate, whose recipe and writer the test registers. Each test states its input and its expected result before it runs
// (given / input / expect). The counter-proofs are in the pull request.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import { unusedPorts } from "./desktop-shell.d/ports.mjs";
import { startEntry, stopEntry, temporary } from "./desktop-shell.d/entry.mjs";
import { saveSettings } from "../src/desktop-shell/settings.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";
Object.assign(process.env, { GIT_AUTHOR_NAME: "Seed", GIT_AUTHOR_EMAIL: "seed@example.org", GIT_COMMITTER_NAME: "Seed", GIT_COMMITTER_EMAIL: "seed@example.org" });
const REAL_GIT = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
const REAL_SLEEP = spawnSync("sh", ["-c", "command -v sleep"], { encoding: "utf8" }).stdout.trim();
const INSTANCE_NAME = "carol/instance-x", PRODUCT = "https://github.com/acme/product-a";

registerStrategies("tests/mod-desktop-shell-quit-jobs.test.mjs", {
  recipes: { "gate-inputs": async () => [{ name: "the gate", text: "Decide the gate.", sources: [], required: true, artifacts: [] }] },
  writers: { "gate-record": async (result, context) => {
    const path = `docs/gates/${context.jobId}.md`;
    const { defaultBranch } = await context.product.host.repositoryInfo();
    const { commit } = await context.product.host.commitFiles({ branch: defaultBranch, expectedHead: context.product.snapshot.commit, files: [{ path, text: "decided\n" }], message: `gate ${context.jobId}` });
    return { commits: [commit], files: [path], pullRequest: null, shown: null, notes: [] };
  } },
});

function git(cwd, ...args) {
  const r = spawnSync(REAL_GIT, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
const script = (bin, name, body) => writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
const ROW = (name, route) => `| ${name} | CLI agent | example-model | 200000 | — | draft text, read the repository | this machine | ${route} |`;
const PARTICIPANTS = `# Participants of this instance\n\n**REGISTER**\n\nThe participants of the test instance.\n\n| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|\n${[ROW("drafter", "bridge lab-pc agent opencode"), ROW("claude-drafter", "bridge lab-pc agent claude")].join("\n")}\n`;
function push(seed, files, message) {
  spawnSync(REAL_GIT, ["fetch", "-q", "origin"], { cwd: seed });
  spawnSync(REAL_GIT, ["reset", "-q", "--hard", "origin/main"], { cwd: seed });
  for (const [path, text] of Object.entries(files)) { mkdirSync(join(seed, path, ".."), { recursive: true }); writeFileSync(join(seed, path), text); }
  git(seed, "add", "-A"); git(seed, "commit", "-q", "-m", message); git(seed, "push", "-q", "origin", "HEAD:refs/heads/main");
  return git(seed, "rev-parse", "HEAD");
}
function repository(root, name, files) {
  const origin = join(root, `${name}.git`), seed = join(root, `${name}-seed`);
  git(root, "init", "-q", "--bare", "-b", "main", origin); git(root, "clone", "-q", origin, seed); push(seed, files, "first");
  return { origin, seed };
}
const JOB = (id, participant) => ({ id, kind: "decide-gate", worksOn: ["A JOB IS RECORDED IN ITS PRODUCT REPOSITORY"], participant, model: "example-model", route: "bridge lab-pc", run: null, retries: null,
  startedBy: "alice", start: new Date("2026-10-11T09:00:00Z"), agentM: { version: "2026.10.0", commit: null }, inputs: [], limit: 3,
  destinations: [{ participant, place: "this machine", parts: ["the gate"] }], params: {} });

// The Bridge's computer: the fixture agents wait for a gate file that is never opened; each writes a mark to `calls` when it starts. -> the world given to `run`.
async function world(run) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-1055-")));
  const bin = join(root, "bin"), calls = join(root, "calls"), gate = join(root, "gate"), gits = join(root, "git-calls");
  mkdirSync(bin); writeFileSync(calls, ""); writeFileSync(gits, "");
  // Every call of git is written down, so that the test can tell a Bridge that is slow from one that has stopped; QUIT_TEST_GIT_DELAY (seconds) slows each call, as a loaded runner does.
  const slow = process.env.QUIT_TEST_GIT_DELAY ? `${REAL_SLEEP} ${process.env.QUIT_TEST_GIT_DELAY}; ` : "";
  script(bin, "git", `printf '.' >> ${gits}; ${slow}exec ${REAL_GIT} "$@"`); script(bin, "sleep", `exec ${REAL_SLEEP} "$@"`);
  const answer = JSON.stringify({ draft: { decision: "passed", reason: "ok" }, answers: [] });
  const event = JSON.stringify({ type: "text", part: { text: answer } });
  script(bin, "opencode", `case "$1" in --version) echo 1.4.0;; auth) echo '1 credentials';; models) echo opencode/big-pickle;;
run) printf '%s\\n' "opencode started" >> ${calls}; while [ ! -e ${gate} ]; do sleep 0.02; done
printf '%s\\n' '${event}' '{"type":"step_finish","part":{"tokens":{"input":1,"output":1}}}';; esac`);
  script(bin, "claude", `case "$1" in --version) echo 2.1.300;; auth) exit 0;;
-p) printf '%s\\n' "claude started" >> ${calls}; while [ ! -e ${gate} ]; do sleep 0.02; done; printf '%s\\n' '${answer}';; esac`);
  const instance = repository(root, "instance", { "docs/participants.md": PARTICIPANTS, "marker.md": "v1\n" });
  const first = git(instance.seed, "rev-parse", "HEAD");
  const product = repository(root, "product-a", { "README.md": "A\n" });
  const queue = (job) => {
    const { path, text } = startRecord({ ...job, agentM: { version: "2026.10.0", commit: first } });
    return { path, id: job.id, commit: push(product.seed, { [path]: text }, `queue ${job.id}`) };
  };
  const pairs = [[`https://github.com/${INSTANCE_NAME}`, instance.origin], [PRODUCT, product.origin]];
  process.env.GIT_CONFIG_COUNT = String(pairs.length);
  pairs.forEach(([address, path], at) => { process.env[`GIT_CONFIG_KEY_${at}`] = `url.${path}.insteadOf`; process.env[`GIT_CONFIG_VALUE_${at}`] = address; });
  const originText = (path) => spawnSync(REAL_GIT, ["--git-dir", product.origin, "show", `main:${path}`], { encoding: "utf8" }).stdout;
  // The wait is for the state the test asserts. The Bridge reaches it through a long chain of git calls (clones, fetches, the taking of each job, a working clone), so how long it takes depends on the machine.
  // The wait therefore ends when the state holds, or when the Bridge has made no progress - no call of git, no agent started - for `stall` ms, which is a Bridge that has stopped, or when `total` ms have passed,
  // which is a Bridge so slow that the CI job's own limit of two minutes (SPEC.md, tests/test_ci_budget.py) would stop the whole shard with no test to name the cause. Either way it says what the Bridge had done.
  const progress = () => statSync(gits).size + readFileSync(calls, "utf8").length;
  const done = () => `${readFileSync(calls, "utf8").trim().split("\n").filter(Boolean).length} agents started, ${statSync(gits).size} calls of git`;
  const until = async (condition, what, { stall = 30000, total = 60000, failed = async () => null } = {}) => {
    const begun = Date.now();
    let seen = progress(), since = begun;
    for (;;) {
      const found = await condition(); if (found) return found;
      const why = await failed(); if (why) assert.fail(`waited for ${what}, but ${why}`);
      if (progress() !== seen) { seen = progress(); since = Date.now(); }
      else if (Date.now() - since > stall) assert.fail(`waited for ${what}: nothing happened for ${stall} ms (${done()})`);
      if (Date.now() - begun > total) assert.fail(`waited for ${what}: still not there after ${total} ms, too slow for the CI job's limit (${done()})`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  };
  const prior = process.env.PATH;
  process.env.PATH = bin;
  try {
    return await run({ root, queue, originText, until, started: () => readFileSync(calls, "utf8").trim().split("\n").filter(Boolean), folder: (name) => { const path = join(root, name); mkdirSync(path); return path; } });
  } finally {
    process.env.PATH = prior;
    for (const key of Object.keys(process.env)) if (key.startsWith("GIT_CONFIG_") && key !== "GIT_CONFIG_GLOBAL" && key !== "GIT_CONFIG_SYSTEM") delete process.env[key];
    rmSync(root, { recursive: true, force: true });
  }
}

// TST-1055104 · level: unit · module: MOD-desktop-shell
// guards: THE BRIDGE RUNS AS AN APP; A CANCELLED JOB WRITES NOTHING MORE; UC-044
// given: the app started over a Bridge that watches a product with two queued jobs, one for each of two fixture agents (opencode, claude) that wait for a gate which is never opened
// input: wait until both agents run; the window's request running-jobs; the quit the window asks for after the person's confirmation (the ipc request quit, then Electron's before-quit)
// expect: running-jobs names both job identifiers, each running; after the quit both records end `state: cancelled` with the reason "the Bridge was quit", once each, and no file of the writer is on the product
test("confirming Quit with two jobs running ends both records as cancelled", async () => {
  await world(async (w) => {
    const first = w.queue(JOB("JOB-20261011-0901-aaa1", "drafter")), second = w.queue(JOB("JOB-20261011-0902-aaa2", "claude-drafter"));
    const appData = temporary(), data = temporary(), resources = temporary();
    const [port] = await unusedPorts(1);
    saveSettings(data, { "agent-m-bridge-settings": 1, name: "lab-pc", port, agents: [{ name: "opencode", folder: w.folder("work-opencode") }, { name: "claude", folder: w.folder("work-claude") }],
      products: [PRODUCT], every: 1, paused: false, jumpHost: null, tunnels: [] });
    const entry = await startEntry({ resources, appData, argv: [`--instance=${INSTANCE_NAME}`, "--origin=https://carol.github.io", `--port=${port}`, `--data-folder=${data}`] });
    try {
      assert.equal(entry.outcome.kind, "loaded", `the entry started (errors: ${entry.errors.join(" | ")})`);
      // A Bridge that failed to start (a port taken, a folder not writable) says so in its state: that is the failure to report, not a wait.
      const startFailure = async () => { const state = await entry.fake.handlers["bridge-state"]({}); return state.failure ? `the Bridge did not start: ${state.failure.name}: ${state.failure.message}` : null; };
      await w.until(() => w.started().length === 2, "both agents to start", { failed: startFailure });
      const { jobs } = await entry.fake.handlers["bridge-state"]({}, "running-jobs");
      assert.deepEqual(jobs.map((job) => [job.id, job.state]).sort(), [[first.id, "running"], [second.id, "running"]]);
      await entry.fake.handlers.quit({});
      entry.fake.appEvents["before-quit"]({ preventDefault() {} });
      await entry.fake.whenExited;
      for (const job of [first, second]) {
        const record = w.originText(job.path);
        assert.equal((record.match(/^## End$/gm) ?? []).length, 1, `${job.id} ends once`);
        assert.match(record, /^state: cancelled$/m, `${job.id} is cancelled`);
        assert.match(record, /^reason: the Bridge was quit$/m);
        assert.equal(w.originText(`docs/gates/${job.id}.md`), "", "the writer wrote nothing");
      }
    } finally { await stopEntry(entry); for (const folder of [appData, data, resources]) rmSync(folder, { recursive: true, force: true }); }
  });
});
