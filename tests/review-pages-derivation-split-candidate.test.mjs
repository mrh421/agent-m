// MOD-review-pages' panel of a derivation of requirements offers *Split* on a candidate a finding the loop left names, adds a part of its own after it, and *Write proposals* writes the
// draft as the person left it, through the writer queue-entries of MOD-spec-changes (ITM-578). UC-005 alternative flow 6a: "The author splits a flagged candidate. Each part becomes an entry
// of its own." Step 6.3: "What is left after the last round is shown flagged in step 7".
// Run: node --test tests/review-pages-derivation-split-candidate.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-005; ONE STATEMENT PER REQUIREMENT; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; A GENERATED ARTIFACT IS A PROPOSAL
// Level: unit
//
// The panel is reached the way a person reaches it: the route spec-entry/draft, a participant, Run, and the endpoint's answer — a real job's draft, run in the tab, whose correction loop
// leaves the finding that flags a candidate (the endpoint answers the same draft each round, so the loop ends "unchanged" with the warning of ONE STATEMENT PER REQUIREMENT left). This
// imports the browser harness of tests/review-pages-harness.mjs unchanged. The product and the instance are in-memory hosts that keep to MOD-repository-hosts' interface, every commit
// recorded; the source register and the source file are fixtures whose hashes the real MOD-source-register recipes check; the model endpoint is a fixture behind global fetch, so nothing
// reaches the network. Each test states its input and its expected result before it runs (given / input / expect), and the texts it expects are written out here, taken from no document.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const route = pages.view?.routes.find((candidate) => candidate.name === "spec-entry");
(pages.view?.strategies ?? []).forEach((strategies, at) => registerStrategies(`tests/review-pages-derivation-split-candidate.test.mjs#${at}`, strategies));

// ---------------------------------------------------------------- fixtures

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const sha256Of = (body) => createHash("sha256").update(body).digest("hex");
const failure = (name, message) => Object.assign(new Error(message), { name });

const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M - thesis-tool", expires: "2027-01-01" };
const LOAN = "A LOAN HAS A DUE DATE", SHELF = "A BOOK IS SHELVED";
const SPEC = text("# Thesis tool - Specification", "", "## Lending", "", `**${LOAN}** *(SRC-policy, ch. 1)*`, "Every loan states the date by which the book is returned.",
  "*Check:* `tests/loan.test.mjs`", "", `**${SHELF}** *(SRC-policy, ch. 1)*`, "Every book stands on a shelf.", "*Check:* `tests/shelf.test.mjs`");

const SOURCE = "SRC-policy", MAIN_FILE = "main.md";
const MAIN_TEXT = text("# Policy", "", "Chapter 1: loans state their due date.");
const MAIN_SHA = sha256Of(MAIN_TEXT);
const VERSION_HASH = sha256Of(`${MAIN_SHA}  ${MAIN_FILE}\n`);
const LINKS = text("# Requirement sources of the thesis tool", "", "| Source | Version | Hash | Part |", "|---|---|---|---|", `| ${SOURCE} | 2026-10-01 | ${VERSION_HASH} | Chapter 1 |`);
const SOURCE_ENTRY = text("---", `id: ${SOURCE}`, "title: Library Policy", "kind: document", "authority: normative", "licence: may be republished - fixture", "---",
  `# ${SOURCE} Library Policy`, "", "## Versions", "", "| Version | Date | Edition | Read from | Files |", "|---|---|---|---|---|",
  `| 2026-10-01 | 2026-10-01 | fixture | fixture | 1 file, listed below; version hash \`${VERSION_HASH}\` |`, "",
  "### Files of 2026-10-01", "", "| File | SHA-256 |", "|---|---|", `| \`${MAIN_FILE}\` | \`${MAIN_SHA}\` |`, "", "## Parts", "", "- Chapter 1");

const PRODUCT_FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, "docs/sources.md": LINKS };
const SOURCE_FILES = { [`docs/sources/${SOURCE}.md`]: SOURCE_ENTRY, [`docs/sources/${SOURCE}/2026-10-01/${MAIN_FILE}`]: MAIN_TEXT };

// ---------------------------------------------------------------- hosts

