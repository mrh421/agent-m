// Drafted use cases written open, their identifiers kept (ITM-336) — MOD-artifact-edits' editStrategies, as the accepted text of
// docs/architecture/MOD-artifact-edits.md states it: the check `identifier-kept` ("an error finding when a drafted change of an existing
// file carries another identifier than the file it changes; the finding names the identifier to keep") and the writer `open-files`
// ("commits drafted use cases or architecture files, in one commit on the default branch, as open files: a change to an existing
// identifier into that file, a new one under the next free identifier of its kind, never one the version history holds; a drafted module
// whose identifier the history holds is refused and named. A drafted file that the result's classes make a change or a duplicate of an
// existing one is written as a change to that file, not under a new identifier (UC-007 6a). A name a drafted use case realises that
// still matches no requirement after the loop's last round is removed from it, and the outcome's notes name the use case and the name; a
// use case that then realises nothing is written too, and the notes name it (UC-007 4a, 4b). While the result's `stepFindings` hold a
// finding of kind `error` under the rule A REUSE DECISION RECORDS ITS DUE DILIGENCE whose artifact is a drafted decision's path … it
// writes nothing and throws DueDiligenceMissing { decisions }. The commit carries the provenance lines; the files name no participant,
// model or version"), with MOD-job-runner's WriteOutcome — { commits, files, pullRequest, shown, notes } — and "a writer whose every file
// already stands on the head byte for byte commits nothing and returns an outcome without a commit". For UC-007 4a, 4b, 5, 6, 6a and UC-019
// 7, 8b. The recipe `items-of-kind` is not part of this item.
// Run: node --test tests/artifact-edits-open-files.test.mjs
//
// Module: MOD-artifact-edits
// Guards: UC-007; UC-019; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; A GENERATED ARTIFACT IS A PROPOSAL; ONE USE CASE, ONE FILE; THE NAME IS THE ID AND IT SURVIVES; AN EDITED FILE KEEPS ITS IDENTIFIER; A CI AGENT'S DRAFT ENTERS AS OPEN; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// Level: unit
//
// The repository server is replaced by a fixture: a fake host that keeps to MOD-repository-hosts' interface as docs/architecture/
// MOD-repository-hosts.md states it — one repository in memory with a history, whose default branch is `trunk`; repositoryInfo,
// readSnapshot, readHistory(null) — every commit with its changes, newest first — and commitFiles, a commit of all its files made only if
// the branch still stands at the expected head, else `Moved { head }`; every write recorded. Its other functions do not exist. The product
// is the small repository this file holds: a SPEC of two requirements, four use cases UC-001 to UC-004, a module MOD-lending, and a history
// that also holds UC-006, which a commit added and a later one deleted: the number only the history holds. The strategies are called as the
// job runner calls them: the writer with (result, context), the check with (draft, context, parts). The module file does not say how a
// drafted file is referred to in the result's classes, how the next identifier and the new path of a drafted new file are made, which
// error a refused module is, nor what the notes say; this file reads: a class's `refs` hold the drafted file's `path`; a new file's identifier
// and its first heading are replaced, and any other mention of an identifier the write renumbers in the drafted texts of the same write is
// replaced too, the path made `docs/use-cases/UC-<n>-<slug>.md` with the slug of the drafted path; a module whose identifier is ever used
// is refused with MOD-identifiers' IdentifierTaken, naming it; the notes read `<id> realised "<name>" which matches no requirement; removed`
// and `<id> realises no requirement`, each one line holding no comma (the End of the job's record lists a note as one item of `results`, in which a comma separates items); DueDiligenceMissing carries `decisions: [{ path, registry }]`. A name the module does not provide yet
// is undefined here, so that each test fails by itself. Nothing reaches the network. Each test states its input and its expected result
// before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import * as artifactEdits from "../src/artifact-edits/index.mjs";
import { provenanceLines } from "../src/job-runner/index.mjs";

