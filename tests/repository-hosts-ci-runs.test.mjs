// MOD-repository-hosts' listCiRuns, cancelCiRun and ciRunLog (ITM-546), as the accepted text of docs/architecture/MOD-repository-hosts.md states them:
// "listCiRuns(filter: { commit?: string, branch?: string, workflow?: string }) -> Promise<CiRun[]> — the GitHub Actions runs or GitLab pipelines. Crosses the network;
// fails as `readSnapshot`." · "cancelCiRun(id: string) -> Promise<void> — asks the server to cancel a run; the run's state shows when it has. Crosses the network; fails as
// `startWorkflow`." · "ciRunLog(id: string) -> Promise<string | null> — the run's log, or `null` when the server no longer keeps it. Crosses the network; fails as `readSnapshot`."
// · "`connect` … every other function uses the REST adapter where a token is given, or throws `NotSupported`." · "CiRun — { id: string, workflow: string, commit: string,
// event: string, state: "queued" | "running" | "waiting" | "success" | "failure" | "cancelled" | "skipped", url: string, started: string | null, ended: string | null }."
// Deterministic, no network: the servers are fakes of `fetch` answering as the real APIs document — GitHub (docs.github.com/en/rest/actions/workflow-runs): "List workflow runs
// for a repository" (GET /repos/{owner}/{repo}/actions/runs; query branch, head_sha, per_page, page; the answer's workflow_runs), "List workflow runs for a workflow" (GET
// /repos/{owner}/{repo}/actions/workflows/{workflow_id}/runs, same query), "Cancel a workflow run" (POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel; 202; 409 for a
// run that cannot be cancelled), "Get a workflow run"; docs.github.com/en/rest/actions/workflow-jobs: "List jobs for a workflow run" (GET …/actions/runs/{run_id}/jobs; the
// answer's jobs), "Download job logs for a workflow run" (GET …/actions/jobs/{job_id}/logs; 302 to the log's text); the run's status queued, in_progress, completed, waiting,
// requested, pending and its conclusion success, failure, neutral, cancelled, skipped, timed_out, action_required, stale, startup_failure. GitLab (docs.gitlab.com/api/pipelines,
// docs.gitlab.com/api/jobs): "List project pipelines" (GET /projects/:id/pipelines; ref, sha, per_page, page), "Cancel a pipeline's jobs" (POST /projects/:id/pipelines/:pipeline_id/cancel;
// answers the pipeline), "List pipeline jobs" (GET /projects/:id/pipelines/:pipeline_id/jobs), "Get a log file" (GET /projects/:id/jobs/:job_id/trace).
// Run: node --test tests/repository-hosts-ci-runs.test.mjs
//
// Module: MOD-repository-hosts
// Guards: UC-049; ONE DASHBOARD SHOWS EVERY JOB; A CANCELLED JOB WRITES NOTHING MORE; A REMOTE INTERFACE NAMES HOW IT FAILS; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; A CREDENTIAL IS NEVER PLACED IN A URL
// Level: unit
//
// The readings the item ITM-546 settles, each from the sentence it quotes; a test states the reading it takes:
//   - GitHub's run is { id: String(id), workflow: the last part of `path`, commit: head_sha, event, url: html_url, started: run_started_at, ended: updated_at once the run is
//     completed, else null }; `waiting` is waiting, `in_progress` running, `queued`, `requested` and `pending` queued, a completed run takes its conclusion — success, cancelled and
//     skipped as named, every other conclusion failure.
//   - GitLab's run is the pipeline as startWorkflow maps it (id, sha, source else "api", status through the adapter's table, web_url, started_at, finished_at); `workflow` is the
//     filter's workflow, or "" without one, and narrows nothing: no request carries it.
//   - cancelCiRun on GitHub: a 409 for a run that is completed returns; a 409 for a run that is not, and every other refusal, is the adapter's refusal. On GitLab the answer is the pipeline.
//   - ciRunLog is the texts of the jobs in the order the server lists them, each preceded by a line with the job's name, each text ending in a line break; a job whose log is answered
//     404 or 410 has no text; null where no job has one — a run with no job included; a run the server does not know is NotFound; any other failure of a request, a log's included, is the call's.
//   - Through a clone each of the three uses the REST adapter where a token is given, and otherwise throws NotSupported with no request.
// Each test states its input and its expected values in its own text (given / input / expect), with a known positive beside each failure. Every request goes through a recorder
// that stands in for fetch (`serving`). A name the module does not provide yet fails each test by itself. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { parseAddress, connect } from "../src/repository-hosts/index.mjs";

const GH_TOKEN = "github_pat_CAROLsprintTOOL0123456789abcdef";
const GL_TOKEN = "glpat-SPACEsprintTOOLvalue0123456789";
const GITHUB = parseAddress("https://github.com/carol/sprint-tool");
const GITLAB = parseAddress("https://gitlab.example.org/space/sprint-tool");
const GH = "/repos/carol/sprint-tool";
const GL = "/api/v4/projects/space%2Fsprint-tool";
const SHA = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

