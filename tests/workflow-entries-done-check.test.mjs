// MOD-workflow-entries' entry onDoneCheck (ITM-1210), as the accepted text of docs/architecture/MOD-workflow-entries.md states it: "on a pull request of a product opened or
// updated, run only by the Definition-of-Done job of MOD-test-schedule's test configuration: the Definition-of-Done check from the pull request's facts and the product's declared
// conditions, its status and findings shown on the pull request (`A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS`)."; UC-027.
// Run: node --test tests/workflow-entries-done-check.test.mjs
//
// Module: MOD-workflow-entries
// Guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES; UC-027
// Level: unit
//
// Deterministic, no network. The checkout is laid out as MOD-test-schedule's generated job `agent-m done` lays it out (src/test-schedule/templates/github-done.yml): the
// workspace is the product's checkout of the pull request, the instance is checked out into its folder `.agent-m`, both temporary git repositories. The product declares the
// shipped model kanban — no gate of it stands before the merge —, the backlog item ITM-001 of the module MOD-store (folder src/store/) and the job JOB-20261025-0900-a1b2 of
// kind implement working on it. The pull request's facts come from a fake of GitHub's REST API (the pull request, its commits with their files and checks, its files, its
// reviews, a file's text at a commit), which `fetch` is replaced with. The readings, named in the pull request:
//   - The pull request's job is the job its title or description names (`Job: <id>`, as MOD-runtimes' writer branch-and-pull-request writes them); its modules are those of the
//     items and plan steps the job works on. A pull request that names no job is no implementation job's: `nothing to do`. Where the event's pull request holds its title,
//     as GitHub's payload does, the job is read from it first, and a pull request that names none ends `nothing to do` before anything is read from the server (ITM-1382).
//   - The CI result of the pull request's head is read from the run's own statuses (ITM-1216; MOD-workflow-entries, Data: The reports of a run), which the job `agent-m done`
//     takes into the folder agent-m-reports/ of the checkout: green only when every shard AGENT_M_EXPECTED names (`<row>:<shards>`, separated by commas) left
//     agent-m-reports/pull-request.<row>.<shard>.status holding `done` or `nothing to do`, and agent-m-reports/records.status holds `done`. The head's checks the server
//     reports are not weighed; the earlier commits' CI results are the server's. A job that is not green is named in a finding by its status file's name —
//     pull-request.<row>.<shard>, or records for the job `agent-m records`.
//   - The status and the findings are shown on the pull request as the check's: its outcome, its log (main.mjs prints the findings) and the run's summary, which GitHub
//     links from the check (GITHUB_STEP_SUMMARY).
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startRecord } from "../src/job-ledger/index.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const { runEntry } = await import("../src/workflow-entries/main.mjs");

// ---------------------------------------------------------------- the fixtures

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MODEL = "src/model-catalogue/models/kanban.md";
const NOW = new Date("2026-10-25T10:00:00Z");
const TOKEN = "ghp_ALICEagentMtoken0123456789abcdef";
const JOB = "JOB-20261025-0900-a1b2";
const API = "https://api.github.com/repos/alice/thesis-tool";
const WEB = "https://github.com/alice/thesis-tool";
const RUN = `${WEB}/actions/runs/4711`;
const BASE = "b".repeat(40), FIRST = "1".repeat(40), HEAD = "2".repeat(40);

const text = (...lines) => `${lines.join("\n")}\n`;
const NEW_TEST = text("// Module: MOD-store", "// Level: unit", "", "// TST-001 · level: unit · module: MOD-store", "// guards: A LOAN HAS A DUE DATE", "// given: a loan",
  "// input: its date", "// expect: the due date", "test(\"TST-001 a loan\", () => {});");
const declaration = (version) => text("---", "model: kanban", `model_file: ${MODEL}`, `model_version: ${version}`, "---", "# Process", "", "## Practices", "", "- none", "",
  "## Branches", "", "| Phase or time box | Branch |", "|---|---|", "", "## Definition of Done", "", "The job rules hold; no condition is added.");
const ITEM = text("---", "id: ITM-001", "title: A loan has a due date", "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-store", "tests:", "  - unit", "origin:",
  "  - UC-001", "---", "# ITM-001 A loan has a due date", "", "## Outcome", "", "o", "", "## Acceptance", "", "a");
