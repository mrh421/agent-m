// MOD-main-page's reading of the kept products (ITM-1015) — the sources the route `jobs` lists and the cards of the route `home` draw, as docs/architecture/MOD-main-page.md (Parts: `jobs.mjs`) names
// `sourcesOf`: "the instance's repository, then each product this browser keeps". The item is a refactoring that keeps behaviour: these tests state what the sources were before it and are
// green before and after.
// Run: node --test tests/main-page-sources.test.mjs
//
// Module: MOD-main-page
// Guards: ONE DASHBOARD SHOWS EVERY JOB; DEVELOP AGAINST INTERFACES; UC-046
// Level: unit
//
// The browser, the fake GitHub and the context are the helper tests/main-page-home-harness.mjs; the real MOD-site-frame `chosenProduct` connects each product. No request is made by the reading itself.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { INSTANCE_URL, PRODUCT_URL, OTHER_URL, browser, network, instanceFiles, smallProduct, timers, PRODUCT, OTHER, INSTANCE } from "./main-page-home-harness.mjs";
import { sourcesOf } from "../src/main-page/sources.mjs";

let net;
afterEach(() => {
  net?.restore();
  timers.restore();
});
const open = (products) => {
  net = network({ [PRODUCT]: smallProduct(), [OTHER]: smallProduct(), [INSTANCE]: instanceFiles() });
  net.install();
  return browser({ products });
};

// TST-1015001 · level: unit · module: MOD-main-page
// guards: ONE DASHBOARD SHOWS EVERY JOB; DEVELOP AGAINST INTERFACES
// given: this browser keeps alice/product twice, the instance alice/agent-m as a product, bob/other and an address that is none
// input: sourcesOf(context) — the sources of the route `jobs`
// expect: the addresses are the instance's, then alice/product, then bob/other — each once, the product equal to the instance not read again, the address that is none naming no source —; each product's source holds a host
test("TST-1015001 the list's sources are the instance, then each kept product once", async () => {
  const it = open([PRODUCT_URL, PRODUCT_URL, INSTANCE_URL, OTHER_URL, "not an address"]);
  const sources = await sourcesOf(it);
  assert.deepEqual(sources.map((source) => source.address), [INSTANCE_URL, PRODUCT_URL, OTHER_URL]);
  assert.deepEqual(sources.slice(1).map((source) => [source.own, typeof source.host?.readSnapshot]), [[undefined, "function"], [undefined, "function"]]);
});

// TST-1015002 · level: unit · module: MOD-main-page
// guards: THE MAIN PAGE SHOWS WHAT GOES ON IN THE INSTANCE; UC-046
// given: this browser keeps the same addresses as in TST-1015001; and, in another browser, no product
// input: sourcesOf(context, "home") — the sources the cards are drawn for
// expect: with products kept, the sources are the products in the order kept, each once, the instance among them only because it was kept as a product (it is not marked as the instance's own, and not skipped), and each holds a host and whether a token is stored for it; with none kept, the one source is the instance, marked as its own
test("TST-1015002 the cards' sources are the kept products once, or the instance while none is kept", async () => {
  const kept = await sourcesOf(open([PRODUCT_URL, PRODUCT_URL, INSTANCE_URL, OTHER_URL, "not an address"]), "home");
  assert.deepEqual(kept.map((source) => source.address), [PRODUCT_URL, INSTANCE_URL, OTHER_URL]);
  assert.deepEqual(kept.map((source) => [source.own, typeof source.host?.readSnapshot, typeof source.tokenStored]), [[undefined, "function", "boolean"], [undefined, "function", "boolean"], [undefined, "function", "boolean"]]);
  net.restore();
  const none = await sourcesOf(open([]), "home");
  assert.deepEqual(none.map((source) => [source.address, source.own]), [[INSTANCE_URL, true]]);
});