function seen(input, init = {}) {
  const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
  const raw = init.headers ?? {};
  const headers = raw instanceof Headers ? Object.fromEntries(raw.entries()) : Object.fromEntries(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), String(v)]));
  return { method: String(init.method ?? "GET").toUpperCase(), href: url.href, host: url.host, path: url.pathname, query: url.searchParams, headers };
}
const json = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
const text = (status, body) => new Response(body, { status, headers: { "Content-Type": "text/plain" } });
async function serving(answer, run) {
  const requests = [], real = globalThis.fetch;
  globalThis.fetch = async (input, init) => { const r = seen(input, init); requests.push(r); return answer(r); };
  try { return { result: await run(), requests }; } finally { globalThis.fetch = real; }
}
const failure = (p) => Promise.resolve(p).then(() => null, (e) => e);
const lines = (requests) => requests.map((r) => `${r.method} ${r.path}`);

// ---------------------------------------------------------------- fixtures: GitHub

const ghRun = (id, more = {}) => ({ id, name: "Agent M jobs", path: ".github/workflows/agent-m-jobs.yml", head_sha: SHA, event: "workflow_dispatch", status: "completed",
  conclusion: "success", html_url: `https://github.com/carol/sprint-tool/actions/runs/${id}`, run_started_at: "2026-10-16T08:00:00Z", updated_at: "2026-10-16T08:05:00Z", ...more });
// A GitHub whose run lists are answered by `runs(path, query)` with an array of runs, the whole page 1 of it unless the list has more than 100 (then by `page`).
const ghLists = (runs) => (r) => {
  if (r.path === `${GH}/actions/runs` || /^\/repos\/carol\/sprint-tool\/actions\/workflows\/[^/]+\/runs$/.test(r.path)) {
    const all = runs(r.path, r.query), page = Number(r.query.get("page")), per = Number(r.query.get("per_page"));
    return json(200, { total_count: all.length, workflow_runs: all.slice((page - 1) * per, page * per) });
  }
  return json(404, { message: `unrouted request: ${r.method} ${r.href}` });
};
const WORKFLOW_RUNS = `${GH}/actions/workflows/agent-m-jobs.yml/runs`;

// ---------------------------------------------------------------- fixtures: GitLab

const glPipeline = (id, more = {}) => ({ id, iid: id - 40, project_id: 3, sha: SHA, ref: "main", status: "success", source: "push", created_at: "2026-10-16T08:00:00Z",
  updated_at: "2026-10-16T08:05:00Z", web_url: `https://gitlab.example.org/space/sprint-tool/-/pipelines/${id}`, ...more });
const glLists = (pipelines) => (r) => {
  if (r.path === `${GL}/pipelines`) {
    const all = pipelines(r.query), page = Number(r.query.get("page")), per = Number(r.query.get("per_page"));
    return json(200, all.slice((page - 1) * per, page * per));
  }
  return json(404, { message: `unrouted request: ${r.method} ${r.href}` });
};

// ---------------------------------------------------------------- listCiRuns

// TST-546001 · level: unit · module: MOD-repository-hosts
// guards: UC-049; ONE DASHBOARD SHOWS EVERY JOB; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a GitHub repository with the person's token; the server lists two runs of the repository — a completed successful run of agent-m-jobs.yml started by workflow_dispatch, and an in_progress run of tests.yml started by push
// input: listCiRuns({})
// expect: one request, GET the repository's actions/runs with per_page 100 and page 1 and no other query, the token as a Bearer header and in no address; the two runs as CiRuns — run 9001: id "9001", workflow "agent-m-jobs.yml", commit SHA, event "workflow_dispatch", state "success", url its html_url, started "2026-10-16T08:00:00Z", ended "2026-10-16T08:05:00Z"; run 9002: id "9002", workflow "tests.yml", event "push", state "running", started "2026-10-16T08:10:00Z", ended null (it has not completed)
test("listCiRuns on GitHub — the repository's runs as CiRuns, with the id as a text, the file name of the workflow, and no end for a run that has not completed", async () => {
  const { result, requests } = await serving(ghLists(() => [ghRun(9001),
    ghRun(9002, { path: ".github/workflows/tests.yml", event: "push", status: "in_progress", conclusion: null, run_started_at: "2026-10-16T08:10:00Z", updated_at: "2026-10-16T08:11:00Z" })]),
  () => connect(GITHUB, { token: GH_TOKEN }).listCiRuns({}));
  assert.deepEqual(requests.map((r) => [r.method, r.path, [...r.query.keys()].sort(), r.query.get("per_page"), r.query.get("page")]),
    [["GET", `${GH}/actions/runs`, ["page", "per_page"], "100", "1"]]);
  assert.equal(requests[0].headers.authorization, `Bearer ${GH_TOKEN}`);
  assert.equal(requests[0].href.includes(GH_TOKEN), false);
  assert.deepEqual(result, [
    { id: "9001", workflow: "agent-m-jobs.yml", commit: SHA, event: "workflow_dispatch", state: "success", url: "https://github.com/carol/sprint-tool/actions/runs/9001",
      started: "2026-10-16T08:00:00Z", ended: "2026-10-16T08:05:00Z" },
    { id: "9002", workflow: "tests.yml", commit: SHA, event: "push", state: "running", url: "https://github.com/carol/sprint-tool/actions/runs/9002",
      started: "2026-10-16T08:10:00Z", ended: null }]);
});

