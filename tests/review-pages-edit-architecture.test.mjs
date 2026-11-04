// MOD-review-pages' routes `decision/<id>/edit` and `module/<id>/edit` (ITM-728), as UC-023 step 1 (route Edit) and the accepted text of
// docs/architecture/MOD-review-pages.md state them: "the editor with live preview and the descriptor's marks ... every save only on the blob the file
// was opened on" — the marks of the kind's schema (MOD-documents) for the edited text and the findings across artifacts (MOD-trace-graph's graphFindings)
// of the stored graph of the commit opened, none of which blocks Save; Save through MOD-artifact-edits' saveFile; a changed identifier disables Save with the reason; a refused save keeps
// the edit beside the newer text; without a token GitHub's page opens for the file, no text in its address; the saved file is changed since acceptance.
// Run: node --test tests/review-pages-edit-architecture.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-023; EDITS ARE PREPARED ON THE DASHBOARD; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT; AN EDITED FILE KEEPS ITS IDENTIFIER; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// Level: unit
//
// The document is the small DOM of tests/review-pages-harness.mjs; the repository is a Host of the tests' own over one repository in memory, keeping to
// MOD-repository-hosts' interface, every call recorded. The real MOD-approvals, MOD-documents, MOD-trace-graph, MOD-artifact-edits and MOD-browser-store
// run as they are. Nothing reaches the network. Each test states its input and its expected result before it runs (given / input / expect).
// The counter-proofs are recorded in the pull request.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { emptyStorage } from "./review-pages-harness.mjs";
import { until } from "./review-pages-wait.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

// Every commit the fakes of this file make is its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page.
let commitsMade = 0;

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const routeOf = (name) => pages.view?.routes.find((candidate) => candidate.name === name);

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };

const RULE = "A LOAN HAS A DUE DATE";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`,
  "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");
const DIAGRAM = ["", "```mermaid", "flowchart LR", "    Desk --> Shelf", "```", ""];
const decision = (id, title, forced, sentence = "The desk and the shelf are two modules.") => text("---", `id: ${id}`, `title: ${title}`, "forced_by:",
  ...forced.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", "## Context", "", "Books are lent at a desk.", "", "## Decision", "", sentence,
  ...DIAGRAM, "## Alternatives", "", "One module.", "", "## Consequences", "", "Two folders.");
const module_ = (id, title, realises, sentence = "It lends a book.") => text("---", `id: ${id}`, `title: ${title}`, "folder: src/lending/", "realises:",
  ...realises.map((name) => `  - ${name}`), "follows:", "  - ARC-001", "uses:", "provides:", "  - lend", "---", `# ${id} ${title}`, "", "## Responsibility", "",
  sentence, ...DIAGRAM, "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "- `lend`", "", "## Files", "", "None.", "",
  "## Uses", "", "Nothing.");
