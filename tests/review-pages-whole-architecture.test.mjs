// MOD-review-pages' route decision/all (ITM-441), as the accepted text of docs/architecture/MOD-review-pages.md states it: "`<k>/all` —
// Review all: every open or changed file of the kind in sequence, a changed one as its difference, a new one in full, and Accept all N
// shown: one commit with one record per file shown; a file that changed after it was shown, or that names a requirement or use case not
// yet accepted, is left out and named. For the architecture, this is the review page of the whole architecture: the decision that
// states the system first, then the subsystems' decisions, the module files, the further decisions with their due diligence, and the
// rounds of the job that drafted them" — and UC-022 step 8 ("the reuse candidates side by side in a due-diligence table; and the rounds —
// each finding with the correction or the answer it got, and every finding left after the last round"), step 10 and 10a ("A requirement
// or use case a file names is not accepted. The file is shown, left out of Accept all N shown, and named with what is still open").
// Run: node --test tests/review-pages-whole-architecture.test.mjs
//
// Module: MOD-review-pages
// Guards: UC-022; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; ONE CLICK PER DECISION; THE ROUNDS ARE COUNTED AND SHOWN; A REUSE DECISION RECORDS ITS DUE DILIGENCE; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT; AN APPROVAL NAMES THE EXACT TEXT
// Level: unit
//
// The document is the small DOM of tests/site-frame-dom.mjs, imported unchanged; the repository is a Host of the tests' own over one
// repository in memory with a history, keeping to MOD-repository-hosts' interface, every call recorded; the job record is written with
// MOD-job-ledger's own startRecord and appendToRecord. The real MOD-approvals, MOD-documents, MOD-job-ledger and MOD-browser-store run as
// they are. Nothing reaches the network. Where the module file leaves a reading open, the test states the one it takes, and the pull
// request names it:
//   - The route is `decision` with the id `all` (#decision/id=all), as Review all of the use cases is #use-case/id=all.
//   - A file is a <section class="review-file" data-id="…"> as on the page of the use cases. The files stand in the order: the decision
//     that states the system — the one decision that refines no other —, the subsystems' decisions — those that refine it and design
//     modules —, the module files, the further decisions — those that refine it and design none —; each group by identifier. Only the
//     files not yet accepted are shown; the button reads "Accept all N shown" with N the number of sections, class accept-all.
//   - A further decision's `## Due diligence` section is shown as <section class="due-diligence"> with its table, and not twice.
//   - The rounds are the End's rounds of the newest job of kind derive-architecture, in <section class="rounds">: a
//     <section class="round" data-number="n"> for each round, an <li class="finding"> for each of its findings with the finding's
//     artifact, line, what and rule, and an <span class="answer"> for the drafter's answer — "fixed", "justified: …", "answered: …" —;
//     a finding of the last round that has no answer carries the class `left` and the word "left".
//   - A file that rests on what is not accepted is shown with <section class="rests-on"> naming it, as one file's page does, and counts
//     among the N; the click leaves it out, and the message names it and the use case or requirement.
// Each test states its input and its expected result before it runs (given / input / expect). The counter-proofs are recorded in the
// pull request.

import "./site-frame-dom.mjs";
import { until } from "./review-pages-wait.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { startRecord, appendToRecord } from "../src/job-ledger/index.mjs";
import { finding } from "../src/text-tools/index.mjs";
import { withStoredGraph } from "./stored-graph-fake.mjs";

// Every commit the fakes of this file make is its own: MOD-trace-graph's storedGraph keeps a commit's graph for the page.
let commitsMade = 0;

// A localStorage of the file's own, for MOD-browser-store.
const kept = new Map();
globalThis.localStorage = { getItem: (k) => (kept.has(k) ? kept.get(k) : null), setItem: (k, v) => { kept.set(k, String(v)); },
  removeItem: (k) => { kept.delete(k); }, key: (i) => [...kept.keys()][i] ?? null, get length() { return kept.size; } };
const { openStore, writeSetting } = await import("../src/browser-store/index.mjs");
const pages = await import("../src/review-pages/index.mjs").catch((error) => ({ error }));
const route = pages.view?.routes.find((candidate) => candidate.name === "decision");

