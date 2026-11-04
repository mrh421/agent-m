// Release tests of the requirements UC-034 "Implement backlog items with a coding agent" realises, each checked from what an author reads on the dashboard, from the files the fixture hosts received and from the actions a run computes: TST-805301
// maps every requirement UC-034 realises to the release tests that guard it, and the cases here guard what no release test guarded: a run that continues without a click between its jobs, the limits of a run, and the sprints of every team
// side by side. The gate and the assignment have the checks the SPEC names: tests/test_job_gate.py, tests/test_gate_record.py and tests/test_job_assignment.py.
// Run: node --test tests/release-uc-034-implement-backlog-items.test.mjs
//
// Module: MOD-run-planner
// Module: MOD-implementation-pages
// Module: MOD-work-plans
// Module: MOD-main-page
// Guards: UC-034
// Level: release
//
// Written for the release testing of sprint 142 by developer-sonnet-j (ITM-805). The `Agent-M-Participant` trailers of the code UC-034's flow runs name developer-opus-a, -b, -e and -f, developer-sonnet-a, -b, -c, -d, -e, -j and -k, developer-terra-a
// and -b, developer-sol-b and scrum-master-opus (src/implementation-pages, src/product-process, src/main-page, src/workflow-entries, src/work-plans, src/run-planner, src/runtimes, src/job-ledger, src/job-runner, src/progress-measures);
// most commits of it carry no trailer. developer-sonnet-j built ITM-817 (backlogFindings of MOD-work-plans, which guards A BACKLOG ITEM NAMES THE MODULES IT CHANGES), ITM-1316 (the mark of a done item), ITM-1330 and ITM-1332 (when a sprint's
// burn-down is final), ITM-1343 (the Needs cell of a gate), ITM-1272, ITM-1368 and ITM-1371. So no case here guards a requirement through that code: A BACKLOG ITEM NAMES THE MODULES IT CHANGES is mapped to the release tests other writers wrote,
// and the sprint case plans, starts and ends sprints and asserts nothing of the burn-down. The release team works from the specification and the pages. Where the page and the SPEC or UC-034 disagree the case follows the text and is marked `todo` with
// the word FINDING. Readings the texts leave open, which the cases state:
//   - A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS is read of the actions MOD-run-planner computes: the same function, asked again after each job ended, gives the next starts, and every action is one the run's session carries out itself.
//   - "stops starting jobs when one of them is reached" (A RUN HAS LIMITS FIXED AT ITS START) is read as: once the cost the rows report reaches the cost limit in force, the next actions start no job and one of them says why.
//   - "Each team plans, starts and closes sprints of its own" (EVERY TEAM RUNS SPRINTS OF ITS OWN) is read as: a sprint of one team planned, started and ended on the pages writes the record of that team's sprint and no other file, and leaves the other
//     team's record as it was.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { roleAssignmentSchema } from "../src/product-process/index.mjs";
import { traceGraph } from "../src/trace-graph/index.mjs";
import { itemStates } from "../src/work-plans/index.mjs";
import { appendToRecord, recordsNewestFirst, startRecord } from "../src/job-ledger/index.mjs";
import * as planner from "../src/run-planner/index.mjs";
import { facts } from "./progress-measures-facts.mjs";
import { MODELS, disabledOf, found, open, planOf, product, tickOf, typeValue } from "./uc-032-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-034-implement-backlog-items-with-a-coding-agent.md";
const SELF = "tests/release-uc-034-implement-backlog-items.test.mjs";
const UC24 = "tests/release-uc-024-implement-the-architecture.test.mjs", UC25 = "tests/release-uc-025-validate-modules.test.mjs", UC32 = "tests/release-uc-032-the-backlog-and-its-items.test.mjs";
const STORED = "tests/release-itm-1264-implement-stored-view.test.mjs", TARGET = "tests/release-itm-1171-target-branch.test.mjs";
const GATE = "tests/test_job_gate.py", RECORD = "tests/test_gate_record.py", ASSIGNMENT = "tests/test_job_assignment.py";

// ---------------------------------------------------------------- the map

