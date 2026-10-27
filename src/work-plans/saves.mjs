// The commits of a team's sprint: its start, a new start decision while it runs, its end, its close, and its increment given up
// (docs/architecture/MOD-work-plans.md, Interfaces: startSprint, endSprint, closeSprint, giveUpIncrement; EVERY TEAM RUNS SPRINTS
// OF ITS OWN, SPRINTS OF DIFFERENT TEAMS CHANGE NO MODULE THE OTHER CHANGES OR USES, A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS
// OWN, A SPRINT ENDS WITH A REVIEW OF ITS INCREMENT, A SPRINT ENDS WITH A RETROSPECTIVE, A SPRINT HOLDS ITS ITEMS UNTIL THEY
// REACH THE DEFAULT BRANCH). Each save is one commit on the default branch, at the head that was
// read, through the host it is given — a person's own input on the page, or a job's, whose provenance lines it carries.
//
// Module: MOD-work-plans
//
// A sprint's record is only ever appended to, never rewritten: a new start decision adds ## Selection, a close ## Review,
// ## Unfinished items and ## Retrospective, an increment given up ## Increment given up. The items a start selects are read from the snapshot at the head with
// MOD-documents' item schema. A refusal is a WorkPlansError named as the module file names it, and nothing is written then.

import { appendSection, artifactSchemas, readDocument, writeDocument } from "../documents/index.mjs";
import { sprintSchema } from "./schemas.mjs";
import { conflicts, selectionOf } from "./sprints.mjs";

/** A failure of a save, named as MOD-work-plans' file names it, with the facts it carries. */
export class WorkPlansError extends Error {
  constructor(name, fields, message) {
    super(message);
    this.name = name;
    Object.assign(this, fields ?? {});
  }
}

// The time box a declaration's ## Branches names; the sprint's records and files.
const TIME_BOX = "Sprint";
const SPRINT_FILE = /^docs\/backlog\/sprints\/([^/]+)\/(\d+)\.md$/;
const ITEM_FILE = /^docs\/backlog\/(ITM-\d{3,})-[^/]+\.md$/;
const DAY = 86400000;

const text = (value) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
const list = (value) => (Array.isArray(value) ? value.map(text) : text(value).split(",").map((part) => part.trim()).filter(Boolean));
const listed = (names) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);
const plusDays = (date, days) => new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY).toISOString().slice(0, 10);
const message = (subject, trailers) => (trailers?.length ? `${subject}\n\n${trailers.join("\n")}` : subject);

// The days a time box lasts, from its length as a model writes it — "<n> day(s)" or "<n> week(s)" —; null without one.
function boxDays(timeBox) {
  if (timeBox === null || timeBox === undefined || text(timeBox).trim() === "") return null;
  const length = /^\s*(\d+)\s*(day|week)s?\s*$/i.exec(text(timeBox));
  if (!length) {
    throw new WorkPlansError("SprintRefused", { reasons: [`The model's time box "${timeBox}" is no length in days or weeks.`] },
      `The model's time box "${timeBox}" is no length in days or weeks.`);
  }
  return Number(length[1]) * (length[2].toLowerCase() === "week" ? 7 : 1);
}

// The branch the declaration gives the time box, its placeholders <team> and <nn> filled; "" where it gives none.
function sprintBranch(declaration, team, nn) {
  const branches = (declaration?.sections ?? []).find((section) => section.heading === "## Branches");
  const row = (branches?.rows ?? []).find((r) => text(r.cells["Phase or time box"]).trim() === TIME_BOX);
  const pattern = text(row?.cells.Branch).trim().replace(/^`(.*)`$/, "$1").trim();
  return pattern ? pattern.replaceAll("<team>", team).replaceAll("<nn>", nn) : "";
}

// Why `ids` cannot be selected for `team`'s sprint together with `selection`: an item the backlog lacks, one waiting for
// acceptance, one whose building blocks are neither done nor selected with it, or one that `conflicts` names.
async function refusals(ids, selection, team, { states, held, architecture }, snapshot) {
  const paths = new Map(snapshot.paths.map((path) => [ITEM_FILE.exec(path)?.[1], path]).filter(([id]) => id));
  const stateOf = (id) => (states ?? []).find((state) => state?.item === id) ?? null;
  const reasons = [];
  for (const id of ids) {
    const path = paths.get(id);
    if (!path) { reasons.push(`${id} is no item of the backlog.`); continue; }
    const item = readDocument(artifactSchemas().item, path, await snapshot.read(path));
    const state = stateOf(id);
    if (state?.state === "waiting for acceptance") reasons.push(`${id} waits for the acceptance of ${text(state.reason) || "what it realises"}.`);
    const missing = list(item.fields.builds_on).filter((built) => !selection.includes(built) && stateOf(built)?.state !== "done");
    if (missing.length) {
      reasons.push(`${id} builds on ${listed(missing)}, which ${missing.length === 1 ? "is" : "are"} not done; select ${missing.length === 1
        ? "it" : "them"} with ${id}, or later.`);
    }
    for (const kept of conflicts(item, team, held, architecture)) {
      reasons.push(kept.module
        ? `${id} cannot be selected: ${kept.team}'s sprint ${kept.sprint} holds ${kept.item}, and both concern ${kept.module}.`
        : `${id} cannot be selected: ${kept.team}'s sprint ${kept.sprint} holds it.`);
    }
  }
  return reasons;
}

