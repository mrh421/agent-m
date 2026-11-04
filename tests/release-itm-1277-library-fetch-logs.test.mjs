// Release tests of ITM-1277 — a person opens the library and the page reads the log of a failed fetch only while a legal text waits for its line. The behaviour is UC-004 (docs/use-cases/UC-004-register-a-requirement-source.md, step 7: "For an EU legal text, the fetch workflow then
// downloads the official text … The library shows the source as *fetched*") and its alternative flow 7a, as docs/architecture/MOD-settings-pages.md (the route `library`: "The error a waiting legal text shows (UC-004 7a) is the line naming it in the log of a failed run of the fetch workflow:
// the logs are read only while a legal text waits without its line, newest failed run first, no further back than the newest successful run started by a push, and none is read while no legal text waits") states it, and the SPEC's AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY.
// Run: node --test tests/release-itm-1277-library-fetch-logs.test.mjs
//
// Module: MOD-settings-pages; MOD-site-frame; MOD-repository-hosts
// Guards: UC-004; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// Level: release
//
// Written for the release testing of sprint 124 by a participant who implemented none of ITM-1277 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The page is opened as a person opens it: MOD-site-frame's frame at the fragment #library, over MOD-repository-hosts' real GitHub host answered by
// a fake of fetch (tests/settings-pages-sources.d/frame.mjs and github.mjs, the harness of the module's release tests), which this file extends to serve the runs of the workflow fetch-sources.yml, the jobs of each run and the job's log. The counts are read from the requests the fake received —
// the listing of the runs, and the request for each job's log, by the run it belongs to —, not from a counter inside a stand-in host. The component test of the item (tests/settings-pages-library-fetch-logs.test.mjs) hands the page a host of its own; these cases end at what the person reads and at
// the requests the real host sends. Readings the texts leave open, which the cases state:
//   - "newest" is the run's start (`run_started_at`), since the listing states no order; the fake lists the runs oldest first.
//   - "a log is read" is the request for the logs of one of a run's jobs (GET …/actions/jobs/<job>/logs); each run has one job.
//   - "a legal text waits" is an EU legal text of the register with no recorded version; a standard with no version is no legal text and waits for nothing the fetch workflow does.
//   - "the line" is the line of the log that names the text's identifier.

import test from "node:test";
import assert from "node:assert/strict";
import { installDocument, byTag } from "./settings-pages-harness.mjs";
import { visit as visitFrame } from "./settings-pages-sources.d/frame.mjs";

installDocument();

const INSTANCE = "akmaier/agent-m";
const TOKEN = "github_pat_INSTANCE0123456789abcdefghij";
const WORKFLOW = "fetch-sources.yml";

