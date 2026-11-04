// The public trace Route for the specification, the gaps and the modules (the modules page draws the component diagram, UC-025 step 5). Above its page it offers the ref its caller hands (current, when that is the default
// branch) and every tag of the product, newest first (UC-020 steps 1, 1a, 1c); choosing one draws the page again at it. The specification page
// draws the tree of the group file docs/groups/requirements.md (UC-020 steps 2 and 3): every requirement once with its status, which the open entries of the change queues give it,
// and each group with how many requirements it holds and how many of them no use case realises. Above the tree the reader narrows it by typing part of a name or rule and by the filters of the descriptor: status, source and realised (UC-020 step 4). Opening a requirement shows its four fields at once and, beside them, what traces to it (UC-020 step 5): the trace
// graph of the version drawn, the one stored for its commit on trace-cache, is read when the first requirement is opened, and kept for every later
// opening; the sources with version and part, the use cases with their review status, the decisions, modules and tests that name it,
// and the unknown names they also name, each a link (step 6). The gaps page (step 7) draws, from the graph of the version drawn, the matrix of
// every requirement against the use cases, decisions, modules and tests that name it, and the gaps as MOD-trace-graph's coverageGaps finds them;
// it says so when there are none (7a) and says which kinds of artifact the version does not hold (7b), and a requirement or use case in a list
// opens as it read in that version. The graph of one version is built once and kept, in memory, for every page drawn at it while the page of the frame
// stays loaded. It writes nothing. On the default branch the specification leads to the review pages' editing: Edit beside each requirement and
// + Requirement once for each section, beside the tree; at any other ref the view says "as of" it and offers neither. Beside the choice a link leads from the specification to the gaps
// and from the gaps back to the specification, at the ref shown (UC-020 step 7); it reads nothing. At the default branch, while the graph of its head is not stored
// yet, the specification, the gaps and the modules show the whole version of the commit whose graph MOD-trace-graph's latestGraph gives — that commit's snapshot and
// files — with latestGraph's line, read-only as at a tag; where the head's graph is stored they read nothing more than it. The specification and the gaps offer a
// second version to compare with (UC-020 1b), read only once it is picked: its snapshot and its stored graph, set against the graph of the version drawn by
// MOD-trace-graph's compareGraphs — the requirements added, changed and removed, marked in the tree, a changed one opening with its difference, and on the gaps
// the coverage gained and lost.
//
// Module: MOD-trace-pages

import { parseSpec } from "../spec-document/index.mjs";
import { hierarchy, parseGroupFile } from "../group-document/index.mjs";
import { renderArtifact, renderMermaid, showDifference } from "../markdown-render/index.mjs";
import { artifactSchemas, readDocument } from "../documents/index.mjs";
import { statuses } from "../approvals/index.mjs";
import { entryImpact } from "../spec-changes/index.mjs";
import { affectedRequirements, linkedVersion, sourceSchemas } from "../source-register/index.mjs";
import { compareGraphs, coverageGaps, latestGraph, moduleRows, storedGaps, storedGraph, tracesTo } from "../trace-graph/index.mjs";
import { waitingQueues } from "../progress-measures/index.mjs";
import { embedRoute, explain, readProblem } from "../site-frame/index.mjs";
import { componentDiagram } from "./diagram.mjs";
import { descriptorFor } from "./views.mjs";
import { showTests } from "./tests.mjs";
import { drawAudit } from "./audit.mjs";
import { instanceSnapshot, opening, personsSource, subjectOf } from "./subject.mjs";
import { heads } from "./routes.mjs";

const SPEC_PATH = "SPEC.md";
const GROUP_PATH = "docs/groups/requirements.md";

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

