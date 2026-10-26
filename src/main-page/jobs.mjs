// jobs.mjs — the route `jobs` (docs/architecture/MOD-main-page.md, Parts and Interfaces: `jobs`): every job of every product and of the instance in one list, with the job of this
// tab's conversation among them, waiting at a gate first, filtered by product, state, participant or where it runs; a source that cannot be read is named above the list with its reason.
// It also draws the route `job`: one job's inputs, log, cost and the gate it waits at (Interfaces: `job`).
//
// Module: MOD-main-page
//
// ONE DASHBOARD SHOWS EVERY JOB; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; NO COST IS GUESSED. The page computes no state, no elapsed time and no cost of a record: listJobs derives them
// (MOD-job-ledger) from the records and from the live state each job's runtime reports (MOD-runtimes), asked once when the list is drawn. It stores nothing. It reads each repository through
// the host the frame connected for it — the instance's from the ViewContext, a product's by MOD-site-frame's chosenProduct, with its own token and the stored secrets the host refuses to write — and sends no
// token anywhere else (MOD-repository-hosts). Uses MOD-site-frame, MOD-browser-store, MOD-bridge-client, MOD-repository-hosts, MOD-job-ledger, MOD-runtimes and MOD-prompt-bar only through their index.mjs.
//
// How a list is drawn: each source's default branch is read; listJobs reads the records once (without live states) to name the jobs whose record has no end; each of those is asked once with
// liveState, and listJobs derives the rows again with what was reported — the records are not fetched twice, since a snapshot reads a file once. A Bridge handle is made as the prompt bar and
// the review pages make one (settingsOf with the stored jump host, then bridgeAt), since a Bridge kept at a port of the jump host has no address of its own.

import { readSetting } from "../browser-store/index.mjs";
import { bridgeAt, settingsOf } from "../bridge-client/index.mjs";
import { parseAddress } from "../repository-hosts/index.mjs";
import { chosenProduct, confirmDecision, explain, tokenKeyOf } from "../site-frame/index.mjs";
import { listJobs } from "../job-ledger/index.mjs";
import { cancelJob, liveState, jobLog, jobTrail, retryJob, revertAfterCancel, routesFor } from "../runtimes/index.mjs";
import { productFacts } from "../progress-measures/index.mjs";
import { startable } from "../work-plans/index.mjs";
import { mayDecide, recordGateDecision } from "../product-process/index.mjs";
import { currentJob } from "../prompt-bar/index.mjs";
import { el, clock } from "./cards.mjs";

// The sources of a route, each with the host the frame connected: the products this browser keeps (the setting `products`), each address that parses once, connected through MOD-site-frame's
// chosenProduct — with its own token to its own server only and with the stored secrets the host refuses to write —, and the instance's own (the ViewContext's) where the route lists it: always on the
// route `jobs`, and on the route `home` only while this browser keeps no product (then it is Agent M's own card). A product equal to a source already listed is not read again. A product the frame
// cannot connect is { address, reason }; one it can carries its host and whether a token is stored for it. `route` names the route whose address (`#<route>/product=…`) the frame connects the product for.
export async function sourcesOf(context, route = "jobs") {
  const { store, instance } = context;
  const own = parseAddress(`https://github.com/${instance.repository}`).web;
  const kept = [...new Set((readSetting(store, "products") ?? []).flatMap((text) => { try { return [parseAddress(text).web]; } catch { return []; /* an address that is none names no source */ } }))];
  const listsInstance = route === "jobs" || kept.length === 0;
  const products = await Promise.all(kept.filter((web) => !(listsInstance && web === own)).map(async (web) => {
    try {
      const product = await chosenProduct({ store, fragment: `#${route}/product=${encodeURIComponent(web)}` });
      return { address: web, host: product.host, tokenStored: product.tokenStored };
    } catch (failure) {
      return { address: web, reason: String(failure?.message ?? failure) };
    }
  }));
  return [...(listsInstance ? [{ address: own, host: instance.host, own: true }] : []), ...products];
}

// One source read: its default branch as a snapshot. A source that fails is { address, reason }.
async function readSource({ address, host, reason }) {
  if (reason !== undefined) return { address, reason };
  try {
    const { defaultBranch } = await host.repositoryInfo();
    return { address, host, snapshot: await host.readSnapshot(defaultBranch) };
  } catch (failure) {
    return { address, reason: String(failure?.message ?? failure) };
  }
}

