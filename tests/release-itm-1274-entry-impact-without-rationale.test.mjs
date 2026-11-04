// Release tests of ITM-1274 — the specification reads what each waiting entry changes, not its rationale. The behaviour is MOD-spec-changes' `entryImpact(queue, entry, snapshot)` ("what one entry
// changes, withdraws or adds, each requirement with what names it, from the entry's queue, its target and its proposal; it reads no rationale"), `entryView`'s impact list "as `entryImpact` gives
// it", and MOD-trace-pages' "of each entry waiting its proposal and what it changes, never its rationale" (Files); the requirements are OPEN PROPOSALS ARE SHOWN IN THE BROWSER ("Every requirement
// that an open queue entry would add, change or withdraw is shown in the browser with that entry's status and a link to it") and A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST, and UC-020.
// Run: node --test tests/release-itm-1274-entry-impact-without-rationale.test.mjs
//
// Module: MOD-spec-changes; MOD-trace-pages
// Guards: OPEN PROPOSALS ARE SHOWN IN THE BROWSER; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; UC-020
// Level: release
//
// Written for the release testing of sprint 112 by a participant who implemented none of ITM-1274 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The implementers' cases
// (tests/spec-changes-entry-impact.test.mjs, TST-1274003 of tests/trace-pages-specification.test.mjs) take an entry that changes one requirement and adds one, and three entries of a page. These cases take
// what they leave out: an entry that withdraws, an entry whose anchor the target lacks, the order of the names, the reads made of each file, the errors for an entry the snapshot does not hold, and a page
// whose entries overlap or whose proposal cannot be read. Fixtures are their own; the expected values are written here. Readings the texts leave open, taken here:
//   - the order of the impact list: the names withdrawn first, then the others in the order of the proposal (impactOf's own order, which entryView showed before and which `entryView`'s impact keeps).
//   - "reads no rationale": no path ending `.begruendung.md` is asked of the snapshot's `read` or `readMany`.
//   - two entries naming one requirement: the texts do not say which gives the page's status (the page takes the newest queue's), so no case here lets two entries name one requirement.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { find, treeHost } from "./trace-pages-harness.mjs";
import { entryImpact, entryView } from "../src/spec-changes/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
const route = view.routes.find((candidate) => candidate.name === "trace");

const text = (...lines) => `${lines.join("\n")}\n`;
const gitBlob = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const rule = (name, body) => [`**${name}** *(Fixture PO)*`, body, "*Check:* no automatic check; at review", ""];

// ---------------------------------------------------------------- the product: a SPEC of two sections, use cases and a module that name its requirements

const KEEP = "A KEPT RULE", EDIT = "AN EDITED RULE", GONE = "A WITHDRAWN RULE", PLUS = "AN ADDED RULE", LATER = "A LATER RULE";
const FIRST = text("## 1. First", "", ...rule(KEEP, "Kept as it is."), ...rule(EDIT, "Edited text."), ...rule(GONE, "To be withdrawn."));
const SECOND = text("## 2. Second", "", ...rule(LATER, "A rule of the second section."));
const SPEC = text("# Fixture product — Specification", "") + FIRST + SECOND;
const doc = (id, realises) => text("---", `id: ${id}`, `title: ${id}`, "area: a", "actors:", "  - Reader", "realises:", ...realises.map((name) => `  - ${name}`), "---", `# ${id} ${id}`, "", "**Goal.** g.");

