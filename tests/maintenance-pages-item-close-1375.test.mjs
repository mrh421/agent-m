// The issue route's *Close with links* for the issue of an item (ITM-1375, UC-033 step 6), as the accepted text of docs/architecture/MOD-maintenance-pages.md states it: `issue/<number>` closes an issue "with links once its pull request is merged", with
// MOD-issue-handling's `closeWithLinks`, which is "run when the pull request of a bug fix or of an item from the issue is merged" (MOD-issue-handling.md). UC-033 step 6: "When a pull request for the item is merged (UC-034), the issue is closed with a link to
// the pull request and the item."
// Run: node --test tests/maintenance-pages-item-close-1375.test.mjs
//
// Module: MOD-maintenance-pages
// Guards: UC-033; ONE CLICK PER DECISION
// Level: unit
//
// The world is tests/uc-033-harness.mjs: the real route `issue` over a fake GitHub of alice/product whose backlog holds the items the cases add, whose job records the cases add, and whose pull requests the cases give by the branch named after a job.
// The readings, named in the pull request:
//   - The item of an issue is an item of the backlog that names the issue's address among its origins (UC-033 step 2, 4a); its pull request is that of the newest job of a kind that implements an item — `implement` or `refactor`
//     (AGILE IMPLEMENTATION STARTS FROM THE BACKLOG) — whose works_on names that item, the one of the branch named after the job (MOD-runtimes' jobTrail), as for a bug's fix.
//   - Close with links is offered for an issue of class bug or change, beside the move into the backlog, once that pull request is merged; the note names the pull request and the item. A bug's fix closes as before, with no item.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { ADDRESS, PRODUCT_URL, byClass, issueNow, itemPath, itemText, jobRecord, one, openIssue, pullOf, restoreWorld, startWorld, textOf, trusted, waitFor } from "./uc-033-harness.mjs";

afterEach(restoreWorld);

const ITEM_JOB = "JOB-20261101-0900-a1b2", FIX = "JOB-20261101-0905-c3d4", REFACTOR = "JOB-20261101-0910-e5f6", CLOSE = "JOB-20261101-0915-a7b8";
const NO_FACTS = async () => ({ pullRequest: null, commits: [], files: [], reviews: [], checks: [], read: async () => null });

/** The world: the product's extra files `files`, every pull request of a branch named after a job in the state `state`. */
const worldOf = (files, state = "merged") => startWorld({ pulls: (branch) => (/^JOB-/.test(branch ?? "") ? pullOf(branch, state) : null), facts: NO_FACTS, product: files });
const item = (id, title, issue) => ({ [itemPath(id, title)]: itemText({ id, title, origin: [ADDRESS(issue)] }) });
const job = (id, kind, worksOn) => ({ [`docs/jobs/${id}.md`]: jobRecord(id, kind, worksOn) });
/** Close with links pressed on the issue `number`'s page, and the issue waited for until it is closed. */
async function closeIssue(w, page, number) {
  await trusted(one(page, "close-with-links"));
  await waitFor(() => issueNow(w, number).state === "closed");
}

