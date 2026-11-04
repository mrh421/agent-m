// MOD-review-pages' derivation of requirements from a linked source (ITM-361), as the accepted text of
// docs/architecture/MOD-review-pages.md states it: "`<k>/draft` - drafting: ... for requirements, the linked source and,
// to send less, the files of its version to work on ... then the run panel and *Run*"; after an attended run the candidates
// are shown grouped by class, classes can be changed, conflicts are decided by the person, a candidate from an unlinked
// source is listed apart, and *Write proposals* goes through MOD-job-runner's writer `queue-entries`.
// Run: node --test tests/review-pages-draft-requirements.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-005; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; A GENERATED ARTIFACT IS A PROPOSAL; THE MODEL'S CLASSIFICATION IS MEASURED, NOT TRUSTED; A CONFLICT IS DECIDED BY A PERSON; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY; THE ROUNDS ARE COUNTED AND SHOWN
// Level: unit
//
// The test reuses the browser DOM harness of tests/review-pages-harness.mjs. The product and the instance are
// in-memory hosts that keep to MOD-repository-hosts' interface. The source register and the source content are fixture
// files; the real MOD-source-register recipes check their hashes. The model endpoint is a fixture behind global fetch.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { until as settles } from "./review-pages-wait.mjs";

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const route = pages.view?.routes.find((candidate) => candidate.name === "spec-entry");
(pages.view?.strategies ?? []).forEach((strategies, at) => registerStrategies(`tests/review-pages-draft-requirements.test.mjs#${at}`, strategies));

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
const DRAFT = { candidates: [
  candidate("A MEMBER CAN RENEW ONCE"),
  candidate("THE DUE DATE IS SHOWN", { class: "change", of: RULE }),
  candidate("A BOOK STANDS ON A SHELF", { class: "duplicate", of: OTHER, rule: "Every book stands on a shelf." }),
  candidate("THE DUE DATE MAY BE HIDDEN", { class: "conflict", of: RULE }),
  candidate("AN EXTERNAL RULE IS NAMED", { source: "SRC-unlinked" }),
] };