const { editStrategies } = artifactEdits;
const open = () => editStrategies?.writers?.["open-files"];
const kept = () => editStrategies?.checks?.["identifier-kept"];

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const RULE = "A LOAN HAS A DUE DATE", OTHER = "A BOOK IS SHELVED";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`, "Every loan states the date by which the book is returned.",
  "*Check:* `tests/loan.test.mjs`", "", `**${OTHER}** *(Product Owner)*`, "Every book stands on a shelf.", "*Check:* `tests/shelf.test.mjs`");
const useCase = (id, title, goal, realises = [RULE]) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:",
  ...realises.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", `**Goal.** ${goal}`);
const UC_PATH = (id, slug) => `docs/use-cases/${id}-${slug}.md`;
const UC1 = useCase("UC-001", "Check out a book", "The member borrows a book.");
const UC2 = useCase("UC-002", "Extend a loan", "The member extends a loan once.");
const UC3 = useCase("UC-003", "Return a book", "The member returns a book.");
const UC4 = useCase("UC-004", "Reserve a book", "The member reserves a book that is out.");
const MODULE = text("---", "id: MOD-lending", "title: Lending", "folder: src/lending/", "realises:", `  - ${RULE}`, "follows:", "  - ARC-001", "uses:", "provides:", "  - lend",
  "---", "# MOD-lending Lending", "", "## Responsibility", "", "It lends a book.");
const WITHDRAWN = useCase("UC-006", "A withdrawn use case", "The member did something.");
const FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [UC_PATH("UC-001", "check-out-a-book")]: UC1, [UC_PATH("UC-002", "extend-a-loan")]: UC2,
  [UC_PATH("UC-003", "return-a-book")]: UC3, [UC_PATH("UC-004", "reserve-a-book")]: UC4, "docs/architecture/MOD-lending.md": MODULE };
const UC4_PATH = UC_PATH("UC-004", "reserve-a-book");

// ---------------------------------------------------------------- the fake host

const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
// A repository in memory: `steps` are the commits, each { added, modified, deleted } of files. The history is every commit with its changes.
function fakeHost() {
  const calls = [], commits = new Map(), order = [];
  let head = null, made = 0;
  const commitOf = (tree, changes) => {
    const sha = createHash("sha1").update(`commit ${++made}`).digest("hex");
    commits.set(sha, { tree, changes });
    order.unshift(sha);
    head = sha;
    return sha;
  };
  commitOf(new Map(Object.entries(FILES)), Object.keys(FILES).map((path) => ({ path, change: "added" })));
  const withdrawnPath = UC_PATH("UC-006", "withdrawn");
  commitOf(new Map([...commits.get(head).tree, [withdrawnPath, WITHDRAWN]]), [{ path: withdrawnPath, change: "added" }]);
  const t = new Map(commits.get(head).tree); t.delete(withdrawnPath);
  commitOf(t, [{ path: withdrawnPath, change: "deleted" }]);
  const snapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return { repository: ON_GITHUB, ref: "trunk", commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  return {
    head: () => head, files: () => Object.fromEntries(commits.get(head).tree), writes: () => calls.filter((call) => call.fn === "commitFiles"),
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) { calls.push({ fn: "readSnapshot", ref }); if (ref !== "trunk") throw failure("NotFound", `${ref} was not found`); return snapshotAt(head); },
      async readHistory(path, options = {}) {
        calls.push({ fn: "readHistory", path });
        return order.map((sha) => ({ commit: sha, parents: [], author: { account: null, name: "x" }, date: "2026-10-01T10:00:00Z", message: "", changes: commits.get(sha).changes }))
          .slice(0, options.limit ?? undefined);
      },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        const tree = new Map([...commits.get(head).tree, ...change.files.map((file) => [file.path, file.text])]);
        const sha = commitOf(tree, change.files.map((file) => ({ path: file.path, change: commits.get(head).tree.has(file.path) ? "modified" : "added" })));
        return { commit: sha, url: `${ON_GITHUB.web}/commit/${sha}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the job

