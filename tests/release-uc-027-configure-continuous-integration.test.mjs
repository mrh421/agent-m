// Release tests of the requirements UC-027 "Configure continuous integration" realises, each checked from what a person reads on the schedule page and from what the page commits on a fixture GitHub and a
// fixture GitLab server: the book's default, no paid service on a commit, a release candidate that runs every level, the configuration generated from the schedule and only merged on green, no secret value
// written, GitLab products, a job record that starts no run, one click per decision and the steps that explain themselves. TST-772301 maps every requirement UC-027 realises to the release tests that guard
// it: this file's, and those other writers wrote.
// Run: node --test tests/release-uc-027-configure-continuous-integration.test.mjs
//
// Module: MOD-test-pages
// Module: MOD-test-schedule
// Guards: UC-027
// Level: release
//
// Written for the release testing of sprint 142 by developer-opus-e (ITM-772), who implemented none of ITM-759, ITM-747 and ITM-476, on which the item builds, nor the behaviour any case of this file guards: the
// page up to Save and from Save on (ITM-758, ITM-759, ITM-850, ITM-1223, ITM-1225), the findings, the secrets, the generator and the proposal of MOD-test-schedule (ITM-742 to ITM-747, ITM-1213, ITM-1214) were built
// by other participants, as the `Agent-M-Participant` trailers and item lines of their commits name them. Of the code UC-027's flow runs, developer-opus-e built ITM-1265 (each row's number of tests read from the
// view stored for the commit shown); the requirement that behaviour serves is mapped in BUILT_BY_WRITER to the release tests other writers wrote, and no case here guards it (RELEASE TESTS ARE NOT WRITTEN BY THE
// IMPLEMENTER). The world is tests/uc-027-harness.mjs'. Where the code and the SPEC or UC-027 disagree the case follows the text and is marked `todo` with the word FINDING; none does in this file.
// Readings the texts leave open, which the cases state:
//   - "Without a declaration, `unit`, `component` and `system` tests run on every commit and pull request, tests calling a paid service run nightly, and every test runs on a release candidate" (THE DEFAULT
//     SCHEDULE FOLLOWS THE BOOK) is read on the configuration the page commits for a product without a schedule: a job of each of those rows on each of those occasions, and none of paid on a commit or a
//     pull request.
//   - "A change to code, tests, workflows or the dashboard reaches the default branch only through a pull request whose CI run is green" (CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI) is
//     read for the schedule's own change: the page writes it to a branch, and merges it only once the CI of its head is green.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { matchesGlob } from "node:path";
import { testDeclarations } from "../src/test-document/index.mjs";
import { scheduleSchema } from "../src/test-schedule/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { BOOK_ROWS, GENERATED, ORACLE, SCHEDULE, boxOf, buttonOf, byClass, byTag, cellOf, change, click, descendants, fieldOf, open, proposalOf, resources, rowOf, save, scheduleText, server, shop, text,
  until, writesOf } from "./uc-027-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-027-configure-continuous-integration.md";
const SELF = "tests/release-uc-027-configure-continuous-integration.test.mjs";
const OWN_CI = "tests/release-itm-476-own-ci-schedule.test.mjs", PY_RUN = "tests/test_process_run.py";
const ROWS = ["unit", "component", "system", "paid", "release", "user"];
const OCCASIONS = ["every-commit", "pull-request", "nightly", "release-candidate", "on-demand"];
const T = "✓";
const committed = (world) => Object.fromEntries(writesOf(world, "commitFiles").at(-1)[1].files.map((file) => [file.path, file.text]));
/** The names of the jobs a generated configuration holds: `<row>-<occasion>` and Agent M's own. */
const jobsOf = (kind, configuration) => [...configuration.matchAll(kind === "github" ? /^ {2}([a-z]+(?:-[a-z]+)+):\n/gm : /^([a-z]+(?:-[a-z]+)+):\n/gm)].map((match) => match[1]);
/** The text of one job of a generated configuration. */
const jobOf = (kind, configuration, name) => {
  const start = configuration.indexOf(kind === "github" ? `\n  ${name}:\n` : `\n${name}:\n`);
  assert.ok(start >= 0, `the job ${name} stands in the configuration`);
  const rest = configuration.slice(start + 1);
  const next = rest.slice(1).search(kind === "github" ? /\n {2}[a-z][a-z-]*:\n/ : /\n[a-z][a-z-]*:\n/);
  return next === -1 ? rest : rest.slice(0, next + 1);
};
async function merged(world, page) {
  world.ci(world.pulls.at(-1).head, "success");
  click(buttonOf(proposalOf(page), "Check CI again"));
  await until(() => buttonOf(proposalOf(page), "Merge"), "Merge offered once green");
  click(buttonOf(proposalOf(page), "Merge"));
  await until(() => byClass(page, "merged").length, "the merge shown");
}

