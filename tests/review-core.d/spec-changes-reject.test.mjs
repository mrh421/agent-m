// Rejecting a SPEC change entry — MOD-spec-changes' rejectEntry: the entry leaves its queue in one commit under the rejecting person's
// account, with the reason in its message; no approval record is written, and the SPEC is unchanged (UC-006 4a). Deterministic, no network.
// Run through tests/review-core.test.mjs, which SPEC.md names for these checks: node --test tests/*.test.mjs
//
// Module: MOD-spec-changes
// Guards: A PROPOSAL IS REJECTED WITH A REASON; A REJECTION REMOVES THE PROPOSAL; A STALE APPROVAL IS NOT APPLIED; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; UC-006
// Level: unit
//
// The product is the queue QD of tests/review-core.d/helpers.mjs — entry 05 replaces ## 10. R and creates ## 11. X, entry 06 replaces ## 11. X —, each
// entry with its rationale, held by tests/memory-host.mjs. The entry leaves its queue with its proposal, its rationale and its row of the index; a
// queue whose last entry leaves goes with it, every file of its folder (the reading this item takes: a queue of no entry decides nothing).

import test from "node:test";
import assert from "node:assert/strict";
import * as specChanges from "../../src/spec-changes/index.mjs";
import { sectionText } from "../../src/spec-document/index.mjs";
import { blobSha } from "../../src/text-tools/index.mjs";
import { memoryHost } from "../memory-host.mjs";
import { approvalPath, recordText } from "../approval-records.mjs";
import { QD, B_SPEC, B_P05, B_P06, B_INDEX } from "./helpers.mjs";

// rejectEntry is read off the module, so that a module without it fails the tests that call it and not the whole file.
const { queues, rejectEntry } = specChanges;

const REASON = "The SPEC already says this under ## 9. G.";
const RATIONALE = (n) => `# ${n}: a change\n\n**The change.** A change.\n\n**Why.** A reason.\n\n**Impact list.**\n- none.\n\n**Origin.** a test.\n`;
const DECISIONS = "# Decisions — queue 2026-09-24g x\n\nAppend-only.\n";
const ROW05 = "| 05 | `SPEC.md` | ## 10. R | — | — |\n";
const product = (over = {}) => memoryHost({ "SPEC.md": B_SPEC, [`${QD}/index.md`]: B_INDEX, [`${QD}/entscheidungen.md`]: DECISIONS,
  [`${QD}/05-a.md`]: B_P05, [`${QD}/05-a.begruendung.md`]: RATIONALE("10. R"), [`${QD}/06-b.md`]: B_P06, [`${QD}/06-b.begruendung.md`]: RATIONALE("11. X"), ...over });
// What the dashboard showed of entry 05: the proposal and the section beside it, each by its blob SHA.
const shown05 = async () => ({ queue: QD, entry: 5, proposalBlob: await blobSha(B_P05), sectionBlob: await blobSha(sectionText(B_SPEC, "## 10. R")) });

// A queue of one entry, its last.
const QL = "docs/spec-freigaben/2026-10-27_last";
const INDEX_L = "# SPEC approvals — queue 2026-10-27 · last\n\n**Zieldatei aller Einträge:** `SPEC.md`\n\n" +
  "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |\n|---|---|---|---|---|\n| 01 | `SPEC.md` | ## 9. G | — | — |\n";
const P01 = "## 9. G\n\nnew nine\n";
const lastQueue = () => ({ [`${QL}/index.md`]: INDEX_L, [`${QL}/entscheidungen.md`]: DECISIONS, [`${QL}/01-g.md`]: P01, [`${QL}/01-g.begruendung.md`]: RATIONALE("9. G") });
const shown01 = async () => ({ queue: QL, entry: 1, proposalBlob: await blobSha(P01), sectionBlob: await blobSha(sectionText(B_SPEC, "## 9. G")) });

const withoutToken = (host) => ({ ...host, repositoryInfo: async () => ({ defaultBranch: "main", canWrite: false }) });

// TST-2026271011 · level: unit · module: MOD-spec-changes
// guards: A REJECTION REMOVES THE PROPOSAL; A PROPOSAL IS REJECTED WITH A REASON
// given: the queue QD with the open entries 05 and 06, each with its rationale
// input: rejectEntry of entry 05 as shown, by alice, with a reason
// expect: one commit on the head that was read: 05's proposal and rationale deleted, the index without 05's row and every other byte as it was; the SPEC, the decisions and entry 06 untouched; no approval record; the message names the entry, alice and the reason; the queue then holds 06 alone
test("TST-2026271011: rejecting a SPEC change entry removes its proposal, its rationale and its row of the index, in one commit", async () => {
  const repo = product();
  const head = (await repo.host.readSnapshot("main")).commit;
  const done = await rejectEntry(repo.host, await shown05(), "alice", REASON);
  const [commit, ...more] = repo.commits();
  assert.equal(more.length, 0, "one commit");
  assert.equal(commit.expectedHead, head);
  assert.deepEqual(commit.files.map((f) => f.path).sort(), [`${QD}/05-a.begruendung.md`, `${QD}/05-a.md`, `${QD}/index.md`]);
  assert.ok(commit.files.filter((f) => f.path !== `${QD}/index.md`).every((f) => f.delete === true), "proposal and rationale deleted");
  assert.equal(repo.files()[`${QD}/index.md`], B_INDEX.replace(ROW05, ""), "the row of 05 gone, every other byte as it was");
  assert.equal(repo.files()["SPEC.md"], B_SPEC, "the SPEC unchanged");
  assert.equal(Object.keys(repo.files()).filter((p) => p.startsWith("docs/approvals/")).length, 0, "no approval record");
  assert.match(commit.message, /spec-2026-09-24g_x-05/);
  assert.match(commit.message, /alice/);
  assert.ok(commit.message.includes(REASON), "the reason in the message");
  assert.ok(done.commit);
  const [queue] = await queues(await repo.host.readSnapshot("main"));
  assert.deepEqual(queue.entries.map((e) => e.number), [6]);
});

