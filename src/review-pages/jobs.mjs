// jobs.mjs — preparing, starting and following the drafting jobs of a kind (MOD-review-pages, Parts): the page `<route>/id=draft` of a kind whose descriptor names a
// kind of job to draft it (`draft`), and the notes of the job that wrote an open file, shown beside it. For use cases (UC-007): the requirements to cover, the
// participants that can draft text with where each processes data and its routes, the run panel and Run; a job on the tab's route runs here, attended, and
// writes its files open at once; a job on another route is queued there.
//
// Module: MOD-review-pages
//
// ONE CLICK PER DECISION; THE PAGE STATES WHAT IT SENDS WHERE; A GENERATED ARTIFACT IS A PROPOSAL; THE ROUNDS ARE COUNTED AND SHOWN; THE DASHBOARD WRITES ONLY ON A
// PERSON'S CLICK. Nothing is written or sent while the page is drawn or while the run panel is shown: Run, the panel's own button, is the one click that starts the
// job. The job's record is written in the product's repository.

import { readSetting } from "../browser-store/index.mjs";
import { bridgeAt, settingsOf } from "../bridge-client/index.mjs";
import { readDocument } from "../documents/index.mjs";
import { newJobId, recordsNewestFirst } from "../job-ledger/index.mjs";
import { kindOf } from "../job-catalogue/index.mjs";
import { prepareJob, writeResult } from "../job-runner/index.mjs";
import { approvalStrategies, statuses } from "../approvals/index.mjs";
import { differs, eligible, participantSchema, participantsOf } from "../participant-list/index.mjs";
import { linkedVersion, restrictedPlaces } from "../source-register/index.mjs";
import { queueJob, routesFor, runOnTab } from "../runtimes/index.mjs";
import { parseSpec } from "../spec-document/index.mjs";
import { runPanel, explain, readProblem } from "../site-frame/index.mjs";
import { coverageGaps, latestGraph, storedGraph } from "../trace-graph/index.mjs";
import { editedResult, flagged, passagesLine, shownOnPanel, showCurrent, splitCandidate, splitProblem } from "./candidates.mjs";
import { defaultSnapshot, el, button, link, reviewLink, refusalText, tokenStep } from "./common.mjs";
import { dueDiligenceSection, roundsSection, splitDueDiligence } from "./sections.mjs";
import { sourcesOf } from "./spec-entries.mjs";

const REGISTER = "docs/participants.md";
const WORKFLOWS = [".github/workflows/agent-m-jobs.yml", ".gitlab/agent-m-jobs.yml"];
const JOB_FILE = /^docs\/jobs\/(JOB-[^/]+)\.md$/;

// The route as a job's record writes it: `tab`, `ci hosted`, `ci runner:<label>`, `bridge <name>`.
const recordRoute = (route) => (route.kind === "tab" ? "tab" : route.kind === "ci" ? (route.runner === "hosted" ? "ci hosted" : `ci runner:${route.runner}`) : `bridge ${route.bridge}`);

// The endpoints of the participants as the tab's route calls them: the configuration the page stored for each, and whether it is reached through a Bridge.
export function connectionsOf(participants, store) {
  const endpoints = {}, bridges = {};
  const connectBridge = (name) => {
    if (!name || bridges[name]) return;
    const stored = readSetting(store, `bridge:${name}`);
    if (stored) bridges[name] = bridgeAt(settingsOf({ name, ...stored }, readSetting(store, "jump-host")));
  };
  for (const participant of participants) {
    const name = /^endpoint\s+(\S+)/.exec(participant.route ?? "")?.[1];
    const stored = name === undefined ? null : readSetting(store, `endpoint:${name}`);
    if (stored) {
      endpoints[name] = { config: { name, kind: stored.kind, baseUrl: stored.url, model: stored.model, key: stored.key ?? null }, bridge: stored.bridge ?? null };
      connectBridge(stored.bridge);
    }
    connectBridge(/^bridge\s+(\S+)\s+agent\s+\S+/.exec(participant.route ?? "")?.[1]);
  }
  return { endpoints, bridges };
}

/**
 * loadStage(where, jobKind, instance?) -> { definition, participants, instanceSnapshot, product, needs, drafters } — what a page that starts a job of `jobKind` shows before it: the kind, the
 * participants of the instance's register that can do what the kind needs, and what the product allows of a route. `instance`, the instance at its default branch where the page has read it
 * already, is not read again.
 */
export async function loadStage(where, jobKind, instance = null) {
  const { snapshot, host, context } = where;
  const definition = await kindOf(jobKind);
  const instanceSnapshot = instance ?? (context.product ? await defaultSnapshot(context.instance.host) : snapshot);
  const register = await instanceSnapshot.read(REGISTER);
  const participants = register === null ? [] : participantsOf(readDocument(participantSchema(), REGISTER, register));
  const info = await host.repositoryInfo();
  const product = { visibility: info.visibility, jobWorkflow: WORKFLOWS.some((path) => snapshot.paths.includes(path)) };
  const needs = definition.resources === "none" ? [] : [];
  return { definition, participants, instanceSnapshot, product, needs, drafters: eligible(participants, { capabilities: definition.needs }).eligible };
}

/** participantList(drafters, participants, product, needs, role) -> Element — each of the drafters (of the instance's participants) that can draft with where it processes data and its routes, a radio to choose it; `role` is "participant", or "reviewer" for the reviewing participant of a derivation. */
export function participantList(drafters, participants, product, needs, role = "participant") {
  const offered = el("ul", `${role}s`);
  for (const participant of drafters) {
    const box = el("input", role);
    box.type = "radio";
    box.name = role;
    box.value = participant.name;
    const route = el("span", "route");
    const offers = routesFor(participant, participants, product, needs);
    route.append(offers.length ? offers.map((offer) => `${recordRoute(offer.route)}${offer.available ? "" : " — not available"}`).join(", ") : "no route of a job");
    const item = el("li", role, el("label", null, box, ` ${participant.name} `), el("span", "place", participant.place ?? "no processing place declared"), " ", route);
    for (const offer of offers) if (!offer.available) item.append(" ", el("span", "reason", offer.reason));
    item.setAttribute("data-name", participant.name);
    offered.append(item);
  }
  return offered;
}

