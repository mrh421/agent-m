// ITM-756 — the audit rows of a release: MOD-release-evidence's auditRows, as docs/architecture/MOD-release-evidence.md
// states it (UC-030 steps 2 and 3; alternative flows 1a, 2a, 2b, 2c). ITM-757 — its evidence and its `accepted` argument
// (TST-757001 to TST-757007), and auditDocument, the document of the audit (UC-030 step 5; TST-757101 to TST-757108, the last
// section of this file, over an audit written out in the section itself).
// Run: node --test tests/release-evidence-audit.test.mjs
//
// Module: MOD-release-evidence
// Guards: UC-030; THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED
// Guards: ARTIFACTS ARE MARKDOWN; THE PRODUCT REPOSITORY IS SELF-SUFFICIENT; AN APPROVAL NAMES THE EXACT TEXT
// Guards: RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; A SOURCE DECLARES ITS AUTHORITY
// Guards: A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; THE TRACEABILITY MATRIX IS DERIVED
// Level: unit
//
// The fixture is a small product repository at the tag v2026.4.0, held as Snapshot-shaped plain objects: its SPEC of five
// requirements, the tests that guard four of them, a backlog item, three job records, a counter-proof, the links to two sources, an
// earlier release's report; its default branch, which alone holds the release test report and its approval record (acceptAndRelease
// commits them after the tagged commit); the branch test-results; the instance's register entries as documents; the instance's SPEC with
// one process requirement and the gate record given for it. Each test states its input and
// expected result before it runs. Nothing reaches the network, the clock or a host. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as evidenceModule from "../src/release-evidence/index.mjs";
const { auditRows } = evidenceModule;
// Looked up when it is called, so that a module without auditDocument fails the cases that call it, not the whole file.
const auditDocument = (...args) => evidenceModule.auditDocument(...args);
import { writeDocument } from "../src/documents/index.mjs";
import { approvalSchema } from "../src/approvals/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { sourceSchemas } from "../src/source-register/index.mjs";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const hex = (text) => createHash("sha256").update(text, "utf8").digest("hex");
const versionHash = (files) => hex([...files].sort(([a], [b]) => (a < b ? -1 : 1)).map(([name, text]) => `${hex(text)}  ${name}\n`).join(""));
const gitBlob = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");
const snapshotOf = (files, commit) => ({
  repository: { path: "fixture/product" }, commit, paths: Object.keys(files),
  read: async (path) => (Object.hasOwn(files, path) ? files[path] : null),
  blob: (path) => (Object.hasOwn(files, path) ? gitBlob(files[path]) : null),
});

const VERSION = "2026.4.0", TAG = `v${VERSION}`, REPORT = `docs/tests/releases/${TAG}.md`;
const COMMIT = "c".repeat(40), OLD = "e".repeat(40), HEAD = "f".repeat(40);
const R1 = "A FIRST RULE", R2 = "A SECOND RULE", R3 = "A THIRD RULE", R4 = "A FOURTH RULE", R5 = "A FIFTH RULE", PROCESS = "A PROCESS RULE";

const BOOK_FILES = [["08_requirements-engineering.md", "Chapter 8 of the book.\n"]];
const IEC_FILES = [["iec-62304.txt", "5.5.5 Software unit verification.\n"]];
const entry = ({ id, title, kind, authority, extra = [], version, files }) => [
  "---", `id: ${id}`, `title: ${title}`, `kind: ${kind}`, `authority: ${authority}`, "licence: may be republished — fixture", ...extra, "---",
  `# ${id} ${title}`, "", "A fixture source.", "", "## Versions", "",
  "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| \`${version}\` | 2026-10-01 | fixture | fixture only | listed below |`, "",
  `### Files of ${version}`, "", "| File | SHA-256 |", "|---|---|",
  ...files.map(([name, text]) => `| \`${name}\` | \`${hex(text)}\` |`), "",
].join("\n");
const BOOK = entry({ id: "SRC-vibe-coding", title: "Vibe Coding", kind: "document", authority: "advisory", version: "2026-10-05", files: BOOK_FILES });
const IEC = entry({ id: "SRC-iec-62304", title: "Medical device software", kind: "standard", authority: "normative",
  extra: ["designation: IEC 62304:2006+AMD1:2015"], version: "2015", files: IEC_FILES });
const LINKS = ["# The sources this product meets", "", "| Source | Version | Hash | Part |", "|---|---|---|---|",
  `| SRC-vibe-coding | 2026-10-05 | ${versionHash(BOOK_FILES)} | |`, `| SRC-iec-62304 | 2015 | ${versionHash(IEC_FILES)} | class B |`, ""].join("\n");

const SPEC = ["# Fixture product — Specification", "", "## Rules", "",
  `**${R1}** *(Vibe Coding, ch. 9; IEC 62304:2006+AMD1:2015, 5.5.5)*`, "The first rule.", "*Check:* `tests/unit.test.mjs`", "",
  `**${R2}** *(Vibe Coding)*`, "The second rule.", "*Check:* `tests/failing.test.mjs`", "",
  `**${R3}** *(Vibe Coding)*`, "The third rule, which no test guards.", "*Check:* no automatic check; at review", "",
  `**${R4}** *(Vibe Coding)*`, "The fourth rule.", "*Check:* `tests/unit.test.mjs`", "",
  `**${R5}** *(Vibe Coding)*`, "The fifth rule.", "*Check:* `tests/unit.test.mjs`", ""].join("\n");
const INSTANCE_SPEC = ["# Fixture instance — Specification", "", "## Process", "",
  `**${PROCESS}** *(Vibe Coding)*`, "The process rule.", "*Check:* no automatic check; at review", ""].join("\n");

const declaration = (id, level, guards, module, extra = []) => [
  `// ${id} · level: ${level} · module: ${module}`, `// guards: ${guards}`, "// given: a fixture", "// input: a call", "// expect: a result", ...extra, ""].join("\n");
const UNIT_TESTS = [
  declaration("TST-756101", "unit", R1, "MOD-widget"), declaration("TST-756104", "unit", R4, "MOD-widget"),
  declaration("TST-756105", "unit", R5, "MOD-widget", ["// runs: 10", "// phrasings: 2"])].join("\n");

const jobRecord = ({ id, kind, worksOn, participant, results }) => ["---", `id: ${id}`, `kind: ${kind}`, "works_on:", `  - ${worksOn}`,
  `participant: ${participant}`, "route: tab", "started_by: akmaier", "start: 2026-10-01 09:00 UTC", "agent_m: fixture, commit fixture", "limit: 1", "---",
  "## Destinations", "", "## Parameters", "", "```json", "{}", "```", "", "## End", "", "at: 2026-10-01 10:00 UTC", "state: done", `results: ${results}`, ""].join("\n");

const run = (commit, rows) => ["---", `commit: ${commit}`, "levels:", "  - unit", "  - release", "occasion: release-candidate", "participant: ci",
  "date: 2026-10-11 21:00 UTC", "---", "## Outcomes", "", "| Test | Level | Outcome | Runs |", "|---|---|---|---|",
  ...rows.map((row) => `| ${row.join(" | ")} |`), ""].join("\n");

