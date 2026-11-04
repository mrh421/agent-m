// Release tests of ITM-1314 — UC-023 on a decision or module file that is put back after its removal was accepted. The record of an accepted removal names the empty text's blob (MOD-approvals,
// Data: "for a removed decision or module file, the blob of the empty text"), so the empty text is the text "named by the most recent approval record" of the identifier (MOD-approvals,
// lastAcceptedText); the file put back is therefore a file changed since acceptance, shown against that text (A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT), and rejecting it returns it to
// that text, which as the text of a removed file is no file (A REJECTION REMOVES THE PROPOSAL: "returns to the text its most recent approval record names, or leaves the working tree").
// Run: node --test tests/release-itm-1314-put-back-after-removal.test.mjs
//
// Module: MOD-approvals
// Module: MOD-review-pages
// Guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; A REJECTION REMOVES THE PROPOSAL; UC-023
// Level: release
//
// Written for the release testing of sprint 126 by developer-sonnet-l, who implemented none of ITM-1314 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The world is the review pages' small DOM
// (tests/review-pages-harness.mjs) over a repository of the test's own, in memory, with the history the case needs: MOD-shelf is accepted, then removed in a commit that adds the record of the removal,
// then put back with another text; MOD-reader is accepted and then edited, which is the known positive of each case. The cases end at what a person reads on the pages and at the commit the repository
// received. Readings the texts leave open, which the cases state:
//   - A difference "against the empty text" is one in which every line of the file is added and none is removed.
//   - "Rejecting" a file whose last accepted text is a removal's is the file deleted in one commit, with the reason in its message.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { until } from "./review-pages-wait.mjs";

let commitsMade = 0;
const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs");
const routeOf = (name) => pages.view.routes.find((candidate) => candidate.name === name);

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const EMPTY = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };
const RULE = "A LOAN HAS A DUE DATE";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`, "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");
const UC1 = text("---", "id: UC-001", "title: Lend a book", "area: lending", "actors:", "  - Member", "realises:", `  - ${RULE}`, "---", "# UC-001 Lend a book", "", "**Goal.** Lend.");
const ARC1 = text("---", "id: ARC-001", "title: Lending", "forced_by:", `  - ${RULE}`, "designs:", "  - MOD-reader", "  - MOD-shelf", "---", "# ARC-001 Lending", "", "## Context", "", "Books are lent.", "",
  "## Decision", "", "Two modules.", "", "## Alternatives", "", "One.", "", "## Consequences", "", "Two folders.");
const module_ = (id, folder, sentence) => text("---", `id: ${id}`, `title: ${id} title`, `folder: ${folder}`, "realises:", `  - ${RULE}`, "follows:", "  - ARC-001", "uses:", "provides:", "  - f", "---",
  `# ${id} ${id} title`, "", "## Responsibility", "", sentence, "", "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "- `f`", "", "## Files", "", "None.", "", "## Uses", "", "Nothing.");
const P = (slug) => `docs/architecture/MOD-${slug}.md`;
const ARC1_PATH = "docs/architecture/ARC-001-lending.md", UC1_PATH = "docs/use-cases/UC-001-lend-a-book.md";
const READER_OLD = module_("MOD-reader", "src/reader/", "It reads files."), READER_NOW = module_("MOD-reader", "src/reader/", "It reads the product's files.");
const SHELF_OLD = module_("MOD-shelf", "src/shelf/", "It keeps the books on a shelf."), SHELF_BACK = module_("MOD-shelf", "src/shelf/", "It keeps the books on shelves, by number.");
const record = (id, kind, path, blob) => [`docs/approvals/${id}-${blob.slice(0, 12)}.md`, text(`kind: ${kind}`, `file: ${path}`, `blob: ${blob}`)];
// Three commits: everything accepted; MOD-shelf removed with the record of its removal; MOD-shelf put back with another text and MOD-reader edited.
const STEPS = [
  { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [UC1_PATH]: UC1, [ARC1_PATH]: ARC1, [P("reader")]: READER_OLD, [P("shelf")]: SHELF_OLD, "src/reader/index.mjs": "export const f = 1;\n",
    ...Object.fromEntries([record("UC-001", "use-case", UC1_PATH, blobOf(UC1)), record("ARC-001", "architecture-decision", ARC1_PATH, blobOf(ARC1)),
      record("MOD-reader", "module", P("reader"), blobOf(READER_OLD)), record("MOD-shelf", "module", P("shelf"), blobOf(SHELF_OLD))]) },
  { [P("shelf")]: null, ...Object.fromEntries([record("MOD-shelf", "module", P("shelf"), EMPTY)]) },
  { [P("shelf")]: SHELF_BACK, [P("reader")]: READER_NOW },
];

