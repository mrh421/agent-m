// Release tests of ITM-1275 — UC-029 step 5 and 5b on the detail of a test: the history draws one mark per commit that ran the test, each with a link to the run, and the server is asked whether it still keeps the
// run's log only when the person opens that link. The behaviour is docs/architecture/MOD-trace-pages.md's (Files: "The link to the full log is `WebLinks`' `run` for that id. Whether the server still keeps the log is
// asked when the person opens the link, with `ciRunLog` for that run alone; where it gives `null`, the link reads *no longer available*, and the mark keeps its outcome (UC-029 5b).") and UC-029's (5b: "The CI server
// no longer keeps the logs of older runs. The outcomes stay in the history ... and only the link to the full log is marked *no longer available*.").
// Run: node --test tests/release-itm-1275-history-log-on-open.test.mjs
//
// Module: MOD-trace-pages
// Guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// Level: release
//
// Written for the release testing of sprint 114 by a participant who implemented none of ITM-1275 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementers' cases
// (tests/trace-pages-test-history-logs.test.mjs) take one product of five commits over a counting fake of GitHub and open three links of it; these cases take their own product, six commits whose runs
// have other numbers and whose outcomes include failed ones, and meet the page from the outside: what the product's host is asked while the history is drawn and when a link is clicked, and what the
// link reads afterwards. Two hosts are used. The first is the real GitHub adapter of MOD-repository-hosts (`connect`) over a counting fake of `fetch`, for the requests that reach the server. The second stands in
// for the interface of MOD-repository-hosts (`webLinks`, the adapter's own, and `ciRunLog`, a stand-in that records the run it is asked about and answers as each case says), for the answers a server gives and the
// way a call can fail. No request leaves the process. Readings the texts leave open, taken here:
//   - "when the person opens the link" is read as the click on the link; a link is found by the address of its run, never by its place among the marks.
//   - "asked ... with `ciRunLog` for that run alone" is read as one call of ciRunLog for each run whose link was clicked, with the run's id (the last part of its address), and none for a run not clicked; a second click
//     on a link already asked about, or while the asking is still going on, asks nothing more.
//   - "where it gives `null`, the link reads *no longer available*" leaves open what any other answer does; it is read from UC-029 5b ("only the link ... is marked") as: a log the server keeps (any text) leaves the link
//     as it was, a link to the run reading "log".
//   - a call that fails (ciRunLog rejects) is neither an answer of null nor of a kept log; the texts say nothing of it, and a link marked *no longer available* on a failure would state what is not known. It is read as
//     leaving the link as it was, so that the person can open it again, and the next click asks again.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, treeHost, until } from "./trace-pages-harness.mjs";
import { connect, parseAddress } from "../src/repository-hosts/index.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const ADDRESS = "https://github.com/acme/ledger";
const API = "/repos/acme/ledger";
const WEB = `${ADDRESS}/actions/runs`;
const SPEC = ["# Ledger — Specification", "", "## Rules", "", "**BOOKS BALANCE** *(PO)*", "The books balance.", "*Check:* at review.", ""].join("\n");
const TEST_FILE = ["// TST-77 · level: unit · module: system", "// guards: BOOKS BALANCE", "// given: a ledger", "// input: a posting", "// expect: a balanced ledger", "test(\"balances\", () => {});", ""].join("\n");

// Six commits that ran TST-77, in the order of their records; the run of the nth is 4100 + n, and the outcomes are the nth of OUTCOMES.
const COMMITS = ["a1", "b2", "c3", "d4", "e5", "f6"].map((pair) => pair.repeat(20));
const OUTCOMES = ["passed", "failed", "passed", "passed", "failed", "passed"];
const RUN_ID = (n) => String(4100 + n);
const RUN = (n) => `${WEB}/${RUN_ID(n)}`;
function record(commit, n) {
  const front = ["---", `commit: ${commit}`, "levels:", "  - unit", "occasion: commit", "participant: ci", `date: 2026-10-1${n} 09:00 UTC`, `run: ${RUN(n)}`, "---"].join("\n");
  return `${front}\n## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n| TST-77 | unit | ${OUTCOMES[n - 1]} | |\n`;
}
const RESULTS = Object.fromEntries(COMMITS.map((commit, at) => [`runs/${commit}/2026101${at + 1}-0900-commit-${at + 1}.md`, record(commit, at + 1)]));
const MAIN_FILES = { "SPEC.md": SPEC, "tests/ledger.test.mjs": TEST_FILE };