// ---------------------------------------------------------------- the map

// Each requirement UC-027 realises, with the release tests that guard it: this file's, and those other writers wrote.
const EVIDENCE = {
  "THE TEST SCHEDULE IS DECLARED PER PRODUCT": [[OWN_CI, "TST-476801"], ["tests/release-itm-1307-schedule-one-rule.test.mjs", "TST-1307301"]],
  "THE DEFAULT SCHEDULE FOLLOWS THE BOOK": [[SELF, "TST-772302"]],
  "COMMIT TESTS CALL NO PAID SERVICE": [[SELF, "TST-772303"], [OWN_CI, "TST-476804"]],
  "THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE": [[SELF, "TST-772305"], [OWN_CI, "TST-476802"]],
  "A RELEASE RUNS EVERY TEST AT EVERY LEVEL": [[SELF, "TST-772304"], ["tests/release-uc-028-run-and-review.test.mjs", "TST-773105"]],
  "EVERY TEST RUN LEAVES A RESULT RECORD": [[OWN_CI, "TST-476806"], ["tests/release-uc-028-run-and-review.test.mjs", "TST-773101"]],
  "EVERY TEST HAS ONE LEVEL": [["tests/release-uc-028-run-and-review.test.mjs", "TST-773108"]],
  "CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI": [[SELF, "TST-772306"], ["tests/release-uc-012-handle-an-issue.test.mjs", "TST-585305"]],
  "NO SECRET IN THE REPOSITORY": [[SELF, "TST-772307"], ["tests/release-uc-040-declare-the-products-resources.test.mjs", "TST-1041109"]],
  "GITLAB PRODUCTS ARE SUPPORTED": [[SELF, "TST-772308"]],
  "ONE CLICK PER DECISION": [[SELF, "TST-772310"]],
  "EVERY STEP EXPLAINS ITSELF": [[SELF, "TST-772311"]],
  "A JOB RECORD STARTS NO CI RUN": [[SELF, "TST-772309"], [OWN_CI, "TST-476805"]],
  "A RUN EXECUTES THE PROCESS MODEL OVER A SELECTION": [[PY_RUN, "TST-1045401"], ["tests/release-uc-025-validate-modules.test.mjs", "TST-741112"]],
  "A RUN SETS UP CI BEFORE IT IMPLEMENTS": [[PY_RUN, "TST-1045407"], [PY_RUN, "TST-1045408"]],
};
// The requirements whose behaviour on UC-027's path this file's writer built: guarded here only by the release tests other writers wrote.
const BUILT_BY_WRITER = {
  "THE TEST SCHEDULE IS DECLARED PER PRODUCT": "ITM-1265, each row's number of tests read from the view stored for the commit shown",
};

// TST-772301 · level: release · module: system
// guards: UC-027
// given: UC-027 as committed text, whose `realises` lists fifteen requirements, and the release tests named in EVIDENCE
// input: read UC-027's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-027 realises these fifteen requirements; each has at least one release test named; each test named stands in its file with the level release and guards that requirement; no case of this file guards a requirement in BUILT_BY_WRITER
test("TST-772301: UC-027 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 15, "known positive: UC-027 realises fifteen requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-027 realises");
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
  const own = testDeclarations(SELF, read(SELF));
  for (const requirement of Object.keys(BUILT_BY_WRITER)) assert.deepEqual(own.filter((each) => (each.guards ?? []).includes(requirement)).map((each) => each.id), [], `${requirement} is left to other writers`);
});

// ---------------------------------------------------------------- the default, the paid service, the release candidate

