// Release tests of the requirements UC-030 "Audit the tests of a release" realises, each checked from what an auditor reads on Tests → Audit and in the document Export saves: every requirement valid at the release
// with its row, the acceptance of the release test report, the outcomes and rates read from the result records of the release commit, a result record never replaced by another, a counter-proof shown only for a
// test that failed on its fault, the release tests written by an implementer, the level a test declares, the matrix derived from the tag, what a requirement constrains, a source's authority, version and hash, the
// exact text an approval names, the gate record of a process requirement, the document as Markdown that names only what the repository holds, and the writes that only a person's click makes, in one click.
// TST-775301 maps every requirement UC-030 realises to the release tests that guard it: this file's, and those other writers wrote; the check SPEC.md names for THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE
// RELEASE is tests/test_audit_view.py, with its cases in tests/test_audit_view.md.
// Run: node --test tests/release-uc-030-audit-the-tests-of-a-release.test.mjs
//
// Module: MOD-trace-pages
// Module: MOD-release-evidence
// Guards: UC-030
// Level: release
//
// Written for the release testing of sprint 142 by developer-sonnet-k (ITM-775), who implemented none of the behaviour any case of this file guards: the code UC-030's flow runs carries the
// `Agent-M-Participant` trailers of developer-sonnet-a (ITM-768), developer-sonnet-b (ITM-770), developer-sonnet-e (ITM-658) and developer-opus-b (ITM-1224, ITM-1227), and ITM-756 and ITM-757 carry none
// (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). Of the code these modules call, developer-sonnet-k built ITM-1285, testDeclarations' reading of a backquote inside a quoted string or a comment; no case here
// guards it. The world is tests/uc-030-harness.mjs': the route `trace` of MOD-trace-pages with the key "audit" over a product and an instance held in memory. Where the page and the SPEC or UC-030 disagreed, the
// case would follow the text and be marked `todo` with the word FINDING; none of this file's does (the findings stand in tests/system-uc-030-audit-the-tests-of-a-release.test.mjs). Readings the texts leave open,
// which the cases state:
//   - "the tests guarding it, their outcomes on the release commit" (THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE) is read as the outcome the records of the release commit give each test of a row, not run where
//     the commit has no record of it.
//   - "every test of the product, at every level, has run on the release candidate's commit" (A RELEASE RUNS EVERY TEST AT EVERY LEVEL) is read, on this page, as a test with no record of the release commit being shown
//     as not run and counted among those that did not pass; the run itself is UC-028's.
//   - "is committed to the branch test-results" (TEST RESULTS ARE KEPT IN THE REPOSITORY) is read as the audit reading the outcomes from that branch alone.
//   - "no record on it is changed or deleted" (A RESULT RECORD IS NEVER REWRITTEN) is read as every record of the release commit being counted, a later record not replacing an earlier one, and the page writing to
//     no path of that branch.
//   - "a release test whose recorded author equals the implementing participant" (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER) is read as a release test of a `write-tests` job record whose participant is that of an
//     `implement` job record that works on an item or use case tracing to the requirement.
//   - "no artifact references a file or service that exists only inside Agent M" (THE PRODUCT REPOSITORY IS SELF-SUFFICIENT) is read, of the exported document, as every path it names standing in the product's
//     repository, and no web address standing in it.

import test from "node:test";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { ACCEPTED_BY, BOOK, BOOK_FILE_HASH, BOOK_HASH, IEC_FILE_HASH, IEC_HASH, COUNTER_PROOF_PATH, COMMIT, EXACT, FAST, GATE_PATH, IEC, INSTANCE_SPEC, KEPT, LATE, LIMITATIONS, CAPPED, OLD, OLDER, POSTED, PROCESS, RECORD, RELEVANT,
  REPORT, REPORT_TEXT, TAG, approvalOf, buttonNamed, choose, countOf, declared, exported, find, gateRecordOf, gitBlob, headFiles, instanceFiles, instanceHost, names, numbers, optionsOf, press, productFiles,
  productHost, render, renderExportable, resultFiles, rowOf, rows, rule, run, textsOf, tickGaps, withClass, ALL } from "./uc-030-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-030-audit-the-tests-of-a-release.md";
const SELF = "tests/release-uc-030-audit-the-tests-of-a-release.test.mjs";
const CHECK = "tests/test_audit_view.py";
const outcomesOf = (row) => textsOf(row, "audit-outcome");
const evidenceOf = (page) => [...new Set(rows(page).map((row) => textsOf(row, "audit-evidence")[0]))];
const limitationsOf = (page) => find(withClass(page, "audit-limitations")[0] ?? page, (node) => node.localName === "li").map((item) => item.textContent);
/** The document Export saves for `host`. */
const documentOf = async (host) => (await exported(host)).text;
const SPEC_TEXT = productFiles()["SPEC.md"];

// ---------------------------------------------------------------- the map

