// Release tests of UC-043 "Run the process over a selection": one or more for each requirement UC-043 realises whose check is a test, checked from what a run's participant is given and what the product's repository holds — the
// actions nextActions gives, the records of the run and of its jobs, the gates and the pull requests. TST-1045301 maps every requirement UC-043 realises to the release tests that guard it, names the requirements the SPEC checks at
// review only, and names the requirement no release test guards yet. The six requirements whose check is tests/test_process_run.py are guarded there (tests/test_process_run.md).
// Run: node --test tests/release-uc-043-run-the-process-over-a-selection.test.mjs
//
// Module: MOD-run-planner
// Module: MOD-work-plans
// Module: MOD-product-process
// Module: MOD-job-ledger
// Module: MOD-progress-measures
// Guards: UC-043
// Level: release
//
// Written for the release testing of sprint 142 by developer-sonnet-k (ITM-1045). The Agent-M-Participant trailers of the code of UC-043 (git log --format='%h %(trailers:key=Agent-M-Participant)' -- src/run-planner src/implementation-pages
// src/work-plans src/product-process src/job-ledger src/progress-measures src/runtimes src/workflow-entries) name developer-sonnet-k for ITM-1329 and ITM-1333 (startSprint creates the sprint's branch, reads the holds again at the moved
// head and refuses a collision), ITM-800, ITM-1336 and ITM-1340 (the progress page), ITM-1278 (the declarations of the process models), ITM-1378 and ITM-1381 (the endpoint and the secret on the CI route), ITM-1259 (the GitLab merge request
// closes its issues) and ITM-1346 (a registration retried), most of the other commits there carrying no trailer. MOD-run-planner's code (nextActions, runOf, runStrategies) names developer-sonnet-a, developer-sonnet-b, developer-sonnet-d,
// developer-opus-e, developer-opus-f, developer-terra-a and developer-sonnet-j, not developer-sonnet-k. So:
//   - EVERY TEAM RUNS SPRINTS OF ITS OWN, whose behaviour includes what ITM-1329 and ITM-1333 built (a team starts a sprint of its own, and a collision with the holds of another is refused), has no case of this file; no release test guards it
//     yet (TST-475018 to TST-475028 of tests/test_parallel_sprints.py are component tests), and the map names it as open for a participant who built none of it (developer-sonnet-l is the one the sprint plan names for the cases others owe).
//   - The progress page, the route `implement` and the CI route's records are asserted in no case here; the system cases (tests/system-uc-043-run-the-process-over-a-selection.test.mjs), which the rule does not restrict, walk what they show.
// The world is tests/uc-043-harness.mjs; the release team works from the specification and the files: each case ends at the actions a run's participant is given, at the records the product holds and at what its facts derive. Readings the
// texts leave open, which the cases state:
//   - "A job reaching a gate does not proceed ... nor on a record by anyone else" (A JOB STOPS AT EVERY GATE) is read with MOD-product-process: whether a participant may decide a gate is `mayDecide`'s, at the time of the decision
//     (gates.mjs, the reading its file names), so the attempt of a participant who may not is refused by recordGateDecision and writes no record; the case asserts the refusal and the resumption on the holder's record.
//   - "A start is refused, naming the limit" (NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT) is read for a run as: nextActions starts no job while the items in progress under the role assignment have reached the limit, and starts one once
//     the count is below it; the naming of the limit is MOD-work-plans' startable, which a run does not show (asserted by the cases mapped to the route implement).
//   - "A job for work that no step of the plan names does not start" (A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN) is read for a run as: a name of the selection that is no step of the plan starts nothing.
//   - "Starting an implementation job without an item is refused" (AGILE IMPLEMENTATION STARTS FROM THE BACKLOG) is read for a run as: a selection that names no backlog item starts nothing, and a name that is no item starts nothing.
//   - "A job shows a cost only when its runtime reports one" (NO COST IS GUESSED) is read for the jobs of a run as the cost of their rows: unknown, never zero, and counted against a run's cost limit only when known.
//   - "The model determines the phases and the gates" is read for a run as: a gate the declared model adds to a phase keeps the steps of that phase from starting until its record stands.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { blobSha } from "../src/text-tools/index.mjs";
import { recordGateDecision } from "../src/product-process/index.mjs";
import { STEPS, V_MODEL, lines, openWorld, productFiles } from "./uc-043-harness.mjs";
import { MODELS, UC1, UC1_PATH, itemPath, product as backlogProduct, sprintPath, sprintText } from "./uc-032-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SELF = "tests/release-uc-043-run-the-process-over-a-selection.test.mjs";
const PY = "tests/test_process_run.py";
const UC = "docs/use-cases/UC-043-run-the-process-over-a-selection.md";
const GATE = "Validation & Verification → Operation & Maintenance";
const HEAD = "c0ffee".padEnd(40, "0");