const sectionTitle = (heading) => String(heading ?? "").replace(/^##[ \t]*/, "");

function requirementDetail(requirement) {
  const detail = el("section", "requirement-detail", el("h3", null, requirement.name));
  for (const [label, text] of [["Source", requirement.source], ["Rule", requirement.rule], ["Check", requirement.check]]) {
    const field = el("section", "requirement-field", el("h4", null, label));
    field.append(renderArtifact(text ?? ""));
    detail.append(field);
  }
  return detail;
}

// ---------------------------------------------------------------- what traces to an opened requirement (UC-020 steps 5 and 6)

// The address of an artifact's page, in the form the frame reads (a route, then key=value parts, each encoded): a use case, a decision and a module
// at the review pages' routes `use-case`, `decision` and `module` with the part `id`, a test at this module's own route `trace` for the tests view,
// a source at the library's `library` with the part `source`. An identifier of another kind has no page, and is shown unlinked.
const fragment = (route, params) => `#${[route, ...Object.entries(params).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)].join("/")}`;
function addressOf(id) {
  if (/^UC-/.test(id)) return fragment("use-case", { id });
  if (/^ARC-/.test(id)) return fragment("decision", { id });
  if (/^MOD-/.test(id)) return fragment("module", { id });
  if (/^TST-/.test(id)) return fragment("trace", { key: "tests", row: id });
  if (/^SRC-/.test(id)) return fragment("library", { source: id });
  return null;
}
const linked = (id, text) => {
  const address = addressOf(id);
  if (address === null) return el("span", null, text);
  const anchor = el("a", "trace-link", text);
  anchor.setAttribute("href", address);
  return anchor;
};

// A fact of the version drawn, read when it is first wanted and kept for every later opening; one that failed is read again at the next.
function kept(make) {
  let held = null;
  return () => {
    held ??= make().catch((failure) => { held = null; throw failure; });
    return held;
  };
}

// The sources of the version drawn: the product's links at the version, and the register of the instance at its default branch (the Host the frame
// gave the route; the version's own snapshot where it gave none), as MOD-review-pages' sourcesOf reads them.
async function sourcesOf(shown) {
  const { snapshot, context } = shown;
  const { entry, links } = sourceSchemas();
  let holder = snapshot;
  if (context.instance?.host) holder = await instanceSnapshot(context);
  const entries = holder.paths.filter((path) => /^docs\/sources\/[^/]+\.md$/.test(path));
  // The files are named to Snapshot.readMany before they are read, as subject.mjs' personsSource names them: one batch where the links file and the register are
  // one snapshot, the register's own where they are two (the links file, a batch of one, by its read); a host that cannot batch reads nothing ahead.
  if (holder === snapshot) await snapshot.readMany?.(["docs/sources.md", ...entries]);
  else await holder.readMany?.(entries);
  const register = await Promise.all(entries.map(async (path) => readDocument(entry, path, (await holder.read(path)) ?? "")));
  return { links: readDocument(links, "docs/sources.md", (await snapshot.read("docs/sources.md")) ?? ""), register };
}

const REVIEW = { open: "open", accepted: "accepted", changed: "changed since acceptance" };
const problemLine = (what, failure) => el("p", "traces-problem", `${what} could not be read: ${failure?.message ?? failure}`);
// A failed read of the specification view: what failed, then the frame's problem for the failure. A context that does not say whether a token is stored is read as one that does.
const failedRead = (className, what, failure, context) => el("div", className, `${what} could not be read: `, readProblem(failure, context.product.tokenStored !== false));
// A product's page whose graph is not stored: after GraphNotStored's line, the step that stores it, since the file that runs onMainChanged is written by Install
// (MOD-runtimes' jobWorkflowFiles); the instance's own page shows the line alone, its workflow "main changed" being the instance's own. The instance's page is the
// one whose product is the instance's repository on github.com (#trace), or whose product is read through the instance's own host — the context #spec and #arc
// hand the route, `{ instance: { host }, product: { host } }`, naming no address.
const ofInstance = (context) => (context.product?.host !== undefined && context.product.host === context.instance?.host)
  || (typeof context.instance?.repository === "string"
    && String(context.product?.address ?? "").replace(/(\.git)?\/*$/, "") === `https://github.com/${context.instance.repository}`);
const notStoredStep = (failure, context) => (failure?.name === "GraphNotStored" && !ofInstance(context)
  ? [el("p", "graph-not-stored-step", "This product's graph is not stored yet: press Install on its Settings page.")] : []);
const listOf = (items) => el("ul", "trace-list", ...items.map((item) => el("li", null, item)));

// The graph of a commit is read once for the page that holds the browser's store (the Host, where the context has none), whichever page asks and however
// often the version is drawn again: a commit does not change. It is kept in memory only, under the commit. At the default branch (`shown.isDefault`) it is
// MOD-trace-graph's latestGraph — the head's graph, or, while that is not stored yet, the graph stored last with its line —; anywhere else the version's own,
// storedGraph's. A graph with a line is not kept, so that the next drawing asks for the head's again.
const graphsOf = new WeakMap();
function graphKept(shown) {
  const { snapshot, context } = shown;
  const commit = snapshot.commit ?? null;
  const make = async () => ((await shown.isDefault) ? latestGraph(snapshot, commit) : { graph: await storedGraph(snapshot, commit), line: null });
  if (typeof commit !== "string") return kept(make);
  const holder = context.store ?? context.product.host;
  const graphs = graphsOf.get(holder) ?? graphsOf.set(holder, new Map()).get(holder);
  if (!graphs.has(commit)) {
    const reading = kept(async () => {
      const found = await make();
      if (found.line !== null && graphs.get(commit) === reading) graphs.delete(commit);
      return found;
    });
    graphs.set(commit, reading);
  }
  return graphs.get(commit);
}

// The line above a version drawn in place of the default branch's head, whose graph is not stored yet: latestGraph's, and that the version is read-only.
const earlierLine = (line) => el("p", "version-earlier", `${line} Until then it shows that commit's version, read-only.`);

// The facts of the version drawn, each read on its first opening. A graph latestGraph gives with a line is of an earlier commit: the view is drawn again at
// that commit (`shown.earlier`), once, and what asked for the head's graph is told it is not stored, never given the earlier graph.
function factsOf(shown) {
  if (shown.facts) return shown.facts;
  const latest = graphKept(shown);
  const graph = () => latest().then(({ graph: found, line }) => {
    if (line === null) return found;
    const drawing = shown.earlier ? (shown.earlierDrawn ??= shown.earlier(found.commit, line)) : Promise.resolve();
    return drawing.then(() => { throw Object.assign(new Error(line), { name: "GraphNotStored" }); });
  });
  return shown.facts = { graph, sources: kept(() => sourcesOf(shown)) };
}

// The coverage gaps of the version drawn, read once: those stored beside its graph (MOD-trace-graph's storedGaps), a few kilobytes, so that counting
// them reads no graph; where none are stored, those of the graph itself.
function gapsShown(shown) {
  return shown.gaps ??= storedGaps(shown.snapshot, shown.snapshot?.commit).then((stored) => stored ?? factsOf(shown).graph().then(coverageGaps))
    .catch((failure) => { shown.gaps = null; throw failure; });
}

// Whether the graph holds an artifact of the kind at all.
const holds = (graph, kind) => [...graph.nodes.values()].some((node) => node.kind === kind);

// The sections of one opened requirement, drawn into `box` once the graph is read. A list nothing fills reads `none`; where the version holds no
// artifact of the kind at all — no decision, module or test —, it reads `none yet` and a folded note says which phase produces them (UC-020 2b, 5a).
async function showTraces(box, requirement, shown) {
  const facts = factsOf(shown);
  const section = (title, ...content) => el("section", "requirement-trace", el("h4", null, title), ...content);
  const sections = [];
  let graph;
  try {
    graph = await facts.graph();
  } catch (failure) {
    box.replaceChildren(failedRead("traces-problem", "What traces to this requirement", failure, shown.context), ...notStoredStep(failure, shown.context));
    return;
  }
  const traces = tracesTo(graph, requirement.name);
  const reviewOf = statuses(shown.snapshot);

  try {
    const { links, register } = await facts.sources();
    sections.push(section("Sources", traces.sources.length ? listOf(traces.sources.map((item) => {
      const found = linkedVersion(links, register, item);
      if (!found) return el("span", null, `${item} — no linked version`);
      return el("span", null, linked(found.source.id, found.source.fields.title ?? found.source.id), ` — version ${found.version.version}${found.part ? `, part ${found.part}` : ""}`);
    })) : el("p", "none", "none")));
  } catch (failure) {
    sections.push(section("Sources", failedRead("traces-problem", "The sources", failure, shown.context)));
  }

  sections.push(section("Use cases", traces.useCases.length ? listOf(traces.useCases.map((id) => {
    const node = graph.nodes.get(id);
    return el("span", null, linked(id, `${id} ${node.title ?? ""}`.trim()), ` — ${REVIEW[reviewOf.get(node.path)?.status] ?? "open"}`);
  })) : el("p", "none", "none"), explain("trace-statuses")));
  for (const [title, kind, ids] of [["Architecture decisions", "ARC", traces.decisions], ["Modules", "MOD", traces.modules], ["Tests", "TST", traces.tests]]) {
    if (ids.length) sections.push(section(title, listOf(ids.map((id) => linked(id, `${id} ${graph.nodes.get(id)?.title ?? ""}`.trim())))));
    else if (!holds(graph, kind)) {
      sections.push(section(title, el("p", "none-yet", "none yet"),
        explain("trace-none-yet")));
    } else sections.push(section(title, el("p", "none", "none")));
  }

  // Unknown names (UC-020 5b): the names that match no requirement, as coverageGaps finds them, which the artifacts listed above also name.
  const listedIds = new Set([...traces.useCases, ...traces.decisions, ...traces.modules, ...traces.tests]);
  const unknown = coverageGaps(graph).unknownNames
    .map(({ name, namedBy }) => ({ name, namedBy: [...new Set(namedBy.map((place) => place.id).filter((id) => listedIds.has(id)))] }))
    .filter(({ namedBy }) => namedBy.length);
  sections.push(section("Unknown names", unknown.length ? listOf(unknown.map(({ name, namedBy }) =>
    el("span", null, `${name} — named by `, ...namedBy.flatMap((id, at) => [...(at ? [", "] : []), linked(id, id)])))) : el("p", "none", "none")));
  box.replaceChildren(...sections);
}

// ---------------------------------------------------------------- source changed (UC-016 step 5)

// How many commits of a file's history are looked at: one page, so that the marks cost one page of commits and one batch of files per history.
const HISTORY_PAGE = 30;
const SOURCE_LINKS = "docs/sources.md";

// The version each source has in a links file's text: source identifier -> version.
const versionsIn = (schema, text) => new Map((readDocument(schema, SOURCE_LINKS, text ?? "").sections[0]?.rows ?? []).map((row) => [row.cells.Source, row.cells.Version]));

// The sources the product moved to another version, with the date of the move: the newest commit of docs/sources.md that holds the version the file names now, where the commit before it
// held another version of the same source. A source that was added with its first version has not moved. One page of commits and one batch of files; a file with one commit in its
// history cannot have moved a source, so it costs the page alone.
async function movedSources(host, ref, schema) {
  const commits = await host.readHistory(SOURCE_LINKS, { ref, limit: HISTORY_PAGE, changes: false });
  if (commits.length < 2) return new Map();
  const texts = await host.readFileAt(SOURCE_LINKS, commits.map(({ commit }) => commit));
  const before = commits.map(({ commit }) => versionsIn(schema, texts.get(commit)));
  const moved = new Map();
  // The newest commit that changed the file holds the text the version drawn has: the file is not read from the snapshot, which drawing leaves unread.
  for (const [source, version] of before[0]) {
    let at = 0;
    while (at < commits.length && before[at].get(source) === version) at += 1;
    if (at > 0 && at < commits.length && before[at].has(source)) moved.set(source, commits[at - 1].date);
  }
  return moved;
}

// When each named requirement's text last changed: the date of the newest commit of SPEC.md whose text of it differs from the commit before; where it does not differ in the page of
// commits looked at, the date of the oldest of them. One page of commits and one batch of files.
async function sectionsChanged(host, ref, names) {
  const commits = await host.readHistory(SPEC_PATH, { ref, limit: HISTORY_PAGE, changes: false });
  if (!commits.length) return new Map();
  const texts = await host.readFileAt(SPEC_PATH, commits.map(({ commit }) => commit));
  const specs = commits.map(({ commit }) => parseSpec(texts.get(commit) ?? "").requirements);
  const textOf = (requirements, name) => { const found = requirements.get(name); return found ? JSON.stringify([found.source, found.rule, found.check]) : null; };
  return new Map(names.map((name) => {
    let at = 0;
    while (at + 1 < commits.length && textOf(specs[at], name) === textOf(specs[at + 1], name)) at += 1;
    return [name, commits[at].date];
  }));
}

// The names of the requirements marked *source changed*: those affectedRequirements names for a source the product moved after the requirement's text last changed.
// `movedRead` is movedSources asked already, beside the page's first reads, where the caller asked it.
async function sourceChanged(shown, movedRead = null) {
  const { snapshot, context, ref } = shown;
  if (!snapshot.paths.includes(SOURCE_LINKS)) return new Set();
  const host = context.product.host;
  const moved = await (movedRead ?? movedSources(host, ref, sourceSchemas().links));
  if (!moved.size) return new Set();
  // Only a product that moved a source reads the register, to find the requirements that name it.
  const { register } = await factsOf(shown).sources();
  const movedAt = new Map();
  for (const [source, date] of moved) {
    for (const name of affectedRequirements(shown.specText, register, source)) {
      if (!(Date.parse(movedAt.get(name)) >= Date.parse(date))) movedAt.set(name, date);
    }
  }
  if (!movedAt.size) return new Set();
  const changed = await sectionsChanged(host, ref, [...movedAt.keys()]);
  return new Set([...movedAt].filter(([name, date]) => Date.parse(date) > Date.parse(changed.get(name))).map(([name]) => name));
}

// Marks the rows of the requirements `sourceChanged` names — asked already where `asked` is given —, once the page is drawn; a history that cannot be read is said in a line, and marks nothing.
async function markSourceChanged(shown, asked = null) {
  let names;
  try {
    names = await (asked ?? sourceChanged(shown));
  } catch (failure) {
    shown.target.querySelector?.(".current-requirements, .specification-page")?.append(failedRead("traces-problem", "Whether a source moved on", failure, shown.context));
    return;
  }
  for (const [name, cell] of shown.cells ?? []) if (names.has(name)) cell.append(" ", el("span", "requirement-source-changed", "source changed"));
}

// ---------------------------------------------------------------- the gaps (UC-020 step 7)

// A button that opens, by a click and in place, onto what `detail` makes, and the box beneath it that holds that: { button, opened }.
function opener(text, detail) {
  const button = el("button", "gap-open btn small", text);
  button.type = "button";
  const opened = el("div", "gap-opened");
  let open = false;
  button.addEventListener("click", async () => {
    open = !open;
    if (!open) { opened.replaceChildren(); return; }
    opened.replaceChildren(el("p", "traces-reading", "Reading…"));
    try {
      const made = await detail();
      if (open) opened.replaceChildren(made);
    } catch (failure) {
      if (open) opened.replaceChildren(problemLine(text, failure));
    }
  });
  return { button, opened };
}

// A line of a list that opens onto what `detail` makes: a requirement or a use case as it read in the version drawn.
function openable(text, detail) {
  const { button, opened } = opener(text, detail);
  return el("li", null, button, opened);
}

const KINDS = [["UC", "use cases"], ["ARC", "architecture decisions"], ["MOD", "modules"], ["TST", "tests"]];

// The matrix of the version drawn, in the order of the SPEC: each requirement against the artifacts that name it, as tracesTo finds them.
function matrixOf(graph, spec) {
  const cell = (ids) => ids.length ? el("td", null, ...ids.flatMap((id, at) => [...(at ? [", "] : []), linked(id, id)])) : el("td", "none", "none");
  const rows = [...spec.requirements.keys()].map((name) => {
    const traces = tracesTo(graph, name);
    return el("tr", null, el("td", null, name), cell(traces.useCases), cell(traces.decisions), cell(traces.modules), cell(traces.tests));
  });
  return el("table", "list gaps-matrix", el("thead", null, el("tr", null, ...["Requirement", "Use cases", "Architecture decisions", "Modules", "Tests"].map((title) => el("th", null, title)))),
    el("tbody", null, ...rows));
}

// The gaps page, drawn into `box` once the graph is read. The lists are coverageGaps' and nothing is decided here: a list is the gaps of its kind, or reads
// `none`; where every list is empty and the version holds every kind of artifact, the page says there are no gaps (7a); where it holds no requirement or no
// artifact of a kind, it says so (7b), since the lists do not look for what the version cannot hold. A requirement or a use case in a list opens as the
// version drawn holds it.
async function showGaps(box, shown) {
  let graph;
  try {
    graph = await factsOf(shown).graph();
  } catch (failure) {
    box.replaceChildren(problemLine("The gaps", failure), ...notStoredStep(failure, shown.context));
    return;
  }
  const found = coverageGaps(graph);
  const { ref, spec, snapshot } = shown;
  const missing = [...(spec.requirements.size ? [] : [`SPEC.md holds no requirements at ${ref}.`]),
    ...KINDS.filter(([kind]) => !holds(graph, kind)).map(([, name]) => `No ${name} exist at ${ref}.`)];
  const requirementLine = (name) => openable(name, () => requirementDetail(spec.requirements.get(name)));
  const useCaseLine = (id) => {
    const node = graph.nodes.get(id);
    const title = `${id} ${node.title ?? ""}`.trim();
    return openable(title, async () => el("section", "gap-artifact", el("h4", null, title), renderArtifact((await snapshot.read(node.path)) ?? "")));
  };
  const section = (title, items) => el("section", "gaps-list", el("h3", null, title), items.length ? el("ul", "trace-list", ...items) : el("p", "none", "none"));
  const unknown = found.unknownNames.map(({ name, namedBy }) =>
    el("li", null, `${name} — named by `, ...[...new Set(namedBy.map((place) => place.id))].flatMap((id, at) => [...(at ? [", "] : []), linked(id, id)])));
  const none = !found.requirementsWithoutUseCase.length && !found.requirementsWithoutModule.length && !found.requirementsWithoutTest.length
    && !found.useCasesWithoutRequirement.length && !unknown.length;
  box.replaceChildren(explain("trace-gaps"), ...missing.map((line) => el("p", "gaps-missing", line)),
    ...(none && !missing.length ? [el("p", "no-gaps", `There are no gaps at ${ref}.`)] : [
      section("Requirements realised by no use case", found.requirementsWithoutUseCase.map(requirementLine)),
      ...(holds(graph, "MOD") ? [section("Requirements named by no module", found.requirementsWithoutModule.map(requirementLine))] : []),
      ...(holds(graph, "TST") ? [section("Requirements named by no test", found.requirementsWithoutTest.map(requirementLine))] : []),
      section("Use cases that realise no requirement", found.useCasesWithoutRequirement.map(useCaseLine)),
      section("Unknown names", unknown),
    ]),
    ...(spec.requirements.size ? [el("h3", null, "Matrix"), matrixOf(graph, spec)] : []));
}

// An anchor to a route of the review pages, in the address form the frame reads: the route, then its parts as key=value, each encoded. It is a
// plain link, as the review pages draw a link to another page; a button is what acts on the page shown. With `product`, the address of the product shown, the link
// ends in `product=` and the address percent-encoded, the form MOD-site-frame's chosenProduct reads back.
function reviewLink(className, text, route, params, product = null) {
  const anchor = el("a", className, text);
  const parts = [...Object.entries(params).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`),
    ...(product ? [`product=${encodeURIComponent(product)}`] : [])];
  anchor.setAttribute("href", parts.length ? `#${route}/${parts.join("/")}` : `#${route}`);
  return anchor;
}

// The address the links to the review pages carry: the product's, where the page shows a product; none on the instance's own page (`ofInstance`), whose links stay as they are.
const reviewProductOf = (context) => (ofInstance(context) ? null : context.product?.address ?? null);

// The status of a requirement the SPEC holds: "in SPEC", or what an open entry of a change queue would do to it (UC-020 step 3).
const statusCell = (text) => el("td", "requirement-status", text);

function requirementRows(requirement, editable, shown, status, mark = []) {
  const button = el("button", "requirement-name btn small", requirement.name);
  button.type = "button";
  const cell = el("td", null, button, ...mark);
  (shown.cells ??= []).push([requirement.name, cell]);
  if (editable) cell.append(" ", reviewLink("requirement-edit", "Edit", "requirement", { name: requirement.name }, reviewProductOf(shown.context)));
  const row = el("tr", null, cell, statusCell(status));
  const opened = el("tr", "requirement-opened");
  button.addEventListener("click", () => {
    if (opened.textContent) {
      opened.replaceChildren();
      opening(shown.requirements, requirement.name, false);
      return;
    }
    const traces = el("div", "requirement-traces", el("p", "traces-reading", "Reading what traces to it…"));
    const cell = el("td", "panel", requirementDetail(requirement), ...differenceOf(shown.compared, requirement.name), traces);
    cell.setAttribute("colspan", "2");
    showTraces(traces, requirement, shown);
    opened.replaceChildren(cell);
    opening(shown.requirements, requirement.name, true);
  });
  return [row, opened];
}

// A table of the members of one place in the tree, each once with its status: a requirement of the SPEC as a row that opens, a requirement an open entry
// would add (it has no text yet) and a member that names no requirement as rows of their own.
function membersTable(members, arranged, editable, shown) {
  const body = el("tbody");
  for (const { id } of members) {
    const requirement = arranged.spec.requirements.get(id);
    // An item no group names stands at the top level, marked not yet placed (UC-021 3b).
    const mark = arranged.ungrouped.has(id) ? [" ", el("span", "requirement-unplaced", "not yet placed")] : [];
    let nodes;
    if (requirement) nodes = requirementRows(requirement, editable, shown, arranged.status.get(id) ?? "in SPEC", mark);
    else if (arranged.added.has(id)) nodes = [el("tr", "requirement-proposed", el("td", null, id, ...mark), statusCell("proposed"))];
    else nodes = [el("tr", "requirement-unknown", el("td", null, id), statusCell("unknown: no requirement of this name"))];
    arranged.rowNodes.push({ id, nodes, known: Boolean(requirement) || arranged.added.has(id) });
    body.append(...nodes);
  }
  const table = el("table", "list", el("thead", null, el("tr", null, el("th", null, "Requirement"), el("th", null, "Status"))), body);
  arranged.tables.push({ table, ids: members.map(({ id }) => id) });
  return table;
}

// Every member of a group and of the groups below it.
const heldAll = (group) => [...group.members, ...group.groups.flatMap(heldAll)];

// One group of the tree: its title as the control that opens it, how many requirements it holds (those below it too; a member that names no requirement is
// none) and, once the trace graph is read, how many of them no use case realises; inside, its own members and the groups below it.
function groupNode(group, path, arranged, editable, shown) {
  const names = [...new Set(heldAll(group).map(({ id }) => id))].filter((id) => arranged.spec.requirements.has(id) || arranged.added.has(id));
  const toggle = el("button", "spec-group-toggle btn", group.title);
  toggle.type = "button";
  toggle.setAttribute("aria-expanded", "false");
  const held = el("span", "spec-group-held", `${names.length} ${names.length === 1 ? "requirement" : "requirements"}`);
  const unrealised = el("span", "spec-group-unrealised");
  arranged.counts.push([names, unrealised]);
  const body = el("div", "spec-group-body");
  if (group.members.length) body.append(membersTable(group.members, arranged, editable, shown));
  for (const below of group.groups) body.append(groupNode(below, `${path}/${below.title}`, arranged, editable, shown));
  // Opened by the person with the control, or by the narrowing while a requirement in the group matches (`forced`).
  const state = { opened: false, forced: false };
  const refresh = () => {
    const open = state.opened || state.forced;
    if (!open) body.setAttribute("hidden", "hidden");
    else if (body.getAttribute("hidden")) body.removeAttribute("hidden");
    toggle.setAttribute("aria-expanded", String(open));
  };
  refresh();
  const spoken = { heading: group.title, path, names: names.filter((id) => arranged.spec.requirements.has(id)) };
  toggle.addEventListener("click", () => {
    state.opened = !(state.opened || state.forced);
    refresh();
    opening(shown.groups, spoken, state.opened, (a, b) => a.path === b.path);
  });
  const section = el("section", "spec-group", el("h3", null, toggle, " ", held, ", ", unrealised), body);
  arranged.groupNodes.push({ section, names, state, refresh });
  return section;
}

// The tree of the group file (UC-020 steps 2 and 3): the groups nested, each requirement once in its one place and at the top level where no group names it.
function overview(arranged, editable, shown, descriptor, params) {
  const page = el("section", "current-requirements head", el("h2", null, "Current requirements"));
  const narrowing = arranged.spec.requirements.size || arranged.added.size ? narrowBar(arranged, shown, descriptor, params) : null;
  if (narrowing) page.append(narrowing.bar);
  if (arranged.tree.members.length) page.append(membersTable(arranged.tree.members, arranged, editable, shown));
  for (const group of arranged.tree.groups) page.append(groupNode(group, group.title, arranged, editable, shown));
  if (narrowing) page.append(narrowing.none);
  if (!arranged.spec.requirements.size) page.append(el("p", "empty", "No current requirements are recorded in SPEC.md."));
  narrowing?.apply();
  return page;
}

// ---------------------------------------------------------------- narrowing the tree (UC-020 step 4)

// The row a filter judges: the requirement's name and rule, its status, the sources it names and whether a use case realises it. A requirement an open entry would
// add has no text, no source and no use case yet.
function rowOf(arranged, id, without) {
  const requirement = arranged.spec.requirements.get(id);
  return { name: id, rule: requirement?.rule ?? "", status: requirement ? arranged.status.get(id) ?? "in SPEC" : "proposed", sources: requirement?.sources ?? [],
    realised: requirement !== undefined && !without.has(id) };
}

// The controls above the tree — the text, and one choice for each filter of the descriptor, "all" first — and the narrowing they make. A control gets its first value from
// the param of its name (a value the control does not offer is none). The rows that do not match are hidden, and so is a group, a table and a member that names no requirement
// when nothing in them matches; a group with a match is opened. A choice of realised reads the trace graph first; a graph that cannot be read is said, and that choice narrows nothing.
function narrowBar(arranged, shown, descriptor, params) {
  const rows = [...arranged.spec.requirements.keys(), ...arranged.added].map((id) => rowOf(arranged, id, new Set()));
  const bar = el("div", "spec-narrow");
  const text = el("input", "spec-narrow-text");
  text.type = "search";
  text.setAttribute("placeholder", "Narrow by name or rule");
  text.value = typeof params.text === "string" ? params.text : "";
  bar.append(text);
  const choices = new Map();
  for (const filter of descriptor.filters) {
    const values = filter.values(rows);
    const field = el("select", `spec-narrow-${filter.name}`);
    for (const value of ["all", ...values]) {
      const option = el("option", null, value);
      option.setAttribute("value", value);
      field.append(option);
    }
    field.value = values.includes(params[filter.name]) ? params[filter.name] : "all";
    choices.set(filter.name, field);
    bar.append(" ", el("label", null, `${filter.name} `, field));
  }
  const problem = el("p", "spec-narrow-problem");
  problem.setAttribute("hidden", "hidden");
  const none = el("p", "spec-narrow-none", "No requirement matches.");
  none.setAttribute("hidden", "hidden");
  bar.append(problem);
  let latest = 0;
  const unrealised = arranged.unrealised = kept(async () => new Set((await gapsShown(shown)).requirementsWithoutUseCase));
  // Hidden or shown, touching the node only when its state changes.
  const set = (node, hidden) => {
    if (hidden) node.setAttribute("hidden", "hidden");
    else if (node.getAttribute("hidden")) node.removeAttribute("hidden");
  };
  async function apply() {
    const mine = ++latest;
    const wanted = new Map(descriptor.filters.map((filter) => [filter.name, choices.get(filter.name).value]));
    let without = new Set();
    let readable = true;
    if (wanted.get("realised") !== "all") {
      try {
        without = await unrealised();
      } catch {
        readable = false;
      }
      if (mine !== latest) return;
    }
    set(problem, readable);
    if (!readable) {
      problem.textContent = "Whether a use case realises a requirement could not be read.";
      wanted.set("realised", "all");
    }
    const typed = text.value.trim().toLowerCase();
    const active = typed !== "" || [...wanted.values()].some((value) => value !== "all");
    const matching = new Set();
    for (const { id, known } of arranged.rowNodes) {
      if (!known) continue;
      const row = rowOf(arranged, id, without);
      if ((typed === "" || `${row.name}\n${row.rule}`.toLowerCase().includes(typed))
        && descriptor.filters.every((filter) => wanted.get(filter.name) === "all" || filter.keep(row, wanted.get(filter.name)))) matching.add(id);
    }
    for (const { id, nodes, known } of arranged.rowNodes) for (const node of nodes) set(node, active && !(known && matching.has(id)));
    for (const { table, ids } of arranged.tables) set(table, active && !ids.some((id) => matching.has(id)));
    for (const group of arranged.groupNodes) {
      const has = group.names.some((id) => matching.has(id));
      set(group.section, active && !has);
      group.state.forced = active && has;
      group.refresh();
    }
    set(none, !(active && matching.size === 0));
  }
  for (const [name, field] of [["text", text], ...choices]) field.addEventListener(name === "text" ? "input" : "change", apply);
  return { bar, none, apply };
}

// *+ Requirement* once for each section of the SPEC, beside the tree and not within it, each opening `requirements/new` for its section (UC-018 3d).
function addLinks(spec, product) {
  const items = spec.sections.map((section) => el("li", null, `${sectionTitle(section.heading)} `,
    reviewLink("requirement-new", "+ Requirement", "requirements", { section: section.heading }, product)));
  return items.length ? el("ul", "spec-add-requirements", ...items) : null;
}

// The group file at the version drawn (its text, `groupText`, read beside the SPEC), set against the items it arranges: the requirements of the SPEC and those an open entry would add. `status` names what an
// open entry would do to a requirement of the SPEC (the newest entry that names it, the last in `queues`' order); `added` the names an entry would add.
async function arrangement(snapshot, spec, waiting, groupText) {
  const status = new Map();
  const added = new Set();
  // The entries' impacts are read at once, from their proposals and targets and no rationale; they are then taken in the order `waitingQueues` lists them — queues by their folders' names, then entries by their numbers —, so that the last, the newest entry naming a requirement, gives its one mark; the other entries naming it
  // stand in the list of waiting entries (waitingSection) with their own status and link.
  const impacts = await Promise.all(waiting.map(({ queue, entry }) => entryImpact(queue.folder, entry.number, snapshot).catch(() => null)));
  for (const impact of impacts) {
    if (impact === null) continue;
    for (const { name, change } of impact) {
      if (change === "added") {
        if (!spec.requirements.has(name)) added.add(name);
      } else if (spec.requirements.has(name)) status.set(name, change === "withdrawn" ? "removal proposed" : "change proposed");
    }
  }
  const items = [...spec.requirements.keys(), ...added];
  const { tree, ungrouped } = hierarchy(parseGroupFile(GROUP_PATH, groupText ?? ""), items);
  return { spec, tree, ungrouped: new Set(ungrouped), status, added, counts: [], rowNodes: [], tables: [], groupNodes: [], unrealised: null };
}

// Fills in, once the trace graph is read, how many requirements of each group no use case realises: the names coverageGaps lists, and those an entry would add,
// which nothing realises yet. A graph that cannot be read is said in place of the counts.
async function countUnrealised(shown, arranged) {
  if (!arranged.counts.length) return;
  let without;
  try {
    without = await arranged.unrealised();
  } catch {
    for (const [, node] of arranged.counts) node.textContent = "whether a use case realises them could not be read";
    return;
  }
  for (const [names, node] of arranged.counts) {
    node.textContent = `${names.filter((id) => without.has(id) || arranged.added.has(id)).length} that no use case realises`;
  }
}

// The entries of the change queues that wait for acceptance — open, stale, or waiting for the anchor another entry creates — each as a link to its page
// in the review pages, by the identifier `spec-<queue folder>-<NN>` MOD-review-pages addresses an entry by. The queues are those the overview stored for the
// commit holds (MOD-progress-measures' waitingQueues: every queue with an entry not in the SPEC yet), so that no queue file is read; while the head's is not
// stored yet — the minutes after a push, before the workflow "main changed" stores it — those of the overview stored last; only where no overview was ever stored is every queue of the snapshot read (MOD-spec-changes' queues). A queue that cannot be read gives none. The proposals of the entries found, which their
// impact lists read (entryImpact), are named to Snapshot.readMany at once, in one batch; a host that cannot batch reads nothing ahead.
async function waitingEntries(snapshot) {
  if (!snapshot.paths.some((path) => path.startsWith("docs/spec-freigaben/"))) return [];
  let all;
  try {
    all = (await waitingQueues(snapshot)).queues;
  } catch {
    return [];
  }
  const waiting = all.flatMap((queue) => queue.entries.filter((entry) => ["open", "stale", "waiting for its anchor"].includes(entry.state))
    .map((entry) => ({ queue, entry })));
  const proposals = waiting.map(({ entry }) => entry.proposal?.path).filter(Boolean);
  if (proposals.length) await snapshot.readMany?.(proposals);
  return waiting;
}

// The badge class of a waiting entry's state, as the review pages' lists colour it.
const WAITING_BADGE = { open: "b-open", stale: "b-stale", "waiting for its anchor": "b-superseded" };

// The waiting entries in the table of the review pages' lists (table.list, a badge for the state): the queue's name as the person reads it, the entry's number,
// the section of the SPEC it changes, and its state; each cell labelled for the phone's stacked rows. The newest entry stands first: the last in `queues`' order.
function waitingSection(waiting, product) {
  if (!waiting.length) return null;
  waiting = [...waiting].reverse();
  const cell = (label, ...children) => {
    const td = el("td", null, ...children);
    td.setAttribute("data-label", label);
    return td;
  };
  const rows = waiting.map(({ queue, entry }) => {
    const folder = queue.folder.slice(queue.folder.lastIndexOf("/") + 1);
    const name = `${folder}-${String(entry.number).padStart(2, "0")}`;
    const title = folder.replace(/^\d{4}-\d{2}-\d{2}_/, "").replace(/-/g, " ");
    const shown = `${title.charAt(0).toUpperCase()}${title.slice(1)} · ${entry.number}`;
    return el("tr", null, cell("Proposal", reviewLink("spec-waiting-entry", shown, "spec-entry", { id: `spec-${name}` }, product)),
      cell("Section", String(entry.anchor ?? "").replace(/^#+\s*/, "")), cell("Status", el("span", `badge ${WAITING_BADGE[entry.state] ?? "b-open"}`, entry.state)));
  });
  const head = el("thead", null, el("tr", null, el("th", null, "Proposal"), el("th", null, "Section"), el("th", null, "Status")));
  return el("section", "spec-waiting head", el("h2", null, "SPEC changes waiting for acceptance"), el("table", "list", head, el("tbody", null, ...rows)));
}