// Each requirement UC-030 realises, with the release tests that guard it: this file's, and those other writers wrote.
const EVIDENCE = {
  "THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE": [[SELF, "TST-775302"], [SELF, "TST-775303"], [CHECK, "TST-775401"]],
  "THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON": [[SELF, "TST-775304"], ["tests/release-uc-028-run-and-review.test.mjs", "TST-773107"]],
  "A RELEASE RUNS EVERY TEST AT EVERY LEVEL": [[SELF, "TST-775305"], ["tests/release-uc-028-run-and-review.test.mjs", "TST-773105"]],
  "EVERY TEST RUN LEAVES A RESULT RECORD": [[SELF, "TST-775306"], ["tests/release-uc-028-run-and-review.test.mjs", "TST-773101"]],
  "TEST RESULTS ARE KEPT IN THE REPOSITORY": [[SELF, "TST-775307"], ["tests/release-uc-028-run-and-review.test.mjs", "TST-773102"]],
  "A RESULT RECORD IS NEVER REWRITTEN": [[SELF, "TST-775308"], ["tests/release-uc-028-run-and-review.test.mjs", "TST-773102"]],
  "A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED": [[SELF, "TST-775309"], ["tests/release-uc-028-run-and-review.test.mjs", "TST-773106"]],
  "A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT": [[SELF, "TST-775310"], ["tests/release-uc-029-browse-the-tests-of-a-product.test.mjs", "TST-774304"]],
  "A MODEL-DEPENDENT TEST IS MEASURED AS A RATE": [[SELF, "TST-775311"], ["tests/release-uc-028-run-and-review.test.mjs", "TST-773104"]],
  "RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER": [[SELF, "TST-775312"], ["tests/release-uc-026-generate-a-multi-level-test-battery.test.mjs", "TST-771316"]],
  "EVERY TEST HAS ONE LEVEL": [[SELF, "TST-775313"], ["tests/release-uc-029-browse-the-tests-of-a-product.test.mjs", "TST-774302"]],
  "THE TRACEABILITY MATRIX IS DERIVED": [[SELF, "TST-775314"], ["tests/release-uc-020-gaps.test.mjs", "TST-020701"]],
  "A REQUIREMENT NAMES WHAT IT CONSTRAINS": [[SELF, "TST-775315"]],
  "A SOURCE DECLARES ITS AUTHORITY": [[SELF, "TST-775316"], ["tests/release-uc-004-register-a-requirement-source.test.mjs", "TST-370309"]],
  "A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH": [[SELF, "TST-775317"], ["tests/release-uc-015-link-sources.test.mjs", "TST-639007"]],
  "AN APPROVAL NAMES THE EXACT TEXT": [[SELF, "TST-775318"]],
  "THE GATE IS RECORDED": [[SELF, "TST-775319"]],
  "ARTIFACTS ARE MARKDOWN": [[SELF, "TST-775320"]],
  "THE PRODUCT REPOSITORY IS SELF-SUFFICIENT": [[SELF, "TST-775321"]],
  "THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK": [[SELF, "TST-775322"]],
  "ONE CLICK PER DECISION": [[SELF, "TST-775323"]],
};

