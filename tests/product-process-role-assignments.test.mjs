// A product's role assignments (UC-048) — MOD-product-process' interface as the accepted text of
// docs/architecture/MOD-product-process.md states it: roleAssignmentSchema, the schema of docs/role-assignments/<name>.md;
// roleAssignmentFindings, the findings of a product's role assignments read together; holdsRole; and mayDecide, who may
// decide a gate of a job, within the job's role assignment.
// Run: node --test tests/product-process-role-assignments.test.mjs
//
// Module: MOD-product-process
// Guards: UC-048; A ROLE ASSIGNMENT FILLS THE ROLES; A PRODUCT HAS ONE ROLE ASSIGNMENT, OR ONE PER TEAM; A PARTICIPANT MAY SERVE SEVERAL TEAMS; A ROLE NAMES HOW MANY FILL IT; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE; A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; A JOB GOES ONLY TO A HOLDER OF ITS ROLE; A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT; A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS; A GATE NAMES WHO DECIDES IT
// Level: unit
//
// A holder's capabilities and processing place are roleAssignmentFindings' too; tests/product-process-eligibility.test.mjs
// holds those two.
//
// The fixture product declares an instance model, docs/process-models/team-scrum.md — Scrum whose Product Owner must be a
// person, whose gate back to Sprint Planning a CI check decides —, at the commit VERSION, and has two teams: team1, whose
// Product Owner is alice, and team2, whose Product Owner is bob; dev-b is a developer and the Scrum Master of both. The
// workflow is workflowOf's of that declaration and model. Each test states its input and its expected result before it
// runs (given / input / expect); a test that expects no finding has its known positives in the tests after it, each of
// which changes one line of an assignment and finds one. Nothing reaches the network.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { documentFindings, readDocument } from "../src/documents/index.mjs";
import { catalogue } from "../src/model-catalogue/index.mjs";
import { participantSchema } from "../src/participant-list/index.mjs";
import { declarationSchema, holdsRole, mayDecide, roleAssignmentFindings, roleAssignmentSchema, workflowOf }
  from "../src/product-process/index.mjs";

const FILLS = "A ROLE ASSIGNMENT FILLS THE ROLES";
const ONE_OR_PER_TEAM = "A PRODUCT HAS ONE ROLE ASSIGNMENT, OR ONE PER TEAM";
const HOW_MANY = "A ROLE NAMES HOW MANY FILL IT";
const ONCE_PER_INSTANCE = "PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE";
const PEOPLE_AND_AGENTS = "A PROCESS MODEL ORGANISES PEOPLE AND AGENTS";

// ---------------------------------------------------------------- texts and their lines

const linesOf = (text) => text.split("\n");

// `text` with its line `number` replaced by `lines` — one or more; the line it names must be the one expected, so that
// each change is the one the test says.
function replaced(text, number, expected, ...lines) {
  const all = linesOf(text);
  assert.equal(all[number - 1], expected, `line ${number}`);
  all.splice(number - 1, 1, ...lines);
  return all.join("\n");
}

// ---------------------------------------------------------------- the fixture instance

const VERSION = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const MODEL_PATH = "docs/process-models/team-scrum.md";

