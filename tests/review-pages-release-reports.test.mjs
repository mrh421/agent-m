// MOD-review-pages' route release-report (ITM-910), as the accepted text of docs/architecture/MOD-review-pages.md states it: the release test
// reports are the fifth kind of the review flow — "`<k>` … every file of the kind with its status", "`<k>/<id>` … `release-v<version>` for a release
// test report", "`<k>/all` … every open or changed file of the kind … and *Accept all N shown*" — whose accept is MOD-release-evidence.acceptAndRelease
// (descriptor: `accept: "release"`), and a report's status is read through MOD-approvals' statusOf (`statuses` gives none until ITM-913).
// Run: node --test tests/review-pages-release-reports.test.mjs
//
// Module: MOD-review-pages
// Guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; STATUS IS DERIVED FROM THE RECORDS; THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON; UC-030
// Level: unit
//
// This imports the browser harness of tests/review-pages-harness.mjs unchanged, and brings the repository the way tests/release-evidence-293-release.test.mjs
// does: a Host of the tests' own over a few snapshots in memory (the default branch, a release candidate's tag, the branch test-results), every write recorded.
// The real MOD-approvals, MOD-release-evidence, MOD-documents and MOD-browser-store run as they are. Nothing reaches the network.
// Where the module file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - The route is the route `release-report`: #release-report lists the reports, #release-report/id=release-v<version> shows one, #release-report/id=all is Review all.
//   - A report is a row `<tr data-id="release-v<version>">` with its status; the page of one has the button "Accept"; Review all has <section class="review-file"
//     data-id="release-v<version>"> for each report not accepted and the button "Accept all N shown", class accept-all.
//   - A click calls MOD-release-evidence's acceptAndRelease with the report's path and the blob shown; its one commit holds the report, the approval
//     record and the changelog entry, and the tag follows on the tested commit.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import "./review-pages-harness.mjs";
import { until } from "./review-pages-wait.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const { releaseReport } = await import("../src/release-evidence/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const route = pages.view?.routes.find((candidate) => candidate.name === "release-report");

// ---------------------------------------------------------------- the product

const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };
const TEST = "TST-910999", GUARD = "A MODEL-DEPENDENT TEST IS MEASURED AS A RATE";
const OLD = "e".repeat(40), CANDIDATE = "c".repeat(40);
const ACCEPTED = "docs/tests/releases/v2026.3.0.md", OPEN = "docs/tests/releases/v2026.4.0.md";
const TAG = "v2026.4.0-rc.1";

const spec = ["# Thesis tool — Specification", "", `**${GUARD}** *(Product Owner)*`, "A model-dependent test reports a rate.", "*Check:* `tests/rate.test.mjs`", ""].join("\n");
const declaration = ["// " + TEST, "// level: release", "// module: MOD-release-evidence", `// guards: ${GUARD}`, "// runs: 10", "// phrasings: 2", ""].join("\n");
// The report of release 2026.3.0, accepted: its tested commit OLD, the rate 8 of 10.
const earlier = ["---", "version: 2026.3.0", "candidate: v2026.3.0-rc.1", `commit: ${OLD}`, "date: 2026-10-01", "---", "## Limitations", "", "## Levels", "",
  "| Level | Passed | Failed | Flaky | Not run |", "|---|---|---|---|---|", "| release | 1 | 0 | 0 | 0 |", "", "## Tests", "",
  "| Test | Level | Outcome | Guards |", "|---|---|---|---|", `| ${TEST} | release | 8 of 10 | ${GUARD} |`, "", "## Requirements", "",
  "| Requirement | Level | Tests | Outcome |", "|---|---|---|---|", `| ${GUARD} | release | ${TEST} | passed |`, "", "## Changelog entry", "", "Earlier.", ""].join("\n");
const outcome = (commit, runs) => ["---", `commit: ${commit}`, "levels:", "  - release", "occasion: release-candidate", "participant: ci", "date: 2026-10-11 22:00 UTC", "---",
  "## Outcomes", "", "| Test | Level | Outcome | Runs |", "|---|---|---|---|", `| ${TEST} | release | passed | ${runs} |`, ""].join("\n");
const job = ["---", "id: JOB-910", "kind: run-tests", "works_on:", `  - ${CANDIDATE}`, "route: ci hosted", "started_by: alice", "start: 2026-10-11 22:00 UTC",
  "agent_m: fixture, commit fixture", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json",
  JSON.stringify({ candidate: { version: "2026.4.0", tag: TAG, commit: CANDIDATE }, changelog: "Ten of ten model runs pass." }), "```", ""].join("\n");

