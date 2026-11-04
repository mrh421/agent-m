// The facts the trace graph keeps (ITM-382) — MOD-trace-graph's traceGraph, as the Data and the Graph type of
// docs/architecture/MOD-trace-graph.md now state them, extending what ITM-305 built: a node keeps from its file what the checks
// across artifacts read — a module its folder and the interfaces it provides, a plan step or backlog item its level and tests, a
// requirement the items of its source —, and the other kinds have those facts as null; a uses edge keeps the interface it names;
// the graph keeps the path of every file of the repository (files), each Markdown link and autolink an artifact writes (links)
// and the references by position that MOD-identifiers' positionalReferences finds (positions); a requirement's sources are on its
// node and tracesTo gives them from there, and no edge source is built. graphFindings and selfSufficiencyFindings (ITM-306) are not
// part of ITM-382 and are not tested here.
// Run: node --test tests/trace-graph-facts.test.mjs
//
// Module: MOD-trace-graph
// Guards: UC-007; UC-018; UC-019; THE TRACEABILITY MATRIX IS DERIVED; A REQUIREMENT SHOWS WHAT TRACES TO IT; A GROUP CARRIES NO IDENTIFIER
// Level: unit
//
// The fixture repository is small and ours, never Agent M's own: a SPEC.md of two requirements, a use case, an architecture
// decision, a module file, a plan step, a backlog item, a group file and a test file, each a few lines, and three paths that are
// no artifact — a README, a code file and a file the repository lists but does not hold —, given to traceGraph through a
// TextSource built here. Each test states its input and its expected result before it runs (given / input / expect); an
// expected line is read off the fixture (lineOf), not counted; where a test expects that something is not there, the same graph
// is first shown to hold its known positive. ITM-305's cases are in tests/trace-graph-documents.test.mjs and assert what they did.
// The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { positionalReferences } from "../src/identifiers/index.mjs";
import { traceGraph, tracesTo } from "../src/trace-graph/index.mjs";

// A TextSource over a fixed set of files: every key is listed in `paths`, `read` resolves its text; a path named in `missing`
// is listed too, but `read` resolves null for it.
function source(files, missing = []) {
  return {
    paths: [...Object.keys(files), ...missing],
    read: async (path) => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null),
  };
}

// The line, from 1, on which a fixture file has exactly this text; the fixture must hold it once.
function lineOf(lines, text) {
  const at = lines.flatMap((line, i) => (line === text ? [i + 1] : []));
  assert.equal(at.length, 1, `the fixture holds the line ${JSON.stringify(text)} once`);
  return at[0];
}

// The five facts of a node, as the Graph type lists them.
const facts = ({ folder, provides, level, tests, sources }) => ({ folder, provides, level, tests, sources });
const NO_FACTS = { folder: null, provides: null, level: null, tests: null, sources: null };

const RULE = "A SAMPLE RULE";
const OTHER_RULE = "ANOTHER SAMPLE RULE";

// ---------------------------------------------------------------- the fixture repository

const SPEC_PATH = "SPEC.md";
const SPEC_LINES = [
  "# Fixture product — Specification",
  "",
  "## Section",
  "",
  `**${RULE}** *(Product Owner; Vibe Coding, ch. 9)*`,
  "A sample rule that a use case realises.",
  "*Check:* `tests/sample.test.mjs`",
  "",
  `**${OTHER_RULE}** *(Product Owner)*`,
  "Another sample rule.",
  "*Check:* no automatic check; at review",
  "",
];

const UC_PATH = "docs/use-cases/UC-001-read-a-file.md";
const UC_GOAL = "**Goal.** The reader reads a file whole, as UC-002 does after its step 5.";
const UC_LINKS = "The reading is described in [the module](../architecture/MOD-reader.md) and in [the standard](https://example.org/standard).";
const UC_AUTOLINK = "Further reading: <https://example.org/more>.";
const UC_LINES = [
  "---",
  "id: UC-001",
  "title: Read a file",
  "area: reading",
  "actors:",
  "  - Reader",
  "realises:",
  `  - ${RULE}`,
  "---",
  "# UC-001 Read a file",
  "",
  UC_GOAL,
  UC_LINKS,
  UC_AUTOLINK,
  "The syntax `[text](target)` is shown here in a code span, and not used.",
  "",
  "```text",
  "[a link](in-a-block.md) <https://example.org/block>",
  "```",
  "",
];

