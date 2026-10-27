// MOD-bridge-jobs' startWatching starts an agent's sprint close (ITM-1033), as the accepted text of docs/architecture/MOD-bridge-jobs.md states it (blob e7a5d58c4abbe6ef7319abd6bcc01e1ee256746f, :127-130):
// "a sprint whose close the product assigned to one of this Bridge's agents is closed by that agent, once, when MOD-work-plans' `sprintsToClose` names it — its time box ended, or, without one, every selected item
// done or ended by the Product Owner. A product that cannot be read is skipped with its reason, and read again at the next interval."; UC-041, `A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF`.
// Run: node --test tests/bridge-jobs-sprint-close.test.mjs
//
// Module: MOD-bridge-jobs
// Guards: A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF; CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// Level: unit
//
// Deterministic, no network, no real agent: the world is that of tests/bridge-jobs-watch.test.mjs (the instance and the products are bare repositories in a temporary folder that git reaches through its own
// `url.<path>.insteadOf`; the agent is a fixture executable named opencode that is the whole PATH of a test), with the kind close-sprint, whose recipe, check and writer this test registers as fixtures (below).
// The readings, named in the pull request:
//   - A sprint whose close the product assigned to one of this Bridge's agents is one whose record's `closer` is a participant whose route reads `bridge <this Bridge> agent <an agent this Bridge offers with a folder>`.
//   - It is closed "once": the Bridge queues the close of a sprint when the product holds no record of a `close-sprint` job for that sprint, in any state; a close that failed is not queued again by the Bridge.
//   - The close is a job of the kind close-sprint, working on the items of the sprint's selection, its parameter `sprint` the sprint's name `<team>/<nn>`, queued by the Bridge for its own route and taken and run
//     by the same watch round (a commit only on the head read), as any queued job of the Bridge is.
// Each test states its input and its expected result before it runs (given / input / expect); where a test expects a sprint to be left alone, a sprint of this Bridge is first shown to be closed. The counter-proofs are
// recorded in the pull request.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { startRecord } from "../src/job-ledger/index.mjs";
import * as bridgeJobs from "../src/bridge-jobs/index.mjs";

const { jobHandlers, startWatching, stopWatching } = bridgeJobs;
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";
Object.assign(process.env, { GIT_AUTHOR_NAME: "Seed", GIT_AUTHOR_EMAIL: "seed@example.org", GIT_COMMITTER_NAME: "Seed", GIT_COMMITTER_EMAIL: "seed@example.org" });
const REAL_GIT = spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
const REAL_SLEEP = spawnSync("sh", ["-c", "command -v sleep"], { encoding: "utf8" }).stdout.trim();

const INSTANCE = "https://github.com/acme/agent-m", PRODUCT_A = "https://github.com/acme/product-a", PRODUCT_B = "https://github.com/acme/product-b";

// ---------------------------------------------------------------- the strategies of close-sprint, as fixtures
// The kind close-sprint names the recipe sprint-facts, the check sprint-record-checks and the writer sprint-record, which belong to MOD-work-plans; this test registers fixtures of its own, so that what it
// checks is what the Bridge does: the recipe gives one part, the check finds nothing, the writer commits a file that shows which sprint the job closed and in which working folder the agent worked.

