// Release tests of the requirements UC-024 "Implement the architecture" realises, each checked from what an author reads on the route Implement, from the requests the fakes of GitHub received, from the gate records
// written on the product's host, and from the outcome and findings of the job check the product's CI runs on a pull request (MOD-workflow-entries' onDoneCheck, the job `agent-m done`): a planned model implementing its
// plan, a backlog item per job, nothing implemented before it is accepted, a job only for a holder of its role, a gate stopping a step, a gate not decided by the one whose work it checks, the gate recorded, the job
// rules of the Definition of Done one by one, the merge only when it holds, restricted content kept from a forbidden place, the page naming where it sends, one click per decision, the job's start record and the
// chapters it is given. TST-740301 maps every requirement UC-024 realises to the release tests that guard it, this file's or other writers'.
// Run: node --test tests/release-uc-024-implement-the-architecture.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-runtimes
// Module: MOD-repository-hosts
// Module: MOD-product-process
// Guards: UC-024
// Level: release
//
// Written for the release testing of sprint 142 by developer-opus-e (ITM-740), who implemented none of ITM-732, ITM-733, ITM-734 and ITM-748, nor the behaviour any case of this file guards. Of the code UC-024's flow
// runs, developer-opus-e built ITM-1170 (greenToMerge and the note of 12a), ITM-1171 (an item's pull request into its sprint's branch), ITM-1264 (the route implement of a model that works from a backlog judged from its
// view, its workflow from workflowOf), ITM-1260 (the stored views of progress and the backlog) and ITM-1058 and ITM-1059 (the plan drafted and written by hand); the requirements that behaviour serves are mapped in
// BUILT_BY_WRITER to the release tests other writers wrote, and no case here guards them (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is tests/uc-024-harness.mjs: the real pages, MOD-runtimes,
// MOD-product-process, MOD-work-plans, MOD-run-planner and MOD-repository-hosts behind fakes of GitHub; the release team works from the specification and the pages, so each case ends at what a person reads, at the
// request a fake received, or at the job check's outcome. Where the code and the SPEC or UC-024 disagree the case follows the text and is marked `todo` with the word FINDING. Readings the texts leave open, which the
// cases state:
//   - "a job ... starts only for a step of the product's implementation plan" is read on the route Implement: it offers the plan's steps alone, and each start record works on one of them.
//   - "a job ... is handed only to a participant that the job's role assignment assigns to the role the job belongs to" is read as: the participants Implement offers for a step, and the one its start record names.
//   - "A gate ... is not passed" / "the job stops" before a gate is read, for implementation, as the steps after a gate without a passed record: none can be started; and, for a pull request, as the job check's
//     finding on every gate the workflow places before the merge.
//   - "Who decided, when, and on which text" (THE GATE IS RECORDED) is read on the gate record: its decider and role, its date, and its `on`.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { declarationSchema, productWorkflow, recordGateDecision, roleAssignmentSchema } from "../src/product-process/index.mjs";
import { ADDRESS, FIRST, GATES, backlogProduct, openScrum, PARTICIPANTS, SECOND, STORE_TEST, fieldOf, found, instance, jobCheck, jobPull, jobRecord, lines, modulePath, openImplement, planned, pr, quiet, servers, startRecords, stepRows,
  textOf } from "./uc-024-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-024-implement-modules.md";
const SELF = "tests/release-uc-024-implement-the-architecture.test.mjs";
const BUILDS = "read the repository, write to the repository, run code and tests, use tools";
const register = (...rows) => PARTICIPANTS.trimEnd().split("\n").filter((row) => !/^\| dev-[ab] /.test(row)).concat(rows).join("\n") + "\n";
const assignment = (rows) => lines("# plan", "", "## Roles", "", "| Role | Participants |", "|---|---|", ...rows);
const rulesOf = (status) => status.findings.map((each) => each.rule);

// ---------------------------------------------------------------- the map