// team-scrum, with `sprints` — yes or no — as its Flow control's Sprints.
const modelText = (sprints) => [
  "---",
  "name: team-scrum",
  "kind: pulled",
  "adapted_from: scrum",
  "measure: remaining items per time box",
  "---",
  "# Scrum with a person as Product Owner",
  "",
  "## Phases",
  "",
  "| Name | Role | Produces |",
  "|---|---|---|",
  "| Sprint Planning | Product Owner | ITM |",
  "| Development | Developers | MOD, TST |",
  "| Sprint Review | Product Owner | sprint record |",
  "| Sprint Retrospective | Scrum Master | sprint record |",
  "",
  "## Transitions",
  "",
  "| From | To | Kind |",
  "|---|---|---|",
  "| Sprint Planning | Development | sequence |",
  "| Development | Sprint Review | sequence |",
  "| Sprint Review | Sprint Retrospective | sequence |",
  "| Sprint Retrospective | Sprint Planning | back |",
  "",
  "## Verification pairs",
  "",
  "| Phase | Checked by |",
  "|---|---|",
  "| Development | Sprint Review |",
  "",
  "## Gates",
  "",
  "| Between | Artifacts | Condition | Decider |",
  "|---|---|---|---|",
  "| Development → Sprint Review | the increment: the MOD and TST of the selected ITM | every selected item meets its "
    + "acceptance criteria | Product Owner |",
  "| Sprint Retrospective → Sprint Planning | the sprint record of the review and the retrospective | the retrospective "
    + "is recorded | check: retro-recorded |",
  "",
  "## Roles",
  "",
  "| Name | Filled by | How many | Capabilities |",
  "|---|---|---|---|",
  "| Product Owner | person | one | read the repository, write to the repository |",
  "| Scrum Master | either | one | read the repository |",
  "| Developers | agent | several | read the repository, write to the repository, run code and tests |",
  "",
  "## Flow control",
  "",
  "| Kind | Value |",
  "|---|---|",
  "| WIP limit | — |",
  "| Time box | 1 week |",
  `| Sprints | ${sprints} |`,
  "",
].join("\n");

// The instance's register: alice and bob, people; dev-a and dev-b, CLI agents that may hold every role but Product Owner.
const PARTICIPANTS = readDocument(participantSchema(), "docs/participants.md", [
  "# Participants of this instance",
  "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |",
  "|---|---|---|---|---|---|---|---|",
  "| alice | person | — | — | — | read the repository, write to the repository | — | account github.com/alice |",
  "| bob | person | — | — | — | read the repository, write to the repository | — | account github.com/bob |",
  "| dev-a | CLI agent | example-model | 200000 | — | read the repository, write to the repository, run code and tests | "
    + "this machine | bridge lab-pc agent claude |",
  "| dev-b | CLI agent | other-model | 200000 | — | read the repository, write to the repository, run code and tests | "
    + "this machine | bridge lab-pc agent codex |",
  "",
].join("\n"));

// The instance's SPEC: no process requirement.
const INSTANCE_SPEC = "# Fixture instance — Specification\n\n## 1. Process\n\nNo process requirement.\n";

const blobOf = (path) => createHash("sha1").update(path).digest("hex");

// The snapshot of the instance repository at VERSION holding these files, { path: text }, as MOD-repository-hosts' Snapshot
// gives it — as tests/product-process.test.mjs makes it.
function snapshotAt(files) {
  const texts = new Map(Object.entries(files));
  return {
    repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" },
    ref: "main",
    commit: VERSION,
    paths: [...texts.keys()],
    read: async (path) => texts.get(path) ?? null,
    blob: (path) => (texts.has(path) ? blobOf(path) : null),
  };
}

// ---------------------------------------------------------------- the fixture product

const DECLARATION = readDocument(declarationSchema, "docs/process.md", [
  "---",
  "model: team-scrum",
  `model_file: ${MODEL_PATH}`,
  `model_version: ${VERSION}`,
  "---",
  "# How the fixture product is developed",
  "",
  "## Practices",
  "",
  "- none",
  "",
  "## Branches",
  "",
  "| Phase or time box | Branch |",
  "|---|---|",
  "",
  "## Definition of Done",
  "",
  "The job rules hold for every pull request; no condition is added.",
  "",
].join("\n"));

// The workflow of the fixture product, its model working in sprints or not.
async function workflowWith(sprints) {
  const cat = await catalogue(snapshotAt({ [MODEL_PATH]: modelText(sprints) }));
  assert.deepEqual(cat.findings[MODEL_PATH], [], "known positive: team-scrum has no finding");
  return workflowOf(DECLARATION, cat.models.find((model) => model.path === MODEL_PATH), [], INSTANCE_SPEC);
}

