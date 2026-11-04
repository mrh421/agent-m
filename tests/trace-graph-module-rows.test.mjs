// The module rows and their gaps in the trace graph (ITM-692) — MOD-trace-graph's moduleRows, as docs/architecture/MOD-trace-graph.md
// states it: one row per module, as UC-025 shows it — the subsystem it follows, the requirements its tests guard, the file that
// describes it, its code, its tests, the modules its code imports and whether imports could be read — and the gaps
// (MODULE GAPS ARE REPORTED, NOT FORBIDDEN): a module in no subsystem or whose subsystem's decision does not name it; a module that
// realises no requirement; an accepted requirement no module realises; a module no test exercises, or without code; a code file
// outside every module's folder; an import between modules that the importing module's file does not name among the interfaces it
// uses; a module folder inside another; a name that matches nothing.
// Run: node --test tests/trace-graph-module-rows.test.mjs
//
// Module: MOD-trace-graph
// Guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN; EVERY CODE FILE BELONGS TO A MODULE; A MODULE IS A FOLDER; A MODULE BELONGS TO ONE SUBSYSTEM
// Level: unit
//
// The fixture is small and ours, never Agent M's own: a SPEC.md of three requirements, two decisions, five module files, six code
// files and three test files, given to traceGraph through a TextSource built here — a graph, not a hand-made object. Each module of
// it has one thing that the others lack (given / input / expect in each test). The expected rows and gaps are written out in this
// file, never read from the module file. The counter-proofs are recorded in the pull request.
//
// Readings the tests rest on, each quoted from the text that gives it (the module file is docs/architecture/MOD-trace-graph.md):
// - Interfaces, `moduleRows`: "one row per module, as UC-025 shows it". UC-025 step 3 gives "belongs to — its subsystem, by the
//   decision that states it", "described by — its file", "code — the files in its folder" and "tests — the tests that exercise
//   it". So `subsystem` is the decision the module's file follows (`null` where it follows none), `describedBy` the path of its
//   file, `code` the paths of the code files whose path begins with its folder, `tests` the identifiers of the tests that exercise
//   it, and `imports` the modules its code files import. `realises` is the requirements the tests that exercise the module
//   guard (UC-025 step 3: "realises — the requirements its tests guard"; step 4: "a module that realises no requirement: no test of it
//   guards one"): the requirement nodes the `guards` of its tests name, whatever the module's file names under `realises`. A guard on a
//   use case or a decision is no requirement and is not listed; a name that matches nothing stays a gap (`unknown-name`, 4b).
// - Data, "The module imported is the one whose `folder` is the beginning of the resolved path": a code file belongs to the module
//   whose folder is the longest beginning of its path.
// - Interfaces, `ModuleRow`: "`importsRead: boolean`" and "Where imports could not be read for a file's language, `importsRead` is
//   false and the row says so": false when a code file of the module has an extension whose imports are not read.
// - Interfaces, `moduleRows`: "an accepted requirement no module realises — accepted as its caller marks it —": moduleRows takes
//   the graph alone, and the graph holds the requirements of SPEC.md, so every requirement of the graph counts as accepted.
// - Interfaces, `ModuleGap`: "`{ kind, artifact, path, what }`, its `kind` one of the gaps `moduleRows` lists": the module file
//   gives no word for a kind. The kinds written here are the gaps' own words, and the rows and the gaps come sorted: the rows by
//   module, the gaps by kind and then by artifact. `artifact` is the module, the requirement, the code file or the test the gap
//   concerns and `path` its file.
// - Interfaces, `moduleRows`: "a code file outside every module's folder, or a folder no module names": both are built (the Product
//   Owner's ruling, point 2): a gap for each code file outside every module's folder, and, besides, one gap for each folder that
//   holds such files, the folder being the directory of the file.
// - Interfaces, `moduleRows`: "a name that matches nothing", read with UC-025 step 4, "a name that matches no requirement, use case,
//   decision or module" (ruling, point 4): a `realises`, `forced_by`, `guards`, `follows` or `uses` whose name — for `uses` the
//   module before the dot — is none of those four.

import test from "node:test";
import assert from "node:assert/strict";
import * as traceGraphModule from "../src/trace-graph/index.mjs";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { testHeader } from "../src/test-document/index.mjs";

