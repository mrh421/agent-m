// The writer `plan-steps` of MOD-work-plans' `workStrategies` and `savePlan` (ITM-614; UC-045 steps 3 to 5), as the accepted text of docs/architecture/MOD-work-plans.md states them: "writer `plan-steps` — the
// drafted plan through `savePlan`, with the job's provenance lines", and "`savePlan(host, plan: { steps: Document[], order: Document, removed: string[] }, context: { architecture, workflow, head, trailers }) ->
// Promise<{ commit, written }>` — Save plan (UC-045): `planFindings` first, and with an error finding nothing is written; a new step gets an identifier that no history of `docs/plan/` and `docs/backlog/` holds;
// one commit of one file per step under `docs/plan/` and `docs/plan/order.md`, the files of removed steps deleted. `trailers` are a job's provenance lines, empty for a person's own input. Errors: `PlanRefused
// { findings }`, and the host's."
// Run: node --test tests/work-plans-plan-steps.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-045; THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY; A RUN FOLLOWS THE MODULES' INTERFACES; THE NAME IS THE ID AND IT SURVIVES; EVERY ARTIFACT NAMES ITS ORIGIN; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// Level: unit
//
// The product is a fixture in memory behind a host of this file's own, which keeps the commits it is given and answers readHistory with a commit that added a withdrawn item's file; nothing reaches the network. The
// draft is the answer of the kind `draft-plan` ({ steps: [{ title, implements, level, phase, after }] }). The readings where the text leaves one open, which the pull request names:
//   - As its sibling saveItems does, a step without an identifier is new; an order row, or an entry of a step's `builds_on`, that is no identifier but the title of a step of the plan becomes that step's identifier.
//   - The drafted plan is the whole plan, as plan-checks checks it: a drafted step whose title is that of a step of the existing plan keeps that step's identifier and file (THE NAME IS THE ID AND IT SURVIVES); a
//     step of the existing plan the draft no longer holds is removed.
//   - The item format requires `realises` (non-empty), `origin`, and `integrates` for the level subsystem, which the answer does not carry. A step realises what forces the part of the architecture it
//     implements: a module step the module's `realises` and the `forced_by` of the decisions it follows; a subsystem's integration its decision's `forced_by`; the system's step the `forced_by` of the decision
//     that states the system. `origin` is the same list, as for the writer backlog-items. `integrates` is the subsystem's decision. `## Outcome` names what the step implements or integrates, `## Acceptance` the
//     tests of its level, one bullet each (UC-045 step 5).
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { artifactSchemas, readDocument } from "../src/documents/index.mjs";
import { provenanceLines } from "../src/job-runner/index.mjs";
import * as workPlans from "../src/work-plans/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const ADDRESS = "https://github.com/acme/product";
const HEAD = "c".repeat(40);
const DECLARED = "5".repeat(40);
const writer = workPlans.workStrategies.writers?.["plan-steps"];

// ---------------------------------------------------------------- the fixture product

const decision = (id, extra) => lines("---", `id: ${id}`, `title: ${id} decision`, ...extra, "---", `# ${id} decision`, "", "## Context", "", "c", "", "## Decision", "", "d", "", "## Alternatives", "", "a", "",
  "## Consequences", "", "q");
const module_ = (id, uses = []) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-002", ...(uses.length ? ["uses:", ...uses.map((each) => `  - ${each}`)] : ["uses: []"]),
  "provides:", "  - read", "  - write", "---", `# ${id} ${id}`, "", "## Responsibility", "", "r", "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `read` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
const step = (id, title, level, modules, tests, extra = []) => lines("---", `id: ${id}`, `title: ${title}`, `level: ${level}`, "realises:", "  - A RULE", "modules:", ...modules.map((each) => `  - ${each}`), ...extra,
  "tests:", ...tests.map((each) => `  - ${each}`), "origin:", "  - A RULE", "---", `# ${id} ${title}`, "", "## Outcome", "", "o", "", "## Acceptance", "", "- a");
const order = (rows) => lines("## Order", "", "| Step | Phase |", "| --- | --- |", ...rows.map(([id, phase]) => `| ${id} | ${phase} |`));

