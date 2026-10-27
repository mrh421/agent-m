// UC-028 Run and review the tests of a commit, walked as a whole through MOD-test-pages' routes `runs` and `release` (ITM-773): a commit picked from the default branch, a pull request or a release tag; one line per
// level; a level's tests with outcome, rate, guards, participant and date; a failed test opened; Run on this commit with its panel and its one click; the record the run leaves and the test it makes flaky; and each
// alternative flow the use case names: 1a, 1b, 2a, 2b, 5a, 5b, 6a, 7a and 7b. The product is a repository kept in memory (tests/uc-028-world.mjs) whose commits, branches and tags the pages read and write through
// MOD-repository-hosts' interface; the real MOD-result-records, MOD-job-catalogue, MOD-job-runner, MOD-runtimes, MOD-participant-list and MOD-release-evidence run as they are. The runner that would
// execute a queued job is the test itself, which adds the record the job would add. Nothing reaches the network; no timer fires (the progress is read again only when the test says so).
// Run: node --test tests/system-uc-028-run-and-review-the-tests.test.mjs
//
// Module: MOD-test-pages; MOD-result-records
// Guards: UC-028; EVERY TEST RUN LEAVES A RESULT RECORD; TEST RESULTS ARE KEPT IN THE REPOSITORY; A RESULT RECORD IS NEVER REWRITTEN; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY; A MODEL-DEPENDENT TEST IS MEASURED AS A RATE; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION
// Level: system
//
// Every expected text is taken from the use case's step as quoted in the test, or from the fixture the test builds; none is read from a document when the test runs. Each test states its input, precondition and
// expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request, which names the author.

import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT, WORKFLOW, SCHEDULE, SPEC, REGISTER, WRITERS_ONLY, declarations, record, product, context, byClass, byTag, textOf, levelOf, testOf, clickOf, changeOf, typeInto, flush,
  renderRoute } from "./uc-028-world.mjs";

const { view } = await import("../src/test-pages/index.mjs");
const { route: releaseRoute } = await import("../src/test-pages/release.mjs");
const { appendResult, resultSchema } = await import("../src/result-records/index.mjs");
const { readDocument } = await import("../src/documents/index.mjs");
const runs = view.routes.find((candidate) => candidate.name === "runs");

// The page sets a timer to read a queued job's progress again; none fires here.
const clock = { waiting: [] };
globalThis.setTimeout = (run, delay) => { const timer = { run, delay }; clock.waiting.push(timer); return timer; };
globalThis.clearTimeout = (timer) => { clock.waiting = clock.waiting.filter((held) => held !== timer); };
afterEach(() => { clock.waiting = []; });

// ---------------------------------------------------------------- the product: one commit under review, the release v1.0.0 before it, a pull request, a candidate

const TESTS = declarations([["901", "unit", "A GUARDED RULE"], ["902", "unit", "A GUARDED RULE; A SECOND RULE"], ["903", "unit", "A SECOND RULE"], ["904", "unit", "A SECOND RULE"],
  ["905", "system", "A GUARDED RULE", ["// runs: 20", "// phrasings: 2"]], ["906", "release", "A GUARDED RULE"]]);
const FILES = { "SPEC.md": SPEC, "tests/sample.test.mjs": TESTS, "docs/tests/schedule.md": SCHEDULE, [WORKFLOW]: "name: Agent M jobs\n" };
const RUN_777 = `run: ${PRODUCT}/actions/runs/777\n`;

