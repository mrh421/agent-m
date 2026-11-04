// The route `progress` — what goes on now (MOD-implementation-pages, docs/architecture/MOD-implementation-pages.md; Interfaces: progress; UC-035): in a model with sprints, each
// team's running sprint with its goal, start, end, branch and closer, its items with their states and the modules they change and use, and its burn-down; *End sprint* for a running
// sprint without a time box, the one write of this route, on the person's click; for one that has ended, that its review and retrospective are not recorded yet; a team without a running sprint says so, and links its
// planning and the backlog; then the workflow's gates, what is blocked among the items the running sprints hold, and who works on what, each current job linked to its page on the
// job dashboard. For a model without sprints it draws the model's measure from progressIn of the view: a planned model's grid of requirements by phases with the timeline and the steps of the plan, or the board's cards
// with the cumulative flow; each cell, card and chart leads to the trace page of what is behind it (UC-035 step 6); a model for which progressIn gives neither grid, sprints nor flow keeps its link to the backlog. What it draws is MOD-progress-measures'
// ProgressView of the head, stored for its commit on the branch overview-cache (storedView): the route reads no record, no facts and no pull request, and names no first wave;
// while the head's view is not stored yet, it draws the view stored last, with the line naming its commit, and only where the repository stores no view does it derive the same
// view in the page (progressView, from the facts of the scope `work`) — nothing it shows is a stored status (PROGRESS AND JOB STATE ARE DERIVED, NOT STORED). Every part explains
// itself (EVERY STEP EXPLAINS ITSELF). The layout is the one of the review pages, as the backlog's. The burn-down chart stands here, and the backlog draws a team's final burn-down
// with it.
//
// Module: MOD-implementation-pages
//
// Readings the texts leave open, which this file takes: a running sprint whose time box is over, or that the Product Owner ended, and whose close is not recorded yet has ended: its
// panel says so and draws no chart (the route draws no final burn-down); a job's page on the job dashboard is MOD-main-page's route `job` on the main page, which the
// review pages reach at ../index.html; a running sprint's burn-down is drawn from the sprint's start and the merges of its done items, as the view holds them, one point for each day from its start to today in UTC, each the items left at that day's end; End sprint is offered on the
// head's own view only; what is behind a cell of the grid is its requirement, behind a card the requirements and use cases its item realises, behind a point those of the items
// merged — a chart's points are reached by one link under it, so behind it stand the items the chart counts as merged: the board's done items, or the sprint's merged items in
// the order of their merges —, and a card or point with several leads to the first of them; the trace page of a requirement is the route `trace` of the specification at the
// branch shown, narrowed to it by the part `text`, and the page of a use case the review pages' `use-case`, as the trace page links a use case; an item's file is read only on
// the click, from the snapshot the page has read, and the click goes there through the frame (`go`); where nothing is found behind it, or the item cannot be read, it leads to the
// specification at the branch shown; where the view is derived in the page, the requirements are those of the product's SPEC, which the facts of the scope `work` do not carry.

import { artifactSchemas, readDocument } from "../documents/index.mjs";
import { renderArtifact, renderMermaid } from "../markdown-render/index.mjs";
import { productFacts, progressView, storedView } from "../progress-measures/index.mjs";
import { parseSpec } from "../spec-document/index.mjs";
import { endSprint } from "../work-plans/index.mjs";
import { heads } from "./routes.mjs";


const BADGE = { ready: "b-open", "in progress": "b-changed", done: "b-accepted", blocked: "b-stale",
  "waiting for acceptance": "b-superseded", "waiting for an item it builds on": "b-superseded", unknown: "b-stale",
  passed: "b-accepted", "passed on an earlier text": "b-changed", rejected: "b-stale", pending: "b-open", "not reached": "b-superseded" };

