// MOD-trace-pages' modules view offers the next step from a gap (ITM-736), as UC-025 step 6 and the accepted text of docs/architecture/MOD-trace-pages.md state it: "From a gap, the dashboard offers the next step:
// **Change the architecture** for a requirement without module (UC-023), **Implement** for a module without code or tests (UC-024)", and the modules view's extras: "*Change the architecture* and *Implement*", on the
// default branch only (the rule of the specification view's links to editing: "to the review pages, on the default branch only"). Neither link blocks or starts anything.
// Run: node --test tests/trace-pages-modules-next-step.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// Level: component
//
// The route is called through its public Route.render with a Host/Snapshot-shaped fake that holds the files of a small product (tests/trace-pages-harness.mjs); Mermaid is a recorder. Readings the cases take, which the
// pull request names:
//   - A gap of the kind `requirement-without-module` offers <a class="gap-change-architecture"> "Change the architecture" to `#decision`, the review pages' list of the architecture's decisions from which a decision is
//     changed (UC-023); a gap of the kind `module-without-code` or `module-without-test` offers <a class="gap-implement"> "Implement" to `#implement`, the route of the implementation pages. Both are links in the gap's
//     own <li class="module-gap">; they start and write nothing, and no other gap has either.
//   - "On the default branch only": the links stand where the Host names the version drawn as its default branch, and at any other version the gaps stand without them.
// Each case states its input and its expected result before it runs (given / input / expect). The counter-proofs are run as mutations and recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = ["# Next step fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", "",
  "**GAMMA RULE** *(Vibe Coding)*", "Gamma rule, which no module realises.", "*Check:* at review.", ""].join("\n");
const TST = (module, guards) => ["// TST-1", "// level: unit", `// module: ${module}`, `// guards: ${guards}`, ""].join("\n");
const FILES = {
  "SPEC.md": SPEC,
  "docs/architecture/ARC-001-the-whole.md": doc("ARC-001", "The whole", { forced_by: ["ALPHA RULE"], designs: ["MOD-page", "MOD-empty", "MOD-notest"] }),
  "docs/architecture/MOD-page.md": doc("MOD-page", "Renders the dashboard", { folder: "src/page/", realises: ["ALPHA RULE"], follows: ["ARC-001"] }),
  "docs/architecture/MOD-empty.md": doc("MOD-empty", "Has no code and no test", { folder: "src/empty/", realises: ["ALPHA RULE"], follows: ["ARC-001"] }),
  "docs/architecture/MOD-notest.md": doc("MOD-notest", "Has code and no test", { folder: "src/notest/", realises: ["ALPHA RULE"], follows: ["ARC-001"] }),
  "src/page/index.mjs": 'import { x } from "../notest/index.mjs";\nexport const page = x;\n',
  "src/notest/index.mjs": "export const x = 1;\n",
  "tools/outside.mjs": "export const outside = 1;\n",
  "tests/page.test.mjs": TST("MOD-page", "ALPHA RULE"),
};
const CLEAN = {
  "SPEC.md": SPEC.split("\n\n**GAMMA RULE**")[0] + "\n",
  "docs/architecture/ARC-001-the-whole.md": doc("ARC-001", "The whole", { forced_by: ["ALPHA RULE"], designs: ["MOD-page"] }),
  "docs/architecture/MOD-page.md": doc("MOD-page", "Renders the dashboard", { folder: "src/page/", realises: ["ALPHA RULE"], follows: ["ARC-001"] }),
  "src/page/index.mjs": "export const page = 1;\n", "tests/page.test.mjs": TST("MOD-page", "ALPHA RULE"),
};
const ADDRESS = "https://github.com/acme/library";
const hostOf = (files = FILES, extra = {}) => treeHost({ trees: { main: files, "v2026.1.0": files }, tags: ["v2026.1.0"], ...extra });

