// MOD-trace-pages' detail of a test (`trace/tests/<TST>`) draws each mark of the test's history with a link to its run, and asks the server whether it still keeps the run's log (ciRunLog) only when
// the person opens that link (ITM-1275). The behaviour is docs/architecture/MOD-trace-pages.md's: "The link to the full log is `WebLinks`' `run` for that id. Whether the server still keeps the log is
// asked when the person opens the link, with `ciRunLog` for that run alone; where it gives `null`, the link reads *no longer available*, and the mark keeps its outcome (UC-029 5b)."
//
// Run: node --test tests/trace-pages-test-history-logs.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// Level: component
//
// The route is called through its public Route.render with the key "tests" and the param row. The product's Host is the one of tests/trace-pages-harness.mjs (its snapshots hold the files and the
// records of the branch `test-results`), except for `webLinks` and `ciRunLog`, which are MOD-repository-hosts' own for a GitHub repository (`connect`), so that opening a log goes through the real
// adapter (jobLogs: the run's jobs, then each job's log) to a counting fake of `fetch`. The fake records each request and answers: the jobs of a run (two jobs each), the log of a job with
// its text, or 410 for every job of the runs it is told are gone. Each case states its expected requests in its own text; none is read from a document. Readings the cases take, each from the sentence quoted:
//   - "Whether the server still keeps the log is asked when the person opens the link" (MOD-trace-pages, Files): the person opens the link by the click on it; before that no request goes to the server's
//     actions (neither the list of a run's jobs nor a job's log), however many commits ran the test.
//   - "with `ciRunLog` for that run alone": the click on a mark's link sends the requests of that mark's run and of no other: the list of its jobs, then the log of each job.
//   - "where it gives `null`, the link reads *no longer available*": a run whose every job log answers 410 gives null; the link then reads "no longer available" and still points at the run's address; the
//     link of a run whose logs are kept reads "log" before and after.
//   - "the mark keeps its outcome": the text of the mark before its link is unchanged by the opening.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost, until } from "./trace-pages-harness.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const ADDRESS = "https://github.com/carol/sprint-tool";
const GITHUB = parseAddress(ADDRESS);
const GH = "/repos/carol/sprint-tool";
const WEB = `${ADDRESS}/actions/runs`;
const SPEC = ["# History fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", ""].join("\n");
const ALPHA = ["// TST-801 · level: unit · module: system", "// guards: ALPHA RULE", "// given: a fixture", "// input: a call", "// expect: a result", "test(\"alpha holds\", () => {});", ""].join("\n");

// Five commits that ran TST-801, K1 to K5, in the order of the records; the run of Kn is 90n.
const COMMITS = [1, 2, 3, 4, 5].map((n) => String(n).repeat(40));
const RUN = (n) => `${WEB}/90${n}`;
function record(commit, n) {
  const front = ["---", `commit: ${commit}`, "levels:", "  - unit", "occasion: commit", "participant: ci", "date: 2026-10-07 10:00 UTC", `run: ${RUN(n)}`, "---"].join("\n");
  return `${front}\n## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n| TST-801 | unit | ${n % 2 ? "passed" : "failed"} | |\n`;
}
const RESULTS = Object.fromEntries(COMMITS.map((commit, at) => [`runs/${commit}/2026100${at + 1}-1000-commit-${at + 1}.md`, record(commit, at + 1)]));
const MAIN_FILES = { "SPEC.md": SPEC, "tests/alpha.test.mjs": ALPHA };

// The counting fake of `fetch`: every request of the product's host while `run` is going on, noted as `<METHOD> <path>`. GitHub's "List jobs for a workflow run" gives two jobs for a run (ids
// <run>1 and <run>2); "Download job logs for a workflow run" gives the job's text, or 410 where the job's run is in `gone`.
async function counting(gone, run) {
  const requests = [], real = globalThis.fetch;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input)).pathname;
    requests.push(`${String(init.method ?? "GET").toUpperCase()} ${path}`);
    const jobs = new RegExp(`^${GH}/actions/runs/(\\d+)/jobs$`).exec(path);
    if (jobs) return json(200, { total_count: 2, jobs: [{ id: Number(`${jobs[1]}1`), name: "tests" }, { id: Number(`${jobs[1]}2`), name: "lint" }] });
    const log = new RegExp(`^${GH}/actions/jobs/(\\d+)/logs$`).exec(path);
    if (log) return gone.includes(log[1].slice(0, -1)) ? json(410, { message: "Logs have expired" }) : new Response(`log of job ${log[1]}\n`, { status: 200, headers: { "Content-Type": "text/plain" } });
    return json(404, { message: `unrouted: ${path}` });
  };
  try { return { result: await run(requests), requests }; } finally { globalThis.fetch = real; }
}

