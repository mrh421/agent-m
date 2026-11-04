// Agent M declares and generates its own CI schedule (ITM-476): Agent M's repository holds its declared test schedule
// `docs/tests/schedule.md`, and its CI is `.github/workflows/agent-m-tests.yml`, exactly the bytes MOD-test-schedule's ciConfiguration
// generates from that schedule, with the instance — Agent M itself — checked out at a commit of its own history that holds the entries
// the file runs (MOD-test-schedule, Interfaces: ciConfiguration; Data: The generated configuration). The schedule runs every test of
// the repository on a pull request, as the transitional `tests.yml` did, within the two minutes of its jobs; every test on the nightly
// run and on a release candidate; no paid service on a pull request; and nothing for a push that only records jobs.
// Run: node --test tests/test-schedule-own-ci.test.mjs
//
// Module: MOD-test-schedule
// Guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE; A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES; COMMIT TESTS CALL NO PAID SERVICE; A JOB RECORD STARTS NO CI RUN; A RELEASE RUNS EVERY TEST AT EVERY LEVEL; EVERY TEST RUN LEAVES A RESULT RECORD; UC-027
// Level: system
//
// Each test states its input and its expected result before it runs (given / input / expect). The repository's own files are read as
// they are committed (`git ls-files`); the expected values are written here, and none is read from a document of the architecture.
// The command's mark of a file that starts Electron is read from the command itself, so that this file repeats it nowhere (a repetition
// here would make this file one of them).

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readDocument } from "../src/documents/index.mjs";
import { participantSchema } from "../src/participant-list/index.mjs";
import { resourceSchema } from "../src/resource-list/index.mjs";
import { isTestFile } from "../src/test-document/index.mjs";
import { scheduleSchema, scheduleFindings, ciConfiguration, configurationDrift, occasionsOf, testsOfRow } from "../src/test-schedule/index.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEDULE = "docs/tests/schedule.md";
const WORKFLOW = ".github/workflows/agent-m-tests.yml";
const INSTANCE = "akmaier/agent-m";
const ROWS = ["unit", "component", "system", "paid", "release", "user"];
const OCCASIONS = ["every commit", "pull request", "nightly", "release candidate", "on demand"];

