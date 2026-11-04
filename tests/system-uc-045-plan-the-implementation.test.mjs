// System coverage for UC-045 Plan the implementation, walked through the dashboard: the main flow, steps 1 to 5, and the alternative flows 1a, 1b, 1c, 1d, 2a, 2b, 3a and 3b. The pages are the real routes `plan` and `implement` of
// MOD-implementation-pages over the real MOD-work-plans, MOD-job-runner, MOD-trace-graph and MOD-repository-hosts, behind the fakes of GitHub's API and of two model endpoints of tests/uc-045-harness.mjs (the product
// alice/thesis-tool and the instance akmaier/agent-m, each a server of its own). No request leaves the process.
// Run: node --test tests/system-uc-045-plan-the-implementation.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-work-plans
// Guards: UC-045
// Level: system
//
// Authored by developer-sonnet-j (ITM-1061), who implemented none of ITM-614, ITM-1058 and ITM-1059 and no UC-045 production behaviour (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER).
// Where the page and UC-045 disagree the case follows UC-045 and is marked { todo } with the finding it reports (named in FLOW_FINDINGS); no UC-045 finding is left.
// Each test states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map (TST-1061001), which holds the expected passages itself and
// checks that UC-045 still says them. A person's click is the page's own listener called with a trusted event; a script's click is `page.script`. Readings the texts leave open, which the cases state:
//   - "its derived state: waiting for a step it depends on, ready, in progress, done" is read as the page's state labels "waiting for an item it builds on", "waiting" (for a gate), "ready", "in progress" and "done".
//   - "the planner chooses Draft the plan ... presses Run" is read as: the person's click on the button [data-draft-plan] opens the run panel; the person's click on its Run sends.
//   - "links to UC-022 or UC-023" (1b), "links to UC-023 to change the architecture" (3a) is read as a link to the page of the architecture, #arc, as the page's own 1b note links it.
//   - "commits it under its name" (1d) is read as the commit's provenance lines naming the drafting participant (Agent-M-Participant) and its job.
//   - "the draft is shown with each finding left" (3b) is read as: the findings stand above the steps, one line each, in the form "<kind>: <what> — <fix> [<rule>]".

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { SCRUM_MODEL, DRAFT, GATES, PARTICIPANTS, STORE, architecture, archRowOf, boxOf, boxes, byHand, choose, classed, drafting, found, handPlan, instanceFiles, marksOf, modulePath, moduleText, openPlan, plain,
  planWrites, planned, pr, refused, rowOf, run, saved, savePlan, quiet, stepPath, stepText, stepsOf, textOf, titles, treeOf, typeInto, waitFor, walk, without, ARC_PATHS } from "./uc-045-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const exists = (path) => existsSync(new URL(`../${path}`, import.meta.url));
const UC = "docs/use-cases/UC-045-plan-the-implementation.md";
const SELF = "tests/system-uc-045-plan-the-implementation.test.mjs";
const S = Object.fromEntries(DRAFT.steps.map((step) => [step.title, step]));
const upOf = (page, title) => walk(boxOf(page, title), (node) => node.getAttribute("data-step-up") !== null)[0];
const fieldOf = (page, title, key) => walk(boxOf(page, title), (node) => node.getAttribute("data-step-field") === key)[0];
const drafted = async (files, ...answers) => { const made = await drafting({ files }, ...answers); await run(made.page); return made; };
const hrefs = (page) => walk(page.target, (node) => node.localName === "a").map((link) => link.getAttribute("href"));
const byHandSaved = handPlan;

// ---------------------------------------------------------------- the flow map

// The passages of UC-045 the system test walks, each with the tests that walk it; a passage the page does otherwise is a finding, a todo test that fails now and names what the page does instead.
const FLOW_EVIDENCE = {
  "main-1-open": { uc: "Agent M shows the accepted architecture — the system, its subsystems and their modules — and, if a plan exists, its steps in their order", evidence: [[SELF, "TST-1061002"]] },
  "main-1-states": { uc: "each with its derived state: *waiting* for a step it depends on, *ready*, *in progress*, *done*", evidence: [[SELF, "TST-1061002"]] },
  "main-1-explain": { uc: "A folded **What is this?** explains the plan with the table above and points", evidence: [[SELF, "TST-1061002"]] },
  "main-2-run-panel": { uc: "The run panel names the drafting participant, where it processes data, and what is sent", evidence: [[SELF, "TST-1061003"]] },
  "main-2-model": { uc: "the process model with its phases and gates", evidence: [[SELF, "TST-1061004"]] },
  "main-2-run": { uc: "The planner presses **Run** — that click is the decision.", evidence: [[SELF, "TST-1061003"], [SELF, "TST-1061005"]] },
  "main-3-bottom-up": { uc: "The participant drafts the plan from the bottom up", evidence: [[SELF, "TST-1061005"]] },
  "main-3-check": { uc: "Agent M checks the complete draft: a module, a subsystem or the system without a step", evidence: [[SELF, "TST-1061006"], [SELF, "TST-1061007"]] },
  "main-3-phase": { uc: "for each step, the phase of the model it belongs to", evidence: [[SELF, "TST-1061008"]] },
  "main-4-review": { uc: "The planner reviews the plan in its order, beside the architecture, with a Mermaid diagram of the steps and what each waits for.", evidence: [[SELF, "TST-1061002"], [SELF, "TST-1061009"]] },
  "main-4-edit": { uc: "The planner may reorder steps where their dependencies allow it, split or merge steps, and edit them.", evidence: [[SELF, "TST-1061009"]] },
  "main-5-save": { uc: "The planner presses **Save plan** — one click.", evidence: [[SELF, "TST-1061010"]] },
  "main-5-commit": { uc: "Agent M commits one Markdown file per step under `docs/plan/`", evidence: [[SELF, "TST-1061010"]] },
  "main-5-order": { uc: "and the order of the steps in `docs/plan/order.md`", evidence: [[SELF, "TST-1061010"]] },
  "main-5-jobs": { uc: "From now on, implementation jobs start only for steps of the plan (UC-024).", evidence: [[SELF, "TST-1061011"]] },
  "1a-backlog": { uc: "**1a. The product's model works from a backlog (Scrum, Kanban).**", evidence: [[SELF, "TST-1061012"]] },
  "1b-not-accepted": { uc: "**1b. The architecture is not accepted.** Agent M names what is open and links to UC-022 or UC-023; nothing is planned.", evidence: [[SELF, "TST-1061013"]] },
  "1c-changed": { uc: "**1c. The architecture changes after the plan was saved (UC-023).**", evidence: [[SELF, "TST-1061014"]] },
  "1d-agent": { uc: "**1d. The planner is an agent.**", evidence: [[SELF, "TST-1061015"]] },
  "2a-by-hand": { uc: "**2a. The planner writes the plan by hand.**", evidence: [[SELF, "TST-1061016"]] },
  "2b-does-not-fit": { uc: "**2b. The input does not fit into the participant's context.**", evidence: [[SELF, "TST-1061017"]] },
  "3a-cycle-names": { uc: "**3a. The modules' interfaces form a cycle.** No order exists; Agent M names the modules of the cycle", evidence: [[SELF, "TST-1061018"]] },
  "3b-left": { uc: "**3b. Findings are left after the last round.**", evidence: [[SELF, "TST-1061020"]] },
  "3a-cycle-link": { uc: "links to UC-023 to change the architecture", evidence: [[SELF, "TST-1061019"]] },
  "2a-check-by-hand": { uc: "the check of step 3 runs when they press **Save plan**", evidence: [[SELF, "TST-1061022"]] },
  "main-3-order": { uc: "then one step for the subsystem's integration", evidence: [[SELF, "TST-1061021"]] },
};
const FLOW_FINDINGS = {
};

