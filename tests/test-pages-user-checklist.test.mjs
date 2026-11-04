// The user-level checklist of a release candidate (ITM-762) — MOD-test-pages' route `runs/<commit>` for a commit that carries a release candidate's tag, UC-028 1a and UC-026 1a: the user-level
// tests as a checklist for the people the schedule's row `user` assigns, each with its expected result; each outcome a person enters appended as a result record (occasion release-candidate)
// through appendResult, never replacing one; the checklist names what is still missing.
// Run: node --test tests/test-pages-user-checklist.test.mjs
//
// Module: MOD-test-pages
// Guards: UC-028; A RELEASE RUNS EVERY TEST AT EVERY LEVEL; EVERY TEST RUN LEAVES A RESULT RECORD; A RESULT RECORD IS NEVER REWRITTEN; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged, as tests/test-pages-runs.test.mjs does. The product is a host of this file, kept to MOD-repository-hosts'
// interface (repositoryInfo, readSnapshot, readHistory, listTags, listPullRequests, ciRunLog, webLinks, commitFiles); the branch test-results is held in memory: no request leaves the process.
// Readings the texts leave open, which the tests take and the pull request names:
//   - A commit is a release candidate when listTags holds a tag v<version>-rc.<N> on it.
//   - The person is entered in a name field, as the release panel's Accept and release asks it; that name is the record's `participant`.
//   - A failed outcome is entered with what the person observed; the record's Failures row holds the declaration's expected result, that observation, and the log cell "entered by hand".
//   - "Still missing" is every user-level test of the commit whose outcome reads "not run" (resultsAt).
// The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { until } from "./prompt-bar.d/until.mjs";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const { view } = await import("../src/test-pages/index.mjs");
const { readDocument } = await import("../src/documents/index.mjs");
const { resultSchema } = await import("../src/result-records/index.mjs");

const route = () => view.routes.find((candidate) => candidate.name === "runs");
const PRODUCT = "https://github.com/org/product";
const CANDIDATE = "a".repeat(40);
const PLAIN = "b".repeat(40);
const HEAD = "c".repeat(40);

function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => (node.className ?? "").split(" ").includes(name));
const itemOf = (page, id) => descendants(page, (node) => node.getAttribute?.("data-checklist") === id)[0];
const textOf = (node) => node.textContent.replace(/\s+/g, " ");
const type = (field, text) => { field.value = text; field.dispatchEvent(new Event("input")); };

// ---------------------------------------------------------------- the fixtures

const MANUAL = ["### TST-762901 Read the exported report", "level: user", "module: MOD-test-pages", "guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL", "given: a release candidate",
  "input: open the report", "expect: the report lists every requirement with its evidence", "",
  "### TST-762902 Press Accept and release", "level: user", "module: MOD-test-pages", "guards: A RELEASE RUNS EVERY TEST AT EVERY LEVEL", "given: a complete report",
  "input: press the button", "expect: the tag of the release appears", ""].join("\n");
const SCHEDULE = "---\nnightly: 02:00\n---\n## Levels\n\n| Row | every commit | pull request | nightly | release candidate | on demand | runs on |\n|---|---|---|---|---|---|---|\n"
  + "| unit | ✓ | ✓ | ✓ | ✓ | ✓ | |\n| component | ✓ | ✓ | ✓ | ✓ | ✓ | |\n| system | ✓ | ✓ | ✓ | ✓ | ✓ | |\n| paid | | | ✓ | ✓ | ✓ | |\n| release | | | | ✓ | | |\n| user | | | | ✓ | ✓ | akmaier |\n";
const EARLIER_PATH = `runs/${CANDIDATE}/20261018-0900-release-candidate-1234.md`;
const EARLIER_TEXT = `---\ncommit: ${CANDIDATE}\nlevels:\n  - user\noccasion: release-candidate\nparticipant: akmaier\ndate: 2026-10-18T09:00:00Z\n---\n`
  + "## Outcomes\n\n| Test | Level | Outcome | Runs |\n|---|---|---|---|\n| TST-762901 | user | passed | |\n";