function fixture({ logs = { 777: "the full log of run 777" }, withResults = true, uncommitted = false, worse = true, visible = true } = {}) {
  const world = product({ files: FILES, logs, visible, pulls: [] });
  const COMMIT = world.headOf("main");
  world.commit("main", { "docs/later.md": "later\n" }, "A later commit");
  const OLD = world.branch("old", FILES);
  world.tag("v1.0.0", OLD);
  const records = {
    [`runs/${COMMIT}/20261018-1000-commit-aaaa.md`]: record(COMMIT, "ci-hosted", [["TST-901", "unit", "passed", ""], ["TST-902", "unit", "passed", ""], ["TST-903", "unit", "failed", ""],
      ["TST-904", "unit", "passed", ""], ["TST-905", "system", "passed", worse ? "17 of 20" : "19 of 20"]], { extra: RUN_777,
      failures: [["TST-903", "the list holds one entry", "the list is empty", "AssertionError at line 4"]] }),
    [`runs/${COMMIT}/20261018-1100-on-demand-bbbb.md`]: record(COMMIT, "lab-runner", [["TST-904", "unit", "failed", ""]], { occasion: "on-demand", date: "2026-10-18T11:00:00Z" }),
    [`runs/${OLD}/20261001-1000-release-candidate-dddd.md`]: record(OLD, "ci-hosted", [["TST-905", "system", "passed", "18 of 20"]], { occasion: "release-candidate", date: "2026-10-01T10:00:00Z" }),
    ...(uncommitted ? { [`runs/${COMMIT}/20261018-1200-on-demand-cccc.md`]: record(COMMIT, "bridge-pc", [["TST-902", "unit", "failed", ""]], { occasion: "on-demand", extra: "uncommitted: true\n" }) } : {}),
  };
  if (withResults) world.branch("test-results", records);
  return { world, COMMIT, OLD, records };
}

async function show(options = {}, ctxOptions = {}) {
  const made = fixture(options);
  const went = [];
  const ctx = context(made.world, { ...ctxOptions, went });
  const page = await renderRoute(runs, ctx, { commit: made.COMMIT });
  return { ...made, ctx, went, page };
}

// TST-773001 · level: system · module: MOD-test-pages
// guards: UC-028; TEST RESULTS ARE KEPT IN THE REPOSITORY
// given: a product whose default branch holds two commits, with the tags v1.0.0 and no open pull request
// input: the route runs rendered without a commit (step 1), then the button of the commit under review pressed
// expect: the page offers both commits of the default branch by short SHA and first line of message, and the tag v1.0.0; pressing the commit goes to the route runs with that commit; the page for it shows the full SHA, the message and the date
test("step 1: the reviewer picks a commit from the default branch's history or a release tag, and the commit is shown by its SHA, message and date", async () => {
  const made = fixture();
  const went = [];
  const chooser = await renderRoute(runs, context(made.world, { went }), {});
  const offered = textOf(chooser);
  for (const wanted of [made.COMMIT.slice(0, 7), "The first commit", "A later commit", "v1.0.0"]) assert.ok(offered.includes(wanted), `the page offers ${wanted}`);
  const button = byTag(chooser, "button").find((each) => textOf(each).includes("The first commit"));
  await clickOf(button);
  assert.deepEqual(went, [["runs", { commit: made.COMMIT }]]);
  const detail = await renderRoute(runs, context(made.world), { commit: made.COMMIT });
  const head = textOf(byClass(detail, "commit")[0]);
  assert.ok(head.includes(made.COMMIT) && head.includes("The first commit") && head.includes("2026-10-11"), head);
});

