// MOD-review-pages' routes spec-entry and spec-entry/<id> (ITM-357), as the accepted text of docs/architecture/MOD-review-pages.md states them:
// the descriptor `spec-entry` of the kind "SPEC entry" — "the current section beside the proposal with the difference, rationale, impact list,
// other proposals on the same section, the queue's order and anchors", accepted "through MOD-spec-changes.acceptEntries" in the queue's order — and
// UC-006 steps 1 to 7, 3b, 4b, 4c, 4d, 5a: the list of every queue, newest first, with each entry's state and a tick for an open one; one entry
// with the section that holds now beside the proposal, their difference, the rationale and the impact list; Accept and Accept ticked through
// acceptEntries with the product's links and the instance's register, its refusals shown; without a token the instance's own SPEC through GitHub's
// page that carries the record, a product's SPEC with no Accept and the token's step linked.
// Run: node --test tests/review-pages-spec-entries.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-006; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN; A QUEUE IS ACCEPTED IN ITS ORDER; A STALE APPROVAL IS NOT APPLIED; A REQUIREMENT HAS A REGISTERED SOURCE; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// Level: unit
//
// This imports the browser harness of tests/review-pages-harness.mjs unchanged (its document and its localStorage). The repository is a Host
// of the tests' own over one repository in memory with a history, keeping to MOD-repository-hosts' interface; every call recorded. The real
// MOD-spec-changes, MOD-approvals, MOD-source-register, MOD-documents and MOD-browser-store run as they are. Nothing reaches the network. The product
// is the small one tests/spec-changes-accept.test.mjs holds: a SPEC of two sections, a queue whose entries are 05 (replaces section 1 and creates the
// section "1a"), 06 (starts with "1a") and 07 (replaces section 2), a rationale for each, a register of two sources of which the product links one.
// Where the module file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - The routes are `spec-entry` (the list) and `spec-entry` with the id spec-<queue folder>-<NN>: #spec-entry/id=spec-2026-03-01_sample-05; the queue
//     folder is the one MOD-spec-changes' Queue.folder gives, the path docs/spec-freigaben/<folder>.
//   - The list holds one <section class="queue" data-folder> for each queue, newest first, and a <tr data-id> for each entry with its link, its anchor
//     and a <span class="badge"> of its state; a tick (<input class="tick">) for an entry whose state is open or waiting for its anchor, only with a token;
//     "Accept ticked (n)" is <button class="accept-ticked">.
//   - One entry holds <section class="current"> (the section that holds now), <section class="proposal">, <section class="difference">,
//     <section class="rationale">, <ul class="impact"> with an <li> for each name, <ul class="others"> with the other open proposals on the same section,
//     <ol class="order"> with the queue's entries and their anchors; Accept is <button class="accept">; an entry that waits for its anchor has no
//     Accept and says in <p class="waits"> which entry it waits for.
//   - A refusal is shown in <p class="result problem">, naming every entry refused with its reason; the page is drawn again from the repository.
//   - Without a token, for the instance's own SPEC — the route given no product —, <a class="github-page"> is the new-file page of the record: its path
//     and the record, and no text of a proposal; for a product's SPEC there is neither, and <a class="token-step"> links #add.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import { scripted } from "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { withStoredGraph } from "./stored-graph-fake.mjs";

// Every commit the fakes of this file make is its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page.
let commitsMade = 0;

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const route = pages.view?.routes.find((candidate) => candidate.name === "spec-entry");

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const pad2 = (n) => String(n).padStart(2, "0");
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };

const READING = text("## 1. Reading", "", "**A SAMPLE RULE** *(Fixture PO)*", "A reader reads a file whole.", "*Check:* `tests/sample.test.mjs`", "");
const READING_NEW = READING.replace("whole.", "whole, or says why not.");
const ADDED = text("## 1a. Added", "", "**AN ADDED RULE** *(Fixture PO)*", "A reader sees what was added.", "*Check:* no automatic check; at review", "");
const ADDED_NEW = ADDED.replace("what was added.", "what was added, and when.");
const WRITING = text("## 2. Writing", "", "**A WRITE RULE** *(Fixture PO)*", "A writer writes a file whole.", "*Check:* no automatic check; at review");
const WRITING_NEW = WRITING.replace("whole.", "entirely.");
const HEAD = text("# Fixture product — Specification", "");
const SPEC = HEAD + READING + WRITING;
const useCase = text("---", "id: UC-001", "title: Read a file", "area: files", "actors:", "  - Reader", "realises:", "  - A SAMPLE RULE", "---", "# UC-001 Read a file", "", "**Goal.** Read a file.");

const ENTRY_PO = text("---", "id: SRC-fixture-po", "title: Fixture PO", "kind: document", "authority: normative", "licence: may be republished — fixture",
  "---", "# SRC-fixture-po Fixture PO", "", "A fixture source.");