let world = null;
test.afterEach(() => { world?.restore(); world = null; });

async function ready({ ci = true, limits = { jobsAtOnce: 3, cost: null, rounds: 5 }, selection = STEPS, ...options } = {}) {
  world = await openWorld(options);
  await world.startRun({ limits, selection });
  if (ci) await world.setUpCi();
  return world;
}
const startsOf = (actions) => actions.filter((action) => action.do === "start").map((action) => action.worksOn ?? action.kind);
const fixtureDeclaration = (model) => lines("---", `model: ${model}`, "model_file: docs/process-models/fixture.md", `model_version: ${HEAD}`, "---", "# How the fixture product is developed", "", "## Practices", "", "- none", "", "## Branches", "",
  "| Phase or time box | Branch |", "|---|---|", "", "## Definition of Done", "", "The job rules hold.");

// ---------------------------------------------------------------- the map

const UC024 = "tests/release-uc-024-implement-the-architecture.test.mjs";
const UC045 = "tests/release-uc-045-plan-the-implementation.test.mjs";
const UC025 = "tests/release-uc-025-validate-modules.test.mjs";
const UC031 = "tests/release-uc-031-requirements-of-a-model.test.mjs";
const UC022 = "tests/release-uc-022-derive-the-architecture.test.mjs";
const JOBREC = "tests/test_job_record.py";
// Each requirement UC-043 realises whose check is a test, with the release tests that guard it, in the order UC-043 lists them. A test named is declared at the level release and guards the requirement.
const EVIDENCE = {
  "A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION": [[PY, "TST-1045401"], [PY, "TST-1045402"], [UC025, "TST-741112"]],
  "A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS": [[PY, "TST-1045403"], [PY, "TST-1045404"]],
  "A RUN FOLLOWS THE MODULES' INTERFACES": [[PY, "TST-1045405"], [PY, "TST-1045406"], [UC045, "TST-1061109"]],
  "A RUN SETS UP CI BEFORE IT IMPLEMENTS": [[PY, "TST-1045407"], [PY, "TST-1045408"]],
  "A RUN HAS LIMITS FIXED AT ITS START": [[PY, "TST-1045409"], [PY, "TST-1045410"], [PY, "TST-1045411"]],
  "A RUN IS A JOB THAT NAMES ITS JOBS": [[JOBREC, "TST-1132004"]],
  "A RUN ENDS WITH THE VALIDATION OF ITS MODULES": [[PY, "TST-1045412"], [UC025, "TST-741112"]],
  "THE MODEL DETERMINES THE PHASES AND THE GATES": [[SELF, "TST-1045311"], [UC031, "TST-802302"], [UC045, "TST-1061106"]],
  "A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN": [[SELF, "TST-1045308"], [UC024, "TST-740302"], [UC045, "TST-1061101"]],
  "AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES": [[UC045, "TST-1061102"], ["tests/test_implementation_plan.py", "TST-1061201"]],
  "A PLAN STEP NAMES THE TESTS OF ITS LEVEL": [[UC045, "TST-1061103"], ["tests/test_implementation_plan.py", "TST-1061202"]],
  "AGILE IMPLEMENTATION STARTS FROM THE BACKLOG": [[SELF, "TST-1045306"], [UC024, "TST-740303"]],
  "A JOB GOES ONLY TO A HOLDER OF ITS ROLE": [[SELF, "TST-1045303"], [UC024, "TST-740305"]],
  "A JOB STOPS AT EVERY GATE": [[SELF, "TST-1045302"], [UC024, "TST-740306"], ["tests/release-itm-1190-jobs-page-waiting.test.mjs", "TST-1190304"]],
  "A GATE NAMES WHO DECIDES IT": [[SELF, "TST-1045302"], [UC024, "TST-740306"], [UC031, "TST-802309"]],
  "NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED": [[SELF, "TST-1045307"], [UC024, "TST-740304"]],
  "ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS": [[UC022, "TST-448311"], ["tests/release-itm-1315-accept-disabled.test.mjs", "TST-1315101"], ["tests/release-uc-023-review-pages.test.mjs", "TST-739104"]],
  "NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT": [[SELF, "TST-1045304"], ["tests/release-itm-1264-implement-stored-view.test.mjs", "TST-1264302"]],
  "RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER": [[SELF, "TST-1045305"]],
  "A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS": [[SELF, "TST-1045310"], [UC024, "TST-740313"], ["tests/test_definition_of_done.py", "TST-788003"]],
  "THE CORRECTION LOOP HAS A FIXED LIMIT": [["tests/release-uc-005-derive-requirements.test.mjs", "TST-579328"], ["tests/release-uc-007-derive-use-cases-from-requirements.test.mjs", "TST-580316"], ["tests/release-uc-019-change-requirements-by-prompt.test.mjs", "TST-418115"]],
  "NO COST IS GUESSED": [[SELF, "TST-1045309"], ["tests/test_job_cost.py", "TST-1136001"]],
  "A JOB IS RECORDED IN ITS PRODUCT REPOSITORY": [[JOBREC, "TST-1132001"], [UC024, "TST-740317"]],
};
// The requirements UC-043 realises that the SPEC checks at review and by no test.
const REVIEW = ["ONE CLICK PER DECISION"];
// The requirements UC-043 realises that no release test guards yet, with the reason: the behaviour of its writer.
const OPEN = { "EVERY TEAM RUNS SPRINTS OF ITS OWN": "developer-sonnet-k built startSprint's branch (ITM-1329) and its collision check (ITM-1333); a release case of it goes to a participant who built none of it" };

