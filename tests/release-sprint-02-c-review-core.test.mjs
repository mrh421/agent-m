// Release tests of sprint 02, strand C — the approval engine: the gates ITM-014 characterised, the workflow's writer applyApproved, and the
// architecture's acceptance on the reader ITM-128 moved (ITM-144). Written by tester-opus (claude-opus-5-5), the Release tester of
// docs/process.md, who implemented none of the strand's items, from the SPEC rules and use cases they realise; started on
// sprint/02 at a7b4b9f, 2026-10-01.
//
// Module: MOD-approvals
// Guards: A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN; THE APPROVED TEXT IS TAKEN VERBATIM; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; THE REPLACED TEXT STAYS REACHABLE; A GENERATED ARTIFACT IS A PROPOSAL; A RECORD IS EVIDENCE, NOT A PROPOSAL; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE; A STALE APPROVAL IS NOT APPLIED; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; UC-006; UC-022
// Level: release
//
// Over a fixture repository written in this file — a made-up product's SPEC, one change queue, a use case, a decision, a module, and the
// link and register entry of the source its requirements name — held as a map of path to text. The dashboard's commit (MOD-approvals'
// acceptShown and MOD-spec-changes' acceptEntries, with a token, on the host of tests/memory-host.mjs) and the instance workflow's
// (MOD-spec-changes' applyApproved, without one) are both driven; the status is MOD-approvals' statuses and statusOf, an entry's state
// MOD-spec-changes' queues, and the text beside a proposal its entryView. Where git history is the evidence, the fixture is committed in
// a temporary git repository. Each expectation is stated before its case runs, from the rule or the use-case step it names.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { statuses, statusOf, acceptShown, acceptanceBlockers, approvalSchema } from "../src/approvals/index.mjs";
import { applyApproved, acceptEntries, entryView, queues } from "../src/spec-changes/index.mjs";
import { sectionText } from "../src/spec-document/index.mjs";
import { blobSha } from "../src/text-tools/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { sourceSchemas } from "../src/source-register/index.mjs";
import { memoryHost } from "./memory-host.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

const NOW = new Date("2026-10-01T09:30:00Z");

// ------------------------------------------------------------------------------------------------ the fixture repository

const req = (name, source, rule) => `**${name}** *(${source})*\n${rule}\n*Occasion:* reviewers print it.\n*Check:* \`tests/test_export.py\`\n`;
const SPEC = `# Thesis tool — Specification

**VERBINDLICH (SPEC)**

## 1. Export

${req("EXPORT IS A PDF", "PO B. Example, 2026-09-24", "The export is one PDF file.")}
## 2. Title page

${req("THE TITLE PAGE NAMES THE AUTHOR", "PO B. Example, 2026-09-24", "The title page names the author.")}
## 3. Old rules

**OLD EXPORT** *(PO B. Example, 2026-09-23 — withdrawn 2026-09-24)*
*Withdrawn:* replaced by \`EXPORT IS A PDF\`. The name is not reused.

## 4. Fonts

${req("THE BODY TEXT IS SERIF", "PO B. Example, 2026-09-24", "The body text is set in a serif font.")}`;
// Section 2 as the SPEC holds it, byte for byte: from its heading to the next heading of level two.
const SECTION_2 = `## 2. Title page\n\n${req("THE TITLE PAGE NAMES THE AUTHOR", "PO B. Example, 2026-09-24", "The title page names the author.")}\n`;

const QN = "2026-10-01_title-page", Q = `docs/spec-freigaben/${QN}`;
// Entry 01 rewrites section 2 — every kind of character the approval field may hold, a tab, trailing blanks, quotes, a dash,
// umlauts, a character outside the BMP — and creates the heading "## 5. Appendix", which entry 02 replaces. Entry 03 rewrites
// section 4.
const P01 = "## 2. Title page\n\n**THE TITLE PAGE NAMES THE AUTHOR AND THE SUPERVISOR** *(PO B. Example, 2026-10-01)*\n" +
  "The title page names the author — and „the supervisor“ — in that order.\t \n*Occasion:* Prüfungsamt 📄 asks for both.  \n" +
  "*Check:* `tests/test_title.py`\n\n## 5. Appendix\n\nTo be written.\n";
