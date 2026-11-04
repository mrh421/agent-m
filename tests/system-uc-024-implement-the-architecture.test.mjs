// System coverage for UC-024 Implement the architecture, walked through the dashboard and the product's CI: the flow map (TST-740201) names, for every step of the main flow and every alternative flow, the executable tests
// that walk it, and the cases walk what no test walked as a whole — the route Implement opened (1, 1a, 1b), the steps of the plan in their order with their states (2, 3, 2a, 2b), what each step's job is given (4), the
// participants offered (5, 5a, 5b), the panel and Start jobs (6, 7, 3a, 7a, 7b), the job check of the pull request in CI (8, 8a, 9, 9b, 11, 11a), a gate decided (10, 10a), the pull requests with Merge (11, 12, 12a),
// the step done (13), and the merge request of a product on GitLab (1c). The page is the real route `implement` of MOD-implementation-pages over the real MOD-repository-hosts host of GitHub, MOD-runtimes, MOD-product-process,
// MOD-work-plans, MOD-run-planner, MOD-job-runner and MOD-source-register, behind the fakes of tests/uc-024-harness.mjs; the job check is MOD-workflow-entries' onDoneCheck in a temporary git checkout. No request leaves the process.
// Run: node --test tests/system-uc-024-implement-the-architecture.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-runtimes
// Module: MOD-repository-hosts
// Module: MOD-product-process
// Guards: UC-024
// Level: system
//
// Authored by developer-opus-e (ITM-740), who built, among the code UC-024's flow runs, ITM-1170 (greenToMerge and the note of 12a), ITM-1171 (an item's pull request into its sprint's branch), ITM-1264 (the route
// implement of a model that works from a backlog, judged from the backlog's view, its workflow from workflowOf), ITM-1260 (the stored views of progress and the backlog), ITM-1058 and ITM-1059 (the plan drafted and
// written by hand) and ITM-1372 (a person holding a role that an agent fills); RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER binds level release, so these system cases may walk that behaviour, and the release file
// leaves it to the release tests other writers wrote. Where the dashboard and UC-024 disagree the case follows UC-024 and is marked `todo` with the word FINDING (named in FLOW_FINDINGS). Each case states its input and
// its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map, which holds the expected passages itself and checks that UC-024 still says them.
// A person's click is the page's own listener called with a trusted event; a script's click is `page.script`. Readings the texts leave open, which the cases state:
//   - "the author configures it here, as UC-002 describes" (1) is read as: Implement, for a product without a declaration, says that nothing starts and links How this product is developed (#process), where UC-002 is.
//   - "Agent M shows the route the model prescribes, with the table above" (1) is read as the folded What is this? of the route, holding the table's three rows and chapters 6 and 7.
//   - "the participant writes the tests ... the job's first commit holds these tests only ... CI ... must be red" (8), "writes the code ... CI runs" (9) are the coding participant's work; the dashboard's and CI's part
//     is the job check of step 11, which the cases run on the pull request the participant left.
//   - 9b "the pull request stays open as a draft" is read as the participant's own draft: the job check names CI as not green, and the page shows the draft without Merge.
//   - "the gate's decider decides as in UC-034, step 7; Agent M commits the gate record" (10) is read as MOD-product-process' recordGateDecision on the product's host, which every page that decides a gate calls.
//   - 1c "Pull request means merge request, CI means GitLab CI; the flow is the same" is read on the host the page uses: the merge requests that name a job are listed, their commits with their pipelines' results
//     and the head's jobs are the facts step 11 reads, and the merge is made at the head that was read.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { declarationSchema, productWorkflow, recordGateDecision, roleAssignmentSchema } from "../src/product-process/index.mjs";
import { ADDRESS, backlogProduct, openScrum, CHECK_JOB, FIRST, GATES, PARTICIPANTS, SECOND, STORE_TEST, declaration, fieldOf, found, gitlabProject, instance, jobCheck, jobOf, jobPull, jobRecord, lines, modulePath, openImplement, planned, pr,
  quiet, servers, startRecords, stepRows, testFileOf, textOf, walk } from "./uc-024-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-024-implement-modules.md";
const SELF = "tests/system-uc-024-implement-the-architecture.test.mjs";
const START = "tests/implementation-pages-implement-plan-start.test.mjs";
const PLAN = "tests/implementation-pages-implement-plan.test.mjs";
const MERGE = "tests/implementation-pages-implement-merge.test.mjs";
const PLACES = "tests/implementation-pages-implement-plan-places.test.mjs";
const DONE = "tests/workflow-entries-done-check.test.mjs";
const PULL = "tests/runtimes-pull-request.test.mjs";
const UC045 = "tests/system-uc-045-plan-the-implementation.test.mjs";
const BOOK_PARTS = ["09_system-modeling.md", "11_agentic-design-and-control-patterns.md", "12_implementation-and-version-control.md", "13_software-testing.md"];
const partsOf = (node) => textOf(node).replace(/ — SRC-vibe-coding 2026-10-05, version hash [0-9a-f]+/g, "");
const merged = (n, step) => pr(n, step, "merged", "2026-10-20T09:00:00Z", "2026-10-21T10:00:00Z");
const BUILDS = "read the repository, write to the repository, run code and tests, use tools";
const register = (...rows) => PARTICIPANTS.trimEnd().split("\n").filter((row) => !/^\| dev-[ab] /.test(row)).concat(rows).join("\n") + "\n";
const tagged = (root, name) => walk(root, (node) => node.localName === name);
const assignment = (rows) => lines("# plan", "", "## Roles", "", "| Role | Participants |", "|---|---|", ...rows);

// ---------------------------------------------------------------- the flow map