const text = (value) => (typeof value === "string" ? value : value === null || value === undefined ? "" : String(value));
const h = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const whatIsThis = (html) => `<details class="explain"><summary>What is this?</summary><div>${html}</div></details>`;
const badge = (state) => `<span class="badge ${BADGE[state] ?? "b-stale"}">${h(state)}</span>`;
const reasonOf = (st) => (st.state === "waiting for acceptance" ? `not accepted: ${st.reason}` : st.state === "waiting for an item it builds on" ? `waits for ${st.reason}` : st.reason);
const stateCell = (st) => `${badge(st.state)}${st.reason ? ` <span class="muted small">${h(reasonOf(st))}</span>` : ""}`;
const fileLink = (context, ref, path, label) => `<a href="${h(`${context.product.address.replace(/\/$/, "")}${context.product.kind === "gitlab" ? "/-" : ""}/blob/${ref.split("/").map(encodeURIComponent).join("/")}/${path.split("/").map(encodeURIComponent).join("/")}`)}" target="_blank" rel="noopener">${label}</a>`;
const planLink = (team, label) => `<a class="btn" href="#backlog/plan=${encodeURIComponent(team)}">${h(label)}</a>`;
// Start sprint work (UC-034 step 1): the route implement for a running sprint, named `<team>/<nn>`; the frame splits an address at every slash before it decodes, so the slash of the name is encoded.
export const startWorkLink = (sprintName) => `<a class="btn" href="#implement/sprint=${encodeURIComponent(sprintName)}">Start sprint work</a>`;

// ---------------------------------------------------------------- the burn-down chart

// When each done item was first merged, as a view holds it ({ item, at }), by item.
export const mergedAtOf = (merges) => new Map((merges ?? []).map((merge) => [merge.item, merge.at]));

// The items a closed sprint had left over time — its final burn-down: at its start, after each merge of one of its items, in time order, and at its end, the last day of its burn-down, after which no merge counts. An
// item merged before the sprint's start is done from the start. A merge is labelled with its time, HH:MM in UTC, or MM-DD HH:MM once a merge falls on another day than the start.
export function remainingOverTime(items, mergedAt, start, end) {
  const merges = items.map((id) => mergedAt.get(id)).filter(Boolean).sort();
  const before = merges.filter((at) => at.slice(0, 10) < start).length;
  const during = merges.filter((at) => at.slice(0, 10) >= start && at.slice(0, 10) <= end);
  const oneDay = during.every((at) => at.slice(0, 10) === start);
  const label = (at) => (oneDay ? at.slice(11, 16) : `${at.slice(5, 10)} ${at.slice(11, 16)}`);
  let remaining = items.length - before;
  const points = [{ label: "start", remaining }];
  for (const at of during) points.push({ label: label(at), remaining: --remaining });
  points.push({ label: "end", remaining });
  return points;
}

// The items a running sprint has left at the end of each day, in UTC, from its start to today, each labelled MM-DD. An item merged before the sprint's start is done from the start.
export function remainingPerDay(items, mergedAt, start, today = new Date().toISOString().slice(0, 10)) {
  const merged = items.map((id) => mergedAt.get(id)).filter(Boolean).map((at) => at.slice(0, 10));
  const points = [];
  for (let day = start; day && day <= today; day = new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)) {
    points.push({ label: day.slice(5), remaining: items.length - merged.filter((at) => at <= day).length });
  }
  return points;
}

// The size of the page's body text, and the width the site keeps the burn-down chart at (src/theme/lme.css), in px, as the browser draws the page; null where nothing is drawn.
const bodyTextSize = () => parseFloat(globalThis.getComputedStyle?.(globalThis.document?.body)?.fontSize) || null;
const burnDownWidth = () => parseFloat(globalThis.getComputedStyle?.(globalThis.document?.documentElement)?.getPropertyValue?.("--burn-down-width")) || null;
const chartWidth = () => Math.min(burnDownWidth() ?? 700, Math.max(1, (globalThis.innerWidth ?? 700) - 72));

// The Mermaid chart of a sprint's items left over time. Given `width`, it is drawn that wide; given `size`, its title and its axes' labels and titles are drawn at `size` px — both by Mermaid's own configuration of the chart.
function burnDownChart(name, points, { width = null, size = null } = {}) {
  const most = Math.max(1, ...points.map((point) => point.remaining));
  const xAxis = `{ labelFontSize: ${size}, titleFontSize: ${size} }`;
  const yAxis = `{ labelFontSize: ${size}, titleFontSize: ${size} }`;
  const settings = [...(width ? [`    width: ${width}`] : []), ...(size ? [`    titleFontSize: ${size}`, `    xAxis: ${xAxis}`, `    yAxis: ${yAxis}`] : [])];
  const config = settings.length ? ["---", "config:", "  xyChart:", ...settings, "---"] : [];
  return [...config, "xychart-beta", `  title "${name} — items remaining, times in UTC"`, `  x-axis [${points.map((point) => `"${point.label}"`).join(", ")}]`,
    `  y-axis "Items remaining" 0 --> ${most}`, `  line [${points.map((point) => point.remaining).join(", ")}]`].join("\n");
}