const P02 = "## 5. Appendix\n\nThe appendix lists the sources.\n";
const P03 = "## 4. Fonts\n\n" + req("THE BODY TEXT IS SANS", "PO B. Example, 2026-10-01", "The body text is set in a sans-serif font.");
const INDEX = `# SPEC approvals — queue ${QN} · title page\n\n**Zieldatei aller Einträge:** \`SPEC.md\`\n\n` +
  "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |\n|---|---|---|---|---|\n" +
  "| 01 | `SPEC.md` | ## 2. Title page | — | — |\n| 02 | `SPEC.md` | ## 5. Appendix | — | — |\n| 03 | `SPEC.md` | ## 4. Fonts | — | — |\n";
const DECISIONS = `# Decisions — queue ${QN}\n\nAppend-only.\n`;
const PROPOSALS = { 1: [`${Q}/01-title.md`, P01, "## 2. Title page"], 2: [`${Q}/02-appendix.md`, P02, "## 5. Appendix"],
  3: [`${Q}/03-fonts.md`, P03, "## 4. Fonts"] };

// The source the requirements name, linked by the product and registered (`A PRODUCT LINKS THE SOURCES THAT APPLY`).
const HASH = "b".repeat(64);
const LINKS = `# Sources\n\n| Source | Version | Hash | Part |\n|---|---|---|---|\n| SRC-po-b | 2026-09-24 | ${HASH} | |\n`;
const ENTRY = "---\nid: SRC-po-b\ntitle: PO B. Example\nkind: person\nauthority: normative\nlicence: fixture\nidentifier: fixture\n---\n" +
  "# SRC-po-b PO B. Example\n\nA fixture source.\n\n## Versions\n\n| Version | Date | Edition | Read from | Files |\n|---|---|---|---|---|\n" +
  `| \`2026-09-24\` | 2026-09-24 | fixture | fixture | version hash \`${HASH}\` |\n`;

const UC = "docs/use-cases/UC-001-export-the-thesis.md";
const UC_TEXT = "---\nid: UC-001\ntitle: Export the thesis\nrealises:\n  - EXPORT IS A PDF\n---\n# UC-001 Export the thesis\n";
const arcText = (forcedBy) => `---\nid: ARC-001\ntitle: Export through the browser's print\nforced_by:\n${forcedBy.map((n) => `  - ${n}\n`).join("")}---\n` +
  "# ARC-001\n\n## Context\n\nc\n\n## Decision\n\nd\n\n## Alternatives\n\na\n\n## Consequences\n\nq\n";
const ARC = "docs/architecture/ARC-001-export-through-print.md";
const MOD = "docs/architecture/MOD-exporter.md";
const MOD_TEXT = "---\nid: MOD-exporter\ntitle: Exporter\nrealises:\n  - EXPORT IS A PDF\nfollows:\n  - ARC-001\nuses: []\n" +
  "provides:\n  - exportPdf\n---\n# MOD-exporter\n\n## Responsibility\n\nr\n\n## Interfaces\n\n- `exportPdf(thesis) -> pdf` — x\n";

