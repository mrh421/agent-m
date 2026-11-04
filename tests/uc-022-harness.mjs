// The harness of the system and release tests of UC-022 (Derive the system architecture from requirements and use cases): the product is a repository in memory behind a Host that keeps to MOD-repository-hosts' interface
// (repositoryInfo, readSnapshot, readFileAt, readHistory, issueCounts, commitFiles made only on the head that was read, else `Moved`), every commit recorded; the instance is a read-only snapshot of this
// repository, whose book and AGENTS.md are read from the disk, with the register of participants the test gives. The routes `decision/draft`, `decision/all` and `decision/<id>` of MOD-review-pages are
// drawn into the fixture DOM of tests/review-pages-harness.mjs; the model endpoints and the package registry are a fake `fetch` that answers the envelopes and the packages it is given in turn and records
// every request. The real MOD-review-pages, MOD-job-runner, MOD-job-catalogue, MOD-reuse-facts, MOD-approvals, MOD-artifact-edits, MOD-documents, MOD-trace-graph, MOD-runtimes, MOD-job-ledger,
// MOD-spec-changes, MOD-source-register and MOD-participant-list run as they are. Nothing reaches the network. It holds no test and no expected result: what it builds are inputs, and every test
// states its own expected values.
// Imported by tests/system-uc-022-derive-the-architecture.test.mjs and tests/release-uc-022-derive-the-architecture.test.mjs.
//
// Module: MOD-review-pages
// Module: MOD-job-runner
// Module: MOD-reuse-facts
// Module: MOD-approvals
// Module: MOD-artifact-edits
// Level: system
//
// Authored by developer-sonnet-k (ITM-448). The Agent-M-Participant trailers of the code of UC-022 (git log --format='%h %(trailers:key=Agent-M-Participant)' -- src/review-pages src/job-runner src/reuse-facts
// src/approvals src/artifact-edits src/job-catalogue src/runtimes src/job-ledger src/documents) name developer-sonnet-k for ITM-1318 (review-architecture names whole-architecture after accepted-use-cases),
// ITM-1317 (classifyCandidates leaves the artifact a candidate changes out of the search for a duplicate), ITM-1271 (the notes of the job that wrote a file), ITM-1355 (the links of a product's review page keep
// the product), ITM-1378 (queueJob names the endpoint and the secret on the CI route), ITM-1384, ITM-1349, ITM-1350, ITM-1346, ITM-1357, ITM-1358, ITM-1359 and ITM-1067 among others; most of the other commits
// there carry no trailer, so that their authors cannot be read. The release test file leaves the cases that guard that behaviour to another writer, and says which.
//
// The product is alice/library with the SPEC rules A LOAN HAS A DUE DATE and A BOOK IS SHELVED, a LICENSE (MIT), and the use cases UC-001 and UC-002, both accepted by a record, each with a Mermaid diagram. The
// instance holds the participants drafter-a (model-a, endpoint ep1), reviewer-b (model-b, ep2), twin-a (model-a, ep3), far-c (a server in Singapore), small-d (a context of 50000 tokens) and ci-agent (a CI agent),
// and a person who cannot draft text.

import "./review-pages-harness.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { approvalSchema } from "../src/approvals/index.mjs";
import { writeDocument } from "../src/documents/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

export const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
export const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
// Each route as the frame shows it: the one its `module` gives, which carries `leave` and `unsaved` (MOD-site-frame's Route).
const routes = Object.fromEntries(await Promise.all((pages.view?.routes ?? []).map(async (each) => [each.name, await each.module()])));
export const route = routes.decision;
(pages.view?.strategies ?? []).forEach((strategies, at) => registerStrategies(`tests/uc-022-harness.mjs#${at}`, strategies));

// ---------------------------------------------------------------- the product

