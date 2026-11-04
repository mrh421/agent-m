// The harness of the system and release tests of UC-007 (Derive use cases from requirements): the product is a repository in memory behind a Host that keeps to MOD-repository-hosts' interface
// (repositoryInfo, readSnapshot, readHistory, commitFiles made only on the head that was read, else `Moved`), every commit recorded; the instance is a read-only snapshot of this repository, whose book
// and AGENTS.md are read from the disk, with the register of participants the test gives. The drafting page of the use cases (`use-case/draft`) is drawn into the fixture DOM of
// tests/review-pages-harness.mjs; the model endpoint is a fake `fetch` that answers the envelopes it is given in turn and records every request. The real MOD-review-pages, MOD-job-runner,
// MOD-job-catalogue, MOD-artifact-edits, MOD-documents, MOD-trace-graph, MOD-approvals, MOD-spec-changes, MOD-source-register, MOD-runtimes and MOD-job-ledger run as they are. Nothing reaches the
// network. It holds no test and no expected result: what it builds are inputs, and every test states its own expected values.
// Imported by tests/system-uc-007-derive-use-cases-from-requirements.test.mjs and tests/release-uc-007-derive-use-cases-from-requirements.test.mjs.
//
// Module: MOD-review-pages
// Module: MOD-artifact-edits
// Module: MOD-job-runner
// Module: MOD-job-catalogue
// Module: MOD-job-ledger
// Module: MOD-runtimes
// Module: MOD-approvals
// Module: MOD-documents
// Level: system
//
// Authored by developer-sonnet-k (ITM-580). The Agent-M-Participant trailers of the code in these modules (git log --format='%h %(trailers:key=Agent-M-Participant)' -- src/review-pages src/artifact-edits
// src/job-runner) name developer-sonnet-k for ITM-1271 (the notes of the job that wrote a file, read from the job records newest first), ITM-1317 (classifyCandidates leaves the artifact a candidate
// changes out of the search for a duplicate), ITM-1349, ITM-1350 and ITM-1355 (the list's tick and the links of a product's list), ITM-1346, ITM-1357, ITM-1358 and ITM-1359 (arranging groups) among others;
// the release test file therefore leaves the cases that guard that behaviour to another writer, and says which.
//
// The product is alice/thesis-tool with the SPEC rules A LOAN HAS A DUE DATE (realised by UC-001), A BOOK IS SHELVED and A MEMBER CAN RENEW ONCE (realised by none), and the use case UC-001. The instance
// holds the participants drafter-a (a model endpoint, its model on this machine) and ci-agent (a CI agent), and a person who cannot draft text.

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
export const route = pages.view?.routes.find((candidate) => candidate.name === "use-case");
(pages.view?.strategies ?? []).forEach((strategies, at) => registerStrategies(`tests/uc-007-harness.mjs#${at}`, strategies));

// ---------------------------------------------------------------- the product

export const text = (...lines) => `${lines.join("\n")}\n`;
export const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
export const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
export const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };
export const KEY = "sk-UC007-FIXTURE-KEY-0123456789";
export const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED", RENEW = "A MEMBER CAN RENEW ONCE", UNKNOWN = "AN UNKNOWN RULE";
export const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${LOAN}** *(Product Owner)*`, "Every loan states the date by which the book is returned.",
  "*Check:* `tests/loan.test.mjs`", "", `**${SHELF}** *(Product Owner)*`, "Every book stands on a shelf.", "*Check:* `tests/shelf.test.mjs`", "",
  `**${RENEW}** *(Product Owner)*`, "A member renews a loan at most once.", "*Check:* `tests/renew.test.mjs`");

/**
 * useCase({ id, title, goal, realises, alternatives, diagram }) — a use case in the five parts of the format, with a Mermaid diagram, as MOD-documents' schema `use-case` reads it. `diagram: false`
 * leaves the diagram out; `parts` names the sections to leave out.
 */
export function useCase({ id, title, goal = `${title}.`, realises = [LOAN], alternatives = "- **1a. The book is out.** The member is told when it is back.", diagram = true, without = [] }) {
  const section = (heading, ...body) => (without.includes(heading) ? [] : [`## ${heading}`, "", ...body, ""]);
  return text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:", ...realises.map((name) => `  - ${name}`), "---", `# ${id} ${title}`, "",
    `**Goal.** ${goal}`, "", ...section("Actors", "- **Member**"), ...section("Precondition", "- The member is signed in."), ...section("Main flow", "1. The member picks a book.", "2. The member confirms."),
    ...(diagram ? ["```mermaid", "sequenceDiagram", "    actor M as Member", "    participant D as Desk", "    M->>D: picks a book", "    D-->>M: confirms", "```", ""] : []),
    ...section("Alternative flows", alternatives), ...section("Postcondition", "- The loan states its due date.")).replace(/\n$/, "");
}
export const pathOf = (id, slug) => `docs/use-cases/${id}-${slug}.md`;
export const UC1_PATH = pathOf("UC-001", "check-out-a-book");
export const UC1 = useCase({ id: "UC-001", title: "Check out a book", realises: [LOAN] });
export const FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, [UC1_PATH]: UC1 };
export const WORKFLOW = ".github/workflows/agent-m-jobs.yml";

