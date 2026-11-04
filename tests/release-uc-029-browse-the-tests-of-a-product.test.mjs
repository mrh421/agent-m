// Release tests of the requirements UC-029 "Browse the tests of a product" realises, each checked from what a reviewer reads on Tests → Browser: every test in one level, its declaration read without running
// it, its counter-proof, a model-dependent test's rate, outcomes read from the result records, a flaky test never shown as passed, what each test names as its origin, groups derived from the version
// shown, a requirement no test guards shown and not refused, and a test's identifier kept across a move and a removal. TST-774301 maps every requirement UC-029 realises to the release tests that guard
// it: this file's, and those other writers wrote.
// Run: node --test tests/release-uc-029-browse-the-tests-of-a-product.test.mjs
//
// Module: MOD-trace-pages
// Module: MOD-result-records
// Guards: UC-029
// Level: release
//
// Written for the release testing of sprint 142 by developer-opus-f (ITM-774), who implemented none of the behaviour any case of this file guards: the code UC-029's flow runs carries the `Agent-M-Participant`
// trailers of developer-sonnet-c (ITM-767, ITM-769), developer-sonnet-j (ITM-1275, ITM-1276, ITM-1309) and developer-terra-b (the link of a mark to its run's log), and ITM-251, ITM-751 and ITM-766 carry none
// (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Of MOD-trace-pages developer-opus-f built ITM-600, the second version compared on the specification and the gaps; the tests view draws no such choice and
// compares two releases through its own code, so no case here walks it. The world is tests/uc-029-harness.mjs': the route `trace` of MOD-trace-pages with the key "tests" over a host in memory. Where the page
// and the SPEC or UC-029 disagreed, the case would follow the text and be marked `todo` with the word FINDING; none does. Readings the texts leave open, which the cases state:
//   - "shown as flaky, never as passed" (A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY) is read, on this page, as the outcome the tree shows for the head of the default branch and the mark of that commit in the
//     test's history.
//   - "reports a pass rate over a number of runs fixed before the first run" (A MODEL-DEPENDENT TEST IS MEASURED AS A RATE) is read, on this page, as the outcome with its runs `<k> of <n>` and the rate line per
//     release; comparing it with the last release's rate is the release report's (UC-028), not this page's.
//   - "a form that can be read without running it" (A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS) is read as the opened test's precondition, input and expected result shown while no result record can be read.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { FILES, HEAD, RECORDS, casesOf, choose, declared, groupNamed, hostOf, idsOf, levelsOf, lineOf, render, short, textOf, textsOf, withClass } from "./uc-029-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-029-browse-the-tests-of-a-product.md";
const SELF = "tests/release-uc-029-browse-the-tests-of-a-product.test.mjs";
const LEVELS = (unit, component, system, release, user) => [`unit: ${unit}`, `component: ${component}`, `system: ${system}`, `release: ${release}`, `user: ${user}`];
const outcomeOf = (page, id) => casesOf(page).map(lineOf).find(([each]) => each === id)?.[2];

// ---------------------------------------------------------------- the map

// Each requirement UC-029 realises, with the release tests that guard it: this file's, and those other writers wrote.
const EVIDENCE = {
  "EVERY TEST HAS ONE LEVEL": [[SELF, "TST-774302"], ["tests/release-uc-028-run-and-review.test.mjs", "TST-773108"]],
  "A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS": [[SELF, "TST-774303"], ["tests/test_test_battery.py", "TST-410100"]],
  "A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT": [[SELF, "TST-774304"]],
  "A MODEL-DEPENDENT TEST IS MEASURED AS A RATE": [[SELF, "TST-774305"], ["tests/test_rate_reporting.py", "TST-411100"]],
  "EVERY TEST RUN LEAVES A RESULT RECORD": [[SELF, "TST-774306"], ["tests/release-itm-1309-tests-tree-commit-records.test.mjs", "TST-1309305"], ["tests/release-itm-1275-history-log-on-open.test.mjs", "TST-1275301"]],
  "A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY": [[SELF, "TST-774307"], ["tests/release-itm-1276-test-history-ten-at-a-time.test.mjs", "TST-1276304"]],
  "EVERY ARTIFACT NAMES ITS ORIGIN": [[SELF, "TST-774308"], ["tests/release-uc-028-run-and-review.test.mjs", "TST-773109"]],
  "THE TRACEABILITY MATRIX IS DERIVED": [[SELF, "TST-774309"], ["tests/release-uc-020-gaps.test.mjs", "TST-020701"]],
  "UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN": [[SELF, "TST-774310"], ["tests/release-uc-020-gaps.test.mjs", "TST-020703"]],
  "THE NAME IS THE ID AND IT SURVIVES": [[SELF, "TST-774311"], ["tests/release-itm-1321-one-test-identifier-names-one-test-case.test.mjs", "TST-1321101"]],
};