// The chart as the page places it: MOD-markdown-render's rendering of a Mermaid block, which stays its source until drawCharts draws it once the HTML stands in the page.
export const chartBlock = (team, name, points) => `<div class="md" data-burn-down="${h(team)}">${renderArtifact(`\`\`\`mermaid\n${burnDownChart(name, points, { width: burnDownWidth(), size: bodyTextSize() })}\n\`\`\`\n`).innerHTML}</div>`;

const chartDraws = new WeakMap();

function fitChartViewport(chart) {
  const svg = chart.querySelector?.("svg");
  if (!svg?.getBBox || !svg.viewBox?.baseVal) return;
  const bounds = svg.getBBox(), viewport = svg.viewBox.baseVal;
  const left = Math.min(viewport.x, bounds.x), top = Math.min(viewport.y, bounds.y);
  const right = Math.max(viewport.x + viewport.width, bounds.x + bounds.width), bottom = Math.max(viewport.y + viewport.height, bounds.y + bounds.height);
  svg.setAttribute("viewBox", `${left} ${top} ${right - left + 1} ${bottom - top + 1}`);
}

function reducePhoneAxisLabels(chart) {
  const labels = chart.querySelectorAll?.(".left-axis .label text") ?? [];
  [...labels].forEach((label, index) => { if (index % 2) label.setAttribute("display", "none"); });
}

// Each block is redrawn through MOD-markdown-render when its viewport changes, so its requested width and available label
// space describe the viewport it is actually shown in.
export async function drawCharts(target) {
  chartDraws.get(target)?.abort();
  const charts = [...target.querySelectorAll("pre > code.language-mermaid")].map((code) => ({ element: code.parentNode, source: code.textContent }));
  const redraw = async () => {
    const width = chartWidth(), phone = (globalThis.innerWidth ?? width) < 600;
    for (const entry of charts) {
      const source = entry.source.replace(/width:\s*\d+/, `width: ${width}`).replace("    width:", phone ? `    height: 250\n    width:` : "    width:");
      const chart = await renderMermaid(source);
      chart.setAttribute("tabindex", "0");
      chart.setAttribute("data-chart-width", String(width));
      entry.element.replaceWith(chart);
      fitChartViewport(chart);
      if (phone) reducePhoneAxisLabels(chart);
      entry.element = chart;
    }
  };
  await redraw();
  const controller = new AbortController();
  chartDraws.set(target, controller);
  globalThis.addEventListener?.("resize", () => { redraw().catch(() => undefined); }, { signal: controller.signal });
}

// ---------------------------------------------------------------- reading

/**
 * The product's facts with MOD-progress-measures' scope `work`, read through the product's host at the branch the page has read where the caller names it (else the default branch
 * the repository reports), each snapshot read once — the instance's from the same host where the product is the instance; `shots` are the snapshots read already, by ref. Given
 * `facts`, those: they are read once per page. -> { ref, facts }
 */
export async function workFacts(context, facts = null, shots = new Map()) {
  const { product, instance } = context;
  const ref = product.ref ?? (await product.host.repositoryInfo()).defaultBranch;
  if (facts !== null) return { ref, facts };
  const host = Object.create(product.host);
  const set = (name, value) => Object.defineProperty(host, name, { value, writable: true, configurable: true, enumerable: true });
  set("repositoryInfo", async () => ({ defaultBranch: ref }));
  set("readSnapshot", (at) => { if (!shots.has(at)) shots.set(at, product.host.readSnapshot(at)); return shots.get(at); });
  const same = instance.host === product.host;
  const instanceHost = same ? host : instance.host;
  const instanceSnapshot = await instanceHost.readSnapshot(same ? ref : (await instanceHost.repositoryInfo()).defaultBranch);
  return { ref, facts: await productFacts(host, instanceSnapshot, (commit) => instanceHost.readSnapshot(commit), new Date(), { scope: "work" }) };
}

// The view the page draws: the one stored for the head, else the one stored last with its commit (asOf), else the one derived in the page from the facts of the scope `work`.
async function viewOf(context) {
  const { product } = context;
  const ref = product.ref ?? (await product.host.repositoryInfo()).defaultBranch;
  const shots = new Map([[ref, product.host.readSnapshot(ref)]]);
  const stored = await storedView(await shots.get(ref), "progress");
  if (stored) return { ref, view: stored.view, asOf: stored.asOf, snapshot: shots.get(ref) };
  const { facts } = await workFacts({ ...context, product: { ...product, ref } }, null, shots);
  const requirements = [...parseSpec((await facts.snapshot.read("SPEC.md")) ?? "").requirements.keys()];
  return { ref, view: progressView({ ...facts, requirements }, new Date()), asOf: null, snapshot: shots.get(ref) };
}

// The line above a view stored for another commit than the head.
export const asOfLine = (asOf) => `<p class="muted small" data-as-of>As of ${h(asOf.slice(0, 7))}: the view of the newest commit is being stored.</p>`;

// ---------------------------------------------------------------- the parts

// How many of a team's sprint's items are in progress, against the model's work-in-progress limit, counted per team (UC-032 step 7: in a model with sprints and a limit, both hold).
function wipLine(ctx, sprint) {
  const wip = ctx.view.model?.wip;
  if (!wip) return "";
  const busy = sprint.items.filter((each) => each.state.state === "in progress").map((each) => each.item);
  return `<p>${h(busy.length)} of ${h(wip)} items in progress${busy.length ? `: ${busy.map(h).join(", ")}` : ""}.${busy.length >= wip
    ? " No further item starts until one of them is merged." : ""}</p>`;
}

const WHY_SPRINT = whatIsThis("<p>A team plans, starts and closes sprints of its own (UC-032 step 6). While its sprint runs, the sprint holds the " +
  "items it selected until their change is in the default branch or they go back to the backlog; no other team selects an item " +
  "that changes or uses the same modules. The chart counts the selected items not done yet at the end of each day of the sprint, " +
  "in UTC, from its start to today — derived from the sprint's record and the pull requests " +
  "that name its items, never a stored status. A burn-down that stays flat means that nothing is merged (book ch. 7 §5, ch. 15).</p>");

function teamPanel(context, ctx, { team, sprint }) {
  if (sprint === null) {
    return `<section class="panel" data-team="${h(team)}"><h3>${h(team)} — no running sprint</h3>
      <p class="muted">Its last sprint, and its final burn-down, stand on <a href="#backlog">the backlog</a>.</p>
      <p>${planLink(team, "Plan sprint")}</p>${WHY_SPRINT}</section>`;
  }
  const rows = sprint.items.map((each) => `<tr data-item="${h(each.item)}"><td data-label="Item">${each.path ? fileLink(context, ctx.ref, each.path, h(each.item)) : h(each.item)}</td><td data-label="Title">${h(each.title)}</td>
      <td data-label="State">${stateCell(each.state)}</td><td class="small" data-label="Changes">${each.changes.map(h).join(", ") || "—"}</td>
      <td class="small" data-label="Uses">${each.uses.map(h).join(", ") || "—"}</td></tr>`).join("");
  // A sprint whose time box is over, or that the Product Owner ended, waits for its closer, who closes it in a session of their own (UC-041): no chart (UC-032 6b).
  const close = sprint.final ? `<p class="muted">It ended on ${h(sprint.ended ?? "")}; its review and retrospective are not recorded yet.</p>` : "";
  const endable = sprint.endable && ctx.asOf === null;
  const drawn = (ctx.view.measure?.sprints ?? []).find((each) => each.team === team)?.burnDown?.length > 0;
  const merged = [...(sprint.merges ?? [])].sort((a, b) => text(a.at).localeCompare(text(b.at))).map((merge) => merge.item);
  const points = merged.length ? `<p class="small">${behindLink(ctx.ref, merged, "data-point", "The trace of the items behind the chart")}</p>` : "";
  const chart = sprint.final ? "" : drawn ? `${chartBlock(team, sprint.name, remainingPerDay(sprint.items.map((each) => each.item), mergedAtOf(sprint.merges), sprint.start))}${points}`
    : `<p class="muted">No burn-down yet: the sprint starts on ${h(sprint.start)}.</p>`;
  return `<section class="panel" data-team="${h(team)}"><h3>${h(team)} — sprint ${fileLink(context, ctx.ref, sprint.path, h(sprint.name))}</h3>
    <dl class="meta"><dt>Goal</dt><dd>${h(sprint.goal)}</dd><dt>Started</dt><dd>${h(sprint.start)}</dd>
      <dt>Ends</dt><dd>${sprint.end ? h(sprint.end) : "when its items are done or the Product Owner ends it — no time box"}</dd>
      <dt>Branch</dt><dd>${sprint.branch ? `<code>${h(sprint.branch)}</code>` : `none: <code>${h(ctx.ref)}</code>`}</dd><dt>Closed by</dt><dd>${h(sprint.closer)}</dd></dl>
    ${wipLine(ctx, sprint)}
    <div class="table-scroll" tabindex="0"><table class="list"><thead><tr><th>Item</th><th>Title</th><th>State</th><th>Changes</th><th>Uses</th></tr></thead><tbody>${rows}</tbody></table></div>
    ${chart}${close}
    <p>${sprint.final ? "" : `${planLink(team, "Change the selection")} ${startWorkLink(sprint.name)}`}${endable ? ` <button class="btn" data-end-sprint="${h(team)}">End sprint</button>` : ""}</p>${WHY_SPRINT}</section>`;
}

function gatesPanel(context, ctx) {
  const gates = ctx.view.gates;
  const rows = gates.map((gate) => `<tr><td data-label="Gate">${h(gate.gate)}${gate.addedBy ? ` <span class="muted small">added by ${h(gate.addedBy.requirement)} (${h(gate.addedBy.source)})</span>` : ""}</td>
    <td data-label="State">${badge(gate.state)}</td>
    <td class="small" data-label="Decided">${gate.decided ? `${h(gate.decided.by)}, ${h(gate.decided.date)}, on ${h(gate.decided.on)}${gate.decided.record ? `, ${fileLink(context, ctx.ref, gate.decided.record, "record")}` : ""}` : "—"}</td>
    <td class="small" data-label="Needs">${h([gate.needs, gate.difference].filter(Boolean).join("; ")) || "—"}</td></tr>`).join("");
  return `<section class="panel" data-part="gates"><h3>Gates</h3>
    ${gates.length ? `<div class="table-scroll" tabindex="0"><table class="list"><thead><tr><th>Gate</th><th>State</th><th>Decided</th><th>Needs</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="muted">The workflow names no gate, or it could not be read.</p>`}
    ${whatIsThis("<p>The gates of the product's workflow in their order: passed, with who decided, when and on which text; pending, with what it " +
      "still needs; not reached. A gate whose record names a text that has changed since counts as passed on an earlier text only " +
      "(UC-035 step 3; THE GATE IS RECORDED; book ch. 15).</p>")}</section>`;
}

function blockedPanel(ctx, sprints) {
  const found = ctx.view.blocked;
  return `<section class="panel" data-part="blocked"><h3>Blocked</h3>
    ${found.length ? `<ul class="small">${found.map((entry) => `<li data-blocked="${h(entry.item)}"><b>${h(entry.item)}</b> — ${h(entry.reason)}: ${h(entry.detail)}</li>`).join("")}</ul>`
      : `<p class="muted">${sprints ? "No item a running sprint holds is blocked." : "No item or plan entry is blocked."}</p>`}
    ${whatIsThis("<p>Every item or plan entry that cannot move — in a model with sprints, every item a running sprint holds that cannot move —, with its reason: a failed job, a job waiting at a gate, a requirement " +
      "not yet accepted, the team's work-in-progress limit, or another team's sprint that holds a module it needs (UC-035 step 4; book ch. 7, ch. 15).</p>")}</section>`;
}

// The page of a job on the job dashboard: MOD-main-page's route `job`, on the main page; the product named where it is not the instance.
export function jobHref(context, id) {
  const product = context.product?.address;
  const own = product === `https://github.com/${context.instance?.repository}`;
  const fragment = `#job/id=${encodeURIComponent(id)}${product && !own ? `/product=${encodeURIComponent(product)}` : ""}`;
  return `${context.page === "main" ? "" : "../index.html"}${fragment}`;
}

