// MOD-review-pages' route `arrange` (ITM-726), as UC-021 and the accepted text of docs/architecture/MOD-review-pages.md state it: "`arrange/<group kind>` — *Arrange* for requirements, use cases, decisions, modules or tests: the hierarchy with every
// item once, moves, new and renamed groups, the pending changes listed, … and *Save arrangement*, which commits the group file only" — through MOD-artifact-edits' `saveGroupFile` on the blob read when the route opened, MOD-group-document's
// `parseGroupFile`, `applyMoves`, `groupFileText` and `hierarchy`; on `changed meanwhile` the newer hierarchy with the pending changes applied where they still apply and the others named (5a); without a token on GitHub the file on the clipboard and
// GitHub's page through `fallbackEditLinks` (5c), on GitLab no save; the folded explanation `group-is-a-heading`; the lists of use cases, decisions and modules link *Arrange* to their kind.
// Run: node --test tests/review-pages-arrange.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-021; ARTIFACTS ARE ARRANGED IN NESTED GROUPS; A GROUP HOLDS ONE KIND OF ARTIFACT; AN ITEM HAS ONE PLACE IN ITS HIERARCHY; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL; A REGROUPING IS COMMITTED DIRECTLY; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF
// Level: unit
//
// The document is the small DOM of tests/review-pages-harness.mjs (it marks the events dispatched through a node as a person's); the repository is a Host of the tests' own over one repository in memory, keeping to MOD-repository-hosts' interface,
// every call recorded. The real MOD-group-document, MOD-artifact-edits, MOD-documents and MOD-browser-store run as they are. Nothing reaches the network. Each test states its input and its expected result before it runs. The counter-proofs are
// run as mutations and recorded in the pull request.
//
// Where the texts leave a reading open, the tests state the one they take, and the pull request names it:
//   - The address `arrange/<group kind>` is the route `arrange` with the parameter `kind` (`#arrange/kind=use-cases`): the frame reads the first part of a fragment as the route's name and the others as `key=value`. The group kinds are the file names
//     requirements, use-cases, architecture, modules and tests; the items of a kind are a requirement's name (the SPEC), a use case's, a decision's or a module's identifier (from the file names under docs/), a test's identifier (its declaration); they are the nodes of that kind in MOD-trace-graph's graph, so a decision and a module file carry their `id` in their front matter.
//   - The page: <section class="arrange"> with <ul class="arrange-tree"> of <li class="arrange-group" data-title> (holding its own members and groups) and <li class="arrange-item" data-id>; a mark is <span class="mark">: "not yet placed" (an item no group names,
//     shown at the top level), "unknown member" (a member that matches no item) and "named twice" (a member that stands in two places, on both). Each item and group has <select class="arrange-move"> (its options "Top level" and a group by its path of titles
//     joined with " › ") and <button class="arrange-move-to"> "Move to …"; each group <input class="arrange-rename"> with <button class="arrange-rename-go"> "Rename" and <button class="arrange-lift"> "Move content up one level"; the tree has
//     <input class="arrange-group-title">, <select class="arrange-group-in"> and <button class="arrange-new-group"> "+ Group". A drag of an item or a group onto a group, or onto the tree, is a move. <ol class="arrange-pending"> lists the pending
//     changes, each an <li class="arrange-pending-item">, <ul class="arrange-refused"> the moves refused with their reasons, each an <li class="arrange-refused-item">, <button class="arrange-save"> "Save arrangement", <p class="arrange-result"> what came of it and <a class="commit-link"> the commit.
//   - A new group is put at the top level or in the group the select names; moving an item puts it last in the target group.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { emptyStorage } from "./review-pages-harness.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

