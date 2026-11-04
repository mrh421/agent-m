// MOD-workflow-entries' entry onPullRequestClosed on GitLab (ITM-1259), as the accepted text of docs/architecture/MOD-workflow-entries.md states it: "`onPullRequestClosed` — run by the job workflow when a pull request of a product is merged or closed: on a merge, the issues it names
// closed with links"; and MOD-runtimes' table, which runs it on "a pull or merge request closed or merged"; SPEC: GITLAB PRODUCTS ARE SUPPORTED. The GitHub half is tests/workflow-entries-pull-request-closed.test.mjs (ITM-583); this file guards that the entry finds the merge request
// that GitLab's environment names and then closes the issues of its job as it does there.
// Run: node --test tests/workflow-entries-merge-request-closed.test.mjs
//
// Module: MOD-workflow-entries; MOD-issue-handling
// Guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// Level: unit
//
// Deterministic, no network: the checkout is laid out as in the GitHub tests (tests/workflow-entries-pull-request-world.mjs), the merge requests and the issues come from a fake of GitLab's REST API, which `fetch` is replaced with. The readings, named in the pull request:
//   - GitLab starts no pipeline on the merge request for its merge: it starts a pipeline of the push to the target branch, whose CI_COMMIT_SHA is the commit the merge left ("Predefined CI/CD variables", docs.gitlab.com). The merge request the entry takes is
//     the merged one whose merge commit is that commit — the host's `mergeCommit`, which on GitLab is the merge commit, else the squash commit, else the head of a fast-forward merge —, among the merged ones the server lists (the listing bounds no date, ITM-1260).
//   - Everything after the merge request is found is the entry's as for GitHub: the job its title or description names, the issues below the product's own address (`/-/issues/<n>` on GitLab), closeWithLinks — which reads each issue first and leaves one already closed with its note as it is, so that two routes' writer jobs note it once (ITM-1292).
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { startRecord } from "../src/job-ledger/index.mjs";
import { ciEnvironment } from "../src/workflow-entries/compose.mjs";
import { GITLAB, GITLAB_TOKEN, PUSHED_AT, MERGE, HEAD, NOW, fakeGitLab, onMergeRequestMerged, withCheckout as checkout } from "./workflow-entries-pull-request-world.mjs";