// TST-773002 · level: system · module: MOD-test-pages; MOD-result-records
// guards: UC-028; EVERY TEST RUN LEAVES A RESULT RECORD; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY
// given: the records of the commit on the branch test-results: unit tests 901 and 902 passed, 903 failed, 904 passed in one record and failed in another, the model-dependent 905 (system) passed 17 of 20; no record at the level release
// input: the page of the commit (step 2), then the level unit opened (step 3)
// expect: the unit line reads 2 passed, 1 failed, 1 flaky, 0 not run; the system line reads 1 passed; the release line reads "not run on this commit" with the occasion that would run it, never "passed"; each test shows its identifier, outcome, the participant and date of its run, and the requirement it guards as a link; 904 reads flaky with both runs
test("steps 2 and 3: one line per level, a level without a record reading not run on this commit, each test with outcome, guards, participant and date", async () => {
  const { page } = await show();
  assert.match(textOf(byClass(levelOf(page, "unit"), "summary")[0]), /2 passed, 1 failed, 1 flaky, 0 not run/);
  assert.match(textOf(byClass(levelOf(page, "system"), "summary")[0]), /1 passed/);
  const release = textOf(byClass(levelOf(page, "release"), "summary")[0]);
  assert.match(release, /not run on this commit/);
  assert.match(release, /release candidate/);
  assert.doesNotMatch(release, /passed/);
  const first = testOf(page, "TST-901");
  assert.equal(textOf(byClass(first, "outcome")[0]), "passed");
  assert.match(textOf(byClass(first, "who")[0]), /ci-hosted, 2026-10-18T10:00:00Z/);
  const link = byTag(byClass(first, "guards")[0], "a")[0];
  assert.equal(textOf(link), "A GUARDED RULE");
  assert.equal(link.getAttribute("href"), "#requirement/name=A%20GUARDED%20RULE");
  assert.equal(textOf(byClass(testOf(page, "TST-904"), "outcome")[0]), "flaky");
  assert.match(textOf(testOf(page, "TST-904")), /passed in .*failed in /);
});

// TST-773003 · level: system · module: MOD-test-pages
// guards: UC-028; A MODEL-DEPENDENT TEST IS MEASURED AS A RATE
// given: the model-dependent test 905 passed 17 of 20 runs on the commit and 18 of 20 on the last release, v1.0.0
// input: the page of the commit
// expect: 905 shows "17 of 20 runs (last release: 18 of 20)" and, the rate being lower than the last release's, says it is worse than the last release (7a); with 19 of 20 it says no such thing
test("step 3 and 7a: a model-dependent test shows its rate with the last release's, and a lower rate is shown as worse than the last release", async () => {
  const { page } = await show();
  const text = textOf(byClass(testOf(page, "TST-905"), "rate")[0]);
  assert.match(text, /17 of 20 runs \(last release: 18 of 20\)/);
  assert.match(text, /worse than the last release/);
  const better = await show({ worse: false });
  const ok = textOf(byClass(testOf(better.page, "TST-905"), "rate")[0]);
  assert.match(ok, /19 of 20 runs \(last release: 18 of 20\)/);
  assert.doesNotMatch(ok, /worse/);
});

// TST-773004 · level: system · module: MOD-test-pages
// guards: UC-028; TEST RESULTS ARE KEPT IN THE REPOSITORY
// given: the failed test 903 has a Failures row (expected "the list holds one entry", observed "the list is empty", excerpt "AssertionError at line 4") and its record names the run 777 on the server, whose log the server still keeps
// input: the page of the commit (step 4); then the same page on a server that no longer keeps the log (2a)
// expect: 903 shows the expected result beside the observed one, the excerpt and the full log; where the log is gone the page marks the log unavailable and every outcome still reads as before
test("step 4 and 2a: a failed test shows expected beside observed, the excerpt and the log; where the server no longer keeps the log only the log is unavailable", async () => {
  const { page } = await show();
  const failure = byClass(testOf(page, "TST-903"), "failure")[0];
  assert.equal(textOf(byClass(failure, "expected")[0]), "the list holds one entry");
  assert.equal(textOf(byClass(failure, "observed")[0]), "the list is empty");
  assert.equal(textOf(byClass(failure, "excerpt")[0]), "AssertionError at line 4");
  assert.equal(textOf(byClass(failure, "log")[0]), "the full log of run 777");
  const gone = await show({ logs: {} });
  assert.match(textOf(byClass(byClass(testOf(gone.page, "TST-903"), "failure")[0], "log")[0]), /unavailable/);
  assert.equal(textOf(byClass(testOf(gone.page, "TST-901"), "outcome")[0]), "passed");
  assert.match(textOf(byClass(levelOf(gone.page, "unit"), "summary")[0]), /2 passed, 1 failed, 1 flaky/);
});

