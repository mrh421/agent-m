// The library and registering a source (ITM-350) — MOD-settings-pages' routes `library` and `library/<source>`, as docs/architecture/MOD-settings-pages.md and
// UC-004 state them: the register's sources with their versions; + Register source by route — an EU legal text with its identifier recognised, a standard with its
// designation and its licence preset to restricted, documents hashed in the browser or only hashed, a repository pinned to its current commit —; the common fields in a
// form from the entry's schema, a licence `unknown` counting as restricted; what becomes public stated before Save, which commits the plan's files, each in its repository,
// under the person's account; a named repository the token cannot reach named, with how to extend the token; a source already in the library named, with its entry
// linked; the explanations folded. The fetch of an EU legal text after saving, and a new version of a source (UC-016), are not part of this item.
// Run: node --test tests/settings-pages-library.test.mjs
//
// Module: MOD-settings-pages
// Guards: UC-004
// Guards: THE INSTANCE KEEPS THE SOURCE REGISTER; THE SOURCE MODEL IS GENERIC; THE SOURCE KIND IS ONE OF A CLOSED SET; A SOURCE DECLARES ITS AUTHORITY; A SOURCE DECLARES ITS LICENCE
// Guards: A STANDARD IS REGISTERED BY ITS DESIGNATION; A LIVING SOURCE IS PINNED; RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// Guards: ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged. The instance is a host of this file: its snapshot holds the register's entries, and it records
// every commit. A named repository is GitHub's REST API answered by a fake of fetch, with MOD-repository-hosts' connect the real, accepted one, as
// tests/settings-pages-add-product.test.mjs does. The files of a source are constructed. Where the texts leave a reading open, the test states the reading it takes, and the pull
// request names it with its source:
//   - The routes preset the kind: an EU legal text `regulation`, a standard `standard`, documents `document`, a repository `system`; the closed set of kinds names no `repository`, and the
//     person may change the kind in the form.
//   - The first version's identifier is the day of registration for documents and a repository, and the designation for a standard; the person may edit the Versions section.
//   - An EU legal text is registered as its entry alone, with no version row: the fetch (UC-004 7) records the version, and registrationCommits needs a first row.
//   - The content goes to its repository before the entry goes to the instance, so that an entry never names content that was not stored; a refusal of the named repository
//     commits nothing in the instance.
//   - A source is already in the library when its identifier, its title or, for a standard, its designation equals an entry's, as a requirement's source item names an entry.
//   - A file only hashed is asked for the note where its copy is kept, beside its tick; the refusal of such a file without a note is MOD-source-register's NoteMissing, which the page shows in
//     its result, naming the file; the page adds no check of its own, and Save is not disabled for it.
// A name the module does not provide yet fails each test by itself. The counter-proofs are in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const { view } = await import("../src/settings-pages/index.mjs");
const { openStore, readSetting, writeSetting } = await import("../src/browser-store/index.mjs");
const { readDocument } = await import("../src/documents/index.mjs");
const { sourceSchemas } = await import("../src/source-register/index.mjs");
const { schemaForm } = await import("../src/site-frame/index.mjs");

const route = () => view.routes.find((candidate) => candidate.name === "library");
const INSTANCE = "alice/agent-m";
const NAMED = "https://github.com/alice/restricted-content";
const TODAY = new Date().toISOString().slice(0, 10);

class Storage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  get length() { return this.values.size; }
  key(index) { return [...this.values.keys()][index] ?? null; }
}
function descendants(root, predicate) {
  const found = [];
  (function visit(node) { for (const child of node.childNodes ?? []) { if (child.nodeType === 1) { if (predicate(child)) found.push(child); visit(child); } } })(root);
  return found;
}
const byClass = (root, name) => descendants(root, (node) => (node.className ?? "").split(" ").includes(name));
const one = (root, name) => { const found = byClass(root, name); assert.equal(found.length, 1, `exactly one .${name}`); return found[0]; };
const settle = () => new Promise((resolve) => setTimeout(resolve, 15));
const fire = async (node, type) => { node.dispatchEvent(new Event(type)); await settle(); };
// A person's click: a browser marks it trusted (`isTrusted`); node marks every Event untrusted, as a script's.
const click = async (node) => { node.dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true })); await settle(); };
const put = async (node, value, type = "change") => { node.value = value; await fire(node, type); };
const folded = (root) => byClass(root, "explain");
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const bytesOf = (text) => new TextEncoder().encode(text);
// The form from the entry's schema: its field of a key, its Save.
const fieldOf = (form, key) => descendants(form, (node) => node.getAttribute?.("data-key") === key)[0];
const inputOf = (form, key) => descendants(fieldOf(form, key), (node) => node.localName === "input")[0];
const typeInto = (form, key, value) => put(inputOf(form, key), value, "input");
const saveOf = (form) => descendants(form, (node) => node.localName === "button" && node.textContent === "Save").at(-1);
const fileOf = (name, text) => ({ name, size: bytesOf(text).length, arrayBuffer: async () => bytesOf(text).buffer.slice(0) });

const entryText = (fields, rows = "") => ["---", ...Object.entries(fields).map(([key, value]) => `${key}: ${value}`), "---", `# ${fields.id} ${fields.title}`, "", "## Versions", "",
  "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", rows, ""].join("\n");
const SOURCES = {
  "docs/sources/SRC-eu-ai-act.md": entryText({ id: "SRC-eu-ai-act", title: "EU AI Act", kind: "regulation", authority: "normative", licence: "may be republished — EU law", identifier: "32024R1689" },
    `| \`2026-10-01\` | 2026-10-01 | Regulation (EU) 2024/1689 | the publication repository, retrieved 2026-10-01 | 1 file, listed below; version hash \`${"1".repeat(64)}\` |\n\n### Files of 2026-10-01\n\n| File | SHA-256 |\n|---|---|\n| \`act.html\` | \`${"a".repeat(64)}\` |`),
  "docs/sources/SRC-iec-62304.md": entryText({ id: "SRC-iec-62304", title: "IEC 62304", kind: "standard", authority: "normative", licence: "restricted — the publisher's terms", designation: "IEC 62304:2006+AMD1:2015" },
    `| \`IEC 62304:2006+AMD1:2015\` | 2026-10-02 | — | my printed copy | 1 file, listed below; version hash \`${"2".repeat(64)}\`; not stored: iec-62304.pdf |\n\n### Files of IEC 62304:2006+AMD1:2015\n\n| File | SHA-256 |\n|---|---|\n| \`iec-62304.pdf\` | \`${"b".repeat(64)}\` |`),
};