// Each requirement UC-024 realises, with the release tests that guard it: this file's, and those other writers wrote.
const EVIDENCE = {
  "THE PROCESS MODEL IS DECLARED PER PRODUCT": [["tests/release-sprint-06-uc-002-implementation-pages.test.mjs", "TST-472486"], ["tests/release-itm-1278-models-declarations.test.mjs", "TST-1278301"]],
  "THE MODEL DETERMINES THE PHASES AND THE GATES": [["tests/release-sprint-06-uc-002-implementation-pages.test.mjs", "TST-472490"], ["tests/release-uc-045-plan-the-implementation.test.mjs", "TST-1061106"]],
  "A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN": [[SELF, "TST-740302"], ["tests/release-uc-045-plan-the-implementation.test.mjs", "TST-1061101"]],
  "AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES": [["tests/release-uc-045-plan-the-implementation.test.mjs", "TST-1061102"]],
  "A PLAN STEP NAMES THE TESTS OF ITS LEVEL": [["tests/release-uc-045-plan-the-implementation.test.mjs", "TST-1061103"]],
  "AGILE IMPLEMENTATION STARTS FROM THE BACKLOG": [[SELF, "TST-740303"]],
  "NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED": [[SELF, "TST-740304"], ["tests/release-uc-033-move-an-issue-into-the-backlog.test.mjs", "TST-804305"]],
  "A JOB GOES ONLY TO A HOLDER OF ITS ROLE": [[SELF, "TST-740305"]],
  "A JOB STOPS AT EVERY GATE": [[SELF, "TST-740306"], ["tests/release-itm-1190-jobs-page-waiting.test.mjs", "TST-1190304"]],
  "A GATE NAMES WHO DECIDES IT": [[SELF, "TST-740306"], ["tests/release-sprint-06-uc-002-implementation-pages.test.mjs", "TST-472505"]],
  "A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS": [[SELF, "TST-740307"]],
  "THE GATE IS RECORDED": [[SELF, "TST-740308"], ["tests/release-uc-035-progress.test.mjs", "TST-806103"]],
  "AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST": [[SELF, "TST-740309"]],
  "AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES": [[SELF, "TST-740310"]],
  "EVERY TEST HAS ONE LEVEL": [["tests/release-uc-028-run-and-review.test.mjs", "TST-773108"], ["tests/release-uc-045-plan-the-implementation.test.mjs", "TST-1061107"]],
  "RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER": [["tests/release-uc-045-plan-the-implementation.test.mjs", "TST-1061108"], ["tests/release-uc-048-fill-the-roles.test.mjs", "TST-1063101"]],
  "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES": [],
  "ONE MODULE, ONE FILE": [["tests/release-uc-025-validate-modules.test.mjs", "TST-741106"], ["tests/release-uc-023-review-pages.test.mjs", "TST-739102"]],
  "A MODULE IS A FOLDER": [[SELF, "TST-740310"], ["tests/release-uc-025-validate-modules.test.mjs", "TST-741105"]],
  "AN ARCHITECTURE STAYS AT THE LEVEL OF MODULES": [],
  "DEVELOP AGAINST INTERFACES": [[SELF, "TST-740311"]],
  "EVERY ARTIFACT NAMES ITS ORIGIN": [[SELF, "TST-740312"], ["tests/release-uc-025-validate-modules.test.mjs", "TST-741103"]],
  "CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI": [["tests/release-uc-012-handle-an-issue.test.mjs", "TST-585305"]],
  "A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS": [[SELF, "TST-740313"], ["tests/release-itm-1264-implement-stored-view.test.mjs", "TST-1264307"]],
  "THE DEFAULT DEFINITION OF DONE IS THE JOB RULES": [[SELF, "TST-740314"], ["tests/release-sprint-06-uc-002-implementation-pages.test.mjs", "TST-472500"]],
  "A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN": [["tests/release-itm-1171-target-branch.test.mjs", "TST-1171101"], ["tests/release-sprint-06-uc-002-implementation-pages.test.mjs", "TST-472502"]],
  "WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET": [["tests/release-itm-1171-target-branch.test.mjs", "TST-1171102"], ["tests/release-sprint-06-uc-002-implementation-pages.test.mjs", "TST-472504"]],
  "A PARTICIPANT DECLARES ITS CAPABILITIES": [[SELF, "TST-740305"], ["tests/release-uc-049-talk-to-an-agent-in-the-prompt-bar.test.mjs", "TST-513211"]],
  "A PARTICIPANT DECLARES WHERE IT PROCESSES DATA": [[SELF, "TST-740316"], ["tests/release-uc-049-talk-to-an-agent-in-the-prompt-bar.test.mjs", "TST-513205"]],
  "RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS": [[SELF, "TST-740315"]],
  "ONE DEFINITION, THREE DRIVERS": [["tests/release-uc-010-run-a-job-in-github-actions.test.mjs", "TST-373308"]],
  "THE LOCAL BRIDGE REQUIRES A TOKEN": [["tests/release-itm-263-bridge-client.test.mjs", "TST-263901"]],
  "NO SECRET IN THE REPOSITORY": [[SELF, "TST-740317"], ["tests/release-uc-010-run-a-job-in-github-actions.test.mjs", "TST-373302"]],
  "AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT": [["tests/release-uc-019-change-requirements-by-prompt.test.mjs", "TST-418110"]],
  "THE PAGE NAMES WHERE IT SENDS": [[SELF, "TST-740316"]],
  "ONE CLICK PER DECISION": [[SELF, "TST-740318"]],
  "EVERY STEP EXPLAINS ITSELF": [["tests/release-sprint-06-uc-002-implementation-pages.test.mjs", "TST-472497"]],
  "A REFACTORING JOB BEGINS WITHOUT A FAILING TEST": [[SELF, "TST-740319"]],
  "A REFACTORING JOB CHANGES NO EXPECTED RESULT": [[SELF, "TST-740320"]],
  "A JOB IS RECORDED IN ITS PRODUCT REPOSITORY": [[SELF, "TST-740317"], ["tests/release-uc-010-run-a-job-in-github-actions.test.mjs", "TST-373310"]],
  "PROGRESS AND JOB STATE ARE DERIVED, NOT STORED": [["tests/release-itm-1264-implement-stored-view.test.mjs", "TST-1264304"], ["tests/release-itm-1190-jobs-page-waiting.test.mjs", "TST-1190303"]],
  "A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION": [["tests/release-uc-025-validate-modules.test.mjs", "TST-741112"]],
  "A RUN FOLLOWS THE MODULES' INTERFACES": [["tests/release-uc-045-plan-the-implementation.test.mjs", "TST-1061109"]],
  "AN IMPLEMENTATION JOB RECEIVES THE CHAPTERS ON MODELING, DESIGN, IMPLEMENTATION AND TESTING": [[SELF, "TST-740321"], ["tests/test_job_reading_checkout.py", "TST-417100"]],
};
// The requirements the SPEC guards at review only: no release test is asked of them.
const AT_REVIEW = ["A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES", "AN ARCHITECTURE STAYS AT THE LEVEL OF MODULES", "DEVELOP AGAINST INTERFACES", "CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI",
  "ONE CLICK PER DECISION"];
// The requirements whose behaviour on UC-024's path this file's writer built: guarded here only by the release tests other writers wrote.
const BUILT_BY_WRITER = {
  "CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI": "ITM-1170, the note of 12a and repositoryInfo's greenToMerge",
  "A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN": "ITM-1171, targetBranch's sprint branch",
  "WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET": "ITM-1171, targetBranch",
  "PROGRESS AND JOB STATE ARE DERIVED, NOT STORED": "ITM-1260 and ITM-1264, the views stored for a commit and the route implement judged from them",
  "THE MODEL DETERMINES THE PHASES AND THE GATES": "ITM-1264, the workflow of the route implement from workflowOf",
  "AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES": "ITM-1058 and ITM-1059, the plan drafted and written by hand on the plan page",
  "A PLAN STEP NAMES THE TESTS OF ITS LEVEL": "ITM-1058 and ITM-1059, the plan drafted and written by hand on the plan page",
};

