// Release tests of ITM-1292 — a merged pull request closes the issues it names, with one note, whatever the number of routes the product's job workflow has. The behaviour is UC-012 (docs/use-cases/UC-012-turn-an-issue-into-a-specification-change.md, step 5: "the issue is closed
// with a link to the fix") as docs/architecture/MOD-workflow-entries.md (`onPullRequestClosed`: "on a merge, the issues it names closed with links") and docs/architecture/MOD-issue-handling.md (`closeWithLinks`: "the comment `closed-with` and the issue closed") state it, and as ITM-1292
// reads them (docs/backlog/ITM-1292-a-closed-issue-is-noted-once-whatever-the-number-of-routes.md: "An issue already closed with links to that pull request is left as it is: it is closed and noted once").
// Run: node --test tests/release-itm-1292-closed-issue-noted-once.test.mjs
//
// Module: MOD-issue-handling; MOD-workflow-entries; MOD-runtimes
// Guards: UC-012; GITLAB PRODUCTS ARE SUPPORTED
// Level: release
//
// Written for the release testing of sprint 124 by a participant who implemented none of ITM-1292 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The files are the ones MOD-runtimes' `jobWorkflowFiles` generates for a GitHub and a GitLab product with the default route and the runner
// gpu, so that each has two jobs that write. The entry of each of those jobs is the real `onPullRequestClosed`, run by MOD-workflow-entries' `runEntry` in the checkout of a product, with the environment its job gives it, over the fake GitHub or GitLab of the entries' tests
// (tests/workflow-entries-pull-request-world.mjs), whose issues keep what is written to them and serve it back. The cases end at the comments and the state of the issues the server holds. Readings the texts leave open, which the cases state:
//   - "run twice for one merge, as two routes do": the two jobs that write run the entry on the same merge one after the other, over the same server; the GitHub file is read as GitHub reads it (a job runs a step whose `if` holds for the event pull_request), the GitLab file as GitLab reads it
//     (the rules of a job, the first that holds for the push to the default branch sets the entry), by the same reading of `==`, `&&` and `||` as the release tests of ITM-1289.
//   - "already closed with links to that pull request": an issue whose state is closed and which holds the note "Closed with <the address>." that the entry would write. The note holds no date, so one written on another day is the same note.
//   - Leaving an open issue that holds the note as it is, or closing it again, is a reading the texts leave open. MOD-issue-handling says of `closeWithLinks` "the comment `closed-with` and the issue closed" and ITM-1292 leaves alone only an issue "already closed". TST-1292303 reads it so:
//     an issue a person reopened after it was closed with the note is not closed, so the next run notes it and closes it again. The other reading, in which the note alone decides, would leave a reopened issue open; the case fails on it.

import test from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { startRecord } from "../src/job-ledger/index.mjs";
import { jobWorkflowFiles } from "../src/runtimes/index.mjs";
import { runEntry } from "../src/workflow-entries/main.mjs";
import { GITLAB, GITLAB_TOKEN, NOW, PUSHED_AT, TOKEN, fakeGitHub, fakeGitLab, withCheckout as checkout } from "./workflow-entries-pull-request-world.mjs";

const FIX = "JOB-20261030-0900-a1b2", LATER = "JOB-20261030-0904-e5f6";
const WEB = "https://github.com/alice/thesis-tool";
const record = (id, kind, worksOn) => startRecord({ id, kind, worksOn, participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-30T08:00:00Z"),
  agentM: { version: "unreleased", commit: "f".repeat(40) }, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "the hosted runners", parts: [] }], params: {} });
const COMMIT = (n) => String(n).repeat(40);

// ---------------------------------------------------------------- the jobs that write, as the generated files give them

const SECRETS = { token: "AGENT_M_TOKEN", keys: ["CLAUDE_KEY"] };
const fileOf = (server) => jobWorkflowFiles(server, { repository: "alice/agent-m", commit: "0".repeat(40) }, SECRETS, ["gpu"])[0].text;
const noted = (address) => `Closed with ${address}.`;