// TST-1045301 · level: release · module: system
// guards: UC-043
// given: UC-043 as committed text, whose `realises` lists 25 requirements, SPEC.md's Check sentence of each, and the release tests named in EVIDENCE, REVIEW and OPEN
// input: read UC-043's `realises`, and for each requirement its Check sentence in SPEC.md, the release tests named for it, and the declarations of their files
// expect: known positive — the 25 requirements are the 22 of EVIDENCE, the one of REVIEW and the one of OPEN; each of the 22 has a check that names a test, and each test named is declared in its file at the level release and guards that requirement; REVIEW's requirement has the Check "no automatic check"; OPEN's requirement is guarded at the level release by no test in tests/ today; the six requirements whose Check names tests/test_process_run.py are guarded by it
test("TST-1045301: UC-043 every requirement it realises has a release test, is guarded at review, or is named as open", () => {
  const uc = read(UC);
  const realised = [...uc.slice(uc.indexOf("realises:"), uc.indexOf("\n---\n", uc.indexOf("realises:"))).matchAll(/^  - ([A-Z][^\n]+)$/gm)].map((match) => match[1]);
  assert.equal(realised.length, 25, "known positive: UC-043 realises 25 requirements");
  assert.deepEqual([...realised].sort(), [...Object.keys(EVIDENCE), ...REVIEW, ...Object.keys(OPEN)].sort());
  const spec = read("SPEC.md");
  const checkOf = (name) => {
    const at = spec.indexOf(`**${name}** *(`);
    assert.ok(at >= 0, `${name} stands in SPEC.md`);
    return /\*Check:\*([^]*?)(?=\n\n\*\*|\n## |$)/.exec(spec.slice(at))[1].replace(/\s+/g, " ").trim();
  };
  const declarations = new Map();
  const declared = (file) => {
    if (!declarations.has(file)) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${file} exists`);
      declarations.set(file, testDeclarations(file, read(file)));
    }
    return declarations.get(file);
  };
  for (const [name, tests] of Object.entries(EVIDENCE)) {
    assert.ok(!/^no automatic check/.test(checkOf(name)), `${name} has a check that is a test`);
    assert.ok(tests.length > 0, `${name} names a release test`);
    for (const [file, id] of tests) {
      const each = declared(file).find((candidate) => candidate.id === id);
      assert.ok(each, `${name}: ${id} is declared in ${file}`);
      assert.equal(each.level, "release", `${id} is a release test`);
      assert.ok((each.guards ?? []).includes(name), `${id} guards ${name}`);
    }
  }
  for (const name of REVIEW) assert.match(checkOf(name), /^no automatic check/, `${name} is checked at review`);
  for (const name of Object.keys(OPEN)) {
    for (const file of ["tests/test_parallel_sprints.py"]) {
      assert.deepEqual(declared(file).filter((each) => each.level === "release" && (each.guards ?? []).includes(name)), [], `known positive for the gap: no release test of ${file} guards ${name}`);
    }
  }
  const named = realised.filter((name) => checkOf(name).includes("tests/test_process_run.py"));
  assert.equal(named.length, 6, "known positive: six requirements name tests/test_process_run.py");
  for (const name of named) assert.ok(EVIDENCE[name].some(([file]) => file === PY), `${name} is guarded by ${PY}`);
});

// ---------------------------------------------------------------- the gates

// TST-1045302 · level: release · module: system
// guards: UC-043; A JOB STOPS AT EVERY GATE; A GATE NAMES WHO DECIDES IT; A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT
// given: a run over the six steps with CI configured, ITM-101's job (dev-a) waiting at Validation & Verification → Operation & Maintenance, which the V-model gives to the Reviewer, bob holding that role in the product's one role assignment; alice, the Product owner, holds no such role
// input: dev-a, the participant whose work the gate checks, and alice each try to decide the gate; then bob does; the next actions of the run after each
// expect: known positive — before any decision the job waits and the run waits at a gate; dev-a's and alice's attempts are refused with MayNotDecide, write no record and leave the job waiting; bob's decision writes one record of the gate and the next actions resume ITM-101's own job on its own participant and route
test("TST-1045302: UC-043 a job waits at its gate until the gate's decider has recorded a decision, and a participant who may not decide leaves it waiting", async () => {
  await ready();
  const [first] = await world.next();
  const job = await world.begin(first);
  await world.reachGate(job, GATE, "Reviewer");
  assert.equal((await world.run()).state, "waiting at a gate", "known positive: the job waits");
  const facts = await world.facts();
  const context = async () => ({ workflow: facts.workflow, assignment: facts.assignments[0], workBy: ["dev-a"], head: await world.head(), now: new Date("2026-11-01T11:00:00Z"), trailers: [] });
  for (const who of [{ name: "dev-a", kind: "agent" }, { name: "alice", kind: "person" }]) {
    await assert.rejects(async () => recordGateDecision(world.host, { gate: GATE, job, decider: who, role: "Reviewer", decision: "passed", reason: "", on: [HEAD] }, await context()), { name: "MayNotDecide" }, `${who.name} may not decide`);
  }
  const waiting = await world.rows();
  assert.deepEqual(waiting.filter((row) => row.record.id === job).map((row) => row.state), ["waiting at a gate"]);
  assert.deepEqual((await world.next()).filter((action) => action.do === "resume"), [], "no resumption without a decision of the decider");
  const written = await recordGateDecision(world.host, { gate: GATE, job, decider: { name: "bob", kind: "person" }, role: "Reviewer", decision: "passed", reason: "", on: [HEAD] }, await context());
  assert.match(written.path, /^docs\/gates\/.*validation-verification-operation-maintenance/);
  const resumed = (await world.next()).filter((action) => action.do === "resume");
  assert.deepEqual(resumed.map((action) => [action.job, action.worksOn, action.participant, action.route]), [[job, "ITM-101", "dev-a", "ci hosted"]]);
});

// ---------------------------------------------------------------- the holder of the role

// TST-1045303 · level: release · module: system
// guards: UC-043; A JOB GOES ONLY TO A HOLDER OF ITS ROLE
// given: the planned product whose one role assignment gives the role Developer to dev-b only (dev-a, who declares every capability the role needs, holds Tester); the same product with dev-a as Developer; the Scrum product of tests/uc-032-harness.mjs with two role assignments — team1's builders dev-a, team2's dev-b — whose sprints select ITM-001 for team1 and ITM-003 for team2
// input: nextActions of a run over the six steps for each of the first two; of a run over ITM-001 and ITM-003 for the Scrum product
// expect: known positive — with dev-b as Developer every job goes to dev-b and none to dev-a; with dev-a as Developer every job goes to dev-a; in the Scrum product ITM-001 goes to dev-a, the holder in team1's assignment, and ITM-003 to dev-b, the holder in team2's
test("TST-1045303: UC-043 each job of a run goes to a holder of its role in the job's role assignment", async () => {
  const assignment = (developer) => lines("# plan", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Product owner | alice |", `| Developer | ${developer} |`, `| Tester | ${developer === "dev-a" ? "dev-b" : "dev-a"} |`, "| Reviewer | bob |");
  await ready({ files: await productFiles({ "docs/role-assignments/plan.md": assignment("dev-b") }) });
  const toB = await world.next();
  assert.ok(toB.length > 0, "known positive: jobs start");
  assert.deepEqual([...new Set(toB.map((action) => action.participant))], ["dev-b"]);
  world.restore();
  await ready({ files: await productFiles({ "docs/role-assignments/plan.md": assignment("dev-a") }) });
  assert.deepEqual([...new Set((await world.next()).map((action) => action.participant))], ["dev-a"]);
  world.restore();
  const files = await backlogProduct({ files: { [itemPath(5)]: null, [sprintPath("team2", 1)]: sprintText({ n: 1, goal: "Mail", selection: ["ITM-003"], branch: "sprint/team2/01" }) } });
  await ready({ files, instanceFiles: { "docs/process-models/fixture.md": MODELS.scrum }, selection: ["ITM-001", "ITM-003"] });
  assert.deepEqual((await world.next()).map((action) => [action.worksOn, action.participant]), [["ITM-001", "dev-a"], ["ITM-003", "dev-b"]]);
});

// ---------------------------------------------------------------- the limit of work in progress

// TST-1045304 · level: release · module: system
// guards: UC-043; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; AGILE IMPLEMENTATION STARTS FROM THE BACKLOG
// given: the Kanban product of tests/uc-032-harness.mjs — a work-in-progress limit of 2, one role assignment, ITM-010 running a job —, CI configured, and a run with jobs at once 3 over ITM-001, ITM-003 and ITM-005
// input: nextActions; the job of the first item started; nextActions; that job ended done with its pull request merged; nextActions
// expect: counter-proof — with one item in progress one start; once the job is started the items in progress have reached the limit of 2 and nothing starts though the run's own limit is 3 and two items are ready; once it is merged, below the limit, the next item starts
test("TST-1045304: UC-043 a run starts no job while the items in progress under the role assignment have reached the work-in-progress limit", async () => {
  const files = await backlogProduct({ model: MODELS.kanban, files: { "docs/process.md": fixtureDeclaration("fixture-kanban"), "docs/backlog/sprints/team1/02.md": null, "docs/role-assignments/team2.md": null } });
  await ready({ files, instanceFiles: { "docs/process-models/fixture.md": MODELS.kanban }, selection: ["ITM-001", "ITM-003", "ITM-005"] });
  const first = await world.next();
  assert.deepEqual(startsOf(first), ["ITM-001"], "one start below the limit");
  const job = await world.begin(first[0]);
  assert.deepEqual(await world.next(), [], "at the limit nothing starts, though ITM-003 and ITM-005 are ready and the run allows 3");
  await world.end(job, "done");
  world.merge("ITM-001", job);
  assert.deepEqual(startsOf(await world.next()), ["ITM-003"], "below the limit again, the next item starts");
});

// ---------------------------------------------------------------- the cost

// TST-1045309 · level: release · module: system
// guards: UC-043; NO COST IS GUESSED; A RUN HAS LIMITS FIXED AT ITS START
// given: a run over the six steps with a cost limit of 5 and CI configured; two jobs ended done, the runtime having reported no cost for either; then the same run in which the first job's runtime reported a cost of 6
// input: the job rows of the run, and runOf for each
// expect: known positive — the rows of the two jobs show the cost as unknown, with no amount, never zero; the run is not held, though a job of unknown cost may have cost anything; with the cost 6 reported the row shows it known as reported and the run is held by a limit
test("TST-1045309: UC-043 a run counts against its cost limit only the cost a runtime reported, and an unreported cost is shown as unknown", async () => {
  await ready({ limits: { jobsAtOnce: 3, cost: 5, rounds: 5 } });
  const [a, b] = await world.next();
  const one = await world.begin(a);
  const two = await world.begin(b);
  await world.end(one, "done");
  await world.end(two, "done");
  const rows = (await world.rows()).filter((row) => row.record.kind !== "run");
  assert.deepEqual(rows.map((row) => row.cost), [{ known: false, usage: null }, { known: false, usage: null }], "known positive: unknown, never zero");
  assert.equal((await world.run()).state, "running");
  world.restore();
  await ready({ limits: { jobsAtOnce: 3, cost: 5, rounds: 5 } });
  const [first] = await world.next();
  const costly = await world.begin(first);
  await world.end(costly, "done", { amount: 6 });
  const row = (await world.rows()).find((each) => each.record.id === costly);
  assert.deepEqual(row.cost, { known: true, amount: 6, currency: "EUR", basis: "reported" });
  assert.equal((await world.run()).state, "held by a limit");
});

// ---------------------------------------------------------------- the tests of the run

// TST-1045305 · level: release · module: system
// guards: UC-043; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
// given: a run over the six steps, CI configured, every step implemented by dev-a and merged
// input: the next actions of the run after the last merge
// expect: known positive — dev-a implemented the six steps; then the start of a job that writes the release tests of the selection, on a participant other than dev-a; none goes to the implementer
test("TST-1045305: UC-043 the release tests of a run go to a participant other than the one who implemented", { todo: "FINDING UC043-F5 (no module) — nextActions (src/run-planner/next.mjs:109-138) gives only the kinds set-up-ci and implement, resume and refuse; no job of the kinds write-tests, propose-tests or run-tests is started for the selection, to a participant or to any other; ITM-978 was withdrawn with akmaier's decision of 2026-10-28 (3a3938318), and MOD-run-planner's text assigns the run's tests part to no function" }, async () => {
  await ready();
  const result = await world.carryOut();
  assert.deepEqual([...new Set(result.waves.flat().filter((each) => each.kind === "implement").map((each) => each.participant))], ["dev-a"], "known positive: dev-a implemented the steps");
  const tests = (await world.next()).filter((action) => action.do === "start" && ["write-tests", "propose-tests"].includes(action.kind));
  assert.ok(tests.length > 0, "the release tests are started");
  assert.ok(tests.every((action) => action.participant !== "dev-a"));
});

// ---------------------------------------------------------------- the backlog and the plan

// TST-1045306 · level: release · module: system
// guards: UC-043; AGILE IMPLEMENTATION STARTS FROM THE BACKLOG
// given: the Kanban product of tests/uc-032-harness.mjs with CI configured, and a run whose selection names the item ITM-001, the module MOD-store, the use case UC-001 and a name no item has, ITM-999; and a run whose selection names only MOD-store and ITM-999
// input: nextActions for each
// expect: counter-proof — every start names a backlog item: ITM-001 starts, and MOD-store, UC-001 and ITM-999 start nothing; the run that names no item starts nothing at all
test("TST-1045306: UC-043 a run in a model that works from a backlog starts only items of the backlog", async () => {
  const files = await backlogProduct({ model: MODELS.kanban, files: { "docs/process.md": fixtureDeclaration("fixture-kanban"), "docs/backlog/sprints/team1/02.md": null, "docs/role-assignments/team2.md": null } });
  await ready({ files, instanceFiles: { "docs/process-models/fixture.md": MODELS.kanban }, selection: ["ITM-001", "MOD-store", "UC-001", "ITM-999"] });
  const actions = await world.next();
  assert.deepEqual(actions.map((action) => [action.do, action.kind, action.worksOn]), [["start", "implement", "ITM-001"]]);
  world.restore();
  await ready({ files, instanceFiles: { "docs/process-models/fixture.md": MODELS.kanban }, selection: ["MOD-store", "ITM-999"] });
  assert.deepEqual(await world.next(), []);
});

// TST-1045307 · level: release · module: system
// guards: UC-043; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED
// given: the planned product whose use case UC-001, which every step realises, has no approval record, with CI configured and a run over the six steps; then the approval record of its current text committed
// input: nextActions before and after the record
// expect: counter-proof — while UC-001 is open no step starts and every step is derived waiting for acceptance, naming UC-001; once an approval record names its text ITM-101 and ITM-103 start
test("TST-1045307: UC-043 a run starts no step that names an open proposal, and starts it once an approval record names the proposal's text", async () => {
  await ready({ files: await productFiles({}, { open: [UC1_PATH] }) });
  assert.deepEqual(await world.next(), []);
  const states = (await world.facts()).plan.states;
  assert.ok(states.every((state) => state.state === "waiting for acceptance" && state.reason.includes("UC-001")), "known positive: each step waits for UC-001");
  const blob = await blobSha(UC1);
  await world.commit([{ path: `docs/approvals/UC-001-${blob.slice(0, 12)}.md`, text: lines("kind: use-case", `file: ${UC1_PATH}`, `blob: ${blob}`) }], "UC-001 accepted");
  assert.deepEqual(startsOf(await world.next()), ["ITM-101", "ITM-103"]);
});

// TST-1045308 · level: release · module: system
// guards: UC-043; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN
// given: the planned V-model product with CI configured, and a run whose selection names the step ITM-101, the module MOD-store, which no step of the plan names, and ITM-999, which the plan lacks
// input: nextActions
// expect: counter-proof — a job starts for the step of the plan and for nothing else: one start, ITM-101
test("TST-1045308: UC-043 a run in a planned model starts only the steps of the plan", async () => {
  await ready({ selection: ["MOD-store", "ITM-999", "ITM-101"] });
  assert.deepEqual((await world.next()).map((action) => [action.do, action.kind, action.worksOn]), [["start", "implement", "ITM-101"]]);
});

// ---------------------------------------------------------------- the merge

// TST-1045310 · level: release · module: system
// guards: UC-043; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
// given: a run over the six steps with CI configured; ITM-101's job ended done, and the pull request of its branch is open, not merged
// input: the derived states of the steps and nextActions; then the pull request merged
// expect: counter-proof — the step is not done while its pull request is open: it is in progress, with the pull request named, and ITM-102, which builds on it, does not start; once the pull request is merged ITM-101 is done and ITM-102 starts
test("TST-1045310: UC-043 a step is done only by a merged pull request, and the steps that build on it wait for the merge", async () => {
  await ready();
  const [a] = await world.next();
  const job = await world.begin(a);
  await world.end(job, "done");
  world.pulls.push({ number: 1, title: `${job}: implement ITM-101`, branch: `agent-m/${job}`, base: "main", head: "1".repeat(40), state: "open", draft: false, url: "https://github.com/alice/thesis-tool/pull/1", opened: "2026-11-01T09:30:00Z", merged: null,
    closed: null, body: `Job: ${job}\nPlan step: ITM-101`, updated: "2026-11-01T09:30:00Z", mergeCommit: null });
  const states = (await world.facts()).plan.states;
  assert.deepEqual([states[0].state, states[0].pullRequest, states[1].state], ["in progress", "1", "waiting for an item it builds on"]);
  assert.ok(!startsOf(await world.next()).includes("ITM-102"));
  world.pulls[0].state = "closed";
  world.pulls[0].merged = "2026-11-01T09:45:00Z";
  world.pulls[0].closed = "2026-11-01T09:45:00Z";
  assert.equal((await world.facts()).plan.states[0].state, "done");
  assert.ok(startsOf(await world.next()).includes("ITM-102"));
});

// ---------------------------------------------------------------- the gates of the model

// TST-1045311 · level: release · module: system
// guards: UC-043; THE MODEL DETERMINES THE PHASES AND THE GATES; A GATE NAMES WHO DECIDES IT
// given: the planned product whose declared V-model, as the instance holds it, adds a gate Implementation → Testing decided by the Reviewer; both gates before Implementation recorded; CI configured; a run over the six steps carried out to the end of the phase Implementation
// input: nextActions once ITM-101, ITM-102 and ITM-103 are done; then the gate recorded by bob, the Reviewer
// expect: known positive — the three steps of the phase Implementation start and are done; the steps of the phase Testing do not start while the gate has no record, though the steps they build on are done; with the record ITM-104 and ITM-105 start
test("TST-1045311: UC-043 a gate the declared model puts before a phase keeps the steps of that phase from starting until it is recorded", async () => {
  const gated = V_MODEL.replace("| Design → Implementation |", "| Implementation → Testing | the MOD files of the implementation | the implementation is documented before it is tested | Reviewer |\n| Design → Implementation |");
  assert.notEqual(gated, V_MODEL, "known positive: the model gains the gate");
  await ready({ instanceFiles: { "docs/process-models/v-model.md": gated, "src/model-catalogue/models/v-model.md": gated } });
  const result = await world.carryOut({ maxRounds: 4 });
  assert.deepEqual(result.waves.map((wave) => wave.map((each) => each.worksOn)).slice(0, 2), [["ITM-101", "ITM-103"], ["ITM-102"]], "the phase Implementation is built");
  const facts = await world.facts();
  assert.deepEqual(facts.plan.states.map((state) => state.state).slice(0, 3), ["done", "done", "done"]);
  assert.ok(facts.gateStates.some((gate) => gate.gate === "Implementation → Testing" && gate.state === "pending"), "the gate is pending");
  assert.deepEqual(startsOf(await world.next()), [], "no step of the phase Testing starts");
  await world.decide("Implementation → Testing", "Reviewer", "bob", { name: "implementation-testing-cccc" });
  assert.deepEqual(startsOf(await world.next()), ["ITM-104", "ITM-105"]);
});
