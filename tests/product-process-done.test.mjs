// The Definition of Done of a pull request (ITM-409) — MOD-product-process' doneCheck, as the accepted text of docs/architecture/MOD-product-process.md states it: "doneCheck(facts, workflow, modules,
// gates, job: { kind: "implement" | "refactor" | "fix-bug", modules }) -> Finding[] — every condition of the product's Definition of Done the pull request does not meet, as findings; empty when it
// holds. `facts` are the pull request's commits in order with their changed files and CI results, and the texts of changed files on both sides; `gates` the product's gate records." The job rules are
// the workflow's `done`: CI is green; the first commit holds only tests and CI was red on it — for a refactoring job, CI was green on every commit and no test's expected result changed; every
// changed code file lies in the folder of one of the job's modules; every new test names a requirement and a module; every gate the workflow places before the merge is recorded; and the conditions
// the declaration adds (`review: <n> by participants other than the implementer`, `check: <CI check name>`, `gate: <gate>`). For UC-034 and A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS.
// Run: node --test tests/product-process-done.test.mjs
//
// Module: MOD-product-process
// Guards: UC-034; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES; AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST; A REFACTORING JOB BEGINS WITHOUT A FAILING TEST
// Guards: A REFACTORING JOB CHANGES NO EXPECTED RESULT; AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES; THE GATE IS RECORDED
// Level: unit
//
// The pull request is UC-034's own example: a job for one item, whose first commit holds the failing tests (CI red on it) and whose second implements in the folder of the item's module until CI is green,
// with the gate Development → Sprint Review recorded by the Product Owner; its facts are the shape MOD-repository-hosts' pullRequestFacts gives, controlled here. The workflow is workflowOf's over the
// fixture product of tests/product-process-role-assignments.test.mjs, the gate records documents read with gateSchema, the modules the module files of docs/architecture read with their schema. Where the
// texts leave a reading open, the test states the one it takes, and the pull request names it:
//   - doneCheck reads the texts of changed files with facts.read, which is asynchronous: it returns a Promise of the findings.
//   - A finding is MOD-text-tools' finding on the artifact `pull request #<n>` (a file's path where one file is at fault), line 1, kind error, with the requirement the rule guards: CODE ENTERS THE DEFAULT
//     BRANCH THROUGH A PULL REQUEST WITH GREEN CI, AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST, A REFACTORING JOB BEGINS WITHOUT A FAILING TEST, A REFACTORING JOB CHANGES NO EXPECTED RESULT, AN
//     IMPLEMENTATION JOB CHANGES ONLY ITS MODULES, EVERY ARTIFACT NAMES ITS ORIGIN (a new test), THE GATE IS RECORDED, and A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS (an added condition).
//   - CI is green when the head commit's ci is `success` and no check of the head is failing, cancelled, timed out, queued or running.
//   - A job of kind `implement` or `fix-bug` begins with a failing test: its first commit changes only test files (isTestFile) and its ci is `failure`. A `refactor` job: every commit's ci is `success`,
//     and no test's expected result changed: of each test file the pull request modifies, no assertion line of the base text is missing from the head text, and no declared `expect` of a test case
//     (MOD-test-document) differs; assertions added are no change of a result.
//   - A code file is a changed file that is no test file and has the extension .mjs, .js, .py, .ts, .css or .html; it lies in a module's folder when its path starts with the `folder` of one of the job's modules
//     (`modules` are the module files, the job names them by `id`).
//   - A new test is a test case of a test file the pull request adds, or a declaration of a modified one that the base text lacks; it names a requirement and a module when its declaration has `guards` and `module`.
//     An added test file without any declaration is one finding.
//   - Gates before the merge: the workflow's gates that leave a phase at or before the phase that produces MOD (the job's phase), reached along the transitions that are not `back`. Each must be `passed` by
//     gateStates, over the blobs of the head texts of the artifacts its record names.
//   - A declared `check: <name>` holds when the head has that check with state success; `gate: <gate>` when gateStates says that gate `passed`; `review: <n> ...` when n distinct reviewers have an `approved`
//     review. That the reviewers are other than the implementer is not in the facts; it is not checked, and the pull request says so. (The declaration's reader keeps only lines of these three forms, so no other condition reaches the workflow.)
// A name the module does not provide yet fails each test by itself. The counter-proofs are in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { artifactSchemaOf, readDocument } from "../src/documents/index.mjs";
import { catalogue } from "../src/model-catalogue/index.mjs";
import { participantSchema } from "../src/participant-list/index.mjs";
import * as product from "../src/product-process/index.mjs";