// The product's host over the harness's snapshots: the GitHub adapter's own `webLinks`, and `ciRunLog` as the case gives it.
const hostWith = (ciRunLog) => ({ ...treeHost({ trees: { main: MAIN_FILES, "test-results": RESULTS }, onDefault: COMMITS }), webLinks: () => connect(parseAddress(ADDRESS)).webLinks(), ciRunLog });

// A stand-in for ciRunLog: `answer(id, nth)` is the answer of the nth call about run `id` (from 1), a promise or a value; every call is noted in `calls` as the id asked about, in order.
function asking(answer) {
  const calls = [];
  return { calls, ciRunLog: (id) => { calls.push(id); return Promise.resolve().then(() => answer(id, calls.filter((each) => each === id).length)); } };
}
const KEPT = "log of the run\n";
const refused = () => Object.assign(new Error("unreachable"), { name: "Unreachable" });

// The page: the route `tests` over the host, with the detail of TST-77 opened, drawn once its six marks stand.
async function render(host) {
  const target = document.createElement("div");
  document.body.append(target);
  const drawn = route.render(target, { product: { address: ADDRESS, host } }, { key: "tests", ref: "main", row: "TST-77" });
  const late = new Promise((_, reject) => setTimeout(() => reject(new Error("the page was not drawn in 3 s: it waits for an answer about a log")), 3000).unref());
  await Promise.race([drawn, late]);
  await until(() => marksOf(target).length === COMMITS.length);
  await settle();
  return target;
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));
const hasClass = (name) => (node) => String(node.className).split(" ").includes(name);
const marksOf = (target) => find(target, hasClass("test-history-commit"));
const linkOf = (mark) => find(mark, (node) => node.localName === "a")[0];
// The mark of the nth commit and its link, found by the run the link leads to.
const markOf = (target, n) => marksOf(target).find((mark) => linkOf(mark)?.getAttribute("href") === RUN(n));
const click = async (link) => { link.dispatchEvent(new Event("click")); await settle(); };
const reads = (target) => marksOf(target).map((mark) => linkOf(mark)?.textContent);

// The requests the GitHub adapter makes while `run` goes on, as `<METHOD> <path>`: the jobs of a run (two jobs each) and the log of a job, which is kept, or gone (410) for the runs in `gone`.
async function counting(gone, run) {
  const requests = [], real = globalThis.fetch;
  const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  globalThis.fetch = async (input, init = {}) => {
    const path = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input)).pathname;
    requests.push(`${String(init.method ?? "GET").toUpperCase()} ${path}`);
    const jobs = new RegExp(`^${API}/actions/runs/(\\d+)/jobs$`).exec(path);
    if (jobs) return json(200, { total_count: 2, jobs: [{ id: Number(`${jobs[1]}1`), name: "unit" }, { id: Number(`${jobs[1]}2`), name: "lint" }] });
    const log = new RegExp(`^${API}/actions/jobs/(\\d+)/logs$`).exec(path);
    if (log) return gone.includes(log[1].slice(0, -1)) ? json(410, { message: "Logs have expired" }) : new Response(KEPT, { status: 200, headers: { "Content-Type": "text/plain" } });
    return json(404, { message: `unrouted: ${path}` });
  };
  try { return { result: await run(requests), requests }; } finally { globalThis.fetch = real; }
}
const toActions = (requests) => requests.filter((request) => request.includes("/actions/"));

// TST-1275301 · level: release · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: TST-77, which ran on six commits whose records name the runs 4101 to 4106 of the repository acme/ledger; the product's host is the GitHub adapter, over a counting fake of fetch whose logs are all kept; for the known positive, the same page with the link of the fifth mark clicked
// input: the detail of the test opened and left alone; then, in a second page, one link clicked
// expect: six marks, each with a link reading "log" to its run's address (…/actions/runs/4101 to 4106), the text of the marks "<7 hex> passed|failed" unchanged, and no request under …/actions/ while the history is drawn and while nothing is clicked; in the second page the click on the link of run 4105 is followed by requests under …/actions/ — the jobs of 4105 and the logs of its jobs 41051 and 41052 — and by none of the other five runs
// Planted fault: a history that asks for each log while it draws (`await host.ciRunLog(id)` before the link is made in historyLogLink of src/trace-pages/test-detail.mjs) sends the jobs and the logs of all six runs at the first draw and fails the empty list; a history that never asks fails the known positive.
test("TST-1275301 drawing a test's history sends no request under actions, and a click on a log link sends the requests of its run alone", async () => {
  const { result: target, requests } = await counting([], async () => render(hostWith(connect(parseAddress(ADDRESS)).ciRunLog)));
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => markOf(target, n)?.textContent.slice(0, 7)), COMMITS.map((commit) => commit.slice(0, 7)), "known positive: the six marks stand, each with its run's link");
  assert.deepEqual(reads(target), ["log", "log", "log", "log", "log", "log"]);
  assert.deepEqual(marksOf(target).map((mark) => mark.textContent.split(" ")[1]).sort(), [...OUTCOMES].sort(), "the marks keep their outcomes");
  assert.deepEqual(toActions(requests), [], "nothing under actions/ while the history is drawn");
  const second = await counting([], async () => {
    const page = await render(hostWith(connect(parseAddress(ADDRESS)).ciRunLog));
    await click(linkOf(markOf(page, 5)));
    return page;
  });
  assert.deepEqual(toActions(second.requests), [`GET ${API}/actions/runs/4105/jobs`, `GET ${API}/actions/jobs/41051/logs`, `GET ${API}/actions/jobs/41052/logs`], "known positive: a click asks, and for its run alone");
});

