// Release tests of the requirements UC-031 "Configure a process model" realises that tests/release-uc-031-configure-a-process-model.test.mjs (TST-779101 to TST-779112) does not guard by name: THE MODEL DETERMINES THE PHASES AND
// THE GATES, A GATE NAMES WHAT IT CHECKS, A GATE NAMES WHO DECIDES IT, A PROCESS MODEL ORGANISES PEOPLE AND AGENTS, A ROLE NAMES THE CAPABILITIES IT NEEDS, PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE, EVERY STEP EXPLAINS
// ITSELF (on the list of the models) and THE CATALOGUE IS DATA (what Save commits). TST-802301 maps each of the thirteen requirements UC-031 realises to the release tests that guard it, those of ITM-776, ITM-777 and ITM-779 among them.
// Each case ends at what the author reads on the page of the models and at the file the author's click committed, read back by MOD-model-catalogue as UC-002 reads it, and, where a requirement is about what the model is used
// for, at the workflow, the role assignment findings and the progress page of a product that declares the saved model.
// Run: node --test tests/release-uc-031-requirements-of-a-model.test.mjs
//
// Module: MOD-implementation-pages
// Module: MOD-model-catalogue
// Guards: UC-031
// Level: release
//
// Written for the release testing of sprint 141 by developer-sonnet-l (ITM-802), who implemented none of ITM-776, ITM-777, ITM-778, ITM-779 or ITM-780 and no UC-031 production behaviour (RELEASE TESTS ARE NOT WRITTEN BY THE
// IMPLEMENTER). The page is reached as the address #models/name=<name> leads to it (tests/uc-031-harness.mjs). Where the page and UC-031 or the SPEC disagree the case follows the text and is marked `todo` with the word
// FINDING. Readings the texts leave open, which the cases state:
//   - "A role names the capabilities it needs ... only a participant with all of them can be assigned to it" is guarded in the model through the role's capabilities as saved, and in a product through the findings of its role assignment
//     (MOD-product-process' roleAssignmentFindings), which name a holder that lacks one.
//   - "whether a person, an agent, or either may fill it" is read as: a role that only an agent may fill is not filled by a person of the instance's list.
//   - "The process dashboard shows a product's progress in the measure its model definition names" is read as: the measure the saved definition names is the one the progress page of a product that declares it draws; the page draws
//     the burn-down for remaining items per time box, the board's cumulative flow for items per state over time, the grid of requirements by phases for plan entries per phase.
//   - "Every part carries a folded What is this?" is read, on the list of the models, as: each of its parts (the shipped models, the instance's own, the kind of work, the products) carries a folded `details` headed What is this?
//     that points to chapter 6 or chapter 7 of the book.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, statSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { participantSchema } from "../src/participant-list/index.mjs";
import { declarationSchema, roleAssignmentFindings, roleAssignmentSchema, workflowOf } from "../src/product-process/index.mjs";
import { PHASES, SHIPPED, addRow, besideKey, besideSection, catalogueAfter, classed, commitsOf, declaration, declares, disabledOf, edit, entryOf, products, reach, read, replaceIn, saveOf, snapshotOf, specOf, typeKey, walk }
  from "./uc-031-harness.mjs";
import { product, open as openRoute, settle as settleRoute, found } from "./uc-032-harness.mjs";
import { catalogue } from "../src/model-catalogue/index.mjs";

const UC = "docs/use-cases/UC-031-configure-a-process-model.md";
const SELF = "tests/release-uc-031-requirements-of-a-model.test.mjs";
const MINE = "tests/release-uc-031-configure-a-process-model.test.mjs";

// ---------------------------------------------------------------- the map

