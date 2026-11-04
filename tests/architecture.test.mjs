// Architecture on the review dashboard: the status of ARC and MOD files, and what they rest on — MOD-approvals' statusOf and
// acceptanceBlockers. Deterministic, no network. Run: node --test tests/*.test.mjs
//
// Module: MOD-approvals
// Guards: STATUS IS DERIVED FROM THE RECORDS; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; UC-022; UC-023
// Level: unit
//
// SPEC §11 ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; §10 STATUS IS DERIVED FROM THE RECORDS (UC-022 step 10a; UC-023 step 4b).
// The format of the files is checked in tests/architecture-format.test.mjs. Accepting and
// editing ARC and MOD files — the dashboard's writes — are checked in tests/approvals-accept.test.mjs and tests/artifact-edits-save.test.mjs.
//
// The product is the fixture under tests/fixtures/architecture/, held by tests/memory-host.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { statusOf, acceptanceBlockers } from "../src/approvals/index.mjs";
import { blobSha } from "../src/text-tools/index.mjs";
import { memoryHost } from "./memory-host.mjs";
import { recordText, approvalPath, reviewedRecord } from "./approval-records.mjs";

const FIX = fileURLToPath(new URL("./fixtures/architecture/", import.meta.url));
const files = {};
// The fixture keeps its test file as tests/reader.test.js.fixture, so that node --test tests/ does not run it; the walk builds it back under its name.
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p); else files[relative(FIX, p).split("\\").join("/").replace(/\.fixture$/, "")] = readFileSync(p, "utf8");
  }
})(FIX);
const ARC = "docs/architecture/ARC-001-static-client.md", READER = "docs/architecture/MOD-reader.md";
const REVIEW = "docs/architecture/MOD-review.md";
const UC1 = "docs/use-cases/UC-001-read-a-file.md", UC2 = "docs/use-cases/UC-002-show-the-status.md";

// The record of `path`, under the identifier `id`, naming `blob`: { its path: its text }.
const recordOf = (id, path, blob) => ({ [approvalPath(id, blob)]: recordText(reviewedRecord(path, blob)) });
// The product with `over` added, as the snapshot of its head.
const snapshotOf = (over = {}) => memoryHost({ ...files, ...over }).host.readSnapshot("main");
// Both use cases accepted in their current texts.
const useCasesAccepted = async () => ({ ...recordOf("UC-001", UC1, await blobSha(files[UC1])), ...recordOf("UC-002", UC2, await blobSha(files[UC2])) });

// ---------------------------------------------------------------- status

test("STATUS IS DERIVED FROM THE RECORDS — ARC and MOD: open, accepted, changed; only records of their own identifier count", async () => {
  const b = await blobSha(files[READER]);
  assert.equal(statusOf(READER, b, await snapshotOf()), "open");
  assert.equal(statusOf(READER, b, await snapshotOf(recordOf("MOD-reader", READER, b))), "accepted");
  assert.equal(statusOf(READER, b, await snapshotOf(recordOf("MOD-reader", READER, "e".repeat(40)))), "changed");
  // Counter-proof: a record of another identifier naming the same text does not accept it.
  assert.equal(statusOf(READER, b, await snapshotOf(recordOf("MOD-review", REVIEW, b))), "open");
  const a = await blobSha(files[ARC]);
  assert.equal(statusOf(ARC, a, await snapshotOf(recordOf("ARC-001", ARC, a))), "accepted", "a decision derives the same way");
});

// ---------------------------------------------------------------- ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS

test("ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS — every named requirement in the SPEC, every named use case accepted", async () => {
  const accepted = await useCasesAccepted();
  assert.deepEqual(await acceptanceBlockers(ARC, await snapshotOf(accepted)), [], "RULE ONE is in the SPEC and UC-001 accepted");
  // UC-022 10a / UC-023 4b: each open item is named.
  const blockers = async (text, over = accepted) => acceptanceBlockers(ARC, await snapshotOf({ ...over, [ARC]: text }));
  assert.deepEqual(await blockers(files[ARC].replace("  - RULE ONE\n", "  - NO SUCH RULE\n")), ["NO SUCH RULE"]);
  assert.deepEqual(await blockers(files[ARC].replace("  - UC-001\n", "  - UC-009\n")), ["UC-009"], "a use case the product does not hold");
  const changed = { ...recordOf("UC-001", UC1, "e".repeat(40)), ...recordOf("UC-002", UC2, await blobSha(files[UC2])) };
  assert.deepEqual(await blockers(files[ARC], changed), ["UC-001"], "a use case changed since it was accepted");
  assert.deepEqual(await blockers(files[ARC], {}), ["UC-001"], "a use case not accepted yet");
  // A module's `realises` counts the same; `follows` (decisions) is not a prerequisite of the rule.
  assert.deepEqual(await acceptanceBlockers(REVIEW, await snapshotOf(accepted)), []);
  assert.deepEqual(await acceptanceBlockers(REVIEW, await snapshotOf()), ["UC-002"], "counter-proof: UC-002 not accepted");
});
