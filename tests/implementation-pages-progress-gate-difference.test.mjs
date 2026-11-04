// ITM-1343 — MOD-implementation-pages' route `progress` draws the gates as MOD-progress-measures' gateOverview gives them: "a gate whose record names a text that has changed since, as passed on an earlier text, with the difference" (docs/architecture/MOD-progress-measures.md) and "the gates passed, pending and not reached" (docs/architecture/MOD-implementation-pages.md).
// Run: node --test tests/implementation-pages-progress-gate-difference.test.mjs
//
// Module: MOD-implementation-pages
// Guards: STATUS IS DERIVED FROM THE RECORDS
// Level: unit
//
// The view is the one stored for the head, with its gates replaced by the three states the cell can take. Reading taken: the Needs cell holds the gate's needs, then its difference, joined by "; ".

import test from "node:test";
import assert from "node:assert/strict";
import { gunzipSync, gzipSync } from "node:zlib";
import { COMMIT, DECLARATION_AT_HEAD, productFiles, renderOverGitHub, storedViewBytes } from "./implementation-pages-sprints.mjs";

const files = () => productFiles({ "docs/process.md": DECLARATION_AT_HEAD });
const gate = (name, state, needs, difference) => ({ gate: name, state, decided: { by: "alice", date: "2026-10-20", on: "abc", record: "docs/gates/x.md" }, needs, difference, addedBy: null });

// TST-1343001 · level: unit · module: MOD-implementation-pages
// guards: STATUS IS DERIVED FROM THE RECORDS
// given: a stored view whose gates are A (passed on an earlier text, needs "a decision on the current text", difference "ITM-002.md: checked 111, now 222"), B (passed on an earlier text, no needs, difference "ITM-003.md: checked 333, now 444") and C (pending, needs "a decision", no difference)
// input: the route progress's render
// expect: A's Needs cell reads "a decision on the current text; ITM-002.md: checked 111, now 222"; B's reads "ITM-003.md: checked 333, now 444"; C's reads "a decision" only
test("#progress — the Needs cell of a gate passed on an earlier text shows its needs and then its difference", async () => {
  const view = JSON.parse(gunzipSync(await storedViewBytes("progress", files())).toString());
  view.gates = [gate("A", "passed on an earlier text", "a decision on the current text", "ITM-002.md: checked 111, now 222"),
    gate("B", "passed on an earlier text", null, "ITM-003.md: checked 333, now 444"), { ...gate("C", "pending", "a decision", null), decided: null }];
  const page = await renderOverGitHub("progress", {}, { files: files(), overview: { [`${COMMIT}.progress.json.gz`]: new Uint8Array(gzipSync(JSON.stringify(view))) } });
  try {
    const html = page.html();
    const needs = (name) => { const at = html.indexOf(`<td data-label="Gate">${name}`); const row = html.slice(at, html.indexOf("</tr>", at)); return row.match(/data-label="Needs">([^<]*)</)?.[1]; };
    assert.equal(needs("C"), "a decision", "known positive: the gate is found and shows its needs");
    assert.equal(needs("B"), "ITM-003.md: checked 333, now 444");
    assert.equal(needs("A"), "a decision on the current text; ITM-002.md: checked 111, now 222");
  } finally { page.done(); }
});
