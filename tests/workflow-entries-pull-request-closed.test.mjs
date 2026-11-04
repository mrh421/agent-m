// MOD-workflow-entries' entry onPullRequestClosed (ITM-583), as the accepted text of docs/architecture/MOD-workflow-entries.md states it: "`onPullRequestClosed` — run by the job workflow when a pull request of a product is merged or closed: on a merge, the issues it names
// closed with links, and [...]; merged or closed, the next actions of the runs it concerns, as `onRecordsChanged` computes them."; UC-012 step 5 and its first postcondition. This file guards the first part (the issues); the runs' part is another item's.
// Run: node --test tests/workflow-entries-pull-request-closed.test.mjs
//
// Module: MOD-workflow-entries; MOD-issue-handling
// Guards: CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; UC-012
// Level: unit
//
// Deterministic, no network. The checkout is laid out as the job workflow lays out the product: the workspace is a temporary git repository holding the product's files, among them the records of the jobs; the pull request, the issues and their comments come from a fake of
// GitHub's REST API, which `fetch` is replaced with. The readings, named in the pull request:
//   - The issues a merged pull request names are those its job works on: the job is the one its title or description names (`Job: <id>`, as MOD-runtimes' writer branch-and-pull-request writes it and onDoneCheck reads it), and the addresses among the job's `works_on` that lie below
//     the product's own address, `/issues/<n>` on GitHub, are its issues; a name of the job that is no issue of this product is not one. Only a job of the kind `fix-bug` closes issues here; an item built from an issue is another use case's (UC-033).
//   - Each issue is closed with MOD-issue-handling's closeWithLinks: the note `Closed with <the pull request's address>.` and then the state `closed`; the person's token from AGENT_M_TOKEN authorises both.
//   - A pull request that was closed without a merge, one that names no job, one whose job has no record or is of another kind, and one whose job works on no issue of this product write nothing: `nothing to do`. A missing token ends the entry `not run` before any request.
//   - An issue the server refuses to close does not keep the others from being closed: the entry names it and ends `failed`.
//   - The job workflow has one writer job per route, each running the entry on the merge (ITM-1292): closeWithLinks reads each issue first, and one already closed with the note it would write is left as it is, so that the issue is noted and closed once.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { startRecord } from "../src/job-ledger/index.mjs";
import { TOKEN, fakeGitHub as fake, onPullRequestClosed, withCheckout as checkout } from "./workflow-entries-pull-request-world.mjs";

// ---------------------------------------------------------------- the fixtures

const FIX = "JOB-20261028-0900-a1b2", ITEM_JOB = "JOB-20261028-0901-b2c3", NO_ISSUE = "JOB-20261028-0902-c3d4", GONE = "JOB-20261028-0903-d4e5";
const WEB = "https://github.com/alice/thesis-tool";

const record = (id, kind, worksOn) => startRecord({ id, kind, worksOn, participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-28T08:00:00Z"),
  agentM: { version: "unreleased", commit: "f".repeat(40) }, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: [] }], params: {} });
// The jobs of the product: a bug fix working on the issues 12 and 13 of this product, a requirement and an issue of another product; an item's job; a fix that works on no issue of this product.
const JOBS = [record(FIX, "fix-bug", [`${WEB}/issues/12`, `${WEB}/issues/13`, "A GUARDED RULE", "https://github.com/other/tool/issues/3"]), record(ITEM_JOB, "implement", ["ITM-001", `${WEB}/issues/14`]),
  record(NO_ISSUE, "fix-bug", ["A GUARDED RULE"])];
const withCheckout = (body) => checkout(JOBS, body);
// The fake server of the pull request #7, which names the job FIX unless given otherwise.
const fakeGitHub = (given = {}) => fake({ title: `${FIX}: fix-bug`, body: `Job: ${FIX}\nKind: fix-bug`, branch: FIX, ...given });

// ---------------------------------------------------------------- the tests

