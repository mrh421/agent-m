// Release tests of ITM-1335 — "A requirement proposed as a change of itself with its rule unchanged is a duplicate", with UC-005 step 6.2 ("a candidate whose name or normalised rule equals an existing
// requirement's is classified as a duplicate without a model, whatever the model said"), step 8 ("change: an entry ... changing it under its name ... duplicate: an entry that adds the new source to the
// existing requirement") and the SPEC's EXACT DUPLICATES ARE FOUND WITHOUT A MODEL ("A candidate whose name or normalised rule text equals an existing requirement's is classified as a duplicate
// deterministically, before any model classification") and A CHANGE IS PROPOSED UNDER THE EXISTING NAME ("A candidate that changes an existing requirement is proposed as a change to that requirement, under its name").
// Run: node --test tests/release-itm-1335-change-of-itself.test.mjs
//
// Module: MOD-documents
// Module: MOD-review-pages
// Guards: UC-005; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; A CHANGE IS PROPOSED UNDER THE EXISTING NAME
// Level: release
//
// Written for the release testing of sprint team1/132 by developer-sonnet-l, who implemented none of ITM-1335 (RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER). The cases reach MOD-documents'
// classifyCandidates the way the dashboard does: the page #spec-entry/id=draft of MOD-review-pages, as tests/review-pages-draft-requirements.test.mjs drives it (same fixtures: a product SPEC holding
// A LOAN HAS A DUE DATE and A BOOK IS SHELVED, a linked source, a model endpoint behind global fetch, in-memory hosts). They press Run, read the candidate groups and press Write proposals. Reading taken
// where the texts leave it open: a candidate is "proposed as a change of itself" when its class is change and its `of` is its own name.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const route = pages.view?.routes.find((candidate) => candidate.name === "spec-entry");
(pages.view?.strategies ?? []).forEach((strategies, at) => registerStrategies(`tests/release-itm-1335-change-of-itself.test.mjs#${at}`, strategies));

// ---------------------------------------------------------------- fixtures

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const sha256Of = (body) => createHash("sha256").update(body).digest("hex");
const versionHash = (files) => sha256Of([...files].sort((a, b) => a.name.localeCompare(b.name))
  .map((file) => `${file.sha256}  ${file.name}\n`).join(""));
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);

const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M - thesis-tool", expires: "2027-01-01" };
const RULE = "A LOAN HAS A DUE DATE";
const OTHER = "A BOOK IS SHELVED";
const SPEC = text("# Thesis tool - Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`,
  "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`", "",
  `**${OTHER}** *(Product Owner)*`, "Every book stands on a shelf.", "*Check:* `tests/shelf.test.mjs`");

const SOURCE = "SRC-policy";
const MAIN_FILE = "main.md";
const APPENDIX_FILE = "appendix.md";
const MAIN_TEXT = text("# Policy", "", "Chapter 1: loans state their due date.", "Chapter 2: members can renew once.");
const APPENDIX_TEXT = text("# Appendix", "", "Shelves are labelled.");
const MAIN_SHA = sha256Of(MAIN_TEXT);
const APPENDIX_SHA = sha256Of(APPENDIX_TEXT);
const GOOD_HASH = versionHash([{ name: MAIN_FILE, sha256: MAIN_SHA }, { name: APPENDIX_FILE, sha256: APPENDIX_SHA }]);
const LINKS = (hash = GOOD_HASH) => text("# Requirement sources of the thesis tool", "", "| Source | Version | Hash | Part |", "|---|---|---|---|",
  `| ${SOURCE} | 2026-10-01 | ${hash} | Chapter 1 |`);
const sourceEntry = ({ mainSha = MAIN_SHA, appendixSha = APPENDIX_SHA } = {}) => text("---", `id: ${SOURCE}`, "title: Library Policy",
  "kind: document", "authority: normative", "licence: may be republished - fixture", "---", `# ${SOURCE} Library Policy`, "",
  "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| 2026-10-01 | 2026-10-01 | fixture | fixture | 2 files, listed below; version hash \`${GOOD_HASH}\` |`, "",
  "### Files of 2026-10-01", "", "| File | SHA-256 |", "|---|---|", `| \`${MAIN_FILE}\` | \`${mainSha}\` |`,
  `| \`${APPENDIX_FILE}\` | \`${appendixSha}\` |`, "", "## Parts", "", "- Chapter 1", "- Appendix");

const PRODUCT_FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, "docs/sources.md": LINKS() };
const SOURCE_FILES = {
  [`docs/sources/${SOURCE}.md`]: sourceEntry(),
  [`docs/sources/${SOURCE}/2026-10-01/${MAIN_FILE}`]: MAIN_TEXT,
  [`docs/sources/${SOURCE}/2026-10-01/${APPENDIX_FILE}`]: APPENDIX_TEXT,
};

