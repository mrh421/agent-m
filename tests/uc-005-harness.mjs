// The harness of the system and release tests of UC-005 (Derive requirements from a source) that walk the derivation through the real review pages: the route `spec-entry/draft` of MOD-review-pages drawn into the fixture DOM
// over a product and an instance behind hosts of the tests' own that keep to MOD-repository-hosts' interface, the real recipes and checks of MOD-job-runner, the real writer `queue-entries` of MOD-spec-changes and the real
// MOD-source-register, with the model endpoint a fixture behind the global `fetch`, which answers from a script and records every request it receives. Every commit is recorded with its message; the global `fetch` refuses every
// origin but the endpoint's, so nothing reaches the network. No expected result is computed here: what it builds are inputs, and every test states its own.
// Imported by tests/system-uc-005-derive-requirements.test.mjs and tests/release-uc-005-derive-requirements.test.mjs.
//
// Module: MOD-review-pages
// Module: MOD-spec-changes
// Module: MOD-job-runner
// Level: system
//
// Authored by developer-sonnet-j (ITM-579). The fixture product is a lending tool whose SPEC holds A LOAN HAS A DUE DATE and A BOOK IS SHELVED, both of the source SRC-handbook; it links SRC-policy (version 2026-10-01,
// the files main.md and appendix.md, the part Chapter 1) and SRC-handbook, and holds one open change queue whose entry 01 proposes A MEMBER CAN RENEW ONCE. The instance akmaier/agent-m holds the register of participants and of sources.

import "./review-pages-harness.mjs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { byClass, until } from "./review-pages-draft-world.mjs";
import { registerStrategies } from "../src/job-runner/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";
import { openStore, writeSetting } from "../src/browser-store/index.mjs";
import { view } from "../src/review-pages/index.mjs";

export { byClass, buttonsNamed, click, until } from "./review-pages-draft-world.mjs";
export { scripted } from "./review-pages-harness.mjs";
export const text = (...lines) => `${lines.join("\n")}\n`;
export const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
export const sha256Of = (body) => createHash("sha256").update(body).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);

(view.strategies ?? []).forEach((strategies, at) => registerStrategies(`tests/uc-005-harness.mjs#${at}`, strategies));

// ---------------------------------------------------------------- the product's text

export const PRODUCT_ADDRESS = "https://github.com/alice/thesis-tool", INSTANCE_ADDRESS = "https://github.com/alice/agent-m";
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: PRODUCT_ADDRESS };
const INSTANCE_ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/agent-m", web: INSTANCE_ADDRESS };
export const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M - thesis-tool", expires: "2027-01-01" };
export const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED", RENEW = "A MEMBER CAN RENEW ONCE";
export const LOAN_RULE = "Every loan states the date by which the book is returned.", SHELF_RULE = "Every book stands on a shelf.";
// The product's SPEC: two requirements of the linked source SRC-handbook.
export const SPEC = text("# Thesis tool - Specification", "", "## 1. Lending", "", `**${LOAN}** *(SRC-handbook, ch. 1)*`, LOAN_RULE, "*Check:* `tests/loan.test.mjs`", "",
  `**${SHELF}** *(SRC-handbook, ch. 2)*`, SHELF_RULE, "*Check:* `tests/shelf.test.mjs`");