// Each requirement UC-034 realises, with the release tests that guard it: this file's, the checks of the Python files beside it, and those other writers wrote.
const EVIDENCE = {
  "AGILE IMPLEMENTATION STARTS FROM THE BACKLOG": [[UC24, "TST-740303"]],
  "A BACKLOG ITEM NAMES THE MODULES IT CHANGES": [[UC32, "TST-803103"], ["tests/release-itm-987-close-new-items.test.mjs", "TST-987303"]],
  "A RUN FOLLOWS THE MODULES' INTERFACES": [["tests/release-uc-045-plan-the-implementation.test.mjs", "TST-1061109"], ["tests/test_implementation_plan.py", "TST-1061201"]],
  "A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN": [[UC24, "TST-740302"], ["tests/release-uc-045-plan-the-implementation.test.mjs", "TST-1061101"]],
  "AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES": [[UC24, "TST-740310"], ["tests/test_implementation_job.py", "TST-413100"]],
  "DEVELOP AGAINST INTERFACES": [[UC24, "TST-740311"], ["tests/release-itm-1067-register-entries.test.mjs", "TST-1067301"]],
  "NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED": [[UC24, "TST-740304"], ["tests/release-uc-033-move-an-issue-into-the-backlog.test.mjs", "TST-804305"]],
  "NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT": [[STORED, "TST-1264302"]],
  "A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT": [[STORED, "TST-1264303"], ["tests/release-itm-1327-selection-notice.test.mjs", "TST-1327101"]],
  "A JOB GOES ONLY TO A HOLDER OF ITS ROLE": [[UC24, "TST-740305"], [ASSIGNMENT, "TST-805601"]],
  "AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST": [[UC24, "TST-740309"], ["tests/test_implementation_job.py", "TST-413100"]],
  "A JOB STOPS AT EVERY GATE": [[UC24, "TST-740306"], [GATE, "TST-805401"], [GATE, "TST-805402"]],
  "CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI": [["tests/release-uc-012-handle-an-issue.test.mjs", "TST-585305"]],
  "A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS": [[UC24, "TST-740313"], ["tests/test_definition_of_done.py", "TST-788003"], [STORED, "TST-1264307"]],
  "A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN": [[TARGET, "TST-1171101"], ["tests/release-itm-1329-refused-start-leaves-no-branch.test.mjs", "TST-1329101"]],
  "WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET": [[TARGET, "TST-1171102"]],
  "A PROCESS REQUIREMENT ADDS TO THE MODEL": [["tests/release-sprint-16-practice-workflow.test.mjs", "TST-478005"], [GATE, "TST-805402"]],
  "A ROLE NAMES THE CAPABILITIES IT NEEDS": [["tests/release-uc-048-fill-the-roles.test.mjs", "TST-1063102"], ["tests/release-uc-031-requirements-of-a-model.test.mjs", "TST-802305"]],
  "RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS": [[UC24, "TST-740315"]],
  "THE PAGE NAMES WHERE IT SENDS": [[UC24, "TST-740316"]],
  "THE GATE IS RECORDED": [[UC24, "TST-740308"], ["tests/release-itm-1338-gate-record-link.test.mjs", "TST-1338101"], [RECORD, "TST-805501"]],
  "EVERY ARTIFACT NAMES ITS ORIGIN": [[UC24, "TST-740312"]],
  "AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT": [["tests/release-uc-049-talk-to-an-agent-in-the-prompt-bar.test.mjs", "TST-513207"], ["tests/release-uc-022-derive-the-architecture.test.mjs", "TST-448327"]],
  "ONE DEFINITION, THREE DRIVERS": [["tests/release-uc-010-run-a-job-in-github-actions.test.mjs", "TST-373308"]],
  "THE LOCAL BRIDGE REQUIRES A TOKEN": [["tests/test_bridge_token.py", "TST-813002"]],
  "NO SECRET IN THE REPOSITORY": [[UC24, "TST-740317"]],
  "ONE CLICK PER DECISION": [[UC24, "TST-740318"]],
  "A JOB IS RECORDED IN ITS PRODUCT REPOSITORY": [["tests/test_job_record.py", "TST-1132001"], [UC24, "TST-740317"]],
  "A GATE NAMES WHO DECIDES IT": [[UC24, "TST-740306"], ["tests/release-uc-031-requirements-of-a-model.test.mjs", "TST-802309"], [GATE, "TST-805402"]],
  "A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS": [[UC24, "TST-740307"], [GATE, "TST-805403"]],
  "A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION": [[UC25, "TST-741112"]],
  "A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS": [[SELF, "TST-805302"]],
  "A RUN HAS LIMITS FIXED AT ITS START": [[SELF, "TST-805303"]],
  "EVERY TEAM RUNS SPRINTS OF ITS OWN": [[SELF, "TST-805304"]],
  "A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT": [[GATE, "TST-805404"], [SELF, "TST-805306"]],
  "SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES": [["tests/release-itm-1333-moved-start-names-the-collision.test.mjs", "TST-1333101"]],
  "AN IMPLEMENTATION JOB RECEIVES THE CHAPTERS ON MODELING, DESIGN, IMPLEMENTATION AND TESTING": [[UC24, "TST-740321"], ["tests/test_job_reading_checkout.py", "TST-417100"]],
};

