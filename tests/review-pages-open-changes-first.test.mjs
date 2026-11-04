// MOD-review-pages' lists of the use cases and of the architecture show the open and changed files first, and only while there are any, then every file
// (ITM-879), as the accepted text of docs/architecture/MOD-review-pages.md states it for `<k>`: "first, only while a file of the kind is open or changed since
// acceptance, those files, each with its status and a tick, and no such part where none is; then every file of the kind with its status — open, accepted, changed
// since acceptance —". UC-008 step 1 lists every use case with its status; UC-008 3d gives each use case read a tick.
// Run: node --test tests/review-pages-open-changes-first.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-008; UC-023; STATUS IS DERIVED FROM THE RECORDS; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// Level: unit
//
// This imports the browser harness of tests/review-pages-harness.mjs unchanged. The repository is a Host of the tests' own over one repository in memory with a
// history, keeping to MOD-repository-hosts' interface. The real MOD-approvals, MOD-documents and MOD-browser-store run as they are. Nothing reaches the network.
// Readings the test takes where the module file leaves one open:
//   - The first part is <section class="open-changes"> holding a table of the files that are open or changed since acceptance, in the order of their identifiers, each row with
//     its status and, with a token, a tick for a file whose page was shown in this tab. It stands before the table of every file, which lists every file with its status and no tick, as the ticks stand in the first part.
//   - Without a token the first part is shown the same, without ticks.
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
const UC42 = useCase("UC-042", "Extend a loan", "The member extends a loan once.");
const UC43_OLD = useCase("UC-043", "Return a book", "The member returns a book at the desk.");
const UC43 = useCase("UC-043", "Return a book", "The member returns a book and the card at the desk.");
const UC44 = useCase("UC-044", "Reserve a book", "The member reserves a book that is out.");
const UC45 = useCase("UC-045", "Renew a card", "The member renews the card for a year.");
const UC_PATH = { 41: "docs/use-cases/UC-041-check-out-a-book.md", 42: "docs/use-cases/UC-042-extend-a-loan.md", 43: "docs/use-cases/UC-043-return-a-book.md",
  44: "docs/use-cases/UC-044-reserve-a-book.md", 45: "docs/use-cases/UC-045-renew-a-card.md" };
const UC_FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [UC_PATH[41]]: UC41, [UC_PATH[42]]: UC42, [UC_PATH[43]]: UC43_OLD, [UC_PATH[44]]: UC44, [UC_PATH[45]]: UC45 };
// UC-041 and UC-044 open, UC-043 changed since its earlier text was accepted, UC-042 and UC-045 accepted.
const USE_CASES_MIXED = [UC_FILES,
  Object.fromEntries([recordOf("UC-042", "use-case", UC_PATH[42], UC42), recordOf("UC-043", "use-case", UC_PATH[43], UC43_OLD), recordOf("UC-045", "use-case", UC_PATH[45], UC45)]),
  { [UC_PATH[43]]: UC43 }];
// Every use case accepted at its current text.
const USE_CASES_ACCEPTED = [{ ...UC_FILES, [UC_PATH[43]]: UC43 },
  Object.fromEntries([[41, UC41], [42, UC42], [43, UC43], [44, UC44], [45, UC45]].map(([n, body]) => recordOf(`UC-0${n}`, "use-case", UC_PATH[n], body)))];

const DIAGRAM = ["", "```mermaid", "flowchart LR", "    Desk --> Shelf", "```", ""];
const decision = ({ id, title, refines = null, designs = [], sentence = "The desk and the shelf are two modules." }) =>
  text("---", `id: ${id}`, `title: ${title}`, ...(refines ? [`refines: ${refines}`] : []), "forced_by:", `  - ${RULE}`,
    ...(designs.length ? ["designs:", ...designs.map((name) => `  - ${name}`)] : []), "---", `# ${id} ${title}`, "", "## Context", "", "Books are lent at a desk.", "",
    "## Decision", "", sentence, ...DIAGRAM, "## Alternatives", "", "One module.", "", "## Consequences", "", "Two folders.");
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
const ARCH_FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [A(1, "lending")]: ARC1, [A(2, "desk")]: ARC2, [A(3, "shelf")]: ARC3_OLD,
  [M("desk")]: MOD_DESK, [M("shelf")]: MOD_SHELF, [M("queue")]: MOD_QUEUE };
