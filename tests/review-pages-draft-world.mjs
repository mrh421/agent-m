// The fixtures of the tests of ITM-507 (the review pages show the conversation's draft): one product behind a Host of the tests' own, the instance with its
// register of participants and its person source, the tab's session storage, a spy on `fetch`, and the small helpers that draw a route and read the page.
// Run by: node --test tests/review-pages-subjects.test.mjs tests/review-pages-conversation-draft.test.mjs
//
// Module: MOD-review-pages
// Level: unit
//
// This file holds inputs only — no expected result: every test states its own. It imports the browser harness of tests/review-pages-harness.mjs
// unchanged (its document and its localStorage). The product is a repository in memory with a history, a Host that keeps to MOD-repository-hosts' interface
// (repositoryInfo, readSnapshot, readHistory, commitFiles on the head that was read, else `Moved`), every call recorded. The instance is a read-only
// snapshot with the register of participants and the register entry of the person alice. Nothing reaches the network: `fetch` is a spy that refuses.

import "./review-pages-harness.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

export const { openStore, writeSetting, writeTabValue, readTabValue } = await import("../src/browser-store/index.mjs");
export const { finding } = await import("../src/text-tools/index.mjs");
export const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
// Each route as the frame shows it: the route its `module` gives, which carries `leave`, `unsaved` and `reads` (MOD-site-frame's Route).
const imported = new Map(await Promise.all((pages.view?.routes ?? []).map(async (route) => [route.name, await route.module()])));
export const routeNamed = (name) => imported.get(name);

// ---------------------------------------------------------------- the browser: session storage and the spy on fetch

const tab = new Map();
Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: { getItem: (k) => (tab.has(k) ? tab.get(k) : null),
  setItem: (k, v) => { tab.set(k, String(v)); }, removeItem: (k) => { tab.delete(k); }, key: (i) => [...tab.keys()][i] ?? null, get length() { return tab.size; } } });
export const fetched = [];
globalThis.fetch = async (url) => { fetched.push(String(url)); throw new Error(`the test's network refuses ${url}`); };

// ---------------------------------------------------------------- the product

export const text = (...lines) => `${lines.join("\n")}\n`;
export const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const { HostError } = await import("../src/repository-hosts/index.mjs");
export const failure = (name, message, fields = {}) => new HostError(name, fields, message);
export const GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
export const PRODUCT = encodeURIComponent(GITHUB.web);
export const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };

export const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED", RENEW = "A MEMBER CAN RENEW ONCE", HIDE = "THE DUE DATE MAY BE HIDDEN";
export const HEADING = "## 1. Lending";
export const LENDING = text(HEADING, "", `**${LOAN}** *(Product Owner)*`, "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`",
  "", `**${SHELF}** *(Product Owner)*`, "Every book stands on a shelf.", "*Check:* `tests/shelf.test.mjs`");
export const SPEC = text("# Thesis tool - Specification", "") + LENDING;
export const LENDING_NEW = LENDING.replace("is returned.", "is returned, and says when it is overdue.");

export const useCase = (id, title, realises, alternative = "- **2a. The book is out.** Agent M says so.") => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:",
  "  - Author", "realises:", ...realises.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "", `**Goal.** ${title}.`, "", "## Actors", "", "- **Author**", "", "## Precondition", "",
  "- The product is managed.", "", "## Main flow", "", "1. The author starts.", "2. Agent M answers.", "", "## Alternative flows", "", alternative, "", "## Postcondition", "",
  "- Nothing is written.");
export const UC7_PATH = "docs/use-cases/UC-007-derive-use-cases.md", UC8_PATH = "docs/use-cases/UC-008-review-use-cases.md";
export const UC7 = useCase("UC-007", "Derive use cases", [LOAN]), UC8 = useCase("UC-008", "Review use cases", [SHELF]);
export const NEW_FLOW = "- **2a. The book is out.** Agent M says so.\n- **2b. The service fails.** Agent M reports the error and writes nothing.";
export const changedUseCase = (id, path, base) => ({ path, class: "change", of: id, text: base.replace(/- \*\*2a\..*$/m, NEW_FLOW) });

