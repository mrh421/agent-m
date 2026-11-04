// MOD-workflow-entries' entry onTestsFinished (ITM-1209, ITM-1216), as the accepted text of docs/architecture/MOD-workflow-entries.md states it: "in a product, in the job
// `agent-m records` of MOD-test-schedule's configuration, after the run's test jobs: the run's one result record — the commit, the levels run, the occasion, who ran it, the
// date, the run's address, `uncommitted` when the working tree held changes not in the commit, and each test's outcome with the excerpts of its failures — added to the branch
// `test-results` [...]. It reads the outcomes from all the reports of the run together, matched to the declarations of the product's tests; the levels run are the rows that
// left a report, `paid` standing for the levels of the tests it ran, and the occasion is the one the reports' names give. A level that did not run is not recorded as passed,
// and a test whose shard left no report is recorded `not run`. A report that MOD-result-records' `parseOutcomes` refuses as unreadable [...] counts as no report of that shard:
// it is left out, the others are read again, and the record is still added. [...] every test of that shard's row — the files `testsOfRow` names for it — for which no readable
// report holds a case reads `not run` with the reason `report unreadable: <file>`, naming every unreadable report of the row. The tests of a row whose status is `not run:
// secret missing: <name>` — the files `testsOfRow` names for it — read `not run` with the reason `secret missing: <name>`, never `failed` (UC-027 4a). On `Moved` it reads the
// branch again and adds again; a record that cannot be added ends the entry with `failed` [...]. A run without a report or a status ends `nothing to do`."; and *The reports of
// a run*: "`agent-m records` writes `agent-m-reports/records.status` the same way, with `onTestsFinished`'s outcome."; UC-028 step 7.
// Run: node --test tests/workflow-entries-tests-finished.test.mjs
//
// Module: MOD-workflow-entries
// Guards: EVERY TEST RUN LEAVES A RESULT RECORD; TEST RESULTS ARE KEPT IN THE REPOSITORY; A RESULT RECORD IS NEVER REWRITTEN; UC-027; UC-028
// Level: unit
//
// Deterministic, no network. The product's checkout is a temporary git repository laid out as MOD-test-schedule's generated job `agent-m records` lays it out: the workspace
// is the product's checkout, and its folder agent-m-reports/ holds every test job's report and status, agent-m-reports/<occasion>.<row>.<shard>.xml and .status
// (MOD-workflow-entries, Data: The reports of a run). The branch `test-results` is served by a fake of GitHub's REST API (the Git database endpoints a commit through
// MOD-repository-hosts uses: the commit, its tree, the branch's reference, a new tree, a new commit, the reference moved fast-forward only), which `fetch` is replaced with.
// The readings, named in the pull request:
//   - The person's Agent M token is read as every product entry reads it, AGENT_M_TOKEN; the record is added through the server's API with it, since the job's checkout
//     holds the commit under test with the workflow's read-only token.
//   - Who ran it is the CI service's runner, by the name the runner gives (RUNNER_NAME); the run's address is the run's page.
//   - The outcomes recorded are those of the declared tests of the rows that left a report or a status, and each undeclared case, given the level of its report's row; a
//     declared test of a row that left neither is not recorded, passed or not.
//   - An unreadable report is named by its path below the checkout, agent-m-reports/<occasion>.<row>.<shard>.xml.
//   - The status agent-m-reports/records.status is one line: `done`, `nothing to do`, or the outcome and its reason, `failed: <why>`, `not run: <why>`.
//   - The commit is the one the checkout holds; changes of tracked files make the record `uncommitted`, files the run adds — the reports among them — do not.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDocument } from "../src/documents/index.mjs";
import { resultSchema } from "../src/result-records/index.mjs";

process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_SYSTEM = "/dev/null";
process.env.GIT_TERMINAL_PROMPT = "0";

const { runEntry } = await import("../src/workflow-entries/main.mjs");

// ---------------------------------------------------------------- the fixtures

