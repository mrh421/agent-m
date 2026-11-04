// Run on this commit (ITM-761) — MOD-test-pages' route `runs/<commit>`, UC-028 steps 5 to 7, 5a and 5b: the levels without a record preset, the participants that can run them (through `eligible`),
// the run panel with where the run happens, the paid services and the secrets by name, one click on Run that queues one job of the kind `run-tests`, its progress, and the two alternative flows (no
// participant can run the levels; no token).
// Run: node --test tests/test-pages-run-on-commit.test.mjs
//
// Module: MOD-test-pages
// Guards: UC-028; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; A ROLE NAMES THE CAPABILITIES IT NEEDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged, as tests/test-pages-runs.test.mjs does. The product and the instance are hosts of this file, kept to MOD-repository-hosts'
// interface (repositoryInfo, readSnapshot, readHistory, listPullRequests, listTags, listCiRuns, commitFiles, webLinks); the real MOD-job-catalogue, MOD-job-runner, MOD-participant-list, MOD-runtimes
// (queueJob, liveState, routesFor) and MOD-job-ledger run as they are, with the strategies the view hands the frame registered once, as the frame does. No request leaves the process; nothing waits.
// Where the texts leave a reading open, the test states the reading it takes, and the pull request names it:
//   - The levels offered are those the page lists (the levels of the commit's declared tests); the preset ones are those with no outcome on the commit (summary "not run on this commit").
//   - <button class="run-on-commit"> "Run on this commit" opens <section class="run-on-commit-form"> with <input class="level" type="checkbox"> per level, <input class="participant" type="radio"> per participant that
//     `eligible` admits for the capabilities of the kind `run-tests`, and <input class="person"> for the person's name (no identity setting exists). Once a participant and a name are chosen the run panel
//     (MOD-site-frame's runPanel) is drawn, with <p class="where"> (the route the job is queued on), <p class="paid-services"> and <p class="secrets-used"> (the names MOD-test-schedule's secretsNeeded gives).
//   - Participants on the tab's route (a model endpoint) run no code and are not offered a route here; the first other available route of a participant is the one used, as the review pages use it.
//   - A job is queued with parameters { commit, levels, occasion: "on-demand" } where levels are the checked ones. Its progress shows without a click (UC-028 6, 7): <p class="progress"> says "queued" for a job no runtime has
//     taken and "running" for one whose run the server lists as running, read again with setTimeout every 5000 ms (one timer waits at a time) by reading the job's record and asking MOD-runtimes' liveState; once the job has
//     ended the page is drawn again, so that the new record shows, and no timer waits; when the progress element is no longer in the page (the route was left) the next reading is not made and no timer is set.
//     The tests fire the timers themselves (a fake clock); nothing sleeps.
//   - 5a: <p class="missing-capability"> names "run code and tests" and holds <a class="uc-017"> to #use-case/id=UC-017; no Run is offered. 5b (no token stored): no panel and no job; <p class="no-token"> names the commit and the
//     levels and holds <a class="workflow-page"> to webLinks().actions, the server's page of the workflows, where the reviewer starts the run.
// The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const { view } = await import("../src/test-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const { resourceStrategies } = await import("../src/resource-list/index.mjs");
const { resultStrategies } = await import("../src/result-records/index.mjs");
const { routeStrategies } = await import("../src/runtimes/index.mjs");
const { appendToRecord } = await import("../src/job-ledger/index.mjs");

// The strategies the kind run-tests meets, registered once as the frame registers them (the view's own are checked by TST-761008).
for (const [at, strategies] of [resultStrategies, routeStrategies, resourceStrategies].entries()) registerStrategies(`tests/test-pages-run-on-commit.test.mjs#${at}`, strategies);

