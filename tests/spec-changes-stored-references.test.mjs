// An entry's impact list is read from the references stored beside the graph — MOD-spec-changes, as docs/architecture/MOD-spec-changes.md states it:
// "MOD-trace-graph.storedReferences — the impact list of an entry on a page (entryView, proposeSection, saveEntry), from what names each requirement as stored beside
// the commit's graph; MOD-trace-graph.storedGraph — the same from the graph itself, where those are not stored" (`A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST`).
// Run: node --test tests/spec-changes-stored-references.test.mjs
//
// Module: MOD-spec-changes
// Guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// The fixture product is small and ours, never Agent M's own SPEC.md: a SPEC of two sections, a queue of two open entries that change one requirement each, and a use case that names both. The
// snapshot is held in memory and counts every `readOn`. The file `<commit>.references.json.gz` is written here by hand, as MOD-trace-graph's format states it (format, version, commit, references:
// name -> identifiers) and gzipped, so that the expected impact list stands in the test and is read from no module; the stored graph of the commit is served as tests/stored-graph-fake.mjs does, to be
// read only where the references are not stored. storedReferences keeps what it read for a commit for the page, so each case asks for commits of its own. The counter-proof is run as a planted fault and
// recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import * as specChanges from "../src/spec-changes/index.mjs";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const { entryView } = specChanges;
const text = (...lines) => `${lines.join("\n")}\n`;
const NAMES = ["A FIRST RULE", "A SECOND RULE"];
const section = (n, rule) => text(`## ${n}. Section ${n}`, "", `**${NAMES[n - 1]}** *(Fixture PO)*`, rule, "*Check:* no automatic check; at review", "");
const SPEC = text("# Fixture product — Specification", "") + [1, 2].map((n) => section(n, `Rule ${n} as it stands.`)).join("");
const QUEUE = "docs/spec-freigaben/2026-03-01_references";
const USE_CASE_PATH = "docs/use-cases/UC-001-use-the-rules.md";
const USE_CASE = text("---", "id: UC-001", "title: Use the rules", "area: reading", "actors:", "  - Reader", "realises:", ...NAMES.map((name) => `  - ${name}`), "---", "# UC-001 Use the rules", "", "**Goal.** The reader uses the rules.");

function files() {
  const tree = {
    "README.md": "# Fixture product\n", "SPEC.md": SPEC, [USE_CASE_PATH]: USE_CASE,
    [`${QUEUE}/index.md`]: text("# SPEC approvals — queue 2026-03-01 · references", "", "**Zieldatei aller Einträge:** `SPEC.md`", "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
      ...[1, 2].map((n) => `| 0${n} | \`SPEC.md\` | ## ${n}. Section ${n} | — | — |`)),
    [`${QUEUE}/entscheidungen.md`]: text("# Decisions — queue 2026-03-01 references", "", "Append-only."),
  };
  for (const n of [1, 2]) {
    tree[`${QUEUE}/0${n}-section-${n}.md`] = section(n, `Rule ${n} as it is proposed.`);
    tree[`${QUEUE}/0${n}-section-${n}.begruendung.md`] = text(`# Section ${n}: a change`, "", "**The change.** A sample.");
  }
  return tree;
}

// A snapshot of a commit of its own whose branch trace-cache holds the graph and, with `references`, the references file naming UC-001 for both requirements; every readOn is counted by path.
let commits = 0;
function snapshotOf({ references }) {
  const tree = files(), commit = (++commits).toString(16).padStart(40, "d"), readOns = [];
  const graph = storedGraphReadOn({ commit, paths: Object.keys(tree).sort(), read: async (path) => tree[path] ?? null });
  const stored = references ? new Uint8Array(gzipSync(JSON.stringify({ format: "agent-m-trace-references", version: 1, commit,
    references: { [NAMES[0]]: ["UC-001"], [NAMES[1]]: ["UC-001"] } }))) : null;
  return { readOns, commit, paths: Object.keys(tree).sort(), repository: { server: "github", origin: "https://github.com", path: "alice/product", web: "https://github.com/alice/product" }, ref: "trunk",
    async read(path) { return Object.hasOwn(tree, path) ? tree[path] : null; },
    async readOn(branch, path, options) {
      readOns.push([branch, path]);
      if (path === `${commit}.references.json.gz`) return stored;
      return graph.call(this, branch, path, options);
    },
    blob: () => null };
}
const impactOf = (view) => view.impact.map(({ name, change, referencedBy }) => [name, change, referencedBy]);
const EXPECTED = (n) => [[NAMES[n - 1], "changed", ["UC-001"]]];

// TST-1348101 · level: unit · module: MOD-spec-changes
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: a snapshot with two open entries that each change one requirement, both named by UC-001, whose branch trace-cache holds the references file of its commit naming UC-001 for both, and the graph of its commit
// input: entryView for entries 01 and 02, one after the other
// expect: each impact names its requirement as changed, referenced by UC-001; the references file is read once for the two entries — one readOn of ("trace-cache", "<commit>.references.json.gz") —; the graph is not read: no readOn of "<commit>.json.gz"; counter-proof: with the references not stored (TST-1348102) the graph is read
test("TST-1348101 with the references stored, an entry's impact list is taken from them and the graph is not read", async () => {
  const snapshot = snapshotOf({ references: true });
  for (const n of [1, 2]) assert.deepEqual(impactOf(await entryView(QUEUE, n, snapshot)), EXPECTED(n));
  assert.deepEqual(snapshot.readOns, [["trace-cache", `${snapshot.commit}.references.json.gz`]]);
});

// TST-1348102 · level: unit · module: MOD-spec-changes
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST
// given: the entries of TST-1348101 on a snapshot of another commit whose trace-cache holds the graph of its commit and no references file
// input: entryView for entries 01 and 02
// expect: the impact lists are the same as in TST-1348101 — each requirement changed, referenced by UC-001 —; the references file is asked for once and the graph's file "<commit>.json.gz" once, since the references are not stored
test("TST-1348102 with the references not stored, the graph is read and gives the same impact list", async () => {
  const snapshot = snapshotOf({ references: false });
  for (const n of [1, 2]) assert.deepEqual(impactOf(await entryView(QUEUE, n, snapshot)), EXPECTED(n));
  assert.deepEqual(snapshot.readOns, [["trace-cache", `${snapshot.commit}.references.json.gz`], ["trace-cache", `${snapshot.commit}.json.gz`]]);
});