function fixture(extra = {}) {
  return new Map(Object.entries({
    "SPEC.md": SPEC, [`${Q}/index.md`]: INDEX, [`${Q}/entscheidungen.md`]: DECISIONS,
    ...Object.fromEntries(Object.values(PROPOSALS).map(([p, t]) => [p, t])),
    [UC]: UC_TEXT, [ARC]: arcText(["EXPORT IS A PDF", "UC-001"]), [MOD]: MOD_TEXT, "docs/approvals/README.md": "# Approvals\n",
    "docs/sources.md": LINKS, "docs/sources/SRC-po-b.md": ENTRY,
    ...extra,
  }));
}
const blob = blobSha;
const snapshotOf = (repo) => memoryHost(Object.fromEntries(repo)).host.readSnapshot("main");
const sources = () => ({ links: readDocument(sourceSchemas().links, "docs/sources.md", LINKS),
  register: [readDocument(sourceSchemas().entry, "docs/sources/SRC-po-b.md", ENTRY)] });

// The instance workflow's writer, MOD-spec-changes' applyApproved, on the fixture. -> { files: [{ path, content }], applied, refused }.
async function applyApprovals(repo) {
  const out = await applyApproved(await snapshotOf(repo), NOW);
  return { files: Object.entries(out.files).map(([path, content]) => ({ path, content })), applied: out.applied, refused: out.refused };
}