// TST-775301 · level: release · module: system
// guards: UC-030
// given: UC-030 as committed text, whose `realises` lists twenty-one requirements, and the release tests named in EVIDENCE
// input: read UC-030's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-030 realises these twenty-one requirements; the map holds exactly them; each has at least one release test named; each test named stands in its file with the level release and guards that requirement; every case of this file declares the level release and guards UC-030
test("TST-775301: UC-030 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 21, "known positive: UC-030 realises twenty-one requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-030 realises");
  for (const [requirement, named] of Object.entries(EVIDENCE)) {
    assert.ok(named.length > 0, `${requirement}: a release test is named`);
    for (const [file, id] of named) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${requirement}: ${file} exists`);
      const found = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(found, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(found.level, "release", `${id} is a release test`);
      assert.ok((found.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
  for (const own of testDeclarations(SELF, read(SELF))) assert.deepEqual([own.level, own.guards.includes("UC-030")], ["release", true], own.id);
});

// ---------------------------------------------------------------- the rows

// TST-775302 · level: release · module: system
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; UC-030
// given: the product of tests/uc-030-harness.mjs at v2026.4.0: seven requirements in its SPEC, ENTRIES ARE POSTED with passing tests, BALANCES ARE EXACT with a failed one, REFUNDS ARE CAPPED and LATE FEES APPLY with none, and the instance's A PROCESS RULE; and the same product whose SPEC at the tag holds one more requirement, A NEW RULE, which no test guards
// input: the auditor opens Tests → Audit at v2026.4.0 over each product
// expect: known positive — one row for each requirement, once: the seven of the SPEC at the tag and A PROCESS RULE, among them the one with a failed test and the three with none; with the new requirement a ninth row, A NEW RULE, which says "no test"; the number without a test reads 3 and then 4
test("TST-775302: the audit lists a row for every requirement valid at the release, those with no test or no passing outcome included", async () => {
  const page = await render();
  assert.deepEqual(names(page), ALL, "known positive: the eight requirements of the release, once each");
  assert.deepEqual([outcomesOf(rowOf(page, EXACT)), textsOf(rowOf(page, CAPPED), "audit-no-test")], [["failed"], ["no test"]]);
  assert.equal(numbers(page).noTest, "3");
  const product = { ...productFiles(), "SPEC.md": `${SPEC_TEXT}\n${rule("A NEW RULE", "Vibe Coding", "A new rule.", "no automatic check; at review").join("\n")}` };
  const more = await render(productHost({ product }));
  assert.deepEqual(names(more), [...ALL.slice(0, 7), "A NEW RULE", PROCESS]);
  assert.deepEqual([textsOf(rowOf(more, "A NEW RULE"), "audit-no-test"), numbers(more).noTest], [["no test"], "4"]);
});

// TST-775303 · level: release · module: system
// guards: THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; UC-030
// given: the product of TST-775302, whose report was accepted by akmaier on 2026-10-12 08:30 UTC
// input: the auditor reads the acceptance in the rows of ENTRIES ARE POSTED (passing), BALANCES ARE EXACT (failed), REFUNDS ARE CAPPED (no test) and A PROCESS RULE
// expect: known positive — each of the eight rows names the acceptance of the release test report, accepted by akmaier on 2026-10-12 08:30 UTC, whatever its outcome and including the rows with no test or no passing outcome
test("TST-775303: the acceptance of the release test report stands on every row, those with no test or no passing outcome included", async () => {
  const page = await render();
  assert.deepEqual(textsOf(rowOf(page, POSTED), "audit-evidence"), ["accepted by akmaier on 2026-10-12 08:30 UTC"], "known positive: a passing row");
  for (const name of [EXACT, CAPPED, KEPT, LATE, PROCESS]) assert.deepEqual(textsOf(rowOf(page, name), "audit-evidence"), ["accepted by akmaier on 2026-10-12 08:30 UTC"], name);
  assert.deepEqual(evidenceOf(page), ["accepted by akmaier on 2026-10-12 08:30 UTC"]);
});

// ---------------------------------------------------------------- the report and its acceptance

// TST-775304 · level: release · module: system
// guards: THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON; UC-030
// given: the product of TST-775302 with, on its default branch, the report and an approval record that names the report's text, added by akmaier; the same with the record added by carol; the same with the record added by akmaier and changed later by dave; the same with no record; the same with the report as its text was when the record was written, changed afterwards
// input: the auditor opens Tests → Audit at v2026.4.0 over each
// expect: known positive — with the record that names the report's text, every row reads accepted by akmaier on 2026-10-12 08:30 UTC; added by carol it reads accepted by carol; added by akmaier and changed by dave it still reads accepted by akmaier on 2026-10-12 (the commit that added the record); with no record, or with a record that names an earlier text of the report, every row reads evidence not accepted and no row reads accepted
test("TST-775304: the release test report counts as accepted only when an approval record names its text, by the person who added it", async () => {
  assert.deepEqual(evidenceOf(await render()), ["accepted by akmaier on 2026-10-12 08:30 UTC"], "known positive: a record that names the text");
  const carol = { ...ACCEPTED_BY, author: { account: "carol", name: "Carol" } };
  assert.deepEqual(evidenceOf(await render(productHost({ recordHistory: [carol] }))), ["accepted by carol on 2026-10-12 08:30 UTC"]);
  const dave = { ...ACCEPTED_BY, commit: "9".repeat(40), author: { account: "dave", name: "Dave" }, date: "2026-10-13 09:00 UTC" };
  assert.deepEqual(evidenceOf(await render(productHost({ recordHistory: [dave, ACCEPTED_BY] }))), ["accepted by akmaier on 2026-10-12 08:30 UTC"]);
  assert.deepEqual(evidenceOf(await render(productHost({ head: headFiles(false) }))), ["evidence not accepted"]);
  const changed = { ...headFiles(false), [REPORT]: `${REPORT_TEXT}A line added after the acceptance.\n`, [RECORD]: approvalOf(LIMITATIONS) };
  assert.deepEqual(evidenceOf(await render(productHost({ head: changed }))), ["evidence not accepted"]);
});

// TST-775305 · level: release · module: system
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-030
// given: the product of TST-775302 whose branch test-results holds a record of every test on the release commit; and the same with no record of the two release tests TST-702 and TST-703
// input: the auditor opens Tests → Audit at v2026.4.0 over each, and presses the number of requirements with a test that did not pass
// expect: known positive — with every test run, no test reads "not run" and the number reads 1 (BALANCES ARE EXACT); with the release tests unrun, TST-702 and TST-703 read "not run", the number reads 2 and opens BALANCES ARE EXACT and ENTRIES ARE POSTED
test("TST-775305: a test of the release that has no result on the release commit is shown as not run and counted among those that did not pass", async () => {
  const complete = await render();
  assert.deepEqual([textsOf(complete, "audit-outcome").includes("not run"), numbers(complete).notPassed], [false, "1"], "known positive: a complete run");
  const partial = resultFiles();
  partial[`runs/${COMMIT}/a.md`] = run(COMMIT, [["TST-701", "unit", "passed", ""], ["TST-705", "unit", "passed", ""], ["TST-706", "unit", "passed", "9 of 10"], ["TST-707", "unit", "passed", "6 of 10"]], 5001);
  const page = await render(productHost({ results: partial }));
  assert.deepEqual(outcomesOf(rowOf(page, POSTED)), ["passed", "not run", "not run"]);
  assert.equal(numbers(page).notPassed, "2");
  await press(countOf(page, "notPassed"));
  assert.deepEqual(names(page), [POSTED, EXACT]);
});

// TST-775306 · level: release · module: system
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; UC-030
// given: the product of TST-775302: TST-701 passed in the record of the release commit and in the record of the last release's commit; and the same product whose only record of TST-701 is that of the last release's commit
// input: the auditor reads the outcome of TST-701 at v2026.4.0 over each
// expect: known positive — with a record of the release commit TST-701 reads passed; with the record of another commit alone it reads "not run", not passed
test("TST-775306: a test's outcome is the one the result records of the release commit give, and none without a record of that commit", async () => {
  assert.deepEqual(outcomesOf(rowOf(await render(), POSTED))[0], "passed", "known positive: the release commit's record");
  const results = resultFiles();
  results[`runs/${COMMIT}/a.md`] = run(COMMIT, [["TST-702", "release", "passed", ""], ["TST-703", "release", "passed", ""], ["TST-705", "unit", "passed", ""]], 5001);
  const page = await render(productHost({ results }));
  assert.deepEqual(outcomesOf(rowOf(page, POSTED)), ["not run", "passed", "passed"]);
});

// TST-775307 · level: release · module: system
// guards: TEST RESULTS ARE KEPT IN THE REPOSITORY; UC-030
// given: the product of TST-775302 whose records stand on the branch test-results; and the same product whose branch holds none while its own tree holds the same record text under runs/<release commit>/
// input: the auditor reads the outcomes at v2026.4.0 over each
// expect: known positive — from the branch, TST-701 reads passed and TST-704 failed; with the records only in the product's tree, no outcome is read from them: every test reads "not run"
test("TST-775307: the outcomes are read from the branch test-results of the repository and from nowhere else", async () => {
  const onBranch = await render();
  assert.deepEqual([outcomesOf(rowOf(onBranch, POSTED))[0], outcomesOf(rowOf(onBranch, EXACT))[0]], ["passed", "failed"], "known positive: the branch's records");
  const elsewhere = { ...productFiles(), [`runs/${COMMIT}/a.md`]: resultFiles()[`runs/${COMMIT}/a.md`], [`runs/${COMMIT}/b.md`]: resultFiles()[`runs/${COMMIT}/b.md`] };
  const page = await render(productHost({ product: elsewhere, results: { "README.md": "none\n", [`runs/${OLD}/old.md`]: resultFiles()[`runs/${OLD}/old.md`] } }));
  assert.deepEqual([...new Set(textsOf(page, "audit-outcome"))], ["not run"]);
});

// TST-775308 · level: release · module: system
// guards: A RESULT RECORD IS NEVER REWRITTEN; UC-030
// given: the product of TST-775302 for a person with write access; TST-705 passed in one record of the release commit and failed in another; a later record of the same commit says TST-701 failed, beside the earlier that says it passed
// input: the auditor reads the outcomes of TST-705 and TST-701 over each product, and commits the export
// expect: known positive — TST-705 reads flaky, never passed or failed alone; with the later record added TST-701 reads flaky too: the earlier record still counts; the commit of the export holds docs/audits/v2026.4.0.md alone and no path of the branch test-results
test("TST-775308: a later result record does not replace an earlier one, and the audit writes none", async () => {
  assert.deepEqual(outcomesOf(rowOf(await render(), KEPT)), ["flaky"], "known positive: both records count");
  const results = { ...resultFiles(), [`runs/${COMMIT}/c.md`]: run(COMMIT, [["TST-701", "unit", "failed", ""]], 5003) };
  const host = productHost({ results, canWrite: true });
  const world = await renderExportable(host);
  try {
    assert.deepEqual(outcomesOf(rowOf(world.target, POSTED))[0], "flaky");
    await world.press(buttonNamed(world.target, "Commit export"));
    assert.deepEqual(host.commits.map((change) => change.files.map((file) => file.path)), [[`docs/audits/${TAG}.md`]]);
  } finally { world.restore(); }
});

// TST-775309 · level: release · module: system
// guards: A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; UC-030
// given: the red release of TST-775302 (BALANCES ARE EXACT failed, AUDIT TRAILS ARE KEPT flaky, HINTS ARE RELEVANT worse), whose approval records the reason "TST-705 — flaky on the CI runner" and "TST-707 — the model answers worse than at the last release"; the same release accepted with other reasons; and the same accepted with none
// input: the auditor opens the audit of v2026.4.0 over each, and reads the document Export saves for the first
// expect: known positive — the limitations stand as the approval recorded them, each with its reason, before the numbers, and the document lists both; with other reasons the page shows those reasons; with none it shows no limitation, and the red numbers (did not pass 1, flaky 1, worse 1) are the same on all three
test("TST-775309: a red release shows the limitations its approval records, each with its reason, at the top of the summary", async () => {
  const page = await render();
  assert.deepEqual(limitationsOf(page), LIMITATIONS, "known positive: as recorded");
  const order = find(page, (node) => ["audit-limitations", "audit-count"].some((name) => String(node.className).split(" ").includes(name))).map((node) => node.className.split(" ")[0]);
  assert.equal(order[0], "audit-limitations");
  const text = await documentOf(productHost());
  assert.ok(LIMITATIONS.every((line) => text.includes(`- ${line}`)));
  const other = ["TST-704 — fixed in the next release"];
  const reasoned = await render(productHost({ head: headFiles(true, other) }));
  assert.deepEqual(limitationsOf(reasoned), other);
  const none = await render(productHost({ head: headFiles(true, []) }));
  assert.equal(limitationsOf(none).length, 0);
  for (const each of [page, reasoned, none]) assert.deepEqual([numbers(each).notPassed, numbers(each).flaky, numbers(each).worse], ["1", "1", "1"]);
});

// TST-775310 · level: release · module: system
// guards: A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; UC-030
// given: the product of TST-775302 where only TST-701 has a counter-proof record, of outcome failed; the same where the record of TST-701 says the test passed with the fault planted; and the same with a record of outcome failed for TST-702 too
// input: the auditor reads the counter-proof of the tests of ENTRIES ARE POSTED over each, and the exported document of the first
// expect: known positive — TST-701 shows docs/tests/counter-proofs/TST-701.md, TST-702 and TST-703 none, and the document says "no counter-proof" for them; with the record saying passed, TST-701 shows none; with a record for TST-702 it shows docs/tests/counter-proofs/TST-702.md
test("TST-775310: a test's counter-proof is shown when its record says the test failed on the planted fault, and its absence is stated", async () => {
  const counter = (page, id) => withClass(page, "audit-test-line").find((line) => textsOf(line, "audit-test")[0] === id) && textsOf(withClass(page, "audit-test-line").find((line) => textsOf(line, "audit-test")[0] === id), "audit-counter-proof")[0];
  const page = await render();
  assert.deepEqual([counter(page, "TST-701"), counter(page, "TST-702"), counter(page, "TST-703")], [COUNTER_PROOF_PATH, undefined, undefined], "known positive: one counter-proof");
  const text = await documentOf(productHost());
  assert.ok(text.includes(`counter-proof \`${COUNTER_PROOF_PATH}\``) && text.includes("`TST-702` (release): passed; no counter-proof"));
  const passing = { ...productFiles(), [COUNTER_PROOF_PATH]: productFiles()[COUNTER_PROOF_PATH].replace("outcome: failed", "outcome: passed") };
  assert.equal(counter(await render(productHost({ product: passing })), "TST-701"), undefined);
  const both = { ...productFiles(), "docs/tests/counter-proofs/TST-702.md": productFiles()[COUNTER_PROOF_PATH].replace("test: TST-701", "test: TST-702") };
  assert.equal(counter(await render(productHost({ product: both })), "TST-702"), "docs/tests/counter-proofs/TST-702.md");
});