// A handle for each Bridge a record's `by:` names that this browser keeps under `bridge:<name>`; a name it does not keep, or cannot reach through the jump host, has none.
export function bridgesOf(rows, store) {
  const bridges = {};
  for (const { record } of rows) {
    const name = record.taken?.by;
    if (record.end || !name || Object.hasOwn(bridges, name)) continue;
    try {
      const stored = readSetting(store, `bridge:${name}`);
      if (stored) bridges[name] = bridgeAt(settingsOf({ name, ...stored }, readSetting(store, "jump-host")));
    } catch { /* not a Bridge's name, or no jump host: the live state then says why it is not reachable */ }
  }
  return bridges;
}

// The live state of each job whose record has no end and whose source was read, asked once at its runtime: a Map from the job's identifier. A failure is the state `reachable: false` with its reason.
export async function liveStatesOf(rows, hostOf, bridges) {
  const lives = new Map();
  await Promise.all(rows.filter((row) => !row.record.end && row.source.reachable).map(async (row) => {
    try { lives.set(row.record.id, await liveState(row.record, { host: hostOf.get(row.product) }, bridges)); } catch (failure) {
      lives.set(row.record.id, { reachable: false, reason: String(failure?.message ?? failure), known: false });
    }
  }));
  return lives;
}

const costText = (cost) => (cost.known ? `${cost.amount} ${cost.currency}` : "unknown");

// The rows of the list as the page shows them: a JobRow of MOD-job-ledger, with what its live state says; the job of this tab's conversation after the rows that wait at a gate.
function shownRow(row, lives) {
  const live = lives.get(row.record.id) ?? null;
  return {
    id: row.record.id, product: row.product, works: row.record.worksOn.join(", "), kind: row.record.kind ?? "", participant: row.record.participant ?? "",
    runs: row.record.taken?.by ?? "not taken", state: row.state, elapsed: clock(row.elapsed), cost: costText(row.cost),
    reason: live && !live.reachable ? `not reachable: ${live.reason}` : !row.source.reachable ? `could not be read: ${row.source.reason}` : null,
  };
}
function listOf(jobRows, lives) {
  const shown = jobRows.map((row) => shownRow(row, lives));
  const tab = currentJob();
  if (tab !== null) {
    const waiting = shown.filter((row) => row.state === "waiting at a gate").length;
    shown.splice(waiting, 0, { tab: true, id: "", product: "", works: "", kind: tab.kind, participant: tab.participant, runs: "this tab", state: "running",
      elapsed: clock((Date.now() - tab.started.getTime()) / 1000), cost: "unknown", reason: null });
  }
  return shown;
}

const FILTERS = [["product", "Product"], ["state", "State"], ["participant", "Participant"], ["runs", "Where it runs"]];

// The groups of the list, in the order of the states of MOD-job-ledger's JobState with the jobs that wait at a gate first (UC-036 step 2).
const GROUPS = ["waiting at a gate", "running", "queued", "done", "failed", "cancelled", "ended without record"];
// A cancelling job stands within the group running (UC-036 6a): the row says cancelling, the group says running.
const groupOf = (row) => (row.state === "cancelling" ? "running" : row.state);
const place = (row) => (GROUPS.includes(groupOf(row)) ? GROUPS.indexOf(groupOf(row)) : GROUPS.length);

function drawList(rows, go) {
  const chosen = {};
  const body = el("tbody");
  const draw = () => body.replaceChildren(...rows.filter((row) => FILTERS.every(([key]) => !chosen[key] || row[key] === chosen[key])).sort((a, b) => place(a) - place(b)).flatMap((row, at, shown) => {
    const line = el("tr", row.tab ? "job this-tab" : "job");
    if (!row.tab) line.setAttribute("data-id", row.id);
    const state = el("td", "state", row.state);
    if (row.reason) state.append(" ", el("span", "reason", row.reason));
    const open = el("button", "job-link btn small", row.id);
    open.setAttribute("type", "button");
    open.addEventListener("click", () => go("job", { id: row.id, product: row.product }));
    line.append(el("td", "id", ...(row.tab ? ["this tab's"] : [open])), el("td", "product", row.product || "—"), el("td", "works-on", row.works), el("td", "kind", row.kind),
      el("td", "participant", row.participant || "—"), el("td", "runs", row.runs), state, el("td", "elapsed", row.elapsed), el("td", "cost", row.cost));
    if (at > 0 && groupOf(shown[at - 1]) === groupOf(row)) return [line];
    const name = el("th", "group-state", groupOf(row));
    name.setAttribute("colspan", "9");
    const header = el("tr", "group", name);
    header.setAttribute("data-state", groupOf(row));
    return [header, line];
  }));
  const filters = el("p", "filters");
  for (const [key, label] of FILTERS) {
    const select = el("select", "filter");
    select.setAttribute("data-filter", key);
    const all = el("option", null, "all");
    all.value = "";
    select.append(all);
    for (const value of [...new Set(rows.map((row) => row[key]).filter(Boolean))].sort()) {
      const option = el("option", null, value);
      option.value = value;
      select.append(option);
    }
    select.addEventListener("change", () => { chosen[key] = select.value; draw(); });
    filters.append(el("label", null, `${label} `, select), " ");
  }
  draw();
  const head = el("tr", null, ...["Job", "Product", "Works on", "Kind", "Participant", "Where it runs", "State", "Elapsed", "Cost"].map((text) => el("th", null, text)));
  return [filters, el("table", "jobs", el("thead", null, head), body)];
}