// A commit lands on the head that was read, else `Moved`; every commit is recorded.
function fakeProduct() {
  const commits = new Map(), calls = [];
  let made = 0, head = null;
  const commitOf = (tree) => {
    const sha = createHash("sha1").update(`commit ${++made}`).digest("hex");
    commits.set(sha, tree);
    return sha;
  };
  head = commitOf(new Map(Object.entries(PRODUCT_FILES)));
  const snapshotAt = (sha, ref) => {
    const tree = commits.get(sha);
    return { repository: ON_GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  return { writes: () => calls.map((change) => change.files), host: {
    async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot(ref) {
      if (ref === "trunk") return snapshotAt(head, "trunk");
      if (commits.has(ref)) return snapshotAt(ref, ref);
      throw failure("NotFound", `${ref} was not found`);
    },
    async readHistory() { return []; },
    async commitFiles(change) {
      calls.push(structuredClone(change));
      if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", "the branch moved");
      head = commitOf(new Map([...commits.get(head), ...change.files.map((file) => [file.path, file.text])]));
      return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
    },
  } };
}

const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => { try { return readFileSync(new URL(path, ROOT), "utf8"); } catch { return null; } };
const REGISTER_HEAD = onDisk("docs/participants.md").split("\n").filter((line, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const REGISTER = `${REGISTER_HEAD}\n| drafter-a | model endpoint | model-a | 200000 | - | draft text | this machine | endpoint ep1 |\n`;

function fakeInstance() {
  const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" },
    ref: "main", commit: "abc123def4567890abc123def4567890abc123de", paths: Object.keys(SOURCE_FILES).sort(),
    read: async (path) => (path === "docs/participants.md" ? REGISTER : path in SOURCE_FILES ? SOURCE_FILES[path] : onDisk(path)), blob: () => null };
  return { async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; },
    async readSnapshot() { return snapshot; } };
}

// An instance whose own SPEC holds one requirement and whose host takes commits: the repository a candidate that constrains the process is written to.
const GATES = "EVERY GATE NAMES WHO DECIDES IT";
const INSTANCE_SPEC = text("# Agent M - Specification", "", "## Process", "", `**${GATES}** *(PO A. Maier)*`, "Every gate names who decides it.", "*Check:* `tests/gate.test.mjs`");
function writableInstance() {
  const calls = [];
  const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" },
    ref: "main", commit: "abc123def4567890abc123def4567890abc123de", paths: [...Object.keys(SOURCE_FILES), "SPEC.md"].sort(),
    read: async (path) => (path === "docs/participants.md" ? REGISTER : path === "SPEC.md" ? INSTANCE_SPEC : path in SOURCE_FILES ? SOURCE_FILES[path] : onDisk(path)), blob: () => null };
  return { writes: () => calls.map((change) => change.files), host: {
    async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
    async readSnapshot() { return snapshot; },
    async readHistory() { return []; },
    async commitFiles(change) { calls.push(structuredClone(change)); return { commit: "f".repeat(40), url: "https://github.com/alice/agent-m/commit/ffff" }; },
  } };
}

// ---------------------------------------------------------------- the endpoint's answer

const candidate = (name, rule) => ({ name, rule, check: "`tests/fixture.test.mjs`", constrains: "product", passage: "ch. 1", class: "new", source: SOURCE });
const TWO = "A LOAN STATES TWO THINGS", TWO_RULE = "Every loan states its due date and its return place.";
const CLEAN = "A MEMBER CAN RENEW ONCE", CLEAN_RULE = "Every member renews a loan once.";
const OTHER = "A BOOK STANDS ON A SHELF", OTHER_RULE = "Every book is put on a shelf.";
const FLAGGED_DRAFT = { candidates: [candidate(TWO, TWO_RULE), candidate(CLEAN, CLEAN_RULE)] };
const UNFLAGGED_DRAFT = { candidates: [candidate(OTHER, OTHER_RULE), candidate(CLEAN, CLEAN_RULE)] };
const ENDPOINT = "https://ep1.example.test/v1/chat/completions";

let requests = [];
const realFetch = globalThis.fetch;
function endpointAnswers(draft) {
  requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

// ---------------------------------------------------------------- the page

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

// The panel of the derivation's draft, reached by a real job: the route, the participant, Show the run panel, Run. Returns the page and the product's host.
async function panelOf(draft, { instance = { host: fakeInstance() } } = {}) {
  endpointAnswers(draft);
  assert.ok(route, `the route spec-entry: ${pages.error?.message}`);
  const product = fakeProduct();
  const store = openStore("alice/agent-m");
  writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  writeSetting(store, "endpoint:ep1", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "m", throughBridge: false });
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { page: "review", instance: { repository: "alice/agent-m", host: instance.host }, store, go() {},
    product: { address: ON_GITHUB.web, kind: "github", host: product.host } }, { id: "draft" });
  for (const file of byClass(target, "input", "source-file")) file.checked = file.value === MAIN_FILE;
  const box = byClass(target, "input", "participant").find((each) => each.value === "drafter-a");
  assert.ok(box, "drafter-a is offered");
  box.checked = true;
  box.dispatchEvent(new Event("change"));
  click(byClass(target, "button", "prepare")[0]);
  await until(() => find(target, (node) => node.localName === "button" && node.textContent === "Run").length === 1, "the Run button");
  click(find(target, (node) => node.localName === "button" && node.textContent === "Run")[0]);
  await until(() => byClass(target, "section", "requirements-result").length === 1, "the candidates");
  assert.ok(requests.length > 0 && requests.every((url) => url === ENDPOINT), `the only requests are the endpoint's: ${requests}`);
  return { panel: target, product };
}
const itemOf = (panel, name) => {
  const item = byClass(panel, "li", "candidate").find((each) => each.getAttribute("data-name") === name);
  assert.ok(item, `the candidate ${name} is in the panel`);
  return item;
};
// The candidates of the panel in the order they stand: a candidate by its name, a split part as "part of <name>".
const orderOf = (panel) => byClass(panel, "li", "candidate").map((item) => item.getAttribute("data-name") ?? `part of ${item.getAttribute("data-split-of")}`);
const partsOf = (panel) => byClass(panel, "li", "split-part");
const splitOf = (item) => byClass(item, "button", "split");
const proposalsOf = (product) => product.writes().filter((files) => files.some((file) => file.path.includes("docs/spec-freigaben/")));

