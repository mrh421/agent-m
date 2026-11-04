// Release tests of UC-035 Follow progress on the process dashboard: one for each requirement UC-035 realises but PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE, whose release test is
// tests/test_progress_view.py, the check SPEC.md names for it. Each is written from the requirement's text and from UC-035, and reaches the page as the dashboard does: the real route
// `progress` of MOD-implementation-pages, drawn into a fixture DOM with the review page's context over a product held in memory (tests/implementation-pages-sprints.mjs), and, for
// PROGRESS AND JOB STATE ARE DERIVED, NOT STORED, the real dashboard at #progress (tests/app-harness.mjs). No request leaves the process.
// Run: node --test tests/release-uc-035-progress.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-progress-measures
// Guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; A PLAN COVERS THE WHOLE SPECIFICATION; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN; THE GATE IS RECORDED; STATUS IS DERIVED FROM THE RECORDS; THE TRACEABILITY MATRIX IS DERIVED; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN; EVERY STEP EXPLAINS ITSELF; UC-035
// Level: release
//
// Authored by developer-opus-f (ITM-806), who implemented none of the items that realise UC-035 and no UC-035 production behaviour (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
// Readings the texts leave open, which the cases state:
//   - "the steps of the implementation plan" on the progress page (UC-035, the table; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN) are the steps of docs/plan/order.md in its order; a
//     backlog item is no step of it.
//   - "never stored": the page commits nothing, and the traces behind a cell, a card or a chart are reached on the trace page, which derives them, not in a file of the repository.
//   - "a step that asks something of the person" on the progress page is a control it offers: Plan sprint, Change the selection, End sprint.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { COMMIT, DECLARATION_AT_HEAD, PULL_REQUESTS, found, productFiles, render, row } from "./implementation-pages-sprints.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const lines = (...rows) => `${rows.join("\n")}\n`;
const plain = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/\s+/g, " ").trim();
const attr = (element, name) => element.getAttribute(name);
const V_MODEL = read("../src/model-catalogue/models/v-model.md");
const V_PHASES = ["Concept", "Requirements", "Design", "Implementation", "Testing", "Validation & Verification", "Operation & Maintenance"];
const blobOf = (text) => createHash("sha1").update(text).digest("hex");
const panelOf = (page, name) => found(page.target, "[data-part]").find((each) => attr(each, "data-part") === name);
const gateRows = (page) => found(panelOf(page, "gates"), "[data-label]").filter((each) => attr(each, "data-label") === "Gate").map((each) => plain(each.parentNode.innerHTML));

const item = (id, realises = "RULE ONE") => lines("---", `id: ${id}`, `title: The work of ${id}`, "level: module", "realises:", `  - ${realises}`, "modules:", "  - MOD-store", "builds_on: []",
  "tests:", "  - unit", "origin:", `  - ${realises}`, "---", `# ${id} The work of ${id}`, "", "## Outcome", "", `What ${id} delivers.`, "", "## Acceptance", "", "- a unit test.");