const MODULE = text("---", "id: MOD-store", "title: The store", "folder: src/store/", "realises:", "follows:", "  - ARC-001", "uses:", "provides:", "---", "# MOD-store The store");

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
function repository(folder, files) {
  mkdirSync(folder, { recursive: true });
  git(folder, "init", "-q", "-b", "main");
  git(folder, "config", "user.name", "Seed");
  git(folder, "config", "user.email", "seed@example.org");
  write(folder, files);
  git(folder, "add", "-A");
  git(folder, "commit", "-q", "-m", "first");
  return git(folder, "rev-parse", "HEAD");
}

// The statuses of a green run of the pull request, as AGENT_M_EXPECTED names its jobs: the row unit in two shards, the row component in one, which had no file, and the job
// `agent-m records`.
const EXPECTED = "unit:2,component:1";
const GREEN = { "pull-request.unit.1.status": "done\n", "pull-request.unit.2.status": "done\n", "pull-request.component.1.status": "nothing to do\n", "records.status": "done\n" };

// The job `agent-m done`'s checkout of the pull request, with the instance in its folder .agent-m, the event's payload, and the run's statuses taken into agent-m-reports/ —
// `statuses` maps each file's name in that folder to its text; `pullRequest` is the event's pull request as GitHub's payload holds it.
async function withCheckout(run, { statuses = GREEN, pullRequest = { number: 7 } } = {}) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-done-check-"));
  const checkout = join(root, "product");
  try {
    const instance = repository(join(checkout, ".agent-m"), { "SPEC.md": "# Spec\n", [MODEL]: readFileSync(join(ROOT, MODEL), "utf8") });
    const job = startRecord({ id: JOB, kind: "implement", worksOn: ["ITM-001"], participant: "ci-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null,
      startedBy: "alice", start: new Date("2026-10-25T09:00:00Z"), agentM: { version: "unreleased", commit: instance }, inputs: [], limit: 2,
      destinations: [{ participant: "ci-bot", place: "GitHub's hosted runners", parts: [] }], params: {} });
    write(checkout, { "README.md": "# Thesis tool\n", "docs/process.md": declaration(instance), "docs/backlog/ITM-001-a-loan-has-a-due-date.md": ITEM,
      "docs/architecture/MOD-store.md": MODULE, [job.path]: job.text, "src/store/index.mjs": "export const due = 14;\n", "tests/store.test.mjs": NEW_TEST });
    git(checkout, "init", "-q", "-b", "main");
    git(checkout, "config", "user.name", "Seed");
    git(checkout, "config", "user.email", "seed@example.org");
    git(checkout, "add", "README.md", "docs", "src", "tests");
    git(checkout, "commit", "-q", "-m", "the merge of the pull request");
    const event = join(root, "event.json"), summary = join(root, "summary.md");
    writeFileSync(event, JSON.stringify({ action: "synchronize", number: 7, pull_request: pullRequest }));
    write(checkout, Object.fromEntries(Object.entries(statuses).map(([name, text]) => [`agent-m-reports/${name}`, text])));
    return await run({ checkout, event, summary });
  } finally { rmSync(root, { recursive: true, force: true }); }
}