// ---------------------------------------------------------------- the product

const text = (...lines) => `${lines.join("\n")}\n`;
const blobOf = (body) => createHash("sha1").update(`blob ${Buffer.byteLength(body)}\0${body}`).digest("hex");
const failure = (name, message, fields = {}) => Object.assign(new Error(message), { name }, fields);
const ON_GITHUB = { server: "github", origin: "https://github.com", path: "alice/thesis-tool", web: "https://github.com/alice/thesis-tool" };
const TOKEN = { value: "github_pat_ALICEthesisTOOL0123456789abcdef", name: "Agent M · thesis-tool", expires: "2027-01-01" };

const RULE = "A LOAN HAS A DUE DATE";
const SPEC = text("# Thesis tool — Specification", "", "## Lending", "", `**${RULE}** *(Product Owner)*`,
  "Every loan states the date by which the book is returned.", "*Check:* `tests/loan.test.mjs`");
const useCase = (id, title) => text("---", `id: ${id}`, `title: ${title}`, "area: lending", "actors:", "  - Member", "realises:", `  - ${RULE}`,
  "---", `# ${id} ${title}`, "", "**Goal.** The member borrows a book.");
const UC1 = useCase("UC-001", "Borrow a book"), UC2 = useCase("UC-002", "Reserve a book");
const DIAGRAM = ["", "```mermaid", "flowchart LR", "    Desk --> Shelf", "```", ""];
const DILIGENCE = ["## Due diligence", "", "| Candidate | Licence | Latest release | Read from | Read on |", "|---|---|---|---|---|",
  "| barcode-reader — chosen | MIT | 4.2.0, 2026-09-30 | https://registry.example/barcode-reader | 2026-10-05 |",
  "| scan-lib | GPL-3.0 | 1.0.1, 2024-01-02 | https://registry.example/scan-lib | 2026-10-05 |", ""];
const decision = ({ id, title, forced = [RULE], refines = null, designs = [], sentence = "The desk and the shelf are two modules.", diligence = false }) =>
  text("---", `id: ${id}`, `title: ${title}`, ...(refines ? [`refines: ${refines}`] : []), "forced_by:", ...forced.map((name) => `  - ${name}`),
    ...(designs.length ? ["designs:", ...designs.map((name) => `  - ${name}`)] : []), "---", `# ${id} ${title}`, "", "## Context", "", "Books are lent at a desk.", "",
    "## Decision", "", sentence, ...DIAGRAM, "## Alternatives", "", "One module.", "", ...(diligence ? DILIGENCE : []), "## Consequences", "", "Two folders.");
const module_ = (id, title, sentence = "It lends a book.") => text("---", `id: ${id}`, `title: ${title}`, "folder: src/lending/", "realises:", `  - ${RULE}`,
  "follows:", "  - ARC-001", "uses:", "provides:", "  - lend", "---", `# ${id} ${title}`, "", "## Responsibility", "", sentence, "", "## Parts", "", "- `index.mjs`", "",
  "## Data", "", "Nothing.", "", "## Interfaces", "", "- `lend`", "", "## Files", "", "None.", "", "## Uses", "", "Nothing.");
