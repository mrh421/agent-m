// An entry's impact is read from one graph per snapshot (ITM-674) — MOD-spec-changes, as docs/architecture/MOD-spec-changes.md states it: `entryView(queue, entry, snapshot)` gives the impact list of every name the proposal changes, withdraws or
// adds, "with what references it" (`A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST`), from MOD-trace-graph's graph of the snapshot — the one the workflow "main changed" stored for its commit on trace-cache, which a page reads and
// never builds. A snapshot is one repository at one commit and does not change; the open entries of one snapshot therefore share the one read of its stored graph.
// Run: node --test tests/spec-changes-impact-graph.test.mjs
//
// Module: MOD-spec-changes
// Guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// Level: unit
//
// The fixture product is small and ours, never Agent M's own SPEC.md: a SPEC of three sections, a queue of three open entries that change one requirement each, and a use case that names all three. The snapshot is held in memory and KEEPS NO BLOB:
// each `read` of a path is counted and fetches the text again, as a snapshot of a host that keeps none does; each `readOn` is counted, and serves the graph stored for its commit (tests/stored-graph-fake.mjs). Nothing reaches the network. Each test states its input and its expected result before it runs. The counter-proofs are run as
// mutations and recorded in the pull request.
//
// Where the texts leave a reading open, the tests state the one they take, and the pull request names it:
//   - entryView's signature is unchanged: the graph is not passed in. The graph read for a commit is kept for the page (MOD-trace-graph's storedGraph) and shared by every snapshot object of that commit; another commit reads its own.
//   - A graph that could not be read is not kept: the next call reads it again.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as specChanges from "../src/spec-changes/index.mjs";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";

const { entryView } = specChanges;

const text = (...lines) => `${lines.join("\n")}\n`;
const gitBlob = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/product", web: "https://github.com/alice/product" };

const NAMES = ["A FIRST RULE", "A SECOND RULE", "A THIRD RULE"];
const section = (n, rule) => text(`## ${n}. Section ${n}`, "", `**${NAMES[n - 1]}** *(Fixture PO)*`, rule, "*Check:* no automatic check; at review", "");
const WAS = (n) => section(n, `Rule ${n} as it stands.`);
const PROPOSED = (n) => section(n, `Rule ${n} as it is proposed.`);
const SPEC = text("# Fixture product — Specification", "") + [1, 2, 3].map(WAS).join("");
const QUEUE = "docs/spec-freigaben/2026-03-01_graph";
const USE_CASE_PATH = "docs/use-cases/UC-001-use-the-rules.md";
const USE_CASE = text("---", "id: UC-001", "title: Use the rules", "area: reading", "actors:", "  - Reader", "realises:", ...NAMES.map((name) => `  - ${name}`), "---", "# UC-001 Use the rules", "", "**Goal.** The reader uses the rules.");

function files() {
  const tree = {
    "README.md": "# Fixture product\n", "SPEC.md": SPEC, [USE_CASE_PATH]: USE_CASE,
    [`${QUEUE}/index.md`]: text("# SPEC approvals — queue 2026-03-01 · graph", "", "**Zieldatei aller Einträge:** `SPEC.md`", "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
      ...[1, 2, 3].map((n) => `| 0${n} | \`SPEC.md\` | ## ${n}. Section ${n} | — | — |`)),
    [`${QUEUE}/entscheidungen.md`]: text("# Decisions — queue 2026-03-01 graph", "", "Append-only."),
  };
  for (const n of [1, 2, 3]) {
    tree[`${QUEUE}/0${n}-section-${n}.md`] = PROPOSED(n);
    tree[`${QUEUE}/0${n}-section-${n}.begruendung.md`] = text(`# Section ${n}: a change`, "", "**The change.** A sample.");
  }
  return tree;
}

/** A snapshot that keeps no blob: every read fetches the text again and is counted by path; every readOn is counted. With `notStoredFirst` the first readOn finds no stored graph. */
// Each snapshot is of a commit of its own unless `commit` names one: MOD-trace-graph's storedGraph keeps a commit's graph for the page (the module), so a test that asks for a
// commit no other test asks for sees its own reads.
let commits = 0;
function snapshotOf(tree, { notStoredFirst = false, commit = (++commits).toString(16).padStart(40, "c") } = {}) {
  const reads = new Map(), readOns = [];
  const stored = storedGraphReadOn({ commit, paths: Object.keys(tree).sort(), read: async (path) => tree[path] ?? null });
  return { reads, readOns, repository: ON_GITHUB, ref: "trunk", commit, paths: Object.keys(tree).sort(),
    async read(path) {
      reads.set(path, (reads.get(path) ?? 0) + 1);
      return Object.hasOwn(tree, path) ? tree[path] : null;
    },
    async readOn(branch, path, options) {
      // The references stored beside the graph (MOD-trace-graph's storedReferences): this fake stores none, so the graph is read; their read is not counted here.
      if (path.endsWith(".references.json.gz")) return null;
      readOns.push([branch, path]);
      return notStoredFirst && readOns.length === 1 ? null : stored(branch, path, options);
    },
    blob: (path) => (Object.hasOwn(tree, path) ? gitBlob(tree[path]) : null) };
}
const graphFile = (snapshot) => ["trace-cache", `${snapshot.commit}.json.gz`];

