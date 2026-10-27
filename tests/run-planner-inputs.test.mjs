// The recipe `implementation-inputs` of MOD-run-planner's `runStrategies` (ITM-568), as the accepted text of docs/architecture/MOD-run-planner.md states it: "recipe
// `implementation-inputs` — for a step or item: the file of each of its modules; the decision of their subsystem and the decision that states the system; the SPEC; the
// interfaces — the `## Interfaces` of their files, not the code — of the modules they use; the code in their folders and the tests that name them; [...] for a subsystem's
// integration, the subsystem's decision and the files, code and tests of its modules; for the system, the decision that states it, the subsystems' decisions and the use cases.
// Each part names the sources whose content it carries, so that restricted content goes only where its source permits." (The product's coding standards file is cut from the
// item until a draft naming it is accepted, so no test here has one.) With UC-024 step 4 and MOD-job-runner's `JobContext` and `Part`.
// Run: node --test tests/run-planner-inputs.test.mjs
//
// Module: MOD-run-planner
// Guards: UC-024; DEVELOP AGAINST INTERFACES; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// Level: unit
//
// The product is a fixture of this file: a SPEC.md, two decisions (ARC-001 states the system, ARC-002 refines it and designs two modules), two modules, two use cases, code
// under the modules' folders, three test files, two backlog items and two plan steps. The readings where the file leaves one open, which the pull request names:
//   - The work is named by the job's `params.items` and `params.steps`; its modules are those of its `modules`, read from the trace graph's `changes` edges; a step's level
//     (`module`, `subsystem` or `system`) says which of the three assemblies it takes.
//   - The decisions of a module are those it `follows`, then the one decision that refines no other; the tests of a module are those with an `exercises` edge to it in the graph.
//   - A part is one file, named by its path; a part of a module's `## Interfaces` is named `<path> ## Interfaces`; a part given twice is given once, at its first place.
//   - A part carries a source where its path is the path a `places.contents` entry names, or lies under it.
// Each test states its input and its expected result before it runs (given / input / expect); every call is made with a `fetch` that fails the test if it is called. The
// counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { prepareJob, registerStrategies } from "../src/job-runner/index.mjs";
import * as runPlanner from "../src/run-planner/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;

// ---------------------------------------------------------------- the fixture product

const decision = (id, extra) => lines("---", `id: ${id}`, `title: ${id} decision`, ...extra, "---", `# ${id} decision`, "", "## Context", "", "c", "", "## Decision", "", "d", "",
  "## Alternatives", "", "a", "", "## Consequences", "", "q");
const module_ = (id, { folder, uses, interfaces, provides }) => lines("---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises:", "follows:", "  - ARC-002",
  uses.length ? "uses:" : "uses: []", ...uses.map((use) => `  - ${use}`), "provides:", `  - ${provides}`, "---", `# ${id} ${id}`, "", "## Responsibility", "", `RESPONSIBILITY-OF-${id}`, "",
  "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", interfaces, "", "## Files", "", `FILES-OF-${id}`, "", "## Uses", "", "u");