// A name the module does not provide yet is undefined here, so that each test fails by itself and not the whole file at once.
const { traceGraph, moduleRows } = traceGraphModule;

// A TextSource over a fixed set of files, whose reads are logged: every key is listed in `paths`, in the order of the keys.
function source(files) {
  const reads = [];
  return {
    reads,
    paths: Object.keys(files),
    read: async (path) => { reads.push(path); return Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null; },
  };
}

const lines = (...rows) => rows.join("\n") + "\n";

// A module file: the fields given, a list written one name to a line.
function moduleFile(id, { folder, realises = [], follows = [], uses = [], provides = [] }) {
  const list = (key, names) => (names.length ? [`${key}:`, ...names.map((name) => `  - ${name}`)] : [`${key}: []`]);
  return lines("---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, ...list("realises", realises), ...list("follows", follows),
    ...list("uses", uses), ...list("provides", provides), "---", `# ${id}`);
}

// A test file with one declaration. The declaration's lines are built here from parts, so that this file declares no test by them.
const declared = (id, module, ...guards) => lines(
  ["//", id, "·", "level: unit", "·", `module: ${module}`].join(" "),
  ["//", `guards: ${guards.join("; ")}`].join(" "),
  "// given: nothing", "// input: nothing", "// expect: nothing",
  'test("a fixture test", () => {});');

const RULES = ["RULE ALPHA", "RULE BETA", "RULE LOOSE"];
const SPEC = lines("# Fixture product — Specification", "", "## Section", "",
  ...RULES.flatMap((name) => [`**${name}** *(Product Owner)*`, `The rule ${name}.`, "*Check:* none", ""]));

const FIXTURE = {
  "SPEC.md": SPEC,
  "docs/architecture/ARC-001-the-whole.md": lines("---", "id: ARC-001", "title: The whole", "forced_by:", "  - RULE ALPHA", "---", "# ARC-001 The whole"),
  "docs/architecture/ARC-002-the-subsystem.md": lines("---", "id: ARC-002", "title: The subsystem", "refines: ARC-001", "forced_by:", "  - RULE BETA",
    "designs:", "  - MOD-alpha", "  - MOD-beta", "  - MOD-inner", "---", "# ARC-002 The subsystem"),
  "docs/architecture/MOD-alpha.md": moduleFile("MOD-alpha", { folder: "src/alpha/", realises: ["RULE ALPHA"], follows: ["ARC-002"], uses: ["MOD-beta.run"], provides: ["go"] }),
  "docs/architecture/MOD-beta.md": moduleFile("MOD-beta", { folder: "src/beta/", realises: ["RULE BETA"], follows: ["ARC-002"], provides: ["run"] }),
  "docs/architecture/MOD-inner.md": moduleFile("MOD-inner", { folder: "src/alpha/inner/", realises: ["RULE ALPHA"], follows: ["ARC-002"] }),
  "docs/architecture/MOD-orphan.md": moduleFile("MOD-orphan", { folder: "src/orphan/", uses: ["MOD-ghost.run"] }),
  "docs/architecture/MOD-stray.md": moduleFile("MOD-stray", { folder: "src/stray/", follows: ["ARC-002"] }),
  "src/alpha/a.mjs": 'import { run } from "../beta/b.mjs";\nexport const go = run;\n',
  "src/alpha/legacy.rb": "require 'x'\n",
  "src/alpha/inner/i.mjs": "export const i = 1;\n",
  "src/beta/b.mjs": 'import { go } from "../alpha/a.mjs";\nexport const run = go;\n',
  "src/stray/s.mjs": "export const s = 1;\n",
  "loose/outside.mjs": "export const o = 1;\n",
  "loose/second.mjs": "export const t = 1;\n",
  "tests/alpha.test.mjs": declared("TST-100001", "MOD-alpha", "RULE ALPHA"),
  "tests/beta.test.mjs": declared("TST-100002", "MOD-beta", "RULE BETA", "ARC-001"),
  "tests/stray.test.mjs": declared("TST-100003", "MOD-stray", "RULE BETA", "A RULE NOBODY WROTE"),
};

const MODULE_FILE = (id) => `docs/architecture/${id}.md`;
const graphOf = (files) => traceGraph(source(files));
const gapPairs = (result) => result.gaps.map((gap) => [gap.kind, gap.artifact]);

