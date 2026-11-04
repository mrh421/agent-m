// Release tests of ITM-1284 — UC-033 1a and UC-012 5b on the issue's page: the lead of an issue not classified yet ("Agent M links to UC-012, step 2") and the lead of a bug that no participant can fix ("Agent M says so and
// links to UC-017") open Agent M's own use cases, whatever product's issue is shown. The behaviour is UC-033 and UC-012 (docs/use-cases/UC-033-move-an-issue-into-the-backlog.md, Alternative flow 1a;
// docs/use-cases/UC-012-turn-an-issue-into-a-specification-change.md, Alternative flow 5b) as docs/architecture/MOD-maintenance-pages.md (`issue/<number>`) and docs/architecture/MOD-site-frame.md (ViewContext: `go` "writes the
// chosen product into the address unless `params` names a `product`; the empty `product` names the instance itself, and the address then holds none") state it.
// Run: node --test tests/release-itm-1284-issue-leads-open-own-use-cases.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: UC-033; UC-012
// Level: release
//
// Written for the release testing of sprint 115 by a participant who implemented none of ITM-1284 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The page is the whole main page: MOD-site-frame's startPage over the view of
// MOD-maintenance-pages, in the world of tests/maintenance-pages-world.mjs (the product alice/product with its issues, the participants' register of which none runs code and tests), started at an address the way a person arrives at
// it (tests/uc-039-world.mjs' openReplies). The case does not look at what the page handed to `go`: it clicks the lead and reads the address the browser was sent to, with the frame's own reading of an address (routeOf and
// productOf of src/site-frame/routing.mjs). Readings the texts leave open, which the cases state:
//   - "opens Agent M's own use case": the address read back names the route `use-case` with the use case's identifier and no product — the address of the instance itself — and that route is one the review pages serve.
//   - "on the instance's own page": the route `issue` shows the issues of a product; at the address of the instance, which names none, it asks for a product to be chosen and offers no lead, so that no lead can name a product there.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, byClass, issueRecord, one, restoreWorld, textOf, trusted, waitFor } from "./maintenance-pages-world.mjs";
import { lastly, openReplies } from "./uc-039-world.mjs";
import { routeOf, productOf } from "../src/site-frame/routing.mjs";
import { view as reviewPages } from "../src/review-pages/index.mjs";

afterEach(restoreWorld);

const ISSUES = [issueRecord(5, "open", []), issueRecord(6, "open", [], { labels: ["defect"] })];
const productFragment = (number) => `#issue/number=${number}/product=${encodeURIComponent(PRODUCT_URL)}`;
/** The address the browser was last sent to, as the frame wrote it; undefined while the page has sent it nowhere. */
const sentTo = () => globalThis.location.href;
const fragmentOf = (address) => String(address).split("#")[1] ?? "";

/** The issue page at `fragment`, waited for until `ready(main)` holds. */
async function issuePage(fragment, ready) {
  const p = await openReplies({ inbox: [], issues: ISSUES, fragment });
  await waitFor(() => ready(p.main()) || byClass(p.main(), "issue-problem").length > 0);
  return p;
}