const textOf = (path) => (existsSync(join(ROOT, path)) ? readFileSync(join(ROOT, path), "utf8") : null);
const committed = () => execFileSync("git", ["ls-files"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
// The schedule, the instance's participants and its resources, as ciConfiguration takes them.
function inputs() {
  const text = textOf(SCHEDULE);
  assert.ok(text !== null, `${SCHEDULE} is committed`);
  return {
    schedule: readDocument(scheduleSchema, SCHEDULE, text),
    participants: readDocument(participantSchema(), "docs/participants.md", textOf("docs/participants.md")),
    resources: readDocument(resourceSchema(), "docs/resources.md", textOf("docs/resources.md") ?? ""),
  };
}
// The committed workflow, and the instance commit it checks out (the `ref:` of its checkout of the instance).
function workflow() {
  const text = textOf(WORKFLOW);
  assert.ok(text !== null, `${WORKFLOW} is committed`);
  const refs = [...new Set([...text.matchAll(/^\s+repository: (\S+)\n\s+ref: ([0-9a-f]+)$/gm)].map((m) => `${m[1]} ${m[2]}`))];
  assert.equal(refs.length, 1, "every job checks the instance out at one commit");
  const [instance, commit] = refs[0].split(" ");
  return { text, instance, commit };
}
// The repository's test files as runTests reads them: every committed test file with its text.
const testFiles = () => committed().filter(isTestFile).map((path) => ({ path, text: readFileSync(join(ROOT, path), "utf8") }));
// The jobs of the workflow by name, each as its text: the keys at two spaces below `jobs:`.
function jobsOf(text) {
  const body = text.slice(text.indexOf("\njobs:\n") + 7);
  const keys = [...body.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)];
  return Object.fromEntries(keys.map((key, i) => [key[1], body.slice(key.index, keys[i + 1]?.index ?? body.length)]));
}

// TST-476901 · level: system · module: MOD-test-schedule
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES; UC-027
// given: Agent M's repository as committed
// input: docs/tests/schedule.md read with the schedule's schema, and its findings against the instance's participants
// expect: the schedule has no finding; it declares `minutes: 2`, the command `node tests/test-schedule-command.mjs`, the setup `sh tests/test-schedule-setup.sh` and a cache of the paths that setup fills; it names the six rows
test("Agent M declares its schedule: two minutes, its own command and setup, and no finding", () => {
  const { schedule, participants } = inputs();
  assert.deepEqual(scheduleFindings(schedule, participants), []);
  assert.equal(schedule.fields.minutes, 2);
  assert.equal(schedule.fields.command, "node tests/test-schedule-command.mjs");
  assert.equal(schedule.fields.setup, "sh tests/test-schedule-setup.sh");
  assert.deepEqual(schedule.fields.cache, ["/home/runner/apt-archives", "/home/runner/apt-lists", "/home/runner/agent-m-electron-44/node_modules/electron"]);
  const rows = schedule.sections.find((s) => s.heading === "## Levels").rows.map(({ cells }) => cells.Row);
  assert.deepEqual(rows, ROWS);
});

// TST-476902 · level: system · module: MOD-test-schedule
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; COMMIT TESTS CALL NO PAID SERVICE; A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-027
// given: Agent M's schedule
// input: occasionsOf for each row
// expect: unit, component, system and release run on a pull request, the nightly run, a release candidate and on demand; paid on the nightly run, a release candidate and on demand; user on a release candidate and on demand; no row on every commit (a push to a branch runs no test: code reaches main only through a pull request); the release candidate column is ticked for every row
test("the occasions: every level on a pull request but paid and user, everything nightly and on a release candidate, nothing on a bare push", () => {
  const { schedule } = inputs();
  const all = ["pull request", "nightly", "release candidate", "on demand"];
  assert.deepEqual(Object.fromEntries(ROWS.map((row) => [row, occasionsOf(row, schedule)])), {
    unit: all, component: all, system: all, release: all,
    paid: ["nightly", "release candidate", "on demand"],
    user: ["release candidate", "on demand"],
  });
  for (const row of ROWS) assert.ok(occasionsOf(row, schedule).includes("release candidate"), `${row} runs on a release candidate`);
  assert.ok(OCCASIONS.includes("every commit") && ROWS.every((row) => !occasionsOf(row, schedule).includes("every commit")));
});

// TST-476903 · level: system · module: MOD-test-schedule
// guards: THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE; UC-027
// given: the committed .github/workflows/agent-m-tests.yml, the schedule, the participants and the (absent) resources of the instance
// input: ciConfiguration for GitHub, the instance akmaier/agent-m at the commit the committed file checks out; configurationDrift of the committed file
// expect: the committed file is exactly the generated text, and the drift is empty; counter-proof: the committed text with one line changed has a drift that names that line
test("the committed agent-m-tests.yml is exactly the bytes generated from the schedule", () => {
  const { schedule, participants, resources } = inputs();
  const { text, instance, commit } = workflow();
  assert.equal(instance, INSTANCE);
  const target = { server: "github", instance: INSTANCE, instanceCommit: commit };
  const generated = ciConfiguration(schedule, target, resources, participants);
  assert.deepEqual(Object.keys(generated.files), [WORKFLOW]);
  assert.equal(text, generated.files[WORKFLOW]);
  assert.deepEqual(configurationDrift({ [WORKFLOW]: text }, schedule, target, resources, participants), []);
  const changed = text.replace("name: agent-m tests", "name: tests");
  const drift = configurationDrift({ [WORKFLOW]: changed }, schedule, target, resources, participants);
  assert.equal(drift.length, 1);
  assert.match(drift[0].difference, /found `name: tests`/);
});

// TST-476904 · level: system · module: MOD-test-schedule
// guards: THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; UC-027
// given: the commit at which the committed workflow checks the instance out, in this checkout's history
// input: git merge-base --is-ancestor <commit> HEAD, and the text of src/workflow-entries/main.mjs at that commit
// expect: the commit is a full 40-digit commit of the repository's own history, an ancestor of the commit under test, whose entries file names runTests, onTestsFinished and onDoneCheck — so that the code of a pull request never runs the entries that hold the token. Skipped, and says so, in a checkout that does not hold the commit (a shallow clone)
test("the workflow runs the entries of a commit of Agent M's own history that holds them", (t) => {
  const { commit } = workflow();
  assert.match(commit, /^[0-9a-f]{40}$/);
  if (spawnSync("git", ["cat-file", "-e", `${commit}^{commit}`], { cwd: ROOT }).status !== 0) {
    t.skip(`this checkout does not hold ${commit} (a shallow clone); the workflow's own checkout of the instance fails when the commit is not the repository's`);
    return;
  }
  assert.equal(spawnSync("git", ["merge-base", "--is-ancestor", commit, "HEAD"], { cwd: ROOT }).status, 0, `${commit} is an ancestor of HEAD`);
  const entries = execFileSync("git", ["show", `${commit}:src/workflow-entries/main.mjs`], { cwd: ROOT, encoding: "utf8" });
  for (const entry of ["runTests", "onTestsFinished", "onDoneCheck"]) assert.match(entries, new RegExp(`\\b${entry}\\b`), entry);
});

// TST-476905 · level: system · module: MOD-test-schedule
// guards: EVERY TEST HAS ONE LEVEL; A RELEASE RUNS EVERY TEST AT EVERY LEVEL; A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES; UC-027
// given: the repository's committed test files with their texts, as runTests reads them
// input: testsOfRow for each row
// expect: no named test file has an unreadable level (runTests would end every row failed before running); every Python test file and every node test file directly in tests/ is in exactly one row; the rows a pull request runs hold every one of them, as tests.yml ran them all on a pull request, and so do the rows of the nightly run and of a release candidate
test("every test file of the two suites runs on a pull request, nightly and on a release candidate, and no level is unreadable", () => {
  const { schedule } = inputs();
  const files = testFiles();
  const rows = Object.fromEntries(ROWS.map((row) => [row, testsOfRow(row, files)]));
  assert.deepEqual([...new Set(ROWS.flatMap((row) => rows[row].unreadable))], []);
  const suites = committed().filter((path) => /^tests\/(test[^/]*\.py|[^/]*\.test\.mjs)$/.test(path)).sort();
  const placed = ROWS.flatMap((row) => rows[row].files).filter((path) => suites.includes(path));
  assert.deepEqual([...placed].sort(), suites, "every file of the two suites is in exactly one row");
  for (const occasion of ["pull request", "nightly", "release candidate"]) {
    const run = ROWS.filter((row) => occasionsOf(row, schedule).includes(occasion)).flatMap((row) => rows[row].files);
    assert.deepEqual(suites.filter((path) => !run.includes(path)), [], `the ${occasion} runs every file of the two suites`);
  }
});

// TST-476906 · level: system · module: MOD-test-schedule
// guards: A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES; UC-027
// given: the schedule's shards and the files of each row that start Electron, by the mark the command reads (tests/test-schedule-command.mjs, STARTS_ELECTRON)
// input: for each row a pull request runs, its number of shards and its number of such files
// expect: every such row has more shards than files that start Electron, so that the command gives each of them a shard of its own and the other files at least one; counter-proof: the mark read from the command matches the files of tests/ that stage Electron (at least one), so that a count of 0 is no reading that matches nothing
test("each row a pull request runs has more shards than files that start Electron", () => {
  const { schedule } = inputs();
  const command = readFileSync(join(ROOT, "tests/test-schedule-command.mjs"), "utf8");
  const mark = /const STARTS_ELECTRON = \/(.+)\/;/.exec(command);
  assert.ok(mark, "the command names its mark");
  const startsElectron = new RegExp(mark[1]);
  const files = testFiles();
  const top = (path) => /^tests\/[^/]+$/.test(path);
  assert.ok(files.some(({ path, text }) => top(path) && startsElectron.test(text)), "the mark matches some test file");
  const levels = schedule.sections.find((s) => s.heading === "## Levels").rows;
  for (const row of ROWS.filter((r) => occasionsOf(r, schedule).includes("pull request"))) {
    const shards = levels.find(({ cells }) => cells.Row === row).cells.shards ?? 1;
    const electron = testsOfRow(row, files).files.filter((path) => top(path) && startsElectron.test(readFileSync(join(ROOT, path), "utf8")));
    assert.ok(shards > electron.length, `${row}: ${shards} shards for ${electron.length} files that start Electron`);
  }
});

// TST-476907 · level: system · module: MOD-test-schedule
// guards: A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES; COMMIT TESTS CALL NO PAID SERVICE; A JOB RECORD STARTS NO CI RUN; EVERY TEST RUN LEAVES A RESULT RECORD; UC-027
// given: the committed workflow
// input: its triggers and jobs
// expect: a push that changes only docs/jobs/ starts nothing (paths-ignore); every pull request job carries timeout-minutes: 2 and reads no secret; no job of the row paid runs on a pull request; the nightly job of the row that holds tests/bridge-build-build-platform.test.mjs and that of the row that holds tests/test_release_sprint_02_c.py exist and carry no time limit, since they run the real Bridge build and both suites once more; agent-m records runs after every test job, and agent-m done after the pull request's jobs and agent-m records
test("the workflow: job records ignored, two minutes and no secret on a pull request, the long tests nightly, records after every test job", () => {
  const { text } = workflow();
  const files = testFiles();
  assert.match(text, /\n {4}paths-ignore:\n {6}- docs\/jobs\/\*\*\n/);
  const jobs = jobsOf(text);
  const tests = Object.keys(jobs).filter((name) => !name.startsWith("agent-m-"));
  const pullRequest = tests.filter((name) => /if: github\.event_name == 'pull_request'\n/.test(jobs[name]));
  assert.deepEqual([...pullRequest].sort(), ["component-pull-request", "release-pull-request", "system-pull-request", "unit-pull-request"]);
  for (const name of pullRequest) {
    assert.match(jobs[name], /\n {4}timeout-minutes: 2\n/, name);
    assert.doesNotMatch(jobs[name], /secrets\./, `${name} reads no secret`);
    assert.match(jobs[name], /AGENT_M_SECRETS: ''\n/, name);
  }
  assert.ok(!tests.some((name) => name.startsWith("paid-") && /pull_request/.test(jobs[name])), "no paid job on a pull request");
  const rowOf = (path) => ROWS.find((row) => testsOfRow(row, files).files.includes(path));
  for (const path of ["tests/bridge-build-build-platform.test.mjs", "tests/test_release_sprint_02_c.py"]) {
    const nightly = jobs[`${rowOf(path)}-nightly`];
    assert.ok(nightly, `the row of ${path} runs nightly`);
    assert.doesNotMatch(nightly, /timeout-minutes/, `the nightly job of ${path} has no two-minute limit`);
  }
  assert.match(jobs["agent-m-records"], new RegExp(`needs: \\[${tests.join(", ")}\\]`));
  assert.match(jobs["agent-m-records"], /onTestsFinished/);
  assert.match(jobs["agent-m-done"], new RegExp(`needs: \\[${[...pullRequest, "agent-m-records"].join(", ")}\\]`));
});

// TST-476908 · level: system · module: MOD-test-schedule
// guards: THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE; UC-027
// given: the two tests that run only on some occasions: tests/test_release_sprint_02_c.py (both suites once more, nightly) and tests/bridge-build-build-platform.test.mjs (the real Bridge build)
// input: their texts
// expect: each reads AGENT_M_OCCASION, which every generated test job sets, and neither names AGENT_M_NIGHTLY or BRIDGE_BUILD_REAL, which the transitional nightly.yml set and no generated job sets, so that a test reading them would never run
test("a test that runs only on some occasions reads AGENT_M_OCCASION, which the generated jobs set", () => {
  const old = ["AGENT_M_" + "NIGHTLY", "BRIDGE_BUILD_" + "REAL"];
  for (const path of ["tests/test_release_sprint_02_c.py", "tests/bridge-build-build-platform.test.mjs"]) {
    const text = textOf(path);
    assert.match(text, /AGENT_M_OCCASION/, path);
    assert.deepEqual(old.filter((name) => text.includes(name)), [], path);
  }
});
