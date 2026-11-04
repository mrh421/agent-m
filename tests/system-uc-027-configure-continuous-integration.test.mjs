// System coverage for UC-027 Configure continuous integration, walked through the dashboard's page `schedule` on a fixture GitHub and a fixture GitLab server: the flow map (TST-772201) names, for every step of
// the main flow and every alternative flow, the executable tests that walk it, the finding, or none left out; and the cases walk what no test walked as a whole — the book's default shown and marked, with each row's
// number of tests and the folds naming the book's chapters (1); cells changed and refused (2); the nightly time, the command and the runner (3); the secrets by name (4); Save opening one pull request that holds
// the schedule and the configuration generated from it (5); its CI and Merge once green (6); the result records, the last run per occasion and a job record that starts no run (7); a configuration Agent M did
// not generate (1a), one edited by hand (1b), the GitLab pipeline schedule (3a), a self-hosted runner (3b), a missing secret (4a), a red CI (6a) and a missed nightly run (7a). The page is the real route
// `schedule` of MOD-test-pages over the real MOD-test-schedule, behind tests/uc-027-harness.mjs' fixture servers; no request leaves the process.
// Run: node --test tests/system-uc-027-configure-continuous-integration.test.mjs
//
// Module: MOD-test-pages
// Module: MOD-test-schedule
// Guards: UC-027
// Level: system
//
// Authored by developer-opus-e (ITM-772). The `Agent-M-Participant` trailers and item lines of the code UC-027's flow runs, in src/test-pages/schedule.mjs and src/test-schedule, name developer-sonnet-d
// (ITM-250), developer-sonnet-f (ITM-742, 744, 745, 758), developer-sonnet-i (ITM-743), developer-sonnet-g (ITM-746, 747), developer-sonnet-h (ITM-850), developer-sonnet-b (ITM-1119), developer-opus-a
// (ITM-1213, 1214, 1223, 1225), developer-opus-b (ITM-759), developer-opus-c (ITM-1207, 1208), developer-opus-f (ITM-1307) and developer-opus-e (ITM-1265); ITM-1081 and two commits made in akmaier's session
// carry no participant. developer-opus-e built, among that code, ITM-1265 (each row's number of tests read from the view stored for the commit shown). RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER binds
// level release, so these system cases may walk that behaviour; the release file leaves the requirement it serves to the release tests other writers wrote. Where the page or a module and UC-027 disagree the
// case follows UC-027 and is marked `todo` with the word FINDING (named in FLOW_FINDINGS). Each case states its input and its expected values in its own text; none reads an expected result from the SPEC, a
// use case or an architecture file, but the flow map, which holds the expected passages itself and checks that UC-027 still says them. Readings the texts leave open, which the cases state:
//   - "a fixture GitHub and a fixture GitLab server" (ITM-772) is read as a product repository kept in memory behind MOD-repository-hosts' interface, as tests/uc-028-world.mjs keeps one for UC-028, with
//     the server's pages MOD-repository-hosts' own webLinks gives; the requests a real host sends are the tests of MOD-repository-hosts.
//   - "with a button that opens the server's secrets page" (4) is read as the page's link to webLinks().secrets; "the runner registration page of the server and the command to run on that machine" (3b) as
//     the link to webLinks().runners, the server's page that shows the command.
//   - "the schedule page links to the project's Build → Pipeline schedules" (3a) is read as the link the page shows once the merge has set the pipeline schedule (MOD-test-pages: "after which, on a GitLab
//     server, applyPipelineSchedule sets the project's nightly pipeline schedule and the page links it").
//   - "The dashboard shows the failing tests (UC-028)" (6a) is read as the page of UC-028 that shows the tests of a commit, the pull request's head among them, which tests/system-uc-028 walks; the schedule
//     page links the server's runs of that head.
//   - "Save offers to regenerate it" (1b) is read as the drift's note that Save generates Agent M's file from the schedule again, and Save doing so.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { ciConfiguration, configurationDrift, scheduleSchema } from "../src/test-schedule/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { participantSchema } from "../src/participant-list/index.mjs";
import { resourceSchema } from "../src/resource-list/index.mjs";
import { BOOK_ROWS, GENERATED, REGISTER, SCHEDULE, boxOf, buttonOf, byClass, byTag, cellOf, change, click, descendants, fieldOf, open, proposalOf, rowOf, save, scheduleText, server, shop, text,
  until, writesOf } from "./uc-027-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-027-configure-continuous-integration.md";
const SELF = "tests/system-uc-027-configure-continuous-integration.test.mjs";
const RELEASE = "tests/release-uc-027-configure-continuous-integration.test.mjs";
const PAGE = "tests/test-pages-schedule.test.mjs", SAVE = "tests/test-pages-schedule-save.test.mjs", GENERATE = "tests/test-schedule-ci-configuration.test.mjs";
const RUN_TESTS = "tests/workflow-entries-run-tests.test.mjs", FINISHED = "tests/workflow-entries-tests-finished.test.mjs", PIPELINE = "tests/repository-hosts-pipeline-schedule.test.mjs";
const UC28 = "tests/system-uc-028-run-and-review-the-tests.test.mjs", UC28R = "tests/release-uc-028-run-and-review.test.mjs", UC43 = "tests/system-uc-043-run-the-process-over-a-selection.test.mjs";
const STRATEGIES = "tests/test-schedule-strategies.test.mjs", STORED = "tests/release-itm-1265-schedule-stored-view.test.mjs", PY_RUN = "tests/test_process_run.py";
const ROWS = ["unit", "component", "system", "paid", "release", "user"];
const COLUMNS = ["every commit", "pull request", "nightly", "release candidate", "on demand"];
const T = "✓";
const participants = readDocument(participantSchema(), "docs/participants.md", REGISTER);
/** The target the page generates for: the product's server, the instance as its snapshot names it, the instance's commit. */
const targetOf = (kind) => ({ server: kind, instance: kind === "github" ? "alice/agent-m" : "https://gitlab.example.org/alice/agent-m", instanceCommit: "e".repeat(40) });
const committed = (world) => Object.fromEntries(writesOf(world, "commitFiles").at(-1)[1].files.map((file) => [file.path, file.text]));
const ticksOf = (schedule, row) => COLUMNS.filter((column) => schedule.sections.find((section) => section.heading === "## Levels").rows.find((each) => each.cells.Row === row).cells[column] === T);
const marks = (page, row) => COLUMNS.filter((column) => text(byClass(cellOf(page, row, column), "mark")[0]) === T);
/** Save, then the CI of the pull request's head green and Merge pressed; -> the page. */
async function savedAndMerged(world, page) {
  await save(page);
  world.ci(world.pulls.at(-1).head, "success");
  click(buttonOf(proposalOf(page), "Check CI again"));
  await until(() => buttonOf(proposalOf(page), "Merge"), "Merge offered once green");
  click(buttonOf(proposalOf(page), "Merge"));
  await until(() => byClass(page, "merged").length, "the merge shown");
  return page;
}