// TST-775311 · level: release · module: system
// guards: A MODEL-DEPENDENT TEST IS MEASURED AS A RATE; UC-030
// given: the product of TST-775302: TST-706 declares 10 runs and passed 9 of 10 at the release, 8 of 10 at the last release; TST-707 passed 6 of 10, against 8 of 10; TST-701 is deterministic; and the same where the last release's rate of TST-707 was 6 of 10
// input: the auditor reads the rates and the number of requirements with a rate worse than the previous release's over each, and presses it
// expect: known positive — TST-706 reads 9 of 10 and TST-707 6 of 10, TST-701 passed; the number reads 1 and opens HINTS ARE RELEVANT alone; where the last release's rate was equal, it reads 0
test("TST-775311: a model-dependent test is shown as a rate, and a rate worse than the previous release's is counted", async () => {
  const page = await render();
  assert.deepEqual([outcomesOf(rowOf(page, FAST))[0], outcomesOf(rowOf(page, RELEVANT))[0], outcomesOf(rowOf(page, POSTED))[0]], ["9 of 10", "6 of 10", "passed"], "known positive: rates and a plain outcome");
  assert.equal(numbers(page).worse, "1");
  await press(countOf(page, "worse"));
  assert.deepEqual(names(page), [RELEVANT]);
  const results = { ...resultFiles(), [`runs/${OLD}/old.md`]: run(OLD, [["TST-706", "unit", "passed", "8 of 10"], ["TST-707", "unit", "passed", "6 of 10"]]) };
  assert.equal(numbers(await render(productHost({ results }))).worse, "0");
});

