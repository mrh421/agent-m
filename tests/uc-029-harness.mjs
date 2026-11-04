// The harness of the system and release tests of UC-029 (Browse the tests of a product): one product, its default branch, two release tags and its branch `test-results`, served by a Host in memory
// (tests/trace-pages-harness.mjs' treeHost, with the commit of each ref, the tags, the links to the server and the server's answer for a run's log of this product), and the route `trace` of MOD-trace-pages
// called with the key "tests" as the frame calls it; and, for a product the browser reaches without a token, the frame itself (MOD-site-frame's startPage) over MOD-repository-hosts' real GitHub host,
// answered by tests/trace-pages-world.mjs' fake of fetch. Nothing reaches the network. It holds no test and no expected result: what it builds are inputs, and every test states its own expected values.
// Imported by tests/system-uc-029-browse-the-tests-of-a-product.test.mjs and tests/release-uc-029-browse-the-tests-of-a-product.test.mjs.
//
// Module: MOD-trace-pages
// Module: MOD-result-records
// Level: system
//
// Authored by developer-opus-f (ITM-774). The product https://github.com/acme/library:
//   - its SPEC holds LOANS ARE RECORDED, RETURNS CLOSE A LOAN and FINES ARE CAPPED; at the tag v2026.1.0 it held LATE FEES APPLY too, withdrawn since;
//   - UC-001 realises LOANS ARE RECORDED, UC-002 RETURNS CLOSE A LOAN; the modules are MOD-fines and MOD-loans;
//   - its tests on main and at v2026.2.0: TST-101 (unit, MOD-loans; LOANS ARE RECORDED, UC-001; its counter-proof record names tester-a) and TST-102 (unit, MOD-fines; FINES ARE CAPPED) in
//     tests/loans/records.test.mjs; TST-103 (component; RETURNS CLOSE A LOAN) and TST-104 (unit; RETURNS CLOSE A LOAN, UC-002; 5 runs, the paid service Fixture AI) in tests/returns.test.mjs; TST-105
//     (release; LOANS ARE RECORDED, UC-001), TST-106 (release; LATE FEES APPLY) and TST-110 (release; UC-009, which no use case is) in tests/release.test.mjs; TST-107 (no level; LOANS ARE RECORDED) and TST-108
//     (unit; guards nothing) in tests/odd.test.mjs; and in tests/undeclared.test.mjs a test case whose comment lines name a level and a guarded requirement but no TST- identifier;
//   - its tests at v2026.1.0: TST-101 in tests/loans.test.mjs (LOANS ARE RECORDED alone), TST-103 and TST-104 in tests/returns.test.mjs, TST-105 (expecting "the loan is listed"), TST-106 and TST-109
//     (unit; LOANS ARE RECORDED) in tests/release.test.mjs;
//   - the history of main, newest first: HEAD; TAG2, the commit of v2026.2.0; OLD, which removed TST-109 from tests/release.test.mjs; TAG1, the commit of v2026.1.0. PULL is the head of a pull request,
//     never a commit of main;
//   - the branch `test-results`, newest record first: two records of HEAD (runs 5004 and 5003: TST-103 passed in one and failed in the other), one of PULL (run 5002), one of TAG2 (run 5001), one of OLD
//     (run 4002, whose log the server no longer keeps) and one of TAG1 (run 4001); the rows are in RECORDS below.

import { createHash } from "node:crypto";
import { doc, document, find, treeHost, until } from "./trace-pages-harness.mjs";
import { githubWorld, installBrowser } from "./trace-pages-world.mjs";

const { view } = await import("../src/trace-pages/index.mjs");
export const route = view.routes.find((candidate) => candidate.name === "trace");
export { document, find, until };

export const ADDRESS = "https://github.com/acme/library";
const sha = (name) => createHash("sha1").update(`uc-029 ${name}`).digest("hex");
export const HEAD = sha("head"), TAG2 = sha("v2026.2.0"), OLD = sha("old"), TAG1 = sha("v2026.1.0"), PULL = sha("pull");
export const TAGS = [{ name: "v2026.2.0", commit: TAG2 }, { name: "v2026.1.0", commit: TAG1 }];
const COMMITS = { main: HEAD, "v2026.2.0": TAG2, "v2026.1.0": TAG1 };
export const short = (commit) => commit.slice(0, 7);
export const runAddress = (id) => `${ADDRESS}/actions/runs/${id}`;

