// Release tests of ITM-1259 — on GitLab, a merged merge request closes the issues it names, with links, through the generated job workflow and the entry. The behaviour is UC-012 (docs/use-cases/UC-012-turn-an-issue-into-a-specification-change.md,
// step 5: "It is merged once the product's Definition of Done holds (UC-002, step 8), and the issue is closed with a link to the fix") on a GitLab product (SPEC: GITLAB PRODUCTS ARE SUPPORTED), as docs/architecture/MOD-runtimes.md (the table of Data: the job
// workflow runs `onPullRequestClosed` on "a pull or merge request closed or merged"; the job that writes "runs `writeResult`, or the entry of an event that runs no agent") and docs/architecture/MOD-workflow-entries.md (`onPullRequestClosed`: "run by the job
// workflow when a pull request of a product is merged or closed: on a merge, the issues it names closed with links") state it.
// Run: node --test tests/release-itm-1259-merge-request-closes-issues.test.mjs
//
// Module: MOD-runtimes; MOD-workflow-entries
// Guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// Level: release
//
// Written for the release testing of sprint 111 by a participant who implemented none of ITM-1259 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The files are the ones MOD-runtimes' `jobWorkflowFiles` generates for a GitLab product (the template
// src/runtimes/workflow/gitlab.yml filled in), and the entry is the real `onPullRequestClosed` run by MOD-workflow-entries' `runEntry` in the checkout and over the fake GitLab of the entries' tests (tests/workflow-entries-pull-request-world.mjs). The
// implementers' tests (TST-1259001 of tests/runtimes-workflow.test.mjs, tests/workflow-entries-merge-request-closed.test.mjs) look at the text of one rule and at one entry run on one environment; these cases start from the pipelines GitLab starts —
// which jobs of the generated file each starts and which entry each runs — and end at the issues of the project. Readings the texts leave open, which the cases state:
//   - GitLab's pipelines, as docs.gitlab.com describes them: a merge request's own pipeline has the source `merge_request_event` and no branch; the merge of a merge request starts a pipeline of the push to the target branch (source `push`, the branch the default
//     branch, the commit the merge left); the jobs of a pipeline are those with a rule that holds, and the first rule of a job that holds decides its variables ("rules:", "Specify when jobs run"). The rules are evaluated here by a reading of the generated text
//     — `==`, `&&`, `||` over the pipeline's variables, and `changes:` as the paths of the push — since no YAML or GitLab stands in this repository.
//   - The entry runs on the project's default route alone (no self-hosted runner), the file's one job that writes.

import test from "node:test";
import assert from "node:assert/strict";
import { startRecord } from "../src/job-ledger/index.mjs";
import { jobWorkflowFiles } from "../src/runtimes/index.mjs";
import { GITLAB, GITLAB_TOKEN, PUSHED_AT, fakeGitLab, onMergeRequestMerged, withCheckout as checkout } from "./workflow-entries-pull-request-world.mjs";

