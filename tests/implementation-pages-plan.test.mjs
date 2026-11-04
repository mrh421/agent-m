// MOD-implementation-pages' route `plan` — the architecture beside the plan's steps and their states (ITM-1057), as the accepted text of
// docs/architecture/MOD-implementation-pages.md states it: "`plan` — the architecture's subsystems and modules beside the plan's steps
// with their derived states and what each waits for", and UC-045 step 1 (the accepted architecture and the plan's steps in their order,
// each with its derived state, a folded What is this?), 1a (a model that works from a backlog has no plan; the page links to the backlog)
// and 1b (an architecture that is not accepted: the page names what is open and plans nothing). Step 4's diagram of the steps and what
// each waits for is drawn through MOD-markdown-render's renderMermaid.
// Run: node --test tests/implementation-pages-plan.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-045; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; DIAGRAMS ARE MERMAID IN MARKDOWN; EVERY STEP EXPLAINS ITSELF; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN
// Level: unit
//
// Each test states its input and its expected result before it runs (given / input / expect). The product is a V-model (or Scrum) fixture
// held in memory behind a host of this file's own that answers MOD-repository-hosts' interface; nothing reaches the network, and Mermaid is
// replaced by a recorder that keeps the text of every diagram it is handed, as tests/trace-pages-modules.test.mjs does. The readings the
// pull request names: the steps and their states are those MOD-progress-measures' productFacts gives (it derives them with itemStates
// from the product's files, the job records and the pull requests); an architecture file is open when MOD-approvals' status of it,
// as productFacts gives it, is not accepted. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { withStoredGraph } from "./stored-graph-fake.mjs";

// The fixture DOM of the frame, installed as the globals `document` and `window` when it is imported.
import "./site-frame-dom.mjs";
const { view } = await import("../src/implementation-pages/index.mjs");

const route = view.routes.find((candidate) => candidate.name === "plan");

// ---------------------------------------------------------------- the DOM
const elements = (root, match) => {
  const found = [];
  (function walk(n) { for (const k of n.childNodes) if (k.nodeType === 1) { if (match(k)) found.push(k); walk(k); } })(root);
  return found;
};
const byData = (root, attribute, value) => elements(root, (e) => (value === undefined ? e.getAttribute(attribute) !== null : e.getAttribute(attribute) === value));
const byTag = (root, name) => elements(root, (e) => e.localName === name);

// ---------------------------------------------------------------- the fixture product
const lines = (...rows) => `${rows.join("\n")}\n`;
const blobOf = (text) => createHash("sha1").update(text).digest("hex");
const ADDRESS = "https://github.com/acme/product";
const MODEL_VERSION = "5".repeat(40);

const decision = (id, extra) => lines("---", `id: ${id}`, `title: ${id} decision`, ...extra, "---", `# ${id} decision`, "", "## Context", "", "c", "", "## Decision", "", "d", "",
  "## Alternatives", "", "a", "", "## Consequences", "", "q");
const module_ = (id) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", "  - ARC-002", "uses: []", "provides:", "  - f", "---",
  `# ${id} ${id}`, "", "## Responsibility", "", "r", "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `f` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
const step = (id, title, extra = []) => lines("---", `id: ${id}`, `title: ${title}`, "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-reader", ...extra,
  "tests:", "  - unit", "origin:", "  - UC-001", "---", `# ${id} ${title}`, "", "## Outcome", "", "o", "", "## Acceptance", "", "a");
const declaration = (model) => lines("---", `model: ${model}`, `model_file: src/model-catalogue/models/${model}.md`, `model_version: ${MODEL_VERSION}`, "---",
  "# Process", "", "## Practices", "", "- none", "", "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "| Implementation | work/<item> |", "",
  "## Definition of Done", "", "The job rules hold; no condition is added.");