// Every commit the fakes of this file make is its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page.
let commitsMade = 0;

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs");
const routeOf = (name) => pages.view.routes.find((candidate) => candidate.name === name);

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const ON_GITLAB = { server: "gitlab", origin: "https://gitlab.example.org", path: "space/thesis-tool", web: "https://gitlab.example.org/space/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };

const useCase = (id, title) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Reader", "realises:", "  - A LOAN HAS A DUE DATE", "---", `# ${id} ${title}`, "", "**Goal.** A sample.");
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", "**A LOAN HAS A DUE DATE** *(Product Owner)*", "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`", "",
  "**A BOOK CAN BE RETURNED** *(Product Owner)*", "A returned book is back on the shelf.", "*Check:* no automatic check; at review");
const TEST_FILE = text("// TST-100001 · level: unit · module: MOD-lending", "// guards: A LOAN HAS A DUE DATE", "// given: a loan", "// input: a return", "// expect: a date", "test(\"a loan has a date\", () => {});");
const PRODUCT = {
  "README.md": "# Thesis tool\n", "SPEC.md": SPEC, "tests/loan.test.mjs": TEST_FILE,
  "docs/use-cases/UC-001-lend-a-book.md": useCase("UC-001", "Lend a book"), "docs/use-cases/UC-002-return-a-book.md": useCase("UC-002", "Return a book"),
  "docs/use-cases/UC-003-pay-a-fine.md": useCase("UC-003", "Pay a fine"), "docs/use-cases/UC-004-reserve-a-book.md": useCase("UC-004", "Reserve a book"),
  "docs/architecture/ARC-001-lending.md": text("---", "id: ARC-001", "title: Lending", "forced_by:", "  - A LOAN HAS A DUE DATE", "---", "# ARC-001 Lending"),
  "docs/architecture/MOD-lending.md": text("---", "id: MOD-lending", "title: Lending", "folder: src/lending/", "realises:", "  - A LOAN HAS A DUE DATE", "---", "# MOD-lending Lending"),
};
const GROUPS_PATH = "docs/groups/use-cases.md";
// The group file of the use cases: UC-001 and UC-002 under Review, UC-003 and UC-009 (which no use case matches) under Derivation; UC-004 stands in no group.
const GROUPS = text("# Use cases — groups", "", "The hierarchy of the use cases, each member by its identifier.", "", "- Review", "  - UC-001", "  - UC-002", "- Derivation", "  - UC-003", "  - UC-009");
const GROUPS_TWICE = GROUPS.replace("  - UC-002\n", "  - UC-002\n  - UC-001\n");

// ---------------------------------------------------------------- the fake host

function fakeHost({ files, server = ON_GITHUB, refuse = null }) {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made} of the file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree, parent });
    return sha;
  };
  head = commitOf(new Map(Object.entries(files)), null);
  const bareSnapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return { repository: server, ref: sha, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  // Each snapshot serves the graph the push job stores for its commit (tests/stored-graph-fake.mjs); a page reads it and never builds one (MOD-trace-graph).
  const snapshotAt = (...args) => withStoredGraph(bareSnapshotAt(...args));
  return {
    head: () => head,
    writes: () => calls.filter((call) => call.fn === "commitFiles"),
    files: () => Object.fromEntries(commits.get(head).tree),
    land(changed) { head = commitOf(new Map([...commits.get(head).tree, ...Object.entries(changed)]), head); },
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        if (ref === "main") return { ...snapshotAt(head), ref };
        if (commits.has(ref)) return snapshotAt(ref);
        throw failure("NotFound", `${ref} was not found`, { what: ref });
      },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (refuse) throw refuse;
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((f) => [f.path, f.text])]), head);
        return { commit: head, url: `${server.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the page

const copied = [], opened = [];
Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: { clipboard: { writeText: async (value) => { copied.push(value); } } } });
Object.defineProperty(globalThis, "open", { configurable: true, writable: true, value: (url) => { opened.push(url); } });

