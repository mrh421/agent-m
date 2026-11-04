// System coverage for UC-030 Audit the tests of a release, walked as an auditor meets it on Tests → Audit: the flow map (TST-775201) names, for every step of the main flow, every alternative flow and the
// postcondition, the executable tests that walk it, the finding where the page does otherwise, or the reason it is not walked; and the cases walk the use case as a whole on one product at a release tag — the release
// picked and one row per requirement valid at it (1, 2), the sources, the tests with outcome, rate and counter-proof, and the gate records of a process requirement (2), the summary whose numbers open the rows they
// count (3), the filters and the links of a row (4), Export and the audit document (5), Commit export (5a), a report not accepted (2a), a release accepted with limitations (2b), a requirement with no test (2c), a
// server that keeps no run page or no log (2d), a release before Agent M's records (1a), and nothing written. The page is the real route `trace` of MOD-trace-pages with the key "audit", over the real
// MOD-release-evidence, MOD-result-records, MOD-trace-graph, MOD-source-register, MOD-approvals and MOD-product-process, behind tests/uc-030-harness.mjs' host in memory. No request leaves the process.
// Run: node --test tests/system-uc-030-audit-the-tests-of-a-release.test.mjs
//
// Module: MOD-trace-pages
// Module: MOD-release-evidence
// Guards: UC-030
// Level: system
//
// Authored by developer-sonnet-k (ITM-775). The `Agent-M-Participant` trailers of the code UC-030's flow runs (src/release-evidence/audit.mjs, src/trace-pages/audit.mjs, export.mjs and flow.mjs' audit branch) name
// developer-sonnet-a (ITM-768), developer-sonnet-b (ITM-770), developer-sonnet-e (ITM-658) and developer-opus-b (ITM-1224, ITM-1227); ITM-756 and ITM-757 carry no trailer. developer-sonnet-k built none of it; of the code
// these modules call it built ITM-1285, testDeclarations' reading of a backquote inside a quoted string or a comment, which no case here guards. Where the page and UC-030 disagree the case follows UC-030 and is
// marked `todo` with the word FINDING and its module (named in FLOW_FINDINGS). Each case states its input and its expected values in its own text and proves them against a known positive in the same case; none
// reads an expected result from the SPEC, a use case or an architecture file, but the flow map, which holds the expected passages itself and checks that UC-030 still says them. Readings the texts leave open, which
// the cases state:
//   - "The auditor opens Tests → Audit and picks a release tag" (1) is read as the route `trace` with the key "audit": the choice offers the release tags of the product, newest first, and no other tag.
//   - "the requirement's name, what it constrains, and its sources with their authority and version" (2) is read as what each row of the page shows: `audit-constrains`, and the sources with authority and version.
//   - "Each number opens the rows it counts" (3) is read as pressing the number leaves the rows its count was made of; pressing it again leaves all rows.
//   - "If the viewer is a person who may accept, Agent M offers the report with Accept" (2a) is read as the page's link to MOD-test-pages' release panel, where Accept stands; the page offers it to every viewer.
//   - "only the link to the server's log is marked unavailable" (2d) is read as the row's run link replaced by the mark `unavailable`, the outcomes still read from the branch `test-results`.
//   - "Nothing was written" (postcondition) is read as no call of a method of the product's host that writes, while every step but Commit export is walked.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { ACCEPTING, ADDRESS, ALL, CAPPED, COMMIT, EXACT, FAST, GATE_PATH, HEAD, KEPT, LATE, OLDER, POSTED, PROCESS, RECORD, RELEVANT, REPORT_BLOB, TAG, BOOK_HASH, BOOK_FILE_HASH, IEC_HASH,
  IEC_FILE_HASH, buttonNamed, choose, countOf, find, headFiles, names, numbers, optionsOf, press, productFiles, productHost, render, renderExportable, rowOf, rows, runPage, textsOf, tickGaps, withClass } from "./uc-030-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-030-audit-the-tests-of-a-release.md";
const SELF = "tests/system-uc-030-audit-the-tests-of-a-release.test.mjs";
const RELEASE = "tests/release-uc-030-audit-the-tests-of-a-release.test.mjs";
const PAGE = "tests/trace-pages-audit.test.mjs", ROWS = "tests/release-evidence-audit.test.mjs", CANDIDATE = "tests/trace-pages-audit-candidate.test.mjs";
const lineOf = (line) => [textsOf(line, "audit-test")[0], textsOf(line, "audit-level")[0], textsOf(line, "audit-outcome")[0], textsOf(line, "audit-counter-proof")[0] ?? null];
const testsOf = (row) => withClass(row, "audit-test-line").map(lineOf);

// ---------------------------------------------------------------- the flow map

