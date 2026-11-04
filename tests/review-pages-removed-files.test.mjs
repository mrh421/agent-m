// MOD-review-pages' route decision/all with a removed module file (ITM-730), as the accepted text of docs/architecture/MOD-review-pages.md
// states it: "It also lists every decision or module file that `removedFiles` names, each with its impact list (`architectureImpact` with
// `after: null`) and the empty text as the text shown, so that *Accept all N shown* counts it and records its removal in the same commit
// (`AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST`)" — and UC-023 step 5: "every changed file with its difference and its
// impact list, every new file in full, every removed decision with its impact list, and **Accept all N shown** for all of them in one commit".
// Run: node --test tests/review-pages-removed-files.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-023; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged; the repository is a Host of the tests' own over one
// repository in memory with a history — a commit may add, change and remove files —, keeping to MOD-repository-hosts' interface, every
// readHistory recorded; each snapshot serves the graph stored for its commit (tests/stored-graph-fake.mjs). The real MOD-approvals,
// MOD-documents, MOD-trace-graph and MOD-browser-store run as they are. Nothing reaches the network. The readings this file takes, which the
// pull request names: a removed file is a <section class="review-file" data-id="…"> as every file of Review all, after the files that stand;
// its last accepted text stands against the empty text in the section `accepted-diff`, and its impact list is the section `change-impact`.
// Each test states its input and its expected result before it runs. The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import { until } from "./review-pages-wait.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { withStoredGraph } from "./stored-graph-fake.mjs";

let commitsMade = 0;
const kept = new Map();
globalThis.localStorage = { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); },
  removeItem: (k) => { kept.delete(k); }, key: (i) => [...kept.keys()][i] ?? null, get length() { return kept.size; } };
const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const route = pages.view?.routes.find((candidate) => candidate.name === "decision");

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const EMPTY = "e69de29bb2d1d6434b8b29ae775ad8c2e48c5391";
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };

const RULE = "A LOAN HAS A DUE DATE";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`,
  "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");
const UC1_PATH = "docs/use-cases/UC-001-borrow-a-book.md";
const UC1 = text("---", "id: UC-001", "title: Borrow a book", "area: lending", "actors:", "  - Member", "realises:", `  - ${RULE}`, "---",
  "# UC-001 Borrow a book", "", "**Goal.** The member borrows a book.");
const decision = ({ id, title, refines = null, designs = [], sentence }) => text("---", `id: ${id}`, `title: ${title}`,
  ...(refines ? [`refines: ${refines}`] : []), "forced_by:", `  - ${RULE}`, "  - UC-001", ...(designs.length ? ["designs:", ...designs.map((name) => `  - ${name}`)] : []),
  "---", `# ${id} ${title}`, "", "## Context", "", "Books are lent at a desk.", "", "## Decision", "", sentence, "", "## Alternatives", "", "One module.", "",
  "## Consequences", "", "Folders of their own.");
const module_ = (id, title, folder, sentence) => text("---", `id: ${id}`, `title: ${title}`, `folder: ${folder}`, "realises:", `  - ${RULE}`,
  "follows:", "  - ARC-002", "uses:", "provides:", "  - lend", "---", `# ${id} ${title}`, "", "## Responsibility", "", sentence, "", "## Parts", "",
  "- `index.mjs`", "", "## Data", "", "Nothing.", "", "## Interfaces", "", "- `lend`", "", "## Files", "", "None.", "", "## Uses", "", "Nothing.");
const A = (n, slug) => `docs/architecture/ARC-00${n}-${slug}.md`;
const M = (slug) => `docs/architecture/MOD-${slug}.md`;
const ARC1 = decision({ id: "ARC-001", title: "Lending as a whole", sentence: "Lending is a desk." });
const ARC2_OLD = decision({ id: "ARC-002", title: "The desk", refines: "ARC-001", designs: ["MOD-desk", "MOD-shelf"], sentence: "The desk lends; the shelf keeps the books." });
const ARC2 = decision({ id: "ARC-002", title: "The desk", refines: "ARC-001", designs: ["MOD-desk", "MOD-counter"], sentence: "The desk lends; the counter keeps the books." });
const MOD_DESK = module_("MOD-desk", "The desk", "src/desk/", "It lends a book.");
const MOD_SHELF = module_("MOD-shelf", "The shelf", "src/shelf/", "It keeps the books on a shelf.");
const MOD_COUNTER = module_("MOD-counter", "The counter", "src/counter/", "It keeps the books behind the counter.");
const SHELF_CODE = "src/shelf/index.mjs";
const recordOf = (id, kind, path, blob) => [`docs/approvals/${id}-${blob.slice(0, 12)}.md`, text(`kind: ${kind}`, `file: ${path}`, `blob: ${blob}`)];
const accepted = (id, kind, path, body) => recordOf(id, kind, path, blobOf(body));