/** The use case a drafter returns for the requirement `name`: UC-900 "Shelve a book", class new, under any slug. */
export const shelve = (realises = [SHELF], extra = {}) => ({ path: pathOf("UC-900", "shelve-a-book"), class: "new", text: useCase({ id: "UC-900", title: "Shelve a book", goal: "The member shelves a book.", realises, ...extra }) });
/** The use case a drafter returns for the requirement A MEMBER CAN RENEW ONCE: UC-901 "Renew a loan", class new. */
export const renew = (realises = [RENEW], extra = {}) => ({ path: pathOf("UC-901", "renew-a-loan"), class: "new", text: useCase({ id: "UC-901", title: "Renew a loan", goal: "The member renews a loan.", realises, ...extra }) });
/** An envelope of the model endpoint: its draft, and its answers to the findings of the last round. */
export const reply = (files, answers = []) => ({ draft: { files }, answers });

// ---------------------------------------------------------------- the product's host

let products = 0;
/**
 * fakeProduct(files) — the product behind a Host of the tests' own: `files()` the default branch's files, `writes()` the commits made (each { branch, expectedHead, files, message }), `host`.
 * The default branch is `main`. Each snapshot serves the graph the push job stores for its commit (tests/stored-graph-fake.mjs), which a page reads and never builds.
 */
export function fakeProduct(files = FILES, { canWrite = true } = {}) {
  const calls = [], commits = new Map(), product = ++products;
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`uc007 product ${product} commit ${++made}`).digest("hex");
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
export const ENDPOINT_ROW = "| drafter-a | model endpoint | example-model | 200000 | — | draft text | this machine | endpoint ep1 |";
export const SMALL_ROW = "| drafter-small | model endpoint | small-model | 2000 | — | draft text | this machine | endpoint ep2 |";
export const CI_ROW = "| ci-agent | CI agent | model-x | 200000 | — | draft text | GitHub Actions in the USA | ci hosted secret CI_KEY |";
export const READER_ROW = "| reader | person | — | — | — | read the repository | — | the GitHub account `reader` |";
export const INSTANCE_COMMIT = "abc123def4567890abc123def4567890abc123de";
export function fakeInstance(register) {
  const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" }, ref: "main", commit: INSTANCE_COMMIT, paths: [],
    read: async (path) => (path === "docs/participants.md" ? register : onDisk(path)), blob: () => null };
  return { snapshot, host: { async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
    async readSnapshot() { return snapshot; } } };
}

// ---------------------------------------------------------------- the model endpoint

export const realFetch = globalThis.fetch;
/**
 * endpoint(...replies) — the model endpoint ep1 behind the global `fetch`: it answers the envelopes given in turn (the last again), each { draft, answers }, as an OpenAI-compatible endpoint does.
 * -> the requests, each { address, headers, body, sent: the messages' text joined }; `outside` holds the requests to any other address, which the test's network refuses.
 */
