// Generating tests, up to the proposal (ITM-763) — MOD-test-pages' route `generate`, UC-026 steps 1 to 4, 3a and 4a: the requirements, use cases and modules of the product with the levels
// whose tests already guard each, the uncovered combinations preselected; the levels chosen, each with a folded explanation that names the book's chapter; the participants that fill the
// test-writing role, the implementer left out for the level release and named; the run panel of the kind propose-tests, whose Run queues one job of that kind; a selection that does not fit the
// participant's context sends nothing. ITM-764 adds the rest, UC-026 steps 5 to 8, 5a, 6a, 8b and 1a: the cases of the proposal read from its job's record, grouped beside the existing tests, removed, edited and
// reclassified, and Write tests, which queues one job of the kind write-tests with the cases as the person left them (TST-764001 and following).
// Run: node --test tests/test-pages-generate.test.mjs
//
// Module: MOD-test-pages
// Guards: UC-026; EVERY TEST HAS ONE LEVEL; TEST GENERATION SEES THE EXISTING TESTS; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; A ROLE NAMES THE CAPABILITIES IT NEEDS; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; EVERY STEP EXPLAINS ITSELF; A TEST JOB RECEIVES THE CHAPTER ON TESTING
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged. The product and the instance are hosts of this file, kept to MOD-repository-hosts' interface (repositoryInfo,
// readSnapshot, commitFiles made only on the head that was read); the instance's snapshot gives the register of participants the test sets and the rest of this repository from the disk, the
// book among it. The real MOD-job-runner, MOD-job-catalogue, MOD-runtimes, MOD-job-ledger, MOD-trace-graph, MOD-participant-list and MOD-site-frame run as they are, the strategies registered as
// the view hands them to the frame. Where the texts leave a reading open, the test states the one it takes, and the pull request names it:
//   - A combination is a name and a level that fits its kind: a requirement at release and user, a use case at system, a module at unit and component (UC-026's table). A combination is uncovered
//     when no test of that level guards the name; a test guards a module it names in its `Module:` line, as the recipe test-selection counts it.
//   - A name is preselected when one of its combinations is uncovered; a level when a preselected name lacks it.
//   - The implementer of what a selection checks is the participant of a job of kind implement whose worksOn names a selected name.
//   - The page holds <input class="name"> per name, <input class="level"> per level with a folded <details class="explain">, each in a row <tr> of the frame's table (ITM-1223),
//     <tr class="participant"> per offered participant with <input
//     class="participant"> (a radio), <p class="left-out"> per participant left out, <p class="release-needs-another"> for 4a, <input class="person">, <button class="prepare">, and Run is the panel's own.
// The counter-proofs are recorded in the pull request.

import "./site-frame-dom.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";
import { finding } from "../src/text-tools/index.mjs";
import { approvalSchema } from "../src/approvals/index.mjs";
import { writeDocument } from "../src/documents/index.mjs";
import { storedGraphReadOn } from "./stored-graph-fake.mjs";
import { gzipped } from "../src/trace-graph/stored.mjs";

const { view } = await import("../src/test-pages/index.mjs");
const { registerStrategies } = await import("../src/job-runner/index.mjs");
view.strategies.forEach((strategies, at) => registerStrategies(`tests/test-pages-generate.test.mjs#${at}`, strategies));
const route = view.routes.find((candidate) => candidate.name === "generate");

// ---------------------------------------------------------------- the product

const PRODUCT = "https://github.com/alice/thesis-tool";
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: PRODUCT };
const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", "**RULE ONE** *(Product Owner)*", "One rule.", "*Check:* `tests/a.test.mjs`", "",
  "**RULE TWO** *(Product Owner)*", "Another rule.", "*Check:* `tests/a.test.mjs`");
const useCase = (id, realises) => text("---", `id: ${id}`, `title: Case ${id}`, "area: lending", "actors:", "  - Member", "realises:", `  - ${realises}`, "---", `# ${id} Case`, "", "**Goal.** A goal.");
const moduleFile = (id, realises) => text("---", `id: ${id}`, `title: Module ${id}`, `folder: src/${id}/`, "realises:", `  - ${realises}`, "follows:", "uses:", "provides:", "  - f", "---", `# ${id} Module`);
// A test file's text: one declaration for each entry [number, level, module, guards]; built by join, so that no line of this file is a declaration.
const declarations = (entries) => entries.map(([number, level, module, guards]) => ["// TST-" + number + " · level: " + level + " · module: " + module, "// guards: " + guards,
  "// given: g", "// input: i", "// expect: e", "test(\"t\", () => {});", ""].join("\n")).join("\n");
// RULE ONE is guarded at release and user (and unit), UC-001 at system, MOD-b at unit and component; RULE TWO, UC-002 and MOD-a are not.
const TESTS = declarations([["1", "unit", "none", "RULE ONE"], ["2", "release", "none", "RULE ONE"], ["3", "user", "none", "RULE ONE"], ["4", "system", "none", "UC-001"],
  ["5", "unit", "MOD-b", "RULE TWO"], ["6", "component", "MOD-b", "RULE TWO"]]);
