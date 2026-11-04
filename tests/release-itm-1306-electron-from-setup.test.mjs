// Release tests of ITM-1306 — A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY on the tests that stage Electron: Agent M's own test setup installs Electron 44.5.1 and its executable into
// $HOME/agent-m-electron-44 where it is missing and does nothing where it is there, the schedule's cache names the folder of that executable, and each of the places that stage Electron takes
// the setup's executable first, so that a registry that does not answer after the setup has run changes no test's outcome. The behaviour is MOD-test-schedule (docs/architecture/MOD-test-schedule.md,
// Parts: "the setup installs xvfb and openbox and the Bridge app's packages"; Data: the schedule's `setup` and `cache` — "the paths `setup` fills that the CI service keeps between runs" —, and the
// generated configuration, where `cache` names paths: "one job `agent-m setup` before the test jobs of the run: it runs `setup` once and keeps those paths in the CI service's cache … so that the
// shards restore them instead of all fetching at once"), the item's Outcome (docs/backlog/ITM-1306-the-tests-that-stage-electron-do-not-flip-on-a-registry-fault.md: the setup installs
// `electron@44.5.1` into a folder the schedule's `cache` names, "each of the four places looks there first, as it does for the bundled copy, and keeps its own install as the local fallback") and
// THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE.
// Run: node --test tests/release-itm-1306-electron-from-setup.test.mjs
//
// Module: MOD-test-schedule; MOD-site-frame; MOD-desktop-shell
// Guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY; THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE; A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// Level: release
//
// Written for the release testing of sprint 117 by a participant who implemented none of ITM-1306 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The cases run the real script
// tests/test-schedule-setup.sh under `sh` on a scratch machine (a home, a temporary folder, and `sudo`, `apt-get`, `openbox` and `npm` found first on the PATH as scripts of this file), and then run
// the places that stage Electron themselves — the helper tests/site-usability.d/browser.mjs, the helper tests/desktop-shell.d/electron.mjs and the files tests/desktop-shell.test.mjs,
// tests/release-itm-276-desktop-shell.test.mjs and tests/desktop-shell-bridge-jobs.test.mjs — on the machine the setup left, with npm's registry an address on loopback where nothing listens: none is a copy
// of a place's code. The executable the setup leaves is what the setup's own run and the fake npm's install.js make, not a file planted in its place. Readings the texts leave open, which the cases state:
//   - The fake `npm` stands for the registry being reachable while the setup runs: its install of electron@44.5.1 leaves the package with an install.js, as npm does, and that install.js leaves
//     `dist/electron`, as the real one downloads it; npm's registry is closed only for the runs of the places, which is the item's counter-proof ("after the setup has run").
//   - The files are run as the CI runs them on Linux: a node process whose `process.platform` is `linux` (the layout `dist/electron`), with `xvfb-run` and `openbox` found on the PATH as scripts that
//     answer; the files stage Electron before their cases, so a name pattern that none of their cases matches runs the staging alone (the reading of tests/desktop-shell-electron-from-setup.test.mjs).
//   - "First": before the place's own install, and before the copy a place keeps in its own folder of the temporary directory; the case plants a stand-in there and shows first that the place finds it.
//   - "Does nothing where it is present": the setup calls npm for Electron no more and runs no install.js; its other steps (the Bridge app's packages) are not Electron's.

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { spawn } from "node:child_process";
import { readDocument } from "../src/documents/index.mjs";
import { participantSchema } from "../src/participant-list/index.mjs";
import { resourceSchema } from "../src/resource-list/index.mjs";
import { scheduleSchema, scheduleFindings, ciConfiguration, configurationDrift, occasionsOf } from "../src/test-schedule/index.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const SETUP = join(ROOT, "tests/test-schedule-setup.sh");
const SITE = new URL("../tests/site-usability.d/browser.mjs", import.meta.url).href;
const APP = new URL("../tests/desktop-shell.d/electron.mjs", import.meta.url).href;
const FOLDER = "agent-m-electron-44/node_modules/electron";
const RUNNER_HOME = "/home/runner";
const WORKFLOW = ".github/workflows/agent-m-tests.yml";
const LINUX = ["--import", 'data:text/javascript,Object.defineProperty(process,"platform",{value:"linux"})'];
// A command run in a process of its own, as spawnSync runs it, but without holding this one: its status and what it wrote, or the signal that ended it after `timeout` ms.
const execute = (command, args, { cwd, env, timeout }) => new Promise((resolve) => {
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const timer = setTimeout(() => child.kill("SIGKILL"), timeout);
  child.on("close", (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }); });
});

