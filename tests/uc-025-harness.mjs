// The harness of the system and release tests of UC-025 (Validate modules against specification and tests): a fixture product whose files hold a
// SPEC, an architecture of three decisions and four modules, their code and their tests, and the page `#trace/key=modules` drawn for it by the real
// route of MOD-trace-pages over the real MOD-trace-graph, through the Host fake of tests/trace-pages-harness.mjs (its snapshots serve the product's
// stored trace graph on trace-cache, built by MOD-trace-graph's traceGraph from the same files, as the workflow "main changed" stores it). Mermaid is a
// recorder that keeps the text of every diagram the page hands it. No request leaves the process.
// Imported by tests/system-uc-025-validate-modules.test.mjs and the release tests of UC-025. It holds no test and no expected result: what it builds
// are inputs, and every test states its own expected values.
//
// Module: MOD-trace-pages
// Module: MOD-trace-graph
// Level: system
//
// Authored by developer-opus-f (ITM-741), who implemented none of ITM-692, ITM-720, ITM-721, ITM-210, ITM-735 and ITM-736.
//
// The product (`product()`): the SPEC holds RULE ONE, RULE TWO and RULE THREE. ARC-001 states the whole system; ARC-002 (store and pages) and
// ARC-003 (mail) refine it. ARC-002 designs MOD-store and MOD-pages, ARC-003 designs MOD-mail; MOD-news follows ARC-002, which does not name it.
//   - MOD-store (src/store/): realises RULE ONE, provides read; one code file; tests/store.test.mjs guards RULE ONE and exercises it. Its file and
//     ARC-002's are accepted by approval records naming their blobs.
//   - MOD-pages (src/pages/): realises RULE TWO, uses MOD-store.read and MOD-mail.send, which MOD-mail does not provide; one code file importing
//     ../store/index.mjs; tests/pages.test.mjs guards RULE TWO and exercises it.
//   - MOD-mail (src/mail/): realises RULE ONE, provides read; its code file imports ../store/index.mjs though its file names no interface of
//     MOD-store; no test exercises it.
//   - MOD-news (src/news/): realises RULE TWO; no code file; tests/news.test.mjs guards RULE TWO and exercises it.
// RULE THREE is realised by no module.

import { blobOf, doc, document, find, treeHost } from "./trace-pages-harness.mjs";

export { find };
export const ADDRESS = "https://github.com/acme/library";
export const lines = (...rows) => `${rows.join("\n")}\n`;

// ---------------------------------------------------------------- the files of the product

export const requirement = (name) => [`**${name}** *(PO A. Maier)*`, `The rule ${name}.`, "*Check:* at review.", ""];
export const specOf = (...names) => lines("# Library — Specification", "", "## 1. Rules", "", ...names.flatMap(requirement));
/** A test file of one case: its declaration, with the module it exercises and what it guards. */
export const testFile = (id, module, guards) => lines(`// TST-${id} · level: unit · module: ${module}`, `// guards: ${guards}`, "// given: a fixture", "// input: a call",
  "// expect: a result", `test("case ${id}", () => {});`);
export const decision = (id, title, keys) => doc(id, title, keys, "## Context\n\nThe context.\n\n## Decision\n\nThe decision.\n\n## Alternatives\n\nNone.\n\n## Consequences\n\nNone.");
export const moduleDoc = (id, keys) => doc(id, `The module ${id}`, { folder: `src/${id.slice(4)}/`, ...keys }, "## Responsibility\n\nIts one responsibility.");
/** The path of the approval record that accepts `text` as the file of `id`, as MOD-approvals names it: the identifier and the blob's first 12 characters. */
export const approvalPath = (id, text) => `docs/approvals/${id}-${blobOf(text).slice(0, 12)}.md`;

export const MODULE_FILES = {
  "MOD-store": moduleDoc("MOD-store", { realises: ["RULE ONE"], follows: ["ARC-002"], provides: ["read"] }),
  "MOD-pages": moduleDoc("MOD-pages", { realises: ["RULE TWO"], follows: ["ARC-002"], uses: ["MOD-store.read", "MOD-mail.send"], provides: ["draw"] }),
  "MOD-mail": moduleDoc("MOD-mail", { realises: ["RULE ONE"], follows: ["ARC-003"], provides: ["read"] }),
  "MOD-news": moduleDoc("MOD-news", { realises: ["RULE TWO"], follows: ["ARC-002"] }),
};
export const ARC_002 = decision("ARC-002", "Store and pages", { forced_by: ["RULE ONE"], refines: ["ARC-001"], designs: ["MOD-store", "MOD-pages"] });