registerStrategies("tests/bridge-jobs-sprint-close.test.mjs", {
  recipes: { "sprint-facts": async () => [{ name: "the sprint", text: "Close the sprint.", sources: [], required: true, artifacts: [] }] },
  checks: { "sprint-record-checks": () => [] },
  writers: { "sprint-record": async (result, context) => {
    const path = `docs/closes/${context.jobId}.md`;
    const { defaultBranch } = await context.product.host.repositoryInfo();
    const { commit } = await context.product.host.commitFiles({ branch: defaultBranch, expectedHead: context.product.snapshot.commit,
      files: [{ path, text: `sprint: ${context.params.sprint}\nworking folder: ${result.draft.review.sources[0]}\n` }], message: `close ${context.params.sprint}` });
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
const ROW = (name, type, route) => `| ${name} | ${type} | example-model | 200000 | — | draft text, read the repository, write to the repository | this machine | ${route} |`;
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
async function world(run, { gated = false, fails = false, productFiles = {} } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "agent-m-327-")));
  const bin = join(root, "bin"), calls = join(root, "calls"), gate = join(root, "gate"), finished = join(root, "finished");
  mkdirSync(bin);
  writeFileSync(calls, "");
  script(bin, "git", `exec ${REAL_GIT} "$@"`);
  script(bin, "sleep", `exec ${REAL_SLEEP} "$@"`);
  const event = JSON.stringify({ type: "text", part: { text: JSON.stringify({ draft: { sprint: "team1/01", review: { feedback: [], tookPart: [], sources: ["@PWD@"] }, unfinished: [], retrospective: [{ text: "Fixtures are quick to build", kind: "went well", goes: null }], newItems: [] }, answers: [] }) } }).replace("@PWD@", `'"$PWD"'`);
  script(bin, "opencode", `case "$1" in --version) echo 1.4.0;; auth) echo '1 credentials';; models) echo opencode/big-pickle;;
run) printf '%s\\n' "$PWD $*" >> ${calls}; ${gated ? `while [ ! -e ${gate} ]; do sleep 0.02; done; ` : ""}${fails ? "echo boom >&2; exit 3; " : ""}printf '%s\\n' ok >> ${finished}
printf '%s\\n' '${event}' '{"type":"step_finish","part":{"tokens":{"input":11,"output":7}}}';; esac`);
  const instance = repository(root, "instance", { "docs/participants.md": PARTICIPANTS, "marker.md": "v1\n" });
  const first = git(instance.seed, "rev-parse", "HEAD");
  push(instance.seed, { "marker.md": "v2\n" }, "second");
  const products = { [PRODUCT_A]: repository(root, "product-a", { "README.md": "A\n", ...productFiles }) };
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
  const until = async (condition, what, ms = 12000) => {
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
      release: () => writeFileSync(gate, ""), finished: () => existsSync(finished), repository: (name, files) => repository(root, name, files) });
  } finally {
    await stopWatching("quit");
    process.env.PATH = prior;
    for (const key of Object.keys(process.env)) if (key.startsWith("GIT_CONFIG_") && key !== "GIT_CONFIG_GLOBAL" && key !== "GIT_CONFIG_SYSTEM") delete process.env[key];
    rmSync(root, { recursive: true, force: true });
  }
}
const watch = (w, agents, extra = {}) => startWatching({ bridgeName: "lab-pc", agents, products: [{ address: PRODUCT_A }], every: 100, instance: INSTANCE, ...extra });
const runs = (w) => w.calls().filter((line) => / run /.test(line));


// Fifteen intervals of 100 ms, enough for the watcher to read the product again after the close ended, however long a round takes on a slow runner.
const quiet = () => new Promise((resolve) => setTimeout(resolve, 1500));

// ---------------------------------------------------------------- the sprints of a product