// The names of the requirements of the head's SPEC, sorted: from the graph where it is the head's own, else — a graph of an earlier commit, or none — from the head's SPEC.md,
// which states them; the head's statement is never taken from an earlier graph.
async function requirementNames(graph, snapshot) {
  if (graph && graph.commit === snapshot.commit) return [...graph.nodes.values()].filter((node) => node.kind === "requirement").map((node) => node.id).sort();
  return [...parseSpec((await snapshot.read("SPEC.md")) ?? "").requirements.keys()].sort();
}

/**
 * showDraft(where, kind) — the drafting page of a kind: its selection, its participants, the run panel and the result of a run. `where` is the flow's: the
 * host and snapshot of the product (or of the instance itself), the token, the context and the target.
 */
export async function showDraft(where, kind) {
  if (kind.whole) return showArchitectureDraft(where, kind);
  if (kind.draft === "derive-requirements") return showRequirementsDraft(where, kind);
  const { target, snapshot, token, host, context } = where;
  target.append(el("h2", null, `Draft ${kind.plural}`), explain(kind.explain.draft.requirements), reviewLink(context, `#${kind.route}`, "btn", `All ${kind.plural}`));
  let graph, line, names, loaded;
  try {
    ({ graph, line } = await latestGraph(snapshot, snapshot.commit));
    names = await requirementNames(graph, snapshot);
    loaded = await loadStage(where, kind.draft);
  } catch (failure) {
    target.append(readProblem(failure, Boolean(token)));
    return;
  }
  const { definition, participants, instanceSnapshot, product, needs, drafters } = loaded;
  // The default selection comes from the graph shown; where it is the graph stored last, the line above says so.
  const uncovered = new Set(coverageGaps(graph).requirementsWithoutUseCase);
  if (line) target.append(el("p", "muted graph-as-of", line));
  const list = el("ul", "requirements");
  for (const name of names) {
    const box = el("input", "requirement");
    box.type = "checkbox";
    box.value = name;
    box.checked = uncovered.has(name);
    list.append(el("li", null, el("label", null, box, ` ${name}`)));
  }
  target.append(el("section", "to-cover", el("h3", null, "Requirements to cover"), list));

  const offered = participantList(drafters, participants, product, needs);
  target.append(el("section", "drafters", el("h3", null, "Drafting participant"), explain(kind.explain.draft.participant), offered));

  const stage = el("section", "stage");
  if (!token) {
    target.append(el("p", "problem", "A job is recorded and its result written with your token. ", tokenStep(context)), stage);
    return;
  }
  const prepare = button("btn prepare", "Show the run panel");
  prepare.addEventListener("click", async () => {
    stage.replaceChildren();
    const chosen = drafters.find((participant) => byClassChecked(offered, participant.name));
    if (!chosen) { stage.append(el("p", "problem", "Choose the participant that drafts.")); return; }
    const selected = inputsOf(list, "requirement").filter((box) => box.checked).map((box) => box.value);
    await panelOf({ ...where, definition, kind, jobKind: kind.draft, params: { requirements: selected }, worksOn: selected, present: presentDraft, chosen, participants,
      instanceSnapshot, product, needs, stage });
  });
  target.append(prepare, stage);
}

// The inputs of a class under a node, in the order they stand.
const inputsOf = (root, className) => {
  const walk = (node) => [...node.childNodes].flatMap((kid) => (kid.nodeType === 1 ? [kid, ...walk(kid)] : []));
  return walk(root).filter((node) => node.localName === "input" && node.className.split(" ").includes(className));
};
export const byClassChecked = (list, name, role = "participant") => inputsOf(list, role).some((box) => box.value === name && box.checked);

export async function preparedRun(run, snapshot = run.snapshot, params = run.params) {
  const { context, token, host, definition, chosen, participants, instanceSnapshot } = run;
  const now = new Date();
  const taken = new Set(snapshot.paths.map((path) => JOB_FILE.exec(path)?.[1]).filter(Boolean));
  const id = newJobId(now, taken);
  const agentM = { version: instanceSnapshot.commit ?? "unknown", commit: instanceSnapshot.commit ?? "unknown" };
  const jobContext = { kind: definition, params, product: { address: snapshot.repository?.web ?? "", snapshot, host },
    instance: { snapshot: instanceSnapshot, host: context.product ? context.instance.host : host, checkout: null }, connect: async () => host, participants,
    places: run.places ?? { sources: {}, mailbox: null }, gates: [], person: token.name, now, agentM, jobId: id };
  let prepared = await prepareJob(run.jobKind, jobContext, { drafter: chosen, reviewers: run.reviewers ?? [] });
  if (run.relax) prepared = run.relax(prepared);
  const offer = routesFor(chosen, run.participants, run.product, run.needs)[0];
  return { ...run, snapshot, params, prepared, jobContext, id, now, agentM, offer };
}