const { declarationSchema, doneCheck, gateSchema, workflowOf } = product;

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

const declarationWith = (done) => readDocument(declarationSchema, "docs/process.md", [
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
  ...done,
  "",
].join("\n"));
const DECLARATION = declarationWith(["The job rules hold for every pull request; no condition is added."]);

// The workflow of the fixture product, its model working in sprints or not.
async function workflowWith(sprints, declaration = DECLARATION) {
  const cat = await catalogue(snapshotAt({ [MODEL_PATH]: modelText(sprints) }));
  assert.deepEqual(cat.findings[MODEL_PATH], [], "known positive: team-scrum has no finding");
  return workflowOf(declaration, cat.models.find((model) => model.path === MODEL_PATH), [], INSTANCE_SPEC);
}


const DEV = "Development → Sprint Review";
const CODE = "a".repeat(40);
const TEST_FILE = "tests/product-process-done.test.mjs", SRC_FILE = "src/product-process/done.mjs";
const BLOB_A = "a".repeat(40), BLOB_B = "b".repeat(40);

const moduleDoc = (id, folder) => {
  const path = `docs/architecture/${id}.md`;
  return readDocument(artifactSchemaOf(path), path, `---\nid: ${id}\ntitle: ${id}\nfolder: ${folder}\nrealises:\nfollows:\n  - ARC-042\nuses:\nprovides:\n  - x\n---\n# ${id} ${id}\n\n## Responsibility\n\nX.\n`);
};
const MODULES = [moduleDoc("MOD-product-process", "src/product-process/"), moduleDoc("MOD-other", "src/other/")];

// A declared test: UC-034's example test of the item, naming a requirement and a module.
const declared = (id, expect = "no finding", more = "") => `// ${id} · level: unit · module: MOD-product-process\n// guards: THE DEFAULT DEFINITION OF DONE IS THE JOB RULES\n// given: a pull request that meets every rule\n// input: doneCheck\n// expect: ${expect}\ntest("${id}: x", () => {${more}});\n`;
const TEST_TEXT = declared("TST-409901");

function facts({ commits, files, reviews = [], checks = [{ name: "node", state: "success", url: "u" }], head = { [TEST_FILE]: TEST_TEXT }, base = {}, number = 7 } = {}) {
  return { pullRequest: { number, title: "ITM-409", branch: "item/ITM-409-done", base: "main", head: CODE, state: "open", draft: false, url: "https://example.test/pull/7", opened: "2026-10-13T08:00:00Z", merged: null, closed: null },
    commits, files, reviews, checks, read: async (path, side) => (side === "base" ? base : head)[path] ?? null };
}
const c = (sha, files, ci, message = "m") => ({ sha: sha.repeat(40), message, files, ci });
// UC-034's pull request: failing tests first, the implementation next, green.
const example = (more = {}) => facts({ commits: [c("1", [TEST_FILE], "failure", "tests first"), c("2", [SRC_FILE, TEST_FILE], "success", "implementation")],
  files: [{ path: TEST_FILE, change: "added" }, { path: SRC_FILE, change: "added" }], ...more });

function gateRecord({ gate = DEV, decision = "passed", on = [CODE, "https://example.test/pull/7"], at = "10:00", decider = "alice", role = "Product Owner" } = {}) {
  const text = ["---", `gate: ${gate}`, "job:", `decider: ${decider}`, `role: ${role}`, `decision: ${decision}`, "on:", ...on.map((entry) => `  - ${entry}`), `date: 2026-10-13 ${at} UTC`, "---", "# gate", "", "**REGISTER**", ""].join("\n");
  return readDocument(gateSchema, `docs/gates/20261013-${at.replace(":", "")}-development-sprint-review-abcd.md`, text);
}
const IMPLEMENT = { kind: "implement", modules: ["MOD-product-process"] };
const check = async (f, { job = IMPLEMENT, gates = [gateRecord()], workflow, modules = MODULES } = {}) => doneCheck(f, workflow ?? await workflowWith("yes"), modules, gates, job);
const rules = (found) => found.map((item) => item.rule);

