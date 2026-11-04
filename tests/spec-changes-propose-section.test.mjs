// A SPEC edit saved as an entry of its section's queue — MOD-spec-changes' `proposeSection`, as docs/architecture/MOD-spec-changes.md states it: proposeSection writes one commit: the
// entry, its rationale — the change, the Why, the impact list, the origin — and its index row, into its section's queue docs/spec-freigaben/<package>/, or the queue started with entry 01,
// `trailers` ending the commit's message; an entry's number is one more than any the queue's index or decisions name; a second edit of the same section adds another entry; a rename is
// proposed as the old name withdrawn and the new one added; the target is never touched; when the section changed meanwhile it refuses and returns the newer text; `alsoReplacing` names
// other open entries that replace the same section; without a token on GitHub it writes nothing and returns GitHub's pages for each file of the entry, each page's `differs` saying whether
// its file exists on the default branch otherwise than at `openedHead`, the commit the edit was opened on; on GitLab it fails with TokenRequired.
// Run: node --test tests/spec-changes-propose-section.test.mjs
//
// Module: MOD-spec-changes
// Guards: UC-018
// Guards: A SPEC EDIT IS SAVED AS A PROPOSAL; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT
// Guards: A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN
// Level: unit
//
// The repository is a fixture this file builds, never Agent M's own: a SPEC of two sections, a use case that realises one requirement, and queues of its sections,
// as a snapshot (paths, blob SHAs, a read of the texts) beside a host that answers repositoryInfo and readSnapshot and records every commit. The host's token is
// `canWrite`. Where the module file leaves a reading open, the test states the reading it takes, and the pull request names it:
//   - The queue of a section is the folder `docs/spec-freigaben/<package>/` (MOD-spec-changes, Data): `reading` for `## 1. Reading`, `fixture-specification` for the preamble, whose anchor is
//     the title line `# Fixture — Specification`; the folder given back is that path, as Queue.folder is.
//   - The section's blob is the git blob SHA of the section's exact bytes (MOD-spec-document's sectionText), as the approval records name it; `current` of a refusal is that section's text.
//   - A host with no token is one whose repositoryInfo says `canWrite: false`; the server is the snapshot's repository.server.
//   - The files of an entry are the queue's index (and, in a new queue, entscheidungen.md), its proposal and its rationale; the fallback gives one page for each, existing or new.
//   - The commit the edit was opened on is OPENED. The host answers readSnapshot(OPENED) with the repository as it stood then (`opened`: the paths it lacked and the paths it had besides),
//     readSnapshot("main") with the default branch now, and records every ref it was asked for in `reads`.
// A name the module does not provide yet fails each test by itself. The counter-proofs are in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as specChanges from "../src/spec-changes/index.mjs";
import { documentFindings, loadSchema, readDocument } from "../src/documents/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

const { proposeSection, queues, entryView } = specChanges;