const FILES = { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, "docs/use-cases/UC-001-one.md": useCase("UC-001", "RULE ONE"), "docs/use-cases/UC-002-two.md": useCase("UC-002", "RULE TWO"),
  "docs/architecture/MOD-a.md": moduleFile("MOD-a", "RULE ONE"), "docs/architecture/MOD-b.md": moduleFile("MOD-b", "RULE TWO"), "tests/a.test.mjs": TESTS,
  ".github/workflows/agent-m-jobs.yml": "name: agent-m-jobs\n" };
const IMPLEMENTED = { id: "JOB-20261010-0900-abcd", kind: "implement", worksOn: ["UC-002"], participant: "writer-a", model: "model-y", route: "bridge lab-pc", run: null, retries: null,
  startedBy: "alice", start: new Date("2026-10-10T09:00:00Z"), agentM: { version: "2026.10.0", commit: "abc1234" }, inputs: [], limit: 5, destinations: [], params: {} };
const withImplementer = { ...FILES, [`docs/jobs/${IMPLEMENTED.id}.md`]: startRecord(IMPLEMENTED).text };

// UC-002 accepted: the record of the approval names the blob of its current text (the precondition rests-on-accepted).
const UC_2 = "docs/use-cases/UC-002-two.md";
const accepted = { ...FILES, [`docs/approvals/UC-002-${blobOf(FILES[UC_2]).slice(0, 12)}.md`]: writeDocument(approvalSchema, { fields: { kind: "use-case", file: UC_2, blob: blobOf(FILES[UC_2]) } }) };

// `readOn`: the snapshot's own; without one, the branch trace-cache holds the graph of every commit, as the workflow "main changed" stores it (tests/stored-graph-fake.mjs).
// Each product's commits are its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page (the module), so two tests never share a commit.
let products = 0;
function fakeProduct(files = FILES, { readOn = null } = {}) {
  const calls = [], product = ++products;
  let head = createHash("sha1").update(`product ${product}`).digest("hex"), tree = new Map(Object.entries(files)), made = 0;
  const read = async (path) => (tree.has(path) ? tree.get(path) : null);
  const stored = readOn ?? storedGraphReadOn({ get commit() { return head; }, get paths() { return [...tree.keys()].sort(); }, read });
  const snapshot = () => ({ repository: ON_GITHUB, ref: "trunk", commit: head, paths: [...tree.keys()].sort(), read,
    blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null), readOn: stored });
  return {
    writes: () => calls,
    host: {
      async repositoryInfo() { return { defaultBranch: "trunk", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readSnapshot() { return snapshot(); },
      async commitFiles(change) {
        calls.push(structuredClone(change));
        if (change.branch !== "trunk" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        tree = new Map([...tree, ...change.files.map((file) => [file.path, file.text])]);
        head = createHash("sha1").update(`product ${product} commit ${++made}`).digest("hex");
        return { commit: head, url: `${PRODUCT}/commit/${head}` };
      },
    },
  };
}

// The instance: this repository's files from the disk — its book among them —, with the register of participants the test gives.
const ROOT = new URL("../", import.meta.url);
const onDisk = (path) => { try { return readFileSync(new URL(path, ROOT), "utf8"); } catch { return null; } };
const REGISTER_HEAD = onDisk("docs/participants.md").split("\n").filter((line, at, all) => at <= all.findIndex((each) => each.startsWith("|---"))).join("\n");
const registerOf = (...rows) => `${REGISTER_HEAD}\n${rows.join("\n")}\n`;
const NEEDS = "read the repository, write to the repository, run code and tests";
const WRITER_A = `| writer-a | CLI agent | model-y | 200000 | — | ${NEEDS} | this machine | bridge lab-pc agent claude |`;
const WRITER_B = `| writer-b | CLI agent | model-z | 200000 | — | ${NEEDS} | this machine | bridge lab-pc agent claude |`;
const CI_WRITER = `| ci-writer | CI agent | model-x | 200000 | — | ${NEEDS} | GitHub Actions in the USA | ci hosted secret CI_KEY |`;
const SMALL_CI = `| small-ci | CI agent | model-s | 100 | — | ${NEEDS} | GitHub Actions in the USA | ci hosted secret CI_KEY |`;
const DRAFTER = "| drafter | model endpoint | example-model | 200000 | — | draft text | this machine | endpoint ep1 |";
function fakeInstance(register) {
  const snapshot = { repository: { server: "github", origin: "https://github.com", path: "alice/agent-m", web: "https://github.com/alice/agent-m" }, ref: "main",
    commit: "abc123def4567890abc123def4567890abc123de", paths: [], read: async (path) => (path === "docs/participants.md" ? register : onDisk(path)), blob: () => null };
  return { async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: false, archived: false, description: "" }; }, async readSnapshot() { return snapshot; } };
}

// ---------------------------------------------------------------- the page

const realFetch = globalThis.fetch;
const sent = [];
test.beforeEach(() => { sent.length = 0; globalThis.fetch = async (url) => { sent.push(String(url)); throw new Error("no network"); }; });
test.afterEach(() => { globalThis.fetch = realFetch; });

