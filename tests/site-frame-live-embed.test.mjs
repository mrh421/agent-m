// The live review page lets a view embed another's route (ITM-1226): MOD-site-frame's embedRoute renders a route of a view loaded on the same page, with the
// context of the route shown now (MOD-site-frame.md, Interfaces), and the live app (dashboard-app.mjs), which loads the views its script tag names in
// `data-views`, makes their routes reachable by it as startPage does — so that on `#trace/key=tests` and `#trace/key=audit` the Tests entry's views
// (MOD-test-pages' route `tests-views`) stand under the heading, and the release panel shows its candidate's audit (MOD-trace-pages' route `trace`) instead of
// the frame's link to it.
// Run: node --test tests/site-frame-live-embed.test.mjs
//
// Module: MOD-site-frame
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-029; UC-030; UC-013
// Level: unit
//
// The live app runs in tests/app-harness.mjs with the six views the live page names, against the GitHub API mock of tests/app-harness.mjs; the release fixture
// is a product with a recorded release candidate, its graph stored on trace-cache, as tests/dashboard-pending-release-report.test.mjs builds it. The pages are
// read as the HTML of <main>. Readings the texts leave open, which the pull request names:
//   - "the Tests entry's five views are drawn under the heading, Browser or Audit marked": <main> holds a navigation with the five buttons Schedule, Browser,
//     Runs, Audit, Generate, the one shown drawn as the frame's primary button (`btn primary`, MOD-test-pages.md: tests-views), and no link "Open tests-views".
//     The harness's document keeps no aria attribute in the HTML it gives, so the mark is read from the class;
//   - "the release panel's candidate audit is drawn, not linked": the panel holds the audit's section (`audit head`, MOD-trace-pages' route trace) and no
//     link "Open trace". What the audit shows for the candidate is MOD-trace-pages' and is not read here.
// The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { repoServer, openDashboard, richDocument } from "./app-harness.mjs";
import { storedGraphBytes } from "./stored-graph-fake.mjs";

function fixtureFiles() {
  const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
  const files = {};
  // The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
  (function walk(dir) { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else files[relative(FIX, path).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(path, "utf8"); } })(FIX);
  return files;
}

const LABELS = ["Schedule", "Browser", "Runs", "Audit", "Generate"];
// The navigation of the Tests entry's views in an HTML text: its buttons' labels and the one marked as the page shown, drawn as the frame's primary button.
function testsViewsIn(html) {
  const nav = /<nav[^>]*>(.*?)<\/nav>/s.exec(html);
  if (!nav) return null;
  const buttons = [...nav[1].matchAll(/<button([^>]*)>([^<]*)<\/button>/g)];
  return { labels: buttons.map((button) => button[2]), shown: buttons.filter((button) => /class="[^"]*\bprimary\b/.test(button[1])).map((button) => button[2]) };
}

// TST-1226001 · level: unit · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-029
// given: the live app with the six views of the live page, on the instance
// input: the dashboard opened at #trace/key=tests
// expect: <main> holds the Tests entry's five views, Browser marked, and no link "Open tests-views"
// Planted fault: a live app that never makes its routes reachable by embedRoute shows the link "Open tests-views" and no navigation.
test("TST-1226001 on the live page the tests browser shows the Tests entry's views, Browser marked", async () => {
  const page = await openDashboard({ server: await repoServer({ files: fixtureFiles(), history: [], handlers: [] }), hash: "#trace/key=tests" });
  assert.match(page.main(), /<h2>Tests<\/h2>/, "known positive: the tests browser is drawn");
  assert.doesNotMatch(page.main(), /Open tests-views/);
  assert.deepEqual(testsViewsIn(page.main()), { labels: LABELS, shown: ["Browser"] });
});

// TST-1226002 · level: unit · module: MOD-site-frame
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-030
// given: the live app with the six views of the live page, on the instance
// input: the dashboard opened at #trace/key=audit
// expect: <main> holds the Tests entry's five views, Audit marked, and no link "Open tests-views"
// Planted fault: as TST-1226001, the link "Open tests-views" stands in place of the views.
test("TST-1226002 on the live page the audit shows the Tests entry's views, Audit marked", async () => {
  const page = await openDashboard({ server: await repoServer({ files: fixtureFiles(), history: [], handlers: [] }), hash: "#trace/key=audit" });
  assert.match(page.main(), /<h2>Audit<\/h2>/, "known positive: the audit is drawn");
  assert.doesNotMatch(page.main(), /Open tests-views/);
  assert.deepEqual(testsViewsIn(page.main()), { labels: LABELS, shown: ["Audit"] });
});