// The links from the specification to the review pages' history of the SPEC change entries and to the arrangement of the requirements
// (`#arrange/kind=requirements`: the route arrange reads its group kind as the parameter `kind`), on the default branch only.
function specChangeLinks(product) {
  return el("p", "spec-change-links", reviewLink("spec-history-link", "History of SPEC changes", "spec-entry", { id: "history" }, product),
    " ", reviewLink("arrange-link", "Arrange", "arrange", { kind: "requirements" }, product));
}

// Whether the ref on view is the repository's default branch, which the Host names: editing is offered there only (UC-018). A Host that cannot say is read as no.
async function onDefaultBranch(host, ref) {
  try {
    return (await host.repositoryInfo?.())?.defaultBranch === ref;
  } catch {
    return false;
  }
}

// The tags the Host names, newest first by their vYYYY.MINOR.PATCH numbers; a tag of another form follows them, in the order the Host gave it.
// A Host that cannot say gives the failure with no names.
const RELEASE = /^v(\d+)\.(\d+)\.(\d+)$/;
async function tagsOf(host) {
  try {
    const names = (await host.listTags()).map((tag) => tag.name);
    const numbers = (name) => RELEASE.exec(name)?.slice(1).map(Number) ?? null;
    const released = names.filter((name) => numbers(name)).sort((a, b) => {
      const [x, y] = [numbers(a), numbers(b)];
      return y[0] - x[0] || y[1] - x[1] || y[2] - x[2];
    });
    return { names: [...released, ...names.filter((name) => !numbers(name))], failure: null };
  } catch (failure) {
    return { names: [], failure };
  }
}