// The run panel for the chosen participant and selection; Run starts the job. A failure of the preparation is shown as the route names it (`problemOf`), else as the frame's readProblem.
export async function panelOf(run) {
  const { stage, token, kind } = run;
  let ready;
  try {
    ready = await preparedRun(run);
  } catch (failure) {
    stage.append(run.problemOf?.(failure) ?? readProblem(failure, Boolean(token)));
    return;
  }
  const panel = runPanel(ready.prepared, { onRun: () => start(ready) });
  // What the panel names besides, the view shows with it (MOD-site-frame's runPanel): on the server's runners, that the agent's calls are billed per use (UC-010, Precondition).
  if (ready.offer?.route.kind === "ci" && ready.offer.route.runner === "hosted") {
    panel.append(el("p", "route-billing", `The job runs on the route ${recordRoute(ready.offer.route)}, on the server's runners: the calls are billed per use by the agent's provider.`));
  }
  run.decoratePanel?.(panel, ready.prepared);
  stage.append(explain(kind.explain.draft.panel), panel);
}

/** startRecord(run) -> the start record of the job a run of `preparedRun` prepared, on the route its offer names, for MOD-runtimes' queueJob. */
export function startRecord(run) {
  const { token, prepared, id, now, agentM, offer, chosen, params, worksOn } = run;
  return { id, kind: run.jobKind, worksOn, participant: chosen.name, model: chosen.model, route: recordRoute(offer.route), run: null, retries: null,
    startedBy: token.name, start: now, agentM, inputs: prepared.parts.map((part) => part.name), limit: prepared.limit,
    destinations: prepared.destinations.map((each) => ({ participant: each.participant.name, place: each.place, parts: each.parts })), params };
}

async function execute(run, refine) {
  const { host, snapshot, prepared, offer } = run;
  if (!offer || !offer.available) throw Object.assign(new Error(offer ? offer.reason : "the participant has no route of a job"), { name: "RouteUnavailable" });
  const record = startRecord(run);
  const { path } = await queueJob(host, record, offer.route, snapshot.commit);
  if (offer.route.kind !== "tab") return { queued: true, record };
  const acting = [prepared.drafter, ...prepared.reviewers].filter(Boolean);
  const outcome = await runOnTab(prepared, run.jobContext, connectionsOf(acting, run.context.store), { host, record: { ...record, path }, refine });
  return { queued: false, outcome, record };
}

async function start(run) {
  const { stage, kind, id } = run;
  const result = el("section", "job");
  stage.append(result);
  try {
    const executed = await execute(run);
    if (executed.queued) {
      result.append(el("p", "queued", `Job ${id} is queued on the route ${recordRoute(run.offer.route)}; it is not run in this tab.`), explain(kind.explain.draft.ci));
      return;
    }
    await run.present(executed.outcome, result, { ...run, record: executed.record });
  } catch (failure) {
    result.append(el("p", "result problem", `${failure.name}: ${failure.message}`));
  }
}

// What a run of the drafting job came to, as the architecture's draft shows it: the rounds, each with its findings, what the loop left, and the files written.
async function presentDraft(outcome, result, run) {
  const { kind, context } = run;
  result.append(el("p", "rounds", `Correction rounds: ${outcome.rounds.length}`), explain(kind.explain.draft.loop));
  if (outcome.rounds.length) result.append(roundsSection(outcome.rounds, outcome.stoppedBecause));
  const written = el("ul", "written");
  for (const file of outcome.written?.files ?? []) written.append(el("li", null, file));
  result.append(findingsList("left", outcome.remaining), written, explain(kind.explain.draft.written), reviewLink(context, `#${kind.route}`, null, `All ${kind.plural}`));
}

// The job records are asked for through the snapshot's readMany, newest first, a hundred at a time (A PAGE LOAD READS THE REPOSITORY IN BATCHES: "at most 100 files each"), each batch only
// when the search has read the one before it.
const BATCH = 100;

/**
 * newestJobRecords(snapshot) -> AsyncIterable<JobRecord> — MOD-job-ledger's recordsNewestFirst over the snapshot, the records asked for in batches as the search reaches them: a caller that
 * stops at the record it needs leaves every later batch unasked.
 */
export function newestJobRecords(snapshot) {
  const order = snapshot.paths.filter((path) => /^docs\/jobs\/JOB-/.test(path)).sort().reverse();
  const asked = new Set();
  const read = async (path) => {
    if (!asked.has(path) && typeof snapshot.readMany === "function") {
      const batch = order.slice(Math.max(0, order.indexOf(path)), order.indexOf(path) + BATCH);
      for (const each of batch) asked.add(each);
      try { await snapshot.readMany(batch); } catch { /* each record's own read below meets the failure */ }
    }
    return snapshot.read(path);
  };
  return recordsNewestFirst({ paths: order, read });
}

/**
 * jobNotes(snapshot, id, path) -> Promise<string[]> — the notes of the end of the job that wrote the file `id` at `path` (`note: …` lines of its results that name `id`): what a
 * drafting job did to a use case it wrote — a realised name it removed, a use case that realises none. The records are read newest first, in batches, no further than the batch of the
 * first whose end lists `file <path>`; for a file no end lists, all records are read, and the notes of every end that name `id` are given.
 */
export async function jobNotes(snapshot, id, path) {
  const noteLines = (record) => (record.end?.results ?? []).filter((line) => line.startsWith("note: ") && line.includes(id)).map((line) => line.slice("note: ".length));
  const found = [];
  try {
    for await (const record of newestJobRecords(snapshot)) {
      if ((record.end?.results ?? []).includes(`file ${path}`)) return noteLines(record);
      found.push(...noteLines(record));
    }
  } catch { /* a record that cannot be read ends the search with what was found */ }
  return found;
}

// ---------------------------------------------------------------- deriving requirements from a linked source (UC-005)

const cleanCell = (value) => String(value ?? "").trim().replace(/^`|`$/g, "");
const sourceRowsOf = (links) => links.sections.flatMap((section) => section.rows ?? []);
const sourceTitle = (entry) => String(entry.fields?.title ?? entry.title ?? entry.id);
function sourceExplain(topic) {
  const found = explain(topic);
  if (found.childNodes.length) return found;
  return el("details", "explain", el("summary", null, "What is this?"),
    el("p", null, "Choose the linked source version and the files of that version that the participant should receive."));
}

