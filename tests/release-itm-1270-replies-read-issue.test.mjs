// Release tests of ITM-1270, narrowed to the replies page — UC-039 steps 2 and 3 on `replies/<issue>`: after the person has read the replies, the page of one issue reads that issue by its number with its comments, and no listing of issues, to tell which of its
// mails are new and which arrived after it was closed. The behaviour is docs/architecture/MOD-maintenance-pages.md's ("`issue/<number>` and `replies/<issue>` read their one issue with `readIssue`.") and docs/architecture/MOD-repository-hosts.md's (`readIssue`: "one
// issue with its comments, in one request and one per page of its comments").
// Run: node --test tests/release-itm-1270-replies-read-issue.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: UC-039; EVOLUTION ENTERS THROUGH THE SPECIFICATION
// Level: release
//
// Written for the release testing of sprint 114 by a participant who implemented none of ITM-1270 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the one of the maintenance pages' tests (tests/maintenance-pages-world.mjs: the fake GitHub of alice/product with its
// issues and comments, the fake Bridge of the mailbox), over the real route `replies`, the real MOD-repository-hosts and MOD-mail-handling. The implementers' case (tests/maintenance-pages-issues-reads.test.mjs) opens the issue 5; these cases open each of the issues the
// standard reading lists, in each group, and an issue GitHub no longer has. The issues of the page on GitLab are in tests/release-itm-1270-issue-reads.test.mjs for `issue`; the replies page reads its issues through the product's host whichever the server, and the world's fake serves GitHub only.
// Readings the texts leave open, taken here:
//   - "after the person has read the replies" is the person's click on Read replies, which MOD-mail-handling's `repliesDue` answers by listing the issues of the products (a caller of `listIssues` this item leaves as it is). What the route asks of GitHub after that click is counted.
//   - an issue GitHub answers "Not Found" for, after the reading, is read by the page as an issue with no note: its mails are drawn and none is marked new or arrived, which is what a missing issue gave before the change (the page's own `catch` of its reading).

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT, PRODUCT_URL, byClass, opened, read, restoreWorld, start, waitFor } from "./maintenance-pages-world.mjs";

afterEach(restoreWorld);

const BASE = `/repos/${PRODUCT}/issues`;
const gets = (w, from) => w.kept.github.slice(from).filter((request) => request.method === "GET").map((request) => request.path);
const listings = (paths) => paths.filter((path) => path === BASE);

// The page of one issue after the replies were read: what GitHub was asked for from then on, and the page.
async function pageOf(w, target, number) {
  await read(target);
  const from = w.kept.github.length;
  const detail = await opened(w, { issue: String(number), product: PRODUCT_URL });
  await waitFor(() => byClass(detail, "reply-mail").length > 0 || byClass(detail, "reply-problem").length > 0);
  return { detail, paths: gets(w, from) };
}

// TST-1270305 · level: release · module: MOD-maintenance-pages
// guards: UC-039
// given: the standard world: the closed issue 4 (one comment), the open issue 5 labelled waiting-for-reporter (two comments, the last noting a new mail), the open issue 6 (no comment) and the closed issue 7 (one comment, a reply noted); the replies read by the person's click on Read replies
// input: the route replies drawn for the issue 4, for the issue 5 and for the issue 6, each in a world of its own
// expect: for each the page draws the issue's mails; what GitHub was asked for after the reading is no request for the issue list: for the issue 4 the issue and its comments, for the issue 5 the issue and its comments, for the issue 6 the issue alone and no request for comments, which it has none of; the issue 5 shows its mail as new
// Planted fault: a route that finds its issue in a listing (`host.listIssues({ state: "all" })` and a filter in arrivalsOf of src/maintenance-pages/replies.mjs) sends the issue list and the comments of the issues 4, 5 and 7 and fails the lists; a route that reads the comments of an issue with none sends a request for the issue 6; one that reads the comments but not the issue 5 shows no mail as new.
test("TST-1270305 replies/<issue> reads its issue by its number with its comments after the replies were read, and asks for no listing", async () => {
  for (const [number, expected, fresh] of [[4, [`${BASE}/4`, `${BASE}/4/comments`], 0], [5, [`${BASE}/5`, `${BASE}/5/comments`], 1], [6, [`${BASE}/6`], 0]]) {
    const { w, target } = await start();
    const { detail, paths } = await pageOf(w, target, number);
    assert.ok(byClass(detail, "reply-mail").length > 0, `the issue ${number} draws its mails`);
    assert.deepEqual(listings(paths), [], `the issue ${number}: no listing`);
    assert.deepEqual(paths, expected, `the issue ${number}`);
    assert.equal(byClass(detail, "reply-new").length, fresh, `the issue ${number}: mails new after the question`);
    restoreWorld();
  }
});

// TST-1270306 · level: release · module: MOD-maintenance-pages
// guards: UC-039
// given: the standard world, the replies read, and then the issue 5 gone from GitHub: the server answers "Not Found" for it
// input: the route replies drawn for the issue 5
// expect: the page draws the issue's mail and no mail marked new; it does not fail with a problem line; GitHub was asked for the issue 5 once and for no listing and no comments
// Planted fault: a route that lets the failure of its reading through (the `.catch(() => ({ fresh: …, arrived: … }))` of issueOf in src/maintenance-pages/replies.mjs left out) shows a problem or nothing and no mail; a route that takes the missing issue's mails as new, or asks for the listing again, fails the last assertions.
test("TST-1270306 replies/<issue> still draws the mails of an issue the server no longer has, with none marked new", async () => {
  const { w, target } = await start();
  await read(target);
  w.kept.issues = w.kept.issues.filter((issue) => issue.number !== 5);
  const from = w.kept.github.length;
  const detail = await opened(w, { issue: "5", product: PRODUCT_URL });
  await waitFor(() => byClass(detail, "reply-mail").length > 0 || byClass(detail, "reply-problem").length > 0);
  assert.equal(byClass(detail, "reply-mail").length, 1);
  assert.equal(byClass(detail, "reply-problem").length, 0);
  assert.equal(byClass(detail, "reply-new").length, 0);
  assert.deepEqual(gets(w, from), [`${BASE}/5`]);
});