const LINKS = text("# The sources this product meets", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| SRC-fixture-po | 2026-10-05 | ${"0".repeat(64)} | |`);

const QUEUE = "docs/spec-freigaben/2026-03-01_sample";
const entry = (nr, anchor, proposal, slug) => ({ nr, anchor, proposal, slug });
const E05 = entry(5, "## 1. Reading", READING_NEW + ADDED, "entry-5"), E06 = entry(6, "## 1a. Added", ADDED_NEW, "entry-6"), E07 = entry(7, "## 2. Writing", WRITING_NEW, "entry-7");
const proposalPath = (item) => `${QUEUE}/${pad2(item.nr)}-${item.slug}.md`;
const idOf = (item) => `spec-2026-03-01_sample-${pad2(item.nr)}`;
const recordPath = (item) => `docs/approvals/${idOf(item)}-${blobOf(item.proposal).slice(0, 12)}.md`;
const DECISIONS = text("# Decisions — queue 2026-03-01 sample", "", "Append-only.");
const rationale = (item) => text(`# ${item.anchor}: a change`, "", "**The change.** A sample change.", "", "**Impact list.**", "- A SAMPLE RULE: named by UC-001.");

const productFiles = (entries = [E05, E06, E07]) => ({
  "README.md": "# Fixture product\n", "SPEC.md": SPEC, "docs/use-cases/UC-001-read-a-file.md": useCase,
  [`${QUEUE}/index.md`]: text("# SPEC approvals — queue 2026-03-01 · sample", "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
    ...entries.map((item) => `| ${pad2(item.nr)} | \`SPEC.md\` | ${item.anchor} | — | — |`)),
  [`${QUEUE}/entscheidungen.md`]: DECISIONS,
  ...Object.fromEntries(entries.flatMap((item) => [[proposalPath(item), item.proposal], [`${QUEUE}/${pad2(item.nr)}-${item.slug}.begruendung.md`, rationale(item)]])),
});
const SOURCE_FILES = { "docs/sources.md": LINKS, "docs/sources/SRC-fixture-po.md": ENTRY_PO };

// ---------------------------------------------------------------- the fake host

function fakeHost(files, repository = ON_GITHUB) {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made} of the file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree, parent, date: `2026-10-0${made}T10:00:00Z` });
    return sha;
  };
  head = commitOf(new Map(Object.entries(files)), null);
  const bareSnapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return { repository, ref: sha, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  // Each snapshot serves the graph the push job stores for its commit (tests/stored-graph-fake.mjs); a page reads it and never builds one (MOD-trace-graph).
  const snapshotAt = (...args) => withStoredGraph(bareSnapshotAt(...args));
  return {
    head: () => head,
    files: () => Object.fromEntries(commits.get(head).tree),
    writes: () => calls.filter((call) => call.fn === "commitFiles"),
    land(changed) { head = commitOf(new Map([...commits.get(head).tree, ...Object.entries(changed)]), head); },
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        if (ref === "main") return { ...snapshotAt(head), ref };
        if (commits.has(ref)) return snapshotAt(ref);
        throw failure("NotFound", `${ref} was not found`, { what: ref });
      },
      async readHistory() { return []; },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((f) => [f.path, f.text])]), head);
        return { commit: head, url: `${repository.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the page

// The instance's own SPEC: the route given no product, the repository holding the queue, the links and the register. A product's: the route given
// the product, whose repository holds the queue and the links, and the instance, whose repository holds the register.
async function show(fake, params = {}, { token = true, product = false, instanceFake = null } = {}) {
  assert.ok(route, `the route spec-entry: ${pages.error?.message}`);
  const store = openStore(token ? "alice/agent-m" : "nobody/agent-m");
  if (token) writeSetting(store, product ? "github-token:alice/thesis-tool" : "github-token", TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  const instance = { repository: "alice/agent-m", host: (instanceFake ?? fake).host };
  await route.render(target, { page: "review", instance, store, go() {}, product: product ? { address: ON_GITHUB.web, kind: "github", host: fake.host } : null }, params);
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(new Event("click"));
const tick = (box) => { box.checked = true; box.dispatchEvent(new Event("change")); };
async function until(condition, what) {
  const limit = Date.now() + 2000;
  while (Date.now() < limit) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  if (condition()) return;
  assert.fail(`waited for ${what}`);
}
const rowOf = (target, item) => find(target, (node) => node.localName === "tr" && node.getAttribute("data-id") === idOf(item))[0];
const badgeOf = (root) => byClass(root, "span", "badge")[0]?.textContent;
const written = (fake) => Object.fromEntries(fake.writes()[0].change.files.map((file) => [file.path, file.text]));

// ---------------------------------------------------------------- the list

// TST-472660 · level: unit · module: MOD-review-pages
// guards: UC-006
// given: the instance whose queue 2026-03-01_sample holds the entries 05, 06 and 07, 06 waiting for the anchor 05 creates, and an older queue with one entry already accepted by its record; a token
// input: the route spec-entry with no id; the pages of the entries 05, 06 and 07; the list again
// expect: the queues in the order of their folders' names; a row for each entry with its link to #spec-entry/id=<id>, its anchor and its state — open, waiting for its anchor, in SPEC —; a tick on each entry that is open or waits, before and after its page was shown, and none on an accepted one; nothing written
test("spec-entry — the list: every queue with its entries' states and a tick for each one not accepted", async () => {
  const OLD = "docs/spec-freigaben/2026-02-01_older", OLD_PROPOSAL = text("**AN OLDER RULE** *(Fixture PO)*", "An older rule.");
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES,
    [`${OLD}/index.md`]: text("# SPEC approvals — queue 2026-02-01 · older", "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", "| 01 | `SPEC.md` | ## 9. Older | — | — |"),
    [`${OLD}/01-older.md`]: OLD_PROPOSAL, [`${OLD}/entscheidungen.md`]: text("# Decisions", "", "| 2026-02-01 10:00 UTC | 1 | uebernommen | approval:spec-2026-02-01_older-01-aaaaaaaaaaaa.md |") });
  const unread = await show(fake);
  assert.equal(byClass(unread, "input", "tick").length, 3, "a tick on each entry not accepted before any page was shown");
  for (const item of [E05, E06, E07]) await show(fake, { id: idOf(item) });
  const target = await show(fake);
  assert.deepEqual(byClass(target, "section", "queue").map((queue) => queue.getAttribute("data-folder")), ["2026-02-01_older", "2026-03-01_sample"]);
  assert.deepEqual([E05, E06, E07].map((item) => badgeOf(rowOf(target, item))), ["open", "waiting for its anchor", "open"]);
  for (const item of [E05, E06, E07]) {
    assert.equal(find(rowOf(target, item), (node) => node.localName === "a")[0].getAttribute("href"), `#spec-entry/id=${idOf(item)}`);
    assert.ok(rowOf(target, item).textContent.includes(item.anchor), "its anchor");
    assert.equal(byClass(rowOf(target, item), "input", "tick").length, 1, "a tick");
  }
  const older = find(target, (node) => node.localName === "tr" && node.getAttribute("data-id") === "spec-2026-02-01_older-01")[0];
  assert.equal(badgeOf(older), "in SPEC");
  assert.equal(byClass(older, "input", "tick").length, 0, "no tick on an accepted entry");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// ---------------------------------------------------------------- one entry

