// The route `backlog` — the backlog and what is done (MOD-implementation-pages, docs/architecture/MOD-implementation-pages.md; Interfaces: backlog; UC-032 steps 1, 5 and 6, UC-033): each
// team first — its last sprint that has ended, linked to its record, with its final burn-down, or that it has ended none, and whether a sprint of it runs now, which the route
// `progress` shows —, then the backlog, each item after the items it builds on, with its state and, in a product with several teams, what keeps it from a team's selection, then the
// accepted requirements and use cases no item realises yet. *Plan sprint*, for one team, lists what the team may select, and beside it every item the other teams' sprints hold, with
// its sprint and the modules it changes and uses; with the parameter `plan` naming a team — as `progress` links it — the route opens with that team's planning, and a planning opened
// or cancelled on the page is drawn from what the route has read, without reading it again. *Start sprint* commits the team's sprint through MOD-work-plans' startSprint as the
// person's own commit, on the person's click. *Propose items for uncovered requirements*, in the part of what no item realises, runs the job of the kind propose-items in this tab
// with its run panel; its drafts wait for the Product Owner with their findings from MOD-work-plans' backlogFindings, and *Add to backlog* writes the drafts kept through the kind's
// writer (writeResult). *+ Item*, below the backlog's table, is a form from the item schema saved with saveItems as the person's own input (UC-032 steps 2 to 4, 2a). Each reads
// only on its click; each write is one commit on the person's click. What the route draws is MOD-progress-measures' BacklogView of the head, stored for its commit on the
// branch overview-cache (storedView): it reads no record, no facts and no pull request; each item, sprint and job links to its own file, read only when the person opens it.
// While the head's view is not stored yet, it draws the view stored last, with the line naming its commit, and offers no Start sprint on it; only where the repository stores no
// view does it derive the same view in the page (backlogView, from the facts of the scope `work`, with the requirements of the product's SPEC, which those facts do not carry).
// Plan sprint and Cancel draw from the view read. Start sprint reads, on the click, the declaration, the declared model, the module files and the team's running sprint at the
// view's commit, and hands them with the view's states and holds to startSprint, which writes on that commit. Nothing shown is a stored status (PROGRESS AND JOB STATE ARE
// DERIVED, NOT STORED). Every part explains itself (EVERY STEP EXPLAINS ITSELF). The layout is the one of the review pages: a head, panels, list tables, buttons and badges — no
// style of its own; each table stands in a box that scrolls sideways where the page is narrower than the table. The burn-down chart is the route progress's (progress.mjs).
//
// Module: MOD-implementation-pages
//
// The route `board` reads the declaration and the declared model first (plan.mjs' modelFirst): for a model without a work-in-progress limit it says so and reads nothing else;
// with one, it reads the product's facts with the scope `work` — every pull request among them — through contextOf, which the route `implement` shares, given its facts.
// Readings the texts leave open, which this file takes: a requirement named in the SPEC is accepted — the approval statuses MOD-work-plans' itemStates reads hold the reviewed
// files only, so contextOf adds the SPEC's requirements to them; after Start sprint the route reads and draws itself again, and the frame's host serves the snapshot the commit
// made; a team's last sprint that has ended is its newest that is closed or past its end, else the one before its running sprint.

import { artifactSchemas, readDocument } from "../documents/index.mjs";
import { readSetting } from "../browser-store/index.mjs";
import { bridgeAt, settingsOf } from "../bridge-client/index.mjs";
import { kindOf } from "../job-catalogue/index.mjs";
import { newJobId } from "../job-ledger/index.mjs";
import { prepareJob, writeResult } from "../job-runner/index.mjs";
import { queueJob, runOnTab } from "../runtimes/index.mjs";
import { runPanel, schemaForm } from "../site-frame/index.mjs";
import { restrictedPlaces, sourceSchemas } from "../source-register/index.mjs";
import { backlogView, progressIn, storedView } from "../progress-measures/index.mjs";
import { parseSpec } from "../spec-document/index.mjs";
import { backlogFindings, heldItems, itemStates, planSchemas, saveItems, startSprint, startable } from "../work-plans/index.mjs";
import { eligible, participantSchema, participantsOf } from "../participant-list/index.mjs";
import { declarationSchema } from "../product-process/index.mjs";
import { declaredModelOf, modelFirst } from "./plan.mjs";
import { asOfLine, chartBlock, drawCharts, mergedAtOf, remainingOverTime, startWorkLink, workFacts } from "./progress.mjs";
import { heads } from "./routes.mjs";

const DECLARATION = "docs/process.md";
const ITEM_FILE = /^docs\/backlog\/(ITM-\d{3,})-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const SPRINT_FILE = /^docs\/backlog\/sprints\/([^/]+)\/(\d+)\.md$/;
const ASSIGNMENT_FILE = /^docs\/role-assignments\/([^/]+)\.md$/;
const MODULE_FILE = /^docs\/architecture\/MOD-[^/]+\.md$/;

// The badge of each state of UC-032 step 1, by the colours the review pages give their states.
const BADGE = { ready: "b-open", "in progress": "b-changed", done: "b-accepted", blocked: "b-stale",
  "waiting for acceptance": "b-superseded", "waiting for an item it builds on": "b-superseded", unknown: "b-stale" };

const text = (value) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
const list = (value) => (Array.isArray(value) ? value.map(text) : text(value).split(",").map((part) => part.trim()).filter(Boolean));
const today = () => new Date().toISOString().slice(0, 10);
const h = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const whatIsThis = (html) => `<details class="explain"><summary>What is this?</summary><div>${html}</div></details>`;
const idOf = (doc) => text(doc?.id ?? doc?.fields?.id) || ITEM_FILE.exec(text(doc?.path))?.[1] || "";
// The items in the order of their numbers (ITM-999 before ITM-1000).
const numberOf = (id) => Number(/\d+/.exec(id)?.[0] ?? Infinity);
const byNumber = (a, b) => numberOf(a) - numberOf(b) || (a < b ? -1 : a > b ? 1 : 0);

// ---------------------------------------------------------------- reading

// What the board and the route implement need besides the pull requests: the declaration and its model, the teams, their sprints, the items, the modules, and what is accepted. The facts
// are MOD-progress-measures' productFacts with the scope `work` (progress.mjs' workFacts), read once per page: a caller that has read them hands them in. The requirements and the
// module files, which Facts does not carry, come from the files.
export async function contextOf(context, given = null) {
  const { ref, facts } = await workFacts(context, given);
  const snapshot = facts.snapshot;
  const { declaration, assignments, sprints } = facts;
  const items = facts.plan.items.filter((doc) => ITEM_FILE.test(text(doc.path)));
  const modelFile = text(declaration?.fields?.model_file) || null;
  // The model as the instance held it at the commit the declaration's model_version names (UC-031 step 6a); where that cannot be read, none — and the page says so (modelUnread), never today's catalogue.
  const model = facts.model !== null && typeof facts.model === "object" ? facts.model : null;
  const teams = [...new Set([...assignments.map((a) => ASSIGNMENT_FILE.exec(a.path)?.[1]), ...sprints.map((s) => SPRINT_FILE.exec(s.path)?.[1])].filter(Boolean))];
  const modulePaths = snapshot.paths.filter((path) => MODULE_FILE.test(path)).sort();
  const modules = teams.length < 2 ? []
    : await Promise.all(modulePaths.map(async (path) => readDocument(artifactSchemas().module, path, (await snapshot.read(path)) ?? "")));
  const newest = new Map();
  for (const record of sprints) {
    const [, team, nn] = SPRINT_FILE.exec(record.path);
    if (!newest.has(team) || Number(nn) > Number(newest.get(team).nn)) newest.set(team, { record, nn, name: `${team}/${nn}` });
  }
  items.sort((a, b) => byNumber(idOf(a), idOf(b)));
  const requirements = [...parseSpec((await snapshot.read("SPEC.md")) ?? "").requirements.keys()];
  const reviewed = facts.statuses;
  const useCases = [...reviewed.values()].filter((entry) => entry.kind === "use-case" && entry.status === "accepted").map((entry) => entry.id);
  return { ref, snapshot, facts, declaration, modelFile, model, modelUnread: facts.modelUnread, assignments, sprints, items, modules, teams, newest, requirements, useCases, reviewed };
}

