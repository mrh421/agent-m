// The world of the tests of MOD-workflow-entries' entry onPullRequestClosed — a helper, no test of its own: the job workflow's checkout of a product (the workspace, a temporary git repository holding the product's files, among them the records of its jobs, and the instance
// beside it), a fake of GitHub's REST API serving one pull request and the issues of the product, and the entry run on the event pull_request with that fake in place of the network. Used by tests/workflow-entries-pull-request-closed.test.mjs (ITM-583) and
// tests/system-uc-012-fix-a-bug.test.mjs. It holds no expected result.
//
// Module: MOD-workflow-entries
// Level: unit

import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const { runEntry } = await import("../src/workflow-entries/main.mjs");

export const NOW = new Date("2026-10-28T10:00:00Z");
export const TOKEN = "ghp_ALICEagentMtoken0123456789abcdef";
export const BASE = "b".repeat(40), HEAD = "2".repeat(40), MERGE = "3".repeat(40);

function git(cwd, ...args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}
function write(root, files) {
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(root, path, ".."), { recursive: true });
    writeFileSync(join(root, path), body);
  }
}

/**
 * withCheckout(jobs, run, { repository }) — the job workflow's checkout of the product `repository` (owner/name; alice/thesis-tool where none is given) with the records `jobs` ({ path, text } each) under it, and the instance beside it; `run` is called with where
 * they are — { root, checkout, product, repository } — and the folder is removed afterwards.
 */