// The files of one queue with one entry on SPEC.md: its index, its decisions, the proposal and, where `rationale`, its rationale.
function queueFiles(folder, anchor, proposal, { rationale = true } = {}) {
  const base = `docs/spec-freigaben/${folder}`;
  return {
    [`${base}/index.md`]: text(`# SPEC approvals — queue ${folder.slice(0, 10)} · ${folder.slice(11)}`, "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
      "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 01 | \`SPEC.md\` | ${anchor} | — | — |`),
    [`${base}/entscheidungen.md`]: text(`# Decisions — queue ${folder}`, "", "Append-only."),
    [`${base}/01-entry.md`]: proposal,
    ...(rationale ? { [`${base}/01-entry.begruendung.md`]: text("# A change", "", "**The change.** c.", "", "**Why.** To be read on the entry's own page.") } : {}),
  };
}
const isRationale = (path) => path.endsWith(".begruendung.md");

// An entry that withdraws GONE, changes EDIT and adds PLUS in section 1, as a proposal of the section.
const MIXED = text("## 1. First", "", ...rule(KEEP, "Kept as it is."), ...rule(EDIT, "Edited text, now longer."), ...rule(PLUS, "Added text."));
const MIXED_QUEUE = "2026-04-01_mixed";
const BASE_FILES = { "SPEC.md": SPEC, "docs/use-cases/UC-001-gone.md": doc("UC-001", [GONE]), "docs/use-cases/UC-002-edit.md": doc("UC-002", [EDIT]),
  "docs/architecture/MOD-edit.md": text("---", "id: MOD-edit", "title: Edit", "folder: src/edit/", "realises:", `  - ${EDIT}`, "follows:", "  - ARC-001", "uses: []", "provides:", "  - f", "---", "# MOD-edit Edit", "") };

// A snapshot of `files` at a commit of its own that logs every path asked of `read` and `readMany`; its stored graph is served as the workflow "main changed" stores it, built without logging.
let made = 0;
function snapshotOf(files) {
  const log = { reads: [], manys: [] };
  const plain = async (path) => (Object.hasOwn(files, path) ? files[path] : null);
  const snapshot = withStoredGraph({
    commit: (++made).toString(16).padStart(40, "e"), paths: Object.keys(files),
    blob: (path) => (Object.hasOwn(files, path) ? gitBlob(files[path]) : null),
    async read(path) { log.reads.push(path); return plain(path); },
    async readMany(paths) { log.manys.push([...paths]); },
  }, { read: plain });
  return { snapshot, log };
}
const asked = (log) => [...log.reads, ...log.manys.flat()];
const byName = (list) => [...list].sort((a, b) => (a.name < b.name ? -1 : 1));
const sortedRefs = (list) => list.map((each) => ({ ...each, referencedBy: [...each.referencedBy].sort() }));

// TST-1274301 · level: release · module: MOD-spec-changes
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; OPEN PROPOSALS ARE SHOWN IN THE BROWSER
// given: an entry whose proposal of section 1 keeps A KEPT RULE, edits AN EDITED RULE, leaves out A WITHDRAWN RULE and adds AN ADDED RULE; UC-001 names the withdrawn rule, UC-002 and MOD-edit the edited one; the queue holds a rationale for the entry; known positive first — entryView on the same product reads that rationale
// input: entryImpact(queue, 1, snapshot) on a snapshot that logs its reads
// expect: [withdrawn rule: withdrawn, by UC-001; edited rule: changed, by MOD-edit and UC-002; added rule: added, by nothing], in that order, the kept rule not listed; no rationale path asked of read or readMany
// Planted fault: entryImpact built on entryView (the rationale read back in) fails the rationale assertion; an impact list without the withdrawn names, or ordered otherwise, fails the equality.
test("TST-1274301 entryImpact gives the withdrawn, the changed and the added, each with what names it, and reads no rationale", async () => {
  const files = { ...BASE_FILES, ...queueFiles(MIXED_QUEUE, "## 1. First", MIXED) };
  const rationale = `docs/spec-freigaben/${MIXED_QUEUE}/01-entry.begruendung.md`;
  const known = snapshotOf(files);
  await entryView(`docs/spec-freigaben/${MIXED_QUEUE}`, 1, known.snapshot);
  assert.equal(asked(known.log).includes(rationale), true, "known positive: entryView reads the rationale");

  const { snapshot, log } = snapshotOf(files);
  const impact = await entryImpact(`docs/spec-freigaben/${MIXED_QUEUE}`, 1, snapshot);
  assert.deepEqual(sortedRefs(impact), [{ name: GONE, change: "withdrawn", referencedBy: ["UC-001"] }, { name: EDIT, change: "changed", referencedBy: ["MOD-edit", "UC-002"] },
    { name: PLUS, change: "added", referencedBy: [] }]);
  assert.deepEqual(asked(log).filter(isRationale), [], "no rationale is asked for");
});

// TST-1274302 · level: release · module: MOD-spec-changes
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST
// given: an entry whose anchor "## 3. Third" the target SPEC.md does not hold, its proposal a section that states A KEPT RULE word for word as the SPEC has it, AN EDITED RULE with another text, and AN ADDED RULE, which the SPEC lacks; no rationale in the queue's tree
// input: entryImpact(queue, 1, snapshot)
// expect: [edited rule: changed, by MOD-edit and UC-002; added rule: added, by nothing]: a name the target holds elsewhere is no addition, and is not named where it is the same; no rationale asked, and the call does not fail for lacking one
// Planted fault: an impact list that took the missing section for an empty one (the `elsewhere` argument of impactOf in src/spec-changes/accept.mjs left out of impactOfTexts) lists the kept and the edited rule as added, and the case fails.
test("TST-1274302 an entry whose anchor the target lacks names no requirement the target holds already as added", async () => {
  const proposal = text("## 3. Third", "", ...rule(KEEP, "Kept as it is."), ...rule(EDIT, "Edited text, a third version."), ...rule(PLUS, "Added text."));
  const { snapshot, log } = snapshotOf({ ...BASE_FILES, ...queueFiles("2026-04-02_new-section", "## 3. Third", proposal, { rationale: false }) });
  const impact = await entryImpact("docs/spec-freigaben/2026-04-02_new-section", 1, snapshot);
  assert.deepEqual(sortedRefs(impact), [{ name: EDIT, change: "changed", referencedBy: ["MOD-edit", "UC-002"] }, { name: PLUS, change: "added", referencedBy: [] }]);
  assert.deepEqual(asked(log).filter(isRationale), []);
});

// TST-1274303 · level: release · module: MOD-spec-changes
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; OPEN PROPOSALS ARE SHOWN IN THE BROWSER
// given: the product of the mixed entry, once with the rationale and once without any in the tree
// input: entryView of the entry on each, and entryImpact on each
// expect: the impact of entryView equals entryImpact's on both, in the same order; entryView still gives the rationale text where there is one and "" where the tree holds none
// Planted fault: entryView computing its impact list with a copy of the rule that orders or filters otherwise fails the equality.
test("TST-1274303 entryView's impact list equals entryImpact's, with or without a rationale", async () => {
  const queue = `docs/spec-freigaben/${MIXED_QUEUE}`;
  for (const [what, options] of [["with a rationale", {}], ["without one", { rationale: false }]]) {
    const files = { ...BASE_FILES, ...queueFiles(MIXED_QUEUE, "## 1. First", MIXED, options) };
    const shown = snapshotOf(files);
    const seen = await entryView(queue, 1, shown.snapshot);
    const impact = await entryImpact(queue, 1, snapshotOf(files).snapshot);
    assert.deepEqual(seen.impact, impact, what);
    assert.equal(seen.rationale === "", options.rationale === false, `${what}: the rationale text`);
  }
});

// TST-1274304 · level: release · module: MOD-spec-changes
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST
// given: the product of the mixed entry; a queue the snapshot does not hold; entry 7 of the queue it holds
// input: entryImpact and entryView of each
// expect: each rejects with a RangeError, naming the function that was called (entryImpact, entryView) and the entry or the queue; known positive: entry 1 of the held queue gives a list
// Planted fault: entryImpact returning [] for an entry the snapshot does not hold fails the rejection; entryImpact's error naming entryView fails the name.
test("TST-1274304 an entry or a queue the snapshot does not hold is a RangeError naming the call", async () => {
  const { snapshot } = snapshotOf({ ...BASE_FILES, ...queueFiles(MIXED_QUEUE, "## 1. First", MIXED) });
  const queue = `docs/spec-freigaben/${MIXED_QUEUE}`;
  assert.ok((await entryImpact(queue, 1, snapshot)).length > 0, "known positive");
  for (const [call, name] of [[entryImpact, "entryImpact"], [entryView, "entryView"]]) {
    await assert.rejects(call(queue, 7, snapshot), (error) => error instanceof RangeError && error.message.startsWith(name) && /entry 7/.test(error.message), `${name}: entry 7`);
    await assert.rejects(call("docs/spec-freigaben/2026-01-01_none", 1, snapshot), (error) => error instanceof RangeError && error.message.startsWith(name) && /2026-01-01_none/.test(error.message), `${name}: queue`);
  }
});

// ---------------------------------------------------------------- the page

const statusRows = (target) => find(target, (node) => node.localName === "tr" && find(node, (cell) => cell.className === "requirement-status").length === 1)
  .map((row) => [find(row, (node) => node.localName === "button")[0]?.textContent ?? row.firstChild.firstChild.textContent, find(row, (node) => node.className === "requirement-status")[0].textContent]);

async function renderSpec(host) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { host } }, { key: "specification", ref: "main" });
  return target;
}