async function requirementSourceChoices(where) {
  const { links, register } = await sourcesOf(where);
  return sourceRowsOf(links).map((row) => {
    const id = cleanCell(row.cells.Source);
    const linked = linkedVersion(links, register, id);
    if (!linked) return null;
    return { id, title: sourceTitle(linked.source), part: cleanCell(row.cells.Part), version: linked.version, source: linked.source };
  }).filter(Boolean);
}

function sourceChoiceList(choices) {
  const list = el("ul", "sources");
  for (const [at, choice] of choices.entries()) {
    const radio = el("input", "source");
    radio.type = "radio";
    radio.name = "source";
    radio.value = choice.id;
    radio.checked = at === 0;
    const files = el("ul", "source-files");
    for (const file of choice.version.files.filter((each) => each.stored)) {
      const box = el("input", "source-file");
      box.type = "checkbox";
      box.value = file.name;
      box.checked = true;
      files.append(el("li", null, el("label", null, box, ` ${file.name}`)));
    }
    const item = el("li", "source", el("label", null, radio, ` ${choice.id} - ${choice.title}`),
      choice.part ? el("span", "part", ` part: ${choice.part}`) : "", files);
    item.setAttribute("data-source", choice.id);
    list.append(item);
  }
  return list;
}

function chosenSource(choices, list) {
  const id = inputsOf(list, "source").find((box) => box.checked)?.value ?? choices[0]?.id;
  const choice = choices.find((each) => each.id === id) ?? choices[0];
  const item = [...list.childNodes].find((node) => node.nodeType === 1 && node.getAttribute("data-source") === choice.id);
  const selected = inputsOf(item, "source-file").filter((box) => box.checked).map((box) => box.value);
  return { choice, selected, stored: choice.version.files.filter((file) => file.stored).map((file) => file.name) };
}

async function showRequirementsDraft(where, kind) {
  const { target, token, context } = where;
  target.append(el("h2", null, "Derive requirements"), sourceExplain(kind.explain.draft.source), reviewLink(context, `#${kind.route}`, null, `All ${kind.plural}`));
  let loaded, choices;
  try {
    loaded = await loadStage(where, kind.draft);
    choices = await requirementSourceChoices({ ...where, instanceSnapshot: loaded.instanceSnapshot });
  } catch (failure) {
    target.append(readProblem(failure, Boolean(token)));
    return;
  }
  const { definition, participants, instanceSnapshot, product, needs, drafters } = loaded;
  if (choices.length === 0) {
    target.append(el("p", "problem", "The product links no source whose version can be read."));
    return;
  }
  const sources = sourceChoiceList(choices);
  target.append(el("section", "source-selection", el("h3", null, "Linked source"), sources));

  const offered = participantList(drafters, participants, product, needs);
  target.append(el("section", "drafters", el("h3", null, "Drafting participant"), explain(kind.explain.draft.participant), offered));

  const stage = el("section", "stage");
  if (!token) {
    target.append(el("p", "problem", "A job is recorded and its result written with your token. ", tokenStep(context)), stage);
    return;
  }
  const prepare = button("btn prepare", "Show the run panel");
  prepare.addEventListener("click", async () => {
    stage.replaceChildren();
    const chosen = drafters.find((participant) => byClassChecked(offered, participant.name));
    if (!chosen) { stage.append(el("p", "problem", "Choose the participant that drafts.")); return; }
    const picked = chosenSource(choices, sources);
    if (!picked.selected.length) { stage.append(el("p", "problem", "Choose at least one file of the source version.")); return; }
    const part = picked.selected.length < picked.stored.length ? picked.selected : undefined;
    const params = { source: picked.choice.id, ...(part ? { part } : {}) };
    const worksOn = [picked.choice.id];
    const decoratePanel = (panel, prepared) => {
      const count = prepared.parts.find((part_) => part_.recipe === "spec-with-queues")?.artifacts?.length ?? 0;
      panel.append(el("p", "requirements-included", `${count} existing requirements included.`));
    };
    const problemOf = (failure) => (failure?.name === "HashMismatch" ? changedSource(failure, picked.choice) : null);
    await panelOf({ ...where, definition, kind, jobKind: kind.draft, params, worksOn, present: presentRequirements, chosen, participants,
      instanceSnapshot, product, needs, stage, decoratePanel, problemOf });
  });
  target.append(prepare, stage);
}

// UC-005 1a: a file whose bytes no longer match the SHA-256 its version records (MOD-source-register's HashMismatch { file, expected, actual }) is named as changed, with the link to the
// library's entry of its source, where a new version is registered (UC-016); nothing has been sent. A file the chosen version does not hold names no source, and the link is to the library.
function changedSource(failure, choice) {
  const holds = choice.version.files.some((file) => file.name === failure.file);
  return el("p", "problem changed-source",
    `The content of ${failure.file}${holds ? ` of ${choice.id} ${choice.version.version}` : ""} changed: its SHA-256 is ${failure.actual}, not the ${failure.expected} its version records. `,
    "Nothing is sent. A new version must be registered (UC-016): ",
    link(holds ? `#library/source=${encodeURIComponent(choice.id)}` : "#library", "new-version", holds ? `Register a new version of ${choice.id}` : "Register a new version"));
}

function classOptions(value) {
  const select = el("select", "class");
  for (const name of ["new", "change", "duplicate", "conflict"]) {
    const option = el("option", null, name);
    option.value = name;
    if (name === value) option.selected = true;
    select.append(option);
  }
  select.value = value;
  return select;
}

async function linkedSourceInfo(where) {
  const { links, register } = await sourcesOf(where);
  const byName = (name) => linkedVersion(links, register, name);
  return { byName, register };
}