// TST-740301 · level: release · module: system
// guards: UC-024
// given: UC-024 as committed text, whose `realises` lists forty-four requirements, and the release tests named in EVIDENCE
// input: read UC-024's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-024 realises these forty-four requirements; each has at least one release test named, except those the SPEC guards at review only ("no automatic check; at review"), listed in AT_REVIEW; each test named stands in its file with the level release and guards that requirement; no case of this file guards a requirement in BUILT_BY_WRITER
test("TST-740301: UC-024 every requirement it realises whose check is a test has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 44, "known positive: UC-024 realises forty-four requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-024 realises");
  for (const [requirement, named] of Object.entries(EVIDENCE)) {
    if (!AT_REVIEW.includes(requirement)) assert.ok(named.length > 0, `${requirement}: a release test is named`);
    for (const [file, id] of named) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${requirement}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
  const own = testDeclarations(SELF, read(SELF));
  for (const requirement of Object.keys(BUILT_BY_WRITER)) assert.deepEqual(own.filter((each) => (each.guards ?? []).includes(requirement)).map((each) => each.id), [], `${requirement} is left to other writers`);
});

// ---------------------------------------------------------------- the plan, the backlog, acceptance

// TST-740302 · level: release · module: system
// guards: A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN; UC-024
// given: a V-model product whose plan holds ITM-101 to ITM-106, the gates before Implementation passed; its backlog folder holds ITM-900, an item no step of the plan names
// input: the author opens Implement and presses Start jobs on the steps it ticked
// expect: the page lists the six steps of the plan, and ITM-900 nowhere; each start record committed works on exactly one step of the plan, ITM-101 or ITM-103, with its parameter steps naming it; none works on ITM-900
test("TST-740302: a planned model starts jobs only for steps of its implementation plan", async () => {
  const stray = lines("---", "id: ITM-900", "title: Work beside the plan", "level: module", "realises:", "  - UC-001", "modules:", "  - MOD-mail", "tests:", "  - unit", "origin:", "  - UC-001", "---", "# ITM-900 Work beside the plan", "", "## Outcome", "", "o");
  const page = await openImplement({}, { files: await planned({ files: { ...GATES, "docs/backlog/ITM-900-beside.md": stray } }) });
  try {
    assert.deepEqual(stepRows(page).map((row) => row.id), ["ITM-101", "ITM-102", "ITM-103", "ITM-104", "ITM-105", "ITM-106"]);
    assert.doesNotMatch(page.text(), /ITM-900/);
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    const records = startRecords(page);
    assert.equal(records.length, 2);
    for (const record of records) {
      const step = /^works_on:\n {2}- (ITM-\d+)\n(?! {2}- )/m.exec(record.text)?.[1];
      assert.ok(["ITM-101", "ITM-103"].includes(step), record.text);
      assert.match(record.text, new RegExp(`"steps": \\[\\s*"${step}"\\s*\\]`));
    }
  } finally { page.done(); }
});

// TST-740303 · level: release · module: system
// guards: AGILE IMPLEMENTATION STARTS FROM THE BACKLOG; UC-024
// given: a Scrum product whose team1 runs sprint 02 selecting ITM-001 (done), ITM-002 (in progress) and ITM-003 (ready, MOD-mail); dev-a fills team1's roles
// input: the author opens Implement, then presses Start jobs
// expect: the page's rows are items of the product's backlog; Start jobs commits one start record, of kind implement, working on exactly the item ITM-003, its parameters naming items: ["ITM-003"]; no record works on anything else
test("TST-740303: in a model that works from a backlog every implementation job implements one item of the backlog", async () => {
  const files = await backlogProduct();
  const page = await openScrum("implement", {}, { files });
  try {
    const items = found(page.target, "[data-item]").map((row) => row.getAttribute("data-item"));
    assert.ok(items.length > 0 && items.every((id) => Object.keys(files).some((path) => path.startsWith(`docs/backlog/${id}-`))), "every row is an item of the backlog");
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    const records = page.srv.writes.flatMap((write) => Object.entries(write.files).filter(([path]) => /^docs\/jobs\/JOB-/.test(path)).map(([, text]) => text));
    assert.equal(records.length, 1);
    assert.match(records[0], /^kind: implement$/m);
    assert.match(records[0], /^works_on:\n {2}- ITM-003\n[a-z]/m);
    assert.match(records[0], /"items": \[\s*"ITM-003"\s*\]/);
  } finally { page.done(); }
});

// TST-740304 · level: release · module: system
// guards: NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED; UC-024
// given: a V-model product, the gates before Implementation passed, whose use case UC-001, which every step of the plan realises, has no approval record naming its text; then the same product with UC-001 accepted; and a Scrum product whose ITM-006 realises a requirement that is not accepted
// input: the author opens Implement on each, and presses Start jobs on the first
// expect: in the first, every step is waiting for acceptance, none can be selected, and each reason names UC-001 as not accepted; Start jobs commits nothing; with UC-001 accepted, ITM-101 and ITM-103 are ready and ticked; in the Scrum product ITM-006 is waiting for acceptance and cannot be started
test("TST-740304: a step or an item that names what is not accepted cannot be started, and can once it is accepted", async () => {
  const open = await openImplement({}, { files: await planned({ files: GATES, open: ["docs/use-cases/UC-001-load.md"] }) });
  try {
    for (const row of stepRows(open)) {
      assert.deepEqual([row.state, row.selectable], ["waiting for acceptance", false], row.id);
      assert.match(row.reasons, /UC-001 is open, not accepted/);
    }
    await open.press(found(open.target, "[data-start-jobs]")[0]);
    await quiet();
    assert.deepEqual(open.srv.writes, []);
  } finally { open.done(); }
  const accepted = await openImplement({}, { files: await planned({ files: GATES }) });
  try {
    const rows = Object.fromEntries(stepRows(accepted).map((row) => [row.id, row]));
    for (const id of ["ITM-101", "ITM-103"]) assert.deepEqual([rows[id].state, rows[id].ticked], ["ready", true], id);
  } finally { accepted.done(); }
  const scrum = await openScrum("implement", {}, { files: await backlogProduct() });
  try {
    const six = found(scrum.target, '[data-item="ITM-006"]')[0];
    assert.equal(six.getAttribute("data-state"), "waiting for acceptance");
    assert.equal(six.getAttribute("data-startable"), "false");
  } finally { scrum.done(); }
});

