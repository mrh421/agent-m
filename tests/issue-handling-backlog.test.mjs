// An issue is prefilled as a backlog item and moved into the backlog in one decision (ITM-1250) — MOD-issue-handling's `backlogItemFrom` and `moveToBacklog` as the accepted text of docs/architecture/MOD-issue-handling.md states them (:70-82):
// "`backlogItemFrom(issue, cls, analysis, changed) -> { item, place }` — the backlog item a person checks before adding it (UC-033): its title from the issue's title, its outcome from the issue's description, its origin the issue's address, what it
// realises — for a bug the requirement the analysis names as violated, for a change the requirements `changed` names — and the modules the analysis names. Errors: `NotClassified` for an issue
// without a class — no item is offered." and "`moveToBacklog(host, issue, item, existing)` — the person's one click *Add* (UC-033): the item written through Process's `saveItems`; then the comment `item-added` on the issue, naming the item and its address,
// and the label `backlog`, also for a second issue added to an existing item. When the token may not comment, the item is written all the same and the comment's text and the issue's address are returned for the person to copy (UC-033)."
// UC-033 steps 2 to 4 and 4a, 4b.
// Run: node --test tests/issue-handling-backlog.test.mjs
//
// Module: MOD-issue-handling; MOD-work-plans
// Guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; EVERY ARTIFACT NAMES ITS ORIGIN; THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; A REFERENCE NAMES THE IDENTIFIER, NOT THE POSITION; ONE CLICK PER DECISION; UC-033
// Level: unit
//
// The host is a fake of MOD-repository-hosts' Host with the product's files at one head: repositoryInfo (its default branch main), readSnapshot, readHistory, commitFiles, commentOnIssue, setIssueLabels and webLinks, each call recorded; nothing reaches the
// network. The items are read back with MOD-documents' item schema and checked with MOD-work-plans' backlogFindings. Readings the texts leave open, which the tests state (the pull request names them):
//   - `backlogItemFrom` gives `{ item: { fields, sections } }`, the form `saveItems` takes: the fields title, level (module), realises, modules, tests (unit) and origin (the issue's address), the sections ## Outcome (the issue's text) and ## Acceptance.
//     `NotClassified` is thrown for every class but bug and change (UC-033 precondition: "classified as *bug* or *change*"); the issue's `comments` are no part of the outcome.
//   - `moveToBacklog` reads the default branch's head and the module files of the architecture itself, since its interface gives neither; the item is committed by `saveItems` first, then the comment, then the label. The comment is MOD-mail-records'
//     `noteText("item-added", <item>, <date>, <link>)` and the link the item file's page on the product's server (`webLinks().file`), since the module knows no instance and so no address on the dashboard.
//   - A comment refused for want of the permission (`PermissionMissing`) returns `{ item, comment: { text, issue } }` with the label not set; any other failure of the comment or the label passes unchanged, the item being committed already. With `existing`, the item
//     of that identifier is rewritten with the issue's address added to its origins, and the `item` given is not used; an identifier the backlog lacks is `NotFound { path }`, nothing written.

import test from "node:test";
import assert from "node:assert/strict";
import { artifactSchemas, readDocument } from "../src/documents/index.mjs";
import { noteText } from "../src/mail-records/index.mjs";
import { backlogFindings } from "../src/work-plans/index.mjs";
import * as handling from "../src/issue-handling/index.mjs";

const HEAD = "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678";
const ISSUE = { number: 57, title: "Export is not a PDF", body: "The export writes a text file, not a PDF.", comments: [{ body: "Same here.", createdAt: "2026-10-20T08:00:00Z" }], address: "https://github.com/alice/thesis-tool/issues/57" };
const SECOND = { number: 58, address: "https://github.com/alice/thesis-tool/issues/58" };

const moduleText = (id, folder) => ["---", `id: ${id}`, `title: ${id}`, `folder: ${folder}`, "realises: []", "follows:", "  - ARC-001", "uses: []", "provides: []", "---", `# ${id} ${id}`, "",
  "## Responsibility", "", "It exports.", "", "## Parts", "", "- index.mjs", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "None.", "", "## Files", "", "None.", "", "## Uses", "", "None.", ""].join("\n");