const A = (n, slug) => `docs/architecture/ARC-00${n}-${slug}.md`;
const M = (slug) => `docs/architecture/MOD-${slug}.md`;
const ARC1 = decision({ id: "ARC-001", title: "Lending as a whole", forced: [RULE, "UC-001"] });
const ARC2 = decision({ id: "ARC-002", title: "The desk", refines: "ARC-001", designs: ["MOD-desk"] });
const ARC3_OLD = decision({ id: "ARC-003", title: "The shelf", refines: "ARC-001", designs: ["MOD-shelf"], sentence: "Books stand on a shelf." });
const ARC3 = decision({ id: "ARC-003", title: "The shelf", refines: "ARC-001", designs: ["MOD-shelf"], sentence: "Books stand on a shelf by their number." });
const ARC4 = decision({ id: "ARC-004", title: "A barcode library", refines: "ARC-001", diligence: true, sentence: "The desk reads barcodes with barcode-reader." });
const ARC5 = decision({ id: "ARC-005", title: "Reservations", refines: "ARC-001", designs: ["MOD-queue"], forced: ["UC-002"] });
const ARC6 = decision({ id: "ARC-006", title: "Dates are UTC", refines: "ARC-001" });
const MOD_DESK = module_("MOD-desk", "The desk");
const MOD_DESK_EDITED = module_("MOD-desk", "The desk", "It lends a book and takes it back.");
const MOD_SHELF = module_("MOD-shelf", "The shelf");
const MOD_QUEUE = module_("MOD-queue", "The queue");
const recordOf = (id, kind, path, body) => [`docs/approvals/${id}-${blobOf(body).slice(0, 12)}.md`, text(`kind: ${kind}`, `file: ${path}`, `blob: ${blobOf(body)}`)];

// The job that drafted the architecture: its End holds two rounds. Round 1: two findings, one fixed and one answered; round 2: two
// findings, one justified and one that no answer follows (left). A newer job of another kind has rounds of its own.
const F1 = finding({ artifact: "ARC-002", line: 14, kind: "warning", rule: "A MODULE IS CHECKED AGAINST ITS SUBSYSTEM",
  what: "MOD-desk offers no way to return a book", fix: "add return or say where it is" });
const F2 = finding({ artifact: "ARC-003", line: 9, kind: "warning", rule: "A SUBSYSTEM IS CHECKED AGAINST THE SYSTEM",
  what: "the shelf also keeps dates", fix: "move the dates to the desk" });
const F3 = finding({ artifact: "UC-001", line: 1, kind: "warning", rule: "EVERY USE CASE IS CHECKED AGAINST THE ARCHITECTURE",
  what: "the scenario of UC-001 names no subsystem for the barcode", fix: "name the desk" });
const F5 = finding({ artifact: "ARC-004", line: 20, kind: "warning", rule: "A REUSE DECISION RECORDS ITS DUE DILIGENCE",
  what: "scan-lib is listed without a release date", fix: "add the date or drop the alternative" });
const F6 = finding({ artifact: "UC-005", line: 3, kind: "warning", rule: "A USE CASE REALISES NAMED REQUIREMENTS", what: "realises a requirement twice", fix: "name it once" });
const ROUNDS = [
  { number: 1, findings: [F1, F2], answers: [{ finding: F1, how: "fixed", text: null },
    { finding: F2, how: "answered", text: "the shelf keeps only the number; dates are the desk's." }], changed: true },
  { number: 2, findings: [F3, F5], answers: [{ finding: F5, how: "justified", text: "the registry shows no date for it." }], changed: true },
];
const JOB = { id: "JOB-20261007-0900-a1b2", kind: "derive-architecture", worksOn: [RULE, "UC-001"], participant: "drafter-a", model: "example-model",
  route: "tab", run: null, retries: null, startedBy: "alice", start: new Date("2026-10-07T09:00:00Z"), agentM: { version: "2026.10.0", commit: "abc123def456" },
  inputs: ["SPEC.md@deadbeefcafe"], limit: 2, destinations: [{ participant: "drafter-a", place: "this machine", parts: ["the whole SPEC", "every use case"] }], params: {} };
const OTHER = { ...JOB, id: "JOB-20261008-1000-c3d4", kind: "derive-use-cases", start: new Date("2026-10-08T10:00:00Z") };
const otherStarted = startRecord(OTHER);
const OTHER_RECORD = appendToRecord(appendToRecord(otherStarted.text, { part: "taken", at: new Date("2026-10-08T10:01:00Z"), by: "tab" }),
  { part: "end", at: new Date("2026-10-08T10:20:00Z"), state: "done", results: [], draft: null, usage: null, cost: { known: false, usage: null },
    reason: null, log: null, rounds: [{ number: 1, findings: [F6], answers: [{ finding: F6, how: "fixed", text: null }], changed: true }] });