// TST-773005 · level: system · module: MOD-test-pages; MOD-result-records
// guards: UC-028; EVERY TEST RUN LEAVES A RESULT RECORD; TEST RESULTS ARE KEPT IN THE REPOSITORY; A RESULT RECORD IS NEVER REWRITTEN; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A ROLE NAMES THE CAPABILITIES IT NEEDS
// given: the page of the commit, whose level release has no record; participants hosted-ci (run code and tests, route ci hosted) and writer (cannot run code); a token stored
// input: Run on this commit (step 5): the level release is preset, hosted-ci chosen, the name akmaier entered, Run pressed once (step 6); the runner adds its record to test-results, in which 903 passed and 906 passed; the page drawn again (step 7)
// expect: before Run nothing is written; the panel names where the run happens (ci hosted, the commit), the paid services (none) and the secrets (none); one click commits exactly one job record of the kind run-tests naming the commit and the level release; the runner's record is a new file on test-results and every earlier record is unchanged; 903, which failed and now passed on this commit, reads flaky, not passed
test("steps 5 to 7: Run on this commit presets the levels without a record, names where it runs, queues one job on one click, and the run's record makes the flipped test flaky", async () => {
  const { world, COMMIT, records, page } = await show();
  const written = () => world.calls.filter((call) => call.fn === "commitFiles");
  assert.equal(written().length, 0, "the page writes nothing before a click");
  await clickOf(byClass(page, "run-on-commit")[0]);
  const boxes = byClass(page, "level");
  assert.deepEqual(boxes.filter((box) => box.checked === true).map((box) => box.value), ["release"]);
  const radios = byClass(page, "participant");
  assert.deepEqual(radios.map((radio) => radio.value), ["hosted-ci"], "only a participant that can run code and tests is offered");
  radios[0].checked = true;
  typeInto(byClass(page, "person")[0], "akmaier");
  await changeOf(radios[0]);
  assert.match(textOf(byClass(page, "where")[0]), /ci hosted/);
  assert.match(textOf(byClass(page, "where")[0]), new RegExp(COMMIT));
  assert.match(textOf(byClass(page, "paid-services")[0]), /none/);
  assert.match(textOf(byClass(page, "secrets-used")[0]), /none/);
  assert.equal(written().length, 0, "the panel is shown, nothing is written");
  const run = byTag(page, "button").find((button) => textOf(button) === "Run");
  await clickOf(run);
  const jobs = written().flatMap((call) => call.change.files).filter((file) => /^docs\/jobs\/JOB-/.test(file.path));
  assert.equal(jobs.length, 1, "one click, one job record");
  assert.match(jobs[0].text, /kind: run-tests/);
  assert.ok(jobs[0].text.includes(COMMIT), "the job names the commit");
  assert.match(jobs[0].text, /release/);

  const result = `runs/${COMMIT}/20261018-1300-on-demand-eeee.md`;
  const added = readDocument(resultSchema.run, result, record(COMMIT, "hosted-ci", [["TST-903", "unit", "passed", ""], ["TST-906", "release", "passed", ""]], { occasion: "on-demand", date: "2026-10-18T13:00:00Z" }));
  await appendResult(world.host, added);
  const after = await renderRoute(runs, context(world), { commit: COMMIT });
  assert.equal(textOf(byClass(testOf(after, "TST-903"), "outcome")[0]), "flaky");
  assert.equal(textOf(byClass(testOf(after, "TST-906"), "outcome")[0]), "passed");
  const results = world.treeOf("test-results");
  for (const [path, text] of Object.entries(records)) assert.equal(results[path], text, `${path} is unchanged`);
  assert.ok(Object.hasOwn(results, result), "the run's record stands beside the old ones");
});

