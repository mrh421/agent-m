// The recipe `architecture-and-model` of MOD-work-plans' `workStrategies` (ITM-610, ITM-1367), as the accepted text of docs/architecture/MOD-work-plans.md states it: "recipe
// `architecture-and-model` — the decision that states the system, the subsystems' decisions, the module files, the process model with its phases and gates, and the existing plan",
// with UC-045 step 2 ("what is sent: the decision that states the system, the subsystems' decisions, the module files, the process model with its phases and gates, and the existing
// plan") and MOD-job-runner's `JobContext` and `Part`.
// Run: node --test tests/work-plans-architecture-and-model.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-045; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; THE MODEL DETERMINES THE PHASES AND THE GATES
// Level: unit
//
// The product is a fixture of this file: a SPEC.md, three decisions (ARC-001 states the system, ARC-002 refines it and designs two modules, ARC-003 refines it and designs none), three
// modules (MOD-reader and MOD-writer, designed by ARC-002, and MOD-loose, designed by none), a use case, the process model docs/process.md — a declaration of the shipped V-model at the
// instance's commit DECLARED —, an existing plan of two steps with its order, two backlog items, code under a module's folder and a test file. The instance is a snapshot behind a host of
// this file that records the commits it is asked for. The readings where the file leaves one open, which the pull request names:
//   - The system's decision is the one that refines no other; the subsystems' decisions are those that refine it and design at least one module; both are read from the trace graph's
//     `refines` and `designs` edges, as MOD-run-planner's recipe reads them. A decision that refines the system and designs no module is no subsystem's and is not given.
//   - The module files are every module of the product, by identifier. The process model is the file docs/process.md and then, as one part "phases and gates of the product's
//     workflow", the phases and the gates of the workflow MOD-product-process' `productWorkflow` gives from that declaration, as JSON `{ phases, gates }`; that part carries the sources
//     of docs/process.md (ITM-1367). The existing plan is every file under docs/plan/, by path.
//   - A file's part is the file, named by its path, whole, given once; it carries the sources of every `places.contents` entry that names its path or a folder above it. The parts stand
//     in the order system, subsystems, modules, process model, plan. Nothing else is given: no SPEC, no use case, no backlog item, no code, no test.
//   - A product without docs/process.md is refused by name (UnknownWork), as MOD-run-planner's recipe refuses a file the product lacks; a product whose declared model the instance does
//     not hold at the declared commit is refused by the model's file (UnknownWork), as plan-checks gives an error for it; a product without a plan gives no plan part.
// Each test states its input and its expected result before it runs (given / input / expect); every call is made with a `fetch` that fails the test if it is called. The
// counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { prepareJob, registerStrategies } from "../src/job-runner/index.mjs";
import * as workPlans from "../src/work-plans/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;

// ---------------------------------------------------------------- the fixture product

const decision = (id, extra) => lines("---", `id: ${id}`, `title: ${id} decision`, ...extra, "---", `# ${id} decision`, "", "## Context", "", "c", "", "## Decision", "", "d", "",
  "## Alternatives", "", "a", "", "## Consequences", "", "q");
const module_ = (id) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-002", "uses: []", "provides:", "  - f", "---",
  `# ${id} ${id}`, "", "## Responsibility", "", `RESPONSIBILITY-OF-${id}`, "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `f` — i", "", "## Files", "", "f",
  "", "## Uses", "", "u");