async function show(fake, params, { token = true, server = ON_GITHUB } = {}) {
  assert.ok(routeOf("arrange"), "the route arrange is part of the view");
  emptyStorage();
  const store = openStore("alice/agent-m");
  if (token) writeSetting(store, server === ON_GITHUB ? "github-token:alice/thesis-tool" : "gitlab-token:gitlab.example.org/space/thesis-tool", TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  await routeOf("arrange").render(target, { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {},
    product: { address: server.web, kind: server.server, host: fake.host } }, params);
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(new Event("click"));
async function until(condition, what) {
  for (let turn = 0; turn < 600; turn++) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`waited for ${what}`);
}
const itemOf = (target, id) => byClass(target, "li", "arrange-item").filter((node) => node.getAttribute("data-id") === id);
const groupOf = (target, title) => byClass(target, "li", "arrange-group").find((node) => node.getAttribute("data-title") === title);
const marksOf = (node) => byClass(node, "span", "mark").map((each) => each.textContent);
// A select's option by its label; choosing it sets the select's value.
function choose(select, label) {
  const option = find(select, (node) => node.localName === "option" && node.textContent === label)[0];
  assert.ok(option, `the select offers "${label}": ${find(select, (n) => n.localName === "option").map((n) => n.textContent).join(" | ")}`);
  select.value = option.value;
}
// "Move to …" of an item or a group: the target by its label.
function moveTo(node, label) {
  choose(byClass(node, "select", "arrange-move")[0], label);
  click(byClass(node, "button", "arrange-move-to")[0]);
}
const pending = (target) => byClass(target, "li", "arrange-pending-item").map((node) => node.textContent);
const refused = (target) => byClass(target, "li", "arrange-refused-item").map((node) => node.textContent);
const saveButton = (target) => byClass(target, "button", "arrange-save")[0];
const writtenGroupFile = (fake) => fake.writes()[0].change.files;

// TST-726001 · level: unit · module: MOD-review-pages
// guards: UC-021; AN ITEM HAS ONE PLACE IN ITS HIERARCHY; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL
// given: the product with four use cases and the group file above (UC-009 matches no use case; UC-004 stands in no group)
// input: the route arrange drawn for the kind use-cases
// expect: two groups, Review (UC-001, UC-002) and Derivation (UC-003, UC-009); UC-004 once, at the top level (not inside a group), marked "not yet placed"; UC-009 marked "unknown member"; no other mark; the folded explanation is drawn (a <details class="explain">)
test("TST-726001 the hierarchy of a kind with a group file: every item once, an ungrouped one marked not yet placed, an unknown member marked", async () => {
  const fake = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS } });
  const target = await show(fake, { kind: "use-cases" });
  const groups = byClass(target, "li", "arrange-group");
  assert.deepEqual(groups.map((node) => node.getAttribute("data-title")), ["Review", "Derivation"]);
  assert.deepEqual(byClass(groupOf(target, "Review"), "li", "arrange-item").map((node) => node.getAttribute("data-id")), ["UC-001", "UC-002"]);
  assert.deepEqual(byClass(groupOf(target, "Derivation"), "li", "arrange-item").map((node) => node.getAttribute("data-id")), ["UC-003", "UC-009"]);
  assert.equal(itemOf(target, "UC-004").length, 1);
  assert.deepEqual(marksOf(itemOf(target, "UC-004")[0]), ["not yet placed"]);
  assert.equal(groups.some((group) => itemOf(group, "UC-004").length > 0), false, "UC-004 is at the top level");
  assert.deepEqual(marksOf(itemOf(target, "UC-009")[0]), ["unknown member"]);
  assert.equal(byClass(target, "span", "mark").length, 2);
  assert.equal(byClass(target, "details", "explain").length >= 1, true, "the folded What is this?");
});

// TST-726002 · level: unit · module: MOD-review-pages
// guards: UC-021; AN ITEM HAS ONE PLACE IN ITS HIERARCHY
// given: a group file that names UC-001 under Review twice over — under Review and again under Review's second line (UC-001 stands in two places)
// input: the route arrange drawn
// expect: UC-001 is shown in both places, each marked "named twice"; no item is dropped
test("TST-726002 a member named twice is shown in both places, marked, until one is kept", async () => {
  const fake = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS_TWICE } });
  const target = await show(fake, { kind: "use-cases" });
  const both = itemOf(target, "UC-001");
  assert.equal(both.length, 2);
  for (const node of both) assert.deepEqual(marksOf(node), ["named twice"]);
  for (const id of ["UC-002", "UC-003", "UC-004"]) assert.equal(itemOf(target, id).length, 1, id);
});