// TST-773006 · level: system · module: MOD-test-pages; MOD-participant-list
// guards: UC-028; A ROLE NAMES THE CAPABILITIES IT NEEDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the page of the commit, first with an instance whose participants cannot run code and tests (5a), then with no token stored (5b)
// input: Run on this commit pressed in each
// expect: 5a names the missing capability "run code and tests" and links to UC-017, offers no participant and no Run; 5b offers no panel, names the commit and the level release, and links to the server's page of workflows; in neither is anything written
test("5a and 5b: no participant can run the levels, and a run started without a token is handed to the server's page", async () => {
  const noRunner = await show({}, { register: WRITERS_ONLY });
  await clickOf(byClass(noRunner.page, "run-on-commit")[0]);
  const missing = textOf(byClass(noRunner.page, "missing-capability")[0]);
  assert.match(missing, /run code and tests/);
  assert.equal(textOf(byClass(noRunner.page, "uc-017")[0]), "UC-017");
  assert.equal(byTag(noRunner.page, "button").filter((button) => textOf(button) === "Run").length, 0);
  const tokenless = await show({}, { tokenStored: false });
  await clickOf(byClass(tokenless.page, "run-on-commit")[0]);
  const text = textOf(byClass(tokenless.page, "no-token")[0]);
  assert.ok(text.includes(tokenless.COMMIT) && text.includes("release"), text);
  assert.equal(byClass(tokenless.page, "workflow-page")[0].getAttribute("href"), `${PRODUCT}/actions`);
  for (const made of [noRunner, tokenless]) assert.equal(made.world.calls.filter((call) => call.fn === "commitFiles").length, 0);
});

// TST-773007 · level: system · module: MOD-test-pages
// guards: UC-028; TEST RESULTS ARE KEPT IN THE REPOSITORY; EVERY TEST RUN LEAVES A RESULT RECORD
// given: a private repository whose branch test-results cannot be read from the browser (2b); and a commit with an uncommitted record in which 902 failed (6a)
// input: the page of the commit in each
// expect: 2b says the records cannot be read and links to the branch test-results and to the runs of the commit on the server, and shows no level; 6a shows the uncommitted record and does not count it: the unit line still reads 2 passed
test("2b and 6a: records that cannot be read are said so with links, and an uncommitted record is shown and not counted", async () => {
  const unreadable = await show({ withResults: false });
  const text = textOf(byClass(unreadable.page, "unreadable")[0]);
  assert.match(text, /cannot be read/);
  const hrefs = byTag(byClass(unreadable.page, "unreadable")[0], "a").map((link) => link.getAttribute("href"));
  assert.deepEqual(hrefs, [`${PRODUCT}/tree/test-results`, `${PRODUCT}/commit/${unreadable.COMMIT}/checks`]);
  assert.equal(byClass(unreadable.page, "level").length, 0);
  const marked = await show({ uncommitted: true });
  assert.match(textOf(byClass(marked.page, "uncommitted")[0]), /bridge-pc.*uncommitted changes, not counted/);
  assert.match(textOf(byClass(levelOf(marked.page, "unit"), "summary")[0]), /2 passed, 1 failed, 1 flaky/);
});

// TST-773008 · level: system · module: MOD-result-records
// guards: UC-028; A RESULT RECORD IS NEVER REWRITTEN; TEST RESULTS ARE KEPT IN THE REPOSITORY
// given: the branch test-results holds the record of the first run of the commit
// input: a run tries to add a record at the path of that record, with other outcomes (7b); then a new record beside it
// expect: the first is refused with the error Exists and no commit is made; the record on the branch is unchanged; the new record is added as a new file by one commit on test-results
test("7b: a record is only added, never changed: a record at an existing path is refused and a new run is a new record beside the old", async () => {
  const { world, COMMIT, records } = fixture();
  const existing = Object.keys(records)[0];
  const heads = () => world.headOf("test-results");
  const before = heads();
  const clash = readDocument(resultSchema.run, existing, record(COMMIT, "intruder", [["TST-901", "unit", "failed", ""]]));
  await assert.rejects(appendResult(world.host, clash), (error) => error.name === "Exists");
  assert.equal(heads(), before, "no commit was made");
  assert.equal(world.treeOf("test-results")[existing], records[existing]);
  const fresh = `runs/${COMMIT}/20261018-1400-on-demand-ffff.md`;
  await appendResult(world.host, readDocument(resultSchema.run, fresh, record(COMMIT, "lab-runner", [["TST-901", "unit", "passed", ""]], { occasion: "on-demand" })));
  assert.notEqual(heads(), before);
  assert.deepEqual(world.calls.filter((call) => call.fn === "commitFiles").map((call) => [call.change.branch, call.change.files.map((file) => file.path)]), [["test-results", [fresh]]]);
});