// The pull requests the page derives from, in one listing of all of them (the facts hold it): an item's hold can outlast its sprint, and an item can be done before any sprint ran. Every one
// counts, into whichever branch it was merged: the page derives from the same pull requests as MOD-work-plans.
async function pullRequestsOf(context, ctx) {
  return ctx.facts.pullRequests === "unknown" ? await context.product.host.listPullRequests() : ctx.facts.pullRequests;
}

// The approval statuses MOD-work-plans' itemStates reads: the reviewed files', and each requirement the SPEC holds as accepted.
function statusesOf(ctx) {
  const all = new Map(ctx.reviewed);
  for (const name of ctx.requirements) all.set(name, { id: name, kind: "requirement", status: "accepted" });
  return all;
}

// What the board and the route implement derive: the pull requests, each item's state, what the sprints hold, each team's newest sprint, and each team's last sprint that has
// ended — its newest where that is closed or past its end, else the one before.
export async function derivedOf(context, ctx) {
  const pull = await pullRequestsOf(context, ctx);
  const states = itemStates(ctx.items, null, { statuses: statusesOf(ctx), queues: [], jobs: [], pullRequests: pull, gates: [], workflow: null });
  const held = heldItems(ctx.sprints, ctx.items, ctx.modules, pull);
  const progressOf = (sprints) => {
    if (!ctx.model) return null;
    try {
      return progressIn({ model: ctx.model, modelSince: null, assignments: ctx.assignments, sprints, plan: { order: null, items: ctx.items, states }, pullRequests: pull }, new Date());
    } catch { return null; }
  };
  const progress = progressOf(ctx.sprints);
  const runningRecords = new Set(ctx.teams.map((team) => runningOf(ctx, { progress }, team)).filter(Boolean));
  const ended = progressOf(ctx.sprints.filter((record) => !runningRecords.has(record)));
  const lastEnded = new Map();
  for (const record of ctx.sprints.filter((each) => !runningRecords.has(each))) {
    const [, team, nn] = SPRINT_FILE.exec(record.path);
    if (!lastEnded.has(team) || Number(nn) > Number(lastEnded.get(team).nn)) lastEnded.set(team, { record, nn, name: `${team}/${nn}` });
  }
  return { pull, states, held, progress, ended, lastEnded };
}

// ---------------------------------------------------------------- the parts

const badge = (state) => `<span class="badge ${BADGE[state] ?? "b-stale"}">${h(state)}</span>`;
const fileLink = (context, ref, path, label) => `<a href="${h(`${context.product.address.replace(/\/$/, "")}${context.product.kind === "gitlab" ? "/-" : ""}/blob/${ref.split("/").map(encodeURIComponent).join("/")}/${path.split("/").map(encodeURIComponent).join("/")}`)}" target="_blank" rel="noopener">${label}</a>`;
const docOf = (ctx, id) => ctx.items.find((doc) => idOf(doc) === id) ?? null;
const stateOf = (d, id) => d.states.find((each) => each.item === id) ?? { item: id, state: "unknown", reason: null };
// The reason of a state, as the page words it.
const reasonOf = (st) => (st.state === "waiting for acceptance" ? `not accepted: ${st.reason}` : st.state === "waiting for an item it builds on" ? `waits for ${st.reason}` : st.reason);
const stateCell = (st) => `${badge(st.state)}${st.reason ? ` <span class="muted small">${h(reasonOf(st))}</span>` : ""}`;

// The view the route draws: the one stored for the head, else the one stored last with its commit (asOf), else the one derived in the page from the facts of the scope `work`
// and the requirements of the SPEC — the route `implement` draws from it too. -> { ref, snapshot, view, asOf, facts }: the snapshot of the head; the facts where the view was
// derived, else null.
export async function viewOf(context) {
  const { product } = context;
  const ref = product.ref ?? (await product.host.repositoryInfo()).defaultBranch;
  const shots = new Map([[ref, product.host.readSnapshot(ref)]]);
  const snapshot = await shots.get(ref);
  const stored = await storedView(snapshot, "backlog");
  if (stored) return { ref, snapshot, view: stored.view, asOf: stored.asOf, facts: null };
  const { facts } = await workFacts({ ...context, product: { ...product, ref } }, null, shots);
  const requirements = [...parseSpec((await facts.snapshot.read("SPEC.md")) ?? "").requirements.keys()];
  return { ref, snapshot, view: backlogView({ ...facts, requirements }, new Date()), asOf: null, facts };
}

const teamOf = (ctx, team) => ctx.view.teams.find((each) => each.team === team) ?? null;

function teamPanel(context, ctx, { team, running, lastEnded: last }) {
  const plan = (label, primary) => `<button class="btn${primary ? " primary" : ""}" data-plan="${h(team)}">${h(label)}</button>`;
  const why = whatIsThis("<p>A team plans, starts and closes sprints of its own (UC-032 step 6). While its sprint runs, the sprint holds the " +
    "items it selected until their change is in the default branch or they go back to the backlog; no other team selects an item " +
    "that changes or uses the same modules. What goes on in a running sprint stands on <a href=\"#progress\">Progress</a>. The chart of a " +
    "team's last sprint that has ended counts its selected items not done yet: at its start, after each merge of one of its items, at " +
    "the time of that merge in UTC, and at its end — derived from the sprint's record and the pull requests, never a stored status (book ch. 7 §5).</p>");
  const now = running ? `<p>Its sprint <a href="#progress"><b>${h(running.name)}</b></a> runs: what it holds and how far it is stand on Progress.</p>` : "";
  const lastLine = last ? `<p class="muted">Its last sprint, ${fileLink(context, ctx.ref, last.path, `<b>${h(last.name)}</b>`)}, ${last.end ? `ended on ${h(last.end)}` : "is closed"}.</p>`
    : `<p class="muted">${running ? "It has ended no sprint yet." : "It has run no sprint yet."}</p>`;
  const final = last?.end ? chartBlock(team, last.name, remainingOverTime(last.items, mergedAtOf(last.merges), last.start, last.end)) : "";
  return `<section class="panel" data-team="${h(team)}"><h3>${h(team)} — ${running ? "a sprint runs" : "no running sprint"}</h3>${now}${lastLine}${final}
    <p>${running ? `${plan("Change the selection", false)} ${startWorkLink(running.name)}` : plan("Plan sprint", true)}</p>${why}</section>`;
}