const itemText = (id, title, origin) => ["---", `id: ${id}`, `title: ${title}`, "level: module", "realises:", "  - EXPORT IS A PDF", "modules:", "  - MOD-export", "tests:", "  - unit", "origin:", ...origin.map((each) => `  - ${each}`), "---",
  `# ${id} ${title}`, "", "## Outcome", "", "Done.", "", "## Acceptance", "", "- a unit test.", ""].join("\n");
const FILES = () => ({ "docs/architecture/MOD-export.md": moduleText("MOD-export", "src/export/"), "docs/architecture/MOD-store.md": moduleText("MOD-store", "src/store/"),
  "docs/backlog/ITM-001-the-first.md": itemText("ITM-001", "The first", ["https://github.com/alice/thesis-tool/issues/12"]) });
// The history holds ITM-003 as withdrawn, so that no new item may take 003 or a number below it.
const HISTORY = [{ changes: [{ path: "docs/backlog/ITM-003-gone.md", from: null }] }];

function hostWith(files, { comment = null, label = null, history = HISTORY } = {}) {
  const calls = [];
  return {
    calls,
    async repositoryInfo() { return { defaultBranch: "main" }; },
    async readSnapshot(ref) { calls.push(["readSnapshot", ref]); return { ref, commit: HEAD, paths: Object.keys(files), blob: (path) => (path in files ? `blob-${path}` : null), read: async (path) => files[path] ?? null }; },
    async readHistory(path, options) { calls.push(["readHistory", path, options]); return history; },
    async commitFiles(change) { calls.push(["commitFiles", change]); return { commit: "c".repeat(40), url: "https://example.org/c" }; },
    async commentOnIssue(number, body) { calls.push(["commentOnIssue", number, body]); if (comment) throw comment; },
    async setIssueLabels(number, change) { calls.push(["setIssueLabels", number, change]); if (label) throw label; },
    webLinks() { return { file: (path, ref) => `https://github.com/alice/thesis-tool/blob/${ref}/${path}` }; },
  };
}
const named = (name, fields = {}) => Object.assign(new Error(name), { name, ...fields });
const failure = (promise) => Promise.resolve(promise).then(() => null, (error) => error);
const committed = (host) => host.calls.filter(([what]) => what === "commitFiles").map(([, change]) => change);
const order = (host) => host.calls.map(([what]) => what).filter((what) => ["commitFiles", "commentOnIssue", "setIssueLabels"].includes(what));
const textOfSection = (item, heading) => item.sections.find((section) => section.heading === heading)?.text ?? null;
const architectureOf = (files) => Object.entries(files).filter(([path]) => path.startsWith("docs/architecture/")).map(([path, text]) => readDocument(artifactSchemas().module, path, text));

// TST-1250101 · level: unit · module: MOD-issue-handling
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; EVERY ARTIFACT NAMES ITS ORIGIN; UC-033
// given: counter-proof — before the change MOD-issue-handling offers neither backlogItemFrom nor moveToBacklog; a bug issue 57 with a title, a text and a comment; the analysis names the violated requirement EXPORT IS A PDF and the module MOD-export; `changed` names a requirement
// input: backlogItemFrom(issue, "bug", { violated: "EXPORT IS A PDF", modules: ["MOD-export"] }, ["SOME CHANGED RULE"])
// expect: both functions are offered; the item's title is the issue's title, its outcome the issue's text without the comment, its origin the issue's address alone; it realises EXPORT IS A PDF alone — `changed` is for a change —, changes MOD-export, is of level module with the tests unit, and has an ## Acceptance section; MOD-work-plans' backlogFindings finds no error in it
test("backlogItemFrom — a bug realises the requirement the analysis names as violated, takes its title, outcome and origin from the issue", () => {
  assert.equal(typeof handling.backlogItemFrom, "function", "backlogItemFrom is offered");
  assert.equal(typeof handling.moveToBacklog, "function", "moveToBacklog is offered");
  const { item } = handling.backlogItemFrom(ISSUE, "bug", { violated: "EXPORT IS A PDF", modules: ["MOD-export"] }, ["SOME CHANGED RULE"]);
  assert.equal(item.fields.title, "Export is not a PDF");
  assert.deepEqual(item.fields.realises, ["EXPORT IS A PDF"]);
  assert.deepEqual(item.fields.modules, ["MOD-export"]);
  assert.deepEqual(item.fields.origin, [ISSUE.address]);
  assert.equal(item.fields.level, "module");
  assert.deepEqual(item.fields.tests, ["unit"]);
  assert.equal(textOfSection(item, "## Outcome").trim(), "The export writes a text file, not a PDF.");
  assert.ok(textOfSection(item, "## Acceptance") !== null && textOfSection(item, "## Acceptance").trim() !== "", "the acceptance has a text");
  assert.deepEqual(backlogFindings([item], architectureOf(FILES())).filter((each) => each.kind === "error"), []);
});

