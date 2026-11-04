// Release tests of ITM-1321, one test identifier names one test case — what a developer or a release tester meets when two test files declare the same TST identifier: the checks across artifacts (graphFindings of the trace
// graph) report it as an error at each place, naming the other, under THE NAME IS THE ID AND IT SURVIVES; a reference to an identifier that two cases hold names two cases, so neither is named (A REFERENCE NAMES THE
// IDENTIFIER, NOT THE POSITION). The cases build the trace graph of a fixture repository — a SPEC, and unit, component and release test files — and read the findings as the workflow that stores the graph reads them; they
// never read a code file.
// Run: node --test tests/release-itm-1321-one-test-identifier-names-one-test-case.test.mjs
//
// Module: MOD-trace-graph
// Guards: THE NAME IS THE ID AND IT SURVIVES; A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
// Level: release
//
// Written for the release testing of sprint 130 by developer-sonnet-l, who implemented none of ITM-1321 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Readings the texts leave open, which the cases state:
//   - "declared at more than one place" is read as: two comment blocks of test declarations whose first line begins with the identifier, in one file or in two; a line that only mentions the identifier is no declaration.
//   - "a place" is a path and a line, as the finding names it (its artifact is the path, its line the declaration's line).

import test from "node:test";
import assert from "node:assert/strict";
import { traceGraph, graphFindings } from "../src/trace-graph/index.mjs";

const RULE = "THE NAME IS THE ID AND IT SURVIVES";
const REQUIREMENT = "A SAMPLE RULE";
const source = (files) => ({ paths: Object.keys(files), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) });
const SPEC = ["# Fixture product — Specification", "", "## Section", "", `**${REQUIREMENT}** *(Product Owner)*`, "A sample rule that tests guard.", "*Check:* `tests/unit.test.mjs`", ""].join("\n");

// One declaration of `id` at `level`, with a title of its own, and its test case.
const declaration = (id, level, title) => [`// ${id} · level: ${level} · module: MOD-reader`, `// guards: ${REQUIREMENT}`, "// given: a file", "// input: it is read", `// expect: ${title}`, `test("${id}: ${title}", () => {});`, ""];
const file = (level, ...parts) => ["// A fixture test file.", "//", "// Module: MOD-reader", `// Level: ${level}`, "", ...parts.flat()].join("\n");
const lineOf = (text, id) => {
  const at = text.split("\n").flatMap((line, i) => (line.startsWith(`// ${id} `) ? [i + 1] : []));
  assert.equal(at.length, 1, `the file holds one declaration of ${id}`);
  return at[0];
};
const repeatsOf = async (files) => {
  const graph = await traceGraph(source(files));
  assert.deepEqual(graph.unread, [], "known positive: every file is read");
  return graphFindings(graph).filter((finding) => finding.rule === RULE);
};

// The repository of a team: a unit file with TST-101 and TST-102, a component file with TST-201, and a release file whose cases are numbered by their author.
const repository = (releaseIds) => ({
  "SPEC.md": SPEC,
  "tests/unit.test.mjs": file("unit", declaration("TST-101", "unit", "a is read"), declaration("TST-102", "unit", "b is read")),
  "tests/component.test.mjs": file("component", declaration("TST-201", "component", "the parts work together")),
  "tests/release.test.mjs": file("release", ...releaseIds.map((id) => declaration(id, "release", `the release case ${id}`))),
});