const entryOf = (id, title, kind, versions) => ["---", `id: ${id}`, `title: ${title}`, `kind: ${kind}`, "authority: normative", "licence: may be republished - EU law", ...(kind === "regulation" ? ["identifier: 32024R1689"] : [`designation: ${title}`]), "---",
  `# ${id} ${title}`, "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  ...(versions ? [`| \`cellar-2024-07-12\` | 2024-07-16 | - | publication repository | 1 file, listed below; version hash \`${"c".repeat(64)}\` |`, "", "### Files of cellar-2024-07-12", "", "| File | SHA-256 |", "|---|---|", `| \`32024R1689.xhtml\` | \`${"d".repeat(64)}\` |`] : []), ""].join("\n");
const register = (...entries) => Object.fromEntries(entries.map(([id, title, kind, versions]) => [`docs/sources/${id}.md`, entryOf(id, title, kind, versions)]));

// The ten runs of the fetch workflow, numbered from 1 (the oldest) to 10 (the newest); `others` names those that did not fail, as { 8: ["success", "push"] }, every other run failed on a push. The log of run n names the sources in `named[n]`.
const runsOf = (others = {}) => Array.from({ length: 10 }, (_, index) => {
  const n = index + 1;
  const [conclusion, event] = others[n] ?? ["failure", "push"];
  return { id: n, path: `.github/workflows/${WORKFLOW}`, head_sha: "h".repeat(40), event, status: "completed", conclusion, html_url: `https://github.com/${INSTANCE}/actions/runs/${n}`,
    run_started_at: `2026-10-${String(10 + n).padStart(2, "0")}T10:00:00Z`, updated_at: `2026-10-${String(10 + n).padStart(2, "0")}T10:01:00Z` };
});
const logOf = (n, named) => [`run ${n}: fetch-sources`, ...(named[n] ?? []).map((id) => `onSourcesCommitted: failed - ${id}: Unreachable: publication offline in run ${n}`), "done"].join("\n");

// The page at #library as a person opens it, over the world of the library and a fetch that serves the runs; -> { page, listings, logsRead } — `listings` the number of listings of the runs of the workflow, `logsRead` the run of each log asked for, in order.
async function open(t, { files, runs, named = {} }) {
  const served = { listings: 0, logsRead: [] };
  const serve = (world) => async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const base = `/repos/${INSTANCE}/actions`;
    if (url.origin === "https://api.github.com" && url.pathname === `${base}/workflows/${WORKFLOW}/runs`) {
      served.listings += 1;
      return new Response(JSON.stringify({ workflow_runs: runs }), { status: 200, headers: { "content-type": "application/json" } });
    }
    const jobs = url.origin === "https://api.github.com" && /^\/repos\/[^/]+\/[^/]+\/actions\/runs\/(\d+)\/jobs$/.exec(url.pathname);
    if (jobs) return new Response(JSON.stringify({ jobs: [{ id: Number(jobs[1]) * 10, name: "fetch" }] }), { status: 200, headers: { "content-type": "application/json" } });
    const log = url.origin === "https://api.github.com" && /^\/repos\/[^/]+\/[^/]+\/actions\/jobs\/(\d+)\/logs$/.exec(url.pathname);
    if (log) {
      const n = Number(log[1]) / 10;
      served.logsRead.push(n);
      return new Response(logOf(n, named), { status: 200 });
    }
    return world.fetch(input, init);
  };
  const page = await visitFrame(t, "#library", { repositories: { [INSTANCE]: { files } }, settings: { "github-token": { value: TOKEN, name: "Agent M - akmaier/agent-m", expires: "2027-01-01" }, products: [] }, serve });
  return { page, served };
}
// What a person reads of a source on the library page: the text of the element that holds its title and its fetch state.
const readOf = (page, title) => {
  const holders = byTag(page.main(), "section").filter((node) => node.textContent.includes(title) && /Fetched\.|Fetch failed:|Waiting for fetch\./.test(node.textContent));
  return holders.sort((a, b) => a.textContent.length - b.textContent.length)[0]?.textContent ?? null;
};

// TST-1277301 · level: release · module: MOD-settings-pages
// guards: UC-004; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// given: the register of the instance holds an EU legal text with a fetched version and a standard with no version; ten runs of fetch-sources.yml on the branch main, all failed on pushes, the log of each naming the legal text; known positive first — the page shows the fetched legal text as Fetched. and lists the standard
// input: a person opens #library
// expect: the library shows the legal text as Fetched.; the runs of the workflow are listed once and no log of any run is read — not one request for a job's log —, since no legal text waits; the standard with no version is no legal text and shows no fetch state
// Planted fault: the stop once every waiting text has its line left out (`if (waiting.every((entry) => failures.has(entry.id))) break;` removed in fetchFailures of src/settings-pages/library.mjs), so that the logs are read whatever waits, reads ten logs, and the case fails on the logs read.
test("TST-1277301 the library reads no log of a failed fetch while no legal text waits", async (t) => {
  const { page, served } = await open(t, { files: register(["SRC-eu-ai", "AI Act text", "regulation", true], ["SRC-iec", "IEC standard", "standard", false]), runs: runsOf(), named: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, ["SRC-eu-ai"]])) });
  assert.match(readOf(page, "AI Act text"), /Fetched\./, "known positive: the page shows the fetched text");
  assert.match(page.main().textContent, /IEC standard/, "known positive: the page lists the standard");
  assert.equal(served.listings, 1, "the runs are listed once");
  assert.deepEqual(served.logsRead, [], "no log is read");
  assert.doesNotMatch(readOf(page, "IEC standard") ?? "", /Fetch failed|Waiting for fetch/, "a standard waits for no fetch");
});

// TST-1277302 · level: release · module: MOD-settings-pages
// guards: UC-004; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// given: the register holds an EU legal text SRC-eu-waiting with no version; ten runs of fetch-sources.yml, all failed on pushes, of which only the newest (run 10) has a log that names the text
// input: a person opens #library
// expect: the library shows the text as `Fetch failed:` followed by the line of run 10's log that names it ("onSourcesCommitted: failed - SRC-eu-waiting: Unreachable: publication offline in run 10"); the runs are listed once and exactly one log is read, run 10's
// Planted fault: the stop once every waiting text has its line left out (`if (waiting.every((entry) => failures.has(entry.id))) break;` removed in fetchFailures of src/settings-pages/library.mjs) reads the ten logs, and the case fails on the logs read.
// Planted fault: the runs taken oldest first (the sort of `newestFirst` removed) reads run 1 first, finds no line in it, and the case fails on the logs read and on the line shown.
test("TST-1277302 the library reads one log when the newest failed run names the waiting legal text, and shows its line", async (t) => {
  const { page, served } = await open(t, { files: register(["SRC-eu-waiting", "Waiting text", "regulation", false]), runs: runsOf(), named: { 10: ["SRC-eu-waiting"] } });
  assert.match(readOf(page, "Waiting text"), /Fetch failed: .*SRC-eu-waiting: Unreachable: publication offline in run 10/);
  assert.equal(served.listings, 1);
  assert.deepEqual(served.logsRead, [10]);
});

