// The gate record and the states of the gates (ITM-292) — MOD-product-process' gateSchema, with its data file gate-record.schema.md, and gateStates, as the accepted text of
// docs/architecture/MOD-product-process.md states them: "gateSchema: Schema — the gate record's schema"; "gateStates(workflow, records, texts) -> Array<{ gate, state: "passed" | "passed on an
// earlier text" | "rejected" | "pending" | "not reached", record, needs, difference }> — each gate's state: `passed` when a record of its decider passed it on the texts that hold now; `passed on
// an earlier text` — not passed for the current text — with the difference; `pending` with what it still needs; `texts` are the blobs of the artifacts the gates check"; and the record, "a file
// docs/gates/<yyyymmdd>-<hhmm>-<gate slug>-<4 hex>.md, written once" with the front matter gate, job, decider, role, decision (passed or rejected), on (`<path>@<blob>` per artifact, or the commit)
// and date, and `## Reason`. For UC-002 and A GATE NAMES WHO DECIDES IT. holdsRole and mayDecide already exist (tests/product-process-role-assignments.test.mjs) and are used here, not changed.
// Run: node --test tests/product-process-gates.test.mjs
//
// Module: MOD-product-process
// Guards: UC-002; THE GATE IS RECORDED; STATUS IS DERIVED FROM THE RECORDS; A GATE NAMES WHO DECIDES IT; A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS
// Level: unit
//
// The workflow is workflowOf's, over the fixture product of tests/product-process-role-assignments.test.mjs: team-scrum, whose gate Development → Sprint Review the Product Owner decides and whose
// gate Sprint Retrospective → Sprint Planning the check retro-recorded decides. The records are documents read with gateSchema; the real data is the repository's own docs/gates, read as it
// stands and never changed. Where the texts leave a reading open, the test states the one it takes, and the pull request names it:
//   - A record counts for a gate when its `gate` is the gate's name and it was made by the gate's decider: its `role` is the role the workflow names as decider, or, for a gate decided by a check,
//     its `decider` is that `check: <name>`. A record by another role or another check does not establish a pass (it is no record of the gate for gateStates; whether the participant held the
//     role is mayDecide's, at the time of the decision). Of the records that count, the newest by `date` (then by path) decides the state.
//   - A passed record's `on` holds `<path>@<blob>` for each artifact checked and, besides, a commit or an address; the state is `passed` when each `<path>@<blob>` equals the blob `texts` holds for
//     that path, and `passed on an earlier text` when one differs or `texts` holds none: its `difference` names each such path with the blob it was checked at and the blob now, twelve digits each.
//   - A gate is reached when the phase it leaves is entered: the model's first phase is entered, and a phase is entered by a transition from an entered phase whose gate, if it has one, is `passed`
//     (a gate `passed on an earlier text` does not open it). A gate not reached is `not reached` whatever its records say. `needs`: `pending` — the decision of the deciding role, or the result of
//     the check; `passed on an earlier text` — a decision on the current text; `not reached` — the phase its gate leaves to be entered; `passed` and `rejected` — null.
//   - The repository's own records do not all follow the accepted form, and the test names how: of the 347 records with a front matter there were when this was written, 7 carry a key `model`, 9 a key `pull_request` or `pr`, 15 give
//     `on` as one commit and not a list, and 1 has the decision `refused`; gateSchema reads them as the accepted text says and finds exactly that.
// A name the module does not provide yet fails each test by itself. The counter-proofs are in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { documentFindings, readDocument, writeDocument } from "../src/documents/index.mjs";
import { catalogue } from "../src/model-catalogue/index.mjs";
import { participantSchema } from "../src/participant-list/index.mjs";
import * as product from "../src/product-process/index.mjs";

const { declarationSchema, gateSchema, gateStates, mayDecide, roleAssignmentSchema, workflowOf } = product;

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