// Each requirement UC-031 realises, with the release tests that guard it. The tests of ITM-776 and ITM-777 are the Python files named; the others stand in the files of this battery and of ITM-779.
const EVIDENCE = {
  "A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED": [[MINE, "TST-779102"], [MINE, "TST-779103"]],
  "A PLAN COVERS THE WHOLE SPECIFICATION": [[MINE, "TST-779104"], ["tests/test_plan_coverage.py", "TST-777001"]],
  "THE CATALOGUE IS DATA": [["tests/test_catalogue_is_data.py", "TST-840010"], [SELF, "TST-802310"]],
  "THE MODEL DETERMINES THE PHASES AND THE GATES": [[SELF, "TST-802302"]],
  "A GATE NAMES WHAT IT CHECKS": [[SELF, "TST-802303"]],
  "A PROCESS MODEL ORGANISES PEOPLE AND AGENTS": [[SELF, "TST-802304"]],
  "A ROLE NAMES THE CAPABILITIES IT NEEDS": [[SELF, "TST-802305"]],
  "PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE": [[SELF, "TST-802306"], [SELF, "TST-802307"]],
  "A PERSON'S OWN INPUT IS COMMITTED DIRECTLY": [[MINE, "TST-779101"]],
  "DIAGRAMS ARE MERMAID IN MARKDOWN": [[MINE, "TST-779101"]],
  "ONE CLICK PER DECISION": [[MINE, "TST-779101"]],
  "EVERY STEP EXPLAINS ITSELF": [[MINE, "TST-779111"], [SELF, "TST-802308"]],
  "A GATE NAMES WHO DECIDES IT": [[SELF, "TST-802309"]],
};

// TST-802301 · level: release · module: system
// guards: UC-031
// given: UC-031 as committed text, whose `realises` lists thirteen requirements, and the release tests named in EVIDENCE
// input: read UC-031's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-031 realises these thirteen requirements; each has at least one test named; each test named stands in its file with the level release and guards that requirement
test("TST-802301: UC-031 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 13, "known positive: UC-031 realises thirteen requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-031 realises");
  for (const [requirement, named] of Object.entries(EVIDENCE)) {
    assert.ok(named.length > 0, `${requirement}: a test is named`);
    for (const [file, id] of named) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${requirement}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
});

// ---------------------------------------------------------------- fixtures of the cases

const MODEL_PATH = (name) => `docs/process-models/${name}.md`;
const SPEC = specOf("A LOAN HAS A DUE DATE", "A LATE LOAN IS NAMED");
// The product's declaration of the model saved at `name`, read as MOD-product-process reads it.
const declarationOf = (name) => readDocument(declarationSchema, "docs/process.md", declaration(MODEL_PATH(name)));
// The instance's participants: alice, a person; dev-a and dev-b, agents with every capability a builder needs; local-llm, an agent that drafts text only.
const EVERY = "draft text, read the repository, write to the repository, run code and tests, use tools";
const registerOf = () => readDocument(participantSchema(), "docs/participants.md", ["# Participants of this instance", "", "**REGISTER**", "", "The people and agents of the test instance.", "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |", "|---|---|---|---|---|---|---|---|",
  `| alice | person | — | — | — | ${EVERY} | — | account github.com/alice |`,
  `| dev-a | CLI agent | example-model | 200000 | — | ${EVERY} | this machine | bridge lab-pc agent claude |`,
  `| dev-b | CLI agent | example-model | 200000 | — | ${EVERY} | this machine | bridge lab-pc agent claude |`,
  "| local-llm | model endpoint | model-a | 200000 | — | draft text | this machine | endpoint ep1 |", ""].join("\n"));
const assignmentOf = (...rows) => readDocument(roleAssignmentSchema, "docs/role-assignments/team.md", ["# Team", "", "## Roles", "", "| Role | Participants |", "|---|---|", ...rows.map(([role, who]) => `| ${role} | ${who} |`), ""].join("\n"));
/** The model `name` as the catalogue reads it from the commits of `page`, with the findings it has. */
async function savedModel(page, name) {
  const read = await catalogueAfter(page);
  return { model: read.models.find((candidate) => candidate.name === name), findings: read.findings[MODEL_PATH(name)] ?? [] };
}
/** The adapted copy of the shipped model `from` under the name `name`, edited by `typing(page)` and saved by the person's click. */
async function adaptedAndSaved(from, name, typing = async () => {}) {
  const page = await edit(from);
  await typing(page);
  await typeKey(page, "name", name);
  assert.equal(disabledOf(saveOf(page)), false, `${name}: the definition has no error, so Save is available`);
  await page.press(saveOf(page));
  assert.equal(commitsOf(page).length, 1, `${name}: one click, one commit`);
  return page;
}