// What the dashboard shows of an entry and the reviewer accepts: the proposal's blob, and the blob of the section beside it as it holds
// now — "" where the SPEC does not hold the entry's heading yet.
async function shownEntry(repo, nr) {
  const [, proposalText, anchor] = PROPOSALS[nr];
  const section = sectionText(repo.get("SPEC.md"), anchor);
  return { queue: Q, entry: nr, proposalBlob: await blob(proposalText), sectionBlob: section === null ? "" : await blob(section) };
}
// The dashboard's acceptance commit of the entries `nrs`, made by `alice` -> { files: the commit's files, refused }.
async function acceptOnDashboard(repo, nrs) {
  const product = memoryHost(Object.fromEntries(repo));
  const done = await acceptEntries(product.host, await Promise.all(nrs.map((nr) => shownEntry(repo, nr))), "alice", NOW, sources());
  const [commit] = product.commits();
  return { files: (commit?.files ?? []).map((f) => ({ path: f.path, content: f.text })), refused: done.refused ?? [] };
}
// The approval record a person commits on GitHub's page without the dashboard (UC-006 4b, 4c).
async function specRecordFile(repo, nr, over = {}) {
  const [proposalPath, proposalText, anchor] = PROPOSALS[nr];
  const nn = String(nr).padStart(2, "0");
  const r = { kind: "spec", queue: Q, entry: nn, proposal: proposalPath, blob: await blob(proposalText), target: "SPEC.md",
    anchor, section: await blob(sectionText(repo.get("SPEC.md"), anchor) ?? ""), ...over };
  const name = `spec-${QN}-${nn}-${String(r.blob).slice(0, 12)}.md`;
  const text = Object.entries(r).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${v}\n`).join("");
  return [`docs/approvals/${name}`, text];
}
// The SPEC after a write holds `proposal` byte for byte where the section from `anchor` stood, and every byte before that
// section and from the heading `next` on as before. Between the proposal and `next` only line ends may differ.
function assertInPlace(written, before, anchor, next, proposal, route) {
  const at = before.indexOf(`\n${anchor}\n`) + 1, end = before.indexOf(`\n${next}\n`) + 1;
  assert.equal(written.slice(0, at), before.slice(0, at), `${route}: every byte before the section unchanged`);
  assert.equal(written.slice(written.indexOf(`\n${next}\n`) + 1), before.slice(end), `${route}: every byte from ${next} on unchanged`);
  const between = written.slice(at, written.indexOf(`\n${next}\n`) + 1);
  assert.ok(between.startsWith(proposal), `${route}: the proposal stands in the SPEC byte for byte`);
  assert.match(between.slice(proposal.length), /^\n*$/, `${route}: nothing but the proposal in its place`);
}
const filesOf = (plan) => new Map(plan.files.map((f) => [f.path, f.content]));
const without = (text, section) => text.replace(section, "");
// The rows of a queue's entscheidungen.md: [entry, the record it names].
const rowsOf = (text) => [...text.matchAll(/^\| [^|]+ \| (\d+) \| uebernommen \| (approval:[^\s|]+) \|$/gm)].map((m) => [Number(m[1]), m[2]]);

// ------------------------------------------------------------------------------------------------ ITM-014: the gates

// A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN — UC-006 main flow, steps 4–6: nothing is written before a person
// accepts, and what is written is written with the acceptance. Expected: an acceptance of nothing writes nothing; the instance
// workflow, with no approval record committed, writes nothing; accepting entry 03 writes SPEC.md in the same commit as its
// approval record and its decision row, and changes no byte outside section 4 — not the other sections, not the CR LF ends
// of a line in section 1.
test("release · gates: a SPEC change is written only with its acceptance, and only its own section", async () => {
  const repo = fixture();
  const nothing = memoryHost(Object.fromEntries(repo));
  await assert.rejects(acceptEntries(nothing.host, [], "alice", NOW, sources()), TypeError, "no acceptance");
  assert.deepEqual(nothing.commits(), [], "no acceptance, no file");
  const none = await applyApprovals(repo);
  assert.deepEqual(none.files, [], "no record, nothing written by the workflow");
  const crlf = SPEC.replace("The export is one PDF file.\n", "The export is one PDF file.\r\n");
  for (const [route, run] of [
    ["dashboard", async (r) => filesOf(await acceptOnDashboard(r, [3]))],
    ["workflow", async (r) => { const [p, t] = await specRecordFile(r, 3); r.set(p, t); return filesOf(await applyApprovals(r)); }],
  ]) {
    const r = fixture({ "SPEC.md": crlf });
    const files = await run(r);
    const written = files.get("SPEC.md");
    assert.ok(written, `${route}: SPEC.md written`);
    assert.equal(without(written, P03), without(crlf, sectionText(SPEC, "## 4. Fonts")), `${route}: every other byte unchanged`);
    assert.ok(written.includes("The export is one PDF file.\r\n"), `${route}: the CR LF of section 1 kept`);
    if (route === "dashboard") assert.ok([...files.keys()].some((p) => p.startsWith("docs/approvals/spec-")), "dashboard: the record in the same commit");
    assert.match(files.get(`${Q}/entscheidungen.md`), /\| 3 \| uebernommen \| approval:spec-2026-10-01_title-page-03-[0-9a-f]{12}\.md \|/, `${route}: decision row`);
  }
});

// THE APPROVED TEXT IS TAKEN VERBATIM — "what stands in the approval field is exactly what is written". Expected: on both
// writers, the section in the SPEC afterwards is the proposal byte for byte — tab, trailing blanks, typographic quotes, a dash,
// umlauts, an emoji, CR LF inside the proposal.
test("release · gates: the approved text is written byte for byte, on the dashboard's and on the workflow's route", async () => {
  const p01 = P01.replace("To be written.\n", "To be written.\r\nSecond line.\n");
  for (const route of ["dashboard", "workflow"]) {
    const r = fixture({ [PROPOSALS[1][0]]: p01 });
    PROPOSALS[1][1] = p01;
    try {
      let files;
      if (route === "dashboard") files = filesOf(await acceptOnDashboard(r, [1]));
      else { const [p, t] = await specRecordFile(r, 1); r.set(p, t); files = filesOf(await applyApprovals(r)); }
      const written = files.get("SPEC.md");
      assertInPlace(written, SPEC, "## 2. Title page", "## 3. Old rules", p01, route);
    } finally { PROPOSALS[1][1] = P01; }
  }
});

// NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT — UC-006 step 2: the current SPEC section beside the proposal, not a summary.
// Expected: the text given as current is the section as it stands, byte for byte; for entry 02, whose heading only entry 01
// creates, there is none yet, and 01 is named as the entry that creates it; an approval names the blob of the current text
// shown, so a record naming another text is not applied.
test("release · gates: the current text beside a proposal is the section as it stands, byte for byte", async () => {
  const repo = fixture();
  const snapshot = withStoredGraph(await snapshotOf(repo));
  const one = await entryView(Q, 1, snapshot);
  assert.deepEqual(one.current, { text: SECTION_2, blob: await blob(SECTION_2) });
  assert.equal(one.createdBy, null);
  const two = await entryView(Q, 2, snapshot);
  assert.equal(two.current, null, "the SPEC holds no section 5 yet");
  assert.deepEqual(two.createdBy, { queue: Q, entry: 1 });
  const [p, t] = await specRecordFile(repo, 1, { section: await blob("## 2. Title page\n\n(a summary of the rule)\n") });
  repo.set(p, t);
  const out = await applyApprovals(repo);
  assert.deepEqual(out.files, [], "an approval of another current text writes nothing");
  assert.equal(out.refused.length, 1);
});

// THE REPLACED TEXT STAYS REACHABLE — "through the git history; no second copy is kept in the working tree" (UC-006
// postcondition). Expected: the commit of an acceptance holds only SPEC.md, the record and the decision row — none of them, and
// no other file of the tree, carries the replaced section —, and after the commit, `git show HEAD^:SPEC.md` holds the replaced
// section, whose blob is the one the record names.
test("release · gates: the replaced section is reachable in git history and kept nowhere in the tree", async () => {
  const repo = fixture();
  const plan = await acceptOnDashboard(repo, [3]);
  assert.deepEqual(plan.files.map((f) => f.path).sort(),
    [`${Q}/entscheidungen.md`, "SPEC.md", `docs/approvals/spec-${QN}-03-${(await blob(P03)).slice(0, 12)}.md`].sort());
  const old = sectionText(SPEC, "## 4. Fonts");
  const d = mkdtempSync(join(tmpdir(), "release-02c-"));
  try {
    const git = (...a) => execFileSync("git", ["-C", d, ...a], { encoding: "utf8" });
    git("init", "-q"); git("config", "user.email", "t@example.org"); git("config", "user.name", "t");
    const put = (path, text) => { mkdirSync(dirname(join(d, path)), { recursive: true }); writeFileSync(join(d, path), text); };
    for (const [path, text] of repo) put(path, text);
    git("add", "-A"); git("commit", "-q", "-m", "before");
    for (const f of plan.files) put(f.path, f.content);
    git("add", "-A"); git("commit", "-q", "-m", "accept 03");
    const before = git("show", "HEAD^:SPEC.md");
    assert.ok(before.includes(old), "the replaced section is in the parent commit");
    const recordFile = plan.files.find((f) => f.path.startsWith("docs/approvals/spec-"));
    const record = readDocument(approvalSchema, recordFile.path, recordFile.content).fields;
    assert.equal(record.section, await blob(old), "the record names the replaced text");
    const tracked = git("ls-files").split("\n").filter(Boolean);
    const copies = tracked.filter((f) => readFileSync(join(d, f), "utf8").includes("The body text is set in a serif font."));
    assert.deepEqual(copies, [], "no file of the tree keeps the replaced rule");
  } finally { rmSync(d, { recursive: true, force: true }); }
});

// A GENERATED ARTIFACT IS A PROPOSAL — "a file without an approval record naming its current text is shown as open".
// A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN — a use case, a decision, a module or a SPEC change proposal written
// directly to the default branch counts as open until an approval record names its text. Expected, for each of the three
// reviewed kinds: no record → open; a record of an earlier text → not accepted; a record of its current text → accepted. For the
// SPEC proposal: open → a record of another proposal text is not approved → a record of another section is not approved → a
// record of its text and of the section shown → approved.
test("release · gates: a file on the default branch is open until a record names its current text", async () => {
  const kinds = { [UC]: ["UC-001", "use-case"], [ARC]: ["ARC-001", "architecture-decision"], [MOD]: ["MOD-exporter", "module"] };
  for (const [path, text] of [[UC, UC_TEXT], [ARC, arcText(["EXPORT IS A PDF"])], [MOD, MOD_TEXT]]) {
    const [id, kind] = kinds[path], b = await blob(text), earlier = await blob(text + "earlier\n");
    const record = (named) => ({ [`docs/approvals/${id}-${named.slice(0, 12)}.md`]: `kind: ${kind}\nfile: ${path}\nblob: ${named}\n` });
    assert.equal(statusOf(path, b, await snapshotOf(fixture({ [path]: text }))), "open", path);
    assert.notEqual(statusOf(path, b, await snapshotOf(fixture({ [path]: text, ...record(earlier) }))), "accepted", `${path}: an earlier text's record`);
    assert.equal(statusOf(path, b, await snapshotOf(fixture({ [path]: text, ...record(b) }))), "accepted", `${path}: its own record`);
  }
  const stateOf = async (over) => {
    const repo = fixture();
    if (over) { const [p, t] = await specRecordFile(repo, 3, over); repo.set(p, t); }
    const [queue] = await queues(await snapshotOf(repo));
    return queue.entries.find((entry) => entry.number === 3).state;
  };
  assert.equal(await stateOf(null), "open");
  assert.notEqual(await stateOf({ blob: await blob("another proposal\n") }), "approved");
  assert.notEqual(await stateOf({ section: await blob("another section\n") }), "approved");
  assert.equal(await stateOf({}), "approved");
});