const work = mkdtempSync(join(tmpdir(), "agent-m-1306-release-"));
after(() => rmSync(work, { recursive: true, force: true }));
const put = (path, text, mode = 0o755) => { mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, text); chmodSync(path, mode); };
// A port on loopback where nothing listens: one the system gave and that is closed again.
const closedPort = () => new Promise((resolve) => { const server = createServer(); server.listen(0, "127.0.0.1", () => { const { port } = server.address(); server.close(() => resolve(port)); }); });

// What the setup's run finds first on its PATH: `sudo` runs its command; `apt-get` installs from the cache and refuses every other call; `openbox` answers its version; `npm` records its
// arguments, one call per line, and ends with 0 — or with 1 for the install of Electron when FAKE_NPM_FAILS is `package` —; its install of electron@44.5.1 leaves the package and an install.js that
// records `install.js` and leaves the executable dist/electron — or ends with 1 when FAKE_NPM_FAILS is `binary`.
const SETUP_TOOLS = {
  sudo: '#!/bin/sh\nexec "$@"\n',
  "apt-get": '#!/bin/sh\ncase " $* " in *" --no-download "*) exit 0;; esac\necho "E: a call outside the cache path: $*" >&2\nexit 100\n',
  openbox: "#!/bin/sh\necho openbox 3.6.1\n",
  npm: `#!/bin/sh
echo "$*" >> "$FAKE_NPM"
case " $* " in *" electron@44.5.1 "*)
  [ "\${FAKE_NPM_FAILS:-}" = package ] && exit 1
  prefix=""; previous=""
  for argument in "$@"; do [ "$previous" = "--prefix" ] && prefix="$argument"; previous="$argument"; done
  mkdir -p "$prefix/node_modules/electron"
  cat > "$prefix/node_modules/electron/install.js" <<'INSTALL'
const fs = require("node:fs"), path = require("node:path");
fs.appendFileSync(process.env.FAKE_NPM, "install.js\\n");
if (process.env.FAKE_NPM_FAILS === "binary") process.exit(1);
fs.mkdirSync(path.join(__dirname, "dist"), { recursive: true });
fs.writeFileSync(path.join(__dirname, "dist/electron"), "#!/bin/sh\\nexit 1\\n", { mode: 0o755 });
INSTALL
  printf '%s\\n' '{"name":"electron","version":"44.5.1"}' > "$prefix/node_modules/electron/package.json";;
esac
exit 0
`,
};
// What a place's run finds first on its PATH, with the real npm behind it: a virtual display and a window manager that answer.
const PLACE_TOOLS = { "xvfb-run": "#!/bin/sh\nexit 0\n", openbox: "#!/bin/sh\necho openbox 3.6.1\n" };