// ---------------------------------------------------------------- the release candidate (1a and 1b)

const { until } = await import("./prompt-bar.d/until.mjs");
const { blobSha } = await import("./uc-028-world.mjs");
const CHANGELOG = "# Changelog\n";
const RC_TESTS = declarations([["901", "unit", "A GUARDED RULE"], ["907", "user", "A GUARDED RULE; A SECOND RULE"]]).replaceAll("the list holds one entry", "the tag of the release appears");
const scheduleRunsOn = (who) => SCHEDULE.replace("| release | | | | ✓ | ✓ | |", `| release | | | | ✓ | ✓ | ${who} |`).replace("| user | | | | ✓ | ✓ | |", `| user | | | | ✓ | ✓ | ${who} |`);
const jobWorkflow = { [WORKFLOW]: "name: Agent M jobs\n" };

// TST-773009 · level: system · module: MOD-test-pages; MOD-result-records
// guards: UC-028; A RELEASE RUNS EVERY TEST AT EVERY LEVEL; EVERY TEST RUN LEAVES A RESULT RECORD; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the commit carries the tag v2026.5.0-rc.1, a release candidate; its tests hold the user-level test 907, which the schedule assigns to akmaier, and no record of it
// input: the page of the commit (1a); akmaier presses Failed without a name, then with her name but without saying what she saw, then presses Passed
// expect: the page lists 907 as a checklist item with its expected result, says it is assigned to akmaier and that 907 is still missing; Failed without a name or without what was seen writes nothing; the entered outcome is added as one new record of the occasion release-candidate, level user, participant akmaier; the page then names nothing as missing
test("1a: a release candidate's user-level tests are a checklist for the assigned person, who enters each outcome as a record, and no tag is set while one has not run", async () => {
  const world = product({ files: { "SPEC.md": SPEC, "tests/sample.test.mjs": RC_TESTS, "docs/tests/schedule.md": scheduleRunsOn("akmaier"), ...jobWorkflow } });
  const COMMIT = world.headOf("main");
  world.tag("v2026.5.0-rc.1", COMMIT);
  world.branch("test-results", { [`runs/${COMMIT}/20261018-1000-release-candidate-aaaa.md`]: record(COMMIT, "ci-hosted", [["TST-901", "unit", "passed", ""]], { occasion: "release-candidate" }) });
  const page = await renderRoute(runs, context(world), { commit: COMMIT });
  const list = byClass(page, "checklist")[0];
  assert.ok(list, "a checklist");
  const item = () => byClass(list, "user-test")[0];
  assert.equal(textOf(byClass(item(), "expected")[0]), "the tag of the release appears");
  assert.match(textOf(byClass(list, "assigned")[0]), /akmaier/);
  assert.match(textOf(byClass(list, "missing")[0]), /TST-907/);
  const writes = () => world.calls.filter((call) => call.fn === "commitFiles").length;
  await clickOf(byClass(item(), "failed")[0]);
  assert.equal(writes(), 0, "without a name nothing is written");
  typeInto(byClass(list, "person")[0], "akmaier");
  await clickOf(byClass(item(), "failed")[0]);
  assert.equal(writes(), 0, "without what she saw nothing is written");
  await clickOf(byClass(item(), "passed")[0]);
  await until(() => writes() === 1, "the record is added");
  const added = world.calls.find((call) => call.fn === "commitFiles").change;
  assert.equal(added.branch, "test-results");
  assert.equal(added.files.length, 1);
  assert.match(added.files[0].path, new RegExp(`^runs/${COMMIT}/\\d{8}-\\d{4}-release-candidate-[0-9a-f]{4}\\.md$`));
  const entered = readDocument(resultSchema.run, added.files[0].path, added.files[0].text);
  assert.deepEqual([entered.fields.occasion, entered.fields.levels, entered.fields.participant], ["release-candidate", ["user"], "akmaier"]);
  await until(() => /Nothing is missing/.test(textOf(byClass(page, "missing")[0] ?? page)), "nothing is missing");
});