// A fake of GitHub's REST API serving the pull request #7 of alice/thesis-tool: its first commit adds the test and was red, its head commit changes src/store/index.mjs — and
// `outside`, where given — with the check `node` of the conclusion `headNode`, green unless given, and this run's check `agent-m done` running. `title`/`body` are the pull
// request's.
function fakeGitHub({ outside = null, headNode = "success", title = `${JOB}: implement ITM-001`, body = `Job: ${JOB}\nKind: implement\nBacklog item: ITM-001\nModules: MOD-store` } = {}) {
  const answer = (status, value) => new Response(typeof value === "string" ? value : JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  const headFiles = ["src/store/index.mjs", ...(outside ? [outside] : [])];
  const commits = [
    { sha: FIRST, parents: [BASE], files: [{ filename: "tests/store.test.mjs", status: "added" }], checks: [{ name: "node", status: "completed", conclusion: "failure", html_url: `${WEB}/actions/runs/4700/job/1` }] },
    { sha: HEAD, parents: [FIRST], files: headFiles.map((filename) => ({ filename, status: filename === outside ? "added" : "modified" })),
      checks: [{ name: "node", status: "completed", conclusion: headNode, html_url: `${RUN}/job/98` }, { name: "agent-m done", status: "in_progress", conclusion: null, html_url: `${RUN}/job/99` }] },
  ];
  const calls = [];
  const fetch = async (address) => {
    const url = new URL(String(address)), path = url.pathname.replace("/repos/alice/thesis-tool", ""), page = Number(url.searchParams.get("page") ?? "1");
    calls.push(`${url.origin}${url.pathname}`);
    if (url.origin !== "https://api.github.com" || !url.pathname.startsWith("/repos/alice/thesis-tool")) throw new TypeError(`fetch failed: ${address}`);
    const paged = (list) => answer(200, page === 1 ? list : []);
    if (path === "/pulls/7") {
      return answer(200, { number: 7, title, body, state: "open", draft: false, html_url: `${WEB}/pull/7`, created_at: "2026-10-25T09:10:00Z", merged_at: null, closed_at: null,
        merge_commit_sha: null, head: { ref: `agent-m/${JOB}`, sha: HEAD }, base: { ref: "main", sha: BASE } });
    }
    if (path === "/pulls/7/commits") return paged(commits.map((c, i) => ({ sha: c.sha, parents: c.parents.map((sha) => ({ sha })), commit: { message: i ? "the code" : "the tests", committer: { date: `2026-10-25T09:0${i}:00Z` } } })));
    if (path === "/pulls/7/files") return paged([{ filename: "tests/store.test.mjs", status: "added" }, ...headFiles.map((filename) => ({ filename, status: filename === outside ? "added" : "modified" }))]);
    if (path === "/pulls/7/reviews") return paged([]);
    for (const c of commits) {
      if (path === `/commits/${c.sha}/check-runs`) return answer(200, { total_count: page === 1 ? c.checks.length : 0, check_runs: page === 1 ? c.checks : [] });
      if (path === `/commits/${c.sha}/statuses`) return paged([]);
      if (path === `/commits/${c.sha}`) return answer(200, { sha: c.sha, files: page === 1 ? c.files : [] });
    }
    if (path === "/contents/tests/store.test.mjs") return answer(200, NEW_TEST);
    if (path.startsWith("/contents/")) return answer(404, { message: "Not Found" });
    throw new TypeError(`fetch failed: the fake GitHub does not serve ${path}`);
  };
  return { fetch, calls };
}

// The entry, run in the job `agent-m done` of GitHub Actions on the event pull_request, with the fake server in place of the network.
async function onDoneCheck(w, server, { token = TOKEN, expected = EXPECTED } = {}) {
  const real = globalThis.fetch;
  globalThis.fetch = server ? server.fetch : async () => { throw new Error("no request may be made"); };
  try {
    return await runEntry("onDoneCheck", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "pull_request", GITHUB_EVENT_PATH: w.event, GITHUB_WORKSPACE: w.checkout,
      GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "alice/thesis-tool", GITHUB_REF_NAME: "7/merge", GITHUB_SHA: "3".repeat(40), GITHUB_RUN_ID: "4711",
      GITHUB_JOB: "agent-m-done", GITHUB_ACTOR: "alice", GITHUB_STEP_SUMMARY: w.summary, AGENT_M_INSTANCE_COMMIT: "f".repeat(40), ...(expected ? { AGENT_M_EXPECTED: expected } : {}),
      ...(token ? { AGENT_M_TOKEN: token } : {}) }, { now: NOW });
  } finally { globalThis.fetch = real; }
}
const summaryOf = (w) => (existsSync(w.summary) ? readFileSync(w.summary, "utf8") : "");

// ---------------------------------------------------------------- the tests