// ---------------------------------------------------------------- the model determines the phases and the gates

// TST-802302 · level: release · module: system
// guards: THE MODEL DETERMINES THE PHASES AND THE GATES; UC-031
// given: the shipped V-model (7 phases, 3 gates, 3 verification pairs, 4 roles); a product that declares the model the author saves; the instance's SPEC holds no process requirement
// input: the author adapts the V-model: adds the phase Security review (role Reviewer) after Implementation in the transitions (Implementation → Security review → Testing), the verification pair Security review checked by Design, and the gate Implementation → Security review decided by Reviewer; presses Save; the workflow of the product is derived from the saved file
// expect: the saved model names 8 phases (the 7 and Security review, whose role is Reviewer), the two transitions in place of Implementation → Testing, 4 verification pairs, 4 gates (the 3 and the new one, decided by Reviewer) and the 4 roles; the workflow holds exactly that and nothing besides; known positive: the workflow of the shipped V-model holds 7 phases, 3 gates and 3 pairs
test("TST-802302: UC-031 the phases, transitions, verification pairs and gates the author saves are the workflow of a product that declares the model", async () => {
  const shipped = (await catalogue(snapshotOf(SHIPPED))).models.find((candidate) => candidate.name === "v-model");
  const before = workflowOf(declarationOf("v-model"), shipped, [], SPEC);
  assert.equal(before.phases.length, 7, "known positive: the shipped V-model has seven phases");
  assert.equal(before.gates.length, 3);
  assert.equal(before.pairs.length, 3);
  const page = await adaptedAndSaved("v-model", "v-model-with-security-review", async (editor) => {
    await replaceIn(editor, "## Transitions", "| Implementation | Testing | sequence |", "| Implementation | Security review | sequence |\n| Security review | Testing | sequence |");
    await addRow(editor, "## Phases", "| Security review | Reviewer | — |");
    await addRow(editor, "## Verification pairs", "| Security review | Design |");
    await addRow(editor, "## Gates", "| Implementation → Security review | the MOD files of the implementation | the code has been read for its security | Reviewer |");
  });
  try {
    const { model, findings } = await savedModel(page, "v-model-with-security-review");
    assert.deepEqual(findings, [], "the catalogue reads the saved model without a finding");
    const workflow = workflowOf(declarationOf("v-model-with-security-review"), model, [], SPEC);
    assert.deepEqual(workflow.phases.map((phase) => phase.name), [...PHASES, "Security review"]);
    assert.deepEqual(workflow.phases.find((phase) => phase.name === "Security review").roles, ["Reviewer"]);
    const steps = workflow.transitions.map((transition) => `${transition.from} → ${transition.to}`);
    assert.ok(steps.includes("Implementation → Security review") && steps.includes("Security review → Testing"), "the two new transitions");
    assert.equal(steps.includes("Implementation → Testing"), false, "the transition the author replaced is gone");
    assert.equal(workflow.pairs.length, 4);
    assert.ok(workflow.pairs.some((pair) => pair.phase === "Security review" && pair.checkedBy === "Design"));
    assert.deepEqual(workflow.gates.map((gate) => gate.name), ["Requirements → Design", "Design → Implementation", "Validation & Verification → Operation & Maintenance", "Implementation → Security review"]);
    assert.equal(workflow.gates.at(-1).decider, "Reviewer");
    assert.deepEqual(workflow.roles.map((role) => role.name), ["Product owner", "Developer", "Tester", "Reviewer"], "no role is added to the model's");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- a gate names what it checks

// TST-802303 · level: release · module: system
// guards: A GATE NAMES WHAT IT CHECKS; UC-031
// given: the editor on the adapted V-model, whose phase Design produces the ARC files and whose phase Implementation produces MOD
// input: the author adds the gate Implementation → Testing that checks "the threat model ARC", then moves the same gate to stand between Requirements and Design; then types a gate whose artifacts and condition are both left out; the person saves the first
// expect: UC-031 step 3 and 4: the gate after Design is accepted and Save is available (the ARC is produced by a phase before it); between Requirements and Design the Gates part names the gate and the kind ARC, which no phase up to Requirements produces, and Save is unavailable; with artifacts and condition left out the Gates part names both; the saved gate carries the artifacts and the condition as typed
test("TST-802303: UC-031 a gate names the artifacts that must exist, which an earlier phase produces, and the condition that must hold", async () => {
  const page = await edit("v-model");
  try {
    const gate = "| Implementation → Testing | the threat model ARC | a person has accepted the threat model | Reviewer |";
    await addRow(page, "## Gates", gate);
    assert.equal(besideSection(page, "## Gates"), "", "known positive: ARC is produced by Design, before Implementation");
    assert.equal(disabledOf(saveOf(page)), false);
    await replaceIn(page, "## Gates", gate, "| Requirements → Design | the threat model ARC | a person has accepted the threat model | Reviewer |");
    assert.match(besideSection(page, "## Gates"), /ARC/, "a gate that checks an artifact kind no earlier phase produces is named beside Gates");
    assert.equal(disabledOf(saveOf(page)), true);
    await page.press(saveOf(page));
    assert.equal(commitsOf(page).length, 0, "nothing is committed with the finding");
    await replaceIn(page, "## Gates", "| Requirements → Design | the threat model ARC | a person has accepted the threat model | Reviewer |", "| Implementation → Testing |  |  | Reviewer |");
    const beside = besideSection(page, "## Gates");
    assert.match(beside, /artifacts/i, "a gate without artifacts is named");
    assert.match(beside, /condition/i, "a gate without a condition is named");
    assert.equal(disabledOf(saveOf(page)), true);
    await replaceIn(page, "## Gates", "| Implementation → Testing |  |  | Reviewer |", gate);
    await typeKey(page, "name", "v-model-threat-model");
    await page.press(saveOf(page));
    const { model } = await savedModel(page, "v-model-threat-model");
    const saved = model.gates.find((candidate) => candidate.from === "Implementation" && candidate.to === "Testing");
    assert.equal(saved.artifacts, "the threat model ARC");
    assert.equal(saved.condition, "a person has accepted the threat model");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- a gate names who decides it

// TST-802309 · level: release · module: system
// guards: A GATE NAMES WHO DECIDES IT; UC-031
// given: the editor on the adapted V-model, whose roles are Product owner, Developer, Tester and Reviewer
// input: the author gives the new gate Implementation → Testing, in turn, the decider Reviewer (a role of the model), "check: agent-m done" (a named CI check), "Nobody" (no role of the model) and "check:" (a check with no name); the person presses Save on the first two and on the last two
// expect: UC-031 step 4 and the SPEC: a role of the model and a named CI check are both accepted and saved — the catalogue reads the decider as typed; "Nobody" and the nameless check are each named beside Gates, Save is unavailable and the click commits nothing
test("TST-802309: UC-031 a gate is decided by a role of the model or by a named CI check, and by nothing else", async () => {
  const gate = (decider) => `| Implementation → Testing | the MOD files | the code is reviewed | ${decider} |`;
  for (const decider of ["Reviewer", "check: agent-m done"]) {
    const page = await edit("v-model");
    try {
      await addRow(page, "## Gates", gate(decider));
      assert.equal(besideSection(page, "## Gates"), "", `${decider}: no finding`);
      await typeKey(page, "name", "v-model-decided");
      assert.equal(disabledOf(saveOf(page)), false, `${decider}: Save is available`);
      await page.press(saveOf(page));
      assert.equal(commitsOf(page).length, 1);
      const { model, findings } = await savedModel(page, "v-model-decided");
      assert.deepEqual(findings, []);
      assert.equal(model.gates.find((candidate) => candidate.from === "Implementation" && candidate.to === "Testing").decider, decider);
    } finally { page.done(); }
  }
  for (const [decider, naming] of [["Nobody", /Nobody/], ["check:", /decider|check/i]]) {
    const page = await edit("v-model");
    try {
      await addRow(page, "## Gates", gate(decider));
      assert.match(besideSection(page, "## Gates"), naming, `${decider}: named beside Gates`);
      assert.equal(disabledOf(saveOf(page)), true, `${decider}: Save is unavailable`);
      await page.press(saveOf(page));
      assert.equal(commitsOf(page).length, 0, `${decider}: nothing is committed`);
    } finally { page.done(); }
  }
});

// ---------------------------------------------------------------- a process model organises people and agents

// TST-802304 · level: release · module: system
// guards: A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; UC-031
// given: the editor on the adapted V-model; the instance's participants alice (a person), dev-a and dev-b (agents with every capability) and local-llm (an agent that drafts text only)
// input: the author adds the role Auditor that only a person may fill (person), the role Scanner that only an agent may fill (agent) and the role Guest (either); gives a phase a role the model does not define; types the value "robot" as who fills a role; presses Save; the role assignments of a product that declares the saved model are judged
// expect: a phase naming a role the model lacks, and a role filled by "robot", are each named beside their part and block Save; the three values person, agent and either are saved and read back as typed; a role assignment that gives Auditor to the agents alone is an error naming Auditor, and the same assignment with alice is none
test("TST-802304: UC-031 the model names for each role whether a person, an agent or either fills it, and a role that needs a person has one", async () => {
  const roles = ["| Auditor | person | one | read the repository |", "| Scanner | agent | one | read the repository, run code and tests |", "| Guest | either | several | read the repository |"];
  const page = await edit("v-model");
  try {
    for (const row of roles) await addRow(page, "## Roles", row);
    await replaceIn(page, "## Phases", "| Concept | Product owner | — |", "| Concept | Product owner, Janitor | — |");
    assert.match(besideSection(page, "## Phases"), /Janitor/, "a phase that names a role the model does not define is named beside Phases");
    assert.equal(disabledOf(saveOf(page)), true);
    await replaceIn(page, "## Phases", "| Concept | Product owner, Janitor | — |", "| Concept | Product owner | — |");
    await replaceIn(page, "## Roles", roles[2], "| Guest | robot | several | read the repository |");
    assert.match(besideSection(page, "## Roles"), /robot|Filled by/i, "a value of who fills a role that is none of person, agent, either is named beside Roles");
    assert.equal(disabledOf(saveOf(page)), true);
    await page.press(saveOf(page));
    assert.equal(commitsOf(page).length, 0);
    await replaceIn(page, "## Roles", "| Guest | robot | several | read the repository |", roles[2]);
    await typeKey(page, "name", "v-model-people-and-agents");
    await page.press(saveOf(page));
    const { model, findings } = await savedModel(page, "v-model-people-and-agents");
    assert.deepEqual(findings, []);
    assert.deepEqual(["Auditor", "Scanner", "Guest"].map((name) => model.roles.find((role) => role.name === name).filledBy), ["person", "agent", "either"]);
    const workflow = workflowOf(declarationOf("v-model-people-and-agents"), model, [], SPEC);
    const judged = (...rows) => roleAssignmentFindings([assignmentOf(...rows)], workflow, registerOf(), []).filter((each) => each.kind === "error").map((each) => each.what);
    assert.match(judged(["Auditor", "dev-b"], ["Scanner", "dev-a"]).join("\n"), /Auditor/, "Auditor needs a person, and an agent holds it");
    assert.doesNotMatch(judged(["Auditor", "alice"], ["Scanner", "dev-a"]).join("\n"), /Auditor/, "known positive: a person holds Auditor");
  } finally { page.done(); }
});

// TST-802312 · level: release · module: system
// guards: A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; UC-031
// given: the saved model with the role Scanner that only an agent may fill (agent), the instance's participants alice (a person) and dev-a (an agent)
// input: the role assignments of a product that declares the model give Scanner to alice, then to dev-a
// expect: the SPEC "a process model names ... for each role, whether a person, an agent, or either may fill it": the assignment that gives the agent-only Scanner to the person alice is an error naming Scanner; known positive: the one that gives it to dev-a is none
test("TST-802312: UC-031 a role that only an agent may fill is not given to a person",
  async () => {
    const page = await edit("v-model");
    try {
      await addRow(page, "## Roles", "| Scanner | agent | one | read the repository, run code and tests |");
      await typeKey(page, "name", "v-model-scanner");
      await page.press(saveOf(page));
      const { model } = await savedModel(page, "v-model-scanner");
      const workflow = workflowOf(declarationOf("v-model-scanner"), model, [], SPEC);
      const judged = (who) => roleAssignmentFindings([assignmentOf(["Scanner", who])], workflow, registerOf(), []).filter((each) => each.kind === "error" && /Scanner/.test(each.what));
      assert.deepEqual(judged("dev-a"), [], "known positive: an agent holds Scanner");
      assert.ok(judged("alice").length >= 1, "a person holds Scanner, which only an agent may fill");
    } finally { page.done(); }
  });

// ---------------------------------------------------------------- a role names the capabilities it needs

// TST-802305 · level: release · module: system
// guards: A ROLE NAMES THE CAPABILITIES IT NEEDS; UC-031
// given: the editor on the adapted V-model; the instance's participants dev-a (every capability), dev-b (every capability) and local-llm (draft text only)
// input: the author adds the role Security reviewer (either, one) needing "read the repository, run code and tests"; then types a role without capabilities; saves the first; a product that declares the saved model gives the role to local-llm, then to dev-a
// expect: UC-031 step 3 and 4: the role without capabilities is named beside Roles and blocks Save; the saved role's capabilities are the two typed, in that order; the role assignment that gives Security reviewer to local-llm is an error naming local-llm, Security reviewer and the capability it lacks, and the one that gives it to dev-a is none
test("TST-802305: UC-031 a role names the capabilities its holder needs, and only a participant with all of them can hold it", async () => {
  const page = await edit("v-model");
  try {
    await addRow(page, "## Roles", "| Security reviewer | either | one |  |");
    assert.match(besideSection(page, "## Roles"), /capabilities/i, "a role without capabilities is named beside Roles");
    assert.equal(disabledOf(saveOf(page)), true);
    await page.press(saveOf(page));
    assert.equal(commitsOf(page).length, 0, "nothing is committed");
    await replaceIn(page, "## Roles", "| Security reviewer | either | one |  |", "| Security reviewer | either | one | read the repository, run code and tests |");
    assert.equal(besideSection(page, "## Roles"), "", "known positive: with its capabilities the role is accepted");
    await typeKey(page, "name", "v-model-capabilities");
    await page.press(saveOf(page));
    const { model } = await savedModel(page, "v-model-capabilities");
    assert.deepEqual(model.roles.find((role) => role.name === "Security reviewer").capabilities, ["read the repository", "run code and tests"]);
    const workflow = workflowOf(declarationOf("v-model-capabilities"), model, [], SPEC);
    const lacking = roleAssignmentFindings([assignmentOf(["Security reviewer", "local-llm"])], workflow, registerOf(), []).filter((each) => each.kind === "error");
    assert.ok(lacking.length >= 1, "local-llm lacks a capability");
    assert.ok(lacking.every((each) => each.what.includes("local-llm") && each.what.includes("Security reviewer")));
    assert.match(lacking.map((each) => each.what).join("\n"), /read the repository|run code and tests/);
    const holds = roleAssignmentFindings([assignmentOf(["Security reviewer", "dev-a"])], workflow, registerOf(), []).filter((each) => each.kind === "error");
    assert.deepEqual(holds.filter((each) => /Security reviewer/.test(each.what)), [], "dev-a has both capabilities");
  } finally { page.done(); }
});

// ---------------------------------------------------------------- progress is shown in the model's own measure

// TST-802306 · level: release · module: system
// guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-031
// given: the editor on the adapted V-model (planned) and on the adapted Scrum (pulled, with a time box)
// input: the author types, in turn, each of the three measures and the measure "velocity" into the V-model copy and into the Scrum copy
// expect: UC-031 step 4 "a progress measure that does not fit the kind of work": plan entries per phase fits planned work and the other two do not, the Scrum copy takes remaining items per time box and items per state over time and not plan entries per phase, and "velocity" fits neither; each unfitting measure is named beside the measure and blocks Save; each fitting one leaves Save available
test("TST-802306: UC-031 a planned model names plan entries per phase, a pulled one one of the other two, and an unknown measure is named", async () => {
  const MEASURES = ["plan entries per phase", "remaining items per time box", "items per state over time"];
  const fits = { "v-model": [true, false, false], scrum: [false, true, true] };
  for (const [from, expected] of Object.entries(fits)) {
    for (const [at, measure] of MEASURES.entries()) {
      const page = await edit(from);
      try {
        await typeKey(page, "measure", measure);
        if (expected[at]) {
          assert.equal(besideKey(page, "measure"), "", `${from} takes ${measure}`);
          assert.equal(disabledOf(saveOf(page)), false);
        } else {
          assert.match(besideKey(page, "measure"), /measure/i, `${from} does not fit ${measure}`);
          assert.equal(disabledOf(saveOf(page)), true);
          await page.press(saveOf(page));
          assert.equal(commitsOf(page).length, 0);
        }
      } finally { page.done(); }
    }
    const page = await edit(from);
    try {
      await typeKey(page, "measure", "velocity");
      assert.match(besideKey(page, "measure"), /measure/i, `${from}: velocity is no measure`);
      assert.equal(disabledOf(saveOf(page)), true);
    } finally { page.done(); }
  }
});

// The panels the progress page of a product draws for its model, as the markers of its measure: the grid's cells, the board's cards and cumulative flow, the burn-down panel of each team.
const measureOf = (page) => ({ cells: found(page.target, "[data-cell]").length, cards: found(page.target, "[data-card]").length, flow: found(page.target, "[data-flow-chart]").length, teams: found(page.target, "[data-team]").length });
/** The progress page of a product that declares `modelText`. */
async function progressOf(modelText) {
  const files = await product({ model: modelText });
  const page = await openRoute("progress", {}, { files });
  await settleRoute();
  return page;
}

// TST-802307 · level: release · module: system
// guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-031
// given: the shipped models V-model, Kanban and Scrum, each adapted and saved by the author as they stand; a product that declares each saved model
// input: the author saves the adapted V-model, Kanban and Scrum; the progress page of each product is read
// expect: the V-model copy (plan entries per phase) draws the grid of requirements by phases and no card, flow or team; the Kanban copy (items per state over time) draws the board's cards and the cumulative flow and no cell or team; the Scrum copy (remaining items per time box) draws a burn-down panel for each of the two teams and no cell, card or flow
test("TST-802307: UC-031 the progress page of a product draws the measure the saved model names", async () => {
  const expected = { "v-model": (own) => own.cells >= 7 && !own.cards && !own.flow && !own.teams, kanban: (own) => own.cards >= 1 && own.flow === 1 && !own.cells && !own.teams, scrum: (own) => own.teams === 2 && !own.cells && !own.cards && !own.flow };
  for (const [from, check] of Object.entries(expected)) {
    const editor = await adaptedAndSaved(from, `${from}-as-saved`);
    const text = Object.values(commitsOf(editor)[0].files)[0];
    editor.done();
    const page = await progressOf(text);
    try { assert.ok(check(measureOf(page)), `${from}: ${JSON.stringify(measureOf(page))}`); } finally { page.done(); }
  }
});

// TST-802311 · level: release · module: system
// guards: PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE; UC-031
// given: the editor on the adapted Kanban (pulled, a work-in-progress limit, no time box), whose measure as opened is items per state over time
// input: the author types the measure remaining items per time box and presses Save; then types items per state over time again
// expect: the SPEC "shows a product's progress in the measure its model definition names": a measure per time box does not fit pulled work that has no time box, so the measure is named beside the measure field, Save is unavailable and a click on it commits nothing; known positive: the copy as opened, and the copy with items per state over time typed again, have no such finding and Save is available
test("TST-802311: UC-031 a pulled definition without a time box that names remaining items per time box is refused, with the measure named", async () => {
  const page = await edit("kanban");
  try {
    assert.equal(disabledOf(saveOf(page)), false, "known positive: the copy as opened can be saved");
    await typeKey(page, "measure", "remaining items per time box");
    assert.match(besideKey(page, "measure"), /measure/i, "the measure that does not fit the work is named beside the measure");
    assert.equal(disabledOf(saveOf(page)), true);
    await page.press(saveOf(page));
    assert.equal(commitsOf(page).length, 0, "nothing is committed");
    await typeKey(page, "measure", "items per state over time");
    assert.equal(besideKey(page, "measure"), "", "counter-proof: the measure of flow work has no finding");
    assert.equal(disabledOf(saveOf(page)), false);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- every step explains itself

// TST-802308 · level: release · module: system
// guards: EVERY STEP EXPLAINS ITSELF; UC-031
// given: an instance with the five shipped models and one model of its own; alice/library declares the V-model
// input: the author opens the list of the process models, #models
// expect: UC-031 "Every part carries a folded What is this?... with a pointer to book ch. 6 (plan-driven) or ch. 7 (Scrum, Kanban)": the shipped models, the instance's own models, the kind of work of a model and the products of a model each hold a folded details headed What is this? whose text is more than the heading and points to chapter 6 or chapter 7
test("TST-802308: UC-031 each part of the list of the process models carries a folded What is this? with a pointer to the book", async () => {
  const own = SHIPPED["src/model-catalogue/models/v-model.md"].replace("name: v-model", "name: v-model-own");
  const around = await products({ library: declares("src/model-catalogue/models/v-model.md") });
  const page = await reach("#models", { files: { ...SHIPPED, "README.md": "# Agent M\n", [MODEL_PATH("v-model-own")]: own }, around });
  try {
    const parts = {
      "the shipped models": classed(page.target, "shipped-models")[0], "the instance's own models": classed(page.target, "own-models")[0],
      "the kind of work": entryOf(page, "v-model"), "the products of a model": entryOf(page, "v-model"),
    };
    for (const [part, node] of Object.entries(parts)) {
      assert.ok(node, `${part}: the part stands`);
      const folds = walk(node, (inner) => inner.localName === "details");
      assert.ok(folds.length >= 1, `${part}: carries an explanation`);
      for (const fold of folds) {
        assert.equal(fold.hasAttribute("open"), false, `${part}: folded`);
        assert.equal(fold.children[0].textContent, "What is this?", part);
        assert.ok(fold.textContent.length > "What is this?".length + 40, `${part}: a text, not an empty fold`);
      }
    }
    const entry = entryOf(page, "v-model");
    assert.equal(walk(entry, (inner) => inner.localName === "details").length, 2, "the kind of work and the products each carry one");
    for (const [part, node] of Object.entries(parts)) assert.match(walk(node, (inner) => inner.localName === "details").map((fold) => fold.textContent).join(" "), /chapters? [67]/, `${part}: points to the book`);
  } finally { page.done(); }
});

// ---------------------------------------------------------------- the catalogue is data

// The text of every file under `folder`, as { path: text } (the code of Agent M).
function filesUnder(folder, found = {}) {
  for (const entry of readdirSync(new URL(`../${folder}`, import.meta.url))) {
    const path = `${folder}/${entry}`;
    if (statSync(new URL(`../${path}`, import.meta.url)).isDirectory()) filesUnder(path, found);
    else if (/\.(mjs|js)$/.test(entry)) found[path] = read(path);
  }
  return found;
}

// TST-802310 · level: release · module: system
// guards: THE CATALOGUE IS DATA; UC-031
// given: the editor on the adapted V-model, and the code of Agent M under src/
// input: the author names the copy v-model-with-security-review and presses Save; the catalogue reads the instance's data files; the code under src/ is searched for the name
// expect: UC-031 postcondition "Agent M's code is unchanged": the commit holds the one file docs/process-models/v-model-with-security-review.md and no other file; the catalogue reads the model from the data files alone, and its name stands in no file of src/ (known positive: the name v-model-with-security-review is found in the text of the file the click committed)
test("TST-802310: UC-031 a saved model is a data file, and adding it changes no code of Agent M", async () => {
  const page = await adaptedAndSaved("v-model", "v-model-with-security-review");
  try {
    const files = commitsOf(page)[0].files;
    assert.deepEqual(Object.keys(files), [MODEL_PATH("v-model-with-security-review")]);
    assert.match(Object.values(files)[0], /v-model-with-security-review/, "known positive: the name stands in the committed file");
    const { model, findings } = await savedModel(page, "v-model-with-security-review");
    assert.ok(model, "the catalogue reads the model from the data files");
    assert.deepEqual(findings, []);
    const code = filesUnder("src");
    assert.ok(Object.keys(code).length > 100, "known positive: the code of Agent M is searched");
    const holding = Object.entries(code).filter(([, text]) => text.includes("v-model-with-security-review")).map(([path]) => path);
    assert.deepEqual(holding, [], "no file of the code names the model");
  } finally { page.done(); }
});
