// MOD-review-pages shows the impact list of a changed architecture file (ITM-729; UC-023 steps 4 and 6), as the accepted text of docs/architecture/MOD-review-pages.md
// states it: on `decision/<id>` and `module/<id>` of a file changed since acceptance, "an architecture file with its rounds, the due diligence and the impact list of a
// change" on `draft`, and the list of MOD-trace-graph's `architectureImpact`: the modules the change concerns, a module that uses an interface it alters or removes first and
// marked "breaks"; the code files; the tests and the requirements they guard; the requirements and use cases named and no longer named; the backlog items that name an affected module.
// Run: node --test tests/review-pages-impact-list.test.mjs
//
// Module: MOD-review-pages
// Guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; UC-023
// Level: unit
//
// The fixtures of tests/review-pages-draft-world.mjs are used unchanged (the document, the store, the instance, the page helpers); the product is a Host of this file's own over one
// repository in memory with a history, keeping to MOD-repository-hosts' interface. The real MOD-approvals, MOD-trace-graph, MOD-documents and MOD-prompt-bar run as they are.
// Nothing reaches the network. Where the module file leaves a reading open, the test states the one it takes, and the pull request names it:
//   - The list is <section class="change-impact">: <ul class="names"> with an <li class="module" data-id="<id>"> for each module, whose <span class="module-head"> reads "<id> breaks — <why>"
//     for a module that uses an interface the change alters or removes, "<id> — changed" for the changed file's own module; under the head <p class="small code-files"> "Code files — …"
//     ("no code yet" where the module's folder holds none) and <p class="small tests"> "Tests — …" ("none" where no test exercises it); then, as children of the section,
//     <p class="small"> lines "Requirements and use cases — newly named: … · no longer named: …" and "Items — …".
//   - UC-023 step 4 lists "the code files in each affected module's folder" and "the tests that exercise each affected module": a code file stands under the module whose folder begins its path,
//     a test under the module it exercises (MOD-trace-graph's Graph: the module's `folder`, the `exercises` edges).
//   - On `draft`, the list stands in the draft's box of the architecture file the draft changes, from the file's text on the default branch (before) and the draft (after).
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { PRODUCT, blobOf, byClass, contextOf, draw, failure, keepDraft, resultOf, ROUND_ONE, GITHUB, text, fetched } from "./review-pages-draft-world.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

// Every commit the fakes of this file make is its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page.
let commitsMade = 0;

test.afterEach(() => { assert.deepEqual(fetched.splice(0), [], "no request left the fixtures"); });

// ---------------------------------------------------------------- the product

const SPEC = text("# Fixture - Specification", "", "## 1. Rules", "", "**RULE ONE** *(Product Owner)*", "First rule.", "*Check:* `tests/reader.test.mjs`", "",
  "**RULE TWO** *(Product Owner)*", "Second rule.", "*Check:* `tests/tree-view.test.mjs`");
const UC1 = text("---", "id: UC-001", "title: Read a book", "area: reading", "actors:", "  - Member", "realises:", "  - RULE ONE", "---", "# UC-001 Read a book", "", "**Goal.** Read.");
const decision = (id, designs, sentence) => text("---", `id: ${id}`, `title: ${id} title`, "forced_by:", "  - RULE ONE", "designs:", ...designs.map((name) => `  - ${name}`), "---",
  `# ${id} ${id} title`, "", "## Context", "", "Books are read.", "", "## Decision", "", sentence, "", "## Alternatives", "", "None.", "", "## Consequences", "", "Folders.");
const module_ = (id, folder, { realises = [], follows = [], uses = [], provides = [], interfaces = [], sentence = "It does one thing." } = {}) => text("---", `id: ${id}`, `title: ${id} title`,
  `folder: ${folder}`, "realises:", ...realises.map((name) => `  - ${name}`), "follows:", ...follows.map((name) => `  - ${name}`), "uses:", ...uses.map((name) => `  - ${name}`),
  "provides:", ...provides.map((name) => `  - ${name}`), "---", `# ${id} ${id} title`, "", "## Responsibility", "", sentence, "", "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "",
  "## Interfaces", "", ...interfaces, "", "## Files", "", "None.", "", "## Uses", "", "Nothing.");
const testDeclaration = (id, module, guards) => text(`// ${id} · level: unit · module: ${module}`, `// guards: ${guards.join("; ")}`);
const item = (id, module) => text("---", `id: ${id}`, `title: ${id} title`, "level: module", "modules:", `  - ${module}`, "tests:", "  - unit", "---", `# ${id} ${id} title`);