function whoPanel(context, ctx) {
  const who = ctx.view.who;
  const several = ctx.view.teams.length > 1;
  const rows = who.participants.map((entry) => `<tr><td data-label="Participant">${h(entry.participant)}</td><td class="small" data-label="Roles">${entry.roles.map(h).join(", ")}</td>
    ${several ? `<td class="small" data-label="Teams">${entry.teams.map(h).join(", ") || "—"}</td>` : ""}
    <td class="small" data-label="Current jobs">${entry.jobs.map((id) => `<a href="${h(jobHref(context, id))}">${h(id)}</a>`).join(", ") || "—"}</td></tr>`).join("");
  const missing = who.unreachable.length ? `<p class="warn small">Not reached: ${who.unreachable.map((each) => `${h(each.route)}${each.reason ? ` (${h(each.reason)})` : ""}`).join("; ")} — jobs running there are not shown.</p>` : "";
  return `<section class="panel" data-part="who"><h3>Who works on what</h3>
    ${who.participants.length ? `<div class="table-scroll" tabindex="0"><table class="list"><thead><tr><th>Participant</th><th>Roles</th>${several ? "<th>Teams</th>" : ""}<th>Current jobs</th></tr></thead><tbody>${rows}</tbody></table></div>`
      : `<p class="muted">No role assignment names a participant yet.</p>`}${missing}
    ${whatIsThis("<p>Each participant of the product with its roles — and its team, with several teams — and the jobs it works on now, each " +
      "linked to its page on the job dashboard, where its log, cost and state stand (UC-035 step 5, UC-036; book ch. 15).</p>")}</section>`;
}

