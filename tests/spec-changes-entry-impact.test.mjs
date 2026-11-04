// What one waiting SPEC change entry changes, withdraws or adds, without its rationale (ITM-1274) — MOD-spec-changes, as docs/architecture/MOD-spec-changes.md states it:
// `entryImpact(queue, entry, snapshot)` gives each requirement the entry changes, withdraws or adds with what names it, "from the entry's queue, its target and its proposal; it reads no rationale";
// `entryView` gives its impact list "as `entryImpact` gives it" (`A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST`, `NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT`).
// Run: node --test tests/spec-changes-entry-impact.test.mjs
//
// Module: MOD-spec-changes
// Guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; OPEN PROPOSALS ARE SHOWN IN THE BROWSER
// Level: unit
//
// The fixture is a small product of its own, never Agent M's SPEC.md: a SPEC of two sections, one queue whose entry 01 changes one requirement of section 1 and adds another, a rationale for the entry, and a use case that
// names the changed requirement. The snapshot is held in memory, in the shape of MOD-repository-hosts' Snapshot, and logs every path it is asked to read; the stored graph of its commit is served as the workflow "main
// changed" stores it (tests/stored-graph-fake.mjs), built from a read that does not log, so that building it is no read of the page. The expected values are written in each case, never read from a document or from the
// code. Nothing reaches the network. The counter-proofs are recorded in the pull request.
//
// Readings the cases take, each from the sentence quoted:
//   - "it reads no rationale" (MOD-spec-changes, entryImpact): no read of a file named `*.begruendung.md` is asked of the snapshot, whether through `read` or through `readMany`.
//   - "the impact list as `entryImpact` gives it" (MOD-spec-changes, entryView): `entryView(...).impact` is deep-equal to `entryImpact(...)` of the same entry and snapshot.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as specChanges from "../src/spec-changes/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

// A name the module does not provide yet is undefined here, so that each case fails by itself and not the whole file at once.
const { entryImpact, entryView } = specChanges;

const text = (...lines) => `${lines.join("\n")}\n`;
const gitBlob = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");

const SAME = "A SAME RULE", CHANGED = "A CHANGED RULE", ADDED = "AN ADDED RULE";
const SECTION_1 = text("## 1. First", "", `**${SAME}** *(Fixture PO)*`, "A reader reads a file.", "*Check:* no automatic check; at review", "",
  `**${CHANGED}** *(Fixture PO)*`, "A reader sees a file's name.", "*Check:* no automatic check; at review", "");
const SECTION_2 = text("## 2. Second", "", "**A WRITE RULE** *(Fixture PO)*", "A writer writes a file.", "*Check:* no automatic check; at review");
const SPEC = text("# Fixture product — Specification", "") + SECTION_1 + SECTION_2;
// Section 1 proposed: SAME word for word, CHANGED with another rule, and ADDED, which the SPEC does not hold.
const PROPOSAL = text("## 1. First", "", `**${SAME}** *(Fixture PO)*`, "A reader reads a file.", "*Check:* no automatic check; at review", "",
  `**${CHANGED}** *(Fixture PO)*`, "A reader sees a file's name and its size.", "*Check:* no automatic check; at review", "",
  `**${ADDED}** *(Fixture PO)*`, "A reader sees what was added.", "*Check:* no automatic check; at review", "");

const QUEUE = "docs/spec-freigaben/2026-03-01_sample";
const PROPOSAL_PATH = `${QUEUE}/01-first.md`;
const RATIONALE_PATH = `${QUEUE}/01-first.begruendung.md`;
const USE_CASE = text("---", "id: UC-001", "title: Read a name", "area: reading", "actors:", "  - Reader", "realises:", `  - ${CHANGED}`, "---", "# UC-001 Read a name", "", "**Goal.** The reader sees a name.");

const FILES = {
  "SPEC.md": SPEC,
  "docs/use-cases/UC-001-read-a-name.md": USE_CASE,
  [`${QUEUE}/index.md`]: text("# SPEC approvals — queue 2026-03-01 · sample", "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", "| 01 | `SPEC.md` | ## 1. First | — | — |"),
  [`${QUEUE}/entscheidungen.md`]: text("# Decisions — queue 2026-03-01 sample", "", "Append-only."),
  [PROPOSAL_PATH]: PROPOSAL,
  [RATIONALE_PATH]: text("# First: a sample change", "", "**The change.** A sample.", "", "**Why.** To be read beside the section."),
};