// The choice above the tree: the ref the caller handed, then the tags; the one shown is selected. Without a tag only the handed ref is offered.
function versionChoice({ shown, handed, current, tags, tagsFailure, choose, other, compare = null }) {
  const select = el("select", "version-choice");
  select.setAttribute("aria-label", "Version");
  const versions = [[handed, current ? "current" : handed], ...tags.filter((tag) => tag !== handed).map((tag) => [tag, tag])];
  for (const [value, text] of versions) {
    const option = el("option", null, text);
    option.value = value;
    select.append(option);
  }
  select.value = shown.chosen ?? shown.ref;
  select.addEventListener("change", () => choose(select.value));
  const choice = el("div", "version-bar", el("label", null, "Version ", select));
  const comparing = compare && compareChoice(shown, compare.key, versions, compare.box);
  if (comparing) choice.append(" ", comparing);
  if (other) {
    const across = el("a", other.className, other.text);
    across.setAttribute("href", fragment("trace", { key: other.key, ref: shown.chosen ?? shown.ref }));
    choice.append(across);
  }
  choice.append(explain("trace-versions"));
  if (tagsFailure) choice.append(failedRead("traces-problem", "The tags", tagsFailure, shown.context));
  else if (!tags.length) choice.append(el("p", "version-none", "No release is tagged yet (UC-013); only the current text can be shown."));
  if (shown.asOf) choice.append(earlierLine(shown.asOf));
  else if (!shown.onDefaultBranch) choice.append(el("p", "version-as-of", `as of ${shown.ref}`));
  return choice;
}