export const text = (...lines) => `${lines.join("\n")}\n`;
export const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
export const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/library", web: "https://github.com/alice/library" };
export const TOKEN = { value: "github_pat_ALICElibraryTOOL0123456789abcdef", name: "Agent M · library", expires: "2027-01-01" };
export const KEY = "sk-UC022-FIXTURE-KEY-0123456789";
export const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED";
export const SPEC = text("# Library — Specification", "", "## Lending", "", `**${LOAN}** *(Product Owner)*`, "Every loan states the date by which the book is returned.",
  "*Check:* `tests/loan.test.mjs`", "", `**${SHELF}** *(Product Owner)*`, "Every book stands on a shelf.", "*Check:* `tests/shelf.test.mjs`");

/** useCase(id, title, realises) — a use case in the five parts of the format, with a Mermaid diagram, as MOD-documents' schema `use-case` reads it. */
export function useCase(id, title, realises) {
  return text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:", ...realises.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "",
    `**Goal.** ${title}.`, "", "## Actors", "", "- **Member**", "", "## Precondition", "", "- The member is signed in.", "", "## Main flow", "", "1. The member picks a book.", "2. The member confirms.", "",
    "```mermaid", "sequenceDiagram", "    actor M as Member", "    participant D as Desk", "    M->>D: picks a book", "    D-->>M: confirms", "```", "",
    "## Alternative flows", "", "- **1a. The book is out.** The member is told when it is back.", "", "## Postcondition", "", "- The loan states its due date.").replace(/\n$/, "");
}
export const UC1_PATH = "docs/use-cases/UC-001-check-out-a-book.md", UC2_PATH = "docs/use-cases/UC-002-shelve-a-book.md";
export const UC1 = useCase("UC-001", "Check out a book", [LOAN]), UC2 = useCase("UC-002", "Shelve a book", [SHELF]);
/** The approval record by which a person accepts the text `body` of the file at `path`, as MOD-approvals writes it: { path, text }. */
export const approvalOf = (path, body, kind = "use-case") => {
  const id = /(UC-\d+|ARC-\d+|MOD-[a-z0-9-]+)(?=-|\.md)/.exec(path.split("/").at(-1))[0];
  return { path: `docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text: writeDocument(approvalSchema, { fields: { kind, file: path, blob: blobOf(body) } }) };
};
const recorded = (path, body) => { const record = approvalOf(path, body); return { [record.path]: record.text }; };
/** A product from which the first architecture can be derived: both use cases accepted, no architecture, no open SPEC change, a LICENSE. */
export const READY = { "README.md": "# Library\n", "LICENSE": "MIT License\n", "SPEC.md": SPEC, [UC1_PATH]: UC1, [UC2_PATH]: UC2, ...recorded(UC1_PATH, UC1), ...recorded(UC2_PATH, UC2) };
export const WORKFLOW = ".github/workflows/agent-m-jobs.yml";
export const QUEUE = "docs/spec-freigaben/2026-10-01_lending";
/** The product without the files `names` name, or without the files whose path starts with a name. */
export const without = (files, ...names) => Object.fromEntries(Object.entries(files).filter(([path]) => !names.some((name) => path === name || path.startsWith(name))));

// ---------------------------------------------------------------- the draft of a first architecture

export const ARC_DRAFT = "docs/architecture/ARC-900-system.md", SUB_DRAFT = "docs/architecture/ARC-901-lending.md", REUSE_DRAFT = "docs/architecture/ARC-902-the-loan-package.md";
export const MOD_DRAFT = "docs/architecture/MOD-lending.md";
const MERMAID = ["", "```mermaid", "flowchart LR", "    Desk --> Shelf", "```", ""];
/** decision({ id, title, forced, refines, designs, sections }) — an architecture decision in the four sections of the format, with a Mermaid diagram under Decision. */
export const decision = ({ id, title, forced = [LOAN, SHELF, "UC-001", "UC-002"], refines = null, designs = [], sentence = "The library is a desk and a shelf.", reuse = null, drop = [] }) => {
  const section = (heading, ...body) => (drop.includes(heading) ? [] : [`## ${heading}`, "", ...body, ""]);
  return text("---", `id: ${id}`, `title: ${title}`, ...(refines ? [`refines: ${refines}`] : []), "forced_by:", ...forced.map((name) => `  - ${name}`),
    ...(designs.length ? ["designs:", ...designs.map((name) => `  - ${name}`)] : []), "---", `# ${id} ${title}`, "", ...section("Context", "The lending system manages loans and shelves."),
    ...(drop.includes("Decision") ? [] : ["## Decision", "", reuse ? "The package below is reused." : sentence, ...(reuse ? ["", "| Candidate | Ecosystem | Repository | Role |", "|---|---|---|---|",
      `| ${reuse.candidate} | npm | ${reuse.repository ?? ""} | chosen |`] : []), ...MERMAID]),
    ...section("Alternatives", ...(reuse ? ["| Candidate | Ecosystem | Repository |", "|---|---|---|", `| ${reuse.alternative} | npm | |`] : ["One module for everything."])),
    ...section("Consequences", "The system is two folders.")).replace(/\n$/, "");
};
/** moduleFile({ id, follows, realises }) — a module file in the seven parts of the format. */
export const moduleFile = ({ id = "MOD-lending", title = "Lending", folder = "src/lending/", follows = "ARC-901", realises = [LOAN, "UC-001"], uses = [], drop = [] } = {}) => {
  const section = (heading, ...body) => (drop.includes(heading) ? [] : [`## ${heading}`, "", ...body, ""]);
  return text("---", `id: ${id}`, `title: ${title}`, `folder: ${folder}`, "realises:", ...realises.map((name) => `  - ${name}`), "follows:", `  - ${follows}`, "uses:", ...uses.map((name) => `  - ${name}`),
    "provides:", "  - loans", "---", `# ${id} ${title}`, "", ...section("Responsibility", "It manages loans and returns."), ...section("Parts", "- `index.mjs`"), ...section("Data", "No data is stored."),
    ...section("Interfaces", "- `loans` — records and returns loans."), ...section("Files", "It writes no files."), ...section("Uses", ...(uses.length ? uses.map((name) => `- ${name}`) : ["None."]))).replace(/\n$/, "");
};
/**
 * draftOf({ candidate, alternative, repository, system }) — the files a drafter returns for the first architecture: the decision that states the system (ARC-900), the decision of the subsystem
 * (ARC-901, refines ARC-900, designs MOD-lending), the further decision that adopts a package (ARC-902: the chosen `candidate` against the `alternative`), and the module file MOD-lending.
 */
export const draftOf = ({ candidate = "loan-lib", alternative = "shelf-lib", repository = "", system = {} } = {}) => ({ files: [
  { path: ARC_DRAFT, text: decision({ id: "ARC-900", title: "The library system", designs: [], ...system }), class: "new" },
  { path: SUB_DRAFT, text: decision({ id: "ARC-901", title: "Lending", refines: "ARC-900", forced: [LOAN, "UC-001"], designs: ["MOD-lending"], sentence: "Lending is one module." }), class: "new" },
  { path: REUSE_DRAFT, text: decision({ id: "ARC-902", title: "The loan package", refines: "ARC-900", forced: [LOAN], reuse: { candidate, alternative, repository } }), class: "new" },
  { path: MOD_DRAFT, text: moduleFile(), class: "new" },
] });
/** An envelope of the model endpoint: its draft, and its answers to the findings of the last round. */
export const reply = (draft, answers = []) => ({ draft, answers });

// ---------------------------------------------------------------- the product's host

let products = 0;
/**
 * fakeProduct(files) — the product behind a Host of the tests' own: `files()` the default branch's files, `writes()` the commits made (each { branch, expectedHead, files, message }), `host`.
 * The default branch is `main`. Each snapshot serves the graph the push job stores for its commit (tests/stored-graph-fake.mjs), which a page reads and never builds.
 */
export function fakeProduct(files = READY, { canWrite = true } = {}) {
  const calls = [], commits = new Map(), product = ++products;
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`uc022 product ${product} commit ${++made}`).digest("hex");
    commits.set(sha, { tree, parent });
    return sha;
  };
  head = commitOf(new Map(Object.entries(files)), null);
  const snapshotAt = (sha, ref) => {
    const { tree } = commits.get(sha);
    return withStoredGraph({ repository: ON_GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) });
  };
  return {
    files: () => Object.fromEntries(commits.get(head).tree),
    writes: () => calls.map((call) => call.change),
    head: () => head,
    /** Another writer's commit on the default branch, made without the page: `changed` puts texts in place of paths. */
    land(changed) { head = commitOf(new Map([...commits.get(head).tree, ...Object.entries(changed)]), head); },
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite, archived: false, description: "" }; },
      async readSnapshot(ref) {
        if (ref === "main") return snapshotAt(head, "main");
        if (commits.has(ref)) return snapshotAt(ref, ref);
        throw failure("NotFound", `${ref} was not found`);
      },
      async readFileAt(path, shas) { return new Map(shas.map((sha) => [sha, commits.get(sha)?.tree.get(path) ?? null])); },
      async readHistory() { return []; },
      async issueCounts() { return { open: 2, closed: 5 }; },
      async commitFiles(change) {
        calls.push({ change: structuredClone(change) });
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((file) => [file.path, file.text])]), head);
        return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the instance