// TST-692001 · level: unit · module: MOD-trace-graph
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture of five module files — MOD-alpha (src/alpha/, code a.mjs and legacy.rb, one test), MOD-beta (src/beta/, code b.mjs, one test), MOD-inner (src/alpha/inner/, code i.mjs, no test, realises RULE ALPHA in its file only), MOD-orphan (src/orphan/, nothing, follows no decision, uses MOD-ghost.run) and MOD-stray (src/stray/, code s.mjs, one test that guards RULE BETA, its file realising nothing) — where MOD-alpha and MOD-beta state RULE ALPHA and RULE BETA under realises, ARC-002 designs MOD-alpha, MOD-beta and MOD-inner and MOD-alpha uses MOD-beta.run
// input: moduleRows over the graph traceGraph builds from it
// expect: five rows, in the order of the module identifiers, each exactly as written below — among them MOD-alpha with code a.mjs and legacy.rb (not i.mjs, which belongs to the module whose folder is longer), realising RULE ALPHA as its test TST-100001 guards it; MOD-inner realising nothing although its file names RULE ALPHA, since no test exercises it; MOD-stray realising RULE BETA, which its test guards although its file names nothing; importing MOD-beta and importsRead false because of the .rb file; MOD-orphan with subsystem null, no code and no tests, and importsRead true
test("TST-692001 one row per module: its subsystem, what its file realises, its file, code, tests and imports", async () => {
  const graph = await graphOf(FIXTURE);
  assert.ok(graph.nodes.has("MOD-alpha") && graph.nodes.has("src/alpha/inner/i.mjs"), "positive control: the module files and the code files are read");
  const row = (module, rest) => ({ module, describedBy: MODULE_FILE(module), ...rest });
  assert.deepEqual(moduleRows(graph).rows, [
    row("MOD-alpha", { subsystem: "ARC-002", realises: ["RULE ALPHA"], code: ["src/alpha/a.mjs", "src/alpha/legacy.rb"], tests: ["TST-100001"],
      imports: ["MOD-beta"], importsRead: false }),
    row("MOD-beta", { subsystem: "ARC-002", realises: ["RULE BETA"], code: ["src/beta/b.mjs"], tests: ["TST-100002"],
      imports: ["MOD-alpha"], importsRead: true }),
    row("MOD-inner", { subsystem: "ARC-002", realises: [], code: ["src/alpha/inner/i.mjs"], tests: [], imports: [], importsRead: true }),
    row("MOD-orphan", { subsystem: null, realises: [], code: [], tests: [], imports: [], importsRead: true }),
    row("MOD-stray", { subsystem: "ARC-002", realises: ["RULE BETA"], code: ["src/stray/s.mjs"], tests: ["TST-100003"],
      imports: [], importsRead: true }),
  ]);
});

// TST-692002 · level: unit · module: MOD-trace-graph
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN; EVERY CODE FILE BELONGS TO A MODULE; A MODULE IS A FOLDER; A MODULE BELONGS TO ONE SUBSYSTEM
// given: the fixture of TST-692001
// input: moduleRows over its graph
// expect: exactly these gaps, as [kind, artifact], in the order of kind and then artifact — code-without-module loose/outside.mjs and loose/second.mjs; folder-named-by-no-module loose (one, for the two files); import-not-in-uses src/beta/b.mjs; module-folder-inside-another MOD-inner; module-in-no-subsystem MOD-orphan; module-without-code MOD-orphan; module-without-test MOD-inner and MOD-orphan; realises-nothing MOD-inner and MOD-orphan (not MOD-stray, whose test guards RULE BETA); requirement-without-module RULE LOOSE; subsystem-does-not-name-module MOD-stray; unknown-name MOD-orphan (MOD-ghost) and TST-100003 (no gap for TST-100002, which guards a decision); no gap for MOD-alpha, which has everything
test("TST-692002 every gap of the module file is listed with the artifact it concerns", async () => {
  const graph = await graphOf(FIXTURE);
  const result = moduleRows(graph);
  assert.ok(result.rows.length === 5, "positive control: the rows are there");
  assert.deepEqual(gapPairs(result), [
    ["code-without-module", "loose/outside.mjs"],
    ["code-without-module", "loose/second.mjs"],
    ["folder-named-by-no-module", "loose"],
    ["import-not-in-uses", "src/beta/b.mjs"],
    ["module-folder-inside-another", "MOD-inner"],
    ["module-in-no-subsystem", "MOD-orphan"],
    ["module-without-code", "MOD-orphan"],
    ["module-without-test", "MOD-inner"],
    ["module-without-test", "MOD-orphan"],
    ["realises-nothing", "MOD-inner"],
    ["realises-nothing", "MOD-orphan"],
    ["requirement-without-module", "RULE LOOSE"],
    ["subsystem-does-not-name-module", "MOD-stray"],
    ["unknown-name", "MOD-orphan"],
    ["unknown-name", "TST-100003"],
  ]);
});