const specOf = (...names) => lines("# SPEC", "", "## 1. Rules", "", ...names.flatMap((name) => [`**${name}** *(PO, 2026-09-01)*`, `The rule ${name}.`, "*Check:* at review.", ""]));
const V_ASSIGNMENT = lines("# product", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Product owner | alice |", "| Developer | dev-a |", "| Tester | dev-a |", "| Reviewer | alice |");
// A V-model product whose implementation plan names ITM-011 (Implementation) before ITM-010 (Testing), both for RULE ONE; the backlog also holds ITM-099, which is no step of the plan.
const vModelFiles = (extra = {}) => ({
  "SPEC.md": specOf("RULE ONE", "RULE TWO"), "docs/process.md": productFiles()["docs/process.md"], "docs/process-models/fixture.md": V_MODEL, "docs/role-assignments/product.md": V_ASSIGNMENT,
  "docs/plan/order.md": lines("## Order", "", "| Step | Phase |", "| --- | --- |", "| ITM-011 | Implementation |", "| ITM-010 | Testing |"),
  "docs/plan/ITM-010-check.md": item("ITM-010"), "docs/plan/ITM-011-store.md": item("ITM-011"), "docs/backlog/ITM-099-loose.md": item("ITM-099"), ...extra,
});
const pr = (number, id, state, opened, merged = null) => ({ number, title: `${id}: the work of ${id}`, branch: `work/${id}`, base: "main", head: String(number % 10).repeat(40), state, draft: false,
  url: `https://github.com/acme/product/pull/${number}`, opened, merged, closed: merged, body: "", updated: merged ?? opened, mergeCommit: merged ? "f".repeat(40) : null });
const V_PULLS = [pr(11, "ITM-011", "merged", "2026-10-20T09:00:00Z", "2026-10-21T10:00:00Z")];
const gateRecord = (gate, on, { decider = "alice", date = "2026-10-22 09:00 UTC" } = {}) => lines("---", `gate: ${gate}`, "job:", `decider: ${decider}`, "role: Owner", "decision: passed", "on:",
  ...on.map((entry) => `  - ${entry}`), `date: ${date}`, "---", `# ${gate}`, "", "**REGISTER**");
const GATE_PATH = "docs/gates/20261022-0900-building-checking-ab12.md";
const ITEM_2 = "docs/backlog/ITM-002-item-2.md";

// TST-806101 · level: release · module: MOD-implementation-pages
// guards: A PLAN COVERS THE WHOLE SPECIFICATION
// given: a V-model product (7 phases) whose SPEC holds N = 2 accepted requirements, RULE ONE and RULE TWO; then the same product with RULE THREE accepted as well
// input: the reader opens Progress of each
// expect: the first grid holds exactly N × P = 14 entries, one for each requirement in each phase; the second holds 21, the 7 more being RULE THREE's, one in each phase
test("TST-806101 the plan on the progress page holds every accepted requirement in every phase of the model", async () => {
  const entries = (page) => found(page.target, "[data-cell]").map((each) => `${attr(each, "data-requirement")} × ${attr(each, "data-phase")}`);
  const two = await render("progress", {}, { files: vModelFiles(), pullRequests: V_PULLS });
  const three = await render("progress", {}, { files: vModelFiles({ "SPEC.md": specOf("RULE ONE", "RULE TWO", "RULE THREE") }), pullRequests: V_PULLS });
  try {
    const every = (names) => names.flatMap((name) => V_PHASES.map((phase) => `${name} × ${phase}`)).sort();
    assert.deepEqual(entries(two).sort(), every(["RULE ONE", "RULE TWO"]), "N × P entries");
    assert.deepEqual(entries(three).sort(), every(["RULE ONE", "RULE TWO", "RULE THREE"]), "one more requirement adds P entries");
    assert.deepEqual(entries(three).filter((entry) => !entries(two).includes(entry)).sort(), every(["RULE THREE"]));
  } finally { two.done(); three.done(); }
});

// TST-806102 · level: release · module: MOD-implementation-pages
// guards: A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN
// given: the V-model product whose implementation plan orders ITM-011 (merged) before ITM-010, and whose backlog also holds ITM-099, which no step of the plan names
// input: the reader opens Progress (UC-035: "beside it, the steps of the implementation plan with their states")
// expect: beside the grid stand exactly the plan's steps, ITM-011 then ITM-010, ITM-011 done and ITM-010 with a state that is not done; ITM-099 is not among them
test("TST-806102 the progress page shows the steps of the implementation plan in its order with their states, and no work the plan does not name", async () => {
  const page = await render("progress", {}, { files: vModelFiles(), pullRequests: V_PULLS });
  try {
    const steps = found(page.target, "[data-step]");
    assert.deepEqual(steps.map((each) => attr(each, "data-step")), ["ITM-011", "ITM-010"]);
    assert.match(plain(steps[0].innerHTML), /^ITM-011 done/);
    assert.doesNotMatch(plain(steps[1].innerHTML), /^ITM-010 done/);
    assert.ok(plain(steps[1].innerHTML).length > "ITM-010 ".length, "ITM-010 with its state");
    assert.ok(!page.html().includes("ITM-099"), "the backlog item is no step");
  } finally { page.done(); }
});

// TST-806103 · level: release · module: MOD-implementation-pages
// guards: THE GATE IS RECORDED
// given: the Scrum product whose record docs/gates/20261022-0900-building-checking-ab12.md, by alice on 2026-10-22 09:00 UTC, passes Building → Checking on ITM-002's file at its current blob
// input: the reader opens Progress
// expect: the gate is shown passed, with who decided (alice), when (2026-10-22 09:00 UTC) and on which text (docs/backlog/ITM-002-item-2.md@<its blob>), with a link "record" to its gate record; the gate without a record, Checking → Closing, names no decider
test("TST-806103 a passed gate shows who decided, when, and on which text", async () => {
  const files = productFiles();
  files[GATE_PATH] = gateRecord("Building → Checking", [`${ITEM_2}@${blobOf(files[ITEM_2])}`]);
  const page = await render("progress", {}, { files });
  try {
    const [passed, next] = gateRows(page);
    assert.equal(passed, `Building → Checking passed alice, 2026-10-22 09:00 UTC, on ${ITEM_2}@${blobOf(files[ITEM_2])}, record —`);
    assert.doesNotMatch(next, /alice/, "a gate without a record names no decider");
  } finally { page.done(); }
});

// TST-806104 · level: release · module: MOD-implementation-pages
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: the same record of Building → Checking on ITM-002's file at a blob; (a) the file still holds that text; (b) the file has changed since
// input: the reader opens Progress of each
// expect: (a) the gate is passed and the next gate, Checking → Closing, is pending; (b) the gate is passed on an earlier text, not passed, and the next gate is not reached — the state follows the record and the current text, nothing stored
test("TST-806104 a gate counts as passed exactly while its record names the current text", async () => {
  const files = productFiles();
  const record = gateRecord("Building → Checking", [`${ITEM_2}@${blobOf(files[ITEM_2])}`]);
  const same = await render("progress", {}, { files: { ...files, [GATE_PATH]: record } });
  const changed = await render("progress", {}, { files: { ...files, [GATE_PATH]: record, [ITEM_2]: files[ITEM_2].replace("What item 2 delivers.", "What item 2 delivers now.") } });
  try {
    const [a1, a2] = gateRows(same), [b1, b2] = gateRows(changed);
    assert.match(a1, /^Building → Checking passed alice/, "known positive: on the current text it is passed");
    assert.match(a2, /^Checking → Closing pending/);
    assert.match(b1, /^Building → Checking passed on an earlier text/);
    assert.match(b2, /^Checking → Closing not reached/, "the gate on an earlier text does not count as passed");
  } finally { same.done(); changed.done(); }
});

// TST-806105 · level: release · module: MOD-implementation-pages
// guards: THE TRACEABILITY MATRIX IS DERIVED
// given: the V-model product of TST-806101, which holds no file of a traceability matrix
// input: the reader opens Progress and looks at where its cells and its steps' trace lead
// expect: every cell leads to the trace page (#trace/…) at the branch shown (ref=main), where the traces are computed from the artifacts; the page committed nothing and read no file that holds a matrix
test("TST-806105 the traces behind the progress page are reached on the derived trace page, and no matrix is written or read", async () => {
  const page = await render("progress", {}, { files: vModelFiles(), pullRequests: V_PULLS });
  try {
    const cells = found(page.target, "[data-cell]");
    assert.equal(cells.length, 14, "known positive: the grid is drawn");
    for (const cell of cells) assert.match(attr(cell, "href"), /^#trace\/.*ref=main\b/, `${attr(cell, "data-requirement")} × ${attr(cell, "data-phase")}`);
    assert.deepEqual(page.host.commits, [], "nothing is written");
    assert.deepEqual(Object.keys(page.files).filter((path) => /matrix/i.test(path)), [], "no matrix file");
  } finally { page.done(); }
});

// TST-806106 · level: release · module: MOD-implementation-pages
// guards: UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// given: the V-model product whose SPEC holds RULE ONE, which the plan's steps realise, and RULE TWO, which no use case and no step realises
// input: the reader opens Progress
// expect: RULE TWO has its row of cells in every phase, as RULE ONE has; nothing about RULE TWO is listed as blocked; the gates, Blocked and Who works on what still stand
test("TST-806106 a requirement nothing realises is shown in the grid and blocks nothing", async () => {
  const page = await render("progress", {}, { files: vModelFiles(), pullRequests: V_PULLS });
  try {
    const of = (name) => found(page.target, "[data-cell]").filter((each) => attr(each, "data-requirement") === name).map((each) => attr(each, "data-phase"));
    assert.deepEqual(of("RULE ONE"), V_PHASES, "known positive: RULE ONE in every phase");
    assert.deepEqual(of("RULE TWO"), V_PHASES, "RULE TWO is shown as well");
    assert.doesNotMatch(plain(panelOf(page, "blocked").innerHTML), /RULE TWO/);
    assert.ok(["gates", "blocked", "who"].every((name) => panelOf(page, name)), "the rest of the page stands");
  } finally { page.done(); }
});

// TST-806107 · level: release · module: MOD-implementation-pages
// guards: EVERY STEP EXPLAINS ITSELF
// given: the Scrum product of two teams: team1's running sprint offers Change the selection and End sprint, team2 without one offers Plan sprint
// input: the reader opens Progress
// expect: each panel that offers one of these steps — and every other panel and the page's head — carries a folded "What is this?" (a details that is not open), whose text is not empty
test("TST-806107 each step the progress page offers carries a folded explanation", async () => {
  const page = await render("progress");
  try {
    const panels = found(page.target, "[class]").filter((each) => each.localName === "section" && /\b(panel|head)\b/.test(attr(each, "class")));
    const asking = panels.filter((panel) => /Plan sprint|Change the selection|End sprint/.test(plain(panel.innerHTML)));
    assert.ok(asking.length >= 2, `known positive: the steps are offered (${asking.length})`);
    for (const panel of panels) {
      const details = found(panel, "[class]").find((each) => each.localName === "details");
      const name = attr(panel, "data-part") ?? attr(panel, "data-team") ?? attr(panel, "class");
      assert.ok(details && attr(details, "open") === null && /What is this\?/.test(details.textContent), `${name}: a folded What is this?`);
      assert.ok(plain(details.innerHTML).length > "What is this?".length + 20, `${name}: an explanation`);
    }
  } finally { page.done(); }
});

// TST-806108 · level: release · module: MOD-implementation-pages
// guards: PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the dashboard over a fake of GitHub whose repository is the Scrum product of two teams (ITM-001 merged, ITM-002 in progress, the job JOB-20261027-0900-a1b2 of dev-a not ended)
// input: the reader opens #progress; then all local storage and the kept texts are deleted and the page is loaded again; then it is loaded with states planted in local storage
// expect: the second and the third load show the same page as the first — the same item states and the same current job —; the first shows ITM-001 done, ITM-002 in progress and the job
test("TST-806108 deleting all local storage and reloading shows the same progress and the same job states", async () => {
  const { REPO, fakeCaches, openDashboard, repoServer } = await import("./app-harness.mjs");
  const head = "c0ffee".padEnd(40, "0");
  const files = productFiles({ "docs/process.md": DECLARATION_AT_HEAD.replace(COMMIT, head) });
  const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  const github = (p) => ({ number: p.number, title: p.title, head: { ref: p.branch, sha: p.head }, base: { ref: p.base }, state: p.state === "open" ? "open" : "closed", merged_at: p.merged,
    merge_commit_sha: p.mergeCommit, created_at: p.opened, updated_at: p.updated, closed_at: p.closed, draft: false, html_url: p.url, body: p.body });
  const pulls = (url) => (url.origin !== "https://api.github.com" ? undefined : url.pathname === `/repos/${REPO}/pulls` ? json(PULL_REQUESTS.map(github))
    : url.pathname === "/search/issues" ? json({ total_count: 0, incomplete_results: false, items: [] }) : undefined);
  const planted = Object.fromEntries(["agent-m.item-states", "agent-m.progress", "agent-m.jobs", `agent-m:${REPO}:progress`, `agent-m:${REPO}:item-states`]
    .map((key) => [key, JSON.stringify({ "ITM-001": "ready", "ITM-002": "done", "JOB-20261027-0900-a1b2": "failed" })]));
  const kept = Object.fromEntries(["document", "window", "location", "localStorage", "caches", "fetch", "addEventListener"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  try {
    const caches = fakeCaches();
    const first = (await openDashboard({ server: await repoServer({ files, handlers: [pulls] }), hash: "#progress", caches })).main();
    const cleared = (await openDashboard({ server: await repoServer({ files, handlers: [pulls] }), hash: "#progress", caches: fakeCaches() })).main();
    const withPlanted = (await openDashboard({ server: await repoServer({ files, handlers: [pulls] }), hash: "#progress", caches, entries: planted })).main();
    assert.match(plain(row(first, "ITM-001")), /\bdone\b/, "known positive: ITM-001 is done");
    assert.match(plain(row(first, "ITM-002")), /in progress/, "known positive: ITM-002 is in progress");
    assert.match(first, /JOB-20261027-0900-a1b2/, "known positive: the current job");
    assert.equal(cleared, first, "after deleting local storage and the kept texts");
    assert.equal(withPlanted, first, "with states planted in local storage");
  } finally {
    for (const [name, descriptor] of Object.entries(kept)) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});