// ---------------------------------------------------------------- hosts

function fakeProduct(files = PRODUCT_FILES) {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made}`).digest("hex");
    commits.set(sha, { tree, parent });
    return sha;
  };
  head = commitOf(new Map(Object.entries(files)), null);
  const snapshotAt = (sha, ref) => {
    const { tree } = commits.get(sha);
    return { repository: ON_GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  return {
    files: () => Object.fromEntries(commits.get(head).tree),
    writes: () => calls.filter((call) => call.fn === "commitFiles").map((call) => call.change),
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot(ref) {
        if (ref === "trunk") return snapshotAt(head, "trunk");
        if (commits.has(ref)) return snapshotAt(ref, ref);
        throw failure("NotFound", `${ref} was not found`);
      },
      async readHistory() { return []; },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((file) => [file.path, file.text])]), head);
        return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
      },
    },
  };
}

const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => { try { return readFileSync(new URL(path, ROOT), "utf8"); } catch { return null; } };
const REGISTER_HEAD = onDisk("docs/participants.md").split("\n").filter((line, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const registerOf = (...rows) => `${REGISTER_HEAD}\n${rows.join("\n")}\n`;
const row = (name, context = 200000) => `| ${name} | model endpoint | model-a | ${context} | - | draft text | this machine | endpoint ep1 |`;
const DRAFTER = row("drafter-a");
const SMALL = row("small-d", 20);

function fakeInstance(register, entries = SOURCE_FILES) {
  const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" },
    ref: "main", commit: "abc123def4567890abc123def4567890abc123de", paths: Object.keys(entries).sort(),
    read: async (path) => (path === "docs/participants.md" ? register : path in entries ? entries[path] : onDisk(path)), blob: () => null };
  return { host: { async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
    async readSnapshot() { return snapshot; } } };
}

// ---------------------------------------------------------------- endpoint and page

const candidate = (name, fields = {}) => ({ name, rule: `${name.toLowerCase()} rule.`, check: "`tests/fixture.test.mjs`",
  constrains: "product", passage: "ch. 1", class: "new", source: SOURCE, ...fields });
let requests = [];
const realFetch = globalThis.fetch;
function endpointAnswers(draft) {
  requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft, answers: [] }) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 } }), { status: 200, headers: { "content-type": "application/json" } });
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

async function show(fake, params = { id: "draft" }, { register = registerOf(DRAFTER), entries = SOURCE_FILES, token = true } = {}) {
  assert.ok(route, `the route spec-entry: ${pages.error?.message}`);
  const store = openStore(token ? "alice/agent-m" : "nobody/agent-m");
  if (token) writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  writeSetting(store, "endpoint:ep1", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "m", throughBridge: false });
  const target = document.createElement("div");
  document.body.append(target);
  const context = { page: "review", instance: { repository: "alice/agent-m", host: fakeInstance(register, entries).host }, store, go() {},
    product: { address: ON_GITHUB.web, kind: "github", host: fake.host } };
  await route.render(target, context, params);
  return target;
}

function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const click = (node) => node.dispatchEvent(new Event("click"));
async function until(condition, what) {
  const limit = Date.now() + 2000;
  while (Date.now() < limit) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`waited for ${what}`);
}
const runButtons = (root) => find(root, (node) => node.localName === "button" && node.textContent === "Run");
function chooseParticipant(target, name) {
  const box = byClass(target, "input", "participant").find((each) => each.value === name);
  assert.ok(box, `${name} is offered`);
  box.checked = true;
  box.dispatchEvent(new Event("change"));
}
async function panelFor(target, participant = "drafter-a") {
  chooseParticipant(target, participant);
  click(byClass(target, "button", "prepare")[0]);
  await until(() => byClass(target, "section", "run-panel").length === 1 || byClass(target, "p", "problem").length > 0, "the run panel or problem");
  return byClass(target, "section", "run-panel")[0] ?? null;
}

// ---------------------------------------------------------------- cases

const LOAN_RULE = "Every loan states the date by which the book is returned.";
async function runDraft(candidates) {
  endpointAnswers({ candidates });
  const fake = fakeProduct();
  const target = await show(fake);
  for (const box of byClass(target, "input", "source-file")) box.checked = box.value === MAIN_FILE;
  await panelFor(target);
  click(runButtons(target)[0]);
  await until(() => byClass(target, "section", "requirements-result").length === 1, "the candidates");
  const classOf = (name) => byClass(target, "section", "candidate-group").find((group) => byClass(group, "li", "candidate").some((item) => item.getAttribute("data-name") === name))?.getAttribute("data-class");
  const write = async () => {
    click(byClass(target, "button", "write-proposals")[0]);
    await until(() => byClass(target, "p", "written").length === 1, "the write result");
    return fake.writes().filter((change) => change.files.some((file) => file.path.includes("docs/spec-freigaben/"))).flatMap((change) => change.files.map((file) => file.text)).join("\n---\n");
  };
  return { target, classOf, write };
}

// TST-1335101 · level: release · module: MOD-documents
// guards: UC-005; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
// given: the product SPEC with A LOAN HAS A DUE DATE (rule "Every loan states the date by which the book is returned.") and A BOOK IS SHELVED; the model answers three candidates from the linked source: A LOAN HAS A DUE DATE with its rule in other letters and spacing, classed change of A LOAN HAS A DUE DATE; THE DUE DATE IS SHOWN with another rule, classed change of A LOAN HAS A DUE DATE (known positive); A BOOK IS SHELVED with another rule, classed change of A BOOK IS SHELVED
// input: the author opens #spec-entry/id=draft, presses Run, reads the groups, and presses Write proposals
// expect: the candidate that restates its own requirement's rule is in the group duplicate, not change, and the entry written into the section's queue says in its rationale's paragraph The change. that it adds its source to A LOAN HAS A DUE DATE, instead of changing its text; the two candidates with another rule stay in the group change, whatever the letters of the name
test("TST-1335101: UC-005 a requirement proposed as a change of itself with its rule unchanged is a duplicate of it, decided by rule", async () => {
  const { classOf, write } = await runDraft([
    { name: "A LOAN HAS A DUE DATE", rule: "EVERY loan  states the date by which the book is returned.", check: "`tests/loan.test.mjs`", constrains: "product", passage: "ch. 1", class: "change", of: "A LOAN HAS A DUE DATE", source: SOURCE },
    { name: "THE DUE DATE IS SHOWN", rule: "Every loan shows its due date on the receipt.", check: "`tests/receipt.test.mjs`", constrains: "product", passage: "ch. 1", class: "change", of: "A LOAN HAS A DUE DATE", source: SOURCE },
    { name: "A BOOK IS SHELVED", rule: "Every book stands on a shelf that is labelled.", check: "`tests/shelf.test.mjs`", constrains: "product", passage: "ch. 2", class: "change", of: "A BOOK IS SHELVED", source: SOURCE },
  ]);
  assert.equal(classOf("THE DUE DATE IS SHOWN"), "change", "known positive: another rule is a change");
  assert.equal(classOf("A BOOK IS SHELVED"), "change", "another rule under its own name is a change");
  assert.equal(classOf("A LOAN HAS A DUE DATE"), "duplicate", "its own rule restated is a duplicate of it");
  const written = await write();
  assert.match(written, /\*\*The change\.\*\* [^\n]*adds a source to A LOAN HAS A DUE DATE/, "the entry, in the queue of section Lending, adds its source to A LOAN HAS A DUE DATE (a duplicate as an added source of the existing requirement, MOD-spec-changes entrySections; its rationale's paragraph The change)");
  assert.doesNotMatch(written, /^EVERY loan {2}states/m, "the restated rule is not written as the requirement's text");
});

// TST-1335102 · level: release · module: MOD-documents
// guards: UC-005; A CHANGE IS PROPOSED UNDER THE EXISTING NAME
// given: the product of TST-1335101; the model answers A LOAN HAS A DUE DATE with another rule, classed change of itself, and, for the counter-proof, the same name with the existing rule, classed change of itself
// input: the author presses Run and then Write proposals, once for each answer
// expect: with another rule the candidate stays a change, and the queue holds an entry changing A LOAN HAS A DUE DATE under its name with the new rule; with the existing rule it is a duplicate and the queue holds no change of that requirement's text
test("TST-1335102: UC-005 a change of a requirement stands under its name only when its rule differs", async () => {
  const draft = (rule) => [{ name: "A LOAN HAS A DUE DATE", rule, check: "`tests/loan.test.mjs`", constrains: "product", passage: "ch. 1", class: "change", of: "A LOAN HAS A DUE DATE", source: SOURCE }];
  const changed = await runDraft(draft("Every loan states the date by which the book is returned, and the date of renewal."));
  assert.equal(changed.classOf("A LOAN HAS A DUE DATE"), "change");
  assert.match(await changed.write(), /and the date of renewal/, "the change is written under the existing name with the new rule");
  const same = await runDraft(draft(LOAN_RULE));
  assert.equal(same.classOf("A LOAN HAS A DUE DATE"), "duplicate", "counter-proof: the same rule is a duplicate");
  assert.doesNotMatch(await same.write(), /\| `A LOAN HAS A DUE DATE` \| changed \|/, "no change of that requirement is written");
});
