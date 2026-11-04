// System coverage for UC-005 Derive requirements from a source, walked through the draft page of the SPEC changes: the flow map (TST-579201) that names, for every step of the main flow, every alternative flow and the postcondition, the
// executable tests that walk it, and the cases the older tests of the page leave out — the linked version and the part (step 1), a changed file (1a), what the run panel names before Run (steps 2 and 3), a context that cannot hold
// the input (2a), no Run (3a), what Run sends and what comes back (steps 4 and 5), a source the product does not link and a candidate that constrains the process (5a, 5b), the deduplication pass and the findings that go back to the
// participant (step 6), a flagged candidate split (6a), the review panel (steps 7, 7a, 7b), Write proposals (step 8), the acceptance as in UC-006 (step 9) and the postcondition. The page is the route `spec-entry/draft` of
// MOD-review-pages over the real recipes and checks of MOD-job-runner, the real writer `queue-entries` of MOD-spec-changes and the real MOD-source-register, behind the fixture hosts and the fixture model endpoint of
// tests/uc-005-harness.mjs; no request leaves the process.
// Run: node --test tests/system-uc-005-derive-requirements.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-spec-changes
// Module: MOD-job-runner
// Guards: UC-005
// Level: system
//
// Authored by developer-sonnet-j (ITM-579). The `Agent-M-Participant` trailers of the code UC-005's flow runs name developer-opus-e, developer-opus-f, developer-sonnet-a, -b, -c, -d, -e, -f and -k, developer-terra-a, developer-opus-a and
// scrum-master-opus-c; most commits of it (the ITM-3xx to ITM-6xx of UC-005) carry no trailer. developer-sonnet-j built, among the code the flow runs, ITM-659 (storedToken in src/review-pages/common.mjs), ITM-1315 (Accept disabled on a
// file that rests on what is not accepted) and ITM-1274 (entryImpact and entryView's read of an entry's files); these are walked only by the acceptance of step 9, which UC-005 hands to UC-006, and no release case here walks them. Where the page and
// UC-005 disagree the case follows UC-005 and is marked `todo` with the word FINDING. Each case states its input and its expected values in its own text; none reads an expected result from the SPEC, a use case or an architecture file, but the
// flow map, which holds the expected passages itself and checks that UC-005 still says them. A person's click is the page's own listener called with a trusted event; a script's click is made by `scripted()`.
// Readings the texts leave open, which the cases state:
//   - "reads exactly the linked version, and checks its hash" (step 1) is read as: the excerpt sent is the text of the files of the version the product's links file names, though the register holds a newer one; a file whose bytes differ from the
//     hash the register records is not sent (1a).
//   - "the participant's context" (2a) is read as the context the participant's register entry declares, in tokens as the run panel counts them.
//   - "says how many requirements there are and how much fits" (2a) is read as two statements: the panel names the number of existing requirements, which the cases check, and the number of them that fit, which is the FINDING case.
//   - "moves a candidate to another class" (7) is read as the class and `of` fields of the candidate's item on the panel, as the pages of tests/review-pages-draft-requirements.test.mjs use them.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { HANDBOOK, HANDBOOK_FILE, APPENDIX_TEXT, INSTANCE_SPEC, LOAN, LOAN_RULE, MAIN_FILE, MAIN_TEXT, NEWER, NEWER_FILES, NEWER_TEXT, POLICY_FILES, RENEW, SHELF, SHELF_RULE, SOURCE, VERSION,
  byClass, candidate, classOf, click, DRAFTER, find, findingLines, groupsOf, itemOf, participantRow, registerOf, restoreFetch, scripted, setClass, sourceFiles, until, world, write, writtenFiles } from "./uc-005-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-005-derive-requirements-from-a-source.md";
const SELF = "tests/system-uc-005-derive-requirements.test.mjs";
const DRAFT = "tests/review-pages-draft-requirements.test.mjs", BESIDE = "tests/review-pages-derivation-candidates-beside-current.test.mjs", SPLIT = "tests/review-pages-derivation-split-candidate.test.mjs";
const CLASSES = "tests/job-runner-candidate-classes.test.mjs", PANEL = "tests/site-frame-run-panel.test.mjs", EXCERPT = "tests/source-register-part.test.mjs", ENTRIES = "tests/spec-changes-queue-entries.test.mjs";
const UC6 = "tests/system-uc-006-approve-spec-change.test.mjs";
test.afterEach(() => restoreFetch());

const textOf = (node) => node.textContent;
const buttonNamed = (root, label) => find(root, (node) => node.localName === "button" && node.textContent === label)[0];
const queueFolders = (w) => [...new Set(Object.keys(writtenFiles(w)).map((path) => path.split("/")[2]))];
const specOf = (w) => w.product.files()["SPEC.md"];

// ---------------------------------------------------------------- the flow map

