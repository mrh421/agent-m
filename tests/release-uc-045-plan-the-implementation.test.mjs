// Release tests of UC-045 Plan the implementation: one or more for each requirement UC-045 realises, each walked through the plan page as the planner reads it — the real routes `plan` and `implement` of MOD-implementation-pages
// over the real MOD-work-plans, MOD-job-runner, MOD-trace-graph and MOD-repository-hosts, behind the fakes of GitHub's API and of two model endpoints of tests/uc-045-harness.mjs — and against what the product's repository holds
// afterwards. The cases never read the code files. Two of the realised requirements are not guarded by a test of their own in the SPEC: ONE CLICK PER DECISION and EVERY STEP EXPLAINS ITSELF have a case here all the same.
// Run: node --test tests/release-uc-045-plan-the-implementation.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-work-plans
// Guards: UC-045; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES; A PLAN STEP NAMES THE TESTS OF ITS LEVEL; THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY; THE PROCESS MODEL IS DECLARED PER PRODUCT; THE MODEL DETERMINES THE PHASES AND THE GATES; EVERY TEST HAS ONE LEVEL; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; A RUN FOLLOWS THE MODULES' INTERFACES; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; EVERY ARTIFACT HAS AN IDENTIFIER; EVERY ARTIFACT NAMES ITS ORIGIN; A GENERATED ARTIFACT IS A PROPOSAL; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; DIAGRAMS ARE MERMAID IN MARKDOWN; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF
// Level: release
//
// Written by developer-sonnet-j (ITM-1061), who implemented none of ITM-614, ITM-1058 and ITM-1059 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER) and no UC-045 production behaviour.
// Where the page and UC-045 disagree the case follows UC-045 and is marked { todo } with the finding it reports; the findings of this file are those of tests/system-uc-045-plan-the-implementation.test.mjs (UC045-F1 to UC045-F4),
// which the system test marks, and this file reports none of its own: the plan whose system or integration steps stand before the steps they integrate (UC045-F3) is that file's TST-1061021. Readings the texts leave open, which the cases state:
//   - A PLAN STEP NAMES THE TESTS OF ITS LEVEL: the tests of a step are the levels its file names under `tests` — unit for a module, component for a subsystem, system and release for the system —; "with tests of another level" is a step whose tests are another's.
//   - EVERY TEST HAS ONE LEVEL: read for the plan as: every level a step names is one of unit, component, system and release, and a step that names another is refused.
//   - RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER: read for the plan page as: the plan's step of the system names the release tests of the use cases, and the page says that a participant other than the implementer writes them.
//   - THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY: "a plan written anywhere else is not found" is read as: the page shows no step of files under another folder of the product, nor of a plan in the instance's repository.
//   - A GENERATED ARTIFACT IS A PROPOSAL: the drafted plan is a proposal until the planner presses Save plan: it is on the page alone, and a page opened again shows no plan.
//   - ONE CLICK PER DECISION: the decisions of the main flow are Run and Save plan; each takes one click once its inputs are complete.
//   - EVERY STEP EXPLAINS ITSELF: a step that asks something of the planner is Draft the plan with its run panel, and Save plan; the explanation is "folded" when its details element is not open.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DRAFT, GATES, SCRUM_MODEL, STORE, architecture, boxes, buttons, choose, classed, drafting, found, handPlan, instanceFiles, openPlan, plain, planFiles, planWrites, planned, pr, refused, run,
  saved, savePlan, quiet, stepsOf, textOf, titles, waitFor, walk, without, lines, ORDER_PATH } from "./uc-045-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-045-plan-the-implementation.md";
const SELF = "tests/release-uc-045-plan-the-implementation.test.mjs";
const S = Object.fromEntries(DRAFT.steps.map((step) => [step.title, step]));
const hrefs = (page) => walk(page.target, (node) => node.localName === "a").map((link) => link.getAttribute("href"));
const drafted = async (files, ...answers) => { const made = await drafting({ files }, ...answers); await run(made.page); return made; };
/** The files a commit wrote, by path. */
const filesOf = (page) => Object.assign({}, ...planWrites(page).map((write) => write.files));
/** The tests a step file names under `tests`. */
const testsOf = (text) => (/^tests:\n((?:  - .*\n)+)/m.exec(text)?.[1] ?? "").split("\n").filter(Boolean).map((line) => line.slice(4));
const stepFiles = (files) => Object.entries(files).filter(([path]) => path !== ORDER_PATH);

// ---------------------------------------------------------------- the requirements UC-045 realises

// The requirements UC-045 realises, each with the case of this file that guards it.
const CASES = {
  "A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN": "TST-1061101",
  "AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES": "TST-1061102",
  "A PLAN STEP NAMES THE TESTS OF ITS LEVEL": "TST-1061103",
  "THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY": "TST-1061104",
  "THE PROCESS MODEL IS DECLARED PER PRODUCT": "TST-1061105",
  "THE MODEL DETERMINES THE PHASES AND THE GATES": "TST-1061106",
  "EVERY TEST HAS ONE LEVEL": "TST-1061107",
  "RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER": "TST-1061108",
  "A RUN FOLLOWS THE MODULES' INTERFACES": "TST-1061109",
  "PROGRESS AND JOB STATE ARE DERIVED, NOT STORED": "TST-1061110",
  "EVERY ARTIFACT HAS AN IDENTIFIER": "TST-1061111",
  "EVERY ARTIFACT NAMES ITS ORIGIN": "TST-1061112",
  "A GENERATED ARTIFACT IS A PROPOSAL": "TST-1061113",
  "A PERSON'S OWN INPUT IS COMMITTED DIRECTLY": "TST-1061114",
  "A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT": "TST-1061115",
  "DIAGRAMS ARE MERMAID IN MARKDOWN": "TST-1061116",
  "THE PAGE NAMES WHERE IT SENDS": "TST-1061117",
  "ONE CLICK PER DECISION": "TST-1061118",
  "EVERY STEP EXPLAINS ITSELF": "TST-1061119",
};