const started = startRecord(JOB);
// The record of the drafting job, whose loop stopped for the reason given, after the rounds given.
const draftingRecord = (rounds, stoppedBecause) => appendToRecord(appendToRecord(started.text, { part: "taken", at: new Date("2026-10-07T09:01:00Z"), by: "tab" }),
  { part: "end", at: new Date("2026-10-07T09:20:00Z"), state: "done", results: ["waits for a person"], draft: null, rounds, usage: null,
    cost: { known: false, usage: null }, reason: null, log: null, stoppedBecause });
const JOB_RECORD = draftingRecord(ROUNDS, "limit");

// UC-001, ARC-001, ARC-006 and MOD-shelf accepted; ARC-003 accepted at an earlier text and edited since; ARC-002, ARC-004 and MOD-desk open.
// Where `reserve` is set: ARC-005 (forced by UC-002, open) and MOD-queue are in the architecture too.
const stepsOf = ({ reserve = false, drafting = JOB_RECORD } = {}) => [
  { "README.md": "# Thesis tool\n", "SPEC.md": SPEC, "docs/use-cases/UC-001-borrow-a-book.md": UC1, "docs/use-cases/UC-002-reserve-a-book.md": UC2,
    [A(1, "lending")]: ARC1, [A(2, "desk")]: ARC2, [A(3, "shelf")]: ARC3_OLD, [A(4, "barcodes")]: ARC4, [A(6, "dates")]: ARC6,
    [M("desk")]: MOD_DESK, [M("shelf")]: MOD_SHELF, [started.path]: drafting, [otherStarted.path]: OTHER_RECORD,
    ...(reserve ? { [A(5, "reservations")]: ARC5, [M("queue")]: MOD_QUEUE } : {}) },
  Object.fromEntries([recordOf("UC-001", "use-case", "docs/use-cases/UC-001-borrow-a-book.md", UC1), recordOf("ARC-001", "architecture-decision", A(1, "lending"), ARC1),
    recordOf("ARC-006", "architecture-decision", A(6, "dates"), ARC6), recordOf("ARC-003", "architecture-decision", A(3, "shelf"), ARC3_OLD),
    recordOf("MOD-shelf", "module", M("shelf"), MOD_SHELF)]),
  { [A(3, "shelf")]: ARC3 },
];

// ---------------------------------------------------------------- the fake host

function fakeHost(options) {
  const steps = stepsOf(options);
  const calls = [], commits = new Map();
  let made = 0, head = null;
  const commitOf = (tree, parent) => {
    const sha = createHash("sha1").update(`commit ${++made} of the file's ${++commitsMade}`).digest("hex");
    commits.set(sha, { tree, parent, date: `2026-10-0${made}T10:00:00Z` });
    return sha;
  };
  for (const files of steps) head = commitOf(new Map([...(head ? commits.get(head).tree : []), ...Object.entries(files)]), head);
  const bareSnapshotAt = (sha) => {
    const { tree } = commits.get(sha);
    return { repository: ON_GITHUB, ref: sha, commit: sha, paths: [...tree.keys()].sort(), read: async (path) => (tree.has(path) ? tree.get(path) : null),
      blob: (path) => (tree.has(path) ? blobOf(tree.get(path)) : null) };
  };
  // Each snapshot serves the graph the push job stores for its commit (tests/stored-graph-fake.mjs); a page reads it and never builds one (MOD-trace-graph).
  const snapshotAt = (...args) => withStoredGraph(bareSnapshotAt(...args));
  return {
    head: () => head,
    writes: () => calls.filter((call) => call.fn === "commitFiles"),
    land(changed) { head = commitOf(new Map([...commits.get(head).tree, ...Object.entries(changed)]), head); },
    host: {
      async repositoryInfo() { return { defaultBranch: "main", visibility: "public", canWrite: true, archived: false, description: "" }; },
      async readFileAt(path, shas) {
        return new Map(shas.map((sha) => [sha, commits.get(sha)?.tree.get(path) ?? null]));
      },
      async readSnapshot(ref) {
        if (ref === "main") return { ...snapshotAt(head), ref };
        if (commits.has(ref)) return snapshotAt(ref);
        throw failure("NotFound", `${ref} was not found`, { what: ref });
      },
      async readHistory(path, { ref = "main", limit } = {}) {
        const found = [];
        for (let sha = ref === "main" ? head : ref; sha; sha = commits.get(sha).parent) {
          const here = commits.get(sha), before = here.parent ? commits.get(here.parent).tree.get(path) : undefined;
          if (here.tree.get(path) !== before) found.push({ commit: sha, parents: here.parent ? [here.parent] : [], date: here.date, message: "", author: { account: null, name: "x" }, changes: [] });
        }
        return limit ? found.slice(0, limit) : found;
      },
      async commitFiles(change) {
        calls.push({ fn: "commitFiles", change: structuredClone(change) });
        if (change.branch !== "main" || change.expectedHead !== head) throw failure("Moved", "the branch moved", { head });
        head = commitOf(new Map([...commits.get(head).tree, ...change.files.map((f) => [f.path, f.text])]), head);
        return { commit: head, url: `${ON_GITHUB.web}/commit/${head}` };
      },
    },
  };
}

