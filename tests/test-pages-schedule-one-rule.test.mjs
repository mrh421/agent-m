// ITM-1307 — the schedule counts its tests by one rule. MOD-test-pages' route `schedule`, where the repository stores no view, shows the counts MOD-progress-measures'
// `scheduleView` gives for the declarations the route reads, as the accepted texts state them: docs/architecture/MOD-test-pages.md, "each row with the number of the product's
// tests it holds — the declarations of its level, and for the row of paid services those that call one —, … or counted from the test files where the repository stores none",
// and docs/architecture/MOD-progress-measures.md, "`scheduleView(facts: Facts) -> ScheduleView` — the counts of `facts.tests`". The rule is defined once (DON'T REPEAT YOURSELF).
// Run: node --test tests/test-pages-schedule-one-rule.test.mjs
//
// Module: MOD-test-pages
// Guards: DON'T REPEAT YOURSELF; UC-027
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, as tests/test-pages-schedule.test.mjs uses it. The product and the instance are hosts of this file, kept to
// MOD-repository-hosts' interface (repositoryInfo, readSnapshot, webLinks); the product's snapshot has no readOn, so no view is stored (MOD-progress-measures' storedView gives
// null without readOn). Where the texts leave a reading open, the test states the one it takes, and the pull request names it:
//   - "The same declarations" are those testDeclarations reads from the product's test files; scheduleView is given them as the `tests` of Facts whose `snapshot` is the
//     product's, the two fields it reads.
//   - The count shown is the cell <td class="tests"> of the row.
// The counter-proof is the route's own counting as it stands, which counts the declaration of the level `paid` under the row paid; it is recorded in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { view } = await import("../src/test-pages/index.mjs");
const { scheduleView } = await import("../src/progress-measures/index.mjs");
const { testDeclarations } = await import("../src/test-document/index.mjs");

const route = view.routes.find((candidate) => candidate.name === "schedule");
const PRODUCT = "https://github.com/org/product";
const COMMIT = "c".repeat(40);
const ROWS = ["unit", "component", "system", "paid", "release", "user"];
const REGISTER = "# Participants of this instance\n\n**REGISTER**\n\nThe participants.\n\n| Name | Type | Model | Context | Price | Capabilities | Processing place | Route |\n|---|---|---|---|---|---|---|---|\n";

// A test file's text: one declaration for each entry [level, paid]; the lines are built by join, so that no line of this file is a declaration.
const declarations = (entries, from) => entries.map(([level, paid], at) => ["// TST-" + String(from + at).padStart(3, "0") + " · level: " + level + " · module: MOD-sample",
  "// guards: A SAMPLE REQUIREMENT", "// given: g", "// input: i", "// expect: e", ...(paid ? ["// paid: " + paid] : []), "test(\"t\", () => {});", ""].join("\n")).join("\n");
// Two unit tests, one of them calling the paid service oracle, one component test, and one declaration whose level is written `paid`.
const FILES = { "tests/a.test.mjs": declarations([["unit"], ["unit", "oracle"], ["component"], ["paid"]], 1) };

function productHost(files) {
  return {
    repositoryInfo: async () => ({ defaultBranch: "main", visibility: "public", canWrite: true }),
    readSnapshot: async () => ({ commit: COMMIT, paths: Object.keys(files), blob: () => "b".repeat(40), read: async (path) => files[path] ?? null }),
    webLinks: () => ({ secrets: `${PRODUCT}/settings/secrets/actions`, actions: `${PRODUCT}/actions`, runners: `${PRODUCT}/settings/actions/runners/new` }),
    listCiRuns: async () => [],
  };
}
const instanceHost = () => ({
  repositoryInfo: async () => ({ defaultBranch: "main", visibility: "public", canWrite: true }),
  readSnapshot: async () => ({ commit: "i".repeat(40), paths: ["docs/participants.md"], blob: () => "b".repeat(40), read: async (path) => (path === "docs/participants.md" ? REGISTER : null) }),
});

const walk = (root, match) => { const found = []; (function visit(node) { for (const kid of node.childNodes ?? []) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); visit(kid); } } })(root); return found; };
const countsOf = (target) => Object.fromEntries(ROWS.map((row) => [row, Number(walk(walk(target, (node) => node.localName === "tr" && node.getAttribute("data-row") === row)[0],
  (node) => node.localName === "td" && (node.className ?? "").split(" ").includes("tests"))[0].textContent)]));

// TST-1307001 · level: unit · module: MOD-test-pages
// guards: DON'T REPEAT YOURSELF; UC-027
// given: a product whose repository stores no view, and whose test file holds two unit tests (one calling the paid service oracle), one component test and one declaration of the level paid that calls no paid service
// input: the route schedule rendered for the product; and scheduleView of Facts whose snapshot is the product's and whose tests are the declarations of its test file
// expect: known positive: the file is read as four declarations, one of the level paid; the rows unit, component, system, paid, release and user show 2, 1, 0, 1, 0 and 0, which are the counts scheduleView gives for the same declarations; the declaration of the level paid counts under no row
test("TST-1307001 — schedule: where no view is stored, the counts are scheduleView's for the declarations the route reads", async () => {
  const read = testDeclarations("tests/a.test.mjs", FILES["tests/a.test.mjs"]);
  assert.equal(read.length, 4, "known positive: the four declarations are read");
  assert.deepEqual(read.map((declaration) => declaration.level), ["unit", "unit", "component", "paid"], "known positive: one declaration is of the level paid");
  const expected = { unit: 2, component: 1, system: 0, paid: 1, release: 0, user: 0 };
  assert.deepEqual(scheduleView({ snapshot: { commit: COMMIT }, tests: read }).counts, { unit: 2, component: 1, system: 0, release: 0, user: 0, paid: 1 },
    "scheduleView counts the declaration of the level paid under no row");
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { page: "main", instance: { repository: "alice/agent-m", host: instanceHost() }, store: null, go() {},
    product: { address: PRODUCT, kind: "github", host: productHost(FILES), tokenStored: true } }, {});
  assert.deepEqual(countsOf(target), expected, "the route's counts are scheduleView's");
  assert.doesNotMatch(target.textContent, /As of/);
});