// The page of what is behind a cell, a card or a point (UC-035 step 6), as the frame's route and params: a requirement's trace — the specification at the branch shown, narrowed
// to it by the part `text` —, a use case's page, or, where nothing is named, the specification at the branch shown; and its address.
const behind = (ref, name = null) => (name === null ? ["trace", { key: "specification", ref }] : /^UC-/.test(name) ? ["use-case", { id: name }]
  : ["trace", { key: "specification", ref, text: name }]);
const hrefOf = ([route, params]) => `#${[route, ...Object.entries(params).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)].join("/")}`;
const traceHref = (ref, name = null) => hrefOf(behind(ref, name));

// A link to what is behind the items `items`, a card's or a chart's: the specification at the branch shown until the click finds the first requirement or use case they realise.
const behindLink = (ref, items, attributes, label) => `<a ${attributes} data-behind="${h(items.join(" "))}" href="${h(traceHref(ref))}">${label}</a>`;

// The first requirement or use case the first of `items` that realises one realises, read from the items' files in the snapshot the page has read; the specification where none does.
async function firstBehind(ctx, items) {
  const snapshot = await ctx.snapshot;
  for (const id of items) {
    const path = snapshot.paths.find((each) => each === `docs/backlog/${id}.md` || (each.startsWith(`docs/backlog/${id}-`) && each.endsWith(".md") && !each.slice(13).includes("/")));
    if (!path) continue;
    const realises = readDocument(artifactSchemas().item, path, (await snapshot.read(path)) ?? "").fields.realises;
    const first = [realises ?? []].flat().map(text).find(Boolean);
    if (first) return behind(ctx.ref, first);
  }
  return behind(ctx.ref);
}

