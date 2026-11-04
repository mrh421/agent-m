// Agent M's own test command and setup (ITM-1217) — the test helpers under tests/ that docs/architecture/MOD-test-schedule.md
// names as the `command` and the `setup` of Agent M's own schedule (Parts, *Agent M's own `command` and `setup`*), against
// *The command* and *The variables of a test job*: the command, tests/test-schedule-command.mjs, is given the files of its
// row as its arguments and AGENT_M_SHARD, AGENT_M_SHARDS and AGENT_M_REPORT in its environment; it runs its share of
// Agent M's two suites — the Python and the node test files directly in tests/ — into one JUnit XML report at
// AGENT_M_REPORT, keeps every file that starts Electron in a shard of its own, and ends with a status other than 0 when a
// test failed. The setup, tests/test-schedule-setup.sh, installs xvfb and openbox and the Bridge app's packages.
// Run: node --test tests/test-schedule-command.test.mjs
//
// Module: MOD-test-schedule
// Guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES; UC-027; EVERY TEST RUN LEAVES A RESULT RECORD; UC-028
// Level: unit
//
// Each test states its input and its expected result before it runs (given / input / expect). Every fixture file is a path
// and a text written out below, written into a folder of its own under the system's temporary folder, in which the
// command and the setup run; nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseOutcomes } from "../src/result-records/index.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const COMMAND = join(HERE, "test-schedule-command.mjs");
const SETUP = join(HERE, "test-schedule-setup.sh");
// The marks by which a test file starts Electron, built here so that this file itself names neither.
const STAGES_ELECTRON = "stage" + "Electron";
const TAKES_THE_LOCK = "native-fixture" + "-lock";

// A node test file of one case named `name`, which passes or fails; `extra` is a line of its text.
const nodeFile = (name, { fails = false, extra = "" } = {}) => [
  'import test from "node:test";', extra,
  `test(${JSON.stringify(name)}, () => { ${fails ? 'throw new Error("planted failure");' : ""} });`, "",
].join("\n");
// A Python test file of one class whose methods are named as given: each passes, fails or raises an error.
const pythonFile = (methods) => [
  "import unittest", "", "", "class Case(unittest.TestCase):",
  ...Object.entries(methods).map(([method, kind]) => `    def ${method}(self):\n        ${{
    passes: "self.assertTrue(True)", fails: 'self.fail("planted failure")', errs: 'raise RuntimeError("planted error")',
  }[kind]}\n`), "",
].join("\n");

// A product checkout of the files given, `{ path: text }`, in a folder of its own.
function checkout(files) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-command-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

// The command run in `root` with the files given, as shard `shard` of `shards`; its status, its output and its report.
function runCommand(root, files, shard, shards) {
  const report = join(root, "agent-m-reports", `pull-request.unit.${shard}.xml`);
  const env = { ...process.env, AGENT_M_ROW: "unit", AGENT_M_OCCASION: "pull-request", AGENT_M_SHARD: String(shard),
    AGENT_M_SHARDS: String(shards), AGENT_M_REPORT: report };
  delete env.NODE_TEST_CONTEXT;
  return new Promise((resolve) => {
    execFile(process.execPath, [COMMAND, ...files], { cwd: root, env, timeout: 60_000 }, (error, stdout, stderr) => {
      resolve({ status: error ? (error.code ?? 1) : 0, output: stdout + stderr,
        report: existsSync(report) ? readFileSync(report, "utf8") : null });
    });
  });
}

// The test cases of a JUnit XML report: each name with `failed` (a failure or an error), `skipped` or `passed`.
function casesOf(report) {
  const cases = {};
  for (const match of report.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
    const name = /\bname="([^"]*)"/.exec(match[1])[1];
    const body = match[3] ?? "";
    cases[name] = /<(failure|error)\b/.test(body) ? "failed" : /<skipped\b/.test(body) ? "skipped" : "passed";
  }
  return cases;
}