// The jobs this page asked to cancel whose runtime has not confirmed (`cancelJob` answered "cancelling"): kept in memory only, since MOD-runtimes' liveState never reports the state. A job shown
// cancelling stays so while its runtime still lists it; once the runtime holds it no more, it is forgotten.
const CANCELLING = new Set();
const CANCELLABLE = new Set(["queued", "running", "waiting at a gate"]);
function markCancelling(lives) {
  for (const id of [...CANCELLING]) {
    const live = lives.get(id);
    if (live?.known) lives.set(id, { ...live, cancelling: true });
    else CANCELLING.delete(id);
  }
  return lives;
}

// Every job of every source, read once: the JobRows of MOD-job-ledger with the live state each runtime reported, the sources that could not be read, and what a job's log needs.
async function everyJob(context) {
  const sources = await Promise.all((await sourcesOf(context)).map(readSource));
  const readable = sources.filter((source) => source.snapshot);
  const products = readable.map(({ address, snapshot }) => ({ address, snapshot }));
  const first = await listJobs(products, new Map());
  const bridges = bridgesOf(first, context.store);
  const hostOf = new Map(readable.map((source) => [source.address, source.host]));
  const lives = markCancelling(await liveStatesOf(first, hostOf, bridges));
  return { jobRows: await listJobs(products, lives), lives, bridges, hostOf, unreadable: sources.filter((source) => source.reason) };
}
const unreadableList = (unreadable) => (unreadable.length ? [el("ul", "unreadable", ...unreadable.map((source) => el("li", "source", `${source.address}: ${source.reason}`)))] : []);

// The folded explanation of each state of the list and of each kind of runtime (UC-036: "Every state, and every kind of runtime, carries a folded What is this?"), once each, whether or
// not a job is in it. The topics stand in MOD-site-frame's explanations.md; the frame's check reads these tables for the topics the route names.
const STATE_TOPIC = {
  "waiting at a gate": "job-state-waiting-at-a-gate", running: "job-state-running", queued: "job-state-queued", done: "job-state-done", failed: "job-state-failed",
  cancelled: "job-state-cancelled", "ended without record": "job-state-ended-without-record", cancelling: "job-state-cancelling",
};
// The states the explanations stand for, cancelling beside the running it is shown within.
const EXPLAINED = [...GROUPS.slice(0, 2), "cancelling", ...GROUPS.slice(2)];
const RUNTIME_TOPIC = { tab: "job-runtime-tab", ci: "job-runtime-ci", bridge: "job-runtime-bridge" };
const RUNTIME_NAME = { tab: "This browser's tab", ci: "CI", bridge: "A Bridge" };

function explanations() {
  const states = EXPLAINED.map((state) => {
    const box = el("div", "job-state-explain", el("strong", null, state), " ", explain(STATE_TOPIC[state]));
    box.setAttribute("data-state", state);
    return box;
  });
  const runtimes = Object.keys(RUNTIME_TOPIC).map((runtime) => {
    const box = el("div", "job-runtime-explain", el("strong", null, RUNTIME_NAME[runtime]), " ", explain(RUNTIME_TOPIC[runtime]));
    box.setAttribute("data-runtime", runtime);
    return box;
  });
  return el("section", "job-explanations", el("h3", null, "States"), ...states, el("h3", null, "Where jobs run"), ...runtimes);
}

async function render(target, context) {
  target.replaceChildren(el("h2", null, "Every job"), el("p", "reading", "Reading…"));
  const { jobRows, lives, unreadable } = await everyJob(context);
  target.replaceChildren(el("h2", null, "Every job"), ...unreadableList(unreadable), ...drawList(listOf(jobRows, lives), context.go), explanations());
}

/**
 * jobs: Route — { name: "jobs", entry: null, title: "Every job", render }; the frame's default subject.
 */
export const jobs = { name: "jobs", entry: null, title: "Every job", render };

// ---------------------------------------------------------------- one job

const usageText = (usage) => [usage.inputTokens != null && `${usage.inputTokens} input tokens`, usage.outputTokens != null && `${usage.outputTokens} output tokens`,
  usage.minutes != null && `${usage.minutes} minutes`].filter(Boolean).join(", ");