// The named repository, GitHub's REST API answered by a fake of fetch keyed by method and path; `mode` is "ok", or "missing" (404) or "forbidden" (403) for every request.
function githubFake(mode, order) {
  const prefix = "/repos/alice/restricted-content";
  const posts = [];
  const handler = async (input, init = {}) => {
    const url = new URL(typeof input === "object" && !(input instanceof URL) ? input.url : String(input));
    const method = String(init.method ?? "GET").toUpperCase();
    const answer = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.origin !== "https://api.github.com") throw new Error(`unscripted request: ${method} ${url}`);
    if (mode === "missing") return answer(404, { message: "Not Found" });
    if (mode === "forbidden") return answer(403, { message: "Resource not accessible by personal access token" });
    const path = url.pathname;
    if (method === "GET" && path === prefix) return answer(200, { default_branch: "main", visibility: "private", private: true, archived: false, description: "", permissions: { push: true } });
    if (method === "GET" && path === `${prefix}/commits/main`) return answer(200, { sha: "a".repeat(40), commit: { tree: { sha: "b".repeat(40) } } });
    if (method === "GET" && path === `${prefix}/git/trees/${"a".repeat(40)}`) return answer(200, { sha: "a".repeat(40), truncated: false, tree: [] });
    if (method === "GET" && path === `${prefix}/git/ref/heads/main`) return answer(200, { object: { sha: "a".repeat(40) } });
    if (method === "GET" && path === `${prefix}/git/commits/${"a".repeat(40)}`) return answer(200, { tree: { sha: "b".repeat(40) } });
    if (method === "POST" && path === `${prefix}/git/blobs`) { posts.push({ kind: "blob", body: JSON.parse(init.body) }); return answer(201, { sha: `${posts.length}`.padStart(40, "e") }); }
    if (method === "POST" && path === `${prefix}/git/trees`) { posts.push({ kind: "tree", body: JSON.parse(init.body) }); return answer(201, { sha: "c".repeat(40) }); }
    if (method === "POST" && path === `${prefix}/git/commits`) { order.push("named"); posts.push({ kind: "commit", body: JSON.parse(init.body) }); return answer(201, { sha: "d".repeat(40), html_url: `${NAMED}/commit/${"d".repeat(40)}` }); }
    if (method === "PATCH" && path === `${prefix}/git/refs/heads/main`) return answer(200, { object: { sha: "d".repeat(40) } });
    throw new Error(`unscripted request: ${method} ${path}`);
  };
  return { handler, posts };
}

// A browser: the store with the instance's token, the instance host with the register, the commits it records, and a named repository fake.
function browser(t, { sources = SOURCES, named = "ok", runs = [], logs = {} } = {}) {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: new Storage() });
  const store = openStore(INSTANCE);
  writeSetting(store, "github-token", { value: "github_pat_constructed", name: "Agent M", expires: "2027-01-01" });
  const commits = [], order = [], started = [];
  const host = {
    repositoryInfo: async () => ({ defaultBranch: "main", visibility: "public", canWrite: true }),
    readSnapshot: async () => ({ commit: "h".repeat(40), paths: [...Object.keys(sources), "docs/sources/SRC-eu-ai-act/2026-10-01/act.html", "docs/sources.md"],
      blob: () => "b".repeat(40), read: async (path) => sources[path] ?? null }),
    commitFiles: async (change) => { order.push("instance"); commits.push(change); return { commit: "i".repeat(40), url: `https://github.com/${INSTANCE}/commit/${"i".repeat(40)}` }; },
    listCiRuns: async (filter) => runs.filter((run) => (!filter?.workflow || run.workflow === filter.workflow) && (!filter?.branch || run.branch === filter.branch)),
    ciRunLog: async (id) => logs[id] ?? null,
    startWorkflow: async (workflow, ref, inputs) => {
      started.push({ workflow, ref, inputs });
      return { id: "fresh-run", workflow, commit: "", event: "workflow_dispatch", state: "queued", url: "https://github.com/alice/agent-m/actions/runs/fresh-run", started: null, ended: null };
    },
    webLinks: () => ({}),
  };
  const fake = githubFake(named, order);
  const priorFetch = globalThis.fetch;
  globalThis.fetch = fake.handler;
  t.after(() => { globalThis.fetch = priorFetch; });
  const went = [];
  const context = { instance: { repository: INSTANCE, host }, product: null, store, go(name, params) { went.push([name, params]); } };
  return { store, commits, order, posts: fake.posts, started, requests: () => fake.posts.length, context, went,
    async page(params = {}) { const target = document.createElement("div"); document.body.append(target); await route().render(target, context, params); await settle(); return target; } };
}
const instanceFiles = (b) => b.commits.flatMap((commit) => commit.files);
const entryOfCommit = (b, id) => readDocument(sourceSchemas().entry, `docs/sources/${id}.md`, instanceFiles(b).find((file) => file.path === `docs/sources/${id}.md`).text);

// Opens + Register source, chooses a route.
async function register(page, routeName) {
  await click(one(page, "library-register"));
  await put(one(page, "library-route"), routeName);
  return one(page, "library-form-box");
}

// TST-472750 · level: unit · module: MOD-settings-pages
// guards: THE INSTANCE KEEPS THE SOURCE REGISTER; UC-004
// given: an instance whose register holds two sources, one with a version of one file, one whose copy was only hashed
// input: the route `library`
// expect: each source listed by its name with its kind and its versions, the names in the order of the register; the register's files under a source's own folder are not sources; nothing is requested of the instance but its register and nothing is committed
test("library — the register's sources are listed with their versions, and nothing is written", async (t) => {
  const b = browser(t);
  const page = await b.page();
  const names = byClass(page, "library-source-name").map((node) => node.textContent);
  assert.deepEqual(names, ["EU AI Act", "IEC 62304"]);
  const lines = byClass(page, "library-source");
  assert.equal(lines.length, 2);
  assert.match(lines[0].textContent, /regulation/);
  assert.match(lines[0].textContent, /2026-10-01/);
  assert.match(lines[1].textContent, /standard/);
  assert.deepEqual(b.commits, []);
});

// TST-472751 · level: unit · module: MOD-settings-pages
// guards: ONE CLICK PER DECISION; A SOURCE DECLARES ITS AUTHORITY; THE SOURCE KIND IS ONE OF A CLOSED SET; UC-004
// given: + Register source, and each route chosen in turn
// input: the route field
// expect: for each route its own part and the others hidden; the form from the entry's schema with the kind preset — regulation, standard, document, system —, the standard's licence preset to restricted and the others' empty, and Save disabled while the form holds an error; a sentence and an example for each route, and the folded explanation of the kinds
test("library — + Register source offers the four routes, each with its form from the entry's schema", async (t) => {
  const b = browser(t);
  const page = await b.page();
  assert.equal(one(page, "library-register-panel").hidden, true, "known positive: the panel opens on the person's click");
  await click(one(page, "library-register"));
  assert.equal(one(page, "library-register-panel").hidden, false);
  assert.match(one(page, "library-route-help").textContent, /EUR-Lex|ELI/);
  assert.ok(folded(one(page, "library-register-panel")).some((node) => /EU legal text/.test(node.textContent)), "the kinds are explained, folded");
  for (const [name, part, kind, licence] of [["legal-text", "library-route-legal-text", "regulation", undefined], ["standard", "library-route-standard", "standard", "restricted"],
    ["documents", "library-route-documents", "document", undefined], ["repository", "library-route-repository", "system", undefined]]) {
    const form = await register(page, name);
    for (const other of ["library-route-legal-text", "library-route-standard", "library-route-documents", "library-route-repository"]) {
      assert.equal(one(page, other).hidden, other !== part, `${other} for ${name}`);
    }
    assert.equal(inputOf(form, "kind").value, kind, `${name}: kind`);
    assert.equal(inputOf(form, "licence").value, licence ?? "", `${name}: licence`);
    for (const key of ["id", "title", "authority", "licence"]) assert.ok(fieldOf(form, key), `${name}: ${key}`);
    assert.equal(saveOf(form).disabled, true, `${name}: Save while the form holds an error`);
  }
});

