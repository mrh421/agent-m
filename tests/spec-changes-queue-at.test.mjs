// One queue by its folder — MOD-spec-changes' queueAt, as the accepted text of docs/architecture/MOD-spec-changes.md states it: "`queueAt(snapshot: Snapshot,
// folder: string) -> Promise<Queue | null>` — the one queue whose folder is `folder`, `docs/spec-freigaben/<queue>`, as `queues` gives it, read from that queue's
// files and what its entries name alone; `null` where the snapshot holds no such queue." It is part of the module's interface (`provides`), so it is imported from
// src/spec-changes/index.mjs.
// Run: node --test tests/spec-changes-queue-at.test.mjs
//
// Module: MOD-spec-changes
// Guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; STATUS IS DERIVED FROM THE RECORDS; UC-006; UC-018
// Level: unit
//
// queueAt is given a snapshot held in memory (paths, blob SHAs and a read, as MOD-repository-hosts' Snapshot gives them) that logs every path it is asked to read.
// "What its entries name" is read as the text says: the target each entry's row names (SPEC.md), and the approval record that names an entry. Nothing sleeps.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { approvalSchema } from "../src/approvals/index.mjs";
import { writeDocument } from "../src/documents/index.mjs";
import { sectionText } from "../src/spec-document/index.mjs";

const changes = await import("../src/spec-changes/index.mjs");

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const ONE = "## 1. Lending", TWO = "## 2. Reading";
const SPEC = text("# Fixture — Specification", "", ONE, "", "**A BOOK IS LENT** *(Product Owner)*", "A book is lent for a week.", "*Check:* `tests/lend.test.mjs`", "",
  TWO, "", "**A CARD IS SHOWN** *(Product Owner)*", "A reader shows a card.", "*Check:* `tests/card.test.mjs`");
const MINE = "docs/spec-freigaben/2026-03-02_mine", OTHER = "docs/spec-freigaben/2026-03-01_other";
const indexOf = (folder, rows) => text(`# SPEC approvals — queue ${folder.slice(-16, -6)} · fixture`, "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
  "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", ...rows.map(([nn, anchor]) => `| ${nn} | \`SPEC.md\` | ${anchor} | — | — |`));
const DECISIONS = text("# Decisions — queue fixture", "", "Append-only.");
const PROPOSAL_ONE = sectionText(SPEC, ONE).replace("a week.", "two weeks.");
const PROPOSAL_TWO = sectionText(SPEC, TWO).replace("a card.", "a card, always.");
const RECORD = `docs/approvals/spec-2026-03-02_mine-02-${blobOf(PROPOSAL_TWO).slice(0, 12)}.md`;

// The product: SPEC.md, the queue 2026-03-02_mine with entry 01 open on "1. Lending" and entry 02 approved on "2. Reading" (a record names its proposal and the section),
// and the queue 2026-03-01_other with one open entry on "1. Lending". Each snapshot logs the paths read.
function snapshotOf() {
  const files = {
    "SPEC.md": SPEC,
    [`${MINE}/index.md`]: indexOf(MINE, [["01", ONE], ["02", TWO]]), [`${MINE}/entscheidungen.md`]: DECISIONS,
    [`${MINE}/01-lending.md`]: PROPOSAL_ONE, [`${MINE}/01-lending.begruendung.md`]: text("# 1. Lending: two weeks", "", "**Why.** Longer."),
    [`${MINE}/02-reading.md`]: PROPOSAL_TWO, [`${MINE}/02-reading.begruendung.md`]: text("# 2. Reading: always", "", "**Why.** Always."),
    [RECORD]: writeDocument(approvalSchema, { fields: { kind: "spec", queue: MINE, entry: "02", proposal: `${MINE}/02-reading.md`, blob: blobOf(PROPOSAL_TWO),
      target: "SPEC.md", anchor: TWO, section: blobOf(sectionText(SPEC, TWO)) } }),
    [`${OTHER}/index.md`]: indexOf(OTHER, [["01", ONE]]), [`${OTHER}/entscheidungen.md`]: DECISIONS,
    [`${OTHER}/01-lending.md`]: PROPOSAL_ONE.replace("two weeks", "three weeks"), [`${OTHER}/01-lending.begruendung.md`]: text("# 1. Lending: three weeks"),
  };
  const read = [];
  return { read, snapshot: { paths: Object.keys(files).sort(), blob: (path) => (path in files ? blobOf(files[path]) : null),
    read: async (path) => { read.push(path); return path in files ? files[path] : null; } } };
}

// TST-1273001 · level: unit · module: MOD-spec-changes
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; STATUS IS DERIVED FROM THE RECORDS; UC-006
// given: the product above — the queue 2026-03-02_mine (01 open, 02 approved by a record) and the queue 2026-03-01_other
// input: queueAt(snapshot, "docs/spec-freigaben/2026-03-02_mine"), imported from the module's interface
// expect: the queue that queues gives for that folder, equal in every field (entry 01 open, entry 02 approved with its record); the paths read are the queue's own files, SPEC.md and the record — no file of 2026-03-01_other; counter-proof: queues itself reads 2026-03-01_other/index.md (the log sees another queue's read)
test("queueAt gives the queue queues gives for its folder, reading only its files and what its entries name", async () => {
  assert.equal(typeof changes.queueAt, "function", "queueAt is in MOD-spec-changes' interface");
  const all = snapshotOf();
  const expected = (await changes.queues(all.snapshot)).find((queue) => queue.folder === MINE);
  assert.deepEqual(expected.entries.map((entry) => entry.state), ["open", "approved"], "known positive: the fixture holds an open and an approved entry");
  assert.ok(all.read.includes(`${OTHER}/index.md`), "known positive: queues reads the other queue's index");
  const one = snapshotOf();
  const got = await changes.queueAt(one.snapshot, MINE);
  assert.deepEqual(got, expected);
  assert.deepEqual([...new Set(one.read)].filter((path) => !path.startsWith(`${MINE}/`) && path !== "SPEC.md" && path !== RECORD), [], `read: ${one.read.join(", ")}`);
});

// TST-1273002 · level: unit · module: MOD-spec-changes
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; UC-006
// given: the product above, which holds no queue 2026-03-03_none
// input: queueAt(snapshot, "docs/spec-freigaben/2026-03-03_none")
// expect: null; no queue's file is read
test("queueAt gives null for a folder the snapshot lacks", async () => {
  assert.equal(typeof changes.queueAt, "function", "queueAt is in MOD-spec-changes' interface");
  const { snapshot, read } = snapshotOf();
  assert.equal(await changes.queueAt(snapshot, "docs/spec-freigaben/2026-03-03_none"), null);
  assert.deepEqual(read.filter((path) => path.startsWith("docs/spec-freigaben/")), []);
});