// TST-583301 · level: unit · module: MOD-workflow-entries
// guards: CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; UC-012
// given: the merged pull request #7 whose title and description name the job JOB-20261028-0900-a1b2 of kind fix-bug, which works on the issues 12 and 13 of this product, on a requirement and on an issue of another product; the person's token
// input: onPullRequestClosed on the event pull_request, action closed
// expect: outcome `done`, the summary naming #12, #13 and the pull request's address; the server was written to four times, in this order, with the person's token: the comment "Closed with <the pull request's address>." on issue 12 and 12 closed, the same for 13; nothing for the other product's issue 3
test("onPullRequestClosed — a merged fix closes the issues its job works on, each with a note naming the pull request", async () => {
  await withCheckout(async (w) => {
    const server = fakeGitHub();
    const status = await onPullRequestClosed(w, server);
    assert.equal(status.outcome, "done", status.summary);
    assert.match(status.summary, /#12/);
    assert.match(status.summary, /#13/);
    assert.ok(status.summary.includes(`${WEB}/pull/7`), status.summary);
    assert.deepEqual(server.writes(), [["POST", "/issues/12/comments", { body: `Closed with ${WEB}/pull/7.` }], ["PATCH", "/issues/12", { state: "closed" }],
      ["POST", "/issues/13/comments", { body: `Closed with ${WEB}/pull/7.` }], ["PATCH", "/issues/13", { state: "closed" }]]);
    for (const each of server.requests) assert.equal(each.authorization, `Bearer ${TOKEN}`, `${each.method} ${each.path} carried the person's token`);
  });
});

// TST-583302 · level: unit · module: MOD-workflow-entries
// guards: UC-012
// given: known positive first (TST-583301's world closes both issues); the same pull request closed without a merge
// input: onPullRequestClosed for the merged pull request, and for one whose merged_at the server leaves empty
// expect: the merged one writes four requests; the unmerged one `nothing to do`, its summary saying it was closed without a merge, and not one write to the server
test("onPullRequestClosed — a pull request closed without a merge closes no issue", async () => {
  await withCheckout(async (w) => {
    const merged = fakeGitHub();
    assert.equal((await onPullRequestClosed(w, merged)).outcome, "done");
    assert.equal(merged.writes().length, 4, "known positive");
    const unmerged = fakeGitHub({ merged: false });
    const status = await onPullRequestClosed(w, unmerged);
    assert.equal(status.outcome, "nothing to do", status.summary);
    assert.match(status.summary, /without a merge/);
    assert.deepEqual(unmerged.writes(), []);
  });
});

// TST-583303 · level: unit · module: MOD-workflow-entries
// guards: UC-012
// given: known positive first; then merged pull requests that name no job, a job that has no record, a job of kind implement that works on an issue, and a fix that works on no issue of this product
// input: onPullRequestClosed for each
// expect: each ends `nothing to do` with a summary that says why and writes nothing to the server
test("onPullRequestClosed — a merged pull request that names no fix of an issue closes nothing", async () => {
  await withCheckout(async (w) => {
    assert.equal((await onPullRequestClosed(w, fakeGitHub())).outcome, "done", "known positive");
    const cases = [
      [{ title: "A change by hand", body: "No job." }, /names no job/],
      [{ title: `${GONE}: fix-bug`, body: `Job: ${GONE}` }, /has no record/],
      [{ title: `${ITEM_JOB}: implement ITM-001`, body: `Job: ${ITEM_JOB}\nKind: implement` }, /fixes no bug/],
      [{ title: `${NO_ISSUE}: fix-bug`, body: `Job: ${NO_ISSUE}` }, /works on no issue/],
    ];
    for (const [given, why] of cases) {
      const server = fakeGitHub(given);
      const status = await onPullRequestClosed(w, server);
      assert.equal(status.outcome, "nothing to do", `${given.title}: ${status.summary}`);
      assert.match(status.summary, why, given.title);
      assert.deepEqual(server.writes(), [], given.title);
    }
  });
});

// TST-583304 · level: unit · module: MOD-workflow-entries
// guards: A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; UC-012
// given: the world of TST-583301, but the workflow gives the entry no token; and an event that names no pull request
// input: onPullRequestClosed without AGENT_M_TOKEN, with every fetch failing the test; and onPullRequestClosed with the token on an event without a pull request
// expect: the first `not run`, its summary naming AGENT_M_TOKEN, no request made; the second `nothing to do`, no request made
test("onPullRequestClosed — without the person's token nothing is written and the status says why; without a pull request it has nothing to do", async () => {
  await withCheckout(async (w) => {
    const status = await onPullRequestClosed(w, null, { token: null });
    assert.equal(status.outcome, "not run");
    assert.match(status.summary, /AGENT_M_TOKEN/);
    const none = await onPullRequestClosed(w, null, { payload: { action: "closed" } });
    assert.equal(none.outcome, "nothing to do", none.summary);
  });
});

// TST-583305 · level: unit · module: MOD-workflow-entries
// guards: UC-012
// given: the world of TST-583301, in which the server refuses the comment on the issue 12 with 403
// input: onPullRequestClosed
// expect: outcome `failed`, the summary naming #12 as not closed and #13 as closed; the issue 12 is not closed (its comment came first and was refused), the issue 13 is commented and closed
test("onPullRequestClosed — an issue the server refuses is named, and the others are closed all the same", async () => {
  await withCheckout(async (w) => {
    const server = fakeGitHub({ refuse: [12] });
    const status = await onPullRequestClosed(w, server);
    assert.equal(status.outcome, "failed", status.summary);
    assert.match(status.summary, /Not closed — #12/);
    assert.match(status.summary, /#13 closed/);
    assert.deepEqual(server.writes().map(([method, path]) => `${method} ${path}`), ["POST /issues/12/comments", "POST /issues/13/comments", "PATCH /issues/13"]);
  });
});

// TST-1292003 · level: unit · module: MOD-workflow-entries
// guards: UC-012
// given: the world of TST-583301, with one fake GitHub whose issues keep what is written to them; known positive first — a fake whose issue 12 is already closed with the note of another pull request, #6
// input: onPullRequestClosed twice for the merged pull request #7, as the writer jobs of the routes `hosted` and `runner-gpu` each run it on the merge; and once against the known positive's fake
// expect: both runs end `done`; over the two runs the server is written to four times — the note "Closed with <the pull request's address>." on issue 12 and 12 closed, the same for 13 —, all in the first run, and each run reads each issue once (GET /issues/12, GET /issues/13); the known positive notes and closes the issue 12 as well, beside #6's note
test("onPullRequestClosed — two routes that run the entry for one merge note and close each issue once", async () => {
  await withCheckout(async (w) => {
    const other = fakeGitHub({ issues: { 12: { state: "closed", comments: [`Closed with ${WEB}/pull/6.`] } } });
    assert.equal((await onPullRequestClosed(w, other)).outcome, "done", "known positive");
    assert.deepEqual(other.writes().filter(([, path]) => path.startsWith("/issues/12")), [["POST", "/issues/12/comments", { body: `Closed with ${WEB}/pull/7.` }], ["PATCH", "/issues/12", { state: "closed" }]], "known positive");
    const server = fakeGitHub();
    const reads = () => server.requests.filter((each) => each.method === "GET" && /^\/issues\/\d+$/.test(each.path)).map((each) => each.path);
    const first = await onPullRequestClosed(w, server);
    assert.equal(first.outcome, "done", first.summary);
    const readFirst = reads(), wroteFirst = server.writes().length;
    const second = await onPullRequestClosed(w, server);
    assert.equal(second.outcome, "done", second.summary);
    assert.deepEqual(server.writes(), [["POST", "/issues/12/comments", { body: `Closed with ${WEB}/pull/7.` }], ["PATCH", "/issues/12", { state: "closed" }],
      ["POST", "/issues/13/comments", { body: `Closed with ${WEB}/pull/7.` }], ["PATCH", "/issues/13", { state: "closed" }]], "one note and one close per issue over the two runs");
    assert.equal(wroteFirst, 4, "all of them in the first run");
    assert.deepEqual(readFirst, ["/issues/12", "/issues/13"], "the first run reads each issue once");
    assert.deepEqual(reads(), ["/issues/12", "/issues/13", "/issues/12", "/issues/13"], "the second run reads each issue once");
  });
});
