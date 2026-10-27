// Review core — the records, the status and the sections of the review layout, through MOD-approvals, MOD-spec-changes,
// MOD-spec-document, MOD-text-tools and MOD-artifact-edits. Deterministic, no network. Run: node --test tests/*.test.mjs
//
// Module: MOD-approvals
// Guards: STATUS IS DERIVED FROM THE RECORDS; AN APPROVAL NAMES THE EXACT TEXT; AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL; A STALE APPROVAL IS NOT APPLIED; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; A PROPOSAL IS REJECTED WITH A REASON; A REJECTION REMOVES THE PROPOSAL; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; ADDING A PRODUCT CREATES ITS LAYOUT; GITLAB PRODUCTS ARE SUPPORTED; A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN; A PRODUCT IS NAMED BY ITS ADDRESS; UC-001; UC-006; UC-008; UC-023
// Level: unit
//
// SPEC.md names this file as the check of requirements of several modules. The checks of the other modules live in
// tests/review-core.d/, one file per module, and this file runs every file of that folder (at its end): a failing check there
// makes this file red. Those files are not matched by tests/*.test.mjs, so CI runs each check once. The dashboard's writes are
// those of its modules, checked with them: accepting in tests/approvals-accept.test.mjs and tests/spec-changes-accept.test.mjs,
// saving an edit in tests/artifact-edits-save.test.mjs, adding a product and the product settings in the tests of MOD-settings-pages.
// Rejecting is checked here: a reviewed file (MOD-approvals) in this file, a SPEC change entry and the Reject on the pages in
// tests/review-core.d/.
// The product a check writes into is held by tests/memory-host.mjs.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { blobSha } from "../src/text-tools/index.mjs";
import { readDocument } from "../src/documents/index.mjs";
import * as approvals from "../src/approvals/index.mjs";
import { queues, acceptEntries } from "../src/spec-changes/index.mjs";

// rejectShown is read off the module, so that a module without it fails the tests that call it and not the whole file.
const { approvalSchema, statusOf, rejectShown } = approvals;
import { sectionText, replaceSection } from "../src/spec-document/index.mjs";
import { reviewLayoutCommit } from "../src/artifact-edits/index.mjs";
import { memoryHost } from "./memory-host.mjs";
import { recordText, approvalPath } from "./approval-records.mjs";
import {
  QD, WHEN, B_SPEC, B_P05, B_P06, B_INDEX, B_UC1, B_UC2,
} from "./review-core.d/helpers.mjs";

const gitHash = (s) => execFileSync("git", ["hash-object", "--stdin"], { input: s }).toString().trim();
const NO_SOURCES = { links: null, register: [] };

function batchRepo(over = {}) {
  return { "SPEC.md": B_SPEC, [`${QD}/index.md`]: B_INDEX, [`${QD}/05-a.md`]: B_P05, [`${QD}/06-b.md`]: B_P06,
    [`${QD}/entscheidungen.md`]: "# Decisions\n\nAppend-only.\n\n",
    "docs/use-cases/UC-001-a.md": B_UC1, "docs/use-cases/UC-002-b.md": B_UC2, ...over };
}
const snapshotOf = (files) => memoryHost(files).host.readSnapshot("main");
// The state of entry `nr` of the queue QD in a product.
const stateOf = async (files, nr) => (await queues(await snapshotOf(files))).find((q) => q.folder === QD).entries.find((e) => e.number === nr).state;

test("blobSha equals git hash-object, byte for byte", async () => {
  for (const s of ["", "a\n", "no trailing newline", "Umlaute äöü — und ✓\n", "x".repeat(5000)]) {
    assert.equal(await blobSha(s), gitHash(s), JSON.stringify(s.slice(0, 20)));
  }
});

test("records round-trip and carry no text", () => {
  const r = { kind: "use-case", file: "docs/use-cases/UC-001-x.md", blob: "a".repeat(40) };
  assert.deepEqual(readDocument(approvalSchema, "docs/approvals/UC-001-aaaaaaaaaaaa.md", recordText(r)).fields, r);
  assert.equal(recordText(r).trimEnd().split("\n").length, 3, "three lines: kind, file, blob");
  assert.equal(approvalPath("UC-001", "0123456789abcdef".padEnd(40, "0")), "docs/approvals/UC-001-0123456789ab.md");
  const s = { kind: "spec", queue: "docs/spec-freigaben/q", entry: "01", proposal: "docs/spec-freigaben/q/01-a.md",
    blob: "b".repeat(40), target: "SPEC.md", anchor: "## 9. Human gates", section: "c".repeat(40) };
  assert.deepEqual(readDocument(approvalSchema, "docs/approvals/spec-q-01-bbbbbbbbbbbb.md", recordText(s)).fields, s);
});

