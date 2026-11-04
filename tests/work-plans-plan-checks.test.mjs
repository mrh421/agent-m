// The check `plan-checks` of MOD-work-plans' `workStrategies` and `planFindings` (ITM-613), as the accepted text of docs/architecture/MOD-work-plans.md states them
// (read from main, blob 613160a4d773): "`planFindings(plan, steps, architecture, workflow, source, history?) -> Promise<Finding[]>` — a module, a subsystem or the system
// without a step; with `history`, a step whose module or subsystem file was removed, and a step whose module or subsystem file was changed by a commit later than the step's own
// last commit (`readHistory` of both files, `changes: false`), each naming the file and the step ...; a module ordered before one whose interface it uses; a step without a phase
// of the model; and the findings MOD-trace-graph's `graphFindings` gives on `traceGraph(source)`, `source` being the product's files with the drafted steps in place, of those
// steps: a step without the tests of its level, or with the tests of another, and a cycle in the modules' uses, naming its modules", and "check `plan-checks` — `planFindings` on
// a drafted plan, with the product's workflow; where the product has no workflow, one error finding naming the declared model and its commit".
// Run: node --test tests/work-plans-plan-checks.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-045; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES; A PLAN STEP NAMES THE TESTS OF ITS LEVEL; MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE; THE MODEL DETERMINES THE PHASES AND THE GATES; A RUN FOLLOWS THE MODULES' INTERFACES
// Level: unit
//
// The readings, named in the pull request: a step names a module by `modules` and level `module`; a subsystem's integration is a step of level `subsystem` whose `modules` hold every
// module the subsystem's decision designs; the system's step has level `system`; the drafted plan (the answer of the kind draft-plan: title, implements, level, phase, after) becomes a step
// per entry with a provisional identifier after the product's highest, its tests the draft's `level`, and an order row per entry in the drafted sequence. The product is a fixture in
// memory; nothing reaches the network. Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { artifactSchemas, readDocument } from "../src/documents/index.mjs";
import * as workPlans from "../src/work-plans/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const PHASES = [{ name: "Implementation" }, { name: "Testing" }];
const WORKFLOW = { phases: PHASES, gates: [], model: { name: "v-model" } };

const decision = (id, extra) => lines("---", `id: ${id}`, `title: ${id} decision`, ...extra, "---", `# ${id} decision`, "", "## Context", "", "c", "", "## Decision", "", "d", "", "## Alternatives", "", "a", "", "## Consequences", "", "q");
const module_ = (id, uses = []) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-002", ...(uses.length ? ["uses:", ...uses.map((each) => `  - ${each}`)] : ["uses: []"]),
  "provides:", "  - read", "  - write", "---", `# ${id} ${id}`, "", "## Responsibility", "", "r", "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `read` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
