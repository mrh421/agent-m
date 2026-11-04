// The declaration and the workflow of a product (ITM-218) — MOD-product-process' interface as the accepted text of
// docs/architecture/MOD-product-process.md states it, for UC-002: Workflow; declarationSchema, the schema of a product's
// docs/process.md, read from the module's own declaration.schema.md; declarationFindings; and workflowOf.
// Run: node --test tests/product-process.test.mjs
//
// Module: MOD-product-process
// Guards: UC-002; THE PROCESS MODEL IS DECLARED PER PRODUCT; A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; THE MODEL DETERMINES THE PHASES AND THE GATES; A PROCESS REQUIREMENT ADDS TO THE MODEL; A PRACTICE IS NOT A MODEL; A ROLE NAMES THE CAPABILITIES IT NEEDS; A PRODUCT DECLARES ITS DEFINITION OF DONE; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// Level: unit
//
// What ITM-218 builds, and these tests state:
// - declarationSchema reads a declaration: its front matter `model`, `model_file`, `model_version`; its `## Practices`,
//   `## Branches` (Phase or time box, Branch), `## Definition of Done`, and the optional `## Gates added by requirements`
//   (Requirement, Between, Artifacts, Condition, Decider). It names roles and never a participant: the product's role
//   assignments fill the roles (tests/product-process-role-assignments.test.mjs). The module reads the
//   schema from its own declaration.schema.md once, when it is loaded: from the disk in Node, from its own address in a
//   browser.
// - declarationFindings(declaration, catalogue, participants, instanceSpec) names, each as an error, against the
//   Catalogue at the commit the declaration's model_version names: a model that catalogue does not hold at model_file, or
//   whose findings in it hold an error; a participant of the instance's list named in the declaration; a practice the catalogue does not hold, or
//   whose `fits` does not name the model; a branch for a phase the model lacks; a gate under `## Gates added by
//   requirements` whose requirement the instance's SPEC does not hold.
// - workflowOf(declaration, model, practices, instanceSpec) gives the model's phases, transitions, verification pairs and
//   gates and the gates the process requirements add, each with its requirement and the source that requirement names in
//   the instance's SPEC, and nothing else; the roles with how many fill each, the branches, and the job rules as the Definition
//   of Done, with the conditions the declaration adds after them.
//
// Not tested here: roleAssignmentSchema's documents, roleAssignmentFindings, holdsRole and mayDecide
// (tests/product-process-role-assignments.test.mjs; a holder's capabilities and place,
// tests/product-process-eligibility.test.mjs); gateSchema and gateStates (tests/product-process-gates.test.mjs), recordGateDecision
// (tests/product-process-record-gate.test.mjs) and doneCheck (tests/product-process-done.test.mjs). Explicit practice tables are covered; shipped practices whose Adds are prose still contribute no
// workflow data.
//
// The fixture product declares an instance model, docs/process-models/team-scrum.md — Scrum adapted so that its Product
// Owner must be a person —, at the commit VERSION. Its Catalogue is the one MOD-model-catalogue's catalogue gives over the
// instance's snapshot at that commit; its participants are the fixture register read with MOD-participant-list's schema; the
// instance's SPEC is a fixture text. Agent M's own docs/process.md is read as it stands and never changed; no test opens
// Agent M's SPEC.md.
//
// Each test states its input and its expected result before it runs (given / input / expect). A test that expects no
// finding has its known positives in the tests after it, each of which changes one line of the fixture and finds one. Nothing
// reaches the network. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { documentFindings, readDocument } from "../src/documents/index.mjs";
import { catalogue, modelSchema } from "../src/model-catalogue/index.mjs";
import { participantSchema } from "../src/participant-list/index.mjs";
import { declarationFindings, declarationSchema, roleAssignmentSchema, workflowOf } from "../src/product-process/index.mjs";

const MODULE = new URL("../src/product-process/index.mjs", import.meta.url);
const SCHEMA_FILE = new URL("../src/product-process/declaration.schema.md", import.meta.url);
const ASSIGNMENT_SCHEMA_FILE = new URL("../src/product-process/role-assignment.schema.md", import.meta.url);
const GATE_SCHEMA_FILE = new URL("../src/product-process/gate-record.schema.md", import.meta.url);
const AGENT_M_DECLARATION = new URL("../docs/process.md", import.meta.url);
const DECLARATION_PATH = "docs/process.md";

const DECLARED = "THE PROCESS MODEL IS DECLARED PER PRODUCT";
const VALIDATED = "A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED";
const PEOPLE_AND_AGENTS = "A PROCESS MODEL ORGANISES PEOPLE AND AGENTS";
const PRACTICE = "A PRACTICE IS NOT A MODEL";
const BRANCH = "A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN";
const ADDS = "A PROCESS REQUIREMENT ADDS TO THE MODEL";
const NAMES_ROLES = "THE PROCESS NAMES ROLES, NOT PARTICIPANTS";

// The job rules, as the module file's Data states them: every Definition of Done holds them
// (THE DEFAULT DEFINITION OF DONE IS THE JOB RULES).
const JOB_RULES = [
  "CI is green",
  "the job's first commit holds only tests and CI was red on it — for a refactoring job, CI was green on every commit and "
    + "no test's expected result changed",
  "every changed code file lies in the folder of one of the job's modules",
  "every new test names a requirement and a module",
  "every gate the workflow places before the merge is recorded",
];

// ---------------------------------------------------------------- texts and their lines

const linesOf = (text) => text.split("\n");

// `text` with its line `number` replaced by `line`; the line it names must be the one expected, so that each change is the
// one the test says.
function replaced(text, number, expected, line) {
  const lines = linesOf(text);
  assert.equal(lines[number - 1], expected, `line ${number}`);
  lines.splice(number - 1, 1, line);
  return lines.join("\n");
}

// `text` with its line `number` removed.
function removed(text, number, expected) {
  const lines = linesOf(text);
  assert.equal(lines[number - 1], expected, `line ${number}`);
  lines.splice(number - 1, 1);
  return lines.join("\n");
}

// ---------------------------------------------------------------- the fixture instance

// The commit of the instance that the fixture product's declaration names as its model's version.
const VERSION = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";