// TST-472661 · level: unit · module: MOD-review-pages
// guards: NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; UC-006
// given: the entry 07, which replaces section 2, with its rationale; UC-001 names no requirement of it; and the entry 05 beside it in its queue
// input: the route spec-entry with the id of entry 07
// expect: the section that holds now beside the proposal, with the difference between them (the old line marked removed, the new one added); the rationale; the impact list naming A WRITE RULE as changed; the queue's order with its anchors; the state open; nothing written
test("spec-entry/<id> — one entry with the current section, the proposal, their difference, the rationale and the impact list", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  const target = await show(fake, { id: idOf(E07) });
  assert.equal(badgeOf(target), "open");
  assert.match(byClass(target, "section", "current")[0].textContent, /A writer writes a file whole\./);
  assert.match(byClass(target, "section", "proposal")[0].textContent, /A writer writes a file entirely\./);
  const difference = byClass(target, "section", "difference")[0].textContent;
  assert.match(difference, /- A writer writes a file whole\./);
  assert.match(difference, /\+ A writer writes a file entirely\./);
  assert.match(byClass(target, "section", "rationale")[0].textContent, /A sample change\./);
  const impact = byClass(target, "ul", "impact")[0];
  assert.match(impact.textContent, /A WRITE RULE/);
  assert.match(impact.textContent, /changed/);
  assert.match(byClass(target, "ol", "order")[0].textContent, /05[^]*## 1\. Reading[^]*06[^]*## 1a\. Added[^]*07[^]*## 2\. Writing/);
  assert.equal(fake.writes().length, 0, "nothing written");
});

// ---------------------------------------------------------------- Accept

// TST-472662 · level: unit · module: MOD-review-pages
// guards: A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN; ONE CLICK PER DECISION; A REQUIREMENT HAS A REGISTERED SOURCE; UC-006
// given: the instance with the entry 07 open, the links and the register, and a token
// input: a click on Accept
// expect: one commit holding the approval record, the SPEC with section 2 as the proposal says it, byte for byte, and the decisions with the row; the page then shows the entry in SPEC; the entry 07 is no longer offered
test("spec-entry/<id> — Accept writes one commit, after which the entry is in the SPEC", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  const read = fake.head();
  const target = await show(fake, { id: idOf(E07) });
  click(byClass(target, "button", "accept")[0]);
  await until(() => fake.writes().length === 1, "the commit");
  const files = written(fake);
  assert.equal(fake.writes()[0].change.expectedHead, read, "on the head that was read");
  assert.deepEqual(Object.keys(files).sort(), [recordPath(E07), `${QUEUE}/entscheidungen.md`, "SPEC.md"].sort());
  assert.equal(files["SPEC.md"], HEAD + READING + WRITING_NEW);
  assert.match(files[`${QUEUE}/entscheidungen.md`], /\| 7 \| uebernommen \| approval:spec-2026-03-01_sample-07-[0-9a-f]{12}\.md \|/);
  await until(() => badgeOf(target) === "in SPEC", "the page to show the entry in SPEC");
  assert.equal(byClass(target, "button", "accept").length, 0, "no Accept any more");
});

// TST-680205 · level: unit · module: MOD-review-pages
// guards: THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN
// given: the instance with the entry 07 open, the links and the register, and a token
// input: a click a script makes (isTrusted false) on Accept; then the person's click
// expect: after the script's click no commit is attempted and the entry is still open; after the person's click one commit
test("spec-entry/<id> — counter-proof: a click a script makes on Accept writes nothing", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  const target = await show(fake, { id: idOf(E07) });
  const accept = byClass(target, "button", "accept")[0];
  accept.dispatchEvent(scripted());
  for (let turn = 0; turn < 40; turn++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(fake.writes().length, 0, "no commit attempted");
  assert.notEqual(badgeOf(target), "in SPEC", "still open");
  click(accept);
  await until(() => fake.writes().length === 1, "the commit of the person's click");
});

