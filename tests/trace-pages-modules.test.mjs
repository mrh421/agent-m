// MOD-trace-pages' public route drawn for the modules view (ITM-720): the component diagram of the product's modules, as UC-025 step 5 asks for it,
// drawn from the trace graph of the default branch and handed to MOD-markdown-render's renderMermaid. The diagram's text is componentDiagram's
// (src/trace-pages/diagram.mjs): the view maps the graph's module nodes and their follows and uses edges into the files componentDiagram takes.
//
// Run: node --test tests/trace-pages-modules.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN; THE TRACEABILITY MATRIX IS DERIVED
// Level: component
//
// The route is called through its public Route.render with a Host/Snapshot-shaped fake that holds the files of a small product (tests/trace-pages-harness.mjs);
// it has no write method. Mermaid is replaced by a recorder that keeps the text of every diagram it is handed, as the release tests of sprint 04 replace it:
// no request leaves the process. The expected texts are written in each case; none is read from a document. Readings the cases take, each from the sentence quoted:
// - "component diagram: one box per module in its subsystem's box, one arrow per use, gaps marked, a missing provider as a box marked *missing*" (MOD-trace-pages,
//   the modules view): the text handed to Mermaid is the text componentDiagram gives for the modules of the version, a module's subsystem being the first
//   decision its file follows; the gap marks of moduleRows are not part of this item, so the view gives componentDiagram no gaps;
// - "Versions: branch" (the modules view's row of MOD-trace-pages' table): the view offers no choice of version and no tag, and draws the ref the caller hands.

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost } from "./trace-pages-harness.mjs";
import { componentDiagram } from "../src/trace-pages/diagram.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = ["# Modules fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", ""].join("\n");
// Four modules of a product: MOD-store is used and has no file; MOD-page uses MOD-review.history, which MOD-review does not provide.
const FILES = {
  "SPEC.md": SPEC,
  "docs/architecture/MOD-page.md": doc("MOD-page", "Renders the dashboard", { folder: "src/page/", follows: ["ARC-002", "ARC-001"], uses: ["MOD-review.status", "MOD-review.history"] }),
  "docs/architecture/MOD-review.md": doc("MOD-review", "Derives the status of reviewed files", { folder: "src/review/", follows: ["ARC-001"],
    uses: ["MOD-reader.readFile", "MOD-reader.listTree", "MOD-store.load"], provides: ["status"] }),
  "docs/architecture/MOD-reader.md": doc("MOD-reader", "Reads files at a pinned commit", { folder: "src/reader/", follows: ["ARC-001", "ARC-003"], provides: ["readFile", "listTree"] }),
  "docs/architecture/MOD-notes.md": doc("MOD-notes", "Keeps a reviewer notes", { folder: "src/notes/", uses: ["MOD-reader.readFile", "MOD-store.save"] }),
};
// The files componentDiagram takes for the same product: what parseArchitecture reads from the module files above.
const mod = (id, title, follows, uses = [], provides = []) => ({
  kind: "module", id, title, follows, provides, uses: uses.map((u) => { const [module, iface] = u.split("."); return { module, iface }; }),
});
const MODULE_FILES = [
  mod("MOD-page", "Renders the dashboard", ["ARC-002", "ARC-001"], ["MOD-review.status", "MOD-review.history"]),
  mod("MOD-review", "Derives the status of reviewed files", ["ARC-001"], ["MOD-reader.readFile", "MOD-reader.listTree", "MOD-store.load"], ["status"]),
  mod("MOD-reader", "Reads files at a pinned commit", ["ARC-001", "ARC-003"], [], ["readFile", "listTree"]),
  mod("MOD-notes", "Keeps a reviewer notes", [], ["MOD-reader.readFile", "MOD-store.save"]),
];
// The diagram of that product, written out: one box per module in the box of its subsystem (the first decision it follows), one arrow per module used, MOD-store
// (no file) as a box marked missing and MOD-review (which does not provide history) marked missing too.
const DIAGRAM = [
  "flowchart LR",
  "  subgraph S_ARC_001[\"ARC-001\"]",
  "    MOD_reader[\"MOD-reader<br/>Reads files at a pinned commit\"]",
  "    MOD_review[\"MOD-review<br/>Derives the status of reviewed files\"]",
  "  end",
  "  subgraph S_ARC_002[\"ARC-002\"]",
  "    MOD_page[\"MOD-page<br/>Renders the dashboard\"]",
  "  end",
  "  MOD_notes[\"MOD-notes<br/>Keeps a reviewer notes\"]",
  "  MOD_store[\"MOD-store — missing\"]",
  "  MOD_notes --> MOD_reader",
  "  MOD_notes --> MOD_store",
  "  MOD_page --> MOD_review",
  "  MOD_review --> MOD_reader",
  "  MOD_review --> MOD_store",
  "  classDef missing stroke-dasharray: 4 3,stroke:#b42318,color:#b42318",
  "  class MOD_review missing",
  "  class MOD_store missing",
  "",
].join("\n");
const ADDRESS = "https://github.com/acme/library";
const modulesParams = { key: "modules", ref: "main" };

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
async function render(productHost, params = modulesParams, context = { product: { address: ADDRESS, host: productHost } }) {
  const drawn = recorder();
  const target = document.createElement("div");
  document.body.append(target);
  try {
    await route.render(target, context, params);
  } finally {
    delete globalThis.mermaid;
  }
  return { target, drawn };
}
const hostOf = (files = FILES, extra = {}) => treeHost({ trees: { main: files, "v2026.1.0": files }, tags: ["v2026.1.0"], ...extra });