// The product's host: the branch test-results is `branch`, a Map from path to text, which commitFiles adds to; `writes` records each commitFiles call.
function productHost({ schedule = null, branch = new Map([[EARLIER_PATH, EARLIER_TEXT]]), writes = [] } = {}) {
  const files = { "SPEC.md": "# Fixture\n", "tests/manual.md": MANUAL, ...(schedule ? { "docs/tests/schedule.md": schedule } : {}) };
  const snapshotOf = (commit, held) => ({ commit, paths: [...held.keys()], blob: () => "b".repeat(40), read: async (path) => held.get(path) ?? null, readMany: async () => {} });
  let head = "1".repeat(40);
  return {
    repositoryInfo: async () => ({ defaultBranch: "main", visibility: "private", canWrite: true, archived: false, description: "" }),
    readHistory: async (path, options) => [{ commit: options.ref, parents: [], author: { account: null, name: "x" }, date: "2026-10-17T09:00:00Z", message: "A commit", changes: [] }],
    listPullRequests: async () => [],
    listTags: async () => [{ name: "v1.0.0", commit: PLAIN }, { name: "v1.1.0-rc.1", commit: CANDIDATE }],
    // The branch trace-cache holds the graph of the product's SPEC and tests as each commit's, as the workflow "main changed" stores it (tests/stored-graph-fake.mjs);
    // the page reads it and never builds one. The schedule is read by the page itself, so the graph is the same for every case.
    readSnapshot: async (ref) => (ref === "test-results" ? { ...snapshotOf(head, branch), repository: { path: "org/product" } }
      : { ...snapshotOf(ref, new Map(Object.entries(files))), readOn: storedGraphReadOn({ paths: ["SPEC.md", "tests/manual.md"], read: async (path) => ({ "SPEC.md": "# Fixture\n", "tests/manual.md": MANUAL })[path] ?? null, commit: ref }) }),
    commitFiles: async (change) => {
      writes.push(structuredClone(change));
      if (change.expectedHead !== head) throw Object.assign(new Error("moved"), { name: "Moved" });
      for (const file of change.files) branch.set(file.path, file.text);
      head = String(writes.length + 1).repeat(40);
      return { commit: head, url: `${PRODUCT}/commit/${head}` };
    },
    ciRunLog: async () => null,
    webLinks: () => ({ actions: `${PRODUCT}/actions`, run: (id) => `${PRODUCT}/actions/runs/${id}`, secrets: `${PRODUCT}/settings/secrets/actions` }),
  };
}

async function page(options = {}, commit = CANDIDATE) {
  const context = { page: "main", instance: { repository: "alice/agent-m", host: productHost() }, store: null, go: () => {},
    product: { address: PRODUCT, kind: "github", host: productHost(options), tokenStored: false } };
  const target = document.createElement("div");
  document.body.append(target);
  await route().render(target, context, { commit });
  return target;
}
const checklist = (shown) => byClass(shown, "checklist")[0];
const press = (shown, id, which) => byClass(itemOf(shown, id), which)[0].dispatchEvent(new Event("click"));
const added = (branch) => [...branch.keys()].filter((path) => path !== EARLIER_PATH);

// ================================================================== the tests

// TST-762001 · level: unit · module: MOD-test-pages
// guards: UC-028; A RELEASE RUNS EVERY TEST AT EVERY LEVEL
// given: the commit c carries the tag v1.1.0-rc.1; the product's tests hold the user-level tests TST-762901 and TST-762902 as sections of a Markdown file; the schedule's row user runs on akmaier
// input: the route runs rendered for the candidate's commit; and for the commit of the tag v1.0.0, which carries no release candidate
// expect: the candidate's page has a checklist naming akmaier as assigned and holding TST-762901 and TST-762902 each with its expected result ("the report lists every requirement with its evidence", "the tag of the release appears"); the plain commit's page has no checklist
test("checklist — a release candidate's page lists its user-level tests with their expected results and the person assigned; another commit has none", async () => {
  const shown = await page({ schedule: SCHEDULE });
  assert.ok(checklist(shown), "a checklist");
  assert.match(textOf(byClass(checklist(shown), "assigned")[0]), /akmaier/);
  assert.match(textOf(byClass(itemOf(shown, "TST-762901"), "expected")[0]), /the report lists every requirement with its evidence/);
  assert.match(textOf(byClass(itemOf(shown, "TST-762902"), "expected")[0]), /the tag of the release appears/);
  assert.ok(!checklist(await page({ schedule: SCHEDULE }, PLAIN)), "no checklist on a commit without a release candidate");
});

// TST-762002 · level: unit · module: MOD-test-pages
// guards: UC-028
// given: a product with no schedule file, so the book's default, whose row user names no one
// input: the route runs rendered for the candidate's commit
// expect: the checklist is shown and says that no one is assigned; it names no person
test("checklist — where the schedule names no one the checklist says no one is assigned and invents nobody", async () => {
  const shown = await page();
  assert.match(textOf(byClass(checklist(shown), "assigned")[0]), /no one assigned/i);
  assert.doesNotMatch(textOf(byClass(checklist(shown), "assigned")[0]), /akmaier/);
});

