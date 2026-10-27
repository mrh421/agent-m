// ITM-1245: the closed-with note of a bug fix names no item.
// Module: MOD-mail-records
// Level: unit
// Guards: A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION; UC-012
// Run: node --test tests/mail-records-closed-with.test.mjs

import test from "node:test";
import assert from "node:assert/strict";
import * as records from "../src/mail-records/index.mjs";

// TST-1245101 · level: unit · module: MOD-mail-records
// guards: UC-012
// given: a fixed bug has a pull-request address and no item
// input: noteText("closed-with", null, "2026-10-27", "https://example.invalid/product/pull/1"); the same with subject ""
// expect: both "Closed with https://example.invalid/product/pull/1." without the item part
test("TST-1245101: closed-with without an item gives the text without the item part", () => {
  assert.equal(records.noteText("closed-with", null, "2026-10-27", "https://example.invalid/product/pull/1"),
    "Closed with https://example.invalid/product/pull/1.");
  assert.equal(records.noteText("closed-with", "", "2026-10-27", "https://example.invalid/product/pull/1"),
    "Closed with https://example.invalid/product/pull/1.");
});

// TST-1245102 · level: unit · module: MOD-mail-records
// guards: UC-012
// given: a closed item has a commit address
// input: noteText("closed-with", "ITM-123", "2026-10-27", "https://example.invalid/commit/abc")
// expect: "Closed with https://example.invalid/commit/abc; item `ITM-123`."
test("TST-1245102: closed-with with an item keeps the item part", () => {
  assert.equal(records.noteText("closed-with", "ITM-123", "2026-10-27", "https://example.invalid/commit/abc"),
    "Closed with https://example.invalid/commit/abc; item `ITM-123`.");
});

// TST-1245103 · level: unit · module: MOD-mail-records
// guards: A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION
// given: subjects that are neither an item identifier nor absent; item-added without an item
// input: noteText("closed-with", s, ...) for "not-an-identifier", "MAIL-1111111111111111", "ITM-1"; noteText("item-added", null, ...)
// expect: NotAnIdentifier for each
test("TST-1245103: a subject that is no item identifier is still refused", () => {
  for (const subject of ["not-an-identifier", "MAIL-1111111111111111", "ITM-1"]) {
    assert.throws(() => records.noteText("closed-with", subject, "2026-10-27", "https://example.invalid/x"), { name: "NotAnIdentifier" }, subject);
  }
  assert.throws(() => records.noteText("item-added", null, "2026-10-27", "https://example.invalid/x"), { name: "NotAnIdentifier" });
});
