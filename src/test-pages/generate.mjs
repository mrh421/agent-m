// The route `generate` — generating tests, up to the proposal (UC-026 steps 1 to 4, 3a, 4a), as docs/architecture/MOD-test-pages.md states it and ITM-763 builds it: the requirements, use cases and
// modules of the product's graph with the levels whose tests already guard each, the uncovered combinations preselected; the levels chosen, each with a folded *What is this?* naming the book's chapter; the
// participants that fill the test-writing role, the implementer left out for the level `release` and said so (4a); the run panel of the kind `propose-tests`, whose *Run* queues one job of that kind; a
// selection whose existing tests do not fit the participant's context sends nothing and offers a smaller one (3a).
//
// ITM-764 adds the rest (UC-026 steps 5 to 8, 5a, 6a, 8b, 1a): the cases of the proposal, read from the end record of the job through listJobs — for a job on CI or a Bridge, and for an attended one that
// wrote its record —, grouped by level and by what they guard, each beside the existing tests of the same identifier, with the flags the rounds left and their number; the person removes, edits or
// reclassifies cases; *Write tests* queues one job of the kind `write-tests` with the cases as the person left them.
//
// Readings the texts leave open, each named in the pull request:
//   - a combination is a name and a level that fits its kind (UC-026's table): a requirement is checked at `release` and `user`, a use case at `system`, a module at `unit` and `component`; a combination is
//     uncovered when no test of that level guards the name (a test guards a module it names in its `Module:` line too, as the recipe test-selection counts it);
//   - a name is preselected when one of its combinations is uncovered, a level when one of the preselected names has it uncovered;
//   - the implementer of what a selection checks is the participant of a job of kind `implement` whose `worksOn` names a selected name, or an item or use case that names a selected requirement;
//   - the page asks for the person's own name, as the release panel does, since no setting holds an identity;
//   - the run is queued on the first route routesFor offers the participant, and nothing is run in the tab;
//   - the proposal is read from the end record's `draft` of the job queued from this page, else of the newest job of kind `propose-tests` that has one; the flags the rounds left are the findings of the last
//     round, their number the rounds of the record;
//   - a case is edited in its precondition, input and expected result, reclassified in its level and its class; a case is a duplicate by its class, and the cases are handed over as they stand, duplicates among them
//     unless the person removes them, and none when every one is a duplicate (6a);
//   - a case that carries a `paid` call is marked for the nightly or release run (5a); a test the report of the last `write-tests` job lists in `notWritten` is shown again beside its reason (8b);
//   - *Write tests* queues the job for the participant of the proposal, with the selection and levels of the proposal's record, the cases as `draft`, and the route as `route`, which the recipe `resource-pins` reads.
//
// ITM-1223 draws the route in the site's one look (look.mjs): the frame's head with the Tests entry's views; the names to test, the levels and the participants
// that write tests as rows of the frame's table, each cell labelled by its column; each step a panel. A proposed case, which the person edits, stays an item of
// its group's list. ITM-1225: each level's fold is the frame's `explain` of its topic in explanations.md (look.mjs' LEVEL_TOPIC); the page builds no fold of its own.
//
// ONE CLICK PER DECISION; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK: nothing is written or sent while the page is drawn or the run panel shown; Run, the panel's own
// button, is the one click that queues the job.
//
// Module: MOD-test-pages

import { readDocument } from "../documents/index.mjs";
import { isTestFile, testDeclarations } from "../test-document/index.mjs";
import { storedGraph, tracesTo } from "../trace-graph/index.mjs";
import { eligible, participantSchema, participantsOf } from "../participant-list/index.mjs";
import { kindOf } from "../job-catalogue/index.mjs";
import { prepareJob } from "../job-runner/index.mjs";
import { listJobs, newJobId } from "../job-ledger/index.mjs";
import { queueJob, routesFor } from "../runtimes/index.mjs";
import { explain, runPanel, readProblem } from "../site-frame/index.mjs";
import { reachableBy, resourceSchema } from "../resource-list/index.mjs";
import { readRegister } from "../documents/index.mjs";
import { testsHead, readsAt, column, listTable, LEVEL_TOPIC } from "./look.mjs";

