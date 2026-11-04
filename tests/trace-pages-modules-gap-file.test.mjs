// ITM-1353 — MOD-trace-pages' modules view leads a gap to the file it concerns, as UC-025 step 6 says: "The reviewer follows a row or a gap to the file it concerns", and as the accepted text of
// docs/architecture/MOD-trace-pages.md has the modules view lead to "the module's file and folder".
// Run: node --test tests/trace-pages-modules-gap-file.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// Level: unit
//
// The route is called through its public Route.render with the Host fake of tests/trace-pages-harness.mjs; Mermaid is a recorder. Readings the cases take, which the pull request names:
//   - "As the view's other links to a file do": the view opens a file in place, by a click on a button (the module's name in the table; the lines of the gaps page). The fixture host has no webLinks, so the gap's
//     control is a button in the gap's own <li class="module-gap">, which carries the text of the gap's artifact (the line's text is unchanged) and opens the file beneath the gap.
//   - The gap's `artifact` is a module id or a code file or folder path (the ruling at ITM-1352); the file is the gap's `path`: the module's file, the code file, and for a folder the code files that lie in it.
//   - A gap of the kind `requirement-without-module` concerns a requirement, which is no file of the two, and offers no such control.
// Each case states its input and its expected result before it runs. The counter-proofs are run as mutations and recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { doc, document, find, treeHost } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const SPEC = ["# Gap file fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", "",
  "**GAMMA RULE** *(Vibe Coding)*", "Gamma rule, which no module realises.", "*Check:* at review.", ""].join("\n");
const TST = (module, guards) => ["// TST-1", "// level: unit", `// module: ${module}`, `// guards: ${guards}`, ""].join("\n");
const FILES = {
  "SPEC.md": SPEC,
  "docs/architecture/ARC-001-the-whole.md": doc("ARC-001", "The whole", { forced_by: ["ALPHA RULE"], designs: ["MOD-page", "MOD-empty"] }),
  "docs/architecture/MOD-page.md": doc("MOD-page", "Renders the dashboard", { folder: "src/page/", realises: ["ALPHA RULE"], follows: ["ARC-001"] }),
  "docs/architecture/MOD-empty.md": doc("MOD-empty", "Has no code and no test", { folder: "src/empty/", realises: ["ALPHA RULE"], follows: ["ARC-001"] }),
  "src/page/index.mjs": "export const page = 1;\n",
  "tools/outside.mjs": "export const outside = 1;\n",
  "tests/page.test.mjs": TST("MOD-page", "ALPHA RULE"),
};
const hostOf = (extra = {}) => treeHost({ trees: { main: FILES }, tags: [], ...extra });