// Three commits: the architecture as it was accepted — ARC-001, ARC-002 at its earlier text, MOD-desk, MOD-shelf with its code —; their records;
// then the restructuring: ARC-002 changed, MOD-counter new, and — where `removed` — MOD-shelf's file gone, its code still in its folder.
const stepsOf = ({ removed = true } = {}) => [
  { set: { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [UC1_PATH]: UC1, [A(1, "lending")]: ARC1, [A(2, "desk")]: ARC2_OLD, [M("desk")]: MOD_DESK,
    [M("shelf")]: MOD_SHELF, [SHELF_CODE]: "export const shelve = () => {};\n", "src/desk/index.mjs": "export const lend = () => {};\n" } },
  { set: Object.fromEntries([accepted("UC-001", "use-case", UC1_PATH, UC1), accepted("ARC-001", "architecture-decision", A(1, "lending"), ARC1),
    accepted("ARC-002", "architecture-decision", A(2, "desk"), ARC2_OLD), accepted("MOD-desk", "module", M("desk"), MOD_DESK),
    accepted("MOD-shelf", "module", M("shelf"), MOD_SHELF)]) },
  { set: { [A(2, "desk")]: ARC2, [M("counter")]: MOD_COUNTER }, remove: removed ? [M("shelf")] : [] },
];

// ---------------------------------------------------------------- the fake host

function fakeHost(options) {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made} of the file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree, parent, date: `2026-10-0${made}T10:00:00Z` });
    return sha;
  };
  for (const { set, remove = [] } of stepsOf(options)) {
    const tree = new Map([...(head ? commits.get(head).tree : []), ...Object.entries(set)]);
    for (const path of remove) tree.delete(path);
    head = commitOf(tree, head);
  }
  const snapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return withStoredGraph({ repository: ON_GITHUB, ref: sha, commit: sha, paths: [...tree.keys()].sort(),
      read: async (path) => (tree.has(path) ? tree.get(path) : null), blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) });
  };
  return {
    head: () => head,
    writes: () => calls.filter((call) => call.fn === "commitFiles"),
    histories: () => calls.filter((call) => call.fn === "readHistory").map((call) => call.path),
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
        calls.push({ fn: "readHistory", path });
        const found = [];
        for (let sha = ref === "main" ? head : ref; sha; sha = commits.get(sha).parent) {
          const here = commits.get(sha), before = here.parent ? commits.get(here.parent).tree.get(path) : undefined;
          if (here.tree.get(path) !== before) found.push({ commit: sha, parents: here.parent ? [here.parent] : [], date: here.date, message: "", author: { account: null, name: "x" }, changes: [] });
        }
        return limit ? found.slice(0, limit) : found;
      },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((f) => [f.path, f.text])]), head);
        return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the page

async function show(fake) {
  assert.ok(route, `the route decision: ${pages.error?.message}`);
  const store = openStore("alice/agent-m");
  writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {},
    product: { address: ON_GITHUB.web, kind: "github", host: fake.host } }, { id: "all" });
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true }));
const filesOf = (target) => byClass(target, "section", "review-file").map((section) => section.getAttribute("data-id"));
const fileOf = (target, id) => byClass(target, "section", "review-file").find((section) => section.getAttribute("data-id") === id);
const shelfRecords = (paths) => paths.filter((path) => path.startsWith("docs/approvals/MOD-shelf-"));