// A RECORD IS EVIDENCE, NOT A PROPOSAL — approval, gate, job and test result records "are never shown for acceptance". Expected:
// none of them is a reviewed file, and the use case beside them is.
test("release · gates: records are not of a reviewed kind; a use case is", async () => {
  const snapshot = await snapshotOf(fixture());
  for (const p of ["docs/jobs/JOB-20261001-0900-a1b2.md", "docs/approvals/UC-001-0123456789ab.md", "docs/gates/GATE-20261001-0900-c3d4.md",
    "docs/test-results/2026-10-01_a7b4b9f.md"]) assert.throws(() => statusOf(p, "a".repeat(40), snapshot), (e) => e.name === "NotReviewed", p);
  assert.equal(statusOf(UC, await blob(UC_TEXT), snapshot), "open");
});

// A RECORD IS EVIDENCE, NOT A PROPOSAL — the SPEC's check: "a job record without approval is not listed as open; counter-proof:
// a use case without approval is." Expected: the statuses of the product list neither a job record nor an approval record
// without approval; the use case is listed as open.
test("release · gates: a job record without approval is not open; a use case without approval is", async () => {
  const records = ["docs/jobs/JOB-20261001-0900-a1b2.md", "docs/approvals/ARC-009-0123456789ab.md"];
  const listed = statuses(await snapshotOf(fixture(Object.fromEntries(records.map((p) => [p, `record ${p}\n`])))));
  for (const p of records) assert.equal(listed.has(p), false, p);
  assert.equal(listed.get(UC)?.status, "open");
});