function candidateClass(candidate, classes) {
  const found = classes?.find((each) => each.refs?.includes(candidate.name));
  return found ?? { refs: [candidate.name], from: [candidate.passage].filter(Boolean), class: candidate.class, of: candidate.of ?? null };
}

// One candidate: its class and the requirement it refers to, its rule, the mark when it constrains the process (UC-005 5b), who is normative in a conflict (7a), and the current text of the requirement it
// refers to beside it. `linked` is its source as the product links it; `parsed` the SPEC of the panel's snapshot, `register` the instance's sources, `onClass` called when its class is changed.
function candidateItem(candidate, decided, linked, { parsed, register, onClass, flagged: named }) {
  const item = el("li", "candidate");
  item.setAttribute("data-name", candidate.name);
  const select = classOptions(decided.class);
  select.addEventListener("change", onClass);
  item.append(el("span", "candidate-name", candidate.name), " ", select, " of ");
  const of = el("input", "of");
  of.value = decided.of ?? "";
  const current = el("section", "current-requirement");
  const refresh = () => showCurrent(current, parsed.requirements.get(of.value.trim()), register);
  of.addEventListener("input", refresh);
  refresh();
  item.append(of, el("p", "candidate-rule", candidate.rule), passagesLine(decided));
  if (candidate.constrains === "process") item.append(el("p", "constrains-process", "Constrains the process."));
  if (decided.class === "conflict" && linked?.source?.fields?.authority) {
    item.append(el("p", "normative", `${linked.source.id} is ${linked.source.fields.authority}.`));
  }
  item.append(current);
  if (named) {
    const split = button("btn split", "Split");
    split.addEventListener("click", () => splitCandidate(item, candidate, onClass));
    item.append(split);
  }
  return item;
}

async function presentRequirements(outcome, result, run) {
  const candidates = (Array.isArray(outcome.draft?.candidates) ? outcome.draft.candidates : []).filter((candidate) => shownOnPanel(candidate, outcome.classes));
  const classes = candidates.map((candidate) => candidateClass(candidate, outcome.classes));
  const linked = await linkedSourceInfo(run);
  const parsed = parseSpec((await run.snapshot.read("SPEC.md")) ?? "");
  const panel = el("section", "requirements-result", el("h3", null, "Requirement candidates"),
    el("p", "rounds", `Correction rounds: ${outcome.rounds.length}`), explain(run.kind.explain.draft.loop));
  const left = el("ul", "left");
  for (const finding of outcome.remaining) left.append(el("li", "left", `${finding.rule}: ${finding.what} - ${finding.fix}`));
  panel.append(left);

  // UC-005 7b: while every candidate's class is duplicate, the panel says that writing only adds sources.
  const duplicates = el("div", "duplicates");
  const sayDuplicates = () => {
    const classes = elementsOf(panel, "select", "class").map((select) => select.value);
    duplicates.replaceChildren(...(classes.length && classes.every((name) => name === "duplicate")
      ? [el("p", "all-duplicates", "Every candidate is a duplicate: writing only adds sources to existing requirements.")] : []));
  };
  panel.append(duplicates);

  const groups = new Map();
  for (const candidate of candidates) {
    const decided = candidateClass(candidate, classes);
    if (!groups.has(decided.class)) groups.set(decided.class, []);
    groups.get(decided.class).push({ candidate, decided });
  }
  for (const [name, entries] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    const list = el("ul", "candidates");
    for (const { candidate, decided } of entries) list.append(candidateItem(candidate, decided, linked.byName(candidate.source ?? run.params?.source), { parsed, register: linked.register, onClass: sayDuplicates, flagged: flagged(outcome.remaining, candidate) }));
    const section = el("section", "candidate-group", el("h4", null, name), list);
    section.setAttribute("data-class", name);
    panel.append(section);
  }

  sayDuplicates();

  const unlinked = candidates.filter((candidate) => candidate.source && !linked.byName(candidate.source));
  if (unlinked.length) {
    panel.append(el("section", "unlinked-candidates", el("h4", null, "Link first"),
      el("ul", null, ...unlinked.map((candidate) => el("li", null, `${candidate.name}: ${candidate.source} is not linked; link the source first.`)))));
  }

  const status = el("div", "draft-actions");
  const write = button("btn write-proposals", "Write proposals");
  write.addEventListener("click", async () => {
    write.disabled = true;
    status.replaceChildren();
    const unfinished = splitProblem(panel);
    if (unfinished) {
      write.disabled = false;
      status.append(el("p", "result problem", unfinished));
      return;
    }
    try {
      const info = await run.host.repositoryInfo();
      const snapshot = await run.host.readSnapshot(info.defaultBranch);
      const context = { ...run.jobContext, product: { ...run.jobContext.product, snapshot } };
      const edited = editedResult(panel, outcome);
      const written = await writeResult(run.prepared, edited.draft, { result: { ...outcome, classes: edited.classes }, context });
      status.append(el("p", "written", written.files?.length ? `Written: ${written.files.join(", ")}` : "Nothing changed."));
      if (written.notes?.length) status.append(el("ul", "notes", ...written.notes.map((note) => el("li", "note", note))));
    } catch (failure) {
      write.disabled = false;
      status.append(el("p", "result problem", refusalText(failure)));
    }
  });
  panel.append(el("div", "actions", write), status);
  result.append(panel);
}

// ---------------------------------------------------------------- the architecture's derivation, up to Run (UC-022 steps 1 to 4)

const ONLY_ACCEPTED = "ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES";
const NO_REVIEWER = "NO REVIEWER IS THE DRAFTER";

