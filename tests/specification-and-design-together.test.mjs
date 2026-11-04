// Specification and design, its three modules together (ITM-368) — the interface ARC-041 offers, tested through the index.mjs of
// MOD-approvals, MOD-spec-changes and MOD-artifact-edits against ONE fixture repository behind ONE fake repository host: a
// requirement edit proposed (proposeSection), shown (entryView) and accepted (acceptEntries), after which the SPEC holds exactly
// the proposal, and applyApproved writes the same bytes for a record committed without the dashboard; a use case saved
// (saveFile), then accepted (acceptShown) with the saved text as its last accepted text (lastAcceptedText), or left out when it
// changed again; a save, a proposal, an acceptance or an application on a text that moved meanwhile refused across the modules.
// Run: node --test tests/specification-and-design-together.test.mjs
//
// Module: MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// Level: component
// Guards: UC-006; UC-008; UC-018; STATUS IS DERIVED FROM THE RECORDS; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL
// Guards: A STALE APPROVAL IS NOT APPLIED; A SPEC EDIT IS SAVED AS A PROPOSAL; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE
//
// Written from ARC-041, the three module files, UC-006, UC-008 and UC-018, not from the code. The product is the small repository
// this file holds, never Agent M's own SPEC.md. The fake host keeps to MOD-repository-hosts' interface as its module file states it:
// one repository in memory, default branch `trunk`, a real commit log — repositoryInfo, readSnapshot (the branch or a commit), readFileAt (a file at each of several commits),
// readHistory (newest first, with the changes of each commit) and commitFiles (all files together, only if the branch still stands
// at the expected head, else `Moved`) —; every write is recorded; its other functions do not exist, so that a call the modules have
// no business making fails by itself. Expected values are read off the fixture's own texts: a blob is the SHA-1 of "blob <length>\0"
// and the bytes, computed here with node:crypto, and the SPEC after an acceptance is the pieces of the SPEC and of the proposal
// put together here.
//
// Readings the module files leave open, taken here and named in the pull request:
//   - A requirement edit's queue is its section's queue, `docs/spec-freigaben/reading` for `## 1. Reading` (MOD-spec-changes, Data);
//     the folder given back is that path. The acceptance's `now` is fixed.
//   - A record committed without the dashboard is what a person's GitHub page commits: the record file named
//     docs/approvals/spec-<queue folder name>-<NN>-<first twelve digits of the proposal's blob>.md, with the fields MOD-approvals'
//     schema lists for kind `spec`, the section being the blob of the section shown beside the proposal.
//   - "Writes the same bytes" is read as: the SPEC and the decisions file applyApproved returns are, byte for byte, those the
//     acceptance of the same entry on the dashboard committed.
//   - A refused application is read as one that returns no changed file for the target.
// Each test states its input and its expected result before it runs. The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as approvals from "../src/approvals/index.mjs";
import * as specChanges from "../src/spec-changes/index.mjs";
import * as artifactEdits from "../src/artifact-edits/index.mjs";
import { sourceSchemas } from "../src/source-register/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

const { statuses, lastAcceptedText, acceptShown, approvalSchema } = approvals;
const { queues, entryView, proposeSection, saveEntry, acceptEntries, applyApproved } = specChanges;
const { saveFile } = artifactEdits;

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const gitBlob = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const TODAY = new Date().toISOString().slice(0, 10);
const NOW = new Date("2026-03-01T10:00:00Z");
const WHEN = "2026-03-01 10:00 UTC";
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/product", web: "https://github.com/alice/product" };

const HEAD = text("# Fixture product — Specification", "");
const READING = text("## 1. Reading", "", "**A SAMPLE RULE** *(Fixture PO)*", "A reader reads a file whole.", "*Check:* `tests/sample.test.mjs`", "");
const WRITING = text("## 2. Writing", "", "**A WRITE RULE** *(Fixture PO)*", "A writer writes a file whole.", "*Check:* no automatic check; at review");
const SPEC = HEAD + READING + WRITING;
const READING_EDITED = READING.replace("whole.", "whole, or says why not.");
const READING_AGAIN = READING.replace("whole.", "whole and says why not.");
const READING_BY_OTHERS = READING.replace("whole.", "whole, as a person.");
const WRITING_ADDED = WRITING + "\n" + text("**AN ADDED RULE** *(Fixture PO)*", "A writer sees what was added.", "*Check:* no automatic check; at review");