// TST-774301 · level: release · module: system
// guards: UC-029
// given: UC-029 as committed text, whose `realises` lists ten requirements, and the release tests named in EVIDENCE
// input: read UC-029's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-029 realises these ten requirements; the map holds exactly them; each has at least one release test named; each test named stands in its file with the level release and guards that requirement; every case of this file declares the level release and guards UC-029
test("TST-774301: UC-029 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 10, "known positive: UC-029 realises ten requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-029 realises");
  for (const [requirement, named] of Object.entries(EVIDENCE)) {
    assert.ok(named.length > 0, `${requirement}: a release test is named`);
    for (const [file, id] of named) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${requirement}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
  for (const own of testDeclarations(SELF, read(SELF))) assert.deepEqual([own.level, own.guards.includes("UC-029")], ["release", true], own.id);
});

// ---------------------------------------------------------------- what a test declares

// TST-774302 · level: release · module: system
// guards: EVERY TEST HAS ONE LEVEL; UC-029
// given: the product of tests/uc-029-harness.mjs at main: nine declared tests, of which TST-107 declares no level and every other one level
// input: the reviewer opens Tests → Browser at main
// expect: known positive — TST-101 stands under unit; every declared test stands exactly once on the page; each complete test under the one level it declares (101, 102, 104 unit; 103 component; 105, 106, 110 release); TST-107 under Incomplete with "level" and under no level
test("TST-774302: each test stands under the one level it declares, and a test without one is named incomplete", async () => {
  const page = await render();
  assert.ok(idsOf(groupNamed(page, "unit")).includes("TST-101"), "known positive: TST-101 under unit");
  const ids = idsOf(page);
  assert.equal(new Set(ids).size, ids.length, "each test stands once");
  assert.deepEqual(["unit", "component", "release"].map((level) => idsOf(groupNamed(page, level))), [["TST-101", "TST-102", "TST-104"], ["TST-103"], ["TST-105", "TST-106", "TST-110"]]);
  const incomplete = casesOf(withClass(page, "tests-incomplete")[0]).map((each) => [textOf(each, "tests-id"), textOf(each, "tests-missing")]);
  assert.ok(incomplete.some(([id, missing]) => id === "TST-107" && missing === "level"));
});

// TST-774303 · level: release · module: system
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS; UC-029
// given: the product of tests/uc-029-harness.mjs, whose branch test-results cannot be read; TST-105 declares the precondition "a library", the input "a call" and the expected result "the reader sees the loan"
// input: the reviewer opens TST-105
// expect: known positive — no result can be read: the history says "The history could not be read"; the detail still shows the precondition "a library", the input "a call" and the expected result "the reader sees the loan"
test("TST-774303: an opened test's precondition, input and expected result are read without any run of it", async () => {
  const page = await render(hostOf({ failResults: true }), { row: "TST-105" });
  assert.match(textOf(page, "test-detail"), /The history could not be read/, "known positive: no result record is read");
  assert.deepEqual([textOf(page, "test-given"), textOf(page, "test-input"), textOf(page, "test-expect")], ["a library", "a call", "the reader sees the loan"]);
});

