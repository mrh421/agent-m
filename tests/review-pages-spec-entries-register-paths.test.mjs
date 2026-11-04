// ITM-1067: the SPEC entry page (MOD-review-pages, spec-entries.mjs) finds the register's entries through MOD-source-register's registerPaths, and keeps no path rule of its own.
// Run: node --test tests/review-pages-spec-entries-register-paths.test.mjs
//
// Module: MOD-review-pages
// Guards: DEVELOP AGAINST INTERFACES; A REQUIREMENT HAS A REGISTERED SOURCE
// Level: unit
//
// The browser harness of tests/review-pages-harness.mjs is imported unchanged, for the document the page's elements are made with.
// registerPaths takes docs/sources/SRC-<slug>.md (MOD-source-register, Interfaces). The fixtures hold, beside the register entries SRC-alice and SRC-bob, files under
// docs/sources/ whose names do not begin with SRC- (README.md, notes.md): a file that is no entry of the register. The snapshots record every batch and every read.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const { sourcesOf, queueService } = await import("../src/review-pages/spec-entries.mjs");
const { registerPaths } = await import("../src/source-register/index.mjs");
import { withStoredGraph } from "./stored-graph-fake.mjs";

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const entry = (id, account) => text("---", `id: ${id}`, `title: ${id}`, "kind: person", `identifier: ${account}`, "authority: informational", "licence: may be republished - fixture",
  "---", `# ${id} ${id}`, "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| `2026-10-13` | 2026-10-13 | fixture | this repository | one file, hashed only |");