// A RECORD IS EVIDENCE, NOT A PROPOSAL — never accepted: an acceptance handed a job record writes no approval record for it.
// Expected: the acceptance is refused before anything is written.
test("release · gates: an acceptance handed a job record writes no approval record for it", async () => {
  const JOB = "docs/jobs/JOB-20261001-0900-a1b2.md", text = "# JOB-20261001-0900-a1b2\n\nstarted\n";
  const product = memoryHost(Object.fromEntries(fixture({ [JOB]: text })));
  await assert.rejects(acceptShown(product.host, [{ path: JOB, blob: await blob(text) }], "alice"), TypeError);
  assert.deepEqual(product.commits(), []);
});

// ------------------------------------------------------------------------------------------------ ITM-016: the workflow's writer, applyApproved

// UC-006 4c · WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE · A STALE APPROVAL IS NOT APPLIED: a record committed
// on GitHub's page; the workflow applies it with the same checks. Expected for each fault, one record at a time: nothing is
// written, and the record is refused under its own file name — proposal changed after approval, SPEC section changed after
// approval, a field missing, an anchor other than the queue's, a proposal outside the queue, an entry the queue does not have.
// A record already applied (its decision row exists) and a use case's record are passed over: nothing written, nothing refused.
test("release · applyApproved: a stale or malformed record is refused by name and nothing is written", async () => {
  const cases = [
    ["the proposal changed after approval", (r) => r.set(PROPOSALS[3][0], P03 + "changed after\n"), {}, /proposal changed after it was approved/],
    ["the SPEC section changed after approval", (r) => r.set("SPEC.md", SPEC.replace("set in a serif", "set in a Serif")), {}, /section changed after it was approved/],
    ["a field is missing", () => {}, { anchor: undefined }, /the record lacks anchor/],
    ["the anchor is not the queue's", () => {}, { anchor: "## 1. Export" }, /anchor/],
    ["the proposal is not a file of the queue", () => {}, { proposal: "SPEC.md" }, /names the proposal SPEC\.md/],
    ["the queue has no such entry", () => {}, { entry: "07" }, /no longer in the queue's index/],
  ];
  for (const [what, change, over, reason] of cases) {
    const r = fixture();
    const [p, t] = await specRecordFile(r, 3, over);
    r.set(p, t);
    change(r);
    const out = await applyApprovals(r);
    assert.deepEqual(out.files, [], `${what}: nothing written`);
    assert.equal(out.refused.length, 1, what);
    assert.equal(out.refused[0].record.split("/").pop(), p.split("/").pop(), `${what}: refused by its name`);
    assert.match(out.refused[0].reason, reason, what);
    assert.deepEqual(out.applied, [], `${what}: nothing applied`);
  }
  const r = fixture();
  const [p, t] = await specRecordFile(r, 3);
  r.set(p, t);
  r.set(`${Q}/entscheidungen.md`, `${DECISIONS}| 2026-10-01 09:00 UTC | 3 | uebernommen | approval:${p.split("/").pop()} |\n`);
  r.set(`docs/approvals/UC-001-${(await blob(UC_TEXT)).slice(0, 12)}.md`, `kind: use-case\nfile: ${UC}\nblob: ${await blob(UC_TEXT)}\n`);
  const out = await applyApprovals(r);
  assert.deepEqual([out.files, out.refused], [[], []], "already applied and a use case's record: passed over");
});

// UC-006 4c, 4d · UC-006 postcondition "The SPEC contains exactly the approved text": records of one queue committed together are
// applied in the order of the queue's index, entry 02 after entry 01, which creates its heading. Expected: SPEC.md holds both
// proposals and every other byte as before; two decision rows, in that order; a third, stale record beside them refused by
// name without stopping the others.
test("release · applyApproved: several records in one run — each written, in order, a stale one refused beside them", async () => {
  const r = fixture();
  const [p1, t1] = await specRecordFile(r, 1);
  // Entry 02 names the section of "## 5. Appendix" as entry 01 leaves it in the SPEC (the heading entry 01 creates, up to the next heading).
  const two = { kind: "spec", queue: Q, entry: "02", proposal: PROPOSALS[2][0], blob: await blob(P02), target: "SPEC.md",
    anchor: "## 5. Appendix", section: await blob("## 5. Appendix\n\nTo be written.\n") };
  const p2 = `docs/approvals/spec-${QN}-02-${two.blob.slice(0, 12)}.md`;
  const [p3, t3] = await specRecordFile(r, 3, { blob: await blob("an older proposal\n") });
  for (const [p, t] of [[p1, t1], [p2, Object.entries(two).map(([k, v]) => `${k}: ${v}\n`).join("")], [p3, t3]]) r.set(p, t);
  const out = await applyApprovals(r);
  const files = filesOf(out);
  assertInPlace(files.get("SPEC.md"), SPEC, "## 2. Title page", "## 3. Old rules", P01.replace("## 5. Appendix\n\nTo be written.\n", P02), "workflow");
  assert.deepEqual(rowsOf(files.get(`${Q}/entscheidungen.md`)), [[1, `approval:${p1.split("/").pop()}`], [2, `approval:${p2.split("/").pop()}`]]);
  assert.deepEqual(out.refused.map((x) => x.record.split("/").pop()), [p3.split("/").pop()]);
});

// WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE — the change is the same one the dashboard's commit writes: the same
// approved entry accepted on the dashboard (with a token) and, as a record, given to applyApproved (the workflow, without one), on
// a tree of CR LF line ends and on one of LF. Expected: the same SPEC.md, byte for byte, on both routes.
test("release · applyApproved: the same SPEC bytes as the dashboard's commit of the same entry", async () => {
  for (const [what, spec] of [["LF", SPEC], ["CR LF", SPEC.replace("The title page names the author.\n", "The title page names the author.\r\n")]]) {
    const dashboard = fixture({ "SPEC.md": spec });
    const workflow = fixture({ "SPEC.md": spec });
    const [p, t] = await specRecordFile(workflow, 1);
    workflow.set(p, t);
    const fromDashboard = filesOf(await acceptOnDashboard(dashboard, [1])).get("SPEC.md");
    const fromWorkflow = filesOf(await applyApprovals(workflow)).get("SPEC.md");
    assert.ok(fromDashboard && fromWorkflow, `${what}: both routes write the SPEC`);
    assert.equal(fromWorkflow, fromDashboard, `${what}: the same bytes`);
  }
});

// ------------------------------------------------------------------------------------------------ UC-022: architecture rests on accepted artifacts

// ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS — UC-022 step 10 and 10a: a decision or module is accepted only when every requirement
// and use case it names is accepted. Expected: a decision naming a name that is only bold prose in the SPEC, or a use case not yet
// accepted, has each as a blocker, and its acceptance writes nothing and names it; the same decision naming the requirement and the
// accepted use case has nothing open and is accepted with one record.
test("release · UC-022: a decision is accepted only when everything it names is accepted", async () => {
  const ucBlob = await blob(UC_TEXT), ucRecord = { [`docs/approvals/UC-001-${ucBlob.slice(0, 12)}.md`]: `kind: use-case\nfile: ${UC}\nblob: ${ucBlob}\n` };
  const tryAccept = async (names, records) => {
    const text = arcText(names), product = memoryHost(Object.fromEntries(fixture({ [ARC]: text, ...records })));
    const open = await acceptanceBlockers(ARC, await product.host.readSnapshot("main"));
    const accepted = await acceptShown(product.host, [{ path: ARC, blob: await blob(text) }], "alice").then((done) => done, (e) => e);
    return { open, accepted, commits: product.commits(), text };
  };
  for (const [names, records, openName] of [
    [["VERBINDLICH (SPEC)"], ucRecord, "VERBINDLICH (SPEC)"],
    [["EXPORT IS A PDF", "UC-001"], {}, "UC-001"],
  ]) {
    const { open, accepted, commits } = await tryAccept(names, records);
    assert.deepEqual(open, [openName], `${names}: listed as open`);
    assert.deepEqual(commits, [], `${names}: not accepted`);
    assert.equal(accepted.name, "NothingToAccept");
    assert.deepEqual(accepted.leftOut, [{ path: ARC, reason: "rests on what is not accepted", names: [openName] }], `${names}: the refusal names it`);
  }
  const ok = await tryAccept(["EXPORT IS A PDF", "UC-001"], ucRecord);
  assert.deepEqual(ok.open, []);
  assert.deepEqual(ok.commits.map((c) => c.files.map((f) => f.path)), [[`docs/approvals/ARC-001-${(await blob(ok.text)).slice(0, 12)}.md`]]);
});
