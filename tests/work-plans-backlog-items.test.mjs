// The writer `backlog-items` of MOD-work-plans' `workStrategies` and `saveItems` (ITM-617; UC-032 steps 3 and 4), as the accepted text of docs/architecture/MOD-work-plans.md states them (blob 939afd6c4e7e, approved in
// docs/approvals/MOD-work-plans-939afd6c4e7e.md): ":281 writer `backlog-items` — the drafted items through `saveItems`, with the job's provenance lines", and ":222-228 `saveItems(host, change: { items: Document[], removed:
// string[] }, context: { architecture, head, trailers }) -> Promise<{ commit, written, warnings }>` — Add to backlog and + Item (UC-032), an item pointed at a replacing requirement or removed (UC-032 1a), and Move to backlog
// (UC-033): `backlogFindings` first, and with an error finding nothing is written; a warning — an item that restates an existing one — is returned with the commit; a new item gets an identifier that no history holds; one
// commit of the item files under `docs/backlog/`. An item added while a sprint runs enters the backlog, never the sprint's selection. Errors: `ItemsRefused { findings }`, and the host's."
// Run: node --test tests/work-plans-backlog-items.test.mjs
//
// Module: MOD-work-plans
// Guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES; EVERY ARTIFACT NAMES ITS ORIGIN; THE NAME IS THE ID AND IT SURVIVES; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// Level: unit
//
// The product is a fixture in memory behind a host of this file's own, which keeps the commits it is given and answers readHistory with commits that changed a withdrawn item's file; nothing reaches the network. The draft is
// the answer of the kind `propose-items`. The readings where the text leaves one open, which the pull request names:
//   - `origin` of a drafted item is the list of the requirements and use cases it realises, which it descends from (UC-032 Goal: "Its items come from accepted requirements and use cases"; EVERY ARTIFACT NAMES ITS ORIGIN). The
//     job, the participant and the model stand in the commit's provenance lines only (AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT: "the artifact's own text names none of them").
//   - The writer saves every entry the draft holds. `class` and `of` are not written and decide nothing: an entry that restates an existing item is the person's to keep or discard before Add (UC-032 4), and `saveItems`
//     returns the warning of `backlogFindings` with the commit, which the writer names in the outcome's notes.
//   - `## Outcome` is the entry's `outcome` as written; `## Acceptance` is one bullet "- " for each entry of `acceptance`, as the items of the backlog write theirs.
//   - The item format requires `level` and `tests` (and `integrates` for the level subsystem), which the answer does not carry. The tests are the levels the acceptance names as "unit", "component", "system" or "release"
//     tests (UC-032 3: the criteria "name the tests of its level"); the level is the highest of them — unit module, component subsystem, system or release system; the subsystem is the decision the item's modules all follow.
//     An entry whose acceptance names no such level, or whose modules follow no one decision at the level subsystem, is refused with ItemsRefused and nothing is written.
//   - The item format requires `level` and `tests` (src/documents/schemas/item.schema.md: required, not only for a plan step; writeDocument throws without them), and the text of saveItems lists `ItemsRefused` and the host's errors only: an
//     identifier to remove that the backlog does not hold is refused as ItemsRefused with an error finding naming it, and nothing is written.
//   - A new item gets the next identifier after every one the head's paths and the history of the repository hold, a withdrawn one among them (as src/artifact-edits/strategies.mjs:116-119 does). An entry of `buildsOn` that is
//     a title names the existing item or the other entry of that title, and becomes its identifier.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { artifactSchemas, readDocument } from "../src/documents/index.mjs";
import { provenanceLines } from "../src/job-runner/index.mjs";
import * as workPlans from "../src/work-plans/index.mjs";

const lines = (...rows) => `${rows.join("\n")}\n`;
const ADDRESS = "https://github.com/acme/product";
const HEAD = "c".repeat(40);
const writer = workPlans.workStrategies.writers?.["backlog-items"];

// ---------------------------------------------------------------- the fixture product

const module_ = (id, follows) => lines("---", `id: ${id}`, `title: ${id}`, `folder: src/${id.slice(4)}/`, "realises:", "follows:", `  - ${follows}`, "uses: []", "provides:", "  - f", "---", `# ${id} ${id}`, "", "## Responsibility", "", "r",
  "", "## Parts", "", "p", "", "## Data", "", "d", "", "## Interfaces", "", "- `f` — i", "", "## Files", "", "f", "", "## Uses", "", "u");