async function render(productHost, ref = "main") {
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const target = document.createElement("div");
  document.body.append(target);
  try {
    await route.render(target, { product: { address: ADDRESS, host: productHost } }, { key: "modules", ref });
  } finally {
    delete globalThis.mermaid;
  }
  return target;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const gaps = (target) => byClass(target, "li", "module-gap");
const gapOf = (target, kind, artifact) => gaps(target).find((gap) => gap.getAttribute("data-kind") === kind && gap.textContent.startsWith(artifact));
const links = (gap, className) => byClass(gap, "a", className).map((link) => [link.textContent, link.getAttribute("href")]);

// TST-073601 · level: component · module: MOD-trace-pages
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture product at main, with GAMMA RULE realised by no module
// input: Route.render with the key "modules" at main
// expect: the gap "requirement-without-module" for GAMMA RULE offers the link "Change the architecture" to #decision/product=<the product's address, encoded> and no Implement
test("a requirement without a module offers Change the architecture, to the architecture's review pages", async () => {
  const target = await render(hostOf());
  const gap = gapOf(target, "requirement-without-module", "GAMMA RULE");
  assert.ok(gap, "known positive: the gap is listed");
  assert.deepEqual(links(gap, "gap-change-architecture"), [["Change the architecture", "#decision/product=https%3A%2F%2Fgithub.com%2Facme%2Flibrary"]]);
  assert.deepEqual(links(gap, "gap-implement"), []);
});

// TST-073602 · level: component · module: MOD-trace-pages
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture product at main: MOD-empty has no code and no test, MOD-notest has code and no test
// input: Route.render with the key "modules" at main
// expect: the gaps "module-without-code" (MOD-empty), "module-without-test" (MOD-empty and MOD-notest) each offer the link "Implement" to #implement and no Change the architecture
test("a module without code and a module without tests offer Implement, to the implement route", async () => {
  const target = await render(hostOf());
  const cases = [["module-without-code", "MOD-empty"], ["module-without-test", "MOD-empty"], ["module-without-test", "MOD-notest"]];
  for (const [kind, artifact] of cases) {
    const gap = gapOf(target, kind, artifact);
    assert.ok(gap, `known positive: ${kind} for ${artifact} is listed`);
    assert.deepEqual(links(gap, "gap-implement"), [["Implement", "#implement"]], `${kind} ${artifact}`);
    assert.deepEqual(links(gap, "gap-change-architecture"), [], `${kind} ${artifact}`);
  }
});

// TST-073603 · level: component · module: MOD-trace-pages
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture product at main, whose other gaps are an import of MOD-notest that MOD-page's file does not name, a code file outside every module's folder and its folder, and the two modules whose tests guard no requirement (realises-nothing)
// input: Route.render with the key "modules" at main
// expect: counter-proof — those gaps are listed and offer neither link; the only links on the page are those of the four gaps above
test("the other gaps offer neither link", async () => {
  const target = await render(hostOf());
  const others = gaps(target).filter((gap) => !["requirement-without-module", "module-without-code", "module-without-test"].includes(gap.getAttribute("data-kind")));
  assert.deepEqual(others.map((gap) => gap.getAttribute("data-kind")).sort(), ["code-without-module", "folder-named-by-no-module", "import-not-in-uses", "realises-nothing", "realises-nothing"]);
  for (const gap of others) assert.deepEqual(find(gap, (node) => node.localName === "a"), [], gap.getAttribute("data-kind"));
  assert.equal(byClass(target, "a", "gap-implement").length + byClass(target, "a", "gap-change-architecture").length, 4);
});

// TST-073604 · level: component · module: MOD-trace-pages
// guards: UC-025
// given: the fixture product, drawn at the tag v2026.1.0, a version that is not the default branch
// input: Route.render with the key "modules" at the tag
// expect: the gaps are listed (known positive) and offer neither link; a product without a gap offers none either
test("at a version that is not the default branch the gaps offer no link, and a product without a gap offers none", async () => {
  const tagged = await render(hostOf(), "v2026.1.0");
  assert.ok(gaps(tagged).length > 0, "known positive: the gaps are listed");
  assert.equal(byClass(tagged, "a", "gap-implement").length + byClass(tagged, "a", "gap-change-architecture").length, 0);
  const clean = await render(hostOf(CLEAN));
  assert.equal(gaps(clean).length, 0);
  assert.equal(byClass(clean, "a", "gap-implement").length, 0);
});

// TST-073605 · level: component · module: MOD-trace-pages
// guards: UC-025
// given: the fixture product at main, a Host that has no write method
// input: Route.render with the key "modules" at main, and a click on each link
// expect: the links are anchors (the page changes by the address alone), Change the architecture to #decision/product=<the product's address, encoded> and Implement to #implement; the Host is asked nothing but reads; it has no commitFiles
test("the links start and write nothing: they are anchors to an address", async () => {
  const productHost = hostOf();
  const target = await render(productHost);
  const anchors = [...byClass(target, "a", "gap-implement"), ...byClass(target, "a", "gap-change-architecture")];
  assert.equal(anchors.length, 4);
  for (const anchor of anchors) assert.match(anchor.getAttribute("href"), /^#(decision\/product=https%3A%2F%2Fgithub\.com%2Facme%2Flibrary|implement)$/);
  assert.equal(Object.hasOwn(productHost, "commitFiles"), false);
});