const ARCHITECTURE = {
  "docs/architecture/ARC-001-whole.md": decision("ARC-001", ["forced_by:", "  - UC-001"]),
  "docs/architecture/ARC-002-sub.md": decision("ARC-002", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-reader", "  - MOD-writer"]),
  "docs/architecture/MOD-reader.md": module_("MOD-reader"),
  "docs/architecture/MOD-writer.md": module_("MOD-writer"),
  "docs/architecture/MOD-loose.md": module_("MOD-loose"),
};
const USE_CASE = "docs/use-cases/UC-001-load.md";
// The steps: file order ITM-010, ITM-011, ITM-012, ITM-013; the plan's order puts ITM-012 first, and ITM-011 builds on ITM-010. The V-model's gate Design → Implementation, decided by the Reviewer, has no record, so ITM-013, a step of the phase Implementation that builds on nothing, waits for it.
const PLAN = {
  "docs/plan/ITM-010-reader.md": step("ITM-010", "Read the store"),
  "docs/plan/ITM-011-writer.md": step("ITM-011", "Write the store", ["builds_on:", "  - ITM-010"]),
  "docs/plan/ITM-012-loose.md": step("ITM-012", "Loose ends"),
  "docs/plan/ITM-013-gated.md": step("ITM-013", "Gated work"),
  "docs/plan/order.md": lines("## Order", "", "| Step | Phase |", "| --- | --- |", "| ITM-012 | Testing |", "| ITM-010 | Testing |", "| ITM-011 | Implementation |", "| ITM-013 | Implementation |"),
};

// A product whose approval records name the current blob of every file in `accepted`; the others are open, or changed where `changed` names them.
function productFiles({ model = "v-model", accepted = "all", changed = [], plan = true } = {}) {
  const files = { "SPEC.md": "# Fixture\n", "docs/process.md": declaration(model), [USE_CASE]: "# UC-001 load\n", ...ARCHITECTURE, ...(plan ? PLAN : {}) };
  const reviewed = Object.keys(files).filter((path) => path === USE_CASE || path.startsWith("docs/architecture/"));
  const id = (path) => /(ARC-\d+|MOD-[a-z]+|UC-\d+)/.exec(path)[1];
  for (const path of reviewed) {
    if (accepted !== "all" && !accepted.includes(path)) continue;
    const blob = changed.includes(path) ? "0".repeat(40) : blobOf(files[path]);
    files[`docs/approvals/${id(path)}-${blob.slice(0, 12)}.md`] = "kind: record\n";
  }
  return files;
}

// The snapshot's commit is named by its files, so that two snapshots of different files never share a commit (the stored graph is kept per commit);
// its readOn serves the graph the push job stores for that commit (tests/stored-graph-fake.mjs), which the page reads and never builds.
function snapshotOf(files, web) {
  const commit = createHash("sha1").update(JSON.stringify(Object.entries(files).sort())).digest("hex");
  return withStoredGraph({ repository: { server: "github", path: "acme/product", web }, ref: "main", commit, paths: Object.keys(files),
    blob: (path) => (Object.hasOwn(files, path) ? blobOf(files[path]) : null), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) });
}
const INSTANCE = "# Participants\n\n**REGISTER**\n\nThe people and agents of the fixture instance.\n\n| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|\n";

// The context a route gets: the product's host and the instance's, as the frame hands them.
function contextOf(files) {
  const product = snapshotOf(files, ADDRESS);
  const instance = snapshotOf({ "SPEC.md": "# Instance\n", "docs/participants.md": INSTANCE }, "https://github.com/acme/agent-m");
  const host = (snapshot) => ({
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return snapshot; },
    // The file at each commit, as the one snapshot holds it (MOD-repository-hosts' readFileAt), for the declared model the route reads first (ITM-1260).
    async readFileAt(path, commits) { const held = await snapshot.read(path); return new Map(commits.map((commit) => [commit, held])); },
    async listPullRequests() { return []; },
    async containsCommit() { return false; },
  });
  return { product: { address: ADDRESS, host: host(product) }, instance: { host: host(instance) } };
}

// Mermaid as a recorder: the text of every diagram the page hands it.
function recorder() {
  const drawn = { texts: [] };
  globalThis.mermaid = {
    initialize() {},
    mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) },
    run: async ({ nodes }) => { drawn.texts.push(...nodes.map((node) => node.textContent)); },
  };
  return drawn;
}
async function render(files) {
  const drawn = recorder();
  const target = document.createElement("div");
  document.body.append(target);
  try { await route.render(target, contextOf(files), {}); } finally { delete globalThis.mermaid; }
  return { target, drawn };
}
const text = (node) => node.textContent.replace(/\s+/g, " ").trim();