const TEAM1 = [
  "# Team 1",                                                   // 1
  "",                                                           // 2
  "## Roles",                                                   // 3
  "",                                                           // 4
  "| Role | Participants |",                                     // 5
  "|---|---|",                                                  // 6
  "| Product Owner | alice |",                                  // 7
  "| Scrum Master | dev-b |",                                   // 8
  "| Developers | dev-a, dev-b |",                              // 9
  "",
].join("\n");
const TEAM2 = [
  "# Team 2",
  "",
  "## Roles",
  "",
  "| Role | Participants |",
  "|---|---|",
  "| Product Owner | bob |",
  "| Scrum Master | dev-b |",
  "| Developers | dev-b |",
  "",
].join("\n");

const assignmentOf = (text, name = "team1") => readDocument(roleAssignmentSchema, `docs/role-assignments/${name}.md`, text);
const brief = (found) => found.map((f) => [f.artifact, f.line, f.kind, f.rule]);
// The findings of team1's text alone, against the workflow of a model with sprints.
const team1Findings = async (text) => roleAssignmentFindings([assignmentOf(text)], await workflowWith("yes"), PARTICIPANTS, []);

// ---------------------------------------------------------------- roleAssignmentSchema

// TST-472431 · level: unit · module: MOD-product-process
// guards: UC-048; A ROLE ASSIGNMENT FILLS THE ROLES
// given: team1's role assignment; then the same with a front matter key, and with a section ## Notes after ## Roles
// input: readDocument(roleAssignmentSchema, "docs/role-assignments/team1.md", the text); documentFindings of each
// expect: the rows of ## Roles, each role with its participants as a list, on lines 7 to 9, and no finding; for the front matter key and for the other section, one error each naming A ROLE ASSIGNMENT FILLS THE ROLES — on the key's line 2, on the section's heading line 11
test("roleAssignmentSchema — a role assignment is its roles table: each role with its participants, and nothing else", () => {
  const team1 = assignmentOf(TEAM1);
  assert.deepEqual(team1.sections.map((section) => section.heading), ["## Roles"]);
  assert.deepEqual(team1.sections[0].rows, [
    { line: 7, cells: { Role: "Product Owner", Participants: ["alice"] } },
    { line: 8, cells: { Role: "Scrum Master", Participants: ["dev-b"] } },
    { line: 9, cells: { Role: "Developers", Participants: ["dev-a", "dev-b"] } },
  ]);
  assert.deepEqual(documentFindings(roleAssignmentSchema, team1), []);

  const keyed = assignmentOf(`---\nteam: one\n---\n${TEAM1}`);
  assert.deepEqual(documentFindings(roleAssignmentSchema, keyed).map((f) => [f.line, f.kind, f.rule]), [[2, "error", FILLS]]);
  const noted = assignmentOf(`${TEAM1}\n## Notes\n\nThe team meets on Mondays.\n`);
  assert.deepEqual(documentFindings(roleAssignmentSchema, noted).map((f) => [f.line, f.kind, f.rule]), [[11, "error", FILLS]]);
});

// ---------------------------------------------------------------- roleAssignmentFindings

// TST-472432 · level: unit · module: MOD-product-process
// guards: UC-048; A PRODUCT HAS ONE ROLE ASSIGNMENT, OR ONE PER TEAM; A PARTICIPANT MAY SERVE SEVERAL TEAMS
// given: the fixture product's two role assignments, team1 and team2, dev-b holding roles in both; its model works in sprints
// input: roleAssignmentFindings([team1, team2], the workflow, the register, [])
// expect: no finding — one role assignment for each team, and a participant in two of them is no finding
test("roleAssignmentFindings — one role assignment per team, a participant serving two teams, has no finding", async () => {
  const found = roleAssignmentFindings([assignmentOf(TEAM1), assignmentOf(TEAM2, "team2")], await workflowWith("yes"),
    PARTICIPANTS, []);
  assert.deepEqual(brief(found), []);
});