// ---------------------------------------------------------------- roles, gates

// TST-740305 · level: release · module: system
// guards: A JOB GOES ONLY TO A HOLDER OF ITS ROLE; A PARTICIPANT DECLARES ITS CAPABILITIES; UC-024
// given: a V-model product whose role assignment gives Developer and Tester to dev-a and local-llm; dev-b has every capability and holds no role; local-llm declares only draft text
// input: the author opens Implement and presses Start jobs
// expect: for each ready step the participants offered are dev-a alone — neither dev-b, who holds no role, nor local-llm, which cannot write and run tests; each start record names dev-a
test("TST-740305: a job goes only to a holder of its role who has the capabilities the job needs", async () => {
  const roles = assignment(["| Product owner | alice |", "| Developer | dev-a, local-llm |", "| Tester | dev-a, local-llm |", "| Reviewer | bob |"]);
  const page = await openImplement({}, { files: await planned({ files: { ...GATES, "docs/role-assignments/plan.md": roles } }) });
  try {
    for (const step of ["ITM-101", "ITM-103"]) assert.deepEqual(fieldOf(page, step, "participant").childNodes.map(textOf), ["dev-a"], step);
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    const records = startRecords(page);
    assert.equal(records.length, 2);
    for (const record of records) assert.match(record.text, /^participant: dev-a$/m);
  } finally { page.done(); }
});

// TST-740306 · level: release · module: system
// guards: A JOB STOPS AT EVERY GATE; A GATE NAMES WHO DECIDES IT; UC-024
// given: a V-model product with no gate record, so that the gate Design → Implementation, decided by the Reviewer, is not passed; then the same product with the two records of the gates before Implementation
// input: the author opens Implement and presses Start jobs, on each
// expect: without the records no step can be selected, each ready step of Implementation names the gate Design → Implementation and its decider Reviewer, and Start jobs commits nothing; with them, ITM-101 and ITM-103 start, two records
test("TST-740306: no implementation job starts behind a gate that is not passed, and the page names the gate's decider", async () => {
  const closed = await openImplement({}, { files: await planned() });
  try {
    for (const row of stepRows(closed)) assert.equal(row.selectable, false, row.id);
    for (const id of ["ITM-101", "ITM-103"]) assert.match(stepRows(closed).find((row) => row.id === id).reasons, /Design → Implementation, decided by Reviewer/);
    await closed.press(found(closed.target, "[data-start-jobs]")[0]);
    await quiet();
    assert.deepEqual(closed.srv.writes, []);
  } finally { closed.done(); }
  const passed = await openImplement({}, { files: await planned({ files: GATES }) });
  try {
    await passed.press(found(passed.target, "[data-start-jobs]")[0]);
    await quiet();
    assert.equal(startRecords(passed).length, 2);
  } finally { passed.done(); }
});

// The V-model workflow of the planned product and a gate decision on its host; `rows` the role assignment's rows.
async function gateWorld(rows) {
  const files = await planned({ files: GATES });
  const world = await servers({ files });
  const workflow = await productWorkflow(readDocument(declarationSchema, "docs/process.md", files["docs/process.md"]), (commit) => world.instanceHost.readSnapshot(commit), "# Instance\n");
  const roles = readDocument(roleAssignmentSchema, "docs/role-assignments/plan.md", assignment(rows));
  const decide = (name, decision, { reason = null, workBy = ["dev-a"], on = [`${ADDRESS}/pull/7`], now = new Date("2026-11-01T11:00:00Z") } = {}) => recordGateDecision(world.host,
    { gate: "Validation & Verification → Operation & Maintenance", job: "JOB-20261101-0900-a1b2", decider: { name, kind: "person" }, role: "Reviewer", decision, reason, on },
    { workflow, assignment: roles, workBy, head: world.srv.head, now, trailers: [] });
  return { world, decide };
}

// TST-740307 · level: release · module: system
// guards: A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS; UC-024
// given: the V-model workflow; the role assignment gives the Reviewer, who decides the gate Validation & Verification → Operation & Maintenance, to dev-a and bob; the job the gate checks is dev-a's
// input: dev-a passes the gate; then bob passes it
// expect: dev-a's decision is refused, naming that dev-a did the work this gate checks and the holders bob and dev-a, and writes nothing; bob's decision writes one gate record naming bob
test("TST-740307: the participant whose work a gate checks cannot pass it, though it holds the deciding role; another holder can", async () => {
  const { world, decide } = await gateWorld(["| Product owner | alice |", "| Developer | dev-a |", "| Tester | dev-a |", "| Reviewer | bob, dev-a |"]);
  try {
    await assert.rejects(decide("dev-a", "passed"), (failure) => failure.name === "MayNotDecide" && failure.reason === "did the work this gate checks" && [...failure.holders].sort().join() === "bob,dev-a");
    assert.deepEqual(world.srv.writes, []);
    const made = await decide("bob", "passed");
    assert.equal(world.srv.writes.length, 1);
    assert.match(world.srv.writes[0].files[made.path], /^decider: bob$/m);
  } finally { world.restore(); }
});