// CASE ITM-720-01
// TST-720001 · level: component · module: MOD-trace-pages
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture product at main, the default branch: MOD-page (follows ARC-002 then ARC-001) uses two interfaces of MOD-review, which provides status only; MOD-review uses two of MOD-reader and one of MOD-store, which has no file; MOD-reader follows ARC-001 then ARC-003; MOD-notes follows no decision
// input: Route.render with the key "modules" at main
// expect: the page is headed "Modules"; Mermaid is handed one diagram, whose text is the text written out above — flowchart LR, ARC-001's box holding MOD-reader and MOD-review, ARC-002's holding MOD-page, MOD-notes outside every box, MOD-store as a box marked missing, five arrows, MOD-review and MOD-store marked missing — and equals componentDiagram of the same modules; the drawn diagram stands in the page
test("the modules page hands Mermaid the component diagram of the product's modules, as componentDiagram draws it", async () => {
  assert.equal(DIAGRAM, componentDiagram(MODULE_FILES), "known positive: the text written out is componentDiagram's for these modules");
  const { target, drawn } = await render(hostOf());
  assert.deepEqual(find(target, (node) => node.localName === "h2").map((node) => node.textContent), ["Modules"]);
  assert.equal(drawn.texts.length, 1);
  assert.equal(drawn.texts[0], DIAGRAM);
  assert.equal(drawn.texts[0], componentDiagram(MODULE_FILES));
  assert.equal(find(target, (node) => node.className === "mermaid").length, 1);
});

// CASE ITM-720-02
// TST-720002 · level: component · module: MOD-trace-pages
// guards: UC-025; THE TRACEABILITY MATRIX IS DERIVED
// given: a Host that holds the fixture at main and at the tag v2026.1.0, and lists that tag
// input: Route.render with the key "modules" at main
// expect: the Host is asked for the snapshot of main alone and for no tag; the page offers no choice of version (no select, no option) and no "as of" line; the Host has no write method
test("the modules view offers the default branch alone: no version choice, and no tag is read", async () => {
  const productHost = hostOf();
  let tagsAsked = 0;
  const listTags = productHost.listTags;
  productHost.listTags = async () => { tagsAsked += 1; return listTags(); };
  const { target } = await render(productHost);
  assert.deepEqual(productHost.log.snapshots, ["main"]);
  assert.equal(tagsAsked, 0);
  assert.equal(find(target, (node) => node.localName === "select" || node.localName === "option").length, 0);
  assert.equal(find(target, (node) => node.className === "version-as-of").length, 0);
  assert.equal(Object.hasOwn(productHost, "commitFiles"), false);
});

// CASE ITM-720-03
// TST-720003 · level: component · module: MOD-trace-pages
// guards: UC-025
// given: the product at main with the fixture's SPEC and no module file at all (known positive: the fixture with its modules draws a diagram)
// input: Route.render with the key "modules" at main
// expect: the page says "No modules exist at main." and hands Mermaid no diagram
test("a version without a module says so and draws no diagram", async () => {
  const known = await render(hostOf());
  assert.equal(known.drawn.texts.length, 1, "known positive: the fixture's modules are drawn");
  const { target, drawn } = await render(treeHost({ trees: { main: { "SPEC.md": SPEC } } }));
  assert.deepEqual(find(target, (node) => node.className === "gaps-missing").map((node) => node.textContent), ["No modules exist at main."]);
  assert.deepEqual(drawn.texts, []);
});