// NO COST IS GUESSED: the amount only where the runtime or the declared price made one known; else the usage that was reported, with its price unknown; else unknown.
function costLine(cost) {
  if (cost.known) return `${cost.amount} ${cost.currency} (${cost.basis})`;
  const usage = cost.usage ? usageText(cost.usage) : "";
  return usage ? `${usage} · price unknown` : "unknown";
}

function link(className, address, text) {
  const anchor = el("a", className, text);
  anchor.setAttribute("href", address);
  anchor.setAttribute("target", "_blank");
  anchor.setAttribute("rel", "noopener");
  return anchor;
}

// The log, drawn into `box` as the runtime gives it: a Bridge's lines one after another while the page is shown, a CI run's by its address, else the sentence that the runtime keeps none.
async function drawLog(box, page, row, { hostOf, bridges }) {
  const gone = () => box.append(el("p", "log-gone", "The runtime keeps no log for this job any more."), ...(row.record.end?.log ? [el("p", null, "Recorded at its end: ", link("record-link", row.record.end.log, row.record.end.log))] : []));
  try {
    const log = await jobLog(row.record, { host: hostOf.get(row.product) }, bridges);
    if (log.address) box.append(link("log-link", log.address, "Open the log of the run"));
    else if (log.gone) gone();
    else {
      const lines = [], shown = el("pre", "job-log-lines");
      box.append(shown);
      for await (const line of log.stream) {
        if (page.parentNode === null) return; // the page was left: the stream is not followed any more
        lines.push(line);
        shown.textContent = lines.join("\n");
      }
    }
  } catch (failure) {
    box.append(el("p", "warn log-problem", `The log could not be read: ${String(failure?.message ?? failure)}`));
  }
}

async function renderJob(target, context, params, note = null) {
  target.replaceChildren(el("h2", null, "Job"), el("p", "reading", "Reading…"));
  const read = await everyJob(context);
  let product = params.product ?? null;
  if (product !== null) { try { product = parseAddress(product).web; } catch { /* the address as given */ } }
  const held = read.jobRows.find(({ record, product: at }) => record.id === params.id && (product === null || at === product));
  if (held === undefined) {
    target.replaceChildren(el("h2", null, "Job"), ...unreadableList(read.unreadable), el("p", "job-missing", `No job ${params.id} in the instance or in the products this browser keeps.`));
    return;
  }
  const { record } = held, row = shownRow(held, read.lives);
  const page = el("section", "job-page", el("h2", null, `Job ${row.id}`),
    el("p", "job-facts", [row.product, row.works, row.kind, row.participant, row.runs, row.state, row.elapsed].join(" · ")));
  if (record.inputs.length) page.append(el("h3", null, "Inputs"), el("ul", "job-inputs", ...record.inputs.map((input) => el("li", "job-input", input))));
  if (record.destinations.length) page.append(el("ul", "job-destinations", ...record.destinations.map(({ participant, place, parts }) => el("li", "job-destination", `${participant}, at ${place}: ${parts.join(", ")}.`))));
  if (Object.keys(record.params).length) page.append(el("h3", null, "Parameters"), el("pre", "job-params", JSON.stringify(record.params, null, 2)));
  const gate = row.state === "waiting at a gate" ? record.gates.findLast((reached) => reached.resumedBy === null) : undefined;
  if (gate) {
    page.append(el("p", "job-gate", "Waiting at the gate ", el("span", "gate-name", gate.gate), ", decided by ", el("span", "gate-decider", gate.decider),
      ...(/^check:/.test(gate.decider) ? [" — ", el("span", "gate-self", "decides by itself")] : [])));
  }
  if (CANCELLABLE.has(row.state)) page.append(cancelControls(target, context, params, held, read));
  if (note) page.append(el("p", "job-cancel-result", note));
  if (gate) page.append(await gateDecision(context, held, read, gate));
  if (RETRIABLE.has(row.state)) page.append(await retryControls(context, held, read));
  if (row.state === "cancelled") page.append(await afterCancelSection(held, read));
  page.append(await trailSection(held, read));
  page.append(el("h3", null, "Cost"), el("p", "job-cost", costLine(held.cost)));
  const log = el("div", "job-log");
  page.append(el("h3", null, "Log"), log);
  target.replaceChildren(el("h2", null, "Job"), ...unreadableList(read.unreadable), page);
  drawLog(log, page, held, read); // not awaited: the page stands while the log follows its runtime
  if (row.state === "cancelling") readAgainLater(page, target, context, params);
}