let counter = 0;
/** A scratch machine: a home, a temporary folder, the two folders of tools, and npm's registry closed. */
async function machine() {
  const dir = join(work, `machine-${counter++}`);
  const m = { dir, home: join(dir, "home"), temporary: join(dir, "tmp"), setupTools: join(dir, "setup-tools"), placeTools: join(dir, "place-tools"), calls: join(dir, "npm-calls"), port: await closedPort() };
  mkdirSync(m.home, { recursive: true });
  mkdirSync(m.temporary);
  for (const [name, body] of Object.entries(SETUP_TOOLS)) put(join(m.setupTools, name), body);
  for (const [name, body] of Object.entries(PLACE_TOOLS)) put(join(m.placeTools, name), body);
  writeFileSync(m.calls, "");
  m.electron = join(m.home, "agent-m-electron-44");
  m.executable = join(m.home, FOLDER, "dist/electron");
  return m;
}
/** The setup, run under `sh` as the schedule's `setup` runs it, on the machine; `fails` makes the fake npm fail at "package" or "binary". Returns the status, stderr and npm's calls since the machine was made. */
async function setUp(m, { fails = "" } = {}) {
  const done = await execute("sh", [SETUP], { cwd: m.dir, timeout: 30000, env: { PATH: `${m.setupTools}:${process.env.PATH}`, HOME: m.home, FAKE_NPM: m.calls, FAKE_NPM_FAILS: fails } });
  return { status: done.status, stderr: done.stderr, npm: readFileSync(m.calls, "utf8").split("\n").filter(Boolean) };
}
const forElectron = (calls) => calls.filter((call) => /electron|install\.js/.test(call));
const installCall = (m) => `install --no-save --prefix ${m.electron} electron@44.5.1`;
/** The environment of a place's run: the machine's home and temporary folder, the tools of the place, and the registry an address on loopback where nothing listens. */
const placeEnv = (m) => ({ ...process.env, HOME: m.home, TMPDIR: m.temporary, PATH: `${m.placeTools}:${process.env.PATH}`, npm_config_registry: `http://127.0.0.1:${m.port}/`, npm_config_fetch_retries: "0", npm_config_cache: join(m.dir, "npm-cache") });
const runPlace = async (m, args) => { const done = await execute(process.execPath, [...LINUX, ...args], { cwd: ROOT, timeout: 90000, env: placeEnv(m) }); return { status: done.status, output: `${done.stdout}${done.stderr}` }; };
const standIn = (path) => put(path, "#!/bin/sh\nexit 2\n");

// The places. Each runs in a node process of its own; `fallback` is the folder, inside the machine's temporary folder, of the copy the place keeps for itself (planted before the run).
const siteStage = (m) => runPlace(m, ["--input-type=module", "-e", `const helper = await import(${JSON.stringify(SITE)}); console.log("EXECUTABLE " + await helper.stageElectron());`]);
const appStage = (m) => runPlace(m, ["--input-type=module", "-e", `const helper = await import(${JSON.stringify(APP)}); console.log("EXECUTABLE " + await helper.stageApp(${JSON.stringify(join(m.temporary, "cache"))}));`]);
const fileStage = (m, file) => runPlace(m, ["--test-name-pattern=^no case of the file has this name$", `tests/${file}`]);
const executableOf = (output) => /^EXECUTABLE (.*)$/m.exec(output)?.[1] ?? null;
const readyOf = (output) => [...output.matchAll(/^native-fixture (\{"stage":"ready".*\})$/gm)].map((line) => JSON.parse(line[1]).executable);
const SITE_COPY = (m) => join(m.temporary, "agent-m-904-site-usability-electron-44/node_modules/electron/dist/electron");
const APP_COPY = (m) => join(m.temporary, "cache/node_modules/electron/dist/electron");
const COMPONENT_COPY = (m) => join(m.temporary, "agent-m-276-component-electron-44/node_modules/electron/dist/electron");
const RELEASE_COPY = (m) => join(m.temporary, "agent-m-276-release-electron-44/node_modules/electron/dist/electron");

// TST-1306301 · level: release · module: MOD-test-schedule
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY; THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE
// given: a machine whose home holds no folder agent-m-electron-44 (the cache was not restored), with the fake npm reachable; known positive first — the setup also calls npm for the Bridge app's packages (`--prefix src/bridge-build`), which shows that npm's calls are recorded
// input: tests/test-schedule-setup.sh run under `sh`, and then run again on the machine it left
// expect: exit code 0; npm is called once for Electron, `install --no-save --prefix <home>/agent-m-electron-44 electron@44.5.1` — the version 44.5.1 and the folder agent-m-electron-44 of the home —, and then the package's install.js runs once; the executable <home>/agent-m-electron-44/node_modules/electron/dist/electron exists and can be run; the second run exits with 0 and adds no call for Electron and no run of install.js
// Planted fault: the line of the setup that runs the package's install.js taken out (tests/test-schedule-setup.sh) leaves no executable, and the case fails on the calls and on the executable.
// Planted fault: another version in the setup's install (`electron@44.5.0`) or another folder (`agent-m-electron-45`) fails the assertion on the call.
// Planted fault: the setup's guard taken out, so that it installs on every run, fails the assertion on the second run.
test("TST-1306301 the setup installs Electron 44.5.1 into the home's agent-m-electron-44 and runs its install.js where the executable is missing, and does nothing on a second run", async () => {
  const m = await machine();
  const first = await setUp(m);
  assert.equal(first.status, 0, first.stderr);
  assert.ok(first.npm.some((call) => call.includes("--prefix src/bridge-build")), `known positive: npm's calls are recorded (${JSON.stringify(first.npm)})`);
  assert.deepEqual(forElectron(first.npm), [installCall(m), "install.js"]);
  assert.equal(existsSync(m.executable), true, "the executable is left where the places look");
  assert.notEqual(statSync(m.executable).mode & 0o111, 0, "and can be run");
  const second = await setUp(m);
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(forElectron(second.npm), forElectron(first.npm), "a second run adds no call for Electron and no run of install.js");
});