// TST-1217001 · level: unit · module: MOD-test-schedule
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES; UC-027
// given: a checkout with five Python test files tests/test_p1.py … tests/test_p5.py, each with one passing case test_in_p<n>, and seven node test files tests/n1.test.mjs … tests/n7.test.mjs, each with one passing case "in n<n>", of which tests/n2.test.mjs names the mark STAGES_ELECTRON and tests/n6.test.mjs the mark TAKES_THE_LOCK (both written out above) — the two that start Electron
// input: the command with the twelve files, out of the order of their paths, as its arguments, run as shard 1, 2, 3, 4 and 5 of AGENT_M_SHARDS 5
// expect: every run ends with 0 and writes its report; across the five reports every one of the twelve cases is found exactly once, each case passed; the report holding "in n2" holds no other case, and the report holding "in n6" holds no other case
test("command — every file lands in exactly one shard, and a file that starts Electron in a shard of its own", async () => {
  const files = {};
  for (let n = 1; n <= 5; n += 1) files[`tests/test_p${n}.py`] = pythonFile({ [`test_in_p${n}`]: "passes" });
  for (let n = 1; n <= 7; n += 1) {
    const extra = n === 2 ? `// ${STAGES_ELECTRON}` : n === 6 ? `// ${TAKES_THE_LOCK}` : "";
    files[`tests/n${n}.test.mjs`] = nodeFile(`in n${n}`, { extra });
  }
  const root = checkout(files);
  try {
    const given = Object.keys(files).reverse();
    const runs = await Promise.all([1, 2, 3, 4, 5].map((shard) => runCommand(root, given, shard, 5)));
    const expected = [1, 2, 3, 4, 5].map((n) => `test_in_p${n}`).concat([1, 2, 3, 4, 5, 6, 7].map((n) => `in n${n}`));
    const seen = [];
    for (const run of runs) {
      assert.equal(run.status, 0, run.output);
      assert.ok(run.report, `no report: ${run.output}`);
      const cases = casesOf(run.report);
      for (const [name, kind] of Object.entries(cases)) { seen.push(name); assert.equal(kind, "passed", name); }
      for (const electron of ["in n2", "in n6"]) {
        if (electron in cases) assert.deepEqual(Object.keys(cases), [electron], `a shard holds ${electron} with another file`);
      }
    }
    assert.deepEqual([...seen].sort(), [...expected].sort());
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// TST-1217002 · level: unit · module: MOD-test-schedule
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES; UC-027
// given: a checkout with the node test files tests/e1.test.mjs and tests/e2.test.mjs, both naming the mark STAGES_ELECTRON, and tests/plain.test.mjs, which names neither mark
// input: the command with the three files as its arguments, run as shard 1 of AGENT_M_SHARDS 2
// expect: it ends with a status other than 0, writes no report, and its output names tests/e1.test.mjs and tests/e2.test.mjs — two files that start Electron leave no shard for the other files
test("command — with no shard left for the other files, it fails and names the files that start Electron", async () => {
  const root = checkout({
    "tests/e1.test.mjs": nodeFile("in e1", { extra: `// ${STAGES_ELECTRON}` }),
    "tests/e2.test.mjs": nodeFile("in e2", { extra: `// ${STAGES_ELECTRON}` }),
    "tests/plain.test.mjs": nodeFile("in plain"),
  });
  try {
    const run = await runCommand(root, ["tests/e1.test.mjs", "tests/e2.test.mjs", "tests/plain.test.mjs"], 1, 2);
    assert.notEqual(run.status, 0);
    assert.equal(run.report, null);
    assert.match(run.output, /tests\/e1\.test\.mjs/);
    assert.match(run.output, /tests\/e2\.test\.mjs/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// TST-1217003 · level: unit · module: MOD-test-schedule
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; UC-027
// given: a checkout with tests/test_mixed.py, whose class has the passing case test_passes, the failing case test_fails and the case test_errs that raises an error, and tests/mixed.test.mjs with the failing case "node fails", and tests/fine.test.mjs with the passing case "node passes"
// input: the command with the three files as its arguments, run as shard 1 of AGENT_M_SHARDS 1
// expect: it ends with a status other than 0; its one report holds test_fails, test_errs and "node fails" as failed, and test_passes and "node passes" as passed
test("command — a failing test gives a status other than 0 and a failed case in the one report", async () => {
  const root = checkout({
    "tests/test_mixed.py": pythonFile({ test_passes: "passes", test_fails: "fails", test_errs: "errs" }),
    "tests/mixed.test.mjs": nodeFile("node fails", { fails: true }),
    "tests/fine.test.mjs": nodeFile("node passes"),
  });
  try {
    const run = await runCommand(root, ["tests/test_mixed.py", "tests/mixed.test.mjs", "tests/fine.test.mjs"], 1, 1);
    assert.notEqual(run.status, 0);
    assert.ok(run.report, `no report: ${run.output}`);
    assert.deepEqual(casesOf(run.report), {
      test_passes: "passed", test_fails: "failed", test_errs: "failed", "node fails": "failed", "node passes": "passed",
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// TST-1217004 · level: unit · module: MOD-test-schedule
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; UC-027
// given: a checkout with tests/test_one.py, with the passing case test_one, and tests/one.test.mjs, with the passing case "TST-9001 one"
// input: the command with the two files as its arguments, run as shard 1 of AGENT_M_SHARDS 1; MOD-result-records' parseOutcomes([report], [the declaration of TST-9001]) of the report it writes
// expect: it ends with 0; the report at AGENT_M_REPORT is one JUnit XML report — one root element testsuites — holding both cases, test_one and "TST-9001 one", each passed; parseOutcomes reads it without UnreadableReport and gives TST-9001 passed
test("command — the Python and the node cases share one report at AGENT_M_REPORT", async () => {
  const root = checkout({
    "tests/test_one.py": pythonFile({ test_one: "passes" }),
    "tests/one.test.mjs": nodeFile("TST-9001 one"),
  });
  try {
    const run = await runCommand(root, ["tests/test_one.py", "tests/one.test.mjs"], 1, 1);
    assert.equal(run.status, 0, run.output);
    assert.ok(run.report, `no report: ${run.output}`);
    assert.equal(run.report.match(/<testsuites\b/g)?.length, 1);
    assert.deepEqual(casesOf(run.report), { test_one: "passed", "TST-9001 one": "passed" });
    const outcomes = parseOutcomes([run.report], [{ id: "TST-9001", level: "unit", expect: null, runs: null }]);
    assert.deepEqual(outcomes.filter((o) => o.test === "TST-9001").map((o) => o.outcome), ["passed"]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// TST-1217005 · level: unit · module: MOD-test-schedule
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; UC-027
// given: a checkout with tests/kept.test.mjs, with the passing case "kept", and two fixtures named like test files below tests/ — tests/fixtures/reader/tests/reader.spec.mjs, whose case fails, and tests/fixtures/main/tests/test_reader.py, whose case fails —, which are not files of Agent M's two suites
// input: the command with the three files as its arguments, run as shard 1 of AGENT_M_SHARDS 1
// expect: it ends with 0; the report holds the case "kept" only; its output names both fixtures as not run
test("command — a file it is given that lies below a folder of tests/ is no file of the two suites and is not run", async () => {
  const root = checkout({
    "tests/kept.test.mjs": nodeFile("kept"),
    "tests/fixtures/reader/tests/reader.spec.mjs": nodeFile("fixture fails", { fails: true }),
    "tests/fixtures/main/tests/test_reader.py": pythonFile({ test_fixture_fails: "fails" }),
  });
  try {
    const given = ["tests/fixtures/main/tests/test_reader.py", "tests/fixtures/reader/tests/reader.spec.mjs", "tests/kept.test.mjs"];
    const run = await runCommand(root, given, 1, 1);
    assert.equal(run.status, 0, run.output);
    assert.deepEqual(casesOf(run.report), { kept: "passed" });
    assert.match(run.output, /tests\/fixtures\/reader\/tests\/reader\.spec\.mjs/);
    assert.match(run.output, /tests\/fixtures\/main\/tests\/test_reader\.py/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// TST-1217006 · level: unit · module: MOD-test-schedule
// guards: THE TEST SCHEDULE IS DECLARED PER PRODUCT; UC-027
// given: a folder whose PATH starts with fake programs sudo (runs its arguments), apt-get, npm and openbox, each of which writes its name and arguments to a log and ends with 0, npm leaving for an install of electron@44.5.1 the package's install.js, which does nothing; HOME the folder itself; GITHUB_ACTIONS not set
// input: sh tests/test-schedule-setup.sh, run in that folder
// expect: it ends with 0; the log holds an apt-get install of xvfb and openbox, and the npm install of the Bridge app's packages `install --prefix src/bridge-build --omit=dev --ignore-scripts`
test("setup — installs xvfb and openbox and the Bridge app's packages", async () => {
  const root = checkout({});
  try {
    const bin = join(root, "bin"), log = join(root, "calls.log");
    mkdirSync(bin);
    for (const program of ["apt-get", "npm", "openbox"]) {
      writeFileSync(join(bin, program), `#!/bin/sh\necho "${program} $*" >> "${log}"\nexit 0\n`);
      chmodSync(join(bin, program), 0o755);
    }
    // npm installs Electron's package without its executable, and the setup then runs the package's install.js: the fake npm
    // leaves, for that call, an install.js under the setup's folder that does nothing.
    writeFileSync(join(bin, "npm"), `#!/bin/sh\necho "npm $*" >> "${log}"\ncase " $* " in *" electron@44.5.1 "*) mkdir -p "$HOME/agent-m-electron-44/node_modules/electron" && : > "$HOME/agent-m-electron-44/node_modules/electron/install.js";; esac\nexit 0\n`);
    writeFileSync(join(bin, "sudo"), '#!/bin/sh\nexec "$@"\n');
    chmodSync(join(bin, "sudo"), 0o755);
    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}`, HOME: root };
    delete env.GITHUB_ACTIONS;
    const status = await new Promise((resolve) => {
      execFile("sh", [SETUP], { cwd: root, env, timeout: 30_000 }, (error) => resolve(error ? (error.code ?? 1) : 0));
    });
    assert.equal(status, 0);
    const calls = readFileSync(log, "utf8").split("\n").filter(Boolean);
    assert.ok(calls.some((c) => /^apt-get .*\binstall\b/.test(c) && /\bxvfb\b/.test(c) && /\bopenbox\b/.test(c)), calls.join("\n"));
    assert.ok(calls.includes("npm install --prefix src/bridge-build --omit=dev --ignore-scripts"), calls.join("\n"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// TST-1218001 · level: unit · module: MOD-test-schedule
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-027; UC-028
// given: a checkout with tests/test_declared.py, whose class has the passing method test_declared_passes under the declaration of TST-9101, the failing method test_declared_fails under the declaration of TST-9102, and the passing method test_undeclared under no declaration
// input: the command with tests/test_declared.py as its argument, run as shard 1 of AGENT_M_SHARDS 1; MOD-result-records' parseOutcomes([report], [the declarations of TST-9101 and TST-9102]) of the report it writes
// expect: the report names the cases "TST-9101 test_declared_passes", "TST-9102 test_declared_fails" and "test_undeclared"; parseOutcomes gives TST-9101 passed, TST-9102 failed, and test_undeclared undeclared — no declared case undeclared
test("command — a Python case is named by the TST identifier of its declaration, and by its method where none declares it", async () => {
  const declaration = (id) => [`    # TST-${id} · level: unit · module: MOD-reader`, "    # guards: A RULE OF THE READER",
    "    # given: a text", "    # input: read(text)", "    # expect: its words"].join("\n");
  const root = checkout({
    "tests/test_declared.py": ["import unittest", "", "", "class Case(unittest.TestCase):",
      declaration(9101), "    def test_declared_passes(self):", "        self.assertTrue(True)", "",
      declaration(9102), "    def test_declared_fails(self):", '        self.fail("planted failure")', "",
      "    def test_undeclared(self):", "        self.assertTrue(True)", ""].join("\n"),
  });
  try {
    const run = await runCommand(root, ["tests/test_declared.py"], 1, 1);
    assert.ok(run.report, `no report: ${run.output}`);
    assert.deepEqual(casesOf(run.report), {
      "TST-9101 test_declared_passes": "passed", "TST-9102 test_declared_fails": "failed", test_undeclared: "passed",
    });
    const declared = [9101, 9102].map((n) => ({ id: `TST-${n}`, level: "unit", expect: "its words", runs: null }));
    const outcomes = Object.fromEntries(parseOutcomes([run.report], declared).map((o) => [o.test, o.outcome]));
    assert.deepEqual(outcomes, { "TST-9101": "passed", "TST-9102": "failed", test_undeclared: "undeclared" });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// TST-1219001 · level: unit · module: MOD-test-schedule
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-027; UC-028
// given: a checkout with tests/declared.test.mjs holding the passing test "plain" under the declaration of TST-9201; the passing tests `loop ${n} of two` for n 1 and 2, written once in a loop with a template title, under the declaration of TST-9202; the test "with subtests" under the declaration of TST-9203, whose subtest "first" passes and whose subtest "second" fails; and the passing test "not declared" under no declaration
// input: the command with tests/declared.test.mjs as its argument, run as shard 1 of AGENT_M_SHARDS 1; MOD-result-records' parseOutcomes([report], [the declarations of TST-9201, TST-9202 and TST-9203]) of the report it writes
// expect: parseOutcomes gives TST-9201 passed, TST-9202 passed, TST-9203 failed and "not declared" undeclared — no declared test not run
test("command — a node case is named by the TST identifier of its declaration, through a template title and a test's subtests", async () => {
  const declaration = (id) => [`// TST-${id} · level: unit · module: MOD-reader`, "// guards: A RULE OF THE READER",
    "// given: a text", "// input: read(text)", "// expect: its words"].join("\n");
  const root = checkout({
    "tests/declared.test.mjs": ['import test from "node:test";', "",
      declaration(9201), 'test("plain", () => {});', "",
      declaration(9202), "for (const n of [1, 2]) test(`loop ${n} of two`, () => {});", "",
      declaration(9203), 'test("with subtests", async (t) => {',
      '  await t.test("first", () => {});', '  await t.test("second", () => { throw new Error("planted failure"); });', "});", "",
      'test("not declared", () => {});', ""].join("\n"),
  });
  try {
    const run = await runCommand(root, ["tests/declared.test.mjs"], 1, 1);
    assert.ok(run.report, `no report: ${run.output}`);
    const declared = [9201, 9202, 9203].map((n) => ({ id: `TST-${n}`, level: "unit", expect: "its words", runs: null }));
    const outcomes = Object.fromEntries(parseOutcomes([run.report], declared).map((o) => [o.test, o.outcome]));
    assert.deepEqual(outcomes, { "TST-9201": "passed", "TST-9202": "passed", "TST-9203": "failed", "not declared": "undeclared" });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// A declaration of `id` in a node test file, as MOD-test-document's testDeclarations reads it.
const nodeDeclaration = (id) => [`// TST-${id} · level: unit · module: MOD-reader`, "// guards: A RULE OF THE READER",
  "// given: a text", "// input: read(text)", "// expect: its words"].join("\n");
// The outcome of each test MOD-result-records' parseOutcomes reads from the report of `run`, given the declarations of
// the identifiers `ids`, by its test.
function outcomesOf(run, ids) {
  assert.ok(run.report, `no report: ${run.output}`);
  const declared = ids.map((n) => ({ id: `TST-${n}`, level: "unit", expect: "its words", runs: null }));
  return Object.fromEntries(parseOutcomes([run.report], declared).map((o) => [o.test, o.outcome]));
}

// TST-1221001 · level: unit · module: MOD-test-schedule
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-027; UC-028
// given: a checkout with tests/a-template.test.mjs, whose declaration of TST-9301 stands before the line that writes the test `${id}` in a loop over the ids "TST-9301 alpha" and "TST-9301 beta" named on a line above, both passing — its title the template `${id}` alone; and tests/b-agents.test.mjs, whose declaration of TST-9302 stands before the test "agents answer" with the subtests "claude", which passes, and "codex", which fails — run with the Node.js release the generated configuration provides, whose JUnit reporter writes no file attribute and the classname test for a subtest
// input: the command with both files as its arguments, run as shard 1 of AGENT_M_SHARDS 1; MOD-result-records' parseOutcomes([report], [the declarations of TST-9301 and TST-9302]) of the report it writes
// expect: TST-9301 passed and TST-9302 failed, and no case undeclared — the subtests take the declaration of their own file's test, never the template title of the other file
test("command — a node case is matched only to its own file's declarations, a template-only title matching none", async () => {
  const root = checkout({
    "tests/a-template.test.mjs": ['import test from "node:test";', "", 'const ids = ["TST-9301 alpha", "TST-9301 beta"];',
      nodeDeclaration(9301), "for (const id of ids) test(`${id}`, () => {});", ""].join("\n"),
    "tests/b-agents.test.mjs": ['import test from "node:test";', "", nodeDeclaration(9302), 'test("agents answer", async (t) => {',
      '  await t.test("claude", () => {});', '  await t.test("codex", () => { throw new Error("planted failure"); });', "});", ""].join("\n"),
  });
  try {
    const run = await runCommand(root, ["tests/a-template.test.mjs", "tests/b-agents.test.mjs"], 1, 1);
    assert.deepEqual(outcomesOf(run, [9301, 9302]), { "TST-9301": "passed", "TST-9302": "failed" });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// TST-1221002 · level: unit · module: MOD-test-schedule
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-027; UC-028
// given: a checkout with tests/bridge-name.test.mjs, whose declaration of TST-9303 stands before the passing test "bridge:<name> — answers when x > 0" — a title holding < and >, of which node's JUnit reporter escapes only the < — run with the Node.js release the generated configuration provides
// input: the command with the file as its argument, run as shard 1 of AGENT_M_SHARDS 1; MOD-result-records' parseOutcomes([report], [the declaration of TST-9303]) of the report it writes
// expect: TST-9303 passed, and no case undeclared
test("command — a node case whose name holds > is read whole and named by its declaration", async () => {
  const root = checkout({
    "tests/bridge-name.test.mjs": ['import test from "node:test";', "", nodeDeclaration(9303),
      'test("bridge:<name> — answers when x > 0", () => {});', ""].join("\n"),
  });
  try {
    const run = await runCommand(root, ["tests/bridge-name.test.mjs"], 1, 1);
    assert.deepEqual(outcomesOf(run, [9303]), { "TST-9303": "passed" });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

// TST-1221003 · level: unit · module: MOD-test-schedule
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-027; UC-028
// given: a checkout with tests/numbered.test.mjs, whose declaration of TST-9304 stands before the passing test "TST-262-001: keeps an older number" — a leading TST-262 its file does not declare —, and whose declaration of TST-9305 stands before the passing test "TST-9305: names itself" — a leading TST-<nnn> its file declares — run with the Node.js release the generated configuration provides
// input: the command with the file as its argument, run as shard 1 of AGENT_M_SHARDS 1; MOD-result-records' parseOutcomes([report], [the declarations of TST-9304 and TST-9305]) of the report it writes
// expect: TST-9304 passed and TST-9305 passed, and no case undeclared — TST-262 is no test of the record
test("command — a node case keeps a leading TST number only where its file declares it, and is named by its declaration otherwise", async () => {
  const root = checkout({
    "tests/numbered.test.mjs": ['import test from "node:test";', "",
      nodeDeclaration(9304), 'test("TST-262-001: keeps an older number", () => {});', "",
      nodeDeclaration(9305), 'test("TST-9305: names itself", () => {});', ""].join("\n"),
  });
  try {
    const run = await runCommand(root, ["tests/numbered.test.mjs"], 1, 1);
    assert.deepEqual(outcomesOf(run, [9304, 9305]), { "TST-9304": "passed", "TST-9305": "passed" });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
