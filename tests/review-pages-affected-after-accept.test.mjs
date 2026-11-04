// MOD-review-pages lists the affected modules after Accept (ITM-1334; UC-023 step 6), as the accepted text of docs/architecture/MOD-review-pages.md states it: "Once *Accept* has
// recorded changed or removed decision or module files, the page lists the modules of the impact lists it showed for them, each with the plan steps and backlog items of those
// lists that name it in the graph of the commit shown (`storedGraph`) (UC-023 step 6)."
// Run: node --test tests/review-pages-affected-after-accept.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-023; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged; the repository is a Host of this file's own over one repository in memory with a history, keeping
// to MOD-repository-hosts' interface, every commitFiles recorded; each snapshot serves the graph stored for its commit (tests/stored-graph-fake.mjs). The real MOD-approvals,
// MOD-documents, MOD-trace-graph and MOD-browser-store run as they are. Nothing reaches the network. The readings this file takes, which the pull request names:
//   - The list is <section class="affected-modules"> with an <li data-id="<module>"> for each module, in the order of the impact lists, reading "<module> — <items>", the
//     items joined by ", ".
//   - An item "names" a module as it does in the impact list (MOD-trace-graph's architectureImpact): by its `modules`, the graph's `changes` edge.
// The test states its input and its expected result before it runs. The counter-proof is recorded in the pull request.

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
const route = pages.view?.routes.find((candidate) => candidate.name === "module");

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/library-tool", web: "https://github.com/alice/library-tool" };
const TOKEN = { value: "github_pat_ALICElibraryTOOL0123456789abcdef", name: "Agent M · library-tool", expires: "2027-01-01" };

const RULE = "A LOAN HAS A DUE DATE";
const SPEC = text("# Library tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`,
  "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");
const ARC1_PATH = "docs/architecture/ARC-001-lending.md";
const ARC1 = text("---", "id: ARC-001", "title: Lending", "forced_by:", `  - ${RULE}`, "designs:", "  - MOD-sync", "  - MOD-desk", "  - MOD-report", "---",
  "# ARC-001 Lending", "", "## Context", "", "Books are lent.", "", "## Decision", "", "Three modules.", "", "## Alternatives", "", "One module.", "", "## Consequences", "", "Folders.");
const module_ = (id, folder, { uses = [], provides = [], interfaces = [] } = {}) => text("---", `id: ${id}`, `title: ${id} title`, `folder: ${folder}`,
  "realises:", `  - ${RULE}`, "follows:", "  - ARC-001", "uses:", ...uses.map((name) => `  - ${name}`), "provides:", ...provides.map((name) => `  - ${name}`), "---",
  `# ${id} ${id} title`, "", "## Responsibility", "", "It does one thing.", "", "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "",
  "## Interfaces", "", ...interfaces, "", "## Files", "", "None.", "", "## Uses", "", "Nothing.");
const item = (id, module) => text("---", `id: ${id}`, `title: ${id} title`, "level: module", "modules:", `  - ${module}`, "tests:", "  - unit", "---", `# ${id} ${id} title`);
const SYNC_PATH = "docs/architecture/MOD-sync.md";
const SYNC_INTERFACES = ["- `push(change)` - sends a change.", "- `pull(since)` - fetches the changes."];
const SYNC = module_("MOD-sync", "src/sync/", { provides: ["push", "pull"], interfaces: SYNC_INTERFACES });
// The change: the interface pull is removed.
const SYNC_WITHOUT_PULL = module_("MOD-sync", "src/sync/", { provides: ["push"], interfaces: [SYNC_INTERFACES[0]] });
const recordOf = (id, kind, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text(`kind: ${kind}`, `file: ${path}`, `blob: ${blobOf(body)}`)];