const DIAGRAM = ["", "```mermaid", "flowchart LR", "    Desk --> Shelf", "```", ""];
export const ARC_PATH = "docs/architecture/ARC-001-lending.md", MOD_PATH = "docs/architecture/MOD-reader.md";
export const ARC1 = text("---", "id: ARC-001", "title: Lending is a desk", "forced_by:", `  - ${LOAN}`, "---", "# ARC-001 Lending is a desk", "", "## Context", "",
  "Books are lent at a desk.", "", "## Decision", "", "The desk and the shelf are two modules.", ...DIAGRAM, "## Alternatives", "", "One module.", "", "## Consequences", "", "Two folders.");
export const MOD_READER = text("---", "id: MOD-reader", "title: Reading a book", "folder: src/reader/", "realises:", `  - ${LOAN}`, "follows:", "  - ARC-001", "uses:", "provides:",
  "  - lend", "---", "# MOD-reader Reading a book", "", "## Responsibility", "", "It lends a book.", ...DIAGRAM, "## Parts", "", "- `index.mjs`", "", "## Data", "", "Nothing.", "",
  "## Interfaces", "", "- `lend`", "", "## Files", "", "None.", "", "## Uses", "", "Nothing.");
export const DUE_DILIGENCE = text("## Due diligence", "", "| Candidate | Licence |", "|---|---|", "| lend-lib | MIT |", "| desk-kit | GPL-3.0 |");

export const SOURCE = "SRC-alice";
const LINKS = text("# Requirement sources of the thesis tool", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| ${SOURCE} | 2026-10-13 | ${"0".repeat(64)} | prompt |`);
export const NO_LINKS = text("# Requirement sources of the thesis tool", "", "| Source | Version | Hash | Part |", "|---|---|---|---|");
const PERSON_SOURCE = text("---", `id: ${SOURCE}`, "title: Alice", "kind: person", "identifier: github.com/alice", "authority: informative", "licence: may be republished - fixture",
  "---", `# ${SOURCE} Alice`, "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  "| `2026-10-13` | 2026-10-13 | fixture | this repository | one file, hashed only |");

// One SPEC change queue with the entry 01, which replaces the section "## 1. Lending".
export const QUEUE = "docs/spec-freigaben/2026-03-01_sample", ENTRY_ID = "spec-2026-03-01_sample-01";
const QUEUE_FILES = {
  [`${QUEUE}/index.md`]: text("# SPEC approvals - queue 2026-03-01 · sample", "", "**Zieldatei aller Einträge:** `SPEC.md`", "",
    "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", `| 01 | \`SPEC.md\` | ${HEADING} | — | — |`),
  [`${QUEUE}/entscheidungen.md`]: text("# Decisions - queue 2026-03-01 sample", "", "Append-only."),
  [`${QUEUE}/01-lending.md`]: LENDING_NEW,
  [`${QUEUE}/01-lending.begruendung.md`]: text(`# ${HEADING}: a change`, "", "**The change.** A sample change.", "", "**Impact list.**", `- ${LOAN}: named by UC-007.`),
};
export const PRODUCT_FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [UC7_PATH]: UC7, [UC8_PATH]: UC8, [ARC_PATH]: ARC1, [MOD_PATH]: MOD_READER, "docs/sources.md": LINKS, ...QUEUE_FILES };

// ---------------------------------------------------------------- the hosts

// Each product's commits are its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page, so two products never share a commit. Every snapshot's
// readOn serves the graph the push job stores for its commit (tests/stored-graph-fake.mjs), which a page reads and never builds.
let products = 0;
export function fakeProduct(files = PRODUCT_FILES, { canWrite = true } = {}) {
  const calls = [], commits = new Map(), product = ++products;
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`product ${product} commit ${++made}`).digest("hex");
    commits.set(sha, { tree, parent });
    return sha;
  };
  head = commitOf(new Map(Object.entries(files)), null);
  const snapshotAt = (sha, ref) => {
    const { tree } = commits.get(sha);
    return withStoredGraph({ repository: GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) });
  };
  return {
    files: () => Object.fromEntries(commits.get(head).tree), head: () => head,
    writes: () => calls.map((call) => call.change),
    land(changed) { head = commitOf(new Map([...commits.get(head).tree, ...Object.entries(changed)]), head); },
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite, archived: false, description: "" }; },
      async readSnapshot(ref) {
        if (ref === "main") return snapshotAt(head, "main");
        if (commits.has(ref)) return snapshotAt(ref, ref);
        throw failure("NotFound", `${ref} was not found`);
      },
      async readHistory() { return []; },
      async commitFiles(change) {
        calls.push({ change: structuredClone(change) });
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((file) => [file.path, file.text])]), head);
        return { commit: head, url: `${GITHUB.web}/commit/${head}` };
      },
    },
  };
}

