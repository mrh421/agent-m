// The harness of the system and release tests of UC-023 (Modify the architecture): the page is MOD-site-frame's real `startPage` on the review page, over the real
// views of MOD-review-pages, with the real MOD-prompt-bar, MOD-job-runner, MOD-runtimes, MOD-approvals, MOD-trace-graph and the real GitHub host. GitHub (the instance and
// the product) and the participants are the app-harness's servers, in memory; the global `fetch` is replaced by a function that answers them and records any request to
// another origin (`outside`), which no test leaves: nothing reaches the network. The document is the one of tests/review-pages-draft-world.mjs, whose browser storage the
// scenario empties first. A person's actions are the clicks and the typing of the bar's and the pages' own controls.
// Imported by tests/system-uc-023-modify-the-architecture.test.mjs and the release tests of UC-023. It holds no test and no expected result: the fixtures it builds are
// inputs, and every test states its own expected values.
// Authored by developer-sonnet-l (ITM-739), who implemented none of ITM-724, ITM-728, ITM-729, ITM-730 or ITM-731; it implemented no UC-023 production behaviour.
//
// Module: MOD-review-pages
// Module: MOD-prompt-bar
// Module: MOD-site-frame
// Module: MOD-job-runner
// Module: MOD-approvals
// Module: MOD-trace-graph
// Level: system
//
// The product is a small library tool whose architecture is accepted: UC-001 and UC-002 accepted, UC-003 open; ARC-001 (designs MOD-sync, MOD-desk, MOD-report) and ARC-002
// (designs MOD-shelf); the modules MOD-sync (provides push and pull), MOD-desk (uses MOD-sync.pull), MOD-report (uses MOD-sync.push) and MOD-shelf (no code yet); code files in
// three of the four folders; two tests; a backlog item and a step of the implementation plan that name modules. Every file of it is accepted at the text
// `ACCEPTED`; `scenario({ now })` puts another text on the default branch for a file (the accepted text stays in the history and in its approval record), `remove` takes a file
// away, and `extra` adds files. The participants are this browser's endpoints `drafter` (model-a, at https://fixture-endpoint.example.test) and `reviewer` (model-b, at https://fixture-b.example.test), each declaring
// the place "this machine" and the scenario's context.

import { afterEach } from "node:test";
// The tests that use this harness click as a script before they click as a person (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK), so the
// review pages' document keeps node's untrusted Events here; a person's click is made trusted by the test (tests/review-pages-harness.mjs).
globalThis.reviewPagesScriptedWithin = ["hand-over"];
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { byClass, buttonsNamed, click, find, until } from "./review-pages-draft-world.mjs";
import { repoServer, settle } from "./app-harness.mjs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { view as reviewPages } from "../src/review-pages/index.mjs";
import { blobSha } from "../src/text-tools/index.mjs";

const { startPage } = await import("../src/site-frame/index.mjs");

export const INSTANCE = "akmaier/agent-m";
const INSTANCE_HEAD = "1a2b3c".padEnd(40, "0");
let scenarios = 0;
// The app-harness's server names its first earlier commit so.
const GENESIS_ERA = "d000001".padEnd(40, "0");
export const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED", RENEW = "A MEMBER CAN RENEW ONCE";
const txt = (...lines) => `${lines.join("\n")}\n`;
const ROOT = new URL("../", import.meta.url);
export const readOriginal = (path) => readFileSync(new URL(path, ROOT), "utf8");

// ---------------------------------------------------------------- the product

export const SPEC = txt("# Library tool", "", "## Lending", "", `**${LOAN}** *(Product Owner)*`, "Every loan states the date by which the book is returned.", "*Check:* `tests/sync.test.mjs`", "",
  `**${SHELF}** *(Product Owner)*`, "Every book stands on a shelf.", "*Check:* `tests/desk.test.mjs`", "",
  `**${RENEW}** *(Product Owner)*`, "A member renews a loan once.", "*Check:* `tests/desk.test.mjs`");
const useCase = (id, title, realises) => txt("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:", ...realises.map((name) => `  - ${name}`), "---",
  `# ${id} ${title}`, "", `**Goal.** ${title}.`);