// TST-472663 · level: unit · module: MOD-review-pages
// guards: A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-006
// given: the pages of the entries 05 and 07 shown, then the list with the entries 05 and 07 open; 07 ticked first, then 05
// input: a click on Accept ticked
// expect: one commit with both records; the SPEC with section 1 and section 2 as proposed and the new section "1a"; the decisions with 05's row before 07's — the order of the queue's index, not of the ticks
test("spec-entry — two ticked entries are accepted in the order of the queue's index", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  for (const item of [E05, E07]) await show(fake, { id: idOf(item) });
  const target = await show(fake);
  tick(byClass(rowOf(target, E07), "input", "tick")[0]);
  tick(byClass(rowOf(target, E05), "input", "tick")[0]);
  assert.match(byClass(target, "button", "accept-ticked")[0].textContent, /\(2\)/);
  click(byClass(target, "button", "accept-ticked")[0]);
  await until(() => fake.writes().length === 1, "the commit");
  const files = written(fake);
  assert.deepEqual(Object.keys(files).sort(), [recordPath(E05), recordPath(E07), `${QUEUE}/entscheidungen.md`, "SPEC.md"].sort());
  assert.equal(files["SPEC.md"], HEAD + READING_NEW + ADDED + WRITING_NEW);
  const rows = files[`${QUEUE}/entscheidungen.md`];
  assert.ok(rows.indexOf("| 5 |") > 0 && rows.indexOf("| 5 |") < rows.indexOf("| 7 |"), `05's row before 07's: ${rows}`);
});

// TST-472664 · level: unit · module: MOD-review-pages
// guards: A QUEUE IS ACCEPTED IN ITS ORDER; UC-006
// given: the entries 05 and 06, 06 starting with the section "1a" that 05 creates
// input: the page of entry 06; then 06 ticked alone and Accept ticked
// expect: no Accept on the page of 06, which says it goes only with or after 05; the click of Accept ticked refused, naming 05, and nothing written
test("spec-entry — 06 is not offered alone, and 05 is named", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  const entryPage = await show(fake, { id: idOf(E06) });
  assert.equal(badgeOf(entryPage), "waiting for its anchor");
  assert.equal(byClass(entryPage, "button", "accept").length, 0, "no Accept for 06 alone");
  assert.match(byClass(entryPage, "p", "waits")[0].textContent, /05/, "05 is named");
  const list = await show(fake);
  tick(byClass(rowOf(list, E06), "input", "tick")[0]);
  click(byClass(list, "button", "accept-ticked")[0]);
  await until(() => byClass(list, "p", "result").length === 1, "the refusal");
  assert.match(byClass(list, "p", "result")[0].textContent, /entry 06[^]*05|05[^]*entry 06|06[^]*05/);
  assert.equal(fake.writes().length, 0, "nothing written");
});

// TST-472665 · level: unit · module: MOD-review-pages
// guards: A STALE APPROVAL IS NOT APPLIED; UC-006
// given: the entry 07 shown; then another writer changes its proposal on main
// input: a click on Accept
// expect: nothing written; the refusal shown; the page drawn again with the newer proposal and the entry's state as the repository gives it now, Accept offered again to decide anew
test("spec-entry/<id> — a stale entry: nothing written, its new state shown", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  const target = await show(fake, { id: idOf(E07) });
  const newer = WRITING_NEW.replace("entirely.", "in one piece.");
  fake.land({ [proposalPath(E07)]: newer });
  click(byClass(target, "button", "accept")[0]);
  await until(() => byClass(target, "p", "result").length === 1, "the refusal");
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.match(byClass(target, "p", "result")[0].textContent, /changed/);
  assert.match(byClass(target, "section", "proposal")[0].textContent, /in one piece\./, "the newer proposal is shown");
  assert.equal(badgeOf(target), "open", "the state as the repository gives it now");
  assert.equal(byClass(target, "button", "accept").length, 1, "Accept is offered again");
});

// ---------------------------------------------------------------- without a token

// TST-472666 · level: unit · module: MOD-review-pages
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL; UC-006
// given: the instance's own SPEC and no token stored
// input: the page of entry 07
// expect: no Accept; a link to GitHub's new-file page whose address holds the record's path and the record and no line of the proposal, the rationale or the SPEC; nothing written
test("spec-entry/<id> — the instance without a token: a link holding the record and no text", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  const target = await show(fake, { id: idOf(E07) }, { token: false });
  assert.equal(byClass(target, "button", "accept").length, 0, "no Accept");
  const link = byClass(target, "a", "github-page")[0];
  assert.ok(link, "a link to GitHub's page");
  const page = new URL(link.getAttribute("href"));
  assert.equal(page.origin + page.pathname, "https://github.com/alice/thesis-tool/new/main");
  assert.deepEqual([...page.searchParams.keys()].sort(), ["filename", "value"]);
  assert.equal(page.searchParams.get("filename"), recordPath(E07));
  const record = page.searchParams.get("value");
  assert.match(record, /^kind: spec\n/);
  assert.ok(record.includes(`blob: ${blobOf(E07.proposal)}`), "the record names the blob of the proposal");
  for (const part of ["writes a file", "A WRITE RULE", "sample change"]) assert.ok(!decodeURIComponent(link.getAttribute("href")).includes(part), `no "${part}" in the address`);
  assert.equal(fake.writes().length, 0, "nothing written");
});