// The passages of UC-030 the system tests walk, each with the executable tests that walk it: this file's cases, and the older tests of the audit view, which declare the level component or unit.
const FLOW_EVIDENCE = {
  "main-1-pick": { uc: "The auditor opens **Tests → Audit** and picks a release tag.", evidence: [[SELF, "TST-775202"], [PAGE, "TST-768001"]] },
  "main-2-rows": { uc: "derives one row per requirement valid at that release:", evidence: [[SELF, "TST-775202"], [PAGE, "TST-768003"]] },
  "main-2-unrecorded-gate": { uc: "derives one row per requirement valid at that release:", evidence: [[SELF, "TST-775220"]] },
  "main-2-sources": { uc: "the requirement's name, what it constrains (product or process), and its sources with their authority and version", evidence: [[SELF, "TST-775203"], [PAGE, "TST-768005"], [ROWS, "TST-756002"]] },
  "main-2-tests": { uc: "the tests guarding it, by level, each with its outcome or rate on the release commit and its counter-proof;", evidence: [[SELF, "TST-775203"], [PAGE, "TST-768005"]] },
  "main-2-artifacts": { uc: "for a process requirement, also the gate records and artifacts it added to the workflow", evidence: [[SELF, "TST-775204"]] },
  "main-2-blob": { uc: "the acceptance of the release test report: who, when, and the blob SHA of the accepted text.", evidence: [[SELF, "TST-775205"]] },
  "main-2-acceptance": { uc: "the acceptance of the release test report: who, when, and the blob SHA of the accepted text.", evidence: [[SELF, "TST-775203"], [PAGE, "TST-768012"]] },
  "main-3-summary": { uc: "At the top, Agent M summarises:", evidence: [[SELF, "TST-775206"], [PAGE, "TST-768003"]] },
  "main-3-opens": { uc: "Each number opens the rows it counts.", evidence: [[SELF, "TST-775206"], [PAGE, "TST-768004"], [PAGE, "TST-1163002"]] },
  "main-3-passing": { uc: "Each number opens the rows it counts.", evidence: [[SELF, "TST-775207"]] },
  "main-4-filters": { uc: "The auditor filters — only normative sources, one source, one level, only gaps", evidence: [[SELF, "TST-775208"], [PAGE, "TST-768008"], [PAGE, "TST-768009"], [PAGE, "TST-768010"], [PAGE, "TST-768011"]] },
  "main-4-links": { uc: "opens a row to follow the links to the test, its run on the server, and the approval commit.", evidence: [[SELF, "TST-775209"], [PAGE, "TST-768012"]] },
  "main-5-export": { uc: "The auditor presses **Export** — one click.", evidence: [[SELF, "TST-775210"], ["tests/trace-pages-audit.test.mjs", "TST-770001"]] },
  "main-5-document": { uc: "Agent M produces one Markdown document with the summary and every row, naming the tag, the commit SHA, the source versions with their hashes, and the\n   blob SHAs of report and approvals", evidence: [[SELF, "TST-775210"], [ROWS, "TST-757101"]] },
  "2a-not-accepted": { uc: "**2a. The release test report has not been accepted.**", evidence: [[SELF, "TST-775212"], [PAGE, "TST-768013"]] },
  "2b-linked": { uc: "each linked to the rows it concerns", evidence: [[SELF, "TST-775214"]] },
  "2b-limitations": { uc: "**2b. The release was accepted with known limitations.** The limitations stand at the top of the summary", evidence: [[SELF, "TST-775213"], [PAGE, "TST-768003"]] },
  "2c-no-test": { uc: "**2c. A requirement has no test at any level.** Its row says *no test*; it is counted, not hidden.", evidence: [[SELF, "TST-775215"], [PAGE, "TST-768007"]] },
  "2d-log-gone": { uc: "**2d. The CI server no longer keeps the logs cited by the report.**", evidence: [[SELF, "TST-775217"]] },
  "2d-no-run-page": { uc: "The result records on the branch `test-results` still hold each outcome; only the link to the server's log is marked unavailable.", evidence: [[SELF, "TST-775216"], [PAGE, "TST-768014"]] },
  "1a-predates": { uc: "**1a. The release predates Agent M's test records.** Agent M says which parts cannot be derived for this tag and shows the rest.", evidence: [[SELF, "TST-775218"], [PAGE, "TST-768015"]] },
  "5a-commit-export": { uc: "**5a. The auditor wants the export in the repository.** A person with write access presses **Commit export**", evidence: [[SELF, "TST-775211"], [PAGE, "TST-770002"], [PAGE, "TST-770003"]] },
  "postcondition-nothing-written": { uc: "Nothing was written, unless the export was committed on a person's click.", evidence: [[SELF, "TST-775219"], [PAGE, "TST-770003"]] },
};
// The passages the page does otherwise: the finding, its case, and the module it points to.
const FLOW_FINDINGS = {
};
// The passages no code of this product carries, with the reason.
const NOT_WALKED = {
  "precondition-tagged": { uc: "The release is tagged (UC-013) after its complete run (UC-028, 1a), and its release test report is in the product repository.", reason: "the tagging and the run are UC-013's and UC-028's, whose batteries walk them; this file starts from a tagged product" },
  "main-5-pdf": { uc: "printing it gives a PDF.", reason: "the browser prints the saved document; no code of Agent M carries it" },
};

