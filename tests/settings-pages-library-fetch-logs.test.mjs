// ITM-1277 — MOD-settings-pages' route `library`, as docs/architecture/MOD-settings-pages.md states it: "The error a waiting legal text shows (UC-004 7a) is the line naming it in the log of a failed run of the fetch workflow:
// the logs are read only while a legal text waits without its line, newest failed run first, no further back than the newest successful run started by a push, and none is read while no legal text waits". The run listing
// (`listCiRuns`) and the log (`ciRunLog`) are functions of the Host that MOD-repository-hosts' `connect` returns (MOD-repository-hosts.md: "`Host` — the object `connect` returns"); the test hands the page a host of this file that
// counts both.
// Run: node --test tests/settings-pages-library-fetch-logs.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-004; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// Level: component
//
// The register holds EU legal-text entries; the host lists ten runs of `fetch-sources.yml`, handed out oldest first, so that the page has to put them in order itself. A run's log is the text `ciRunLog` returns for its id.
// Where the texts leave a reading open, the test states the reading it takes:
//   - "Newest" is the run's `started`, since `listCiRuns` states no order.
//   - A waiting legal text "has its line" once a log read names its identifier; the line shown is the first line of that log which holds the identifier, as the page shows it today.
//   - "A successful run started by a push" is a run whose `state` is `success` and whose `event` is `push`; a successful run of another event (a dispatch) is no bound.
// The counter-proof is the page as it stands: it reads the log of every failed run, ten here, whatever waits.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { view } = await import("../src/settings-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "library");

const INSTANCE = "alice/agent-m";
const WORKFLOW = "fetch-sources.yml";
const descendants = (root, predicate) => {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
};
const byClass = (root, name) => descendants(root, (node) => (node.className ?? "").split(" ").includes(name));
const settle = () => new Promise((resolve) => setTimeout(resolve, 15));

const entryText = (id, rows = "") => ["---", `id: ${id}`, `title: ${id} text`, "kind: regulation", "authority: normative", "licence: may be republished — EU law", "identifier: 32024R1689", "---",
  `# ${id} ${id} text`, "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", rows, ""].join("\n");
const FETCHED_ROW = `| \`cellar-2024-07-12\` | 2024-07-16 | - | publication repository | 1 file, listed below; version hash \`${"c".repeat(64)}\` |\n\n### Files of cellar-2024-07-12\n\n| File | SHA-256 |\n|---|---|\n| \`32024R1689.xhtml\` | \`${"d".repeat(64)}\` |`;
const registerOf = (...entries) => Object.fromEntries(entries.map(([id, rows]) => [`docs/sources/${id}.md`, entryText(id, rows)]));

// The ten runs of the fetch workflow, numbered from 1 (the oldest) to 10 (the newest): `states` names those that did not fail, as { 8: ["success", "push"] }; every other run failed on a push.
// The log of run n names the sources in `named[n]`, one line each.
const runsOf = (states = {}) => Array.from({ length: 10 }, (_, index) => {
  const n = index + 1;
  const [state, event] = states[n] ?? ["failure", "push"];
  const id = `run-${String(n).padStart(2, "0")}`;
  return { id, workflow: WORKFLOW, branch: "main", commit: "h".repeat(40), event, state, url: `https://github.com/${INSTANCE}/actions/runs/${id}`,
    started: `2026-10-${String(10 + n).padStart(2, "0")}T10:00:00Z`, ended: `2026-10-${String(10 + n).padStart(2, "0")}T10:01:00Z` };
});
const logOf = (n, named) => [`run ${n}: fetch-sources`, ...(named[n] ?? []).map((id) => `onSourcesCommitted: failed - ${id}: Unreachable: publication offline in run ${n}`), "done"].join("\n");

// A page over a host of this file; `listings` holds the filter of every listing asked for, `logsRead` the id of every log asked for, in order.
async function open({ sources, runs, named = {} }) {
  const listings = [], logsRead = [];
  const host = {
    repositoryInfo: async () => ({ defaultBranch: "main", visibility: "public", canWrite: true }),
    readSnapshot: async () => ({ commit: "h".repeat(40), paths: Object.keys(sources), blob: () => "b".repeat(40), read: async (path) => sources[path] ?? null }),
    listCiRuns: async (filter) => { listings.push(filter); return runs.filter((run) => (!filter?.workflow || run.workflow === filter.workflow) && (!filter?.branch || run.branch === filter.branch)); },
    ciRunLog: async (id) => { logsRead.push(id); const n = Number(id.slice(4)); return logOf(n, named); },
    startWorkflow: async () => null,
    webLinks: () => ({}),
  };
  const context = { instance: { repository: INSTANCE, host }, product: null, store: null, go() {} };
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, {});
  await settle();
  const stateOf = (id) => byClass(target, "library-source").find((node) => node.textContent.includes(`${id} text`))?.textContent ?? null;
  return { listings, logsRead, stateOf };
}