export function endpoint(...replies) {
  const requests = [];
  requests.outside = [];
  const queue = [...replies];
  globalThis.fetch = async (address, init = {}) => {
    if (new URL(String(address)).origin !== "https://ep1.example.test") {
      requests.outside.push(String(address));
      return Promise.reject(new TypeError(`the test's network refuses ${address}`));
    }
    const body = init.body ?? "";
    requests.push({ address: String(address), headers: init.headers ?? {}, body, sent: JSON.parse(body).messages.map((message) => message.content).join("\n") });
    const envelope = queue.length > 1 ? queue.shift() : queue[0];
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(envelope) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
  return requests;
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
const DEFAULT_REGISTER = registerOf(ENDPOINT_ROW, SMALL_ROW, CI_ROW, READER_ROW);

/** The route use-case drawn for the id in `params` ({ id: "draft" } is the drafting page; `{}` the list), with the person's token for the product unless `token` is false. -> the element. */
export async function show(fake, params = { id: "draft" }, { register = DEFAULT_REGISTER, token = true, store = null } = {}) {
  assert.ok(route, `the route use-case: ${pages.error?.message}`);
  const kept = store ?? openStore(token ? "alice/agent-m" : "nobody/agent-m");
  if (token) writeSetting(kept, "github-token:alice/thesis-tool", TOKEN);
  writeSetting(kept, "endpoint:ep1", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "example-model", throughBridge: false, key: KEY });
  writeSetting(kept, "endpoint:ep2", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "small-model", throughBridge: false, key: KEY });
  const target = document.createElement("div");
  document.body.append(target);
  const context = { page: "review", instance: { repository: "alice/agent-m", host: fakeInstance(register).host }, store: kept, go() {}, product: { address: ON_GITHUB.web, kind: "github", host: fake.host } };
  await route.render(target, context, params);
  return target;
}
export const participantBox = (target, name) => byClass(target, "input", "participant").find((box) => box.value === name);
export function choose(target, name) {
  const box = participantBox(target, name);
  assert.ok(box, `the participant ${name} is offered`);
  box.checked = true;
  box.dispatchEvent(new Event("change"));
}
/** The requirements ticked on the drafting page: exactly `names`. */
export function tick(target, names) {
  for (const box of byClass(target, "input", "requirement")) {
    box.checked = names.includes(box.value);
    box.dispatchEvent(new Event("change"));
  }
}
/** The participant `name` chosen and the run panel shown. -> the panel. */
export async function panelFor(target, name) {
  choose(target, name);
  click(byClass(target, "button", "prepare")[0]);
  await until(() => byClass(target, "section", "run-panel").length === 1, "the run panel");
  return byClass(target, "section", "run-panel")[0];
}
/** Run pressed on the panel and the result waited for: the written files, or the line that says the job is queued, or a problem. -> the element. */
export async function run(target) {
  click(runButtons(target)[0]);
  await until(() => byClass(target, "ul", "written").length === 1 || byClass(target, "p", "queued").length === 1 || byClass(target, "p", "problem").length > 0 || byClass(target, "p", "result").length > 0,
    "the result of the job");
  return target;
}
/** The drafting page, the participant chosen, the panel shown and Run pressed. -> the element. */
export async function draft(fake, { names = null, participant = "drafter-a", options = {} } = {}) {
  const target = await show(fake, { id: "draft" }, options);
  if (names) tick(target, names);
  await panelFor(target, participant);
  return run(target);
}
/** The record of the newest job of the product: { path, text }. */
export function jobRecord(fake) {
  const paths = Object.keys(fake.files()).filter((path) => /^docs\/jobs\/JOB-.*\.md$/.test(path)).sort();
  return { path: paths.at(-1), text: fake.files()[paths.at(-1)] };
}

/** The status the list of use cases shows for the use case `id` — open, accepted, changed since acceptance —, or null where the list has no row for it. */
export async function badge(fake, id) {
  const list = await show(fake, {});
  const row = find(list, (node) => node.localName === "tr" && node.getAttribute("data-id") === id)[0];
  return row ? (byClass(row, "span", "badge")[0]?.textContent ?? null) : null;
}

/** The approval record by which a person accepts the text `body` of the use case at `path`. -> { path, text }. */
export const approvalOf = (path, body) => ({ path: `docs/approvals/${/UC-\d+/.exec(path)[0]}-${blobOf(body).slice(0, 12)}.md`, text: writeDocument(approvalSchema, { fields: { kind: "use-case", file: path, blob: blobOf(body) } }) });
/** The person's acceptance of the use case at `path`, committed on the head: the product's host. */
export async function accept(fake, path) {
  const head = await fake.host.readSnapshot("main");
  await fake.host.commitFiles({ branch: "main", expectedHead: head.commit, files: [approvalOf(path, fake.files()[path])], message: `Accept ${path}` });
}
