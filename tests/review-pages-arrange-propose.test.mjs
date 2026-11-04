// MOD-review-pages' *Propose groups* on the arrangement (ITM-727), as UC-021 1b and the accepted text of docs/architecture/MOD-review-pages.md state it: "`arrange/<group kind>` — … *Propose
// groups*, whose proposal arrives as pending changes, and *Save arrangement*, which commits the group file only", and UC-021 1b: "The author asks a participant to propose an arrangement
// (**Propose groups**). As in UC-019: the author chooses a participant, sees what is sent — titles and identifiers of the items, with their text for requirements — and presses *Run*. The
// proposal arrives as a list of pending changes in step 3, where the author edits it before saving." The kind `propose-groups` runs in the tab with its check `group-rules`; nothing is written by
// the job.
// Run: node --test tests/review-pages-arrange-propose.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-021; THE PAGE NAMES WHERE IT SENDS; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; ONE CLICK PER DECISION
// Level: unit
//
// The document is the small DOM of tests/review-pages-harness.mjs; the product is a Host of the test's own, the instance a snapshot with the register of participants the test gives, and the model
// endpoint a fixture behind the global `fetch`, which records every request. The real MOD-job-runner, MOD-runtimes, MOD-job-catalogue, MOD-participant-list, MOD-group-document, MOD-artifact-edits
// and MOD-site-frame run as they are, the strategies registered as the view hands them to the frame. Nothing reaches the network. Each test states its input and its expected result before it
// runs (given / input / expect). The counter-proofs are run as mutations and recorded in the pull request. Where the texts leave a reading open, the tests state the one they take, and the pull
// request names it:
//   - On the page of `arrange` a section <section class="arrange-propose"> offers the participants that can draft text as the other drafting pages do (<li class="participant"> with <input
//     class="participant"> radio, its place and routes), and <button class="arrange-propose-run"> "Propose groups", which shows the run panel (<section class="run-panel">) of the kind
//     `propose-groups` for the chosen participant; Run is the panel's own button. Nothing is sent, and nothing recorded, before Run.
//   - The job's parameter is `kind`, the group kind of the page (`use-cases`, `requirements`, …), which MOD-artifact-edits' recipe `items-of-kind` and the check `group-rules` read.
//   - The moves of the answer arrive as pending changes in the order the participant gave them, each applied alone to the tree as it stands: those that apply are <li class="arrange-pending-item">,
//     those the tree refuses are <li class="arrange-refused-item"> with the reason. The group file is committed by *Save arrangement* alone.

import "./review-pages-harness.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

// Every commit the fakes of this file make is its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page.
let commitsMade = 0;