// TST-1306302 · level: release · module: MOD-test-schedule
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: three machines — one whose home holds the executable at agent-m-electron-44/node_modules/electron/dist/electron (the cache was restored); one whose home holds the package folder agent-m-electron-44/node_modules/electron with its package.json and no dist (a cache that kept the package and not its executable); one that holds nothing
// input: tests/test-schedule-setup.sh run under `sh` on each
// expect: on the first, exit code 0 and no call for Electron and no install.js, the executable untouched; on the second, the package is installed again and its install.js runs once, and the executable then exists; on the third, the same; each time the Bridge app's packages are installed
// Planted fault: the guard of the setup looking for the package's folder and not its executable (`-d "$electron/node_modules/electron"` in place of `-x …/dist/electron`, in tests/test-schedule-setup.sh) leaves the second machine without an executable, and the case fails on the second machine.
// Planted fault: the setup installing Electron whether or not the executable is there fails the assertion on the first machine.
test("TST-1306302 the setup does nothing for Electron where the executable is present, and installs it where only the package or nothing is", async () => {
  const [present, packageOnly, nothing] = await Promise.all([machine(), machine(), machine()]);
  put(present.executable, "#!/bin/sh\nexit 3\n");
  const before = readFileSync(present.executable, "utf8");
  put(join(packageOnly.home, FOLDER, "package.json"), '{"name":"electron","version":"44.5.1"}\n', 0o644);
  const [a, b, c] = await Promise.all([setUp(present), setUp(packageOnly), setUp(nothing)]);
  assert.equal(a.status, 0, a.stderr);
  assert.deepEqual(forElectron(a.npm), []);
  assert.equal(readFileSync(present.executable, "utf8"), before, "the executable is untouched");
  assert.ok(a.npm.some((call) => call.includes("--prefix src/bridge-build")), "known positive: npm's calls are recorded");

  assert.equal(b.status, 0, b.stderr);
  assert.deepEqual(forElectron(b.npm), [installCall(packageOnly), "install.js"]);
  assert.equal(existsSync(packageOnly.executable), true);

  assert.deepEqual(forElectron(c.npm), [installCall(nothing), "install.js"]);
  assert.equal(existsSync(nothing.executable), true);
});

// TST-1306303 · level: release · module: MOD-test-schedule
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: a machine with nothing cached, whose fake npm fails the install of the package; and one whose install of the package succeeds and whose install.js fails; known positive first — the same machine with a working npm succeeds
// input: tests/test-schedule-setup.sh run under `sh` on each
// expect: the setup ends with a status other than 0 on both; the failed install of the package is tried once and install.js does not run; the failed install.js is run once; no retry of either is added
// Planted fault: the line that runs the package's install.js followed by `|| true` (tests/test-schedule-setup.sh) lets the setup end with 0 after a failed install.js, and the case fails on the status.
// Planted fault: the install of the package tried again after a failure (a loop of two tries) fails the assertion that it is tried once.
test("TST-1306303 a failing install of Electron fails the setup, and neither step is tried again", async () => {
  const [works, noPackage, noBinary] = await Promise.all([machine(), machine(), machine()]);
  const [known, a, b] = await Promise.all([setUp(works), setUp(noPackage, { fails: "package" }), setUp(noBinary, { fails: "binary" })]);
  assert.equal(known.status, 0, "known positive: with a working npm the setup succeeds");
  assert.notEqual(a.status, 0);
  assert.deepEqual(forElectron(a.npm), [installCall(noPackage)], "the install of the package is tried once, and install.js does not run");
  assert.notEqual(b.status, 0);
  assert.deepEqual(forElectron(b.npm), [installCall(noBinary), "install.js"], "install.js is run once");
});

