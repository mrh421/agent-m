// What MOD-maintenance-pages' routes `issues`, `issue/<number>` and `replies/<issue>` read of a product's issues (ITM-1270), as the accepted text of docs/architecture/MOD-maintenance-pages.md states it (:128-130): "The list reads the open
// issues without their comments (`listIssues` with `comments: false`); `issue/<number>` and `replies/<issue>` read their one issue with `readIssue`." And MOD-repository-hosts.md (:271-276): with `comments: false` "no comment is asked
// for"; `readIssue` reads "one issue with its comments, in one request and one per page of its comments".
// Run: node --test tests/maintenance-pages-issues-reads.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: UC-012; UC-039
// Level: component
//
// The world is tests/maintenance-pages-world.mjs: its fake GitHub holds the issues of alice/product and keeps every request under /repos/alice/product/issues (`kept.github`, method and path), answering the issue list (GET …/issues, one page),
// one issue (GET …/issues/<n>) and its comments (GET …/issues/<n>/comments). The page, MOD-repository-hosts and MOD-mail-handling are the real ones.
// Readings the texts leave open, which the tests state (the pull request names them):
//   - "A listing" is a request for the issue list, GET /repos/alice/product/issues; "a comment request" one for an issue's comments, GET …/issues/<n>/comments.
//   - The route replies/<issue> draws its issue from the last reading, which the person's click on Read replies makes with MOD-mail-handling's repliesDue — a caller of listIssues that this item leaves unchanged —; what the route reads
//     itself is counted after that reading.
// Each test states its input and its expected result before it runs. The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";
import { PRODUCT, PRODUCT_URL, byClass, opened, read, restoreWorld, start, waitFor, world } from "./maintenance-pages-world.mjs";

afterEach(restoreWorld);

const PRODUCT_TOKEN = "github_pat_HOME827PRODUCT0123456789abcdefg";
const ISSUES = Array.from({ length: 40 }, (_, i) => ({ number: i + 1, title: `Issue ${i + 1}`, body: `Text of issue ${i + 1}.`, state: "open", labels: [], comments: i < 30 ? [`A comment on ${i + 1}.`] : [] }));
const BASE = `/repos/${PRODUCT}/issues`;
const gets = (w) => w.kept.github.filter((request) => request.method === "GET").map((request) => request.path);
const listings = (paths) => paths.filter((path) => path === BASE);
const commentRequests = (paths) => paths.filter((path) => /\/issues\/\d+\/comments$/.test(path));

function product(over = {}) {
  const w = world({ mails: [], issues: ISSUES, ...over });
  w.context.product = { address: PRODUCT_URL, kind: "github", host: connect(parseAddress(PRODUCT_URL), { token: PRODUCT_TOKEN }), tokenStored: true };
  return w;
}

// TST-1270004 · level: component · module: MOD-maintenance-pages
// guards: UC-012
// given: the product alice/product with 40 open issues, of which the issues 1 to 30 have one comment each
// input: the route issues is drawn
// expect: all 40 issues are listed; GitHub received one request for the issue list and no request for the comments of any issue
test("issues — lists the open issues with one page of the issue list and no comment request", async () => {
  const w = product();
  const target = await opened(w, {}, "issues");
  await waitFor(() => byClass(target, "issue").length > 0 || byClass(target, "issues-problem").length > 0);
  assert.equal(byClass(target, "issue").length, 40);
  assert.deepEqual(listings(gets(w)), [BASE]);
  assert.deepEqual(commentRequests(gets(w)), []);
});

// TST-1270005 · level: component · module: MOD-maintenance-pages
// guards: UC-012
// given: the same product; the issue 7 is open and has one comment
// input: the route issue with number 7 is drawn
// expect: the page shows issue 7 with its text; GitHub received no request for the issue list, one for the issue 7 and one for its comments, and no request for any other issue
test("issue — reads its one issue and that issue's comments, and asks for no listing", async () => {
  const w = product();
  const detail = await opened(w, { number: "7" }, "issue");
  await waitFor(() => byClass(detail, "issue-text").length > 0 || byClass(detail, "issue-problem").length > 0);
  assert.equal(byClass(detail, "issue-text")[0]?.textContent, "Text of issue 7.");
  const paths = gets(w);
  assert.deepEqual(listings(paths), []);
  assert.deepEqual(paths.filter((path) => path.startsWith(`${BASE}/`)), [`${BASE}/7`, `${BASE}/7/comments`]);
});

// TST-1270006 · level: component · module: MOD-maintenance-pages
// guards: UC-039
// given: the world's standard replies: the issue 5, labelled waiting-for-reporter with a newer mail and two comments, under answer received; the replies read by the person's click on Read replies
// input: the route replies with the issue 5 of the product is drawn after that reading
// expect: the issue's mails are drawn; what the route asked GitHub for after the reading is no request for the issue list, one for the issue 5 and one for its comments
test("replies/<issue> — reads its one issue and that issue's comments, and asks for no listing", async () => {
  const { w, target } = await start();
  await read(target);
  const before = w.kept.github.length;
  const detail = await opened(w, { issue: "5", product: PRODUCT_URL });
  await waitFor(() => byClass(detail, "reply-mail").length > 0 || byClass(detail, "reply-problem").length > 0);
  assert.equal(byClass(detail, "reply-mail").length, 1);
  const paths = w.kept.github.slice(before).filter((request) => request.method === "GET").map((request) => request.path);
  assert.deepEqual(listings(paths), []);
  assert.deepEqual(paths, [`${BASE}/5`, `${BASE}/5/comments`]);
});