export const UC1_PATH = "docs/use-cases/UC-001-lend-a-book.md", UC2_PATH = "docs/use-cases/UC-002-shelve-a-book.md", UC3_PATH = "docs/use-cases/UC-003-renew-a-loan.md";
export const UC1 = useCase("UC-001", "Lend a book", [LOAN]), UC2 = useCase("UC-002", "Shelve a book", [SHELF]), UC3 = useCase("UC-003", "Renew a loan", [RENEW]);

export const decision = (id, title, forced, designs, sentence) => txt("---", `id: ${id}`, `title: ${title}`, "forced_by:", ...forced.map((name) => `  - ${name}`), "designs:",
  ...designs.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", "## Context", "", "Books are lent at a desk and shelved.", "", "## Decision", "", sentence, "", "```mermaid", "flowchart LR", "    Desk --> Sync", "```", "", "## Alternatives", "",
  "One module.", "", "## Consequences", "", "Several folders.");
export const module_ = (id, title, folder, { realises = [LOAN], follows = "ARC-001", uses = [], provides = [], interfaces = [], sentence = "It does one thing." } = {}) => txt("---", `id: ${id}`,
  `title: ${title}`, `folder: ${folder}`, "realises:", ...realises.map((name) => `  - ${name}`), "follows:", `  - ${follows}`, "uses:", ...uses.map((name) => `  - ${name}`), "provides:",
  ...provides.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", "## Responsibility", "", sentence, "", "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "",
  "## Interfaces", "", ...interfaces, "", "## Files", "", "None.", "", "## Uses", "", ...(uses.length ? uses.map((name) => `- ${name}`) : ["Nothing."]));
const push = "- `push(loan) -> receipt` — sends a loan to the shelf.", pull = "- `pull(since) -> loans` — reads the loans since a time.";
export const ARC1_PATH = "docs/architecture/ARC-001-sync.md", ARC2_PATH = "docs/architecture/ARC-002-shelving.md";
export const SYNC_PATH = "docs/architecture/MOD-sync.md", DESK_PATH = "docs/architecture/MOD-desk.md", REPORT_PATH = "docs/architecture/MOD-report.md", SHELF_PATH = "docs/architecture/MOD-shelf.md";
export const ARC1 = decision("ARC-001", "Lending is synchronised", [LOAN, "UC-001"], ["MOD-sync", "MOD-desk", "MOD-report"], "The desk and the report use one synchronisation module.");
export const ARC2 = decision("ARC-002", "Books are shelved", [SHELF, "UC-002"], ["MOD-shelf"], "A shelf module keeps the books.");
export const SYNC = module_("MOD-sync", "Synchronising loans", "src/sync/", { provides: ["push", "pull"], interfaces: [push, pull], sentence: "It synchronises the loans." });
export const DESK = module_("MOD-desk", "The desk", "src/desk/", { realises: [LOAN, "UC-001"], uses: ["MOD-sync.pull"], provides: ["lend"], interfaces: ["- `lend(book) -> loan` — lends a book."] });
export const REPORT = module_("MOD-report", "The report", "src/report/", { uses: ["MOD-sync.push"], provides: ["report"], interfaces: ["- `report() -> text` — lists the loans."] });
export const SHELF_MOD = module_("MOD-shelf", "The shelf", "src/shelf/", { realises: [SHELF, "UC-002"], follows: "ARC-002", provides: ["shelve"], interfaces: ["- `shelve(book)` — puts a book on a shelf."] });
const testFile = (id, module, guards) => txt(`// ${id} · level: unit · module: ${module}`, `// guards: ${guards}`, "// given: a fixture", "// input: a fixture", "// expect: a fixture");
const item = (id, title, module, dir) => txt("---", `id: ${id}`, `title: ${title}`, "level: module", "realises:", `  - ${LOAN}`, "modules:", `  - ${module}`, "tests:", "  - unit", "---", `# ${id} ${title}`,
  "", `The ${dir} of ${module}.`);