const GATES = new URL("../docs/gates/", import.meta.url);
const DEV = "Development → Sprint Review", RETRO = "Sprint Retrospective → Sprint Planning";
const BLOB_A = "a".repeat(40), BLOB_B = "b".repeat(40), BLOB_C = "c".repeat(40);
const INCREMENT = "docs/increment.md", RECORD_OF_SPRINT = "docs/sprint.md";

// A record's text and the document gateSchema reads it as. `at` makes the date, the path and so the order of the records.
function record({ gate = DEV, job = "", decider = "alice", role = "Product Owner", decision = "passed", on = [`${INCREMENT}@${BLOB_A}`], at = "10:00", date = `2026-10-12 ${at} UTC`, reason = null } = {}) {
  const slug = gate.toLowerCase().replace(/[^a-z]+/g, "-");
  const path = `docs/gates/20261012-${at.replace(":", "")}-${slug}-${decider.replace(/\W/g, "").slice(0, 4).padEnd(4, "0")}.md`;
  const text = ["---", `gate: ${gate}`, `job: ${job}`, `decider: ${decider}`, `role: ${role}`, `decision: ${decision}`, "on:", ...on.map((entry) => `  - ${entry}`), `date: ${date}`, "---",
    `# ${gate}: the fixture`, "", "**REGISTER**", "", ...(reason ? ["## Reason", "", reason, ""] : [])].join("\n");
  return readDocument(gateSchema, path, text);
}
const states = async (records, texts = { [INCREMENT]: BLOB_A }) => gateStates(await workflowWith("yes"), records, texts);
const of = (list, gate) => list.find((state) => state.gate === gate);

// TST-292101 · level: unit · module: MOD-product-process
// guards: THE GATE IS RECORDED; UC-002
// given: the repository's own gate records docs/gates, at least 347 of them with a front matter, read as they stand
// input: gateSchema read over each, and documentFindings
// expect: three records of the latest sprint read with no finding and give their fields — gate, job (empty), decider, role, decision, on as a list, date — and their `## Reason`; the records that depart from the accepted form give exactly the findings that name how: 7 a key `model`, 9 a key `pull_request` or `pr`, 15 an `on` that is one commit and no list, 1 the decision `refused`; no other record has a finding
test("TST-292101: gateSchema reads the repository's own gate records, and finds how some depart from the form", () => {
  assert.ok(gateSchema, "gateSchema is offered");
  const files = readdirSync(GATES).filter((name) => readFileSync(new URL(name, GATES), "utf8").startsWith("---"));
  assert.ok(files.length >= 347, "the records with a front matter");
  const found = {};
  for (const name of files) {
    const path = `docs/gates/${name}`;
    for (const finding of documentFindings(gateSchema, readDocument(gateSchema, path, readFileSync(new URL(name, GATES), "utf8")))) {
      const key = /the key (\w+) is not a key/.exec(finding.what)?.[1] ? `key ${/the key (\w+) is not a key/.exec(finding.what)[1]}` : /is not a list/.test(finding.what) ? "on is no list"
        : /not one of passed, rejected/.test(finding.what) ? "decision is not passed or rejected" : finding.what;
      (found[key] ??= new Set()).add(name);
    }
  }
  assert.deepEqual(Object.fromEntries(Object.entries(found).map(([key, names]) => [key, names.size])),
    { "key model": 7, "key pull_request": 8, "key pr": 1, "on is no list": 15, "decision is not passed or rejected": 1 });
  const clean = "20261012-2350-retrospective-sprint-planning-8de7.md";
  assert.ok(files.includes(clean));
  const read = readDocument(gateSchema, `docs/gates/${clean}`, readFileSync(new URL(clean, GATES), "utf8"));
  assert.deepEqual(read.fields, { gate: "Retrospective → Sprint planning", job: "", decider: "po-opus", role: "Product Owner", decision: "passed",
    on: ["77cd618f61f6c1a4dea632edb9bbe7f43bc9f726", "https://github.com/akmaier/agent-m/pull/478"], date: "2026-10-12 23:50 UTC" });
  assert.deepEqual(read.sections.map((section) => section.heading), ["## Reason"]);
});