// The sources: SRC-policy (normative; version 2026-10-01 of main.md and appendix.md, and a newer version 2026-11-01 the product does not link) and SRC-handbook (informational; version 2026-09-01 of handbook.md).
export const SOURCE = "SRC-policy", VERSION = "2026-10-01", NEWER = "2026-11-01", MAIN_FILE = "main.md", APPENDIX_FILE = "appendix.md";
export const HANDBOOK = "SRC-handbook", HANDBOOK_VERSION = "2026-09-01", HANDBOOK_FILE = "handbook.md";
export const MAIN_TEXT = text("# Policy", "", "Chapter 1: loans state their due date.", "Chapter 2: members can renew once.");
export const APPENDIX_TEXT = text("# Appendix", "", "Shelves are labelled.");
export const NEWER_TEXT = text("# Policy", "", "Chapter 1: loans state their due date and their return place.");
export const HANDBOOK_TEXT = text("# Handbook", "", "Chapter 1: a loan has a due date.", "Chapter 2: a book is shelved.");
const fileOf = (name, body) => ({ name, body, sha256: sha256Of(body) });
const versionHash = (files) => sha256Of([...files].sort((a, b) => a.name.localeCompare(b.name)).map((file) => `${file.sha256}  ${file.name}\n`).join(""));
export const POLICY_FILES = [fileOf(MAIN_FILE, MAIN_TEXT), fileOf(APPENDIX_FILE, APPENDIX_TEXT)], HANDBOOK_FILES = [fileOf(HANDBOOK_FILE, HANDBOOK_TEXT)], NEWER_FILES = [fileOf(MAIN_FILE, NEWER_TEXT)];
export const VERSION_HASH = versionHash(POLICY_FILES), HANDBOOK_HASH = versionHash(HANDBOOK_FILES);
export const linksOf = (rows = [[SOURCE, VERSION, VERSION_HASH, "Chapter 1"], [HANDBOOK, HANDBOOK_VERSION, HANDBOOK_HASH, ""]]) => text("# Requirement sources of the thesis tool", "", "| Source | Version | Hash | Part |",
  "|---|---|---|---|", ...rows.map(([id, version, hash, part]) => `| ${id} | ${version} | ${hash} | ${part} |`));
/** The register entry of a source with `versions` ([{ version, files }]); `tampered` names a file ({ version, file }) whose recorded SHA-256 is wrong. */
export function registerEntry({ id, title, authority, versions, tampered = null }) {
  const sha = (version, file) => (tampered && tampered.version === version && tampered.file === file.name ? "0".repeat(64) : file.sha256);
  return text("---", `id: ${id}`, `title: ${title}`, "kind: document", `authority: ${authority}`, "licence: may be republished - fixture", "---", `# ${id} ${title}`, "", "## Versions", "",
    "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
    ...versions.map(({ version, files }) => `| ${version} | ${version} | fixture | fixture | ${files.length} files, listed below; version hash \`${versionHash(files)}\` |`), "",
    ...versions.flatMap(({ version, files }) => [`### Files of ${version}`, "", "| File | SHA-256 |", "|---|---|", ...files.map((file) => `| \`${file.name}\` | \`${sha(version, file)}\` |`), ""]),
    "## Parts", "", "- Chapter 1", "- Appendix");
}
/** The instance's files for the two sources; `policyVersions` the versions of SRC-policy it registers, `tampered` as registerEntry takes it. */
export function sourceFiles({ policyVersions = [{ version: VERSION, files: POLICY_FILES }], tampered = null } = {}) {
  const content = (id, versions) => Object.fromEntries(versions.flatMap(({ version, files }) => files.map((file) => [`docs/sources/${id}/${version}/${file.name}`, file.body])));
  return { [`docs/sources/${SOURCE}.md`]: registerEntry({ id: SOURCE, title: "Library Policy", authority: "normative", versions: policyVersions, tampered }),
    [`docs/sources/${HANDBOOK}.md`]: registerEntry({ id: HANDBOOK, title: "Library Handbook", authority: "informational", versions: [{ version: HANDBOOK_VERSION, files: HANDBOOK_FILES }] }),
    ...content(SOURCE, policyVersions), ...content(HANDBOOK, [{ version: HANDBOOK_VERSION, files: HANDBOOK_FILES }]) };
}

