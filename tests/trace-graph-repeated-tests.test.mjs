// A test identifier declared at more than one place (ITM-1321) — MOD-trace-graph's graphFindings, as
// docs/architecture/MOD-trace-graph.md states it: "a test identifier declared at more than one place — the path and line of its
// node and of its `guards` and `exercises` edges, each the place of the declaration it was read from —, as an error at each place
// that names the other places by path and line (`THE NAME IS THE ID AND IT SURVIVES`)". MOD-test-document reads one file at a
// time, so a repeat across files is seen only in the graph.
// Run: node --test tests/trace-graph-repeated-tests.test.mjs
//
// Module: MOD-trace-graph
// Guards: THE NAME IS THE ID AND IT SURVIVES; A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
// Level: unit
//
// The first case builds its graphs with traceGraph from a small fixture repository of ours, through a TextSource built here; the
// second reads the test files of this repository as they stand, as TST-292101 reads the gate records. Each states its expected
// result before it runs; an expected line is read off the file that holds it, not counted. Only the findings of the one rule are
// looked at in the second: the other rules' findings over this repository are other checks' business.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { isTestFile } from "../src/test-document/index.mjs";
import { traceGraph, graphFindings } from "../src/trace-graph/index.mjs";

const RULE = "THE NAME IS THE ID AND IT SURVIVES";
const REQUIREMENT = "A SAMPLE RULE";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// A TextSource over a fixed set of files: every key is listed in `paths`, `read` resolves its text.
const source = (files) => ({
  paths: Object.keys(files),
  read: async (path) => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null),
});

// The line, from 1, on which a text has a line that begins with `start`; the text must hold one such line.
function lineOf(text, start) {
  const at = text.split("\n").flatMap((line, i) => (line.startsWith(start) ? [i + 1] : []));
  assert.equal(at.length, 1, `the text holds one line beginning ${JSON.stringify(start)}`);
  return at[0];
}

// The findings as `<artifact>:<line> <kind> <rule>`, in order, and each `what` names the identifier and every other place.
function assertRepeats(found, wanted, label) {
  const key = (f) => `${f.artifact}:${f.line} ${f.kind} ${f.rule}`;
  assert.deepEqual(found.map(key).sort(), wanted.map((w) => `${w.at} error ${RULE}`).sort(), label);
  for (const w of wanted) {
    const f = found.find((one) => `${one.artifact}:${one.line}` === w.at);
    assert.ok(f.what.includes(w.id), `${label}: ${JSON.stringify(f.what)} names ${w.id}`);
    for (const other of w.others) assert.ok(f.what.includes(other), `${label}: ${JSON.stringify(f.what)} names ${other}`);
    const own = new RegExp(`${w.at.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`);
    assert.ok(!own.test(f.what), `${label}: ${JSON.stringify(f.what)} does not name its own place`);
    assert.ok(typeof f.fix === "string" && f.fix !== "", `${label}: the finding says what to do`);
  }
}

// ---------------------------------------------------------------- a fixture repository

const SPEC = ["# Fixture product — Specification", "", "## Section", "", `**${REQUIREMENT}** *(Product Owner)*`,
  "A sample rule that a test guards.", "*Check:* `tests/a.test.mjs`", ""].join("\n");

// A declaration of `id` that guards the requirement and exercises MOD-reader; with `guards: false`, one that exercises it only.
const declaration = (id, { guards = true } = {}) => [`// ${id} · level: unit · module: MOD-reader`,
  ...(guards ? [`// guards: ${REQUIREMENT}`] : []), "// given: a file", "// input: it is read", "// expect: it is read whole",
  `test("${id}", () => {});`, ""];
const file = (...parts) => ["// A fixture test file.", "//", "// Module: MOD-reader", "// Level: unit", "", ...parts.flat()].join("\n");