// The instance's own model, as the instance holds it at VERSION: the shipped Scrum model, adapted so that its Product Owner
// must be a person and its Developers are agents. Its phases and roles carry the shipped Scrum model's names.
const MODEL_PATH = "docs/process-models/team-scrum.md";
const MODEL = [
  "---",                                                                                                          // 1
  "name: team-scrum",                                                                                             // 2
  "kind: pulled",                                                                                                 // 3
  "adapted_from: scrum",                                                                                          // 4
  "measure: remaining items per time box",                                                                        // 5
  "---",                                                                                                          // 6
  "# Scrum with a person as Product Owner",                                                                       // 7
  "",                                                                                                             // 8
  "The shipped Scrum model, adapted by the instance: its Product Owner is a person, its Developers are agents.",  // 9
  "",                                                                                                             // 10
  "## Phases",                                                                                                    // 11
  "",                                                                                                             // 12
  "| Name | Role | Produces |",                                                                                   // 13
  "|---|---|---|",                                                                                                // 14
  "| Sprint Planning | Product Owner | ITM |",                                                                     // 15
  "| Development | Developers | MOD, TST |",                                                                       // 16
  "| Sprint Review | Product Owner | sprint record |",                                                            // 17
  "| Sprint Retrospective | Scrum Master | sprint record |",                                                      // 18
  "",                                                                                                             // 19
  "## Transitions",                                                                                               // 20
  "",                                                                                                             // 21
  "| From | To | Kind |",                                                                                         // 22
  "|---|---|---|",                                                                                                // 23
  "| Sprint Planning | Development | sequence |",                                                                 // 24
  "| Development | Sprint Review | sequence |",                                                                   // 25
  "| Sprint Review | Sprint Retrospective | sequence |",                                                          // 26
  "| Sprint Retrospective | Sprint Planning | back |",                                                            // 27
  "",                                                                                                             // 28
  "## Verification pairs",                                                                                        // 29
  "",                                                                                                             // 30
  "| Phase | Checked by |",                                                                                       // 31
  "|---|---|",                                                                                                    // 32
  "| Development | Sprint Review |",                                                                              // 33
  "",                                                                                                             // 34
  "## Gates",                                                                                                     // 35
  "",                                                                                                             // 36
  "| Between | Artifacts | Condition | Decider |",                                                               // 37
  "|---|---|---|---|",                                                                                            // 38
  "| Development → Sprint Review | the increment: the MOD and TST of the selected ITM | every selected item meets its "
    + "acceptance criteria | Product Owner |",                                                                    // 39
  "| Sprint Retrospective → Sprint Planning | the sprint record of the review and the retrospective | the retrospective "
    + "names how the team will improve | Product Owner |",                                                        // 40
  "",                                                                                                             // 41
  "## Roles",                                                                                                     // 42
  "",                                                                                                             // 43
  "| Name | Filled by | How many | Capabilities |",                                                               // 44
  "|---|---|---|---|",                                                                                            // 45
  "| Product Owner | person | one | read the repository, write to the repository |",                              // 46
  "| Scrum Master | either | one | read the repository |",                                                        // 47
  "| Developers | agent | several | read the repository, write to the repository, run code and tests |",          // 48
  "",                                                                                                             // 49
  "## Flow control",                                                                                              // 50
  "",                                                                                                             // 51
  "| Kind | Value |",                                                                                             // 52
  "|---|---|",                                                                                                    // 53
  "| WIP limit | — |",                                                                                            // 54
  "| Time box | 1 week |",                                                                                         // 55
  "| Sprints | yes |",                                                                                            // 56
  "",
].join("\n");

// The instance's register of participants: alice, a person; dev-a and dev-b, two CLI agents.
const PARTICIPANTS = readDocument(participantSchema(), "docs/participants.md", [
  "# Participants of this instance",
  "",
  "**REGISTER**",
  "",
  "The people and agents who work on the products of the fixture instance, one row per participant.",
  "",
  "| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |",
  "|---|---|---|---|---|---|---|---|",
  "| alice | person | — | — | — | draft text, read the repository, write to the repository | — | account github.com/alice |",
  "| dev-a | CLI agent | example-model | 200000 | — | draft text, read the repository, write to the repository, run code and "
    + "tests | this machine | bridge lab-pc agent claude |",
  "| dev-b | CLI agent | other-model | 200000 | — | draft text, read the repository, write to the repository, run code and "
    + "tests | this machine | bridge lab-pc agent codex |",
  "",
].join("\n"));

// The instance's own SPEC, whose requirements are the process requirements: one, with its source.
const INSTANCE_SPEC = [
  "# Fixture instance — Specification",
  "",
  "The instance's own requirements; those on the development process are the process requirements of its products.",
  "",
  "## 1. Process",
  "",
  "**UNIT VERIFICATION IS DOCUMENTED** *(SRC-iec-62304, 5.5.5)*",
  "The verification of every unit of an increment is recorded before the increment is reviewed.",
  "*Check:* `tests/test_unit_verification.py`",
  "",
].join("\n");

// A blob for each path of a fixture snapshot: 40 hexadecimal digits, another for every path.
const blobOf = (path) => createHash("sha1").update(path).digest("hex");

// The snapshot of the instance repository at VERSION holding these files, { path: text }, as MOD-repository-hosts' Snapshot
// gives it: its commit, its paths, read(path) -> Promise<string | null>, blob(path) -> string | null.
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

// The Catalogue at the commit the declaration names, as MOD-model-catalogue's catalogue gives it over the instance's
// snapshot at that commit.
const catalogueAt = (files) => catalogue(snapshotAt(files));

// ---------------------------------------------------------------- the fixture product's declaration

