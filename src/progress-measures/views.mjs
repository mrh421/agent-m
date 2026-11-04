// views.mjs — the views of the routes `progress` and `backlog` of MOD-implementation-pages and of the route `schedule` of MOD-test-pages (MOD-progress-measures, Interfaces:
// ProgressView, BacklogView, ScheduleView, progressView, backlogView, scheduleView, storedView; Data: `<commit>.progress.json.gz`, `<commit>.backlog.json.gz`,
// `<commit>.schedule.json.gz`, `latest.json`): derived from a product's Facts, pure, the same whether publishOverview derives them in CI or a page derives them where none is
// stored; and read back from the branch `overview-cache`. A view holds what its page shows and nothing else: no record's text, no pull request, no test's declaration
// (PROGRESS AND JOB STATE ARE DERIVED, NOT STORED).
//
// Module: MOD-progress-measures
//
// Where the module file leaves a reading open, this file takes the one it names:
//   - A team's running sprint in the ProgressView is the newest of its sprints whose record holds no `## Review`; `measure` is progressIn's over those sprints alone
//     and the items they select, so that, in a model with a work-in-progress limit too, no item outside them stands in the view. A sprint's
//     `name` is `<team>/<nn>`; `ended` is its `end`, else the `at` of its `## Ended`, else, where every item it selects is done, the day the last of them was merged (the last day of its final burn-down), else null; `final` is progressIn's for the sprint, `endable` a sprint not final without an
//     end and without `## Ended`. A running sprint's item is { item, path, title, state, changes, uses }: `changes` and `uses` those of its hold, else the item's modules and none.
//   - In the BacklogView, a team's running sprint is its newest unless progressIn over every sprint names the team's sprint final, as the backlog has always taken it; its
//     `lastEnded` the newest of the others, `items` and `end` those of progressIn's entry of the team over them — `end` "" where that entry is no final burn-down. `kept` is
//     given only in a product with several teams; its `team` is the team the item is kept from, its `module` null for the hold of the item itself.
//   - A done item's merge is the earliest merged pull request that names it, in its branch or its title, as an ISO time.
//   - The views are gzipped with the platform's CompressionStream, as the trace graph is (MOD-trace-graph).
//   - In the ScheduleView, a declaration counts under its level where that is one of the five, and under `paid` where it calls a paid service; a declaration of another level
//     that calls none counts under no row. scheduleView refuses facts whose tests are not read (TypeError): a count is never guessed.

import { conflicts } from "../work-plans/index.mjs";
import { progressIn } from "./measures.mjs";
import { blocked, gateOverview, whoWorksOnWhat } from "./overviews.mjs";
import { COUNTED } from "./stored.mjs";

export { OVERVIEW_BRANCH, LATEST, viewFile, gzipped, latestCommit, storedView } from "./stored.mjs";


const SPRINT = /^docs\/backlog\/sprints\/([^/]+)\/(\d+)\.md$/;
const ASSIGNMENT = /^docs\/role-assignments\/([^/]+)\.md$/;
const ITEM = /(ITM-\d{3,})/;

const text = (value) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
const list = (value) => (Array.isArray(value) ? value.map(text) : text(value).split(",").map((part) => part.trim()).filter(Boolean));
const idOf = (doc) => text(doc?.id ?? doc?.fields?.id) || ITEM.exec(text(doc?.path))?.[1] || "";
const closed = (record) => (record?.appended ?? []).some((section) => section?.heading === "## Review");
const endedSection = (record) => (record?.appended ?? []).find((section) => section?.heading === "## Ended") ?? null;
const selectionOf = (record) => list(record.appended?.filter((section) => section.heading === "## Selection").at(-1)?.fields?.selection ?? record.fields?.selection);
const modelOf = (facts) => (facts.model !== null && typeof facts.model === "object" ? facts.model : null);

// The teams of the role assignments and the sprints, in that order.
const teamsOf = (facts) => [...new Set([...facts.assignments.map((each) => ASSIGNMENT.exec(each.path)?.[1]), ...facts.sprints.map((each) => SPRINT.exec(each.path)?.[1])].filter(Boolean))];

// The newest of `records` of `team`: { record, name }, or null.
function newestOf(records, team) {
  let found = null;
  for (const record of records) {
    const [, of, nn] = SPRINT.exec(record.path) ?? [];
    if (of === team && (found === null || Number(nn) > found.nn)) found = { record, nn: Number(nn), name: `${team}/${nn}` };
  }
  return found;
}

