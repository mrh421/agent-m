// System tests of UC-043 "Run the process over a selection": the precondition (a declared process, filled roles, an accepted architecture, an implementation plan), the main flow from the steps the author selects to the run's end —
// the run's record, the CI configuration first, the steps in the order of the modules' interfaces up to the jobs at once, the gates, the records of the jobs and the end of the run —, every alternative flow of the use case, and the
// postcondition. TST-1045201 maps every passage of UC-043 to the test that walks it, and to the older tests of other levels that also walk it.
// Run: node --test tests/system-uc-043-run-the-process-over-a-selection.test.mjs
//
// Module: MOD-run-planner
// Module: MOD-implementation-pages
// Module: MOD-progress-measures
// Module: MOD-job-ledger
// Module: MOD-work-plans
// Guards: UC-043
// Level: system
//
// Written for ITM-1045 by developer-sonnet-k. The world is tests/uc-043-harness.mjs: the planned product alice/thesis-tool behind the fake of GitHub, its facts read by productFacts, its run read by runOf and its next actions given by
// nextActions. The run's participant, which UC-043 puts "in a session of its own", is played by the harness's `carryOut` with the repository's own functions (see that file); the withdrawn run page and automatic drivers of a run (the register of
// the backlog, ITM-1045's Outcome) leave every passage that names them to a `todo`. Each test states its input and its expected result in its own text (given / input / expect) from UC-043, before it runs; none reads an expected value from a
// document. The counter-proofs are recorded in the pull request. Readings the texts leave open, which the cases state:
//   - "The author selects the steps ... those not done, as their derived states give them" (step 1) is read as the steps the route `implement` draws as selectable, which are the steps the facts' derived states give as ready.
//   - "The run's participant writes the run's job record" (step 4) is read as MOD-job-ledger's startRecord with the kind `run`, the selection as `works_on` and the limits as parameters, as MOD-run-planner's Data states it.
//   - "starts the first jobs" and "each job starts by itself" are read as the harness writing, for each action `start` nextActions gives, the job's record naming the run and the run's `## Job started` part in one commit, and ending the job
//     `done` with a merged pull request that names its step, once the case lets it.
//   - "The CI job's pull request is merged once green" (step 5.1) is read as the configuration the schedule generates (MOD-test-schedule's ciConfiguration) being on the default branch.
//   - "up to the limit of jobs at once" is read as: the jobs of the run that have not ended, one that waits at a gate included, are no more than `jobs at once`, as MOD-run-planner's file counts them.
//   - Every case but TST-1045209 reads the states of the plan without the run's own record (FINDING UC043-F1), so that the finding does not hide what the cases after it are about; TST-1045209 reads them as they are.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { LIMITS, RUN_ID, STEPS, architecture, found, lines, openWorld, productFiles } from "./uc-043-harness.mjs";
import { openImplement, quiet, startRecords, stepRows, textOf } from "./uc-024-harness.mjs";
import { MODELS, itemPath, product as backlogProduct } from "./uc-032-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SELF = "tests/system-uc-043-run-the-process-over-a-selection.test.mjs";
const UC = "docs/use-cases/UC-043-run-the-process-over-a-selection.md";
const GATE_AFTER = "Validation & Verification → Operation & Maintenance";
const IMPLEMENT_GATE_PATH = "docs/gates/20261030-1001-design-implementation-bbbb.md";

let world = null;
test.afterEach(() => { world?.restore(); world = null; });

/** A world whose run is started and whose CI configuration stands (unless `ci` is false). */
async function ready({ ci = true, limits = LIMITS, selection = STEPS, ...options } = {}) {
  world = await openWorld(options);
  await world.startRun({ limits, selection });
  if (ci) await world.setUpCi();
  return world;
}
const startsOf = (actions) => actions.filter((action) => action.do === "start").map((action) => (action.worksOn ?? action.kind));
const stateOf = (facts, item) => facts.plan.states.find((state) => state.item === item)?.state;
const registerWith = (...rows) => lines("# Participants of this instance", "", "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|", ...rows);
const BUILDS = "read the repository, write to the repository, run code and tests, use tools";

// ---------------------------------------------------------------- the map

const UC025 = "tests/release-uc-025-validate-modules.test.mjs";
const UC024S = "tests/system-uc-024-implement-the-architecture.test.mjs";
const PLAN = "tests/implementation-pages-implement-plan.test.mjs";
const NEXT = "tests/run-planner-next-actions.test.mjs";
const RUNOF = "tests/run-planner-run-of.test.mjs";
const JOBREC = "tests/test_job_record.py";
const JOBS = "tests/main-page-jobs.test.mjs";
const GATEP = "tests/main-page-job-gate.test.mjs";
const RETRY = "tests/main-page-job-retry.test.mjs";
const CANCEL = "tests/main-page-job-cancel.test.mjs";
const PROGRESS = "tests/system-uc-035-follow-progress.test.mjs";
const VALID = "tests/system-uc-025-validate-modules.test.mjs";

