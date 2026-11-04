// The recipe `implementation-inputs` of MOD-run-planner's `runStrategies` for a backlog item (ITM-1409): UC-034 step 3 says what is sent to the participant that implements an item — "the item; the requirements and use cases it
// realises, and their existing tests; the files of the modules it changes, the decisions of their subsystems and of the system, and the interfaces — not the code — of the modules they use; the process requirements that apply" —,
// and docs/architecture/MOD-run-planner.md lists what the recipe gives "for a step or item". The gate record docs/gates/20261101-2000-development-release-testing-0805-1045.md reads that list as what the input must hold, not all it may
// hold. The module inputs themselves (the module's file, its decisions, the SPEC, the used interfaces, its code and tests) are guarded by tests/run-planner-inputs.test.mjs.
// Run: node --test tests/run-planner-item-inputs.test.mjs
//
// Module: MOD-run-planner
// Guards: UC-034; TEST GENERATION SEES THE EXISTING TESTS; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// Level: unit
//
// The product is a fixture of this file: a SPEC.md of three requirements, three use cases, two decisions, one module with its code and its test, four more test files that guard a use case or a requirement, one plan step and two
// backlog items; the instance has a SPEC.md of its own. The readings the texts leave open, which the pull request names:
//   - The work an item names is `params.items`; a plan step (`params.steps`, UC-024 step 4) and a job that names only modules (UC-012) are given no item file, use case, guarding test or process requirement, since neither text lists them.
//   - The use cases an item realises are those its `realises` names and those that realise a requirement it names; the existing tests are those whose `guards` name something its `realises` lists; each is a part named by its path.
//   - The process requirements are the instance's SPEC.md, whose requirements constrain the development process; the part is named `SPEC.md process requirements`, carries no source (the instance's own file), and is left out where the
//     product's own SPEC.md part has the same text, since that part already gives it.
//   - Order, as UC-034 step 3 lists it: the item, the use cases, the tests, the module inputs, the process requirements; a part named twice is given once, at its first place.
// Every call is made with a `fetch` that fails the test if it is called.

import test from "node:test";
import assert from "node:assert/strict";
import * as runPlanner from "../src/run-planner/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;

// ---------------------------------------------------------------- the fixture product