let requests = [];
const realFetch = globalThis.fetch;
function endpointAnswers(draft = DRAFT) {
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

// ---------------------------------------------------------------- assertions

// TST-361001 · level: unit · module: MOD-review-pages
// guards: UC-005; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; EVERY STEP EXPLAINS ITSELF
// given: a product that links SRC-policy version 2026-10-01, whose version has main.md and appendix.md
// input: the SPEC change list, then #spec-entry/id=draft
// expect: the list links to drafting requirements; the draft page names the linked source, its part, both files, the participant and the folded explanations; nothing is written or sent
// TST-584009 · level: unit · module: MOD-review-pages
// guards: UC-005; THE PAGE NAMES WHERE IT SENDS; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; EVERY STEP EXPLAINS ITSELF
// given: a product that links SRC-policy version 2026-10-01, whose version has main.md and appendix.md
// input: the SPEC change list, then #spec-entry/id=draft
// expect: the list links to drafting requirements; the draft page names the linked source, its part, both files, the participant and the folded explanations; nothing is written or sent
test("spec-entry/draft - linked source, part, files and participant are shown before anything is sent", async () => {
  endpointAnswers();
  const fake = fakeProduct();
  const list = await show(fake, {});
  assert.equal(find(list, (node) => node.localName === "a" && node.getAttribute("href") === `#spec-entry/id=draft/product=${encodeURIComponent(ON_GITHUB.web)}`).length, 1);

  const target = await show(fake);
  assert.deepEqual(byClass(target, "li", "source").map((item) => item.getAttribute("data-source")), [SOURCE]);
  assert.match(byClass(target, "li", "source")[0].textContent, /Chapter 1/);
  assert.deepEqual(byClass(target, "input", "source-file").map((box) => box.value).sort(), [APPENDIX_FILE, MAIN_FILE].sort());
  assert.deepEqual(byClass(target, "li", "participant").map((item) => item.getAttribute("data-name")), ["drafter-a"]);
  assert.ok(find(target, (node) => node.localName === "details").length >= 2);
  assert.equal(fake.writes().length, 0);
  assert.equal(requests.length, 0);
});

// TST-361002 · level: unit · module: MOD-review-pages
// guards: UC-005; THE PAGE NAMES WHERE IT SENDS; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY; ONE CLICK PER DECISION
// given: a two-file linked source, the person leaves main.md checked and clears appendix.md
// input: Show the run panel, once with drafter-a and once with small-d
// expect: the panel names derive-requirements' destination and the selected file, the existing requirements count, and chapter 8; small-d is named as unable to hold the context and Run is not offered; nothing is sent
// TST-584010 · level: unit · module: MOD-review-pages
// guards: UC-005; THE PAGE NAMES WHERE IT SENDS; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY; ONE CLICK PER DECISION
// given: a two-file linked source, the person leaves main.md checked and clears appendix.md
// input: Show the run panel, once with drafter-a and once with small-d
// expect: the panel names derive-requirements' destination and the selected file, the existing requirements count, and chapter 8; small-d is named as unable to hold the context and Run is not offered; nothing is sent
test("spec-entry/draft - the run panel sends fewer source files and refuses a participant with too little context", async () => {
  endpointAnswers();
  const fake = fakeProduct();
  const target = await show(fake);
  for (const box of byClass(target, "input", "source-file")) box.checked = box.value === MAIN_FILE;
  const panel = await panelFor(target);
  assert.match(panel.textContent, /drafter-a/);
  assert.match(panel.textContent, new RegExp(`${SOURCE} 2026-10-01, ${MAIN_FILE}, Chapter 1`));
  assert.ok(!panel.textContent.includes(APPENDIX_FILE), "appendix.md is not sent");
  assert.match(panel.textContent, /SPEC\.md with its open queues/);
  assert.match(panel.textContent, /08_requirements-engineering\.md/);
  assert.match(panel.textContent, /2 existing requirements/);
  assert.equal(runButtons(panel).length, 1);
  assert.equal(requests.length, 0);

  const small = await show(fake, { id: "draft" }, { register: registerOf(SMALL) });
  for (const box of byClass(small, "input", "source-file")) box.checked = box.value === MAIN_FILE;
  const smallPanel = await panelFor(small, "small-d");
  assert.match(byClass(smallPanel, "p", "not-fitting")[0].textContent, /small-d/);
  assert.equal(runButtons(smallPanel).length, 0);
  assert.equal(requests.length, 0);
});

// TST-361003 · level: unit · module: MOD-review-pages
// guards: UC-005; A CONFLICT IS DECIDED BY A PERSON; THE MODEL'S CLASSIFICATION IS MEASURED, NOT TRUSTED; A GENERATED ARTIFACT IS A PROPOSAL; THE ROUNDS ARE COUNTED AND SHOWN
// given: the endpoint returns new, change, duplicate, conflict and unlinked-source candidates
// input: Run; move the new candidate to duplicate of A BOOK IS SHELVED; decide the conflict as a change of A BOOK IS SHELVED (A LOAN HAS A DUE DATE is changed by THE DUE DATE IS SHOWN already: a second change of it is refused); Write proposals
// expect: candidates are grouped by class and editable; the unlinked source is listed apart; the written queue contains the moved duplicate and decided conflict, and no entry for the unlinked candidate
// TST-584011 · level: unit · module: MOD-review-pages
// guards: UC-005; A CONFLICT IS DECIDED BY A PERSON; THE MODEL'S CLASSIFICATION IS MEASURED, NOT TRUSTED; A GENERATED ARTIFACT IS A PROPOSAL; THE ROUNDS ARE COUNTED AND SHOWN
// given: the endpoint returns new, change, duplicate, conflict and unlinked-source candidates
// input: Run; move the new candidate to duplicate of A BOOK IS SHELVED; decide the conflict as a change of A BOOK IS SHELVED (A LOAN HAS A DUE DATE is changed by THE DUE DATE IS SHOWN already: a second change of it is refused); Write proposals
// expect: candidates are grouped by class and editable; the unlinked source is listed apart; the written queue contains the moved duplicate and decided conflict, and no entry for the unlinked candidate
test("spec-entry/draft - candidates are reviewed, classes changed, conflicts decided and proposals written", async () => {
  endpointAnswers();
  const fake = fakeProduct();
  const target = await show(fake);
  for (const box of byClass(target, "input", "source-file")) box.checked = box.value === MAIN_FILE;
  await panelFor(target);
  click(runButtons(target)[0]);
  await until(() => byClass(target, "section", "requirements-result").length === 1, "the candidates");

  assert.equal(byClass(target, "p", "rounds")[0].textContent, "Correction rounds: 1");
  assert.deepEqual(byClass(target, "section", "candidate-group").map((group) => group.getAttribute("data-class")).sort(),
    ["change", "conflict", "duplicate", "new"].sort());
  assert.match(byClass(target, "section", "unlinked-candidates")[0].textContent, /AN EXTERNAL RULE IS NAMED/);
  assert.match(byClass(target, "section", "unlinked-candidates")[0].textContent, /SRC-unlinked/);
  assert.match(byClass(target, "p", "normative")[0].textContent, new RegExp(`${SOURCE}.*normative`));

  const renew = byClass(target, "li", "candidate").find((item) => item.getAttribute("data-name") === "A MEMBER CAN RENEW ONCE");
  byClass(renew, "select", "class")[0].value = "duplicate";
  byClass(renew, "input", "of")[0].value = OTHER;
  const conflict = byClass(target, "li", "candidate").find((item) => item.getAttribute("data-name") === "THE DUE DATE MAY BE HIDDEN");
  byClass(conflict, "select", "class")[0].value = "change";
  byClass(conflict, "input", "of")[0].value = OTHER;

  click(byClass(target, "button", "write-proposals")[0]);
  await until(() => byClass(target, "p", "written").length === 1, "the write result");

  const proposals = fake.writes().filter((change) => change.files.some((file) => file.path.includes("docs/spec-freigaben/")));
  assert.equal(proposals.length, 1);
  const written = proposals[0].files.map((file) => file.text).join("\n---\n");
  assert.match(written, /a member can renew once rule/);
  assert.match(written, /the due date may be hidden rule/);
  assert.doesNotMatch(written, /AN EXTERNAL RULE IS NAMED/);
});

// TST-361004 · level: unit · module: MOD-review-pages
// guards: UC-005; A CONFLICT IS DECIDED BY A PERSON
// given: the endpoint returns a conflict and the person does not change its class
// input: Run, then Write proposals
// expect: the undecided conflict stays out of the written queue
// TST-584012 · level: unit · module: MOD-review-pages
// guards: UC-005; A CONFLICT IS DECIDED BY A PERSON
// given: the endpoint returns a conflict and the person does not change its class
// input: Run, then Write proposals
// expect: the undecided conflict stays out of the written queue
test("spec-entry/draft - an undecided conflict is not written", async () => {
  endpointAnswers();
  const fake = fakeProduct();
  const target = await show(fake);
  for (const box of byClass(target, "input", "source-file")) box.checked = box.value === MAIN_FILE;
  await panelFor(target);
  click(runButtons(target)[0]);
  await until(() => byClass(target, "section", "requirements-result").length === 1, "the candidates");
  click(byClass(target, "button", "write-proposals")[0]);
  await until(() => byClass(target, "p", "written").length === 1, "the write result");
  const written = fake.writes().filter((change) => change.files.some((file) => file.path.includes("docs/spec-freigaben/")))
    .flatMap((change) => change.files.map((file) => file.text)).join("\n");
  assert.doesNotMatch(written, /THE DUE DATE MAY BE HIDDEN/);
});

// TST-361005 · level: unit · module: MOD-review-pages
// guards: UC-005; ONE CLICK PER DECISION
// given: the source register records a wrong SHA-256 for main.md
// input: Show the run panel
// expect: the hash mismatch is named; no Run exists and nothing is sent
// TST-584013 · level: unit · module: MOD-review-pages
// guards: UC-005; ONE CLICK PER DECISION
// given: the source register records a wrong SHA-256 for main.md
// input: Show the run panel
// expect: the hash mismatch is named; no Run exists and nothing is sent
test("spec-entry/draft - a changed source file hash sends nothing", async () => {
  endpointAnswers();
  const fake = fakeProduct();
  const target = await show(fake, { id: "draft" }, { entries: { ...SOURCE_FILES, [`docs/sources/${SOURCE}.md`]: sourceEntry({ mainSha: "0".repeat(64) }) } });
  for (const box of byClass(target, "input", "source-file")) box.checked = box.value === MAIN_FILE;
  await panelFor(target);
  assert.match(byClass(target, "p", "problem")[0].textContent, /SHA-256/);
  assert.equal(runButtons(target).length, 0);
  assert.equal(requests.length, 0);
});

// TST-1389001 · level: unit · module: MOD-review-pages
// guards: UC-005; A SOURCE VERSION IS FIXED BY IDENTIFIER AND HASH
// given: the source register records a wrong SHA-256 for main.md of SRC-policy 2026-10-01; the person's token is stored; known positive: the same page over the register that records main.md's SHA-256; counter-proof: the same page over a content repository that does not hold main.md
// input: choose main.md and drafter-a, Show the run panel
// expect: the problem names main.md, says that its content changed and that a new version must be registered, and links the library's entry of SRC-policy (#library/source=SRC-policy), where a new version is registered (UC-016); no Run, nothing sent, nothing written; known positive: with the recorded SHA-256 the run panel is shown and no paragraph says the content changed; counter-proof: a file the content repository does not hold is a problem that does not say the content changed and links no new version
test("TST-1389001: spec-entry/draft - a changed source file is named as changed, with the link to register a new version", async () => {
  const showPanel = async (entries) => {
    endpointAnswers();
    const fake = fakeProduct();
    const target = await show(fake, { id: "draft" }, { entries });
    for (const box of byClass(target, "input", "source-file")) box.checked = box.value === MAIN_FILE;
    chooseParticipant(target, "drafter-a");
    click(byClass(target, "button", "prepare")[0]);
    await settles(target, () => byClass(target, "section", "run-panel").length === 1 || byClass(target, "p", "problem").length > 0, "the run panel or a problem");
    return { fake, target };
  };

  const { fake, target } = await showPanel({ ...SOURCE_FILES, [`docs/sources/${SOURCE}.md`]: sourceEntry({ mainSha: "0".repeat(64) }) });
  const problem = byClass(target, "p", "problem")[0];
  assert.ok(problem, "a problem is shown");
  assert.match(problem.textContent, /\bmain\.md\b/);
  assert.match(problem.textContent, /\bchanged\b/);
  assert.match(problem.textContent, /new version/);
  assert.match(problem.textContent, /\bregister/i);
  const links = find(problem, (node) => node.localName === "a").map((a) => a.getAttribute("href"));
  assert.deepEqual(links, ["#library/source=SRC-policy"]);
  assert.equal(runButtons(target).length, 0);
  assert.equal(requests.length, 0);
  assert.deepEqual(fake.writes(), []);

  const known = await showPanel(SOURCE_FILES);
  assert.equal(byClass(known.target, "section", "run-panel").length, 1, "known positive: the run panel is shown");
  assert.ok(!byClass(known.target, "p", "problem").some((p) => /\bchanged\b/.test(p.textContent)), "known positive: nothing says the content changed");

  const { [`docs/sources/${SOURCE}/2026-10-01/${MAIN_FILE}`]: _held, ...withoutMain } = SOURCE_FILES;
  const missing = await showPanel(withoutMain);
  const unreadable = byClass(missing.target, "p", "problem")[0];
  assert.ok(unreadable, "counter-proof: a problem is shown");
  assert.match(unreadable.textContent, /does not hold/, "counter-proof: the file is not held");
  assert.doesNotMatch(unreadable.textContent, /\bchanged\b/, "counter-proof: a missing file is not named as changed");
  assert.equal(find(unreadable, (node) => node.localName === "a" && /new version/.test(node.textContent)).length, 0, "counter-proof: no new version is linked");
});