// TST-1250102 · level: unit · module: MOD-issue-handling
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-033
// given: a change issue 57; `changed` names EXPORT IS A PDF twice and EXPORT NAMES ITS PAGES; the analysis names a violated requirement and the module MOD-export
// input: backlogItemFrom(issue, "change", { violated: "SOME OTHER RULE", modules: ["MOD-export"] }, changed)
// expect: the item realises EXPORT IS A PDF and EXPORT NAMES ITS PAGES, each once, in the order of `changed`, and not the violated one; its origin is the issue's address
test("backlogItemFrom — a change realises the requirements the queues change, each once", () => {
  const { item } = handling.backlogItemFrom(ISSUE, "change", { violated: "SOME OTHER RULE", modules: ["MOD-export"] }, ["EXPORT IS A PDF", "EXPORT NAMES ITS PAGES", "EXPORT IS A PDF"]);
  assert.deepEqual(item.fields.realises, ["EXPORT IS A PDF", "EXPORT NAMES ITS PAGES"]);
  assert.deepEqual(item.fields.origin, [ISSUE.address]);
});

// TST-1250103 · level: unit · module: MOD-issue-handling
// guards: EVOLUTION ENTERS THROUGH THE SPECIFICATION; UC-033
// given: known positive first (TST-1250101: a bug is prefilled); the issue 57
// input: backlogItemFrom with the class not-reproducible, rejected, "not classified" and undefined
// expect: each throws an error named NotClassified and offers no item
test("backlogItemFrom — an issue that is not classified as a bug or a change is NotClassified", () => {
  assert.doesNotThrow(() => handling.backlogItemFrom(ISSUE, "bug", { violated: "EXPORT IS A PDF", modules: [] }, []));
  for (const cls of ["not-reproducible", "rejected", "not classified", undefined]) {
    assert.throws(() => handling.backlogItemFrom(ISSUE, cls, { violated: null, modules: [] }, []), { name: "NotClassified" }, `${cls}`);
  }
});

// TST-1250104 · level: unit · module: MOD-issue-handling, MOD-work-plans
// guards: THE BACKLOG LIVES IN THE PRODUCT REPOSITORY; EVERY ARTIFACT NAMES ITS ORIGIN; ONE CLICK PER DECISION; UC-033
// given: a product holding ITM-001 and the modules MOD-export and MOD-store, whose history holds ITM-003 as withdrawn; the change item prefilled for issue 57
// input: moveToBacklog(host, { number: 57, address }, item, null)
// expect: exactly one commit on main at the head, of one new file docs/backlog/ITM-004-export-is-not-a-pdf.md (not 002 and not 003) whose origin is the issue's address and which reads back as the item; then one comment on issue 57, MOD-mail-records' item-added note for ITM-004 with the link to the file on the server; then the label backlog on issue 57; in this order; the result names ITM-004 and no comment to copy
test("moveToBacklog — writes the item through saveItems, then comments on the issue naming it, then labels the issue backlog", async () => {
  const host = hostWith(FILES());
  const { item } = handling.backlogItemFrom(ISSUE, "change", { violated: null, modules: ["MOD-export"] }, ["EXPORT IS A PDF"]);
  const result = await handling.moveToBacklog(host, { number: 57, address: ISSUE.address }, item, null);
  assert.deepEqual(result, { item: "ITM-004", comment: null });
  const commits = committed(host);
  assert.equal(commits.length, 1);
  assert.equal(commits[0].branch, "main");
  assert.equal(commits[0].expectedHead, HEAD);
  assert.deepEqual(commits[0].files.map((file) => file.path), ["docs/backlog/ITM-004-export-is-not-a-pdf.md"]);
  const written = readDocument(artifactSchemas().item, commits[0].files[0].path, commits[0].files[0].text);
  assert.equal(written.fields.id, "ITM-004");
  assert.deepEqual(written.fields.origin, [ISSUE.address]);
  assert.deepEqual(written.fields.realises, ["EXPORT IS A PDF"]);
  const link = "https://github.com/alice/thesis-tool/blob/main/docs/backlog/ITM-004-export-is-not-a-pdf.md";
  assert.deepEqual(host.calls.filter(([what]) => what === "commentOnIssue"), [["commentOnIssue", 57, noteText("item-added", "ITM-004", "2026-10-20", link)]]);
  const labels = host.calls.filter(([what]) => what === "setIssueLabels");
  assert.equal(labels.length, 1);
  assert.equal(labels[0][1], 57);
  assert.deepEqual(labels[0][2].add, ["backlog"]);
  assert.deepEqual(labels[0][2].remove ?? [], []);
  assert.deepEqual(order(host), ["commitFiles", "commentOnIssue", "setIssueLabels"]);
});