async function show(fake, { register = registerOf(WRITER_A, WRITER_B, CI_WRITER, DRAFTER), go = () => {} } = {}) {
  assert.ok(route, "the view offers the route generate");
  const target = document.createElement("div");
  document.body.append(target);
  const context = { page: "main", instance: { repository: "alice/agent-m", host: fakeInstance(register) }, store: null, go, product: { address: PRODUCT, kind: "github", host: fake.host } };
  await route.render(target, context, {});
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
const trusted = (type) => Object.defineProperty(new Event(type), "isTrusted", { value: true });
const click = (node) => node.dispatchEvent(trusted("click"));
const tick = () => new Promise((resolve) => setImmediate(resolve));
async function until(condition, what) {
  const limit = Date.now() + 3000;
  while (Date.now() < limit) {
    if (condition()) return;
    await tick();
  }
  assert.fail(`waited for ${what}`);
}
const checkedNames = (target) => byClass(target, "input", "name").filter((box) => box.checked).map((box) => box.value);
const checkedLevels = (target) => byClass(target, "input", "level").filter((box) => box.checked).map((box) => box.value);
const offeredNames = (target) => byClass(target, "tr", "participant").map((item) => item.getAttribute("data-name")).sort();
function setLevel(target, level, on) {
  const box = byClass(target, "input", "level").find((each) => each.value === level);
  box.checked = on;
  box.dispatchEvent(new Event("change"));
}
const settle = async () => { for (let i = 0; i < 20; i += 1) await tick(); };
async function panelFor(target, name, person = "alice") {
  byClass(target, "input", "person")[0].value = person;
  const box = byClass(target, "input", "participant").find((each) => each.value === name);
  box.checked = true;
  click(byClass(target, "button", "prepare")[0]);
  await until(() => byClass(target, "section", "run-panel").length === 1, "the run panel");
}
const runButtons = (root) => find(root, (node) => node.localName === "button" && node.textContent === "Run");
// The links of a text to the use cases it names: the links and buttons whose text is a use case's identifier.
const useCaseLinks = (root) => find(root, (node) => (node.localName === "a" || node.localName === "button") && /^UC-\d+$/.test(node.textContent));

// ================================================================== the tests

// TST-763001 · level: unit · module: MOD-test-pages
// guards: UC-026; TEST GENERATION SEES THE EXISTING TESTS; EVERY STEP EXPLAINS ITSELF
// given: a product with the requirements RULE ONE (guarded at release and user) and RULE TWO (guarded at neither), the use cases UC-001 (guarded at system) and UC-002 (not), the modules MOD-a (no test) and MOD-b (unit and component)
// input: the route generate, drawn
// expect: every requirement, use case and module listed with the levels that guard it; RULE TWO, UC-002 and MOD-a preselected and the others not; all five levels preselected, since each is lacking for a name; each level with a folded explanation that names chapter 13; nothing written, nothing sent
test("generate — what can be tested with the levels that guard it, the uncovered combinations preselected, each level explained", async () => {
  const fake = fakeProduct();
  const target = await show(fake);
  const listed = byClass(target, "tr", "uncovered").concat(byClass(target, "tr", "covered")).map((item) => item.getAttribute("data-name")).sort();
  assert.deepEqual(listed, ["MOD-a", "MOD-b", "RULE ONE", "RULE TWO", "UC-001", "UC-002"]);
  assert.deepEqual(checkedNames(target).sort(), ["MOD-a", "RULE TWO", "UC-002"]);
  const rowOf = (name) => find(target, (node) => node.localName === "tr" && node.getAttribute("data-name") === name)[0];
  assert.match(byClass(rowOf("RULE ONE"), "span", "covered")[0].textContent, /release, user/);
  assert.match(byClass(rowOf("MOD-a"), "span", "covered")[0].textContent, /no level/);
  assert.match(byClass(rowOf("MOD-a"), "span", "uncovered")[0].textContent, /unit, component/);
  assert.match(byClass(rowOf("MOD-b"), "span", "covered")[0].textContent, /unit, component/);
  assert.deepEqual(checkedLevels(target), ["unit", "component", "system", "release", "user"]);
  for (const item of byClass(target, "tr", "level")) {
    const details = find(item, (node) => node.localName === "details");
    assert.equal(details.length, 1, `${item.getAttribute("data-level")} has one folded explanation`);
    assert.match(details[0].textContent, /chapter 13/);
  }
  assert.deepEqual(fake.writes(), [], "nothing written");
  assert.deepEqual(sent, [], "nothing sent");
});

// TST-763002 · level: unit · module: MOD-test-pages
// guards: UC-026; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER; A ROLE NAMES THE CAPABILITIES IT NEEDS
// given: writer-a recorded as the implementer of UC-002 by a job of kind implement; the register with writer-a, writer-b, a CI agent that declare the three capabilities and a drafter that declares only draft text; UC-002 selected and release chosen
// input: the route generate, drawn; then release unticked
// expect: writer-b and the CI agent are offered and the drafter is not; writer-a is left out and named; with release unticked writer-a is offered too
test("generate — the implementer is left out for release and named, and a participant lacking a capability is not offered", async () => {
  const target = await show(fakeProduct(withImplementer));
  assert.deepEqual(offeredNames(target), ["ci-writer", "writer-b"]);
  const left = byClass(target, "p", "left-out");
  assert.equal(left.length, 1);
  assert.match(left[0].textContent, /writer-a/);
  setLevel(target, "release", false);
  await settle();
  assert.deepEqual(offeredNames(target), ["ci-writer", "writer-a", "writer-b"]);
  assert.equal(byClass(target, "p", "left-out").length, 0);
});

// TST-763003 · level: unit · module: MOD-test-pages
// guards: UC-026; RELEASE TESTS ARE NOT WRITTEN BY THE IMPLEMENTER
// given: the register holds only writer-a, the implementer of UC-002; release is chosen
// input: the route generate, drawn; then release unticked
// expect: no participant is offered, and the page says release tests need a different participant and links UC-017 and UC-002; with release unticked writer-a is offered
test("generate — when the only participant is the implementer, release is said to need another and the other levels can still be generated", async () => {
  const target = await show(fakeProduct(withImplementer), { register: registerOf(WRITER_A) });
  assert.deepEqual(offeredNames(target), []);
  const said = byClass(target, "p", "release-needs-another");
  assert.equal(said.length, 1);
  assert.match(said[0].textContent, /other than the implementer/);
  assert.deepEqual(useCaseLinks(said[0]).map((node) => node.textContent), ["UC-017", "UC-002"]);
  setLevel(target, "release", false);
  await settle();
  assert.deepEqual(offeredNames(target), ["writer-a"]);
  assert.equal(byClass(target, "p", "release-needs-another").length, 0);
});

// TST-763004 · level: unit · module: MOD-test-pages
// guards: UC-026; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; A TEST JOB RECEIVES THE CHAPTER ON TESTING
// given: the page with the preselection and the CI agent chosen, a person's name entered
// input: pressing Show the run panel; then Run twice
// expect: the panel names the participant, where it processes data and what is sent — the selection and the book's chapter on testing —; nothing is written before Run; Run queues exactly one job: one commit of one record docs/jobs/JOB-….md of kind propose-tests, naming the selected names, the participant and the route ci hosted, with the levels as parameters
test("generate — the run panel names where the selection goes and Run queues one job of the kind propose-tests", async () => {
  const fake = fakeProduct(accepted);
  const target = await show(fake);
  await panelFor(target, "ci-writer");
  const panel = byClass(target, "section", "run-panel")[0];
  assert.match(panel.textContent, /ci-writer/);
  assert.match(panel.textContent, /GitHub Actions in the USA/);
  const parts = byClass(panel, "li", "part").map((item) => item.textContent);
  assert.ok(parts.some((part) => /^test-selection /.test(part)), "the selection and its existing tests are sent");
  assert.ok(parts.some((part) => /^13_software-testing\.md /.test(part)), `the book's chapter on testing is sent: ${parts.join(" | ")}`);
  assert.ok(!parts.some((part) => /^(09|11|12)_/.test(part)), "no other chapter is sent");
  assert.deepEqual(fake.writes(), [], "nothing written before Run");
  const [run] = runButtons(target);
  assert.ok(run, "Run is offered");
  click(run);
  click(run);
  await until(() => fake.writes().length >= 1 && byClass(target, "p", "queued").length === 1, "the queued job");
  await settle();
  assert.equal(fake.writes().length, 1, "one commit for two clicks");
  const [file] = fake.writes()[0].files;
  assert.match(file.path, /^docs\/jobs\/JOB-[^/]+\.md$/);
  assert.match(file.text, /kind: propose-tests/);
  assert.match(file.text, /participant: ci-writer/);
  assert.match(file.text, /route: ci hosted/);
  for (const name of ["RULE TWO", "UC-002", "MOD-a"]) assert.ok(file.text.includes(name), `${name} is named in the record`);
  assert.match(file.text, /release/);
});

// TST-763005 · level: unit · module: MOD-test-pages
// guards: UC-026; THE PAGE NAMES WHERE IT SENDS
// given: a CI agent whose context holds 100 tokens, much less than the selection and its existing tests
// input: the preselection, the small CI agent chosen, Show the run panel
// expect: the panel offers no Run; the page says how many existing tests guard the selection and offers a smaller selection or a participant with a larger context; nothing is written or sent
test("generate — a selection that does not fit the participant's context sends nothing and offers a smaller selection", async () => {
  const fake = fakeProduct();
  const target = await show(fake, { register: registerOf(SMALL_CI, CI_WRITER) });
  await panelFor(target, "small-ci");
  assert.equal(runButtons(target).length, 0, "no Run");
  const said = byClass(target, "p", "too-large");
  assert.equal(said.length, 1);
  assert.match(said[0].textContent, /2 existing tests guard this selection/);
  assert.match(said[0].textContent, /smaller selection/);
  assert.match(said[0].textContent, /larger context/);
  assert.deepEqual(fake.writes(), []);
  assert.deepEqual(sent, []);
});

// TST-763006 · level: unit · module: MOD-test-pages
// guards: UC-026; ONE CLICK PER DECISION
// given: the page with nothing chosen
// input: Show the run panel without a participant, then with a participant but no name
// expect: the page names what is missing and shows no run panel
test("generate — the run panel is not shown without a participant and a name", async () => {
  const target = await show(fakeProduct());
  click(byClass(target, "button", "prepare")[0]);
  await settle();
  assert.match(byClass(target, "p", "problem")[0].textContent, /participant/);
  assert.equal(byClass(target, "section", "run-panel").length, 0);
  const box = byClass(target, "input", "participant")[0];
  box.checked = true;
  click(byClass(target, "button", "prepare")[0]);
  await settle();
  assert.match(byClass(target, "p", "problem")[0].textContent, /name/);
  assert.equal(byClass(target, "section", "run-panel").length, 0);
});

// TST-763007 · level: unit · module: MOD-test-pages
// guards: UC-026; THE PAGE NAMES WHERE IT SENDS
// given: the view of the module
// input: its strategies, as the frame registers them
// expect: they hold the recipe test-selection, the check test-proposals and the precondition rests-on-accepted that the kind propose-tests names
test("view — hands the frame the strategies the kind propose-tests uses", () => {
  const names = (category) => view.strategies.flatMap((strategies) => Object.keys(strategies[category] ?? {}));
  assert.ok(names("recipes").includes("test-selection"));
  assert.ok(names("checks").includes("test-proposals"));
  assert.ok(names("preconditions").includes("rests-on-accepted"));
  assert.ok(view.routes.some((candidate) => candidate.name === "generate" && candidate.entry === "tests"));
});

// TST-763008 · level: unit · module: MOD-test-pages
// guards: UC-026; NOTHING IS IMPLEMENTED BEFORE IT IS ACCEPTED
// given: the preselection names the use case UC-002, which no record accepts
// input: the CI agent chosen, Show the run panel
// expect: the panel names UC-002 as not accepted and offers no Run, so that nothing is sent or written
test("generate — a selection that names an unaccepted use case is refused by the panel before anything is sent", async () => {
  const fake = fakeProduct();
  const target = await show(fake);
  await panelFor(target, "ci-writer");
  const panel = byClass(target, "section", "run-panel")[0];
  assert.match(panel.textContent, /UC-002/);
  assert.match(panel.textContent, /not accepted/);
  assert.equal(runButtons(target).length, 0);
  assert.deepEqual(fake.writes(), []);
  assert.deepEqual(sent, []);
});

// ================================================================== ITM-764: the proposal, its review and Write tests

const ENDED = { at: new Date("2026-10-18T10:00:00Z"), state: "done", results: ["waits for a person"], usage: null, cost: { known: false, usage: null }, reason: null, log: null };
const caseOf = (identifier, level, guards, over = {}) => ({ identifier, level, guards, precondition: "a product", input: `input of ${identifier}`, expected: `expected of ${identifier}`, class: "new", ...over });
const PROPOSED = { id: "JOB-20261018-0900-aaaa", kind: "propose-tests", worksOn: ["RULE TWO", "UC-002", "MOD-a"], participant: "ci-writer", model: "model-x", route: "ci hosted", run: null, retries: null,
  startedBy: "alice", start: new Date("2026-10-18T09:00:00Z"), agentM: { version: "2026.10.0", commit: "abc1234" }, inputs: [], limit: 5, destinations: [],
  params: { requirements: ["RULE TWO"], useCases: ["UC-002"], modules: ["MOD-a"], levels: ["unit", "system", "release", "user"] } };
const FLAG = finding({ artifact: "the proposal", line: 1, kind: "warning", rule: "A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS", what: "TST-7003 states no concrete expected result", fix: "state it" });
const roundsOf = (...counts) => counts.map((count, at) => ({ number: at + 1, findings: count ? [FLAG] : [], answers: [] }));
// A product that holds the ended job of the kind propose-tests with these cases and rounds, and the accepted use case UC-002.
function proposed(cases, rounds = roundsOf(1, 1), extra = {}) {
  const record = appendToRecord(startRecord(PROPOSED).text, { part: "end", ...ENDED, draft: { cases }, rounds });
  return { ...accepted, [`docs/jobs/${PROPOSED.id}.md`]: record, ...extra };
}
const CASES = [caseOf("TST-7001", "unit", ["MOD-a"]), caseOf("TST-7002", "system", ["UC-002"]), caseOf("TST-5", "unit", ["RULE TWO"], { class: "extends", of: "TST-5" }),
  caseOf("TST-7003", "release", ["RULE TWO"], { paid: "the model endpoint" }), caseOf("TST-7004", "user", ["RULE TWO"]), caseOf("TST-7005", "unit", ["MOD-a"], { class: "duplicate", of: "TST-5" })];
const caseNode = (target, id) => find(target, (node) => node.localName === "li" && node.getAttribute("data-case") === id)[0];
const fieldOfCase = (target, id, className) => byClass(caseNode(target, id), "textarea", className)[0];
const selectOfCase = (target, id, className) => byClass(caseNode(target, id), "select", className)[0];
const writeButton = (target) => byClass(target, "button", "write")[0];
async function readProposal(fake, { register } = {}) {
  const target = await show(fake, register ? { register } : {});
  click(byClass(target, "button", "read")[0]);
  await until(() => byClass(target, "section", "proposal")[0].childNodes.length > 0, "the proposal");
  await settle();
  return target;
}
const parametersOf = (text) => JSON.parse(/## Parameters\n+```json\n([\s\S]*?)\n```/.exec(text)[1]);

// TST-764001 · level: unit · module: MOD-test-pages
// guards: UC-026; WHAT A PERSON DECIDES IS NOT SENT BACK; THE ROUNDS ARE COUNTED AND SHOWN; A TEST STATES ITS EXPECTED RESULT BEFORE IT RUNS
// given: an ended job of the kind propose-tests whose record holds six cases — unit, system, an extension of the existing test TST-5, a release case that needs a paid call, a user case and a duplicate — and two rounds, the last with one flag left
// input: the route generate drawn, then Read the proposal pressed
// expect: the cases grouped by level in the order of the levels and by what they guard; TST-5 beside the existing test TST-5 with its expected result; the release case marked for the nightly run, the user case marked manual with the reason that no counter-proof is taken; "Correction rounds: 2" and the flag; nothing written
test("generate — the proposal is read from the job's record, grouped by level and by what it guards, beside the existing tests, with the rounds and the flags", async () => {
  const fake = fakeProduct(proposed(CASES));
  const target = await readProposal(fake);
  const groups = byClass(target, "section", "case-group").map((node) => [node.getAttribute("data-level"), node.getAttribute("data-guards")]);
  assert.deepEqual(groups, [["unit", "MOD-a"], ["unit", "RULE TWO"], ["system", "UC-002"], ["release", "RULE TWO"], ["user", "RULE TWO"]]);
  assert.deepEqual(byClass(find(target, (node) => node.getAttribute?.("data-guards") === "MOD-a")[0], "li", "case").map((node) => node.getAttribute("data-case")), ["TST-7001", "TST-7005"]);
  assert.match(byClass(caseNode(target, "TST-5"), "div", "existing")[0].textContent, /Existing TST-5 \(unit\), expects: e/);
  assert.match(byClass(caseNode(target, "TST-7001"), "div", "existing")[0].textContent, /No existing test/);
  assert.match(byClass(caseNode(target, "TST-7003"), "span", "nightly")[0].textContent, /paid call.*nightly or release run only/);
  assert.match(byClass(caseNode(target, "TST-7004"), "span", "manual")[0].textContent, /no counter-proof is taken/);
  assert.equal(byClass(caseNode(target, "TST-7001"), "span", "nightly").length, 0);
  assert.match(byClass(target, "p", "rounds")[0].textContent, /Correction rounds: 2/);
  assert.match(byClass(target, "li", "flag")[0].textContent, /TST-7003 states no concrete expected result/);
  assert.equal(fieldOfCase(target, "TST-7001", "case-expected").value, "expected of TST-7001");
  assert.deepEqual(fake.writes(), [], "reading writes nothing");
});

// TST-764002 · level: unit · module: MOD-test-pages
// guards: UC-026; WHAT A PERSON DECIDES IS NOT SENT BACK; ONE CLICK PER DECISION; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT
// given: the proposal of the previous test; the person edits the expected result of TST-7001, reclassifies TST-7002 to the level release and removes the duplicate TST-7005
// input: Write tests pressed once
// expect: one commit of one record of the kind write-tests, for the participant of the proposal on the route ci hosted, whose parameters hold the selection and levels of the proposal, the route, and five cases as the person left them, in the order of the panel: the edited expected result, the new level, no TST-7005
test("generate — Write tests queues one job of the kind write-tests with the cases as the person left them", async () => {
  const fake = fakeProduct(proposed(CASES));
  const target = await readProposal(fake);
  fieldOfCase(target, "TST-7001", "case-expected").value = "returns 4";
  selectOfCase(target, "TST-7002", "case-level").value = "release";
  click(byClass(caseNode(target, "TST-7005"), "button", "remove")[0]);
  assert.deepEqual(fake.writes(), [], "nothing written before the click");
  click(writeButton(target));
  await settle();
  await until(() => byClass(target, "p", "queued").length === 1, "the queued job");
  await settle();
  assert.equal(fake.writes().length, 1, "one commit for one click");
  const [file] = fake.writes()[0].files;
  assert.match(file.path, /^docs\/jobs\/JOB-[^/]+\.md$/);
  assert.match(file.text, /kind: write-tests/);
  assert.match(file.text, /participant: ci-writer/);
  assert.match(file.text, /route: ci hosted/);
  const params = parametersOf(file.text);
  assert.deepEqual([params.requirements, params.useCases, params.modules, params.levels, params.route], [["RULE TWO"], ["UC-002"], ["MOD-a"], ["unit", "system", "release", "user"], "ci hosted"]);
  const handed = new Map(params.draft.cases.map((one) => [one.identifier, one]));
  assert.deepEqual([...handed.keys()].sort(), ["TST-5", "TST-7001", "TST-7002", "TST-7003", "TST-7004"]);
  assert.equal(handed.get("TST-7001").expected, "returns 4");
  assert.equal(handed.get("TST-7002").level, "release");
  assert.equal(handed.get("TST-5").of, "TST-5", "what the person did not change is handed over as it was");
});

// TST-764003 · level: unit · module: MOD-test-pages
// guards: UC-026; ONE CLICK PER DECISION
// given: a proposal in which every case is a duplicate of an existing test
// input: the route generate drawn, Read the proposal pressed; then, for a proposal of two new cases, both reclassified as duplicates and Write tests pressed
// expect: the page says every case is a duplicate, offers no Write tests and queues nothing; in the second case the press names that nothing is written and queues nothing
test("generate — when every case is a duplicate the page says so and writes nothing", async () => {
  const duplicates = [caseOf("TST-5", "unit", ["RULE TWO"], { class: "duplicate", of: "TST-5" }), caseOf("TST-6", "component", ["RULE TWO"], { class: "duplicate", of: "TST-6" })];
  const fake = fakeProduct(proposed(duplicates));
  const target = await readProposal(fake);
  assert.equal(byClass(target, "p", "all-duplicates").length, 1);
  assert.match(byClass(target, "p", "all-duplicates")[0].textContent, /Nothing is written/);
  assert.equal(writeButton(target), undefined, "no Write tests");
  assert.deepEqual(fake.writes(), []);
  const second = fakeProduct(proposed([caseOf("TST-7001", "unit", ["MOD-a"]), caseOf("TST-7002", "system", ["UC-002"])]));
  const again = await readProposal(second);
  for (const id of ["TST-7001", "TST-7002"]) selectOfCase(again, id, "case-class").value = "duplicate";
  click(writeButton(again));
  await settle();
  assert.match(byClass(again, "p", "all-duplicates")[0].textContent, /Nothing is written/);
  assert.deepEqual(second.writes(), []);
});

// TST-764004 · level: unit · module: MOD-test-pages
// guards: UC-026; A NEW TEST IS SHOWN TO FAIL ON A PLANTED FAULT
// given: the proposal, and the end record of a job of the kind write-tests whose report lists TST-7001 in notWritten because it stays green with the fault planted
// input: Read the proposal pressed
// expect: TST-7001 is shown again among the cases, with the reason and the words sharpen or drop; the other cases carry no such mark
test("generate — a test the participant reports green with its fault is shown again for the person to sharpen or drop", async () => {
  const written = { ...PROPOSED, id: "JOB-20261018-1100-bbbb", kind: "write-tests" };
  const record = appendToRecord(startRecord(written).text, { part: "end", ...ENDED, draft: { notWritten: [{ identifier: "TST-7001", reason: "it stays green with the fault planted" }] }, rounds: [] });
  const fake = fakeProduct(proposed(CASES, roundsOf(0), { [`docs/jobs/${written.id}.md`]: record }));
  const target = await readProposal(fake);
  const marks = byClass(caseNode(target, "TST-7001"), "span", "not-written");
  assert.equal(marks.length, 1);
  assert.match(marks[0].textContent, /it stays green with the fault planted — sharpen it or drop it/);
  assert.equal(byClass(caseNode(target, "TST-7002"), "span", "not-written").length, 0);
});

// TST-764005 · level: unit · module: MOD-test-pages
// guards: UC-026
// given: a product whose jobs hold no propose-tests job with cases
// input: Read the proposal pressed
// expect: the page says that no proposal is recorded yet and offers no Write tests
test("generate — without an ended proposal the page says none is recorded", async () => {
  const target = await readProposal(fakeProduct(accepted));
  assert.match(byClass(target, "p", "no-proposal")[0].textContent, /No proposal is recorded yet/);
  assert.equal(writeButton(target), undefined);
});

// TST-764006 · level: unit · module: MOD-test-pages
// guards: UC-026
// given: the view of the module
// input: its strategies, as the frame registers them
// expect: they hold the writer branch-and-pull-request that the kind write-tests names
test("view — hands the frame the writer the kind write-tests uses", () => {
  const names = (category) => view.strategies.flatMap((strategies) => Object.keys(strategies[category] ?? {}));
  assert.ok(names("writers").includes("branch-and-pull-request"));
  assert.ok(names("checks").includes("test-proposals"));
});

// ---------------------------------------------------------------- the graph stored for the commit (ITM-1119)
//
// MOD-test-pages (Uses): "MOD-test-document.testDeclarations, MOD-trace-graph.traceGraph, MOD-trace-graph.tracesTo — which levels guard what. A graph of a commit's own files is asked for with that commit, so that the
// graph `onMainChanged` stored for it is read where there is one (MOD-workflow-entries)." The stored graph is seen in a module only it holds, MOD-stored, which the page lists only if it read the stored graph.

// TST-1119003 · level: unit · module: MOD-test-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-026
// given: the product of the first test, whose snapshot offers readOn, and the branch trace-cache holding the graph of its commit with one module more than the files hold (MOD-stored)
// input: the route generate, drawn
// expect: the page lists MOD-stored beside the modules of the files, which it could only know from the stored graph; readOn was asked for trace-cache / <commit>.json.gz, once
test("generate — the graph is asked for with its commit, so that the graph stored for it is read", async () => {
  const { traceGraph, graphText } = await import("../src/trace-graph/index.mjs");
  const asked = [];
  let bytes = null;
  const fake = fakeProduct(FILES, { readOn: async (branch, path, options) => { asked.push([branch, path]); return branch === "trace-cache" && path === `${shot.commit}.json.gz` && options?.bytes ? bytes : null; } });
  const shot = await fake.host.readSnapshot();
  const graph = await traceGraph({ paths: shot.paths, read: shot.read }, { commit: shot.commit });
  graph.nodes.set("MOD-stored", { ...graph.nodes.get("MOD-b"), id: "MOD-stored", title: "MOD-stored", path: "docs/architecture/MOD-stored.md" });
  bytes = await gzipped(graphText(graph));
  const target = await show(fake);
  const listed = byClass(target, "tr", "uncovered").concat(byClass(target, "tr", "covered")).map((item) => item.getAttribute("data-name")).sort();
  assert.deepEqual(listed, ["MOD-a", "MOD-b", "MOD-stored", "RULE ONE", "RULE TWO", "UC-001", "UC-002"]);
  assert.deepEqual(asked, [["trace-cache", `${shot.commit}.json.gz`]]);
});

// TST-1119004 · level: unit · module: MOD-test-pages
// guards: A PAGE LOAD READS THE REPOSITORY IN BATCHES; UC-026
// given: the same product, the branch trace-cache holding no graph of the commit
// input: the route generate, drawn
// expect: counter-proof: no graph is built from the files — the page lists no name and shows, in its place, "This page could not be drawn: the trace graph of <commit> is not stored yet …" —, and
//         readOn was asked once, for trace-cache / <commit>.json.gz
test("generate — where no graph is stored for the commit, none is built and the page says so", async () => {
  const asked = [];
  const fake = fakeProduct(FILES, { readOn: async (branch, path) => { asked.push([branch, path]); return null; } });
  const shot = await fake.host.readSnapshot();
  const target = await show(fake);
  assert.deepEqual(byClass(target, "tr", "uncovered").concat(byClass(target, "tr", "covered")), []);
  assert.match(target.textContent, new RegExp(`This page could not be drawn: the trace graph of ${shot.commit.slice(0, 12)} is not stored yet`));
  assert.deepEqual(asked, [["trace-cache", `${shot.commit}.json.gz`]]);
});

// ---------------------------------------------------------------- ITM-1223: the Tests entry's views, in the site's one look
//
// Readings the texts leave open, which these tests state (the pull request names them): the head, its links, the rows, the buttons and the panels are
// checked as tests/test-pages-look.mjs states them; the heading of this route is "Generate tests"; a name to test, a level and a participant that writes
// tests are rows of table.list; a proposed case, which the person edits, is not a row of items.

const look = await import("./test-pages-look.mjs");

// TST-1223007 · level: unit · module: MOD-test-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-026; UC-027; UC-028; UC-029; UC-030
// given: the product with RULE ONE, RULE TWO, UC-001, UC-002, MOD-a and MOD-b, and the writers writer-a, writer-b and ci-writer
// input: the route generate, drawn
// expect: the first part is section.head with the heading Generate tests, the product's address and its default branch, and the five views as the frame's buttons, Generate marked; each of the six names, the five levels and the three writers is a row of table.list with labelled cells; every button carries btn; every section under the head is a panel
test("TST-1223007 — generate: the head leads through the Tests entry's views, Generate marked, its rows the frame's table", async () => {
  const target = await show(fakeProduct());
  look.assertTestsHead(target, { heading: /^Generate tests$/, shown: "Generate" });
  assert.match(look.headOf(target).textContent, new RegExp(`${PRODUCT}.*trunk`));
  const rows = look.assertListRows(target, 6 + 5 + 3);
  const named = (attribute) => rows.map((row) => row.getAttribute(attribute)).filter(Boolean);
  assert.deepEqual(named("data-name").sort(), ["MOD-a", "MOD-b", "RULE ONE", "RULE TWO", "UC-001", "UC-002", "ci-writer", "writer-a", "writer-b"]);
  assert.deepEqual(named("data-level"), ["unit", "component", "system", "release", "user"]);
  look.assertButtons(target, 2);
  look.assertPanels(target, 3);
});

// TST-1225004 · level: unit · module: MOD-test-pages
// guards: EVERY STEP EXPLAINS ITSELF; UC-026
// given: the same product
// input: the route generate, drawn
// expect: the fold of each of the five levels has the text of the frame's explain(test-level-<level>), which is not empty; generate.mjs creates no details element itself
test("TST-1225004 — generate: each level's fold is the frame's explanation of its topic", async () => {
  const { explain } = await import("../src/site-frame/index.mjs");
  const target = await show(fakeProduct());
  for (const row of byClass(target, "tr", "level")) {
    const level = row.getAttribute("data-level");
    const framed = explain(`test-level-${level}`).textContent;
    assert.ok(framed.trim() !== "", `explanations.md holds test-level-${level}`);
    assert.deepEqual(find(row, (node) => node.localName === "details").map((fold) => fold.textContent), [framed], level);
  }
  assert.doesNotMatch(readFileSync(new URL("../src/test-pages/generate.mjs", import.meta.url), "utf8"), /"details"/, "the module builds no fold of its own");
});

// TST-1236001 · level: unit · module: MOD-test-pages
// guards: EVERY PAGE SHARES ONE LOOK AND WORKS ON A PHONE; UC-026
// given: the register holds only writer-a, the implementer of UC-002; release is chosen; the context's go records each call
// input: the route generate, drawn; then a click on the link UC-017 and a click on the link UC-002 of the text that release needs another participant
// expect: the clicks call go("use-case", { id: "UC-017" }) and go("use-case", { id: "UC-002" }), in that order; neither link carries an address of its own (no href)
test("TST-1236001 — generate: the links to UC-017 and UC-002 lead through the context's go", async () => {
  const went = [];
  const target = await show(fakeProduct(withImplementer), { register: registerOf(WRITER_A), go: (name, params) => went.push([name, params]) });
  const said = byClass(target, "p", "release-needs-another");
  assert.equal(said.length, 1, "known positive: the text that release needs another participant is drawn");
  const links = useCaseLinks(said[0]);
  assert.deepEqual(links.map((node) => node.textContent), ["UC-017", "UC-002"]);
  for (const node of links) click(node);
  assert.deepEqual(went, [["use-case", { id: "UC-017" }], ["use-case", { id: "UC-002" }]]);
  assert.deepEqual(links.filter((node) => node.hasAttribute("href")).map((node) => node.getAttribute("href")), [], "no link sets the address itself");
});