// TST-578001 · level: unit · module: MOD-review-pages
// guards: UC-005; ONE STATEMENT PER REQUIREMENT
// given: the endpoint answers, in every round, a candidate whose rule says two things (A LOAN STATES TWO THINGS: "... due date and its return place.") and a clean one (A MEMBER CAN RENEW ONCE)
// input: the route spec-entry/draft, drafter-a, Run; the correction loop ends "unchanged" with the warning of ONE STATEMENT PER REQUIREMENT left on the first candidate
// expect: the panel reads "Correction rounds: 2"; its list of what is left holds the one finding `ONE STATEMENT PER REQUIREMENT: the rule contains "and" - split it into two requirements, or keep it and give a one-line reason`; exactly one button "Split" stands in the panel, inside the item of A LOAN STATES TWO THINGS, and the item of A MEMBER CAN RENEW ONCE holds none; nothing is written to docs/spec-freigaben
test("spec-entry/draft - a candidate a finding the loop left names offers Split, another does not", async () => {
  const { panel, product } = await panelOf(FLAGGED_DRAFT);
  assert.equal(byClass(panel, "p", "rounds")[0].textContent, "Correction rounds: 2");
  assert.deepEqual(byClass(panel, "li", "left").map((each) => each.textContent),
    ['ONE STATEMENT PER REQUIREMENT: the rule contains "and" - split it into two requirements, or keep it and give a one-line reason']);
  assert.equal(byClass(panel, "button", "split").length, 1, "one Split in the panel");
  assert.deepEqual(splitOf(itemOf(panel, TWO)).map((each) => each.textContent), ["Split"]);
  assert.equal(splitOf(itemOf(panel, CLEAN)).length, 0);
  assert.equal(proposalsOf(product).length, 0, "nothing is written by showing the panel");
});

// TST-578002 · level: unit · module: MOD-review-pages
// guards: UC-005
// given: the endpoint answers two candidates of which no finding is left (A BOOK STANDS ON A SHELF, A MEMBER CAN RENEW ONCE; each rule states one thing)
// input: the route spec-entry/draft, drafter-a, Run
// expect: the panel reads "Correction rounds: 1", its list of what is left is empty, and no button "Split" stands anywhere
test("spec-entry/draft - without a finding left, no candidate offers Split", async () => {
  const { panel } = await panelOf(UNFLAGGED_DRAFT);
  assert.equal(byClass(panel, "p", "rounds")[0].textContent, "Correction rounds: 1");
  assert.equal(byClass(panel, "li", "left").length, 0);
  assert.equal(byClass(panel, "button", "split").length, 0);
});

// TST-578003 · level: unit · module: MOD-review-pages
// guards: UC-005; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the flagged draft of TST-578001
// input: Split on A LOAN STATES TWO THINGS
// expect: the candidates stand in the order A LOAN STATES TWO THINGS, part of A LOAN STATES TWO THINGS, A MEMBER CAN RENEW ONCE; the part's class select reads "new", its "of" field is empty, its name field and its rule field are empty; the first keeps its name and holds its drafted rule in an editable field; nothing is written to docs/spec-freigaben
test("spec-entry/draft - Split adds a part after the candidate, of the same class and of, with fields of its own", async () => {
  const { panel, product } = await panelOf(FLAGGED_DRAFT);
  click(splitOf(itemOf(panel, TWO))[0]);
  assert.deepEqual(orderOf(panel), [TWO, `part of ${TWO}`, CLEAN]);
  const part = partsOf(panel)[0];
  assert.equal(byClass(part, "select", "class")[0].value, "new");
  assert.equal(byClass(part, "input", "of")[0].value, "");
  assert.equal(byClass(part, "input", "candidate-name")[0].value, "");
  assert.equal(byClass(part, "textarea", "candidate-rule")[0].value, "");
  assert.equal(byClass(itemOf(panel, TWO), "textarea", "candidate-rule")[0].value, TWO_RULE, "the first keeps what it had");
  assert.equal(proposalsOf(product).length, 0, "the split is the panel's; nothing is written before Write proposals");
});

// TST-578004 · level: unit · module: MOD-review-pages
// guards: UC-005
// given: the flagged draft of TST-578001
// input: Split on A LOAN STATES TWO THINGS twice
// expect: the candidates stand in the order A LOAN STATES TWO THINGS, part of A LOAN STATES TWO THINGS, part of A LOAN STATES TWO THINGS, A MEMBER CAN RENEW ONCE
test("spec-entry/draft - a second Split adds a second part after the first", async () => {
  const { panel } = await panelOf(FLAGGED_DRAFT);
  click(splitOf(itemOf(panel, TWO))[0]);
  click(splitOf(itemOf(panel, TWO))[0]);
  assert.deepEqual(orderOf(panel), [TWO, `part of ${TWO}`, `part of ${TWO}`, CLEAN]);
});