const useCase = (id) => lines("---", `id: ${id}`, `title: ${id} case`, "area: x", "actors:", "  - A", "realises:", "  - A GUARDED RULE", "---", `# ${id} case`, "");
const item = (id, level, modules, { integrates, tests = ["unit"] } = {}) => lines("---", `id: ${id}`, `title: ${id} item`, `level: ${level}`, "realises:", "  - UC-001", "modules:",
  ...modules.map((mod) => `  - ${mod}`), ...(integrates ? [`integrates: ${integrates}`] : []), "tests:", ...tests.map((level_) => `  - ${level_}`), "origin:", "  - UC-001", "---",
  `# ${id} item`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a");
const testFile = (id, mod) => lines(`// ${id}`, "// level: unit", `// module: ${mod}`, "// guards: UC-001", "", "// the case follows");

const FILES = {
  "SPEC.md": lines("# Fixture — Specification", "", "## 1. Rules", "", "**A GUARDED RULE** *(Owner)*", "A rule.", "*Check:* `tests/reader.test.mjs`"),
  "docs/architecture/ARC-001-whole.md": decision("ARC-001", ["forced_by:", "  - UC-001"]),
  "docs/architecture/ARC-002-sub.md": decision("ARC-002", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-reader", "  - MOD-writer"]),
  "docs/architecture/MOD-reader.md": module_("MOD-reader", { folder: "src/reader/", uses: ["MOD-writer.write"], interfaces: "- `read` — INTERFACE-OF-MOD-reader", provides: "read" }),
  "docs/architecture/MOD-writer.md": module_("MOD-writer", { folder: "src/writer/", uses: [], interfaces: "- `write` — INTERFACE-OF-MOD-writer", provides: "write" }),
  "docs/use-cases/UC-001-load.md": useCase("UC-001"),
  "docs/use-cases/UC-002-store.md": useCase("UC-002"),
  "docs/backlog/ITM-001-two-modules.md": item("ITM-001", "module", ["MOD-reader", "MOD-writer"]),
  "docs/backlog/ITM-003-one-module.md": item("ITM-003", "module", ["MOD-writer"]),
  "docs/plan/ITM-010-sub.md": item("ITM-010", "subsystem", ["MOD-reader", "MOD-writer"], { integrates: "ARC-002", tests: ["component"] }),
  "docs/plan/ITM-011-system.md": item("ITM-011", "system", ["MOD-reader", "MOD-writer"], { tests: ["system", "release"] }),
  "src/reader/index.mjs": "export const read = 1;\n",
  "src/writer/helper.mjs": "export const help = 1;\n",
  "src/writer/index.mjs": "export const write = 1;\n",
  "tests/reader.test.mjs": testFile("TST-001", "MOD-reader"),
  "tests/writer.test.mjs": testFile("TST-002", "MOD-writer"),
  "tests/other.test.mjs": testFile("TST-003", "system"),
};

const snapshotOf = (files) => ({ paths: Object.keys(files), read: async (path) => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null) });
const contextOf = (params, contents = []) => ({
  kind: null, params, product: { address: "https://github.com/acme/product", snapshot: snapshotOf(FILES), host: null }, instance: { snapshot: snapshotOf({}), host: null, checkout: null },
  connect: async () => null, participants: [], places: { sources: {}, mailbox: null, contents }, gates: [], person: "alice", now: new Date("2026-10-16T08:00:00Z"),
  agentM: { version: "unreleased", commit: "a".repeat(40) }, jobId: null,
});

// Runs `body` with a fetch that records its calls; the test asserts there were none.
async function offline(body) {
  const real = globalThis.fetch, calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); throw new Error("the recipe must make no request"); };
  try {
    return await body();
  } finally {
    globalThis.fetch = real;
    assert.deepEqual(calls, [], "no request was made");
  }
}
const recipe = (params, contents) => offline(() => runPlanner.runStrategies.recipes["implementation-inputs"](contextOf(params, contents), params));
const namesOf = (parts) => parts.map((part) => part.name);

const READER_INTERFACES = "docs/architecture/MOD-writer.md ## Interfaces";
const ITM_001 = [
  "docs/architecture/MOD-reader.md", "docs/architecture/ARC-002-sub.md", "docs/architecture/ARC-001-whole.md", "SPEC.md", READER_INTERFACES,
  "src/reader/index.mjs", "tests/reader.test.mjs",
  "docs/architecture/MOD-writer.md", "src/writer/helper.mjs", "src/writer/index.mjs", "tests/writer.test.mjs",
];