function fakeProduct() {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made} of the file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree, parent, date: new Date(Date.UTC(2026, 9, 1, 10, made)).toISOString() });
    return sha;
  };
  for (const step of STEPS) {
    const tree = new Map(head ? commits.get(head).tree : []);
    for (const [path, body] of Object.entries(step)) { if (body === null) tree.delete(path); else tree.set(path, body); }
    head = commitOf(tree, head);
  }
  const bare = (sha, ref) => {
    const { tree } = commits.get(sha);
    return { repository: ON_GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null), blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  const snapshotAt = (...args) => withStoredGraph(bare(...args));
  return {
    files: () => Object.fromEntries(commits.get(head).tree),
    writes: () => calls.map((call) => call.change),
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        if (ref === "main") return snapshotAt(head, "main");
        if (commits.has(ref)) return snapshotAt(ref, ref);
        throw failure("NotFound", `${ref} was not found`);
      },
      async readHistory(path, { ref = "main", limit } = {}) {
        const found = [];
        for (let sha = ref === "main" ? head : ref; sha; sha = commits.get(sha).parent) {
          const here = commits.get(sha), before = here.parent ? commits.get(here.parent).tree.get(path) : undefined;
          if (here.tree.get(path) !== before) found.push({ commit: sha, parents: here.parent ? [here.parent] : [], date: here.date, message: "", author: { account: null, name: "x" }, changes: [] });
        }
        return limit ? found.slice(0, limit) : found;
      },
      async readFileAt(path, shas) { return new Map(shas.map((sha) => [sha, commits.has(sha) && commits.get(sha).tree.has(path) ? commits.get(sha).tree.get(path) : null])); },
      async commitFiles(change) {
        calls.push({ change: structuredClone(change) });
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        const tree = new Map(commits.get(head).tree);
        for (const file of change.files) { if (file.delete) tree.delete(file.path); else tree.set(file.path, file.text); }
        head = commitOf(tree, head);
        return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the page

async function show(fake, route, params) {
  const store = openStore("alice/agent-m");
  writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  await routeOf(route).render(target, { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {}, product: { address: ON_GITHUB.web, kind: "github", host: fake.host } }, params);
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(new Event("click"));
const badgeOf = (root) => byClass(root, "span", "badge")[0]?.textContent;
const lines = (root, className) => byClass(root, "span", className).map((node) => node.textContent);
const diffOf = (root) => byClass(root, "section", "accepted-diff")[0];
const reject = async (target, reason) => {
  byClass(target, "textarea", "reject-reason")[0].value = reason;
  click(byClass(target, "button", "reject")[0]);
};

// TST-1314301 · level: release · module: MOD-review-pages
// guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; UC-023
// given: MOD-shelf accepted, removed with its removal accepted, and put back with another text; known positive first — MOD-reader accepted and then edited
// input: the reviewer opens the page of MOD-reader and the page of MOD-shelf
// expect: known positive — MOD-reader is changed since acceptance, its difference removes the sentence "It reads files." and adds "It reads the product's files."; MOD-shelf is changed since acceptance too, and its difference shows every line of the file added, none removed, with the sentence "It keeps the books on shelves, by number." among them, and no problem in the difference section
test("TST-1314301: UC-023 a module file put back after its accepted removal is shown against the empty text", async () => {
  const known = await show(fakeProduct(), "module", { id: "MOD-reader" });
  assert.equal(badgeOf(known), "changed since acceptance");
  assert.deepEqual(lines(diffOf(known), "ddel"), ["- It reads files."], "known positive: the removed sentence");
  assert.deepEqual(lines(diffOf(known), "dadd"), ["+ It reads the product's files."], "and the added one");

  const fake = fakeProduct();
  const target = await show(fake, "module", { id: "MOD-shelf" });
  assert.equal(badgeOf(target), "changed since acceptance");
  const diff = diffOf(target);
  assert.equal(byClass(diff, "p", "problem").length, 0, "no problem in the difference section");
  assert.deepEqual(lines(diff, "ddel"), [], "no line is removed");
  const added = lines(diff, "dadd");
  assert.equal(added.length, SHELF_BACK.replace(/\n$/, "").split("\n").length, "every line of the file is added");
  assert.ok(added.includes("+ It keeps the books on shelves, by number."));
  assert.equal(fake.writes().length, 0, "nothing is written");
});

// TST-1314302 · level: release · module: MOD-review-pages
// guards: A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; UC-023
// given: the product of TST-1314301
// input: the reviewer opens the review page of the whole architecture (decision/id=all)
// expect: it shows MOD-reader and MOD-shelf as files changed since acceptance, each with its difference and no problem, MOD-shelf's with every line added; it lists no file as removed since acceptance, since MOD-shelf's file stands; the button reads "Accept all 2 shown"
test("TST-1314302: UC-023 the review of the whole architecture shows the put-back file as changed, not as removed", async () => {
  const target = await show(fakeProduct(), "decision", { id: "all" });
  const sections = Object.fromEntries(byClass(target, "section", "review-file").map((node) => [node.getAttribute("data-id"), node]));
  assert.deepEqual(Object.keys(sections).sort(), ["MOD-reader", "MOD-shelf"]);
  for (const [id, section] of Object.entries(sections)) {
    assert.equal(badgeOf(section), "changed since acceptance", id);
    assert.equal(byClass(diffOf(section), "p", "problem").length, 0, `${id}: no problem`);
  }
  assert.deepEqual(lines(diffOf(sections["MOD-shelf"]), "ddel"), []);
  assert.ok(lines(diffOf(sections["MOD-shelf"]), "dadd").includes("+ It keeps the books on shelves, by number."));
  assert.ok(!target.textContent.includes("removed since acceptance"));
  assert.ok(byClass(target, "button", "accept-all").some((button) => button.textContent === "Accept all 2 shown"));
});

// TST-1314303 · level: release · module: MOD-approvals
// guards: A REJECTION REMOVES THE PROPOSAL; A PROPOSAL IS REJECTED WITH A REASON; UC-023
// given: the product of TST-1314301 and a token; known positive first — MOD-reader, accepted and then edited
// input: the reviewer rejects MOD-reader with the reason "not wanted", and MOD-shelf with the reason "it stays removed"
// expect: known positive — MOD-reader's rejection is one commit that writes the text its record names; MOD-shelf's is one commit that deletes MOD-shelf's file and writes no other file, with the reason in its message, and no approval record is written; the file is then not in the repository
test("TST-1314303: UC-023 rejecting the put-back file deletes it in one commit with the reason", async () => {
  const fake = fakeProduct();
  const reader = await show(fake, "module", { id: "MOD-reader" });
  await reject(reader, "not wanted");
  await until(reader, () => fake.writes().length === 1, "MOD-reader's rejection");
  assert.deepEqual(fake.writes()[0].files, [{ path: P("reader"), text: READER_OLD }], "known positive: the text the record names");

  const shelf = await show(fake, "module", { id: "MOD-shelf" });
  await reject(shelf, "it stays removed");
  await until(shelf, () => fake.writes().length === 2, "MOD-shelf's rejection");
  const [, write] = fake.writes();
  assert.deepEqual(write.files, [{ path: P("shelf"), delete: true }], "one file, deleted");
  assert.match(write.message, /^reject MOD-shelf \(Agent M dashboard\)\n\nRejected by Agent M · thesis-tool\.\n\nReason: it stays removed\n$/);
  assert.equal(P("shelf") in fake.files(), false);
});
