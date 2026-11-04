// System coverage for UC-035 Follow progress on the process dashboard, walked as the dashboard reaches it: the main flow, steps 1 to 6 and the folded explanations of its charts and
// panels, and the alternative flows 1a, 1b, 2a, 2b, 2c, 2d and 3a. The page is the real route `progress` of MOD-implementation-pages, drawn into a fixture DOM with the review page's
// context over a product held in memory (tests/implementation-pages-sprints.mjs, as the existing tests of the route reach it), over the real MOD-repository-hosts host behind a fake
// of GitHub's API where the instance's SPEC or a stored view is needed (renderOverGitHub), and, for 1a, the real dashboard (tests/app-harness.mjs, openDashboard at #progress). What
// it draws is MOD-progress-measures' view. No request leaves the process.
// Run: node --test tests/system-uc-035-follow-progress.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-progress-measures
// Guards: UC-035
// Level: system
//
// Authored by developer-opus-f (ITM-806), who implemented none of the items that realise UC-035 and no UC-035 production behaviour (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
// Each test states its input and its expected result in its own text, written from UC-035, not from the code. Where the page and UC-035 disagree, the case follows UC-035 and is
// marked { todo } with the finding it reports. A person's click is not made: what a click leads to is the link the page draws for it.
// Readings the texts leave open, which the cases state:
//   - "a burn-down of remaining items per day of the sprint" is read as a chart with one point for each day from the sprint's start to today.
//   - "linked to the gate record" is read as a link in the gate's row whose address ends with the record's path.
//   - "shows the items or requirements behind it" (step 6) is read as the trace page of the requirement (or use case) behind a cell or card; the item and the pull request of the chain stay a finding.
//   - "It points to book ch. 7 or ch. 15" is read for each folded explanation of a chart or panel.
//   - 1b: a job source that cannot be reached is a Bridge that the page does not reach — here a Bridge of another machine, which no setting of this page names.
//   - 2c: "The chart starts at the change" is read as the first day of the cumulative flow being the day of the change; "earlier progress stays readable in the model it was made under" as
//     the page saying when the model changed and holding a link, other than to the trace page, to the progress before that day.

import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { COMMIT, DECLARATION_AT_HEAD, PULL_REQUESTS, TEAM1_RUNNING, found, hostOf, part, productFiles, render, renderOverGitHub, row, sprint } from "./implementation-pages-sprints.mjs";
import { productFacts, progressView } from "../src/progress-measures/index.mjs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const lines = (...rows) => `${rows.join("\n")}\n`;
const plain = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/\s+/g, " ").trim();
const V_MODEL = read("../src/model-catalogue/models/v-model.md");
const KANBAN = read("./fixtures/flow/kanban.md");
const V_PHASES = ["Concept", "Requirements", "Design", "Implementation", "Testing", "Validation & Verification", "Operation & Maintenance"];
const today = () => new Date().toISOString().slice(0, 10);
const dayAfter = (day) => new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
const daysFrom = (start) => { const days = []; for (let day = start; day <= today(); day = dayAfter(day)) days.push(day); return days; };
const attr = (element, name) => element.getAttribute(name);
const panelOf = (page, name) => found(page.target, "[data-part]").find((each) => attr(each, "data-part") === name);
const teamPanel = (page, team) => found(page.target, "[data-team]").find((each) => attr(each, "data-team") === team);
const linksIn = (element) => found(element, "[href]").map((each) => attr(each, "href"));
const blobOf = (text) => createHash("sha1").update(text).digest("hex");
const gitBlobOf = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");

const item = (id, { realises = "RULE ONE", module = "MOD-store" } = {}) => lines("---", `id: ${id}`, `title: The work of ${id}`, "level: module", "realises:", `  - ${realises}`, "modules:", `  - ${module}`,
  "builds_on: []", "tests:", "  - unit", "origin:", `  - ${realises}`, "---", `# ${id} The work of ${id}`, "", "## Outcome", "", `What ${id} delivers.`, "", "## Acceptance", "", "- a unit test.");
const pr = (number, id, state, opened, merged = null) => ({ number, title: `${id}: the work of ${id}`, branch: `work/${id}`, base: "main", head: String(number % 10).repeat(40), state, draft: false,
  url: `https://github.com/acme/product/pull/${number}`, opened, merged, closed: merged, body: "", updated: merged ?? opened, mergeCommit: merged ? "f".repeat(40) : null });