// TST-568001 · level: unit · module: MOD-run-planner
// guards: UC-024; DEVELOP AGAINST INTERFACES
// given: the fixture product and a backlog item ITM-001 naming MOD-reader, which uses MOD-writer.write, and MOD-writer
// input: the recipe with params.items = ["ITM-001"]
// expect: for MOD-reader its file, the decision it follows (ARC-002), the decision that refines no other (ARC-001), SPEC.md, the interfaces of MOD-writer, its code and the test that names it
// (tests/reader.test.mjs, not tests/writer.test.mjs or tests/other.test.mjs); then for MOD-writer its file, its two code files and its test; the decisions and the SPEC given once
test("an item with two modules gives, per module, its file, its decisions, the SPEC, the used interfaces, its code and the tests that name it — MOD-run-planner", async () => {
  const parts = await recipe({ items: ["ITM-001"] });
  assert.deepEqual(namesOf(parts), ITM_001);
  assert.ok(parts.every((part) => part.required === true && typeof part.text === "string" && Array.isArray(part.sources)));
  assert.equal(parts[0].text, FILES["docs/architecture/MOD-reader.md"], "a file is given whole");
  assert.equal(parts[3].text, FILES["SPEC.md"]);
  assert.equal(parts[6].text, FILES["tests/reader.test.mjs"]);
});

// TST-568002 · level: unit · module: MOD-run-planner
// guards: UC-024; DEVELOP AGAINST INTERFACES
// given: the fixture product, where MOD-writer's file has a Responsibility, an Interfaces and a Files section
// input: the recipe with params.items = ["ITM-001"]
// expect: the part of MOD-writer's interfaces holds exactly the `## Interfaces` section — its heading and its bullet — and nothing of the Responsibility or the Files; the code of MOD-writer is
// not part of it
test("the interfaces of a used module are its ## Interfaces section alone — MOD-run-planner", async () => {
  const parts = await recipe({ items: ["ITM-001"] });
  const interfaces = parts.find((part) => part.name === READER_INTERFACES);
  assert.equal(interfaces.text, "## Interfaces\n\n- `write` — INTERFACE-OF-MOD-writer\n");
  assert.equal(parts.filter((part) => part.name === "docs/architecture/MOD-writer.md").length, 1, "known positive: MOD-writer's whole file is a part of its own, given once");
});

// TST-568003 · level: unit · module: MOD-run-planner
// guards: UC-024
// given: the fixture product and a backlog item ITM-003 naming MOD-writer, which uses no module
// input: the recipe with params.items = ["ITM-003"]
// expect: MOD-writer's file, ARC-002, ARC-001, SPEC.md, its code and its test, and no interfaces part
test("a module that uses none gives no interfaces part — MOD-run-planner", async () => {
  const parts = await recipe({ items: ["ITM-003"] });
  assert.deepEqual(namesOf(parts), ["docs/architecture/MOD-writer.md", "docs/architecture/ARC-002-sub.md", "docs/architecture/ARC-001-whole.md", "SPEC.md", "src/writer/helper.mjs",
    "src/writer/index.mjs", "tests/writer.test.mjs"]);
});

// TST-568004 · level: unit · module: MOD-run-planner
// guards: UC-024
// given: the fixture product and a plan step ITM-010 of level subsystem integrating ARC-002, which designs MOD-reader and MOD-writer
// input: the recipe with params.steps = ["ITM-010"]
// expect: the subsystem's decision ARC-002, then for each of its modules in the order the decision designs them its file, its code and its tests — no SPEC, no system decision, no interfaces
test("a subsystem's integration gives the subsystem's decision and the files, code and tests of its modules — MOD-run-planner", async () => {
  const parts = await recipe({ steps: ["ITM-010"] });
  assert.deepEqual(namesOf(parts), ["docs/architecture/ARC-002-sub.md", "docs/architecture/MOD-reader.md", "src/reader/index.mjs", "tests/reader.test.mjs",
    "docs/architecture/MOD-writer.md", "src/writer/helper.mjs", "src/writer/index.mjs", "tests/writer.test.mjs"]);
});

// TST-568005 · level: unit · module: MOD-run-planner
// guards: UC-024
// given: the fixture product and a plan step ITM-011 of level system
// input: the recipe with params.steps = ["ITM-011"]
// expect: the decision that states the system (ARC-001), the subsystems' decisions (ARC-002) and the use cases (UC-001, UC-002) — no module file, no code, no test, no SPEC
test("the system step gives the decision that states it, the subsystems' decisions and the use cases — MOD-run-planner", async () => {
  const parts = await recipe({ steps: ["ITM-011"] });
  assert.deepEqual(namesOf(parts), ["docs/architecture/ARC-001-whole.md", "docs/architecture/ARC-002-sub.md", "docs/use-cases/UC-001-load.md", "docs/use-cases/UC-002-store.md"]);
});