const item = (id, title) => lines("---", `id: ${id}`, `title: ${title}`, "level: module", "realises:", "  - ALPHA RULE", "modules:", "  - MOD-store", "tests:", "  - unit", "origin:", "  - ALPHA RULE", "---", `# ${id} ${title}`, "", "## Outcome", "",
  "o", "", "## Acceptance", "", "- a");

const FILES = {
  "SPEC.md": lines("# Fixture", "", "## 1. Rules", "", "**ALPHA RULE** *(Owner)*", "A rule.", "*Check:* no automatic check; at review."),
  "docs/architecture/MOD-store.md": module_("MOD-store", "ARC-001"),
  "docs/architecture/MOD-pages.md": module_("MOD-pages", "ARC-001"),
  "docs/architecture/MOD-other.md": module_("MOD-other", "ARC-002"),
  "docs/backlog/ITM-001-read-the-store.md": item("ITM-001", "Read the store"),
  "docs/backlog/ITM-003-old-and-gone.md": item("ITM-003", "Old and gone"),
};
// The history holds a withdrawn item, ITM-1400, higher than any file's (the highest file is ITM-003), and a renamed one.
const HISTORY = [
  { commit: "h2", changes: [{ path: "docs/backlog/ITM-1400-withdrawn.md", from: null }] },
  { commit: "h1", changes: [{ path: "docs/backlog/ITM-002-renamed.md", from: "docs/backlog/ITM-002-first-name.md" }] },
];

const entry = (title, over = {}) => ({ title, outcome: `OUTCOME OF ${title}`, realises: ["ALPHA RULE", "UC-002"], modules: ["MOD-store"], buildsOn: [], acceptance: ["Unit tests of the write path.", "A counter-proof."], class: "new", ...over });

// A host that keeps the commits and the questions it is asked.
function hostOf(files = FILES, history = HISTORY) {
  const commits = [], asked = [];
  const snapshot = { paths: Object.keys(files), commit: HEAD, blob: () => null, read: async (path) => (Object.hasOwn(files, path) ? files[path] : null) };
  const host = {
    async repositoryInfo() { return { defaultBranch: "main" }; },
    async readSnapshot(ref) { asked.push(["readSnapshot", ref]); return snapshot; },
    async readHistory(path, options) { asked.push(["readHistory", path, options]); return history; },
    async commitFiles(request) { commits.push(request); return { commit: "d".repeat(40), url: "u" }; },
  };
  return { host, snapshot, commits, asked };
}
const DRAFTER = { name: "item-bot", model: "model-x" };
const JOB_ID = "JOB-20261023-0900-ab12";
function jobOf(items, { files = FILES, history = HISTORY } = {}) {
  const setup = hostOf(files, history);
  const context = { kind: { name: "propose-items" }, params: {}, jobId: JOB_ID, product: { address: ADDRESS, snapshot: setup.snapshot, host: setup.host }, instance: { snapshot: setup.snapshot, host: null, checkout: null },
    places: { sources: {}, mailbox: null, contents: [] }, agentM: { version: "unreleased", commit: "a".repeat(40) }, person: "alice", now: new Date("2026-10-23T08:00:00Z") };
  const result = { draft: { items }, drafter: DRAFTER, rounds: [{ number: 1 }] };
  return { ...setup, context, result, write: () => {
    assert.equal(typeof writer, "function", "workStrategies offers the writer backlog-items");
    return writer(result, context);
  } };
}
const textOf = (job, path) => job.commits[0].files.find((file) => file.path === path)?.text;

const WRITE = entry("Write the store", { buildsOn: ["Read the store"] });
const INTEGRATE = entry("Integrate pages", { realises: ["UC-002"], modules: ["MOD-store", "MOD-pages"], buildsOn: ["Write the store"], acceptance: ["Component tests of the pages subsystem.", "The postcondition of UC-002 holds."] });
const ITM_1401 = "docs/backlog/ITM-1401-write-the-store.md", ITM_1402 = "docs/backlog/ITM-1402-integrate-pages.md";

