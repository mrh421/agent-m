// The harness of the system and release tests of UC-021 (Group artifacts into a hierarchy): a fixture product whose files hold a SPEC of four requirements, use cases, two architecture decisions, two module files and two test files,
// and the group files of its kinds; the pages are the real routes `arrange` and `use-case` of MOD-review-pages and `trace` of MOD-trace-pages, and the dashboard's own page, drawn over the real MOD-repository-hosts host of
// GitHub (or of a GitLab server), the real MOD-artifact-edits, MOD-group-document and MOD-trace-graph, behind the fixture servers of tests/uc-008-harness.mjs (GitHub's API and raw host, a GitLab server, one model endpoint).
// No request leaves the process. It holds no test and no expected result: what it builds are inputs, and every test states its own expected values.
// Imported by tests/system-uc-021-group-artifacts-into-a-hierarchy.test.mjs and tests/release-uc-021-group-artifacts-into-a-hierarchy.test.mjs.
//
// Module: MOD-review-pages
// Module: MOD-artifact-edits
// Module: MOD-group-document
// Module: MOD-trace-pages
// Level: system
//
// Authored by developer-sonnet-j (ITM-738), who implemented none of ITM-722, ITM-723, ITM-726, ITM-727 and ITM-737 and no UC-021 production behaviour.
//
// The product (alice/thesis-tool): the SPEC holds A LOAN HAS A DUE DATE, A BOOK CAN BE RETURNED, A LOAN CAN BE EXTENDED ONCE and A BOOK STANDS ON A SHELF; the use cases are UC-041 and UC-044 (no record: open), UC-042 (a record
// names its current text: accepted) and UC-043 (a record names an earlier text: changed since acceptance); ARC-001 and ARC-002; MOD-shelf and MOD-reader; tests/loan.test.mjs declares TST-101 and TST-102, tests/shelf.test.mjs
// TST-103. A world has no group file until a test lays one over it with `files`.

import { P41, P42, P43, P44, UC41, UC42, UC43, UC44, byClass as classed, find as found, text, until, world } from "./uc-008-harness.mjs";
import { storedGraphBytes } from "./stored-graph-fake.mjs";
import { view as traceView } from "../src/trace-pages/index.mjs";
import { view as reviewView } from "../src/review-pages/index.mjs";

export { byClass, find, until, click, scripted, badgeOf, buttonsNamed, idsIn, rowOf, linksOf, withProduct, blobOf, text, TOKENS, world, P41, P42, P43, P44 } from "./uc-008-harness.mjs";

// ---------------------------------------------------------------- the files of the product

export const LOAN_DATE = "A LOAN HAS A DUE DATE", BOOK_RETURN = "A BOOK CAN BE RETURNED", LOAN_EXTENSION = "A LOAN CAN BE EXTENDED ONCE", SHELF_PLACE = "A BOOK STANDS ON A SHELF";
export const SPEC = text("# Thesis tool — Specification", "", "## Lending", "",
  `**${LOAN_DATE}** *(Product Owner)*`, "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`", "",
  `**${BOOK_RETURN}** *(Product Owner)*`, "A returned book is back on the shelf.", "*Check:* no automatic check; at review", "",
  `**${LOAN_EXTENSION}** *(Product Owner)*`, "A member extends a loan once.", "*Check:* `tests/loan.test.mjs`", "",
  `**${SHELF_PLACE}** *(Product Owner)*`, "Every book has a shelf place.", "*Check:* `tests/shelf.test.mjs`");
const ARC_1 = text("---", "id: ARC-001", "title: The desk", "forced_by:", `  - ${LOAN_DATE}`, "---", "# ARC-001 The desk", "", "## Context", "", "A desk.", "", "## Decision", "", "One desk.", "", "## Alternatives", "", "None.",
  "", "## Consequences", "", "None.");
const ARC_2 = text("---", "id: ARC-002", "title: The shelves", "forced_by:", `  - ${SHELF_PLACE}`, "refines:", "  - ARC-001", "designs:", "  - MOD-shelf", "---", "# ARC-002 The shelves", "", "## Context", "", "Shelves.",
  "", "## Decision", "", "Many shelves.", "", "## Alternatives", "", "None.", "", "## Consequences", "", "None.");
const moduleFile = (id, title, folder, rule) => text("---", `id: ${id}`, `title: ${title}`, `folder: ${folder}`, "realises:", `  - ${rule}`, "follows:", "  - ARC-002", "provides:", "  - run", "---", `# ${id} ${title}`, "",
  "## Responsibility", "", "One thing.");
const testFile = (...cases) => text(...cases.flatMap(([id, mod, rule]) => [`// TST-${id} · level: unit · module: ${mod}`, `// guards: ${rule}`, "// given: a fixture", "// input: a call", "// expect: a result", `test("case ${id}", () => {});`, ""]));
export const PATHS = { arc1: "docs/architecture/ARC-001-the-desk.md", arc2: "docs/architecture/ARC-002-the-shelves.md", shelf: "docs/architecture/MOD-shelf.md", reader: "docs/architecture/MOD-reader.md",
  loanTest: "tests/loan.test.mjs", shelfTest: "tests/shelf.test.mjs" };
