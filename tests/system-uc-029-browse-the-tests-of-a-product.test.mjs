// System coverage for UC-029 Browse the tests of a product, walked as a reviewer meets it on Tests → Browser: the flow map (TST-774201) names, for every step of the main flow, every alternative flow and the
// postcondition, the executable tests that walk it, the finding where the page does otherwise, or the reason it is not walked; and the cases walk the use case as a whole on one product with its branch
// `test-results` — the tree by level, file and case with each test's outcome on the head of the default branch (1), the groupings by requirement, use case and module with the levels present and missing (2),
// the filters (3), an opened test with its declaration, schedule, writer, counter-proof and code (4), its history across commits and releases (5), two releases compared (6), the Incomplete group (1a), a
// private repository no token reaches (1b), broken links (2a), a removed test (5a), a run whose log is gone (5b), and nothing written. The page is the real route `trace` of MOD-trace-pages with the key
// "tests", over the real MOD-result-records, MOD-test-document and MOD-test-schedule, behind tests/uc-029-harness.mjs' host in memory; for 1b, the frame of MOD-site-frame over the real GitHub host behind a
// fake of fetch. No request leaves the process.
// Run: node --test tests/system-uc-029-browse-the-tests-of-a-product.test.mjs
//
// Module: MOD-trace-pages
// Module: MOD-result-records
// Module: MOD-site-frame
// Guards: UC-029
// Level: system
//
// Authored by developer-opus-f (ITM-774). The `Agent-M-Participant` trailers of the code UC-029's flow runs (src/trace-pages/tests.mjs, test-detail.mjs, src/result-records/read.mjs) name developer-sonnet-c
// (ITM-767, ITM-769), developer-sonnet-j (ITM-1275, ITM-1276, ITM-1309) and developer-terra-b (the link of a mark to its run's log); ITM-251, ITM-751 and ITM-766 carry no trailer. developer-opus-f built
// none of it; of MOD-trace-pages it built ITM-600, the second version compared on the specification and the gaps, which the tests view does not draw (flow.mjs offers that choice to those two views only).
// Where the page and UC-029 disagree the case follows UC-029 and is marked `todo` with the word FINDING and its module (named in FLOW_FINDINGS). Each case states its input and its expected values in its own
// text and proves them against a known positive in the same case; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map, which holds the expected passages itself
// and checks that UC-029 still says them. Readings the texts leave open, which the cases state:
//   - "its outcome on the latest commit of the default branch" (1) is read as the outcome the records of the branch `test-results` give the commit main stands at, flaky where they disagree.
//   - "marked as removed at the commit that removed it" (5a) is read as the detail's line naming that commit, beside the marks of the commits where the test ran.
//   - "1a. A test declares no `TST-` identifier" is read as a test case of a test file whose comment lines before it declare a level and what it guards, and whose first line names no identifier; such a
//     block is no declaration for MOD-test-document ("Its first line names the identifier"), and its interface leaves to the caller whether a file without one is a gap.
//   - "Nothing was written" (postcondition) is read as no call of a method of the product's host that writes, while every step is walked.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { HEAD, OLD, PULL, TAG1, TAG2, casesOf, choose, click, groupNamed, hostOf, idsOf, levelsOf, lineOf, render, runAddress, short, textOf, textsOf, visit, withClass } from "./uc-029-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-029-browse-the-tests-of-a-product.md";
const SELF = "tests/system-uc-029-browse-the-tests-of-a-product.test.mjs";
const RELEASE = "tests/release-uc-029-browse-the-tests-of-a-product.test.mjs";
const VIEW = "tests/trace-pages-tests-view.test.mjs", DETAIL = "tests/trace-pages-test-detail.test.mjs", COMPARE = "tests/trace-pages-tests-compare.test.mjs";
const LOGS = "tests/trace-pages-test-history-logs.test.mjs", ENTRY = "tests/trace-pages-tests-entry.test.mjs", STABLE = "tests/test_identifier_stability.py";
const LEVELS = (unit, component, system, release, user) => [`unit: ${unit}`, `component: ${component}`, `system: ${system}`, `release: ${release}`, `user: ${user}`];

// ---------------------------------------------------------------- the flow map