// TST-617001 · level: unit · module: MOD-work-plans
// guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES
// given: the fixture product, whose backlog holds ITM-001 "Read the store" and ITM-003, and a draft of two entries: "Write the store" (module store, builds on the existing item by its title, acceptance names unit tests) and "Integrate pages" (modules store and pages, builds on the first entry by its title, acceptance names component tests)
// input: the writer backlog-items
// expect: one commit on the default branch at the snapshot's head, of two new files only, docs/backlog/ITM-1401-write-the-store.md and docs/backlog/ITM-1402-integrate-pages.md; the outcome names the commit and the two files, no pull request, nothing shown; the first file is the canonical text of the item (level module, tests unit, builds_on ITM-001, origin its realised names, the sections Outcome as written and Acceptance one bullet each); the second has level subsystem, tests component, integrates ARC-001 and builds_on ITM-1401
// Planted fault: committing on another head or branch, a second file, or leaving the title unresolved changes the request.
test("the writer saves the drafted items in one commit, as canonical item files", async () => {
  const job = jobOf([WRITE, INTEGRATE]);
  const outcome = await job.write();
  assert.equal(job.commits.length, 1);
  const [request] = job.commits;
  assert.deepEqual([request.branch, request.expectedHead], ["main", HEAD]);
  assert.deepEqual(request.files.map((file) => file.path), [ITM_1401, ITM_1402]);
  assert.deepEqual([outcome.commits, outcome.files, outcome.pullRequest, outcome.shown], [["d".repeat(40)], [ITM_1401, ITM_1402], null, null]);
  assert.equal(textOf(job, ITM_1401), lines("---", "id: ITM-1401", "title: Write the store", "level: module", "realises:", "  - ALPHA RULE", "  - UC-002", "modules:", "  - MOD-store", "builds_on:", "  - ITM-001", "tests:", "  - unit",
    "origin:", "  - ALPHA RULE", "  - UC-002", "---", "# ITM-1401 Write the store", "", "## Outcome", "", "OUTCOME OF Write the store", "", "## Acceptance", "", "- Unit tests of the write path.", "- A counter-proof."));
  const second = readDocument(artifactSchemas().item, ITM_1402, textOf(job, ITM_1402));
  assert.deepEqual([second.fields.level, second.fields.tests, second.fields.integrates, second.fields.builds_on], ["subsystem", ["component"], "ARC-001", ["ITM-1401"]]);
});

// TST-617002 · level: unit · module: MOD-work-plans
// guards: THE NAME IS THE ID AND IT SURVIVES; UC-032
// given: the fixture product, whose files hold ITM-001 and ITM-003 and whose history holds a withdrawn ITM-1400 (a commit that added its file) and a renamed ITM-002; the same product with an empty history
// input: the writer on a draft of one entry
// expect: the history was asked once for the repository with its changes (path null, ref main, `changes` not switched off); the new item is ITM-1401, one after the withdrawn ITM-1400 that no file holds; with an empty history it is ITM-004, one after the highest file
// Planted fault: taking the identifier from the head's paths alone gives ITM-004 for the first product.
test("a new item gets an identifier that no history holds, a withdrawn one included", async () => {
  const job = jobOf([WRITE]);
  await job.write();
  assert.deepEqual(job.commits[0].files.map((file) => file.path), [ITM_1401]);
  const asked = job.asked.filter(([what]) => what === "readHistory");
  assert.equal(asked.length, 1);
  assert.equal(asked[0][1], null);
  assert.equal(asked[0][2].ref, "main");
  assert.notEqual(asked[0][2].changes, false);
  const bare = jobOf([WRITE], { history: [] });
  await bare.write();
  assert.deepEqual(bare.commits[0].files.map((file) => file.path), ["docs/backlog/ITM-004-write-the-store.md"]);
});

