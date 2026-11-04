// MOD-trace-pages' modules view at a phone's width: each cell of the table of the modules carries its column's title in `data-label`, the attribute by which
// the frame's one rule for a table below a phone's width labels a cell whose row stands as a block (MOD-site-frame's `look.css`), and the table keeps one row
// per module.
// Run: node --test tests/trace-pages-modules-labels.test.mjs
//
// Module: MOD-trace-pages
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// Level: unit
//
// The route is called through its public Route.render with the Host/Snapshot-shaped fake of tests/trace-pages-harness.mjs, which holds the files of a small
// product; Mermaid is a recorder. The expected titles are written here; none is read from a document. A reading the case takes: the cell of an opened row
// spans every column (colspan 6) and so has no column's title; it stands unlabelled, as a cell without the attribute does.

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = ["# Labels fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", ""].join("\n");
const FILES = {
  "SPEC.md": SPEC,
  "docs/architecture/ARC-001-the-whole.md": doc("ARC-001", "The whole", { forced_by: ["ALPHA RULE"], designs: ["MOD-page", "MOD-review"] }),
  "docs/architecture/MOD-page.md": doc("MOD-page", "Renders the dashboard", { folder: "src/page/", realises: ["ALPHA RULE"], follows: ["ARC-001"], uses: ["MOD-review.status"] }),
  "docs/architecture/MOD-review.md": doc("MOD-review", "Derives the status", { folder: "src/review/", realises: ["ALPHA RULE"], follows: ["ARC-001"], provides: ["status"] }),
  "src/page/index.mjs": 'import { status } from "../review/index.mjs";\nexport const page = status;\n',
  "src/review/index.mjs": "export const status = 1;\n",
  "tests/page.test.mjs": ["// TST-1", "// level: unit", "// module: MOD-page", "// guards: ALPHA RULE", ""].join("\n"),
};

async function render() {
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const target = document.createElement("div");
  document.body.append(target);
  try {
    await route.render(target, { product: { address: "https://github.com/acme/library", host: treeHost({ trees: { main: FILES }, tags: [] }) } }, { key: "modules", ref: "main" });
  } finally {
    delete globalThis.mermaid;
  }
  return target;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));

// TST-1159001 · level: unit · module: MOD-trace-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the fixture product at main, with two modules, MOD-page and MOD-review
// input: Route.render with the key "modules" at main
// expect: column titles Module, Subsystem, Realises, File, Code, Tests; one row per module, MOD-page then MOD-review; the six cells of each row carry, in order, data-label "Module", "Subsystem", "Realises", "File", "Code" and "Tests"
test("TST-1159001 each cell of the modules table carries its column's title as data-label, one row per module", async () => {
  const target = await render();
  const [table] = find(byClass(target, "section", "modules-table")[0], (node) => node.localName === "table");
  const titles = ["Module", "Subsystem", "Realises", "File", "Code", "Tests"];
  assert.deepEqual(find(table, (node) => node.localName === "th").map((th) => th.textContent), titles);
  const rows = byClass(table, "tr", "module-row");
  assert.deepEqual(rows.map((row) => row.getAttribute("data-module")), ["MOD-page", "MOD-review"]);
  for (const row of rows) {
    const cells = row.childNodes.filter((node) => node.localName === "td");
    assert.deepEqual(cells.map((td) => td.getAttribute("data-label")), titles, `the cells of ${row.getAttribute("data-module")}`);
  }
});