const job = (id, works, { participant = "dev-a", route = "ci hosted", tail = [] } = {}) => lines("---", `id: ${id}`, "kind: implement", "works_on:", `  - ${works}`, `participant: ${participant}`,
  "model: example-model", `route: ${route}`, "started_by: alice", "start: 2026-10-28 10:00 UTC", "agent_m: unknown, commit unknown", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json", "{}", "```", ...tail);
const gateRecord = (gate, on, { decider = "alice", date = "2026-10-22 09:00 UTC" } = {}) => lines("---", `gate: ${gate}`, "job:", `decider: ${decider}`, "role: Owner", "decision: passed", "on:",
  ...on.map((entry) => `  - ${entry}`), `date: ${date}`, "---", `# ${gate}`, "", "**REGISTER**");
const GATE_PATH = "docs/gates/20261022-0900-building-checking-ab12.md";

// A V-model product: the SPEC's requirements, one role assignment, and an implementation plan of two steps for RULE ONE — ITM-010 in Implementation, merged; ITM-011 in Testing, not started.
const V_ASSIGNMENT = lines("# product", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Product owner | alice |", "| Developer | dev-a |", "| Tester | dev-a |", "| Reviewer | alice |");
const specOf = (...names) => lines("# SPEC", "", "## 1. Rules", "", ...names.flatMap((name) => [`**${name}** *(PO, 2026-09-01)*`, `The rule ${name}.`, "*Check:* at review.", ""]));
const vModelFiles = (extra = {}) => ({
  "SPEC.md": specOf("RULE ONE", "RULE TWO"), "docs/process.md": productFiles()["docs/process.md"], "docs/process-models/fixture.md": V_MODEL, "docs/role-assignments/product.md": V_ASSIGNMENT,
  "docs/plan/order.md": lines("## Order", "", "| Step | Phase |", "| --- | --- |", "| ITM-010 | Implementation |", "| ITM-011 | Testing |"),
  "docs/plan/ITM-010-store.md": item("ITM-010"), "docs/plan/ITM-011-check.md": item("ITM-011"), ...extra,
});
const V_PULLS = [pr(10, "ITM-010", "merged", "2026-10-20T09:00:00Z", "2026-10-21T10:00:00Z")];

// ---------------------------------------------------------------- the main flow

// TST-806001 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the Scrum product of two teams (tests/implementation-pages-sprints.mjs): team1 runs its sprint team1/03 with ITM-001, merged on 2026-10-21, and ITM-002, whose pull request is open; team2 has no running sprint
// input: the reader opens Progress for the product (steps 1 and 2)
// expect: a panel for team1's running sprint, named by its team and its sprint team1/03, lists ITM-001 as done and ITM-002 as in progress and draws a burn-down named team1; no grid cell, card or flow chart stands on the page; and nothing was written: the host saw no commit (postcondition)
test("TST-806001 UC-035 steps 1 and 2: a Scrum product shows each team's running sprint, its items with their states and its burn-down, and writes nothing", async () => {
  const page = await render("progress");
  try {
    const team1 = teamPanel(page, "team1");
    assert.ok(team1 && /team1/.test(plain(team1.innerHTML)) && /team1\/03/.test(plain(team1.innerHTML)), "the panel of team1's running sprint, named by its team and its sprint");
    assert.match(plain(row(page.html(), "ITM-001")), /\bdone\b/, "ITM-001 is done");
    assert.match(plain(row(page.html(), "ITM-002")), /in progress/, "ITM-002 is in progress");
    assert.equal(found(page.target, "[data-burn-down]").map((each) => attr(each, "data-burn-down")).join(), "team1", "one burn-down, named by its team");
    assert.deepEqual([found(page.target, "[data-cell]").length, found(page.target, "[data-card]").length, found(page.target, "[data-flow-chart]").length], [0, 0, 0], "no other model's measure");
    assert.deepEqual(page.host.commits, [], "nothing was written");
  } finally { page.done(); }
});

// TST-806002 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the Scrum product of TST-806001, whose sprint team1/03 started on 2026-10-20
// input: the reader opens Progress (step 2, the table: "a burn-down of remaining items per day of the sprint")
// expect: team1's burn-down has one point for each day from 2026-10-20 to today, each labelled by its day
test("TST-806002 UC-035 step 2: the burn-down counts the remaining items per day of the sprint", async () => {
  mock.timers.enable({ apis: ["Date"], now: Date.UTC(2026, 9, 23, 12) });
  const page = await render("progress");
  try {
    const source = plain(found(page.target, "[data-burn-down]")[0]?.innerHTML ?? "");
    const labels = (/x-axis \[([^\]]*)\]/.exec(source)?.[1] ?? "").split(",").map((each) => each.trim().replace(/^"|"$/g, ""));
    assert.ok(labels.length > 1, `known positive: the chart is drawn (${source.slice(0, 80)})`);
    assert.deepEqual(labels, daysFrom("2026-10-20").map((day) => day.slice(5)), "a point for each day of the sprint");
  } finally { page.done(); mock.timers.reset(); }
});

// TST-806003 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: a V-model product whose SPEC holds RULE ONE and RULE TWO and whose implementation plan holds ITM-010 (RULE ONE, phase Implementation; its pull request merged) and ITM-011 (RULE ONE, phase Testing; not started)
// input: the reader opens Progress (step 2, a planned model)
// expect: a grid of RULE ONE and RULE TWO × the seven V-model phases, 14 cells, each open, in progress or done; RULE ONE's Implementation cell is done and its Testing cell open; the seven phases stand on a timeline in their order, with the gates Requirements → Design, Design → Implementation and Validation & Verification → Operation & Maintenance as milestones; beside it the steps ITM-010 (done) and ITM-011 with its state
test("TST-806003 UC-035 step 2: a planned product shows the grid of requirements by phases, the phases on a timeline with their gates, and the steps of the plan", async () => {
  const page = await render("progress", {}, { files: vModelFiles(), pullRequests: V_PULLS });
  try {
    const cells = found(page.target, "[data-cell]");
    assert.equal(cells.length, 14, "2 requirements × 7 phases");
    for (const cell of cells) assert.match(plain(cell.innerHTML), /^(open|in progress|done)$/, `${attr(cell, "data-requirement")} × ${attr(cell, "data-phase")}`);
    const cell = (requirement, phase) => plain(cells.find((each) => attr(each, "data-requirement") === requirement && attr(each, "data-phase") === phase)?.innerHTML ?? "");
    assert.equal(cell("RULE ONE", "Implementation"), "done", "its step is merged");
    assert.equal(cell("RULE ONE", "Testing"), "open", "its step has not started");
    assert.deepEqual(found(page.target, "[data-phase-entry]").map((each) => attr(each, "data-phase-entry")), V_PHASES, "the phases on a timeline, in their order");
    const timeline = plain(found(page.target, "[data-phase-entry]").map((each) => each.innerHTML).join(" | "));
    for (const gate of ["Requirements → Design", "Design → Implementation", "Validation & Verification → Operation & Maintenance"]) assert.ok(timeline.includes(gate), `the gate ${gate} as a milestone`);
    const steps = found(page.target, "[data-step]");
    assert.deepEqual(steps.map((each) => attr(each, "data-step")), ["ITM-010", "ITM-011"], "the steps of the plan");
    assert.match(plain(steps[0].innerHTML), /ITM-010 done/);
    assert.ok(plain(steps[1].innerHTML).length > "ITM-011".length, "ITM-011 with its state");
  } finally { page.done(); }
});

// TST-806004 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the product of tests/implementation-pages-sprints.mjs with the Kanban fixture as its model (work-in-progress limit 2, no sprints): ITM-001 and ITM-003 merged, ITM-002's pull request open, ITM-004 and ITM-005 untouched
// input: the reader opens Progress (step 2, a model with a WIP limit)
// expect: the board with its columns, each named, and the limit 2; ITM-002's card in the column "in progress", ITM-001's and ITM-003's in "done"; and a cumulative flow chart
test("TST-806004 UC-035 step 2: a Kanban product shows the board with its columns and its WIP limit, and a cumulative flow chart", async () => {
  const page = await render("progress", {}, { files: productFiles({ "docs/process-models/fixture.md": KANBAN }) });
  try {
    const column = (name) => found(page.target, "[data-column]").find((each) => attr(each, "data-column") === name);
    const cards = (name) => (column(name) ? found(column(name), "[data-card]") : []).map((each) => attr(each, "data-card"));
    assert.deepEqual(cards("in progress"), ["ITM-002"]);
    assert.deepEqual(cards("done").sort(), ["ITM-001", "ITM-003"]);
    assert.match(plain(panelOf(page, "measure").innerHTML), /limit: 2\b/, "the WIP limit");
    for (const each of found(page.target, "[data-column]")) assert.ok(plain(part(page.html(), "data-part=\"measure\"")).includes(attr(each, "data-column")), `the column ${attr(each, "data-column")} is named`);
    assert.equal(found(page.target, "[data-flow-chart]").length, 1, "a cumulative flow chart");
  } finally { page.done(); }
});

// The product over GitHub, where it is the instance itself: its SPEC holds the process requirement A GATE BEFORE CLOSING (source PO A. Maier), which its declaration adds as the gate
// Closing → Planning; the gate Building → Checking is passed by the record GATE_PATH on ITM-002's text as it stands.
const ADDED = "A GATE BEFORE CLOSING";
const gatedFiles = () => {
  const files = productFiles({ "docs/process.md": DECLARATION_AT_HEAD });
  files["SPEC.md"] += lines("", `**${ADDED}** *(PO A. Maier)*`, "A cycle is closed only after a review.", "*Check:* at review.");
  files["docs/process.md"] += lines("", "## Gates added by requirements", "", "| Requirement | Between | Artifacts | Condition | Decider |", "|---|---|---|---|---|", `| ${ADDED} | Closing → Planning | the record of the cycle | reviewed | Owner |`);
  files[GATE_PATH] = gateRecord("Building → Checking", [`docs/backlog/ITM-002-item-2.md@${gitBlobOf(files["docs/backlog/ITM-002-item-2.md"])}`]);
  return files;
};
const gateRows = (page) => found(panelOf(page, "gates"), "[data-label]").filter((each) => attr(each, "data-label") === "Gate").map((each) => each.parentNode);

// TST-806005 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the Scrum product over GitHub whose workflow has the gates Building → Checking, Checking → Closing and the gate A GATE BEFORE CLOSING (Closing → Planning) that its declaration adds for the instance's requirement of that name (source PO A. Maier); a record by alice on 2026-10-22 09:00 UTC passes Building → Checking on ITM-002's current text
// input: the reader opens Progress (step 3)
// expect: below the chart the gates in the workflow's order: Building → Checking passed, naming alice, 2026-10-22 and the text it was decided on (ITM-002's file); Checking → Closing pending, naming what it still needs (the CI check release-tests); A GATE BEFORE CLOSING not reached and marked with its requirement and its source PO A. Maier
test("TST-806005 UC-035 step 3: the gates in order, passed with who, when and on which text, pending with what it needs, not reached, and an added gate with its requirement and source", async () => {
  const page = await renderOverGitHub("progress", {}, { files: gatedFiles() });
  try {
    const rows = gateRows(page).map((each) => plain(each.innerHTML));
    assert.equal(rows.length, 3, `three gates (${rows.join(" | ")})`);
    assert.match(rows[0], /^Building → Checking passed alice, 2026-10-22[^,]*, on docs\/backlog\/ITM-002-item-2\.md@[0-9a-f]{40}/);
    assert.match(rows[1], /^Checking → Closing pending .*release-tests/);
    assert.match(rows[2], new RegExp(`^${ADDED} .*${ADDED} \\(PO A\\. Maier\\) not reached`));
    const html = page.html();
    assert.ok(html.indexOf('data-part="gates"') > html.indexOf("data-team="), "the gates stand below the sprints' charts");
  } finally { page.done(); }
});

// TST-806006 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the product of TST-806005, whose gate Building → Checking is passed by the record docs/gates/20261022-0900-building-checking-ab12.md
// input: the reader opens Progress (step 3: "passed: who decided, when, and on which text, linked to the gate record")
// expect: the row of Building → Checking holds a link whose address ends with docs/gates/20261022-0900-building-checking-ab12.md
test("TST-806006 UC-035 step 3: a passed gate is linked to its gate record", async () => {
  const page = await renderOverGitHub("progress", {}, { files: gatedFiles() });
  try {
    const passed = gateRows(page)[0];
    assert.match(plain(passed.innerHTML), /^Building → Checking passed/, "known positive: the gate is passed");
    assert.ok(linksIn(passed).some((href) => href.endsWith(GATE_PATH)), `a link to the record (${linksIn(passed)})`);
  } finally { page.done(); }
});

// The product of tests/implementation-pages-sprints.mjs with more items in team1's running sprint, each kept from moving for another reason, and team2 running a sprint of its own.
const blockedFiles = () => productFiles({
  [TEAM1_RUNNING]: sprint({ n: 3, start: "2026-10-20", goal: "Store and show", selection: ["ITM-001", "ITM-002", "ITM-006", "ITM-007", "ITM-008", "ITM-009", "ITM-010", "ITM-011"] }),
  "docs/backlog/sprints/team2/03.md": sprint({ n: 3, start: "2026-10-27", goal: "News", selection: ["ITM-005"] }),
  "docs/backlog/ITM-006-item-6.md": item("ITM-006", { realises: "RULE NOT YET", module: "MOD-six" }),
  "docs/backlog/ITM-007-item-7.md": item("ITM-007", { module: "MOD-seven" }),
  "docs/backlog/ITM-008-item-8.md": item("ITM-008", { module: "MOD-eight" }),
  "docs/backlog/ITM-009-item-9.md": item("ITM-009", { module: "MOD-nine" }),
  "docs/backlog/ITM-010-item-10.md": item("ITM-010", { module: "MOD-ten" }),
  "docs/backlog/ITM-011-item-11.md": item("ITM-011", { module: "MOD-news" }),
  "docs/jobs/JOB-20261028-1000-f007.md": job("JOB-20261028-1000-f007", "ITM-007", { tail: ["", "## End", "", "at: 2026-10-28 11:00 UTC", "state: failed"] }),
  "docs/jobs/JOB-20261028-1000-g010.md": job("JOB-20261028-1000-g010", "ITM-010", { tail: ["", "## Taken", "", "at: 2026-10-28 10:01 UTC", "by: ci hosted", "", "## Gate reached", "", "at: 2026-10-28 10:30 UTC", "gate: Building → Checking", "decider: Owner"] }),
});
const BLOCKED_PULLS = [...PULL_REQUESTS, pr(8, "ITM-008", "open", "2026-10-22T09:00:00Z")];

// TST-806007 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: team1's running sprint holds, beside ITM-001 (merged) and ITM-002 (in progress): ITM-006, realising RULE NOT YET, which the SPEC does not hold; ITM-007, whose job failed; ITM-008, in progress; ITM-009, ready while ITM-002 and ITM-008 fill team1's limit of 2; ITM-010, whose job waits at the gate Building → Checking, decided by the Owner; ITM-011, changing MOD-news, which ITM-005 of team2's running sprint team2/03 changes
// input: the reader opens Progress (step 4)
// expect: the panel Blocked lists ITM-006 (a requirement not yet accepted, RULE NOT YET), ITM-007 (a failed job), ITM-009 (the WIP limit of its team), ITM-010 (a job waiting at a gate, naming the Owner who decides it), ITM-011 (another team's sprint, naming team2 and MOD-news) and ITM-005 of team2's sprint (another team's sprint, naming team1 and MOD-news, which ITM-011 holds), and nothing else
test("TST-806007 UC-035 step 4: Blocked lists every item a running sprint holds that cannot move, each with its reason", async () => {
  const page = await render("progress", {}, { files: blockedFiles(), pullRequests: BLOCKED_PULLS });
  try {
    const entries = Object.fromEntries(found(page.target, "[data-blocked]").map((each) => [attr(each, "data-blocked"), plain(each.innerHTML)]));
    assert.deepEqual(Object.keys(entries).sort(), ["ITM-005", "ITM-006", "ITM-007", "ITM-009", "ITM-010", "ITM-011"], JSON.stringify(entries));
    assert.match(entries["ITM-006"], /requirement not accepted.*RULE NOT YET/);
    assert.match(entries["ITM-007"], /failed job/);
    assert.match(entries["ITM-009"], /work-in-progress limit.*team1/);
    assert.match(entries["ITM-010"], /waiting at a gate.*Owner/);
    assert.match(entries["ITM-011"], /held by another team's sprint.*MOD-news.*team2/);
    assert.match(entries["ITM-005"], /held by another team's sprint.*MOD-news.*team1/);
  } finally { page.done(); }
});

// TST-806008 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the Scrum product of two teams: team1's role assignment names alice (Owner) and dev-a (Builders, Checker), team2's bob and dev-b; dev-a's job JOB-20261027-0900-a1b2 works on ITM-002 and has not ended
// input: the reader opens Progress (step 5)
// expect: Who works on what lists alice, dev-a, bob and dev-b, each with its roles and its team; dev-a's current job JOB-20261027-0900-a1b2 is linked to its page on the job dashboard (#job/id=JOB-20261027-0900-a1b2 on the main page); and team1's sprint lists its items with the modules they change (ITM-001 MOD-store, ITM-002 MOD-pages) and a column of the modules they use
test("TST-806008 UC-035 step 5: who works on what — each participant with its role, team and current jobs linked to the job dashboard, and each team's sprint with the modules its items change and use", async () => {
  const page = await render("progress");
  try {
    const who = plain(panelOf(page, "who").innerHTML);
    for (const [name, roles, team] of [["alice", "Owner", "team1"], ["dev-a", "Builders, Checker", "team1"], ["bob", "Owner", "team2"], ["dev-b", "Builders, Checker", "team2"]]) {
      assert.match(who, new RegExp(`${name} ${roles} ${team}`), name);
    }
    assert.ok(linksIn(panelOf(page, "who")).some((href) => /index\.html#job\/id=JOB-20261027-0900-a1b2\b/.test(href)), `the job linked to the job dashboard (${linksIn(panelOf(page, "who"))})`);
    assert.match(plain(row(page.html(), "ITM-001")), /MOD-store/);
    assert.match(plain(row(page.html(), "ITM-002")), /MOD-pages/);
    assert.match(plain(teamPanel(page, "team1").innerHTML), /Changes Uses/, "the modules the items change and use");
  } finally { page.done(); }
});

// TST-806009 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the V-model product of TST-806003 (RULE ONE realised by ITM-010 and ITM-011) and the Kanban product of TST-806004 (ITM-002, whose pull request is open, realises RULE ONE)
// input: the reader looks at where a cell leads and clicks a card (step 6: "Agent M shows the items or requirements behind it and their traceability: requirement → use case → item or plan entry → pull request → tests")
// expect: the cell of RULE ONE in Implementation leads to #trace/key=specification/ref=main/text=RULE%20ONE, the trace of RULE ONE; the click on the card of ITM-002 goes to the trace of the requirement its item realises (trace, key specification, ref main, text RULE ONE); the trace the card leads to names the item ITM-002 and its pull request (open: the item and the pull request of the chain are shown on no trace page)
test("TST-806009 UC-035 step 6: a cell or a card leads to the trace of the requirement behind it", async (t) => {
  const v = await render("progress", {}, { files: vModelFiles(), pullRequests: V_PULLS });
  const k = await render("progress", {}, { files: productFiles({ "docs/process-models/fixture.md": KANBAN }) });
  try {
    const cell = found(v.target, "[data-cell]").find((each) => attr(each, "data-requirement") === "RULE ONE" && attr(each, "data-phase") === "Implementation");
    const card = found(k.target, "[data-card]").find((each) => attr(each, "data-card") === "ITM-002");
    assert.ok(cell && card, "known positive: the cell and the card are drawn");
    assert.equal(attr(cell, "href"), "#trace/key=specification/ref=main/text=RULE%20ONE", "the cell leads to the trace of its requirement");
    await k.press(card);
    assert.deepEqual(k.went, [["trace", { key: "specification", ref: "main", text: "RULE ONE" }]], "the card leads to the trace of the requirement its item realises");
    await t.test("the item and the pull request of the chain stand on the trace page", { todo: "FINDING UC035-S3 — the item and the pull request in step 6's chain (requirement → use case → item or plan entry → pull request → tests) are shown on no trace page; the page a card leads to is the trace of the requirement, which names neither ITM-002 nor its pull request" }, () => {
      const went = JSON.stringify(k.went[0]);
      assert.ok(went.includes("ITM-002") && /pull\/2|#2\b/.test(went), `the trace names the item and its pull request (${went})`);
    });
  } finally { v.done(); k.done(); }
});

// The folded explanations of a page's panels, by the panel's data-part or data-team: each panel's `details` whose summary is "What is this?", with whether it is open and its text.
const explanations = (page) => found(page.target, "[class]").filter((each) => each.localName === "section" && /\bpanel\b/.test(attr(each, "class")))
  .map((panel) => ({ panel: attr(panel, "data-part") ?? `team ${attr(panel, "data-team")}`, details: found(panel, "[class]").find((each) => each.localName === "details") }))
  .map(({ panel, details }) => ({ panel, folded: Boolean(details) && attr(details, "open") === null && /What is this\?/.test(details.textContent), text: plain(details?.innerHTML ?? "") }));

// TST-806010 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the Scrum product of two teams and the Kanban product
// input: the reader opens Progress of each and unfolds each panel's explanation
// expect: every chart and panel carries a folded "What is this?"; the explanation of the sprint's burn-down says what a burn-down that stays flat means; the explanation of the Kanban measure says what a widening band in the cumulative flow means
test("TST-806010 UC-035: each chart and panel carries a folded What is this? that says how to read it", async () => {
  const scrum = await render("progress");
  const kanban = await render("progress", {}, { files: productFiles({ "docs/process-models/fixture.md": KANBAN }) });
  try {
    const s = explanations(scrum), k = explanations(kanban);
    assert.ok(s.length >= 5 && k.length >= 4, `known positive: the panels are found (${s.length}, ${k.length})`);
    for (const each of [...s, ...k]) assert.ok(each.folded, `${each.panel} carries a folded What is this?`);
    assert.match(s.find((each) => each.panel === "team team1").text, /burn-down that stays flat means/);
    assert.match(k.find((each) => each.panel === "measure").text, /band that widens in the cumulative flow means/);
  } finally { scrum.done(); kanban.done(); }
});

// TST-806011 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the Scrum product of two teams and the Kanban product
// input: the reader unfolds the explanation of each chart and panel of Progress
// expect: each explanation points to book ch. 7 or ch. 15
test("TST-806011 UC-035: each chart's and panel's explanation points to book ch. 7 or ch. 15", async () => {
  const scrum = await render("progress");
  const kanban = await render("progress", {}, { files: productFiles({ "docs/process-models/fixture.md": KANBAN }) });
  try {
    const all = [...explanations(scrum), ...explanations(kanban)];
    assert.ok(all.some((each) => /ch\. 7/.test(each.text)), "known positive: the sprint's explanation points to ch. 7");
    assert.deepEqual(all.filter((each) => !/ch\. (7|15)\b/.test(each.text)).map((each) => each.panel), [], "the explanations that point to neither chapter");
  } finally { scrum.done(); kanban.done(); }
});

// ---------------------------------------------------------------- the alternative flows

// TST-806012 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the Scrum product of two teams, whose job JOB-20261027-0900-a1b2 of dev-a, on ITM-002, runs in CI, and a second job JOB-20261029-0800-b0b0 of dev-a, on ITM-002, that has not ended and runs on the Bridge of another machine (route "bridge laptop agent claude"), which this page cannot reach
// input: the reader opens Progress (1b)
// expect: progress is still drawn from the repository (team1's sprint with ITM-002 in progress); Who works on what says that the source bridge laptop agent claude is not reached and that jobs running there are not shown
test("TST-806012 UC-035 1b: a job source that cannot be reached is named in Who works on what, and progress is computed from the repository", { todo: "FINDING UC035-S5 — the page asks no job source; the job on the unreached Bridge is listed as dev-a's current job from its record and no source is named as not reached" }, async () => {
  const files = productFiles({ "docs/jobs/JOB-20261029-0800-b0b0.md": job("JOB-20261029-0800-b0b0", "ITM-002", { route: "bridge laptop agent claude" }) });
  const page = await render("progress", {}, { files });
  try {
    assert.match(plain(row(page.html(), "ITM-002")), /in progress/, "known positive: progress is drawn from the repository");
    assert.match(plain(panelOf(page, "who").innerHTML), /bridge laptop agent claude.*not shown/, "the source not reached is named");
  } finally { page.done(); }
});

// TST-806013 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: a V-model product whose SPEC holds no requirement
// input: the reader opens Progress (2a)
// expect: the grid holds no cell, the seven phases are shown, and the page says that the plan fills itself as requirements are accepted
test("TST-806013 UC-035 2a: a planned product without accepted requirements shows the phases empty and says the plan fills itself", async () => {
  const page = await render("progress", {}, { files: vModelFiles({ "SPEC.md": lines("# SPEC", "", "## 1. Rules", "") }), pullRequests: V_PULLS });
  try {
    assert.equal(found(page.target, "[data-cell]").length, 0, "no cell");
    assert.deepEqual(found(page.target, "[data-phase-entry]").map((each) => attr(each, "data-phase-entry")), V_PHASES, "the phases");
    assert.match(plain(panelOf(page, "measure").innerHTML), /the plan fills itself as requirements are accepted/);
  } finally { page.done(); }
});

// TST-806014 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the Scrum product of two teams whose sprints are all closed: team1's sprint team1/03 holds its ## Review
// input: the reader opens Progress (2b)
// expect: each team says it has no running sprint, with a link to plan its next one (#backlog/plan=<team>) and a link to the backlog (#backlog); no burn-down is drawn
test("TST-806014 UC-035 2b: a Scrum product without a running sprint says so, with a link to plan the next one and to the backlog", async () => {
  const closed = productFiles();
  closed[TEAM1_RUNNING] += lines("", "## Review", "", "Done.", "", "## Unfinished items", "", "to the backlog:", "into the next sprint:", "", "## Retrospective", "", "- none.");
  const page = await render("progress", {}, { files: closed });
  try {
    for (const team of ["team1", "team2"]) {
      const panel = teamPanel(page, team);
      assert.match(plain(panel?.innerHTML ?? ""), /no running sprint/, team);
      assert.ok(linksIn(panel).includes(`#backlog/plan=${team}`), `${team}: a link to plan the next sprint`);
      assert.ok(linksIn(panel).includes("#backlog"), `${team}: a link to the backlog`);
    }
    assert.equal(found(page.target, "[data-burn-down]").length, 0, "no burn-down");
  } finally { page.done(); }
});

// The view of the route progress the workflow stores for COMMIT (MOD-progress-measures' progressView, as storedViewBytes of tests/implementation-pages-sprints.mjs makes it), of a
// product whose declared model was declared on `since`, as the scope `all` gives modelSince.
async function storedProgress(files, since) {
  const host = hostOf({ ...files });
  const snapshot = await host.readSnapshot("main");
  const facts = await productFacts(host, snapshot, () => host.readSnapshot("main"), new Date(), { scope: "work" });
  return new Uint8Array(gzipSync(JSON.stringify({ ...progressView({ ...facts, modelSince: since }, new Date()), commit: COMMIT })));
}

// TST-806015 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the Kanban product over GitHub, whose items are dated from 2026-10-07 on, and which changed its model to Kanban on 2026-10-21 (its stored view of the head says so: the declaration names that model since then)
// input: the reader opens Progress (2c)
// expect: the cumulative flow starts at the change: its first day is 10-21, though items are dated from 2026-10-07 on
test("TST-806015 UC-035 2c: after a change of model the chart starts at the change", async () => {
  const files = productFiles({ "docs/process.md": DECLARATION_AT_HEAD, "docs/process-models/fixture.md": KANBAN });
  const page = await renderOverGitHub("progress", {}, { files, overview: { [`${COMMIT}.progress.json.gz`]: await storedProgress(files, "2026-10-21T08:00:00Z") } });
  try {
    const source = plain(found(page.target, "[data-flow-chart]")[0]?.innerHTML ?? "");
    assert.match(source, /x-axis \["10-21"/, `the chart starts at the change (${source.slice(0, 120)})`);
  } finally { page.done(); }
  const unchanged = await renderOverGitHub("progress", {}, { files, overview: { [`${COMMIT}.progress.json.gz`]: await storedProgress(files, null) } });
  try {
    assert.match(plain(found(unchanged.target, "[data-flow-chart]")[0]?.innerHTML ?? ""), /x-axis \["10-07"/, "known positive: without a change the chart starts at the first dated day");
  } finally { unchanged.done(); }
});

// TST-806019 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the product of TST-806015, whose stored view of the head says its model, the Kanban fixture, is declared since 2026-10-21: the progress before that day was made under another model
// input: the reader opens Progress (2c: "Earlier progress stays readable in the model it was made under")
// expect: the page says that the model changed on 2026-10-21 and leads to the progress made before that day, in the earlier model
test("TST-806019 UC-035 2c: after a change of model, earlier progress stays readable in the model it was made under", { todo: "FINDING UC035-S6 — the page draws only the current model's measure from the change on: it does not say that the model changed or when (the view's `since` is drawn nowhere) and leads to no progress made before the change" }, async () => {
  const files = productFiles({ "docs/process.md": DECLARATION_AT_HEAD, "docs/process-models/fixture.md": KANBAN });
  const page = await renderOverGitHub("progress", {}, { files, overview: { [`${COMMIT}.progress.json.gz`]: await storedProgress(files, "2026-10-21T08:00:00Z") } });
  try {
    assert.equal(found(page.target, "[data-flow-chart]").length, 1, "known positive: the current model's chart is drawn");
    const html = plain(page.html());
    assert.match(html, /2026-10-21/, "the change of model is named");
    assert.ok(found(page.target, "[href]").some((each) => /ref=|until=|before/.test(each.getAttribute("href")) && !each.getAttribute("href").startsWith("#trace/")), "a way to the progress before the change");
  } finally { page.done(); }
});

// TST-806016 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the Scrum product of two teams: team1 runs its sprint team1/03, team2 none
// input: the reader opens Progress (2d)
// expect: team1's running sprint is drawn with its burn-down; team2 says it has no running sprint, with a link to plan its next one (#backlog/plan=team2) and a link to the backlog
test("TST-806016 UC-035 2d: each running sprint is drawn, and a team without one says so with its links", async () => {
  const page = await render("progress");
  try {
    assert.ok(found(teamPanel(page, "team1"), "[data-burn-down]").length === 1, "team1's sprint with its burn-down");
    const team2 = teamPanel(page, "team2");
    assert.match(plain(team2.innerHTML), /no running sprint/);
    assert.ok(linksIn(team2).includes("#backlog/plan=team2") && linksIn(team2).includes("#backlog"), `team2's links (${linksIn(team2)})`);
  } finally { page.done(); }
});

// The Scrum product whose record of Building → Checking passed it on ITM-002's file as it read before the change "delivers" → "delivers now".
const changedGate = () => {
  const files = productFiles();
  const before = files["docs/backlog/ITM-002-item-2.md"];
  files["docs/backlog/ITM-002-item-2.md"] = before.replace("What item 2 delivers.", "What item 2 delivers now.");
  files[GATE_PATH] = gateRecord("Building → Checking", [`docs/backlog/ITM-002-item-2.md@${blobOf(before)}`]);
  return { files, checked: blobOf(before).slice(0, 12), now: blobOf(files["docs/backlog/ITM-002-item-2.md"]).slice(0, 12) };
};

// TST-806017 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the Scrum product whose record of the gate Building → Checking passed it on ITM-002's file as it read before; the file has changed since
// input: the reader opens Progress (3a)
// expect: Building → Checking is shown as passed on an earlier text; it does not count as passed: the next gate, Checking → Closing, is not reached
test("TST-806017 UC-035 3a: a gate whose record names a changed text is passed on an earlier text and does not count as passed", async () => {
  const page = await render("progress", {}, { files: changedGate().files });
  try {
    const rows = gateRows(page).map((each) => plain(each.innerHTML));
    assert.match(rows[0], /^Building → Checking passed on an earlier text/, rows[0]);
    assert.match(rows[1], /^Checking → Closing not reached/, rows[1]);
  } finally { page.done(); }
});

// TST-806020 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the product of TST-806017: the record checked ITM-002's file at one blob, and the file now has another
// input: the reader opens Progress (3a: "shown as passed on an earlier text, with the difference")
// expect: the row of Building → Checking names the difference: ITM-002's file, the blob checked and the blob now (each by its first 12 characters)
test("TST-806020 UC-035 3a: a gate passed on an earlier text is shown with the difference", async () => {
  const { files, checked, now } = changedGate();
  const page = await render("progress", {}, { files });
  try {
    const row = plain(gateRows(page)[0].innerHTML);
    assert.match(row, /^Building → Checking passed on an earlier text/, "known positive: the state");
    assert.ok(row.includes(`docs/backlog/ITM-002-item-2.md: checked ${checked}, now ${now}`), row);
  } finally { page.done(); }
});

// TST-806018 · level: system · module: MOD-implementation-pages
// guards: UC-035
// given: the dashboard over a fake of GitHub whose repository — the instance, a Scrum product of one team — is private: it answers 404 to every request without a token
// input: the reader opens #progress with a stored token, and again in a browser that stores no token (1a)
// expect: with the token the page shows the progress (the panel of the gates); without it the page says that a private repository cannot be read without a token and shows nothing of the progress: no panel, no team, no gate
test("TST-806018 UC-035 1a: without a token that reaches a private product, the dashboard says so and shows nothing", async () => {
  const { REPO, openDashboard, repoServer } = await import("./app-harness.mjs");
  const head = "c0ffee".padEnd(40, "0");
  const files = productFiles({ "docs/process.md": DECLARATION_AT_HEAD.replace(COMMIT, head) });
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const privately = (url, init = {}) => (!init.headers?.Authorization && ((url.origin === "https://api.github.com" && url.pathname.startsWith(`/repos/${REPO}`))
    || (url.origin === "https://raw.githubusercontent.com" && url.pathname.startsWith(`/${REPO}/`))) ? json({ message: "Not Found" }, 404) : undefined);
  const pulls = (url) => (url.origin === "https://api.github.com" && (url.pathname === `/repos/${REPO}/pulls` || url.pathname === "/search/issues") ? json(url.pathname === "/search/issues" ? { total_count: 0, items: [] } : []) : undefined);
  const kept = Object.fromEntries(["document", "window", "location", "localStorage", "caches", "fetch", "addEventListener"].map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  try {
    const withToken = await openDashboard({ server: await repoServer({ files, handlers: [privately, pulls] }), hash: "#progress" });
    assert.match(withToken.main(), /data-part="gates"/, "known positive: with the token the progress is shown");
    const without = await openDashboard({ server: await repoServer({ files, handlers: [privately, pulls] }), hash: "#progress", token: null });
    assert.match(plain(without.main()), /private repository cannot be read without a token/i);
    assert.doesNotMatch(without.main(), /data-part=|data-team=/, "nothing of the progress is shown");
  } finally {
    for (const [name, descriptor] of Object.entries(kept)) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name]; }
  }
});