// TST-568006 · level: unit · module: MOD-run-planner
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the fixture product, and places.contents naming SRC-secret for `src/writer` and for MOD-writer's file, and SRC-other for the one file tests/reader.test.mjs
// input: the recipe with params.items = ["ITM-001"]
// expect: the parts under src/writer, MOD-writer's file and its interfaces part carry ["SRC-secret"]; tests/reader.test.mjs carries ["SRC-other"]; every other part carries none; with
// places.contents empty no part carries any source
test("a part carries a source only where places.contents puts its path under that source — MOD-run-planner", async () => {
  const contents = [{ source: "SRC-secret", paths: ["src/writer", "docs/architecture/MOD-writer.md"] }, { source: "SRC-other", paths: ["tests/reader.test.mjs"] }];
  const parts = await recipe({ items: ["ITM-001"] }, contents);
  const sources = Object.fromEntries(parts.map((part) => [part.name, part.sources]));
  assert.deepEqual(sources, {
    "docs/architecture/MOD-reader.md": [], "docs/architecture/ARC-002-sub.md": [], "docs/architecture/ARC-001-whole.md": [], "SPEC.md": [],
    [READER_INTERFACES]: ["SRC-secret"], "src/reader/index.mjs": [], "tests/reader.test.mjs": ["SRC-other"],
    "docs/architecture/MOD-writer.md": ["SRC-secret"], "src/writer/helper.mjs": ["SRC-secret"], "src/writer/index.mjs": ["SRC-secret"], "tests/writer.test.mjs": [],
  });
  const none = await recipe({ items: ["ITM-001"] }, []);
  assert.deepEqual(none.map((part) => part.sources), none.map(() => []));
});

// TST-568007 · level: unit · module: MOD-run-planner
// guards: UC-024
// given: the fixture product
// input: the recipe with params naming an item no file holds (ITM-999), and with params naming no item and no step
// expect: UnknownWork { id: "ITM-999" } for the first, and NoWorkNamed for the second; a known item in the same call is first shown to give parts
test("work that no file holds, or no work, is refused by name — MOD-run-planner", async () => {
  assert.ok((await recipe({ items: ["ITM-003"] })).length > 0, "known positive");
  await assert.rejects(recipe({ items: ["ITM-003", "ITM-999"] }), (error) => error.name === "UnknownWork" && error.id === "ITM-999");
  await assert.rejects(recipe({}), (error) => error.name === "NoWorkNamed");
});

// TST-568008 · level: unit · module: MOD-run-planner
// guards: UC-024
// given: the fixture product, the recipe registered under the owner MOD-run-planner with stand-ins for the other strategies the kind `implement` names (`rests-on-accepted`, `chapters-for-implementation`, `resource-pins` and the writer `branch-and-pull-request`; `instruction` is the runner's own)
// input: prepareJob("implement", context with params.items = ["ITM-001"], no drafter)
// expect: it does not throw UnknownStrategy, and its parts of the recipe `implementation-inputs` are the 11 parts of the item, in the order of the first test
test("the kind implement prepares with the recipe registered — MOD-run-planner", async () => {
  registerStrategies("MOD-run-planner", runPlanner.runStrategies);
  registerStrategies("tests/run-planner-inputs.test.mjs", {
    recipes: { "chapters-for-implementation": async () => [], "resource-pins": async () => [] },
    preconditions: { "rests-on-accepted": async () => null },
    writers: { "branch-and-pull-request": async () => ({ commits: [], files: [], pullRequest: null, shown: null, notes: [] }) },
  });
  const prepared = await offline(() => prepareJob("implement", contextOf({ items: ["ITM-001"] }), { drafter: null, reviewers: [] }));
  assert.deepEqual(namesOf(prepared.parts.filter((part) => part.recipe === "implementation-inputs")), ITM_001);
});