// TST-409101 · level: unit · module: MOD-product-process
// guards: THE DEFAULT DEFINITION OF DONE IS THE JOB RULES; A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; UC-034
// given: UC-034's pull request: failing tests first with CI red, the implementation in the item's module with CI green, a new test that names a requirement and a module, the gate recorded by the Product Owner
// input: doneCheck(facts, workflow, modules, gates, { kind: "implement", modules: ["MOD-product-process"] })
// expect: no finding; the workflow's `done` lists the five job rules
test("TST-409101: doneCheck gives no finding for a pull request that meets every rule", async () => {
  assert.ok(doneCheck, "doneCheck is offered");
  const workflow = await workflowWith("yes");
  assert.equal(workflow.done.length, 5);
  assert.deepEqual(await check(example()), []);
});

// TST-409102 · level: unit · module: MOD-product-process
// guards: CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI
// given: the passing pull request, then its head commit red; a failing check of the head; a check still running; a head commit whose ci is none
// input: doneCheck over each
// expect: no finding for the passing one; each of the others one finding under the rule, on the pull request, naming the commit's ci or the check and its state
test("TST-409102: doneCheck names CI that is not green", async () => {
  assert.deepEqual(await check(example()), [], "known positive");
  const red = example(); red.commits[1].ci = "failure";
  const failing = example({ checks: [{ name: "node", state: "failure", url: "u" }] });
  const running = example({ checks: [{ name: "node", state: "running", url: "u" }] });
  const none = example(); none.commits[1].ci = "none";
  for (const [label, facts_] of [["red", red], ["failing", failing], ["running", running], ["none", none]]) {
    const found = await check(facts_);
    assert.deepEqual(rules(found), ["CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI"], label);
    assert.equal(found[0].artifact, "pull request #7");
    assert.equal(found[0].kind, "error");
    assert.equal(found[0].line, 1);
  }
  assert.match((await check(failing))[0].what, /node.*failure/);
  assert.match((await check(red))[0].what, /failure/);
});

// TST-409103 · level: unit · module: MOD-product-process
// guards: AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST
// given: the passing pull request; one whose first commit also changes a code file; one whose first commit is green; one with no commit; and a fix-bug job on the passing one
// input: doneCheck over each
// expect: nothing for the passing one and for the fix-bug job on it; one finding for the code file in the first commit, naming it; one for the first commit not red; one for no commit (and, with no head commit, one that CI is not green)
test("TST-409103: doneCheck requires the first commit to hold only tests and CI to be red on it", async () => {
  assert.deepEqual(await check(example()), [], "known positive");
  assert.deepEqual(await check(example(), { job: { kind: "fix-bug", modules: ["MOD-product-process"] } }), []);
  const withCode = example(); withCode.commits[0].files = [TEST_FILE, SRC_FILE];
  const found = await check(withCode);
  assert.deepEqual(rules(found), ["AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST"]);
  assert.match(found[0].what, new RegExp(SRC_FILE.replace(/\./g, "\\.")));
  const green = example(); green.commits[0].ci = "success";
  assert.deepEqual(rules(await check(green)), ["AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST"]);
  assert.match((await check(green))[0].what, /red/);
  assert.deepEqual(rules(await check(example({ commits: [] }))), ["CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI", "AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST"], "no commit: no green head and no first commit");
});

// TST-409104 · level: unit · module: MOD-product-process
// guards: AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES
// given: the passing pull request; one that also changes a code file in another module's folder, one in no module's folder; a changed markdown file, a test file and a schema file outside the folders
// input: doneCheck over each
// expect: nothing for the passing one and for the files that are no code; one finding for each code file outside the job's modules, naming the file
test("TST-409104: doneCheck requires every changed code file to lie in a folder of the job's modules", async () => {
  assert.deepEqual(await check(example()), [], "known positive");
  const extra = (path) => example({ files: [...example().files, { path, change: "modified" }], commits: [...example().commits, c("3", [path], "success")] });
  for (const path of ["src/other/index.mjs", "docs/assets/app.js", "src/product-process-extra/index.mjs"]) {
    const found = await check(extra(path));
    assert.deepEqual(rules(found), ["AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES"], path);
    assert.match(found[0].what, new RegExp(path.replace(/\./g, "\\.")));
    assert.equal(found[0].artifact, path);
  }
  for (const path of ["docs/architecture/MOD-other.md", "src/other/x.schema.md", "tests/other.test.mjs"]) assert.deepEqual(await check(extra(path)), [], path);
});