// TST-472752 · level: unit · module: MOD-settings-pages
// guards: A STANDARD IS REGISTERED BY ITS DESIGNATION; UC-004
// given: the standard route; the EU legal text route with an EUR-Lex address and with an address that names no text; the repository route
// input: the designation entered; the address pasted; the repository address pasted, a stored token reading its current commit
// expect: the designation in the form's field, its explanation folded; the CELEX number recognised from the address — 32024R1689 for the AI Act — and shown, in the form's identifier; an address naming no text says so; the repository pinned to the commit its default branch stands at, shown and its address in the form's identifier
test("library — the route-specific part: a designation, a recognised identifier, a pinned commit", async (t) => {
  const b = browser(t);
  const page = await b.page();
  let form = await register(page, "standard");
  await put(one(page, "library-standard-designation"), "IEC 62304:2006+AMD1:2015");
  form = one(page, "library-form-box");
  assert.equal(inputOf(form, "designation").value, "IEC 62304:2006+AMD1:2015");
  assert.ok(folded(one(page, "library-route-standard")).some((node) => /cover page/.test(node.textContent)));

  await register(page, "legal-text");
  await put(one(page, "library-legal-address"), "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689");
  assert.match(one(page, "library-legal-identifier").textContent, /32024R1689/);
  assert.equal(inputOf(one(page, "library-form-box"), "identifier").value, "32024R1689");
  await put(one(page, "library-legal-address"), "https://example.org/nothing");
  assert.match(one(page, "library-legal-identifier").textContent, /not recogni[sz]ed|no EU legal text/i);

  writeSetting(b.store, "github-token:alice/restricted-content", { value: "github_pat_named", name: "named", expires: "2027-01-01" });
  await register(page, "repository");
  await put(one(page, "library-repository-address"), NAMED);
  assert.match(one(page, "library-repository-commit").textContent, new RegExp("a".repeat(40)));
  assert.equal(inputOf(one(page, "library-form-box"), "identifier").value, NAMED);
});