// TST-1275302 · level: release · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the detail of TST-77 over a host whose ciRunLog gives null for the run 4102 — the answer comes after the click, from a promise the case holds back —; a record of every id ciRunLog is asked about
// input: the link of run 4102 clicked; clicked again while the answer is held back; the answer given; clicked a third time
// expect: ciRunLog is asked about nothing until the click; then about "4102" once, and the second click while the asking goes on asks nothing more; until the answer comes the link reads "log"; after it the link reads "no longer available", still leads to …/actions/runs/4102, and the third click asks nothing more; the text of its mark, "b2b2b2b failed", is unchanged
// Planted fault: a click that asks every time (`asked ??=` replaced by `asked =` in historyLogLink of src/trace-pages/test-detail.mjs) asks twice for the second click and a third time for the third; a link that does not change its text on null (the `link.textContent = "no longer available"` left out) keeps reading "log"; a link that is made to read "no longer available" when it is drawn fails the first reading.
test("TST-1275302 a click on a log link asks ciRunLog once for that run, and a null answer turns the link into no longer available", async () => {
  let give;
  const held = new Promise((resolve) => { give = resolve; });
  const { calls, ciRunLog } = asking(() => held);
  const target = await render(hostWith(ciRunLog));
  assert.deepEqual(calls, [], "known positive: the history is drawn, and nothing is asked until a click");
  const mark = markOf(target, 2), link = linkOf(mark);
  assert.equal(link.textContent, "log");
  const before = mark.textContent;
  assert.match(before, /^b2b2b2b failed\b/);
  await click(link);
  await click(link);
  assert.deepEqual(calls, ["4102"], "one asking, for the run of the link, though it was clicked twice");
  assert.equal(link.textContent, "log", "until the server answers the link is as it was");
  give(null);
  await settle();
  assert.equal(link.textContent, "no longer available");
  assert.equal(link.getAttribute("href"), RUN(2));
  await click(link);
  assert.deepEqual(calls, ["4102"], "a link already marked asks nothing more");
  assert.equal(markOf(target, 2).textContent.replace("no longer available", "log"), before, "the mark keeps its outcome");
});

// TST-1275303 · level: release · module: MOD-trace-pages
// guards: UC-029
// given: the detail of TST-77 over a host whose ciRunLog gives the text of a log for the run 4106 and for the run 4101 an empty text; a record of every id it is asked about
// input: the link of run 4106 clicked and then clicked again; the link of run 4101 clicked
// expect: ciRunLog is asked about "4106" once and about "4101" once; both links still read "log" and still lead to …/actions/runs/4106 and …/actions/runs/4101, and each is still an anchor opening in a new tab (target _blank, rel noopener noreferrer); the other four links read "log"
// Planted fault: a link that reads "no longer available" for any answer (the test `log == null` of historyLogLink replaced by true) fails both; a link that reads "no longer available" for a falsy text (`!log` for `log == null`) fails the run 4101, whose log is kept but empty; a link that is removed once its log is kept fails the anchor.
test("TST-1275303 a click on the link of a kept log leaves the link a link to the run", async () => {
  const { calls, ciRunLog } = asking((id) => (id === "4106" ? KEPT : ""));
  const target = await render(hostWith(ciRunLog));
  for (const n of [6, 6, 1]) await click(linkOf(markOf(target, n)));
  assert.deepEqual([...calls].sort(), ["4101", "4106"], "each run clicked is asked about once");
  for (const n of [1, 6]) {
    const link = linkOf(markOf(target, n));
    assert.equal(link.localName, "a");
    assert.equal(link.textContent, "log", `run ${RUN_ID(n)}`);
    assert.equal(link.getAttribute("href"), RUN(n));
    assert.equal(link.getAttribute("target"), "_blank");
    assert.equal(link.getAttribute("rel"), "noopener noreferrer");
  }
  assert.deepEqual([2, 3, 4, 5].map((n) => linkOf(markOf(target, n)).textContent), ["log", "log", "log", "log"]);
});

