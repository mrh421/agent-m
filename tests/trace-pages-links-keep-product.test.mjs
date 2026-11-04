// MOD-trace-pages' links to the review pages keep the product (ITM-1364), as the accepted text of docs/architecture/MOD-site-frame.md states the address form:
// "With `product`, the address of a product this browser keeps, each `href` that is not null ends in `/product=` and the address percent-encoded, the form `chosenProduct` reads back."
// MOD-trace-pages (docs/architecture/MOD-trace-pages.md): "Editing, the draft of a change asked for in the prompt bar, and arranging are the review pages' routes, which its links lead to."
// Run: node --test tests/trace-pages-links-keep-product.test.mjs
//
// Module: MOD-trace-pages
// Guards: ARTIFACTS ARE ARRANGED IN NESTED GROUPS; UC-021; UC-020
// Level: unit
//
// The route is called through its public Route.render over the Host fake of tests/trace-pages-harness.mjs (it has no write method). Readings the cases take, each from the sentence quoted:
//   - "the routes of the review pages" are those MOD-review-pages serves: requirement, requirements, spec-entry, arrange and decision (src/review-pages/routes.mjs). The links to `#implement`
//     (MOD-implementation-pages), `#release` (MOD-test-pages) and `#trace/…` (this module's own) lead to other modules' routes and are not among them.
//   - "the instance's pages": a context whose product is the instance itself, handed to the route as `{ instance: { host }, product: { host } }` with no address, or a product whose address is the
//     instance's repository. Their links stay as they are, with no `product=`.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const ADDRESS = "https://github.com/acme/library";
const KEPT = `/product=${encodeURIComponent(ADDRESS)}`;
const TICK = "`";
const SPEC = ["# Links fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", "",
  "**GAMMA RULE** *(Vibe Coding)*", "Gamma rule, which no module realises.", "*Check:* at review.", ""].join("\n");