// ---------------------------------------------------------------- the flow map

// The passages of UC-027 the system tests walk, each with the executable tests that walk it: this file's cases, and the older tests of the page, of the generator and of the CI's entries.
const FLOW_EVIDENCE = {
  "goal-run": { uc: "A run (UC-043) generates the CI configuration by itself if the product has none, using the saved schedule or the book's default.", evidence: [[UC43, "TST-1045210"], [STRATEGIES, "TST-747001"], [PY_RUN, "TST-1045407"]] },
  "main-1-table": { uc: "Agent M shows a table: one row per level", evidence: [[SELF, "TST-772202"], [PAGE, "TST-758001"]] },
  "main-1-default": { uc: "Without a saved schedule, the table shows the book's default, marked as such", evidence: [[SELF, "TST-772202"], [RELEASE, "TST-772302"]] },
  "main-1-count": { uc: "Each row names how many tests it holds", evidence: [[SELF, "TST-772202"], [PAGE, "TST-758006"], [STORED, "TST-1265301"]] },
  "main-1-explain": { uc: "a folded **What is this?** per row and column explains the level or occasion and names the book chapter", evidence: [[SELF, "TST-772202"], [PAGE, "TST-758003"]] },
  "main-2-cells": { uc: "The author changes cells — for example runs system tests nightly only", evidence: [[SELF, "TST-772203"], [SAVE, "TST-1223006"]] },
  "main-2-release": { uc: "The *release candidate* column stays ticked for every row and cannot be cleared; its explanation says why.", evidence: [[SELF, "TST-772203"], [RELEASE, "TST-772304"]] },
  "main-2-paid": { uc: "The cells *every commit* and *pull request* cannot be ticked for tests that call a paid service; the explanation says why and points to recorded responses.",
    evidence: [[SELF, "TST-772203"], [RELEASE, "TST-772303"]] },
  "main-3-fields": { uc: "The author sets the time of the nightly run, the command that runs the product's tests", evidence: [[SELF, "TST-772204"]] },
  "main-3-runner": { uc: "Agent M offers only participants with *run code and tests*.", evidence: [[SELF, "TST-772204"], [PAGE, "TST-758007"]] },
  "main-4-secrets": { uc: "Agent M lists the secrets the scheduled tests need", evidence: [[SELF, "TST-772205"], [PAGE, "TST-758008"]] },
  "main-4-never": { uc: "It never asks for a secret's value.", evidence: [[SELF, "TST-772205"], [RELEASE, "TST-772307"]] },
  "main-5-save": { uc: "The author presses **Save** — one click.", evidence: [[SELF, "TST-772206"], [SAVE, "TST-759001"]] },
  "main-5-together": { uc: "opens one pull request that contains the schedule file and the generated configuration together, so the two never disagree on the default branch.",
    evidence: [[SELF, "TST-772206"], [RELEASE, "TST-772305"]] },
  "main-6-merge": { uc: "The dashboard shows the pull request and its CI outcome; once green, the author merges it with one click.", evidence: [[SELF, "TST-772207"], [RELEASE, "TST-772306"]] },
  "main-7-record": { uc: "every run the configuration starts leaves a result record (UC-028)", evidence: [[SELF, "TST-772208"], [FINISHED, "TST-1216103"], [UC28R, "TST-773101"]] },
  "main-7-last": { uc: "the schedule page shows the last run per occasion", evidence: [[SELF, "TST-772208"], [SAVE, "TST-759006"]] },
  "main-7-release-candidate": { uc: "the schedule page shows the last run per occasion", evidence: [[SELF, "TST-772217"]] },
  "main-7-jobs": { uc: "A commit that only records a job (`docs/jobs/`) starts no run.", evidence: [[SELF, "TST-772208"], [GENERATE, "TST-744004"], [RELEASE, "TST-772309"]] },
  "1a-foreign": { uc: "**1a. The product already has a CI configuration Agent M did not generate.**", evidence: [[SELF, "TST-772209"], [SAVE, "TST-759009"]] },
  "1a-gitlab-triggers": { uc: "Agent M shows which of its triggers run which tests, as far as it can tell", evidence: [[SELF, "TST-772210"]] },
  "1b-edited": { uc: "**1b. The generated configuration was edited by hand after merging.**", evidence: [[SELF, "TST-772211"], [SAVE, "TST-759005"]] },
  "3a-gitlab": { uc: "**3a. The product is on a GitLab server.**", evidence: [[SELF, "TST-772212"], [PIPELINE, "TST-749001"], [RELEASE, "TST-772308"]] },
  "3b-runner": { uc: "**3b. A self-hosted runner is chosen but not registered.**", evidence: [[SELF, "TST-772213"], [PAGE, "TST-850002"]] },
  "4a-secret": { uc: "**4a. A named secret is missing when a run starts.**", evidence: [[SELF, "TST-772214"], [RUN_TESTS, "TST-1215103"], [FINISHED, "TST-1216103"]] },
  "6a-red": { uc: "**6a. CI on the configuration pull request is red.**", evidence: [[SELF, "TST-772215"], [SAVE, "TST-759003"], [UC28, "TST-773004"]] },
  "7a-nightly": { uc: "**7a. The nightly run has not run.**", evidence: [[SELF, "TST-772216"], [SAVE, "TST-759007"]] },
};
// The passages the code does otherwise: the finding, its case, and the module it points to.
const FLOW_FINDINGS = {
};