/** product(over) -> the files of the product, `over` laid over them (a path set to null is left out). */
export function product(over = {}) {
  const base = {
    "SPEC.md": specOf("RULE ONE", "RULE TWO", "RULE THREE"),
    "docs/architecture/ARC-001-the-system.md": decision("ARC-001", "The system", { forced_by: ["RULE ONE"] }),
    "docs/architecture/ARC-002-store-and-pages.md": ARC_002,
    "docs/architecture/ARC-003-mail.md": decision("ARC-003", "Mail", { forced_by: ["RULE TWO"], refines: ["ARC-001"], designs: ["MOD-mail"] }),
    ...Object.fromEntries(Object.entries(MODULE_FILES).map(([id, text]) => [`docs/architecture/${id}.md`, text])),
    "src/store/index.mjs": "export const read = () => 1;\n",
    "src/pages/index.mjs": 'import { read } from "../store/index.mjs";\nexport const draw = () => read();\n',
    "src/mail/index.mjs": 'import { read as stored } from "../store/index.mjs";\nexport const read = () => stored();\n',
    "tests/store.test.mjs": testFile("9001", "MOD-store", "RULE ONE"),
    "tests/pages.test.mjs": testFile("9002", "MOD-pages", "RULE TWO"),
    "tests/news.test.mjs": testFile("9003", "MOD-news", "RULE TWO"),
    [approvalPath("MOD-store", MODULE_FILES["MOD-store"])]: lines("kind: module", "file: docs/architecture/MOD-store.md"),
    [approvalPath("ARC-002", ARC_002)]: lines("kind: architecture-decision", "file: docs/architecture/ARC-002-store-and-pages.md"),
  };
  const merged = { ...base, ...over };
  for (const path of Object.keys(merged)) if (merged[path] === null) delete merged[path];
  return merged;
}

/** A product with no gap: one subsystem designing one module that realises the one requirement, with its code and a test that guards it. */
export function clean() {
  return {
    "SPEC.md": specOf("RULE ONE"),
    "docs/architecture/ARC-001-the-system.md": decision("ARC-001", "The system", { forced_by: ["RULE ONE"] }),
    "docs/architecture/ARC-002-store-and-pages.md": decision("ARC-002", "Store", { forced_by: ["RULE ONE"], refines: ["ARC-001"], designs: ["MOD-store"] }),
    "docs/architecture/MOD-store.md": MODULE_FILES["MOD-store"],
    "src/store/index.mjs": "export const read = () => 1;\n",
    "tests/store.test.mjs": testFile("9001", "MOD-store", "RULE ONE"),
  };
}

// ---------------------------------------------------------------- the page, as the reviewer reads it

/** hostOf(files, extra) -> the Host fake of a product whose default branch main holds `files`; `extra` is handed to treeHost. */
export const hostOf = (files = product(), extra = {}) => treeHost({ trees: { main: files }, tags: [], ...extra });

/**
 * open(host, params) -> { target, diagrams, route } — the reviewer opens Modules: the route `trace` of MOD-trace-pages drawn with the key `modules`
 * at main (the default branch), for the product at ADDRESS behind `host`. `diagrams` holds the text of every diagram the page handed Mermaid.
 */
export async function open(host = hostOf(), params = { key: "modules", ref: "main" }) {
  const { view } = await import("../src/trace-pages/index.mjs");
  const route = view.routes.find((candidate) => candidate.name === "trace");
  const diagrams = [];
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) },
    run: async ({ nodes }) => { diagrams.push(...nodes.map((node) => node.textContent)); } };
  const target = document.createElement("div");
  document.body.append(target);
  try {
    await route.render(target, { product: { address: ADDRESS, host, tokenStored: true } }, params);
  } finally {
    delete globalThis.mermaid;
  }
  return { target, diagrams, route };
}

export const byClass = (root, name, className) => find(root, (node) => node.localName === name && String(node.className).split(" ").includes(className));
export const rowOf = (target, id) => byClass(target, "tr", "module-row").find((row) => row.getAttribute("data-module") === id);
export const rowsOf = (target) => byClass(target, "tr", "module-row").map((row) => row.getAttribute("data-module"));
export const cellOf = (target, id, className) => byClass(rowOf(target, id), "td", className)[0];
export const itemsOf = (node) => (node ? find(node, (each) => each.localName === "li").map((each) => each.textContent) : []);
/** The gaps the page lists: { kind, text } for each <li class="module-gap">, in its order. */
export const gapsOf = (target) => byClass(target, "li", "module-gap").map((item) => ({ kind: item.getAttribute("data-kind"), text: item.textContent }));
export const textOf = (target) => String(target.textContent).replace(/\s+/g, " ").trim();
/** A person's click on a control the page drew: its own listener, through the event it dispatches. */
export const click = async (node) => { node.dispatchEvent(new Event("click")); for (let n = 0; n < 20; n += 1) await new Promise((resolve) => setImmediate(resolve)); };
