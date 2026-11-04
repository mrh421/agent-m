// The runs of a commit (ITM-760) — MOD-test-pages' route `runs` (`runs/<commit>`), the reading part of UC-028 (steps 1 to 4, 2a, 2b, 6a, 7a): the commit chosen from the
// default branch's history, an open pull request or a release tag; one line per level; a level's tests with outcome, rate, what each guards and the participant and date; a failed
// test's expected result beside the observed one with its log; a worse rate with both rates; records that cannot be read; a record marked uncommitted.
// Running on the commit is ITM-761 and is not tested here.
// Run: node --test tests/test-pages-runs.test.mjs
//
// Module: MOD-test-pages
// Guards: UC-028; EVERY TEST RUN LEAVES A RESULT RECORD; TEST RESULTS ARE KEPT IN THE REPOSITORY; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY; A MODEL-DEPENDENT TEST IS MEASURED AS A RATE
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged, as tests/test-pages-schedule.test.mjs does. The product is a host of this file, kept to
// MOD-repository-hosts' interface (repositoryInfo, readSnapshot, readHistory, listPullRequests, listTags, ciRunLog, webLinks): no request leaves the process, nothing waits.
// Where the texts leave a reading open, the test states the reading it takes, and the pull request names it:
//   - The log of a failed test is asked of ciRunLog with the id that ends the record's `run` address, when webLinks().run(id) gives that address back; a record with no such address has its log unavailable.
//   - The last release is the highest tag of the form v<major>.<minor>.<patch> (release candidates are not releases).
//   - A level whose tests have no outcome other than "not run" reads "not run on this commit", with the occasions the schedule ticks for the row of that level (the book's default where the product has none).
//   - A record is read with readDocument and resultSchema.run: readRegister throws for that schema, which names two tables (## Outcomes and ## Failures).
// The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const { view } = await import("../src/test-pages/index.mjs");

const route = () => view.routes.find((candidate) => candidate.name === "runs");
const PRODUCT = "https://github.com/org/product";
const COMMIT = "c".repeat(40);
const OTHER = "e".repeat(40);
const HEAD = "f".repeat(40);
const RELEASE = "d".repeat(40);
const ACTIONS = `${PRODUCT}/actions`;

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => (node.className ?? "").split(" ").includes(name));
const byTag = (root, name) => descendants(root, (node) => node.localName === name);
const levelOf = (page, level) => descendants(page, (node) => node.getAttribute?.("data-level") === level)[0];
const testOf = (page, id) => descendants(page, (node) => node.getAttribute?.("data-test") === id)[0];

// ---------------------------------------------------------------- the fixtures

const SPEC = ["# Fixture product — Specification", "", "## Section", "", "**A GUARDED RULE** *(Product Owner)*", "A rule.", "*Check:* `tests/sample.test.mjs`", "",
  "**A SECOND RULE** *(Product Owner)*", "Another rule.", "*Check:* `tests/sample.test.mjs`", ""].join("\n");
// A test file's text: one declaration for each entry [number, level, guards, extra lines]; built by join, so that no line of this file is a declaration.
const declarations = (entries) => entries.map(([number, level, guards, extra = []]) => ["// TST-" + number + " · level: " + level + " · module: system",
  "// guards: " + guards, "// given: g", "// input: i", "// expect: e", ...extra, "test(\"t\", () => {});", ""].join("\n")).join("\n");
const TESTS = declarations([["901", "unit", "A GUARDED RULE"], ["902", "unit", "A GUARDED RULE; A SECOND RULE"], ["903", "unit", "A SECOND RULE"], ["904", "unit", "A SECOND RULE"],
  ["905", "system", "A GUARDED RULE", ["// runs: 20", "// phrasings: 2"]], ["906", "release", "A GUARDED RULE"]]);