const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => { try { return readFileSync(new URL(path, ROOT), "utf8"); } catch { return null; } };
const REGISTER_HEAD = onDisk("docs/participants.md").split("\n").filter((line, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
export const REGISTER = `${REGISTER_HEAD}\n| drafter-a | model endpoint | example-model | 200000 | - | draft text | this machine | endpoint ep1 |\n`;
export const INSTANCE_COMMIT = "abc123def4567890abc123def4567890abc123de";
export function fakeInstance(register = REGISTER) {
  const entries = { [`docs/sources/${SOURCE}.md`]: PERSON_SOURCE };
  const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" }, ref: "main",
    commit: INSTANCE_COMMIT, paths: Object.keys(entries).sort(), read: async (path) => (path === "docs/participants.md" ? register : path in entries ? entries[path] : onDisk(path)),
    blob: () => null };
  return { host: { async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
    async readSnapshot() { return snapshot; } } };
}

// ---------------------------------------------------------------- the page

export const drafted = [];
// The context of a route: the product's page (or, with `product: false`, the instance's own), the store of the instance alice/agent-m with the product's token.
export function contextOf(fake, { token = true, product = true } = {}) {
  const store = openStore("alice/agent-m");
  writeTabValue(store, "prompt-bar:draft", null);
  if (token) writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  const instance = { repository: "alice/agent-m", host: fakeInstance().host };
  return { page: "review", instance, store, go: (route, params) => { drafted.push({ route, params }); },
    product: product ? { address: GITHUB.web, kind: "github", host: fake.host } : null };
}
// Draws the route named `name` in its context and returns what the frame holds afterwards: the target and the context.
export async function draw(fake, name, params, options = {}) {
  const route = routeNamed(name);
  assert.ok(route, `the route ${name}: ${pages.error?.message}`);
  const context = options.context ?? contextOf(fake, options);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, context, params);
  return { route, context, target, subject: () => route.subject?.(params, context) };
}

// The fragment `draft/subject=<key>` that a subject's draftRoute is, as the frame reads it: the route's name and its parameters.
export function routeOfFragment(fragment) {
  const [name, ...given] = fragment.split("/");
  return { name, params: Object.fromEntries(given.map((part) => [decodeURIComponent(part.slice(0, part.indexOf("="))), decodeURIComponent(part.slice(part.indexOf("=") + 1))])) };
}

// A job's result as MOD-job-runner's JobResult states it, with the draft and the rounds given.
export const resultOf = (draft, { rounds = [], remaining = [], classes = null } = {}) => ({ draft, raw: null, drafter: null, rounds, remaining, forPerson: [], stepFindings: [], classes,
  stoppedBecause: "passed", gate: null, usage: [], written: null });
export const ROUND_ONE = { number: 1, findings: [], answers: [], changed: true };
// The conversation's draft as MOD-prompt-bar's ConversationDraft states it, kept in the tab as the prompt bar keeps it.
export function keepDraft(context, { subject, kind, params = {}, result }) {
  writeTabValue(context.store, "prompt-bar:draft", { subject, kind, participant: "drafter-a", params: { instruction: "change it", conversation: [], ...params }, result });
}

export function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
export const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
export const click = (node) => node.dispatchEvent(new Event("click"));
export async function until(condition, what) {
  const limit = Date.now() + 2000;
  while (Date.now() < limit) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`waited for ${what}`);
}
export const buttonsNamed = (root, label) => find(root, (node) => node.localName === "button" && node.textContent === label);