// ---------------------------------------------------------------- the schedule and the workflow

function inputs() {
  const text = (path) => (existsSync(join(ROOT, path)) ? readFileSync(join(ROOT, path), "utf8") : "");
  return { schedule: readDocument(scheduleSchema, "docs/tests/schedule.md", text("docs/tests/schedule.md")),
    participants: readDocument(participantSchema(), "docs/participants.md", text("docs/participants.md")), resources: readDocument(resourceSchema(), "docs/resources.md", text("docs/resources.md")) };
}

// TST-1306304 · level: release · module: MOD-test-schedule
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY; THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE
// given: Agent M's docs/tests/schedule.md read with the schedule's schema, and a scratch machine on which the setup has run (TST-1306301)
// input: the schedule's `cache`, and the folder the setup left the executable in, as a path below the home
// expect: the cache names /home/runner/agent-m-electron-44/node_modules/electron — the folder of the executable, with the apt archives and lists it already named —; below the home /home/runner that folder is the one the setup left the executable in (the executable's folder is the cache entry and the cache entry's `dist/electron` is the executable); the schedule has no finding
// Planted fault: the cache entry naming the folder one level up (`/home/runner/agent-m-electron-44`, in docs/tests/schedule.md) is not the folder the executable is in, and the case fails on the equality.
// Planted fault: the entry taken out of docs/tests/schedule.md fails the assertion that the cache names it.
test("TST-1306304 the schedule's cache names the folder the setup leaves Electron's executable in", async () => {
  const { schedule, participants } = inputs();
  assert.deepEqual(scheduleFindings(schedule, participants), []);
  const cache = schedule.fields.cache;
  assert.deepEqual(cache.slice(0, 2), ["/home/runner/apt-archives", "/home/runner/apt-lists"], "known positive: the cache reads");
  assert.ok(cache.includes(`${RUNNER_HOME}/${FOLDER}`), `the cache names the executable's folder: ${JSON.stringify(cache)}`);
  const m = await machine();
  assert.equal((await setUp(m)).status, 0);
  assert.equal(`${RUNNER_HOME}/${relative(m.home, dirname(dirname(m.executable)))}`, `${RUNNER_HOME}/${FOLDER}`, "below the home, the folder of the executable the setup left");
  assert.ok(cache.some((path) => path === `${RUNNER_HOME}/${relative(m.home, dirname(dirname(m.executable)))}`));
});

// The steps of the committed workflow that keep or restore the cache, each as { job, uses, paths }, and the jobs that run the setup, each as { job, setupAt, cacheAt } (the step numbers within the job).
function cacheSteps(text) {
  const body = text.slice(text.indexOf("\njobs:\n") + 7);
  const heads = [...body.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)];
  return heads.map((head, i) => {
    const job = body.slice(head.index, heads[i + 1]?.index ?? body.length);
    const steps = job.split(/\n {6}- /).slice(1);
    const caches = steps.map((step, at) => ({ at, step })).filter(({ step }) => /uses: actions\/cache(\/restore)?@/.test(step));
    const setupAt = steps.findIndex((step) => step.includes("sh tests/test-schedule-setup.sh"));
    return { job: head[1], setupAt, caches: caches.map(({ at, step }) => ({ at, paths: [...step.matchAll(/^ {12}(\/\S+)$/gm)].map((line) => line[1]) })) };
  });
}