// The places of the restricted sources, as MOD-source-register's restrictedPlaces gives them over every entry of the instance's register: `context` is what the job's context carries, `offered` the same
// narrowed to the sources the product links (its links file holds a row of them), which the job's parts can carry and against which the participants offered are judged.
async function placesOf(where) {
  const { links, register } = await sourcesOf(where);
  const linked = new Set(links.sections.flatMap((section) => section.rows ?? []).map((row) => String(row.cells.Source ?? "").replaceAll("`", "")));
  const all = restrictedPlaces(register, where.context.product?.address ?? where.snapshot.repository?.web ?? "");
  const context = { ...all, mailbox: null };
  return { context, offered: { sources: Object.fromEntries(Object.entries(all.sources).filter(([id]) => linked.has(id))), mailbox: null } };
}

// What the precondition `architecture-ready` found, with the way on: to an open use case's review, to the SPEC changes to decide first, to UC-023 for an existing architecture.
function readiness(found, snapshot, context) {
  const box = el("section", "readiness");
  if (!found) return box;
  box.append(el("p", `finding ${found.kind}`, `${found.kind}: ${found.what} — ${found.fix} [${found.rule}]`));
  if (found.kind === "warning") box.append(reviewLink(context, "#spec-entry", "decide-first", "Decide the open SPEC changes first (UC-006)"));
  else if (found.rule === ONLY_ACCEPTED) {
    for (const { id, kind, status } of statuses(snapshot).values()) {
      if (kind === "use-case" && status !== "accepted") box.append(" ", reviewLink(context, `#use-case/id=${encodeURIComponent(id)}`, "review-link", `Review ${id}`));
    }
  } else box.append(reviewLink(context, "#decision", "change-architecture", "Change the architecture (UC-023)"));
  return box;
}

// Why no reviewer is offered for `drafter`: no other participant that can draft text, none with another model, or none whose place the content may go to.
function noReviewer(drafter, participants, needs, places) {
  const others = eligible(participants.filter((each) => each.name !== drafter.name), { capabilities: needs }).eligible;
  if (others.length === 0) return `No participant other than ${drafter.name} can draft text, so none can review its draft.`;
  if (!others.some((each) => differs(drafter, each))) return `No other participant that can draft text uses another model than ${drafter.model ?? "the drafter's"}.`;
  return `No participant that uses another model than ${drafter.name} processes data at a place that ${Object.keys(places.sources).join(", ")} permit.`;
}

/**
 * showArchitectureDraft(where, kind) — the drafting page of the architecture (`decision/draft`): what the derivation covers, what the precondition found, the drafting and the reviewing participant,
 * the run panel and Run. Nothing is sent before Run.
 */
async function showArchitectureDraft(where, kind) {
  const { target, snapshot, token, context } = where;
  target.append(el("h2", null, "Draft the architecture"), explain(kind.explain.draft.whole), reviewLink(context, `#${kind.route}`, null, `All ${kind.plural}`));
  let requirements, loaded, places, offeredPlaces, found, reviewing;
  try {
    // What the derivation covers is the head's SPEC: from the head's graph, or, while that is not stored yet, from the head's SPEC itself — no earlier graph is shown here.
    requirements = await storedGraph(snapshot, snapshot.commit).then((graph) => requirementNames(graph, snapshot),
      (failure) => { if (failure?.name === "GraphNotStored") return requirementNames(null, snapshot); throw failure; });
    loaded = await loadStage(where, kind.draft);
    ({ context: places, offered: offeredPlaces } = await placesOf({ ...where, instanceSnapshot: loaded.instanceSnapshot }));
    found = await approvalStrategies.preconditions["architecture-ready"]({ product: { snapshot, address: snapshot.repository?.web ?? "" } });
    reviewing = await kindOf(loaded.definition.reviewer);
  } catch (failure) {
    target.append(readProblem(failure, Boolean(token)));
    return;
  }
  const { definition, participants, instanceSnapshot, product, needs } = loaded;
  const useCases = [...statuses(snapshot).values()].filter((each) => each.kind === "use-case").map((each) => each.id).sort();
  const covers = el("section", "covers", el("h3", null, "What the derivation covers"),
    el("p", null, `Every requirement of the SPEC (${requirements.length}) and every use case (${useCases.length}); nothing is selected.`));
  covers.append(el("ul", "covered", ...requirements.map((name) => el("li", "requirement", name)), ...useCases.map((id) => el("li", "use-case", id))));
  target.append(covers, readiness(found, snapshot, context));

  const placed = Object.entries(offeredPlaces.sources).map(([from, allowed]) => ({ from, allowed }));
  const drafters = eligible(participants, { capabilities: definition.needs, places: placed }).eligible;
  const reviewable = eligible(participants, { capabilities: reviewing.needs, places: placed }).eligible;
  const offered = participantList(drafters, participants, product, needs);
  const reviewers = el("div", "reviewer-choice");
  const reviewersFor = (drafter) => (drafter ? reviewable.filter((each) => differs(drafter, each)) : []);
  const drafterChosen = () => drafters.find((each) => byClassChecked(offered, each.name));
  function showReviewers() {
    const drafter = drafterChosen();
    reviewers.replaceChildren();
    if (!drafter) reviewers.append(el("p", "none", "Choose the drafting participant first; the reviewer must use another model."));
    else if (reviewersFor(drafter).length === 0) reviewers.append(el("p", "no-reviewer", noReviewer(drafter, participants, reviewing.needs, offeredPlaces)));
    else reviewers.append(participantList(reviewersFor(drafter), participants, product, needs, "reviewer"));
  }
  for (const box of inputsOf(offered, "participant")) box.addEventListener("change", showReviewers);
  showReviewers();
  target.append(el("section", "drafters", el("h3", null, "Drafting participant"), explain(kind.explain.draft.participant), offered),
    el("section", "reviewers", el("h3", null, "Reviewing participant"), explain(kind.explain.draft.reviewer), reviewers));

  const stage = el("section", "stage");
  if (!token) {
    target.append(el("p", "problem", "A job is recorded and its result written with your token. ", tokenStep(context)), stage);
    return;
  }
  const prepare = button("btn prepare", "Show the run panel");
  prepare.addEventListener("click", async () => {
    stage.replaceChildren();
    const chosen = drafterChosen();
    if (!chosen) { stage.append(el("p", "problem", "Choose the participant that drafts.")); return; }
    const candidates = reviewersFor(chosen);
    const reviewer = candidates.find((each) => byClassChecked(reviewers, each.name, "reviewer"));
    if (candidates.length && !reviewer) { stage.append(el("p", "problem", "Choose the participant that reviews.")); return; }
    // An open SPEC change is a warning the person decides on: the page names it, and Run is still offered. A missing reviewer keeps Run from being offered.
    const relax = (prepared) => ({ ...prepared, blocking: [...prepared.blocking.filter((each) => each.kind === "error"), ...(reviewer ? [] : [{ artifact: "docs/participants.md", line: 1,
      kind: "error", rule: NO_REVIEWER, what: noReviewer(chosen, participants, reviewing.needs, offeredPlaces), fix: "declare a participant that can draft text and uses another model" }])] });
    await panelOf({ ...where, definition, kind, jobKind: kind.draft, params: {}, worksOn: [...requirements, ...useCases], present: presentDerivation, chosen,
      reviewers: reviewer ? [reviewer] : [], places, relax, participants, instanceSnapshot, product, needs, stage });
  });
  target.append(prepare, stage);
}