// TST-775201 · level: system · module: system
// guards: UC-030
// given: UC-030 as committed text, the executable tests named in FLOW_EVIDENCE, the findings named in FLOW_FINDINGS and the flows named in NOT_WALKED (the tagging and the printing, which no code of this product carries)
// input: compare every passage of the main flow, steps 1 to 5, of the alternative flows and of the postcondition with its executable evidence, its finding or the reason it is not walked
// expect: every named passage stands in UC-030; every evidence file exists and declares its TST id; this file's cases declare the level system; every finding's case stands in its file with the todo naming FINDING and its module; every alternative flow UC-030 names is among the passages; known positive: UC-030 names exactly the six alternative flows 1a, 2a, 2b, 2c, 2d and 5a, and each of the five main steps has a passage
test("TST-775201: UC-030 every passage of the main flow and of each alternative flow has an executable test, a finding or a stated reason", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  const missing = [];
  for (const [name, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-030 says "${needle}"`);
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
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-030 says "${needle}"`);
    assert.ok(read(file).includes(`// ${id} `), `${name}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} (${module})`), `${name}: the todo of ${id} names FINDING ${finding} and ${module}`);
  }
  for (const [name, { uc: needle, reason }] of Object.entries(NOT_WALKED)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-030 says "${needle}"`);
    assert.ok(reason.length > 20, `${name}: its reason is stated`);
  }
  const flows = [...uc.matchAll(/- \*\*(\d+[a-z])\. /g)].map((match) => match[1]).sort();
  assert.deepEqual(flows, ["1a", "2a", "2b", "2c", "2d", "5a"], "known positive: UC-030 names these six alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS, ...NOT_WALKED }).map((key) => key.split("-")[0]));
  assert.deepEqual(flows.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
  const steps = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS, ...NOT_WALKED }).filter((key) => key.startsWith("main-")).map((key) => Number(key.split("-")[1])));
  assert.deepEqual([...steps].sort((a, b) => a - b), [1, 2, 3, 4, 5], "each step of the main flow is among the passages");
  for (const own of testDeclarations(SELF, read(SELF))) assert.deepEqual([own.level, own.guards.includes("UC-030")], ["system", true], own.id);
  assert.ok(existsSync(new URL(`../${RELEASE}`, import.meta.url)) && existsSync(new URL(`../${CANDIDATE}`, import.meta.url)), "the release file and the candidate's audit test exist");
});

// ---------------------------------------------------------------- the main flow

// TST-775202 · level: system · module: system
// guards: UC-030; THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the product of tests/uc-030-harness.mjs: the tags v2026.4.0, v2026.3.0 and nightly; the SPEC at v2026.4.0 holds seven requirements, LATE FEES APPLY among them, which the default branch has withdrawn since and CHARGES ARE ITEMISED added since; the SPEC at v2026.3.0 holds ENTRIES ARE POSTED and LATE FEES APPLY
// input: the auditor opens Tests → Audit at v2026.4.0, then picks v2026.3.0 in the choice
// expect: known positive — the choice offers v2026.4.0 and v2026.3.0 and no nightly; at v2026.4.0 one row for each of the seven requirements of that SPEC, withdrawn LATE FEES APPLY included, then the process requirement, and no row for CHARGES ARE ITEMISED; after the pick the rows are ENTRIES ARE POSTED and LATE FEES APPLY, the release chosen
test("TST-775202: UC-030 1 the auditor picks a release tag and has one row for each requirement valid at that release", async () => {
  const page = await render();
  assert.deepEqual(optionsOf(page, "version-choice"), [TAG, OLDER], "known positive: the release tags, newest first, and no nightly");
  assert.deepEqual(names(page), ALL);
  assert.ok(!names(page).includes("CHARGES ARE ITEMISED"), "a requirement added after the tag has no row");
  await choose(page, "version-choice", OLDER);
  assert.equal(withClass(page, "version-choice")[0].value, OLDER);
  assert.deepEqual(names(page), [POSTED, LATE]);
});

// TST-775203 · level: system · module: system
// guards: UC-030; THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; A REQUIREMENT NAMES WHAT IT CONSTRAINS; A SOURCE DECLARES ITS AUTHORITY
// given: the product of TST-775202 at v2026.4.0, accepted by akmaier on 2026-10-12 08:30 UTC; ENTRIES ARE POSTED cites SRC-vibe-coding (advisory, 2026-10-05) and SRC-iec-62304 (normative, 2015) and is guarded by TST-701 (unit, with a counter-proof record), TST-702 and TST-703 (release), all passed; SUMMARIES ARE FAST by TST-706, model-dependent, 9 of 10; BALANCES ARE EXACT by TST-704, failed; AUDIT TRAILS ARE KEPT by TST-705, passed in one record and failed in another; A PROCESS RULE is the instance's, with one gate record
// input: the auditor reads the rows
// expect: known positive — ENTRIES ARE POSTED constrains the product, cites SRC-vibe-coding (advisory, 2026-10-05) and SRC-iec-62304 (normative, 2015), and lists TST-701 unit passed with docs/tests/counter-proofs/TST-701.md, TST-702 release passed, TST-703 release passed; TST-706 reads 9 of 10, TST-704 failed, TST-705 flaky; A PROCESS RULE constrains the process, lists the gate record docs/gates/20261010-1000-a-process-rule-alic.md and no test; every row reads accepted by akmaier on 2026-10-12 08:30 UTC
test("TST-775203: UC-030 2 a row shows what the requirement constrains, its sources with authority and version, its tests with outcome, rate and counter-proof, and the acceptance", async () => {
  const page = await render();
  const first = rowOf(page, POSTED);
  assert.deepEqual([textsOf(first, "audit-constrains")[0], textsOf(first, "audit-source")], ["product", ["SRC-vibe-coding", "SRC-iec-62304"]], "known positive: a product requirement and its sources");
  assert.match(first.textContent, /SRC-vibe-coding \(advisory, 2026-10-05\) SRC-iec-62304 \(normative, 2015\)/);
  assert.deepEqual(testsOf(first), [["TST-701", "unit", "passed", "docs/tests/counter-proofs/TST-701.md"], ["TST-702", "release", "passed", null], ["TST-703", "release", "passed", null]]);
  assert.deepEqual(testsOf(rowOf(page, FAST)), [["TST-706", "unit", "9 of 10", null]]);
  assert.deepEqual(testsOf(rowOf(page, EXACT)), [["TST-704", "unit", "failed", null]]);
  assert.deepEqual(testsOf(rowOf(page, KEPT)), [["TST-705", "unit", "flaky", null]]);
  const process = rowOf(page, PROCESS);
  assert.deepEqual([textsOf(process, "audit-constrains")[0], textsOf(process, "audit-gate"), withClass(process, "audit-test-line").length], ["process", [GATE_PATH], 0]);
  assert.deepEqual(rows(page).map((row) => textsOf(row, "audit-evidence")[0]), ALL.map(() => "accepted by akmaier on 2026-10-12 08:30 UTC"));
});

// TST-775204 · level: system · module: system
// guards: UC-030; THE GATE IS RECORDED
// given: the product of TST-775203, whose declaration docs/process.md adds the gate of A PROCESS RULE between Plan and Build with the artifact SPEC.md
// input: the auditor reads the row of A PROCESS RULE
// expect: known positive — the row lists the gate record docs/gates/20261010-1000-a-process-rule-alic.md; UC-030 2 asks for the gate records and the artifacts the requirement added to the workflow, so the row also names the artifact SPEC.md
test("TST-775204: UC-030 2 a process requirement's row names the gate records and the artifacts it added to the workflow", async () => {
  const process = rowOf(await render(), PROCESS);
  assert.deepEqual(textsOf(process, "audit-gate"), [GATE_PATH], "known positive: the gate record is named");
  assert.match(process.textContent, /SPEC\.md/, "the artifact the gate added is named in the row");
});

// TST-775205 · level: system · module: system
// guards: UC-030; AN APPROVAL NAMES THE EXACT TEXT
// given: the product of TST-775203, whose report docs/tests/releases/v2026.4.0.md has the blob b (the git blob SHA of its text) and whose approval record names b
// input: the auditor reads the acceptance of a row
// expect: known positive — the row reads accepted by akmaier on 2026-10-12 08:30 UTC; the row also names the blob SHA of the accepted text
test("TST-775205: UC-030 2 the acceptance of a row names who, when and the blob SHA of the accepted text", async () => {
  const row = rowOf(await render(), POSTED);
  assert.equal(textsOf(row, "audit-evidence")[0], "accepted by akmaier on 2026-10-12 08:30 UTC", "known positive: who and when");
  assert.ok(row.textContent.includes(REPORT_BLOB.slice(0, 12)), `the row names the blob ${REPORT_BLOB}`);
});

// TST-775206 · level: system · module: system
// guards: UC-030; THE TRACEABILITY MATRIX IS DERIVED; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: the product of TST-775203; the rows with no test are REFUNDS ARE CAPPED, LATE FEES APPLY and A PROCESS RULE; BALANCES ARE EXACT has a failed test, AUDIT TRAILS ARE KEPT a flaky one, HINTS ARE RELEVANT a rate worse than the last release's (6 of 10 against 8 of 10); TST-703, a release test of ENTRIES ARE POSTED, was written by dev-a, who implemented the item that realises it
// input: the auditor reads the summary, then presses the number without a test, the number that did not pass, the flaky one, the worse one and the one by the implementer, each on a fresh page, and the number without a test twice
// expect: known positive — the summary reads without a test 3, did not pass 1, flaky 1, worse 1, by the implementer 1; each press leaves the rows it counts: REFUNDS ARE CAPPED, LATE FEES APPLY and A PROCESS RULE; BALANCES ARE EXACT; AUDIT TRAILS ARE KEPT; HINTS ARE RELEVANT; ENTRIES ARE POSTED; the second press of the same number leaves all eight rows
test("TST-775206: UC-030 3 the summary counts the requirements without a test, with a test that did not pass, a flaky test, a worse rate and a release test by the implementer, and each number opens its rows", async () => {
  const page = await render();
  const counted = numbers(page);
  assert.deepEqual([counted.noTest, counted.notPassed, counted.flaky, counted.worse, counted.byImplementer], ["3", "1", "1", "1", "1"], "known positive: the numbers");
  for (const [kind, expected] of Object.entries({ noTest: [CAPPED, LATE, PROCESS], notPassed: [EXACT], flaky: [KEPT], worse: [RELEVANT], byImplementer: [POSTED] })) {
    const fresh = await render();
    await press(countOf(fresh, kind));
    assert.deepEqual(names(fresh), expected, kind);
  }
  const again = await render();
  await press(countOf(again, "noTest"));
  await press(countOf(again, "noTest"));
  assert.deepEqual(names(again), ALL, "the same number pressed twice leaves every row");
});

// TST-775207 · level: system · module: system
// guards: UC-030; THE TRACEABILITY MATRIX IS DERIVED
// given: the product of TST-775206; SUMMARIES ARE FAST is guarded by TST-706, model-dependent, which passed 9 of 10 against 8 of 10 at the last release (not worse), so its row has passing evidence; ENTRIES ARE POSTED too
// input: the auditor reads the number with passing evidence, presses it, and ticks only gaps
// expect: known positive — the number reads 2 and pressing it leaves ENTRIES ARE POSTED; the number counts two requirements and opens the rows of both, SUMMARIES ARE FAST among them, and only gaps leaves it out
test("TST-775207: UC-030 3 the number of requirements with passing evidence opens the rows it counts, a model-dependent test's included", async () => {
  const page = await render();
  assert.equal(numbers(page).passing, "2", "known positive: two requirements have passing evidence");
  await press(countOf(page, "passing"));
  assert.ok(names(page).includes(POSTED), "known positive: ENTRIES ARE POSTED is among the rows");
  assert.deepEqual(names(page), [POSTED, FAST], "the number opens the two rows it counts");
  const gaps = await render();
  await tickGaps(gaps, true);
  assert.ok(!names(gaps).includes(FAST), "a row with passing evidence is no gap");
});

// TST-775208 · level: system · module: system
// guards: UC-030
// given: the product of TST-775203; only SRC-iec-62304 is normative and only ENTRIES ARE POSTED cites it; ENTRIES ARE POSTED has unit and release tests, BALANCES ARE EXACT, AUDIT TRAILS ARE KEPT, SUMMARIES ARE FAST and HINTS ARE RELEVANT unit tests; ENTRIES ARE POSTED is the one row with passing, release-level evidence
// input: the auditor sets only normative sources, then one source (SRC-iec-62304, then SRC-vibe-coding), then one level (release, then unit), then ticks only gaps, then ticks it with the level release
// expect: known positive — normative leaves ENTRIES ARE POSTED; the choice of sources offers all, SRC-iec-62304 and SRC-vibe-coding, the first leaving ENTRIES ARE POSTED and the second all eight; the choice of levels offers all, unit and release, release leaving ENTRIES ARE POSTED and unit leaving it, BALANCES ARE EXACT, AUDIT TRAILS ARE KEPT, SUMMARIES ARE FAST and HINTS ARE RELEVANT; only gaps leaves out ENTRIES ARE POSTED and keeps BALANCES ARE EXACT, REFUNDS ARE CAPPED, AUDIT TRAILS ARE KEPT, HINTS ARE RELEVANT, LATE FEES APPLY and A PROCESS RULE; with the level release it leaves none
test("TST-775208: UC-030 4 the auditor filters by normative sources, one source, one level and only gaps, and the filters narrow together", async () => {
  const page = await render();
  await choose(page, "audit-filter-normative", "normative");
  assert.deepEqual(names(page), [POSTED], "known positive: the rows that cite a normative source");
  await choose(page, "audit-filter-normative", "all");
  assert.deepEqual(optionsOf(page, "audit-filter-source"), ["all", "SRC-iec-62304", "SRC-vibe-coding"]);
  await choose(page, "audit-filter-source", "SRC-iec-62304");
  assert.deepEqual(names(page), [POSTED]);
  await choose(page, "audit-filter-source", "SRC-vibe-coding");
  assert.deepEqual(names(page), ALL);
  await choose(page, "audit-filter-source", "all");
  assert.deepEqual(optionsOf(page, "audit-filter-level"), ["all", "unit", "release"]);
  await choose(page, "audit-filter-level", "release");
  assert.deepEqual(names(page), [POSTED]);
  await choose(page, "audit-filter-level", "unit");
  assert.deepEqual(names(page), [POSTED, EXACT, KEPT, FAST, RELEVANT]);
  await choose(page, "audit-filter-level", "all");
  await tickGaps(page, true);
  assert.deepEqual(names(page).filter((name) => name !== FAST), [EXACT, CAPPED, KEPT, RELEVANT, LATE, PROCESS], "only gaps leaves out the row with passing evidence");
  await choose(page, "audit-filter-level", "release");
  assert.deepEqual(names(page), [], "the filters narrow together");
});

// TST-775209 · level: system · module: system
// guards: UC-030; THE GATE IS RECORDED
// given: the product of TST-775203 on a server that offers the run page and the file page; the approval record of the report was added by the commit ACCEPTING; REFUNDS ARE CAPPED has no test
// input: the auditor opens the row of ENTRIES ARE POSTED and follows its links, and reads the row of REFUNDS ARE CAPPED
// expect: known positive — each test links #trace/key=tests/row=<its identifier> (TST-701, TST-702, TST-703); the run link is the page of the release commit's checks on the server; the approval link is the approval record at the commit ACCEPTING; the history was asked for the record's path without its changes; the row of REFUNDS ARE CAPPED links no run and no approval
test("TST-775209: UC-030 4 a row opens to the links to its tests, their run on the server and the approval commit", async () => {
  const host = productHost();
  const page = await render(host);
  const first = rowOf(page, POSTED);
  assert.deepEqual(withClass(first, "audit-test").map((link) => link.getAttribute("href")), ["TST-701", "TST-702", "TST-703"].map((id) => `#trace/key=tests/row=${id}`), "known positive: the tests");
  assert.deepEqual(withClass(first, "audit-run").map((link) => link.getAttribute("href")), [runPage(COMMIT)]);
  assert.deepEqual(withClass(first, "audit-approval").map((link) => link.getAttribute("href")), [`${ADDRESS}/blob/${ACCEPTING}/${RECORD}`]);
  assert.deepEqual(host.log.histories.filter(([path]) => path === RECORD).map(([, options]) => options.changes), [false]);
  const bare = rowOf(page, CAPPED);
  assert.equal(withClass(bare, "audit-run").length + withClass(bare, "audit-run-unavailable").length, 0);
});