// TST-1250105 · level: unit · module: MOD-issue-handling
// guards: UC-033 4b; ONE CLICK PER DECISION
// given: known positive first (TST-1250104: the comment is written); a token that may not comment (the host answers PermissionMissing to the comment)
// input: moveToBacklog for issue 57
// expect: the item is committed all the same; no failure; the result names ITM-004 and returns the comment's text — the same as would have been written — with the issue's address; no label is set
test("moveToBacklog — when the token may not comment, the item is written and the comment's text and the issue's address are returned to copy", async () => {
  const host = hostWith(FILES(), { comment: named("PermissionMissing", { permission: "Issues (read and write)", renewal: "https://github.com/settings/tokens" }) });
  const { item } = handling.backlogItemFrom(ISSUE, "change", { violated: null, modules: ["MOD-export"] }, ["EXPORT IS A PDF"]);
  const result = await handling.moveToBacklog(host, { number: 57, address: ISSUE.address }, item, null);
  const link = "https://github.com/alice/thesis-tool/blob/main/docs/backlog/ITM-004-export-is-not-a-pdf.md";
  assert.deepEqual(result, { item: "ITM-004", comment: { text: noteText("item-added", "ITM-004", "2026-10-20", link), issue: ISSUE.address } });
  assert.equal(committed(host).length, 1);
  assert.deepEqual(order(host), ["commitFiles", "commentOnIssue"]);
});

// TST-1250106 · level: unit · module: MOD-issue-handling, MOD-work-plans
// guards: A BACKLOG ITEM NAMES WHAT IT REALISES; A BACKLOG ITEM NAMES THE MODULES IT CHANGES; UC-033 3
// given: a bug issue whose analysis names no violated requirement, so that its item realises nothing; a change whose item names a module the architecture does not describe
// input: moveToBacklog for each
// expect: it fails with ItemsRefused, whose findings name the rule; nothing is committed, no comment is written and no label set
test("moveToBacklog — an item saveItems refuses is not written, and the issue is neither commented nor labelled", async () => {
  for (const [cls, analysis] of [["bug", { violated: null, modules: ["MOD-export"] }], ["change", { violated: null, modules: ["MOD-nowhere"] }]]) {
    const host = hostWith(FILES());
    const { item } = handling.backlogItemFrom(ISSUE, cls, analysis, ["EXPORT IS A PDF"]);
    const error = await failure(handling.moveToBacklog(host, { number: 57, address: ISSUE.address }, item, null));
    assert.equal(error?.name, "ItemsRefused", `${cls}: ${error?.message}`);
    assert.ok(error.findings.length >= 1);
    assert.deepEqual(order(host), [], `${cls}: nothing was written`);
  }
});