// TST-292102 · level: unit · module: MOD-product-process
// guards: THE GATE IS RECORDED; A RECORD IS EVIDENCE, NOT A PROPOSAL
// given: a record with every field of the accepted form, a rejection with its reason
// input: the record written with writeDocument and gateSchema, and read back
// expect: the text starts with the front matter in the order gate, job, decider, role, decision, on, date; reading it gives the same fields; no finding; a record without a reason is read too (a rejection's reason is recordGateDecision's to require, not the schema's)
test("TST-292102: gateSchema writes and reads a gate record with every accepted field", () => {
  const read = record({ decision: "rejected", on: [`${INCREMENT}@${BLOB_A}`, "1808081ac9fdb8ac21f094417c0c79b5f9d188f7"], reason: "The increment lacks its tests." });
  assert.deepEqual(documentFindings(gateSchema, read), []);
  assert.deepEqual(read.fields, { gate: DEV, job: "", decider: "alice", role: "Product Owner", decision: "rejected",
    on: [`${INCREMENT}@${BLOB_A}`, "1808081ac9fdb8ac21f094417c0c79b5f9d188f7"], date: "2026-10-12 10:00 UTC" });
  const text = writeDocument(gateSchema, read);
  assert.match(text, /^---\ngate: Development → Sprint Review\njob:\s*\ndecider: alice\nrole: Product Owner\ndecision: rejected\non:\n/);
  assert.deepEqual(readDocument(gateSchema, read.path, text).fields, read.fields);
  assert.deepEqual(documentFindings(gateSchema, record()), []);
});

// TST-292103 · level: unit · module: MOD-product-process
// guards: THE GATE IS RECORDED
// given: the known valid record, then records that each break one thing: a decision that is neither passed nor rejected, no gate, an `on` that names nothing
// input: documentFindings over each
// expect: none for the valid one, then one error each, naming the key
test("TST-292103: gateSchema names what breaks the form of a record", () => {
  const valid = record();
  assert.deepEqual(documentFindings(gateSchema, valid), [], "known positive");
  const text = writeDocument(gateSchema, valid);
  const broken = (change, path = valid.path) => documentFindings(gateSchema, readDocument(gateSchema, path, change(text)));
  assert.match(broken((t) => t.replace("decision: passed", "decision: maybe"))[0].what, /decision.*not one of passed, rejected/);
  assert.match(broken((t) => t.replace("gate: Development → Sprint Review\n", ""))[0].what, /gate/);
  assert.match(broken((t) => t.replace(/on:\n  - [^\n]*\n/, "on:\n"))[0].what, /on/);
});

// TST-292104 · level: unit · module: MOD-product-process
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: the workflow of the fixture product (two gates), and no record
// input: gateStates(workflow, [], texts)
// expect: one entry for each gate of the workflow, in its order — Development → Sprint Review `pending`, the gate Sprint Retrospective → Sprint Planning `not reached` since Sprint Review is not entered — with no record and no difference, and `needs` naming the decision by Product Owner and the phase to be entered; nothing is written and the inputs are unchanged
test("TST-292104: gateStates gives each gate pending or not reached without a record", async () => {
  assert.ok(gateStates, "gateStates is offered");
  const workflow = await workflowWith("yes");
  const texts = Object.freeze({ [INCREMENT]: BLOB_A });
  const list = gateStates(workflow, [], texts);
  assert.deepEqual(list.map((state) => state.gate), workflow.gates.map((gate) => gate.name));
  assert.deepEqual(list, [
    { gate: DEV, state: "pending", record: null, needs: "a decision by Product Owner", difference: null },
    { gate: RETRO, state: "not reached", record: null, needs: "the phase Sprint Retrospective to be entered", difference: null }]);
  assert.deepEqual(texts, { [INCREMENT]: BLOB_A });
});

