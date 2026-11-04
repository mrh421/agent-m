// The derived state of a plan step or backlog item, and whether a job may start for it (docs/architecture/MOD-work-plans.md,
// Interfaces: itemStates, startable; STATUS IS DERIVED FROM THE RECORDS, A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT,
// NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED, NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT, A JOB GOES ONLY TO A HOLDER
// OF ITS ROLE). Pure: documents, jobs, pull requests, gate states, workflow, role assignment, sprint, held items and
// participants are handed in; nothing is read, written or kept.
//
// Module: MOD-work-plans
//
// A state is an ItemState — { item, state, reason, job, pullRequest } —, as itemStates derives it. An item's role assignment
// is the one of the team whose sprint holds it, and the product's one in a model without sprints; its team is named by the
// assignment's file, docs/role-assignments/<team>.md. The implementing role is the role of the workflow's phases that produce
// MOD, the modules' code. A reason is a sentence a person reads.

import { holdsRole } from "../product-process/index.mjs";
import { list, selectionOf, sprintOf } from "./sprints.mjs";

const text = (value) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
const listed = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
const teamOf = (assignment) => text(assignment?.path).split("/").pop().replace(/\.md$/, "") || "the product";
const fieldsOf = (document) => document?.fields ?? {};
const idOf = (document) => text(document?.id ?? document?.fields?.id);
const fieldList = (document, field) => list(fieldsOf(document)[field]);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function orderedByPlan(items, order) {
  const byId = new Map(items.map((item) => [idOf(item), item]).filter(([id]) => id));
  const used = new Set(), entries = [];
  for (const section of order?.sections ?? []) {
    for (const row of section?.rows ?? []) {
      const item = text(row?.cells?.Item) || text(row?.cells?.Step);
      if (!item || used.has(item) || !byId.has(item)) continue;
      used.add(item);
      entries.push({ item: byId.get(item), phase: text(row?.cells?.Phase) });
    }
  }
  for (const item of items) {
    const id = idOf(item);
    if (id && !used.has(id)) entries.push({ item, phase: "" });
  }
  return entries;
}

function orderedBacklog(items) {
  const byId = new Map(items.map((item) => [idOf(item), item]).filter(([id]) => id));
  const visiting = new Set(), visited = new Set(), entries = [];
  const visit = (item) => {
    const id = idOf(item);
    if (!id || visited.has(id)) return;
    if (visiting.has(id)) { entries.push({ item, phase: "" }); visited.add(id); return; }
    visiting.add(id);
    for (const dependency of fieldList(item, "builds_on")) if (byId.has(dependency)) visit(byId.get(dependency));
    visiting.delete(id);
    if (!visited.has(id)) { entries.push({ item, phase: "" }); visited.add(id); }
  };
  for (const item of items) visit(item);
  return entries;
}

function orderedItems(items, order) {
  return order ? orderedByPlan(items, order) : orderedBacklog(items);
}

function statusOf(statuses, artifact) {
  const entries = statuses instanceof Map ? statuses.entries() : Object.entries(statuses ?? {});
  for (const [key, value] of entries) {
    if (key === artifact) return typeof value === "string" ? value : value?.status ?? null;
    if (value?.id === artifact) return value.status ?? null;
  }
  return null;
}

function queueEntryName(queue, entry) {
  return `${text(queue?.folder) || "queue"}#${entry?.number ?? "?"}`;
}

function queueTouches(entry, artifact) {
  if (text(entry?.anchor) === artifact) return true;
  if (text(entry?.file).includes(artifact)) return true;
  return (entry?.impact ?? []).some((change) => change?.name === artifact);
}

function queueReasons(queues, artifact) {
  const reasons = [];
  for (const queue of queues ?? []) {
    for (const entry of queue?.entries ?? []) {
      if (entry?.state === "in SPEC" || !queueTouches(entry, artifact)) continue;
      const impact = (entry?.impact ?? []).find((change) => change?.name === artifact);
      const change = impact?.change ? ` as ${impact.change}` : "";
      reasons.push(`${artifact} is still in ${queueEntryName(queue, entry)}${change}, state ${text(entry?.state) || "open"}`);
    }
  }
  return reasons;
}