// TST-1061100 · level: release · module: system
// guards: UC-045
// given: UC-045 as committed text and this file
// input: compare the requirements UC-045 realises with the cases of this file
// expect: UC-045 realises these nineteen requirements, known positive; each has a case in this file whose guards name it
test("TST-1061100: every requirement UC-045 realises has a release test", () => {
  const realised = [...(/^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "").matchAll(/^  - (.*)$/gm)].map((m) => m[1]);
  assert.equal(realised.length, 19, "known positive: UC-045 realises nineteen requirements");
  assert.deepEqual(realised.filter((name) => !(name in CASES)), [], "each requirement has a case");
  const self = read(SELF);
  for (const [name, id] of Object.entries(CASES)) {
    const block = new RegExp(`// ${id} · level: release · module: system\\n// guards: ([^\\n]*)\\n`).exec(self);
    assert.ok(block, `${id} stands in this file`);
    assert.ok(block[1].split("; ").includes(name), `${id} guards ${name}`);
  }
});

// ---------------------------------------------------------------- THE WORK AND ITS ORDER

// TST-1061101 · level: release · module: system
// guards: UC-045; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN
// given: the planned product with the plan of six steps and the gates Requirements → Design and Design → Implementation passed; the same product without gate records; the same product without a plan
// input: the planner opens Implement for each
// expect: with the gates passed the page lists the six steps of the plan and no other work, and offers a participant for the steps that are ready, ITM-101 and ITM-103, and Start jobs; without the gate records it offers no participant, says "0 steps selected" and names the gate Design → Implementation and its decider; without a plan it says there is nothing to start, links to Plan and offers no Start jobs
test("TST-1061101: UC-045 a planned model's jobs start for the steps of the plan only", async () => {
  const gated = await openPlan("implement", {}, { files: await planned({ files: GATES }) });
  try {
    const said = plain(gated.html());
    assert.deepEqual([...said.matchAll(/\b(ITM-\d{3}) (?:Implementation|Testing) /g)].map((m) => m[1]), ["ITM-101", "ITM-102", "ITM-103", "ITM-104", "ITM-105", "ITM-106"], "the steps of the plan and no other work");
    assert.deepEqual([...said.matchAll(/\b(ITM-\d{3}) Participant/g)].map((m) => m[1]), ["ITM-101", "ITM-103"], "known positive: the steps that are ready are offered");
    assert.equal(buttons(gated.target, "Start jobs").length, 1, "Start jobs is offered");
  } finally { gated.done(); }
  const waiting = await openPlan("implement", {}, { files: await planned() });
  try {
    const said = plain(waiting.html());
    assert.deepEqual([...said.matchAll(/\b(ITM-\d{3}) Participant/g)], [], "no step is offered");
    assert.match(said, /0 steps selected/, "no step is selected for a job");
    assert.match(said, /Design → Implementation, decided by Reviewer/);
  } finally { waiting.done(); }
  const bare = await openPlan("implement", {}, { files: await planned({ plan: false, files: GATES }) });
  try {
    assert.match(plain(bare.html()), /no implementation plan yet, so there is nothing to start/);
    assert.ok(hrefs(bare).includes("#plan"));
    assert.equal(buttons(bare.target, "Start jobs").length, 0);
  } finally { bare.done(); }
});

// TST-1061102 · level: release · module: system
// guards: UC-045; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: the planned product (the subsystems ARC-002 designing MOD-store and MOD-pages, ARC-003 designing MOD-mail; MOD-pages uses MOD-store.read) without a plan; the planner's plans written by hand; known positive: the plan in the order of the interfaces
// input: the planner saves the complete plan; the plan without the step of MOD-mail; without the integration of ARC-002; without the system; with MOD-pages before MOD-store
// expect: the complete plan is committed; each of the others is refused, nothing is written, and the gap is named: "MOD-mail has no step", "the subsystem ARC-002 has no step for its integration", "the system (ARC-001) has no step", "MOD-pages is ordered before MOD-store, whose interface it uses"; each finding names the rule AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES or A RUN FOLLOWS THE MODULES' INTERFACES
test("TST-1061102: UC-045 a plan that leaves a module, a subsystem or the system without a step is refused and the gap named; a plan in the order of the interfaces is accepted", async () => {
  const good = await handPlan(DRAFT.steps);
  try { assert.equal(planWrites(good).length, 1, `known positive: ${saved(good)}`); } finally { good.done(); }
  const cases = [[without("Mail"), "MOD-mail has no step", "AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES"],
    [without("Storage"), "the subsystem ARC-002 has no step for its integration", "AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES"],
    [without("Whole"), "the system (ARC-001) has no step", "AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES"],
    [{ steps: [S.Pages, S.Store, S.Mail, S.Storage, S.Mailing, S.Whole].map((step) => ({ ...step, after: [] })) }, "MOD-pages is ordered before MOD-store, whose interface it uses", "A RUN FOLLOWS THE MODULES' INTERFACES"]];
  for (const [draft, gap, rule] of cases) {
    const page = await handPlan(draft.steps);
    try {
      assert.deepEqual(planWrites(page), [], `${gap}: nothing is written`);
      assert.ok(saved(page).includes(gap), `${gap}: the gap is named`);
      assert.ok(saved(page).includes(`[${rule}]`), `${gap}: the rule is named`);
    } finally { page.done(); }
  }
});