const REGISTER = "docs/participants.md";
const WORKFLOWS = [".github/workflows/agent-m-jobs.yml", ".gitlab/agent-m-jobs.yml"];
const JOB_FILE = /^docs\/jobs\/(JOB-[^/]+)\.md$/;
const LEVELS = ["unit", "component", "system", "release", "user"];
// The levels that fit a kind of name (UC-026's table: unit from a module, component from its modules, system from a use case, release and user from a requirement).
const FITTING = { requirement: ["release", "user"], UC: ["system"], MOD: ["unit", "component"] };
const PARAMETER = { requirement: "requirements", UC: "useCases", MOD: "modules" };

const TITLE = "Generate tests";

function el(name, className, ...children) {
  const node = document.createElement(name);
  if (className) node.className = className;
  node.append(...children);
  return node;
}

// A button that answers a person's click only (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK).
function button(className, text, listener) {
  const node = el("button", className, text);
  node.type = "button";
  node.addEventListener("click", (event) => (event?.isTrusted === true ? listener(event) : undefined));
  return node;
}

const walk = (node) => [...node.childNodes].flatMap((kid) => (kid.nodeType === 1 ? [kid, ...walk(kid)] : []));
const inputsOf = (root, className) => walk(root).filter((node) => node.localName === "input" && node.className.split(" ").includes(className));

// The tests that guard a name: those `tracesTo` finds, and, for a module, those that exercise it.
function guardingTests(graph, name) {
  const exercising = graph.nodes.get(name)?.kind === "MOD"
    ? graph.edges.filter((edge) => edge.via === "exercises" && edge.to === name).map((edge) => edge.from) : [];
  return [...new Set([...tracesTo(graph, name).tests, ...exercising])];
}

async function loadProduct(host) {
  const info = await host.repositoryInfo();
  const snapshot = await host.readSnapshot(info.defaultBranch);
  const declarations = (await Promise.all(snapshot.paths.filter(isTestFile).map(async (path) => testDeclarations(path, (await snapshot.read(path)) ?? "")))).flat();
  const graph = await storedGraph(snapshot, snapshot.commit);
  const levelOf = new Map(declarations.map((declaration) => [declaration.id, declaration.level]));
  const names = [...graph.nodes.values()].filter((node) => FITTING[node.kind]).sort((a, b) => a.id.localeCompare(b.id))
    .map((node) => {
      const covered = new Set(guardingTests(graph, node.id).map((id) => levelOf.get(id)).filter(Boolean));
      return { id: node.id, kind: node.kind, covered: LEVELS.filter((level) => covered.has(level)), uncovered: FITTING[node.kind].filter((level) => !covered.has(level)) };
    });
  return { info, snapshot, graph, names, declarations };
}

// The participants of the instance's register that can do what the kind needs.
async function loadParticipants(context, definition) {
  const instance = context.instance.host;
  const { defaultBranch } = await instance.repositoryInfo();
  const snapshot = await instance.readSnapshot(defaultBranch);
  const register = await snapshot.read(REGISTER);
  const participants = register === null ? [] : participantsOf(readDocument(participantSchema(), REGISTER, register));
  return { participants, instanceSnapshot: snapshot, writers: eligible(participants, { capabilities: definition.needs }).eligible };
}

// The participants of the jobs of kind `implement` that worked on what the selection checks.
async function implementersOf(product, host, selected) {
  const behaviour = new Set(selected.map((each) => each.id));
  for (const each of selected) {
    if (each.kind !== "requirement") continue;
    const traces = tracesTo(product.graph, each.id);
    for (const name of [...traces.items, ...traces.useCases]) behaviour.add(name);
  }
  const rows = await listJobs([{ address: product.snapshot.repository?.web ?? "", snapshot: product.snapshot }], new Map());
  return new Set(rows.filter((row) => row.record.kind === "implement" && row.record.participant && row.record.worksOn.some((name) => behaviour.has(name)))
    .map((row) => row.record.participant));
}

const recordRoute = (route) => (route.kind === "tab" ? "tab" : route.kind === "ci" ? (route.runner === "hosted" ? "ci hosted" : `ci runner:${route.runner}`) : `bridge ${route.bridge}`);

