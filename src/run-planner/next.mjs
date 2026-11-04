// Next — a run's next actions (MOD-run-planner, Interfaces: Action, nextActions; A RUN SETS UP CI BEFORE IT IMPLEMENTS, A RUN FOLLOWS THE MODULES' INTERFACES, A JOB STOPS AT EVERY GATE,
// A RUN CONTINUES WITHOUT A CLICK BETWEEN ITS JOBS, A JOB GOES ONLY TO A HOLDER OF ITS ROLE, NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; UC-043). Of the function's text this file has
// what ITM-977 builds: the CI setup, the implementation jobs in the order of the modules' interfaces, the resumption of a job whose gate has been decided, and the refusal of a cycle.
//
// Module: MOD-run-planner
//
// Pure: nothing is read or written here; the run and the facts are handed in, and the same two give the same actions to any driver. Where the module file leaves a reading open, this file takes
// the one it names (the pull request of ITM-977 names them too):
//   - The modules' uses, and the cycle among them, are those of `facts.graph`, the graph MOD-trace-graph's traceGraph builds, which a caller sets before it asks; productFacts leaves it
//     "unknown". A graph that is "unknown" starts no implementation job. The steps are taken in the order of `facts.plan.states` (the plan's order, or the items after those they build on);
//     that a module stands after every module it uses is the check below, not a sort.
//   - A module is done when no item of level `module`, of the product's plan or backlog (`facts.plan.states`), that changes it is not done; a module no item changes is done. The modules an
//     item changes itself need not be done for it.
//   - The holder is the first participant of the register for whom `startable` admits the item and whose route has an offer that can be taken (MOD-runtimes' routesFor, given the job workflow
//     and the visibility the facts hold and the product's resource needs). The item's role assignment and sprint are those of the team whose sprint holds it (`facts.held`), else the
//     product's one in a model without sprints, as src/prompt-bar/hand-over.mjs takes them. Facts carry no source register, so the places a restricted source permits are left to the job's
//     preparation, which refuses content to a place the source does not permit.
//   - The route of an action is the text a job's record writes: `tab`, `ci hosted`, `ci runner:<label>`, `bridge <name>`.
//   - Every job of the run that has not ended counts against `jobs at once`, one that waits at a gate too (as the work-in-progress limit counts an item waiting for review); a resumption starts no further job.
//     `startable` is asked with the items chosen earlier in the call as in progress, so that the work-in-progress limit holds across one call.
//   - A job is resumed when it is a job of the run, waits at a named gate that has no resumption, and `facts.gateStates` gives that gate `passed`.
//   - A run that is stopped or finished has no next actions. A cycle in the modules' uses gives the one refusal, the finding of the cycle, and nothing else.
//   - The CI setup needs `facts.ci` only; once the run has started a job of the kind, nothing else starts until the configuration is there.

import { finding, formatFinding } from "../text-tools/index.mjs";
import { moduleOrder } from "../trace-graph/index.mjs";
import { routesFor } from "../runtimes/index.mjs";
import { startable } from "../work-plans/index.mjs";

/**
 * Action — what a run does next: `{ do: "start" | "resume" | "hold" | "finish" | "refuse", kind: string | null, worksOn: string | null, route: string | null, participant: string | null,
 * job: string | null, reason: string | null }`. This file gives `start`, `resume` and `refuse`.
 * @typedef {{ do: string, kind: string | null, worksOn: string | null, route: string | null, participant: string | null, job: string | null, reason: string | null }} Action
 */

const RULE = "A RUN FOLLOWS THE MODULES' INTERFACES";
const ENDED = new Set(["done", "failed", "cancelled", "ended without record"]);

const action = (fields) => ({ do: "start", kind: null, worksOn: null, route: null, participant: null, job: null, reason: null, ...fields });
const known = (fact) => (fact === "unknown" ? null : fact ?? null);
const moduleOf = (edge) => edge.to.split(".")[0];

// The route as a job's record writes it.
const routeText = (route) => (route.kind === "tab" ? "tab" : route.kind === "ci" ? (route.runner === "hosted" ? "ci hosted" : `ci runner:${route.runner}`) : `bridge ${route.bridge}`);

// The refusal of a cycle: the finding at the first module of the cycle, naming the modules of it.
function refusal(graph, cycle) {
  const node = graph.nodes.get(cycle[0]);
  const found = finding({ artifact: node?.path ?? cycle[0], line: node?.line ?? 1, kind: "error", rule: RULE, what: `the uses of ${cycle.join(", ")} form a cycle`,
    fix: "change the architecture so that the modules do not use each other in a ring" });
  return action({ do: "refuse", reason: formatFinding(found) });
}

// The team's role assignment and sprint that startable is asked with for an item.
function teamOf(item, facts, workflow) {
  const held = facts.held.find((each) => each.item === item);
  if (held) {
    return { assignment: facts.assignments.find((each) => each.path.endsWith(`/${held.team}.md`)) ?? null, sprint: facts.sprints.find((each) => each.path.endsWith(`/${held.sprint}.md`)) ?? null };
  }
  if (workflow?.model?.flow?.sprints !== true && facts.assignments.length === 1) return { assignment: facts.assignments[0], sprint: null };
  return { assignment: null, sprint: null };
}