// The passages of UC-024 the system tests walk, each with the executable tests that walk it; a passage the dashboard does otherwise is a finding, a `todo` case that fails now and names what it does instead.
const FLOW_EVIDENCE = {
  "main-1-open": { uc: "The author opens **Implement** for the product.", evidence: [[SELF, "TST-740202"], [PLAN, "TST-732004"]] },
  "main-1-route": { uc: "Agent M shows the route the model prescribes, with the table above and a folded **What is this?** pointing to book", evidence: [[SELF, "TST-740202"]] },
  "main-1-unplanned": { uc: "where the work is not planned yet, it is planned next", evidence: [[SELF, "TST-740202"], [UC045, "TST-1061011"]] },
  "main-2-steps": { uc: "Agent M shows the steps of the implementation plan in their order, each with its derived state", evidence: [[SELF, "TST-740204"], [PLAN, "TST-732001"]] },
  "main-2-preselect": { uc: "It preselects the ready steps of the current phase.", evidence: [[SELF, "TST-740204"], [PLAN, "TST-732005"]] },
  "main-3-narrow": { uc: "The author keeps the selection or narrows it, down to one step.", evidence: [[SELF, "TST-740204"]] },
  "main-4-module": { uc: "**a module:** its file; the decision of its subsystem and the one that states the system; the SPEC; the", evidence: [[SELF, "TST-740206"]] },
  "main-4-integration": { uc: "**a subsystem's integration:** its decision, the files of its modules, and their code and tests;", evidence: [[SELF, "TST-740206"]] },
  "main-4-system": { uc: "**the system:** the decision that states it, the subsystems' decisions and the use cases;", evidence: [[SELF, "TST-740206"]] },
  "main-4-chapters": { uc: "chapters 9, 11, 12 and 13 of the", evidence: [[SELF, "TST-740206"]] },
  "main-5-holders": { uc: "Agent M offers, for each step, the holders of the implementing role that declare *write to the repository* and *run", evidence: [[SELF, "TST-740208"], [START, "TST-733001"]] },
  "main-6-panel": { uc: "The panel names the target branch", evidence: [[SELF, "TST-740210"], [START, "TST-733002"]] },
  "main-6-start": { uc: "the author presses **Start jobs** — one click.", evidence: [[SELF, "TST-740210"], [START, "TST-733003"]] },
  "main-7-record": { uc: "Agent M commits each job's start record `docs/jobs/JOB-<id>.md`", evidence: [[SELF, "TST-740210"]] },
  "main-8-red": { uc: "The job's first commit holds these tests only; the participant pushes, CI runs", evidence: [[SELF, "TST-740213"], [DONE, "TST-1210101"]] },
  "main-9-green": { uc: "**Green, refactor.** The participant writes the code in the folders of the step's modules", evidence: [[SELF, "TST-740213"]] },
  "main-10-gate": { uc: "it stops in the state *waiting at a gate*, and the gate's decider decides as in", evidence: [[SELF, "TST-740218"]] },
  "main-11-check": { uc: "Agent M's job check — a step in the product's CI, so that it holds", evidence: [[SELF, "TST-740213"], [DONE, "TST-1210101"]] },
  "main-11-pull": { uc: "The participant opens a pull request naming the job, the step, its modules, the requirements its tests guard", evidence: [[PULL, "TST-567001"]] },
  "main-12-merge": { uc: "The pull request is merged — by the participant if the author allowed it", evidence: [[SELF, "TST-740219"], [MERGE, "TST-734001"]] },
  "main-13-done": { uc: "The dashboard shows the step as done", evidence: [[SELF, "TST-740221"]] },
  "1a-backlog": { uc: "**1a. The product works from a backlog (Scrum, Kanban).**", evidence: [[SELF, "TST-740203"]] },
  "1b-unconfigured": { uc: "**1b. The author leaves the process unconfigured, or the work unplanned.**", evidence: [[SELF, "TST-740202"]] },
  "1c-gitlab": { uc: "**1c. The product is on a GitLab server.**", evidence: [[SELF, "TST-740222"]] },
  "2a-waiting": { uc: "**2a. A step waits for a step that is not done.**", evidence: [[SELF, "TST-740204"]] },
  "2b-gate": { uc: "**2b. The current phase's gate is not recorded.**", evidence: [[SELF, "TST-740205"]] },
  "3a-refactoring": { uc: "**3a. The author starts a refactoring job**", evidence: [[SELF, "TST-740210"], [SELF, "TST-740216"]] },
  "5a-no-participant": { uc: "**5a. No participant can write and run tests.**", evidence: [[SELF, "TST-740208"]] },
  "5b-restricted": { uc: "**5b. A source whose content the job would include forbids the participant's processing place.**", evidence: [[SELF, "TST-740209"], [PLACES, "TST-1160101"]] },
  "7a-no-answer": { uc: "**7a. The bridge or the runner does not answer.**", evidence: [[SELF, "TST-740211"]] },
  "7b-no-workflows": { uc: "**7b. The dashboard's token may not start workflows.**", evidence: [[SELF, "TST-740212"]] },
  "8a-green-first": { uc: "**8a. CI is green on the tests-only commit.**", evidence: [[SELF, "TST-740214"]] },
  "9b-red": { uc: "**9b. CI stays red.**", evidence: [[SELF, "TST-740215"]] },
  "10a-rejected": { uc: "**10a. The gate's decider rejects.** The gate record states the rejection and its reason", evidence: [[SELF, "TST-740218"]] },
  "11a-outside": { uc: "**11a. Agent M's check finds a code file outside the folders of the job's modules.**", evidence: [[SELF, "TST-740217"], [DONE, "TST-1210102"]] },
  "12a-protection": { uc: "**12a. The repository has no branch protection.**", evidence: [[SELF, "TST-740220"], [MERGE, "TST-1170006"]] },
};
// The passages the dashboard does otherwise: the finding, its case, and the module it points to.
const FLOW_FINDINGS = {
  "main-4-standards": { uc: "for every step: the product's coding standards file, if it has one", finding: "UC024-F1", file: SELF, test: "TST-740207", module: "MOD-run-planner" },
};
// The alternative flows no dashboard or CI code carries, which ITM-740's Outcome does not name: what the participant itself does.
const NOT_WALKED = {
  "9a-outside-module": { uc: "**9a. The participant needs to change code of a module outside the job.**", why: "the participant stops and reports; the dashboard's part is the job check of 11a, walked by TST-740217" },
};

// TST-740201 · level: system · module: system
// guards: UC-024
// given: UC-024 as committed text, the executable tests named in FLOW_EVIDENCE, the findings named in FLOW_FINDINGS and the flows named in NOT_WALKED
// input: compare every passage of the main flow, steps 1 to 13, and of the alternative flows with its executable evidence, its finding or the reason it is not walked
// expect: every named passage stands in UC-024; every evidence file exists and declares its TST id; every finding's case stands in its file with the todo naming FINDING and its module; every alternative flow UC-024 names is among the passages; known positive: UC-024 names exactly the sixteen alternative flows 1a, 1b, 1c, 2a, 2b, 3a, 5a, 5b, 7a, 7b, 8a, 9a, 9b, 10a, 11a and 12a, and each of the thirteen main steps has a passage
test("TST-740201: UC-024 every passage of the main flow and of each alternative flow has an executable test, a finding or a stated reason", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  for (const [name, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-024 says "${needle}"`);
    assert.ok(evidence.length > 0, `${name}: a test is named`);
    for (const [file, id] of evidence) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      assert.ok(testDeclarations(file, read(file)).some((each) => each.id === id), `${name}: ${id} is declared in ${file}`);
    }
  }
  for (const [name, { uc: needle, finding, file, test: id, module }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle), `${name}: UC-024 says "${needle}"`);
    assert.ok(read(file).includes(`// ${id} `), `${name}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} (${module})`), `${name}: the todo of ${id} names FINDING ${finding} and ${module}`);
  }
  for (const [name, { uc: needle }] of Object.entries(NOT_WALKED)) assert.ok(uc.includes(needle), `${name}: UC-024 says "${needle}"`);
  const flows = [...uc.matchAll(/- \*\*(\d+[a-z])\. /g)].map((match) => match[1]).sort();
  assert.deepEqual(flows, ["10a", "11a", "12a", "1a", "1b", "1c", "2a", "2b", "3a", "5a", "5b", "7a", "7b", "8a", "9a", "9b"], "known positive: UC-024 names these sixteen alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS, ...NOT_WALKED }).map((key) => key.split("-")[0]));
  assert.deepEqual(flows.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
  const steps = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).filter((key) => key.startsWith("main-")).map((key) => Number(key.split("-")[1])));
  assert.deepEqual([...steps].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], "each step of the main flow is among the passages");
});