const DECLARATION = [
  "---",                                                                                                          // 1
  "model: team-scrum",                                                                                            // 2
  `model_file: ${MODEL_PATH}`,                                                                                    // 3
  `model_version: ${VERSION}`,                                                                                    // 4
  "---",                                                                                                          // 5
  "",                                                                                                             // 6
  "# How the fixture product is developed",                                                                      // 7
  "",                                                                                                             // 8
  "The fixture product's process, as its Author declared it.",                                                   // 9
  "",                                                                                                             // 10
  "## Roles",                                                                                                     // 11
  "",                                                                                                             // 12
  "- Product Owner",                                                                                              // 13
  "- Scrum Master",                                                                                               // 14
  "- Developers",                                                                                                 // 15
  "",                                                                                                             // 16
  "The product's role assignments under docs/role-assignments/ fill them.",                                      // 17
  "",                                                                                                             // 18
  "## Practices",                                                                                                 // 19
  "",                                                                                                             // 20
  "- none",                                                                                                       // 21
  "",                                                                                                             // 22
  "## Branches",                                                                                                  // 23
  "",                                                                                                             // 24
  "| Phase or time box | Branch |",                                                                              // 25
  "|---|---|",                                                                                                    // 26
  "| Sprint | sprint/<nn> |",                                                                                     // 27
  "| Development | develop |",                                                                                   // 28
  "",                                                                                                             // 29
  "## Definition of Done",                                                                                        // 30
  "",                                                                                                             // 31
  "The job rules hold for every pull request; no condition is added.",                                           // 32
  "",                                                                                                             // 33
  "## Gates added by requirements",                                                                               // 34
  "",                                                                                                             // 35
  "| Requirement | Between | Artifacts | Condition | Decider |",                                                 // 36
  "|---|---|---|---|---|",                                                                                        // 37
  "| UNIT VERIFICATION IS DOCUMENTED | Development → Sprint Review | the unit verification records of the selected ITM "
    + "| every unit of the increment has a recorded verification | Product Owner |",                             // 38
  "",
].join("\n");

const PRACTICES_NONE = "- none";

// The same declaration naming the shipped Scrum model in place of the instance's: the roles and phases it names are the
// shipped model's too, whose roles may each be filled by a person or an agent.
const SCRUM_DECLARATION = replaced(replaced(DECLARATION, 2, "model: team-scrum", "model: scrum"),
  3, `model_file: ${MODEL_PATH}`, "model_file: src/model-catalogue/models/scrum.md");

const declarationOf = (text) => readDocument(declarationSchema, DECLARATION_PATH, text);

// declarationFindings of a declaration's text against a catalogue, with the fixture participants, no linked source and the
// instance's SPEC; every finding names the declaration's path, since the declaration has no identifier.
function findingsOf(text, cat) {
  const found = declarationFindings(declarationOf(text), cat, PARTICIPANTS, INSTANCE_SPEC);
  for (const f of found) assert.equal(f.artifact, DECLARATION_PATH, "a finding names the declaration's path");
  return found;
}
const brief = (found) => found.map((f) => [f.line, f.kind, f.rule]);

// ---------------------------------------------------------------- declarationSchema: where the schemas are read from
//
// The module reads its own declaration.schema.md, role-assignment.schema.md and gate-record.schema.md once each, in that order, when it is
// loaded: from the disk where the platform offers
// `process.getBuiltinModule("node:fs")`, as Node does, and from its own address with `fetch` where it does not, as in a
// browser. Each case sets these two for one load of the module, loads it anew from its own address with a query of its own,
// `index.mjs?load=<n>`, and puts both back — as tests/participant-list.test.mjs loads MOD-participant-list. The real
// schema files are read, never changed.

// One load of the module, anew: `disk` is what process.getBuiltinModule("node:fs") gives it — undefined, as in a browser —,
// `fetch` the browser's fetch. -> { module, error, reads } — the module's namespace, or the error its load failed with; and
// every read of the load, as "disk <address>" or "fetch <address>".
let loads = 0;
async function load({ disk, fetch }) {
  const saved = { getBuiltinModule: process.getBuiltinModule, fetch: globalThis.fetch };
  const reads = [];
  process.getBuiltinModule = (name) => (name === "node:fs" ? disk?.(reads) : saved.getBuiltinModule.call(process, name));
  globalThis.fetch = fetch ? (url) => { reads.push(`fetch ${url}`); return fetch(url); } : undefined;
  try {
    loads += 1;
    return { module: await import(new URL(`?load=${loads}`, MODULE)), error: null, reads };
  } catch (error) {
    return { module: null, error, reads };
  } finally {
    process.getBuiltinModule = saved.getBuiltinModule;
    globalThis.fetch = saved.fetch;
  }
}

// A disk that gives the real file's text for a read, noting each read.
const realDisk = (reads) => ({
  readFileSync: (url, encoding) => { reads.push(`disk ${url}`); return readFileSync(url, encoding); },
});

// TST-472441 · level: unit · module: MOD-product-process
// guards: UC-002; UC-048; THE PROCESS MODEL IS DECLARED PER PRODUCT; A ROLE ASSIGNMENT FILLS THE ROLES
// given: the module loaded anew three times — (a) as in Node, with a disk that gives the real files; (b) as in a browser, without a disk, whose fetch answers each of the module's own addresses with the text of the real file there; (c) as in a browser whose fetch answers 404 Not Found
// input: (a), (b): declarationSchema and roleAssignmentSchema, and the fixture product's declaration read with the first
// expect: (a) three reads, of src/product-process/declaration.schema.md, then of role-assignment.schema.md and of gate-record.schema.md, from the disk; (b) three reads, of the same addresses with fetch; each gives schemas deep-equal to those of the module as this file loaded it, the first of which reads the declaration's model, team-scrum. (c) one read, of the declaration's schema; the module does not load — a schema that cannot be read stops its module (MOD-documents, loadSchema) — and the error names declaration.schema.md and 404
test("declarationSchema — the module's schemas are read from its own declaration.schema.md and role-assignment.schema.md: from the disk in Node, from its own address in a browser", async () => {
  const onDisk = await load({ disk: realDisk });
  const atAddress = await load({ disk: undefined,
    fetch: async (url) => new Response(readFileSync(new URL(url), "utf8"), { status: 200 }) });
  for (const [where, loaded, read] of [["disk", onDisk, "disk"], ["address", atAddress, "fetch"]]) {
    assert.equal(loaded.error, null, `${where}: the module loads: ${loaded.error?.message}`);
    assert.deepEqual(loaded.reads, [`${read} ${SCHEMA_FILE.href}`, `${read} ${ASSIGNMENT_SCHEMA_FILE.href}`, `${read} ${GATE_SCHEMA_FILE.href}`], where);
    assert.deepEqual(loaded.module.declarationSchema, declarationSchema, where);
    assert.deepEqual(loaded.module.roleAssignmentSchema, roleAssignmentSchema, where);
    assert.equal(readDocument(loaded.module.declarationSchema, DECLARATION_PATH, DECLARATION).fields.model, "team-scrum", where);
  }
  const notServed = await load({ disk: undefined, fetch: async () => new Response("Not Found", { status: 404 }) });
  assert.deepEqual(notServed.reads, [`fetch ${SCHEMA_FILE.href}`]);
  assert.equal(notServed.module, null, "a schema that cannot be read stops the module");
  assert.ok(notServed.error instanceof Error && notServed.error.message.includes("declaration.schema.md")
    && notServed.error.message.includes("404"), `the error names declaration.schema.md and 404: ${notServed.error?.message}`);
});