test("sectionText: heading to the next heading of level two, its exact bytes, code fences masked", () => {
  const spec = "# T\n\n## 1. A\ntext\n```\n## not a heading\n```\n### sub\nmore\n\n## 2. B\nb\n";
  assert.equal(sectionText(spec, "## 1. A"), "## 1. A\ntext\n```\n## not a heading\n```\n### sub\nmore\n\n", "the blank line before 2. B included");
  assert.equal(sectionText(spec, "## 3. C"), null);
  assert.equal(sectionText(spec, "## 2. B"), "## 2. B\nb\n");
  assert.equal(sectionText(spec, "## not a heading"), null, "a heading inside a fenced block is none");
});

test("queue index and decisions: each entry with its anchor and end, and its state from the decision rows", async () => {
  const index = "# SPEC approvals — queue 2026-09-23 · q\n\n**Zieldatei aller Einträge:** `products/agent-m/SPEC.md`\n\n" +
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |\n|---|---|---|---|---|\n" +
    "| 01 | `SPEC.md` | ## 9. Human gates | — | — |\n| 02 | `SPEC.md` | ## 2. X | ## 3. Y | — |\n";
  const folder = "docs/spec-freigaben/2026-09-23_q";
  const [queue] = await queues(await snapshotOf({ "SPEC.md": "# S\n\n## 2. X\n\nx\n## 3. Y\n\ny\n## 9. Human gates\n\ng\n",
    [`${folder}/index.md`]: index, [`${folder}/01-a.md`]: "## 9. Human gates\n\nnew\n", [`${folder}/02-b.md`]: "## 2. X\n\nnew\n",
    [`${folder}/entscheidungen.md`]: "# D\n\nAppend-only.\n\n| 2026-09-23 21:53 UTC | 1 | uebernommen | approval:spec-2026-09-23_q-01-aaaaaaaaaaaa.md |\n" }));
  assert.equal(queue.target, "products/agent-m/SPEC.md");
  assert.deepEqual(queue.entries.map((e) => [e.number, e.anchor, e.until, e.state]),
    [[1, "## 9. Human gates", null, "in SPEC"], [2, "## 2. X", "## 3. Y", "open"]]);
});

test("STATUS IS DERIVED FROM THE RECORDS: use cases", async () => {
  const f = "docs/use-cases/UC-001-x.md", text = "---\nid: UC-001\n---\n# x\n", blob = await blobSha(text);
  const record = (id, file, named) => ({ [approvalPath(id, named)]: recordText({ kind: "use-case", file, blob: named }) });
  assert.equal(statusOf(f, blob, await snapshotOf({ [f]: text })), "open");
  assert.equal(statusOf(f, blob, await snapshotOf({ [f]: text, ...record("UC-001", f, blob) })), "accepted");
  assert.equal(statusOf(f, blob, await snapshotOf({ [f]: text, ...record("UC-001", f, "b".repeat(40)) })), "changed");
  assert.equal(statusOf(f, blob, await snapshotOf({ [f]: text, ...record("UC-002", "docs/use-cases/UC-002-y.md", blob) })), "open");
});

test("STATUS IS DERIVED FROM THE RECORDS: SPEC proposals", async () => {
  const section = sectionText(B_SPEC, "## 10. R"), proposalBlob = await blobSha(B_P05), sectionBlob = await blobSha(section);
  const record = (over = {}) => {
    const fields = { kind: "spec", queue: QD, entry: "05", proposal: `${QD}/05-a.md`, blob: proposalBlob, target: "SPEC.md",
      anchor: "## 10. R", section: sectionBlob, ...over };
    return { [approvalPath("spec-2026-09-24g_x-05", fields.blob)]: recordText(fields) };
  };
  assert.equal(await stateOf(batchRepo(), 5), "open");
  assert.equal(await stateOf(batchRepo(record()), 5), "approved");
  assert.equal(await stateOf(batchRepo(record({ blob: "a".repeat(40) })), 5), "stale", "a record of another proposal");
  assert.equal(await stateOf(batchRepo(record({ section: "a".repeat(40) })), 5), "stale", "a record of another section");
  const row = `| 2026-09-29 16:03 UTC | 5 | uebernommen | approval:spec-2026-09-24g_x-05-${proposalBlob.slice(0, 12)}.md |\n`;
  assert.equal(await stateOf(batchRepo({ ...record(), [`${QD}/entscheidungen.md`]: `# Decisions\n\nAppend-only.\n\n${row}` }), 5), "in SPEC");
});

