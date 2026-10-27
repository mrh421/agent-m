// Queues — MOD-spec-changes' Queue and queues, as the accepted text of docs/architecture/MOD-spec-changes.md states
// them: every queue of a snapshot with its entries, read from each queue's index.md and entscheidungen.md and from
// the approval records under docs/approvals/ — matched to an entry by name alone, as MOD-approvals' statuses matches
// a reviewed file (no record's text is read). Each entry in the state open, approved or in SPEC. The states stale and
// waiting for its anchor are not part of this item: they need a SPEC section's text; such an entry reads as open.
// Nothing else of the module is part of this item (ITM-234, Outcome).
// Run: node --test tests/spec-changes-queues.test.mjs
//
// Module: MOD-spec-changes
// Guards: UC-047; UC-012; STATUS IS DERIVED FROM THE RECORDS; EVERY ARTIFACT NAMES ITS ORIGIN
// Level: unit
//
// Each test states its input and its expected result before it runs (given / input / expect). queues is given a
// snapshot already held in memory (paths, blob SHAs and a read of the files it has not read yet, as MOD-repository-
// hosts' Snapshot gives them); the fixtures below are plain objects of that shape — no readSnapshot, no fetch.
// Nothing sleeps or waits. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { queues } from "../src/spec-changes/index.mjs";

// A fixture snapshot (MOD-repository-hosts' Snapshot): paths, a blob SHA for each, and a read() of the texts given —
// null for every other path, as a snapshot answers for a path its commit does not hold.
function fixtureSnapshot(texts, blobs, extraPaths = []) {
  const paths = [...new Set([...Object.keys(texts), ...Object.keys(blobs), ...extraPaths])];
  return {
    paths,
    blob: (path) => blobs[path] ?? null,
    read: async (path) => (Object.hasOwn(texts, path) ? texts[path] : null),
  };
}

// One queue, 2026-02-01_sample, with three entries: 01 open (no record names it at all), 02 approved (a record names
// its proposal's current blob, and no decision row names the record yet) and 03 in SPEC (a decision row names its
// record). index.md's entry table stands after an impact-analysis table of its own — the entry table is found by its
// header, not by position (ITM-226).
function sampleQueueSnapshot() {
  const base = "docs/spec-freigaben/2026-02-01_sample";
  const texts = {
    [`${base}/index.md`]: [
      "# SPEC approvals — queue 2026-02-01 · sample queue",
      "",
      "**Impact analysis** (names this queue changes or withdraws, and who references them):",
      "",
      "| Name | Change | Referenced by |",
      "|---|---|---|",
      "| `A SAMPLE REQUIREMENT` | changed | `UC-900` |",
      "",
      "**Zieldatei aller Einträge:** `SPEC.md`",
      "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |",
      "|---|---|---|---|---|",
      "| 01 | `SPEC.md` | ## 1. Open section | — | — |",
      "| 02 | `SPEC.md` | ## 2. Approved section | — | — |",
      "| 03 | `SPEC.md` | ## 3. Accepted section | — | — |",
      "",
    ].join("\n"),
    [`${base}/entscheidungen.md`]: [
      "# Decisions — queue 2026-02-01 sample queue",
      "",
      "Append-only.",
      "| 2026-02-01 10:00 UTC | 3 | uebernommen | approval:spec-2026-02-01_sample-03-333333333333.md |",
      "",
    ].join("\n"),
  };
  const blobs = {
    [`${base}/01-open-section.md`]: "1".repeat(40),
    [`${base}/02-approved-section.md`]: "2".repeat(40),
    [`${base}/03-accepted-section.md`]: "3".repeat(40),
  };
  const records = [
    // 02's record names its proposal's current blob (2222…, twelve digits) — approved, no decision row.
    "docs/approvals/spec-2026-02-01_sample-02-222222222222.md",
    // 03's record, named by the decision row below — in SPEC.
    "docs/approvals/spec-2026-02-01_sample-03-333333333333.md",
  ];
  return fixtureSnapshot(texts, blobs, records);
}