// One open change queue of the product: entry 01 proposes the new section "## 2. Renewals" with A MEMBER CAN RENEW ONCE.
export const QUEUE = "docs/spec-freigaben/2026-10-20_renewals", RENEW_RULE = "Every member renews a loan once.";
export const RENEWALS = text("## 2. Renewals", "", `**${RENEW}** *(SRC-policy, ch. 2)*`, RENEW_RULE, "*Check:* `tests/renew.test.mjs`");
export const OPEN_QUEUE = {
  [`${QUEUE}/index.md`]: text("# SPEC approvals - queue 2026-10-20 · renewals", "", "**Zieldatei aller Einträge:** `SPEC.md`", "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |",
    "|---|---|---|---|---|", "| 01 | `SPEC.md` | ## 2. Renewals | — | — |"),
  [`${QUEUE}/entscheidungen.md`]: text("# Decisions - queue 2026-10-20 renewals", "", "Append-only."),
  [`${QUEUE}/01-renewals.md`]: RENEWALS,
  [`${QUEUE}/01-renewals.begruendung.md`]: text("# 2. Renewals: added", "", "**The change.** Adds a section.", "", "**Why.** Members renew.", "", "**Impact list.**", `- ${RENEW}: new; nothing names it yet.`, "",
    "**Origin.** fixture."),
};
// A use case that realises A LOAN HAS A DUE DATE, so that the impact list of a change of that requirement names it.
export const USE_CASE = text("---", "id: UC-001", "title: Lend a book", "area: lending", "actors:", "  - Member", "realises:", `  - ${LOAN}`, "---", "# UC-001 Lend a book", "",
  `**Goal.** A member borrows a book, as ${LOAN} says.`);
export const PRODUCT_FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, "docs/sources.md": linksOf(), "docs/use-cases/UC-001-lend-a-book.md": USE_CASE, ...OPEN_QUEUE };

// ---------------------------------------------------------------- the participants

const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => { try { return readFileSync(new URL(path, ROOT), "utf8"); } catch { return null; } };
const REGISTER_HEAD = onDisk("docs/participants.md").split("\n").filter((line, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
export const participantRow = (name, { context = 200000, place = "this machine", model = "model-a" } = {}) => `| ${name} | model endpoint | ${model} | ${context} | - | draft text | ${place} | endpoint ep1 |`;
export const registerOf = (...rows) => `${REGISTER_HEAD}\n${rows.join("\n")}\n`;
export const DRAFTER = participantRow("drafter-a");
export const CHAPTER_EIGHT = "docs/sources/SRC-vibe-coding/2026-10-05/08_requirements-engineering.md";

// ---------------------------------------------------------------- the hosts

/** The product: a repository in memory with a history, a Host that keeps to MOD-repository-hosts' interface, every commit recorded with its message. */
export function fakeProduct(files = PRODUCT_FILES) {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`uc005 commit ${++made}`).digest("hex");
    commits.set(sha, { tree, parent });
    return sha;
  };
  head = commitOf(new Map(Object.entries(files)), null);
  const snapshotAt = (sha, ref) => {
    const { tree } = commits.get(sha);
    return withStoredGraph({ repository: ON_GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null), blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) });
  };
  return {
    files: () => Object.fromEntries(commits.get(head).tree), head: () => head,
    writes: () => calls.map((change) => change),
    land(changed) { head = commitOf(new Map([...commits.get(head).tree, ...Object.entries(changed)]), head); },
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        if (ref === "trunk") return snapshotAt(head, "trunk");
        if (commits.has(ref)) return snapshotAt(ref, ref);
        throw failure("NotFound", `${ref} was not found`);
      },
      async readHistory() { return []; },
      async commitFiles(change) {
        calls.push(structuredClone(change));
        if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((file) => [file.path, file.text])]), head);
        return { commit: head, url: `${PRODUCT_ADDRESS}/commit/${head}` };
      },
    },
  };
}

export const INSTANCE_COMMIT = "abc123def4567890abc123def4567890abc123de";
export const INSTANCE_SPEC = text("# Agent M - Specification", "", "## Process", "", "**EVERY GATE NAMES WHO DECIDES IT** *(PO A. Maier)*", "Every gate names who decides it.", "*Check:* `tests/gate.test.mjs`");
/** The instance: the register of participants and of sources, read-only; with `spec`, its own SPEC and a host that takes commits — the repository a candidate that constrains the process is written to. */
export function fakeInstance({ register = registerOf(DRAFTER), entries = sourceFiles(), spec = null } = {}) {
  const calls = [];
  const snapshot = { repository: INSTANCE_ON_GITHUB, ref: "main", commit: INSTANCE_COMMIT, paths: [...Object.keys(entries), ...(spec ? ["SPEC.md"] : [])].sort(),
    read: async (path) => (path === "docs/participants.md" ? register : path === "SPEC.md" ? spec : path in entries ? entries[path] : onDisk(path)), blob: () => null };
  return { writes: () => calls.map((change) => change), host: {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: Boolean(spec), archived: false, description: "" }; },
    async readSnapshot() { return snapshot; },
    async readHistory() { return []; },
    async commitFiles(change) { calls.push(structuredClone(change)); return { commit: "f".repeat(40), url: `${INSTANCE_ADDRESS}/commit/${"f".repeat(40)}` }; },
  } };
}