const priorReport = ["---", "version: 2026.3.0", "candidate: v2026.3.0-rc.1", `commit: ${OLD}`, "date: 2026-10-01", "---", "## Limitations", "", "## Levels", "",
  "| Level | Passed | Failed | Flaky | Not run |", "|---|---|---|---|---|", "| unit | 1 | 0 | 0 | 0 |", "", "## Tests", "",
  "| Test | Level | Outcome | Guards |", "|---|---|---|---|", `| TST-756105 | unit | 8 of 10 | ${R5} |`, "", "## Requirements", "",
  "| Requirement | Level | Tests | Outcome |", "|---|---|---|---|", `| ${R5} | unit | TST-756105 | passed |`, "", "## Changelog entry", "", "Earlier.", ""].join("\n");

const REPORT_TEXT = "# Report of the fixture release\n\nThe report as accepted.\n";
const approvalOf = (limitation) => writeDocument(approvalSchema, { fields: { kind: "release-report", file: REPORT, blob: gitBlob(REPORT_TEXT), limitation } });
const LIMITATIONS = ["TST-756104 — flaky on the CI runner", "TST-756105 — the model answers slower"];

const counterProof = ["---", "test: TST-756101", `commit: ${COMMIT}`, "participant: dev-a", "date: 2026-10-01 09:30 UTC", "outcome: failed", "---",
  "## Fault", "", "src/widget/index.mjs: the check removed.", "", "## Result", "", "Failed with the fault, passed without it.", ""].join("\n");

function productFiles() {
  return {
    "SPEC.md": SPEC, "docs/sources.md": LINKS,
    "tests/unit.test.mjs": UNIT_TESTS, "tests/failing.test.mjs": declaration("TST-756106", "unit", R2, "MOD-widget"),
    "tests/release-a.test.mjs": declaration("TST-756102", "release", R1, "system"),
    "tests/release-b.test.mjs": declaration("TST-756103", "release", R1, "system"),
    "docs/backlog/ITM-900-widget.md": ["---", "id: ITM-900", "title: The widget", "level: module", "realises:", `  - ${R1}`, "modules:", "  - MOD-widget",
      "tests:", "  - unit", "origin:", "  - akmaier", "---", "# ITM-900 The widget", ""].join("\n"),
    "docs/jobs/JOB-20261001-0900-aaaa.md": jobRecord({ id: "JOB-20261001-0900-aaaa", kind: "implement", worksOn: "ITM-900", participant: "dev-a", results: "src/widget/index.mjs" }),
    "docs/jobs/JOB-20261001-0901-bbbb.md": jobRecord({ id: "JOB-20261001-0901-bbbb", kind: "write-tests", worksOn: "UC-001", participant: "dev-a", results: "tests/release-a.test.mjs" }),
    "docs/jobs/JOB-20261001-0902-cccc.md": jobRecord({ id: "JOB-20261001-0902-cccc", kind: "write-tests", worksOn: "UC-001", participant: "dev-b", results: "tests/release-b.test.mjs" }),
    "docs/tests/counter-proofs/TST-756101.md": counterProof,
    "docs/tests/releases/v2026.3.0.md": priorReport,
  };
}
const RECORD = `docs/approvals/release-${TAG}-${gitBlob(REPORT_TEXT).slice(0, 12)}.md`;
// The default branch: the report and its approval record, which the tagged commit does not hold.
function headFiles() {
  return { "SPEC.md": SPEC, [REPORT]: REPORT_TEXT, [RECORD]: approvalOf(LIMITATIONS) };
}
// The instance's register, read as documents by the caller.
function registerOf(entries = [["docs/sources/SRC-vibe-coding.md", BOOK], ["docs/sources/SRC-iec-62304.md", IEC]]) {
  return entries.map(([path, text]) => readDocument(sourceSchemas().entry, path, text));
}
function resultFiles() {
  return {
    [`runs/${COMMIT}/a.md`]: run(COMMIT, [["TST-756101", "unit", "passed", ""], ["TST-756102", "release", "passed", ""], ["TST-756103", "release", "passed", ""],
      ["TST-756104", "unit", "passed", ""], ["TST-756105", "unit", "passed", "6 of 10"]]),
    [`runs/${COMMIT}/b.md`]: run(COMMIT, [["TST-756104", "unit", "failed", ""], ["TST-756106", "unit", "failed", ""]]),
    [`runs/${OLD}/old.md`]: run(OLD, [["TST-756105", "unit", "passed", "8 of 10"]]),
  };
}
const GATES = [{ requirement: PROCESS, gate: "Release testing", record: "docs/gates/20261010-release-testing.md" }];

// The call under test, with the parts of the fixture a case changes.
// Who accepted the report and when: the author and date of the commit that added the record, which the caller reads through
// MOD-repository-hosts' readHistory of the record's path.
const ACCEPTED = { person: "akmaier", date: "2026-10-12 08:30 UTC" };
function audit({ product = {}, head = {}, results = resultFiles(), gates = GATES, instanceSpec = INSTANCE_SPEC, register = registerOf(), accepted = ACCEPTED, unrecorded } = {}) {
  const files = { ...productFiles(), ...product };
  for (const [path, text] of Object.entries(files)) if (text === null) delete files[path];
  const headSide = { ...headFiles(), ...head };
  for (const [path, text] of Object.entries(headSide)) if (text === null) delete headSide[path];
  // The release's commit: COMMIT, written as a commit of this call's own wherever the fixture names it. MOD-trace-graph's storedGraph keeps a commit's
  // graph for the page, and the cases differ in their files, so no two calls share a commit. The branch trace-cache holds the graph of the release's
  // files as that commit's, as the workflow "main changed" stores it (tests/stored-graph-fake.mjs).
  const commit = createHash("sha1").update(`audit ${++audits}`).digest("hex");
  const own = (side) => Object.fromEntries(Object.entries(side).map(([path, text]) => [path.replaceAll(COMMIT, commit), text.replaceAll(COMMIT, commit)]));
  const [atFiles, resultSide, headOwn] = [own(files), own(results), own(headSide)];
  const at = { ...snapshotOf(atFiles, commit), readOn: storedGraphReadOn({ paths: Object.keys(atFiles), read: async (path) => atFiles[path] ?? null, commit }) };
  return auditRows(at, snapshotOf(resultSide, "test-results"), snapshotOf(headOwn, HEAD), { tag: TAG, commit },
    gates, instanceSpec, register, accepted, unrecorded);
}
let audits = 0;
const rowOf = (result, requirement) => result.rows.find((row) => row.requirement === requirement);

// TST-756001 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture at v2026.4.0 — five requirements of the product's SPEC and one process requirement of the instance's SPEC, whose gate the workflow holds
// input: auditRows(at, results, head, { tag, commit }, gates, instanceSpec, register)
// expect: six rows in the order the SPEC lists them, the process requirement last; the five product requirements constrain "product", the process requirement "process"
test("auditRows — one row per requirement valid at the release, product and process", async () => {
  const result = await audit();
  assert.deepEqual(result.rows.map((row) => [row.requirement, row.constrains]),
    [[R1, "product"], [R2, "product"], [R3, "product"], [R4, "product"], [R5, "product"], [PROCESS, "process"]]);
});