// TST-546002 · level: unit · module: MOD-repository-hosts
// guards: UC-049; ONE DASHBOARD SHOWS EVERY JOB
// given: a GitHub repository and a GitLab project, each with 101 runs, 100 on the first page and 1 on the second
// input: listCiRuns({}) on each
// expect: 101 runs in the server's order — the ids "1" to "101" on GitHub, "1001" to "1101" on GitLab; the requests page=1 then page=2 (per_page=100), nothing after; a list with 100 on its last page is followed by one more request that answers empty
test("listCiRuns reads the list page by page, on each server", async () => {
  const gh = await serving(ghLists(() => Array.from({ length: 101 }, (_, i) => ghRun(i + 1))), () => connect(GITHUB, { token: GH_TOKEN }).listCiRuns({}));
  assert.equal(gh.result.length, 101);
  assert.deepEqual([gh.result[0].id, gh.result[100].id], ["1", "101"]);
  assert.deepEqual(gh.requests.map((r) => [r.path, r.query.get("per_page"), r.query.get("page")]), [[`${GH}/actions/runs`, "100", "1"], [`${GH}/actions/runs`, "100", "2"]]);
  const gl = await serving(glLists(() => Array.from({ length: 101 }, (_, i) => glPipeline(1001 + i))), () => connect(GITLAB, { token: GL_TOKEN }).listCiRuns({}));
  assert.equal(gl.result.length, 101);
  assert.deepEqual([gl.result[0].id, gl.result[100].id], ["1001", "1101"]);
  assert.deepEqual(gl.requests.map((r) => [r.path, r.query.get("per_page"), r.query.get("page")]), [[`${GL}/pipelines`, "100", "1"], [`${GL}/pipelines`, "100", "2"]]);
  const full = await serving(ghLists(() => Array.from({ length: 100 }, (_, i) => ghRun(i + 1))), () => connect(GITHUB, { token: GH_TOKEN }).listCiRuns({}));
  assert.equal(full.result.length, 100);
  assert.deepEqual(full.requests.map((r) => r.query.get("page")), ["1", "2"]);
});

// TST-546003 · level: unit · module: MOD-repository-hosts
// guards: UC-049; ONE DASHBOARD SHOWS EVERY JOB
// given: a GitHub repository with a token; the server answers any list of runs with one run of agent-m-jobs.yml
// input: listCiRuns with { workflow: "agent-m-jobs.yml", branch: "main", commit: SHA }; with { branch: "main" } alone; with { commit: SHA } alone; with { workflow: "agent-m-jobs.yml" } alone
// expect: with a workflow, the one request goes to …/actions/workflows/agent-m-jobs.yml/runs, otherwise to …/actions/runs; the branch is sent as `branch` and the commit as `head_sha`, each only where given (query keys: branch, head_sha, page, per_page — and only those named by the filter); every run keeps its workflow "agent-m-jobs.yml"
test("listCiRuns on GitHub — a workflow chooses the workflow's own list; the branch is sent as branch and the commit as head_sha", async () => {
  const ask = async (filter) => serving(ghLists(() => [ghRun(9001)]), () => connect(GITHUB, { token: GH_TOKEN }).listCiRuns(filter));
  const shape = ({ requests, result }) => [requests.map((r) => [r.path, [...r.query.keys()].sort(), r.query.get("branch"), r.query.get("head_sha")]), result.map((run) => run.workflow)];
  assert.deepEqual(shape(await ask({ workflow: "agent-m-jobs.yml", branch: "main", commit: SHA })),
    [[[WORKFLOW_RUNS, ["branch", "head_sha", "page", "per_page"], "main", SHA]], ["agent-m-jobs.yml"]]);
  assert.deepEqual(shape(await ask({ branch: "main" })), [[[`${GH}/actions/runs`, ["branch", "page", "per_page"], "main", null]], ["agent-m-jobs.yml"]]);
  assert.deepEqual(shape(await ask({ commit: SHA })), [[[`${GH}/actions/runs`, ["head_sha", "page", "per_page"], null, SHA]], ["agent-m-jobs.yml"]]);
  assert.deepEqual(shape(await ask({ workflow: "agent-m-jobs.yml" })), [[[WORKFLOW_RUNS, ["page", "per_page"], null, null]], ["agent-m-jobs.yml"]]);
  assert.deepEqual(shape(await ask(undefined)), [[[`${GH}/actions/runs`, ["page", "per_page"], null, null]], ["agent-m-jobs.yml"]]);
});

// TST-546004 · level: unit · module: MOD-repository-hosts
// guards: UC-049; ONE DASHBOARD SHOWS EVERY JOB
// given: GitHub runs in each status and conclusion: waiting; in_progress; queued; requested; pending; completed with success, cancelled, skipped, failure, timed_out, neutral, action_required, stale, startup_failure
// input: listCiRuns({}) on a host whose server lists them
// expect: state waiting for waiting; running for in_progress; queued for queued, requested and pending; success, cancelled and skipped for the completed runs with those conclusions; failure for the completed runs with failure, timed_out, neutral, action_required, stale and startup_failure; ended is the run's updated_at for each completed run and null for each other
test("listCiRuns on GitHub — a run's status is its state, a completed run's conclusion is its state, and only a completed run has an end", async () => {
  const table = [["waiting", null, "waiting"], ["in_progress", null, "running"], ["queued", null, "queued"], ["requested", null, "queued"], ["pending", null, "queued"],
    ["completed", "success", "success"], ["completed", "cancelled", "cancelled"], ["completed", "skipped", "skipped"], ["completed", "failure", "failure"],
    ["completed", "timed_out", "failure"], ["completed", "neutral", "failure"], ["completed", "action_required", "failure"], ["completed", "stale", "failure"],
    ["completed", "startup_failure", "failure"]];
  const { result } = await serving(ghLists(() => table.map(([status, conclusion], i) => ghRun(100 + i, { status, conclusion, updated_at: `2026-10-16T09:${String(10 + i)}:00Z` }))),
    () => connect(GITHUB, { token: GH_TOKEN }).listCiRuns({}));
  assert.deepEqual(result.map((run) => run.state), table.map(([, , state]) => state));
  assert.deepEqual(result.map((run) => run.ended), table.map(([status], i) => (status === "completed" ? `2026-10-16T09:${String(10 + i)}:00Z` : null)));
});