const front = (commit, who, extra = "") => `---\ncommit: ${commit}\nlevels:\n  - unit\n  - system\noccasion: commit\nparticipant: ${who}\ndate: 2026-10-18T10:00:00Z\n${extra}---\n`;
const outcomes = (...rows) => `## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n${rows.join("\n")}\n`;
const failures = (...rows) => `\n## Failures\n\n| Test | Expected | Observed | Log |\n|---|---|---|---|\n${rows.join("\n")}\n`;
const RUN_777 = `run: ${PRODUCT}/actions/runs/777\n`;
const FIRST = front(COMMIT, "ci-hosted", RUN_777) + outcomes("| TST-901 | unit | passed | |", "| TST-902 | unit | passed | |", "| TST-903 | unit | failed | |", "| TST-904 | unit | passed | |",
  "| TST-905 | system | passed | 17 of 20 |") + failures("| TST-903 | the list is empty | the list holds one entry | AssertionError at line 4 |");
const SECOND = front(COMMIT, "lab-runner") + outcomes("| TST-904 | unit | failed | |");
const UNCOMMITTED = front(COMMIT, "bridge-pc", "uncommitted: true\n") + outcomes("| TST-902 | unit | failed | |");
const AT_RELEASE = front(RELEASE, "ci-hosted") + outcomes("| TST-905 | system | passed | 18 of 20 |");
const RECORDS = { [`runs/${COMMIT}/20261018-1000-commit-aaaa.md`]: FIRST, [`runs/${COMMIT}/20261018-1100-on-demand-bbbb.md`]: SECOND,
  [`runs/${COMMIT}/20261018-1200-on-demand-cccc.md`]: UNCOMMITTED, [`runs/${RELEASE}/20261001-1000-release-candidate-dddd.md`]: AT_RELEASE };

const snapshotOf = (commit, files) => ({ commit, paths: Object.keys(files), blob: () => "b".repeat(40), read: async (path) => files[path] ?? null, readMany: async () => {} });

// The product's host. `results` is the branch test-results (an Error: reading it fails); `logs` maps a run id to its log.
function productHost({ results = RECORDS, logs = { 777: "the full log of run 777" }, schedule = null, asked = [], web = PRODUCT } = {}) {
  const files = { "SPEC.md": SPEC, "tests/sample.test.mjs": TESTS, ...(schedule ? { "docs/tests/schedule.md": schedule } : {}) };
  const entry = (commit, message, date) => ({ commit, parents: [], author: { account: null, name: "x" }, date, message, changes: [] });
  const known = { [COMMIT]: entry(COMMIT, "Fix the list\n\nlong text", "2026-10-17T09:00:00Z"), [OTHER]: entry(OTHER, "Older commit", "2026-10-16T09:00:00Z"),
    [HEAD]: entry(HEAD, "Work on the branch", "2026-10-18T08:00:00Z"), [RELEASE]: entry(RELEASE, "Release one", "2026-10-01T09:00:00Z") };
  return {
    repositoryInfo: async () => ({ defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "" }),
    readHistory: async (path, options) => { asked.push(["history", options.ref]); return options.ref === "main" ? [known[COMMIT], known[OTHER]] : [known[options.ref]]; },
    listPullRequests: async (filter) => { asked.push(["pulls", filter.state]); return [{ number: 7, title: "Add the list", branch: "feature", base: "main", head: HEAD, state: "open", draft: false, url: "u", opened: "d", merged: null, closed: null, body: "" }]; },
    listTags: async () => [{ name: "v1.0.0", commit: RELEASE }, { name: "v1.1.0-rc.1", commit: HEAD }],
    readSnapshot: async (ref) => {
      if (ref === "test-results") { if (results instanceof Error) throw results; return snapshotOf("r".repeat(40), results); }
      // The branch trace-cache holds the graph of the product's SPEC and tests as each commit's, as the workflow "main changed" stores it
      // (tests/stored-graph-fake.mjs); the page reads it and never builds one. The schedule is read by the page itself, so the graph is the same for every case.
      return { ...snapshotOf(ref, files), readOn: storedGraphReadOn({ paths: ["SPEC.md", "tests/sample.test.mjs"], read: async (path) => ({ "SPEC.md": SPEC, "tests/sample.test.mjs": TESTS })[path] ?? null, commit: ref }) };
    },
    ciRunLog: async (id) => { asked.push(["log", id]); return logs[id] ?? null; },
    // ITM-889's entries: commitRuns and branch give a page from the commit's or the branch's name alone; `web` is the server's address of the repository.
    webLinks: () => ({ actions: `${web}/actions`, run: (id) => { asked.push(["run", id]); return `${web}/actions/runs/${id}`; }, secrets: `${web}/settings/secrets/actions`,
      commitRuns: (commit) => { asked.push(["commitRuns", commit]); return `${web}/commit/${commit}/checks`; }, branch: (name) => { asked.push(["branch", name]); return `${web}/tree/${name}`; } }),
  };
}