/**
 * startSprint(host: Host, sprint: { team: string, goal: string, start: string, closer: string, selection: string[] }, context:
 * { states: ItemState[], model: Model, declaration: Document, held: Held[], architecture: Document[], running: Document |
 * null, head: string, trailers: string[] }) -> Promise<{ commit: string, path: string, added: string[], removed: string[] }>
 * — Start sprint, for one team. A new sprint is docs/backlog/sprints/<team>/<nn>.md, with the team's next number; its end the
 * date the model's time box gives from its start, empty without one; its branch the one the declaration gives the time box,
 * its placeholders <team> and <nn> filled, created from the head — empty, and none created, where the declaration gives none.
 * While `running` runs, the decision is appended to it as ## Selection, at `start`, and `added` and `removed` name what it
 * changes. Each item it selects — of a running sprint, each it adds — is checked first; one waiting for acceptance, one
 * selected without the items it builds on that are not done, or one that `conflicts` names refuses the start with
 * SprintRefused { reasons }, and nothing is written. Crosses the network, through the host; fails also with the host's
 * failures.
 */
export async function startSprint(host, sprint, context) {
  const { team, goal, start, closer, selection } = sprint;
  const { model, declaration, running = null, head, trailers = [] } = context;
  const chosen = list(selection);
  const snapshot = await host.readSnapshot(head);
  const before = running ? selectionOf(running) : [];
  const added = chosen.filter((id) => !before.includes(id));
  const removed = before.filter((id) => !chosen.includes(id));
  const days = boxDays(model?.flow?.timeBox ?? null);
  const reasons = await refusals(added, chosen, team, context, snapshot);
  if (reasons.length) throw new WorkPlansError("SprintRefused", { reasons }, `The sprint is not started: ${reasons.join(" ")}`);
  const { defaultBranch } = await host.repositoryInfo();

  if (running) {
    const path = text(running.path);
    const now = await snapshot.read(path);
    const changed = appendSection(sprintSchema, now ?? "", "## Selection", { at: start, selection: chosen });
    const { commit } = await host.commitFiles({ branch: defaultBranch, expectedHead: head, files: [{ path, text: changed }],
      message: message(`Change the selection of sprint ${path.replace(/^docs\/backlog\/sprints\/|\.md$/g, "")}`, trailers) });
    return { commit, path, added, removed };
  }

  const numbers = snapshot.paths.map((path) => SPRINT_FILE.exec(path)).filter((m) => m && m[1] === team).map((m) => Number(m[2]));
  const nn = String(Math.max(0, ...numbers) + 1).padStart(2, "0");
  const path = `docs/backlog/sprints/${team}/${nn}.md`;
  const branch = sprintBranch(declaration, team, nn);
  const record = writeDocument(sprintSchema, { fields: { sprint: Number(nn), goal, start, end: days === null ? "" : plusDays(start, days - 1),
    closer, branch, selection: chosen }, body: `# ${team} Sprint ${nn}\n`, sections: [], appended: [] });
  if (branch) await host.createBranch(branch, head);
  const { commit } = await host.commitFiles({ branch: defaultBranch, expectedHead: head, files: [{ path, text: record }],
    message: message(`Start sprint ${team}/${nn}: ${goal}`, trailers) });
  return { commit, path, added: chosen, removed: [] };
}

/**
 * endSprint(host: Host, sprint: string, context: { head: string, now: Date, trailers: string[] }) -> Promise<{ commit: string }>
 * — End sprint (UC-032 6b): appends ## Ended with the day of `now` (UTC) to the record of `sprint`, `<team>/<nn>`, in one commit
 * on the default branch at `head`. A sprint with a time box — its end is its date — or one that holds its ## Ended already is
 * refused with NotEndable, one that has no record with NotFound { path }, and nothing is written. Crosses the network, through the host; fails also with the host's failures.
 */