// TST-409105 · level: unit · module: MOD-product-process
// guards: EVERY ARTIFACT NAMES ITS ORIGIN
// given: the passing pull request; one whose new test names no module; one whose new test guards nothing; one whose new test file has no declaration; and a modified test file that adds a declared test
// input: doneCheck over each
// expect: nothing for the passing one; a finding for the test without a module, for the one guarding nothing, and for the file without declarations, each naming the test or the file; the added declaration of a modified file is checked as a new test, an old one is not
test("TST-409105: doneCheck requires every new test to name a requirement and a module", async () => {
  assert.deepEqual(await check(example()), [], "known positive");
  const headWith = (text) => ({ [TEST_FILE]: text });
  const noModule = await check(example({ head: headWith(TEST_TEXT.replace(" · module: MOD-product-process", "")) }));
  assert.deepEqual(rules(noModule), ["EVERY ARTIFACT NAMES ITS ORIGIN"]);
  assert.match(noModule[0].what, /TST-409901.*module/);
  const noGuard = await check(example({ head: headWith(TEST_TEXT.replace("// guards: THE DEFAULT DEFINITION OF DONE IS THE JOB RULES\n", "")) }));
  assert.deepEqual(rules(noGuard), ["EVERY ARTIFACT NAMES ITS ORIGIN"]);
  assert.match(noGuard[0].what, /TST-409901.*requirement/);
  const bare = await check(example({ head: headWith('test("x", () => {});\n') }));
  assert.deepEqual(rules(bare), ["EVERY ARTIFACT NAMES ITS ORIGIN"]);
  assert.match(bare[0].what, new RegExp(TEST_FILE.replace(/\./g, "\\.")));
  const old = declared("TST-409900");
  const modified = (text) => facts({ commits: example().commits, files: [{ path: TEST_FILE, change: "modified" }, { path: SRC_FILE, change: "added" }], base: { [TEST_FILE]: old }, head: headWith(text) });
  assert.deepEqual(await check(modified(old + declared("TST-409901"))), [], "an added declared test");
  const added = await check(modified(old + declared("TST-409901").replace(" · module: MOD-product-process", "")));
  assert.deepEqual(rules(added), ["EVERY ARTIFACT NAMES ITS ORIGIN"]);
  assert.match(added[0].what, /TST-409901/);
  assert.deepEqual(await check(modified(old.replace(" · module: MOD-product-process", ""))), [], "a test already in the base is not new");
});

// TST-409106 · level: unit · module: MOD-product-process
// guards: THE GATE IS RECORDED
// given: the passing pull request; no record of its gate; a rejection; a pass on an earlier text of an artifact the record names at BLOB_A while the head holds it changed; a record of another gate; a gate that leaves a later phase and has no record
// input: doneCheck over each
// expect: nothing for the passing one and when only the later gate (Sprint Retrospective → Sprint Planning) lacks a record; one finding under THE GATE IS RECORDED naming the gate for no record, for the rejection and for the pass on an earlier text (with its difference)
test("TST-409106: doneCheck requires every gate before the merge to be recorded on the current texts", async () => {
  assert.deepEqual(await check(example()), [], "known positive: the later gate needs nothing");
  for (const [label, gates] of [["no record", []], ["rejection", [gateRecord({ decision: "rejected" })]], ["another gate", [gateRecord({ gate: "Sprint Retrospective → Sprint Planning" })]]]) {
    const found = await check(example(), { gates });
    assert.deepEqual(rules(found), ["THE GATE IS RECORDED"], label);
    assert.match(found[0].what, /Development → Sprint Review/);
  }
  const named = gateRecord({ on: [`docs/increment.md@${BLOB_A}`] });
  const same = example({ head: { [TEST_FILE]: TEST_TEXT, "docs/increment.md": "unchanged" } });
  const blob = createHash("sha1").update("blob 9\0unchanged").digest("hex");
  assert.deepEqual(await check(same, { gates: [gateRecord({ on: [`docs/increment.md@${blob}`] })] }), [], "a pass on the text that holds");
  const found = await check(same, { gates: [named] });
  assert.deepEqual(rules(found), ["THE GATE IS RECORDED"]);
  assert.match(found[0].what, /earlier text.*docs\/increment\.md/);
});