// ---------------------------------------------------------------- Retry (UC-036 step 7, 1c, 7a)
//
// Where the texts leave a reading open, this file takes the one it names:
//   - The participants offered are those for which MOD-work-plans' startable admits every plan item the job works on (the product's facts of the scope `work`, as the prompt bar reads them); for a job on no plan item, the job's own participant.
//     The team's role assignment and sprint are those whose sprint holds the item, else the one assignment of a product without sprints. Where none is admitted, the reasons are shown and nothing is queued (7a).
//   - The routes offered are those routesFor gives the chosen participant that are available, no resource need being passed (the scope `work` reads none), as the record writes them.
//   - The same check comes first for a job that ran in a tab and a job whose task travelled with its hand-over: where no participant is admitted, they are offered neither Retry nor the prompt bar.
//   - A job that ran in a tab, and a job whose task travelled with its hand-over, are not queued: the prompt bar is opened with the job's kind and parameters, by the route `job` with the parameter `retry`, whose `subject` gives the bar its Subject.

const RETRIABLE = new Set(["failed", "cancelled", "ended without record"]);
const WORKFLOWS = [".github/workflows/agent-m-jobs.yml", ".gitlab/agent-m-jobs.yml"];
const recordRoute = (route) => (route.kind === "tab" ? "tab" : route.kind === "ci" ? (route.runner === "hosted" ? "ci hosted" : `ci runner:${route.runner}`) : `bridge ${route.bridge}`);

// The parameters of the records whose retry opened the prompt bar, by the job: the bar's Subject gives them to the kind (the address carries the kind alone).
const RETRY_PARAMS = new Map();
function subjectOf(params) {
  if (!params?.retry || !params.id) return null;
  // Context only (MOD-prompt-bar, Subject): the job's kind as its page and its inputs as its parameters, so that the conversation hands the retry on to that kind (UC-049 4a).
  return { key: `retry:${params.id}`, title: `Retry ${params.id}`, entry: null,
    paramsFor: () => ({ page: `Retry of the job ${params.id}, a job of the kind ${params.retry}: to retry it, hand it on to ${params.retry} with the same inputs.`,
      ...structuredClone(RETRY_PARAMS.get(params.id) ?? {}) }), draftRoute: null, withhold: null, refuses: [] };
}

function teamOf(item, facts, workflow) {
  const held = facts.held.find((each) => each.item === item);
  if (held) {
    return { assignment: facts.assignments.find((each) => each.path.endsWith(`/${held.team}.md`)) ?? null, sprint: facts.sprints.find((each) => each.path.endsWith(`/${held.sprint}.md`)) ?? null };
  }
  return workflow?.model?.flow?.sprints !== true && facts.assignments.length === 1 ? { assignment: facts.assignments[0], sprint: null } : { assignment: null, sprint: null };
}