const READER_PATH = "docs/architecture/MOD-reader.md", ARC1_PATH = "docs/architecture/ARC-001-reading.md", ARC2_PATH = "docs/architecture/ARC-002-pending.md";
const READER_INTERFACES = ["- `lend(book) -> loan` - lends a book.", "- `listTree() -> [path]` - lists the paths."];
const READER_BEFORE = module_("MOD-reader", "src/reader/", { realises: ["RULE ONE", "UC-001"], follows: ["ARC-001"], provides: ["lend", "listTree"], interfaces: READER_INTERFACES });
// The change: listTree is removed, RULE TWO is named, UC-001 is no longer named.
const READER_AFTER = module_("MOD-reader", "src/reader/", { realises: ["RULE ONE", "RULE TWO"], follows: ["ARC-001"], provides: ["lend"], interfaces: [READER_INTERFACES[0]] });
const ARC1 = decision("ARC-001", ["MOD-reader"], "Reading is one module.");
const ARC2_BEFORE = decision("ARC-002", ["MOD-pending"], "Pending is one module.");
const ARC2_AFTER = decision("ARC-002", ["MOD-pending"], "Pending is one module, and a small one.");
const BASE = {
  "README.md": "# Fixture\n", "SPEC.md": SPEC, "docs/use-cases/UC-001-read-a-book.md": UC1, [ARC1_PATH]: ARC1, [ARC2_PATH]: ARC2_BEFORE,
  "docs/architecture/MOD-tree-view.md": module_("MOD-tree-view", "src/tree-view/", { uses: ["MOD-reader.listTree"] }),
  "docs/architecture/MOD-stable-view.md": module_("MOD-stable-view", "src/stable-view/", { uses: ["MOD-reader.lend"] }),
  "docs/architecture/MOD-pending.md": module_("MOD-pending", "src/pending/", { follows: ["ARC-002"] }),
  "tests/reader.test.mjs": testDeclaration("TST-801", "MOD-reader", ["RULE ONE"]),
  "tests/tree-view.test.mjs": testDeclaration("TST-802", "MOD-tree-view", ["RULE TWO"]),
  "tests/stable-view.test.mjs": testDeclaration("TST-803", "MOD-stable-view", ["RULE ONE"]),
  "docs/backlog/ITM-801-reader.md": item("ITM-801", "MOD-reader"), "docs/backlog/ITM-802-tree-view.md": item("ITM-802", "MOD-tree-view"),
  "src/reader/read.mjs": "export const read = 1;\n", "src/tree-view/view.mjs": "export const tree = 1;\n", "src/stable-view/view.mjs": "export const stable = 1;\n",
  "src/reader-extra/unrelated.mjs": "export const unrelated = 1;\n",
};
const recordOf = (id, kind, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text(`kind: ${kind}`, `file: ${path}`, `blob: ${blobOf(body)}`)];
// Accepted: UC-001, ARC-001, ARC-002 and MOD-reader at the texts of BASE; MOD-reader and ARC-002 are then changed; with `changed: false` the default branch holds the accepted texts.
function steps(changed) {
  return [{ ...BASE, [READER_PATH]: READER_BEFORE },
    Object.fromEntries([recordOf("UC-001", "use-case", "docs/use-cases/UC-001-read-a-book.md", UC1), recordOf("ARC-001", "architecture-decision", ARC1_PATH, ARC1),
      recordOf("ARC-002", "architecture-decision", ARC2_PATH, ARC2_BEFORE), recordOf("MOD-reader", "module", READER_PATH, READER_BEFORE)]),
    ...(changed ? [{ [READER_PATH]: READER_AFTER, [ARC2_PATH]: ARC2_AFTER }] : [])];
}

