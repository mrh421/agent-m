// Every editor of MOD-review-pages links the arrangement of its kind (ITM-1399), as UC-018 3e states it: "The author wants a requirement or use case in another group. That is not an
// edit: the editor changes text only, never a group. A link opens the arrangement (UC-021), which commits the group file directly and leaves this text — and its approval — untouched."
// MOD-review-pages names the editors (`<k>/<id>/edit`, `requirement/<name>/edit`, `requirements/new`) and the arrangement (`arrange/<group kind>`, the group kinds requirements,
// use-cases, architecture, modules and tests); the lists already link it (TST-1355001, TST-1355002).
// Run: node --test tests/review-pages-editor-arrange-link.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-018
// Level: unit
//
// Readings the test takes where the texts leave one open:
//   - The link of an editor is the one the lists draw: <a class="arrange-link"> to `#arrange/kind=<group kind>`, which keeps the page's product as every link of a review route does
//     (tests/review-pages-links-keep-product.test.mjs). The group kind of a requirement is requirements, of a use case use-cases, of a decision architecture, of a module modules.
//   - The item names "a test" too; MOD-review-pages edits no test (its editors are those of a reviewed file, a requirement and an open SPEC entry), so no editor of a test is drawn.
// The fixtures are tests/review-pages-draft-world.mjs'. Each test states its input and its expected result before it runs (given / input / expect).

import test from "node:test";
import assert from "node:assert/strict";
import { GITHUB, HEADING, LOAN, PRODUCT, contextOf, draw, fakeProduct, fetched, find } from "./review-pages-draft-world.mjs";

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

// The addresses of the links of the page in `target` whose class is `className`.
const hrefsOf = (target, className) => find(target, (node) => node.localName === "a" && node.className.split(" ").includes(className)).map((node) => node.getAttribute("href"));
// The editor's text area: there is one where the editor is open.
const editorOpen = (target) => find(target, (node) => node.localName === "textarea").length > 0;
// The instance's own page of the same repository: no product chosen.
const instancePage = (fake) => ({ ...contextOf(fake, { product: false }), instance: { repository: "alice/thesis-tool", host: fake.host } });

// Each editor: its route, its parameters and the group kind of its arrangement.
const EDITORS = [
  ["requirement", { name: LOAN }, "requirements"],
  ["requirements", { section: HEADING }, "requirements"],
  ["use-case", { id: "UC-007", edit: "1" }, "use-cases"],
  ["decision", { id: "ARC-001", edit: "1" }, "architecture"],
  ["module", { id: "MOD-reader", edit: "1" }, "modules"],
];

// TST-1399201 · level: unit · module: MOD-review-pages
// guards: UC-018
// given: a product on GitHub, chosen on the page, whose SPEC holds A LOAN HAS A DUE DATE in "## 1. Lending" and which holds UC-007, ARC-001 and MOD-reader; its token stored
// input: the editors requirement/name=A LOAN HAS A DUE DATE, requirements/section=## 1. Lending, use-case/id=UC-007/edit=1, decision/id=ARC-001/edit=1 and module/id=MOD-reader/edit=1
// expect: each editor is open and holds one link of the class arrange-link, "#arrange/kind=requirements/product=<address, encoded>" for the two of a requirement, "…kind=use-cases…" for UC-007, "…kind=architecture…" for ARC-001 and "…kind=modules…" for MOD-reader; known positive: the list of the use cases links "#arrange/kind=use-cases/product=<address, encoded>"
test("the editors of a product's requirement, use case, decision and module — each links the arrangement of its kind", async () => {
  const fake = fakeProduct();
  assert.equal(PRODUCT, encodeURIComponent(GITHUB.web), "the fixture's encoded address");
  assert.deepEqual(hrefsOf((await draw(fake, "use-case", {})).target, "arrange-link"), [`#arrange/kind=use-cases/product=${PRODUCT}`], "known positive: the list links the arrangement");
  for (const [route, params, kind] of EDITORS) {
    const { target } = await draw(fake, route, params);
    assert.ok(editorOpen(target), `${route} ${JSON.stringify(params)}: the editor is open`);
    assert.deepEqual(hrefsOf(target, "arrange-link"), [`#arrange/kind=${kind}/product=${PRODUCT}`], `${route} ${JSON.stringify(params)}: the arrangement of ${kind}`);
  }
  assert.deepEqual(fake.writes(), [], "nothing written");
});

// TST-1399202 · level: unit · module: MOD-review-pages
// guards: UC-018
// given: the instance's own page, with no product chosen, of the repository of TST-1399201
// input: the five editors of TST-1399201
// expect: each editor is open and holds one link of the class arrange-link, "#arrange/kind=requirements" for the two of a requirement, "#arrange/kind=use-cases", "#arrange/kind=architecture" and "#arrange/kind=modules" for the others, with no product; known positive: the list of the use cases links "#arrange/kind=use-cases"
test("the editors of the instance's own requirement, use case, decision and module — each links the arrangement of its kind, without a product", async () => {
  const fake = fakeProduct();
  assert.deepEqual(hrefsOf((await draw(fake, "use-case", {}, { context: instancePage(fake) })).target, "arrange-link"), ["#arrange/kind=use-cases"], "known positive: the list links the arrangement");
  for (const [route, params, kind] of EDITORS) {
    const { target } = await draw(fake, route, params, { context: instancePage(fake) });
    assert.ok(editorOpen(target), `${route} ${JSON.stringify(params)}: the editor is open`);
    assert.deepEqual(hrefsOf(target, "arrange-link"), [`#arrange/kind=${kind}`], `${route} ${JSON.stringify(params)}: the arrangement of ${kind}`);
  }
  assert.deepEqual(fake.writes(), [], "nothing written");
});