// TST-472667 · level: unit · module: MOD-review-pages
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; A GITLAB PRODUCT IS WRITTEN WITH A TOKEN; UC-006
// given: a product's SPEC — the route given the product — and no token of its own stored
// input: the page of entry 07
// expect: no Accept; no link to a GitHub page; the token's step, #add, linked
test("spec-entry/<id> — a product without a token: no Accept, and the token's step linked", async () => {
  const fake = fakeHost({ ...productFiles(), "docs/sources.md": LINKS });
  const instance = fakeHost({ "README.md": "# Instance\n", "docs/sources/SRC-fixture-po.md": ENTRY_PO });
  const target = await show(fake, { id: idOf(E07) }, { token: false, product: true, instanceFake: instance });
  assert.match(byClass(target, "section", "proposal")[0].textContent, /entirely\./, "the entry is shown");
  assert.equal(byClass(target, "button", "accept").length, 0, "no Accept");
  assert.equal(byClass(target, "a", "github-page").length, 0, "no GitHub page");
  assert.equal(find(target, (node) => node.localName === "a" && node.getAttribute("href")?.startsWith("#add/")).length >= 1, true, "the token's step");
  assert.equal(fake.writes().length, 0);
});

// ---------------------------------------------------------------- the person, the gaps of the first pass

// TST-472668 · level: unit · module: MOD-review-pages
// guards: ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; ONE CLICK PER DECISION; UC-006
// given: the instance with the entry 07 open, and a token whose name is "Agent M · thesis-tool"
// input: a click on Accept
// expect: the commit's message names that person
test("spec-entry/<id> — Accept names the person of the token in the commit", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  const target = await show(fake, { id: idOf(E07) });
  click(byClass(target, "button", "accept")[0]);
  await until(() => fake.writes().length === 1, "the commit");
  assert.ok(fake.writes()[0].change.message.includes(TOKEN.name), fake.writes()[0].change.message);
});

// TST-472669 · level: unit · module: MOD-review-pages
// guards: ONE CLICK PER DECISION; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-006
// given: the page of entry 07 shown, then the list with a token and no entry ticked
// input: the page as drawn
// expect: Accept ticked is there and cannot be clicked, saying (0); after a tick it can, saying (1); after the tick is taken back it cannot again
test("spec-entry — Accept ticked cannot be clicked while nothing is ticked", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  await show(fake, { id: idOf(E07) });
  const target = await show(fake);
  const bar = byClass(target, "button", "accept-ticked")[0];
  assert.equal(bar.disabled, true);
  assert.match(bar.textContent, /\(0\)/);
  const box = byClass(rowOf(target, E07), "input", "tick")[0];
  tick(box);
  assert.equal(bar.disabled, false);
  assert.match(bar.textContent, /\(1\)/);
  box.checked = false;
  box.dispatchEvent(new Event("change"));
  assert.equal(bar.disabled, true);
});

// TST-472670 · level: unit · module: MOD-review-pages
// guards: A STALE APPROVAL IS NOT APPLIED; UC-006
// given: the entry 07 with a record of its proposal that names another section than the one the SPEC holds now
// input: the page of entry 07; the list
// expect: the state stale, and Accept offered to decide anew; a tick on the list, as the page was shown
test("spec-entry/<id> — a stale entry is shown stale and may be accepted anew", async () => {
  const record = text("kind: spec", `queue: ${QUEUE}`, "entry: 07", `proposal: ${proposalPath(E07)}`, `blob: ${blobOf(E07.proposal)}`, "target: SPEC.md",
    `anchor: ${E07.anchor}`, `section: ${blobOf("another section\n")}`);
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES, [recordPath(E07)]: record });
  const target = await show(fake, { id: idOf(E07) });
  const list = await show(fake);
  assert.equal(badgeOf(rowOf(list, E07)), "stale");
  assert.equal(byClass(rowOf(list, E07), "input", "tick").length, 1, "a tick");
  assert.equal(badgeOf(target), "stale");
  assert.equal(byClass(target, "button", "accept").length, 1, "Accept is offered");
});

// TST-472671 · level: unit · module: MOD-review-pages
// guards: A REQUIREMENT HAS A REGISTERED SOURCE; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; UC-006
// given: a product's SPEC with its token; the product holds the queue and the links, the instance holds the register of sources
// input: a click on Accept on the page of entry 07
// expect: one commit on the product, its SPEC as proposed — the register is the instance's, not the product's
test("spec-entry/<id> — a product's entry is accepted with the instance's register of sources", async () => {
  const fake = fakeHost({ ...productFiles(), "docs/sources.md": LINKS });
  const instance = fakeHost({ "README.md": "# Instance\n", "docs/sources/SRC-fixture-po.md": ENTRY_PO });
  const target = await show(fake, { id: idOf(E07) }, { product: true, instanceFake: instance });
  click(byClass(target, "button", "accept")[0]);
  await until(() => fake.writes().length === 1, "the commit");
  assert.equal(written(fake)["SPEC.md"], HEAD + READING + WRITING_NEW);
  assert.equal(instance.writes().length, 0, "the instance is not written");
});