// TST-1061103 · level: release · module: system
// guards: UC-045; A PLAN STEP NAMES THE TESTS OF ITS LEVEL
// given: the planned product without a plan; the planner's plans written by hand; known positive: the complete plan
// input: the planner saves the complete plan; the plan in which the step of the module MOD-store names the tests of the level component; the plan in which the integration of ARC-002 names the tests of the level unit
// expect: the complete plan is committed, its step of a module naming unit tests, a subsystem's component tests and the system's system tests and release tests; each of the other two is refused, nothing is written, and the finding names the step, its level and the tests of another level — "is of level module and names tests of another level: component", "is of level subsystem and names tests of another level: unit" — and the tests of its level, "name the tests of level module: unit" and "of level subsystem: component"
test("TST-1061103: UC-045 a step names the tests of its level: a step with the tests of another level is refused, a step with the tests of its level is accepted", async () => {
  const good = await handPlan(DRAFT.steps);
  try {
    assert.equal(planWrites(good).length, 1, `known positive: ${saved(good)}`);
    const steps = stepFiles(filesOf(good));
    const by = (slug) => steps.find(([path]) => path.endsWith(`-${slug}.md`))[1];
    assert.deepEqual([testsOf(by("store")), testsOf(by("pages")), testsOf(by("mail")), testsOf(by("storage")), testsOf(by("mailing")), testsOf(by("whole"))],
      [["unit"], ["unit"], ["unit"], ["component"], ["component"], ["system", "release"]]);
  } finally { good.done(); }
  for (const [title, level, said] of [["Store", "component", /is of level module and names tests of another level: component[^]*name the tests of level module: unit/], ["Storage", "unit", /is of level subsystem and names tests of another level: unit[^]*name the tests of level subsystem: component/]]) {
    const page = await handPlan(DRAFT.steps.map((step) => (step.title === title ? { ...step, level } : step)));
    try {
      assert.deepEqual(planWrites(page), [], `${title}: nothing is written`);
      assert.match(saved(page), said);
      assert.match(saved(page), /\[A PLAN STEP NAMES THE TESTS OF ITS LEVEL\]/);
    } finally { page.done(); }
  }
});

// ---------------------------------------------------------------- WHERE THE PLAN LIVES AND WHAT DECLARES IT

// TST-1061104 · level: release · module: system
// guards: UC-045; THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY
// given: the plan of six steps under docs/plan/ of the product; the same files under docs/planning/; the same files under docs/plan/ of the instance's repository, the product holding none
// input: the planner opens Plan for each; then saves a plan written by hand
// expect: known positive — the plan under docs/plan/ of the product shows its six steps; the plan under docs/planning/ shows no step and says no plan is saved yet; the plan in the instance's repository shows none either; a saved plan is committed to the product's repository, every file under docs/plan/, and the instance's repository receives no commit
test("TST-1061104: UC-045 the plan is read from docs/plan/ of the product's repository and written there; a plan kept anywhere else is not found", async () => {
  const under = await openPlan("plan", {}, { files: await planned() });
  try { assert.equal(stepsOf(under).length, 6, "known positive: docs/plan/ of the product"); } finally { under.done(); }
  const moved = Object.fromEntries(Object.entries(planFiles()).map(([path, text]) => [path.replace("docs/plan/", "docs/planning/"), text]));
  const elsewhere = await openPlan("plan", {}, { files: await planned({ plan: false, files: moved }) });
  try {
    assert.equal(stepsOf(elsewhere).length, 0);
    assert.match(plain(elsewhere.html()), /No plan is saved yet/);
  } finally { elsewhere.done(); }
  const instance = await openPlan("plan", {}, { files: await planned({ plan: false }), instance: { ...instanceFiles(), ...planFiles() } });
  try {
    assert.equal(stepsOf(instance).length, 0, "a plan of the instance's repository is not the product's");
    assert.match(plain(instance.html()), /No plan is saved yet/);
  } finally { instance.done(); }
  const page = await handPlan(DRAFT.steps);
  try {
    const written = planWrites(page);
    assert.equal(written.length, 1, saved(page));
    assert.ok(Object.keys(written[0].files).every((path) => path.startsWith("docs/plan/")), "every file under docs/plan/");
    assert.deepEqual(page.log.filter((request) => request.repository !== "alice/thesis-tool"), [], "the instance's repository receives no write");
    assert.ok(page.log.length > 0, "known positive: the product's repository receives the writes");
  } finally { page.done(); }
});