const ARC_PATH = "docs/architecture/ARC-002-reading-lives-in-a-module.md";
const ARC_LINES = [
  "---",
  "id: ARC-002",
  "title: Reading lives in a module",
  "refines: ARC-001",
  "forced_by:",
  `  - ${RULE}`,
  "designs:",
  "  - MOD-reader",
  "---",
  "# ARC-002 Reading lives in a module",
  "",
  "## Context",
  "",
  "Reading is one concern.",
  "",
];

const MOD_PATH = "docs/architecture/MOD-reader.md";
const MOD_LINK = "It reads a file whole; the plan is in [the plan step](../plan/ITM-001-the-reader.md).";
const MOD_LINES = [
  "---",
  "id: MOD-reader",
  "title: Reading a file",
  "folder: src/reader/",
  "realises:",
  `  - ${RULE}`,
  "follows:",
  "  - ARC-002",
  "uses:",
  "  - MOD-text.readLines",
  "  - MOD-text.Line",
  "provides:",
  "  - readFile",
  "  - FileText",
  "---",
  "# MOD-reader Reading a file",
  "",
  "## Responsibility",
  "",
  MOD_LINK,
  "",
];

const STEP_PATH = "docs/plan/ITM-001-the-reader.md";
const STEP_LINES = [
  "---",
  "id: ITM-001",
  "title: The reader",
  "level: module",
  "realises:",
  "  - UC-001",
  "modules:",
  "  - MOD-reader",
  "tests:",
  "  - unit",
  "---",
  "# ITM-001 The reader",
  "",
  "## Outcome",
  "",
  "A reader.",
  "",
];

const ITEM_PATH = "docs/backlog/ITM-002-the-reader-page.md";
const ITEM_LINES = [
  "---",
  "id: ITM-002",
  "title: The reader page",
  "level: system",
  "realises:",
  "  - UC-001",
  "modules:",
  "  - MOD-reader",
  "builds_on:",
  "  - ITM-001",
  "tests:",
  "  - unit",
  "  - release",
  "---",
  "# ITM-002 The reader page",
  "",
  "## Outcome",
  "",
  "A page.",
  "",
];

const GROUP_PATH = "docs/groups/use-cases.md";
const GROUP_LINES = [
  "# Use cases — groups",
  "",
  "The hierarchy of the use cases, each member by its identifier.",
  "",
  "- Reading",
  "  - UC-001",
  "- Later",
  "",
];

const TEST_PATH = "tests/sample.test.mjs";
const TEST_LINES = [
  "// TST-001",
  "// level: unit",
  `// guards: ${RULE}`,
  "",
];

// Three paths that are no artifact, and one the repository lists but does not hold.
const README_PATH = "README.md";
const CODE_PATH = "src/reader/read.mjs";
const MISSING_PATH = "docs/use-cases/UC-003-missing.md";

// The files in the order a repository lists them; the text of each is its lines joined.
const FILES = Object.fromEntries([
  [SPEC_PATH, SPEC_LINES], [README_PATH, ["# Fixture product", ""]], [UC_PATH, UC_LINES], [ARC_PATH, ARC_LINES], [MOD_PATH, MOD_LINES],
  [STEP_PATH, STEP_LINES], [ITEM_PATH, ITEM_LINES], [GROUP_PATH, GROUP_LINES], [TEST_PATH, TEST_LINES],
  [CODE_PATH, ["export const read = 1;", ""]],
].map(([path, lines]) => [path, lines.join("\n")]));
const repository = () => source(FILES, [MISSING_PATH]);

// ---------------------------------------------------------------- the facts of a node