// TST-578005 · level: unit · module: MOD-review-pages
// guards: UC-005; ONE STATEMENT PER REQUIREMENT; A GENERATED ARTIFACT IS A PROPOSAL
// given: the flagged draft of TST-578001, split; the part named A LOAN SHOWS ITS DATE with the rule "Every loan states its due date."; the first's rule edited to "Every loan states its return place."
// input: Write proposals
// expect: one commit holds docs/spec-freigaben/<queue>/01-lending.md; its text holds, in this order, the blocks of A LOAN STATES TWO THINGS ("Every loan states its return place."), A LOAN SHOWS ITS DATE ("Every loan states its due date.") and A MEMBER CAN RENEW ONCE, each as "**<name>** *(SRC-policy, ch. 1)*", its rule, "*Check:* `tests/fixture.test.mjs`"; the old rule "Every loan states its due date and its return place." is in no written text; SPEC.md is not written
test("spec-entry/draft - Write proposals writes each part as a requirement of its own", async () => {
  const { panel, product } = await panelOf(FLAGGED_DRAFT);
  click(splitOf(itemOf(panel, TWO))[0]);
  const part = partsOf(panel)[0];
  byClass(part, "input", "candidate-name")[0].value = "A LOAN SHOWS ITS DATE";
  byClass(part, "textarea", "candidate-rule")[0].value = "Every loan states its due date.";
  byClass(itemOf(panel, TWO), "textarea", "candidate-rule")[0].value = "Every loan states its return place.";
  click(byClass(panel, "button", "write-proposals")[0]);
  await until(() => byClass(panel, "p", "written").length === 1, "the write result");

  const proposals = proposalsOf(product);
  assert.equal(proposals.length, 1, "one commit holds the queue");
  const entries = proposals[0].filter((file) => /docs\/spec-freigaben\/[^/]+\/01-lending\.md$/.test(file.path));
  assert.equal(entries.length, 1, "the entry of the section Lending");
  const block = (name, rule) => `**${name}** *(SRC-policy, ch. 1)*\n${rule}\n*Check:* \`tests/fixture.test.mjs\``;
  const first = block(TWO, "Every loan states its return place."), second = block("A LOAN SHOWS ITS DATE", "Every loan states its due date."), third = block(CLEAN, CLEAN_RULE);
  const entry = entries[0].text;
  for (const each of [first, second, third]) assert.ok(entry.includes(each), `${each} in ${JSON.stringify(entry)}`);
  assert.ok(entry.indexOf(first) < entry.indexOf(second) && entry.indexOf(second) < entry.indexOf(third), "in the order the panel stands");
  assert.ok(!proposals[0].some((file) => file.text.includes(TWO_RULE)), "the rule that said two things is written nowhere");
  assert.ok(!product.writes().flat().some((file) => file.path === "SPEC.md"), "SPEC.md is not written");
});

// TST-578006 · level: unit · module: MOD-review-pages
// guards: UC-005; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the flagged draft of TST-578001, split, the part left without a name or a rule
// input: Write proposals
// expect: the panel shows a problem reading "A split part of A LOAN STATES TWO THINGS needs a name and a rule: nothing was written."; nothing is written to docs/spec-freigaben; Write proposals is enabled again
test("spec-entry/draft - a split part without a name and a rule is not written", async () => {
  const { panel, product } = await panelOf(FLAGGED_DRAFT);
  click(splitOf(itemOf(panel, TWO))[0]);
  const write = byClass(panel, "button", "write-proposals")[0];
  click(write);
  await until(() => byClass(panel, "p", "problem").length === 1, "the problem");
  assert.equal(byClass(panel, "p", "problem")[0].textContent, `A split part of ${TWO} needs a name and a rule: nothing was written.`);
  assert.equal(proposalsOf(product).length, 0);
  assert.equal(write.disabled, false);
});

// TST-578007 · level: unit · module: MOD-review-pages
// guards: UC-005
// given: the flagged draft of TST-578001, split, the part given the rule "Every loan states its due date." and the name A MEMBER CAN RENEW ONCE, which another candidate bears
// input: Write proposals
// expect: the panel shows a problem reading "The split part A MEMBER CAN RENEW ONCE has the name of another candidate: nothing was written."; nothing is written to docs/spec-freigaben
test("spec-entry/draft - a split part bearing another candidate's name is not written", async () => {
  const { panel, product } = await panelOf(FLAGGED_DRAFT);
  click(splitOf(itemOf(panel, TWO))[0]);
  const part = partsOf(panel)[0];
  byClass(part, "input", "candidate-name")[0].value = CLEAN;
  byClass(part, "textarea", "candidate-rule")[0].value = "Every loan states its due date.";
  click(byClass(panel, "button", "write-proposals")[0]);
  await until(() => byClass(panel, "p", "problem").length === 1, "the problem");
  assert.equal(byClass(panel, "p", "problem")[0].textContent, `The split part ${CLEAN} has the name of another candidate: nothing was written.`);
  assert.equal(proposalsOf(product).length, 0);
});