// The system ARC-001, forced by UC-001; the subsystem ARC-002, forced by A RULE, designing MOD-reader and MOD-writer; MOD-writer uses MOD-reader's interface.
const ARCHITECTURE = {
  "docs/architecture/ARC-001-whole.md": decision("ARC-001", ["forced_by:", "  - UC-001"]),
  "docs/architecture/ARC-002-sub.md": decision("ARC-002", ["refines: ARC-001", "forced_by:", "  - A RULE", "designs:", "  - MOD-reader", "  - MOD-writer"]),
  "docs/architecture/MOD-reader.md": module_("MOD-reader"), "docs/architecture/MOD-writer.md": module_("MOD-writer", ["MOD-reader.read"]),
};
const BASE = {
  "SPEC.md": lines("# Fixture", "", "## 1. Rules", "", "**A RULE** *(Owner)*", "A rule.", "*Check:* no automatic check; at review."),
  ...ARCHITECTURE,
  "docs/process.md": lines("---", "model: v-model", "model_file: src/model-catalogue/models/v-model.md", `model_version: ${DECLARED}`, "---", "# Process", "", "## Practices", "", "- none", "", "## Branches", "",
    "| Phase or time box | Branch |", "|---|---|", "| Implementation | work |", "", "## Definition of Done", "", "The job rules hold."),
};
// An existing plan: the four steps of a sound plan and a fifth, "Old", a second step for MOD-reader.
const PLAN = {
  "docs/plan/ITM-010-reader.md": step("ITM-010", "Reader", "module", ["MOD-reader"], ["unit"]),
  "docs/plan/ITM-011-writer.md": step("ITM-011", "Writer", "module", ["MOD-writer"], ["unit"], ["builds_on:", "  - ITM-010"]),
  "docs/plan/ITM-012-sub.md": step("ITM-012", "Sub", "subsystem", ["MOD-reader", "MOD-writer"], ["component"], ["integrates: ARC-002"]),
  "docs/plan/ITM-013-whole.md": step("ITM-013", "Whole", "system", ["MOD-reader", "MOD-writer"], ["system", "release"]),
  "docs/plan/ITM-014-old.md": step("ITM-014", "Old", "module", ["MOD-reader"], ["unit"]),
  "docs/plan/order.md": order([["ITM-010", "Implementation"], ["ITM-014", "Implementation"], ["ITM-011", "Implementation"], ["ITM-012", "Testing"], ["ITM-013", "Testing"]]),
};
// The history holds a withdrawn item, ITM-1400 of docs/backlog/, higher than any file's.
const HISTORY = [{ commit: "h1", changes: [{ path: "docs/backlog/ITM-1400-withdrawn.md", from: null }] }];

// A host that keeps the commits and the questions it is asked.
function hostOf(files, history = HISTORY) {
  const commits = [], asked = [];
  const snapshot = { repository: { server: "github", path: "acme/product", web: ADDRESS }, ref: "main", paths: Object.keys(files), commit: HEAD, blob: () => null,
    read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) };
  const host = {
    async repositoryInfo() { return { defaultBranch: "main" }; },
    async readSnapshot(ref) { asked.push(["readSnapshot", ref]); return snapshot; },
    async readHistory(path, options) { asked.push(["readHistory", path, options]); return history; },
    async commitFiles(request) { commits.push(request); return { commit: "d".repeat(40), url: "u" }; },
  };
  return { host, snapshot, commits, asked };
}
const DRAFTER = { name: "plan-bot", model: "model-x" };
const JOB_ID = "JOB-20261101-0900-ab12";
function jobOf(steps, { files = BASE, history = HISTORY } = {}) {
  const setup = hostOf(files, history);
  const instance = { repository: { server: "github", path: "acme/instance", web: "https://github.com/acme/instance" }, ref: "main", commit: "i".repeat(40), paths: ["SPEC.md"], blob: () => null,
    read: async (path) => (path === "SPEC.md" ? "# Instance\n" : null) };
  const context = { kind: { name: "draft-plan" }, params: {}, jobId: JOB_ID, product: { address: ADDRESS, snapshot: setup.snapshot, host: setup.host },
    instance: { snapshot: instance, host: { async readSnapshot() { return instance; } }, checkout: null }, connect: async () => null, participants: [],
    places: { sources: {}, mailbox: null, contents: [] }, gates: [], agentM: { version: "unreleased", commit: "a".repeat(40) }, person: "alice", now: new Date("2026-11-01T08:00:00Z") };
  const result = { draft: { steps }, drafter: DRAFTER, rounds: [{ number: 1 }] };
  return { ...setup, context, result, write: () => {
    assert.equal(typeof writer, "function", "workStrategies offers the writer plan-steps");
    return writer(result, context);
  } };
}
const fileOf = (job, path) => job.commits[0].files.find((file) => file.path === path);
const stepOf = (job, path) => readDocument(artifactSchemas().item, path, fileOf(job, path).text);
const sectionText = (document, heading) => document.sections.find((section) => section.heading === heading)?.text.trim();
const rowsOf = (text) => readDocument(workPlans.planSchemas.planOrder, "docs/plan/order.md", text).sections.flatMap((section) => section.rows ?? []).map((row) => [row.cells.Step, row.cells.Phase]);