// The passages of UC-005 the tests walk, each with the tests that walk it: this file's system cases, and the older tests of the page, which declare the level unit or component.
const FLOW_EVIDENCE = {
  "main-1-select": { uc: "The author selects one of the product's linked sources and, optionally, the part to work on.", evidence: [[SELF, "TST-579202"], [DRAFT, "TST-361001"], [EXCERPT, "TST-472915"]] },
  "main-1-hash": { uc: "reads exactly the linked version, and checks its hash.", evidence: [[SELF, "TST-579202"], [SELF, "TST-579203"]] },
  "main-2-collects": { uc: "Agent M collects **every existing requirement of the product**", evidence: [[SELF, "TST-579205"]] },
  "main-3-panel": { uc: "The run panel shows the destination, what exactly is sent", evidence: [[SELF, "TST-579205"], [PANEL, "TST-472846"], [DRAFT, "TST-361002"]] },
  "main-3-run": { uc: "the author presses **Run**", evidence: [[SELF, "TST-579208"], [PANEL, "TST-472853"]] },
  "main-4-sends": { uc: "Agent M sends them with the requirement prompt from the repository's single definition.", evidence: [[SELF, "TST-579209"]] },
  "main-5-candidates": { uc: "The participant returns candidates, each with name, source passage, rule, check,", evidence: [[SELF, "TST-579209"]] },
  "main-6-dedup": { uc: "**The deduplication pass**, before anything is written:", evidence: [[SELF, "TST-579211"], [SELF, "TST-579213"]] },
  "6-1-merge": { uc: "candidates of this run that state the same rule are merged into one, naming every passage;", evidence: [[SELF, "TST-579212"], [CLASSES, "TST-472307"]] },
  "6-2-exact": { uc: "a candidate whose name or normalised rule equals an existing requirement's is classified as a", evidence: [[SELF, "TST-579211"], [CLASSES, "TST-472305"]] },
  "6-3-findings": { uc: "Agent M sends back to the participant, as compiler-like findings, every candidate without one of", evidence: [[SELF, "TST-579213"], [SELF, "TST-579214"]] },
  "main-7-review": { uc: "The review panel shows the candidates grouped by class, each beside the existing requirement it", evidence: [[SELF, "TST-579209"], [SELF, "TST-579215"], [BESIDE, "TST-577001"]] },
  "main-8-write": { uc: "The author presses **Write proposals** — one click.", evidence: [[SELF, "TST-579216"], [DRAFT, "TST-361003"]] },
  "main-9-accept": { uc: "The author reviews and accepts entries as in UC-006.", evidence: [[SELF, "TST-579217"], [UC6, "TST-371001"]] },
  "1a-hash": { uc: "**1a. The file's hash differs from the one recorded for the linked version.**", evidence: [[SELF, "TST-579203"], [SELF, "TST-579204"], [DRAFT, "TST-361005"]] },
  "2a-fit": { uc: "**2a. The existing requirements and the excerpt do not fit into the participant's context.**", evidence: [[SELF, "TST-579206"], [SELF, "TST-579207"], [DRAFT, "TST-361002"]] },
  "3a-no-run": { uc: "**3a. The author does not press Run.**", evidence: [[SELF, "TST-579208"]] },
  "5a-unlinked": { uc: "**5a. A candidate points to a rule from a source the product does not link.**", evidence: [[SELF, "TST-579210"], [DRAFT, "TST-361003"]] },
  "5b-process": { uc: "**5b. A candidate constrains the process.**", evidence: [[SELF, "TST-579210"], [BESIDE, "TST-577002"], [ENTRIES, "TST-666001"]] },
  "6a-split": { uc: "**6a. The author splits a flagged candidate.**", evidence: [[SELF, "TST-579214"], [SPLIT, "TST-578005"]] },
  "7a-normative": { uc: "**7a. A conflict involves a normative source.**", evidence: [[SELF, "TST-579215"], [DRAFT, "TST-361003"]] },
  "7b-all-duplicates": { uc: "**7b. Every candidate is a duplicate.**", evidence: [[SELF, "TST-579215"], [BESIDE, "TST-577003"]] },
  "postcondition-queue": { uc: "The product repository holds a queue of proposals; the SPEC itself is unchanged until entries are", evidence: [[SELF, "TST-579216"], [SELF, "TST-579218"]] },
  "postcondition-no-duplicate": { uc: "No proposal duplicates an existing requirement: what the source adds is new, what it alters is a", evidence: [[SELF, "TST-579218"]] },
  "postcondition-names": { uc: "Each proposal names its source passage, the source version and the participant that produced it.", evidence: [[SELF, "TST-579218"], [SELF, "TST-579219"]] },
};