// TST-692003 · level: unit · module: MOD-trace-graph
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture of TST-692001
// input: moduleRows over its graph
// expect: each gap has the keys kind, artifact, path and what, and no other, with a what that is a text; its path is the file of its artifact — the module file for a module (docs/architecture/MOD-orphan.md), SPEC.md for RULE LOOSE, the code file itself for loose/outside.mjs and src/beta/b.mjs, the test file for TST-100003 (tests/stray.test.mjs); the what of the unknown name says A RULE NOBODY WROTE, the what of the import says MOD-alpha and MOD-beta, the what of the folder says MOD-alpha, the module whose folder holds it
test("TST-692003 a gap names the file of its artifact and says what is missing", async () => {
  const result = moduleRows(await graphOf(FIXTURE));
  const by = (kind, artifact) => result.gaps.find((gap) => gap.kind === kind && gap.artifact === artifact);
  assert.ok(by("module-without-code", "MOD-orphan"), "positive control: the gap is listed");
  for (const gap of result.gaps) {
    assert.deepEqual(Object.keys(gap).sort(), ["artifact", "kind", "path", "what"]);
    assert.ok(typeof gap.what === "string" && gap.what !== "", `${gap.kind} ${gap.artifact}: says what`);
  }
  assert.equal(by("module-without-code", "MOD-orphan").path, MODULE_FILE("MOD-orphan"));
  assert.equal(by("requirement-without-module", "RULE LOOSE").path, "SPEC.md");
  assert.equal(by("code-without-module", "loose/outside.mjs").path, "loose/outside.mjs");
  assert.equal(by("import-not-in-uses", "src/beta/b.mjs").path, "src/beta/b.mjs");
  assert.equal(by("unknown-name", "TST-100003").path, "tests/stray.test.mjs");
  assert.ok(by("unknown-name", "TST-100003").what.includes("A RULE NOBODY WROTE"));
  assert.equal(by("unknown-name", "MOD-orphan").path, MODULE_FILE("MOD-orphan"));
  assert.ok(by("unknown-name", "MOD-orphan").what.includes("MOD-ghost"));
  assert.equal(by("folder-named-by-no-module", "loose").path, "loose");
  assert.ok(by("import-not-in-uses", "src/beta/b.mjs").what.includes("MOD-alpha") && by("import-not-in-uses", "src/beta/b.mjs").what.includes("MOD-beta"));
  assert.ok(by("module-folder-inside-another", "MOD-inner").what.includes("MOD-alpha"));
});

// TST-692004 · level: unit · module: MOD-trace-graph
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture, once as it is and once with MOD-beta's file naming MOD-alpha.go among the interfaces it uses
// input: moduleRows over each graph
// expect: the import gap of src/beta/b.mjs is listed for the first and not for the second; MOD-beta's imports are [MOD-alpha] in both
test("TST-692004 an import the importing module's file names among its uses is no gap; the import is still listed", async () => {
  const before = moduleRows(await graphOf(FIXTURE));
  const named = { ...FIXTURE, [MODULE_FILE("MOD-beta")]: moduleFile("MOD-beta", { folder: "src/beta/", follows: ["ARC-002"], uses: ["MOD-alpha.go"], provides: ["run"] }) };
  const after = moduleRows(await graphOf(named));
  assert.ok(gapPairs(before).some(([kind]) => kind === "import-not-in-uses"), "positive control: the gap is listed before");
  assert.equal(gapPairs(after).some(([kind]) => kind === "import-not-in-uses"), false);
  assert.deepEqual(before.rows.find((r) => r.module === "MOD-beta").imports, ["MOD-alpha"]);
  assert.deepEqual(after.rows.find((r) => r.module === "MOD-beta").imports, ["MOD-alpha"]);
});