// ARC-001 and MOD-shelf accepted, ARC-003 accepted at an earlier text and edited since, ARC-002, MOD-desk and MOD-queue open.
const ARCHITECTURE_MIXED = [ARCH_FILES,
  Object.fromEntries([recordOf("ARC-001", "architecture-decision", A(1, "lending"), ARC1), recordOf("ARC-003", "architecture-decision", A(3, "shelf"), ARC3_OLD),
    recordOf("MOD-shelf", "module", M("shelf"), MOD_SHELF)]),
  { [A(3, "shelf")]: ARC3 }];
// Every decision and module accepted at its current text.
const ARCHITECTURE_ACCEPTED = [{ ...ARCH_FILES, [A(3, "shelf")]: ARC3 },
  Object.fromEntries([recordOf("ARC-001", "architecture-decision", A(1, "lending"), ARC1), recordOf("ARC-002", "architecture-decision", A(2, "desk"), ARC2),
    recordOf("ARC-003", "architecture-decision", A(3, "shelf"), ARC3), recordOf("MOD-desk", "module", M("desk"), MOD_DESK), recordOf("MOD-shelf", "module", M("shelf"), MOD_SHELF),
    recordOf("MOD-queue", "module", M("queue"), MOD_QUEUE)])];

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

async function show(name, steps, { token = true, params = {}, host = fakeHost(steps) } = {}) {
  const route = pages.view?.routes.find((candidate) => candidate.name === name);
  assert.ok(route, `the route ${name}: ${pages.error?.message}`);
  const store = openStore(token ? "alice/agent-m" : "nobody/agent-m");
  if (token) writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
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
const idsOf = (root) => elements(root).filter((node) => node.localName === "tr" && node.getAttribute("data-id")).map((row) => row.getAttribute("data-id"));
const ticksOf = (root) => elements(root).filter((node) => node.localName === "input" && classesOf(node).includes("tick")).length;
const openPartsOf = (target) => elements(target).filter((node) => node.localName === "section" && classesOf(node).includes("open-changes"));
// The table of every file: the table of the list that is not in the first part.
const wholeListOf = (target) => elements(target).filter((node) => node.localName === "table" && !openPartsOf(target).some((part) => elements(part).includes(node)))[0];
const statusesOf = (root) => elements(root).filter((node) => node.localName === "tr" && node.getAttribute("data-id"))
  .map((row) => elements(row).find((node) => node.localName === "span" && classesOf(node).includes("badge")).textContent);
// What a list shows, as strings, numbers and booleans only: the files of the first part with their statuses and its ticks, those of the whole list with theirs and its ticks,
// and whether the first part stands before the whole list.
function shownBy(target) {
  const [part] = openPartsOf(target), whole = wholeListOf(target), order = elements(target);
  return { parts: openPartsOf(target).length, open: part ? idsOf(part) : [], openStatuses: part ? statusesOf(part) : [], openTicks: part ? ticksOf(part) : 0,
    whole: idsOf(whole), wholeStatuses: statusesOf(whole), wholeTicks: ticksOf(whole), partBeforeWhole: part ? order.indexOf(part) < order.indexOf(whole) : null };
}

// ---------------------------------------------------------------- the use cases

// TST-879001 · level: unit · module: MOD-review-pages
// guards: UC-008; STATUS IS DERIVED FROM THE RECORDS
// given: the use cases UC-041 and UC-044 open, UC-043 changed since acceptance, UC-042 and UC-045 accepted; a token
// input: the route use-case drawn as the list; the page of UC-043 drawn; the list drawn again
// expect: one first part, before the whole list, holding UC-041, UC-043, UC-044 with the statuses open, changed since acceptance, open and a tick on each, whether a page was shown or not; the whole list holds UC-041 to UC-045 with their statuses and no tick; after the page of UC-043 the first part still holds three ticks
test("TST-879001 use-case list — the open and changed use cases first, each with a tick, then every use case", async () => {
  assert.deepEqual(shownBy(await show("use-case", USE_CASES_MIXED)), { parts: 1, open: ["UC-041", "UC-043", "UC-044"], openStatuses: ["open", "changed since acceptance", "open"],
    openTicks: 3, whole: ["UC-041", "UC-042", "UC-043", "UC-044", "UC-045"], wholeStatuses: ["open", "accepted", "changed since acceptance", "open", "accepted"], wholeTicks: 0,
    partBeforeWhole: true });
  const host = fakeHost(USE_CASES_MIXED);
  await show("use-case", USE_CASES_MIXED, { host, params: { id: "UC-043" } });
  assert.equal(shownBy(await show("use-case", USE_CASES_MIXED, { host })).openTicks, 3, "every use case not accepted still has a tick after a page was shown");
});

// TST-879002 · level: unit · module: MOD-review-pages
// guards: UC-008; STATUS IS DERIVED FROM THE RECORDS
// given: every use case accepted at its current text
// input: the route use-case drawn as the list
// expect: no first part; the whole list holds UC-041 to UC-045, each accepted, with no tick
test("TST-879002 use-case list — with every use case accepted there is no first part", async () => {
  assert.deepEqual(shownBy(await show("use-case", USE_CASES_ACCEPTED)), { parts: 0, open: [], openStatuses: [], openTicks: 0, whole: ["UC-041", "UC-042", "UC-043", "UC-044", "UC-045"],
    wholeStatuses: ["accepted", "accepted", "accepted", "accepted", "accepted"], wholeTicks: 0, partBeforeWhole: null });
});

// TST-879003 · level: unit · module: MOD-review-pages
// guards: UC-008
// given: the same use cases, no token stored
// input: the route use-case drawn as the list
// expect: the first part holds UC-041, UC-043, UC-044 and no tick; the whole list holds all five
test("TST-879003 use-case list without a token — the first part is shown, without ticks", async () => {
  const shown = shownBy(await show("use-case", USE_CASES_MIXED, { token: false }));
  assert.deepEqual([shown.parts, shown.open, shown.openTicks, shown.whole.length], [1, ["UC-041", "UC-043", "UC-044"], 0, 5]);
});

// ---------------------------------------------------------------- the architecture

// TST-879004 · level: unit · module: MOD-review-pages
// guards: UC-023; STATUS IS DERIVED FROM THE RECORDS
// given: the decisions ARC-002 open, ARC-003 changed, ARC-001 accepted; the modules MOD-desk and MOD-queue open, MOD-shelf accepted; a token
// input: the route decision drawn as the list; the route module drawn as the list; the pages of ARC-003 and of MOD-desk drawn; both lists drawn again
// expect: decisions: a first part before the whole list holding ARC-002, ARC-003 (open, changed since acceptance) with a tick each, the whole list ARC-001 to ARC-003 with no tick; modules: the first part MOD-desk, MOD-queue (open, open) with a tick each, the whole list MOD-desk, MOD-queue, MOD-shelf with no tick; after the pages, still a tick on each file of the first part
test("TST-879004 decision and module lists — the open and changed files first, each with a tick, then every file", async () => {
  assert.deepEqual(shownBy(await show("decision", ARCHITECTURE_MIXED)), { parts: 1, open: ["ARC-002", "ARC-003"], openStatuses: ["open", "changed since acceptance"], openTicks: 2,
    whole: ["ARC-001", "ARC-002", "ARC-003"], wholeStatuses: ["accepted", "open", "changed since acceptance"], wholeTicks: 0, partBeforeWhole: true });
  assert.deepEqual(shownBy(await show("module", ARCHITECTURE_MIXED)), { parts: 1, open: ["MOD-desk", "MOD-queue"], openStatuses: ["open", "open"], openTicks: 2,
    whole: ["MOD-desk", "MOD-queue", "MOD-shelf"], wholeStatuses: ["open", "open", "accepted"], wholeTicks: 0, partBeforeWhole: true });
  const host = fakeHost(ARCHITECTURE_MIXED);
  await show("decision", ARCHITECTURE_MIXED, { host, params: { id: "ARC-003" } });
  await show("module", ARCHITECTURE_MIXED, { host, params: { id: "MOD-desk" } });
  assert.equal(shownBy(await show("decision", ARCHITECTURE_MIXED, { host })).openTicks, 2, "every decision not accepted has a tick");
  assert.equal(shownBy(await show("module", ARCHITECTURE_MIXED, { host })).openTicks, 2, "every module not accepted has a tick");
});

// TST-879005 · level: unit · module: MOD-review-pages
// guards: UC-023; STATUS IS DERIVED FROM THE RECORDS
// given: every decision and module accepted at its current text
// input: the route decision drawn as the list; the route module drawn as the list
// expect: no first part on either; the whole lists hold ARC-001 to ARC-003 and MOD-desk, MOD-queue, MOD-shelf, each accepted
test("TST-879005 decision and module lists — with every file accepted there is no first part", async () => {
  const decisions = shownBy(await show("decision", ARCHITECTURE_ACCEPTED)), modules = shownBy(await show("module", ARCHITECTURE_ACCEPTED));
  assert.deepEqual([decisions.parts, decisions.whole, decisions.wholeStatuses], [0, ["ARC-001", "ARC-002", "ARC-003"], ["accepted", "accepted", "accepted"]]);
  assert.deepEqual([modules.parts, modules.whole, modules.wholeStatuses], [0, ["MOD-desk", "MOD-queue", "MOD-shelf"], ["accepted", "accepted", "accepted"]]);
});