// TST-1321001 · level: unit · module: MOD-trace-graph
// guards: THE NAME IS THE ID AND IT SURVIVES; A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
// given: a fixture SPEC of one requirement and two test files: tests/a.test.mjs declaring TST-001 and tests/b.test.mjs declaring TST-001 after a TST-002 of its own; then tests/a.test.mjs declaring TST-001 twice and tests/b.test.mjs TST-002 only; then tests/a.test.mjs declaring TST-001 exercising MOD-reader and guarding nothing, and tests/b.test.mjs declaring TST-001 too; and, the known positive, the first repository with tests/b.test.mjs declaring TST-003 in place of TST-001
// input: graphFindings of the graph traceGraph builds from each
// expect: for the first three, exactly one error under THE NAME IS THE ID AND IT SURVIVES at each declaration of TST-001, the path as its artifact and the line of the declaration, whose text names TST-001 and the other declaration by path and line, and not its own place — in the third the first declaration's place is the place of its exercises edge alone, since the graph's node keeps the place of the declaration read last; for the known positive, whose graph holds TST-001, TST-002 and TST-003, no finding at all
test("TST-1321001: a test identifier declared at two places is an error at each, naming the other; distinct identifiers give none", async () => {
  const twoFiles = { "SPEC.md": SPEC, "tests/a.test.mjs": file(declaration("TST-001")),
    "tests/b.test.mjs": file(declaration("TST-002"), declaration("TST-001")) };
  const oneFile = { "SPEC.md": SPEC, "tests/a.test.mjs": file(declaration("TST-001"), declaration("TST-001")),
    "tests/b.test.mjs": file(declaration("TST-002")) };
  const exercisesOnly = { "SPEC.md": SPEC, "tests/a.test.mjs": file(declaration("TST-001", { guards: false })),
    "tests/b.test.mjs": file(declaration("TST-001")) };

  const a = lineOf(twoFiles["tests/a.test.mjs"], "// TST-001 ");
  const b = lineOf(twoFiles["tests/b.test.mjs"], "// TST-001 ");
  assert.notEqual(a, b, "known positive: the two declarations stand at different lines, so that a place names its file and line");
  const graph = await traceGraph(source(twoFiles));
  assert.deepEqual(graph.unread, [], "known positive: every file was read");
  assert.ok(graph.nodes.get("TST-001")?.kind === "TST" && graph.nodes.has("TST-002"), "known positive: the graph holds the tests");
  assertRepeats(graphFindings(graph), [
    { at: `tests/a.test.mjs:${a}`, id: "TST-001", others: [`tests/b.test.mjs:${b}`] },
    { at: `tests/b.test.mjs:${b}`, id: "TST-001", others: [`tests/a.test.mjs:${a}`] },
  ], "two files");

  const lines = oneFile["tests/a.test.mjs"].split("\n").flatMap((line, i) => (line.startsWith("// TST-001 ") ? [i + 1] : []));
  assert.equal(lines.length, 2, "known positive: the file declares TST-001 twice");
  assertRepeats(graphFindings(await traceGraph(source(oneFile))), [
    { at: `tests/a.test.mjs:${lines[0]}`, id: "TST-001", others: [`tests/a.test.mjs:${lines[1]}`] },
    { at: `tests/a.test.mjs:${lines[1]}`, id: "TST-001", others: [`tests/a.test.mjs:${lines[0]}`] },
  ], "one file");

  const first = lineOf(exercisesOnly["tests/a.test.mjs"], "// TST-001 ");
  const last = lineOf(exercisesOnly["tests/b.test.mjs"], "// TST-001 ");
  const exercising = await traceGraph(source(exercisesOnly));
  assert.deepEqual(exercising.edges.filter((edge) => edge.from === "TST-001" && edge.path === "tests/a.test.mjs").map((edge) => edge.via), ["exercises"],
    "known positive: the first declaration is in the graph by its exercises edge alone");
  assert.equal(exercising.nodes.get("TST-001").path, "tests/b.test.mjs", "known positive: the node keeps the place of the declaration read last");
  assertRepeats(graphFindings(exercising), [
    { at: `tests/a.test.mjs:${first}`, id: "TST-001", others: [`tests/b.test.mjs:${last}`] },
    { at: `tests/b.test.mjs:${last}`, id: "TST-001", others: [`tests/a.test.mjs:${first}`] },
  ], "a declaration that exercises a module and guards nothing");

  const distinct = { ...twoFiles, "tests/b.test.mjs": file(declaration("TST-002"), declaration("TST-003")) };
  const clean = await traceGraph(source(distinct));
  assert.deepEqual(["TST-001", "TST-002", "TST-003"].map((id) => clean.nodes.get(id)?.kind), ["TST", "TST", "TST"], "known positive: the graph holds the three tests");
  assert.deepEqual(graphFindings(clean), [], "distinct identifiers");
});