// TST-1277303 · level: release · module: MOD-settings-pages
// guards: UC-004; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// given: the register holds a waiting EU legal text SRC-eu-waiting; ten runs of fetch-sources.yml of which run 8, the third newest, succeeded on a push and the others failed on pushes; no log names the text
// input: a person opens #library
// expect: the library shows the text as `Waiting for fetch.`; the runs are listed once and two logs are read, run 10's and then run 9's, and none of run 8 or an older run, since a push fetches every text then waiting
// Planted fault: the bound at the successful push run left out (`if (run.state === "success" && run.event === "push") break;` removed in fetchFailures of src/settings-pages/library.mjs) reads the nine logs of the failed runs, and the case fails on the logs read.
test("TST-1277303 the library reads no log further back than the newest successful run that a push started", async (t) => {
  const { page, served } = await open(t, { files: register(["SRC-eu-waiting", "Waiting text", "regulation", false]), runs: runsOf({ 8: ["success", "push"] }) });
  assert.match(readOf(page, "Waiting text"), /Waiting for fetch\./);
  assert.equal(served.listings, 1);
  assert.deepEqual(served.logsRead, [10, 9]);
});

// TST-1277304 · level: release · module: MOD-settings-pages
// guards: UC-004; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// given: the register holds two waiting EU legal texts, SRC-eu-first and SRC-eu-second, and ten runs, all failed on pushes; run 10's log names the first, run 8's log names the second
// input: a person opens #library
// expect: the first text shows the line of run 10, the second the line of run 8; the logs read are run 10's, run 9's and run 8's, in this order, and no older one, since each text has its line by then
// Planted fault: the stop made to follow the first text alone (`waiting.every(…)` in fetchFailures of src/settings-pages/library.mjs replaced by `waiting.some(…)`) stops at run 10 and leaves the second text without its line, and the case fails on the logs read and on the second text; it also reads ten logs where no text waits, and TST-1277301 fails.
test("TST-1277304 the library reads logs until each waiting legal text has its line", async (t) => {
  const { page, served } = await open(t, { files: register(["SRC-eu-first", "First text", "regulation", false], ["SRC-eu-second", "Second text", "regulation", false]), runs: runsOf(), named: { 10: ["SRC-eu-first"], 8: ["SRC-eu-second"] } });
  assert.match(readOf(page, "First text"), /publication offline in run 10/);
  assert.match(readOf(page, "Second text"), /publication offline in run 8/);
  assert.equal(served.listings, 1);
  assert.deepEqual(served.logsRead, [10, 9, 8]);
});

// TST-1277305 · level: release · module: MOD-settings-pages
// guards: UC-004; AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY
// given: the register holds a waiting EU legal text; ten runs of which run 8 succeeded but was started by a dispatch (a run for one source), run 3 succeeded on a push, and the others failed on pushes; no log names the text
// input: a person opens #library
// expect: the library shows `Waiting for fetch.`; the logs read are those of the failed runs newer than run 3, newest first — runs 10, 9, 7, 6, 5 and 4 — and none of run 3 or an older run: a successful run that no push started is no bound, the newest one that a push started is
// Planted fault: every successful run taken as the bound (`run.event === "push"` removed from the bound in fetchFailures of src/settings-pages/library.mjs) stops at run 8, and the case fails on the logs read.
test("TST-1277305 a successful run that a dispatch started is no bound for the logs the library reads", async (t) => {
  const { page, served } = await open(t, { files: register(["SRC-eu-waiting", "Waiting text", "regulation", false]), runs: runsOf({ 8: ["success", "workflow_dispatch"], 3: ["success", "push"] }) });
  assert.match(readOf(page, "Waiting text"), /Waiting for fetch\./);
  assert.equal(served.listings, 1);
  assert.deepEqual(served.logsRead, [10, 9, 7, 6, 5, 4]);
});
