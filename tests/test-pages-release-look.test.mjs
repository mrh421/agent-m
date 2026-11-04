// The release page wears the site's one look (ITM-1449): each button the route `release` of MOD-test-pages draws carries the frame's class btn, in each state the page has — the form
// of a new release, a candidate whose run has not ended, and a candidate whose run has ended with its report.
// Run: node --test tests/test-pages-release-look.test.mjs
//
// Module: MOD-test-pages
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// Level: unit
//
// The expected results are written here from the item's Acceptance ("every button of the release page carries btn") and from the class look.css styles for a button (".btn, ..."), and none is
// read from the code. Readings taken where the texts leave one open:
//   - A button is an element <button>; the frame's class for it is btn. A link is not checked: the route draws no link as a button.
//   - The probe's hits of ITM-1444 (release.mjs: Accept and release, Check results, Start release candidate) are confirmed by drawing the route: look.css has the one rule ".accept"
//     (border colour only), which does not give the button the frame's look, so no hit is one "a scoped rule already styles".
//   - The other routes of MOD-test-pages (schedule, runs, generate, tests-views) are not drawn again here: tests/test-pages-schedule.test.mjs, tests/test-pages-runs.test.mjs and
//     tests/test-pages-generate.test.mjs already check that each of their buttons carries btn (tests/test-pages-look.mjs, assertButtons), and ITM-1444's probe found no button there.
//   - The page's heading (an h2 outside section.head) is not a button and is not checked: the item names the buttons.
// The check is shown on the known positive (a button with btn) and the known negative (a bare button); the counter-proofs are in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { until } from "./prompt-bar.d/until.mjs";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const { route } = await import("../src/test-pages/release.mjs");

const COMMIT = "a".repeat(40);
const VERSION = "2026.10.8";
const TAG = `v${VERSION}-rc.1`;
const JOB = "docs/jobs/JOB-20261009-0148-2890.md";

const classes = (node) => (node.className ?? "").split(" ").filter(Boolean);
const text = (node) => node.textContent.replace(/\s+/g, " ").trim().slice(0, 40);
function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => classes(node).includes(name));

// The findings of one drawn route: each button that is not the frame's, named by its text.
function buttonFindings(target) {
  return descendants(target, (node) => node.localName === "button" && !classes(node).includes("btn")).map((node) => `button "${text(node)}" has no class btn`);
}
const buttonTexts = (target) => descendants(target, (node) => node.localName === "button").map(text);

// ---------------------------------------------------------------- a product in memory: no request leaves the process.
const SPEC = ["# Fixture product", "", "**A SAMPLE REQUIREMENT** *(Product Owner)*", "A sample rule.", "*Check:* `tests/pending.test.mjs`", ""].join("\n");
const DECLARATION = ["// TST-100", "// level: unit", "// guards: A SAMPLE REQUIREMENT", ""].join("\n");
const jobRecord = () => ["---", "id: JOB-20261009-0148-2890", "kind: run-tests", "works_on:", `  - ${COMMIT}`, "route: ci hosted", "started_by: akmaier",
  "start: 2026-10-09 01:48 UTC", "agent_m: unreleased, commit unknown", "limit: 1", "---", "## Destinations", "", "## Parameters", "", "```json",
  JSON.stringify({ candidate: { version: VERSION, tag: TAG, commit: COMMIT }, changelog: "Recorded release entry." }), "```", "",
  "## End", "", "at: 2026-10-09 02:00 UTC", "state: done", ""].join("\n");
const resultRecord = () => ["---", `commit: ${COMMIT}`, "levels:", "  - unit", "occasion: release-candidate", "participant: ci", "date: 2026-10-09 02:00 UTC", "---",
  "## Outcomes", "", "| Test | Level | Outcome | Runs |", "|---|---|---|---|", "| TST-100 | unit | passed | |", ""].join("\n");

function host({ pending, complete }) {
  const branch = pending ? { [JOB]: jobRecord(), "SPEC.md": SPEC, "tests/pending.test.mjs": DECLARATION } : {};
  const results = complete ? { [`runs/${COMMIT}/20261009-0200-release-candidate.md`]: resultRecord() } : {};
  const readOn = storedGraphReadOn({ commit: COMMIT, paths: Object.keys(branch), read: async (path) => branch[path] ?? null });
  const snapshot = (files, ref) => ({ repository: { path: "org/product" }, ref, commit: COMMIT, paths: Object.keys(files), read: async (path) => files[path] ?? null, blob: () => "b".repeat(40), readOn });
  return {
    async repositoryInfo() { return { defaultBranch: "main" }; },
    async listTags() { return pending ? [{ name: TAG, commit: COMMIT }] : []; },
    async readSnapshot(ref) { return snapshot(ref === "test-results" ? results : branch, ref); },
  };
}
async function draw(state) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { host: host(state) } }, {});
  return target;
}

// TST-1449001 · level: unit · module: MOD-test-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: a button drawn with the frame's class btn, and a bare button
// input: the check of buttons applied to each
// expect: known positive — the button with btn is no finding; known negative — the bare button is one finding, named by its text
test("TST-1449001: a button in the look passes the check, and a bare button is a finding", () => {
  const inLook = document.createElement("div");
  const good = document.createElement("button");
  good.className = "btn accept";
  good.append("Accept and release");
  inLook.append(good);
  assert.deepEqual(buttonFindings(inLook), []);
  const bare = document.createElement("div");
  const bad = document.createElement("button");
  bad.className = "accept";
  bad.append("Accept and release");
  bare.append(bad);
  assert.deepEqual(buttonFindings(bare), ['button "Accept and release" has no class btn']);
});

// TST-1449002 · level: unit · module: MOD-test-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: a product with no candidate waiting for acceptance, so the release page shows its form of a new release
// input: the route release drawn
// expect: the page draws one button, Start release candidate, and it carries the class btn
test("TST-1449002: the button of the new-release form carries the frame's class btn", async () => {
  const target = await draw({ pending: false, complete: false });
  assert.deepEqual(buttonTexts(target), ["Start release candidate"], "known positive: the form's one button is drawn");
  assert.deepEqual(buttonFindings(target), []);
});

// TST-1449003 · level: unit · module: MOD-test-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: a candidate recorded as started whose run has not recorded its outcomes
// input: the route release drawn
// expect: the page draws one button, Check results, and it carries the class btn
test("TST-1449003: the Check results button of a candidate carries the frame's class btn", async () => {
  const target = await draw({ pending: true, complete: false });
  assert.deepEqual(buttonTexts(target), ["Check results"], "known positive: the candidate's one button is drawn");
  assert.deepEqual(buttonFindings(target), []);
});

// TST-1449004 · level: unit · module: MOD-test-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: a candidate whose run has recorded its outcomes at every level, so its report is complete
// input: the route release drawn, then Check results pressed
// expect: the page draws Check results and Accept and release, before and after the press, and each carries the class btn
test("TST-1449004: Accept and release and Check results carry the frame's class btn once the report is complete", async () => {
  const target = await draw({ pending: true, complete: true });
  assert.deepEqual(buttonTexts(target), ["Check results", "Accept and release"], "known positive: both buttons are drawn");
  assert.deepEqual(buttonFindings(target), []);
  byClass(target, "refresh")[0].dispatchEvent(new Event("click"));
  await until(() => byClass(target, "accept").length > 0 && /TST-100/.test(target.textContent), "the report drawn again with Accept and release");
  assert.deepEqual(buttonFindings(target), []);
});