// TST-775312 · level: release · module: system
// guards: RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; UC-030
// given: the product of TST-775302: dev-a implemented ITM-900, which realises ENTRIES ARE POSTED; TST-703, a release test of it, was written by dev-a and TST-702 by dev-b; dev-a also wrote the unit test TST-701; and the same product where dev-a wrote TST-702 as well
// input: the auditor reads the number of release tests written by the implementer over each, and presses it
// expect: known positive — it reads 1 and opens ENTRIES ARE POSTED: TST-703 is counted, TST-702 (written by dev-b) and TST-701 (a unit test) are not; where dev-a wrote TST-702 too, it reads 2; the document says "Release tests written by the implementer: 1"
test("TST-775312: a release test written by the participant that implemented the behaviour is counted, and no other test is", async () => {
  const page = await render();
  assert.equal(numbers(page).byImplementer, "1", "known positive: TST-703");
  await press(countOf(page, "byImplementer"));
  assert.deepEqual(names(page), [POSTED]);
  const jobs = (participant) => ({ ...productFiles(), "docs/jobs/JOB-20261001-0903-dddd.md": productFiles()["docs/jobs/JOB-20261001-0901-bbbb.md"].replace("id: JOB-20261001-0901-bbbb", "id: JOB-20261001-0903-dddd").replace("participant: dev-b", `participant: ${participant}`) });
  assert.equal(numbers(await render(productHost({ product: jobs("dev-a") }))).byImplementer, "2");
  assert.equal(numbers(await render(productHost({ product: jobs("dev-c") }))).byImplementer, "1");
  assert.match(await documentOf(productHost()), /Release tests written by the implementer: 1/);
});

// TST-775313 · level: release · module: system
// guards: EVERY TEST HAS ONE LEVEL; UC-030
// given: the product of TST-775302: TST-701, TST-704, TST-705, TST-706 and TST-707 declare the level unit, TST-702 and TST-703 release; and the same product where TST-704 declares the level component
// input: the auditor reads the choice of levels and chooses a level in turn
// expect: known positive — the choice offers all, unit and release; every test stands on the page once with the one level it declares (TST-701 unit, TST-702 release); unit leaves ENTRIES ARE POSTED, BALANCES ARE EXACT, AUDIT TRAILS ARE KEPT, SUMMARIES ARE FAST and HINTS ARE RELEVANT, release leaves ENTRIES ARE POSTED; with TST-704 declared component the choice offers component and it leaves BALANCES ARE EXACT alone
test("TST-775313: each test stands under the one level it declares, and the audit offers exactly the levels the tests declare", async () => {
  const page = await render();
  assert.deepEqual(optionsOf(page, "audit-filter-level"), ["all", "unit", "release"], "known positive: the levels declared");
  const ids = withClass(page, "audit-test-line").map((line) => `${textsOf(line, "audit-test")[0]} ${textsOf(line, "audit-level")[0]}`);
  assert.deepEqual(ids, ["TST-701 unit", "TST-702 release", "TST-703 release", "TST-704 unit", "TST-705 unit", "TST-706 unit", "TST-707 unit"]);
  await choose(page, "audit-filter-level", "release");
  assert.deepEqual(names(page), [POSTED]);
  const product = { ...productFiles(), "tests/failing.test.mjs": declared("TST-704", "component", EXACT, "MOD-ledger") };
  const other = await render(productHost({ product }));
  assert.deepEqual(optionsOf(other, "audit-filter-level"), ["all", "unit", "release", "component"]);
  await choose(other, "audit-filter-level", "component");
  assert.deepEqual(names(other), [EXACT]);
});