function acceptanceReasons(item, facts) {
  const reasons = [];
  for (const artifact of fieldList(item, "realises")) {
    const queued = queueReasons(facts.queues, artifact);
    if (queued.length) { reasons.push(...queued); continue; }
    const status = statusOf(facts.statuses, artifact);
    if (status === "accepted") continue;
    reasons.push(status ? `${artifact} is ${status}, not accepted` : `${artifact} is not accepted`);
  }
  return reasons;
}

function unfinishedPrerequisites(item, states) {
  return fieldList(item, "builds_on").filter((dependency) => states.get(dependency)?.state !== "done");
}

function prerequisiteReason(prerequisites) {
  return `${listed(prerequisites)} ${prerequisites.length === 1 ? "is" : "are"} not done`;
}

// The mark of a done item: the reasons that keep an item not done waiting — a requirement or use case it realises that is withdrawn, changed or not accepted, an item it builds on
// that is not done — joined; null without one. The state stays done.
function doneMark(item, states, facts) {
  const reasons = acceptanceReasons(item, facts);
  const prerequisites = unfinishedPrerequisites(item, states);
  if (prerequisites.length) reasons.push(prerequisiteReason(prerequisites));
  return reasons.length ? reasons.join("; ") : null;
}

function gatesBefore(phase, facts) {
  if (!phase || !facts.workflow) return [];
  const byName = new Map((facts.gates ?? []).map((gate) => [gate?.gate, gate]));
  return (facts.workflow.gates ?? []).filter((gate) => gate.to === phase)
    .map((gate) => ({ gate, state: byName.get(gate.name) ?? { gate: gate.name, state: "pending" } }))
    .filter(({ state }) => state.state !== "passed");
}

function gateReason({ gate, state }) {
  const details = [text(state.state) || "pending", text(state.needs), text(state.difference)].filter(Boolean).join("; ");
  return `${gate.name}, decided by ${gate.decider}${details ? ` (${details})` : ""}`;
}

function jobFor(item, jobs) {
  const id = idOf(item);
  return (jobs ?? []).find((row) => list(row?.record?.worksOn).includes(id)) ?? null;
}

const jobId = (job) => text(job?.record?.id) || text(job?.id) || "the job";

// A job a rejected gate ended (UC-034 7a, UC-024 10a): its End is `failed` and its reason reads "the gate <gate> was rejected by <gate record>" and, when the record gave one, ": <the record's reason>" — the End that
// ending a job at a rejected gate writes. A job that failed otherwise has another reason, or none.
const REJECTED_END = /^the gate .+ was rejected by \S+\.md(?::|$)/;
const endedAtRejectedGate = (job) => job?.state === "failed" && REJECTED_END.test(text(job.record?.end?.reason));

function blockedJobReason(job) {
  const id = jobId(job);
  if (job?.state !== "waiting at a gate") return `job ${id} is ${text(job?.state)}`;
  const gate = (job.record?.gates ?? []).findLast?.((entry) => entry?.resumedBy === null) ?? null;
  if (gate) return `job ${id} waits at ${gate.gate} for ${gate.decider}`;
  if (job.record?.question) return `job ${id} waits for a person: ${job.record.question}`;
  return `job ${id} is waiting at a gate`;
}

function namesPullRequest(pullRequest, id) {
  const pattern = new RegExp(`(?<![A-Za-z0-9])${escapeRegExp(id)}(?![0-9])`, "i");
  return pattern.test(text(pullRequest?.branch)) || pattern.test(text(pullRequest?.title));
}

function pullRequestRef(pullRequest) {
  return text(pullRequest?.number) || text(pullRequest?.url) || text(pullRequest?.branch) || "the pull request";
}

function pullRequestFor(item, pullRequests, state) {
  const id = idOf(item);
  return (pullRequests ?? []).find((pullRequest) => pullRequest?.state === state && namesPullRequest(pullRequest, id)) ?? null;
}

// A pull request of the item opened after the job's start: the job's own. Without a readable date it is not.
function openedAfter(pullRequest, job) {
  return new Date(pullRequest?.opened) > new Date(job?.record?.start);
}

// The merged pull request that makes the item done: any merged one naming it, whatever job or pull request of it followed. Null while the
// pull requests are unknown.
function mergedPullRequest(item, facts) {
  return facts.pullRequests === "unknown" ? null : pullRequestFor(item, facts.pullRequests, "merged");
}

// Whether the item's record names the commits that built it: the Product Owner's own record, read from the item alone, with no request.
const builtBy = (item) => fieldList(item, "built_by").length > 0;