const route = () => view.routes.find((candidate) => candidate.name === "runs");
const PRODUCT = "https://github.com/org/product";
const COMMIT = "c".repeat(40);
const HEAD = "a".repeat(40);
const WORKFLOW = ".github/workflows/agent-m-jobs.yml";

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => (node.className ?? "").split(" ").includes(name));
const byTag = (root, name) => descendants(root, (node) => node.localName === name);
const textOf = (node) => node.textContent.replace(/\s+/g, " ");
const flush = async () => { for (let n = 0; n < 60; n += 1) await new Promise((resolve) => setImmediate(resolve)); };
const trusted = async (node) => { const event = new Event("click"); Object.defineProperty(event, "isTrusted", { value: true }); node.dispatchEvent(event); await flush(); };
const changed = async (node) => { node.dispatchEvent(new Event("change")); await flush(); };
// The fake clock: setTimeout and clearTimeout of this file keep the timers a page sets; a test fires them.
const realSet = globalThis.setTimeout, realClear = globalThis.clearTimeout;
const clock = { waiting: [] };
globalThis.setTimeout = (run, delay) => { const timer = { run, delay }; clock.waiting.push(timer); return timer; };
globalThis.clearTimeout = (timer) => { clock.waiting = clock.waiting.filter((held) => held !== timer); };
const fire = async () => { const due = clock.waiting; clock.waiting = []; for (const timer of due) await timer.run(); await flush(); };
afterEach(() => { clock.waiting = []; });
const runButton = (root) => byTag(root, "button").find((button) => textOf(button) === "Run");

// ---------------------------------------------------------------- the fixtures

const SPEC = ["# Fixture product — Specification", "", "## Section", "", "**A GUARDED RULE** *(Product Owner)*", "A rule.", "*Check:* `tests/sample.test.mjs`", ""].join("\n");
const declarations = (entries) => entries.map(([number, level]) => ["// TST-" + number + " · level: " + level + " · module: system", "// guards: A GUARDED RULE", "// given: g", "// input: i", "// expect: e",
  "test(\"t\", () => {});", ""].join("\n")).join("\n");
const TESTS = declarations([["901", "unit"], ["902", "system"], ["906", "release"]]);
// The commit has outcomes at the levels unit and system; the level release has none.
const RECORD = `---\ncommit: ${COMMIT}\nlevels:\n  - unit\n  - system\noccasion: commit\nparticipant: ci-hosted\ndate: 2026-10-18T10:00:00Z\n---\n`
  + "## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n| TST-901 | unit | passed | |\n| TST-902 | system | passed | |\n";
const RESULTS = { [`runs/${COMMIT}/20261018-1000-commit-aaaa.md`]: RECORD };

const REGISTER = `# Participants of this instance

**REGISTER**

The participants of the test instance.

| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |
|---|---|---|---|---|---|---|---|
| hosted-ci | CI agent | example-model | 200000 | — | draft text, run code and tests | the server | ci hosted secret CI_KEY |
| writer | CLI agent | example-model | 200000 | — | draft text, read the repository | this machine | bridge lab-pc agent claude |
`;
const WRITERS_ONLY = REGISTER.replace("| hosted-ci | CI agent | example-model | 200000 | — | draft text, run code and tests | the server | ci hosted secret CI_KEY |\n", "");
const RESOURCE_HEAD = "| Name | Kind | Address | Pin | Licence | Maintainer | Route | Processing place | Paid | Secret |\n|---|---|---|---|---|---|---|---|---|---|";
const RESOURCES = `# Resources of this product\n\n**REGISTER**\n\nThe resources.\n\n${RESOURCE_HEAD}\n`
  + "| oracle | endpoint | https://api.example.org/v1 | example-model | — | — | runner:cpu | the vendor | yes | ci:ORACLE_KEY |\n";
const SCHEDULE = "---\nnightly: 02:00\n---\n## Levels\n\n| Row | every commit | pull request | nightly | release candidate | on demand | runs on |\n|---|---|---|---|---|---|---|\n"
  + "| unit | ✓ | ✓ | ✓ | ✓ | ✓ | |\n| component | ✓ | ✓ | ✓ | ✓ | ✓ | |\n| system | ✓ | ✓ | ✓ | ✓ | ✓ | |\n| paid | | | ✓ | ✓ | ✓ | |\n| release | | | | ✓ | ✓ | |\n| user | | | | ✓ | ✓ | |\n";