const item = (id) => ["---", `id: ${id}`, `title: ${id} item`, "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-store", "tests:", "  - unit", "origin:", "  - UC-001", "---", `# ${id} item`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a", ""].join("\n");
const sprint = (number, { end, closer, extra = [] }) => ["---", `sprint: ${number}`, "goal: The fixture sprint", "start: 2026-10-05", `end: ${end}`, `closer: ${closer}`, "branch:", "selection:", "  - ITM-0001", "---", `# team1 Sprint ${number}`, "", ...extra, ""].join("\n");
const PAST = "2026-10-12", FUTURE = "2099-12-31";
const at = (nn) => `docs/backlog/sprints/team1/${nn}.md`;
const files = (sprints) => ({ "docs/backlog/ITM-0001-a.md": item("ITM-0001"), ...Object.fromEntries(Object.entries(sprints).map(([nn, spec]) => [at(nn), sprint(Number(nn), spec)])) });
const closesIn = (w) => spawnSync(REAL_GIT, ["--git-dir", w.products[PRODUCT_A].origin, "ls-tree", "-r", "--name-only", "main", "docs/jobs/"], { encoding: "utf8" }).stdout.split("\n").filter(Boolean);
const closeRecords = (w) => closesIn(w).map((path) => ({ path, text: w.originText(PRODUCT_A, path) })).filter((each) => /^kind: close-sprint$/m.test(each.text));

// TST-1033001 · level: unit · module: MOD-bridge-jobs
// guards: A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF; CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: a served product whose sprint team1/01 ended on 2026-10-12 and whose closer is `drafter`, a participant whose route names this Bridge and opencode, which it offers with a working folder
// input: startWatching with an interval of 100 ms; wait for the job to end; three more intervals
// expect: one record of a job of the kind close-sprint, for `drafter`, on the route `bridge lab-pc agent opencode`, working on ITM-0001 with the parameter sprint team1/01, queued by the Bridge, taken by `lab-pc` and ended `done`; the writer's file shows the sprint
//         it closed and the agent's working folder; the agent was started once, and no second close is queued
// Planted fault: not looking at the records of the sprint's closes queues a close at every interval; not running sprintsToClose runs none.
test("a sprint whose time box ended and whose closer is an agent of this Bridge is closed by that agent, once", async () => {
  await world(async (w) => {
    const folder = w.folder("agent-work");
    watch(w, [{ name: "opencode", folder }]);
    const [record] = await w.until(() => { const found = closeRecords(w); return found.length && /^## End$/m.test(found[0].text) ? found : null; }, "the close to end");
    await quiet(); // several intervals after the close ended: the sprint is due still (the fixture writer closes nothing), so a second close would be queued by now

    const records = closeRecords(w);
    assert.equal(records.length, 1, "one close, however many intervals pass");
    for (const line of ["kind: close-sprint", "participant: drafter", "route: bridge lab-pc agent opencode", "started_by: lab-pc", "  - ITM-0001"]) assert.ok(record.text.includes(line), `the record holds "${line}"`);
    assert.match(record.text, /"sprint":\s*"team1\/01"/);
    assert.equal((record.text.match(/^## Taken$/gm) ?? []).length, 1);
    assert.match(record.text, /^by: lab-pc$/m);
    assert.match(record.text, /^state: done$/m);
    const id = /(JOB-[^/]+)\.md$/.exec(record.path)[1];
    assert.equal(w.originText(PRODUCT_A, `docs/closes/${id}.md`), `sprint: team1/01\nworking folder: ${join(folder, "jobs", id)}\n`);
    assert.equal(runs(w).length, 1, "the agent was started once");
  }, { productFiles: files({ "01": { end: PAST, closer: "drafter" } }) });
});

// TST-1033002 · level: unit · module: MOD-bridge-jobs
// guards: A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF; CLOSING A SPRINT CAN BE ASSIGNED TO A PARTICIPANT
// given: sprints that ended on 2026-10-12 and are closed by other-drafter (a Bridge named other-pc), ci-drafter (a CI route), codex-drafter (this Bridge, an agent it does not offer) and by a closer that is no participant; a sprint closed by drafter whose time box ends in 2099; a sprint closed by drafter that ended and holds its `## Review`; and, to show the watcher reads, team1/07, ended, closed by drafter
// input: startWatching; wait for team1/07's close to end, then three more intervals
// expect: only team1/07 is closed: one close record, for team1/07; the sprints of other closers, the one not ended and the one closed already have none; the agent was started once Planted fault: not testing the closer's route, or not testing the sprint's end, queues a close for one of the others.
test("a sprint closed by another participant, not yet ended or closed already is left alone", async () => {
  await world(async (w) => {
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }]);
    await w.until(() => { const found = closeRecords(w); return found.length && /^## End$/m.test(found[0].text) ? found : null; }, "the close of team1/07 to end");
    await quiet(); // several intervals after the close ended: the sprint is due still (the fixture writer closes nothing), so a second close would be queued by now

    const records = closeRecords(w);
    assert.equal(records.length, 1);
    assert.match(records[0].text, /"sprint":\s*"team1\/07"/);
    assert.equal(runs(w).length, 1);
  }, { productFiles: files({
    "02": { end: PAST, closer: "other-drafter" }, "03": { end: PAST, closer: "ci-drafter" }, "04": { end: PAST, closer: "codex-drafter" }, "05": { end: PAST, closer: "nobody" },
    "06": { end: FUTURE, closer: "drafter" }, "08": { end: PAST, closer: "drafter", extra: ["## Review", "", "closed."] }, "07": { end: PAST, closer: "drafter" } }) });
});

// TST-1033003 · level: unit · module: MOD-bridge-jobs
// guards: A SPRINT CLOSED BY AN AGENT STARTS BY ITSELF
// given: a sprint that ended on 2026-10-12, closed by drafter, for whose close the product holds a record already, queued for drafter (its start committed by someone else, as a page or CI would)
// input: startWatching; wait for the record's end; three more intervals
// expect: the queued close is the one that runs; no second close record is queued by the Bridge; the agent was started once
// Planted fault: queueing a close without looking at the product's close records makes a second record.
test("a close already queued for the sprint is run, and the Bridge queues no second one", async () => {
  await world(async (w) => {
    const queued = w.queue(PRODUCT_A, { ...JOB(ID(1), "drafter"), kind: "close-sprint", worksOn: ["ITM-0001"], params: { sprint: "team1/01" }, route: "bridge lab-pc agent opencode" });
    watch(w, [{ name: "opencode", folder: w.folder("agent-work") }]);
    await w.ended(queued);
    await quiet(); // several intervals after the close ended: the sprint is due still (the fixture writer closes nothing), so a second close would be queued by now

    assert.equal(closeRecords(w).length, 1);
    assert.deepEqual(closeRecords(w).map((each) => each.path), [queued.path]);
    assert.equal(runs(w).length, 1);
  }, { productFiles: files({ "01": { end: PAST, closer: "drafter" } }) });
});
