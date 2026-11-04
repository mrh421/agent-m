// A source gets a new version in the library, and a product moves to it (ITM-591) — MOD-settings-pages' route `library/<source>`, as docs/architecture/MOD-settings-pages.md and UC-016 state it: the entry of a
// source with + New version (the plan of MOD-source-register's versionCommits, a file only hashed asked for its note, SameBytes and NoteMissing shown as the module words them), the products this browser keeps
// that still link an earlier version, and Move for one of them (the requirements that name the source, the passages that changed, then one click that commits docs/sources.md with a message that names the
// requirements); and UC-004 1a, the offer of a new version for a source already in the library. The route is rendered into the fixture DOM of tests/settings-pages-harness.mjs over MOD-repository-hosts' real
// GitHub host (connect) for the instance and for each product, answered by a fake of fetch over repositories that hold files (tests/settings-pages-sources.d/github.mjs); nothing reaches the network.
// Run: node --test tests/settings-pages-library-versions.test.mjs
// The two steps fold their explanations (MOD-site-frame's topics source-new-version and source-move, called through explain).
//
// Module: MOD-settings-pages
// Guards: UC-016; UC-004; A SOURCE VERSION IS NEVER OVERWRITTEN; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; A PRODUCT LINKS THE SOURCES THAT APPLY; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE; A FORM OPENS WITH ITS FIRST FIELD FOCUSED; EVERY STEP EXPLAINS ITSELF; THE PAGE NAMES WHERE IT SENDS
// Level: unit
//
// Each test names its input and states its expected result in its own text (given / input / expect) before it runs; no expected value is read from a document, and none from the code. Where the texts leave a
// reading open, the test states the reading it takes, and the pull request names it with its source:
//   - A product is on an older version when its link names a version of an earlier row of the entry's `## Versions` than the last, the newest; a link naming a version the entry does not record is not listed.
//   - Move reads the product's SPEC.md at the commit its docs/sources.md was read at, and lists the passages per file name, only when every file of both versions is stored.
//   - The commit of a Move ends, after saveFile's line naming the file, with one line `Source moved: <source> <from> to <to>` and one line `Requirement affected: <name>` for each requirement listed (saveFile's trailers).
//   - The requests counted are those of the GitHub host over the fake: a read of a file is one request, with a token (the contents API) and without one (GitHub's raw host).
// The counter-proofs (a planted fault in src/settings-pages/ and the test's failing result) are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { installDocument, byClass, byTag, click, elements, type, turn, until } from "./settings-pages-harness.mjs";
import { attachedTarget, freshStore } from "./settings-pages-setup.d/dom.mjs";
import { githubWorld, installWorld, isWrite, registerEntry } from "./settings-pages-sources.d/github.mjs";

installDocument();
const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const { connect, parseAddress } = await import("../src/repository-hosts/index.mjs");
const { readDocument } = await import("../src/documents/index.mjs");
const { sourceSchemas, versionCommits } = await import("../src/source-register/index.mjs");
const { explain } = await import("../src/site-frame/index.mjs");
const library = view.routes.find((candidate) => candidate.name === "library");

const INSTANCE = "akmaier/agent-m";
const TODAY = new Date().toISOString().slice(0, 10);
const THESIS = "https://github.com/alice/thesis-tool", OTHER = "https://github.com/bob/other-tool", THIRD = "https://github.com/carol/third-tool", GONE = "https://github.com/dave/missing";
const GUIDE = "https://github.com/erin/guide", NAMED = "https://github.com/alice/handbook-content";
const TOKEN = "github_pat_INSTANCE0123456789abcdefghij", PRODUCT_TOKEN = "github_pat_PRODUCT0123456789abcdefghijk", NAMED_TOKEN = "github_pat_NAMED012345678901234567890abc";

const sha = (text) => createHash("sha256").update(text).digest("hex");
// A version's hash as the register defines it: the SHA-256 of the lines `<SHA-256 of the file>  <file name>`, sorted by name.
const versionHash = (files) => sha([...files].sort((a, b) => (a.name < b.name ? -1 : 1)).map((file) => `${sha(file.text)}  ${file.name}\n`).join(""));
const bytesOf = (text) => new TextEncoder().encode(text);
const fileOf = (name, text) => ({ name, size: bytesOf(text).length, arrayBuffer: async () => bytesOf(text).buffer.slice(0) });

const V1 = "Article 1\nArticle 2\nArticle 3\n";
const V2 = "Article 1\nArticle 2 amended\nArticle 3\nArticle 4\n";
const V3 = "Article 1\nArticle 5\n";
const H1 = "Chapter 1\n", H2 = "Chapter 1\nChapter 2\n", H3 = "Chapter 3\n";
const one = (name, text) => [{ name, text }];
const entryOf = (id, title, licence, versions, more = {}) => registerEntry({ id, title, kind: "document", authority: "normative", licence, versions: versions.map(({ version, date, files, ...rest }) => (
  { version, date, hash: versionHash(files), files: files.map((file) => ({ name: file.name, sha256: sha(file.text) })), ...rest })), ...more });
const AI = entryOf("SRC-ai-act", "EU AI Act", "may be republished — EU law", [
  { version: "v1", date: "2025-08-02", files: one("act.md", V1) }, { version: "v2", date: "2026-02-02", files: one("act.md", V2) }]);
const HANDBOOK = entryOf("SRC-handbook", "Faculty handbook", "restricted — internal", [
  { version: "1", date: "2026-09-01", files: one("handbook.md", H1) }, { version: "2", date: "2026-10-01", files: one("handbook.md", H2) }], { content_repository: NAMED });
