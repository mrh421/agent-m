// MOD-run-planner's nextActions (ITM-977), as the accepted text of docs/architecture/MOD-run-planner.md states it: "`nextActions(run: Run, facts: Facts) -> Action[]` — what to do now [...] in this order:
// while the product has no CI configuration of Agent M's (`facts.ci.configured` false), start the kind `set-up-ci` and nothing else until its pull request is merged; start the kind `implement` for
// every selected step or item that `startable` admits and whose modules use only modules already done, each on a route of a holder of the implementing role in the item's role assignment who may
// receive its content that reaches the product's resources (`facts.resourceNeeds`), as many as `jobs at once` allows; the steps of a phase only once the gate before it is recorded; resume a job
// whose gate has been decided. It starts nothing that depends on a failed job while the others go on, and nothing after a person stopped the run. It starts nothing whose condition depends
// on a fact that is `"unknown"`. `refuse` names the modules of a cycle in the modules' uses, before anything starts." And `Action` — `{ do: "start" | "resume" | "hold" | "finish" | "refuse",
// kind: string | null, worksOn: string | null, route: string | null, participant: string | null, job: string | null, reason: string | null }`.
// Run: node --test tests/run-planner-next-actions.test.mjs
//
// Module: MOD-run-planner
// Guards: A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; A RUN FOLLOWS THE MODULES' INTERFACES; A RUN SETS UP CI BEFORE IT IMPLEMENTS; A JOB STOPS AT EVERY GATE; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; UC-043
// Level: unit
//
// Deterministic, nothing reaches the network. The product is a fixture of this file. Its modules are written as module files and its items as backlog items, and the trace graph is the one
// MOD-trace-graph's traceGraph builds from them, as a caller builds it before it asks for the next actions (Facts.graph is "unknown" until a caller sets it). The states of the items are the ones
// MOD-work-plans' itemStates derives from the items, the job rows, the pull requests and the gate states; the facts are MOD-progress-measures' Facts in the form its test helper gives them.
// Each test states its expected results in its own text. Where the module text leaves a reading open, the test states it and the pull request names it:
//   - The action of a start names one item in `worksOn`, its kind `implement`, the participant and the route of the job it would start: the route as a job's record writes it (`ci hosted`,
//     `ci runner:<label>`, `bridge <name>`, `tab`). The action that starts the CI setup names no item, no route and no participant (the kind has no participant), and `job` and `reason` are null.
//   - The module a job works on is the module its item changes (the graph's `changes` edge). A module is done when no item of level `module` that changes it is not done; a module no item changes is done.
//     A module the item changes itself does not have to be done for it.
//   - The holder is the first participant of the register, in its order, for whom `startable` admits the item (it is a holder of the implementing role in the item's role assignment, with what
//     the role needs) and whose route (MOD-runtimes' routesFor, given the product's job workflow and visibility and its resource needs) has an offer that can be taken.
//   - Every job of the run that has not ended counts against `jobs at once`, one that waits at a gate too; a resumption starts no further job. A start is asked of `startable` with the items
//     chosen before it in the same call as in progress, so that the work-in-progress limit holds across one call.
//   - A job is resumed when it is a job of the run, waits at a gate that has no resumption, and the gate states give that gate `passed`; the action names the job's own kind, route and participant.
//   - A run that is stopped or finished has no next actions. A cycle gives the one `refuse` and nothing else, also before the CI is set up.
//   - A fact `"unknown"` that a start needs — `ci`, `graph`, `resourceNeeds`, the pull requests through the item's state — gives no start of that kind; the CI setup needs `ci` only.

import test from "node:test";
import assert from "node:assert/strict";
import { readDocument } from "../src/documents/index.mjs";
import { roleAssignmentSchema } from "../src/product-process/index.mjs";
import { traceGraph } from "../src/trace-graph/index.mjs";
import { itemStates } from "../src/work-plans/index.mjs";
import * as planner from "../src/run-planner/index.mjs";
import { facts } from "./progress-measures-facts.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;