// The jobs of the run to resume: those that wait at a gate no resumption follows and whose gate is passed, in the order the run started them.
function resumptions(run, facts, rows) {
  return run.jobs.flatMap(({ job }) => {
    const row = rows.get(job);
    const gate = row?.state === "waiting at a gate" ? row.record.gates?.at(-1) : null;
    if (!gate || gate.resumedBy !== null) return [];
    if (!(facts.gateStates ?? []).some((each) => each.gate === gate.gate && each.state === "passed")) return [];
    const { kind, route, participant, worksOn } = row.record;
    return [action({ do: "resume", kind, worksOn: (worksOn ?? []).join(", "), route, participant, job })];
  });
}

// Whether every module the item uses beyond its own is done (see the readings above).
function usesDoneModules(item, graph, states) {
  const stateOf = new Map(states.map((state) => [state.item, state.state]));
  const own = new Set(graph.edges.filter((edge) => edge.via === "changes" && edge.from === item).map((edge) => edge.to));
  const changers = (module) => graph.edges.filter((edge) => edge.via === "changes" && edge.to === module).map((edge) => edge.from)
    .filter((each) => graph.nodes.get(each)?.level === "module" && stateOf.has(each));
  const done = (module) => changers(module).every((each) => stateOf.get(each) === "done");
  const used = graph.edges.filter((edge) => edge.via === "uses" && own.has(edge.from)).map(moduleOf).filter((module) => !own.has(module));
  return used.every(done);
}

// The first participant of the register who holds the item's implementing role and has a route that can be taken: { participant, route }, or null.
function holderOf(item, states, facts, workflow) {
  const { assignment, sprint } = teamOf(item, facts, workflow);
  const product = { visibility: known(facts.info)?.visibility ?? "unknown", jobWorkflow: facts.ci.jobWorkflow };
  for (const participant of facts.participants) {
    const verdict = startable(item, states, { workflow, assignment, sprint, held: facts.held, wip: workflow?.model?.flow?.wip ?? null, participants: [participant] });
    if (!verdict.startable) continue;
    const offer = routesFor(participant, facts.participants, product, facts.resourceNeeds).find((each) => each.available);
    if (offer) return { participant: participant.name, route: routeText(offer.route) };
  }
  return null;
}

/**
 * nextActions(run: Run, facts: Facts) -> Action[] — what to do now: the refusal of a cycle in the modules' uses, before anything starts; the resumption of each job of the run whose gate has been
 * decided; while the product has no CI configuration, the start of the kind `set-up-ci` and nothing else; then the start of the kind `implement` for each selected step or item that
 * `startable` admits, whose modules use only modules already done, on the route of a holder of the implementing role, as many as `jobs at once` allows. Nothing starts for a run that is stopped
 * or finished, nor where a fact it needs is "unknown".
 * @param {{ id: string, selection: string[], limits: { jobsAtOnce: number }, jobs: Array<{ job: string, kind: string, worksOn: string }>, state: string }} run
 * @param {object} facts MOD-progress-measures' Facts
 * @returns {Action[]}
 */
export function nextActions(run, facts) {
  if (run.state === "stopped" || run.state === "finished") return [];
  const graph = known(facts.graph);
  const order = graph === null ? null : moduleOrder(graph);
  if (order?.cycle) return [refusal(graph, order.cycle)];

  const rows = new Map((facts.jobs ?? []).map((row) => [row.record.id, row]));
  const running = run.jobs.filter(({ job }) => rows.has(job) && !ENDED.has(rows.get(job).state)).length;
  const resumed = resumptions(run, facts, rows);
  let free = Math.max(0, run.limits.jobsAtOnce - running);
  if (known(facts.ci) === null) return resumed;
  if (!facts.ci.configured) return [...resumed, ...(free > 0 && !run.jobs.some(({ kind }) => kind === "set-up-ci") ? [action({ kind: "set-up-ci" })] : [])];
  if (order === null || known(facts.resourceNeeds) === null) return resumed;

  const workflow = known(facts.workflow);
  const listed = facts.plan.states.map((state) => state.item);
  const candidates = run.selection.filter((item) => listed.includes(item)).sort((a, b) => listed.indexOf(a) - listed.indexOf(b));
  let states = facts.plan.states;
  const starts = [];
  for (const item of candidates) {
    if (free === 0) break;
    if (!usesDoneModules(item, graph, states)) continue;
    const holder = holderOf(item, states, facts, workflow);
    if (!holder) continue;
    starts.push(action({ kind: "implement", worksOn: item, ...holder }));
    states = states.map((state) => (state.item === item ? { ...state, state: "in progress" } : state));
    free -= 1;
  }
  return [...resumed, ...starts];
}