// TST-578008 · level: unit · module: MOD-review-pages
// guards: UC-005; ONE STATEMENT PER REQUIREMENT
// given: the endpoint answers, in every round, a `change` of A LOAN HAS A DUE DATE named THE DUE DATE IS SHOWN, whose rule says two things ("Every loan shows its due date and its return place."); the person splits it, names the part THE RETURN PLACE IS SHOWN with the rule "Every loan shows its return place.", leaves the part's class and "of" as the split showed them, and edits the first's rule to "Every loan shows its due date."
// input: Write proposals
// expect: right after Split the part's class select reads `new` and its "of" field is empty; the entry 01-lending.md holds the changed block of A LOAN HAS A DUE DATE with the rule "Every loan shows its due date." AND a block THE RETURN PLACE IS SHOWN *(SRC-policy, ch. 1)* with the rule "Every loan shows its return place.", each followed by "*Check:* `tests/fixture.test.mjs`": neither part is lost
test("spec-entry/draft - a split change candidate is written with both parts", async () => {
  const CHANGE = "THE DUE DATE IS SHOWN";
  const { panel, product } = await panelOf({ candidates: [{ ...candidate(CHANGE, "Every loan shows its due date and its return place."), class: "change", of: LOAN }] });
  click(splitOf(itemOf(panel, CHANGE))[0]);
  const part = partsOf(panel)[0];
  assert.equal(byClass(part, "select", "class")[0].value, "new");
  assert.equal(byClass(part, "input", "of")[0].value, "");
  byClass(part, "input", "candidate-name")[0].value = "THE RETURN PLACE IS SHOWN";
  byClass(part, "textarea", "candidate-rule")[0].value = "Every loan shows its return place.";
  byClass(itemOf(panel, CHANGE), "textarea", "candidate-rule")[0].value = "Every loan shows its due date.";
  click(byClass(panel, "button", "write-proposals")[0]);
  await until(() => byClass(panel, "p", "written").length === 1, "the write result");
  const entry = proposalsOf(product)[0].find((file) => /docs\/spec-freigaben\/[^/]+\/01-lending\.md$/.test(file.path)).text;
  const block = (name, rule) => `**${name}** *(SRC-policy, ch. 1)*\n${rule}\n*Check:* \`tests/fixture.test.mjs\``;
  assert.ok(entry.includes(block(LOAN, "Every loan shows its due date.")), JSON.stringify(entry));
  assert.ok(entry.includes(block("THE RETURN PLACE IS SHOWN", "Every loan shows its return place.")), JSON.stringify(entry));
});

// TST-578009 · level: unit · module: MOD-review-pages
// guards: UC-005; A GENERATED ARTIFACT IS A PROPOSAL
// given: the endpoint answers one candidate that constrains the process, class `new` (A GATE DECISION IS RECORDED, rule "Every gate decision is recorded."); the instance's SPEC holds EVERY GATE NAMES WHO DECIDES IT; no split: the person sets the candidate's class to `change` and its "of" to EVERY GATE NAMES WHO DECIDES IT
// input: Write proposals
// expect: the instance's host takes one commit whose entry 01-process.md holds `**EVERY GATE NAMES WHO DECIDES IT** *(PO A. Maier; SRC-policy, ch. 1)*` (the source the job adds to the requirement's), the rule "Every gate decision is recorded." and "*Check:* `tests/fixture.test.mjs`" - a change under the existing name - and holds no block named A GATE DECISION IS RECORDED; the product's host takes no commit under docs/spec-freigaben
test("spec-entry/draft - an unsplit write hands the writer the class and the of the person left", async () => {
  const NEW = "A GATE DECISION IS RECORDED";
  const instance = writableInstance();
  const { panel, product } = await panelOf({ candidates: [{ ...candidate(NEW, "Every gate decision is recorded."), constrains: "process" }] }, { instance });
  const item = itemOf(panel, NEW);
  byClass(item, "select", "class")[0].value = "change";
  byClass(item, "input", "of")[0].value = GATES;
  click(byClass(panel, "button", "write-proposals")[0]);
  await until(() => byClass(panel, "p", "written").length === 1, "the write result");
  const written = instance.writes().filter((files) => files.some((file) => file.path.includes("docs/spec-freigaben/")));
  assert.equal(written.length, 1, "one commit to the instance");
  const entry = written[0].find((file) => /docs\/spec-freigaben\/[^/]+\/01-process\.md$/.test(file.path)).text;
  assert.ok(entry.includes(`**${GATES}** *(PO A. Maier; SRC-policy, ch. 1)*\nEvery gate decision is recorded.\n*Check:* \`tests/fixture.test.mjs\``), JSON.stringify(entry));
  assert.ok(!entry.includes(`**${NEW}**`), "no block under the candidate's own name");
  assert.equal(proposalsOf(product).length, 0, "nothing is written to the product");
});

// ---------------------------------------------------------------- ITM-634: a split part is shown as it is written

const CHANGED = "THE DUE DATE IS SHOWN", CHANGED_RULE = "Every loan shows its due date and its return place.";
const changeDraft = () => ({ candidates: [{ ...candidate(CHANGED, CHANGED_RULE), class: "change", of: LOAN }] });
const classOfItem = (item) => byClass(item, "select", "class")[0].value;
const ofOfItem = (item) => byClass(item, "input", "of")[0].value;
const fill = (part, name, rule) => {
  byClass(part, "input", "candidate-name")[0].value = name;
  byClass(part, "textarea", "candidate-rule")[0].value = rule;
};
const setClass = (item, class_, of) => {
  const select = byClass(item, "select", "class")[0];
  select.value = class_;
  select.dispatchEvent(new Event("change"));
  byClass(item, "input", "of")[0].value = of;
};
const problemOf = async (panel) => {
  click(byClass(panel, "button", "write-proposals")[0]);
  await until(() => byClass(panel, "p", "problem").length === 1, "the problem");
  return byClass(panel, "p", "problem")[0].textContent;
};
const lendingEntry = (product) => proposalsOf(product)[0].find((file) => /docs\/spec-freigaben\/[^/]+\/01-lending\.md$/.test(file.path)).text;
const blockOf = (name, rule) => `**${name}** *(SRC-policy, ch. 1)*\n${rule}\n*Check:* \`tests/fixture.test.mjs\``;