// TST-546005 · level: unit · module: MOD-repository-hosts
// guards: UC-049; ONE DASHBOARD SHOWS EVERY JOB; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a GitLab project with its access token; the server lists two pipelines — 61, successful, source push; 62, running, with no source, started 2026-10-16T08:10:00Z and finished 2026-10-16T08:12:00Z as the pipeline object states them
// input: listCiRuns({}); listCiRuns({ workflow: "agent-m-jobs.yml", branch: "main", commit: SHA })
// expect: the first call is one request, GET the project's pipelines with per_page 100 and page 1 and no other query, the token as PRIVATE-TOKEN and in no address, giving the runs with workflow "" — 61: id "61", commit SHA, event "push", state "success", url its web_url, started null, ended null; 62: id "62", event "api", state "running", started "2026-10-16T08:10:00Z", ended "2026-10-16T08:12:00Z"; the second call sends ref=main and sha=SHA and no workflow, no other query than page and per_page, and gives the same runs with workflow "agent-m-jobs.yml"
test("listCiRuns on GitLab — the project's pipelines as CiRuns; the branch is sent as ref and the commit as sha, and the workflow narrows nothing", async () => {
  const pipelines = () => [glPipeline(61), glPipeline(62, { status: "running", source: undefined, started_at: "2026-10-16T08:10:00Z", finished_at: "2026-10-16T08:12:00Z" })];
  const host = () => connect(GITLAB, { token: GL_TOKEN });
  const plain = await serving(glLists(pipelines), () => host().listCiRuns({}));
  assert.deepEqual(plain.requests.map((r) => [r.method, r.path, [...r.query.keys()].sort(), r.query.get("per_page"), r.query.get("page")]), [["GET", `${GL}/pipelines`, ["page", "per_page"], "100", "1"]]);
  assert.equal(plain.requests[0].headers["private-token"], GL_TOKEN);
  assert.equal(plain.requests[0].href.includes(GL_TOKEN), false);
  const run61 = { id: "61", workflow: "", commit: SHA, event: "push", state: "success", url: "https://gitlab.example.org/space/sprint-tool/-/pipelines/61", started: null, ended: null };
  const run62 = { id: "62", workflow: "", commit: SHA, event: "api", state: "running", url: "https://gitlab.example.org/space/sprint-tool/-/pipelines/62", started: "2026-10-16T08:10:00Z", ended: "2026-10-16T08:12:00Z" };
  assert.deepEqual(plain.result, [run61, run62]);
  const filtered = await serving(glLists(pipelines), () => host().listCiRuns({ workflow: "agent-m-jobs.yml", branch: "main", commit: SHA }));
  assert.deepEqual(filtered.requests.map((r) => [r.path, [...r.query.keys()].sort(), r.query.get("ref"), r.query.get("sha")]), [[`${GL}/pipelines`, ["page", "per_page", "ref", "sha"], "main", SHA]]);
  assert.deepEqual(filtered.result, [run61, run62].map((run) => ({ ...run, workflow: "agent-m-jobs.yml" })));
});

// TST-546006 · level: unit · module: MOD-repository-hosts
// guards: UC-049; ONE DASHBOARD SHOWS EVERY JOB
// given: GitLab pipelines in each status
// input: listCiRuns({}) on a host whose server lists them
// expect: queued for created, waiting_for_resource, preparing, pending and scheduled; running for running; waiting for manual; success for success; failure for failed; cancelled for canceled and canceling; skipped for skipped
test("listCiRuns on GitLab — the pipeline's status is the run's state, as startWorkflow maps it", async () => {
  const table = [["created", "queued"], ["waiting_for_resource", "queued"], ["preparing", "queued"], ["pending", "queued"], ["scheduled", "queued"], ["running", "running"], ["manual", "waiting"],
    ["success", "success"], ["failed", "failure"], ["canceled", "cancelled"], ["canceling", "cancelled"], ["skipped", "skipped"]];
  const { result } = await serving(glLists(() => table.map(([status], i) => glPipeline(200 + i, { status }))), () => connect(GITLAB, { token: GL_TOKEN }).listCiRuns({}));
  assert.deepEqual(result.map((run) => run.state), table.map(([, state]) => state));
});

// ---------------------------------------------------------------- cancelCiRun

