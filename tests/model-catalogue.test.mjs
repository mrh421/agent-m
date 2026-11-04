// The book's catalogue of process models (ITM-215) — MOD-model-catalogue's interface as the accepted text of
// docs/architecture/MOD-model-catalogue.md states it, for UC-002: Model, Catalogue, catalogue, modelSchema and modelFindings,
// and the shipped catalogue as data.
// Run: node --test tests/model-catalogue.test.mjs
//
// Module: MOD-model-catalogue
// Guards: UC-002; AGENT M CARRIES THE BOOK'S CATALOGUE; THE CATALOGUE IS DATA; THE MODEL DETERMINES THE PHASES AND THE GATES; A GATE NAMES WHAT IT CHECKS; A GATE NAMES WHO DECIDES IT; A PRACTICE IS NOT A MODEL; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; A ROLE NAMES HOW MANY FILL IT; PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
// Level: unit
//
// What ITM-215 builds, and these tests state:
// - catalogue(instance) gives the shipped models — waterfall, V-model and reuse-oriented, whose work is planned (the
//   plan-driven group), Scrum and Kanban, whose work is pulled (the agile group) —, the instance's own models under
//   docs/process-models/, each model with its findings, and the shipped practices — DevOps, prototyping, incremental
//   delivery, the scaling layers — each with the models it fits. A shipped model's path is its path in the instance
//   repository, src/model-catalogue/models/<name>.md, and a model's version is the blob the instance's snapshot names for
//   its path. catalogue reads the instance's files through the snapshot, whose read returns a promise, so it returns one.
// - modelFindings(document) — for a document read with modelSchema.model — names, as an error on the line that causes it,
//   every rule the module file names: a transition naming a phase that is not defined, or a phase no transition reaches
//   from the first phase; a verification pair naming a missing phase; a gate without artifacts, without a condition or
//   without a decider; a role without capabilities, or a phase without a role; a phase producing a word that is no kind
//   of artifact, an explanation in parentheses after it dropped first; a gate that checks a kind of artifact no earlier
//   phase produces; pulled work with neither a time box nor a work-in-progress limit, or with both — a stated Time box of
//   none read as no time box —; a measure that does not fit the kind of work; no declaration of planned or pulled.
// - The module's code names no model and no practice: it finds the shipped ones as data, in the list of shipped files it
//   reads when it is loaded — from the disk in Node, from its own address in a browser (THE CATALOGUE IS DATA).
// - ITM-258: a kind in Produces may be followed by an explanation in parentheses — the kind is what stands before it,
//   Model.produces holds the kinds without their explanations, and a word before the parenthesis that is no kind is
//   still a finding —, and a Time box of none is no time box, flow.timeBox null; this repository's own
//   docs/process-models/scrum-wip.md, as it stands, has no error finding.
//
// Not tested here, since ITM-215 leaves them out: planGrid and modelDiagram. A model's `## About` and Model.about are
// ITM-229's, in tests/model-catalogue-about.test.mjs; here a Model without the section carries about null.
//
// Each test states its input and its expected result before it runs (given / input / expect). A test that expects no
// finding, or no name, first shows the same check finding one on a known positive. Nothing reaches the network. The
// counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { readDocument, documentFindings } from "../src/documents/index.mjs";
import { catalogue, modelSchema, modelFindings } from "../src/model-catalogue/index.mjs";

const MODULE = new URL("../src/model-catalogue/index.mjs", import.meta.url);
const FOLDER = "src/model-catalogue/";
const FOLDER_URL = new URL(`../${FOLDER}`, import.meta.url);

const VALIDATED = "A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED";
const PHASES_AND_GATES = "THE MODEL DETERMINES THE PHASES AND THE GATES";
const PEOPLE_AND_AGENTS = "A PROCESS MODEL ORGANISES PEOPLE AND AGENTS";
const WHAT_IT_CHECKS = "A GATE NAMES WHAT IT CHECKS";
const WHO_DECIDES = "A GATE NAMES WHO DECIDES IT";
const CAPABILITIES = "A ROLE NAMES THE CAPABILITIES IT NEEDS";
const HOW_MANY = "A ROLE NAMES HOW MANY FILL IT";
const MEASURE = "PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE";

// The book's catalogue as the item names it: the models in UC-002's two groups, and the practices.
const PLAN_DRIVEN = ["waterfall", "v-model", "reuse-oriented"];
const AGILE = ["scrum", "kanban"];
const MODELS = [...PLAN_DRIVEN, ...AGILE];
const PRACTICES = ["devops", "prototyping", "incremental-delivery", "scaling-layers"];

const modelPath = (name) => `${FOLDER}models/${name}.md`;
const practicePath = (name) => `${FOLDER}practices/${name}.md`;
const fileText = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// ---------------------------------------------------------------- an instance's snapshot

// A blob for each path of a fixture snapshot: 40 hexadecimal digits, another for every path.
const blobOf = (path) => createHash("sha1").update(path).digest("hex");