// The candidate's snapshot reads the graph the workflow "main changed" stored for its commit on trace-cache (tests/stored-graph-fake.mjs); a page never builds it.
const snapshot = (files, commit) => ({ repository: { path: ON_GITHUB.path, ...ON_GITHUB }, ref: commit, commit, paths: Object.keys(files).sort(), read: async (path) => files[path] ?? null,
  blob: (path) => (files[path] === undefined ? null : blobOf(files[path])),
  ...(commit === CANDIDATE ? { readOn: storedGraphReadOn({ paths: Object.keys(candidateFiles), read: async (path) => candidateFiles[path] ?? null, commit: CANDIDATE }) } : {}) });
const recordOf = (id, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, ["kind: release-report", `file: ${path}`, `blob: ${blobOf(body)}`].join("\n") + "\n"];

// The release candidate of 2026.4.0 is tagged and its run has ended: its report is what MOD-release-evidence composes from the candidate's tree and the results.
const candidateFiles = { "SPEC.md": spec, "tests/rate.test.mjs": declaration, [ACCEPTED]: earlier };
const resultFiles = { [`runs/${OLD}/old.md`]: outcome(OLD, "8 of 10"), [`runs/${CANDIDATE}/now.md`]: outcome(CANDIDATE, "10 of 10") };
const composed = async () => (await releaseReport(snapshot(candidateFiles, CANDIDATE), snapshot(resultFiles, "test-results"),
  { version: "2026.4.0", tag: TAG, commit: CANDIDATE, changelog: "Ten of ten model runs pass." })).text;

// ---------------------------------------------------------------- the fake host

async function fakeHost() {
  const report = await composed();
  const main = { "README.md": "# Thesis tool\n", "CHANGELOG.md": "# Changelog\n", "docs/jobs/JOB-910.md": job, [ACCEPTED]: earlier, [OPEN]: report,
    ...Object.fromEntries([recordOf("release-v2026.3.0", ACCEPTED, earlier)]) };
  const commits = new Map([["main", main], [CANDIDATE, candidateFiles], ["test-results", resultFiles]]);
  const tags = new Map([[TAG, CANDIDATE]]);
  const calls = [];
  let serial = 0;
  return {
    report, calls,
    writes: () => calls.filter((call) => call.fn === "commitFiles"),
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) { const key = tags.get(ref) ?? ref; return snapshot(commits.get(key), key === "main" ? `main-${serial}` : key); },
      async listTags(pattern = "*") {
        const match = new RegExp(`^${pattern.replaceAll(".", "\\.").replaceAll("*", ".*")}$`);
        return [...tags].filter(([name]) => match.test(name)).map(([name, commit]) => ({ name, commit }));
      },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        const next = { ...commits.get("main") };
        for (const file of change.files) next[file.path] = file.text;
        commits.set("main", next);
        // The commit the write made is served by its name too, as a host serves a commit (MOD-repository-hosts' readSnapshot at a commit).
        const commit = `write-${++serial}`;
        commits.set(commit, next);
        return { commit };
      },
      async createTag(name, commit) { calls.push({ fn: "createTag", name, commit }); tags.set(name, commit); },
    },
  };
}

// ---------------------------------------------------------------- the page

function contextOf(fake) {
  const store = openStore("alice/agent-m");
  writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  return { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {},
    product: { address: ON_GITHUB.web, kind: "github", host: fake.host } };
}
async function show(fake, params = {}) {
  assert.ok(route, `the route release-report: ${pages.error?.message}`);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, contextOf(fake), params);
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(new Event("click"));
const rowsOf = (target) => find(target, (node) => node.localName === "tr" && node.getAttribute("data-id"));
const sections = (target) => byClass(target, "section", "review-file");

// ---------------------------------------------------------------- the list