const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
const pages = await import("../src/review-pages/index.mjs");
const route = pages.view.routes.find((candidate) => candidate.name === "arrange");
pages.view.strategies.forEach((strategies, at) => registerStrategies(`tests/review-pages-arrange-propose.test.mjs#${at}`, strategies));

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };
const RULE = "A LOAN HAS A DUE DATE";
const useCase = (id, title) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Reader", "realises:", `  - ${RULE}`, "---", `# ${id} ${title}`, "", "**Goal.** A goal.");
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`, "Every loan states the date by which the book is returned.",
  "*Check:* `tests/loan.test.mjs`", "", "**A BOOK CAN BE RETURNED** *(Product Owner)*", "A returned book is back on the shelf.", "*Check:* no automatic check; at review");
const PRODUCT = {
  "README.md": "# Thesis tool\n", "SPEC.md": SPEC,
  "docs/use-cases/UC-001-lend-a-book.md": useCase("UC-001", "Lend a book"), "docs/use-cases/UC-002-return-a-book.md": useCase("UC-002", "Return a book"),
  "docs/use-cases/UC-003-pay-a-fine.md": useCase("UC-003", "Pay a fine"), "docs/use-cases/UC-004-reserve-a-book.md": useCase("UC-004", "Reserve a book"),
  "docs/groups/use-cases.md": text("# Use cases — groups", "", "The hierarchy of the use cases, each member by its identifier.", "", "- Review", "  - UC-001", "  - UC-002", "- Derivation", "  - UC-003"),
};
const GROUPS_PATH = "docs/groups/use-cases.md";

function fakeProduct(files = PRODUCT) {
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made} of the file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree, parent });
    return sha;
  };
  head = commitOf(new Map(Object.entries(files)), null);
  const bareSnapshotAt = (sha, ref) => {
    const { tree } = commits.get(sha);
    return { repository: ON_GITHUB, ref, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null), blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  // Each snapshot serves the graph the push job stores for its commit (tests/stored-graph-fake.mjs); a page reads it and never builds one (MOD-trace-graph).
  const snapshotAt = (...args) => withStoredGraph(bareSnapshotAt(...args));
  return {
    files: () => Object.fromEntries(commits.get(head).tree),
    head: () => head,
    writes: () => calls.map((call) => call.change),
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
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

// The instance: this repository's files from the disk, with the register of participants the test gives.
const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => { try { return readFileSync(new URL(path, ROOT), "utf8"); } catch { return null; } };
const REGISTER_HEAD = onDisk("docs/participants.md").split("\n").filter((line, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const registerOf = (...rows) => `${REGISTER_HEAD}\n${rows.join("\n")}\n`;
const DRAFTER = "| drafter-a | model endpoint | model-a | 200000 | — | draft text | this machine | endpoint ep1 |";
const READER = "| reader | person | — | — | — | read the repository | — | the GitHub account `reader` |";
function fakeInstance(register) {
  const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" }, ref: "main",
    commit: "abc123def4567890abc123def4567890abc123de", paths: [], read: async (path) => (path === "docs/participants.md" ? register : onDisk(path)), blob: () => null };
  return { host: { async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; }, async readSnapshot() { return snapshot; } } };
}

// The model endpoint behind the global fetch: ep1 answers the moves; every request is kept with its body.
let requests = [];
const realFetch = globalThis.fetch;
const MOVES = [{ op: "create", title: "Lending", in: [] }, { op: "move", item: "UC-004", to: ["Lending"] }, { op: "move", item: "UC-002", to: ["Lending"] }];
function endpointAnswers(moves = MOVES) {
  requests = [];
  globalThis.fetch = async (input, init = {}) => {
    const href = String(input?.url ?? input);
    requests.push({ href, body: String(init.body ?? "") });
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ draft: { moves }, answers: [] }) } }], usage: { prompt_tokens: 10, completion_tokens: 5 } }),
      { status: 200, headers: { "content-type": "application/json" } });
  };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

// ---------------------------------------------------------------- the page

async function show(fake, { kind = "use-cases", register = registerOf(DRAFTER, READER), token = true } = {}) {
  const store = openStore(token ? "alice/agent-m" : "nobody/agent-m");
  if (token) writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  writeSetting(store, "endpoint:ep1", { url: "https://ep1.example.test/v1", kind: "openai-compatible", model: "m", throughBridge: false });
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { page: "review", instance: { repository: "alice/agent-m", host: fakeInstance(register).host }, store, go() {}, product: { address: ON_GITHUB.web, kind: "github", host: fake.host } }, { kind });
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
  const limit = Date.now() + 3000;
  while (Date.now() < limit) {
    if (condition()) return;
    await new Promise((resolve) => setImmediate(resolve));
  }
  assert.fail(`waited for ${what}`);
}
const choose = (target, name) => {
  const box = byClass(target, "input", "participant").find((each) => each.value === name);
  assert.ok(box, `${name} is offered`);
  box.checked = true;
  box.dispatchEvent(new Event("change"));
};
const runButtons = (root) => find(root, (node) => node.localName === "button" && node.textContent === "Run");
async function panelFor(target, name = "drafter-a") {
  choose(target, name);
  click(byClass(target, "button", "arrange-propose-run")[0]);
  await until(() => byClass(target, "section", "run-panel").length === 1, "the run panel");
  return byClass(target, "section", "run-panel")[0];
}
const pending = (target) => byClass(target, "li", "arrange-pending-item").map((item) => item.textContent);
const requestsToModel = () => requests.filter((request) => request.href.includes("ep1.example.test"));

// TST-072701 · level: unit · module: MOD-review-pages
// guards: UC-021; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION
// given: the arrangement of the use cases of a product with four use cases and a group file; the instance's register holds the drafter drafter-a (an endpoint, "this machine") and a person who only reads
// input: the page is drawn; drafter-a is chosen and Propose groups pressed
// expect: only drafter-a is offered; the run panel names one destination, drafter-a as drafter at "this machine", receiving the parts "the use-cases" and "docs/groups/use-cases.md", and a Run button of the panel's own; the model was asked nothing, and nothing was committed
test("arrange — Propose groups shows what is sent where, and nothing is sent or written before Run", async () => {
  endpointAnswers();
  const fake = fakeProduct();
  const target = await show(fake);
  assert.deepEqual(byClass(target, "li", "participant").map((item) => item.getAttribute("data-name")), ["drafter-a"]);
  const panel = await panelFor(target);
  const destinations = byClass(panel, "section", "destination");
  assert.equal(destinations.length, 1);
  assert.match(destinations[0].textContent, /drafter-a — drafter/);
  assert.match(destinations[0].textContent, /this machine/);
  assert.deepEqual(byClass(destinations[0], "li", "part").map((item) => item.textContent.split(" — ")[0]), ["the use-cases", GROUPS_PATH]);
  assert.equal(runButtons(panel).length, 1);
  assert.deepEqual(requests, [], "nothing was sent");
  assert.deepEqual(fake.writes(), [], "nothing was committed");
});

// TST-072702 · level: unit · module: MOD-review-pages
// guards: UC-021; ONE CLICK PER DECISION
// given: the same page, the panel shown, and a participant whose answer is three moves: a new group Lending, UC-004 into it, and UC-002 into it
// input: Run; then Save arrangement
// expect: after Run the model was asked once and the moves stand as three pending changes — "Add the group “Lending”", "Move UC-004 from the top level to “Lending”", "Move UC-002 from “Review” to “Lending”" — beside the tree, and the group file is unchanged (the job record is the only thing the job commits: no commit holds docs/groups/use-cases.md); Save arrangement then commits the group file and nothing else, with UC-004 and UC-002 under Lending
test("arrange — Run starts the job in the tab, the moves stand as pending changes, and Save arrangement writes the group file alone", async () => {
  endpointAnswers();
  const fake = fakeProduct();
  const target = await show(fake);
  const panel = await panelFor(target);
  click(runButtons(panel)[0]);
  await until(() => pending(target).length === 3, "the pending changes");
  assert.deepEqual(pending(target), ["Add the group “Lending”", "Move UC-004 from the top level to “Lending”", "Move UC-002 from “Review” to “Lending”"]);
  assert.equal(requestsToModel().length, 1, "the model was asked once");
  assert.equal(fake.writes().filter((change) => change.files.some((file) => file.path === GROUPS_PATH)).length, 0, "the group file is unchanged");
  assert.equal(fake.files()[GROUPS_PATH], PRODUCT[GROUPS_PATH]);
  click(byClass(target, "button", "arrange-save")[0]);
  await until(() => byClass(target, "p", "arrange-result").length === 1, "the result of Save");
  const saves = fake.writes().filter((change) => change.files.some((file) => file.path === GROUPS_PATH));
  assert.equal(saves.length, 1);
  assert.deepEqual(saves[0].files.map((file) => file.path), [GROUPS_PATH], "the group file alone");
  assert.match(saves[0].files[0].text, /- Lending\n {2}- UC-004\n {2}- UC-002/);
});

// TST-072703 · level: unit · module: MOD-review-pages
// guards: UC-021; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS
// given: the arrangement of the requirements of the same product
// input: Propose groups with drafter-a, and Run
// expect: the request to the model holds the requirement names and, for requirements, their text ("Every loan states the date by which the book is returned.")
test("arrange — for requirements the text of each is sent with its name", async () => {
  endpointAnswers([]);
  const fake = fakeProduct({ ...PRODUCT, "docs/groups/requirements.md": text("# Requirements — groups", "") });
  const target = await show(fake, { kind: "requirements" });
  const panel = await panelFor(target);
  click(runButtons(panel)[0]);
  await until(() => requestsToModel().length === 1, "the request");
  assert.match(requestsToModel()[0].body, new RegExp(RULE));
  assert.match(requestsToModel()[0].body, /Every loan states the date by which the book is returned\./);
});

// TST-072704 · level: unit · module: MOD-review-pages
// guards: UC-021; THE PAGE NAMES WHERE IT SENDS
// given: the same page without a token stored for the product
// input: the page is drawn
// expect: counter-proof — no run panel can be shown: Propose groups offers no Run, and says that a job is recorded and its result written with the person's token; the model is asked nothing
test("arrange — without a token Propose groups offers no run", async () => {
  endpointAnswers();
  const target = await show(fakeProduct(), { token: false });
  assert.equal(byClass(target, "section", "arrange-propose").length, 1, "known positive: the section stands");
  click(byClass(target, "button", "arrange-propose-run")[0]);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(byClass(target, "section", "run-panel").length, 0);
  assert.equal(runButtons(target).length, 0);
  assert.match(byClass(target, "section", "arrange-propose")[0].textContent, /token/);
  assert.deepEqual(requests, []);
});

// TST-072705 · level: unit · module: MOD-review-pages
// guards: UC-021; ONE CLICK PER DECISION
// given: the same page and no participant chosen
// input: Propose groups pressed
// expect: counter-proof — "Choose the participant that drafts." is said, no run panel is shown, and nothing is sent
test("arrange — Propose groups without a chosen participant says so and shows no run panel", async () => {
  endpointAnswers();
  const target = await show(fakeProduct());
  click(byClass(target, "button", "arrange-propose-run")[0]);
  await until(() => byClass(target, "p", "problem").length === 1, "the problem");
  assert.match(byClass(target, "p", "problem")[0].textContent, /Choose the participant that drafts\./);
  assert.equal(byClass(target, "section", "run-panel").length, 0);
  assert.deepEqual(requests, []);
});

// TST-072706 · level: unit · module: MOD-review-pages
// guards: UC-021; AN ITEM HAS ONE PLACE IN ITS HIERARCHY
// given: the same page and a participant whose answer holds a good move (UC-004 into the existing group Review) and one the tree refuses (UC-002 into a group that does not exist)
// input: Run
// expect: the good move is a pending change; the refused one is listed among the refused moves with its reason and is no pending change; the group file is unchanged
test("arrange — a proposed move the tree refuses is listed with its reason and is no pending change", async () => {
  endpointAnswers([{ op: "move", item: "UC-004", to: ["Review"] }, { op: "move", item: "UC-002", to: ["Nowhere"] }]);
  const fake = fakeProduct();
  const target = await show(fake);
  const panel = await panelFor(target);
  click(runButtons(panel)[0]);
  await until(() => byClass(target, "li", "arrange-refused-item").length === 1, "the refused move");
  assert.deepEqual(pending(target), ["Move UC-004 from the top level to “Review”"]);
  assert.match(byClass(target, "li", "arrange-refused-item")[0].textContent, /Move UC-002 to “Nowhere”: /);
  assert.equal(fake.files()[GROUPS_PATH], PRODUCT[GROUPS_PATH]);
});

// TST-072707 · level: unit · module: MOD-review-pages
// guards: UC-021; ONE CLICK PER DECISION
// given: the same page where the author has already added the group "Mine" by hand
// input: Propose groups and Run, with a participant whose answer is one move (UC-004 into Review)
// expect: the proposal is added to what the author did: two pending changes, the author's first, and nothing the author did is lost
test("arrange — a proposal comes on top of the changes the author already made", async () => {
  endpointAnswers([{ op: "move", item: "UC-004", to: ["Review"] }]);
  const target = await show(fakeProduct());
  byClass(target, "input", "arrange-group-title")[0].value = "Mine";
  click(byClass(target, "button", "arrange-new-group")[0]);
  assert.deepEqual(pending(target), ["Add the group “Mine”"], "known positive: the author's change stands");
  const panel = await panelFor(target);
  click(runButtons(panel)[0]);
  await until(() => pending(target).length === 2, "the proposal");
  assert.deepEqual(pending(target), ["Add the group “Mine”", "Move UC-004 from the top level to “Review”"]);
});

// ---------------------------------------------------------------- the job record of Propose groups (ITM-1359)

// The tests of the product, as MOD-test-document reads them from a test file (a header line `// TST-<n> · level: … · module: …`, then guards, given, input and expect).
const testFile = (...ids) => text(...ids.flatMap((id) => [`// TST-${id} · level: unit · module: MOD-reader`, `// guards: ${RULE}`, "// given: a fixture", "// input: a call", "// expect: a result", `test("case ${id}", () => {});`, ""]));
const WITH_TESTS = { ...PRODUCT, "tests/loan.test.mjs": testFile("101", "102"), "tests/shelf.test.mjs": testFile("103"), "docs/groups/tests.md": text("# Tests — groups", "") };
const jobRecordOf = (fake) => {
  const written = fake.writes().flatMap((change) => change.files).filter((file) => /^docs\/jobs\/JOB-.*\.md$/.test(file.path));
  assert.ok(written.length >= 1, "known positive: the job's record was committed");
  return written[0].text;
};
const worksOnOf = (record) => {
  const front = record.split("\n---")[0];
  return front.split("\nworks_on:\n")[1].split("\n").filter((line, at, all) => all.slice(0, at).every((each) => each.startsWith("  - "))).filter((line) => line.startsWith("  - ")).map((line) => line.slice(4));
};