// The snapshot of an instance repository holding these files, { path: text }, as MOD-repository-hosts' Snapshot gives it:
// its paths, read(path) -> Promise<string | null>, blob(path) -> string | null.
function snapshotOf(files) {
  const texts = new Map(Object.entries(files));
  return {
    repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" },
    ref: "main",
    commit: "0123456789abcdef0123456789abcdef01234567",
    paths: [...texts.keys()],
    read: async (path) => texts.get(path) ?? null,
    blob: (path) => (texts.has(path) ? blobOf(path) : null),
  };
}

// The files of the shipped catalogue as an instance — a fork of Agent M — holds them: under src/model-catalogue/.
const shippedFiles = () => Object.fromEntries([...MODELS.map(modelPath), ...PRACTICES.map(practicePath)]
  .map((path) => [path, fileText(path)]));

// ---------------------------------------------------------------- a definition of every part

// A complete pulled model, in the format of the module file's Data, with every part: a model adapted from another, a gate
// decided by a role and one decided by a CI check, and flow control by a work-in-progress limit.
const FIXTURE_PATH = "docs/process-models/fixture-pulled.md";
const FIXTURE = [
  "---",                                                                                              // 1
  "name: fixture-pulled",                                                                             // 2
  "kind: pulled",                                                                                     // 3
  "adapted_from: fixture-base",                                                                       // 4
  "measure: items per state over time",                                                               // 5
  "---",                                                                                              // 6
  "# A pulled fixture model",                                                                         // 7
  "",                                                                                                 // 8
  "Free text may stand between the title and the first section.",                                     // 9
  "",                                                                                                 // 10
  "## Phases",                                                                                        // 11
  "",                                                                                                 // 12
  "| Name | Role | Produces |",                                                                       // 13
  "|---|---|---|",                                                                                    // 14
  "| Planning | Owner | ITM |",                                                                       // 15
  "| Building | Builders | MOD, TST |",                                                              // 16
  "| Checking | Checker | TST |",                                                                    // 17
  "| Closing | Owner | sprint record |",                                                              // 18
  "",                                                                                                 // 19
  "## Transitions",                                                                                   // 20
  "",                                                                                                 // 21
  "| From | To | Kind |",                                                                             // 22
  "|---|---|---|",                                                                                    // 23
  "| Planning | Building | sequence |",                                                              // 24
  "| Building | Checking | sequence |",                                                              // 25
  "| Checking | Building | back |",                                                                  // 26
  "| Checking | Closing | sequence |",                                                               // 27
  "| Closing | Planning | back |",                                                                   // 28
  "",                                                                                                 // 29
  "## Verification pairs",                                                                            // 30
  "",                                                                                                 // 31
  "| Phase | Checked by |",                                                                           // 32
  "|---|---|",                                                                                        // 33
  "| Building | Checking |",                                                                         // 34
  "",                                                                                                 // 35
  "## Gates",                                                                                         // 36
  "",                                                                                                 // 37
  "| Between | Artifacts | Condition | Decider |",                                                   // 38
  "|---|---|---|---|",                                                                                // 39
  "| Building → Checking | the item's pull request, with its MOD and TST | CI is green on it | Owner |", // 40
  "| Checking → Closing | the release tests, TST | green on the branch | check: release-tests |",    // 41
  "",                                                                                                 // 42
  "## Roles",                                                                                         // 43
  "",                                                                                                 // 44
  "| Name | Filled by | How many | Capabilities |",                                                   // 45
  "|---|---|---|---|",                                                                                // 46
  "| Owner | person | one | read the repository, write to the repository |",                          // 47
  "| Builders | agent | several | read the repository, write to the repository, run code and tests |", // 48
  "| Checker | either | several | read the repository, run code and tests |",                         // 49
  "",                                                                                                 // 50
  "## Flow control",                                                                                  // 51
  "",                                                                                                 // 52
  "| Kind | Value |",                                                                                 // 53
  "|---|---|",                                                                                        // 54
  "| WIP limit | 3 |",                                                                                // 55
  "| Time box | — |",                                                                                // 56
  "| Sprints | yes |",                                                                                // 57
  "",
].join("\n");