// What a run of the derivation came to, here: that it ran. The draft that waits for the author is shown by the page that follows.
async function presentDerivation(outcome, result, run) {
  result.append(el("p", "ran", `Job ${run.id} ran in this tab.`));
  // The step asks the author to review the checked draft — its rounds and the findings left —, to change it and to write it (EVERY STEP EXPLAINS ITSELF), as the use cases' draft names `loop`.
  const shown = el("section", "architecture-result", el("h3", null, "Drafted architecture"), explain(run.kind.explain.draft.loop));
  const files = el("section", "draft-files");
  const status = el("div", "draft-actions");
  let current = outcome;

  const draftFromEditors = () => {
    const texts = new Map(elementsOf(files, "textarea", "draft-text").map((area) => [area.getAttribute("data-path"), area.value]));
    return { ...current.draft, files: (current.draft?.files ?? []).map((file) => ({ ...file, text: texts.get(file.path) ?? file.text })) };
  };
  // The text each drafted file is shown with, or was last written with: what an edit is unsaved against (UC-018 7a).
  let shownTexts = new Map();
  const textsOfEditors = () => new Map(elementsOf(files, "textarea", "draft-text").map((area) => [area.getAttribute("data-path"), area.value]));
  const showCurrentDraft = () => {
    files.replaceChildren(...(current.draft?.files ?? []).map(draftFileView));
    shownTexts = textsOfEditors();
  };
  const setStatus = (...nodes) => status.replaceChildren(...nodes);

  showCurrentDraft();
  // The route's `leave` asks through this, as it asks an editor: the same question, and a refusal keeps the page.
  run.holdEditor?.({
    unsaved: () => [...textsOfEditors()].some(([path, text]) => text !== shownTexts.get(path)),
    close() { return !this.unsaved() || confirm("Discard unsaved changes?"); },
  });
  if (outcome.stoppedBecause === "not checked") shown.append(el("p", "not-checked", "The draft is not checked because a reviewer answer could not be read."));
  if (outcome.rounds?.length) shown.append(roundsSection(outcome.rounds, outcome.stoppedBecause));
  if (outcome.remaining?.length) shown.append(findingsList("left", outcome.remaining));
  if (outcome.stepFindings?.length) shown.append(findingsList("step-findings", outcome.stepFindings));
  // UC-022 step 6: a finding only the author can decide is not sent back but shown to the author (WHAT A PERSON DECIDES IS NOT SENT BACK).
  if (outcome.forPerson?.length) shown.append(findingsList("for-person", outcome.forPerson));
  shown.append(files);

  const check = button("btn check-edit", "Check this edit");
  check.addEventListener("click", async () => {
    check.disabled = true;
    setStatus();
    try {
      current = await checkDraft(run, draftFromEditors());
      showCurrentDraft();
      setStatus(el("p", "checked-edit", "The edited draft was checked as a whole."));
    } catch (failure) {
      setStatus(el("p", "result problem", `${failure.name}: ${failure.message}`));
    } finally {
      check.disabled = false;
    }
  });

  const write = button("btn write-proposals", "Write proposals");
  write.addEventListener("click", async () => {
    write.disabled = true;
    setStatus();
    try {
      const written = await writeResult(run.prepared, draftFromEditors(), { result: current, context: run.jobContext });
      shownTexts = textsOfEditors();
      setStatus(el("p", "written", written.files?.length ? `Written: ${written.files.join(", ")}` : "Nothing changed."));
    } catch (failure) {
      write.disabled = false;
      if (failure.name === "DueDiligenceMissing") {
        setStatus(el("p", "due-diligence-missing", dueDiligenceMissingText(failure, run)));
      } else {
        setStatus(el("p", "result problem", `${failure.name}: ${failure.message}`));
      }
    }
  });

  const again = button("btn start-again", "Start again");
  again.addEventListener("click", () => result.remove());
  shown.append(el("div", "actions", check, write, again), status);
  result.append(shown);
}

function elementsOf(root, localName, className) {
  const walk = (node) => [...node.childNodes].flatMap((kid) => (kid.nodeType === 1 ? [kid, ...walk(kid)] : []));
  return walk(root).filter((node) => node.localName === localName && node.className.split(" ").includes(className));
}