// TST-292105 · level: unit · module: MOD-product-process
// guards: STATUS IS DERIVED FROM THE RECORDS; A GATE NAMES WHO DECIDES IT
// given: alice, the Product Owner, who may decide the gate; her record that passed Development → Sprint Review on the increment at BLOB_A, and the increment still at BLOB_A
// input: gateStates; then the same with the check's record that passed Sprint Retrospective → Sprint Planning
// expect: mayDecide admits alice (the known positive); the gate is `passed` with her record's path, no needs, no difference; Sprint Retrospective → Sprint Planning is now reached, `pending`, needing the result of the check retro-recorded; with the check's record `passed` too, whose decider is `check: retro-recorded`
test("TST-292105: gateStates derives passed from a record of the decider on the current text", async () => {
  const workflow = await workflowWith("yes");
  const assignment = readDocument(roleAssignmentSchema, "docs/role-assignments/team1.md", ["# Team 1", "", "## Roles", "", "| Role | Participants |", "|---|---|", "| Product Owner | alice |", "| Scrum Master | dev-b |", "| Developers | dev-a |", ""].join("\n"));
  assert.deepEqual(mayDecide({ name: "alice", kind: "person" }, DEV, workflow, assignment, ["dev-a"]), { may: true });
  const passed = record();
  const list = await states([passed]);
  assert.deepEqual(of(list, DEV), { gate: DEV, state: "passed", record: passed.path, needs: null, difference: null });
  assert.deepEqual(of(list, RETRO), { gate: RETRO, state: "pending", record: null, needs: "the result of the check retro-recorded", difference: null });
  const check = record({ gate: RETRO, decider: "check: retro-recorded", role: "check", on: ["0".repeat(40)], at: "11:00" });
  const both = await states([passed, check]);
  assert.deepEqual(of(both, RETRO), { gate: RETRO, state: "passed", record: check.path, needs: null, difference: null });
});

// TST-292106 · level: unit · module: MOD-product-process
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: the passed record of TST-292105, now checked at BLOB_A, and a current increment at BLOB_B; and one whose texts hold no blob for the path
// input: gateStates
// expect: the gate is `passed on an earlier text`, with the record, `needs` a decision on the current text, and a difference naming the path with the twelve digits of the blob it was checked at and of the one now; for a path with no current text the difference says none is held; Sprint Retrospective → Sprint Planning stays `not reached`: a gate passed on an earlier text opens nothing
test("TST-292106: gateStates derives passed on an earlier text, with its difference", async () => {
  const passed = record();
  assert.equal(of(await states([passed]), DEV).state, "passed", "known positive: the text is the one checked");
  const changed = await states([passed], { [INCREMENT]: BLOB_B });
  assert.deepEqual(of(changed, DEV), { gate: DEV, state: "passed on an earlier text", record: passed.path, needs: "a decision on the current text",
    difference: `${INCREMENT}: checked ${BLOB_A.slice(0, 12)}, now ${BLOB_B.slice(0, 12)}` });
  assert.equal(of(changed, RETRO).state, "not reached");
  const gone = await states([passed], {});
  assert.equal(of(gone, DEV).state, "passed on an earlier text");
  assert.equal(of(gone, DEV).difference, `${INCREMENT}: checked ${BLOB_A.slice(0, 12)}, no current text`);
});

// TST-292107 · level: unit · module: MOD-product-process
// guards: STATUS IS DERIVED FROM THE RECORDS; THE GATE IS RECORDED
// given: a rejection of Development → Sprint Review at 10:00; a pass at 11:00; a rejection at 12:00
// input: gateStates over each prefix of the records, given out of order
// expect: the rejection alone is `rejected` with its record, no needs; the pass after it is `passed`; the rejection after that is `rejected` again: the newest record decides, however the records are listed
test("TST-292107: gateStates lets the newest record of the decider decide", async () => {
  const no1 = record({ decision: "rejected", at: "10:00", reason: "Not yet." }), yes = record({ at: "11:00" }), no2 = record({ decision: "rejected", at: "12:00", reason: "A test is missing." });
  assert.deepEqual(of(await states([no1]), DEV), { gate: DEV, state: "rejected", record: no1.path, needs: null, difference: null });
  assert.deepEqual(of(await states([yes, no1]), DEV), { gate: DEV, state: "passed", record: yes.path, needs: null, difference: null });
  assert.deepEqual(of(await states([no2, no1, yes]), DEV), { gate: DEV, state: "rejected", record: no2.path, needs: null, difference: null });
});