// TST-1321101 · level: release · module: MOD-trace-graph
// guards: THE NAME IS THE ID AND IT SURVIVES; A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
// given: a fixture repository whose unit file declares TST-101 and TST-102, whose component file declares TST-201, and whose release file declares TST-201 again with a title of its own and TST-301; known positive first — the same repository with the release file declaring TST-202 and TST-301 gives no finding
// input: graphFindings of the trace graph of each repository
// expect: known positive — with TST-202 and TST-301 the graph holds the five tests and no finding; with TST-201 declared twice exactly two errors under THE NAME IS THE ID AND IT SURVIVES, one at tests/component.test.mjs and one at tests/release.test.mjs, each at the line of its declaration, each naming TST-201 and the other place by path and line and not its own, each saying what to do — and none for TST-101, TST-102 or TST-301
test("TST-1321101: a test identifier that a release file declares again is an error at both declarations, naming the other; renamed, it is none", async () => {
  const clean = repository(["TST-202", "TST-301"]);
  const graph = await traceGraph(source(clean));
  assert.deepEqual(["TST-101", "TST-102", "TST-201", "TST-202", "TST-301"].map((id) => graph.nodes.get(id)?.kind), ["TST", "TST", "TST", "TST", "TST"], "known positive: the graph holds the five tests");
  assert.deepEqual(await repeatsOf(clean), [], "known positive: distinct identifiers give no finding");

  const files = repository(["TST-201", "TST-301"]);
  const component = `tests/component.test.mjs:${lineOf(files["tests/component.test.mjs"], "TST-201")}`;
  const release = `tests/release.test.mjs:${lineOf(files["tests/release.test.mjs"], "TST-201")}`;
  assert.notEqual(component, release, "known positive: the two declarations stand at two places");
  const found = await repeatsOf(files);
  assert.deepEqual(found.map((finding) => `${finding.artifact}:${finding.line} ${finding.kind}`).sort(), [`${component} error`, `${release} error`].sort(), "an error at each declaration");
  for (const [own, other] of [[component, release], [release, component]]) {
    const finding = found.find((one) => `${one.artifact}:${one.line}` === own);
    assert.ok(finding.what.includes("TST-201"), `${own} names the identifier: ${finding.what}`);
    assert.ok(finding.what.includes(other), `${own} names the other place ${other}: ${finding.what}`);
    assert.ok(!new RegExp(`${own.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?!\\d)`).test(finding.what), `${own} does not name its own place`);
    assert.ok(typeof finding.fix === "string" && finding.fix !== "", `${own} says what to do`);
  }
});

// TST-1321102 · level: release · module: MOD-trace-graph
// guards: THE NAME IS THE ID AND IT SURVIVES; A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
// given: a fixture repository in which one file declares TST-101 twice, with two different titles and different expected results, and the other files declare distinct identifiers; the same repository in which a comment of the component file only mentions TST-101 and TST-102 in its text; known positive first — the first repository's two declarations are two cases of the file
// input: graphFindings of the trace graph of each repository
// expect: known positive — the file holds two declarations of TST-101 at two lines; the repository with the repeat in one file gives an error at each of the two lines, naming the other line of the same file; the repository whose comment merely mentions identifiers gives no finding — a mention is no declaration — and the declaration it mentions stands once
test("TST-1321102: an identifier declared twice in one file, even with different titles, is an error at each; an identifier only mentioned in a comment is none", async () => {
  const twice = {
    "SPEC.md": SPEC,
    "tests/unit.test.mjs": file("unit", declaration("TST-101", "unit", "a is read"), declaration("TST-102", "unit", "b is read"), declaration("TST-101", "unit", "a different case, read otherwise")),
    "tests/component.test.mjs": file("component", declaration("TST-201", "component", "the parts work together")),
  };
  const lines = twice["tests/unit.test.mjs"].split("\n").flatMap((line, i) => (line.startsWith("// TST-101 ") ? [i + 1] : []));
  assert.equal(lines.length, 2, "known positive: the file declares TST-101 at two lines");
  const found = await repeatsOf(twice);
  assert.deepEqual(found.map((finding) => `${finding.artifact}:${finding.line}`).sort(), lines.map((line) => `tests/unit.test.mjs:${line}`).sort(), "an error at each of the two lines");
  for (const [own, other] of [[lines[0], lines[1]], [lines[1], lines[0]]]) {
    const finding = found.find((one) => one.line === own);
    assert.ok(finding.what.includes(`tests/unit.test.mjs:${other}`) && finding.what.includes("TST-101"), `line ${own} names TST-101 and line ${other}: ${finding.what}`);
  }

  const mentioned = repository(["TST-202"]);
  mentioned["tests/component.test.mjs"] = file("component", "// This case follows TST-101 and TST-102 of tests/unit.test.mjs.", "", declaration("TST-201", "component", "the parts work together"));
  assert.ok(mentioned["tests/component.test.mjs"].includes("TST-101"), "known positive: the component file mentions TST-101");
  assert.deepEqual(await repeatsOf(mentioned), [], "a mention is no declaration");
});