const snapshotOf = (commit, files, extra = {}) => ({ commit, paths: Object.keys(files), blob: () => "b".repeat(40), read: async (path) => files[path] ?? null, readMany: async () => {},
  repository: { server: "github", origin: "https://github.com", path: "org/product", web: PRODUCT }, ...extra });

// The branch trace-cache holds the graph of the product's SPEC and tests as the commit's, as the workflow "main changed" stores it (tests/stored-graph-fake.mjs);
// the page reads it and never builds one. Every other file the page needs it reads itself, so the graph is the same for every case.
const graphOn = (commit) => storedGraphReadOn({ paths: ["SPEC.md", "tests/sample.test.mjs"], read: async (path) => ({ "SPEC.md": SPEC, "tests/sample.test.mjs": TESTS })[path] ?? null, commit });

/** The product's host: `written` keeps every commitFiles call; the files it commits stand on the default branch afterwards; `runs` is what listCiRuns gives. */
function productHost(options = {}) {
  const { web = PRODUCT, written = [] } = options;
  const files = { "SPEC.md": SPEC, "tests/sample.test.mjs": TESTS, "docs/tests/schedule.md": SCHEDULE, "docs/resources.md": RESOURCES, [WORKFLOW]: "name: Agent M jobs\n" };
  const entry = { commit: COMMIT, parents: [], author: { account: null, name: "x" }, date: "2026-10-17T09:00:00Z", message: "Fix the list", changes: [] };
  const queued = () => written.length > 0;
  const committed = () => Object.fromEntries(written.flatMap((call) => call.files.map((file) => [file.path, [options.taken ?? []].flat().reduce((text, part) => appendToRecord(text, part), file.text)])));
  return {
    repositoryInfo: async () => ({ defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "" }),
    readHistory: async () => [entry],
    listPullRequests: async () => [],
    listTags: async () => [],
    readSnapshot: async (ref) => { if (ref === "test-results") return snapshotOf("r".repeat(40), options.results ?? RESULTS); if (queued()) options.reads = (options.reads ?? 0) + 1; return snapshotOf(ref === "main" ? HEAD : ref, { ...files, ...committed() }, { readOn: graphOn(ref === "main" ? HEAD : ref) }); },
    commitFiles: async (call) => { written.push(call); return { commit: "f".repeat(40) }; },
    listCiRuns: async () => options.runs ?? [],
    ciRunLog: async () => null,
    webLinks: () => ({ actions: `${web}/actions`, run: (id) => `${web}/actions/runs/${id}`, secrets: `${web}/settings/secrets/actions`, commitRuns: (commit) => `${web}/commit/${commit}/checks`,
      branch: (name) => `${web}/tree/${name}` }),
  };
}
const instanceHost = (register) => ({
  repositoryInfo: async () => ({ defaultBranch: "main", visibility: "public", canWrite: true }),
  readSnapshot: async () => ({ commit: "i".repeat(40), paths: ["docs/participants.md"], blob: () => "b".repeat(40), read: async (path) => (path === "docs/participants.md" ? register : null) }),
});

async function page(options = {}) {
  const { register = REGISTER, tokenStored = true, go = () => {} } = options;
  const context = { page: "main", instance: { repository: "alice/agent-m", host: instanceHost(register) }, store: null, go,
    product: { address: PRODUCT, kind: "github", host: productHost(options), tokenStored } };
  const target = document.createElement("div");
  document.body.append(target);
  await route().render(target, context, { commit: COMMIT });
  return target;
}
const open = async (shown) => { await trusted(byClass(shown, "run-on-commit")[0]); return byClass(shown, "run-on-commit-form")[0]; };
const choose = async (form, name = "Reviewer Rae") => {
  byClass(form, "person")[0].value = name;
  const radio = byClass(form, "participant")[0];
  radio.checked = true;
  await changed(radio);
};