// TST-634001 · level: unit · module: MOD-review-pages
// guards: UC-005; ONE STATEMENT PER REQUIREMENT
// given: the endpoint answers, in every round, a `change` of A LOAN HAS A DUE DATE named THE DUE DATE IS SHOWN, whose rule says two things
// input: Split on THE DUE DATE IS SHOWN twice
// expect: after the first Split the candidates stand in the order THE DUE DATE IS SHOWN, part of THE DUE DATE IS SHOWN; the candidate still reads `change` of A LOAN HAS A DUE DATE; the part reads `new` with an empty "of"; after the second Split the second part reads `new` with an empty "of" as well; nothing is written to docs/spec-freigaben
test("spec-entry/draft - Split of a change candidate adds parts that show new with an empty of", async () => {
  const { panel, product } = await panelOf(changeDraft());
  click(splitOf(itemOf(panel, CHANGED))[0]);
  assert.deepEqual(orderOf(panel), [CHANGED, `part of ${CHANGED}`]);
  assert.equal(classOfItem(itemOf(panel, CHANGED)), "change");
  assert.equal(ofOfItem(itemOf(panel, CHANGED)), LOAN);
  assert.equal(classOfItem(partsOf(panel)[0]), "new");
  assert.equal(ofOfItem(partsOf(panel)[0]), "");
  click(splitOf(itemOf(panel, CHANGED))[0]);
  assert.equal(partsOf(panel).length, 2);
  assert.equal(classOfItem(partsOf(panel)[1]), "new");
  assert.equal(ofOfItem(partsOf(panel)[1]), "");
  assert.equal(proposalsOf(product).length, 0, "nothing is written by splitting");
});

// TST-634002 · level: unit · module: MOD-review-pages
// guards: UC-005
// given: the endpoint answers, in every round, one candidate of class `duplicate` of A LOAN HAS A DUE DATE, whose rule says two things; and the same with class `conflict`
// input: Split on the candidate, once for each class
// expect: for `duplicate` the part's class select reads `duplicate` and its "of" reads A LOAN HAS A DUE DATE; for `conflict` the part reads `conflict` and A LOAN HAS A DUE DATE: every class but `change` is copied
for (const class_ of ["duplicate", "conflict"]) {
  test(`spec-entry/draft - Split of a ${class_} candidate adds a part of the same class and of`, async () => {
    const { panel } = await panelOf({ candidates: [{ ...candidate(TWO, TWO_RULE), class: class_, of: LOAN }] });
    click(splitOf(itemOf(panel, TWO))[0]);
    assert.equal(classOfItem(partsOf(panel)[0]), class_);
    assert.equal(ofOfItem(partsOf(panel)[0]), LOAN);
  });
}

// TST-634003 · level: unit · module: MOD-review-pages
// guards: UC-005; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the `change` candidate of TST-634001, split; the part named THE RETURN PLACE IS SHOWN with the rule "Every loan shows its return place."; the person sets the part's class to `change` and its "of" to A LOAN HAS A DUE DATE
// input: Write proposals; then the person sets the part back to `new` with an empty "of" and presses Write proposals again
// expect: the first press shows a problem reading "TwoChanges: THE DUE DATE IS SHOWN and THE RETURN PLACE IS SHOWN change A LOAN HAS A DUE DATE: one block would replace the other. Nothing was composed. To go on, give one of the two the class new, or merge them into one."; nothing is written to docs/spec-freigaben; Write proposals is enabled again; the second press writes one commit whose entry 01-lending.md holds the block THE RETURN PLACE IS SHOWN with the rule "Every loan shows its return place."
test("spec-entry/draft - a part set to change what its candidate changes is refused, nothing written", async () => {
  const { panel, product } = await panelOf(changeDraft());
  click(splitOf(itemOf(panel, CHANGED))[0]);
  const part = partsOf(panel)[0];
  fill(part, "THE RETURN PLACE IS SHOWN", "Every loan shows its return place.");
  setClass(part, "change", LOAN);
  assert.equal(await problemOf(panel), `TwoChanges: ${CHANGED} and THE RETURN PLACE IS SHOWN change ${LOAN}: one block would replace the other. Nothing was composed. To go on, give one of the two the class new, or merge them into one.`);
  assert.equal(proposalsOf(product).length, 0);
  assert.equal(byClass(panel, "button", "write-proposals")[0].disabled, false);
  setClass(part, "new", "");
  click(byClass(panel, "button", "write-proposals")[0]);
  await until(() => byClass(panel, "p", "written").length === 1, "the write result");
  assert.equal(proposalsOf(product).length, 1);
  assert.ok(lendingEntry(product).includes(blockOf("THE RETURN PLACE IS SHOWN", "Every loan shows its return place.")), JSON.stringify(lendingEntry(product)));
});

