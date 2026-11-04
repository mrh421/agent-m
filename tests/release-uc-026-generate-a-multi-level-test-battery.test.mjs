// Release tests of the requirements UC-026 "Generate a multi-level test battery" realises, each checked from what a person reads on the page, from the findings a participant is sent back with, and from the pull request a job
// opens: the levels, the expected result, the rate of a model-dependent case, the paid services, the origin of a case, the correction loop with its findings, its limit and its rounds, the participants the page offers and the
// implementer it leaves out, what the page names before it sends, its explanations, the chapter on testing, and the pull request. TST-771301 maps every requirement UC-026 realises to the release tests that guard it: this file's,
// tests/test_test_generation_context.py's and tests/test_counter_proof.py's (the checks SPEC.md names for TEST GENERATION SEES THE EXISTING TESTS and A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT, each with its cases in a
// Markdown file beside it), and those other writers wrote.
// Run: node --test tests/release-uc-026-generate-a-multi-level-test-battery.test.mjs
//
// Module: MOD-test-pages
// Module: MOD-result-records
// Module: MOD-runtimes
// Module: MOD-job-runner
// Guards: UC-026
// Level: release
//
// Written for the release testing of sprint 142 by developer-sonnet-j (ITM-771), who built none of the behaviour any case of this file guards: the trailers of the code UC-026's flow runs name other participants (the header of
// tests/system-uc-026-generate-a-multi-level-test-battery.test.mjs lists them), and its one commit in a module UC-026 walks, ITM-1351 (moduleRows of MOD-trace-graph), is not on the path of the flow. The world is
// tests/uc-026-harness.mjs: the page over the dashboard's clone, and the job of the kind propose-tests run in memory by the real MOD-job-runner. Where the code and UC-026 disagree the case follows UC-026 and is marked `todo` with
// the word FINDING. Readings the texts leave open, which the cases state:
//   - "the implementer of the behaviour under test" (4) is read as the participant of a job of the kind implement whose item realises or changes what the selection names, as an item's `realises` and `modules` say.
//   - "until the proposal passes or the limit of rounds is reached" (6) with the correction loop's "or earlier when a round leaves the findings unchanged": a participant that never fixes its error is asked at most the limit
//     of times, and the finding stays open for the person.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { roundsText } from "../src/job-runner/index.mjs";
import { resultStrategies } from "../src/result-records/index.mjs";
import { routeStrategies } from "../src/runtimes/index.mjs";
import { approvalPath, recordText, reviewedRecord } from "./approval-records.mjs";
import { text } from "./uc-010-harness.mjs";
import { OTHER_RULE, RULE, WRITER, byClass, checkedNames, counterProof, declarations, find, implemented, item, memoryProduct, offeredNames, onDisk, openGenerate, prepare, proofPath, productFiles, proposeRun, proposed,
  runButtons, select, sharedWorld } from "./uc-026-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-026-generate-a-multi-level-test-battery.md";
