// Progress in the declared model's measure (docs/architecture/MOD-progress-measures.md, Interfaces: progressIn; PROGRESS IS
// SHOWN IN THE MODEL'S OWN MEASURE, PROGRESS AND JOB STATE ARE DERIVED, NOT STORED). Of progressIn, this builds the grid, the
// timeline and the steps of a planned model, the burn-down of each team's sprint, for a model that works in sprints — with a
// time box of a fixed length, or without one, until the sprint ends —, and the board of a model with a work-in-progress limit with its
// items per state per day. Pure: the facts and the day are handed in; nothing is read, written or kept.
//
// Module: MOD-progress-measures
//
// A team's sprint is the record docs/backlog/sprints/<team>/<nn>.md, read with MOD-work-plans' planSchemas.sprint; a team's
// newest sprint is its running one while it is neither closed — its record holds ## Review — nor ended (MOD-work-plans' sprintsToClose), else its last.
// An item is done on the day a pull request naming it — in its head branch or its title — is merged.
//
// The board (MOD-progress-measures, Interfaces: progressIn, "for a model with a work-in-progress limit"). Where the module file leaves a
// reading open, this file takes the one it names:
//   - the columns are the states of MOD-work-plans' ItemState, in the order of that type, each item of the plan in the column of its state;
//   - `wip` is the model's limit; counting it per team is how `startable` and `blocked` apply it, and the board holds every item;
//   - the days run from `since`, else from the first day an item is dated, to today, with a number in `counts` for every column;
//   - an item is in progress from the earlier of the day a pull request naming it opened and the day a job record working on it started, and
//     done from the day it is done (as above); before its start it was ready, since a job starts only for a ready item; an item whose state
//     is another, or that nothing dates, is in its state on every day; on today every item is in its state, so that the last day is the board.
//
// Where the module file leaves a reading of a planned model's progress open, this file takes the one it names:
//   - A cell of the grid belongs to the steps of the implementation plan that realise its requirement and that the plan's order (docs/plan/order.md)
//     puts in its phase. With such steps it is done when each is done — merged —, and the head of the default branch is not known to fail: a run of
//     `ci.runs` in the state `failure` holds it in progress, unknown runs do not; it is in progress when some step is done or in progress, else open.
//   - Without such steps, a phase that produces `requirements` is done, every requirement of the grid being accepted; a phase the plan's order gives
//     a step to for another requirement is open; a phase that produces `ARC` or `MOD` rests on the files of the requirement's trace: the modules its
//     steps name (`modules`), for `MOD`, and the architecture decisions those modules follow, for `ARC`. It is done when all are accepted, open when
//     none is on a record of the approval statuses, in progress otherwise: a file that is open is what makes a cell in progress.
//   - Any other cell is open: the facts give no artifact for it.
//   - The timeline dates a phase from the day the gate before it passed, the first phase from the day the model was declared, to the day the nearest
//     gate leaving it or a later phase passed; a gate passes on the date of its record when its state is `passed`, not when passed on an earlier text.
//   - With the requirements unknown, the grid has no entry and says so; an unknown state of a step is neither done nor in progress.

import { planGrid } from "../model-catalogue/index.mjs";
import { sprintsToClose } from "../work-plans/index.mjs";

const DAY = 86400000;
const SPRINT_PATH = /^docs\/backlog\/sprints\/([^/]+)\/(\d+)\.md$/;
const ASSIGNMENT_PATH = /^docs\/role-assignments\/([^/]+)\.md$/;

/** A failure of progressIn, named as MOD-progress-measures' file names it. */
class ProgressError extends Error {
  constructor(name, message) {
    super(message);
    this.name = name;
  }
}