// FIXTURE as catalogue gives it, read from FIXTURE_PATH of an instance's snapshot.
const FIXTURE_MODEL = {
  name: "fixture-pulled",
  kind: "pulled",
  adaptedFrom: "fixture-base",
  measure: "items per state over time",
  about: null,
  phases: [
    { name: "Planning", roles: ["Owner"], produces: ["ITM"] },
    { name: "Building", roles: ["Builders"], produces: ["MOD", "TST"] },
    { name: "Checking", roles: ["Checker"], produces: ["TST"] },
    { name: "Closing", roles: ["Owner"], produces: ["sprint record"] },
  ],
  transitions: [
    { from: "Planning", to: "Building", kind: "sequence" },
    { from: "Building", to: "Checking", kind: "sequence" },
    { from: "Checking", to: "Building", kind: "back" },
    { from: "Checking", to: "Closing", kind: "sequence" },
    { from: "Closing", to: "Planning", kind: "back" },
  ],
  pairs: [{ phase: "Building", checkedBy: "Checking" }],
  gates: [
    { from: "Building", to: "Checking", artifacts: "the item's pull request, with its MOD and TST", condition: "CI is green on it",
      decider: "Owner" },
    { from: "Checking", to: "Closing", artifacts: "the release tests, TST", condition: "green on the branch",
      decider: "check: release-tests" },
  ],
  roles: [
    { name: "Owner", filledBy: "person", howMany: "one", capabilities: ["read the repository", "write to the repository"] },
    { name: "Builders", filledBy: "agent", howMany: "several", capabilities: ["read the repository", "write to the repository",
      "run code and tests"] },
    { name: "Checker", filledBy: "either", howMany: "several", capabilities: ["read the repository", "run code and tests"] },
  ],
  flow: { wip: 3, timeBox: null, sprints: true },
  version: blobOf(FIXTURE_PATH),
  path: FIXTURE_PATH,
};

// The lines of a text; a text from its lines.
const linesOf = (text) => text.split("\n");
const fromLines = (lines) => lines.join("\n");

// FIXTURE with its line `number` replaced by `line`, inserted after it, or removed; the line it names must be the one
// expected, so that each change is the one the test says.
function replaced(number, expected, line) {
  const lines = linesOf(FIXTURE);
  assert.equal(lines[number - 1], expected, `line ${number} of FIXTURE`);
  lines.splice(number - 1, 1, line);
  return fromLines(lines);
}
function inserted(after, expected, line) {
  const lines = linesOf(FIXTURE);
  assert.equal(lines[after - 1], expected, `line ${after} of FIXTURE`);
  lines.splice(after, 0, line);
  return fromLines(lines);
}
function removed(number, expected) {
  const lines = linesOf(FIXTURE);
  assert.equal(lines[number - 1], expected, `line ${number} of FIXTURE`);
  lines.splice(number - 1, 1);
  return fromLines(lines);
}

// The findings of a definition read with the model's schema, as [line, kind, rule], and the artifact each names.
function findingsOf(text, path = FIXTURE_PATH) {
  const found = modelFindings(readDocument(modelSchema.model, path, text));
  for (const f of found) assert.equal(f.artifact, path, "a finding names the file of the model, which has no identifier");
  return found.map((f) => [f.line, f.kind, f.rule]);
}

// ---------------------------------------------------------------- catalogue

// TST-472404 · level: unit · module: MOD-model-catalogue
// guards: UC-002; AGENT M CARRIES THE BOOK'S CATALOGUE; A PRACTICE IS NOT A MODEL
// given: the snapshot of an instance that holds no model of its own: its files are the shipped catalogue's, under src/model-catalogue/, each with a blob of its own
// input: await catalogue(snapshot)
// expect: models — in this order — waterfall, v-model and reuse-oriented, each of kind planned (the plan-driven group), then scrum and kanban, each of kind pulled (the agile group); each with its path src/model-catalogue/models/ <name>.md and as its version the blob the snapshot names for that path. practices — devops and scaling-layers, which fit scrum and kanban; prototyping and incremental-delivery, which fit all five models —, each with its path src/model-catalogue/practices/<name>.md. findings: for the path of each model, none. And the folders models/ and practices/ hold exactly the files of these models and practices: no file is shipped that the catalogue leaves out.
test("catalogue — the shipped catalogue holds exactly the book's five models in their two groups, and its four practices", async () => {
  const snapshot = snapshotOf(shippedFiles());
  const got = await catalogue(snapshot);
  assert.deepEqual(got.models.map((m) => [m.name, m.kind, m.path, m.version]), [
    ...PLAN_DRIVEN.map((name) => [name, "planned", modelPath(name), blobOf(modelPath(name))]),
    ...AGILE.map((name) => [name, "pulled", modelPath(name), blobOf(modelPath(name))]),
  ]);
  assert.deepEqual(got.practices, [
    { name: "devops", fits: AGILE, path: practicePath("devops") },
    { name: "prototyping", fits: MODELS, path: practicePath("prototyping") },
    { name: "incremental-delivery", fits: MODELS, path: practicePath("incremental-delivery") },
    { name: "scaling-layers", fits: AGILE, path: practicePath("scaling-layers") },
  ]);
  assert.deepEqual(got.findings, Object.fromEntries(MODELS.map((name) => [modelPath(name), []])));
  assert.deepEqual(readdirSync(new URL("models/", FOLDER_URL)).sort(), MODELS.map((name) => `${name}.md`).sort());
  assert.deepEqual(readdirSync(new URL("practices/", FOLDER_URL)).sort(), PRACTICES.map((name) => `${name}.md`).sort());
});

