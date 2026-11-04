// The trace pages' buttons wear the site's one look (ITM-1448): every button that the audit of a release, its export and the opened test of the tests view draw carries the frame's
// class btn (look.css: ".btn, ...").
// Run: node --test tests/trace-pages-look.test.mjs
//
// Module: MOD-trace-pages
// Guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; THE SITE WEARS THE PATTERN RECOGNITION LAB'S LOOK
// Level: unit
//
// The expected results are written here from the item's Acceptance ("Every button of the audit, export and test-detail pages carries `btn`") and from the class look.css styles, and
// none is read from the code. Readings taken where the texts leave one open:
//   - A button is an element <button>; the frame's class for it is btn. A button out of the look is named by its first class and its text.
//   - "The audit, export and test-detail pages" are drawn as the frame draws them, through the route `trace`: the audit at a release tag for a person who may write, so that Export and
//     Commit export (export.mjs) stand beside the summary's numbers (audit.mjs); and a test opened in the tests view whose history goes on beyond the newest ten runs, so that
//     *Earlier runs* (test-detail.mjs) is offered.
//   - The known positive is the specification view of the same product as the opened test, whose requirement is a button already in the look (btn small).
// The counter-proofs are in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { document, find, productHost, render } from "./uc-030-harness.mjs";
import { treeHost, until } from "./trace-pages-harness.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const classes = (node) => String(node.className ?? "").split(" ").filter(Boolean);
const buttons = (root) => find(root, (node) => node.localName === "button");
const findings = (root) => buttons(root).filter((node) => !classes(node).includes("btn")).map((node) => `${classes(node)[0] ?? "button"} "${node.textContent.trim()}" has no class btn`);
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

// One product whose default branch holds one requirement and the test TST-801 that guards it, and whose branch test-results holds one record of each of twelve runs, newest first.
const SPEC = ["# Look fixture — Specification", "", "## Only section", "", "**ALPHA RULE** *(Vibe Coding)*", "Alpha rule.", "*Check:* at review.", ""].join("\n");
const ALPHA = ["// TST-801 · level: unit · module: system", "// guards: ALPHA RULE", "// given: a fixture", "// input: a call", "// expect: a result", ""].join("\n");
const commitOf = (n) => n.toString(16).padStart(2, "0").repeat(20);
const record = (commit) => ["---", `commit: ${commit}`, "levels:", "  - unit", "occasion: commit", "participant: ci", "date: 2026-10-07 10:00 UTC", "---",
  "## Outcomes", "", "| Test | Level | Outcome | Runs |", "|---|---|---|---|", "| TST-801 | unit | passed | |", ""].join("\n");
const RUNS = Array.from({ length: 12 }, (_, at) => 12 - at);
function testsHost() {
  const base = treeHost({ trees: { main: { "SPEC.md": SPEC, "tests/alpha.test.mjs": ALPHA }, "test-results": Object.fromEntries(RUNS.map((n) => [`runs/${commitOf(n)}/a.md`, record(commitOf(n))])) },
    onDefault: RUNS.map(commitOf) });
  return { ...base, async listTags() { return []; }, webLinks: () => ({ file: (path, ref) => `https://example.test/blob/${ref}/${path}`, run: (id) => `https://example.test/actions/runs/${id}` }) };
}
async function drawTrace(params) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: "https://github.com/acme/product", host: testsHost() } }, params);
  await until(() => buttons(target).length > 0);
  await settle();
  return target;
}

// TST-1448001 · level: unit · module: MOD-trace-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the product of testsHost, whose specification view draws its one requirement ALPHA RULE as a button in the frame's look
// input: the route trace drawn with key specification at main; the check applied to it, and to a planted <button> without a class
// expect: known positive — the page draws at least one button and the check finds nothing on it; the planted bare button is one finding, `button "Planted" has no class btn`
test("TST-1448001: a trace page already in the look passes the check, and a bare button is a finding", async () => {
  const target = await drawTrace({ key: "specification", ref: "main" });
  assert.ok(buttons(target).length > 0, "the specification view draws a button");
  assert.deepEqual(findings(target), []);
  const bare = document.createElement("div");
  const planted = document.createElement("button");
  planted.textContent = "Planted";
  bare.append(planted);
  assert.deepEqual(findings(bare), ['button "Planted" has no class btn']);
});

// TST-1448002 · level: unit · module: MOD-trace-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the product of tests/uc-030-harness.mjs at the release tag v2026.4.0, for a person who may write
// input: the route trace drawn with key audit at v2026.4.0
// expect: the page draws the summary's six numbers (audit-count), Export (audit-export) and Commit export (audit-commit-export) as buttons, eight in all, and every one of them carries the class btn: no finding
test("TST-1448002: every button of the audit and its export carries the frame's class btn", async () => {
  const target = await render(productHost({ canWrite: true }));
  await settle();
  assert.deepEqual(buttons(target).map((node) => classes(node)[0]).sort(),
    ["audit-commit-export", "audit-count", "audit-count", "audit-count", "audit-count", "audit-count", "audit-count", "audit-export"]);
  assert.deepEqual(findings(target), []);
});

// TST-1448003 · level: unit · module: MOD-trace-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE
// given: the product of testsHost, whose branch test-results holds twelve runs of TST-801, more than the ten an opened test shows
// input: the route trace drawn with key tests at main and row TST-801
// expect: the opened test offers Earlier runs (test-history-earlier) as a button, and every button of the page carries the class btn: no finding
test("TST-1448003: every button of an opened test carries the frame's class btn", async () => {
  const target = await drawTrace({ key: "tests", ref: "main", row: "TST-801" });
  assert.ok(buttons(target).some((node) => classes(node)[0] === "test-history-earlier"), "the opened test offers Earlier runs");
  assert.deepEqual(findings(target), []);
});
