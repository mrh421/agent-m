// The issue page's leads open Agent M's own use cases (ITM-1284) — MOD-maintenance-pages' route `issue/<number>`, drawn on a product's page by MOD-site-frame's startPage, whose ViewContext's `go` "writes the chosen
// product into the address unless `params` names a `product`; the empty `product` names the instance itself, and the address then holds none" (docs/architecture/MOD-site-frame.md, ViewContext). UC-033 1a: "Agent M links
// to UC-012, step 2"; UC-012 5b: "Agent M says so and links to UC-017". Both use cases are Agent M's own, so each lead's address names the instance, not the product whose issue is shown.
// Run: node --test tests/maintenance-pages-leads-1284.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: UC-033; UC-012
// Level: component
//
// The page is started by MOD-site-frame's startPage on the main page over the view of MOD-maintenance-pages (tests/uc-039-world.mjs' openReplies), at the fragment of the route `issue` of the product alice/product, in the
// world of tests/maintenance-pages-world.mjs: its register lists the model endpoints local-llm and cloud-llm and the checker, none of which runs code and tests. The use case is a route of the review page, so the frame's `go`
// on the main page writes the review page's address (`location.href`); the fragment is what stands after its "#". Each test states its input and its expected result before it runs (given / input / expect).

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, byClass, issueRecord, one, restoreWorld, textOf, trusted, waitFor } from "./maintenance-pages-world.mjs";
import { lastly, openReplies } from "./uc-039-world.mjs";

afterEach(restoreWorld);

const ISSUES = [issueRecord(5, "open", []), issueRecord(6, "open", [], { labels: ["defect"] })];
const issueFragment = (number) => `#issue/number=${number}/product=${encodeURIComponent(PRODUCT_URL)}`;
// The fragment of the address the page was sent to: what stands after the "#" of `location.href`.
const fragmentSent = () => String(globalThis.location.href ?? "").split("#")[1] ?? null;

/** The issue page of `number` on the product's page, waited for until `ready(main)` holds. */
async function issuePage(number, ready) {
  const p = await openReplies({ inbox: [], issues: ISSUES, fragment: issueFragment(number) });
  await waitFor(() => ready(p.main()) || byClass(p.main(), "issue-problem").length > 0);
  return p;
}

// TST-1284001 · level: component · module: MOD-maintenance-pages
// guards: UC-033; UC-012
// given: known positive first — the page of the issue 5 of the product alice/product, not classified yet, shows that issue of that product and the lead "UC-012, step 2"
// input: the person's click on the lead
// expect: the page is sent to the fragment use-case/id=UC-012, which names the use case and no product, so that the frame shows the instance's UC-012; the fragment holds no product=
test("issue — the lead of an issue not classified yet opens Agent M's own UC-012, not the product's (UC-033 1a)", async () => {
  const p = await issuePage(5, (main) => byClass(main, "uc-012").length > 0);
  await lastly(p, async () => {
    assert.match(textOf(p.main()), /Issue #5: Issue 5/, "known positive: the product's issue 5 is shown");
    const lead = one(p.main(), "uc-012");
    assert.equal(textOf(lead), "UC-012, step 2");
    await trusted(lead);
    assert.equal(fragmentSent(), "use-case/id=UC-012", String(globalThis.location.href));
    assert.doesNotMatch(String(globalThis.location.href), /product=/);
  });
});

// TST-1284002 · level: component · module: MOD-maintenance-pages
// guards: UC-012
// given: known positive first — the page of the issue 6 of the product alice/product, labelled defect, shows that issue of that product and, since no participant of the register runs code and tests, the lead "UC-017"
// input: the person's click on the lead
// expect: the page is sent to the fragment use-case/id=UC-017, which names the use case and no product, so that the frame shows the instance's UC-017; the fragment holds no product=
test("issue — the lead of a bug without a participant that can fix it opens Agent M's own UC-017, not the product's (UC-012 5b)", async () => {
  const p = await issuePage(6, (main) => byClass(main, "uc-017").length > 0);
  await lastly(p, async () => {
    assert.match(textOf(p.main()), /Issue #6: Issue 6/, "known positive: the product's issue 6 is shown");
    const lead = one(p.main(), "uc-017");
    assert.equal(textOf(lead), "UC-017");
    await trusted(lead);
    assert.equal(fragmentSent(), "use-case/id=UC-017", String(globalThis.location.href));
    assert.doesNotMatch(String(globalThis.location.href), /product=/);
  });
});
