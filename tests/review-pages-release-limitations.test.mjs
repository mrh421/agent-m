// MOD-review-pages' route release-report (ITM-926), as the accepted text of docs/architecture/MOD-review-pages.md states it: the release test report has the extra
// sections "the limitations — a reason for every failing test and every worse rate — and the changelog entry the person confirms", and its accept is
// MOD-release-evidence.acceptAndRelease, which takes `decision: { limitations: Record<string, string> }` and refuses with LimitationMissing while a failing test
// or a worse rate has no recorded reason (docs/architecture/MOD-release-evidence.md, Interfaces).
// Run: node --test tests/review-pages-release-limitations.test.mjs
//
// Module: MOD-review-pages
// Guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; ACCEPTING THE RELEASE TEST REPORT RELEASES; UC-030
// Level: unit
//
// This brings the repository as tests/review-pages-release-reports.test.mjs does: a Host of the tests' own over snapshots in memory (the default branch, a release
// candidate's tag, the branch test-results), every write recorded; the real MOD-approvals, MOD-release-evidence, MOD-documents and MOD-browser-store run as they are.
// Nothing reaches the network. Where the module file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - A reason field is an `input` of the class `reason` whose `data-id` is the identifier of the failing test or worse rate, inside a section of the class
//     `limitations`; the changelog entry the report holds stands in a section of the class `changelog-entry`.
//   - The reason of a field is its `value`.
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
const FAIL = "TST-926901", RATE = "TST-926902", GUARD = "A MODEL-DEPENDENT TEST IS MEASURED AS A RATE";
const OLD = "e".repeat(40), CANDIDATE = "c".repeat(40);
const EARLIER = "docs/tests/releases/v2026.3.0.md", OPEN = "docs/tests/releases/v2026.4.0.md";
const TAG = "v2026.4.0-rc.1", CHANGELOG = "Ten of ten model runs pass.";

const spec = ["# Thesis tool — Specification", "", `**${GUARD}** *(Product Owner)*`, "A model-dependent test reports a rate.", "*Check:* `tests/rate.test.mjs`", ""].join("\n");
const failDeclaration = ["// " + FAIL, "// level: release", "// module: MOD-review-pages", `// guards: ${GUARD}`, ""].join("\n");
const rateDeclaration = ["// " + RATE, "// level: release", "// module: MOD-review-pages", `// guards: ${GUARD}`, "// runs: 10", "// phrasings: 2", ""].join("\n");
// The report of release 2026.3.0, accepted: its tested commit OLD, the rate 8 of 10.
const earlier = ["---", "version: 2026.3.0", "candidate: v2026.3.0-rc.1", `commit: ${OLD}`, "date: 2026-10-01", "---", "## Limitations", "", "## Levels", "",
  "| Level | Passed | Failed | Flaky | Not run |", "|---|---|---|---|---|", "| release | 1 | 0 | 0 | 0 |", "", "## Tests", "",
  "| Test | Level | Outcome | Guards |", "|---|---|---|---|", `| ${RATE} | release | 8 of 10 | ${GUARD} |`, "", "## Requirements", "",
  "| Requirement | Level | Tests | Outcome |", "|---|---|---|---|", `| ${GUARD} | release | ${RATE} | passed |`, "", "## Changelog entry", "", "Earlier.", ""].join("\n");
const record = (commit, rows) => ["---", `commit: ${commit}`, "levels:", "  - release", "occasion: release-candidate", "participant: ci", "date: 2026-10-11 22:00 UTC", "---",
  "## Outcomes", "", "| Test | Level | Outcome | Runs |", "|---|---|---|---|", ...rows.map(([id, outcome, runs]) => `| ${id} | release | ${outcome} | ${runs} |`), ""].join("\n");
const job = ["---", "id: JOB-926", "kind: run-tests", "works_on:", `  - ${CANDIDATE}`, "route: ci hosted", "started_by: alice", "start: 2026-10-11 22:00 UTC",
  "agent_m: fixture, commit fixture", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json",
  JSON.stringify({ candidate: { version: "2026.4.0", tag: TAG, commit: CANDIDATE }, changelog: CHANGELOG }), "```", ""].join("\n");

// The candidate's snapshot reads the graph the workflow "main changed" stored for its commit on trace-cache (tests/stored-graph-fake.mjs); a page never builds it.
const snapshot = (files, commit) => ({ repository: { path: ON_GITHUB.path, ...ON_GITHUB }, ref: commit, commit, paths: Object.keys(files).sort(), read: async (path) => files[path] ?? null,
  blob: (path) => (files[path] === undefined ? null : blobOf(files[path])),
  ...(commit === CANDIDATE ? { readOn: storedGraphReadOn({ paths: Object.keys(candidateFiles), read: async (path) => candidateFiles[path] ?? null, commit: CANDIDATE }) } : {}) });