// TST-1306305 · level: release · module: MOD-test-schedule
// guards: THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY; A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// given: the committed .github/workflows/agent-m-tests.yml, Agent M's schedule, participants and resources, and the instance commit the workflow checks out
// input: ciConfiguration for GitHub from the schedule, and configurationDrift of the committed file; the cache steps of every job that runs the setup
// expect: the committed file is exactly the generated text and the drift is empty; the job `agent-m-setup` keeps the cache (actions/cache) and runs the setup once, and every other job that runs the setup restores the cache (actions/cache/restore) before it, each with the three paths of the schedule's cache — the apt archives, the apt lists and the executable's folder; the jobs that run the setup are the setup's and one for each row and occasion the schedule ticks (occasionsOf); the time limit of every job is the two minutes
// Planted fault: one cache step of the committed workflow without the executable's folder (a line taken out of one `path:` block of .github/workflows/agent-m-tests.yml) fails the assertion on the drift and on the paths of that job.
// Planted fault: the entry taken out of the schedule's cache (docs/tests/schedule.md) fails the assertion that the committed file is the generated text.
test("TST-1306305 the committed workflow is the schedule's output, and the setup's job and every shard keep or restore the executable's folder before they run the setup", () => {
  const { schedule, participants, resources } = inputs();
  const text = readFileSync(join(ROOT, WORKFLOW), "utf8");
  const refs = [...new Set([...text.matchAll(/^\s+repository: (\S+)\n\s+ref: ([0-9a-f]+)$/gm)].map((m) => `${m[1]} ${m[2]}`))];
  assert.equal(refs.length, 1);
  const [instance, commit] = refs[0].split(" ");
  const target = { server: "github", instance, instanceCommit: commit };
  assert.equal(ciConfiguration(schedule, target, resources, participants).files[WORKFLOW], text);
  assert.deepEqual(configurationDrift({ [WORKFLOW]: text }, schedule, target, resources, participants), []);
  const wanted = schedule.fields.cache;
  const jobs = cacheSteps(text);
  const running = jobs.filter((job) => job.setupAt >= 0);
  const rows = schedule.sections.find((section) => section.heading === "## Levels").rows.map(({ cells }) => cells.Row);
  const testJobs = rows.reduce((sum, row) => sum + occasionsOf(row, schedule).length, 0);
  assert.equal(running.length, 1 + testJobs, "the setup's job and one job for each row and occasion the schedule ticks run the setup");
  const setup = running.find((job) => job.job === "agent-m-setup");
  assert.deepEqual(setup.caches.map(({ paths }) => paths), [wanted]);
  assert.equal(setup.caches[0].at < setup.setupAt, true, "the setup's job keeps the cache around the setup it runs once");
  for (const job of running.filter((each) => each.job !== "agent-m-setup")) {
    assert.deepEqual(job.caches.map(({ paths }) => paths), [wanted], `${job.job}: the cache is restored with the three paths`);
    assert.equal(job.caches[0].at < job.setupAt, true, `${job.job}: the cache is restored before the setup runs`);
  }
  assert.equal(text.match(/^\s+timeout-minutes: (\d+)$/gm).every((line) => /: 2$/.test(line)), true, "every job carries the two minutes");
});

// ---------------------------------------------------------------- the places, after the setup, with the registry closed

/** The machine after the setup has run (registry closed from now on), and the executable the setup left. */
async function afterSetup() {
  const m = await machine();
  const done = await setUp(m);
  assert.equal(done.status, 0, done.stderr);
  assert.equal(existsSync(m.executable), true, "the setup left the executable");
  return m;
}
const NO_ACQUISITION = /Electron (package|binary) (acquisition|staging)|"stage":"Electron (package|binary) acquisition"/;