// TST-634004 · level: unit · module: MOD-review-pages
// guards: UC-005; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the flagged draft of TST-578001 (A LOAN STATES TWO THINGS, class `new`), split twice; both parts named and given a rule; the person sets both parts' class to `change` and their "of" to A LOAN HAS A DUE DATE
// input: Write proposals
// expect: a problem reading "TwoChanges: A LOAN SHOWS ITS DATE and A LOAN SHOWS ITS PLACE change A LOAN HAS A DUE DATE: one block would replace the other. Nothing was composed. To go on, give one of the two the class new, or merge them into one."; nothing is written to docs/spec-freigaben
test("spec-entry/draft - two parts that change one requirement are refused, nothing written", async () => {
  const { panel, product } = await panelOf(FLAGGED_DRAFT);
  click(splitOf(itemOf(panel, TWO))[0]);
  click(splitOf(itemOf(panel, TWO))[0]);
  const [first, second] = partsOf(panel);
  fill(first, "A LOAN SHOWS ITS DATE", "Every loan states its due date.");
  fill(second, "A LOAN SHOWS ITS PLACE", "Every loan states its return place.");
  setClass(first, "change", LOAN);
  setClass(second, "change", LOAN);
  assert.equal(await problemOf(panel), `TwoChanges: A LOAN SHOWS ITS DATE and A LOAN SHOWS ITS PLACE change ${LOAN}: one block would replace the other. Nothing was composed. To go on, give one of the two the class new, or merge them into one.`);
  assert.equal(proposalsOf(product).length, 0);
});

// TST-634005 · level: unit · module: MOD-review-pages
// guards: UC-005; ONE STATEMENT PER REQUIREMENT
// given: the `change` candidate of TST-634001 (of A LOAN HAS A DUE DATE), split; the part named THE SHELF IS NAMED with the rule "Every book is put on a named shelf."; the person sets the part's class to `change` and its "of" to A BOOK IS SHELVED; the first's rule is edited to "Every loan shows its due date."
// input: Write proposals
// expect: no problem; the entry 01-lending.md holds the changed block of A LOAN HAS A DUE DATE with the rule "Every loan shows its due date." AND the changed block of A BOOK IS SHELVED with the rule "Every book is put on a named shelf.": two changes of two requirements are not refused
test("spec-entry/draft - a part that changes another requirement than its candidate is written", async () => {
  const { panel, product } = await panelOf(changeDraft());
  click(splitOf(itemOf(panel, CHANGED))[0]);
  const part = partsOf(panel)[0];
  fill(part, "THE SHELF IS NAMED", "Every book is put on a named shelf.");
  setClass(part, "change", SHELF);
  byClass(itemOf(panel, CHANGED), "textarea", "candidate-rule")[0].value = "Every loan shows its due date.";
  click(byClass(panel, "button", "write-proposals")[0]);
  await until(() => byClass(panel, "p", "written").length === 1, "the write result");
  assert.equal(byClass(panel, "p", "problem").length, 0);
  const entry = lendingEntry(product);
  assert.ok(entry.includes(blockOf(LOAN, "Every loan shows its due date.")), JSON.stringify(entry));
  assert.ok(entry.includes(blockOf(SHELF, "Every book is put on a named shelf.")), JSON.stringify(entry));
});

// TST-634006 · level: unit · module: MOD-review-pages
// guards: UC-005; ONE STATEMENT PER REQUIREMENT
// given: the `change` candidate of TST-634001, split; the part named THE RETURN PLACE IS SHOWN with the rule "Every loan shows its return place." left as the split showed it (`new`, empty "of"); the first's rule edited to "Every loan shows its due date."
// input: Write proposals
// expect: one commit; the entry 01-lending.md holds the block of A LOAN HAS A DUE DATE with the rule "Every loan shows its due date." and the block THE RETURN PLACE IS SHOWN with the rule "Every loan shows its return place."; the entry holds the old rule "Every loan shows its due date and its return place." nowhere
test("spec-entry/draft - a split change candidate is written as the panel shows it", async () => {
  const { panel, product } = await panelOf(changeDraft());
  click(splitOf(itemOf(panel, CHANGED))[0]);
  fill(partsOf(panel)[0], "THE RETURN PLACE IS SHOWN", "Every loan shows its return place.");
  byClass(itemOf(panel, CHANGED), "textarea", "candidate-rule")[0].value = "Every loan shows its due date.";
  click(byClass(panel, "button", "write-proposals")[0]);
  await until(() => byClass(panel, "p", "written").length === 1, "the write result");
  assert.equal(proposalsOf(product).length, 1);
  const entry = lendingEntry(product);
  assert.ok(entry.includes(blockOf(LOAN, "Every loan shows its due date.")), JSON.stringify(entry));
  assert.ok(entry.includes(blockOf("THE RETURN PLACE IS SHOWN", "Every loan shows its return place.")), JSON.stringify(entry));
  assert.ok(!entry.includes(CHANGED_RULE), "the rule that said two things is written nowhere");
});

// TST-634007 · level: unit · module: MOD-review-pages
// guards: UC-005
// given: the `change` candidate of TST-634001 (of A LOAN HAS A DUE DATE), split; the part named THE RETURN PLACE IS SHOWN with the rule "Every loan shows its return place."; the person sets the part's class to `new` and its "of" to A LOAN HAS A DUE DATE
// input: Write proposals
// expect: no problem; the entry 01-lending.md holds the block THE RETURN PLACE IS SHOWN with the rule "Every loan shows its return place.": only a part whose class is `change` counts among the parts that change one requirement
test("spec-entry/draft - a part of class new naming the candidate's requirement is not refused", async () => {
  const { panel, product } = await panelOf(changeDraft());
  click(splitOf(itemOf(panel, CHANGED))[0]);
  const part = partsOf(panel)[0];
  fill(part, "THE RETURN PLACE IS SHOWN", "Every loan shows its return place.");
  setClass(part, "new", LOAN);
  click(byClass(panel, "button", "write-proposals")[0]);
  await until(() => byClass(panel, "p", "written").length === 1, "the write result");
  assert.equal(byClass(panel, "p", "problem").length, 0);
  assert.ok(lendingEntry(product).includes(blockOf("THE RETURN PLACE IS SHOWN", "Every loan shows its return place.")), JSON.stringify(lendingEntry(product)));
});