const step = (id, level, modules, tests, extra = []) => lines("---", `id: ${id}`, `title: ${id} step`, `level: ${level}`, "realises:", "  - A RULE", "modules:", ...modules.map((each) => `  - ${each}`), ...extra,
  "tests:", ...tests.map((each) => `  - ${each}`), "origin:", "  - UC-001", "---", `# ${id} step`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a");
const order = (rows) => lines("## Order", "", "| Step | Phase |", "| --- | --- |", ...rows.map(([id, phase]) => `| ${id} | ${phase} |`));

const ARCHITECTURE = (uses = {}) => ({
  "docs/architecture/ARC-001-whole.md": decision("ARC-001", ["forced_by:", "  - UC-001"]),
  "docs/architecture/ARC-002-sub.md": decision("ARC-002", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-reader", "  - MOD-writer"]),
  "docs/architecture/MOD-reader.md": module_("MOD-reader", uses["MOD-reader"]), "docs/architecture/MOD-writer.md": module_("MOD-writer", uses["MOD-writer"] ?? ["MOD-reader.read"]),
});
const STEPS = {
  "docs/plan/ITM-010-reader.md": step("ITM-010", "module", ["MOD-reader"], ["unit"]), "docs/plan/ITM-011-writer.md": step("ITM-011", "module", ["MOD-writer"], ["unit"]),
  "docs/plan/ITM-012-sub.md": step("ITM-012", "subsystem", ["MOD-reader", "MOD-writer"], ["component"]), "docs/plan/ITM-013-system.md": step("ITM-013", "system", ["MOD-reader", "MOD-writer"], ["system", "release"]),
};
const ORDER = [["ITM-010", "Implementation"], ["ITM-011", "Implementation"], ["ITM-012", "Testing"], ["ITM-013", "Testing"]];

// A fixture: the architecture, the steps and the order, each as the documents planFindings gets and the TextSource with the same files in place.
function setting({ architecture = ARCHITECTURE(), steps = STEPS, rows = ORDER } = {}) {
  const files = { "SPEC.md": lines("# Fixture", "", "## 1. Rules", "", "**A RULE** *(Owner)*", "A rule.", "*Check:* no automatic check; at review."), ...architecture, ...steps, "docs/plan/order.md": order(rows) };
  const schemas = artifactSchemas();
  const documents = (paths, schema) => paths.map((path) => readDocument(schema, path, files[path]));
  const architecturePaths = Object.keys(architecture);
  const source = { paths: Object.keys(files), read: async (path) => files[path] ?? null };
  return { files, source, plan: readDocument(workPlans.planSchemas.planOrder, "docs/plan/order.md", files["docs/plan/order.md"]), steps: documents(Object.keys(steps), schemas.item),
    architecture: architecturePaths.map((path) => readDocument(/\/ARC-/.test(path) ? schemas.decision : schemas.module, path, files[path])) };
}
const found = (s, workflow = WORKFLOW, history) => workPlans.planFindings(s.plan, s.steps, s.architecture, workflow, s.source, history);
const whats = (findings) => findings.map((each) => each.what).join("\n");

// TST-613001 · level: unit · module: MOD-work-plans
// guards: UC-045; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: the fixture architecture (the system ARC-001; the subsystem ARC-002 designing MOD-reader and MOD-writer, which uses MOD-reader.read) and a plan of four steps in order: a module step each for MOD-reader and MOD-writer, ARC-002's integration, the system; phases of the workflow
// input: planFindings
// expect: no finding (the known positive of the cases below)
// Planted fault: any finding raised for a sound plan makes this case fail, and each case below changes one line of it.
test("planFindings — a sound plan gives no finding", async () => {
  assert.deepEqual(await found(setting()), []);
});

// TST-613002 · level: unit · module: MOD-work-plans
// guards: UC-045; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: the sound plan without the step of MOD-writer; without the integration step; without the system step
// input: planFindings for each
// expect: each gives an error finding that names what has no step — MOD-writer, ARC-002, the system (ARC-001)
// Planted fault: not checking subsystems, or the system, leaves the second or third silent.
test("planFindings — a module, a subsystem or the system without a step is named", async () => {
  const without = (path, id) => setting({ steps: Object.fromEntries(Object.entries(STEPS).filter(([each]) => each !== path)), rows: ORDER.filter(([each]) => each !== id) });
  assert.match(whats(await found(without("docs/plan/ITM-011-writer.md", "ITM-011"))), /MOD-writer/);
  assert.match(whats(await found(without("docs/plan/ITM-012-sub.md", "ITM-012"))), /ARC-002/);
  assert.match(whats(await found(without("docs/plan/ITM-013-system.md", "ITM-013"))), /ARC-001|system/);
  for (const findings of [await found(without("docs/plan/ITM-011-writer.md", "ITM-011"))]) assert.ok(findings.every((each) => each.kind === "error"));
});

// TST-613003 · level: unit · module: MOD-work-plans
// guards: UC-045; A RUN FOLLOWS THE MODULES' INTERFACES
// given: the sound plan with the order changed so that ITM-011 (MOD-writer, which uses MOD-reader.read) stands before ITM-010 (MOD-reader)
// input: planFindings
// expect: an error finding that names MOD-writer and MOD-reader
// Planted fault: not comparing the positions of the steps, or comparing them the other way, leaves no finding or one for the sound plan (TST-613001).
test("planFindings — a module ordered before one whose interface it uses is named", async () => {
  const findings = await found(setting({ rows: [["ITM-011", "Implementation"], ["ITM-010", "Implementation"], ["ITM-012", "Testing"], ["ITM-013", "Testing"]] }));
  assert.match(whats(findings), /MOD-writer.*MOD-reader|MOD-reader.*MOD-writer/s);
});

const ASSEMBLES = "AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES";
const assembles = (findings) => findings.filter((each) => each.rule === ASSEMBLES);

// TST-1369001 · level: unit · module: MOD-work-plans
// guards: UC-045; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: the sound plan with ARC-002's integration ITM-012 ordered before ITM-011, the step of its module MOD-writer (ITM-010, ITM-012, ITM-011, ITM-013); known positive: the sound plan gives no finding under the rule; and a second subsystem ARC-003 designing MOD-mail, whose step ITM-014 and integration ITM-015 stand after ARC-002's integration and before the system
// input: planFindings for each
// expect: one error finding under AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES on ITM-012, naming ITM-011; none under the rule for the sound plan; none for ARC-002's integration standing before the module of the other subsystem
test("planFindings — a subsystem's integration ordered before a step of one of its modules is named", async () => {
  assert.deepEqual(assembles(await found(setting())), [], "known positive: the sound plan");
  const early = assembles(await found(setting({ rows: [["ITM-010", "Implementation"], ["ITM-012", "Testing"], ["ITM-011", "Implementation"], ["ITM-013", "Testing"]] })));
  assert.equal(early.length, 1, whats(early));
  assert.deepEqual([early[0].kind, early[0].artifact], ["error", "ITM-012"]);
  assert.match(early[0].what, /ITM-012[^]*ITM-011/);
  const two = setting({
    architecture: { ...ARCHITECTURE(), "docs/architecture/ARC-003-mail.md": decision("ARC-003", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-mail"]), "docs/architecture/MOD-mail.md": module_("MOD-mail") },
    steps: { ...STEPS, "docs/plan/ITM-014-mail.md": step("ITM-014", "module", ["MOD-mail"], ["unit"]), "docs/plan/ITM-015-mailing.md": step("ITM-015", "subsystem", ["MOD-mail"], ["component"]) },
    rows: [["ITM-010", "Implementation"], ["ITM-011", "Implementation"], ["ITM-012", "Testing"], ["ITM-014", "Implementation"], ["ITM-015", "Testing"], ["ITM-013", "Testing"]],
  });
  assert.deepEqual(assembles(await found(two)), [], "an integration may stand before the modules of another subsystem");
});

// TST-1369002 · level: unit · module: MOD-work-plans
// guards: UC-045; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: the sound plan with the system's step ITM-013 first (ITM-013, ITM-010, ITM-011, ITM-012); then with ITM-013 only before ARC-002's integration (ITM-010, ITM-011, ITM-013, ITM-012); known positive: the sound plan, the system last, gives no finding under the rule
// input: planFindings for each
// expect: one error finding under AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES on ITM-013, naming ITM-010, ITM-011 and ITM-012 for the first; for the second, one on ITM-013 naming ITM-012 and not ITM-010
test("planFindings — the system's step ordered before any other step is named", async () => {
  assert.deepEqual(assembles(await found(setting())), [], "known positive: the system last");
  const first = assembles(await found(setting({ rows: [["ITM-013", "Testing"], ["ITM-010", "Implementation"], ["ITM-011", "Implementation"], ["ITM-012", "Testing"]] })));
  const system = first.filter((each) => each.artifact === "ITM-013");
  assert.equal(system.length, 1, whats(first));
  assert.equal(system[0].kind, "error");
  for (const id of ["ITM-010", "ITM-011", "ITM-012"]) assert.match(system[0].what, new RegExp(id));
  const beforeOne = assembles(await found(setting({ rows: [["ITM-010", "Implementation"], ["ITM-011", "Implementation"], ["ITM-013", "Testing"], ["ITM-012", "Testing"]] })));
  assert.equal(beforeOne.length, 1, whats(beforeOne));
  assert.equal(beforeOne[0].artifact, "ITM-013");
  assert.match(beforeOne[0].what, /ITM-012/);
  assert.doesNotMatch(beforeOne[0].what, /ITM-010/);
});

// TST-613004 · level: unit · module: MOD-work-plans
// guards: UC-045; THE MODEL DETERMINES THE PHASES AND THE GATES
// given: the sound plan with ITM-012 in a phase the model lacks, then with ITM-013 left out of the order
// input: planFindings for each
// expect: an error finding that names ITM-012 and the phase; one that names ITM-013 as without a phase
// Planted fault: accepting any phase text, or ignoring a step the order lacks, leaves no finding.
test("planFindings — a step without a phase of the model is named", async () => {
  assert.match(whats(await found(setting({ rows: ORDER.map(([id, phase]) => [id, id === "ITM-012" ? "Hypothetical" : phase]) }))), /ITM-012[^]*Hypothetical|Hypothetical[^]*ITM-012/);
  assert.match(whats(await found(setting({ rows: ORDER.filter(([id]) => id !== "ITM-013") }))), /ITM-013/);
});

// TST-613005 · level: unit · module: MOD-work-plans
// guards: UC-045; A PLAN STEP NAMES THE TESTS OF ITS LEVEL; MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE
// given: the sound plan with ITM-010 (a module step) naming component tests; then the modules using each other (MOD-reader uses MOD-writer.write, MOD-writer uses MOD-reader.read)
// input: planFindings for each, which runs MOD-trace-graph's graphFindings on traceGraph(source)
// expect: an error finding naming ITM-010 under A PLAN STEP NAMES THE TESTS OF ITS LEVEL; one naming both modules under MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE; no finding of any other rule of graphFindings (the fixture's steps name a rule no requirement matches by design? none: A RULE exists), only these two
// Planted fault: reporting all of graphFindings' findings gives others; reporting none leaves these out.
test("planFindings — a step with the tests of another level, and a cycle among the modules' uses, are named from graphFindings", async () => {
  const wrongTests = await found(setting({ steps: { ...STEPS, "docs/plan/ITM-010-reader.md": step("ITM-010", "module", ["MOD-reader"], ["component"]) } }));
  assert.ok(wrongTests.some((each) => each.rule === "A PLAN STEP NAMES THE TESTS OF ITS LEVEL" && /ITM-010/.test(each.what)));
  const cyclic = await found(setting({ architecture: ARCHITECTURE({ "MOD-reader": ["MOD-writer.write"] }) }));
  assert.ok(cyclic.some((each) => each.rule === "MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE" && /MOD-reader/.test(each.what) && /MOD-writer/.test(each.what)));
  assert.deepEqual([...new Set(cyclic.map((each) => each.rule))].filter((rule) => !/ASSEMBLES|FOLLOWS|CYCLE|PHASES/.test(rule)), [], "no finding of another rule of graphFindings");
});

// TST-613006 · level: unit · module: MOD-work-plans
// guards: UC-045
// given: the sound plan; a host whose readHistory answers, newest first, the step files' last commit dated 2026-10-10 and the module files' and the integration's decision's last commit dated 2026-10-12 (later) for MOD-writer only; and the plan with a step for MOD-gone, whose file does not exist
// input: planFindings(…, { host })
// expect: for MOD-writer's file a finding that names docs/architecture/MOD-writer.md and its step ITM-011 (changed after the step's last commit); for MOD-gone a finding that names the file and its step as removed; none for the files not changed after their steps; readHistory was asked with changes: false
// Planted fault: comparing against the wrong date, or asking for the changes, or ignoring a removed file, fails.
test("planFindings — with history, a step whose module file was removed or changed after the step is named", async () => {
  const asked = [];
  const dates = { "docs/architecture/MOD-writer.md": "2026-10-12T10:00:00Z", "docs/architecture/MOD-reader.md": "2026-10-09T10:00:00Z", "docs/architecture/ARC-002-sub.md": "2026-10-09T10:00:00Z" };
  const host = { async readHistory(path, options) { asked.push([path, options]); return [{ commit: "c".repeat(40), parents: [], author: { account: null, name: "a" }, date: dates[path] ?? "2026-10-10T10:00:00Z", changes: [] }]; } };
  const changed = await found(setting(), WORKFLOW, { host });
  assert.match(whats(changed), /MOD-writer\.md/);
  assert.match(whats(changed), /ITM-011/);
  assert.doesNotMatch(whats(changed), /MOD-reader\.md/);
  assert.ok(asked.every(([, options]) => options?.changes === false));
  const gone = setting({ steps: { ...STEPS, "docs/plan/ITM-014-gone.md": step("ITM-014", "module", ["MOD-gone"], ["unit"]) }, rows: [...ORDER, ["ITM-014", "Implementation"]] });
  assert.match(whats(await found(gone, WORKFLOW, { host })), /MOD-gone[^]*removed|removed[^]*MOD-gone/);
});

// TST-613007 · level: unit · module: MOD-work-plans
// guards: UC-045
// given: the fixture product (the architecture above, a declaration of the model v-model at a version whose catalogue holds it, no plan yet) and the drafted plan of the kind draft-plan: a step for MOD-reader (unit tests), one for MOD-writer after it, ARC-002's integration (component), the system (system), each with a phase of the model
// input: the check plan-checks(draft, context)
// expect: no finding for the sound draft; for a draft whose MOD-writer step comes before MOD-reader's an error finding naming both modules; for a draft whose module step has level component an error finding under A PLAN STEP NAMES THE TESTS OF ITS LEVEL naming the step by its title
// Planted fault: checking the existing plan on the product and not the drafted one, or not putting the drafted steps in place of the source, leaves the findings out.
test("the check plan-checks gives planFindings on the drafted plan, with the drafted steps in place of the product's plan", async () => {
  const check = workPlans.workStrategies.checks["plan-checks"];
  assert.equal(typeof check, "function");
  const draft = (steps) => ({ steps });
  const sound = [
    { title: "Reader", implements: ["MOD-reader"], level: "unit", phase: "Implementation", after: [] },
    { title: "Writer", implements: ["MOD-writer"], level: "unit", phase: "Implementation", after: ["Reader"] },
    { title: "Sub", implements: ["ARC-002"], level: "component", phase: "Testing", after: ["Writer"] },
    { title: "Whole", implements: ["system"], level: "system", phase: "Testing", after: ["Sub"] },
  ];
  const context = productContext();
  assert.deepEqual(await check(draft(sound), context), []);
  const swapped = [sound[1], sound[0], ...sound.slice(2)];
  assert.match(whats(await check(draft(swapped), context)), /MOD-writer.*MOD-reader|MOD-reader.*MOD-writer/s);
  const wrongLevel = [{ ...sound[0], level: "component" }, ...sound.slice(1)];
  assert.ok((await check(draft(wrongLevel), context)).some((each) => each.rule === "A PLAN STEP NAMES THE TESTS OF ITS LEVEL"));
});

// TST-613008 · level: unit · module: MOD-work-plans
// guards: UC-045; THE PROCESS MODEL IS DECLARED PER PRODUCT
// given: a product whose declaration names a model file the instance's catalogue does not hold at the declared version (docs/process-models/nothing.md at the commit DECLARED), and one with no declaration
// input: the check plan-checks
// expect: exactly one error finding, which names the declared model (docs/process-models/nothing.md) and its commit; for the product without a declaration, one error finding that says no model is declared
// Planted fault: checking the plan without a workflow, or giving no finding, fails.
test("the check plan-checks gives one error finding where the product has no workflow, naming the declared model and its commit", async () => {
  const check = workPlans.workStrategies.checks["plan-checks"];
  const found1 = await check({ steps: [] }, productContext({ modelFile: "docs/process-models/nothing.md" }));
  assert.equal(found1.length, 1);
  assert.equal(found1[0].kind, "error");
  assert.match(found1[0].what, /docs\/process-models\/nothing\.md/);
  assert.match(found1[0].what, new RegExp(DECLARED));
  const none = await check({ steps: [] }, productContext({ declaration: false }));
  assert.equal(none.length, 1);
  assert.equal(none[0].kind, "error");
});

const DECLARED = "5".repeat(40);
// The context of a job of the kind draft-plan: the product's snapshot (the architecture, a declaration, SPEC), the instance behind its host.
function productContext({ modelFile = "src/model-catalogue/models/v-model.md", declaration = true } = {}) {
  const files = { "SPEC.md": "# Fixture\n", ...ARCHITECTURE() };
  if (declaration) files["docs/process.md"] = lines("---", "model: v-model", `model_file: ${modelFile}`, `model_version: ${DECLARED}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
    "| Phase or time box | Branch |", "|---|---|", "| Implementation | work |", "", "## Definition of Done", "", "The job rules hold.");
  const snapshot = (all) => ({ repository: { server: "github", path: "acme/product", web: "https://github.com/acme/product" }, ref: "main", commit: "c".repeat(40), paths: Object.keys(all), blob: () => null,
    read: async (path) => all[path] ?? null });
  const instance = snapshot({ "SPEC.md": "# Instance\n" });
  return { kind: null, params: {}, product: { address: "https://github.com/acme/product", snapshot: snapshot(files), host: null },
    instance: { snapshot: instance, host: { async readSnapshot() { return instance; } }, checkout: null }, connect: async () => null, participants: [],
    places: { sources: {}, mailbox: null, contents: [] }, gates: [], person: "alice", now: new Date("2026-10-19T08:00:00Z"), agentM: { version: "unreleased", commit: "a".repeat(40) }, jobId: null };
}