const WHY_MEASURE = whatIsThis("<p>Each process model names the measure its progress is shown in: plan entries per phase, remaining items per time box, " +
  "or items per state over time (UC-035; book ch. 15 §2–3). A cell or a card leads to the trace of what is behind it. A grid cell that stays open " +
  "means that nothing has been done for that requirement in that phase; a band that widens in the cumulative flow means that items pile up in that state " +
  "(book ch. 15 §3).</p>");

// A planned model: the grid of requirements by phases, the phases on a timeline with their gates, and the steps of the implementation plan with their states.
function plannedPanel(ctx, planned) {
  const phases = [...new Set(planned.grid.entries.map((entry) => entry.phase))];
  const requirements = [...new Set(planned.grid.entries.map((entry) => entry.requirement))];
  const cell = (requirement, phase) => {
    const entry = planned.grid.entries.find((each) => each.requirement === requirement && each.phase === phase);
    return `<td data-label="${h(phase)}">${entry ? `<a data-cell data-requirement="${h(requirement)}" data-phase="${h(phase)}" class="badge ${BADGE[entry.state] ?? "b-stale"}" href="${h(traceHref(ctx.ref, requirement))}">${h(entry.state)}</a>` : "—"}</td>`;
  };
  const grid = requirements.length
    ? `<p class="muted small">${h(planned.grid.count)}</p><div class="table-scroll" tabindex="0"><table class="list"><thead><tr><th>Requirement</th>${phases.map((phase) => `<th>${h(phase)}</th>`).join("")}</tr></thead><tbody>${
      requirements.map((requirement) => `<tr><td data-label="Requirement">${h(requirement)}</td>${phases.map((phase) => cell(requirement, phase)).join("")}</tr>`).join("")}</tbody></table></div>`
    : `<p class="muted">No requirement is accepted yet: the plan fills itself as requirements are accepted.</p>`;
  const timeline = `<ol class="small">${planned.timeline.map((entry) => `<li data-phase-entry="${h(entry.phase)}">${h(entry.phase)}${entry.gate ? ` — gate ${h(entry.gate)}${entry.passed ? `, passed ${h(entry.passed)}` : ""}` : ""}</li>`).join("")}</ol>`;
  const steps = planned.steps.length
    ? `<ul class="small">${planned.steps.map((step) => `<li data-step="${h(step.item)}"><b>${h(step.item)}</b> ${stateCell(step)}</li>`).join("")}</ul>` : `<p class="muted">The implementation plan holds no step.</p>`;
  return `${grid}<h4>Phases</h4>${timeline}<h4>Steps of the plan</h4>${steps}`;
}