// ---------------------------------------------------------------- step 1, 1b

// TST-740202 · level: system · module: system
// guards: UC-024; THE PROCESS MODEL IS DECLARED PER PRODUCT; EVERY STEP EXPLAINS ITSELF
// given: the planned product of tests/uc-045-harness.mjs (V-model, accepted architecture, the plan ITM-101 to ITM-106, the gates before Implementation passed) in three states: without docs/process.md; declared without a plan; declared with the plan
// input: the author opens Implement for each
// expect: 1b: without a declaration the page says no process model is declared and nothing starts, links How this product is developed (#process), lists no step and offers no Start jobs; declared without a plan it says the product has no implementation plan yet, links Plan (#plan) and #process, and offers no Start jobs; step 1: with the plan, a folded What is this? holds the route of each kind of model — plan-driven from the implementation plan, Scrum from the team's sprint selection, Kanban from the ready items — and names chapter 6 and chapter 7; nothing is written in any of them
test("TST-740202: UC-024 1, 1b Implement names what is missing before anything starts, and shows the route the model prescribes", async () => {
  const bare = await openImplement({}, { files: await planned({ declare: false, files: GATES }) });
  try {
    assert.match(bare.text(), /No process model is declared for this product, so there is nothing to start\./);
    assert.ok(tagged(bare.target, "a").some((link) => link.getAttribute("href") === "#process"), "links How this product is developed");
    assert.equal(found(bare.target, "[data-step]").length, 0, "no model is assumed: no step is listed");
    assert.equal(found(bare.target, "[data-start-jobs]").length, 0);
    assert.deepEqual(bare.srv.writes, []);
  } finally { bare.done(); }
  const unplanned = await openImplement({}, { files: await planned({ plan: false, files: GATES }) });
  try {
    assert.match(unplanned.text(), /This product has no implementation plan yet, so there is nothing to start\./);
    const links = tagged(found(unplanned.target, "[data-missing]")[0], "a").map((link) => link.getAttribute("href"));
    assert.deepEqual(links, ["#plan", "#process"]);
    assert.equal(found(unplanned.target, "[data-start-jobs]").length, 0);
    assert.deepEqual(unplanned.srv.writes, []);
  } finally { unplanned.done(); }
  const page = await openImplement({}, { files: await planned({ files: GATES }) });
  try {
    const route = textOf(found(page.target, "[data-route-explain]")[0]);
    assert.match(route, /^What is this\?/);
    for (const row of [/plan-driven — V-model, waterfall, reuse-oriented the implementation plan one step of the plan: a module, a subsystem's integration, or the system/, /Scrum the team's sprint selection from the backlog one backlog item/,
      /Kanban the ready items of the backlog one backlog item/, /chapter 6 for the plan-driven models, chapter 7 for the agile ones/]) assert.match(route, row);
    assert.deepEqual(page.srv.writes, []);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- 1a

// TST-740203 · level: system · module: system
// guards: UC-024; AGILE IMPLEMENTATION STARTS FROM THE BACKLOG
// given: the Scrum product of tests/uc-032-harness.mjs: team1's running sprint 02 selects ITM-001 (done), ITM-002 (in progress) and ITM-003 (ready); ITM-005 is ready and not selected; ITM-006 realises a requirement that is not accepted
// input: the author opens Implement
// expect: 1a: the page says the model works from a backlog and links the backlog (#backlog); its rows are backlog items, no plan step; ITM-003 offers dev-a, the team's builder; ITM-005 carries the reason that it is not selected for team1/02; ITM-006 is waiting for acceptance; nothing is written
test("TST-740203: UC-024 1a a product that works from a backlog implements the ready items of the current sprint", async () => {
  const page = await openScrum("implement", {}, { files: await backlogProduct() });
  try {
    const shown = textOf(page.target);
    assert.match(shown, /This model works from a backlog: open the backlog/);
    assert.ok(tagged(page.target, "a").some((link) => link.getAttribute("href") === "#backlog"));
    assert.equal(found(page.target, "[data-step]").length, 0, "no plan step");
    const rows = Object.fromEntries(found(page.target, "[data-item]").map((row) => [row.getAttribute("data-item"), row]));
    assert.equal(rows["ITM-003"].getAttribute("data-startable"), "true");
    assert.deepEqual(found(rows["ITM-003"], '[data-participant-of="ITM-003"]')[0].childNodes.map(textOf), ["dev-a"]);
    assert.match(textOf(rows["ITM-005"]), /ITM-005 is not selected for team1\/02, the current sprint of team1\./);
    assert.equal(rows["ITM-006"].getAttribute("data-state"), "waiting for acceptance");
    assert.deepEqual(page.srv.writes, []);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- steps 2, 3, 2a, 2b

// TST-740204 · level: system · module: system
// guards: UC-024; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the planned product, the gates before Implementation passed, the pull request 1 of ITM-101 merged; the plan's order ITM-101 … ITM-106 in the phases Implementation (101 to 103) and Testing (104 to 106)
// input: the author opens Implement; then unticks ITM-103 (a change of its box)
// expect: step 2: the steps stand in the plan's order with their phases and states — ITM-101 done, ITM-102 and ITM-103 ready, ITM-104 waiting for an item it builds on, ITM-105 waiting for an item it builds on, ITM-106 waiting for an item it builds on —, the ready steps of the current phase, Implementation, ticked; 2a: ITM-104 cannot be selected and its reason names ITM-102, the step it waits for; step 3: after ITM-103 is unticked, "1 step selected" and only ITM-102's job is shown; no step file holds a state, and nothing is written
test("TST-740204: UC-024 2, 3, 2a the steps stand in the plan's order with their derived states, the ready steps of the current phase preselected, and the selection narrows", async () => {
  const files = await planned({ files: GATES });
  const page = await openImplement({}, { files, pullRequests: [merged(1, "ITM-101")] });
  try {
    assert.deepEqual(stepRows(page).map(({ id, phase, state, selectable, ticked }) => [id, phase, state, selectable, ticked]), [
      ["ITM-101", "Implementation", "done", false, false], ["ITM-102", "Implementation", "ready", true, true], ["ITM-103", "Implementation", "ready", true, true],
      ["ITM-104", "Testing", "waiting for an item it builds on", false, false], ["ITM-105", "Testing", "waiting for an item it builds on", false, false], ["ITM-106", "Testing", "waiting for an item it builds on", false, false]]);
    assert.match(stepRows(page).find((row) => row.id === "ITM-104").reasons, /ITM-104 builds on ITM-102/);
    const box = found(found(page.target, '[data-step="ITM-103"]')[0], "[data-select-step]")[0];
    box.checked = false;
    box.dispatchEvent(new Event("change"));
    await quiet();
    assert.equal(textOf(found(page.target, "[data-selected]")[0]), "1 step selected");
    assert.deepEqual(found(page.target, "[data-job-of]").map((node) => node.getAttribute("data-job-of")), ["ITM-102"]);
    for (const [path, text] of Object.entries(files)) if (path.startsWith("docs/plan/")) assert.doesNotMatch(text, /^(state|status):/m, `${path} stores no state`);
    assert.deepEqual(page.srv.writes, []);
  } finally { page.done(); }
});

// TST-740205 · level: system · module: system
// guards: UC-024; A JOB STOPS AT EVERY GATE; A GATE NAMES WHO DECIDES IT
// given: the planned product with no gate record: the gate Design → Implementation, decided by the Reviewer, is not recorded
// input: the author opens Implement
// expect: 2b: the steps of the phase Implementation are shown and none can be selected; ITM-101 and ITM-103 are waiting, each naming the gate Design → Implementation and its decider, the Reviewer; "0 steps selected"; Start jobs starts nothing
test("TST-740205: UC-024 2b the steps after a gate that is not recorded are shown and cannot be selected, and the gate and its decider are named", async () => {
  const page = await openImplement({}, { files: await planned() });
  try {
    const rows = stepRows(page);
    assert.equal(rows.length, 6);
    assert.ok(rows.every((row) => !row.selectable), "no step can be selected");
    for (const id of ["ITM-101", "ITM-103"]) {
      const row = rows.find((each) => each.id === id);
      assert.equal(row.state, "waiting");
      assert.match(row.reasons, /Design → Implementation, decided by Reviewer/);
    }
    assert.equal(textOf(found(page.target, "[data-selected]")[0]), "0 steps selected");
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    assert.deepEqual(startRecords(page), []);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- step 4

const CODED = { "src/store/index.mjs": "export const read = () => 1;\n", "tests/store.test.mjs": testFileOf("MOD-store", "TST-001"), "src/pages/index.mjs": "export const page = 1;\n", "tests/pages.test.mjs": testFileOf("MOD-pages", "TST-002") };

// TST-740206 · level: system · module: system
// guards: UC-024; DEVELOP AGAINST INTERFACES; AN IMPLEMENTATION JOB RECEIVES THE CHAPTERS ON MODELING, DESIGN, IMPLEMENTATION AND TESTING; THE PAGE NAMES WHERE IT SENDS
// given: the planned product with code and tests: src/store/index.mjs and tests/store.test.mjs (TST-001 exercising MOD-store), src/pages/index.mjs and tests/pages.test.mjs (TST-002 exercising MOD-pages); MOD-pages uses MOD-store.read; the instance holds the book's register entry and chapters
// input: the author opens Implement three times: with ITM-101 merged (ITM-102, a module, ready); with ITM-101 to ITM-103 merged (ITM-104, the integration of ARC-002, ready); with ITM-101 to ITM-105 merged (ITM-106, the system, ready)
// expect: step 4 — what is sent to dev-a for ITM-102: its file docs/architecture/MOD-pages.md, ARC-002 (its subsystem) and ARC-001 (the system), SPEC.md, "docs/architecture/MOD-store.md ## Interfaces" and not MOD-store's whole file or its code src/store/index.mjs, its code src/pages/index.mjs, its test tests/pages.test.mjs, and the chapters 9, 11, 12 and 13; for ITM-104: ARC-002, MOD-store's and MOD-pages' files, code and tests; for ITM-106: ARC-001, ARC-002, ARC-003 and the use case UC-001, and no module's code; each names dev-a at this machine
test("TST-740206: UC-024 4 each step's job is given its files, the decisions, the SPEC, the interfaces of the modules it uses and the book's chapters", async () => {
  const files = await planned({ files: { ...GATES, ...CODED } });
  const sentFor = async (pulls, step) => {
    const page = await openImplement({}, { files, pullRequests: pulls });
    try { return partsOf(fieldOf(page, step, "sent")); } finally { page.done(); }
  };
  const module = await sentFor([merged(1, "ITM-101")], "ITM-102");
  assert.match(module, /^dev-a at this machine: /);
  const listed = module.replace(/^dev-a at this machine: /, "").split(", ");
  assert.deepEqual(listed, ["docs/architecture/MOD-pages.md", "docs/architecture/ARC-002-storage.md", "docs/architecture/ARC-001-the-whole.md", "SPEC.md", "docs/architecture/MOD-store.md ## Interfaces",
    "src/pages/index.mjs", "tests/pages.test.mjs", ...BOOK_PARTS]);
  const integration = (await sentFor([merged(1, "ITM-101"), merged(2, "ITM-102"), merged(3, "ITM-103")], "ITM-104")).replace(/^dev-a at this machine: /, "").split(", ");
  assert.deepEqual(integration, ["docs/architecture/ARC-002-storage.md", "docs/architecture/MOD-store.md", "src/store/index.mjs", "tests/store.test.mjs", "docs/architecture/MOD-pages.md", "src/pages/index.mjs",
    "tests/pages.test.mjs", ...BOOK_PARTS]);
  const system = (await sentFor([1, 2, 3, 4, 5].map((n) => merged(n, `ITM-10${n}`)), "ITM-106")).replace(/^dev-a at this machine: /, "").split(", ");
  assert.deepEqual(system, ["docs/architecture/ARC-001-the-whole.md", "docs/architecture/ARC-002-storage.md", "docs/architecture/ARC-003-mail.md", "docs/use-cases/UC-001-load.md", ...BOOK_PARTS]);
});

// TST-740207 · level: system · module: system
// guards: UC-024
// given: the planned product of TST-740206, whose root holds AGENTS.md, the coding standards its agents follow (the path the draft of MOD-run-planner that ITM-568 cut names)
// input: the author opens Implement with ITM-101 merged
// expect: step 4 "for every step: the product's coding standards file, if it has one": what is sent for ITM-102 names AGENTS.md; FINDING UC024-F1 (MOD-run-planner): the recipe implementation-inputs gives no coding standards file, since MOD-run-planner's accepted text names no path for one
test("TST-740207: UC-024 4 every step's job is given the product's coding standards file", { todo: "FINDING UC024-F1 (MOD-run-planner): implementation-inputs gives no coding standards file; the accepted text names no path for it (ITM-568 cut it until a draft that names one is accepted)" }, async () => {
  const files = await planned({ files: { ...GATES, ...CODED, "AGENTS.md": "# Coding standards of the thesis tool\n\nTests first; one module per folder.\n" } });
  const page = await openImplement({}, { files, pullRequests: [merged(1, "ITM-101")] });
  try {
    assert.ok(partsOf(fieldOf(page, "ITM-102", "sent")).split(", ").includes("AGENTS.md"), "the coding standards file is sent");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- step 5, 5a, 5b

// TST-740208 · level: system · module: system
// guards: UC-024; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; A PARTICIPANT DECLARES ITS CAPABILITIES; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA
// given: the planned product, ITM-101 and ITM-103 ready; the role assignment gives Developer and Tester to dev-a and local-llm (which can only draft text); dev-b can write and run tests and holds no role; then the same product whose Developer and Tester are local-llm alone
// input: the author opens Implement for each, and presses Start jobs in the second
// expect: step 5: for ITM-101 dev-a alone is offered, with "dev-a processes data at this machine"; local-llm and dev-b are not offered; a folded What is this? stands on the page; 5a: in the second, ITM-101 says that no participant can write and run tests, links #participants and says a model endpoint can draft a decision, not implement it; Start jobs writes no start record
test("TST-740208: UC-024 5, 5a the holders of the implementing role that can write and run tests are offered with their place, and a step no one can implement says so", async () => {
  const both = assignment(["| Product owner | alice |", "| Developer | dev-a, local-llm |", "| Tester | dev-a, local-llm |", "| Reviewer | bob |"]);
  const page = await openImplement({}, { files: await planned({ files: { ...GATES, "docs/role-assignments/plan.md": both } }) });
  try {
    assert.deepEqual(fieldOf(page, "ITM-101", "participant").childNodes.map(textOf), ["dev-a"]);
    assert.equal(textOf(fieldOf(page, "ITM-101", "places")), "dev-a processes data at this machine");
    assert.ok(tagged(page.target, "details").length > 0, "a folded What is this?");
  } finally { page.done(); }
  const none = assignment(["| Product owner | alice |", "| Developer | local-llm |", "| Tester | local-llm |", "| Reviewer | bob |"]);
  const nobody = await openImplement({}, { files: await planned({ files: { ...GATES, "docs/role-assignments/plan.md": none } }) });
  try {
    const said = found(found(nobody.target, '[data-step="ITM-101"]')[0], "[data-none-of]")[0];
    assert.match(textOf(said), /No participant can write and run tests\..*a model endpoint can draft a decision, not implement it\./);
    assert.ok(tagged(said, "a").some((link) => link.getAttribute("href") === "#participants"));
    await nobody.press(found(nobody.target, "[data-start-jobs]")[0]);
    assert.deepEqual(startRecords(nobody), []);
  } finally { nobody.done(); }
});

// TST-740209 · level: system · module: system
// guards: UC-024; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the instance registers SRC-letters, restricted, permitting only "this machine", whose content the product keeps in docs/sources/SRC-letters/; the module MOD-mail keeps its letters there (its folder docs/sources/SRC-letters/); dev-a works at this machine and dev-b at "a provider in the USA", both hold Developer and Tester
// input: the author opens Implement, ITM-101 and ITM-103 ready
// expect: 5b: ITM-103, whose job includes the content of SRC-letters, offers dev-a alone and names dev-b with SRC-letters and its place a provider in the USA; ITM-101, whose job includes none of it, offers dev-a and dev-b
test("TST-740209: UC-024 5b a participant whose place a source forbids is not offered for a job that includes the source's content, and the content is named", async () => {
  const letters = lines("---", "id: SRC-letters", "title: The letters", "kind: document", "authority: normative", "licence: restricted - the senders' terms", "places:", "  - this machine",
    `content_repository: ${ADDRESS}`, "---", "# SRC-letters The letters", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| `1` | 2026-10-13 | fixture | here | one file |");
  const mail = lines("---", "id: MOD-mail", "title: The module MOD-mail", "folder: docs/sources/SRC-letters/", "realises:", "  - RULE ONE", "follows:", "  - ARC-003", "uses: []", "provides:", "  - read",
    "---", "# MOD-mail The module MOD-mail", "", "## Responsibility", "", "r", "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `read` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
  const files = await planned({ files: { ...GATES, [modulePath("MOD-mail")]: mail, "docs/sources/SRC-letters/1/letter.md": "Dear reader.\n",
    "docs/role-assignments/plan.md": assignment(["| Product owner | alice |", "| Developer | dev-a, dev-b |", "| Tester | dev-a, dev-b |", "| Reviewer | bob |"]) } });
  const participants = register(`| dev-a | model endpoint | model-c | 200000 | — | ${BUILDS} | this machine | ci hosted secret DEV_KEY |`, `| dev-b | model endpoint | model-d | 200000 | — | ${BUILDS} | a provider in the USA | ci hosted secret DEV_KEY |`);
  const page = await openImplement({}, { files, instance: instance({ "docs/participants.md": participants, "docs/sources/SRC-letters.md": letters }) });
  try {
    assert.deepEqual(fieldOf(page, "ITM-103", "participant").childNodes.map(textOf), ["dev-a"]);
    const withheld = textOf(fieldOf(page, "ITM-103", "withheld"));
    for (const word of [/dev-b/, /SRC-letters/, /a provider in the USA/]) assert.match(withheld, word);
    assert.deepEqual(fieldOf(page, "ITM-101", "participant").childNodes.map(textOf), ["dev-a", "dev-b"]);
    assert.equal(fieldOf(page, "ITM-101", "withheld"), null);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- steps 6, 7, 3a, 7a, 7b

// TST-740210 · level: system · module: system
// guards: UC-024; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; ONE CLICK PER DECISION; A GATE NAMES WHO DECIDES IT; WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET
// given: the planned product whose declaration sets no branch for a phase, ITM-101 and ITM-103 ready and ticked; the panel's attempt limit of ITM-101 set to 3 and who merges to a person; refactoring ticked for ITM-103
// input: a script's click on Start jobs; then the author's
// expect: step 6: each job names the target branch main, the gate after its phase, Validation & Verification → Operation & Maintenance decided by Reviewer, and what is sent where; the script's click writes nothing; step 7: the author's click commits one start record per step under docs/jobs/, ITM-101's of kind implement with limit 3 and merges person, ITM-103's of kind refactor (3a), each naming dev-a and the route ci hosted, with the token the author stored; the page names each job's record and route
test("TST-740210: UC-024 6, 7, 3a the panel names the target branch and the gates, and one click of the author commits each job's start record", async () => {
  const files = await planned({ files: { ...GATES, "docs/process.md": declaration().replace("| Implementation | `work/<item>` |\n", "") } });
  const page = await openImplement({}, { files });
  try {
    for (const step of ["ITM-101", "ITM-103"]) {
      assert.equal(textOf(fieldOf(page, step, "branch")), "Target branch: main");
      assert.equal(textOf(fieldOf(page, step, "gates")), "Gates: Validation & Verification → Operation & Maintenance (decided by Reviewer).");
      assert.match(partsOf(fieldOf(page, step, "sent")), /^dev-a at this machine: /);
    }
    fieldOf(page, "ITM-101", "limit").value = "3";
    fieldOf(page, "ITM-101", "merges").value = "person";
    fieldOf(page, "ITM-103", "refactor").checked = true;
    await page.script(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    assert.deepEqual(page.srv.writes, [], "a script's click writes nothing");
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    const records = startRecords(page);
    assert.equal(records.length, 2);
    const of = (step) => records.find((record) => new RegExp(`works_on:\\n  - ${step}\\n`).test(record.text));
    assert.match(of("ITM-101").text, /^kind: implement$/m);
    assert.match(of("ITM-101").text, /^limit: 3$/m);
    assert.match(of("ITM-101").text, /"merges": "person"/);
    assert.match(of("ITM-103").text, /^kind: refactor$/m);
    for (const record of records) { assert.match(record.text, /^participant: dev-a$/m); assert.match(record.text, /^route: ci hosted$/m); assert.match(record.path, /^docs\/jobs\/JOB-\d{8}-\d{4}-[0-9a-f]{4}\.md$/); }
    assert.ok(page.log.filter((each) => each.repository === "alice/thesis-tool").every((each) => each.authorization === "Bearer github_pat_HARNESS0123456789abcdefghij"));
    assert.match(textOf(found(page.target, "[data-start-result]")[0]), /ITM-101: job JOB-[^ ]+ \(docs\/jobs\/JOB-[^)]+\.md\) is queued on the route ci hosted\./);
  } finally { page.done(); }
});

// TST-740211 · level: system · module: system
// guards: UC-024; THE LOCAL BRIDGE REQUIRES A TOKEN
// given: the planned product, ITM-101 and ITM-103 ready; dev-a is reached through the Bridge lab-pc, which this browser has no connection to
// input: the author presses Start jobs
// expect: 7a: the result names the Bridge lab-pc as not connected, for each step, and says nothing was started; no start record is committed
test("TST-740211: UC-024 7a a Bridge that does not answer is named and nothing is started", async () => {
  const participants = register(`| dev-a | CLI agent | model-c | 200000 | — | ${BUILDS} | this machine | bridge lab-pc agent claude |`, `| dev-b | model endpoint | model-d | 200000 | — | ${BUILDS} | this machine | ci hosted secret DEV_KEY |`);
  const store = { prefix: "", storage: { getItem: () => null } };
  const page = await openImplement({}, { files: await planned({ files: GATES }), instance: instance({ "docs/participants.md": participants }), store });
  try {
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    const result = textOf(found(page.target, "[data-start-result]")[0]);
    assert.match(result, /ITM-101: The Bridge lab-pc is not connected in this browser, so the job cannot be handed to it; nothing was started for it\./);
    assert.match(result, /ITM-103: The Bridge lab-pc is not connected/);
    assert.deepEqual(startRecords(page), []);
  } finally { page.done(); }
});

// TST-740212 · level: system · module: system
// guards: UC-024; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the planned product, ITM-101 and ITM-103 ready; GitHub refuses every write of the author's token with 403 "Resource not accessible by personal access token"
// input: the author presses Start jobs
// expect: 7b: the result says the token may not start workflows and links the workflow's Run workflow page (https://github.com/alice/thesis-tool/actions), naming the job's identifier, the kind implement and the participant dev-a; no start record is written
test("TST-740212: UC-024 7b a token that may not start workflows leads to the workflow's Run workflow page with the job's inputs named", async () => {
  const page = await openImplement({}, { files: await planned({ files: GATES }), denyWrites: true });
  try {
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    const link = found(page.target, "[data-run-workflow]")[0];
    assert.ok(link, "a link to the workflow's page");
    assert.equal(link.getAttribute("href"), "https://github.com/alice/thesis-tool/actions");
    assert.match(textOf(found(page.target, "[data-start-result]")[0]), /ITM-101: the token may not start workflows\. Open the workflow's Run workflow page and start it there with the inputs job JOB-\d{8}-\d{4}-[0-9a-f]{4}, kind implement, participant dev-a\./);
    assert.deepEqual(page.srv.writes, []);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- steps 8, 9, 11 and the job check (8a, 9b, 11a, 3a)

// TST-740213 · level: system · module: system
// guards: UC-024; AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
// given: the pull request #7 of the job of ITM-101 (MOD-store, folder src/store/) in the V-model product: its first commit adds only tests/store.test.mjs (TST-001, guarding RULE ONE, module MOD-store) and its CI was red; its head changes src/store/index.mjs and the run's shards are green; both gates before Implementation are recorded
// input: the job check of the product's CI, onDoneCheck, on the event pull_request
// expect: steps 8, 9, 11: the outcome done, no finding, and the check's summary says the Definition of Done of pull request #7 holds
test("TST-740213: UC-024 8, 9, 11 a pull request whose first commit holds failing tests only and whose code lies in its module's folder passes the job check", async () => {
  const status = await jobCheck();
  assert.equal(status.outcome, "done", JSON.stringify(status.findings));
  assert.deepEqual(status.findings, []);
  assert.match(status.shown, new RegExp(`The Definition of Done of pull request #7 \\(${CHECK_JOB}\\) holds\\.`));
});

// TST-740214 · level: system · module: system
// guards: UC-024; AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST
// given: the pull request of TST-740213 whose first, tests-only commit was green
// input: the job check onDoneCheck
// expect: 8a: the outcome failed with one finding under AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST saying CI was not red on the first commit 1111111, which the check's summary names
test("TST-740214: UC-024 8a a pull request whose tests-only commit was green fails the job check", async () => {
  const status = await jobCheck({ commits: [{ sha: FIRST, files: ["tests/store.test.mjs"], ci: "success" }, { sha: SECOND, files: ["src/store/index.mjs"], ci: "success" }] });
  assert.equal(status.outcome, "failed");
  assert.deepEqual(status.findings.map((each) => [each.rule, each.what]), [["AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST", "CI was not red on the first commit 1111111: its result is success"]]);
  assert.match(status.shown, /CI was not red on the first commit 1111111/);
});

// TST-740215 · level: system · module: system
// guards: UC-024; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI
// given: the pull request of TST-740213 whose head's shards ended red after the fix cycle; and, on the dashboard, that job's pull request left as a draft whose check agent-m done failed
// input: the job check onDoneCheck; the author opens Implement
// expect: 9b: the check fails and names the shard pull-request.unit.1 that is not green; the page shows the draft pull request with "The pull request is a draft." and that the Definition of Done does not hold, and offers no Merge
test("TST-740215: UC-024 9b a pull request whose CI stays red fails the job check, and its draft is shown without Merge", async () => {
  const status = await jobCheck({ headGreen: false });
  assert.equal(status.outcome, "failed");
  assert.ok(status.findings.some((each) => /pull-request\.unit\.1/.test(each.what)), JSON.stringify(status.findings));
  const job = jobRecord();
  const page = await openImplement({}, { files: await planned({ files: { ...GATES, [job.path]: job.text } }), pullRequests: [jobPull({ draft: true, done: "failure" })] });
  try {
    const shown = textOf(found(page.target, '[data-pull="7"]')[0]);
    assert.match(shown, /The pull request is a draft\./);
    assert.match(shown, /The Definition of Done does not hold: agent-m done is failure on the head\./);
    assert.equal(found(page.target, "[data-merge-pull]").length, 0);
  } finally { page.done(); }
});

// TST-740216 · level: system · module: system
// guards: UC-024; A REFACTORING JOB BEGINS WITHOUT A FAILING TEST; A REFACTORING JOB CHANGES NO EXPECTED RESULT
// given: the pull request #7 of a job of kind refactor on ITM-101: both commits green; its head modifies tests/store.test.mjs; in one world the head keeps the base's assertion and adds one, in another it changes assert.equal(1, 1) to assert.equal(1, 2); in a third the first commit was red
// input: the job check onDoneCheck on each
// expect: 3a: the first ends done with no finding; the second fails under A REFACTORING JOB CHANGES NO EXPECTED RESULT naming the assertion of tests/store.test.mjs; the third fails under A REFACTORING JOB BEGINS WITHOUT A FAILING TEST naming the commit 1111111
test("TST-740216: UC-024 3a the job check holds a refactoring to green commits and unchanged expected results", async () => {
  const green = [{ sha: FIRST, files: ["src/store/index.mjs"], ci: "success" }, { sha: SECOND, files: ["src/store/index.mjs", "tests/store.test.mjs"], ci: "success" }];
  const kept = STORE_TEST.replace("  assert.equal(1, 1);\n", "  assert.equal(1, 1);\n  assert.ok(true);\n");
  const changed = STORE_TEST.replace("assert.equal(1, 1)", "assert.equal(1, 2)");
  const at = (text) => ({ [`b${"b".repeat(39)}:tests/store.test.mjs`]: STORE_TEST, [`${SECOND}:tests/store.test.mjs`]: text });
  const ok = await jobCheck({ kind: "refactor", commits: green, contents: at(kept), modified: ["tests/store.test.mjs"] });
  assert.equal(ok.outcome, "done", JSON.stringify(ok.findings));
  const moved = await jobCheck({ kind: "refactor", commits: green, contents: at(changed), modified: ["tests/store.test.mjs"] });
  assert.equal(moved.outcome, "failed");
  assert.deepEqual(moved.findings.map((each) => [each.rule, each.artifact]), [["A REFACTORING JOB CHANGES NO EXPECTED RESULT", "tests/store.test.mjs"]]);
  const red = await jobCheck({ kind: "refactor", commits: [{ ...green[0], ci: "failure" }, green[1]], contents: at(kept), modified: ["tests/store.test.mjs"] });
  assert.deepEqual(red.findings.map((each) => [each.rule, each.what]), [["A REFACTORING JOB BEGINS WITHOUT A FAILING TEST", "CI was not green on commit 1111111: its result is failure"]]);
});

// TST-740217 · level: system · module: system
// guards: UC-024; AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES
// given: the pull request of TST-740213 whose head also adds src/mail/extra.mjs, in the folder of MOD-mail, a module the job of ITM-101 does not change
// input: the job check onDoneCheck
// expect: 11a: the check fails with one finding under AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES on src/mail/extra.mjs, naming the job's module MOD-store, and the check's summary names the file
test("TST-740217: UC-024 11a a code file outside the folders of the job's modules fails the job check, which names the file", async () => {
  const status = await jobCheck({ commits: [{ sha: FIRST, files: ["tests/store.test.mjs"], ci: "failure" }, { sha: SECOND, files: ["src/store/index.mjs", "src/mail/extra.mjs"], ci: "success" }] });
  assert.equal(status.outcome, "failed");
  assert.deepEqual(status.findings.map((each) => [each.rule, each.artifact, each.what]), [["AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES", "src/mail/extra.mjs", "src/mail/extra.mjs lies in the folder of none of the job's modules (MOD-store)"]]);
  assert.match(status.shown, /src\/mail\/extra\.mjs/);
});

// ---------------------------------------------------------------- step 10, 10a

// TST-740218 · level: system · module: system
// guards: UC-024; A JOB STOPS AT EVERY GATE; A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS; THE GATE IS RECORDED
// given: the planned product's V-model workflow; the role assignment gives the Reviewer to bob and dev-a; the job JOB-20261101-0900-a1b2 of dev-a waits at the gate Validation & Verification → Operation & Maintenance
// input: recordGateDecision on the product's host: dev-a passes it; carol passes it; bob rejects it without a reason; bob rejects it with the reason "The verification is not documented."; bob passes it on the next head
// expect: step 10, 10a: dev-a's decision is refused as did the work this gate checks, carol's as not a holder of the deciding role, the rejection without a reason as ReasonMissing, each writing nothing; the rejection with its reason is one commit "gates: … rejected by bob" holding a record of decision rejected, the job, the decider bob and the role Reviewer, and its reason under ## Reason; bob's pass is one more record of decision passed
test("TST-740218: UC-024 10, 10a a gate is decided only by a holder of its role who did not do the work, and the decision is recorded with its reason", async () => {
  const files = await planned({ files: GATES });
  const world = await servers({ files });
  try {
    const declared = readDocument(declarationSchema, "docs/process.md", files["docs/process.md"]);
    const workflow = await productWorkflow(declared, (commit) => world.instanceHost.readSnapshot(commit), "# Instance\n");
    const reviewers = readDocument(roleAssignmentSchema, "docs/role-assignments/plan.md", assignment(["| Product owner | alice |", "| Developer | dev-a |", "| Tester | dev-a |", "| Reviewer | bob, dev-a |"]));
    const gate = "Validation & Verification → Operation & Maintenance", job = "JOB-20261101-0900-a1b2";
    const decide = async (name, decision, reason = null) => recordGateDecision(world.host, { gate, job, decider: { name, kind: name.startsWith("dev") ? "agent" : "person" }, role: "Reviewer", decision, reason, on: [`${ADDRESS}/pull/7`] },
      { workflow, assignment: reviewers, workBy: ["dev-a"], head: world.srv.head, now: new Date("2026-11-01T11:00:00Z"), trailers: [] });
    await assert.rejects(decide("dev-a", "passed"), (failure) => failure.name === "MayNotDecide" && failure.reason === "did the work this gate checks");
    await assert.rejects(decide("carol", "passed"), (failure) => failure.name === "MayNotDecide" && failure.reason === "not a holder of the deciding role");
    await assert.rejects(decide("bob", "rejected", "  "), (failure) => failure.name === "ReasonMissing");
    assert.deepEqual(world.srv.writes, [], "nothing is written for a refused decision");
    const rejected = await decide("bob", "rejected", "The verification is not documented.");
    assert.equal(world.srv.writes.length, 1);
    assert.equal(world.srv.writes[0].message, `gates: ${gate} rejected by bob`);
    const record = world.srv.writes[0].files[rejected.path];
    for (const line of [/^decision: rejected$/m, new RegExp(`^job: ${job}$`, "m"), /^decider: bob$/m, /^role: Reviewer$/m, /## Reason\n\nThe verification is not documented\./]) assert.match(record, line);
    const passed = await decide("bob", "passed");
    assert.equal(world.srv.writes.length, 2);
    assert.match(world.srv.writes[1].files[passed.path], /^decision: passed$/m);
  } finally { world.restore(); }
});

// ---------------------------------------------------------------- steps 11, 12, 13, 12a

// TST-740219 · level: system · module: system
// guards: UC-024; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; ONE CLICK PER DECISION
// given: the planned product with the job JOB-20261101-0900-a1b2 (kind implement, ITM-101) and its open pull request #7 — its first commit 1111111 with the tests only, red; its head 2222222 green, where the check agent-m done passed; and the pull request #8 of another job whose agent-m done failed
// input: the author opens Implement; a script's click on Merge; the author's click on Merge
// expect: steps 11, 12: #7 is shown with its branch, the run of its first commit (failure) and of its head (success), and "The Definition of Done holds: agent-m done passed on the head."; #8 offers no Merge; the script's click merges nothing; the author's one click merges #7 at the head 2222222 and the page says "Merged as eeeeeee."
test("TST-740219: UC-024 11, 12 the job's pull request is shown with its red and green runs, and Merge, once the Definition of Done holds, merges it at the head that was read", async () => {
  const one = jobRecord(), two = jobRecord({ id: "JOB-20261101-0901-e6f7", worksOn: ["ITM-103"] });
  const pulls = [jobPull(), jobPull({ number: 8, job: two.path.slice(10, -3), step: "ITM-103", commits: [{ sha: "3".repeat(40), files: ["tests/mail.test.mjs"], ci: "failure" }, { sha: "4".repeat(40), files: ["src/mail/index.mjs"], ci: "success" }], done: "failure" })];
  const page = await openImplement({}, { files: await planned({ files: { ...GATES, [one.path]: one.text, [two.path]: two.text } }), pullRequests: pulls });
  try {
    const seven = textOf(found(page.target, '[data-pull="7"]')[0]);
    assert.match(seven, /branch agent-m\/JOB-20261101-0900-a1b2 into main/);
    assert.match(textOf(found(found(page.target, '[data-pull="7"]')[0], '[data-ci="first"]')[0]), /1111111: run \d+ failure/);
    assert.match(textOf(found(found(page.target, '[data-pull="7"]')[0], '[data-ci="last"]')[0]), /2222222: run \d+ success/);
    assert.match(seven, /The Definition of Done holds: agent-m done passed on the head\./);
    assert.equal(found(page.target, '[data-merge-pull="8"]').length, 0, "no Merge where the Definition of Done does not hold");
    const merge = found(page.target, '[data-merge-pull="7"]')[0];
    await page.script(merge);
    assert.deepEqual(page.merges, [], "a script's click merges nothing");
    await page.press(merge);
    assert.deepEqual(page.merges, [{ number: 7, sha: "2".repeat(40) }]);
    assert.equal(textOf(found(found(page.target, '[data-pull="7"]')[0], "[data-merge-result]")[0]), "Merged as eeeeeee.");
  } finally { page.done(); }
});

// TST-740220 · level: system · module: system
// guards: UC-024
// given: the planned product with the job's open pull request #7 of TST-740219, on a server whose default branch has no rule that requires a check (greenToMerge false); and the same on one where a rule requires a check
// input: the author opens Implement on each
// expect: 12a: on the first the page says the server does not enforce "merge only on green" and links the server's page for branch protection (https://github.com/alice/thesis-tool/settings/branches), and still offers Merge only once the Definition of Done holds; on the second it says nothing of it
test("TST-740220: UC-024 12a a repository without branch protection is named, with the page that sets it", async () => {
  const job = jobRecord();
  const files = await planned({ files: { ...GATES, [job.path]: job.text } });
  const loose = await openImplement({}, { files, pullRequests: [jobPull()], green: false });
  try {
    const note = found(loose.target, "[data-green-to-merge]")[0];
    assert.match(textOf(note), /The server does not enforce "merge only on green"/);
    assert.equal(tagged(note, "a")[0].getAttribute("href"), "https://github.com/alice/thesis-tool/settings/branches");
    assert.equal(found(loose.target, '[data-merge-pull="7"]').length, 1);
  } finally { loose.done(); }
  const strict = await openImplement({}, { files, pullRequests: [jobPull()], green: true });
  try { assert.equal(found(strict.target, "[data-green-to-merge]").length, 0); } finally { strict.done(); }
});

// TST-740221 · level: system · module: system
// guards: UC-024; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the planned product, the gates before Implementation passed; ITM-102 builds on ITM-101; first the pull request 1 of ITM-101 open, then merged
// input: the author opens Implement before and after the merge
// expect: 13: before, ITM-101 is in progress and ITM-102 waiting for an item it builds on; after, ITM-101 is done and cannot be selected, and ITM-102, which waited for it, is ready and ticked; no file was written to record it
test("TST-740221: UC-024 13 a merged step is shown as done and the steps that waited for it become ready", async () => {
  const files = await planned({ files: GATES });
  const before = await openImplement({}, { files, pullRequests: [pr(1, "ITM-101", "open", "2026-10-20T09:00:00Z")] });
  try {
    const rows = Object.fromEntries(stepRows(before).map((row) => [row.id, row]));
    assert.equal(rows["ITM-101"].state, "in progress");
    assert.equal(rows["ITM-102"].state, "waiting for an item it builds on");
  } finally { before.done(); }
  const after = await openImplement({}, { files, pullRequests: [merged(1, "ITM-101")] });
  try {
    const rows = Object.fromEntries(stepRows(after).map((row) => [row.id, row]));
    assert.deepEqual([rows["ITM-101"].state, rows["ITM-101"].selectable], ["done", false]);
    assert.deepEqual([rows["ITM-102"].state, rows["ITM-102"].ticked], ["ready", true]);
    assert.deepEqual(after.srv.writes, []);
  } finally { after.done(); }
});

// ---------------------------------------------------------------- 1c

// TST-740222 · level: system · module: system
// guards: UC-024; GITLAB PRODUCTS ARE SUPPORTED
// given: a product on gitlab.example.org (team/product) with the open merge request !3 of the job JOB-20261101-0900-a1b2 on ITM-101: its first commit adds the test and its pipeline failed, its head changes src/store/index.mjs and its pipeline passed, whose job agent-m done succeeded
// input: the host of the product, as the page and the job check use it: the open merge requests listed, the facts of !3 read, and !3 merged at the head that was read
// expect: 1c: the merge request is listed as an open pull request whose description names the job; its facts give the first commit 1111111 with tests/store.test.mjs and CI failure, the head 2222222 with CI success, and the head's checks node and agent-m done, both success; the merge is made once, at the head 2222222
test("TST-740222: UC-024 1c on GitLab the merge request is the pull request and GitLab CI its CI: listed, checked and merged as on GitHub", async () => {
  const project = gitlabProject({ mr: { iid: 3, job: "JOB-20261101-0900-a1b2", step: "ITM-101", commits: [{ sha: FIRST, files: ["tests/store.test.mjs"], ci: "failure" }, { sha: SECOND, files: ["src/store/index.mjs"], ci: "success" }], done: "success" } });
  const real = globalThis.fetch;
  globalThis.fetch = project.fetch;
  try {
    const open = await project.host.listPullRequests({ state: "open" });
    assert.deepEqual(open.map((each) => [each.number, each.state, /^Job: JOB-20261101-0900-a1b2$/m.test(each.body)]), [[3, "open", true]]);
    const facts = await project.host.pullRequestFacts(3);
    assert.deepEqual(facts.commits.map((each) => [each.sha.slice(0, 7), each.files, each.ci]), [["1111111", ["tests/store.test.mjs"], "failure"], ["2222222", ["src/store/index.mjs"], "success"]]);
    assert.deepEqual(facts.checks.map((each) => [each.name, each.state]), [["node", "success"], ["agent-m done", "success"]]);
    await project.host.mergePullRequest(3, SECOND);
    assert.deepEqual(project.merges, [{ iid: 3, sha: SECOND }]);
  } finally { globalThis.fetch = real; }
});