const PARTICIPANT = { name: "drafter-a", model: "example-model" };
const AGENT_M = { version: "2026.10.0", commit: "abc123def456" };
function contextOf(fake, params = {}) {
  return { kind: { name: "derive-use-cases" }, params, product: { address: ON_GITHUB.web, snapshot: null, host: fake.host }, instance: { snapshot: null, host: null },
    connect: async () => fake.host, participants: [], places: { sources: {}, mailbox: null }, gates: [], person: "alice", now: new Date("2026-10-07T09:00:00Z"),
    agentM: AGENT_M, jobId: "JOB-20261007-0900-a1b2" };
}
// A result as the runner hands it to the writer: the draft, its classes as the person left them, what the steps found, the rounds.
const resultOf = (files, { classes = null, stepFindings = [], rounds = [{}, {}] } = {}) => ({ draft: { files }, raw: null, drafter: PARTICIPANT, rounds, remaining: [],
  forPerson: [], stepFindings, classes, stoppedBecause: "passed", gate: null, usage: [], written: null });
const drafted = (path, body, cls = "new", of = undefined) => ({ path, text: body, class: cls, ...(of ? { of } : {}) });
const classOf = (path, cls, of = null) => ({ refs: [path], from: [], class: cls, of, decidedBy: "participant" });
const PROVENANCE = provenanceLines({ agentM: AGENT_M, jobId: "JOB-20261007-0900-a1b2", kind: "derive-use-cases", participant: PARTICIPANT, rounds: 2, instruction: null });
const tail = (message) => message.split("\n").slice(-PROVENANCE.length);

// ---------------------------------------------------------------- new use cases

// TST-472033 · level: unit · module: MOD-artifact-edits
// guards: THE NAME IS THE ID AND IT SURVIVES; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; ONE USE CASE, ONE FILE; A CI AGENT'S DRAFT ENTERS AS OPEN
// given: the product whose head holds UC-001 to UC-004 and whose history also holds UC-006, added and deleted; two drafted new use cases that carry the placeholder identifiers UC-900 and UC-901 — the second mentions the first —, classed new
// input: the writer `open-files` with the result and the job's context
// expect: one commit on the head that was read holding two files: UC-007 and UC-008 — one past the highest number the history holds —, each at `docs/use-cases/UC-<n>-<slug>.md`, its front matter id and its first heading replaced, the mention of UC-900 in the second now UC-007, every other byte as drafted; the outcome names the commit and the two paths, with no pull request and no notes
test("open-files — two new use cases are written in one commit as UC-<n+1> and UC-<n+2>, past a number only the history holds", async () => {
  assert.ok(open(), `editStrategies.writers["open-files"]: ${artifactEdits.error?.message}`);
  const fake = fakeHost();
  const first = useCase("UC-900", "Return a card", "The member returns the card.");
  const second = useCase("UC-901", "Renew a card", "The member renews the card. Extends UC-900.");
  const outcome = await open()(resultOf([drafted(UC_PATH("UC-900", "return-a-card"), first), drafted(UC_PATH("UC-901", "renew-a-card"), second)],
    { classes: [classOf(UC_PATH("UC-900", "return-a-card"), "new"), classOf(UC_PATH("UC-901", "renew-a-card"), "new")] }), contextOf(fake));
  assert.equal(fake.writes().length, 1, "one commit");
  const [{ change }] = fake.writes();
  assert.equal(change.branch, "trunk");
  assert.deepEqual(change.files.map((file) => file.path), [UC_PATH("UC-007", "return-a-card"), UC_PATH("UC-008", "renew-a-card")]);
  assert.equal(change.files[0].text, first.replaceAll("UC-900", "UC-007"));
  assert.equal(change.files[1].text, second.replaceAll("UC-901", "UC-008").replaceAll("UC-900", "UC-007"));
  assert.equal(outcome.commits.length, 1);
  assert.deepEqual(outcome.files, change.files.map((file) => file.path));
  assert.equal(outcome.pullRequest, null);
  assert.deepEqual(outcome.notes, []);
});