/** The files of the product that are no group file: the files whose bytes a regrouping leaves as they are. */
export const ARTIFACTS = () => ({ "SPEC.md": SPEC, [P41]: UC41, [P42]: UC42, [P43]: UC43, [P44]: UC44, [PATHS.arc1]: ARC_1, [PATHS.arc2]: ARC_2,
  [PATHS.shelf]: moduleFile("MOD-shelf", "Shelving a book", "src/shelf/", SHELF_PLACE), [PATHS.reader]: moduleFile("MOD-reader", "Reading a book", "src/reader/", LOAN_DATE),
  [PATHS.loanTest]: testFile(["101", "MOD-reader", LOAN_DATE], ["102", "MOD-reader", LOAN_EXTENSION]), [PATHS.shelfTest]: testFile(["103", "MOD-shelf", SHELF_PLACE]) });

/** The group file of `kind`, written as MOD-group-document defines it: its title line, the line saying what it arranges, then the nested list of the lines given. */
export function groupFile(kind, ...list) {
  const [title, arranges, by] = { requirements: ["Requirements", "requirements", "name"], "use-cases": ["Use cases", "use cases", "identifier"], architecture: ["Architecture decisions", "architecture decisions", "identifier"],
    modules: ["Modules", "modules", "identifier"], tests: ["Tests", "tests", "identifier"] }[kind];
  return text(`# ${title} — groups`, "", `The hierarchy of the ${arranges}, each member by its ${by}.`, ...(list.length ? ["", ...list] : []));
}
export const GROUP_PATH = (kind) => `docs/groups/${kind}.md`;
/** The use cases under Review (UC-041, UC-042) and Derivation (UC-043, UC-099, which matches no use case); UC-044 in no group. */
export const USE_CASE_GROUPS = groupFile("use-cases", "- Review", "  - UC-041", "  - UC-042", "- Derivation", "  - UC-043", "  - UC-099");

/**
 * grouped({ ...worldOptions, files }) -> a world of the product above, `files` laid over it (a path set to null is left out). The GitLab server of tests/uc-008-harness.mjs serves no branch trace-cache; a GitLab world
 * here answers the graph of its head from the files it holds, as the workflow "main changed" stores it, and is drawn by `drawn`, not by the world's own `draw`, whose install would undo that.
 */
export async function grouped({ files = {}, ...options } = {}) {
  const w = await world({ ...options, files: { ...ARTIFACTS(), ...files } });
  if (w.kind === "gitlab") {
    const routed = globalThis.fetch;
    globalThis.fetch = async (input, init = {}) => {
      const url = new URL(String(input));
      const stored = url.origin === "https://gitlab.example.org" && url.searchParams.get("ref") === "trace-cache" && /\/repository\/files\/([0-9a-f]{40})\.json\.gz\/raw$/.exec(url.pathname);
      if (!stored) return routed(input, init);
      const at = w.files();
      return new Response(await storedGraphBytes({ commit: stored[1], paths: Object.keys(at), read: async (path) => at[path] ?? null }), { status: 200 });
    };
  }
  return w;
}

let landings = 0;
/**
 * land(w, changed) -> another writer's commit on the default branch of the GitHub world `w`, each path of `changed` given its text, on a commit of its own. MOD-trace-graph's storedGraph keeps the graph of a commit for the length of
 * a test file (tests/app-harness.mjs, repoServer), and every world numbers its commits from the same start, so a landing first moves the branch on by as many commits as no earlier landing of the file did.
 */
export async function land(w, changed) {
  landings += 1;
  for (let burnt = 0; burnt < 5 * landings; burnt += 1) await w.land({ ".burnt": String(burnt) });
  await w.land(changed);
}

// ---------------------------------------------------------------- the browser's clipboard and the windows it opens

/** What the page put on the clipboard (`copied`) and the addresses it opened in a window (`opened`), in order. */
export const browser = { copied: [], opened: [] };
Object.defineProperty(globalThis, "navigator", { configurable: true, writable: true, value: { clipboard: { writeText: async (value) => { browser.copied.push(value); } } } });
Object.defineProperty(globalThis, "open", { configurable: true, writable: true, value: (url) => { browser.opened.push(url); } });

// ---------------------------------------------------------------- the pages

/** The route `trace` of MOD-trace-pages drawn for the world's product: the specification browser (or another view) at `ref`. */
export async function trace(w, params = { key: "specification", ref: "main" }) {
  const target = document.createElement("div");
  document.body.append(target);
  await traceView.routes.find((route) => route.name === "trace").render(target, w.context, params);
  await w.quiet();
  return target;
}

/** A route of the review pages drawn into a fresh target over the world's context, without the install of the world's own `draw` (see `grouped`). */
export async function drawn(w, name, params = {}) {
  const target = document.createElement("div");
  document.body.append(target);
  await reviewView.routes.find((route) => route.name === name).render(target, w.context, params);
  return target;
}