// ---------------------------------------------------------------- comparing two versions (UC-020 1b)

// The four fields of a requirement as the lines its difference is drawn from: Source, Rule and Check, one line each.
const fieldLines = (requirement) => `Source: ${requirement?.source ?? ""}\nRule: ${requirement?.rule ?? ""}\nCheck: ${requirement?.check ?? ""}`;

// What an opened requirement shows besides its fields while a second version is compared: for a changed one, its difference from the older version to the
// newer, read from the second version's SPEC once it is first opened; for any other, nothing.
function differenceOf(compared, name) {
  if (!compared?.changed.has(name)) return [];
  const box = el("section", "requirement-difference", el("h4", null, "Difference"), el("p", "traces-reading", "Reading the difference…"));
  compared.otherSpec().then((other) => {
    const [before, after] = compared.otherIsEarlier ? [other, compared.spec] : [compared.spec, other];
    box.replaceChildren(el("h4", null, "Difference"), showDifference(fieldLines(before.requirements.get(name)), fieldLines(after.requirements.get(name))));
  }).catch((failure) => box.replaceChildren(el("h4", null, "Difference"), problemLine("The difference", failure)));
  return [box];
}

const comparedList = (title, items) => el("section", "version-compared-list", el("h4", null, title),
  items.length ? el("ul", "trace-list", ...items.map((item) => el("li", null, item))) : el("p", "none", "none"));