// TST-762003 · level: unit · module: MOD-test-pages
// guards: EVERY TEST RUN LEAVES A RESULT RECORD; A RESULT RECORD IS NEVER REWRITTEN; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the branch test-results holds one earlier record of the commit, in which TST-762901 passed
// input: akmaier enters her name and presses Passed for TST-762902
// expect: exactly one commit adds exactly one file, at runs/<commit>/<yyyymmdd>-<hhmm>-release-candidate-<4 hex>.md, which reads with the result schema as occasion release-candidate, level user, participant akmaier, one row TST-762902 user passed; the earlier record's text is unchanged
test("checklist — one entered outcome adds one record at a new path and leaves the earlier record unchanged", async () => {
  const branch = new Map([[EARLIER_PATH, EARLIER_TEXT]]), writes = [];
  const shown = await page({ schedule: SCHEDULE, branch, writes });
  type(byClass(checklist(shown), "person")[0], "akmaier");
  press(shown, "TST-762902", "passed");
  await until(() => added(branch).length === 1, "the record is added");
  assert.equal(writes.length, 1);
  assert.equal(branch.get(EARLIER_PATH), EARLIER_TEXT);
  const [path] = added(branch);
  assert.match(path, new RegExp(`^runs/${CANDIDATE}/\\d{8}-\\d{4}-release-candidate-[0-9a-f]{4}\\.md$`));
  const record = readDocument(resultSchema.run, path, branch.get(path));
  assert.deepEqual([record.fields.occasion, record.fields.levels, record.fields.participant, record.fields.commit], ["release-candidate", ["user"], "akmaier", CANDIDATE]);
  const rows = record.sections.find((section) => section.heading === "## Outcomes").rows.map((row) => row.cells);
  assert.deepEqual(rows.map((cells) => [cells.Test, cells.Level, cells.Outcome]), [["TST-762902", "user", "passed"]]);
});

// TST-762004 · level: unit · module: MOD-test-pages
// guards: UC-028; EVERY TEST RUN LEAVES A RESULT RECORD
// given: the earlier record in which TST-762901 passed, and no record for TST-762902
// input: the route rendered; then akmaier enters her name and presses Passed for TST-762902
// expect: first the checklist names TST-762902 as still missing and not TST-762901; after the outcome is entered it names nothing as missing, and the two tests read passed
test("checklist — it names what is still missing, and nothing once every outcome is entered", async () => {
  const shown = await page({ schedule: SCHEDULE });
  const missing = () => textOf(byClass(checklist(shown), "missing")[0]);
  assert.match(missing(), /TST-762902/);
  assert.doesNotMatch(missing(), /TST-762901/);
  type(byClass(checklist(shown), "person")[0], "akmaier");
  press(shown, "TST-762902", "passed");
  await until(() => !/TST-762902/.test(missing()), "TST-762902 is no longer missing");
  assert.doesNotMatch(missing(), /TST-76290/);
  assert.equal(byClass(itemOf(shown, "TST-762902"), "outcome")[0].textContent, "passed");
});

// TST-762005 · level: unit · module: MOD-test-pages
// guards: EVERY TEST RUN LEAVES A RESULT RECORD
// given: no record for TST-762902
// input: akmaier enters her name and presses Failed for TST-762902 after typing what she saw, "the page stayed empty"
// expect: the record's row reads TST-762902 user failed, and its Failures row holds the expected result of the declaration and "the page stayed empty"
test("checklist — a failed outcome is recorded with the expected result and what the person observed", async () => {
  const branch = new Map([[EARLIER_PATH, EARLIER_TEXT]]);
  const shown = await page({ schedule: SCHEDULE, branch });
  type(byClass(checklist(shown), "person")[0], "akmaier");
  type(byClass(itemOf(shown, "TST-762902"), "seen")[0], "the page stayed empty");
  press(shown, "TST-762902", "failed");
  await until(() => added(branch).length === 1, "the record is added");
  const record = readDocument(resultSchema.run, added(branch)[0], branch.get(added(branch)[0]));
  const cells = (heading) => record.sections.find((section) => section.heading === heading).rows.map((row) => row.cells);
  assert.deepEqual(cells("## Outcomes").map((row) => [row.Test, row.Outcome]), [["TST-762902", "failed"]]);
  assert.deepEqual(cells("## Failures").map((row) => [row.Test, row.Expected, row.Observed]), [["TST-762902", "the tag of the release appears", "the page stayed empty"]]);
});

// TST-762006 · level: unit · module: MOD-test-pages
// guards: A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the branch test-results with its earlier record
// input: Passed pressed for TST-762902 with the name field empty
// expect: nothing is written (no commit, no new file) and the page asks for the name
test("checklist — without a name nothing is appended", async () => {
  const branch = new Map([[EARLIER_PATH, EARLIER_TEXT]]), writes = [];
  const shown = await page({ schedule: SCHEDULE, branch, writes });
  press(shown, "TST-762902", "passed");
  await until(() => /name/i.test(textOf(byClass(checklist(shown), "result")[0])), "the page asks for the name");
  assert.equal(writes.length, 0);
  assert.deepEqual([...branch.keys()], [EARLIER_PATH]);
});