// TST-1061001 · level: system · module: system
// guards: UC-045
// given: UC-045 as committed text, the executable tests named in FLOW_EVIDENCE and the findings named in FLOW_FINDINGS
// input: compare every passage of the main flow and of the alternative flows 1a, 1b, 1c, 1d, 2a, 2b, 3a and 3b with its executable evidence or its finding
// expect: every named passage stands in UC-045; every evidence file exists and contains its TST id; every finding's test stands in its file with the todo naming the finding; every alternative flow UC-045 names is among the passages
test("TST-1061001: UC-045 system coverage names the main flow and every alternative flow", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  for (const [flow, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${flow}: UC-045 contains ${needle}`);
    assert.ok(evidence.length > 0, `${flow}: evidence is named`);
    for (const [file, id] of evidence) {
      assert.ok(exists(file), `${flow}: evidence file exists: ${file}`);
      assert.ok(read(file).includes(`// ${id} `), `${flow}: ${file} contains ${id}`);
    }
  }
  for (const [flow, { uc: needle, finding, file, test: id }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${flow}: UC-045 contains ${needle}`);
    assert.ok(read(file).includes(`// ${id} `), `${flow}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} `), `${flow}: the todo of ${id} names FINDING ${finding}`);
  }
  const named = [...uc.matchAll(/\*\*(\d[a-z])\. /g)].map((m) => m[1]).sort();
  assert.deepEqual(named, ["1a", "1b", "1c", "1d", "2a", "2b", "3a", "3b"], "known positive: UC-045 names these eight alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).filter((key) => /^\d[a-z]-/.test(key)).map((key) => key.slice(0, 2)));
  assert.deepEqual(named.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
});

// ---------------------------------------------------------------- step 1

// TST-1061002 · level: system · module: system
// guards: UC-045; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; EVERY STEP EXPLAINS ITSELF; DIAGRAMS ARE MERMAID IN MARKDOWN
// given: the planned product (the V-model; the system ARC-001, the subsystems ARC-002 designing MOD-store and MOD-pages and ARC-003 designing MOD-mail; all accepted) with a plan of six steps ITM-101 to ITM-106, the gates Requirements → Design and Design → Implementation passed, the pull request 1 of ITM-101 merged and the pull request 2 of ITM-102 open
// input: the planner opens Plan
// expect: the architecture is listed as the system ARC-001, its subsystems ARC-002 (modules MOD-store, MOD-pages) and ARC-003 (MOD-mail); the steps stand in the plan's order, each with its state: ITM-101 done, ITM-102 in progress (pull request 2 is open for review), ITM-103 ready, ITM-104, ITM-105 and ITM-106 waiting for an item it builds on (ITM-102 is not done; ITM-103 is not done; ITM-104 and ITM-105 are not done); one Mermaid flowchart of the steps with an edge from each step to the step that waits for it; a folded What is this? holds the table (a module: unit tests; a subsystem: component tests; the system: system tests, and the release tests ... written by a participant other than the implementer) and points to chapter 6; no step file holds a state, and nothing is written
test("TST-1061002: UC-045 1 Plan shows the architecture beside the steps in their order, each with its derived state, a diagram and a folded explanation", async () => {
  const files = await planned({ files: GATES });
  const pulls = [pr(1, "ITM-101", "merged", "2026-10-20T09:00:00Z", "2026-10-21T10:00:00Z"), pr(2, "ITM-102", "open", "2026-10-21T12:00:00Z")];
  const page = await openPlan("plan", {}, { files, pullRequests: pulls });
  try {
    assert.deepEqual(treeOf(page), [["ARC-001", "system", null], ["ARC-002", "subsystem", "ARC-001"], ["MOD-store", "module", "ARC-002"], ["MOD-pages", "module", "ARC-002"], ["ARC-003", "subsystem", "ARC-001"], ["MOD-mail", "module", "ARC-003"]]);
    assert.deepEqual(stepsOf(page), [
      { id: "ITM-101", state: "done", waits: "" }, { id: "ITM-102", state: "in progress", waits: "pull request 2 is open for review" }, { id: "ITM-103", state: "ready", waits: "" },
      { id: "ITM-104", state: "waiting for an item it builds on", waits: "ITM-102 is not done" }, { id: "ITM-105", state: "waiting for an item it builds on", waits: "ITM-103 is not done" },
      { id: "ITM-106", state: "waiting for an item it builds on", waits: "ITM-104 and ITM-105 are not done" }]);
    const diagram = textOf(found(page.target, "[data-plan-diagram]")[0]);
    assert.match(diagram, /^flowchart TD /);
    for (const edge of ["ITM_101 --> ITM_102", "ITM_102 --> ITM_104", "ITM_103 --> ITM_105", "ITM_104 --> ITM_106", "ITM_105 --> ITM_106"]) assert.ok(diagram.includes(edge), edge);
    assert.ok(diagram.includes('ITM_101["ITM-101 — done"]'), "each node is labelled with its step and state");
    const explanation = walk(found(page.target, "[data-plan-explain]")[0], (node) => node.localName === "details")[0];
    assert.ok(explanation && explanation.getAttribute("open") === null, "a folded What is this?");
    assert.equal(textOf(walk(explanation, (node) => node.localName === "summary")[0]), "What is this?");
    const said = textOf(explanation);
    for (const row of ["a module the module, as its file describes it unit tests", "a subsystem the subsystem's modules, as its decision describes their interplay component tests",
      "the system the subsystems, as the decision that states the system describes it system tests, and the release tests of the use cases, written by a participant other than the implementer"]) assert.ok(said.includes(row), row);
    assert.match(said, /chapter 6/);
    for (const [path, text] of Object.entries(files)) if (path.startsWith("docs/plan/")) assert.doesNotMatch(text, /^(state|status):/m, `${path} stores no state`);
    assert.deepEqual(page.srv.writes, [], "nothing is written");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- step 2

// TST-1061003 · level: system · module: system
// guards: UC-045; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the planned product without a plan; the instance's participants local-llm (draft text, model-a, "this machine") and cloud-llm (draft text, model-b, "a provider in the USA"), and dev-a, which cannot draft text
// input: a script's click on Draft the plan; then the planner's click on it; then, on the run panel, the planner's click on Run
// expect: the script's click draws no run panel; the planner's click draws one that offers local-llm and cloud-llm and not dev-a, each with its place, names the model of local-llm and its place "this machine", names every file it sends — ARC-001, ARC-002 and ARC-003, MOD-mail, MOD-pages and MOD-store and docs/process.md — and its size against the context; nothing is sent to an endpoint and nothing is written before Run; Run sends one request, to the endpoint of local-llm (ep1) alone; Run is the only click between the button and the draft
test("TST-1061003: UC-045 2 Draft the plan opens a run panel that names the participant, where it processes data and what is sent; Run is the decision", async () => {
  const { page, asked } = await drafting({ files: await planned({ plan: false }) }, DRAFT);
  try {
    assert.equal(classed(page.target, "run-panel").length, 1, "the planner's click draws the run panel");
    const panel = textOf(classed(page.target, "run-panel")[0]);
    for (const shown of ["local-llm", "model-a", "this machine", "docs/architecture/ARC-001-the-whole.md", "docs/architecture/ARC-002-storage.md", "docs/architecture/ARC-003-mail.md", "docs/architecture/MOD-mail.md",
      "docs/architecture/MOD-pages.md", "docs/architecture/MOD-store.md", "docs/process.md", "tokens of 200000 tokens of context"]) assert.ok(panel.includes(shown), `the run panel names ${shown}`);
    const offered = walk(found(page.target, "[data-draft-participant]")[0], (node) => node.localName === "option").map((option) => option.getAttribute("value"));
    assert.deepEqual(offered, ["local-llm", "cloud-llm"], "only participants that draft text are offered");
    assert.ok(textOf(found(page.target, "[data-draft-participant]")[0]).includes("a provider in the USA"), "each is offered with its place");
    assert.equal(asked.length, 0, "nothing is sent before Run");
    assert.deepEqual(planWrites(page), [], "nothing is written before Run");
    await run(page);
    assert.deepEqual(asked.map((request) => request.origin), ["https://ep1.example.test"], "Run sends one request, to local-llm's endpoint");
    assert.equal(boxes(page).length, 6, "the draft is there after Run, with no further click");
  } finally { page.done(); }
  const script = await openPlan("plan", {}, { files: await planned({ plan: false }), store: STORE });
  try {
    await script.script(found(script.target, "[data-draft-plan]")[0]);
    assert.equal(classed(script.target, "run-panel").length, 0, "a script's click draws no run panel");
    assert.equal(script.srv.requests.filter((request) => request === "file AGENTS.md").length, 0, "and reads nothing to prepare the job");
  } finally { script.done(); }
});

// TST-1061004 · level: system · module: system
// guards: UC-045
// given: the planned product without a plan, whose V-model has the phases Concept, Requirements, Design, Implementation, Testing, Validation & Verification and Operation & Maintenance and the gate Design → Implementation; the draft of TST-1061005
// input: the planner opens the run panel of Draft the plan and presses Run; the request the drafting participant receives is read
// expect: UC-045 step 2 "the process model with its phases and gates" is sent: the request names the phase Validation & Verification and the gate Design → Implementation, as the model file holds them, so that the participant can name the phase of the model for each step (step 3).
test("TST-1061004: UC-045 2 the participant receives the process model with its phases and gates", async () => {
  const { page, asked } = await drafted(await planned({ plan: false }), DRAFT);
  try {
    assert.equal(asked.length, 1, "known positive: Run sends the request");
    const sent = JSON.stringify(asked[0].body);
    assert.ok(sent.includes("ARC-002-storage.md"), "known positive: the request holds the architecture");
    assert.ok(sent.includes("Validation & Verification"), "the phases of the model");
    assert.ok(sent.includes("Design → Implementation"), "the gates of the model");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- step 3

// TST-1061005 · level: system · module: system
// guards: UC-045; A GENERATED ARTIFACT IS A PROPOSAL; DIAGRAMS ARE MERMAID IN MARKDOWN
// given: the planned product without a plan; the participant local-llm answers the plan drafted from the bottom up: Store, Pages (after Store), Mail, Storage (ARC-002, after Pages), Mailing (ARC-003, after Mail), Whole (the system, after Storage and Mailing), the modules in the phase Implementation, the integrations and the system in Testing
// input: the planner presses Draft the plan and Run
// expect: the participant is asked once and its request holds the instruction to draft bottom up ("a module after every module whose interface it uses") and the architecture; the draft is shown as six steps in the participant's order, each with its title, what it implements, the level of its tests, its phase and what it comes after; one Mermaid flowchart of the steps with the edges Store→Pages, Pages→Storage, Mail→Mailing, Storage→Whole and Mailing→Whole; no correction round is left and no finding is shown; nothing is written under docs/plan/ — the draft waits for the planner
test("TST-1061005: UC-045 3 the participant's draft is shown bottom up with its fields and a diagram, and waits for the planner", async () => {
  const { page, asked } = await drafted(await planned({ plan: false }), DRAFT);
  try {
    assert.equal(asked.length, 1);
    assert.ok(JSON.stringify(asked[0].body).includes("a module after every module whose interface it uses"), "the instruction to draft bottom up");
    assert.deepEqual(titles(page), ["Store", "Pages", "Mail", "Storage", "Mailing", "Whole"]);
    const values = (title) => ["implements", "level", "phase", "after"].map((key) => walk(boxOf(page, title), (node) => node.getAttribute("data-step-field") === key)[0].value);
    assert.deepEqual(values("Store"), ["MOD-store", "unit", "Implementation", ""]);
    assert.deepEqual(values("Pages"), ["MOD-pages", "unit", "Implementation", "Store"]);
    assert.deepEqual(values("Storage"), ["ARC-002", "component", "Testing", "Pages"]);
    assert.deepEqual(values("Whole"), ["system", "system", "Testing", "Storage, Mailing"]);
    const diagram = textOf(found(page.target, "[data-draft-diagram]")[0]);
    assert.match(diagram, /^flowchart TD /);
    for (const edge of ["S1 --> S2", "S2 --> S4", "S3 --> S5", "S4 --> S6", "S5 --> S6"]) assert.ok(diagram.includes(edge), edge);
    assert.doesNotMatch(textOf(found(page.target, "[data-plan-draft]")[0]), /Findings left/);
    await quiet();
    assert.deepEqual(planWrites(page), [], "nothing is written under docs/plan/");
  } finally { page.done(); }
});

// TST-1061006 · level: system · module: system
// guards: UC-045; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: the planned product without a plan; local-llm answers first a draft that leaves one step out and then the complete draft of TST-1061005; known positive: the complete draft alone is asked once
// input: for each of the steps Mail (MOD-mail), Storage (the integration of ARC-002) and Whole (the system), the planner presses Draft the plan and Run
// expect: the participant is asked twice; its second request holds the finding "MOD-mail has no step", "the subsystem ARC-002 has no step for its integration" and "the system (ARC-001) has no step"; the planner sees the six steps of the corrected draft and no finding
test("TST-1061006: UC-045 3 a draft that leaves a module, a subsystem or the system without a step goes back to the participant as a finding", async () => {
  const known = await drafted(await planned({ plan: false }), DRAFT);
  try { assert.equal(known.asked.length, 1, "known positive: the complete draft is asked once"); } finally { known.page.done(); }
  for (const [left, finding] of [["Mail", "MOD-mail has no step"], ["Storage", "the subsystem ARC-002 has no step for its integration"], ["Whole", "the system (ARC-001) has no step"]]) {
    const { page, asked } = await drafted(await planned({ plan: false }), without(left), DRAFT);
    try {
      assert.equal(asked.length, 2, `${left}: asked again`);
      assert.ok(JSON.stringify(asked[1].body).includes(finding), `${left}: the second request holds "${finding}"`);
      assert.ok(!JSON.stringify(asked[0].body).includes(finding), `${left}: the first does not`);
      assert.deepEqual(titles(page), ["Store", "Pages", "Mail", "Storage", "Mailing", "Whole"], `${left}: the planner sees the corrected draft`);
      assert.doesNotMatch(textOf(found(page.target, "[data-plan-draft]")[0]), /Findings left/, `${left}: no finding is shown`);
    } finally { page.done(); }
  }
});

// TST-1061007 · level: system · module: system
// guards: UC-045; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A RUN FOLLOWS THE MODULES' INTERFACES; A PLAN STEP NAMES THE TESTS OF ITS LEVEL
// given: the planned product (MOD-pages uses MOD-store.read); local-llm answers a draft in which Pages comes before Store, and then the complete draft; again a draft in which the step Store names the tests of the level component, and then the complete draft
// input: the planner presses Draft the plan and Run, for each of the two drafts
// expect: the participant is asked twice each time; the second request holds "MOD-pages is ordered before MOD-store, whose interface it uses" for the first and "is of level module and names tests of another level: component" for the second; the planner sees the corrected draft with no finding
test("TST-1061007: UC-045 3 a module ordered before one whose interface it uses, and a step without the tests of its level, go back to the participant as a finding", async () => {
  const reordered = { steps: [S.Pages, S.Store, ...DRAFT.steps.slice(2)].map((step) => ({ ...step, after: [] })) };
  const wrong = { steps: DRAFT.steps.map((step) => (step.title === "Store" ? { ...step, level: "component" } : step)) };
  for (const [bad, finding] of [[reordered, "MOD-pages is ordered before MOD-store, whose interface it uses"], [wrong, "is of level module and names tests of another level: component"]]) {
    const { page, asked } = await drafted(await planned({ plan: false }), bad, DRAFT);
    try {
      assert.equal(asked.length, 2, finding);
      assert.ok(JSON.stringify(asked[1].body).includes(finding), `the second request holds "${finding}"`);
      assert.deepEqual(titles(page), ["Store", "Pages", "Mail", "Storage", "Mailing", "Whole"]);
      assert.doesNotMatch(textOf(found(page.target, "[data-plan-draft]")[0]), /Findings left/);
    } finally { page.done(); }
  }
});

// TST-1061008 · level: system · module: system
// guards: UC-045; THE MODEL DETERMINES THE PHASES AND THE GATES
// given: the planned product (the V-model's phases are Concept, Requirements, Design, Implementation, Testing, Validation & Verification and Operation & Maintenance); local-llm answers a draft in which the step Store is in the phase Dreaming, and then the complete draft
// input: the planner presses Draft the plan and Run
// expect: the participant is asked twice; the second request holds "is in the phase Dreaming, which the model lacks"; the planner sees the corrected draft, every step in a phase of the model (Implementation or Testing)
test("TST-1061008: UC-045 3 a step in a phase the model lacks goes back to the participant, and each step the planner sees has a phase of the model", async () => {
  const dreaming = { steps: DRAFT.steps.map((step) => (step.title === "Store" ? { ...step, phase: "Dreaming" } : step)) };
  const { page, asked } = await drafted(await planned({ plan: false }), dreaming, DRAFT);
  try {
    assert.equal(asked.length, 2);
    assert.ok(JSON.stringify(asked[1].body).includes("is in the phase Dreaming, which the model lacks"));
    const phases = boxes(page).map((box) => walk(box, (node) => node.getAttribute("data-step-field") === "phase")[0].value);
    assert.deepEqual(phases, ["Implementation", "Implementation", "Implementation", "Testing", "Testing", "Testing"]);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- step 4

// TST-1061009 · level: system · module: system
// guards: UC-045; A RUN FOLLOWS THE MODULES' INTERFACES; ONE CLICK PER DECISION
// given: the draft of TST-1061005 on the page
// input: Up on Mail twice (known positive: MOD-mail uses no module); Up on Pages, which would put MOD-pages before MOD-store; the title of Whole typed as "The whole system"; Split on Mail; Merge with next on Mail
// expect: Up on Mail twice puts Mail first (Mail, Store, Pages, Storage, Mailing, Whole) and the diagram is drawn again in that order; Up on Pages is refused with the finding "MOD-pages is ordered before MOD-store, whose interface it uses" and the order stays; the title is edited; Split adds "Mail (2)" implementing MOD-mail after Mail; Merge with next takes it away again; nothing is written
test("TST-1061009: UC-045 4 the planner reorders where the dependencies allow, edits, splits and merges the steps; a move that breaks an interface order is refused", async () => {
  const { page } = await drafted(await planned({ plan: false }), DRAFT);
  try {
    await page.press(upOf(page, "Mail"));
    assert.deepEqual(titles(page), ["Store", "Mail", "Pages", "Storage", "Mailing", "Whole"], "known positive: Mail moves up one place");
    assert.match(textOf(found(page.target, "[data-draft-diagram]")[0]), /S2\["2\. Mail"\]/, "the diagram is drawn again");
    await page.press(upOf(page, "Mail"));
    assert.deepEqual(titles(page), ["Mail", "Store", "Pages", "Storage", "Mailing", "Whole"]);
    assert.deepEqual(refused(page), [], "no refusal for an allowed move");
    await page.press(upOf(page, "Pages"));
    assert.deepEqual(titles(page), ["Mail", "Store", "Pages", "Storage", "Mailing", "Whole"], "the move that puts Pages before Store is refused: the order stays");
    assert.deepEqual(refused(page).filter((line) => line.includes("MOD-pages is ordered before MOD-store, whose interface it uses")).length, 1, "and the finding is named");
    await typeInto(fieldOf(page, "Whole", "title"), "The whole system");
    assert.ok(titles(page).includes("The whole system"));
    await page.press(walk(boxOf(page, "Mail"), (node) => node.getAttribute("data-step-split") !== null)[0]);
    assert.deepEqual(titles(page).filter((title) => /^Mail( \(2\))?$/.test(title)), ["Mail", "Mail (2)"]);
    assert.equal(fieldOf(page, "Mail (2)", "implements").value, "MOD-mail");
    await page.press(walk(boxOf(page, "Mail"), (node) => node.getAttribute("data-step-merge") !== null)[0]);
    assert.deepEqual(titles(page).filter((title) => /^Mail( \(2\))?$/.test(title)), ["Mail"]);
    assert.deepEqual(planWrites(page), [], "nothing is written before Save plan");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- step 5

// TST-1061010 · level: system · module: system
// guards: UC-045; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; THE IMPLEMENTATION PLAN LIVES IN THE PRODUCT REPOSITORY; EVERY ARTIFACT HAS AN IDENTIFIER
// given: the draft of TST-1061005 on the page, the title of Whole edited to "The whole system"; the planner's token for the product stored; known negative first — a click a script makes on Save plan
// input: a script clicks Save plan; then the planner clicks it once
// expect: the script's click writes nothing; the planner's click makes exactly one commit on the default branch (a tree, a commit and the move of the branch main — no branch, no pull request) of the files docs/plan/ITM-<nnn>-<slug>.md, one for each of the six steps, and docs/plan/order.md, and of no other file; the step of the system is docs/plan/ITM-<nnn>-the-whole-system.md; each step file names what it implements or integrates (its modules, and for a subsystem the decision it integrates) and the tests of its level (unit; component; system and release); the order lists the six identifiers in the draft's order with their phases; the page names the commit and the files; nothing is written to the instance
test("TST-1061010: UC-045 5 Save plan is one click: it commits one file per step and the order under docs/plan/ of the product, and nothing else", async () => {
  const { page } = await drafted(await planned({ plan: false }), DRAFT);
  try {
    await typeInto(walk(boxOf(page, "Whole"), (node) => node.getAttribute("data-step-field") === "title")[0], "The whole system");
    await page.script(savePlan(page));
    assert.deepEqual(planWrites(page), [], "known negative: a script's click writes nothing");
    const before = page.srv.requests.length;
    await page.press(savePlan(page));
    await waitFor(() => saved(page).length > 0);
    const writes = planWrites(page);
    assert.equal(writes.length, 1, "one click, one commit");
    const kinds = page.srv.requests.slice(before).filter((request) => /^write /.test(request));
    assert.deepEqual(kinds, ["write tree", "write commit", "write ref"], "directly on the default branch: no branch, no pull request");
    assert.deepEqual(page.created, [], "no branch is created");
    const files = writes[0].files;
    const paths = Object.keys(files);
    assert.equal(paths.length, 7, paths.join(", "));
    assert.ok(paths.every((path) => path === "docs/plan/order.md" || /^docs\/plan\/ITM-\d{3,}-[a-z0-9-]+\.md$/.test(path)), "no other file");
    const whole = paths.find((path) => /-the-whole-system\.md$/.test(path));
    assert.ok(whole, "the system's step is saved under the planner's title");
    const tests = (path) => [...files[path].matchAll(/^tests:\n((?:  - .*\n)+)/gm)].flatMap((m) => m[1].split("\n").filter(Boolean).map((line) => line.slice(4)));
    assert.deepEqual(tests(whole), ["system", "release"]);
    assert.deepEqual(tests(paths.find((path) => /-store\.md$/.test(path))), ["unit"]);
    const storage = files[paths.find((path) => /-storage\.md$/.test(path))];
    assert.match(storage, /\nintegrates: ARC-002\n/);
    assert.deepEqual(tests(paths.find((path) => /-storage\.md$/.test(path))), ["component"]);
    assert.match(storage, /## Outcome\n\nIntegrates ARC-002: MOD-store, MOD-pages\./);
    const ids = paths.filter((path) => path !== "docs/plan/order.md").map((path) => /ITM-\d{3,}/.exec(path)[0]);
    assert.equal(new Set(ids).size, 6, "each step has an identifier of its own");
    const rows = [...files["docs/plan/order.md"].matchAll(/^\| (ITM-\d{3,}) \| ([^|]+?) \|$/gm)].map((row) => row[2]);
    assert.deepEqual(rows, ["Implementation", "Implementation", "Implementation", "Testing", "Testing", "Testing"]);
    assert.deepEqual([...files["docs/plan/order.md"].matchAll(/^\| (ITM-\d{3,}) \|/gm)].map((row) => row[1]), ids, "the order lists the identifiers in the draft's order");
    for (const path of paths) assert.ok(saved(page).includes(path), `the page names ${path}`);
    assert.deepEqual(page.inst.writes.filter((write) => Object.keys(write.files).some((path) => path.startsWith("docs/plan/"))), [], "nothing is written to the instance");
  } finally { page.done(); }
});

// TST-1061011 · level: system · module: system
// guards: UC-045; A PLANNED MODEL IMPLEMENTS ITS IMPLEMENTATION PLAN
// given: the planned product with the gates passed and the plan of six steps; the same product without a plan
// input: the planner opens Implement for each
// expect: with the plan, the route offers the steps of the plan alone — ITM-101 and ITM-103, the steps ready — and starts jobs for no other work; without a plan, it says the product has no implementation plan yet, links to Plan, and offers no Start jobs
test("TST-1061011: UC-045 5 from the saved plan on, implementation jobs are offered for the steps of the plan only", async () => {
  const withPlan = await openPlan("implement", {}, { files: await planned({ files: GATES }) });
  try {
    const startable = [...plain(withPlan.html()).matchAll(/\b(ITM-\d{3}) Participant/g)].map((m) => m[1]);
    assert.deepEqual(startable, ["ITM-101", "ITM-103"], "known positive: the steps that are ready are offered a participant");
    assert.match(plain(withPlan.html()), /Start jobs/);
    assert.deepEqual([...plain(withPlan.html()).matchAll(/\b(ITM-\d{3}) (?:Implementation|Testing) /g)].map((m) => m[1]), ["ITM-101", "ITM-102", "ITM-103", "ITM-104", "ITM-105", "ITM-106"], "the page lists the six steps of the plan and no other work");
  } finally { withPlan.done(); }
  const without_ = await openPlan("implement", {}, { files: await planned({ plan: false, files: GATES }) });
  try {
    assert.match(plain(without_.html()), /no implementation plan yet, so there is nothing to start/);
    assert.ok(hrefs(without_).includes("#plan"), "it links to Plan");
    assert.doesNotMatch(plain(without_.html()), /Start jobs/);
  } finally { without_.done(); }
});

// ---------------------------------------------------------------- the alternative flows 1a to 1d

// TST-1061012 · level: system · module: system
// guards: UC-045; THE PROCESS MODEL IS DECLARED PER PRODUCT
// given: the planned product; the same product whose declared model is a Scrum model, which works from a backlog; known positive: the V-model product reads the plan
// input: the planner opens Plan for each
// expect: the V-model product reads the architecture and draws steps; the Scrum product says its model works from a backlog and has no implementation plan, links to the backlog (#backlog), shows no step, no architecture and no Draft the plan, and reads none of the architecture's files and no stored graph
test("TST-1061012: UC-045 1a a product whose model works from a backlog has no plan and links to the backlog", async () => {
  const planned_ = await openPlan("plan", {}, { files: await planned() });
  try {
    assert.ok(stepsOf(planned_).length > 0, "known positive: the V-model draws its steps");
    assert.ok(planned_.srv.requests.some((request) => request.startsWith("history docs/plan/")), "known positive: the planned model reads the history of the plan");
  } finally { planned_.done(); }
  const page = await openPlan("plan", {}, { files: await planned(), instance: instanceFiles({ model: SCRUM_MODEL }) });
  try {
    assert.match(plain(page.html()), /works from a backlog and has no implementation plan/);
    assert.ok(hrefs(page).includes("#backlog"));
    assert.equal(stepsOf(page).length, 0);
    assert.equal(found(page.target, "[data-architecture]").length, 0);
    assert.equal(found(page.target, "[data-draft-plan]").length, 0);
    assert.deepEqual(page.srv.requests.filter((request) => /architecture|stored graph|history/.test(request)), [], "the architecture is not read");
  } finally { page.done(); }
});

// TST-1061013 · level: system · module: system
// guards: UC-045; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS
// given: the planned product whose MOD-mail has no approval record (open), and the planned product whose MOD-store was changed after it was accepted (an approval record names an earlier text)
// input: the planner opens Plan for each
// expect: the page names docs/architecture/MOD-mail.md as open, and docs/architecture/MOD-store.md as changed since it was accepted, and no accepted file; it links to the architecture (#arc); nothing is planned — no step, no architecture list, no Draft the plan, no + Step and no diagram
test("TST-1061013: UC-045 1b an architecture that is not accepted is named, the page links to the architecture and nothing is planned", async () => {
  const changed = await planned();
  changed[modulePath("MOD-store")] += "\nA line added after the acceptance.\n";
  for (const [files, named, status, spared] of [[await planned({ open: [modulePath("MOD-mail")] }), "docs/architecture/MOD-mail.md", "open", "MOD-pages.md"], [changed, "docs/architecture/MOD-store.md", "changed since it was accepted", "MOD-mail.md"]]) {
    const page = await openPlan("plan", {}, { files });
    try {
      const said = plain(page.html());
      assert.ok(said.includes(`${named} — ${status}`), `${named} is named as ${status}`);
      assert.ok(!said.includes(spared), `${spared} is accepted and not named`);
      assert.ok(hrefs(page).some((href) => href.startsWith("#arc")), "it links to the architecture");
      assert.equal(stepsOf(page).length, 0);
      assert.equal(found(page.target, "[data-architecture]").length, 0);
      assert.equal(found(page.target, "[data-draft-plan]").length + found(page.target, "[data-add-step]").length, 0, "nothing can be planned");
      assert.equal(found(page.target, "[data-plan-diagram]").length, 0);
    } finally { page.done(); }
  }
});

// TST-1061014 · level: system · module: system
// guards: UC-045; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: the plan of six steps saved on 2026-10-01; the architecture's files older, except MOD-store and ARC-003, changed on 2026-10-10; a step ITM-107 for a module MOD-gone that the architecture no longer holds; a module MOD-added, accepted, that no step implements; known positive: with no file newer than the steps no step is marked
// input: the planner opens Plan
// expect: known positive — no mark; then ITM-101 and ITM-104, the steps that implement or integrate MOD-store, are marked "docs/architecture/MOD-store.md was changed after the step", ITM-105 "docs/architecture/ARC-003-mail.md was changed after the step ITM-105", ITM-107 "the file docs/architecture/MOD-gone.md ... was removed from the architecture"; MOD-added is marked "has no step"; no other step is marked; nothing is written; Draft the plan is still offered
test("TST-1061014: UC-045 1c the steps of changed, added or removed modules and subsystems are marked, and nothing changes until the planner saves", async () => {
  const SAVED = "2026-10-01T09:00:00Z", LATER = "2026-10-10T09:00:00Z", EARLIER = "2026-09-20T09:00:00Z";
  const files = await planned({ files: { [stepPath(107, "gone")]: stepText(107, "Gone", { modules: ["MOD-gone"] }), [modulePath("MOD-added")]: moduleText("MOD-added") } });
  const dates = (over = {}) => ({ ...Object.fromEntries(Object.keys(files).map((path) => [path, path.startsWith("docs/plan/") ? SAVED : EARLIER])), ...over });
  const unmoved = await openPlan("plan", {}, { files, dates: dates() });
  try { for (const id of ["ITM-101", "ITM-102", "ITM-103", "ITM-104", "ITM-105", "ITM-106"]) assert.deepEqual(marksOf(rowOf(unmoved, id)), [], `known positive: ${id}`); } finally { unmoved.done(); }
  const page = await openPlan("plan", {}, { files, dates: dates({ [modulePath("MOD-store")]: LATER, [ARC_PATHS.mail]: LATER }) });
  try {
    assert.deepEqual(marksOf(rowOf(page, "ITM-101")), ["docs/architecture/MOD-store.md was changed after the step ITM-101"]);
    assert.deepEqual(marksOf(rowOf(page, "ITM-104")), ["docs/architecture/MOD-store.md was changed after the step ITM-104"]);
    assert.deepEqual(marksOf(rowOf(page, "ITM-105")), ["docs/architecture/ARC-003-mail.md was changed after the step ITM-105"]);
    assert.match(marksOf(rowOf(page, "ITM-107")).join(" "), /docs\/architecture\/MOD-gone\.md of the step ITM-107 was removed from the architecture/);
    for (const id of ["ITM-102", "ITM-103", "ITM-106"]) assert.deepEqual(marksOf(rowOf(page, id)), [], id);
    assert.match(textOf(archRowOf(page, "MOD-added")), /MOD-added has no step/);
    assert.doesNotMatch(textOf(archRowOf(page, "MOD-pages")), /has no step/);
    assert.deepEqual(page.srv.writes, [], "the marks write nothing: the plan stands until the planner saves");
    assert.equal(found(page.target, "[data-draft-plan]").length, 1, "the planner can draft the plan again");
  } finally { page.done(); }
});

// TST-1061015 · level: system · module: system
// guards: UC-045; A GENERATED ARTIFACT IS A PROPOSAL; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// given: the draft of TST-1061005 on the page; the participant local-llm drafted it under the job JOB-<id>
// input: the planner presses Save plan
// expect: the commit's message carries the provenance of the draft — Agent-M-Job with the job's identifier, Agent-M-Kind: draft-plan, Agent-M-Participant: local-llm and Agent-M-Model: model-a —, and the job's record is in the product's docs/jobs/ with the participant, so that the plan is committed under the name of its drafting participant; no plan file holds the participant's name
test("TST-1061015: UC-045 1d a drafted plan is committed under the name of the participant that drafted it", async () => {
  const { page } = await drafted(await planned({ plan: false }), DRAFT);
  try {
    await page.press(savePlan(page));
    await waitFor(() => saved(page).length > 0);
    const [write] = planWrites(page);
    assert.ok(write, textOf(page.target));
    assert.match(write.message, /^Agent-M-Job: JOB-\d{8}-\d{4}-[0-9a-f]{4}$/m);
    assert.match(write.message, /^Agent-M-Kind: draft-plan$/m);
    assert.match(write.message, /^Agent-M-Participant: local-llm$/m);
    assert.match(write.message, /^Agent-M-Model: model-a$/m);
    assert.ok(page.srv.writes.some((each) => Object.keys(each.files).some((path) => /^docs\/jobs\/JOB-/.test(path) && /participant: local-llm/.test(each.files[path]))), "the job record names the participant");
    for (const [path, text] of Object.entries(write.files)) assert.doesNotMatch(text, /local-llm/, `${path} holds no participant's name`);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- the alternative flows 2a and 2b

// TST-1061016 · level: system · module: system
// guards: UC-045; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: the planned product without a plan; the planner's token stored
// input: the planner presses + Step six times and types the six steps of DRAFT; then Save plan; known negative first — the same plan without the step of the system
// expect: the plan without the system step is refused: nothing is written, the page says the plan is not saved and shows "the system (ARC-001) has no step", the steps stay as typed and Save plan is offered again; the complete plan is committed in one commit on the default branch (a tree, a commit and the move of the branch) with the planner's token, of six step files and docs/plan/order.md, and the commit's message holds no provenance line (no line opens with "Agent-M-"); no job is prepared (AGENTS.md is not read)
test("TST-1061016: UC-045 2a a plan written by hand with + Step is checked when Save plan is pressed and committed as the planner's own input", async () => {
  const refusedPage = await byHandSaved(DRAFT.steps.slice(0, 5));
  try {
    assert.deepEqual(planWrites(refusedPage), [], "nothing is written");
    assert.match(saved(refusedPage), /not saved/);
    assert.match(textOf(classed(found(refusedPage.target, "[data-plan-saved]")[0], "error")[0]), /the system \(ARC-001\) has no step/);
    assert.deepEqual(titles(refusedPage), ["Store", "Pages", "Mail", "Storage", "Mailing"], "the steps stay as typed");
    assert.equal(savePlan(refusedPage).disabled, false, "Save plan is offered again");
  } finally { refusedPage.done(); }
  const page = await byHandSaved(DRAFT.steps);
  try {
    const writes = planWrites(page);
    assert.equal(writes.length, 1, saved(page));
    assert.equal(Object.keys(writes[0].files).length, 7);
    assert.ok(page.srv.requests.filter((request) => /^write /.test(request)).join(",").endsWith("write tree,write commit,write ref"), "directly on the default branch");
    assert.doesNotMatch(writes[0].message, /^Agent-M-/m, "the planner's own input carries no provenance line");
    assert.equal(page.srv.requests.filter((request) => request === "file AGENTS.md").length, 0, "no job is prepared");
  } finally { page.done(); }
});

// TST-1061017 · level: system · module: system
// guards: UC-045; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY; THE PAGE NAMES WHERE IT SENDS
// given: the planned product without a plan; the participant local-llm whose context holds 300 tokens, and cloud-llm whose context holds 200000, at "a provider in the USA"; known positive: the same product with local-llm's context at 200000 sends
// input: the planner presses Draft the plan with local-llm chosen
// expect: the run panel says local-llm cannot hold what it would receive (832 tokens against its 300) and names the files it would receive; nothing is sent; cloud-llm is offered, with its context; with cloud-llm chosen the panel fits (no refusal), and Run sends to its endpoint ep2
test("TST-1061017: UC-045 2b an input that does not fit the participant's context is not sent; the page says so and offers a participant with a larger context", async () => {
  const roomy = await drafting({ files: await planned({ plan: false }) }, DRAFT);
  try { assert.doesNotMatch(textOf(classed(roomy.page.target, "run-panel")[0]), /cannot hold/, "known positive: the context holds the input"); } finally { roomy.page.done(); }
  const small = PARTICIPANTS.replace("| local-llm | model endpoint | model-a | 200000 |", "| local-llm | model endpoint | model-a | 300 |");
  const { page, asked } = await drafting({ files: await planned({ plan: false }), instance: instanceFiles({ participants: small }) }, DRAFT);
  try {
    const panel = textOf(classed(page.target, "run-panel")[0]);
    assert.match(panel, /local-llm cannot hold what it would receive: \d+ tokens, its context holds 300/);
    assert.ok(panel.includes("docs/architecture/MOD-pages.md"), "it names what would be sent");
    assert.equal(asked.length, 0, "nothing is sent");
    const offered = walk(found(page.target, "[data-draft-participant]")[0], (node) => node.localName === "option").map((option) => option.getAttribute("value"));
    assert.ok(offered.includes("cloud-llm"), "a participant with a larger context is offered");
    await choose(found(page.target, "[data-draft-participant]")[0], "cloud-llm");
    await waitFor(() => /cloud-llm/.test(textOf(classed(page.target, "run-panel")[0] ?? page.target)));
    await run(page);
    assert.deepEqual(asked.map((request) => request.origin), ["https://ep2.example.test"], "Run sends to cloud-llm's endpoint");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- the alternative flows 3a and 3b

// TST-1061018 · level: system · module: system
// guards: UC-045; MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE; A RUN FOLLOWS THE MODULES' INTERFACES
// given: the planned product without a plan in which MOD-store uses MOD-pages.read and MOD-pages uses MOD-store.read; local-llm answers the draft of TST-1061005 every time
// input: the planner presses Draft the plan and Run; then Save plan
// expect: the draft is shown with a finding that names the modules of the cycle, "the uses of MOD-pages, MOD-store form a cycle" [MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE]; Save plan writes nothing and the page says the plan is not saved, naming the cycle
test("TST-1061018: UC-045 3a modules whose interfaces form a cycle are named, and no plan is saved", async () => {
  const files = await planned({ plan: false, files: architecture({ uses: { "MOD-store": ["MOD-pages.read"], "MOD-pages": ["MOD-store.read"] } }) });
  const { page } = await drafted(files, DRAFT);
  try {
    assert.match(textOf(found(page.target, "[data-plan-draft]")[0]), /the uses of MOD-pages, MOD-store form a cycle[^]*\[MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE\]/);
    await page.press(savePlan(page));
    assert.deepEqual(planWrites(page), [], "nothing is saved");
    assert.match(saved(page), /not saved[^]*the uses of MOD-pages, MOD-store form a cycle/);
  } finally { page.done(); }
});

// TST-1061019 · level: system · module: system
// guards: UC-045; MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE
// given: the product of TST-1061018 and its draft with the finding of the cycle
// input: the planner reads the page
// expect: UC-045 3a "No order exists; Agent M names the modules of the cycle and links to UC-023 to change the architecture": the page holds a link to the architecture (#arc) beside the finding of the cycle, where the planner changes the architecture
test("TST-1061019: UC-045 3a the page links to the change of the architecture beside the cycle", async () => {
  const files = await planned({ plan: false, files: architecture({ uses: { "MOD-store": ["MOD-pages.read"], "MOD-pages": ["MOD-store.read"] } }) });
  const { page } = await drafted(files, DRAFT);
  try {
    assert.match(textOf(found(page.target, "[data-plan-draft]")[0]), /form a cycle/, "known positive: the cycle is named");
    const draft = found(page.target, "[data-plan-draft]")[0];
    assert.ok(walk(draft, (node) => node.localName === "a" && String(node.getAttribute("href")).startsWith("#arc")).length > 0, "a link to the architecture beside the findings");
  } finally { page.done(); }
});

// TST-1061020 · level: system · module: system
// guards: UC-045; THE CORRECTION LOOP HAS A FIXED LIMIT; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: the planned product without a plan; local-llm answers the draft without the step Mail every time, so that the round after the first leaves the findings unchanged
// input: the planner presses Draft the plan and Run; then + Step, naming Mail (MOD-mail, unit, Implementation), and Save plan
// expect: the draft is shown with the finding "MOD-mail has no step" above its five steps and the number of correction rounds; the planner adds the step and Save plan commits the six steps (known positive: the same plan without the added step is refused); the participant was asked twice and no more
test("TST-1061020: UC-045 3b a draft with findings left after the last round is shown with each finding; the planner corrects it and saves", async () => {
  const { page, asked } = await drafted(await planned({ plan: false }), without("Mail"));
  try {
    assert.equal(asked.length, 2, "asked again once, and no more when the findings stay");
    const shown = textOf(found(page.target, "[data-plan-draft]")[0]);
    assert.match(shown, /Findings left after the last round:error: MOD-mail has no step — add a step of level module for MOD-mail \[AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES\]/);
    assert.match(shown, /correction rounds: 2/);
    assert.deepEqual(titles(page), ["Store", "Pages", "Storage", "Mailing", "Whole"]);
    await page.press(savePlan(page));
    assert.deepEqual(planWrites(page), [], "known positive: the draft as it is cannot be saved");
    assert.match(saved(page), /not saved[^]*MOD-mail has no step/);
    await byHand(page, [S.Mail]);
    for (let moves = 0; moves < 3; moves += 1) await page.press(found(boxOf(page, "Mail"), "[data-step-up]")[0]);
    assert.deepEqual(titles(page), ["Store", "Pages", "Mail", "Storage", "Mailing", "Whole"], "Mail stands before the integrations and the system");
    await page.press(savePlan(page));
    await waitFor(() => planWrites(page).length > 0);
    assert.equal(planWrites(page).length, 1, saved(page));
    assert.equal(Object.keys(planWrites(page)[0].files).length, 7);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- findings of the plan's order and of the plan written by hand

// TST-1061021 · level: system · module: system
// guards: UC-045; AN IMPLEMENTATION PLAN ASSEMBLES THE SYSTEM FROM ITS MODULES
// given: the planned product without a plan; the six steps of DRAFT written by hand with + Step in the order Whole (the system), Storage, Mailing, Store, Pages, Mail; known positive: the same steps in the order of DRAFT are committed
// input: the planner presses Save plan
// expect: UC-045 step 3 and the SPEC's rule order the modules of each subsystem, "then the integration of each subsystem, then the system": a plan whose system step comes before the steps of the modules and subsystems it integrates is refused, nothing is written
test("TST-1061021: UC-045 3 a plan that orders the system, or a subsystem's integration, before the steps it integrates is refused", async () => {
  const good = await byHandSaved(DRAFT.steps);
  try { assert.equal(planWrites(good).length, 1, "known positive: the plan in the order of the interfaces is committed"); } finally { good.done(); }
  const page = await byHandSaved([S.Whole, S.Storage, S.Mailing, S.Store, S.Pages, S.Mail].map((step) => ({ ...step, after: [] })));
  try {
    assert.deepEqual(planWrites(page), [], "nothing is written");
    assert.match(saved(page), /not saved/);
  } finally { page.done(); }
});

// TST-1061022 · level: system · module: system
// guards: UC-045; A PLAN STEP NAMES THE TESTS OF ITS LEVEL; THE MODEL DETERMINES THE PHASES AND THE GATES
// given: the planned product without a plan; the six steps of DRAFT written by hand with + Step, with the level of the tests of Store left empty; again with the phase of Store left empty; known positive: a step with the level of another step's tests (component for Store) is refused with a finding
// input: the planner presses Save plan, for each
// expect: UC-045 2a "the check of step 3 runs when they press Save plan": the plan is refused with a finding that names the step and the rule, "[A PLAN STEP NAMES THE TESTS OF ITS LEVEL]" for the empty level and "[THE MODEL DETERMINES THE PHASES AND THE GATES]" for the empty phase, as the same plan drafted by a participant is; nothing is written
test("TST-1061022: UC-045 2a a step written by hand without the level of its tests or without a phase is refused with a finding, not with an error of the page", async () => {
  const wrong = await byHandSaved(DRAFT.steps.map((step) => (step.title === "Store" ? { ...step, level: "component" } : step)));
  try {
    assert.match(saved(wrong), /\[A PLAN STEP NAMES THE TESTS OF ITS LEVEL\]/, "known positive: a level of another step is a finding");
  } finally { wrong.done(); }
  const noLevel = await byHandSaved(DRAFT.steps.map((step) => (step.title === "Store" ? { ...step, level: "" } : step)));
  const noPhase = await byHandSaved(DRAFT.steps.map((step) => (step.title === "Store" ? { ...step, phase: "" } : step)));
  try {
    assert.deepEqual([...planWrites(noLevel), ...planWrites(noPhase)], [], "nothing is written");
    assert.match(saved(noLevel), /\[A PLAN STEP NAMES THE TESTS OF ITS LEVEL\]/);
    assert.match(saved(noPhase), /\[THE MODEL DETERMINES THE PHASES AND THE GATES\]/);
  } finally { noLevel.done(); noPhase.done(); }
});