function derivedState(item, phase, states, facts) {
  const id = idOf(item);
  const job = jobFor(item, facts.jobs);
  const named = job ? jobId(job) : null;

  // A merged pull request decides first: the item is done whatever else holds — a text it realises that changed since, an item it builds
  // on that is not done, a gate, or a job or pull request of it after the merge. A change to it is a new item. What holds of the texts and
  // the prerequisites marks the done item with its reason.
  const merged = mergedPullRequest(item, facts);
  if (merged) return { item: id, state: "done", reason: doneMark(item, states, facts), job: named, pullRequest: pullRequestRef(merged) };

  // An item no merged pull request names is done when its record names the commits that built it (built_by).
  if (builtBy(item)) return { item: id, state: "done", reason: doneMark(item, states, facts), job: named, pullRequest: null };

  const acceptance = acceptanceReasons(item, facts);
  if (acceptance.length) return { item: id, state: "waiting for acceptance", reason: acceptance.join("; "), job: named, pullRequest: null };

  const prerequisites = unfinishedPrerequisites(item, states);
  if (prerequisites.length) return { item: id, state: "waiting for an item it builds on",
    reason: prerequisiteReason(prerequisites), job: named, pullRequest: null };

  const gates = gatesBefore(phase, facts);
  if (gates.length) return { item: id, state: "waiting", reason: gates.map(gateReason).join("; "), job: named, pullRequest: null };

  // A decision of the gate's decider ended the job: the item returns to ready with the End's reason, which names the gate, the gate record and the rejection's reason.
  if (endedAtRejectedGate(job)) return { item: id, state: "ready", reason: job.record.end.reason, job: named, pullRequest: null };

  if (["failed", "waiting at a gate"].includes(job?.state)) {
    return { item: id, state: "blocked", reason: blockedJobReason(job), job: named, pullRequest: null };
  }
  if (["queued", "running", "cancelling"].includes(job?.state)) {
    return { item: id, state: "in progress", reason: `job ${named} is ${job.state}`, job: named, pullRequest: null };
  }

  if (facts.pullRequests === "unknown") {
    return { item: id, state: "unknown", reason: "pull request facts are unknown", job: named, pullRequest: null };
  }

  const open = pullRequestFor(item, facts.pullRequests, "open");
  if (open) return { item: id, state: "in progress", reason: `pull request ${pullRequestRef(open)} is open for review`,
    job: named, pullRequest: pullRequestRef(open) };

  // A job that ended as done keeps the item in progress until a pull request opened after its start is merged or closed.
  if (job?.state === "done") {
    const ofJob = (facts.pullRequests ?? []).filter((pullRequest) => namesPullRequest(pullRequest, id) && openedAfter(pullRequest, job));
    if (!ofJob.some((pullRequest) => pullRequest?.state === "closed")) {
      return { item: id, state: "in progress", reason: `job ${named} is done, and no pull request of it is merged yet`,
        job: named, pullRequest: null };
    }
    return { item: id, state: "ready", reason: null, job: named, pullRequest: null };
  }

  return { item: id, state: "ready", reason: null, job: named, pullRequest: null };
}

/**
 * itemStates(items: Document[], order: Document | null, facts: { statuses: Map<string, { id: string, kind: string,
 * status: string }>, queues: Queue[], jobs: JobRow[], pullRequests: PullRequest[] | "unknown", gates: Array<{ gate:
 * string, state: string }>, workflow: Workflow | null }) -> ItemState[] — every supplied step in the
 * plan order, or every backlog item after the items it builds on, with state derived only from the supplied facts.
 * @param {object[]} items @param {object | null} order @param {object} facts
 * @returns {object[]}
 */
export function itemStates(items, order, facts = {}) {
  const states = new Map();
  for (const { item, phase } of orderedItems(items ?? [], order)) {
    const state = derivedState(item, phase, states, facts);
    states.set(state.item, state);
  }
  return [...states.values()];
}