// TST-473007 · level: unit · module: MOD-spec-changes
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-047
// given: the fixture snapshot above
// input: queues(sampleQueueSnapshot())
// expect: one queue, its title and target read from the text past the impact table, and its three entries in the index table's own order — 01 open with no record, 02 approved with its record and no decision, 03 in SPEC with the same path as both its record and its decision
test("queues — an open, an approved and an in-SPEC entry, found past an impact table", async () => {
  const result = await queues(sampleQueueSnapshot());
  assert.equal(result.length, 1, "exactly the one queue of the fixture");
  const [queue] = result;
  assert.equal(queue.folder, "docs/spec-freigaben/2026-02-01_sample");
  assert.equal(queue.title, "sample queue");
  assert.equal(queue.target, "SPEC.md");
  assert.equal(queue.entries.length, 3);

  const [open, approved, inSpec] = queue.entries;

  assert.equal(open.number, 1);
  assert.equal(open.file, "SPEC.md");
  assert.equal(open.anchor, "## 1. Open section");
  assert.equal(open.until, null);
  assert.equal(open.proposal.path, "docs/spec-freigaben/2026-02-01_sample/01-open-section.md");
  assert.equal(open.proposal.blob, "1".repeat(40));
  assert.equal(open.record, null);
  assert.equal(open.decision, null);
  assert.equal(open.state, "open");

  assert.equal(approved.number, 2);
  assert.equal(approved.proposal.path, "docs/spec-freigaben/2026-02-01_sample/02-approved-section.md");
  assert.equal(approved.proposal.blob, "2".repeat(40));
  assert.equal(approved.record, "docs/approvals/spec-2026-02-01_sample-02-222222222222.md");
  assert.equal(approved.decision, null);
  assert.equal(approved.state, "approved");

  assert.equal(inSpec.number, 3);
  assert.equal(inSpec.record, "docs/approvals/spec-2026-02-01_sample-03-333333333333.md");
  assert.equal(inSpec.decision, "docs/approvals/spec-2026-02-01_sample-03-333333333333.md");
  assert.equal(inSpec.state, "in SPEC");
});

// Two minimal queues, each with one open entry and no decision, their folders dated 2026-01-01 and 2026-01-02.
function orderingSnapshot() {
  function queueFiles(base, titleLine, anchorLabel, proposalBlob) {
    return {
      texts: {
        [`${base}/index.md`]: [
          `# SPEC approvals — queue ${titleLine}`,
          "",
          "**Zieldatei aller Einträge:** `SPEC.md`",
          "",
          "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |",
          "|---|---|---|---|---|",
          `| 01 | \`SPEC.md\` | ## 1. ${anchorLabel} | — | — |`,
          "",
        ].join("\n"),
        [`${base}/entscheidungen.md`]: ["# Decisions", "", "Append-only.", ""].join("\n"),
      },
      blobs: { [`${base}/01-${anchorLabel.toLowerCase()}.md`]: proposalBlob },
    };
  }
  const first = queueFiles("docs/spec-freigaben/2026-01-01_first", "2026-01-01 · first", "First", "4".repeat(40));
  const second = queueFiles("docs/spec-freigaben/2026-01-02_second", "2026-01-02 · second", "Second", "5".repeat(40));
  return fixtureSnapshot({ ...first.texts, ...second.texts }, { ...first.blobs, ...second.blobs });
}

// TST-473008 · level: unit · module: MOD-spec-changes
// guards: UC-047
// given: two queues of different dates, each with one open entry
// input: queues(orderingSnapshot())
// expect: the newer queue's folder (2026-01-02) first, the older (2026-01-01) second
test("queues — more than one queue, newest first", async () => {
  const result = await queues(orderingSnapshot());
  assert.deepEqual(result.map((q) => q.folder), [
    "docs/spec-freigaben/2026-01-02_second",
    "docs/spec-freigaben/2026-01-01_first",
  ]);
});

// The sample queue's index with the line of an issue it was drafted from, between its impact table and the target's line (MOD-spec-changes, Data).
function issueQueueSnapshot() {
  const snapshot = sampleQueueSnapshot();
  const path = "docs/spec-freigaben/2026-02-01_sample/index.md";
  const read = snapshot.read;
  return { ...snapshot, read: async (asked) => {
    const body = await read(asked);
    return asked === path ? body.replace("**Zieldatei aller Einträge:**", "**Issue:** #7 of https://github.com/alice/product\n\n**Zieldatei aller Einträge:**") : body;
  } };
}

// TST-1247104 · level: unit · module: MOD-spec-changes
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; UC-012
// given: the sample queue, whose index holds no line Issue; and the same queue whose index holds "**Issue:** #7 of https://github.com/alice/product" past its impact table, above the target's line
// input: queues over each snapshot
// expect: without the line, issue null; with it, issue { number: 7, product: "https://github.com/alice/product" }, and the title, the target and the three entries' states as without it
test("queues — the issue a queue's index names, null without the line", async () => {
  const [plain] = await queues(sampleQueueSnapshot());
  assert.equal(plain.issue, null);
  const [named] = await queues(issueQueueSnapshot());
  assert.deepEqual(named.issue, { number: 7, product: "https://github.com/alice/product" });
  assert.deepEqual([named.title, named.target, named.entries.map((entry) => entry.state)], ["sample queue", "SPEC.md", ["open", "approved", "in SPEC"]]);
});