// TST-805301 · level: release · module: system
// guards: UC-034
// given: UC-034 as committed text, whose `realises` lists thirty-seven requirements, and the release tests named in EVIDENCE
// input: read UC-034's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-034 realises these thirty-seven requirements; each has at least one release test named; each test named stands in its file with the level release and guards that requirement; no release case written by developer-sonnet-j guards A BACKLOG ITEM NAMES THE MODULES IT CHANGES, the requirement its ITM-817 built
test("TST-805301: UC-034 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 37, "known positive: UC-034 realises thirty-seven requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-034 realises");
  for (const [requirement, named] of Object.entries(EVIDENCE)) {
    assert.ok(named.length > 0, `${requirement}: a test is named`);
    for (const [file, id] of named) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${requirement}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
  const mine = new Set(Object.entries(EVIDENCE).filter(([, named]) => named.some(([file]) => [SELF, GATE, RECORD, ASSIGNMENT].includes(file))).map(([requirement]) => requirement));
  assert.ok(!mine.has("A BACKLOG ITEM NAMES THE MODULES IT CHANGES"), "the requirement ITM-817 built has no release case of this file");
});

// ---------------------------------------------------------------- a run

const lines = (...rows) => `${rows.join("\n")}\n`;
const moduleText = (id) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "uses: []", "provides:", "  - run", "---", `# ${id}`, "", "## Responsibility", "", "One concern.", "", "## Interfaces", "",
  "- `run() -> text` - runs.");
const itemText = (id, module) => lines("---", `id: ${id}`, `title: ${id} item`, "level: module", "realises:", "  - UC-001", "modules:", `  - ${module}`, "tests:", "  - unit", "origin:", "  - UC-001", "---", `# ${id} item`, "", "## Outcome", "", "o",
  "", "## Acceptance", "", "a");
const documentOf = (id, module) => ({ kind: "item", path: `docs/backlog/${id}-item.md`, id, fields: { id, realises: ["UC-001"], modules: [module], builds_on: [], level: "module" }, sections: [] });
const IDS = ["ITM-001", "ITM-002", "ITM-003", "ITM-004", "ITM-005"];
const MODULES = Object.fromEntries(IDS.map((id, at) => [id, `MOD-${"abcde"[at]}`]));
const STATUSES = new Map([["UC-001", { id: "UC-001", kind: "use-case", status: "accepted" }]]);
const DEVELOPERS = { name: "Developers", filledBy: "agent", howMany: "several", capabilities: ["read the repository", "write to the repository", "run code and tests"] };
const workflowOf = (gated) => ({
  model: { name: "kanban", kind: "pulled", flow: { wip: null, timeBox: null, sprints: false } },
  phases: [{ name: "Planning", roles: ["Product Owner"], produces: ["ITM"] }, { name: "Development", roles: ["Developers"], produces: ["MOD", "TST"] }],
  transitions: [{ from: "Planning", to: "Development", kind: "handoff" }],
  gates: gated ? [{ name: "Planning -> Development", from: "Planning", to: "Development", artifacts: "plan", condition: "the plan is accepted", decider: "Product Owner", addedBy: null, practice: null }] : [],
  roles: [{ name: "Product Owner", filledBy: "person", howMany: "one", capabilities: ["read the repository"] }, DEVELOPERS], branches: {}, done: [],
});
const PARTICIPANTS = [{ name: "alice", type: "person", model: null, capabilities: ["read the repository", "write to the repository"], place: null, route: "account alice" },
  { name: "dev-a", type: "CLI agent", model: "model-a", capabilities: ["read the repository", "write to the repository", "run code and tests"], place: "this machine", route: "bridge lab agent claude" }];