const NOW = new Date("2026-10-25T09:30:00Z");
const TOKEN = "ghp_ALICEagentMtoken0123456789abcdef";
const API = "https://api.github.com/repos/alice/thesis-tool";
const RUN = "https://github.com/alice/thesis-tool/actions/runs/4711";
const OLD = "runs/0123456789abcdef0123456789abcdef01234567/20261024-1200-commit-ab12.md";

const declared = (id, level, expect, extra = []) => [`// ${id} · level: ${level} · module: MOD-store`, "// guards: A LOAN HAS A DUE DATE", "// given: a loan",
  "// input: its date", `// expect: ${expect}`, ...extra.map((line) => `// ${line}`), `test("${id} a loan", () => {});`, ""].join("\n");
// The unit tests TST-001 to TST-003, the component test TST-004, and the system test TST-005, which calls the paid service model-endpoint: the row paid runs it.
const TESTS = {
  "tests/store.test.mjs": ["// Module: MOD-store", "// Level: unit", "", declared("TST-001", "unit", "the due date"), declared("TST-002", "unit", "fourteen days"),
    declared("TST-003", "unit", "a reminder")].join("\n"),
  "tests/store-flow.test.mjs": ["// Module: MOD-store", "// Level: component", "", declared("TST-004", "component", "the loan is stored")].join("\n"),
  "tests/store-model.test.mjs": ["// Module: MOD-store", "// Level: system", "", declared("TST-005", "system", "a summary of the loan", ["paid: model-endpoint"])].join("\n"),
};
const suite = (...cases) => ["<?xml version=\"1.0\" encoding=\"utf-8\"?>", "<testsuites>", "<testsuite name=\"tests\">", ...cases, "</testsuite>", "</testsuites>"].join("\n");
const passes = (id) => `<testcase name="${id} a loan" time="0.01"/>`;
const skips = (id) => `<testcase name="${id} a loan"><skipped/></testcase>`;
const fails = (id) => `<testcase name="${id} a loan" time="0.01"><failure message="expected 14, got 7">AssertionError: expected 14 | got 7\n    at tests/store.test.mjs:12</failure></testcase>`;
// The unit row's report: TST-001 passes; TST-002 fails with a message and a log holding a bar and a second line; TST-003 has no case; one case names no test.
const REPORT = suite(passes("TST-001"), fails("TST-002"), "<testcase name=\"a stray case\" time=\"0.01\"/>");
// A report cut off by a time limit, and a text that is no report at all.
const CUT_OFF = suite(passes("TST-002")).slice(0, 80);
const NO_REPORT = "Error: the job ran out of memory\n";

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