// TST-1210101 · level: unit · module: MOD-workflow-entries
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES; UC-027
// given: the pull request #7 of the job JOB-20261025-0900-a1b2 (kind implement, item ITM-001 of MOD-store): its first commit adds only the test file and its CI failed; its head changes src/store/index.mjs, the check node is green and this run's check `agent-m done` is running; AGENT_M_EXPECTED unit:2,component:1, and the run's statuses pull-request.unit.1 and pull-request.unit.2 `done`, pull-request.component.1 `nothing to do`, records `done`; the new test TST-001 names what it guards and its module; the product declares kanban, whose one gate stands after the merge, and adds no condition
// input: onDoneCheck on the event pull_request
// expect: outcome `done`, no finding, the summary saying that the Definition of Done holds; the run's summary says so too; the pull request's facts were read from the server
test("onDoneCheck — a pull request meeting every condition of the Definition of Done ends passed", async () => {
  await withCheckout(async (w) => {
    const server = fakeGitHub();
    const status = await onDoneCheck(w, server);
    assert.equal(status.outcome, "done", `${status.summary} ${JSON.stringify(status.findings)}`);
    assert.deepEqual(status.findings, []);
    assert.match(status.summary, /holds/);
    assert.match(summaryOf(w), /holds/);
    assert.ok(server.calls.includes(`${API}/pulls/7/commits`), "the commits of the pull request were read");
  });
});

// TST-1210102 · level: unit · module: MOD-workflow-entries
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES; UC-027
// given: the pull request of TST-1210101, whose head also adds src/other/extra.mjs, a file in the folder of no module of the job
// input: onDoneCheck on the event pull_request
// expect: outcome `failed`; one error finding under AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES on src/other/extra.mjs; the run's summary, which the check links on the pull request, names the file and the rule
test("onDoneCheck — a pull request missing a condition ends failed and names it on the pull request", async () => {
  await withCheckout(async (w) => {
    const status = await onDoneCheck(w, fakeGitHub({ outside: "src/other/extra.mjs" }));
    assert.equal(status.outcome, "failed", status.summary);
    assert.equal(status.findings.length, 1, JSON.stringify(status.findings));
    assert.equal(status.findings[0].rule, "AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES");
    assert.equal(status.findings[0].artifact, "src/other/extra.mjs");
    assert.match(summaryOf(w), /src\/other\/extra\.mjs/);
    assert.match(summaryOf(w), /AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES/);
  });
});

// TST-1210103 · level: unit · module: MOD-workflow-entries
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; NO SECRET IN THE REPOSITORY
// given: the checkout of TST-1210101; the person's token AGENT_M_TOKEN is not set
// input: onDoneCheck on the event pull_request
// expect: outcome `not run`, its summary naming AGENT_M_TOKEN; no request is made, nothing is written
test("onDoneCheck — a missing secret ends the entry before anything is written", async () => {
  await withCheckout(async (w) => {
    const status = await onDoneCheck(w, null, { token: null });
    assert.equal(status.outcome, "not run", status.summary);
    assert.match(status.summary, /AGENT_M_TOKEN/);
    assert.equal(summaryOf(w), "");
  });
});

// TST-1210104 · level: unit · module: MOD-workflow-entries
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
// given: the checkout of TST-1210101; a pull request whose title and description name no job — a person's own change
// input: onDoneCheck on the event pull_request
// expect: outcome `nothing to do`, the summary saying that the pull request names no implementation job
test("onDoneCheck — a pull request that names no job is no implementation job's", async () => {
  await withCheckout(async (w) => {
    const status = await onDoneCheck(w, fakeGitHub({ title: "Fix a typo", body: "" }));
    assert.equal(status.outcome, "nothing to do", status.summary);
    assert.match(status.summary, /no job/);
  });
});

// TST-1216105 · level: unit · module: MOD-workflow-entries
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; UC-027
// given: the pull request of TST-1210101 with the run's green statuses — pull-request.unit.1 and pull-request.unit.2 `done`, pull-request.component.1 `nothing to do`, records `done` —, while the server reports the head's check node as failed
// input: onDoneCheck on the event pull_request with AGENT_M_EXPECTED unit:2,component:1
// expect: outcome `done`, no finding: the head's CI result is the run's statuses', not the server's checks
test("onDoneCheck — the head's CI result is read from the run's statuses", async () => {
  await withCheckout(async (w) => {
    const status = await onDoneCheck(w, fakeGitHub({ headNode: "failure" }));
    assert.equal(status.outcome, "done", `${status.summary} ${JSON.stringify(status.findings)}`);
    assert.deepEqual(status.findings, []);
  });
});