// TST-472405 · level: unit · module: MOD-model-catalogue
// guards: UC-002; THE MODEL DETERMINES THE PHASES AND THE GATES; A PROCESS MODEL ORGANISES PEOPLE AND AGENTS
// given: the snapshot of the test above, which also holds FIXTURE at docs/process-models/fixture-pulled.md — an instance's own model — and once more with FIXTURE's role Checker left without capabilities (line 49)
// input: await catalogue(snapshot) of each
// expect: (a) the five shipped models, then FIXTURE as the Model FIXTURE_MODEL — its name, kind, the model it was adapted from and its measure; about null, since it has no ## About; its phases, transitions, verification pairs, gates — each gate with the phases it stands between, `check: release-tests` as the decider of the second —, roles with their capabilities; its flow control with the limit 3, no time box and sprints; as its version the blob the snapshot names for its path, and its path —, with no finding. (b) FIXTURE still listed, with its one finding: an error on line 49 naming A ROLE NAMES THE CAPABILITIES IT NEEDS
test("catalogue — an instance's own model is read as a Model, listed after the shipped ones, with its findings", async () => {
  const got = await catalogue(snapshotOf({ ...shippedFiles(), [FIXTURE_PATH]: FIXTURE }));
  assert.deepEqual(got.models.map((m) => m.name), [...MODELS, "fixture-pulled"]);
  assert.deepEqual(got.models.at(-1), FIXTURE_MODEL);
  assert.deepEqual(got.findings[FIXTURE_PATH], []);

  const broken = replaced(49, "| Checker | either | several | read the repository, run code and tests |", "| Checker | either | several | — |");
  const withFinding = await catalogue(snapshotOf({ ...shippedFiles(), [FIXTURE_PATH]: broken }));
  assert.deepEqual(withFinding.models.map((m) => m.name), [...MODELS, "fixture-pulled"]);
  assert.deepEqual(withFinding.findings[FIXTURE_PATH].map((f) => [f.line, f.kind, f.rule]), [[49, "error", CAPABILITIES]]);
});

// ---------------------------------------------------------------- modelFindings: the shipped catalogue

// TST-472406 · level: unit · module: MOD-model-catalogue
// guards: AGENT M CARRIES THE BOOK'S CATALOGUE; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; A PRACTICE IS NOT A MODEL
// given: each file of src/model-catalogue/models/, read with modelSchema.model; each file of src/model-catalogue/ practices/, read with modelSchema.practice — each through MOD-documents' readDocument, at its path in the instance
// input: modelFindings(model); documentFindings(modelSchema.practice, practice)
// expect: known positive first — the shipped scrum model with its line `kind: pulled` removed has an error naming A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; then no finding for any shipped model, and none for any shipped practice; and each file names the chapter of the book it follows — 6, 7 or 14
test("modelFindings — every shipped model passes without an error, and every shipped practice fits its schema", () => {
  const scrum = fileText(modelPath("scrum"));
  assert.ok(scrum.includes("\nkind: pulled\n"), "the shipped scrum model declares pulled work");
  const undeclared = findingsOf(scrum.replace("\nkind: pulled\n", "\n"), modelPath("scrum"));
  assert.ok(undeclared.some(([, kind, rule]) => kind === "error" && rule === VALIDATED), "known positive: an error is found");

  for (const name of MODELS) {
    const path = modelPath(name);
    assert.deepEqual(findingsOf(fileText(path), path), [], path);
    assert.match(fileText(path), /chapter (?:6|7|14)\b/, `${path} names the chapter it follows`);
  }
  for (const name of PRACTICES) {
    const path = practicePath(name);
    assert.deepEqual(documentFindings(modelSchema.practice, readDocument(modelSchema.practice, path, fileText(path))), [], path);
    assert.match(fileText(path), /chapter (?:6|7|14)\b/, `${path} names the chapter it follows`);
  }
});

// ---------------------------------------------------------------- modelFindings: one definition per rule

// TST-472407 · level: unit · module: MOD-model-catalogue
// guards: A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; A GATE NAMES WHO DECIDES IT
// given: FIXTURE as it stands — every part complete; one gate decided by a role, one by a CI check
// input: modelFindings of FIXTURE read with modelSchema.model
// expect: no finding: the known positive of every test below, each of which changes one line of FIXTURE
test("modelFindings — a complete definition, with a gate decided by a role and one decided by a CI check, has no finding", () => {
  assert.deepEqual(findingsOf(FIXTURE), []);
});

// TST-476001 · level: unit · module: MOD-model-catalogue
// guards: THE MODEL DETERMINES THE PHASES AND THE GATES; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with its transition `| Checking | Building | back |` (line 26) going to Hotfix, which is no phase
// input: modelFindings of the changed text read with modelSchema.model
// expect: one error, on line 26, naming THE MODEL DETERMINES THE PHASES AND THE GATES
test("modelFindings — a transition naming a phase that is not defined is an error", () => {
  const text = replaced(26, "| Checking | Building | back |", "| Checking | Hotfix | back |");
  assert.deepEqual(findingsOf(text), [[26, "error", PHASES_AND_GATES]]);
});