// TST-472433 · level: unit · module: MOD-product-process
// guards: UC-048; A PRODUCT HAS ONE ROLE ASSIGNMENT, OR ONE PER TEAM
// given: known positive first — team1 alone, its model working without sprints; then team1 and team2 with that model
// input: roleAssignmentFindings of each
// expect: no finding for team1 alone; for the two, one error on line 1 of each, naming A PRODUCT HAS ONE ROLE ASSIGNMENT, OR ONE PER TEAM, its text naming both files
test("roleAssignmentFindings — more than one role assignment where the model works without sprints is an error", async () => {
  const workflow = await workflowWith("no");
  assert.deepEqual(brief(roleAssignmentFindings([assignmentOf(TEAM1)], workflow, PARTICIPANTS, [])), []);
  const found = roleAssignmentFindings([assignmentOf(TEAM1), assignmentOf(TEAM2, "team2")], workflow, PARTICIPANTS, []);
  assert.deepEqual(brief(found), [
    ["docs/role-assignments/team1.md", 1, "error", ONE_OR_PER_TEAM],
    ["docs/role-assignments/team2.md", 1, "error", ONE_OR_PER_TEAM],
  ]);
  for (const f of found) assert.ok(f.what.includes("team1.md") && f.what.includes("team2.md"), f.what);
});

// TST-472434 · level: unit · module: MOD-product-process
// guards: UC-048; A ROLE ASSIGNMENT FILLS THE ROLES
// given: team1 with (a) a row for the role Release tester, which the product's process does not have; (b) a sentence between its title and ## Roles; (c) a sentence below the roles table
// input: roleAssignmentFindings of each, alone
// expect: for each, one error naming A ROLE ASSIGNMENT FILLS THE ROLES, on the line that holds it; its text names the role or the line
test("roleAssignmentFindings — a role the process does not have, or anything besides the roles table, is an error", async () => {
  const release = await team1Findings(replaced(TEAM1, 9, "| Developers | dev-a, dev-b |", "| Developers | dev-a, dev-b |",
    "| Release tester | dev-a |"));
  assert.deepEqual(brief(release), [["docs/role-assignments/team1.md", 10, "error", FILLS]]);
  assert.ok(release[0].what.includes("Release tester"), release[0].what);

  const lead = await team1Findings(replaced(TEAM1, 2, "", "", "Team 1 works on the backlog.", ""));
  assert.deepEqual(brief(lead), [["docs/role-assignments/team1.md", 3, "error", FILLS]]);
  assert.ok(lead[0].what.includes("Team 1 works on the backlog."), lead[0].what);

  const below = await team1Findings(`${TEAM1}\nThe Scrum Master also reviews.\n`);
  assert.deepEqual(brief(below), [["docs/role-assignments/team1.md", 11, "error", FILLS]]);
});

// TST-472435 · level: unit · module: MOD-product-process
// guards: UC-048; A ROLE NAMES HOW MANY FILL IT
// given: known positive first — team1, whose Developers, which several may fill, are dev-a and dev-b; then team1 with its Product Owner, whom one participant fills, given alice and bob
// input: roleAssignmentFindings of each, alone
// expect: no finding for the first; for the second, one error on the row of Product Owner (line 7), naming A ROLE NAMES HOW MANY FILL IT; its text names the role
test("roleAssignmentFindings — more than one participant for a role that one participant fills is an error", async () => {
  assert.deepEqual(brief(await team1Findings(TEAM1)), []);
  const found = await team1Findings(replaced(TEAM1, 7, "| Product Owner | alice |", "| Product Owner | alice, bob |"));
  assert.deepEqual(brief(found), [["docs/role-assignments/team1.md", 7, "error", HOW_MANY]]);
  assert.ok(found[0].what.includes("Product Owner"), found[0].what);
});