// TST-775210 · level: system · module: system
// guards: UC-030; ARTIFACTS ARE MARKDOWN; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the product of TST-775203 on a server that offers the file page, in a browser whose download is faked; the book's version hash and file hash, the standard's version hash and file hash, the report's blob and the approval record's blob are known
// input: the auditor presses Export once
// expect: known positive — one download, an anchor named v2026.4.0.md clicked once; its Markdown names the tag v2026.4.0 and the commit SHA, the summary (passing 2, without a test 3, did not pass 1, flaky 1, worse 1, by the implementer 1), a section for each of the eight rows, the source versions 2026-10-05 and 2015 with the version hashes and the file hashes of both, the report's blob SHA and the approval record's blob SHA; nothing was committed
test("TST-775210: UC-030 5 Export is one click and saves one Markdown document with the summary, every row, the source versions with their hashes and the blob SHAs of report and approvals", async () => {
  const host = productHost();
  const world = await renderExportable(host);
  try {
    await world.press(buttonNamed(world.target, "Export"));
    assert.equal(world.downloads.blobs.length, 1, "known positive: one download");
    assert.deepEqual(world.downloads.clicked.map(({ download }) => download), ["v2026.4.0.md"]);
    const text = await world.downloads.blobs[0].text();
    const head = (await host.readSnapshot("main")).blob(RECORD);
    for (const named of [`tag: ${TAG}`, `commit: ${COMMIT}`, "Requirements with passing evidence: 2", "without a test: 3", "did not pass: 1", "flaky test: 1", "worse than the previous release: 1", "written by the implementer: 1",
      "version `2026-10-05`", "version `2015`", BOOK_HASH, BOOK_FILE_HASH, IEC_HASH, IEC_FILE_HASH, REPORT_BLOB, head, ...ALL.map((name) => `### ${name}`)]) assert.ok(text.includes(named), `the document names ${named}`);
    assert.deepEqual(host.commits, [], "Export commits nothing");
  } finally { world.restore(); }
});

