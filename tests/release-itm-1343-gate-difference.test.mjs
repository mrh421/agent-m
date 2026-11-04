// Release test of ITM-1343 — a gate passed on an earlier text shows the difference. Written from STATUS IS DERIVED FROM THE RECORDS (an approval counts exactly when its record names the current blob) and UC-035 3a ("a gate record names a text that has changed since: the gate is shown as passed on an earlier text, with the difference. It does not count as passed for the current text").
// Run: node --test tests/release-itm-1343-gate-difference.test.mjs
//
// Module: MOD-implementation-pages
// Guards: STATUS IS DERIVED FROM THE RECORDS; UC-035
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

// TST-1343101 · level: release · module: MOD-implementation-pages
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-035
// given: the Scrum product whose record  passes Building → Checking on ITM-002's file at one blob, and ITM-002's file now at another; a second product in which the file still holds the recorded text
// input: the reader opens Progress of each
// expect: in the first page the row of Building → Checking is "passed on an earlier text" and names the difference: ITM-002's file, the blob checked and the blob now, each by its first 12 characters; the next gate is not reached; in the second page the row is passed and names no such difference
// Planted fault: the difference left out of the Needs cell of gatesPanel in src/implementation-pages/progress.mjs ([gate.needs, gate.difference] replaced by [gate.needs]) fails the case on "the difference is shown".
test("TST-1343101 a gate passed on an earlier text is shown with the difference between the recorded and the current text", async () => {
  const files = productFiles();
  files[GATE_PATH] = gateRecord([`${ITEM_2}@${blobOf(files[ITEM_2])}`]);
  const edited = files[ITEM_2].replace("What item 2 delivers.", "What item 2 delivers now.");
  const same = await render("progress", {}, { files });
  const changed = await render("progress", {}, { files: { ...files, [ITEM_2]: edited } });
  try {
    const [kept] = gateRows(same), [early, next] = gateRows(changed);
    assert.match(plain(kept.innerHTML), /^Building → Checking passed alice/, "known positive: on the current text it is passed");
    assert.doesNotMatch(plain(cellOf(kept, "Needs").innerHTML), /checked/, "no difference where the text is unchanged");
    assert.match(plain(early.innerHTML), /^Building → Checking passed on an earlier text/);
    const shown = plain(cellOf(early, "Needs").innerHTML);
    for (const part of [ITEM_2, blobOf(files[ITEM_2]).slice(0, 12), blobOf(edited).slice(0, 12)]) assert.ok(shown.includes(part), `the difference is shown: ${part} in "${shown}"`);
    assert.match(plain(next.innerHTML), /^Checking → Closing not reached/);
  } finally { same.done(); changed.done(); }
});
