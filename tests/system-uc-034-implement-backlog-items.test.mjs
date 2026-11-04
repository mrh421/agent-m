// System coverage for UC-034 Implement backlog items with a coding agent, walked through the dashboard and the product's CI: the flow map (TST-805201) that names, for every step of the main flow, every alternative flow and the postcondition,
// the executable tests that walk it or the finding or the reason it is not walked, and the cases the older tests leave out — the ready items of a Scrum product of two teams and the reasons the others cannot start (steps 1, 2, 2a), the panel of
// each item with the participant of its team, where it processes data, what is sent and the gates it meets (step 3, 3a), Start jobs and the start records (step 4, 4a), the pull request an item's job opens (step 5), a failed job (6a),
// the gate a job waits at and who decides it within the job's role assignment (step 7, 7a, 7b) and Merge into the sprint's branch (step 8, 8a). The pages are the real routes `implement` of MOD-implementation-pages and `job` of MOD-main-page,
// MOD-runtimes' writer, MOD-product-process' gate records and MOD-workflow-entries' job check, behind the fakes of tests/uc-034-harness.mjs; no request leaves the process.
// Run: node --test tests/system-uc-034-implement-backlog-items.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-main-page
// Module: MOD-product-process
// Module: MOD-workflow-entries
// Guards: UC-034
// Level: system
//
// Authored by developer-sonnet-j (ITM-805). The `Agent-M-Participant` trailers of the code UC-034's flow runs name, in src/implementation-pages, src/product-process, src/main-page, src/workflow-entries, src/work-plans, src/run-planner, src/runtimes,
// src/job-ledger, src/job-runner and src/progress-measures, developer-opus-a, -b, -e and -f, developer-sonnet-a, -b, -c, -d, -e, -j and -k, developer-terra-a and -b, developer-sol-b and scrum-master-opus; most commits of it carry no trailer.
// developer-sonnet-j built, among the code the flow runs, ITM-817 (backlogFindings), ITM-1316 (the mark of a done item), ITM-1330 and ITM-1332 (the end of a sprint), ITM-1343 (the Needs cell of a gate on the progress page), ITM-1272 (waitingQueues),
// ITM-1368 (the plan page's findings) and ITM-1371 (the editor of a model names the products). RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER binds level release, so these system cases may walk that behaviour; the release file leaves the requirements
// they guard to the release tests other writers wrote or writes only what none of them built. Where the page and UC-034 disagree the case follows UC-034 and is marked `todo` with the word FINDING (named in FLOW_FINDINGS). Each case states its
// input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map, which holds the expected passages itself and checks that UC-034 still says them. A person's click
// is the page's own listener called with a trusted event; a script's click is `script`. Readings the texts leave open, which the cases state:
//   - "selects one or more *ready* items" (1) is read as the boxes of the ready items on Implement, which the page ticks on opening and the author may untick; "presses **Start sprint work**" is the link of each running sprint to Implement with that sprint's address.
//   - "counted per team in a model with sprints" (2) is read as the items in progress that the running sprint of the item's own team holds; an item of another team does not count against the limit.
//   - "the interfaces — not the code — of the modules they use" (3) is read as the `## Interfaces` section of each used module's file, named as the page names a part.
//   - "The job stays *queued*" (4a) is read as a start record committed that no Bridge has taken yet; the case checks what the page says of it.
//   - "The pull request names the item" (5.3) is read as the line `Backlog item:` of its description, which MOD-runtimes' writer writes.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { declarationSchema, productWorkflow, recordGateDecision, roleAssignmentSchema } from "../src/product-process/index.mjs";
import { routeStrategies, resumeJob } from "../src/runtimes/index.mjs";
import { recordsNewestFirst } from "../src/job-ledger/index.mjs";
import { routeOf } from "../src/site-frame/routing.mjs";
import { byClass } from "./main-page-home-harness.mjs";
import { GATE_JOB, MODELS, decision, ended, found, gateRecord, itemPath, itemText, jobPage, jobPull, jobProduct, jobRecord, lines, moduleText, openImplement, pr, quiet, servers, sprintPath, sprintText, startRecords, teams,
  testFileOf, textOf, waitingJob, walk } from "./uc-034-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-034-implement-backlog-items-with-a-coding-agent.md";
const SELF = "tests/system-uc-034-implement-backlog-items.test.mjs";
const IMPLEMENT = "tests/implementation-pages-implement.test.mjs", STORED = "tests/implementation-pages-implement-stored-view.test.mjs", STARTABLE = "tests/work-plans-startable.test.mjs";
const UC24 = "tests/system-uc-024-implement-the-architecture.test.mjs", UC32 = "tests/system-uc-032-maintain-the-backlog.test.mjs", UC24R = "tests/release-uc-024-implement-the-architecture.test.mjs";
const GATE_PAGE = "tests/main-page-job-gate.test.mjs", RECORD = "tests/product-process-record-gate.test.mjs", CHECK = "tests/workflow-entries-check-completed.test.mjs", RESUME = "tests/workflow-entries-resume-gate.test.mjs";
const TARGET = "tests/runtimes-pull-request-target.test.mjs", TARGET_RELEASE = "tests/release-itm-1171-target-branch.test.mjs", DONE = "tests/product-process-done.test.mjs", CLOSED = "tests/workflow-entries-item-pull-request-closed.test.mjs";
const BOOK = ["09_system-modeling.md", "11_agentic-design-and-control-patterns.md", "12_implementation-and-version-control.md", "13_software-testing.md"];
const day = (n) => `2026-10-${String(n).padStart(2, "0")}T09:00:00Z`;
const merged = (n, item) => pr(n, item, "merged", day(20), day(21));
const opened = (n, item) => pr(n, item, "open", day(22));
const register = (...rows) => lines("# Participants of this instance", "", "**REGISTER**", "", "The participants of the test instance.", "", "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |",
  "|---|---|---|---|---|---|---|---|", ...rows);
const BUILDS = "read the repository, write to the repository, run code and tests, use tools";
const builder = (name, model, place = "this machine", route = "ci hosted secret DEV_KEY") => `| ${name} | model endpoint | ${model} | 200000 | — | ${BUILDS} | ${place} | ${route} |`;
const assignment = (team, owner, builders) => lines(`# ${team}`, "", "## Roles", "", "| Role | Participants |", "|---|---|", `| Owner | ${owner} |`, `| Builders | ${builders} |`, `| Checker | ${builders} |`);
const tagged = (root, name) => walk(root, (node) => node.localName === name);
/** The rows of the page: { id -> { state, startable, text, reasons } }. */
const rowsOf = (page) => Object.fromEntries(found(page.target, "[data-item]").map((row) => [row.getAttribute("data-item"), { state: row.getAttribute("data-state"), startable: row.getAttribute("data-startable") === "true", text: textOf(row),
  reasons: found(row, "[data-reasons]").map(textOf), box: found(row, "[data-start-item]")[0] ?? null }]));
const ticked = (box) => box !== null && (box.checked === undefined ? box.getAttribute("checked") !== null : box.checked === true);
const holdersOf = (page, id) => found(page.target, `[data-participant-of="${id}"]`)[0]?.childNodes.map(textOf) ?? null;
const sentOf = (page, id) => textOf(found(page.target, `[data-sent="${id}"]`)[0]).replace(/ — SRC-vibe-coding 2026-10-05, version hash [0-9a-f]+/g, "");

// ---------------------------------------------------------------- the flow map