// TST-674001 · level: unit · module: MOD-spec-changes
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST
// given: a snapshot that keeps no blob, with three open entries that each change one requirement, all named by the use case UC-001, and the graph of its commit stored on trace-cache
// input: entryView for entries 01, 02 and 03 of the queue, one after the other, and then all three at once on a second snapshot of the same files
// expect: each impact names its requirement as changed, referenced by UC-001; the stored graph is read once for the three entries — one readOn of ("trace-cache", "<commit>.json.gz") —, whether they are asked one after the other or all at once; the use case file is never read: no graph is built
test("TST-674001 the open entries of one snapshot read one stored graph, and build none", async () => {
  const snapshot = snapshotOf(files());
  for (const n of [1, 2, 3]) {
    const view = await entryView(QUEUE, n, snapshot);
    assert.deepEqual(view.impact.map(({ name, change, referencedBy }) => [name, change, referencedBy]), [[NAMES[n - 1], "changed", ["UC-001"]]]);
  }
  assert.deepEqual(snapshot.readOns, [graphFile(snapshot)], "the stored graph was read once for three entries");
  assert.equal(snapshot.reads.get(USE_CASE_PATH), undefined, "no graph is built");
  const together = snapshotOf(files());
  await Promise.all([1, 2, 3].map((n) => entryView(QUEUE, n, together)));
  assert.deepEqual(together.readOns, [graphFile(together)], "asked at once, the stored graph is still read once");
});

// TST-674002 · level: unit · module: MOD-spec-changes
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER
// given: two snapshot objects of the same files at two commits, and a third snapshot object of the first one's commit, each keeping no blob
// input: entryView of entry 01 on each
// expect: the snapshots of the two commits each read their commit's stored graph once (the counter-proof of TST-674001: a graph kept for every commit to come would read the second commit's never); the third snapshot object reads none: the graph of a commit is read once for the page, whichever snapshot object asks
test("TST-674002 another commit reads its own stored graph, another snapshot of the same commit none", async () => {
  const first = snapshotOf(files()), second = snapshotOf(files()), again = snapshotOf(files(), { commit: first.commit });
  await entryView(QUEUE, 1, first);
  await entryView(QUEUE, 1, second);
  const view = await entryView(QUEUE, 1, again);
  assert.deepEqual(first.readOns, [graphFile(first)]);
  assert.deepEqual(second.readOns, [graphFile(second)]);
  assert.deepEqual(again.readOns, []);
  assert.deepEqual(view.impact.map(({ name, referencedBy }) => [name, referencedBy]), [[NAMES[0], ["UC-001"]]], "known positive: the kept graph gives the impact");
});

// TST-674003 · level: unit · module: MOD-spec-changes
// guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; A REMOTE INTERFACE NAMES HOW IT FAILS
// given: a snapshot whose branch trace-cache holds no graph of its commit at the first readOn, and holds it later (the workflow has run meanwhile)
// input: entryView of entry 01, then again
// expect: the first call fails with GraphNotStored and reads no file for a graph; the second reads the stored graph again and succeeds with the impact (a graph that could not be read is not kept)
test("TST-674003 a graph that is not stored is not kept, and none is built", async () => {
  const snapshot = snapshotOf(files(), { notStoredFirst: true });
  await assert.rejects(entryView(QUEUE, 1, snapshot), (error) => error.name === "GraphNotStored");
  assert.equal(snapshot.reads.get(USE_CASE_PATH), undefined, "no graph is built");
  const view = await entryView(QUEUE, 1, snapshot);
  assert.deepEqual(view.impact.map(({ name, referencedBy }) => [name, referencedBy]), [[NAMES[0], ["UC-001"]]]);
  assert.deepEqual(snapshot.readOns, [graphFile(snapshot), graphFile(snapshot)]);
});