const text = (value) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
const list = (value) => (Array.isArray(value) ? value.map(text) : text(value).split(",").map((part) => part.trim()).filter(Boolean));
const nextDay = (day) => new Date(Date.parse(`${day}T00:00:00Z`) + DAY).toISOString().slice(0, 10);
const STATES = ["waiting for acceptance", "waiting for an item it builds on", "waiting", "ready", "in progress", "blocked", "done", "unknown"];
// The states that records and pull requests date; an item in another state is in it on every day.
const DATED = ["in progress", "blocked", "done"];
const dayOf = (value) => { const at = Date.parse(value instanceof Date ? value.toISOString() : text(value)); return Number.isFinite(at) ? new Date(at).toISOString().slice(0, 10) : null; };
const earliest = (days) => days.filter(Boolean).sort()[0] ?? null;
const sectionsOf = (record, heading) => (record?.appended ?? []).filter((section) => section?.heading === heading);

// The items a sprint holds on a day: those of the last ## Selection appended on or before it, else those of its front matter.
function selectionOn(record, day) {
  const decisions = sectionsOf(record, "## Selection").filter((section) => section.fields?.selection && text(section.fields.at) <= day);
  return list(decisions.length ? decisions.at(-1).fields.selection : record?.fields?.selection);
}

// The day an item is done: the earliest day a merged pull request names it; null while none is merged.
function doneOn(item, pullRequests) {
  return earliest(pullRequestsOf(item, pullRequests).filter((pr) => pr?.state === "merged").map((pr) => text(pr.merged).slice(0, 10)));
}

// The pull requests that name an item in their head branch or their title.
function pullRequestsOf(item, pullRequests) {
  const naming = new RegExp(`(?<![A-Za-z0-9])${item}(?![0-9])`);
  return pullRequests.filter((pr) => naming.test(text(pr?.branch)) || naming.test(text(pr?.title)));
}

// The day an item starts: the earlier of the opening of a pull request naming it and the start of a job record working on it.
function startedOn(item, pullRequests, jobs) {
  return earliest([...pullRequestsOf(item, pullRequests).map((pr) => dayOf(pr.opened)),
    ...jobs.filter((row) => list(row?.record?.worksOn).includes(item)).map((row) => dayOf(row.record.start))]);
}

// An item's column on a day, from its state now and the days that date it.
function columnOn(day, today, current, started, done) {
  if (day === today || !DATED.includes(current)) return current;
  if (current === "done") return done === null ? current : day >= done ? "done" : started !== null && day >= started ? "in progress" : "ready";
  return started === null ? current : day >= started ? "in progress" : "ready";
}

// The board of a model with a work-in-progress limit, and its items per state per day; null for a model without one.
function flowOf(model, since, facts, today) {
  if (typeof model.flow?.wip !== "number") return null;
  const items = (facts.plan?.states ?? []).map((each) => ({ item: each.item, column: STATES.includes(each.state) ? each.state : "unknown" }));
  const columns = STATES.map((name) => ({ name, items: items.filter((each) => each.column === name).map((each) => each.item) }));
  const cumulative = [];
  if (facts.pullRequests !== "unknown") {
    const pullRequests = facts.pullRequests ?? [];
    const jobs = facts.jobs ?? [];
    const dated = items.map(({ item, column }) => {
      const done = column === "done" ? doneOn(item, pullRequests) : null;
      return { column, done, started: !DATED.includes(column) ? null : earliest([startedOn(item, pullRequests, jobs), done]) };
    });
    const first = since ?? earliest(dated.flatMap((each) => [each.started, each.done]));
    for (let day = first; day && day <= today; day = nextDay(day)) {
      const counts = Object.fromEntries(STATES.map((name) => [name, 0]));
      for (const each of dated) counts[columnOn(day, today, each.column, each.started, each.done)] += 1;
      cumulative.push({ day, counts });
    }
  }
  return { columns, wip: model.flow.wip, cumulative };
}