export async function endSprint(host, sprint, context) {
  const { head, now, trailers = [] } = context;
  const path = `docs/backlog/sprints/${text(sprint)}.md`;
  const snapshot = await host.readSnapshot(head);
  const current = await snapshot.read(path);
  if (current === null || current === undefined) {
    throw new WorkPlansError("NotFound", { path }, `${path} is no sprint of this product at ${head}.`);
  }
  const record = readDocument(sprintSchema, path, current);
  if (text(record.fields.end).trim() !== "") {
    throw new WorkPlansError("NotEndable", { sprint }, `Sprint ${sprint} has a time box: it ends on ${text(record.fields.end)}.`);
  }
  if (record.appended.some((section) => section.heading === "## Ended")) {
    throw new WorkPlansError("NotEndable", { sprint }, `Sprint ${sprint} is ended already: its record holds its ## Ended.`);
  }
  const changed = appendSection(sprintSchema, current, "## Ended", { at: now.toISOString().slice(0, 10) });
  const { defaultBranch } = await host.repositoryInfo();
  const { commit } = await host.commitFiles({ branch: defaultBranch, expectedHead: head, files: [{ path, text: changed }],
    message: message(`End sprint ${sprint}`, trailers) });
  return { commit };
}

// A record's text with `heading` appended — its fields, then `lines` as its text.
function appended(record, heading, fields, lines) {
  const withHeading = appendSection(sprintSchema, record, heading, fields).replace(/\n+$/, "\n\n");
  return `${withHeading}${lines.join("\n")}\n`;
}

// The lines of a sprint's review: its increment and the items not done, from the facts; the feedback, each line with where it
// goes; who took part; for an agent, the sources of its feedback.
function reviewLines(review, facts) {
  const lines = ["The increment:"];
  const increment = facts?.increment ?? [];
  if (!increment.length) lines.push("- no item is done: the increment is empty.");
  for (const done of increment) {
    lines.push(`- ${done.item}, merged with ${done.pullRequest}; realises ${listed(list(done.realises)) || "nothing named"}; guarded by `
      + `${listed(list(done.tests)) || "no test named"}.`);
  }
  const notDone = facts?.notDone ?? [];
  if (notDone.length) {
    lines.push("", "Not done:");
    for (const state of notDone) lines.push(`- ${state.item}: ${state.state}${state.reason ? ` — ${state.reason}` : ""}.`);
  }
  const feedback = review?.feedback ?? [];
  lines.push("", "Feedback:");
  if (!feedback.length) lines.push("- none recorded.");
  for (const entry of feedback) lines.push(`- ${entry.line} — ${entry.goes}${entry.item ? `: ${entry.item}` : ""}`);
  lines.push("", `Took part: ${listed(list(review?.tookPart)) || "no one named"}.`);
  if (Array.isArray(review?.sources)) lines.push(`Sources of the feedback: ${listed(list(review.sources)) || "none"}.`);
  return lines;
}

/**
 * closeSprint(host: Host, close: { sprint: string, review: { feedback: Array<{ line: string, goes: "new item" | "change to an
 * item" | "noted", item: string | null }>, tookPart: string[], sources: string[] | null }, unfinished: Array<{ item: string,
 * to: "backlog" | "next sprint", reason: string }>, retrospective: Array<{ text: string, kind: "went well" | "did not go well"
 * | "change", goes: string | null }>, newItems: Document[] }, context: { facts, architecture: Document[], head: string,
 * trailers: string[] }) -> Promise<{ commit: string, written: string[] }> — Close sprint: appends ## Review — the increment
 * and the items not done from `facts`, the feedback, who took part, for an agent the sources of its feedback —, ## Unfinished
 * items — which items go back to the backlog and which into the team's next sprint, with the reasons — and ## Retrospective
 * to the record of `close.sprint`, `<team>/<nn>`, in one commit. Refused, with nothing written: AlreadyClosed for a record
 * that holds its ## Review; RetrospectiveMissing without a retrospective entry; Undecided { items } for an item not done
 * without a decision. New items from the feedback are not added yet: they need identifiers that no history holds
 * (MOD-identifiers' nextIdentifier, MOD-repository-hosts' readHistory), and a close with any is refused with NotSupported.
 * Crosses the network, through the host; fails also with the host's failures.
 */