// progressIn of the facts, or null where the product has no model or its measure cannot be derived.
function measureOf(facts, now) {
  if (modelOf(facts) === null) return null;
  try { return progressIn(facts, now); } catch { return null; }
}

/**
 * When each done item was first merged, from the merged pull requests that name it — in their branch or their title —, as an ISO time: Map(item -> time).
 * @param {object[]} states MOD-work-plans' ItemState @param {object[] | "unknown"} pullRequests
 */
export function mergedAtOf(states, pullRequests) {
  const mergedAt = new Map();
  for (const state of states) {
    if (state.state !== "done") continue;
    const naming = new RegExp(`(?<![A-Za-z0-9])${state.item}(?![0-9])`, "i");
    const merged = (Array.isArray(pullRequests) ? pullRequests : []).filter((each) => each.state === "merged" && naming.test(`${text(each.branch)} ${text(each.title)}`))
      .map((each) => each.merged).filter((at) => at && Number.isFinite(Date.parse(at))).sort()[0];
    if (merged) mergedAt.set(state.item, new Date(merged).toISOString());
  }
  return mergedAt;
}
const mergesOf = (items, mergedAt) => items.filter((item) => mergedAt.has(item)).map((item) => ({ item, at: mergedAt.get(item) }));

// What both views say of the commit and its model.
function headOf(facts) {
  const model = modelOf(facts);
  return {
    commit: facts.snapshot.commit, declared: facts.declaration !== null, modelFile: text(facts.declaration?.fields?.model_file) || null, modelUnread: facts.modelUnread ?? null,
    model: model && { name: text(model.name), kind: text(model.kind), sprints: model.flow?.sprints === true, wip: typeof model.flow?.wip === "number" ? model.flow.wip : null,
      measure: text(model.measure) || null },
  };
}

/**
 * progressView(facts: Facts, now: Date) -> ProgressView — what the route `progress` shows of the facts' commit (Interfaces). Pure.
 * @param {object} facts @param {Date} now
 */
export function progressView(facts, now) {
  const head = headOf(facts);
  const sprints = head.model?.sprints === true;
  const running = facts.sprints.filter((record) => !closed(record));
  const selected = new Set(running.flatMap(selectionOf));
  const measure = measureOf(sprints ? { ...facts, sprints: running, plan: { ...facts.plan, items: facts.plan.items.filter((doc) => selected.has(idOf(doc))),
    states: facts.plan.states.filter((state) => selected.has(state.item)) } } : facts, now);
  const stateOf = (id) => facts.plan.states.find((each) => each.item === id) ?? { item: id, state: "unknown", reason: null, job: null, pullRequest: null };
  const docOf = (id) => facts.plan.items.find((doc) => idOf(doc) === id) ?? null;
  const mergedAt = mergedAtOf(facts.plan.states, facts.pullRequests);
  const teams = teamsOf(facts).map((team) => {
    const newest = sprints ? newestOf(running, team) : null;
    const entry = measure?.sprints?.find((each) => each.team === team) ?? null;
    if (newest === null || entry === null) return { team, sprint: null };
    const { record } = newest, fields = record.fields ?? {};
    const holds = new Map(facts.held.filter((each) => each.team === team).map((each) => [each.item, each]));
    const items = entry.items.map(({ item }) => {
      const doc = docOf(item), hold = holds.get(item);
      return { item, path: doc?.path ?? null, title: text(doc?.fields?.title), state: stateOf(item), changes: hold?.changes ?? list(doc?.fields?.modules), uses: hold?.uses ?? [] };
    });
    const ended = endedSection(record);
    return { team, sprint: { name: newest.name, path: record.path, goal: text(fields.goal), start: text(fields.start), end: text(fields.end), branch: text(fields.branch),
      closer: text(fields.closer), ended: text(fields.end) || text(ended?.fields?.at) || (entry.final ? entry.burnDown.at(-1)?.day : null) || null, final: entry.final === true,
      endable: entry.final !== true && !text(fields.end) && ended === null, items, merges: mergesOf(items.map((each) => each.item), mergedAt) } };
  });
  const shown = new Set(teams.flatMap((team) => team.sprint?.items.map((each) => each.item) ?? []));
  return { ...head, measure, teams, gates: gateOverview(facts), blocked: sprints ? blocked(facts).filter((entry) => shown.has(entry.item)) : blocked(facts),
    who: whoWorksOnWhat(facts) };
}

