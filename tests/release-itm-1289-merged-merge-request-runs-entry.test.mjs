// Release tests of ITM-1289 — on GitLab every merged merge request runs `onPullRequestClosed` and so closes the issues it names, also one whose commit changes the records and one into a branch other than the default one. The behaviour is UC-012
// (docs/use-cases/UC-012-turn-an-issue-into-a-specification-change.md, step 5: "It is merged once the product's Definition of Done holds (UC-002, step 8), and the issue is closed with a link to the fix") on a GitLab product (SPEC: GITLAB PRODUCTS ARE SUPPORTED),
// as docs/architecture/MOD-runtimes.md (the table of Data: the job workflow runs `onPullRequestClosed` on "a pull or merge request closed or merged", `onRecordsChanged` on "a push to the default branch that changes `docs/jobs/` or `docs/gates/`", `onSchedule` on "a schedule,
// once a day"; the job that writes "runs `writeResult`, or the entry of an event that runs no agent"; "the token is read only on a runner machine on which no agent works") and docs/architecture/MOD-workflow-entries.md (`onPullRequestClosed`: "on a merge, the issues it names
// closed with links") state it.
// Run: node --test tests/release-itm-1289-merged-merge-request-runs-entry.test.mjs
//
// Module: MOD-runtimes; MOD-workflow-entries
// Guards: GITLAB PRODUCTS ARE SUPPORTED; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; UC-012
// Level: release
//
// Written for the release testing of sprint 120 by a participant who implemented none of ITM-1289 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The files are the ones MOD-runtimes' `jobWorkflowFiles` generates for a GitLab product, read as GitLab reads them: the
// pipeline a push or a schedule starts is the jobs with a rule that holds, the first rule that holds sets the job's variables, and the entries a job runs are the lines of its script that run one, run by `sh` with those variables and with `node` standing in for Node, which
// only names the entry it is given. Each entry so named is then run for real by MOD-workflow-entries' `runEntry`, in the checkout of a product and over the fake GitLab of the entries' tests (tests/workflow-entries-pull-request-world.mjs). The implementers' test (TST-1289001 of
// tests/runtimes-workflow.test.mjs) looks at which entries the jobs name; these cases end at the issues of the project and at the secrets the jobs name. Readings the texts leave open, which the cases state:
//   - GitLab's pipelines, as docs.gitlab.com describes them: a merge request's own pipeline has the source `merge_request_event` and no branch; the merge of a merge request starts the pipeline of the push to its target branch, whichever branch that is (source `push`, the
//     branch the target, the commit the merge left); the schedule's pipeline has the source `schedule`. The rules are evaluated by a reading of the generated text — `==`, `&&`, `||` over the pipeline's variables, and `changes:` as the paths the push changed —,
//     since no YAML or GitLab stands in this repository.
//   - "runs writeResult and then onPullRequestClosed": the job that writes names the two entries in this order, and the real entries run in this order end `nothing to do` for the first, the agent's machine having left no result, and `done` for the second.
//   - "the token is read only in the job that writes": a job reads the token when its text names the secret that holds it, and the jobs that write are the ones of the environment `agent-m-write`, the one scope the token has (`gitlabVariableScopes`); an agent is run by the entries
//     `chooseAgentKey`, `onRecordsChanged`, `onDispatch` and `leaveResult`.
//   - The product has the default route only (no self-hosted runner), so that one job writes and the entry is run once for a pipeline.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startRecord } from "../src/job-ledger/index.mjs";
import { gitlabVariableScopes, jobWorkflowFiles } from "../src/runtimes/index.mjs";
import { runEntry } from "../src/workflow-entries/main.mjs";
import { GITLAB, GITLAB_TOKEN, NOW, PUSHED_AT, fakeGitLab, withCheckout as checkout } from "./workflow-entries-pull-request-world.mjs";

const FIX = "JOB-20261029-1000-a1b2", OTHER = "JOB-20261029-1004-e5f6";
const record = (id, kind, worksOn) => startRecord({ id, kind, worksOn, participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-29T09:00:00Z"),
  agentM: { version: "unreleased", commit: "f".repeat(40) }, inputs: [], limit: 2, destinations: [{ participant: "ci-bot", place: "GitLab's hosted runners", parts: [] }], params: {} });