// ---------------------------------------------------------------- the model endpoint

export const ENDPOINT = "https://ep1.example.test/v1/chat/completions";
export const candidate = (name, fields = {}) => ({ name, rule: `${name.toLowerCase()} rule.`, check: "`tests/fixture.test.mjs`", constrains: "product", passage: "ch. 1", class: "new", ...fields });
const realFetch = globalThis.fetch;
/**
 * endpointAnswers(script) — the global `fetch` as a model endpoint behind https://ep1.example.test and nothing else. `script` is a draft, a list of drafts (the n-th request gets the n-th, the last one every later request),
 * or a function ({ n, prompt }) -> { draft, answers? } | string that answers the n-th request (counted from 1) and may read the prompt it received. Returns the requests received: { n, prompt, body }.
 */
export function endpointAnswers(script) {
  const requests = [];
  globalThis.fetch = async (url, init = {}) => {
    if (String(url) !== ENDPOINT) throw new TypeError(`the test's network refuses ${url}`);
    const body = JSON.parse(init.body);
    const prompt = body.messages.map((message) => (typeof message.content === "string" ? message.content : JSON.stringify(message.content))).join("\n");
    const request = { n: requests.length + 1, prompt, body };
    requests.push(request);
    const given = typeof script === "function" ? script(request) : Array.isArray(script) ? script[Math.min(request.n, script.length) - 1] : script;
    const content = typeof given === "string" ? given : JSON.stringify(given.draft === undefined ? { draft: given, answers: [] } : { answers: [], ...given });
    return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
  return requests;
}
export const restoreFetch = () => { globalThis.fetch = realFetch; };
/** The findings a prompt of a later round lists, each as the one line MOD-text-tools gives it (`<artifact>:<line>: <kind>: <what> [<rule>] — <fix>`). */
export const findingLines = (prompt) => prompt.split("\n").filter((line) => /^[^\s].*:\d+: (error|warning): .* \[[A-Z][^\]]*\] — /.test(line));

// ---------------------------------------------------------------- the page

const route = view.routes.find((each) => each.name === "spec-entry");
export const find = (root, match) => {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
};
const clickOn = (node) => node.dispatchEvent(new Event("click"));

/**
 * world({ files, instance, token, answers }) — a product and an instance behind fixture hosts and a store holding the person's token and the endpoint ep1; `answers` as endpointAnswers takes them (default: none, nothing is answered until a
 * test calls it). -> { product, instance, requests, draw(params), derive(options), run(page), ... }.
 */