// The files of the product at the text `ACCEPTED`, apart from the approval records.
export const ACCEPTED = {
  "README.md": "# Library tool\n", "SPEC.md": SPEC, [UC1_PATH]: UC1, [UC2_PATH]: UC2, [UC3_PATH]: UC3,
  [ARC1_PATH]: ARC1, [ARC2_PATH]: ARC2, [SYNC_PATH]: SYNC, [DESK_PATH]: DESK, [REPORT_PATH]: REPORT, [SHELF_PATH]: SHELF_MOD,
  "src/sync/index.mjs": "export const push = 1;\n", "src/sync/pull.mjs": "export const pull = 1;\n", "src/desk/index.mjs": "export const lend = 1;\n", "src/report/index.mjs": "export const report = 1;\n",
  "tests/sync.test.mjs": testFile("TST-9001", "MOD-sync", LOAN), "tests/desk.test.mjs": testFile("TST-9002", "MOD-desk", SHELF),
  "docs/backlog/ITM-901-retry-the-sync.md": item("ITM-901", "Retry the sync", "MOD-sync", "backlog item"),
  "docs/plan/ITM-902-build-the-desk.md": item("ITM-902", "Build the desk", "MOD-desk", "step"),
};
// UC-003 is not accepted: no record names it.
const RECORDED = [["UC-001", "use-case", UC1_PATH], ["UC-002", "use-case", UC2_PATH], ["ARC-001", "architecture-decision", ARC1_PATH], ["ARC-002", "architecture-decision", ARC2_PATH],
  ["MOD-sync", "module", SYNC_PATH], ["MOD-desk", "module", DESK_PATH], ["MOD-report", "module", REPORT_PATH], ["MOD-shelf", "module", SHELF_PATH]];
/** record(id, kind, path, text) -> [the record's path, its text] — the approval record that names `text` as `path`'s. */
export async function record(id, kind, path, body) {
  const blob = await blobSha(body);
  return [`docs/approvals/${id}-${blob.slice(0, 12)}.md`, txt(`kind: ${kind}`, `file: ${path}`, `blob: ${blob}`)];
}

// ---------------------------------------------------------------- the participants and the instance

// The bar offers this browser's endpoints that declare a place, a context and a model (UC-049 1) and reads no participant list: the two endpoints the scenario stores below are what it
// offers. The instance's participant list stays for the draft page of MOD-review-pages, which chooses its deriving and its reviewing participant from the register (jobs.mjs, loadStage).
const registerHead = readOriginal("docs/participants.md").split("\n");
const header = registerHead.slice(0, registerHead.findIndex((line) => line.startsWith("|---")) + 1).join("\n");
const register = (context) => txt(header,
  `| drafter | model endpoint | model-a | ${context} | - | draft text | this machine | endpoint drafter |`,
  `| reviewer | model endpoint | model-b | ${context} | - | draft text | this machine | endpoint reviewer |`);

const FIXTURE_ORIGINS = ["https://api.github.com", "https://raw.githubusercontent.com", "https://fixture-endpoint.example.test", "https://fixture-b.example.test"];
export const outside = [];
afterEach(() => { assert.deepEqual(outside.splice(0), [], "no request left the fixtures"); });

// The scenario's pages share the global document; the storage of the last one is emptied before the next opens.
function emptyStorage(storage) { while (storage.length > 0) storage.removeItem(storage.key(0)); }

// The first sentence of the conversation's prompt (src/job-catalogue/kinds/converse/prompt.md), by which a request of the bar's one kind is known.
const CONVERSE_PROMPT = "You answer a person's message about the page they are looking at";
const strings = (value) => (typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(strings) : []);

/**
 * scenario({ now, remove, extra, answers, reviewerAnswers, context, hash, token }) -> the open page and its servers. The instance is akmaier/agent-m, the product
 * akmaier/library-sync with the files above; `now` puts the text for a path on the default branch (the accepted text stays in the history and in its record), `remove`
 * takes the paths away, `extra` adds files (unrecorded); `answers` are the drafter's replies in turn — the first of a change is handed on by the conversation as
 * UC-049 4a says —, `reviewerAnswers` the reviewer's; `hash` is the fragment the page opens at; `token` false stores no token for the product.
 */
