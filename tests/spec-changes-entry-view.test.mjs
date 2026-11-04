// A SPEC change entry beside the section it replaces (ITM-339) — MOD-spec-changes, as docs/architecture/MOD-spec-changes.md states
// it: `queues` derives, besides open, approved and in SPEC, the states `stale` — a record names a proposal or a SPEC section whose
// blob is no longer current — and `waiting for its anchor` — the anchor is not in the target and an entry of a queue, not in SPEC,
// creates it —, and `createdBy`, that entry as { queue, entry }; and `entryView(queue, entry, snapshot)` gives what the reviewer sees: the
// section that holds now beside the proposal, `null` for a new one, with their blobs and their difference, the rationale, the impact
// list of every name the proposal changes, withdraws or adds with what references it, the state and `createdBy`.
// proposeSection, saveEntry, acceptEntries, applyApproved and the rest of the module are not part of ITM-339 and are not tested here.
// Run: node --test tests/spec-changes-entry-view.test.mjs
//
// Module: MOD-spec-changes
// Guards: NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED; UC-006; UC-018
// Level: unit
//
// The fixture repository is small and ours, never Agent M's own SPEC.md (KEIN SPEC-ZUGRIFF AUS PRODUKT-CODE): a SPEC of two
// sections, one queue under docs/spec-freigaben/ with the entries each test needs, approval records, and the artifacts that name a
// requirement — use cases, a decision, an item and a test —, given to the module as a snapshot held in memory (paths, the blob SHA of
// every text as `git hash-object` gives it, and a read of the texts), the shape MOD-repository-hosts' Snapshot has. The expected
// values are read off the fixture's own texts, never off the code: a blob is the SHA-1 of "blob <length>\0" and the text's bytes,
// computed here with node:crypto. Each test states its input and its expected result before it runs (given / input / expect);
// where a test expects something to be found wanting, the same call is first shown to find it right on a known positive. Nothing
// reaches the network and nothing waits. The counter-proofs are recorded in the pull request.
//
// Where the module file leaves a reading open, the test states the reading it takes, and the pull request names it:
//   - A record is compared with the text as it stands when the snapshot can read the record and the target; a record or a target the
//     snapshot cannot read gives no evidence, and the entry keeps the state ITM-234 derived (open, or approved by the record's name).
//   - An entry a decision row names is in SPEC, whatever else the snapshot shows (stale and waiting for its anchor are for entries
//     not decided yet), and nobody creates its anchor.
//   - An entry of any queue, not in SPEC, creates an anchor when its proposal holds that heading as a section (a heading line outside fenced
//     code, not a mention of it), unless it has the same anchor itself; of several, the first in the order of the queues and their indexes creates it.
//   - The target of an entry is the file its own row names (Datei); the queue's line "Zieldatei aller Einträge" is Queue.target and finds no
//     section: a queue written in another repository names the file there, products/<name>/SPEC.md, which a product's snapshot lacks.
//   - An entry with a record is judged by the record, an entry without one by its anchor: a record that names the proposal's current
//     blob approves the entry whether or not its anchor is there yet, and a record that names no section is not an approval of the
//     section that holds.
//   - For an entry that waits for its anchor, as for a new section, there is no section that holds now: `current` is null, and
//     `createdBy` names the entry that will create it.
//   - `referencedBy` names each referencing artifact once, in the order requirementImpact lists them; a requirement is changed when
//     its source, its rule or its check differs.
//   - A rationale the queue does not hold is the empty rationale; an entry the snapshot does not hold is a RangeError.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lineDiff } from "../src/text-tools/index.mjs";
import * as specChanges from "../src/spec-changes/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

// A name the module does not provide yet is undefined here, so that each test fails by itself and not the whole file at once.
const { queues, entryView } = specChanges;

// ---------------------------------------------------------------- the fixture repository