// Each passage of UC-043 that this repository's code carries, with the tests that walk it: this file's, and the older tests of other levels that also walk it.
const FLOW_EVIDENCE = {
  "precondition": { uc: "The product declares a process model (UC-002), and its roles are filled (UC-048).", evidence: [[SELF, "TST-1045202"]] },
  "main-1-select": { uc: "The author selects the steps of the implementation plan the run builds", evidence: [[SELF, "TST-1045203"], [UC024S, "TST-740204"], [PLAN, "TST-732001"]] },
  "main-2-limits": { uc: "The author sets the **limits**: jobs at once", evidence: [[SELF, "TST-1045204"], [RUNOF, "TST-976002"]] },
  "main-3-plan": { uc: "which plans it from the model: the parts of the run in their order", evidence: [[SELF, "TST-1045206"], [NEXT, "TST-977009"]] },
  "main-4-record": { uc: "The run's participant writes the run's job record, naming the selection, the limits and the author who started it", evidence: [[SELF, "TST-1045208"], [RUNOF, "TST-976001"], [JOBREC, "TST-1132004"]] },
  "main-5-1-ci": { uc: "**CI** — if the product has no CI configuration, the job of UC-027 generates it from the schedule", evidence: [[SELF, "TST-1045210"], [NEXT, "TST-977001"], [NEXT, "TST-977007"]] },
  "main-5-2-implementation": { uc: "**Implementation** — one job per step (UC-024)", evidence: [[SELF, "TST-1045211"], [SELF, "TST-1045212"], [SELF, "TST-1045213"], [NEXT, "TST-977002"], [UC024S, "TST-740210"]] },
  "main-5-validation": { uc: "**Validation** — UC-025 for the selection.", evidence: [[UC025, "TST-741112"], [VALID, "TST-741002"]] },
  "main-5-records": { uc: "writes its own record naming the run", evidence: [[SELF, "TST-1045215"], [JOBREC, "TST-1132004"], [UC024S, "TST-740213"], [UC024S, "TST-740219"]] },
  "main-6-dashboards": { uc: "show the run's jobs, their states and what waits", evidence: [[SELF, "TST-1045216"], [JOBS, "TST-509001"], [JOBS, "TST-970001"], [PROGRESS, "TST-806008"]] },
  "main-7-end": { uc: "The run ends. Its participant completes the run's record.", evidence: [[SELF, "TST-1045217"], [NEXT, "TST-977006"], [RUNOF, "TST-976005"]] },
  "main-7-validation": { uc: "is the view of UC-025 for the modules of the selection.", evidence: [[UC025, "TST-741112"]] },
  "1a-backlog": { uc: "**1a. The product works from a backlog (Scrum, Kanban).**", evidence: [[SELF, "TST-1045219"], [SELF, "TST-1045220"], [NEXT, "TST-977010"], [UC024S, "TST-740203"]] },
  "1c-one-part": { uc: "**1c. The author wants only one part for one step**", evidence: [[SELF, "TST-1045222"], [UC024S, "TST-740210"]] },
  "3a-cycle": { uc: "**3a. The interfaces form a cycle.**", evidence: [[SELF, "TST-1045224"], [NEXT, "TST-977008"]] },
  "5a-gate": { uc: "**5a. A job reaches a gate its model gives to a person**", evidence: [[SELF, "TST-1045226"], [NEXT, "TST-977004"], [GATEP, "TST-801001"], [GATEP, "TST-801002"]] },
  "5b-failed": { uc: "**5b. A job fails**", evidence: [[SELF, "TST-1045227"], [NEXT, "TST-977005"], [RETRY, "TST-974002"]] },
  "5c-limit": { uc: "**5c. A limit is reached**", evidence: [[SELF, "TST-1045230"], [RUNOF, "TST-976004"], [RUNOF, "TST-976005"]] },
  "5d-stop": { uc: "**5d. The author stops the run.**", evidence: [[SELF, "TST-1045231"], [NEXT, "TST-977006"], [CANCEL, "TST-972003"]] },
  "postcondition": { uc: "Every selected step or item has code and tests merged through pull requests whose Definition of Done", evidence: [[SELF, "TST-1045233"]] },
};
// The passages the repository's code does not carry as UC-043 says: the finding, its case, and the module it points to.
const FLOW_FINDINGS = {
  "main-1-4-start": { uc: "The author hands the run to its participant", finding: "UC043-F2", file: SELF, test: "TST-1045207", module: "no module" },
  "main-2-presets": { uc: "jobs at once (the model's work-in-progress limit, or 3)", finding: "UC043-F3", file: SELF, test: "TST-1045205", module: "MOD-run-planner" },
  "main-4-5-states": { uc: "The run proceeds without a click", finding: "UC043-F1", file: SELF, test: "TST-1045209", module: "MOD-work-plans" },
  "main-5-2-phases": { uc: "in a V-model, the Testing phase runs after Implementation", finding: "UC043-F11", file: SELF, test: "TST-1045234", module: "MOD-run-planner" },
  "main-5-3-tests": { uc: "**Tests** — the job of UC-026 for the selection", finding: "UC043-F5", file: SELF, test: "TST-1045214", module: "no module" },
  "main-7-finish": { uc: "Its participant completes the run's record", finding: "UC043-F6", file: SELF, test: "TST-1045218", module: "no module" },
  "1b-accepted": { uc: "**1b. A selected step's module file or decision is not accepted.**", finding: "UC043-F9", file: SELF, test: "TST-1045221", module: "MOD-work-plans" },
  "1d-nothing": { uc: "**1d. The product has no implementation plan, or no ready backlog item.**", finding: "UC043-F8", file: SELF, test: "TST-1045223", module: "MOD-run-planner" },
  "3b-role": { uc: "**3b. No participant holds a role the plan needs.**", finding: "UC043-F7", file: SELF, test: "TST-1045225", module: "no module" },
  "5b-record": { uc: "The run's record names the failed job and", finding: "UC043-F6", file: SELF, test: "TST-1045228", module: "no module" },
  "5c-hold": { uc: "The run starts no further job, lets the running ones", finding: "UC043-F4", file: SELF, test: "TST-1045229", module: "MOD-run-planner" },
  "5d-cancel": { uc: "every running job is cancelled", finding: "UC043-F10", file: SELF, test: "TST-1045232", module: "no module" },
};
// The passages no code of this repository can carry, with the reason.
const NOT_WALKED = {
  "5a-one-click": { uc: "the person decides with one click (UC-036), and the run continues", why: "the click is UC-036's Pass gate, walked by TST-801002; the run continues by the resumption TST-1045226 shows" },
  "main-5-correction": { uc: "goes through the correction loop where it drafts", why: "a job's own correction loop is walked by the system tests of the use cases that draft (UC-022, UC-005, UC-007), and its limit by TST-472353" },
};