// TST-756002 · level: unit · module: MOD-release-evidence
// guards: A SOURCE DECLARES ITS AUTHORITY; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// given: the fixture; the first requirement names the book (advisory) and the standard (normative) in its source, the product links both
// input: auditRows(...); the sources of the rows of the first and the third requirement
// expect: the first row lists SRC-vibe-coding (advisory, 2026-10-05) and SRC-iec-62304 (normative, 2015), each with the version's hash then the SHA-256 of each of its files; no source is invented for the others' (all name the book once)
test("auditRows — a row's sources with authority, version and hashes", async () => {
  const result = await audit();
  assert.deepEqual(rowOf(result, R1).sources, [
    { id: "SRC-vibe-coding", authority: "advisory", version: "2026-10-05", hashes: [versionHash(BOOK_FILES), hex(BOOK_FILES[0][1])] },
    { id: "SRC-iec-62304", authority: "normative", version: "2015", hashes: [versionHash(IEC_FILES), hex(IEC_FILES[0][1])] },
  ]);
  assert.deepEqual(rowOf(result, R3).sources.map((source) => source.id), ["SRC-vibe-coding"]);
});

// TST-756003 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT
// given: the fixture; the first requirement is guarded by one unit test and two release tests; the fifth by a model-dependent test run 6 of 10; the second by a failing test; the counter-proof record exists for TST-756101 only
// input: auditRows(...); the tests of those rows
// expect: the first row lists TST-756101 (unit, passed, counter-proof docs/tests/counter-proofs/TST-756101.md, worse false, byImplementer false, passed true, no last rate), TST-756102 (release, passed, none, worse false, byImplementer true, passed true, no last rate) and TST-756103 (release, passed, none, worse false, byImplementer false, passed true, no last rate); the fifth row's test has the outcome "6 of 10"; the second's is "failed"
test("auditRows — a row's tests by level with outcome or rate and counter-proof", async () => {
  const result = await audit();
  assert.deepEqual(rowOf(result, R1).tests, [
    { id: "TST-756101", level: "unit", outcome: "passed", counterProof: "docs/tests/counter-proofs/TST-756101.md", worse: false, byImplementer: false, passed: true, lastRate: null },
    { id: "TST-756102", level: "release", outcome: "passed", counterProof: null, worse: false, byImplementer: true, passed: true, lastRate: null },
    { id: "TST-756103", level: "release", outcome: "passed", counterProof: null, worse: false, byImplementer: false, passed: true, lastRate: null },
  ]);
  assert.deepEqual(rowOf(result, R5).tests.map((t) => [t.id, t.outcome]), [["TST-756105", "6 of 10"]]);
  assert.deepEqual(rowOf(result, R2).tests.map((t) => [t.id, t.outcome]), [["TST-756106", "failed"]]);
});

// TST-1163001 · level: unit · module: MOD-release-evidence
// guards: UC-030; THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture; TST-756105 runs 6 of 10 after 8 of 10 at the preceding release, and TST-756102 is the release test written by the requirement's implementer
// input: auditRows(...); the row tests for the fifth and first requirements
// expect: TST-756105 is worse true and byImplementer false; TST-756102 is worse false and byImplementer true
// Planted fault: omitting a provider flag, or assigning it from a different row or test, fails.
test("TST-1163001 auditRows returns worse and byImplementer on the row tests they describe", async () => {
  const result = await audit();
  assert.deepEqual(rowOf(result, R5).tests.map(({ id, worse, byImplementer }) => ({ id, worse, byImplementer })),
    [{ id: "TST-756105", worse: true, byImplementer: false }]);
  assert.deepEqual(rowOf(result, R1).tests.filter(({ id }) => id === "TST-756102").map(({ id, worse, byImplementer }) => ({ id, worse, byImplementer })),
    [{ id: "TST-756102", worse: false, byImplementer: true }]);
});

// TST-1163003 · level: unit · module: MOD-release-evidence
// guards: UC-030; THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: TST-756102 guards both the first and second requirements; its writer implemented only the first
// input: auditRows(...); the shared test in each requirement row and summary.byImplementer
// expect: the first row says true, the second says false, and the distinct-test summary is one
// Planted fault: carrying a test flag from one requirement row to another fails.
test("TST-1163003 auditRows keeps shared release-test implementer provenance on its own requirement row", async () => {
  const shared = declaration("TST-756102", "release", `${R1}; ${R2}`, "system");
  const result = await audit({ product: { "tests/release-a.test.mjs": shared } });
  assert.deepEqual([rowOf(result, R1), rowOf(result, R2)].map((row) => row.tests.find((test) => test.id === "TST-756102").byImplementer), [true, false]);
  assert.equal(result.summary.byImplementer, 1);
});

// TST-1430001 · level: unit · module: MOD-release-evidence
// guards: A MODEL-DEPENDENT TEST IS MEASURED AS A RATE; UC-030
// given: the fixture, where the model-dependent TST-756105 passed 6 of 10 on the release commit against 8 of 10 at the last release; then the same with the last release's record at 5 of 10; the deterministic TST-756101 passed, TST-756106 failed and TST-756104 is flaky
// input: auditRows(...); the tests of the fifth, first, second and fourth rows
// expect: known positive — TST-756105's outcome stays its rate, "6 of 10", in both; first its last rate "8 of 10", worse true and passed false; then its last rate "5 of 10", worse false and passed true; TST-756101, 756102 and 756103 passed true with no last rate; TST-756106 and TST-756104 passed false with no last rate
// counter-proof: a passed taken from the outcome alone makes the worse TST-756105 pass and fails the first deepEqual; a lastRate taken from the release commit's rate gives "6 of 10" and fails it too
test("TST-1430001 auditRows — a model-dependent test names its rate, the last release's rate and whether it passed", async () => {
  const pick = (test) => [test.id, test.outcome, test.lastRate, test.worse, test.passed];
  assert.deepEqual(rowOf(await audit(), R5).tests.map(pick), [["TST-756105", "6 of 10", "8 of 10", true, false]]);
  const better = await audit({ results: { ...resultFiles(), [`runs/${OLD}/old.md`]: run(OLD, [["TST-756105", "unit", "passed", "5 of 10"]]) } });
  assert.deepEqual(rowOf(better, R5).tests.map(pick), [["TST-756105", "6 of 10", "5 of 10", false, true]]);
  assert.deepEqual([R1, R2, R4].map((name) => rowOf(better, name).tests.map((test) => [test.id, test.lastRate, test.passed])),
    [[["TST-756101", null, true], ["TST-756102", null, true], ["TST-756103", null, true]], [["TST-756106", null, false]], [["TST-756104", null, false]]]);
});