const FIX = "JOB-20261029-0900-a1b2", OTHER = "JOB-20261029-0904-e5f6";
const record = (id, kind, worksOn) => startRecord({ id, kind, worksOn, participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-29T08:00:00Z"),
  agentM: { version: "unreleased", commit: "f".repeat(40) }, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitLab's hosted runners", parts: [] }], params: {} });
const issue = (number) => `${GITLAB}/-/issues/${number}`;
// The jobs of the product: a bug fix working on the issues 12 and 13, and the bug fix of another merge request working on the issue 99.
const JOBS = [record(FIX, "fix-bug", [issue(12), issue(13)]), record(OTHER, "fix-bug", [issue(99)])];
const withCheckout = (body) => checkout(JOBS, body);
const mergeRequest = (iid, job, merge) => ({ iid, title: job ? `${job}: fix-bug` : "Reword the README", description: job ? `Job: ${job}\nKind: fix-bug` : "", source_branch: job ?? "readme", sha: String(iid).repeat(40), merge_commit_sha: merge });
const COMMIT = (n) => String(n).repeat(40);

// ---------------------------------------------------------------- the pipelines of the generated file

const FILE = jobWorkflowFiles("gitlab", { repository: "alice/agent-m", commit: "0".repeat(40) }, { token: "AGENT_M_TOKEN", keys: ["CLAUDE_KEY"] }, [])[0].text;
const jobsOf = (text) => text.split(/\n(?=[A-Za-z0-9_-]+:\n)/).filter((block) => /^agent-m-/.test(block)).map((block) => ({ id: /^([A-Za-z0-9_-]+):/.exec(block)[1], text: block }));
const rulesOf = (job) => job.text.slice(0, job.text.indexOf("\n  script:")).split(/\n(?=    - if:)/).slice(1).map((rule) => ({
  expression: /^    - if: '(.*)'/.exec(rule)[1],
  changes: [...(/\n      changes:\n((?:        - .*\n?)+)/.exec(rule)?.[1] ?? "").matchAll(/- (.+)/g)].map((each) => each[1]),
  entry: /AGENT_M_ENTRY: (\w+)/.exec(rule)?.[1] ?? null,
}));
const valueOf = (side, variables) => (side.startsWith("$") ? variables[side.slice(1)] ?? null : JSON.parse(side));
const holds = (expression, variables) => expression.split("||").some((any) => any.split("&&").every((comparison) => {
  const [left, right] = comparison.split("==").map((side) => side.trim());
  return valueOf(left, variables) === valueOf(right, variables);
}));
const matches = (glob, path) => new RegExp(`^${glob.replace(/\./g, "\\.").replace(/\*\*\/\*/g, ".*")}$`).test(path);
/** The jobs GitLab starts for a pipeline with these variables, and the paths its push changed, each with the entry its first rule that holds sets: [{ id, entry }]. */
function started(variables, changed = []) {
  return jobsOf(FILE).flatMap((job) => {
    const rule = rulesOf(job).find((each) => holds(each.expression, variables) && (each.changes.length === 0 || changed.some((path) => each.changes.some((glob) => matches(glob, path)))));
    return rule ? [{ id: job.id, entry: rule.entry }] : [];
  });
}
const OPEN_REQUEST = { CI_PIPELINE_SOURCE: "merge_request_event", CI_DEFAULT_BRANCH: "main", CI_MERGE_REQUEST_IID: "7" };
const PUSH_TO_MAIN = { CI_PIPELINE_SOURCE: "push", CI_COMMIT_BRANCH: "main", CI_DEFAULT_BRANCH: "main" };

// TST-1259301 · level: release · module: MOD-runtimes, MOD-workflow-entries
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// given: UC-012 step 5 on a GitLab product. the job workflow generated for it; the merge request !7 of the job JOB-20261029-0900-a1b2 (fix-bug, working on the issues 12 and 13 of the project), and !6 of another job, merged earlier; known positive first — the pipeline of a push that changes docs/jobs/ starts the job that writes with the entry writeResult
// input: the pipeline of !7 while it is open (source merge_request_event), the pipeline of the push to the default branch that merged !7 (its changes: src/store/read.mjs), and then the entry that pipeline's job runs, on the environment GitLab gives it
// expect: the open merge request's pipeline starts no job of the file, so that an open merge request closes no issue; the pipeline of the merge starts one job, the one that writes, with the entry onPullRequestClosed — no plan and no agent's job —; that entry ends `done`, its summary naming #12, #13 and the merge request's address, and writes, with the person's token and in this order, the note "Closed with <the merge request's address>." and the closing of the issue 12, the same for 13; nothing for the issue 99 of !6's job
// Planted fault: the template's rule for onPullRequestClosed on a merge request's own pipeline (`$CI_PIPELINE_SOURCE == "merge_request_event"` in place of the push rule in src/runtimes/workflow/gitlab.yml, as before ITM-1259) starts the job on the open merge request and not on its merge, and the case fails on the open merge request's pipeline starting a job.
// Planted fault: the entry not looking for the merge request on GitLab (`env.service !== "gitlab"` taken as `=== "github"`, so that eventPullRequest gives null, in src/workflow-entries/product.mjs) ends "nothing to do", and the case fails on the outcome.
test("TST-1259301 the merge of a merge request starts the job that closes its issues, an open one starts none, and the issues are closed with the merge request's link", async () => {
  assert.equal(started(PUSH_TO_MAIN, ["docs/jobs/JOB-20261029-0900-a1b2.md"]).find((job) => job.id === "agent-m-hosted")?.entry, "writeResult", "known positive: a push of job records starts the job that writes with writeResult");
  assert.deepEqual(started(OPEN_REQUEST, ["src/store/read.mjs"]), [], "an open merge request's pipeline starts no job");
  const merge = started(PUSH_TO_MAIN, ["src/store/read.mjs"]);
  assert.deepEqual(merge, [{ id: "agent-m-hosted", entry: "onPullRequestClosed" }]);

  await withCheckout(async (w) => {
    const server = fakeGitLab({ mergeRequests: [mergeRequest(6, OTHER, COMMIT(5)), mergeRequest(7, FIX, COMMIT(3))] });
    const status = await onMergeRequestMerged(w, server, { sha: COMMIT(3) });
    assert.equal(status.outcome, "done", status.summary);
    assert.match(status.summary, /#12/);
    assert.match(status.summary, /#13/);
    assert.ok(status.summary.includes(`${GITLAB}/-/merge_requests/7`), status.summary);
    assert.deepEqual(server.writes(), [["POST", "/issues/12/notes", { body: `Closed with ${GITLAB}/-/merge_requests/7.` }], ["PUT", "/issues/12", { state_event: "close" }],
      ["POST", "/issues/13/notes", { body: `Closed with ${GITLAB}/-/merge_requests/7.` }], ["PUT", "/issues/13", { state_event: "close" }]]);
    for (const each of server.requests) assert.equal(each.authorization, GITLAB_TOKEN, `${each.method} ${each.path} carried the person's token`);
  });
});

// TST-1259302 · level: release · module: MOD-workflow-entries
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// given: the project after four pushes to its default branch, each with the pipeline GitLab starts for it: !6 of the job JOB-20261029-0904-e5f6 (fix-bug on the issue 99) merged by the commit 5…, !7 of JOB-20261029-0900-a1b2 (fix-bug on the issues 12 and 13) by 3…, !8 (a change of the README that names no job) by 8…, and a commit pushed to the branch directly (9…); known positive first — the push of !7 alone closes 12 and 13
// input: the entry onPullRequestClosed for each of the four pushes in this order, the server listing all the merge requests merged since the first push, as it lists those updated after a time
// expect: each push closes the issues of the merge request that push merged and no other: 5… the issue 99 only; 3… the issues 12 and 13 only; 8… nothing, the outcome `nothing to do` saying that the merge request names no job; 9… nothing, the outcome `nothing to do` saying that no merge request was merged by the commit; in all each issue is noted and closed once, and a push that closes nothing writes nothing
// Planted fault: the entry taking the first merged merge request the server lists in place of the one the push's commit merged (`merged[0]` in place of `merged.find((each) => each.mergeCommit === commit.sha)` in eventPullRequest of src/workflow-entries/product.mjs) closes the issue 99 on every push, and the case fails at the push of !7.
test("TST-1259302 each push closes the issues of the merge request it merged, a merge request that names no job and a direct push close nothing", async () => {
  await withCheckout(async (w) => {
    const listed = [mergeRequest(6, OTHER, COMMIT(5)), mergeRequest(7, FIX, COMMIT(3)), mergeRequest(8, null, COMMIT(8))];
    const known = fakeGitLab({ mergeRequests: [listed[1]] });
    assert.equal((await onMergeRequestMerged(w, known, { sha: COMMIT(3) })).outcome, "done", "known positive");
    assert.deepEqual(known.writes().map(([method, path]) => `${method} ${path}`), ["POST /issues/12/notes", "PUT /issues/12", "POST /issues/13/notes", "PUT /issues/13"]);

    const writes = [];
    const closedBy = {};
    for (const sha of [COMMIT(5), COMMIT(3), COMMIT(8), COMMIT(9)]) {
      const server = fakeGitLab({ mergeRequests: listed });
      const status = await onMergeRequestMerged(w, server, { sha });
      closedBy[sha[0]] = server.writes().filter(([method]) => method === "PUT").map(([, path]) => Number(/\/issues\/(\d+)$/.exec(path)[1]));
      writes.push(...server.writes());
      if (sha === COMMIT(8)) { assert.equal(status.outcome, "nothing to do", status.summary); assert.match(status.summary, /names no job/); }
      if (sha === COMMIT(9)) { assert.equal(status.outcome, "nothing to do", status.summary); assert.match(status.summary, /no merge request/i); }
      if (["8", "9"].includes(sha[0])) assert.deepEqual(server.writes(), [], `the push ${sha[0]}… writes nothing`);
    }
    assert.deepEqual(closedBy, { 5: [99], 3: [12, 13], 8: [], 9: [] });
    const noted = writes.filter(([method, path]) => method === "POST" && /\/notes$/.test(path)).map(([, path]) => path).sort();
    assert.deepEqual(noted, ["/issues/12/notes", "/issues/13/notes", "/issues/99/notes"], "each issue is noted once");
    assert.equal(writes.find(([, path]) => path === "/issues/99/notes")[2].body, `Closed with ${GITLAB}/-/merge_requests/6.`, "the note names the merge request that closed it");
  });
});

// TST-1259303 · level: release · module: MOD-runtimes
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// given: the job workflow generated for a GitLab product; GitLab starts only the jobs whose rule holds, and makes a pipeline invalid whose job needs a job that the pipeline does not hold unless that need is `optional: true` ("needs:optional", docs.gitlab.com); known positive first — the job that writes needs the agent's jobs of its route
// input: the needs of the job that writes, and the pipeline of the push that merged a merge request, which starts that job alone
// expect: the job that writes lists at least one need and every one is optional, so that the pipeline of a merge — in which the agent's jobs are not started — is valid and the job that closes the issues runs; no job the merge starts is a plan or an agent's
// Planted fault: the needs written without `optional: true` (`optional: true\n` removed from "agent-needs" in src/runtimes/ci.mjs) leaves a need that the pipeline of the merge cannot satisfy, and the case fails on the need not being optional.
test("TST-1259303 the pipeline of a merge is valid: the job that writes needs the agent's jobs only as optional ones", () => {
  const writer = jobsOf(FILE).find((job) => job.id === "agent-m-hosted");
  const needs = writer.text.slice(writer.text.indexOf("\n  needs:\n"), writer.text.indexOf("\n  variables:")).split(/\n(?=    - job:)/).slice(1);
  assert.ok(needs.length >= 1, `known positive: the job that writes has needs:\n${writer.text.slice(0, 600)}`);
  for (const need of needs) assert.match(need, /\n {6}optional: true\n?/, need);
  const merge = started(PUSH_TO_MAIN, ["src/store/read.mjs"]);
  assert.deepEqual(merge.map((job) => job.id), ["agent-m-hosted"]);
  for (const need of needs) assert.equal(merge.some((job) => new RegExp(`job: ${job.id}\\s`).test(need)), false, "the merge starts none of the jobs it needs");
});