/** The jobs of the GitHub file that write and run onPullRequestClosed on the event pull_request: [{ id, runner }], in the order of the file. */
function githubWriters() {
  return fileOf("github").split(/\n(?=  [A-Za-z0-9_-]+:\n)/).filter((block) => /AGENT_M_PART: "write"/.test(block)
    && /if: github\.event_name == 'pull_request'\n\s+working-directory: instance\n\s+run: node src\/workflow-entries\/main\.mjs onPullRequestClosed/.test(block))
    .map((block) => ({ id: /^ {2}([A-Za-z0-9_-]+):/.exec(block)[1], runner: /AGENT_M_RUNNER: "([^"]+)"/.exec(block)[1] }));
}
const jobsOf = (text) => text.split(/\n(?=[A-Za-z0-9_-]+:\n)/).filter((block) => /^agent-m-/.test(block)).map((block) => ({ id: /^([A-Za-z0-9_-]+):/.exec(block)[1], text: block }));
const valueOf = (side, variables) => (side.startsWith("$") ? variables[side.slice(1)] ?? null : JSON.parse(side));
const holds = (expression, variables) => expression.split("||").some((any) => any.split("&&").every((comparison) => {
  const [left, right] = comparison.split("==").map((side) => side.trim());
  return valueOf(left, variables) === valueOf(right, variables);
}));
/** The jobs of the GitLab file that the pipeline of a push to the default branch (code changed, no record) starts and that run onPullRequestClosed: [{ id, runner }]. The first rule of a job that holds sets its entry. */
function gitlabWriters(source = "push") {
  const variables = source === "push" ? { CI_PIPELINE_SOURCE: "push", CI_COMMIT_BRANCH: "main", CI_DEFAULT_BRANCH: "main" } : { CI_PIPELINE_SOURCE: source, CI_DEFAULT_BRANCH: "main", CI_MERGE_REQUEST_IID: "7" };
  return jobsOf(fileOf("gitlab")).flatMap((job) => {
    const rules = job.text.slice(0, job.text.indexOf("\n  script:")).split(/\n(?=    - if:)/).slice(1).map((rule) => ({ expression: /^    - if: '(.*)'/.exec(rule)[1], changes: /\n\s+changes:/.test(rule), entry: /AGENT_M_ENTRY: (\w+)/.exec(rule)?.[1] ?? null }));
    const rule = rules.find((each) => holds(each.expression, variables) && !each.changes);
    return rule?.entry === "onPullRequestClosed" ? [{ id: job.id, runner: /AGENT_M_RUNNER: "([^"]+)"/.exec(job.text)[1] }] : [];
  });
}

/** The entry onPullRequestClosed as the job `writer` of the GitHub file runs it on the closing of the pull request #7: its runner, the person's token, the event. */
async function runOnGitHub(w, server, writer) {
  const event = join(w.root, "event.json");
  writeFileSync(event, JSON.stringify({ action: "closed", number: 7, pull_request: { number: 7 } }));
  const real = globalThis.fetch;
  globalThis.fetch = server.fetch;
  try {
    return await runEntry("onPullRequestClosed", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: event, GITHUB_WORKSPACE: w.checkout, GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: w.repository,
      GITHUB_REF_NAME: "7/merge", GITHUB_SHA: COMMIT(3), GITHUB_RUN_ID: "4711", GITHUB_ACTOR: "alice", AGENT_M_RUNNER: writer.runner, AGENT_M_PART: "write", AGENT_M_PRODUCT_DIR: w.product, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", AGENT_M_TOKEN: TOKEN }, { now: NOW });
  } finally { globalThis.fetch = real; }
}
/** The entry as the job `writer` of the GitLab file runs it for the pipeline of the push whose commit is `sha`. */
async function runOnGitLab(w, server, writer, sha) {
  const real = globalThis.fetch;
  globalThis.fetch = server.fetch;
  try {
    return await runEntry("onPullRequestClosed", { GITLAB_CI: "true", CI_PIPELINE_SOURCE: "push", CI_PROJECT_DIR: w.product, CI_PROJECT_URL: GITLAB, CI_COMMIT_REF_NAME: "main", CI_COMMIT_BRANCH: "main", CI_COMMIT_SHA: sha, CI_COMMIT_TIMESTAMP: PUSHED_AT,
      CI_PIPELINE_URL: `${GITLAB}/-/pipelines/4711`, GITLAB_USER_LOGIN: "alice", AGENT_M_RUNNER: writer.runner, AGENT_M_PART: "write", AGENT_M_PRODUCT_DIR: w.product, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", AGENT_M_TOKEN: GITLAB_TOKEN }, { now: NOW });
  } finally { globalThis.fetch = real; }
}

// What the server holds for an issue, read as a person reads the issue's page: its state and its comments, through the fake's own read requests.
async function issueOf(server, base, number, github) {
  const headers = github ? { authorization: `Bearer ${TOKEN}` } : { "private-token": GITLAB_TOKEN };
  const real = globalThis.fetch;
  globalThis.fetch = server.fetch;
  try {
    const issue = await (await fetch(`${base}/issues/${number}`, { headers })).json();
    const comments = await (await fetch(`${base}/issues/${number}${github ? "/comments" : "/notes"}`, { headers })).json();
    return { state: issue.state === "opened" ? "open" : issue.state, comments: comments.map((each) => each.body) };
  } finally { globalThis.fetch = real; }
}
const GITHUB_API = "https://api.github.com/repos/alice/thesis-tool", GITLAB_API = "https://gitlab.example.test/api/v4/projects/alice%2Fthesis-tool";

const githubJobs = [record(FIX, "fix-bug", [`${WEB}/issues/12`, `${WEB}/issues/13`])];
const gitlabIssue = (number) => `${GITLAB}/-/issues/${number}`;
const gitlabJobs = [record(FIX, "fix-bug", [gitlabIssue(12), gitlabIssue(13)]), record(LATER, "fix-bug", [gitlabIssue(12)])];
const mergeRequest = (iid, job, merge) => ({ iid, title: `${job}: fix-bug`, description: `Job: ${job}\nKind: fix-bug`, source_branch: job, sha: String(iid).repeat(40), merge_commit_sha: merge });
const pullRequestFake = (given = {}) => fakeGitHub({ title: `${FIX}: fix-bug`, body: `Job: ${FIX}\nKind: fix-bug`, branch: FIX, ...given });

// TST-1292301 · level: release · module: MOD-workflow-entries
// guards: UC-012
// given: UC-012 step 5 on a GitHub product with the default route and the runner gpu, so that the generated job workflow has two jobs that write, each running onPullRequestClosed on a closed pull request; the pull request #7 of the job JOB-20261030-0900-a1b2 (fix-bug, working on the issues 12 and 13), merged; both issues open and without a comment; known positive first — the generated file of the default route alone has one such job
// input: the pull request merged: the entry of each of the two jobs run in the order of the file, over one fake GitHub that keeps what is written to its issues, with the runner and the person's token its job gives it
// expect: both runs end `done`; the issues 12 and 13 each hold, afterwards, state closed and exactly one comment, "Closed with <the pull request's address>."; the first run wrote all four writes — a comment and a closing for each issue — and the second wrote nothing, so that the server received one comment and one closing per issue in all; every request carried the person's token
// Planted fault: closeWithLinks not reading the issue first (the `return` of the line `if (current.state === "closed" && …)` in src/issue-handling/classes.mjs removed) lets the second job note and close both issues again, and the case fails on the comments of the issues and on the second run's writes.
test("TST-1292301 on GitHub, the two jobs that write of two routes run the entry for one merge and the issues are noted and closed once", async () => {
  const alone = jobWorkflowFiles("github", { repository: "alice/agent-m", commit: "0".repeat(40) }, SECRETS, [])[0].text.split(/\n(?=  [A-Za-z0-9_-]+:\n)/).filter((block) => /AGENT_M_PART: "write"/.test(block) && /main\.mjs onPullRequestClosed/.test(block));
  assert.equal(alone.length, 1, "known positive: the file of the default route alone has one job that writes");
  const writers = githubWriters();
  assert.deepEqual(writers.map((each) => each.runner), ["hosted", "gpu"], "the file with the runner gpu has two jobs that write, one for each route");

  await checkout(githubJobs, async (w) => {
    const server = pullRequestFake();
    const first = await runOnGitHub(w, server, writers[0]);
    assert.equal(first.outcome, "done", first.summary);
    const wroteFirst = server.writes();
    assert.deepEqual(wroteFirst.map(([method, path]) => `${method} ${path}`), ["POST /issues/12/comments", "PATCH /issues/12", "POST /issues/13/comments", "PATCH /issues/13"]);
    const second = await runOnGitHub(w, server, writers[1]);
    assert.equal(second.outcome, "done", second.summary);
    assert.deepEqual(server.writes(), wroteFirst, "the second job writes nothing");
    for (const number of [12, 13]) assert.deepEqual(await issueOf(server, GITHUB_API, number, true), { state: "closed", comments: [noted(`${WEB}/pull/7`)] }, `issue ${number}`);
    for (const each of server.requests) assert.equal(each.authorization, `Bearer ${TOKEN}`, `${each.method} ${each.path} carried the person's token`);
  });
});

// TST-1292302 · level: release · module: MOD-workflow-entries
// guards: UC-012; GITLAB PRODUCTS ARE SUPPORTED
// given: UC-012 step 5 on a GitLab product with the default route and the runner gpu; the pipeline of the push to the default branch that merged the merge request !7 of the job JOB-20261030-0900-a1b2 (fix-bug, working on the issues 12 and 13) starts, by the rules of the generated job workflow, one job that writes for each route; both issues open and without a note; known positive first — the rules start no such job for the pipeline of the open merge request itself (source merge_request_event), so that the entry runs on the merge alone
// input: the entry of each of the two jobs the pipeline starts run in the order of the file, over one fake GitLab that keeps what is written to its issues and lists !7 as merged by the pushed commit
// expect: both runs end `done`; the issues 12 and 13 each hold, afterwards, state closed and exactly one note, "Closed with <the merge request's address>."; the first run wrote the four writes — a note and a closing for each issue — and the second wrote nothing; every request carried the person's token
// Planted fault: closeWithLinks not reading the issue first (the early `return` of src/issue-handling/classes.mjs removed) notes and closes both issues once for each route, and the case fails on the notes.
test("TST-1292302 on GitLab, the two jobs that write of two routes run the entry for one merge and the issues are noted and closed once", async () => {
  assert.deepEqual(gitlabWriters("merge_request_event"), [], "known positive: the pipeline of the open merge request starts no such job");
  const writers = gitlabWriters();
  assert.deepEqual(writers.map((each) => each.runner), ["hosted", "gpu"], "the pipeline of the push to the default branch starts one job that writes for each route");

  await checkout(gitlabJobs, async (w) => {
    const server = fakeGitLab({ mergeRequests: [mergeRequest(7, FIX, COMMIT(3))] });
    const first = await runOnGitLab(w, server, writers[0], COMMIT(3));
    assert.equal(first.outcome, "done", first.summary);
    const wroteFirst = server.writes();
    assert.deepEqual(wroteFirst.map(([method, path]) => `${method} ${path}`), ["POST /issues/12/notes", "PUT /issues/12", "POST /issues/13/notes", "PUT /issues/13"]);
    const second = await runOnGitLab(w, server, writers[1], COMMIT(3));
    assert.equal(second.outcome, "done", second.summary);
    assert.deepEqual(server.writes(), wroteFirst, "the second job writes nothing");
    for (const number of [12, 13]) assert.deepEqual(await issueOf(server, GITLAB_API, number, false), { state: "closed", comments: [noted(`${GITLAB}/-/merge_requests/7`)] }, `issue ${number}`);
    for (const each of server.requests) assert.equal(each.authorization, GITLAB_TOKEN, `${each.method} ${each.path} carried the person's token`);
  });
});

// TST-1292303 · level: release · module: MOD-issue-handling
// guards: UC-012
// given: the product and the pull request of TST-1292301; the first job that writes has run and closed and noted the issues 12 and 13; then a person reopens the issue 12 on the issue's page (the closing undone with the person's token), and the issue 13 is left closed; known positives, checked afterwards in a second product — an issue closed by hand with no note, and an issue closed with another pull request's note, are each noted and closed by the run
// input: the entry of the second job that writes run for the same merge
// expect: the issue 13, still closed and noted, is left as it is, with its one note; the issue 12, open again, is noted a second time and closed again, so that it holds two notes and is closed — the reading of the texts named above (an issue is left as it is only while it is closed); the known positives each hold the note of this pull request and are closed
// Planted fault: the state left out of the check (`current.state === "closed" &&` removed from the line of src/issue-handling/classes.mjs) lets the note alone decide, leaves the reopened issue 12 open, and the case fails on its state and its notes.
// Planted fault: the check made to ignore the note (` && current.comments.some(…)` removed) leaves an issue closed by hand with no note as it is, and the case fails on its known positive.
test("TST-1292303 an issue a person reopened after it was closed with the note is noted and closed again by the next job, an issue still closed is left as it is", async () => {
  const writers = githubWriters();
  await checkout(githubJobs, async (w) => {
    const server = pullRequestFake();
    assert.equal((await runOnGitHub(w, server, writers[0])).outcome, "done");
    const real = globalThis.fetch;
    globalThis.fetch = server.fetch;
    try {
      const reopened = await fetch(`${GITHUB_API}/issues/12`, { method: "PATCH", headers: { authorization: `Bearer ${TOKEN}`, "content-type": "application/json" }, body: JSON.stringify({ state: "open" }) });
      assert.equal(reopened.status, 200);
    } finally { globalThis.fetch = real; }
    assert.equal((await issueOf(server, GITHUB_API, 12, true)).state, "open", "the person reopened the issue 12");
    const before = server.writes().length;
    const second = await runOnGitHub(w, server, writers[1]);
    assert.equal(second.outcome, "done", second.summary);
    assert.deepEqual(server.writes().slice(before).map(([method, path]) => `${method} ${path}`), ["POST /issues/12/comments", "PATCH /issues/12"], "only the reopened issue is written to");
    assert.deepEqual(await issueOf(server, GITHUB_API, 12, true), { state: "closed", comments: [noted(`${WEB}/pull/7`), noted(`${WEB}/pull/7`)] });
    assert.deepEqual(await issueOf(server, GITHUB_API, 13, true), { state: "closed", comments: [noted(`${WEB}/pull/7`)] });
  });
  await checkout(githubJobs, async (w) => {
    const server = pullRequestFake({ issues: { 12: { state: "closed", comments: [] }, 13: { state: "closed", comments: [noted(`${WEB}/pull/6`)] } } });
    assert.equal((await runOnGitHub(w, server, writers[0])).outcome, "done");
    assert.deepEqual(await issueOf(server, GITHUB_API, 12, true), { state: "closed", comments: [noted(`${WEB}/pull/7`)] }, "closed by hand, with no note: noted");
    assert.deepEqual(await issueOf(server, GITHUB_API, 13, true), { state: "closed", comments: [noted(`${WEB}/pull/6`), noted(`${WEB}/pull/7`)] }, "closed with another pull request's note: noted");
  });
});

// TST-1292304 · level: release · module: MOD-workflow-entries
// guards: UC-012; GITLAB PRODUCTS ARE SUPPORTED
// given: the GitLab product of TST-1292302 after both its jobs have run for the merge of !7; then a later merge request !9 of the job JOB-20261030-0904-e5f6 (fix-bug, working on the issue 12 only) merged by the commit 9…; known positive first — the issue 12 holds !7's one note and is closed
// input: the entry of each of the two jobs that write run for the push of the commit 9…
// expect: the later merge request is noted on the issue 12 once: it holds !7's note and then !9's note, each once, and is closed; the issue 13 is not touched by the pushes of !9, and holds !7's note once
// Planted fault: any note "Closed with …" taken as the same (`comment.body === note` replaced by `comment.body.startsWith("Closed with")` in src/issue-handling/classes.mjs) leaves a closed issue that holds another merge request's note without this one's, and the case fails on the issue 12's notes.
test("TST-1292304 a later merge request that names an issue already noted for another one is noted once as well", async () => {
  const writers = gitlabWriters();
  await checkout(gitlabJobs, async (w) => {
    const server = fakeGitLab({ mergeRequests: [mergeRequest(7, FIX, COMMIT(3)), mergeRequest(9, LATER, COMMIT(9))] });
    for (const writer of writers) assert.equal((await runOnGitLab(w, server, writer, COMMIT(3))).outcome, "done");
    assert.deepEqual(await issueOf(server, GITLAB_API, 12, false), { state: "closed", comments: [noted(`${GITLAB}/-/merge_requests/7`)] }, "known positive");
    for (const writer of writers) assert.equal((await runOnGitLab(w, server, writer, COMMIT(9))).outcome, "done");
    assert.deepEqual(await issueOf(server, GITLAB_API, 12, false), { state: "closed", comments: [noted(`${GITLAB}/-/merge_requests/7`), noted(`${GITLAB}/-/merge_requests/9`)] });
    assert.deepEqual(await issueOf(server, GITLAB_API, 13, false), { state: "closed", comments: [noted(`${GITLAB}/-/merge_requests/7`)] });
  });
});