// TST-1430002 · level: unit · module: MOD-release-evidence
// guards: A MODEL-DEPENDENT TEST IS MEASURED AS A RATE; THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture where TST-756105 passed 6 of 10 against 5 of 10 at the last release; and the fixture where it did not complete its runs on the release commit — its record "not run", 3 of 10 — against 2 of 10 at the last release
// input: auditRows(...); summary.passing and summary.notPassed beside the rows whose tests all have passed true
// expect: known positive — the first counts passing 2, A FIRST RULE and A FIFTH RULE, exactly the rows whose tests all passed; the not-run fixture gives TST-756105 the outcome "3 of 10", passed false and worse false, and counts passing 1 (A FIRST RULE, the one row whose tests all passed) and notPassed 2
// counter-proof: a passed true for a model-dependent test whose run did not complete counts A FIFTH RULE among the rows whose tests all passed and fails the last deepEqual
test("TST-1430002 auditRows — the rows the passing count counts are told from their tests' passed, and a model-dependent test that did not run has not passed", async () => {
  const passedRows = (result) => result.rows.filter((row) => row.tests.length && row.tests.every((test) => test.passed)).map((row) => row.requirement);
  const better = await audit({ results: { ...resultFiles(), [`runs/${OLD}/old.md`]: run(OLD, [["TST-756105", "unit", "passed", "5 of 10"]]) } });
  assert.deepEqual([better.summary.passing, passedRows(better)], [2, [R1, R5]], "known positive");
  const results = { ...resultFiles(), [`runs/${OLD}/old.md`]: run(OLD, [["TST-756105", "unit", "passed", "2 of 10"]]) };
  results[`runs/${COMMIT}/a.md`] = run(COMMIT, [["TST-756101", "unit", "passed", ""], ["TST-756102", "release", "passed", ""], ["TST-756103", "release", "passed", ""],
    ["TST-756104", "unit", "passed", ""], ["TST-756105", "unit", "not run", "3 of 10"]]);
  const notRun = await audit({ results });
  assert.deepEqual(rowOf(notRun, R5).tests.map((test) => [test.outcome, test.passed, test.worse]), [["3 of 10", false, false]]);
  assert.deepEqual([notRun.summary.passing, passedRows(notRun), notRun.summary.notPassed], [1, [R1], 2]);
});

// TST-756004 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture; the process requirement's gate record is docs/gates/20261010-release-testing.md; a product requirement has none
// input: auditRows(...), the rows of the process requirement and of the first requirement
// expect: the process row carries the gate record; the first row's gates are empty; the process requirement's source (the book) is listed too
test("auditRows — a process requirement's row holds the gate records it is given", async () => {
  const result = await audit();
  assert.deepEqual(rowOf(result, PROCESS).gates, ["docs/gates/20261010-release-testing.md"]);
  assert.deepEqual(rowOf(result, R1).gates, []);
  assert.deepEqual(rowOf(result, PROCESS).sources.map((source) => source.id), ["SRC-vibe-coding"]);
});

// TST-1431001 · level: unit · module: MOD-release-evidence
// guards: A PROCESS REQUIREMENT ADDS TO THE MODEL; UC-030
// given: the fixture, whose caller gives the gate of the process requirement with its record docs/gates/20261010-release-testing.md and the artifacts its gate asks for, "SPEC.md"
// input: auditRows(...), the rows of the process requirement and of the first requirement
// expect: known positive — the process row's gates stay the record, ["docs/gates/20261010-release-testing.md"]; its artifacts are ["SPEC.md"], one for each record in the order of the records; the first row's artifacts are empty
// counter-proof: an auditRows that keeps the record only and drops the gate's artifacts gives the process row no artifacts and fails the second deepEqual
test("TST-1431001 auditRows — a process requirement's row names the artifacts its gate asked for beside the gate record", async () => {
  const result = await audit({ gates: GATES.map((gate) => ({ ...gate, artifacts: "SPEC.md" })) });
  assert.deepEqual(rowOf(result, PROCESS).gates, ["docs/gates/20261010-release-testing.md"], "known positive: the record");
  assert.deepEqual(rowOf(result, PROCESS).artifacts, ["SPEC.md"]);
  assert.deepEqual(rowOf(result, R1).artifacts, []);
});

// TST-1433001 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; UC-030
// given: the fixture, whose instance's SPEC holds the process requirement A PROCESS RULE; the caller gives no gate record for it, and gives its gate "Release testing" among the gates the workflow holds without a record
// input: auditRows(..., gates [], ..., accepted, unrecorded [{ requirement: A PROCESS RULE, gate: "Release testing" }]); then, as known positive, auditRows with the fixture's gate record and no unrecorded gate
// expect: known positive — with the record, the process row's gates are [docs/gates/20261010-release-testing.md] and its unrecorded gates []; without it, the process row still stands, constrains "process", has gates [], unrecorded ["Release testing"] and no test, and is counted among the requirements without a test (noTest 2); a product row's unrecorded gates are []
// counter-proof: an auditRows that takes the process rows from `gates` alone gives no process row without the record and fails the second assertion
test("TST-1433001 auditRows — a process requirement whose gate no record holds still has its row, which names that gate as one no record holds", async () => {
  const recorded = await audit();
  assert.deepEqual(rowOf(recorded, PROCESS).gates, ["docs/gates/20261010-release-testing.md"], "known positive: the recorded gate");
  const result = await audit({ gates: [], unrecorded: [{ requirement: PROCESS, gate: "Release testing" }] });
  const process = rowOf(result, PROCESS);
  assert.ok(process, "the process requirement has its row");
  assert.deepEqual([process.constrains, process.gates, process.unrecorded, process.tests], ["process", [], ["Release testing"], []]);
  assert.equal(result.summary.noTest, 2);
  assert.deepEqual([rowOf(recorded, PROCESS).unrecorded, rowOf(result, R1).unrecorded], [[], []]);
});

// TST-756005 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture: first requirement all tests passed; second a failing test; third no test; fourth a test recorded both passing and failing on the commit; fifth a rate of 6 of 10 against 8 of 10 at the last release; the process requirement no test
// input: auditRows(...).summary
// expect: passing 1, noTest 2 (the third and the process requirement), notPassed 1, flaky 1, worse 1, byImplementer 1, accepted true
test("auditRows — the summary counts passing, no test, not passed, flaky and worse requirements", async () => {
  const { summary } = await audit();
  assert.deepEqual([summary.passing, summary.noTest, summary.notPassed, summary.flaky, summary.worse, summary.byImplementer, summary.accepted],
    [1, 2, 1, 1, 1, 1, true]);
});

// TST-756006 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture; the third requirement is guarded by no test at any level
// input: auditRows(...)
// expect: the third requirement has a row with no tests and no gates; it is counted in noTest, and the rows number all six requirements
test("auditRows — a requirement without a test has a row and is counted", async () => {
  const result = await audit();
  assert.equal(result.rows.length, 6);
  assert.deepEqual(rowOf(result, R3).tests, []);
  assert.equal(result.summary.noTest, 2);
});

