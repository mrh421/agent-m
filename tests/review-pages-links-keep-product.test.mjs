// Every link a product's review page draws to another review route keeps the product (ITM-1355, builds on ITM-1350): UC-008 step 2, the reviewer works on "a use case of the product chosen", and
// MOD-site-frame's `chosenProduct`: "the product the address's fragment or the selector names" — the frame takes the product from the address alone, and `menuOf` writes it "the form `chosenProduct`
// reads back": the route's address ending in `/product=` and the product's address percent-encoded. MOD-review-pages names these routes: `<k>`, `<k>/history`, `<k>/<id>`, `<k>/all`, `<k>/draft`,
// `<k>/<id>/edit` and `arrange/<group kind>`.
// Run: node --test tests/review-pages-links-keep-product.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-008
// Level: unit
//
// Readings the test takes where the texts leave one open:
//   - "keeps the product" for a link to a route with parts: the route's own address as it is on the instance's page, with `/product=<the product's address, percent-encoded>` after its last part, as
//     ITM-1350's row link is written and as the route's subject writes its key (tests/review-pages-subjects.test.mjs).
//   - A link to the instance's own page of a route (no product chosen) stays as it is.
//   - The links to routes of other modules (the step that stores the token, `get-your-own`) are not links to a route of MOD-review-pages and are not checked.
// The fixtures are tests/review-pages-draft-world.mjs'. Each test states its input and its expected result before it runs (given / input / expect).

import test from "node:test";
import assert from "node:assert/strict";
import { ENTRY_ID, GITHUB, PRODUCT, UC7_PATH, contextOf, draw, fakeProduct, fetched, find } from "./review-pages-draft-world.mjs";

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

// The addresses of the links of the page in `target` whose class is `className`.
const hrefsOf = (target, className) => find(target, (node) => node.localName === "a" && node.className.split(" ").includes(className)).map((node) => node.getAttribute("href"));
// The addresses of the links of the page in `target` whose text is `text`.
const hrefsNamed = (target, text) => find(target, (node) => node.localName === "a" && node.textContent === text).map((node) => node.getAttribute("href"));
// The instance's own page of the same repository: no product chosen.
const instancePage = (fake) => ({ ...contextOf(fake, { product: false }), instance: { repository: "alice/thesis-tool", host: fake.host } });

// TST-1355001 · level: unit · module: MOD-review-pages
// guards: UC-008
// given: a product with the open use cases UC-007 and UC-008, chosen on the page
// input: the route `use-case` drawn without a part, the product's list
// expect: the links Review all, Draft use cases, Arrange and History of use cases are "#use-case/id=all/product=<address, encoded>", "#use-case/id=draft/product=<address, encoded>", "#arrange/kind=use-cases/product=<address, encoded>" and "#use-case/id=history/product=<address, encoded>", one of each; known positive: each of the four links is found
test("the list of a product's use cases — Review all, Draft, Arrange and History keep the product", async () => {
  const page = await draw(fakeProduct(), "use-case", {});
  assert.equal(PRODUCT, encodeURIComponent(GITHUB.web), "the fixture's encoded address");
  assert.deepEqual(hrefsOf(page.target, "review-all"), [`#use-case/id=all/product=${PRODUCT}`], "Review all");
  assert.deepEqual(hrefsOf(page.target, "draft-link"), [`#use-case/id=draft/product=${PRODUCT}`], "Draft");
  assert.deepEqual(hrefsOf(page.target, "arrange-link"), [`#arrange/kind=use-cases/product=${PRODUCT}`], "Arrange");
  assert.deepEqual(hrefsOf(page.target, "history-link"), [`#use-case/id=history/product=${PRODUCT}`], "History");
});

// TST-1355002 · level: unit · module: MOD-review-pages
// guards: UC-008
// given: the instance's own page, with no product chosen, and the same repository's open use cases UC-007 and UC-008
// input: the route `use-case` drawn without a part
// expect: the links Review all, Draft use cases, Arrange and History of use cases are "#use-case/id=all", "#use-case/id=draft", "#arrange/kind=use-cases" and "#use-case/id=history", with no product; known positive: each of the four links is found
test("the list of the instance's own use cases — Review all, Draft, Arrange and History stay without a product", async () => {
  const fake = fakeProduct();
  const page = await draw(fake, "use-case", {}, { context: instancePage(fake) });
  assert.deepEqual(hrefsOf(page.target, "review-all"), ["#use-case/id=all"], "Review all");
  assert.deepEqual(hrefsOf(page.target, "draft-link"), ["#use-case/id=draft"], "Draft");
  assert.deepEqual(hrefsOf(page.target, "arrange-link"), ["#arrange/kind=use-cases"], "Arrange");
  assert.deepEqual(hrefsOf(page.target, "history-link"), ["#use-case/id=history"], "History");
});