export async function scenario({ now = {}, remove = [], extra = {}, answers = [], reviewerAnswers = [], context = 200000, hash = null, token = true, graph = true } = {}) {
  const repo = "akmaier/library-sync", address = `https://github.com/${repo}`;
  const endpointRequests = [], reviewerRequests = [], authorized = [], deletedByTree = new Map(), deletedByCommit = new Map();
  let headRecords = new Set(), headRecordPaths = [];
  let answerNumber = 0, reviewerNumber = 0;
  const response = (value) => new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });
  const conversational = (value) => typeof value === "string" || (value && typeof value === "object" && (Object.hasOwn(value, "draft") ? conversational(value.draft)
    : ["answer", "edits", "handOver"].some((key) => Object.hasOwn(value, key))));
  const asJson = (value) => (typeof value === "string" ? value : JSON.stringify(value && Object.hasOwn(value, "draft") ? value : { draft: value, answers: [] }));
  const nextAnswer = () => answers[Math.min(answerNumber, answers.length - 1)];
  // A message of the bar is the conversation: where the scenario scripts a change, the participant first hands it on to the kind that owns it (UC-049 4a).
  const handsOn = (body) => strings(body).join("\n").includes(CONVERSE_PROMPT) && answers.length > 0 && !conversational(nextAnswer());
  const handOverOf = (body) => ({ answer: "Handed on to change-architecture.", handOver: { kind: "change-architecture", works_on: [],
    task: /## The person's message\n\n(?:### [^\n]*\n\n)?([^]*?)\n\n## /.exec(strings(body).join("\n"))?.[1] ?? "" } });
  const handler = async (url, init) => {
    if (url.origin === "https://fixture-endpoint.example.test") {
      const body = JSON.parse(init.body);
      if (handsOn(body)) return response({ choices: [{ message: { content: JSON.stringify({ draft: handOverOf(body), answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
      endpointRequests.push({ url: url.href, body, headers: init.headers });
      const value = answers[Math.min(answerNumber++, answers.length - 1)];
      return response({ choices: [{ message: { content: asJson(typeof value === "function" ? value(endpointRequests) : value) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    }
    if (url.origin === "https://fixture-b.example.test") {
      const body = JSON.parse(init.body);
      reviewerRequests.push({ url: url.href, body, headers: init.headers });
      const value = reviewerAnswers[Math.min(reviewerNumber++, reviewerAnswers.length - 1)];
      return response({ choices: [{ message: { content: asJson(typeof value === "function" ? value(reviewerRequests) : value) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    }
    // Without a token the product's files come from GitHub's raw host.
    if (url.origin === "https://raw.githubusercontent.com" && url.pathname.startsWith(`/${repo}/`)) return product.fetch(url, init);
    // GitHub's batch query names the commit it reads; the product's commits are not the instance's.
    if (url.origin === "https://api.github.com" && url.pathname === "/graphql" && !JSON.parse(init.body).query.includes(INSTANCE_HEAD)) return product.fetch(url, init);
    // The token a write to the product carries: kept, and the request goes on to the product's server.
    const method = (init.method ?? "GET").toUpperCase();
    if (method === "GET" && url.origin === "https://api.github.com" && url.pathname === `/repos/${repo}/commits` && headRecordPaths.includes(url.searchParams.get("path"))) {
      return response([{ sha: GENESIS_ERA, parents: [], author: null, commit: { author: { name: "A person" }, committer: { date: "2026-09-01T10:00:00Z" }, message: "a commit" } }]);
    }
    if (url.origin === "https://api.github.com" && method !== "GET" && url.pathname.startsWith(`/repos/${repo}/`)) authorized.push({ method, path: url.pathname, authorization: init.headers?.Authorization ?? init.headers?.authorization ?? null });
    // The graph stored on the branch trace-cache is not there: a page cannot derive an impact list.
    if (graph === false && method === "GET" && url.origin === "https://api.github.com" && url.pathname.startsWith(`/repos/${repo}/contents/`) && url.searchParams.get("ref") === "trace-cache") {
      return new Response('{"message":"Not Found"}', { status: 404 });
    }
    // The app-harness's server writes the files of a commit and knows no deletion: a deletion (a tree entry whose sha is null) is taken out of the request and done on the
    // server's files once the branch has moved on, and the write it makes names the paths it deleted.
    if (url.origin === "https://api.github.com" && method === "POST" && url.pathname === `/repos/${repo}/git/trees`) {
      const body = JSON.parse(init.body), gone = body.tree.filter((entry) => entry.sha === null).map((entry) => entry.path);
      if (gone.length === 0) return null;
      const made = await product.fetch(url, { ...init, body: JSON.stringify({ ...body, tree: body.tree.filter((entry) => entry.sha !== null) }) });
      deletedByTree.set((await made.clone().json()).sha, gone);
      return made;
    }
    if (url.origin === "https://api.github.com" && method === "POST" && url.pathname === `/repos/${repo}/git/commits`) {
      const made = await product.fetch(url, init), gone = deletedByTree.get(JSON.parse(init.body).tree);
      if (gone) deletedByCommit.set((await made.clone().json()).sha, gone);
      return made;
    }
    if (url.origin === "https://api.github.com" && method === "PATCH" && url.pathname === `/repos/${repo}/git/refs/heads/main`) {
      const made = await product.fetch(url, init), gone = deletedByCommit.get(JSON.parse(init.body).sha);
      if (gone && made.ok) {
        for (const path of gone) delete product.files[path];
        product.writes.at(-1).deleted = gone;
      }
      return made;
    }
    return null;
  };
  const accepted = { ...ACCEPTED };
  const current = { ...accepted, ...now, ...extra };
  for (const path of remove) delete current[path];
  const changedPaths = [...Object.keys(now), ...remove].filter((path) => path in accepted);
  // The product's first commit, `GENESIS_ERA`: the app-harness's server keeps an earlier commit only for a record that names a text its file no longer holds, so a record of a file
  // that has not changed would be taken as added by the head, which moves with every commit a test makes. A record that names the earlier text of README.md is that first
  // commit, which holds every file as it was accepted; the records of unchanged files are added by it (`headRecords`).
  const earlier = "# Library tool (earlier)\n";
  const [genesisPath, genesisText] = await record("GENESIS", "use-case", "README.md", earlier);
  const history = [earlier, ...changedPaths.map((path) => accepted[path])];
  const records = Object.fromEntries(await Promise.all(RECORDED.map(([id, kind, path]) => record(id, kind, path, accepted[path]))));
  headRecords = new Set(RECORDED.filter(([, , path]) => !changedPaths.includes(path)).map(([id]) => id));
  headRecordPaths = Object.keys(records).filter((path) => headRecords.has(path.slice("docs/approvals/".length).replace(/-[0-9a-f]{12}\.md$/, "")));
  const product = await repoServer({ repo, files: { [genesisPath]: genesisText, ...current, ...records }, history, head: "9f8e7d".padEnd(40, "0") });
  // MOD-trace-graph's storedGraph keeps a commit's graph for the life of the process, and the server names its commits by a count of its own: each scenario moves the count on, so that
  // no two scenarios of a file name the same commit for different files.
  scenarios += 1;
  for (let at = 0; at < scenarios * 16; at += 1) await product.change("README.md", current["README.md"]);
  const chapterFolder = "docs/sources/SRC-vibe-coding/2026-10-05/";
  const chapters = Object.fromEntries(readdirSync(new URL(chapterFolder, ROOT)).filter((path) => path.endsWith(".md")).map((path) => [chapterFolder + path, readOriginal(chapterFolder + path)]));
  const instance = await repoServer({ head: INSTANCE_HEAD, files: { "docs/participants.md": register(context), "AGENTS.md": readOriginal("AGENTS.md"), "docs/sources/SRC-vibe-coding.md": readOriginal("docs/sources/SRC-vibe-coding.md"), ...chapters },
    handlers: [handler, (url, init) => (url.pathname === `/repos/${repo}` ? response({ default_branch: "main", private: false, archived: false, permissions: { push: true }, description: "" })
      : url.pathname.startsWith(`/repos/${repo}/`) ? product.fetch(url, init) : null)] });
  globalThis.fetch = (input, init) => {
    const url = new URL(String(input));
    if (!FIXTURE_ORIGINS.includes(url.origin)) { outside.push(url.href); return Promise.reject(new TypeError(`the test's network refuses ${url.href}`)); }
    return instance.fetch(input, init);
  };
  // The browser: the window announces a change of the fragment, as a browser does, the storage is empty, the page's timers do not run.
  const events = new EventTarget();
  let fragment = "";
  const location = { hostname: "akmaier.github.io", host: "akmaier.github.io", protocol: "https:", pathname: "/agent-m/docs/index.html",
    get hash() { return fragment; }, set hash(value) { fragment = value; queueMicrotask(() => events.dispatchEvent(new Event("hashchange"))); } };
  Object.defineProperty(globalThis, "location", { configurable: true, value: location });
  Object.assign(globalThis.window, { addEventListener: events.addEventListener.bind(events), dispatchEvent: events.dispatchEvent.bind(events) });
  globalThis.setInterval = () => 1;
  emptyStorage(globalThis.localStorage);
  emptyStorage(globalThis.sessionStorage);
  const store = openStore(INSTANCE);
  writeSetting(store, "github-token", { value: "github_pat_FIXTURE_INSTANCE_0123456789", name: "github.com/akmaier", expires: "2027-01-01" });
  if (token) writeSetting(store, `github-token:${repo}`, { value: "github_pat_FIXTURE_PRODUCT_0123456789", name: "github.com/reviewer", expires: "2027-01-01" });
  writeSetting(store, "products", [address]);
  writeSetting(store, "endpoint:drafter", { url: "https://fixture-endpoint.example.test/v1", kind: "openai-compatible", model: "model-a", place: "this machine", context });
  writeSetting(store, "endpoint:reviewer", { url: "https://fixture-b.example.test/v1", kind: "openai-compatible", model: "model-b", place: "this machine", context });
  fragment = hash ?? `#decision/product=${encodeURIComponent(address)}`;
  const s = { product, instance, repo, address, store, location, endpointRequests, reviewerRequests, authorized, chapter: readOriginal(`${chapterFolder}10_architectural-design.md`) };
  await startPage({ page: "review", views: [reviewPages], menuViews: [] });
  await rest(s);
  s.body = document.body;
  s.target = find(document.body, (node) => node.localName === "main")[0];
  s.footer = find(document.body, (node) => node.localName === "footer" && node.className === "site-frame-prompt-bar")[0];
  await until(() => byClass(s.footer, "section", "prompt-bar").length === 1, "the prompt bar is drawn");
  return s;
}

// The composition root registers the strategies of the views once, as src/site-frame/start.mjs does for the page's views.
for (const strategies of reviewPages.strategies ?? []) registerStrategies("review-pages", strategies);

// Until the servers have had nothing in flight for a while.
export async function rest(s) { await settle(s.instance); }
// The page goes to a fragment, as a person's link or the bar's navigation does, and the route is drawn.
export async function goTo(s, fragment) {
  s.location.hash = fragment;
  await rest(s);
}
/** onFile(s, route, id) — the page of one decision or module file, `#decision/id=ARC-001/product=<address>`. */
export const onFile = (s, route, id, ...more) => goTo(s, `#${[route, `id=${encodeURIComponent(id)}`, ...more, `product=${encodeURIComponent(s.address)}`].join("/")}`);

export const all = (root, tag, className = null) => find(root, (node) => (!tag || node.localName === tag) && (!className || node.className.split(/\s+/).includes(className)));
export const one = (root, tag, className) => { const nodes = all(root, tag, className); assert.equal(nodes.length, 1, `one ${tag}.${className}: ${root?.textContent ?? ""}`); return nodes[0]; };
export const namedButton = (root, text) => { const found = buttonsNamed(root, text); assert.ok(found.length > 0, `${text} is offered: ${root.textContent}`); return found[0]; };
export const barOf = (s) => one(s.footer, "section", "prompt-bar");
export const statusOf = (s) => one(barOf(s), "section", "status");

// ---------------------------------------------------------------- the person's actions

// A person clicks (the page's controls listen for a click), and the servers settle.
export async function press(s, node) {
  assert.ok(node, "nothing to click");
  assert.ok(!node.disabled, `disabled — a person cannot click ${node.textContent}`);
  click(node);
  await rest(s);
}
/** A click the browser marks as a person's (isTrusted), which *Send* takes (THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK). */
export const trustedClick = () => Object.defineProperty(new Event("click"), "isTrusted", { value: true });
// The person writes `text` in the bar, chooses `participant` where the bar offers several, and presses Send; resolves once the bar is free again.
export async function send(s, text, { participant = null } = {}) {
  const bar = barOf(s);
  if (participant !== null) {
    const selector = all(bar, "select", "participant")[0];
    if (selector) selector.value = participant;
    else assert.match(one(bar, "span", "participant").textContent, new RegExp(`^${participant} — `), `the bar offers ${participant}`);
  }
  one(bar, "textarea", "instruction").value = text;
  const sent = one(bar, "button", "send");
  sent.dispatchEvent(trustedClick());
  await rest(s);
  await until(() => sent.disabled === false, "the message has run");
  await rest(s);
}
// "Review the draft": the bar writes the address of the draft route; the page draws it. -> the fragment.
export async function review(s) {
  await press(s, one(barOf(s), "button", "review"));
  await rest(s);
  return s.location.hash;
}
export const typeInto = (node, value) => { node.value = value; node.dispatchEvent(new Event("input")); };
/** edit(s, route, id, change) — opens the editor of the file and writes `change(text)` in it; -> the textarea. */
export async function edit(s, route, id, change) {
  await onFile(s, route, id, "edit=1");
  await until(() => all(s.target, "textarea").length > 0, `the editor of ${id}`);
  const area = all(s.target, "textarea")[0];
  typeInto(area, change(area.value));
  return area;
}
export const lines = (message) => message.split("\n");

// ---------------------------------------------------------------- a job without the page

// The participants of the register above as MOD-participant-list gives them, and a third with the drafter's model.
const endpoint = (name, model, context = 300000) => ({ name, type: "model endpoint", model, context, price: null, capabilities: ["draft text"], place: "this machine", route: `endpoint ${name}` });
export const DRAFTER = endpoint("drafter", "model-a"), REVIEWER = endpoint("reviewer", "model-b"), TWIN = endpoint("twin", "model-a"), SMALL = endpoint("small", "model-c", 100);
export const USAGE = { inputTokens: 10, outputTokens: 5, minutes: null, cost: null };
/** driver(participant, answers) — a Driver that answers in turn (the last answer again once they are used) and keeps every input it is sent in `inputs`. */
export function driver(participant, answers) {
  const inputs = [], left = [...answers];
  return { participant, inputs, async send(input) {
    inputs.push(input);
    const next = left.length > 1 ? left.shift() : left[0];
    return { text: typeof next === "string" ? next : JSON.stringify(next), usage: USAGE };
  } };
}
/** The answer of a drafter or reviewer: its draft and its replies to the findings it was sent. */
export const answer = (draft, answers = []) => ({ draft, answers });
/**
 * jobOf(s, kindName, params, { drafter, reviewers, fetch }) -> { kind, context, prepared } — the job of that kind prepared (nothing sent) over the scenario's product and instance,
 * through MOD-job-runner's prepareJob, for the participants given; `context` is the JobContext it runs with.
 */
export async function jobOf(s, kindName, params, { drafter = DRAFTER, reviewers = [], participants = [DRAFTER, REVIEWER, TWIN, SMALL], fetch: registry = undefined } = {}) {
  const { prepareJob } = await import("../src/job-runner/index.mjs");
  const { kindOf } = await import("../src/job-catalogue/index.mjs");
  const { connect } = await import("../src/repository-hosts/index.mjs");
  const hostOf = (path, token) => connect({ server: "github", origin: "https://github.com", path, web: `https://github.com/${path}` }, { token });
  const productHost = hostOf(s.repo, "github_pat_FIXTURE_PRODUCT_0123456789"), instanceHost = hostOf(INSTANCE, "github_pat_FIXTURE_INSTANCE_0123456789");
  const kind = await kindOf(kindName);
  const context = { kind, params, product: { address: s.address, snapshot: await productHost.readSnapshot("main"), host: productHost },
    instance: { snapshot: await instanceHost.readSnapshot("main"), host: instanceHost, checkout: null }, connect: async () => ({ async repositoryInfo() { return { defaultBranch: "main" }; }, async issueCounts() { return { open: 2, closed: 5 }; } }), participants,
    places: { sources: {}, mailbox: null }, gates: [], person: "reviewer", now: new Date("2026-10-30T10:00:00Z"), agentM: { version: "2026.10.0", commit: "abc123def456" }, jobId: null,
    ...(registry ? { fetch: registry } : {}) };
  return { kind, context, prepared: await prepareJob(kindName, context, { drafter, reviewers }), host: productHost };
}
/** The text of the page's main part. */
export const pageText = (s) => s.target.textContent;
export const impactOf = (s) => all(s.target, "section", "change-impact")[0] ?? null;
