// Release tests of ITM-1111 — on the replies page, the control that opens an issue goes there through the frame, and the page writes no address of its own. The behaviour is UC-039 (docs/use-cases/UC-039-close-or-defer-an-issue-and-reply.md, step 1: the author opens the replies
// and sees the issues grouped; step 2: opens one) as docs/architecture/MOD-maintenance-pages.md (the route `replies`, `replies/<issue>`) and docs/architecture/MOD-site-frame.md (`ViewContext.go(route, params)`: the frame turns it into the address) state it, and as ITM-1111 reads them
// (docs/backlog/ITM-1111-a-page-writes-a-route-s-address-through-the-frame.md: "The replies page's control *Open* calls `go("replies", { issue, product })` and carries no address of its own").
// Run: node --test tests/release-itm-1111-replies-open-through-the-frame.test.mjs
//
// Module: MOD-maintenance-pages; MOD-site-frame
// Guards: UC-039; THE SITE SERVES A SCREEN READER
// Level: release
//
// Written for the release testing of sprint 124 by a participant who implemented none of ITM-1111 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The page is started as a person starts it: MOD-site-frame's `startPage` on the main page over the view of MOD-maintenance-pages, at the route
// replies, in the browser, the repositories and the clock of tests/maintenance-pages-world.mjs and over the mailbox on the Microsoft route of tests/uc-039-world.mjs (the world of the system tests of UC-039). The component test of the item (tests/maintenance-pages-replies.test.mjs) hands the
// route a context of its own and reads the calls of `go`; these cases use the frame's own `go`, so that the address is the one the frame writes and the page shown is the one the frame draws for it. The click is the fixture's dispatched click with the browser's trusted flag set (`trusted`);
// no keyboard, mouse or wheel event reaches a browser. Readings the texts leave open, which the cases state:
//   - the address the frame writes for `go("replies", { issue, product })` is `#replies/issue=<number>/product=<the product's address, percent-encoded>`, as ITM-1108 and the item write it; the case spells it out and does not ask the frame's `fragmentOf` for it.
//   - "the page writes no address": no element of the page holds an `href` that begins `#replies`, and no *Open* is a link.
//   - that the page asks the frame for the address, rather than writing it to the location itself, shows in no behaviour: the same fragment results. A page that sets `location.hash` by hand in the click is not told from one that calls `go` by these cases; TST-1111001 of
//     tests/maintenance-pages-replies.test.mjs reads the page's source for it.
//   - a hash change is the browser's: the fixture's window announces it (`hashchange`) after the page has set the fragment, as a browser does.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_URL, byClass, issueRecord, mailOf, one, restoreWorld, textOf, trusted, waitFor, walk } from "./maintenance-pages-world.mjs";
import { hashTo, lastly, openReplies, rawMail, readReplies } from "./uc-039-world.mjs";

afterEach(restoreWorld);