// ---------------------------------------------------------------- the page

async function show(fake) {
  assert.ok(route, `the route decision: ${pages.error?.message}`);
  const store = openStore("alice/agent-m");
  writeSetting(store, "github-token:alice/thesis-tool", TOKEN);
  const target = document.createElement("div");
  document.body.append(target);
  await route.render(target, { page: "review", instance: { repository: "alice/agent-m", host: fake.host }, store, go() {},
    product: { address: ON_GITHUB.web, kind: "github", host: fake.host } }, { id: "all" });
  return target;
}
function find(root, match) {
  const found = [];
  (function walk(node) { for (const kid of node.childNodes) { if (kid.nodeType === 1) { if (match(kid)) found.push(kid); walk(kid); } } })(root);
  return found;
}
const byClass = (root, name, className) => find(root, (node) => node.localName === name && node.className.split(" ").includes(className));
// A person's click: a browser marks it trusted (`isTrusted`); node marks every Event untrusted, as a script's.
const click = (node) => node.dispatchEvent(Object.defineProperty(new Event("click"), "isTrusted", { value: true }));
const filesOf = (target) => byClass(target, "section", "review-file").map((section) => section.getAttribute("data-id"));
const fileOf = (target, id) => byClass(target, "section", "review-file").find((section) => section.getAttribute("data-id") === id);

// ---------------------------------------------------------------- the order