// ---------------------------------------------------------------- traces

// TST-775314 · level: release · module: system
// guards: THE TRACEABILITY MATRIX IS DERIVED; UC-030
// given: the product of TST-775302 at v2026.4.0, whose tests/failing.test.mjs declares TST-704 guarding BALANCES ARE EXACT; the same product where it guards REFUNDS ARE CAPPED instead; and the earlier tag v2026.3.0
// input: the auditor opens the audit over each, and picks v2026.3.0 over the first
// expect: known positive — BALANCES ARE EXACT lists TST-704 and REFUNDS ARE CAPPED none; where the file guards REFUNDS ARE CAPPED, the first lists none ("no test") and the second TST-704: the rows follow the test files of the tag; at v2026.3.0 the rows are ENTRIES ARE POSTED with TST-701 and LATE FEES APPLY with none
test("TST-775314: the rows are derived from the tests of the tag, and nothing stored decides which test guards a requirement", async () => {
  const page = await render();
  assert.deepEqual([textsOf(rowOf(page, EXACT), "audit-test"), textsOf(rowOf(page, CAPPED), "audit-no-test")], [["TST-704"], ["no test"]], "known positive: the tag's files");
  const product = { ...productFiles(), "tests/failing.test.mjs": declared("TST-704", "unit", CAPPED, "MOD-ledger") };
  const moved = await render(productHost({ product }));
  assert.deepEqual([textsOf(rowOf(moved, EXACT), "audit-no-test"), textsOf(rowOf(moved, CAPPED), "audit-test")], [["no test"], ["TST-704"]]);
  await choose(page, "version-choice", OLDER);
  assert.deepEqual([names(page), textsOf(rowOf(page, POSTED), "audit-test"), textsOf(rowOf(page, LATE), "audit-no-test")], [[POSTED, LATE], ["TST-701"], ["no test"]]);
});

// TST-775315 · level: release · module: system
// guards: A REQUIREMENT NAMES WHAT IT CONSTRAINS; UC-030
// given: the product of TST-775302, whose SPEC holds seven requirements, and the instance, whose SPEC holds A PROCESS RULE, which the product's workflow adds a gate for; and the same instance with a second requirement, ANOTHER PROCESS RULE, for which the workflow has no gate
// input: the auditor reads what each row constrains over each instance
// expect: known positive — the seven requirements of the product's SPEC constrain the product and A PROCESS RULE the process; ANOTHER PROCESS RULE has no row
test("TST-775315: each row says whether its requirement constrains the product or the development process", async () => {
  const page = await render();
  assert.deepEqual(rows(page).map((row) => [row.getAttribute("data-requirement"), textsOf(row, "audit-constrains")[0]]),
    [...ALL.slice(0, 7).map((name) => [name, "product"]), [PROCESS, "process"]], "known positive: product and process");
  const instance = { ...instanceFiles(), "SPEC.md": `${INSTANCE_SPEC}\n${rule("ANOTHER PROCESS RULE", "Vibe Coding", "Another rule.", "no automatic check; at review").join("\n")}` };
  assert.deepEqual(names(await render(productHost(), { key: "audit", ref: TAG }, instanceHost(instance))), ALL);
});

// TST-775316 · level: release · module: system
// guards: A SOURCE DECLARES ITS AUTHORITY; UC-030
// given: the instance's register declares SRC-vibe-coding advisory and SRC-iec-62304 normative; and the same register with SRC-vibe-coding declared normative and SRC-iec-62304 informational
// input: the auditor reads the authority named beside each source of ENTRIES ARE POSTED and sets the filter only normative sources, over each register
// expect: known positive — beside the sources: advisory and normative, and the filter leaves ENTRIES ARE POSTED; with the changed register: normative and informational, and the filter leaves all eight rows, each of which cites SRC-vibe-coding
test("TST-775316: a source's authority is the one its register entry declares, and the filter keeps the rows that cite a normative source", async () => {
  const page = await render();
  assert.match(rowOf(page, POSTED).textContent, /SRC-vibe-coding \(advisory, 2026-10-05\) SRC-iec-62304 \(normative, 2015\)/, "known positive: as declared");
  await choose(page, "audit-filter-normative", "normative");
  assert.deepEqual(names(page), [POSTED]);
  const instance = { ...instanceFiles(), "docs/sources/SRC-vibe-coding.md": BOOK.replace("authority: advisory", "authority: normative"), "docs/sources/SRC-iec-62304.md": IEC.replace("authority: normative", "authority: informational") };
  const changed = await render(productHost(), { key: "audit", ref: TAG }, instanceHost(instance));
  assert.match(rowOf(changed, POSTED).textContent, /SRC-vibe-coding \(normative, 2026-10-05\) SRC-iec-62304 \(informational, 2015\)/);
  await choose(changed, "audit-filter-normative", "normative");
  assert.deepEqual(names(changed), ALL);
});