// ---------------------------------------------------------------- the fixture product

// Its modules. MOD-alpha uses MOD-mid, MOD-mid uses MOD-zeta, MOD-zeta uses MOD-base: MOD-base is implemented first, then MOD-zeta, MOD-mid, MOD-alpha. The identifiers stand in the opposite order,
// so that an order by identifier is not the order of the uses. MOD-delta and MOD-echo use nothing and are used by nothing; no item changes MOD-base.
const USES = { "MOD-alpha": ["MOD-mid.run"], "MOD-mid": ["MOD-zeta.run"], "MOD-zeta": ["MOD-base.run"], "MOD-base": [], "MOD-delta": [], "MOD-echo": [] };
const CYCLE = { "MOD-p": ["MOD-q.run"], "MOD-q": ["MOD-r.run"], "MOD-r": ["MOD-p.run"], "MOD-s": [] };

const moduleText = (id, uses) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", uses.length ? "uses:" : "uses: []", ...uses.map((use) => `  - ${use}`),
  "provides:", "  - run", "---", `# ${id}`, "", "## Responsibility", "", "One concern.", "", "## Interfaces", "", "- `run() -> text` - runs.");
const itemText = ({ id, modules, builds_on = [] }) => lines("---", `id: ${id}`, `title: ${id} item`, "level: module", "realises:", "  - UC-001", "modules:", ...modules.map((name) => `  - ${name}`),
  ...(builds_on.length ? ["builds_on:", ...builds_on.map((name) => `  - ${name}`)] : []), "tests:", "  - unit", "origin:", "  - UC-001", "---", `# ${id} item`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a");

// An item as MOD-work-plans' itemStates reads it: a Document with its fields.
const documentOf = ({ id, modules, builds_on = [] }) => ({ kind: "item", path: `docs/backlog/${id}-item.md`, id, fields: { id, realises: ["UC-001"], modules, builds_on, level: "module" }, sections: [] });

const ITEMS = [{ id: "ITM-001", modules: ["MOD-alpha"] }, { id: "ITM-002", modules: ["MOD-mid"] }, { id: "ITM-003", modules: ["MOD-zeta"] }, { id: "ITM-004", modules: ["MOD-delta"] }];
const ECHO = { id: "ITM-007", modules: ["MOD-echo"] };
const ALL = ITEMS.map((item) => item.id);
const only = (...ids) => [...ITEMS, ECHO].filter((item) => ids.includes(item.id));

// The trace graph a caller builds from the product's files.
async function graphOf(uses, items) {
  const files = { ...Object.fromEntries(Object.entries(uses).map(([id, used]) => [`docs/architecture/${id}.md`, moduleText(id, used)])),
    ...Object.fromEntries(items.map((item) => [`docs/backlog/${item.id}-item.md`, itemText(item)])) };
  const graph = await traceGraph({ paths: Object.keys(files), read: async (path) => files[path] ?? null });
  assert.deepEqual(graph.unread, [], "positive control: every fixture file is read");
  assert.equal([...graph.nodes.values()].filter((node) => node.kind === "MOD").length, Object.keys(uses).length, "positive control: one node for each module");
  assert.equal(graph.edges.filter((edge) => edge.via === "changes").length, items.reduce((sum, item) => sum + item.modules.length, 0), "positive control: a changes edge for each module of each item");
  return graph;
}

// The process: Planning, then Development (which produces the modules) behind the gate "Planning -> Development", decided by the Product Owner. No sprints, no work-in-progress limit unless a test sets one.
const DEVELOPERS = { name: "Developers", filledBy: "agent", howMany: "several", capabilities: ["read the repository", "write to the repository", "run code and tests"] };
const workflowWith = (flow = { wip: null, timeBox: null, sprints: false }) => ({
  model: { name: "kanban", kind: "pulled", flow },
  phases: [{ name: "Planning", roles: ["Product Owner"], produces: ["ITM"] }, { name: "Development", roles: ["Developers"], produces: ["MOD", "TST"] }],
  transitions: [{ from: "Planning", to: "Development", kind: "handoff" }],
  gates: [{ name: "Planning -> Development", from: "Planning", to: "Development", artifacts: "plan", condition: "the plan is accepted", decider: "Product Owner", addedBy: null, practice: null }],
  roles: [{ name: "Product Owner", filledBy: "person", howMany: "one", capabilities: ["read the repository"] }, DEVELOPERS],
  branches: {}, done: [],
});

const PARTICIPANTS = [
  { name: "alice", type: "person", model: null, capabilities: ["read the repository", "write to the repository"], place: null, route: "account alice" },
  { name: "dev-a", type: "CLI agent", model: "model-a", capabilities: ["read the repository", "write to the repository", "run code and tests"], place: "this machine", route: "bridge lab agent claude" },
  { name: "dev-b", type: "CI agent", model: "model-b", capabilities: ["read the repository", "write to the repository", "run code and tests"], place: "NHR@FAU, Erlangen", route: "ci hosted secret KEY" },
  { name: "dev-c", type: "model endpoint", model: "model-c", capabilities: ["draft text", "read the repository"], place: "this machine", route: "endpoint local" },
];
const assignmentOf = (developers) => readDocument(roleAssignmentSchema, "docs/role-assignments/team1.md",
  lines("# team1", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Product Owner | alice |", `| Developers | ${developers} |`));

const STATUSES = new Map([["UC-001", { id: "UC-001", kind: "use-case", status: "accepted" }]]);
const pull = (id, state, number = 1) => ({ number, title: `${id} work`, branch: `codex/${id}`, base: "main", head: "a".repeat(40), state, draft: false, url: `https://example.invalid/${number}`,
  opened: "2026-10-13T08:00:00Z", merged: state === "merged" ? "2026-10-13T09:00:00Z" : null, closed: null });
const row = ({ id, worksOn, state = "running", kind = "implement", participant = "dev-a", route = "bridge lab", gates = [] }) => ({
  record: { id, kind, worksOn: [worksOn], participant, route, run: "JOB-20261023-0900-run1", gates, question: null, path: `docs/jobs/${id}.md` },
  product: "https://github.com/alice/product", state, elapsed: 0, cost: { known: false, usage: null }, source: { reachable: true, reason: null } });
const CI = { runs: [], configured: true, drift: [], jobWorkflow: true };
const planOrder = (rows) => ({ path: "docs/plan/order.md", fields: {}, sections: [{ heading: "## Order", rows: rows.map(([Step, Phase]) => ({ cells: { Step, Phase } })) }] });

// The facts of the product: the states of its items derived as itemStates derives them, the graph built from its files. `over` sets the fields a test is about.
async function factsOf({ items = ITEMS, uses = USES, merged = [], jobs = [], gateStates = [], order = null, workflow = workflowWith(), developers = "dev-a", participants = PARTICIPANTS, over = {} } = {}) {
  const documents = items.map(documentOf);
  const pullRequests = Object.hasOwn(over, "pullRequests") ? over.pullRequests : merged.map((id, at) => pull(id, "merged", at + 1));
  const states = itemStates(documents, order, { statuses: STATUSES, queues: [], jobs, pullRequests, gates: gateStates, workflow });
  return facts({ workflow, model: workflow.model, participants, assignments: [assignmentOf(developers)], plan: { order, items: documents, states }, jobs, pullRequests, gateStates,
    graph: await graphOf(uses, items), ci: CI, resourceNeeds: [], info: { defaultBranch: "main", visibility: "private" }, ...over });
}

// A run as runOf gives it: its selection, its limits in force, the jobs it started and its state.
const runOf = ({ selection = ALL, jobsAtOnce = 3, jobs = [], state = "running" } = {}) => ({ id: "JOB-20261023-0900-run1", selection, limits: { jobsAtOnce, cost: null, rounds: 5 },
  jobs: jobs.map(({ job, kind = "implement", worksOn }) => ({ job, kind, worksOn })), state });
const started = (id, worksOn, kind = "implement") => ({ job: id, kind, worksOn });

const startOf = (worksOn, participant = "dev-a", route = "bridge lab") => ({ do: "start", kind: "implement", worksOn, route, participant, job: null, reason: null });
const worksOnOf = (actions) => actions.map((action) => action.worksOn).sort();
const SET_UP_CI = { do: "start", kind: "set-up-ci", worksOn: null, route: null, participant: null, job: null, reason: null };
const next = (run, over) => {
  assert.equal(typeof planner.nextActions, "function", "nextActions is built");
  return planner.nextActions(run, over);
};


// ---------------------------------------------------------------- CI first

// TST-977001 · level: unit · module: MOD-run-planner
// guards: A RUN SETS UP CI BEFORE IT IMPLEMENTS; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; UC-043
// given: a run over ITM-003 and ITM-004, both ready, and a participant who holds the implementing role; the product's CI configuration is (a) not there, (b) not there and the run has started its set-up-ci job, (c) there — the known positive
// input: nextActions(the run, the facts) of each
// expect: (a) exactly one action, the start of the kind set-up-ci that names no item, route or participant; (b) none: nothing else starts until its pull request is merged; (c) the starts of ITM-003 and ITM-004 as implement jobs of dev-a on the bridge lab, and no set-up-ci
test("nextActions starts only the CI setup while the product has no CI configuration, then the implementation", async () => {
  const items = only("ITM-003", "ITM-004");
  const selection = ["ITM-003", "ITM-004"];
  const without = await factsOf({ items, over: { ci: { ...CI, configured: false } } });
  assert.deepEqual(next(runOf({ selection }), without), [SET_UP_CI]);
  assert.deepEqual(next(runOf({ selection, jobs: [started("JOB-20261023-0901-ci00", "", "set-up-ci")] }), without), []);
  const configured = next(runOf({ selection }), await factsOf({ items })).sort((a, b) => (a.worksOn < b.worksOn ? -1 : 1));
  assert.deepEqual(configured, [startOf("ITM-003"), startOf("ITM-004")], "known positive: with the CI configuration, the implementation starts");
});

// ---------------------------------------------------------------- the order of the interfaces

// TST-977002 · level: unit · module: MOD-run-planner
// guards: A RUN FOLLOWS THE MODULES' INTERFACES; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; UC-043
// given: ITM-001 changes MOD-alpha, which uses MOD-mid; ITM-002 changes MOD-mid, which uses MOD-zeta; ITM-003 changes MOD-zeta, which uses MOD-base, that no item changes; ITM-004 changes MOD-delta, which uses nothing; all ready; the run selects the four
// input: nextActions(the run, the facts) with jobs at once 3 and 1; then with ITM-003 merged and a job of ITM-004 running, with jobs at once 3, 2 and 1; then with ITM-002 merged as well
// expect: jobs at once 3: only ITM-003 and ITM-004, not ITM-002 or ITM-001; jobs at once 1: one start, of ITM-003 or ITM-004; with ITM-003 done and ITM-004 running: jobs at once 3 and 2 start only ITM-002, never ITM-001; jobs at once 1 start nothing, the running job fills it; with ITM-002 done as well, ITM-001 starts
test("nextActions starts a module only after every module it uses, side by side with an unrelated one, never above the jobs at once", async () => {
  assert.deepEqual(worksOnOf(next(runOf(), await factsOf())), ["ITM-003", "ITM-004"], "MOD-base, which no item changes, is done, so MOD-zeta may start; MOD-mid waits for MOD-zeta");
  const one = next(runOf({ jobsAtOnce: 1 }), await factsOf());
  assert.equal(one.length, 1, "jobs at once 1: one start only");
  assert.ok(["ITM-003", "ITM-004"].includes(one[0].worksOn), one[0].worksOn);

  const running = [row({ id: "JOB-20261023-0902-dddd", worksOn: "ITM-004" })];
  const aside = (jobsAtOnce) => runOf({ jobsAtOnce, jobs: [started("JOB-20261023-0902-dddd", "ITM-004")] });
  const beside = await factsOf({ merged: ["ITM-003"], jobs: running });
  assert.deepEqual(next(aside(3), beside), [startOf("ITM-002")]);
  assert.deepEqual(next(aside(2), beside), [startOf("ITM-002")]);
  assert.deepEqual(next(aside(1), beside), []);
  assert.deepEqual(next(aside(3), await factsOf({ merged: ["ITM-003", "ITM-002"], jobs: running })), [startOf("ITM-001")]);
});

// ---------------------------------------------------------------- phases, gates and resumptions

// TST-977003 · level: unit · module: MOD-run-planner
// guards: A JOB STOPS AT EVERY GATE; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; UC-043
// given: ITM-003 and ITM-004 in the plan's phase Development, behind the gate "Planning -> Development"; the gate is (a) pending, (b) passed
// input: nextActions(the run, the facts) of each
// expect: (a) none: the steps of a phase wait for the gate before it; (b) the starts of ITM-003 and ITM-004
test("nextActions starts the steps of a phase only once the gate before it is recorded", async () => {
  const items = only("ITM-003", "ITM-004");
  const order = planOrder([["ITM-003", "Development"], ["ITM-004", "Development"]]);
  const gate = (state) => [{ gate: "Planning -> Development", state, record: state === "passed" ? "docs/gates/20261023-0900-planning-development-ab12.md" : null, needs: null, difference: null }];
  const selection = ["ITM-003", "ITM-004"];
  assert.deepEqual(next(runOf({ selection }), await factsOf({ items, order, gateStates: gate("pending") })), []);
  assert.deepEqual(worksOnOf(next(runOf({ selection }), await factsOf({ items, order, gateStates: gate("passed") }))), ["ITM-003", "ITM-004"]);
});

// TST-977004 · level: unit · module: MOD-run-planner
// guards: A JOB STOPS AT EVERY GATE; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; UC-043
// given: the run's job J1 on ITM-003 and its job J2 on ITM-004 wait at the gate "Merge review" of the Product Owner (bridge lab, dev-a); a job J9 of another run waits at it too; the gate is (a) pending, (b) passed
// input: nextActions(the run, the facts) of each, with jobs at once 3; and with jobs at once 1; and with the gate pending, ITM-007 ready and jobs at once 1, 2 and 3
// expect: (a) none; (b) the resumption of J1 and of J2 with jobs at once 3 and with 1, each { do: "resume", kind: "implement", worksOn, route: "bridge lab", participant: "dev-a", job, reason: null }, not of J9: a resumption starts no further job; with the gate pending and ITM-007 ready, ITM-007 starts only with jobs at once 3: a job waiting at a gate has not ended and fills its place
test("nextActions resumes a job of the run whose gate has been decided, and lets the others go on while a job waits at a gate", async () => {
  const gates = [{ at: new Date("2026-10-23T09:10:00Z"), gate: "Merge review", decider: "Product Owner", resumedBy: null }];
  const jobs = [row({ id: "JOB-20261023-0901-aaaa", worksOn: "ITM-003", state: "waiting at a gate", gates }), row({ id: "JOB-20261023-0902-bbbb", worksOn: "ITM-004", state: "waiting at a gate", gates }),
    row({ id: "JOB-20261023-0903-cccc", worksOn: "ITM-009", state: "waiting at a gate", gates })];
  const gateState = (state) => [{ gate: "Merge review", state, record: state === "passed" ? "docs/gates/20261023-0915-merge-review-cd34.md" : null, needs: null, difference: null }];
  const named = [started("JOB-20261023-0901-aaaa", "ITM-003"), started("JOB-20261023-0902-bbbb", "ITM-004")];
  const items = only("ITM-003", "ITM-004");
  const resumed = (job, worksOn) => ({ do: "resume", kind: "implement", worksOn, route: "bridge lab", participant: "dev-a", job, reason: null });
  assert.deepEqual(next(runOf({ selection: ["ITM-003", "ITM-004"], jobs: named }), await factsOf({ items, jobs, gateStates: gateState("pending") })), []);
  const decided = await factsOf({ items, jobs, gateStates: gateState("passed") });
  assert.deepEqual(next(runOf({ selection: ["ITM-003", "ITM-004"], jobs: named }), decided), [resumed("JOB-20261023-0901-aaaa", "ITM-003"), resumed("JOB-20261023-0902-bbbb", "ITM-004")]);
  assert.deepEqual(next(runOf({ selection: ["ITM-003", "ITM-004"], jobs: named, jobsAtOnce: 1 }), decided), [resumed("JOB-20261023-0901-aaaa", "ITM-003"), resumed("JOB-20261023-0902-bbbb", "ITM-004")]);
  const withEcho = await factsOf({ items: only("ITM-003", "ITM-004", "ITM-007"), jobs, gateStates: gateState("pending") });
  const all = ["ITM-003", "ITM-004", "ITM-007"];
  for (const jobsAtOnce of [1, 2]) assert.deepEqual(next(runOf({ selection: all, jobs: named, jobsAtOnce }), withEcho), [], `jobs at once ${jobsAtOnce}: both places are held by the jobs at the gate`);
  assert.deepEqual(next(runOf({ selection: all, jobs: named, jobsAtOnce: 3 }), withEcho), [startOf("ITM-007")]);
});

// ---------------------------------------------------------------- a failed job, a stopped run

// TST-977005 · level: unit · module: MOD-run-planner
// guards: A RUN FOLLOWS THE MODULES' INTERFACES; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; UC-043
// given: ITM-002 changes a module that uses MOD-zeta, ITM-003 changes MOD-zeta, ITM-005 builds on ITM-003, ITM-004 depends on neither; all ready; the run selects the four; ITM-003's job (a) has not started, (b) failed
// input: nextActions(the run, the facts) of each
// expect: (a) the starts of ITM-003 and ITM-004: ITM-002 waits for the module, ITM-005 for the item; (b) the start of ITM-004 only: neither ITM-002 (its module uses the module of the failed job) nor ITM-005 (it builds on the failed item) nor ITM-003 itself
test("nextActions starts nothing that depends on a failed job while the others go on", async () => {
  const items = [...only("ITM-002", "ITM-003", "ITM-004"), { id: "ITM-005", modules: ["MOD-echo"], builds_on: ["ITM-003"] }];
  const selection = items.map((item) => item.id);
  assert.deepEqual(worksOnOf(next(runOf({ selection }), await factsOf({ items }))), ["ITM-003", "ITM-004"], "known positive: nothing failed");
  const failed = [row({ id: "JOB-20261023-0901-aaaa", worksOn: "ITM-003", state: "failed" })];
  assert.deepEqual(next(runOf({ selection, jobs: [started("JOB-20261023-0901-aaaa", "ITM-003")] }), await factsOf({ items, jobs: failed })), [startOf("ITM-004")]);
});

// TST-977006 · level: unit · module: MOD-run-planner
// guards: A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; UC-043
// given: the facts with ITM-004 and ITM-007 startable; the run is running, stopped by a person, finished
// input: nextActions(the run, the facts) for each state
// expect: running — the known positive — gives the two starts; stopped gives none; finished gives none
test("nextActions starts nothing after a person stopped the run, or after it finished", async () => {
  const state = await factsOf({ items: only("ITM-004", "ITM-007") });
  const selection = ["ITM-004", "ITM-007"];
  assert.deepEqual(worksOnOf(next(runOf({ selection }), state)), ["ITM-004", "ITM-007"], "known positive: running");
  assert.deepEqual(next(runOf({ selection, state: "stopped" }), state), []);
  assert.deepEqual(next(runOf({ selection, state: "finished" }), state), []);
});

// ---------------------------------------------------------------- what is unknown

// TST-977007 · level: unit · module: MOD-run-planner
// guards: A RUN SETS UP CI BEFORE IT IMPLEMENTS; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; UC-043
// given: the facts of the known positive (ITM-003 and ITM-004 startable) with, one at a time, ci "unknown", graph "unknown", resourceNeeds "unknown", the pull requests "unknown"; and with ci known but not configured and the graph "unknown"; and with ci, graph, resourceNeeds, info and pull requests all unknown and a job of the run waiting at a gate that is passed
// input: nextActions(the run, the facts) of each
// expect: the known positive gives the two starts; each unknown gives none; with ci not configured and the graph unknown the CI setup starts, as it needs the CI only; with everything unknown only the resumption of the job whose gate is recorded
test("nextActions starts nothing whose condition depends on a fact that is unknown, and still resumes a job whose gate is recorded", async () => {
  const items = only("ITM-003", "ITM-004");
  const selection = ["ITM-003", "ITM-004"];
  const known = await factsOf({ items });
  assert.deepEqual(worksOnOf(next(runOf({ selection }), known)), ["ITM-003", "ITM-004"], "known positive");
  for (const unknown of [{ ci: "unknown" }, { graph: "unknown" }, { resourceNeeds: "unknown" }]) {
    assert.deepEqual(next(runOf({ selection }), { ...known, ...unknown }), [], Object.keys(unknown)[0]);
  }
  assert.deepEqual(next(runOf({ selection }), await factsOf({ items, over: { pullRequests: "unknown" } })), [], "pullRequests");
  assert.deepEqual(next(runOf({ selection }), { ...known, ci: { ...CI, configured: false }, graph: "unknown" }), [SET_UP_CI]);

  const gates = [{ at: new Date("2026-10-23T09:10:00Z"), gate: "Merge review", decider: "Product Owner", resumedBy: null }];
  const jobs = [row({ id: "JOB-20261023-0901-aaaa", worksOn: "ITM-003", state: "waiting at a gate", gates })];
  const decided = [{ gate: "Merge review", state: "passed", record: "docs/gates/20261023-0915-merge-review-cd34.md", needs: null, difference: null }];
  const offline = await factsOf({ items, jobs, gateStates: decided, over: { ci: "unknown", graph: "unknown", resourceNeeds: "unknown", info: "unknown", pullRequests: "unknown" } });
  assert.deepEqual(next(runOf({ selection, jobs: [started("JOB-20261023-0901-aaaa", "ITM-003")] }), offline),
    [{ do: "resume", kind: "implement", worksOn: "ITM-003", route: "bridge lab", participant: "dev-a", job: "JOB-20261023-0901-aaaa", reason: null }]);
});

// ---------------------------------------------------------------- a cycle

// TST-977008 · level: unit · module: MOD-run-planner
// guards: A RUN FOLLOWS THE MODULES' INTERFACES; UC-043
// given: MOD-p uses MOD-q, MOD-q uses MOD-r, MOD-r uses MOD-p, MOD-s uses nothing, an item for each module, all ready, and the CI configuration (a) there, (b) not there
// input: nextActions(the run, the facts) of each
// expect: exactly one action each, { do: "refuse", kind: null, worksOn: null, route: null, participant: null, job: null, reason } whose reason names MOD-p, MOD-q and MOD-r and does not name MOD-s; no start of the CI setup either
test("nextActions refuses a run whose modules' uses form a cycle, naming its modules, before anything starts", async () => {
  const items = [{ id: "ITM-011", modules: ["MOD-p"] }, { id: "ITM-012", modules: ["MOD-q"] }, { id: "ITM-013", modules: ["MOD-r"] }, { id: "ITM-014", modules: ["MOD-s"] }];
  const selection = items.map((item) => item.id);
  for (const configured of [true, false]) {
    const actions = next(runOf({ selection }), await factsOf({ items, uses: CYCLE, over: { ci: { ...CI, configured } } }));
    assert.equal(actions.length, 1, `configured ${configured}: one action`);
    const [refusal] = actions;
    assert.deepEqual({ ...refusal, reason: null }, { do: "refuse", kind: null, worksOn: null, route: null, participant: null, job: null, reason: null });
    assert.equal(typeof refusal.reason, "string");
    for (const name of ["MOD-p", "MOD-q", "MOD-r"]) assert.ok(refusal.reason.includes(name), `${name} in: ${refusal.reason}`);
    assert.ok(!refusal.reason.includes("MOD-s"), `MOD-s, which is no part of the cycle, is not named: ${refusal.reason}`);
  }
});

// ---------------------------------------------------------------- who, and on which route

// TST-977009 · level: unit · module: MOD-run-planner
// guards: A JOB GOES ONLY TO A HOLDER OF ITS ROLE; UC-043
// given: ITM-004 ready; the role assignment's Developers are (a) dev-c, a model endpoint that can only draft text and read; (b) dev-a and dev-b, in the register's order dev-b first, dev-b a CI agent on the server's own runners, dev-a a CLI agent on the Bridge lab; the product's resource needs are none, then one that only the Bridge lab reaches, then one that only the runner gpu reaches
// input: nextActions(the run, the facts) of each
// expect: (a) none: no holder of the role has what it needs; (b) with no need the start on dev-b's route "ci hosted"; with the Bridge's need, dev-a on "bridge lab"; with the runner's need, none — neither reaches it
test("nextActions gives a job to the first holder of the implementing role whose route reaches the product's resources", async () => {
  const items = only("ITM-004");
  const selection = ["ITM-004"];
  const dev = (name) => PARTICIPANTS.find((participant) => participant.name === name);
  assert.deepEqual(next(runOf({ selection }), await factsOf({ items, developers: "dev-c" })), []);
  const register = [dev("alice"), dev("dev-b"), dev("dev-a"), dev("dev-c")];
  const withNeeds = (resourceNeeds) => factsOf({ items, developers: "dev-a, dev-b", participants: register, over: { resourceNeeds } });
  assert.deepEqual(next(runOf({ selection }), await withNeeds([])), [startOf("ITM-004", "dev-b", "ci hosted")]);
  assert.deepEqual(next(runOf({ selection }), await withNeeds([{ resource: "cluster", route: "bridge lab" }])), [startOf("ITM-004", "dev-a", "bridge lab")]);
  assert.deepEqual(next(runOf({ selection }), await withNeeds([{ resource: "card", route: "runner:gpu" }])), []);
});

// TST-977010 · level: unit · module: MOD-run-planner
// guards: NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS; UC-043
// given: ITM-004 and ITM-007 ready and independent, none in progress; the run's jobs at once 3; the model's work-in-progress limit (a) 1, (b) none
// input: nextActions(the run, the facts) of each
// expect: (a) one start only: the second item would be the second in progress; (b) both
test("nextActions starts no more in one call than the work-in-progress limit allows", async () => {
  const items = only("ITM-004", "ITM-007");
  const selection = ["ITM-004", "ITM-007"];
  assert.equal(next(runOf({ selection }), await factsOf({ items, workflow: workflowWith({ wip: 1, timeBox: null, sprints: false }) })).length, 1);
  assert.deepEqual(worksOnOf(next(runOf({ selection }), await factsOf({ items }))), ["ITM-004", "ITM-007"]);
});