// CASE ITM-720-04
// TST-720004 · level: component · module: MOD-trace-pages
// guards: UC-025; THE TRACEABILITY MATRIX IS DERIVED
// given: the fixture, in which the first read of MOD-page's file fails as an unreachable server does
// input: Route.render with the key "modules" at main
// expect: the page says "The modules could not be read: unreachable" and hands Mermaid no diagram
test("a graph that cannot be read is named in place of the diagram", async () => {
  const { target, drawn } = await render(hostOf(FILES, { failing: (path, nth) => path === "docs/architecture/MOD-page.md" && nth === 1 }));
  assert.deepEqual(find(target, (node) => node.className === "traces-problem").map((node) => node.textContent), ["The modules could not be read: unreachable"]);
  assert.deepEqual(drawn.texts, []);
});

// CASE ITM-720-05, changed by ITM-680 (the PO's ruling "ITM-680's #arc reads": the modules view builds the diagram from the module files alone, so it no longer
// shares the graph of a version with the gaps view)
// TST-720005 · level: component · module: MOD-trace-pages
// guards: UC-025; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: one Host for main, whose snapshots count every readMany and readOn, with the graph of main stored on trace-cache
// input: the modules view rendered at main; then the gaps view at main with the same Host
// expect: after the modules view readMany has been told the four module files once, in one batch, for the diagram, and the stored graph has been read once — one readOn of ("trace-cache", "<main's commit>.json.gz") — for
//         the table and the gaps (ITM-721); the gaps view of the same version then reads no more: the graph of a commit is read once and kept (ITM-598), so neither readMany nor readOn is called again
test("the modules view reads its module files in one batch and the stored graph once; the gaps view of the same version shares it", async () => {
  const productHost = hostOf();
  await render(productHost);
  assert.equal(productHost.log.manys.length, 1);
  const told = new Set(productHost.log.manys[0]);
  for (const path of Object.keys(FILES).filter((path) => path.startsWith("docs/architecture/MOD-"))) assert.ok(told.has(path), `${path} is read in the batch`);
  assert.deepEqual(productHost.log.readOns, [["trace-cache", `${productHost.commitOf("main")}.json.gz`]]);
  const { target } = await render(productHost, { key: "gaps", ref: "main" });
  assert.ok(find(target, (node) => node.className === "gaps-body").length === 1, "known positive: the gaps were drawn");
  assert.equal(productHost.log.manys.length, 1, "the gaps name nothing to readMany");
  assert.deepEqual(productHost.log.readOns, [["trace-cache", `${productHost.commitOf("main")}.json.gz`]], "the graph of the commit is shared");
});

// CASE ITM-720-06
// TST-720006 · level: component · module: MOD-trace-pages
// guards: UC-025; UC-049
// given: the modules view drawn at main for the product https://github.com/acme/library
// input: route.subject for the key "modules" at main, with the context the route was drawn with
// expect: no kind of its own (the bar runs converse on every page), no draft route, title "Modules", a key holding key=modules and ref=main, and a page text holding "Modules", the address and "Version: main"
test("the subject of the modules page is the page, titled Modules", async () => {
  const context = { product: { address: ADDRESS, host: hostOf() } };
  await render(context.product.host, modulesParams, context);
  const subject = route.subject(modulesParams, context);
  assert.equal(subject.kind, undefined, "a subject names no kind: the bar runs converse on every page");
  assert.equal(subject.draftRoute, null);
  assert.equal(subject.title, "Modules");
  assert.ok(subject.key.includes("key=modules") && subject.key.includes("ref=main"), subject.key);
  const page = subject.paramsFor({}).page;
  for (const part of ["Modules", ADDRESS, "Version: main"]) assert.ok(page.includes(part), part);
});

// TST-680212 · level: component · module: MOD-trace-pages
// guards: UC-025; EVERY STEP EXPLAINS ITSELF
// given: the fixture product at main
// input: Route.render with the key "modules" at main
// expect: after the diagram's block, a folded explanation ("What is this?") says what the diagram draws — one box per module, in the box of its subsystem, one arrow to each module it uses, a used module without a file marked missing
test("the modules page folds an explanation of what the diagram draws under it", async () => {
  const { target } = await render(hostOf());
  const kids = find(target, (node) => node.localName === "div" && node.className === "modules-body")[0].childNodes;
  const explained = [...kids].filter((node) => node.nodeType === 1 && node.className === "explain");
  assert.equal(explained.length, 1, "one folded explanation");
  assert.ok([...kids].indexOf(explained[0]) > [...kids].findIndex((node) => node.className === "mermaid"), "under the diagram");
  assert.match(explained[0].textContent, /What is this\?/);
  assert.match(explained[0].textContent, /one box per module[^]*one arrow[^]*missing/i);
});