// TST-476002 · level: unit · module: MOD-model-catalogue
// guards: THE MODEL DETERMINES THE PHASES AND THE GATES; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with one more phase, `| Refinement | Owner | ITM |`, inserted after line 18 — as line 19 —, to which no transition leads
// input: modelFindings of the changed text
// expect: one error, on line 19, naming THE MODEL DETERMINES THE PHASES AND THE GATES
test("modelFindings — a phase that no transition reaches from the first phase is an error", () => {
  const text = inserted(18, "| Closing | Owner | sprint record |", "| Refinement | Owner | ITM |");
  assert.deepEqual(findingsOf(text), [[19, "error", PHASES_AND_GATES]]);
});

// TST-476003 · level: unit · module: MOD-model-catalogue
// guards: THE MODEL DETERMINES THE PHASES AND THE GATES; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with its verification pair (line 34) checked by Acceptance, which is no phase
// input: modelFindings of the changed text
// expect: one error, on line 34, naming THE MODEL DETERMINES THE PHASES AND THE GATES
test("modelFindings — a verification pair naming a missing phase is an error", () => {
  const text = replaced(34, "| Building | Checking |", "| Building | Acceptance |");
  assert.deepEqual(findingsOf(text), [[34, "error", PHASES_AND_GATES]]);
});

const GATE = "| Building → Checking | the item's pull request, with its MOD and TST | CI is green on it | Owner |";

// TST-476004 · level: unit · module: MOD-model-catalogue
// guards: A GATE NAMES WHAT IT CHECKS; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with the artifacts of its first gate (line 40) left out
// input: modelFindings of the changed text
// expect: one error, on line 40, naming A GATE NAMES WHAT IT CHECKS
test("modelFindings — a gate without artifacts is an error", () => {
  const text = replaced(40, GATE, "| Building → Checking | — | CI is green on it | Owner |");
  assert.deepEqual(findingsOf(text), [[40, "error", WHAT_IT_CHECKS]]);
});

// TST-476005 · level: unit · module: MOD-model-catalogue
// guards: A GATE NAMES WHAT IT CHECKS; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with the condition of its first gate (line 40) left out
// input: modelFindings of the changed text
// expect: one error, on line 40, naming A GATE NAMES WHAT IT CHECKS
test("modelFindings — a gate without a condition is an error", () => {
  const text = replaced(40, GATE, "| Building → Checking | the item's pull request, with its MOD and TST | — | Owner |");
  assert.deepEqual(findingsOf(text), [[40, "error", WHAT_IT_CHECKS]]);
});

// TST-476006 · level: unit · module: MOD-model-catalogue
// guards: A GATE NAMES WHO DECIDES IT; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with the decider of its first gate (line 40) left out; and once more with it `Release manager`, which is neither a role of the model nor a check `check: <CI check name>`
// input: modelFindings of each changed text
// expect: for each, one error, on line 40, naming A GATE NAMES WHO DECIDES IT
test("modelFindings — a gate without a decider is an error: none named, or one that is no role of the model and no check", () => {
  const without = replaced(40, GATE, "| Building → Checking | the item's pull request, with its MOD and TST | CI is green on it | — |");
  assert.deepEqual(findingsOf(without), [[40, "error", WHO_DECIDES]]);
  const unknown = replaced(40, GATE, GATE.replace("| Owner |", "| Release manager |"));
  assert.deepEqual(findingsOf(unknown), [[40, "error", WHO_DECIDES]]);
});

// TST-476007 · level: unit · module: MOD-model-catalogue
// guards: A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with the capabilities of its role Checker (line 49) left out
// input: modelFindings of the changed text
// expect: one error, on line 49, naming A ROLE NAMES THE CAPABILITIES IT NEEDS
test("modelFindings — a role without capabilities is an error", () => {
  const text = replaced(49, "| Checker | either | several | read the repository, run code and tests |", "| Checker | either | several | — |");
  assert.deepEqual(findingsOf(text), [[49, "error", CAPABILITIES]]);
});

// TST-476008 · level: unit · module: MOD-model-catalogue
// guards: A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with the role of its phase Checking (line 17) left out; and once more with it Inspector, which the model's roles do not define
// input: modelFindings of each changed text
// expect: for each, one error, on line 17, naming A PROCESS MODEL ORGANISES PEOPLE AND AGENTS
test("modelFindings — a phase without a role is an error: none named, or one the model does not define", () => {
  const without = replaced(17, "| Checking | Checker | TST |", "| Checking | — | TST |");
  assert.deepEqual(findingsOf(without), [[17, "error", PEOPLE_AND_AGENTS]]);
  const undefinedRole = replaced(17, "| Checking | Checker | TST |", "| Checking | Inspector | TST |");
  assert.deepEqual(findingsOf(undefinedRole), [[17, "error", PEOPLE_AND_AGENTS]]);
});