// TST-292108 · level: unit · module: MOD-product-process
// guards: A GATE NAMES WHO DECIDES IT; A GATE IS NOT DECIDED BY THE PARTICIPANT WHOSE WORK IT CHECKS
// given: the known pass of the Product Owner; then a record of the same gate by another role (Scrum Master), a record of the check gate by another check, a record of a gate the workflow does not have
// input: gateStates over each alone
// expect: the pass is `passed`; the record by the Scrum Master leaves Development → Sprint Review `pending`; the record of another check leaves the check gate `pending`; a record of an unknown gate changes no state; none of them establishes a pass
test("TST-292108: gateStates does not take a pass from a record of the wrong decider", async () => {
  assert.equal(of(await states([record()]), DEV).state, "passed", "known positive");
  const wrongRole = record({ decider: "dev-b", role: "Scrum Master" });
  assert.equal(of(await states([wrongRole]), DEV).state, "pending");
  const entered = record({ at: "09:00" });
  const wrongCheck = record({ gate: RETRO, decider: "check: something-else", role: "check", on: ["0".repeat(40)], at: "11:00" });
  assert.equal(of(await states([entered, wrongCheck]), RETRO).state, "pending");
  const stranger = record({ gate: "Imaginary → Gate" });
  assert.deepEqual(await states([stranger]), await states([]));
});

// TST-292109 · level: unit · module: MOD-product-process
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: the workflow and a pass of Development → Sprint Review
// input: gateStates with the record, and without it
// expect: with the pass the later gate is reached (`pending`), without it `not reached`; a rejection does not open it; the state is a function of the records and the texts alone: the same inputs give the same answer, and nothing is kept between calls
test("TST-292109: gateStates reaches a gate only through the gates before it, and keeps nothing", async () => {
  const pass = record();
  assert.equal(of(await states([pass]), RETRO).state, "pending");
  assert.equal(of(await states([]), RETRO).state, "not reached");
  assert.equal(of(await states([record({ decision: "rejected", reason: "No." })]), RETRO).state, "not reached");
  assert.deepEqual(await states([pass]), await states([pass]));
  assert.equal(of(await states([]), RETRO).state, "not reached", "no state is kept between calls");
});

// TST-292110 · level: unit · module: MOD-product-process
// guards: A GATE NAMES WHO DECIDES IT
// given: the known pass of the Product Owner; then a record of the same gate that names the role Product Owner but whose decider is a check
// input: gateStates over each alone
// expect: the pass is `passed`; the record whose decider is a check leaves a gate decided by a role `pending`: a check is not a holder of the role
test("TST-292110: gateStates does not take a pass from a check for a gate decided by a role", async () => {
  assert.equal(of(await states([record()]), DEV).state, "passed", "known positive");
  assert.equal(of(await states([record({ decider: "check: node", role: "Product Owner" })]), DEV).state, "pending");
});

// TST-292111 · level: unit · module: MOD-product-process
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: two records of the gate whose paths are in one order and whose `date` fields in the other: a rejection filed under the later path and the earlier date, a pass under the earlier path and the later date
// input: gateStates, the records listed in either order
// expect: the record with the later `date` decides — `passed` — whatever the order of the paths or of the list
test("TST-292111: gateStates orders the records by their date, not by their file names", async () => {
  const rejected = record({ decision: "rejected", at: "12:00", date: "2026-10-12 09:00 UTC", reason: "Early." });
  const passed = record({ at: "10:00", date: "2026-10-12 11:00 UTC" });
  assert.ok(rejected.path > passed.path, "the rejection's path is the later one");
  for (const listed of [[rejected, passed], [passed, rejected]]) assert.deepEqual(of(await states(listed), DEV), { gate: DEV, state: "passed", record: passed.path, needs: null, difference: null });
});