// ---------------------------------------------------------------- one click per decision (queue 2026-09-24)

test("ADDING A PRODUCT CREATES ITS LAYOUT — only what is missing", async () => {
  const written = async (files) => {
    const product = memoryHost(files);
    const done = await reviewLayoutCommit(product.host);
    return { done, files: (product.commits()[0]?.files ?? []).map((f) => f.path).sort(), texts: product.files() };
  };
  const all = await written({});
  assert.deepEqual(all.files, ["CHANGELOG.md", "SPEC.md", "docs/approvals/README.md", "docs/architecture/README.md",
    "docs/spec-freigaben/README.md", "docs/use-cases/README.md"]);
  const some = await written({ "SPEC.md": "# S\n", "docs/use-cases/UC-001-x.md": B_UC1 });
  assert.deepEqual(some.files, ["CHANGELOG.md", "docs/approvals/README.md", "docs/architecture/README.md", "docs/spec-freigaben/README.md"]);
  assert.match(all.texts["SPEC.md"], /VERBINDLICH \(SPEC\)/);
  assert.deepEqual((await written(all.texts)).done, { complete: true }, "a complete layout writes nothing");
});

// ---------------------------------------------------------------- one commit per decision (queue 2026-09-24g, entry 05)
// AN ACCEPTED SPEC CHANGE IS WRITTEN WITH ITS APPROVAL · A STALE APPROVAL IS NOT APPLIED ·
// SEVERAL FILES ARE ACCEPTED IN ONE CLICK · A QUEUE IS ACCEPTED IN ITS ORDER (UC-006 4–7, 4d, 5a; UC-008 3d)

// What the dashboard showed of entry 05: the proposal and the section beside it, each by its blob SHA.
const shown05 = async () => ({ queue: QD, entry: 5, proposalBlob: await blobSha(B_P05), sectionBlob: await blobSha(sectionText(B_SPEC, "## 10. R")) });

test("the decision row of an accepted entry is the row of the decision table", async () => {
  const product = memoryHost(batchRepo());
  assert.ok((await acceptEntries(product.host, [await shown05()], "alice", WHEN, NO_SOURCES)).commit);
  const record = `spec-2026-09-24g_x-05-${(await blobSha(B_P05)).slice(0, 12)}.md`;
  assert.equal(product.files()[`${QD}/entscheidungen.md`], `# Decisions\n\nAppend-only.\n\n| 2026-09-29 16:03 UTC | 5 | uebernommen | approval:${record} |\n`);
  assert.ok(product.files()[`docs/approvals/${record}`], "the record in the same commit");
});

test("replaceSection writes the proposal byte for byte, every other byte unchanged", () => {
  assert.equal(replaceSection(B_SPEC, "## 10. R", "## 10. R\n\nnew\n"), "# S\n\n**VERBINDLICH (SPEC)**\n\n## 9. G\n\nold nine\n## 10. R\n\nnew\n");
  assert.equal(replaceSection(B_SPEC, "## 9. G", "## 9. G\nnine\n"), "# S\n\n**VERBINDLICH (SPEC)**\n\n## 9. G\nnine\n## 10. R\n\nold ten\n");
  assert.throws(() => replaceSection(B_SPEC, "## 11. X", "x\n"), (e) => e.name === "SectionNotFound");
});

test("an entry already written in the queue's decisions is not written twice", async () => {
  const name = `spec-2026-09-24g_x-05-${(await blobSha(B_P05)).slice(0, 12)}.md`;
  const product = memoryHost(batchRepo({ [`${QD}/entscheidungen.md`]: `# D\n\n| 2026-09-29 16:03 UTC | 5 | uebernommen | approval:${name} |\n` }));
  const done = await acceptEntries(product.host, [await shown05()], "alice", WHEN, NO_SOURCES);
  assert.deepEqual(product.commits(), []);
  assert.match(done.refused[0].reason, /already/);
});

// ---------------------------------------------------------------- rejecting a reviewed file (queue 2026-10-27, A proposal is rejected with a reason)
// A PROPOSAL IS REJECTED WITH A REASON · A REJECTION REMOVES THE PROPOSAL · A STALE APPROVAL IS NOT APPLIED ·
// WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK · NO TEXT TRAVELS IN A URL (UC-008 3f, UC-023 5b). MOD-approvals' rejectShown;
// the rejection of a SPEC change entry is MOD-spec-changes' (tests/review-core.d/spec-changes-reject.test.mjs), the Reject on the
// pages MOD-review-pages' (tests/review-core.d/review-pages-reject.test.mjs).