/** The arrangement of `kind` as a person draws it: the route `arrange` of the review pages. */
export const arrangement = (w, kind) => (w.kind === "gitlab" ? drawn(w, "arrange", { kind }) : w.draw({ kind }, "arrange"));

// ---------------------------------------------------------------- reading the arrangement

export const itemOf = (target, id) => classed(target, "li", "arrange-item").filter((node) => node.getAttribute("data-id") === id);
export const groupOf = (target, title) => classed(target, "li", "arrange-group").find((node) => node.getAttribute("data-title") === title);
export const marksOf = (node) => classed(node, "span", "mark").map((each) => each.textContent);
export const membersOf = (group) => classed(group, "li", "arrange-item").map((node) => node.getAttribute("data-id"));
/** The ids of the items that stand at the top level of the tree: in no group. */
export const topLevel = (target) => classed(target, "li", "arrange-item").filter((node) => {
  for (let at = node.parentNode; at; at = at.parentNode) if (at.localName === "li" && String(at.className).split(" ").includes("arrange-group")) return false;
  return true;
}).map((node) => node.getAttribute("data-id"));
export const pending = (target) => classed(target, "li", "arrange-pending-item").map((node) => node.textContent);
export const refused = (target) => classed(target, "li", "arrange-refused-item").map((node) => node.textContent);
export const saveButton = (target) => classed(target, "button", "arrange-save")[0];
export const results = (target) => classed(target, "p", "arrange-result").map((node) => node.textContent);
export const textOf = (node) => String(node.textContent).replace(/\s+/g, " ").trim();

/** A select's option by its label; choosing it sets the select's value. */
export function choose(select, label) {
  const option = found(select, (node) => node.localName === "option" && node.textContent === label)[0];
  if (!option) throw new Error(`the select offers "${label}": ${found(select, (node) => node.localName === "option").map((node) => node.textContent).join(" | ")}`);
  select.value = option.value;
}
/** "Move to …" of an item or a group: the target by its label, the person's click on the button. */
export function moveTo(node, label) {
  choose(classed(node, "select", "arrange-move")[0], label);
  classed(node, "button", "arrange-move-to")[0].dispatchEvent(new Event("click"));
}
/** A drag of an item or a group (`node`) onto a group or onto the tree (`onto`), as the browser's drag events make it. */
export function drag(node, onto) {
  const data = new Map();
  const transfer = { setData: (type, value) => data.set(type, value), getData: (type) => data.get(type) ?? "", effectAllowed: "", dropEffect: "" };
  node.dispatchEvent(Object.assign(new Event("dragstart"), { dataTransfer: transfer }));
  onto.dispatchEvent(Object.assign(new Event("drop"), { dataTransfer: transfer }));
}
/** The tree of the arrangement: the list a drop at the top level falls on. */
export const treeOf = (target) => classed(target, "ul", "arrange-tree")[0];
/** "+ Group": the title typed, the group put in `inside` (a label of the select; none: the top level), the person's click on the button. */
export function addGroup(target, title, inside = null) {
  classed(target, "input", "arrange-group-title")[0].value = title;
  if (inside) choose(classed(target, "select", "arrange-group-in")[0], inside);
  classed(target, "button", "arrange-new-group")[0].dispatchEvent(new Event("click"));
}
/**
 * propose(w, target, moves) -> { asked, panel, run, restore } — *Propose groups* on the arrangement `target`: the model endpoint ep1 answers `moves` (as the draft of the kind propose-groups) and keeps each request body in
 * `asked`; the participant drafter-a is chosen and *Propose groups* pressed, which shows the run panel `panel`; `run()` is the person's click on its Run and waits until the answer has been drawn; `restore()` puts the fetch back.
 */
export async function propose(w, target, moves) {
  const asked = [], before = globalThis.fetch;
  globalThis.fetch = async (input, init = {}) => {
    if (String(input?.url ?? input).startsWith("https://ep1.example.test")) {
      asked.push(String(init.body ?? ""));
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft: { moves }, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
        { status: 200, headers: { "content-type": "application/json" } });
    }
    return before(input, init);
  };
  const box = classed(target, "input", "participant").find((each) => each.value === "drafter-a");
  box.checked = true;
  box.dispatchEvent(new Event("change"));
  classed(target, "button", "arrange-propose-run")[0].dispatchEvent(new Event("click"));
  await until(() => classed(target, "section", "run-panel").length === 1, "the run panel");
  const panel = classed(target, "section", "run-panel")[0];
  const run = async () => {
    found(panel, (node) => node.localName === "button" && node.textContent === "Run")[0].dispatchEvent(new Event("click"));
    await until(() => asked.length === 1, "the model's request");
    await w.quiet();
  };
  return { asked, panel, run, restore: () => { globalThis.fetch = before; } };
}

/** The group file of `kind` as the product's default branch holds it now, or null. */
export const groupFileOf = (w, kind) => w.files()[GROUP_PATH(kind)] ?? null;