// TST-775211 · level: system · module: system
// guards: UC-030; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION
// given: the product of TST-775203, whose default branch holds no file under docs/audits/; a person with write access, and a person without
// input: the person with write access presses Export, then a click that is not the person's on Commit export, then the person's own click; the person without write access opens the page
// expect: known positive — the first click that is not the person's commits nothing; the person's own makes one commit with the host's commitFiles on the branch main at the head read, holding one file docs/audits/v2026.4.0.md whose text is the exported document, and the page names the commit; the person without write access is offered Export and no Commit export, and nothing is committed
test("TST-775211: UC-030 5a a person with write access presses Commit export, which commits the document to docs/audits/<tag>.md", async () => {
  const host = productHost({ canWrite: true });
  const world = await renderExportable(host);
  try {
    await world.press(buttonNamed(world.target, "Export"));
    const exportedText = await world.downloads.blobs[0].text();
    assert.ok(buttonNamed(world.target, "Commit export"), "known positive: the person with write access is offered it");
    await world.press(buttonNamed(world.target, "Commit export"), false);
    assert.deepEqual(host.commits, [], "a click that is not the person's commits nothing");
    await world.press(buttonNamed(world.target, "Commit export"));
    assert.equal(host.commits.length, 1);
    assert.deepEqual([host.commits[0].branch, host.commits[0].expectedHead, host.commits[0].files], ["main", HEAD, [{ path: `docs/audits/${TAG}.md`, text: exportedText }]]);
    assert.match(world.target.textContent, /Committed docs\/audits\/v2026\.4\.0\.md in commit eeeeeee/);
  } finally { world.restore(); }
  const reader = productHost();
  const readerPage = await render(reader);
  assert.ok(buttonNamed(readerPage, "Export") && !buttonNamed(readerPage, "Commit export"), "a person without write access has Export alone");
  assert.deepEqual(reader.commits, []);
});