// TST-2026271012 · level: unit · module: MOD-spec-changes
// guards: A REJECTION REMOVES THE PROPOSAL
// given: beside QD, the queue QL whose one entry 01 is open; known positive: rejecting 05 of QD leaves QD's other files (TST-2026271011)
// input: rejectEntry of QL's entry 01, with a reason
// expect: one commit that deletes every file of QL's folder — index, decisions, proposal, rationale — and nothing else; no queue QL is left
test("TST-2026271012: rejecting the last entry of a queue removes the queue", async () => {
  const repo = product(lastQueue());
  await rejectEntry(repo.host, await shown01(), "alice", REASON);
  const [commit] = repo.commits();
  assert.deepEqual(commit.files, Object.keys(lastQueue()).sort().map((path) => ({ path, delete: true })));
  assert.deepEqual((await queues(await repo.host.readSnapshot("main"))).map((q) => q.folder), [QD]);
});

// TST-2026271013 · level: unit · module: MOD-spec-changes
// guards: A PROPOSAL IS REJECTED WITH A REASON; A STALE APPROVAL IS NOT APPLIED
// given: the queue QD; known positive: entry 05 as shown is rejected with a reason (TST-2026271011)
// input: rejectEntry with no reason and with blanks; with a proposal blob and with a section blob that are not the current ones; of an entry the queue does not hold; of entry 05 approved (a record names its proposal) and in SPEC (a decision row names it)
// expect: a TypeError for the missing reason; ChangedSinceShown for the changed texts and the missing entry; NothingToReject for the decided ones; nothing written
test("TST-2026271013: a SPEC change entry is not rejected without a reason, on a text no longer current, or once it is decided", async () => {
  const repo = product();
  for (const reason of [undefined, "", " \n"]) await assert.rejects(rejectEntry(repo.host, await shown05(), "alice", reason), TypeError);
  await assert.rejects(rejectEntry(repo.host, { ...(await shown05()), proposalBlob: await blobSha("another proposal\n") }, "alice", REASON), { name: "ChangedSinceShown" });
  await assert.rejects(rejectEntry(repo.host, { ...(await shown05()), sectionBlob: await blobSha("another section\n") }, "alice", REASON), { name: "ChangedSinceShown" });
  await assert.rejects(rejectEntry(repo.host, { ...(await shown05()), entry: 7 }, "alice", REASON), { name: "ChangedSinceShown" });
  assert.equal(repo.commits().length, 0, "nothing written");

  const record = { kind: "spec", queue: QD, entry: "05", proposal: `${QD}/05-a.md`, blob: await blobSha(B_P05), target: "SPEC.md", anchor: "## 10. R",
    section: await blobSha(sectionText(B_SPEC, "## 10. R")) };
  const recordPath = approvalPath("spec-2026-09-24g_x-05", record.blob);
  const approved = product({ [recordPath]: recordText(record) });
  await assert.rejects(rejectEntry(approved.host, await shown05(), "alice", REASON), { name: "NothingToReject" });
  const row = `| 2026-09-29 16:03 UTC | 5 | uebernommen | approval:${recordPath.split("/").pop()} |\n`;
  const inSpec = product({ [recordPath]: recordText(record), [`${QD}/entscheidungen.md`]: `${DECISIONS}\n${row}` });
  await assert.rejects(rejectEntry(inSpec.host, await shown05(), "alice", REASON), { name: "NothingToReject" });
  assert.equal(approved.commits().length + inSpec.commits().length, 0, "nothing written");
});

// TST-2026271014 · level: unit · module: MOD-spec-changes
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
// given: the queues QD and QL of a product on github.com, read without a token
// input: rejectEntry of QD's entry 05 and of QL's entry 01, with a reason
// expect: nothing written; for 05 GitHub's pages that delete its proposal and its rationale and the editor of the index, with the index's new text returned beside it; for 01 GitHub's page that deletes each file of QL; no link carries a text
test("TST-2026271014: without a token, rejecting an entry opens GitHub's pages for each of its files", async () => {
  const repo = product(lastQueue());
  const web = "https://github.com/memory-owner/memory-repository";
  const pages = (await rejectEntry(withoutToken(repo.host), await shown05(), "alice", REASON)).fallback;
  assert.deepEqual(pages.map(({ url, path, text }) => ({ url, path, text })).sort((a, b) => a.path.localeCompare(b.path)), [
    { url: `${web}/delete/main/${QD}/05-a.begruendung.md`, path: `${QD}/05-a.begruendung.md`, text: null },
    { url: `${web}/delete/main/${QD}/05-a.md`, path: `${QD}/05-a.md`, text: null },
    { url: `${web}/edit/main/${QD}/index.md`, path: `${QD}/index.md`, text: B_INDEX.replace(ROW05, "") },
  ]);
  const last = (await rejectEntry(withoutToken(repo.host), await shown01(), "alice", REASON)).fallback;
  assert.deepEqual(last.map(({ url, text }) => ({ url, text })), Object.keys(lastQueue()).sort().map((path) => ({ url: `${web}/delete/main/${path}`, text: null })));
  assert.equal(repo.commits().length, 0, "nothing written");
});
