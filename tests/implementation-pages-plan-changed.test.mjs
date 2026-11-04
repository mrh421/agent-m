// The plan page marks the steps of an architecture changed after the plan was saved (ITM-1036; UC-045 1c: "The steps of changed, added or removed modules and subsystems are marked; the
// planner drafts the plan again or edits it. Nothing changes until the planner saves.") — MOD-implementation-pages' route `plan`, as docs/architecture/MOD-implementation-pages.md:163-167
// states it: "a step marked where `planFindings` with the history names its module or subsystem changed or removed since the step was saved, and a module without a step named", and
// MOD-work-plans' planFindings (MOD-work-plans.md:167-171) with its `history`.
// Run: node --test tests/implementation-pages-plan-changed.test.mjs
//
// Module: MOD-implementation-pages
// Guards: UC-045; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// Level: unit
//
// The fixture is that of tests/implementation-pages-plan.test.mjs, written again here (a test file imports no other test file), with the dates of the history: the product's host answers
// readHistory(path, { limit: 1, changes: false }) from a table of the date of the newest commit that touched each path. The readings the pull request names:
//   - A step is marked changed when planFindings names its module's (or subsystem's) file as changed after the step, removed when it names the file as removed; the mark names the file. The
//     steps the findings do not name carry no mark. A module without a step is marked in the architecture's list, "has no step".
//   - The page marks and writes nothing: no commit is made, and the steps stand as they are until the planner saves.
// The counter-proofs are recorded in the pull request. Each test states its input and its expected result before it runs (given / input / expect).

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


// ---------------------------------------------------------------- the history of the fixture

// The steps of this fixture: ITM-010 implements MOD-reader, ITM-011 MOD-writer, ITM-012 MOD-loose; ITM-014 implements MOD-gone, a module whose file the architecture no longer holds.
const stepOf = (id, title, module) => step(id, title).replace("  - MOD-reader", `  - ${module}`);
const FILES = (extra = {}) => ({
  ...productFiles(),
  "docs/plan/ITM-010-reader.md": stepOf("ITM-010", "Read the store", "MOD-reader"),
  "docs/plan/ITM-011-writer.md": stepOf("ITM-011", "Write the store", "MOD-writer"),
  "docs/plan/ITM-012-loose.md": stepOf("ITM-012", "Loose ends", "MOD-loose"),
  "docs/plan/ITM-013-gated.md": stepOf("ITM-013", "Gated work", "MOD-reader"),
  ...extra,
});
const SAVED = "2026-10-01T09:00:00Z", LATER = "2026-10-10T09:00:00Z", EARLIER = "2026-09-20T09:00:00Z";
// The date of the newest commit of each path: every step saved at SAVED, every architecture file older, unless a test says otherwise.
const dates = (over = {}) => ({ ...Object.fromEntries(Object.keys(productFiles()).map((path) => [path, path.startsWith("docs/plan/") ? SAVED : EARLIER])), ...over });

function contextWith(files, history, writes) {
  const context = contextOf(files);
  const host = context.product.host;
  host.readHistory = async (path) => (history[path] ? [{ commit: "d".repeat(40), parents: [], author: { account: null, name: "x" }, date: history[path], message: "m", changes: [] }] : []);
  host.commitFiles = async (...args) => { writes.push(args); return { commit: "e".repeat(40) }; };
  return context;
}
async function page(files, history = dates()) {
  const writes = [], drawn = recorder();
  const target = document.createElement("div");
  document.body.append(target);
  try { await route.render(target, contextWith(files, history, writes), {}); } finally { delete globalThis.mermaid; }
  return { target, writes, drawn };
}
const stepRow = (target, id) => byData(target, "data-step", id)[0];
const marks = (row) => byData(row, "data-mark").map((node) => text(node));
const archRow = (target, id) => byData(target, "data-architecture", id)[0];