// ---------------------------------------------------------------- the alternative flows

// TST-775212 · level: system · module: system
// guards: UC-030; THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON
// given: the product of TST-775203 whose default branch holds the report and no approval record; and the same product accepted
// input: the auditor opens Tests → Audit at v2026.4.0 on each, and presses Export on the first
// expect: known positive — accepted, no row says evidence not accepted and the page has no offer; not accepted, every one of the eight rows reads evidence not accepted, the line "The release test report has not been accepted" stands before the limitations and before the numbers and holds a link to #release (Accept); the limitations name the missing approval record; no row links an approval commit; the exported document says that the report is accepted: no
test("TST-775212: UC-030 2a where the report has not been accepted every row says evidence not accepted, the summary says so first and Accept is offered", async () => {
  const accepted = await render();
  assert.deepEqual([withClass(accepted, "audit-not-accepted").length, rows(accepted).filter((row) => textsOf(row, "audit-evidence")[0] === "evidence not accepted").length], [0, 0], "known positive: an accepted report");
  const host = productHost({ head: headFiles(false) });
  const page = await render(host);
  assert.deepEqual(rows(page).map((row) => textsOf(row, "audit-evidence")[0]), ALL.map(() => "evidence not accepted"));
  const order = find(page, (node) => ["audit-not-accepted", "audit-limitations", "audit-count"].some((name) => String(node.className).split(" ").includes(name))).map((node) => node.className.split(" ")[0]);
  assert.deepEqual([order[0], order.indexOf("audit-limitations") > 0, order.indexOf("audit-count") > order.indexOf("audit-limitations")], ["audit-not-accepted", true, true]);
  assert.equal(withClass(page, "audit-accept")[0].getAttribute("href"), "#release");
  assert.match(textsOf(page, "audit-limitations")[0], /missing: approval record naming blob/);
  assert.equal(withClass(page, "audit-approval").length, 0);
  const world = await renderExportable(host);
  try {
    await world.press(buttonNamed(world.target, "Export"));
    assert.match(await world.downloads.blobs[0].text(), /Release test report accepted: no/);
  } finally { world.restore(); }
});