// TST-1057001 · level: unit · module: MOD-implementation-pages
// guards: UC-045; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: a V-model product whose architecture is accepted: the system ARC-001, the subsystem ARC-002 designing MOD-reader and MOD-writer, and MOD-loose, designed by none; UC-001 accepted; a plan of four steps whose order puts ITM-012 first, then ITM-010, ITM-011 and ITM-013 (file order is ITM-010, ITM-011, ITM-012, ITM-013), ITM-011 building on ITM-010, ITM-013 in the phase Implementation, which the gate Design → Implementation, without a record, guards; no job and no pull request
// input: the route plan's render
// expect: the architecture lists ARC-001 as the system, ARC-002 as its subsystem with MOD-reader and MOD-writer under it, and MOD-loose under the system; the steps stand in the order ITM-012, ITM-010, ITM-011, ITM-013, each with its state: ITM-012 and ITM-010 ready, waiting for nothing; ITM-011 "waiting for an item it builds on", waiting for "ITM-010 is not done"; ITM-013 "waiting", waiting for the gate Design → Implementation, decided by Reviewer; a folded What is this? is there
// Planted fault: listing the steps in the order of their files, not the plan's order, fails the order assertion.
test("the plan page shows the architecture beside the steps in the plan's order, each with its state and what it waits for", async () => {
  const { target } = await render(productFiles());
  const tree = byData(target, "data-architecture").map((e) => [e.getAttribute("data-architecture"), e.getAttribute("data-kind"), e.getAttribute("data-under")]);
  assert.deepEqual(tree, [["ARC-001", "system", null], ["ARC-002", "subsystem", "ARC-001"], ["MOD-reader", "module", "ARC-002"], ["MOD-writer", "module", "ARC-002"], ["MOD-loose", "module", "ARC-001"]]);
  const rows = byData(target, "data-step");
  assert.deepEqual(rows.map((row) => row.getAttribute("data-step")), ["ITM-012", "ITM-010", "ITM-011", "ITM-013"], "the plan's order, not the files'");
  const waits = rows.map((row) => [row.getAttribute("data-state"), text(byData(row, "data-waits-for")[0])]);
  assert.deepEqual(waits.slice(0, 3), [["ready", ""], ["ready", ""], ["waiting for an item it builds on", "ITM-010 is not done"]]);
  assert.equal(waits[3][0], "waiting");
  assert.match(waits[3][1], /Design → Implementation, decided by Reviewer/);
  assert.match(text(target), /What is this\?/);
});

// TST-1057002 · level: unit · module: MOD-implementation-pages
// guards: UC-045; DIAGRAMS ARE MERMAID IN MARKDOWN
// given: the product of TST-1057001; Mermaid replaced by a recorder
// input: the route plan's render
// expect: Mermaid is handed one diagram, a flowchart whose nodes are the steps in the plan's order, each labelled with its identifier and state (a step that waits for a gate: "waiting"), and whose one edge goes from ITM-010 to ITM-011, the step that waits for it
// Planted fault: an edge drawn the other way, or a node for a step in file order, changes the text.
test("the plan page hands Mermaid one diagram of the steps and what each waits for", async () => {
  const { target, drawn } = await render(productFiles());
  assert.equal(elements(target, (e) => e.className === "mermaid").length, 1);
  assert.deepEqual(drawn.texts, [[
    "flowchart TD",
    "  ITM_012[\"ITM-012 — ready\"]",
    "  ITM_010[\"ITM-010 — ready\"]",
    "  ITM_011[\"ITM-011 — waiting for an item it builds on\"]",
    "  ITM_013[\"ITM-013 — waiting\"]",
    "  ITM_010 --> ITM_011",
  ].join("\n")]);
});

// TST-1057003 · level: unit · module: MOD-implementation-pages
// guards: UC-045
// given: a Scrum product, whose model works from a backlog, with an accepted architecture and a plan directory
// input: the route plan's render
// expect: the page says that the product's model works from a backlog and has no implementation plan, links to the backlog (an a with href "#backlog"), shows no step and no architecture list, and hands Mermaid no diagram
// Planted fault: showing the steps of a pulled model, or no link, fails.
test("the plan page of a product whose model works from a backlog links to the backlog and shows no plan", async () => {
  const { target, drawn } = await render(productFiles({ model: "scrum" }));
  assert.match(text(target), /works from a backlog/);
  assert.deepEqual(byTag(target, "a").map((a) => a.getAttribute("href")).filter((href) => href === "#backlog"), ["#backlog"]);
  assert.equal(byData(target, "data-step").length, 0);
  assert.equal(byData(target, "data-architecture").length, 0);
  assert.deepEqual(drawn.texts, []);
});

