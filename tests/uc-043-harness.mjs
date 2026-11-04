// The harness of the system and release tests of UC-043 (Run the process over a selection): the product's files behind tests/uc-024-harness.mjs' fake of GitHub (the real MOD-repository-hosts host), the product's facts read
// by MOD-progress-measures' productFacts with the scope `all`, the trace graph built from the product's files, the run read from its record by MOD-run-planner's runOf and its next actions given by nextActions. No request leaves
// the process. It holds no test and no expected result: what it builds are inputs, and every test states its own expected values.
// Imported by tests/system-uc-043-run-the-process-over-a-selection.test.mjs, tests/release-uc-043-run-the-process-over-a-selection.test.mjs and, through node, tests/test_process_run.py.
//
// Module: MOD-run-planner
// Module: MOD-progress-measures
// Module: MOD-job-ledger
// Module: MOD-trace-graph
// Module: MOD-test-schedule
// Module: MOD-repository-hosts
// Level: system
//
// Written for ITM-1045 by developer-sonnet-k. The product is tests/uc-045-harness.mjs' planned product (alice/thesis-tool: the V-model, the system ARC-001, the subsystems ARC-002 designing MOD-store and MOD-pages, MOD-pages using
// MOD-store.read, and ARC-003 designing MOD-mail; the plan ITM-101 to ITM-106; the role assignment giving dev-a Developer and Tester and bob Reviewer), whose fixtures this file takes and does not change; the instance is
// akmaier/agent-m as tests/uc-024-harness.mjs builds it.
//
// What UC-043 calls "the run's participant" — "the agent the author hands the run to, in a session of its own" — is not code of this repository (the withdrawal of the run page and of the automatic drivers of a run is told in the
// register of the backlog). The harness plays it: `carryOut` does for a run what step 4 and step 5 of UC-043 say that participant does, with the repository's own functions and nothing else — it reads the run's record and the
// facts (runOf, productFacts), asks nextActions, and for each action `start` writes the job's record naming the run and the run's `## Job started` part in one commit, as MOD-job-ledger's Data states they are written; a job's end
// is written with appendToRecord, and the merge of its pull request is the merged pull request the fake of GitHub lists. So a case that goes through `carryOut` shows what the repository's parts give a participant that does that
// and no more; where UC-043 asks for something these parts do not give, the case says so and is a `todo` that names its finding.

import "./site-frame-dom.mjs";
import { decision, moduleText, orderText, stepText } from "./uc-045-harness.mjs";
import { servers, instance, planned, GATES, ADDRESS, PARTICIPANTS, V_MODEL, SCRUM_MODEL, found, lines, modulePath, architecture, planFiles, stepId, pr } from "./uc-024-harness.mjs";
import { productFacts } from "../src/progress-measures/index.mjs";
import { traceGraph } from "../src/trace-graph/index.mjs";
import { nextActions, runOf } from "../src/run-planner/index.mjs";
import { appendToRecord, listJobs, newJobId, startRecord } from "../src/job-ledger/index.mjs";
import { itemStates } from "../src/work-plans/index.mjs";
import { ciConfiguration, defaultSchedule } from "../src/test-schedule/index.mjs";
import { readDocument, readRegister } from "../src/documents/index.mjs";
import { participantSchema } from "../src/participant-list/index.mjs";
import { resourceSchema } from "../src/resource-list/index.mjs";

export { ADDRESS, GATES, PARTICIPANTS, V_MODEL, SCRUM_MODEL, found, lines, modulePath, architecture, planFiles, stepId, planned, instance, pr };

/** The steps of the planned product, in the plan's order. */
export const STEPS = ["ITM-101", "ITM-102", "ITM-103", "ITM-104", "ITM-105", "ITM-106"];
export const RUN_ID = "JOB-20261101-0900-run1";
export const LIMITS = { jobsAtOnce: 3, cost: null, rounds: 5 };
const BRANCH = "main";
const MODELS = { "dev-a": "model-c", "dev-b": "model-d" };

/**
 * The files of the planned product with the two gates before the phase Implementation recorded as passed, `over` laid over them (a path set to null is left out); `open` lists the paths of reviewed files whose approval record is left
 * out, `plan` false leaves the product without a plan.
 */
export const productFiles = async (over = {}, { open = [], plan = true } = {}) => planned({ files: { ...GATES, ...over }, open, plan });