// TST-476009 · level: unit · module: MOD-model-catalogue
// guards: A ROLE NAMES HOW MANY FILL IT; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with the How many of its role Checker (line 49) left out; and once more with it "many"
// input: modelFindings of each changed text
// expect: for each, one error, on line 49, naming A ROLE NAMES HOW MANY FILL IT
test("modelFindings — a role that does not say whether one participant fills it or several may is an error", () => {
  const row = "| Checker | either | several | read the repository, run code and tests |";
  const without = replaced(49, row, "| Checker | either | — | read the repository, run code and tests |");
  assert.deepEqual(findingsOf(without), [[49, "error", HOW_MANY]]);
  const other = replaced(49, row, "| Checker | either | many | read the repository, run code and tests |");
  assert.deepEqual(findingsOf(other), [[49, "error", HOW_MANY]]);
});

// TST-476010 · level: unit · module: MOD-model-catalogue
// guards: A PROCESS MODEL ORGANISES PEOPLE AND AGENTS; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with its phase Checking (line 17) done by Checker and Owner; once more by Checker and Inspector, which the model's roles do not define
// input: modelFindings of each changed text; catalogue of a snapshot holding the first one
// expect: the first without a finding, and read by catalogue with both roles in the order they stand; the second with one error, on line 17, naming A PROCESS MODEL ORGANISES PEOPLE AND AGENTS
test("modelFindings and catalogue — a phase names one role or several, each a role of the model", async () => {
  const both = replaced(17, "| Checking | Checker | TST |", "| Checking | Checker, Owner | TST |");
  assert.deepEqual(findingsOf(both), []);
  const read = await catalogue(snapshotOf({ ...shippedFiles(), [FIXTURE_PATH]: both }));
  assert.deepEqual(read.models.at(-1).phases.find((phase) => phase.name === "Checking").roles, ["Checker", "Owner"]);
  const unknown = replaced(17, "| Checking | Checker | TST |", "| Checking | Checker, Inspector | TST |");
  assert.deepEqual(findingsOf(unknown), [[17, "error", PEOPLE_AND_AGENTS]]);
});

// TST-476011 · level: unit · module: MOD-model-catalogue
// guards: A GATE NAMES WHAT IT CHECKS; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with its first gate (line 40), between Building and Checking, also checking UC, which neither Building nor Planning, the phase before it, produces
// input: modelFindings of the changed text
// expect: one error, on line 40, naming A GATE NAMES WHAT IT CHECKS
test("modelFindings — a gate that checks a kind of artifact no earlier phase produces is an error", () => {
  const text = replaced(40, GATE, GATE.replace("with its MOD and TST", "with its MOD, TST and UC"));
  assert.deepEqual(findingsOf(text), [[40, "error", WHAT_IT_CHECKS]]);
});

// TST-476012 · level: unit · module: MOD-model-catalogue
// guards: UC-002; THE MODEL DETERMINES THE PHASES AND THE GATES; A GATE NAMES WHAT IT CHECKS
// given: FIXTURE with Building's Produces (line 16) "MOD (code of the item's modules), TST" — a kind of artifact followed by an explanation in parentheses, beside a bare one
// input: modelFindings of the changed text; catalogue of a snapshot holding it
// expect: no finding — the first gate (line 40), which checks MOD and TST produced up to Building, still finds both —, and catalogue reads Building's produces as ["MOD", "TST"], its phases otherwise FIXTURE_MODEL's
test("modelFindings and catalogue — a kind in Produces may be followed by an explanation in parentheses: the kind is what stands before it, and a gate that checks it finds it produced", async () => {
  const text = replaced(16, "| Building | Builders | MOD, TST |", "| Building | Builders | MOD (code of the item's modules), TST |");
  assert.deepEqual(findingsOf(text), []);
  const got = await catalogue(snapshotOf({ ...shippedFiles(), [FIXTURE_PATH]: text }));
  assert.deepEqual(got.models.at(-1).phases, FIXTURE_MODEL.phases);
});

// TST-476013 · level: unit · module: MOD-model-catalogue
// guards: THE MODEL DETERMINES THE PHASES AND THE GATES; A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with Planning's Produces (line 15) "Backlog (the sprint's selection of backlog items)" — a word before the parenthesis that is no kind of artifact
// input: modelFindings of the changed text
// expect: one error, on line 15, naming THE MODEL DETERMINES THE PHASES AND THE GATES
test("modelFindings — a word before the parenthesis that is no kind of artifact is still a finding", () => {
  const text = replaced(15, "| Planning | Owner | ITM |", "| Planning | Owner | Backlog (the sprint's selection of backlog items) |");
  assert.deepEqual(findingsOf(text), [[15, "error", PHASES_AND_GATES]]);
});

// TST-476014 · level: unit · module: MOD-model-catalogue
// guards: A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE, whose work is pulled, with its WIP limit (line 55) left out, so that it names neither a time box nor a work-in-progress limit; and once more with a time box of 2 weeks (line 56) beside its limit of 3
// input: modelFindings of each changed text
// expect: for each, one error, on the heading of ## Flow control (line 51), naming A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
test("modelFindings — pulled work with neither a time box nor a work-in-progress limit, or with both, is an error", () => {
  const neither = replaced(55, "| WIP limit | 3 |", "| WIP limit | — |");
  assert.deepEqual(findingsOf(neither), [[51, "error", VALIDATED]]);
  const both = replaced(56, "| Time box | — |", "| Time box | 2 weeks |");
  assert.deepEqual(findingsOf(both), [[51, "error", VALIDATED]]);
});