// TST-617003 · level: unit · module: MOD-work-plans
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// given: the job JOB-20261023-0900-ab12 of the kind propose-items, drafted by the participant item-bot of model-x after one round, from Agent M's commit aaaa…, and a draft of one entry that realises ALPHA RULE and UC-002
// input: the writer
// expect: the item's origin is exactly ["ALPHA RULE", "UC-002"], and its text names neither the job, the participant nor the model; the commit's message begins "Add to the backlog" and ends with the provenance lines of provenanceLines for this job (version and commit, job, kind propose-items, participant item-bot, model model-x, 1 round)
// Planted fault: an origin naming the job or the participant, or a message without the trailers, changes the item or the message.
test("origin is what the item realises, and the commit carries the job's provenance lines", async () => {
  const job = jobOf([WRITE]);
  await job.write();
  const saved = readDocument(artifactSchemas().item, ITM_1401, textOf(job, ITM_1401));
  assert.deepEqual(saved.fields.origin, ["ALPHA RULE", "UC-002"]);
  assert.ok(!/item-bot|model-x|JOB-2026/.test(textOf(job, ITM_1401)));
  const expected = provenanceLines({ agentM: job.context.agentM, jobId: JOB_ID, kind: "propose-items", participant: DRAFTER, rounds: 1 });
  assert.ok(expected.length >= 6, "known positive: the lines exist");
  assert.match(job.commits[0].message, /^Add to the backlog/);
  assert.ok(job.commits[0].message.endsWith(expected.join("\n")), "the message ends with the provenance lines");
});

// TST-617004 · level: unit · module: MOD-work-plans
// guards: UC-032; A BACKLOG ITEM NAMES WHAT IT REALISES
// given: the fixture product, and a draft of one entry classed `duplicate` of the existing ITM-001 (`of`), whose title restates ITM-001's: "Read the store"
// input: the writer
// expect: the entry is saved like any other, as a new item ITM-1401, with neither `class` nor `of` in its text; the outcome's notes hold the warning that it restates ITM-001
// Planted fault: dropping an entry classed duplicate leaves no commit; writing `class` into the item adds a line to its text.
test("an entry classed duplicate is saved like the others, and the warning that it restates an item is returned in the notes", async () => {
  const job = jobOf([entry("Read the store", { class: "duplicate", of: "ITM-001" })]);
  const outcome = await job.write();
  assert.deepEqual(outcome.files, ["docs/backlog/ITM-1401-read-the-store.md"]);
  assert.ok(!/class|duplicate/.test(textOf(job, outcome.files[0])));
  assert.equal(outcome.notes.length, 1);
  assert.match(outcome.notes[0], /ITM-1401/);
  assert.match(outcome.notes[0], /restates ITM-001/);
  assert.equal(outcome.notes[0].includes("warning"), true);
});

// TST-617005 · level: unit · module: MOD-work-plans
// guards: UC-032; A BACKLOG ITEM NAMES THE MODULES IT CHANGES
// given: the fixture product, and drafts whose acceptance names the tests of each level: a system entry naming system and release tests (modules store and pages), a unit entry, an entry naming no level of test, an entry of component tests over modules that follow different decisions (store, other), and an entry naming a module the architecture does not describe
// input: the writer on each
// expect: system and release tests give level system, tests ["system", "release"], and no `integrates`; the unit entry gives level module and ["unit"]; the entry naming no level is refused with ItemsRefused, an error finding for it; the component entry over two decisions is refused likewise; the entry naming an undescribed module is refused with ItemsRefused whose finding is backlogFindings' (the module); for each refusal nothing is committed
// Planted fault: defaulting the level to module for an entry that names none, or guessing a decision, writes a commit for a refusal.
test("the level and tests of an item are the levels its acceptance names, and an entry that names none is refused with nothing written", async () => {
  const system = jobOf([entry("Whole system", { modules: ["MOD-store", "MOD-pages"], acceptance: ["System tests of the whole.", "Release tests by another participant."] })]);
  await system.write();
  const saved = readDocument(artifactSchemas().item, system.commits[0].files[0].path, system.commits[0].files[0].text);
  assert.deepEqual([saved.fields.level, saved.fields.tests, saved.fields.integrates ?? null], ["system", ["system", "release"], null]);
  const refused = async (draft) => {
    const job = jobOf([draft]);
    await assert.rejects(job.write(), (error) => error.name === "ItemsRefused" && Array.isArray(error.findings) && error.findings.length >= 1 && error.findings.every((each) => each.kind === "error"));
    assert.deepEqual(job.commits, []);
  };
  await refused(entry("No level named", { acceptance: ["It works."] }));
  await refused(entry("Two decisions", { modules: ["MOD-store", "MOD-other"], acceptance: ["Component tests."] }));
  await refused(entry("Unknown module", { modules: ["MOD-nowhere"] }));
});