const LINKS = text("# Requirement sources of the product", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| SRC-alice | 2026-10-13 | ${"0".repeat(64)} | |`);
const REGISTER = { "docs/sources/SRC-alice.md": entry("SRC-alice", "github.com/alice"), "docs/sources/SRC-bob.md": entry("SRC-bob", "github.com/bob") };
// Files under docs/sources/ that are no register entry: no SRC- in the name. The text of notes.md is shaped like an entry, so that a read of it would show in the register.
const NOT_ENTRIES = { "docs/sources/README.md": "# The register\n\nOne file per source.\n", "docs/sources/notes.md": entry("SRC-notes", "github.com/notes") };
const OTHER = { "docs/participants.md": "# Participants\n", "README.md": "# Agent M\n" };

// A snapshot over `files` that records its batches and the reads on their own. A read of a path a batch asked for already is no read on its own.
function snapshotOf(files) {
  const asked = [], alone = [], held = new Set();
  const snapshot = { paths: Object.keys(files).sort(), blob: (path) => (path in files ? blobOf(files[path]) : null),
    repository: { server: "github", path: "alice/thesis-tool" }, ref: "main", commit: "c".repeat(40),
    read: async (path) => { if (!held.has(path)) alone.push(path); return path in files ? files[path] : null; },
    readMany: async (paths) => { asked.push([...paths]); for (const path of paths) held.add(path); } };
  return { snapshot, asked, alone };
}
const productPage = (product, instance) => ({ snapshot: product.snapshot, context: { product: { address: "https://github.com/alice/product" },
  instance: { host: { repositoryInfo: async () => ({ defaultBranch: "main" }), readSnapshot: async () => instance.snapshot } } } });
const touched = (recorder) => [...recorder.asked.flat(), ...recorder.alone].sort();

// TST-1067001 · level: unit · module: MOD-review-pages
// guards: DEVELOP AGAINST INTERFACES; A REQUIREMENT HAS A REGISTERED SOURCE
// given: a product whose snapshot holds docs/sources.md, and an instance whose snapshot holds the register entries SRC-alice and SRC-bob and, under docs/sources/, README.md and notes.md, which are no SRC- entries
// input: sourcesOf of the product's page; the instance's snapshot records its batches and its reads
// expect: the instance's snapshot is asked, by one readMany, for exactly docs/sources/SRC-alice.md and docs/sources/SRC-bob.md, and no other file is read; the register comes back as SRC-alice and SRC-bob
// known positive: SRC-alice and SRC-bob are the register's entries and are read
test("TST-1067001: a file under docs/sources/ that is no SRC- entry is not read as a register entry of the instance", async () => {
  const product = snapshotOf({ "docs/sources.md": LINKS }), instance = snapshotOf({ ...REGISTER, ...NOT_ENTRIES, ...OTHER });
  const { register } = await sourcesOf(productPage(product, instance));

  assert.deepEqual(instance.asked.map((paths) => [...paths].sort()), [["docs/sources/SRC-alice.md", "docs/sources/SRC-bob.md"]], "failure node: the batch holds a file that registerPaths does not name");
  assert.deepEqual(touched(instance), ["docs/sources/SRC-alice.md", "docs/sources/SRC-bob.md"], "failure node: a file that is no SRC- entry was read");
  assert.deepEqual(register.map((each) => each.id).sort(), ["SRC-alice", "SRC-bob"], "failure node: a file that is no SRC- entry is in the register");
});

// TST-1067002 · level: unit · module: MOD-review-pages
// guards: DEVELOP AGAINST INTERFACES; A REQUIREMENT HAS A REGISTERED SOURCE
// given: the page of the instance itself (no product), whose snapshot holds docs/sources.md, the register entries SRC-alice and SRC-bob and, under docs/sources/, README.md and notes.md, which are no SRC- entries
// input: sourcesOf of the instance's page
// expect: README.md and notes.md are not read; docs/sources/SRC-alice.md and docs/sources/SRC-bob.md are, and the register comes back as SRC-alice and SRC-bob
// known positive: SRC-alice and SRC-bob are the register's entries and are read
test("TST-1067002: on the instance's own page a file under docs/sources/ that is no SRC- entry is not read as one", async () => {
  const own = snapshotOf({ "docs/sources.md": LINKS, ...REGISTER, ...NOT_ENTRIES, ...OTHER });
  const { register } = await sourcesOf({ snapshot: own.snapshot, context: {} });

  assert.deepEqual(touched(own), ["docs/sources.md", "docs/sources/SRC-alice.md", "docs/sources/SRC-bob.md"], "failure node: a file that is no SRC- entry was read");
  assert.deepEqual(register.map((each) => each.id).sort(), ["SRC-alice", "SRC-bob"], "failure node: a file that is no SRC- entry is in the register");
});

// TST-1067003 · level: unit · module: MOD-review-pages
// guards: DEVELOP AGAINST INTERFACES; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the instance's own SPEC with a queue of one entry, and under docs/sources/ the register entries SRC-alice and SRC-bob, README.md and notes.md, which are no SRC- entries
// input: queueService.view of the entry, on the instance's own page; the snapshot records its batches
// expect: the batch the entry page asks for holds the register's files that registerPaths names over the snapshot's paths (docs/sources/SRC-alice.md, docs/sources/SRC-bob.md) and none of README.md and notes.md
// known positive: registerPaths names SRC-alice and SRC-bob over the same paths, and the batch holds both
test("TST-1067003: the entry page's batch holds the register's files that registerPaths names, and no other file of docs/sources/", async () => {
  const anchor = "## 1. Reading";
  const section = text(anchor, "", "**A SAMPLE RULE** *(Fixture PO)*", "A reader reads a file whole.", "*Check:* no automatic check; at review", "");
  const queue = "docs/spec-freigaben/2026-03-01_sample";
  const files = { "SPEC.md": text("# Fixture product — Specification", "") + section, "docs/sources.md": LINKS, ...REGISTER, ...NOT_ENTRIES,
    [`${queue}/index.md`]: text("# SPEC approvals — queue 2026-03-01 · sample", "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 05 | \`SPEC.md\` | ${anchor} | — | — |`),
    [`${queue}/entscheidungen.md`]: text("# Decisions — queue 2026-03-01 sample", "", "Append-only."),
    [`${queue}/05-entry.md`]: section.replace("whole.", "whole, or says why not."),
    [`${queue}/05-entry.begruendung.md`]: text(`# ${anchor}: a change`, "", "**The change.** A sample change.") };
  const own = snapshotOf(files);
  // The page reads the graph the push job stored (tests/stored-graph-fake.mjs), built from a read that logs nothing here.
  own.snapshot = withStoredGraph(own.snapshot, { read: async (path) => (path in files ? files[path] : null) });
  const expected = registerPaths(own.snapshot.paths);
  assert.deepEqual(expected, ["docs/sources/SRC-alice.md", "docs/sources/SRC-bob.md"], "the known positive: registerPaths names the two entries");

  const page = await queueService.view({ snapshot: own.snapshot, context: {} }, "spec-2026-03-01_sample-05", () => "#");
  assert.ok(page, "the entry page is drawn");

  const batch = own.asked.flat().filter((path) => path.startsWith("docs/sources/"));
  assert.deepEqual(batch.sort(), expected, "failure node: the batch holds a file under docs/sources/ that registerPaths does not name");
});