// TST-726003 · level: unit · module: MOD-review-pages
// guards: UC-021; A REGROUPING IS COMMITTED DIRECTLY; AN UNGROUPED ITEM IS SHOWN AT THE TOP LEVEL
// given: the product with no group file; the person adds the group "Review" and moves UC-001 into it
// input: the route arrange drawn; "+ Group" with the title Review; "Move to …" of UC-001 to Review; Save arrangement
// expect: all four use cases at the top level, each marked "not yet placed", before the changes; then one commit on the head that was read, holding docs/groups/use-cases.md and no other file, with the canonical text of the file with the group Review holding UC-001; the commit as a link; the new hierarchy shows UC-001 in Review and no longer marked
test("TST-726003 without a group file the first save creates it, and only it", async () => {
  const fake = fakeHost({ files: PRODUCT });
  const read = fake.head();
  const target = await show(fake, { kind: "use-cases" });
  assert.equal(byClass(target, "span", "mark").length, 4);
  byClass(target, "input", "arrange-group-title")[0].value = "Review";
  click(byClass(target, "button", "arrange-new-group")[0]);
  moveTo(itemOf(target, "UC-001")[0], "Review");
  click(saveButton(target));
  await until(() => fake.writes().length === 1, "the save");
  const { change } = fake.writes()[0];
  assert.equal(change.expectedHead, read);
  assert.deepEqual(change.files.map((file) => file.path), [GROUPS_PATH]);
  assert.equal(change.files[0].text, text("# Use cases — groups", "", "The hierarchy of the use cases, each member by its identifier.", "", "- Review", "  - UC-001"));
  await until(() => byClass(target, "a", "commit-link").length === 1, "the commit link");
  assert.equal(byClass(target, "a", "commit-link")[0].getAttribute("href").endsWith(`/commit/${fake.head()}`), true);
  assert.deepEqual(byClass(groupOf(target, "Review"), "li", "arrange-item").map((node) => node.getAttribute("data-id")), ["UC-001"]);
  assert.deepEqual(marksOf(itemOf(target, "UC-001")[0]), []);
});

// TST-726004 · level: unit · module: MOD-review-pages
// guards: UC-021; A GROUP HOLDS ONE KIND OF ARTIFACT
// given: the product with the group file above
// input: Move to … of UC-004 to Derivation; Move to … of the group Derivation to Review; a drag of UC-002 onto the group Derivation's place at the top level; Rename of Review to Chapters; Move content up one level of Chapters; + Group with the title UC-005 (an identifier)
// expect: each accepted move is a line of the pending changes, in order, and the tree shows it at once; the group titled by an identifier is refused with its reason, listed beside the tree, and is not a pending change; nothing is written
test("TST-726004 each kind of move shows at once and is a pending change, a refused one shows its reason, and nothing is written", async () => {
  const fake = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS } });
  const target = await show(fake, { kind: "use-cases" });
  moveTo(itemOf(target, "UC-004")[0], "Derivation");
  assert.deepEqual(byClass(groupOf(target, "Derivation"), "li", "arrange-item").map((node) => node.getAttribute("data-id")), ["UC-003", "UC-009", "UC-004"]);
  moveTo(groupOf(target, "Derivation"), "Review");
  assert.equal(byClass(groupOf(target, "Review"), "li", "arrange-group").length, 1, "Derivation is now inside Review");
  // a drag of UC-002 to the top level of the tree
  const tree = byClass(target, "ul", "arrange-tree")[0];
  const data = new Map();
  const transfer = { setData: (type, value) => data.set(type, value), getData: (type) => data.get(type) ?? "", effectAllowed: "", dropEffect: "" };
  itemOf(target, "UC-002")[0].dispatchEvent(Object.assign(new Event("dragstart"), { dataTransfer: transfer }));
  tree.dispatchEvent(Object.assign(new Event("drop"), { dataTransfer: transfer }));
  const stands = (node) => { for (let at = node.parentNode; at; at = at.parentNode) if (at.localName === "li" && at.className.split(" ").includes("arrange-group")) return true; return false; };
  assert.equal(stands(itemOf(target, "UC-002")[0]), false, "UC-002 is at the top level");
  const input = byClass(groupOf(target, "Review"), "input", "arrange-rename")[0];
  input.value = "Chapters";
  click(byClass(groupOf(target, "Review"), "button", "arrange-rename-go")[0]);
  assert.ok(groupOf(target, "Chapters"));
  click(byClass(groupOf(target, "Chapters"), "button", "arrange-lift")[0]);
  assert.deepEqual(byClass(groupOf(target, "Chapters"), "li", "arrange-item").map((node) => node.getAttribute("data-id")), [], "lifting a group moves its content up and leaves the group empty");
  assert.equal(stands(itemOf(target, "UC-001")[0]), false, "UC-001 is at the top level");
  assert.equal(pending(target).length, 5);
  byClass(target, "input", "arrange-group-title")[0].value = "UC-005";
  click(byClass(target, "button", "arrange-new-group")[0]);
  assert.equal(refused(target).length, 1);
  assert.equal(/UC-005|identifier/.test(refused(target)[0]), true, refused(target)[0]);
  assert.equal(pending(target).length, 5, "the refused move is no pending change");
  assert.deepEqual(fake.writes(), []);
});