// TST-1061105 · level: release · module: system
// guards: UC-045; THE PROCESS MODEL IS DECLARED PER PRODUCT
// given: the planned product; the same product without docs/process.md; the same product declaring a Scrum model, which works from a backlog
// input: the planner opens Plan for each
// expect: known positive — the product declaring the V-model draws its plan and offers Draft the plan; the product without a declaration says no process model is declared, links to the declaration (#process), draws no step, no architecture and no Draft the plan, so Agent M assumes no default; the Scrum product says its model works from a backlog and links to the backlog (#backlog)
test("TST-1061105: UC-045 the plan page follows the model the product declares and assumes no default", async () => {
  const declared = await openPlan("plan", {}, { files: await planned() });
  try {
    assert.equal(stepsOf(declared).length, 6, "known positive");
    assert.equal(found(declared.target, "[data-draft-plan]").length, 1);
  } finally { declared.done(); }
  const none = await openPlan("plan", {}, { files: await planned({ declare: false }) });
  try {
    assert.match(plain(none.html()), /No process model is declared for this product, so there is no plan to show/);
    assert.ok(hrefs(none).includes("#process"));
    assert.equal(stepsOf(none).length + found(none.target, "[data-architecture]").length + found(none.target, "[data-draft-plan]").length, 0);
  } finally { none.done(); }
  const scrum = await openPlan("plan", {}, { files: await planned(), instance: instanceFiles({ model: SCRUM_MODEL }) });
  try {
    assert.match(plain(scrum.html()), /works from a backlog and has no implementation plan/);
    assert.ok(hrefs(scrum).includes("#backlog"));
    assert.equal(stepsOf(scrum).length, 0);
  } finally { scrum.done(); }
});