// TST-1306306 · level: release · module: MOD-site-frame
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: known positive first — a machine on which no setup has run, whose home holds nothing, with a stand-in executable in the helper's own folder of the temporary directory; then the machine after the real setup, with and without that stand-in; npm's registry an address where nothing listens
// input: stageElectron() of tests/site-usability.d/browser.mjs, in a node process of its own, on each
// expect: with the stand-in alone it gives the stand-in (so that the helper's own copy is found); after the setup, with and without the stand-in, it gives the executable the setup left, <home>/agent-m-electron-44/node_modules/electron/dist/electron, and nothing fails at "Electron package staging"
// Planted fault: the helper looking first in its own folder of the temporary directory (the lines of `runtime()` in tests/site-usability.d/browser.mjs that look at the setup's folder moved after the helper's own) gives the stand-in after the setup, and the case fails on the executable.
// Planted fault: the lines that look at the setup's folder taken out of `runtime()` make the helper ask the registry, which does not answer, and the case fails at "Electron package staging".
test("TST-1306306 the site's Electron is the one the setup left, first, with the registry closed", async () => {
  const lone = await machine();
  standIn(SITE_COPY(lone));
  const [withCopy, withoutCopy] = await Promise.all([afterSetup(), afterSetup()]);
  standIn(SITE_COPY(withCopy));
  const [known, ...results] = await Promise.all([siteStage(lone), siteStage(withCopy), siteStage(withoutCopy)]);
  assert.equal(executableOf(known.output), SITE_COPY(lone), "known positive: the helper's own copy is found");
  for (const [result, m, label] of [[results[0], withCopy, "with"], [results[1], withoutCopy, "without"]]) {
    assert.equal(result.status, 0, result.output);
    assert.equal(executableOf(result.output), m.executable, `${label} the helper's own copy`);
    assert.doesNotMatch(result.output, NO_ACQUISITION);
  }
});

// TST-1306307 · level: release · module: MOD-desktop-shell
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: known positive first — a machine on which no setup has run, with a stand-in executable in the cache folder the call names; then the machine after the real setup, with and without that stand-in; npm's registry an address where nothing listens
// input: stageApp(<temporary>/cache) of tests/desktop-shell.d/electron.mjs, in a node process of its own, on each
// expect: with the stand-in alone it gives the stand-in; after the setup, with and without the stand-in, it gives the executable the setup left, and records no stage "Electron package acquisition"
// Planted fault: the lines of stageElectron in tests/desktop-shell.d/electron.mjs that look at the setup's folder moved after the call's own cache gives the stand-in after the setup, and the case fails on the executable.
// Planted fault: those lines taken out make the helper ask the registry, and the case fails at "Electron package acquisition".
test("TST-1306307 the Bridge app's Electron is the one the setup left, first, with the registry closed", async () => {
  const lone = await machine();
  standIn(APP_COPY(lone));
  const [withCopy, withoutCopy] = await Promise.all([afterSetup(), afterSetup()]);
  standIn(APP_COPY(withCopy));
  const [known, ...results] = await Promise.all([appStage(lone), appStage(withCopy), appStage(withoutCopy)]);
  assert.equal(executableOf(known.output), APP_COPY(lone), "known positive: the call's own copy is found");
  for (const [result, m, label] of [[results[0], withCopy, "with"], [results[1], withoutCopy, "without"]]) {
    assert.equal(result.status, 0, result.output);
    assert.equal(executableOf(result.output), m.executable, `${label} the call's own copy`);
    assert.doesNotMatch(result.output, NO_ACQUISITION);
  }
});