async function retryControls(context, held, read) {
  const { record } = held;
  const box = el("div", "job-retry");
  const result = el("p", "retry-result");
  const openBar = () => { RETRY_PARAMS.set(record.id, record.params); context.go("job", { id: record.id, product: held.product, retry: record.kind }); };
  const barButton = (className, label) => {
    const button = el("button", `${className} btn`, label);
    button.setAttribute("type", "button");
    button.addEventListener("click", (event) => { if (event.isTrusted) openBar(); });
    return button;
  };
  const host = read.hostOf.get(held.product);
  let facts, visibility;
  try {
    const instanceHost = context.instance.host;
    const snapshot = await instanceHost.readSnapshot((await instanceHost.repositoryInfo()).defaultBranch);
    facts = await productFacts(host, snapshot, (commit) => instanceHost.readSnapshot(commit), new Date(), { scope: "work" });
    visibility = (await host.repositoryInfo()).visibility;
  } catch (failure) {
    box.append(el("p", "warn retry-unreadable", `Retry could not be prepared: ${String(failure?.message ?? failure)}`));
    return box;
  }
  const workflow = facts.workflow === "unknown" ? null : facts.workflow;
  const items = record.worksOn.filter((id) => facts.plan.states.some((state) => state.item === id));
  const reasons = new Set();
  const holders = items.length === 0 ? facts.participants.filter((each) => each.name === record.participant) : facts.participants.filter((each) => items.every((item) => {
    const { assignment, sprint } = teamOf(item, facts, workflow);
    const verdict = startable(item, facts.plan.states, { workflow, assignment, sprint, held: facts.held, wip: workflow?.model?.flow?.wip ?? null, participants: [each] });
    // The job being retried has itself ended badly, which blocks its item ("job <id> is failed") or, ended without a record, keeps it in progress: those reasons are what a retry resolves, so they do not count.
    const own = (reason) => reason.includes(record.id) || (held.state === "ended without record" && reason === `${item} is in progress already.`);
    const blocking = verdict.startable ? [] : verdict.reasons.filter((reason) => !own(reason));
    blocking.forEach((reason) => reasons.add(reason));
    return blocking.length === 0;
  }));
  if (holders.length === 0) {
    box.append(el("p", null, "This job cannot be retried now:"), el("ul", "retry-reasons", ...[...reasons].map((reason) => el("li", "retry-reason", reason))), result);
    return box;
  }
  if (record.task === "with the hand-over") {
    result.textContent = "Its task travelled with its hand-over and is not in the record: write it again in the prompt bar.";
    box.append(result, el("p", null, barButton("retry-prompt-bar", "Open the prompt bar")));
    return box;
  }
  if (record.route === "tab") {
    box.append(el("p", null, barButton("retry", "Retry")), result);
    return box;
  }
  holders.sort((a, b) => (b.name === record.participant) - (a.name === record.participant));
  const jobWorkflow = WORKFLOWS.some((path) => facts.snapshot.paths.includes(path));
  const participant = el("select", "retry-participant", ...holders.map((each) => { const option = el("option", null, each.name); option.value = each.name; return option; }));
  participant.value = holders[0].name;
  const route = el("select", "retry-route");
  let offered = new Map();
  const fillRoutes = () => {
    const chosen = holders.find((each) => each.name === participant.value);
    offered = new Map(routesFor(chosen, facts.participants, { visibility, jobWorkflow }, []).filter((each) => each.available).map((each) => [recordRoute(each.route), each.route]));
    route.replaceChildren(...[...offered.keys()].map((text) => { const option = el("option", null, text); option.value = text; return option; }));
  };
  participant.addEventListener("change", fillRoutes);
  fillRoutes();
  const retry = el("button", "retry btn", "Retry");
  retry.setAttribute("type", "button");
  retry.addEventListener("click", async (event) => {
    if (!event.isTrusted || retry.disabled) return;
    const taken = offered.get(route.value) ?? [...offered.values()][0];
    if (taken === undefined) { result.textContent = `${participant.value} has no route a job takes.`; return; }
    const answer = await confirmDecision({ title: `Retry ${record.id}?`, lines: [`A new job is queued with the same inputs and parameters for ${participant.value}, on ${recordRoute(taken)}; it names ${record.id}, which stays in the list.`], confirm: "Retry the job" });
    if (!answer.confirmed) return;
    retry.disabled = true;
    try {
      const queued = await retryJob(record, { participant: holders.find((each) => each.name === participant.value), route: taken }, host, facts.snapshot.commit);
      result.textContent = `Queued as ${queued.path.match(/(JOB-[^/.]+)\.md$/)?.[1] ?? queued.path}; it names ${record.id}.`;
    } catch (failure) {
      if (failure?.name === "TaskNotInRecord") { result.textContent = "Its task is not in the record: write it again in the prompt bar."; box.append(el("p", null, barButton("retry-prompt-bar", "Open the prompt bar"))); } else {
        result.textContent = decisionFailure(failure);
        retry.disabled = false;
      }
    }
  });
  box.append(el("p", null, el("label", null, "Participant ", participant), " ", el("label", null, "Route ", route), " ", retry), result);
  return box;
}

const decisionFailure = (failure) => (failure?.name === "Moved" ? "The product changed meanwhile: nothing was written. Open the job again." : `${String(failure?.message ?? failure)} — nothing was written.`);

// ---------------------------------------------------------------- a gate the job waits at (UC-034 step 7, 7a)
//
// Where the texts leave a reading open, this file takes the one it names:
//   - The person is named as the product's stored token names them (its `name`), as the prompt bar names the person who starts a job; the name is the decider of the record, its kind `person`.
//   - The job's role assignment is the team's whose sprint holds the job's item (the facts' `held`), else the one role assignment of a product without sprints; the participant whose work the gate
//     checks is the job's participant. A gate decided by a CI check is decided by that check, and gets no buttons.
//   - `on` of the record is the job's inputs (`<path>@<blob>`), else the head commit the facts were read at.

function assignmentOf(record, facts, workflow) {
  const item = record.worksOn.find((each) => facts.plan.states.some((state) => state.item === each));
  const held = item === undefined ? undefined : facts.held.find((each) => each.item === item);
  if (held) return facts.assignments.find((each) => each.path.endsWith(`/${held.team}.md`)) ?? null;
  return workflow?.model?.flow?.sprints !== true && facts.assignments.length === 1 ? facts.assignments[0] : null;
}

function personOf(store, product) {
  try {
    const name = readSetting(store, tokenKeyOf(parseAddress(product)))?.name;
    return typeof name === "string" && name ? name : null;
  } catch { return null; }
}

// What the page says of a gate decision's failure.
const gateFailure = (failure) => (failure?.name === "Moved" ? "The product changed meanwhile: nothing was written. Open the job again, since the gate may have been decided." : `${String(failure?.message ?? failure)} — nothing was written.`);