// The passages of UC-034 the system tests walk, each with the executable tests that walk it: this file's cases, and the older tests of the pages, of the gate and of the job check, which declare the level unit, component or system.
const FLOW_EVIDENCE = {
  "main-1-start-sprint-work": { uc: "or presses **Start sprint work** to select every ready item of the sprint.", evidence: [[SELF, "TST-805204"]] },
  "main-1-ready": { uc: "The author opens **Backlog** and selects one or more *ready* items", evidence: [[SELF, "TST-805202"], [IMPLEMENT, "TST-789001"], [UC24, "TST-740203"]] },
  "main-2-checks": { uc: "Agent M checks each item. It starts no job for an item when:", evidence: [[SELF, "TST-805205"], [STARTABLE, "TST-473191"], [UC32, "TST-803022"]] },
  "main-2-reasons": { uc: "For each item it cannot start, Agent M names the reason.", evidence: [[SELF, "TST-805205"], [SELF, "TST-805206"]] },
  "main-3-holders": { uc: "Agent M proposes one participant each from the holders of the implementing role in the item's role assignment", evidence: [[SELF, "TST-805207"], [IMPLEMENT, "TST-789004"]] },
  "main-3-sent": { uc: "what is sent: the item; the requirements and use cases it realises, and their existing tests;", evidence: [[SELF, "TST-805207"]] },
  "main-3-sent-item": { uc: "the item; the requirements and use cases it realises, and their existing tests;", evidence: [[SELF, "TST-805208"]] },
  "main-3-gates": { uc: "the gates the job will meet.", evidence: [[SELF, "TST-805207"], [SELF, "TST-805221"], [UC24, "TST-740210"]] },
  "main-3-pick": { uc: "The author may pick another holder of the role. They press **Start jobs**: one click.", evidence: [[SELF, "TST-805209"], [IMPLEMENT, "TST-789005"]] },
  "main-4-record": { uc: "Agent M queues one job per item, commits its start record under `docs/jobs/` of the product, and", evidence: [[SELF, "TST-805209"], [UC24, "TST-740210"]] },
  "main-5-failing-tests": { uc: "The agent commits the tests, and CI records them as **failing**.", evidence: [[UC24, "TST-740213"], [DONE, "TST-409101"]] },
  "main-5-pull-request": { uc: "It pushes and opens a pull request. The pull request names the item, the requirements it", evidence: [[SELF, "TST-805212"]] },
  "main-5-pull-request-names": { uc: "The pull request names the item, the requirements it", evidence: [[SELF, "TST-805213"]] },
  "main-6-red": { uc: "CI runs. On red, the agent reads the failure and repairs it", evidence: [[UC24, "TST-740215"]] },
  "main-7-gate": { uc: "it stops in the state **waiting at a gate** until the gate's decider has decided:", evidence: [[SELF, "TST-805215"], [GATE_PAGE, "TST-801001"], [RESUME, "TST-479153"]] },
  "main-7-check": { uc: "an **automated check** runs in CI; its result is the decision;", evidence: [[SELF, "TST-805217"], [CHECK, "TST-792001"]] },
  "main-7-agent": { uc: "an **agent** holding the deciding role, in a session of its own, examines the artifacts and records its decision", evidence: [[SELF, "TST-805219"], [RECORD, "TST-785001"]] },
  "main-7-person": { uc: "presses **Pass gate**: one click.", evidence: [[SELF, "TST-805215"], [GATE_PAGE, "TST-801002"]] },
  "main-7-team": { uc: "The deciding role is the one held in the job's role assignment", evidence: [[SELF, "TST-805216"], [GATE_PAGE, "TST-801003"]] },
  "main-7-record": { uc: "The gate record — who or what decided, when, on which text — is committed,", evidence: [[SELF, "TST-805215"], [SELF, "TST-805219"], [RESUME, "TST-479151"]] },
  "main-8-merge": { uc: "the pull request is merged: by the coding agent, or by a person, as the", evidence: [[SELF, "TST-805220"], [UC24, "TST-740219"], [UC24, "TST-740213"]] },
  "main-8-branch": { uc: "It goes into the default branch, or into the sprint's branch", evidence: [[SELF, "TST-805220"], [TARGET, "TST-1171001"], [TARGET_RELEASE, "TST-1171101"]] },
  "main-8-issue": { uc: "For an item", evidence: [[CLOSED, "TST-1375101"]] },
  "1a-plan": { uc: "**1a. The product works from a plan (V-model, waterfall, reuse-oriented).**", evidence: [[UC24, "TST-740202"], [UC24, "TST-740204"]] },
  "2a-none": { uc: "**2a. No item can be started.**", evidence: [[SELF, "TST-805206"]] },
  "4a-queued": { uc: "**4a. The bridge or the runner does not answer.**", evidence: [[SELF, "TST-805211"]] },
  "3a-restricted": { uc: "**3a. No holder of the role can receive an item's content.**", evidence: [[SELF, "TST-805210"], [UC24, "TST-740209"]] },
  "5c-module": { uc: "**5c. The item needs a change to a module it does not name.**", evidence: [[UC32, "TST-803011"], [UC32, "TST-803015"]] },
  "6a-failed": { uc: "**6a. CI stays red after the retry limit.**", evidence: [[SELF, "TST-805214"]] },
  "7a-rejects": { uc: "**7a. The gate's decider rejects.**", evidence: [[SELF, "TST-805218"]] },
  "7b-self": { uc: "**7b. The coding agent itself writes a gate record**", evidence: [[SELF, "TST-805219"], [UC24, "TST-740218"], [RESUME, "TST-479152"]] },
  "8a-branch": { uc: "**8a. The sprint has a branch of its own.**", evidence: [[SELF, "TST-805220"], [TARGET_RELEASE, "TST-1171101"]] },
  "postcondition-done": { uc: "It is either merged on green", evidence: [[SELF, "TST-805220"], [UC24, "TST-740221"]] },
  "postcondition-gate": { uc: "No job has continued past a gate without its decider's recorded decision.", evidence: [[SELF, "TST-805215"], [SELF, "TST-805216"], [RESUME, "TST-479153"]] },
};
// The passages the dashboard does otherwise: the finding, its case, and the item that points to or the person who rules.
const FLOW_FINDINGS = {};
// The alternative flows no dashboard or CI code of this product carries, with the reason; what the participant itself does is not a page's.
const NOT_WALKED = {
  "4a-down": { uc: "**4a. The bridge or the runner does not answer.**", why: "the author's cancel and reassign are UC-036's: tests/main-page-job-retry.test.mjs and the cases of the job page walk them" },
  "5a-tests-pass": { uc: "**5a. The tests pass before any implementation.**", why: "the participant's work is not the dashboard's; the check of the pull request fails it (UC-024 8a, TST-740214), and no code stops the job in waiting at a gate for the author for it" },
  "5b-contradiction": { uc: "**5b. The agent finds that the item contradicts the specification or leaves a case open.**", why: "the agent stops and proposes a specification change; its change is a conversation of UC-012 and UC-049, not a page of this use case" },
  "6b-same-files": { uc: "**6b. Two jobs touch the same files.**", why: "the rebase and the stop in waiting at a gate on a conflict are the participant's git work; the disjoint modules of different teams' sprints are UC-032's: TST-803011" },
};