// A release in progress: the candidate is started on the panel, its run ends with the records given, and the report is read again.
async function releasing(rows, { earlier = null } = {}) {
  const world = product({ files: { "SPEC.md": SPEC, "tests/sample.test.mjs": declarations([["901", "unit", "A GUARDED RULE"], ["902", "unit", "A SECOND RULE"], ["905", "unit", "A GUARDED RULE", ["// runs: 10", "// phrasings: 2"]]]),
    "docs/tests/schedule.md": scheduleRunsOn("a-second-person"), "CHANGELOG.md": CHANGELOG, ...jobWorkflow, ...(earlier ? { "docs/tests/releases/v2026.3.0.md": earlier.report } : {}) } });
  const COMMIT = world.headOf("main");
  world.branch("test-results", earlier ? { [`runs/${earlier.commit}/20260901-1000-release-candidate-aaaa.md`]: earlier.record } : {});
  const target = await renderRoute(releaseRoute, context(world), {});
  const version = byClass(target, "version")[0].value;
  typeInto(byClass(target, "changelog")[0], "Adds the list.");
  typeInto(byClass(target, "person")[0], "akmaier");
  byClass(target, "start")[0].dispatchEvent(new Event("click"));
  await until(() => /Queued run: JOB-/.test(target.textContent), "the candidate and its queued run");
  world.commit("test-results", { [`runs/${COMMIT}/20261019-1000-release-candidate-bbbb.md`]: record(COMMIT, "a-second-person", rows, { occasion: "release-candidate" }) });
  byClass(target, "refresh")[0].dispatchEvent(new Event("click"));
  await until(() => byClass(target, "accept").length > 0, "the complete report with Accept and release");
  return { world, COMMIT, target, version };
}

// TST-773010 · level: system · module: MOD-test-pages; MOD-release-evidence
// guards: UC-028; THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON; ACCEPTING THE RELEASE TEST REPORT RELEASES; A RELEASE RUNS EVERY TEST AT EVERY LEVEL
// given: a release candidate whose complete run left only passing outcomes for 901, 902 and the model-dependent 905 (9 of 10); the schedule names a second person for the release row
// input: the release panel: Check results after the run, then Accept and release with the name akmaier (1b)
// expect: the report is shown with every test and its outcome and rate, and Accept and release asks for no reason; one click commits the report to docs/tests/releases/v<version>.md together with an approval record naming its blob, and sets the tag v<version> on the tested commit
test("1b: the report of a complete run is accepted with one click, which commits the report and its approval and sets the tag on the tested commit", async () => {
  const { world, COMMIT, target, version } = await releasing([["TST-901", "unit", "passed", ""], ["TST-902", "unit", "passed", ""], ["TST-905", "unit", "passed", "9 of 10"]]);
  for (const wanted of ["TST-901", "TST-902", "TST-905", "9 of 10"]) assert.ok(target.textContent.includes(wanted), `the report names ${wanted}`);
  const accept = byClass(target, "accept")[0];
  assert.equal(byClass(accept, "reason").length, 0);
  typeInto(byClass(accept, "person")[0], "akmaier");
  byClass(accept, "accept")[0].dispatchEvent(new Event("click"));
  await until(() => world.tagOf(`v${version}`) !== undefined, "the tag stands");
  assert.equal(world.tagOf(`v${version}`), COMMIT, "the tag is set on the tested commit");
  const tree = world.treeOf("main");
  const report = tree[`docs/tests/releases/v${version}.md`];
  assert.ok(report, "the report is committed");
  const approval = Object.keys(tree).find((path) => path.startsWith(`docs/approvals/release-v${version}-`));
  assert.ok(approval, "an approval record is committed");
  assert.match(tree[approval], new RegExp(`blob: ${blobSha(report)}`));
});