// TST-730004 · level: unit · module: MOD-review-pages
// guards: UC-023; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT
// given: a restructuring on main — ARC-002 changed since acceptance (it designed MOD-desk and MOD-shelf, now MOD-desk and MOD-counter), MOD-counter new, and MOD-shelf accepted and then removed, its code file src/shelf/index.mjs still in its folder —, ARC-001, UC-001 and MOD-desk accepted, and a token
// input: the route decision rendered with the id all; then a click on "Accept all 3 shown"
// expect: the sections ARC-002, MOD-counter and MOD-shelf in this order; ARC-002 with its difference and its impact list; MOD-counter in full, without a difference or an impact list; MOD-shelf with its last accepted text against the empty text — its lines shown removed — and its impact list naming MOD-shelf and src/shelf/index.mjs; MOD-shelf's last accepted text read once (one readHistory of its one record); the button "Accept all 3 shown"; the click makes one commit on the head that was read, holding one record per file shown in that order, MOD-shelf's docs/approvals/MOD-shelf-e69de29bb2d1.md naming file docs/architecture/MOD-shelf.md and blob e69de29bb2d1d6434b8b29ae775ad8c2e48c5391; the page drawn again shows no file
test("MOD-review-pages decision/all — a removed module file with its impact list, counted and recorded with the empty text's blob", async () => {
  const fake = fakeHost();
  const read = fake.head();
  const target = await show(fake);

  assert.deepEqual(filesOf(target), ["ARC-002", "MOD-counter", "MOD-shelf"]);
  assert.equal(byClass(fileOf(target, "ARC-002"), "section", "accepted-diff").length, 1, "the changed decision with its difference");
  assert.equal(byClass(fileOf(target, "ARC-002"), "section", "change-impact").length, 1, "and its impact list");
  assert.match(fileOf(target, "MOD-counter").textContent, /It keeps the books behind the counter\./, "the new module file in full");
  assert.equal(byClass(fileOf(target, "MOD-counter"), "section", "accepted-diff").length + byClass(fileOf(target, "MOD-counter"), "section", "change-impact").length, 0,
    "a new file has no difference and no impact list");
  const shelf = fileOf(target, "MOD-shelf");
  const removedText = byClass(shelf, "section", "accepted-diff")[0];
  assert.ok(removedText, "the removed file's last accepted text against the empty text");
  assert.match(removedText.textContent, /- It keeps the books on a shelf\./);
  assert.ok(!/\+ \S/.test(removedText.textContent), "nothing added: the text shown is empty");
  const impact = byClass(shelf, "section", "change-impact")[0];
  assert.ok(impact, "the removed file's impact list");
  assert.match(impact.textContent, /MOD-shelf/);
  assert.match(impact.textContent, /src\/shelf\/index\.mjs/, "the code file still in the removed module's folder");
  assert.equal(shelfRecords(fake.histories()).length, 1, "MOD-shelf's last accepted text read once, through its one record");
  assert.equal(byClass(target, "button", "accept-all")[0].textContent, "Accept all 3 shown");

  click(byClass(target, "button", "accept-all")[0]);
  await until(target, () => fake.writes().length === 1, "the commit");
  const [{ change }] = fake.writes();
  assert.equal(change.expectedHead, read, "on the head that was read");
  assert.deepEqual(change.files.map((file) => [file.path, file.text]), [
    accepted("ARC-002", "architecture-decision", A(2, "desk"), ARC2), accepted("MOD-counter", "module", M("counter"), MOD_COUNTER),
    recordOf("MOD-shelf", "module", M("shelf"), EMPTY)]);
  await until(target, () => byClass(target, "p", "nothing").length === 1, "the page drawn again");
  assert.deepEqual(filesOf(target), []);
});

// TST-730005 · level: unit · module: MOD-review-pages
// guards: UC-023; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// given: the same restructuring in which MOD-shelf's file stands, accepted — nothing is removed —, and a token; the known positive is TST-730004's page, where MOD-shelf is removed
// input: the route decision rendered with the id all
// expect: the sections ARC-002 and MOD-counter alone; the button "Accept all 2 shown"; no readHistory of a record of MOD-shelf — the page reads no last accepted text for a file that is not removed —, where the known positive reads one
test("MOD-review-pages decision/all — where nothing is removed, no removed file is shown and no last accepted text is read for one", async () => {
  const fake = fakeHost({ removed: false });
  const target = await show(fake);

  assert.deepEqual(filesOf(target), ["ARC-002", "MOD-counter"]);
  assert.equal(byClass(target, "button", "accept-all")[0].textContent, "Accept all 2 shown");
  assert.deepEqual(shelfRecords(fake.histories()), [], "no last accepted text of MOD-shelf");
  const positive = fakeHost();
  await show(positive);
  assert.equal(shelfRecords(positive.histories()).length, 1, "known positive: with MOD-shelf removed, its one record's history is read");
});