// The blob SHA of a text, as `git hash-object` gives it.
function gitBlob(text) {
  const bytes = Buffer.from(text, "utf8");
  return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

// A snapshot of the files given at a commit of its own: every key is a path; `unreadable` are paths the tree lists but the snapshot cannot read. The graph of the commit is stored on
// trace-cache, as the workflow "main changed" stores it (tests/stored-graph-fake.mjs); each snapshot's commit is its own, since MOD-trace-graph's storedGraph keeps a commit's graph for the page.
let snapshots = 0;
function snapshotOf(files, unreadable = []) {
  return withStoredGraph({
    commit: (++snapshots).toString(16).padStart(40, "e"),
    paths: [...Object.keys(files), ...unreadable],
    blob: (path) => (Object.hasOwn(files, path) ? gitBlob(files[path]) : null),
    read: async (path) => (Object.hasOwn(files, path) ? files[path] : null),
  });
}

// The lines given as a text; a last empty line is a blank line before whatever follows.
const text = (...lines) => lines.join("\n") + "\n";
const pad2 = (n) => String(n).padStart(2, "0");

const SAMPLE = "A SAMPLE RULE";
const ANOTHER = "ANOTHER SAMPLE RULE";
const THIRD = "A THIRD SAMPLE RULE";
const FOURTH = "A FOURTH SAMPLE RULE";
const RENAMED = "A RENAMED SAMPLE RULE";
const DELETE = "A DELETE RULE";
const ADDED_RULE = "AN ADDED RULE";

// Section 1 of the SPEC as it stands now, and as it stood when the reviewer saw it, one rule's wording earlier.
const READING = text(
  "## 1. Reading", "",
  `**${SAMPLE}** *(Product Owner)*`, "A reader reads a file whole.", "*Check:* `tests/sample.test.mjs`", "",
  `**${ANOTHER}** *(Product Owner)*`, "A reader sees the name of a file.", "*Check:* no automatic check; at review", "",
  `**${THIRD}** *(Product Owner)*`, "A reader sees the size of a file.", "*Check:* no automatic check; at review", "",
  `**${FOURTH}** *(Product Owner)*`, "A reader sees the type of a file.", "*Check:* no automatic check; at review", "",
);
const READING_EARLIER = READING.replace("A reader sees the type of a file.", "A reader sees the kind of a file.");
const WRITING = text(
  "## 2. Writing", "",
  "**A WRITE RULE** *(Product Owner)*", "A writer writes a file whole.", "*Check:* no automatic check; at review",
);
// A section "1a" that an entry creates after section 1, and the wording of the entry that changes it afterwards.
const ADDED = text(
  "## 1a. Added", "",
  `**${ADDED_RULE}** *(Product Owner)*`, "A reader sees what was added.", "*Check:* no automatic check; at review", "",
);
const ADDED_CHANGED = ADDED.replace("sees what was added", "sees what was added, and when");
// A section "1b" that the same entry creates, and the requirement it holds.
const ALSO = text(
  "## 1b. Also", "",
  "**AN ALSO RULE** *(Product Owner)*", "A reader sees also what else was added.", "*Check:* no automatic check; at review", "",
);
const HEAD = text("# Fixture product — Specification", "");
const SPEC = HEAD + READING + WRITING;
const SPEC_WITH_ADDED = HEAD + READING + ADDED + WRITING;

// Section 1 proposed: SAMPLE's rule, ANOTHER's source and THIRD's check changed, FOURTH word for word as it is.
const PROPOSAL = text(
  "## 1. Reading", "",
  `**${SAMPLE}** *(Product Owner)*`, "A reader reads a file whole, or says why not.", "*Check:* `tests/sample.test.mjs`", "",
  `**${ANOTHER}** *(Product Owner, 2026)*`, "A reader sees the name of a file.", "*Check:* no automatic check; at review", "",
  `**${THIRD}** *(Product Owner)*`, "A reader sees the size of a file.", "*Check:* `tests/size.test.mjs`", "",
  `**${FOURTH}** *(Product Owner)*`, "A reader sees the type of a file.", "*Check:* no automatic check; at review", "",
);
// Section 1 proposed with SAMPLE renamed in place, everything else word for word.
const PROPOSAL_RENAMED = READING.replace(`**${SAMPLE}**`, `**${RENAMED}**`);
// Section 1 proposed with a line of prose added and no requirement touched.
const PROPOSAL_PROSE = READING.replace("## 1. Reading\n\n", "## 1. Reading\n\nThis section is about reading.\n\n");
// A section the SPEC does not hold.
const DELETING = text(
  "## 3. Deleting", "",
  `**${DELETE}** *(Product Owner)*`, "A deleter deletes a file whole.", "*Check:* no automatic check; at review",
);

const QUEUE = "docs/spec-freigaben/2026-03-01_sample";
const RATIONALE = text("# Reading: a sample change", "", "**The change.** A sample.", "", "**Why.** To be read beside the section.");

const proposalPath = (item) => `${QUEUE}/${pad2(item.nr)}-${item.slug}.md`;
const rationalePath = (item) => `${QUEUE}/${pad2(item.nr)}-${item.slug}.begruendung.md`;

// An entry of the queue: its number, the heading it starts with, its proposed text and the slug of its files.
const entry = (nr, anchor, proposal) => ({ nr, anchor, proposal, slug: `section-${nr}` });

// The approval record of an entry, as MOD-approvals' schema writes it: the proposal and the section as the reviewer saw them.
function record(item, { proposal = item.proposal, section }) {
  const blob = gitBlob(proposal);
  return {
    path: `docs/approvals/spec-2026-03-01_sample-${pad2(item.nr)}-${blob.slice(0, 12)}.md`,
    text: [
      "kind: spec", `queue: ${QUEUE}`, `entry: ${pad2(item.nr)}`, `proposal: ${proposalPath(item)}`, `blob: ${blob}`,
      "target: SPEC.md", `anchor: ${item.anchor}`, `section: ${gitBlob(section)}`, "",
    ].join("\n"),
  };
}

// The files of the fixture repository: the SPEC (none when `spec` is null), the queue with the entries given, a rationale for each
// unless `rationales` is false, the records, the decision rows ({ entry, record }), `extra` files, and the file the queue's line "Zieldatei
// aller Einträge" names (the rows name SPEC.md).
function repositoryFiles({ spec = SPEC, entries, records = [], decided = [], extra = {}, rationales = true, targetLine = "SPEC.md" }) {
  const files = {
    ...(spec === null ? {} : { "SPEC.md": spec }),
    [`${QUEUE}/index.md`]: text(
      "# SPEC approvals — queue 2026-03-01 · sample", "",
      `**Zieldatei aller Einträge:** \`${targetLine}\``, "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |",
      "|---|---|---|---|---|",
      ...entries.map((item) => `| ${pad2(item.nr)} | \`SPEC.md\` | ${item.anchor} | — | — |`),
    ),
    [`${QUEUE}/entscheidungen.md`]: text(
      "# Decisions — queue 2026-03-01 sample", "", "Append-only.",
      ...decided.map((d) => `| 2026-03-01 10:00 UTC | ${d.entry} | uebernommen | approval:${d.record.path.replace("docs/approvals/", "")} |`),
    ),
    ...extra,
  };
  for (const item of entries) {
    files[proposalPath(item)] = item.proposal;
    if (rationales) files[rationalePath(item)] = RATIONALE;
  }
  for (const r of records) files[r.path] = r.text;
  return files;
}

// The artifacts that name a requirement, for an impact list: two use cases, a decision, an item and a test name SAMPLE — the first use
// case twice, by `realises` and in its text —, a third use case names RENAMED before the SPEC holds it, and nothing names ANOTHER,
// THIRD, FOURTH, DELETE or the added rule.
const REFERENCES = {
  "docs/use-cases/UC-001-read-a-file.md": text(
    "---", "id: UC-001", "title: Read a file", "area: reading", "actors:", "  - Reader", "realises:", `  - ${SAMPLE}`, "---",
    "# UC-001 Read a file", "", `**Goal.** The reader reads a file whole, as \`${SAMPLE}\` says.`, ""),
  "docs/use-cases/UC-002-show-a-file.md": text(
    "---", "id: UC-002", "title: Show a file", "area: reading", "actors:", "  - Reader", "realises:", `  - ${SAMPLE}`, "---",
    "# UC-002 Show a file", "", "**Goal.** The reader sees a file.", ""),
  "docs/use-cases/UC-003-rename-a-rule.md": text(
    "---", "id: UC-003", "title: Rename a rule", "area: reading", "actors:", "  - Reader", "realises:", `  - ${RENAMED}`, "---",
    "# UC-003 Rename a rule", "", "**Goal.** The reader sees a renamed rule.", ""),
  "docs/architecture/ARC-001-reading-lives-in-a-module.md": text(
    "---", "id: ARC-001", "title: Reading lives in a module", "forced_by:", `  - ${SAMPLE}`, "designs:", "  - MOD-reader", "---",
    "# ARC-001 Reading lives in a module", ""),
  "docs/backlog/ITM-002-the-reader-page.md": text(
    "---", "id: ITM-002", "title: The reader page", "level: module", "realises:", `  - ${SAMPLE}`, "modules:", "  - MOD-reader",
    "tests:", "  - unit", "---", "# ITM-002 The reader page", ""),
  "tests/sample.test.mjs": text("// TST-001", "// level: unit", `// guards: ${SAMPLE}`, ""),
};
const SAMPLE_REFERENCED_BY = ["UC-001", "UC-002", "ARC-001", "ITM-002", "TST-001"];

// ---------------------------------------------------------------- the states stale and waiting for its anchor

// TST-472964 · level: unit · module: MOD-spec-changes
// guards: A STALE APPROVAL IS NOT APPLIED; UC-006
// given: the queue's entry 01 on "## 1. Reading", whose proposal has a record under its current blob — twice: the record names the blob of the section as the SPEC holds it now (the text the reviewer saw is the text that holds), and the record names the blob of the section as it stood one rule's wording earlier (the section changed after the reviewer saw it); no decision row names either
// input: queues(snapshot) for each
// expect: the first approved, with the record as its record; the second stale, with the same record, and no entry creating its anchor
test("queues — an entry whose section changed after it was shown reads stale", async () => {
  const item = entry(1, "## 1. Reading", PROPOSAL);
  const shown = async (section) => {
    const r = record(item, { section });
    const [queue] = await queues(snapshotOf(repositoryFiles({ entries: [item], records: [r] })));
    return { r, found: queue.entries[0] };
  };
  // Known positive: a record that names the section as it holds now is approved.
  const held = await shown(READING);
  assert.equal(held.found.state, "approved");
  assert.equal(held.found.record, held.r.path);
  const changed = await shown(READING_EARLIER);
  assert.equal(changed.found.state, "stale");
  assert.equal(changed.found.record, changed.r.path);
  assert.equal(changed.found.createdBy, null);
});

// TST-472965 · level: unit · module: MOD-spec-changes
// guards: A STALE APPROVAL IS NOT APPLIED; UC-006
// given: entry 01 with a proposal that changed after it was approved: a record whose file name names the blob of the proposal as it was (PROPOSAL_RENAMED) while the entry's file holds PROPOSAL now; and, to show the same fixture giving approved, a record under the blob of the proposal as it holds now
// input: queues(snapshot) for each
// expect: approved for the record under the current blob, with that record as its record; stale for the record under the earlier blob, with no record of its own — no record names the proposal as it holds now
test("queues — an entry whose proposal changed after it was approved reads stale", async () => {
  const item = entry(1, "## 1. Reading", PROPOSAL);
  const approvedOn = async (proposal) => {
    const r = record(item, { proposal, section: READING });
    const [queue] = await queues(snapshotOf(repositoryFiles({ entries: [item], records: [r] })));
    return { r, found: queue.entries[0] };
  };
  const current = await approvedOn(PROPOSAL);
  assert.equal(current.found.state, "approved", "known positive: the record names the proposal's current blob");
  assert.equal(current.found.record, current.r.path);
  const earlier = await approvedOn(PROPOSAL_RENAMED);
  assert.equal(earlier.found.state, "stale");
  assert.equal(earlier.found.record, null, "no record names the proposal as it holds now");
  assert.equal(earlier.found.proposal.blob, gitBlob(PROPOSAL), "the proposal is the one that holds now");
});

// TST-472966 · level: unit · module: MOD-spec-changes
// guards: A QUEUE IS ACCEPTED IN ITS ORDER; UC-006
// given: a queue whose entry 01 replaces "## 1. Reading" with section 1 followed by a section "## 1a. Added", and whose entry 02 starts with "## 1a. Added", a heading the SPEC does not hold; and, to show the same call giving open, the SPEC with that section in it
// input: queues(snapshot) for each
// expect: with the section in the SPEC both entries open with createdBy null; without it entry 01 open with createdBy null and entry 02 waiting for its anchor with createdBy { queue, entry 1 }
test("queues — an entry whose anchor an earlier entry creates reads waiting for its anchor, createdBy naming it", async () => {
  const creator = entry(1, "## 1. Reading", PROPOSAL + ADDED);
  const waiting = entry(2, "## 1a. Added", ADDED_CHANGED);
  const found = async (spec) => (await queues(snapshotOf(repositoryFiles({ spec, entries: [creator, waiting] }))))[0].entries
    .map((e) => [e.number, e.state, e.createdBy]);
  // Known positive: with the heading in the SPEC, the second entry replaces a section that is there.
  assert.deepEqual(await found(SPEC_WITH_ADDED), [[1, "open", null], [2, "open", null]]);
  assert.deepEqual(await found(SPEC), [[1, "open", null], [2, "waiting for its anchor", { queue: QUEUE, entry: 1 }]]);
});

// TST-472967 · level: unit · module: MOD-spec-changes
// guards: A QUEUE IS ACCEPTED IN ITS ORDER; UC-006
// given: the two proposals of the test above, to show the same call finding the entry that waits; then the same two in the other order of the queue's index (the entry that starts with "## 1a. Added" is entry 01, the one that holds the heading is entry 02); and two entries that both start with "## 3. Deleting", which the SPEC does not hold, and whose proposals both hold it
// input: queues(snapshot) for each
// expect: in the first, entry 02 waits for entry 01; in the second entry 01 waits for entry 02 — any entry not in SPEC with another anchor creates it, in whichever queue, an earlier or a later one —; in the third an entry with the same anchor creates nothing for it: both open, createdBy null
test("queues — only an entry with another anchor creates an anchor, earlier or later", async () => {
  const states = async (entries) => (await queues(snapshotOf(repositoryFiles({ entries }))))[0].entries.map((e) => [e.number, e.state, e.createdBy]);
  // Known positive: the earlier entry holds the heading, and the later one waits for it.
  assert.deepEqual(await states([entry(1, "## 1. Reading", PROPOSAL + ADDED), entry(2, "## 1a. Added", ADDED_CHANGED)]),
    [[1, "open", null], [2, "waiting for its anchor", { queue: QUEUE, entry: 1 }]]);
  assert.deepEqual(await states([entry(1, "## 1a. Added", ADDED_CHANGED), entry(2, "## 1. Reading", PROPOSAL + ADDED)]),
    [[1, "waiting for its anchor", { queue: QUEUE, entry: 2 }], [2, "open", null]]);
  assert.deepEqual(await states([entry(1, "## 3. Deleting", DELETING), entry(2, "## 3. Deleting", DELETING.replace("whole", "entirely"))]),
    [[1, "open", null], [2, "open", null]]);
});

// TST-472968 · level: unit · module: MOD-spec-changes
// guards: A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER
// given: the entries of the tests above that would read stale and waiting, with what the states need taken away: the snapshot without the target (no SPEC.md), so that no section can be compared and no anchor can be found; and, with the target, a record the snapshot lists but cannot read
// input: queues(snapshot) for each
// expect: no new state without the evidence — the entry whose record is under the current blob stays approved (the state ITM-234 derives from the record's name), and the entry that would wait stays open with createdBy null
test("queues — what cannot be read gives no evidence, and the entry keeps the state its files give", async () => {
  const stale = entry(1, "## 1. Reading", PROPOSAL);
  const creator = entry(2, "## 1. Reading", PROPOSAL + ADDED);
  const waiting = entry(3, "## 1a. Added", ADDED_CHANGED);
  const entries = [stale, creator, waiting];
  const wouldBeStale = record(stale, { section: READING_EARLIER });

  // Known positive: with the target and the record's text, the same entries read stale, open and waiting for its anchor.
  const read = (await queues(snapshotOf(repositoryFiles({ entries, records: [wouldBeStale] }))))[0].entries;
  assert.deepEqual(read.map((e) => [e.state, e.createdBy]), [["stale", null], ["open", null], ["waiting for its anchor", { queue: QUEUE, entry: 2 }]]);

  const noTarget = (await queues(snapshotOf(repositoryFiles({ spec: null, entries, records: [wouldBeStale] }))))[0].entries;
  assert.deepEqual(noTarget.map((e) => [e.state, e.createdBy]), [["approved", null], ["open", null], ["open", null]]);

  const unreadable = (await queues(snapshotOf(repositoryFiles({ entries }), [wouldBeStale.path])))[0].entries;
  assert.deepEqual(unreadable.map((e) => [e.state, e.createdBy]), [["approved", null], ["open", null], ["waiting for its anchor", { queue: QUEUE, entry: 2 }]],
    "a record the snapshot cannot read is no evidence against the entry that the record's name approves");
});

// TST-472969 · level: unit · module: MOD-spec-changes
// guards: A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER
// given: four entries, two of them decided, that the records and the SPEC would make stale or waiting if they were not: entry 01 on "## 2. Writing", decided, whose record names a section that is not the one that holds; entry 02 on "## 1. Reading", not decided, whose proposal creates "## 1a. Added" and "## 1b. Also"; entry 03 on "## 1a. Added", decided, whose anchor the SPEC does not hold; entry 04 on "## 1b. Also", not decided, whose anchor the SPEC does not hold either
// input: queues(snapshot)
// expect: entries 01 and 03 in SPEC with createdBy null — a decision row decides the state —, entry 02 open with createdBy null, and, to show the same call finding what waits, entry 04 waiting for its anchor with createdBy { queue, entry 2 }
test("queues — an entry a decision row names is in SPEC, whatever else the snapshot shows", async () => {
  const writing = entry(1, "## 2. Writing", WRITING.replace("whole", "entirely"));
  const reading = entry(2, "## 1. Reading", PROPOSAL + ADDED + ALSO);
  const added = entry(3, "## 1a. Added", ADDED_CHANGED);
  const also = entry(4, "## 1b. Also", ALSO.replace("sees also", "sees also, and when"));
  const decided = [
    { entry: 1, record: record(writing, { section: WRITING + "an older wording\n" }) },
    { entry: 3, record: record(added, { section: ADDED }) },
  ];
  const [queue] = await queues(snapshotOf(repositoryFiles({ entries: [writing, reading, added, also], records: decided.map((d) => d.record), decided })));
  assert.deepEqual(queue.entries.map((e) => [e.number, e.state, e.createdBy]),
    [[1, "in SPEC", null], [2, "open", null], [3, "in SPEC", null], [4, "waiting for its anchor", { queue: QUEUE, entry: 2 }]]);
  assert.equal(queue.entries[0].decision, decided[0].record.path);
});

// TST-472970 · level: unit · module: MOD-spec-changes
// guards: A QUEUE IS ACCEPTED IN ITS ORDER; UC-006
// given: the waiting test's two entries, to show the same call finding the entry that waits; then the same two with entry 01's proposal holding the heading "## 1a. Added" only as a mention — in a line of prose and in a fenced block of code — and not as a section
// input: queues(snapshot) for each
// expect: entry 02 waiting for entry 01 in the first; in the second both entries open with createdBy null, since a heading that is only mentioned is not created
test("queues — a mention of a heading is no creation of it", async () => {
  const mention = PROPOSAL + "See ## 1a. Added for more.\n\n```text\n## 1a. Added\n```\n";
  const states = async (creating) => (await queues(snapshotOf(repositoryFiles({ entries: [entry(1, "## 1. Reading", creating), entry(2, "## 1a. Added", ADDED_CHANGED)] }))))[0]
    .entries.map((e) => [e.number, e.state, e.createdBy]);
  assert.deepEqual(await states(PROPOSAL + ADDED), [[1, "open", null], [2, "waiting for its anchor", { queue: QUEUE, entry: 1 }]], "known positive: the heading is a section");
  assert.deepEqual(await states(mention), [[1, "open", null], [2, "open", null]]);
});

// TST-472971 · level: unit · module: MOD-spec-changes
// guards: A QUEUE IS ACCEPTED IN ITS ORDER; UC-006
// given: entry 01 on "## 1. Reading" and entry 02 on "## 2. Writing", both with proposals that hold the heading "## 1a. Added", and entry 03 on "## 1a. Added", which the SPEC does not hold
// input: queues(snapshot)
// expect: entry 03 waits for its anchor, which entry 01 creates — the first entry of the index that holds it — and not entry 02; entries 01 and 02 are open with createdBy null
test("queues — of several earlier entries that hold a heading, the first creates it", async () => {
  const entries = [entry(1, "## 1. Reading", PROPOSAL + ADDED), entry(2, "## 2. Writing", WRITING + "\n" + ADDED), entry(3, "## 1a. Added", ADDED_CHANGED)];
  const [queue] = await queues(snapshotOf(repositoryFiles({ entries })));
  assert.deepEqual(queue.entries.map((e) => [e.number, e.state, e.createdBy]), [[1, "open", null], [2, "open", null], [3, "waiting for its anchor", { queue: QUEUE, entry: 1 }]]);
});

// TST-472972 · level: unit · module: MOD-spec-changes
// guards: A STALE APPROVAL IS NOT APPLIED; UC-006
// given: entry 01 with a record under its current blob that names the section as it holds now, to show the same call finding it approved; and the same record with its `section` line taken out
// input: queues(snapshot) for each
// expect: approved for the first; stale for the second, with the record as its record: a record that names no section is not an approval of the section that holds
test("queues — a record that names no section does not approve the section that holds", async () => {
  const item = entry(1, "## 1. Reading", PROPOSAL);
  const whole = record(item, { section: READING });
  const [held] = await queues(snapshotOf(repositoryFiles({ entries: [item], records: [whole] })));
  assert.equal(held.entries[0].state, "approved", "known positive: the record names the section that holds");
  const without = { ...whole, text: whole.text.split("\n").filter((line) => !line.startsWith("section:")).join("\n") };
  const [bare] = await queues(snapshotOf(repositoryFiles({ entries: [item], records: [without] })));
  assert.equal(bare.entries[0].state, "stale");
  assert.equal(bare.entries[0].record, without.path);
});

// TST-472973 · level: unit · module: MOD-spec-changes
// guards: A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; UC-006
// given: entry 01 on "## 1. Reading", whose proposal creates "## 1a. Added", and entry 02 on "## 1a. Added", a heading the SPEC does not hold, with a record under its proposal's current blob that names the section as entry 01 will write it
// input: queues(snapshot)
// expect: entry 01 open with createdBy null; entry 02 approved, with the record as its record and createdBy { queue, entry 1 } — it is approved, no section holds now to compare the record with, and it comes after entry 01
test("queues — an entry whose record names its current proposal is approved though an earlier entry creates its anchor", async () => {
  const creating = entry(1, "## 1. Reading", PROPOSAL + ADDED);
  const after = entry(2, "## 1a. Added", ADDED_CHANGED);
  const approval = record(after, { section: ADDED });
  const [queue] = await queues(snapshotOf(repositoryFiles({ entries: [creating, after], records: [approval] })));
  assert.deepEqual(queue.entries.map((e) => [e.number, e.state, e.createdBy]), [[1, "open", null], [2, "approved", { queue: QUEUE, entry: 1 }]]);
  assert.equal(queue.entries[1].record, approval.path);
});

// TST-472974 · level: unit · module: MOD-spec-changes
// guards: A STALE APPROVAL IS NOT APPLIED; A QUEUE IS ACCEPTED IN ITS ORDER; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; UC-006
// given: the entries of the "what cannot be read" test — entry 01 with a record that names an earlier section, entry 02 that creates "## 1a. Added", entry 03 that starts with it —, first in a queue whose line "Zieldatei aller Einträge" names SPEC.md, to show the states and the views they give; then in a queue whose line names products/sample/SPEC.md, the path of the SPEC where the queue was written, which the snapshot does not hold, while its three rows name SPEC.md, which it does
// input: queues(snapshot), entryView(QUEUE, 1, snapshot) and entryView(QUEUE, 3, snapshot) for each
// expect: the same in both: stale, open and waiting for its anchor with createdBy { queue, entry 2 }; the view of entry 01 with the section that holds now and the view of entry 03 with none; and Queue.target as the line gives it, products/sample/SPEC.md in the second
test("queues and entryView — the file an entry's own row names is its target, whatever the queue's line names", async () => {
  const stale = entry(1, "## 1. Reading", PROPOSAL);
  const entries = [stale, entry(2, "## 1. Reading", PROPOSAL + ADDED), entry(3, "## 1a. Added", ADDED_CHANGED)];
  const records = [record(stale, { section: READING_EARLIER })];
  for (const targetLine of ["SPEC.md", "products/sample/SPEC.md"]) {
    const snapshot = snapshotOf(repositoryFiles({ entries, records, targetLine }));
    const [queue] = await queues(snapshot);
    assert.equal(queue.target, targetLine);
    assert.deepEqual(queue.entries.map((e) => [e.state, e.createdBy]), [["stale", null], ["open", null], ["waiting for its anchor", { queue: QUEUE, entry: 2 }]], targetLine);
    assert.deepEqual((await entryView(QUEUE, 1, snapshot)).current, { text: READING, blob: gitBlob(READING) }, targetLine);
    assert.equal((await entryView(QUEUE, 3, snapshot)).current, null, targetLine);
  }
});

// ---------------------------------------------------------------- entryView

// TST-472975 · level: unit · module: MOD-spec-changes
// guards: NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; UC-006; UC-018
// given: entry 01 on "## 1. Reading" with PROPOSAL, a rationale file and no record; the SPEC holds section 1 as READING, followed by section 2
// input: entryView(QUEUE, 1, snapshot)
// expect: current — the section's exact bytes, up to the next heading, with its blank line —, with their blob; the proposal's text and blob; the difference of the two as lineDiff gives it, with the three lines that changed removed and their new wording added; the rationale file's text; the state open and createdBy null
test("entryView — the section that holds now beside the proposal, their blobs and difference, the rationale, the state", async () => {
  const item = entry(1, "## 1. Reading", PROPOSAL);
  const view = await entryView(QUEUE, 1, snapshotOf(repositoryFiles({ entries: [item], extra: REFERENCES })));
  assert.deepEqual(view.current, { text: READING, blob: gitBlob(READING) });
  assert.ok(view.current.text.endsWith("\n\n"), "the section's bytes are not trimmed");
  assert.deepEqual(view.proposal, { text: PROPOSAL, blob: gitBlob(PROPOSAL) });
  assert.deepEqual(view.difference, lineDiff(READING, PROPOSAL));
  const lines = (op) => view.difference.filter((line) => line.op === op).map((line) => line.text);
  assert.deepEqual(lines("removed"), ["A reader reads a file whole.", `**${ANOTHER}** *(Product Owner)*`, "*Check:* no automatic check; at review"]);
  assert.deepEqual(lines("added"), ["A reader reads a file whole, or says why not.", `**${ANOTHER}** *(Product Owner, 2026)*`, "*Check:* `tests/size.test.mjs`"]);
  assert.equal(view.rationale, RATIONALE);
  assert.equal(view.state, "open");
  assert.equal(view.createdBy, null);
});

// TST-472976 · level: unit · module: MOD-spec-changes
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; UC-006; UC-018
// given: PROPOSAL changes SAMPLE's rule, ANOTHER's source and THIRD's check, and leaves FOURTH word for word as it is; SAMPLE is named by UC-001 (by `realises` and again in the use case's text), UC-002, ARC-001, ITM-002 and TST-001; nothing names ANOTHER or THIRD
// input: entryView(QUEUE, 1, snapshot).impact
// expect: the three changed names in the order the proposal states them — SAMPLE referenced by UC-001, UC-002, ARC-001, ITM-002 and TST-001 (use cases first, then the decision, the item, the test; UC-001 once), ANOTHER and THIRD each referenced by nobody — and not FOURTH
test("entryView — the impact list of a changed requirement, with what references it", async () => {
  const item = entry(1, "## 1. Reading", PROPOSAL);
  const { impact } = await entryView(QUEUE, 1, snapshotOf(repositoryFiles({ entries: [item], extra: REFERENCES })));
  assert.deepEqual(impact, [
    { name: SAMPLE, change: "changed", referencedBy: SAMPLE_REFERENCED_BY },
    { name: ANOTHER, change: "changed", referencedBy: [] },
    { name: THIRD, change: "changed", referencedBy: [] },
  ]);
});

// TST-472977 · level: unit · module: MOD-spec-changes
// guards: A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; UC-006
// given: PROPOSAL_RENAMED, section 1 with SAMPLE renamed in place to RENAMED and every other word as it is; SAMPLE named by UC-001, UC-002, ARC-001, ITM-002 and TST-001; RENAMED named by UC-003, although the SPEC does not hold it yet
// input: entryView(QUEUE, 1, snapshot).impact
// expect: the old name withdrawn, with what references it, before the new name added, with what references it already
test("entryView — a renamed requirement is the old name withdrawn and the new name added", async () => {
  const item = entry(1, "## 1. Reading", PROPOSAL_RENAMED);
  const { impact } = await entryView(QUEUE, 1, snapshotOf(repositoryFiles({ entries: [item], extra: REFERENCES })));
  assert.deepEqual(impact, [
    { name: SAMPLE, change: "withdrawn", referencedBy: SAMPLE_REFERENCED_BY },
    { name: RENAMED, change: "added", referencedBy: ["UC-003"] },
  ]);
});

// TST-472978 · level: unit · module: MOD-spec-changes
// guards: NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; UC-006
// given: entry 01 on "## 3. Deleting", a heading the SPEC does not hold and no entry creates, with a proposal of one new requirement
// input: entryView(QUEUE, 1, snapshot)
// expect: current null; the proposal with its blob; every line of the difference added; the requirement added with nobody referencing it; the state open and createdBy null
test("entryView — a new section has no current section, and its requirement is added", async () => {
  const item = entry(1, "## 3. Deleting", DELETING);
  const view = await entryView(QUEUE, 1, snapshotOf(repositoryFiles({ entries: [item], extra: REFERENCES })));
  assert.equal(view.current, null);
  assert.deepEqual(view.proposal, { text: DELETING, blob: gitBlob(DELETING) });
  assert.ok(view.difference.length > 0 && view.difference.every((line) => line.op === "added"), "every line is added");
  assert.deepEqual(view.difference.map((line) => line.text), DELETING.replace(/\n$/, "").split("\n"));
  assert.deepEqual(view.impact, [{ name: DELETE, change: "added", referencedBy: [] }]);
  assert.equal(view.state, "open");
  assert.equal(view.createdBy, null);
});

// TST-472979 · level: unit · module: MOD-spec-changes
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; UC-006
// given: PROPOSAL_PROSE, section 1 with a line of prose added and no requirement touched; the references of the other tests
// input: entryView(QUEUE, 1, snapshot).impact
// expect: an empty impact list, and a difference that holds the added line
test("entryView — a proposal that touches no requirement has an empty impact list", async () => {
  const item = entry(1, "## 1. Reading", PROPOSAL_PROSE);
  const view = await entryView(QUEUE, 1, snapshotOf(repositoryFiles({ entries: [item], extra: REFERENCES })));
  assert.deepEqual(view.impact, []);
  assert.ok(view.difference.some((line) => line.op === "added" && line.text === "This section is about reading."));
});

// TST-472980 · level: unit · module: MOD-spec-changes
// guards: A QUEUE IS ACCEPTED IN ITS ORDER; A STALE APPROVAL IS NOT APPLIED; UC-006
// given: the queue of the waiting test (entry 01 creates "## 1a. Added", entry 02 starts with it), and the queue of the stale test (entry 01 with a record that names the section as it stood one wording earlier)
// input: entryView(QUEUE, 2, ...) of the first, entryView(QUEUE, 1, ...) of the second
// expect: the waiting entry's view — state waiting for its anchor, createdBy { queue, entry 1 }, no current section (the SPEC does not hold one), the added requirement of its proposal in the impact list; the stale entry's view — state stale, the section that holds now, createdBy null
test("entryView — the state and createdBy of the entry are in the view", async () => {
  const creator = entry(1, "## 1. Reading", PROPOSAL + ADDED);
  const waiting = entry(2, "## 1a. Added", ADDED_CHANGED);
  const waits = await entryView(QUEUE, 2, snapshotOf(repositoryFiles({ entries: [creator, waiting], extra: REFERENCES })));
  assert.equal(waits.state, "waiting for its anchor");
  assert.deepEqual(waits.createdBy, { queue: QUEUE, entry: 1 });
  assert.equal(waits.current, null);
  assert.deepEqual(waits.impact, [{ name: ADDED_RULE, change: "added", referencedBy: [] }]);

  const item = entry(1, "## 1. Reading", PROPOSAL);
  const stale = await entryView(QUEUE, 1, snapshotOf(repositoryFiles({ entries: [item], records: [record(item, { section: READING_EARLIER })] })));
  assert.equal(stale.state, "stale");
  assert.equal(stale.createdBy, null);
  assert.deepEqual(stale.current, { text: READING, blob: gitBlob(READING) });
});

// TST-472981 · level: unit · module: MOD-spec-changes
// guards: NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; UC-006
// given: entry 01 with a rationale file, and the same entry in a queue that holds no rationale file
// input: entryView(QUEUE, 1, snapshot) for each
// expect: the rationale file's text for the first; the empty text for the second, whose view is otherwise whole
test("entryView — a rationale the queue does not hold is the empty rationale", async () => {
  const item = entry(1, "## 1. Reading", PROPOSAL);
  const with_ = await entryView(QUEUE, 1, snapshotOf(repositoryFiles({ entries: [item] })));
  assert.equal(with_.rationale, RATIONALE, "known positive: the rationale file is read");
  const without = await entryView(QUEUE, 1, snapshotOf(repositoryFiles({ entries: [item], rationales: false })));
  assert.equal(without.rationale, "");
  assert.deepEqual(without.proposal, with_.proposal);
});

// TST-472982 · level: unit · module: MOD-spec-changes
// guards: NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; UC-006
// given: a snapshot with one queue and its entry 01; and the same call for an entry the queue does not hold and for a queue the snapshot does not hold
// input: entryView(QUEUE, 1, snapshot), entryView(QUEUE, 99, snapshot), entryView("docs/spec-freigaben/2099-01-01_none", 1, snapshot)
// expect: the view of entry 01; a RangeError for each of the others
test("entryView — an entry or a queue the snapshot does not hold is a RangeError", async () => {
  const snapshot = snapshotOf(repositoryFiles({ entries: [entry(1, "## 1. Reading", PROPOSAL)] }));
  assert.equal((await entryView(QUEUE, 1, snapshot)).state, "open", "known positive: the entry is there");
  await assert.rejects(() => entryView(QUEUE, 99, snapshot), RangeError);
  await assert.rejects(() => entryView("docs/spec-freigaben/2099-01-01_none", 1, snapshot), RangeError);
});