// TST-1355003 · level: unit · module: MOD-review-pages
// guards: UC-008
// given: a product whose approval records are twenty commits long in its history, and the same repository as the instance's own page
// input: the route `use-case` with the part `history`, on the product's page and on the instance's
// expect: on the product's page the link Older is "#use-case/id=history/before=<the parent of the twentieth commit>/product=<address, encoded>"; on the instance's page it is "#use-case/id=history/before=<the parent>"; known positive: the link is found on each page
test("the history of a product's use cases — Older keeps the product", async () => {
  const fake = fakeProduct();
  const commits = Array.from({ length: 20 }, (_, at) => ({ author: { name: "Alice", account: "alice" }, date: "2026-11-01", changes: [], parents: [`parent${at}`] }));
  const host = { ...fake.host, readHistory: async () => commits };
  const onProduct = await draw(fake, "use-case", { id: "history" }, { context: { ...contextOf(fake), product: { address: GITHUB.web, kind: "github", host } } });
  assert.deepEqual(hrefsOf(onProduct.target, "older-link"), [`#use-case/id=history/before=parent19/product=${PRODUCT}`], "the product's Older");
  const own = { ...instancePage(fake), instance: { repository: "alice/thesis-tool", host } };
  const onInstance = await draw(fake, "use-case", { id: "history" }, { context: own });
  assert.deepEqual(hrefsOf(onInstance.target, "older-link"), ["#use-case/id=history/before=parent19"], "the instance's Older");
});

// TST-1355004 · level: unit · module: MOD-review-pages
// guards: UC-008
// given: a product with the open use case UC-007, and the instance's own page of the same repository
// input: the route `use-case` with the identifier UC-007, on each page
// expect: the link Edit is "#use-case/id=UC-007/edit=1/product=<address, encoded>" on the product's page and "#use-case/id=UC-007/edit=1" on the instance's; known positive: the link is found on each
test("the page of a product's use case — Edit keeps the product", async () => {
  const fake = fakeProduct();
  assert.ok(fake.files()[UC7_PATH], "the fixture holds UC-007");
  assert.deepEqual(hrefsOf((await draw(fake, "use-case", { id: "UC-007" })).target, "edit-link"), [`#use-case/id=UC-007/edit=1/product=${PRODUCT}`], "the product's Edit");
  assert.deepEqual(hrefsOf((await draw(fake, "use-case", { id: "UC-007" }, { context: instancePage(fake) })).target, "edit-link"), ["#use-case/id=UC-007/edit=1"], "the instance's Edit");
});

// TST-1355005 · level: unit · module: MOD-review-pages
// guards: UC-008
// given: a product with the open SPEC change entry, and the instance's own page of the same repository
// input: the route `spec-entry` with the entry's identifier, on each page
// expect: the link Edit is "#spec-entry/id=<id>/edit=1/product=<address, encoded>" on the product's page and "#spec-entry/id=<id>/edit=1" on the instance's; known positive: the link is found on each
test("the page of a product's SPEC entry — Edit keeps the product", async () => {
  const fake = fakeProduct();
  assert.deepEqual(hrefsOf((await draw(fake, "spec-entry", { id: ENTRY_ID })).target, "edit-link"), [`#spec-entry/id=${ENTRY_ID}/edit=1/product=${PRODUCT}`], "the product's Edit");
  assert.deepEqual(hrefsOf((await draw(fake, "spec-entry", { id: ENTRY_ID }, { context: instancePage(fake) })).target, "edit-link"), [`#spec-entry/id=${ENTRY_ID}/edit=1`], "the instance's Edit");
});

// TST-1355006 · level: unit · module: MOD-review-pages
// guards: UC-008
// given: a product without a use case UC-999 and without a SPEC entry spec-none-01, and the instance's own page of the same repository
// input: the routes `use-case` with the identifier UC-999 and `spec-entry` with spec-none-01, each also with the part `edit`, on each page
// expect: the link "All use cases" is "#use-case/product=<address, encoded>" and "All SPEC change entries" is "#spec-entry/product=<address, encoded>" on the product's page, and "#use-case" and "#spec-entry" on the instance's; known positive: each page holds its link
test("a file that does not exist — the link to all of its kind keeps the product", async () => {
  const fake = fakeProduct();
  for (const [route, text, params] of [["use-case", "All use cases", { id: "UC-999" }], ["use-case", "All use cases", { id: "UC-999", edit: "1" }],
    ["spec-entry", "All SPEC change entries", { id: "spec-none-01" }], ["spec-entry", "All SPEC change entries", { id: "spec-none-01", edit: "1" }]]) {
    assert.deepEqual(hrefsNamed((await draw(fake, route, params)).target, text), [`#${route}/product=${PRODUCT}`], `${route} ${JSON.stringify(params)}: the product's link`);
    assert.deepEqual(hrefsNamed((await draw(fake, route, params, { context: instancePage(fake) })).target, text), [`#${route}`], `${route} ${JSON.stringify(params)}: the instance's link`);
  }
});

// TST-1355007 · level: unit · module: MOD-review-pages
// guards: UC-008
// given: a product with the open use cases UC-007 and UC-008, and the instance's own page of the same repository
// input: the route `use-case` with the part `draft`, on each page
// expect: the link "All use cases" is "#use-case/product=<address, encoded>" on the product's page and "#use-case" on the instance's; known positive: each page holds the link
test("the drafting page of a product's use cases — the link back to all use cases keeps the product", async () => {
  const fake = fakeProduct();
  assert.deepEqual(hrefsNamed((await draw(fake, "use-case", { id: "draft" })).target, "All use cases"), [`#use-case/product=${PRODUCT}`], "the product's link");
  assert.deepEqual(hrefsNamed((await draw(fake, "use-case", { id: "draft" }, { context: instancePage(fake) })).target, "All use cases"), ["#use-case"], "the instance's link");
});