const FIX = "JOB-20261028-0900-a1b2", OTHER = "JOB-20261028-0904-e5f6";
const record = (id, kind, worksOn) => startRecord({ id, kind, worksOn, participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-28T08:00:00Z"),
  agentM: { version: "unreleased", commit: "f".repeat(40) }, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitLab's hosted runners", parts: [] }], params: {} });
// The jobs of the product: a bug fix working on the issues 12 and 13 of this product and on an issue of another project, and the bug fix of another merge request, working on the issue 99.
const JOBS = [record(FIX, "fix-bug", [`${GITLAB}/-/issues/12`, `${GITLAB}/-/issues/13`, "A GUARDED RULE", "https://gitlab.example.test/other/tool/-/issues/3"]), record(OTHER, "fix-bug", [`${GITLAB}/-/issues/99`])];
const withCheckout = (body) => checkout(JOBS, body);
// The merge request !7 of the job FIX, merged by a merge commit; !6 of another job, merged earlier by another commit.
const MR7 = { iid: 7, title: `${FIX}: fix-bug`, description: `Job: ${FIX}\nKind: fix-bug`, source_branch: FIX, sha: HEAD, merge_commit_sha: MERGE };
const MR6 = { iid: 6, title: `${OTHER}: fix-bug`, description: `Job: ${OTHER}`, source_branch: OTHER, sha: "4".repeat(40), merge_commit_sha: "5".repeat(40) };

// TST-1259002 · level: unit · module: MOD-workflow-entries
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// given: GitLab's environment of the pipeline of the push that merged the merge request !7 — CI_COMMIT_SHA its merge commit, CI_COMMIT_TIMESTAMP the time of that commit —; !7's title and description name the job JOB-20261028-0900-a1b2 of kind fix-bug, which works on the issues 12 and 13 of this product, on a requirement and on an issue of another project; the server lists !6, merged by another commit, and !7; the person's token
// input: onPullRequestClosed on that environment
// expect: outcome `done`, the summary naming #12, #13 and the merge request's address; the server was asked for the merged merge requests; it was written to four times, in this order, with the person's token: the note "Closed with <the merge request's address>." on issue 12 and 12 closed, the same for 13; nothing for the other project's issue 3 and nothing for the issue 99 of !6's job
test("onPullRequestClosed on GitLab — the merge that CI_COMMIT_SHA names closes the issues its merge request's job works on, each with a note naming the merge request", async () => {
  await withCheckout(async (w) => {
    const server = fakeGitLab({ mergeRequests: [MR6, MR7] });
    const status = await onMergeRequestMerged(w, server);
    assert.equal(status.outcome, "done", status.summary);
    assert.match(status.summary, /#12/);
    assert.match(status.summary, /#13/);
    assert.ok(status.summary.includes(`${GITLAB}/-/merge_requests/7`), status.summary);
    const [asked] = server.requests.filter((each) => each.path === "/merge_requests");
    assert.equal(asked.query.state, "merged");
    assert.deepEqual(server.writes(), [["POST", "/issues/12/notes", { body: `Closed with ${GITLAB}/-/merge_requests/7.` }], ["PUT", "/issues/12", { state_event: "close" }],
      ["POST", "/issues/13/notes", { body: `Closed with ${GITLAB}/-/merge_requests/7.` }], ["PUT", "/issues/13", { state_event: "close" }]]);
    for (const each of server.requests) assert.equal(each.authorization, GITLAB_TOKEN, `${each.method} ${each.path} carried the person's token`);
  });
});

// TST-1259003 · level: unit · module: MOD-workflow-entries
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// given: known positive first (TST-1259002's world closes both issues); then the merge requests merged by a squash commit and by a fast-forward (no merge commit, the head stands), each with CI_COMMIT_SHA the commit the merge left; and a push whose commit no listed merge request merged, and a server that lists none
// input: onPullRequestClosed for each environment
// expect: the merge by a squash commit and the fast-forward one each write four requests and end `done`; the push that no merge request merged ends `nothing to do`, its summary saying that no merge request was merged by that commit, and writes nothing, as does the one with no merge request listed
test("onPullRequestClosed on GitLab — a merge by squash or fast-forward is found by the commit it left; a push that merged no merge request closes nothing", async () => {
  await withCheckout(async (w) => {
    const known = fakeGitLab({ mergeRequests: [MR7] });
    assert.equal((await onMergeRequestMerged(w, known)).outcome, "done", "known positive");
    assert.equal(known.writes().length, 4);
    const squash = fakeGitLab({ mergeRequests: [{ ...MR7, merge_commit_sha: null, squash_commit_sha: "6".repeat(40) }] });
    assert.equal((await onMergeRequestMerged(w, squash, { sha: "6".repeat(40) })).outcome, "done", "squash");
    assert.equal(squash.writes().length, 4);
    const forward = fakeGitLab({ mergeRequests: [{ ...MR7, merge_commit_sha: null }] });
    assert.equal((await onMergeRequestMerged(w, forward, { sha: HEAD })).outcome, "done", "fast-forward");
    assert.equal(forward.writes().length, 4);
    for (const server of [fakeGitLab({ mergeRequests: [MR6, MR7] }), fakeGitLab()]) {
      const status = await onMergeRequestMerged(w, server, { sha: "9".repeat(40) });
      assert.equal(status.outcome, "nothing to do", status.summary);
      assert.match(status.summary, /no merge request/i);
      assert.deepEqual(server.writes(), []);
    }
  });
});

// TST-1259004 · level: unit · module: MOD-workflow-entries
// guards: GITLAB PRODUCTS ARE SUPPORTED
// given: the world of TST-1259002, in which the server refuses the note on the issue 12 with 403
// input: onPullRequestClosed on GitLab; and, without the person's token, with every fetch failing the test
// expect: the first outcome `failed`, the summary naming #12 as not closed and #13 as closed, the issue 13 noted and closed; the second `not run`, the summary naming AGENT_M_TOKEN, no request made
test("onPullRequestClosed on GitLab — an issue the server refuses is named and the others are closed; without the token nothing is asked", async () => {
  await withCheckout(async (w) => {
    const server = fakeGitLab({ mergeRequests: [MR7], refuse: [12] });
    const status = await onMergeRequestMerged(w, server);
    assert.equal(status.outcome, "failed", status.summary);
    assert.match(status.summary, /Not closed — #12/);
    assert.match(status.summary, /#13 closed/);
    assert.deepEqual(server.writes().map(([method, path]) => `${method} ${path}`), ["POST /issues/12/notes", "POST /issues/13/notes", "PUT /issues/13"]);
    const none = await onMergeRequestMerged(w, null, { token: null });
    assert.equal(none.outcome, "not run");
    assert.match(none.summary, /AGENT_M_TOKEN/);
  });
});

// TST-1292004 · level: unit · module: MOD-workflow-entries
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// given: the world of TST-1259002, with one fake GitLab whose issues keep what is written to them; known positive first — a fake whose issue 12 is already closed with the note of another merge request, !6
// input: onPullRequestClosed twice for the pipeline of the push that merged !7, as the writer jobs of the routes `agent-m-hosted` and `agent-m-runner-gpu` each run it; and once against the known positive's fake
// expect: both runs end `done`; over the two runs the server is written to four times — the note "Closed with <the merge request's address>." on issue 12 and 12 closed, the same for 13 —, all in the first run, and each run reads each issue once (GET /issues/12, GET /issues/13); the known positive notes and closes the issue 12 as well, beside !6's note
test("onPullRequestClosed on GitLab — two routes that run the entry for one merge note and close each issue once", async () => {
  await withCheckout(async (w) => {
    const other = fakeGitLab({ mergeRequests: [MR7], issues: { 12: { state: "closed", comments: [`Closed with ${GITLAB}/-/merge_requests/6.`] } } });
    assert.equal((await onMergeRequestMerged(w, other)).outcome, "done", "known positive");
    assert.deepEqual(other.writes().filter(([, path]) => path.startsWith("/issues/12")), [["POST", "/issues/12/notes", { body: `Closed with ${GITLAB}/-/merge_requests/7.` }], ["PUT", "/issues/12", { state_event: "close" }]], "known positive");
    const server = fakeGitLab({ mergeRequests: [MR6, MR7] });
    const reads = () => server.requests.filter((each) => each.method === "GET" && /^\/issues\/\d+$/.test(each.path)).map((each) => each.path);
    const first = await onMergeRequestMerged(w, server);
    assert.equal(first.outcome, "done", first.summary);
    const readFirst = reads(), wroteFirst = server.writes().length;
    const second = await onMergeRequestMerged(w, server);
    assert.equal(second.outcome, "done", second.summary);
    assert.deepEqual(server.writes(), [["POST", "/issues/12/notes", { body: `Closed with ${GITLAB}/-/merge_requests/7.` }], ["PUT", "/issues/12", { state_event: "close" }],
      ["POST", "/issues/13/notes", { body: `Closed with ${GITLAB}/-/merge_requests/7.` }], ["PUT", "/issues/13", { state_event: "close" }]], "one note and one close per issue over the two runs");
    assert.equal(wroteFirst, 4, "all of them in the first run");
    assert.deepEqual(readFirst, ["/issues/12", "/issues/13"], "the first run reads each issue once");
    assert.deepEqual(reads(), ["/issues/12", "/issues/13", "/issues/12", "/issues/13"], "the second run reads each issue once");
  });
});

// TST-1259005 · level: unit · module: MOD-workflow-entries
// guards: GITLAB PRODUCTS ARE SUPPORTED
// given: GitLab's variables of a push pipeline on the default branch — CI_PIPELINE_SOURCE `push`, CI_COMMIT_SHA, CI_COMMIT_TIMESTAMP `2026-10-28T09:50:00+00:00`
// input: ciEnvironment for the entry onPullRequestClosed, and for the entry onDispatch
// expect: for onPullRequestClosed the event's payload holds `commit` { sha: that sha, timestamp: that time } beside its inputs; for onDispatch the payload is { inputs } only, as before
test("ciEnvironment — on GitLab the entry onPullRequestClosed reads the commit and its time", () => {
  const sha = "7".repeat(40);
  const env = { GITLAB_CI: "true", CI_PIPELINE_SOURCE: "push", CI_PROJECT_DIR: "/builds/alice/thesis-tool", CI_PROJECT_URL: GITLAB, CI_COMMIT_REF_NAME: "main", CI_COMMIT_SHA: sha, CI_COMMIT_TIMESTAMP: PUSHED_AT };
  assert.deepEqual(ciEnvironment("onPullRequestClosed", env, NOW).event, { name: "push", payload: { inputs: {}, commit: { sha, timestamp: PUSHED_AT } } });
  assert.deepEqual(ciEnvironment("onDispatch", env, NOW).event, { name: "push", payload: { inputs: {} } });
});