// Compares the version drawn with `other`, the older of the two being the one standing later among the tags, which are newest first, and a ref no tag names,
// the default branch, newer than every tag: reads the other's snapshot and its stored graph — a commit whose graph is not stored is named as storedGraph
// names it —, sets the two graphs against each other with compareGraphs and gives what the view shows of it: on the gaps the coverage gained and lost; on
// the specification the requirements added, changed and removed, with the mark of each for the tree and what a changed one opens with. "none" empties
// `box` and gives nothing; the marks drawn before are taken away first.
async function compareVersions(shown, key, other, box) {
  for (const mark of shown.comparedMarks ?? []) mark.parentNode?.removeChild(mark);
  shown.comparedMarks = [];
  shown.compared = null;
  if (other === "none") { box.replaceChildren(); return; }
  box.replaceChildren(el("p", "traces-reading", "Comparing…"));
  const otherIsEarlier = (shown.tags ?? []).indexOf(other) > (shown.tags ?? []).indexOf(shown.chosen ?? shown.ref);
  let found, otherSnapshot;
  try {
    otherSnapshot = await shown.context.product.host.readSnapshot(other);
    const [mine, theirs] = await Promise.all([factsOf(shown).graph(), storedGraph(otherSnapshot, otherSnapshot.commit ?? null)]);
    found = otherIsEarlier ? compareGraphs(theirs, mine) : compareGraphs(mine, theirs);
  } catch (failure) {
    return el("p", "version-compared-problem", `The comparison with ${other} could not be read: ${failure?.message ?? failure}`);
  }
  const heading = el("h3", null, `Compared with ${other}`);
  if (key === "gaps") {
    const line = ({ name, by }) => `${name} — by ${by}`;
    return el("section", "version-compared", heading, comparedList("Became covered", found.coverage.gained.map(line)),
      comparedList("Lost its coverage", found.coverage.lost.map(line)));
  }
  const { added, changed, removed } = found.requirements;
  let specRead = null;
  const compared = { changed: new Set(changed), spec: shown.spec, otherIsEarlier,
    otherSpec: () => (specRead ??= otherSnapshot.read(SPEC_PATH).then((text) => parseSpec(text ?? "")).catch((failure) => { specRead = null; throw failure; })) };
  const markOf = new Map([...added.map((name) => [name, "added"]), ...changed.map((name) => [name, "changed"]), ...removed.map((name) => [name, "removed"])]);
  return { section: el("section", "version-compared", heading, comparedList("Added", added), comparedList("Changed", changed), comparedList("Removed", removed)),
    compared, markOf };
}

// The second choice in the version bar, of its own class `version-compare`: "none", then every other version of the version choice; picking one compares
// it with the version drawn, the later of two picks in a row being what stays.
function compareChoice(shown, key, versions, box) {
  const others = versions.filter(([value]) => value !== (shown.chosen ?? shown.ref));
  if (!others.length) return null;
  const select = el("select", "version-compare");
  select.setAttribute("aria-label", "Compare with");
  for (const [value, text] of [["none", "none"], ...others]) {
    const option = el("option", null, text);
    option.value = value;
    select.append(option);
  }
  select.value = "none";
  let latest = 0;
  select.addEventListener("change", async () => {
    const mine = ++latest;
    const drawn = await compareVersions(shown, key, select.value, box);
    if (mine !== latest || drawn === undefined) return;
    if (drawn.section) {
      box.replaceChildren(drawn.section);
      shown.compared = drawn.compared;
      for (const [name, cell] of shown.cells ?? []) {
        const text = drawn.markOf.get(name);
        if (!text) continue;
        const mark = el("span", "requirement-compared", text);
        cell.append(mark);
        shown.comparedMarks.push(mark);
      }
    } else box.replaceChildren(drawn);
  });
  return el("label", null, "Compare with ", select);
}

// The view each of the two leads to, beside its version choice: the specification to the gaps, and the gaps back to the specification, at the ref shown.
const OTHER = {
  specification: { key: "gaps", text: "Gaps", className: "trace-gaps-link" },
  gaps: { key: "specification", text: "Specification", className: "trace-specification-link" },
};