// TST-546007 · level: unit · module: MOD-repository-hosts
// guards: A CANCELLED JOB WRITES NOTHING MORE; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a GitHub repository and a GitLab project, each with its token; the server accepts the cancel (GitHub 202, GitLab 200 with the pipeline)
// input: cancelCiRun("9002") on GitHub; cancelCiRun("62") on GitLab
// expect: exactly one request each — POST …/actions/runs/9002/cancel on GitHub, POST …/pipelines/62/cancel on GitLab —, the token in the header (Bearer; PRIVATE-TOKEN) and in no address; the call resolves with no value
test("cancelCiRun makes the one cancel request, on each server", async () => {
  const gh = await serving((r) => (r.path === `${GH}/actions/runs/9002/cancel` ? json(202, {}) : json(404, { message: `unrouted: ${r.href}` })), () => connect(GITHUB, { token: GH_TOKEN }).cancelCiRun("9002"));
  assert.deepEqual(lines(gh.requests), [`POST ${GH}/actions/runs/9002/cancel`]);
  assert.equal(gh.requests[0].headers.authorization, `Bearer ${GH_TOKEN}`);
  assert.equal(gh.requests[0].href.includes(GH_TOKEN), false);
  assert.equal(gh.result, undefined);
  const gl = await serving((r) => (r.path === `${GL}/pipelines/62/cancel` ? json(200, glPipeline(62, { status: "canceled" })) : json(404, { message: `unrouted: ${r.href}` })),
    () => connect(GITLAB, { token: GL_TOKEN }).cancelCiRun("62"));
  assert.deepEqual(lines(gl.requests), [`POST ${GL}/pipelines/62/cancel`]);
  assert.equal(gl.requests[0].headers["private-token"], GL_TOKEN);
  assert.equal(gl.requests[0].href.includes(GL_TOKEN), false);
  assert.equal(gl.result, undefined);
});

// TST-546008 · level: unit · module: MOD-repository-hosts
// guards: A CANCELLED JOB WRITES NOTHING MORE; A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a GitHub run 9001 that has completed, whose cancel the server answers 409 ("Cannot cancel a workflow run that is completed.") and whose run it reports as status completed; a GitHub run 9002 whose cancel it answers 409 although the run is in_progress; a GitLab pipeline 61 that has finished, whose cancel the server answers 200 with the pipeline, status success
// input: cancelCiRun("9001"); cancelCiRun("9002") on GitHub; cancelCiRun("61") on GitLab
// expect: 9001 returns (no failure; two requests — the cancel, then GET …/actions/runs/9001); 9002 fails Unreachable (the adapter's refusal of a 409 it cannot read as an ended run); 61 returns after one request
test("cancelCiRun — a run that has already ended is not a failure; a refusal for a run that has not ended is", async () => {
  const github = (r) => {
    const m = r.path.match(/^\/repos\/carol\/sprint-tool\/actions\/runs\/(\d+)(\/cancel)?$/);
    if (!m) return json(404, { message: `unrouted: ${r.href}` });
    if (r.method === "POST") return json(409, { message: "Cannot cancel a workflow run that is completed." });
    return json(200, ghRun(Number(m[1]), m[1] === "9001" ? {} : { status: "in_progress", conclusion: null }));
  };
  const ended = await serving(github, () => failure(connect(GITHUB, { token: GH_TOKEN }).cancelCiRun("9001")));
  assert.equal(ended.result, null);
  assert.deepEqual(lines(ended.requests), [`POST ${GH}/actions/runs/9001/cancel`, `GET ${GH}/actions/runs/9001`]);
  const running = await serving(github, () => failure(connect(GITHUB, { token: GH_TOKEN }).cancelCiRun("9002")));
  assert.equal(running.result?.name, "Unreachable");
  const gl = await serving(() => json(200, glPipeline(61)), () => failure(connect(GITLAB, { token: GL_TOKEN }).cancelCiRun("61")));
  assert.equal(gl.result, null);
  assert.equal(gl.requests.length, 1);
});

// ---------------------------------------------------------------- ciRunLog

const ghJobs = (jobs, logs) => (r) => {
  if (r.path === `${GH}/actions/runs/9002/jobs`) return json(200, { total_count: jobs.length, jobs: jobs.map(([id, name]) => ({ id, name, run_id: 9002 })) });
  const m = r.path.match(/^\/repos\/carol\/sprint-tool\/actions\/jobs\/(\d+)\/logs$/);
  if (m) return logs[m[1]] === undefined ? json(404, { message: "Not Found" }) : typeof logs[m[1]] === "number" ? json(logs[m[1]], { message: "gone" }) : text(200, logs[m[1]]);
  return json(404, { message: `unrouted: ${r.href}` });
};
const glJobs = (jobs, traces) => (r) => {
  if (r.path === `${GL}/pipelines/62/jobs`) return json(200, jobs.map(([id, name]) => ({ id, name, status: "success", pipeline: { id: 62 } })));
  const m = r.path.match(/^\/api\/v4\/projects\/space%2Fsprint-tool\/jobs\/(\d+)\/trace$/);
  if (m) return traces[m[1]] === undefined ? json(404, { message: "404 Not found" }) : typeof traces[m[1]] === "number" ? json(traces[m[1]], { message: "gone" }) : text(200, traces[m[1]]);
  return json(404, { message: `unrouted: ${r.href}` });
};