const A = (n, slug) => `docs/architecture/ARC-00${n}-${slug}.md`;
const M = (slug) => `docs/architecture/MOD-${slug}.md`;
const ARC1 = decision("ARC-001", "Lending is a desk", [RULE]);
const ARC2 = decision("ARC-002", "Books are shelved", [RULE]);
const MOD_READER = module_("MOD-reader", "Reading a book", [RULE]);
const MOD_WRITER = module_("MOD-writer", "Lending a book", [RULE]);
const recordOf = (id, kind, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text(`kind: ${kind}`, `file: ${path}`, `blob: ${blobOf(body)}`)];
// ARC-001 and MOD-reader accepted; ARC-002 and MOD-writer open.
const STEPS = [
  { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [A(1, "lending")]: ARC1, [A(2, "shelves")]: ARC2, [M("reader")]: MOD_READER, [M("writer")]: MOD_WRITER },
  Object.fromEntries([recordOf("ARC-001", "architecture-decision", A(1, "lending"), ARC1), recordOf("MOD-reader", "module", M("reader"), MOD_READER)]),
];
// Per route: the accepted file, the open file, and the edit each test makes to it.
const CASES = [
  { route: "decision", accepted: ["ARC-001", A(1, "lending"), ARC1], open: ["ARC-002", A(2, "shelves"), ARC2], other: "ARC-099",
    sentence: ["two modules.", "two small modules."], graphEdit: (body) => body.replace("forced_by:\n", "forced_by:\n  - A NONEXISTENT RULE\n"),
    graphMark: /ARC-002:5: error: .*A NONEXISTENT RULE.*\[EVERY ARTIFACT NAMES ITS ORIGIN\]/ },
  { route: "module", accepted: ["MOD-reader", M("reader"), MOD_READER], open: ["MOD-writer", M("writer"), MOD_WRITER], other: "MOD-other",
    sentence: ["It lends a book.", "It lends a book to a member."], graphEdit: (body) => body.replace("uses:\n", "uses:\n  - MOD-reader.noSuchInterface\n"),
    graphMark: /MOD-writer:10: error: .*MOD-reader\.noSuchInterface.*\[DEVELOP AGAINST INTERFACES\]/ },
];

// ---------------------------------------------------------------- the fake host

function fakeHost({ refuse = null } = {}) {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made} of the file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree, parent, date: `2026-10-0${made}T10:00:00Z` });
    return sha;
  };
  for (const files of STEPS) head = commitOf(new Map([...(head ? commits.get(head).tree : []), ...Object.entries(files)]), head);
  const bareSnapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return { repository: ON_GITHUB, ref: sha, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  // Each snapshot serves the graph the push job stores for its commit (tests/stored-graph-fake.mjs); a page reads it and never builds one (MOD-trace-graph).
  const snapshotAt = (...args) => withStoredGraph(bareSnapshotAt(...args));
  return {
    head: () => head,
    writes: () => calls.filter((call) => call.fn === "commitFiles"),
    land(changed) { head = commitOf(new Map([...commits.get(head).tree, ...Object.entries(changed)]), head); },
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readFileAt(path, shas) {
        return new Map(shas.map((sha) => [sha, commits.get(sha)?.tree.get(path) ?? null]));
      },
      async readSnapshot(ref) {
        if (ref === "main") return { ...snapshotAt(head), ref };
        if (commits.has(ref)) return snapshotAt(ref);
        throw failure("NotFound", `${ref} was not found`, { what: ref });
      },
      async readHistory(path, { ref = "main", limit } = {}) {
        const found = [];
        for (let sha = ref === "main" ? head : ref; sha; sha = commits.get(sha).parent) {
          const here = commits.get(sha), before = here.parent ? commits.get(here.parent).tree.get(path) : undefined;
          if (here.tree.get(path) !== before) found.push({ commit: sha, parents: here.parent ? [here.parent] : [], date: here.date, message: "", author: { account: null, name: "x" }, changes: [] });
        }
        return limit ? found.slice(0, limit) : found;
      },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (refuse) throw refuse;
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((f) => [f.path, f.text])]), head);
        return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the page

