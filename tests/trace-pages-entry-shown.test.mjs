// MOD-trace-pages' route `trace` gives the entry of the page it shows (ITM-1228), as MOD-trace-pages.md states it: "its route's `entry` is `requirements`,
// the entry it is listed under, and its `entryShown` the `entry` of the descriptor its `key` names, or `null`, the route's `entry`, where `key` names no
// descriptor, so that the tests browser and the audit are shown under Tests and the modules view under Architecture".
//
// Run: node --test tests/trace-pages-entry-shown.test.mjs
//
// Module: MOD-trace-pages
// Guards: THE MENU FOLLOWS THE PROCESS; UC-029; UC-030
// Level: unit
//
// The route is called through its public Route: `entry` and `entryShown(params)`, as the frame reads them. Every expected entry is stated in the case; none
// is read from a document. The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

// TST-1228005 · level: unit · module: MOD-trace-pages
// guards: THE MENU FOLLOWS THE PROCESS; UC-029; UC-030
// given: the route `trace` of MOD-trace-pages' view
// input: entryShown with the key specification, gaps, modules, tests and audit, each with a ref, the audit also with a commit
// expect: the route's entry stays "requirements"; entryShown gives requirements, requirements, architecture, tests, tests
// Planted fault: a route without entryShown leaves the tests browser and the audit under Requirements; one that maps modules to requirements fails on modules.
test("TST-1228005 the trace route's entryShown gives the entry of the descriptor its key names", () => {
  assert.equal(route.entry, "requirements");
  assert.equal(typeof route.entryShown, "function", "the route gives entryShown");
  assert.equal(route.entryShown({ key: "specification", ref: "main" }), "requirements");
  assert.equal(route.entryShown({ key: "gaps", ref: "main" }), "requirements");
  assert.equal(route.entryShown({ key: "modules", ref: "main" }), "architecture");
  assert.equal(route.entryShown({ key: "tests", ref: "main" }), "tests");
  assert.equal(route.entryShown({ key: "audit", ref: "v2026.1.0", commit: "a".repeat(40) }), "tests");
});

// TST-1228006 · level: unit · module: MOD-trace-pages
// guards: THE MENU FOLLOWS THE PROCESS
// given: the route `trace` of MOD-trace-pages' view
// input: entryShown with the key nothing-like-this, with no key, and with the empty key
// expect: null each time — the route's entry, Requirements, is the entry of those pages
// Planted fault: an entryShown that gives "requirements" or undefined for a key that names no descriptor fails.
test("TST-1228006 the trace route's entryShown gives null for a key that names no descriptor", () => {
  assert.equal(typeof route.entryShown, "function", "the route gives entryShown");
  assert.equal(route.entryShown({ key: "nothing-like-this" }), null);
  assert.equal(route.entryShown({}), null);
  assert.equal(route.entryShown({ key: "" }), null);
});