// TST-476015 · level: unit · module: MOD-model-catalogue
// guards: A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE, whose work is pulled with a WIP limit of 3 (line 55) unchanged, with its Time box (line 56) stated as none instead of — (left out)
// input: modelFindings of the changed text; catalogue of a snapshot holding it
// expect: no finding — a Time box of none is no time box, the same as — —, and catalogue reads flow.timeBox null, as for FIXTURE_MODEL.flow
test("modelFindings and catalogue — a Time box of none is no time box: pulled work with a WIP limit and a Time box of none has no finding of both", async () => {
  const text = replaced(56, "| Time box | — |", "| Time box | none |");
  assert.deepEqual(findingsOf(text), []);
  const got = await catalogue(snapshotOf({ ...shippedFiles(), [FIXTURE_PATH]: text }));
  assert.deepEqual(got.models.at(-1).flow, FIXTURE_MODEL.flow);
});

// TST-476016 · level: unit · module: MOD-model-catalogue
// guards: A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE, whose work is pulled, with the measure `plan entries per phase` (line 5), the measure of planned work
// input: modelFindings of the changed text
// expect: one error, on line 5, naming PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
test("modelFindings — a measure that does not fit the kind of work is an error", () => {
  const text = replaced(5, "measure: items per state over time", "measure: plan entries per phase");
  assert.deepEqual(findingsOf(text), [[5, "error", MEASURE]]);
});

// TST-1373001 · level: unit · module: MOD-model-catalogue
// guards: A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE
// given: FIXTURE, whose work is pulled under a WIP limit of 3 and names no time box, with the measure `remaining items per time box` (line 5); the shipped kanban model, which names no time box, with the same measure on its line 4; and, as the counter-proof, FIXTURE with that measure and a time box of 2 weeks (line 56) in place of its WIP limit (line 55)
// input: modelFindings of each changed text
// expect: FIXTURE one error, on line 5, and kanban one error, on line 4, each naming PROGRESS IS SHOWN IN THE MODEL'S OWN MEASURE — a measure per time box does not fit work without a time box —; the counter-proof no finding
test("modelFindings — the measure remaining items per time box in pulled work that names no time box is an error", () => {
  const perTimeBox = replaced(5, "measure: items per state over time", "measure: remaining items per time box");
  assert.deepEqual(findingsOf(perTimeBox), [[5, "error", MEASURE]]);

  const kanban = fileText(modelPath("kanban"));
  assert.ok(kanban.includes("\nmeasure: items per state over time\n"), "the shipped kanban model measures items per state");
  const kanbanPerTimeBox = kanban.replace("\nmeasure: items per state over time\n", "\nmeasure: remaining items per time box\n");
  assert.deepEqual(findingsOf(kanbanPerTimeBox, modelPath("kanban")), [[4, "error", MEASURE]]);

  const timeBoxed = fromLines(linesOf(perTimeBox).map((line, at) =>
    (at === 54 ? "| WIP limit | — |" : at === 55 ? "| Time box | 2 weeks |" : line)));
  assert.equal(linesOf(perTimeBox)[54], "| WIP limit | 3 |", "line 55 of FIXTURE");
  assert.equal(linesOf(perTimeBox)[55], "| Time box | — |", "line 56 of FIXTURE");
  assert.deepEqual(findingsOf(timeBoxed), [], "counter-proof: with a time box, the measure per time box fits");
});

// TST-476017 · level: unit · module: MOD-model-catalogue
// guards: A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
// given: FIXTURE with its line `kind: pulled` (line 3) removed: the model declares neither planned nor pulled work
// input: modelFindings of the changed text
// expect: one error, on line 1 — a key that is missing stands on no line —, naming A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED
test("modelFindings — no declaration of planned or pulled work is an error", () => {
  const text = removed(3, "kind: pulled");
  assert.deepEqual(findingsOf(text), [[1, "error", VALIDATED]]);
});

// ---------------------------------------------------------------- modelFindings: this repository's own model

// TST-476018 · level: unit · module: MOD-model-catalogue
// guards: A MODEL DEFINITION IS VALIDATED BEFORE IT IS USED; UC-002
// given: this repository's own docs/process-models/scrum-wip.md, as it stands on origin/main — a kind in Produces followed by an explanation in parentheses on five rows, and a Time box of none beside a WIP limit of 4
// input: modelFindings of the file's text, read with its path
// expect: no error finding: the explanation is dropped before a kind is checked and before a gate's check of what is produced, and the stated Time box of none is no time box
test("modelFindings — this repository's own docs/process-models/scrum-wip.md, as it stands, has no error finding", () => {
  const path = "docs/process-models/scrum-wip.md";
  assert.deepEqual(findingsOf(fileText(path), path), []);
});