const lines = (...each) => [...each, ""].join("\n");
const rule = (name, text) => [`**${name}** *(Vibe Coding)*`, text, "*Check:* at review.", ""];
const SPEC_NOW = lines("# Library — Specification", "", "## Lending", "", ...rule("LOANS ARE RECORDED", "Every loan is recorded."), ...rule("RETURNS CLOSE A LOAN", "A return closes its loan."),
  ...rule("FINES ARE CAPPED", "A fine is capped."));
const SPEC_V1 = lines("# Library — Specification", "", "## Lending", "", ...rule("LOANS ARE RECORDED", "Every loan is recorded."), ...rule("RETURNS CLOSE A LOAN", "A return closes its loan."),
  ...rule("FINES ARE CAPPED", "A fine is capped."), ...rule("LATE FEES APPLY", "A late return costs a fee."));

// A declaration as MOD-test-document reads it, then its test case. `level` null leaves the level out, `guards` null the guards.
export function declared(id, { level = "unit", module = "system", guards = null, given = "a library", input = "a call", expect = "a result", runs = null, paid = null } = {}, title = id) {
  return lines(`// ${id}${level ? ` · level: ${level}` : ""} · module: ${module}`, ...(guards ? [`// guards: ${guards}`] : []), ...(runs ? [`// runs: ${runs}`, "// phrasings: 2"] : []),
    ...(paid ? [`// paid: ${paid}`] : []), `// given: ${given}`, `// input: ${input}`, `// expect: ${expect}`, `test("${title}", () => {});`);
}

const T101 = declared("TST-101", { module: "MOD-loans", guards: "LOANS ARE RECORDED; UC-001", given: "a library with one book", input: "the book is lent to a reader", expect: "one open loan names the reader" }, "a loan is recorded");
const T101_V1 = declared("TST-101", { module: "MOD-loans", guards: "LOANS ARE RECORDED", given: "a library with one book", input: "the book is lent to a reader", expect: "one open loan names the reader" }, "a loan is recorded");
const T102 = declared("TST-102", { module: "MOD-fines", guards: "FINES ARE CAPPED" }, "a fine stops at its cap");
const T103 = declared("TST-103", { level: "component", module: "MOD-loans", guards: "RETURNS CLOSE A LOAN" }, "a return closes the loan");
const T104 = declared("TST-104", { module: "MOD-loans", guards: "RETURNS CLOSE A LOAN; UC-002", runs: "5", paid: "Fixture AI" }, "the model names the overdue loans");
const T105 = declared("TST-105", { level: "release", guards: "LOANS ARE RECORDED; UC-001", expect: "the reader sees the loan" }, "a reader sees the loan");
const T105_V1 = declared("TST-105", { level: "release", guards: "LOANS ARE RECORDED; UC-001", expect: "the loan is listed" }, "a reader sees the loan");
const T106 = declared("TST-106", { level: "release", guards: "LATE FEES APPLY" }, "a late return costs a fee");
const T109 = declared("TST-109", { module: "MOD-loans", guards: "LOANS ARE RECORDED" }, "a loan has a due date");
const T110 = declared("TST-110", { level: "release", guards: "UC-009" }, "the catalogue is searched");
const UNDECLARED = lines("// level: unit · module: MOD-loans", "// guards: LOANS ARE RECORDED", "// given: a library", "// input: a call", "// expect: a result", 'test("a loan without its identifier", () => {});');

export const RELEASE_FILE = "tests/release.test.mjs";
const RELEASE_NOW = [T105, T106, T110].join("");
const RELEASE_V1 = [T105_V1, T106, T109].join("");
const COUNTER_PROOF = lines("---", "test: TST-101", `commit: ${OLD}`, "participant: tester-a", "date: 2026-10-09 10:00 UTC", "outcome: failed", "---", "", "## Fault", "",
  "The loan's reader is dropped.", "", "## Result", "", "It failed with the fault and passed without it.");