// TST-1036001 · level: unit · module: MOD-implementation-pages
// guards: UC-045; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: a plan whose steps were saved on 2026-10-01 and an architecture accepted; known positive: every architecture file is older than the steps; then the file of MOD-reader is changed on 2026-10-10
// input: the route plan, for each
// expect: the known positive marks no step; after the change the steps that implement MOD-reader, ITM-010 and ITM-013, are marked, each naming docs/architecture/MOD-reader.md as changed after the step, and ITM-011 and ITM-012 are not
test("plan — the step that implements a module whose file changed after the step was saved is marked", async () => {
  const unchanged = await page(FILES());
  for (const id of ["ITM-010", "ITM-011", "ITM-012", "ITM-013"]) assert.deepEqual(marks(stepRow(unchanged.target, id)), [], `known positive: ${id}`);
  const { target } = await page(FILES(), dates({ "docs/architecture/MOD-reader.md": LATER }));
  for (const id of ["ITM-010", "ITM-013"]) {
    const found = marks(stepRow(target, id));
    assert.equal(found.length, 1, id);
    assert.match(found[0], /docs\/architecture\/MOD-reader\.md/);
    assert.match(found[0], /changed after the step/);
  }
  for (const id of ["ITM-011", "ITM-012"]) assert.deepEqual(marks(stepRow(target, id)), [], id);
});

// TST-1036002 · level: unit · module: MOD-implementation-pages
// guards: UC-045; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: the same plan with a further step ITM-014 for MOD-gone, whose file the architecture no longer holds
// input: the route plan
// expect: ITM-014 is marked, naming docs/architecture/MOD-gone.md as removed; no other step is marked
test("plan — the step of a module whose file was removed is marked", async () => {
  const { target } = await page(FILES({ "docs/plan/ITM-014-gone.md": stepOf("ITM-014", "Gone", "MOD-gone") }), dates({ "docs/plan/ITM-014-gone.md": SAVED }));
  const found = marks(stepRow(target, "ITM-014"));
  assert.equal(found.length, 1);
  assert.match(found[0], /docs\/architecture\/MOD-gone\.md/);
  assert.match(found[0], /removed/);
  for (const id of ["ITM-010", "ITM-011", "ITM-012", "ITM-013"]) assert.deepEqual(marks(stepRow(target, id)), [], id);
});

// TST-1036003 · level: unit · module: MOD-implementation-pages
// guards: UC-045; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: an architecture with a module MOD-added, accepted after the plan was saved, that no step implements; known positive: MOD-reader, which a step implements
// input: the route plan
// expect: MOD-added is marked in the architecture's list as having no step; MOD-reader, MOD-writer and MOD-loose, which have steps, are not
test("plan — a module added after the plan was saved is named as without a step", async () => {
  const added = "docs/architecture/MOD-added.md";
  const files = FILES({ [added]: module_("MOD-added") });
  // the new module is accepted like the others: its approval record names its blob
  files[`docs/approvals/MOD-added-${blobOf(files[added]).slice(0, 12)}.md`] = "kind: record\n";
  const { target } = await page(files, dates({ [added]: LATER }));
  assert.match(text(archRow(target, "MOD-added")), /has no step/);
  for (const id of ["MOD-reader", "MOD-writer", "MOD-loose"]) assert.doesNotMatch(text(archRow(target, id)), /has no step/, id);
});

// TST-1036004 · level: unit · module: MOD-implementation-pages
// guards: UC-045; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the plan of the first test with MOD-reader changed after its steps, and a host that records every commit it is asked for
// input: the route plan
// expect: no commit is asked for; the plan's files are as they were: the page marks and writes nothing until the planner saves
test("plan — the marks write nothing", async () => {
  const { writes, target } = await page(FILES(), dates({ "docs/architecture/MOD-reader.md": LATER }));
  assert.equal(marks(stepRow(target, "ITM-010")).length, 1, "known positive: the mark is there");
  assert.deepEqual(writes, []);
});

// TST-1036005 · level: unit · module: MOD-implementation-pages
// guards: UC-045
// given: the plan of the first test, on a server whose history cannot be read (readHistory fails)
// input: the route plan
// expect: the page is drawn all the same: the architecture, the steps and their states; no step carries a mark, since none could be derived
test("plan — when the history cannot be read the page is drawn without marks", async () => {
  const writes = [], drawn = recorder();
  const target = document.createElement("div");
  document.body.append(target);
  const context = contextWith(FILES(), dates(), writes);
  context.product.host.readHistory = async () => { throw Object.assign(new Error("unreachable"), { name: "Unreachable" }); };
  try { await route.render(target, context, {}); } finally { delete globalThis.mermaid; }
  assert.equal(byData(target, "data-step").length, 4);
  assert.ok(archRow(target, "MOD-reader"));
  assert.deepEqual(byData(target, "data-mark"), []);
  void drawn;
});