// TST-473142 · level: unit · module: MOD-trace-graph
// guards: THE TRACEABILITY MATRIX IS DERIVED; UC-007; UC-019
// given: the fixture's module file MOD-reader — front matter with `folder: src/reader/` and two provided names, readFile and FileText
// input: traceGraph over the fixture repository
// expect: no file unread but the one the repository does not hold; the node MOD-reader keeps its folder "src/reader/" and the list of what it provides, ["readFile", "FileText"], and has its level, tests and sources as null
test("traceGraph — a module's node keeps its folder and the interfaces it provides, and has the other facts as null", async () => {
  const graph = await traceGraph(repository());
  assert.deepEqual(graph.unread.map((entry) => entry.path), [MISSING_PATH], "known positive: every file the repository holds was read");
  assert.deepEqual(facts(graph.nodes.get("MOD-reader")),
    { folder: "src/reader/", provides: ["readFile", "FileText"], level: null, tests: null, sources: null });
});

// TST-473143 · level: unit · module: MOD-trace-graph
// guards: THE TRACEABILITY MATRIX IS DERIVED; UC-007; UC-019
// given: the fixture's plan step ITM-001 (level module, test unit), under docs/plan/, and backlog item ITM-002 (level system, tests unit and release), under docs/backlog/
// input: traceGraph over the fixture repository
// expect: each node keeps the level and the list of tests its file gives, and has its folder, provides and sources as null
test("traceGraph — a plan step's and a backlog item's node keep their level and tests, and have the other facts as null", async () => {
  const graph = await traceGraph(repository());
  assert.deepEqual(facts(graph.nodes.get("ITM-001")),
    { folder: null, provides: null, level: "module", tests: ["unit"], sources: null });
  assert.deepEqual(facts(graph.nodes.get("ITM-002")),
    { folder: null, provides: null, level: "system", tests: ["unit", "release"], sources: null });
});

// TST-473144 · level: unit · module: MOD-trace-graph
// guards: A REQUIREMENT SHOWS WHAT TRACES TO IT; THE TRACEABILITY MATRIX IS DERIVED; UC-007
// given: the fixture's SPEC.md — A SAMPLE RULE with the source "Product Owner; Vibe Coding, ch. 9", two items, and ANOTHER SAMPLE RULE with the source "Product Owner", one
// input: traceGraph over the fixture repository
// expect: each requirement's node keeps the items of its source as written, split at the semicolon and trimmed, and has its folder, provides, level and tests as null
test("traceGraph — a requirement's node keeps the items of its source as written, and has the other facts as null", async () => {
  const graph = await traceGraph(repository());
  assert.deepEqual(facts(graph.nodes.get(RULE)),
    { folder: null, provides: null, level: null, tests: null, sources: ["Product Owner", "Vibe Coding, ch. 9"] });
  assert.deepEqual(facts(graph.nodes.get(OTHER_RULE)),
    { folder: null, provides: null, level: null, tests: null, sources: ["Product Owner"] });
});

// TST-473145 · level: unit · module: MOD-trace-graph
// guards: THE TRACEABILITY MATRIX IS DERIVED; UC-007; UC-019
// given: the fixture's use case UC-001 and architecture decision ARC-002, neither of which has a fact of its own, and test TST-001, whose fact is its level
// input: traceGraph over the fixture repository
// expect: the five facts of UC-001 and ARC-002 are null — the kinds that have none —; TST-001's are null but its level, "unit" as its declaration names it
test("traceGraph — the nodes of the other kinds have all five facts as null, a test's but its level", async () => {
  const graph = await traceGraph(repository());
  for (const id of ["UC-001", "ARC-002", "TST-001"]) assert.ok(graph.nodes.has(id), `known positive: the graph holds ${id}`);
  for (const id of ["UC-001", "ARC-002"]) assert.deepEqual(facts(graph.nodes.get(id)), NO_FACTS, id);
  assert.deepEqual(facts(graph.nodes.get("TST-001")), { ...NO_FACTS, level: "unit" }, "TST-001");
});