export const FILES = {
  "SPEC.md": SPEC_NOW,
  "docs/use-cases/UC-001-lend-a-book.md": doc("UC-001", "Lend a book", { realises: ["LOANS ARE RECORDED"] }),
  "docs/use-cases/UC-002-return-a-book.md": doc("UC-002", "Return a book", { realises: ["RETURNS CLOSE A LOAN"] }),
  "docs/architecture/MOD-fines.md": doc("MOD-fines", "Fines", { folder: "src/fines/", realises: ["FINES ARE CAPPED"] }),
  "docs/architecture/MOD-loans.md": doc("MOD-loans", "Loans", { folder: "src/loans/", realises: ["LOANS ARE RECORDED", "RETURNS CLOSE A LOAN"] }),
  "docs/tests/counter-proofs/TST-101.md": COUNTER_PROOF,
  "tests/loans/records.test.mjs": [T101, T102].join(""),
  "tests/returns.test.mjs": [T103, T104].join(""),
  [RELEASE_FILE]: RELEASE_NOW,
  "tests/odd.test.mjs": [declared("TST-107", { level: null, guards: "LOANS ARE RECORDED" }, "a loan is printed"), declared("TST-108", { module: "MOD-loans" }, "a loan is counted")].join(""),
  "tests/undeclared.test.mjs": UNDECLARED,
};
const FILES_V1 = {
  "SPEC.md": SPEC_V1,
  "docs/use-cases/UC-001-lend-a-book.md": FILES["docs/use-cases/UC-001-lend-a-book.md"],
  "docs/use-cases/UC-002-return-a-book.md": FILES["docs/use-cases/UC-002-return-a-book.md"],
  "docs/architecture/MOD-loans.md": FILES["docs/architecture/MOD-loans.md"],
  "tests/loans.test.mjs": T101_V1,
  "tests/returns.test.mjs": [T103, T104].join(""),
  [RELEASE_FILE]: RELEASE_V1,
};

// A run record in the form of MOD-result-records' result-record schema: front matter, then its ## Outcomes table of rows [test, level, outcome, runs].
export function record(commit, run, occasion, rows) {
  return lines("---", `commit: ${commit}`, "levels:", "  - unit", "  - component", "  - release", `occasion: ${occasion}`, "participant: ci", "date: 2026-10-20 10:00 UTC", `run: ${runAddress(run)}`, "---",
    "## Outcomes", "", "| Test | Level | Outcome | Runs |", "|---|---|---|---|", ...rows.map((row) => `| ${row.join(" | ")} |`));
}
const HEAD_ROWS = [["TST-101", "unit", "passed", ""], ["TST-102", "unit", "passed", ""], ["TST-103", "component", "passed", ""], ["TST-104", "unit", "passed", "4 of 5"], ["TST-105", "release", "failed", ""],
  ["TST-106", "release", "passed", ""], ["TST-108", "unit", "passed", ""], ["TST-110", "release", "passed", ""]];
// The branch test-results, newest record first.
export const RECORDS = {
  [`runs/${HEAD}/20261020-1005-commit-0002.md`]: record(HEAD, 5004, "commit", [["TST-103", "component", "failed", ""]]),
  [`runs/${HEAD}/20261020-1000-commit-0001.md`]: record(HEAD, 5003, "commit", HEAD_ROWS),
  [`runs/${PULL}/20261019-1000-pull-request-0003.md`]: record(PULL, 5002, "pull-request", [["TST-101", "unit", "failed", ""]]),
  [`runs/${TAG2}/20261015-1000-release-candidate-0004.md`]: record(TAG2, 5001, "release-candidate", [["TST-101", "unit", "passed", ""], ["TST-102", "unit", "passed", ""], ["TST-103", "component", "passed", ""],
    ["TST-104", "unit", "passed", "3 of 5"], ["TST-105", "release", "passed", ""], ["TST-106", "release", "passed", ""]]),
  [`runs/${OLD}/20261010-1000-commit-0005.md`]: record(OLD, 4002, "commit", [["TST-101", "unit", "failed", ""]]),
  [`runs/${TAG1}/20261001-1000-release-candidate-0006.md`]: record(TAG1, 4001, "release-candidate", [["TST-101", "unit", "passed", ""], ["TST-103", "component", "failed", ""], ["TST-104", "unit", "passed", "2 of 5"],
    ["TST-105", "release", "passed", ""], ["TST-106", "release", "passed", ""], ["TST-109", "unit", "passed", ""]]),
};
// The history of main, newest first, each commit with its whole tree.
const HISTORY = [
  { commit: HEAD, date: "2026-10-20T10:00:00Z", files: FILES },
  { commit: TAG2, date: "2026-10-15T10:00:00Z", files: FILES },
  { commit: OLD, date: "2026-10-10T10:00:00Z", files: { ...FILES_V1, [RELEASE_FILE]: [T105_V1, T106].join("") } },
  { commit: TAG1, date: "2026-10-01T10:00:00Z", files: FILES_V1 },
];

/**
 * hostOf({ files, results, logs, failResults }) -> Host — the product's host: main holds `files` (FILES), the tags hold their trees, the branch test-results `results` (RECORDS); `logs` maps a run's id to
 * the log the server keeps, a run not named has none (null); `failResults` makes the branch test-results unreachable. Its `asked` records every run whose log was asked, its `writes` every call of a method
 * that writes — none of which the route may call.
 */