// TST-805201 · level: system · module: system
// guards: UC-034
// given: UC-034 as committed text, the executable tests named in FLOW_EVIDENCE, the findings named in FLOW_FINDINGS and the flows named in NOT_WALKED
// input: compare every passage of the main flow, steps 1 to 8, of the alternative flows and of the postcondition with its executable evidence, its finding or the reason it is not walked
// expect: every named passage stands in UC-034; every evidence file exists and declares its TST id; this file's cases declare the level system; every finding's case stands in its file with the todo naming FINDING and its module; every alternative flow UC-034 names is among the passages; known positive: UC-034 names exactly the thirteen alternative flows 1a, 2a, 3a, 4a, 5a, 5b, 5c, 6a, 6b, 7a, 7b and 8a (twelve; 4a once) and each of the eight main steps has a passage
test("TST-805201: UC-034 every passage of the main flow and of each alternative flow has an executable test, a finding or a stated reason", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  const missing = [];
  for (const [name, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-034 says "${needle}"`);
    assert.ok(evidence.length > 0, `${name}: a test is named`);
    for (const [file, id] of evidence) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      if (!declared) missing.push(`${name}: ${id} in ${file}`);
      else if (file === SELF) assert.equal(declared.level, "system", `${id} is a system test`);
    }
  }
  assert.deepEqual(missing, [], "every evidence test is declared in its file");
  for (const [name, { uc: needle, finding, file, test: id, module }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-034 says "${needle}"`);
    assert.ok(read(file).includes(`// ${id} `), `${name}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} (${module})`), `${name}: the todo of ${id} names FINDING ${finding} and ${module}`);
  }
  for (const [name, { uc: needle }] of Object.entries(NOT_WALKED)) assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-034 says "${needle}"`);
  const flows = [...uc.matchAll(/- \*\*(\d+[a-z])\. /g)].map((match) => match[1]).sort();
  assert.deepEqual(flows, ["1a", "2a", "3a", "4a", "5a", "5b", "5c", "6a", "6b", "7a", "7b", "8a"], "known positive: UC-034 names these twelve alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS, ...NOT_WALKED }).map((key) => key.split("-")[0]));
  assert.deepEqual(flows.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
  const steps = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).filter((key) => key.startsWith("main-")).map((key) => Number(key.split("-")[1])));
  assert.deepEqual([...steps].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8], "each step of the main flow is among the passages");
});

// ---------------------------------------------------------------- steps 1 and 2

// TST-805202 · level: system · module: system
// guards: UC-034; AGILE IMPLEMENTATION STARTS FROM THE BACKLOG; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the Scrum product of two teams: team1's running sprint 02 selects ITM-001 (its pull request merged), ITM-002 (a pull request open) and ITM-003 (ready); team2's running sprint 01 selects ITM-011 (ready); ITM-005 is ready and in no sprint; the person's token is stored
// input: the author opens Implement
// expect: step 1: the page says the model works from a backlog and links the backlog (#backlog); the rows are backlog items, no plan step; ITM-001, which is done, is not listed; ITM-003 and ITM-011 are ready and startable and their boxes are ticked, ITM-002 is in progress and ITM-005 ready and neither can be ticked; nothing is written and no state is stored in an item file
test("TST-805202: UC-034 1 the ready items of the teams' running sprints are listed with their derived states and ticked, and nothing is written", async () => {
  const world = await teams();
  const page = await openImplement({}, { ...world, pullRequests: [merged(1, "ITM-001"), opened(2, "ITM-002")] });
  try {
    assert.match(textOf(page.target), /This model works from a backlog: open the backlog/);
    assert.ok(tagged(page.target, "a").some((link) => link.getAttribute("href") === "#backlog"));
    assert.equal(found(page.target, "[data-step]").length, 0, "no plan step");
    const rows = rowsOf(page);
    assert.equal(rows["ITM-001"], undefined, "a done item is not listed");
    assert.deepEqual([rows["ITM-003"].state, rows["ITM-003"].startable, ticked(rows["ITM-003"].box)], ["ready", true, true]);
    assert.deepEqual([rows["ITM-011"].state, rows["ITM-011"].startable, ticked(rows["ITM-011"].box)], ["ready", true, true]);
    assert.deepEqual([rows["ITM-002"].state, rows["ITM-002"].startable, rows["ITM-002"].box], ["in progress", false, null]);
    assert.deepEqual([rows["ITM-005"].state, rows["ITM-005"].startable, rows["ITM-005"].box], ["ready", false, null]);
    for (const [path, text] of Object.entries(world.files)) if (path.startsWith("docs/backlog/ITM-")) assert.doesNotMatch(text, /^(state|status):/m, `${path} stores no state`);
    assert.deepEqual(page.srv.writes, []);
  } finally { page.done(); }
});

// TST-805203 · level: system · module: system
// guards: UC-034; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT
// given: the product of TST-805202
// input: the author opens Implement with the address #implement/sprint=team1/02, the address of one sprint's work
// expect: step 1: only the items team1's sprint 02 selects are listed — ITM-002 and ITM-003, and ITM-001 not as it is done —; ITM-011 of team2's sprint and ITM-005 of no sprint are not
test("TST-805203: UC-034 1 the address of a sprint lists only the items its selection holds", async () => {
  const page = await openImplement({ sprint: "team1/02" }, { ...await teams(), pullRequests: [merged(1, "ITM-001"), opened(2, "ITM-002")] });
  try {
    assert.deepEqual(Object.keys(rowsOf(page)), ["ITM-002", "ITM-003"]);
  } finally { page.done(); }
});

// TST-805204 · level: system · module: system
// guards: UC-034
// given: the product of TST-805202; the page of the backlog and the page of the progress, which show each team's running sprint
// input: look on both for the control UC-034 step 1 names, *Start sprint work*
// expect: step 1: on each page a link or button named Start sprint work for every running sprint, two — team1/02 and team2/01, as Change the selection counts two — and the frame reads the address of each as the route implement with that sprint, team1/02 and team2/01 (the slash of the sprint name is encoded, as the frame splits an address at every slash)
test("TST-805204: UC-034 1 Start sprint work leads from the sprint to Implement with every ready item of its selection",
  async () => {
    const world = await teams();
    for (const name of ["backlog", "progress"]) {
      const { open } = await import("./uc-032-harness.mjs");
      const page = await open(name, {}, { files: world.files, pullRequests: [merged(1, "ITM-001"), opened(2, "ITM-002")] });
      try {
        const controlsOf = (pattern) => walk(page.target, (node) => ["a", "button"].includes(node.localName) && pattern.test(textOf(node).trim()));
        assert.equal(controlsOf(/^Change the selection$/).length, 2, `known positive: ${name} offers a control of each running sprint, Change the selection`);
        const controls = controlsOf(/^Start sprint work$/);
        assert.equal(controls.length, 2, `${name}: a control named Start sprint work for each running sprint`);
        assert.deepEqual(controls.map((control) => routeOf(control.getAttribute("href"))), [
          { name: "implement", params: { sprint: "team1/02" } }, { name: "implement", params: { sprint: "team2/01" } }], `${name}: the frame reads each address as Implement for that sprint`);
      } finally { page.done(); }
    }
  });

// TST-805205 · level: system · module: system
// guards: UC-034; NO JOB STARTS ABOVE THE WORK-IN-PROGRESS LIMIT; A TIME BOX WORKS ONLY ON WHAT WAS SELECTED FOR IT; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED
// given: the product of TST-805202 with a work-in-progress limit of 2; team1's sprint 02 selects ITM-001 (merged), ITM-002 (a pull request open), ITM-005 (a pull request open), ITM-003 (ready), ITM-004 (builds on ITM-003, which is not done) and ITM-006 (realises RULE NOT ACCEPTED, which no approval record names); ITM-008 is in no sprint; team2's sprint holds ITM-011
// input: the author opens Implement
// expect: step 2: ITM-003 cannot start — the limit of 2 is reached under team1 by ITM-002 and ITM-005, named; ITM-004 cannot start — it builds on ITM-003, which is not done; ITM-006 cannot start — RULE NOT ACCEPTED is not accepted; ITM-008 cannot start — it is not selected for team1/02, the current sprint of team1; ITM-011 of team2 starts, the limit counted per team; each non-startable row names its reason and offers no box
test("TST-805205: UC-034 2 an item that is not selected, not accepted, built on an item not done or over the limit of its team is not started, and each reason is named", async () => {
  const world = await teams({ files: { [sprintPath("team1", 2)]: sprintText({ n: 2, goal: "Store and show", selection: ["ITM-001", "ITM-002", "ITM-005", "ITM-003", "ITM-004", "ITM-006"], branch: "sprint/team1/02" }) } });
  const page = await openImplement({}, { ...world, pullRequests: [merged(1, "ITM-001"), opened(2, "ITM-002"), opened(5, "ITM-005")] });
  try {
    const rows = rowsOf(page);
    const why = (id) => rows[id].reasons.join(" | ");
    assert.equal(rows["ITM-003"].startable, false);
    assert.match(why("ITM-003"), /work-in-progress limit of 2 is reached under team1/);
    assert.match(why("ITM-003"), /ITM-002/);
    assert.match(why("ITM-003"), /ITM-005/);
    assert.match(why("ITM-004"), /ITM-004 builds on ITM-003 is not done/);
    assert.match(why("ITM-006"), /ITM-006 realises RULE NOT ACCEPTED is not accepted/);
    assert.match(why("ITM-008"), /ITM-008 is not selected for team1\/02, the current sprint of team1\./);
    for (const id of ["ITM-003", "ITM-004", "ITM-006", "ITM-008"]) assert.equal(rows[id].box, null, `${id} offers no box`);
    assert.deepEqual([rows["ITM-011"].startable, ticked(rows["ITM-011"].box)], [true, true], "team2's item starts: the limit is counted per team");
    assert.deepEqual(page.srv.writes, []);
  } finally { page.done(); }
});

// TST-805206 · level: system · module: system
// guards: UC-034
// given: the product whose only running sprint, team1's 02, selects ITM-004 (builds on ITM-003, which is not selected and not done) and ITM-006 (realises a requirement no approval record names); team2 runs no sprint
// input: the author opens Implement and presses Start jobs
// expect: 2a: every item is listed with its reason, none has a box or a participant; the page says nothing was ticked and nothing starts; no start record is committed
test("TST-805206: UC-034 2a when no item can be started each is listed with its reason and nothing starts", async () => {
  const world = await teams({ files: { [sprintPath("team1", 2)]: sprintText({ n: 2, goal: "Waiting", selection: ["ITM-004", "ITM-006"], branch: "sprint/team1/02" }), [sprintPath("team2", 1)]: null } });
  const page = await openImplement({}, { ...world, pullRequests: [] });
  try {
    const rows = rowsOf(page);
    assert.equal(Object.values(rows).filter((row) => row.startable).length, 0);
    assert.ok(Object.values(rows).every((row) => row.reasons.length > 0), "each item names a reason");
    assert.equal(found(page.target, "[data-participant-of]").length, 0);
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    assert.match(textOf(found(page.target, "[data-start-result]")[0]), /No startable item is ticked: nothing starts\./);
    assert.deepEqual(startRecords(page), []);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- step 3

/** The product with the code the panel's parts come from: MOD-pages (follows ARC-002, uses MOD-store.read) and MOD-store, their code and tests; team1's ITM-002 (MOD-pages, builds on ITM-001) ready. */
const withCode = () => ({
  "docs/architecture/ARC-002-storage.md": decision("ARC-002", "Storage", ["refines: ARC-001", "forced_by:", "  - UC-001", "designs:", "  - MOD-store", "  - MOD-pages"]),
  "docs/architecture/MOD-store.md": moduleText("MOD-store", [], "ARC-002"), "docs/architecture/MOD-pages.md": moduleText("MOD-pages", ["MOD-store.read"], "ARC-002"),
  "src/store/index.mjs": "export const read = () => 1;\n", "tests/store.test.mjs": testFileOf("MOD-store", "TST-001"), "src/pages/index.mjs": "export const page = 1;\n", "tests/pages.test.mjs": testFileOf("MOD-pages", "TST-002"),
});

// TST-805207 · level: system · module: system
// guards: UC-034; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; THE PAGE NAMES WHERE IT SENDS; DEVELOP AGAINST INTERFACES; AN IMPLEMENTATION JOB RECEIVES THE CHAPTERS ON MODELING, DESIGN, IMPLEMENTATION AND TESTING
// given: the product of TST-805202 with MOD-pages (ARC-002, using MOD-store.read), MOD-store, their code and tests; team1's role assignment names dev-a as its builder, team2's names dev-b; ITM-001 merged, ITM-002 (MOD-pages) and ITM-011 (MOD-news) ready
// input: the author opens Implement and reads the panel of ITM-002 and of ITM-011
// expect: step 3: ITM-002 offers dev-a alone and ITM-011 dev-b alone, each "processes data at this machine" with the route ci hosted; each names its sprint's branch (sprint/team1/02, sprint/team2/01), the gate Building → Checking decided by Owner, the attempt limit 5 and the choice who merges; what is sent to dev-a for ITM-002: the item's file, UC-001 and the two test files that guard RULE ONE, then MOD-pages.md, ARC-002 and ARC-001, SPEC.md, "docs/architecture/MOD-store.md ## Interfaces" and not MOD-store's whole file or its code src/store/index.mjs, then its code, then the instance's SPEC.md as the process requirements, then chapters 9, 11, 12 and 13; nothing is sent before Start jobs
test("TST-805207: UC-034 3 each item's panel names the participant of its team, where it processes data, the branch, the gates and what is sent: files, decisions, the interfaces of used modules and the chapters", async () => {
  const world = await teams({ files: withCode() });
  const page = await openImplement({}, { ...world, pullRequests: [merged(1, "ITM-001")] });
  try {
    assert.deepEqual(holdersOf(page, "ITM-002"), ["dev-a"]);
    assert.deepEqual(holdersOf(page, "ITM-011"), ["dev-b"]);
    const rows = rowsOf(page);
    assert.match(rows["ITM-002"].text, /dev-a processes data at this machine; routes: ci hosted/);
    assert.match(rows["ITM-011"].text, /dev-b processes data at this machine; routes: ci hosted/);
    assert.deepEqual(found(page.target, '[data-merges-of="ITM-002"]')[0].childNodes.map(textOf), ["the coding agent", "a person"]);
    assert.match(rows["ITM-002"].text, /Attempt limit: 5\. Merges: .* Target branch: sprint\/team1\/02\. Gates: Building → Checking \(decided by Owner\)\./);
    assert.match(rows["ITM-011"].text, /Target branch: sprint\/team2\/01\. Gates: Building → Checking \(decided by Owner\)\./);
    const sent = sentOf(page, "ITM-002");
    assert.match(sent, /^dev-a at this machine: /);
    assert.deepEqual(sent.replace(/^dev-a at this machine: /, "").replace(/Correction rounds: at most \d+$/, "").split(", "), ["docs/backlog/ITM-002-item-2.md", "docs/use-cases/UC-001-load.md", "tests/pages.test.mjs", "tests/store.test.mjs",
      "docs/architecture/MOD-pages.md", "docs/architecture/ARC-002-storage.md", "docs/architecture/ARC-001-the-whole.md", "SPEC.md", "docs/architecture/MOD-store.md ## Interfaces", "src/pages/index.mjs", "SPEC.md process requirements", ...BOOK]);
    assert.ok(!sent.includes("src/store/index.mjs"), "the code of a module it uses is not sent");
    assert.deepEqual(page.srv.writes, []);
  } finally { page.done(); }
});

// TST-805208 · level: system · module: system
// guards: UC-034
// given: the product of TST-805207, in which ITM-002 realises RULE ONE, which tests/pages.test.mjs guards, and the instance's SPEC holds its process requirements
// input: the author opens Implement and reads what is sent to dev-a for ITM-002
// expect: step 3 "the item; the requirements and use cases it realises, and their existing tests; ... the process requirements that apply": the item's file docs/backlog/ITM-002-item-2.md, the use case UC-001 it realises, and the test file that guards RULE ONE are among the parts
test("TST-805208: UC-034 3 what is sent holds the item, the requirements and use cases it realises with their existing tests, and the process requirements",
  async () => {
    const world = await teams({ files: withCode() });
    const page = await openImplement({}, { ...world, pullRequests: [merged(1, "ITM-001")] });
    try {
      const parts = sentOf(page, "ITM-002").replace(/^dev-a at this machine: /, "").split(", ");
      assert.ok(parts.includes("SPEC.md") && parts.includes("src/pages/index.mjs"), "known positive: the list names the SPEC and the module's code");
      for (const expected of ["docs/backlog/ITM-002-item-2.md", "docs/use-cases/UC-001-load.md", "tests/pages.test.mjs"]) assert.ok(parts.includes(expected), `${expected} is sent`);
      assert.ok(parts.some((part) => /process requirements/i.test(part)), "the process requirements that apply are sent");
    } finally { page.done(); }
  });

// TST-805209 · level: system · module: system
// guards: UC-034; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; ONE CLICK PER DECISION; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; ONE DEFINITION, THREE DRIVERS
// given: the product of TST-805207 in which team1's role assignment names dev-a and dev-b as builders; ITM-002 and ITM-011 ready and ticked; the author's token stored
// input: the author picks dev-b for ITM-002 and the person who merges; a script's click on Start jobs; then the author's click
// expect: steps 3 and 4: the script's click writes nothing; the author's one click commits one start record per ticked item under docs/jobs/ — ITM-002's naming dev-b, the route ci hosted, the kind implement, the item in its works_on and the person as who merges; ITM-003's naming dev-a, the first holder; and ITM-011's naming dev-b of team2 —, each with the token the author stored; the page names each job and its record, and the panel followed the choice
test("TST-805209: UC-034 3, 4 the author may pick another holder, and one click commits one start record per item with the inputs the panel named", async () => {
  const world = await teams({ files: { ...withCode(), "docs/role-assignments/team1.md": assignment("team1", "alice", "dev-a, dev-b") } });
  const page = await openImplement({}, { ...world, pullRequests: [merged(1, "ITM-001")] });
  try {
    assert.deepEqual(holdersOf(page, "ITM-002"), ["dev-a", "dev-b"]);
    const sentBefore = sentOf(page, "ITM-002");
    const chosen = found(page.target, '[data-participant-of="ITM-002"]')[0];
    chosen.value = "dev-b";
    chosen.dispatchEvent(new Event("change"));
    found(page.target, '[data-merges-of="ITM-002"]')[0].value = "person";
    await quiet();
    assert.match(sentOf(page, "ITM-002"), /^dev-b at this machine: /);
    await page.script(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    assert.deepEqual(page.srv.writes, [], "a script's click writes nothing");
    await page.press(found(page.target, "[data-start-jobs]")[0]);
    await quiet();
    const records = startRecords(page);
    assert.equal(records.length, 3, "one start record per ticked item");
    const of = (item) => records.find((record) => new RegExp(`works_on:\\n  - ${item}\\n`).test(record.text));
    assert.match(of("ITM-002").text, /^participant: dev-b$/m);
    assert.match(of("ITM-002").text, /"merges": "person"/);
    assert.match(of("ITM-003").text, /^participant: dev-a$/m);
    assert.match(of("ITM-011").text, /^participant: dev-b$/m);
    for (const record of records) {
      assert.match(record.text, /^kind: implement$/m);
      assert.match(record.text, /^route: ci hosted$/m);
      assert.match(record.path, /^docs\/jobs\/JOB-\d{8}-\d{4}-[0-9a-f]{4}\.md$/);
    }
    assert.ok(page.log.filter((each) => each.repository === "alice/thesis-tool").every((each) => each.authorization === "Bearer github_pat_HARNESS0123456789abcdefghij"));
    const result = textOf(found(page.target, "[data-start-result]")[0]);
    assert.match(result, /ITM-002: job JOB-[^ ]+ \(docs\/jobs\/JOB-[^)]+\.md\) is queued on the route ci hosted\./);
    assert.match(result, /ITM-003: job JOB-[^ ]+ \(docs\/jobs\/JOB-[^)]+\.md\) is queued on the route ci hosted\./);
    assert.match(result, /ITM-011: job JOB-[^ ]+ \(docs\/jobs\/JOB-[^)]+\.md\) is queued on the route ci hosted\./);
    assert.notEqual(sentBefore, sentOf(page, "ITM-002"), "the panel followed the choice");
  } finally { page.done(); }
});

// TST-805210 · level: system · module: system
// guards: UC-034; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the instance registers SRC-letters, restricted, permitting only "this machine", whose content the product keeps in docs/sources/SRC-letters/; the module MOD-mail keeps its letters there; team1's builders dev-a, at "a provider in the USA", and dev-c, at this machine, both hold Builders; team2's builder dev-b is at this machine; ITM-003 changes MOD-mail, ITM-002 changes MOD-pages
// input: the author opens Implement; then the same product whose only builder of team1 is dev-a
// expect: step 3 and 3a: ITM-003, whose job includes the content of SRC-letters, offers dev-c alone and names dev-a with SRC-letters and its place a provider in the USA; ITM-002, whose job includes none of it, offers dev-a and dev-c; where dev-a is the only builder, ITM-003 is not started: the page says no holder of the implementing role is at a place the linked sources permit, and names SRC-letters, dev-a and the place
test("TST-805210: UC-034 3a a holder at a place a source forbids is not offered for an item that includes its content, and where none is left the item is not started and the source is named", async () => {
  const letters = lines("---", "id: SRC-letters", "title: The letters", "kind: document", "authority: normative", "licence: restricted - the senders' terms", "places:", "  - this machine",
    "content_repository: https://github.com/alice/thesis-tool", "---", "# SRC-letters The letters", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| `1` | 2026-10-13 | fixture | here | one file |");
  const mail = moduleText("MOD-mail", [], "ARC-001").replace("folder: src/mail/", "folder: docs/sources/SRC-letters/");
  const files = (builders) => ({ "docs/role-assignments/team1.md": assignment("team1", "alice", builders), "docs/sources/SRC-letters/1/letter.md": "Dear reader.\n", "docs/architecture/MOD-mail.md": mail,
    "docs/participants.md": register(builder("dev-a", "model-c", "a provider in the USA"), builder("dev-b", "model-d"), builder("dev-c", "model-e")) });
  const both = await teams({ files: files("dev-a, dev-c"), over: { "docs/sources/SRC-letters.md": letters } });
  const page = await openImplement({}, { ...both, pullRequests: [merged(1, "ITM-001")] });
  try {
    assert.deepEqual(holdersOf(page, "ITM-003"), ["dev-c"]);
    const withheld = textOf(found(page.target, '[data-withheld-of="ITM-003"]')[0]);
    for (const word of [/dev-a/, /SRC-letters/, /a provider in the USA/]) assert.match(withheld, word);
    assert.deepEqual(holdersOf(page, "ITM-002"), ["dev-a", "dev-c"]);
    assert.equal(found(page.target, '[data-withheld-of="ITM-002"]').length, 0);
  } finally { page.done(); }
  const alone = await teams({ files: files("dev-a"), over: { "docs/sources/SRC-letters.md": letters } });
  const none = await openImplement({}, { ...alone, pullRequests: [merged(1, "ITM-001")] });
  try {
    assert.equal(holdersOf(none, "ITM-003"), null, "no participant is offered");
    const said = textOf(found(none.target, '[data-item="ITM-003"]')[0]);
    assert.match(said, /No holder of the implementing role is at a place the linked sources permit for this job\./);
    for (const word of [/SRC-letters/, /dev-a/, /a provider in the USA/]) assert.match(said, word);
    await none.press(found(none.target, "[data-start-jobs]")[0]);
    await quiet();
    assert.ok(startRecords(none).every((record) => !/works_on:\n {2}- ITM-003\n/.test(record.text)), "no job is started for ITM-003");
  } finally { none.done(); }
});

// ---------------------------------------------------------------- step 4, 4a

// TST-805211 · level: system · module: system
// guards: UC-034; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; THE LOCAL BRIDGE REQUIRES A TOKEN
// given: the product of TST-805202 in which team1's builder dev-a is a CLI agent reached through the Bridge lab-pc, which this browser has a connection to, at an address that answers nothing; ITM-003 ready and ticked, ITM-011 ticked for dev-b on CI
// input: the author presses Start jobs
// expect: 4a "The job stays queued. Agent M says which route is down": the start record of ITM-003 is committed under docs/jobs/ (the job is queued) and the result names ITM-003's job and the route bridge lab-pc as the one that did not answer, and does not say that nothing was started for it; ITM-011's job on CI is queued on ci hosted
test("TST-805211: UC-034 4a a Bridge that does not answer leaves the job queued, and the page says which route is down",
  async () => {
    const cli = `| dev-a | CLI agent | model-c | 200000 | — | ${BUILDS} | this machine | bridge lab-pc agent claude |`;
    const settings = { "bridge:lab-pc": JSON.stringify({ address: "http://127.0.0.1:4799", token: "pairing-token" }) };
    const world = await teams({ files: { "docs/participants.md": register(cli, builder("dev-b", "model-d")) } });
    const page = await openImplement({}, { ...world, pullRequests: [merged(1, "ITM-001")], store: { prefix: "", storage: { getItem: (key) => settings[key] ?? null } } });
    try {
      await page.press(found(page.target, "[data-start-jobs]")[0]);
      await quiet();
      const records = startRecords(page);
      const queued = records.find((record) => /works_on:\n {2}- ITM-003\n/.test(record.text));
      assert.ok(queued, "the start record of ITM-003 is committed: the job is queued");
      assert.match(queued.text, /^route: bridge lab-pc$/m);
      const result = textOf(found(page.target, "[data-start-result]")[0]);
      assert.match(result, /ITM-011: job JOB-[^ ]+ \(docs\/jobs\/JOB-[^)]+\.md\) is queued on the route ci hosted\./);
      assert.match(result, /ITM-003/);
      assert.match(result, /lab-pc/);
      assert.doesNotMatch(result, /ITM-003:[^.]*nothing was started for it/, "the page does not say that nothing was started for a job whose record it committed");
    } finally { page.done(); }
  });

// ---------------------------------------------------------------- step 5

const JOB = "JOB-20261101-0900-a1b2";
const ISSUE = "https://github.com/alice/thesis-tool/issues/14";
/** A tree as a job's snapshot or a branch: `files` by path, the blob of a path the text behind a prefix. */
const treeOf = (commit, files) => ({ commit, paths: Object.keys(files).sort(), read: async (path) => files[path] ?? null, blob: (path) => (path in files ? `blob:${files[path]}` : null) });
/** The writer branch-and-pull-request run for the job JOB of dev-a on the item ITM-003, whose branch adds tests/mail.test.mjs (TST-003 guarding RULE ONE, exercising MOD-mail); -> the pull request opened. */
async function writtenFor(files) {
  const branchFiles = { ...files, "src/mail/index.mjs": "export const read = 1;\n", "tests/mail.test.mjs": testFileOf("MOD-mail", "TST-003") };
  const calls = [];
  const host = {
    async readSnapshot(ref) { if (ref !== JOB) throw Object.assign(new Error("not found"), { name: "NotFound" }); return treeOf("c1", branchFiles); },
    async listPullRequests() { return []; },
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async openPullRequest(request) { calls.push(request); return { number: 9, url: "https://github.com/alice/thesis-tool/pull/9", branch: request.branch, base: request.base, state: "open" }; },
  };
  const context = { kind: { name: "implement" }, params: { items: ["ITM-003"], merges: "agent" }, product: { address: "https://github.com/alice/thesis-tool", snapshot: treeOf("c0", files), host },
    instance: { snapshot: treeOf("i0", {}), host: null }, connect: async () => host, participants: [], places: { sources: {}, mailbox: null }, gates: [], person: "alice", now: new Date("2026-11-01T10:00:00Z"),
    agentM: { version: "2026.11.0", commit: "a".repeat(40) }, jobId: JOB };
  const result = { draft: { branch: JOB, commits: ["c1"], pullRequest: "" }, raw: null, drafter: { name: "dev-a", model: "model-c" }, rounds: [{}, {}], remaining: [], forPerson: [], stepFindings: [], classes: null,
    stoppedBecause: "passed", gate: null, usage: [], written: null };
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("the writer must reach the server only through the host"); };
  try { await routeStrategies.writers["branch-and-pull-request"](result, context); } finally { globalThis.fetch = realFetch; }
  return calls[0];
}

// TST-805212 · level: system · module: system
// guards: UC-034; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN
// given: the product of TST-805202 with MOD-mail and its item ITM-003 (realises RULE ONE) in team1's running sprint 02 on the branch sprint/team1/02; the job JOB-20261101-0900-a1b2 of dev-a (model-c) after two correction rounds, whose branch adds src/mail/index.mjs and tests/mail.test.mjs (TST-003, guarding RULE ONE, exercising MOD-mail); no pull request of the branch yet
// input: the writer branch-and-pull-request of the route strategies, after the agent's push
// expect: step 5.3: one pull request is opened from the branch of the job into sprint/team1/02, titled with the job, the kind and the item; its description names the job, the kind implement, the line "Backlog item: ITM-003", "Modules: MOD-mail", "Requirements guarded by the new tests: RULE ONE" and the provenance — the Agent M version 2026.11.0 with its commit, the participant dev-a and the model model-c; it holds no instruction
test("TST-805212: UC-034 5 the agent's pull request goes into the sprint's branch and names the job, the item, its module, the requirement its tests guard and the version, participant and model", async () => {
  const { files } = await teams();
  const request = await writtenFor(files);
  assert.equal(request.branch, JOB);
  assert.equal(request.base, "sprint/team1/02");
  assert.equal(request.title, `${JOB}: implement ITM-003`);
  const lines = request.body.split("\n");
  for (const line of [`Job: ${JOB}`, "Kind: implement", "Backlog item: ITM-003", "Modules: MOD-mail", "Requirements guarded by the new tests: RULE ONE", `Agent-M-Version: 2026.11.0, commit ${"a".repeat(40)}`, "Agent-M-Participant: dev-a",
    "Agent-M-Model: model-c"]) assert.ok(lines.includes(line), `the description holds "${line}"`);
});

// TST-805213 · level: system · module: system
// guards: UC-034; EVERY ARTIFACT NAMES ITS ORIGIN
// given: the product of TST-805212 in which ITM-003 realises RULE TWO (not RULE ONE, which its new test guards) and comes from the issue https://github.com/alice/thesis-tool/issues/14, named among its origins (UC-033)
// input: the same writer on the same branch
// expect: step 5.3 "The pull request names the item, the requirements it realises and, for an item from an issue, the issue": the description names RULE TWO, which the item realises, and the issue
test("TST-805213: UC-034 5 the pull request names the requirements the item realises and the issue the item comes from",
  async () => {
    const { files } = await teams({ files: { [itemPath(3)]: itemText(3, { modules: ["MOD-mail"], realises: ["RULE TWO"], origin: [ISSUE] }) } });
    const body = (await writtenFor(files)).body;
    assert.ok(body.includes("Backlog item: ITM-003"), "known positive: the description names the item");
    assert.ok(body.includes("RULE TWO"), "the requirement the item realises is named");
    assert.ok(body.includes(ISSUE), "the issue the item comes from is named");
  });

// ---------------------------------------------------------------- step 6

// TST-805214 · level: system · module: system
// guards: UC-034; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED
// given: the job JOB-20261016-1000-9a01 of dev-a on ITM-003 ended failed (its CI stayed red after the retry limit); on the Implement page of the product ITM-003 is in team1's sprint; on the job page the participants dev-a and dev-b are the instance's builders
// input: the author opens Implement; then the job's page
// expect: 6a: ITM-003 is blocked and cannot be started, its reason names the failed job, and it offers no box; the job's page shows the job as failed and offers Retry with the participant dev-a and a route, a new job queued with the same inputs; nothing is written by either page
test("TST-805214: UC-034 6a a job that ended failed blocks its item, and the job's page offers Retry", async () => {
  const failed = ended("failed");
  const world = await teams({ files: { [failed.path]: failed.text } });
  const page = await openImplement({}, { ...world, pullRequests: [merged(1, "ITM-001")] });
  try {
    const row = rowsOf(page)["ITM-003"];
    assert.deepEqual([row.state, row.startable, row.box], ["blocked", false, null]);
    assert.match(row.reasons.join(" "), /ITM-003 is blocked: job JOB-20261016-1000-9a01 is failed\./);
    assert.deepEqual(page.srv.writes, []);
  } finally { page.done(); }
  const job = jobPage("alice", { files: jobProduct({ jobs: [failed] }) });
  try {
    const target = await job.draw();
    assert.match(byClass(target, "job-facts")[0].textContent, /ITM-003 · implement · dev-a .* failed/);
    assert.deepEqual(byClass(target, "retry-participant")[0].children.map((option) => option.textContent), ["dev-a", "dev-b"].filter((name) => name === "dev-a"));
    assert.deepEqual(byClass(target, "retry-route")[0].children.map((option) => option.textContent), ["ci hosted"]);
    assert.equal(byClass(target, "retry").length, 1);
    assert.deepEqual(job.seen.trees, []);
  } finally { document.body.replaceChildren(); job.restore(); }
});

// ---------------------------------------------------------------- step 7, 7a, 7b

const flush = async () => { for (let n = 0; n < 600; n += 1) await new Promise((resolve) => setImmediate(resolve)); };
const trusted = async (node) => { const event = new Event("click"); Object.defineProperty(event, "isTrusted", { value: true }); node.dispatchEvent(event); await flush(); };
const untrusted = async (node) => { node.dispatchEvent(new Event("click")); await flush(); };
const until = async (done) => { const end = Date.now() + 5000; while (!done() && Date.now() < end) await new Promise((resolve) => setImmediate(resolve)); };
const dialog = () => byClass(document.body, "decision")[0];
const below = (root, match) => { const all = []; (function visit(node) { for (const child of node.children ?? []) { if (typeof child === "string") continue; if (match(child)) all.push(child); visit(child); } })(root); return all; };
const inDialog = (label) => below(dialog(), (node) => node.localName === "button" && node.textContent === label)[0];
/** The page of the job GATE_JOB drawn for `person`, `jobs` the product's job records; -> { page, target }. */
async function gatePage(person, jobs = [waitingJob()], files = {}, model = MODELS.scrum) {
  const page = jobPage(person, { files: jobProduct({ jobs, files }), model });
  return { page, target: await page.draw() };
}
const leave = (page) => { document.body.replaceChildren(); page.restore(); };

// TST-805215 · level: system · module: system
// guards: UC-034; A JOB STOPS AT EVERY GATE; THE GATE IS RECORDED; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the job JOB-20261016-1000-9a01 of dev-a, on ITM-003 of team1, waiting at the gate Building → Checking, decided by the role Owner, which team1's role assignment gives to alice; the product's token names alice
// input: alice opens the job's page; a script's click on Pass gate; her click on Pass gate with the dialog cancelled; her click and the dialog's Pass the gate
// expect: step 7: the page says the job waits at the gate Building → Checking, decided by Owner, shows what the gate checks and what to examine, and offers Pass gate and Reject enabled; the script's click and the cancelled dialog write nothing; the confirmed click writes one commit "gates: Building → Checking passed by alice" with one new file under docs/gates/ that names the gate, the job, the decider alice, the role Owner, the decision passed, the job's input docs/backlog/ITM-003-work.md@<blob> among what was checked, and a date; the page says the gate was passed by alice
test("TST-805215: UC-034 7 the Owner of the job's team sees the gate and passes it with one click, and the record names who, when and on which text", async () => {
  const { page, target } = await gatePage("alice");
  try {
    assert.equal(byClass(target, "job-gate")[0].textContent, "Waiting at the gate Building → Checking, decided by Owner");
    assert.match(byClass(target, "gate-checks")[0].textContent, /CI is green on it/);
    assert.match(byClass(target, "gate-examine")[0].textContent, /the item's pull request, with its code and TST/);
    const pass = byClass(target, "gate-pass")[0], reject = byClass(target, "gate-reject")[0];
    assert.deepEqual([pass.textContent, Boolean(pass.disabled), reject.textContent, Boolean(reject.disabled)], ["Pass gate", false, "Reject", false]);
    await untrusted(pass);
    assert.equal(dialog(), undefined);
    await trusted(pass);
    await trusted(inDialog("Cancel"));
    assert.deepEqual(page.seen.trees, [], "a script's click and a cancelled dialog write nothing");
    await trusted(pass);
    await trusted(inDialog("Pass the gate"));
    await until(() => page.seen.trees.length > 0 && byClass(target, "gate-result")[0].textContent !== "");
    assert.equal(page.seen.trees.length, 1);
    assert.equal(page.seen.commits[0].message, "gates: Building → Checking passed by alice");
    assert.equal(page.seen.trees[0].tree.length, 1);
    const { path, content } = page.seen.trees[0].tree[0];
    assert.match(path, /^docs\/gates\/\d{8}-\d{4}-building-checking-[0-9a-f]{4}\.md$/);
    for (const line of [/^gate: Building → Checking$/m, new RegExp(`^job: ${GATE_JOB}$`, "m"), /^decider: alice$/m, /^role: Owner$/m, /^decision: passed$/m, /docs\/backlog\/ITM-003-work\.md@b{40}/, /^date: \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/m]) assert.match(content, line);
    assert.match(byClass(target, "gate-result")[0].textContent, /alice/);
  } finally { leave(page); }
});

// TST-805216 · level: system · module: system
// guards: UC-034; A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT; A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS
// given: team1's role assignment gives the Owner to alice and team2's to bob; the job of dev-a on ITM-003 (held by team1's sprint) waits at Building → Checking; then the job of dev-b on ITM-011 (held by team2's sprint); then team1's Owners are alice and dev-a
// input: the job's page for alice, for bob and, in the third product, for dev-a
// expect: step 7: for the job of team1 alice may pass the gate and bob, the Owner of team2, may not — Pass gate and Reject are disabled and the page names the role Owner, its holders (alice only) and that he is not a holder of the deciding role; for the job of team2 bob may and alice may not, its holders bob; dev-a, who holds the Owner there but did the job's work, may not: the reason is that he did the work this gate checks; a click on a disabled button writes nothing
test("TST-805216: UC-034 7 a gate is decided by a holder of the deciding role in the job's own team, not by the holder of the same role in another team, and not by the participant whose work it checks", async () => {
  const cases = [
    { person: "alice", jobs: [waitingJob()], files: {}, may: true },
    { person: "bob", jobs: [waitingJob()], files: {}, may: false, holders: "alice", reason: "not a holder of the deciding role" },
    { person: "bob", jobs: [waitingJob({ participant: "dev-b", item: "ITM-011" })], files: {}, may: true },
    { person: "alice", jobs: [waitingJob({ participant: "dev-b", item: "ITM-011" })], files: {}, may: false, holders: "bob", reason: "not a holder of the deciding role" },
    { person: "dev-a", jobs: [waitingJob()], files: { "docs/role-assignments/team1.md": assignment("team1", "alice, dev-a", "dev-a") }, may: false, holders: "alice, dev-a", reason: "did the work this gate checks" },
  ];
  for (const { person, jobs, files, may, holders, reason } of cases) {
    const { page, target } = await gatePage(person, jobs, files);
    try {
      const pass = byClass(target, "gate-pass")[0], reject = byClass(target, "gate-reject")[0];
      assert.deepEqual([Boolean(pass.disabled), Boolean(reject.disabled)], [!may, !may], `${person}: Pass gate and Reject ${may ? "are offered" : "are disabled"}`);
      if (!may) {
        const said = byClass(target, "gate-unavailable")[0].textContent;
        assert.match(said, new RegExp(`Only a holder of the role Owner decides this gate; its holders are ${holders}\\.`));
        assert.match(said, new RegExp(`You cannot decide it: ${reason}\\.`));
        await trusted(pass);
        assert.equal(dialog(), undefined);
        assert.deepEqual(page.seen.trees, []);
      } else assert.deepEqual(byClass(target, "gate-unavailable"), []);
    } finally { leave(page); }
  }
});

// TST-805217 · level: system · module: system
// guards: UC-034; A GATE NAMES WHO DECIDES IT; A JOB STOPS AT EVERY GATE
// given: the job of dev-a on ITM-003 waits at the gate Checking → Closing, which the model gives to the CI check release-tests; alice, an Owner, opens its page
// input: the job's page; a trusted click anywhere a button could stand
// expect: step 7, "an automated check runs in CI; its result is the decision": the page names the gate and the decider check: release-tests, says that the gate decides by itself and offers neither Pass gate nor Reject; nothing is written
test("TST-805217: UC-034 7 a gate decided by a CI check offers a person no button, and the page says that it decides by itself", async () => {
  const job = waitingJob({ gate: "Checking → Closing", decider: "check: release-tests" });
  const model = MODELS.scrum.replace("| CI check `release-tests` |", "| check: release-tests |");
  assert.notEqual(model, MODELS.scrum, "known positive: the fixture model names the check in words");
  const { page, target } = await gatePage("alice", [job], {}, model);
  try {
    assert.equal(byClass(target, "job-gate")[0].textContent, "Waiting at the gate Checking → Closing, decided by check: release-tests — decides by itself");
    assert.equal(byClass(target, "gate-self").length, 1);
    assert.deepEqual([byClass(target, "gate-pass").length, byClass(target, "gate-reject").length], [0, 0]);
    assert.deepEqual(page.seen.trees, []);
  } finally { leave(page); }
});

// TST-805218 · level: system · module: system
// guards: UC-034; A JOB STOPS AT EVERY GATE; THE GATE IS RECORDED
// given: the job of dev-a on ITM-003 waiting at the gate Building → Checking, and a gate record of alice, the Owner of team1, who rejected the gate with the reason "The review found no test."; then the same repository after MOD-runtimes' resumeJob has read that record (the End `failed` it commits on the job's record, with the reason the writer gives)
// input: the author opens Implement with the job waiting; then with the job ended
// expect: 7a "The gate record states the rejection and its reason. The job ends, and the item returns to *ready* with the reason attached": while the job waits ITM-003 is blocked ("job ... waits at Building → Checking for Owner"); once the job has ended, ITM-003 is ready and startable again and its row carries the reason "The review found no test."
test("TST-805218: UC-034 7a a rejected gate ends the job and returns the item to ready with the reason attached", async () => {
  const rejected = gateRecord({ decision: "rejected", reason: "The review found no test." });
  const job = waitingJob();
  const world = await teams({ files: { [job.path]: job.text, [rejected.path]: rejected.text } });
  const waiting = await openImplement({}, { ...world, pullRequests: [merged(1, "ITM-001")] });
  try {
    assert.match(rowsOf(waiting)["ITM-003"].reasons.join(" "), /ITM-003 is blocked: job JOB-20261016-1000-9a01 waits at Building → Checking for Owner/, "known positive: the job waits at the gate");
  } finally { waiting.done(); }
  // The End as the product's code writes it: resumeJob over the repository that holds the job and the rejection.
  const host = await servers({ files: world.files, instance: world.instance });
  let end;
  try {
    const snapshot = await host.host.readSnapshot(host.srv.head);
    let record = null;
    for await (const each of recordsNewestFirst(snapshot)) if (each.path === job.path) { record = each; break; }
    await resumeJob(record, rejected.path, { kind: "ci", runner: "hosted" }, host.host, host.srv.head);
    end = host.srv.writes.at(-1)?.files[job.path];
  } finally { host.restore(); }
  assert.match(end ?? "", /## End/, "known positive: the writer committed the job's End");
  const page = await openImplement({}, { ...world, files: { ...world.files, [job.path]: end }, pullRequests: [merged(1, "ITM-001")] });
  try {
    const row = rowsOf(page)["ITM-003"];
    assert.deepEqual([row.state, row.startable], ["ready", true]);
    assert.match(row.text, /The review found no test\./);
  } finally { page.done(); }
});

// TST-805219 · level: system · module: system
// guards: UC-034; A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS; THE GATE IS RECORDED; A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT
// given: the model whose gate Building → Checking is decided by the role Checker, which team1 gives to the agents dev-a (who did the job's work) and dev-c; team2's Checker is dev-b; the job JOB-20261101-0900-a1b2 of dev-a waits at the gate
// input: recordGateDecision on the product's host: dev-a passes it; dev-b of team2 passes it; alice, who holds no Checker role, passes it; dev-c passes it
// expect: step 7, 7b: dev-a's own record is refused as the work this gate checks, dev-b's as not a holder of the deciding role in team1's assignment, alice's likewise, each writing nothing; dev-c's, the other holder of the role, is one commit "gates: Building → Checking passed by dev-c" with a record naming the decider dev-c, the role Checker, the job and the pull request
test("TST-805219: UC-034 7b the coding agent's own gate record does not count, nor does a holder of the role in another team; another holder in the job's team passes the gate", async () => {
  const model = MODELS.scrum.replace("| CI is green on it | Owner |", "| CI is green on it | Checker |");
  assert.notEqual(model, MODELS.scrum, "known positive: the fixture model names the Owner as the decider of the gate");
  const world = await teams({ files: { "docs/role-assignments/team1.md": assignment("team1", "alice", "dev-a, dev-c"), "docs/role-assignments/team2.md": assignment("team2", "bob", "dev-b") }, over: { "docs/process-models/fixture.md": model } });
  const host = await servers({ files: world.files, instance: world.instance });
  try {
    const declared = readDocument(declarationSchema, "docs/process.md", world.files["docs/process.md"]);
    const workflow = await productWorkflow(declared, (commit) => host.instanceHost.readSnapshot(commit), "# Instance\n");
    const team1 = readDocument(roleAssignmentSchema, "docs/role-assignments/team1.md", world.files["docs/role-assignments/team1.md"]);
    const gate = "Building → Checking";
    const decide = (name, kind) => recordGateDecision(host.host, { gate, job: JOB, decider: { name, kind }, role: "Checker", decision: "passed", reason: null, on: ["https://github.com/alice/thesis-tool/pull/7"] },
      { workflow, assignment: team1, workBy: ["dev-a"], head: host.srv.head, now: new Date("2026-11-01T11:00:00Z"), trailers: [] });
    await assert.rejects(decide("dev-a", "agent"), (failure) => failure.name === "MayNotDecide" && failure.reason === "did the work this gate checks");
    await assert.rejects(decide("dev-b", "agent"), (failure) => failure.name === "MayNotDecide" && failure.reason === "not a holder of the deciding role");
    await assert.rejects(decide("alice", "person"), (failure) => failure.name === "MayNotDecide" && failure.reason === "not a holder of the deciding role");
    assert.deepEqual(host.srv.writes, [], "nothing is written for a refused decision");
    const passed = await decide("dev-c", "agent");
    assert.equal(host.srv.writes.length, 1);
    assert.equal(host.srv.writes[0].message, `gates: ${gate} passed by dev-c`);
    const record = host.srv.writes[0].files[passed.path];
    for (const line of [/^decider: dev-c$/m, /^role: Checker$/m, new RegExp(`^job: ${JOB}$`, "m"), /^decision: passed$/m, /pull\/7/]) assert.match(record, line);
  } finally { host.restore(); }
});

// ---------------------------------------------------------------- step 8, 8a

// TST-805220 · level: system · module: system
// guards: UC-034; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; ONE CLICK PER DECISION
// given: team1's sprint 02 selects ITM-001 (merged), ITM-003 and ITM-004 (builds on ITM-003); the job JOB-20261101-0900-a1b2 of dev-a on ITM-003 (the author chose that a person merges) has the open pull request #7 into sprint/team1/02, whose first commit holds the tests and was red and whose head is green, where agent-m done passed; the pull request #8 of a job on ITM-011 whose agent-m done failed
// input: the author opens Implement; a script's click on Merge of #7; the author's click; then the author opens Implement again with #7 merged
// expect: step 8, 8a: #7 is shown with its branch agent-m/<job> into sprint/team1/02, the runs of its first commit (failure) and of its head (success) and that the Definition of Done holds; #8 offers no Merge; the script's click merges nothing; the author's one click merges #7 at the head read and the page says "Merged as eeeeeee."; ITM-004 waits for ITM-003 before and, once #7 is merged, ITM-003 is done and no longer listed and ITM-004 is ready and ticked; nothing is written to an item file
test("TST-805220: UC-034 8, 8a the item's pull request is merged into the sprint's branch with one click once the Definition of Done holds, and the item counts as done", async () => {
  const one = jobRecord({ worksOn: ["ITM-003"], params: { items: ["ITM-003"], merges: "person" } });
  const two = jobRecord({ id: "JOB-20261101-0901-e6f7", worksOn: ["ITM-011"], participant: "dev-b", params: { items: ["ITM-011"], merges: "agent" } });
  const sprint = { [sprintPath("team1", 2)]: sprintText({ n: 2, goal: "Mail", selection: ["ITM-001", "ITM-003", "ITM-004"], branch: "sprint/team1/02" }), [one.path]: one.text, [two.path]: two.text };
  const world = await teams({ files: sprint });
  const sevenPull = { ...jobPull({ step: "ITM-003" }), base: "sprint/team1/02", body: `Job: ${JOB}\nKind: implement\nBacklog item: ITM-003\nModules: MOD-mail` };
  const eightPull = { ...jobPull({ number: 8, job: "JOB-20261101-0901-e6f7", step: "ITM-011", commits: [{ sha: "3".repeat(40), files: ["tests/news.test.mjs"], ci: "failure" }, { sha: "4".repeat(40), files: ["src/news/index.mjs"], ci: "success" }], done: "failure" }),
    base: "sprint/team2/01", body: "Job: JOB-20261101-0901-e6f7\nKind: implement\nBacklog item: ITM-011" };
  const page = await openImplement({}, { ...world, pullRequests: [merged(1, "ITM-001"), sevenPull, eightPull] });
  try {
    const rows = rowsOf(page);
    assert.equal(rows["ITM-004"].state, "waiting for an item it builds on");
    const seven = textOf(found(page.target, '[data-pull="7"]')[0]);
    assert.match(seven, new RegExp(`branch agent-m/${JOB} into sprint/team1/02`));
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
    assert.deepEqual(page.srv.writes, [], "nothing is written to a file");
  } finally { page.done(); }
  const after = await openImplement({}, { ...world, pullRequests: [merged(1, "ITM-001"), { ...merged(7, "ITM-003"), base: "sprint/team1/02" }] });
  try {
    const rows = rowsOf(after);
    assert.equal(rows["ITM-003"], undefined, "a merged item is done and not listed");
    assert.deepEqual([rows["ITM-004"].state, ticked(rows["ITM-004"].box)], ["ready", true]);
  } finally { after.done(); }
});

// TST-805221 · level: system · module: system
// guards: UC-034; A PROCESS REQUIREMENT ADDS TO THE MODEL; A GATE NAMES WHO DECIDES IT
// given: the product of TST-805202 whose declaration adds, under Gates added by requirements, the gate of the instance's requirement A GREEN BUILD GATES THE MERGE between Building and Checking, decided by the check build
// input: the author opens Implement and reads the panel of ITM-003
// expect: step 3 "the gates the job will meet": the panel names the model's gate Building → Checking, decided by Owner, and beside it the gate the requirement adds, A GREEN BUILD GATES THE MERGE, decided by check: build; the model's gate is not replaced
test("TST-805221: UC-034 3 the gates the job will meet are those of the model and those a process requirement adds, each with its decider", async () => {
  const base = (await teams()).files["docs/process.md"];
  const added = base.replace("## Definition of Done", ["## Gates added by requirements", "", "| Requirement | Between | Artifacts | Condition | Decider |", "|---|---|---|---|---|",
    "| A GREEN BUILD GATES THE MERGE | Building → Checking | the pull request | the build is green | check: build |", "", "## Definition of Done"].join("\n"));
  assert.notEqual(added, base, "known positive: the declaration gained the section");
  const spec = lines("# Instance", "", "**A GREEN BUILD GATES THE MERGE** *(Product Owner)*", "", "A merge needs a green build.", "*Check:* no automatic check; at review.");
  const page = await openImplement({}, { ...await teams({ files: { "docs/process.md": added }, over: { "SPEC.md": spec } }), pullRequests: [merged(1, "ITM-001")] });
  try {
    assert.match(rowsOf(page)["ITM-003"].text, /Gates: Building → Checking \(decided by Owner\), A GREEN BUILD GATES THE MERGE \(decided by check: build\)\./);
  } finally { page.done(); }
});