// TST-1248101 · level: unit · module: MOD-run-planner
// guards: UC-012
// given: the fixture product and a job whose parameters name only the modules MOD-reader and MOD-writer (as a bug's fix does), no step and no item
// input: the recipe with params.modules = ["MOD-reader", "MOD-writer"]
// expect: the same parts as for the item ITM-001 naming those modules — per module its file, its decisions, the SPEC, the interfaces of the modules it uses, its code and its tests
test("a job naming only modules gets, per module, the inputs of a module step — MOD-run-planner", async () => {
  const parts = await recipe({ modules: ["MOD-reader", "MOD-writer"] });
  assert.deepEqual(namesOf(parts), ITM_001);
  assert.deepEqual(parts, await recipe({ items: ["ITM-001"] }), "known positive: the item naming the same modules gives the same parts");
});

// TST-1248102 · level: unit · module: MOD-run-planner
// guards: UC-012
// given: the fixture product and a job naming the one module MOD-writer, which uses no module
// input: the recipe with params.modules = ["MOD-writer"]
// expect: the parts of the item ITM-003 naming MOD-writer alone
test("a job naming one module gets that module's inputs alone — MOD-run-planner", async () => {
  const parts = await recipe({ modules: ["MOD-writer"] });
  assert.deepEqual(namesOf(parts), ["docs/architecture/MOD-writer.md", "docs/architecture/ARC-002-sub.md", "docs/architecture/ARC-001-whole.md", "SPEC.md", "src/writer/helper.mjs",
    "src/writer/index.mjs", "tests/writer.test.mjs"]);
});

// TST-1248103 · level: unit · module: MOD-run-planner
// guards: UC-012
// given: the fixture product
// input: the recipe with params.modules naming MOD-nothing, which no file holds, and with params.modules naming ARC-001, which is a decision and no module
// expect: UnknownWork { id } with the name given, for each; a known module in the same call is first shown to give parts
test("a module that no file holds is UnknownWork — MOD-run-planner", async () => {
  assert.ok((await recipe({ modules: ["MOD-writer"] })).length > 0, "known positive");
  await assert.rejects(recipe({ modules: ["MOD-writer", "MOD-nothing"] }), (error) => error.name === "UnknownWork" && error.id === "MOD-nothing");
  await assert.rejects(recipe({ modules: ["ARC-001"] }), (error) => error.name === "UnknownWork" && error.id === "ARC-001");
});

// TST-1248104 · level: unit · module: MOD-run-planner
// guards: UC-012
// given: the fixture product
// input: the recipe with params naming no step, no item and no module — {} and { modules: [] }
// expect: NoWorkNamed for each; { modules: ["MOD-writer"] } is first shown to name work
test("params naming no step, no item and no module are NoWorkNamed — MOD-run-planner", async () => {
  assert.ok((await recipe({ modules: ["MOD-writer"] })).length > 0, "known positive");
  await assert.rejects(recipe({}), (error) => error.name === "NoWorkNamed");
  await assert.rejects(recipe({ modules: [] }), (error) => error.name === "NoWorkNamed");
});

// TST-1248105 · level: unit · module: MOD-run-planner
// guards: UC-012
// given: the fixture product and a job naming the item ITM-003 (MOD-writer) and the module MOD-reader
// input: the recipe with params.items = ["ITM-003"], params.modules = ["MOD-reader"]
// expect: the parts of the item first, then those of MOD-reader not yet given; each part once
test("modules are given after the items and each part once — MOD-run-planner", async () => {
  const parts = await recipe({ items: ["ITM-003"], modules: ["MOD-reader"] });
  assert.deepEqual(namesOf(parts), ["docs/architecture/MOD-writer.md", "docs/architecture/ARC-002-sub.md", "docs/architecture/ARC-001-whole.md", "SPEC.md", "src/writer/helper.mjs",
    "src/writer/index.mjs", "tests/writer.test.mjs", "docs/architecture/MOD-reader.md", READER_INTERFACES, "src/reader/index.mjs", "tests/reader.test.mjs"]);
});