// TST-1250107 · level: unit · module: MOD-issue-handling
// guards: UC-033 4a; EVERY ARTIFACT NAMES ITS ORIGIN
// given: the backlog holds ITM-001 with the origin of issue 12; a second issue 58 describing the same work
// input: moveToBacklog(host, issue 58, an item that is not used, "ITM-001"), and then with "ITM-077", which the backlog lacks
// expect: one commit rewriting docs/backlog/ITM-001-the-first.md alone, whose origins are the address of issue 12 and then the address of issue 58 and whose other fields are as they were; the comment and the label go to issue 58; the result names ITM-001; for ITM-077 NotFound and nothing written
test("moveToBacklog — a second issue added to an existing item joins its origins, and both are named", async () => {
  const host = hostWith(FILES());
  const { item } = handling.backlogItemFrom(ISSUE, "change", { violated: null, modules: ["MOD-export"] }, ["EXPORT IS A PDF"]);
  const result = await handling.moveToBacklog(host, SECOND, item, "ITM-001");
  assert.equal(result.item, "ITM-001");
  assert.equal(result.comment, null);
  const commits = committed(host);
  assert.equal(commits.length, 1);
  assert.deepEqual(commits[0].files.map((file) => file.path), ["docs/backlog/ITM-001-the-first.md"]);
  const written = readDocument(artifactSchemas().item, commits[0].files[0].path, commits[0].files[0].text);
  assert.deepEqual(written.fields.origin, ["https://github.com/alice/thesis-tool/issues/12", SECOND.address]);
  assert.deepEqual([written.fields.title, written.fields.realises, written.fields.modules], ["The first", ["EXPORT IS A PDF"], ["MOD-export"]]);
  assert.deepEqual(host.calls.filter(([what]) => what === "commentOnIssue").map(([, number]) => number), [58]);
  assert.deepEqual(host.calls.filter(([what]) => what === "setIssueLabels").map(([, number]) => number), [58]);
  const lacking = hostWith(FILES());
  const error = await failure(handling.moveToBacklog(lacking, SECOND, item, "ITM-077"));
  assert.equal(error?.name, "NotFound");
  assert.deepEqual(order(lacking), []);
});

// TST-1250108 · level: unit · module: MOD-issue-handling
// guards: A REMOTE INTERFACE NAMES HOW IT FAILS; UC-033
// given: known positive first (TST-1250104); a host that answers RateLimited to the comment, and one that answers TokenRefused to the label
// input: moveToBacklog for issue 57 on each
// expect: the failure passes unchanged; the item is committed already (once) in both
test("moveToBacklog — a failure of the comment or the label other than a missing permission passes unchanged", async () => {
  const { item } = handling.backlogItemFrom(ISSUE, "change", { violated: null, modules: ["MOD-export"] }, ["EXPORT IS A PDF"]);
  const limited = hostWith(FILES(), { comment: named("RateLimited", { limit: "the account's", resetsAt: null }) });
  assert.equal((await failure(handling.moveToBacklog(limited, { number: 57, address: ISSUE.address }, item, null)))?.name, "RateLimited");
  assert.equal(committed(limited).length, 1);
  const refused = hostWith(FILES(), { label: named("TokenRefused", { tokenName: "alice", renewal: "https://github.com/settings/tokens" }) });
  assert.equal((await failure(handling.moveToBacklog(refused, { number: 57, address: ISSUE.address }, item, null)))?.name, "TokenRefused");
  assert.equal(committed(refused).length, 1);
});

// TST-1254101 · level: unit · module: MOD-issue-handling
// guards: UC-033 4b; ONE CLICK PER DECISION
// given: known positive first (TST-1250105: a token that may not comment yields the comment to copy); no token for the issue tracker is stored, so that MOD-repository-hosts' commentOnIssue fails NotSupported before any request, as src/repository-hosts/index.mjs states it
// input: moveToBacklog for issue 57 on a host that answers NotSupported { what: "commenting on an issue without a token" } to the comment
// expect: no failure; the item is committed once; the result names ITM-004 and returns the comment's text — the same as would have been written — with the issue's address; no label is set
test("moveToBacklog — without a token for the issue tracker, the item is written and the comment's text and the issue's address are returned to copy", async () => {
  const { item } = handling.backlogItemFrom(ISSUE, "change", { violated: null, modules: ["MOD-export"] }, ["EXPORT IS A PDF"]);
  const refused = hostWith(FILES(), { comment: named("PermissionMissing", { permission: "Issues (read and write)", renewal: "https://github.com/settings/tokens" }) });
  assert.notEqual((await handling.moveToBacklog(refused, { number: 57, address: ISSUE.address }, item, null)).comment, null, "known positive: a token that may not comment");
  const host = hostWith(FILES(), { comment: named("NotSupported", { what: "commenting on an issue without a token" }) });
  const result = await handling.moveToBacklog(host, { number: 57, address: ISSUE.address }, item, null);
  const link = "https://github.com/alice/thesis-tool/blob/main/docs/backlog/ITM-004-export-is-not-a-pdf.md";
  assert.deepEqual(result, { item: "ITM-004", comment: { text: noteText("item-added", "ITM-004", "2026-10-20", link), issue: ISSUE.address } });
  assert.equal(committed(host).length, 1);
  assert.deepEqual(order(host), ["commitFiles", "commentOnIssue"]);
});
