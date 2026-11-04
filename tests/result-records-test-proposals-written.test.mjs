// MOD-result-records' check `test-proposals`, its use for the kind `write-tests` (ITM-754), as the accepted text of docs/architecture/MOD-result-records.md states it: "an error for a new
// automated test without its counter-proof record in the schema `counter-proof`, or with one that does not record it failing with its fault planted — such a test is not written (UC-026 8b) —,
// unless the draft reports the test failing on the current code: it awaits implementation (UC-026 8a); and an error for a written test whose identifier, level, guarded identifiers or expected
// result differ from the reviewed case it implements." Level `user` takes no counter-proof (UC-026 1a).
// Run: node --test tests/result-records-test-proposals-written.test.mjs
//
// Module: MOD-result-records
// Guards: UC-026; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS; EVERY ARTIFACT NAMES ITS ORIGIN
// Level: unit
//
// Where the file leaves a reading open, the tests state the one they take, and the pull request names it:
//   - The draft is the agent's report: `{ branch, commits, pullRequest, tests: [{ identifier, outcome, counterProof }], notWritten }`. A draft with a `branch` is the report of `write-tests`;
//     a draft with `cases` is the answer of `propose-tests` and is judged as before.
//   - The branch is read as the runner's `test-declarations` reads it: `context.product.host.readSnapshot(draft.branch)` against `context.product.snapshot`. A test is new when the branch's
//     file declares its identifier and the product's snapshot's file of that path does not.
//   - A counter-proof is read from `docs/tests/counter-proofs/<identifier>.md` on the branch, with `resultSchema.counterProof`. It records the test failing with its fault planted when
//     its `outcome` is `failed` and its sections `## Fault` and `## Result` are not blank.
//   - The reviewed cases are `context.params.draft`: an array of cases, or `{ cases }`, each `{ identifier, level, guards, expected }`. A written test differs from its case when its level,
//     its guarded identifiers (as a set) or its expected result (equal after trimming and collapsing white space and ignoring case) differ. A new test whose identifier no case has differs
//     in its identifier. A case with no written test is not judged here.
//   - A test names the requirement it guards and the module it exercises as two fields (EVERY ARTIFACT NAMES ITS ORIGIN), so a case's guards are read as MOD-test-document reads a test's: an
//     entry `MOD-<slug>` is the case's module, compared with the test's `module`, and the others are its guards, compared with the test's `guards`. Each is compared when the case names it:
//     a case that names only a module leaves the test's guards to the test, which must name one (MOD-test-document's testFindings), and a case that names no module leaves its module.
//   - A finding's `artifact` is the test file's path and its `line` the test's declaration line; `what` names the test. Level and guards and identifier mismatches are under A NEW TEST IS SHOWN TO
//     FAIL ON A PLANTED FAULT, an expected-result mismatch under A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { resultStrategies } from "../src/result-records/index.mjs";

const NEW = "A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT";
const EXPECTED = "A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS";

const snapshotOf = (files) => ({ paths: Object.keys(files), read: async (path) => (Object.hasOwn(files, path) ? files[path] : null), blob: (path) => (Object.hasOwn(files, path) ? `blob:${files[path]}` : null) });
const declared = ({ id, level = "unit", module = "MOD-widgets", guards = "A RULE", expect = "round" }) =>
  [`// ${id} · level: ${level} · module: ${module}`, `// guards: ${guards}`, "// given: a widget", "// input: its shape", `// expect: ${expect}`, `test("${id}", () => {});`, ""].join("\n");
const PATH = "tests/widgets.test.mjs";
const proof = (id, { outcome = "failed", fault = "- a\n+ b", result = "fails with the fault, passes without" } = {}) =>
  `---\ntest: ${id}\ncommit: ${"a".repeat(40)}\nparticipant: dev\ndate: 2026-10-18T08:00:00Z\noutcome: ${outcome}\n---\n## Fault\n\n${fault}\n\n## Result\n\n${result}\n`;
const proofPath = (id) => `docs/tests/counter-proofs/${id}.md`;
const BASE = { "src/widget.mjs": "export const round = true;\n" };
const contextOf = (branchFiles, cases = undefined, productFiles = BASE) => ({ kind: null, params: cases === undefined ? {} : { draft: cases },
  product: { address: "https://github.com/acme/product", snapshot: snapshotOf(productFiles),
    host: { readSnapshot: async (ref) => { if (ref !== "tests-branch") throw Object.assign(new Error("no"), { name: "NotFound" }); return snapshotOf({ ...productFiles, ...branchFiles }); } } },
  instance: { snapshot: snapshotOf({}), host: null, checkout: null }, connect: async () => null, participants: [], places: { sources: {}, mailbox: null },
  gates: [], person: "alice", now: new Date("2026-10-18T08:00:00Z"), agentM: { version: "unreleased", commit: "a".repeat(40) }, jobId: null });