// The first holder, in the team's role assignment, of the role of the phase that produces items.
function ownerOf(model, assignments, team) {
  const role = model?.phases?.find((phase) => (phase.produces ?? []).includes("ITM"))?.roles?.[0];
  const assignment = assignments.find((each) => ASSIGNMENT.exec(each.path)?.[1] === team);
  const row = (assignment?.sections ?? []).flatMap((section) => section.rows ?? []).find((each) => text(each.cells.Role) === role);
  return list(row?.cells.Participants)[0] ?? "";
}

/**
 * backlogView(facts: Facts, now: Date) -> BacklogView — what the route `backlog` shows of the facts' commit (Interfaces). Pure.
 * @param {object} facts @param {Date} now
 */
export function backlogView(facts, now) {
  const head = headOf(facts);
  const model = modelOf(facts);
  const teams = teamsOf(facts);
  const every = measureOf(facts, now);
  const runningOf = (team) => {
    const newest = newestOf(facts.sprints, team);
    return newest && !every?.sprints?.find((each) => each.team === team)?.final ? newest : null;
  };
  const running = new Map(teams.map((team) => [team, runningOf(team)]));
  const runningRecords = new Set([...running.values()].filter(Boolean).map((each) => each.record));
  const others = facts.sprints.filter((record) => !runningRecords.has(record));
  const ended = measureOf({ ...facts, sprints: others }, now);
  const mergedAt = mergedAtOf(facts.plan.states, facts.pullRequests);
  const docOf = (id) => facts.plan.items.find((doc) => idOf(doc) === id) ?? null;
  const rows = facts.plan.states.map((state) => {
    const doc = docOf(state.item);
    const held = facts.held.find((each) => each.item === state.item) ?? null;
    const kept = teams.length < 2 || doc === null ? [] : teams.filter((team) => team !== held?.team)
      .flatMap((team) => conflicts(doc, team, facts.held, facts.modules).map((each) => ({ team, sprint: each.sprint, item: each.item, module: each.module || null })));
    return { item: state.item, path: text(doc?.path), title: text(doc?.fields?.title), realises: list(doc?.fields?.realises), state, held, kept };
  });
  const realised = new Set(facts.plan.items.flatMap((doc) => list(doc?.fields?.realises)));
  const requirements = (Array.isArray(facts.requirements) ? facts.requirements : []).filter((name) => !realised.has(name)).sort();
  const useCases = [...facts.statuses.values()].filter((entry) => entry.kind === "use-case" && entry.status === "accepted").map((entry) => entry.id)
    .filter((name) => !realised.has(name)).sort();
  return {
    ...head,
    teams: teams.map((team) => {
      const now = running.get(team), last = newestOf(others, team);
      const entry = last ? ended?.sprints?.find((each) => each.team === team) ?? null : null;
      const items = entry ? entry.items.map((each) => each.item) : last ? selectionOf(last.record) : [];
      return { team, owner: ownerOf(model, facts.assignments, team),
        running: now && { name: now.name, path: now.record.path, goal: text(now.record.fields?.goal), closer: text(now.record.fields?.closer), selection: selectionOf(now.record) },
        lastEnded: last && { name: last.name, path: last.record.path, start: text(last.record.fields?.start), end: entry?.final && entry.burnDown.length ? entry.burnDown.at(-1).day : "",
          items, merges: mergesOf(items, mergedAt) } };
    }),
    rows,
    uncovered: { requirements, useCases },
  };
}

/**
 * scheduleView(facts: Facts) -> ScheduleView — what the route `schedule` shows of the facts' commit (Interfaces): { commit, counts }, the number of the test declarations of each
 * level, and of those that call a paid service. Pure.
 * @param {object} facts
 */
export function scheduleView(facts) {
  if (!Array.isArray(facts.tests)) throw new TypeError("scheduleView counts the tests of facts read with the scope all");
  const counts = Object.fromEntries(COUNTED.map((row) => [row, 0]));
  for (const declaration of facts.tests) {
    if (declaration.level !== "paid" && Object.hasOwn(counts, declaration.level)) counts[declaration.level] += 1;
    if (declaration.paid) counts.paid += 1;
  }
  return { commit: facts.snapshot.commit, counts };
}