// TST-1057004 · level: unit · module: MOD-implementation-pages
// guards: UC-045; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS
// given: a V-model product whose MOD-writer has no approval record (open) and whose ARC-002 has a record naming another text (changed); every other architecture file and UC-001 accepted; the plan of TST-1057001
// input: the route plan's render
// expect: the page names docs/architecture/MOD-writer.md as open and docs/architecture/ARC-002-sub.md as changed, and not the accepted files; it shows no step, no architecture list, no diagram and no button
// Planted fault: listing only open files and not changed ones leaves ARC-002 unnamed; showing the steps anyway fails the step assertion.
test("the plan page with an architecture file open or changed names it and offers nothing to plan", async () => {
  const accepted = Object.keys(ARCHITECTURE).filter((path) => path !== "docs/architecture/MOD-writer.md");
  const { target, drawn } = await render(productFiles({ accepted: [...accepted, USE_CASE], changed: ["docs/architecture/ARC-002-sub.md"] }));
  const page = text(target);
  assert.match(page, /docs\/architecture\/MOD-writer\.md/);
  assert.match(page, /docs\/architecture\/ARC-002-sub\.md/);
  assert.doesNotMatch(page, /MOD-reader\.md/);
  assert.doesNotMatch(page, /ARC-001-whole\.md/);
  assert.equal(byData(target, "data-step").length, 0);
  assert.equal(byData(target, "data-architecture").length, 0);
  assert.equal(byTag(target, "button").length, 0);
  assert.deepEqual(drawn.texts, []);
});

// TST-1057005 · level: unit · module: MOD-implementation-pages
// guards: UC-045; THE PROCESS MODEL IS DECLARED PER PRODUCT
// given: a product without docs/process.md
// input: the route plan's render
// expect: the page says that no process model is declared, links to the page that declares it (an a with href "#process"), and shows no step and no architecture list
// Planted fault: treating the missing declaration as a planned model shows an empty plan, and the link is missing.
test("the plan page of a product without a declared model says so and links to the declaration", async () => {
  const files = productFiles();
  delete files["docs/process.md"];
  const { target } = await render(files);
  assert.match(text(target), /no process model is declared/i);
  assert.ok(byTag(target, "a").some((a) => a.getAttribute("href") === "#process"));
  assert.equal(byData(target, "data-step").length, 0);
  assert.equal(byData(target, "data-architecture").length, 0);
});

// TST-1057006 · level: unit · module: MOD-implementation-pages
// guards: UC-045
// given: the view of MOD-implementation-pages
// input: its routes
// expect: the route plan is among them, of the entry implementation, titled Plan
// Planted fault: leaving the route out of the view fails.
test("the view offers the route plan under Implementation", () => {
  assert.ok(route, "the view has a route named plan");
  assert.equal(route.entry, "implementation");
  assert.equal(route.title, "Plan");
});

// TST-1057007 · level: unit · module: MOD-implementation-pages
// guards: UC-045
// given: a V-model product with an accepted architecture and no plan under docs/plan/
// input: the route plan's render
// expect: the architecture is listed as in TST-1057001; the page says that no plan is saved yet; it shows no step and hands Mermaid no diagram
// Planted fault: drawing an empty diagram, or hiding the architecture for want of steps, fails.
test("the plan page of a planned product without a plan shows the architecture and says no plan is saved", async () => {
  const { target, drawn } = await render(productFiles({ plan: false }));
  assert.deepEqual(byData(target, "data-architecture").map((e) => e.getAttribute("data-architecture")), ["ARC-001", "ARC-002", "MOD-reader", "MOD-writer", "MOD-loose"]);
  assert.match(text(target), /no plan is saved yet/i);
  assert.equal(byData(target, "data-step").length, 0);
  assert.deepEqual(drawn.texts, []);
});