// What keeps an item from a team other than the one whose sprint holds it, one line per team.
function marks(row) {
  const lines = row.held ? [`held by ${h(row.held.sprint)}`] : [];
  const teams = [...new Set(row.kept.map((kept) => kept.team))];
  for (const team of teams) {
    const kept = row.kept.filter((each) => each.team === team);
    lines.push(`kept from ${h(team)}: ${kept.map((k) => `${h(k.sprint)} holds ${h(k.item)}${k.module ? ` — ${h(k.module)}` : ""}`).join("; ")}`);
  }
  return lines.join("<br>") || "—";
}

function backlogPanel(context, ctx) {
  const rows = ctx.view.rows.map((row, at) => `<tr data-item="${h(row.item)}"><td data-label="#">${h(at + 1)}</td><td data-label="Item">${fileLink(context, ctx.ref, row.path, h(row.item))}</td><td data-label="Title">${h(row.title)}</td>
      <td class="small" data-label="Realises">${row.realises.map((name) => `<code>${h(name)}</code>`).join(" ")}</td>
      <td data-label="State">${stateCell(row.state)}${markControls(row)}</td><td class="small" data-label="Held or kept">${marks(row)}</td></tr>`).join("");
  return `<section class="panel" data-part="backlog"><h3>The backlog</h3>
    <p class="muted">${h(ctx.view.rows.length)} items, each after the items it builds on.</p>
    <div class="table-scroll" tabindex="0"><table class="list"><thead><tr><th>#</th><th>Item</th><th>Title</th><th>Realises</th><th>State</th><th>Held or kept</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <div data-mark-result></div>
    <p><button type="button" class="btn" data-add-item>+ Item</button></p><div data-item-form></div>
    ${whatIsThis("<p>The backlog is everything the product is meant to do, one Markdown file per item under <code>docs/backlog/</code> " +
      "(UC-032). It keeps no order of its own: each item is listed after the items it builds on, and what is worth doing next is " +
      "decided at sprint planning. A state is never stored: it is derived from the pull requests that name the item — in their " +
      "branch or their title — and from what is accepted. In a product with several teams, an item a team's sprint holds is held " +
      "by it, and an item that changes or uses a module a held item changes or uses is kept from the other teams until that hold " +
      "ends. <em>+ Item</em> opens a form for an item you write yourself: its title, its outcome, what it realises, the modules it " +
      "changes and the items it builds on; <em>Add</em> commits it under <code>docs/backlog/</code> as your own input (UC-032 2a). A done item " +
      "whose requirement or use case is withdrawn, changed or not accepted, or whose prerequisite is not done, is marked with that reason; beside it, " +
      "<em>Point at</em> commits the item with the replacing requirement you name in place of the one withdrawn, and <em>Remove</em> commits its " +
      "removal. Nothing changes until you press one (UC-032 1a).</p>")}</section>`;
}

// A done item that carries a reason (UC-032 1a): the field for the replacing requirement, Point at and Remove. Each writes on the person's click only.
function markControls(row) {
  if (row.state.state !== "done" || !row.state.reason) return "";
  const id = h(row.item);
  return `<div class="small" data-mark-controls><input data-point-to="${id}" aria-label="Replacing requirement of ${id}" placeholder="replacing requirement">
    <button type="button" class="btn" data-point-at="${id}">Point at</button> <button type="button" class="btn" data-remove-item="${id}">Remove</button></div>`;
}

function uncoveredPanel(ctx) {
  const { requirements: reqs, useCases: ucs } = ctx.view.uncovered;
  const names = (all) => `<ul class="small">${all.map((name) => `<li><code>${h(name)}</code></li>`).join("")}</ul>`;
  const body = !reqs.length && !ucs.length ? "<p>Every accepted requirement and use case is realised by an item.</p>"
    : `${ucs.length ? `<p>${h(ucs.length)} accepted use case${ucs.length === 1 ? "" : "s"}:</p>${names(ucs)}` : ""}`
      + `${reqs.length ? `<p>${h(reqs.length)} accepted requirement${reqs.length === 1 ? "" : "s"}:</p>${names(reqs)}` : ""}`;
  const propose = !reqs.length && !ucs.length ? ""
    : `<p><button type="button" class="btn" data-propose-items>Propose items for uncovered requirements</button></p><div data-propose></div>`;
  return `<section class="panel" data-part="uncovered"><h3>Accepted, and realised by no item yet</h3>${body}${propose}
    ${whatIsThis("<p>Requirements stand in the SPEC once they are accepted; a use case is accepted when an approval record names its " +
      "current text. Each should be realised by at least one backlog item, or nobody will build it; the Product Owner adds items " +
      "for the names listed here (UC-032 steps 2–4). <em>Propose items for uncovered requirements</em> asks the participant you " +
      "choose to draft items bottom-up along the architecture; the run panel names the participant, where it processes data and " +
      "what it receives — the requirements, the use cases, the architecture and the existing items. The drafts wait for you: each " +
      "is shown with its findings, you edit or discard it, and <em>Add to backlog</em> commits the drafts you kept, one file per " +
      "item, once none of them has an error.</p>")}</section>`;
}

// The sprint of `team` that is running, or null (the board and the route implement).
export function runningOf(ctx, d, team) {
  const newest = ctx.newest.get(team) ?? null;
  return newest && !d.progress?.sprints.find((each) => each.team === team)?.final ? newest.record : null;
}