// TST-726005 · level: unit · module: MOD-review-pages
// guards: UC-021; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE; A REFUSED SAVE KEEPS THE EDIT
// given: the product with the group file above; the person moved UC-004 into Review and added the group "Later"; then another writer's commit renames the group Review to Chapters
// input: Save arrangement
// expect: nothing is written; the page shows the newer hierarchy (the group Chapters, not Review) with the pending change "add the group Later" still applied, and the move of UC-004 into Review named as no longer applying; the next Save is on the newer blob
test("TST-726005 a changed group file writes nothing and shows the newer hierarchy with the pending changes that still apply, naming the others", async () => {
  const fake = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS } });
  const target = await show(fake, { kind: "use-cases" });
  moveTo(itemOf(target, "UC-004")[0], "Review");
  byClass(target, "input", "arrange-group-title")[0].value = "Later";
  click(byClass(target, "button", "arrange-new-group")[0]);
  fake.land({ [GROUPS_PATH]: GROUPS.replace("- Review", "- Chapters") });
  const newer = fake.head();
  click(saveButton(target));
  await until(() => byClass(target, "p", "arrange-result").some((node) => /changed/.test(node.textContent)), "the refusal");
  assert.deepEqual(fake.writes(), [], "the save is refused before anything is committed");
  assert.ok(groupOf(target, "Chapters"), "the newer hierarchy is shown");
  assert.equal(groupOf(target, "Review"), undefined);
  assert.ok(groupOf(target, "Later"), "the pending group still applies");
  assert.deepEqual(pending(target).map((line) => /Later/.test(line)), [true], "only the change that still applies stays pending");
  assert.equal(refused(target).some((line) => /UC-004/.test(line) && /Review/.test(line)), true, refused(target).join(" | "));
  click(saveButton(target));
  await until(() => fake.writes().length === 1, "the next save");
  assert.equal(fake.writes()[0].change.expectedHead, newer, "on the newer head");
  assert.equal(fake.writes()[0].change.files[0].text.includes("- Later"), true);
});

// TST-726006 · level: unit · module: MOD-review-pages
// guards: UC-021; NO TEXT TRAVELS IN A URL; WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK
// given: the product with the group file above, no token stored on GitHub; and a GitLab product with no token
// input: a move, then Save arrangement; and the same on GitLab
// expect: GitHub — nothing committed; a link to GitHub's editor for docs/groups/use-cases.md whose address holds only the path, and the new file's text on the clipboard; GitLab — no save: the page says the product is written with the project's own token and offers the step that stores one, and nothing is committed
test("TST-726006 without a token on GitHub the file goes to the clipboard and GitHub's editor opens; on GitLab nothing is saved", async () => {
  const github = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS } });
  const target = await show(github, { kind: "use-cases" }, { token: false });
  moveTo(itemOf(target, "UC-004")[0], "Review");
  click(saveButton(target));
  await until(() => byClass(target, "a", "github-page").length === 1, "the GitHub page");
  assert.deepEqual(github.writes(), []);
  const href = byClass(target, "a", "github-page")[0].getAttribute("href");
  assert.equal(href.includes("docs/groups/use-cases.md"), true, href);
  assert.equal(href.includes("UC-004") || href.includes("Review"), false, "no text in the address");
  assert.equal(copied.at(-1).includes("  - UC-004"), true, copied.at(-1));
  const gitlab = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS }, server: ON_GITLAB });
  const lab = await show(gitlab, { kind: "use-cases" }, { token: false, server: ON_GITLAB });
  moveTo(itemOf(lab, "UC-004")[0], "Review");
  click(saveButton(lab));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(gitlab.writes(), []);
  assert.equal(/project's own token/.test(lab.textContent), true, lab.textContent);
  assert.equal(byClass(lab, "a", "github-page").length, 0);
});

// TST-726007 · level: unit · module: MOD-review-pages
// guards: UC-021; ARTIFACTS ARE ARRANGED IN NESTED GROUPS
// given: the product, whose SPEC names two requirements and whose test file declares TST-100001; no group file of these kinds
// input: the route arrange drawn for requirements, for tests, for architecture and for modules
// expect: requirements — the two names at the top level; tests — TST-100001; architecture — ARC-001; modules — MOD-lending; each marked "not yet placed"
test("TST-726007 the items of the other kinds are the requirements' names, the tests' identifiers and the architecture's and modules' identifiers", async () => {
  const fake = fakeHost({ files: PRODUCT });
  const expected = { requirements: ["A BOOK CAN BE RETURNED", "A LOAN HAS A DUE DATE"], tests: ["TST-100001"], architecture: ["ARC-001"], modules: ["MOD-lending"] };
  for (const [kind, ids] of Object.entries(expected)) {
    const target = await show(fake, { kind });
    assert.deepEqual(byClass(target, "li", "arrange-item").map((node) => node.getAttribute("data-id")).sort(), ids, kind);
    assert.equal(byClass(target, "span", "mark").every((mark) => mark.textContent === "not yet placed"), true);
  }
});

