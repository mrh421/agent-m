// The Bridge runs its agents' jobs (ITM-367), end to end through the started Bridge: the source-folder app of ITM-276 is started in Electron as tests/desktop-shell.test.mjs starts it, with its settings naming one
// offered agent with a working folder and one served product, and a job is handed over through the Bridge's API on loopback. As the accepted texts state it — docs/architecture/MOD-bridge-jobs.md, `POST /v1/jobs`: "a
// job the page handed over: its start record is already committed by the person's click; the Bridge takes it and runs it as a queued job, from its record [...]. Errors: `invalid-request` for an agent this Bridge does
// not offer"; MOD-bridge-http.md, `serveBridge`: "It answers a request only with the pairing token, whatever its route"; MOD-desktop-shell.md, Start: "registers with the job runner the strategies of every kind a Bridge
// may run; starts the server on `127.0.0.1` [...] with the handlers of MOD-bridge-jobs" — and UC-011.
// Run: node --test tests/desktop-shell-bridge-jobs.test.mjs
//
// Module: MOD-desktop-shell, MOD-bridge-jobs, MOD-bridge-http
// Guards: UC-011; THE LOCAL BRIDGE REQUIRES A TOKEN; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; THE BRIDGE FINDS THE INSTALLED AGENTS
// Level: component
//
// Not tested again here, where other tests hold it: pause (503 `paused`) and the loopback bind in TST-276002 and the other cases of tests/desktop-shell.test.mjs; Quit ending a running job as cancelled in
// tests/mod-desktop-shell-quit-jobs.test.mjs (TST-1055104); the composition's settings, strategy list and watching lifecycle in tests/mod-desktop-shell-jobs-composition.test.mjs (TST-367001 to TST-367003); a hand-over
// of a job with a fake host in tests/bridge-jobs-watch.test.mjs.
//
// One Bridge is started for the three cases and stopped at the end. Nothing reaches the network and no real agent starts: the instance and the product are bare repositories in a temporary folder that git reaches through
// its own `url.<path>.insteadOf`, as the computer's login would reach github.com; the agents are fixture executables — opencode, offered, and codex, installed and not offered — put first on the Bridge's PATH. The offered agent runs in the Bridge's real enclosure (MOD-agent-enclosure; ARC-054), as on a person's computer: on Linux bubblewrap, which the CI setup installs and allows to make user namespaces (tests/test-schedule-setup.sh); opencode writes the folder of each start into its own home, the one place besides the job's folders it may write. The job
// is of the kind close-sprint, whose recipe, check and writer are the real ones the Bridge registers (MOD-work-plans' workStrategies); the fixture opencode answers it with a close of the sprint and the folder it was started
// in. The Bridge reads its product once an hour (`every`), so that a job runs only when it is handed over. Where the texts leave a reading open, the test states the one it takes:
//   - "nothing reaches the agent" is read at the agent: a start of the fixture executable (other than its version and login probes) is written down, and the count of them is the same after the refused request as before.
//   - "its results land open on the served repository": the commit of the writer is on the served repository's default branch, without an approval record.
// Each wait is for the state the test asserts (a condition, not a time). The counter-proofs are recorded in the pull request.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import test, { after, before } from "node:test";
import { startRecord } from "../src/job-ledger/index.mjs";
import { saveSettings } from "../src/desktop-shell/settings.mjs";
import { unusedPorts } from "./desktop-shell.d/ports.mjs";
import { wait } from "./desktop-shell.d/wait.mjs";
import { NO_VIRTUAL_SCREEN, holdLock, releaseLock, stageApp, startApp } from "./desktop-shell.d/electron.mjs";

// The one lock the native Electron tests of a machine share, and the Electron of this file's own cache folder. The Bridge the cases share is started by the first of them (theBridge) and stopped, with its
// computer removed, before the lock is given back.
const nativeFixtureLock = join(tmpdir(), "agent-m-276-native-fixture-lock");
const electronCache = join(tmpdir(), "agent-m-367-component-electron-44");
let executable, started = null;
if (!NO_VIRTUAL_SCREEN) {
  before(async () => { executable = await stageApp(electronCache); await holdLock(nativeFixtureLock); });
  after(async () => {
    try {
      const world = started ? await started.catch(() => null) : null;
      if (world) { await world.app.stop(); rmSync(world.root, { recursive: true, force: true }); }
    } finally { releaseLock(); }
  });
}