// TST-1359001 · level: unit · module: MOD-review-pages
// guards: UC-021; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the arrangement of the tests of a product with the tests TST-101, TST-102 and TST-103, and the drafter drafter-a, whose answer is one move: a new group Lending; the commit the page read is the product's head
// input: Propose groups with drafter-a, and Run
// expect: the model is asked once, with the three identifiers; the proposal arrives as the pending change "Add the group “Lending”"; the job's record is committed and its works_on holds that one commit and no test identifier
test("TST-1359001: Propose groups on the tests records the commit the page read as works_on", async () => {
  endpointAnswers([{ op: "create", title: "Lending", in: [] }]);
  const fake = fakeProduct(WITH_TESTS);
  const read = fake.head();
  const target = await show(fake, { kind: "tests" });
  const panel = await panelFor(target);
  click(runButtons(panel)[0]);
  await until(() => pending(target).length === 1, "the pending change");
  assert.deepEqual(pending(target), ["Add the group “Lending”"]);
  assert.equal(requestsToModel().length, 1, "the model was asked once");
  for (const id of ["TST-101", "TST-102", "TST-103"]) assert.ok(requestsToModel()[0].body.includes(id), id);
  assert.deepEqual(worksOnOf(jobRecordOf(fake)), [read]);
});

// TST-1359002 · level: unit · module: MOD-review-pages
// guards: UC-021; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the arrangement of the use cases of the product of TST-072701, whose use cases are UC-001 to UC-004
// input: Propose groups with drafter-a, and Run
// expect: known positive and counter-proof of TST-1359001 — the job's record is committed and its works_on holds the four use cases, as before, and not the commit the page read
test("TST-1359002: Propose groups on the use cases still records their identifiers as works_on", async () => {
  endpointAnswers([{ op: "create", title: "Lending", in: [] }]);
  const fake = fakeProduct(WITH_TESTS);
  const read = fake.head();
  const target = await show(fake, { kind: "use-cases" });
  const panel = await panelFor(target);
  click(runButtons(panel)[0]);
  await until(() => pending(target).length === 1, "the pending change");
  const worksOn = worksOnOf(jobRecordOf(fake));
  assert.deepEqual(worksOn, ["UC-001", "UC-002", "UC-003", "UC-004"]);
  assert.ok(!worksOn.includes(read));
});

// TST-1359003 · level: unit · module: MOD-review-pages
// guards: UC-021; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the arrangement of the requirements of the same product, whose requirements are A BOOK CAN BE RETURNED and A LOAN HAS A DUE DATE
// input: Propose groups with drafter-a, and Run
// expect: counter-proof of TST-1359001 — the job's record is committed and its works_on holds the two requirement names, as before, and not the commit the page read
test("TST-1359003: Propose groups on the requirements still records their names as works_on", async () => {
  endpointAnswers([]);
  const fake = fakeProduct({ ...WITH_TESTS, "docs/groups/requirements.md": text("# Requirements — groups", "") });
  const read = fake.head();
  const target = await show(fake, { kind: "requirements" });
  const panel = await panelFor(target);
  click(runButtons(panel)[0]);
  await until(() => requestsToModel().length === 1, "the request");
  await until(() => fake.writes().some((change) => change.files.some((file) => file.path.startsWith("docs/jobs/"))), "the job's record");
  const worksOn = worksOnOf(jobRecordOf(fake));
  assert.deepEqual(worksOn, ["A BOOK CAN BE RETURNED", RULE]);
  assert.ok(!worksOn.includes(read));
});