// TST-775317 · level: release · module: system
// guards: A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; UC-030
// given: the product of TST-775302 links SRC-vibe-coding at the version 2026-10-05 with the version's hash, and SRC-iec-62304 at 2015 with its hash; and the same where the register has since added a newer version of SRC-vibe-coding, 2027-01-01, with a file of another hash
// input: the auditor reads the sources of ENTRIES ARE POSTED and the document Export saves, over each
// expect: known positive — the sources show the versions 2026-10-05 and 2015, and the document names both with the version's hash and the SHA-256 of its file; with the newer version in the register the row and the document still name 2026-10-05 and its hashes, and name the newer version's file hash nowhere
test("TST-775317: a source is shown at the version and hash the product links, and the document names the version with its hashes", async () => {
  const text = await documentOf(productHost());
  assert.match(rowOf(await render(), POSTED).textContent, /SRC-vibe-coding \(advisory, 2026-10-05\)/, "known positive: the linked version");
  for (const named of ["version `2026-10-05`", "version `2015`", BOOK_HASH, BOOK_FILE_HASH, IEC_HASH, IEC_FILE_HASH]) assert.ok(text.includes(named), `the document names ${named}`);
  const newer = createHash("sha256").update("The next edition of the chapter.\n", "utf8").digest("hex");
  const grown = `${BOOK.replace("| `2026-10-05` | 2026-10-01 | fixture | fixture only | listed below |", "| `2026-10-05` | 2026-10-01 | fixture | fixture only | listed below |\n| `2027-01-01` | 2027-01-01 | fixture | fixture only | listed below |")}\n### Files of 2027-01-01\n\n| File | SHA-256 |\n|---|---|\n| \`08_requirements-engineering.md\` | \`${newer}\` |\n`;
  assert.ok(grown.includes("`2027-01-01`") && grown.includes(newer), "known positive: the register holds the newer version");
  const register = () => instanceHost({ ...instanceFiles(), "docs/sources/SRC-vibe-coding.md": grown });
  const page = await render(productHost(), { key: "audit", ref: TAG }, register());
  assert.match(rowOf(page, POSTED).textContent, /SRC-vibe-coding \(advisory, 2026-10-05\)/);
  assert.ok(!rowOf(page, POSTED).textContent.includes("2027-01-01"));
  const later = (await exported(productHost(), register())).text;
  assert.ok(later.includes(BOOK_HASH) && later.includes(BOOK_FILE_HASH) && !later.includes(newer) && !later.includes("2027-01-01"));
});

// TST-775318 · level: release · module: system
// guards: AN APPROVAL NAMES THE EXACT TEXT; UC-030
// given: the product of TST-775302, whose report has the git blob SHA b and whose approval record names b; and the same where the report's text has changed since the record was written (the new blob b2)
// input: the auditor reads the document Export saves over each
// expect: known positive — the document names the report with the blob b, the approval record with its own blob and the accepted text as the blob b, and says "Release test report accepted: yes"; with the changed report it names the report at b2, and no accepted text: the record's b is not the current text
test("TST-775318: the audit names the exact text an approval accepted, and a report changed since is not that text", async () => {
  const text = await documentOf(productHost());
  const recordBlob = gitBlob(headFiles()[RECORD]);
  assert.ok(text.includes(`Release test report: \`${REPORT}\`, blob \`${gitBlob(REPORT_TEXT)}\``) && text.includes(`Approval record: \`${RECORD}\`, blob \`${recordBlob}\``), "known positive: report and record");
  assert.ok(text.includes(`Accepted text: blob \`${gitBlob(REPORT_TEXT)}\``) && text.includes("Release test report accepted: yes"));
  const next = `${REPORT_TEXT}A line added after the acceptance.\n`;
  const later = await documentOf(productHost({ head: { ...headFiles(), [REPORT]: next } }));
  assert.ok(later.includes(`Release test report: \`${REPORT}\`, blob \`${gitBlob(next)}\``));
  assert.ok(!later.includes("Accepted text:") && later.includes("Release test report accepted: no"));
});

// TST-775319 · level: release · module: system
// guards: THE GATE IS RECORDED; UC-030
// given: the product of TST-775302 whose docs/gates/ holds the record of the gate A PROCESS RULE added, and a record of another gate
// input: the auditor reads the row of A PROCESS RULE and of ENTRIES ARE POSTED, and the document
// expect: known positive — the process row lists docs/gates/20261010-1000-a-process-rule-alic.md alone, and the document names it as the row's gate record; a product row lists none; the record of the other gate is on no row
test("TST-775319: a process requirement's row names the gate record that records its gate, and a product requirement's row none", async () => {
  const product = { ...productFiles(), "docs/gates/20261010-0900-plan-build-alic.md": gateRecordOf("Plan → Build") };
  const page = await render(productHost({ product }));
  assert.deepEqual([textsOf(rowOf(page, PROCESS), "audit-gate"), textsOf(rowOf(page, POSTED), "audit-gate")], [[GATE_PATH], []], "known positive: the recorded gate");
  assert.deepEqual(textsOf(page, "audit-gate"), [GATE_PATH], "the record of another gate is on no row");
  const text = await documentOf(productHost());
  assert.ok(text.includes(`- Gate record: \`${GATE_PATH}\``));
  assert.equal((text.match(/Gate record:/g) ?? []).length, 1);
});

// ---------------------------------------------------------------- the document