const ROOT = new URL("../", import.meta.url);
export const onDisk = (path) => { try { return readFileSync(new URL(path, ROOT), "utf8"); } catch { return null; } };
const REGISTER_HEAD = onDisk("docs/participants.md").split("\n").filter((line, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
export const registerOf = (...rows) => `${REGISTER_HEAD}\n${rows.join("\n")}\n`;
export const row = (name, model, place, route, context = 300000) => `| ${name} | model endpoint | ${model} | ${context} | — | draft text | ${place} | ${route} |`;
export const DRAFTER_ROW = row("drafter-a", "model-a", "this machine", "endpoint ep1");
export const REVIEWER_ROW = row("reviewer-b", "model-b", "this machine", "endpoint ep2");
export const TWIN_ROW = row("twin-a", "model-a", "this machine", "endpoint ep3");
export const FAR_ROW = row("far-c", "model-c", "a server in Singapore", "endpoint ep4");
export const SMALL_ROW = row("small-d", "model-d", "this machine", "endpoint ep5", 50000);
export const CI_ROW = "| ci-agent | CI agent | model-x | 300000 | — | draft text | GitHub Actions in the USA | ci hosted secret CI_KEY |";
export const READER_ROW = "| reader | person | — | — | — | read the repository | — | the GitHub account `reader` |";
export const SECRET_LINK = text("# Requirement sources of the library", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| SRC-secret | 1 | ${"ab".repeat(32)} | |`);
export const SECRET_ENTRY = text("---", "id: SRC-secret", "title: Secret rules", "kind: document", "authority: normative", "licence: restricted — internal use only", "places:", "  - this machine", "---",
  "# SRC-secret Secret rules", "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|", "| 1 | 2026-10-01 | v1 | here | 1 file |");
export const INSTANCE_COMMIT = "abc123def4567890abc123def4567890abc123de";
export function fakeInstance(register, entries = {}) {
  const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" }, ref: "main", commit: INSTANCE_COMMIT, paths: Object.keys(entries),
    read: async (path) => (path === "docs/participants.md" ? register : path in entries ? entries[path] : onDisk(path)), blob: () => null };
  return { snapshot, host: { async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
    async readSnapshot() { return snapshot; } } };
}

// ---------------------------------------------------------------- the model endpoints and the package registry

export const realFetch = globalThis.fetch;
const NPM = "https://registry.npmjs.org/", DOWNLOADS = "https://api.npmjs.org/downloads/point/last-month/";
/** The record of a package of the npm registry as the registry serves it: its licence, its releases with their dates, its repository. */
export const packageData = (licence, repository = "https://github.com/alice/loan-lib") => ({ license: licence, repository: { url: repository }, "dist-tags": { latest: "1.1.0" },
  versions: { "1.0.0": {}, "1.1.0": {} }, time: { "1.0.0": "2024-01-01T00:00:00.000Z", "1.1.0": "2025-01-01T00:00:00.000Z" } });
export const registryOf = (...packages) => Object.fromEntries(packages.flatMap(([name, licence]) => [[`${NPM}${name}`, packageData(licence)], [`${DOWNLOADS}${name}`, { downloads: 1234 }]]));
/**
 * endpoints({ drafter, reviewer, registry }) — the model endpoints ep1 (the drafter) and ep2 (the reviewer) and the registry behind the global `fetch`: each endpoint answers the envelopes given in turn
 * (the last again), each { draft, answers }, as an OpenAI-compatible endpoint does; a reviewer's envelope holds `{ findings }` as its draft; an address of `registry` answers its value as JSON — an Error value is
 * thrown as a browser's blocked call —, any other address of the registry answers 404 and any other origin is refused.
 * -> { drafter, reviewer, registry } the requests, each { address, headers, body, sent: the messages' text joined }; `outside` holds the requests to any other address, which the test's network refuses.
 */
export function endpoints({ drafter = [reply({ files: [] })], reviewer = [reply({ findings: [] })], registry = {} } = {}) {
  const seen = { drafter: [], reviewer: [], registry: [], outside: [] };
  const queues = { ep1: [...drafter], ep2: [...reviewer] };
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  globalThis.fetch = async (input, init = {}) => {
    const address = String(input?.url ?? input), url = new URL(address);
    const name = /^(ep\d)\.example\.test$/.exec(url.hostname)?.[1];
    if (name && queues[name]) {
      const body = init.body ?? "";
      const request = { address, headers: init.headers ?? {}, body, sent: JSON.parse(body).messages.map((message) => message.content).join("\n") };
      (name === "ep1" ? seen.drafter : seen.reviewer).push(request);
      const queue = queues[name], envelope = queue.length > 1 ? queue.shift() : queue[0];
      return json({ choices: [{ message: { content: JSON.stringify(envelope) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    }
    if (url.hostname === "registry.npmjs.org" || url.hostname === "api.npmjs.org") {
      seen.registry.push(address);
      const answer = registry[address];
      if (answer instanceof Error) throw answer;
      return answer === undefined ? json({ message: "not found" }, 404) : json(answer);
    }
    seen.outside.push(address);
    throw new TypeError(`the test's network refuses ${address}`);
  };
  return seen;
}

// ---------------------------------------------------------------- the page

export function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
export const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
export const click = (node) => node.dispatchEvent(new Event("click"));
export async function until(condition, what) {
  const limit = Date.now() + 5000;
  while (Date.now() < limit) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`waited for ${what}`);
}
export const runButtons = (root) => find(root, (node) => node.localName === "button" && node.textContent === "Run");
export const REGISTER = registerOf(DRAFTER_ROW, REVIEWER_ROW, TWIN_ROW, FAR_ROW, SMALL_ROW, CI_ROW, READER_ROW);