const SOUND = [
  { title: "Reader", implements: ["MOD-reader"], level: "unit", phase: "Implementation", after: [] },
  { title: "Writer", implements: ["MOD-writer"], level: "unit", phase: "Implementation", after: ["Reader"] },
  { title: "Sub", implements: ["ARC-002"], level: "component", phase: "Testing", after: ["Writer"] },
  { title: "Whole", implements: ["system"], level: "system", phase: "Testing", after: ["Sub"] },
];
const P = (id, slug) => `docs/plan/${id}-${slug}.md`;

// TST-614001 · level: unit · module: MOD-work-plans
// guards: UC-045; THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY; EVERY ARTIFACT NAMES ITS ORIGIN
// given: the fixture product (the system ARC-001 forced by UC-001, the subsystem ARC-002 forced by A RULE designing MOD-reader and MOD-writer, a declaration of the v-model, no plan) and the sound draft of four steps: Reader (MOD-reader, unit, Implementation), Writer (MOD-writer, unit, Implementation, after Reader), Sub (ARC-002, component, Testing, after Writer), Whole (system, system, Testing, after Sub)
// input: the writer plan-steps
// expect: one commit on the branch main at the snapshot's head, of five files in this order: docs/plan/ITM-1401-reader.md, ITM-1402-writer.md, ITM-1403-sub.md, ITM-1404-whole.md and docs/plan/order.md; the outcome names the commit, the same five paths, no pull request and nothing shown; Reader has level module, modules [MOD-reader], tests [unit], realises and origin [A RULE], no builds_on, the Outcome "Implements MOD-reader." and the Acceptance "- Unit tests."; Writer builds_on [ITM-1401]; Sub has level subsystem, integrates ARC-002, modules [MOD-reader, MOD-writer], tests [component], realises [A RULE], builds_on [ITM-1402]; Whole has level system, modules [MOD-reader, MOD-writer], tests [system, release], realises and origin [UC-001], builds_on [ITM-1403]; the order holds the rows ITM-1401 to ITM-1404 with the phases Implementation, Implementation, Testing, Testing
// Planted fault: committing on another head or branch, leaving a title in builds_on, or writing the order in another sequence changes the request.
test("the writer saves the drafted plan in one commit: one file per step under docs/plan/ and the order", async () => {
  const job = jobOf(SOUND);
  const outcome = await job.write();
  assert.equal(job.commits.length, 1);
  const [request] = job.commits;
  assert.deepEqual([request.branch, request.expectedHead], ["main", HEAD]);
  const paths = [P("ITM-1401", "reader"), P("ITM-1402", "writer"), P("ITM-1403", "sub"), P("ITM-1404", "whole"), "docs/plan/order.md"];
  assert.deepEqual(request.files.map((file) => file.path), paths);
  assert.deepEqual([outcome.commits, outcome.files, outcome.pullRequest, outcome.shown], [["d".repeat(40)], paths, null, null]);
  const reader = stepOf(job, paths[0]);
  assert.deepEqual([reader.id, reader.fields.title, reader.fields.level, reader.fields.modules, reader.fields.tests, reader.fields.realises, reader.fields.origin, reader.fields.builds_on ?? null],
    ["ITM-1401", "Reader", "module", ["MOD-reader"], ["unit"], ["A RULE"], ["A RULE"], null]);
  assert.deepEqual([sectionText(reader, "## Outcome"), sectionText(reader, "## Acceptance")], ["Implements MOD-reader.", "- Unit tests."]);
  assert.deepEqual(stepOf(job, paths[1]).fields.builds_on, ["ITM-1401"]);
  const sub = stepOf(job, paths[2]);
  assert.deepEqual([sub.fields.level, sub.fields.integrates, sub.fields.modules, sub.fields.tests, sub.fields.realises, sub.fields.builds_on],
    ["subsystem", "ARC-002", ["MOD-reader", "MOD-writer"], ["component"], ["A RULE"], ["ITM-1402"]]);
  const whole = stepOf(job, paths[3]);
  assert.deepEqual([whole.fields.level, whole.fields.modules, whole.fields.tests, whole.fields.realises, whole.fields.origin, whole.fields.builds_on],
    ["system", ["MOD-reader", "MOD-writer"], ["system", "release"], ["UC-001"], ["UC-001"], ["ITM-1403"]]);
  assert.deepEqual(rowsOf(fileOf(job, "docs/plan/order.md").text), [["ITM-1401", "Implementation"], ["ITM-1402", "Implementation"], ["ITM-1403", "Testing"], ["ITM-1404", "Testing"]]);
});