// TST-472436 · level: unit · module: MOD-product-process
// guards: UC-048; PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE
// given: team1 with its Developers dev-a and dev-z, a name the instance's list does not hold
// input: roleAssignmentFindings, alone
// expect: one error on the row of Developers (line 9), naming PARTICIPANTS ARE CONFIGURED ONCE PER INSTANCE; its text names dev-z
test("roleAssignmentFindings — a name the instance's list does not hold is an error", async () => {
  const found = await team1Findings(replaced(TEAM1, 9, "| Developers | dev-a, dev-b |", "| Developers | dev-a, dev-z |"));
  assert.deepEqual(brief(found), [["docs/role-assignments/team1.md", 9, "error", ONCE_PER_INSTANCE]]);
  assert.ok(found[0].what.includes("dev-z"), found[0].what);
});

// TST-472437 · level: unit · module: MOD-product-process
// guards: UC-048; A PROCESS MODEL ORGANISES PEOPLE AND AGENTS
// given: team1 with its Product Owner, whom team-scrum fills by a person, (a) held by dev-a, a CLI agent; (b) without a row
// input: roleAssignmentFindings of each, alone
// expect: (a) one error on the row of Product Owner (line 7); (b) one error on the heading ## Roles (line 3); each naming A PROCESS MODEL ORGANISES PEOPLE AND AGENTS, its text naming the role
test("roleAssignmentFindings — a role that needs a person and has none is an error", async () => {
  const agent = await team1Findings(replaced(TEAM1, 7, "| Product Owner | alice |", "| Product Owner | dev-a |"));
  assert.deepEqual(brief(agent), [["docs/role-assignments/team1.md", 7, "error", PEOPLE_AND_AGENTS]]);
  const none = await team1Findings(replaced(TEAM1, 7, "| Product Owner | alice |"));
  assert.deepEqual(brief(none), [["docs/role-assignments/team1.md", 3, "error", PEOPLE_AND_AGENTS]]);
  for (const f of [...agent, ...none]) assert.ok(f.what.includes("Product Owner"), f.what);
});

// TST-1372001 · level: unit · module: MOD-product-process
// guards: UC-048; A PROCESS MODEL ORGANISES PEOPLE AND AGENTS
// given: known positives first — team1, whose Developers, which team-scrum fills by an agent, are dev-a and dev-b; team1 with its Scrum Master, which either may fill, held by alice, a person; then team1 with its Developers dev-a and alice
// input: roleAssignmentFindings of each, alone
// expect: no finding for the first two; for the third, one error naming A PROCESS MODEL ORGANISES PEOPLE AND AGENTS on the row of Developers (line 9), its text naming Developers and alice and not dev-a
test("roleAssignmentFindings — a person holding a role that an agent fills is an error; a role either may fill takes a person", async () => {
  assert.deepEqual(brief(await team1Findings(TEAM1)), [], "known positive: agents hold Developers");
  assert.deepEqual(brief(await team1Findings(replaced(TEAM1, 8, "| Scrum Master | dev-b |", "| Scrum Master | alice |"))), [],
    "known positive: a person holds Scrum Master, which either may fill");
  const found = (await team1Findings(replaced(TEAM1, 9, "| Developers | dev-a, dev-b |", "| Developers | dev-a, alice |")))
    .filter((f) => f.rule === PEOPLE_AND_AGENTS);
  assert.deepEqual(brief(found), [["docs/role-assignments/team1.md", 9, "error", PEOPLE_AND_AGENTS]]);
  assert.ok(found[0].what.includes("Developers") && found[0].what.includes("alice"), found[0].what);
  assert.ok(!found[0].what.includes("dev-a"), found[0].what);
});

// ---------------------------------------------------------------- holdsRole