// TST-546009 · level: unit · module: MOD-repository-hosts
// guards: UC-049; ONE DASHBOARD SHOWS EVERY JOB; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a GitHub run 9002 whose jobs the server lists as 702 "test" and then 701 "build" — in that order, not in the order of their ids or names —, with the texts "test line 1\ntest line 2\n" and "build line\n"
// input: ciRunLog("9002")
// expect: the string "test\ntest line 1\ntest line 2\nbuild\nbuild line\n"; the requests, in order: GET …/actions/runs/9002/jobs (per_page 100, page 1), GET …/actions/jobs/702/logs, GET …/actions/jobs/701/logs; the token as a Bearer header on each and in no address
test("ciRunLog on GitHub — the jobs' texts in the order the server lists them, each preceded by a line with the job's name", async () => {
  const { result, requests } = await serving(ghJobs([[702, "test"], [701, "build"]], { 702: "test line 1\ntest line 2\n", 701: "build line\n" }), () => connect(GITHUB, { token: GH_TOKEN }).ciRunLog("9002"));
  assert.equal(result, "test\ntest line 1\ntest line 2\nbuild\nbuild line\n");
  assert.deepEqual(lines(requests), [`GET ${GH}/actions/runs/9002/jobs`, `GET ${GH}/actions/jobs/702/logs`, `GET ${GH}/actions/jobs/701/logs`]);
  assert.deepEqual([requests[0].query.get("per_page"), requests[0].query.get("page")], ["100", "1"]);
  for (const r of requests) { assert.equal(r.headers.authorization, `Bearer ${GH_TOKEN}`); assert.equal(r.href.includes(GH_TOKEN), false); }
});

// TST-546010 · level: unit · module: MOD-repository-hosts
// guards: UC-049; ONE DASHBOARD SHOWS EVERY JOB; A TOKEN GOES ONLY TO THE SERVER THAT ISSUED IT; A CREDENTIAL IS NEVER PLACED IN A URL
// given: a GitLab pipeline 62 whose jobs the server lists as 802 "test" and then 801 "build", with the traces "test line\n" and "build line without a line break at its end"
// input: ciRunLog("62")
// expect: the string "test\ntest line\nbuild\nbuild line without a line break at its end\n" (each name on a line of its own); the requests, in order: GET …/pipelines/62/jobs (per_page 100, page 1), GET …/jobs/802/trace, GET …/jobs/801/trace; the token as PRIVATE-TOKEN on each and in no address
test("ciRunLog on GitLab — the jobs' traces in the order the server lists them, each preceded by a line with the job's name", async () => {
  const { result, requests } = await serving(glJobs([[802, "test"], [801, "build"]], { 802: "test line\n", 801: "build line without a line break at its end" }), () => connect(GITLAB, { token: GL_TOKEN }).ciRunLog("62"));
  assert.equal(result, "test\ntest line\nbuild\nbuild line without a line break at its end\n");
  assert.deepEqual(lines(requests), [`GET ${GL}/pipelines/62/jobs`, `GET ${GL}/jobs/802/trace`, `GET ${GL}/jobs/801/trace`]);
  assert.deepEqual([requests[0].query.get("per_page"), requests[0].query.get("page")], ["100", "1"]);
  for (const r of requests) { assert.equal(r.headers["private-token"], GL_TOKEN); assert.equal(r.href.includes(GL_TOKEN), false); }
});

// TST-546011 · level: unit · module: MOD-repository-hosts
// guards: UC-049; A REMOTE INTERFACE NAMES HOW IT FAILS
// given: on each server a run of three jobs "a", "b", "c"; first the server keeps the log of "b" only (the log of "a" is answered 404, that of "c" 410); then it keeps none (the logs of "a" and "b" 404, that of "c" 410); then the run has no job
// input: ciRunLog on each
// expect: the first: "b\nb text\n" — a job without a log has no text and no name line; the second: null; the third: null
test("ciRunLog — a job whose log is answered 404 or 410 has no text; null where no job has one", async () => {
  const jobs = [[1, "a"], [2, "b"], [3, "c"]];
  const github = (j, logs) => serving(ghJobs(j, logs), () => connect(GITHUB, { token: GH_TOKEN }).ciRunLog("9002"));
  const gitlab = (j, traces) => serving(glJobs(j, traces), () => connect(GITLAB, { token: GL_TOKEN }).ciRunLog("62"));
  assert.equal((await github(jobs, { 2: "b text\n", 3: 410 })).result, "b\nb text\n");
  assert.equal((await gitlab(jobs, { 2: "b text\n", 3: 410 })).result, "b\nb text\n");
  assert.equal((await github(jobs, { 3: 410 })).result, null);
  assert.equal((await gitlab(jobs, { 3: 410 })).result, null);
  assert.equal((await github([], {})).result, null);
  assert.equal((await gitlab([], {})).result, null);
});

// TST-546012 · level: unit · module: MOD-repository-hosts
// guards: UC-049; A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a GitHub repository and a GitLab project; the server knows run 9002 (pipeline 62) with one job; and the server does not know run 9999 (pipeline 99): it answers 404 to the list of its jobs
// input: ciRunLog("9002") / ciRunLog("62") — the known positive —, then ciRunLog("9999") / ciRunLog("99")
// expect: the known run gives "build\nbuild line\n"; the unknown run fails NotFound on each server (not null, not Unreachable)
test("ciRunLog — a run the server does not know fails NotFound", async () => {
  const github = (id) => serving(ghJobs([[701, "build"]], { 701: "build line\n" }), () => connect(GITHUB, { token: GH_TOKEN }).ciRunLog(id));
  const gitlab = (id) => serving(glJobs([[801, "build"]], { 801: "build line\n" }), () => connect(GITLAB, { token: GL_TOKEN }).ciRunLog(id));
  assert.equal((await github("9002")).result, "build\nbuild line\n");
  assert.equal((await gitlab("62")).result, "build\nbuild line\n");
  assert.equal((await failure(github("9999")))?.name, "NotFound");
  assert.equal((await failure(gitlab("99")))?.name, "NotFound");
});