// TST-775320 · level: release · module: system
// guards: ARTIFACTS ARE MARKDOWN; UC-030
// given: the product of TST-775302 for a person with write access, in a browser whose download is faked
// input: the auditor presses Export, and Commit export
// expect: known positive — the saved file is named v2026.4.0.md and its type is text/markdown; its text opens with a front matter fence naming the tag and the commit, then the title "# Audit of v2026.4.0" and the sections "## Summary", "## Evidence", "## Requirements", a heading "###" for each of the eight rows, and holds no HTML tag; the committed file is docs/audits/v2026.4.0.md with that text
test("TST-775320: the audit is saved and committed as a Markdown document", async () => {
  const host = productHost({ canWrite: true });
  const world = await renderExportable(host);
  try {
    await world.press(buttonNamed(world.target, "Export"));
    const [blob] = world.downloads.blobs;
    const text = await blob.text();
    assert.deepEqual([world.downloads.clicked[0].download, blob.type], ["v2026.4.0.md", "text/markdown"], "known positive: the file");
    assert.ok(text.startsWith(`---\ntag: ${TAG}\ncommit: ${COMMIT}\n---\n# Audit of ${TAG}\n`));
    assert.deepEqual(["## Summary", "## Evidence", "## Requirements"].map((heading) => text.includes(`\n${heading}\n`)), [true, true, true]);
    assert.equal((text.match(/^### /gm) ?? []).length, 8);
    assert.doesNotMatch(text, /<\/?[a-z][^>]*>/i);
    await world.press(buttonNamed(world.target, "Commit export"));
    assert.deepEqual(host.commits[0].files, [{ path: `docs/audits/${TAG}.md`, text }]);
  } finally { world.restore(); }
});

// TST-775321 · level: release · module: system
// guards: THE PRODUCT REPOSITORY IS SELF-SUFFICIENT; UC-030
// given: the product of TST-775302: its files at the tag and on its default branch; the exported audit document
// input: read the paths the document names in code spans, and look for a web address
// expect: known positive — the document names the report, the approval record, a counter-proof and a gate record, and each path it names stands in the product's repository (at the tag or on the default branch); it holds no web address and names no page of a site of Agent M
test("TST-775321: the audit document names only paths of the product's repository, and no service", async () => {
  const text = await documentOf(productHost());
  const files = new Set([...Object.keys(productFiles()), ...Object.keys(headFiles())]);
  const span = new RegExp("\\u0060((?:docs|tests|src)/[^\\u0060\\s]+|SPEC\\.md)\\u0060", "g");
  const paths = [...new Set([...text.matchAll(span)].map((match) => match[1]))];
  for (const path of [REPORT, RECORD, COUNTER_PROOF_PATH, GATE_PATH]) assert.ok(paths.includes(path), `known positive: the document names ${path}`);
  assert.deepEqual(paths.filter((path) => !files.has(path)), [], "every path it names stands in the product's repository");
  assert.doesNotMatch(text, /https?:\/\/|\.github\.io|#trace\/|#release/);
});

// ---------------------------------------------------------------- the person's click

// TST-775322 · level: release · module: system
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-030
// given: the product of TST-775302 for a person with write access, whose host records every commit and every other write
// input: the audit is opened, another release picked, filters set and Export pressed; then Commit export is pressed by a click that is not the person's, and then by the person
// expect: known positive — until the person's click, no commit and no other write; the click that is not the person's writes nothing; the person's click makes one commit holding docs/audits/v2026.4.0.md
test("TST-775322: the audit writes to the repository only when the person presses Commit export", async () => {
  const host = productHost({ canWrite: true });
  const world = await renderExportable(host);
  try {
    await choose(world.target, "version-choice", OLDER);
    await choose(world.target, "version-choice", TAG);
    await choose(world.target, "audit-filter-level", "unit");
    await tickGaps(world.target, true);
    await world.press(buttonNamed(world.target, "Export"));
    assert.deepEqual([host.commits, host.writes], [[], []], "known positive: nothing written by reading");
    await world.press(buttonNamed(world.target, "Commit export"), false);
    assert.deepEqual([host.commits, host.writes], [[], []]);
    await world.press(buttonNamed(world.target, "Commit export"));
    assert.deepEqual(host.commits.map((change) => change.files.map((file) => file.path)), [[`docs/audits/${TAG}.md`]]);
    assert.deepEqual(host.writes, []);
  } finally { world.restore(); }
});

// TST-775323 · level: release · module: system
// guards: ONE CLICK PER DECISION; UC-030
// given: the product of TST-775302 for a person with write access, with every input complete (the release picked)
// input: the person presses Export once, and Commit export once
// expect: known positive — one click on Export makes one download holding the whole document (the summary and eight rows) with no further control appearing; one click on Commit export makes one commit holding the same document, and the page asks nothing more
test("TST-775323: Export and Commit export each take one click once the release is picked", async () => {
  const host = productHost({ canWrite: true });
  const world = await renderExportable(host);
  try {
    const before = find(world.target, (node) => node.localName === "button").map((node) => node.textContent);
    await world.press(buttonNamed(world.target, "Export"));
    assert.equal(world.downloads.blobs.length, 1, "known positive: one download");
    const text = await world.downloads.blobs[0].text();
    assert.ok(text.includes("## Summary") && (text.match(/^### /gm) ?? []).length === 8);
    await world.press(buttonNamed(world.target, "Commit export"));
    assert.deepEqual(host.commits.map((change) => change.files), [[{ path: `docs/audits/${TAG}.md`, text }]]);
    assert.deepEqual(find(world.target, (node) => node.localName === "button").map((node) => node.textContent), before, "no further control appears");
    assert.equal(world.downloads.blobs.length, 1);
  } finally { world.restore(); }
});