// The release candidate of 2026.4.0 is tagged and its run has ended. Red: FAIL failed and RATE at 5 of 10 against the running version's 8 of 10. Green: FAIL passed and RATE at 8 of 10.
const candidateFiles = { "SPEC.md": spec, "tests/fail.test.mjs": failDeclaration, "tests/rate.test.mjs": rateDeclaration, [EARLIER]: earlier };
const resultsOf = (red) => ({ [`runs/${OLD}/old.md`]: record(OLD, [[RATE, "passed", "8 of 10"]]),
  [`runs/${CANDIDATE}/now.md`]: record(CANDIDATE, [[FAIL, red ? "failed" : "passed", ""], [RATE, "passed", red ? "5 of 10" : "8 of 10"]]) });
const composed = async (red) => (await releaseReport(snapshot(candidateFiles, CANDIDATE), snapshot(resultsOf(red), "test-results"),
  { version: "2026.4.0", tag: TAG, commit: CANDIDATE, changelog: CHANGELOG })).text;

// ---------------------------------------------------------------- the fake host

async function fakeHost(red) {
  const report = await composed(red);
  const main = { "README.md": "# Thesis tool\n", "CHANGELOG.md": "# Changelog\n", "docs/jobs/JOB-926.md": job, [EARLIER]: earlier, [OPEN]: report };
  const commits = new Map([["main", main], [CANDIDATE, candidateFiles], ["test-results", resultsOf(red)]]);
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
        return { commit: `write-${++serial}` };
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
const reasonFields = (root) => byClass(root, "input", "reason");
const fieldOf = (root, id) => {
  const field = reasonFields(root).find((each) => each.getAttribute("data-id") === id);
  assert.ok(field, `a reason field for ${id}`);
  return field;
};
const approvalOf = (fake) => fake.writes()[0].change.files.find((file) => file.path.startsWith("docs/approvals/release-v2026.4.0-"));

const WHY_FAIL = "The fixture's failing test is a known gap";
const WHY_RATE = "The rate dropped with the new model";

// ---------------------------------------------------------------- one report

// TST-926001 · level: unit · module: MOD-review-pages
// guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; ACCEPTING THE RELEASE TEST REPORT RELEASES; UC-030
// given: a product with an open red release test report — it names one failing test, TST-926901, and one worse rate, TST-926902 — whose changelog entry reads "Ten of ten model runs pass.", and a token stored
// input: the route release-report rendered with the id release-v2026.4.0
// expect: the changelog entry in a section "changelog-entry"; exactly two reason fields, in the section "limitations", one for TST-926901 and one for TST-926902; the button "Accept"; nothing written
test("MOD-review-pages release-report/release-v<version> — a red report shows its changelog entry and a reason field for each failing test and worse rate", async () => {
  const fake = await fakeHost(true);
  const page = await show(fake, { id: "release-v2026.4.0" });

  const entry = byClass(page, "section", "changelog-entry");
  assert.equal(entry.length, 1, "one section for the changelog entry");
  assert.match(entry[0].textContent, /Ten of ten model runs pass\./);
  const limitations = byClass(page, "section", "limitations");
  assert.equal(limitations.length, 1, "one section for the limitations");
  assert.deepEqual(reasonFields(limitations[0]).map((field) => field.getAttribute("data-id")).sort(), [FAIL, RATE], "a reason field for each of the two, and no other");
  assert.equal(reasonFields(page).length, 2, "no reason field outside the section");
  assert.equal(byClass(page, "button", "accept")[0]?.textContent, "Accept");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// TST-926002 · level: unit · module: MOD-review-pages
// guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; ACCEPTING THE RELEASE TEST REPORT RELEASES; UC-030
// given: the same red report, with a token
// input: the reason "The fixture's failing test is a known gap" typed into the field of TST-926901 and "The rate dropped with the new model" into that of TST-926902, then a click on "Accept"
// expect: one commit with the report, the changelog entry and the approval record docs/approvals/release-v2026.4.0-<blob12>.md, which holds exactly two lines "limitation: <test> — <reason>", one for each test with the reason typed for it; the tag v2026.4.0 on the tested commit
test("MOD-review-pages release-report/release-v<version> — Accept hands both reasons to acceptAndRelease, and the approval holds one limitation line for each", async () => {
  const fake = await fakeHost(true);
  const page = await show(fake, { id: "release-v2026.4.0" });
  fieldOf(page, FAIL).value = WHY_FAIL;
  fieldOf(page, RATE).value = WHY_RATE;
  click(byClass(page, "button", "accept")[0]);
  await until(page, () => fake.calls.some((call) => call.fn === "createTag"), "the tag");

  assert.equal(fake.writes().length, 1, "one commit");
  const approval = approvalOf(fake);
  assert.ok(approval, "the approval record of release-v2026.4.0");
  assert.deepEqual(approval.text.split("\n").filter((line) => line.startsWith("limitation:")).sort(),
    [`limitation: ${FAIL} — ${WHY_FAIL}`, `limitation: ${RATE} — ${WHY_RATE}`], "one limitation line for each, with its reason");
  const changelog = fake.writes()[0].change.files.find((file) => file.path === "CHANGELOG.md");
  assert.match(changelog.text, /Ten of ten model runs pass\./, "the changelog entry the report holds");
  assert.deepEqual(fake.calls.filter((call) => call.fn === "createTag").map(({ name, commit }) => [name, commit]), [["v2026.4.0", CANDIDATE]], "the tag on the tested commit");
});

// TST-926003 · level: unit · module: MOD-review-pages
// guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; UC-030
// given: the same red report, with a token
// input: the reason typed into the field of TST-926901 only, the field of TST-926902 left empty, then a click on "Accept"
// expect: nothing written — no commit, no tag; the page names TST-926902, whose reason is missing, and not TST-926901
test("MOD-review-pages release-report/release-v<version> — with one reason empty nothing is written and the page names the test", async () => {
  const fake = await fakeHost(true);
  const page = await show(fake, { id: "release-v2026.4.0" });
  fieldOf(page, FAIL).value = WHY_FAIL;
  click(byClass(page, "button", "accept")[0]);
  await until(page, () => /needs its reason/.test(page.textContent), "the refusal on the page");

  assert.equal(fake.calls.length, 0, "no commit and no tag");
  const said = byClass(page, "p", "result").map((paragraph) => paragraph.textContent).join(" ");
  assert.ok(said.includes(RATE), "the page names the test whose reason is missing");
  assert.ok(!said.includes(FAIL), "and not the test whose reason is given");
});

// TST-926004 · level: unit · module: MOD-review-pages
// guards: ACCEPTING THE RELEASE TEST REPORT RELEASES; UC-030
// given: a product with an open green release test report — no failing test, no worse rate — whose changelog entry reads "Ten of ten model runs pass.", and a token stored
// input: the route release-report rendered with the id release-v2026.4.0, then a click on "Accept"
// expect: the changelog entry shown and no reason field; the click writes the report, its approval record with no limitation naming a test and the changelog entry in one commit, then the tag v2026.4.0
test("MOD-review-pages release-report/release-v<version> — a green report has no reason field and is accepted as before", async () => {
  const fake = await fakeHost(false);
  const page = await show(fake, { id: "release-v2026.4.0" });

  assert.match(byClass(page, "section", "changelog-entry")[0]?.textContent ?? "", /Ten of ten model runs pass\./);
  assert.equal(reasonFields(page).length, 0, "no reason field");
  click(byClass(page, "button", "accept")[0]);
  await until(page, () => fake.calls.some((call) => call.fn === "createTag"), "the tag");

  assert.equal(fake.writes().length, 1, "one commit");
  assert.ok(!/^limitation: \S/m.test(approvalOf(fake).text), "no limitation line that names a test");
  assert.deepEqual(fake.calls.filter((call) => call.fn === "createTag").map(({ name }) => name), ["v2026.4.0"]);
});

// ---------------------------------------------------------------- Review all

// TST-926005 · level: unit · module: MOD-review-pages
// guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-030
// given: the same red report, with a token
// input: the route release-report rendered with the id all; the two reasons typed into the fields of the section release-v2026.4.0; a click on "Accept all 1 shown"
// expect: the section release-v2026.4.0 holds its changelog entry and the two reason fields; the click writes the approval record with one limitation line for each of the two tests with its reason, and sets the tag v2026.4.0
test("MOD-review-pages release-report/all — Accept all N shown hands each report's reasons to acceptAndRelease", async () => {
  const fake = await fakeHost(true);
  const page = await show(fake, { id: "all" });

  const shown = byClass(page, "section", "review-file").find((section) => section.getAttribute("data-id") === "release-v2026.4.0");
  assert.ok(shown, "the open report is shown");
  assert.match(byClass(shown, "section", "changelog-entry")[0]?.textContent ?? "", /Ten of ten model runs pass\./);
  assert.deepEqual(reasonFields(shown).map((field) => field.getAttribute("data-id")).sort(), [FAIL, RATE]);
  fieldOf(shown, FAIL).value = WHY_FAIL;
  fieldOf(shown, RATE).value = WHY_RATE;
  click(byClass(page, "button", "accept-all")[0]);
  await until(page, () => fake.calls.some((call) => call.fn === "createTag"), "the tag");

  assert.deepEqual(approvalOf(fake).text.split("\n").filter((line) => line.startsWith("limitation:")).sort(),
    [`limitation: ${FAIL} — ${WHY_FAIL}`, `limitation: ${RATE} — ${WHY_RATE}`], "one limitation line for each, with its reason");
});