async function page(options = {}, params = { commit: COMMIT }) {
  const went = [];
  const context = { page: "main", instance: { repository: "alice/agent-m", host: productHost() }, store: null, go: (name, given) => went.push([name, given]),
    product: { address: PRODUCT, kind: "github", host: productHost(options), tokenStored: false } };
  const target = document.createElement("div");
  document.body.append(target);
  await route().render(target, context, params);
  target.went = went;
  return target;
}
const textOf = (node) => node.textContent.replace(/\s+/g, " ");

// ================================================================== the tests

// TST-760001 · level: unit · module: MOD-test-pages
// guards: UC-028; EVERY TEST RUN LEAVES A RESULT RECORD
// given: a product whose default branch holds two commits, with one open pull request and the tags v1.0.0 and v1.1.0-rc.1
// input: the route runs rendered without a commit; then the button of the pull request pressed
// expect: the page offers the two commits of the default branch, the pull request and both tags, each by its short SHA or name and message; pressing the pull request's button goes to the route runs with the pull request's head as commit
test("runs — without a commit the page offers the default branch's history, the open pull requests and the release tags", async () => {
  const shown = await page({}, {});
  const offered = textOf(shown);
  for (const wanted of [COMMIT.slice(0, 7), "Fix the list", OTHER.slice(0, 7), "Older commit", "#7", "Add the list", "v1.0.0", "v1.1.0-rc.1"]) assert.ok(offered.includes(wanted), wanted);
  const buttons = byTag(shown, "button").filter((button) => textOf(button).includes("#7"));
  assert.equal(buttons.length, 1);
  buttons[0].dispatchEvent(new Event("click"));
  assert.deepEqual(shown.went, [["runs", { commit: HEAD }]]);
});

// TST-760002 · level: unit · module: MOD-test-pages
// guards: UC-028
// given: the commit c…c, whose message is "Fix the list" followed by a body, dated 2026-10-17T09:00:00Z
// input: the route runs rendered for that commit
// expect: the page shows the full SHA, the first line of the message and the date, and not the body of the message
test("runs — the commit is shown by its SHA, message and date", async () => {
  const shown = await page();
  const head = byClass(shown, "commit")[0];
  assert.ok(head, "a commit head");
  const text = textOf(head);
  assert.ok(text.includes(COMMIT) && text.includes("Fix the list") && text.includes("2026-10-17T09:00:00Z"), text);
  assert.ok(!text.includes("long text"), "the body of the message is not shown");
});