// TST-756007 · level: unit · module: MOD-release-evidence
// guards: RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
// given: the job ledger of the fixture — dev-a implemented ITM-900, which realises the first requirement, and wrote TST-756102's file; dev-b wrote TST-756103's file
// input: auditRows(...).summary.byImplementer; then the same with the job that wrote tests/release-a.test.mjs done by dev-c
// expect: 1 (only TST-756102); then 0
test("auditRows — a release test whose author is the implementer by the job ledger is counted", async () => {
  assert.equal((await audit()).summary.byImplementer, 1);
  const other = jobRecord({ id: "JOB-20261001-0901-bbbb", kind: "write-tests", worksOn: "UC-001", participant: "dev-c", results: "tests/release-a.test.mjs" });
  assert.equal((await audit({ product: { "docs/jobs/JOB-20261001-0901-bbbb.md": other } })).summary.byImplementer, 0);
});

// TST-756008 · level: unit · module: MOD-release-evidence
// guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED
// given: the fixture, whose default branch holds the report and an approval record naming its blob and two limitations; then the same with the report's text changed after it was accepted; then with no approval record
// input: auditRows(...).summary
// expect: accepted true with the two limitations as recorded, in order; accepted false for the changed report (UC-030 2a), and summary.limitations names that no approval record names its current text; the same for the missing record
test("auditRows — whether the report is accepted, and the limitations of an accepted one", async () => {
  const accepted = (await audit()).summary;
  assert.equal(accepted.accepted, true);
  assert.deepEqual(accepted.limitations, LIMITATIONS);
  const changed = (await audit({ head: { [REPORT]: `${REPORT_TEXT}Changed afterwards.\n` } })).summary;
  assert.equal(changed.accepted, false);
  assert.match(changed.limitations.join("\n"), /approval record/);
  const missing = (await audit({ head: { [RECORD]: null } })).summary;
  assert.equal(missing.accepted, false);
  assert.match(missing.limitations.join("\n"), /approval record/);
});

// TST-757001 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; AN APPROVAL NAMES THE EXACT TEXT
// given: the fixture, whose default branch holds the report and the one approval record that names its blob; the caller passes who accepted and when
// input: auditRows(..., accepted).evidence
// expect: the report with its path `docs/tests/releases/v2026.4.0.md` and its blob; the approval records that name it, each with its path and its own blob; the acceptance — the person and date given, and the blob the record names, which is the report's
// counter-proof: reading the report's blob from `at` (the tagged commit, which holds no report) gives null and fails the first assertion
test("TST-757001 auditRows — the evidence: the report, the approval records that name it, and who accepted the text", async () => {
  const { evidence } = await audit();
  assert.deepEqual(evidence.report, { path: REPORT, blob: gitBlob(REPORT_TEXT) });
  assert.deepEqual(evidence.records, [{ path: RECORD, blob: gitBlob(approvalOf(LIMITATIONS)) }]);
  assert.deepEqual(evidence.acceptance, { person: "akmaier", date: "2026-10-12 08:30 UTC", blob: gitBlob(REPORT_TEXT) });
});

// TST-757002 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture, whose default branch holds no release test report and no record (the result records of the commit are there, so the release is not one before Agent M's)
// input: auditRows(...)
// expect: evidence.report null, no records, acceptance null; summary.limitations names the report that is missing, by its path
test("TST-757002 auditRows — no report on the default branch gives report null and names what is missing", async () => {
  const result = await audit({ head: { [REPORT]: null, [RECORD]: null } });
  assert.deepEqual([result.evidence.report, result.evidence.records, result.evidence.acceptance], [null, [], null]);
  assert.equal(result.summary.limitations.length, 1);
  assert.ok(result.summary.limitations[0].includes(REPORT));
});

// TST-757003 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; AN APPROVAL NAMES THE EXACT TEXT
// given: the fixture with the report and no approval record; then the report's text changed after it was accepted, the old record still there
// input: auditRows(...).evidence
// expect: in both cases the report is given with its current blob, acceptance is null, and summary.limitations names the blob that no record names; records: none in the first case, and in the second the old record, which still names the report (the acceptance alone is bound to the current blob)
test("TST-757003 auditRows — no approval record names the report's current text: acceptance null, and the gap is named", async () => {
  const missing = await audit({ head: { [RECORD]: null } });
  const changed = await audit({ head: { [REPORT]: `${REPORT_TEXT}Changed afterwards.\n` } });
  const old = [{ path: RECORD, blob: gitBlob(approvalOf(LIMITATIONS)) }];
  for (const [result, blob, records] of [[missing, gitBlob(REPORT_TEXT), []], [changed, gitBlob(`${REPORT_TEXT}Changed afterwards.\n`), old]]) {
    assert.deepEqual(result.evidence.report, { path: REPORT, blob });
    assert.deepEqual([result.evidence.records, result.evidence.acceptance], [records, null]);
    assert.ok(result.summary.limitations.some((line) => line.includes(blob)), result.summary.limitations.join("\n"));
  }
});

// TST-757004 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture, with the record of the accepted report, beside it an approval record of an earlier release (another tag, another report) and a second record of this release that names the same report with another blob
// input: auditRows(...).evidence.records
// expect: the two records that name this report, in the order of their paths; the record of the earlier release is not listed
test("TST-757004 auditRows — every approval record that names this report is evidence, and no other", async () => {
  const second = `docs/approvals/release-${TAG}-aaaaaaaaaaaa.md`;
  const { evidence } = await audit({ head: {
    "docs/approvals/release-v2026.3.0-bbbbbbbbbbbb.md": approvalOf([]).replace(gitBlob(REPORT_TEXT), "b".repeat(40)).replace(REPORT, "docs/tests/releases/v2026.3.0.md"),
    [second]: approvalOf(["TST-756104 — flaky"]).replace(gitBlob(REPORT_TEXT), "a".repeat(40)),
  } });
  assert.deepEqual(evidence.records.map((record) => record.path), [RECORD, second]);
});

// TST-757009 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; AN APPROVAL NAMES THE EXACT TEXT
// given: the fixture whose report was changed after it was accepted: the one record names the report's earlier text
// input: auditRows(...).evidence
// expect: records lists that record with its own blob — it names the report — while acceptance is null, since no record names the current text
// counter-proof: keeping only the records of the current blob gives [] and fails the first assertion
test("TST-757009 auditRows — a report changed after acceptance still lists the records that name it", async () => {
  const { evidence } = await audit({ head: { [REPORT]: `${REPORT_TEXT}Changed afterwards.\n` } });
  assert.deepEqual(evidence.records, [{ path: RECORD, blob: gitBlob(approvalOf(LIMITATIONS)) }]);
  assert.equal(evidence.acceptance, null);
});

// TST-757005 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture with the record of the accepted report, but the caller gives no author and date (accepted null)
// input: auditRows(..., null).evidence.acceptance
// expect: null, and summary.limitations names the record whose commit was not given; the report is still accepted (summary.accepted true) and the recorded limitations are still listed
test("TST-757005 auditRows — an accepted report whose commit the caller did not give has acceptance null, named", async () => {
  const result = await audit({ accepted: null });
  assert.equal(result.evidence.acceptance, null);
  assert.equal(result.summary.accepted, true);
  assert.ok(result.summary.limitations.some((line) => line.includes(RECORD)));
  assert.deepEqual(result.summary.limitations.filter((line) => LIMITATIONS.includes(line)), LIMITATIONS);
});