// Four queues, each with a rationale: 2026-05-01_a withdraws A WITHDRAWN RULE; 2026-05-02_b adds AN ADDED RULE; 2026-05-03_c changes A LATER RULE (section 2);
// 2026-05-04_d changes A KEPT RULE (section 1) but its proposal cannot be read.
const WITHDRAWS = text("## 1. First", "", ...rule(KEEP, "Kept as it is."), ...rule(EDIT, "Edited text."));
const ADDS_PLUS = text("## 1. First", "", ...rule(KEEP, "Kept as it is."), ...rule(EDIT, "Edited text."), ...rule(GONE, "To be withdrawn."), ...rule(PLUS, "Added text."));
const CHANGES_LATER = text("## 2. Second", "", ...rule(LATER, "A rule of the second section, changed."));
const CHANGES_KEPT = text("## 1. First", "", ...rule(KEEP, "Kept, but changed."), ...rule(EDIT, "Edited text."), ...rule(GONE, "To be withdrawn."));
const PAGE_FILES = { ...BASE_FILES,
  ...queueFiles("2026-05-01_a", "## 1. First", WITHDRAWS), ...queueFiles("2026-05-02_b", "## 1. First", ADDS_PLUS),
  ...queueFiles("2026-05-03_c", "## 2. Second", CHANGES_LATER), ...queueFiles("2026-05-04_d", "## 1. First", CHANGES_KEPT) };