// ---------------------------------------------------------------- changes

// TST-472034 · level: unit · module: MOD-artifact-edits
// guards: THE NAME IS THE ID AND IT SURVIVES; AN EDITED FILE KEEPS ITS IDENTIFIER; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
// given: a drafted change of UC-004, whose path is UC-004's, classed a change of UC-004
// input: the writer
// expect: one commit holding that one file, at UC-004's path, with the drafted text byte for byte; no new use case
test("open-files — a change of UC-004 is written into its file", async () => {
  assert.ok(open(), `editStrategies.writers["open-files"]: ${artifactEdits.error?.message}`);
  const fake = fakeHost();
  const changed = useCase("UC-004", "Reserve a book", "The member reserves a book that is out, for a week.");
  const outcome = await open()(resultOf([drafted(UC4_PATH, changed, "change", "UC-004")], { classes: [classOf(UC4_PATH, "change", "UC-004")] }), contextOf(fake));
  assert.equal(fake.writes().length, 1);
  assert.deepEqual(fake.writes()[0].change.files, [{ path: UC4_PATH, text: changed }]);
  assert.deepEqual(outcome.files, [UC4_PATH]);
  assert.equal(outcome.commits.length, 1);
});

// TST-472035 · level: unit · module: MOD-artifact-edits
// guards: THE NAME IS THE ID AND IT SURVIVES; A GENERATED ARTIFACT IS A PROPOSAL; UC-007
// given: two drafted use cases its participant classed new, under the placeholders UC-900 and UC-901, which the result's classes — as the person left them — make a change of UC-004 and a duplicate of UC-004
// input: the writer, once for each
// expect: each written as a change to UC-004's file — its path, its id and its first heading UC-004's, the rest as drafted — and no new identifier: the head after each commit holds UC-001 to UC-004 only
test("open-files — a draft the classes make a change or a duplicate of UC-004 is written there, not under a new identifier", async () => {
  assert.ok(open(), `editStrategies.writers["open-files"]: ${artifactEdits.error?.message}`);
  for (const [placeholder, cls] of [["UC-900", "change"], ["UC-901", "duplicate"]]) {
    const fake = fakeHost();
    const path = UC_PATH(placeholder, "reserve-a-title");
    const body = useCase(placeholder, "Reserve a book", "The member reserves a book that is out, for a week.");
    await open()(resultOf([drafted(path, body, "new")], { classes: [classOf(path, cls, "UC-004")] }), contextOf(fake));
    assert.equal(fake.writes().length, 1, cls);
    assert.deepEqual(fake.writes()[0].change.files, [{ path: UC4_PATH, text: body.replaceAll(placeholder, "UC-004") }], cls);
    assert.deepEqual(Object.keys(fake.files()).filter((p) => p.startsWith("docs/use-cases/")).sort(),
      ["UC-001", "UC-002", "UC-003", "UC-004"].map((id) => Object.keys(FILES).find((p) => p.includes(id))).sort(), `${cls}: no new file`);
  }
});

// ---------------------------------------------------------------- unknown names