// ---------------------------------------------------------------- the interface of a uses edge

// TST-473146 · level: unit · module: MOD-trace-graph
// guards: THE TRACEABILITY MATRIX IS DERIVED; UC-007; UC-019
// given: the fixture's module file MOD-reader, which uses MOD-text.readLines and MOD-text.Line
// input: traceGraph over the fixture repository
// expect: the two uses edges, at their list items, keep the interface they name after the module, readLines and Line; every other edge of the graph — realises, follows, guards, names — has its interface as null
test("traceGraph — a uses edge keeps the interface it names after the module, and no other edge has one", async () => {
  const graph = await traceGraph(repository());
  const uses = graph.edges.filter((edge) => edge.via === "uses")
    .map(({ from, via, interface: named, path, line }) => ({ from, via, interface: named, path, line }));
  assert.deepEqual(uses, [
    { from: "MOD-reader", via: "uses", interface: "readLines", path: MOD_PATH, line: lineOf(MOD_LINES, "  - MOD-text.readLines") },
    { from: "MOD-reader", via: "uses", interface: "Line", path: MOD_PATH, line: lineOf(MOD_LINES, "  - MOD-text.Line") },
  ]);
  const others = graph.edges.filter((edge) => edge.via !== "uses");
  assert.ok(others.some((edge) => edge.via === "realises") && others.some((edge) => edge.via === "guards"),
    "known positive: the graph holds edges of other kinds");
  assert.deepEqual(others.filter((edge) => edge.interface !== null), []);
});

// ---------------------------------------------------------------- a group's node

// TST-473147 · level: unit · module: MOD-trace-graph
// guards: A GROUP CARRIES NO IDENTIFIER; THE TRACEABILITY MATRIX IS DERIVED
// given: the fixture's group file docs/groups/use-cases.md — a group Reading (line 5) holding UC-001, and a group Later (line 7)
// input: traceGraph over the fixture repository
// expect: a node of the kind group for the group Reading, keyed by its file and line, with the group's title, the line of the title, the git blob SHA of the group file as `blob` and the five facts as null; UC-001, which the group lists, is still the use case's node
test("traceGraph — a group's title is a node of the kind group, keyed by its file and line, with the facts as null", async () => {
  const graph = await traceGraph(repository());
  const line = lineOf(GROUP_LINES, "- Reading");
  const node = graph.nodes.get(`${GROUP_PATH}:${line}`);
  assert.ok(node, "the graph holds a node keyed by the file and the line of the title");
  const { blob, ...rest } = node;
  assert.deepEqual(rest, { id: `${GROUP_PATH}:${line}`, kind: "group", path: GROUP_PATH, line, title: "Reading", ...NO_FACTS });
  assert.match(blob, /^[0-9a-f]{40}$/);
  assert.equal(graph.nodes.get("UC-001").path, UC_PATH, "a member the group file lists is not a node of the group file");
});

// ---------------------------------------------------------------- the paths of the repository

// TST-473148 · level: unit · module: MOD-trace-graph
// guards: THE TRACEABILITY MATRIX IS DERIVED; UC-007; UC-019
// given: a repository that lists ten paths the fixture holds — among them a README and a code file, which are no artifact — and one it does not hold
// input: traceGraph over it
// expect: `files` holds all eleven paths, in the order the repository lists them; the path it does not hold is also in unread
test("traceGraph — files holds every path the repository lists, those that are no artifact and those it does not hold included", async () => {
  const graph = await traceGraph(repository());
  assert.deepEqual(graph.files, [
    SPEC_PATH, README_PATH, UC_PATH, ARC_PATH, MOD_PATH, STEP_PATH, ITEM_PATH, GROUP_PATH, TEST_PATH, CODE_PATH, MISSING_PATH,
  ]);
  assert.deepEqual(graph.unread, [{ path: MISSING_PATH, reason: "the commit does not hold it" }]);
});

// ---------------------------------------------------------------- the links an artifact writes