async function show(fake, route, params = {}, { token = true } = {}) {
  assert.ok(routeOf(route), `the route ${route}: ${pages.error?.message}`);
  emptyStorage();
  const store = openStore("alice/agent-m");
  if (token) writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  await routeOf(route).render(target, { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {},
    product: { address: ON_GITHUB.web, kind: "github", host: fake.host } }, params);
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(new Event("click"));
const areaOf = (target) => find(target, (node) => node.localName === "textarea")[0];
const saveButton = (target) => find(target, (node) => node.localName === "button" && node.textContent === "Save")[0];
const badgeOf = (root) => byClass(root, "span", "badge")[0]?.textContent;
const marksOf = (target) => byClass(target, "ol", "marks")[0]?.textContent ?? "";
const type = (target, body) => {
  const area = areaOf(target);
  area.value = body;
  area.dispatchEvent(new Event("input"));
};

// ---------------------------------------------------------------- editing a decision or a module file

// TST-728001 · level: unit · module: MOD-review-pages
// guards: EDITS ARE PREPARED ON THE DASHBOARD; UC-023
// given: ARC-001 and MOD-reader, each accepted by a record, each opened in the editor on its edit route, with a token stored
// input: the text edited, then a click on Save
// expect: one commit on the head the editor opened, holding only that file with the edited text and no record; the file shown again from its page as changed since acceptance, not as accepted
test("MOD-review-pages decision/<id>/edit and module/<id>/edit — Save commits an accepted file in one commit, which is then shown as changed", async () => {
  for (const { route, accepted: [id, path, body], sentence: [from, to] } of CASES) {
    const fake = fakeHost();
    const read = fake.head();
    const target = await show(fake, route, { id, edit: "1" });
    assert.equal(areaOf(target).value, body, `${id}: the editor holds the file byte for byte`);
    const edited = body.replace(from, to);
    assert.notEqual(edited, body);
    type(target, edited);
    click(saveButton(target));
    await until(target, () => fake.writes().length === 1, `the commit of ${id}`);
    const [{ change }] = fake.writes();
    assert.equal(change.expectedHead, read, `${id}: on the head the editor opened`);
    assert.deepEqual(change.files, [{ path, text: edited }], `${id}: only the file, with the edited text, no record`);
    await until(target, () => areaOf(target) === undefined && target.textContent.includes(to), `${id} to be shown again`);
    assert.equal(badgeOf(target), "changed since acceptance", `${id}: its new text is accepted by no record, its old text was`);
  }
});

// TST-728002 · level: unit · module: MOD-review-pages
// guards: EDITS ARE PREPARED ON THE DASHBOARD; UC-023
// given: ARC-002 and MOD-writer, open, each opened in the editor; then each committed with a text that breaks a rule across artifacts (ARC-002 forced by a name no requirement has; MOD-writer using an interface MOD-reader does not provide), the graph stored for that commit, and opened in the editor again
// input: a change that breaks the kind's schema (the title emptied); for the committed broken file, the editor as it opens
// expect: on the file as it stands no mark names the unknown name or interface; after the schema change a mark at line 3 of the file and Save offered; on the committed broken file the stored graph's mark of the graph's check at its line, the rule named, Save offered. MOD-review-pages: "no page builds a graph, also not over an edited text: the editor shows the stored graph's findings of the file, and the edit is checked across artifacts once it is committed."
test("MOD-review-pages decision/<id>/edit and module/<id>/edit — the schema's marks and the graph's marks are shown, and Save is still offered", async () => {
  for (const { route, open: [id, path, body], graphEdit, graphMark } of CASES) {
    const target = await show(fakeHost(), route, { id, edit: "1" });
    assert.doesNotMatch(marksOf(target), graphMark, `${id}: known negative: the text as it stands has no such mark`);

    type(target, body.replace(/^title: .*$/m, "title:"));
    assert.match(marksOf(target), new RegExp(`${id}:3: error: the key title is required`), `${id}: the schema's mark`);
    assert.equal(saveButton(target).disabled, false, `${id}: Save offered with the schema's mark`);

    const broken = fakeHost();
    broken.land({ [path]: graphEdit(body) });
    const opened = await show(broken, route, { id, edit: "1" });
    await until(opened, () => graphMark.test(marksOf(opened)), `${id}: the stored graph's mark`);
    assert.equal(saveButton(opened).disabled, false, `${id}: Save offered with the graph's mark`);
  }
});

// TST-728003 · level: unit · module: MOD-review-pages
// guards: AN EDITED FILE KEEPS ITS IDENTIFIER
// given: ARC-002 and MOD-writer, each opened in the editor
// input: the front-matter id changed
// expect: Save disabled and the reason names the identifier it was opened with and the new one; nothing committed
test("MOD-review-pages decision/<id>/edit and module/<id>/edit — a changed id disables Save and names the reason", async () => {
  for (const { route, open: [id, , body], other } of CASES) {
    const fake = fakeHost();
    const target = await show(fake, route, { id, edit: "1" });
    type(target, body.replace(`id: ${id}`, `id: ${other}`));
    assert.equal(saveButton(target).disabled, true, `${id}: Save disabled`);
    assert.match(byClass(target, "p", "result")[0].textContent, new RegExp(`identifier changed from ${id} to ${other}`), `${id}: the reason`);
    click(saveButton(target));
    for (let turn = 0; turn < 20; turn++) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(fake.writes().length, 0, `${id}: nothing committed`);
  }
});

// TST-728004 · level: unit · module: MOD-review-pages
// guards: A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT
// given: ARC-002 and MOD-writer, each opened in the editor, then another writer changes the file on main
// input: the text edited, then a click on Save
// expect: no commit; the edit stays in the editor and the newer text is shown beside it
test("MOD-review-pages decision/<id>/edit and module/<id>/edit — a file changed meanwhile refuses Save and keeps the edit beside the newer text", async () => {
  for (const { route, open: [id, path, body], sentence: [from, to] } of CASES) {
    const fake = fakeHost();
    const target = await show(fake, route, { id, edit: "1" });
    const edited = body.replace(from, to);
    type(target, edited);
    const newer = body.replace(from, "Another writer's sentence.");
    fake.land({ [path]: newer });
    click(saveButton(target));
    await until(target, () => byClass(target, "div", "newer")[0]?.textContent.includes("Another writer's sentence."), `${id}: the newer text`);
    assert.equal(areaOf(target).value, edited, `${id}: the edit stays`);
    assert.equal(fake.writes().length, 0, `${id}: no commit`);
  }
});

// TST-728005 · level: unit · module: MOD-review-pages
// guards: WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK; NO TEXT TRAVELS IN A URL
// given: a GitHub product and no token; ARC-002 and MOD-writer, each opened in the editor
// input: the text edited, then a click on Save
// expect: nothing committed; the edited text on the clipboard; GitHub's edit page of the file opened and linked, its address holding the path and no query; the text shown for the clipboard
test("MOD-review-pages decision/<id>/edit and module/<id>/edit — without a token a link to GitHub's edit page, no text in the address", async () => {
  for (const { route, open: [id, path, body], sentence: [from, to] } of CASES) {
    const fake = fakeHost();
    const target = await show(fake, route, { id, edit: "1" }, { token: false });
    const edited = body.replace(from, to);
    type(target, edited);
    const asked = { clipboard: [], opened: [] };
    Object.defineProperty(globalThis, "navigator", { value: { clipboard: { writeText: async (written) => { asked.clipboard.push(written); } } }, configurable: true, writable: true });
    globalThis.open = (url) => { asked.opened.push(url); return null; };
    click(saveButton(target));
    await until(target, () => byClass(target, "a", "github-page").length === 1, `${id}: GitHub's page`);
    const link = new URL(byClass(target, "a", "github-page")[0].getAttribute("href"));
    assert.equal(link.origin + link.pathname, `https://github.com/alice/thesis-tool/edit/main/${path}`, `${id}: the page of the file`);
    assert.equal([...link.searchParams.keys()].length, 0, `${id}: no query in the address`);
    assert.deepEqual(asked.clipboard, [edited], `${id}: the edited text on the clipboard`);
    assert.deepEqual(asked.opened, [`https://github.com/alice/thesis-tool/edit/main/${path}`], `${id}: the page opened`);
    assert.equal(byClass(target, "pre", "clipboard-text")[0].textContent, edited, `${id}: the text shown for the clipboard`);
    assert.equal(fake.writes().length, 0, `${id}: nothing committed`);
  }
});