// A Host of this file's own: the repository with a history, keeping to MOD-repository-hosts' interface.
function fakeProduct(changed) {
  const commits = new Map();
  let made = 0, head = null;
  for (const files of steps(changed)) {
    const sha = createHash("sha1").update(`commit ${++made} of the file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree: new Map([...(head ? commits.get(head).tree : []), ...Object.entries(files)]), parent: head, date: `2026-10-0${made}T10:00:00Z` });
    head = sha;
  }
  const bareSnapshotAt = (sha, ref) => {
    const { tree } = commits.get(sha);
    return { repository: GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  // Each snapshot serves the graph the push job stores for its commit (tests/stored-graph-fake.mjs); a page reads it and never builds one (MOD-trace-graph).
  const snapshotAt = (...args) => withStoredGraph(bareSnapshotAt(...args));
  return {
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readFileAt(path, shas) {
        return new Map(shas.map((sha) => [sha, commits.get(sha)?.tree.get(path) ?? null]));
      },
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
      async commitFiles() { throw failure("Unexpected", "nothing is written"); },
    },
  };
}

const impactOf = (target) => byClass(target, "section", "change-impact")[0];
const namesOf = (impact) => byClass(impact, "span", "module-head").map((node) => node.textContent);
// The lines of the list itself: the <p class="small"> that are children of the section, not those under a module.
const linesOf = (impact) => impact.childNodes.filter((node) => node.nodeType === 1 && node.localName === "p" && node.className.split(" ").includes("small")).map((node) => node.textContent);
// What stands under each module, by its identifier: its code files and its tests, one line each.
const underModules = (impact) => Object.fromEntries(byClass(impact, "li", "module").map((item) =>
  [item.getAttribute("data-id"), [byClass(item, "p", "code-files")[0].textContent, byClass(item, "p", "tests")[0].textContent]]));
const MODULE_LIST = ["MOD-tree-view breaks — uses an interface that is removed", "MOD-reader — changed"];
const MODULE_LINES = ["Affected modules", "Requirements and use cases — newly named: RULE TWO · no longer named: UC-001", "Items — ITM-801, ITM-802"];
const UNDER_MODULES = { "MOD-tree-view": ["Code files — src/tree-view/view.mjs", "Tests — TST-802 (guards RULE TWO)"],
  "MOD-reader": ["Code files — src/reader/read.mjs", "Tests — TST-801 (guards RULE ONE)"] };

// TST-729001 · level: unit · module: MOD-review-pages
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: an accepted MOD-reader changed since: its interface listTree removed, RULE TWO named, UC-001 no longer named; MOD-tree-view uses listTree, MOD-stable-view uses lend which stays; code files, three tests and two backlog items
// input: the route module for MOD-reader
// expect: the list names MOD-tree-view first, marked breaks, then MOD-reader changed, and not MOD-stable-view; the code files of src/reader/ and src/tree-view/ and not src/reader-extra/; TST-801 guarding RULE ONE and TST-802 guarding RULE TWO; RULE TWO newly named and UC-001 no longer named; ITM-801 and ITM-802
test("module/<id> — the impact list of a changed module file: breaking modules first, code files, tests, names and items", async () => {
  const { target } = await draw(fakeProduct(true), "module", { id: "MOD-reader" });
  const impact = impactOf(target);
  assert.ok(impact, "the impact list");
  assert.deepEqual(namesOf(impact), MODULE_LIST);
  assert.equal(byClass(impact, "span", "breaks").length, 1, "one module is marked breaks");
  assert.deepEqual(linesOf(impact), MODULE_LINES);
  assert.deepEqual(underModules(impact), UNDER_MODULES, "each module with its own code files and its own tests");
});

// TST-729002 · level: unit · module: MOD-review-pages
// guards: AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: an accepted decision ARC-002 changed since, which designs only MOD-pending, whose folder src/pending/ holds no code file
// input: the route decision for ARC-002
// expect: the list names MOD-pending changed, not marked breaks, and says "no code yet" for the code files
test("decision/<id> — a module folder without code says no code yet", async () => {
  const { target } = await draw(fakeProduct(true), "decision", { id: "ARC-002" });
  const impact = impactOf(target);
  assert.ok(impact, "the impact list");
  assert.deepEqual(namesOf(impact), ["MOD-pending — changed"]);
  assert.equal(byClass(impact, "span", "breaks").length, 0);
  assert.deepEqual(underModules(impact), { "MOD-pending": ["Code files — no code yet", "Tests — none"] });
});

// TST-729003 · level: unit · module: MOD-review-pages
// guards: A DRAFTED CHANGE IS SHOWN AGAINST THE CURRENT TEXT; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; UC-023
// given: MOD-reader accepted and unchanged on the default branch; the conversation's draft of kind change-architecture holds the same change as TST-729001 as the text of MOD-reader
// input: the route draft for the subject of MOD-reader; and the route module for MOD-reader on the repository where that change is committed
// expect: the draft's box of MOD-reader holds the impact list, its modules, lines and "breaks" mark equal to those of the route module; the page writes nothing
test("draft — an architecture file's draft shows the same impact list as the same change on module/<id>", async () => {
  const key = `module/id=MOD-reader/product=${PRODUCT}`;
  const fake = fakeProduct(false);
  const context = contextOf(fake);
  keepDraft(context, { subject: key, kind: "change-architecture", params: { target: "MOD-reader", version: blobOf(READER_BEFORE), instruction: "remove listTree" },
    result: resultOf({ files: [{ path: READER_PATH, text: READER_AFTER, class: "change", of: "MOD-reader" }] }, { rounds: [ROUND_ONE] }) });
  const { target } = await draw(fake, "draft", { subject: key }, { context });
  const [box] = byClass(target, "div", "draft");
  const impact = impactOf(box);
  assert.ok(impact, "the impact list stands in the draft's box");
  assert.deepEqual(namesOf(impact), MODULE_LIST);
  assert.equal(byClass(impact, "span", "breaks").length, 1);
  assert.deepEqual(linesOf(impact), MODULE_LINES);
  assert.deepEqual(underModules(impact), UNDER_MODULES);
  const route = impactOf((await draw(fakeProduct(true), "module", { id: "MOD-reader" })).target);
  assert.equal(impact.textContent, route.textContent, "the same list as on the route module");
});