// TST-1306308 · level: release · module: MOD-desktop-shell
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: known positive first — a machine on which no setup has run, with a stand-in in the folder each of the two files keeps for itself in the temporary directory; then the machine after the real setup, with those stand-ins and without them; npm's registry an address where nothing listens; the files run as the CI runs them on Linux, with a name pattern that none of their cases matches
// input: tests/desktop-shell.test.mjs, tests/release-itm-276-desktop-shell.test.mjs and tests/desktop-shell-bridge-jobs.test.mjs, each run by node in a process of its own
// expect: the first two record the stage "ready" with their own stand-in when no setup has run, and with the executable the setup left after it, with and without the stand-ins; each ends with 0 and records no stage "Electron package acquisition"; tests/desktop-shell-bridge-jobs.test.mjs, which stages through tests/desktop-shell.d/electron.mjs, ends with 0 after the setup and records no acquisition
// Planted fault: the lines of `runtime()` in tests/desktop-shell.test.mjs that look at the setup's folder taken out make that file ask the registry, and the case fails at "Electron package acquisition".
// Planted fault: the same lines in tests/release-itm-276-desktop-shell.test.mjs moved after the file's own copy give its stand-in after the setup, and the case fails on the executable.
test("TST-1306308 the two files that stage Electron themselves, and the one that stages through the helper, take the setup's executable first, with the registry closed", async () => {
  const lone = await machine();
  standIn(COMPONENT_COPY(lone));
  standIn(RELEASE_COPY(lone));
  const [withCopies, withoutCopies] = await Promise.all([afterSetup(), afterSetup()]);
  standIn(COMPONENT_COPY(withCopies));
  standIn(RELEASE_COPY(withCopies));
  const FILES = ["desktop-shell.test.mjs", "release-itm-276-desktop-shell.test.mjs"];
  // The files of one machine share its lock, so they run one after the other; the machines run side by side.
  const inOrder = async (m, files) => { const results = []; for (const file of files) results.push(await fileStage(m, file)); return results; };
  const [[loneComponent, loneRelease], withResults, withoutResults] = await Promise.all([inOrder(lone, FILES), inOrder(withCopies, [...FILES, "desktop-shell-bridge-jobs.test.mjs"]), inOrder(withoutCopies, [...FILES, "desktop-shell-bridge-jobs.test.mjs"])]);
  assert.deepEqual(readyOf(loneComponent.output), [COMPONENT_COPY(lone)], "known positive: the file's own copy is found");
  assert.deepEqual(readyOf(loneRelease.output), [RELEASE_COPY(lone)], "known positive: the file's own copy is found");
  for (const [m, results, label] of [[withCopies, withResults, "with"], [withoutCopies, withoutResults, "without"]]) {
    for (const [at, file] of FILES.entries()) {
      assert.equal(results[at].status, 0, results[at].output);
      assert.deepEqual(readyOf(results[at].output), [m.executable], `${file} ${label} its own copy`);
      assert.doesNotMatch(results[at].output, NO_ACQUISITION, file);
    }
    assert.equal(results[2].status, 0, results[2].output);
    assert.doesNotMatch(results[2].output, NO_ACQUISITION);
  }
});

// TST-1306309 · level: release · module: MOD-site-frame; MOD-desktop-shell
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: a machine on which no setup has run (the cache was not restored and nothing was installed before the registry closed), whose home holds nothing; npm's registry an address where nothing listens; known positive first — TST-1306306 to TST-1308 show the same places pass once the setup has run
// input: stageElectron() of tests/site-usability.d/browser.mjs, stageApp() of tests/desktop-shell.d/electron.mjs and the three files of TST-1306308
// expect: every one of them fails at the acquisition from the registry — "Electron package staging failed" for the site's helper, "Electron package acquisition failed" for the helper of the Bridge app, the stage "Electron package acquisition" ending with status 1 for the three files —, with a status other than 0 for the helpers, and no file records the stage "ready"; that is the failure the setup removes. Skipped, and says so, where a bundled Electron stands at /private/tmp/agent-m-electron-44, which the places take before they ask the registry
// Planted fault: the helper's own install no longer failing at the package (`if (install.status !== 0)` made `if (false)` in `runtime()` of tests/site-usability.d/browser.mjs) fails the assertion on "Electron package staging failed".
test("TST-1306309 without the setup's Electron every place asks the registry, which does not answer, and fails at the acquisition", async (t) => {
  if (existsSync("/private/tmp/agent-m-electron-44/node_modules/electron/dist/electron") || existsSync("/private/tmp/agent-m-electron-44/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron")) {
    t.skip("a bundled Electron stands at /private/tmp/agent-m-electron-44, which the places take before they ask the registry");
    return;
  }
  const m = await machine();
  const FILES = ["desktop-shell.test.mjs", "release-itm-276-desktop-shell.test.mjs", "desktop-shell-bridge-jobs.test.mjs"];
  const [site, app, ...files] = await Promise.all([siteStage(m), appStage(m), ...FILES.map((file) => fileStage(m, file))]);
  assert.notEqual(site.status, 0);
  assert.match(site.output, /Electron package staging failed/);
  assert.notEqual(app.status, 0);
  assert.match(app.output, /Electron package acquisition failed/);
  for (const [at, file] of FILES.entries()) {
    const result = files[at];
    assert.match(result.output, /native-fixture \{"stage":"Electron package acquisition","status":1/, file);
    assert.deepEqual(readyOf(result.output), [], `${file} stages nothing`);
  }
});
