// A row of a product's list links that product's file (ITM-1350, finding UC008-S2 of ITM-372's system test): UC-008 step 2, "The reviewer opens a use case; the dashboard renders its text and
// Mermaid diagram", on the list of "every use case of that product" (step 1), and MOD-site-frame's `menuOf`: "With `product`, the address of a product this browser keeps, each `href` that is not
// null ends in `/product=` and the address percent-encoded, the form `chosenProduct` reads back; without it, or with null, it is the entry's alone."
// Run: node --test tests/review-pages-row-link-product.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-008
// Level: unit
//
// Readings the test takes where the texts leave one open:
//   - "the form `chosenProduct` reads back" for a link to a file: the file's own address `#<route>/id=<id>` with `/product=<the product's address, percent-encoded>` after it, as MOD-site-frame's
//     `menuOf` ends an entry's link and as the route's subject writes its key (tests/review-pages-subjects.test.mjs).
//   - A row of the list is a <tr data-id="<id>">; its link is the <a> in its second cell. The list shows a file twice while it is open or changed (once under "Open or changed", once in the list of every
//     file), and both rows are checked.
// The fixtures are tests/review-pages-draft-world.mjs'. The route is drawn as the frame draws it. Each test states its input and its expected result before it runs (given / input / expect).

import test from "node:test";
import assert from "node:assert/strict";
import { ENTRY_ID, GITHUB, PRODUCT, contextOf, draw, fakeProduct, fetched, find } from "./review-pages-draft-world.mjs";

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

// The link of every row of the list drawn in `target`: [data-id, href] for each <tr data-id>.
const rowLinks = (target) => find(target, (node) => node.localName === "tr" && node.getAttribute("data-id") !== null).map((row) => {
  const anchor = find(row, (node) => node.localName === "a")[0];
  return [row.getAttribute("data-id"), anchor?.getAttribute("href")];
});

// TST-1350101 · level: unit · module: MOD-review-pages
// guards: UC-008
// given: a product with the open use cases UC-007 and UC-008, chosen on the page
// input: the route `use-case` drawn without a part, the product's list
// expect: the link of the row of UC-007 is "#use-case/id=UC-007/product=<the product's address, percent-encoded>" and that of UC-008 "#use-case/id=UC-008/product=<the address, encoded>", in the list under "Open or changed" and in the list of every use case; known positive: both rows are found, two for each use case
test("the list of a product's use cases — a row links the use case with the product in the address", async () => {
  const page = await draw(fakeProduct(), "use-case", {});
  const links = rowLinks(page.target);
  assert.equal(PRODUCT, encodeURIComponent(GITHUB.web), "the fixture's encoded address");
  assert.deepEqual(links.map(([id]) => id).sort(), ["UC-007", "UC-007", "UC-008", "UC-008"], "known positive: the rows of both use cases are found, each in two lists");
  for (const [id, href] of links) assert.equal(href, `#use-case/id=${id}/product=${PRODUCT}`, `${id}: the row's link`);
});

// TST-1350102 · level: unit · module: MOD-review-pages
// guards: UC-008
// given: the instance's own page, with no product chosen, and the same repository's open use cases UC-007 and UC-008
// input: the route `use-case` drawn without a part
// expect: the link of each row is "#use-case/id=<id>" with no product; known positive: the rows of both use cases are found
test("the list of the instance's own use cases — a row's link stays without a product", async () => {
  const fake = fakeProduct();
  const context = { ...contextOf(fake, { product: false }), instance: { repository: "alice/thesis-tool", host: fake.host } };
  const links = rowLinks((await draw(fake, "use-case", {}, { context })).target);
  assert.deepEqual(links.map(([id]) => id).sort(), ["UC-007", "UC-007", "UC-008", "UC-008"], "known positive: the rows of both use cases are found");
  for (const [id, href] of links) assert.equal(href, `#use-case/id=${id}`, `${id}: the row's link`);
});

// TST-1350103 · level: unit · module: MOD-review-pages
// guards: UC-008
// given: a product with the open architecture decision ARC-001, the open module file MOD-reader and the open entry of a SPEC change queue
// input: the routes `decision`, `module` and `spec-entry` drawn without a part
// expect: the rows link "#decision/id=ARC-001/product=<address, encoded>", "#module/id=MOD-reader/product=<address, encoded>" and "#spec-entry/id=<the entry's identifier>/product=<address, encoded>"; known positive: each list holds the row of its file
test("the lists of a product's decisions, module files and SPEC entries — a row links its file with the product in the address", async () => {
  const fake = fakeProduct();
  for (const [route, id] of [["decision", "ARC-001"], ["module", "MOD-reader"], ["spec-entry", ENTRY_ID]]) {
    const links = rowLinks((await draw(fake, route, {})).target).filter(([each]) => each === id);
    assert.ok(links.length > 0, `known positive: the list of ${route} holds the row of ${id}`);
    for (const [, href] of links) assert.equal(href, `#${route}/id=${encodeURIComponent(id)}/product=${PRODUCT}`, `${route}: the row's link`);
  }
});