// The Tests entry's views under a heading (ITM-1224): MOD-test-pages' route `tests-views`, shown through the frame's embedRoute with `shown` naming the view.
// Where that route is not on the page, the frame has put its link to it in the element (RouteNotLoaded), and the view is drawn on.
async function testsViews(shown) {
  const place = el("div", "tests-views-place");
  try {
    await embedRoute("tests-views", place, { shown });
  } catch (failure) {
    if (failure?.name !== "RouteNotLoaded") throw failure;
  }
  return place;
}

// What each drawn route keeps for its subject, by the context it was drawn with: the frame asks the route for the subject with the same context.
const drawn = new WeakMap();

// The module files of a snapshot as componentDiagram takes them: the files docs/architecture/MOD-<slug>.md by their schema, named to Snapshot.readMany in one batch before
// they are read: the graph is the stored one and reads no file of the version.
async function moduleFilesOf(snapshot) {
  const paths = snapshot.paths.filter((path) => /^docs\/architecture\/MOD-[^/]+\.md$/.test(path));
  if (paths.length) await snapshot.readMany?.(paths);
  const schema = artifactSchemas().module;
  const files = [];
  for (const path of paths) {
    const text = await snapshot.read(path);
    if (text === null) continue;
    const found = readDocument(schema, path, text);
    files.push({
      kind: "module", id: found.id, title: found.fields?.title ?? found.title ?? "", follows: found.fields?.follows ?? [],
      uses: (found.fields?.uses ?? []).map((name) => { const dot = String(name).indexOf("."); return { module: String(name).slice(0, dot), iface: String(name).slice(dot + 1) }; }),
      provides: found.fields?.provides ?? [],
    });
  }
  return files;
}

// The table of the modules (UC-025 step 3), one row for each module of moduleRows: its subsystem and that decision's review status, the requirements it realises each in the SPEC or not, its file with its review status,
// its code and its tests; the name opens the row onto the module's file and folder (step 6). Each cell of a module's row carries its column's title in `data-label`, by which the frame's
// narrow form of a table labels it below a phone's width, where each row stands as a block. The table stands in the site's scroll box, which scrolls a wide table sideways on a wider
// screen; the box is reached by the keyboard and named, as it scrolls.
const MODULE_COLUMNS = ["Module", "Subsystem", "Realises", "File", "Code", "Tests"];
function modulesTable(rows, graph, reviewOf, snapshot) {
  const statusOf = (path) => REVIEW[reviewOf.get(path)?.status] ?? "open";
  const list = (items) => el("ul", null, ...items.map((text) => el("li", null, text)));
  const body = el("tbody");
  for (const row of rows) {
    const name = el("button", "module-name btn small", row.module);
    name.type = "button";
    const subsystem = row.subsystem === null ? "none" : `${row.subsystem} — ${statusOf(graph.nodes.get(row.subsystem)?.path)}`;
    const realises = row.realises.map((each) => `${each} — ${graph.nodes.get(each)?.kind === "requirement" ? "in SPEC" : "not in the SPEC"}`);
    const cells = [el("td", "module-name-cell", name), el("td", "module-subsystem", subsystem), el("td", "module-realises", list(realises)),
      el("td", "module-file", `${row.describedBy} — ${statusOf(row.describedBy)}`), el("td", "module-code", list(row.code)), el("td", "module-tests", list(row.tests))];
    cells.forEach((td, at) => td.setAttribute("data-label", MODULE_COLUMNS[at]));
    const tr = el("tr", "module-row", ...cells);
    tr.setAttribute("data-module", row.module);
    let opened = null;
    name.addEventListener("click", async () => {
      if (opened) { opened.parentNode?.removeChild(opened); opened = null; return; }
      const here = el("tr", "module-opened");
      const panel = el("td", "panel");
      panel.setAttribute("colspan", "6");
      here.append(panel);
      opened = here;
      body.insertBefore(here, tr.nextSibling);
      try {
        const file = renderArtifact((await snapshot.read(row.describedBy)) ?? "");
        if (opened === here) panel.append(file, el("p", "module-folder", `Folder: ${graph.nodes.get(row.module)?.folder ?? ""}`), list(row.code));
      } catch (failure) {
        if (opened === here) panel.append(problemLine("The module's file", failure));
      }
    });
    body.append(tr);
  }
  const head = el("tr", null, ...MODULE_COLUMNS.map((title) => el("th", null, title)));
  const box = el("div", "table-scroll", el("table", "list", el("thead", null, head), body));
  box.setAttribute("tabindex", "0");
  box.setAttribute("role", "region");
  box.setAttribute("aria-label", "Modules");
  return el("section", "modules-table", el("h3", null, "Modules"), box);
}

// The next step a gap offers (UC-025 step 6), on the default branch only: *Change the architecture* for a requirement without a module (UC-023), to the review pages' list of the architecture's decisions, and
// *Implement* for a module without code or without tests (UC-024), to the route `implement`. Each is a link; it starts and writes nothing.
const NEXT_STEP = {
  "requirement-without-module": { className: "gap-change-architecture", text: "Change the architecture", route: "decision" },
  "module-without-code": { className: "gap-implement", text: "Implement", href: "#implement" },
  "module-without-test": { className: "gap-implement", text: "Implement", href: "#implement" },
};

// The file a gap concerns, as the version drawn holds it (UC-025 step 6): a markdown file rendered, a code file as its text, and for a folder the files that lie in it.
async function gapFile(snapshot, path) {
  const text = await snapshot.read(path);
  if (text == null) return el("ul", "trace-list", ...snapshot.paths.filter((each) => each.startsWith(`${path}/`)).map((each) => el("li", null, each)));
  return path.endsWith(".md") ? renderArtifact(text) : el("pre", "gap-code", text);
}

// Every gap of moduleRows with the artifact it concerns (UC-025 step 4), or the line that there is none (4a); with `next`, the step its kind offers; the artifact leads to its file (step 6).
function modulesGaps(gaps, ref, next, snapshot, product) {
  if (!gaps.length) return el("p", "no-gaps", `There are no gaps at ${ref}.`);
  const list = el("ul", "trace-list", ...gaps.map((gap) => {
    const item = el("li", "module-gap");
    item.setAttribute("data-kind", gap.kind);
    // The artifact leads to the file it concerns, the module's file or the code file or folder; a requirement is no such file.
    const file = gap.path && gap.kind !== "requirement-without-module" ? opener(gap.artifact, () => gapFile(snapshot, gap.path)) : null;
    item.append(file?.button ?? gap.artifact, ` — ${gap.what}`);
    const step = next ? NEXT_STEP[gap.kind] : undefined;
    if (step) {
      // *Change the architecture* leads to a route of the review pages and keeps the product; *Implement* leads to the implementation pages' route.
      const link = step.route ? reviewLink(`${step.className} btn small`, step.text, step.route, {}, product) : el("a", `${step.className} btn small`, step.text);
      if (!step.route) link.setAttribute("href", step.href);
      item.append(" ", link);
    }
    if (file) item.append(file.opened);
    return item;
  }));
  return el("section", "modules-gaps", el("h3", null, "Gaps"), list);
}

// The modules page (UC-025): the component diagram of the modules of the version handed, drawn through renderMermaid, the table of the modules and every gap, all from the one graph of that version. It offers no
// version choice and reads no tag: the view's versions are "branch". Where the version holds no module it says so, and where the graph cannot be read it names that.
// While the head's graph is not stored, `earlier` ({ commit, line }) is the commit whose graph latestGraph gives: the page is drawn at it, with the line.
async function drawModules(target, context, host, ref, descriptor, earlier = null) {
  const shown = { target, ref: earlier?.commit ?? ref, onDefaultBranch: false, spec: null, source: null, requirements: [], groups: [], context, snapshot: null, facts: null,
    asOf: earlier?.line ?? null, isDefault: earlier ? Promise.resolve(false) : onDefaultBranch(host, ref) };
  shown.earlier = (commit, line) => drawModules(target, context, host, ref, descriptor, { commit, line });
  drawn.set(context, shown);
  const place = el("div", "modules-body", el("p", "traces-reading", "Reading the modules…"));
  target.replaceChildren(el("section", "modules head", el("h2", null, descriptor.title), ...(shown.asOf ? [earlierLine(shown.asOf)] : []), place));
  let files, graph;
  try {
    shown.snapshot = await host.readSnapshot(shown.ref);
    graph = await factsOf(shown).graph();
    files = await moduleFilesOf(shown.snapshot);
  } catch (failure) {
    place.replaceChildren(problemLine("The modules", failure), ...notStoredStep(failure, context));
    return;
  }
  if (!files.length) {
    place.replaceChildren(el("p", "gaps-missing", `No modules exist at ${ref}.`));
    return;
  }
  const { rows, gaps } = moduleRows(graph);
  const next = await shown.isDefault;
  place.replaceChildren(await renderMermaid(componentDiagram(files, gaps)), explain("component-diagram"), modulesTable(rows, graph, statuses(shown.snapshot), shown.snapshot), modulesGaps(gaps, ref, next, shown.snapshot, reviewProductOf(shown.context)));
}