// A team's sprint: its items with their states, the remaining items per day from its start to its end — to today while it
// runs —, and whether that burn-down is final: the sprint is closed (## Review) or MOD-work-plans' sprintsToClose names it as ended. With the pull requests unknown, the burn-down is not guessed: it is empty.
function teamSprint(team, record, states, pullRequests, today) {
  const closes = sprintsToClose([record], states, today);
  const final = sectionsOf(record, "## Review").length > 0 || closes.length > 0;
  // A sprint ended because every item it selects is done ended on the day the last of them was merged.
  const byItems = closes.some((each) => each.because === "every selected item done") && pullRequests !== "unknown"
    ? selectionOn(record, "9999-12-31").map((item) => doneOn(item, pullRequests)).sort().at(-1) : "";
  const end = text(record.fields?.end) || text(sectionsOf(record, "## Ended")[0]?.fields?.at) || text(byItems);
  const last = end && end < today ? end : today;
  const items = selectionOn(record, "9999-12-31").map((item) => states.find((s) => s?.item === item)
    ?? { item, state: "unknown", reason: null, job: null, pullRequest: null });
  const burnDown = [];
  if (pullRequests !== "unknown") {
    for (let day = text(record.fields?.start); day && day <= last; day = nextDay(day)) {
      const remaining = selectionOn(record, day).filter((item) => { const done = doneOn(item, pullRequests); return !done || done > day; });
      burnDown.push({ day, remaining: remaining.length });
    }
  }
  return { team, items, burnDown, final };
}

// ---------------------------------------------------------------- a planned model

const idOf = (document) => text(document?.id ?? document?.fields?.id);
const namesIn = (document, field) => list(document?.fields?.[field]);

// The phase the plan's order gives each step, by the step's identifier.
function phasesOfSteps(order) {
  const phases = new Map();
  for (const section of order?.sections ?? []) {
    for (const row of section?.rows ?? []) {
      const step = text(row?.cells?.Step) || text(row?.cells?.Item);
      if (step && !phases.has(step)) phases.set(step, text(row?.cells?.Phase));
    }
  }
  return phases;
}

// The status of the reviewed file with this identifier; null where no record of the approval statuses names it.
function statusOfFile(statuses, id) {
  for (const value of statuses instanceof Map ? statuses.values() : Object.values(statuses ?? {})) if (value?.id === id) return text(value.status);
  return null;
}

// The files of a requirement's trace that a phase producing `kinds` rests on: the modules its steps name, the architecture decisions those follow.
function traceFiles(steps, modules, kinds) {
  const named = [...new Set(steps.flatMap((step) => namesIn(step, "modules")))];
  const decisions = named.flatMap((id) => namesIn(modules.find((file) => idOf(file) === id), "follows")).filter((id) => /^ARC-/.test(id));
  return [...new Set([...(kinds.includes("MOD") ? named : []), ...(kinds.includes("ARC") ? decisions : [])])];
}

// The cell of one requirement, whose steps are given, in one phase.
function cellState(phase, steps, builtPhases, context) {
  const here = steps.filter((step) => context.phaseOfStep.get(idOf(step)) === phase.name);
  if (here.length) {
    const states = here.map((step) => context.states.find((state) => state?.item === idOf(step))?.state);
    if (states.every((state) => state === "done")) return context.failing ? "in progress" : "done";
    return states.some((state) => state === "done" || state === "in progress") ? "in progress" : "open";
  }
  if (phase.produces.includes("requirements")) return "done";
  if (builtPhases.has(phase.name)) return "open";
  const statuses = traceFiles(steps, context.modules, phase.produces).map((id) => statusOfFile(context.statuses, id));
  if (!statuses.length) return "open";
  if (statuses.every((status) => status === "accepted")) return "done";
  return statuses.every((status) => status === null) ? "open" : "in progress";
}

// The day a gate passed: the date of its record when the gate's state is `passed`; null otherwise.
function passedOn(gate, facts) {
  const state = (facts.gateStates ?? []).find((entry) => entry?.gate === `${gate.from} → ${gate.to}`);
  if (state?.state !== "passed") return null;
  const record = (facts.gates ?? []).find((document) => document?.path === state.record);
  return text(record?.fields?.date).slice(0, 10) || null;
}