export function hostOf({ files = FILES, results = RECORDS, logs = { 5001: "log 5001", 5002: "log 5002", 5003: "log 5003", 5004: "log 5004", 4001: "log 4001" }, failResults = false } = {}) {
  const base = treeHost({ trees: { main: files, "v2026.2.0": FILES, "v2026.1.0": FILES_V1, "test-results": results }, tags: TAGS.map((tag) => tag.name), history: HISTORY });
  const asked = [], writes = [];
  const writing = (name) => async (...args) => { writes.push([name, args]); throw Object.assign(new Error(`${name} is not for this page`), { name: "Refused" }); };
  return { ...base, asked, writes,
    async readSnapshot(ref, options) {
      if (failResults && ref === "test-results") throw Object.assign(new Error("the branch test-results is unreachable"), { name: "Unreachable" });
      return { ...(await base.readSnapshot(ref, options)), commit: COMMITS[ref] ?? ref };
    },
    async listTags() { return TAGS.map((tag) => ({ ...tag })); },
    async ciRunLog(id) { asked.push(String(id)); return logs[id] ?? null; },
    webLinks: () => ({ file: (path, ref) => `${ADDRESS}/blob/${ref}/${path}`, run: (id) => runAddress(id) }),
    commitFiles: writing("commitFiles"), writeFile: writing("writeFile"), createBranch: writing("createBranch"), openPullRequest: writing("openPullRequest") };
}

export const withClass = (root, name) => find(root, (node) => String(node.className).split(" ").includes(name));
export const textsOf = (root, name) => withClass(root, name).map((node) => node.textContent);
export const textOf = (root, name) => textsOf(root, name)[0];
export const casesOf = (root) => withClass(root, "tests-case");
/** [identifier, title, outcome] of each test case shown under `root`. */
export const lineOf = (node) => [textOf(node, "tests-id"), textOf(node, "tests-title"), textOf(node, "tests-outcome")];
export const idsOf = (root) => casesOf(root).map((node) => textOf(node, "tests-id"));
export const groupNamed = (root, name) => withClass(root, "tests-group").find((group) => textOf(group, "tests-group-name") === name);
export const levelsOf = (group) => textsOf(group, "tests-level");
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

/** The route `trace` drawn with the key "tests" at `ref` over `host`, with `params` beside, as the frame draws it; with a `row`, once the detail of that test is drawn. */
export async function render(host = hostOf(), params = {}) {
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { product: { address: ADDRESS, host } }, { key: "tests", ref: "main", ...params });
  if (params.row) await until(() => withClass(target, "test-detail").length > 0);
  if (params.compare) await until(() => withClass(target, "tests-compare").length > 0 || withClass(target, "traces-problem").length > 0);
  await settle();
  return target;
}

/** Chooses `value` in the select of class `className` under `target`, as a person does, and waits for the page to draw it. */
export async function choose(target, className, value) {
  const select = withClass(target, className)[0];
  select.value = value;
  select.dispatchEvent(new Event("change"));
  await settle();
}

/** Clicks `node` as a person does, and waits for what the click asks to be answered. */
export async function click(node) {
  node.dispatchEvent(new Event("click"));
  await settle();
}

const INSTANCE = "akmaier/agent-m";
const REPOSITORY = "acme/library";

/**
 * visit(t, { present }) -> { main(), requests } — a person opens #trace/key=tests/ref=main/product=<the product> in a browser that keeps the product without a token, and the frame starts on the views of
 * MOD-trace-pages over the real GitHub host. With `present`, GitHub serves the product's main (FILES); without, it answers every request for the product with Not Found, as it does for a private repository
 * that no token reaches. `main()` is the page's <main>.
 */
export async function visit(t, { present }) {
  const { startPage } = await import("../src/site-frame/index.mjs");
  const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
  const world = githubWorld({ ...(present ? { [REPOSITORY]: { main: FILES } } : {}), [INSTANCE]: { main: {} } });
  const realFetch = globalThis.fetch, realInterval = globalThis.setInterval;
  globalThis.fetch = world.fetch;
  globalThis.setInterval = () => 1;
  t.after(() => { globalThis.fetch = realFetch; globalThis.setInterval = realInterval; });
  document.body.replaceChildren();
  installBrowser(`#trace/key=tests/ref=main/product=${encodeURIComponent(ADDRESS)}`);
  writeSetting(openStore(INSTANCE), "products", [ADDRESS]);
  await startPage({ page: "review", views: [view] });
  await until(() => false, 200);
  return { main: () => find(document.body, (node) => node.localName === "main")[0], requests: world.forRepository(REPOSITORY) };
}