// TST-773011 · level: system · module: MOD-test-pages; MOD-release-evidence
// guards: UC-028; A RED RELEASE IS ACCEPTED ONLY WITH ITS LIMITATIONS RECORDED; THE RELEASE TEST REPORT IS ACCEPTED BY A PERSON
// given: a candidate whose run left 902 failed and the model-dependent 905 at 6 of 10, worse than the last release's 8 of 10
// input: Accept and release without a reason; then with a reason for each of 902 and 905
// expect: the panel shows a reason field for 902 and for 905 before any click; without them nothing is released and the panel names both as missing; with them the tag is set and the approval holds both reasons
test("1b: a red run or a worse rate is accepted only with a reason for each, which the approval keeps as the release's limitations", async () => {
  const earlier = { commit: "e".repeat(40), record: record("e".repeat(40), "ci", [["TST-905", "unit", "passed", "8 of 10"]], { occasion: "release-candidate" }),
    report: ["---", "version: 2026.3.0", "candidate: v2026.3.0-rc.1", `commit: ${"e".repeat(40)}`, "date: 2026-09-01", "---", "## Limitations", "", "## Levels", "", "| Level | Passed | Failed | Flaky | Not run |",
      "|---|---|---|---|---|", "| unit | 1 | 0 | 0 | 0 |", "", "## Tests", "", "| Test | Level | Outcome | Guards |", "|---|---|---|---|", "| TST-905 | unit | 8 of 10 | A GUARDED RULE |", "",
      "## Requirements", "", "| Requirement | Level | Tests | Outcome |", "|---|---|---|---|", "| A GUARDED RULE | unit | TST-905 | passed |", "", "## Changelog entry", "", "Earlier release.", ""].join("\n") };
  const { world, target, version } = await releasing([["TST-901", "unit", "passed", ""], ["TST-902", "unit", "failed", ""], ["TST-905", "unit", "passed", "6 of 10"]], { earlier });
  const accept = byClass(target, "accept")[0];
  const reasons = byClass(accept, "reason");
  assert.deepEqual(reasons.map((field) => field.dataset.id).sort(), ["TST-902", "TST-905"]);
  typeInto(byClass(accept, "person")[0], "akmaier");
  byClass(accept, "accept")[0].dispatchEvent(new Event("click"));
  await until(() => /reason/i.test(byClass(accept, "result")[0].textContent), "the refusal");
  assert.match(byClass(accept, "result")[0].textContent, /TST-902/);
  assert.equal(world.tagOf(`v${version}`), undefined, "nothing was released");
  typeInto(reasons.find((field) => field.dataset.id === "TST-902"), "the flaky runner is replaced next week");
  typeInto(reasons.find((field) => field.dataset.id === "TST-905"), "the model answers slower now");
  byClass(accept, "accept")[0].dispatchEvent(new Event("click"));
  await until(() => world.tagOf(`v${version}`) !== undefined, "the tag stands");
  const tree = world.treeOf("main");
  const approval = tree[Object.keys(tree).find((path) => path.startsWith(`docs/approvals/release-v${version}-`))];
  assert.match(approval, /the flaky runner is replaced next week/);
  assert.match(approval, /the model answers slower now/);
});