// TST-614002 · level: unit · module: MOD-work-plans
// guards: THE NAME IS THE ID AND IT SURVIVES; UC-045
// given: the fixture product, whose history holds a withdrawn ITM-1400 of docs/backlog/ that no file holds; the same product with an empty history
// input: the writer on the sound draft
// expect: the history was asked once, for the repository on the branch main, with its changes (path null, `changes` not switched off); the first new step is ITM-1401, one after the withdrawn ITM-1400; with an empty history it is ITM-001, the first of the kind
// Planted fault: taking the identifier from the head's paths alone gives ITM-001 for the first product.
test("a new step gets an identifier that no history of docs/plan/ and docs/backlog/ holds", async () => {
  const job = jobOf(SOUND);
  await job.write();
  assert.equal(job.commits[0].files[0].path, P("ITM-1401", "reader"));
  const asked = job.asked.filter(([what]) => what === "readHistory");
  assert.equal(asked.length, 1);
  assert.equal(asked[0][1], null);
  assert.equal(asked[0][2].ref, "main");
  assert.notEqual(asked[0][2].changes, false);
  const bare = jobOf(SOUND, { history: [] });
  await bare.write();
  assert.equal(bare.commits[0].files[0].path, P("ITM-001", "reader"));
});

// TST-614003 · level: unit · module: MOD-work-plans
// guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; UC-045
// given: the job JOB-20261101-0900-ab12 of the kind draft-plan, drafted by the participant plan-bot of model-x after one round, from Agent M's commit aaaa…, and the sound draft
// input: the writer
// expect: the commit's message begins "Save the plan" and ends with the provenance lines of provenanceLines for this job (version and commit, job, kind draft-plan, participant plan-bot, model model-x, 1 round); no file of the commit names the job, the participant or the model
// Planted fault: a message without the trailers, or trailers written into a step, changes the message or a file.
test("the commit carries the job's provenance lines, and the steps name none of them", async () => {
  const job = jobOf(SOUND);
  await job.write();
  const expected = provenanceLines({ agentM: job.context.agentM, jobId: JOB_ID, kind: "draft-plan", participant: DRAFTER, rounds: 1 });
  assert.ok(expected.length >= 6, "known positive: the lines exist");
  assert.match(job.commits[0].message, /^Save the plan/);
  assert.ok(job.commits[0].message.endsWith(expected.join("\n")), "the message ends with the provenance lines");
  assert.ok(job.commits[0].files.every((file) => !/plan-bot|model-x|JOB-2026/.test(file.text)));
});