// Plan sprint for `team`: its goal, start and closer, and every item not done, each selectable or with why it is not. Start sprint is offered on the head's own view only.
function planPanel(context, ctx, team) {
  const { running, owner } = teamOf(ctx, team);
  const chosen = new Set(running?.selection ?? []);
  const rows = ctx.view.rows.map((row) => {
    if (row.state.state === "done") return "";
    const holding = row.held && row.held.team !== team ? row.held : null;
    const kept = row.kept.filter((each) => each.team === team);
    const why = holding ? `held by ${holding.sprint}` : kept.length ? kept.map((k) => `${k.sprint} holds ${k.item}${k.module ? ` — ${k.module}` : ""}`).join("; ")
      : row.state.state === "waiting for acceptance" ? reasonOf(row.state) : "";
    return `<tr data-item="${h(row.item)}"><td data-label="Select"><input type="checkbox" data-select-item="${h(row.item)}"${chosen.has(row.item) ? " checked" : ""}${why ? " disabled" : ""}></td>
      <td data-label="Item">${fileLink(context, ctx.ref, row.path, h(row.item))}</td><td data-label="Title">${h(row.title)}</td><td data-label="State">${stateCell(row.state)}</td><td class="small" data-label="Why it cannot be selected">${h(why) || "—"}</td></tr>`;
  }).join("");
  const token = context.product.tokenStored !== false;
  const own = ctx.asOf === null;
  return `<section class="panel" data-plan-team="${h(team)}"><h3>${running ? `Change the selection of ${h(running.name)}` : `Plan sprint for ${h(team)}`}</h3>
    <p><label>Goal <input data-sprint-goal value="${h(running?.goal ?? "")}"></label></p>
    <p><label>Start <input type="date" data-sprint-start value="${h(today())}"></label>
      <label>Closed by <input data-sprint-closer value="${h(running?.closer || owner)}"></label></p>
    <div class="table-scroll" tabindex="0"><table class="list"><thead><tr><th>Select</th><th>Item</th><th>Title</th><th>State</th><th>Why it cannot be selected</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
    <p>${own ? `<button class="btn primary" data-start-sprint="${h(team)}"${token ? "" : " disabled"}>Start sprint</button>` : ""}
      <button class="btn" data-cancel-plan>Cancel</button></p>
    ${!own ? `<p class="muted small">A sprint is started on the view of the newest commit, which is being stored: open the page again in a moment.</p>`
      : token ? "" : `<p class="muted small">Starting a sprint commits to the product's repository: store a token for it first (<a href="#settings">Settings</a>).</p>`}
    <div data-plan-result></div>
    ${whatIsThis("<p>The Product Owner selects the items the team works on in its sprint (UC-032 step 6). An item another team's " +
      "sprint holds, or one that changes or uses a module such an item changes or uses, cannot be selected, and its line names " +
      "why; an item is selected only together with, or after, the items it builds on. <em>Start sprint</em> commits " +
      "<code>docs/backlog/sprints/&lt;team&gt;/&lt;nn&gt;.md</code>, numbered within the team, and creates the sprint's own branch " +
      "where the declaration gives one; while the sprint runs, a new selection is added to its record.</p>")}</section>`;
}

// What the other teams' sprints hold, beside the backlog and `team`'s plan (UC-032 step 5): each item with its title, the sprint that holds it — `<team>/<nn>`, which names its team —,
// the modules it changes and the modules whose interfaces those use. Without a plan open (`team` null), what every team's sprint holds.
function heldPanel(context, ctx, team) {
  const others = ctx.view.rows.filter((row) => row.held && row.held.team !== team);
  const rows = others.map((row) => `<tr data-held="${h(row.item)}"><td data-label="Item">${fileLink(context, ctx.ref, row.path, h(row.item))}</td><td data-label="Title">${h(row.title)}</td>
      <td data-label="Sprint">${h(row.held.sprint)}</td><td class="small" data-label="Changes">${row.held.changes.map(h).join(", ") || "—"}</td><td class="small" data-label="Uses">${row.held.uses.map(h).join(", ") || "—"}</td></tr>`).join("");
  return `<section class="panel" data-part="held"><h3>What the ${team ? "other " : ""}teams' sprints hold</h3>
    ${others.length ? `<div class="table-scroll" tabindex="0"><table class="list"><thead><tr><th>Item</th><th>Title</th><th>Sprint</th><th>Changes</th><th>Uses</th></tr></thead>
      <tbody>${rows}</tbody></table></div>` : `<p class="muted">No ${team ? "other " : ""}team's sprint holds an item.</p>`}
    ${whatIsThis("<p>A sprint holds the items it selected from its start until their change is merged into the default branch or " +
      "they go back to the backlog — after its close too, while its increment waits on its own branch. While another team's " +
      "sprint holds an item, this team selects neither that item nor one that changes a module the item changes or uses, or " +
      "whose modules use a module it changes: each held item is listed with its sprint, the modules it changes and the modules " +
      "whose interfaces they use, as the modules' files under <code>docs/architecture/</code> name them (UC-032 step 5).</p>")}</section>`;
}

// What a Start sprint decision adds and removes, as startSprint's result names it (UC-032 6a): " Added: …." and " Removed: …." for each that names an item, nothing otherwise.
const changes = ({ added = [], removed = [] }) => [["Added", added], ["Removed", removed]]
  .filter(([, ids]) => ids.length).map(([label, ids]) => ` ${label}: ${ids.map((id) => h(id)).join(", ")}.`).join("");

// What Start sprint hands startSprint besides the view's states and holds, read at the view's commit on the click: the declaration, the declared model, the module files and the
// team's running sprint.
async function startInputs(context, ctx, team) {
  const snapshot = await context.product.host.readSnapshot(ctx.view.commit);
  const modulePaths = snapshot.paths.filter((path) => MODULE_FILE.test(path)).sort();
  const runningPath = teamOf(ctx, team)?.running?.path ?? null;
  await snapshot.readMany?.([DECLARATION, ...modulePaths, ...(runningPath ? [runningPath] : [])].filter((path) => snapshot.paths.includes(path)));
  const declared = await snapshot.read(DECLARATION);
  const declaration = declared === null ? null : readDocument(declarationSchema, DECLARATION, declared);
  const { model } = await declaredModelOf(context, declaration);
  const architecture = await Promise.all(modulePaths.map(async (path) => readDocument(artifactSchemas().module, path, (await snapshot.read(path)) ?? "")));
  const running = runningPath ? readDocument(planSchemas.sprint, runningPath, (await snapshot.read(runningPath)) ?? "") : null;
  return { declaration, model: model !== null && typeof model === "object" ? model : null, architecture, running };
}

// ---------------------------------------------------------------- Propose items, Add to backlog and + Item (UC-032 steps 2 to 4, 2a)

const KIND = "propose-items";
const ANY_ITEM = /(?:^|\/)(ITM-\d{3,})-[^/]*\.md$/;
const failed = (failure) => `${failure?.name ?? "Error"}: ${failure?.message ?? failure}`;
const el = (name, className, ...children) => {
  const made = document.createElement(name);
  if (className) made.className = className;
  made.append(...children);
  return made;
};
const findingLine = (found, named = (value) => value) => el("li", found.kind, `${found.kind}: ${named(found.what)} — ${named(found.fix)} [${found.rule}]`);

/** personOf(context) -> the person who starts a job: the name of the token stored for the product, else "the author". */
export function personOf(context) {
  try {
    const path = new URL(context.product.address).pathname.replace(/^\/|\/$/g, "");
    const stored = readSetting(context.store, context.product.kind === "gitlab" ? `gitlab-token:${new URL(context.product.address).host}/${path}` : `github-token:${path}`);
    return stored?.name ?? "the author";
  } catch { return "the author"; }
}

/** placesOf(instanceSnapshot, address) -> the places the restricted sources permit (JobContext.places.sources and .contents): MOD-source-register's restrictedPlaces over the instance's register for the product. */
export async function placesOf(instanceSnapshot, address) {
  const { entry } = sourceSchemas();
  const paths = instanceSnapshot.paths.filter((path) => /^docs\/sources\/[^/]+\.md$/.test(path));
  const register = await Promise.all(paths.map(async (path) => readDocument(entry, path, (await instanceSnapshot.read(path)) ?? "")));
  return restrictedPlaces(register, address);
}

/** connectionsOf(participants, store) -> { endpoints, bridges }: the endpoints and Bridges the participants' routes name, as this browser keeps them. */
export function connectionsOf(participants, store) {
  const endpoints = {}, bridges = {};
  const connect = (name) => {
    const stored = !name || bridges[name] ? null : readSetting(store, `bridge:${name}`);
    if (stored) bridges[name] = bridgeAt(settingsOf({ name, ...stored }, readSetting(store, "jump-host")));
  };
  for (const participant of participants) {
    const name = /^endpoint\s+(\S+)/.exec(participant.route ?? "")?.[1];
    const stored = name === undefined ? null : readSetting(store, `endpoint:${name}`);
    if (stored) {
      endpoints[name] = { config: { name, kind: stored.kind, baseUrl: stored.url, model: stored.model, key: stored.key ?? null }, bridge: stored.bridge ?? null };
      connect(stored.bridge);
    }
    connect(/^bridge\s+(\S+)\s+agent\s+\S+/.exec(participant.route ?? "")?.[1]);
  }
  return { endpoints, bridges };
}

// The product's default branch read now, with its module files and its backlog's items as documents.
async function headOf(host) {
  const head = await host.readSnapshot((await host.repositoryInfo()).defaultBranch);
  const schemas = artifactSchemas();
  const read = (pattern, schema) => Promise.all(head.paths.filter((path) => pattern.test(path)).sort().map(async (path) => readDocument(schema, path, (await head.read(path)) ?? "")));
  const highest = Math.max(0, ...head.paths.map((path) => Number(ANY_ITEM.exec(path)?.[1].slice(4) ?? 0)));
  return { head, architecture: await read(MODULE_FILE, schemas.module), items: await read(ITEM_FILE, schemas.item), highest };
}

// A drafted item as the person has left it: the answer's entry with the edits typed.
const LIST_FIELDS = ["realises", "modules", "buildsOn"];
const listOf = (typed) => String(typed ?? "").split(",").map((part) => part.trim()).filter(Boolean);

// The findings of the drafts kept, from backlogFindings over the backlog's items and the drafts, each draft under an identifier after the backlog's highest; an entry of buildsOn that is the
// title of an existing item or of a draft names that item. Each finding names a draft by its title. -> Map(draft -> Finding[])
function draftFindings(kept, { items, architecture, highest }) {
  const drafted = kept.map((entry, at) => ({ entry, id: `ITM-${String(highest + at + 1).padStart(3, "0")}` }));
  const idOfTitle = new Map([...drafted.map(({ entry, id }) => [entry.title, id]), ...items.map((one) => [text(one.fields.title), one.id])]);
  const titleOf = new Map(drafted.map(({ entry, id }) => [id, entry.title]));
  const documents = drafted.map(({ entry, id }) => ({ kind: "item", id, path: `docs/backlog/${id}-draft.md`, title: entry.title, sections: [], appended: [], body: "",
    fields: { id, title: entry.title, realises: entry.realises, modules: entry.modules, builds_on: entry.buildsOn.map((name) => idOfTitle.get(name) ?? name) } }));
  const found = backlogFindings([...items, ...documents], architecture);
  const named = (value) => String(value).replace(/ITM-\d{3,}/g, (id) => (titleOf.has(id) ? `the draft "${titleOf.get(id)}"` : id));
  return { named, of: new Map(drafted.map(({ entry, id }) => [entry, found.filter((one) => one.artifact === id)])) };
}

// The drafts of a job of propose-items, waiting for the Product Owner: each with its fields to edit, Discard, and its findings; Add to backlog, offered while a draft is kept and none kept has an
// error, writes the drafts kept through the kind's writer (writeResult) on the default branch read at the click.
function draftsPanel(place, context, { outcome, prepared, jobContext, read }) {
  const answer = Array.isArray(outcome.draft?.items) ? outcome.draft.items : null;
  if (answer === null) { place.replaceChildren(el("p", "warn", "The participant's answer could not be read as drafted items. Nothing was written.")); return; }
  const entries = answer.map((each) => ({ ...each, title: text(each.title), outcome: text(each.outcome), realises: list(each.realises), modules: list(each.modules), buildsOn: list(each.buildsOn),
    acceptance: Array.isArray(each.acceptance) ? each.acceptance.map(text) : [], discarded: false }));
  const add = el("button", "btn primary", "Add to backlog");
  add.setAttribute("type", "button");
  const result = el("div", "drafts-result");
  const boxes = entries.map((entry, at) => {
    const findings = el("ul", "findings");
    const field = (label, key, multi) => {
      const input = el(multi ? "textarea" : "input");
      input.setAttribute("data-draft-field", key);
      input.value = key === "acceptance" ? entry.acceptance.join("\n") : LIST_FIELDS.includes(key) ? entry[key].join(", ") : entry[key];
      input.addEventListener("input", () => {
        entry[key] = key === "acceptance" ? String(input.value ?? "").split("\n").map((line) => line.trim()).filter(Boolean) : LIST_FIELDS.includes(key) ? listOf(input.value) : String(input.value ?? "").trim();
        show();
      });
      return el("p", null, el("label", null, `${label} `, input));
    };
    const discard = el("input");
    discard.setAttribute("type", "checkbox");
    discard.setAttribute("data-draft-discard", "");
    discard.addEventListener("change", () => { entry.discarded = discard.checked === true; show(); });
    const box = el("section", "panel draft", el("h4", null, `Draft ${at + 1}`), field("Title", "title"), field("Outcome", "outcome", true), field("Realises", "realises"), field("Modules", "modules"),
      field("Builds on", "buildsOn"), field("Acceptance, one criterion a line", "acceptance", true), el("p", null, el("label", null, discard, " Discard")), findings);
    box.setAttribute("data-draft", String(at));
    return { entry, box, findings };
  });
  function show() {
    const kept = entries.filter((entry) => !entry.discarded);
    const { named, of } = draftFindings(kept, read);
    for (const { entry, findings } of boxes) findings.replaceChildren(...(of.get(entry) ?? []).map((one) => findingLine(one, named)));
    add.disabled = kept.length === 0 || [...of.values()].flat().some((one) => one.kind === "error");
  }
  add.addEventListener("click", async (event) => {
    if (event?.isTrusted !== true || add.disabled) return;
    add.disabled = true;
    result.replaceChildren();
    try {
      const { head } = await headOf(context.product.host);
      const items = entries.filter((entry) => !entry.discarded).map(({ discarded: _, ...entry }) => entry);
      const written = await writeResult(prepared, { items }, { result: outcome, context: { ...jobContext, product: { ...jobContext.product, snapshot: head } } });
      result.replaceChildren(el("p", "drafts-added", `Added to the backlog, commit ${text(written.commits?.[0]).slice(0, 7)}: ${(written.files ?? []).join(", ")}`),
        ...(written.notes?.length ? [el("ul", "notes", ...written.notes.map((note) => el("li", null, note)))] : []));
    } catch (failure) {
      result.replaceChildren(el("p", "warn", `The drafts are not added: ${failed(failure)}`),
        ...(failure?.findings?.length ? [el("ul", "findings", ...failure.findings.map((one) => findingLine(one)))] : []));
      show();
    }
  });
  place.replaceChildren(el("p", "muted", `Drafted by ${prepared.drafter.name}; correction rounds: ${outcome.rounds?.length ?? 0}. Edit or discard each draft; nothing is written before Add to backlog.`),
    ...boxes.map(({ box }) => box), el("p", null, add), result);
  show();
}

/**
 * attendedJob(place, context, job) — a job of the kind `job.kind` that a person starts on a page and waits for (UC-032 step 2, UC-045 step 2): the participants of the instance's register that have
 * what the kind needs, each with where it processes data, in a select marked with the attribute `job.choice`; the run panel of the one chosen; Run, the person's click, commits the job's start
 * record and runs the job in this tab, attended, and hands its result to `job.drafted(drafts, { outcome, prepared, jobContext, read })`, where it waits for the person. `job.read()` reads the
 * product's default branch once the participants are known -> { head: Snapshot, ... }, handed on as `read`; `job.worksOn` names what the job works on; `job.none`, `job.drafting` and
 * `job.notDrafted` are the page's words for no participant, the job running, and a job that failed.
 */
export async function attendedJob(place, context, { kind, choice, read: readHead, worksOn, none, drafting, notDrafted, drafted }) {
  place.replaceChildren(el("p", "muted", "Reading the participants…"));
  const { product, instance } = context;
  const definition = await kindOf(kind);
  const instanceSnapshot = await instance.host.readSnapshot((await instance.host.repositoryInfo()).defaultBranch);
  const participants = await participantsIn(context, instanceSnapshot);
  const offered = eligible(participants, { capabilities: definition.needs }).eligible;
  if (offered.length === 0) {
    place.replaceChildren(el("p", "warn", none));
    return;
  }
  const read = await readHead();
  const { head } = read;
  const address = head.repository?.web ?? product.address;
  const places = { ...(await placesOf(instanceSnapshot, address)), mailbox: null };
  const agentM = { version: instanceSnapshot.commit ?? "unknown", commit: instanceSnapshot.commit ?? "unknown" };
  const person = personOf(context);
  const choose = el("select");
  choose.setAttribute(choice, "");
  for (const participant of offered) {
    const option = el("option", null, `${participant.name} — processes data at ${participant.place ?? "no declared place"}`);
    option.setAttribute("value", participant.name);
    choose.append(option);
  }
  const stage = el("div", "propose-stage");
  async function drawPanel() {
    const chosen = offered.find((participant) => participant.name === choose.value) ?? offered[0];
    const now = new Date();
    const id = newJobId(now, new Set(head.paths.map((path) => /^docs\/jobs\/(JOB-[^/]+)\.md$/.exec(path)?.[1]).filter(Boolean)));
    const jobContext = { kind: definition, params: {}, product: { address, snapshot: head, host: product.host }, instance: { snapshot: instanceSnapshot, host: instance.host, checkout: null },
      connect: async () => product.host, participants, places, gates: [], person, now, agentM, jobId: id };
    const prepared = await prepareJob(kind, jobContext, { drafter: chosen, reviewers: [] });
    const drafts = el("div", "drafts");
    stage.replaceChildren(runPanel(prepared, { onRun: async () => {
      drafts.replaceChildren(el("p", "muted", drafting));
      try {
        const record = { id, kind, worksOn, participant: chosen.name, model: chosen.model, route: "tab", run: null, retries: null, startedBy: person, start: now, agentM,
          inputs: prepared.parts.map((part) => part.name), limit: prepared.limit, destinations: prepared.destinations.map((each) => ({ participant: each.participant.name, place: each.place, parts: each.parts })), params: {} };
        const { path } = await queueJob(product.host, record, { kind: "tab" }, head.commit);
        const outcome = await runOnTab(prepared, jobContext, connectionsOf([chosen], context.store), { host: product.host, record: { ...record, path } });
        drafted(drafts, { outcome, prepared, jobContext, read });
      } catch (failure) {
        drafts.replaceChildren(el("p", "warn", `${notDrafted}: ${failed(failure)}`));
      }
    } }), drafts);
  }
  choose.addEventListener("change", () => drawPanel().catch((failure) => stage.replaceChildren(el("p", "warn", failed(failure)))));
  place.replaceChildren(el("p", null, el("label", null, "Participant ", choose)), stage);
  await drawPanel();
}

// Propose items for uncovered requirements (UC-032 steps 2 and 3): the job of the kind propose-items (attendedJob), its drafts waiting for the Product Owner.
async function proposeItems(place, context, ctx) {
  await attendedJob(place, context, { kind: KIND, choice: "data-propose-participant", read: () => headOf(context.product.host),
    worksOn: [...ctx.view.uncovered.requirements, ...ctx.view.uncovered.useCases],
    none: "No participant of the instance's register can draft text, so no items can be proposed. Declare one on the page Participants.",
    drafting: "The participant drafts the items…", notDrafted: "No items were proposed",
    drafted: (drafts, result) => draftsPanel(drafts, context, result) });
}

// + Item (UC-032 2a): a form from the item schema over the default branch read at the click, with a provisional identifier that is never written — saveItems gives the item the next one no
// history holds —, the findings of backlogFindings beside it, the drafted item checked beside the backlog's items; its one button, Add, commits the item with saveItems as the person's own input.
async function itemForm(place, context) {
  const { host } = context.product;
  const { head, architecture, items, highest } = await headOf(host);
  const schema = artifactSchemas().item;
  const provisional = `ITM-${String(highest + 1).padStart(3, "0")}`;
  const opened = readDocument(schema, `docs/backlog/${provisional}-item.md`, `---\nid: ${provisional}\n---\n# ${provisional} \n\n## Outcome\n\n## Acceptance\n\n`);
  const result = el("div", "item-result");
  const form = schemaForm(schema, opened, {
    onSave: async (live) => {
      result.replaceChildren();
      try {
        const { id: _, ...fields } = live.fields;
        const saved = await saveItems(host, { items: [{ fields, sections: live.sections.map(({ heading, text: body }) => ({ heading, text: body })) }], removed: [] },
          { architecture, head: head.commit, trailers: [] });
        result.replaceChildren(el("p", "item-added", `Added ${saved.written.map((path) => ANY_ITEM.exec(path)?.[1] ?? path).join(", ")} to the backlog, commit ${text(saved.commit).slice(0, 7)}.`));
      } catch (failure) {
        result.replaceChildren(el("p", "warn", `The item is not added: ${failed(failure)}`), ...(failure?.findings?.length ? [el("ul", "findings", ...failure.findings.map((one) => findingLine(one)))] : []));
      }
    },
    extraChecks: (live) => backlogFindings([...items, live], architecture).filter((one) => one.artifact === (live.id || live.path)),
  });
  // The form's one button is its Save; here it is the person's Add.
  const add = form.children[form.children.length - 1].getElementsByTagName("button")[0];
  if (add) add.textContent = "Add";
  place.replaceChildren(form, result);
}