async function render(productHost) {
  globalThis.mermaid = { initialize() {}, mermaidAPI: { getDiagramFromText: async () => ({ db: { getVertices: () => ({}) } }) }, run: async () => {} };
  const target = document.createElement("div");
  document.body.append(target);
  try {
    await route.render(target, { product: { address: "https://github.com/acme/library", host: productHost } }, { key: "modules", ref: "main" });
  } finally {
    delete globalThis.mermaid;
  }
  return target;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const gapOf = (target, kind, artifact) => byClass(target, "li", "module-gap").find((gap) => gap.getAttribute("data-kind") === kind && gap.textContent.startsWith(artifact));
const buttonsOf = (gap) => find(gap, (node) => node.localName === "button");
const opened = (gap) => byClass(gap, "div", "gap-opened")[0];
async function click(node) {
  node.dispatchEvent(new Event("click"));
  for (let n = 0; n < 20; n += 1) await new Promise((resolve) => setImmediate(resolve));
}

// TST-1353001 · level: unit · module: MOD-trace-pages
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture product at main, whose gap "module-without-code" concerns MOD-empty, with its file docs/architecture/MOD-empty.md titled "Has no code and no test" (known positive: the gap is listed and offers the link Implement)
// input: Route.render with the key "modules" at main, a click on the gap's file control, and a second click
// expect: the gap holds one button whose text is "MOD-empty"; the first click shows the text of docs/architecture/MOD-empty.md beneath the gap ("Has no code and no test"); the second click closes it; the link Implement to #implement stays in the gap
test("a module's gap opens the module's file beneath it, and keeps the link of the next step", async () => {
  const target = await render(hostOf());
  const gap = gapOf(target, "module-without-code", "MOD-empty");
  assert.ok(gap, "known positive: the gap is listed");
  assert.deepEqual(byClass(gap, "a", "gap-implement").map((link) => link.getAttribute("href")), ["#implement"], "known positive: the next step's link");
  assert.deepEqual(buttonsOf(gap).map((button) => button.textContent), ["MOD-empty"]);
  assert.equal(opened(gap).textContent, "");
  await click(buttonsOf(gap)[0]);
  assert.match(opened(gap).textContent, /Has no code and no test/);
  await click(buttonsOf(gap)[0]);
  assert.equal(opened(gap).textContent, "");
  assert.deepEqual(byClass(gap, "a", "gap-implement").map((link) => link.getAttribute("href")), ["#implement"]);
});

// TST-1353002 · level: unit · module: MOD-trace-pages
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture product at main, whose gap "code-without-module" concerns the code file tools/outside.mjs, and whose gap "folder-named-by-no-module" concerns the folder tools
// input: Route.render with the key "modules" at main, a click on the file control of each of the two gaps
// expect: the code file's gap shows the text of tools/outside.mjs, "export const outside = 1;"; the folder's gap shows the code file tools/outside.mjs that lies in the folder
test("a code file's gap opens the code file, and a folder's gap lists the code files in the folder", async () => {
  const target = await render(hostOf());
  const code = gapOf(target, "code-without-module", "tools/outside.mjs");
  const folder = gapOf(target, "folder-named-by-no-module", "tools");
  assert.ok(code && folder, "known positive: both gaps are listed");
  await click(buttonsOf(code)[0]);
  assert.match(opened(code).textContent, /export const outside = 1;/);
  await click(buttonsOf(folder)[0]);
  assert.match(opened(folder).textContent, /tools\/outside\.mjs/);
});

// TST-1353003 · level: unit · module: MOD-trace-pages
// guards: UC-025; MODULE GAPS ARE REPORTED, NOT FORBIDDEN
// given: the fixture product at main, whose gap "requirement-without-module" concerns GAMMA RULE, a requirement and no file of a module or of code (known positive: the gap is listed with the link Change the architecture)
// input: Route.render with the key "modules" at main
// expect: counter-proof — the gap for GAMMA RULE holds no button; the link Change the architecture to #decision/product=<the product's address, encoded> stays
test("a requirement's gap offers no file control and keeps its next step", async () => {
  const target = await render(hostOf());
  const gap = gapOf(target, "requirement-without-module", "GAMMA RULE");
  assert.ok(gap, "known positive: the gap is listed");
  assert.deepEqual(byClass(gap, "a", "gap-change-architecture").map((link) => link.getAttribute("href")), ["#decision/product=https%3A%2F%2Fgithub.com%2Facme%2Flibrary"]);
  assert.equal(buttonsOf(gap).length, 0, "no file control");
});

// TST-1353004 · level: unit · module: MOD-trace-pages
// guards: UC-025
// given: the fixture product at main, a Host whose read of docs/architecture/MOD-empty.md fails after the page is drawn, as an unreachable server does (known positive: the same read succeeds in TST-1353001)
// input: Route.render with the key "modules" at main, and a click on the file control of the gap "module-without-code" of MOD-empty
// expect: beneath the gap a line of class traces-problem says the file could not be read, and the other gaps of MOD-empty stay
test("a file that cannot be read is named beneath its gap", async () => {
  let drawn = false;
  const host = hostOf();
  const readSnapshot = host.readSnapshot;
  host.readSnapshot = async (...asked) => {
    const snapshot = await readSnapshot(...asked);
    return { ...snapshot, read: async (path) => { if (drawn && path === "docs/architecture/MOD-empty.md") throw new Error("the server is unreachable"); return snapshot.read(path); } };
  };
  const target = await render(host);
  drawn = true;
  const gap = gapOf(target, "module-without-code", "MOD-empty");
  assert.ok(gap, "known positive: the gap is listed");
  await click(buttonsOf(gap)[0]);
  assert.match(byClass(opened(gap), "p", "traces-problem")[0]?.textContent ?? "", /could not be read/);
  assert.ok(gapOf(target, "module-without-test", "MOD-empty"), "the rest of the page stays");
});