const UC1 = "docs/use-cases/UC-001-a.md", UC2 = "docs/use-cases/UC-002-b.md";
const UC1_CHANGED = "---\nid: UC-001\n---\n# one, and more\n";
const REASON = "It widens the use case beyond what the SPEC asks.";
// A product whose UC-001 was accepted with the text B_UC1 and then changed to UC1_CHANGED, and whose UC-002 was never accepted.
async function changedProduct() {
  const product = memoryHost(batchRepo({ [approvalPath("UC-001", await blobSha(B_UC1))]: recordText({ kind: "use-case", file: UC1, blob: await blobSha(B_UC1) }) }));
  const { commit } = await product.host.readSnapshot("main");
  await product.host.commitFiles({ branch: "main", expectedHead: commit, files: [{ path: UC1, text: UC1_CHANGED }], message: "an edit" });
  return { product, made: product.commits().length };
}
// The same host, read without a token: GitHub answers that it may not be written (MOD-repository-hosts, RepositoryInfo.canWrite).
const withoutToken = (host) => ({ ...host, repositoryInfo: async () => ({ defaultBranch: "main", canWrite: false }) });

// TST-2026271001 · level: unit · module: MOD-approvals
// guards: A PROPOSAL IS REJECTED WITH A REASON
// given: the changed UC-001 and the never-accepted UC-002, each shown with its current blob; known positive: with a reason, rejectShown writes
// input: rejectShown with no reason, an empty one and one of blanks only
// expect: each a TypeError before anything is written; no commit
test("TST-2026271001: Reject without a reason writes nothing", async () => {
  const { product, made } = await changedProduct();
  for (const reason of [undefined, "", "  \n "]) {
    await assert.rejects(rejectShown(product.host, { path: UC1, blob: await blobSha(UC1_CHANGED) }, "alice", reason), TypeError, JSON.stringify(reason));
  }
  assert.equal(product.commits().length, made, "nothing written");
  assert.ok((await rejectShown(product.host, { path: UC2, blob: await blobSha(B_UC2) }, "alice", REASON)).commit, "known positive: with a reason it writes");
});

// TST-2026271002 · level: unit · module: MOD-approvals
// guards: A REJECTION REMOVES THE PROPOSAL; STATUS IS DERIVED FROM THE RECORDS
// given: UC-001 accepted with the text B_UC1, then changed; its record names B_UC1's blob
// input: rejectShown of UC-001 as shown now, by alice, with a reason
// expect: one commit on the head that was read, which writes UC-001 back to B_UC1 byte for byte and nothing else; its message names UC-001, alice and the reason; UC-001 is accepted again
test("TST-2026271002: rejecting a changed use case restores its accepted text in one commit whose message holds the reason", async () => {
  const { product, made } = await changedProduct();
  const head = (await product.host.readSnapshot("main")).commit;
  const done = await rejectShown(product.host, { path: UC1, blob: await blobSha(UC1_CHANGED) }, "alice", REASON);
  const commits = product.commits().slice(made);
  assert.equal(commits.length, 1, "one commit");
  assert.equal(commits[0].expectedHead, head, "on the head that was read");
  assert.deepEqual(commits[0].files, [{ path: UC1, text: B_UC1 }], "the accepted text back, nothing else");
  assert.match(commits[0].message, /UC-001/);
  assert.match(commits[0].message, /alice/);
  assert.ok(commits[0].message.includes(REASON), "the reason in the message");
  assert.ok(done.commit);
  assert.equal(statusOf(UC1, await blobSha(B_UC1), await product.host.readSnapshot("main")), "accepted");
});

// TST-2026271003 · level: unit · module: MOD-approvals
// guards: A REJECTION REMOVES THE PROPOSAL
// given: UC-002, which no record names; known positive: UC-001's rejection writes its text back (TST-2026271002)
// input: rejectShown of UC-002 as shown, with a reason
// expect: one commit that deletes UC-002 and nothing else, its message holding the reason; the file has left the working tree
test("TST-2026271003: rejecting a never-accepted use case removes the file", async () => {
  const { product, made } = await changedProduct();
  await rejectShown(product.host, { path: UC2, blob: await blobSha(B_UC2) }, "alice", REASON);
  const commits = product.commits().slice(made);
  assert.equal(commits.length, 1, "one commit");
  assert.deepEqual(commits[0].files, [{ path: UC2, delete: true }]);
  assert.ok(commits[0].message.includes(REASON));
  assert.equal(product.files()[UC2], undefined, "UC-002 has left the working tree");
});