// ---------------------------------------------------------------- THE CATALOGUE IS DATA

// A name as a whole word, ignoring case, with its hyphens also written as blanks: `v-model`, `V model`.
const wordOf = (name) => new RegExp(`(?<![A-Za-z0-9])${name.replace(/-/g, "[- ]")}(?![A-Za-z0-9])`, "i");

// TST-472408 · level: unit · module: MOD-model-catalogue
// guards: THE CATALOGUE IS DATA
// given: the name of each shipped model and practice; the text of every code file (*.mjs) of src/model-catalogue/
// input: each name searched as a whole word, ignoring case, with its hyphens also as blanks
// expect: known positive first — each name is found in the shipped file that defines it, and in a copy of index.mjs's text with the name planted in a comment; then no name in any code file of the module
test("THE CATALOGUE IS DATA — no name of a shipped model or practice stands in the module's code", () => {
  const code = readdirSync(FOLDER_URL, { recursive: true }).filter((file) => String(file).endsWith(".mjs")).map(String);
  assert.ok(code.includes("index.mjs"), "the module's code is there to be searched");
  const index = readFileSync(MODULE, "utf8");
  const found = [];
  for (const [name, path] of [...MODELS.map((n) => [n, modelPath(n)]), ...PRACTICES.map((n) => [n, practicePath(n)])]) {
    assert.match(fileText(path), wordOf(name), `known positive: ${name} is found in ${path}`);
    assert.match(`${index}\n// ${name.replace(/-/g, " ")}\n`, wordOf(name), `known positive: ${name} is found when planted`);
    for (const file of code) if (wordOf(name).test(readFileSync(new URL(file, FOLDER_URL), "utf8"))) found.push(`${file}: ${name}`);
  }
  assert.deepEqual(found, []);
});

// One load of the module, anew: `disk` gives what process.getBuiltinModule("node:fs") gives it — undefined, as in a browser
// —, `fetch` the browser's fetch. -> { module, error, reads } — the module's namespace, or the error its load failed with;
// and every read of the load, as "disk <address>" or "fetch <address>". The module is loaded from its own address with a
// query of its own, `index.mjs?load=<n>`, and both are put back — as tests/source-register.test.mjs loads its module.
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

// TST-472409 · level: unit · module: MOD-model-catalogue
// guards: THE CATALOGUE IS DATA; AGENT M CARRIES THE BOOK'S CATALOGUE
// given: the module loaded anew twice — as in Node, from a disk, and as in a browser, without a disk, whose fetch answers the module's own addresses —, each serving the module's real files except two: its list of shipped files, src/model-catalogue/shipped.md, names one more model file, `models/fixture-pulled.md`, and that file is FIXTURE
// input: await catalogue(snapshot) of each load, the snapshot holding the shipped catalogue's files
// expect: for each load, its reads — from the disk in Node, with fetch in a browser — are exactly the module's two schemas, its list of shipped files and each file the list names, every one at its own address in src/model-catalogue/, each once; and the catalogue holds the five shipped models and then fixture-pulled, read from src/model-catalogue/models/fixture-pulled.md, with no finding: a model is added by its file and its line in the list, and the code that finds it is the same
test("THE CATALOGUE IS DATA — the shipped models and practices are found in the module's list of its files, read from the disk in Node and from its own address in a browser", async () => {
  const at = (file) => new URL(file, FOLDER_URL);
  const list = at("shipped.md");
  const extra = at("models/fixture-pulled.md");
  const served = (url) => (String(url) === list.href ? `${readFileSync(list, "utf8")}- \`models/fixture-pulled.md\`\n`
    : String(url) === extra.href ? FIXTURE : readFileSync(url, "utf8"));
  const files = ["model.schema.md", "practice.schema.md", "shipped.md", ...MODELS.map((n) => `models/${n}.md`),
    ...PRACTICES.map((n) => `practices/${n}.md`), "models/fixture-pulled.md"];

  const inNode = await load({ disk: (reads) => ({ readFileSync: (url, encoding) => {
    assert.equal(encoding, "utf8");
    reads.push(`disk ${url}`);
    return served(url);
  } }) });
  const inBrowser = await load({ disk: undefined, fetch: async (url) => new Response(served(url), { status: 200 }) });

  const snapshot = snapshotOf(shippedFiles());
  for (const [where, loaded, read] of [["Node", inNode, "disk"], ["browser", inBrowser, "fetch"]]) {
    assert.equal(loaded.error, null, `${where}: the module loads: ${loaded.error?.message}`);
    assert.deepEqual([...loaded.reads].sort(), files.map((file) => `${read} ${at(file).href}`).sort(), where);
    const got = await loaded.module.catalogue(snapshot);
    assert.deepEqual(got.models.map((m) => m.name), [...MODELS, "fixture-pulled"], where);
    assert.equal(got.models.at(-1).path, `${FOLDER}models/fixture-pulled.md`, where);
    assert.deepEqual(got.findings[`${FOLDER}models/fixture-pulled.md`], [], where);
  }
});