// A whole server: the cancel (POST) accepted, the jobs and logs of run 9002 (pipeline 62) with the one job "build", and the list of that one run.
const ghServer = (r) => (r.method === "POST" ? json(202, {}) : /\/runs\/9002\/jobs$|\/jobs\/\d+\/logs$/.test(r.path) ? ghJobs([[701, "build"]], { 701: "build line\n" })(r) : ghLists(() => [ghRun(9002)])(r));
const glServer = (r) => (r.method === "POST" ? json(200, glPipeline(62)) : /\/jobs|\/trace/.test(r.path) ? glJobs([[801, "build"]], { 801: "build line\n" })(r) : glLists(() => [glPipeline(62)])(r));

// ---------------------------------------------------------------- failures

// TST-546013 · level: unit · module: MOD-repository-hosts
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; A USED-UP RATE LIMIT IS NAMED, NOT BLAMED ON THE TOKEN; AN EXPIRED TOKEN IS NAMED AND ITS RENEWAL LINKED
// given: a host of each server whose server answers each of the three calls first as it documents (a known positive), then 401; 403; 403 with X-RateLimit-Remaining 0 and X-RateLimit-Limit 5000 (GitHub) / 429 (GitLab); 500; and a network that throws
// input: listCiRuns({}), cancelCiRun(id) and ciRunLog(id) on each, for each of these answers
// expect: the known positive gives its value (an array of one run; no failure; the text "build\nbuild line\n"); TokenRefused for 401 (naming the token "Carol's token" and the renewal page the host links); PermissionMissing for 403; RateLimited for the used-up limit (limit "account"); Unreachable for 500 and for the network failure; never a value
test("listCiRuns, cancelCiRun and ciRunLog name how they fail, on each server", async () => {
  const limited = { github: () => json(403, { message: "rate limit" }, { "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000", "x-ratelimit-reset": "1790000000" }), gitlab: () => json(429, { message: "Retry later" }) };
  const servers = {
    github: { host: () => connect(GITHUB, { token: GH_TOKEN, tokenName: "Carol's token" }), id: "9002", good: ghServer, renewal: "https://github.com/settings/personal-access-tokens" },
    gitlab: { host: () => connect(GITLAB, { token: GL_TOKEN, tokenName: "Carol's token" }), id: "62", good: glServer, renewal: "https://gitlab.example.org/space/sprint-tool/-/settings/access_tokens" },
  };
  for (const [name, { host, id, good, renewal }] of Object.entries(servers)) {
    const calls = { listCiRuns: (h) => h.listCiRuns({}), cancelCiRun: (h) => h.cancelCiRun(id), ciRunLog: (h) => h.ciRunLog(id) };
    const positive = { listCiRuns: (r) => assert.equal(r.length, 1), cancelCiRun: (r) => assert.equal(r, undefined), ciRunLog: (r) => assert.equal(r, "build\nbuild line\n") };
    for (const [call, run] of Object.entries(calls)) {
      positive[call]((await serving(good, () => run(host()))).result);
      const named = async (answer) => (await failure(serving(answer, () => run(host()))))?.name;
      const label = `${name} ${call}`;
      assert.equal(await named(() => json(401, { message: "Bad credentials" })), "TokenRefused", label);
      assert.equal(await named(() => json(403, { message: "Forbidden" })), "PermissionMissing", label);
      assert.equal(await named(limited[name]), "RateLimited", label);
      assert.equal(await named(() => json(500, { message: "Server error" })), "Unreachable", label);
      assert.equal(await named(() => { throw new TypeError("fetch failed"); }), "Unreachable", label);
    }
    const refused = await failure(serving(() => json(401, { message: "Bad credentials" }), () => host().listCiRuns({})));
    assert.equal(refused.tokenName, "Carol's token");
    assert.equal(refused.renewal, renewal);
    const limit = await failure(serving(limited[name], () => host().ciRunLog(id)));
    assert.equal(limit.limit, "account");
  }
});