// TST-775213 · level: system · module: system
// guards: UC-030; A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED
// given: the product of TST-775203, whose approval records two limitations: "TST-705 — flaky on the CI runner" and "TST-707 — the model answers worse than at the last release"; and the same product accepted with none
// input: the auditor opens the audit of v2026.4.0 on each, and presses Export on the first
// expect: known positive — with none recorded no limitations list stands; with two, the list holds exactly the two lines, each with its reason, and stands before the first number; the exported document lists both under Limitations
test("TST-775213: UC-030 2b a release accepted with known limitations shows them at the top of the summary with the reason recorded in the approval", async () => {
  const green = await render(productHost({ head: headFiles(true, []) }));
  assert.equal(withClass(green, "audit-limitations").length, 0, "known positive: none recorded, none shown");
  const host = productHost();
  const page = await render(host);
  const list = withClass(page, "audit-limitations")[0];
  assert.deepEqual(find(list, (node) => node.localName === "li").map((item) => item.textContent), ["TST-705 — flaky on the CI runner", "TST-707 — the model answers worse than at the last release"]);
  const order = find(page, (node) => ["audit-limitations", "audit-count"].some((name) => String(node.className).split(" ").includes(name))).map((node) => node.className.split(" ")[0]);
  assert.equal(order[0], "audit-limitations");
  const world = await renderExportable(host);
  try {
    await world.press(buttonNamed(world.target, "Export"));
    const text = await world.downloads.blobs[0].text();
    assert.ok(text.includes("- TST-705 — flaky on the CI runner") && text.includes("- TST-707 — the model answers worse than at the last release"));
  } finally { world.restore(); }
});

// TST-775214 · level: system · module: system
// guards: UC-030; A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED
// given: the product of TST-775213; the limitation TST-705 concerns the row AUDIT TRAILS ARE KEPT, whose test it names, and TST-707 the row HINTS ARE RELEVANT
// input: the auditor reads the limitations at the top of the summary
// expect: known positive — the list holds both limitations, and the rows of AUDIT TRAILS ARE KEPT and HINTS ARE RELEVANT hold the tests TST-705 and TST-707; each limitation is linked to the rows it concerns
test("TST-775214: UC-030 2b each limitation is linked to the rows it concerns", async () => {
  const page = await render();
  const items = find(withClass(page, "audit-limitations")[0], (node) => node.localName === "li");
  assert.equal(items.length, 2, "known positive: both limitations");
  assert.deepEqual([textsOf(rowOf(page, KEPT), "audit-test")[0], textsOf(rowOf(page, RELEVANT), "audit-test")[0]], ["TST-705", "TST-707"]);
  for (const item of items) assert.ok(find(item, (node) => node.localName === "a").length > 0, `the limitation "${item.textContent}" links the rows it concerns`);
});

// TST-775215 · level: system · module: system
// guards: UC-030; THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE
// given: the product of TST-775203; REFUNDS ARE CAPPED, LATE FEES APPLY and A PROCESS RULE have no test at any level
// input: the auditor reads the rows without a filter, and the number without a test
// expect: known positive — ENTRIES ARE POSTED has no "no test" mark; each of the three rows is on the page, reads "no test" and lists no test line; the number without a test reads 3
test("TST-775215: UC-030 2c a requirement with no test at any level has its row, which says no test, and is counted", async () => {
  const page = await render();
  assert.deepEqual(textsOf(rowOf(page, POSTED), "audit-no-test"), [], "known positive: a row with tests carries no such mark");
  for (const name of [CAPPED, LATE, PROCESS]) {
    assert.deepEqual([textsOf(rowOf(page, name), "audit-no-test"), withClass(rowOf(page, name), "audit-test-line").length], [["no test"], 0], name);
  }
  assert.equal(numbers(page).noTest, "3");
});

// TST-775216 · level: system · module: system
// guards: UC-030; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the product of TST-775203 on a server that offers the run page, and on a server that offers none
// input: the auditor opens the audit of v2026.4.0 on each
// expect: known positive — on the server with the run page, each of the five rows with tests links the run and none is marked unavailable; on the other, no row links a run, each of those five reads "unavailable" in its place, and the outcomes are still read from the branch test-results (ENTRIES ARE POSTED passed, BALANCES ARE EXACT failed, AUDIT TRAILS ARE KEPT flaky, SUMMARIES ARE FAST 9 of 10); a row with no test has neither
test("TST-775216: UC-030 2d where the server offers no run page the link is marked unavailable and the outcomes stay", async () => {
  const withPage = await render(productHost());
  const tested = [POSTED, EXACT, KEPT, FAST, RELEVANT];
  assert.deepEqual(tested.map((name) => withClass(rowOf(withPage, name), "audit-run").length), [1, 1, 1, 1, 1], "known positive: a run link where the server offers one");
  assert.equal(withClass(withPage, "audit-run-unavailable").length, 0);
  const without = await render(productHost({ links: false }));
  assert.equal(withClass(without, "audit-run").length, 0);
  assert.deepEqual(tested.map((name) => textsOf(rowOf(without, name), "audit-run-unavailable")), tested.map(() => ["unavailable"]));
  assert.deepEqual([POSTED, EXACT, KEPT, FAST].map((name) => textsOf(rowOf(without, name), "audit-outcome")[0]), ["passed", "failed", "flaky", "9 of 10"]);
  assert.equal(withClass(rowOf(without, CAPPED), "audit-run-unavailable").length, 0);
});

