// Release test of ITM-1338 — a passed gate links its gate record. Written from THE GATE IS RECORDED (every passed gate records who decided, when, and on which text) and UC-035 step 3 ("passed: who decided, when, and on which text, linked to the gate record"; pending and not reached carry no decision).
// Run: node --test tests/release-itm-1338-gate-record-link.test.mjs
//
// Module: MOD-implementation-pages
// Guards: THE GATE IS RECORDED; UC-035
// Level: release
//
// Written for the release testing of sprint team1/139 by a participant who implemented none of it (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The page is reached as the dashboard does: the route `progress` of MOD-implementation-pages drawn into a DOM over a product held in memory (tests/implementation-pages-sprints.mjs).

import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { found, productFiles, render } from "./implementation-pages-sprints.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const plain = (html) => String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const blobOf = (text) => createHash("sha1").update(text).digest("hex");
const GATE_PATH = "docs/gates/20261022-0900-building-checking-ab12.md";
const ITEM_2 = "docs/backlog/ITM-002-item-2.md";
const gateRecord = (on) => lines("---", "gate: Building → Checking", "job:", "decider: alice", "role: Owner", "decision: passed", "on:", ...on.map((entry) => `  - ${entry}`), "date: 2026-10-22 09:00 UTC", "---", "# Building → Checking", "", "**REGISTER**");
const gateRows = (page) => found(found(page.target, "[data-part]").find((each) => each.getAttribute("data-part") === "gates"), "[data-label]").filter((each) => each.getAttribute("data-label") === "Gate").map((each) => each.parentNode);
const cellOf = (row, label) => found(row, "[data-label]").find((each) => each.getAttribute("data-label") === label);

// TST-1338101 · level: release · module: MOD-implementation-pages
// guards: THE GATE IS RECORDED; UC-035
// given: the Scrum product whose record  passes Building → Checking on ITM-002's file at its current blob; the same product with ITM-002's file changed since
// input: the reader opens Progress of each
// expect: in the first page the row of Building → Checking, passed, holds exactly one link and its address ends with docs/gates/20261022-0900-building-checking-ab12.md; the row of Checking → Closing, pending, holds no link at all; in the second page the row of Checking → Closing, not reached, holds no link
// Planted fault: the link left out of the Decided cell of gatesPanel in src/implementation-pages/progress.mjs fails the case on "the passed gate links its record".
test("TST-1338101 a passed gate links its gate record and a pending or unreached gate links none", async () => {
  const files = productFiles();
  files[GATE_PATH] = gateRecord([`${ITEM_2}@${blobOf(files[ITEM_2])}`]);
  const current = await render("progress", {}, { files });
  const changed = await render("progress", {}, { files: { ...files, [ITEM_2]: files[ITEM_2].replace("What item 2 delivers.", "What item 2 delivers now.") } });
  try {
    const [passed, pending] = gateRows(current), [, unreached] = gateRows(changed);
    assert.match(plain(passed.innerHTML), /^Building → Checking passed alice/, "known positive: the gate is passed");
    assert.match(plain(pending.innerHTML), /^Checking → Closing pending/);
    assert.match(plain(unreached.innerHTML), /^Checking → Closing not reached/);
    const links = found(passed, "[href]").map((each) => each.getAttribute("href"));
    assert.equal(links.length, 1, "the passed gate links its record");
    assert.ok(links[0].endsWith(GATE_PATH), `the link leads to the record: ${links[0]}`);
    assert.equal(found(pending, "[href]").length, 0, "a pending gate has no link");
    assert.equal(found(unreached, "[href]").length, 0, "a gate not reached has no link");
  } finally { current.done(); changed.done(); }
});