// TST-740308 · level: release · module: system
// guards: THE GATE IS RECORDED; UC-024
// given: the V-model workflow, bob the Reviewer; and a pull request of the job of ITM-101 whose product holds the record of Requirements → Design but none of Design → Implementation
// input: bob passes the gate Validation & Verification → Operation & Maintenance on the pull request at 2026-11-01 11:00 UTC; the job check runs on the pull request
// expect: the record names who decided (decider bob, role Reviewer), when (date 2026-11-01 11:00 UTC) and on which text (on: the pull request's address), at docs/gates/20261101-1100-<the gate's slug>-<4 hex>.md, in a commit "gates: … passed by bob"; the job check fails under THE GATE IS RECORDED naming Design → Implementation, the gate without a record
test("TST-740308: a passed gate records who decided, when and on which text, and a gate without a record keeps the pull request from Done", async () => {
  const { world, decide } = await gateWorld(["| Product owner | alice |", "| Developer | dev-a |", "| Tester | dev-a |", "| Reviewer | bob |"]);
  try {
    const made = await decide("bob", "passed");
    assert.match(made.path, /^docs\/gates\/20261101-1100-validation-verification-operation-maintenance-[0-9a-f]{4}\.md$/);
    const record = world.srv.writes[0].files[made.path];
    for (const line of [/^decider: bob$/m, /^role: Reviewer$/m, /^date: 2026-11-01 11:00 UTC$/m, /^on:\n {2}- https:\/\/github\.com\/alice\/thesis-tool\/pull\/7$/m, /^decision: passed$/m]) assert.match(record, line);
    assert.equal(world.srv.writes[0].message, "gates: Validation & Verification → Operation & Maintenance passed by bob");
  } finally { world.restore(); }
  const status = await jobCheck({ gates: { "docs/gates/20261030-1001-design-implementation-bbbb.md": null } });
  assert.equal(status.outcome, "failed");
  assert.deepEqual(status.findings.map((each) => [each.rule, /Design → Implementation/.test(each.what)]), [["THE GATE IS RECORDED", true]]);
});

// ---------------------------------------------------------------- the job rules of the Definition of Done

// TST-740309 · level: release · module: system
// guards: AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST; UC-024
// given: the pull request #7 of an implement job on ITM-101 in three versions: its first commit holds only the test and was red (known positive); its first commit also holds src/store/index.mjs and was red; its first commit holds only the test and was green
// input: the product's job check on each
// expect: the first passes; the second fails under AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST naming src/store/index.mjs as no test; the third fails under the same rule saying CI was not red on the first commit
test("TST-740309: an implementation job's pull request passes only when its first commit holds failing tests alone", async () => {
  assert.equal((await jobCheck()).outcome, "done", "known positive");
  const mixed = await jobCheck({ commits: [{ sha: FIRST, files: ["tests/store.test.mjs", "src/store/index.mjs"], ci: "failure" }, { sha: SECOND, files: ["src/store/index.mjs"], ci: "success" }] });
  assert.deepEqual(mixed.findings.map((each) => [each.rule, each.artifact]), [["AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST", "src/store/index.mjs"]]);
  const green = await jobCheck({ commits: [{ sha: FIRST, files: ["tests/store.test.mjs"], ci: "success" }, { sha: SECOND, files: ["src/store/index.mjs"], ci: "success" }] });
  assert.deepEqual(rulesOf(green), ["AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST"]);
  assert.match(green.findings[0].what, /CI was not red on the first commit/);
});

// TST-740310 · level: release · module: system
// guards: AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES; A MODULE IS A FOLDER; UC-024
// given: the pull request #7 of the job of ITM-101, whose step names MOD-store (folder src/store/); its head changes src/store/index.mjs and, in a second version, also src/pages/view.mjs, in the folder of MOD-pages, and docs/notes.md, no code file
// input: the product's job check on each
// expect: the first passes; the second fails with exactly one finding, under AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES, on src/pages/view.mjs; docs/notes.md is not named
test("TST-740310: a pull request may change code only in the folders of its job's modules", async () => {
  assert.equal((await jobCheck()).outcome, "done");
  const wide = await jobCheck({ commits: [{ sha: FIRST, files: ["tests/store.test.mjs"], ci: "failure" }, { sha: SECOND, files: ["src/store/index.mjs", "src/pages/view.mjs", "docs/notes.md"], ci: "success" }] });
  assert.deepEqual(wide.findings.map((each) => [each.rule, each.artifact]), [["AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES", "src/pages/view.mjs"]]);
});

// TST-740311 · level: release · module: system
// guards: DEVELOP AGAINST INTERFACES; UC-024
// given: a V-model product whose MOD-pages uses MOD-store.read; MOD-store's file holds a section ## Interfaces and its code src/store/index.mjs holds the marker STORE-INTERNALS; ITM-101 (MOD-store) is merged, so ITM-102 (MOD-pages) is ready
// input: the author opens Implement
// expect: what is sent for ITM-102 names "docs/architecture/MOD-store.md ## Interfaces" and neither docs/architecture/MOD-store.md as a whole nor src/store/index.mjs
test("TST-740311: a module's job is given the interfaces of the modules it uses, not their code", async () => {
  const files = await planned({ files: { ...GATES, "src/store/index.mjs": "export const read = () => 'STORE-INTERNALS';\n" } });
  const page = await openImplement({}, { files, pullRequests: [pr(1, "ITM-101", "merged", "2026-10-20T09:00:00Z", "2026-10-21T10:00:00Z")] });
  try {
    const sent = textOf(fieldOf(page, "ITM-102", "sent")).split(/: |, /);
    assert.ok(sent.includes("docs/architecture/MOD-store.md ## Interfaces"), sent.join(" | "));
    assert.ok(!sent.includes("docs/architecture/MOD-store.md"));
    assert.ok(!sent.includes("src/store/index.mjs"));
  } finally { page.done(); }
});