// TST-692005 · level: unit · module: MOD-trace-graph
// guards: UC-025
// given: the fixture, once as it is and once without src/alpha/legacy.rb
// input: moduleRows over each graph
// expect: MOD-alpha's importsRead is false with the .rb file and true without it; no other row's importsRead changes
test("TST-692005 importsRead is false for a module with a code file whose imports are not read, and true without it", async () => {
  const withRuby = moduleRows(await graphOf(FIXTURE));
  const { "src/alpha/legacy.rb": _legacy, ...rest } = FIXTURE;
  const without = moduleRows(await graphOf(rest));
  const read = (result) => Object.fromEntries(result.rows.map((r) => [r.module, r.importsRead]));
  assert.equal(read(withRuby)["MOD-alpha"], false);
  assert.equal(read(without)["MOD-alpha"], true);
  assert.deepEqual({ ...read(withRuby), "MOD-alpha": true }, read(without));
});

// TST-692006 · level: unit · module: MOD-trace-graph
// guards: UC-025; EVERY CODE FILE BELONGS TO A MODULE
// given: a product of one requirement, one decision that designs one module, whose folder src/one/ holds one code file, and one test of the module that guards the requirement
// input: moduleRows over its graph, then over the same product with the code file moved to loose/one.mjs
// expect: for the first, one row and no gap at all; for the second, the gap code-without-module for loose/one.mjs and the gap module-without-code for MOD-one, and no other
test("TST-692006 a product whose files all belong to its modules lists no gap; a file moved out of the module's folder is listed", async () => {
  const product = {
    "SPEC.md": lines("# Fixture", "", "**RULE ONE** *(Product Owner)*", "The rule.", "*Check:* none", ""),
    "docs/architecture/ARC-001-the-whole.md": lines("---", "id: ARC-001", "title: The whole", "forced_by:", "  - RULE ONE", "designs:", "  - MOD-one", "---", "# ARC-001"),
    "docs/architecture/MOD-one.md": moduleFile("MOD-one", { folder: "src/one/", realises: ["RULE ONE"], follows: ["ARC-001"] }),
    "src/one/one.mjs": "export const one = 1;\n",
    "tests/one.test.mjs": declared("TST-100010", "MOD-one", "RULE ONE"),
  };
  const clean = moduleRows(await graphOf(product));
  assert.equal(clean.rows.length, 1, "positive control: the module has its row");
  assert.deepEqual(clean.gaps, []);
  const { "src/one/one.mjs": code, ...rest } = product;
  const outside = moduleRows(await graphOf({ ...rest, "loose/one.mjs": code }));
  assert.deepEqual(gapPairs(outside), [["code-without-module", "loose/one.mjs"], ["folder-named-by-no-module", "loose"], ["module-without-code", "MOD-one"]]);
});

// TST-692007 · level: unit · module: MOD-trace-graph
// guards: UC-025; THE TRACEABILITY MATRIX IS DERIVED
// given: the fixture, listed in its own order and in the reverse order
// input: moduleRows over the graph of each, and over the first again
// expect: the three results are equal; moduleRows reads nothing: the source is read no further after the graph is built
test("TST-692007 the rows and gaps do not depend on the order the repository lists its files, and moduleRows reads nothing", async () => {
  const forward = source(FIXTURE);
  const graph = await traceGraph(forward);
  const readsBefore = forward.reads.length;
  const first = moduleRows(graph);
  assert.equal(forward.reads.length, readsBefore);
  assert.ok(readsBefore > 0, "positive control: the graph was built by reading");
  assert.ok(first.rows.length === 5 && first.gaps.length > 0, "positive control: there are rows and gaps to compare");
  const reversed = Object.fromEntries(Object.entries(FIXTURE).reverse());
  assert.deepEqual(moduleRows(await graphOf(reversed)), first);
  assert.deepEqual(moduleRows(graph), first);
});