// TST-1045201 · level: system · module: system
// guards: UC-043
// given: UC-043 as committed text, the executable tests named in FLOW_EVIDENCE, the findings named in FLOW_FINDINGS and the passages named in NOT_WALKED
// input: compare every passage of the precondition, the main flow, the alternative flows and the postcondition with its executable evidence, its finding or the reason it is not walked
// expect: every named passage stands in UC-043; every evidence file exists and declares its TST id; every finding's case stands in its file with the todo naming FINDING, its number and its module; known positive: UC-043 names exactly the ten alternative flows 1a, 1b, 1c, 1d, 3a, 3b, 5a, 5b, 5c and 5d, and each is among the passages; the seven numbered steps of the main flow each have a passage
test("TST-1045201: UC-043 every passage of the main flow and of each alternative flow has an executable test, a finding or a stated reason", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  const squash = (text) => text.replace(/\s+/g, " ");
  for (const [name, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(squash(needle)), `${name}: UC-043 says "${needle}"`);
    assert.ok(evidence.length > 0, `${name}: a test is named`);
    for (const [file, id] of evidence) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      assert.ok(testDeclarations(file, read(file)).some((each) => each.id === id), `${name}: ${id} is declared in ${file}`);
    }
  }
  for (const [name, { uc: needle, finding, file, test: id, module }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(squash(needle)), `${name}: UC-043 says "${needle}"`);
    assert.ok(read(file).includes(`// ${id} `), `${name}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`FINDING ${finding} (${module})`), `${name}: a todo names FINDING ${finding} and ${module}`);
    assert.ok(testDeclarations(file, read(file)).some((each) => each.id === id && each.level === "system" && (each.guards ?? []).includes("UC-043")), `${name}: ${id} is a system test that guards UC-043`);
  }
  for (const [name, { uc: needle }] of Object.entries(NOT_WALKED)) assert.ok(uc.includes(squash(needle)), `${name}: UC-043 says "${needle}"`);
  const flows = [...uc.matchAll(/- \*\*(\d+[a-z])\. /g)].map((match) => match[1]).sort();
  assert.deepEqual(flows, ["1a", "1b", "1c", "1d", "3a", "3b", "5a", "5b", "5c", "5d"], "known positive: UC-043 names these ten alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS, ...NOT_WALKED }).filter((key) => /^\d/.test(key)).map((key) => key.split("-")[0]));
  assert.deepEqual(flows.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
  const steps = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS, ...NOT_WALKED }).filter((key) => key.startsWith("main-")).map((key) => key.split("-")[1]));
  assert.deepEqual([...steps].sort(), ["1", "2", "3", "4", "5", "6", "7"], "each step of the main flow is among the passages");
  assert.ok(uc.includes("The author acted to start the run"), "known positive: the postcondition says who acted");
});

// ---------------------------------------------------------------- the precondition and step 1

// TST-1045202 · level: system · module: system
// guards: UC-043; THE MODEL DETERMINES THE PHASES AND THE GATES; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS
// given: the planned product — the V-model declared, its roles filled by a role assignment (dev-a Developer and Tester, bob Reviewer), the architecture accepted by records, the plan of six steps, both gates before Implementation recorded as passed — with no CI configuration of Agent M's
// input: the product's facts as a run's participant reads them (productFacts with the scope all, the trace graph set)
// expect: known positive — six steps in the plan's order; the declared model is the V-model; one role assignment; the two gates before Implementation passed and the third pending; ITM-101 and ITM-103 ready, ITM-102 waiting for ITM-101, ITM-104 for ITM-102, ITM-105 for ITM-103 and ITM-106 for ITM-104 and ITM-105; ci.configured false and the job workflow present; the participants of the instance read
test("TST-1045202: UC-043 precondition — a declared process, filled roles, an accepted architecture and a plan give the run its facts", async () => {
  world = await openWorld();
  const facts = await world.facts();
  assert.deepEqual(facts.plan.states.map((state) => state.item), STEPS, "known positive: the six steps in the plan's order");
  assert.equal(facts.workflow.model.name, "v-model");
  assert.equal(facts.assignments.length, 1);
  assert.deepEqual(facts.gateStates.map((gate) => [gate.gate, gate.state]), [["Requirements → Design", "passed"], ["Design → Implementation", "passed"], [GATE_AFTER, "pending"]]);
  assert.deepEqual(facts.plan.states.map((state) => [state.item, state.state, state.reason]), [["ITM-101", "ready", null], ["ITM-102", "waiting for an item it builds on", "ITM-101 is not done"], ["ITM-103", "ready", null],
    ["ITM-104", "waiting for an item it builds on", "ITM-102 is not done"], ["ITM-105", "waiting for an item it builds on", "ITM-103 is not done"], ["ITM-106", "waiting for an item it builds on", "ITM-104 and ITM-105 are not done"]]);
  assert.equal(facts.ci.configured, false);
  assert.equal(facts.ci.jobWorkflow, true);
  assert.deepEqual(facts.participants.map((participant) => participant.name), ["local-llm", "cloud-llm", "dev-a", "dev-b"]);
});

// TST-1045203 · level: system · module: system
// guards: UC-043; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN
// given: the planned product of TST-1045202
// input: step 1 — the route implement drawn for the product; the facts of the product read
// expect: known positive — six rows in the plan's order; each row shows the state the facts' derived states give it; the steps ready are selectable and ticked, the four others are not selectable, each with its reason; the controls of the page are the ones for starting jobs of steps, and none of them starts a run
test("TST-1045203: UC-043 step 1 — the steps to select are the plan's steps not done, with the states their facts give", async () => {
  const files = await productFiles();
  const page = await openImplement({}, { files });
  let rows, controls;
  try {
    rows = stepRows(page);
    controls = found(page.target, "[data-start-jobs]").map(textOf);
    const buttons = [];
    const visit = (node) => { for (const child of node.childNodes ?? []) { if (child.localName === "button") buttons.push(textOf(child)); visit(child); } };
    visit(page.target);
    controls = buttons;
  } finally { page.done(); }
  world = await openWorld({ files });
  const facts = await world.facts();
  assert.deepEqual(rows.map((row) => row.id), STEPS, "known positive: six rows in the plan's order");
  assert.deepEqual(rows.map((row) => row.state), facts.plan.states.map((state) => state.state));
  assert.deepEqual(rows.filter((row) => row.selectable).map((row) => [row.id, row.ticked]), [["ITM-101", true], ["ITM-103", true]]);
  assert.ok(rows.filter((row) => !row.selectable).every((row) => row.reasons.includes("is not done")), "a step that cannot start says why");
  assert.ok(controls.some((label) => /Start jobs/.test(label)), "known positive: the page offers Start jobs");
  assert.deepEqual(controls.filter((label) => /\brun\b/i.test(label)), [], "no control starts a run");
});

// ---------------------------------------------------------------- steps 2 to 4

// TST-1045204 · level: system · module: system
// guards: UC-043; A RUN HAS LIMITS FIXED AT ITS START
// given: a run started over the six steps by alice with jobs at once 3, no cost limit and rounds 5
// input: step 2 and 4 — the run's record committed to the product, read through MOD-job-ledger's listJobs and MOD-run-planner's runOf
// expect: known positive — the record is a job of kind run whose works_on is the six steps; its parameters are the limits; the author who started it is alice; runOf gives the selection, the limits {3, no cost, 5}, no job and the state running; a limit raised later is the one in force, and the limits of the start stay in the record
test("TST-1045204: UC-043 steps 2 and 4 — the run's record names the selection, the limits and the author, and a raise is read as the limits in force", async () => {
  world = await openWorld();
  await world.startRun({});
  const record = await world.record();
  assert.equal(record.kind, "run", "known positive: the record is read");
  assert.deepEqual(record.worksOn, STEPS);
  assert.deepEqual(record.params, { jobsAtOnce: 3, cost: null, rounds: 5 });
  assert.equal(record.startedBy, "alice");
  assert.deepEqual(await world.run(), { id: RUN_ID, selection: STEPS, limits: { jobsAtOnce: 3, cost: null, rounds: 5 }, jobs: [], state: "running" });
  await world.raise({ jobsAtOnce: 5, cost: 40, rounds: 8 });
  assert.deepEqual((await world.run()).limits, { jobsAtOnce: 5, cost: 40, rounds: 8 });
  assert.deepEqual((await world.record()).params, { jobsAtOnce: 3, cost: null, rounds: 5 }, "the start's limits stay as they were");
});

// TST-1045205 · level: system · module: system
// guards: UC-043; A RUN HAS LIMITS FIXED AT ITS START
// given: a run whose start leaves its limits unset — a record whose parameters hold no jobs at once, no cost and no rounds — over the planned product without a work-in-progress limit
// input: step 2 — runOf reads the record
// expect: the limits the use case presets — jobs at once 3 (the model has no work-in-progress limit), no cost limit, rounds 5 — so that the run never starts more than three jobs at once
test("TST-1045205: UC-043 step 2 — a run whose limits are unset gets the presets: jobs at once 3 and rounds 5", { todo: "FINDING UC043-F3 (MOD-run-planner) — runOf (src/run-planner/run.mjs:23-24) takes the limits of the parameters as they stand, so a run whose record names none has jobsAtOnce undefined and rounds undefined, and nextActions (src/run-planner/next.mjs:118) computes its free places as Math.max(0, undefined - running), which is NaN, so that `free === 0` (:129) never stops it: MOD-run-planner's Data says jobsAtOnce is \"preset to the model's work-in-progress limit, or 3\" and rounds 5, but no function of the module applies the presets" }, async () => {
  world = await openWorld();
  await world.startRun({ limits: {} });
  const record = await world.record();
  assert.equal(record.kind, "run", "known positive: the record is read");
  assert.deepEqual((await world.run()).limits, { jobsAtOnce: 3, cost: null, rounds: 5 });
});

// TST-1045206 · level: system · module: system
// guards: UC-043; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; A GATE NAMES WHO DECIDES IT
// given: the planned product with its CI configuration, and the run over the six steps
// input: step 3 — nextActions for the run; the workflow the facts hold
// expect: known positive — the first actions start ITM-101 and ITM-103, each naming dev-a, the one holder of the implementing role, and the route ci hosted; the workflow names the gates on the way, Design → Implementation and Validation & Verification → Operation & Maintenance, each with the Reviewer as its decider
test("TST-1045206: UC-043 step 3 — the run is planned from the model: the jobs, the participant of the role and every gate with its decider", async () => {
  await ready();
  const actions = await world.next();
  assert.deepEqual(actions.map((action) => [action.do, action.kind, action.worksOn, action.participant, action.route]), [["start", "implement", "ITM-101", "dev-a", "ci hosted"], ["start", "implement", "ITM-103", "dev-a", "ci hosted"]], "known positive: two jobs");
  const facts = await world.facts();
  assert.deepEqual(facts.workflow.gates.map((gate) => [gate.name, gate.decider]), [["Requirements → Design", "Reviewer"], ["Design → Implementation", "Reviewer"], [GATE_AFTER, "Reviewer"]]);
});

// TST-1045207 · level: system · module: system
// guards: UC-043; A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION; ONE CLICK PER DECISION
// given: the planned product, its six steps selected on the route implement
// input: steps 1 to 4 — the author looks, on the route implement, for the control that sets the limits of a run over the selected steps and hands it to a participant
// expect: one control — a button — that, on the author's click, commits the record of a run of kind run over the selected steps with the limits typed, and writes no other file; known positive: Start jobs on the same page commits one start record for each step selected
test("TST-1045207: UC-043 steps 1 to 4 — one click of the author starts a run over the selected steps", { todo: "FINDING UC043-F2 (no module) — no page, route or function of this repository selects steps for a run, takes its limits and writes its record: MOD-implementation-pages serves UC-002, UC-024, UC-031, UC-032, UC-034, UC-035, UC-045 and UC-048 and not UC-043, MOD-run-planner \"writes nothing\"; the run page (ITM-981, ITM-982) and the automatic drivers (ITM-983 to ITM-985) were withdrawn with akmaier's decision of 2026-10-28 (3a3938318), which leaves the run to \"a session of its own\"" }, async () => {
  const page = await openImplement({}, { files: await productFiles() });
  try {
    const labels = [];
    const visit = (node) => { for (const child of node.childNodes ?? []) { if (child.localName === "button") labels.push(textOf(child)); visit(child); } };
    visit(page.target);
    assert.ok(labels.some((label) => /Start jobs/.test(label)), "known positive: the page offers Start jobs");
    const control = labels.find((label) => /\brun\b/i.test(label));
    assert.ok(control, "a button starts a run");
  } finally { page.done(); }
});

// TST-1045208 · level: system · module: system
// guards: UC-043; A RUN IS A JOB THAT NAMES ITS JOBS; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: a run started by alice over the six steps; the product has no CI configuration
// input: step 4 — the run's participant asks nextActions and starts the first job it names, then reads the product's job records with listJobs
// expect: known positive — the first action is the start of the kind set-up-ci and nothing else; the job's record is committed with the run's `## Job started` part in one commit; the product holds two records, the run's and the job's; the job's record names the run, its kind, and a works_on of the use case UC-027; runOf lists the job
test("TST-1045208: UC-043 step 4 — the run's participant starts the first jobs, and the run's record and the job's record name each other", async () => {
  await ready({ ci: false });
  const actions = await world.next();
  assert.deepEqual(actions.map((action) => [action.do, action.kind]), [["start", "set-up-ci"]], "known positive: the CI setup alone");
  const job = await world.begin(actions[0]);
  const rows = await world.rows();
  assert.equal(rows.length, 2);
  const mine = rows.find((row) => row.record.id === job).record;
  assert.deepEqual([mine.kind, mine.run, mine.worksOn], ["set-up-ci", RUN_ID, ["UC-027"]]);
  assert.deepEqual((await world.run()).jobs, [{ job, kind: "set-up-ci", worksOn: "UC-027" }]);
});

// TST-1045209 · level: system · module: system
// guards: UC-043; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION
// given: a run started by alice over the six steps, as its record is written — its works_on the six steps —, and the CI configuration in place; nothing else in the product's job records
// input: step 5 — the product's facts read as they are, with the run's record among the jobs, and nextActions for the run
// expect: known positive — with the run's record among the jobs, the facts hold it; then ITM-101 and ITM-103, which are ready, are started: the actions are the starts of ITM-101 and ITM-103, and the derived states of the steps are ready and not in progress
test("TST-1045209: UC-043 step 5 — a run's own record is not the job of each step it selects", { todo: "FINDING UC043-F1 (MOD-work-plans) — itemStates' jobFor (src/work-plans/states.mjs:137-140, :183) is the first job whose record works on the item, and a run's record works on the selection (MOD-run-planner's Data), so each selected step is in progress with reason `job JOB-… is queued` from the moment the run is started; startable then says `ITM-101 is in progress already` and nextActions (src/run-planner/next.mjs:131-133) starts no implementation job at all: MOD-work-plans' text says an item's `job` is `the newest job whose record works on the item`, and says nothing of a job of kind run" }, async () => {
  await ready();
  const facts = await world.facts({ raw: true });
  assert.ok(facts.jobs.some((row) => row.record.kind === "run"), "known positive: the run's record is among the jobs");
  assert.deepEqual([stateOf(facts, "ITM-101"), stateOf(facts, "ITM-103")], ["ready", "ready"]);
  assert.deepEqual(startsOf(await world.next(RUN_ID, { raw: true })), ["ITM-101", "ITM-103"]);
});

// ---------------------------------------------------------------- step 5

// TST-1045210 · level: system · module: system
// guards: UC-043; A RUN SETS UP CI BEFORE IT IMPLEMENTS
// given: the planned product without a CI configuration, with ITM-101 and ITM-103 ready, and a run over the six steps
// input: step 5.1 — nextActions; the CI job started and running; then its configuration merged
// expect: known positive — only the start of set-up-ci while there is no configuration, though two steps are ready; while that job runs, nothing at all; once the configuration generated from the schedule is in the product, the starts of ITM-101 and ITM-103 and no second set-up-ci
test("TST-1045210: UC-043 step 5.1 — the CI configuration is set up first, and the steps are implemented once its pull request is merged", async () => {
  await ready({ ci: false });
  const first = await world.next();
  assert.deepEqual(startsOf(first), ["set-up-ci"], "known positive: the CI setup, though ITM-101 and ITM-103 are ready");
  assert.deepEqual((await world.facts()).plan.states.filter((state) => state.state === "ready").map((state) => state.item), ["ITM-101", "ITM-103"]);
  const job = await world.begin(first[0]);
  assert.deepEqual(await world.next(), [], "while the CI job runs, nothing starts");
  await world.end(job, "done");
  await world.setUpCi();
  assert.deepEqual(startsOf(await world.next()), ["ITM-101", "ITM-103"]);
});

// TST-1045211 · level: system · module: system
// guards: UC-043; A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; A RUN FOLLOWS THE MODULES' INTERFACES
// given: the planned product without a CI configuration, a run over the six steps with jobs at once 3, and a run's participant that ends each job it starts done with its pull request merged
// input: step 5.2 — the run carried out from its start to the last action, nothing asked of a person
// expect: known positive — the rounds are: the CI setup; ITM-101 and ITM-103; ITM-102 (after ITM-101) beside ITM-105 (after ITM-103); ITM-104 (after ITM-102); ITM-106 (after ITM-104 and ITM-105); no round starts a step before a step it builds on is done, and a module that uses MOD-store is started after it; every step is done in the end; no person was asked
test("TST-1045211: UC-043 step 5.2 — the steps are implemented in the order of the interfaces, side by side where they are independent, with no click between the jobs", async () => {
  await ready({ ci: false });
  const result = await world.carryOut();
  assert.deepEqual(result.waves.map((wave) => wave.map((each) => each.worksOn ?? each.kind)), [["set-up-ci"], ["ITM-101", "ITM-103"], ["ITM-102", "ITM-105"], ["ITM-104"], ["ITM-106"]], "known positive: five rounds");
  assert.ok(result.waves.flat().filter((each) => each.kind === "implement").every((each) => each.participant === "dev-a" && each.route === "ci hosted"));
  const order = result.waves.flatMap((wave, at) => wave.map((each) => [each.worksOn, at]));
  const at = Object.fromEntries(order);
  assert.ok(at["ITM-102"] > at["ITM-101"] && at["ITM-104"] > at["ITM-102"] && at["ITM-105"] > at["ITM-103"] && at["ITM-106"] > Math.max(at["ITM-104"], at["ITM-105"]));
  assert.deepEqual((await world.facts()).plan.states.map((state) => state.state), Array(6).fill("done"));
  assert.equal(result.clicks, 0);
  assert.equal(result.refused, null);
});

// TST-1045212 · level: system · module: system
// guards: UC-043; A RUN HAS LIMITS FIXED AT ITS START
// given: the planned product with its CI configuration and a run over the six steps whose jobs at once are 1, and another whose jobs at once are 2
// input: step 5.2 — each run carried out; then a run with 1 whose first job reaches a gate
// expect: known positive — with 1, every round starts one job: ITM-101, ITM-102, ITM-103, ITM-104, ITM-105, ITM-106 in the plan's order; with 2, no round starts more than two jobs and ITM-101 and ITM-103 start together; a job that waits at a gate is counted against the limit as one that runs: nothing starts beside it though ITM-103 is ready
test("TST-1045212: UC-043 step 5.2 — never more jobs at once than the run's limit, a job at a gate counted", async () => {
  await ready({ limits: { jobsAtOnce: 1, cost: null, rounds: 5 } });
  const one = await world.carryOut();
  assert.deepEqual(one.waves.map((wave) => wave.map((each) => each.worksOn)), [["ITM-101"], ["ITM-102"], ["ITM-103"], ["ITM-104"], ["ITM-105"], ["ITM-106"]], "known positive: the plan's order, one at a time");
  world.restore();
  await ready({ limits: { jobsAtOnce: 2, cost: null, rounds: 5 } });
  const two = await world.carryOut();
  assert.deepEqual(two.waves[0].map((each) => each.worksOn), ["ITM-101", "ITM-103"]);
  assert.ok(two.waves.every((wave) => wave.length <= 2));
  world.restore();
  await ready({ limits: { jobsAtOnce: 1, cost: null, rounds: 5 } });
  const [a] = await world.next();
  const first = await world.begin(a);
  assert.deepEqual(await world.next(), [], "known positive: one job runs, and ITM-103, which is ready, waits for the limit");
  await world.reachGate(first, GATE_AFTER, "Reviewer");
  assert.deepEqual(await world.next(), [], "the job at a gate has not ended: it holds the only place");
});

// TST-1045213 · level: system · module: system
// guards: UC-043; A JOB STOPS AT EVERY GATE; A GATE NAMES WHO DECIDES IT
// given: the planned product with its CI configuration in which the gate Design → Implementation has no record, and a run over the six steps
// input: step 5.2 — nextActions; then the gate decided by its Reviewer, recorded in docs/gates/
// expect: known positive — the gate before the phase Implementation has no record: no step starts and the facts hold the gate pending; once its record is committed, ITM-101 and ITM-103 start
test("TST-1045213: UC-043 step 5.2 — the steps of a phase start once the gate before it is recorded", async () => {
  await ready({ files: await productFiles({ [IMPLEMENT_GATE_PATH]: null }) });
  const facts = await world.facts();
  assert.deepEqual(facts.gateStates.filter((gate) => gate.state === "pending").map((gate) => gate.gate), ["Design → Implementation"], "known positive: the gate is pending");
  assert.deepEqual(await world.next(), []);
  await world.decide("Design → Implementation", "Reviewer", "bob", { name: "design-implementation-bbbb" });
  assert.deepEqual(startsOf(await world.next()), ["ITM-101", "ITM-103"]);
});

// TST-1045214 · level: system · module: system
// guards: UC-043; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION
// given: the planned product with its CI configuration, a run over the six steps whose six jobs are all done with their pull requests merged
// input: step 5.3 — nextActions after the last merge
// expect: known positive — every step is done; then the start of the test battery for the selection, jobs of the kind write-tests or propose-tests for the selected modules, and for the release level a participant other than dev-a, which implemented them
test("TST-1045214: UC-043 step 5.3 — after the steps, the test battery for the selection is started, the release tests by a participant other than the implementer", { todo: "FINDING UC043-F5 (no module) — nextActions (src/run-planner/next.mjs:109-138) gives only the kinds set-up-ci and implement, and `resume`/`refuse`: no job of the kinds write-tests, propose-tests or run-tests and no validation; ITM-978 (\"the tests, then finish\") was withdrawn with akmaier's decision of 2026-10-28 (3a3938318), and MOD-run-planner's text assigns the run's tests part to no function" }, async () => {
  await ready();
  const result = await world.carryOut();
  assert.equal(result.refused, null);
  assert.deepEqual((await world.facts()).plan.states.map((state) => state.state), Array(6).fill("done"), "known positive: every step is done");
  const actions = await world.next();
  const tests = actions.filter((action) => action.do === "start" && ["write-tests", "propose-tests"].includes(action.kind));
  assert.ok(tests.length > 0, "a test job starts for the selection");
  assert.ok(tests.every((action) => action.participant !== "dev-a"), "the release tests go to a participant other than the implementer");
});

// TST-1045215 · level: system · module: system
// guards: UC-043; A RUN IS A JOB THAT NAMES ITS JOBS; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the planned product without a CI configuration and a run over the six steps carried out to its last action
// input: step 5 — the product's job records read with listJobs; the run read with runOf
// expect: known positive — seven jobs besides the run: the CI setup and the six steps; each job's record names the run and the run's record lists each of them, in the order they were started; no job outside the run names it; each step's record works on its step
test("TST-1045215: UC-043 step 5 — each job's record names the run, and the run's record names every job it started", async () => {
  await ready({ ci: false });
  const result = await world.carryOut();
  const rows = await world.rows();
  const jobs = rows.filter((row) => row.record.kind !== "run");
  assert.equal(jobs.length, 7, "known positive: the CI setup and the six steps");
  assert.ok(jobs.every((row) => row.record.run === RUN_ID));
  assert.deepEqual((await world.run()).jobs.map((each) => each.job).sort(), jobs.map((row) => row.record.id).sort());
  assert.deepEqual((await world.run()).jobs.map((each) => each.job), result.started, "in the order they were started");
  assert.deepEqual(jobs.filter((row) => row.record.kind === "implement").map((row) => row.record.worksOn).flat().sort(), STEPS);
  assert.deepEqual(rows.filter((row) => row.record.kind === "run").map((row) => row.record.run), [null], "the run's own record names no run");
});

// ---------------------------------------------------------------- steps 6 and 7

// TST-1045216 · level: system · module: system
// guards: UC-043; ONE DASHBOARD SHOWS EVERY JOB; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: a run over the six steps with ITM-101 running, ITM-103 waiting at a gate and nothing else started
// input: step 6 — the job rows the job dashboard lists (MOD-job-ledger's listJobs), and the states the process dashboard derives for the steps
// expect: known positive — the rows are the run's own, ITM-101's job (queued) and ITM-103's job (waiting at a gate), the one waiting first; each row names its participant dev-a, its route ci hosted and the step it works on; the steps ITM-101 and ITM-103 are derived blocked or in progress with the job named in the reason, and the steps that wait for them say which
test("TST-1045216: UC-043 step 6 — the job dashboard and the process dashboard show the run's jobs, their states and what waits", async () => {
  await ready();
  const [a, b] = await world.next();
  const first = await world.begin(a);
  const second = await world.begin(b);
  await world.reachGate(second, GATE_AFTER, "Reviewer");
  const rows = (await world.rows()).filter((row) => row.record.kind !== "run");
  assert.deepEqual(rows.map((row) => [row.record.id === second ? "ITM-103" : "ITM-101", row.state, row.record.participant, row.record.route]), [["ITM-103", "waiting at a gate", "dev-a", "ci hosted"], ["ITM-101", "queued", "dev-a", "ci hosted"]], "known positive: the job at the gate first");
  const states = (await world.facts()).plan.states;
  assert.deepEqual(states.slice(0, 3).map((state) => [state.item, state.state]), [["ITM-101", "in progress"], ["ITM-102", "waiting for an item it builds on"], ["ITM-103", "blocked"]]);
  assert.ok(states[2].reason.includes(second) && states[2].reason.includes(GATE_AFTER));
  assert.ok(states[0].reason.includes(first));
});

// TST-1045217 · level: system · module: system
// guards: UC-043; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; A RUN IS A JOB THAT NAMES ITS JOBS
// given: a run over the six steps carried out to its last action, every step done
// input: step 7 — nextActions; then the run's participant completes the record with an End of state done; nextActions again; runOf
// expect: known positive — no action starts anything once every step is done; the run's state is running until its record has its End; with the End done the state is finished and nextActions gives nothing; the run's jobs stay in the record
test("TST-1045217: UC-043 step 7 — a run's End completes its record, and a finished run starts nothing", async () => {
  await ready();
  await world.carryOut();
  assert.deepEqual(startsOf(await world.next()), []);
  assert.equal((await world.run()).state, "running", "known positive: the run is read, and no End is written yet");
  await world.endRun("done");
  const run = await world.run();
  assert.equal(run.state, "finished");
  assert.equal(run.jobs.length, 6);
  assert.deepEqual(await world.next(), []);
});

// TST-1045218 · level: system · module: system
// guards: UC-043; A RUN ENDS WITH THE VALIDATION OF ITS MODULES; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS
// given: a run over the six steps carried out to its last action, every step done and no End written
// input: step 7 — nextActions
// expect: one action — `finish` — that ends the run: the Action of MOD-run-planner names `finish` among the things a run does; the run's participant completes the record on it; known positive: no action starts a job
test("TST-1045218: UC-043 step 7 — when every step is done the run's next action is to finish", { todo: "FINDING UC043-F6 (no module) — nextActions never gives the action `finish`, which MOD-run-planner's Action type lists (src/run-planner/next.mjs:109-138 gives start, resume and refuse); ITM-978 (\"the tests, then finish\") and ITM-1035 (\"a finished run records and shows its validation\") were withdrawn with akmaier's decision of 2026-10-28 (3a3938318), and MOD-run-planner's text describes no condition under which a run is finished" }, async () => {
  await ready();
  await world.carryOut();
  const actions = await world.next();
  assert.deepEqual(startsOf(actions), [], "known positive: no job starts");
  assert.deepEqual(actions.map((action) => action.do), ["finish"]);
});

// TST-1045234 · level: system · module: system
// guards: UC-043; A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION
// given: the planned V-model product, whose transition Implementation → Testing is a sequence, with CI configured and a run over the six steps — ITM-101 to ITM-103 in the phase Implementation, ITM-104 to ITM-106 in the phase Testing — carried out
// input: step 5.2 — the rounds of the run, with the phase of each step
// expect: known positive — the three steps of the phase Implementation and the three of the phase Testing are all started; in the model's order no step of the phase Testing starts in a round in which a step of the phase Implementation has not been done before the round began: ITM-105 does not start beside ITM-102
test("TST-1045234: UC-043 step 5.2 — in a V-model the phase Testing runs after Implementation", { todo: "FINDING UC043-F11 (MOD-run-planner) — nextActions (src/run-planner/next.mjs:125-134) takes the steps in the plan's order but starts each as soon as startable admits it and the modules it uses are done, and asks nowhere whether the steps of an earlier phase are done: ITM-105 (Testing, after ITM-103) starts in the round of ITM-102 (Implementation); MOD-run-planner's text says the steps are taken `in the order of the modules' interfaces and of the model's phases and gates`, and UC-043 says `in a V-model, the Testing phase runs after Implementation`" }, async () => {
  const phaseOf = (step) => (["ITM-101", "ITM-102", "ITM-103"].includes(step) ? "Implementation" : "Testing");
  await ready();
  const result = await world.carryOut();
  assert.deepEqual(result.waves.flat().map((each) => each.worksOn).sort(), STEPS, "known positive: all six steps are started");
  const done = new Set();
  const early = [];
  for (const wave of result.waves) {
    const open = STEPS.filter((step) => phaseOf(step) === "Implementation" && !done.has(step));
    for (const each of wave) if (phaseOf(each.worksOn) === "Testing" && open.length) early.push(each.worksOn);
    for (const each of wave) done.add(each.worksOn);
  }
  assert.deepEqual(early, []);
});

// ---------------------------------------------------------------- the alternative flows

// TST-1045219 · level: system · module: system
// guards: UC-043; AGILE IMPLEMENTATION STARTS FROM THE BACKLOG; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT; A JOB GOES ONLY TO A HOLDER OF ITS ROLE
// given: the Scrum product of tests/uc-032-harness.mjs — team1's running sprint 02 selecting ITM-001 and ITM-002, the roles of team1 held by alice and dev-a, those of team2 by bob and dev-b — without the item ITM-005, with CI configured, and a run over the backlog items ITM-001, ITM-002 and ITM-003
// input: 1a — nextActions; ITM-001 done; nextActions again
// expect: known positive — the selection is backlog items; only ITM-001 starts, on dev-a, the holder in the item's own team; ITM-003, which no sprint selects, starts in no round, ITM-002 starts once ITM-001 is done
test("TST-1045219: UC-043 1a — in Scrum a run starts the items of its team's current sprint, each on a holder of the team's role", async () => {
  const files = await backlogProduct({ files: { [itemPath(5)]: null } });
  await ready({ files, instanceFiles: { "docs/process-models/fixture.md": MODELS.scrum }, selection: ["ITM-001", "ITM-002", "ITM-003"] });
  const facts = await world.facts();
  assert.equal(facts.workflow.model.flow.sprints, true, "known positive: a model with sprints");
  const first = await world.next();
  assert.deepEqual(first.map((action) => [action.do, action.kind, action.worksOn, action.participant]), [["start", "implement", "ITM-001", "dev-a"]]);
  const job = await world.begin(first[0]);
  await world.end(job, "done");
  world.merge("ITM-001", job);
  assert.deepEqual(startsOf(await world.next()), ["ITM-002"]);
});

// TST-1045220 · level: system · module: system
// guards: UC-043; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; AGILE IMPLEMENTATION STARTS FROM THE BACKLOG
// given: the Kanban product of tests/uc-032-harness.mjs — one role assignment, a work-in-progress limit of 2, ITM-010 running a job — with CI configured, and a run with jobs at once 3 over the backlog items ITM-001, ITM-003, ITM-005 and ITM-009, all ready
// input: 1a — nextActions
// expect: known positive — ITM-010 is in progress; one start only, ITM-001, as many as the limit of 2 allows beside ITM-010, though the run's own limit is 3
test("TST-1045220: UC-043 1a — in Kanban a run starts as many items as the work-in-progress limit allows", async () => {
  const files = await backlogProduct({ model: MODELS.kanban, files: { "docs/process.md": lines("---", "model: fixture-kanban", "model_file: docs/process-models/fixture.md", `model_version: ${"c0ffee".padEnd(40, "0")}`, "---", "# How the fixture product is developed", "", "## Practices", "", "- none", "",
    "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "", "## Definition of Done", "", "The job rules hold."), "docs/backlog/sprints/team1/02.md": null, "docs/role-assignments/team2.md": null } });
  await ready({ files, instanceFiles: { "docs/process-models/fixture.md": MODELS.kanban }, selection: ["ITM-001", "ITM-003", "ITM-005", "ITM-009"] });
  const facts = await world.facts();
  assert.deepEqual([stateOf(facts, "ITM-010"), facts.workflow.model.flow.wip], ["in progress", 2], "known positive");
  assert.deepEqual(startsOf(await world.next()), ["ITM-001"]);
});

// TST-1045221 · level: system · module: system
// guards: UC-043; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED
// given: the planned product whose module file MOD-store has no approval record (it is open), with CI configured, and a run over the six steps
// input: 1b — nextActions
// expect: known positive — ITM-103, whose module MOD-mail is accepted, starts; ITM-101, whose module file is not accepted, is not built: no action starts it and the facts' reason for it names MOD-store as open
test("TST-1045221: UC-043 1b — a step whose module file is not accepted is not built, and what is open is named", { todo: "FINDING UC043-F9 (MOD-work-plans) — itemStates (src/work-plans/states.mjs, acceptanceReasons :99-108) reads only the requirements and use cases a step `realises`, never the acceptance of its module files or of the decisions that design them, so ITM-101 is `ready` with MOD-store open and nextActions starts it: MOD-work-plans' text for startable says `a requirement or use case it names not accepted` and names no module file" }, async () => {
  await ready({ files: await productFiles({}, { open: ["docs/architecture/MOD-store.md"] }) });
  const actions = await world.next();
  assert.ok(startsOf(actions).includes("ITM-103"), "known positive: ITM-103 starts");
  assert.ok(!startsOf(actions).includes("ITM-101"), "ITM-101 does not start");
  assert.match(stateOf(await world.facts(), "ITM-101"), /waiting for acceptance/);
});

// TST-1045222 · level: system · module: system
// guards: UC-043; ONE CLICK PER DECISION; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the planned product, ITM-101 and ITM-103 ready and ticked on the route implement
// input: 1c — the author's click on Start jobs, the one part started on its own (UC-024)
// expect: known positive — two start records of the kind implement are committed; none is a record of the kind run and none names a run: no run is created
test("TST-1045222: UC-043 1c — the author starts one part for a step on its own, and no run is created", async () => {
  const page = await openImplement({}, { files: await productFiles() });
  try {
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    const records = startRecords(page);
    assert.equal(records.length, 2, "known positive: two start records");
    assert.ok(records.every((record) => /^kind: implement$/m.test(record.text)));
    assert.ok(records.every((record) => !/^run: /m.test(record.text)), "no record names a run");
    assert.ok(records.every((record) => !/^kind: run$/m.test(record.text)), "no record is a run's");
  } finally { page.done(); }
});

// TST-1045223 · level: system · module: system
// guards: UC-043; A RUN SETS UP CI BEFORE IT IMPLEMENTS; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN
// given: the planned product without a plan, a run whose selection is ITM-101, and the same with the CI configuration in place
// input: 1d — nextActions for each
// expect: known positive — with the CI configuration in place nothing starts, since no step of the plan names ITM-101; without it nothing starts either, for the use case says that without an implementation plan nothing starts
test("TST-1045223: UC-043 1d — without an implementation plan nothing starts", { todo: "FINDING UC043-F8 (MOD-run-planner) — with no plan and no CI configuration nextActions starts the kind set-up-ci (src/run-planner/next.mjs:119-120), which depends on the facts of the CI alone, though UC-043 1d says `Nothing starts`; MOD-run-planner's text says `while the product has no CI configuration ... start the kind set-up-ci and nothing else`, so the module text and the use case disagree" }, async () => {
  world = await openWorld({ files: await productFiles({}, { plan: false }) });
  await world.startRun({ selection: ["ITM-101"] });
  assert.deepEqual((await world.facts()).plan.states, [], "known positive: no step in the plan");
  const unconfigured = await world.next();
  await world.setUpCi();
  assert.deepEqual(await world.next(), [], "with the configuration in place nothing starts");
  assert.deepEqual(unconfigured, [], "without it nothing starts either");
});

// TST-1045224 · level: system · module: system
// guards: UC-043; A RUN FOLLOWS THE MODULES' INTERFACES; MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE
// given: the planned product whose MOD-store uses MOD-pages.read while MOD-pages uses MOD-store.read, and a run over the six steps, with and without the CI configuration
// input: 3a — nextActions
// expect: known positive — the only action is a refusal that names MOD-pages and MOD-store as a cycle in the compiler's form, with the rule A RUN FOLLOWS THE MODULES' INTERFACES, whether or not the CI configuration stands; no job starts
test("TST-1045224: UC-043 3a — a cycle in the modules' interfaces starts nothing and names the modules", async () => {
  world = await openWorld({ files: await productFiles(architecture({ uses: { "MOD-pages": ["MOD-store.read"], "MOD-store": ["MOD-pages.read"] } })) });
  await world.startRun({});
  const before = await world.next();
  await world.setUpCi();
  const after = await world.next();
  for (const actions of [before, after]) {
    assert.equal(actions.length, 1, "known positive: one action");
    assert.equal(actions[0].do, "refuse");
    assert.match(actions[0].reason, /the uses of MOD-pages, MOD-store form a cycle \[A RUN FOLLOWS THE MODULES' INTERFACES\]/);
    assert.match(actions[0].reason, /^\S+:\d+: error: /);
  }
});

// TST-1045225 · level: system · module: system
// guards: UC-043; A JOB GOES ONLY TO A HOLDER OF ITS ROLE
// given: the planned product whose participants' register lists dev-a and dev-b without the capability run code and tests, with CI configured, and a run over the six steps
// input: 3b — nextActions
// expect: known positive — nothing starts; and the run's participant is told which role the plan needs, Developer, and which capability no participant holds, run code and tests
test("TST-1045225: UC-043 3b — no participant holds a role the plan needs: nothing starts, and the role and the capability are named", { todo: "FINDING UC043-F7 (no module) — nextActions (src/run-planner/next.mjs:130-131) skips an item with no holder silently, and `refuse` is given for a cycle only; the reasons startable gives (`No job can implement ITM-101: no holder of Developer in plan has all it needs — ...; none can run code and tests`, src/work-plans/states.mjs, holderReason) reach the run's participant by no function: MOD-run-planner's text assigns the refusal of a cycle only" }, async () => {
  const weak = registerWith("| local-llm | model endpoint | model-a | 200000 | — | draft text | this machine | endpoint ep1 |", "| dev-a | model endpoint | model-c | 200000 | — | read the repository, write to the repository | this machine | ci hosted secret DEV_KEY |",
    "| dev-b | model endpoint | model-d | 200000 | — | read the repository, write to the repository | this machine | ci hosted secret DEV_KEY |");
  await ready({ instanceFiles: { "docs/participants.md": weak } });
  const actions = await world.next();
  assert.deepEqual(startsOf(actions), [], "known positive: nothing starts");
  const said = actions.map((action) => action.reason ?? "").join(" ");
  assert.ok(said.includes("Developer") && said.includes("run code and tests"), "the role and the capability are named");
});

// TST-1045226 · level: system · module: system
// guards: UC-043; A JOB STOPS AT EVERY GATE; A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT
// given: a run over the six steps with CI configured, ITM-101 and ITM-103 started, and ITM-101's job waiting at Validation & Verification → Operation & Maintenance, decided by the Reviewer
// input: 5a — nextActions while the gate has no record, after ITM-103 is done, and after bob, the Reviewer, has recorded the gate passed
// expect: known positive — the run is waiting at a gate; while it waits ITM-102 (which builds on ITM-101) does not start and ITM-105 (which does not) does, nothing resumes; after the gate's record the actions are the resumption of ITM-101's own job, on its own participant and route, besides the start of ITM-105
test("TST-1045226: UC-043 5a — a job at a gate waits there, the jobs that do not depend on it go on, and its resumption follows the decision", async () => {
  await ready();
  const [a, b] = await world.next();
  const waiting = await world.begin(a);
  const other = await world.begin(b);
  await world.reachGate(waiting, GATE_AFTER, "Reviewer");
  assert.equal((await world.run()).state, "waiting at a gate", "known positive");
  assert.deepEqual(await world.next(), []);
  await world.end(other, "done");
  world.merge("ITM-103", other);
  const during = await world.next();
  assert.deepEqual(during.map((action) => [action.do, action.worksOn]), [["start", "ITM-105"]], "ITM-105 goes on, ITM-102 waits");
  await world.decide(GATE_AFTER, "Reviewer", "bob");
  const after = await world.next();
  assert.deepEqual(after.map((action) => [action.do, action.worksOn, action.job, action.participant, action.route]), [["resume", "ITM-101", waiting, "dev-a", "ci hosted"], ["start", "ITM-105", null, "dev-a", "ci hosted"]]);
});

// TST-1045227 · level: system · module: system
// guards: UC-043; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; A RUN FOLLOWS THE MODULES' INTERFACES
// given: the planned product with CI configured and a run over the six steps whose job for ITM-101 ends failed, the other jobs done
// input: 5b — the run carried out
// expect: known positive — ITM-101 and ITM-103 start together; then only ITM-105 (after ITM-103) starts; ITM-102, ITM-104 and ITM-106, which depend on ITM-101, never start; the failed step is derived blocked with its job named, and the run is not finished
test("TST-1045227: UC-043 5b — a failed job blocks the jobs that depend on it, and the others go on", async () => {
  await ready();
  const result = await world.carryOut({ finish: (action) => (action.worksOn === "ITM-101" ? "failed" : "done") });
  assert.deepEqual(result.waves.map((wave) => wave.map((each) => each.worksOn)), [["ITM-101", "ITM-103"], ["ITM-105"]], "known positive");
  const states = (await world.facts()).plan.states;
  assert.deepEqual(states.map((state) => state.state), ["blocked", "waiting for an item it builds on", "done", "waiting for an item it builds on", "done", "waiting for an item it builds on"]);
  assert.match(states[0].reason, /job JOB-\S+ is failed/);
  assert.equal((await world.run()).state, "running");
});

// TST-1045228 · level: system · module: system
// guards: UC-043; A RUN IS A JOB THAT NAMES ITS JOBS
// given: the run of TST-1045227, in which ITM-101's job failed and ITM-102, ITM-104 and ITM-106 were blocked by it
// input: 5b — what the run's record and its next actions say once nothing more can start
// expect: known positive — the failed job is among the run's jobs; then a record or an action of the run names the failed job and the three steps it blocked
test("TST-1045228: UC-043 5b — the run's record names the failed job and everything it blocked", { todo: "FINDING UC043-F6 (no module) — nothing writes it: the run's record has the parts Job started and Limits raised and its End (MOD-job-ledger's Data), none of which holds a failed job or the steps it blocked, and nextActions gives no `finish` with a reason; ITM-1035 (\"a finished run records and shows its validation\") was withdrawn with akmaier's decision of 2026-10-28 (3a3938318)" }, async () => {
  await ready();
  await world.carryOut({ finish: (action) => (action.worksOn === "ITM-101" ? "failed" : "done") });
  const run = await world.run();
  const failed = run.jobs.find((each) => each.worksOn === "ITM-101").job;
  assert.ok(failed, "known positive: the failed job is among the run's jobs");
  const said = [(await world.record()).end?.reason ?? "", ...(await world.next()).map((action) => action.reason ?? "")].join(" ");
  for (const name of [failed, "ITM-102", "ITM-104", "ITM-106"]) assert.ok(said.includes(name), `${name} is named`);
});

// TST-1045229 · level: system · module: system
// guards: UC-043; A RUN HAS LIMITS FIXED AT ITS START; NO COST IS GUESSED
// given: a run over the six steps with a cost limit of 5, CI configured, ITM-101 done at a cost the runtime reported as 6 and ITM-103 running
// input: 5c — runOf; nextActions
// expect: known positive — the run is held by a limit; no further job starts, the running one finishes, and one action `hold` says why in its reason, naming the cost limit
test("TST-1045229: UC-043 5c — a run whose reported cost reaches its limit starts no further job and says why", { todo: "FINDING UC043-F4 (MOD-run-planner) — nextActions (src/run-planner/next.mjs:110) ends a run that is stopped or finished only: a run in the state `held by a limit` is given the starts of every step that startable admits, and the action `hold` of the Action type is never given; MOD-run-planner's text says `never more at once than its start allows (A RUN HAS LIMITS FIXED AT ITS START)` and `A run held by a limit has no end: it waits until a person raises the limit or stops it`; ITM-979 (\"a run held at a limit, continued once a person raises it\") was withdrawn with akmaier's decision of 2026-10-28 (3a3938318)" }, async () => {
  await ready({ limits: { jobsAtOnce: 3, cost: 5, rounds: 5 } });
  const [a, b] = await world.next();
  const done = await world.begin(a);
  await world.begin(b);
  await world.end(done, "done", { amount: 6 });
  world.merge("ITM-101", done);
  assert.equal((await world.run()).state, "held by a limit", "known positive");
  const actions = await world.next();
  assert.deepEqual(startsOf(actions), [], "no further job starts");
  const hold = actions.find((action) => action.do === "hold");
  assert.ok(hold, "the run holds");
  assert.match(hold.reason, /cost/);
});

// TST-1045230 · level: system · module: system
// guards: UC-043; A RUN HAS LIMITS FIXED AT ITS START; NO COST IS GUESSED
// given: a run over the six steps with a cost limit of 5, CI configured, ITM-101 done at a cost the runtime did not report, and the same run after the cost 6 was reported and a person raised the cost limit to 40
// input: 5c — runOf for each; the raise appended to the run's record, and runOf again
// expect: known positive — an unreported cost counts as nothing and never as zero spent: the run is running; with the cost 6 reported the run is held by a limit; after the raise its limits in force are jobs at once 3, cost 40, rounds 5 and the run is running, under the same record, which still holds its jobs
test("TST-1045230: UC-043 5c — only a reported cost counts against the limit, and a raised limit lets the run go on under the same record", async () => {
  await ready({ limits: { jobsAtOnce: 3, cost: 5, rounds: 5 } });
  const [a] = await world.next();
  const job = await world.begin(a);
  await world.end(job, "done");
  world.merge("ITM-101", job);
  assert.equal((await world.run()).state, "running", "known positive: the job is done and its cost unknown");
  world.restore();
  await ready({ limits: { jobsAtOnce: 3, cost: 5, rounds: 5 } });
  const [first] = await world.next();
  const costly = await world.begin(first);
  await world.end(costly, "done", { amount: 6 });
  world.merge("ITM-101", costly);
  assert.equal((await world.run()).state, "held by a limit");
  await world.raise({ jobsAtOnce: 3, cost: 40, rounds: 5 });
  const run = await world.run();
  assert.deepEqual([run.limits, run.state, run.jobs.map((each) => each.job)], [{ jobsAtOnce: 3, cost: 40, rounds: 5 }, "running", [costly]]);
});

// TST-1045231 · level: system · module: system
// guards: UC-043; A CANCELLED JOB WRITES NOTHING MORE; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS
// given: a run over the six steps with CI configured, ITM-101 done and merged, ITM-103 running, and the author stopping the run: the End cancelled in the run's record
// input: 5d — runOf; nextActions
// expect: known positive — the run is stopped and nextActions gives nothing, though ITM-102 is ready; what was merged stays: ITM-101 is derived done
test("TST-1045231: UC-043 5d — a stopped run starts no further job, and what was merged stays", async () => {
  await ready();
  const [a, b] = await world.next();
  const merged = await world.begin(a);
  await world.begin(b);
  await world.end(merged, "done");
  world.merge("ITM-101", merged);
  assert.deepEqual(startsOf(await world.next()), ["ITM-102"], "known positive: ITM-102 would start");
  await world.endRun("cancelled");
  assert.equal((await world.run()).state, "stopped");
  assert.deepEqual(await world.next(), []);
  assert.equal(stateOf(await world.facts(), "ITM-101"), "done");
});

// TST-1045232 · level: system · module: system
// guards: UC-043; A CANCELLED JOB WRITES NOTHING MORE
// given: the run of TST-1045231 stopped while ITM-103's job is running
// input: 5d — the job rows after the stop
// expect: known positive — the run is stopped; the job of ITM-103 is cancelled, with an End of state cancelled in its own record, so that it commits nothing further
test("TST-1045232: UC-043 5d — every running job of a stopped run is cancelled", { todo: "FINDING UC043-F10 (no module) — nothing cancels the jobs of a run that was stopped: the End `cancelled` is written to the run's own record (MOD-job-ledger) and each job's record stays queued or running; MOD-runtimes' cancelJob cancels one job on a person's click (UC-036) and no function reads the run's End to call it; the Stop of the run page (ITM-982) was withdrawn with akmaier's decision of 2026-10-28 (3a3938318)" }, async () => {
  await ready();
  const [a, b] = await world.next();
  await world.begin(a);
  const running = await world.begin(b);
  await world.endRun("cancelled");
  assert.equal((await world.run()).state, "stopped", "known positive");
  const row = (await world.rows()).find((each) => each.record.id === running);
  assert.equal(row.state, "cancelled");
});

// ---------------------------------------------------------------- the postcondition

// TST-1045233 · level: system · module: system
// guards: UC-043; A RUN IS A JOB THAT NAMES ITS JOBS; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
// given: the planned product without a CI configuration and a run over the six steps, carried out and ended done
// input: the postcondition — the product's facts, job records and merged pull requests read after the run
// expect: known positive — every selected step is derived done, each by a merged pull request of its own whose branch names the job that built it; the run's record names the selection, the limits, the six steps' jobs and the CI job and its End done; each job's record names the run; the run's author is alice, who is named once; nothing asked a person to click
test("TST-1045233: UC-043 postcondition — every selected step is merged and recorded, the run's record names the selection, the limits and every job", async () => {
  await ready({ ci: false });
  const result = await world.carryOut();
  await world.endRun("done");
  const facts = await world.facts();
  assert.deepEqual(facts.plan.states.map((state) => [state.item, state.state]), STEPS.map((step) => [step, "done"]), "known positive");
  const run = await world.run();
  for (const step of STEPS) {
    const job = run.jobs.find((each) => each.worksOn === step).job;
    assert.ok(facts.pullRequests.some((pull) => pull.state === "merged" && pull.branch === `agent-m/${job}`), `${step}: a merged pull request of its job`);
  }
  assert.deepEqual([run.state, run.selection, run.limits, run.jobs.length], ["finished", STEPS, LIMITS, 7]);
  const record = await world.record();
  assert.deepEqual([record.startedBy, record.end.state], ["alice", "done"]);
  assert.equal(result.clicks, 0);
  assert.ok((await world.rows()).filter((row) => row.record.kind !== "run").every((row) => row.record.run === RUN_ID && row.state === "done"));
});