// TST-740312 · level: release · module: system
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; UC-024
// given: the pull request #7 of the job of ITM-101 whose first commit adds tests/store.test.mjs; in one version its test TST-001 names RULE ONE and MOD-store (known positive), in another it names neither guards nor module
// input: the product's job check on each
// expect: the first passes; the second fails with two findings under EVERY ARTIFACT NAMES ITS ORIGIN on tests/store.test.mjs: TST-001 names no requirement it guards, and names no module
test("TST-740312: every new test of a pull request names the requirement it guards and the module it exercises", async () => {
  assert.equal((await jobCheck()).outcome, "done");
  const bare = STORE_TEST.replace("// guards: RULE ONE\n", "").replace(" · module: MOD-store", "");
  const status = await jobCheck({ files: { "tests/store.test.mjs": bare } });
  assert.deepEqual(status.findings.map((each) => [each.rule, each.artifact, each.what]), [["EVERY ARTIFACT NAMES ITS ORIGIN", "tests/store.test.mjs", "the new test TST-001 names no requirement it guards"],
    ["EVERY ARTIFACT NAMES ITS ORIGIN", "tests/store.test.mjs", "the new test TST-001 names no module"]]);
});

// TST-740313 · level: release · module: system
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; UC-024
// given: three open pull requests of implement jobs: #7, whose head passed the check agent-m done; #8, whose agent-m done failed; #9, whose head has no run of agent-m done yet; and #7 as a draft
// input: the author opens Implement; presses Merge on #7
// expect: Merge stands beside #7 alone; #8 says the Definition of Done does not hold, #9 that it is not checked on the head yet; the merge of #7 is asked at the head the page read, 2222222; a draft #7 offers no Merge
test("TST-740313: a pull request is merged only once the Definition of Done holds on its head", async () => {
  const records = [jobRecord(), jobRecord({ id: "JOB-20261101-0901-e6f7", worksOn: ["ITM-103"] }), jobRecord({ id: "JOB-20261101-0902-a9b8", worksOn: ["ITM-103"] })];
  const files = await planned({ files: { ...GATES, ...Object.fromEntries(records.map((each) => [each.path, each.text])) } });
  const other = (number, id, done) => jobPull({ number, job: id, step: "ITM-103", commits: [{ sha: String(number).repeat(40), files: ["tests/mail.test.mjs"], ci: "failure" }, { sha: `a${number}`.padEnd(40, "0"), files: ["src/mail/index.mjs"], ci: "success" }], done });
  const page = await openImplement({}, { files, pullRequests: [jobPull(), other(8, "JOB-20261101-0901-e6f7", "failure"), other(9, "JOB-20261101-0902-a9b8", null)] });
  try {
    assert.deepEqual(found(page.target, "[data-merge-pull]").map((button) => button.getAttribute("data-merge-pull")), ["7"]);
    assert.match(textOf(found(page.target, '[data-pull="8"]')[0]), /The Definition of Done does not hold: agent-m done is failure on the head\./);
    assert.match(textOf(found(page.target, '[data-pull="9"]')[0]), /The Definition of Done is not checked on the head yet: no run of agent-m done is listed\./);
    await page.press(found(page.target, '[data-merge-pull="7"]')[0]);
    assert.deepEqual(page.merges, [{ number: 7, sha: SECOND }]);
  } finally { page.done(); }
  const draft = await openImplement({}, { files, pullRequests: [jobPull({ draft: true })] });
  try { assert.equal(found(draft.target, "[data-merge-pull]").length, 0); } finally { draft.done(); }
});

// TST-740314 · level: release · module: system
// guards: THE DEFAULT DEFINITION OF DONE IS THE JOB RULES; UC-024
// given: a V-model product whose declaration adds no condition ("The job rules hold; no condition is added."); a pull request of the job of ITM-101 that breaks every job rule at once: its head's shards red, its first commit green and holding code, a code file outside MOD-store's folder, a new test that names neither requirement nor module, and no record of the gates before Implementation
// input: the product's job check
// expect: the check fails, and its findings name each job rule: AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST, AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES, EVERY ARTIFACT NAMES ITS ORIGIN, THE GATE IS RECORDED, and the shard pull-request.unit.1 that is not green; known positive: the pull request that keeps every rule passes (TST-740309's first)
test("TST-740314: without a declared condition, the Definition of Done is the job rules, each checked", async () => {
  const bare = STORE_TEST.replace("// guards: RULE ONE\n", "").replace(" · module: MOD-store", "");
  const status = await jobCheck({ headGreen: false, gates: { "docs/gates/20261030-1000-requirements-design-aaaa.md": null, "docs/gates/20261030-1001-design-implementation-bbbb.md": null }, files: { "tests/store.test.mjs": bare },
    commits: [{ sha: FIRST, files: ["tests/store.test.mjs", "src/store/index.mjs"], ci: "success" }, { sha: SECOND, files: ["src/store/index.mjs", "src/mail/index.mjs"], ci: "success" }] });
  assert.equal(status.outcome, "failed");
  const rules = new Set(rulesOf(status));
  for (const rule of ["AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST", "AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES", "EVERY ARTIFACT NAMES ITS ORIGIN", "THE GATE IS RECORDED"]) assert.ok(rules.has(rule), `${rule} is checked`);
  assert.ok(status.findings.some((each) => /pull-request\.unit\.1/.test(each.what)), "CI that is not green is named");
});

// ---------------------------------------------------------------- places, sending, recording