// TST-617006 · level: unit · module: MOD-work-plans
// guards: UC-032
// given: the fixture product, and a draft of two entries of which the second names an item that does not exist under buildsOn ("A ghost")
// input: the writer
// expect: it is refused with ItemsRefused, whose findings name the second entry's item as building on "A ghost", which does not exist, and nothing at all is committed, the first entry's file included
// Planted fault: committing the entries that pass writes a commit for the first.
test("one entry with an error finding keeps the whole draft from being written", async () => {
  const job = jobOf([WRITE, entry("Needs a ghost", { buildsOn: ["A ghost"] })]);
  await assert.rejects(job.write(), (error) => error.name === "ItemsRefused" && error.findings.some((each) => /A ghost/.test(each.what) && /does not exist/.test(each.what)));
  assert.deepEqual(job.commits, []);
});

// TST-617007 · level: unit · module: MOD-work-plans
// guards: UC-032; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the fixture product, and saveItems called as the page calls it for a person's own input: one new item with no identifier, one existing item ITM-001 rewritten under its identifier with a new outcome, ITM-003 removed, and removing an item the backlog does not hold (ITM-777)
// input: saveItems(host, { items, removed }, { architecture, head, trailers: [] })
// expect: one commit of three file writes: the new item under ITM-1401, ITM-001's file at its own path with the new text, and ITM-003's file deleted (`delete: true`); the result names the commit, the written paths and no warnings; the call that removes ITM-777 throws ItemsRefused whose one error finding names ITM-777 and commits nothing; no sprint record is among the files
// Planted fault: a rewrite under a new path, or a deletion left out, changes the files.
test("saveItems adds, rewrites and removes items in one commit, and refuses to remove an item the backlog lacks", async () => {
  const setup = hostOf();
  const architecture = [...Object.entries(FILES)].filter(([path]) => path.includes("/MOD-")).map(([path, text]) => readDocument(artifactSchemas().module, path, text));
  const rewritten = { fields: { id: "ITM-001", title: "Read the store, rewritten", level: "module", realises: ["ALPHA RULE"], modules: ["MOD-store"], tests: ["unit"], origin: ["ALPHA RULE"] },
    sections: [{ heading: "## Outcome", text: "\nNEW OUTCOME\n\n" }, { heading: "## Acceptance", text: "\n- a\n" }] };
  const fresh = { fields: { title: "Brand new", level: "module", realises: ["ALPHA RULE"], modules: ["MOD-pages"], tests: ["unit"], origin: ["ALPHA RULE"] },
    sections: [{ heading: "## Outcome", text: "\nfresh\n\n" }, { heading: "## Acceptance", text: "\n- a\n" }] };
  assert.equal(typeof workPlans.saveItems, "function", "MOD-work-plans provides saveItems");
  const result = await workPlans.saveItems(setup.host, { items: [fresh, rewritten], removed: ["ITM-003"] }, { architecture, head: HEAD, trailers: [] });
  assert.equal(setup.commits.length, 1);
  assert.deepEqual(setup.commits[0].files.map((file) => [file.path, file.delete === true]), [["docs/backlog/ITM-1401-brand-new.md", false], ["docs/backlog/ITM-001-read-the-store.md", false], ["docs/backlog/ITM-003-old-and-gone.md", true]]);
  assert.match(setup.commits[0].files[1].text, /NEW OUTCOME/);
  assert.deepEqual([result.commit, result.written, result.warnings], ["d".repeat(40), ["docs/backlog/ITM-1401-brand-new.md", "docs/backlog/ITM-001-read-the-store.md"], []]);
  const lacking = hostOf();
  await assert.rejects(workPlans.saveItems(lacking.host, { items: [], removed: ["ITM-777"] }, { architecture, head: HEAD, trailers: [] }), (error) => error.name === "ItemsRefused" && error.findings.length === 1 && error.findings[0].kind === "error" && /ITM-777/.test(error.findings[0].what));
  assert.deepEqual(lacking.commits, []);
});