// TST-761001 · level: unit · module: MOD-test-pages
// guards: UC-028; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: a commit with outcomes at the levels unit and system and none at the level release; a token stored
// input: the route runs/<commit> rendered; the person's click on Run on this commit
// expect: drawing writes nothing and shows a button Run on this commit and no form; the click shows one checkbox per level, release the only one checked, and still writes nothing
test("run on this commit — the levels without a record are preset, and nothing is written by drawing or by opening", async () => {
  const written = [];
  const shown = await page({ written });
  assert.equal(byClass(shown, "run-on-commit").length, 1);
  assert.equal(byClass(shown, "run-on-commit-form").length, 0);
  const form = await open(shown);
  const levels = byClass(form, "level");
  assert.deepEqual(levels.map((box) => box.value).sort(), ["release", "system", "unit"]);
  assert.deepEqual(levels.filter((box) => box.checked).map((box) => box.value), ["release"]);
  assert.deepEqual(written, []);
});

// TST-761002 · level: unit · module: MOD-test-pages
// guards: UC-028; A ROLE NAMES THE CAPABILITIES IT NEEDS
// given: a register with hosted-ci (declares run code and tests) and writer (does not)
// input: Run on this commit pressed
// expect: the participants offered are hosted-ci alone
test("run on this commit — only the participants that can run code and tests are offered", async () => {
  const form = await open(await page());
  assert.deepEqual(byClass(form, "participant").map((radio) => radio.value), ["hosted-ci"]);
});

// TST-761003 · level: unit · module: MOD-test-pages
// guards: UC-028; THE PAGE NAMES WHERE IT SENDS
// given: hosted-ci chosen with a name, the level release checked; the resource list marks the endpoint oracle paid with the secret ORACLE_KEY
// input: the participant chosen
// expect: the run panel is drawn with the destination hosted-ci, a Run button, the route "ci hosted", the paid service oracle and the secret ORACLE_KEY by name; nothing is written
test("run on this commit — the run panel names where the run happens, the paid services and the secrets by name", async () => {
  const written = [];
  const shown = await page({ written });
  const form = await open(shown);
  await choose(form);
  const panel = byClass(form, "run-panel")[0];
  assert.ok(panel, "a run panel");
  assert.match(textOf(panel), /hosted-ci/);
  assert.ok(runButton(panel), "Run is offered");
  assert.match(textOf(byClass(form, "where")[0]), /ci hosted/);
  assert.match(textOf(byClass(form, "paid-services")[0]), /oracle/);
  assert.match(textOf(byClass(form, "secrets-used")[0]), /ORACLE_KEY/);
  assert.doesNotMatch(textOf(form), /sk-|secret value/i);
  assert.deepEqual(written, []);
});

// TST-761004 · level: unit · module: MOD-test-pages
// guards: UC-028; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the run panel for hosted-ci and the level release
// input: a click a script makes on Run; the person's click on Run; a second click of the person
// expect: the script's click writes nothing; the person's click commits exactly one start record under docs/jobs/ of kind run-tests, working on the commit, for hosted-ci, on the route ci hosted, started by the name entered, with the parameters commit, levels [release] and occasion on-demand; the second click adds none
test("run on this commit — one click on Run queues one job of the kind run-tests with the commit and the levels", async () => {
  const written = [];
  const shown = await page({ written });
  const form = await open(shown);
  await choose(form);
  const button = runButton(byClass(form, "run-panel")[0]);
  button.dispatchEvent(new Event("click"));
  await flush();
  assert.deepEqual(written, []);
  await trusted(button);
  await trusted(button);
  assert.equal(written.length, 1);
  assert.equal(written[0].files.length, 1);
  const { path, text } = written[0].files[0];
  assert.match(path, /^docs\/jobs\/JOB-[^/]+\.md$/);
  for (const line of ["kind: run-tests", "participant: hosted-ci", "route: ci hosted", "started_by: Reviewer Rae", COMMIT]) assert.ok(text.includes(line), `the record holds ${line}`);
  assert.match(text, /"levels":\s*\[\s*"release"\s*\]/);
  assert.match(text, /"occasion":\s*"on-demand"/);
  assert.match(textOf(byClass(form, "job-queued")[0]), /JOB-/);
});