// TST-2026271004 · level: unit · module: MOD-approvals
// guards: A STALE APPROVAL IS NOT APPLIED; A REJECTION REMOVES THE PROPOSAL
// given: UC-001 changed after it was shown (the blob shown is another than the head's), and UC-001 at its accepted text
// input: rejectShown with the blob shown before the change; rejectShown of the accepted text
// expect: ChangedSinceShown and NothingToReject, nothing written
test("TST-2026271004: a rejection of a text that is no longer the current one writes nothing", async () => {
  const { product, made } = await changedProduct();
  await assert.rejects(rejectShown(product.host, { path: UC1, blob: await blobSha("an older text\n") }, "alice", REASON), { name: "ChangedSinceShown" });
  await assert.rejects(rejectShown(product.host, { path: "docs/use-cases/UC-003-c.md", blob: await blobSha(B_UC1) }, "alice", REASON), { name: "ChangedSinceShown" }, "a file that is gone");
  const accepted = memoryHost(batchRepo({ [approvalPath("UC-001", await blobSha(B_UC1))]: recordText({ kind: "use-case", file: UC1, blob: await blobSha(B_UC1) }) }));
  await assert.rejects(rejectShown(accepted.host, { path: UC1, blob: await blobSha(B_UC1) }, "alice", REASON), { name: "NothingToReject" });
  assert.equal(product.commits().length, made, "nothing written");
  assert.equal(accepted.commits().length, 0, "nothing written");
});

// TST-2026271005 · level: unit · module: MOD-approvals
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
// given: the changed UC-001 and the never-accepted UC-002 of a product on github.com, read without a token
// input: rejectShown of each, with a reason
// expect: nothing written; for UC-001 GitHub's editor of its file with the accepted text returned beside the link; for UC-002 GitHub's page that deletes it, with no text; no link carries a text
test("TST-2026271005: without a token, a rejection opens GitHub's pages, prepared as far as GitHub allows", async () => {
  const { product, made } = await changedProduct();
  const host = withoutToken(product.host);
  const restored = await rejectShown(host, { path: UC1, blob: await blobSha(UC1_CHANGED) }, "alice", REASON);
  const removed = await rejectShown(host, { path: UC2, blob: await blobSha(B_UC2) }, "alice", REASON);
  const web = "https://github.com/memory-owner/memory-repository";
  assert.deepEqual(restored.fallback.map(({ url, path, text }) => ({ url, path, text })), [{ url: `${web}/edit/main/${UC1}`, path: UC1, text: B_UC1 }]);
  assert.deepEqual(removed.fallback.map(({ url, path, text }) => ({ url, path, text })), [{ url: `${web}/delete/main/${UC2}`, path: UC2, text: null }]);
  assert.equal(product.commits().length, made, "nothing written");
});

// ---------------------------------------------------------------- GitLab products (queue 2026-09-24b)
// GITLAB PRODUCTS ARE SUPPORTED · A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN · A PRODUCT IS NAMED BY ITS ADDRESS
// (UC-001 3c/3d, UC-006).

test("A GITLAB PRODUCT USES A PROJECT ACCESS TOKEN — the settings page takes whether a token may write from the host", () => {
  // The role check — Maintainer may write, Developer may not — is MOD-repository-hosts' own (tests/repository-hosts.test.mjs, TST-476076);
  // the live settings page (MOD-settings-pages) takes whether the token may write from the host's repositoryInfo.
  const pages = new URL("../src/settings-pages/", import.meta.url);
  const page = readFileSync(new URL("settings.mjs", pages), "utf8");
  assert.match(page, /repository\.canWrite === true/, "the settings page takes the role check from the host");
  const app = [readFileSync(new URL("../src/site-frame/dashboard-app.mjs", import.meta.url), "utf8"),
    ...readdirSync(pages).filter((n) => n.endsWith(".mjs")).map((n) => readFileSync(new URL(n, pages), "utf8"))].join("\n");
  assert.doesNotMatch(app, /role Developer|role <em>Developer<\/em>|>= 30/, "the app names no Developer token any more");
});

// ---------------------------------------------------------------- the checks of the other modules (tests/review-core.d/)

const FOLDER = new URL("./review-core.d/", import.meta.url);
for (const f of readdirSync(FOLDER).filter((n) => n.endsWith(".mjs")).sort()) await import(new URL(f, FOLDER));