// TST-760003 · level: unit · module: MOD-test-pages
// guards: UC-028; A TEST THAT FLIPS ON THE SAME COMMIT IS FLAKY; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the tests TST-901 to TST-904 of level unit and TST-905 of level system, TST-906 of level release; records of the commit in which 901 and 902 passed, 903 failed, 904 passed in one and failed in another, and an uncommitted record in which 902 failed; no record names TST-906
// input: the route runs rendered for the commit
// expect: the line of unit reads 2 passed, 1 failed, 1 flaky, 0 not run; the line of system reads 1 passed; the line of release reads "not run on this commit" and never "passed"; TST-904 reads flaky, not passed
test("runs — one line per level gives passed, failed, flaky and not run, and a level without a record never reads passed", async () => {
  const shown = await page();
  assert.match(textOf(byClass(levelOf(shown, "unit"), "summary")[0]), /2 passed.*1 failed.*1 flaky.*0 not run/);
  assert.match(textOf(byClass(levelOf(shown, "system"), "summary")[0]), /1 passed.*0 failed.*0 flaky.*0 not run/);
  const release = textOf(byClass(levelOf(shown, "release"), "summary")[0]);
  assert.match(release, /not run on this commit/);
  assert.doesNotMatch(release, /passed/i);
  assert.equal(byClass(testOf(shown, "TST-904"), "outcome")[0].textContent, "flaky");
});

// TST-760004 · level: unit · module: MOD-test-pages
// guards: UC-028
// given: a level without a record, and a schedule on the default branch that ticks the row release on the release candidate and on demand only
// input: the route runs rendered for the commit; and again for a product with no schedule file
// expect: the line of release names the occasions "release candidate" and "on demand"; with no schedule file it names those of the book's default, which are also release candidate and on demand, and the row unit's line is unaffected
test("runs — a level without a record names the occasion of the schedule that would run it", async () => {
  const schedule = "---\nnightly: 02:00\n---\n## Levels\n\n| Row | every commit | pull request | nightly | release candidate | on demand | runs on |\n|---|---|---|---|---|---|---|\n"
    + "| unit | ✓ | ✓ | ✓ | ✓ | ✓ | |\n| component | ✓ | ✓ | ✓ | ✓ | ✓ | |\n| system | ✓ | ✓ | ✓ | ✓ | ✓ | |\n| paid | | | ✓ | ✓ | ✓ | |\n| release | | | | ✓ | | |\n| user | | | | ✓ | ✓ | |\n";
  const saved = textOf(byClass(levelOf(await page({ schedule }), "release"), "summary")[0]);
  assert.match(saved, /release candidate/);
  assert.doesNotMatch(saved, /on demand/, "the saved schedule does not tick on demand for release");
  const book = textOf(byClass(levelOf(await page(), "release"), "summary")[0]);
  assert.match(book, /release candidate, on demand/);
});

// TST-760005 · level: unit · module: MOD-test-pages
// guards: UC-028; A MODEL-DEPENDENT TEST IS MEASURED AS A RATE
// given: TST-905 guards A GUARDED RULE and is recorded 17 of 20 on the commit by ci-hosted on 2026-10-18T10:00:00Z; TST-902 guards A GUARDED RULE and A SECOND RULE; the last release v1.0.0 recorded TST-905 18 of 20
// input: the route runs rendered for the commit
// expect: TST-905 shows its outcome passed, "17 of 20 runs" and "last release: 18 of 20", the participant and date; TST-902 links both rules to the requirement page by name
test("runs — a level's tests show outcome, rate with its runs, what each guards as a link, and the participant and date", async () => {
  const shown = await page();
  const rate = testOf(shown, "TST-905");
  assert.equal(byClass(rate, "outcome")[0].textContent, "passed");
  assert.match(textOf(byClass(rate, "rate")[0]), /17 of 20 runs/);
  assert.match(textOf(byClass(rate, "who")[0]), /ci-hosted.*2026-10-18T10:00:00Z/);
  const links = byTag(byClass(testOf(shown, "TST-902"), "guards")[0], "a");
  assert.deepEqual(links.map((link) => [link.textContent, link.getAttribute("href")]),
    [["A GUARDED RULE", "#requirement/name=A%20GUARDED%20RULE"], ["A SECOND RULE", "#requirement/name=A%20SECOND%20RULE"]]);
});