// The passages of UC-029 the system tests walk, each with the executable tests that walk it: this file's cases, and the older tests of the tests view, which declare the level unit or component.
const FLOW_EVIDENCE = {
  "main-1-browser": { uc: "The reviewer opens **Tests → Browser**.", evidence: [[ENTRY, "TST-1224003"]] },
  "main-1-tree": { uc: "Agent M shows a tree grouped by **level**, then by test file, then by test case; each test shows its `TST-` identifier, a one-line title and its outcome on the latest commit of the default branch.", evidence: [[SELF, "TST-774202"], [VIEW, "TST-766001"]] },
  "main-2-groupings": { uc: "The reviewer switches the grouping to **by requirement**, **by use case** or **by module**.", evidence: [[SELF, "TST-774203"], [VIEW, "TST-766002"], [VIEW, "TST-766003"], [VIEW, "TST-766004"]] },
  "main-2-empty": { uc: "a missing level is shown as empty, not hidden — for example a requirement with unit tests and no release test.", evidence: [[SELF, "TST-774203"]] },
  "main-3-filters": { uc: "The reviewer filters: failed, flaky, not run, model-dependent, calls a paid service, without counter-proof, guards nothing.", evidence: [[SELF, "TST-774204"], [VIEW, "TST-766005"]] },
  "main-4-description": { uc: "level, guarded identifiers, precondition, input, expected result", evidence: [[SELF, "TST-774205"], [DETAIL, "TST-767001"]] },
  "main-4-schedule-writer-code": { uc: "when the schedule runs it, the participant that wrote it, its counter-proof record, and a link to its code.", evidence: [[SELF, "TST-774205"], [DETAIL, "TST-767002"], [DETAIL, "TST-767003"], [DETAIL, "TST-767004"]] },
  "main-5-history": { uc: "one mark per commit of the default branch where it ran, and one row per release tag. A flaky commit is marked as such.", evidence: [[SELF, "TST-774206"], [DETAIL, "TST-767005"]] },
  "main-5-default-branch": { uc: "one mark per commit of the default branch where it ran", evidence: [[SELF, "TST-774214"]] },
  "main-5-rate": { uc: "A model-dependent test shows its rate per release as a line, with the number of runs behind each point.", evidence: [[SELF, "TST-774206"], [DETAIL, "TST-767006"]] },
  "main-6-compare": { uc: "The reviewer picks two releases to **compare**: tests added, removed, changed in what they guard or expect, and changed in outcome.", evidence: [[SELF, "TST-774207"], [COMPARE, "TST-769001"]] },
  "1a-no-identifier": { uc: "**1a. A test declares no `TST-` identifier, no level or no guarded identifier.**", evidence: [[SELF, "TST-774209"]] },
  "1a-incomplete": { uc: "It is listed under **Incomplete**, with what is missing; the page still works for all others.", evidence: [[SELF, "TST-774208"], [VIEW, "TST-766006"]] },
  "1b-private": { uc: "**1b. The product repository is private and no token reaching it is stored.** The page says so and shows nothing.", evidence: [[SELF, "TST-774210"], [VIEW, "TST-766009"]] },
  "2a-broken": { uc: "**2a. A test guards an identifier that does not exist, or was withdrawn.** The link is shown as broken, with the identifier; the test is not moved to another group.", evidence: [[SELF, "TST-774211"], [VIEW, "TST-766007"]] },
  "5a-removed": { uc: "**5a. A test was removed.** It stays in the history of the commits where it existed, marked as removed at the commit that removed it;", evidence: [[SELF, "TST-774212"], [DETAIL, "TST-767007"]] },
  "5a-not-reused": { uc: "its identifier is not given to another test.", evidence: [[STABLE, "TST-1201004"]] },
  "5b-log-gone": { uc: "The outcomes stay in the history — they are read from the result records on the branch `test-results` (UC-028) — and only the link to the full log is marked *no longer available*.", evidence: [[SELF, "TST-774213"], [LOGS, "TST-1275002"]] },
  "postcondition-nothing-written": { uc: "Nothing was written; the reviewer knows for any test what it guards, what it expects and how its results developed, and for any requirement which levels guard it.", evidence: [[SELF, "TST-774215"]] },
  "goal-computed": { uc: "Nothing on this page is stored; it is computed from the repository and the result records.", evidence: [[RELEASE, "TST-774306"]] },
};
// The passages the page does otherwise: the finding, its case, and the module it points to.
const FLOW_FINDINGS = {
};
// The passages no code of this product carries, with the reason.
const NOT_WALKED = {};