// TST-726008 · level: unit · module: MOD-review-pages
// guards: UC-021; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the lists of the use cases, the architecture decisions and the module files; the product with the group file
// input: each list drawn; a click a script makes on Save arrangement
// expect: each list has a link "Arrange" to #arrange/kind=use-cases, #arrange/kind=architecture and #arrange/kind=modules, each followed by /product=<the product's address, percent-encoded>; a click a script makes on Save arrangement writes nothing
test("TST-726008 the lists of use cases, decisions and modules link Arrange to their kind, and a script's click saves nothing", async () => {
  const fake = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS } });
  for (const [route, kind] of [["use-case", "use-cases"], ["decision", "architecture"], ["module", "modules"]]) {
    emptyStorage();
    const store = openStore("alice/agent-m");
    writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
    const target = document.createElement("div");
    document.body.append(target);
    await routeOf(route).render(target, { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {}, product: { address: ON_GITHUB.web, kind: "github", host: fake.host } }, {});
    const links = find(target, (node) => node.localName === "a" && node.textContent === "Arrange");
    assert.deepEqual(links.map((node) => node.getAttribute("href")), [`#arrange/kind=${kind}/product=${encodeURIComponent(ON_GITHUB.web)}`], route);
  }
  const target = await show(fake, { kind: "use-cases" });
  moveTo(itemOf(target, "UC-004")[0], "Review");
  const scripted = Object.assign(new Event("click"), { scripted: true });
  saveButton(target).dispatchEvent(scripted);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(fake.writes(), []);
});

// ---------------------------------------------------------------- ITM-1357: Delete and Move content up one level

// The group file of the use cases with a third group, "Later", that holds nothing.
const GROUPS_WITH_EMPTY = `${GROUPS}- Later\n`;
const deleteButtons = (node) => find(node, (each) => each.localName === "button" && each.className.split(" ").includes("arrange-delete"));
const standsInAGroup = (node) => { for (let at = node.parentNode; at; at = at.parentNode) if (at.localName === "li" && at.className.split(" ").includes("arrange-group")) return true; return false; };

// TST-1357001 · level: unit · module: MOD-review-pages
// guards: UC-021; ARTIFACTS ARE ARRANGED IN NESTED GROUPS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the product with the group file above and a third group "Later" that holds nothing (known positive: the groups Review, Derivation and Later stand)
// input: the route arrange drawn for the kind use-cases; the Delete of the group Later; Save arrangement
// expect: each of the three groups offers one button Delete (class arrange-delete); after the click the one pending change is "Delete the empty group “Later”", the tree no longer shows Later, nothing is refused and nothing is written; after Save arrangement one commit on the head that was read holds docs/groups/use-cases.md alone, with the canonical text of the file without Later and with Review and Derivation as they were
test("TST-1357001 UC-021 2b each group offers Delete, which deletes an empty group as a pending change", async () => {
  const fake = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS_WITH_EMPTY } });
  const read = fake.head();
  const target = await show(fake, { kind: "use-cases" });
  assert.deepEqual(byClass(target, "li", "arrange-group").map((node) => node.getAttribute("data-title")), ["Review", "Derivation", "Later"], "known positive: the three groups stand");
  for (const title of ["Review", "Derivation", "Later"]) assert.deepEqual(deleteButtons(groupOf(target, title)).map((button) => button.textContent), ["Delete"], `${title} offers Delete`);
  click(deleteButtons(groupOf(target, "Later"))[0]);
  assert.deepEqual(pending(target), ["Delete the empty group “Later”"]);
  assert.deepEqual(refused(target), []);
  assert.equal(groupOf(target, "Later"), undefined);
  assert.deepEqual(fake.writes(), []);
  click(saveButton(target));
  await until(() => fake.writes().length === 1, "the save");
  const { change } = fake.writes()[0];
  assert.equal(change.expectedHead, read);
  assert.deepEqual(change.files.map((file) => file.path), [GROUPS_PATH]);
  assert.equal(change.files[0].text, text("# Use cases — groups", "", "The hierarchy of the use cases, each member by its identifier.", "", "- Review", "  - UC-001", "  - UC-002", "- Derivation", "  - UC-003", "  - UC-009"));
});