// TST-546014 · level: unit · module: MOD-repository-hosts
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a run of two jobs "build" and "test"; the server lists the jobs and answers the log of "build" (a known positive), then answers the log of "test" with 401; 403; the used-up limit; 500; a network that throws; and, in another round, answers the first log 500 and the second one 200
// input: ciRunLog on each server for each of these answers
// expect: the known positive gives "build\nbuild line\ntest\ntest line\n"; a failing request for a log fails the whole call with its failure — TokenRefused, PermissionMissing, RateLimited, Unreachable, Unreachable — and is never read as "no log" and never as null; a log answered 500 with another answered 200 fails Unreachable too
test("ciRunLog — a failing request for a job's log fails the call; only 404 and 410 mean that no log is kept", async () => {
  const wrong = [["TokenRefused", () => json(401, { message: "Bad credentials" })], ["PermissionMissing", () => json(403, { message: "Forbidden" })],
    ["RateLimited", { github: () => json(403, { message: "rate limit" }, { "x-ratelimit-remaining": "0", "x-ratelimit-limit": "5000" }), gitlab: () => json(429, { message: "Retry later" }) }],
    ["Unreachable", () => json(500, { message: "Server error" })], ["Unreachable", () => { throw new TypeError("fetch failed"); }]];
  const servers = {
    github: { host: () => connect(GITHUB, { token: GH_TOKEN }), id: "9002", logPath: /\/jobs\/702\/logs$/, firstLogPath: /\/jobs\/701\/logs$/,
      build: ghJobs([[701, "build"], [702, "test"]], { 701: "build line\n", 702: "test line\n" }) },
    gitlab: { host: () => connect(GITLAB, { token: GL_TOKEN }), id: "62", logPath: /\/jobs\/802\/trace$/, firstLogPath: /\/jobs\/801\/trace$/,
      build: glJobs([[801, "build"], [802, "test"]], { 801: "build line\n", 802: "test line\n" }) },
  };
  for (const [name, { host, id, logPath, firstLogPath, build }] of Object.entries(servers)) {
    assert.equal((await serving(build, () => host().ciRunLog(id))).result, "build\nbuild line\ntest\ntest line\n", `${name} known positive`);
    for (const [expected, answer] of wrong) {
      const make = typeof answer === "function" ? answer : answer[name];
      const failing = (r) => (logPath.test(r.path) ? make() : build(r));
      const got = await failure(serving(failing, () => host().ciRunLog(id)));
      assert.equal(got?.name, expected, `${name} ${expected}`);
    }
    const firstFails = (r) => (firstLogPath.test(r.path) ? json(500, { message: "Server error" }) : build(r));
    assert.equal((await failure(serving(firstFails, () => host().ciRunLog(id))))?.name, "Unreachable", `${name} first log 500`);
  }
});

// ---------------------------------------------------------------- through a clone, and the arguments

// TST-546015 · level: unit · module: MOD-repository-hosts
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a host of each server connected through a clone ("/tmp/a-clone") without a token, and one connected through a clone with the person's token whose server answers as it documents
// input: listCiRuns({}), cancelCiRun("9002") / ("62"), ciRunLog("9002") / ("62") on each
// expect: through the clone with a token, the REST adapter answers — one run listed (GitHub id "9002", GitLab "62"), the cancel resolving with no value, the log "build\nbuild line\n" — with the requests the server's API expects; through the clone without a token, each of the three fails NotSupported, with no request
test("listCiRuns, cancelCiRun and ciRunLog through a clone use the REST adapter with a token and are NotSupported without one", async () => {
  for (const [address, token, id, answer] of [[GITHUB, GH_TOKEN, "9002", ghServer], [GITLAB, GL_TOKEN, "62", glServer]]) {
    const listed = await serving(answer, () => connect(address, { token, clone: "/tmp/a-clone" }).listCiRuns({}));
    assert.deepEqual(listed.result.map((run) => run.id), [id]);
    const cancelled = await serving(answer, () => connect(address, { token, clone: "/tmp/a-clone" }).cancelCiRun(id));
    assert.deepEqual([cancelled.result, cancelled.requests.length], [undefined, 1]);
    const logged = await serving(answer, () => connect(address, { token, clone: "/tmp/a-clone" }).ciRunLog(id));
    assert.equal(logged.result, "build\nbuild line\n");
    const bare = () => connect(address, { clone: "/tmp/a-clone" });
    for (const call of [() => bare().listCiRuns({}), () => bare().cancelCiRun(id), () => bare().ciRunLog(id)]) {
      const refused = await serving(answer, () => failure(call()));
      assert.equal(refused.result?.name, "NotSupported");
      assert.equal(refused.requests.length, 0);
    }
  }
});

// TST-546016 · level: unit · module: MOD-repository-hosts
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a host with a token; arguments that are no filter, no run's identifier
// input: listCiRuns("main"), listCiRuns({ branch: 5 }), listCiRuns({ workflow: "" }), cancelCiRun(""), cancelCiRun(7), ciRunLog(""), ciRunLog(null)
// expect: a TypeError for each, raised by the function itself (not for a missing function), with no request; the known positive listCiRuns({ branch: "main" }) is served with one request
test("listCiRuns, cancelCiRun and ciRunLog refuse arguments that are no filter and no run, before any request", async () => {
  const host = connect(GITHUB, { token: GH_TOKEN });
  assert.equal((await serving(ghLists(() => []), () => host.listCiRuns({ branch: "main" }))).requests.length, 1, "known positive");
  for (const call of [() => host.listCiRuns("main"), () => host.listCiRuns({ branch: 5 }), () => host.listCiRuns({ workflow: "" }), () => host.cancelCiRun(""), () => host.cancelCiRun(7),
    () => host.ciRunLog(""), () => host.ciRunLog(null)]) {
    const refused = await serving(() => json(200, {}), () => failure(call()));
    assert.ok(refused.result instanceof TypeError, String(call));
    assert.doesNotMatch(refused.result.message, /is not a function/, "the module provides the function, which refuses the argument");
    assert.equal(refused.requests.length, 0);
  }
});