// TST-634008 · level: unit · module: MOD-review-pages
// guards: UC-005
// given: the endpoint answers, in every round, A LOAN STATES TWO THINGS (class `new`, rule says two things) and A MEMBER CAN RENEW ONCE as a `change` of A LOAN HAS A DUE DATE; the first is split, its part named A LOAN SHOWS ITS DATE with a rule and set to class `change` of A LOAN HAS A DUE DATE
// input: Write proposals
// expect: a problem reading "TwoChanges: A LOAN SHOWS ITS DATE and A MEMBER CAN RENEW ONCE change A LOAN HAS A DUE DATE: one block would replace the other. Nothing was composed. To go on, give one of the two the class new, or merge them into one.": the refusal is the writer's, so a part and another candidate that change one requirement are refused as two candidates are; nothing is written to docs/spec-freigaben
test("spec-entry/draft - a part and another candidate that change one requirement are refused, nothing written", async () => {
  const { panel, product } = await panelOf({ candidates: [candidate(TWO, TWO_RULE), { ...candidate(CLEAN, CLEAN_RULE), class: "change", of: LOAN }] });
  click(splitOf(itemOf(panel, TWO))[0]);
  const part = partsOf(panel)[0];
  fill(part, "A LOAN SHOWS ITS DATE", "Every loan states its due date.");
  setClass(part, "change", LOAN);
  assert.equal(await problemOf(panel), `TwoChanges: A LOAN SHOWS ITS DATE and ${CLEAN} change ${LOAN}: one block would replace the other. Nothing was composed. To go on, give one of the two the class new, or merge them into one.`);
  assert.equal(proposalsOf(product).length, 0);
});

// TST-634009 · level: unit · module: MOD-review-pages
// guards: UC-005
// given: the `change` candidate of TST-634001, split; the part named THE RETURN PLACE IS SHOWN with the rule "Every loan shows its return place."; the person sets the part's class to `change` and clears its "of"; the candidate's "of" is cleared too
// input: Write proposals
// expect: no problem: a `change` with an empty "of" names no requirement, so two of them are not two changes of one requirement; the write result is shown
test("spec-entry/draft - two parts of class change with an empty of are not refused", async () => {
  const { panel } = await panelOf(changeDraft());
  click(splitOf(itemOf(panel, CHANGED))[0]);
  const part = partsOf(panel)[0];
  fill(part, "THE RETURN PLACE IS SHOWN", "Every loan shows its return place.");
  setClass(part, "change", "");
  setClass(itemOf(panel, CHANGED), "change", "");
  click(byClass(panel, "button", "write-proposals")[0]);
  await until(() => byClass(panel, "p", "written").length === 1, "the write result");
  assert.equal(byClass(panel, "p", "problem").length, 0);
});

// ---------------------------------------------------------------- ITM-636: two candidates that change one requirement are refused by the writer

// TST-636010 · level: unit · module: MOD-review-pages
// guards: UC-005; A CHANGE IS PROPOSED UNDER THE EXISTING NAME; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the endpoint answers, in every round, two different candidates, THE DUE DATE IS SHOWN and A MEMBER CAN RENEW ONCE, each a `change` of A LOAN HAS A DUE DATE; no split
// input: Write proposals; then the person sets A MEMBER CAN RENEW ONCE to `new` with an empty "of" and presses Write proposals again
// expect: the first press shows a problem reading "TwoChanges: THE DUE DATE IS SHOWN and A MEMBER CAN RENEW ONCE change A LOAN HAS A DUE DATE: one block would replace the other. Nothing was composed. To go on, give one of the two the class new, or merge them into one."; nothing is written to docs/spec-freigaben; Write proposals is enabled again; the second press writes one commit whose entry 01-lending.md holds the block of A LOAN HAS A DUE DATE with the rule "Every loan shows its due date and its return place." and the block A MEMBER CAN RENEW ONCE with its rule
test("spec-entry/draft - two different candidates that change one requirement are refused, nothing written", async () => {
  const { panel, product } = await panelOf({ candidates: [{ ...candidate(CHANGED, CHANGED_RULE), class: "change", of: LOAN }, { ...candidate(CLEAN, CLEAN_RULE), class: "change", of: LOAN }] });
  assert.equal(await problemOf(panel), `TwoChanges: ${CHANGED} and ${CLEAN} change ${LOAN}: one block would replace the other. Nothing was composed. To go on, give one of the two the class new, or merge them into one.`);
  assert.equal(proposalsOf(product).length, 0);
  assert.equal(byClass(panel, "button", "write-proposals")[0].disabled, false);
  setClass(itemOf(panel, CLEAN), "new", "");
  click(byClass(panel, "button", "write-proposals")[0]);
  await until(() => byClass(panel, "p", "written").length === 1, "the write result");
  assert.equal(proposalsOf(product).length, 1);
  assert.ok(lendingEntry(product).includes(blockOf(LOAN, CHANGED_RULE)), JSON.stringify(lendingEntry(product)));
  assert.ok(lendingEntry(product).includes(blockOf(CLEAN, CLEAN_RULE)), JSON.stringify(lendingEntry(product)));
});
