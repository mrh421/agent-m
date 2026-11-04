// System coverage for UC-026 Generate a multi-level test battery, walked through the page `generate` and the product's CI: the flow map (TST-771201) names, for every step of the main flow and every alternative flow, the
// executable tests that walk it, the findings, or the reason it is not walked; the cases walk what the older unit tests of the page and of the checks leave out as a whole — the page's list and levels (1, 2), the run panel and
// a selection that does not fit (3, 3a), Run and the job of the kind propose-tests run by the job workflow with a participant whose first proposal fails the checks and whose second passes (4 to 6, 5a), the review panel (7, 1a),
// Write tests and the job of the kind write-tests, which pushes a branch with the tests and their counter-proofs and opens the pull request (8), a test that fails on the current code (8a), a test that stays green with the fault
// (8b), a proposal of nothing but duplicates (6a) and the only participant being the implementer (4a). The page is the real route of MOD-test-pages, drawn into the fixture DOM over the dashboard's clone; the jobs are run by the
// real entries of MOD-workflow-entries over MOD-job-runner, MOD-job-catalogue and MOD-result-records, behind tests/uc-026-harness.mjs: git repositories on disk, a fake model endpoint that does the coding agent's work in the job's
// checkout, a fake of the server's pull-request API. No request leaves the process.
// Run: node --test tests/system-uc-026-generate-a-multi-level-test-battery.test.mjs
//
// Module: MOD-test-pages
// Module: MOD-result-records
// Module: MOD-runtimes
// Module: MOD-workflow-entries
// Guards: UC-026
// Level: system
//
// Authored by developer-sonnet-j (ITM-771). The `Agent-M-Participant` and `Item:` trailers of the code UC-026's flow runs name, in src/test-pages, src/result-records and the kinds propose-tests and write-tests of src/job-catalogue,
// developer-sonnet-a (ITM-251), -d (ITM-256), -f (ITM-758, ITM-760 and, by the sprint record, ITM-763 and ITM-764), -g (ITM-750, ITM-753, ITM-754), -h (ITM-751, ITM-752), -i (ITM-890) and -b (ITM-1119), developer-opus-a (ITM-1223, ITM-1225,
// ITM-1240), -b (ITM-1212, ITM-1236) and -e (ITM-1267, ITM-1402), developer-sol-b (ITM-635); most commits carry no trailer. developer-sonnet-j appears in none of them; its one commit in a module UC-026 walks, ITM-1351 (moduleRows of
// MOD-trace-graph), is not on the path of the flow. So the release file may guard every requirement. Where the page or a module and UC-026 disagree the case follows UC-026 and is marked `todo` with the word FINDING (named in
// FLOW_FINDINGS). Each case states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the flow map, which holds the expected passages itself
// and checks that UC-026 still says them. The tests of the main flow run in order over one product (sharedWorld): each rests on the state the one before left.
// Readings the texts leave open, which the cases state:
//   - "lists the accepted requirements, use cases and modules" (1) is read literally: a use case or module no approval record names is not listed (the finding of TST-771203).
//   - "each beside the existing tests of the same identifier" (7) is read as the page and MOD-test-pages read it: the existing test that has the case's own TST identifier.
//   - "marked *awaiting implementation*" (8a) names no place; the reading is the report of the test as failed on the current code, which the check lets through without a counter-proof.
//   - "opens a pull request" (8.4) on the CI route is the writer branch-and-pull-request of MOD-runtimes, which asks the server's API; the fake of the API keeps what it was asked.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { text } from "./uc-010-harness.mjs";
import { appendToRecord, startRecord } from "../src/job-ledger/index.mjs";
import { OTHER_RULE, RULE, battery, byClass, caseNode, checkedLevels, checkedNames, ciRun, counterProof, declarations, fieldOfCase, git, implemented, listedNames, offeredNames, openGenerate, participant, prepare, proofPath,
  proposed, pushBranch, readProposal, register, run, runButtons, select, selectOfCase, settle, sharedWorld, writeButton, writeTests, click, find, until } from "./uc-026-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-026-generate-a-multi-level-test-battery.md";
const SELF = "tests/system-uc-026-generate-a-multi-level-test-battery.test.mjs";
const UNIT = "tests/test-pages-generate.test.mjs", CHECKS = "tests/result-records-test-proposals.test.mjs", WRITTEN = "tests/result-records-test-proposals-written.test.mjs", PAID = "tests/result-records-test-proposals-paid.test.mjs";
const SELECTION = "tests/result-records-test-selection.test.mjs", DECLARED = "tests/job-runner-test-declarations.test.mjs";
const MAIL_API = "mail-api";
const RESOURCES = text("# Resources of this product", "", "**REGISTER**", "", "The resources.", "", "| Name | Kind | Address | Pin | Licence | Maintainer | Route | Processing place | Paid | Secret |",
  "|---|---|---|---|---|---|---|---|---|---|", `| ${MAIL_API} | endpoint | https://api.example.org/v1 | — | — | — | read on its host | the vendor | yes | ci:MAIL_KEY |`);