// Point at and Remove on a marked row (UC-032 1a): one commit through saveItems on the default branch read at the click. Point at replaces the names among the item's `realises` that
// its row's reason names — the reason of a done item opens with the requirement or use case it is about, "<name> is …" — with the replacing requirement the person typed, and keeps the others.
async function decideMark(target, context, id, reason, point) {
  const out = target.querySelector("[data-mark-result]");
  const replacing = point ? text(target.querySelector(`[data-point-to="${id}"]`)?.value).trim() : "";
  if (point && !replacing) { out.innerHTML = `<p class="warn">Name the replacing requirement of ${h(id)}.</p>`; return; }
  out.innerHTML = `<p class="muted">Writing…</p>`;
  try {
    const { head, architecture, items } = await headOf(context.product.host);
    let change = { items: [], removed: [id] };
    if (point) {
      const doc = items.find((one) => idOf(one) === id);
      if (!doc) throw new Error(`${id} is no item of the backlog at ${head.commit}`);
      const withdrawn = (name) => reason.split("; ").some((part) => part.startsWith(`${name} is `));
      const realises = [...new Set([...list(doc.fields.realises).filter((name) => !withdrawn(name)), replacing])];
      change = { items: [{ fields: { ...doc.fields, realises }, sections: doc.sections.map(({ heading, text: body }) => ({ heading, text: body })) }], removed: [] };
    }
    const saved = await saveItems(context.product.host, change, { architecture, head: head.commit, trailers: [] });
    await draw(target, context);
    target.insertAdjacentHTML?.("afterbegin", `<section class="panel notice flash"><p>${point ? `${h(id)} now realises ${h(replacing)}` : `${h(id)} is removed from the backlog`} — commit ${h(text(saved.commit).slice(0, 7))}.</p></section>`);
  } catch (failure) {
    out.innerHTML = `<p class="warn">${h(id)} is not changed: ${h(failed(failure))}</p>${failure?.findings?.length ? `<ul class="small">${failure.findings.map((one) => `<li>${h(one.what)}</li>`).join("")}</ul>` : ""}`;
  }
}