// TST-1284301 · level: release · module: MOD-maintenance-pages
// guards: UC-033
// given: known positive first — the page at the address of the issue 5 of the product alice/product, which names the product, shows that issue of that product, not classified yet, with the lead "UC-012, step 2", and has sent the browser nowhere
// input: the person's click on the lead
// expect: the browser is sent to an address of the review pages whose route, read back by the frame, is use-case with the parameter id UC-012 and no other, and whose product is none — the instance itself; the route is one the review pages serve
// Planted fault: the lead's go without the empty product (`context.go("use-case", { id: "UC-012" })` in notClassified, src/maintenance-pages/issues.mjs) is given the chosen product by the frame, and the case fails on the product the address names.
test("TST-1284301 on a product's page, the lead of an issue not classified yet opens the instance's own UC-012", async () => {
  const p = await issuePage(productFragment(5), (main) => byClass(main, "uc-012").length > 0);
  await lastly(p, async () => {
    assert.match(textOf(p.main()), /Issue #5: Issue 5/, "known positive: the product's issue 5 is shown");
    assert.equal(productOf(globalThis.location.hash), PRODUCT_URL, "known positive: the page's address names the product");
    assert.equal(sentTo(), undefined, "known positive: the page has sent the browser nowhere");
    await trusted(one(p.main(), "uc-012"));
    const address = sentTo();
    assert.equal(typeof address, "string", "the click sent the browser to an address");
    assert.deepEqual(routeOf(fragmentOf(address)), { name: "use-case", params: { id: "UC-012" } }, address);
    assert.equal(productOf(fragmentOf(address)), null, address);
    assert.equal(reviewPages.routes.some((served) => served.name === "use-case"), true, "the review pages serve the route use-case");
  });
});

// TST-1284302 · level: release · module: MOD-maintenance-pages
// guards: UC-012
// given: known positive first — the page at the address of the issue 6 of the product alice/product, labelled defect, shows that issue of that product and, since no participant of the register runs code and tests, says so with the lead "UC-017"; the browser has been sent nowhere
// input: the person's click on the lead
// expect: the browser is sent to an address of the review pages whose route, read back by the frame, is use-case with the parameter id UC-017 and no other, and whose product is none — the instance itself; the route is one the review pages serve
// Planted fault: the lead's go without the empty product (`context.go("use-case", { id: "UC-017" })` in the fix section, src/maintenance-pages/issues.mjs) is given the chosen product by the frame, and the case fails on the product the address names.
test("TST-1284302 on a product's page, the lead of a bug without a participant that can fix it opens the instance's own UC-017", async () => {
  const p = await issuePage(productFragment(6), (main) => byClass(main, "uc-017").length > 0);
  await lastly(p, async () => {
    assert.match(textOf(p.main()), /Issue #6: Issue 6/, "known positive: the product's issue 6 is shown");
    assert.match(textOf(one(p.main(), "issue-no-fixer")), /No participant that can run code and tests/, "known positive: the page says no participant can fix it");
    assert.equal(productOf(globalThis.location.hash), PRODUCT_URL, "known positive: the page's address names the product");
    assert.equal(sentTo(), undefined, "known positive: the page has sent the browser nowhere");
    await trusted(one(p.main(), "uc-017"));
    const address = sentTo();
    assert.equal(typeof address, "string", "the click sent the browser to an address");
    assert.deepEqual(routeOf(fragmentOf(address)), { name: "use-case", params: { id: "UC-017" } }, address);
    assert.equal(productOf(fragmentOf(address)), null, address);
    assert.equal(reviewPages.routes.some((served) => served.name === "use-case"), true, "the review pages serve the route use-case");
  });
});

// TST-1284303 · level: release · module: MOD-maintenance-pages
// guards: UC-033; UC-012
// given: known positive first — the page of the issue 5 of the product alice/product offers the lead "UC-012, step 2"; the same world, started at the address of the instance itself, which names no product and the issue number 5, then the address of the issue 6 with none either
// input: the page drawn at each address of the instance
// expect: the page asks for a product to be chosen, shows no issue of the product, and offers neither the lead to UC-012 nor the lead to UC-017, so that no lead of the issue page can open a use case of a product from the instance's own page; the browser has been sent nowhere
// Counter-proof: no fault of the code can be planted for this case without changing what the route draws at the instance's address; its counter-proof is the known positive, the same world on the product's page, where the lead is offered.
test("TST-1284303 on the instance's own page, the issue page offers none of the leads, so none names a product", async () => {
  const known = await issuePage(productFragment(5), (main) => byClass(main, "uc-012").length > 0);
  await lastly(known, async () => { assert.equal(byClass(known.main(), "uc-012").length, 1, "known positive: on the product's page the lead is offered"); });
  restoreWorld();
  for (const number of [5, 6]) {
    const p = await openReplies({ inbox: [], issues: ISSUES, fragment: `#issue/number=${number}` });
    await waitFor(() => /Choose a product/.test(textOf(p.main())));
    await lastly(p, async () => {
      assert.equal(productOf(globalThis.location.hash), null, "the address names no product");
      assert.match(textOf(p.main()), /Choose a product to see its issues\./);
      assert.deepEqual([byClass(p.main(), "uc-012").length, byClass(p.main(), "uc-017").length], [0, 0], `no lead on the instance's page of the issue ${number}`);
      assert.equal(sentTo(), undefined);
    });
    restoreWorld();
  }
});