// TST-1216106 · level: unit · module: MOD-workflow-entries
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; UC-027
// given: the pull request of TST-1210101, the server reporting the head's check node green; the run's statuses green but for one job: (a) pull-request.unit.2 left no status — a job that failed before its end, was cancelled or ran out of time —; (b) pull-request.unit.2 holds `failed: the command ended with status 1`; (c) records.status is missing
// input: onDoneCheck on the event pull_request with AGENT_M_EXPECTED unit:2,component:1
// expect: each outcome `failed`; a finding names the job — (a) and (b) pull-request.unit.2, (c) records —, and no finding names a job that is green
test("onDoneCheck — a missing or other status is not green, and the finding names the job", async () => {
  const { ["pull-request.unit.2.status"]: _unit2, ...withoutUnit2 } = GREEN;
  const { ["records.status"]: _records, ...withoutRecords } = GREEN;
  for (const [statuses, job] of [[withoutUnit2, "pull-request.unit.2"], [{ ...GREEN, "pull-request.unit.2.status": "failed: the command ended with status 1\n" }, "pull-request.unit.2"],
    [withoutRecords, "records"]]) {
    await withCheckout(async (w) => {
      const status = await onDoneCheck(w, fakeGitHub());
      assert.equal(status.outcome, "failed", `${job}: ${status.summary}`);
      const named = status.findings.filter((found) => `${found.artifact} ${found.what}`.includes(job));
      assert.ok(named.length >= 1, `${job}: ${JSON.stringify(status.findings)}`);
      for (const green of ["pull-request.unit.1", "pull-request.component.1"]) {
        assert.ok(!status.findings.some((found) => `${found.artifact} ${found.what}`.includes(green)), `${green} is green: ${JSON.stringify(status.findings)}`);
      }
    }, { statuses });
  }
});

// TST-1216107 · level: unit · module: MOD-workflow-entries
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; UC-027
// given: the pull request of TST-1210101 with the run's green statuses; the job `agent-m done` is given no AGENT_M_EXPECTED
// input: onDoneCheck on the event pull_request
// expect: outcome `not run`, its summary naming AGENT_M_EXPECTED — without it, which jobs the run holds is not known, and no status is taken as green
test("onDoneCheck — without AGENT_M_EXPECTED the entry does not run", async () => {
  await withCheckout(async (w) => {
    const status = await onDoneCheck(w, fakeGitHub(), { expected: null });
    assert.equal(status.outcome, "not run", status.summary);
    assert.match(status.summary, /AGENT_M_EXPECTED/);
  });
});

// TST-1382001 · level: unit · module: MOD-workflow-entries
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; A PULL REQUEST'S CI RUNS WITHIN TWO MINUTES
// given: the checkout of TST-1210101 with the run's green statuses; the event's pull request #7, as GitHub's payload holds it, titled "Merge sprint/team1/141 into main" with an empty description — it names no job —, and the server answering the same; counter-proof: the event's pull request titled "JOB-20261025-0900-a1b2: implement ITM-001" with the description "Job: JOB-20261025-0900-a1b2"
// input: onDoneCheck on the event pull_request
// expect: outcome `nothing to do`, the summary saying that the pull request names no job, and no request made to the server — neither the pull request nor its commits read; counter-proof: outcome `done`, the pull request's commits read from the server
test("onDoneCheck — a pull request whose event names no job ends with nothing to do before its commits are read", async () => {
  const sprint = { number: 7, title: "Merge sprint/team1/141 into main", body: "" };
  await withCheckout(async (w) => {
    const server = fakeGitHub({ title: sprint.title, body: sprint.body });
    const status = await onDoneCheck(w, server);
    assert.equal(status.outcome, "nothing to do", status.summary);
    assert.match(status.summary, /no job/);
    assert.deepEqual(server.calls, [], "nothing is read from the server");
  }, { pullRequest: sprint });
  await withCheckout(async (w) => {
    const server = fakeGitHub();
    const status = await onDoneCheck(w, server);
    assert.equal(status.outcome, "done", `${status.summary} ${JSON.stringify(status.findings)}`);
    assert.ok(server.calls.includes(`${API}/pulls/7/commits`), "the commits of the pull request were read");
  }, { pullRequest: { number: 7, title: `${JOB}: implement ITM-001`, body: `Job: ${JOB}` } });
});