// TST-1357002 · level: unit · module: MOD-review-pages
// guards: UC-021; ARTIFACTS ARE ARRANGED IN NESTED GROUPS; AN ITEM HAS ONE PLACE IN ITS HIERARCHY
// given: the product with the group file above, in which the group Review holds UC-001 and UC-002 (known positive: Review holds both before the click)
// input: the route arrange drawn for the kind use-cases; the Delete of the group Review
// expect: the move is refused and listed beside the tree with its reason — "Delete the empty group “Review”: " and then the reason of MOD-group-document's applyMoves, that the group is not empty and what it holds is to be moved out first —, it is no pending change, Review still holds UC-001 and UC-002, and nothing is written
test("TST-1357002 UC-021 2b Delete of a group that is not empty shows the reason and changes nothing", async () => {
  const fake = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS } });
  const target = await show(fake, { kind: "use-cases" });
  assert.deepEqual(byClass(groupOf(target, "Review"), "li", "arrange-item").map((node) => node.getAttribute("data-id")), ["UC-001", "UC-002"], "known positive: Review holds two use cases");
  assert.equal(deleteButtons(groupOf(target, "Review")).length, 1, "Review offers Delete");
  click(deleteButtons(groupOf(target, "Review"))[0]);
  assert.equal(refused(target).length, 1);
  assert.match(refused(target)[0], /^Delete the empty group “Review”: .*not empty; move what it holds out first/);
  assert.deepEqual(pending(target), []);
  assert.deepEqual(byClass(groupOf(target, "Review"), "li", "arrange-item").map((node) => node.getAttribute("data-id")), ["UC-001", "UC-002"]);
  assert.deepEqual(fake.writes(), []);
});

// TST-1357003 · level: unit · module: MOD-review-pages
// guards: UC-021; ARTIFACTS ARE ARRANGED IN NESTED GROUPS; AN ITEM HAS ONE PLACE IN ITS HIERARCHY
// given: the product with the group file above, in which the group Review holds UC-001 and UC-002
// input: the route arrange drawn for the kind use-cases; "Move content up one level" of Review; the Delete of Review; Save arrangement
// expect: after the first click the one pending change is "Move the content of “Review” up one level", UC-001 and UC-002 stand at the top level (in no group) and Review stands, empty (known positive: the button arrange-lift is the one the page draws today); after the second the pending changes are that one and "Delete the empty group “Review”", in this order, and Review is gone; the saved file lists UC-001 and UC-002 once each at the top level and Derivation as it was, so that no item is deleted
test("TST-1357003 UC-021 2b Move content up one level, then Delete, leaves the content in the parent and the group gone", async () => {
  const fake = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS } });
  const target = await show(fake, { kind: "use-cases" });
  click(byClass(groupOf(target, "Review"), "button", "arrange-lift")[0]);
  assert.deepEqual(pending(target), ["Move the content of “Review” up one level"]);
  assert.equal(itemOf(target, "UC-001").some(standsInAGroup) || itemOf(target, "UC-002").some(standsInAGroup), false, "UC-001 and UC-002 stand at the top level");
  assert.deepEqual(byClass(groupOf(target, "Review"), "li", "arrange-item"), [], "Review stands, empty");
  assert.equal(deleteButtons(groupOf(target, "Review")).length, 1, "Review offers Delete");
  click(deleteButtons(groupOf(target, "Review"))[0]);
  assert.deepEqual(pending(target), ["Move the content of “Review” up one level", "Delete the empty group “Review”"]);
  assert.equal(groupOf(target, "Review"), undefined);
  assert.deepEqual(refused(target), []);
  click(saveButton(target));
  await until(() => fake.writes().length === 1, "the save");
  assert.equal(writtenGroupFile(fake)[0].text, text("# Use cases — groups", "", "The hierarchy of the use cases, each member by its identifier.", "", "- UC-001", "- UC-002", "- Derivation", "  - UC-003", "  - UC-009"));
});