// The impact the fixture's entry has, written here: CHANGED is changed and named by UC-001, ADDED is added and named by nothing, SAME is not listed.
const EXPECTED = [{ name: CHANGED, change: "changed", referencedBy: ["UC-001"] }, { name: ADDED, change: "added", referencedBy: [] }];

const isRationale = (path) => path.endsWith(".begruendung.md");

// A snapshot of FILES at a commit of its own, which logs every path asked of `read` and of `readMany`; `unreadable` paths are listed by the tree but fail to be read, as an unreachable server does.
let snapshots = 0;
function snapshotOf({ unreadable = () => false } = {}) {
  const log = { reads: [], manys: [] };
  const plain = async (path) => (Object.hasOwn(FILES, path) ? FILES[path] : null);
  const snapshot = withStoredGraph({
    commit: (++snapshots).toString(16).padStart(40, "d"),
    paths: Object.keys(FILES),
    blob: (path) => (Object.hasOwn(FILES, path) ? gitBlob(FILES[path]) : null),
    async read(path) {
      log.reads.push(path);
      if (unreadable(path)) throw Object.assign(new Error("unreachable"), { name: "Unreachable" });
      return plain(path);
    },
    async readMany(paths) { log.manys.push([...paths]); },
  }, { read: plain });
  return { snapshot, log };
}
const asked = (log) => [...log.reads, ...log.manys.flat()];

// TST-1274001 · level: unit · module: MOD-spec-changes
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; OPEN PROPOSALS ARE SHOWN IN THE BROWSER
// given: the queue's entry 01 changes CHANGED, adds ADDED and states SAME word for word; UC-001 names CHANGED; the entry has a rationale in the tree (known positive: entryView on the same fixture reads it, and the log shows that)
// input: entryImpact(QUEUE, 1, snapshot), on a snapshot that logs every read and every readMany
// expect: [CHANGED changed, referenced by UC-001; ADDED added, referenced by nothing], SAME not listed; no path ending in .begruendung.md was asked of read or readMany, while the proposal's path was
test("TST-1274001 entryImpact gives what an entry changes and adds, and asks for no rationale", async () => {
  const known = snapshotOf();
  await entryView(QUEUE, 1, known.snapshot);
  assert.equal(asked(known.log).includes(RATIONALE_PATH), true, "known positive: the log shows a read of the rationale, which entryView makes");

  const { snapshot, log } = snapshotOf();
  assert.equal(typeof entryImpact, "function", "entryImpact is part of MOD-spec-changes' interface");
  assert.deepEqual(await entryImpact(QUEUE, 1, snapshot), EXPECTED);
  assert.equal(asked(log).includes(PROPOSAL_PATH), true, "the proposal is read");
  assert.deepEqual(asked(log).filter(isRationale), [], "no rationale is asked for");
});

// TST-1274002 · level: unit · module: MOD-spec-changes
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT
// given: the same entry; the snapshot lists the rationale in its tree but fails to read it, as an unreachable server does (known positive: entryView on it fails for that reason)
// input: entryImpact(QUEUE, 1, snapshot), then entryView(QUEUE, 1, a snapshot that reads the rationale) for the same entry
// expect: entryImpact still gives [CHANGED changed by UC-001, ADDED added]; entryView's impact is deep-equal to it
test("TST-1274002 entryImpact gives the impact where the rationale cannot be read, and entryView's impact equals it", async () => {
  const failing = snapshotOf({ unreadable: isRationale });
  await assert.rejects(entryView(QUEUE, 1, failing.snapshot), { name: "Unreachable" }, "known positive: a read of the rationale fails on this snapshot");

  assert.equal(typeof entryImpact, "function", "entryImpact is part of MOD-spec-changes' interface");
  const impact = await entryImpact(QUEUE, 1, snapshotOf({ unreadable: isRationale }).snapshot);
  assert.deepEqual(impact, EXPECTED);
  const view = await entryView(QUEUE, 1, snapshotOf().snapshot);
  assert.deepEqual(view.impact, impact);
});
