// MOD-repository-hosts' listCiRuns with `event` and `newest`, as docs/architecture/MOD-repository-hosts.md states it: "with `event`, only the runs
// of that event (GitHub's `event`, GitLab's `source`); with `newest`, only that many, the newest first, in one request".
// Run: node --test tests/repository-hosts-ci-runs-newest.test.mjs
//
// Module: MOD-repository-hosts
// Guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// Deterministic, no network: GitHub's "List workflow runs for a workflow" and GitLab's "List project pipelines" are fakes of `fetch` that hold
// 250 runs, 100 to a page, and record every request. Each test states its expected requests and runs.

import test from "node:test";
import assert from "node:assert/strict";
import { parseAddress, connect } from "../src/repository-hosts/index.mjs";

const GITHUB_TOKEN = "github_pat_CIRUNSnewest0123456789abcdef";
const GITLAB_TOKEN = "glpat-CIRUNSnewest0123456789";
const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });

async function using(fetchFn, run) {
  const real = globalThis.fetch;
  globalThis.fetch = fetchFn;
  try { return await run(); } finally { globalThis.fetch = real; }
}

// 250 runs, the newest first, alternating between the events push and schedule.
const RUNS = Array.from({ length: 250 }, (_, at) => ({ id: 1000 - at, event: at % 2 ? "schedule" : "push" }));
const pageOf = (url, list) => {
  const per = Number(url.searchParams.get("per_page") ?? 30), page = Number(url.searchParams.get("page") ?? 1);
  return list.slice((page - 1) * per, page * per);
};

function fakeGitHub() {
  const requests = [];
  const fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    const event = url.searchParams.get("event");
    const runs = RUNS.filter((run) => !event || run.event === event).map((run) => ({ id: run.id, event: run.event, head_sha: "c".repeat(40),
      status: "completed", conclusion: "success", html_url: `https://github.com/bob/runs/actions/runs/${run.id}`, run_started_at: "2026-11-01T00:00:00Z",
      updated_at: "2026-11-01T00:10:00Z", path: ".github/workflows/agent-m-tests.yml", name: "tests" }));
    return json({ total_count: runs.length, workflow_runs: pageOf(url, runs) });
  };
  return { fetch, requests };
}

// TST-1399101 · level: unit · module: MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a GitHub repository whose workflow agent-m-tests.yml holds 250 runs, alternating push and schedule; a host with a token
// input: listCiRuns({ workflow: "agent-m-tests.yml", event: "schedule", newest: 1 }); counter-proof: listCiRuns({ workflow: "agent-m-tests.yml" })
// expect: one request, naming event=schedule and per_page=1, and one run, the newest of the event (999); the counter-proof reads all three pages and gives 250 runs
test("listCiRuns on GitHub with event and newest reads one page of that event, that many runs long", async () => {
  const fake = fakeGitHub();
  await using(fake.fetch, async () => {
    const host = connect(parseAddress("https://github.com/bob/runs"), { token: GITHUB_TOKEN });
    const runs = await host.listCiRuns({ workflow: "agent-m-tests.yml", event: "schedule", newest: 1 });
    assert.equal(fake.requests.length, 1);
    assert.equal(fake.requests[0].searchParams.get("event"), "schedule");
    assert.equal(fake.requests[0].searchParams.get("per_page"), "1");
    assert.deepEqual(runs.map((run) => [run.id, run.event]), [["999", "schedule"]]);
    fake.requests.length = 0;
    assert.equal((await host.listCiRuns({ workflow: "agent-m-tests.yml" })).length, 250, "counter-proof: every run");
    assert.equal(fake.requests.length, 3, "counter-proof: page by page");
  });
});

// TST-1399102 · level: unit · module: MOD-repository-hosts
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a GitLab project with 250 pipelines, alternating the sources push and schedule; a host with the project's token
// input: listCiRuns({ event: "push", newest: 2 })
// expect: one request, naming source=push and per_page=2, and two pipelines, the newest two of that source (1000 and 998)
test("listCiRuns on GitLab with event and newest reads one page of that source", async () => {
  const requests = [];
  const fetch = async (input) => {
    const url = new URL(String(input));
    requests.push(url);
    const source = url.searchParams.get("source");
    return json(pageOf(url, RUNS.filter((run) => !source || run.event === source).map((run) => ({ id: run.id, sha: "c".repeat(40), source: run.event,
      status: "success", web_url: `https://gitlab.example/bob/runs/-/pipelines/${run.id}`, created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:10:00Z" }))));
  };
  await using(fetch, async () => {
    const host = connect(parseAddress("https://gitlab.example/bob/runs"), { token: GITLAB_TOKEN });
    const runs = await host.listCiRuns({ event: "push", newest: 2 });
    assert.equal(requests.length, 1);
    assert.equal(requests[0].searchParams.get("source"), "push");
    assert.equal(requests[0].searchParams.get("per_page"), "2");
    assert.deepEqual(runs.map((run) => run.id), ["1000", "998"]);
  });
});
