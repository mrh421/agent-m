// MOD-trace-pages' modules view marks in its component diagram the modules that have a gap (ITM-1352): UC-025 step 5, "modules with a gap are marked", and the
// modules row of docs/architecture/MOD-trace-pages.md, "component diagram: one box per module in its subsystem's box, one arrow per use, gaps marked, a missing provider
// as a box marked *missing*". The view hands componentDiagram (src/trace-pages/diagram.mjs, which marks the module a gap names) the gaps that MOD-trace-graph's moduleRows gives.
// Run: node --test tests/trace-pages-modules-gaps-marked.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// Level: unit
//
// The route is called through its public Route.render with the Host-shaped fake of tests/trace-pages-harness.mjs; Mermaid is a recorder that keeps the text of the diagram
// it is handed; nothing reaches the network. The expected marks are written in each case, not derived from moduleRows. Reading taken: a module "has a gap" when a gap of
// step 4 that the page lists names it (a module that no test exercises, or that has no code yet).

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = ["# Marks fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", ""].join("\n");
const TST = (module, guards) => ["// TST-1", "// level: unit", `// module: ${module}`, `// guards: ${guards}`, ""].join("\n");
const ARC = doc("ARC-001", "The whole", { forced_by: ["ALPHA RULE"], designs: ["MOD-page", "MOD-empty", "MOD-notest"] });
const mod = (id, title, keys = {}) => doc(id, title, { folder: `src/${id.slice(4)}/`, realises: ["ALPHA RULE"], follows: ["ARC-001"], ...keys });
// MOD-page has code and a test, and no gap; MOD-empty has neither; MOD-notest has code and no test.
const FILES = {
  "SPEC.md": SPEC,
  "docs/architecture/ARC-001-the-whole.md": ARC,
  "docs/architecture/MOD-page.md": mod("MOD-page", "Renders the dashboard"),
  "docs/architecture/MOD-empty.md": mod("MOD-empty", "Has no code and no test"),
  "docs/architecture/MOD-notest.md": mod("MOD-notest", "Has code and no test"),
  "src/page/index.mjs": "export const page = 1;\n",
  "src/notest/index.mjs": "export const x = 1;\n",
  "tests/page.test.mjs": TST("MOD-page", "ALPHA RULE"),
};
const CLEAN = {
  "SPEC.md": SPEC,
  "docs/architecture/ARC-001-the-whole.md": doc("ARC-001", "The whole", { forced_by: ["ALPHA RULE"], designs: ["MOD-page"] }),
  "docs/architecture/MOD-page.md": mod("MOD-page", "Renders the dashboard"),
  "src/page/index.mjs": "export const page = 1;\n",
  "tests/page.test.mjs": TST("MOD-page", "ALPHA RULE"),
};
const ADDRESS = "https://github.com/acme/library";

async function render(files) {
  const texts = [];
  globalThis.mermaid = {
    initialize() {},
    mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) },
    run: async ({ nodes }) => { texts.push(...nodes.map((node) => node.textContent)); },
  };
  const target = document.createElement("div");
  document.body.append(target);
  try {
    await route.render(target, { product: { address: ADDRESS, host: treeHost({ trees: { main: files } }) } }, { key: "modules", ref: "main" });
  } finally {
    delete globalThis.mermaid;
  }
  return { target, texts };
}
// The classes each module of the diagram is declared with, keyed by module identifier.
function classesOf(text) {
  const moduleOf = new Map(), classes = {};
  for (const line of text.split("\n")) {
    const box = /^\s*(\w+)\["([^"]*)"\]$/.exec(line);
    if (box) moduleOf.set(box[1], box[2].split(/<br\/>| — /)[0]);
  }
  for (const line of text.split("\n")) {
    const c = /^\s*class (\w+) (\w+)$/.exec(line);
    if (c) (classes[moduleOf.get(c[1]) ?? c[1]] ??= new Set()).add(c[2]);
  }
  return classes;
}
const listed = (target) => find(target, (node) => node.localName === "li" && node.className.split(" ").includes("module-gap")).map((node) => node.textContent);

// CASE ITM-1352-01
// TST-1352001 · level: unit · module: MOD-trace-pages
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: a product at main with MOD-page (code and a test, no gap), MOD-empty (no code, no test) and MOD-notest (code, no test)
// input: Route.render with the key "modules" at main
// expect: the page lists a gap for MOD-empty and one for MOD-notest and none for MOD-page; the one diagram handed to Mermaid marks MOD-empty and MOD-notest as gap and MOD-page not at all
test("UC-025 step 5 — the component diagram marks each module that has a gap and no module that has none", async () => {
  const { target, texts } = await render(FILES);
  const lines = listed(target);
  assert.ok(lines.some((l) => l.startsWith("MOD-empty")) && lines.some((l) => l.startsWith("MOD-notest")), "known positive: the page lists the two gaps");
  assert.ok(!lines.some((l) => l.startsWith("MOD-page")), "MOD-page has no gap");
  assert.equal(texts.length, 1);
  const classes = classesOf(texts[0]);
  assert.deepEqual(classes["MOD-empty"], new Set(["gap"]));
  assert.deepEqual(classes["MOD-notest"], new Set(["gap"]));
  assert.equal(classes["MOD-page"], undefined, "a module without a gap is not marked");
});

// CASE ITM-1352-02
// TST-1352002 · level: unit · module: MOD-trace-pages
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: a product at main whose one module has code and a test and so has no gap (known positive: TST-1352001's product, which does draw gap marks)
// input: Route.render with the key "modules" at main
// expect: the page lists no gap and the diagram marks nothing
test("UC-025 step 5 — a product without a gap has a diagram with no mark", async () => {
  const { texts } = await render(CLEAN);
  assert.equal(texts.length, 1);
  assert.deepEqual(classesOf(texts[0]), {});
  assert.ok(!texts[0].includes("classDef gap"));
  assert.ok((await render(FILES)).texts[0].includes("classDef gap"), "known positive: with gaps, the class is declared");
});

// CASE ITM-1352-03
// TST-1352003 · level: unit · module: MOD-trace-pages
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: MOD-page uses MOD-gone.load, a module with no file, and MOD-notest.save, which MOD-notest (code, no test) does not provide
// input: Route.render with the key "modules" at main
// expect: MOD-gone stays a box marked missing and only that; MOD-notest is marked missing and gap
test("UC-025 5a — a missing provider stays marked missing when gaps are marked too", async () => {
  const files = { ...FILES, "docs/architecture/MOD-page.md": mod("MOD-page", "Renders the dashboard", { uses: ["MOD-gone.load", "MOD-notest.save"] }) };
  const { texts } = await render(files);
  const classes = classesOf(texts[0]);
  assert.deepEqual(classes["MOD-gone"], new Set(["missing"]));
  assert.deepEqual(classes["MOD-notest"], new Set(["missing", "gap"]));
  assert.match(texts[0], /MOD_gone\["MOD-gone — missing"\]/);
});
