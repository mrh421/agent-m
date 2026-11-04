// MOD-workflow-entries' entry onPullRequestClosed for the pull request of an item's job (ITM-1375, UC-033 step 6), as the accepted text of docs/architecture/MOD-workflow-entries.md states it: "`onPullRequestClosed` — run by the job workflow when
// a pull request of a product is merged or closed: on a merge, the issues it names closed with links"; and MOD-issue-handling.md: `closeWithLinks` is "run when the pull request of a bug fix or of an item from the issue is merged". UC-033 step 6:
// "When a pull request for the item is merged (UC-034), the issue is closed with a link to the pull request and the item."
// Run: node --test tests/workflow-entries-item-pull-request-closed.test.mjs
//
// Module: MOD-workflow-entries
// Guards: UC-033; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// Level: unit
//
// Deterministic, no network. The world is tests/workflow-entries-pull-request-world.mjs: the job workflow's checkout of the product holds the records of the jobs and the items of its backlog, the instance beside it; the pull request #7 and the
// issues come from its fake of GitHub's REST API. The readings, named in the pull request:
//   - The issues the pull request of an item's job names are those each item its job works on names among its origins (UC-033 step 2, 4a), below the product's own address; the job is the one its title or description names, as for a bug fix.
//     A job implements an item when its kind is `implement` or `refactor` (AGILE IMPLEMENTATION STARTS FROM THE BACKLOG); the items are read at the commit the checkout holds, where the job's record is read.
//   - Each issue is closed with MOD-issue-handling's closeWithLinks, its note naming the pull request and the item: "Closed with <the pull request's address>; item `<item>`.". A bug fix's issues are closed as before, with no item.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { startRecord } from "../src/job-ledger/index.mjs";
import { TOKEN, fakeGitHub as fake, onPullRequestClosed, withCheckout as checkout } from "./workflow-entries-pull-request-world.mjs";

// ---------------------------------------------------------------- the fixtures

const FIX = "JOB-20261101-0900-a1b2", ITEM_JOB = "JOB-20261101-0901-b2c3", REFACTOR = "JOB-20261101-0902-c3d4", OTHER = "JOB-20261101-0903-d4e5", MISSING = "JOB-20261101-0904-e5f6", CLOSE = "JOB-20261101-0905-f6a7";
const WEB = "https://github.com/alice/thesis-tool";

const record = (id, kind, worksOn) => startRecord({ id, kind, worksOn, participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-11-01T08:00:00Z"),
  agentM: { version: "unreleased", commit: "f".repeat(40) }, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: [] }], params: {} });
const lines = (...rows) => `${rows.join("\n")}\n`;
/** An item of the backlog, `docs/backlog/<id>-<slug>.md`, whose origins are `origin`. */
const item = (id, slug, origin) => ({ path: `docs/backlog/${id}-${slug}.md`, text: lines("---", `id: ${id}`, `title: ${slug}`, "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-store", "tests:", "  - unit", "origin:",
  ...origin.map((one) => `  - ${one}`), "---", `# ${id} ${slug}`, "", "## Outcome", "", "The export keeps its pages.", "", "## Acceptance", "", "- A unit test passes.") });
// The product: a bug fix working on the issue 12; the job of ITM-001, whose origins are the issues 14 and 15 of this product and an issue of another product; a refactoring of ITM-002, whose origin is the issue 16;
// the job of ITM-003, whose origin is an issue of another product alone; a job of ITM-404, which has no file; a sprint's close working on ITM-001.
const FILES = [record(FIX, "fix-bug", [`${WEB}/issues/12`]), record(ITEM_JOB, "implement", ["ITM-001"]), record(REFACTOR, "refactor", ["ITM-002"]), record(OTHER, "implement", ["ITM-003"]), record(MISSING, "implement", ["ITM-404"]),
  record(CLOSE, "close-sprint", ["ITM-001"]), item("ITM-001", "export-keeps-pages", [`${WEB}/issues/14`, `${WEB}/issues/15`, "https://github.com/other/tool/issues/3"]), item("ITM-002", "export-is-tidy", [`${WEB}/issues/16`]),
  item("ITM-003", "other-export", ["https://github.com/other/tool/issues/4"])];
const withCheckout = (body) => checkout(FILES, body);
/** The fake server of the merged pull request #7, which names the job `id` of kind `kind`. */
const fakeGitHub = (id, kind, given = {}) => fake({ title: `${id}: ${kind}`, body: `Job: ${id}\nKind: ${kind}`, branch: id, ...given });

// ---------------------------------------------------------------- the tests