// Three commits: the architecture with a backlog item that names MOD-sync and a plan step that names MOD-desk; the records of ARC-001 and MOD-sync; MOD-sync changed.
const STEPS = [
  { "README.md": "# Library tool\n", "SPEC.md": SPEC, [ARC1_PATH]: ARC1, [SYNC_PATH]: SYNC,
    "docs/architecture/MOD-desk.md": module_("MOD-desk", "src/desk/", { uses: ["MOD-sync.pull"] }),
    "docs/architecture/MOD-report.md": module_("MOD-report", "src/report/", { uses: ["MOD-sync.push"] }),
    "docs/backlog/ITM-901-sync.md": item("ITM-901", "MOD-sync"), "docs/plan/ITM-902-desk.md": item("ITM-902", "MOD-desk"),
    "src/sync/index.mjs": "export const pull = () => [];\n", "src/desk/index.mjs": "export const desk = 1;\n" },
  Object.fromEntries([recordOf("ARC-001", "architecture-decision", ARC1_PATH, ARC1), recordOf("MOD-sync", "module", SYNC_PATH, SYNC)]),
  { [SYNC_PATH]: SYNC_WITHOUT_PULL },
];

// ---------------------------------------------------------------- the fake host

function fakeHost() {
  const writes = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made} of the file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree, parent, date: `2026-10-0${made}T10:00:00Z` });
    return sha;
  };
  for (const files of STEPS) head = commitOf(new Map([...(head ? commits.get(head).tree : []), ...Object.entries(files)]), head);
  const snapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return withStoredGraph({ repository: ON_GITHUB, ref: sha, commit: sha, paths: [...tree.keys()].sort(),
      read: async (path) => (tree.has(path) ? tree.get(path) : null), blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) });
  };
  return {
    writes,
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
        writes.push(structuredClone(change));
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((f) => [f.path, f.text])]), head);
        return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the page

async function show(fake) {
  assert.ok(route, `the route module: ${pages.error?.message}`);
  const store = openStore("alice/agent-m");
  writeSetting(store, "github-token:alice/library-tool", TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {},
    product: { address: ON_GITHUB.web, kind: "github", host: fake.host } }, { id: "MOD-sync" });
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true }));
// The line "Items — …" of the impact list: a <p class="small"> child of the section, not one under a module.
const itemsLine = (impact) => impact.childNodes.filter((node) => node.nodeType === 1 && node.localName === "p" && node.textContent.startsWith("Items")).map((node) => node.textContent);

// TST-1334001 · level: unit · module: MOD-review-pages
// guards: UC-023; AN ARCHITECTURE CHANGE IS NOT ACCEPTED WITHOUT AN IMPACT LIST
// given: MOD-sync accepted and changed since, so that it no longer provides pull, which MOD-desk uses; the backlog item ITM-901 names MOD-sync, the plan step ITM-902 names MOD-desk; a token
// input: the route module for MOD-sync; then a click on Accept
// expect: known positive — before Accept the impact list reads "Items — ITM-901, ITM-902"; the click makes one commit; then the page lists the affected modules: exactly "MOD-desk — ITM-902" and "MOD-sync — ITM-901", in this order. Counter-proof: on the base no module is listed after Accept
test("module/<id> — after Accept the affected modules are listed, each with the plan step or backlog item that names it", async () => {
  const fake = fakeHost();
  const target = await show(fake);
  const [impact] = byClass(target, "section", "change-impact");
  assert.ok(impact, "the impact list before Accept");
  assert.deepEqual(itemsLine(impact), ["Items — ITM-901, ITM-902"], "known positive: before Accept the impact list names both items");
  assert.equal(byClass(target, "section", "affected-modules").length, 0, "nothing is listed before Accept");

  const [accept] = byClass(target, "button", "accept");
  click(accept);
  await until(target, () => fake.writes.length === 1 && byClass(target, "p", "result").length > 0, "the commit and the page drawn again");
  await until(target, () => byClass(target, "section", "affected-modules").length === 1, "the list of the affected modules");
  const [listed] = byClass(target, "section", "affected-modules");
  assert.deepEqual(find(listed, (node) => node.localName === "li").map((node) => [node.getAttribute("data-id"), node.textContent]),
    [["MOD-desk", "MOD-desk — ITM-902"], ["MOD-sync", "MOD-sync — ITM-901"]]);
});