// ---------------------------------------------------------------- declarationSchema: a declaration read by it

// The rows of a section of a document read with the declaration's schema: each as [line, cells].
const rowsUnder = (document, heading) =>
  (document.sections.find((section) => section.heading === heading)?.rows ?? []).map((row) => [row.line, row.cells]);

// TST-472442 · level: unit · module: MOD-product-process
// guards: UC-002; THE PROCESS MODEL IS DECLARED PER PRODUCT; A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; A PROCESS REQUIREMENT ADDS TO THE MODEL
// given: the fixture product's declaration DECLARATION
// input: readDocument(declarationSchema, "docs/process.md", DECLARATION); documentFindings(declarationSchema, it)
// expect: its front matter as written: model team-scrum, model_file docs/process-models/team-scrum.md, model_version VERSION, and no other key; its sections in order — ## Roles, which names the roles as free text, ## Practices, ## Branches, ## Definition of Done, ## Gates added by requirements —; the rows of ## Branches: Sprint → sprint/<nn> (line 27), Development → develop (line 28); of ## Gates added by requirements, on line 38: UNIT VERIFICATION IS DOCUMENTED, between Development → Sprint Review, its artifacts, condition and decider Product Owner. And no finding of the schema
test("declarationSchema — a product's declaration read by its schema: front matter, branches and the gates requirements add; its roles are named, never filled", () => {
  const document = declarationOf(DECLARATION);
  assert.deepEqual(document.fields, { model: "team-scrum", model_file: MODEL_PATH, model_version: VERSION });
  assert.deepEqual(document.sections.map((section) => section.heading),
    ["## Roles", "## Practices", "## Branches", "## Definition of Done", "## Gates added by requirements"]);
  assert.deepEqual(rowsUnder(document, "## Branches"), [
    [27, { "Phase or time box": "Sprint", Branch: "sprint/<nn>" }],
    [28, { "Phase or time box": "Development", Branch: "develop" }],
  ]);
  assert.deepEqual(rowsUnder(document, "## Gates added by requirements"), [
    [38, { Requirement: "UNIT VERIFICATION IS DOCUMENTED", Between: "Development → Sprint Review",
      Artifacts: "the unit verification records of the selected ITM",
      Condition: "every unit of the increment has a recorded verification", Decider: "Product Owner" }],
  ]);
  assert.deepEqual(documentFindings(declarationSchema, document), []);
});