const decision = (id, extra) => lines("---", `id: ${id}`, `title: ${id} decision`, ...extra, "---", `# ${id} decision`, "", "## Context", "", "c", "", "## Decision", "", "d", "", "## Alternatives", "", "a", "", "## Consequences", "", "q");
const moduleFile = lines("---", "id: MOD-m", "title: MOD-m", "folder: src/m/", "realises:", "follows:", "  - ARC-002", "uses: []", "provides:", "  - m", "---", "# MOD-m m", "", "## Responsibility", "", "r", "", "## Parts", "", "p", "", "## Data", "", "d", "",
  "## Interfaces", "", "- `m` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
const useCase = (id, requirement) => lines("---", `id: ${id}`, `title: ${id} case`, "area: x", "actors:", "  - A", "realises:", `  - ${requirement}`, "---", `# ${id} case`, "");
const item = (id, level, realises, modules) => lines("---", `id: ${id}`, `title: ${id} item`, `level: ${level}`, "realises:", ...realises.map((name) => `  - ${name}`), "modules:", ...modules.map((mod) => `  - ${mod}`), "tests:", "  - unit", "origin:",
  "  - UC-001", "---", `# ${id} item`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a");
const testFile = (id, mod, guards) => lines(`// ${id}`, "// level: unit", `// module: ${mod}`, `// guards: ${guards}`, "", "// the case follows");

const FILES = {
  "SPEC.md": lines("# Fixture — Specification", "", "## 1. Rules", "", "**RULE ONE** *(Owner)*", "One.", "*Check:* `tests/c.test.mjs`", "", "**RULE TWO** *(Owner)*", "Two.", "*Check:* `tests/b.test.mjs`", "", "**RULE THREE** *(Owner)*", "Three.",
    "*Check:* `tests/m.test.mjs`"),
  "docs/architecture/ARC-001-whole.md": decision("ARC-001", ["forced_by:", "  - UC-001"]),
  "docs/architecture/ARC-002-sub.md": decision("ARC-002", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-m"]),
  "docs/architecture/MOD-m.md": moduleFile,
  "docs/use-cases/UC-001-first.md": useCase("UC-001", "RULE ONE"),
  "docs/use-cases/UC-002-second.md": useCase("UC-002", "RULE TWO"),
  "docs/use-cases/UC-003-third.md": useCase("UC-003", "RULE ONE"),
  "docs/backlog/ITM-001-the-item.md": item("ITM-001", "module", ["UC-001", "RULE TWO"], ["MOD-m"]),
  "docs/backlog/ITM-002-the-other-item.md": item("ITM-002", "module", ["UC-001"], ["MOD-m"]),
  "docs/plan/ITM-020-the-step.md": item("ITM-020", "module", ["UC-001", "RULE TWO"], ["MOD-m"]),
  "src/m/index.mjs": "export const m = 1;\n",
  "tests/a.test.mjs": testFile("TST-001", "system", "UC-001"),
  "tests/b.test.mjs": testFile("TST-002", "system", "RULE TWO"),
  "tests/c.test.mjs": testFile("TST-003", "system", "RULE ONE"),
  "tests/d.test.mjs": testFile("TST-004", "system", "UC-002"),
  "tests/m.test.mjs": testFile("TST-005", "MOD-m", "RULE THREE"),
};
const INSTANCE_SPEC = lines("# Instance — Specification", "", "## 1. Process", "", "**A PROCESS RULE** *(Owner)*", "The process rule.", "*Check:* no automatic check; at review.");

const snapshotOf = (files) => ({ paths: Object.keys(files), read: async (path) => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null) });
const contextOf = (params, { contents = [], instance = { "SPEC.md": INSTANCE_SPEC }, product = FILES } = {}) => ({
  kind: null, params, product: { address: "https://github.com/acme/product", snapshot: snapshotOf(product), host: null }, instance: { snapshot: snapshotOf(instance), host: null, checkout: null },
  connect: async () => null, participants: [], places: { sources: {}, mailbox: null, contents }, gates: [], person: "alice", now: new Date("2026-11-01T08:00:00Z"),
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
const recipe = (params, options) => offline(() => runPlanner.runStrategies.recipes["implementation-inputs"](contextOf(params, options), params));
const namesOf = (parts) => parts.map((part) => part.name);

const MODULE_INPUTS = ["docs/architecture/MOD-m.md", "docs/architecture/ARC-002-sub.md", "docs/architecture/ARC-001-whole.md", "SPEC.md", "src/m/index.mjs", "tests/m.test.mjs"];
const PROCESS = "SPEC.md process requirements";

// TST-1409001 · level: unit · module: MOD-run-planner
// guards: UC-034; TEST GENERATION SEES THE EXISTING TESTS
// given: the fixture product; ITM-001 realises UC-001 and RULE TWO and changes MOD-m; UC-002 realises RULE TWO and UC-003 realises RULE ONE, which the item does not name; tests/a.test.mjs guards UC-001, tests/b.test.mjs RULE TWO, tests/c.test.mjs RULE ONE, tests/d.test.mjs UC-002 and tests/m.test.mjs RULE THREE
// input: the recipe with params.items = ["ITM-001"]
// expect: first the item's file docs/backlog/ITM-001-the-item.md; then the use case it names, UC-001, and the use case that realises the requirement it names, UC-002, and not UC-003; then the tests that guard what it lists — tests/a.test.mjs and tests/b.test.mjs, and not tests/c.test.mjs or tests/d.test.mjs; then the module's file, its two decisions, the SPEC, its code and its test; the process requirements last; each part is its file given whole; known positive: the module's inputs are all there
test("an item gives its file, the use cases it realises and the existing tests that guard what it realises, before its module's inputs — MOD-run-planner", async () => {
  const parts = await recipe({ items: ["ITM-001"] });
  assert.deepEqual(namesOf(parts), ["docs/backlog/ITM-001-the-item.md", "docs/use-cases/UC-001-first.md", "docs/use-cases/UC-002-second.md", "tests/a.test.mjs", "tests/b.test.mjs", ...MODULE_INPUTS, PROCESS]);
  for (const part of parts.slice(0, -1)) assert.equal(part.text, FILES[part.name], `${part.name} is given whole`);
  assert.ok(parts.every((part) => part.required === true && Array.isArray(part.sources)));
});

// TST-1409002 · level: unit · module: MOD-run-planner
// guards: UC-034; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the fixture product, and places.contents naming SRC-backlog for the folder docs/backlog, SRC-case for the file docs/use-cases/UC-002-second.md and SRC-spec for the file SPEC.md
// input: the recipe with params.items = ["ITM-001"]
// expect: the item's file carries ["SRC-backlog"], UC-002 ["SRC-case"], UC-001 and the guarding tests none, the product's SPEC.md ["SRC-spec"], and the process requirements part, which is the instance's file, none
test("the item's file, its use cases and its tests carry the sources of the places that name them, and the instance's file none — MOD-run-planner", async () => {
  const contents = [{ source: "SRC-backlog", paths: ["docs/backlog"] }, { source: "SRC-case", paths: ["docs/use-cases/UC-002-second.md"] }, { source: "SRC-spec", paths: ["SPEC.md"] }];
  const parts = await recipe({ items: ["ITM-001"] }, { contents });
  const sources = Object.fromEntries(parts.map((part) => [part.name, part.sources]));
  assert.deepEqual(sources, {
    "docs/backlog/ITM-001-the-item.md": ["SRC-backlog"], "docs/use-cases/UC-001-first.md": [], "docs/use-cases/UC-002-second.md": ["SRC-case"], "tests/a.test.mjs": [], "tests/b.test.mjs": [],
    "docs/architecture/MOD-m.md": [], "docs/architecture/ARC-002-sub.md": [], "docs/architecture/ARC-001-whole.md": [], "SPEC.md": ["SRC-spec"], "src/m/index.mjs": [], "tests/m.test.mjs": [], [PROCESS]: [],
  });
});

// TST-1409003 · level: unit · module: MOD-run-planner
// guards: UC-034
// given: the fixture product with the instance's SPEC.md "# Instance — Specification" holding A PROCESS RULE; then a product whose SPEC.md has the instance's text; then an instance with no SPEC.md
// input: the recipe with params.items = ["ITM-002"] for each
// expect: the first gives the part `SPEC.md process requirements` as the last part, whose text is the instance's SPEC.md byte for byte, beside the product's own SPEC.md part; the second gives the SPEC.md part once and no process requirements part; the third gives no such part and throws nothing
test("the process requirements are the instance's SPEC.md, last, and are not given twice or where the instance has none — MOD-run-planner", async () => {
  const parts = await recipe({ items: ["ITM-002"] });
  assert.equal(parts[parts.length - 1].name, PROCESS);
  assert.equal(parts[parts.length - 1].text, INSTANCE_SPEC);
  assert.equal(parts.find((part) => part.name === "SPEC.md").text, FILES["SPEC.md"], "known positive: the product's SPEC.md is a part of its own");
  const same = await recipe({ items: ["ITM-002"] }, { instance: { "SPEC.md": FILES["SPEC.md"] } });
  assert.equal(same.filter((part) => part.name === "SPEC.md").length, 1);
  assert.ok(!namesOf(same).includes(PROCESS), "the product's SPEC.md part already gives the same text");
  const none = await recipe({ items: ["ITM-002"] }, { instance: {} });
  assert.ok(!namesOf(none).includes(PROCESS));
  assert.equal(namesOf(none)[0], "docs/backlog/ITM-002-the-other-item.md", "known positive: the item's own parts are given");
});

// TST-1409004 · level: unit · module: MOD-run-planner
// guards: UC-034; UC-024; UC-012
// given: the fixture product, in which the plan step ITM-020 changes MOD-m like the item ITM-001 and realises the same UC-001 and RULE TWO
// input: the recipe with params.steps = ["ITM-020"], then with params.modules = ["MOD-m"], then with params.items = ["ITM-001"]
// expect: the step and the module-only job give exactly the module's inputs — no item or step file, no use case, no guarding test beyond the module's own, no process requirements —; the item gives its own file first and the same module inputs after its own parts
test("a plan step and a job that names only modules get the module's inputs alone — MOD-run-planner", async () => {
  const step = await recipe({ steps: ["ITM-020"] });
  assert.deepEqual(namesOf(step), MODULE_INPUTS);
  assert.deepEqual(namesOf(await recipe({ modules: ["MOD-m"] })), MODULE_INPUTS);
  const asItem = namesOf(await recipe({ items: ["ITM-001"] }));
  assert.equal(asItem[0], "docs/backlog/ITM-001-the-item.md", "known positive: the item, unlike the step, is given its file");
  assert.deepEqual(MODULE_INPUTS.filter((name) => asItem.includes(name)), MODULE_INPUTS, "known positive: the item gives the module's inputs too");
});

// TST-1409005 · level: unit · module: MOD-run-planner
// guards: UC-034
// given: the fixture product with the items ITM-001 and ITM-002, both changing MOD-m and both realising UC-001
// input: the recipe with params.items = ["ITM-001", "ITM-002"]
// expect: ITM-001's parts as for it alone, then ITM-002's file, which is the only part of ITM-002 not given before; the process requirements once, last
test("two items give the use cases, tests and module inputs they share once, and the process requirements once at the end — MOD-run-planner", async () => {
  const parts = await recipe({ items: ["ITM-001", "ITM-002"] });
  assert.deepEqual(namesOf(parts), ["docs/backlog/ITM-001-the-item.md", "docs/use-cases/UC-001-first.md", "docs/use-cases/UC-002-second.md", "tests/a.test.mjs", "tests/b.test.mjs", ...MODULE_INPUTS,
    "docs/backlog/ITM-002-the-other-item.md", PROCESS]);
});