// TST-409107 · level: unit · module: MOD-product-process
// guards: A REFACTORING JOB BEGINS WITHOUT A FAILING TEST; A REFACTORING JOB CHANGES NO EXPECTED RESULT
// given: a refactoring job whose commits are all green and whose test file keeps every assertion and adds one; the same with a red first commit; the same with an assertion's expected value changed; with an assertion removed; with a declared expect changed
// input: doneCheck(..., { kind: "refactor", modules: ["MOD-product-process"] })
// expect: nothing for the green one that keeps and adds assertions; one finding under A REFACTORING JOB BEGINS WITHOUT A FAILING TEST naming the red commit; one finding under A REFACTORING JOB CHANGES NO EXPECTED RESULT, naming the test file and the assertion, for the changed value, the removed assertion and the changed expect; a refactoring job does not need a failing first commit
test("TST-409107: doneCheck holds a refactoring job to green commits and unchanged expected results", async () => {
  const before = declared("TST-409900", "the sum is 3", "\n  assert.equal(add(1, 2), 3);\n  assert.deepEqual(list(), []);\n");
  const refactor = (head, { ci = ["success", "success"] } = {}) => facts({ commits: [c("1", [SRC_FILE], ci[0]), c("2", [SRC_FILE, TEST_FILE], ci[1])],
    files: [{ path: TEST_FILE, change: "modified" }, { path: SRC_FILE, change: "modified" }], base: { [TEST_FILE]: before }, head: { [TEST_FILE]: head } });
  const job = { kind: "refactor", modules: ["MOD-product-process"] };
  const added = before.replace("assert.deepEqual(list(), []);", "assert.deepEqual(list(), []);\n  assert.equal(add(2, 2), 4);");
  assert.deepEqual(await check(refactor(added), { job }), [], "known positive: assertions kept, one added");
  const red = await check(refactor(added, { ci: ["failure", "success"] }), { job });
  assert.deepEqual(rules(red), ["A REFACTORING JOB BEGINS WITHOUT A FAILING TEST"]);
  assert.match(red[0].what, /1{7}/);
  const value = await check(refactor(before.replace("add(1, 2), 3", "add(1, 2), 4")), { job });
  assert.deepEqual(rules(value), ["A REFACTORING JOB CHANGES NO EXPECTED RESULT"]);
  assert.equal(value[0].artifact, TEST_FILE);
  assert.match(value[0].what, /assert\.equal\(add\(1, 2\), 3\)/);
  assert.deepEqual(rules(await check(refactor(before.replace("  assert.deepEqual(list(), []);\n", "")), { job })), ["A REFACTORING JOB CHANGES NO EXPECTED RESULT"]);
  const expect = await check(refactor(before.replace("the sum is 3", "the sum is 4")), { job });
  assert.deepEqual(rules(expect), ["A REFACTORING JOB CHANGES NO EXPECTED RESULT"]);
  assert.match(expect[0].what, /TST-409900/);
});

// TST-409108 · level: unit · module: MOD-product-process
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS; A PRODUCT DECLARES ITS DEFINITION OF DONE
// given: a declaration that adds `check: lint`, `review: 2 by participants other than the implementer` and `gate: Sprint Retrospective → Sprint Planning`
// input: doneCheck on the passing pull request, which has no check lint, one approval, and no record of the later gate; then with the check, two approvals and the record
// expect: three findings under A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS, one for each condition, naming it; none when each holds (two distinct approvers, a comment not counted)
test("TST-409108: doneCheck checks the conditions the declaration adds", async () => {
  const added = declarationWith(["check: lint", "", "review: 2 by participants other than the implementer", "", "gate: Sprint Retrospective → Sprint Planning"]);
  const workflow = await workflowWith("yes", added);
  assert.equal(workflow.done.length, 8, "the conditions follow the job rules");
  const review = (reviewer, verdict = "approved") => ({ reviewer, verdict, commit: CODE, date: "2026-10-13T09:00:00Z" });
  const gates = [gateRecord(), gateRecord({ gate: "Sprint Retrospective → Sprint Planning", at: "11:00", decider: "check: retro-recorded", role: "check" })];
  const unmet = await check(example({ reviews: [review("bob")] }), { workflow, gates: [gateRecord()] });
  assert.deepEqual(rules(unmet), Array(3).fill("A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS"));
  assert.ok(unmet.some((f) => /lint/.test(f.what)) && unmet.some((f) => /review: 2/.test(f.what)) && unmet.some((f) => /Sprint Retrospective → Sprint Planning/.test(f.what)));
  const met = example({ reviews: [review("bob"), review("carol"), review("erin", "commented")], checks: [{ name: "node", state: "success", url: "u" }, { name: "lint", state: "success", url: "u" }] });
  assert.deepEqual(await check(met, { workflow, gates: [...gates, gateRecord({ gate: "Sprint Retrospective → Sprint Planning", at: "11:00", decider: "check: retro-recorded", role: "check" })] }), [], "every added condition holds");
  const oneBob = example({ reviews: [review("bob"), review("bob")], checks: met.checks });
  assert.equal((await check(oneBob, { workflow, gates })).length, 1, "two reviews by one reviewer are one");
  const mixed = example({ reviews: [review("bob"), review("erin", "commented")], checks: met.checks });
  assert.equal((await check(mixed, { workflow, gates })).length, 1, "a comment is no approval");
});