const proposalOf = (folder) => `docs/spec-freigaben/${folder}/01-entry.md`;

// TST-1274305 · level: release · module: MOD-trace-pages
// guards: UC-020; OPEN PROPOSALS ARE SHOWN IN THE BROWSER
// given: the product with four waiting entries — a withdraws A WITHDRAWN RULE; b adds AN ADDED RULE; c changes A LATER RULE of section 2; d changes A KEPT RULE but its proposal cannot be read (the Host fails the read) — each queue with a rationale in the tree; known positive first — with d readable the kept rule is marked change proposed
// input: the route trace/specification rendered at main
// expect: A KEPT RULE in SPEC (d's proposal is lost, the page is not), A WITHDRAWN RULE removal proposed, AN EDITED RULE in SPEC, A LATER RULE change proposed, AN ADDED RULE proposed; a path ending in .begruendung.md stands in one readMany of each render only (queues' one batch for the entries' issues, MOD-spec-changes Queue) and every read of one is of a path that batch named
// Planted fault: a page that names the rationales to a second readMany, or reads one that queues' batch did not name, fails the rationale assertions; a page that lets one unreadable proposal fail the whole overview fails the marks.
test("TST-1274305 the specification marks what four waiting entries do, from their proposals alone, whatever one proposal's read does", async () => {
  const readable = treeHost({ trees: { main: PAGE_FILES } });
  const known = Object.fromEntries(statusRows(await renderSpec(readable)));
  assert.equal(known[KEEP], "change proposed", "known positive: d's proposal, read, marks the kept rule");

  const host = treeHost({ trees: { main: PAGE_FILES }, failing: (path) => path === proposalOf("2026-05-04_d") });
  const marks = Object.fromEntries(statusRows(await renderSpec(host)));
  assert.deepEqual(marks, { [KEEP]: "in SPEC", [EDIT]: "in SPEC", [GONE]: "removal proposed", [LATER]: "change proposed", [PLUS]: "proposed" });
  const rationales = (log) => ({ batches: log.manys.filter((paths) => paths.some(isRationale)), reads: log.reads.filter(isRationale) });
  for (const [what, log] of [["readable", readable.log], ["unreadable", host.log]]) {
    const { batches, reads } = rationales(log);
    assert.equal(batches.length, 1, `${what}: the rationales are named in queues' one batch, and in no other`);
    assert.deepEqual(batches[0].filter(isRationale).sort(), ["2026-05-01_a", "2026-05-02_b", "2026-05-03_c", "2026-05-04_d"].map((folder) => `docs/spec-freigaben/${folder}/01-entry.begruendung.md`), `${what}: the batch names each entry's rationale`);
    assert.deepEqual(reads.filter((path) => !batches[0].includes(path)), [], `${what}: no rationale is read beyond that batch`);
  }
});