// TST-761005 · level: unit · module: MOD-test-pages
// guards: UC-028
// given: the queued job; the record as committed, untaken; a fake clock
// input: Run pressed; the clock fired; then the job taken on a CI run the server lists as running, the clock fired; then the job ended with a result record on test-results, the clock fired
// expect: no button to check progress exists; one timer of 5000 ms waits after Run; the first reading says the job is queued, the second that it is running; after the end the page is drawn again, so that the level release has an outcome, and no timer waits
test("run on this commit — the progress is read again at an interval and the page is drawn again when the job has ended", async () => {
  const written = [];
  const taken = { part: "taken", at: new Date("2026-10-18T10:05:00Z"), by: `${PRODUCT}/actions/runs/42` };
  const options = { written, runs: [], taken: null, results: RESULTS };
  const shown = await page(options);
  const form = await open(shown);
  await choose(form);
  await trusted(runButton(byClass(form, "run-panel")[0]));
  assert.equal(byClass(form, "check-progress").length, 0, "no click is asked for");
  assert.deepEqual(clock.waiting.map((timer) => timer.delay), [5000]);
  await fire();
  assert.match(textOf(byClass(form, "progress")[0]), /queued/);
  assert.equal(clock.waiting.length, 1, "it goes on while the job has not ended");
  options.taken = taken;
  options.runs = [{ id: "42", workflow: "agent-m-jobs.yml", commit: HEAD, event: "push", state: "running", url: taken.by, started: null, ended: null }];
  await fire();
  assert.match(textOf(byClass(form, "progress")[0]), /running/);
  options.taken = [taken, { part: "end", at: new Date("2026-10-18T10:20:00Z"), state: "done", results: [], draft: null, rounds: [], usage: null, cost: { known: false, usage: null }, reason: null, log: null }];
  options.results = { ...RESULTS, [`runs/${COMMIT}/20261018-1015-on-demand-eeee.md`]: RECORD.replace("TST-902 | system | passed", "TST-902 | system | failed").replace("| TST-901 | unit | passed | |", "| TST-901 | unit | passed | |\n| TST-906 | release | passed | |") };
  await fire();
  assert.equal(clock.waiting.length, 0, "no timer waits after the end");
  const summary = byClass(descendants(shown, (node) => node.getAttribute?.("data-level") === "release")[0], "summary")[0];
  assert.match(textOf(summary), /1 passed/, "the new record shows");
});

// TST-761009 · level: unit · module: MOD-test-pages
// guards: UC-028
// given: the queued job, a timer waiting
// input: the route is left (the page's target is emptied); the clock fired
// expect: the job's record and the runtime are not read again, and no timer waits
test("run on this commit — the reading stops when the route is left", async () => {
  const written = [];
  const options = { written, runs: [], taken: null, reads: 0 };
  const shown = await page(options);
  const form = await open(shown);
  await choose(form);
  await trusted(runButton(byClass(form, "run-panel")[0]));
  assert.equal(clock.waiting.length, 1);
  const before = options.reads;
  shown.replaceChildren();
  await fire();
  assert.equal(options.reads, before, "nothing is read after the route was left");
  assert.equal(clock.waiting.length, 0);
});