// TST-472672 · level: unit · module: MOD-review-pages
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; UC-006
// given: a product's SPEC and no token of its own
// input: the list
// expect: no tick and no Accept ticked; the token's step, #add, linked
test("spec-entry — the product's list without a token: no tick, and the token's step linked", async () => {
  const fake = fakeHost({ ...productFiles(), "docs/sources.md": LINKS });
  const instance = fakeHost({ "README.md": "# Instance\n", "docs/sources/SRC-fixture-po.md": ENTRY_PO });
  const target = await show(fake, {}, { token: false, product: true, instanceFake: instance });
  assert.equal(byClass(target, "input", "tick").length, 0);
  assert.equal(byClass(target, "button", "accept-ticked").length, 0);
  assert.equal(find(target, (node) => node.localName === "a" && node.getAttribute("href")?.startsWith("#add/")).length >= 1, true);
});

// TST-472673 · level: unit · module: MOD-review-pages
// guards: UC-006
// given: the instance without an entry spec-2026-03-01_sample-99
// input: the page of that id
// expect: the page says there is no such entry and links the list; nothing written
test("spec-entry/<id> — an id no queue holds: said so, with the list linked", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  const target = await show(fake, { id: "spec-2026-03-01_sample-99" });
  assert.match(target.textContent, /spec-2026-03-01_sample-99/);
  assert.equal(find(target, (node) => node.localName === "a" && node.getAttribute("href") === "#spec-entry").length, 1);
  assert.equal(fake.writes().length, 0);
});

// TST-472674 · level: unit · module: MOD-review-pages
// guards: NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; UC-006
// given: the entry 07 on the section "## 2. Writing"; an older queue whose entry 01 proposes the same section and is open, whose entry 02 proposes it and is decided, and whose entry 03 proposes another section and is open
// input: the page of entry 07
// expect: the other proposals name 01 of the older queue only
test("spec-entry/<id> — the other open proposals on the same section", async () => {
  const OLD = "docs/spec-freigaben/2026-02-01_older", oldDecision = "approval:spec-2026-02-01_older-02-aaaaaaaaaaaa.md";
  const rows = [["01", "## 2. Writing"], ["02", "## 2. Writing"], ["03", "## 1. Reading"]];
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES,
    [`${OLD}/index.md`]: text("# SPEC approvals — queue 2026-02-01 · older", "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
      ...rows.map(([nn, anchor]) => `| ${nn} | \`SPEC.md\` | ${anchor} | — | — |`)),
    ...Object.fromEntries(rows.map(([nn, anchor]) => [`${OLD}/${nn}-older.md`, `${anchor}\n\nA different wording ${nn}.\n`])),
    [`${OLD}/entscheidungen.md`]: text("# Decisions", "", "| Date | Entry | Decision | Reference |", "|---|---|---|---|", `| 2026-02-01 10:00 UTC | 2 | uebernommen | ${oldDecision} |`) });
  const target = await show(fake, { id: idOf(E07) });
  const others = byClass(target, "ul", "others")[0].textContent;
  assert.match(others, /spec-2026-02-01_older-01/);
  assert.doesNotMatch(others, /older-02/, "a decided entry is not offered");
  assert.doesNotMatch(others, /older-03/, "another section is not the same");
});

// ---------------------------------------------------------------- through the one review flow

// TST-472675 · level: unit · module: MOD-review-pages
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: the instance's entry 07, no token — the page of any other kind, an accepted-by-record use case's, offers the record with a Copy button for its path and for its text
// input: the page of entry 07
// expect: the flow's fallback block: the explanation, the link, the path with a Copy button and the record with a Copy button
test("spec-entry/<id> — the flow's fallback block: the record's path and text each with a Copy button", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  const target = await show(fake, { id: idOf(E07) }, { token: false });
  const block = byClass(target, "div", "github-fallback")[0];
  assert.ok(block, "the fallback block");
  assert.equal(byClass(block, "button", "copy").length, 2, "a Copy button for the path and one for the text");
  assert.equal(byClass(block, "code", "record-path")[0].textContent, recordPath(E07));
});

// TST-472676 · level: unit · module: MOD-review-pages
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: the instance with the entry 07 open and a token whose host refuses the write for lack of permission (PermissionMissing)
// input: a click on Accept
// expect: as the flow does for every kind: the refusal shown in the result, Accept enabled again, and GitHub's page with the record offered; nothing written
test("spec-entry/<id> — the flow's answer to a write the token may not make: the refusal and GitHub's page", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  fake.host.commitFiles = async () => { throw failure("PermissionMissing", "the token may not write to main"); };
  const target = await show(fake, { id: idOf(E07) });
  const accept = byClass(target, "button", "accept")[0];
  click(accept);
  await until(() => byClass(target, "p", "result").length === 1, "the refusal");
  assert.match(byClass(target, "p", "result")[0].textContent, /may not write/);
  assert.equal(accept.disabled, false, "Accept can be clicked again");
  assert.equal(byClass(target, "a", "github-page").length, 1, "GitHub's page is offered");
});

// TST-472677 · level: unit · module: MOD-review-pages
// guards: ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-006
// given: the page of entry 07 shown, then the list with a token whose name is "Agent M · thesis-tool", entry 07 ticked
// input: a click on Accept ticked
// expect: the commit's message names that person; and the list offers Review all, the link ITM-909's Acceptance gives the SPEC changes list (TST-909004)
test("spec-entry — Accept ticked names the person", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  await show(fake, { id: idOf(E07) });
  const target = await show(fake);
  assert.equal(byClass(target, "a", "review-all").length, 1);
  tick(byClass(rowOf(target, E07), "input", "tick")[0]);
  click(byClass(target, "button", "accept-ticked")[0]);
  await until(() => fake.writes().length === 1, "the commit");
  assert.ok(fake.writes()[0].change.message.includes(TOKEN.name), fake.writes()[0].change.message);
});