// TST-579201 · level: system · module: system
// guards: UC-005
// given: UC-005 as committed text, the executable tests named in FLOW_EVIDENCE
// input: compare every passage of the main flow, of the alternative flows and of the postcondition with its executable evidence
// expect: every named passage stands in UC-005; every evidence file exists and declares its TST id; this file's cases declare the level system; every alternative flow UC-005 names is among the passages; known positive: UC-005 names exactly the eight alternative flows 1a, 2a, 3a, 5a, 5b, 6a, 7a and 7b
test("TST-579201: UC-005 every passage of the main flow and of each alternative flow has an executable test", () => {
  const text = read(UC);
  for (const [name, { uc }] of Object.entries(FLOW_EVIDENCE)) assert.ok(text.includes(uc), `${name}: UC-005 says "${uc}"`);
  for (const [name, { evidence }] of Object.entries(FLOW_EVIDENCE)) {
    assert.ok(evidence.length > 0, `${name}: a test is named`);
    for (const [file, id] of evidence) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${name}: ${id} is declared in ${file}`);
      if (file === SELF) assert.equal(declared.level, "system", `${id} is a system test`);
    }
  }
  const flows = [...text.matchAll(/^- \*\*(\d+[a-z])\. /gm)].map((match) => match[1]);
  assert.deepEqual([...flows].sort(), ["1a", "2a", "3a", "5a", "5b", "6a", "7a", "7b"], "known positive: UC-005 names these alternative flows");
  for (const flow of flows) assert.ok(Object.keys(FLOW_EVIDENCE).some((name) => name.startsWith(flow)), `${flow} is among the passages`);
});

// ---------------------------------------------------------------- step 1: the linked source and its part

const sourceItem = (page, id) => byClass(page, "li", "source").find((item) => item.getAttribute("data-source") === id);

// TST-579202 · level: system · module: system
// guards: UC-005
// given: a product that links SRC-policy at version 2026-10-01 (the part Chapter 1) and SRC-handbook; the register also holds a newer version 2026-11-01 of SRC-policy, which the product does not link; the person's token is stored
// input: open the draft page; read the sources it offers; choose SRC-policy and only its file main.md and show the run panel, press Run; then, on a new page, choose SRC-handbook and press Run
// expect: step 1: the page offers both linked sources, SRC-policy with its part Chapter 1 and its two files, SRC-handbook with its file; drawing it sends and writes nothing; the first request carries the text of main.md of version 2026-10-01 and neither the text of appendix.md nor the text of the newer version; the second carries the text of handbook.md and nothing of main.md
test("TST-579202: UC-005 1 the author selects a linked source and a part, and exactly the linked version is read", async () => {
  const w = await world({ instance: { entries: sourceFiles({ policyVersions: [{ version: VERSION, files: POLICY_FILES }, { version: NEWER, files: NEWER_FILES }] }) }, answers: { candidates: [] } });
  const page = await w.draw();
  assert.deepEqual(byClass(page, "li", "source").map((item) => item.getAttribute("data-source")), [SOURCE, HANDBOOK]);
  const policy = sourceItem(page, SOURCE), handbook = sourceItem(page, HANDBOOK);
  assert.match(textOf(policy), /part: Chapter 1/);
  assert.deepEqual(byClass(policy, "input", "source-file").map((box) => box.value), POLICY_FILES.map((file) => file.name));
  assert.deepEqual(byClass(handbook, "input", "source-file").map((box) => box.value), [HANDBOOK_FILE]);
  assert.equal(w.requests.length, 0);
  assert.deepEqual(w.product.writes(), []);

  const first = await w.prepare({ page, source: SOURCE, files: [MAIN_FILE] });
  assert.match(textOf(first.panel), /SRC-policy 2026-10-01, main\.md, Chapter 1/);
  await w.run(first);
  const sent = w.requests[0].prompt;
  assert.ok(sent.includes("Chapter 2: members can renew once."), "the text of main.md of the linked version");
  assert.ok(!sent.includes(APPENDIX_TEXT.trim().split("\n").at(-1)), "appendix.md is not sent");
  assert.ok(!sent.includes(NEWER_TEXT.trim().split("\n").at(-1)), "the newer version is not read");

  const second = await w.prepare({ source: HANDBOOK });
  await w.run(second);
  assert.ok(w.requests[1].prompt.includes("Chapter 2: a book is shelved."), "the text of handbook.md");
  assert.ok(!w.requests[1].prompt.includes("Chapter 2: members can renew once."), "nothing of main.md");
});

// ---------------------------------------------------------------- 1a: the file's hash differs

// TST-579203 · level: system · module: system
// guards: UC-005
// given: a product that links SRC-policy 2026-10-01 whose file main.md in the register's content now differs from the SHA-256 the register records for it; the person's token is stored
// input: open the draft page, choose main.md, a participant, and show the run panel
// expect: 1a: the page names the file main.md and the SHA-256 that differs, offers no Run, sends nothing to the endpoint and writes nothing to the product
test("TST-579203: UC-005 1a a file whose hash differs from the recorded one sends nothing and is named", async () => {
  const entries = { ...sourceFiles(), [`docs/sources/${SOURCE}/${VERSION}/${MAIN_FILE}`]: `${MAIN_TEXT}Chapter 3: changed afterwards.\n` };
  const w = await world({ instance: { entries }, answers: { candidates: [] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  assert.ok(prepared.panel === null, "no run panel");
  assert.match(prepared.problem, /main\.md/);
  assert.match(prepared.problem, /SHA-256/);
  assert.equal(find(prepared.page, (node) => node.localName === "button" && node.textContent === "Run").length, 0, "no Run");
  assert.equal(w.requests.length, 0);
  assert.deepEqual(w.product.writes(), []);
});

// TST-579204 · level: system · module: system
// guards: UC-005
// given: the product, the register and the changed file of TST-579203
// input: show the run panel
// expect: 1a: the page says that the content changed and that a new version must be registered (UC-016), in these words or others that name both: the word changed, and a new version to register
test("TST-579204: UC-005 1a the page says that the content changed and that a new version must be registered", async () => {
  const entries = { ...sourceFiles(), [`docs/sources/${SOURCE}/${VERSION}/${MAIN_FILE}`]: `${MAIN_TEXT}Chapter 3: changed afterwards.\n` };
  const w = await world({ instance: { entries }, answers: { candidates: [] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  assert.match(prepared.problem, /\bchanged\b/);
  assert.match(prepared.problem, /new version/);
  assert.match(prepared.problem, /\bregister/);
});

// ---------------------------------------------------------------- steps 2 and 3: the existing requirements, the run panel

// TST-579205 · level: system · module: system
// guards: UC-005; DERIVATION SEES THE EXISTING REQUIREMENTS; THE PAGE NAMES WHERE IT SENDS
// given: a product whose SPEC holds two requirements and whose open change queue proposes a third (A MEMBER CAN RENEW ONCE); the participant drafter-a processes data on this machine; the person's token is stored
// input: choose SRC-policy, main.md and drafter-a and show the run panel
// expect: steps 2 and 3: the panel names the destination drafter-a, its model model-a and its place this machine, the three parts it receives (the source excerpt of main.md, SPEC.md with its open queues, the chapter 8 file), the sentence "3 existing requirements included.", the limit of correction rounds, and offers Run; nothing is sent to the endpoint and nothing is written to the product, not even a job record
test("TST-579205: UC-005 2 3 the run panel names the destination, the parts and the number of existing requirements before anything is sent", async () => {
  const w = await world({ answers: { candidates: [] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  const panel = textOf(prepared.panel);
  assert.match(panel, /drafter-a — drafter/);
  assert.match(panel, /model: model-a; processes data at: this machine/);
  assert.match(panel, /SRC-policy 2026-10-01, main\.md, Chapter 1 — \d+ tokens, carries SRC-policy/);
  assert.match(panel, /SPEC\.md with its open queues — \d+ tokens/);
  assert.match(panel, /08_requirements-engineering\.md — SRC-vibe-coding 2026-10-05/);
  assert.match(panel, /Correction rounds: at most 5/);
  assert.deepEqual(byClass(prepared.page, "p", "requirements-included").map(textOf), ["3 existing requirements included."]);
  assert.ok(buttonNamed(prepared.page, "Run"), "Run is offered");
  assert.equal(w.requests.length, 0);
  assert.deepEqual(w.product.writes(), []);
  assert.deepEqual(w.records(), []);
});

// TST-579206 · level: system · module: system
// guards: UC-005; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
// given: the register lists drafter-a (a context of 200000 tokens), small-d (a context of 20 tokens) and big-d (a context of 400000 tokens that processes data at NHR@FAU, Erlangen); the person's token is stored
// input: show the run panel with small-d; then, on the same page, with big-d, and press Run
// expect: 2a: with small-d the panel names small-d, the tokens it would receive and the context it holds, offers no Run and nothing is sent or written; the same page still offers big-d, whose panel names its place NHR@FAU, Erlangen and offers Run; known positive: with big-d the one request reaches the endpoint
test("TST-579206: UC-005 2a a participant whose context cannot hold the input is named, nothing is sent, and another participant is offered", async () => {
  const register = registerOf(DRAFTER, participantRow("small-d", { context: 20 }), participantRow("big-d", { context: 400000, place: "NHR@FAU, Erlangen" }));
  const w = await world({ instance: { register }, answers: { candidates: [] } });
  const small = await w.prepare({ files: [MAIN_FILE], participant: "small-d" });
  const refusal = byClass(small.page, "p", "not-fitting").map(textOf);
  assert.equal(refusal.length, 1);
  assert.match(refusal[0], /^small-d cannot hold what it would receive: \d+ tokens, its context holds 20$/);
  assert.ok(buttonNamed(small.page, "Run") === undefined, "no Run");
  assert.equal(w.requests.length, 0);
  assert.deepEqual(w.product.writes(), []);
  assert.deepEqual(byClass(small.page, "li", "participant").map((item) => item.getAttribute("data-name")).sort(), ["big-d", "drafter-a", "small-d"]);
  const big = await w.prepare({ page: small.page, files: [MAIN_FILE], participant: "big-d" });
  assert.match(textOf(big.panel), /big-d — drafter/);
  assert.match(textOf(big.panel), /processes data at: NHR@FAU, Erlangen/);
  await w.run(big);
  assert.equal(w.requests.length, 1, "known positive: big-d is asked once");
});

// TST-579207 · level: system · module: system
// guards: UC-005; NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY
// given: the product and the participants of TST-579206
// input: show the run panel with small-d
// expect: 2a: the refusal says how many requirements there are (3) and how many of them fit (0 in a context of 20 tokens), in numbers of requirements and not only of tokens
test("TST-579207: UC-005 2a the refusal says how many requirements there are and how many of them fit", { todo: "FINDING: src/site-frame/run-panel.mjs:44 words the refusal as `small-d cannot hold what it would receive: 26927 tokens, its context holds 20` and the panel adds `3 existing requirements included.`; MOD-site-frame's runPanel (docs/architecture/MOD-site-frame.md, Interfaces: runPanel) is to say how many requirements and use cases the destination holds and how many of them fit, from the `holds` and `fitting` of the `notFitting` entry, and the panel does not read them. The same finding as UC019-S10 (TST-377011); the module is MOD-site-frame" }, async () => {
  const register = registerOf(DRAFTER, participantRow("small-d", { context: 20 }));
  const w = await world({ instance: { register }, answers: { candidates: [] } });
  const small = await w.prepare({ files: [MAIN_FILE], participant: "small-d" });
  const refusal = byClass(small.page, "p", "not-fitting").map(textOf).join(" ");
  assert.match(refusal, /requirements/);
  assert.match(refusal, /\b3\b/);
  assert.match(refusal, /\b0\b/);
});

// ---------------------------------------------------------------- 3a: Run is not pressed

// TST-579208 · level: system · module: system
// guards: UC-005; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the run panel of TST-579205 is shown
// input: wait without pressing Run; a script presses Run; then the person presses Run once
// expect: 3a and step 3: while Run is not pressed nothing is sent and nothing is written; the script's click sends nothing and writes nothing; the person's one click sends exactly one request to the endpoint
test("TST-579208: UC-005 3a without the person's click on Run nothing is sent, and one click sends once", async () => {
  const w = await world({ answers: { candidates: [] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(w.requests.length, 0);
  assert.deepEqual(w.product.writes(), []);
  buttonNamed(prepared.page, "Run").dispatchEvent(scripted("click"));
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(w.requests.length, 0, "a script's click on Run sends nothing");
  assert.deepEqual(w.product.writes(), []);
  await w.run(prepared);
  assert.equal(w.requests.length, 1, "the person's one click sends once");
});

// ---------------------------------------------------------------- steps 4 and 5: the request and the candidates

const LOAN_CHANGE = "Every loan states the date by which the book is returned, on the receipt.";
const FOUR = [
  candidate("A FINE IS CHARGED", { rule: "A late loan is charged a fine.", passage: "ch. 5" }),
  candidate("THE DUE DATE IS SHOWN", { class: "change", of: LOAN, rule: LOAN_CHANGE, passage: "ch. 1" }),
  candidate("A BOOK STANDS ON A SHELF", { class: "duplicate", of: SHELF, rule: SHELF_RULE, passage: "ch. 2" }),
  candidate("THE DUE DATE MAY BE HIDDEN", { class: "conflict", of: LOAN, rule: "A loan may hide its due date.", passage: "ch. 3" }),
];

// TST-579209 · level: system · module: system
// guards: UC-005; A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT; NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT
// given: the product of TST-579205; the endpoint answers four candidates — A FINE IS CHARGED (new), THE DUE DATE IS SHOWN (a change of A LOAN HAS A DUE DATE), A BOOK STANDS ON A SHELF (a duplicate of A BOOK IS SHELVED) and THE DUE DATE MAY BE HIDDEN (a conflict with A LOAN HAS A DUE DATE)
// input: choose SRC-policy, main.md and drafter-a, show the run panel and press Run once
// expect: steps 4 and 5: one request reaches the endpoint; it holds the excerpt of main.md, all three existing requirements with their states (two in SPEC, one open), the heading of chapter 8 and the instruction to draft candidates against the existing requirements; the panel groups the candidates in the classes change, conflict, duplicate and new; the item of the change shows the current text of A LOAN HAS A DUE DATE beside it, the duplicate that of A BOOK IS SHELVED, the new candidate says it refers to no current requirement; nothing is written to the product's queues
test("TST-579209: UC-005 4 5 Run sends the excerpt, every existing requirement and chapter 8 once, and the candidates come back grouped beside what they refer to", async () => {
  const w = await world({ answers: { candidates: FOUR } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  const panel = await w.run(prepared);
  assert.equal(w.requests.length, 1);
  const sent = w.requests[0].prompt;
  assert.ok(sent.includes("Chapter 1: loans state their due date."), "the excerpt");
  for (const name of [LOAN, SHELF, RENEW]) assert.ok(sent.includes(`**${name}**`), `${name} is sent`);
  assert.deepEqual([...sent.matchAll(/State: ([^\n·]*)/g)].map((match) => match[1].trim()).sort(), ["in SPEC", "in SPEC", "open"]);
  assert.ok(sent.includes("Chapter 8"), "chapter 8 of the book");
  assert.match(sent, /against\* the existing requirements below, not beside them/);
  assert.deepEqual(groupsOf(panel), { change: ["THE DUE DATE IS SHOWN"], conflict: ["THE DUE DATE MAY BE HIDDEN"], duplicate: ["A BOOK STANDS ON A SHELF"], new: ["A FINE IS CHARGED"] });
  const current = (name) => textOf(byClass(itemOf(panel, name), "section", "current-requirement")[0]);
  assert.match(current("THE DUE DATE IS SHOWN"), new RegExp(`${LOAN}[\\s\\S]*${LOAN_RULE}`));
  assert.match(current("A BOOK STANDS ON A SHELF"), new RegExp(`${SHELF}[\\s\\S]*${SHELF_RULE}`));
  assert.match(current("THE DUE DATE MAY BE HIDDEN"), new RegExp(LOAN));
  assert.match(current("A FINE IS CHARGED"), /This candidate refers to no current requirement\./);
  assert.deepEqual(w.proposals(), []);
});

// ---------------------------------------------------------------- 5a, 5b

// TST-579210 · level: system · module: system
// guards: UC-005; A REQUIREMENT HAS A REGISTERED SOURCE; A REQUIREMENT NAMES WHAT IT CONSTRAINS
// given: the endpoint answers A FINE IS CHARGED (new, product), AN EXTERNAL RULE IS NAMED (new, of the source SRC-unlinked, which the product does not link) and A GATE NAMES A DECIDER (new, constrains the process); the instance holds its own SPEC and takes commits
// input: Run; read the panel; press Write proposals
// expect: 5a and 5b: the panel lists AN EXTERNAL RULE IS NAMED apart under "Link first" with SRC-unlinked and the hint to link the source first, and marks A GATE NAMES A DECIDER "Constrains the process."; Write proposals writes a queue to the product with A FINE IS CHARGED and no AN EXTERNAL RULE IS NAMED, and a queue to the instance with A GATE NAMES A DECIDER only; the product's queue holds no process requirement
test("TST-579210: UC-005 5a 5b a candidate of an unlinked source is a hint and is not written, a process candidate goes to the instance's queue", async () => {
  const w = await world({ instance: { spec: INSTANCE_SPEC }, answers: { candidates: [
    candidate("A FINE IS CHARGED", { rule: "A late loan is charged a fine." }),
    candidate("AN EXTERNAL RULE IS NAMED", { rule: "An external rule is named.", source: "SRC-unlinked" }),
    candidate("A GATE NAMES A DECIDER", { rule: "Every gate names its decider.", constrains: "process" })] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  const panel = await w.run(prepared);
  assert.match(textOf(byClass(panel, "section", "unlinked-candidates")[0]), /Link first[\s\S]*AN EXTERNAL RULE IS NAMED: SRC-unlinked is not linked; link the source first\./);
  assert.deepEqual(byClass(panel, "p", "constrains-process").map(textOf), ["Constrains the process."]);
  assert.match(textOf(itemOf(panel, "A GATE NAMES A DECIDER")), /Constrains the process\./);
  assert.doesNotMatch(textOf(itemOf(panel, "A FINE IS CHARGED")), /Constrains the process/);
  await write(prepared.page);
  const product = writtenFiles(w);
  const productText = Object.entries(product).filter(([path]) => path.endsWith("01-lending.md")).map(([, body]) => body).join("\n");
  assert.match(productText, /\*\*A FINE IS CHARGED\*\*/);
  assert.doesNotMatch(Object.values(product).join("\n"), /AN EXTERNAL RULE IS NAMED\*\*/, "the unlinked candidate is not written as a requirement");
  assert.doesNotMatch(productText, /A GATE NAMES A DECIDER/, "the product's queue holds no process requirement");
  const instance = w.instance.writes();
  assert.equal(instance.length, 1);
  assert.ok(instance[0].files.some((file) => file.text.includes("**A GATE NAMES A DECIDER**")));
  assert.ok(instance[0].files.every((file) => !file.text.includes("A FINE IS CHARGED")), "the instance's queue holds no product requirement");
});

// ---------------------------------------------------------------- step 6: the deduplication pass

// TST-579211 · level: system · module: system
// guards: UC-005; EXACT DUPLICATES ARE FOUND WITHOUT A MODEL
// given: the endpoint answers, in every round, A BOOK STANDS ON A SHELF with the rule of A BOOK IS SHELVED and RENEWAL IS LIMITED TO ONE with the rule of the open queue's A MEMBER CAN RENEW ONCE, both classed new, and A FINE IS CHARGED (new)
// input: Run; read the panel and the second request
// expect: 6.2: the panel groups the first two as duplicates, each of the requirement whose rule it states (A BOOK IS SHELVED, A MEMBER CAN RENEW ONCE), and A FINE IS CHARGED as new; the second request carries the finding of EXACT DUPLICATES ARE FOUND WITHOUT A MODEL for each, naming the existing requirement
test("TST-579211: UC-005 6.2 a candidate that restates an existing rule is a duplicate whatever the model said", async () => {
  const w = await world({ answers: { candidates: [
    candidate("A BOOK STANDS ON A SHELF", { rule: SHELF_RULE, passage: "ch. 2" }),
    candidate("RENEWAL IS LIMITED TO ONE", { rule: "Every member renews a loan once.", passage: "ch. 2" }),
    candidate("A FINE IS CHARGED", { rule: "A late loan is charged a fine.", passage: "ch. 5" })] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  const panel = await w.run(prepared);
  assert.deepEqual(groupsOf(panel), { duplicate: ["A BOOK STANDS ON A SHELF", "RENEWAL IS LIMITED TO ONE"], new: ["A FINE IS CHARGED"] });
  assert.equal(byClass(itemOf(panel, "A BOOK STANDS ON A SHELF"), "input", "of")[0].value, SHELF);
  assert.equal(byClass(itemOf(panel, "RENEWAL IS LIMITED TO ONE"), "input", "of")[0].value, RENEW);
  const back = findingLines(w.requests[1].prompt).filter((line) => line.includes("[EXACT DUPLICATES ARE FOUND WITHOUT A MODEL]"));
  assert.equal(back.length, 2);
  assert.match(back.join("\n"), new RegExp(`class it as duplicate of ${SHELF}`));
  assert.match(back.join("\n"), new RegExp(`class it as duplicate of ${RENEW}`));
});

// TST-579212 · level: system · module: system
// guards: UC-005; CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES
// given: the endpoint answers A FINE IS CHARGED (passage ch. 5) and LATE LOANS COST A FINE (passage ch. 6), which state the same rule in other words of capitals, both new
// input: Run, then Write proposals
// expect: 6.1: the two are one requirement on the panel and in the written queue, which names both passages ch. 5 and ch. 6; the written section holds the rule "A late loan is charged a fine." once
test("TST-579212: UC-005 6.1 candidates of one run that state the same rule are merged into one, naming every passage", async () => {
  const w = await world({ answers: { candidates: [
    candidate("A FINE IS CHARGED", { rule: "A late loan is charged a fine.", passage: "ch. 5" }),
    candidate("LATE LOANS COST A FINE", { rule: "a late loan is charged a fine.", passage: "ch. 6" })] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  const panel = await w.run(prepared);
  assert.equal(byClass(panel, "li", "candidate").length, 1, "one candidate on the panel");
  await write(prepared.page);
  const section = Object.entries(writtenFiles(w)).find(([path]) => path.endsWith("01-lending.md"))[1];
  assert.equal(section.split("A late loan is charged a fine.").length - 1, 1, "the rule is written once");
  assert.match(section, /ch\. 5/);
  assert.match(section, /ch\. 6/);
});

// TST-579213 · level: system · module: system
// guards: UC-005; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A FINDING READS LIKE A COMPILER MESSAGE; AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; WHAT A PERSON DECIDES IS NOT SENT BACK; THE ROUNDS ARE COUNTED AND SHOWN
// given: the endpoint's first answer holds a candidate without a check (A MEMBER CAN RENEW TWICE), a candidate whose rule says "and" (A FINE IS CHARGED AND REPORTED) and a conflict (THE DUE DATE MAY BE HIDDEN); its second answer fixes the missing check and justifies the warning in one line
// input: Run; read the second request and the panel
// expect: 6.3: the second request lists as findings, each in the form `<candidate>:<line>: <error|warning>: <what> [<rule>] — <fix>`, an error under A REQUIREMENT HAS FOUR FIELDS for the missing check and a warning under ONE STATEMENT PER REQUIREMENT for the "and", and no line that names the conflict; the loop ends after round 2 and the panel reads "Correction rounds: 2" with nothing left; the person sees the corrected check and the justified rule
test("TST-579213: UC-005 6.3 findings go back to the participant as compiler messages, a justified warning ends the loop, and a conflict is never sent back", async () => {
  const first = [candidate("A MEMBER CAN RENEW TWICE", { rule: "Every member renews a loan twice.", check: "" }),
    candidate("A FINE IS CHARGED AND REPORTED", { rule: "A late loan is charged a fine and reported.", passage: "ch. 5" }),
    candidate("THE DUE DATE MAY BE HIDDEN", { class: "conflict", of: LOAN, rule: "A loan may hide its due date.", passage: "ch. 3" })];
  const second = [candidate("A MEMBER CAN RENEW TWICE", { rule: "Every member renews a loan twice." }), first[1], first[2]];
  const w = await world({ answers: ({ n, prompt }) => (n === 1 ? { draft: { candidates: first } }
    : { draft: { candidates: second }, answers: findingLines(prompt).map((finding) => ({ finding, how: finding.includes(": warning: ") ? "justified" : "fixed", text: "One report states both: it is one event." })) }) });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  const panel = await w.run(prepared);
  assert.equal(w.requests.length, 2);
  const lines = findingLines(w.requests[1].prompt);
  assert.deepEqual(lines.map((line) => line.replace(/ — .*$/, "")), [
    'A MEMBER CAN RENEW TWICE:3: error: no check [A REQUIREMENT HAS FOUR FIELDS]',
    'A FINE IS CHARGED AND REPORTED:7: warning: the rule contains "and" [ONE STATEMENT PER REQUIREMENT]']);
  for (const line of lines) assert.match(line, /^[A-Z ,'-]+:\d+: (error|warning): .+ \[[A-Z ,'-]+\] — .+\.$/);
  assert.ok(!w.requests[1].prompt.split("\n").some((line) => line.includes("THE DUE DATE MAY BE HIDDEN") && /: (error|warning): /.test(line)), "no finding names the conflict");
  assert.deepEqual(byClass(panel, "p", "rounds").map(textOf), ["Correction rounds: 2"]);
  assert.deepEqual(byClass(panel, "li", "left").map(textOf), [], "nothing is left");
  assert.equal(byClass(itemOf(panel, "A MEMBER CAN RENEW TWICE"), "p", "candidate-rule")[0].textContent, "Every member renews a loan twice.");
});

// TST-579214 · level: system · module: system
// guards: UC-005; ONE STATEMENT PER REQUIREMENT; THE CORRECTION LOOP HAS A FIXED LIMIT
// given: the endpoint answers, in every round, A LOAN STATES TWO THINGS with the rule "Every loan states its due date and its return place." and A MEMBER CAN RENEW TWICE; it never fixes the warning
// input: Run; Split on A LOAN STATES TWO THINGS; name the part A LOAN STATES ITS RETURN PLACE with the rule "Every loan states its return place."; set the rule of the first to "Every loan states its due date."; Write proposals
// expect: 6.3 and 6a: the loop ends after round 2, the findings having stayed the same; the panel lists the one finding left and offers Split on A LOAN STATES TWO THINGS only; the written section holds three requirements, A LOAN STATES TWO THINGS with "Every loan states its due date.", the part with its own name and rule, and A MEMBER CAN RENEW TWICE, and the rule that said "and" is written nowhere
test("TST-579214: UC-005 6.3 6a what the last round leaves is shown flagged, and a flagged candidate is split into entries of their own", async () => {
  const TWO = "A LOAN STATES TWO THINGS";
  const w = await world({ answers: { candidates: [candidate(TWO, { rule: "Every loan states its due date and its return place." }), candidate("A MEMBER CAN RENEW TWICE", { rule: "Every member renews a loan twice." })] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  const panel = await w.run(prepared);
  assert.equal(w.requests.length, 2, "the findings stayed the same, so the loop ended after round 2");
  assert.deepEqual(byClass(panel, "li", "left").map(textOf), ['ONE STATEMENT PER REQUIREMENT: the rule contains "and" - split it into two requirements, or keep it and give a one-line reason']);
  assert.deepEqual(byClass(panel, "button", "split").length, 1);
  assert.equal(byClass(itemOf(panel, TWO), "button", "split").length, 1);
  click(byClass(itemOf(panel, TWO), "button", "split")[0]);
  const part = byClass(panel, "li", "split-part")[0];
  byClass(part, "input", "candidate-name")[0].value = "A LOAN STATES ITS RETURN PLACE";
  byClass(part, "textarea", "candidate-rule")[0].value = "Every loan states its return place.";
  byClass(itemOf(panel, TWO), "textarea", "candidate-rule")[0].value = "Every loan states its due date.";
  await write(prepared.page);
  const section = Object.entries(writtenFiles(w)).find(([path]) => path.endsWith("01-lending.md"))[1];
  for (const wanted of ["**A LOAN STATES TWO THINGS**", "Every loan states its due date.\n", "**A LOAN STATES ITS RETURN PLACE**", "Every loan states its return place.\n", "**A MEMBER CAN RENEW TWICE**"]) assert.ok(section.includes(wanted), wanted);
  assert.ok(!section.includes("its due date and its return place"), "the rule that said and is written nowhere");
});

// ---------------------------------------------------------------- step 7: the review panel

// TST-579215 · level: system · module: system
// guards: UC-005; A CONFLICT IS DECIDED BY A PERSON; THE MODEL'S CLASSIFICATION IS MEASURED, NOT TRUSTED
// given: the endpoint answers A FINE IS CHARGED (new, source SRC-policy, normative) and THE DUE DATE MAY BE HIDDEN (a conflict with A LOAN HAS A DUE DATE, whose source SRC-handbook is informational); then another run in which every candidate is a duplicate
// input: Run; move A FINE IS CHARGED to the class duplicate of A BOOK IS SHELVED; read the item of the conflict; then the run of duplicates
// expect: 7, 7a, 7b: the class of an item and the requirement it refers to are fields the author changes, and the item shows the current requirement it then refers to; the conflict's item says SRC-policy is normative and shows A LOAN HAS A DUE DATE with its source SRC-handbook and the authority informational, and decides nothing; while every class is duplicate the panel says that writing only adds sources to existing requirements, and does not say it while one candidate is not
test("TST-579215: UC-005 7 7a 7b the author changes a class, a conflict shows the authority of both sides, and a panel of duplicates says so", async () => {
  const w = await world({ answers: { candidates: [candidate("A FINE IS CHARGED", { rule: "A late loan is charged a fine." }), candidate("THE DUE DATE MAY BE HIDDEN", { class: "conflict", of: LOAN, rule: "A loan may hide its due date." })] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  const panel = await w.run(prepared);
  const conflict = textOf(itemOf(panel, "THE DUE DATE MAY BE HIDDEN"));
  assert.match(conflict, /SRC-policy is normative\./);
  assert.match(conflict, new RegExp(`${LOAN}[\\s\\S]*Sources: SRC-handbook, ch\\. 1 \\(informational\\)`));
  assert.equal(classOf(panel, "THE DUE DATE MAY BE HIDDEN"), "conflict", "the page decides nothing for the person");
  setClass(panel, "A FINE IS CHARGED", "duplicate", SHELF);
  assert.equal(classOf(panel, "A FINE IS CHARGED"), "duplicate");
  assert.match(textOf(byClass(itemOf(panel, "A FINE IS CHARGED"), "section", "current-requirement")[0]), new RegExp(`${SHELF}[\\s\\S]*${SHELF_RULE}`));
  assert.deepEqual(byClass(panel, "p", "all-duplicates").map(textOf), [], "one candidate is a conflict");

  const alike = await world({ answers: { candidates: [candidate("A BOOK STANDS ON A SHELF", { class: "duplicate", of: SHELF, rule: SHELF_RULE }), candidate("A LOAN STATES A DATE", { class: "duplicate", of: LOAN, rule: LOAN_RULE })] } });
  const all = await alike.run(await alike.prepare({ files: [MAIN_FILE] }));
  assert.deepEqual(byClass(all, "p", "all-duplicates").map(textOf), ["Every candidate is a duplicate: writing only adds sources to existing requirements."]);
  setClass(all, "A LOAN STATES A DATE", "new", "");
  assert.deepEqual(byClass(all, "p", "all-duplicates").map(textOf), [], "the sentence goes when a candidate is not a duplicate");
});

// ---------------------------------------------------------------- step 8: Write proposals

// TST-579216 · level: system · module: system
// guards: UC-005; A GENERATED ARTIFACT IS A PROPOSAL; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; ONE CLICK PER DECISION; A CONFLICT IS DECIDED BY A PERSON
// given: the endpoint answers A FINE IS CHARGED (new, passage ch. 5), THE DUE DATE IS SHOWN (a change of A LOAN HAS A DUE DATE, passage ch. 1), A BOOK STANDS ON A SHELF (a duplicate of A BOOK IS SHELVED, passage ch. 2) and THE DUE DATE MAY BE HIDDEN (a conflict with A LOAN HAS A DUE DATE), which the person leaves undecided
// input: Run; press Write proposals once
// expect: 8: one commit on the default branch writes a new queue whose index, entries, rationales and decision file are all there; the queue holds one entry for the section "## 1. Lending", whose text holds A FINE IS CHARGED added with "(SRC-policy, ch. 5)" as its source, A LOAN HAS A DUE DATE changed under its name with the rule and check of the candidate, and A BOOK IS SHELVED with the source SRC-policy, ch. 2 added to its own; the undecided conflict is written nowhere; SPEC.md and the open queue are byte for byte as they were
test("TST-579216: UC-005 8 Write proposals writes a new open queue in one commit, by class, and leaves the SPEC and the undecided conflict alone", async () => {
  const w = await world({ answers: { candidates: FOUR } });
  const specBefore = specOf(w), filesBefore = w.product.files();
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  await w.run(prepared);
  const before = w.product.writes().length;
  const said = await write(prepared.page);
  assert.match(said, /^Written: docs\/spec-freigaben\//);
  const commits = w.product.writes().slice(before);
  assert.equal(commits.length, 1, "one commit");
  assert.equal(commits[0].branch, "trunk", "on the default branch");
  const files = writtenFiles(w), folders = queueFolders(w);
  assert.equal(folders.length, 1);
  const names = Object.keys(files).map((path) => path.split("/").at(-1)).sort();
  assert.deepEqual(names, ["01-lending.begruendung.md", "01-lending.md", "entscheidungen.md", "index.md"]);
  const entry = Object.entries(files).find(([path]) => path.endsWith("01-lending.md"))[1];
  assert.match(entry, /\*\*A LOAN HAS A DUE DATE\*\* \*\(SRC-handbook, ch\. 1; SRC-policy, ch\. 1\)\*\nEvery loan states the date by which the book is returned, on the receipt\.\n\*Check:\* `tests\/fixture\.test\.mjs`/);
  assert.match(entry, /\*\*A BOOK IS SHELVED\*\* \*\(SRC-handbook, ch\. 2; SRC-policy, ch\. 2\)\*\nEvery book stands on a shelf\./);
  assert.match(entry, /\*\*A FINE IS CHARGED\*\* \*\(SRC-policy, ch\. 5\)\*\nA late loan is charged a fine\./);
  assert.ok(!Object.values(files).join("\n").includes("THE DUE DATE MAY BE HIDDEN"), "the undecided conflict is written nowhere");
  assert.equal(specOf(w), specBefore, "SPEC.md is byte for byte as it was");
  for (const [path, body] of Object.entries(filesBefore)) assert.equal(w.product.files()[path], body, `${path} is as it was`);
});

// ---------------------------------------------------------------- step 9: the acceptance as in UC-006

// TST-579217 · level: system · module: system
// guards: UC-005; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; A SPECIFICATION CHANGE IS APPROVED BEFORE IT IS WRITTEN
// given: the queue that Write proposals wrote in TST-579216 (for the candidates A FINE IS CHARGED and a duplicate of A BOOK IS SHELVED); the person's token is stored
// input: open the list of the SPEC changes and the page of the entry; press Accept once
// expect: 9: the entry is listed and shown open before the click and SPEC.md still lacks A FINE IS CHARGED; the click writes one commit that holds the approval record, the entry's text byte for byte in SPEC.md and the decision, and the entry is then in SPEC
test("TST-579217: UC-005 9 the written entry is open until the author accepts it as in UC-006", async () => {
  const w = await world({ answers: { candidates: [candidate("A FINE IS CHARGED", { rule: "A late loan is charged a fine.", passage: "ch. 5" }), candidate("A BOOK STANDS ON A SHELF", { class: "duplicate", of: SHELF, rule: SHELF_RULE, passage: "ch. 2" })] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  await w.run(prepared);
  await write(prepared.page);
  const [folder] = queueFolders(w);
  const id = `spec-${folder}-01`;
  const list = await w.draw({});
  const row = find(list, (node) => node.localName === "tr" && node.getAttribute("data-id") === id)[0];
  assert.ok(row, "the entry is listed");
  assert.equal(byClass(row, "span", "badge")[0].textContent, "open");
  const entry = await w.draw({ id });
  assert.equal(byClass(entry, "span", "badge")[0].textContent, "open");
  assert.ok(!specOf(w).includes("A FINE IS CHARGED"));
  const proposal = Object.entries(writtenFiles(w)).find(([path]) => path.endsWith("01-lending.md"))[1];
  const before = w.product.writes().length;
  click(buttonNamed(entry, "Accept"));
  await until(() => w.product.writes().length === before + 1, "the accepting commit");
  const [accepted] = w.product.writes().slice(before);
  assert.deepEqual(accepted.files.map((file) => file.path).filter((path) => path.startsWith("docs/approvals/")).length, 1);
  assert.ok(specOf(w).includes(proposal.trim().split("\n").slice(2).join("\n").trim()), "the entry's text stands in SPEC.md");
  assert.ok(specOf(w).includes("**A FINE IS CHARGED** *(SRC-policy, ch. 5)*"));
  assert.equal(byClass(await w.draw({ id }), "span", "badge")[0].textContent, "in SPEC");
});

// ---------------------------------------------------------------- the postcondition

// TST-579218 · level: system · module: system
// guards: UC-005; A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT; A CHANGE IS PROPOSED UNDER THE EXISTING NAME
// given: the endpoint answers a new requirement, a change of A LOAN HAS A DUE DATE, a duplicate of A BOOK IS SHELVED and a candidate that states the rule of the open queue's A MEMBER CAN RENEW ONCE (classed new)
// input: Run; Write proposals
// expect: the postcondition: in the written section every requirement whose name the SPEC does not hold states a rule that no existing requirement of the SPEC or the open queue states; the change stands under the name A LOAN HAS A DUE DATE and no requirement bears the change candidate's own name; the duplicate adds a source to A BOOK IS SHELVED and no requirement bears the duplicate candidate's name; the participant, the passage of each and the Agent M version are named by the commit
test("TST-579218: UC-005 postcondition no proposal duplicates an existing requirement: new is new, a change stands under the existing name, a repeat is an added source", async () => {
  const w = await world({ answers: { candidates: [
    candidate("A FINE IS CHARGED", { rule: "A late loan is charged a fine.", passage: "ch. 5" }),
    candidate("THE DUE DATE IS SHOWN", { class: "change", of: LOAN, rule: LOAN_CHANGE, passage: "ch. 1" }),
    candidate("A BOOK STANDS ON A SHELF", { class: "duplicate", of: SHELF, rule: SHELF_RULE, passage: "ch. 2" }),
    candidate("RENEWAL IS LIMITED TO ONE", { rule: "Every member renews a loan once.", passage: "ch. 2" })] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  await w.run(prepared);
  await write(prepared.page);
  const section = Object.entries(writtenFiles(w)).find(([path]) => path.endsWith("01-lending.md"))[1];
  const blocks = [...section.matchAll(/\*\*([A-Z][A-Z ,'-]+)\*\* \*\(([^)]*)\)\*\n([^\n]*)\n/g)].map((match) => ({ name: match[1], sources: match[2], rule: match[3] }));
  const existing = [LOAN_RULE, SHELF_RULE, "Every member renews a loan once."];
  for (const block of blocks.filter((each) => ![LOAN, SHELF].includes(each.name))) assert.ok(!existing.includes(block.rule), `${block.name} states a rule that exists`);
  assert.deepEqual(blocks.map((each) => each.name), [LOAN, SHELF, "A FINE IS CHARGED"], "no requirement bears the name of the change, the duplicate or the restated candidate");
  assert.match(blocks[0].sources, /SRC-handbook, ch\. 1; SRC-policy, ch\. 1/);
  assert.match(blocks[1].sources, /SRC-handbook, ch\. 2; SRC-policy, ch\. 2/);
  const message = w.proposals()[0].message;
  assert.match(message, /^Agent-M-Version: \S+/m);
  assert.match(message, /^Agent-M-Participant: drafter-a$/m);
  assert.match(message, /^Agent-M-Model: model-a$/m);
});

// TST-579219 · level: system · module: system
// guards: UC-005; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; EVERY ARTIFACT NAMES ITS ORIGIN
// given: the product, the endpoint's answers and the written queue of TST-579218, whose source SRC-policy is linked at version 2026-10-01
// input: read the files of the written queue
// expect: the postcondition: the written files name the source passage (ch. 5), the participant drafter-a and the version 2026-10-01 of the source the candidates were derived from
test("TST-579219: UC-005 postcondition each proposal names its source passage, the source version and the participant", async () => {
  const w = await world({ answers: { candidates: [candidate("A FINE IS CHARGED", { rule: "A late loan is charged a fine.", passage: "ch. 5" })] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  await w.run(prepared);
  await write(prepared.page);
  const all = Object.values(writtenFiles(w)).join("\n");
  assert.match(all, /ch\. 5/);
  assert.match(all, /drafter-a/);
  assert.ok(all.includes(VERSION), "the version of the source");
});