export async function closeSprint(host, close, context) {
  const { facts, head, trailers = [] } = context;
  const name = text(close?.sprint);
  const path = `docs/backlog/sprints/${name}.md`;
  const snapshot = await host.readSnapshot(head);
  const now = await snapshot.read(path);
  if (now === null || now === undefined) {
    throw new WorkPlansError("NotFound", { path }, `${path} is no sprint of this product at ${head}.`);
  }
  const record = readDocument(sprintSchema, path, now);
  if (record.appended.some((section) => section.heading === "## Review")) {
    throw new WorkPlansError("AlreadyClosed", { sprint: name }, `Sprint ${name} is closed already: its record holds its review.`);
  }
  if (!(close.retrospective ?? []).length) {
    throw new WorkPlansError("RetrospectiveMissing", { sprint: name },
      `Sprint ${name} is closed only with a retrospective: write at least one entry of what went well, what did not, or what changes.`);
  }
  const decided = new Set((close.unfinished ?? []).map((entry) => entry.item));
  const undecided = (facts?.notDone ?? []).map((state) => state.item).filter((item) => !decided.has(item));
  if (undecided.length) {
    throw new WorkPlansError("Undecided", { items: undecided },
      `Decide for ${listed(undecided)} whether ${undecided.length === 1 ? "it goes" : "they go"} back to the backlog or into the next sprint.`);
  }
  if ((close.newItems ?? []).length) {
    throw new WorkPlansError("NotSupported", { what: "adding new items at a sprint's close" },
      "New items from the feedback are not added at a close yet: they need identifiers that no history holds.");
  }
  const goes = (to) => (close.unfinished ?? []).filter((entry) => entry.to === to).map((entry) => entry.item);
  let out = appended(now, "## Review", {}, reviewLines(close.review, facts));
  out = appended(out, "## Unfinished items", { "to the backlog": goes("backlog"), "into the next sprint": goes("next sprint") },
    (close.unfinished ?? []).map((entry) => `- ${entry.item}: ${entry.to === "backlog" ? "back to the backlog" : "into the next sprint"}`
      + ` — ${entry.reason}`));
  out = appended(out, "## Retrospective", {}, (close.retrospective ?? []).map((entry) => `- ${entry.kind}${entry.goes
    ? `, to ${entry.goes}` : ""}: ${entry.text}`));
  const { defaultBranch } = await host.repositoryInfo();
  const { commit } = await host.commitFiles({ branch: defaultBranch, expectedHead: head, files: [{ path, text: out }],
    message: message(`Close sprint ${name}`, trailers) });
  return { commit, written: [path] };
}

// Who gives up an increment: the Product Owner, by the role; the commit, made with the person's token, names the person.
const GIVER = "Product Owner";

/**
 * giveUpIncrement(host: Host, sprint: string, reason: string, context: { head: string, trailers: string[] }) -> Promise<{ commit:
 * string }> — Give up increment (UC-041 7b): appends ## Increment given up — `at` the day of the commit (UTC), `by` the Product
 * Owner, `reason` — to the record of `sprint`, `<team>/<nn>`, in one commit on the default branch at `head`; the sprint then holds
 * none of its items (heldItems), and its done items stay done. Refused, with nothing written: NotFound { path } for a sprint
 * with no record; NotClosed for a record without its ## Review; Merged for a sprint whose own branch has a merged pull
 * request. Crosses the network, through the host; fails also with the host's failures.
 */
export async function giveUpIncrement(host, sprint, reason, context) {
  const { head, trailers = [] } = context;
  const name = text(sprint);
  const path = `docs/backlog/sprints/${name}.md`;
  const snapshot = await host.readSnapshot(head);
  const now = await snapshot.read(path);
  if (now === null || now === undefined) {
    throw new WorkPlansError("NotFound", { path }, `${path} is no sprint of this product at ${head}.`);
  }
  const record = readDocument(sprintSchema, path, now);
  if (!record.appended.some((section) => section.heading === "## Review")) {
    throw new WorkPlansError("NotClosed", { sprint: name }, `Sprint ${name} is not closed: its increment is given up only after its review.`);
  }
  const branch = text(record.fields.branch).trim();
  if (branch) {
    const merged = (await host.listPullRequests({ state: "merged", branch }))
      .filter((pullRequest) => pullRequest?.state === "merged" && text(pullRequest.branch) === branch);
    if (merged.length) {
      throw new WorkPlansError("Merged", { sprint: name, pullRequest: merged[0].url ?? merged[0].number },
        `The increment of sprint ${name} is merged: the pull request of ${branch} is merged.`);
    }
  }
  const changed = appendSection(sprintSchema, now, "## Increment given up", { at: new Date().toISOString().slice(0, 10), by: GIVER,
    reason: text(reason).trim() });
  const { defaultBranch } = await host.repositoryInfo();
  const { commit } = await host.commitFiles({ branch: defaultBranch, expectedHead: head, files: [{ path, text: changed }],
    message: message(`Give up the increment of sprint ${name}`, trailers) });
  return { commit };
}