// TST-775217 · level: system · module: system
// guards: UC-030; TEST RESULTS ARE KEPT IN THE REPOSITORY
// given: the product of TST-775203 on a server that offers the run page; the records of the release commit cite the runs 5001 and 5002; the server keeps both logs, and then neither
// input: the auditor opens the audit of v2026.4.0 over each server
// expect: known positive — with both logs kept, the five rows with tests link the run; with neither log kept, the link of each of those rows is marked unavailable while the outcomes stay from the records
test("TST-775217: UC-030 2d where the CI server no longer keeps the logs the report cites only the link to the log is marked unavailable", async () => {
  const kept = await render(productHost());
  assert.equal(withClass(rowOf(kept, POSTED), "audit-run").length, 1, "known positive: the log is kept, the link stands");
  const host = productHost({ logs: {} });
  const gone = await render(host);
  assert.deepEqual(textsOf(rowOf(gone, POSTED), "audit-outcome"), ["passed", "passed", "passed"], "the outcomes stay from the records");
  assert.deepEqual(textsOf(rowOf(gone, POSTED), "audit-run-unavailable"), ["unavailable"], "the link to a log the server no longer keeps is marked unavailable");
  assert.equal(withClass(rowOf(gone, POSTED), "audit-run").length, 0);
});

// TST-775218 · level: system · module: system
// guards: UC-030; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the product of TST-775203 tagged v2026.4.0 before Agent M's records: its branch test-results holds no run record and its default branch no report
// input: the auditor opens the audit of v2026.4.0
// expect: known positive — the limitations say "cannot be derived" of the outcomes and of the acceptance; the eight rows stand with their requirements, constraints, sources and counter-proof (TST-701's record); every test's outcome reads "cannot be derived", none passed or failed; no row says accepted
test("TST-775218: UC-030 1a a release before Agent M's test records says which parts cannot be derived and shows the rest", async () => {
  const page = await render(productHost({ results: { "README.md": "none\n" }, head: { "SPEC.md": "x\n" } }));
  const limitations = textsOf(page, "audit-limitations")[0];
  assert.match(limitations, /cannot be derived: outcomes/, "known positive: the outcomes");
  assert.match(limitations, /cannot be derived: acceptance/);
  assert.deepEqual(names(page), ALL);
  assert.deepEqual([...new Set(textsOf(page, "audit-outcome"))], ["cannot be derived"]);
  assert.equal(textsOf(rowOf(page, POSTED), "audit-counter-proof")[0], "docs/tests/counter-proofs/TST-701.md");
  assert.deepEqual(textsOf(rowOf(page, PROCESS), "audit-constrains"), ["process"]);
  assert.ok(rows(page).every((row) => !textsOf(row, "audit-evidence")[0].startsWith("accepted")));
});

// TST-775220 · level: system · module: system
// guards: UC-030; THE AUDIT VIEW LISTS EVERY REQUIREMENT OF THE RELEASE; THE GATE IS RECORDED
// given: the product of TST-775203, whose declaration docs/process.md adds the gate of A PROCESS RULE; and the same product at a tag whose docs/gates/ holds no record of that gate
// input: the auditor opens the audit of v2026.4.0 over each
// expect: known positive — with the record, A PROCESS RULE has its row, which lists the gate record; without the record the requirement is still valid at the release and the workflow still holds its gate, so its row stands with no gate record and counts among the requirements without a test (eight rows, three without a test)
test("TST-775220: UC-030 2 a process requirement whose gate has no record at the tag still has its row, with the gap in plain sight", async () => {
  const recorded = await render();
  assert.deepEqual(textsOf(rowOf(recorded, PROCESS), "audit-gate"), [GATE_PATH], "known positive: with the record the row stands");
  const bare = Object.fromEntries(Object.entries(productFiles()).filter(([path]) => path !== GATE_PATH));
  const page = await render(productHost({ product: bare }));
  assert.deepEqual(names(page), ALL, "the requirement is valid at the release, whether or not its gate is recorded");
  assert.deepEqual([textsOf(rowOf(page, PROCESS), "audit-gate"), textsOf(rowOf(page, PROCESS), "audit-no-test")], [[], ["no test"]]);
});

// ---------------------------------------------------------------- the postcondition

// TST-775219 · level: system · module: system
// guards: UC-030; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the product of TST-775203 for a person with write access, whose host records every call of a method that writes (commitFiles, createBranch, openPullRequest, createTag, writeFile)
// input: the auditor walks the steps on one host: opens the audit, picks v2026.3.0 and v2026.4.0, presses every number, sets every filter, follows no link and presses Export; then presses Commit export with the person's own click
// expect: known positive — each step drew what it shows (eight rows, the older release's two, the numbers' rows, the filtered rows, the document); until Commit export no method that writes was called; the person's click then makes the one commit of docs/audits/v2026.4.0.md and no other write
test("TST-775219: UC-030 nothing is written while the auditor walks every step, unless the export was committed on a person's click", async () => {
  const host = productHost({ canWrite: true });
  const world = await renderExportable(host);
  try {
    const page = world.target;
    assert.equal(rows(page).length, 8, "known positive: the audit is drawn");
    await choose(page, "version-choice", OLDER);
    assert.deepEqual(names(page), [POSTED, LATE]);
    await choose(page, "version-choice", TAG);
    for (const kind of ["passing", "noTest", "notPassed", "flaky", "worse", "byImplementer"]) { await press(countOf(page, kind)); await press(countOf(page, kind)); }
    await choose(page, "audit-filter-normative", "normative");
    await choose(page, "audit-filter-source", "SRC-iec-62304");
    await choose(page, "audit-filter-level", "release");
    await tickGaps(page, true);
    await world.press(buttonNamed(page, "Export"));
    assert.equal(world.downloads.blobs.length, 1);
    assert.deepEqual([host.commits, host.writes], [[], []]);
    await world.press(buttonNamed(page, "Commit export"));
    assert.deepEqual([host.commits.map((change) => change.files.map((file) => file.path)), host.writes], [[[`docs/audits/${TAG}.md`]], []]);
  } finally { world.restore(); }
});