// Fills the common fields of the form as a person does, after the route's own part.
async function describe(page, fields) {
  const form = one(page, "library-form-box");
  for (const [key, value] of Object.entries(fields)) await typeInto(form, key, value);
  return form;
}
const SELECTED = [fileOf("a.md", "# A\n"), fileOf("b.md", "# B\n")];
// The tick of "only hash it", as a person makes it: the field takes the tick, then reports the change.
async function tickHashed(page) { const box = one(page, "library-file-only-hashed"); box.checked = true; await fire(box, "change"); }
// Waits for `condition`, bounded by the clock: the page hashes the files one after the other, and how long that takes is not fixed.
async function until(condition, what, ms = 5000) {
  const deadline = Date.now() + ms;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
// The files chosen as a person chooses them: the field takes them, reports the change, and the page shows each with its SHA-256 before the test goes on.
async function chooseFiles(page, files) {
  const input = one(page, "library-files");
  input.files = files;
  await fire(input, "change");
  await until(() => byClass(page, "library-file-hash").length === files.length, `the hashes of ${files.length} files`);
}

// TST-472753 · level: unit · module: MOD-settings-pages
// guards: RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY; ONE CLICK PER DECISION; UC-004
// given: the documents route, two files selected, a licence that may be republished
// input: the form filled in, Save once
// expect: before Save nothing committed, the files hashed in the browser and shown with their SHA-256, and a statement that the entry and the files become public; one click commits to the instance the entry `docs/sources/SRC-handbook.md` with its first version, the day of registration, and each file under docs/sources/SRC-handbook/<version>/, bytes as selected; no other repository is asked
test("library — documents that may be republished are committed to the instance with their entry, by one click", async (t) => {
  const b = browser(t);
  const page = await b.page();
  await register(page, "documents");
  await chooseFiles(page, SELECTED);
  const hashes = byClass(page, "library-file-hash").map((node) => node.textContent);
  assert.deepEqual(hashes.map((text) => text.match(/[0-9a-f]{64}/)?.[0]), [sha(bytesOf("# A\n")), sha(bytesOf("# B\n"))]);
  const form = await describe(page, { id: "SRC-handbook", title: "Handbook", authority: "advisory", licence: "may be republished — CC BY 4.0" });
  assert.match(one(page, "library-public").textContent, /register entry/i);
  assert.match(one(page, "library-public").textContent, /a\.md/);
  assert.match(one(page, "library-public").textContent, /public/i);
  assert.deepEqual(b.commits, []);
  assert.equal(saveOf(form).disabled, false);
  await click(saveOf(form));
  await until(() => /SRC-handbook/.test(one(page, "library-result").textContent), "the result of the one click");
  assert.equal(b.commits.length, 1, "one commit, one click");
  assert.deepEqual([b.commits[0].branch, b.commits[0].expectedHead], ["main", "h".repeat(40)], "on the branch's head as it was read");
  assert.deepEqual(instanceFiles(b).map((file) => file.path).sort(), ["docs/sources/SRC-handbook.md", `docs/sources/SRC-handbook/${TODAY}/a.md`, `docs/sources/SRC-handbook/${TODAY}/b.md`]);
  assert.equal(new TextDecoder().decode(instanceFiles(b).find((file) => file.path.endsWith("/a.md")).bytes), "# A\n");
  const entry = entryOfCommit(b, "SRC-handbook");
  assert.equal(entry.fields.kind, "document");
  const row = entry.sections.find((section) => section.heading === "## Versions").rows[0].cells;
  assert.match(row.Version, new RegExp(TODAY));
  assert.match(row.Files, /2 files/);
  assert.ok(instanceFiles(b).find((file) => file.path.endsWith("SRC-handbook.md")).text.includes(sha(bytesOf("# A\n"))));
  assert.deepEqual(b.posts, [], "no other repository is asked");
  assert.match(one(page, "library-result").textContent, /SRC-handbook/);
});

// Every SHA-256 the page asks the browser for takes `ms` longer, as on a loaded runner; the digest is put back after the test.
function slowDigest(t, ms) {
  const subtle = globalThis.crypto.subtle, own = Object.hasOwn(subtle, "digest"), real = subtle.digest;
  subtle.digest = async (...args) => { await new Promise((resolve) => setTimeout(resolve, ms)); return real.apply(subtle, args); };
  t.after(() => { if (own) subtle.digest = real; else delete subtle.digest; });
}

// TST-1011001 · level: unit · module: MOD-settings-pages
// guards: UC-004; A PERSON'S OWN INPUT IS COMMITTED DIRECTLY
// given: the documents route, the two files of TST-472753 ("# A\n", "# B\n"), and a browser whose every SHA-256 takes 20 ms longer than it does here
// input: the two files chosen
// expect: however long the hashing takes, the page shows both files, each with the SHA-256 of its own bytes, in the order chosen — sha256("# A\n") = aa1237b773c38dbddef583c4868aaea7a44c5237ea7923aecca5513764b42d80 and sha256("# B\n") = a81d3fbddd441e2d690b9c03c18251323a295c8eb8ebbfb81ca45b63bf8d5a06 — and the test does not read the page before it shows them
test("library — the files' hashes are shown whatever time the browser takes to hash them", async (t) => {
  slowDigest(t, 20);
  const b = browser(t);
  const page = await b.page();
  await register(page, "documents");
  await chooseFiles(page, SELECTED);
  const hashes = byClass(page, "library-file-hash").map((node) => node.textContent.match(/[0-9a-f]{64}/)?.[0]);
  assert.deepEqual(hashes, ["aa1237b773c38dbddef583c4868aaea7a44c5237ea7923aecca5513764b42d80", "a81d3fbddd441e2d690b9c03c18251323a295c8eb8ebbfb81ca45b63bf8d5a06"]);
});

// TST-472754 · level: unit · module: MOD-settings-pages
// guards: RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE; A SOURCE DECLARES ITS LICENCE; UC-004
// given: the documents route, two files, a licence `restricted`; and the same with `unknown`; the named repository without and with its address
// input: the form filled in; Save
// expect: without a named repository an error beside the form and Save disabled, for `unknown` as for `restricted`; with it the statement names that repository; Save commits the files only to it, at docs/sources/SRC-paid/<version>/, then the entry, which holds no file, to the instance, with `content_repository` the named address
test("library — restricted content goes only to the repository the person names, a licence unknown counting as restricted", async (t) => {
  slowDigest(t, 20);
  for (const licence of ["restricted — the publisher's terms", "unknown"]) {
    const b = browser(t);
    const page = await b.page();
    await register(page, "documents");
    await chooseFiles(page, SELECTED);
    let form = await describe(page, { id: "SRC-paid", title: "Paid norm", authority: "normative", licence });
    assert.equal(saveOf(form).disabled, true, `${licence}: no repository named`);
    assert.match(form.textContent, /repository/i);
    await put(one(page, "library-content-repository"), NAMED);
    form = one(page, "library-form-box");
    assert.match(one(page, "library-public").textContent, /alice\/restricted-content/);
    assert.equal(inputOf(form, "content_repository").value, NAMED);
    assert.equal(saveOf(form).disabled, false);
    assert.deepEqual([b.commits.length, b.posts.length], [0, 0]);
    await click(saveOf(form));
    await until(() => b.order.length === 2, "the content and then the entry committed");
    assert.deepEqual(b.order, ["named", "instance"], `${licence}: the content first, then the entry`);
    assert.deepEqual(instanceFiles(b).map((file) => file.path), ["docs/sources/SRC-paid.md"], "the public instance holds the entry only");
    assert.equal(entryOfCommit(b, "SRC-paid").fields.content_repository, NAMED);
    const tree = b.posts.find((post) => post.kind === "tree").body.tree.map((item) => item.path).sort();
    assert.deepEqual(tree, [`docs/sources/SRC-paid/${TODAY}/a.md`, `docs/sources/SRC-paid/${TODAY}/b.md`]);
  }
});

// TST-472755 · level: unit · module: MOD-settings-pages
// guards: A STANDARD IS REGISTERED BY ITS DESIGNATION; RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE; UC-004
// given: the standard route, a printed copy's file selected and only hashed, with the note `cabinet 3, shelf B` where the copy is kept; a licence preset restricted; the file explained
// input: Save
// expect: the file's SHA-256 shown and the statement that nothing of it is stored; one commit holding the entry alone — no file anywhere — whose version records the file with its hash and the note `not stored:`; no named repository is asked
test("library — a file that is only hashed is stored nowhere, and the note records it", async (t) => {
  slowDigest(t, 20);
  const b = browser(t);
  const page = await b.page();
  await register(page, "standard");
  await put(one(page, "library-standard-designation"), "ISO 26262:2018");
  await chooseFiles(page, [fileOf("iso-26262.pdf", "the publisher's bytes")]);
  assert.ok(folded(one(page, "library-route-standard")).some((node) => /SHA-256/.test(node.textContent)), "the hash-only choice is explained, folded");
  await tickHashed(page);
  await put(one(page, "library-file-kept-at"), "cabinet 3, shelf B");
  const form = await describe(page, { id: "SRC-iso-26262", title: "ISO 26262", authority: "normative" });
  assert.equal(inputOf(form, "licence").value, "restricted");
  assert.match(one(page, "library-public").textContent, /nothing of iso-26262\.pdf is stored/i);
  await click(saveOf(form));
  await until(() => b.commits.length === 1, "the commit");
  assert.deepEqual(instanceFiles(b).map((file) => file.path), ["docs/sources/SRC-iso-26262.md"]);
  const written = instanceFiles(b)[0].text;
  assert.match(written, /not stored: iso-26262\.pdf/);
  assert.ok(written.includes(sha(bytesOf("the publisher's bytes"))));
  assert.equal(entryOfCommit(b, "SRC-iso-26262").fields.designation, "ISO 26262:2018");
  assert.equal(entryOfCommit(b, "SRC-iso-26262").sections.find((section) => section.heading === "## Versions").rows[0].cells.Version, "`ISO 26262:2018`", "the designation is the version");
  assert.deepEqual(b.posts, []);
});

// TST-576007 · level: unit · module: MOD-settings-pages
// guards: A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE; UC-004
// given: the standard route, a printed copy's file iso-26262.pdf selected, the form filled in; the reading taken: the refusal of a file without a note is MOD-source-register's NoteMissing, not a check of the page, so Save is not disabled by the page
// input: the file listed, then "Only hash it" ticked, then Save with no note, then the note `cabinet 3, shelf B` typed and Save once more
// expect: before the tick the field for the note is hidden, after it shown; the first Save commits nothing to the instance, asks no named repository, and its result names iso-26262.pdf and does not say the source is registered; the second Save makes one commit holding the entry alone, whose file table under `### Files of ISO 26262:2018` is `| File | SHA-256 | Kept at |`, `|---|---|---|` and the row `| `iso-26262.pdf` | `<SHA-256>` | cabinet 3, shelf B |`
test("library — a file that is only hashed asks where its copy is kept, and without the note it is refused by name", async (t) => {
  slowDigest(t, 20);
  const b = browser(t);
  const page = await b.page();
  await register(page, "standard");
  await put(one(page, "library-standard-designation"), "ISO 26262:2018");
  await chooseFiles(page, [fileOf("iso-26262.pdf", "the publisher's bytes")]);
  assert.equal(one(page, "library-file-kept-at-label").hidden, true, "the question is asked of a file only hashed");
  await tickHashed(page);
  assert.equal(one(page, "library-file-kept-at-label").hidden, false);
  const form = await describe(page, { id: "SRC-iso-26262", title: "ISO 26262", authority: "normative" });
  assert.equal(saveOf(form).disabled, false, "the page adds no check of its own");
  await click(saveOf(form));
  await until(() => byClass(page, "library-result").some((node) => node.textContent.includes("iso-26262.pdf")), "the refusal naming the file");
  assert.deepEqual(b.commits, [], "nothing is committed without the note");
  assert.deepEqual(b.posts, []);
  assert.equal(one(page, "library-result").textContent.includes("iso-26262.pdf"), true, "the refusal names the file");
  assert.equal(one(page, "library-result").textContent.includes("is registered"), false);
  await put(one(page, "library-file-kept-at"), "cabinet 3, shelf B");
  await click(saveOf(one(page, "library-form-box")));
  await until(() => b.commits.length === 1, "the commit");
  assert.equal(b.commits.length, 1);
  assert.deepEqual(instanceFiles(b).map((file) => file.path), ["docs/sources/SRC-iso-26262.md"]);
  const table = ["### Files of ISO 26262:2018", "", "| File | SHA-256 | Kept at |", "|---|---|---|",
    `| \`iso-26262.pdf\` | \`${sha(bytesOf("the publisher's bytes"))}\` | cabinet 3, shelf B |`].join("\n");
  assert.equal(instanceFiles(b)[0].text.includes(table), true, "the note stands beside its file");
  assert.deepEqual(b.posts, []);
});

// TST-576008 · level: unit · module: MOD-settings-pages
// guards: A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; UC-004
// given: the documents route, two files a.md and b.md, a licence that may be republished; the first only hashed with the note `cabinet 3, shelf B`, the second kept
// input: the form filled in, Save
// expect: the instance gets the entry and b.md, not a.md; the file table has the row of a.md ending `| cabinet 3, shelf B |` and the row of b.md ending `| — |`; the field for the note of the second file is hidden
test("library — each file only hashed has its own note, and a file kept has a dash", async (t) => {
  slowDigest(t, 20);
  const b = browser(t);
  const page = await b.page();
  await register(page, "documents");
  await chooseFiles(page, SELECTED);
  const [firstTick] = byClass(page, "library-file-only-hashed");
  firstTick.checked = true;
  await fire(firstTick, "change");
  const [firstNote, secondNote] = byClass(page, "library-file-kept-at-label");
  assert.deepEqual([firstNote.hidden, secondNote.hidden], [false, true]);
  await put(byClass(page, "library-file-kept-at")[0], "cabinet 3, shelf B");
  const form = await describe(page, { id: "SRC-handbook", title: "Handbook", authority: "advisory", licence: "may be republished — CC BY 4.0" });
  await click(saveOf(form));
  await until(() => b.commits.length === 1, "the commit");
  assert.deepEqual(instanceFiles(b).map((file) => file.path).sort(), ["docs/sources/SRC-handbook.md", `docs/sources/SRC-handbook/${TODAY}/b.md`]);
  const text = instanceFiles(b).find((file) => file.path === "docs/sources/SRC-handbook.md").text;
  assert.equal(text.includes(`| \`a.md\` | \`${sha(bytesOf("# A\n"))}\` | cabinet 3, shelf B |`), true);
  assert.equal(text.includes(`| \`b.md\` | \`${sha(bytesOf("# B\n"))}\` | — |`), true);
});

// TST-472756 · level: unit · module: MOD-settings-pages
// guards: RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE; UC-004
// given: restricted files and a named repository that the token cannot reach (forbidden), and one that is not found
// input: Save
// expect: the repository named in the message, that the token cannot reach it, and the server's page to extend the token as a link; nothing is committed to the instance, so the entry never names content that was not stored; the form stays as it was
test("library — a named repository the token cannot reach is named, with how to extend the token, and nothing is committed", async (t) => {
  slowDigest(t, 20);
  for (const named of ["forbidden", "missing"]) {
    const b = browser(t, { named });
    const page = await b.page();
    await register(page, "documents");
    await chooseFiles(page, SELECTED);
    await describe(page, { id: "SRC-paid", title: "Paid norm", authority: "normative", licence: "restricted — terms", content_repository: NAMED });
    await click(saveOf(one(page, "library-form-box")));
    await until(() => byClass(page, "library-result").some((node) => /alice\/restricted-content/.test(node.textContent)), `${named}: the message naming the repository`);
    const result = one(page, "library-result");
    assert.match(result.textContent, /alice\/restricted-content/, named);
    assert.match(result.textContent, /token/i);
    const link = descendants(result, (node) => node.localName === "a")[0];
    assert.ok(link && /^https:\/\/github\.com\//.test(link.getAttribute("href")), "the server's page to extend the token");
    assert.deepEqual(b.commits, [], "the entry is not committed");
    assert.ok(saveOf(one(page, "library-form-box")), "the form stays");
  }
});

// TST-472757 · level: unit · module: MOD-settings-pages
// guards: THE INSTANCE KEEPS THE SOURCE REGISTER; UC-004
// given: a register that holds EU AI Act (SRC-eu-ai-act) and IEC 62304 with its designation; a registration of the same title, of the same identifier, and of the standard's designation
// input: the form filled in
// expect: each named as already in the library with its identifier, Save disabled, and a button that leads to its entry; a name that no entry has is not
test("library — a source already in the library is named, with its entry linked", async (t) => {
  const b = browser(t);
  const page = await b.page();
  await register(page, "documents");
  await chooseFiles(page, SELECTED);
  let form = await describe(page, { id: "SRC-new", title: "Some other source", authority: "advisory", licence: "may be republished — CC BY 4.0" });
  assert.equal(saveOf(form).disabled, false, "known positive: a new name");
  assert.equal(byClass(page, "library-already").length, 0);
  form = await describe(page, { title: "EU AI Act" });
  assert.match(form.textContent, /already in the library/i);
  assert.match(form.textContent, /SRC-eu-ai-act/);
  assert.equal(saveOf(form).disabled, true);
  await click(one(page, "library-already"));
  assert.deepEqual(b.went.at(-1), ["library", { source: "SRC-eu-ai-act" }]);
  form = await describe(page, { title: "Another", id: "SRC-iec-62304" });
  assert.match(form.textContent, /SRC-iec-62304/);
  await register(page, "standard");
  await put(one(page, "library-standard-designation"), "IEC 62304:2006+AMD1:2015");
  form = await describe(page, { id: "SRC-iec", title: "A norm", authority: "normative" });
  assert.match(form.textContent, /already in the library/i);
  assert.equal(saveOf(form).disabled, true);
  assert.deepEqual(b.commits, []);
});

// TST-472758 · level: unit · module: MOD-settings-pages
// guards: THE INSTANCE KEEPS THE SOURCE REGISTER; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; UC-004
// given: a register with a source whose one file is stored and one whose copy was only hashed
// input: the source's name clicked in the list; the entry's route
// expect: the click goes to library with the source; the entry shows its fields, its versions with their files, the stored file as stored and the file only hashed as not stored
test("library — a registered source's name leads to its entry, which shows each file as stored or not", async (t) => {
  const b = browser(t);
  const page = await b.page();
  await click(byClass(page, "library-source-name")[1]);
  assert.deepEqual(b.went.at(-1), ["library", { source: "SRC-iec-62304" }]);
  const stored = await b.page({ source: "SRC-eu-ai-act" });
  assert.match(one(stored, "library-entry").textContent, /EU AI Act/);
  assert.match(one(stored, "library-entry").textContent, /act\.html — stored/);
  assert.doesNotMatch(one(stored, "library-entry").textContent, /not stored/);
  const hashed = await b.page({ source: "SRC-iec-62304" });
  assert.match(one(hashed, "library-entry").textContent, /IEC 62304:2006\+AMD1:2015/);
  assert.match(one(hashed, "library-entry").textContent, /iec-62304\.pdf — not stored/);
  await click(one(hashed, "library-back"));
  assert.deepEqual(b.went.at(-1), ["library", {}]);
});

// TST-1361001 · level: unit · module: MOD-settings-pages
// guards: A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH; UC-004
// given: the register of this file: EU AI Act's version 2026-10-01 of 2026-10-01 records act.html with the SHA-256 aaaa…a (64 × a), stored; IEC 62304's version IEC 62304:2006+AMD1:2015 of 2026-10-02 records iec-62304.pdf with the SHA-256 bbbb…b (64 × b), only hashed
// input: the routes library/source=SRC-eu-ai-act and library/source=SRC-iec-62304
// expect: each entry lists its one version with its identifier and its date, and under it each file read with its name and the SHA-256 the entry records: act.html with 64 × a, iec-62304.pdf with 64 × b, the file not stored as well; counter-proof: neither entry shows the other's SHA-256
test("library — a source's entry lists each version with its identifier, its date and the SHA-256 of every file read", async (t) => {
  const b = browser(t);
  const [A, B] = ["a".repeat(64), "b".repeat(64)];
  const stored = await b.page({ source: "SRC-eu-ai-act" });
  const [act] = byClass(stored, "library-version");
  assert.match(act.textContent, /^2026-10-01 · 2026-10-01/);
  assert.match(act.textContent, new RegExp(`act\\.html[^\\n]*${A}`), "act.html with its SHA-256");
  assert.doesNotMatch(one(stored, "library-entry").textContent, new RegExp(B), "counter-proof: not the other entry's SHA-256");
  const hashed = await b.page({ source: "SRC-iec-62304" });
  const [norm] = byClass(hashed, "library-version");
  assert.match(norm.textContent, /^IEC 62304:2006\+AMD1:2015 · 2026-10-02/);
  assert.match(norm.textContent, new RegExp(`iec-62304\\.pdf[^\\n]*${B}`), "the file only hashed with its SHA-256");
  assert.doesNotMatch(one(hashed, "library-entry").textContent, new RegExp(A), "counter-proof: not the other entry's SHA-256");
});

// TST-472759 · level: unit · module: MOD-settings-pages
// guards: A LIVING SOURCE IS PINNED; THE INSTANCE KEEPS THE SOURCE REGISTER; UC-004
// given: the EU legal text route with the AI Act's address; the repository route with a repository pinned to its commit
// input: Save for each
// expect: the legal text as its entry alone, its identifier the CELEX number and no version row — the fetch is not part of this —; the repository's entry with a version naming the address and the commit it was pinned to, no file stored
test("library — an EU legal text is registered as its entry alone, a repository as its pinned commit", async (t) => {
  slowDigest(t, 20);
  const b = browser(t);
  const page = await b.page();
  await register(page, "legal-text");
  await put(one(page, "library-legal-address"), "https://eur-lex.europa.eu/eli/reg/2024/1689/oj");
  await describe(page, { id: "SRC-ai-act-2", title: "AI Act, again", authority: "normative", licence: "may be republished — EU law" });
  assert.equal(inputOf(one(page, "library-form-box"), "identifier").value.length > 0, true);
  await click(saveOf(one(page, "library-form-box")));
  await until(() => b.commits.length === 1, "the commit");
  assert.deepEqual(instanceFiles(b).map((file) => file.path), ["docs/sources/SRC-ai-act-2.md"]);
  const entry = entryOfCommit(b, "SRC-ai-act-2");
  assert.equal(entry.sections.find((section) => section.heading === "## Versions").rows?.length ?? 0, 0);

  const c = browser(t);
  writeSetting(c.store, "github-token:alice/restricted-content", { value: "github_pat_named", name: "named", expires: "2027-01-01" });
  const second = await c.page();
  await register(second, "repository");
  await put(one(second, "library-repository-address"), NAMED);
  await describe(second, { id: "SRC-guidelines", title: "Guidelines", authority: "advisory", licence: "may be republished — MIT" });
  await click(saveOf(one(second, "library-form-box")));
  await until(() => c.commits.length === 1, "the commit");
  assert.deepEqual(instanceFiles(c).map((file) => file.path), ["docs/sources/SRC-guidelines.md"]);
  const written = instanceFiles(c)[0].text;
  assert.ok(written.includes(NAMED) && written.includes("a".repeat(40)), "the address and the commit are the version's");
  assert.equal(entryOfCommit(c, "SRC-guidelines").fields.kind, "system");
});

// TST-402001 · level: unit · module: MOD-settings-pages
// guards: AN EU LEGAL TEXT IS FETCHED FROM THE OFFICIAL REPOSITORY; PROGRESS AND JOB STATE ARE DERIVED, NOT STORED; ONE CLICK PER DECISION; UC-004
// given: the library holds three EU legal-text entries: one whose identifier is an EUR-Lex address and has no version rows, one fetched with a version row, and one waiting whose latest onSourcesCommitted run failed naming that source
// input: the route `library`, then the waiting source's Fetch again button
// expect: the first source is shown as waiting with Fetch again; the fetched source is shown fetched from its entry; the failed source shows the failure from the run log; Fetch again starts `fetch-sources.yml` once on the default branch with the input source = that entry, and commits nothing from the page itself
test("library — legal text fetch state is derived from the entry and workflow runs, and Fetch again starts the workflow", async (t) => {
  const waiting = entryText({ id: "SRC-ai-waiting", title: "AI Act waiting", kind: "regulation", authority: "normative",
    licence: "may be republished - EU law", identifier: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689" });
  const fetched = entryText({ id: "SRC-ai-fetched", title: "AI Act fetched", kind: "regulation", authority: "normative",
    licence: "may be republished - EU law", identifier: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689" },
  `| \`cellar-2024-07-12\` | 2024-07-16 | - | publication repository, retrieved 2024-07-16, version cellar-2024-07-12 | 1 file, listed below; version hash \`${"c".repeat(64)}\` |\n\n### Files of cellar-2024-07-12\n\n| File | SHA-256 |\n|---|---|\n| \`32024R1689.xhtml\` | \`${"d".repeat(64)}\` |`);
  const failed = entryText({ id: "SRC-ai-failed", title: "AI Act failed", kind: "regulation", authority: "normative",
    licence: "may be republished - EU law", identifier: "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689" });
  const b = browser(t, { sources: { "docs/sources/SRC-ai-waiting.md": waiting, "docs/sources/SRC-ai-fetched.md": fetched,
    "docs/sources/SRC-ai-failed.md": failed }, runs: [{ id: "failed-run", workflow: "fetch-sources.yml", branch: "main", commit: "h".repeat(40),
    event: "push", state: "failure", url: "https://github.com/alice/agent-m/actions/runs/failed-run", started: "2026-10-14T10:00:00Z", ended: "2026-10-14T10:01:00Z" }],
  logs: { "failed-run": "onSourcesCommitted: failed - SRC-ai-failed: Unreachable: publication offline" } });
  const page = await b.page();
  const row = (name) => byClass(page, "library-source").find((node) => node.textContent.includes(name));
  assert.match(row("AI Act waiting").textContent, /waiting for fetch/i);
  assert.match(row("AI Act fetched").textContent, /fetched/i);
  assert.match(row("AI Act failed").textContent, /publication offline/);
  await click(descendants(row("AI Act waiting"), (node) => (node.className ?? "").split(" ").includes("library-fetch-again"))[0]);
  assert.deepEqual(b.started, [{ workflow: "fetch-sources.yml", ref: "main", inputs: { source: "SRC-ai-waiting" } }]);
  assert.deepEqual(b.commits, [], "the page does not write fetch state");
});

// TST-472760 · level: unit · module: MOD-settings-pages
// guards: ONE CLICK PER DECISION; RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE; UC-004
// given: the documents route, a licence that may be republished, then restricted with a named repository, then only hashed
// input: the licence and the choices changed
// expect: the statement before Save follows: the entry always public; the files public in the instance; the files only in the named repository; nothing stored for a file only hashed
test("library — what becomes public is stated before Save and follows the licence and the choices", async (t) => {
  const b = browser(t);
  const page = await b.page();
  await register(page, "documents");
  await chooseFiles(page, [fileOf("a.md", "# A\n")]);
  const form = await describe(page, { id: "SRC-x", title: "X", authority: "advisory", licence: "may be republished — CC BY 4.0" });
  const statement = () => one(page, "library-public").textContent;
  assert.match(statement(), /register entry.*public/i);
  assert.match(statement(), /a\.md.*public.*instance|instance.*a\.md/is);
  await typeInto(form, "licence", "restricted — terms");
  assert.doesNotMatch(statement(), /a\.md.*public.*instance/is);
  await put(one(page, "library-content-repository"), NAMED);
  assert.match(statement(), /alice\/restricted-content/);
  await tickHashed(page);
  assert.match(statement(), /nothing of a\.md is stored/i);
});

// TST-1362001 · level: unit · module: MOD-settings-pages
// guards: RESTRICTED CONTENT STAYS OUT OF THE PUBLIC INSTANCE; UC-004
// given: the EU legal text route with the AI Act's address and a licence that may be republished, then the same with a restricted licence; the documents route with a.md and a licence that may be republished as the counter-proof
// input: the form filled in, before Save
// expect: the legal text's statement reads "Becomes public: the register entry, always, in the instance repository alice/agent-m. Content, public in the instance repository: the official text the fetch workflow downloads from the EU's publication repository after Save."; with the restricted licence it names the register entry and says the fetch stores no text in the public instance; the documents route still reads "Becomes public: the register entry, always, in the instance repository alice/agent-m. Content, public in the instance repository: a.md."
test("library — before an EU legal text is saved, the statement names the official text the fetch stores in the public instance", async (t) => {
  const b = browser(t);
  const page = await b.page();
  await register(page, "legal-text");
  await put(one(page, "library-legal-address"), "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689");
  const form = await describe(page, { id: "SRC-ai-act-3", title: "AI Act, third", authority: "normative", licence: "may be republished — EU law" });
  const statement = () => one(page, "library-public").textContent;
  assert.equal(statement(), "Becomes public: the register entry, always, in the instance repository alice/agent-m. Content, public in the instance repository: the official text the fetch workflow downloads from the EU's publication repository after Save.");
  await typeInto(form, "licence", "restricted — terms");
  assert.match(statement(), /^Becomes public: the register entry, always, in the instance repository alice\/agent-m\./);
  assert.match(statement(), /official text/);
  assert.doesNotMatch(statement(), /Content, public in the instance repository/, "a restricted text is not stated as public");

  const c = browser(t);
  const other = await c.page();
  await register(other, "documents");
  await chooseFiles(other, [fileOf("a.md", "# A\n")]);
  await describe(other, { id: "SRC-x", title: "X", authority: "advisory", licence: "may be republished — CC BY 4.0" });
  assert.equal(one(other, "library-public").textContent, "Becomes public: the register entry, always, in the instance repository alice/agent-m. Content, public in the instance repository: a.md.", "counter-proof: the documents route's statement is unchanged");
});

// The line after an entry's front matter, where its title line stands.
const titleLineOf = (text) => text.split("\n")[text.split("\n").indexOf("---", 1) + 1];

// TST-1363001 · level: unit · module: MOD-settings-pages
// guards: EVERY ARTIFACT HAS AN IDENTIFIER; UC-004
// given: the register of this file, whose entry SRC-eu-ai-act has the title line `# SRC-eu-ai-act EU AI Act` of the source schema (known positive of the reading); a registration by each route — an EU legal text, a standard with a file only hashed, documents, a repository —, the form's id and title typed after the route's own part; and documents whose title is typed, then the files chosen, which builds the form again, then the title typed anew
// input: Save for each
// expect: the entry committed to the instance has, on the line after its front matter, `# SRC-ai-act-2 AI Act, again`, `# SRC-iso-26262 ISO 26262`, `# SRC-handbook Handbook`, `# SRC-guidelines Guidelines`, and read with the entry's schema the title `<id> <title>`; the title typed anew gives `# SRC-renamed Renamed handbook`, and the title typed before, `Handbook, first title`, stands nowhere in that entry; counter-proof: an entry written with the bare line `#` fails this test
test("library — the entry the page writes has the title line `# <id> <title>` of the source schema, on every route", async (t) => {
  slowDigest(t, 20);
  const known = SOURCES["docs/sources/SRC-eu-ai-act.md"];
  assert.equal(titleLineOf(known), "# SRC-eu-ai-act EU AI Act", "known positive: the register's own entry");
  assert.equal(readDocument(sourceSchemas().entry, "docs/sources/SRC-eu-ai-act.md", known).title, "SRC-eu-ai-act EU AI Act", "known positive: read as its title");
  const written = (b, id) => instanceFiles(b).find((file) => file.path === `docs/sources/${id}.md`).text;
  const titled = (b, id, title) => {
    assert.equal(titleLineOf(written(b, id)), `# ${id} ${title}`, `${id}: the title line`);
    assert.equal(entryOfCommit(b, id).title, `${id} ${title}`, `${id}: read as its title`);
  };

  const legal = browser(t);
  let page = await legal.page();
  await register(page, "legal-text");
  await put(one(page, "library-legal-address"), "https://eur-lex.europa.eu/eli/reg/2024/1689/oj");
  await describe(page, { id: "SRC-ai-act-2", title: "AI Act, again", authority: "normative", licence: "may be republished — EU law" });
  await click(saveOf(one(page, "library-form-box")));
  await until(() => legal.commits.length === 1, "the legal text's commit");
  titled(legal, "SRC-ai-act-2", "AI Act, again");

  const standard = browser(t);
  page = await standard.page();
  await register(page, "standard");
  await put(one(page, "library-standard-designation"), "ISO 26262:2018");
  await chooseFiles(page, [fileOf("iso-26262.pdf", "the publisher's bytes")]);
  await tickHashed(page);
  await put(one(page, "library-file-kept-at"), "cabinet 3, shelf B");
  await describe(page, { id: "SRC-iso-26262", title: "ISO 26262", authority: "normative" });
  await click(saveOf(one(page, "library-form-box")));
  await until(() => standard.commits.length === 1, "the standard's commit");
  titled(standard, "SRC-iso-26262", "ISO 26262");

  const documents = browser(t);
  page = await documents.page();
  await register(page, "documents");
  await chooseFiles(page, SELECTED);
  await describe(page, { id: "SRC-handbook", title: "Handbook", authority: "advisory", licence: "may be republished — CC BY 4.0" });
  await click(saveOf(one(page, "library-form-box")));
  await until(() => documents.commits.length === 1, "the documents' commit");
  titled(documents, "SRC-handbook", "Handbook");

  const repository = browser(t);
  writeSetting(repository.store, "github-token:alice/restricted-content", { value: "github_pat_named", name: "named", expires: "2027-01-01" });
  page = await repository.page();
  await register(page, "repository");
  await put(one(page, "library-repository-address"), NAMED);
  await describe(page, { id: "SRC-guidelines", title: "Guidelines", authority: "advisory", licence: "may be republished — MIT" });
  await click(saveOf(one(page, "library-form-box")));
  await until(() => repository.commits.length === 1, "the repository's commit");
  titled(repository, "SRC-guidelines", "Guidelines");

  const renamed = browser(t);
  page = await renamed.page();
  await register(page, "documents");
  await describe(page, { id: "SRC-renamed", title: "Handbook, first title", authority: "advisory", licence: "may be republished — CC BY 4.0" });
  await chooseFiles(page, SELECTED);
  await describe(page, { title: "Renamed handbook" });
  await click(saveOf(one(page, "library-form-box")));
  await until(() => renamed.commits.length === 1, "the renamed documents' commit");
  titled(renamed, "SRC-renamed", "Renamed handbook");
  assert.equal(written(renamed, "SRC-renamed").includes("Handbook, first title"), false, "the title typed before stands nowhere in the entry");
});

// TST-472761 · level: unit · module: MOD-settings-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-004
// given: the routes' parts and the form
// input: the page
// expect: the folded explanations of the kinds, the name, the authority, the licence, the standard's designation, the file only hashed and what becomes public, each a closed details
test("library — each step's explanation is folded", async (t) => {
  const b = browser(t);
  const page = await b.page();
  await register(page, "standard");
  await chooseFiles(page, [fileOf("n.pdf", "x")]);
  const all = folded(page);
  for (const [name, snippet] of [["the kinds", /EU legal text/], ["the name", /recognise\s+in\s+a\s+list/], ["the authority", /Normative/], ["the licence", /treated as\s+restricted/], ["the designation", /cover page/],
    ["a file only hashed", /SHA-256/], ["what becomes public", /becomes\s+public/]]) {
    const found = all.find((node) => snippet.test(node.textContent));
    assert.ok(found, `the explanation of ${name}`);
    assert.equal(found.hasAttribute("open"), false, `${name}: folded`);
  }
});

// TST-472762 · level: unit · module: MOD-settings-pages
// guards: THE SOURCE MODEL IS GENERIC; THE SOURCE KIND IS ONE OF A CLOSED SET; A STANDARD IS REGISTERED BY ITS DESIGNATION; A LIVING SOURCE IS PINNED; UC-004
// given: the form filled in correctly for each route but for one thing: no file selected, an identifier that is no SRC- identifier, a kind outside the closed set, no designation for a standard, no EU legal text recognised, no repository pinned
// input: the form
// expect: Save disabled with the thing named beside the form, and enabled once it is put right
test("library — the schema's checks and the route's missing part keep Save disabled, and each is put right", async (t) => {
  const b = browser(t);
  const page = await b.page();
  const disabled = () => saveOf(one(page, "library-form-box")).disabled;
  const text = () => one(page, "library-form-box").textContent;
  await register(page, "documents");
  await describe(page, { id: "SRC-ok", title: "Ok", authority: "advisory", licence: "may be republished — CC BY 4.0" });
  assert.equal(disabled(), true);
  assert.match(text(), /no file is selected/);
  await chooseFiles(page, SELECTED);
  assert.equal(disabled(), false, "known positive: a file is selected");
  await describe(page, { id: "bad id" });
  assert.equal(disabled(), true);
  assert.match(text(), /the key id does not fit/);
  await describe(page, { id: "SRC-ok" });
  assert.equal(disabled(), false);
  await describe(page, { kind: "nonsense" });
  assert.equal(disabled(), true);
  assert.match(text(), /organisation, person, standard, regulation, document, system, measurement/);
  await describe(page, { kind: "document" });
  assert.equal(disabled(), false);

  await register(page, "standard");
  await describe(page, { id: "SRC-norm", title: "A norm", authority: "normative" });
  assert.equal(disabled(), true, "a standard without its designation");
  assert.match(text(), /designation/);
  await put(one(page, "library-standard-designation"), "IEC 61508:2010");
  assert.equal(disabled(), false);

  await register(page, "legal-text");
  await describe(page, { id: "SRC-law", title: "A law", authority: "normative", licence: "may be republished — EU law" });
  assert.equal(disabled(), true);
  assert.match(text(), /no EU legal text is recognised/);
  await put(one(page, "library-legal-address"), "https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32024R1689");
  assert.equal(disabled(), false);

  await register(page, "repository");
  await describe(page, { id: "SRC-repo", title: "A repository", authority: "advisory", licence: "may be republished — MIT" });
  assert.equal(disabled(), true);
  assert.match(text(), /not pinned/);
});

// TST-472763 · level: unit · module: MOD-settings-pages
// guards: THE SOURCE MODEL IS GENERIC; EVERY STEP EXPLAINS ITSELF; UC-004
// given: the entry's schema, which names its rule (ITM-458), and MOD-site-frame's schemaForm built over it by the test itself
// input: the page's form for each route
// expect: the page's form has the fields schemaForm builds for that schema — one for each key of the front matter, `places` among them, and one editor for each section the schema names —, in the same order; its findings are documentFindings' (the schema's rule shown with them); it has no Save of the page's own, schemaForm's alone; and the page's form is not a form the page builds inside library.mjs: the same text of fields as the test's own schemaForm
test("library — the form is MOD-site-frame's schemaForm over the entry's schema", async (t) => {
  const { entry } = sourceSchemas();
  const own = schemaForm(entry, null, { onSave: async () => {} });
  const keysOf = (form) => descendants(form, (node) => node.getAttribute?.("data-key") !== null && node.getAttribute?.("data-key") !== undefined).map((node) => node.getAttribute("data-key"));
  const sectionsOf = (form) => descendants(form, (node) => node.getAttribute?.("data-section") !== null && node.getAttribute?.("data-section") !== undefined).map((node) => node.getAttribute("data-section"));
  assert.deepEqual(keysOf(own), Object.keys(entry.frontMatter), "known positive: schemaForm builds one field for each key");
  assert.deepEqual(sectionsOf(own), entry.sections.map((section) => section.heading).filter(Boolean));
  const b = browser(t);
  const page = await b.page();
  for (const name of ["legal-text", "standard", "documents", "repository"]) {
    const box = await register(page, name);
    assert.deepEqual(keysOf(box), keysOf(own), `${name}: the fields of the schema`);
    assert.deepEqual(sectionsOf(box), sectionsOf(own), `${name}: the sections of the schema`);
    assert.equal(byClass(page, "library-save").length, 0, `${name}: no Save of the page's own`);
    assert.ok(box.textContent.includes("[THE INSTANCE KEEPS THE SOURCE REGISTER]"), `${name}: the findings are those of the schema, with its rule`);
  }
});