// TST-1275304 · level: release · module: MOD-trace-pages
// guards: UC-029
// given: the detail of TST-77 over a host whose ciRunLog fails (rejects) at its first call about the run 4103 and at its second gives null; a record of every id it is asked about
// input: the link of run 4103 clicked; clicked again; clicked a third time
// expect: after the first click the link reads "log" and still leads to …/actions/runs/4103, and the mark's text is unchanged; the second click asks again — ciRunLog has been asked about "4103" twice — and the link then reads "no longer available"; the third click asks nothing more; no other run is asked about, and the page raises no error (an unhandled rejection fails the run of this file)
// Planted fault: a link whose failed asking is kept as the answer (the `() => { asked = null; }` of historyLogLink left out, or empty) is not asked again by the second click and keeps reading "log" for good; a link that reads "no longer available" when the call fails (the failure handler setting the text) fails the first reading; a click handler that lets the rejection through fails the run with an unhandled rejection.
test("TST-1275304 a failed asking leaves the link to try again, and the next click asks again", async () => {
  const { calls, ciRunLog } = asking((id, nth) => (nth === 1 ? Promise.reject(refused()) : null));
  const target = await render(hostWith(ciRunLog));
  const mark = markOf(target, 3), link = linkOf(mark);
  const before = mark.textContent;
  await click(link);
  assert.deepEqual(calls, ["4103"]);
  assert.equal(link.textContent, "log", "a failure is not an answer: the link is as it was");
  assert.equal(link.getAttribute("href"), RUN(3));
  assert.equal(mark.textContent, before);
  await click(link);
  assert.deepEqual(calls, ["4103", "4103"], "the second click asks again");
  assert.equal(link.textContent, "no longer available");
  await click(link);
  assert.deepEqual(calls, ["4103", "4103"], "once the link is marked nothing more is asked");
  assert.deepEqual(reads(target).filter((text) => text !== "log"), ["no longer available"], "no other link changed");
});

// TST-1275305 · level: release · module: MOD-trace-pages
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the detail of TST-77 over a host whose ciRunLog answers by run: null for 4101 and 4105, a kept log for 4103, a failure for 4104 at every call, and nothing is asked about 4102 and 4106; a record of every id it is asked about, in order
// input: the links clicked in the order of runs 4105, 4103, 4104, 4101, then 4104 again
// expect: the calls are "4105", "4103", "4104", "4101", "4104" — each click asks for its own run's id and no other —; the links read, in the order of the runs 4101 to 4106, "no longer available", "log", "log", "log", "no longer available", "log"; every link still leads to its own run's address (…/actions/runs/4101 to 4106) and every mark keeps its outcome text
// Planted fault: state shared by the links (`let asked` moved out of historyLogLink to the module) asks only for the first run clicked and marks the others by its answer; a click that asks for the id of the first mark, not its own, fails the calls; a failure that marks the other links or stops them being asked fails the readings.
test("TST-1275305 each run's link behaves on its own: its own id is asked, its own answer shows, a failure on one touches no other", async () => {
  const answers = { 4101: null, 4103: KEPT, 4105: null };
  const { calls, ciRunLog } = asking((id) => (id === "4104" ? Promise.reject(refused()) : answers[id]));
  const target = await render(hostWith(ciRunLog));
  const outcomes = marksOf(target).map((mark) => mark.textContent.split(" ").slice(0, 2).join(" ")).sort();
  for (const n of [5, 3, 4, 1, 4]) await click(linkOf(markOf(target, n)));
  assert.deepEqual(calls, ["4105", "4103", "4104", "4101", "4104"]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => linkOf(markOf(target, n)).textContent), ["no longer available", "log", "log", "log", "no longer available", "log"]);
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => linkOf(markOf(target, n)).getAttribute("href")), [1, 2, 3, 4, 5, 6].map(RUN));
  assert.deepEqual(marksOf(target).map((mark) => mark.textContent.split(" ").slice(0, 2).join(" ")).sort(), outcomes, "the marks keep their outcomes");
});