// TST-1375101 · level: unit · module: MOD-workflow-entries
// guards: UC-033; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET
// given: the merged pull request #7 whose title and description name the job JOB-20261101-0901-b2c3 of kind implement, which works on ITM-001, whose origins are the issues 14 and 15 of this product and the issue 3 of other/tool; the person's token; known positive: the merged pull request #7 of the fix JOB-20261101-0900-a1b2, working on the issue 12
// input: onPullRequestClosed on the event pull_request, action closed, for the fix, and then for the item's job
// expect: known positive — the fix ends `done` and writes the comment "Closed with https://github.com/alice/thesis-tool/pull/7." on 12 and closes it; the item's job ends `done`, its summary naming #14 and #15 with ITM-001, and writes four times with the person's token, in this order: the comment "Closed with https://github.com/alice/thesis-tool/pull/7; item `ITM-001`." on 14 and 14 closed, the same for 15; nothing for the other product's issue 3
test("TST-1375101: onPullRequestClosed — the merged pull request of an item's job closes the issues the item names, each naming the pull request and the item", async () => {
  await withCheckout(async (w) => {
    const fix = fakeGitHub(FIX, "fix-bug");
    assert.equal((await onPullRequestClosed(w, fix)).outcome, "done", "known positive");
    assert.deepEqual(fix.writes(), [["POST", "/issues/12/comments", { body: `Closed with ${WEB}/pull/7.` }], ["PATCH", "/issues/12", { state: "closed" }]], "known positive: a bug fix closes with no item");

    const server = fakeGitHub(ITEM_JOB, "implement");
    const status = await onPullRequestClosed(w, server);
    assert.equal(status.outcome, "done", status.summary);
    assert.match(status.summary, /#14 \(ITM-001\)/);
    assert.match(status.summary, /#15 \(ITM-001\)/);
    const note = `Closed with ${WEB}/pull/7; item \`ITM-001\`.`;
    assert.deepEqual(server.writes(), [["POST", "/issues/14/comments", { body: note }], ["PATCH", "/issues/14", { state: "closed" }], ["POST", "/issues/15/comments", { body: note }], ["PATCH", "/issues/15", { state: "closed" }]]);
    for (const each of server.requests) assert.equal(each.authorization, `Bearer ${TOKEN}`, `${each.method} ${each.path} carried the person's token`);
  });
});

// TST-1375102 · level: unit · module: MOD-workflow-entries
// guards: UC-033
// given: the merged pull request #7 of the job JOB-20261101-0902-c3d4 of kind refactor, which works on ITM-002, whose origin is the issue 16 of this product
// input: onPullRequestClosed on the event pull_request, action closed
// expect: outcome `done`; the server is written to twice: the comment "Closed with https://github.com/alice/thesis-tool/pull/7; item `ITM-002`." on 16 and 16 closed
test("TST-1375102: onPullRequestClosed — a refactoring's merged pull request closes its item's issue as well", async () => {
  await withCheckout(async (w) => {
    const server = fakeGitHub(REFACTOR, "refactor");
    const status = await onPullRequestClosed(w, server);
    assert.equal(status.outcome, "done", status.summary);
    assert.deepEqual(server.writes(), [["POST", "/issues/16/comments", { body: `Closed with ${WEB}/pull/7; item \`ITM-002\`.` }], ["PATCH", "/issues/16", { state: "closed" }]]);
  });
});

// TST-1375103 · level: unit · module: MOD-workflow-entries
// guards: UC-033
// given: known positive first (TST-1375101's item job closes 14 and 15); then the merged pull requests of the job of ITM-003, whose one origin is an issue of another product; of the job of ITM-404, which has no file; of a sprint's close working on ITM-001; and the item job's pull request closed without a merge
// input: onPullRequestClosed for each
// expect: each ends `nothing to do` and writes nothing to the server: the first two with a summary saying no item names an issue of this product, the close with one saying its kind implements no item, the unmerged one with one saying it was closed without a merge
test("TST-1375103: onPullRequestClosed — a job whose items name no issue of this product, a job that implements no item, and an unmerged pull request close nothing", async () => {
  await withCheckout(async (w) => {
    const known = fakeGitHub(ITEM_JOB, "implement");
    assert.equal((await onPullRequestClosed(w, known)).outcome, "done", "known positive");
    assert.equal(known.writes().length, 4, "known positive");
    const cases = [
      [fakeGitHub(OTHER, "implement"), /no item it works on names an issue of this product/],
      [fakeGitHub(MISSING, "implement"), /no item it works on names an issue of this product/],
      [fakeGitHub(CLOSE, "close-sprint"), /implements no item/],
      [fakeGitHub(ITEM_JOB, "implement", { merged: false }), /without a merge/],
    ];
    for (const [server, why] of cases) {
      const status = await onPullRequestClosed(w, server);
      assert.equal(status.outcome, "nothing to do", status.summary);
      assert.match(status.summary, why);
      assert.deepEqual(server.writes(), [], status.summary);
    }
  });
});