const issue = (number) => `${GITLAB}/-/issues/${number}`;
// The jobs of the product: a bug fix working on the issues 12 and 13, and the bug fix of another merge request working on the issue 99.
const withCheckout = (body) => checkout([record(FIX, "fix-bug", [issue(12), issue(13)]), record(OTHER, "fix-bug", [issue(99)])], body);
const mergeRequest = (iid, job, merge, target = "main") => ({ iid, title: job ? `${job}: fix-bug` : "Reword the README", description: job ? `Job: ${job}\nKind: fix-bug` : "", source_branch: job ?? "readme", target_branch: target, sha: String(iid).repeat(40), merge_commit_sha: merge });
const COMMIT = (n) => String(n).repeat(40);
const SPRINT = "sprint/team1/120";

// ---------------------------------------------------------------- the pipelines of the generated file

const TOKEN_SECRET = "PERSON_TOKEN", KEY_SECRET = "CLAUDE_KEY";
const fileOf = (runners = []) => jobWorkflowFiles("gitlab", { repository: "alice/agent-m", commit: "0".repeat(40) }, { token: TOKEN_SECRET, keys: [KEY_SECRET] }, runners)[0].text;
const FILE = fileOf();
const jobsOf = (text) => text.split(/\n(?=[A-Za-z0-9_-]+:\n)/).filter((block) => /^agent-m-/.test(block)).map((block) => ({ id: /^([A-Za-z0-9_-]+):/.exec(block)[1], text: block }));
const rulesOf = (job) => job.text.slice(0, job.text.indexOf("\n  script:")).split(/\n(?=    - if:)/).slice(1).map((rule) => ({
  expression: /^    - if: '(.*)'/.exec(rule)[1],
  changes: [...(/\n      changes:\n((?:        - .*\n?)+)/.exec(rule)?.[1] ?? "").matchAll(/- (.+)/g)].map((each) => each[1]),
  variables: Object.fromEntries([...rule.matchAll(/^ {8}(AGENT_M_[A-Z_]+): (\S+)$/gm)].map((each) => [each[1], each[2]])),
}));
const valueOf = (side, variables) => (side.startsWith("$") ? variables[side.slice(1)] ?? null : JSON.parse(side));
const holds = (expression, variables) => expression.split("||").some((any) => any.split("&&").every((comparison) => {
  const [left, right] = comparison.split("==").map((side) => side.trim());
  return valueOf(left, variables) === valueOf(right, variables);
}));
const matches = (glob, path) => new RegExp(`^${glob.replace(/\./g, "\\.").replace(/\*\*\/\*/g, ".*")}$`).test(path);
/** The entries a job's script runs, in order, for these variables: the lines of its script that run `main.mjs`, run by `sh` in a folder that has the instance beside it, `node` naming the entry it is given. */
function entriesOf(job, variables) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-script-"));
  try {
    mkdirSync(join(root, "product")); mkdirSync(join(root, "instance"));
    const lines = job.text.slice(job.text.indexOf("\n  script:\n")).split("\n").filter((line) => /^    - .*main\.mjs/.test(line)).map((line) => line.slice(6));
    const run = spawnSync("sh", ["-c", `node() { printf '%s\\n' "$2"; }\n${lines.join("\n")}`], { cwd: join(root, "product"), env: { PATH: process.env.PATH, ...variables }, encoding: "utf8" });
    return run.stdout.split("\n").filter(Boolean);
  } finally { rmSync(root, { recursive: true, force: true }); }
}
/** The jobs GitLab starts for a pipeline with these variables whose push changed these paths, each with the entries its script runs: [{ id, text, variables, entries }]. */
function started(variables, changed = [], text = FILE) {
  return jobsOf(text).flatMap((job) => {
    const rule = rulesOf(job).find((each) => holds(each.expression, variables) && (each.changes.length === 0 || changed.some((path) => each.changes.some((glob) => matches(glob, path)))));
    return rule ? [{ id: job.id, text: job.text, variables: { ...variables, ...rule.variables }, entries: entriesOf(job, { ...variables, ...rule.variables }) }] : [];
  });
}
const AGENT_ENTRIES = ["chooseAgentKey", "onRecordsChanged", "onDispatch", "leaveResult"];
const isWriter = (job) => /\n  environment:\n    name: agent-m-write\n/.test(job.text);
const runsAgent = (job) => job.entries.some((entry) => AGENT_ENTRIES.includes(entry));
const push = (branch, extra = {}) => ({ CI_PIPELINE_SOURCE: "push", CI_COMMIT_BRANCH: branch, CI_DEFAULT_BRANCH: "main", CI_PROJECT_DIR: "/builds/product", ...extra });
const OPEN_REQUEST = { CI_PIPELINE_SOURCE: "merge_request_event", CI_DEFAULT_BRANCH: "main", CI_MERGE_REQUEST_IID: "7", CI_PROJECT_DIR: "/builds/product" };
const SCHEDULE = { CI_PIPELINE_SOURCE: "schedule", CI_COMMIT_BRANCH: "main", CI_DEFAULT_BRANCH: "main", CI_PROJECT_DIR: "/builds/product" };
const RECORDS = ["docs/jobs/JOB-20261029-1000-a1b2.md", "src/store/read.mjs"];