// TST-910101 · level: unit · module: MOD-review-pages
// guards: STATUS IS DERIVED FROM THE RECORDS; THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON; UC-030
// given: a product with two release test reports — v2026.3.0, which an approval record names, and v2026.4.0, which none names — and a token stored
// input: the route release-report rendered with no id
// expect: both reports listed, release-v2026.3.0 with the status accepted and release-v2026.4.0 with the status open, each row linking to its page with the product in the address ("#release-report/id=<id>/product=<the product's address, encoded>"); the link "Review all 1 not accepted"; nothing written
test("MOD-review-pages release-report — the list gives both reports with their status", async () => {
  const fake = await fakeHost();
  const target = await show(fake);

  // An open report stands first in "Open or changed" and again in the full list.
  const rows = rowsOf(target);
  assert.deepEqual([...new Set(rows.map((row) => row.getAttribute("data-id")))].sort(), ["release-v2026.3.0", "release-v2026.4.0"], "every report");
  for (const [id, status] of [["release-v2026.3.0", /accepted/], ["release-v2026.4.0", /open/]]) {
    for (const row of rows.filter((each) => each.getAttribute("data-id") === id)) assert.match(row.textContent, status, `${id} is ${status}`);
  }
  const links = find(target, (node) => node.localName === "a" && /^#release-report\/id=release-v/.test(node.getAttribute("href") ?? "")).map((link) => link.getAttribute("href"));
  assert.ok(links.includes(`#release-report/id=release-v2026.3.0/product=${encodeURIComponent(ON_GITHUB.web)}`) && links.includes(`#release-report/id=release-v2026.4.0/product=${encodeURIComponent(ON_GITHUB.web)}`), "each report links to its page with the product in the address");
  assert.ok(byClass(target, "a", "review-all")[0]?.textContent.includes("Review all 1 not accepted"), "Review all counts the open report");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// ---------------------------------------------------------------- one report

// TST-910102 · level: unit · module: MOD-review-pages
// guards: STATUS IS DERIVED FROM THE RECORDS; THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON; UC-030
// given: the same product, with a token
// input: the route release-report rendered with the id release-v2026.4.0, then with the id release-v2026.3.0
// expect: the first page names release-v2026.4.0, its status open, the text of the report (its "Limitations" section among them), and the button "Accept"; the second page its status accepted and no button "Accept"; nothing written
test("MOD-review-pages release-report/release-v<version> — the open report is shown with Accept, the accepted one without", async () => {
  const fake = await fakeHost();
  const open = await show(fake, { id: "release-v2026.4.0" });

  assert.match(open.textContent, /release-v2026\.4\.0/);
  assert.match(open.textContent, /open/);
  assert.match(open.textContent, /Limitations/, "the report itself is shown");
  const accept = byClass(open, "button", "accept");
  assert.equal(accept.length, 1);
  assert.equal(accept[0].textContent, "Accept");

  const accepted = await show(fake, { id: "release-v2026.3.0" });
  assert.match(accepted.textContent, /accepted/);
  assert.equal(byClass(accepted, "button", "accept").length, 0, "an accepted report offers no Accept");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// ---------------------------------------------------------------- Review all

// TST-910103 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT; THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON; UC-030
// given: the same product, with a token
// input: the route release-report rendered with the id all, then a click on its button
// expect: one section, release-v2026.4.0, and not the accepted release-v2026.3.0; the button "Accept all 1 shown"; the click writes one commit that holds the approval record docs/approvals/release-v2026.4.0-<blob12>.md — "kind: release-report", the report's path and the blob of the text shown — beside the report and the changelog entry, then the tag v2026.4.0 on the tested commit; the page drawn again: nothing to review
test("MOD-review-pages release-report/all — shows only the open report, and Accept all 1 shown writes its record", async () => {
  const fake = await fakeHost();
  const target = await show(fake, { id: "all" });

  assert.deepEqual(sections(target).map((section) => section.getAttribute("data-id")), ["release-v2026.4.0"]);
  const all = byClass(target, "button", "accept-all")[0];
  assert.equal(all?.textContent, "Accept all 1 shown");
  assert.equal(fake.writes().length, 0, "nothing written before the click");
  click(all);
  await until(target, () => fake.writes().length === 1, "the commit");

  const blob = blobOf(fake.report);
  const [{ change }] = fake.writes();
  const record = change.files.find((file) => file.path === `docs/approvals/release-v2026.4.0-${blob.slice(0, 12)}.md`);
  assert.ok(record, "the record of release-v2026.4.0, named after the blob shown");
  assert.match(record.text, /^kind: release-report$/m);
  assert.match(record.text, new RegExp(`^file: ${OPEN.replaceAll(".", "\\.")}$`, "m"));
  assert.match(record.text, new RegExp(`^blob: ${blob}$`, "m"));
  assert.deepEqual(change.files.map((file) => file.path).filter((path) => path.startsWith("docs/approvals/")), [record.path], "one record");
  await until(target, () => fake.calls.some((call) => call.fn === "createTag"), "the tag");
  assert.deepEqual(fake.calls.filter((call) => call.fn === "createTag").map(({ name, commit }) => [name, commit]), [["v2026.4.0", CANDIDATE]], "the tag on the tested commit");
  await until(target, () => sections(target).length === 0 && /Nothing to review/.test(target.textContent), "the page to show nothing left to review");
});