export const route = {
  ...heads.trace,

  subject: (params, context) => subjectOf({ title: descriptorFor(params.key)?.title ?? route.title, params, context, shown: drawn.get(context) ?? null }),

  async render(target, context, params = {}) {
    target.replaceChildren();
    drawn.set(context, { target, ref: params.ref, onDefaultBranch: false, spec: null, source: null, requirements: [], groups: [] });
    const descriptor = descriptorFor(params.key);
    if (!descriptor || !context.product?.host || !params.ref) {
      target.append(el("p", "empty", "No current requirements are recorded in SPEC.md."));
      return;
    }
    const host = context.product.host;
    if (descriptor.key === "modules") {
      await drawModules(target, context, host, params.ref, descriptor);
      return;
    }
    if (descriptor.key === "audit") {
      // The audit of a release candidate (`commit` among its params, as the release panel embeds it) is drawn at the candidate's tag, its rows derived there as
      // a release's are at the release's (ITM-1227); Tests → Audit offers the release tags alone.
      if (params.commit) {
        await drawAudit(target, context, host, params.ref, descriptor, [params.ref]);
        return;
      }
      const { names, failure } = await tagsOf(host);
      await drawAudit(target, context, host, params.ref, descriptor, names.filter((tag) => RELEASE.test(tag)), failure && failedRead("traces-problem", "The tags", failure, context),
        [await testsViews("Audit")]);
      return;
    }
    const handed = params.ref;
    // The tags are asked once, beside the first version's snapshot and the default branch: none of the three waits for another.
    const tagsRead = tagsOf(host);
    let current = false;
    let latest = 0;

    // Draws the SPEC at `ref` under the choice; of two choices made in a row, the later one is what stays. A ref chosen later that cannot be
    // read is named in place of the tree; the handed one is the caller's. What the page reads that does not wait for another read is asked at once:
    // the snapshot, the default branch and the tags; then the SPEC, the person's source, the entries waiting, the group file and the stored graph.
    // While the head's graph is not stored, `earlier` ({ commit, line }) is the commit whose graph latestGraph gives: the version drawn is that commit's, read-only, with the line.
    const draw = async (ref, chosen, earlier = null) => {
      const mine = ++latest;
      const shown = { target, ref: earlier?.commit ?? ref, chosen: ref, onDefaultBranch: false, spec: null, source: null, requirements: [], groups: [], context, snapshot: null, facts: null,
        tags: [], asOf: earlier?.line ?? null, isDefault: null };
      shown.earlier = (commit, line) => draw(ref, true, { commit, line });
      drawn.set(context, shown);
      let body;
      let waiting = null;
      let fill = null;
      let tags = [], tagsFailure = null;
      try {
        const defaultRead = shown.isDefault = earlier ? Promise.resolve(false) : onDefaultBranch(host, ref);
        const snapshot = await host.readSnapshot(shown.ref);
        shown.snapshot = snapshot;
        const specification = descriptor.key !== "gaps" && descriptor.key !== "tests";
        // The coverage gaps of the version count the requirements no use case realises in each group: they are asked now, from the file stored beside the graph.
        if (specification && snapshot.paths.includes(GROUP_PATH)) gapsShown(shown).catch(() => {});
        // Which sources moved on reads the history of the links file alone: it is asked now too, beside the SPEC.
        const movedRead = specification && snapshot.paths.includes(SOURCE_LINKS) ? movedSources(host, shown.ref, sourceSchemas().links) : null;
        movedRead?.catch(() => {});
        const specRead = snapshot.read(SPEC_PATH);
        const groupRead = specification ? snapshot.read(GROUP_PATH) : null;
        groupRead?.catch(() => {});
        const [text, isDefault, told] = await Promise.all([specRead, defaultRead, tagsRead]);
        ({ names: tags, failure: tagsFailure } = told);
        shown.tags = tags;
        shown.onDefaultBranch = isDefault;
        shown.spec = parseSpec(text ?? "");
        shown.specText = text ?? "";
        const editable = specification && isDefault;
        // The person's own source belongs to the person, not to the version shown: it is read wherever the page shows the current state — the default
        // branch, or the earlier version shown while the head's graph is stored —, so that a message of the prompt bar can hand a change on (UC-049).
        const current = specification && (isDefault || Boolean(earlier));
        // Whether a source moved on is asked now, beside the entries and the arrangement; its rows are marked once the page is drawn.
        const moved = specification ? sourceChanged(shown, movedRead) : null;
        moved?.catch(() => {});
        const [source, open, groupText] = await Promise.all([current ? personsSource(context, snapshot) : null, editable ? waitingEntries(snapshot) : [], groupRead]);
        if (descriptor.key === "gaps") {
          const place = el("div", "gaps-body", el("p", "traces-reading", "Reading the gaps…"));
          body = el("section", "gaps head", el("h2", null, descriptor.title), place);
          fill = () => showGaps(place, shown);
        } else if (descriptor.key === "tests") {
          const place = el("div", "tests-page", el("p", "traces-reading", "Reading the tests…"));
          // Arranging leads to writing, so *Arrange* stands on the default branch's head only (UC-021 step 1), to the review pages' arrange/tests with the product kept.
          const arrange = shown.onDefaultBranch ? [el("p", "tests-change-links", reviewLink("arrange-link", "Arrange", "arrange", { kind: "tests" }, reviewProductOf(context)))] : [];
          body = el("section", "tests head", el("h2", null, descriptor.title), await testsViews("Browser"), ...arrange, place);
          fill = () => showTests(place, shown, params);
        } else {
          if (current) shown.source = source;
          waiting = waitingSection(open, reviewProductOf(context));
          const arranged = await arrangement(snapshot, shown.spec, open, groupText);
          const adding = shown.onDefaultBranch ? addLinks(shown.spec, reviewProductOf(context)) : null;
          body = shown.onDefaultBranch
            ? el("div", "specification-page", overview(arranged, true, shown, descriptor, params), ...(adding ? [adding] : []), specChangeLinks(reviewProductOf(context)))
            : overview(arranged, false, shown, descriptor, params);
          fill = () => Promise.all([markSourceChanged(shown, moved), countUnrealised(shown, arranged)]);
        }
      } catch (error) {
        if (!chosen) throw error;
        ({ names: tags, failure: tagsFailure } = await tagsRead);
        body = failedRead("version-problem", ref, error, context);
      }
      if (mine !== latest) return;
      if (!chosen) current = shown.onDefaultBranch;
      // The specification and the gaps, once drawn, offer a second version to compare with; what the comparison shows stands below the bar.
      const compared = el("div", "version-compared-box");
      const compare = OTHER[descriptor.key] && shown.spec ? { key: descriptor.key, box: compared } : null;
      // The SPEC changes waiting for acceptance stand first, above the version choice, the narrowing and the tree.
      target.replaceChildren(...(waiting ? [waiting] : []), versionChoice({ shown, handed, current, tags, tagsFailure, choose: (next) => draw(next, true), other: OTHER[descriptor.key], compare }),
        ...(compare ? [compared] : []), body);
      if (fill) await fill();
    };
    await draw(handed, false);
  },
};