// TST-740315 · level: release · module: system
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; UC-024
// given: SRC-letters, restricted, permits only "this machine", and the product keeps its content in docs/sources/SRC-letters/, the folder of MOD-mail; dev-a works at this machine, dev-b at "a provider in the USA", both Developer and Tester; then the same source permitting both places
// input: the author opens Implement, ITM-103 (MOD-mail) ready, and presses Start jobs with dev-b chosen wherever it is offered
// expect: ITM-103 offers dev-a alone and names dev-b, SRC-letters and its place; no start record sends ITM-103's job to dev-b; where the source permits both places, ITM-103 offers dev-a and dev-b
test("TST-740315: content of a restricted source is never given to a participant at a place the source does not permit", async () => {
  const letters = (places) => lines("---", "id: SRC-letters", "title: The letters", "kind: document", "authority: normative", "licence: restricted - the senders' terms", "places:", ...places.map((place) => `  - ${place}`),
    `content_repository: ${ADDRESS}`, "---", "# SRC-letters The letters", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| `1` | 2026-10-13 | fixture | here | one file |");
  const mail = lines("---", "id: MOD-mail", "title: The module MOD-mail", "folder: docs/sources/SRC-letters/", "realises:", "  - RULE ONE", "follows:", "  - ARC-003", "uses: []", "provides:", "  - read", "---", "# MOD-mail The module MOD-mail",
    "", "## Responsibility", "", "r", "", "## Interfaces", "", "- `read` — i");
  const files = await planned({ files: { ...GATES, [modulePath("MOD-mail")]: mail, "docs/sources/SRC-letters/1/letter.md": "Dear reader.\n",
    "docs/role-assignments/plan.md": assignment(["| Product owner | alice |", "| Developer | dev-a, dev-b |", "| Tester | dev-a, dev-b |", "| Reviewer | bob |"]) } });
  const participants = register(`| dev-a | model endpoint | model-c | 200000 | — | ${BUILDS} | this machine | ci hosted secret DEV_KEY |`, `| dev-b | model endpoint | model-d | 200000 | — | ${BUILDS} | a provider in the USA | ci hosted secret DEV_KEY |`);
  const page = await openImplement({}, { files, instance: instance({ "docs/participants.md": participants, "docs/sources/SRC-letters.md": letters(["this machine"]) }) });
  try {
    assert.deepEqual(fieldOf(page, "ITM-103", "participant").childNodes.map(textOf), ["dev-a"]);
    assert.match(textOf(fieldOf(page, "ITM-103", "withheld")), /dev-b.*SRC-letters|SRC-letters.*dev-b/);
    for (const select of found(page.target, "[data-participant-of]")) if (select.childNodes.some((option) => textOf(option) === "dev-b")) select.value = "dev-b";
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    const forMail = startRecords(page).filter((record) => /works_on:\n {2}- ITM-103\n/.test(record.text));
    assert.equal(forMail.length, 1);
    assert.match(forMail[0].text, /^participant: dev-a$/m);
  } finally { page.done(); }
  const both = await openImplement({}, { files, instance: instance({ "docs/participants.md": participants, "docs/sources/SRC-letters.md": letters(["this machine", "a provider in the USA"]) }) });
  try { assert.deepEqual(fieldOf(both, "ITM-103", "participant").childNodes.map(textOf), ["dev-a", "dev-b"]); } finally { both.done(); }
});

// TST-740316 · level: release · module: system
// guards: THE PAGE NAMES WHERE IT SENDS; A PARTICIPANT DECLARES WHERE IT PROCESSES DATA; UC-024
// given: a V-model product, ITM-101 ready; dev-a processes data at "this machine"
// input: the author opens Implement, reads the part of ITM-101 before any click, then presses Start jobs
// expect: before anything is sent the page names the participant with its place ("dev-a processes data at this machine") and what goes to it ("dev-a at this machine: …" with the step's files); nothing is written before the click; the start record's ## Destinations names dev-a at this machine, as the page named it
test("TST-740316: before a job is started the page names each destination, a participant with its processing place", async () => {
  const page = await openImplement({}, { files: await planned({ files: GATES }) });
  try {
    assert.equal(textOf(fieldOf(page, "ITM-101", "places")), "dev-a processes data at this machine");
    assert.match(textOf(fieldOf(page, "ITM-101", "sent")), /^dev-a at this machine: docs\/architecture\/MOD-store\.md, /);
    assert.deepEqual(page.srv.writes, []);
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    const record = startRecords(page).find((each) => /works_on:\n {2}- ITM-101\n/.test(each.text));
    assert.match(record.text, /## Destinations\n[^#]*dev-a[^#]*this machine/);
  } finally { page.done(); }
});

// TST-740317 · level: release · module: system
// guards: A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; NO SECRET IN THE REPOSITORY; UC-024
// given: a V-model product on GitHub, ITM-101 and ITM-103 ready, the author's token github_pat_HARNESS… stored; the instance is akmaier/agent-m
// input: the author presses Start jobs
// expect: one commit to the product's repository, alice/thesis-tool, holds a record docs/jobs/JOB-<id>.md for each job naming its inputs, participant dev-a, model, route ci hosted, who started it (the field started_by) and its start; nothing is written to the instance; no record holds the token
test("TST-740317: each job started is recorded in its product's repository with its inputs, participant, route and start, and no secret", async () => {
  const page = await openImplement({}, { files: await planned({ files: GATES }) });
  try {
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    const records = startRecords(page);
    assert.equal(records.length, 2);
    for (const record of records) {
      for (const field of [/^participant: dev-a$/m, /^model: model-c$/m, /^route: ci hosted$/m, /^started_by: /m, /^start: \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/m, /^inputs:\n {2}- /m]) assert.match(record.text, field);
      assert.doesNotMatch(record.text, /github_pat_/);
    }
    assert.ok(page.log.length > 0 && page.log.every((each) => each.repository === "alice/thesis-tool"), "nothing is written to the instance");
  } finally { page.done(); }
});

// TST-740318 · level: release · module: system
// guards: ONE CLICK PER DECISION; UC-024
// given: a V-model product with ITM-101 and ITM-103 ready; and one with the open pull request #7 of a job whose Definition of Done holds
// input: one click of the author on Start jobs; one click on Merge; and before each, a script's click
// expect: the script's clicks write and merge nothing; the one click on Start jobs commits both start records and nothing else is pressed; the one click on Merge merges #7
test("TST-740318: starting the jobs and merging a pull request each take one click", async () => {
  const page = await openImplement({}, { files: await planned({ files: GATES }) });
  try {
    await page.script(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    assert.deepEqual(page.srv.writes, []);
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    assert.equal(startRecords(page).length, 2);
  } finally { page.done(); }
  const job = jobRecord();
  const merging = await openImplement({}, { files: await planned({ files: { ...GATES, [job.path]: job.text } }), pullRequests: [jobPull()] });
  try {
    await merging.script(found(merging.target, '[data-merge-pull="7"]')[0]);
    assert.deepEqual(merging.merges, []);
    await merging.press(found(merging.target, '[data-merge-pull="7"]')[0]);
    assert.equal(merging.merges.length, 1);
  } finally { merging.done(); }
});

// ---------------------------------------------------------------- refactoring

// TST-740319 · level: release · module: system
// guards: A REFACTORING JOB BEGINS WITHOUT A FAILING TEST; UC-024
// given: the pull request #7 of a refactor job on ITM-101 that changes src/store/index.mjs in two commits: both green (known positive); its first red
// input: the product's job check on each
// expect: the first passes; the second fails under A REFACTORING JOB BEGINS WITHOUT A FAILING TEST naming the red commit 1111111, and under no rule of a failing first test
test("TST-740319: a refactoring job passes only when CI is green on every one of its commits", async () => {
  const code = (ci) => [{ sha: FIRST, files: ["src/store/index.mjs"], ci }, { sha: SECOND, files: ["src/store/index.mjs"], ci: "success" }];
  assert.equal((await jobCheck({ kind: "refactor", commits: code("success") })).outcome, "done");
  const red = await jobCheck({ kind: "refactor", commits: code("failure") });
  assert.deepEqual(red.findings.map((each) => [each.rule, each.what]), [["A REFACTORING JOB BEGINS WITHOUT A FAILING TEST", "CI was not green on commit 1111111: its result is failure"]]);
});

// TST-740320 · level: release · module: system
// guards: A REFACTORING JOB CHANGES NO EXPECTED RESULT; UC-024
// given: the pull request #7 of a refactor job on ITM-101, all commits green, which modifies tests/store.test.mjs: once only adding an assertion (known positive), once changing assert.equal(1, 1) to assert.equal(1, 2), once changing the declared expect of TST-001
// input: the product's job check on each
// expect: adding an assertion passes; the changed assertion fails under A REFACTORING JOB CHANGES NO EXPECTED RESULT on tests/store.test.mjs; the changed expect fails under the same rule naming TST-001
test("TST-740320: a refactoring changes the expected result of no test", async () => {
  const commits = [{ sha: FIRST, files: ["src/store/index.mjs"], ci: "success" }, { sha: SECOND, files: ["src/store/index.mjs", "tests/store.test.mjs"], ci: "success" }];
  const at = (text) => ({ [`${"b".repeat(40)}:tests/store.test.mjs`]: STORE_TEST, [`${SECOND}:tests/store.test.mjs`]: text });
  const check = (text) => jobCheck({ kind: "refactor", commits, contents: at(text), modified: ["tests/store.test.mjs"] });
  assert.equal((await check(STORE_TEST.replace("  assert.equal(1, 1);\n", "  assert.equal(1, 1);\n  assert.ok(true);\n"))).outcome, "done");
  const changed = await check(STORE_TEST.replace("assert.equal(1, 1)", "assert.equal(1, 2)"));
  assert.deepEqual(changed.findings.map((each) => [each.rule, each.artifact]), [["A REFACTORING JOB CHANGES NO EXPECTED RESULT", "tests/store.test.mjs"]]);
  const expected = await check(STORE_TEST.replace("// expect: e", "// expect: something else"));
  assert.deepEqual(expected.findings.map((each) => [each.rule, /TST-001/.test(each.what)]), [["A REFACTORING JOB CHANGES NO EXPECTED RESULT", true]]);
});

// ---------------------------------------------------------------- the chapters

// TST-740321 · level: release · module: system
// guards: AN IMPLEMENTATION JOB RECEIVES THE CHAPTERS ON MODELING, DESIGN, IMPLEMENTATION AND TESTING; UC-024
// given: a V-model product, ITM-101 ready; the instance registers SRC-vibe-coding with its version 2026-10-05 and holds its chapter files
// input: the author opens Implement and presses Start jobs
// expect: what is sent for ITM-101 names the chapters 9, 11, 12 and 13 of the book by their files, and no other chapter; the start record's inputs list the same four chapter files
test("TST-740321: an implementation job is given chapters 9, 11, 12 and 13 of the book in full", async () => {
  const page = await openImplement({}, { files: await planned({ files: GATES }) });
  try {
    const sent = textOf(fieldOf(page, "ITM-101", "sent"));
    const chapters = [...sent.matchAll(/(\d{2})_[a-z-]+\.md/g)].map((match) => match[1]);
    assert.deepEqual(chapters, ["09", "11", "12", "13"]);
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    const record = startRecords(page).find((each) => /works_on:\n {2}- ITM-101\n/.test(each.text));
    assert.deepEqual([...record.text.matchAll(/^ {2}- (\d{2})_[a-z-]+\.md/gm)].map((match) => match[1]), ["09", "11", "12", "13"]);
  } finally { page.done(); }
});