// Why an item in this state cannot start; null for a ready item.
function stateReason(item, state) {
  if (!state) return `${item} has no state: it is no item of the backlog and no step of the plan.`;
  const why = text(state.reason);
  switch (state.state) {
    case "ready": return null;
    case "waiting for acceptance": return `${item} realises ${why}, which is not accepted yet.`;
    case "waiting for an item it builds on": return `${item} builds on ${why}, which is not done.`;
    case "waiting": return `${item} waits for ${why}: no decision of it is recorded.`;
    case "in progress": return `${item} is in progress already.`;
    case "blocked": return `${item} is blocked${why ? `: ${why}` : ""}.`;
    case "done": return `${item} is done: a change to it is a new item.`;
    default: return `The state of ${item} is unknown: the pull requests could not be read.`;
  }
}

// The roles of the workflow's phases that produce MOD, as the workflow names them, each with the capabilities it needs.
function implementingRoles(workflow) {
  const names = new Set((workflow?.phases ?? []).filter((phase) => (phase.produces ?? []).includes("MOD")).flatMap((phase) => phase.roles ?? []));
  return (workflow?.roles ?? []).filter((role) => names.has(role.name));
}

// Why no holder of the implementing role in the assignment can implement; null when one holder has all the role needs.
function holderReason(item, workflow, assignment, participants) {
  const roles = implementingRoles(workflow);
  if (!roles.length) return `The process names no role whose phase produces MOD, so no job implements ${item}.`;
  const team = teamOf(assignment);
  const parts = [];
  for (const role of roles) {
    const holders = (participants ?? []).filter((participant) => assignment && holdsRole(assignment, participant.name, role.name));
    const needs = role.capabilities ?? [];
    if (holders.some((holder) => needs.every((capability) => (holder.capabilities ?? []).includes(capability)))) return null;
    if (!holders.length) { parts.push(`${role.name} has no holder in ${team}`); continue; }
    const lacking = needs.filter((capability) => !holders.some((holder) => (holder.capabilities ?? []).includes(capability)));
    parts.push(`no holder of ${role.name} in ${team} has all it needs — ${listed(needs)}${lacking.length
      ? `; none can ${listed(lacking)}` : ""}`);
  }
  return `No job can implement ${item}: ${parts.join("; ")}.`;
}

/**
 * startable(item: string, states: ItemState[], context: { workflow: Workflow, assignment: Document, sprint: Document | null,
 * held: Held[], wip: number | null, participants: Participant[] }) -> { startable: true } | { startable: false, reasons:
 * string[] } — every reason a job for this step or item cannot start: its state, where it is not ready — a requirement or use
 * case it names not accepted, an item it builds on not done, the gate before its phase not recorded, or that it is under way
 * or done —; not selected for `sprint`, the current sprint of its team, or no such sprint, in a model with sprints; the
 * work-in-progress limit `wip` reached by the items in progress under `assignment`, its role assignment, naming them and
 * those waiting for review; no holder of the implementing role in `assignment` with what the role needs.
 * @param {string} item @param {object[]} states @param {object} context
 * @returns {{ startable: true } | { startable: false, reasons: string[] }}
 */
export function startable(item, states, context) {
  const { workflow, assignment, sprint = null, held = [], wip = null, participants = [] } = context ?? {};
  const all = states ?? [];
  const team = teamOf(assignment);
  const sprints = workflow?.model?.flow?.sprints === true;
  const reasons = [];

  const own = stateReason(item, all.find((state) => state?.item === item));
  if (own) reasons.push(own);

  if (sprints && !sprint) reasons.push(`No sprint of ${team} is running: ${item} can start only once one selects it.`);
  else if (sprints && !selectionOf(sprint).includes(item)) {
    reasons.push(`${item} is not selected for ${sprintOf(sprint)?.name ?? text(sprint.path)}, the current sprint of ${team}.`);
  }

  if (typeof wip === "number") {
    const under = sprints ? new Set((held ?? []).filter((entry) => entry.team === team).map((entry) => entry.item)) : null;
    const busy = all.filter((state) => state?.item !== item && state?.state === "in progress" && (!under || under.has(state.item)));
    if (busy.length >= wip) {
      const review = busy.filter((state) => state.pullRequest).map((state) => state.item);
      reasons.push(`The work-in-progress limit of ${wip} is reached under ${team}: ${listed(busy.map((state) => state.item))} `
        + `${busy.length === 1 ? "is" : "are"} in progress${review.length ? `, ${listed(review)} waiting for review` : ""}.`);
    }
  }

  const holder = holderReason(item, workflow, assignment, participants);
  if (holder) reasons.push(holder);

  return reasons.length ? { startable: false, reasons } : { startable: true };
}