for (const kind of ["github", "gitlab"]) {
  // TST-772302 · level: release · module: system
  // guards: THE DEFAULT SCHEDULE FOLLOWS THE BOOK; UC-027
  // given: alice/shop on the fixture GitHub, then on the fixture GitLab, with no docs/tests/schedule.md
  // input: the author opens Tests → Schedule and presses Save without a change
  // expect: the page marks the table as the book's default; the committed schedule ticks unit, component and system on every occasion, paid on nightly, release candidate and on demand, release and user on release candidate and on demand; the committed configuration holds a job of unit, component and system on every commit and on a pull request, of paid nightly and none of paid on a commit or a pull request, and a job of each of the six rows on a release candidate
  test(`TST-772302: on ${kind}, without a declaration, unit, component and system run on every commit and pull request, paid tests nightly, and every test on a release candidate`, async () => {
    const world = server(kind);
    const page = await open(world);
    assert.match(text(byClass(page, "default-schedule")[0]), /book's default/);
    await save(page);
    const files = committed(world);
    const levels = readDocument(scheduleSchema, SCHEDULE, files[SCHEDULE]).sections.find((section) => section.heading === "## Levels").rows;
    const ticked = Object.fromEntries(levels.map(({ cells }) => [cells.Row, ["every commit", "pull request", "nightly", "release candidate", "on demand"].filter((column) => cells[column] === T)]));
    assert.deepEqual(ticked, { unit: ["every commit", "pull request", "nightly", "release candidate", "on demand"], component: ["every commit", "pull request", "nightly", "release candidate", "on demand"],
      system: ["every commit", "pull request", "nightly", "release candidate", "on demand"], paid: ["nightly", "release candidate", "on demand"], release: ["release candidate", "on demand"],
      user: ["release candidate", "on demand"] });
    const jobs = jobsOf(kind, files[GENERATED[kind]]);
    for (const row of ["unit", "component", "system"]) for (const occasion of ["every-commit", "pull-request"]) assert.ok(jobs.includes(`${row}-${occasion}`), `${row}-${occasion}`);
    assert.ok(jobs.includes("paid-nightly"), "paid runs nightly");
    for (const occasion of ["every-commit", "pull-request"]) assert.ok(!jobs.includes(`paid-${occasion}`), `no paid-${occasion}`);
    for (const row of ROWS) assert.ok(jobs.includes(`${row}-release-candidate`), `${row}-release-candidate`);
  });
}

// TST-772303 · level: release · module: system
// guards: COMMIT TESTS CALL NO PAID SERVICE; UC-027
// given: alice/shop on GitHub whose resources name the paid endpoint oracle (ci:ORACLE_KEY); a hand-written schedule that ticks paid on every commit; then the book's default
// input: the author opens Tests → Schedule for the hand-written schedule and presses Save; then for the default, and presses Save
// expect: for the hand-written one, the page lists a finding naming COMMIT TESTS CALL NO PAID SERVICE for the row paid, Save is not offered and a press writes nothing; known positive: with the box paid/every commit cleared, Save is offered; for the default, known positive: the job paid-nightly reads ORACLE_KEY; no job that runs on a push or on a pull request names ORACLE_KEY or belongs to the row paid
test("TST-772303: a test that calls a paid service runs on no commit and no pull request", async () => {
  const rows = BOOK_ROWS();
  rows[3][1] = T;
  const hand = server("github", { files: shop({ [SCHEDULE]: scheduleText(rows) }) });
  const page = await open(hand);
  const finding = byTag(byClass(page, "schedule-findings")[0], "li").map(text).find((line) => line.includes("[COMMIT TESTS CALL NO PAID SERVICE]"));
  assert.ok(finding && /paid/.test(finding), `a finding names the row paid and the requirement: ${finding}`);
  assert.equal(buttonOf(page, "Save").disabled, true, "Save is not offered");
  click(buttonOf(page, "Save"));
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(hand.writes, [], "nothing is written");
  change(boxOf(page, "paid", "every commit"), false);
  assert.equal(buttonOf(page, "Save").disabled, false, "known positive: mended, the schedule may be saved");
  const world = server("github");
  await save(await open(world));
  const configuration = committed(world)[GENERATED.github];
  assert.match(jobOf("github", configuration, "paid-nightly"), /ORACLE_KEY: \$\{\{ secrets\.ORACLE_KEY \}\}/, "known positive: the nightly paid job reads the secret");
  for (const name of jobsOf("github", configuration).filter((each) => /-(every-commit|pull-request)$/.test(each))) {
    assert.ok(!name.startsWith("paid-"), `${name} is no job of paid`);
    assert.doesNotMatch(jobOf("github", configuration, name), /ORACLE_KEY/, `${name} names no paid service's secret`);
  }
});

// TST-772304 · level: release · module: system
// guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL; UC-027
// given: alice/shop on GitHub with a hand-written schedule whose row unit leaves out the release candidate; then with the book's default
// input: the author opens Tests → Schedule for each; presses Save for the default
// expect: for the hand-written one the page lists a finding naming A RELEASE RUNS EVERY TEST AT EVERY LEVEL and Save is not offered; for the default, the release candidate box of each row is ticked and cannot be cleared, the committed workflow starts on a pushed tag v*-rc.*, and each of the six rows has a job on the release candidate, which runs only on a pushed tag
test("TST-772304: a release candidate runs every row of tests and cannot be cleared", async () => {
  const rows = BOOK_ROWS();
  rows[0][4] = "";
  const page = await open(server("github", { files: shop({ [SCHEDULE]: scheduleText(rows) }) }));
  assert.ok(byTag(byClass(page, "schedule-findings")[0], "li").map(text).some((line) => line.includes("[A RELEASE RUNS EVERY TEST AT EVERY LEVEL]")), "the finding is listed");
  assert.equal(buttonOf(page, "Save").disabled, true);
  const world = server("github");
  const shown = await open(world);
  for (const row of ROWS) assert.deepEqual([boxOf(shown, row, "release candidate").checked, boxOf(shown, row, "release candidate").disabled], [true, true], row);
  await save(shown);
  const configuration = committed(world)[GENERATED.github];
  assert.match(configuration, /\n {4}tags:\n {6}- "v\*-rc\.\*"\n/);
  for (const row of ROWS) assert.match(jobOf("github", configuration, `${row}-release-candidate`), /if: github\.event_name == 'push' && startsWith\(github\.ref, 'refs\/tags\/'\)/, row);
});

// ---------------------------------------------------------------- the configuration, its pull request and its merge

for (const kind of ["github", "gitlab"]) {
  // TST-772305 · level: release · module: system
  // guards: THE CI CONFIGURATION IS GENERATED FROM THE SCHEDULE; UC-027
  // given: alice/shop on GitHub, then on GitLab, with no schedule
  // input: the author unticks every commit and pull request of the row system and sets the nightly time 03:30; Save
  // expect: one commit holds the schedule and the configuration; the configuration says it is generated by Agent M from docs/tests/schedule.md; it holds the jobs system-nightly, system-release-candidate and system-on-demand and neither system-every-commit nor system-pull-request; on GitHub its nightly cron is "30 3 * * *"; on GitLab the pipeline schedule the merge would set is not in the file
  test(`TST-772305: on ${kind} the CI configuration is generated from the schedule the person saves`, async () => {
    const world = server(kind);
    const page = await open(world);
    change(boxOf(page, "system", "every commit"), false);
    change(boxOf(page, "system", "pull request"), false);
    change(byTag(fieldOf(page, "nightly"), "input")[0], "03:30");
    await save(page);
    assert.equal(writesOf(world, "commitFiles").length, 1);
    const configuration = committed(world)[GENERATED[kind]];
    assert.match(configuration, /^# Generated by Agent M from docs\/tests\/schedule\.md\. Change the schedule, not this file\.\n/);
    const jobs = jobsOf(kind, configuration);
    for (const name of ["system-nightly", "system-release-candidate", "system-on-demand"]) assert.ok(jobs.includes(name), name);
    for (const name of ["system-every-commit", "system-pull-request"]) assert.ok(!jobs.includes(name), `no ${name}`);
    if (kind === "github") assert.match(configuration, /- cron: "30 3 \* \* \*"/);
    else assert.doesNotMatch(configuration, /cron/);
  });
}

// TST-772306 · level: release · module: system
// guards: CODE ENTERS THE DEFAULT BRANCH THROUGH A PULL REQUEST WITH GREEN CI; UC-027
// given: alice/shop on GitHub with no schedule
// input: Save; the pull request read with no run, then with a failed run, then with that run succeeded; Merge
// expect: Save leaves the default branch at its head, holding no schedule and no workflow; with no run the page says no CI run has started and offers no Merge; with a failed run it offers no Merge; once green it offers Merge, and only after the merge the default branch holds .github/workflows/agent-m-tests.yml and the schedule
test("TST-772306: the schedule's configuration reaches the default branch only through its pull request, once its CI is green", async () => {
  const world = server("github");
  const main = world.head();
  const page = await open(world);
  await save(page);
  assert.equal(world.head(), main);
  assert.equal(GENERATED.github in world.tree(), false);
  assert.equal(text(byClass(proposalOf(page), "ci-state")[0]), "No CI run has started for the pull request yet.");
  assert.equal(buttonOf(proposalOf(page), "Merge"), undefined);
  const run = world.ci(world.pulls[0].head, "failure");
  click(buttonOf(proposalOf(page), "Check CI again"));
  await until(() => /red/.test(text(byClass(proposalOf(page), "ci-state")[0])), "the red CI shown");
  assert.equal(buttonOf(proposalOf(page), "Merge"), undefined, "no Merge on red");
  world.runs.find((each) => each.id === run).state = "success";
  click(buttonOf(proposalOf(page), "Check CI again"));
  await until(() => buttonOf(proposalOf(page), "Merge"), "Merge offered once green");
  assert.equal(world.head(), main, "nothing reached the default branch before the merge");
  click(buttonOf(proposalOf(page), "Merge"));
  await until(() => byClass(page, "merged").length, "the merge shown");
  assert.ok(GENERATED.github in world.tree() && SCHEDULE in world.tree());
});

// TST-772307 · level: release · module: system
// guards: NO SECRET IN THE REPOSITORY; UC-027
// given: alice/shop on GitHub whose resources name oracle with ci:ORACLE_KEY and leaky, an endpoint whose Secret column holds the value sk-live-abc123def456 where a name belongs; the book's default
// input: the author opens Tests → Schedule and presses Save
// expect: known positive — the product's resource list holds sk-live-abc123def456; the page shows ORACLE_KEY and not the value, and asks for no value; no file of Save's commit holds sk-live-abc123def456, and the workflow names ORACLE_KEY
test("TST-772307: no secret value reaches the schedule's commit, and none is asked for", async () => {
  const LEAKY = "| leaky | endpoint | https://leaky.example.org | example-model | — | — | runner:cpu | the vendor | yes | sk-live-abc123def456 |";
  const world = server("github", { files: shop({ "docs/resources.md": resources(ORACLE, LEAKY) }) });
  assert.match(world.tree()["docs/resources.md"], /sk-live-abc123def456/, "known positive: the value stands in the resource list");
  const page = await open(world);
  assert.match(text(page), /ORACLE_KEY/);
  assert.doesNotMatch(text(page), /sk-live-abc123def456/);
  assert.equal(byTag(byClass(page, "secrets")[0], "input").length, 0);
  await save(page);
  for (const [path, content] of Object.entries(committed(world))) assert.doesNotMatch(content, /sk-live-abc123def456/, path);
  assert.match(committed(world)[GENERATED.github], /ORACLE_KEY/);
});

// TST-772308 · level: release · module: system
// guards: GITLAB PRODUCTS ARE SUPPORTED; UC-027
// given: alice/shop on the fixture GitLab whose .gitlab-ci.yml includes a file of its own (`include:` with `- local: ci/lint.yml`) and defines a job lint
// input: the author opens Tests → Schedule, presses Save, the CI turns green, Merge; then opens Tests → Schedule again
// expect: Save commits .gitlab/agent-m-tests.yml and .gitlab-ci.yml, which keeps every line it had and lists `- local: .gitlab/agent-m-tests.yml` under its include beside `- local: ci/lint.yml`; the pull request is a merge request of the project; after the merge the project's pipeline schedule of the nightly run is set and linked; drawn again, the page says the committed configuration agrees with the schedule
test("TST-772308: a product on a GitLab server gets its pipeline, its include entry and its nightly pipeline schedule", async () => {
  const OWN = "include:\n  - local: ci/lint.yml\nlint:\n  script: npm run lint\n";
  const world = server("gitlab", { files: shop({ ".gitlab-ci.yml": OWN }) });
  const page = await open(world);
  await save(page);
  const files = committed(world);
  assert.ok(GENERATED.gitlab in files);
  for (const line of OWN.trimEnd().split("\n")) assert.ok(files[".gitlab-ci.yml"].split("\n").includes(line), `keeps "${line}"`);
  assert.match(files[".gitlab-ci.yml"], /^include:\n {2}- local: ci\/lint\.yml\n {2}- local: \.gitlab\/agent-m-tests\.yml\n/);
  assert.match(world.pulls[0].url, /\/-\/merge_requests\/\d+$/);
  await merged(world, page);
  assert.equal(world.schedules.length, 1);
  assert.deepEqual(byClass(page, "pipeline-schedules").map((link) => link.getAttribute("href")), ["https://gitlab.example.org/alice/shop/-/pipeline_schedules"]);
  assert.equal(text(byClass(await open(world), "drift-none")[0]), "The committed configuration agrees with the schedule.");
});

for (const kind of ["github", "gitlab"]) {
  // TST-772309 · level: release · module: system
  // guards: A JOB RECORD STARTS NO CI RUN; UC-027
  // given: alice/shop on GitHub, then on GitLab, with no schedule
  // input: Save; read the push trigger of the committed configuration (GitHub's paths-ignore, GitLab's rules:changes of the job unit-every-commit) for a push that changes only docs/jobs/JOB-1.md, only docs/jobs/JOB-1.md and docs/conversations/c.md, and src/a.mjs
  // expect: known positive — a push of src/a.mjs starts the run; a push that changes only job records, or only job and conversation records, starts none
  test(`TST-772309: on ${kind} a commit that only records a job starts no CI run`, async () => {
    const world = server(kind);
    await save(await open(world));
    const configuration = committed(world)[GENERATED[kind]];
    let starts;
    if (kind === "github") {
      const ignored = /\n {2}push:\n(?: {4}.*\n)*? {4}paths-ignore:\n((?: {6}- .*\n)+)/.exec(configuration)[1].split("\n").filter(Boolean).map((line) => line.replace(/^ {6}- /, ""));
      starts = (paths) => paths.some((path) => !ignored.some((glob) => matchesGlob(path, glob)));
    } else {
      const job = jobOf("gitlab", configuration, "unit-every-commit");
      const globs = /\n {6}changes:\n((?: {8}- .*\n)+)/.exec(job)[1].split("\n").filter(Boolean).map((line) => JSON.parse(line.replace(/^ {8}- /, "")));
      starts = (paths) => paths.some((path) => globs.some((glob) => matchesGlob(path, glob)));
    }
    assert.equal(starts(["src/a.mjs"]), true, "known positive: a push of code starts the run");
    assert.equal(starts(["docs/jobs/JOB-1.md"]), false);
    assert.equal(starts(["docs/jobs/JOB-1.md", "docs/conversations/c.md"]), false);
  });
}

// ---------------------------------------------------------------- one click, and the steps explained

// TST-772310 · level: release · module: system
// guards: ONE CLICK PER DECISION; UC-027
// given: alice/shop on GitHub with no schedule
// input: one click on Save; once the CI is green, one click on Merge
// expect: the one click on Save opens exactly one pull request, with no question asked in between (no dialog is drawn); the one click on Merge merges it once, and the page says it is merged
test("TST-772310: saving the schedule and merging its pull request take one click each", async () => {
  const world = server("github");
  const page = await open(world);
  await save(page);
  assert.equal(writesOf(world, "openPullRequest").length, 1);
  assert.equal(descendants(document.body, (node) => node.localName === "dialog" || node.getAttribute?.("role") === "dialog" || (node.className ?? "").split(" ").includes("decision")).length, 0, "no dialog");
  await merged(world, page);
  assert.equal(writesOf(world, "mergePullRequest").length, 1);
  assert.match(text(byClass(page, "merged")[0]), /^Merged as /);
});

// TST-772311 · level: release · module: system
// guards: EVERY STEP EXPLAINS ITSELF; UC-027
// given: alice/shop on GitHub whose saved schedule runs the row system on lab-runner, a self-hosted runner, and whose resources name oracle
// input: the author opens Tests → Schedule
// expect: every step that asks something of the author carries a folded explanation with the summary "What is this?" and a text of its own: each of the six rows, each of the five occasions, each of the five fields nightly, command, setup, cache and minutes, the secrets, and the row on the self-hosted runner
test("TST-772311: each step of the schedule page carries its folded explanation", async () => {
  const rows = BOOK_ROWS();
  rows[2][6] = "lab-runner";
  const page = await open(server("github", { files: shop({ [SCHEDULE]: scheduleText(rows) }) }));
  const places = [...ROWS.map((row) => [row, byTag(rowOf(page, row), "th")[0]]),
    ...["every commit", "pull request", "nightly", "release candidate", "on demand"].map((column) => [column, descendants(page, (node) => node.localName === "th" && node.getAttribute("data-column") === column)[0]]),
    ...["nightly", "command", "setup", "cache", "minutes"].map((key) => [`field ${key}`, fieldOf(page, key)]), ["secrets", byClass(page, "secrets")[0]], ["runner", byClass(page, "runner-registration")[0]]];
  assert.equal(places.length, 18);
  for (const [name, place] of places) {
    const folds = byClass(place, "explain");
    assert.equal(folds.length, 1, `${name} has one fold`);
    assert.equal(text(byTag(folds[0], "summary")[0]), "What is this?", name);
    assert.ok(text(folds[0]).length > "What is this?".length + 20, `${name}: the fold explains`);
  }
});

// The cells of the release candidate and of paid are checked through `cellOf`; kept here so that a reader finds the finder the cases use.
void cellOf;