// TST-614004 · level: unit · module: MOD-work-plans
// guards: UC-045; A RUN FOLLOWS THE MODULES' INTERFACES; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: the fixture product, and two drafts with an error finding of planFindings: the sound draft with Writer (MOD-writer, which uses MOD-reader's interface) ordered before Reader; the sound draft without the step Sub, the integration of ARC-002
// input: the writer on each
// expect: each is refused with PlanRefused, whose findings are error findings — the first names MOD-writer and MOD-reader, the second ARC-002 —, and nothing is committed (known positive: the sound draft commits, TST-614001)
// Planted fault: writing without planFindings, or only warning, commits the draft.
test("a drafted plan with an error finding of planFindings is refused with PlanRefused, and nothing is written", async () => {
  const refused = async (steps, named) => {
    const job = jobOf(steps);
    await assert.rejects(job.write(), (error) => error.name === "PlanRefused" && Array.isArray(error.findings) && error.findings.length >= 1
      && error.findings.every((each) => each.kind === "error") && named.test(error.findings.map((each) => each.what).join("\n")));
    assert.deepEqual(job.commits, []);
  };
  await refused([SOUND[1], { ...SOUND[0] }, ...SOUND.slice(2)], /MOD-writer[^]*MOD-reader|MOD-reader[^]*MOD-writer/);
  await refused([SOUND[0], SOUND[1], { ...SOUND[3], after: ["Writer"] }], /ARC-002/);
});

// TST-614005 · level: unit · module: MOD-work-plans
// guards: THE NAME IS THE ID AND IT SURVIVES; UC-045
// given: the fixture product with the existing plan ITM-010 Reader, ITM-011 Writer, ITM-012 Sub, ITM-013 Whole and ITM-014 Old (a second step of MOD-reader), and the sound draft, whose titles are those of ITM-010 to ITM-013
// input: the writer
// expect: one commit that writes docs/plan/ITM-010-reader.md, ITM-011-writer.md, ITM-012-sub.md, ITM-013-whole.md and docs/plan/order.md at their own paths, under their own identifiers, and deletes docs/plan/ITM-014-old.md (`delete: true`); Writer builds on ITM-010; the order holds ITM-010 to ITM-013; the outcome names the five written paths, not the deleted one
// Planted fault: giving the drafted steps new identifiers writes ITM-1401 and more; keeping ITM-014 leaves its file.
test("a drafted step keeps the identifier of the existing step of its title, and a step the draft no longer holds is removed", async () => {
  const job = jobOf(SOUND, { files: { ...BASE, ...PLAN } });
  const outcome = await job.write();
  const written = [P("ITM-010", "reader"), P("ITM-011", "writer"), P("ITM-012", "sub"), P("ITM-013", "whole"), "docs/plan/order.md"];
  assert.deepEqual(job.commits[0].files.map((file) => [file.path, file.delete === true]), [...written.map((path) => [path, false]), [P("ITM-014", "old"), true]]);
  assert.deepEqual(stepOf(job, written[1]).fields.builds_on, ["ITM-010"]);
  assert.deepEqual(rowsOf(fileOf(job, "docs/plan/order.md").text).map(([id]) => id), ["ITM-010", "ITM-011", "ITM-012", "ITM-013"]);
  assert.deepEqual(outcome.files, written);
});