const COMPILER = /^- \S+:\d+: (error|warning): .+ \[[A-Z][A-Z0-9 ,'.-]+\] — .+$/;
const jobFiles = (w) => w.paths().filter((path) => path.startsWith("docs/jobs/"));
const recordOf = (w, kind) => w.fileAt(jobFiles(w).find((path) => w.fileAt(path).includes(`kind: ${kind}`)));
const parametersOf = (body) => JSON.parse(/## Parameters\n+```json\n([\s\S]*?)\n```/.exec(body)[1]);
const onBranch = (w, branch, path) => git(w.productOrigin, "show", `${branch}:${path}`);

// ---------------------------------------------------------------- the flow map

// The passages of UC-026 the system tests walk, each with the executable tests that walk it: this file's cases, and the older tests of the page and of the checks.
const FLOW_EVIDENCE = {
  "main-1-list": { uc: "uncovered combinations are preselected", evidence: [[SELF, "TST-771202"], [UNIT, "TST-763001"]] },
  "main-1-accepted": { uc: "Agent M lists the accepted requirements, use cases and modules", evidence: [[SELF, "TST-771203"]] },
  "main-2-levels": { uc: "A folded **What is this?** explains each level with the table above and names the book chapter.", evidence: [[SELF, "TST-771202"], [UNIT, "TST-1225004"]] },
  "main-3-input": { uc: "with its description and code", evidence: [[SELF, "TST-771205"], [SELECTION, "TST-752101"]] },
  "main-3-fits": { uc: "It checks that all of it fits into the participant's context.", evidence: [[SELF, "TST-771204"], [UNIT, "TST-763005"]] },
  "main-4-implementer": { uc: "it leaves out the participant recorded as implementer of the behaviour under test, and says so", evidence: [[SELF, "TST-771213"], [UNIT, "TST-763002"]] },
  "main-4-implementer-uc": { uc: "For the *release* level it", evidence: [["tests/release-uc-026-generate-a-multi-level-test-battery.test.mjs", "TST-771309"]] },
  "main-4-run": { uc: "the author presses **Run** — one click", evidence: [[SELF, "TST-771204"], [SELF, "TST-771205"], [UNIT, "TST-763004"]] },
  "main-5-cases": { uc: "Each one carries a `TST-` identifier, its level", evidence: [[SELF, "TST-771205"], [SELF, "TST-771206"]] },
  "main-5-guards-module": { uc: "the identifiers it guards", evidence: [[SELF, "TST-771210"]] },
  "main-5-identifier": { uc: "Each one carries a `TST-` identifier", evidence: [["tests/release-uc-026-generate-a-multi-level-test-battery.test.mjs", "TST-771314"]] },
  "main-5-model": { uc: "A case whose result depends on a model's answer is marked *model-dependent*", evidence: [[SELF, "TST-771205"], [CHECKS, "TST-753103"]] },
  "main-6-checks": { uc: "Agent M checks the proposal without a model", evidence: [[SELF, "TST-771205"], [CHECKS, "TST-753101"], [PAID, "TST-851101"]] },
  "main-7-review": { uc: "The review panel shows the cases grouped by level and by what they guard", evidence: [[SELF, "TST-771206"], [UNIT, "TST-764001"]] },
  "main-7-edit": { uc: "removes, edits or reclassifies cases", evidence: [[SELF, "TST-771207"], [UNIT, "TST-764002"]] },
  "main-8-click": { uc: "The author presses **Write tests** — one click.", evidence: [[SELF, "TST-771207"], [UNIT, "TST-764002"]] },
  "main-8-code": { uc: "writes the test code, each test naming its `TST-` identifier", evidence: [[SELF, "TST-771207"], [DECLARED, "TST-472369"]] },
  "main-8-counter-proof": { uc: "the **counter-proof**", evidence: [[SELF, "TST-771207"], [WRITTEN, "TST-754101"], [WRITTEN, "TST-754102"]] },
  "main-8-pull-request": { uc: "opens a pull request containing the tests and the counter-proof records", evidence: [[SELF, "TST-771207"]] },
  "main-8-date": { uc: "naming the Agent M version, the participant, the model and the date.", evidence: [[SELF, "TST-771211"]] },
  "main-9-default-branch": { uc: "The tests reach the default branch only through a pull request with green CI.", evidence: [[SELF, "TST-771207"]] },
  "1a-user": { uc: "**1a. The level is `user`.**", evidence: [[SELF, "TST-771206"], [SELF, "TST-771207"], [WRITTEN, "TST-754105"]] },
  "3a-too-large": { uc: "**3a. The existing tests do not fit into the participant's context.**", evidence: [[SELF, "TST-771204"], [UNIT, "TST-763005"]] },
  "4a-only-implementer": { uc: "**4a. The only participant that fills the role is the implementer, and release tests are", evidence: [[SELF, "TST-771213"], [UNIT, "TST-763003"]] },
  "5a-paid": { uc: "**5a. A case would need a real call to a paid service to decide its outcome.**", evidence: [[SELF, "TST-771205"], [SELF, "TST-771206"], [PAID, "TST-851101"]] },
  "6a-all-duplicates": { uc: "**6a. Every proposed case is a duplicate.**", evidence: [[SELF, "TST-771212"], [UNIT, "TST-764003"]] },
  "8a-red": { uc: "**8a. A new test fails on the current code because the behaviour is not implemented yet.**", evidence: [[SELF, "TST-771208"], [WRITTEN, "TST-754104"]] },
  "8b-green": { uc: "**8b. A test stays green with the planted fault.**", evidence: [[SELF, "TST-771209"], [WRITTEN, "TST-754102"], [UNIT, "TST-764004"]] },
  "8b-shown-again": { uc: "it is not written, and the review panel shows it again for the author to sharpen or drop.", evidence: [[SELF, "TST-771209"]] },
};
// The passages the page or a module does otherwise: the finding, its case, and the module that points to.
const FLOW_FINDINGS = {
};
// The passages no test of this product's code walks, with the reason.
const NOT_WALKED = {
  "main-9-ci": { uc: "CI runs on the pull request (UC-027)", why: "the CI of a pull request and its Definition of Done are UC-027's and UC-002's, walked by the batteries of those use cases; this battery ends at the pull request the job opens" },
  "intro-run": { uc: "This is also the test part of a run (UC-043), where it starts by itself once the selected modules are", why: "UC-043's battery walks it and holds the finding UC043-F5 (no job of the kinds propose-tests or write-tests is started for a run's selection)" },
  "8a-mark": { uc: "marked *awaiting implementation*", why: "no module text names where the mark stands; the part the texts assign — the check lets the failing test through without a counter-proof, and the pull request opens — is walked by TST-771208" },
  "8a-after": { uc: "the counter-proof is taken after the implementing job has turned it green", why: "it is the implementing job's work (UC-034), after this use case's flow ends" },
  "main-8-plant": { uc: "plants a fault in the code it guards, runs the test, records that it failed, and removes the fault", why: "the participant's own work in its checkout; Agent M checks its record (the counter-proof schema, TST-771207), it does not plant faults itself" },
};

// TST-771201 · level: system · module: system
// guards: UC-026
// given: UC-026 as committed text, the executable tests named in FLOW_EVIDENCE, the findings named in FLOW_FINDINGS and the passages named in NOT_WALKED
// input: compare every passage of the main flow, steps 1 to 9, and of the alternative flows with its executable evidence, its finding or the reason it is not walked
// expect: every named passage stands in UC-026; every evidence file exists and declares its TST id; this file's cases declare the level system; every finding's case stands in its file with the todo naming FINDING and its module; known positive: UC-026 names exactly the seven alternative flows 1a, 3a, 4a, 5a, 6a, 8a and 8b, each among the passages, and each step 1 to 9 of the main flow has a passage
test("TST-771201: UC-026 every passage of the main flow and of each alternative flow has an executable test, a finding or a stated reason", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  const missing = [];
  for (const [name, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-026 says "${needle}"`);
    for (const [file, id] of evidence) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      if (!declared) missing.push(`${name}: ${id} in ${file}`);
      else if (file === SELF) assert.equal(declared.level, "system", `${id} is a system test`);
    }
  }
  assert.deepEqual(missing, [], "every evidence test is declared in its file");
  for (const [name, { uc: needle, finding, file, test: id, module }] of Object.entries(FLOW_FINDINGS)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-026 says "${needle}"`);
    assert.ok(read(file).includes(`// ${id} `), `${name}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`FINDING ${finding} (${module})`), `${name}: the todo of ${id} names FINDING ${finding} and ${module}`);
  }
  for (const [name, { uc: needle }] of Object.entries(NOT_WALKED)) assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-026 says "${needle}"`);
  const flows = [...uc.matchAll(/- \*\*(\d+[a-z])\. /g)].map((match) => match[1]).sort();
  assert.deepEqual(flows, ["1a", "3a", "4a", "5a", "6a", "8a", "8b"], "known positive: UC-026 names these seven alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).map((key) => key.split("-")[0].replace(/^main$/, "")));
  assert.deepEqual(flows.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
  const steps = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS, ...NOT_WALKED }).filter((key) => key.startsWith("main-")).map((key) => Number(key.split("-")[1])));
  assert.deepEqual([...steps].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9], "each step of the main flow is among the passages");
});

// ---------------------------------------------------------------- steps 1 to 4, over a product nothing is written to

const quiet = sharedWorld({ product: { "docs/resources.md": RESOURCES } });
test.before(async () => { await quiet.start(); });
test.after(async () => { await quiet.stop(); });

// TST-771202 · level: system · module: system
// guards: UC-026; EVERY STEP EXPLAINS ITSELF; ONE CLICK PER DECISION
// given: the product alice/thesis-tool: the rules A LOAN HAS A DUE DATE (tested at unit, component and release) and A LOAN CAN BE EXTENDED ONCE (tested at none), UC-001 (tested at system) and UC-002 (tested at none), MOD-loans (tested at unit and component) and MOD-members (tested at none)
// input: the person opens Tests and Generate tests
// expect: the accepted names — the two rules, which the SPEC holds, and UC-001, which a record accepts — are listed with the levels that guard them, and UC-002, MOD-loans and MOD-members, which no record accepts, are not (UC-026 1, "lists the accepted"); the names with a level of their fitting kind lacking — A LOAN HAS A DUE DATE (user), A LOAN CAN BE EXTENDED ONCE — are ticked and UC-001 is not; the levels lacking for a ticked name — release and user — are ticked, each of the five levels with a folded explanation that names chapter 13; nothing is written to the product and nothing is sent
test("TST-771202: UC-026 1, 2 the page lists what can be tested with the levels that guard it, preselects the uncovered, and explains each level", async () => {
  const w = quiet.w;
  const head = w.head();
  const target = await openGenerate(w);
  const rowOf = (name) => find(target, (node) => node.localName === "tr" && node.getAttribute("data-name") === name)[0];
  assert.ok(listedNames(target).includes("UC-001"), "known positive: the page lists UC-001");
  assert.deepEqual(listedNames(target), [OTHER_RULE, RULE, "UC-001"].sort());
  assert.deepEqual(checkedNames(target).sort(), [OTHER_RULE, RULE].sort());
  assert.match(byClass(rowOf(RULE), "span", "covered")[0].textContent, /unit, component, release/);
  assert.match(byClass(rowOf(RULE), "span", "uncovered")[0].textContent, /user/);
  assert.match(byClass(rowOf("UC-001"), "span", "covered")[0].textContent, /system/);
  assert.deepEqual(checkedLevels(target), ["release", "user"]);
  for (const row of byClass(target, "tr", "level")) {
    const folds = find(row, (node) => node.localName === "details");
    assert.equal(folds.length, 1, `${row.getAttribute("data-level")} has one folded explanation`);
    assert.match(folds[0].textContent, /chapter 13/);
  }
  assert.equal(w.head(), head, "nothing is written");
});

// TST-771203 · level: system · module: system
// guards: UC-026
// given: the product of TST-771202, whose approval records name UC-001 and no other use case or module
// input: the person opens Generate tests
// expect: known positive — the page lists UC-001; the page lists the accepted requirements, use cases and modules only: not UC-002, which no approval record names
test("TST-771203: UC-026 1 the page lists the accepted requirements, use cases and modules only", async () => {
  const names = listedNames(await openGenerate(quiet.w));
  assert.ok(names.includes("UC-001"), "known positive: the accepted use case is listed");
  assert.ok(!names.includes("UC-002"), `UC-002 is not accepted and is not listed: ${names}`);
});

// TST-771204 · level: system · module: system
// guards: UC-026; THE PAGE NAMES WHERE IT SENDS; A TEST JOB RECEIVES THE CHAPTER ON TESTING; ONE CLICK PER DECISION
// given: the product of TST-771202; the selection A LOAN CAN BE EXTENDED ONCE and UC-001 at the levels release and system; the CI agents test-bot (context 200000) and small-bot (context 100), each processing data at GitHub's hosted runners
// input: choose test-bot, enter the name, press Show the run panel; then the same with small-bot
// expect: test-bot's panel names the participant, GitHub's hosted runners, the part test-selection and the part 13_software-testing.md and no other chapter, and offers Run; nothing is written before Run; small-bot's page says that the existing tests that guard the selection do not fit its context, offers a smaller selection or a participant with a larger context, and offers no Run; nothing is written or sent
test("TST-771204: UC-026 3, 3a, 4 the run panel names what is sent where, and a selection that does not fit sends nothing", async () => {
  const w = quiet.w;
  const head = w.head();
  const sent = participant(async () => ({ cases: [] }));
  const target = await openGenerate(w);
  await select(target, [OTHER_RULE, "UC-001"], ["release", "system"]);
  await prepare(target, "test-bot");
  const panel = byClass(target, "section", "run-panel")[0];
  assert.ok(panel, "known positive: the run panel stands");
  assert.match(panel.textContent, /test-bot/);
  assert.match(panel.textContent, /GitHub's hosted runners/);
  const parts = byClass(panel, "li", "part").map((each) => each.textContent);
  assert.ok(parts.some((part) => /^test-selection /.test(part)), "the selection and its existing tests are sent");
  assert.ok(parts.some((part) => /^13_software-testing\.md /.test(part)), "the chapter on testing is sent");
  assert.ok(!parts.some((part) => /^(08|09|10|11|12)_/.test(part)), "no other chapter");
  assert.equal(runButtons(target).length, 1, "Run is offered");
  assert.equal(w.head(), head, "nothing is written before Run");
  const small = await openGenerate(w);
  await select(small, [OTHER_RULE, "UC-001"], ["release", "system"]);
  await prepare(small, "small-bot");
  assert.equal(runButtons(small).length, 0, "no Run");
  const said = byClass(small, "p", "too-large")[0];
  assert.match(said.textContent, /existing tests guard this selection and they do not fit/);
  assert.match(said.textContent, /smaller selection/);
  assert.match(said.textContent, /larger context/);
  assert.equal(w.head(), head, "nothing is written");
  assert.deepEqual([sent.length, sent.outside], [0, []], "nothing is sent");
});

// ---------------------------------------------------------------- steps 4 to 8 and their alternatives, over one product

const walk = sharedWorld({ product: { "docs/resources.md": RESOURCES } });
test.before(async () => { await walk.start(); });
test.after(async () => { await walk.stop(); });
const state = {};
const NAMES = [OTHER_RULE, "UC-001", "MOD-members"];
const LEVELS = ["unit", "system", "release", "user"];
// The participant's first proposal fails four checks; its second passes them.
const FIRST = [proposed("TST-901", "unit", [OTHER_RULE]), proposed("TST-902", "release", [OTHER_RULE], { expected: "" }),
  proposed("TST-903", "system", ["UC-001"], { precondition: "a book on the shelf", input: "the member borrows it", expected: "the loan is made" }),
  proposed("TST-904", "release", [OTHER_RULE], { paid: MAIL_API }), proposed("TST-905", "unit", [OTHER_RULE], { paid: MAIL_API }), proposed("TST-906", "user", [OTHER_RULE]),
  proposed("TST-907", "unit", [OTHER_RULE], { phrasings: ["Is a second extension allowed?", "May a loan be extended twice?"], runs: 1 })];
const SECOND = FIRST.map((one) => ({ ...(one.identifier === "TST-902" ? { ...one, expected: "the second extension is refused" } : one.identifier === "TST-903" ? { ...one, class: "duplicate", of: "TST-312" }
  : one.identifier === "TST-905" ? { ...one, paid: undefined, response: "a recorded answer of the mail service" } : one.identifier === "TST-907" ? { ...one, runs: 5 } : one) }));
const EXTENSION = "tests/extension.test.mjs";
// The tests the participant writes for the reviewed cases: the automated ones, with the expected results the person left.
const entriesOf = (cases) => cases.filter((one) => one.level !== "user").map((one) => ({ id: one.identifier.slice(4), level: one.level, module: one.level === "unit" ? "MOD-members" : "system", guards: one.guards[0], expect: one.expected }));
const writing = (entries, branch, over = {}) => ({ files: { [EXTENSION]: declarations(entries), ...Object.fromEntries(entries.map((each) => [proofPath(each.id), counterProof(each.id)])) }, branch, over });

// TST-771205 · level: system · module: system
// guards: UC-026; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A FINDING READS LIKE A COMPILER MESSAGE; A MODEL-DEPENDENT TEST IS MEASURED AS A RATE; COMMIT TESTS CALL NO PAID SERVICE; TEST GENERATION SEES THE EXISTING TESTS; THE ROUNDS ARE COUNTED AND SHOWN
// given: the product with the paid endpoint mail-api; the selection A LOAN CAN BE EXTENDED ONCE, UC-001 and MOD-members at unit, system, release and user, test-bot chosen; test-bot's first proposal of seven cases holds TST-902 without an expected result, TST-903 with the guarded name, input and expected result of the existing test TST-312 classed new, TST-905 at unit level calling mail-api, TST-907 model-dependent and judged on one run, and TST-904 at release level calling mail-api; its second holds them corrected
// input: Run pressed twice; the job workflow runs the job
// expect: one commit holds one record of the kind propose-tests; the participant is asked twice; the first request begins with AGENTS.md, holds the existing test TST-312, which guards UC-001, with its code, mail-api marked paid and chapter 13, and no finding; the second carries the four rules, of the findings TST-902, TST-903, TST-905 and TST-907 — and none for TST-904 (release level) or TST-906; the record shows round 1 with four findings, each one line of the form file:line: kind: what [RULE] — fix, and round 2 with none, the loop stopped because it passed; the job ends done with the corrected cases
test("TST-771205: UC-026 4 to 6, 5a Run queues one job; its first proposal is checked without a model and sent back with compiler-like findings, and the corrected one passes", async () => {
  const w = walk.w;
  const target = await openGenerate(w);
  await select(target, NAMES, LEVELS);
  await prepare(target, "test-bot");
  state.requests = participant(async (request, n) => ({ cases: n === 1 ? FIRST : SECOND }));
  const before = w.subjects().length;
  const button = runButtons(target)[0];
  click(button);
  click(button);
  await until(() => byClass(target, "p", "queued").length === 1, "the queued job");
  await settle();
  assert.equal(w.subjects().length, before + 1, "one commit for two clicks");
  assert.match(w.subjects()[0], /^Queue job JOB-[\w-]+: propose-tests$/);
  assert.deepEqual(jobFiles(w).length, 1);
  const { status } = await ciRun(w);
  assert.equal(status.outcome, "done", status.summary);
  const asked = state.requests;
  assert.equal(asked.length, 2, "the participant is asked twice");
  assert.ok(asked[0].sent.startsWith(read("AGENTS.md").slice(0, 200)), "the first request begins with AGENTS.md");
  for (const wanted of ["TST-312", "check(\"312\");", `${MAIL_API} (endpoint, https://api.example.org/v1): paid`, "# Chapter 13"]) assert.ok(asked[0].sent.includes(wanted), `the first request holds ${wanted}`);
  const rules = ["A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS", "TEST GENERATION SEES THE EXISTING TESTS", "COMMIT TESTS CALL NO PAID SERVICE", "A MODEL-DEPENDENT TEST IS MEASURED AS A RATE"];
  for (const rule of rules) {
    assert.ok(!asked[0].sent.includes(`[${rule}]`), `the first request holds no finding of ${rule}`);
    assert.ok(asked[1].sent.includes(rule), `the second request carries a finding of ${rule}`);
  }
  assert.ok(!asked[0].sent.includes("TST-310"), "the existing tests of the rule that was not selected are not sent");
  assert.ok(asked[1].sent.includes("TST-902") && asked[1].sent.includes("TST-907"), "the findings name the cases");
  const record = recordOf(w, "propose-tests");
  const round1 = /### Round 1 — 4 findings\n([\s\S]*?)\n\n### Round 2/.exec(record)?.[1].split("\n") ?? [];
  assert.equal(round1.length, 4, record);
  for (const line of round1) assert.match(line, COMPILER);
  assert.ok(round1.every((line) => !/TST-904|TST-906/.test(line)), "the release-level paid case and the user case are not findings");
  assert.match(record, /### Round 2 — no finding/);
  assert.match(record, /Left: none · stopped because: passed/);
  assert.match(record, /state: done/);
  state.proposalJob = jobFiles(w)[0];
});

// TST-771206 · level: system · module: system
// guards: UC-026; THE ROUNDS ARE COUNTED AND SHOWN; WHAT A PERSON DECIDES IS NOT SENT BACK; A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: the product after TST-771205: the ended job holds the seven corrected cases and its two rounds
// input: the person opens Generate tests again and presses Read the proposal
// expect: the cases stand grouped by level in the order of the levels and by what they guard — unit and release and user under A LOAN CAN BE EXTENDED ONCE, system under UC-001 —; TST-903 is shown classed duplicate of TST-312; TST-904 is marked as proposed for the nightly or release run only (it calls mail-api); TST-906, of level user, is marked as manual test instructions for which no code is written and no counter-proof is taken; each case shows its precondition, input and expected result; the page says Correction rounds: 2 and lists no flag; nothing is written
test("TST-771206: UC-026 7, 1a, 5a the review panel groups the cases, marks the paid and the manual ones, and shows the rounds", async () => {
  const w = walk.w;
  const head = w.head();
  state.page = await openGenerate(w);
  await readProposal(state.page);
  const groups = byClass(state.page, "section", "case-group").map((node) => [node.getAttribute("data-level"), node.getAttribute("data-guards")]);
  assert.deepEqual(groups, [["unit", OTHER_RULE], ["system", "UC-001"], ["release", OTHER_RULE], ["user", OTHER_RULE]]);
  assert.match(caseNode(state.page, "TST-903").textContent, /duplicate\s*of TST-312/);
  assert.match(byClass(caseNode(state.page, "TST-904"), "span", "nightly")[0].textContent, /mail-api.*nightly or release run only/);
  assert.equal(byClass(caseNode(state.page, "TST-901"), "span", "nightly").length, 0, "known positive: a case that calls no paid service carries no such mark");
  assert.match(byClass(caseNode(state.page, "TST-906"), "span", "manual")[0].textContent, /no code is written and no counter-proof is taken/);
  assert.equal(fieldOfCase(state.page, "TST-902", "case-expected").value, "the second extension is refused");
  assert.equal(fieldOfCase(state.page, "TST-901", "case-input").value, "the input of TST-901");
  assert.match(byClass(state.page, "p", "rounds")[0].textContent, /Correction rounds: 2/);
  assert.equal(byClass(state.page, "li", "flag").length, 0);
  assert.equal(w.head(), head, "nothing is written");
});

// TST-771207 · level: system · module: system
// guards: UC-026; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; ONE CLICK PER DECISION; EVERY TEST HAS ONE LEVEL
// given: the review panel of TST-771206; the person edits TST-901's expected result to "a second extension is refused" and removes the duplicate TST-903; test-bot writes, in the job's checkout, the branch tests/extension-1 with the tests of TST-901, TST-902, TST-904, TST-905 and TST-907 and a counter-proof record of each, none for the user case TST-906
// input: Write tests pressed once; the job workflow runs the job
// expect: one job of the kind write-tests is queued, whose cases are the six the person left, 901 edited; the job ends done after one round; the server's API was asked once to open a pull request from tests/extension-1 into main, titled with the job; the branch holds the five tests, each declaring the identifier, level, guarded name and expected result of its reviewed case, and a counter-proof record of outcome failed for each; the branch holds no test and no record for TST-906; main gained no test file — the job's commits to main touch docs/jobs/ alone
test("TST-771207: UC-026 8, 1a Write tests queues one job; the participant's branch holds the tests as reviewed with their counter-proofs, and they reach main only as a pull request", async () => {
  const w = walk.w;
  fieldOfCase(state.page, "TST-901", "case-expected").value = "a second extension is refused";
  click(find(caseNode(state.page, "TST-903"), (node) => node.localName === "button" && node.textContent === "Remove")[0]);
  const reviewed = [...FIRST].map((one) => SECOND.find((each) => each.identifier === one.identifier)).filter((one) => one.identifier !== "TST-903")
    .map((one) => (one.identifier === "TST-901" ? { ...one, expected: "a second extension is refused" } : one));
  const entries = entriesOf(reviewed);
  const base = w.head();
  state.writer = participant(async (request, n, { folder }) => {
    if (!request.sent.includes("The reviewed test cases")) return { cases: SECOND };
    const { files, branch } = writing(entries, "tests/extension-1");
    const commit = pushBranch(folder, branch, files);
    return { branch, commits: [commit], pullRequest: "", tests: entries.map((each) => ({ identifier: `TST-${each.id}`, outcome: "passed", counterProof: proofPath(each.id) })) };
  });
  const before = w.subjects().length;
  // One press, as UC-026 8 has it: a second press runs writeTests again on the head the page read (src/test-pages/generate.mjs, writeTests), whose commit main refuses as Moved once the first has landed —
  // before or after this case reads the page, by the timing of the run.
  click(writeButton(state.page));
  await until(() => byClass(state.page, "p", "queued").length >= 1 || byClass(state.page, "p", "result").length > 0, "what Write tests queued");
  await settle();
  assert.deepEqual(byClass(state.page, "p", "result").map((each) => each.textContent), [], "no refusal");
  assert.equal(w.subjects().length, before + 1, "one commit for the click");
  const written = recordOf(w, "write-tests");
  const cases = parametersOf(written).draft.cases;
  assert.deepEqual(cases.map((one) => one.identifier).sort(), ["TST-901", "TST-902", "TST-904", "TST-905", "TST-906", "TST-907"]);
  assert.equal(cases.find((one) => one.identifier === "TST-901").expected, "a second extension is refused");
  const afterQueue = w.head();
  const { status } = await ciRun(w);
  assert.equal(status.outcome, "done", status.summary);
  const record = recordOf(w, "write-tests");
  assert.match(record, /Left: none · stopped because: passed/);
  assert.equal(state.writer.length, 1, "one round");
  assert.equal(state.writer.pulls.length, 1, "one pull request opened");
  assert.deepEqual([state.writer.pulls[0].head, state.writer.pulls[0].base], ["tests/extension-1", "main"]);
  assert.match(state.writer.pulls[0].title, /^JOB-[\w-]+: write-tests$/);
  state.pull = state.writer.pulls[0];
  const declared = testDeclarations(EXTENSION, onBranch(w, "tests/extension-1", EXTENSION));
  assert.deepEqual(declared.map((each) => each.id).sort(), ["TST-901", "TST-902", "TST-904", "TST-905", "TST-907"]);
  for (const one of declared) {
    const wanted = reviewed.find((each) => each.identifier === one.id);
    assert.deepEqual([one.level, one.guards, one.expect], [wanted.level, wanted.guards, wanted.expected], one.id);
    assert.match(onBranch(w, "tests/extension-1", proofPath(one.id.slice(4))), /outcome: failed/, `${one.id} has its counter-proof`);
  }
  assert.throws(() => onBranch(w, "tests/extension-1", proofPath("906")), "no counter-proof for the user case");
  assert.ok(!git(w.productOrigin, "ls-tree", "-r", "--name-only", "main").split("\n").includes(EXTENSION), "main holds no test file");
  const changed = git(w.productOrigin, "diff", "--name-only", afterQueue, w.head()).split("\n").filter(Boolean);
  assert.ok(changed.length > 0 && changed.every((path) => path.startsWith("docs/jobs/")), `main gained: ${changed}`);
  assert.notEqual(base, w.head());
  state.entries = entries;
});

// TST-771208 · level: system · module: system
// guards: UC-026; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT
// given: the proposal of TST-771205; test-bot writes the branch tests/extension-2 with the test TST-901 and no counter-proof record, and reports it as failing on the current code (outcome failed)
// input: the person presses Write tests on the reviewed cases; the job workflow runs the job
// expect: the participant is asked once — the check finds no missing counter-proof; the job ends done; the pull request is opened for tests/extension-2; the branch holds TST-901 and no counter-proof record
test("TST-771208: UC-026 8a a test that fails on the current code needs no counter-proof and its pull request opens", async () => {
  const w = walk.w;
  const page = await openGenerate(w);
  await readProposal(page);
  const entries = entriesOf([SECOND[0]]);
  const writer = participant(async (request, n, { folder }) => {
    const commit = pushBranch(folder, "tests/extension-2", { [EXTENSION.replace("extension", "red")]: declarations(entries) });
    return { branch: "tests/extension-2", commits: [commit], pullRequest: "", tests: [{ identifier: "TST-901", outcome: "failed" }] };
  });
  await writeTests(page);
  assert.deepEqual(byClass(page, "p", "result").map((each) => each.textContent), [], "no refusal");
  const { status } = await ciRun(w);
  assert.equal(status.outcome, "done", status.summary);
  assert.equal(writer.length, 1, "asked once");
  assert.equal(writer.pulls.length, 1);
  assert.equal(writer.pulls[0].head, "tests/extension-2");
  assert.throws(() => onBranch(w, "tests/extension-2", proofPath("901")), "no counter-proof record");
  assert.match(onBranch(w, "tests/extension-2", "tests/red.test.mjs"), /TST-901/);
});

// TST-771209 · level: system · module: system
// guards: UC-026; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: the proposal of TST-771205; test-bot first reports TST-902 as passed with no counter-proof (it stays green with the fault), then, sent back, pushes tests/extension-4 without that test and reports it in notWritten with the reason
// input: the person presses Write tests; the job workflow runs the job; the person opens Generate tests again and presses Read the proposal
// expect: known positive — the participant is asked twice, the second request carrying the finding under A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT for TST-902, and the job ends done with the branch without TST-902; the review panel shows TST-902 again with the reason and the words sharpen it or drop it
test("TST-771209: UC-026 8b a test that stays green with the planted fault is not written and the review panel shows it again", async () => {
  const w = walk.w;
  const page = await openGenerate(w);
  await readProposal(page);
  const first = entriesOf([SECOND[1]]);
  const writer = participant(async (request, n, { folder }) => {
    if (n === 1) {
      const commit = pushBranch(folder, "tests/extension-3", { "tests/green.test.mjs": declarations(first) });
      return { branch: "tests/extension-3", commits: [commit], pullRequest: "", tests: [{ identifier: "TST-902", outcome: "passed" }] };
    }
    const commit = pushBranch(folder, "tests/extension-4", { "docs/notes.md": "# Notes\n" });
    return { branch: "tests/extension-4", commits: [commit], pullRequest: "", tests: [{ identifier: "TST-902", notWritten: "it stays green with the fault planted" }] };
  });
  await writeTests(page);
  const { status } = await ciRun(w);
  assert.equal(status.outcome, "done", status.summary);
  assert.equal(writer.length, 2, "known positive: sent back once");
  assert.ok(writer[1].sent.includes("A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT") && writer[1].sent.includes("TST-902"), "the second request carries the finding");
  const again = await openGenerate(w);
  await readProposal(again);
  const marks = byClass(caseNode(again, "TST-902"), "span", "not-written");
  assert.equal(marks.length, 1, "the test is shown again");
  assert.match(marks[0].textContent, /it stays green with the fault planted — sharpen it or drop it/);
});

// TST-771210 · level: system · module: system
// guards: UC-026; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT
// given: a product whose ended job of the kind propose-tests holds the reviewed case TST-908 at unit level, which guards the module MOD-members; test-bot writes the test as a test names its module, with `module: MOD-members` in its header, and, as a test's guards may only be a requirement or a use case, the rule it serves
// input: Write tests on that case; the job workflow runs the job
// expect: known positive — the participant pushed the branch and reported it; the job ends done in one round with a pull request for the branch
test("TST-771210: UC-026 5, 8 a reviewed case that guards a module is written as a test of that module and the job passes", async () => {
  const cases = [proposed("TST-908", "unit", ["MOD-members"])];
  const { path, text: start } = startRecord({ id: "JOB-20261030-0900-bb01", kind: "propose-tests", worksOn: ["MOD-members"], participant: "test-bot", model: "fixture-llm", route: "ci hosted", run: null, retries: null, startedBy: "alice",
    start: new Date("2026-10-30T09:00:00Z"), agentM: { version: "2026.10.0", commit: "abc1234" }, inputs: [], limit: 5, destinations: [],
    params: { requirements: [], useCases: [], modules: ["MOD-members"], levels: ["unit"] } });
  const ended = appendToRecord(start, { part: "end", at: new Date("2026-10-30T09:05:00Z"), state: "done", results: [], draft: { cases }, rounds: [], usage: null, cost: { known: false, usage: null }, reason: null, log: null });
  await battery({ product: { [path]: ended } }, async (w) => {
    const writer = participant(async (request, n, { folder }) => {
      const entries = [{ id: "908", level: "unit", module: "MOD-members", guards: OTHER_RULE, expect: cases[0].expected }];
      if (n === 1) {
        const commit = pushBranch(folder, "tests/members", writing(entries, "tests/members").files);
        return { branch: "tests/members", commits: [commit], pullRequest: "", tests: [{ identifier: "TST-908", outcome: "passed", counterProof: proofPath("908") }] };
      }
      return { branch: "tests/members", commits: [], pullRequest: "", tests: [{ identifier: "TST-908", outcome: "passed", counterProof: proofPath("908") }] };
    });
    const page = await openGenerate(w);
    await readProposal(page);
    assert.ok(caseNode(page, "TST-908"), "known positive: the case is on the panel");
    await writeTests(page);
    assert.deepEqual(byClass(page, "p", "result").map((each) => each.textContent), [], "known positive: Write tests queued the job");
    const { status } = await ciRun(w);
    assert.equal(writer.length >= 1, true, "known positive: the participant was asked");
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(writer.length, 1, "written in one round");
    assert.equal(writer.pulls.length, 1);
  });
});

// TST-771211 · level: system · module: system
// guards: UC-026; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// given: the pull request the job of TST-771207 opened, as the server's API received it
// input: read the pull request's title and description
// expect: known positive — it names the job, the Agent M version and commit, the participant test-bot and its model fixture-llm, and the requirements the new tests guard; it names the date (UC-026 8.4, "the Agent M version, the participant, the model and the date"): a line "Date: YYYY-MM-DD" whose day, 2026-10-30, is the UTC day of the clock the job workflow's run is given
test("TST-771211: UC-026 8.4 the pull request names the Agent M version, the participant, the model and the date", () => {
  const body = state.pull.body;
  assert.match(body, /^Agent-M-Version: \S+, commit [0-9a-f]{40}$/m);
  assert.match(body, /^Agent-M-Participant: test-bot$/m);
  assert.match(body, /^Agent-M-Model: fixture-llm$/m);
  assert.match(body, new RegExp(`Requirements guarded by the new tests: ${OTHER_RULE}`));
  assert.match(body, /^Date: 2026-10-30$/m, "the description holds the line Date: with the day the job ran");
});

// TST-771212 · level: system · module: system
// guards: UC-026; TEST GENERATION SEES THE EXISTING TESTS
// given: a product of its own; test-bot proposes two cases that are duplicates of the existing tests TST-310 and TST-312 — the same guarded name, input and expected result — and classes them duplicate
// input: the person selects UC-001 and A LOAN HAS A DUE DATE at unit and system, Runs, the job workflow runs the job; the person opens Generate tests and presses Read the proposal; then Write tests
// expect: the job passes in one round; the page says that every proposed case is a duplicate of an existing test and that nothing is written; it offers no Write tests; nothing is queued by the press
test("TST-771212: UC-026 6a when every proposed case is a duplicate the page says so and writes nothing", async () => {
  await battery({}, async (w) => {
    const target = await openGenerate(w);
    await select(target, ["UC-001", RULE], ["unit", "system"]);
    await prepare(target, "test-bot");
    const existing = [proposed("TST-920", "unit", [RULE], { input: "the due date of the loan", expected: "the due date is 15 June", class: "duplicate", of: "TST-310" }),
      proposed("TST-921", "system", ["UC-001"], { input: "the member borrows it", expected: "the loan is made", class: "duplicate", of: "TST-312" })];
    const asked = participant(async () => ({ cases: existing }));
    await run(target);
    const { status } = await ciRun(w);
    assert.equal(status.outcome, "done", status.summary);
    assert.equal(asked.length, 1, "passes in one round");
    const queued = w.subjects().length;
    const page = await openGenerate(w);
    await readProposal(page);
    assert.equal(byClass(page, "li", "case").length, 2);
    assert.match(byClass(page, "p", "all-duplicates")[0].textContent, /Every proposed case is a duplicate of an existing test\. Nothing is written\./);
    assert.equal(writeButton(page), undefined, "no Write tests");
    assert.equal(w.subjects().length, queued, "nothing is queued");
  });
});

// ---------------------------------------------------------------- 4a, over a product of its own

// TST-771213 · level: system · module: system
// guards: UC-026; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; THE PAGE NAMES WHERE IT SENDS
// given: a product whose job record shows test-bot as the implementer of an item that realises A LOAN HAS A DUE DATE; the instance's register holds test-bot alone as a participant with the three capabilities
// input: the selection A LOAN HAS A DUE DATE at release, the page drawn; then release unticked and system ticked
// expect: no participant is offered; the page says that release tests need a participant other than the implementer, names test-bot as left out, and links UC-017 and UC-002; with release unticked test-bot is offered
test("TST-771213: UC-026 4, 4a the implementer is left out of the release level, and when it is the only participant the page says so", async () => {
  const solo = register();
  const only = solo.split("\n").filter((line) => !/^\| (other-bot|small-bot|drafter-ep) /.test(line)).join("\n");
  const product = { "docs/backlog/ITM-050-the-work.md": text("---", "id: ITM-050", "title: The work", "level: module", "realises:", `  - ${RULE}`, "modules:", "  - MOD-loans", "builds_on: []", "tests:", "  - unit", "origin:", "  - the fixture", "---",
    "# ITM-050 The work", "", "## Outcome", "", "The work.", "", "## Acceptance", "", "- a unit test."), ...implemented("test-bot", ["ITM-050"]) };
  await battery({ product, instance: { "docs/participants.md": only } }, async (w) => {
    const went = [];
    const target = await openGenerate(w, { go: (name, params) => went.push([name, params]) });
    await select(target, [RULE], ["release"]);
    assert.deepEqual(offeredNames(target), []);
    assert.match(byClass(target, "p", "left-out")[0].textContent, /test-bot is left out/);
    const said = byClass(target, "p", "release-needs-another");
    assert.equal(said.length, 1);
    assert.match(said[0].textContent, /other than the implementer/);
    const links = find(said[0], (node) => node.localName === "button");
    assert.deepEqual(links.map((node) => node.textContent), ["UC-017", "UC-002"]);
    for (const link of links) click(link);
    assert.deepEqual(went, [["use-case", { id: "UC-017" }], ["use-case", { id: "UC-002" }]]);
    await select(target, [RULE], ["system"]);
    assert.deepEqual(offeredNames(target), ["test-bot"]);
  });
});