function hostOf() {
  const base = treeHost({ trees: { main: MAIN_FILES, "test-results": RESULTS }, onDefault: COMMITS });
  const adapter = connect(GITHUB, { token: "github_pat_CAROLsprintTOOL0123456789abcdef" });
  return { ...base, ciRunLog: (id) => adapter.ciRunLog(id), webLinks: () => adapter.webLinks() };
}
async function render(host) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: ADDRESS, host } }, { key: "tests", ref: "main", row: "TST-801" });
  await until(() => find(target, (node) => String(node.className).split(" ").includes("test-history-commit")).length === 5);
  await new Promise((resolve) => setTimeout(resolve, 30));
  return target;
}
const marksOf = (target) => find(target, (node) => String(node.className).split(" ").includes("test-history-commit"));
const linkOf = (mark) => find(mark, (node) => node.localName === "a")[0];
const open = async (link, done) => { link.dispatchEvent(new Event("click")); await until(done); await new Promise((resolve) => setTimeout(resolve, 30)); };

// TST-1275001 · level: component · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: a test that ran on five commits, each record naming a run of the repository (…/actions/runs/901 to …/905); a counting fake of the server's requests, whose logs are all kept
// input: the detail of the test opened; known positive: opening a log (case TST-1275002) does send requests under …/actions/
// expect: five marks, each with a link to its run's address (…/actions/runs/901 to 905, in the order of the records) reading "log", and no request under …/actions/ — not the list of a run's jobs, not a job's log
test("opening a test sends no request for a run's log, however many commits ran it", async () => {
  const { result: target, requests } = await counting([], async () => render(hostOf()));
  const links = marksOf(target).map(linkOf);
  assert.deepEqual(links.map((link) => link.getAttribute("href")), [1, 2, 3, 4, 5].map(RUN));
  assert.deepEqual(links.map((link) => link.textContent), ["log", "log", "log", "log", "log"]);
  assert.deepEqual(requests.filter((request) => request.includes("/actions/")), []);
});

// TST-1275002 · level: component · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the detail of TST-1275001, with the logs of the run 903 gone: the server answers 410 for each of its two jobs
// input: the link of the third mark opened (clicked)
// expect: exactly the requests of run 903 — GET …/actions/runs/903/jobs, GET …/actions/jobs/9031/logs, GET …/actions/jobs/9032/logs — and no other under …/actions/; the third link then reads "no longer available" and still points at …/actions/runs/903; the mark's text before it is "3333333 passed", unchanged; the other four links still read "log"
test("opening the third mark's log asks for that run alone, and a run whose logs are gone then reads no longer available", async () => {
  const { requests } = await counting(["903"], async () => {
    const target = await render(hostOf());
    const marks = marksOf(target), link = linkOf(marks[2]);
    assert.equal(link.textContent, "log", "known positive: the link reads log until it is opened");
    await open(link, () => link.textContent !== "log");
    assert.equal(link.textContent, "no longer available");
    assert.equal(link.getAttribute("href"), RUN(3));
    assert.match(marks[2].textContent, /^3333333 passed\b/);
    assert.deepEqual(marksOf(target).filter((mark) => mark !== marks[2]).map((mark) => linkOf(mark).textContent), ["log", "log", "log", "log"]);
  });
  assert.deepEqual(requests.filter((request) => request.includes("/actions/")), [`GET ${GH}/actions/runs/903/jobs`, `GET ${GH}/actions/jobs/9031/logs`, `GET ${GH}/actions/jobs/9032/logs`]);
});

// TST-1275003 · level: component · module: MOD-trace-pages
// guards: UC-029
// given: the detail of TST-1275001, with the logs of the run 903 gone and those of the run 901 kept
// input: the link of the first mark opened
// expect: exactly the requests of run 901 — its jobs, then the logs of jobs 9011 and 9012 — and the link still reads "log" at …/actions/runs/901; the link of the third mark, not opened, still reads "log"
test("opening a mark whose log is kept leaves its link reading log and touches no other run", async () => {
  const { requests } = await counting(["903"], async (requests) => {
    const target = await render(hostOf());
    const marks = marksOf(target), link = linkOf(marks[0]);
    await open(link, () => requests.filter((request) => request.includes("/logs")).length === 2);
    assert.equal(link.textContent, "log");
    assert.equal(link.getAttribute("href"), RUN(1));
    assert.equal(linkOf(marks[2]).textContent, "log", "the link of a run not opened is not asked about");
  });
  assert.deepEqual(requests.filter((request) => request.includes("/actions/")), [`GET ${GH}/actions/runs/901/jobs`, `GET ${GH}/actions/jobs/9011/logs`, `GET ${GH}/actions/jobs/9012/logs`]);
});