// The product's checkout, as the job `agent-m records` leaves it: one commit, and the reports and statuses the run's test jobs kept, taken into agent-m-reports/ —
// `reports` maps each file's name in that folder to its text.
async function withCheckout(reports, run) {
  const root = mkdtempSync(join(tmpdir(), "agent-m-tests-finished-"));
  const checkout = join(root, "product");
  try {
    mkdirSync(checkout);
    git(checkout, "init", "-q", "-b", "main");
    git(checkout, "config", "user.name", "Seed");
    git(checkout, "config", "user.email", "seed@example.org");
    write(checkout, { "README.md": "# Thesis tool\n", "src/store/index.mjs": "export const due = 14;\n", ...TESTS });
    git(checkout, "add", "-A");
    git(checkout, "commit", "-q", "-m", "first");
    write(checkout, Object.fromEntries(Object.entries(reports).map(([name, text]) => [`agent-m-reports/${name}`, text])));
    return await run({ checkout, head: git(checkout, "rev-parse", "HEAD") });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
// The reports and statuses of a run whose one test job, of the row unit, kept `report` and ended done, on the occasion `occasion`.
const unitRun = (report, occasion = "commit") => ({ [`${occasion}.unit.1.xml`]: report, [`${occasion}.unit.1.status`]: "done\n" });

// A fake of GitHub's REST API for the repository alice/thesis-tool, which holds the branch test-results. `refuseWrite` answers the new tree with that status;
// `moveOnce` lands another run's record on the branch just before the first move of the reference.
function fakeGitHub({ refuseWrite = null, moveOnce = null } = {}) {
  let made = 0;
  const commits = new Map(), trees = new Map(), calls = [];
  const id = () => createHash("sha1").update(`fake ${++made}`).digest("hex");
  const commitOf = (tree, parent) => { const sha = id(); trees.set(sha, tree); commits.set(sha, { tree: sha, parent }); return sha; };
  const state = { head: commitOf(new Map([["README.md", "# Test results\n"], [OLD, "an older record\n"]]), null), calls, written: [] };
  state.files = (at = state.head) => trees.get(commits.get(at).tree);
  const answer = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  let moved = false;
  state.fetch = async (address, init = {}) => {
    const url = new URL(String(address)), method = init.method ?? "GET", path = `${url.origin}${url.pathname}`;
    calls.push(`${method} ${path}`);
    const body = init.body ? JSON.parse(init.body) : null;
    if (method === "GET" && (path === `${API}/commits/test-results` || commits.has(path.slice(`${API}/commits/`.length)))) {
      const sha = path.endsWith("/test-results") ? state.head : path.slice(`${API}/commits/`.length);
      return answer(200, { sha });
    }
    if (method === "GET" && path.startsWith(`${API}/git/trees/`)) {
      const tree = trees.get(path.slice(`${API}/git/trees/`.length));
      return tree ? answer(200, { tree: [...tree.keys()].map((p) => ({ path: p, type: "blob", sha: createHash("sha1").update(tree.get(p)).digest("hex") })) }) : answer(404, { message: "Not Found" });
    }
    if (method === "GET" && path === `${API}/git/ref/heads/test-results`) return answer(200, { object: { sha: state.head } });
    if (method === "GET" && path.startsWith(`${API}/git/commits/`)) {
      const sha = path.slice(`${API}/git/commits/`.length);
      return commits.has(sha) ? answer(200, { sha, tree: { sha: commits.get(sha).tree } }) : answer(404, { message: "Not Found" });
    }
    if (method === "POST" && path === `${API}/git/trees`) {
      if (refuseWrite) return answer(refuseWrite, { message: "Resource not accessible by personal access token" });
      const tree = new Map(trees.get(body.base_tree));
      for (const entry of body.tree) tree.set(entry.path, entry.content);
      const sha = id();
      trees.set(sha, tree);
      return answer(201, { sha });
    }
    if (method === "POST" && path === `${API}/git/commits`) {
      const sha = id();
      commits.set(sha, { tree: body.tree, parent: body.parents[0] });
      state.written.push(body.message);
      return answer(201, { sha, html_url: `https://github.com/alice/thesis-tool/commit/${sha}` });
    }
    if (method === "PATCH" && path === `${API}/git/refs/heads/test-results`) {
      if (moveOnce && !moved) {
        moved = true;
        state.head = commitOf(new Map([...state.files(), [moveOnce, "another run's record\n"]]), state.head);
      }
      if (commits.get(body.sha)?.parent !== state.head || body.force) return answer(422, { message: "Update is not a fast forward" });
      state.head = body.sha;
      return answer(200, { object: { sha: body.sha } });
    }
    throw new TypeError(`fetch failed: the fake GitHub does not serve ${method} ${path}`);
  };
  return state;
}

// The entry, run in the job `agent-m records` of GitHub Actions after a push, with the fake server in place of the network.
async function onTestsFinished(w, server, { token = TOKEN } = {}) {
  const real = globalThis.fetch;
  globalThis.fetch = server ? server.fetch : async () => { throw new Error("no request may be made"); };
  try {
    return await runEntry("onTestsFinished", { GITHUB_ACTIONS: "true", GITHUB_EVENT_NAME: "push", GITHUB_REF_TYPE: "branch", GITHUB_WORKSPACE: w.checkout,
      GITHUB_SERVER_URL: "https://github.com", GITHUB_REPOSITORY: "alice/thesis-tool", GITHUB_REF_NAME: "main", GITHUB_SHA: w.head, GITHUB_RUN_ID: "4711",
      GITHUB_ACTOR: "alice", RUNNER_NAME: "GitHub Actions 7", AGENT_M_INSTANCE_COMMIT: "f".repeat(40), ...(token ? { AGENT_M_TOKEN: token } : {}) }, { now: NOW });
  } finally { globalThis.fetch = real; }
}

// The records the run added: the paths under runs/ that the branch holds now and did not hold before, each read with the record's schema.
function added(server) {
  return [...server.files().keys()].filter((path) => path.startsWith("runs/") && path !== OLD && !server.files().get(path).startsWith("another run"))
    .map((path) => readDocument(resultSchema.run, path, server.files().get(path)));
}
const rows = (record, heading) => record.sections.find((section) => section.heading === heading)?.rows.map((row) => row.cells) ?? [];
const outcomeOf = (record, test) => rows(record, "## Outcomes").find((row) => row.Test === test);
const recordsStatus = (w) => (existsSync(join(w.checkout, "agent-m-reports", "records.status")) ? readFileSync(join(w.checkout, "agent-m-reports", "records.status"), "utf8") : null);

// ---------------------------------------------------------------- the tests

// TST-1209101 · level: unit · module: MOD-workflow-entries
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; TEST RESULTS ARE KEPT IN THE REPOSITORY; A RESULT RECORD IS NEVER REWRITTEN; UC-028
// given: a clean checkout of the product at one commit with the unit tests TST-001, TST-002, TST-003, the component test TST-004 and the paid system test TST-005; the run's one test job, of the row unit on the occasion commit, kept agent-m-reports/commit.unit.1.xml — TST-001 passed, TST-002 failed ("expected 14, got 7", a log of two lines with a bar), an undeclared case "a stray case" — and the status done; the branch test-results holds README.md and one older record; the time 2026-10-25 09:30 UTC
// input: onTestsFinished, run 4711 on the runner "GitHub Actions 7"
// expect: outcome `done`; one commit adds exactly one file runs/<commit>/20261025-0930-commit-<4 hex>.md, whose parent is the branch's head, every other file unchanged; its front matter commit <the checkout's commit>, levels [unit], occasion commit, participant "GitHub Actions 7", date "2026-10-25 09:30 UTC", run <the run's page>, no uncommitted; its outcomes TST-001 unit passed, TST-002 unit failed, TST-003 unit not run, "a stray case" unit undeclared, and no row of TST-004 or TST-005; its failures name TST-002 with the expected "fourteen days", the observed "expected 14, got 7" and a log holding "expected 14 | got 7" and "store.test.mjs:12"; the token stands nowhere in it; agent-m-reports/records.status holds the one line `done`
test("onTestsFinished — a run's record is added to test-results with its commit, levels, occasion, runner, date, run address and outcomes", async () => {
  await withCheckout(unitRun(REPORT), async (w) => {
    const server = fakeGitHub();
    const before = server.head, files = new Map(server.files());
    const status = await onTestsFinished(w, server);
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(server.written.length, 1, "one commit");
    assert.equal([...server.files().keys()].length, files.size + 1, "one file added");
    for (const [path, text] of files) assert.equal(server.files().get(path), text, `${path} unchanged`);
    assert.notEqual(server.head, before);
    const [record] = added(server);
    assert.match(record.path, new RegExp(`^runs/${w.head}/20261025-0930-commit-[0-9a-f]{4}\\.md$`));
    assert.deepEqual({ ...record.fields }, { commit: w.head, levels: ["unit"], occasion: "commit", participant: "GitHub Actions 7", date: "2026-10-25 09:30 UTC", run: RUN });
    assert.equal(outcomeOf(record, "TST-001")?.Outcome, "passed");
    assert.equal(outcomeOf(record, "TST-002")?.Outcome, "failed");
    assert.equal(outcomeOf(record, "TST-003")?.Outcome, "not run");
    assert.deepEqual([outcomeOf(record, "a stray case")?.Level, outcomeOf(record, "a stray case")?.Outcome], ["unit", "undeclared"]);
    for (const test of ["TST-001", "TST-002", "TST-003"]) assert.equal(outcomeOf(record, test).Level, "unit", test);
    assert.equal(outcomeOf(record, "TST-004"), undefined, "a test of a level not run is not recorded");
    assert.equal(outcomeOf(record, "TST-005"), undefined, "a test of a row not run is not recorded");
    const [failure] = rows(record, "## Failures");
    assert.equal(failure.Test, "TST-002");
    assert.equal(failure.Expected, "fourteen days");
    assert.equal(failure.Observed, "expected 14, got 7");
    assert.ok(failure.Log.includes("expected 14 | got 7") && failure.Log.includes("store.test.mjs:12"), failure.Log);
    assert.ok(!server.files().get(record.path).includes(TOKEN));
    assert.equal(git(w.checkout, "rev-parse", "HEAD"), w.head, "the checkout is left as it was");
    assert.equal(recordsStatus(w), "done\n");
  });
});

// TST-1209102 · level: unit · module: MOD-workflow-entries
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-028
// given: the same checkout; (a) the row unit's report, whose cases of TST-001, TST-002 and TST-003 are all skipped; (b) only the row component's report commit.component.1.xml, which holds no case
// input: onTestsFinished
// expect: (a) `done`, levels [unit], TST-001, TST-002 and TST-003 each `not run`, none passed; (b) `done`, levels [component], TST-004 `not run`, and no row of a unit test — a level that did not run is not recorded as passed
test("onTestsFinished — a level that did not run is not recorded as passed", async () => {
  await withCheckout(unitRun(suite(skips("TST-001"), skips("TST-002"), skips("TST-003"))), async (w) => {
    const server = fakeGitHub();
    const status = await onTestsFinished(w, server);
    assert.equal(status.outcome, "done", status.summary);
    const [record] = added(server);
    assert.deepEqual(record.fields.levels, ["unit"]);
    for (const test of ["TST-001", "TST-002", "TST-003"]) assert.equal(outcomeOf(record, test)?.Outcome, "not run", test);
    assert.ok(!rows(record, "## Outcomes").some((row) => row.Outcome === "passed"));
  });
  await withCheckout({ "commit.component.1.xml": suite(), "commit.component.1.status": "done\n" }, async (w) => {
    const server = fakeGitHub();
    const status = await onTestsFinished(w, server);
    assert.equal(status.outcome, "done", status.summary);
    const [record] = added(server);
    assert.deepEqual(record.fields.levels, ["component"]);
    assert.equal(outcomeOf(record, "TST-004")?.Outcome, "not run");
    assert.ok(!rows(record, "## Outcomes").some((row) => row.Level === "unit"), "no outcome of the level unit, which did not run");
  });
});

// TST-1209103 · level: unit · module: MOD-workflow-entries
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-028
// given: the checkout and the unit row's report of TST-1209101, kept under the names of the occasions pull-request, nightly, on-demand and release-candidate; the job runs after a push
// input: onTestsFinished
// expect: each `done`; the records' occasions pull-request, nightly, on-demand and release-candidate — the one the reports' names give —, each in its record's path
test("onTestsFinished — the occasion is the one the reports' names give", async () => {
  for (const occasion of ["pull-request", "nightly", "on-demand", "release-candidate"]) {
    await withCheckout(unitRun(REPORT, occasion), async (w) => {
      const server = fakeGitHub();
      const status = await onTestsFinished(w, server);
      assert.equal(status.outcome, "done", `${occasion}: ${status.summary}`);
      const [record] = added(server);
      assert.equal(record.fields.occasion, occasion);
      assert.match(record.path, new RegExp(`-${occasion}-[0-9a-f]{4}\\.md$`));
    });
  }
});

// TST-1209104 · level: unit · module: MOD-workflow-entries
// guards: A RESULT RECORD IS NEVER REWRITTEN; TEST RESULTS ARE KEPT IN THE REPOSITORY
// given: the checkout and report of TST-1209101; the branch test-results moves on — another run's record lands — after the entry read it and before its reference is moved
// input: onTestsFinished
// expect: `done`; the branch holds the other run's record unchanged and this run's record, added on top of it; nothing was forced
test("onTestsFinished — on Moved it reads the branch again and adds again", async () => {
  await withCheckout(unitRun(REPORT), async (w) => {
    const other = `runs/${"e".repeat(40)}/20261025-0929-commit-cd34.md`;
    const server = fakeGitHub({ moveOnce: other });
    const status = await onTestsFinished(w, server);
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(server.files().get(other), "another run's record\n", "the other run's record is kept");
    assert.equal(added(server).length, 1, "this run's record is added");
    assert.ok(server.calls.filter((call) => call === `PATCH ${API}/git/refs/heads/test-results`).length >= 2, "the reference was moved again after the refusal");
  });
});

// TST-1209105 · level: unit · module: MOD-workflow-entries
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; A RESULT RECORD IS NEVER REWRITTEN
// given: the checkout and report of TST-1209101; the server refuses the write with 403 "Resource not accessible by personal access token"
// input: onTestsFinished
// expect: outcome `failed`, its summary saying that the record was not added; the branch test-results is unchanged; agent-m-reports/records.status holds one line beginning `failed: `
test("onTestsFinished — a record that cannot be added ends the entry failed", async () => {
  await withCheckout(unitRun(REPORT), async (w) => {
    const server = fakeGitHub({ refuseWrite: 403 });
    const before = server.head;
    const status = await onTestsFinished(w, server);
    assert.equal(status.outcome, "failed", status.summary);
    assert.match(status.summary, /not added/);
    assert.equal(server.head, before);
    assert.match(recordsStatus(w), /^failed: [^\n]+\n$/);
  });
});

// TST-1209106 · level: unit · module: MOD-workflow-entries
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; NO SECRET IN THE REPOSITORY
// given: the checkout and report of TST-1209101; the person's token AGENT_M_TOKEN is not set
// input: onTestsFinished
// expect: outcome `not run`, its summary naming AGENT_M_TOKEN; no request is made, nothing is written to a repository; agent-m-reports/records.status holds one line beginning `not run: ` that names AGENT_M_TOKEN
test("onTestsFinished — a missing secret ends the entry before anything is written", async () => {
  await withCheckout(unitRun(REPORT), async (w) => {
    const status = await onTestsFinished(w, null, { token: null });
    assert.equal(status.outcome, "not run", status.summary);
    assert.match(status.summary, /AGENT_M_TOKEN/);
    assert.match(recordsStatus(w), /^not run: [^\n]*AGENT_M_TOKEN[^\n]*\n$/);
  });
});

// TST-1209107 · level: unit · module: MOD-workflow-entries
// guards: EVERY TEST RUN LEAVES A RESULT RECORD
// given: a checkout into which the run's test jobs kept no report and no status; the token is set
// input: onTestsFinished
// expect: outcome `nothing to do`; no request is made, nothing is written to a repository; agent-m-reports/records.status holds the one line `nothing to do`
test("onTestsFinished — a run without a report or a status ends nothing to do", async () => {
  await withCheckout({}, async (w) => {
    const status = await onTestsFinished(w, null);
    assert.equal(status.outcome, "nothing to do", status.summary);
    assert.equal(recordsStatus(w), "nothing to do\n");
  });
});

// TST-1209108 · level: unit · module: MOD-workflow-entries
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-028
// given: the checkout and report of TST-1209101, in which the tracked file src/store/index.mjs was changed after the commit
// input: onTestsFinished
// expect: `done`; the record's front matter holds uncommitted: true; in TST-1209101 — the reports alone added to the working tree — it holds none
test("onTestsFinished — a working tree with changes not in the commit makes the record uncommitted", async () => {
  await withCheckout(unitRun(REPORT), async (w) => {
    writeFileSync(join(w.checkout, "src/store/index.mjs"), "export const due = 7;\n");
    const server = fakeGitHub();
    const status = await onTestsFinished(w, server);
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(added(server)[0].fields.uncommitted, "true");
  });
});

// TST-1216101 · level: unit · module: MOD-workflow-entries
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-028
// given: the checkout of TST-1209101; a run on the occasion pull-request whose row unit ran in two shards — agent-m-reports/pull-request.unit.1.xml: TST-001 and TST-002 passed; pull-request.unit.2.xml: TST-003 failed — and whose row component ran in one, pull-request.component.1.xml: TST-004 passed; each shard's status done
// input: onTestsFinished
// expect: outcome `done`; one commit adds one record, runs/<commit>/20261025-0930-pull-request-<4 hex>.md, with levels [unit, component] and occasion pull-request; its outcomes TST-001 passed, TST-002 passed, TST-003 failed, TST-004 passed, each with an empty Reason, and no row of TST-005; records.status `done`
test("onTestsFinished — the reports of a run's shards and rows give one record", async () => {
  await withCheckout({ "pull-request.unit.1.xml": suite(passes("TST-001"), passes("TST-002")), "pull-request.unit.1.status": "done\n",
    "pull-request.unit.2.xml": suite(fails("TST-003")), "pull-request.unit.2.status": "failed: the command ended with status 1\n",
    "pull-request.component.1.xml": suite(passes("TST-004")), "pull-request.component.1.status": "done\n" }, async (w) => {
    const server = fakeGitHub();
    const status = await onTestsFinished(w, server);
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(server.written.length, 1, "one commit");
    const records = added(server);
    assert.equal(records.length, 1, "one record");
    const [record] = records;
    assert.match(record.path, new RegExp(`^runs/${w.head}/20261025-0930-pull-request-[0-9a-f]{4}\\.md$`));
    assert.deepEqual(record.fields.levels, ["unit", "component"]);
    assert.equal(record.fields.occasion, "pull-request");
    for (const [test, outcome] of [["TST-001", "passed"], ["TST-002", "passed"], ["TST-003", "failed"], ["TST-004", "passed"]]) {
      assert.equal(outcomeOf(record, test)?.Outcome, outcome, test);
      assert.equal(outcomeOf(record, test)?.Reason ?? "", "", `${test} has no reason`);
    }
    assert.equal(outcomeOf(record, "TST-005"), undefined);
    assert.equal(recordsStatus(w), "done\n");
  });
});

// TST-1216102 · level: unit · module: MOD-workflow-entries
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-028
// given: the checkout of TST-1209101; a run on the occasion pull-request whose row unit ran in three shards — pull-request.unit.1.xml: TST-001 passed; pull-request.unit.2.xml cut off by its time limit; pull-request.unit.3.xml no JUnit XML report at all — and whose row component left pull-request.component.1.xml: TST-004 passed
// input: onTestsFinished
// expect: outcome `done`; the record is added, with levels [unit, component]; TST-001 passed and TST-004 passed, each with an empty Reason; TST-002 and TST-003 each `not run`, their Reason beginning `report unreadable: ` and naming agent-m-reports/pull-request.unit.2.xml and agent-m-reports/pull-request.unit.3.xml; no test is `failed`
test("onTestsFinished — an unreadable report is left out, its row's tests without a case read not run with the reason, and the record is still added", async () => {
  await withCheckout({ "pull-request.unit.1.xml": suite(passes("TST-001")), "pull-request.unit.1.status": "done\n", "pull-request.unit.2.xml": CUT_OFF,
    "pull-request.unit.3.xml": NO_REPORT, "pull-request.unit.3.status": "failed: the command ended with status 1\n",
    "pull-request.component.1.xml": suite(passes("TST-004")), "pull-request.component.1.status": "done\n" }, async (w) => {
    const server = fakeGitHub();
    const status = await onTestsFinished(w, server);
    assert.equal(status.outcome, "done", status.summary);
    const [record] = added(server);
    assert.ok(record, "the record is added");
    assert.deepEqual(record.fields.levels, ["unit", "component"]);
    for (const test of ["TST-001", "TST-004"]) {
      assert.equal(outcomeOf(record, test)?.Outcome, "passed", test);
      assert.equal(outcomeOf(record, test)?.Reason ?? "", "", test);
    }
    for (const test of ["TST-002", "TST-003"]) {
      const row = outcomeOf(record, test);
      assert.equal(row?.Outcome, "not run", test);
      assert.match(row.Reason, /^report unreadable: /, test);
      assert.ok(row.Reason.includes("agent-m-reports/pull-request.unit.2.xml") && row.Reason.includes("agent-m-reports/pull-request.unit.3.xml"), row.Reason);
    }
    assert.ok(!rows(record, "## Outcomes").some((row) => row.Outcome === "failed"));
  });
});

// TST-1216103 · level: unit · module: MOD-workflow-entries
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-027; UC-028
// given: the checkout of TST-1209101; a nightly run whose row unit left nightly.unit.1.xml — TST-001, TST-002 and TST-003 passed — and the status done, and whose row paid left no report and the status `not run: secret missing: MODEL_KEY`
// input: onTestsFinished
// expect: outcome `done`; the record's levels [unit]; TST-005, the paid row's test, recorded with its level system, `not run`, its Reason `secret missing: MODEL_KEY` — never `failed`; the unit tests passed, with an empty Reason
test("onTestsFinished — the tests of a row whose secret was missing read not run with that reason", async () => {
  await withCheckout({ "nightly.unit.1.xml": suite(passes("TST-001"), passes("TST-002"), passes("TST-003")), "nightly.unit.1.status": "done\n",
    "nightly.paid.1.status": "not run: secret missing: MODEL_KEY\n" }, async (w) => {
    const server = fakeGitHub();
    const status = await onTestsFinished(w, server);
    assert.equal(status.outcome, "done", status.summary);
    const [record] = added(server);
    assert.deepEqual(record.fields.levels, ["unit"]);
    const paid = outcomeOf(record, "TST-005");
    assert.deepEqual([paid?.Level, paid?.Outcome, paid?.Reason], ["system", "not run", "secret missing: MODEL_KEY"]);
    for (const test of ["TST-001", "TST-002", "TST-003"]) assert.deepEqual([outcomeOf(record, test)?.Outcome, outcomeOf(record, test)?.Reason ?? ""], ["passed", ""], test);
    assert.ok(!rows(record, "## Outcomes").some((row) => row.Outcome === "failed"));
  });
});

// TST-1216104 · level: unit · module: MOD-workflow-entries
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-028
// given: the checkout of TST-1209101; a nightly run whose row unit left nightly.unit.1.xml — TST-001, TST-002 and TST-003 passed — and whose row paid left nightly.paid.1.xml — TST-005 passed —, each with the status done
// input: onTestsFinished
// expect: outcome `done`; the record's levels [unit, system] — the row paid stands for the level of the test it ran —; TST-005 passed with its level system
test("onTestsFinished — the row paid stands for the levels of the tests it ran", async () => {
  await withCheckout({ "nightly.unit.1.xml": suite(passes("TST-001"), passes("TST-002"), passes("TST-003")), "nightly.unit.1.status": "done\n",
    "nightly.paid.1.xml": suite(passes("TST-005")), "nightly.paid.1.status": "done\n" }, async (w) => {
    const server = fakeGitHub();
    const status = await onTestsFinished(w, server);
    assert.equal(status.outcome, "done", status.summary);
    const [record] = added(server);
    assert.deepEqual(record.fields.levels, ["unit", "system"]);
    assert.deepEqual([outcomeOf(record, "TST-005")?.Level, outcomeOf(record, "TST-005")?.Outcome], ["system", "passed"]);
  });
});