const text = (...lines) => `${lines.join("\n")}\n`;
const gitBlob = (body) => { const bytes = Buffer.from(body, "utf8"); return createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex"); };

const READING = text("## 1. Reading", "", "**A SAMPLE RULE** *(Product Owner)*", "A reader reads a file whole.", "*Check:* `tests/sample.test.mjs`", "",
  "**ANOTHER SAMPLE RULE** *(Product Owner)*", "A reader sees the name of a file.", "*Check:* no automatic check; at review", "");
const WRITING = text("## 2. Writing", "", "**A WRITE RULE** *(Product Owner)*", "A writer writes a file whole.", "*Check:* no automatic check; at review");
const PREAMBLE = text("# Fixture — Specification", "");
const SPEC = PREAMBLE + READING + WRITING;
const useCase = text("---", "id: UC-001", "title: Read a file", "area: reading", "actors:", "  - Reader", "realises:", "  - A SAMPLE RULE", "---", "# UC-001 Read a file", "", "**Goal.** Read a file.");
const READING_EDITED = READING.replace("A reader reads a file whole.", "A reader reads a file whole, or says why not.");
const READING_RENAMED = READING.replace("**A SAMPLE RULE**", "**A READING RULE**");

const indexOf = (folder, heading, rows) => text(`# SPEC approvals — queue ${folder} · ${heading}`, "", "**Zieldatei aller Einträge:** `SPEC.md`", "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
  ...rows.map(([n, anchor]) => `| ${String(n).padStart(2, "0")} | \`SPEC.md\` | ${anchor} | — | — |`));

// A queue's files: its index, its decisions, an entry for each anchor with its proposal; `inSpec` the numbers a decision row names, `decidedOnly` numbers a decision row names that the
// index no longer lists.
function queueFiles(folder, anchors, { inSpec = [], decidedOnly = [] } = {}) {
  const base = `docs/spec-freigaben/${folder}`;
  const rows = anchors.map((anchor, at) => [at + 1, anchor]);
  const files = { [`${base}/index.md`]: indexOf(folder, "an earlier edit", rows),
    [`${base}/entscheidungen.md`]: text("# Decisions — queue " + folder, "", "Append-only.", ...[...inSpec, ...decidedOnly].map((n) => `| 2026-10-12 10:00 UTC | ${n} | uebernommen | approval:spec-${folder}-0${n}-aaaaaaaaaaaa.md |`)) };
  rows.forEach(([number, anchor]) => {
    const n = String(number).padStart(2, "0");
    files[`${base}/${n}-${folder}.md`] = anchor.includes("Reading") ? READING_EDITED : WRITING.replace("writes a file whole", "writes a file whole, or says why not");
    files[`${base}/${n}-${folder}.begruendung.md`] = "# an earlier rationale\n";
  });
  return files;
}

const OPENED = "o".repeat(40);
// `stored` false: the head's graph is not stored yet, as for the head a job has just committed on.
function repository({ files = {}, canWrite = true, server = "github", opened = {}, refuse = null, stored = true } = {}) {
  const all = { "SPEC.md": SPEC, "docs/use-cases/UC-001-read-a-file.md": useCase, ...files };
  const commits = [];
  const web = server === "github" ? "https://github.com/alice/product" : "https://gitlab.example.test/alice/product";
  // The snapshot of the default branch, whose graph is stored on trace-cache as the workflow "main changed" stores it (tests/stored-graph-fake.mjs).
  const snapshot = (stored ? withStoredGraph : (bare) => bare)({ repository: { server, origin: server === "github" ? "https://github.com" : "https://gitlab.example.test", path: "alice/product", web }, ref: "main", commit: (stored ? "h" : "u").repeat(40),
    paths: Object.keys(all), blob: (path) => (Object.hasOwn(all, path) ? gitBlob(all[path]) : null), read: async (path) => (Object.hasOwn(all, path) ? all[path] : null) });
  const reads = [];
  const began = { ...snapshot, ref: OPENED, commit: OPENED, paths: [...Object.keys(all).filter((path) => !(opened.lacking ?? []).includes(path)), ...(opened.extra ?? [])] };
  const host = { commits, reads,
    repositoryInfo: async () => ({ defaultBranch: "main", visibility: "private", canWrite, archived: false, description: "" }),
    readSnapshot: async (ref) => { reads.push(ref); return ref === OPENED ? began : snapshot; },
    // `refuse`: the name of the failure the server answers a commit with ("PermissionMissing": the token may not write); nothing is committed then.
    commitFiles: async (change) => { if (refuse) throw Object.assign(new Error(`the server refused the commit: ${refuse}`), { name: refuse }); commits.push(change); return { commit: "i".repeat(40), url: "https://example.test/commit" }; } };
  return { host, snapshot, commits, all };
}
const CHANGE = { target: "SPEC.md", anchor: "## 1. Reading", until: null, text: READING_EDITED, why: "A reader needs to know why a file cannot be read.", origin: "an issue of a reader",
  person: "alice", openedBlob: gitBlob(READING), openedHead: OPENED };
const written = (commit) => Object.fromEntries(commit.files.map((file) => [file.path, file.text]));
const schemaText = readFileSync(new URL("../src/spec-changes/queue-rationale.schema.md", import.meta.url), "utf8");


const READING_QUEUE = "docs/spec-freigaben/reading";

// TST-1397002 · level: unit · module: MOD-spec-changes
// guards: A SPEC EDIT IS SAVED AS A PROPOSAL; THE NAME IS THE ID AND IT SURVIVES; UC-018
// given: the queue `reading`, whose index lists entry 01 and whose decisions name entry 01 and entry 03, which has left the index
// input: proposeSection of an edit of the section Reading
// expect: the new entry is 04, one more than any number the index or the decisions name: 04-reading.md and its rationale, and the index row `| 04 |`; known positive: without the decision of 03 it is 02
test("proposeSection — a new entry's number is one more than any its queue's index or decisions name", async () => {
  const f = repository({ files: queueFiles("reading", ["## 1. Reading"], { inSpec: [1], decidedOnly: [3] }) });
  const result = await proposeSection(f.host, CHANGE);
  assert.deepEqual([result.queue, result.entry], [READING_QUEUE, 4]);
  const out = written(f.commits[0]);
  assert.deepEqual(Object.keys(out).sort(), [`${READING_QUEUE}/04-reading.begruendung.md`, `${READING_QUEUE}/04-reading.md`, `${READING_QUEUE}/index.md`]);
  assert.match(out[`${READING_QUEUE}/index.md`], /\| 04 \| `SPEC\.md` \| ## 1\. Reading \| — \| — \|\n$/);
  const g = repository({ files: queueFiles("reading", ["## 1. Reading"], { inSpec: [1] }) });
  assert.equal((await proposeSection(g.host, CHANGE)).entry, 2, "known positive: without the decision of 03");
});

// TST-472984 · level: unit · module: MOD-spec-changes
// guards: A SPEC EDIT IS SAVED AS A PROPOSAL; UC-018
// given: no queue of the section Reading
// input: proposeSection of an edit of the section Reading
// expect: one commit on the default branch at the head read, starting the section's queue docs/spec-freigaben/reading — index.md titled `# SPEC approvals — queue reading · Reading`, entscheidungen.md titled `# Decisions — queue reading Reading`, the entry 01-reading.md with the section as edited, its rationale — and nothing else; the index's row for the entry; the SPEC untouched; the result names the commit, the queue, the entry 1 and no other entry it replaces
test("proposeSection — an edit of a section with no queue is one commit starting the section's queue with entry 01", async () => {
  assert.ok(proposeSection, "proposeSection is offered");
  const f = repository();
  const result = await proposeSection(f.host, CHANGE);
  assert.equal(f.commits.length, 1);
  const files = written(f.commits[0]);
  const folder = READING_QUEUE;
  assert.deepEqual(Object.keys(files).sort(), [`${folder}/01-reading.begruendung.md`, `${folder}/01-reading.md`, `${folder}/entscheidungen.md`, `${folder}/index.md`]);
  assert.equal(files[`${folder}/01-reading.md`], READING_EDITED);
  assert.match(files[`${folder}/index.md`], /^# SPEC approvals — queue reading · Reading\n/);
  assert.match(files[`${folder}/index.md`], /\*\*Zieldatei aller Einträge:\*\* `SPEC\.md`/);
  assert.match(files[`${folder}/index.md`], /\| 01 \| `SPEC\.md` \| ## 1\. Reading \| — \| — \|/);
  assert.equal(files[`${folder}/entscheidungen.md`], "# Decisions — queue reading Reading\n\nAppend-only.\n");
  assert.deepEqual([f.commits[0].branch, f.commits[0].expectedHead], ["main", "h".repeat(40)]);
  assert.deepEqual(result, { commit: "i".repeat(40), queue: folder, entry: 1, alsoReplacing: [] });
  assert.ok(!Object.keys(files).includes("SPEC.md"), "the target is not touched");
});

// TST-472985 · level: unit · module: MOD-spec-changes
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; A SPEC EDIT IS SAVED AS A PROPOSAL; UC-018
// given: the edit of A SAMPLE RULE, which UC-001 realises
// input: proposeSection; then the written queue read back through queues and entryView
// expect: the rationale in the schema queue-rationale without a finding: the title `# 1. Reading: …`, the change, the Why as given, the impact list naming A SAMPLE RULE changed and UC-001, the origin as given with the person; read back, the queue is found with the entry open and the section that holds now beside the proposal, the same impact
test("proposeSection — the rationale holds the change, the Why, the impact list and the origin, and the queue reads back open", async () => {
  const f = repository();
  await proposeSection(f.host, CHANGE);
  const files = written(f.commits[0]);
  const folder = READING_QUEUE;
  const rationale = files[`${folder}/01-reading.begruendung.md`];
  const schema = loadSchema(schemaText, "MOD-spec-changes");
  assert.deepEqual(documentFindings(schema, readDocument(schema, `${folder}/01-reading.begruendung.md`, rationale)), []);
  assert.match(rationale, /^# 1\. Reading: .*A SAMPLE RULE/);
  for (const label of ["**The change.**", "**Why.**", "**Impact list.**", "**Origin.**"]) assert.ok(rationale.includes(label), label);
  assert.ok(rationale.includes("A reader needs to know why a file cannot be read."));
  assert.match(rationale, /\*\*Impact list\.\*\*[\s\S]*A SAMPLE RULE[\s\S]*changed[\s\S]*UC-001/);
  assert.match(rationale, /\*\*Origin\.\*\*[\s\S]*an issue of a reader[\s\S]*alice/);
  const after = repository({ files: files });
  const all = await queues(after.snapshot);
  const queue = all.find((each) => each.folder === folder);
  assert.deepEqual(queue.entries.map((entry) => [entry.number, entry.anchor, entry.state]), [[1, "## 1. Reading", "open"]]);
  const view = await entryView(folder, 1, after.snapshot);
  assert.equal(view.current.text, READING);
  assert.equal(view.proposal.text, READING_EDITED);
  assert.deepEqual(view.impact.map((item) => [item.name, item.change, item.referencedBy]), [["A SAMPLE RULE", "changed", ["UC-001"]]]);
});

// TST-472986 · level: unit · module: MOD-spec-changes
// guards: A SPEC EDIT IS SAVED AS A PROPOSAL; UC-018
// given: the queue `writing` of the section Writing, with an open entry
// input: proposeSection of an edit of the section Reading
// expect: the edit starts the queue `reading`; nothing of the queue `writing` is written; the result names docs/spec-freigaben/reading and entry 1
test("proposeSection — an edit of another section goes to that section's queue, not to another queue", async () => {
  const files = queueFiles("writing", ["## 2. Writing"]);
  const f = repository({ files });
  const result = await proposeSection(f.host, CHANGE);
  assert.deepEqual(result, { commit: "i".repeat(40), queue: READING_QUEUE, entry: 1, alsoReplacing: [] });
  const out = written(f.commits[0]);
  assert.ok(Object.keys(out).every((path) => path.startsWith(`${READING_QUEUE}/`)), Object.keys(out).join(" "));
});

// TST-472987 · level: unit · module: MOD-spec-changes
// guards: A SPEC EDIT IS SAVED AS A PROPOSAL; UC-018
// given: the queue `reading`, whose open entry 01 edits Reading, and a second edit of Reading
// input: proposeSection
// expect: entry 02 and its rationale added to that queue in one commit, its index row appended to the index with every other byte of it as it was; entry 01's files untouched; the result names entry 2 and alsoReplacing entry 1
test("proposeSection — a second edit of a section adds another entry to the section's queue", async () => {
  const files = queueFiles("reading", ["## 1. Reading"]);
  const f = repository({ files });
  const again = READING.replace("A reader reads a file whole.", "A reader reads a file whole and says why not.");
  const result = await proposeSection(f.host, { ...CHANGE, text: again });
  assert.deepEqual(result, { commit: "i".repeat(40), queue: READING_QUEUE, entry: 2, alsoReplacing: [{ queue: READING_QUEUE, entry: 1 }] });
  const out = written(f.commits[0]);
  assert.deepEqual(Object.keys(out).sort(), [`${READING_QUEUE}/02-reading.begruendung.md`, `${READING_QUEUE}/02-reading.md`, `${READING_QUEUE}/index.md`]);
  assert.equal(out[`${READING_QUEUE}/index.md`], files[`${READING_QUEUE}/index.md`] + "| 02 | `SPEC.md` | ## 1. Reading | — | — |\n");
  assert.equal(out[`${READING_QUEUE}/02-reading.md`], again);
});

// TST-472988 · level: unit · module: MOD-spec-changes
// guards: A RENAMED REQUIREMENT IS WITHDRAWN AND ADDED; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; UC-018
// given: an edit that renames A SAMPLE RULE to A READING RULE
// input: proposeSection; and the entry read back
// expect: the rationale's impact list names A SAMPLE RULE withdrawn, with UC-001, and A READING RULE added; the entry read back lists the same two names, not one name changed
test("proposeSection — a rename is proposed as the old name withdrawn and the new one added", async () => {
  const f = repository();
  await proposeSection(f.host, { ...CHANGE, text: READING_RENAMED });
  const files = written(f.commits[0]);
  const folder = READING_QUEUE;
  const impact = files[`${folder}/01-reading.begruendung.md`].split("**Impact list.**")[1].split("**Origin.**")[0];
  assert.match(impact, /A SAMPLE RULE[^\n]*withdrawn[^\n]*UC-001/);
  assert.match(impact, /A READING RULE[^\n]*added/);
  assert.doesNotMatch(impact, /A SAMPLE RULE[^\n]*changed/);
  const view = await entryView(folder, 1, repository({ files }).snapshot);
  assert.deepEqual(view.impact.map((item) => [item.name, item.change]), [["A SAMPLE RULE", "withdrawn"], ["A READING RULE", "added"]]);
});

// TST-472989 · level: unit · module: MOD-spec-changes
// guards: A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT; UC-018
// given: an edit opened on a blob that is no longer the section's; and, to show the call writing, the same edit on the section's blob
// input: proposeSection
// expect: the refusal `changed meanwhile` with the section's text as it is now, and no commit; the same edit on the right blob is written
test("proposeSection — a section that changed meanwhile is refused with its newer text", async () => {
  const f = repository();
  assert.equal((await proposeSection(f.host, CHANGE)).entry, 1, "known positive: on the section's blob");
  const g = repository();
  const refused = await proposeSection(g.host, { ...CHANGE, openedBlob: gitBlob("an older section\n") });
  assert.deepEqual(refused, { refused: "changed meanwhile", current: READING });
  assert.deepEqual(g.commits, []);
});

// TST-472990 · level: unit · module: MOD-spec-changes
// guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; UC-019
// given: an edit with a job's provenance lines as trailers, and one of a person's own with none
// input: proposeSection
// expect: the message of the first ends, after a blank line, with the lines as given; the second's message holds none; the files hold none of them
test("proposeSection — the trailers end the commit's message, and a person's own edit has none", async () => {
  const f = repository();
  const trailers = ["Agent-M-Version: unreleased, commit " + "c".repeat(40), "Agent-M-Job: JOB-1", "Agent-M-Kind: change-requirements"];
  await proposeSection(f.host, { ...CHANGE, trailers });
  assert.ok(f.commits[0].message.endsWith(`\n\n${trailers.join("\n")}`));
  assert.ok(!Object.values(written(f.commits[0])).some((body) => body.includes("Agent-M-Job")));
  const g = repository();
  await proposeSection(g.host, CHANGE);
  assert.ok(!g.commits[0].message.includes("Agent-M-"));
});

// TST-472991 · level: unit · module: MOD-spec-changes
// guards: A SPEC EDIT IS SAVED AS A PROPOSAL; UC-018
// given: other entries that replace Reading: in the queue `reading` entry 01 open and entry 02 in SPEC; in a queue of another name, `2026-10-01_bobs`, entry 01 open; and the queue `writing` open
// input: proposeSection of an edit of Reading
// expect: the edit is entry 03 of the queue `reading`; alsoReplacing names the open entry 01 of `reading` and of `2026-10-01_bobs`, in the order of the queues' folders; an entry in SPEC and an entry of another section are not named; only files of `reading` are written
test("proposeSection — other open entries that replace the same section are named", async () => {
  const bobs = "2026-10-01_bobs";
  const files = { ...queueFiles("reading", ["## 1. Reading", "## 1. Reading"], { inSpec: [2] }), ...queueFiles(bobs, ["## 1. Reading"]), ...queueFiles("writing", ["## 2. Writing"]) };
  const f = repository({ files });
  const result = await proposeSection(f.host, CHANGE);
  assert.deepEqual([result.queue, result.entry], [READING_QUEUE, 3]);
  assert.deepEqual(result.alsoReplacing, [{ queue: `docs/spec-freigaben/${bobs}`, entry: 1 }, { queue: READING_QUEUE, entry: 1 }]);
  assert.ok(Object.keys(written(f.commits[0])).every((path) => path.startsWith(`${READING_QUEUE}/`)));
});

// TST-1397003 · level: unit · module: MOD-spec-changes
// guards: A SPEC EDIT IS SAVED AS A PROPOSAL; UC-018
// given: the SPEC's preamble, from its title line `# Fixture — Specification` up to `## 1. Reading`, and no queue
// input: proposeSection of an edit of the preamble, anchor the title line, until `## 1. Reading`
// expect: the queue of the preamble is named after the title: docs/spec-freigaben/fixture-specification, its index titled `# SPEC approvals — queue fixture-specification · Fixture — Specification` and its row naming the until; the entry 01-fixture-specification.md
test("proposeSection — the preamble's queue is named after the SPEC's title", async () => {
  const f = repository();
  const edited = text("# Fixture — Specification", "", "The fixture's SPEC.", "");
  const result = await proposeSection(f.host, { ...CHANGE, anchor: "# Fixture — Specification", until: "## 1. Reading", text: edited, openedBlob: gitBlob(PREAMBLE) });
  const folder = "docs/spec-freigaben/fixture-specification";
  assert.deepEqual([result.queue, result.entry], [folder, 1]);
  const out = written(f.commits[0]);
  assert.match(out[`${folder}/index.md`], /^# SPEC approvals — queue fixture-specification · Fixture — Specification\n/);
  assert.match(out[`${folder}/index.md`], /\| 01 \| `SPEC\.md` \| # Fixture — Specification \| ## 1\. Reading \| — \|/);
  assert.equal(out[`${folder}/01-fixture-specification.md`], edited);
});

// TST-472992 · level: unit · module: MOD-spec-changes
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; UC-018
// given: a GitHub product and a host with no token (canWrite false)
// input: proposeSection
// expect: nothing written; the pages of GitHub's web interface for each file of the entry — the new-file page for each, as the queue is new —, each with its path in the address and its text beside it, never in it
test("proposeSection — without a token on GitHub it writes nothing and returns GitHub's pages", async () => {
  const f = repository({ canWrite: false });
  const result = await proposeSection(f.host, CHANGE);
  assert.deepEqual(f.commits, []);
  const folder = READING_QUEUE;
  assert.deepEqual(result.fallback.map((page) => page.path).sort(), [`${folder}/01-reading.begruendung.md`, `${folder}/01-reading.md`, `${folder}/entscheidungen.md`, `${folder}/index.md`]);
  for (const page of result.fallback) {
    assert.match(page.url, /^https:\/\/github\.com\/alice\/product\/new\//);
    assert.ok(page.url.includes(encodeURIComponent(page.path)) || page.url.includes(page.path), "the path is in the address");
    assert.ok(!page.url.includes("reads a file whole"), "the text is not");
    assert.equal(page.differs, false);
  }
  assert.equal(result.fallback.find((page) => page.path.endsWith("01-reading.md")).text, READING_EDITED);
});

// TST-472993 · level: unit · module: MOD-spec-changes
// guards: A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; UC-018
// given: a GitLab product and a host with no token
// input: proposeSection
// expect: TokenRequired, and nothing written; with a token the same edit is written
test("proposeSection — without a token on GitLab it fails with TokenRequired", async () => {
  const g = repository({ server: "gitlab" });
  assert.equal((await proposeSection(g.host, CHANGE)).entry, 1, "known positive: with a token");
  const f = repository({ server: "gitlab", canWrite: false });
  await assert.rejects(proposeSection(f.host, CHANGE), (error) => error.name === "TokenRequired");
  assert.deepEqual(f.commits, []);
});

// TST-611001 · level: unit · module: MOD-spec-changes
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; UC-018
// given: a GitHub product, a host with no token, the queue `reading` holding entry 01 for Reading, and a second edit of Reading, which adds entry 02; the queue's index did not exist on the default branch at OPENED
// input: proposeSection
// expect: three pages in the order index, proposal, rationale; the index's page is GitHub's new-file page and differs is true — it exists now, and did not when the edit began; the proposal's and the rationale's are new-file pages and differs is false
test("proposeSection — without a token a file that appeared on the default branch since the edit began is marked as differing", async () => {
  const base = READING_QUEUE;
  const f = repository({ files: queueFiles("reading", ["## 1. Reading"]), canWrite: false, opened: { lacking: [`${base}/index.md`] } });
  const result = await proposeSection(f.host, CHANGE);
  assert.deepEqual(f.commits, []);
  assert.deepEqual(result.fallback.map((page) => [page.path, page.url.split("/").slice(3, 6).join("/"), page.differs]),
    [[`${base}/index.md`, "alice/product/new", true], [`${base}/02-reading.md`, "alice/product/new", false], [`${base}/02-reading.begruendung.md`, "alice/product/new", false]]);
});

// TST-611002 · level: unit · module: MOD-spec-changes
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; UC-018
// given: a GitHub product, a host with no token and no queue of the section; at OPENED the repository held the index of the queue the edit now starts, which the default branch no longer holds
// input: proposeSection
// expect: four pages; the index's is GitHub's editor, since the file existed when the edit began, and differs is true; the other three are new-file pages and differs is false
test("proposeSection — without a token a file that disappeared from the default branch since the edit began is marked as differing", async () => {
  const folder = READING_QUEUE;
  const f = repository({ canWrite: false, opened: { extra: [`${folder}/index.md`] } });
  const result = await proposeSection(f.host, CHANGE);
  assert.deepEqual(result.fallback.map((page) => [page.path.replace(folder, "<queue>"), page.url.split("/").slice(3, 6).join("/"), page.differs]).sort(),
    [["<queue>/01-reading.begruendung.md", "alice/product/new", false], ["<queue>/01-reading.md", "alice/product/new", false],
      ["<queue>/entscheidungen.md", "alice/product/new", false], ["<queue>/index.md", "alice/product/edit", true]]);
});

// TST-611003 · level: unit · module: MOD-spec-changes
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; UC-018
// given: the same edit saved by a host with no token and by one with a token
// input: proposeSection
// expect: the refs the host was asked to read are ["main", OPENED] without a token and ["main"] with one: the repository at OPENED is read only to build GitHub's pages
test("proposeSection — the repository at the commit the edit was opened on is read only without a token", async () => {
  const without = repository({ canWrite: false });
  await proposeSection(without.host, CHANGE);
  assert.deepEqual(without.host.reads, ["main", OPENED]);
  const withToken = repository();
  await proposeSection(withToken.host, CHANGE);
  assert.deepEqual(withToken.host.reads, ["main"]);
});

// TST-611013 · level: unit · module: MOD-spec-changes
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; UC-018
// given: the setting of TST-611001 (a second edit of Reading, whose queue's index OPENED lacked), but the edit was opened on the commit of the snapshot the save reads, "h" repeated forty times
// input: proposeSection without a token
// expect: only "main" is read; the files are taken as that snapshot holds them, so the index's page is GitHub's editor and differs is false for all three, though OPENED lacked the index
test("proposeSection — an edit opened on the commit the save already read reads no other snapshot", async () => {
  const base = READING_QUEUE;
  const f = repository({ files: queueFiles("reading", ["## 1. Reading"]), canWrite: false, opened: { lacking: [`${base}/index.md`] } });
  const result = await proposeSection(f.host, { ...CHANGE, openedHead: "h".repeat(40) });
  assert.deepEqual(f.host.reads, ["main"]);
  assert.deepEqual(result.fallback.map((page) => [page.path, page.url.split("/").slice(3, 6).join("/"), page.differs]),
    [[`${base}/index.md`, "alice/product/edit", false], [`${base}/02-reading.md`, "alice/product/new", false], [`${base}/02-reading.begruendung.md`, "alice/product/new", false]]);
});

// TST-611014 · level: unit · module: MOD-spec-changes
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; UC-018
// given: the setting of TST-611001, but the edit was opened on no commit (null, an empty repository)
// input: proposeSection without a token
// expect: only "main" is read; no file existed when the edit began, so all three pages are GitHub's new-file pages, and differs is true for the index, which exists now, and false for the new entry's files
test("proposeSection — an edit opened on no commit holds no file and reads no snapshot for it", async () => {
  const base = READING_QUEUE;
  const f = repository({ files: queueFiles("reading", ["## 1. Reading"]), canWrite: false });
  const result = await proposeSection(f.host, { ...CHANGE, openedHead: null });
  assert.deepEqual(f.host.reads, ["main"]);
  assert.deepEqual(result.fallback.map((page) => [page.path, page.url.split("/").slice(3, 6).join("/"), page.differs]),
    [[`${base}/index.md`, "alice/product/new", true], [`${base}/02-reading.md`, "alice/product/new", false], [`${base}/02-reading.begruendung.md`, "alice/product/new", false]]);
});

// TST-593001 · level: unit · module: MOD-spec-changes
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; UC-018
// given: a GitHub product and a host whose token may write as far as repositoryInfo knows (canWrite true), but whose server refuses the commit with PermissionMissing; and the same product with a host with no token
// input: proposeSection of the same edit to each
// expect: the refused one writes nothing and returns the pages GitHub's web interface offers for each file of the entry, the same as the one with no token returns (paths, addresses, texts, differs)
test("proposeSection — when GitHub refuses the commit for a missing write permission it writes nothing and returns GitHub's pages", async () => {
  const refused = repository({ refuse: "PermissionMissing" });
  const result = await proposeSection(refused.host, CHANGE);
  assert.deepEqual(refused.commits, []);
  assert.ok(Array.isArray(result.fallback) && result.fallback.length === 4, JSON.stringify(result));
  const tokenless = await proposeSection(repository({ canWrite: false }).host, CHANGE);
  assert.deepEqual(result, tokenless);
});

// TST-593002 · level: unit · module: MOD-spec-changes
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; UC-018
// given: a GitLab product whose server refuses the commit with PermissionMissing, which has no fallback; and a GitHub product whose server refuses it with TokenRefused
// input: proposeSection of the edit to each
// expect: the GitLab one throws PermissionMissing; the GitHub one throws TokenRefused — only a missing write permission is answered with the pages —; nothing is written by either
test("proposeSection — a refused commit on GitLab, and any other refusal on GitHub, are thrown as they were", async () => {
  const gitlab = repository({ server: "gitlab", refuse: "PermissionMissing" });
  await assert.rejects(proposeSection(gitlab.host, CHANGE), { name: "PermissionMissing" });
  const github = repository({ refuse: "TokenRefused" });
  await assert.rejects(proposeSection(github.host, CHANGE), { name: "TokenRefused" });
  assert.deepEqual([...gitlab.commits, ...github.commits], []);
});

// TST-1406003 · level: unit · module: MOD-spec-changes
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; AN AGENT'S RETROSPECTIVE CHANGES NO PROCESS BY ITSELF; UC-041
// given: the fixture repository whose head has no stored trace graph, as the head a job has just committed on; UC-001 realises A SAMPLE RULE
// input: proposeSection of the section Reading with A SAMPLE RULE changed and the requirement A NEW READING RULE ("A reader keeps a file open.") appended — a requirement added, as a retrospective's change is
// expect: one commit of the queue reading, with no failure for the missing graph; its rationale's impact list names A SAMPLE RULE changed and named by UC-001, and A NEW READING RULE added and named by nothing; known positive: the same edit over the head with its graph stored gives the same impact list
test("proposeSection — where no trace graph is stored for the head it reads, it builds the graph for the impact list", async () => {
  const edit = { ...CHANGE, text: `${READING_EDITED}\n**A NEW READING RULE** *(Product Owner)*\nA reader keeps a file open.\n*Check:* no automatic check; at review\n` };
  const impactOf = (rationale) => /\*\*Impact list\.\*\*\n([\s\S]*?)\n\n/.exec(rationale)?.[1] ?? "";
  const bare = repository({ stored: false });
  await proposeSection(bare.host, edit);
  assert.equal(bare.commits.length, 1);
  const built = impactOf(written(bare.commits[0])[`${READING_QUEUE}/01-reading.begruendung.md`]);
  assert.match(built, /A SAMPLE RULE: changed; named by UC-001\./);
  assert.match(built, /A NEW READING RULE: added; nothing names it\./);
  const stored = repository();
  await proposeSection(stored.host, edit);
  assert.equal(impactOf(written(stored.commits[0])[`${READING_QUEUE}/01-reading.begruendung.md`]), built, "known positive: the stored graph gives the same impact list");
});