// TST-1277001 · level: component · module: MOD-settings-pages
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: a register of one EU legal text that is fetched (it has a version row), and ten failed runs of fetch-sources.yml, each of whose logs names that text's identifier
// input: the route `library` rendered
// expect: the one listing of the runs (the workflow fetch-sources.yml on the branch main) and no log read, since no legal text waits; the text is shown Fetched; counter-proof: the page as it stands reads the ten logs
test("library — no log is read while no legal text waits", async () => {
  const page = await open({ sources: registerOf(["SRC-ai-fetched", FETCHED_ROW]), runs: runsOf(), named: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, ["SRC-ai-fetched"]])) });
  assert.deepEqual(page.listings, [{ workflow: WORKFLOW, branch: "main" }], "the one listing stays");
  assert.deepEqual(page.logsRead, []);
  assert.match(page.stateOf("SRC-ai-fetched"), /Fetched\./);
});

// TST-1277002 · level: component · module: MOD-settings-pages
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: a register of one waiting EU legal text SRC-ai-waiting (no version row), and ten failed runs on pushes of which only the newest, run-10, has a log naming it
// input: the route `library` rendered
// expect: the one listing and one log read, the newest run's (run-10); the text is shown `Fetch failed:` with the line of that log which names it; counter-proof: the page as it stands reads the ten logs
test("library — a waiting text whose line is in the newest failed run reads that one log", async () => {
  const page = await open({ sources: registerOf(["SRC-ai-waiting"]), runs: runsOf(), named: { 10: ["SRC-ai-waiting"] } });
  assert.equal(page.listings.length, 1, "the one listing stays");
  assert.deepEqual(page.logsRead, ["run-10"]);
  assert.match(page.stateOf("SRC-ai-waiting"), /Fetch failed: onSourcesCommitted: failed - SRC-ai-waiting: Unreachable: publication offline in run 10/);
});

// TST-1277003 · level: component · module: MOD-settings-pages
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: a register of one waiting EU legal text SRC-ai-waiting, ten runs of which run-08, the third newest, succeeded on a push and the others failed on pushes, and no log names the text
// input: the route `library` rendered
// expect: the one listing and two logs read, run-10 then run-09, newest first, none further back than run-08; the text is shown `Waiting for fetch.`; counter-proof: the page as it stands reads the nine logs of the failed runs
test("library — no log is read further back than the newest successful run started by a push", async () => {
  const page = await open({ sources: registerOf(["SRC-ai-waiting"]), runs: runsOf({ 8: ["success", "push"] }) });
  assert.equal(page.listings.length, 1, "the one listing stays");
  assert.deepEqual(page.logsRead, ["run-10", "run-09"]);
  assert.match(page.stateOf("SRC-ai-waiting"), /Waiting for fetch\./);
});

// TST-1277004 · level: component · module: MOD-settings-pages
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: a register of two waiting EU legal texts, SRC-ai-first and SRC-ai-second, and ten failed runs on pushes; the log of run-10 names the first, the log of run-08 names the second
// input: the route `library` rendered
// expect: the logs of run-10, run-09 and run-08 are read, in this order, and no older one, since each text has its line by then; the first shows the line of run 10 and the second the line of run 8
test("library — the logs are read only until each waiting text has its line", async () => {
  const page = await open({ sources: registerOf(["SRC-ai-first"], ["SRC-ai-second"]), runs: runsOf(), named: { 10: ["SRC-ai-first"], 8: ["SRC-ai-second"] } });
  assert.equal(page.listings.length, 1, "the one listing stays");
  assert.deepEqual(page.logsRead, ["run-10", "run-09", "run-08"]);
  assert.match(page.stateOf("SRC-ai-first"), /publication offline in run 10/);
  assert.match(page.stateOf("SRC-ai-second"), /publication offline in run 8/);
});

// TST-1277005 · level: component · module: MOD-settings-pages
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; UC-004
// given: a register of one waiting EU legal text, and ten runs of which run-08, the third newest, succeeded but was started by a dispatch, run-03 succeeded on a push, and the others failed on pushes; no log names the text
// input: the route `library` rendered
// expect: the logs of the failed runs newer than run-03 are read, newest first — run-10, run-09, run-07, run-06, run-05, run-04 — and none of run-03 or older: a successful run that no push started is no bound, the newest one that a push started is (the known positive of TST-1277003)
test("library — a successful run that a dispatch started is no bound", async () => {
  const page = await open({ sources: registerOf(["SRC-ai-waiting"]), runs: runsOf({ 8: ["success", "workflow_dispatch"], 3: ["success", "push"] }) });
  assert.equal(page.listings.length, 1, "the one listing stays");
  assert.deepEqual(page.logsRead, ["run-10", "run-09", "run-07", "run-06", "run-05", "run-04"]);
  assert.match(page.stateOf("SRC-ai-waiting"), /Waiting for fetch\./);
});