const report = (tests = [], extra = {}) => ({ branch: "tests-branch", commits: ["c1"], pullRequest: "https://github.com/acme/product/pull/1", tests, notWritten: [], ...extra });
const check = (draft, branchFiles, cases, productFiles) => resultStrategies.checks["test-proposals"](draft, contextOf(branchFiles, cases, productFiles));
const summary = (findings) => findings.map((found) => [found.artifact, found.kind, found.rule]);
const CASE = { identifier: "TST-754001", level: "unit", guards: ["A RULE"], expected: "round" };

// TST-754101 · level: unit · module: MOD-result-records
// guards: A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; UC-026
// given: a branch that adds one unit test TST-754001 with its valid counter-proof record (outcome failed, a fault, a result), and the reviewed case it implements
// input: the check test-proposals on the report of the branch
// expect: no finding
test("test-proposals (write-tests) — a test with a valid counter-proof passes", async () => {
  const files = { [PATH]: declared({ id: "TST-754001" }), [proofPath("TST-754001")]: proof("TST-754001") };
  assert.deepEqual(await check(report([{ identifier: "TST-754001", outcome: "passed", counterProof: "see record" }]), files, [CASE]), []);
});

// TST-754102 · level: unit · module: MOD-result-records
// guards: A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; UC-026
// given: a branch that adds two unit tests, TST-754001 with no counter-proof record and TST-754002 with its record; both reported passed
// input: the check test-proposals on the report
// expect: one error finding under A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT, on the file PATH at the declaration line of TST-754001 (line 1), naming TST-754001 in what; none for TST-754002
test("test-proposals (write-tests) — a new test without its counter-proof record is an error", async () => {
  const files = { [PATH]: declared({ id: "TST-754001" }) + declared({ id: "TST-754002" }), [proofPath("TST-754002")]: proof("TST-754002") };
  const found = await check(report([{ identifier: "TST-754001", outcome: "passed" }, { identifier: "TST-754002", outcome: "passed" }]), files,
    [CASE, { ...CASE, identifier: "TST-754002" }]);
  assert.deepEqual(summary(found), [[PATH, "error", NEW]]);
  assert.equal(found[0].line, 1);
  assert.match(found[0].what, /TST-754001/);
  assert.notEqual(found[0].fix, "");
});

// TST-754103 · level: unit · module: MOD-result-records
// guards: A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; UC-026
// given: a branch that adds three unit tests, each with a counter-proof record that does not record the failure: TST-754001 outcome passed, TST-754002 a blank ## Result, TST-754003 a blank ## Fault
// input: the check test-proposals on the report (all reported passed)
// expect: three error findings under A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT, one for each, naming its test
test("test-proposals (write-tests) — a counter-proof that does not record the failure with the fault planted is an error", async () => {
  const files = { [PATH]: ["TST-754001", "TST-754002", "TST-754003"].map((id) => declared({ id })).join(""),
    [proofPath("TST-754001")]: proof("TST-754001", { outcome: "passed" }), [proofPath("TST-754002")]: proof("TST-754002", { result: "" }),
    [proofPath("TST-754003")]: proof("TST-754003", { fault: "" }) };
  const found = await check(report(["TST-754001", "TST-754002", "TST-754003"].map((identifier) => ({ identifier, outcome: "passed" }))), files);
  assert.deepEqual(summary(found), [[PATH, "error", NEW], [PATH, "error", NEW], [PATH, "error", NEW]]);
  assert.deepEqual(found.map((one) => /TST-75400([123])/.exec(one.what)[1]), ["1", "2", "3"]);
});

// TST-754104 · level: unit · module: MOD-result-records
// guards: UC-026; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT
// given: a branch that adds unit tests TST-754001 (no counter-proof record, reported failed), TST-754002 (no counter-proof record, reported passed)
// input: the check test-proposals on the report
// expect: one error finding, for TST-754002 only; none for TST-754001, which awaits implementation
test("test-proposals (write-tests) — a test the draft reports failing on the current code needs no counter-proof", async () => {
  const files = { [PATH]: declared({ id: "TST-754001" }) + declared({ id: "TST-754002" }) };
  const found = await check(report([{ identifier: "TST-754001", outcome: "failed" }, { identifier: "TST-754002", outcome: "passed" }]), files);
  assert.equal(found.length, 1);
  assert.match(found[0].what, /TST-754002/);
});

// TST-754105 · level: unit · module: MOD-result-records
// guards: UC-026; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT
// given: a branch that adds one test of level user, TST-754001, with no counter-proof record
// input: the check test-proposals on the report
// expect: no finding
test("test-proposals (write-tests) — a test of level user takes no counter-proof", async () => {
  const files = { [PATH]: declared({ id: "TST-754001", level: "user" }) };
  assert.deepEqual(await check(report([{ identifier: "TST-754001", outcome: "passed" }]), files, [{ ...CASE, level: "user" }]), []);
});