// TST-472036 · level: unit · module: MOD-artifact-edits
// guards: UC-007; A GENERATED ARTIFACT IS A PROPOSAL
// given: a drafted new use case that realises A LOAN HAS A DUE DATE and AN UNKNOWN RULE, which the SPEC does not hold, and another that realises only AN UNKNOWN RULE
// input: the writer
// expect: both written, as UC-007 and UC-008: the first without the line of the unknown name, the second with its `realises:` list empty — every other byte as drafted —; the notes name the first use case and the name, the second and the name, and that the second realises no requirement
test("open-files — an unknown realised name is removed and noted, and a use case left realising nothing is written and noted", async () => {
  assert.ok(open(), `editStrategies.writers["open-files"]: ${artifactEdits.error?.message}`);
  const fake = fakeHost();
  const first = useCase("UC-900", "Return a card", "The member returns the card.", [RULE, "AN UNKNOWN RULE"]);
  const second = useCase("UC-901", "Renew a card", "The member renews the card.", ["AN UNKNOWN RULE"]);
  const p1 = UC_PATH("UC-900", "return-a-card"), p2 = UC_PATH("UC-901", "renew-a-card");
  const outcome = await open()(resultOf([drafted(p1, first), drafted(p2, second)], { classes: [classOf(p1, "new"), classOf(p2, "new")] }), contextOf(fake));
  const [{ change }] = fake.writes();
  assert.equal(change.files[0].text, useCase("UC-007", "Return a card", "The member returns the card.", [RULE]));
  assert.equal(change.files[1].text, text("---", "id: UC-008", "title: Renew a card", "area: lending", "actors:", "  - Member", "realises:", "---",
    "# UC-008 Renew a card", "", "**Goal.** The member renews the card."));
  assert.deepEqual(outcome.notes, ['UC-007 realised "AN UNKNOWN RULE" which matches no requirement; removed',
    'UC-008 realised "AN UNKNOWN RULE" which matches no requirement; removed', "UC-008 realises no requirement"]);
});

// TST-1384001 · level: unit · module: MOD-artifact-edits
// guards: UC-007; A USE CASE REALISES NAMED REQUIREMENTS; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: a drafted new use case that realises A LOAN HAS A DUE DATE, AN UNKNOWN RULE and AN UNKNOWN, SECOND RULE (a name that holds a comma), and another that realises only AN UNKNOWN RULE
// input: the writer
// expect: the notes name the first use case with AN UNKNOWN RULE, the first with AN UNKNOWN; SECOND RULE — the comma of the name shown as a semicolon —, and the second use case with AN UNKNOWN RULE and that it realises no requirement; no note holds a comma, since the End of the job's record lists each note as one item of `results`, in which a comma separates items; the first use case is written with neither unknown name
test("open-files — a note of a removed realised name holds no comma, whatever the name", async () => {
  assert.ok(open(), `editStrategies.writers["open-files"]: ${artifactEdits.error?.message}`);
  const fake = fakeHost();
  const first = useCase("UC-900", "Return a card", "The member returns the card.", [RULE, "AN UNKNOWN RULE", "AN UNKNOWN, SECOND RULE"]);
  const second = useCase("UC-901", "Renew a card", "The member renews the card.", ["AN UNKNOWN RULE"]);
  const p1 = UC_PATH("UC-900", "return-a-card"), p2 = UC_PATH("UC-901", "renew-a-card");
  const outcome = await open()(resultOf([drafted(p1, first), drafted(p2, second)], { classes: [classOf(p1, "new"), classOf(p2, "new")] }), contextOf(fake));
  assert.equal(fake.writes()[0].change.files[0].text, useCase("UC-007", "Return a card", "The member returns the card.", [RULE]), "both unknown names are removed from the first");
  assert.deepEqual(outcome.notes, ['UC-007 realised "AN UNKNOWN RULE" which matches no requirement; removed',
    'UC-007 realised "AN UNKNOWN; SECOND RULE" which matches no requirement; removed',
    'UC-008 realised "AN UNKNOWN RULE" which matches no requirement; removed', "UC-008 realises no requirement"]);
  assert.deepEqual(outcome.notes.filter((note) => note.includes(",")), [], "no note holds a comma");
});

// ---------------------------------------------------------------- nothing to write