// ---------------------------------------------------------------- Review all (ITM-909)
// The accepted lines (docs/architecture/MOD-review-pages.md, `<k>/all`): "every open or changed file of the kind in sequence ... and *Accept all N shown*: one commit
// with one record per file shown; a file that changed after it was shown ... is left out and named (`SEVERAL FILES ARE ACCEPTED IN ONE CLICK`)"; `<k>/all` shows
// "every open or changed file" and the status of an entry comes from MOD-approvals. The list's link is ITM-909's Acceptance: "The SPEC changes list links *Review all* with the number of open entries". Two queues: 2026-03-01_sample holds entry 07 (open, replaces section 2); 2026-02-01_older holds entry 01 (open, replaces section 1) and entry 02
// (decided: its decisions row names its approval record).
const OLDER = "docs/spec-freigaben/2026-02-01_older";
const olderFiles = (rows = []) => ({
  [`${OLDER}/index.md`]: text("# SPEC approvals — queue 2026-02-01 · older", "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|",
    "| 01 | `SPEC.md` | ## 1. Reading | — | — |", "| 02 | `SPEC.md` | ## 9. Decided | — | — |"),
  [`${OLDER}/01-older.md`]: READING_NEW, [`${OLDER}/01-older.begruendung.md`]: rationale({ anchor: "## 1. Reading" }),
  [`${OLDER}/02-decided.md`]: text("**A DECIDED RULE** *(Fixture PO)*", "A decided rule."),
  [`${OLDER}/entscheidungen.md`]: text("# Decisions", "", "| 2026-02-01 10:00 UTC | 2 | uebernommen | approval:spec-2026-02-01_older-02-aaaaaaaaaaaa.md |", ...rows),
});
const OLDER_01 = "spec-2026-02-01_older-01", OLDER_02 = "spec-2026-02-01_older-02";
const twoQueues = () => ({ ...productFiles([E07]), ...olderFiles(), ...SOURCE_FILES });
const reviewFiles = (target) => byClass(target, "section", "review-file");