const SELF = "tests/release-uc-026-generate-a-multi-level-test-battery.test.mjs";
const CONTEXT_PY = "tests/test_test_generation_context.py", PROOF_PY = "tests/test_counter_proof.py";
const NEW_TEST = "A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT", EXPECTED = "A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS", RATE = "A MODEL-DEPENDENT TEST IS MEASURED AS A RATE";
const COMPILER = /^\S+:\d+: (error|warning): .+ \[[A-Z][A-Z0-9 ,'.-]+\] — .+$/;

// ---------------------------------------------------------------- the map

// Each requirement UC-026 realises, with the release tests that guard it.
const EVIDENCE = {
  "EVERY TEST HAS ONE LEVEL": [[SELF, "TST-771302"], ["tests/release-uc-028-run-and-review.test.mjs", "TST-773108"]],
  "A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS": [[SELF, "TST-771303"], ["tests/test_test_battery.py", "TST-410100"]],
  "TEST GENERATION SEES THE EXISTING TESTS": [[CONTEXT_PY, "TST-771401"], [CONTEXT_PY, "TST-771402"]],
  "A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT": [[PROOF_PY, "TST-771411"], [PROOF_PY, "TST-771412"]],
  "A MODEL-DEPENDENT TEST IS MEASURED AS A RATE": [[SELF, "TST-771304"], ["tests/test_rate_reporting.py", "TST-411101"]],
  "RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER": [[SELF, "TST-771316"], [SELF, "TST-771309"], ["tests/release-uc-043-run-the-process-over-a-selection.test.mjs", "TST-1045305"]],
  "COMMIT TESTS CALL NO PAID SERVICE": [[SELF, "TST-771305"], ["tests/release-itm-476-own-ci-schedule.test.mjs", "TST-476804"]],
  "EVERY ARTIFACT NAMES ITS ORIGIN": [[SELF, "TST-771306"], ["tests/release-uc-005-derive-requirements.test.mjs", "TST-579309"]],
  "EVERY ARTIFACT HAS AN IDENTIFIER": [[SELF, "TST-771314"], ["tests/release-uc-032-the-backlog-and-its-items.test.mjs", "TST-803104"]],
  "A ROLE NAMES THE CAPABILITIES IT NEEDS": [[SELF, "TST-771310"], ["tests/release-uc-048-fill-the-roles.test.mjs", "TST-1063102"]],
  "THE PAGE NAMES WHERE IT SENDS": [[SELF, "TST-771311"]],
  "AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT": [[SELF, "TST-771315"], ["tests/release-uc-022-derive-the-architecture.test.mjs", "TST-448327"]],
  "CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI": [[SELF, "TST-771315"], ["tests/release-uc-012-handle-an-issue.test.mjs", "TST-585305"]],
  "ONE CLICK PER DECISION": [[SELF, "TST-771311"]],
  "EVERY STEP EXPLAINS ITSELF": [[SELF, "TST-771312"]],
  "A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT": [[SELF, "TST-771307"], ["tests/release-uc-022-derive-the-architecture.test.mjs", "TST-448333"]],
  "A FINDING READS LIKE A COMPILER MESSAGE": [[SELF, "TST-771307"]],
  "AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED": [[SELF, "TST-771307"], ["tests/release-uc-022-derive-the-architecture.test.mjs", "TST-448335"]],
  "WHAT A PERSON DECIDES IS NOT SENT BACK": [[SELF, "TST-771308"], ["tests/release-uc-022-derive-the-architecture.test.mjs", "TST-448336"]],
  "THE CORRECTION LOOP HAS A FIXED LIMIT": [[SELF, "TST-771308"]],
  "THE ROUNDS ARE COUNTED AND SHOWN": [[SELF, "TST-771308"], ["tests/release-uc-022-derive-the-architecture.test.mjs", "TST-448338"]],
  "A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION": [["tests/test_process_run.py", "TST-1045401"], ["tests/test_process_run.py", "TST-1045402"]],
  "A TEST JOB RECEIVES THE CHAPTER ON TESTING": [[SELF, "TST-771313"], ["tests/test_job_reading_checkout.py", "TST-417100"]],
};
const FINDINGS = {};

// TST-771301 · level: release · module: system
// guards: UC-026
// given: UC-026 as committed text, whose `realises` lists twenty-three requirements, and the release tests named in EVIDENCE
// input: read UC-026's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-026 realises these twenty-three requirements; each has at least one release test named; each test named stands in its file with the level release and guards that requirement; each finding's case carries a todo naming FINDING and its module
test("TST-771301: UC-026 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 23, "known positive: UC-026 realises twenty-three requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-026 realises");
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
  for (const [id, { finding, module }] of Object.entries(FINDINGS)) assert.ok(read(SELF).includes(`FINDING ${finding} (${module})`), `${id} names FINDING ${finding} and ${module}`);
});

// ---------------------------------------------------------------- what a proposal is checked for, run through the job

const cases = (...list) => ({ cases: list });
const rulesOf = (round) => round.findings.map((one) => one.rule);

// TST-771302 · level: release · module: system
// guards: EVERY TEST HAS ONE LEVEL; UC-026
// given: the product; test-bot's first proposal holds one case of the level smoke, its second the same case at unit level; known positive first — one proposal for each of the five levels
// input: the job of the kind propose-tests, run with each
// expect: known positive — each of unit, component, system, release and user passes in one round; the case of the level smoke is sent back in round 1 with the finding that it is not one of unit, component, system, release, user, and the corrected proposal passes
test("TST-771302: UC-026 a proposed case has exactly one of the five levels", async () => {
  for (const level of ["unit", "component", "system", "release", "user"]) {
    const { result, failed } = await proposeRun([cases(proposed("TST-940", level, [OTHER_RULE]))]);
    assert.equal(failed, null);
    assert.deepEqual([result.stoppedBecause, result.rounds.length], ["passed", 1], `known positive: ${level}`);
  }
  const { result, inputs } = await proposeRun([cases(proposed("TST-940", "smoke", [OTHER_RULE])), cases(proposed("TST-940", "unit", [OTHER_RULE]))]);
  assert.equal(inputs.length, 2);
  assert.match(result.rounds[0].findings[0].what, /is not one of unit, component, system, release, user/);
  assert.equal(result.stoppedBecause, "passed");
  assert.equal(result.draft.cases[0].level, "unit");
});

const WRITTEN = "tests/extension.test.mjs";
const writtenCheck = (entries, reviewed, report = { tests: [] }, proofs = true) => {
  const files = { [WRITTEN]: declarations(entries), ...(proofs ? Object.fromEntries(entries.map((each) => [proofPath(each.id), counterProof(each.id)])) : {}) };
  const m = memoryProduct(productFiles(), { "tests/ext": files });
  return resultStrategies.checks["test-proposals"]({ branch: "tests/ext", commits: ["c"], pullRequest: "", ...report }, m.context({ draft: { cases: reviewed } }));
};

// TST-771303 · level: release · module: system
// guards: A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS; UC-026
// given: a proposal whose case TST-941 names no expected result; the reviewed case TST-942 expecting "the second extension is refused", and branches that write it expecting that, and expecting "the loan is extended twice"
// input: the job of the kind propose-tests run with the first proposal and a corrected one; the check test-proposals on each written branch
// expect: known positive — the corrected proposal passes; the first is sent back with an error under A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS naming TST-941; the branch that writes TST-942 as its case says has no finding; the branch whose test expects another result has one error under the same rule naming TST-942
test("TST-771303: UC-026 a case and the test written for it state the same expected result before they run", async () => {
  const { result } = await proposeRun([cases(proposed("TST-941", "unit", [OTHER_RULE], { expected: "" })), cases(proposed("TST-941", "unit", [OTHER_RULE]))]);
  assert.equal(result.stoppedBecause, "passed");
  assert.deepEqual(rulesOf(result.rounds[0]), [EXPECTED]);
  assert.match(result.rounds[0].findings[0].what, /TST-941/);
  const reviewed = [proposed("TST-942", "release", [OTHER_RULE], { expected: "the second extension is refused" })];
  const entry = (expect) => [{ id: "942", level: "release", module: "system", guards: OTHER_RULE, expect }];
  assert.deepEqual(await writtenCheck(entry("the second extension is refused"), reviewed), [], "known positive");
  const found = await writtenCheck(entry("the loan is extended twice"), reviewed);
  assert.deepEqual(found.map((one) => one.rule), [EXPECTED]);
  assert.match(found[0].what, /TST-942/);
});

// TST-771304 · level: release · module: system
// guards: A MODEL-DEPENDENT TEST IS MEASURED AS A RATE; UC-026
// given: a case TST-943 that carries two phrasings of one question; its first proposal fixes one run, its second five; a case TST-944 with no phrasings and no runs
// input: the job of the kind propose-tests run with each
// expect: known positive — a case without phrasings needs no number of runs and passes; the model-dependent case judged on one run is sent back with an error under A MODEL-DEPENDENT TEST IS MEASURED AS A RATE naming TST-943; the same case with five runs passes
test("TST-771304: UC-026 a model-dependent case fixes its number of runs before the first run, and one run is not enough", async () => {
  const dependent = (runs) => proposed("TST-943", "unit", [OTHER_RULE], { phrasings: ["Is a second extension allowed?", "May a loan be extended twice?"], runs });
  const plain = await proposeRun([cases(proposed("TST-944", "unit", [OTHER_RULE]))]);
  assert.deepEqual([plain.result.stoppedBecause, plain.result.rounds.length], ["passed", 1], "known positive");
  const { result } = await proposeRun([cases(dependent(1)), cases(dependent(5))]);
  assert.deepEqual(rulesOf(result.rounds[0]), [RATE]);
  assert.match(result.rounds[0].findings[0].what, /TST-943/);
  assert.equal(result.stoppedBecause, "passed");
});

const PAID_RESOURCES = text("# Resources of this product", "", "**REGISTER**", "", "The resources.", "", "| Name | Kind | Address | Pin | Licence | Maintainer | Route | Processing place | Paid | Secret |",
  "|---|---|---|---|---|---|---|---|---|---|", "| mail-api | endpoint | https://api.example.org/v1 | — | — | — | read on its host | the vendor | yes | ci:MAIL_KEY |",
  "| open-data | data | https://data.example.org/set | — | CC0 | — | read on its host | — | no | — |");
const checkProposal = (list) => resultStrategies.checks["test-proposals"]({ cases: list }, memoryProduct(productFiles({ "docs/resources.md": PAID_RESOURCES })).context({}));

// TST-771305 · level: release · module: system
// guards: COMMIT TESTS CALL NO PAID SERVICE; UC-026
// given: a product whose resources hold the paid endpoint mail-api and the free data source open-data, and the book's default schedule; cases that name them at unit and at release level
// input: the check test-proposals on the cases
// expect: known positive — a unit case that names the free open-data and a release case that names mail-api have no finding; the unit case that names mail-api (it runs on every commit) has one error under COMMIT TESTS CALL NO PAID SERVICE naming the case and the service
test("TST-771305: UC-026 a case that runs on every commit never reaches a paid service", async () => {
  const quiet = await checkProposal([proposed("TST-945", "unit", [OTHER_RULE], { paid: "open-data" }), proposed("TST-946", "release", [OTHER_RULE], { paid: "mail-api" })]);
  assert.deepEqual(quiet, [], "known positive");
  const found = await checkProposal([proposed("TST-947", "unit", [OTHER_RULE], { paid: "mail-api" })]);
  assert.deepEqual(found.map((one) => one.rule), ["COMMIT TESTS CALL NO PAID SERVICE"]);
  assert.match(found[0].what, /TST-947.*mail-api/);
});

// TST-771306 · level: release · module: system
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; UC-026
// given: a case TST-948 that guards A LOAN CAN BE EXTENDED ONCE, and a case TST-949 that guards nothing
// input: the check test-proposals on each
// expect: known positive — TST-948 has no finding; TST-949 has one error under EVERY ARTIFACT NAMES ITS ORIGIN naming it
test("TST-771306: UC-026 a proposed case names what it guards, and one that guards nothing is an error", async () => {
  assert.deepEqual(await checkProposal([proposed("TST-948", "unit", [OTHER_RULE])]), [], "known positive");
  const found = await checkProposal([proposed("TST-949", "unit", [])]);
  assert.deepEqual(found.map((one) => one.rule), ["EVERY ARTIFACT NAMES ITS ORIGIN"]);
  assert.match(found[0].what, /TST-949/);
});

// TST-771307 · level: release · module: system
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A FINDING READS LIKE A COMPILER MESSAGE; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; UC-026
// given: test-bot's first proposal holds TST-950 without an expected result and TST-951 that guards nothing; its second holds both corrected
// input: the job of the kind propose-tests run unattended
// expect: the participant is asked twice; the second request carries both findings, each of the form file:line: kind: what [RULE] — fix; the job passes in round 2 and its draft, which the person sees, is the corrected one; no finding is left; counter-proof: a participant that answers the first proposal again leaves the loop with the errors open
test("TST-771307: UC-026 6 a proposal that fails a check goes back with findings in one fixed form, and only the corrected one reaches the person", async () => {
  const bad = cases(proposed("TST-950", "unit", [OTHER_RULE], { expected: "" }), proposed("TST-951", "unit", []));
  const good = cases(proposed("TST-950", "unit", [OTHER_RULE]), proposed("TST-951", "unit", [OTHER_RULE]));
  const { result, inputs } = await proposeRun([bad, good]);
  assert.equal(inputs.length, 2);
  assert.deepEqual(inputs[1].findings.map((one) => one.rule).sort(), [EXPECTED, "EVERY ARTIFACT NAMES ITS ORIGIN"].sort());
  for (const one of inputs[1].findings) assert.match(`${one.artifact}:${one.line}: ${one.kind}: ${one.what} [${one.rule}] — ${one.fix}`, COMPILER);
  assert.equal(result.stoppedBecause, "passed");
  assert.deepEqual(result.draft.cases.map((one) => one.guards.length > 0 && one.expected !== ""), [true, true]);
  assert.deepEqual(result.remaining, []);
  const stuck = await proposeRun([bad]);
  assert.notEqual(stuck.result.stoppedBecause, "passed");
  assert.ok(stuck.result.remaining.length > 0, "the errors stay open");
});

// TST-771308 · level: release · module: system
// guards: THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN; WHAT A PERSON DECIDES IS NOT SENT BACK; UC-026
// given: the job of the kind propose-tests, whose limit is 5; a participant that answers a proposal with an error and never fixes it
// input: the job run unattended; then the text of its rounds as the job's record keeps it
// expect: the participant is asked at most 5 times, and the loop stops before the limit when a round leaves the findings as they were; the error is left open (not "passed") and handed to the person with the draft; the rounds text numbers each round with its findings and ends "Left: 1 finding · stopped because: <why> · limit: 5"; known positive: a participant that fixes it in round 2 is asked twice and leaves none
test("TST-771308: UC-026 6 the loop ends at its limit, the rounds are counted and recorded, and what is left goes to the person", async () => {
  const bad = cases(proposed("TST-952", "unit", [OTHER_RULE], { expected: "" }));
  const fixed = await proposeRun([bad, cases(proposed("TST-952", "unit", [OTHER_RULE]))]);
  assert.deepEqual([fixed.inputs.length, fixed.result.remaining.length], [2, 0], "known positive");
  const never = await proposeRun([bad]);
  assert.ok(never.inputs.length <= 5 && never.inputs.length >= 2, `asked ${never.inputs.length} times`);
  assert.notEqual(never.result.stoppedBecause, "passed");
  assert.equal(never.result.remaining.length, 1);
  assert.equal(never.result.draft.cases[0].identifier, "TST-952", "the person gets the draft with its finding");
  const recorded = roundsText(never.result.rounds, never.result.remaining, never.result.forPerson, never.result.stoppedBecause, never.prepared.limit);
  assert.match(recorded, /### Round 1 — 1 finding/);
  assert.match(recorded, new RegExp(`Left: 1 finding · stopped because: ${never.result.stoppedBecause} · limit: 5`));
  assert.equal(never.result.rounds.length, never.inputs.length, "every round is counted");
});

// TST-771313 · level: release · module: system
// guards: A TEST JOB RECEIVES THE CHAPTER ON TESTING; UC-026
// given: the jobs of the kinds propose-tests and write-tests prepared for a selection
// input: read the parts each job sends
// expect: each sends the part 13_software-testing.md, whose text is the book's chapter 13 in full (byte for byte the file), and no other chapter of the book; known positive: the part test-selection is sent too
test("TST-771313: UC-026 3 the jobs that write tests receive chapter 13 of the book, in full and alone", async () => {
  const chapter = onDisk("docs/sources/SRC-vibe-coding/2026-10-05/13_software-testing.md");
  const { prepared } = await proposeRun([cases(proposed("TST-953", "unit", [OTHER_RULE]))]);
  const named = (job) => job.parts.map((part) => part.name);
  assert.ok(named(prepared).includes("test-selection"), "known positive");
  assert.equal(prepared.parts.find((part) => /^13_software-testing\.md/.test(part.name))?.text, chapter);
  assert.equal(named(prepared).filter((name) => /^\d\d_/.test(name)).length, 1, "no other chapter");
  const { kindOf } = await import("../src/job-catalogue/index.mjs");
  const { prepareJob } = await import("../src/job-runner/index.mjs");
  const run = await proposeRun([cases(proposed("TST-953", "unit", [OTHER_RULE]))]);
  const write = await prepareJob("write-tests", { ...run.context, kind: await kindOf("write-tests"), params: { ...run.context.params, draft: { cases: [proposed("TST-953", "unit", [OTHER_RULE])] } } }, { drafter: WRITER, reviewers: [] });
  assert.equal(write.parts.find((part) => /^13_software-testing\.md/.test(part.name))?.text, chapter);
  assert.equal(named(write).filter((name) => /^\d\d_/.test(name)).length, 1, "no other chapter");
});

// TST-771314 · level: release · module: system
// guards: EVERY ARTIFACT HAS AN IDENTIFIER; UC-026
// given: cases whose identifiers are TST-954 and case-1
// input: the check test-proposals on each
// expect: known positive — TST-954 has no finding; the case whose identifier is not of the scheme TST-<number> has one error under EVERY ARTIFACT HAS AN IDENTIFIER
test("TST-771314: UC-026 5 a proposed case carries an identifier of the scheme TST-", async () => {
  assert.deepEqual(await checkProposal([proposed("TST-954", "unit", [OTHER_RULE])]), [], "known positive");
  const found = await checkProposal([proposed("case-1", "unit", [OTHER_RULE])]);
  assert.deepEqual(found.map((one) => one.rule), ["EVERY ARTIFACT HAS AN IDENTIFIER"]);
});

// TST-771315 · level: release · module: system
// guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; UC-026
// given: a product whose default branch main holds no new test and a branch tests/ext that holds one with its counter-proof; test-bot reports it in the answer of a job of the kind write-tests (Agent M 2026.11.0, one round); the host offers openPullRequest and no commit and no merge
// input: the writer branch-and-pull-request writes the job's result
// expect: exactly one pull request is opened, from tests/ext into main, titled with the job; its description names the job, the kind, the requirement the new test guards, the Agent M version and commit, the participant test-bot and its model fixture-llm; the writer commits nothing to main and merges nothing (the host has no such call); the address returned is the pull request's
test("TST-771315: UC-026 8 the tests reach main only as a pull request that names the version, the participant and the model that wrote them", async () => {
  const entries = [{ id: "955", level: "unit", module: "MOD-members", guards: OTHER_RULE, expect: "a second extension is refused" }];
  const m = memoryProduct(productFiles(), { "tests/ext": { [WRITTEN]: declarations(entries), [proofPath("955")]: counterProof("955") } });
  const context = m.context({}, { kind: { name: "write-tests" } });
  const result = { draft: { branch: "tests/ext", commits: ["c1"], pullRequest: "", tests: [{ identifier: "TST-955", outcome: "passed" }] }, drafter: WRITER, rounds: [{ number: 1, findings: [], answers: [] }] };
  assert.ok(!(await context.product.snapshot.read(WRITTEN)), "known positive: main holds no such test");
  const outcome = await routeStrategies.writers["branch-and-pull-request"](result, context);
  assert.equal(m.opened.length, 1);
  assert.deepEqual([m.opened[0].branch, m.opened[0].base], ["tests/ext", "main"]);
  assert.match(m.opened[0].title, /^JOB-20261101-0900-cd01: write-tests$/);
  for (const line of ["Job: JOB-20261101-0900-cd01", "Kind: write-tests", `Requirements guarded by the new tests: ${OTHER_RULE}`, `Agent-M-Version: 2026.11.0, commit ${"b".repeat(40)}`,
    "Agent-M-Participant: test-bot", "Agent-M-Model: fixture-llm"]) assert.ok(m.opened[0].body.split("\n").includes(line), `the description holds "${line}"`);
  assert.equal(outcome.pullRequest, `${context.product.address}/pull/1`);
});

// ---------------------------------------------------------------- what the page offers and says

// The record by which a person accepts MOD-loans' file as the product holds it: the page offers only accepted names, and UC-001's record is the harness's.
const MOD_LOANS = "docs/architecture/MOD-loans.md";
const gitBlob = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const acceptingModuleLoans = () => { const blob = gitBlob(productFiles()[MOD_LOANS]); return { [approvalPath("MOD-loans", blob)]: recordText(reviewedRecord(MOD_LOANS, blob)) }; };
const pageWorld = sharedWorld({ product: { ...item("ITM-050", ["UC-001"], ["MOD-loans"]), ...item("ITM-051", [OTHER_RULE], ["MOD-members"]), ...implemented("test-bot", ["ITM-050"]),
  ...implemented("other-bot", ["ITM-051"], "JOB-20261010-0900-ab02"), ...acceptingModuleLoans() } });
test.before(async () => { await pageWorld.start(); });
test.after(async () => { await pageWorld.stop(); });
const leftOut = (target) => byClass(target, "p", "left-out").map((one) => /^(\S+) is left out/.exec(one.textContent)?.[1]);

// TST-771316 · level: release · module: system
// guards: RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; UC-026
// given: a product whose job records show other-bot as the implementer of an item that realises A LOAN CAN BE EXTENDED ONCE; the register holds test-bot, other-bot and small-bot
// input: the selection A LOAN CAN BE EXTENDED ONCE at release; then at system
// expect: at release other-bot is left out and named and is not offered, test-bot and small-bot are; at system other-bot is offered and nothing is left out
test("TST-771316: UC-026 4 the page leaves the implementer of a requirement out of its release tests and says so", async () => {
  const target = await openGenerate(pageWorld.w);
  await select(target, [OTHER_RULE], ["release"]);
  assert.deepEqual(offeredNames(target), ["small-bot", "test-bot"]);
  assert.deepEqual(leftOut(target), ["other-bot"]);
  await select(target, [OTHER_RULE], ["system"]);
  assert.deepEqual(offeredNames(target), ["other-bot", "small-bot", "test-bot"]);
  assert.deepEqual(leftOut(target), []);
});

// TST-771309 · level: release · module: system
// guards: RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; UC-026
// given: the product of TST-771316, which holds an approval record that accepts MOD-loans, and test-bot recorded as the implementer of the item ITM-050, which realises UC-001 and changes MOD-loans; known positive first — other-bot, the implementer of ITM-051, is left out for the requirement that item realises
// input: the selection UC-001 at system and release (UC-026's own example is "UC-005, system and release"); then MOD-loans at release
// expect: known positive — other-bot is left out for A LOAN CAN BE EXTENDED ONCE; test-bot is left out of the release tests of UC-001 and of MOD-loans
test("TST-771309: UC-026 4 the implementer of an item that realises a use case or changes a module is left out of the release tests of it", async () => {
  const target = await openGenerate(pageWorld.w);
  await select(target, [OTHER_RULE], ["release"]);
  assert.deepEqual(leftOut(target), ["other-bot"], "known positive");
  await select(target, ["UC-001"], ["system", "release"]);
  assert.deepEqual(leftOut(target), ["test-bot"], "UC-001");
  await select(target, ["MOD-loans"], ["release"]);
  assert.deepEqual(leftOut(target), ["test-bot"], "MOD-loans");
});

// TST-771310 · level: release · module: system
// guards: A ROLE NAMES THE CAPABILITIES IT NEEDS; UC-026
// given: the register of the instance: test-bot, other-bot and small-bot declare read the repository, write to the repository and run code and tests; the model endpoint drafter-ep declares draft text alone
// input: the page generate with any selection at system
// expect: known positive — test-bot is offered; drafter-ep is not offered, so that a participant lacking one of the three capabilities can neither be chosen nor receive the selection
test("TST-771310: UC-026 4 only a participant with the capabilities of the test-writing role is offered", async () => {
  const target = await openGenerate(pageWorld.w);
  await select(target, [OTHER_RULE], ["system"]);
  const offered = offeredNames(target);
  assert.ok(offered.includes("test-bot"), "known positive");
  assert.ok(!offered.includes("drafter-ep"));
  assert.deepEqual(offered, ["other-bot", "small-bot", "test-bot"]);
});

// TST-771312 · level: release · module: system
// guards: EVERY STEP EXPLAINS ITSELF; UC-026
// given: the page generate drawn
// input: read the folded explanations
// expect: each of the five levels carries a folded explanation that names chapter 13; the participants' step and the run step carry one too; every fold holds text
test("TST-771312: UC-026 2 every step of the page carries a folded explanation, each level's naming the chapter on testing", async () => {
  const target = await openGenerate(pageWorld.w);
  await select(target, [OTHER_RULE], ["system"]);
  await prepare(target, "test-bot");
  for (const row of byClass(target, "tr", "level")) {
    const folds = find(row, (node) => node.localName === "details");
    assert.equal(folds.length, 1, row.getAttribute("data-level"));
    assert.match(folds[0].textContent, /chapter 13/);
  }
  const folds = find(target, (node) => node.localName === "details");
  assert.ok(folds.length >= 8, `five levels, the head, the participants and the run step: ${folds.length}`);
  assert.ok(folds.every((fold) => fold.textContent.trim() !== ""));
  assert.ok(find(byClass(target, "section", "writers")[0], (node) => node.localName === "details").length >= 1, "the participants' step");
});

// TST-771311 · level: release · module: system
// guards: THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; UC-026
// given: the page generate with the selection A LOAN CAN BE EXTENDED ONCE at system and test-bot chosen, which processes data at GitHub's hosted runners
// input: Show the run panel; then Run pressed twice
// expect: before Run the panel names test-bot, GitHub's hosted runners and the parts it sends, and the product holds no new commit; Run queues one job in one commit and says where it is queued
test("TST-771311: UC-026 4 the panel names the participant, its place and what is sent before Run, and Run is one click", async () => {
  const w = pageWorld.w;
  const target = await openGenerate(w);
  await select(target, [OTHER_RULE], ["system"]);
  await prepare(target, "test-bot");
  const panel = byClass(target, "section", "run-panel")[0];
  assert.match(panel.textContent, /test-bot/);
  assert.match(panel.textContent, /GitHub's hosted runners/);
  assert.ok(byClass(panel, "li", "part").length >= 2, "the parts are named");
  const head = w.head();
  const button = runButtons(target)[0];
  button.dispatchEvent(new Event("click"));
  button.dispatchEvent(new Event("click"));
  const limit = Date.now() + 5000;
  while (byClass(target, "p", "queued").length === 0 && Date.now() < limit) await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(byClass(target, "p", "queued").length, 1);
  assert.deepEqual(byClass(target, "p", "result").map((one) => one.textContent), [], "the second click refused nothing and started nothing");
  assert.match(byClass(target, "p", "queued")[0].textContent, /queued on the route ci hosted/);
  assert.equal(w.subjects().filter((subject) => /^Queue job/.test(subject)).length, 1, "one commit for two clicks");
  assert.notEqual(w.head(), head);
  assert.deepEqual(checkedNames(target).includes(OTHER_RULE), true);
});