// TST-760006 · level: unit · module: MOD-test-pages
// guards: UC-028; EVERY TEST RUN LEAVES A RESULT RECORD
// given: TST-903 failed in a record that names the run …/actions/runs/777 and, under ## Failures, the expected result "the list is empty" and the observed "the list holds one entry"; the server keeps the log of run 777
// input: the route runs rendered for the commit
// expect: TST-903 shows the expected result beside the observed one (two elements of their own), the excerpt of the record, and the log "the full log of run 777", asked of ciRunLog with the id 777; a test that did not fail shows none of these
test("runs — a failed test shows its expected result beside the observed one, with its log", async () => {
  const asked = [];
  const shown = await page({ asked });
  const failed = testOf(shown, "TST-903");
  assert.equal(byClass(failed, "expected")[0].textContent, "the list is empty");
  assert.equal(byClass(failed, "observed")[0].textContent, "the list holds one entry");
  assert.match(textOf(failed), /AssertionError at line 4/);
  assert.equal(byClass(failed, "log")[0].textContent, "the full log of run 777");
  assert.deepEqual(asked.filter(([what]) => what === "log"), [["log", "777"]]);
  assert.equal(byClass(testOf(shown, "TST-901"), "expected").length, 0);
});

// TST-760007 · level: unit · module: MOD-test-pages
// guards: UC-028; TEST RESULTS ARE KEPT IN THE REPOSITORY
// given: the same failed test, the server no longer keeps the log of run 777 (ciRunLog gives null)
// input: the route runs rendered for the commit
// expect: the log is marked unavailable, the expected and the observed result and the outcome stay shown
test("runs — a log the server no longer keeps is marked unavailable and the outcome stays readable", async () => {
  const shown = await page({ logs: {} });
  const failed = testOf(shown, "TST-903");
  assert.match(textOf(byClass(failed, "log")[0]), /unavailable/);
  assert.equal(byClass(failed, "expected")[0].textContent, "the list is empty");
  assert.equal(byClass(failed, "outcome")[0].textContent, "failed");
});

// TST-760008 · level: unit · module: MOD-test-pages
// guards: UC-028; A MODEL-DEPENDENT TEST IS MEASURED AS A RATE
// given: TST-905 recorded 17 of 20 on the commit and 18 of 20 on the last release; a second product state where the commit records 19 of 20
// input: the route runs rendered for each
// expect: with 17 of 20 the test shows "worse than the last release" with both rates "17 of 20" and "18 of 20"; with 19 of 20 it shows no such mark
test("runs — a worse rate is shown with both rates", async () => {
  const worse = textOf(testOf(await page(), "TST-905"));
  assert.match(worse, /worse than the last release/);
  assert.ok(worse.includes("17 of 20") && worse.includes("18 of 20"), worse);
  const better = { ...RECORDS, [`runs/${COMMIT}/20261018-1000-commit-aaaa.md`]: FIRST.replace("17 of 20", "19 of 20") };
  assert.doesNotMatch(textOf(testOf(await page({ results: better }), "TST-905")), /worse/);
});

// TST-760009 · level: unit · module: MOD-test-pages
// guards: UC-028; TEST RESULTS ARE KEPT IN THE REPOSITORY
// given: a private repository without a token: reading the branch test-results fails
// input: the route runs rendered for the commit
// expect: the page says that the records cannot be read from the browser, links the branch test-results (webLinks().branch) and the runs of this commit (webLinks().commitRuns) and shows no line of any level and no outcome
test("runs — records that cannot be read say so and link the branch test-results and the runs of the commit", async () => {
  const shown = await page({ results: Object.assign(new Error("no token"), { name: "TokenRefused" }) });
  const unreadable = byClass(shown, "unreadable")[0];
  assert.ok(unreadable, "a notice");
  assert.match(textOf(unreadable), /cannot be read/);
  assert.deepEqual(byTag(unreadable, "a").map((link) => link.getAttribute("href")), [`${PRODUCT}/tree/test-results`, `${PRODUCT}/commit/${COMMIT}/checks`]);
  assert.equal(byClass(shown, "summary").length, 0, "no level line");
  assert.doesNotMatch(textOf(shown), /passed/i);
});