// TST-1375001 · level: unit · module: MOD-maintenance-pages
// guards: UC-033; ONE CLICK PER DECISION
// given: the open bug issues 6 and 9 of alice/product; issue 6 is the origin of the item ITM-901, whose job JOB-20261101-0900-a1b2 of kind implement has the merged pull request #9; known positive: issue 9 is fixed by the job JOB-20261101-0905-c3d4 of kind fix-bug, whose pull request #9 is merged
// input: the person opens issue 9 and presses Close with links, then opens issue 6 and presses Close with links
// expect: known positive — issue 9 offers one Close with links, and is closed with the one comment "Closed with https://github.com/alice/product/pull/9."; issue 6 offers one Close with links, and is closed with the one comment "Closed with https://github.com/alice/product/pull/9; item `ITM-901`."
test("TST-1375001: UC-033 the merged pull request of an item's job closes the item's issue, naming the pull request and the item", async () => {
  const w = worldOf({ ...item("ITM-901", "Export drops the last page", 6), ...job(ITEM_JOB, "implement", "ITM-901"), ...job(FIX, "fix-bug", ADDRESS(9)) });
  const nine = await openIssue(w, 9);
  assert.equal(byClass(nine, "close-with-links").length, 1, "known positive: the fix of a bug offers the close");
  await closeIssue(w, nine, 9);
  assert.deepEqual(issueNow(w, 9).comments, [`Closed with ${PRODUCT_URL}/pull/9.`], "known positive: a bug fix closes with no item");

  const six = await openIssue(w, 6);
  assert.equal(byClass(six, "close-with-links").length, 1, "the item's merged pull request offers the close");
  await closeIssue(w, six, 6);
  assert.deepEqual(issueNow(w, 6).comments, [`Closed with ${PRODUCT_URL}/pull/9; item \`ITM-901\`.`]);
});

// TST-1375002 · level: unit · module: MOD-maintenance-pages
// guards: UC-033
// given: the open issue 7 of alice/product, of class change; it is the origin of the item ITM-902, whose job JOB-20261101-0910-e5f6 of kind refactor has the merged pull request #9
// input: the person opens issue 7 and presses Close with links
// expect: issue 7 offers one Close with links, and is closed with the one comment "Closed with https://github.com/alice/product/pull/9; item `ITM-902`."
test("TST-1375002: UC-033 the issue of a change is closed by its item's merged pull request too, a refactoring's included", async () => {
  const w = worldOf({ ...item("ITM-902", "Export keeps all pages", 7), ...job(REFACTOR, "refactor", "ITM-902") });
  const seven = await openIssue(w, 7);
  assert.equal(byClass(seven, "close-with-links").length, 1, "the item's merged pull request offers the close on a change");
  await closeIssue(w, seven, 7);
  assert.deepEqual(issueNow(w, 7).comments, [`Closed with ${PRODUCT_URL}/pull/9; item \`ITM-902\`.`]);
});

// TST-1375003 · level: unit · module: MOD-maintenance-pages
// guards: UC-033
// given: known positive first — the world of TST-1375001's issue 6; then the same item whose job's pull request #9 is open; a job of kind close-sprint working on the item, whose pull request #9 is merged; and the item's merged job while the item names issue 7, not 6
// input: the person opens issue 6 in each world
// expect: known positive — one Close with links; with the pull request open, none, and the page says "pull request #9 is open."; for the job of kind close-sprint, none; for the item that names another issue, none; the issue stays open with no comment in each
test("TST-1375003: UC-033 no close is offered before the item's pull request is merged, for a job that implements no item, or for an item of another issue", async () => {
  const known = worldOf({ ...item("ITM-901", "Export drops the last page", 6), ...job(ITEM_JOB, "implement", "ITM-901") });
  assert.equal(byClass(await openIssue(known, 6), "close-with-links").length, 1, "known positive");
  restoreWorld();

  const cases = [
    ["the pull request is open", () => worldOf({ ...item("ITM-901", "Export drops the last page", 6), ...job(ITEM_JOB, "implement", "ITM-901") }, "open"), (page) => assert.match(textOf(page), /pull request #9 is open\./)],
    ["a job of kind close-sprint", () => worldOf({ ...item("ITM-901", "Export drops the last page", 6), ...job(CLOSE, "close-sprint", "ITM-901") }), () => {}],
    ["the item names another issue", () => worldOf({ ...item("ITM-901", "Export drops the last page", 7), ...job(ITEM_JOB, "implement", "ITM-901") }), () => {}],
  ];
  for (const [name, worldNow, more] of cases) {
    const w = worldNow();
    const six = await openIssue(w, 6);
    assert.equal(byClass(six, "close-with-links").length, 0, name);
    more(six);
    assert.equal(issueNow(w, 6).state, "open", name);
    assert.deepEqual(issueNow(w, 6).comments, [], name);
    restoreWorld();
  }
});