// The cumulative flow of the board: the items in each state at the end of each day, a line for each state that holds an item on some day.
function flowChart(flow) {
  const states = flow.cumulative.length ? Object.keys(flow.cumulative[0].counts).filter((name) => flow.cumulative.some((day) => day.counts[name] > 0)) : [];
  if (!states.length) return "";
  const most = Math.max(1, ...flow.cumulative.flatMap((day) => states.map((name) => day.counts[name])));
  const source = ["xychart-beta", `  title "Items per state per day — ${states.join(", ")}"`, `  x-axis [${flow.cumulative.map((day) => `"${day.day.slice(5)}"`).join(", ")}]`,
    `  y-axis "Items" 0 --> ${most}`, ...states.map((name) => `  line [${flow.cumulative.map((day) => day.counts[name]).join(", ")}]`)].join("\n");
  return `<div class="md" data-flow-chart>${renderArtifact(`\`\`\`mermaid\n${source}\n\`\`\`\n`).innerHTML}</div>`;
}

// A model with a work-in-progress limit: the board's cards by column, and the cumulative flow.
function flowPanel(ctx, flow) {
  const columns = flow.columns.filter((column) => column.items.length);
  const board = columns.length ? `<div class="table-scroll" tabindex="0"><table class="list"><thead><tr>${columns.map((column) => `<th>${h(column.name)}</th>`).join("")}</tr></thead><tbody><tr>${
    columns.map((column) => `<td data-column="${h(column.name)}">${column.items.map((id) => behindLink(ctx.ref, [id], `data-card="${h(id)}" class="btn"`, h(id))).join(" ")}</td>`).join("")}</tr></tbody></table></div>`
    : `<p class="muted">The board holds no item.</p>`;
  const chart = flowChart(flow);
  return `<p>Work-in-progress limit: ${h(flow.wip)}.</p>${board}${chart ? `${chart}<p class="small">${behindLink(ctx.ref, flow.columns.find((column) => column.name === "done")?.items ?? [], "data-point", "The trace of the items behind the chart")}</p>`
    : `<p class="muted">No cumulative flow yet: the pull requests are unknown or no day is dated.</p>`}`;
}

// For a model without sprints: its measure as progressIn of the view gives it; where that is neither a grid, sprints nor a flow, the link to the backlog.
function measurePanel(ctx, model) {
  const measure = ctx.view.measure;
  const body = measure?.planned ? plannedPanel(ctx, measure.planned) : measure?.flow ? flowPanel(ctx, measure.flow)
    : `<p>Progress in this model's measure, ${h(model.measure ?? "its own")}, stands on <a href="#backlog">the backlog</a>.</p>`;
  return `<section class="panel" data-part="measure"><h3>${h(model.measure ?? "Progress")}</h3>${body}${WHY_MEASURE}</section>`;
}