// The model's phases in their order, each with the days it ran and the gate leaving it.
function timelineOf(model, facts) {
  const gates = model.phases.map((phase) => model.gates.find((gate) => gate.from === phase.name) ?? null);
  const ends = model.phases.map((_, index) => {
    const nearest = gates.slice(index).find(Boolean);
    return nearest ? passedOn(nearest, facts) : null;
  });
  const since = typeof facts.modelSince === "string" && facts.modelSince ? facts.modelSince.slice(0, 10) : null;
  return model.phases.map((phase, index) => ({ phase: phase.name, from: index === 0 ? since : ends[index - 1], to: ends[index],
    gate: gates[index] ? `${gates[index].from} → ${gates[index].to}` : null, passed: gates[index] ? passedOn(gates[index], facts) : null }));
}

// The `planned` of progressIn for a planned model: the grid, the timeline and the steps.
function plannedProgress(facts, model) {
  const grid = Array.isArray(facts.requirements) ? planGrid(facts.requirements, model) : { entries: [], count: "the requirements are unknown" };
  const items = facts.plan?.items ?? [];
  const phaseOfStep = phasesOfSteps(facts.plan?.order);
  const context = { phaseOfStep, states: facts.plan?.states ?? [], statuses: facts.statuses, modules: facts.modules ?? [],
    failing: Array.isArray(facts.ci?.runs) && facts.ci.runs.some((run) => run?.state === "failure") };
  const builtPhases = new Set(items.map((item) => phaseOfStep.get(idOf(item))).filter(Boolean));
  const phases = new Map(model.phases.map((phase) => [phase.name, phase]));
  const entries = grid.entries.map((entry) => {
    const steps = items.filter((item) => namesIn(item, "realises").includes(entry.requirement));
    return { ...entry, state: cellState(phases.get(entry.phase), steps, builtPhases, context) };
  });
  return { grid: { entries, count: grid.count }, timeline: timelineOf(model, facts), steps: [...(facts.plan?.states ?? [])] };
}

/**
 * progressIn(facts: Facts, now: Date) -> { measure, planned, sprints, flow, since } — the progress in the declared model's
 * measure. For a model that works in sprints, `sprints` holds, for each team — in the order of its role assignments, then any
 * other team with a sprint —, its newest sprint's items with their states and the remaining items per day of that sprint,
 * `final` once the sprint is closed or past its end; a team without a sprint has no entry. For a planned model `planned` holds the grid of
 * every accepted requirement in every phase, each cell open, in progress or done, the phases on a timeline with their gates, and the steps of
 * the implementation plan with their states; for any other model it is null. `flow` is the board of a model with a work-in-progress limit,
 * null for any other; `since` is the change of model, as the facts give it, and where the chart of `flow` starts. Throws NoModel when the
 * product declares none.
 * @param {object} facts @param {Date} now
 */
export function progressIn(facts, now) {
  const model = facts?.model;
  if (!model) throw new ProgressError("NoModel", "The product declares no process model, so it shows no progress in a model's measure.");
  const since = facts.modelSince ?? null;
  if (model !== "unknown" && model.kind === "planned") {
    return { measure: model.measure, planned: plannedProgress(facts, model), sprints: [], flow: null, since };
  }
  const today = now.toISOString().slice(0, 10);
  const flow = model === "unknown" ? null : flowOf(model, dayOf(since), facts, today);
  if (model === "unknown" || !model.flow?.sprints) {
    return { measure: model === "unknown" ? null : model.measure, planned: null, sprints: [], flow, since };
  }
  const states = facts.plan?.states ?? [];
  const pullRequests = facts.pullRequests === "unknown" ? "unknown" : (facts.pullRequests ?? []);
  const newest = new Map();
  for (const record of facts.sprints ?? []) {
    const match = SPRINT_PATH.exec(text(record?.path));
    if (match && (!newest.has(match[1]) || Number(match[2]) > newest.get(match[1]).number)) {
      newest.set(match[1], { number: Number(match[2]), record });
    }
  }
  const named = (facts.assignments ?? []).map((assignment) => ASSIGNMENT_PATH.exec(text(assignment?.path))?.[1]).filter(Boolean);
  const teams = [...new Set([...named, ...newest.keys()])].filter((team) => newest.has(team));
  return { measure: model.measure, planned: null,
    sprints: teams.map((team) => teamSprint(team, newest.get(team).record, states, pullRequests, today)), flow, since };
}