// TST-472443 · level: unit · module: MOD-product-process
// guards: UC-002; THE PROCESS MODEL IS DECLARED PER PRODUCT
// given: known positive first — the fixture product's declaration without its line `model_version: …` (line 4); then this instance's own declaration docs/process.md, as it stands
// input: readDocument(declarationSchema, "docs/process.md", the text); documentFindings(declarationSchema, it)
// expect: for the declaration without its model version, one error, on line 1 — a key that is missing stands on no line —, naming THE PROCESS MODEL IS DECLARED PER PRODUCT. For this instance's declaration, no finding; its front matter as it writes it — model scrum-wip, model_file docs/process-models/scrum-wip.md and a model_version of 40 hexadecimal digits, and no other key —; its three role names, and no participant: the role assignments under docs/role-assignments/ fill the roles; and its one branch, for Sprint, as it writes it: `sprint/<team>/<nn>`, in backticks
test("declarationSchema — a declaration without its model's version is named; this instance's own docs/process.md is read without a finding", () => {
  const unversioned = declarationOf(removed(DECLARATION, 4, `model_version: ${VERSION}`));
  assert.deepEqual(documentFindings(declarationSchema, unversioned).map((f) => [f.line, f.kind, f.rule]), [[1, "error", DECLARED]]);

  const processText = readFileSync(AGENT_M_DECLARATION, "utf8");
  const agentM = declarationOf(processText);
  assert.deepEqual(documentFindings(declarationSchema, agentM), []);
  assert.deepEqual(Object.keys(agentM.fields), ["model", "model_file", "model_version"]);
  assert.deepEqual([agentM.fields.model, agentM.fields.model_file], ["scrum-wip", "docs/process-models/scrum-wip.md"]);
  assert.match(agentM.fields.model_version, /^[0-9a-f]{40}$/);
  assert.deepEqual(rowsUnder(agentM, "## Roles"), [], "the declaration assigns no people to its roles");
  assert.match(processText, /## Roles\n\n- Product Owner\n- Scrum Master\n- Developers\n/);
  assert.deepEqual(rowsUnder(agentM, "## Branches").map(([, cells]) => cells),
    [{ "Phase or time box": "Sprint", Branch: "`sprint/<team>/<nn>`" }]);
});

// ---------------------------------------------------------------- declarationFindings

// TST-472444 · level: unit · module: MOD-product-process
// guards: UC-002; THE PROCESS MODEL IS DECLARED PER PRODUCT; A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; A PRACTICE IS NOT A MODEL; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; A PROCESS REQUIREMENT ADDS TO THE MODEL
// given: the fixture product — its declaration as it stands; the Catalogue at VERSION, whose instance holds team-scrum at docs/process-models/team-scrum.md, without a finding; its register of participants, in which alice is a person; its instance's SPEC, which holds UNIT VERIFICATION IS DOCUMENTED. The Product Owner, whom team-scrum fills by a person, is alice; it declares no practice; it sets a branch for its sprint — team-scrum works in sprints — and one for the phase Development
// input: declarationFindings(declaration, that catalogue, the participants, the instance's SPEC)
// expect: no finding — the known positive of every test below, each of which changes one line and finds one
test("declarationFindings — the fixture product's declaration, against the catalogue at the commit it names, has no finding", async () => {
  const cat = await catalogueAt({ [MODEL_PATH]: MODEL });
  assert.deepEqual(cat.findings[MODEL_PATH], [], "the instance's model has no finding at VERSION");
  assert.deepEqual(brief(findingsOf(DECLARATION, cat)), []);
});

// TST-472445 · level: unit · module: MOD-product-process
// guards: UC-002; THE PROCESS MODEL IS DECLARED PER PRODUCT
// given: the fixture product's declaration, which names the model at docs/process-models/team-scrum.md at VERSION; the Catalogue at VERSION, whose instance does not hold that file yet: the named version lacks it
// input: declarationFindings(declaration, that catalogue, the participants, the instance's SPEC)
// expect: one error, on the line of model_file (line 3), naming THE PROCESS MODEL IS DECLARED PER PRODUCT; its text names the file and the commit
test("declarationFindings — a model that the catalogue at the declared commit does not hold at model_file is an error", async () => {
  const found = findingsOf(DECLARATION, await catalogueAt({}));
  assert.deepEqual(brief(found), [[3, "error", DECLARED]]);
  assert.ok(found[0].what.includes(MODEL_PATH) && found[0].what.includes(VERSION), found[0].what);
});

// TST-472446 · level: unit · module: MOD-product-process
// guards: UC-002; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; THE PROCESS MODEL IS DECLARED PER PRODUCT
// given: the fixture product's declaration; the Catalogue at VERSION, whose instance holds team-scrum as it stood then: its role Scrum Master without capabilities (line 47) — an error finding of the model in that catalogue
// input: declarationFindings(declaration, that catalogue, the participants, the instance's SPEC)
// expect: one error, on the line of model_file (line 3), naming A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; its text names the model's file
test("declarationFindings — a model whose findings in the catalogue at the declared commit hold an error is an error", async () => {
  const broken = replaced(MODEL, 47, "| Scrum Master | either | one | read the repository |", "| Scrum Master | either | one | — |");
  const cat = await catalogueAt({ [MODEL_PATH]: broken });
  assert.deepEqual(cat.findings[MODEL_PATH].map((f) => f.kind), ["error"], "the model has an error at VERSION");
  const found = findingsOf(DECLARATION, cat);
  assert.deepEqual(brief(found), [[3, "error", VALIDATED]]);
  assert.ok(found[0].what.includes(MODEL_PATH), found[0].what);
});

// TST-472447 · level: unit · module: MOD-product-process
// guards: UC-002; THE PROCESS NAMES ROLES, NOT PARTICIPANTS
// given: known positive first — the fixture product's declaration, which names roles only; then the same declaration naming alice, a participant of the instance's list, (a) in its text (line 9) and (b) as a branch (line 28)
// input: declarationFindings of each, against the Catalogue at VERSION
// expect: no finding for the first; for each other, one error on the line that names the participant, naming THE PROCESS NAMES ROLES, NOT PARTICIPANTS; its text names alice
test("declarationFindings — a declaration that names a participant is an error", async () => {
  const cat = await catalogueAt({ [MODEL_PATH]: MODEL });
  assert.deepEqual(brief(findingsOf(DECLARATION, cat)), []);
  const cases = [
    [9, "The fixture product's process, as its Author declared it.", "The fixture product's process, as alice declared it."],
    [28, "| Development | develop |", "| Development | alice |"],
  ];
  for (const [line, before, after] of cases) {
    const found = findingsOf(replaced(DECLARATION, line, before, after), cat);
    assert.deepEqual(brief(found), [[line, "error", NAMES_ROLES]], after);
    assert.ok(found[0].what.includes("alice"), found[0].what);
  }
});

// TST-472448 · level: unit · module: MOD-product-process
// guards: UC-002; A PRACTICE IS NOT A MODEL
// given: known positive first — the declaration naming the shipped Scrum model, with the practice devops (line 21), which the catalogue holds and which fits scrum; then the same declaration with the practice pair-programming, which the catalogue does not hold
// input: declarationFindings of each, against the Catalogue at VERSION
// expect: no finding for devops; for pair-programming one error, on line 21, naming A PRACTICE IS NOT A MODEL; its text names the practice
test("declarationFindings — a practice the catalogue does not hold is an error", async () => {
  const cat = await catalogueAt({ [MODEL_PATH]: MODEL });
  assert.deepEqual(brief(findingsOf(replaced(SCRUM_DECLARATION, 21, PRACTICES_NONE, "- devops"), cat)), []);
  const found = findingsOf(replaced(SCRUM_DECLARATION, 21, PRACTICES_NONE, "- pair-programming"), cat);
  assert.deepEqual(brief(found), [[21, "error", PRACTICE]]);
  assert.ok(found[0].what.includes("pair-programming"), found[0].what);
});

// TST-472449 · level: unit · module: MOD-product-process
// guards: UC-002; A PRACTICE IS NOT A MODEL
// given: known positive first — the declaration naming the shipped Scrum model, with the practice devops (line 21), whose `fits` names scrum and kanban; then the fixture product's own declaration, of the model team-scrum, with devops
// input: declarationFindings of each, against the Catalogue at VERSION
// expect: no finding for scrum; for team-scrum one error, on line 21, naming A PRACTICE IS NOT A MODEL; its text names the practice and the model
test("declarationFindings — a practice whose fits does not name the model is an error", async () => {
  const cat = await catalogueAt({ [MODEL_PATH]: MODEL });
  assert.deepEqual(brief(findingsOf(replaced(SCRUM_DECLARATION, 21, PRACTICES_NONE, "- devops"), cat)), []);
  const found = findingsOf(replaced(DECLARATION, 21, PRACTICES_NONE, "- devops"), cat);
  assert.deepEqual(brief(found), [[21, "error", PRACTICE]]);
  assert.ok(found[0].what.includes("devops") && found[0].what.includes("team-scrum"), found[0].what);
});

// TST-472450 · level: unit · module: MOD-product-process
// guards: UC-002; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN
// given: (a) the fixture product's declaration with its branch for Development (line 28) set for Hotfix, which is no phase of team-scrum; (b) the declaration as it stands, its branch for Sprint (line 27) included, against the Catalogue at VERSION whose team-scrum works in no sprints (`| Sprints | no |`, line 56): Sprint names no phase and no time box of that model
// input: declarationFindings of each
// expect: for (a) one error, on line 28, naming A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN, its text naming Hotfix; for (b) one error, on line 27, naming the same, its text naming Sprint
test("declarationFindings — a branch for a phase the model lacks is an error", async () => {
  const cat = await catalogueAt({ [MODEL_PATH]: MODEL });
  const hotfix = findingsOf(replaced(DECLARATION, 28, "| Development | develop |", "| Hotfix | hotfix |"), cat);
  assert.deepEqual(brief(hotfix), [[28, "error", BRANCH]]);
  assert.ok(hotfix[0].what.includes("Hotfix"), hotfix[0].what);

  const noSprints = await catalogueAt({ [MODEL_PATH]: replaced(MODEL, 56, "| Sprints | yes |", "| Sprints | no |") });
  assert.deepEqual(noSprints.findings[MODEL_PATH], [], "team-scrum without sprints has no finding");
  const sprint = findingsOf(DECLARATION, noSprints);
  assert.deepEqual(brief(sprint), [[27, "error", BRANCH]]);
  assert.ok(sprint[0].what.includes("Sprint"), sprint[0].what);
});

// TST-472451 · level: unit · module: MOD-product-process
// guards: UC-002; A PROCESS REQUIREMENT ADDS TO THE MODEL
// given: the fixture product's declaration with its gate added by requirements (line 38) named by INTEGRATION IS DOCUMENTED, which the instance's SPEC does not hold
// input: declarationFindings, against the Catalogue at VERSION and the instance's SPEC
// expect: one error, on line 38, naming A PROCESS REQUIREMENT ADDS TO THE MODEL; its text names the requirement
test("declarationFindings — a gate whose requirement the instance's SPEC does not hold is an error", async () => {
  const cat = await catalogueAt({ [MODEL_PATH]: MODEL });
  const row = linesOf(DECLARATION)[37];
  assert.ok(row.startsWith("| UNIT VERIFICATION IS DOCUMENTED |"), "line 38 is the gate's row");
  const found = findingsOf(replaced(DECLARATION, 38, row, row.replace("UNIT VERIFICATION IS DOCUMENTED", "INTEGRATION IS DOCUMENTED")), cat);
  assert.deepEqual(brief(found), [[38, "error", ADDS]]);
  assert.ok(found[0].what.includes("INTEGRATION IS DOCUMENTED"), found[0].what);
});

// ---------------------------------------------------------------- workflowOf

// The workflow of the fixture product, as the module file's Workflow states it: the model it was given; the practices the
// declaration names; the model's phases, transitions and verification pairs; the model's gates, each named `<phase> →
// <phase>`, then the gate the requirement adds, named by the requirement, with the source the instance's SPEC names for it;
// the model's roles, each with who may fill it, how many fill it and its capabilities; the branches of ## Branches;
// and the job rules as the Definition of Done.
function expectedWorkflow(model) {
  return {
    model,
    practices: [],
    phases: [
      { name: "Sprint Planning", roles: ["Product Owner"], produces: ["ITM"] },
      { name: "Development", roles: ["Developers"], produces: ["MOD", "TST"] },
      { name: "Sprint Review", roles: ["Product Owner"], produces: ["sprint record"] },
      { name: "Sprint Retrospective", roles: ["Scrum Master"], produces: ["sprint record"] },
    ],
    transitions: [
      { from: "Sprint Planning", to: "Development", kind: "sequence" },
      { from: "Development", to: "Sprint Review", kind: "sequence" },
      { from: "Sprint Review", to: "Sprint Retrospective", kind: "sequence" },
      { from: "Sprint Retrospective", to: "Sprint Planning", kind: "back" },
    ],
    pairs: [{ phase: "Development", checkedBy: "Sprint Review" }],
    gates: [
      { name: "Development → Sprint Review", from: "Development", to: "Sprint Review",
        artifacts: "the increment: the MOD and TST of the selected ITM",
        condition: "every selected item meets its acceptance criteria", decider: "Product Owner", addedBy: null, practice: null },
      { name: "Sprint Retrospective → Sprint Planning", from: "Sprint Retrospective", to: "Sprint Planning",
        artifacts: "the sprint record of the review and the retrospective",
        condition: "the retrospective names how the team will improve", decider: "Product Owner", addedBy: null, practice: null },
      { name: "UNIT VERIFICATION IS DOCUMENTED", from: "Development", to: "Sprint Review",
        artifacts: "the unit verification records of the selected ITM",
        condition: "every unit of the increment has a recorded verification", decider: "Product Owner",
        addedBy: { requirement: "UNIT VERIFICATION IS DOCUMENTED", source: "SRC-iec-62304, 5.5.5" }, practice: null },
    ],
    roles: [
      { name: "Product Owner", filledBy: "person", howMany: "one", capabilities: ["read the repository",
        "write to the repository"] },
      { name: "Scrum Master", filledBy: "either", howMany: "one", capabilities: ["read the repository"] },
      { name: "Developers", filledBy: "agent", howMany: "several", capabilities: ["read the repository",
        "write to the repository", "run code and tests"] },
    ],
    branches: { Sprint: "sprint/<nn>", Development: "develop" },
    done: JOB_RULES,
  };
}

// The instance's model team-scrum, as the Catalogue at VERSION gives it.
async function teamScrum() {
  return (await catalogueAt({ [MODEL_PATH]: MODEL })).models.find((model) => model.path === MODEL_PATH);
}

// TST-472452 · level: unit · module: MOD-product-process
// guards: UC-002; THE MODEL DETERMINES THE PHASES AND THE GATES; A PROCESS REQUIREMENT ADDS TO THE MODEL; A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; A ROLE NAMES THE CAPABILITIES IT NEEDS; A PHASE OR A TIME BOX MAY HAVE A BRANCH OF ITS OWN; WORK MERGES INTO THE DEFAULT BRANCH UNLESS A BRANCH IS SET; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES
// given: the fixture product's declaration; team-scrum as the Catalogue at VERSION gives it; no practice; the instance's SPEC; and the declaration once more without the two rows of its ## Branches (lines 27 and 28)
// input: workflowOf(declaration, team-scrum, [], the instance's SPEC) of each
// expect: exactly expectedWorkflow(team-scrum): the model's four phases, four transitions, one verification pair and two gates, each named `<phase> → <phase>`, with no requirement and no practice; then the gate UNIT VERIFICATION IS DOCUMENTED adds, between Development and Sprint Review, named by its requirement and marked with it and its source in the instance's SPEC, `SRC-iec-62304, 5.5.5`; the model's three roles with how many fill each; the branches Sprint → sprint/<nn> and Development → develop; the five job rules as the Definition of Done — and nothing else. Without a row under ## Branches, the same workflow with no branch: work merges into the default branch
test("workflowOf — the model's phases, transitions, pairs and gates, and the gates the process requirements add, each with its requirement and source", async () => {
  const model = await teamScrum();
  assert.deepEqual(workflowOf(declarationOf(DECLARATION), model, [], INSTANCE_SPEC), expectedWorkflow(model));
  const unbranched = removed(removed(DECLARATION, 28, "| Development | develop |"), 27, "| Sprint | sprint/<nn> |");
  assert.deepEqual(workflowOf(declarationOf(unbranched), model, [], INSTANCE_SPEC), { ...expectedWorkflow(model), branches: {} });
});

// TST-472453 · level: unit · module: MOD-product-process
// guards: UC-002; THE MODEL DETERMINES THE PHASES AND THE GATES; A PRACTICE IS NOT A MODEL; A PROCESS REQUIREMENT ADDS TO THE MODEL
// given: (a) the fixture product's declaration with the practice devops (line 21), and devops' file of the shipped catalogue, read with modelSchema.practice, as the practices — whether it fits is declarationFindings' question; (b) the declaration with its gate (line 38) named by INTEGRATION IS DOCUMENTED, which the instance's SPEC does not hold
// input: workflowOf of each, with team-scrum and the instance's SPEC
// expect: (a) the workflow of the test above with the practice devops named, and nothing more: no phase, transition, pair or gate of a practice. (b) the same workflow but for the added gate, which stays, named INTEGRATION IS DOCUMENTED and marked with that requirement and the source null — declarationFindings names it
test("workflowOf — nothing else enters the workflow: a declared practice adds nothing, and a gate whose requirement the SPEC does not hold stays without a source", async () => {
  const model = await teamScrum();
  const devopsPath = "src/model-catalogue/practices/devops.md";
  const devops = readDocument(modelSchema.practice, devopsPath, readFileSync(new URL(`../${devopsPath}`, import.meta.url), "utf8"));
  const withPractice = workflowOf(declarationOf(replaced(DECLARATION, 21, PRACTICES_NONE, "- devops")), model, [devops], INSTANCE_SPEC);
  assert.deepEqual(withPractice, { ...expectedWorkflow(model), practices: ["devops"] });

  const row = linesOf(DECLARATION)[37];
  const unheld = replaced(DECLARATION, 38, row, row.replace("UNIT VERIFICATION IS DOCUMENTED", "INTEGRATION IS DOCUMENTED"));
  const expected = expectedWorkflow(model);
  expected.gates[2] = { ...expected.gates[2], name: "INTEGRATION IS DOCUMENTED",
    addedBy: { requirement: "INTEGRATION IS DOCUMENTED", source: null } };
  assert.deepEqual(workflowOf(declarationOf(unheld), model, [], INSTANCE_SPEC), expected);
});

// TST-472454 · level: unit · module: MOD-product-process
// guards: UC-002; THE MODEL DETERMINES THE PHASES AND THE GATES; A PRACTICE IS NOT A MODEL; A PROCESS REQUIREMENT ADDS TO THE MODEL
// given: the known-positive team-scrum model and its process-requirement gate; a declaration selecting evidence-practice; and an accepted practice Document whose ## Adds has model-table-form phases, gates and roles
// input: workflowOf(declaration, team-scrum, [practice], instance SPEC)
// expect: the practice's phase, its produced artifact kind, its role and its gate enter the workflow; the gate is marked with that practice while the existing model and requirement gates retain their own attribution
test("workflowOf — an explicitly tabled practice adds its phase, artifact, role and marked gate beside the model and requirement gates", async () => {
  const model = await teamScrum();
  const practice = readDocument(modelSchema.practice, "docs/practices/evidence-practice.md", `---
name: evidence-practice
fits:
  - team-scrum
---
# Evidence practice

## Adds

### Phases

| Name | Role | Produces |
|---|---|---|
| Evidence review | Evidence keeper | TST |

### Gates

| Between | Artifacts | Condition | Decider |
|---|---|---|---|
| Development → Evidence review | evidence TST | the evidence is reviewed | Product Owner |

### Roles

| Name | Filled by | How many | Capabilities |
|---|---|---|---|
| Evidence keeper | either | several | read the repository |

## What it is

Fixture practice.
`);
  const declaration = declarationOf(replaced(DECLARATION, 21, PRACTICES_NONE, "- evidence-practice"));

  const workflow = workflowOf(declaration, model, [practice], INSTANCE_SPEC);

  assert.deepEqual(workflow.phases.at(-1), { name: "Evidence review", roles: ["Evidence keeper"], produces: ["TST"] });
  assert.deepEqual(workflow.roles.at(-1), {
    name: "Evidence keeper", filledBy: "either", howMany: "several", capabilities: ["read the repository"],
  });
  assert.deepEqual(workflow.gates.at(-1), {
    name: "Development → Evidence review", from: "Development", to: "Evidence review", artifacts: "evidence TST",
    condition: "the evidence is reviewed", decider: "Product Owner", addedBy: null, practice: "evidence-practice",
  });
  assert.equal(workflow.gates[0].practice, null, "the model gate stays attributed to the model");
  assert.deepEqual(workflow.gates[2].addedBy, { requirement: "UNIT VERIFICATION IS DOCUMENTED", source: "SRC-iec-62304, 5.5.5" });
});

// TST-472455 · level: unit · module: MOD-product-process
// guards: UC-002; THE MODEL DETERMINES THE PHASES AND THE GATES; A PRACTICE IS NOT A MODEL
// given: the same selected practice, but its valid ## Adds holds the model's gate table directly, with no extra heading
// input: workflowOf(declaration, team-scrum, [practice], instance SPEC)
// expect: the exact model-schema table still adds its marked gate; prose and unrecognised text stay outside the workflow
test("workflowOf — a valid practice gate table directly under Adds enters the workflow without an invented heading", async () => {
  const model = await teamScrum();
  const practice = readDocument(modelSchema.practice, "src/model-catalogue/practices/bare-gate.md", `---
name: bare-gate
fits:
  - team-scrum
---
# Bare gate

## Adds

| Between | Artifacts | Condition | Decider |
|---|---|---|---|
| Development → Evidence review | evidence TST | evidence is reviewed | Product Owner |

## What it is

Fixture practice.
`);
  assert.deepEqual(documentFindings(modelSchema.practice, practice), [], "known positive: the schema accepts the bare table");
  const declaration = declarationOf(replaced(DECLARATION, 21, PRACTICES_NONE, "- bare-gate"));

  const workflow = workflowOf(declaration, model, [practice], INSTANCE_SPEC);

  assert.deepEqual(workflow.gates.at(-1), {
    name: "Development → Evidence review", from: "Development", to: "Evidence review", artifacts: "evidence TST",
    condition: "evidence is reviewed", decider: "Product Owner", addedBy: null, practice: "bare-gate",
  });
});

// TST-472456 · level: unit · module: MOD-product-process
// guards: UC-002; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES; A PRODUCT DECLARES ITS DEFINITION OF DONE
// given: known positive first — the fixture product's declaration with its ## Definition of Done (line 32) adding the condition `review: 1 by participants other than the implementer`; then the declaration as it stands, whose Definition of Done says that the job rules hold and no condition is added
// input: workflowOf of each, with team-scrum and the instance's SPEC; its `done`
// expect: for the added condition, the five job rules and then that condition; for the declaration that adds none, exactly the five job rules, as the module file states them: CI is green; the job's first commit holds only tests and CI was red on it — for a refactoring job, CI was green on every commit and no test's expected result changed —; every changed code file lies in the folder of one of the job's modules; every new test names a requirement and a module; every gate the workflow places before the merge is recorded
test("workflowOf — the job rules are the Definition of Done when the declaration adds no condition", async () => {
  const model = await teamScrum();
  const sentence = "The job rules hold for every pull request; no condition is added.";
  const review = "review: 1 by participants other than the implementer";
  const added = workflowOf(declarationOf(replaced(DECLARATION, 32, sentence, review)), model, [], INSTANCE_SPEC);
  assert.deepEqual(added.done, [...JOB_RULES, review]);
  assert.deepEqual(workflowOf(declarationOf(DECLARATION), model, [], INSTANCE_SPEC).done, JOB_RULES);
});

 // TST-472457 · level: unit · module: MOD-product-process
 // guards: UC-002; THE MODEL DETERMINES THE PHASES AND THE GATES; A PRACTICE IS NOT A MODEL
 // given: a schema-valid selected practice whose bare ## Adds phase table names a documented artifact kind
 // input: workflowOf(declaration, team-scrum, [practice], instance SPEC)
 // expect: the phase produces the kind TST, without the explanatory parenthesis
 test("workflowOf — a practice phase drops its Produces explanation as the model reader does", async () => {
  const model = await teamScrum();
  const practice = readDocument(modelSchema.practice, "src/model-catalogue/practices/evidence-kind.md", `---
name: evidence-kind
fits:
  - team-scrum
---
# Evidence kind

## Adds

| Name | Role | Produces |
|---|---|---|
| Evidence review | Evidence keeper | TST (evidence from the review) |

## What it is

Fixture practice.
`);
  assert.deepEqual(documentFindings(modelSchema.practice, practice), [], "known positive: the practice document is valid");
  const declaration = declarationOf(replaced(DECLARATION, 21, PRACTICES_NONE, "- evidence-kind"));
  assert.deepEqual(workflowOf(declaration, model, [practice], INSTANCE_SPEC).phases.at(-1), {
    name: "Evidence review", roles: ["Evidence keeper"], produces: ["TST"],
  });
});

 // TST-472458 · level: unit · module: MOD-product-process
 // guards: UC-002; THE MODEL DETERMINES THE PHASES AND THE GATES; A PRACTICE IS NOT A MODEL
 // given: a schema-valid selected practice whose bare ## Adds holds consecutive Phases and Roles model tables
 // input: workflowOf(declaration, team-scrum, [practice], instance SPEC)
 // expect: each contiguous table contributes only to its matching workflow collection
 test("workflowOf — consecutive bare phase and role tables do not cross into each other", async () => {
  const model = await teamScrum();
  const practice = readDocument(modelSchema.practice, "src/model-catalogue/practices/bare-tables.md", `---
name: bare-tables
fits:
  - team-scrum
---
# Bare tables

## Adds

| Name | Role | Produces |
|---|---|---|
| Evidence review | Evidence keeper | TST |

| Name | Filled by | How many | Capabilities |
|---|---|---|---|
| Evidence keeper | either | several | read the repository |

## What it is

Fixture practice.
`);
  assert.deepEqual(documentFindings(modelSchema.practice, practice), [], "known positive: the practice document is valid");
  const declaration = declarationOf(replaced(DECLARATION, 21, PRACTICES_NONE, "- bare-tables"));
  const workflow = workflowOf(declaration, model, [practice], INSTANCE_SPEC);
  assert.deepEqual(workflow.phases.at(-1), { name: "Evidence review", roles: ["Evidence keeper"], produces: ["TST"] });
  assert.equal(workflow.phases.length, model.phases.length + 1, "only the phase table adds a phase");
  assert.deepEqual(workflow.roles.at(-1), {
    name: "Evidence keeper", filledBy: "either", howMany: "several", capabilities: ["read the repository"],
  });
  assert.equal(workflow.roles.length, model.roles.length + 1, "only the role table adds a role");
});