// TST-909001 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-006
// given: entry 07 open in one queue, entry 01 open and entry 02 decided in a second queue; a token
// input: the route spec-entry with the id all
// expect: the heading "Review all — SPEC changes"; two sections, one for 01 and one for 07 in the order of their identifiers, none for 02; each holds the section that holds now, the proposal and their difference; the button "Accept all 2 shown"; nothing written
test("spec-entry/all — every open entry of every queue in sequence, the decided one not", async () => {
  const fake = fakeHost(twoQueues());
  const target = await show(fake, { id: "all" });
  assert.match(find(target, (node) => node.localName === "h2")[0].textContent, /^Review all — SPEC changes$/);
  assert.deepEqual(reviewFiles(target).map((section) => section.getAttribute("data-id")), [OLDER_01, idOf(E07)]);
  for (const section of reviewFiles(target)) {
    for (const part of ["current", "proposal", "difference"]) assert.equal(byClass(section, "section", part).length, 1, `${section.getAttribute("data-id")} holds its ${part}`);
  }
  assert.ok(!target.textContent.includes(OLDER_02), "the decided entry is not shown");
  assert.equal(byClass(target, "button", "accept-all")[0].textContent, "Accept all 2 shown");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// TST-909002 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A QUEUE IS ACCEPTED IN ITS ORDER; UC-006
// given: the page of TST-909001
// input: a click on "Accept all 2 shown"
// expect: one commit on the head that was read, holding the record of entry 01, the record of entry 07, both decisions files and the SPEC with section 1 and section 2 as proposed
test("spec-entry/all — Accept all shown writes one commit holding both entries", async () => {
  const fake = fakeHost(twoQueues());
  const read = fake.head();
  const target = await show(fake, { id: "all" });
  click(byClass(target, "button", "accept-all")[0]);
  await until(() => fake.writes().length === 1, "the commit");
  const files = written(fake);
  assert.equal(fake.writes()[0].change.expectedHead, read, "on the head that was read");
  const recordOlder = `docs/approvals/${OLDER_01}-${blobOf(READING_NEW).slice(0, 12)}.md`;
  assert.deepEqual(Object.keys(files).sort(), [recordOlder, recordPath(E07), `${OLDER}/entscheidungen.md`, `${QUEUE}/entscheidungen.md`, "SPEC.md"].sort());
  assert.equal(files["SPEC.md"], HEAD + READING_NEW + WRITING_NEW);
});

// TST-909003 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A STALE APPROVAL IS NOT APPLIED; UC-006
// given: the page of TST-909001; then another writer changes the proposal of entry 07 on main
// input: a click on "Accept all 2 shown"
// expect: one commit holding entry 01's record and not entry 07's; the SPEC with section 1 changed and section 2 as it was; the page says that entry 07 was left out
test("spec-entry/all — an entry whose proposal changed after it was shown is left out and named", async () => {
  const fake = fakeHost(twoQueues());
  const target = await show(fake, { id: "all" });
  fake.land({ [proposalPath(E07)]: WRITING_NEW.replace("entirely.", "in one piece.") });
  click(byClass(target, "button", "accept-all")[0]);
  await until(() => fake.writes().length === 1, "the commit");
  const files = written(fake);
  assert.ok(Object.keys(files).some((path) => path.includes(OLDER_01)), "entry 01 is accepted");
  assert.ok(!Object.keys(files).some((path) => path.includes(idOf(E07))), "entry 07 is not");
  assert.equal(files["SPEC.md"], HEAD + READING_NEW + WRITING);
  await until(() => byClass(target, "p", "result").length === 1, "the answer");
  assert.match(byClass(target, "p", "result")[0].textContent, new RegExp(`${idOf(E07)} was left out`));
});

// TST-909004 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-006
// given: the list with entries 01 and 07 open and entry 02 decided; and, as a second input, a repository whose every entry is decided
// input: the route spec-entry with no id; the route spec-entry with the id all on the second repository
// expect: the list has one link of class review-all to #spec-entry/id=all reading "Review all 2 not accepted"; the second repository's page reads "Nothing to review: every SPEC change entry is accepted." and offers no Accept all
test("spec-entry — the list links Review all with the number open; with none open the page says nothing is to review", async () => {
  const list = await show(fakeHost(twoQueues()));
  const links = byClass(list, "a", "review-all");
  assert.equal(links.length, 1);
  assert.equal(links[0].getAttribute("href"), "#spec-entry/id=all");
  assert.equal(links[0].textContent, "Review all 2 not accepted");
  const decided = { ...olderFiles(["| 2026-02-01 10:00 UTC | 1 | uebernommen | approval:spec-2026-02-01_older-01-bbbbbbbbbbbb.md |"]) };
  const none = await show(fakeHost({ ...productFiles([]), ...decided, ...SOURCE_FILES }), { id: "all" });
  assert.equal(byClass(none, "p", "nothing")[0].textContent, "Nothing to review: every SPEC change entry is accepted.");
  assert.equal(byClass(none, "button", "accept-all").length, 0);
});

// TST-909005 · level: unit · module: MOD-review-pages
// guards: A QUEUE IS ACCEPTED IN ITS ORDER; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-006
// given: the queue of entries 05, 06 and 07, 06 waiting for the section "1a" that 05 creates; a token
// input: the route spec-entry with the id all; then a click on the accept-all button
// expect: sections for 05, 06 and 07 in that order, the button "Accept all 3 shown"; the click writes one commit with the three records and the decisions rows 5, 6, 7 in that order, the SPEC with sections 1, 1a and 2 as proposed
test("spec-entry/all — an entry that waits for its anchor is shown with the entry that creates it, and accepted with it", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  const target = await show(fake, { id: "all" });
  assert.deepEqual(reviewFiles(target).map((section) => section.getAttribute("data-id")), [E05, E06, E07].map(idOf));
  assert.equal(byClass(target, "button", "accept-all")[0].textContent, "Accept all 3 shown");
  click(byClass(target, "button", "accept-all")[0]);
  await until(() => fake.writes().length === 1, "the commit");
  const files = written(fake);
  assert.deepEqual(Object.keys(files).sort(), [recordPath(E05), recordPath(E06), recordPath(E07), `${QUEUE}/entscheidungen.md`, "SPEC.md"].sort());
  assert.equal(files["SPEC.md"], HEAD + READING_NEW + ADDED_NEW + WRITING_NEW);
  const rows = files[`${QUEUE}/entscheidungen.md`];
  assert.ok(rows.indexOf("| 5 |") > 0 && rows.indexOf("| 5 |") < rows.indexOf("| 6 |") && rows.indexOf("| 6 |") < rows.indexOf("| 7 |"), rows);
});

// TST-909006 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-006
// given: the queue of entries 05, 06 (waiting for 05) and 07
// input: the route spec-entry with no id
// expect: the link of class review-all reads "Review all 3 not accepted"
test("spec-entry — the list counts an entry that waits for its anchor in Review all", async () => {
  const list = await show(fakeHost({ ...productFiles(), ...SOURCE_FILES }));
  assert.equal(byClass(list, "a", "review-all")[0].textContent, "Review all 3 not accepted");
});

// TST-909007 · level: unit · module: MOD-review-pages
// guards: A QUEUE IS ACCEPTED IN ITS ORDER; A STALE APPROVAL IS NOT APPLIED; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// given: the page of TST-909005; then another writer changes the proposal of entry 05 on main
// input: a click on "Accept all 3 shown"
// expect: one commit holding entry 07's record only; the page names 05 as left out because it changed and 06 as left out because it goes with 05
test("spec-entry/all — an entry whose creating entry is left out is left out and named with it", async () => {
  const fake = fakeHost({ ...productFiles(), ...SOURCE_FILES });
  const target = await show(fake, { id: "all" });
  fake.land({ [proposalPath(E05)]: (READING_NEW + ADDED).replace("whole, or", "whole or") });
  click(byClass(target, "button", "accept-all")[0]);
  await until(() => fake.writes().length === 1, "the commit");
  assert.deepEqual(Object.keys(written(fake)).filter((path) => path.startsWith("docs/approvals/")), [recordPath(E07)]);
  await until(() => byClass(target, "p", "result").length === 1, "the answer");
  const said = byClass(target, "p", "result")[0].textContent;
  assert.match(said, new RegExp(`${idOf(E05)} was left out: it changed after it was shown`));
  assert.match(said, new RegExp(`${idOf(E06)} was left out: it goes with ${idOf(E05)}, which was left out`));
});