// TST-692008 · level: unit · module: MOD-trace-graph
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture of TST-692001, where MOD-inner states realises RULE ALPHA and has no test, and MOD-stray has a test that guards RULE BETA and states no realises (known positive: MOD-alpha, whose test guards what its file states, realises RULE ALPHA)
// input: moduleRows over its graph
// expect: MOD-inner's row realises nothing and it has the realises-nothing gap; MOD-stray's row realises RULE BETA and it has no such gap; only RULE LOOSE is a requirement-without-module
test("TST-692008 a row's realises is the requirements its tests guard, whatever its file states", async () => {
  const result = moduleRows(await graphOf(FIXTURE));
  const row = (module) => result.rows.find((r) => r.module === module);
  assert.deepEqual(row("MOD-inner").tests, [], "positive control: MOD-inner has no test");
  assert.deepEqual(row("MOD-alpha").realises, ["RULE ALPHA"], "known positive");
  assert.deepEqual(row("MOD-inner").realises, []);
  assert.deepEqual(row("MOD-stray").tests, ["TST-100003"], "positive control: MOD-stray has its test");
  assert.deepEqual(row("MOD-stray").realises, ["RULE BETA"]);
  const pairs = gapPairs(result);
  assert.equal(pairs.some(([kind, artifact]) => kind === "realises-nothing" && artifact === "MOD-inner"), true);
  assert.equal(pairs.some(([kind, artifact]) => kind === "realises-nothing" && artifact === "MOD-stray"), false);
  assert.deepEqual(pairs.filter(([kind]) => kind === "requirement-without-module"), [["requirement-without-module", "RULE LOOSE"]]);
});

// TST-692009 · level: unit · module: MOD-trace-graph
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture of TST-692001, where TST-100002 guards the decision ARC-001, MOD-alpha uses MOD-beta.run, MOD-orphan uses MOD-ghost.run, which no file describes, and TST-100003 guards A RULE NOBODY WROTE
// input: moduleRows over its graph
// expect: exactly two unknown-name gaps, for MOD-orphan and TST-100003; none for a name that is a decision (ARC-001) or a module (MOD-beta)
test("TST-692009 a name that matches no requirement, use case, decision or module is a gap; a decision or a module is a match", async () => {
  const unknown = moduleRows(await graphOf(FIXTURE)).gaps.filter((gap) => gap.kind === "unknown-name");
  assert.deepEqual(unknown.map((gap) => gap.artifact), ["MOD-orphan", "TST-100003"]);
});

// TST-692010 · level: unit · module: MOD-trace-graph
// guards: UC-025; EVERY CODE FILE BELONGS TO A MODULE
// given: the fixture of TST-692001 with a third code file at other/deep/x.mjs, in no module's folder, and a copy where loose/outside.mjs, loose/second.mjs and other/deep/x.mjs stand in the folder of MOD-beta
// input: moduleRows over each graph
// expect: for the first, the folder gaps are loose and other/deep, one each, beside three code-without-module gaps; for the copy, no folder gap and no code-without-module gap
test("TST-692010 a folder no module names is one gap, besides the gap of each code file in it", async () => {
  const outside = { ...FIXTURE, "other/deep/x.mjs": "export const x = 1;\n" };
  const first = gapPairs(moduleRows(await graphOf(outside)));
  assert.deepEqual(first.filter(([kind]) => kind === "folder-named-by-no-module"),
    [["folder-named-by-no-module", "loose"], ["folder-named-by-no-module", "other/deep"]]);
  assert.equal(first.filter(([kind]) => kind === "code-without-module").length, 3);
  const { "loose/outside.mjs": a, "loose/second.mjs": b, "other/deep/x.mjs": c, ...rest } = outside;
  const inside = gapPairs(moduleRows(await graphOf({ ...rest, "src/beta/a.mjs": a, "src/beta/b2.mjs": b, "src/beta/c.mjs": c })));
  assert.deepEqual(inside.filter(([kind]) => kind === "folder-named-by-no-module" || kind === "code-without-module"), []);
});