const useCase = (id, title, realises, sentence) => text("---", `id: ${id}`, `title: ${title}`, "area: files", "actors:", "  - Reader",
  "realises:", ...realises.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", `**Goal.** ${sentence}`);
const UC1_PATH = "docs/use-cases/UC-001-read-a-file.md";
const UC1_V1 = useCase("UC-001", "Read a file", ["A SAMPLE RULE"], "The reader opens a file and reads it.");
const UC1_V2 = useCase("UC-001", "Read a file", ["A SAMPLE RULE"], "The reader opens a file and reads it to the end.");
const UC1_V3 = useCase("UC-001", "Read a file", ["A SAMPLE RULE"], "The reader opens a file, reads it to the end and closes it.");
const UC2_PATH = "docs/use-cases/UC-002-add-to-a-file.md";
const UC2 = useCase("UC-002", "Add to a file", ["AN ADDED RULE"], "The writer adds a line to a file.");

// The product links "Fixture PO"; every requirement above names it.
const ENTRY_PO = text("---", "id: SRC-fixture-po", "title: Fixture PO", "kind: document", "authority: normative", "licence: may be republished — fixture",
  "---", "# SRC-fixture-po Fixture PO", "", "A fixture source.");
const LINKS = text("# The sources this product meets", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| SRC-fixture-po | 2026-10-05 | ${"0".repeat(64)} | |`);
const sources = () => ({ links: readDocument(sourceSchemas().links, "docs/sources.md", LINKS),
  register: [readDocument(sourceSchemas().entry, "docs/sources/SRC-fixture-po.md", ENTRY_PO)] });

const PRODUCT = { "README.md": "# Fixture product\n", "SPEC.md": SPEC, "docs/sources.md": LINKS, "docs/sources/SRC-fixture-po.md": ENTRY_PO,
  [UC1_PATH]: UC1_V1, [UC2_PATH]: UC2 };

const recordOfUseCase = (id, path, body) => [`docs/approvals/${id}-${gitBlob(body).slice(0, 12)}.md`, text("kind: use-case", `file: ${path}`, `blob: ${gitBlob(body)}`)];

// ---------------------------------------------------------------- the fake host

const failure = (name, fields = {}) => Object.assign(new Error(`${name} ${JSON.stringify(fields)}`), { name }, fields);

// The fake host over a commit log. The first commit holds `files`; `land(changed, who)` is another writer's commit; a commit made through
// commitFiles is by `alice`, whose token the host stands for. The graph of every commit is stored on trace-cache, as the workflow "main changed" stores it (tests/stored-graph-fake.mjs).
function repository(files = PRODUCT) {
  const log = [];
  const add = (tree, who, message) => {
    const before = log.length ? log[log.length - 1].tree : new Map();
    const commit = createHash("sha1").update(`commit ${log.length + 1}`).digest("hex");
    const changes = [...tree].filter(([path, body]) => before.get(path) !== body).map(([path]) => ({ path, change: before.has(path) ? "modified" : "added" }));
    const date = new Date(Date.UTC(2026, 9, 12, 9, log.length)).toISOString();
    log.push({ commit, tree, entry: { commit, parents: log.length ? [log[log.length - 1].commit] : [], author: { account: who, name: who }, date, message, changes } });
  };
  add(new Map(Object.entries(files)), "bob", "the product");
  const writes = [];
  const at = (ref) => {
    const found = ref === "trunk" ? log.length - 1 : log.findIndex((each) => each.commit === ref);
    if (found < 0) throw failure("NotFound", { what: ref });
    return found;
  };
  const fake = {
    writes,
    head: () => log[log.length - 1].commit,
    files: () => Object.fromEntries(log[log.length - 1].tree),
    land: (changed, who = "bob") => add(new Map([...log[log.length - 1].tree, ...Object.entries(changed)]), who, "another writer"),
    snapshot: () => fake.host.readSnapshot("trunk"),
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "private", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        const { commit, tree } = log[at(ref)];
        return withStoredGraph({ repository: ON_GITHUB, ref, commit, paths: [...tree.keys()].sort(),
          read: async (path) => (tree.has(path) ? tree.get(path) : null), blob: (path) => (tree.has(path) ? gitBlob(tree.get(path)) : null) });
      },
      async readFileAt(path, shas) {
        return new Map(shas.map((sha) => [sha, log[at(sha)].tree.get(path) ?? null]));
      },
      async readHistory(path, { ref = "trunk", limit } = {}) {
        const touched = (entry) => path === null || entry.changes.some((change) => change.path === path);
        const found = log.slice(0, at(ref) + 1).map((each) => each.entry).filter(touched).reverse();
        return limit === undefined ? found : found.slice(0, limit);
      },
      async commitFiles(change) {
        writes.push(structuredClone(change));
        if (!change.files.length || !/\S/.test(change.message)) throw new TypeError("a change holds a file and a message");
        if (change.branch !== "trunk" || change.expectedHead !== fake.head()) throw failure("Moved", { head: fake.head() });
        add(new Map([...log[log.length - 1].tree, ...change.files.map((file) => [file.path, file.text])]), "alice", change.message);
        return { commit: fake.head(), url: `${ON_GITHUB.web}/commit/${fake.head()}` };
      },
    },
  };
  return fake;
}

// A requirement edit as the editor hands it to proposeSection.
const edit = (overrides = {}) => ({ target: "SPEC.md", anchor: "## 1. Reading", until: null, text: READING_EDITED, why: "A reader needs to know why a file cannot be read.",
  origin: "an issue of a reader", person: "alice", openedBlob: gitBlob(READING), openedHead: "0".repeat(40), ...overrides });
// What the review page shows of an entry, handed to acceptEntries as the person's click gives it.
const shownOf = (queue, number, view) => ({ queue, entry: number, proposalBlob: view.proposal.blob, sectionBlob: view.current.blob });
const folderName = (queue) => queue.split("/").pop();
const recordPathOf = (queue, number, proposal) => `docs/approvals/spec-${folderName(queue)}-${String(number).padStart(2, "0")}-${gitBlob(proposal).slice(0, 12)}.md`;
// The record a person commits through GitHub's page, without the dashboard.
const handRecord = ({ queue, number, proposal, section, anchor = "## 1. Reading" }) => [recordPathOf(queue, number, proposal),
  text("kind: spec", `queue: ${queue}`, `entry: ${String(number).padStart(2, "0")}`, `proposal: ${queue}/${String(number).padStart(2, "0")}-reading.md`,
    `blob: ${gitBlob(proposal)}`, "target: SPEC.md", `anchor: ${anchor}`, `section: ${gitBlob(section)}`)];
const decisionRow = (number, queue, proposal) => `| ${WHEN} | ${number} | uebernommen | approval:${recordPathOf(queue, number, proposal).split("/").pop()} |\n`;
const stateOf = async (fake, queue, number) => (await queues(await fake.snapshot())).find((each) => each.folder === queue).entries.find((each) => each.number === number).state;

// ---------------------------------------------------------------- a requirement edit, from proposal to the SPEC

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476046 · level: component · module: MOD-spec-changes
// guards: A SPEC EDIT IS SAVED AS A PROPOSAL; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; UC-018; UC-006
// given: the product, whose SPEC holds the section Reading; alice edits it in the editor and saves; she then opens the entry on the review page and accepts what she is shown
// input: proposeSection(host, the edit); entryView of the entry it names; acceptEntries(host, [what entryView shows], "alice", now, sources)
// expect: after the save one commit, the SPEC byte-identical and the queue's entry open; entryView shows the section that holds now beside the proposal, each with the git blob of its bytes; after the acceptance one more commit, the SPEC holding exactly the proposal in the place of the section and every other byte as it was; one record naming the proposal's blob, one decision row naming the record; the entry now `in SPEC`
test("a requirement edit — saved as a proposal, shown beside the current text, accepted: the SPEC holds exactly the proposal", async () => {
  const fake = repository();

  const saved = await proposeSection(fake.host, edit());

  assert.equal(fake.writes.length, 1, "the save is one commit");
  assert.equal(fake.files()["SPEC.md"], SPEC, "the save leaves SPEC.md byte-identical");
  assert.equal(saved.queue, "docs/spec-freigaben/reading");
  assert.equal(saved.entry, 1);
  assert.equal(await stateOf(fake, saved.queue, 1), "open");

  const view = await entryView(saved.queue, saved.entry, await fake.snapshot());
  assert.deepEqual([view.current.text, view.current.blob], [READING, gitBlob(READING)], "the section that holds now");
  assert.deepEqual([view.proposal.text, view.proposal.blob], [READING_EDITED, gitBlob(READING_EDITED)], "beside the proposal");

  const accepted = await acceptEntries(fake.host, [shownOf(saved.queue, saved.entry, view)], "alice", NOW, sources());

  assert.equal(fake.writes.length, 2, "the acceptance is one more commit");
  assert.deepEqual(accepted, { commit: fake.head() });
  const files = fake.files();
  assert.equal(files["SPEC.md"], HEAD + READING_EDITED + WRITING, "the proposal in the place of the section, every other byte as it was");
  const record = recordPathOf(saved.queue, 1, READING_EDITED);
  assert.ok(Object.hasOwn(files, record), `the record ${record}`);
  assert.ok(files[record].includes(`blob: ${gitBlob(READING_EDITED)}`), "naming the proposal's blob");
  assert.ok(files[`${saved.queue}/entscheidungen.md`].endsWith(decisionRow(1, saved.queue, READING_EDITED)), "and the decision row naming the record");
  assert.equal(await stateOf(fake, saved.queue, 1), "in SPEC");
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476047 · level: component · module: MOD-spec-changes
// guards: AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE; UC-006
// given: two copies of the product with the same saved edit; in the first the entry is accepted on the dashboard; in the second the approval record is committed by hand, as GitHub's page does without a token
// input: acceptEntries in the first; applyApproved(snapshot of the second, now)
// expect: applyApproved applies the record and returns, for SPEC.md and for the queue's entscheidungen.md, exactly the bytes the dashboard's acceptance committed in the first copy; nothing refused; and it writes nothing itself
test("a record committed without the dashboard — applyApproved returns the SPEC and the decisions the dashboard's acceptance wrote", async () => {
  const dashboard = repository();
  const saved = await proposeSection(dashboard.host, edit());
  const view = await entryView(saved.queue, saved.entry, await dashboard.snapshot());
  await acceptEntries(dashboard.host, [shownOf(saved.queue, 1, view)], "alice", NOW, sources());

  const workflow = repository();
  await proposeSection(workflow.host, edit());
  const [recordPath, recordText] = handRecord({ queue: saved.queue, number: 1, proposal: READING_EDITED, section: READING });
  workflow.land({ [recordPath]: recordText });
  const writesBefore = workflow.writes.length;
  const applied = await applyApproved(await workflow.snapshot(), NOW);

  assert.deepEqual(applied.refused, []);
  assert.equal(applied.applied.length, 1);
  assert.equal(applied.files["SPEC.md"], dashboard.files()["SPEC.md"], "the same SPEC");
  assert.equal(applied.files[`${saved.queue}/entscheidungen.md`], dashboard.files()[`${saved.queue}/entscheidungen.md`], "the same decisions");
  assert.equal(applied.files["SPEC.md"], HEAD + READING_EDITED + WRITING);
  assert.equal(workflow.writes.length, writesBefore, "it writes nothing itself");
  assert.equal(workflow.files()["SPEC.md"], SPEC, "the SPEC of the second copy is still as it was");
});

// ---------------------------------------------------------------- a use case, saved and accepted

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476048 · level: component · module: MOD-approvals
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-008; UC-018
// given: UC-001 accepted by a record on its first text; the person edits it and saves
// input: statuses before and after saveFile(host, the edit on the blob it was opened on); acceptShown of the saved text; lastAcceptedText("UC-001"); statuses again
// expect: accepted before the save; `changed` after it, the last accepted text still the first; after acceptShown one record naming the saved blob, the last accepted text the saved text with its blob and path, and the status accepted again
test("a use case — saved, it counts as changed; accepted, its last accepted text is the saved text", async () => {
  const fake = repository();
  const [recordPath, recordText] = recordOfUseCase("UC-001", UC1_PATH, UC1_V1);
  fake.land({ [recordPath]: recordText });
  assert.equal(statuses(await fake.snapshot()).get(UC1_PATH).status, "accepted", "known positive: the first text is accepted");

  const saved = await saveFile(fake.host, { path: UC1_PATH, text: UC1_V2, openedBlob: gitBlob(UC1_V1), openedId: "UC-001" });

  assert.deepEqual(saved, { commit: fake.head(), blob: gitBlob(UC1_V2) });
  assert.equal(statuses(await fake.snapshot()).get(UC1_PATH).status, "changed");
  assert.deepEqual(await lastAcceptedText("UC-001", fake.host), { text: UC1_V1, blob: gitBlob(UC1_V1), path: UC1_PATH });

  const accepted = await acceptShown(fake.host, [{ path: UC1_PATH, blob: gitBlob(UC1_V2) }], "alice");

  assert.deepEqual([accepted.recorded, accepted.leftOut], [[UC1_PATH], []]);
  assert.ok(Object.hasOwn(fake.files(), `docs/approvals/UC-001-${gitBlob(UC1_V2).slice(0, 12)}.md`), "one record, named by the saved blob");
  assert.deepEqual(await lastAcceptedText("UC-001", fake.host), { text: UC1_V2, blob: gitBlob(UC1_V2), path: UC1_PATH });
  assert.equal(statuses(await fake.snapshot()).get(UC1_PATH).status, "accepted");
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476049 · level: component · module: MOD-approvals
// guards: STATUS IS DERIVED FROM THE RECORDS; UC-008
// given: UC-001 accepted on its first text, saved with a second, shown to the reviewer with the second, and then changed again by another writer to a third
// input: acceptShown(host, [the second text's blob])
// expect: it rejects with NothingToAccept naming the file left out as `changed since shown`; no commit is made; the last accepted text is still the first and the status `changed`
test("a use case saved and then changed again — the acceptance of the text shown is left out, nothing is written", async () => {
  const fake = repository();
  const [recordPath, recordText] = recordOfUseCase("UC-001", UC1_PATH, UC1_V1);
  fake.land({ [recordPath]: recordText });
  await saveFile(fake.host, { path: UC1_PATH, text: UC1_V2, openedBlob: gitBlob(UC1_V1), openedId: "UC-001" });
  fake.land({ [UC1_PATH]: UC1_V3 });
  const writes = fake.writes.length;

  await assert.rejects(acceptShown(fake.host, [{ path: UC1_PATH, blob: gitBlob(UC1_V2) }], "alice"), (error) => {
    assert.equal(error.name, "NothingToAccept");
    assert.deepEqual(error.leftOut.map(({ path, reason }) => [path, reason]), [[UC1_PATH, "changed since shown"]]);
    return true;
  });

  assert.equal(fake.writes.length, writes, "no commit");
  assert.deepEqual(await lastAcceptedText("UC-001", fake.host), { text: UC1_V1, blob: gitBlob(UC1_V1), path: UC1_PATH });
  assert.equal(statuses(await fake.snapshot()).get(UC1_PATH).status, "changed");
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476050 · level: component · module: MOD-approvals
// guards: STATUS IS DERIVED FROM THE RECORDS; A REQUIREMENT HAS A REGISTERED SOURCE; UC-008; UC-006
// given: a requirement that only a proposal in an open queue holds (an edit of section 2 adding AN ADDED RULE), and UC-002, which realises it
// input: acceptShown of UC-002; acceptEntries of the proposal; acceptShown of UC-002 again
// expect: the first rejects with NothingToAccept, UC-002 left out as `rests on what is not accepted` naming AN ADDED RULE; after the proposal is in the SPEC the second records UC-002
test("a use case resting on a requirement of an open entry — left out until the entry is accepted", async () => {
  const fake = repository();
  const saved = await proposeSection(fake.host, edit({ anchor: "## 2. Writing", text: WRITING_ADDED, openedBlob: gitBlob(WRITING) }));
  const shown = [{ path: UC2_PATH, blob: gitBlob(UC2) }];

  await assert.rejects(acceptShown(fake.host, shown, "alice"), (error) => {
    assert.equal(error.name, "NothingToAccept");
    assert.deepEqual(error.leftOut, [{ path: UC2_PATH, reason: "rests on what is not accepted", names: ["AN ADDED RULE"] }]);
    return true;
  });

  const view = await entryView(saved.queue, saved.entry, await fake.snapshot());
  await acceptEntries(fake.host, [shownOf(saved.queue, saved.entry, view)], "alice", NOW, sources());
  assert.equal(fake.files()["SPEC.md"], HEAD + READING + WRITING_ADDED, "the requirement is in the SPEC");
  const accepted = await acceptShown(fake.host, shown, "alice");

  assert.deepEqual([accepted.recorded, accepted.leftOut], [[UC2_PATH], []]);
});

// ---------------------------------------------------------------- a text that moved meanwhile

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476051 · level: component · module: MOD-artifact-edits
// guards: A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT; UC-018
// given: UC-001 opened at its first text; another writer's commit changes it
// input: saveFile of the person's edit on the first text's blob; then acceptShown of the first text, as a page that still shows it would
// expect: the save is refused with the other writer's text and blob, nothing written; the acceptance of the text shown is refused as well (NothingToAccept, `changed since shown`) and writes nothing
test("a use case that moved meanwhile — the save and the acceptance of the old text are both refused, nothing is written", async () => {
  const fake = repository();
  fake.land({ [UC1_PATH]: UC1_V3 });
  const writes = fake.writes.length;

  const refused = await saveFile(fake.host, { path: UC1_PATH, text: UC1_V2, openedBlob: gitBlob(UC1_V1), openedId: "UC-001" });

  assert.deepEqual(refused, { refused: "changed meanwhile", current: UC1_V3, currentBlob: gitBlob(UC1_V3) });
  await assert.rejects(acceptShown(fake.host, [{ path: UC1_PATH, blob: gitBlob(UC1_V1) }], "alice"), (error) => error.name === "NothingToAccept");
  assert.equal(fake.writes.length, writes, "nothing written");
  assert.equal(fake.files()[UC1_PATH], UC1_V3);
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476052 · level: component · module: MOD-spec-changes
// guards: A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT; UC-018
// given: an edit of the section Reading opened on the SPEC as it stands; meanwhile another entry for the same section is accepted, so that the section on the default branch is another
// input: proposeSection with the opened blob of the old section
// expect: { refused: "changed meanwhile", current: the section that holds now }, so that the editor keeps the edit beside it; no commit; the queue gains no entry
test("a requirement edit on a section that was accepted over meanwhile — refused with the newer section, nothing is written", async () => {
  const fake = repository();
  const first = await proposeSection(fake.host, edit({ person: "bob" }));
  const view = await entryView(first.queue, first.entry, await fake.snapshot());
  await acceptEntries(fake.host, [shownOf(first.queue, first.entry, view)], "bob", NOW, sources());
  const writes = fake.writes.length;

  const refused = await proposeSection(fake.host, edit({ text: READING_AGAIN, openedBlob: gitBlob(READING) }));

  assert.deepEqual(refused, { refused: "changed meanwhile", current: READING_EDITED });
  assert.equal(fake.writes.length, writes, "no commit");
  const all = await queues(await fake.snapshot());
  assert.deepEqual(all.map((queue) => queue.entries.length), [1], "no entry added");
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476053 · level: component · module: MOD-spec-changes
// guards: A STALE APPROVAL IS NOT APPLIED; A SPEC EDIT IS SAVED AS A PROPOSAL; UC-006
// given: alice's entry shown to a reviewer; before the click she saves an edit of that open entry in place (saveEntry), which replaces the entry's proposal
// input: acceptEntries with the proposal blob that was shown
// expect: { refused: [{ queue, entry: 1, reason }] }; no commit; the SPEC byte-identical; the entry still open
test("an entry whose proposal was replaced after it was shown — the acceptance is refused and names the entry", async () => {
  const fake = repository();
  const saved = await proposeSection(fake.host, edit());
  const shown = shownOf(saved.queue, 1, await entryView(saved.queue, 1, await fake.snapshot()));
  const second = await saveEntry(fake.host, { queue: saved.queue, entry: 1, text: READING_AGAIN, why: "Again.", person: "alice", openedBlob: gitBlob(READING_EDITED), openedHead: null });
  assert.ok(second.commit, "fixture: the edit of the entry replaced its proposal");
  const writes = fake.writes.length;

  const result = await acceptEntries(fake.host, [shown], "alice", NOW, sources());

  assert.deepEqual(Object.keys(result), ["refused"]);
  assert.deepEqual(result.refused.map(({ queue, entry }) => [queue, entry]), [[saved.queue, 1]]);
  assert.equal(fake.writes.length, writes, "no commit");
  assert.equal(fake.files()["SPEC.md"], SPEC);
  assert.equal(await stateOf(fake, saved.queue, 1), "open");
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476054 · level: component · module: MOD-spec-changes
// guards: A STALE APPROVAL IS NOT APPLIED; UC-006
// given: an entry shown beside the section as it stood, and another writer's commit that edits that section of the SPEC directly
// input: acceptEntries with the section blob that was shown
// expect: { refused: [the entry] }; no commit; the SPEC is the other writer's, not the proposal
test("a SPEC section changed after the entry was shown — the acceptance is refused, nothing is written", async () => {
  const fake = repository();
  const saved = await proposeSection(fake.host, edit());
  const shown = shownOf(saved.queue, 1, await entryView(saved.queue, 1, await fake.snapshot()));
  const others = HEAD + READING_BY_OTHERS + WRITING;
  fake.land({ "SPEC.md": others });
  const writes = fake.writes.length;

  const result = await acceptEntries(fake.host, [shown], "alice", NOW, sources());

  assert.deepEqual(result.refused?.map(({ queue, entry }) => [queue, entry]), [[saved.queue, 1]]);
  assert.equal(fake.writes.length, writes, "no commit");
  assert.equal(fake.files()["SPEC.md"], others);
});

// Module (as the file header stated it): MOD-approvals · MOD-spec-changes · MOD-artifact-edits
// TST-476055 · level: component · module: MOD-spec-changes
// guards: A STALE APPROVAL IS NOT APPLIED; WITHOUT A TOKEN, THE INSTANCE'S WORKFLOW WRITES THE CHANGE; UC-006
// given: a record committed by hand for the first proposal, while (1) the entry's proposal was replaced by an edit of the entry in place (saveEntry), or afterwards (2) another writer changes the SPEC section; each in its own copy
// input: applyApproved on each copy's snapshot
// expect: in each the record is refused and named, nothing applied, and no changed SPEC returned (the SPEC of the copy stays as the host holds it); with the same record on an untouched copy it is applied, so the refusal is the stale text's
test("a stale record — applyApproved refuses it when the proposal or the SPEC section differs from the blobs it names", async () => {
  const build = async (staleness) => {
    const fake = repository();
    const saved = await proposeSection(fake.host, edit());
    const [recordPath, recordText] = handRecord({ queue: saved.queue, number: 1, proposal: READING_EDITED, section: READING });
    // An entry is edited in place only while it is open, so the edit is saved before the record of the first proposal lands.
    if (staleness === "proposal") await saveEntry(fake.host, { queue: saved.queue, entry: 1, text: READING_AGAIN, why: "Again.", person: "alice", openedBlob: gitBlob(READING_EDITED), openedHead: null });
    fake.land({ [recordPath]: recordText });
    if (staleness === "section") fake.land({ "SPEC.md": HEAD + READING_BY_OTHERS + WRITING });
    return { fake, recordPath };
  };
  const fresh = await build("none");
  assert.equal((await applyApproved(await fresh.fake.snapshot(), NOW)).applied.length, 1, "known positive: an untouched record is applied");

  for (const staleness of ["proposal", "section"]) {
    const { fake, recordPath } = await build(staleness);
    const spec = fake.files()["SPEC.md"];

    const { applied, refused, files } = await applyApproved(await fake.snapshot(), NOW);

    assert.deepEqual(applied, [], staleness);
    assert.deepEqual(refused.map((each) => each.record), [recordPath], staleness);
    assert.ok(!Object.hasOwn(files, "SPEC.md") || files["SPEC.md"] === spec, `${staleness}: no changed SPEC`);
  }
});