export async function world({ files = PRODUCT_FILES, instance = {}, token = true, answers = null } = {}) {
  const product = fakeProduct(files), other = fakeInstance(instance);
  const requests = answers === null ? [] : endpointAnswers(answers);
  const store = openStore("alice/agent-m");
  if (token) writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  writeSetting(store, "endpoint:ep1", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "m", throughBridge: false });
  const context = { page: "review", instance: { repository: "alice/agent-m", host: other.host }, store, go() {}, product: { address: PRODUCT_ADDRESS, kind: "github", host: product.host } };
  const draw = async (params = { id: "draft" }) => {
    const target = document.createElement("div");
    document.body.append(target);
    await route.render(target, context, params);
    return target;
  };
  const w = { product, instance: other, requests, context, draw,
    /** Answers from `script` from now on; the requests received since are in the returned list. */
    answer(script) { const list = endpointAnswers(script); w.requests = list; return list; },
    /** The proposals the product received: the commits that wrote files below docs/spec-freigaben/ of a new queue (an `index.md` among them). */
    proposals: () => product.writes().filter((change) => change.files.some((file) => /^docs\/spec-freigaben\/[^/]+\/index\.md$/.test(file.path) && !(file.path in OPEN_QUEUE))),
    /** The job records the product received. */
    records: () => product.writes().flatMap((change) => change.files.filter((file) => /^docs\/jobs\/[^/]+\.md$/.test(file.path)).map((file) => ({ ...file, message: change.message }))),
  };
  /** The draft page with the source chosen (`source`: the linked source to choose, default the first; `files`: the file names of it to send, default all), the participant chosen and Show the run panel pressed; -> { page, panel, problem }. */
  w.prepare = async ({ page = null, source = null, files: names = null, participant = "drafter-a", params } = {}) => {
    const target = page ?? await draw(params);
    if (source) for (const radio of byClass(target, "input", "source")) radio.checked = radio.value === source;
    const item = byClass(target, "li", "source").find((each) => each.getAttribute("data-source") === (source ?? byClass(target, "input", "source").find((radio) => radio.checked)?.value));
    if (names) for (const box of byClass(item, "input", "source-file")) box.checked = names.includes(box.value);
    for (const radio of byClass(target, "input", "participant")) radio.checked = radio.value === participant;
    const chosen = byClass(target, "input", "participant").find((each) => each.value === participant);
    if (chosen) chosen.dispatchEvent(new Event("change"));
    clickOn(byClass(target, "button", "prepare")[0]);
    await until(() => byClass(target, "section", "run-panel").length === 1 || byClass(target, "p", "problem").length > 0, "the run panel or a problem");
    return { page: target, panel: byClass(target, "section", "run-panel")[0] ?? null, problem: byClass(target, "p", "problem")[0]?.textContent ?? null };
  };
  /** Presses Run on a prepared page and waits for the candidates; -> the panel of the candidates. */
  w.run = async (prepared) => {
    const run = find(prepared.page, (node) => node.localName === "button" && node.textContent === "Run")[0];
    clickOn(run);
    await until(() => byClass(prepared.page, "section", "requirements-result").length === 1 || byClass(prepared.page, "p", "result").length > 0, "the candidates");
    return byClass(prepared.page, "section", "requirements-result")[0] ?? null;
  };
  return w;
}

// ---------------------------------------------------------------- reading the panel of the candidates

export const itemOf = (panel, name) => byClass(panel, "li", "candidate").find((each) => each.getAttribute("data-name") === name);
export const groupsOf = (panel) => Object.fromEntries(byClass(panel, "section", "candidate-group").map((group) => [group.getAttribute("data-class"), byClass(group, "li", "candidate").map((item) => item.getAttribute("data-name"))]));
export const classOf = (panel, name) => byClass(itemOf(panel, name), "select", "class")[0].value;
export function setClass(panel, name, value, of = null) {
  const item = itemOf(panel, name);
  const select = byClass(item, "select", "class")[0];
  select.value = value;
  select.dispatchEvent(new Event("change"));
  if (of !== null) { byClass(item, "input", "of")[0].value = of; byClass(item, "input", "of")[0].dispatchEvent(new Event("input")); }
}
export const press = (panel, className) => clickOn(byClass(panel, "button", className)[0]);
export async function write(page) {
  const panel = byClass(page, "section", "requirements-result")[0];
  press(panel, "write-proposals");
  await until(() => byClass(panel, "p", "written").length === 1 || byClass(panel, "p", "result").length > 0, "the write result");
  return byClass(panel, "p", "written")[0]?.textContent ?? byClass(panel, "p", "result")[0]?.textContent ?? null;
}
/** The files of a written queue: the path -> text of every file of the commits below docs/spec-freigaben/ that a new queue holds. */
export function writtenFiles(w) {
  return Object.fromEntries(w.proposals().flatMap((change) => change.files.filter((file) => file.path.startsWith("docs/spec-freigaben/")).map((file) => [file.path, file.text])));
}