// ---------------------------------------------------------------- the route

// The page read now, with the planning of `team` open (or none).
async function draw(target, context, team = null) {
  await paint(target, context, await viewOf(context), team);
}

// The page drawn from what was read: a planning opened or cancelled draws it again from `ctx`, without reading anything. For a model that plans its work in advance there is no
// backlog: the page says so, links the implementation plan and draws nothing else (UC-032 1b).
async function paint(target, context, ctx, team) {
  const { view } = ctx;
  const { model } = view;
  const unread = view.modelUnread ? `<p class="warn">The model version <code>${h(view.modelUnread.commit)}</code> the declaration names cannot be read from the instance (${h(view.modelUnread.error)}), so no process model is shown.</p>` : "";
  const noModel = unread || (!view.declared ? `<p class="warn">This product declares no process model yet: <code>docs/process.md</code> names it (UC-002).</p>`
    : !model ? `<p class="warn">The declaration names the model file <code>${h(view.modelFile ?? "—")}</code>, which the catalogue does not hold.</p>` : "");
  const planned = model?.kind === "planned" ? `<p class="warn">This product's model plans its work in advance: there is no backlog (UC-032 1b) — its work follows the <a href="#plan">implementation plan</a> (UC-045).</p>` : "";
  const sprints = model?.sprints === true;
  const teams = view.teams.map((each) => each.team);
  const planning = sprints && teams.includes(team) ? team : null;
  const teamsPart = sprints
    ? (teams.length ? view.teams.map((each) => teamPanel(context, ctx, each)).join("")
      : `<section class="panel" data-part="teams"><h3>No team yet</h3><p class="muted">The product's model works in sprints, and no role assignment names a team yet (UC-048).</p>
        ${whatIsThis("<p>Each team of a product has a role assignment under <code>docs/role-assignments/</code>, and plans and runs sprints of its own.</p>")}</section>`)
    : model ? `<section class="panel" data-part="flow"><h3>Work in progress</h3>
        <p>${h(view.rows.filter((each) => each.state.state === "in progress").length)} item(s) in progress${model.wip ? ` of a limit of ${h(model.wip)}` : ""}.</p>
        ${whatIsThis("<p>The model works without sprints: a ready item is pulled while fewer items are in progress than the work-in-progress limit allows (book ch. 7 §4; UC-032 step 7).</p>")}</section>` : "";
  target.innerHTML = `
    <section class="head"><h2>Backlog</h2>
      <p class="muted">${h(context.product.address)} · <code>${h(ctx.ref)}</code> · derived from the repository and its pull requests; nothing here is a stored status.${sprints ? ` What goes on now stands on <a href="#progress">Progress</a>.` : ""}</p>
      ${ctx.asOf ? asOfLine(ctx.asOf) : ""}
      ${noModel}${planned}
      ${whatIsThis("<p>First what is accepted but realised by no item yet; then each team: its last sprint that has ended and its final burn-down; " +
        "then the backlog with the state of each item. Everything is derived from the repository and its pull requests, for the commit shown.</p>")}</section>
    ${planned ? "" : `${uncoveredPanel(ctx)}
    ${teamsPart}
    ${planning ? planPanel(context, ctx, planning) : ""}
    ${sprints && teams.length > 1 ? heldPanel(context, ctx, planning) : ""}
    ${backlogPanel(context, ctx)}`}`;
  await drawCharts(target);

  // Propose items and + Item read only on the person's click (UC-032 steps 2 to 4, 2a).
  const onClick = (control, where, open) => target.querySelector(control)?.addEventListener("click", (event) => {
    if (event?.isTrusted !== true) return;
    const place = target.querySelector(where);
    open(place).catch((failure) => place.replaceChildren(el("p", "warn", failed(failure))));
  });
  onClick("[data-propose-items]", "[data-propose]", (place) => proposeItems(place, context, ctx));
  onClick("[data-add-item]", "[data-item-form]", (place) => itemForm(place, context));
  for (const [selector, attribute, point] of [["[data-point-at]", "data-point-at", true], ["[data-remove-item]", "data-remove-item", false]]) {
    target.querySelectorAll(selector).forEach((button) => button.addEventListener("click", (event) => {
      if (event?.isTrusted !== true) return;
      const id = button.getAttribute(attribute);
      return decideMark(target, context, id, text(view.rows.find((each) => each.item === id)?.state.reason), point);
    }));
  }

  // Each control is looked up by its own selector — a team's Plan button by its team, an item's tick by its item.
  const again = (next) => paint(target, context, ctx, next).catch((failure) => { target.innerHTML = `<p class="warn">${h(failure?.message ?? failure)}</p>`; });
  for (const name of teams) {
    target.querySelectorAll(`[data-plan="${name}"]`).forEach((button) => button.addEventListener("click", () => again(name)));
  }
  target.querySelectorAll("[data-cancel-plan]").forEach((button) => button.addEventListener("click", () => again(null)));
  target.querySelectorAll("[data-start-sprint]").forEach((button) => button.addEventListener("click", async (event) => {
    if (event?.isTrusted === false) return;
    const out = target.querySelector("[data-plan-result]");
    const value = (selector) => text(target.querySelector(selector)?.value).trim();
    const selection = view.rows.map((row) => row.item).filter((id) => {
      const tick = target.querySelector(`[data-select-item="${id}"]`);
      return tick && tick.checked && !tick.disabled;
    });
    const goal = value("[data-sprint-goal]"), closer = value("[data-sprint-closer]"), start = value("[data-sprint-start]") || today();
    if (!goal || !closer || !selection.length) {
      out.innerHTML = `<p class="warn">Name the sprint's goal and who closes it, and select at least one item.</p>`;
      return;
    }
    const chosenTeam = button.dataset?.startSprint ?? button.getAttribute("data-start-sprint");
    out.innerHTML = `<p class="muted">Starting the sprint…</p>`;
    try {
      const { declaration, model: declared, architecture, running } = await startInputs(context, ctx, chosenTeam);
      const result = await startSprint(context.product.host, { team: chosenTeam, goal, start, closer, selection },
        { states: view.rows.map((row) => row.state), model: declared, declaration, held: view.rows.map((row) => row.held).filter(Boolean), architecture, running,
          head: view.commit, trailers: [] });
      await draw(target, context);
      target.insertAdjacentHTML?.("afterbegin", `<section class="panel notice flash"><p>${running ? "The selection of" : "Sprint"} <code>${h(result.path)}</code> ${running ? "is changed" : "is started"} — commit ${h(result.commit.slice(0, 7))}.${changes(result)}</p></section>`);
    } catch (failure) {
      out.innerHTML = failure?.name === "SprintRefused"
        ? `<p class="warn">The sprint is not started:</p><ul class="small">${(failure.reasons ?? []).map((reason) => `<li>${h(reason)}</li>`).join("")}</ul>`
        : `<p class="warn">${h(failure?.message ?? failure)}</p>`;
    }
  }));
}