/**
 * The route decision (or the route `at` names) drawn for the id in `params` ({ id: "draft" } is the drafting page, { id: "all" } Review all, {} the list), with the person's token for the product unless
 * `token` is false. -> the element.
 */
export async function show(fake, params = { id: "draft" }, { register = REGISTER, entries = {}, token = true, store = null, at = "decision" } = {}) {
  assert.ok(routes[at], `the route ${at}: ${pages.error?.message}`);
  const kept = store ?? openStore(token ? "alice/agent-m" : "nobody/agent-m");
  if (token) writeSetting(kept, "github-token:alice/library", TOKEN);
  for (const name of ["ep1", "ep2", "ep3", "ep4", "ep5"]) writeSetting(kept, `endpoint:${name}`, { url: `https://${name}.example.test/v1`, kind: "openai-compatible", model: "m", throughBridge: false, key: KEY });
  const target = document.createElement("div");
  document.body.append(target);
  const context = { page: "review", instance: { repository: "alice/agent-m", host: fakeInstance(register, entries).host }, store: kept, go() {}, product: { address: ON_GITHUB.web, kind: "github", host: fake.host } };
  await routes[at].render(target, context, params);
  return target;
}
export const participantNames = (target, role = "participant") => byClass(target, "li", role).map((item) => item.getAttribute("data-name")).sort();
export function choose(target, role, name) {
  const box = byClass(target, "input", role).find((each) => each.value === name);
  assert.ok(box, `${name} is offered as ${role}`);
  for (const other of byClass(target, "input", role)) other.checked = false; // a browser unchecks the other radios of the group
  box.checked = true;
  box.dispatchEvent(new Event("change"));
}
/** The drafter and the reviewer chosen and the run panel shown. -> the panel. */
export async function panelFor(target, drafter = "drafter-a", reviewer = "reviewer-b") {
  choose(target, "participant", drafter);
  if (reviewer) choose(target, "reviewer", reviewer);
  click(byClass(target, "button", "prepare")[0]);
  await until(() => byClass(target, "section", "run-panel").length === 1 || byClass(target, "p", "problem").length > 0, "the run panel");
  return byClass(target, "section", "run-panel")[0];
}
/** Run pressed on the panel and the draft waited for. -> the element. */
export async function run(target) {
  click(runButtons(target)[0]);
  await until(() => byClass(target, "section", "architecture-result").length === 1 || byClass(target, "p", "queued").length === 1 || byClass(target, "p", "result").length > 0, "the result of the job");
  return target;
}
/** The drafting page, the participants chosen, the panel shown and Run pressed. -> the element. */
export async function derive(fake, { drafter = "drafter-a", reviewer = "reviewer-b", options = {} } = {}) {
  const target = await show(fake, { id: "draft" }, options);
  await panelFor(target, drafter, reviewer);
  return run(target);
}
/** The textarea of the drafted file at `path` on the page that shows the draft. */
export const editorOf = (target, path) => byClass(target, "textarea", "draft-text").find((box) => box.getAttribute("data-path") === path);
/** Write proposals pressed and the result waited for: the line that says what was written, or the refusal. -> the element. */
export async function writeProposals(target) {
  click(byClass(target, "button", "write-proposals")[0]);
  await until(() => byClass(target, "p", "written").length === 1 || byClass(target, "p", "due-diligence-missing").length === 1 || byClass(target, "p", "result").length > 0, "the result of Write proposals");
  return target;
}
/** The record of the newest job of the product: { path, text }. */
export function jobRecord(fake) {
  const paths = Object.keys(fake.files()).filter((path) => /^docs\/jobs\/JOB-.*\.md$/.test(path)).sort();
  return { path: paths.at(-1), text: fake.files()[paths.at(-1)] };
}
/** The commits of the product that wrote a file below `folder` (not the job's record). */
export const writesTo = (fake, folder) => fake.writes().filter((change) => change.files.some((file) => file.path.startsWith(folder)));
export const architecturePaths = (fake) => Object.keys(fake.files()).filter((path) => path.startsWith("docs/architecture/")).sort();
/** The approval records the product holds, by path. */
export const recordsOf = (fake) => Object.keys(fake.files()).filter((path) => path.startsWith("docs/approvals/")).sort();
/** The status the list of the route `at` shows for the file `id` — open, accepted, changed since acceptance —, or null where the list has no row for it. */
export async function badge(fake, id, at = "decision") {
  const list = await show(fake, {}, { at });
  const row = find(list, (node) => node.localName === "tr" && node.getAttribute("data-id") === id)[0];
  return row ? (byClass(row, "span", "badge")[0]?.textContent ?? null) : null;
}
export const filesOf = (target) => byClass(target, "section", "review-file").map((section) => section.getAttribute("data-id"));
export const fileOf = (target, id) => byClass(target, "section", "review-file").find((section) => section.getAttribute("data-id") === id);