// TST-774201 · level: system · module: system
// guards: UC-029
// given: UC-029 as committed text, the executable tests named in FLOW_EVIDENCE, the findings named in FLOW_FINDINGS and the flows named in NOT_WALKED (none)
// input: compare every passage of the main flow, steps 1 to 6, of the alternative flows and of the postcondition with its executable evidence, its finding or the reason it is not walked
// expect: every named passage stands in UC-029; every evidence file exists and declares its TST id; this file's cases declare the level system; every finding's case stands in its file with the todo naming FINDING and its module; every alternative flow UC-029 names is among the passages; known positive: UC-029 names exactly the five alternative flows 1a, 1b, 2a, 5a and 5b, and each of the six main steps has a passage
test("TST-774201: UC-029 every passage of the main flow and of each alternative flow has an executable test, a finding or a stated reason", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  const missing = [];
  for (const [name, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-029 says "${needle}"`);
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
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-029 says "${needle}"`);
    assert.ok(read(file).includes(`// ${id} `), `${name}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} (${module})`), `${name}: the todo of ${id} names FINDING ${finding} and ${module}`);
  }
  for (const [name, { uc: needle }] of Object.entries(NOT_WALKED)) assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-029 says "${needle}"`);
  const flows = [...uc.matchAll(/- \*\*(\d+[a-z])\. /g)].map((match) => match[1]).sort();
  assert.deepEqual(flows, ["1a", "1b", "2a", "5a", "5b"], "known positive: UC-029 names these five alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS, ...NOT_WALKED }).map((key) => key.split("-")[0]));
  assert.deepEqual(flows.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
  const steps = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).filter((key) => key.startsWith("main-")).map((key) => Number(key.split("-")[1])));
  assert.deepEqual([...steps].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6], "each step of the main flow is among the passages");
});

// ---------------------------------------------------------------- the main flow

// TST-774202 · level: system · module: system
// guards: UC-029; EVERY TEST HAS ONE LEVEL; EVERY TEST RUN LEAVES A RESULT RECORD; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: the product of tests/uc-029-harness.mjs at main, whose head HEAD has two records on test-results (TST-103 passed in one, failed in the other; TST-105 failed; TST-104 "4 of 5"); the records of earlier commits say TST-101 failed on OLD and on PULL
// input: the reviewer opens Tests → Browser at main
// expect: known positive — the groups are unit, component and release, the levels that hold a complete test; unit holds the files tests/loans/records.test.mjs and tests/returns.test.mjs; the cases in order with identifier, title and outcome on HEAD alone: TST-101 "a loan is recorded" passed, TST-102 passed, TST-104 "passed (4 of 5)", TST-103 flaky, TST-105 failed, TST-106 passed, TST-110 passed
test("TST-774202: UC-029 1 the tree by level, file and case shows each test's identifier, title and outcome on the head of the default branch", async () => {
  const page = await render();
  assert.deepEqual(textsOf(page, "tests-group-name"), ["unit", "component", "release"], "known positive: the levels that hold a test");
  assert.deepEqual(textsOf(groupNamed(page, "unit"), "tests-file-name"), ["tests/loans/records.test.mjs", "tests/returns.test.mjs"]);
  const tree = withClass(page, "tests-group").flatMap((group) => casesOf(group).map(lineOf));
  assert.deepEqual(tree, [["TST-101", "a loan is recorded", "passed"], ["TST-102", "a fine stops at its cap", "passed"], ["TST-104", "the model names the overdue loans", "passed (4 of 5)"],
    ["TST-103", "a return closes the loan", "flaky"], ["TST-105", "a reader sees the loan", "failed"], ["TST-106", "a late return costs a fee", "passed"], ["TST-110", "the catalogue is searched", "passed"]]);
});

// TST-774203 · level: system · module: system
// guards: UC-029; THE TRACEABILITY MATRIX IS DERIVED; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN
// given: the product of TST-774202; FINES ARE CAPPED is guarded by TST-102 (unit) alone; LOANS ARE RECORDED by TST-101 (unit) and TST-105 (release)
// input: the grouping by requirement, then by use case, then by module
// expect: known positive — by requirement, LOANS ARE RECORDED shows unit: 1 and release: 1 and holds TST-101 and TST-105; FINES ARE CAPPED shows unit: 1, component, system, release and user empty (a requirement with unit tests and no release test); by use case UC-001 holds TST-101 and TST-105 (unit: 1, release: 1), UC-002 TST-104; by module MOD-fines holds TST-102, MOD-loans TST-101, TST-103 and TST-104, system TST-105, TST-106 and TST-110
test("TST-774203: UC-029 2 grouped by requirement, use case or module, each group shows the levels that guard it and a missing level as empty", async () => {
  const page = await render();
  await choose(page, "tests-grouping", "requirement");
  assert.deepEqual(levelsOf(groupNamed(page, "LOANS ARE RECORDED")), LEVELS(1, "empty", "empty", 1, "empty"), "known positive: a requirement guarded at two levels");
  assert.deepEqual(idsOf(groupNamed(page, "LOANS ARE RECORDED")), ["TST-101", "TST-105"]);
  assert.deepEqual(levelsOf(groupNamed(page, "FINES ARE CAPPED")), LEVELS(1, "empty", "empty", "empty", "empty"));
  await choose(page, "tests-grouping", "use case");
  assert.deepEqual(levelsOf(groupNamed(page, "UC-001")), LEVELS(1, "empty", "empty", 1, "empty"));
  assert.deepEqual([idsOf(groupNamed(page, "UC-001")), idsOf(groupNamed(page, "UC-002"))], [["TST-101", "TST-105"], ["TST-104"]]);
  await choose(page, "tests-grouping", "module");
  assert.deepEqual(["MOD-fines", "MOD-loans", "system"].map((name) => idsOf(groupNamed(page, name))), [["TST-102"], ["TST-101", "TST-103", "TST-104"], ["TST-105", "TST-106", "TST-110"]]);
});

// TST-774204 · level: system · module: system
// guards: UC-029; A MODEL-DEPENDENT TEST IS MEASURED AS A RATE; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: the product of TST-774202; only TST-101 has a counter-proof record; TST-104 declares 5 runs and the paid service Fixture AI; TST-107 has no record on HEAD; TST-108 guards nothing
// input: each filter in turn — failed, flaky, not run, model-dependent, calls a paid service, without counter-proof, guards nothing — and all again
// expect: known positive — all shows the nine declared tests; failed TST-105; flaky TST-103; not run TST-107; model-dependent TST-104; calls a paid service TST-104; without counter-proof every test but TST-101; guards nothing TST-108; all again the nine
test("TST-774204: UC-029 3 each filter keeps the failed, flaky, not run, model-dependent and paid tests, those without counter-proof and those that guard nothing", async () => {
  const page = await render();
  const every = ["TST-101", "TST-102", "TST-104", "TST-103", "TST-105", "TST-106", "TST-110", "TST-107", "TST-108"];
  assert.deepEqual(idsOf(page), every, "known positive: all nine declared tests are shown");
  for (const [filter, ids] of [["failed", ["TST-105"]], ["flaky", ["TST-103"]], ["not run", ["TST-107"]], ["model-dependent", ["TST-104"]], ["calls a paid service", ["TST-104"]],
    ["without counter-proof", every.filter((id) => id !== "TST-101")], ["guards nothing", ["TST-108"]], ["all", every]]) {
    await choose(page, "tests-filter", filter);
    assert.deepEqual(idsOf(page), ids, filter);
  }
});

// TST-774205 · level: system · module: system
// guards: UC-029; A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT
// given: the product of TST-774202, which saves no schedule; TST-101 declares unit, LOANS ARE RECORDED and UC-001, "a library with one book", "the book is lent to a reader", "one open loan names the reader"; its counter-proof record names tester-a and the fault "The loan's reader is dropped."; TST-102 has no record
// input: the reviewer opens TST-101 from its identifier in the tree, then TST-102
// expect: known positive — the identifier in the tree links to #trace/key=tests/ref=main/row=TST-101; the detail is headed "TST-101 a loan is recorded" with level unit, guards LOANS ARE RECORDED and UC-001, the precondition, input and expected result as declared; it runs "every commit, pull request, nightly, release candidate, on demand (the book's default schedule)"; written by tester-a; the record with its fault; the code linked to tests/loans/records.test.mjs at main; TST-102 says "No counter-proof record." and names no writer
test("TST-774205: UC-029 4 an opened test shows its declaration, when it runs, who wrote it, its counter-proof and its code", async () => {
  const tree = await render();
  const link = casesOf(tree).find((each) => textOf(each, "tests-id") === "TST-101");
  assert.equal(withClass(link, "tests-id")[0].getAttribute("href"), "#trace/key=tests/ref=main/row=TST-101", "known positive: the identifier opens the test");
  const page = await render(hostOf(), { row: "TST-101" });
  assert.match(textOf(page, "test-detail"), /^TST-101 a loan is recorded/);
  assert.deepEqual([textOf(page, "test-level"), textsOf(page, "test-guards-item"), textOf(page, "test-given"), textOf(page, "test-input"), textOf(page, "test-expect")],
    ["unit", ["LOANS ARE RECORDED", "UC-001"], "a library with one book", "the book is lent to a reader", "one open loan names the reader"]);
  assert.equal(textOf(page, "test-schedule"), "every commit, pull request, nightly, release candidate, on demand (the book's default schedule)");
  assert.equal(textOf(page, "test-participant"), "tester-a");
  assert.match(textOf(page, "test-counter-proof"), /The loan's reader is dropped\./);
  const code = withClass(page, "test-code")[0];
  assert.deepEqual([code.textContent, code.getAttribute("href")], ["tests/loans/records.test.mjs", "https://github.com/acme/library/blob/main/tests/loans/records.test.mjs"]);
  const other = await render(hostOf(), { row: "TST-102" });
  assert.equal(textOf(other, "test-counter-proof-none"), "No counter-proof record.");
  assert.equal(withClass(other, "test-participant").length, 0);
});

// TST-774206 · level: system · module: system
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY; A MODEL-DEPENDENT TEST IS MEASURED AS A RATE
// given: the product of TST-774202; test-results holds TST-101 passed on HEAD, TAG2 and TAG1 and failed on OLD; TST-103 passed and failed on HEAD, passed on TAG2, failed on TAG1; TST-104 "3 of 5" on TAG2 and "2 of 5" on TAG1
// input: the reviewer opens TST-101, TST-103 and TST-104
// expect: known positive — TST-101 has a mark for HEAD passed, TAG2 passed, OLD failed and TAG1 passed, and the rows v2026.2.0 passed and v2026.1.0 passed; TST-103's mark of HEAD reads flaky and is marked flaky, its marks of TAG2 passed and TAG1 failed are not; TST-104's rate line has the points "v2026.2.0: 3 of 5" and "v2026.1.0: 2 of 5"
test("TST-774206: UC-029 5 an opened test's history has one mark per commit it ran on, one row per release, a flaky commit marked, and a rate line", async () => {
  const marks = (page) => textsOf(page, "test-history-commit").map((text) => text.replace(/ (log|no longer available)$/, ""));
  const first = await render(hostOf(), { row: "TST-101" });
  for (const mark of [`${short(HEAD)} passed`, `${short(TAG2)} passed`, `${short(OLD)} failed`, `${short(TAG1)} passed`]) assert.ok(marks(first).includes(mark), `known positive: the mark ${mark}`);
  assert.deepEqual(textsOf(first, "test-history-release"), ["v2026.2.0 passed", "v2026.1.0 passed"]);
  const flaky = await render(hostOf(), { row: "TST-103" });
  assert.deepEqual(marks(flaky), [`${short(HEAD)} flaky`, `${short(TAG2)} passed`, `${short(TAG1)} failed`]);
  assert.deepEqual(withClass(flaky, "test-history-flaky").map((node) => node.textContent.slice(0, 7)), [short(HEAD)]);
  const rated = await render(hostOf(), { row: "TST-104" });
  assert.deepEqual(textsOf(rated, "test-rate-point"), ["v2026.2.0: 3 of 5", "v2026.1.0: 2 of 5"]);
});

// TST-774207 · level: system · module: system
// guards: UC-029; THE NAME IS THE ID AND IT SURVIVES; A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: the product of TST-774202; between v2026.1.0 and v2026.2.0 TST-102, TST-107, TST-108 and TST-110 were added, TST-109 removed, TST-101 moved from tests/loans.test.mjs to tests/loans/records.test.mjs and given UC-001 besides, TST-105's expected result changed from "the loan is listed" to "the reader sees the loan"; TST-103 failed at v2026.1.0 and passed at v2026.2.0, TST-104 went from 2 of 5 to 3 of 5; TST-106 is unchanged
// input: the reviewer opens Tests → Browser at v2026.2.0 and compares it with v2026.1.0
// expect: known positive — the control offers v2026.1.0; Added TST-102, TST-107, TST-108, TST-110; Removed TST-109; Changed in what they guard or expect TST-101 (guards: LOANS ARE RECORDED → LOANS ARE RECORDED; UC-001) and TST-105 (expect: the loan is listed → the reader sees the loan); Changed in outcome TST-103 (failed → passed) and TST-104 (passed (2 of 5) → passed (3 of 5)); TST-106 in no list, and TST-101 neither added nor removed by its move
test("TST-774207: UC-029 6 two releases compared list the tests added, removed, changed in what they guard or expect, and changed in outcome", async () => {
  const page = await render(hostOf(), { ref: "v2026.2.0", compare: "v2026.1.0" });
  assert.ok(optionsOf(page, "tests-compare-with").includes("v2026.1.0"), "known positive: the other release is offered");
  const listed = (className) => withClass(withClass(page, className)[0], "tests-compared").map((item) => [textOf(item, "tests-compared-id"), ...textsOf(item, "tests-compared-change")]);
  assert.deepEqual(listed("tests-compare-added").map(([id]) => id), ["TST-102", "TST-107", "TST-108", "TST-110"]);
  assert.deepEqual(listed("tests-compare-removed").map(([id]) => id), ["TST-109"]);
  assert.deepEqual(listed("tests-compare-changed"), [["TST-101", "guards: LOANS ARE RECORDED → LOANS ARE RECORDED; UC-001"], ["TST-105", "expect: the loan is listed → the reader sees the loan"]]);
  assert.deepEqual(listed("tests-compare-outcome"), [["TST-103", "failed → passed"], ["TST-104", "passed (2 of 5) → passed (3 of 5)"]]);
  assert.ok(!textOf(page, "tests-compare").includes("TST-106"), "an unchanged test is in no list");
});
const optionsOf = (page, className) => withClass(page, className).flatMap((select) => select.childNodes.map((option) => option.value ?? option.textContent));

// ---------------------------------------------------------------- the alternative flows

// TST-774208 · level: system · module: system
// guards: UC-029; EVERY TEST HAS ONE LEVEL; EVERY ARTIFACT NAMES ITS ORIGIN
// given: the product of TST-774202; TST-107 declares no level, TST-108 guards nothing; TST-101 declares both
// input: the reviewer opens Tests → Browser at main
// expect: known positive — TST-101 stands in the tree under unit; one Incomplete group lists TST-107 missing "level" and TST-108 missing "guards", neither in the tree; the seven complete tests are still shown
test("TST-774208: UC-029 1a a test without its level or without what it guards is listed under Incomplete with what is missing, and the page works for the others", async () => {
  const page = await render();
  assert.ok(idsOf(groupNamed(page, "unit")).includes("TST-101"), "known positive: a complete test stands in the tree");
  const incomplete = withClass(page, "tests-incomplete");
  assert.equal(incomplete.length, 1);
  assert.deepEqual(casesOf(incomplete[0]).map((each) => [textOf(each, "tests-id"), textOf(each, "tests-missing")]), [["TST-107", "level"], ["TST-108", "guards"]]);
  assert.deepEqual(withClass(page, "tests-group").flatMap(idsOf).filter((id) => ["TST-107", "TST-108"].includes(id)), []);
  assert.equal(withClass(page, "tests-group").flatMap(idsOf).length, 7);
});

// TST-774209 · level: system · module: system
// guards: UC-029; EVERY ARTIFACT NAMES ITS ORIGIN
// given: the product of TST-774202; tests/undeclared.test.mjs holds the test case "a loan without its identifier", whose comment lines declare a level and LOANS ARE RECORDED and name no TST- identifier
// input: the reviewer opens Tests → Browser at main
// expect: known positive — the Incomplete group lists TST-107 with "level"; it also lists the test case of tests/undeclared.test.mjs, by its title or its file, with "identifier" as what is missing
test("TST-774209: UC-029 1a a test that declares no TST- identifier is listed under Incomplete with the identifier missing", async () => {
  const page = await render();
  const [incomplete] = withClass(page, "tests-incomplete");
  assert.ok(casesOf(incomplete).some((each) => textOf(each, "tests-id") === "TST-107" && textOf(each, "tests-missing") === "level"), "known positive: a test without its level is listed");
  const text = incomplete.textContent;
  assert.match(text, /a loan without its identifier|tests\/undeclared\.test\.mjs/, "the test without an identifier is listed");
  assert.match(text, /identifier/, "what is missing is its identifier");
});

// TST-774210 · level: system · module: system
// guards: UC-029
// given: a browser that keeps the product https://github.com/acme/library without a token; GitHub answers every request for the product with Not Found, as it does for a private repository that no token reaches
// input: the person opens #trace/key=tests/ref=main/product=<the product>; known positive: the same address while GitHub serves the product's main
// expect: known positive — with the product served, the page shows its nine declared tests; without, the page says "This repository is private or does not exist, and this browser stores no token that reaches it." and offers "Store a token"; it shows no test case, no group and no filter
test("TST-774210: UC-029 1b a private repository no token reaches: the page says so and shows nothing", async (t) => {
  const served = await visit(t, { present: true });
  assert.equal(idsOf(served.main()).length, 9, "known positive: the served product's tests are shown");
  const closed = await visit(t, { present: false });
  assert.match(closed.main().textContent, /This repository is private or does not exist, and this browser stores no token that reaches it\./);
  assert.match(closed.main().textContent, /Store a token/);
  assert.equal(casesOf(closed.main()).length + withClass(closed.main(), "tests-group").length + withClass(closed.main(), "tests-filter").length, 0);
});

// TST-774211 · level: system · module: system
// guards: UC-029; UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN; THE NAME IS THE ID AND IT SURVIVES
// given: the product of TST-774202; TST-106 guards LATE FEES APPLY, which the SPEC held at v2026.1.0 and withdrew since; TST-110 guards UC-009, which no use case is
// input: the grouping by requirement and by use case at main, and by requirement at v2026.1.0
// expect: known positive — at main, LOANS ARE RECORDED and UC-001 are not marked broken; LATE FEES APPLY and UC-009 are marked broken with "broken link: nothing of the version has this name", holding TST-106 and TST-110; both stay in the tree under release; at v2026.1.0 LATE FEES APPLY is not broken
test("TST-774211: UC-029 2a a guarded name that does not exist or was withdrawn is a broken link, and the test is not moved", async () => {
  const page = await render();
  assert.deepEqual(idsOf(groupNamed(page, "release")), ["TST-105", "TST-106", "TST-110"]);
  await choose(page, "tests-grouping", "requirement");
  assert.deepEqual(textsOf(page, "tests-broken"), ["LATE FEES APPLY"], "known positive: LOANS ARE RECORDED is not marked");
  assert.match(groupNamed(page, "LATE FEES APPLY").textContent, /broken link: nothing of the version has this name/);
  assert.deepEqual(idsOf(groupNamed(page, "LATE FEES APPLY")), ["TST-106"]);
  await choose(page, "tests-grouping", "use case");
  assert.deepEqual(textsOf(page, "tests-broken"), ["UC-009"]);
  assert.deepEqual(idsOf(groupNamed(page, "UC-009")), ["TST-110"]);
  const earlier = await render(hostOf(), { ref: "v2026.1.0" });
  await choose(earlier, "tests-grouping", "requirement");
  assert.deepEqual(textsOf(earlier, "tests-broken"), []);
  assert.deepEqual(idsOf(groupNamed(earlier, "LATE FEES APPLY")), ["TST-106"]);
});

// TST-774212 · level: system · module: system
// guards: UC-029; THE NAME IS THE ID AND IT SURVIVES
// given: the product of TST-774202; TST-109 is declared at v2026.1.0 in tests/release.test.mjs, ran on TAG1, and OLD removed it from that file; main declares no TST-109
// input: the reviewer opens #trace/key=tests/ref=main/row=TST-109
// expect: known positive — TST-109 is not in the tree at main; its detail is headed "TST-109 a loan has a due date" with its declaration from the release (unit, LOANS ARE RECORDED); it reads "Removed at commit <OLD> (2026-10-10)"; its history keeps the mark of TAG1 passed and the row v2026.1.0 passed
test("TST-774212: UC-029 5a a removed test keeps its history and is marked as removed at the commit that removed it", async () => {
  assert.ok(!idsOf(await render()).includes("TST-109"), "known positive: main declares no TST-109");
  const page = await render(hostOf(), { row: "TST-109" });
  assert.match(textOf(page, "test-detail"), /^TST-109 a loan has a due date/);
  assert.deepEqual([textOf(page, "test-level"), textsOf(page, "test-guards-item")], ["unit", ["LOANS ARE RECORDED"]]);
  assert.equal(textOf(page, "test-removed"), `Removed at commit ${short(OLD)} (2026-10-10)`);
  assert.ok(textsOf(page, "test-history-commit").some((mark) => mark.startsWith(`${short(TAG1)} passed`)));
  assert.ok(textsOf(page, "test-history-release").includes("v2026.1.0 passed"));
});

// TST-774213 · level: system · module: system
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the product of TST-774202; the server keeps the logs of runs 5003, 5002, 5001 and 4001, and no longer the log of run 4002, OLD's, whose record says TST-101 failed
// input: the reviewer opens TST-101 and opens the log link of the mark of HEAD and of the mark of OLD
// expect: known positive — HEAD's link leads to the run 5003 and still reads "log"; OLD's leads to run 4002 and reads "no longer available"; OLD's mark keeps its outcome, failed; the server was asked about runs 5003 and 4002 alone
test("TST-774213: UC-029 5b a run whose log the server no longer keeps keeps its outcome, and only its link is marked no longer available", async () => {
  const host = hostOf();
  const page = await render(host, { row: "TST-101" });
  const linkOf = (run) => withClass(page, "test-history-log").find((link) => link.getAttribute("href") === runAddress(run));
  await click(linkOf(5003));
  assert.equal(linkOf(5003).textContent, "log", "known positive: a kept log's link reads log");
  await click(linkOf(4002));
  assert.equal(linkOf(4002).textContent, "no longer available");
  assert.ok(textsOf(page, "test-history-commit").includes(`${short(OLD)} failed no longer available`));
  assert.deepEqual(host.asked, ["5003", "4002"]);
});

// TST-774214 · level: system · module: system
// guards: UC-029; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the product of TST-774202; test-results holds a record of PULL, the head of a pull request, never a commit of main, in which TST-101 failed; HEAD and OLD are commits of main that ran TST-101
// input: the reviewer opens TST-101
// expect: known positive — the history has the marks of HEAD and OLD; it has no mark of PULL, which is not a commit of the default branch
test("TST-774214: UC-029 5 the history marks the commits of the default branch alone", async () => {
  const page = await render(hostOf(), { row: "TST-101" });
  const marked = textsOf(page, "test-history-commit").map((mark) => mark.slice(0, 7));
  assert.ok(marked.includes(short(HEAD)) && marked.includes(short(OLD)), "known positive: the commits of main that ran it are marked");
  assert.ok(!marked.includes(short(PULL)), "a pull request's head is no commit of the default branch");
});

// ---------------------------------------------------------------- the postcondition

// TST-774215 · level: system · module: system
// guards: UC-029; THE TRACEABILITY MATRIX IS DERIVED
// given: the product of TST-774202, whose host records every call of a method that writes (commitFiles, writeFile, createBranch, openPullRequest)
// input: the reviewer walks the steps on one host: the tree, the three groupings, every filter, opens TST-101 and the log of its mark of OLD, and compares v2026.2.0 with v2026.1.0
// expect: known positive — each step drew what it shows (nine cases, the group FINES ARE CAPPED, the detail of TST-101, the comparison); no method that writes was called
test("TST-774215: UC-029 nothing is written while the reviewer walks every step", async () => {
  const host = hostOf();
  const page = await render(host);
  assert.equal(idsOf(page).length, 9, "known positive: the tree is drawn");
  for (const grouping of ["requirement", "use case", "module"]) await choose(page, "tests-grouping", grouping);
  for (const filter of ["failed", "flaky", "not run", "model-dependent", "calls a paid service", "without counter-proof", "guards nothing"]) await choose(page, "tests-filter", filter);
  await choose(page, "tests-grouping", "requirement");
  await choose(page, "tests-filter", "all");
  assert.ok(groupNamed(page, "FINES ARE CAPPED"), "known positive: the grouping is drawn");
  const detail = await render(host, { row: "TST-101" });
  assert.match(textOf(detail, "test-detail"), /^TST-101/);
  await click(withClass(detail, "test-history-log").find((link) => link.getAttribute("href") === runAddress(4002)));
  const compared = await render(host, { ref: "v2026.2.0", compare: "v2026.1.0" });
  assert.equal(withClass(compared, "tests-compare").length, 1);
  assert.deepEqual(host.writes, []);
});