// TST-472037 · level: unit · module: MOD-artifact-edits
// guards: A GENERATED ARTIFACT IS A PROPOSAL; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
// given: a result whose one file, a change of UC-004, is byte for byte what the head holds
// input: the writer
// expect: no commit; an outcome with no commit and no file, and no pull request
test("open-files — a result equal to the head commits nothing", async () => {
  assert.ok(open(), `editStrategies.writers["open-files"]: ${artifactEdits.error?.message}`);
  const fake = fakeHost();
  const before = fake.head();
  const outcome = await open()(resultOf([drafted(UC4_PATH, UC4, "change", "UC-004")], { classes: [classOf(UC4_PATH, "change", "UC-004")] }), contextOf(fake));
  assert.equal(fake.writes().length, 0, "no commit");
  assert.equal(fake.head(), before);
  assert.deepEqual(outcome.commits, []);
  assert.deepEqual(outcome.files, []);
  assert.equal(outcome.pullRequest, null);
});

// ---------------------------------------------------------------- the check

// TST-472038 · level: unit · module: MOD-artifact-edits
// guards: AN EDITED FILE KEEPS ITS IDENTIFIER; THE NAME IS THE ID AND IT SURVIVES
// given: a draft that changes UC-004 and carries the identifier UC-009; a draft that changes UC-004 and keeps UC-004; a new use case with a new identifier
// input: the check `identifier-kept` on each
// expect: for the first one error finding on the file's path, naming UC-004 as the identifier to keep and UC-009 as the one it carries; none for the others
test("identifier-kept — names a changed identifier and passes a kept one", async () => {
  assert.ok(kept(), `editStrategies.checks["identifier-kept"]: ${artifactEdits.error?.message}`);
  const fake = fakeHost();
  const context = contextOf(fake);
  const changed = useCase("UC-009", "Reserve a book", "The member reserves a book for a week.");
  const found = await kept()({ files: [drafted(UC4_PATH, changed, "change", "UC-004")] }, context, []);
  assert.equal(found.length, 1);
  assert.equal(found[0].kind, "error");
  assert.equal(found[0].artifact, UC4_PATH);
  assert.match(found[0].fix, /UC-004/, "the fix names the identifier to keep");
  assert.match(found[0].what, /UC-009/, "the finding names the one it carries");
  assert.deepEqual(await kept()({ files: [drafted(UC4_PATH, UC4.replace("a book that is out.", "a book."), "change", "UC-004")] }, context, []), []);
  assert.deepEqual(await kept()({ files: [drafted(UC_PATH("UC-900", "renew-a-card"), useCase("UC-900", "Renew a card", "x"), "new")] }, context, []), []);
});

// ---------------------------------------------------------------- modules

// TST-472039 · level: unit · module: MOD-artifact-edits
// guards: THE NAME IS THE ID AND IT SURVIVES
// given: a drafted new module MOD-lending, which the head holds and the history knows; and, as the known positive, a drafted new module MOD-fresh that no history holds
// input: the writer on each
// expect: for MOD-lending IdentifierTaken naming MOD-lending, nothing written; MOD-fresh written at `docs/architecture/MOD-fresh.md`
test("open-files — a module whose identifier the history holds is refused and named", async () => {
  assert.ok(open(), `editStrategies.writers["open-files"]: ${artifactEdits.error?.message}`);
  const fake = fakeHost();
  const taken = "docs/architecture/MOD-lending.md";
  const body = MODULE.replace("It lends a book.", "It lends and returns a book.");
  await assert.rejects(open()(resultOf([drafted(taken, body, "new")], { classes: [classOf(taken, "new")] }), contextOf(fake)),
    (error) => error.name === "IdentifierTaken" && error.message.includes("MOD-lending"));
  assert.equal(fake.writes().length, 0, "nothing written");
  const fresh = MODULE.replaceAll("MOD-lending", "MOD-fresh").replace("Lending", "Fresh");
  await open()(resultOf([drafted("docs/architecture/MOD-fresh.md", fresh, "new")], { classes: [classOf("docs/architecture/MOD-fresh.md", "new")] }), contextOf(fake));
  assert.deepEqual(fake.writes()[0].change.files, [{ path: "docs/architecture/MOD-fresh.md", text: fresh }]);
});

// ---------------------------------------------------------------- due diligence