// TST-772201 · level: system · module: system
// guards: UC-027
// given: UC-027 as committed text, the executable tests named in FLOW_EVIDENCE and the findings named in FLOW_FINDINGS
// input: compare every passage of the goal, of the main flow, steps 1 to 7, and of the alternative flows with its executable evidence or its finding
// expect: every named passage stands in UC-027; every evidence file exists and declares its TST id; this file's cases declare the level system; every finding's case stands in its file with the todo naming FINDING and its module; every alternative flow UC-027 names is among the passages; known positive: UC-027 names exactly the seven alternative flows 1a, 1b, 3a, 3b, 4a, 6a and 7a, and each of the seven main steps has a passage
test("TST-772201: UC-027 every passage of the main flow and of each alternative flow has an executable test or a finding", () => {
  const uc = read(UC).replace(/\s+/g, " ");
  const missing = [];
  for (const [name, { uc: needle, evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-027 says "${needle}"`);
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
    assert.ok(uc.includes(needle.replace(/\s+/g, " ")), `${name}: UC-027 says "${needle}"`);
    assert.ok(read(file).includes(`// ${id} `), `${name}: ${id} stands in ${file}`);
    assert.ok(read(file).includes(`todo: "FINDING ${finding} (${module})`), `${name}: the todo of ${id} names FINDING ${finding} and ${module}`);
  }
  const flows = [...uc.matchAll(/- \*\*(\d+[a-z])\. /g)].map((match) => match[1]).sort();
  assert.deepEqual(flows, ["1a", "1b", "3a", "3b", "4a", "6a", "7a"], "known positive: UC-027 names these seven alternative flows");
  const walked = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).map((key) => key.split("-")[0]));
  assert.deepEqual(flows.filter((flow) => !walked.has(flow)), [], "each alternative flow is among the passages");
  const steps = new Set(Object.keys({ ...FLOW_EVIDENCE, ...FLOW_FINDINGS }).filter((key) => key.startsWith("main-")).map((key) => Number(key.split("-")[1])));
  assert.deepEqual([...steps].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7], "each step of the main flow is among the passages");
});

// ---------------------------------------------------------------- the main flow