export const route = {
  ...heads.backlog,

  async render(target, context, params = {}) {
    await draw(target, context, params?.plan ?? null);
  },
};

// ---------------------------------------------------------------- the board (UC-032 steps 7 and 7a)

const REGISTER = "docs/participants.md";

/** participantsIn(context, snapshot?) -> the participants of the instance's register, read from its default branch, or from `snapshot` of it where the caller has read one. */
export async function participantsIn(context, given = null) {
  const { instance } = context;
  const snapshot = given ?? await instance.host.readSnapshot((await instance.host.repositoryInfo()).defaultBranch);
  const register = await snapshot.read(REGISTER);
  return register === null ? [] : participantsOf(readDocument(participantSchema(), REGISTER, register));
}

// The role assignment of an item: its team's — the team whose newest running sprint selects it —, else the product's first.
export function assignmentOf(ctx, d, id) {
  for (const team of ctx.teams) {
    const running = runningOf(ctx, d, team);
    if (running && list(running.appended?.filter((section) => section.heading === "## Selection").at(-1)?.fields?.selection ?? running.fields.selection).includes(id)) {
      return { assignment: ctx.assignments.find((each) => ASSIGNMENT_FILE.exec(each.path)?.[1] === team) ?? null, sprint: running, team };
    }
  }
  const first = ctx.assignments[0] ?? null;
  const team = first ? ASSIGNMENT_FILE.exec(first.path)?.[1] : null;
  return { assignment: first, sprint: team ? runningOf(ctx, d, team) : null, team };
}