async function gateDecision(context, held, read, gate) {
  const box = el("div", "gate-decision");
  const { record } = held;
  const host = read.hostOf.get(held.product);
  let facts;
  try {
    const instanceHost = context.instance.host;
    const snapshot = await instanceHost.readSnapshot((await instanceHost.repositoryInfo()).defaultBranch);
    facts = await productFacts(host, snapshot, (commit) => instanceHost.readSnapshot(commit), new Date(), { scope: "work" });
  } catch (failure) {
    box.append(el("p", "warn gate-unreadable", `The gate could not be read: ${String(failure?.message ?? failure)}`));
    return box;
  }
  const workflow = facts.workflow === "unknown" ? null : facts.workflow;
  const named = workflow?.gates.find((each) => each.name === gate.gate);
  if (!named || /^check:/.test(named.decider)) return box;
  box.append(el("p", "gate-checks", `It checks: ${named.condition}`), el("p", "gate-examine", `To examine: ${named.artifacts}`));
  const assignment = assignmentOf(record, facts, workflow);
  const person = personOf(context.store, held.product);
  const pass = el("button", "gate-pass btn primary", "Pass gate"), reject = el("button", "gate-reject btn", "Reject");
  for (const button of [pass, reject]) button.setAttribute("type", "button");
  const result = el("p", "gate-result");
  box.append(el("p", null, pass, " ", reject), result);
  const may = assignment === null || person === null ? null : mayDecide({ name: person, kind: "person" }, gate.gate, workflow, assignment, record.participant ? [record.participant] : []);
  if (!may?.may) {
    pass.disabled = true;
    reject.disabled = true;
    const why = assignment === null ? "this job has no role assignment to decide it in" : person === null ? "this browser stores no token that names you" : may.reason;
    const holders = may?.holders ?? [];
    box.append(el("p", "gate-unavailable", `Only a holder of the role ${named.decider} decides this gate${holders.length ? `; its holders are ${holders.join(", ")}` : ""}. You cannot decide it: ${why}.`));
    return box;
  }
  const decide = async (decision, title, confirm, lines, withReason) => {
    const answer = await confirmDecision({ title, lines, confirm, reason: withReason });
    if (!answer.confirmed) return;
    pass.disabled = true;
    reject.disabled = true;
    try {
      await recordGateDecision(host, { gate: gate.gate, job: record.id, decider: { name: person, kind: "person" }, role: named.decider, decision, reason: withReason ? answer.reason : null,
        on: record.inputs.length ? record.inputs : [facts.snapshot.commit] },
      { workflow, assignment, workBy: record.participant ? [record.participant] : [], head: facts.snapshot.commit, now: new Date(), trailers: [] });
      result.textContent = `The gate ${gate.gate} was ${decision} by ${person}; the job's route resumes or ends the job when it notices the record.`;
    } catch (failure) {
      result.textContent = gateFailure(failure);
      pass.disabled = false;
      reject.disabled = false;
    }
  };
  pass.addEventListener("click", (event) => {
    if (event.isTrusted && !pass.disabled) decide("passed", `Pass ${gate.gate}?`, "Pass the gate", [`${person} passes the gate ${gate.gate} for ${record.id}, as a holder of ${named.decider}.`, "The decision is recorded in the product's repository."], false);
  });
  reject.addEventListener("click", (event) => {
    if (event.isTrusted && !reject.disabled) decide("rejected", `Reject ${gate.gate}?`, "Reject the gate", [`${person} rejects the gate ${gate.gate} for ${record.id}. A rejection needs its reason.`], true);
  });
  return box;
}

// What the job left in its product (UC-036 step 4): the commits of its branch, its pull request and the CI runs of those commits, read through MOD-runtimes' jobTrail. A trail that cannot be read is said so;
// the rest of the page stands.
async function trailSection(held, read) {
  const box = el("div", "job-trail");
  let trail;
  try {
    trail = await jobTrail(held.record, { host: read.hostOf.get(held.product) });
  } catch (failure) {
    box.append(el("p", "warn job-trail-problem", `What the job left in its product could not be read: ${String(failure?.message ?? failure)}`));
    return box;
  }
  const link = (className, address, text) => { const anchor = el("a", className, text); anchor.setAttribute("href", address); anchor.setAttribute("target", "_blank"); anchor.setAttribute("rel", "noopener"); return anchor; };
  box.append(el("h3", null, "Commits"));
  box.append(trail.commits.length ? el("ul", "job-commits", ...trail.commits.map((entry) => el("li", "job-commit", `${entry.commit.slice(0, 12)} ${String(entry.message).split("\n")[0]} (${entry.date})`)))
    : el("p", "job-commits-none", "No commits yet."));
  box.append(el("h3", null, "Pull request"));
  box.append(trail.pullRequest ? el("p", "job-pull-request", `#${trail.pullRequest.number} ${trail.pullRequest.title} — ${trail.pullRequest.state} `, link("pull-link", trail.pullRequest.url, "Open"))
    : el("p", "job-pull-request", "No pull request."));
  box.append(el("h3", null, "CI runs"));
  box.append(trail.runs.length ? el("ul", "job-runs", ...trail.runs.map((each) => el("li", "job-run", `${each.workflow} — ${each.state} `, link("run-link", each.url, "Open"))))
    : el("p", "job-runs-none", "No CI runs."));
  return box;
}