const [M1, M3, M4] = [await mailOf("m1"), await mailOf("m3"), await mailOf("m4")];
const CLOSED_WITH = "Closed with pull request https://github.com/alice/product/pull/9.";
const ADDRESS = (issue) => `#replies/issue=${issue}/product=${encodeURIComponent(PRODUCT_URL)}`;
// The issue 4 closed with a mail to answer, the issues 6 and 8 open, each with a mail.
const issues = () => [issueRecord(4, "closed", [M1], { comments: [CLOSED_WITH] }), issueRecord(6, "open", [M3]), issueRecord(8, "open", [M4])];
const world = () => openReplies({ inbox: [rawMail("m1"), rawMail("m3"), rawMail("m4")], issues: issues() });
const opens = (root) => walk(root, (node) => (node.className ?? "").split(" ").includes("issue-link"));
const openOf = (root, issue) => walk(root, (node) => (node.getAttribute?.("data-issue") ?? null) === String(issue) && (node.className ?? "").includes("reply-issue")).flatMap((item) => opens(item))[0];
const addressesIn = (root) => walk(root, (node) => /^#replies/.test(String(node.getAttribute?.("href") ?? "")));
const issuePage = (p, issue) => waitFor(() => new RegExp(`Issue #${issue} of alice/product`).test(textOf(p.main())) || byClass(p.main(), "reply-problem").length > 0);

// TST-1111301 · level: release · module: MOD-maintenance-pages
// guards: UC-039; THE SITE SERVES A SCREEN READER
// given: the page started at the route replies over the Microsoft route; the closed issue 4 and the open issues 6 and 8 of alice/product (the last two in one group), each with a mail the mailbox holds; the person has pressed Read replies; known positive first — the fragment #replies/issue=4/product=<encoded address> shown by the frame draws the issue 4
// input: the person presses the Open of the issue 4; the browser announces the change of the fragment; then back to #replies, Read replies again, and the Open of the issue 6, and again of the issue 8
// expect: after the first Open the page's fragment is #replies/issue=4/product=https%3A%2F%2Fgithub.com%2Falice%2Fproduct and, once announced, the page shows "Issue #4 of alice/product" with what solved it; after the second the fragment names the issue 6 and the page shows "Issue #6 of alice/product", after the third the issue 8 and "Issue #8 of alice/product"; no Open wrote to the issues or the mailbox
// Planted fault: Open drawn as a link with the address written by hand (`<a href="#replies/issue=…">` in place of the button in groupsOf of src/maintenance-pages/replies.mjs, as before ITM-1111) has no click that goes anywhere through the frame, and the case fails on the page's fragment.
// Planted fault: Open calling go without the product (`go("replies", { issue: String(each.issue) })` in groupsOf) writes an address without product and the case fails on the fragment.
// Planted fault: Open of every issue going to the first issue of its group (`each.issue` replaced by `ctx.due[field][0].issue` in the click of groupsOf) shows the issue 6 for the issue 8 and the case fails on the third page.
test("TST-1111301 the Open of an issue sets the address the frame writes for it, and the frame shows that issue", async () => {
  const p = await world();
  await lastly(p, async () => {
    await readReplies(p);
    await hashTo(ADDRESS(4));
    await issuePage(p, 4);
    assert.match(textOf(p.main()), /Issue #4 of alice\/product/, "known positive: the frame draws the issue for the address");
    await hashTo("#replies");
    await readReplies(p);
    const before = [p.w.kept.github.filter((request) => request.method !== "GET").length, p.graph.requests.filter((request) => request.method !== "GET").length];
    await trusted(openOf(p.main(), 4));
    assert.equal(globalThis.location.hash, ADDRESS(4));
    await hashTo(globalThis.location.hash);
    await issuePage(p, 4);
    assert.match(textOf(p.main()), /Issue #4 of alice\/product/);
    assert.match(textOf(one(p.main(), "reply-solved")), /pull\/9/, "what solved the issue");
    await hashTo("#replies");
    await readReplies(p);
    await trusted(openOf(p.main(), 6));
    assert.equal(globalThis.location.hash, ADDRESS(6));
    await hashTo(globalThis.location.hash);
    await issuePage(p, 6);
    assert.match(textOf(p.main()), /Issue #6 of alice\/product/);
    await hashTo("#replies");
    await readReplies(p);
    await trusted(openOf(p.main(), 8));
    assert.equal(globalThis.location.hash, ADDRESS(8));
    await hashTo(globalThis.location.hash);
    await issuePage(p, 8);
    assert.match(textOf(p.main()), /Issue #8 of alice\/product/);
    assert.deepEqual([p.w.kept.github.filter((request) => request.method !== "GET").length, p.graph.requests.filter((request) => request.method !== "GET").length], before, "opening an issue writes nothing");
  });
});

// TST-1111302 · level: release · module: MOD-maintenance-pages
// guards: UC-039; THE SITE SERVES A SCREEN READER
// given: the page of TST-1111301 after Read replies, listing the issues 4, 6 and 8; and the page of the issue 4 after the frame has drawn it
// input: every element of both pages is searched for an address that begins #replies, and every Open for its element and its name
// expect: no element of either page holds such an href; there is one Open for each listed issue, each a <button> of type button, not a link, with the text Open as its name; known positive: the search finds the fragment the frame holds after the Open is pressed
// Planted fault: Open drawn as a link with the address written by hand (`<a href="#replies/issue=…">`, as before ITM-1111) fails the case on the addresses found and on the element of the Open.
test("TST-1111302 the replies page holds no address of its own: each Open is a button the frame turns into the address", async () => {
  const p = await world();
  await lastly(p, async () => {
    await readReplies(p);
    const controls = opens(p.main());
    assert.equal(controls.length, 3, "one Open for each listed issue");
    assert.deepEqual(controls.map((node) => [node.localName, node.getAttribute("type"), textOf(node).trim()]), [["button", "button", "Open"], ["button", "button", "Open"], ["button", "button", "Open"]]);
    assert.deepEqual(addressesIn(p.main()), [], "the groups hold no address");
    await trusted(openOf(p.main(), 4));
    assert.equal(globalThis.location.hash, ADDRESS(4), "known positive: the address is written, by the frame");
    await hashTo(globalThis.location.hash);
    await issuePage(p, 4);
    assert.deepEqual(addressesIn(p.main()), [], "the issue's page holds no address");
  });
});

// TST-1111303 · level: release · module: MOD-maintenance-pages
// guards: UC-039
// given: a first session in which the person pressed the Open of the issue 4 and the frame wrote an address; a second session of the page, at the route replies, in which the person has pressed Read replies
// input: the address the first session's Open wrote, opened in the second session as a bookmark or a followed link is (the fragment set, the change announced)
// expect: the second session shows "Issue #4 of alice/product" with what solved it; so the address the Open writes is one the frame reads back to the same issue and product
// Planted fault: Open going to a route other than replies (`go("replies", …)` taken as `go("issue", …)` in groupsOf of src/maintenance-pages/replies.mjs) writes an address the second session does not read as the issue's replies, and the case fails on the first fragment.
test("TST-1111303 the address an Open writes opens the same issue in another session", async () => {
  const first = await world();
  let address;
  await lastly(first, async () => {
    await readReplies(first);
    await trusted(openOf(first.main(), 4));
    address = globalThis.location.hash;
    assert.equal(address, ADDRESS(4));
  });
  restoreWorld();
  const second = await world();
  await lastly(second, async () => {
    await readReplies(second);
    await hashTo(address);
    await issuePage(second, 4);
    assert.match(textOf(second.main()), /Issue #4 of alice\/product/);
    assert.match(textOf(one(second.main(), "reply-solved")), /pull\/9/);
  });
});