// The column of an item by its derived state: Done; in progress with a pull request open, Review; in progress otherwise, Doing; any other state, Backlog.
const columnOf = (state) => (state.state === "done" ? "Done" : state.state === "in progress" ? (state.pullRequest ? "Review" : "Doing") : "Backlog");
const COLUMNS = ["Backlog", "Doing", "Review", "Done"];

// The board for a model with a work-in-progress limit: the columns with each item in the column of its derived state; the limit, per team in a model with sprints, naming the items in progress and those that
// wait for review; Pull on a ready item — a link to the route implement with the item selected — only where `startable` lets it start, else disabled with the reasons it gives.
async function drawBoard(target, context) {
  const head = (body) => { target.innerHTML = `<section class="head"><h2>Board</h2>${whatIsThis("<p>The board shows each item in the column of its derived state. A ready item is pulled only while fewer items are in progress than the work-in-progress limit allows; items in review count as in progress (book ch. 7 §4; UC-032 step 7).</p>")}${body}</section>`; };
  const first = await modelFirst(context);
  const firstModel = first.model !== null && typeof first.model === "object" ? first.model : null;
  if (!first.declaration || !firstModel) { head(`<p class="warn">This product declares no process model yet, or it cannot be read: <code>docs/process.md</code> names it (UC-002).</p>`); return; }
  if (!firstModel.flow?.wip) { head(`<p>This model has no work-in-progress limit, so there is no board: see <a href="#backlog">the backlog</a>.</p>`); return; }
  const ctx = await contextOf({ ...context, product: { ...context.product, ref: first.ref } });
  const d = await derivedOf(context, ctx);
  const wip = ctx.model?.flow?.wip;
  if (!ctx.declaration || !ctx.model || !wip) { head(`<p class="warn">This product declares no process model yet: <code>docs/process.md</code> names it (UC-002).</p>`); return; }
  const participants = await participantsIn(context);
  const workflow = ctx.facts.workflow !== "unknown" ? ctx.facts.workflow : null;
  const ids = ctx.items.map(idOf);
  const verdicts = new Map(ids.map((id) => {
    const { assignment, sprint } = assignmentOf(ctx, d, id);
    return [id, startable(id, d.states, { workflow, assignment, sprint, held: d.held, wip, participants })];
  }));
  const stateOf_ = (id) => d.states.find((each) => each.item === id) ?? { item: id, state: "unknown" };
  const item = (id) => {
    const state = stateOf_(id), verdict = verdicts.get(id);
    const pull = state.state !== "ready" ? "" : verdict.startable ? `<a data-pull="${h(id)}" href="#implement/item=${encodeURIComponent(id)}">Pull</a>`
      : `<button type="button" class="btn" data-pull="${h(id)}" disabled>Pull</button><ul data-reasons>${verdict.reasons.map((reason) => `<li>${h(reason)}</li>`).join("")}</ul>`;
    return `<li data-item="${h(id)}">${h(id)} ${badge(state.state)} ${pull}</li>`;
  };
  const columns = COLUMNS.map((name) => `<section class="panel" data-column="${name}"><h3>${name}</h3><ul>${ids.filter((id) => columnOf(stateOf_(id)) === name).map(item).join("")}</ul></section>`).join("");
  const teams = ctx.model.flow.sprints === true && ctx.teams.length ? ctx.teams : [null];
  const panels = teams.map((team) => {
    const under = team ? new Set(d.held.filter((entry) => entry.team === team).map((entry) => entry.item)) : null;
    const busy = d.states.filter((each) => each.state === "in progress" && (!under || under.has(each.item)));
    const reviewing = busy.filter((each) => each.pullRequest).map((each) => each.item);
    return `<section class="panel" data-wip${team ? ` data-team="${h(team)}"` : ""}><p>${h(busy.length)} of ${h(wip)} items in progress${team ? ` under ${h(team)}` : ""}${busy.length ? `: ${busy.map((each) => h(each.item)).join(", ")}` : ""}.${reviewing.length ? ` Waiting for review: ${reviewing.map(h).join(", ")}.` : ""}${busy.length >= wip ? " No further item is pulled until one of them is merged." : ""}</p></section>`;
  }).join("");
  head(`${panels}${columns}`);
}

export const boardRoute = {
  ...heads.board,

  async render(target, context) {
    try {
      await drawBoard(target, context);
    } catch (failure) {
      target.innerHTML = `<section class="panel"><h2>Board</h2><p class="warn">${h(failure?.message ?? failure)}</p></section>`;
    }
  },
};