async function render(target, context, params = {}) {
  if (!context.product) {
    target.replaceChildren(testsHead(context, { title: TITLE, shown: "Generate" }), el("p", null, "Choose a product to generate tests for."));
    return;
  }
  const { host } = context.product;
  let product, definition, register;
  try {
    definition = await kindOf("propose-tests");
    product = await loadProduct(host);
    register = await loadParticipants(context, definition);
  } catch (failure) {
    target.replaceChildren(testsHead(context, { title: TITLE, shown: "Generate" }), readProblem(failure, Boolean(context.product.tokenStored)));
    return;
  }

  const preselectedLevels = new Set(product.names.filter((each) => each.uncovered.length).flatMap((each) => each.uncovered));
  const list = listTable(["Name", "Kind", "Guarded at", "Not guarded at"], product.names.map((each) => {
    const box = el("input", "name");
    box.type = "checkbox";
    box.value = each.id;
    box.checked = each.uncovered.length > 0;
    const item = el("tr", each.uncovered.length ? "uncovered" : "covered", column("Name", el("label", null, box, ` ${each.id}`)),
      column("Kind", el("span", "kind", each.kind === "requirement" ? "requirement" : each.kind === "UC" ? "use case" : "module")),
      column("Guarded at", el("span", "covered", `guarded at: ${each.covered.join(", ") || "no level"}`)),
      column("Not guarded at", el("span", "uncovered", each.uncovered.length ? `not guarded at: ${each.uncovered.join(", ")}` : "—")));
    item.setAttribute("data-name", each.id);
    return item;
  }));
  const levels = listTable(["Level", "What it checks"], LEVELS.map((level) => {
    const box = el("input", "level");
    box.type = "checkbox";
    box.value = level;
    box.checked = preselectedLevels.has(level);
    const item = el("tr", "level", column("Level", el("label", null, box, ` ${level}`)), column("What it checks", explain(LEVEL_TOPIC[level])));
    item.setAttribute("data-level", level);
    return item;
  }));

  const person = el("input", "person");
  person.placeholder = "Your name";
  let queuedId = null;
  const participantsBox = el("section", "panel writers");
  const proposalBox = el("section", "proposal");
  const stage = el("div", "stage");
  const selection = () => ({
    names: inputsOf(list, "name").filter((box) => box.checked).map((box) => product.names.find((each) => each.id === box.value)),
    levels: inputsOf(levels, "level").filter((box) => box.checked).map((box) => box.value),
  });

  async function showParticipants() {
    stage.replaceChildren();
    const { names, levels: chosen } = selection();
    const rows = [];
    let writers = register.writers;
    const notes = [];
    if (chosen.includes("release")) {
      const implementers = await implementersOf(product, host, names);
      const left = writers.filter((writer) => implementers.has(writer.name));
      writers = writers.filter((writer) => !implementers.has(writer.name));
      for (const writer of left) notes.push(el("p", "left-out", `${writer.name} is left out: it implemented what the release tests check, and release tests are written by a participant other than the implementer.`));
      if (left.length && !writers.length) {
        // Each leads to its use case only through the context's go, as the frame's button (MOD-test-pages; views.mjs does the same).
        const [first, second] = ["UC-017", "UC-002"].map((id) => {
          const lead = el("button", "btn", id);
          lead.setAttribute("type", "button");
          lead.addEventListener("click", () => context.go("use-case", { id }));
          return lead;
        });
        notes.push(el("p", "release-needs-another", "Release tests need a participant other than the implementer; the only participant that fills the role is the implementer. See ", first, " and ", second,
          ". The other levels can still be generated: leave release unticked."));
      }
    }
    for (const writer of writers) {
      const box = el("input", "participant");
      box.type = "radio";
      box.name = "participant";
      box.value = writer.name;
      const offers = routesFor(writer, register.participants, { visibility: product.info.visibility, jobWorkflow: WORKFLOWS.some((path) => product.snapshot.paths.includes(path)) }, []);
      const item = el("tr", "participant", column("Participant", el("label", null, box, ` ${writer.name}`)),
        column("Processing place", el("span", "place", writer.place ?? "no processing place declared")),
        column("Routes", el("span", "route", offers.length ? offers.map((offer) => `${recordRoute(offer.route)}${offer.available ? "" : " — not available"}`).join(", ") : "no route of a job")));
      item.setAttribute("data-name", writer.name);
      rows.push(item);
    }
    const offered = rows.length ? listTable(["Participant", "Processing place", "Routes"], rows) : el("p", "muted", "No participant can write the tests chosen.");
    participantsBox.replaceChildren(el("h3", null, "Participants that write tests"), explain("independent-release-tests"), ...notes, offered);
  }

  async function showPanel() {
    stage.replaceChildren();
    const { names, levels: chosen } = selection();
    const chosenWriter = inputsOf(participantsBox, "participant").find((box) => box.checked)?.value;
    const writer = register.writers.find((each) => each.name === chosenWriter);
    if (!names.length || !chosen.length) { stage.append(el("p", "problem", "Choose at least one requirement, use case or module and one level.")); return; }
    if (!writer) { stage.append(el("p", "problem", "Choose the participant that writes the tests.")); return; }
    if (!(person.value ?? "").trim()) { stage.append(el("p", "problem", "Enter your name first.")); return; }
    const selected = { requirements: [], useCases: [], modules: [] };
    for (const each of names) selected[PARAMETER[each.kind]].push(each.id);
    const taParams = { ...selected, levels: chosen };
    const now = new Date();
    const id = newJobId(now, new Set(product.snapshot.paths.map((path) => JOB_FILE.exec(path)?.[1]).filter(Boolean)));
    const agentM = { version: register.instanceSnapshot.commit ?? "unknown", commit: register.instanceSnapshot.commit ?? "unknown" };
    const jobContext = { kind: definition, params: taParams, product: { address: product.snapshot.repository?.web ?? context.product.address, snapshot: product.snapshot, host },
      instance: { snapshot: register.instanceSnapshot, host: context.instance.host, checkout: null }, connect: async () => host, participants: register.participants,
      places: { sources: {}, mailbox: null }, gates: [], person: person.value.trim(), now, agentM, jobId: id };
    let prepared;
    try {
      prepared = await prepareJob("propose-tests", jobContext, { drafter: writer, reviewers: [] });
    } catch (failure) {
      stage.append(readProblem(failure, Boolean(context.product.tokenStored)));
      return;
    }
    const offer = routesFor(writer, register.participants, { visibility: product.info.visibility, jobWorkflow: WORKFLOWS.some((path) => product.snapshot.paths.includes(path)) }, [])[0];
    let queued = false;
    const result = el("section", "job");
    const panel = runPanel(prepared, {
      onRun: async () => {
        if (queued) return;
        queued = true;
        try {
          if (!offer || !offer.available) throw Object.assign(new Error(offer ? offer.reason : "the participant has no route of a job"), { name: "RouteUnavailable" });
          const record = { id, kind: "propose-tests", worksOn: names.map((each) => each.id), participant: writer.name, model: writer.model, route: recordRoute(offer.route), run: null,
            retries: null, startedBy: person.value.trim(), start: now, agentM, inputs: prepared.parts.map((part) => part.name), limit: prepared.limit,
            destinations: prepared.destinations.map((each) => ({ participant: each.participant.name, place: each.place, parts: each.parts })), params: taParams };
          await queueJob(host, record, offer.route, product.snapshot.commit);
          queuedId = id;
          result.append(el("p", "queued", `Job ${id} is queued on the route ${recordRoute(offer.route)}.`));
        } catch (failure) {
          queued = false;
          result.append(el("p", "result problem", `${failure.name}: ${failure.message}`));
        }
      },
    });
    stage.append(explain("run-panel"), panel);
    if (prepared.notFitting.length) {
      const guarding = new Set(names.flatMap((each) => guardingTests(product.graph, each.id))).size;
      stage.append(el("p", "too-large", `${guarding} existing tests guard this selection and they do not fit into the context of ${prepared.notFitting.map((each) => each.participant.name).join(", ")}. `
        + "Nothing is sent. Choose a smaller selection or a participant with a larger context."));
    }
    stage.append(result);
  }

  // ---------------------------------------------------------------- the proposal (UC-026 steps 5 to 8)

  async function loadProposal() {
    proposalBox.replaceChildren();
    let rows, snapshot;
    try {
      snapshot = await host.readSnapshot(product.info.defaultBranch);
      rows = await listJobs([{ address: snapshot.repository?.web ?? context.product.address, snapshot }], new Map());
    } catch (failure) {
      proposalBox.append(readProblem(failure, Boolean(context.product.tokenStored)));
      return;
    }
    const proposed = rows.filter((row) => row.record.kind === "propose-tests" && Array.isArray(row.record.end?.draft?.cases));
    const row = proposed.find((each) => each.record.id === queuedId) ?? proposed[0];
    if (!row) {
      proposalBox.append(el("p", "no-proposal", "No proposal is recorded yet: the job has not ended, or has handed back no cases."));
      return;
    }
    const unwritten = rows.filter((each) => each.record.kind === "write-tests" && Array.isArray(each.record.end?.draft?.notWritten)).flatMap((each) => each.record.end.draft.notWritten);
    paintCases(row.record, unwritten, snapshot);
  }

  function selectOf(className, values, chosen) {
    const node = el("select", className, ...values.map((value) => { const option = el("option", null, value); option.value = value; if (value === chosen) option.setAttribute("selected", ""); return option; }));
    node.value = chosen;
    return node;
  }
  const fieldOf = (className, value) => { const node = el("textarea", className); node.value = value ?? ""; return node; };

  function paintCases(record, unwritten, snapshot) {
    const cases = record.end.draft.cases;
    const left = (record.end.rounds ?? []).at(-1)?.findings ?? [];
    const summary = el("p", "rounds", `Correction rounds: ${(record.end.rounds ?? []).length}`);
    const flags = el("ul", "flags", ...left.map((found) => el("li", "flag", `${found.rule ? `${found.rule}: ` : ""}${found.what ?? String(found)}`)));
    const reasons = new Map(unwritten.map((each) => [each.identifier, each.reason ?? each.why ?? ""]));
    const groups = new Map();
    for (const one of cases) {
      const key = `${one.level}\u0000${(one.guards ?? []).join(", ")}`;
      if (!groups.has(key)) groups.set(key, { level: one.level, guards: (one.guards ?? []).join(", "), cases: [] });
      groups.get(key).cases.push(one);
    }
    const sections = [];
    for (const group of [...groups.values()].sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level) || a.guards.localeCompare(b.guards))) {
      const items = group.cases.map((one) => caseItem(one, reasons));
      const section = el("section", "case-group", el("h4", null, `${group.level} — guards ${group.guards || "nothing"}`), el("ul", null, ...items));
      section.setAttribute("data-level", group.level);
      section.setAttribute("data-guards", group.guards);
      sections.push(section);
    }
    const holder = el("div", "cases", ...sections);
    const outcome = el("section", "write-result");
    const write = button("btn write", "Write tests", () => writeTests(record, holder, outcome, snapshot));
    proposalBox.replaceChildren(summary, flags, holder, ...(allDuplicates(holder) ? [] : [write]), outcome);
    if (allDuplicates(holder)) proposalBox.append(el("p", "all-duplicates", "Every proposed case is a duplicate of an existing test. Nothing is written."));
  }

  function caseItem(one, reasons) {
    const existing = product.declarations.filter((declaration) => declaration.id === one.identifier);
    const beside = existing.length
      ? existing.map((declaration) => el("div", "existing", `Existing ${declaration.id} (${declaration.level}), expects: ${declaration.expect ?? ""}`))
      : [el("div", "existing", "No existing test has this identifier.")];
    const marks = [];
    if (one.paid) marks.push(el("span", "nightly", `needs a paid call (${one.paid}): proposed for the nightly or release run only`));
    if (one.level === "user") marks.push(el("span", "manual", "manual test instructions: no code is written and no counter-proof is taken, since a person carries the test out and enters the outcome (UC-028)"));
    if (reasons.has(one.identifier)) marks.push(el("span", "not-written", `not written: ${reasons.get(one.identifier)} — sharpen it or drop it`));
    const item = el("li", "case", el("span", "id", one.identifier), " ",
      selectOf("case-level", LEVELS, one.level), selectOf("case-class", ["new", "extends", "duplicate"], one.class), one.of ? el("span", "of", ` of ${one.of}`) : "", " ",
      ...marks, ...beside, el("label", null, "Precondition ", fieldOf("case-precondition", one.precondition)), el("label", null, "Input ", fieldOf("case-input", one.input)),
      el("label", null, "Expected ", fieldOf("case-expected", one.expected)));
    item.setAttribute("data-case", one.identifier);
    const original = structuredClone(one);
    item.caseOf = () => ({ ...original, level: byClass(item, "case-level").value, class: byClass(item, "case-class").value, precondition: byClass(item, "case-precondition").value,
      input: byClass(item, "case-input").value, expected: byClass(item, "case-expected").value });
    const remove = button("btn remove", "Remove", () => { item.parentNode.removeChild(item); });
    item.append(remove);
    return item;
  }
  const byClass = (root, className) => walk(root).find((node) => node.className.split(" ").includes(className));
  const itemsOf = (holder) => walk(holder).filter((node) => node.localName === "li" && node.className.split(" ").includes("case"));
  const allDuplicates = (holder) => { const items = itemsOf(holder); return items.length > 0 && items.every((item) => item.caseOf().class === "duplicate"); };

  async function writeTests(record, holder, outcome, snapshot) {
    outcome.replaceChildren();
    const items = itemsOf(holder);
    const cases = items.map((item) => item.caseOf());
    if (!cases.length || cases.every((one) => one.class === "duplicate")) {
      outcome.append(el("p", "all-duplicates", cases.length ? "Every case is a duplicate of an existing test. Nothing is written." : "No case is left. Nothing is written."));
      return;
    }
    const writer = register.writers.find((each) => each.name === record.participant);
    if (!writer) { outcome.append(el("p", "problem", `${record.participant} is not among the participants that write tests.`)); return; }
    const kind = await kindOf("write-tests");
    const text = await snapshot.read("docs/resources.md");
    const needs = typeof text === "string" ? reachableBy(readRegister(resourceSchema(), "docs/resources.md", text).rows.map((each) => ({ name: each.cells.Name, route: each.cells.Route }))) : [];
    const offer = routesFor(writer, register.participants, { visibility: product.info.visibility, jobWorkflow: WORKFLOWS.some((path) => snapshot.paths.includes(path)) }, needs)[0];
    const params = { requirements: record.params?.requirements ?? [], useCases: record.params?.useCases ?? [], modules: record.params?.modules ?? [], levels: record.params?.levels ?? [],
      route: offer ? recordRoute(offer.route) : null, draft: { cases } };
    const now = new Date();
    const id = newJobId(now, new Set(snapshot.paths.map((path) => JOB_FILE.exec(path)?.[1]).filter(Boolean)));
    const agentM = { version: register.instanceSnapshot.commit ?? "unknown", commit: register.instanceSnapshot.commit ?? "unknown" };
    const person = record.startedBy;
    try {
      const prepared = await prepareJob("write-tests", { kind, params, product: { address: snapshot.repository?.web ?? context.product.address, snapshot, host },
        instance: { snapshot: register.instanceSnapshot, host: context.instance.host, checkout: null }, connect: async () => host, participants: register.participants,
        places: { sources: {}, mailbox: null }, gates: [], person, now, agentM, jobId: id }, { drafter: writer, reviewers: [] });
      if (prepared.blocking.length) throw Object.assign(new Error(prepared.blocking.map((found) => `${found.what} — ${found.fix}`).join("; ")), { name: "Blocked" });
      if (!offer || !offer.available) throw Object.assign(new Error(offer ? offer.reason : "the participant has no route of a job"), { name: "RouteUnavailable" });
      const written = { id, kind: "write-tests", worksOn: record.worksOn, participant: writer.name, model: writer.model, route: recordRoute(offer.route), run: null, retries: null,
        startedBy: person, start: now, agentM, inputs: prepared.parts.map((part) => part.name), limit: prepared.limit,
        destinations: prepared.destinations.map((each) => ({ participant: each.participant.name, place: each.place, parts: each.parts })), params };
      await queueJob(host, written, offer.route, snapshot.commit);
      outcome.append(el("p", "queued", `Job ${id} of the kind write-tests is queued on the route ${recordRoute(offer.route)} with ${cases.length} cases.`));
    } catch (failure) {
      outcome.append(el("p", "result problem", `${failure.name}: ${failure.message}`));
    }
  }

  for (const box of [...inputsOf(list, "name"), ...inputsOf(levels, "level")]) box.addEventListener("change", () => showParticipants());
  const show = button("btn prepare", "Show the run panel", showPanel);
  const read = button("btn read", "Read the proposal", () => loadProposal());
  await showParticipants();
  const head = testsHead(context, { title: TITLE, shown: "Generate", reads: readsAt(context.product.address, product.info.defaultBranch) });
  head.append(explain("release-test-levels"));
  target.replaceChildren(head,
    el("section", "panel to-test", el("h3", null, "What can be tested"), list), el("section", "panel chosen-levels", el("h3", null, "Levels"), levels),
    participantsBox, el("section", "panel run-step", el("h3", null, "Run"), el("label", null, "Your name ", person), " ", show, stage),
    el("section", "panel proposal-step", el("h3", null, "The proposal"), read, proposalBox));
  stage.replaceChildren();
}

export const route = { name: "generate", entry: "tests", title: TITLE, render };