// TST-473149 · level: unit · module: MOD-trace-graph
// guards: THE TRACEABILITY MATRIX IS DERIVED; UC-007; UC-018; UC-019
// given: UC-001, whose text writes a Markdown link to a module file and one to an address, and an autolink, on two lines; a code span and a fenced block that show link syntax; and MOD-reader, whose text writes a Markdown link to a plan step
// input: traceGraph over the fixture repository
// expect: `links` holds four links, in the order of the files and of the text: the artifact's identifier as `from`, the target as written — a relative path stays relative —, the file and the line; none for the code span and the fenced block
test("traceGraph — links holds each Markdown link and autolink an artifact writes, with its target as written, its file and line", async () => {
  const graph = await traceGraph(repository());
  const reading = lineOf(UC_LINES, UC_LINKS), further = lineOf(UC_LINES, UC_AUTOLINK);
  assert.deepEqual(graph.links, [
    { from: "UC-001", target: "../architecture/MOD-reader.md", path: UC_PATH, line: reading },
    { from: "UC-001", target: "https://example.org/standard", path: UC_PATH, line: reading },
    { from: "UC-001", target: "https://example.org/more", path: UC_PATH, line: further },
    { from: "MOD-reader", target: "../plan/ITM-001-the-reader.md", path: MOD_PATH, line: lineOf(MOD_LINES, MOD_LINK) },
  ]);
});

// ---------------------------------------------------------------- the references by position

// TST-473150 · level: unit · module: MOD-trace-graph
// guards: A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION; UC-007; UC-019
// given: UC-001, whose text points at "its step 5" — a step of another use case by its number —, and no other artifact of the fixture that points at a part of another by its position
// input: traceGraph over the fixture repository
// expect: `positions` holds the warnings positionalReferences gives for UC-001's text, as it gives them — one, at the line of that text, under A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION, naming the file
test("traceGraph — positions holds the references by position that positionalReferences finds, as it gives them", async () => {
  const graph = await traceGraph(repository());
  assert.equal(graph.positions.length, 1);
  const [warning] = graph.positions;
  assert.deepEqual([warning.artifact, warning.line, warning.kind, warning.rule],
    [UC_PATH, lineOf(UC_LINES, UC_GOAL), "warning", "A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION"]);
  assert.match(warning.what, /step 5/);
  assert.deepEqual(graph.positions, positionalReferences(UC_PATH, FILES[UC_PATH]));
});

// ---------------------------------------------------------------- the sources of a requirement

// TST-473151 · level: unit · module: MOD-trace-graph
// guards: A REQUIREMENT SHOWS WHAT TRACES TO IT; THE TRACEABILITY MATRIX IS DERIVED; UC-007
// given: the fixture's SPEC.md, whose requirements name one and two sources
// input: traceGraph over the fixture repository, then tracesTo of each requirement and of two names that are none
// expect: tracesTo gives a requirement the sources its node keeps, in order; a name that is no requirement has none; the graph holds no edge `source`, and no edge starts at a requirement
test("tracesTo — a requirement's sources come from its node, and the graph holds no source edge", async () => {
  const graph = await traceGraph(repository());
  assert.ok(graph.edges.some((edge) => edge.via === "realises"), "known positive: the graph holds edges");
  assert.deepEqual(tracesTo(graph, RULE).sources, ["Product Owner", "Vibe Coding, ch. 9"]);
  assert.deepEqual(tracesTo(graph, OTHER_RULE).sources, ["Product Owner"]);
  assert.deepEqual(tracesTo(graph, "UC-001").sources, []);
  assert.deepEqual(tracesTo(graph, "NO SUCH RULE").sources, []);
  assert.deepEqual(tracesTo(graph, RULE).tests, ["TST-001"], "known positive: the tests that guard it are still given");
  assert.equal(graph.edges.some((edge) => edge.via === "source"), false);
  assert.deepEqual(graph.edges.filter((edge) => edge.from === RULE || edge.from === OTHER_RULE), []);
});