// A commit the job made after its cancel is flagged, with Revert beside the commits (UC-036 6a): MOD-runtimes' liveState reports them, revertAfterCancel reverts them in one commit on the job's branch. Revert is one click through the
// frame's dialog of a decision, on the person's click alone; it reverts all the commits flagged. The branch's head is read just before, and a branch that moved meanwhile is told, with nothing written.
async function afterCancelSection({ record, product }, read) {
  const host = read.hostOf.get(product);
  let commits;
  try {
    commits = (await liveState(record, { host }, read.bridges)).writtenAfterCancel;
  } catch {
    return el("div", "job-after-cancel-none");
  }
  if (commits.length === 0) return el("div", "job-after-cancel-none");
  const result = el("p", "job-revert-result");
  const revert = el("button", "job-revert btn", "Revert");
  revert.setAttribute("type", "button");
  revert.addEventListener("click", async (event) => {
    if (!event.isTrusted) return;
    const decision = await confirmDecision({ title: `Revert the commits written after the cancel of ${record.id}?`, lines: [`One commit on the branch ${record.id} gives back every file these ${commits.length} commit${commits.length === 1 ? "" : "s"} changed its text from before them.`, ...commits.map((commit) => commit.slice(0, 12))], confirm: "Revert the commits" });
    if (!decision.confirmed) return;
    revert.disabled = true;
    try {
      const [{ commit: head }] = await host.readHistory(null, { ref: record.id, limit: 1, changes: false });
      const { commit } = await revertAfterCancel(record, { host }, commits, head);
      result.textContent = `Reverted in ${commit.slice(0, 12)}.`;
    } catch (failure) {
      revert.disabled = false;
      result.textContent = failure?.name === "Moved" ? "The branch moved meanwhile: nothing was written. Read the page again." : `The commits could not be reverted: ${String(failure?.message ?? failure)}`;
    }
  });
  return el("section", "job-after-cancel", el("h3", null, "Written after the cancel"), el("ul", null, ...commits.map((commit) => el("li", "job-after-cancel-commit", `${commit.slice(0, 12)} was written after the cancel`))), el("p", null, revert), result);
}

// A job shown as cancelling is read again later, while its page stands (UC-036 6a).
const AGAIN = 5000;
function readAgainLater(page, target, context, params) {
  setTimeout(() => { if (page.parentNode !== null) renderJob(target, context, params); }, AGAIN);
}

// Cancel: one click, through the frame's dialog of a decision (ONE CLICK PER DECISION), on the person's click alone (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK). MOD-runtimes' cancelJob appends the end
// cancelled once the runtime confirms; on "cancelling" nothing is appended and the job is shown cancelling; on Moved the record is read again.
function cancelControls(target, context, params, held, read) {
  const { record } = held;
  const button = el("button", "job-cancel btn", "Cancel");
  button.setAttribute("type", "button");
  button.addEventListener("click", async (event) => {
    if (!event.isTrusted) return;
    const decision = await confirmDecision({ title: `Cancel ${record.id}?`, lines: [`${record.id} is stopped at its runtime. Its end, cancelled, is written once the runtime confirms.`, "Whatever it pushed before stays on its branch."], confirm: "Cancel the job" });
    if (!decision.confirmed) return;
    button.disabled = true;
    let note;
    try {
      const outcome = await cancelJob(record, { host: read.hostOf.get(held.product) }, read.bridges);
      if (outcome === "cancelling") { CANCELLING.add(record.id); note = "The runtime has not confirmed yet: the job is cancelling, and nothing is written until it does."; } else note = "Cancelled.";
    } catch (failure) {
      note = failure?.name === "Moved" ? "The record changed meanwhile; it is read again, and nothing was written by this click." : `The job could not be cancelled: ${String(failure?.message ?? failure)}`;
    }
    await renderJob(target, context, params, note);
  });
  return el("p", "job-actions", button);
}

/**
 * job: Route — { name: "job", entry: null, title: "Job", render }; `params.id` names the job, `params.product` (where given) the product that holds it.
 */
export const job = { name: "job", entry: null, title: "Job", render: (target, context, params) => renderJob(target, context, params), subject: (params) => subjectOf(params) };