// TST-614006 · level: unit · module: MOD-work-plans
// guards: UC-045; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; THE NAME IS THE ID AND IT SURVIVES
// given: the fixture product with the existing plan, and savePlan called as the page calls it for a person's own input: ITM-011 rewritten under its identifier with the Outcome "NEW OUTCOME"; a new system step "Whole again" without an identifier; ITM-013 and ITM-014 removed; an order that names the new step by its title; then a change that removes ITM-777, which the plan does not hold; then a change whose order leaves out ITM-012
// input: savePlan(host, { steps, order, removed }, { architecture, workflow, head, trailers: [] })
// expect: one commit with the message "Save the plan" and no trailer, of the files ITM-011's at its own path with NEW OUTCOME, the new step at docs/plan/ITM-1401-whole-again.md, docs/plan/order.md with ITM-1401 in the row of "Whole again", and the deletions of ITM-013's and ITM-014's files; the result names the commit and the three written paths; the change removing ITM-777 throws PlanRefused whose error finding names ITM-777; the order without ITM-012 throws PlanRefused whose finding names ITM-012; neither commits anything
// Planted fault: a rewrite under a new path, a deletion left out, or a title left in the order changes the files.
test("savePlan writes a person's change of the plan in one commit, and refuses one with an error finding", async () => {
  const files = { ...BASE, ...PLAN };
  const schemas = artifactSchemas();
  const architecture = Object.keys(ARCHITECTURE).map((path) => readDocument(/\/ARC-/.test(path) ? schemas.decision : schemas.module, path, files[path]));
  const workflow = { phases: [{ name: "Implementation" }, { name: "Testing" }], gates: [], model: { name: "v-model" } };
  const writerStep = readDocument(schemas.item, P("ITM-011", "writer"), files[P("ITM-011", "writer")]);
  const rewritten = { ...writerStep, sections: writerStep.sections.map((section) => (section.heading === "## Outcome" ? { ...section, text: "\nNEW OUTCOME\n\n" } : section)) };
  const fresh = { fields: { title: "Whole again", level: "system", realises: ["UC-001"], modules: ["MOD-reader", "MOD-writer"], builds_on: ["ITM-012"], tests: ["system", "release"], origin: ["UC-001"] },
    sections: [{ heading: "## Outcome", text: "\nThe system.\n\n" }, { heading: "## Acceptance", text: "\n- System tests.\n" }] };
  const orderOf = (rows) => ({ kind: "plan-order", path: "docs/plan/order.md", fields: {}, body: "", appended: [], sections: [{ heading: "## Order", text: "", rows: rows.map(([Step, Phase]) => ({ cells: { Step, Phase } })) }] });
  const ORDER = [["ITM-010", "Implementation"], ["ITM-011", "Implementation"], ["ITM-012", "Testing"], ["Whole again", "Testing"]];
  assert.equal(typeof workPlans.savePlan, "function", "MOD-work-plans provides savePlan");
  const setup = hostOf(files);
  const result = await workPlans.savePlan(setup.host, { steps: [rewritten, fresh], order: orderOf(ORDER), removed: ["ITM-013", "ITM-014"] }, { architecture, workflow, head: HEAD, trailers: [] });
  assert.equal(setup.commits.length, 1);
  const [request] = setup.commits;
  assert.equal(request.message, "Save the plan: Writer, Whole again");
  assert.deepEqual(request.files.map((file) => [file.path, file.delete === true]),
    [[P("ITM-011", "writer"), false], [P("ITM-1401", "whole-again"), false], ["docs/plan/order.md", false], [P("ITM-013", "whole"), true], [P("ITM-014", "old"), true]]);
  assert.match(request.files[0].text, /NEW OUTCOME/);
  assert.deepEqual(rowsOf(request.files[2].text), [["ITM-010", "Implementation"], ["ITM-011", "Implementation"], ["ITM-012", "Testing"], ["ITM-1401", "Testing"]]);
  assert.deepEqual([result.commit, result.written], ["d".repeat(40), [P("ITM-011", "writer"), P("ITM-1401", "whole-again"), "docs/plan/order.md"]]);

  const lacking = hostOf(files);
  await assert.rejects(workPlans.savePlan(lacking.host, { steps: [], order: orderOf(ORDER.slice(0, 3).concat([["ITM-013", "Testing"]])), removed: ["ITM-777"] }, { architecture, workflow, head: HEAD, trailers: [] }),
    (error) => error.name === "PlanRefused" && error.findings.some((each) => each.kind === "error" && /ITM-777/.test(each.what)));
  assert.deepEqual(lacking.commits, []);
  const unordered = hostOf(files);
  await assert.rejects(workPlans.savePlan(unordered.host, { steps: [rewritten], order: orderOf([["ITM-010", "Implementation"], ["ITM-014", "Implementation"], ["ITM-011", "Implementation"], ["ITM-013", "Testing"]]), removed: [] },
    { architecture, workflow, head: HEAD, trailers: [] }), (error) => error.name === "PlanRefused" && error.findings.some((each) => each.kind === "error" && /ITM-012/.test(each.what)));
  assert.deepEqual(unordered.commits, []);
});