function markdownCells(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return null;
  return trimmed.slice(1, -1).split("|").map((cell) => cell.trim());
}

// The candidates of a decision's due-diligence table the author may choose among, by the label of their row. A candidate its registry does not know — its row says `not found` — is
// not proposed (UC-022 7a); its row in the table is where it is listed, with the address queried.
function candidateChoices(file) {
  const { section } = splitDueDiligence(file.text);
  if (!section) return [];
  const out = [];
  let header = null;
  for (const line of section.split(/\r?\n/)) {
    const cells = markdownCells(line);
    if (!cells) continue;
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    if (!header) { header = cells; continue; }
    const at = header.findIndex((cell) => cell.toLowerCase() === "candidate");
    if (at >= 0 && cells[at] && !cells.some((cell) => cell.startsWith("not found"))) out.push(cells[at]);
  }
  return out;
}

// The columns that name a candidate in a reuse decision's tables, as MOD-reuse-facts' Candidate holds it: its name, its ecosystem, its repository.
const IDENTITY = new Set(["candidate", "name", "ecosystem", "repository", "source repository"]);
const plain = (cell) => cell.replace(/`([^`]+)`/g, "$1").replace(/\s+-\s+(chosen|alternative)$/i, "").trim();

/**
 * chosenIn(text, label) -> string — the decision's text with the candidate `label` names (`<name> (<ecosystem>)`, as a row of its due-diligence table names it) made the chosen one
 * (UC-022 step 8): its name, ecosystem and repository change places with those of the chosen candidate of `## Decision` — the first row whose role is `chosen`, or that names none —, so
 * the step due-diligence, run again when the draft is written, finds it chosen. A text in which the label names no candidate, or the chosen one, is returned unchanged.
 */
function chosenIn(text, label) {
  const [, name, ecosystem] = /^(.*?) \((\w+)\)/.exec(plain(label)) ?? [];
  const lines = text.split("\n");
  const rows = [];
  let heading = null, header = null;
  for (const [at, line] of lines.entries()) {
    if (/^## /.test(line)) { heading = line.trim(); header = null; continue; }
    const cells = markdownCells(line);
    if (!cells) { header = null; continue; }
    if (heading !== "## Decision" && heading !== "## Alternatives") continue;
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    if (!header) { header = cells.map((cell) => cell.toLowerCase()); continue; }
    const value = (column) => plain(cells[header.indexOf(column)] ?? "");
    const role = value("role").toLowerCase() || (heading === "## Decision" ? "chosen" : "alternative");
    rows.push({ at, cells, header, role, name: value("candidate") || value("name"), ecosystem: value("ecosystem").toLowerCase() });
  }
  const chosen = rows.find((row) => row.role === "chosen");
  const picked = rows.find((row) => row.name === name && row.ecosystem === ecosystem?.toLowerCase());
  if (!chosen || !picked || chosen === picked) return text;
  const identity = (row) => Object.fromEntries(row.header.map((column, at) => [column, row.cells[at]]).filter(([column]) => IDENTITY.has(column)));
  const swapped = (row, other) => {
    const taken = identity(other);
    return `| ${row.cells.map((cell, at) => (IDENTITY.has(row.header[at]) ? taken[row.header[at]] ?? "" : cell)).join(" | ")} |`;
  };
  [lines[chosen.at], lines[picked.at]] = [swapped(chosen, picked), swapped(picked, chosen)];
  return lines.join("\n");
}

function draftFileView(file) {
  const box = el("section", "draft-file", el("h4", null, file.path));
  box.setAttribute("data-path", file.path);
  const area = el("textarea", "draft-text");
  area.value = file.text;
  area.setAttribute("data-path", file.path);
  box.append(area);
  const { section } = splitDueDiligence(file.text);
  if (section !== null) box.append(dueDiligenceSection(section));
  const choices = candidateChoices(file);
  if (choices.length) {
    const list = el("ul", "reuse-candidates");
    for (const candidate of choices) {
      const radio = el("input", "reuse-candidate");
      radio.type = "radio";
      radio.name = `reuse-${file.path}`;
      radio.value = candidate;
      // The pick is the author's edit of the decision's text, which Write proposals writes (UC-022 step 8).
      radio.addEventListener("change", () => { if (radio.checked) area.value = chosenIn(area.value, candidate); });
      list.append(el("li", null, el("label", null, radio, ` ${candidate}`)));
    }
    box.append(list);
  }
  return box;
}

function findingLine(found) {
  return `${found.artifact}:${found.line}: ${found.kind}: ${found.what} [${found.rule}] — ${found.fix}`;
}

function findingsList(className, findings) {
  const list = el("ul", className);
  for (const found of findings) list.append(el("li", found.kind, findingLine(found)));
  return list;
}

// *Check this edit*: the edited draft is run again as a whole, in this tab and attended, by MOD-runtimes' runOnTab with its hook `from`; it has no record, so nothing is appended anywhere.
async function checkDraft(run, draft) {
  const acting = [run.prepared.drafter, ...run.prepared.reviewers].filter(Boolean);
  return runOnTab(run.prepared, run.jobContext, connectionsOf(acting, run.context.store), { host: run.host, record: null, from: draft });
}

function dueDiligenceMissingText(failure, run) {
  const registries = (failure.decisions ?? []).map((each) => each.registry).filter(Boolean);
  const offered = run.participants.flatMap((participant) => routesFor(participant, run.participants, run.product, run.needs)
    .map((offer) => ({ participant, offer }))).find(({ offer }) => offer.available && offer.route.kind !== "tab");
  const route = offered ? ` Try ${recordRoute(offered.offer.route)} with ${offered.participant.name}.` : " Try a participant that can reach the web.";
  return `${failure.message}${registries.length ? ` Registry: ${registries.join(", ")}.` : ""}${route}`;
}