// The release fixture: a selected product with a recorded release candidate, its result and its graph stored on trace-cache.
const json = (value) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
const PRODUCT = "customer/release-fixture", COMMIT = "a".repeat(40), RESULT = "b".repeat(40), VERSION = "2026.10.8", TAG = `v${VERSION}-rc.1`;
const JOB = "docs/jobs/JOB-20261009-0148-2890.md";
const RELEASE_FILES = {
  [JOB]: ["---", "id: JOB-20261009-0148-2890", "kind: run-tests", "works_on:", `  - ${COMMIT}`, "route: ci hosted", "started_by: akmaier",
    "start: 2026-10-09 01:48 UTC", "agent_m: unreleased, commit unknown", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json",
    JSON.stringify({ candidate: { version: VERSION, tag: TAG, commit: COMMIT }, changelog: "Recorded release entry." }), "```", "",
    "## End", "", "at: 2026-10-09 02:00 UTC", "state: done", ""].join("\n"),
  "SPEC.md": ["# Fixture product", "", "**A SAMPLE REQUIREMENT** *(Product Owner)*", "A sample rule.", "*Check:* `tests/pending.test.mjs`", ""].join("\n"),
  "tests/pending.test.mjs": ["// TST-100", "// level: unit", "// guards: A SAMPLE REQUIREMENT", ""].join("\n"),
  [`runs/${COMMIT}/20261009-0200-release-candidate.md`]: ["---", `commit: ${COMMIT}`, "levels:", "  - unit", "occasion: release-candidate", "participant: ci",
    "date: 2026-10-09 02:00 UTC", "---", "## Outcomes", "", "| Test | Level | Outcome | Runs |", "|---|---|---|---|", "| TST-100 | unit | passed | |", ""].join("\n"),
};
async function releaseServer() {
  const api = `/repos/${PRODUCT}`;
  const files = RELEASE_FILES;
  const candidate = Object.fromEntries(Object.entries(files).filter(([path]) => !path.startsWith("runs/")));
  let server;
  server = await repoServer({ repo: PRODUCT, files, handlers: [async (url) => {
    if (url.origin !== "https://api.github.com" && url.origin !== "https://raw.githubusercontent.com") return undefined;
    if (url.pathname === `${api}/tags`) return json([{ name: TAG, commit: { sha: COMMIT } }]);
    if (url.pathname === `${api}/commits/${TAG}` || url.pathname === `${api}/commits/${COMMIT}`) return json({ sha: COMMIT });
    if (url.pathname === `${api}/commits/test-results`) return json({ sha: RESULT });
    if (url.pathname === `${api}/git/trees/${COMMIT}`) return json({ truncated: false,
      tree: Object.keys(candidate).map((path) => ({ path, type: "blob", sha: server.shas[path] })) });
    if (url.pathname === `${api}/git/trees/${RESULT}`) return json({ truncated: false,
      tree: Object.keys(files).filter((path) => path.startsWith("runs/")).map((path) => ({ path, type: "blob", sha: server.shas[path] })) });
    if ((url.pathname === `${api}/contents/${COMMIT}.json.gz` && url.searchParams.get("ref") === "trace-cache")
      || (url.origin === "https://raw.githubusercontent.com" && url.pathname === `/${PRODUCT}/trace-cache/${COMMIT}.json.gz`)) {
      return new Response(await storedGraphBytes({ commit: COMMIT, paths: Object.keys(candidate), read: async (path) => candidate[path] ?? null }));
    }
    if (url.pathname.startsWith(`${api}/contents/`)) {
      const path = url.pathname.slice(`${api}/contents/`.length).split("/").map(decodeURIComponent).join("/");
      if (path in files) return new Response(files[path]);
    }
    return undefined;
  }] });
  return server;
}

// TST-1226003 · level: unit · module: MOD-site-frame
// guards: UC-013; UC-030
// given: the live app with the six views of the live page; a selected product with a recorded release candidate
// input: the dashboard opened at #uc for the product, then #release
// expect: the release panel names the candidate and holds its audit's section, and no link "Open trace"
// Planted fault: a live app that never makes its routes reachable by embedRoute shows the link "Open trace" in place of the audit.
test("TST-1226003 on the live page the release panel draws its candidate's audit, not a link to it", async () => {
  const server = await releaseServer();
  const page = await openDashboard({ server, hash: "#uc", search: `?repo=${PRODUCT}` });
  richDocument();
  await page.go("#release");
  assert.match(page.main(), new RegExp(`Release candidate ${TAG}`), "known positive: the panel shows the candidate");
  assert.doesNotMatch(page.main(), /Open trace/);
  assert.match(page.main(), /<section class="audit head"><h2>Audit<\/h2>/);
});