const ASSIGNMENT_DOC = readDocument(roleAssignmentSchema, "docs/role-assignments/team1.md", lines("# team1", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Product Owner | alice |", "| Developers | dev-a |"));
const merged = (id, number) => ({ number, title: `${id} work`, branch: `work/${id}`, base: "main", head: "a".repeat(40), state: "merged", draft: false, url: `https://example.invalid/${number}`, opened: "2026-10-13T08:00:00Z",
  merged: "2026-10-13T09:00:00Z", closed: null });
const rowOf = (id, worksOn, state = "running", cost = null) => ({ record: { id, kind: "implement", worksOn: [worksOn], participant: "dev-a", route: "bridge lab", run: "JOB-20261023-0900-run1", gates: [], question: null, path: `docs/jobs/${id}.md` },
  product: "https://github.com/alice/product", state, elapsed: 0, cost: cost === null ? { known: false, usage: null } : { known: true, amount: cost, currency: "USD", basis: "reported" }, source: { reachable: true, reason: null } });
const orderOf = (steps) => ({ path: "docs/plan/order.md", fields: {}, sections: [{ heading: "## Order", rows: steps.map(([Step, Phase]) => ({ cells: { Step, Phase } })) }] });

/** The facts of the product after `done` items were merged and with the job rows `jobs`; `gated` puts a gate before the phase Development, in the state `gate`, for the items `behind` the order names in it. */
async function factsOf({ done = [], jobs = [], gated = false, gate = "pending", behind = [] } = {}) {
  const workflow = workflowOf(gated);
  const documents = IDS.map((id) => documentOf(id, MODULES[id]));
  const files = { ...Object.fromEntries(IDS.map((id) => [`docs/architecture/${MODULES[id]}.md`, moduleText(MODULES[id])])), ...Object.fromEntries(IDS.map((id) => [`docs/backlog/${id}-item.md`, itemText(id, MODULES[id])])) };
  const graph = await traceGraph({ paths: Object.keys(files), read: async (path) => files[path] ?? null });
  assert.deepEqual(graph.unread, [], "known positive: every fixture file is read");
  const order = gated ? orderOf(behind.map((id) => [id, "Development"])) : null;
  const gateStates = gated ? [{ gate: "Planning -> Development", state: gate, record: gate === "passed" ? "docs/gates/20261023-0900-planning-development-ab12.md" : null, needs: null, difference: null }] : [];
  const pullRequests = done.map((id, at) => merged(id, at + 1));
  const states = itemStates(documents, order, { statuses: STATUSES, queues: [], jobs, pullRequests, gates: gateStates, workflow });
  return facts({ workflow, model: workflow.model, participants: PARTICIPANTS, assignments: [ASSIGNMENT_DOC], plan: { order, items: documents, states }, jobs, pullRequests, gateStates, graph,
    ci: { runs: [], configured: true, drift: [], jobWorkflow: true }, resourceNeeds: [], info: { defaultBranch: "main", visibility: "private" } });
}
const runOf = ({ jobsAtOnce = 3, jobs = [], state = "running" } = {}) => ({ id: "JOB-20261023-0900-run1", selection: IDS, limits: { jobsAtOnce, cost: null, rounds: 5 }, jobs, state });

// TST-805302 · level: release · module: MOD-run-planner
// guards: A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; UC-034
// given: a run of the five items ITM-001 to ITM-005, each on a module of its own that uses none, with three jobs at once, in a Kanban product with no gate; then the same run where ITM-004 and ITM-005 stand in the phase Development behind the gate "Planning -> Development", which the Product Owner has not decided
// input: the actions of the run asked for after the run started, and again after each running job ended with its pull request merged, until none is left; then, with the gate undecided, the actions asked for, and after the gate is passed
// expect: the first ask gives three starts, ITM-001, ITM-002 and ITM-003, and every later ask the starts that fill the places the ended jobs left — ITM-004 after the first job ended, ITM-005 after the second —, no ask gives an action that is no start, the five jobs are started with no more than three running at once and nothing for a person to do between them; behind the undecided gate only the three items outside the phase start and the two behind it wait, there and nowhere else, and they start once the gate is passed
test("TST-805302: UC-034 a run starts the next job of its selection by itself as each ends, up to the jobs at once, and waits at a gate nowhere else", async () => {
  assert.equal(typeof planner.nextActions, "function", "nextActions is built");
  const startedJobs = [];
  const running = new Set(), done = [], starts = [];
  let most = 0;
  for (let round = 0; round < 8 && done.length < IDS.length; round += 1) {
    const rows = [...running].map((item) => rowOf(`JOB-20261023-09${item.slice(-1)}0-aaaa`, item));
    const actions = planner.nextActions(runOf({ jobs: startedJobs }), await factsOf({ done, jobs: rows }));
    assert.ok(actions.every((action) => action.do === "start" && action.kind === "implement" && action.participant === "dev-a"), JSON.stringify(actions));
    for (const action of actions) { running.add(action.worksOn); startedJobs.push({ job: `JOB-20261023-09${action.worksOn.slice(-1)}0-aaaa`, kind: "implement", worksOn: action.worksOn }); starts.push(action.worksOn); }
    most = Math.max(most, running.size);
    const [ended] = [...running];
    running.delete(ended);
    done.push(ended);
  }
  assert.deepEqual(starts, IDS, "the five jobs start in the order of the selection, with no click between them");
  assert.ok(most <= 3, `at most three jobs run at once: ${most}`);
  assert.equal(most, 3, "known positive: the three places are filled");

  const behind = ["ITM-004", "ITM-005"];
  const waiting = planner.nextActions(runOf(), await factsOf({ gated: true, behind }));
  assert.deepEqual(waiting.map((action) => action.worksOn).sort(), ["ITM-001", "ITM-002", "ITM-003"], "the items outside the gated phase go on");
  const after = planner.nextActions(runOf({ jobsAtOnce: 5 }), await factsOf({ gated: true, behind, gate: "pending" }));
  assert.deepEqual(after.map((action) => action.worksOn).sort(), ["ITM-001", "ITM-002", "ITM-003"], "with places to spare the two behind the gate still wait for it");
  const passed = planner.nextActions(runOf({ jobsAtOnce: 5 }), await factsOf({ gated: true, behind, gate: "passed" }));
  assert.deepEqual(passed.map((action) => action.worksOn).sort(), IDS, "once the gate is passed they start");
});

/** A run record of kind run for the five items with the parameters given, read as every caller reads it. */
async function recordOf(params, raised = null) {
  let text = startRecord({ id: "JOB-20261019-0900-a1b2", kind: "run", worksOn: IDS, participant: null, model: null, route: "tab", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-19T09:00:00Z"),
    agentM: { version: "2026.10.0", commit: "abc123def456" }, inputs: [], limit: 5, destinations: [], params }).text;
  if (raised) text = appendToRecord(text, { part: "limits raised", at: new Date("2026-10-19T09:30:00Z"), by: "alice", limits: raised });
  for await (const record of recordsNewestFirst({ paths: ["docs/jobs/JOB-20261019-0900-a1b2.md"], read: async () => text })) return record;
  return null;
}

// TST-805303 · level: release · module: MOD-run-planner
// guards: A RUN HAS LIMITS FIXED AT ITS START; UC-034
// given: a run record naming the five items with the limits jobs at once 2, cost 10 and correction rounds 3, fixed at its start; the same run after the Product Owner raised the limits to jobs at once 4 and cost 20; two of its jobs running, which report no cost
// input: runOf and nextActions for the run before and after the raise
// expect: the limits in force are those of the start { jobsAtOnce: 2, cost: 10, rounds: 3 }, then the raised ones { jobsAtOnce: 4, cost: 20, rounds: 3 }; with two jobs running the run of two at once starts none, the raised run starts the two places it gained, ITM-003 and ITM-004; below its cost limit the run is running
test("TST-805303: UC-034 a run starts no job above the limits fixed at its start, and the raised limits are the ones in force", async () => {
  const params = { jobsAtOnce: 2, cost: 10, rounds: 3 };
  const runs = [rowOf("JOB-20261023-0910-aaaa", "ITM-001"), rowOf("JOB-20261023-0920-aaaa", "ITM-002")];
  const first = planner.runOf(await recordOf(params), runs);
  assert.deepEqual(first.limits, { jobsAtOnce: 2, cost: 10, rounds: 3 });
  const second = planner.runOf(await recordOf(params, { jobsAtOnce: 4, cost: 20, rounds: 3 }), runs);
  assert.deepEqual(second.limits, { jobsAtOnce: 4, cost: 20, rounds: 3 });
  const named = [{ job: "JOB-20261023-0910-aaaa", kind: "implement", worksOn: "ITM-001" }, { job: "JOB-20261023-0920-aaaa", kind: "implement", worksOn: "ITM-002" }];
  const state = await factsOf({ jobs: runs });
  assert.deepEqual(planner.nextActions({ ...first, jobs: named }, state), [], "two jobs run: the run of two at once starts none");
  assert.deepEqual(planner.nextActions({ ...second, jobs: named }, state).map((action) => action.worksOn), ["ITM-003", "ITM-004"], "the raised run starts the two places it gained");
  assert.equal(first.state, "running", "below the cost limit the run goes on");
});

// TST-805305 · level: release · module: MOD-run-planner
// guards: A RUN HAS LIMITS FIXED AT ITS START; UC-034
// given: the run of TST-805303 whose limits are jobs at once 4 and cost 10; two of its jobs, which report a cost of 3 (running) and of 7 (done), so that the cost the rows report is 10; known positive first: with the costs 2 and 7 the run goes on and starts ITM-003, ITM-004 and ITM-005
// input: runOf of the run, then nextActions of it with the jobs' rows
// expect: the run is held by a limit; the next actions start no job, and one of them is a hold whose reason names the cost limit (UC-034: the author clicks only where a gate names a person or a limit is reached); FINDING UC034-F6 (MOD-run-planner): nextActions returns the starts of a run held by its cost limit and never a hold
test("TST-805305: UC-034 a run whose reported cost reaches its limit starts no further job and says why",
  { todo: "FINDING UC034-F6 (MOD-run-planner): src/run-planner/next.mjs:nextActions returns for a run held by a limit the starts of the items it would start otherwise (it leaves out only a stopped or finished run), and no action of the kind hold, which MOD-run-planner's Action type names; SPEC A RUN HAS LIMITS FIXED AT ITS START asks that a run whose reported cost reaches its limit starts no further job and says why" },
  async () => {
    const params = { jobsAtOnce: 4, cost: 10, rounds: 3 };
    const named = [{ job: "JOB-20261023-0910-aaaa", kind: "implement", worksOn: "ITM-001" }, { job: "JOB-20261023-0920-aaaa", kind: "implement", worksOn: "ITM-002" }];
    const under = [rowOf("JOB-20261023-0910-aaaa", "ITM-001", "running", 2), rowOf("JOB-20261023-0920-aaaa", "ITM-002", "done", 7)];
    const below = planner.runOf(await recordOf(params), under);
    assert.equal(below.state, "running", "known positive: at 9 of 10 the run goes on");
    assert.deepEqual(planner.nextActions({ ...below, jobs: named }, await factsOf({ jobs: under, done: ["ITM-002"] })).map((action) => action.worksOn), ["ITM-003", "ITM-004", "ITM-005"], "known positive: below the limit it starts");
    const spent = [rowOf("JOB-20261023-0910-aaaa", "ITM-001", "running", 3), rowOf("JOB-20261023-0920-aaaa", "ITM-002", "done", 7)];
    const held = planner.runOf(await recordOf(params), spent);
    assert.equal(held.state, "held by a limit");
    const actions = planner.nextActions({ ...held, jobs: named }, await factsOf({ jobs: spent, done: ["ITM-002"] }));
    assert.ok(actions.every((action) => action.do !== "start"), `a run held by its cost limit starts no job: ${JSON.stringify(actions.map((action) => [action.do, action.worksOn]))}`);
    assert.ok(actions.some((action) => action.do === "hold" && /cost/.test(action.reason ?? "")), "one action says why");
  });

// ---------------------------------------------------------------- the gate on the job's page

// TST-805306 · level: release · module: MOD-main-page
// guards: A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT; A JOB STOPS AT EVERY GATE; UC-034
// given: the Scrum product of two teams: the Owner of team1 is alice, of team2 bob; the job of dev-a on ITM-003, which team1's sprint holds, and the job of dev-b on ITM-011, which team2's holds, wait at the gate Building → Checking, decided by the Owner; the product's token names the person who opens the page
// input: the page of each job opened by alice and by bob
// expect: each job's page shows Pass gate enabled to the Owner of the job's own team only: alice for the job of team1 and bob for the job of team2; to the Owner of the other team both buttons are disabled and the page names the role Owner and the holders of the job's own team, alice or bob; no one is offered a decision on a job of another team
test("TST-805306: UC-034 the person who may decide a job's gate is a holder of the deciding role in the job's own team, whoever else holds the role elsewhere", async () => {
  const { jobPage, jobProduct, waitingJob, byClass } = await import("./uc-034-harness.mjs");
  const cases = [["alice", waitingJob(), true, null], ["bob", waitingJob(), false, "alice"], ["bob", waitingJob({ participant: "dev-b", item: "ITM-011" }), true, null], ["alice", waitingJob({ participant: "dev-b", item: "ITM-011" }), false, "bob"]];
  for (const [person, job, may, holders] of cases) {
    const page = jobPage(person, { files: jobProduct({ jobs: [job] }) });
    try {
      const target = await page.draw();
      const pass = byClass(target, "gate-pass")[0], reject = byClass(target, "gate-reject")[0];
      assert.deepEqual([Boolean(pass.disabled), Boolean(reject.disabled)], [!may, !may], `${person} on the job of ${job.text.match(/works_on:\n {2}- (\S+)/)[1]}`);
      if (!may) assert.match(byClass(target, "gate-unavailable")[0].textContent, new RegExp(`Only a holder of the role Owner decides this gate; its holders are ${holders}\\.`));
    } finally { document.body.replaceChildren(); page.restore(); }
  }
});

// ---------------------------------------------------------------- the sprints of two teams

// TST-805304 · level: release · module: MOD-implementation-pages
// guards: EVERY TEAM RUNS SPRINTS OF ITS OWN; UC-034
// given: the Scrum product of tests/uc-032-harness.mjs without a time box: team1's sprint 02 runs with ITM-001 and ITM-002, team2 has run none; ITM-003 is ready
// input: the Product Owner of team2 plans a sprint with ITM-003 and presses Start sprint; then the Product Owner of team1 opens the progress and presses End sprint
// expect: starting team2's sprint writes one commit of one file, docs/backlog/sprints/team2/01.md, and leaves team1's record byte for byte as it was; ending team1's sprint writes one commit of one file, docs/backlog/sprints/team1/02.md, which gains the end, and leaves team2's record as the start wrote it; both teams' sprints run at the same time before the end
test("TST-805304: UC-034 each team plans, starts and ends a sprint of its own beside the sprints of the other teams", async () => {
  const files = await product({ model: MODELS.scrum });
  const one = "docs/backlog/sprints/team1/02.md", two = "docs/backlog/sprints/team2/01.md";
  const page = await open("backlog", {}, { files });
  let after;
  try {
    await planOf(page, "team2");
    typeValue(page, "[data-sprint-goal]", "Mail");
    typeValue(page, "[data-sprint-start]", "2026-11-02");
    typeValue(page, "[data-sprint-closer]", "bob");
    tickOf(page, "ITM-003").checked = true;
    const before = page.srv.writes.length;
    await page.press(found(page.target, "[data-start-sprint]")[0]);
    assert.equal(page.srv.writes.length, before + 1, "one click, one commit");
    assert.deepEqual(Object.keys(page.srv.writes.at(-1).files), [two]);
    assert.equal(page.srv.files[one], files[one], "team1's record is as it was");
    after = { ...page.srv.files };
  } finally { page.done(); }
  const progress = await open("progress", {}, { files: after });
  try {
    const end = found(progress.target, '[data-end-sprint="team1"]')[0];
    assert.ok(end && !disabledOf(end), "team1's sprint, which runs beside team2's, can be ended");
    const before = progress.srv.writes.length;
    await progress.press(end);
    assert.equal(progress.srv.writes.length, before + 1, "one click, one commit");
    assert.deepEqual(Object.keys(progress.srv.writes.at(-1).files), [one]);
    assert.notEqual(progress.srv.writes.at(-1).files[one], after[one], "team1's record gains its end");
    assert.match(progress.srv.writes.at(-1).files[one], /## Ended/);
    assert.equal(progress.srv.files[two], after[two], "team2's record is as the start wrote it");
  } finally { progress.done(); }
});