// TST-409109 · level: unit · module: MOD-product-process
// guards: A PULL REQUEST IS MERGED ONLY WHEN THE DEFINITION OF DONE HOLDS
// given: a pull request that breaks CI, the module rule and the gate at once
// input: doneCheck, twice, with the inputs frozen
// expect: one finding for each rule broken, in the order of the job rules — CI, first commit, modules, new tests, gates —, each a valid finding (artifact, line 1, kind error, rule, what, fix); the same answer twice; the inputs unchanged
test("TST-409109: doneCheck reports every broken rule, in order, and changes nothing", async () => {
  const broken = example({ checks: [{ name: "node", state: "failure", url: "u" }] });
  broken.commits[0].ci = "success";
  broken.files.push({ path: "src/other/index.mjs", change: "modified" });
  const frozen = JSON.stringify(broken.commits) + JSON.stringify(broken.files);
  const found = await check(broken, { gates: [] });
  assert.deepEqual(rules(found), ["CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI", "AN IMPLEMENTATION JOB BEGINS WITH A FAILING TEST", "AN IMPLEMENTATION JOB CHANGES ONLY ITS MODULES", "THE GATE IS RECORDED"]);
  for (const item of found) { assert.equal(typeof item.what, "string"); assert.equal(typeof item.fix, "string"); assert.equal(item.line, 1); assert.equal(item.kind, "error"); }
  assert.deepEqual(await check(broken, { gates: [] }), found);
  assert.equal(JSON.stringify(broken.commits) + JSON.stringify(broken.files), frozen);
});

// TST-891001 · level: unit · module: MOD-product-process
// guards: THE GATE IS RECORDED; THE DEFAULT DEFINITION OF DONE IS THE JOB RULES; UC-034
// given: the passing pull request #7 (commits "1"x40 and "2"x40, address https://example.test/pull/7) with its own passing record of the gate Development → Sprint Review at 10:00, naming its commit "2"x40 and its address; and a newer rejecting record of the same gate at 11:00 naming another pull request's commit "9"x40 and address https://example.test/pull/8
// input: doneCheck over both records; over the rejecting record of the other pull request alone; over the own record naming only the commit; over the own record naming only the address
// expect: no finding for both records; one finding under THE GATE IS RECORDED naming the gate Development → Sprint Review as pending for the other pull request's record alone, and as rejected for a rejection naming its own commit; no finding when the own record names only the commit or only the address, beside the newer rejection of the other
test("TST-891001: doneCheck counts only the gate records that name the pull request's commits or its address", async () => {
  const own = gateRecord({ on: ["2".repeat(40), "https://example.test/pull/7"], at: "10:00" });
  const other = gateRecord({ decision: "rejected", on: ["9".repeat(40), "https://example.test/pull/8"], at: "11:00" });
  assert.deepEqual(await check(example(), { gates: [own, other] }), [], "the newer rejection of another pull request does not decide this one's gate");
  const alone = await check(example(), { gates: [other] });
  assert.deepEqual(rules(alone), ["THE GATE IS RECORDED"], "with only the other pull request's record the gate is not recorded");
  assert.match(alone[0].what, /Development → Sprint Review is not recorded as passed: pending/);
  const ownRejection = await check(example(), { gates: [gateRecord({ decision: "rejected", on: ["2".repeat(40)], at: "11:00" })] });
  assert.match(ownRejection[0].what, /Development → Sprint Review is not recorded as passed: rejected/, "known positive: a rejection that names its own commit decides");
  const byCommit = gateRecord({ on: ["1".repeat(40)], at: "10:00" });
  const byAddress = gateRecord({ on: ["https://example.test/pull/7"], at: "10:00" });
  assert.deepEqual(await check(example(), { gates: [byCommit, other] }), [], "a record naming one of its commits");
  assert.deepEqual(await check(example(), { gates: [byAddress, other] }), [], "a record naming its address");
});