/**
 * The files of a product of four modules, MOD-a to MOD-d, designed by one subsystem, with `uses` as their interfaces (default: MOD-c uses MOD-b and MOD-b uses MOD-a, MOD-d uses nothing) and a plan of four steps ITM-201 (MOD-a),
 * ITM-202 (MOD-b), ITM-203 (MOD-c) and ITM-204 (MOD-d) in the order C, D, B, A, which is not the order of the interfaces. The V-model, the roles and the gates are those of productFiles.
 */
export const CHAIN = ["ITM-201", "ITM-202", "ITM-203", "ITM-204"];
export const chainFiles = async ({ uses = { "MOD-b": ["MOD-a.read"], "MOD-c": ["MOD-b.read"] } } = {}) => {
  const old = Object.fromEntries(Object.keys(architecture()).map((path) => [path, null]));
  const files = {
    ...old,
    "docs/architecture/ARC-001-the-whole.md": decision("ARC-001", "The whole", ["forced_by:", "  - UC-001"]),
    "docs/architecture/ARC-002-the-chain.md": decision("ARC-002", "The chain", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", ...["a", "b", "c", "d"].map((each) => `  - MOD-${each}`)]),
    ...Object.fromEntries(["a", "b", "c", "d"].map((each) => [`docs/architecture/MOD-${each}.md`, moduleText(`MOD-${each}`, uses[`MOD-${each}`] ?? [], "ARC-002")])),
    "docs/plan/order.md": orderText([[CHAIN[2], "Implementation"], [CHAIN[3], "Implementation"], [CHAIN[1], "Implementation"], [CHAIN[0], "Implementation"]]),
    ...Object.fromEntries(CHAIN.map((id, at) => [`docs/plan/${id}-the-module-${"abcd"[at]}.md`, stepText(201 + at, `The module ${"abcd"[at]}`, { modules: [`MOD-${"abcd"[at]}`] })])),
  };
  return productFiles(files, { plan: false });
};

/**
 * openWorld({ files, instanceFiles, pullRequests }) -> the world of a run over the product `files` (default: productFiles()) behind the fake of GitHub, with the instance `instanceFiles` laid over the instance of
 * tests/uc-024-harness.mjs. `pullRequests` is the list the fake serves for the product; the world pushes the merged pull requests of the jobs it finishes into it.
 * @returns {Promise<object>} { facts, rows, next, startRun, begin, finish, merge, carryOut, record, commit, read, raise, stop, end, srv, host, pulls, restore, clock }
 */
export async function openWorld({ files, instanceFiles = {}, pullRequests = [] } = {}) {
  const pulls = pullRequests;
  const served = files ?? await productFiles();
  const world = await servers({ files: served, instance: instance(instanceFiles), pullRequests: pulls });
  // The fake of GitHub answers the tags of the product with "not found"; a product with no tag has the empty list.
  const inner = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input?.url ?? input));
    if (url.origin === "https://api.github.com" && url.pathname.endsWith("/tags")) return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
    return inner(input, init);
  };
  const { host, instanceHost, srv } = world;
  const restore = () => { globalThis.fetch = inner; world.restore(); };
  let minute = 0;
  const clock = () => new Date(Date.UTC(2026, 10, 1, 9, 0 + (minute += 1)));
  const agentM = { version: "unreleased", commit: "c0ffee".padEnd(40, "0") };
  const jobsOf = new Map();
  const taken = new Set();

  const head = async () => (await host.readSnapshot(BRANCH)).commit;
  const commit = async (changes, message) => host.commitFiles({ branch: BRANCH, expectedHead: await head(), files: changes, message });
  const read = async (path) => (await host.readSnapshot(BRANCH)).read(path);
  const instanceSnapshot = async () => instanceHost.readSnapshot((await instanceHost.repositoryInfo()).defaultBranch);

  /** The product's facts as a run's participant reads them: productFacts with the scope `all`, and the trace graph built from the files of the snapshot, as a caller sets it. */
  async function facts({ raw = false } = {}) {
    const read = await productFacts(host, await instanceSnapshot(), (at) => instanceHost.readSnapshot(at), new Date("2026-11-01T10:00:00Z"));
    const snapshot = read.snapshot;
    read.graph = await traceGraph({ paths: snapshot.paths, read: (path) => snapshot.read(path) });
    if (!raw) {
      // Finding UC043-F1: the states of the plan count the run's own record, which works on the selection, as a job of every selected step. Unless a case asks for the facts raw, the states are those of itemStates
      // over the jobs other than a run's, so that the finding does not hide what the cases after it are about.
      const statuses = new Map(read.statuses);
      for (const name of Array.isArray(read.requirements) ? read.requirements : []) statuses.set(name, { id: name, kind: "requirement", status: "accepted" });
      read.plan = { ...read.plan, states: itemStates(read.plan.items, read.plan.order, { statuses, queues: read.queues, jobs: read.jobs.filter((row) => row.record.kind !== "run"),
        pullRequests: read.pullRequests, gates: read.gateStates, workflow: read.workflow }) };
    }
    return read;
  }
  const rows = async () => { const snapshot = await host.readSnapshot(BRANCH); return listJobs([{ address: snapshot.repository.web, snapshot }], new Map()); };
  const record = async (id = RUN_ID) => (await rows()).find((row) => row.record.id === id)?.record ?? null;

  /** The run's record: kind run, the selection as works_on, the limits as parameters, the author who started it. */
  async function startRun({ id = RUN_ID, selection = STEPS, limits = LIMITS, author = "alice" } = {}) {
    const start = startRecord({ id, kind: "run", worksOn: selection, participant: null, model: null, route: "tab", run: null, retries: null, startedBy: author, start: clock(), agentM, inputs: [],
      limit: limits.rounds ?? 5, destinations: [], params: limits });
    taken.add(id);
    await commit([{ path: start.path, text: start.text }], `run ${id}: started by ${author}`);
    return id;
  }
  /** The run as runOf reads it from its record and the rows of its jobs. */
  async function run(id = RUN_ID) {
    const all = await rows();
    return runOf(all.find((row) => row.record.id === id).record, all.filter((row) => row.record.run === id));
  }
  /** What the run does next: nextActions over the run and the facts of the product. */
  async function next(id = RUN_ID, { raw = false, ...over } = {}) {
    const read = { ...(await facts({ raw })), ...over };
    return nextActions(await run(id), read);
  }
  const pathOf = (id) => `docs/jobs/${id}.md`;

  /** Carries out an action `start`: the job's record naming the run and the run's `## Job started` part, in one commit. Returns the job's identifier. */
  async function begin(action, { id: runId = RUN_ID, at = clock() } = {}) {
    const job = newJobId(at, taken);
    taken.add(job);
    const worksOn = action.worksOn ? [action.worksOn] : ["UC-027"];
    const participant = action.participant ?? null;
    const start = startRecord({ id: job, kind: action.kind, worksOn, participant, model: participant ? MODELS[participant] ?? "model-c" : null, route: action.route ?? "tab", run: runId, retries: null, startedBy: "alice",
      start: at, agentM, inputs: [], limit: 5, destinations: participant ? [{ participant, place: "this machine", parts: [] }] : [], params: action.worksOn ? { steps: worksOn } : {} });
    const runText = appendToRecord(await read(pathOf(runId)), { part: "job started", at, job, kind: action.kind, worksOn });
    await commit([{ path: start.path, text: start.text }, { path: pathOf(runId), text: runText }], `run ${runId}: starts ${job}`);
    jobsOf.set(action.worksOn ?? action.kind, job);
    return job;
  }
  /** The end of a job's record: done, failed or cancelled, with the cost the runtime reported (none by default). */
  async function end(job, state = "done", { amount = null, reason = null, at = clock() } = {}) {
    const cost = amount === null ? { known: false, usage: null } : { known: true, amount, currency: "EUR", basis: "reported" };
    const text = appendToRecord(await read(pathOf(job)), { part: "end", at, state, results: [], draft: null, rounds: [], usage: null, cost, reason, log: null });
    await commit([{ path: pathOf(job), text }], `${job}: ${state}`);
  }
  /** The merge of a job's pull request: a merged pull request naming the step, in the list the fake of GitHub serves. */
  function merge(item, job) {
    const number = pulls.length + 1;
    pulls.push({ ...pr(number, item, "merged", "2026-11-01T09:30:00Z", "2026-11-01T09:45:00Z", { branch: `agent-m/${job}` }), body: `Job: ${job}\nPlan step: ${item}` });
  }
  /** A job of the run that has reached a gate and waits there for its decider. */
  async function reachGate(job, gate, decider, at = clock()) {
    const text = appendToRecord(await read(pathOf(job)), { part: "gate reached", at, gate, decider });
    await commit([{ path: pathOf(job), text }], `${job}: waits at ${gate}`);
  }
  /** The gate record of a gate decided `passed` by `decider` on the texts named by `on`. */
  async function decide(gate, role, decider, { name = gate.toLowerCase().replace(/[^a-z]+/g, "-") } = {}) {
    const text = lines("---", `gate: ${gate}`, `decider: ${decider}`, `role: ${role}`, "decision: passed", "date: 2026-11-01 11:00 UTC", "on:", `  - ${"c0ffee".padEnd(40, "0")}`, "---", `# ${gate}`);
    await commit([{ path: `docs/gates/20261101-1100-${name}.md`, text }], `gate ${gate}: passed`);
  }
  /** The limits a person raised, appended to the run's record. */
  async function raise(limits, { by = "alice", id = RUN_ID, at = clock() } = {}) {
    const text = appendToRecord(await read(pathOf(id)), { part: "limits raised", at, by, limits });
    await commit([{ path: pathOf(id), text }], `run ${id}: limits raised by ${by}`);
  }
  /** The end of the run's own record: `done` for a finished run, `cancelled` for a run its author stopped. */
  async function endRun(state, { id = RUN_ID, at = clock(), reason = null } = {}) {
    const text = appendToRecord(await read(pathOf(id)), { part: "end", at, state, results: [], draft: null, rounds: [], usage: null, cost: { known: false, usage: null }, reason, log: null });
    await commit([{ path: pathOf(id), text }], `run ${id}: ${state}`);
  }
  /** The CI configuration the product's schedule generates (the book's default), committed: what the job `set-up-ci` of UC-027 leaves in the product after its pull request is merged. */
  async function setUpCi() {
    const snapshot = await instanceSnapshot();
    const register = readDocument(participantSchema(), "docs/participants.md", (await snapshot.read("docs/participants.md")) ?? "");
    const resources = readRegister(resourceSchema(), "docs/resources.md", "").document;
    const generated = ciConfiguration(defaultSchedule(), { server: "github", instance: snapshot.repository.path, instanceCommit: snapshot.commit }, resources, register);
    await commit(Object.entries(generated.files).map(([path, text]) => ({ path, text })), "the CI configuration generated from the test schedule");
  }

  /**
   * carryOut({ id, finish, maxRounds }) -> { waves, ... } — the run's participant of UC-043: asks nextActions, carries out each action (`start` of the kind set-up-ci writes the configuration of the schedule; of the kind implement
   * writes the job's record) and ends each job it started in the way `finish(job)` names — "done" by default, which merges its pull request —, until nextActions gives nothing to start. `waves` lists, for each round,
   * the actions it started as { kind, worksOn }; `refused` the reason of a refusal; `clicks` the number of times a person was asked (always 0: nothing here asks).
   */
  async function carryOut({ id = RUN_ID, finish = () => "done", maxRounds = 12, onStart = null } = {}) {
    const waves = [];
    let refused = null;
    const started = [];
    for (let round = 0; round < maxRounds; round += 1) {
      const actions = await next(id);
      const refusal = actions.find((action) => action.do === "refuse");
      if (refusal) { refused = refusal.reason; break; }
      const starts = actions.filter((action) => action.do === "start");
      if (!starts.length) break;
      waves.push(starts.map((action) => ({ kind: action.kind, worksOn: action.worksOn, participant: action.participant, route: action.route })));
      const jobs = [];
      for (const action of starts) jobs.push([action, await begin(action, { id })]);
      for (const [action, job] of jobs) {
        started.push(job);
        if (onStart) await onStart(action, job);
        const state = finish(action, job);
        if (state === null) continue;
        await end(job, state);
        if (state === "done") {
          if (action.kind === "set-up-ci") await setUpCi();
          else merge(action.worksOn, job);
        }
      }
    }
    return { waves, refused, started, clicks: 0 };
  }

  return { facts, rows, record, run, next, startRun, begin, end, merge, reachGate, decide, raise, endRun, setUpCi, carryOut, read, commit, head, srv, host, instanceHost, pulls, restore, clock, jobsOf, agentM };
}