// TST-1358001 · level: unit · module: MOD-review-pages
// guards: UC-021
// given: the product with the group file above (Review: UC-001, UC-002; Derivation: UC-003, UC-009; UC-004 in no group)
// input: the route arrange drawn for the kind use-cases; Move to … of UC-001 to Derivation; of UC-004 to Review; of UC-002 to Top level
// expect: the pending changes are "Move UC-001 from “Review” to “Derivation”", "Move UC-004 from the top level to “Review”" and "Move UC-002 from “Review” to the top level" (known positive: three pending changes stand, nothing is refused); nothing is written
test("TST-1358001 UC-021 3 a pending move of an item names the group it came from and the group it goes to, or the top level", async () => {
  const fake = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS } });
  const target = await show(fake, { kind: "use-cases" });
  moveTo(itemOf(target, "UC-001")[0], "Derivation");
  moveTo(itemOf(target, "UC-004")[0], "Review");
  moveTo(itemOf(target, "UC-002")[0], "Top level");
  assert.equal(pending(target).length, 3, "known positive: three pending changes stand");
  assert.deepEqual(refused(target), []);
  assert.deepEqual(pending(target), ["Move UC-001 from “Review” to “Derivation”", "Move UC-004 from the top level to “Review”", "Move UC-002 from “Review” to the top level"]);
  assert.deepEqual(fake.writes(), []);
});

// TST-1358002 · level: unit · module: MOD-review-pages
// guards: UC-021
// given: the product with the group file above
// input: Move to … of UC-004 to Derivation, then of UC-004 to Review
// expect: the pending changes are "Move UC-004 from the top level to “Derivation”" and "Move UC-004 from “Derivation” to “Review”": the second names the group the first put the item in (known positive: two pending changes stand)
test("TST-1358002 UC-021 3 a second move of an item names the group the first move put it in", async () => {
  const fake = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS } });
  const target = await show(fake, { kind: "use-cases" });
  moveTo(itemOf(target, "UC-004")[0], "Derivation");
  moveTo(itemOf(target, "UC-004")[0], "Review");
  assert.equal(pending(target).length, 2, "known positive: two pending changes stand");
  assert.deepEqual(pending(target), ["Move UC-004 from the top level to “Derivation”", "Move UC-004 from “Derivation” to “Review”"]);
});

// TST-1358003 · level: unit · module: MOD-review-pages
// guards: UC-021
// given: the product with the group file above
// input: Move to … of the group Derivation to Review; then of the group Review › Derivation to Top level
// expect: the pending changes are "Move the group “Derivation” from the top level to “Review”" and "Move the group “Review › Derivation” from “Review” to the top level" (known positive: two pending changes stand)
test("TST-1358003 UC-021 3 a pending move of a group names the group it came from and the group it goes to, or the top level", async () => {
  const fake = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS } });
  const target = await show(fake, { kind: "use-cases" });
  moveTo(groupOf(target, "Derivation"), "Review");
  moveTo(groupOf(target, "Derivation"), "Top level");
  assert.equal(pending(target).length, 2, "known positive: two pending changes stand");
  assert.deepEqual(pending(target), ["Move the group “Derivation” from the top level to “Review”", "Move the group “Review › Derivation” from “Review” to the top level"]);
});

// TST-1358004 · level: unit · module: MOD-review-pages
// guards: UC-021; A SAVE IS REFUSED WHEN THE TEXT CHANGED MEANWHILE
// given: the product with the group file above; the person moved UC-004 into Review; then a later commit of another writer puts UC-004 under Derivation
// input: Save arrangement
// expect: nothing is written; the pending change that still applies names the group the item is in now: "Move UC-004 from “Derivation” to “Review”" (known positive: one pending change stands before the save, "Move UC-004 from the top level to “Review”")
test("TST-1358004 UC-021 5a after a changed group file a pending move names the group the item is in now", async () => {
  const fake = fakeHost({ files: { ...PRODUCT, [GROUPS_PATH]: GROUPS } });
  const target = await show(fake, { kind: "use-cases" });
  moveTo(itemOf(target, "UC-004")[0], "Review");
  assert.deepEqual(pending(target), ["Move UC-004 from the top level to “Review”"], "known positive");
  fake.land({ [GROUPS_PATH]: GROUPS.replace("  - UC-009", "  - UC-009\n  - UC-004") });
  click(saveButton(target));
  await until(() => byClass(target, "p", "arrange-result").length === 1, "the refusal");
  assert.deepEqual(fake.writes(), []);
  assert.deepEqual(pending(target), ["Move UC-004 from “Derivation” to “Review”"]);
});