// TST-761010 · level: unit · module: MOD-test-pages
// guards: UC-028
// given: the queued job, then ended
// input: the clock fired for the ending reading and again twice
// expect: after the ending reading no timer waits and the further firings read nothing
test("run on this commit — the reading stops when the job has ended", async () => {
  const end = { part: "end", at: new Date("2026-10-18T10:20:00Z"), state: "failed", results: [], draft: null, rounds: [], usage: null, cost: { known: false, usage: null }, reason: "tests red", log: null };
  const options = { written: [], runs: [], taken: end, reads: 0 };
  const shown = await page(options);
  const form = await open(shown);
  await choose(form);
  await trusted(runButton(byClass(form, "run-panel")[0]));
  await fire();
  assert.equal(clock.waiting.length, 0, "the ended job sets no further timer");
  const before = options.reads;
  await fire();
  await fire();
  assert.equal(options.reads, before);
});

// TST-761006 · level: unit · module: MOD-test-pages
// guards: UC-028; A ROLE NAMES THE CAPABILITIES IT NEEDS
// given: a register in which no participant declares run code and tests
// input: Run on this commit pressed
// expect: no participant is offered and no Run; the page names the capability "run code and tests" and links UC-017 (#use-case/id=UC-017); nothing is written
test("run on this commit — where no participant can run the levels the missing capability is named with a link to UC-017", async () => {
  const written = [];
  const form = await open(await page({ register: WRITERS_ONLY, written }));
  assert.equal(byClass(form, "participant").length, 0);
  assert.equal(runButton(form), undefined);
  const missing = byClass(form, "missing-capability")[0];
  assert.match(textOf(missing), /run code and tests/);
  assert.deepEqual(byClass(missing, "uc-017").map(textOf), ["UC-017"]);
  assert.deepEqual(written, []);
});

// TST-761007 · level: unit · module: MOD-test-pages
// guards: UC-028; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: no token stored for the product
// input: Run on this commit pressed
// expect: no participant list, no run panel and no job; the page names the commit and the preset levels and links the server's page of workflows (webLinks().actions)
test("run on this commit — without a token the server's workflow page is linked, with the commit named, and nothing is queued", async () => {
  const written = [];
  const shown = await page({ tokenStored: false, written });
  await trusted(byClass(shown, "run-on-commit")[0]);
  assert.equal(byClass(shown, "run-panel").length, 0);
  assert.equal(byClass(shown, "participant").length, 0);
  const notice = byClass(shown, "no-token")[0];
  assert.ok(textOf(notice).includes(COMMIT) && /release/.test(textOf(notice)), textOf(notice));
  assert.deepEqual(byTag(notice, "a").map((link) => link.getAttribute("href")), [`${PRODUCT}/actions`]);
  assert.deepEqual(written, []);
});

// TST-761008 · level: unit · module: MOD-test-pages
// guards: UC-028
// given: the view of MOD-test-pages
// input: its strategies read
// expect: they are MOD-result-records' resultStrategies and MOD-runtimes' routeStrategies, which the frame registers for the kind run-tests
test("run on this commit — the view hands resultStrategies and routeStrategies to the frame", () => {
  assert.ok(view.strategies.includes(resultStrategies), "resultStrategies");
  assert.ok(view.strategies.includes(routeStrategies), "routeStrategies");
});

// TST-1236002 · level: unit · module: MOD-test-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-028
// given: a register in which no participant declares run code and tests; the context's go records each call
// input: Run on this commit pressed; then a click on the link UC-017 of the text that names the missing capability
// expect: the click calls go("use-case", { id: "UC-017" }) once; the link carries no address of its own (no href)
test("TST-1236002 — run on this commit: the link to UC-017 leads through the context's go", async () => {
  const went = [];
  const form = await open(await page({ register: WRITERS_ONLY, go: (name, params) => went.push([name, params]) }));
  const links = byClass(byClass(form, "missing-capability")[0], "uc-017");
  assert.deepEqual(links.map(textOf), ["UC-017"], "known positive: the link UC-017 is drawn");
  await trusted(links[0]);
  assert.deepEqual(went, [["use-case", { id: "UC-017" }]]);
  assert.equal(links[0].hasAttribute("href"), false, "the link sets no address itself");
});