// ---------------------------------------------------------------- the route

async function draw(target, context) {
  const ctx = await viewOf(context);
  const { view } = ctx;
  const { model } = view;
  const unread = view.modelUnread ? `<p class="warn">The model version <code>${h(view.modelUnread.commit)}</code> the declaration names cannot be read from the instance (${h(view.modelUnread.error)}), so no process model is shown.</p>` : "";
  const noModel = unread || (!view.declared ? `<p class="warn">This product declares no process model yet: <code>docs/process.md</code> names it (UC-002).</p>`
    : !model ? `<p class="warn">The declaration names the model file <code>${h(view.modelFile ?? "—")}</code>, which the catalogue does not hold.</p>` : "");
  const sprints = model?.sprints === true;
  const teamsPart = !model ? "" : !sprints ? measurePanel(ctx, model)
    : view.teams.length ? view.teams.map((team) => teamPanel(context, ctx, team)).join("")
      : `<section class="panel" data-part="teams"><h3>No team yet</h3><p class="muted">The product's model works in sprints, and no role assignment names a team yet (UC-048).</p>
        ${whatIsThis("<p>Each team of a product has a role assignment under <code>docs/role-assignments/</code>, and plans and runs sprints of its own (book ch. 7).</p>")}</section>`;
  target.innerHTML = `
    <section class="head"><h2>Progress</h2>
      <p class="muted">${h(context.product.address)} · <code>${h(ctx.ref)}</code> · what goes on now, derived from the repository and its pull requests; nothing here is a stored status. <a href="#backlog">The backlog</a> keeps every item and each team's last ended sprint.</p>
      ${ctx.asOf ? asOfLine(ctx.asOf) : ""}
      ${noModel}
      ${whatIsThis("<p>What goes on now: each team's running sprint, its items and how far it is; the gates; what is blocked; who works on " +
        "what. Everything is derived from the repository and its pull requests, for the commit shown (UC-035).</p>")}</section>
    ${teamsPart}
    ${model ? `${gatesPanel(context, ctx)}${blockedPanel(ctx, sprints)}${whoPanel(context, ctx)}` : ""}`;
  await drawCharts(target);

  // A card or a chart's link: on the person's click, the first requirement or use case behind it, read then; where its items cannot be read, the specification.
  target.querySelectorAll("[data-behind]").forEach((link) => link.addEventListener("click", async (event) => {
    if (event?.isTrusted === false) return;
    event?.preventDefault?.();
    const items = (link.getAttribute("data-behind") ?? "").split(" ").filter(Boolean);
    const [to, params] = await firstBehind(ctx, items).catch(() => behind(ctx.ref));
    context.go(to, params);
  }));

  target.querySelectorAll("[data-end-sprint]").forEach((button) => button.addEventListener("click", async (event) => {
    if (event?.isTrusted === false) return;
    const name = button.dataset?.endSprint ?? button.getAttribute("data-end-sprint");
    const sprint = view.teams.find((each) => each.team === name)?.sprint?.name;
    try {
      const result = await endSprint(context.product.host, sprint, { head: view.commit, now: new Date(), trailers: [] });
      await draw(target, context);
      target.insertAdjacentHTML?.("afterbegin", `<section class="panel notice flash"><p>Sprint <code>${h(sprint)}</code> is ended — commit ${h(result.commit.slice(0, 7))}.</p></section>`);
    } catch (failure) {
      target.insertAdjacentHTML?.("afterbegin", `<section class="panel notice flash"><p class="warn">${h(failure?.message ?? failure)}</p></section>`);
    }
  }));
}

export const route = {
  ...heads.progress,

  async render(target, context) {
    await draw(target, context);
  },
};