// TST-1061106 · level: release · module: system
// guards: UC-045; THE MODEL DETERMINES THE PHASES AND THE GATES
// given: the planned product (the V-model: the phases Concept, Requirements, Design, Implementation, Testing, Validation & Verification and Operation & Maintenance; the gate Design → Implementation, decided by the Reviewer); the plan of six steps, with and without the two gate records; the planner's plan written by hand with the step Store in the phase Dreaming
// input: the planner opens Plan; the planner saves the plan with the phase Dreaming
// expect: without the gate records the step ITM-101 of the phase Implementation is waiting for the gate Design → Implementation, decided by Reviewer, and says that gate is not reached; with both records ITM-101 and ITM-103 are ready; the phase Dreaming is refused, nothing is written, and the finding names the phases of the model, "Concept, Requirements, Design, Implementation, Testing, Validation & Verification, Operation & Maintenance"
test("TST-1061106: UC-045 each step belongs to a phase of the model, and the model's gates stand between the phases", async () => {
  const closed = await openPlan("plan", {}, { files: await planned() });
  try {
    const [first] = stepsOf(closed);
    assert.equal(first.state, "waiting");
    assert.match(first.waits, /Design → Implementation, decided by Reviewer \(not reached/);
  } finally { closed.done(); }
  const open = await openPlan("plan", {}, { files: await planned({ files: GATES }) });
  try { assert.deepEqual(stepsOf(open).filter((step) => step.state === "ready").map((step) => step.id), ["ITM-101", "ITM-103"]); } finally { open.done(); }
  const page = await handPlan(DRAFT.steps.map((step) => (step.title === "Store" ? { ...step, phase: "Dreaming" } : step)));
  try {
    assert.deepEqual(planWrites(page), []);
    assert.match(saved(page), /is in the phase Dreaming, which the model lacks/);
    assert.ok(saved(page).includes("Concept, Requirements, Design, Implementation, Testing, Validation & Verification, Operation & Maintenance"), "the phases of the model are named");
  } finally { page.done(); }
});

// TST-1061107 · level: release · module: system
// guards: UC-045; EVERY TEST HAS ONE LEVEL
// given: the planned product without a plan; the planner's plans written by hand; known positive: the complete plan
// input: the planner saves the complete plan; the plan in which the step Store names the tests of the level integration, a level that is none of unit, component, system and release
// expect: every level that the steps of the committed plan name is one of unit, component, system and release, and all four are named; the plan with the level integration is refused, nothing is written, and the page names the level, integration, and the levels there are, "unit, component, system, release"
test("TST-1061107: UC-045 the tests a step names are of the levels unit, component, system and release; another level is refused", async () => {
  const good = await handPlan(DRAFT.steps);
  try {
    assert.equal(planWrites(good).length, 1, `known positive: ${saved(good)}`);
    const named = new Set(stepFiles(filesOf(good)).flatMap(([, text]) => testsOf(text)));
    assert.deepEqual([...named].sort(), ["component", "release", "system", "unit"]);
  } finally { good.done(); }
  const page = await handPlan(DRAFT.steps.map((step) => (step.title === "Store" ? { ...step, level: "integration" } : step)));
  try {
    assert.deepEqual(planWrites(page), [], "nothing is written");
    assert.match(saved(page), /The plan is not saved[^]*"integration" is not one of unit, component, system, release/);
  } finally { page.done(); }
});

// TST-1061108 · level: release · module: system
// guards: UC-045; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
// given: the planned product with the plan of six steps; the planner's complete plan written by hand
// input: the planner opens Plan and unfolds What is this?; the planner saves the plan
// expect: the explanation says that the step of the system has "system tests, and the release tests of the use cases, written by a participant other than the implementer"; the step of the system in the committed plan names the release tests, beside its system tests, under its Acceptance ("- System tests.", "- Release tests.")
test("TST-1061108: UC-045 the step of the system names the release tests, which a participant other than the implementer writes", async () => {
  const plan = await openPlan("plan", {}, { files: await planned() });
  try {
    const explanation = walk(found(plan.target, "[data-plan-explain]")[0], (node) => node.localName === "details")[0];
    assert.match(textOf(explanation), /system tests, and the release tests of the use cases, written by a participant other than the implementer/);
  } finally { plan.done(); }
  const page = await handPlan(DRAFT.steps);
  try {
    const [, whole] = stepFiles(filesOf(page)).find(([path]) => path.endsWith("-whole.md"));
    assert.deepEqual(testsOf(whole), ["system", "release"]);
    assert.match(whole, /## Acceptance\n\n- System tests\.\n- Release tests\.\n/);
  } finally { page.done(); }
});

// TST-1061109 · level: release · module: system
// guards: UC-045; A RUN FOLLOWS THE MODULES' INTERFACES
// given: the planned product without a plan; a draft, drafted by local-llm, in which Pages stands before Store; the product in which MOD-store uses MOD-pages.read and MOD-pages uses MOD-store.read
// input: the planner moves Pages up before Store in the correct draft; the planner saves a plan of that product
// expect: the move is refused, naming "MOD-pages is ordered before MOD-store, whose interface it uses", and the order stays; for the product in which the modules use each other, the plan is refused, nothing is written, and the finding names the modules of the cycle, "the uses of MOD-pages, MOD-store form a cycle"
test("TST-1061109: UC-045 a module is planned after every module whose interface it uses; a cycle is named", async () => {
  const { page } = await drafted(await planned({ plan: false }), DRAFT);
  try {
    const box = (title) => found(page.target, "[data-draft-step]").find((each) => walk(each, (node) => node.getAttribute("data-step-field") === "title")[0].value === title);
    await page.press(walk(box("Pages"), (node) => node.getAttribute("data-step-up") !== null)[0]);
    assert.deepEqual(titles(page).slice(0, 3), ["Store", "Pages", "Mail"], "the order stays");
    assert.ok(refused(page).some((line) => line.includes("MOD-pages is ordered before MOD-store, whose interface it uses")));
  } finally { page.done(); }
  const files = await planned({ plan: false, files: architecture({ uses: { "MOD-store": ["MOD-pages.read"], "MOD-pages": ["MOD-store.read"] } }) });
  const cyclic = await handPlan(DRAFT.steps, files);
  try {
    assert.deepEqual(planWrites(cyclic), []);
    assert.match(saved(cyclic), /the uses of MOD-pages, MOD-store form a cycle/);
  } finally { cyclic.done(); }
});

// ---------------------------------------------------------------- WHAT THE PLAN STORES AND NAMES

// TST-1061110 · level: release · module: system
// guards: UC-045; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the planned product with the plan of six steps and the gates passed; the pull request 1 of ITM-101 open, then merged; the browser's store empty, then holding the endpoints
// input: the planner opens Plan with the pull request open, with it merged, and again with the browser's store changed
// expect: no step file holds a state or a status; with the pull request open ITM-101 is in progress and ITM-102 waits for an item it builds on; with it merged ITM-101 is done and ITM-102 ready, and no commit was made between; the states are the same with another browser store
test("TST-1061110: UC-045 a step's state is derived from the job records and the pull requests, and stored nowhere", async () => {
  const files = await planned({ files: GATES });
  for (const [path, text] of Object.entries(files)) if (path.startsWith("docs/plan/")) assert.doesNotMatch(text, /^(state|status):/m, `${path} holds no state`);
  const open = [pr(1, "ITM-101", "open", "2026-10-21T12:00:00Z")];
  const merged = [pr(1, "ITM-101", "merged", "2026-10-21T12:00:00Z", "2026-10-22T10:00:00Z")];
  const states = (page) => Object.fromEntries(stepsOf(page).map((step) => [step.id, step.state]));
  const seen = [];
  for (const [pullRequests, store] of [[open, {}], [merged, {}], [open, STORE]]) {
    const page = await openPlan("plan", {}, { files, pullRequests, store });
    try { seen.push({ states: states(page), writes: page.srv.writes }); } finally { page.done(); }
  }
  assert.deepEqual([seen[0].states["ITM-101"], seen[0].states["ITM-102"]], ["in progress", "waiting for an item it builds on"]);
  assert.deepEqual([seen[1].states["ITM-101"], seen[1].states["ITM-102"]], ["done", "ready"]);
  assert.deepEqual(seen[2].states, seen[0].states, "the same states with another browser store");
  assert.deepEqual(seen.flatMap((each) => each.writes), [], "no commit makes the difference");
});

// TST-1061111 · level: release · module: system
// guards: UC-045; EVERY ARTIFACT HAS AN IDENTIFIER
// given: the planned product with the plan of five steps ITM-101 to ITM-105, the system's step not among them, and a backlog item ITM-120; the planner's plan of one step Whole, the system's, added by hand; the product without a plan and with the backlog item ITM-120, the six steps written by hand
// input: the planner saves each plan
// expect: the added step is ITM-121, an identifier no file of docs/plan/ or docs/backlog/ holds, and it is the last row of the order; the six steps of the second plan carry ITM-121 to ITM-126, each in its file name, its front matter `id` and the order, none twice
test("TST-1061111: UC-045 each step carries an identifier of its own, one that no step or item holds", async () => {
  const item = { "docs/backlog/ITM-120-an-item.md": lines("---", "id: ITM-120", "title: An item", "level: module", "realises:", "  - RULE ONE", "modules:", "  - MOD-store", "builds_on: []", "tests:", "  - unit", "origin:", "  - the Product Owner", "---", "# ITM-120 An item") };
  const appended = await handPlan([{ ...S.Whole, after: ["ITM-104", "ITM-105"] }], await planned({ plan: false, files: { ...planFiles({ which: [101, 102, 103, 104, 105] }), ...item } }));
  try {
    const written = filesOf(appended);
    assert.deepEqual(Object.keys(written).filter((path) => path !== ORDER_PATH), ["docs/plan/ITM-121-whole.md"]);
    assert.match(written["docs/plan/ITM-121-whole.md"], /^---\nid: ITM-121\n/);
    assert.match(written[ORDER_PATH], /\| ITM-105 \| Testing \|\n\| ITM-121 \| Testing \|\n$/);
  } finally { appended.done(); }
  const page = await handPlan(DRAFT.steps, await planned({ plan: false, files: item }));
  try {
    const written = filesOf(page);
    const ids = stepFiles(written).map(([path, text]) => [/ITM-\d{3}/.exec(path)[0], /^id: (ITM-\d{3})$/m.exec(text)[1]]);
    assert.deepEqual(ids.map(([fromPath]) => fromPath), ["ITM-121", "ITM-122", "ITM-123", "ITM-124", "ITM-125", "ITM-126"]);
    assert.ok(ids.every(([fromPath, fromFile]) => fromPath === fromFile), "the file name and the front matter agree");
    assert.deepEqual([...written[ORDER_PATH].matchAll(/^\| (ITM-\d{3}) \|/gm)].map((m) => m[1]), ids.map(([id]) => id), "the order names them");
  } finally { page.done(); }
});

// TST-1061112 · level: release · module: system
// guards: UC-045; EVERY ARTIFACT NAMES ITS ORIGIN
// given: the planned product, whose use case UC-001 is accepted and forces its architecture; the planner's complete plan written by hand; the same plan drafted by local-llm
// input: the planner saves each
// expect: every step file of each commit names its origin, a list that is not empty, holds the use case UC-001 and names only artifacts the product holds — UC-001 (docs/use-cases/UC-001-load.md) and the requirement RULE ONE of its SPEC —, and names the same under `realises`
test("TST-1061112: UC-045 every step names the artifacts it descends from", async () => {
  const product = await planned({ plan: false });
  assert.ok("docs/use-cases/UC-001-load.md" in product && product["SPEC.md"].includes("**RULE ONE**"), "known positive: the product holds UC-001 and RULE ONE");
  const listOf = (text, key) => (new RegExp(`^${key}:\\n((?:  - .*\\n)+)`, "m").exec(text)?.[1] ?? "").split("\n").filter(Boolean).map((line) => line.slice(4));
  const check = (page) => {
    const steps = stepFiles(filesOf(page));
    assert.equal(steps.length, 6, saved(page));
    for (const [path, text] of steps) {
      const origin = listOf(text, "origin");
      assert.ok(origin.length > 0 && origin.includes("UC-001"), `${path} names its origin`);
      assert.deepEqual(origin.filter((name) => name !== "UC-001" && name !== "RULE ONE"), [], `${path} names only artifacts the product holds`);
      assert.deepEqual(listOf(text, "realises"), origin, `${path} realises what it descends from`);
    }
  };
  const byHand = await handPlan(DRAFT.steps, product);
  try { check(byHand); } finally { byHand.done(); }
  const { page } = await drafted(await planned({ plan: false }), DRAFT);
  try {
    await page.press(savePlan(page));
    await waitFor(() => planWrites(page).length > 0);
    check(page);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- PROPOSAL AND OWN INPUT

// TST-1061113 · level: release · module: system
// guards: UC-045; A GENERATED ARTIFACT IS A PROPOSAL
// given: the planned product without a plan; local-llm drafts the plan
// input: the planner presses Draft the plan and Run; the plan page is opened again without a Save plan; then the planner presses Save plan and the plan page is opened over what the product now holds
// expect: after Run the draft is on the page alone — nothing is written to the product or the instance except the job's record under docs/jobs/ —; the page opened again shows no step and says no plan is saved yet; after Save plan the plan page shows the six steps
test("TST-1061113: UC-045 a drafted plan is a proposal until the planner saves it", async () => {
  const files = await planned({ plan: false });
  const { page, asked } = await drafted(files, DRAFT);
  try {
    assert.equal(asked.length, 1);
    assert.equal(boxes(page).length, 6, "the draft is on the page");
    await quiet();
    assert.deepEqual(planWrites(page), [], "nothing is written under docs/plan/");
    assert.deepEqual(page.srv.writes.flatMap((write) => Object.keys(write.files)).filter((path) => !path.startsWith("docs/jobs/")), [], "and nothing but the job's record");
    const reopened = await openPlan("plan", {}, { files: { ...page.srv.files } });
    try {
      assert.equal(stepsOf(reopened).length, 0, "opened again, the page shows no plan");
      assert.match(plain(reopened.html()), /No plan is saved yet/);
    } finally { reopened.done(); }
    await page.press(savePlan(page));
    await waitFor(() => planWrites(page).length > 0);
    const after = await openPlan("plan", {}, { files: { ...page.srv.files } });
    try { assert.equal(stepsOf(after).length, 6, "after Save plan the page shows the plan"); } finally { after.done(); }
  } finally { page.done(); }
});


// TST-1061114 · level: release · module: system
// guards: UC-045; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the planned product without a plan; the planner's token for the product stored
// input: the planner writes the plan by hand with + Step and presses Save plan; the same plan is drafted by local-llm and saved
// expect: the plan written by hand is committed to the default branch directly — a tree, a commit and the move of the branch, no branch, no pull request —, every request that writes carries the product's token, and the commit carries no provenance line; the drafted plan's commit, beside it, carries the job's provenance lines
test("TST-1061114: UC-045 a plan written by hand is the planner's own input and is committed directly", async () => {
  const page = await handPlan(DRAFT.steps);
  try {
    const writes = page.log.filter((request) => request.repository === "alice/thesis-tool");
    assert.deepEqual(writes.map((request) => `${request.method} ${request.path.replace("/repos/alice/thesis-tool", "")}`), ["POST /git/trees", "POST /git/commits", "PATCH /git/refs/heads/main"], "directly on the default branch");
    assert.deepEqual(page.created, [], "no branch");
    assert.equal(new Set(writes.map((request) => request.authorization)).size, 1);
    assert.match(writes[0].authorization, /^Bearer github_pat_/, "with the planner's token");
    assert.doesNotMatch(planWrites(page)[0].message, /^Agent-M-/m, "no provenance line");
  } finally { page.done(); }
  const { page: drafted_ } = await drafted(await planned({ plan: false }), DRAFT);
  try {
    await drafted_.press(savePlan(drafted_));
    await waitFor(() => planWrites(drafted_).length > 0);
    assert.match(planWrites(drafted_)[0].message, /^Agent-M-Participant: local-llm$/m, "beside it, a drafted plan carries the provenance of its job");
  } finally { drafted_.done(); }
});

// TST-1061115 · level: release · module: system
// guards: UC-045; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: the planned product without a plan; local-llm answers first a draft without the step of MOD-mail and then the complete draft; again a participant that answers the draft without that step every time
// input: the planner presses Draft the plan and Run, for each
// expect: the first participant is asked again with the finding "MOD-mail has no step" and the planner sees the six steps of the corrected draft, with no finding; the participant that never corrects is asked twice, no more, and the planner sees its five steps with the finding left, and the rounds, "correction rounds: 2"
test("TST-1061115: UC-045 a draft that fails a check goes back to its participant before the planner sees it", async () => {
  const fixed = await drafted(await planned({ plan: false }), without("Mail"), DRAFT);
  try {
    assert.equal(fixed.asked.length, 2);
    assert.ok(JSON.stringify(fixed.asked[1].body).includes("MOD-mail has no step"), "the finding goes back with the draft");
    assert.equal(boxes(fixed.page).length, 6);
    assert.doesNotMatch(textOf(found(fixed.page.target, "[data-plan-draft]")[0]), /Findings left/);
  } finally { fixed.page.done(); }
  const stubborn = await drafted(await planned({ plan: false }), without("Mail"));
  try {
    assert.equal(stubborn.asked.length, 2, "asked again, and no more once a round leaves the findings unchanged");
    assert.equal(boxes(stubborn.page).length, 5);
    const shown = textOf(found(stubborn.page.target, "[data-plan-draft]")[0]);
    assert.match(shown, /Findings left after the last round:error: MOD-mail has no step/);
    assert.match(shown, /correction rounds: 2/);
  } finally { stubborn.page.done(); }
});

// ---------------------------------------------------------------- THE PAGE AND ITS CLICKS

// TST-1061116 · level: release · module: system
// guards: UC-045; DIAGRAMS ARE MERMAID IN MARKDOWN
// given: UC-045 as committed text; the plan page of the planned product, and the page of a drafted plan; the planner's saved plan
// input: the diagrams of UC-045, of the plan page and of the draft are read; the files of the saved plan are read
// expect: UC-045's sequence diagram is a fenced mermaid block and the file holds no image; the plan page and the draft page hand Mermaid one flowchart each (a node `mermaid` holding "flowchart TD") and draw no image element; the saved plan's files are Markdown, every path ending in .md, and hold no image link
test("TST-1061116: UC-045 the diagrams are Mermaid in Markdown, on the page and in the files", async () => {
  const uc = read(UC);
  assert.match(uc, /\x60{3}mermaid\nsequenceDiagram\n/, "known positive: the use case's diagram is Mermaid");
  assert.doesNotMatch(uc, /!\[[^\]]*\]\([^)]*\.(png|svg|jpg|jpeg|gif)\)/i, "and no image file");
  const plan = await openPlan("plan", {}, { files: await planned() });
  try {
    const diagrams = classed(plan.target, "mermaid");
    assert.equal(diagrams.length, 1);
    assert.match(textOf(diagrams[0]), /^flowchart TD /);
    assert.equal(walk(plan.target, (node) => node.localName === "img").length, 0);
  } finally { plan.done(); }
  const { page } = await drafted(await planned({ plan: false }), DRAFT);
  try {
    const shown = classed(found(page.target, "[data-draft-diagram]")[0], "mermaid");
    assert.equal(shown.length, 1);
    assert.match(textOf(shown[0]), /^flowchart TD /);
    assert.equal(walk(page.target, (node) => node.localName === "img").length, 0);
    await page.press(savePlan(page));
    await waitFor(() => planWrites(page).length > 0);
    const written = filesOf(page);
    assert.ok(Object.keys(written).every((path) => path.endsWith(".md")), "Markdown files");
    assert.ok(Object.values(written).every((text) => !/!\[[^\]]*\]\(/.test(text)), "no image link");
  } finally { page.done(); }
});

// TST-1061117 · level: release · module: system
// guards: UC-045; THE PAGE NAMES WHERE IT SENDS
// given: the planned product without a plan; the participants local-llm (model-a, "this machine", endpoint ep1) and cloud-llm (model-b, "a provider in the USA", endpoint ep2) that can draft text
// input: the planner presses Draft the plan; the run panel is read; the planner presses Run with local-llm, and again with cloud-llm chosen
// expect: before anything is sent the run panel names each participant it offers with the place where it processes data — local-llm "this machine", cloud-llm "a provider in the USA" —, and the files it would send; nothing is sent before Run; Run with local-llm sends to ep1 alone; with cloud-llm chosen the panel names "a provider in the USA" and Run sends to ep2 alone
test("TST-1061117: UC-045 before it sends, the page names every destination, a participant with the place where it processes data", async () => {
  const { page, asked } = await drafting({ files: await planned({ plan: false }) }, DRAFT);
  try {
    const offered = textOf(found(page.target, "[data-draft-participant]")[0]);
    assert.ok(offered.includes("local-llm — processes data at this machine") && offered.includes("cloud-llm — processes data at a provider in the USA"), offered);
    assert.ok(textOf(classed(page.target, "run-panel")[0]).includes("docs/architecture/MOD-store.md"), "and what it would send");
    assert.deepEqual(asked, [], "nothing is sent before Run");
    await run(page);
    assert.deepEqual(asked.map((request) => request.origin), ["https://ep1.example.test"], "local-llm: ep1 alone");
  } finally { page.done(); }
  const other = await drafting({ files: await planned({ plan: false }) }, DRAFT);
  try {
    const { choose } = await import("./uc-045-harness.mjs");
    await choose(found(other.page.target, "[data-draft-participant]")[0], "cloud-llm");
    await waitFor(() => /cloud-llm — drafter/.test(textOf(classed(other.page.target, "run-panel")[0] ?? other.page.target)));
    assert.match(textOf(classed(other.page.target, "run-panel")[0]), /processes data at: a provider in the USA/);
    assert.deepEqual(other.asked, []);
    await run(other.page);
    assert.deepEqual(other.asked.map((request) => request.origin), ["https://ep2.example.test"], "cloud-llm: ep2 alone");
  } finally { other.page.done(); }
});

// TST-1061118 · level: release · module: system
// guards: UC-045; ONE CLICK PER DECISION
// given: the planned product without a plan; local-llm drafts the plan
// input: the planner's clicks of the main flow: Draft the plan, Run, Save plan — counted
// expect: after three clicks the plan is committed; Run is the only click between the run panel and the draft, and Save plan the only one between the draft and the commit — no control asks for a further confirmation: the page draws no confirm button
test("TST-1061118: UC-045 a decision takes one click: Run, and Save plan", async () => {
  const page = await openPlan("plan", {}, { files: await planned({ plan: false }), store: STORE, server: [async (url, init) => {
    if (url.origin !== "https://ep1.example.test") return undefined;
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft: DRAFT, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }] });
  try {
    let clicks = 0;
    const click = async (element) => { clicks += 1; await page.press(element); };
    await click(found(page.target, "[data-draft-plan]")[0]);
    await waitFor(() => classed(page.target, "run-panel").length > 0);
    await click(walk(classed(page.target, "run-panel")[0], (node) => node.localName === "button" && node.textContent.trim() === "Run")[0]);
    await waitFor(() => boxes(page).length > 0);
    assert.equal(boxes(page).length, 6, "the draft stands after the second click");
    assert.deepEqual(planWrites(page), [], "and nothing is written");
    await click(savePlan(page));
    await waitFor(() => planWrites(page).length > 0);
    assert.equal(clicks, 3);
    assert.equal(planWrites(page).length, 1, "the plan is committed after the third");
    assert.deepEqual(walk(page.target, (node) => node.localName === "button").map((node) => node.textContent.trim()).filter((label) => /confirm|are you sure|yes|ok/i.test(label)), [], "no confirmation is asked for");
  } finally { page.done(); }
});

// TST-1061119 · level: release · module: system
// guards: UC-045; EVERY STEP EXPLAINS ITSELF
// given: the plan page of the planned product
// input: the planner reads the page
// expect: What is this? at the head of the page and a second one beside Draft the plan are both folded (their details element is not open); the second explains Draft the plan, the run panel's content and Save plan — "docs/plan/" and "as you left them" —, and states that a move that puts a module before one whose interface it uses is refused
test("TST-1061119: UC-045 the steps that ask something of the planner carry a folded explanation", async () => {
  const page = await openPlan("plan", {}, { files: await planned() });
  try {
    const details = walk(page.target, (node) => node.localName === "details");
    assert.equal(details.length, 2, "two explanations");
    for (const each of details) {
      assert.equal(each.getAttribute("open"), null, "folded");
      assert.equal(textOf(walk(each, (node) => node.localName === "summary")[0]), "What is this?");
    }
    const draft = textOf(details[1]);
    for (const said of ["Draft the plan", "run panel names the participant", "where it processes data", "Save plan", "docs/plan/", "as you left them", "a move that puts a module before one whose interface it uses is refused"]) assert.ok(draft.includes(said), said);
  } finally { page.done(); }
});