// TST-754106 · level: unit · module: MOD-result-records
// guards: A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS; UC-026
// given: reviewed cases TST-754001 (unit, guards A RULE, expected round) to TST-754004, and a branch with their tests with valid counter-proofs: TST-754001 written at level component, TST-754002 guarding ANOTHER RULE, TST-754003 expecting square, TST-754004 with ROUND in other case and spacing (equal), and TST-754005, which no case has
// input: the check test-proposals on the report, with the cases in the job's parameters
// expect: four error findings: level for TST-754001 and guards for TST-754002 under A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT, expected result for TST-754003 under A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS, identifier for TST-754005 under A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; none for TST-754004
test("test-proposals (write-tests) — a written test that differs from its reviewed case in level, guards, expected result or identifier is an error", async () => {
  const ids = ["TST-754001", "TST-754002", "TST-754003", "TST-754004", "TST-754005"];
  const files = { [PATH]: declared({ id: "TST-754001", level: "component" }) + declared({ id: "TST-754002", guards: "ANOTHER RULE" }) + declared({ id: "TST-754003", expect: "square" })
    + declared({ id: "TST-754004", expect: "  ROUND " }) + declared({ id: "TST-754005" }),
    ...Object.fromEntries(ids.map((id) => [proofPath(id), proof(id)])) };
  const cases = ids.slice(0, 4).map((identifier) => ({ ...CASE, identifier }));
  const found = await check(report(ids.map((identifier) => ({ identifier, outcome: "passed" }))), files, { cases });
  assert.deepEqual(summary(found), [[PATH, "error", NEW], [PATH, "error", NEW], [PATH, "error", EXPECTED], [PATH, "error", NEW]]);
  assert.deepEqual(found.map((one) => /TST-75400(\d)/.exec(one.what)[1]), ["1", "2", "3", "5"]);
});

// TST-754107 · level: unit · module: MOD-result-records
// guards: A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; UC-026
// given: a product whose own test file declares TST-754009 and has no counter-proof record, and a branch that changes that file by adding TST-754001 (with its record) and leaves TST-754009; and a report of a branch the host does not hold
// input: the check test-proposals on each
// expect: no finding for the first (the existing test is not new); for the second, an error finding naming the branch
test("test-proposals (write-tests) — an existing test is not new, and a branch the host lacks is an error", async () => {
  const before = declared({ id: "TST-754009" });
  const files = { [PATH]: before + declared({ id: "TST-754001" }), [proofPath("TST-754001")]: proof("TST-754001") };
  assert.deepEqual(await check(report([{ identifier: "TST-754001", outcome: "passed" }]), files, [CASE], { ...BASE, [PATH]: before }), []);
  const lost = await check(report([], { branch: "not-pushed" }), files);
  assert.equal(lost.length, 1);
  assert.equal(lost[0].kind, "error");
  assert.match(lost[0].what, /not-pushed/);
});

// TST-1425001 · level: unit · module: MOD-result-records
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; UC-026
// given: reviewed cases that name a module among their guards, and a branch with their tests and valid counter-proofs, each test naming its module in `module` and only requirements in `guards`: TST-754001 (case A RULE and MOD-widgets; test MOD-widgets, A RULE), TST-754002 (case MOD-widgets alone; test MOD-widgets, A RULE), TST-754003 (case A RULE and MOD-widgets; test MOD-widgets, ANOTHER RULE), TST-754004 (case A RULE and MOD-gadgets; test MOD-widgets, A RULE)
// input: the check test-proposals on the report, with the cases in the job's parameters
// expect: known positive — TST-754003's guards differ and stay an error under A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; TST-754004's module differs from its case's and is an error under the same rule, naming MOD-gadgets; no finding for TST-754001 or TST-754002, whose module is its case's and whose guards are its case's without the module
test("TST-1425001: test-proposals (write-tests) — a case's module is the test's module, not one of its guards", async () => {
  const ids = ["TST-754001", "TST-754002", "TST-754003", "TST-754004"];
  const files = { [PATH]: declared({ id: "TST-754001" }) + declared({ id: "TST-754002" }) + declared({ id: "TST-754003", guards: "ANOTHER RULE" }) + declared({ id: "TST-754004" }),
    ...Object.fromEntries(ids.map((id) => [proofPath(id), proof(id)])) };
  const cases = [{ ...CASE, guards: ["A RULE", "MOD-widgets"] }, { ...CASE, identifier: "TST-754002", guards: ["MOD-widgets"] },
    { ...CASE, identifier: "TST-754003", guards: ["A RULE", "MOD-widgets"] }, { ...CASE, identifier: "TST-754004", guards: ["A RULE", "MOD-gadgets"] }];
  const found = await check(report(ids.map((identifier) => ({ identifier, outcome: "passed" }))), files, { cases });
  assert.deepEqual(summary(found), [[PATH, "error", NEW], [PATH, "error", NEW]]);
  assert.deepEqual(found.map((one) => /TST-75400(\d)/.exec(one.what)[1]), ["3", "4"]);
  assert.match(found[1].what, /MOD-gadgets/);
});