// ---------------------------------------------------------------- the repository's own test files

const RELEASE = "tests/release-itm-1187-bar-offers-sessions.test.mjs";
const COMPONENT = "tests/prompt-bar-endpoints.test.mjs";
const tracked = execFileSync("git", ["-C", ROOT, "ls-files", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);

// The findings of the rule over this repository's committed test files, with `edits` ({ path: text }) in place of the files they name.
async function repeats(edits = {}) {
  const read = async (path) => {
    if (path in edits) return edits[path];
    try { return readFileSync(join(ROOT, path), "utf8"); } catch { return null; }
  };
  const graph = await traceGraph({ paths: tracked.filter((path) => isTestFile(path)), read });
  return { graph, found: graphFindings(graph).filter((finding) => finding.rule === RULE) };
}

// TST-1321002 · level: unit · module: MOD-trace-graph
// guards: THE NAME IS THE ID AND IT SURVIVES
// given: the committed test files of this repository (git ls-files, those MOD-test-document's isTestFile names), read as they stand; and, the history's known positive of sprint 127, the same files with tests/release-itm-1187-bar-offers-sessions.test.mjs declaring TST-1187101 to 1187104 again, as it did before #1526 gave its cases TST-1187201 to 1187204, while tests/prompt-bar-endpoints.test.mjs holds TST-1187101 to 1187104
// input: traceGraph over each, then graphFindings, of which the findings under THE NAME IS THE ID AND IT SURVIVES
// expect: over the files as they stand, at least 5000 tests are read and no finding; over the known positive exactly 8 errors, one at each of the four declarations in each of the two files, by path and line, each naming the identifier and the declaration of the other file by path and line
test("TST-1321002: the repository's own test files declare no identifier twice; sprint 127's repeat of TST-1187101 to 1187104 is found", async () => {
  const { graph, found } = await repeats();
  assert.ok([...graph.nodes.values()].filter((node) => node.kind === "TST").length >= 5000, "known positive: the tests of the repository are read");
  assert.deepEqual(found.map((f) => `${f.artifact}:${f.line}: ${f.what}`), [], "the repository as it stands");

  const release = readFileSync(join(ROOT, RELEASE), "utf8");
  const component = readFileSync(join(ROOT, COMPONENT), "utf8");
  const before = release.replace(/TST-11872(0[1-4])\b/g, "TST-11871$1");
  const ids = ["TST-1187101", "TST-1187102", "TST-1187103", "TST-1187104"];
  const wanted = ids.flatMap((id) => {
    const inRelease = `${RELEASE}:${lineOf(before, `// ${id} `)}`;
    const inComponent = `${COMPONENT}:${lineOf(component, `// ${id} `)}`;
    return [{ at: inRelease, id, others: [inComponent] }, { at: inComponent, id, others: [inRelease] }];
  });
  const history = await repeats({ [RELEASE]: before });
  assert.equal(history.found.length, 8, "the four identifiers, each at its two declarations");
  assertRepeats(history.found, wanted, "sprint 127's release cases");
});