const useCase = (id) => lines("---", `id: ${id}`, `title: ${id} case`, "area: x", "actors:", "  - A", "realises:", "  - A GUARDED RULE", "---", `# ${id} case`, "");
const item = (id, level, modules, extra = []) => lines("---", `id: ${id}`, `title: ${id} item`, `level: ${level}`, "realises:", "  - UC-001", "modules:", ...modules.map((mod) => `  - ${mod}`),
  ...extra, "tests:", "  - unit", "origin:", "  - UC-001", "---", `# ${id} item`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a");
// The product's declaration: the V-model of `modelFile` at the instance's commit DECLARED.
const DECLARED = "5".repeat(40);
const declaration = (modelFile) => lines("---", "model: v-model", `model_file: ${modelFile}`, `model_version: ${DECLARED}`, "---", "# Process", "", "## Practices", "", "- none", "",
  "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Implementation | work |", "", "## Definition of Done", "", "The job rules hold.");

const FILES = {
  "SPEC.md": lines("# Fixture — Specification", "", "## 1. Rules", "", "**A GUARDED RULE** *(Owner)*", "A rule.", "*Check:* `tests/reader.test.mjs`"),
  "docs/process.md": declaration("src/model-catalogue/models/v-model.md"),
  "docs/architecture/ARC-001-whole.md": decision("ARC-001", ["forced_by:", "  - UC-001"]),
  "docs/architecture/ARC-002-sub.md": decision("ARC-002", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-reader", "  - MOD-writer"]),
  "docs/architecture/ARC-003-aside.md": decision("ARC-003", ["refines: ARC-001", "forced_by:", "  - UC-001"]),
  "docs/architecture/MOD-reader.md": module_("MOD-reader"),
  "docs/architecture/MOD-writer.md": module_("MOD-writer"),
  "docs/architecture/MOD-loose.md": module_("MOD-loose"),
  "docs/use-cases/UC-001-load.md": useCase("UC-001"),
  "docs/plan/ITM-010-reader.md": item("ITM-010", "module", ["MOD-reader"]),
  "docs/plan/ITM-011-writer.md": item("ITM-011", "module", ["MOD-writer"], ["builds_on:", "  - ITM-010"]),
  "docs/plan/order.md": lines("| Step | Phase |", "| --- | --- |", "| ITM-010 | implementation |", "| ITM-011 | implementation |"),
  "docs/backlog/ITM-020-other.md": item("ITM-020", "module", ["MOD-loose"]),
  "docs/backlog/ITM-021-other.md": item("ITM-021", "module", ["MOD-loose"]),
  "src/reader/index.mjs": "export const read = 1;\n",
  "tests/reader.test.mjs": lines("// TST-001", "// level: unit", "// module: MOD-reader", "// guards: UC-001", "", "// the case follows"),
};

const snapshotOf = (files) => ({ paths: Object.keys(files), blob: () => null, read: async (path) => (Object.prototype.hasOwnProperty.call(files, path) ? files[path] : null) });
// The commits the instance's host was asked for, since the last context was made.
let asked = [];
const instanceOf = () => {
  const snapshot = snapshotOf({ "SPEC.md": "# Instance\n" });
  asked = [];
  return { snapshot, host: { async readSnapshot(commit) { asked.push(commit); return snapshot; } }, checkout: null };
};
const contextOf = (files, contents = []) => ({
  kind: null, params: {}, product: { address: "https://github.com/acme/product", snapshot: snapshotOf(files), host: null }, instance: instanceOf(),
  connect: async () => null, participants: [], places: { sources: {}, mailbox: null, contents }, gates: [], person: "alice", now: new Date("2026-10-17T08:00:00Z"),
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
const recipe = (files, contents) => offline(() => workPlans.workStrategies.recipes["architecture-and-model"](contextOf(files, contents), {}));
const namesOf = (parts) => parts.map((part) => part.name);
const WORKFLOW = "phases and gates of the product's workflow";

const ALL = [
  "docs/architecture/ARC-001-whole.md", "docs/architecture/ARC-002-sub.md",
  "docs/architecture/MOD-loose.md", "docs/architecture/MOD-reader.md", "docs/architecture/MOD-writer.md",
  "docs/process.md", WORKFLOW,
  "docs/plan/ITM-010-reader.md", "docs/plan/ITM-011-writer.md", "docs/plan/order.md",
];

// TST-610001 · level: unit · module: MOD-work-plans
// guards: UC-045
// given: the fixture product, whose system decision is ARC-001 and whose one subsystem decision is ARC-002 (ARC-003 refines ARC-001 and designs no module), with three modules, docs/process.md declaring the V-model, a plan of two steps and its order, two backlog items, a SPEC, a use case, code and a test
// input: the recipe architecture-and-model
// expect: ten parts, by name, in this order: ARC-001's file, ARC-002's file; the module files MOD-loose, MOD-reader, MOD-writer; docs/process.md; the phases and gates of the product's workflow; the plan's files docs/plan/ITM-010-reader.md, ITM-011-writer.md, order.md; and none of ARC-003, SPEC.md, the use case, the backlog items, the code or the test
test("the recipe gives the system's decision, the subsystems' decisions, every module file, the process model and the existing plan, in that order — MOD-work-plans", async () => {
  const parts = await recipe(FILES);
  assert.deepEqual(namesOf(parts), ALL);
});

// TST-610002 · level: unit · module: MOD-work-plans
// guards: UC-045
// given: the fixture product
// input: the recipe architecture-and-model
// expect: each part is required, with a text and a `sources` array; each part but the workflow's is one file given whole (its text is the file's text); MOD-reader's file still holds its Responsibility line, so a module file is not cut to a section
test("a part is one file given whole, required and carrying its sources — MOD-work-plans", async () => {
  const parts = await recipe(FILES);
  assert.equal(parts.length, 10, "known positive: the parts are there to be checked");
  assert.ok(parts.every((part) => part.required === true && typeof part.text === "string" && Array.isArray(part.sources)));
  for (const part of parts.filter((each) => each.name !== WORKFLOW)) assert.equal(part.text, FILES[part.name], `${part.name} is given whole`);
  assert.match(parts.find((part) => part.name === "docs/architecture/MOD-reader.md").text, /RESPONSIBILITY-OF-MOD-reader/);
});

// TST-610003 · level: unit · module: MOD-work-plans
// guards: UC-045; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the fixture product, and places.contents naming SRC-secret for the folder docs/plan and for docs/architecture/MOD-writer.md, and SRC-other for the one file docs/process.md
// input: the recipe architecture-and-model
// expect: the three plan parts and MOD-writer's file carry ["SRC-secret"]; docs/process.md and the phases and gates of its workflow carry ["SRC-other"]; every other part carries none; with places.contents empty no part carries any source
test("a part carries a source only where places.contents puts its path under that source — MOD-work-plans", async () => {
  const contents = [{ source: "SRC-secret", paths: ["docs/plan", "docs/architecture/MOD-writer.md"] }, { source: "SRC-other", paths: ["docs/process.md"] }];
  const parts = await recipe(FILES, contents);
  assert.deepEqual(Object.fromEntries(parts.map((part) => [part.name, part.sources])), {
    "docs/architecture/ARC-001-whole.md": [], "docs/architecture/ARC-002-sub.md": [], "docs/architecture/MOD-loose.md": [], "docs/architecture/MOD-reader.md": [],
    "docs/architecture/MOD-writer.md": ["SRC-secret"], "docs/process.md": ["SRC-other"], [WORKFLOW]: ["SRC-other"],
    "docs/plan/ITM-010-reader.md": ["SRC-secret"], "docs/plan/ITM-011-writer.md": ["SRC-secret"], "docs/plan/order.md": ["SRC-secret"],
  });
  const none = await recipe(FILES, []);
  assert.deepEqual(none.map((part) => part.sources), none.map(() => []));
});

// TST-610004 · level: unit · module: MOD-work-plans
// guards: UC-045
// given: the fixture product without its plan (no file under docs/plan/)
// input: the recipe architecture-and-model
// expect: seven parts — ARC-001, ARC-002, the three module files, docs/process.md, the phases and gates of its workflow — and no plan part; the product with its plan gives ten (TST-610001), so the absence is the product's, not the recipe's omission
test("a product without a plan gives no plan part — MOD-work-plans", async () => {
  const files = Object.fromEntries(Object.entries(FILES).filter(([path]) => !path.startsWith("docs/plan/")));
  assert.equal((await recipe(FILES)).length, 10, "known positive: the plan's files are parts when the product has them");
  assert.deepEqual(namesOf(await recipe(files)), ALL.slice(0, 7));
});

// TST-610005 · level: unit · module: MOD-work-plans
// guards: UC-045
// given: the fixture product, and the same product without docs/process.md
// input: the recipe architecture-and-model
// expect: the first gives its ten parts; the second is refused with UnknownWork { id: "docs/process.md" }
test("a product without its process model is refused by name — MOD-work-plans", async () => {
  assert.equal((await recipe(FILES)).length, 10, "known positive");
  const { "docs/process.md": _gone, ...without } = FILES;
  await assert.rejects(recipe(without), (error) => error.name === "UnknownWork" && error.id === "docs/process.md");
});

// TST-610006 · level: unit · module: MOD-work-plans
// guards: UC-045; ONE DEFINITION, THREE DRIVERS
// given: the fixture product, the recipe registered under the owner MOD-work-plans with a stand-in for the other strategy the kind `draft-plan` names (the precondition `rests-on-accepted`); the check `plan-checks` (ITM-613) and the writer `plan-steps` (ITM-614) are MOD-work-plans' own
// input: prepareJob("draft-plan", context, no drafter)
// expect: it does not throw UnknownStrategy, and its parts of the recipe `architecture-and-model` are the ten parts of TST-610001, in that order
test("the kind draft-plan prepares with the recipe registered — MOD-work-plans", async () => {
  registerStrategies("MOD-work-plans", workPlans.workStrategies);
  registerStrategies("tests/work-plans-architecture-and-model.test.mjs", {
    preconditions: { "rests-on-accepted": async () => null },
  });
  const prepared = await offline(() => prepareJob("draft-plan", contextOf(FILES), { drafter: null, reviewers: [] }));
  assert.deepEqual(namesOf(prepared.parts.filter((part) => part.recipe === "architecture-and-model")), ALL);
});

// TST-1367001 · level: unit · module: MOD-work-plans
// guards: UC-045; THE MODEL DETERMINES THE PHASES AND THE GATES
// given: the fixture product, whose docs/process.md declares the shipped V-model (model_file src/model-catalogue/models/v-model.md) at the instance's commit DECLARED
// input: the recipe architecture-and-model
// expect: the part after docs/process.md is "phases and gates of the product's workflow", required; its text is JSON whose `phases` are, by name and in order, Concept, Requirements, Design, Implementation, Testing, Validation & Verification, Operation & Maintenance, and whose `gates` are, by name, Requirements → Design, Design → Implementation, Validation & Verification → Operation & Maintenance, each decided by the Reviewer; the instance was read at DECLARED, the commit the declaration names; known positive: docs/process.md, the part before, is the declaration as it stands and names no phase and no gate
test("the participant receives the phases and the gates of the product's declared workflow, after its declaration — MOD-work-plans", async () => {
  const parts = await recipe(FILES);
  const at = namesOf(parts).indexOf("docs/process.md");
  assert.equal(parts[at].text, FILES["docs/process.md"], "known positive: the declaration is given as it stands");
  assert.doesNotMatch(parts[at].text, /Validation & Verification|Design → Implementation/, "known positive: the declaration names no phase and no gate");
  const part = parts[at + 1];
  assert.equal(part?.name, WORKFLOW);
  assert.equal(part.required, true);
  const { phases, gates } = JSON.parse(part.text);
  assert.deepEqual(phases.map((phase) => phase.name), ["Concept", "Requirements", "Design", "Implementation", "Testing", "Validation & Verification", "Operation & Maintenance"]);
  assert.deepEqual(gates.map((gate) => gate.name), ["Requirements → Design", "Design → Implementation", "Validation & Verification → Operation & Maintenance"]);
  assert.deepEqual(gates.map((gate) => gate.decider), ["Reviewer", "Reviewer", "Reviewer"]);
  assert.deepEqual(asked, [DECLARED], "the instance is read at the commit the declaration names");
});

// TST-1367002 · level: unit · module: MOD-work-plans
// guards: UC-045; THE MODEL DETERMINES THE PHASES AND THE GATES
// given: the fixture product whose docs/process.md declares the model file docs/process-models/gone.md, which the instance does not hold at DECLARED; and the fixture product as it is
// input: the recipe architecture-and-model
// expect: the first is refused with UnknownWork { id: "docs/process-models/gone.md" }, so nothing is sent without the phases and the gates; known positive: the fixture product as it is gives its ten parts
test("a product whose declared model the instance does not hold is refused by the model's file — MOD-work-plans", async () => {
  assert.equal((await recipe(FILES)).length, 10, "known positive");
  const gone = { ...FILES, "docs/process.md": declaration("docs/process-models/gone.md") };
  await assert.rejects(recipe(gone), (error) => error.name === "UnknownWork" && error.id === "docs/process-models/gone.md");
});