const INSTANCE_FILES = {
  "docs/sources/SRC-ai-act.md": AI, "docs/sources/SRC-ai-act/v1/act.md": V1, "docs/sources/SRC-ai-act/v2/act.md": V2,
  "docs/sources/SRC-handbook.md": HANDBOOK,
};
const NAMED_FILES = { "docs/sources/SRC-handbook/1/handbook.md": H1, "docs/sources/SRC-handbook/2/handbook.md": H2 };
const SPEC = [
  "# Thesis tool — Specification", "", "## 1. Export", "",
  "**EXPORT IS A PDF** *(SRC-ai-act, Art. 13; PO B. Example)*", "The export is one PDF file.", "*Check:* `tests/export.test.mjs`", "",
  "**TITLE PAGE NAMES THE AUTHOR** *(SRC-ai-act; SRC-iec-62304, class B)*", "The title page names the author.", "*Check:* `tests/title.test.mjs`", "",
  "**NOTHING IS NAMED** *(PO B. Example)*", "The tool starts.", "*Check:* `tests/start.test.mjs`", ""].join("\n");
const links = (...rows) => ["# Requirement sources of thesis-tool", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", ...rows, ""].join("\n");
const AI_HASH = { v1: versionHash(one("act.md", V1)), v2: versionHash(one("act.md", V2)), v3: versionHash(one("act.md", V3)) };
const ON_V1 = links(`| SRC-ai-act | v1 | ${AI_HASH.v1} | Art. 13 |`), ON_V2 = links(`| SRC-ai-act | v2 | ${AI_HASH.v2} | Art. 13 |`);
const PRODUCT_FILES = { [THESIS]: { "SPEC.md": SPEC, "docs/sources.md": ON_V1 }, [OTHER]: { "SPEC.md": SPEC, "docs/sources.md": ON_V2 } };
const repoOf = (web) => parseAddress(web).path;

// The page: a world of the instance and the repositories named, the real hosts over it, a store keeping `products` and the tokens, a context as the frame hands it, and the route rendered for a source.
async function open(t, { instance = INSTANCE_FILES, products = [THESIS, OTHER], extra = {}, token = true, source = "SRC-ai-act", named = true } = {}) {
  const repositories = { [INSTANCE]: { files: instance }, ...(named ? { [repoOf(NAMED)]: { files: NAMED_FILES } } : {}),
    ...Object.fromEntries(Object.entries(extra).map(([web, files]) => [repoOf(web), { files }])) };
  for (const [web, files] of Object.entries(PRODUCT_FILES)) if (products.includes(web) && !(repoOf(web) in repositories)) repositories[repoOf(web)] = { files };
  const world = githubWorld(repositories);
  installWorld(t, world);
  const store = freshStore();
  if (token) {
    writeSetting(store, "github-token", { value: TOKEN, name: "Agent M", expires: "2027-01-01" });
    writeSetting(store, `github-token:${repoOf(THESIS)}`, { value: PRODUCT_TOKEN, name: "thesis", expires: "2027-01-01" });
    writeSetting(store, `github-token:${repoOf(NAMED)}`, { value: NAMED_TOKEN, name: "named", expires: "2027-01-01" });
  }
  writeSetting(store, "products", products);
  const went = [];
  const context = { page: "review", instance: { repository: INSTANCE, host: connect(parseAddress(`https://github.com/${INSTANCE}`), token ? { token: TOKEN } : {}) },
    product: null, store, went, go(name, params) { went.push([name, params]); } };
  const target = attachedTarget();
  await library.render(target, context, { source });
  return { world, context, target, went, store };
}
const one_ = (root, name) => { const found = byClass(root, name); assert.equal(found.length, 1, `exactly one .${name}`); return found[0]; };
const text = (root, name) => one_(root, name).textContent;
const commitsOf = (page, web) => page.world.commits(web === INSTANCE ? INSTANCE : repoOf(web));
const requestsTo = (page, repository) => page.world.requests.filter((request) => request.repository === repository);
const writes = (page) => page.world.requests.filter(isWrite);

async function chooseFiles(page, files) {
  const input = one_(page.target, "library-version-files");
  input.files = files;
  input.dispatchEvent(new Event("change"));
  await until(() => byClass(page.target, "library-file-hash").length === files.length && byClass(page.target, "library-file-hash").every((node) => /[0-9a-f]{64}/.test(node.textContent)), "the files are hashed");
}
async function startVersion(page, version, date, files) {
  await click(one_(page.target, "library-new-version"));
  type(one_(page.target, "library-version-id"), version);
  type(one_(page.target, "library-version-date"), date);
  await chooseFiles(page, files);
}
const save = async (page) => { await click(one_(page.target, "library-version-save")); };

// TST-591301 · level: unit · module: MOD-settings-pages
// guards: UC-016; A SOURCE VERSION IS NEVER OVERWRITTEN; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; A FORM OPENS WITH ITS FIRST FIELD FOCUSED
// given: SRC-ai-act with the versions v1 and v2, each of the file act.md stored in the instance; the browser keeps no product
// input: render library/SRC-ai-act; press + New version; type the version v3 and the date 2026-03-03; choose the file act.md holding "Article 1\nArticle 5\n"; press Save new version
// expect: before the press the panel is hidden, after it shown with the focus on the version field and the date field preset to today; the statement reads "Becomes public: the register entry, always, in the instance repository akmaier/agent-m. Content, public in the instance repository: act.md."; one commit in the instance and no other, holding exactly docs/sources/SRC-ai-act.md and docs/sources/SRC-ai-act/v3/act.md (the bytes chosen), made with the instance's token, its message "New version v3 of SRC-ai-act (Agent M dashboard)"; the entry file keeps the rows of v1 and v2 as they were and adds a row of v3 dated 2026-03-03 with the version hash of the file, and the table "### Files of v3" with the SHA-256 of the file and "—" as where it is kept; the result reads "✓ v3 is recorded for SRC-ai-act: committed to akmaier/agent-m."; the entry now lists v1, v2 and v3
test("new version — + New version records a version by one click: the plan of versionCommits in the instance, the earlier versions as they were", async (t) => {
  const page = await open(t, { products: [] });
  const panel = one_(page.target, "library-new-version-panel");
  assert.equal(panel.hidden, true);
  await click(one_(page.target, "library-new-version"));
  assert.equal(panel.hidden, false);
  assert.equal(document.activeElement === one_(page.target, "library-version-id"), true, "the focus is on the first field");
  assert.equal(one_(page.target, "library-version-date").value, TODAY);
  type(one_(page.target, "library-version-id"), "v3");
  type(one_(page.target, "library-version-date"), "2026-03-03");
  await chooseFiles(page, [fileOf("act.md", V3)]);
  assert.equal(text(page.target, "library-version-public"), "Becomes public: the register entry, always, in the instance repository akmaier/agent-m. Content, public in the instance repository: act.md.");
  assert.deepEqual(commitsOf(page, INSTANCE), []);
  await save(page);
  await until(() => commitsOf(page, INSTANCE).length === 1 && text(page.target, "library-version-result") !== "", "the version is committed");
  assert.equal(commitsOf(page, INSTANCE).length, 1);
  const commit = commitsOf(page, INSTANCE)[0];
  assert.deepEqual(Object.keys(commit.files).sort(), ["docs/sources/SRC-ai-act.md", "docs/sources/SRC-ai-act/v3/act.md"]);
  assert.equal(commit.files["docs/sources/SRC-ai-act/v3/act.md"], V3);
  assert.equal(commit.authorization, `Bearer ${TOKEN}`);
  assert.equal(commit.message, "New version v3 of SRC-ai-act (Agent M dashboard)");
  const entry = commit.files["docs/sources/SRC-ai-act.md"];
  for (const row of AI.split("\n").filter((line) => line.startsWith("| `v1`") || line.startsWith("| `v2`"))) assert.equal(entry.includes(row), true, `kept: ${row.slice(0, 20)}`);
  assert.equal(entry.includes("| `v3` | 2026-03-03 |"), true);
  assert.equal(entry.includes(`version hash \`${AI_HASH.v3}\``), true);
  assert.equal(entry.includes(`### Files of v3\n\n| File | SHA-256 | Kept at |\n|---|---|---|\n| \`act.md\` | \`${sha(V3)}\` | — |`), true);
  assert.equal(text(page.target, "library-version-result"), "✓ v3 is recorded for SRC-ai-act: committed to akmaier/agent-m.");
  assert.deepEqual(byClass(page.target, "library-version").map((node) => node.textContent.slice(0, 2)), ["v1", "v2", "v3"]);
  assert.equal(writes(page).every((request) => request.url.pathname.startsWith(`/repos/${INSTANCE}`)), true, "only the instance is written");
});

// TST-591302 · level: unit · module: MOD-settings-pages
// guards: UC-016; A SOURCE VERSION IS NEVER OVERWRITTEN
// given: SRC-ai-act with v1 (act.md holding "Article 1\nArticle 2\nArticle 3\n") and v2 (act.md holding "Article 1\nArticle 2 amended\nArticle 3\nArticle 4\n")
// input: + New version with the version "v1b" and the file act.md holding the bytes of v1, Save; then with the version "v2b" and the bytes of v2, Save; and versionCommits called with the bytes of v1
// expect: the first result reads "✗ SRC-ai-act already records the same bytes as v1 — nothing was recorded."; the second names v2 in the same words; nothing is committed and the page sent no write; the entry still lists v1 and v2 only; versionCommits rejects with the failure named SameBytes whose field version is "v1", its name and message not replaced by the field
test("new version — the same bytes as an existing version are refused with the module's SameBytes, and nothing is recorded", async (t) => {
  const page = await open(t, { products: [] });
  await startVersion(page, "v1b", "2026-03-03", [fileOf("act.md", V1)]);
  await save(page);
  await until(() => text(page.target, "library-version-result") !== "", "the refusal is shown");
  assert.equal(text(page.target, "library-version-result"), "✗ SRC-ai-act already records the same bytes as v1 — nothing was recorded.");
  await chooseFiles(page, [fileOf("act.md", V2)]);
  type(one_(page.target, "library-version-id"), "v2b");
  await save(page);
  await until(() => text(page.target, "library-version-result").includes("v2"), "the second refusal is shown");
  assert.equal(text(page.target, "library-version-result"), "✗ SRC-ai-act already records the same bytes as v2 — nothing was recorded.");
  assert.deepEqual(commitsOf(page, INSTANCE), []);
  assert.deepEqual(writes(page), []);
  assert.deepEqual(byClass(page.target, "library-version").map((node) => node.textContent.slice(0, 2)), ["v1", "v2"]);
  const entry = readDocument(sourceSchemas().entry, "docs/sources/SRC-ai-act.md", AI);
  await assert.rejects(() => versionCommits(entry, [{ name: "act.md", bytes: bytesOf(V1), keep: true }], { version: "v1b", date: "2026-03-03", repository: INSTANCE }),
    (error) => error.name === "SameBytes" && error.version === "v1" && error.message === "SRC-ai-act already records the same bytes as v1");
});

// TST-591303 · level: unit · module: MOD-settings-pages
// guards: UC-016; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE
// given: SRC-ai-act as before; the file act.md holding "Article 1\nArticle 5\n"
// input: + New version v3 with the file, the box "Only hash it" ticked; Save with no note; the note "cabinet 3, shelf B" typed; Save once more; and versionCommits called for the file only hashed with no note
// expect: before the tick the field for the note is hidden, after it shown; the first Save commits nothing and its result reads "✗ act.md is only hashed, and no note says where its copy is kept — nothing was recorded."; the second makes one commit holding the entry alone — no file anywhere —, whose row of v3 ends "; not stored: act.md |" and whose table "### Files of v3" has the row "| `act.md` | `<SHA-256>` | cabinet 3, shelf B |"; versionCommits rejects with the failure named NoteMissing whose field file is "act.md"
test("new version — a file only hashed asks for its note; without it the module's NoteMissing is shown, with it the entry alone is committed", async (t) => {
  const page = await open(t, { products: [] });
  await startVersion(page, "v3", "2026-03-03", [fileOf("act.md", V3)]);
  assert.equal(one_(page.target, "library-file-kept-at-label").hidden, true);
  const tick = one_(page.target, "library-file-only-hashed");
  tick.checked = true;
  tick.dispatchEvent(new Event("change"));
  assert.equal(one_(page.target, "library-file-kept-at-label").hidden, false);
  await save(page);
  await until(() => text(page.target, "library-version-result") !== "", "the refusal is shown");
  assert.equal(text(page.target, "library-version-result"), "✗ act.md is only hashed, and no note says where its copy is kept — nothing was recorded.");
  assert.deepEqual(commitsOf(page, INSTANCE), []);
  const note = one_(page.target, "library-file-kept-at");
  type(note, "cabinet 3, shelf B");
  await save(page);
  await until(() => commitsOf(page, INSTANCE).length === 1, "the entry is committed");
  assert.deepEqual(Object.keys(commitsOf(page, INSTANCE)[0].files), ["docs/sources/SRC-ai-act.md"]);
  const written = commitsOf(page, INSTANCE)[0].files["docs/sources/SRC-ai-act.md"];
  assert.equal(written.includes("; not stored: act.md |"), true);
  assert.equal(written.includes(`| \`act.md\` | \`${sha(V3)}\` | cabinet 3, shelf B |`), true);
  const entry = readDocument(sourceSchemas().entry, "docs/sources/SRC-ai-act.md", AI);
  await assert.rejects(() => versionCommits(entry, [{ name: "act.md", bytes: bytesOf(V3), keep: false }], { version: "v3", date: "2026-03-03", repository: INSTANCE }),
    (error) => error.name === "NoteMissing" && error.file === "act.md" && error.message === "act.md is only hashed, and no note says where its copy is kept");
});

// TST-591304 · level: unit · module: MOD-settings-pages
// guards: UC-016; RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: SRC-handbook, restricted, whose entry names the repository https://github.com/alice/handbook-content for its content; the token of that repository stored; the file handbook.md holding "Chapter 3\n"
// input: + New version 3 with the file, Save; and the same where the named repository does not exist for the token
// expect: the statement reads "Becomes public: the register entry, always, in the instance repository akmaier/agent-m. Content, stored only in alice/handbook-content and not in the public instance: handbook.md."; one commit in the named repository holding exactly docs/sources/SRC-handbook/3/handbook.md, made with the named repository's token, then one in the instance holding exactly docs/sources/SRC-handbook.md — the named repository's commit is moved first; where the named repository is not found, the result names alice/handbook-content and the token, links the server's token page, and nothing is committed to the instance
test("new version — the content of a restricted source goes to its named repository first, and an unreachable one is named with nothing committed", async (t) => {
  const page = await open(t, { products: [], source: "SRC-handbook" });
  await startVersion(page, "3", "2026-11-01", [fileOf("handbook.md", H3)]);
  assert.equal(text(page.target, "library-version-public"), "Becomes public: the register entry, always, in the instance repository akmaier/agent-m. Content, stored only in alice/handbook-content and not in the public instance: handbook.md.");
  await save(page);
  await until(() => commitsOf(page, INSTANCE).length === 1, "the entry is committed");
  assert.deepEqual(Object.keys(commitsOf(page, NAMED)[0].files), ["docs/sources/SRC-handbook/3/handbook.md"]);
  assert.equal(commitsOf(page, NAMED)[0].authorization, `Bearer ${NAMED_TOKEN}`);
  assert.deepEqual(Object.keys(commitsOf(page, INSTANCE)[0].files), ["docs/sources/SRC-handbook.md"]);
  const patch = (repository) => page.world.requests.findIndex((request) => request.method === "PATCH" && request.url.pathname.startsWith(`/repos/${repository}/`));
  assert.equal(patch(repoOf(NAMED)) >= 0 && patch(repoOf(NAMED)) < patch(INSTANCE), true, "the content first, then the entry");

  const missing = await open(t, { products: [], source: "SRC-handbook", named: false });
  await startVersion(missing, "3", "2026-11-01", [fileOf("handbook.md", H3)]);
  await save(missing);
  await until(() => text(missing.target, "library-version-result") !== "", "the notice is shown");
  const result = text(missing.target, "library-version-result");
  assert.equal(result.includes("alice/handbook-content"), true);
  assert.equal(result.includes("token"), true);
  assert.equal(byTag(one_(missing.target, "library-version-result"), "a")[0].getAttribute("href").startsWith("https://github.com/"), true);
  assert.equal(commitsOf(missing, INSTANCE).length, 0);
});

// TST-591305 · level: unit · module: MOD-settings-pages
// guards: UC-016; A PRODUCT LINKS THE SOURCES THAT APPLY
// given: the browser keeps four products: thesis-tool (links SRC-ai-act at v1), other-tool (links it at v2, the newest), third-tool (has no docs/sources.md), and one the server does not know
// input: render library/SRC-ai-act; then record a version v3 and look at the list again
// expect: one product is listed, "https://github.com/alice/thesis-tool links v1; the newest is v2. Move to the new version"; the product not known is named as one that could not be read, its line beginning "https://github.com/dave/missing could not be read: "; other-tool and third-tool are not listed; after v3 is recorded thesis-tool is listed with "links v1; the newest is v3." and other-tool with "links v2; the newest is v3.", and the page sent no request to any product's repository to find out
test("new version — the products still on an older version are listed, and a new version moves the line without reading the products again", async (t) => {
  const page = await open(t, { products: [THESIS, OTHER, THIRD, GONE], extra: { [THIRD]: { "SPEC.md": SPEC } } });
  assert.deepEqual(byClass(page.target, "library-older-product").map((node) => node.textContent), [`${THESIS} links v1; the newest is v2. Move to the new version`]);
  assert.equal(text(page.target, "library-older-unreadable").startsWith(`${GONE} could not be read: `), true);
  const before = [THESIS, OTHER, THIRD].map((web) => requestsTo(page, repoOf(web)).length);
  await startVersion(page, "v3", "2026-03-03", [fileOf("act.md", V3)]);
  await save(page);
  await until(() => text(page.target, "library-version-result").startsWith("✓"), "the version is recorded");
  assert.deepEqual(byClass(page.target, "library-older-product").map((node) => node.textContent),
    [`${THESIS} links v1; the newest is v3. Move to the new version`, `${OTHER} links v2; the newest is v3. Move to the new version`]);
  assert.deepEqual([THESIS, OTHER, THIRD].map((web) => requestsTo(page, repoOf(web)).length), before);
});

// TST-591306 · level: unit · module: MOD-settings-pages
// guards: UC-016; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// given: a source whose newest version is the only one; a product whose link names a version the entry does not record
// input: render library/SRC-ai-act with thesis-tool linking "v0" (not recorded) and other-tool linking v1
// expect: only other-tool is listed, "links v1; the newest is v2."; no line speaks of thesis-tool being older
test("new version — a link that names a version the entry does not record is not listed as older", async (t) => {
  const page = await open(t, { products: [THESIS, OTHER], extra: { [THESIS]: { "SPEC.md": SPEC, "docs/sources.md": links(`| SRC-ai-act | v0 | ${"5".repeat(64)} | |`) },
    [OTHER]: { "SPEC.md": SPEC, "docs/sources.md": ON_V1 } } });
  assert.deepEqual(byClass(page.target, "library-older-product").map((node) => node.textContent), [`${OTHER} links v1; the newest is v2. Move to the new version`]);
});

// TST-591307 · level: unit · module: MOD-settings-pages
// guards: UC-016; A PRODUCT LINKS THE SOURCES THAT APPLY; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; THE PAGE NAMES WHERE IT SENDS; A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST
// given: thesis-tool links SRC-ai-act at v1 with the part "Art. 13"; its SPEC.md has EXPORT IS A PDF (source "SRC-ai-act, Art. 13") and TITLE PAGE NAMES THE AUTHOR (sources "SRC-ai-act" and "SRC-iec-62304, class B"); v1 holds act.md "Article 1\nArticle 2\nArticle 3\n", v2 "Article 1\nArticle 2 amended\nArticle 3\nArticle 4\n"
// input: press "Move to the new version" of thesis-tool; read the panel; press Move
// expect: the panel reads "Requirements that name SRC-ai-act: EXPORT IS A PDF, TITLE PAGE NAMES THE AUTHOR.", lists for act.md the passages "+ Article 2 amended", "- Article 2", "+ Article 4" in that order, and "Move writes docs/sources.md in https://github.com/alice/thesis-tool as your own commit, and writes nothing else."; listing wrote nothing; Move makes one commit in the product's repository, with the product's token, holding exactly docs/sources.md with the row of SRC-ai-act now at v2 with the version hash of v2 and the part "Art. 13" kept, and the message "edit sources.md (Agent M dashboard)\n\nSource moved: SRC-ai-act v1 to v2\nRequirement affected: EXPORT IS A PDF\nRequirement affected: TITLE PAGE NAMES THE AUTHOR"; the instance is not written, SPEC.md is not among the committed files; the result reads "✓ https://github.com/alice/thesis-tool links SRC-ai-act at v2 (commit " and the first seven characters of the commit and ")."; the product is no longer listed
test("move — it lists the requirements and the passages, and one click commits docs/sources.md with a message that names the requirements", async (t) => {
  const page = await open(t);
  await click(one_(page.target, "library-move-open"));
  await until(() => byClass(page.target, "library-move-confirm").length === 1, "the move is prepared");
  assert.equal(text(page.target, "library-move-requirements"), "Requirements that name SRC-ai-act: EXPORT IS A PDF, TITLE PAGE NAMES THE AUTHOR.");
  assert.deepEqual(byClass(page.target, "library-passages-file").map((node) => node.textContent), ["act.md"]);
  assert.deepEqual(byClass(page.target, "library-passage").map((node) => node.textContent), ["+ Article 2 amended", "- Article 2", "+ Article 4"]);
  assert.equal(text(page.target, "library-move-where"), `Move writes docs/sources.md in ${THESIS} as your own commit, and writes nothing else.`);
  assert.deepEqual(writes(page), [], "listing writes nothing");
  await click(one_(page.target, "library-move-confirm"));
  await until(() => commitsOf(page, THESIS).length === 1 && byClass(page.target, "library-move-done").length === 1, "the move is committed");
  const commit = commitsOf(page, THESIS)[0];
  assert.deepEqual(Object.keys(commit.files), ["docs/sources.md"]);
  assert.equal(commit.files["docs/sources.md"], ON_V2);
  assert.equal(commit.authorization, `Bearer ${PRODUCT_TOKEN}`);
  assert.equal(commit.message, "edit sources.md (Agent M dashboard)\n\nSource moved: SRC-ai-act v1 to v2\nRequirement affected: EXPORT IS A PDF\nRequirement affected: TITLE PAGE NAMES THE AUTHOR");
  assert.deepEqual([commitsOf(page, INSTANCE).length, commitsOf(page, OTHER).length], [0, 0]);
  assert.equal(text(page.target, "library-move-done"), `✓ ${THESIS} links SRC-ai-act at v2 (commit ${commit.sha.slice(0, 7)}).`);
  assert.equal(byClass(page.target, "library-older-product").length, 0);
});

// TST-591308 · level: unit · module: MOD-settings-pages
// guards: UC-016; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: thesis-tool on v1 as before
// input: press "Move to the new version"; a click on Move that the page itself dispatched; leave the page
// expect: nothing is written by the listing or by the dispatched click; the link stays at v1 in the product's repository, and a fresh render of the entry lists thesis-tool again as on v1 (the library keeps showing that a newer version exists)
test("move — a product the author keeps on the old version is left alone: listing and a click not made by a person write nothing", async (t) => {
  const page = await open(t);
  await click(one_(page.target, "library-move-open"));
  await until(() => byClass(page.target, "library-move-confirm").length === 1, "the move is prepared");
  one_(page.target, "library-move-confirm").dispatchEvent(new Event("click"));
  await turn();
  await turn();
  assert.deepEqual(writes(page), []);
  assert.equal(page.world.files(repoOf(THESIS))["docs/sources.md"], ON_V1);
  const again = await open(t);
  assert.deepEqual(byClass(again.target, "library-older-product").map((node) => node.textContent), [`${THESIS} links v1; the newest is v2. Move to the new version`]);
});

// TST-591309 · level: unit · module: MOD-settings-pages
// guards: UC-016; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// given: SRC-iec-62304 with the versions 2006 and 2015, each of the file iec.pdf only hashed (not stored); a product linking 2006 whose SPEC.md has TITLE PAGE NAMES THE AUTHOR naming "SRC-iec-62304, class B"; the version 2015 records a version hash
// input: press "Move to the new version"
// expect: the requirements are listed, "Requirements that name SRC-iec-62304: TITLE PAGE NAMES THE AUTHOR."; where the passages would be, "The passages are not listed: iec.pdf is not stored."; no content of the source is requested; Move is offered
test("move — passages are listed only when both versions are text that is stored; otherwise the page says which file is not", async (t) => {
  const iec = entryOf("SRC-iec-62304", "IEC 62304", "restricted — the publisher's terms", [
    { version: "2006", date: "2026-01-01", files: one("iec.pdf", "p1"), notStored: ["iec.pdf"] }, { version: "2015", date: "2026-02-01", files: one("iec.pdf", "p2"), notStored: ["iec.pdf"] }]);
  const product = links(`| SRC-iec-62304 | 2006 | ${versionHash(one("iec.pdf", "p1"))} | |`);
  const page = await open(t, { instance: { "docs/sources/SRC-iec-62304.md": iec }, products: [THESIS], extra: { [THESIS]: { "SPEC.md": SPEC, "docs/sources.md": product } }, source: "SRC-iec-62304" });
  await click(one_(page.target, "library-move-open"));
  await until(() => byClass(page.target, "library-move-confirm").length === 1, "the move is prepared");
  assert.equal(text(page.target, "library-move-requirements"), "Requirements that name SRC-iec-62304: TITLE PAGE NAMES THE AUTHOR.");
  assert.equal(text(page.target, "library-move-passages-none"), "The passages are not listed: iec.pdf is not stored.");
  assert.equal(page.world.requests.some((request) => /\/SRC-iec-62304\//.test(request.url.pathname) || request.named.some((path) => /^docs\/sources\/SRC-iec-62304\//.test(path))), false);
  assert.equal(page.world.requests.some((request) => request.url.pathname.endsWith("/docs/sources/SRC-iec-62304.md") || request.named.includes("docs/sources/SRC-iec-62304.md")), true, "known positive: the entry is read, by its own request or in a batch");
  assert.equal(one_(page.target, "library-move-confirm").disabled, false);
});

// TST-591310 · level: unit · module: MOD-settings-pages
// guards: UC-016; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// given: a source whose newest version records no version hash (the cell holds "none"), both versions' file only hashed; a product linking the earlier version
// input: press "Move to the new version"; press Move
// expect: the panel says "v2 records no version hash, so a link cannot name it."; Move is disabled and a press writes nothing
test("move — a newest version that records no version hash cannot be moved to", async (t) => {
  const bare = entryOf("SRC-bare", "Bare", "may be republished — x", [
    { version: "v1", date: "2026-01-01", files: one("b.pdf", "b1"), notStored: ["b.pdf"] }, { version: "v2", date: "2026-02-01", files: one("b.pdf", "b2"), notStored: ["b.pdf"], hash: "none" }]);
  const product = links(`| SRC-bare | v1 | ${versionHash(one("b.pdf", "b1"))} | |`);
  const page = await open(t, { instance: { "docs/sources/SRC-bare.md": bare }, products: [THESIS], extra: { [THESIS]: { "SPEC.md": SPEC, "docs/sources.md": product } }, source: "SRC-bare" });
  await click(one_(page.target, "library-move-open"));
  await until(() => byClass(page.target, "library-move-confirm").length === 1, "the move is prepared");
  assert.equal(text(page.target, "library-move-nohash"), "v2 records no version hash, so a link cannot name it.");
  assert.equal(one_(page.target, "library-move-confirm").disabled, true);
  await click(one_(page.target, "library-move-confirm"));
  assert.deepEqual(writes(page), []);
});

// TST-591311 · level: unit · module: MOD-settings-pages
// guards: UC-016
// given: thesis-tool on v1; the file act.md of v2 is missing in the instance
// input: press "Move to the new version"
// expect: the panel reads "✗ The move could not be prepared: akmaier/agent-m does not hold docs/sources/SRC-ai-act/v2/act.md." and offers no Move
test("move — content that cannot be read is named, and no Move is offered", async (t) => {
  const { "docs/sources/SRC-ai-act/v2/act.md": _gone, ...without } = INSTANCE_FILES;
  const page = await open(t, { instance: without, products: [THESIS] });
  await click(one_(page.target, "library-move-open"));
  await until(() => byClass(page.target, "library-move-unreadable").length === 1, "the failure is shown");
  assert.equal(text(page.target, "library-move-unreadable"), "✗ The move could not be prepared: akmaier/agent-m does not hold docs/sources/SRC-ai-act/v2/act.md.");
  assert.equal(byClass(page.target, "library-move-confirm").length, 0);
});

// TST-591312 · level: unit · module: MOD-settings-pages
// guards: UC-016; RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE
// given: SRC-handbook, restricted, with its content in https://github.com/alice/handbook-content (handbook.md "Chapter 1\n" in version 1, "Chapter 1\nChapter 2\n" in version 2); a product linking version 1
// input: press "Move to the new version"
// expect: the passage "+ Chapter 2" under handbook.md; the content was read from the named repository with its token and the instance was asked for no file under docs/sources/SRC-handbook/
test("move — the passages of a restricted source are read where its content lies", async (t) => {
  const product = links(`| SRC-handbook | 1 | ${versionHash(one("handbook.md", H1))} | |`);
  const page = await open(t, { products: [GUIDE], extra: { [GUIDE]: { "SPEC.md": SPEC, "docs/sources.md": product } }, source: "SRC-handbook" });
  await click(one_(page.target, "library-move-open"));
  await until(() => byClass(page.target, "library-move-confirm").length === 1, "the move is prepared");
  assert.deepEqual(byClass(page.target, "library-passage").map((node) => node.textContent), ["+ Chapter 2"]);
  assert.equal(requestsTo(page, repoOf(NAMED)).some((request) => request.authorization === `Bearer ${NAMED_TOKEN}` && request.url.pathname.endsWith("/handbook.md")), true);
  assert.equal(requestsTo(page, INSTANCE).some((request) => /\/SRC-handbook\//.test(request.url.pathname) || request.named.some((path) => /^docs\/sources\/SRC-handbook\//.test(path))), false);
});

// TST-591313 · level: unit · module: MOD-settings-pages
// guards: UC-016; A PAGE LOAD READS THE REPOSITORY IN BATCHES
// given: the instance's register of two entries (as the repository holds), two products that the browser keeps and that link SRC-ai-act (thesis-tool on v1, other-tool on v2), each with its docs/sources.md; once with a token stored and once with none
// input: render library/SRC-ai-act; press "Move to the new version" of thesis-tool; (with a token) press Move
// expect: opening sends, with a token, 16 requests: 6 to the instance (the repository's information 1 with greenToMerge's GraphQL request beside it 1 (ITM-1170), its snapshot 2, its two entries in one query of GitHub's GraphQL API 1, the list of the fetch workflow's runs 1), 5 to thesis-tool and 5 to other-tool (information 1 with greenToMerge's beside it 1, snapshot 2, docs/sources.md 1), and, without one, 14: 6 to the instance (no greenToMerge request; the two entries 2, one request each), 4 and 4; no request to a product asks for its SPEC.md or a source's content; the press of "Move to the new version" sends 6 requests without a token and 7 with one, 1 to thesis-tool (SPEC.md) and 5 or 6 to the instance (information 1, with a token greenToMerge's beside it 1, snapshot 2, the two versions' files 2); the press of Move sends 9, all to thesis-tool (information 1, greenToMerge's beside it 1, snapshot 2, the branch's head 1, its commit 1, the tree 1, the new commit 1, the move of the branch 1); with no token stored the press of Move is refused by the server, writes nothing, and its result begins with ✗
test("budget — opening a source reads each kept product's docs/sources.md once; Move reads two versions' files; both counted with a token and without", async (t) => {
  for (const token of [true, false]) {
    const page = await open(t, { token });
    const label = token ? "with a token" : "without a token";
    const by = () => [INSTANCE, repoOf(THESIS), repoOf(OTHER)].map((repository) => requestsTo(page, repository).length);
    // ITM-1170: with a token, each repository's information has greenToMerge's GraphQL request beside it.
    assert.equal(page.world.requests.length, token ? 16 : 14, `${label}: opening`);
    assert.deepEqual(by(), token ? [6, 5, 5] : [6, 4, 4], `${label}: opening, by repository`);
    assert.equal(page.world.requests.some((request) => request.url.pathname.endsWith("/SPEC.md")), false, `${label}: no SPEC.md is read on opening`);
    page.world.requests.length = 0;
    await click(one_(page.target, "library-move-open"));
    await until(() => byClass(page.target, "library-move-confirm").length === 1, `${label}: the move is prepared`);
    assert.equal(page.world.requests.length, token ? 7 : 6, `${label}: Move to the new version`);
    assert.deepEqual(by(), token ? [6, 1, 0] : [5, 1, 0], `${label}: Move to the new version, by repository`);
    page.world.requests.length = 0;
    await click(one_(page.target, "library-move-confirm"));
    if (token) {
      await until(() => byClass(page.target, "library-move-done").length === 1, `${label}: Move is committed`);
      assert.equal(page.world.requests.length, 9, `${label}: Move`);
      assert.deepEqual(by(), [0, 9, 0], `${label}: Move, by repository`);
    } else {
      await until(() => text(page.target, "library-move-result").startsWith("✗"), `${label}: Move is refused`);
      assert.deepEqual(commitsOf(page, THESIS), [], `${label}: nothing is written`);
    }
  }
});

// TST-591314 · level: unit · module: MOD-settings-pages
// guards: UC-004
// given: the register holds SRC-ai-act (EU AI Act); the documents route with a file chosen
// input: the title "EU AI Act" typed in the form; the offer pressed
// expect: the form names the source as already in the library, "SRC-ai-act", and says to add a new version of it instead; the offer is the button "Add a new version of SRC-ai-act", whose press goes to the route library for the source SRC-ai-act, where + New version is; Save stays disabled
test("registration — a source already in the library is offered a new version instead", async (t) => {
  const page = await open(t, { products: [], source: "" });
  await click(one_(page.target, "library-register"));
  const select = one_(page.target, "library-route");
  select.value = "documents";
  select.dispatchEvent(new Event("change"));
  await turn();
  const input = one_(page.target, "library-files");
  input.files = [fileOf("a.md", "# A\n")];
  input.dispatchEvent(new Event("change"));
  await until(() => byClass(page.target, "library-file-hash").length === 1, "the file is hashed");
  const field = (key) => byTag(elements(one_(page.target, "library-form-box"), (node) => node.getAttribute("data-key") === key)[0], "input")[0];
  type(field("title"), "EU AI Act");
  await until(() => byClass(page.target, "library-already").length === 1, "the source is named as already in the library");
  const form = one_(page.target, "library-form-box").textContent;
  assert.equal(form.includes("this source is already in the library as SRC-ai-act"), true);
  assert.equal(form.includes("add a new version of it instead"), true);
  assert.equal(text(page.target, "library-already"), "Add a new version of SRC-ai-act");
  await click(one_(page.target, "library-already"));
  assert.deepEqual(page.went.at(-1), ["library", { source: "SRC-ai-act" }]);
  const saveButton = byTag(one_(page.target, "library-form-box"), "button").filter((node) => node.textContent === "Save").at(-1);
  assert.equal(saveButton.disabled, true);
});

// TST-591315 · level: unit · module: MOD-settings-pages
// guards: EVERY STEP EXPLAINS ITSELF
// given: the entry of a source; + New version pressed
// input: the panel
// expect: the folded explanations of a file only hashed (it mentions SHA-256) and of what becomes public (it mentions that it becomes public), each closed
test("new version — the panel's explanations are folded", async (t) => {
  const page = await open(t, { products: [] });
  await click(one_(page.target, "library-new-version"));
  const folded = byClass(one_(page.target, "library-new-version-panel"), "explain");
  for (const [name, snippet] of [["a file only hashed", /SHA-256/], ["what becomes public", /becomes\s+public/]]) {
    const found = folded.find((node) => snippet.test(node.textContent));
    assert.equal(found !== undefined, true, `the explanation of ${name}`);
    assert.equal(found.hasAttribute("open"), false, `${name}: folded`);
  }
});

// TST-591316 · level: unit · module: MOD-settings-pages
// guards: EVERY STEP EXPLAINS ITSELF
// given: the entry of a source; + New version pressed
// input: the panel
// expect: it holds the folded What is this? of the topic source-new-version — a closed details whose body is the topic's rendered text, the same as explain("source-new-version") gives
test("new version — the panel folds the explanation source-new-version", async (t) => {
  const page = await open(t, { products: [] });
  await click(one_(page.target, "library-new-version"));
  const wanted = explain("source-new-version");
  const found = byClass(one_(page.target, "library-new-version-panel"), "explain").filter((node) => node.children[1]?.innerHTML === wanted.children[1].innerHTML);
  assert.equal(found.length, 1);
  assert.equal(found[0].hasAttribute("open"), false);
});

// TST-591317 · level: unit · module: MOD-settings-pages
// guards: EVERY STEP EXPLAINS ITSELF
// given: a product on an older version
// input: the Move to the new version of the product pressed
// expect: its panel holds the folded What is this? of the topic source-move — a closed details whose body is the topic's rendered text, the same as explain("source-move") gives
test("move — the panel folds the explanation source-move", async (t) => {
  const page = await open(t, { products: [THESIS] });
  await click(one_(page.target, "library-move-open"));
  await until(() => byClass(page.target, "library-move-confirm").length === 1, "the move is prepared");
  const wanted = explain("source-move");
  const found = byClass(one_(page.target, "library-move-panel"), "explain").filter((node) => node.children[1]?.innerHTML === wanted.children[1].innerHTML);
  assert.equal(found.length, 1);
  assert.equal(found[0].hasAttribute("open"), false);
});