// TST-774304 · level: release · module: system
// guards: A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; UC-029
// given: the product of tests/uc-029-harness.mjs, where only TST-101 has docs/tests/counter-proofs/TST-101.md (outcome failed, the fault "The loan's reader is dropped."); and the same product with a record for TST-102 too
// input: the reviewer opens TST-101, and filters the tests without counter-proof in both products
// expect: known positive — TST-101's detail shows its record with "outcome: failed" and the fault; the filter lists every test but TST-101; with a record for TST-102 as well, the filter lists neither TST-101 nor TST-102
test("TST-774304: a test's counter-proof is shown, and the tests without one are found by a filter", async () => {
  const detail = await render(hostOf(), { row: "TST-101" });
  assert.match(textOf(detail, "test-counter-proof"), /outcome: failed/, "known positive: the record says the test failed on its fault");
  assert.match(textOf(detail, "test-counter-proof"), /The loan's reader is dropped\./);
  const without = async (files) => { const page = await render(hostOf({ files })); await choose(page, "tests-filter", "without counter-proof"); return idsOf(page); };
  assert.deepEqual(await without(FILES), ["TST-102", "TST-104", "TST-103", "TST-105", "TST-106", "TST-110", "TST-107", "TST-108"]);
  const recorded = { ...FILES, "docs/tests/counter-proofs/TST-102.md": FILES["docs/tests/counter-proofs/TST-101.md"].replace("test: TST-101", "test: TST-102") };
  const left = await without(recorded);
  assert.ok(!left.includes("TST-101") && !left.includes("TST-102"), JSON.stringify(left));
});

// TST-774305 · level: release · module: system
// guards: A MODEL-DEPENDENT TEST IS MEASURED AS A RATE; UC-029
// given: the product of tests/uc-029-harness.mjs; TST-104 declares 5 runs and passed 4 of 5 on HEAD, 3 of 5 at v2026.2.0 and 2 of 5 at v2026.1.0; TST-101 is deterministic
// input: the reviewer reads TST-104 and TST-101 in the tree, and opens both
// expect: known positive — TST-101 reads "passed" and has no rate line; TST-104 reads "passed (4 of 5)", its rate line has the points "v2026.2.0: 3 of 5" and "v2026.1.0: 2 of 5", and the filter model-dependent keeps it alone
test("TST-774305: a model-dependent test is shown with its rate and the runs behind it, per release", async () => {
  const page = await render();
  assert.equal(outcomeOf(page, "TST-101"), "passed", "known positive: a deterministic test has no rate");
  assert.equal(withClass(await render(hostOf(), { row: "TST-101" }), "test-rate-point").length, 0, "known positive: nor a rate line");
  assert.equal(outcomeOf(page, "TST-104"), "passed (4 of 5)");
  assert.deepEqual(textsOf(await render(hostOf(), { row: "TST-104" }), "test-rate-point"), ["v2026.2.0: 3 of 5", "v2026.1.0: 2 of 5"]);
  await choose(page, "tests-filter", "model-dependent");
  assert.deepEqual(idsOf(page), ["TST-104"]);
});

// ---------------------------------------------------------------- outcomes from the records

// TST-774306 · level: release · module: system
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-029
// given: the product of tests/uc-029-harness.mjs: its records say TST-101 passed and TST-105 failed on HEAD; the same product with HEAD's records taken away; and the same product whose branch test-results cannot be read
// input: the reviewer opens Tests → Browser at main over each
// expect: known positive — with the records, TST-101 passed and TST-105 failed; without HEAD's records, every test reads "not run" though earlier commits' records say TST-101 passed and failed; with the branch unreadable, the page says "The results could not be read" and every test reads "not run", none passed
test("TST-774306: each outcome shown is the one the result records of the head give, and none without them", async () => {
  const page = await render();
  assert.deepEqual([outcomeOf(page, "TST-101"), outcomeOf(page, "TST-105")], ["passed", "failed"], "known positive: the outcomes of HEAD's records");
  const withoutHead = Object.fromEntries(Object.entries(RECORDS).filter(([path]) => !path.startsWith(`runs/${HEAD}/`)));
  assert.deepEqual([...new Set(casesOf(await render(hostOf({ results: withoutHead }))).map(lineOf).map(([, , outcome]) => outcome))], ["not run"]);
  const unread = await render(hostOf({ failResults: true }));
  assert.match(unread.textContent, /The results could not be read/);
  assert.deepEqual([...new Set(casesOf(unread).map(lineOf).map(([, , outcome]) => outcome))], ["not run"]);
});

// TST-774307 · level: release · module: system
// guards: A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY; UC-029
// given: the product of tests/uc-029-harness.mjs: on HEAD one record says TST-103 passed and another that it failed; the same product without the record in which it failed
// input: the reviewer reads TST-103 in the tree, filters the flaky tests, and opens TST-103, over each
// expect: known positive — without the failing record TST-103 reads passed and the filter flaky keeps nothing; with both records it reads flaky, never passed, the filter keeps it alone, and its history marks HEAD flaky
test("TST-774307: a test that passed and failed on the same commit is shown as flaky, never as passed", async () => {
  const oneRecord = Object.fromEntries(Object.entries(RECORDS).filter(([path]) => !path.endsWith("-commit-0002.md")));
  const calm = await render(hostOf({ results: oneRecord }));
  assert.equal(outcomeOf(calm, "TST-103"), "passed", "known positive: one passing record reads passed");
  await choose(calm, "tests-filter", "flaky");
  assert.deepEqual(idsOf(calm), []);
  const page = await render();
  assert.equal(outcomeOf(page, "TST-103"), "flaky");
  await choose(page, "tests-filter", "flaky");
  assert.deepEqual(idsOf(page), ["TST-103"]);
  const detail = await render(hostOf(), { row: "TST-103" });
  assert.deepEqual(withClass(detail, "test-history-flaky").map((mark) => mark.textContent.slice(0, 13)), [`${short(HEAD)} flaky`]);
});

// ---------------------------------------------------------------- traces

// TST-774308 · level: release · module: system
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; UC-029
// given: the product of tests/uc-029-harness.mjs: TST-101 names LOANS ARE RECORDED and UC-001 and the module MOD-loans; TST-108 names a module and guards nothing
// input: the reviewer opens TST-101, groups by module, and filters the tests that guard nothing
// expect: known positive — TST-101's detail names LOANS ARE RECORDED and UC-001, and it stands in the group MOD-loans; the filter guards nothing keeps TST-108 alone, which Incomplete names with "guards"
test("TST-774308: what each test guards and the module it exercises are shown, and a test that guards nothing is named", async () => {
  assert.deepEqual(textsOf(await render(hostOf(), { row: "TST-101" }), "test-guards-item"), ["LOANS ARE RECORDED", "UC-001"], "known positive: the names a test guards");
  const page = await render();
  await choose(page, "tests-grouping", "module");
  assert.ok(idsOf(groupNamed(page, "MOD-loans")).includes("TST-101"));
  await choose(page, "tests-filter", "guards nothing");
  assert.deepEqual(idsOf(page), ["TST-108"]);
  assert.equal(textOf(withClass(page, "tests-incomplete")[0], "tests-missing"), "guards");
});

// TST-774309 · level: release · module: system
// guards: THE TRACEABILITY MATRIX IS DERIVED; UC-029
// given: the product of tests/uc-029-harness.mjs, where FINES ARE CAPPED is guarded by TST-102 (unit) alone; the same product with a file tests/fines.test.mjs that declares TST-111, a release test guarding FINES ARE CAPPED; and its tag v2026.1.0, whose SPEC holds LATE FEES APPLY
// input: the reviewer groups by requirement over each product at main, and at v2026.1.0
// expect: known positive — FINES ARE CAPPED shows unit: 1 and release: empty; with the new file, release: 1 and the cases TST-111 and TST-102, in the order of their files; at v2026.1.0 the groups are the tag's requirements, LATE FEES APPLY among them, not marked broken, holding TST-106
test("TST-774309: the levels that guard each requirement are derived from the test files of the version shown", async () => {
  const groupsOf = async (host, params) => { const page = await render(host, params); await choose(page, "tests-grouping", "requirement"); return page; };
  assert.deepEqual(levelsOf(groupNamed(await groupsOf(hostOf()), "FINES ARE CAPPED")), LEVELS(1, "empty", "empty", "empty", "empty"), "known positive: no release test yet");
  const added = await groupsOf(hostOf({ files: { ...FILES, "tests/fines.test.mjs": declared("TST-111", { level: "release", guards: "FINES ARE CAPPED" }, "a fine is capped for a reader") } }));
  assert.deepEqual(levelsOf(groupNamed(added, "FINES ARE CAPPED")), LEVELS(1, "empty", "empty", 1, "empty"));
  assert.deepEqual(idsOf(groupNamed(added, "FINES ARE CAPPED")), ["TST-111", "TST-102"]);
  const tagged = await groupsOf(hostOf(), { ref: "v2026.1.0" });
  assert.deepEqual(textsOf(tagged, "tests-group-name"), ["LOANS ARE RECORDED", "RETURNS CLOSE A LOAN", "FINES ARE CAPPED", "LATE FEES APPLY"]);
  assert.deepEqual([textsOf(tagged, "tests-broken"), idsOf(groupNamed(tagged, "LATE FEES APPLY"))], [[], ["TST-106"]]);
});

// TST-774310 · level: release · module: system
// guards: UNREALISED REQUIREMENTS ARE REPORTED, NOT FORBIDDEN; UC-029
// given: the product of tests/uc-029-harness.mjs with a fourth requirement, HOLDS ARE QUEUED, which no test guards, and the use case UC-003, which no test guards
// input: the reviewer opens Tests → Browser at main, groups by requirement, then by use case
// expect: known positive — the tree still shows the nine declared tests; HOLDS ARE QUEUED is a group with every level empty and no case; UC-003 is a group with every level empty; neither is marked broken
test("TST-774310: a requirement or use case no test guards is shown with every level empty, and the page is drawn all the same", async () => {
  const files = { ...FILES, "SPEC.md": `${FILES["SPEC.md"]}**HOLDS ARE QUEUED** *(Vibe Coding)*\nHolds are queued.\n*Check:* at review.\n`,
    "docs/use-cases/UC-003-place-a-hold.md": FILES["docs/use-cases/UC-001-lend-a-book.md"].replaceAll("UC-001", "UC-003").replaceAll("Lend a book", "Place a hold") };
  const page = await render(hostOf({ files }));
  assert.equal(idsOf(page).length, 9, "known positive: every test is drawn");
  await choose(page, "tests-grouping", "requirement");
  assert.deepEqual([levelsOf(groupNamed(page, "HOLDS ARE QUEUED")), idsOf(groupNamed(page, "HOLDS ARE QUEUED"))], [LEVELS("empty", "empty", "empty", "empty", "empty"), []]);
  assert.ok(!textsOf(page, "tests-broken").includes("HOLDS ARE QUEUED"));
  await choose(page, "tests-grouping", "use case");
  assert.deepEqual([levelsOf(groupNamed(page, "UC-003")), idsOf(groupNamed(page, "UC-003"))], [LEVELS("empty", "empty", "empty", "empty", "empty"), []]);
  assert.ok(!textsOf(page, "tests-broken").includes("UC-003"));
});

// TST-774311 · level: release · module: system
// guards: THE NAME IS THE ID AND IT SURVIVES; UC-029
// given: the product of tests/uc-029-harness.mjs: TST-101 moved from tests/loans.test.mjs (v2026.1.0) to tests/loans/records.test.mjs (v2026.2.0); TST-109 was removed after v2026.1.0
// input: the reviewer compares v2026.2.0 with v2026.1.0, and opens TST-101 and TST-109 at main by their identifiers
// expect: known positive — TST-109 is listed as removed; TST-101 is neither added nor removed; opened at main, TST-101 is the test of tests/loans/records.test.mjs, and TST-109, which main no longer declares, is still found by its identifier with its declaration from v2026.1.0, in tests/release.test.mjs
test("TST-774311: a test keeps its identifier when it moves to another file, and a removed test is still found by it", async () => {
  const compared = await render(hostOf(), { ref: "v2026.2.0", compare: "v2026.1.0" });
  const ids = (className) => textsOf(withClass(compared, className)[0], "tests-compared-id");
  assert.deepEqual(ids("tests-compare-removed"), ["TST-109"], "known positive: a removed test is listed as removed");
  assert.ok(!ids("tests-compare-added").includes("TST-101") && !ids("tests-compare-removed").includes("TST-101"));
  assert.equal(textOf(await render(hostOf(), { row: "TST-101" }), "test-code"), "tests/loans/records.test.mjs");
  const removed = await render(hostOf(), { row: "TST-109" });
  assert.match(textOf(removed, "test-detail"), /^TST-109 a loan has a due date/);
  assert.equal(textOf(removed, "test-code"), "tests/release.test.mjs");
});