// TST-472688 · level: unit · module: MOD-review-pages
// guards: UC-022; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; A CHANGED FILE IS SHOWN AGAINST ITS LAST ACCEPTED TEXT
// given: an architecture of seven files — the decision that states the system ARC-001 (accepted), the subsystems' decisions ARC-002 (open) and ARC-003 (changed since acceptance), the module files MOD-desk (open) and MOD-shelf (accepted), and the further decisions ARC-004 (open) and ARC-006 (accepted) —, and a token
// input: the route decision rendered with the id all
// expect: the files not yet accepted in the order ARC-002, ARC-003, MOD-desk, ARC-004 — no accepted file, and the system's decision accepted so not among them —; ARC-003 as the difference to its last accepted text, the others in full; the button "Accept all 4 shown"; nothing written
test("MOD-review-pages decision/all — the files of the whole architecture in their order, a changed one as its difference and a new one in full", async () => {
  const fake = fakeHost();
  const target = await show(fake);
  assert.deepEqual(filesOf(target), ["ARC-002", "ARC-003", "MOD-desk", "ARC-004"]);
  const changed = byClass(fileOf(target, "ARC-003"), "section", "accepted-diff")[0];
  assert.ok(changed, "the changed file has its difference");
  assert.match(changed.textContent, /- Books stand on a shelf\./);
  assert.match(changed.textContent, /\+ Books stand on a shelf by their number\./);
  assert.equal(byClass(fileOf(target, "ARC-002"), "section", "accepted-diff").length, 0, "a new file has none");
  assert.match(fileOf(target, "ARC-002").textContent, /The desk and the shelf are two modules\./, "a new file in full");
  assert.match(fileOf(target, "MOD-desk").textContent, /It lends a book\./, "a module file in full");
  assert.equal(byClass(target, "button", "accept-all")[0].textContent, "Accept all 4 shown");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// TST-472689 · level: unit · module: MOD-review-pages
// guards: UC-022; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS
// given: the architecture above, in which another writer has put the decision that states the system as ARC-007 — it refines no other —, and ARC-001, changed since acceptance, now refines it and designs no module
// input: the route decision rendered with the id all
// expect: the decision that states the system, ARC-007, first — though its identifier is the highest —, then the subsystems' decisions by identifier, the module files, the further decisions by identifier
test("MOD-review-pages decision/all — the decision that states the system first, then the subsystems, the modules, the further decisions", async () => {
  const fake = fakeHost();
  fake.land({ [A(7, "system")]: decision({ id: "ARC-007", title: "The whole lending system", forced: [RULE, "UC-001"], sentence: "Lending is a desk and a shelf." }),
    [A(1, "lending")]: decision({ id: "ARC-001", title: "Lending as a whole", refines: "ARC-007", forced: [RULE, "UC-001"], sentence: "Lending is a desk and a shelf." }) });
  const target = await show(fake);
  assert.deepEqual(filesOf(target), ["ARC-007", "ARC-002", "ARC-003", "MOD-desk", "ARC-001", "ARC-004"]);
});

// ---------------------------------------------------------------- due diligence and rounds

// TST-472690 · level: unit · module: MOD-review-pages
// guards: A REUSE DECISION RECORDS ITS DUE DILIGENCE; UC-022
// given: the further decision ARC-004, which adopts a library and holds a due-diligence table of two candidates
// input: the route decision rendered with the id all
// expect: in the section of ARC-004 a due-diligence section whose table holds both candidates with their licence, the address they were read from and the date; the table not shown a second time in the decision's text; the other files have none
test("MOD-review-pages decision/all — a further decision with its due-diligence table", async () => {
  const target = await show(fakeHost());
  const sections = byClass(fileOf(target, "ARC-004"), "section", "due-diligence");
  assert.equal(sections.length, 1, "one due-diligence section");
  const table = find(sections[0], (node) => node.localName === "table");
  assert.equal(table.length, 1, "its table");
  for (const cell of ["barcode-reader — chosen", "MIT", "scan-lib", "GPL-3.0", "https://registry.example/scan-lib", "2026-10-05"]) {
    assert.match(table[0].textContent, new RegExp(cell.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), cell);
  }
  assert.equal(find(fileOf(target, "ARC-004"), (node) => node.localName === "table").length, 1, "the table once");
  assert.equal(byClass(target, "section", "due-diligence").length, 1, "only the decision that holds one");
});

// TST-472691 · level: unit · module: MOD-review-pages
// guards: THE ROUNDS ARE COUNTED AND SHOWN; UC-022
// given: the record of the job that drafted the architecture: two rounds — the first with two findings, one fixed and one answered with its reason, the second with two findings, one justified and one that no answer follows, the loop having stopped at its limit —, and the record of a newer job of another kind, which has a round of its own
// input: the route decision rendered with the id all
// expect: a rounds section of the drafting job's two rounds and not of the other job's; in the first the finding on ARC-002 with "fixed" and the finding on ARC-003 with "answered:" and the reason, neither left; in the second both findings marked left, the one on ARC-004 still with its "justified:" and its reason — the loop stopped at its limit, and what is left is the last round's findings, as the record's writer counts it —; each finding with its file, line, what it says and the rule it names; the count left, 2 findings
test("MOD-review-pages decision/all — the rounds of the drafting job, each finding with its correction or answer and the findings left", async () => {
  const target = await show(fakeHost());
  const rounds = byClass(target, "section", "rounds")[0];
  assert.ok(rounds, "a rounds section");
  const round = byClass(rounds, "section", "round");
  assert.deepEqual(round.map((each) => each.getAttribute("data-number")), ["1", "2"]);
  const first = byClass(round[0], "li", "finding");
  assert.equal(first.length, 2);
  assert.match(first[0].textContent, /ARC-002:14/);
  assert.match(first[0].textContent, /MOD-desk offers no way to return a book/);
  assert.match(first[0].textContent, /A MODULE IS CHECKED AGAINST ITS SUBSYSTEM/);
  assert.equal(byClass(first[0], "span", "answer")[0].textContent, "fixed");
  assert.match(byClass(first[1], "span", "answer")[0].textContent, /^answered: the shelf keeps only the number; dates are the desk's\.$/);
  const second = byClass(round[1], "li", "finding");
  assert.equal(second.length, 2);
  assert.match(second[0].textContent, /UC-001:1/);
  assert.ok(second[0].className.split(" ").includes("left"), "the last round's unanswered finding is left");
  assert.match(second[0].textContent, /left/);
  assert.match(second[1].textContent, /ARC-004:20/);
  assert.match(byClass(second[1], "span", "answer")[0].textContent, /^justified: the registry shows no date for it\.$/);
  assert.ok(second[1].className.split(" ").includes("left"), "a finding the drafter justified is left too, at the limit");
  assert.equal(byClass(rounds, "li", "left").length, 2, "the findings of the last round, and no other");
  assert.equal(byClass(round[0], "li", "left").length, 0, "none of the first round");
  assert.ok(!rounds.textContent.includes("realises a requirement twice"), "not the rounds of another job");
  assert.match(byClass(rounds, "p", "left-count")[0].textContent, /^Left: 2 findings$/);
});

// ---------------------------------------------------------------- Accept all N shown

// TST-472692 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT; ONE CLICK PER DECISION
// given: the page of the whole architecture with its four files not yet accepted, and a token
// input: a click on "Accept all 4 shown"
// expect: one commit on main, on the head that was read, holding one record for each file shown — ARC-002, ARC-003, MOD-desk, ARC-004 —, each naming the blob of the text shown, and nothing else; the page then shows no file and says the commit
test("MOD-review-pages decision/all — Accept all N shown writes one record for each file shown", async () => {
  const fake = fakeHost();
  const read = fake.head();
  const target = await show(fake);
  click(byClass(target, "button", "accept-all")[0]);
  await until(target, () => fake.writes().length === 1, "the commit");
  const [{ change }] = fake.writes();
  assert.equal(change.branch, "main");
  assert.equal(change.expectedHead, read);
  assert.deepEqual(change.files.map((file) => file.path), [
    recordOf("ARC-002", "architecture-decision", A(2, "desk"), ARC2)[0], recordOf("ARC-003", "architecture-decision", A(3, "shelf"), ARC3)[0],
    recordOf("MOD-desk", "module", M("desk"), MOD_DESK)[0], recordOf("ARC-004", "architecture-decision", A(4, "barcodes"), ARC4)[0]]);
  assert.deepEqual(change.files.map((file) => file.text), [
    recordOf("ARC-002", "architecture-decision", A(2, "desk"), ARC2)[1], recordOf("ARC-003", "architecture-decision", A(3, "shelf"), ARC3)[1],
    recordOf("MOD-desk", "module", M("desk"), MOD_DESK)[1], recordOf("ARC-004", "architecture-decision", A(4, "barcodes"), ARC4)[1]]);
  await until(target, () => byClass(target, "p", "nothing").length === 1, "the page drawn again");
  assert.deepEqual(filesOf(target), []);
});

// TST-472693 · level: unit · module: MOD-review-pages
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; AN APPROVAL NAMES THE EXACT TEXT
// given: the page of the whole architecture shown; then another writer's commit changed MOD-desk on main
// input: a click on "Accept all 4 shown"
// expect: one commit holding the records of ARC-002, ARC-003 and ARC-004 — not MOD-desk's —; MOD-desk named as left out, changed since shown, in the message
test("MOD-review-pages decision/all — a file changed after it was shown is left out and named", async () => {
  const fake = fakeHost();
  const target = await show(fake);
  fake.land({ [M("desk")]: MOD_DESK_EDITED });
  click(byClass(target, "button", "accept-all")[0]);
  await until(target, () => fake.writes().length === 1, "the commit");
  assert.deepEqual(fake.writes()[0].change.files.map((file) => file.path), [
    recordOf("ARC-002", "architecture-decision", A(2, "desk"), ARC2)[0], recordOf("ARC-003", "architecture-decision", A(3, "shelf"), ARC3)[0],
    recordOf("ARC-004", "architecture-decision", A(4, "barcodes"), ARC4)[0]]);
  await until(target, () => byClass(target, "p", "result").length === 1, "the message");
  assert.match(byClass(target, "p", "result")[0].textContent, /MOD-desk was left out: changed since shown/);
});

// TST-472694 · level: unit · module: MOD-review-pages
// guards: ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-022
// given: the architecture with a subsystem's decision ARC-005 forced by the open use case UC-002 and its module file MOD-queue
// input: the route decision rendered with the id all; a click on "Accept all 6 shown"
// expect: ARC-005 shown with a section that names UC-002 as open; one commit holding the records of every file shown but ARC-005; the message names ARC-005 as left out because it rests on what is not accepted, and UC-002
test("MOD-review-pages decision/all — a decision that names an open use case is left out and named", async () => {
  const fake = fakeHost({ reserve: true });
  const target = await show(fake);
  assert.deepEqual(filesOf(target), ["ARC-002", "ARC-003", "ARC-005", "MOD-desk", "MOD-queue", "ARC-004"]);
  assert.deepEqual(byClass(fileOf(target, "ARC-005"), "li", "open-name").map((item) => item.textContent), ["UC-002"]);
  assert.equal(byClass(fileOf(target, "ARC-002"), "section", "rests-on").length, 0, "a decision that rests on accepted artifacts has none");
  assert.equal(byClass(target, "button", "accept-all")[0].textContent, "Accept all 6 shown");
  click(byClass(target, "button", "accept-all")[0]);
  await until(target, () => fake.writes().length === 1, "the commit");
  const written = fake.writes()[0].change.files.map((file) => file.path);
  assert.equal(written.length, 5);
  assert.ok(!written.some((path) => path.includes("ARC-005")), "no record for ARC-005");
  await until(target, () => byClass(target, "p", "result").length === 1, "the message");
  assert.match(byClass(target, "p", "result")[0].textContent, /ARC-005 was left out: rests on what is not accepted \(UC-002\)/);
});

const ANSWERED = [
  { number: 1, findings: [F1], answers: [{ finding: F1, how: "fixed", text: null }], changed: true },
  { number: 2, findings: [F5], answers: [{ finding: F5, how: "justified", text: "the registry shows no date for it." }], changed: true },
];
for (const [stopped, left] of [["limit", 1], ["passed", 0], ["not checked", 0], ["unchanged", 1]]) {
  // TST-478028 · level: unit · module: MOD-review-pages
  // guards: THE ROUNDS ARE COUNTED AND SHOWN; UC-022
  // given: four drafting jobs, each with two rounds in which the drafter answered every finding — the loop having (1) stopped at its limit, (2) passed, (3) checked nothing, (4) stopped because a round left the findings unchanged
  // input: the route decision rendered with the id all for each
  // expect: as the record's writer counts what is left, which its `Left:` line states: the findings of the last round, answered or not, for (1) and (4) — the page says "Left: 1 finding" and marks that finding left, with its answer —; none for (2) and (3), where the last round's justified finding is not left and the page says "Left: none"
  test(`MOD-review-pages decision/all — rounds that the loop left at "${stopped}": ${left ? "the last round's answered finding is left" : "nothing is left"}`, async () => {
    const target = await show(fakeHost({ drafting: draftingRecord(ANSWERED, stopped) }));
    const rounds = byClass(target, "section", "rounds")[0];
    assert.ok(rounds, "a rounds section");
    assert.equal(byClass(rounds, "li", "left").length, left);
    assert.equal(byClass(rounds, "li", "left").length === 0 ? "" : byClass(byClass(rounds, "li", "left")[0], "span", "answer")[0].textContent,
      left ? "justified: the registry shows no date for it." : "");
    assert.equal(byClass(rounds, "p", "left-count")[0].textContent, left ? "Left: 1 finding" : "Left: none");
  });
}