// TST-760010 · level: unit · module: MOD-test-pages
// guards: UC-028; EVERY TEST RUN LEAVES A RESULT RECORD
// given: a record marked uncommitted by bridge-pc in which TST-902 failed, beside a committed record in which it passed
// input: the route runs rendered for the commit
// expect: the record is shown, with its participant, marked "uncommitted changes" and not counted: TST-902 still reads passed and the line of unit counts no second failure
test("runs — a record marked uncommitted is shown and not counted", async () => {
  const shown = await page();
  const record = byClass(shown, "uncommitted")[0];
  assert.ok(record, "the record is shown");
  assert.match(textOf(record), /bridge-pc.*uncommitted changes|uncommitted changes.*bridge-pc/);
  assert.equal(byClass(testOf(shown, "TST-902"), "outcome")[0].textContent, "passed");
  assert.match(textOf(byClass(levelOf(shown, "unit"), "summary")[0]), /1 failed/);
});

// TST-855001 · level: unit · module: MOD-test-pages
// guards: UC-028; TEST RESULTS ARE KEPT IN THE REPOSITORY
// given: a private repository without a token (reading test-results fails), whose server's pages are those of another address (a GitLab-shaped one), and the route runs/<commit>
// input: the route rendered for the commit
// expect: the notice holds two links, in this order: the branch test-results and the runs of this commit, each the address webLinks gives for that name, each with a text that names what it leads to; none is the page of all runs (actions)
test("runs — the links of records that cannot be read come from webLinks, for the branch test-results and for this commit", async () => {
  const web = "https://gitlab.example/group/product";
  const shown = await page({ results: Object.assign(new Error("no token"), { name: "TokenRefused" }), web });
  const links = byTag(byClass(shown, "unreadable")[0], "a");
  assert.deepEqual(links.map((link) => link.getAttribute("href")), [`${web}/tree/test-results`, `${web}/commit/${COMMIT}/checks`]);
  assert.match(textOf(links[0]), /test-results/);
  assert.match(textOf(links[1]), /commit|run/i);
});

// TST-855002 · level: unit · module: MOD-test-pages
// guards: UC-028; TEST RESULTS ARE KEPT IN THE REPOSITORY
// given: as TST-855001, with a record of the log asked and the run's address asked of the fake
// input: the route rendered for the commit
// expect: webLinks was asked for branch("test-results") and commitRuns(<the commit>) and for nothing that needs a run's identifier: neither run(id) nor ciRunLog
test("runs — the link to the run of the commit needs no run identifier", async () => {
  const asked = [];
  await page({ results: Object.assign(new Error("no token"), { name: "TokenRefused" }), asked });
  assert.deepEqual(asked.filter(([what]) => ["branch", "commitRuns", "run", "log"].includes(what)), [["branch", "test-results"], ["commitRuns", COMMIT]]);
});

// TST-855003 · level: unit · module: MOD-test-pages
// guards: UC-028; TEST RESULTS ARE KEPT IN THE REPOSITORY
// given: a repository whose records can be read
// input: the route rendered for the commit
// expect: no notice that the records cannot be read, no link to the branch test-results or to the runs of the commit, and webLinks asked for neither
test("runs — where the records can be read, the links of the unreadable case are not shown", async () => {
  const asked = [];
  const shown = await page({ asked });
  assert.equal(byClass(shown, "unreadable").length, 0);
  assert.deepEqual(byTag(shown, "a").map((link) => link.getAttribute("href")).filter((href) => /test-results|\/checks$/.test(href)), []);
  assert.deepEqual(asked.filter(([what]) => ["branch", "commitRuns"].includes(what)), []);
});