// The git of this test and of the Bridge it starts has no configuration of the machine and an identity of its own (as tests/bridge-jobs-watch.test.mjs sets it): a runner has no global identity. The test's own
// calls take it from this process's environment, the Bridge's from the environment it is started with (`environment` below).
const GIT_IDENTITY = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_TERMINAL_PROMPT: "0", GIT_AUTHOR_NAME: "Seed", GIT_AUTHOR_EMAIL: "seed@example.org", GIT_COMMITTER_NAME: "Seed", GIT_COMMITTER_EMAIL: "seed@example.org" };
Object.assign(process.env, GIT_IDENTITY);
const REAL_GIT =spawnSync("sh", ["-c", "command -v git"], { encoding: "utf8" }).stdout.trim();
const INSTANCE_ADDRESS = "https://github.com/release-owner/release-frame", PRODUCT = "https://github.com/acme/product-a";
const ORIGIN = "https://release-owner.github.io", TOKEN_HEADER = "x-agent-m-bridge-token";
const git = (cwd, ...args) => {
  const result = spawnSync(REAL_GIT, args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${result.stderr}`);
  return result.stdout.trim();
};
const script = (bin, name, body) => writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });

const ROW = (name, route) => `| ${name} | CLI agent | example-model | 200000 | — | draft text, read the repository, write to the repository | this machine | ${route} |`;
const PARTICIPANTS = `# Participants of this instance\n\n**REGISTER**\n\nThe participants of the test instance.\n\n| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|\n${[ROW("drafter", "bridge lab-pc agent opencode"), ROW("codex-drafter", "bridge lab-pc agent codex")].join("\n")}\n`;
const SPRINT = (number) => `---\nsprint: ${number}\ngoal: The fixture sprint\nstart: 2026-10-12\nend: 2026-10-19\ncloser: alice\nbranch:\nselection:\n---\n# team1 Sprint ${number}\n`;
const SPRINT_FILE = (number) => `docs/backlog/sprints/team1/0${number}.md`;
// The close the fixture opencode answers with: the sprint it closes, and, as the source of its feedback, the folder it was started in (the placeholder is replaced by the executable).
const CLOSE = (number) => ({ draft: { sprint: `team1/0${number}`, review: { feedback: [{ line: "No stakeholder took part", goes: "noted", item: null }], tookPart: [], sources: ["@PWD@"] },
  unfinished: [], retrospective: [{ text: `Closed by the fixture agent of sprint ${number}`, kind: "went well", goes: null }], newItems: [] }, answers: [] });
const JOB = (id, participant, number) => ({ id, kind: "close-sprint", worksOn: ["A JOB IS RECORDED IN ITS PRODUCT REPOSITORY"], participant, model: "example-model", route: "bridge lab-pc", run: null, retries: null,
  startedBy: "alice", start: new Date("2026-10-11T09:00:00Z"), agentM: { version: "2026.10.0", commit: null }, inputs: [], limit: 3,
  destinations: [{ participant, place: "this machine", parts: [SPRINT_FILE(number)] }], params: { sprint: `team1/0${number}` } });

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

// The computer of the Bridge and the Bridge started on it, once: the fixture agents, the instance, the product with two sprints, the settings, the started app and its pairing token. -> the world of the cases.
function theBridge() {
  started ??= (async () => {
    // Not below /tmp: the Linux enclosure gives the agent a private /tmp (MOD-agent-enclosure, Data), where the fixture agents and their answers would not be.
    const root = realpathSync(mkdtempSync(join(process.platform === "linux" ? "/var/tmp" : tmpdir(), "agent-m-367-")));
    const bin = join(root, "bin"), work = join(root, "work-opencode"), data = join(root, "data"), answers = join(root, "answers");
    const calls = join(work, "home", "opencode-calls"), codexCalls = join(root, "codex-calls");
    for (const folder of [bin, work, data, answers]) mkdirSync(folder);
    writeFileSync(codexCalls, "");
    // opencode answers a task with the event in `answers/next` (the folder it runs in in place of @PWD@), and writes down the folder of each start of a task; codex, installed and not offered, writes down every call it gets.
    script(bin, "opencode", `case "$1" in --version) echo 1.4.0;; auth) echo '1 credentials';; models) echo opencode/big-pickle;;
run) printf '%s\\n' "$PWD" >> ${calls}; sed "s|@PWD@|$PWD|" ${answers}/next
printf '%s\\n' '{"type":"step_finish","part":{"tokens":{"input":11,"output":7}}}';; esac`);
    script(bin, "codex", `printf '%s\\n' "$*" >> ${codexCalls}\ncase "$*" in '--version') echo 'codex 1.2.3';; 'login status') echo 'Logged in';; *) echo ok;; esac`);
    const answerWith = (number) => writeFileSync(join(answers, "next"), `${JSON.stringify({ type: "text", part: { text: JSON.stringify(CLOSE(number)) } })}\n`);
    const instance = repository(root, "instance", { "docs/participants.md": PARTICIPANTS });
    const first = git(instance.seed, "rev-parse", "HEAD");
    const product = repository(root, "product-a", { "README.md": "A\n", [SPRINT_FILE(1)]: SPRINT(1), [SPRINT_FILE(2)]: SPRINT(2) });
    const queue = (job) => {
      const { path, text } = startRecord({ ...job, agentM: { version: "2026.10.0", commit: first } });
      return { path, text, id: job.id, commit: push(product.seed, { [path]: text }, `queue ${job.id}`) };
    };
    const originText = (path) => spawnSync(REAL_GIT, ["--git-dir", product.origin, "show", `main:${path}`], { encoding: "utf8" }).stdout;
    const [port] = await unusedPorts(1);
    saveSettings(data, { "agent-m-bridge-settings": 1, name: "lab-pc", port, agents: [{ name: "opencode", folder: work }], products: [PRODUCT], every: 3600, paused: false, jumpHost: null, tunnels: [] });
    const pairs = [[INSTANCE_ADDRESS, instance.origin], [PRODUCT, product.origin]];
    const environment = { ...GIT_IDENTITY, PATH: `${bin}${delimiter}${process.env.PATH}`, GIT_CONFIG_COUNT: String(pairs.length) };
    pairs.forEach(([address, path], at) => { environment[`GIT_CONFIG_KEY_${at}`] = `url.${path}.insteadOf`; environment[`GIT_CONFIG_VALUE_${at}`] = address; });
    const app = startApp({ executable, dataFolder: data, port, environment });
    const base = `http://127.0.0.1:${port}`;
    const world = { root, work, app, queue, originText, answerWith, base, token: null,
      request: (method, path, { token = world.token, body } = {}) => fetch(`${base}${path}`, { method, headers: { origin: ORIGIN, ...(token ? { [TOKEN_HEADER]: token } : {}), "content-type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) }),
      starts: () => (existsSync(calls) ? readFileSync(calls, "utf8").trim().split("\n").filter(Boolean) : []),
      codexCalls: () => readFileSync(codexCalls, "utf8").trim().split("\n").filter(Boolean),
      originFiles: () => git(root, "--git-dir", product.origin, "ls-tree", "-r", "--name-only", "main").split("\n") };
    try {
      world.token = await wait("the pairing token file exists", () => existsSync(join(data, "pairing-token")) && readFileSync(join(data, "pairing-token"), "utf8").trim(), app.alive, 60000);
      await wait("the Bridge answers /v1/pair with its token", async () => (await world.request("GET", "/v1/pair")).status === 200, app.alive, 60000);
    } catch (failure) { await app.stop(); rmSync(root, { recursive: true, force: true }); throw failure; }
    return world;
  })();
  return started;
}
// TST-367004 · level: component · module: MOD-desktop-shell, MOD-bridge-jobs, MOD-bridge-http
// guards: UC-011; THE LOCAL BRIDGE REQUIRES A TOKEN; A LOCAL AGENT USES THE PERSON'S OWN LOGIN; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the started source-folder Bridge named lab-pc, offering opencode with a working folder and serving one product, whose repository holds a queued job record of the kind close-sprint for the participant drafter (route: this Bridge's opencode); the fixture opencode, which answers with a close of the sprint and the folder it was started in
// input: POST /v1/jobs with the pairing token, the product, the record and the commit that holds it; wait until the served repository's record ends
// expect: 200 with the job's identifier; the record is taken once by lab-pc and ends `done`, its results the writer's commit and the sprint's file; that commit is on the served repository's default branch and the sprint's file holds the review naming <working folder>/jobs/<id> as its source and the agent's retrospective, with no approval record in the repository; opencode was started once, in that folder, whose working clone is removed; GET /v1/jobs lists the job `done` and its log has ended
test("TST-367004: a job handed over with the pairing token runs in the agent's working folder, and its results and end record land on the served repository", { timeout: 90000, concurrency: false, skip: NO_VIRTUAL_SCREEN }, async () => {
  const w = await theBridge();
  const startsBefore = w.starts().length;
  const job = w.queue(JOB("JOB-20261011-0901-aaa1", "drafter", 1));
  w.answerWith(1);
  const handed = await w.request("POST", "/v1/jobs", { body: { product: PRODUCT, record: job.path, commit: job.commit } });
  assert.equal(handed.status, 200, `the hand-over was accepted (app output: ${w.app.output()})`);
  assert.deepEqual(await handed.json(), { accepted: job.id });
  await wait("the served repository's record ends", () => /^## End$/m.test(w.originText(job.path)), w.app.alive, 60000);

  const record = w.originText(job.path), folder = join(w.work, "jobs", job.id);
  assert.equal((record.match(/^## Taken$/gm) ?? []).length, 1);
  assert.match(record, /^by: lab-pc$/m);
  assert.match(record, /^state: done$/m);
  const commit = git(w.root, "--git-dir", join(w.root, "product-a.git"), "log", "--format=%H", "-1", "--", SPRINT_FILE(1));
  assert.match(record, new RegExp(`^results: ${commit}, ${SPRINT_FILE(1).replaceAll(".", "\\.")}$`, "m"));
  const sprint = w.originText(SPRINT_FILE(1));
  assert.match(sprint, /^## Review$/m);
  assert.ok(sprint.includes(`Sources of the feedback: ${folder}.`), `the sprint's review names the agent's working folder ${folder}`);
  assert.match(sprint, /^- went well: Closed by the fixture agent of sprint 1$/m);
  assert.deepEqual(w.originFiles().filter((path) => path.startsWith("docs/approvals/")), [], "the results land open: no approval record");
  assert.deepEqual(w.starts().slice(startsBefore), [folder], "opencode was started once, in the job's folder of its working folder");
  assert.equal(existsSync(folder), false, "the working clone is removed");
  const listed = await (await w.request("GET", "/v1/jobs")).json();
  assert.deepEqual(listed.jobs.filter(({ id }) => id === job.id).map(({ id, state, agent }) => [id, state, agent]), [[job.id, "done", "opencode"]]);
  assert.equal((await (await w.request("GET", `/v1/jobs/${job.id}/log`)).json()).ended, true);
});

// TST-367005 · level: component · module: MOD-desktop-shell, MOD-bridge-jobs, MOD-bridge-http
// guards: UC-011; THE BRIDGE FINDS THE INSTALLED AGENTS; THE LOCAL BRIDGE REQUIRES A TOKEN
// given: the Bridge of TST-367004; codex installed on the computer and not offered by the settings, opencode offered; a queued job record for the participant codex-drafter, whose route names this Bridge's codex
// input: GET /v1/agents; POST /v1/jobs with the pairing token for that record
// expect: the agents offered are opencode alone and codex is in neither list (known positive: the Bridge sees codex installed and offers what its settings name); the hand-over is refused 422 `invalid-request` naming the participant; the record on the served repository is exactly as committed; codex was called by the probes of the installed agents only, never to run a task (`exec`); opencode was not started for it; the Bridge lists no job of it
test("TST-367005: a job for an agent the Bridge does not offer is refused, and its agent is not started", { timeout: 90000, concurrency: false, skip: NO_VIRTUAL_SCREEN }, async () => {
  const w = await theBridge();
  const startsBefore = w.starts().length;
  const agents = await (await w.request("GET", "/v1/agents")).json();
  assert.deepEqual(agents.agents.map(({ name }) => name), ["opencode"], "known positive: opencode is offered");
  assert.equal(agents.missing.some(({ name }) => name === "codex"), false, "codex is installed on the computer");
  const job = w.queue(JOB("JOB-20261011-0902-aaa2", "codex-drafter", 2));
  const refused = await w.request("POST", "/v1/jobs", { body: { product: PRODUCT, record: job.path, commit: job.commit } });
  assert.equal(refused.status, 422);
  const answer = await refused.json();
  assert.equal(answer.error, "invalid-request");
  assert.match(answer.message, /does not offer the agent of codex-drafter/);
  assert.equal(w.originText(job.path), job.text, "the record is as committed");
  assert.equal(w.starts().length, startsBefore, "opencode was not started for it");
  const codex = w.codexCalls();
  assert.ok(codex.length >= 1 && codex.every((line) => line === "--version" || line === "login status"), `codex was only probed: ${codex.join("; ")}`);
  assert.equal(existsSync(join(w.work, "jobs", job.id)), false);
  assert.equal((await (await w.request("GET", "/v1/jobs")).json()).jobs.some(({ id }) => id === job.id), false);
});

// TST-367006 · level: component · module: MOD-desktop-shell, MOD-bridge-jobs, MOD-bridge-http
// guards: UC-011; THE LOCAL BRIDGE REQUIRES A TOKEN; A LOCAL AGENT USES THE PERSON'S OWN LOGIN
// given: the Bridge of TST-367004 and a queued job record for the participant drafter (this Bridge's opencode); the fixture opencode
// input: POST /v1/jobs for the record without the token and with another token; POST /v1/ask and POST /v1/probes/agent for opencode without the token; then POST /v1/jobs for the record with the pairing token
// expect: each request without the token is refused 401 `token-refused`; the record is exactly as committed and opencode has been started no more often than before; with the token the same hand-over is accepted and opencode runs the job, which ends `done` (known positive)
test("TST-367006: without the pairing token nothing reaches the agent, and the same hand-over with it runs the job", { timeout: 90000, concurrency: false, skip: NO_VIRTUAL_SCREEN }, async () => {
  const w = await theBridge();
  const startsBefore = w.starts().length;
  const job = w.queue(JOB("JOB-20261011-0903-aaa3", "drafter", 2));
  w.answerWith(2);
  const handOver = { product: PRODUCT, record: job.path, commit: job.commit };
  const refusals = [
    ["POST /v1/jobs without a token", await w.request("POST", "/v1/jobs", { token: null, body: handOver })],
    ["POST /v1/jobs with another token", await w.request("POST", "/v1/jobs", { token: "another-token", body: handOver })],
    ["POST /v1/ask without a token", await w.request("POST", "/v1/ask", { token: null, body: { agent: "opencode", input: "Say hello." } })],
    ["POST /v1/probes/agent without a token", await w.request("POST", "/v1/probes/agent", { token: null, body: { args: { agent: "opencode" } } })],
  ];
  for (const [what, answer] of refusals) {
    assert.equal(answer.status, 401, what);
    assert.equal((await answer.json()).error, "token-refused", what);
  }
  assert.equal(w.originText(job.path), job.text, "the record is as committed");
  assert.equal(w.starts().length, startsBefore, "opencode was not started");
  assert.equal(existsSync(join(w.work, "jobs", job.id)), false);

  const handed = await w.request("POST", "/v1/jobs", { body: handOver });
  assert.equal(handed.status, 200, `with the token the hand-over is accepted (app output: ${w.app.output()})`);
  await wait("the served repository's record ends", () => /^## End$/m.test(w.originText(job.path)), w.app.alive, 60000);
  assert.match(w.originText(job.path), /^state: done$/m);
  assert.deepEqual(w.starts().slice(startsBefore), [join(w.work, "jobs", job.id)], "opencode was started once, for the job");
});
