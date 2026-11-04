// MOD-review-pages' lists give each tick box the name of the file it accepts, and the box of a difference, which scrolls, can be reached with the keyboard (ITM-921),
// as THE SITE SERVES A SCREEN READER asks of every page: "every control has an accessible name" and a page that meets WCAG 2.2 at level AA, whose rule `label` asks every
// form control for a name and whose rule `scrollable-region-focusable` asks a box that scrolls to be reachable by keyboard. The accepted text of
// docs/architecture/MOD-review-pages.md states the list for `<k>`: "those files, each with its status and a tick", and the difference for `<k>/<id>`: "in a box of its own
// that scrolls". UC-008 3d gives each use case not accepted a tick: "Each use case not accepted has an empty tick box on the list, read or not; the reviewer ticks the ones to accept".
// Run: node --test tests/review-pages-accessible-names.test.mjs
//
// Module: MOD-review-pages
// Guards: THE SITE SERVES A SCREEN READER; UC-008; UC-023
// Level: unit
//
// This imports the browser harness of tests/review-pages-harness.mjs unchanged. The repository is a Host of the tests' own over one repository in memory with a history,
// keeping to MOD-repository-hosts' interface. The real MOD-approvals, MOD-documents and MOD-browser-store run as they are. Nothing reaches the network. Readings the test
// takes where the texts leave one open:
//   - "An accessible name" of a tick is read as a browser computes it for a checkbox in a table cell, from the two sources the page can give it: its `aria-label`, else
//     the text of the <label> it stands in. A tick names "the file it accepts" when that name holds the identifier of the row's file (the row's `data-id`).
//   - "A box that scrolls can be reached with the keyboard" is read as axe-core's rule reads it: the box takes the focus, that is, it carries `tabindex="0"`.
//   - The box of a difference is the <pre class="diff"> of the page of one changed file; the texts name it as the review page's "box of its own that scrolls".
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the pull request.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));

// ---------------------------------------------------------------- the repository

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };
const recordOf = (id, kind, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text(`kind: ${kind}`, `file: ${path}`, `blob: ${blobOf(body)}`)];

const RULE = "A LOAN HAS A DUE DATE";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`,
  "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");

const useCase = (id, title, sentence) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:", `  - ${RULE}`,
  "---", `# ${id} ${title}`, "", `**Goal.** ${sentence}`);