const OPEN = "2026-10-09_open";
const QUEUE = {
  [`docs/spec-freigaben/${OPEN}/index.md`]: [`# SPEC approvals — queue 2026-10-09 · ${OPEN}`, "", `**Zieldatei aller Einträge:** ${TICK}SPEC.md${TICK}`, "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 01 | ${TICK}SPEC.md${TICK} | ## Only section | — | — |`, ""].join("\n"),
  [`docs/spec-freigaben/${OPEN}/entscheidungen.md`]: ["# Decisions — queue 2026-10-09", "", "Append-only.", "", ""].join("\n"),
  [`docs/spec-freigaben/${OPEN}/01-entry.md`]: "## Only section\n\n**ALPHA RULE** *(Vibe Coding)*\nAlpha rule, changed.\n*Check:* at review.\n",
};
const TST = (module, guards) => ["// TST-1", "// level: unit", `// module: ${module}`, `// guards: ${guards}`, ""].join("\n");
const FILES = {
  "SPEC.md": SPEC,
  ...QUEUE,
  "docs/architecture/ARC-001-the-whole.md": doc("ARC-001", "The whole", { forced_by: ["ALPHA RULE"], designs: ["MOD-page", "MOD-empty"] }),
  "docs/architecture/MOD-page.md": doc("MOD-page", "Renders the dashboard", { folder: "src/page/", realises: ["ALPHA RULE"], follows: ["ARC-001"] }),
  "docs/architecture/MOD-empty.md": doc("MOD-empty", "Has no code and no test", { folder: "src/empty/", realises: ["ALPHA RULE"], follows: ["ARC-001"] }),
  "src/page/index.mjs": "export const page = 1;\n",
  "tests/page.test.mjs": TST("MOD-page", "ALPHA RULE"),
};
const hostOf = () => treeHost({ trees: { main: FILES }, tags: [] });

async function render(context, params) {
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const target = document.createElement("div");
  document.body.append(target);
  try {
    await route.render(target, context, params);
  } finally {
    delete globalThis.mermaid;
  }
  return target;
}
const productPage = (host, params) => render({ product: { address: ADDRESS, host } }, params);
const instancePage = (host, params) => render({ instance: { repository: "acme/agent-m", host }, product: { host } }, params);
const anchors = (root) => find(root, (node) => node.localName === "a");
const classes = (node) => String(node.className).split(/\s+/);
const SPEC_LINKS = ["requirement-edit", "requirement-new", "spec-waiting-entry", "spec-history-link", "arrange-link"];
const linksOf = (root, names) => anchors(root).filter((node) => names.some((name) => classes(node).includes(name))).map((node) => [classes(node)[0], node.getAttribute("href")]);

// TST-1364001 · level: unit · module: MOD-trace-pages
// guards: ARTIFACTS ARE ARRANGED IN NESTED GROUPS; UC-021; UC-020
// given: the specification of a product at its address on the default branch main, with two requirements, one section and one entry waiting for acceptance (known positive: each of the five kinds of link is drawn)
// input: the specification view drawn at main
// expect: Edit (one for each requirement), + Requirement, the waiting entry, History of SPEC changes and Arrange each lead to their review route with /product=<the product's address, percent-encoded> as the last part
test("TST-1364001 every link of a product's specification to a review route ends in the product", async () => {
  const target = await productPage(hostOf(), { key: "specification", ref: "main" });
  const links = linksOf(target, SPEC_LINKS);
  const kinds = new Set(links.map(([kind]) => kind));
  assert.deepEqual([...kinds].sort(), [...SPEC_LINKS].sort(), "known positive: all five kinds of link are drawn");
  assert.deepEqual(links, [
    ["spec-waiting-entry", `#spec-entry/id=spec-${OPEN}-01${KEPT}`],
    ["requirement-edit", `#requirement/name=${encodeURIComponent("ALPHA RULE")}${KEPT}`],
    ["requirement-edit", `#requirement/name=${encodeURIComponent("GAMMA RULE")}${KEPT}`],
    ["requirement-new", `#requirements/section=${encodeURIComponent("## Only section")}${KEPT}`],
    ["spec-history-link", `#spec-entry/id=history${KEPT}`],
    ["arrange-link", `#arrange/kind=requirements${KEPT}`],
  ]);
});

// TST-1364002 · level: unit · module: MOD-trace-pages
// guards: ARTIFACTS ARE ARRANGED IN NESTED GROUPS; UC-021; UC-020
// given: the same specification, drawn for the instance itself: once for a context whose product is read through the instance's own host and names no address, once for a product whose address is the instance's repository (known positive: a product's page draws the same five kinds of link)
// input: the specification view drawn at main, for each context
// expect: counter-proof — the five kinds of link are drawn and none holds "product=": Edit to #requirement/name=…, + Requirement to #requirements/section=…, the waiting entry to #spec-entry/id=spec-…, History of SPEC changes to #spec-entry/id=history, Arrange to #arrange/kind=requirements
test("TST-1364002 the instance's own specification keeps its links as they are", async () => {
  const bare = [
    ["spec-waiting-entry", `#spec-entry/id=spec-${OPEN}-01`],
    ["requirement-edit", `#requirement/name=${encodeURIComponent("ALPHA RULE")}`],
    ["requirement-edit", `#requirement/name=${encodeURIComponent("GAMMA RULE")}`],
    ["requirement-new", `#requirements/section=${encodeURIComponent("## Only section")}`],
    ["spec-history-link", "#spec-entry/id=history"],
    ["arrange-link", "#arrange/kind=requirements"],
  ];
  assert.equal(linksOf(await productPage(hostOf(), { key: "specification", ref: "main" }), SPEC_LINKS).length, bare.length, "known positive: a product's page draws the same links");
  assert.deepEqual(linksOf(await instancePage(hostOf(), { key: "specification", ref: "main" }), SPEC_LINKS), bare, "the instance read through its own host");
  const named = await render({ instance: { repository: "acme/library", host: hostOf() }, product: { address: ADDRESS, host: hostOf() } }, { key: "specification", ref: "main" });
  assert.deepEqual(linksOf(named, SPEC_LINKS), bare, "the instance named by its address");
});

// TST-1364003 · level: unit · module: MOD-trace-pages
// guards: UC-025; UC-021
// given: the product's modules at main, with the requirement GAMMA RULE realised by no module and the module MOD-empty without code (known positive: both gaps offer their next step)
// input: the modules view drawn at main for the product, and for the instance
// expect: for the product Change the architecture leads to #decision/product=<the product's address, percent-encoded> and Implement to #implement, which is no route of the review pages and stays as it is; for the instance (counter-proof) Change the architecture leads to #decision
test("TST-1364003 Change the architecture keeps the product, Implement leads to the implementation pages as before", async () => {
  const next = (target) => anchors(target).filter((node) => classes(node).includes("gap-change-architecture") || classes(node).includes("gap-implement")).map((node) => [node.textContent, node.getAttribute("href")]);
  const product = next(await productPage(hostOf(), { key: "modules", ref: "main" }));
  assert.ok(product.some(([text]) => text === "Implement") && product.some(([text]) => text === "Change the architecture"), "known positive: both next steps are drawn");
  assert.deepEqual(product.filter(([text]) => text === "Change the architecture"), [["Change the architecture", `#decision${KEPT}`]]);
  assert.deepEqual([...new Set(product.filter(([text]) => text === "Implement").map(([, href]) => href))], ["#implement"]);
  const instance = next(await instancePage(hostOf(), { key: "modules", ref: "main" }));
  assert.deepEqual(instance.filter(([text]) => text === "Change the architecture"), [["Change the architecture", "#decision"]], "counter-proof: the instance's link stays");
});