// TST-1351001 · level: unit · module: MOD-trace-graph
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: a product of two requirements RULE ONE and RULE TWO, a decision that designs MOD-a and MOD-b, whose files both name RULE ONE under realises; MOD-a has a test that guards RULE TWO and a decision, the decision ARC-001 (known positive: a test of MOD-b guards RULE ONE, so MOD-b realises RULE ONE); a second test, of MOD-b, guards RULE TWO
// input: moduleRows over its graph, and again with MOD-a's test removed
// expect: MOD-a realises RULE TWO alone (not RULE ONE, which its file names; not ARC-001, a decision); MOD-b realises RULE ONE and RULE TWO; no realises-nothing gap and no requirement-without-module gap; without MOD-a's test, MOD-a realises nothing, has the gap realises-nothing and the gap module-without-test, and MOD-b is unchanged
test("TST-1351001 a module realises the requirements its tests guard, and the gaps follow from that", async () => {
  const product = {
    "SPEC.md": lines("# Fixture", "", ...["RULE ONE", "RULE TWO"].flatMap((name) => [`**${name}** *(Product Owner)*`, `The rule ${name}.`, "*Check:* none", ""])),
    "docs/architecture/ARC-001-the-whole.md": lines("---", "id: ARC-001", "title: The whole", "forced_by:", "  - RULE ONE", "designs:", "  - MOD-a", "  - MOD-b", "---", "# ARC-001"),
    "docs/architecture/MOD-a.md": moduleFile("MOD-a", { folder: "src/a/", realises: ["RULE ONE"], follows: ["ARC-001"] }),
    "docs/architecture/MOD-b.md": moduleFile("MOD-b", { folder: "src/b/", realises: ["RULE ONE"], follows: ["ARC-001"] }),
    "src/a/a.mjs": "export const a = 1;\n",
    "src/b/b.mjs": "export const b = 1;\n",
    "tests/a.test.mjs": declared("TST-100020", "MOD-a", "RULE TWO", "ARC-001"),
    "tests/b.test.mjs": declared("TST-100021", "MOD-b", "RULE ONE", "RULE TWO"),
  };
  const result = moduleRows(await graphOf(product));
  const realises = (module) => result.rows.find((r) => r.module === module).realises;
  assert.deepEqual(realises("MOD-b"), ["RULE ONE", "RULE TWO"], "known positive");
  assert.deepEqual(realises("MOD-a"), ["RULE TWO"]);
  assert.deepEqual(result.gaps, []);
  const { "tests/a.test.mjs": _removed, ...without } = product;
  const bare = moduleRows(await graphOf(without));
  assert.deepEqual(bare.rows.find((r) => r.module === "MOD-a").realises, []);
  assert.deepEqual(gapPairs(bare), [["module-without-test", "MOD-a"], ["realises-nothing", "MOD-a"]]);
  assert.deepEqual(bare.rows.find((r) => r.module === "MOD-b").realises, ["RULE ONE", "RULE TWO"]);
});

// The tests and test helpers whose header names no module of the architecture, as the dashboard has listed them: no `Module:` line
// among the first lines, or one that names a module the architecture does not describe — the header read by MOD-test-document's
// testHeader, for every file it reads a header of; the modules of the architecture are the module nodes of the graph traceGraph
// builds from the same files.
async function testsNamingNoModule(files) {
  const graph = await graphOf(files);
  const modules = new Set([...graph.nodes.values()].filter((node) => node.kind === "MOD").map((node) => node.id));
  return Object.keys(files).filter((path) => testHeader(path, files[path]) !== null).flatMap((path) => {
    const named = testHeader(path, files[path]).modules;
    return named.length === 0 ? [["code-without-module", path]]
      : named.filter((module) => !modules.has(module)).map(() => ["code-names-unknown-module", path]);
  }).sort((a, b) => a[1].localeCompare(b[1]));
}

// TST-1017001 · level: unit · module: MOD-trace-graph
// guards: EVERY CODE FILE BELONGS TO A MODULE
// given: the files of this repository, read as the dashboard reads them, without the fixture products under tests/fixtures/ (products, not tests of Agent M)
// input: the tests and test helpers whose header names no module of the architecture, as the dashboard lists them; and, as a known positive, the same call over the same files with one test, tests/ghost.test.mjs, added whose header names MOD-ghost
// expect: the first call lists none; the known positive lists exactly [code-names-unknown-module, tests/ghost.test.mjs]
test("TST-1017001: every test of this repository names a module of the architecture in its header", async () => {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean)
    .filter((path) => !path.startsWith("tests/fixtures/"));
  const files = {};
  for (const path of tracked) { try { files[path] = readFileSync(path, "utf8"); } catch { /* a binary file */ } }
  assert.deepEqual((await testsNamingNoModule({ ...files, "tests/ghost.test.mjs": "// Module: MOD-ghost\n" })).filter(([, path]) => path === "tests/ghost.test.mjs"),
    [["code-names-unknown-module", "tests/ghost.test.mjs"]], "known positive: a test naming a module the architecture does not describe is listed");
  assert.deepEqual(await testsNamingNoModule(files), []);
});