// TST-757006 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: a release before Agent M's records (no result record, no report, no record)
// input: auditRows(...)
// expect: evidence.report null, no records, acceptance null — and summary.limitations the two "cannot be derived" lines as before, no third
test("TST-757006 auditRows — a release before Agent M's records has empty evidence and no further limitation", async () => {
  const old = await audit({ results: {}, head: { [REPORT]: null, [RECORD]: null } });
  assert.deepEqual([old.evidence.report, old.evidence.records, old.evidence.acceptance], [null, [], null]);
  assert.equal(old.summary.limitations.length, 2);
});

// TST-757007 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; ARTIFACTS ARE MARKDOWN; THE PRODUCT REPOSITORY IS SELF-SUFFICIENT
// given: the audit of the fixture release, as auditRows gives it
// input: auditDocument(audit, { tag, commit })
// expect: the document names the tag and the commit, the report's blob, the record's path and blob, the acceptance (person, date, blob), every requirement, and for each source of a row the version's hash and the hash of each of its files
// counter-proof: an auditDocument that leaves out `evidence`, or the hashes of a source, fails the includes below
test("TST-757007 auditDocument — the document of the fixture audit holds what a reader needs to check it in the repository", async () => {
  const result = await audit();
  const text = auditDocument(result, { tag: TAG, commit: COMMIT });
  for (const part of [TAG, COMMIT, REPORT, gitBlob(REPORT_TEXT), RECORD, gitBlob(approvalOf(LIMITATIONS)), "akmaier", "2026-10-12 08:30 UTC",
    ...result.rows.map((row) => row.requirement), versionHash(BOOK_FILES), hex(BOOK_FILES[0][1]), versionHash(IEC_FILES), hex(IEC_FILES[0][1]),
    ...LIMITATIONS]) {
    assert.ok(text.includes(part), `the document lacks ${part}`);
  }
  assert.ok(!/https?:\/\//.test(text), "no address");
});

// TST-934005 · level: unit · module: MOD-release-evidence
// guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture, whose default branch holds the report and the approval record of a green release — the record as acceptAndRelease writes it, with no `limitation` line
// input: auditRows(...).summary
// expect: accepted true and no limitations — auditRows is a caller of the record, and a record without the key reads as none
// counter-proof: with the report's text changed after it was accepted, the same record no longer accepts it (accepted false), so the case does not pass for want of a check
test("TST-934005 auditRows — the record of a green release, with no limitation line, is an accepted report with no limitations", async () => {
  const green = writeDocument(approvalSchema, { fields: { kind: "release-report", file: REPORT, blob: gitBlob(REPORT_TEXT) } });
  assert.equal(green.includes("limitation"), false);
  const accepted = (await audit({ head: { [RECORD]: green } })).summary;
  assert.deepEqual([accepted.accepted, accepted.limitations], [true, []]);
  const changed = (await audit({ head: { [RECORD]: green, [REPORT]: `${REPORT_TEXT}Changed afterwards.\n` } })).summary;
  assert.equal(changed.accepted, false);
  assert.match(changed.limitations.join("\n"), /approval record/);
});

// TST-756009 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: a release before Agent M's records — the branch test-results holds no record of the commit and the tag holds no release test report; the SPEC and tests are there
// input: auditRows(...) with the known positive first (the full fixture lists no "cannot be derived")
// expect: every test's outcome reads "cannot be derived", accepted false, summary.limitations says which parts cannot be derived (the outcomes, the acceptance), the rows are still there
test("auditRows — a release before Agent M's records says which parts cannot be derived", async () => {
  const full = await audit();
  assert.ok(full.summary.limitations.every((line) => !line.startsWith("cannot be derived")));
  const old = await audit({ results: {}, head: { [REPORT]: null, [RECORD]: null } });
  assert.equal(old.rows.length, 6);
  assert.deepEqual(rowOf(old, R1).tests.map((t) => t.outcome), ["cannot be derived", "cannot be derived", "cannot be derived"]);
  assert.equal(old.summary.accepted, false);
  assert.deepEqual(old.summary.limitations.filter((line) => line.startsWith("cannot be derived")).length, 2);
  assert.match(old.summary.limitations.join("\n"), /outcomes/);
  assert.match(old.summary.limitations.join("\n"), /acceptance/);
});

// TST-756010 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture, where the tagged commit holds no report and no record, and the default branch holds both; then the report and its record placed in the tagged commit instead, the default branch holding neither
// input: auditRows(...).summary.accepted
// expect: true for the first; false for the second — the acceptance is read from the default branch `head`, where acceptAndRelease commits it, never from the tagged commit
test("auditRows — the report and its approval record are read on the default branch, not at the tag", async () => {
  assert.equal((await audit()).summary.accepted, true);
  const misplaced = await audit({ head: { [REPORT]: null, [RECORD]: null }, product: { [REPORT]: REPORT_TEXT, [RECORD]: approvalOf(LIMITATIONS) } });
  assert.equal(misplaced.summary.accepted, false);
});

// TST-756011 · level: unit · module: MOD-release-evidence
// guards: A SOURCE DECLARES ITS AUTHORITY; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// given: the fixture whose product links both sources, and a register passed in that holds only the book's entry
// input: auditRows(..., register) — the sources of the first requirement
// expect: only SRC-vibe-coding, with its authority and hashes — a source is resolved against the register given, and one it does not hold is not listed
test("auditRows — a source is resolved against the register it is given", async () => {
  const result = await audit({ register: registerOf([["docs/sources/SRC-vibe-coding.md", BOOK]]) });
  assert.deepEqual(rowOf(result, R1).sources.map((source) => source.id), ["SRC-vibe-coding"]);
});

// TST-1430003 · level: unit · module: MOD-release-evidence
// guards: A MODEL-DEPENDENT TEST IS MEASURED AS A RATE; UC-030
// given: the audit of the fixture, where TST-756105 passed 6 of 10 against 8 of 10 at the last release (worse); and the same with the last release at 5 of 10
// input: auditDocument(auditRows(...), { tag, commit }); the lines of TST-756105 and of TST-756101
// expect: known positive — TST-756101's line still reads "(unit): passed; counter-proof"; TST-756105's line ends "(unit): 6 of 10, against 8 of 10 at the last release, not passed; no counter-proof", and with the last release at 5 of 10 "(unit): 6 of 10, against 5 of 10 at the last release, passed; no counter-proof"
// counter-proof: a document that writes the outcome alone loses "against 8 of 10" and fails the second assertion
test("TST-1430003 auditDocument — a model-dependent test's line names its rate, the last release's rate and whether it passed", async () => {
  const lineOf = (text, id) => text.split("\n").find((line) => line.includes(`\`${id}\``));
  const worse = auditDocument(await audit(), { tag: TAG, commit: COMMIT });
  assert.ok(lineOf(worse, "TST-756101").includes("(unit): passed; counter-proof"), lineOf(worse, "TST-756101"));
  assert.ok(lineOf(worse, "TST-756105").endsWith("(unit): 6 of 10, against 8 of 10 at the last release, not passed; no counter-proof"), lineOf(worse, "TST-756105"));
  const better = auditDocument(await audit({ results: { ...resultFiles(), [`runs/${OLD}/old.md`]: run(OLD, [["TST-756105", "unit", "passed", "5 of 10"]]) } }), { tag: TAG, commit: COMMIT });
  assert.ok(lineOf(better, "TST-756105").endsWith("(unit): 6 of 10, against 5 of 10 at the last release, passed; no counter-proof"), lineOf(better, "TST-756105"));
});

// ================================================================== auditDocument (ITM-757)
// The audit below is a fixture written out in this section, in the shape auditRows gives; its names stand in a block of their own.
{
const TAG = "v2026.4.0", COMMIT = "c".repeat(40);
const REPORT_BLOB = "1234567890abcdef1234567890abcdef12345678", RECORD_BLOB = "fedcba0987654321fedcba0987654321fedcba09";
const REPORT = `docs/tests/releases/${TAG}.md`, RECORD = `docs/approvals/release-${TAG}-${REPORT_BLOB.slice(0, 12)}.md`;
const BOOK_VERSION_HASH = "b".repeat(64), BOOK_FILE_HASH = "d".repeat(64), IEC_VERSION_HASH = "e".repeat(64), IEC_FILE_HASH = "f".repeat(64);
const FIRST = "A FIRST RULE", NO_TEST = "A RULE NO TEST GUARDS", FLAKY = "A RULE WHOSE TEST FAILED", PROCESS = "A PROCESS RULE";
const LIMITATION = "TST-756104 — flaky on the CI runner";

const AUDIT = {
  summary: { passing: 1, noTest: 1, notPassed: 1, flaky: 1, worse: 0, byImplementer: 2, accepted: true, limitations: [LIMITATION] },
  rows: [
    { requirement: FIRST, constrains: "product",
      sources: [
        { id: "SRC-vibe-coding", authority: "advisory", version: "2026-10-05", hashes: [BOOK_VERSION_HASH, BOOK_FILE_HASH] },
        { id: "SRC-iec-62304", authority: "normative", version: "2015", hashes: [IEC_VERSION_HASH, IEC_FILE_HASH] }],
      tests: [{ id: "TST-756101", level: "unit", outcome: "passed", counterProof: "docs/tests/counter-proofs/TST-756101.md" },
        { id: "TST-756102", level: "release", outcome: "8 of 10", counterProof: null }],
      gates: [] },
    { requirement: NO_TEST, constrains: "product", sources: [], tests: [], gates: [] },
    { requirement: FLAKY, constrains: "product", sources: [{ id: "SRC-vibe-coding", authority: "advisory", version: "2026-10-05", hashes: [BOOK_VERSION_HASH] }],
      tests: [{ id: "TST-756106", level: "unit", outcome: "failed", counterProof: null }], gates: [] },
    { requirement: PROCESS, constrains: "process", sources: [], tests: [],
      gates: ["docs/gates/20261010-release-testing.md"] },
  ],
  evidence: {
    report: { path: REPORT, blob: REPORT_BLOB },
    records: [{ path: RECORD, blob: RECORD_BLOB }],
    acceptance: { person: "akmaier", date: "2026-10-12 08:30 UTC", blob: REPORT_BLOB },
  },
};
const document = (audit = AUDIT) => auditDocument(audit, { tag: TAG, commit: COMMIT });

// TST-757101 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; ARTIFACTS ARE MARKDOWN
// given: the fixture audit of the release v2026.4.0 at the commit of forty c's
// input: auditDocument(audit, { tag, commit })
// expect: a string of Markdown that begins with a front matter naming the tag and the commit, then a heading, and that names the tag and the full commit SHA
// counter-proof: a document that names the tag only, or shortens the SHA, fails the includes
test("TST-757101 auditDocument — one Markdown document naming the release tag and its full commit SHA", () => {
  const text = document();
  assert.equal(typeof text, "string");
  assert.ok(text.startsWith(`---\ntag: ${TAG}\ncommit: ${COMMIT}\n---\n`), text.slice(0, 120));
  assert.match(text, /^# .*v2026\.4\.0/m);
  assert.ok(text.endsWith("\n"));
});

// TST-757102 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture audit, with the summary counts 1, 1, 1, 1, 0 and 2, accepted, and one limitation
// input: auditDocument(audit, release)
// expect: the document holds the summary — each of its six counts with its label, whether the report is accepted, and the limitation as recorded
test("TST-757102 auditDocument — the summary with its counts and limitations", () => {
  const text = document();
  const summary = text.slice(text.indexOf("## Summary"), text.indexOf("## Evidence"));
  assert.ok(summary.length > 0);
  for (const label of [/passing evidence: 1\b/i, /without a test: 1\b/i, /did not pass: 1\b/i, /flaky test: 1\b/i, /worse than the previous release: 0\b/i,
    /written by the implementer: 2\b/i, /accepted: yes/i]) assert.match(summary, label);
  assert.ok(summary.includes(LIMITATION));
});

// TST-757103 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; A SOURCE DECLARES ITS AUTHORITY; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// given: the fixture audit with four rows — a product requirement with two sources and two tests, one with no test, one with a failed test, a process requirement with a gate record
// input: auditDocument(audit, release)
// expect: under `## Requirements`, one section per row in the audit's order; each holds what the requirement constrains; each source with its identifier, authority, version and every hash; each test with its identifier, level, outcome and counter-proof (the path, or none); the gate record of the process requirement
// counter-proof: a document that lists only the requirements that have tests loses the "no test" row and fails the section count
test("TST-757103 auditDocument — every row with its sources, tests and gate records", () => {
  const text = document();
  const rows = text.slice(text.indexOf("## Requirements")).split(/^### /m).slice(1);
  assert.deepEqual(rows.map((row) => row.split("\n")[0]), [FIRST, NO_TEST, FLAKY, PROCESS]);
  const [first, none, failed, process] = rows;
  assert.match(first, /constrains[^\n]*product/i);
  for (const part of ["SRC-vibe-coding", "advisory", "2026-10-05", BOOK_VERSION_HASH, BOOK_FILE_HASH, "SRC-iec-62304", "normative", "2015", IEC_VERSION_HASH, IEC_FILE_HASH]) {
    assert.ok(first.includes(part), `the first row lacks ${part}`);
  }
  assert.match(first, /TST-756101[^\n]*unit[^\n]*passed[^\n]*docs\/tests\/counter-proofs\/TST-756101\.md/);
  assert.match(first, /TST-756102[^\n]*release[^\n]*8 of 10[^\n]*no counter-proof/i);
  assert.match(none, /no test/i);
  assert.match(failed, /TST-756106[^\n]*unit[^\n]*failed/);
  assert.match(process, /constrains[^\n]*process/i);
  assert.ok(process.includes("docs/gates/20261010-release-testing.md"));
});

// TST-1431002 · level: unit · module: MOD-release-evidence
// guards: A PROCESS REQUIREMENT ADDS TO THE MODEL; THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture audit whose process row holds the gate record docs/gates/20261010-release-testing.md and the artifacts its gate asked for, "SPEC.md"; the other rows hold none
// input: auditDocument(audit, release)
// expect: known positive — the process requirement's section keeps its gate record line; it holds a line naming the gate's artifacts SPEC.md; no other section names artifacts
// counter-proof: a document that writes the gate records alone leaves SPEC.md out of the process section and fails the match
test("TST-1431002 auditDocument — a process requirement's section names the artifacts its gate asked for", () => {
  const text = document({ ...AUDIT, rows: AUDIT.rows.map((row) => (row.requirement === PROCESS ? { ...row, artifacts: ["SPEC.md"] } : row)) });
  const rows = text.slice(text.indexOf("## Requirements")).split(/^### /m).slice(1);
  const process = rows.find((row) => row.startsWith(PROCESS));
  assert.ok(process.includes("docs/gates/20261010-release-testing.md"), "known positive: the gate record");
  assert.match(process, /^- [^\n]*artifacts[^\n]*SPEC\.md/im);
  assert.deepEqual(rows.filter((row) => !row.startsWith(PROCESS) && /artifacts/i.test(row)), []);
});

// TST-1433002 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; THE PRODUCT REPOSITORY IS SELF-SUFFICIENT
// given: the fixture audit, and the same audit whose process row holds no gate record and names the gate "Release testing" as one no record holds (gates [], unrecorded ["Release testing"]); the other rows name no such gate
// input: auditDocument(audit, release) of each
// expect: known positive — with the fixture's gate record the process section holds its "Gate record" line and no line saying no record holds a gate; without it the process section holds a line naming the gate Release testing and that no record holds it, and no "Gate record" line; no other section says no record holds a gate
// counter-proof: a document that writes the gate records alone leaves the process section without the line and fails the match
test("TST-1433002 auditDocument — a process requirement's section says that no record holds its gate", () => {
  const sections = (text) => text.slice(text.indexOf("## Requirements")).split(/^### /m).slice(1);
  const recorded = sections(document()).find((row) => row.startsWith(PROCESS));
  assert.ok(recorded.includes("Gate record") && !/no record holds/i.test(recorded), "known positive: the recorded gate");
  const rows = sections(document({ ...AUDIT, rows: AUDIT.rows.map((row) => (row.requirement === PROCESS ? { ...row, gates: [], unrecorded: ["Release testing"] } : row)) }));
  const process = rows.find((row) => row.startsWith(PROCESS));
  assert.match(process, /^- [^\n]*Release testing[^\n]*no record holds/im);
  assert.ok(!process.includes("Gate record"), "no gate record is named");
  assert.deepEqual(rows.filter((row) => !row.startsWith(PROCESS) && /no record holds/i.test(row)), []);
});

// TST-757104 · level: unit · module: MOD-release-evidence
// guards: AN APPROVAL NAMES THE EXACT TEXT; THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON
// given: the fixture audit whose evidence holds the report with its blob, one approval record with its blob, and the acceptance (who, when, the blob of the accepted text)
// input: auditDocument(audit, release)
// expect: under `## Evidence`, the report's path and blob; the record's path and blob; the acceptance with the person, the date and the blob of the accepted text
// counter-proof: a document without the evidence fails every includes
test("TST-757104 auditDocument — the blob SHAs of the report and the approval records, and the acceptance", () => {
  const text = document();
  const evidence = text.slice(text.indexOf("## Evidence"), text.indexOf("## Requirements"));
  for (const part of [REPORT, REPORT_BLOB, RECORD, RECORD_BLOB, "akmaier", "2026-10-12 08:30 UTC"]) assert.ok(evidence.includes(part), `the evidence lacks ${part}`);
  assert.match(evidence, /accepted text[^\n]*`?1234567890abcdef1234567890abcdef12345678/i);
});

// TST-757105 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: an audit of a release whose report has not been accepted: accepted false, no records, acceptance null, the report there, and the limitations naming the missing record
// input: auditDocument(audit, release)
// expect: the summary says the report is not accepted, the evidence says no approval record names the report and who accepted is not given, and each row says its evidence is not accepted (UC-030, 2a)
test("TST-757105 auditDocument — a report that is not accepted is said so at the top and in every row", () => {
  const text = document({ ...AUDIT,
    summary: { ...AUDIT.summary, accepted: false, limitations: ["missing: approval record naming blob 1234567890abcdef1234567890abcdef12345678"] },
    evidence: { report: AUDIT.evidence.report, records: [], acceptance: null } });
  assert.match(text.slice(text.indexOf("## Summary"), text.indexOf("## Evidence")), /accepted: no/i);
  assert.match(text.slice(text.indexOf("## Evidence"), text.indexOf("## Requirements")), /not accepted/i);
  const rows = text.slice(text.indexOf("## Requirements")).split(/^### /m).slice(1);
  assert.equal(rows.length, 4);
  for (const row of rows) assert.match(row, /evidence not accepted/i);
  assert.ok(!document().includes("evidence not accepted"), "the accepted audit says nothing of the kind");
});

// TST-757106 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: an audit with no report (evidence.report null, no records, acceptance null)
// input: auditDocument(audit, release)
// expect: the evidence says there is no release test report on the default branch; the document still holds every row
test("TST-757106 auditDocument — an audit with no report says so and keeps its rows", () => {
  const text = document({ ...AUDIT, evidence: { report: null, records: [], acceptance: null } });
  assert.match(text.slice(text.indexOf("## Evidence"), text.indexOf("## Requirements")), /no release test report/i);
  assert.equal(text.slice(text.indexOf("## Requirements")).split(/^### /m).length - 1, 4);
});

// TST-757107 · level: unit · module: MOD-release-evidence
// guards: THE PRODUCT REPOSITORY IS SELF-SUFFICIENT; ARTIFACTS ARE MARKDOWN
// given: the fixture audit
// input: auditDocument(audit, release)
// expect: the document holds no web address and does not name Agent M's dashboard, so that no statement can be checked only there; every statement names a path, an identifier or a hash of the repository
// counter-proof: a document that gives each row a link into the dashboard fails the address check
test("TST-757107 auditDocument — no address of the dashboard is the only way to check a statement", () => {
  const text = document();
  assert.ok(!/https?:\/\//i.test(text));
  assert.ok(!/dashboard|github\.io|#\//i.test(text));
});

// TST-757108 · level: unit · module: MOD-release-evidence
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the fixture audit and the same audit with its rows in another order
// input: auditDocument twice
// expect: the documents differ only in the order of the sections — the first is the audit's own order, so the document is derived from the audit and holds no text of its own about a requirement
test("TST-757108 auditDocument — the rows stand in the audit's order", () => {
  const order = (text) => text.slice(text.indexOf("## Requirements")).split(/^### /m).slice(1).map((row) => row.split("\n")[0]);
  assert.deepEqual(order(document()), AUDIT.rows.map((row) => row.requirement));
  assert.deepEqual(order(document({ ...AUDIT, rows: [...AUDIT.rows].reverse() })), AUDIT.rows.map((row) => row.requirement).reverse());
});
}