export async function withCheckout(jobs, run, { repository = "alice/thesis-tool" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-pull-request-closed-"));
  const checkout = join(root, "ws");
  try {
    const product = join(checkout, "product");
    write(product, { "README.md": "# The product\n", ...Object.fromEntries(jobs.map((job) => [job.path, job.text])) });
    git(product, "init", "-q", "-b", "main");
    git(product, "config", "user.name", "Seed");
    git(product, "config", "user.email", "seed@example.org");
    git(product, "add", "-A");
    git(product, "commit", "-q", "-m", "first");
    // The instance, checked out beside the product as the job workflow does, at one commit: the entry reads it only for the job of an item, whose items it reads with the product's facts (ITM-1375).
    const instance = join(checkout, "instance");
    write(instance, { "README.md": "# Instance\n" });
    git(instance, "init", "-q", "-b", "main");
    git(instance, "config", "user.name", "Seed");
    git(instance, "config", "user.email", "seed@example.org");
    git(instance, "add", "-A");
    git(instance, "commit", "-q", "-m", "first");
    git(instance, "remote", "add", "origin", "https://github.com/alice/agent-m");
    return await run({ root, checkout, product, repository });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

/**
 * fakeGitHub({ repository, merged, title, body, branch, refuse, issues }) — a fake of GitHub's REST API serving the pull request #7 of `repository` — merged, or closed without a merge — whose title, description and branch are given, its one commit, and the comments on, and the state of,
 * the issues: it keeps every request with the authorisation it carried; the comment on an issue number in `refuse` is refused with 403. The issues keep what is written to them, so that a later run reads it ("Get an issue", "List issue comments"): each is open with no comment,
 * unless `issues` gives it ({ [number]: { state: "open" | "closed", comments: string[] } }). -> { fetch, requests, writes() } — `writes()` the requests that are no read, as [method, path, body].
 */
export function fakeGitHub({ repository = "alice/thesis-tool", merged = true, title, body, branch, refuse = [], issues = {} } = {}) {
  const web = `https://github.com/${repository}`;
  const answer = (status, value) => new Response(typeof value === "string" ? value : JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  const requests = [];
  const kept = issuesOf(issues);
  const fetch = async (address, init = {}) => {
    const url = new URL(String(address)), method = String(init.method ?? "GET").toUpperCase(), path = url.pathname.replace(`/repos/${repository}`, ""), page = Number(url.searchParams.get("page") ?? "1");
    if (url.origin !== "https://api.github.com" || !url.pathname.startsWith(`/repos/${repository}`)) throw new TypeError(`fetch failed: ${address}`);
    requests.push({ method, path, body: init.body ? JSON.parse(init.body) : null, authorization: new Headers(init.headers ?? {}).get("authorization") });
    const paged = (list) => answer(200, page === 1 ? list : []);
    if (method === "GET" && path === "/pulls/7") {
      return answer(200, { number: 7, title, body, state: "closed", draft: false, html_url: `${web}/pull/7`, created_at: "2026-10-28T09:10:00Z", merged_at: merged ? "2026-10-28T09:50:00Z" : null,
        closed_at: "2026-10-28T09:50:00Z", merge_commit_sha: merged ? MERGE : null, head: { ref: branch, sha: HEAD }, base: { ref: "main", sha: BASE } });
    }
    if (method === "GET" && path === "/pulls/7/commits") return paged([{ sha: HEAD, parents: [{ sha: BASE }], commit: { message: "the fix", committer: { date: "2026-10-28T09:00:00Z" } } }]);
    if (method === "GET" && path === "/pulls/7/files") return paged([{ filename: "src/store/index.mjs", status: "modified" }]);
    if (method === "GET" && path === "/pulls/7/reviews") return paged([]);
    if (method === "GET" && path === `/commits/${HEAD}/check-runs`) return answer(200, { total_count: 0, check_runs: [] });
    if (method === "GET" && path === `/commits/${HEAD}/statuses`) return paged([]);
    if (method === "GET" && path === `/commits/${HEAD}`) return answer(200, { sha: HEAD, files: page === 1 ? [{ filename: "src/store/index.mjs", status: "modified" }] : [] });
    const issue = /^\/issues\/(\d+)(\/comments)?$/.exec(path);
    const one = issue && kept(Number(issue[1]));
    const asGitHub = (number) => ({ number, title: `Issue ${number}`, body: "", labels: [], state: one.state, html_url: `${web}/issues/${number}`, created_at: "2026-10-28T08:00:00Z", closed_at: one.state === "closed" ? "2026-10-28T09:50:00Z" : null,
      comments: one.comments.length });
    if (issue && method === "GET" && !issue[2]) return answer(200, asGitHub(Number(issue[1])));
    if (issue && method === "GET" && issue[2]) return paged(one.comments.map((text) => ({ user: { login: "alice" }, body: text, created_at: "2026-10-28T09:50:00Z" })));
    if (issue && method === "POST" && issue[2]) {
      if (refuse.includes(Number(issue[1]))) return answer(403, { message: "Resource not accessible by personal access token" });
      one.comments.push(JSON.parse(init.body).body);
      return answer(201, { id: 1 });
    }
    if (issue && method === "PATCH" && !issue[2]) { one.state = JSON.parse(init.body).state; return answer(200, asGitHub(Number(issue[1]))); }
    throw new TypeError(`fetch failed: the fake GitHub does not serve ${method} ${path}`);
  };
  return { fetch, requests, writes: () => requests.filter((each) => each.method !== "GET").map(({ method, path, body: sent }) => [method, path, sent]) };
}

/** issuesOf(given) — the issues of a fake server, by number: those `given` names as given, every other open with no comment; each keeps what is written to it. */
function issuesOf(given) {
  const issues = new Map(Object.entries(given).map(([number, { state = "open", comments = [] }]) => [Number(number), { state, comments: [...comments] }]));
  return (number) => {
    if (!issues.has(number)) issues.set(number, { state: "open", comments: [] });
    return issues.get(number);
  };
}

/**
 * onPullRequestClosed(w, server, { token, payload }) — the entry, run in the job workflow's writing machine on the event pull_request, action closed (payload: the pull request #7), with `server`'s fetch in place of the network — none, where `server` is null: any
 * request then fails the test. The person's token is TOKEN, none where `token` is null.
 */
export async function onPullRequestClosed(w, server, { token = TOKEN, payload = { action: "closed", number: 7, pull_request: { number: 7 } } } = {}) {
  const event = join(w.root, "event.json");
  writeFileSync(event, JSON.stringify(payload));
  const real = globalThis.fetch;
  globalThis.fetch = server ? server.fetch : async () => { throw new Error("no request may be made"); };
  try {
    return await runEntry("onPullRequestClosed", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: event, GITHUB_WORKSPACE: w.checkout, GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: w.repository, GITHUB_REF_NAME: "7/merge", GITHUB_SHA: "3".repeat(40), GITHUB_RUN_ID: "4711", GITHUB_ACTOR: "alice", AGENT_M_RUNNER: "hosted", AGENT_M_PART: "write",
      AGENT_M_PRODUCT_DIR: w.product, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN", ...(token ? { AGENT_M_TOKEN: token } : {}) }, { now: NOW });
  } finally { globalThis.fetch = real; }
}

// ---------------------------------------------------------------- the same on GitLab

export const GITLAB = "https://gitlab.example.test/alice/thesis-tool";
export const GITLAB_TOKEN = "glpat-ALICEagentMtoken0123456789";
export const PUSHED_AT ="2026-10-28T09:50:00+00:00";

/**
 * fakeGitLab({ mergeRequests, refuse, issues }) — a fake of GitLab's REST API for the project alice/thesis-tool: "List project merge requests" answers `mergeRequests` (each { iid, title, description, source_branch, sha, merge_commit_sha, squash_commit_sha }, as GitLab names them, state
 * `merged`) on its first page, and the notes on, and the state of, the issues are written as GitLab takes them (POST …/issues/:iid/notes, PUT …/issues/:iid with state_event); it keeps every request with the PRIVATE-TOKEN it carried; the note on an issue number in `refuse` is
 * refused with 403. The issues keep what is written to them and are read as GitLab serves them ("Get a single project issue", "List project issue notes"): each is open with no note, unless `issues` gives it, as fakeGitHub's. -> { fetch, requests, writes() }, as fakeGitHub's.
 */
export function fakeGitLab({ mergeRequests = [], refuse = [], issues = {} } = {}) {
  const api = "/api/v4/projects/alice%2Fthesis-tool";
  const answer = (status, value) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  const requests = [];
  const kept = issuesOf(issues);
  const fetch = async (address, init = {}) => {
    const url = new URL(String(address)), method = String(init.method ?? "GET").toUpperCase(), path = url.pathname.replace(api, ""), page = Number(url.searchParams.get("page") ?? "1");
    if (url.origin !== "https://gitlab.example.test" || !url.pathname.startsWith(api)) throw new TypeError(`fetch failed: ${address}`);
    requests.push({ method, path, query: Object.fromEntries(url.searchParams), body: init.body ? JSON.parse(init.body) : null, authorization: new Headers(init.headers ?? {}).get("private-token") });
    if (method === "GET" && path === "/merge_requests") {
      return answer(200, page === 1 ? mergeRequests.map((each) => ({ state: "merged", target_branch: "main", merge_commit_sha: null, squash_commit_sha: null, merged_at: "2026-10-28T09:50:00Z",
        created_at: "2026-10-28T09:10:00Z", closed_at: null, draft: false, web_url: `${GITLAB}/-/merge_requests/${each.iid}`, ...each })) : []);
    }
    const issue = /^\/issues\/(\d+)(\/notes)?$/.exec(path);
    const one = issue && kept(Number(issue[1]));
    const asGitLab = (iid) => ({ iid, title: `Issue ${iid}`, description: "", labels: [], state: one.state === "closed" ? "closed" : "opened", web_url: `${GITLAB}/-/issues/${iid}`, created_at: "2026-10-28T08:00:00Z",
      closed_at: one.state === "closed" ? "2026-10-28T09:50:00Z" : null, user_notes_count: one.comments.length });
    if (issue && method === "GET" && !issue[2]) return answer(200, asGitLab(Number(issue[1])));
    if (issue && method === "GET" && issue[2]) return answer(200, page === 1 ? one.comments.map((text) => ({ author: { username: "alice" }, body: text, created_at: "2026-10-28T09:50:00Z", system: false })) : []);
    if (issue && method === "POST" && issue[2]) {
      if (refuse.includes(Number(issue[1]))) return answer(403, { message: "403 Forbidden" });
      one.comments.push(JSON.parse(init.body).body);
      return answer(201, { id: 1 });
    }
    if (issue && method === "PUT" && !issue[2]) {
      if (JSON.parse(init.body).state_event === "close") one.state = "closed";
      return answer(200, asGitLab(Number(issue[1])));
    }
    throw new TypeError(`fetch failed: the fake GitLab does not serve ${method} ${path}`);
  };
  return { fetch, requests, writes: () => requests.filter((each) => each.method !== "GET").map(({ method, path, body: sent }) => [method, path, sent]) };
}

/**
 * onMergeRequestMerged(w, server, { token, sha, timestamp, source }) — the entry onPullRequestClosed, run in the job that writes of the job workflow on GitLab (src/runtimes/workflow/gitlab.yml) for the pipeline of a push to the default branch, as GitLab names it: CI_COMMIT_SHA
 * `sha`, CI_COMMIT_TIMESTAMP `timestamp`, CI_PIPELINE_SOURCE `source`; with `server`'s fetch in place of the network, none where it is null. The person's token is GITLAB_TOKEN, none where `token` is null.
 */
export async function onMergeRequestMerged(w, server, { token = GITLAB_TOKEN, sha = MERGE, timestamp = PUSHED_AT, source = "push" } = {}) {
  const real = globalThis.fetch;
  globalThis.fetch = server ? server.fetch : async () => { throw new Error("no request may be made"); };
  try {
    return await runEntry("onPullRequestClosed", { GITLAB_CI: "true", CI_PIPELINE_SOURCE: source, CI_PROJECT_DIR: w.product, CI_PROJECT_URL: GITLAB, CI_COMMIT_REF_NAME: "main", CI_COMMIT_SHA: sha, CI_COMMIT_TIMESTAMP: timestamp,
      CI_PIPELINE_URL: `${GITLAB}/-/pipelines/4711`, GITLAB_USER_LOGIN: "alice", AGENT_M_RUNNER: "hosted", AGENT_M_PART: "write", AGENT_M_PRODUCT_DIR: w.product, AGENT_M_TOKEN_NAME: "AGENT_M_TOKEN",
      ...(token ? { AGENT_M_TOKEN: token } : {}) }, { now: NOW });
  } finally { globalThis.fetch = real; }
}