// TST-472040 · level: unit · module: MOD-artifact-edits
// guards: A REUSE DECISION RECORDS ITS DUE DILIGENCE
// given: a drafted decision ARC-900 and a drafted module, and, among the step findings, the mark MOD-reuse-facts leaves on the decision — an error of the rule A REUSE DECISION RECORDS ITS DUE DILIGENCE on the decision's path, naming the registry npm — beside a warning of the rule DUE DILIGENCE IS FETCHED, NOT RECALLED
// input: the writer; and, as the known positive, the same result without the mark
// expect: with the mark nothing written and DueDiligenceMissing naming the decision's path and the registry npm; without it — with only the warning, an error of another rule and a warning of the mark's own rule — the files are written
test("open-files — the due-diligence mark writes nothing", async () => {
  assert.ok(open(), `editStrategies.writers["open-files"]: ${artifactEdits.error?.message}`);
  const fake = fakeHost();
  const arc = "docs/architecture/ARC-900-a-library.md";
  const decision = text("---", "id: ARC-900", "title: A library", "forced_by:", `  - ${RULE}`, "---", "# ARC-900 A library", "", "## Context", "", "x");
  const mark = { artifact: arc, line: 14, kind: "error", rule: "A REUSE DECISION RECORDS ITS DUE DILIGENCE",
    what: "the registry npm could not be read at https://registry.npmjs.org/example-lib: blocked by the browser", fix: "fetch the facts through a participant that can reach the web." };
  const warning = { artifact: arc, line: 14, kind: "warning", rule: "DUE DILIGENCE IS FETCHED, NOT RECALLED", what: "other-lib is not found", fix: "drop it" };
  const files = [drafted(arc, decision), drafted("docs/architecture/MOD-fresh.md", MODULE.replaceAll("MOD-lending", "MOD-fresh"))];
  await assert.rejects(open()(resultOf(files, { stepFindings: [warning, mark] }), contextOf(fake)), (error) => {
    assert.equal(error.name, "DueDiligenceMissing");
    assert.deepEqual(error.decisions, [{ path: arc, registry: "npm" }]);
    return true;
  });
  assert.equal(fake.writes().length, 0, "nothing written");
  // What is not the mark stops nothing: a warning, an error of another rule, and a warning of the mark's own rule, all on the decision.
  const otherError = { ...mark, rule: "A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT" }, warnedMark = { ...mark, kind: "warning" };
  await open()(resultOf(files, { stepFindings: [warning, otherError, warnedMark] }), contextOf(fake));
  assert.equal(fake.writes().length, 1, "known positive: without the mark the files are written");
});

// ---------------------------------------------------------------- provenance

// TST-472041 · level: unit · module: MOD-artifact-edits
// guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// given: a drafted new use case, a job context with Agent M's version and commit, the job's identifier, the kind, the drafter, and a result of two rounds
// input: the writer
// expect: the commit's message ends with MOD-job-runner's provenanceLines of that job — the version and commit, the job, the kind, the participant and its model, the rounds —, and none of those lines, nor the version, the participant, the model or the job's identifier, stands in the file
test("open-files — the provenance lines in the commit message and none in the files", async () => {
  assert.ok(open(), `editStrategies.writers["open-files"]: ${artifactEdits.error?.message}`);
  const fake = fakeHost();
  const path = UC_PATH("UC-900", "return-a-card");
  await open()(resultOf([drafted(path, useCase("UC-900", "Return a card", "The member returns the card."))], { classes: [classOf(path, "new")] }), contextOf(fake));
  const [{ change }] = fake.writes();
  assert.deepEqual(tail(change.message), PROVENANCE);
  for (const file of change.files) {
    for (const mention of ["Agent-M", "2026.10.0", "abc123def456", "drafter-a", "example-model", "JOB-20261007-0900-a1b2"]) {
      assert.ok(!file.text.includes(mention), `the file does not name ${mention}`);
    }
  }
});