// TST-472438 · level: unit · module: MOD-product-process
// guards: UC-048; A JOB GOES ONLY TO A HOLDER OF ITS ROLE
// given: team1 and team2
// input: holdsRole for dev-a as Developers and as Product Owner in team1, and as Developers in team2; dev-b as Scrum Master in both
// expect: dev-a holds Developers in team1, not Product Owner, and nothing in team2; dev-b holds Scrum Master in both
test("holdsRole — whether a role assignment gives the participant the role", () => {
  const team1 = assignmentOf(TEAM1), team2 = assignmentOf(TEAM2, "team2");
  assert.equal(holdsRole(team1, "dev-a", "Developers"), true);
  assert.equal(holdsRole(team1, "dev-a", "Product Owner"), false);
  assert.equal(holdsRole(team2, "dev-a", "Developers"), false);
  assert.equal(holdsRole(team1, "dev-b", "Scrum Master"), true);
  assert.equal(holdsRole(team2, "dev-b", "Scrum Master"), true);
});

// ---------------------------------------------------------------- mayDecide

const DEVELOPMENT_GATE = "Development → Sprint Review";
const RETRO_GATE = "Sprint Retrospective → Sprint Planning";

// TST-472439 · level: unit · module: MOD-product-process
// guards: UC-048; A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT; A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS
// given: the gate Development → Sprint Review, decided by the Product Owner, for a job of team1, whose work dev-a did; alice, team1's Product Owner, and bob, team2's
// input: mayDecide for alice; for bob; for alice once more, with alice among those whose work the gate checks
// expect: alice may decide it; bob may not, as no holder of the deciding role in team1, whose holders are alice; alice, had she done the work, may not, the reason being that she did the work this gate checks
test("mayDecide — only a holder of the deciding role in the job's role assignment, who did not do the work, passes a gate", async () => {
  const workflow = await workflowWith("yes");
  const team1 = assignmentOf(TEAM1);
  assert.deepEqual(mayDecide({ name: "alice", kind: "person" }, DEVELOPMENT_GATE, workflow, team1, ["dev-a"]), { may: true });
  assert.deepEqual(mayDecide({ name: "bob", kind: "person" }, DEVELOPMENT_GATE, workflow, team1, ["dev-a"]),
    { may: false, reason: "not a holder of the deciding role", holders: ["alice"] });
  assert.deepEqual(mayDecide({ name: "alice", kind: "person" }, DEVELOPMENT_GATE, workflow, team1, ["alice", "dev-a"]),
    { may: false, reason: "did the work this gate checks", holders: ["alice"] });
});

// TST-472440 · level: unit · module: MOD-product-process
// guards: A GATE NAMES WHO DECIDES IT; A GATE IS DECIDED WITHIN THE JOB'S ROLE ASSIGNMENT
// given: the gate Sprint Retrospective → Sprint Planning, decided by the check retro-recorded; and a gate the workflow does not have
// input: mayDecide for the check retro-recorded; for another check; for alice; then for alice at Planning → Done
// expect: the check retro-recorded may decide it; another check and alice may not, the gate not being theirs, with no holders; a gate the workflow does not have is a TypeError naming it
test("mayDecide — a gate decided by a check is passed by that check alone; a gate the workflow lacks is refused", async () => {
  const workflow = await workflowWith("yes");
  const team1 = assignmentOf(TEAM1);
  assert.deepEqual(mayDecide({ name: "retro-recorded", kind: "check" }, RETRO_GATE, workflow, team1, []), { may: true });
  for (const other of [{ name: "lint", kind: "check" }, { name: "alice", kind: "person" }]) {
    assert.deepEqual(mayDecide(other, RETRO_GATE, workflow, team1, []),
      { may: false, reason: "not the gate's check", holders: [] }, other.name);
  }
  assert.throws(() => mayDecide({ name: "alice", kind: "person" }, "Planning → Done", workflow, team1, []),
    (error) => error instanceof TypeError && error.message.includes("Planning → Done"));
});