// TST-772202 · level: system · module: system
// guards: UC-027; THE DEFAULT SCHEDULE FOLLOWS THE BOOK; EVERY STEP EXPLAINS ITSELF
// given: alice/shop on the fixture GitHub with no docs/tests/schedule.md; its test files declare three unit tests (one calls the paid service oracle), one component test, two system tests (one calls oracle) and one release test
// input: the author opens Tests → Schedule
// expect: step 1: the page says the table is the book's default, not yet saved; rows unit, component, system, paid, release, user and columns every commit, pull request, nightly, release candidate, on demand; unit, component and system ticked on all five, paid on nightly, release candidate and on demand, release and user on release candidate and on demand; the numbers of tests 3, 1, 2, 2, 1, 0; each row's and each column's fold reads "What is this?", the every commit and pull request folds name ch. 12, the nightly and release candidate folds and the folds of paid and release name ch. 13; nothing is written
test("TST-772202: UC-027 1 without a saved schedule the page shows the book's default, marked, with each row's number of tests and the folds naming the book's chapters", async () => {
  const world = server("github");
  const page = await open(world);
  assert.match(text(byClass(page, "default-schedule")[0]), /This is the book's default schedule, not yet saved for this product\./);
  assert.deepEqual(descendants(page, (node) => node.localName === "tr" && node.hasAttribute("data-row")).map((node) => node.getAttribute("data-row")), ROWS);
  assert.deepEqual(descendants(page, (node) => node.localName === "th" && node.hasAttribute("data-column")).map((node) => node.getAttribute("data-column")), COLUMNS);
  for (const row of ["unit", "component", "system"]) assert.deepEqual(marks(page, row), COLUMNS, row);
  assert.deepEqual(marks(page, "paid"), ["nightly", "release candidate", "on demand"]);
  for (const row of ["release", "user"]) assert.deepEqual(marks(page, row), ["release candidate", "on demand"], row);
  assert.deepEqual(ROWS.map((row) => text(byClass(rowOf(page, row), "tests")[0])), ["3", "1", "2", "2", "1", "0"]);
  const foldOfColumn = (column) => byClass(descendants(page, (node) => node.localName === "th" && node.getAttribute("data-column") === column)[0], "explain")[0];
  const foldOfRow = (row) => byClass(byTag(rowOf(page, row), "th")[0], "explain")[0];
  for (const fold of [...COLUMNS.map(foldOfColumn), ...ROWS.map(foldOfRow)]) assert.equal(text(byTag(fold, "summary")[0]), "What is this?");
  for (const column of ["every commit", "pull request"]) assert.match(text(foldOfColumn(column)), /ch\. 12/, column);
  for (const column of ["nightly", "release candidate"]) assert.match(text(foldOfColumn(column)), /ch\. 13/, column);
  for (const row of ["paid", "release"]) assert.match(text(foldOfRow(row)), /ch\. 13/, row);
  assert.deepEqual(world.writes, []);
});

// TST-772203 · level: system · module: system
// guards: UC-027; A RELEASE RUNS EVERY TEST AT EVERY LEVEL; COMMIT TESTS CALL NO PAID SERVICE
// given: the product of TST-772202
// input: the author unticks every commit and pull request of the row system, so that system tests run nightly only, and presses Save
// expect: step 2: the release candidate box of each of the six rows is ticked and cannot be changed, its cell's reason naming A RELEASE RUNS EVERY TEST AT EVERY LEVEL; the every commit and pull request boxes of paid are unticked and cannot be changed, their reason naming COMMIT TESTS CALL NO PAID SERVICE and recorded responses; known positive: the boxes of system can be changed, and after the change no finding is listed and Save is offered; the committed schedule ticks system on nightly, release candidate and on demand only and every other row as the book does
test("TST-772203: UC-027 2 the author changes cells; the release candidate cannot be cleared and the commit cells of paid cannot be ticked, each with its reason", async () => {
  const world = server("github");
  const page = await open(world);
  for (const row of ROWS) {
    const box = boxOf(page, row, "release candidate");
    assert.deepEqual([box.checked, box.disabled], [true, true], `${row}: the release candidate stays ticked`);
    assert.match(text(byClass(cellOf(page, row, "release candidate"), "reason")[0]), /cannot be cleared: A RELEASE RUNS EVERY TEST AT EVERY LEVEL/);
  }
  for (const column of ["every commit", "pull request"]) {
    const box = boxOf(page, "paid", column);
    assert.deepEqual([box.checked, box.disabled], [false, true], `paid/${column} cannot be ticked`);
    const reason = text(byClass(cellOf(page, "paid", column), "reason")[0]);
    assert.match(reason, /COMMIT TESTS CALL NO PAID SERVICE/);
    assert.match(reason, /recorded responses/);
  }
  for (const column of ["every commit", "pull request"]) {
    const box = boxOf(page, "system", column);
    assert.equal(box.disabled, false, `known positive: system/${column} can be changed`);
    change(box, false);
  }
  assert.deepEqual(marks(page, "system"), ["nightly", "release candidate", "on demand"]);
  assert.equal(byTag(byClass(page, "schedule-findings")[0], "li").length, 0);
  assert.equal(buttonOf(page, "Save").disabled, false);
  await save(page);
  const schedule = readDocument(scheduleSchema, SCHEDULE, committed(world)[SCHEDULE]);
  assert.deepEqual(ticksOf(schedule, "system"), ["nightly", "release candidate", "on demand"]);
  assert.deepEqual(ticksOf(schedule, "unit"), COLUMNS);
  assert.deepEqual(ticksOf(schedule, "paid"), ["nightly", "release candidate", "on demand"]);
});

// TST-772204 · level: system · module: system
// guards: UC-027; THE TEST SCHEDULE IS DECLARED PER PRODUCT
// given: the product of TST-772202; the instance's participants lab-runner (run code and tests, the self-hosted runner lab), hosted-ci (run code and tests, hosted) and writer (without run code and tests)
// input: the author sets the nightly time 03:30 and the command "make test", chooses lab-runner for the row system, and presses Save
// expect: step 3: each row's runner choice offers hosted, lab-runner and hosted-ci, and not writer; known positive: before the change it shows hosted; the committed schedule names nightly 03:30, command make test and the row system on lab-runner; the committed workflow runs nightly at the cron "30 3 * * *", runs the system jobs on [self-hosted, lab] and passes make test as AGENT_M_COMMAND
test("TST-772204: UC-027 3 the nightly time, the test command and a row's runner among the participants that run tests are set and saved", async () => {
  const world = server("github");
  const page = await open(world);
  for (const row of ROWS) assert.deepEqual(byTag(byClass(rowOf(page, row), "runner")[0], "option").map((option) => option.getAttribute("value")), ["hosted", "lab-runner", "hosted-ci"], row);
  const runner = byClass(rowOf(page, "system"), "runner")[0];
  assert.equal(runner.value, "hosted", "known positive: the row runs hosted before");
  change(byTag(fieldOf(page, "nightly"), "input")[0], "03:30");
  change(byTag(fieldOf(page, "command"), "input")[0], "make test");
  change(runner, "lab-runner");
  await save(page);
  const files = committed(world);
  const schedule = readDocument(scheduleSchema, SCHEDULE, files[SCHEDULE]);
  assert.deepEqual([schedule.fields.nightly, schedule.fields.command], ["03:30", "make test"]);
  assert.equal(schedule.sections[0].rows.find((each) => each.cells.Row === "system").cells["runs on"], "lab-runner");
  const workflow = files[GENERATED.github];
  assert.match(workflow, /- cron: "30 3 \* \* \*"/);
  assert.match(workflow, /\n {2}system-nightly:\n(?: {4}.*\n)*? {4}runs-on: \[self-hosted, lab\]\n/);
  assert.match(workflow, /AGENT_M_COMMAND: 'make test'/);
});

for (const kind of ["github", "gitlab"]) {
  // TST-772205 · level: system · module: system
  // guards: UC-027; NO SECRET IN THE REPOSITORY; EVERY STEP EXPLAINS ITSELF
  // given: alice/shop on the fixture GitHub, then on the fixture GitLab, whose resources name the paid endpoint oracle with the CI secret ci:ORACLE_KEY; the book's default, which ticks paid
  // input: the author opens Tests → Schedule, reads the secrets, and presses Save
  // expect: step 4: the secrets block lists "ORACLE_KEY (for oracle)" alone, links the server's secrets page (GitHub https://github.com/alice/shop/settings/secrets/actions, GitLab https://gitlab.example.org/alice/shop/-/settings/ci_cd), holds a folded explanation and says Agent M never asks for a secret's value; the page holds no field but the form's five and the runner choices; the committed configuration reads ORACLE_KEY by its name from the CI's secrets
  test(`TST-772205: UC-027 4 on ${kind} the secrets the scheduled tests need are named, with the server's secrets page, and no value is asked for`, async () => {
    const world = server(kind);
    const page = await open(world);
    const block = byClass(page, "secrets")[0];
    assert.deepEqual(byTag(block, "li").map(text), ["ORACLE_KEY (for oracle)"]);
    assert.equal(byClass(block, "secrets-page")[0].getAttribute("href"), kind === "github" ? "https://github.com/alice/shop/settings/secrets/actions" : "https://gitlab.example.org/alice/shop/-/settings/ci_cd");
    assert.equal(byClass(block, "explain").length, 1);
    assert.match(text(block), /Agent M never asks for a secret's value\./);
    assert.equal(byTag(page, "input").filter((input) => input.getAttribute("type") !== "checkbox").length + byTag(page, "textarea").length, 5, "only the form's five fields");
    await save(page);
    const configuration = committed(world)[GENERATED[kind]];
    assert.match(configuration, kind === "github" ? /ORACLE_KEY: \$\{\{ secrets\.ORACLE_KEY \}\}/ : /# Secrets, read from the CI variables: ORACLE_KEY/);
  });

  // TST-772206 · level: system · module: system
  // guards: UC-027; THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE; ONE CLICK PER DECISION; GITLAB PRODUCTS ARE SUPPORTED
  // given: alice/shop on the fixture GitHub, then on the fixture GitLab, with no schedule; the page drawn writes nothing
  // input: one click on Save
  // expect: step 5: before the click nothing is written; after it one branch from the head read, one commit on it holding docs/tests/schedule.md and the generated file (.github/workflows/agent-m-tests.yml, or .gitlab/agent-m-tests.yml with .gitlab-ci.yml holding "- local: .gitlab/agent-m-tests.yml"), and one pull request into main whose description names the schedule file and the generated file; the default branch is unchanged; the committed configuration agrees with the committed schedule (configurationDrift of the two is empty) and the page links the pull request
  test(`TST-772206: UC-027 5 on ${kind} one click on Save opens one pull request holding the schedule and the configuration generated from it`, async () => {
    const world = server(kind);
    const main = world.head();
    const page = await open(world);
    assert.deepEqual(world.writes, [], "drawing writes nothing");
    await save(page);
    assert.deepEqual(writesOf(world, "createBranch").map(([, , from]) => from), [main]);
    const commits = writesOf(world, "commitFiles");
    assert.equal(commits.length, 1);
    const files = committed(world);
    assert.deepEqual(Object.keys(files).sort(), [SCHEDULE, GENERATED[kind], ...(kind === "gitlab" ? [".gitlab-ci.yml"] : [])].sort());
    if (kind === "gitlab") assert.match(files[".gitlab-ci.yml"], /^include:\n {2}- local: \.gitlab\/agent-m-tests\.yml$/m);
    const opened = writesOf(world, "openPullRequest");
    assert.equal(opened.length, 1);
    assert.equal(opened[0][1].base, "main");
    assert.equal(opened[0][1].branch, commits[0][1].branch);
    assert.ok(opened[0][1].body.includes(SCHEDULE) && opened[0][1].body.includes(GENERATED[kind]), "the description names both files");
    assert.equal(world.head(), main, "the default branch is unchanged");
    const schedule = readDocument(scheduleSchema, SCHEDULE, files[SCHEDULE]);
    const configuration = Object.fromEntries(Object.entries(world.tree(commits[0][1].branch)).filter(([path]) => /^(\.github\/workflows\/|\.gitlab)/.test(path)));
    assert.deepEqual(configurationDrift(configuration, schedule, targetOf(kind), readDocument(resourceSchema(), "docs/resources.md", world.tree()["docs/resources.md"]), participants), []);
    assert.deepEqual(byClass(proposalOf(page), "pull-request").map((link) => link.getAttribute("href")), [world.pulls[0].url]);
  });

  // TST-772207 · level: system · module: system
  // guards: UC-027; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; ONE CLICK PER DECISION
  // given: the pull request of TST-772206 on GitHub, then on GitLab; its CI service has started one run on its head, still running
  // input: the author reads the pull request; the run ends green and the author presses Check CI again; then one click on Merge; then opens Tests → Schedule again
  // expect: step 6: while running the page says "The CI is running." and offers no Merge; once green it says "The CI is green." and offers Merge; one click merges the pull request once at the head shown, and the page says "Merged as" the merge commit's first seven characters; the default branch then holds the schedule and the generated file; drawn again, the page no longer marks the book's default and says the committed configuration agrees with the schedule
  test(`TST-772207: UC-027 6 on ${kind} the pull request's CI is shown, and once green it is merged with one click`, async () => {
    const world = server(kind);
    const page = await open(world);
    await save(page);
    const head = world.pulls[0].head;
    world.ci(head, "running");
    click(buttonOf(proposalOf(page), "Check CI again"));
    await until(() => /running/.test(text(byClass(proposalOf(page), "ci-state")[0])), "the running CI shown");
    assert.equal(text(byClass(proposalOf(page), "ci-state")[0]), "The CI is running.");
    assert.equal(buttonOf(proposalOf(page), "Merge"), undefined, "no Merge while running");
    world.runs[0].state = "success";
    click(buttonOf(proposalOf(page), "Check CI again"));
    await until(() => buttonOf(proposalOf(page), "Merge"), "Merge offered once green");
    assert.equal(text(byClass(proposalOf(page), "ci-state")[0]), "The CI is green.");
    click(buttonOf(proposalOf(page), "Merge"));
    await until(() => byClass(page, "merged").length, "the merge shown");
    assert.deepEqual(writesOf(world, "mergePullRequest").map(([, number, at]) => [number, at]), [[world.pulls[0].number, head]]);
    assert.match(text(byClass(page, "merged")[0]), new RegExp(`^Merged as ${world.head().slice(0, 7)}\\.`));
    assert.ok(SCHEDULE in world.tree() && GENERATED[kind] in world.tree(), "the default branch holds both files");
    const again = await open(world);
    assert.equal(byClass(again, "default-schedule").length, 0);
    assert.equal(text(byClass(again, "drift-none")[0]), "The committed configuration agrees with the schedule.");
  });
}

// TST-772208 · level: system · module: system
// guards: UC-027; EVERY TEST RUN LEAVES A RESULT RECORD; A JOB RECORD STARTS NO CI RUN
// given: alice/shop on GitHub after the merge of TST-772207: its default branch holds the schedule and the generated workflow; the generated workflow's runs after the merge: a push at 11:00 and one at 12:00, a pull request at 12:30, an on-demand start at 13:00 and a nightly run started now
// input: the author opens Tests → Schedule
// expect: step 7: the merged workflow ends with the job agent-m records, which needs every test job of the file and runs unless the run is cancelled; its push trigger ignores docs/jobs/** and docs/conversations/**; the page's last runs link, for every commit, the push of 12:00, for pull request, nightly and on demand their runs; no missed nightly run is named
test("TST-772208: UC-027 7 every run leaves its result record, a job record starts no run, and the page shows the last run per occasion", async () => {
  const world = server("github");
  await savedAndMerged(world, await open(world));
  const workflow = world.tree()[GENERATED.github];
  const tests = [...workflow.matchAll(/^ {2}([a-z]+-[a-z-]+):\n {4}name: \1\n/gm)].map((match) => match[1]);
  assert.ok(tests.length > 0, "known positive: the workflow holds test jobs");
  const records = /\n {2}agent-m-records:\n {4}name: agent-m records\n {4}needs: \[([^\]]*)\]\n {4}if: \$\{\{ !cancelled\(\) \}\}\n/.exec(workflow);
  assert.ok(records, "the job agent-m records runs after the test jobs unless the run is cancelled");
  assert.deepEqual(records[1].split(", ").sort(), [...tests].sort());
  assert.match(workflow, /\n {2}push:\n(?: {4}.*\n)*? {4}paths-ignore:\n {6}- docs\/jobs\/\*\*\n {6}- docs\/conversations\/\*\*\n/);
  const main = world.head();
  world.ci(main, "success", { event: "push", started: "2026-11-01T11:00:00Z" });
  const second = world.ci(main, "failure", { event: "push", started: "2026-11-01T12:00:00Z" });
  const pulled = world.ci(main, "success", { event: "pull_request", started: "2026-11-01T12:30:00Z" });
  const demanded = world.ci(main, "success", { event: "workflow_dispatch", started: "2026-11-01T13:00:00Z" });
  const nightly = world.ci(main, "success", { event: "schedule", started: new Date().toISOString() });
  const page = await open(world);
  const linkOf = (occasion) => byTag(descendants(byClass(page, "last-runs")[0], (node) => node.getAttribute?.("data-occasion") === occasion)[0], "a").map((link) => link.getAttribute("href"));
  assert.deepEqual(linkOf("every commit"), [world.links.run(second)]);
  assert.deepEqual(linkOf("pull request"), [world.links.run(pulled)]);
  assert.deepEqual(linkOf("nightly"), [world.links.run(nightly)]);
  assert.deepEqual(linkOf("on demand"), [world.links.run(demanded)]);
  assert.equal(byClass(page, "nightly-missed").length, 0);
});

// ---------------------------------------------------------------- the alternative flows

const FOREIGN_WORKFLOW = "on:\n  push:\n  pull_request:\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n";

// TST-772209 · level: system · module: system
// guards: UC-027; THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE
// given: alice/shop on GitHub holds .github/workflows/ci.yml, which Agent M did not generate, triggered on push and pull_request
// input: the author opens Tests → Schedule and presses Save
// expect: 1a: the page lists ci.yml as not generated by Agent M with its triggers push and pull_request and the rows unit, component and system the schedule runs on those occasions, and the generated file as missing; Save's commit holds docs/tests/schedule.md and agent-m-tests.yml and not ci.yml, which stays byte-identical on the branch; the pull request says that ci.yml stays as it is beside Agent M's file
test("TST-772209: UC-027 1a a configuration Agent M did not generate is shown with its triggers, stays as it is, and the pull request says so", async () => {
  const world = server("github", { files: shop({ ".github/workflows/ci.yml": FOREIGN_WORKFLOW }) });
  const page = await open(world);
  const listed = Object.fromEntries(byTag(byClass(page, "drift")[0], "li").map((item) => [item.getAttribute("data-path"), text(item)]));
  assert.match(listed[".github/workflows/ci.yml"], /not generated by Agent M; triggers: push, pull_request; the schedule runs unit, component, system on the occasions they stand for/);
  assert.match(listed[GENERATED.github], /the file is missing; the schedule generates it/);
  await save(page);
  assert.deepEqual(Object.keys(committed(world)).sort(), [GENERATED.github, SCHEDULE].sort());
  assert.equal(world.tree(world.pulls[0].branch)[".github/workflows/ci.yml"], FOREIGN_WORKFLOW);
  assert.match(world.pulls[0].body, /Agent M's file stands beside the configuration this repository already has, which stays as it is: \.github\/workflows\/ci\.yml\./);
});

const FOREIGN_GITLAB = "stages: [test]\ntest:\n  stage: test\n  script: npm test\n";

// TST-772210 · level: system · module: system
// guards: UC-027; GITLAB PRODUCTS ARE SUPPORTED
// given: alice/shop on GitLab holds a .gitlab-ci.yml that Agent M did not generate, whose job test runs npm test on every push, GitLab's default for a job without rules
// input: the author opens Tests → Schedule and presses Save
// expect: 1a: known positive — the page lists .gitlab-ci.yml, Save's commit keeps every line of it and adds the include entry, and the pull request says .gitlab-ci.yml stays as it is; the page shows which triggers of .gitlab-ci.yml run which tests, as it does for a GitHub workflow: its entry names the trigger push
test("TST-772210: UC-027 1a on GitLab a configuration Agent M did not generate is shown with the triggers of its jobs",
  async () => {
    const world = server("gitlab", { files: shop({ ".gitlab-ci.yml": FOREIGN_GITLAB }) });
    const page = await open(world);
    const entry = byTag(byClass(page, "drift")[0], "li").find((item) => item.getAttribute("data-path") === ".gitlab-ci.yml");
    assert.ok(entry, "known positive: the page lists .gitlab-ci.yml");
    await save(page);
    const kept = committed(world)[".gitlab-ci.yml"];
    for (const line of FOREIGN_GITLAB.trimEnd().split("\n")) assert.ok(kept.split("\n").includes(line), `known positive: the commit keeps "${line}"`);
    assert.match(world.pulls[0].body, /which stays as it is: \.gitlab-ci\.yml\./, "known positive: the pull request says so");
    assert.match(text(entry), /triggers?: [^;]*push/, "the entry names the trigger push of its job");
  });

// TST-772211 · level: system · module: system
// guards: UC-027; THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE
// given: alice/shop on GitHub after a merge: its default branch holds the book's default schedule and the workflow generated from it; then the same workflow with its cron line edited by hand to "30 5 * * *"
// input: the author opens Tests → Schedule for each, and presses Save on the edited one
// expect: 1b: known positive — the generated workflow agrees; the edited one is listed with its line 14, found `- cron: "30 5 * * *"` and the schedule generating `- cron: "0 2 * * *"`, and the note that Save generates Agent M's file from the schedule again; Save's commit holds the workflow with "0 2 * * *" again, which agrees with the schedule
test("TST-772211: UC-027 1b a configuration edited by hand is shown against the schedule, and Save generates it again", async () => {
  const merged = server("github");
  await savedAndMerged(merged, await open(merged));
  const generated = merged.tree()[GENERATED.github];
  assert.equal(text(byClass(await open(merged), "drift-none")[0]), "The committed configuration agrees with the schedule.", "known positive: the generated workflow agrees");
  const edited = generated.replace('- cron: "0 2 * * *"', '- cron: "30 5 * * *"');
  assert.notEqual(edited, generated, "known positive: the line is edited");
  const world = server("github", { files: { ...merged.tree(), [GENERATED.github]: edited } });
  const page = await open(world);
  const entry = byTag(byClass(page, "drift")[0], "li").find((item) => item.getAttribute("data-path") === GENERATED.github);
  assert.match(text(entry), /line 14: found `- cron: "30 5 \* \* \*"`; the schedule generates `- cron: "0 2 \* \* \*"`/);
  assert.match(text(byClass(page, "drift")[0]), /Save generates Agent M's file from the schedule again\./);
  await save(page);
  assert.equal(committed(world)[GENERATED.github], generated);
});

// TST-772212 · level: system · module: system
// guards: UC-027; GITLAB PRODUCTS ARE SUPPORTED
// given: alice/shop on GitLab with a saved schedule whose nightly time is 04:15 and which ticks unit, component and paid for nightly; on GitHub the same schedule
// input: Save, the CI green, Merge
// expect: 3a: the generated .gitlab/agent-m-tests.yml holds no cron line and says the nightly run is the project's pipeline schedule; no pipeline schedule is set before the merge; after it one, set once: description "Agent M nightly tests", cron "15 4 * * *", timezone UTC, ref main, active, ROWS unit,component,paid; the page links https://gitlab.example.org/alice/shop/-/pipeline_schedules; on GitHub the workflow carries the cron "15 4 * * *", no pipeline schedule is set and none is linked
test("TST-772212: UC-027 3a on GitLab the nightly run is the project's pipeline schedule, set after the merge and linked", async () => {
  const rows = BOOK_ROWS();
  rows[2][3] = "";
  const files = shop({ [SCHEDULE]: scheduleText(rows, ["nightly: 04:15"]) });
  const gitlab = server("gitlab", { files });
  const page = await open(gitlab);
  await save(page);
  const configuration = committed(gitlab)[GENERATED.gitlab];
  assert.doesNotMatch(configuration, /cron/);
  assert.match(configuration, /The nightly run is the project's pipeline schedule, not a line of this file\./);
  assert.deepEqual(writesOf(gitlab, "setPipelineSchedule"), [], "nothing is set before the merge");
  gitlab.ci(gitlab.pulls[0].head, "success");
  click(buttonOf(proposalOf(page), "Check CI again"));
  await until(() => buttonOf(proposalOf(page), "Merge"), "Merge offered");
  click(buttonOf(proposalOf(page), "Merge"));
  await until(() => byClass(page, "pipeline-schedules").length, "the pipeline schedule linked");
  assert.deepEqual(gitlab.writes.map(([name]) => name).filter((name) => name === "mergePullRequest" || name === "setPipelineSchedule"), ["mergePullRequest", "setPipelineSchedule"]);
  assert.deepEqual(writesOf(gitlab, "setPipelineSchedule")[0][1], { description: "Agent M nightly tests", cron: "15 4 * * *", timezone: "UTC", ref: "main", active: true, variables: { ROWS: "unit,component,paid" } });
  assert.deepEqual(byClass(page, "pipeline-schedules").map((link) => link.getAttribute("href")), ["https://gitlab.example.org/alice/shop/-/pipeline_schedules"]);
  const github = server("github", { files });
  const shown = await savedAndMerged(github, await open(github));
  assert.match(github.tree()[GENERATED.github], /- cron: "15 4 \* \* \*"/);
  assert.deepEqual(writesOf(github, "setPipelineSchedule"), []);
  assert.equal(byClass(shown, "pipeline-schedules").length, 0);
});

// TST-772213 · level: system · module: system
// guards: UC-027; EVERY STEP EXPLAINS ITSELF
// given: alice/shop on GitHub whose saved schedule runs the row system on lab-runner, whose route is the self-hosted runner labelled lab; the default branch has three runs: one queued that asks for the label lab, one queued that asks for the label other, one that succeeded
// input: the author opens Tests → Schedule, then presses Save
// expect: 3b: one registration block, for the row system: a link to the server's runner page https://github.com/alice/shop/settings/actions/runners/new, the label lab, a folded explanation, and the queued run asking for lab, shown "(queued)", the other two not; the generated workflow runs the system jobs on [self-hosted, lab]
test("TST-772213: UC-027 3b a row on a self-hosted runner shows the server's runner page, its label and the runs that wait for it as queued", async () => {
  const rows = BOOK_ROWS();
  rows[2][6] = "lab-runner";
  const world = server("github", { files: shop({ [SCHEDULE]: scheduleText(rows) }) });
  const waiting = world.ci(world.head(), "queued", { event: "push", branch: "main" });
  const other = world.ci(world.head(), "queued", { event: "push", branch: "main" });
  world.ci(world.head(), "success", { event: "push", branch: "main" });
  world.labels[waiting] = ["self-hosted", "lab"];
  world.labels[other] = ["other"];
  const page = await open(world);
  const blocks = byClass(page, "runner-registration");
  assert.deepEqual(blocks.map((block) => block.getAttribute("data-row")), ["system"]);
  assert.deepEqual(byClass(blocks[0], "runner-page").map((link) => link.getAttribute("href")), ["https://github.com/alice/shop/settings/actions/runners/new"]);
  assert.equal(text(byClass(blocks[0], "runner-label")[0]), "lab");
  assert.equal(byClass(blocks[0], "explain").length, 1);
  const queued = byTag(byClass(blocks[0], "queued-runs")[0], "a");
  assert.deepEqual(queued.map((link) => link.getAttribute("href")), [world.links.run(waiting)]);
  assert.match(text(queued[0]), /\(queued\)$/);
  await save(page);
  assert.match(committed(world)[GENERATED.github], /\n {2}system-pull-request:\n(?: {4}.*\n)*? {4}runs-on: \[self-hosted, lab\]\n/);
});

// TST-772214 · level: system · module: system
// guards: UC-027; NO SECRET IN THE REPOSITORY
// given: alice/shop on GitHub, then on GitLab, whose resources name oracle with ci:ORACLE_KEY; the book's default
// input: Save; read the generated configuration's jobs of the row paid and of the row unit
// expect: 4a: every job of the row paid names ORACLE_KEY in AGENT_M_SECRETS, by which MOD-workflow-entries' runTests ends a run whose secret is not set as "not run: secret missing" (TST-1215103) and its result record says not run, never failed (TST-1216103); every job of the row unit names none; known positive: the configuration holds paid jobs
test("TST-772214: UC-027 4a each job of the paid row names the secrets it needs, so that a run without one is recorded as not run: secret missing", async () => {
  for (const kind of ["github", "gitlab"]) {
    const world = server(kind);
    await save(await open(world));
    const configuration = committed(world)[GENERATED[kind]];
    const jobs = configuration.split(/\n(?=(?: {2})?[a-z]+-[a-z-]+:\n)/);
    const paid = jobs.filter((job) => /^\s*paid-/.test(job)), unit = jobs.filter((job) => /^\s*unit-/.test(job));
    assert.ok(paid.length > 0 && unit.length > 0, `known positive: ${kind} holds paid and unit jobs`);
    for (const job of paid) assert.match(job, /AGENT_M_SECRETS: 'ORACLE_KEY'/, `${kind}: ${job.slice(0, 30)}`);
    for (const job of unit) assert.match(job, /AGENT_M_SECRETS: ''/, `${kind}: ${job.slice(0, 30)}`);
  }
});

// TST-772215 · level: system · module: system
// guards: UC-027; CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI
// given: alice/shop on GitHub; the pull request of a Save whose CI has one run succeeded and one failed
// input: the author reads the pull request
// expect: 6a: the page says the CI is red and that the pull request is not merged while its CI is red, links the server's runs of its head (https://github.com/alice/shop/commit/<head>/checks), and offers no Merge; nothing is merged and the default branch holds no schedule
test("TST-772215: UC-027 6a a red CI on the configuration pull request is not merged", async () => {
  const world = server("github");
  const page = await open(world);
  await save(page);
  const head = world.pulls[0].head;
  world.ci(head, "success");
  world.ci(head, "failure");
  click(buttonOf(proposalOf(page), "Check CI again"));
  await until(() => byClass(proposalOf(page), "ci-red").length, "the red CI shown");
  assert.equal(text(byClass(proposalOf(page), "ci-state")[0]), "The CI is red.");
  assert.match(text(byClass(proposalOf(page), "ci-red")[0]), /The pull request is not merged while its CI is red\./);
  assert.deepEqual(byClass(proposalOf(page), "failing-runs").map((link) => link.getAttribute("href")), [`https://github.com/alice/shop/commit/${head}/checks`]);
  assert.equal(buttonOf(proposalOf(page), "Merge"), undefined);
  assert.deepEqual(writesOf(world, "mergePullRequest"), []);
  assert.equal(world.tree()[SCHEDULE], undefined);
});

// TST-772216 · level: system · module: system
// guards: UC-027
// given: alice/shop, public, on GitHub and then on GitLab, after a merge: the schedule ticks nightly at 02:00 and the generated configuration stands; the last nightly run started three days ago
// input: the author opens Tests → Schedule
// expect: 7a: the page says the nightly run has not run, with the last run's date beside the expected one (today or yesterday, UTC), and links the workflow's page (GitHub https://github.com/alice/shop/actions, GitLab https://gitlab.example.org/alice/shop/-/pipelines); on GitHub it names that scheduled workflows of a public repository are disabled after a period without activity, on GitLab it does not
test("TST-772216: UC-027 7a a nightly run that has not run is named with its date beside the expected one", async () => {
  for (const kind of ["github", "gitlab"]) {
    const world = server(kind);
    await savedAndMerged(world, await open(world));
    const before = new Date(Date.now() - 3 * 24 * 3600 * 1000);
    world.ci(world.head(), "success", { event: "schedule", started: before.toISOString() });
    const missed = byClass(await open(world), "nightly-missed")[0];
    assert.ok(missed, `${kind}: the missed nightly run is named`);
    const day = (ms) => new Date(ms).toISOString().slice(0, 10);
    assert.ok(text(missed).includes(`its last run was on ${day(before)}`), `${kind}: the last run's date`);
    assert.ok([day(Date.now()), day(Date.now() - 24 * 3600 * 1000)].some((expected) => text(missed).includes(`expected on ${expected}`)), `${kind}: the expected date`);
    assert.deepEqual(byTag(missed, "a").map((link) => link.getAttribute("href")), [kind === "github" ? "https://github.com/alice/shop/actions" : "https://gitlab.example.org/alice/shop/-/pipelines"]);
    if (kind === "github") assert.match(text(missed), /scheduled workflows of a public repository are disabled after a period without activity/);
    else assert.doesNotMatch(text(missed), /disabled/);
  }
});

// TST-772217 · level: system · module: system
// guards: UC-027; A RELEASE RUNS EVERY TEST AT EVERY LEVEL
// given: alice/shop on GitHub after a merge, its generated workflow's runs one of each occasion it can tell by its event — a push, a pull request, a nightly run started now and an on-demand start — on the default branch's head, and the schedule's five occasions every commit, pull request, nightly, release candidate and on demand; the repository has no tag; then the release tag v2026.1.0 on the head, the candidate's tag v2026.1.0-rc.1 on the pull request's head, a failed push run there started before the head's push, and a later on-demand start there
// input: the author opens Tests → Schedule, once before the tags are set and once after
// expect: 7: known positive — the last runs show a row for every commit, pull request, nightly and on demand; and a row for release candidate, the fifth occasion of the schedule; without a tag the release candidate row says "no run yet" and links no run; with the tags it links the push run of the candidate's tag, not the head's newer push run that only the release tag v2026.1.0 names, and not the later on-demand start on the candidate's commit; known positive: the every commit row still links the head's push run
test("TST-772217: UC-027 7 the schedule page shows the last run of each of the five occasions, the release candidate's among them", async () => {
  const world = server("github");
  await savedAndMerged(world, await open(world));
  for (const event of ["push", "pull_request", "workflow_dispatch"]) world.ci(world.head(), "success", { event, started: "2026-10-02T10:00:00Z" });
  world.ci(world.head(), "success", { event: "schedule", started: new Date().toISOString() });
  const shownOn = (page) => descendants(byClass(page, "last-runs")[0], (node) => node.hasAttribute?.("data-occasion")).map((node) => node.getAttribute("data-occasion"));
  const rowOf = (page, occasion) => descendants(byClass(page, "last-runs")[0], (node) => node.getAttribute?.("data-occasion") === occasion)[0];
  const linksOf = (page, occasion) => byTag(rowOf(page, occasion), "a").map((link) => link.getAttribute("href"));
  const before = await open(world);
  for (const occasion of ["every commit", "pull request", "nightly", "on demand"]) assert.ok(shownOn(before).includes(occasion), `known positive: ${occasion} is shown`);
  assert.ok(shownOn(before).includes("release candidate"), "the release candidate's last run is shown");
  assert.match(text(rowOf(before, "release candidate")), /no run yet/, "without a tag the release candidate has no run");
  assert.deepEqual(linksOf(before, "release candidate"), []);
  const candidateCommit = world.pulls[0].head;
  world.tag("v2026.1.0", world.head());
  world.tag("v2026.1.0-rc.1", candidateCommit);
  const candidate = world.ci(candidateCommit, "failure", { event: "push", started: "2026-10-01T09:00:00Z" });
  world.ci(candidateCommit, "success", { event: "workflow_dispatch", started: "2026-10-03T09:00:00Z" });
  const after = await open(world);
  assert.deepEqual(linksOf(after, "release candidate"), [world.links.run(candidate)], "the push run of the candidate's tag");
  assert.match(text(rowOf(after, "release candidate")), /failure, 2026-10-01$/);
  assert.equal(linksOf(after, "every commit").length, 1, "known positive: the every commit row links a run");
  assert.notEqual(linksOf(after, "every commit")[0], world.links.run(candidate), "known positive: the head's newer push run is the every commit row's");
});