// TST-1172001 · level: unit · module: MOD-test-pages
// guards: UC-028; EVERY STEP EXPLAINS ITSELF
// given: a valid fixture commit whose detail page lists per-level and per-test results
// input: the public route runs rendered for that commit
// expect: the detail page carries one folded shared explanation: details.explain with summary "What is this?" and nonempty text that says a missing result is not run, distinguishes failed from flaky results, and says a flaky test is repaired or removed rather than retried until green
test("TST-1172001 — a commit detail explains its results through the shared folded frame", async () => {
  const shown = await page();
  const folds = byClass(shown, "explain");
  assert.equal(folds.length, 1, "one shared explanation on the commit detail");
  const [summary, body] = folds[0].children;
  assert.equal(folds[0].localName, "details");
  assert.equal(summary.localName, "summary");
  assert.equal(summary.textContent, "What is this?");
  assert.ok(body.textContent.trim().length > 0, "the explanation has text");
  assert.match(textOf(body), /not run/i);
  assert.match(textOf(body), /failed.*flaky|flaky.*failed/i);
  assert.match(textOf(body), /repaired or removed.*not retried until green/i);
});

// ---------------------------------------------------------------- ITM-1223: the Tests entry's views, in the site's one look
//
// Readings the texts leave open, which these tests state (the pull request names them):
//   - The head is the route's first part, <section class="head">, its <h2> the route's heading; the line of where it reads is the product's address and the ref read.
//   - The five views are the route tests-views under the head: buttons of the frame (btn) Schedule, Browser, Runs, Audit, Generate, no link among them; the one shown carries aria-current="page";
//     a click goes through the context's go with the view's route and parameters.
//   - A commit to choose and a test of a level are rows of table.list; every cell carries data-label.

const look = await import("./test-pages-look.mjs");

// TST-1223001 · level: unit · module: MOD-test-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-028; UC-027; UC-029; UC-030; UC-026
// given: the fixture product with two commits on its default branch, one open pull request and two tags
// input: the route runs rendered without a commit; then the link Browser clicked
// expect: the first part is section.head with the heading Runs, the product's address and the default branch as the line of where it reads, and the five views Schedule, Browser, Runs, Audit, Generate as the frame's buttons, Runs marked; the click goes to the route trace with key tests
test("TST-1223001 — runs: the head names the route and leads through the Tests entry's views, Runs marked", async () => {
  const shown = await page({}, {});
  const links = look.assertTestsHead(shown, { heading: /^Runs$/, shown: "Runs" });
  assert.match(textOf(look.headOf(shown)), new RegExp(`${PRODUCT}.*main`));
  links[1].dispatchEvent(new Event("click"));
  assert.deepEqual(shown.went, [["trace", { key: "tests" }]]);
});

// TST-1223002 · level: unit · module: MOD-test-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-028
// given: the same product
// input: the route runs rendered without a commit
// expect: each commit offered — the two of the default branch, the pull request, the two tags — is a row of table.list, five rows, every cell labelled; each row's button carries btn; the three groups are panels
test("TST-1223002 — runs: the commits to choose are rows of the frame's table, their buttons the frame's", async () => {
  const shown = await page({}, {});
  assert.equal(look.assertListRows(shown, 5).length, 5);
  assert.equal(look.assertButtons(shown, 10).length, 10, "the five commits and the five views");
  look.assertPanels(shown, 3);
});

// TST-1223003 · level: unit · module: MOD-test-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-028
// given: the commit c…c with its records
// input: the route runs rendered for that commit
// expect: the first part is section.head with the heading Runs, Runs marked among the five views; each test of a level (TST-901 to TST-906) is a row of table.list with labelled cells; the levels are panels; every button carries btn
test("TST-1223003 — runs of a commit: the head, the levels as panels, each test a row of the frame's table", async () => {
  const shown = await page();
  look.assertTestsHead(shown, { heading: /^Runs$/, shown: "Runs" });
  look.assertListRows(shown, 6);
  for (const id of ["TST-901", "TST-902", "TST-903", "TST-904", "TST-905", "TST-906"]) assert.equal(testOf(shown, id)?.localName, "tr", id);
  look.assertButtons(shown, 1);
  look.assertPanels(shown, 3);
});