/** The entries of the writing job of a pipeline, each run for real in the checkout `w` over `server`, as the job runs it: in order, with the person's token and the commit `sha` of the push on `branch`. -> [{ entry, status }] */
async function runWriter(w, server, job, { branch, sha }) {
  const real = globalThis.fetch;
  globalThis.fetch = server.fetch;
  try {
    const ran = [];
    for (const entry of job.entries) {
      const status = await runEntry(entry, { GITLAB_CI: "true", CI_PIPELINE_SOURCE: job.variables.CI_PIPELINE_SOURCE, CI_PROJECT_DIR: w.product, CI_PROJECT_URL: GITLAB, CI_COMMIT_REF_NAME: branch, CI_COMMIT_BRANCH: branch, CI_COMMIT_SHA: sha,
        CI_COMMIT_TIMESTAMP: PUSHED_AT, CI_PIPELINE_URL: `${GITLAB}/-/pipelines/4711`, GITLAB_USER_LOGIN: "alice", AGENT_M_RUNNER: "hosted", AGENT_M_PART: "write", AGENT_M_PRODUCT_DIR: w.product,
        AGENT_M_RESULT_DIR: join(w.root, "no-result"), AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", AGENT_M_TOKEN: GITLAB_TOKEN }, { now: NOW });
      ran.push({ entry, status });
    }
    return ran;
  } finally { globalThis.fetch = real; }
}
const noted = (number, merge) => [["POST", `/issues/${number}/notes`, { body: `Closed with ${GITLAB}/-/merge_requests/${merge}.` }], ["PUT", `/issues/${number}`, { state_event: "close" }]];

// TST-1289301 · level: release · module: MOD-runtimes, MOD-workflow-entries
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// given: UC-012 step 5 on a GitLab product. the job workflow generated for it; the merge request !7 of the job JOB-20261029-1000-a1b2 (fix-bug, working on the issues 12 and 13), merged into main by the commit 3…, and !6 of another job (the issue 99), merged earlier; known positive first — a push to main that changes docs/jobs/ starts the job that writes with the entry writeResult first
// input: the pipeline of the push to main whose commit changes docs/jobs/JOB-20261029-1000-a1b2.md and src/store/read.mjs; the entries of every job it starts, and the writing job's entries run in order over the fake GitLab, which lists the merged merge requests
// expect: the job that writes runs writeResult and then onPullRequestClosed, the first ending `nothing to do` (the agent's machine left no result), the second `done` with #12 and #13 and the merge request's address in its summary; the issues 12 and 13 are each noted "Closed with <the merge request's address>." and then closed, with the person's token, in this order, and the issue 99 of !6 is not touched; the agent's jobs run onRecordsChanged and not onPullRequestClosed, so that the merge closes its issues once
// Planted fault: the job that writes not running the entry after writeResult (the script line `if [ "$CI_PIPELINE_SOURCE" = "push" ] && [ "$AGENT_M_ENTRY" = "writeResult" ]; then … onPullRequestClosed …; fi` removed from src/runtimes/workflow/gitlab.yml) leaves the issues open, and the case fails on the entries of the writing job.
test("TST-1289301 a merge into the default branch that changes the records runs writeResult and then onPullRequestClosed, and closes and notes the issues the merge request names", async () => {
  const pipeline = started(push("main"), RECORDS);
  assert.equal(started(push("main"), ["docs/jobs/JOB-20261029-1000-a1b2.md"]).find(isWriter)?.entries[0], "writeResult", "known positive: a push of job records starts the job that writes with writeResult");
  const writers = pipeline.filter(isWriter);
  assert.equal(writers.length, 1, "one job writes");
  assert.deepEqual(writers[0].entries, ["writeResult", "onPullRequestClosed"]);
  assert.deepEqual(pipeline.filter((job) => !isWriter(job)).flatMap((job) => job.entries).filter((entry) => entry === "onPullRequestClosed"), [], "no job but the one that writes runs it");
  assert.ok(pipeline.filter((job) => !isWriter(job)).some((job) => job.entries.includes("onRecordsChanged")), "the agent's job still runs onRecordsChanged");

  await withCheckout(async (w) => {
    const server = fakeGitLab({ mergeRequests: [mergeRequest(6, OTHER, COMMIT(5)), mergeRequest(7, FIX, COMMIT(3))] });
    const ran = await runWriter(w, server, writers[0], { branch: "main", sha: COMMIT(3) });
    assert.deepEqual(ran.map(({ entry, status }) => [entry, status.outcome]), [["writeResult", "nothing to do"], ["onPullRequestClosed", "done"]]);
    assert.match(ran[1].status.summary, /#12/);
    assert.match(ran[1].status.summary, /#13/);
    assert.ok(ran[1].status.summary.includes(`${GITLAB}/-/merge_requests/7`), ran[1].status.summary);
    assert.deepEqual(server.writes(), [...noted(12, 7), ...noted(13, 7)]);
    for (const each of server.requests) assert.equal(each.authorization, GITLAB_TOKEN, `${each.method} ${each.path} carried the person's token`);
  });
});

// TST-1289302 · level: release · module: MOD-runtimes, MOD-workflow-entries
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// given: the job workflow generated for a GitLab product; the merge request !7 of the job JOB-20261029-1000-a1b2 (fix-bug, working on the issues 12 and 13) merged into the branch sprint/team1/120, not the default branch main, by the commit 3…; known positive first — the same merge request merged into main starts the job that writes with onPullRequestClosed
// input: the pipeline of the push to sprint/team1/120 whose commit changes src/store/read.mjs; the entries of every job it starts, and the writing job's entry run over the fake GitLab, which lists !7 as merged with the target sprint/team1/120
// expect: the pipeline starts the job that writes alone — no plan and no agent's job — and it runs onPullRequestClosed and nothing else; the entry ends `done` with #12 and #13 in its summary, and the issues 12 and 13 are each noted "Closed with <the merge request's address>." and then closed, with the person's token
// Planted fault: the rule for onPullRequestClosed taken back to the default branch (`&& $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH` added to the rule `$CI_PIPELINE_SOURCE == "push"` of the job that writes in src/runtimes/workflow/gitlab.yml, as before ITM-1289) starts no job on the push to the sprint branch, and the case fails on the jobs the pipeline starts.
test("TST-1289302 a merge into a branch other than the default one runs onPullRequestClosed, and closes and notes the issues the merge request names", async () => {
  assert.deepEqual(started(push("main"), ["src/store/read.mjs"]).filter(isWriter).map((job) => job.entries), [["onPullRequestClosed"]], "known positive: a merge into main");
  const pipeline = started(push(SPRINT), ["src/store/read.mjs"]);
  assert.deepEqual(pipeline.map((job) => [isWriter(job), job.entries]), [[true, ["onPullRequestClosed"]]], "only the job that writes starts, with onPullRequestClosed alone");

  await withCheckout(async (w) => {
    const server = fakeGitLab({ mergeRequests: [mergeRequest(7, FIX, COMMIT(3), SPRINT)] });
    const ran = await runWriter(w, server, pipeline[0], { branch: SPRINT, sha: COMMIT(3) });
    assert.deepEqual(ran.map(({ entry, status }) => [entry, status.outcome]), [["onPullRequestClosed", "done"]]);
    assert.match(ran[0].status.summary, /#12/);
    assert.match(ran[0].status.summary, /#13/);
    assert.deepEqual(server.writes(), [...noted(12, 7), ...noted(13, 7)]);
    for (const each of server.requests) assert.equal(each.authorization, GITLAB_TOKEN, `${each.method} ${each.path} carried the person's token`);
  });
});

// TST-1289303 · level: release · module: MOD-runtimes, MOD-workflow-entries
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-012
// given: the job workflow generated for a GitLab product; the merge request !7 of the job JOB-20261029-1000-a1b2 (fix-bug, working on the issues 12 and 13) merged into main by the commit 3…, whose commit changes code alone; and, as a counter-proof, a commit pushed to main directly (9…) that no merge request merged
// input: the pipeline of the push to main whose commit changes src/store/read.mjs and nothing under docs/jobs/ or docs/gates/; the entries of every job it starts, and the writing job's entry run over the fake GitLab for the merge (3…) and for the direct push (9…)
// expect: the job that writes runs onPullRequestClosed and not writeResult, and the pipeline starts no plan and no agent's job; the entry for 3… ends `done`, the issues 12 and 13 each noted and then closed; the entry for 9… ends `nothing to do`, naming that no merge request was merged by the commit, and writes nothing
// Planted fault: the rule for onPullRequestClosed made to start only on a push that changes the records (`changes:` docs/jobs/ and docs/gates/ added to the rule `$CI_PIPELINE_SOURCE == "push"` of the job that writes in src/runtimes/workflow/gitlab.yml) starts no job on a push of code alone, and the case fails on the jobs the pipeline starts.
test("TST-1289303 a merge that changes code alone runs onPullRequestClosed and closes and notes the issues, a push that merged nothing writes nothing", async () => {
  const pipeline = started(push("main"), ["src/store/read.mjs"]);
  assert.deepEqual(pipeline.map((job) => [isWriter(job), job.entries]), [[true, ["onPullRequestClosed"]]], "the job that writes alone, without writeResult");

  await withCheckout(async (w) => {
    const server = fakeGitLab({ mergeRequests: [mergeRequest(7, FIX, COMMIT(3))] });
    const ran = await runWriter(w, server, pipeline[0], { branch: "main", sha: COMMIT(3) });
    assert.deepEqual(ran.map(({ entry, status }) => [entry, status.outcome]), [["onPullRequestClosed", "done"]]);
    assert.deepEqual(server.writes(), [...noted(12, 7), ...noted(13, 7)]);

    const direct = fakeGitLab({ mergeRequests: [mergeRequest(7, FIX, COMMIT(3))] });
    const pushed = await runWriter(w, direct, pipeline[0], { branch: "main", sha: COMMIT(9) });
    assert.deepEqual(pushed.map(({ entry, status }) => [entry, status.outcome]), [["onPullRequestClosed", "nothing to do"]]);
    assert.match(pushed[0].status.summary, /no merge request/i);
    assert.deepEqual(direct.writes(), [], "a push that no merge request merged writes nothing");
  });
});

// TST-1289304 · level: release · module: MOD-runtimes, MOD-workflow-entries
// guards: GITLAB PRODUCTS ARE SUPPORTED; A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; UC-012
// given: the job workflow generated for a GitLab product; the merge request !7 of the job JOB-20261029-1000-a1b2 (fix-bug, working on the issues 12 and 13), still open, with its own pipeline (source merge_request_event, no branch) and the push pipeline of its source branch; known positive first — the pipeline of a merge starts the job that writes
// input: the pipeline of !7 while it is open, once for a change of code and once for a change that also touches docs/jobs/ and docs/gates/; and the push pipeline of !7's source branch, its entry run over the fake GitLab, which lists no merged merge request
// expect: the open merge request's own pipeline starts no job at all, whatever it changes — so that no job that writes, none that reads the token, none that runs an agent starts on it —; the push to its source branch starts the job that writes with onPullRequestClosed alone, which ends `nothing to do` and writes nothing, the issues 12 and 13 untouched
// Planted fault: a rule for the open merge request's pipeline (`- if: '$CI_PIPELINE_SOURCE == "merge_request_event"'` setting AGENT_M_ENTRY: onPullRequestClosed, added to the job that writes in src/runtimes/workflow/gitlab.yml, as before ITM-1259) starts the job that writes on the open merge request, and the case fails on the jobs its pipeline starts.
test("TST-1289304 an open merge request's own pipeline starts no job, and the push to its branch closes no issue", async () => {
  assert.equal(started(push("main"), ["src/store/read.mjs"]).filter(isWriter).length, 1, "known positive: the merge starts the job that writes");
  assert.deepEqual(started(OPEN_REQUEST, ["src/store/read.mjs"]), [], "an open merge request's pipeline starts no job");
  assert.deepEqual(started(OPEN_REQUEST, ["docs/jobs/JOB-20261029-1000-a1b2.md", "docs/gates/20261029-1000-gate-aaaa.md", "src/store/read.mjs"]), [], "nor when it changes the records");

  const branch = started(push(FIX), ["src/store/read.mjs"]);
  assert.deepEqual(branch.map((job) => [isWriter(job), job.entries]), [[true, ["onPullRequestClosed"]]]);
  await withCheckout(async (w) => {
    const server = fakeGitLab({ mergeRequests: [] });
    const ran = await runWriter(w, server, branch[0], { branch: FIX, sha: COMMIT(7) });
    assert.deepEqual(ran.map(({ entry, status }) => [entry, status.outcome]), [["onPullRequestClosed", "nothing to do"]]);
    assert.deepEqual(server.writes(), [], "the issues 12 and 13 are untouched");
  });
});

// TST-1289305 · level: release · module: MOD-runtimes
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-010
// given: the job workflow generated for a GitLab product, with the default route and with the default route and the runner gpu; MOD-runtimes' table: `onSchedule` for "a schedule, once a day"; known positive first — the pipeline of a push to main that changes the records starts the plan and the agent's jobs
// input: the pipeline of the schedule on main, for each of the two files
// expect: the schedule starts the jobs that write and no other — no plan, no agent's job —, each running onSchedule and nothing else: neither writeResult nor onPullRequestClosed, so that the schedule closes no merge request's issues
// Planted fault: the schedule's rule made to set the entry onPullRequestClosed (`AGENT_M_ENTRY: onSchedule` taken as `AGENT_M_ENTRY: onPullRequestClosed` in the rule `$CI_PIPELINE_SOURCE == "schedule"` of the job that writes in src/runtimes/workflow/gitlab.yml) runs it on the schedule, and the case fails on the entries of the job that writes.
test("TST-1289305 the schedule runs onSchedule alone, in the jobs that write and in no other", () => {
  assert.ok(started(push("main"), RECORDS).some((job) => job.entries.includes("chooseAgentKey")) && started(push("main"), RECORDS).some((job) => job.entries.includes("onRecordsChanged")), "known positive: a push of records starts the plan and the agent's jobs");
  for (const runners of [[], ["gpu"]]) {
    const pipeline = started(SCHEDULE, [], fileOf(runners));
    assert.equal(pipeline.length, 1 + runners.length, `one job that writes for each route, with ${runners.length} runner(s)`);
    for (const job of pipeline) {
      assert.ok(isWriter(job), `${job.id} writes`);
      assert.deepEqual(job.entries, ["onSchedule"], job.id);
    }
  }
});

// TST-1289306 · level: release · module: MOD-runtimes
// guards: A HOSTED JOB WRITES WITH THE PERSON'S TOKEN FROM A CI SECRET; GITLAB PRODUCTS ARE SUPPORTED
// given: the job workflow generated for a GitLab product whose token is the secret PERSON_TOKEN and whose one agent key is CLAUDE_KEY, with the default route and with the runner gpu; the scopes `gitlabVariableScopes` names for the token (agent-m-write alone) and the key; known positive first — the job that writes names the token
// input: every job of the file, and the pipelines of a push to main that changes the records, of a push to main that changes code, of a push to the sprint branch (the pipeline a merge into another branch starts), of an open merge request, of the schedule, and of a start from the page (web) and from the API
// expect: the jobs that name PERSON_TOKEN are the jobs of the environment agent-m-write, which `gitlabVariableScopes` gives the token alone, and no plan and no agent's job names it or has that environment; the jobs of the environment agent-m-key-CLAUDE_KEY, the scope of the key besides agent-m-write, are agent's jobs; in no pipeline does a job that names the token run an entry that runs an agent (chooseAgentKey, onRecordsChanged, onDispatch, leaveResult), and the push to the sprint branch and the schedule start no job of the key's environment
// Planted fault: the plan job given the token's name (`AGENT_M_TOKEN_NAME: "@@token@@"` added to the variables of the plan in src/runtimes/workflow/gitlab.yml) lets a job that runs an agent name the token, and the case fails on the jobs that name PERSON_TOKEN.
test("TST-1289306 the token is named only by the jobs that write, which run no agent, and the push of another branch starts no job of a key's environment", () => {
  const scopes = gitlabVariableScopes({ token: TOKEN_SECRET, keys: [KEY_SECRET] });
  assert.deepEqual(scopes, [{ name: TOKEN_SECRET, scopes: ["agent-m-write"] }, { name: KEY_SECRET, scopes: ["agent-m-key-CLAUDE_KEY", "agent-m-write"] }], "the scopes the file's variables have");

  for (const runners of [[], ["gpu"]]) {
    const text = fileOf(runners), jobs = jobsOf(text);
    const naming = (name) => jobs.filter((job) => job.text.includes(name));
    assert.ok(naming(TOKEN_SECRET).length >= 1, `known positive: a job names ${TOKEN_SECRET}`);
    assert.deepEqual(naming(TOKEN_SECRET).map((job) => job.id), jobs.filter(isWriter).map((job) => job.id), "the jobs that name the token are the jobs of its one scope");
    for (const job of jobs.filter((each) => /-(?:plan|agent-\d+)$/.test(each.id))) assert.ok(!isWriter(job) && !job.text.includes(TOKEN_SECRET), `${job.id}: no token, no scope of the token`);
    const ofKey = jobs.filter((job) => job.text.includes("name: agent-m-key-CLAUDE_KEY\n"));
    assert.ok(ofKey.length >= 1 && ofKey.every((job) => /-agent-\d+$/.test(job.id)), "known positive: the key's scope is the environment of an agent's job alone");

    const pipelines = {
      "records on main": started(push("main"), RECORDS, text), "code on main": started(push("main"), ["src/store/read.mjs"], text), "sprint branch": started(push(SPRINT), ["src/store/read.mjs"], text),
      "open merge request": started(OPEN_REQUEST, RECORDS, text), schedule: started(SCHEDULE, [], text),
      web: started({ ...push("main"), CI_PIPELINE_SOURCE: "web" }, [], text), api: started({ ...push("main"), CI_PIPELINE_SOURCE: "api" }, [], text),
    };
    for (const [name, pipeline] of Object.entries(pipelines)) {
      for (const job of pipeline.filter((each) => each.text.includes(TOKEN_SECRET))) assert.ok(!runsAgent(job), `${name}: ${job.id} names the token and runs ${job.entries}`);
    }
    for (const name of ["sprint branch", "schedule", "open merge request"]) assert.deepEqual(pipelines[name].filter((job) => ofKey.some((each) => each.id === job.id)), [], `${name}: no job of the key's environment starts`);
    assert.ok(pipelines["records on main"].some(runsAgent), "known positive: the push of records starts a job that runs an agent");
  }
});