const UC41 = useCase("UC-041", "Check out a book", "The member borrows a book at the desk.");
const UC43_OLD = useCase("UC-043", "Return a book", "The member returns a book at the desk.");
const UC43 = useCase("UC-043", "Return a book", "The member returns a book and the card at the desk.");
const UC44 = useCase("UC-044", "Reserve a book", "The member reserves a book that is out.");
const UC_PATH = { 41: "docs/use-cases/UC-041-check-out-a-book.md", 43: "docs/use-cases/UC-043-return-a-book.md", 44: "docs/use-cases/UC-044-reserve-a-book.md" };
// UC-041 and UC-044 open, UC-043 changed since its earlier text was accepted.
const USE_CASES = [{ "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [UC_PATH[41]]: UC41, [UC_PATH[43]]: UC43_OLD, [UC_PATH[44]]: UC44 },
  Object.fromEntries([recordOf("UC-043", "use-case", UC_PATH[43], UC43_OLD)]),
  { [UC_PATH[43]]: UC43 }];

const decision = ({ id, title, refines = null, designs = [], sentence = "The desk and the shelf are two modules." }) =>
  text("---", `id: ${id}`, `title: ${title}`, ...(refines ? [`refines: ${refines}`] : []), "forced_by:", `  - ${RULE}`,
    ...(designs.length ? ["designs:", ...designs.map((name) => `  - ${name}`)] : []), "---", `# ${id} ${title}`, "", "## Context", "", "Books are lent at a desk.", "",
    "## Decision", "", sentence, "", "## Alternatives", "", "One module.", "", "## Consequences", "", "Two folders.");
const module_ = (id, title) => text("---", `id: ${id}`, `title: ${title}`, "folder: src/lending/", "realises:", `  - ${RULE}`,
  "follows:", "  - ARC-001", "uses:", "provides:", "  - lend", "---", `# ${id} ${title}`, "", "## Responsibility", "", "It lends a book.", "", "## Parts", "", "- `index.mjs`", "",
  "## Data", "", "Nothing.", "", "## Interfaces", "", "- `lend`", "", "## Files", "", "None.", "", "## Uses", "", "Nothing.");
const A = (n, slug) => `docs/architecture/ARC-00${n}-${slug}.md`;
const M = (slug) => `docs/architecture/MOD-${slug}.md`;
const ARC1 = decision({ id: "ARC-001", title: "Lending as a whole" });
const ARC2 = decision({ id: "ARC-002", title: "The desk", refines: "ARC-001", designs: ["MOD-desk"] });
const ARC3_OLD = decision({ id: "ARC-003", title: "The shelf", refines: "ARC-001", designs: ["MOD-shelf"], sentence: "Books stand on a shelf." });
const ARC3 = decision({ id: "ARC-003", title: "The shelf", refines: "ARC-001", designs: ["MOD-shelf"], sentence: "Books stand on a shelf by their number." });
const MOD_DESK = module_("MOD-desk", "The desk"), MOD_SHELF = module_("MOD-shelf", "The shelf"), MOD_QUEUE = module_("MOD-queue", "The queue");
// ARC-001 and MOD-shelf accepted, ARC-003 accepted at an earlier text and edited since, ARC-002, MOD-desk and MOD-queue open.
const ARCHITECTURE = [{ "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [A(1, "lending")]: ARC1, [A(2, "desk")]: ARC2, [A(3, "shelf")]: ARC3_OLD,
  [M("desk")]: MOD_DESK, [M("shelf")]: MOD_SHELF, [M("queue")]: MOD_QUEUE },
Object.fromEntries([recordOf("ARC-001", "architecture-decision", A(1, "lending"), ARC1), recordOf("ARC-003", "architecture-decision", A(3, "shelf"), ARC3_OLD),
  recordOf("MOD-shelf", "module", M("shelf"), MOD_SHELF)]),
{ [A(3, "shelf")]: ARC3 }];

function fakeHost(steps) {
  const commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made}`).digest("hex");
    commits.set(sha, { tree, parent, date: `2026-10-0${made}T10:00:00Z` });
    return sha;
  };
  for (const files of steps) head = commitOf(new Map([...(head ? commits.get(head).tree : []), ...Object.entries(files)]), head);
  const snapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return { repository: ON_GITHUB, ref: sha, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  return {
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
  };
}

// ---------------------------------------------------------------- the page

async function show(name, steps, params = {}, host = fakeHost(steps)) {
  const route = pages.view?.routes.find((candidate) => candidate.name === name);
  assert.ok(route, `the route ${name}: ${pages.error?.message}`);
  const store = openStore("alice/agent-m");
  writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { page: "review", instance: { repository: "alice/agent-m", host }, store, go() {},
    product: { address: ON_GITHUB.web, kind: "github", host } }, params);
  return target;
}
function elements(root) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { found.push(kid); walk(kid); } } })(root);
  return found;
}
const classesOf = (node) => node.className.split(" ").filter(Boolean);
const rowOf = (node) => { let at = node; while (at && at.localName !== "tr") at = at.parentNode; return at; };
const labelOf = (node) => { let at = node.parentNode; while (at && at.localName !== "label") at = at.parentNode; return at; };
// What a browser takes as the accessible name of a checkbox: its aria-label, else the text of the label it stands in.
const nameOf = (box) => (box.getAttribute("aria-label") ?? labelOf(box)?.textContent ?? "").trim();
// The ticks of a page, each as the identifier of its row and whether its name holds that identifier: strings and booleans only.
const ticksOf = (root) => elements(root).filter((node) => node.localName === "input" && classesOf(node).includes("tick"))
  .map((box) => { const id = rowOf(box).getAttribute("data-id"); return { id, named: nameOf(box).includes(id) }; });

// ---------------------------------------------------------------- the ticks

// TST-921001 · level: unit · module: MOD-review-pages
// guards: THE SITE SERVES A SCREEN READER; UC-008
// given: the use cases UC-041 and UC-044 open, UC-043 changed since acceptance; a token
// input: the pages of UC-041, UC-043 and UC-044 drawn; the route use-case drawn as the list
// expect: three ticks, in the rows UC-041, UC-043 and UC-044, each named by a name that holds the identifier of its row
test("TST-921001 use-case list — each tick is named by the file it accepts", async () => {
  const host = fakeHost(USE_CASES);
  for (const id of ["UC-041", "UC-043", "UC-044"]) await show("use-case", USE_CASES, { id }, host);
  assert.deepEqual(ticksOf(await show("use-case", USE_CASES, {}, host)), [{ id: "UC-041", named: true }, { id: "UC-043", named: true }, { id: "UC-044", named: true }]);
});

// TST-921002 · level: unit · module: MOD-review-pages
// guards: THE SITE SERVES A SCREEN READER; UC-023
// given: the decisions ARC-002 open and ARC-003 changed; the modules MOD-desk and MOD-queue open; a token
// input: the pages of ARC-002, ARC-003, MOD-desk and MOD-queue drawn; the route decision drawn as the list; the route module drawn as the list
// expect: decisions: two ticks, in the rows ARC-002 and ARC-003; modules: two ticks, in the rows MOD-desk and MOD-queue; every tick named by a name that holds the identifier of its row
test("TST-921002 decision and module lists — each tick is named by the file it accepts", async () => {
  const host = fakeHost(ARCHITECTURE);
  for (const id of ["ARC-002", "ARC-003"]) await show("decision", ARCHITECTURE, { id }, host);
  for (const id of ["MOD-desk", "MOD-queue"]) await show("module", ARCHITECTURE, { id }, host);
  assert.deepEqual(ticksOf(await show("decision", ARCHITECTURE, {}, host)), [{ id: "ARC-002", named: true }, { id: "ARC-003", named: true }]);
  assert.deepEqual(ticksOf(await show("module", ARCHITECTURE, {}, host)), [{ id: "MOD-desk", named: true }, { id: "MOD-queue", named: true }]);
});

// ---------------------------------------------------------------- the box of a difference

// TST-921003 · level: unit · module: MOD-review-pages
// guards: THE SITE SERVES A SCREEN READER; UC-008
// given: ARC-003 changed since acceptance
// input: the route decision drawn for ARC-003
// expect: one box of a difference (<pre class="diff">), and its tabindex is "0": the box that scrolls takes the focus
test("TST-921003 decision/<id> — the box of the difference takes the focus", async () => {
  const boxes = elements(await show("decision", ARCHITECTURE, { id: "ARC-003" })).filter((node) => node.localName === "pre" && classesOf(node).includes("diff"));
  assert.deepEqual(boxes.map((box) => box.getAttribute("tabindex")), ["0"]);
});

// TST-921004 · level: unit · module: MOD-review-pages
// guards: THE SITE SERVES A SCREEN READER; UC-023
// given: ARC-003 changed since acceptance, ARC-002 and the modules new
// input: the route decision drawn with the id all (the whole architecture)
// expect: every box of a difference on the page has tabindex "0", and the page has at least one box (the known positive: ARC-003's)
test("TST-921004 decision/all — every box of a difference takes the focus", async () => {
  const boxes = elements(await show("decision", ARCHITECTURE, { id: "all" })).filter((node) => node.localName === "pre" && classesOf(node).includes("diff"));
  assert.deepEqual([boxes.length > 0, boxes.every((box) => box.getAttribute("tabindex") === "0")], [true, true]);
});
