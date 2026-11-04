// System tests of UC-022 "Derive the system architecture from requirements and use cases": the precondition (accepted use cases, no architecture, two participants of different models), the main flow from the page
// that shows what the derivation covers to the architecture accepted as a whole — the draft of the participants, the check of the whole by a reviewer, the due diligence, Write proposals, Accept all —, every
// alternative flow of the use case but 8a, which waits for a text, and the postcondition. TST-448201 maps every flow of UC-022 to the system test that walks it, and the older tests of other levels that also walk it.
// Run: node --test tests/system-uc-022-derive-the-architecture.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-job-runner
// Module: MOD-reuse-facts
// Module: MOD-approvals
// Module: MOD-artifact-edits
// Guards: UC-022
// Level: system
//
// Written for ITM-448 by developer-sonnet-k. The world is tests/uc-022-harness.mjs: the product alice/library is a repository in memory, the routes `decision/draft` and `decision/all` of MOD-review-pages are drawn into the
// fixture DOM, and the model endpoints and the package registry are a fake `fetch`. Each test states its input and its expected result in its own text (given / input / expect) from UC-022, before it runs; none reads an
// expected value from a document. The counter-proofs are recorded in the pull request. Readings the texts leave open, which the cases state:
//   - "The author opens Architecture" (step 1) is read as the route `decision/draft` (#decision/id=draft), the page "Draft the architecture" that the list of the decisions links to (MOD-review-pages, `<k>/draft`).
//   - "The author presses Run — that click is the decision" (step 4) is read as the panel's own button Run; "the author presses Write proposals" (step 9) as the button `write-proposals` below the draft, and "Accept all N shown"
//     (step 10) as the button of `decision/all`, the review page of the whole architecture (MOD-review-pages, `<k>/all`).
//   - "Agent M assigns" an identifier (step 9) is read as the writer open-files giving each new decision the next free ARC-<nnn> of the head and keeping the drafted slug (MOD-artifact-edits).
//   - "The reviewer's check finds it" (5a) is read as the draft's checks — the reviewer's and Agent M's own, which run each round — find it; the case shows the finding goes back and the name is not invented.
//   - "links to UC-008" (1a) is read as the link to the review page of the open use case, where UC-008 is walked, and the finding's correction naming UC-008.
//   - "offers a participant with a larger context" (3a) is read as: the page keeps every participant of the list choosable, and a participant whose context holds the input gives a panel with Run.
//   - "the panel lists it as not found — the name may be invented" (7a) is read as the row of the due-diligence table of the candidate, whose "Read from" holds the address that was queried.
//   - "offers a participant that can reach the web" (7b) is read as the message that names a participant with a route other than the tab, and else any participant that can reach the web.
//   - "the draft is shown with each finding left, in the compiler form" (6a) is read as the list `left` of the page that shows the draft; "the answer stands side by side" (6c) as the answer beside the finding in the rounds.
//   - "left out of Accept all N shown" (10a) is read as: the click records no file that rests on what is not accepted, and the page names it with what is open; the button counts the files shown.
//   - The Agent M version of a commit's trailer (step 9) is the commit of the instance the page read, as every page of the tab names it (MOD-review-pages, jobs.mjs).

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { statuses } from "../src/approvals/index.mjs";
import { ARC_DRAFT, DRAFTER_ROW, FAR_ROW, LOAN, MOD_DRAFT, QUEUE, READER_ROW, READY, REGISTER, REUSE_DRAFT, REVIEWER_ROW, SECRET_ENTRY, SECRET_LINK, SHELF, SPEC, SUB_DRAFT, TWIN_ROW, UC1, UC1_PATH, UC2, UC2_PATH,
  WORKFLOW, approvalOf, architecturePaths, badge, byClass, choose, click, derive, draftOf, editorOf, endpoints, fakeProduct, fileOf, filesOf, find, jobRecord, onDisk, panelFor, participantNames, realFetch,
  recordsOf, registerOf, registryOf, reply, run, runButtons, show, text, until, without, writeProposals, writesTo } from "./uc-022-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SELF = "tests/system-uc-022-derive-the-architecture.test.mjs";
const BOOK = "docs/sources/SRC-vibe-coding/2026-10-05/";
const CHAPTERS = ["09_system-modeling.md", "10_architectural-design.md", "11_agentic-design-and-control-patterns.md", "12_implementation-and-version-control.md"];
const REG = registryOf(["loan-lib", "MIT"], ["shelf-lib", "Apache-2.0"]);
const ready = (extra = {}) => endpoints({ drafter: [reply(draftOf())], reviewer: [reply({ findings: [] })], registry: REG, ...extra });
const findingsOf = (request) => request.sent.slice(request.sent.indexOf("## Findings to fix or answer")).split("\n").filter((each) => /^\S+:\d+: (error|warning): /.test(each));
const COMPILER = /^\S+:\d+: (error|warning): .+ \[[A-Z0-9 ,'.-]+\] — .+\.$/;
const lineOf = (found) => `${found.artifact}:${found.line}: ${found.kind ?? "warning"}: ${found.what} [${found.rule}] — ${found.fix}.`;
const SYSTEM_FINDING = { artifact: ARC_DRAFT, line: 9, rule: "A SUBSYSTEM IS CHECKED AGAINST THE SYSTEM", what: "the shelf belongs to no subsystem", fix: "give the shelf a subsystem or say where it is" };
const NORMALISED = (node) => node.textContent.replace(/\s+/g, " ");
const writes = (fake) => writesTo(fake, "docs/architecture/");

test.afterEach(() => { globalThis.fetch = realFetch; });

// ---------------------------------------------------------------- the map

// Each flow of UC-022, with the system tests that walk it and the older tests of other levels that walk it too.
const FLOWS = {
  "precondition": { system: [[SELF, "TST-448202"]], also: [[`tests/approvals-architecture.test.mjs`, "TST-472010"], [`tests/review-pages-draft-architecture.test.mjs`, "TST-442005"]] },
  "main flow, 1 what the derivation covers": { system: [[SELF, "TST-448203"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-442001"], [`tests/approvals-architecture.test.mjs`, "TST-472012"]] },
  "main flow, 2 the participants": { system: [[SELF, "TST-448204"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-442005"], [`tests/review-pages-draft-architecture.test.mjs`, "TST-442007"]] },
  "main flow, 3 what is sent": { system: [[SELF, "TST-448205"]], also: [[`tests/specification-design-derive-architecture.test.mjs`, "TST-444001"], [`tests/system-uc-022-derive-architecture.test.mjs`, "TST-448001"]] },
  "main flow, 4 the run panel and Run": { system: [[SELF, "TST-448206"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-442008"], [`tests/review-pages-draft-architecture.test.mjs`, "TST-442010"]] },
  "main flow, 5 the draft from the whole to its modules": { system: [[SELF, "TST-448207"]], also: [[`tests/system-uc-022-derive-architecture.test.mjs`, "TST-448001"]] },
  "main flow, 6 the check of the whole": { system: [[SELF, "TST-448208"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-443001"], [`tests/review-pages-draft-architecture.test.mjs`, "TST-111503"]] },
  "main flow, 7 the due diligence": { system: [[SELF, "TST-448209"]], also: [[`tests/reuse-facts.test.mjs`, "TST-436001"], [`tests/reuse-facts.test.mjs`, "TST-435001"]] },
  "main flow, 8 the draft the author reviews": { system: [[SELF, "TST-448210"]], also: [[`tests/review-pages-whole-architecture.test.mjs`, "TST-472691"], [`tests/review-pages-draft-architecture.test.mjs`, "TST-067105"]] },
  "main flow, 9 Write proposals": { system: [[SELF, "TST-448211"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-443003"], [`tests/system-uc-022-derive-architecture.test.mjs`, "TST-448001"]] },
  "main flow, 10 Accept all N shown": { system: [[SELF, "TST-448212"]], also: [[`tests/review-pages-whole-architecture.test.mjs`, "TST-472688"], [`tests/review-pages-whole-architecture.test.mjs`, "TST-472689"]] },
  "1a": { system: [[SELF, "TST-448214"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-442002"], [`tests/approvals-architecture.test.mjs`, "TST-472010"]] },
  "1b": { system: [[SELF, "TST-448215"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-442003"], [`tests/approvals-architecture.test.mjs`, "TST-472013"]] },
  "1c": { system: [[SELF, "TST-448216"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-442004"], [`tests/system-uc-022-derive-architecture.test.mjs`, "TST-448002"]] },
  "2a": { system: [[SELF, "TST-448217"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-442006"], [`tests/system-uc-022-derive-architecture.test.mjs`, "TST-448002"]] },
  "3a": { system: [[SELF, "TST-448218"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-442009"], [`tests/release-itm-1318-reviewer-whole-architecture.test.mjs`, "TST-1318103"]] },
  "4a": { system: [[SELF, "TST-448219"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-442008"]] },
  "5a": { system: [[SELF, "TST-448220"]], also: [] },
  "6a": { system: [[SELF, "TST-448221"]], also: [[`tests/review-pages-whole-architecture.test.mjs`, "TST-478028"], [`tests/review-pages-whole-architecture.test.mjs`, "TST-472691"]] },
  "6b": { system: [[SELF, "TST-448222"]], also: [[`tests/system-uc-022-derive-architecture.test.mjs`, "TST-448003"]] },
  "6c": { system: [[SELF, "TST-448223"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-443001"], [`tests/review-pages-whole-architecture.test.mjs`, "TST-472691"]] },
  "7a": { system: [[SELF, "TST-448224"]], also: [[`tests/reuse-facts.test.mjs`, "TST-436003"], [`tests/review-pages-draft-architecture.test.mjs`, "TST-443001"]] },
  "7b": { system: [[SELF, "TST-448225"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-443004"], [`tests/reuse-facts.test.mjs`, "TST-436004"]] },
  "7c": { system: [[SELF, "TST-448226"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-443001"], [`tests/reuse-facts.test.mjs`, "TST-435002"]] },
  "7d": { system: [[SELF, "TST-448227"]], also: [[`tests/review-pages-draft-architecture.test.mjs`, "TST-443002"], [`tests/system-uc-022-derive-architecture.test.mjs`, "TST-448003"]] },
  "10a": { system: [[SELF, "TST-448228"]], also: [[`tests/review-pages-whole-architecture.test.mjs`, "TST-472694"], [`tests/system-uc-022-derive-architecture.test.mjs`, "TST-448004"]] },
  "postcondition": { system: [[SELF, "TST-448213"]], also: [[`tests/system-uc-022-derive-architecture.test.mjs`, "TST-448001"]] },
};
// Alternative flow 8a waits for a text: no case walks it, and the map names it as waiting.
const WAITS = ["8a"];

// TST-448201 · level: system · module: system
// guards: UC-022
// given: UC-022 as committed text, whose alternative flows are 1a, 1b, 1c, 2a, 3a, 4a, 5a, 6a, 6b, 6c, 7a, 7b, 7c, 7d, 8a and 10a, and the tests named in FLOWS
// input: read UC-022's alternative flows, and the declarations of the test files named for each flow
// expect: known positive — UC-022 names the sixteen alternative flows; FLOWS holds each of them but 8a, which WAITS names as waiting for a text, the precondition, the main flow's ten steps and the postcondition; each system test named stands in this file with the level system and guards UC-022; each older test named stands in its file
test("TST-448201: UC-022 every flow has a system test that walks it, and 8a is named as waiting", () => {
  const useCase = read("docs/use-cases/UC-022-derive-the-architecture.md");
  const alternatives = [...useCase.matchAll(/^- \*\*(\d+[a-z])\. /gm)].map((match) => match[1]);
  assert.deepEqual(alternatives, ["1a", "1b", "1c", "2a", "3a", "4a", "5a", "6a", "6b", "6c", "7a", "7b", "7c", "7d", "8a", "10a"], "known positive: UC-022's alternative flows");
  for (const flow of alternatives) assert.ok(Object.keys(FLOWS).includes(flow) || WAITS.includes(flow), `${flow} has a system test or waits`);
  assert.deepEqual(WAITS.filter((flow) => Object.keys(FLOWS).includes(flow)), [], "a flow that waits has no case");
  for (let step = 1; step <= 10; step += 1) assert.ok(Object.keys(FLOWS).some((flow) => flow.startsWith(`main flow, ${step} `)), `main flow step ${step} has a system test`);
  for (const [flow, { system, also }] of Object.entries(FLOWS)) {
    assert.ok(system.length > 0, `${flow} names a system test`);
    for (const [file, id] of system) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${flow}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${flow}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "system", `${id} is a system test`);
      assert.ok((declared.guards ?? []).includes("UC-022"), `${id} guards UC-022`);
    }
    for (const [file, id] of also) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${flow}: ${file} exists`);
      assert.ok(testDeclarations(file, read(file)).some((each) => each.id === id), `${flow}: ${id} is declared in ${file}`);
    }
  }
});

// ---------------------------------------------------------------- the precondition

// TST-448202 · level: system · module: system
// guards: UC-022; ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES; THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE; NO REVIEWER IS THE DRAFTER
// given: a product whose use cases UC-001 and UC-002 are accepted by records, with no architecture and no open SPEC change; an instance whose list holds model endpoints of model-a (drafter-a, twin-a), model-b (reviewer-b), model-c (far-c) and model-d (small-d), a CI agent and a person who cannot draft text
// input: the person opens the drafting page of the architecture; chooses drafter-a
// expect: known positive — the page is drawn with its covers; the precondition finds nothing: no finding on the page; the participants offered are the six that can draft text, not the person; once drafter-a is chosen the reviewers offered are ci-agent, far-c, reviewer-b and small-d — not drafter-a and not twin-a, which uses its model —; nothing is written and nothing is sent
test("TST-448202: UC-022 precondition — accepted use cases, no architecture, and participants of different models make the derivation startable", async () => {
  const seen = ready();
  const fake = fakeProduct();
  const target = await show(fake);
  assert.equal(byClass(target, "section", "covers").length, 1, "known positive: the page is drawn");
  assert.deepEqual(byClass(target, "p", "finding").map((node) => node.textContent), [], "the precondition finds nothing");
  assert.deepEqual(participantNames(target), ["ci-agent", "drafter-a", "far-c", "reviewer-b", "small-d", "twin-a"]);
  assert.deepEqual(participantNames(target, "reviewer"), [], "no reviewer before a drafter is chosen");
  choose(target, "participant", "drafter-a");
  assert.deepEqual(participantNames(target, "reviewer"), ["ci-agent", "far-c", "reviewer-b", "small-d"]);
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(seen.drafter.length + seen.reviewer.length, 0, "nothing sent");
});

// ---------------------------------------------------------------- main flow 1

// TST-448203 · level: system · module: system
// guards: UC-022; THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE; EVERY STEP EXPLAINS ITSELF
// given: the ready product, whose SPEC holds A LOAN HAS A DUE DATE and A BOOK IS SHELVED and whose use cases are UC-001 and UC-002
// input: step 1 the person opens the drafting page of the architecture
// expect: known positive — the page lists the two requirements and the two use cases as covered; it offers no selection — no checkbox and no choice among them —; a folded What is this? explains an architecture as the fundamental organisation of a system, the system with its subsystems and modules, the four kinds of file, the four views, the three pattern families and the design principles, and points to chapter 10 of the book; nothing is written, nothing is sent
test("TST-448203: UC-022 step 1 — the page shows what the derivation covers, offers no selection, and explains an architecture folded", async () => {
  const seen = ready();
  const fake = fakeProduct();
  const target = await show(fake);
  const covers = byClass(target, "section", "covers")[0];
  assert.deepEqual(byClass(covers, "li", "requirement").map((item) => item.textContent).sort(), [SHELF, LOAN].sort(), "known positive: the requirements are listed");
  assert.deepEqual(byClass(covers, "li", "use-case").map((item) => item.textContent), ["UC-001", "UC-002"]);
  assert.match(covers.textContent, /Every requirement of the SPEC \(2\) and every use case \(2\); nothing is selected\./);
  assert.equal(find(target, (node) => node.localName === "input" && node.type === "checkbox").length, 0, "no selection");
  assert.equal(find(target, (node) => node.localName === "select").length, 0, "no choice");
  const folded = find(target, (node) => node.localName === "details")[0];
  assert.equal(find(folded, (node) => node.localName === "summary")[0].textContent, "What is this?");
  const explanation = NORMALISED(folded);
  for (const wanted of [/fundamental organization of a system/, /decomposed into subsystems/, /each subsystem into modules/, /four kinds of file/, /decision that states the system/, /one decision for each subsystem/,
    /one file for each module/, /four views/, /logical view/, /process view/, /development view/, /physical view/, /structuring patterns/, /adaptable-system patterns/, /distributed-system patterns/,
    /divide and conquer/, /YAGNI/, /DRY/, /least astonishment/, /open-closed principle/, /In the book Vibe Coding: chapter 10\./]) assert.match(explanation, wanted);
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(seen.drafter.length + seen.reviewer.length, 0, "nothing sent");
});

// ---------------------------------------------------------------- main flow 2

// TST-448204 · level: system · module: system
// guards: UC-022; THE PAGE NAMES WHERE IT SENDS; RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; NO REVIEWER IS THE DRAFTER
// given: the instance's list of six participants that can draft text and a person; (a) the product alone; (b) a product that links the restricted source SRC-secret, whose register entry permits the place "this machine" only
// input: step 2 the person opens the page; chooses drafter-a, then reviewer-b as the drafter
// expect: (a) known positive — the drafters offered are the six, each with the place where it processes data, the person not among them; the reviewers after drafter-a are ci-agent, far-c, reviewer-b and small-d, after reviewer-b they are ci-agent, drafter-a, far-c, small-d and twin-a — the offer follows the drafter —; (b) far-c (a server in Singapore) and ci-agent (GitHub Actions in the USA) are offered neither as drafter nor as reviewer, the others are
test("TST-448204: UC-022 step 2 — only participants that can draft text are offered, with where they process data, and a reviewer differs from the drafter and its place is permitted", async () => {
  ready();
  const target = await show(fakeProduct());
  assert.deepEqual(participantNames(target), ["ci-agent", "drafter-a", "far-c", "reviewer-b", "small-d", "twin-a"], "known positive: the drafters offered");
  const places = Object.fromEntries(byClass(target, "li", "participant").map((item) => [item.getAttribute("data-name"), byClass(item, "span", "place")[0]?.textContent]));
  assert.deepEqual(places, { "ci-agent": "GitHub Actions in the USA", "drafter-a": "this machine", "far-c": "a server in Singapore", "reviewer-b": "this machine", "small-d": "this machine", "twin-a": "this machine" });
  choose(target, "participant", "drafter-a");
  assert.deepEqual(participantNames(target, "reviewer"), ["ci-agent", "far-c", "reviewer-b", "small-d"]);
  choose(target, "participant", "reviewer-b");
  assert.deepEqual(participantNames(target, "reviewer"), ["ci-agent", "drafter-a", "far-c", "small-d", "twin-a"], "the offer follows the drafter");

  const limited = await show(fakeProduct({ ...READY, "docs/sources.md": SECRET_LINK }), { id: "draft" }, { entries: { "docs/sources/SRC-secret.md": SECRET_ENTRY } });
  assert.deepEqual(participantNames(limited), ["drafter-a", "reviewer-b", "small-d", "twin-a"], "far-c and ci-agent are left out as drafters");
  choose(limited, "participant", "drafter-a");
  assert.deepEqual(participantNames(limited, "reviewer"), ["reviewer-b", "small-d"], "and as reviewers");
});

// ---------------------------------------------------------------- main flow 3

// TST-448205 · level: system · module: system
// guards: UC-022; THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT; NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY; AN ARCHITECTURE JOB RECEIVES THE CHAPTERS ON MODELING, ARCHITECTURE, DESIGN AND IMPLEMENTATION; EVERY MODEL READS AGENT M'S AGENTS.MD FIRST; ONE DEFINITION, THREE DRIVERS
// given: the ready product and drafter-a with reviewer-b, whose endpoints answer a complete draft and no finding
// input: step 3 the person presses Run; the one request each endpoint receives is read
// expect: the drafter's request carries the participant's key as its authorisation and begins with Agent M's AGENTS.md; then the architecture prompt with its nine steps in the order of the use case — context, patterns, subsystems, views, scenarios, testing, the subsystems' decisions, the modules, the further decisions —, the whole SPEC, UC-001 and UC-002 whole, and chapters 9, 10, 11 and 12 of the book whole, and none of chapter 8 or 13; the panel before it said the input fits the context (88k of 300k tokens); the first sentence of the prompt stands in src/job-catalogue/kinds/derive-architecture/prompt.md and in no other file below src/
test("TST-448205: UC-022 step 3 — Agent M sends the whole SPEC, every use case, chapters 9 to 12 and the architecture prompt in its order, after its AGENTS.md", async () => {
  const seen = ready();
  const target = await show(fakeProduct());
  const panel = await panelFor(target);
  assert.match(panel.textContent, /\d+ tokens of 300000 tokens of context/, "the input fits the participant's context");
  await run(target);
  assert.equal(seen.drafter.length, 1);
  assert.equal(seen.drafter[0].headers.Authorization, "Bearer sk-UC022-FIXTURE-KEY-0123456789");
  const sent = seen.drafter[0].sent;
  assert.ok(sent.startsWith(onDisk("AGENTS.md").slice(0, 200)), "the request begins with AGENTS.md");
  const steps = ["1. **Context**", "2. **Patterns**", "3. **Subsystems**", "4. **Views**", "5. **Scenarios**", "6. **Testing**", "7. **Subsystems' decisions**", "8. **Modules**", "9. **Further decisions**"].map((each) => sent.indexOf(each));
  assert.ok(steps.every((at, index) => at > 0 && (index === 0 || at > steps[index - 1])), `the nine steps stand in order: ${steps.join(", ")}`);
  assert.ok(sent.indexOf("You draft the architecture of a product from its whole SPEC") > 0 && sent.indexOf("You draft the architecture of a product from its whole SPEC") < steps[0], "the prompt leads the steps");
  for (const [what, wanted] of [["the SPEC", SPEC.trim()], ["UC-001", UC1.trim()], ["UC-002", UC2.trim()]]) assert.ok(sent.includes(wanted), `${what} is sent whole`);
  for (const chapter of CHAPTERS) assert.ok(sent.includes(onDisk(BOOK + chapter)), `${chapter} is sent whole`);
  for (const other of ["08_requirements-engineering.md", "13_software-testing.md"]) assert.ok(!sent.includes(onDisk(BOOK + other)), `${other} is not sent`);
  const holders = [];
  const walk = (dir) => { for (const entry of readdirOf(dir)) { if (entry.endsWith("/")) walk(dir + entry); else if (/\.(mjs|md|json|yml|html)$/.test(entry) && read(dir + entry).includes("You draft the architecture of a product from its whole SPEC")) holders.push(dir + entry); } };
  walk("src/");
  assert.deepEqual(holders, ["src/job-catalogue/kinds/derive-architecture/prompt.md"], "the prompt stands once");
});
const readdirOf = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url)).filter((name) => name !== "node_modules" && name !== "vendor")
  .map((name) => (statSync(new URL(`../${dir}${name}`, import.meta.url)).isDirectory() ? `${name}/` : name));

// ---------------------------------------------------------------- main flow 4

// TST-448206 · level: system · module: system
// guards: UC-022; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; THE CORRECTION LOOP HAS A FIXED LIMIT
// given: the ready product; drafter-a and reviewer-b chosen on the drafting page
// input: step 4 the person shows the run panel, and presses Run
// expect: the panel names two destinations — drafter-a as drafter and reviewer-b as reviewer —, each with its model and where it processes data and the seven things it receives: SPEC.md, UC-001, UC-002 and chapters 9 to 12; the limit of correction rounds, at most 5; exactly one Run on the page, and it is the panel's; before the click nothing is written and nothing is sent; after that one click each endpoint was asked once, the job's start record is committed before its end record, and no other origin was called
test("TST-448206: UC-022 step 4 — the run panel names the destinations and what each receives, and nothing is sent or written until Run", async () => {
  const seen = ready();
  const fake = fakeProduct();
  const target = await show(fake);
  const panel = await panelFor(target);
  const destinations = byClass(panel, "section", "destination");
  assert.equal(destinations.length, 2);
  assert.match(destinations[0].textContent, /drafter-a — drafter/);
  assert.match(destinations[0].textContent, /model: model-a; processes data at: this machine/);
  assert.match(destinations[1].textContent, /reviewer-b — reviewer/);
  assert.match(destinations[1].textContent, /model: model-b; processes data at: this machine/);
  for (const destination of destinations) {
    assert.deepEqual(byClass(destination, "li", "part").map((item) => item.textContent.split(" — ")[0]), ["SPEC.md", UC1_PATH, UC2_PATH, ...CHAPTERS]);
  }
  assert.match(panel.textContent, /Correction rounds: at most 5/);
  assert.equal(runButtons(target).length, 1, "one Run on the page");
  assert.equal(runButtons(panel).length, 1, "and it is the panel's");
  assert.equal(fake.writes().length, 0, "nothing written before the click");
  assert.equal(seen.drafter.length + seen.reviewer.length, 0, "nothing sent before the click");
  await run(target);
  assert.deepEqual([seen.drafter.length, seen.reviewer.length], [1, 1], "each endpoint was asked once");
  assert.deepEqual(seen.outside, [], "no other origin was called");
  const records = fake.writes().filter((change) => change.files.some((file) => file.path.startsWith("docs/jobs/")));
  assert.equal(records.length, 2, "the record: its start, then its end");
  assert.ok(!records[0].files[0].text.includes("## End") && records[1].files[0].text.includes("## End"));
});

// ---------------------------------------------------------------- main flow 5

// TST-448207 · level: system · module: system
// guards: UC-022; ARTIFACTS ARE MARKDOWN; DIAGRAMS ARE MERMAID IN MARKDOWN
// given: the ready product; a drafter that returns the four kinds of file — the decision that states the system, a subsystem's decision, a further decision that adopts a package, and a module file —, each with its context, decision, alternatives and consequences, the views drawn as Mermaid blocks
// input: step 5 the person presses Run
// expect: known positive — the job ran; the page shows the four files in the order drafted, each in an editor holding its text as drafted — the further decision with its due-diligence section added —, the decision that states the system being the one that refines no other; every file is Markdown and holds its diagram as a block ```mermaid; nothing is written by the page but the job's record: no file of docs/architecture/
test("TST-448207: UC-022 step 5 — the draft of the four kinds of file is shown, each in Markdown with its diagrams in Mermaid, and nothing is written yet", async () => {
  ready();
  const fake = fakeProduct();
  const target = await derive(fake);
  assert.equal(byClass(target, "p", "ran").length, 1, "known positive: the job ran");
  const drafted = draftOf().files;
  assert.deepEqual(byClass(target, "section", "draft-file").map((file) => file.getAttribute("data-path")), [ARC_DRAFT, SUB_DRAFT, REUSE_DRAFT, MOD_DRAFT]);
  for (const file of drafted) {
    const shown = editorOf(target, file.path).value;
    assert.ok(file.path.endsWith(".md"), `${file.path} is Markdown`);
    if (file.path === REUSE_DRAFT) assert.ok(shown.startsWith(file.text.slice(0, file.text.indexOf("## Consequences"))) && shown.includes("## Due diligence"), "the further decision gets its due diligence");
    else assert.equal(shown, file.text, `${file.path} is shown as drafted`);
    if (file.path !== MOD_DRAFT) assert.match(shown, /\n```mermaid\n[^]*\n```\n/, `${file.path} draws its diagram in Mermaid`);
    assert.ok(!/!\[[^\]]*\]\(/.test(shown), `${file.path} holds no image`);
  }
  assert.ok(!editorOf(target, ARC_DRAFT).value.includes("refines:") && editorOf(target, SUB_DRAFT).value.includes("refines: ARC-900"), "the decision that states the system refines no other");
  assert.deepEqual(architecturePaths(fake), [], "no file of the architecture is written");
});

// ---------------------------------------------------------------- main flow 6

// TST-448208 · level: system · module: system
// guards: UC-022; AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT; A REVIEWER'S FINDING IS A WARNING; A REVIEW FINDING IS WEIGHED BEFORE IT IS ACTED ON; A FINDING READS LIKE A COMPILER MESSAGE; THE ROUNDS ARE COUNTED AND SHOWN
// given: the ready product; the reviewer first finds that a subsystem is missing for the shelf (a finding it gives as an error) and finds nothing in the second round; the drafter corrects the system's decision and answers the finding
// input: step 6 the person presses Run; the requests each endpoint receives and the page are read
// expect: the reviewer's request holds the complete draft — all four files — before the whole SPEC, both use cases and chapters 9 to 12, and asks the three checks level by level without checking the modules against the use cases; the drafter's second request carries the finding as a warning in the compiler's form and the draft it concerns; the reviewer is asked again on the corrected draft; the page shows the corrected draft only, the rounds — round 1 with the finding and the drafter's answer, round 2 without a finding — and Left: none; nothing is written to the architecture
test("TST-448208: UC-022 step 6 — the complete draft is checked as a whole, the findings go back, and the author sees the corrected draft", async () => {
  const corrected = draftOf();
  corrected.files[0].text = corrected.files[0].text.replace("The lending system manages loans and shelves.", "The lending system manages loans and shelves; the shelf belongs to the lending subsystem.");
  const seen = endpoints({ drafter: [reply(draftOf()), reply(corrected, [{ finding: lineOf(SYSTEM_FINDING), how: "fixed", text: null }])],
    reviewer: [reply({ findings: [{ ...SYSTEM_FINDING, kind: "error" }] }), reply({ findings: [] })], registry: REG });
  const fake = fakeProduct();
  const target = await derive(fake);
  assert.equal(seen.reviewer.length, 2, "the reviewer checks the corrected draft again");
  const asked = seen.reviewer[0].sent;
  for (const path of [ARC_DRAFT, SUB_DRAFT, REUSE_DRAFT, MOD_DRAFT]) assert.ok(asked.includes(path), `the reviewer receives ${path}`);
  const order = ["## The architecture draft", "## The whole SPEC", "## Every accepted use case", "## Chapters 9 to 12"].map((each) => asked.indexOf(each));
  assert.ok(order.every((at, index) => at > 0 && (index === 0 || at > order[index - 1])), `the draft stands before the SPEC, the use cases and the chapters: ${order.join(", ")}`);
  for (const wanted of [SPEC.trim(), UC1.trim(), UC2.trim(), ...CHAPTERS.map((chapter) => onDisk(BOOK + chapter))]) assert.ok(asked.includes(wanted), "the reviewer receives the whole project");
  for (const wanted of ["every use case against the system", "every subsystem against the system", "every module against its subsystem", "Do not check the modules against the use cases."]) assert.ok(asked.includes(wanted), wanted);
  assert.deepEqual(findingsOf(seen.drafter[1]), [lineOf(SYSTEM_FINDING)], "the finding goes back as a warning in the compiler's form");
  assert.match(lineOf(SYSTEM_FINDING), COMPILER);
  assert.ok(seen.drafter[1].sent.includes("the shelf belongs to no subsystem") && seen.drafter[1].sent.includes("The library is a desk and a shelf."), "with the draft it concerns");
  assert.ok(editorOf(target, ARC_DRAFT).value.includes("the shelf belongs to the lending subsystem"), "the author sees the corrected draft");
  const rounds = byClass(byClass(target, "section", "rounds")[0], "section", "round");
  assert.deepEqual(rounds.map((round) => round.getAttribute("data-number")), ["1", "2"]);
  assert.match(rounds[0].textContent, /the shelf belongs to no subsystem/);
  assert.equal(byClass(rounds[0], "span", "answer")[0].textContent, "fixed");
  assert.match(rounds[1].textContent, /no finding/);
  assert.match(byClass(target, "p", "left-count")[0].textContent, /^Left: none$/);
  assert.deepEqual(architecturePaths(fake), [], "nothing is written yet");
});

// ---------------------------------------------------------------- main flow 7

// TST-448209 · level: system · module: system
// guards: UC-022; A REUSE DECISION RECORDS ITS DUE DILIGENCE; DUE DILIGENCE IS FETCHED, NOT RECALLED; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S; A PRODUCT DECLARES ITS LICENCE
// given: the ready product, whose LICENSE is MIT; a further decision that adopts loan-lib against shelf-lib; a registry that knows loan-lib (MIT) and shelf-lib (Apache-2.0), with two releases and a month's downloads each; the repository host counting 2 open and 5 closed issues
// input: step 7 the person presses Run; the registry's requests and the due-diligence table on the page are read
// expect: the registry was asked for both packages and for their downloads; the table holds one row for the candidate chosen and one for its alternative, each with whether it exists, its licence, its first and latest release with their dates, the number of releases, the open and closed issues (2 / 5) and its adoption (1234 downloads last month), the addresses it was read from and the date it was read; beside the licences stands the product's own, MIT, and both candidates read compatible with it
test("TST-448209: UC-022 step 7 — the facts of the candidate and of its alternative are read from the registry, each with where and when, beside the product's licence", async () => {
  const seen = ready();
  const target = await derive(fakeProduct());
  for (const address of ["https://registry.npmjs.org/loan-lib", "https://registry.npmjs.org/shelf-lib", "https://api.npmjs.org/downloads/point/last-month/loan-lib", "https://api.npmjs.org/downloads/point/last-month/shelf-lib"]) {
    assert.ok(seen.registry.includes(address), `the registry was asked at ${address}`);
  }
  const section = byClass(target, "section", "due-diligence");
  assert.equal(section.length, 1, "one decision adopts a package");
  const table = find(section[0], (node) => node.localName === "table")[0];
  const rows = find(table, (node) => node.localName === "tr").map((each) => find(each, (node) => node.localName === "td" || node.localName === "th").map((cell) => cell.textContent.trim()));
  assert.deepEqual(rows[0], ["Candidate", "Licence", "Compatible with the product's licence", "First release", "Latest release", "Releases", "Open / closed issues", "Adoption", "Read from", "Read on"]);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[1].slice(0, 8), ["loan-lib (npm) - chosen", "MIT", "yes", "1.0.0 on 2024-01-01", "1.1.0 on 2025-01-01", "2", "2 / 5", "1234 downloads last month"]);
  assert.deepEqual(rows[2].slice(0, 8), ["shelf-lib (npm)", "Apache-2.0", "yes", "1.0.0 on 2024-01-01", "1.1.0 on 2025-01-01", "2", "2 / 5", "1234 downloads last month"]);
  assert.ok(rows[1][8].includes("https://registry.npmjs.org/loan-lib") && rows[2][8].includes("https://registry.npmjs.org/shelf-lib"), "each row names the address it was read from");
  assert.match(rows[1][9], /^\d{4}-\d{2}-\d{2}$/);
  assert.match(rows[2][9], /^\d{4}-\d{2}-\d{2}$/);
  assert.match(section[0].textContent, /Product licence: MIT\./);
});

// ---------------------------------------------------------------- main flow 8

// TST-448210 · level: system · module: system
// guards: UC-022; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the draft shown after Run, written nowhere
// input: step 8 the author changes the text of the system's decision in its editor; presses Check this edit; changes it again and presses Start again
// expect: the editors hold the draft's files and each can be changed; Check this edit runs the whole draft again — the reviewer is asked once more and receives the edited sentence, the drafter is not asked again since the checks find nothing — and says the edited draft was checked as a whole; Start again takes the drafted architecture off the page; nothing is written by either to docs/architecture/
test("TST-448210: UC-022 step 8 — the author may change any file, have the changed draft checked as a whole, or start the derivation again", async () => {
  const seen = ready();
  const fake = fakeProduct();
  const target = await derive(fake);
  assert.deepEqual(byClass(target, "textarea", "draft-text").map((box) => box.getAttribute("data-path")), [ARC_DRAFT, SUB_DRAFT, REUSE_DRAFT, MOD_DRAFT], "every file has its editor");
  const editor = editorOf(target, ARC_DRAFT);
  editor.value = editor.value.replace("The system is two folders.", "The system is two folders. The author added this sentence.");
  click(byClass(target, "button", "check-edit")[0]);
  await until(() => byClass(target, "p", "checked-edit").length === 1, "the checked edit");
  assert.deepEqual([seen.drafter.length, seen.reviewer.length], [1, 2], "the whole draft is checked again, by the reviewer, and the drafter is asked only if the checks find work");
  assert.ok(seen.reviewer[1].sent.includes("The author added this sentence."), "the edited sentence reaches the reviewer");
  assert.ok(!seen.reviewer[0].sent.includes("The author added this sentence."), "and was not in the first request");
  assert.match(byClass(target, "p", "checked-edit")[0].textContent, /The edited draft was checked as a whole\./);
  click(byClass(target, "button", "start-again")[0]);
  assert.equal(byClass(target, "section", "architecture-result").length, 0, "the drafted architecture is off the page");
  assert.deepEqual(architecturePaths(fake), [], "nothing is written to the architecture");
});

// ---------------------------------------------------------------- main flow 9

// TST-448211 · level: system · module: system
// guards: UC-022; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; A GENERATED ARTIFACT IS A PROPOSAL; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; ONE CLICK PER DECISION
// given: the draft shown after Run, in which the author added one sentence to the system's decision in its editor
// input: step 9 the author presses Write proposals; the commits and the files the product holds are read
// expect: one commit on the default branch main, on the head that was read, writes the four files of the architecture — the drafted ARC-900, ARC-901, ARC-902 given the next free identifiers ARC-001, ARC-002 and ARC-003 in the order drafted, MOD-lending —, the system's decision with the author's sentence, the references among them renamed with the identifiers; its message ends with the lines naming Agent M's version, the job, the kind derive-architecture, the participant drafter-a, its model model-a and the rounds; no file names the version, the job, the participant or the model; every file reads open
test("TST-448211: UC-022 step 9 — Write proposals commits the whole architecture as open files in one commit, whose message names the version, the participant and the model", async () => {
  ready();
  const fake = fakeProduct();
  const head = fake.head();
  const target = await derive(fake);
  const editor = editorOf(target, ARC_DRAFT);
  editor.value = editor.value.replace("The system is two folders.", "The system is two folders. The author kept it so.");
  await writeProposals(target);
  assert.match(byClass(target, "p", "written")[0].textContent, /^Written: docs\/architecture\/ARC-001-system\.md, docs\/architecture\/ARC-002-lending\.md, docs\/architecture\/ARC-003-the-loan-package\.md, docs\/architecture\/MOD-lending\.md$/);
  const commits = writes(fake);
  assert.equal(commits.length, 1, "one commit for the architecture");
  assert.equal(commits[0].branch, "main");
  assert.match(commits[0].expectedHead, /^[0-9a-f]{40}$/);
  assert.notEqual(commits[0].expectedHead, head, "on the head after the job's record");
  assert.deepEqual(commits[0].files.map((file) => file.path), ["docs/architecture/ARC-001-system.md", "docs/architecture/ARC-002-lending.md", "docs/architecture/ARC-003-the-loan-package.md", "docs/architecture/MOD-lending.md"]);
  assert.match(commits[0].message, /^draft ARC-001, ARC-002, ARC-003, MOD-lending as open files\n\nAgent-M-Version: .+\nAgent-M-Job: JOB-\d{8}-\d{4}-[0-9a-f]{4}\nAgent-M-Kind: derive-architecture\nAgent-M-Participant: drafter-a\nAgent-M-Model: model-a\nAgent-M-Rounds: 1$/);
  const [system, subsystem, further, module] = commits[0].files.map((file) => file.text);
  assert.match(system, /^---\nid: ARC-001\n/);
  assert.ok(system.includes("The system is two folders. The author kept it so."), "the file is written as the author left it");
  assert.match(subsystem, /^---\nid: ARC-002\ntitle: Lending\nrefines: ARC-001\n/);
  assert.match(further, /^---\nid: ARC-003\n/);
  assert.match(module, /\nfollows:\n {2}- ARC-002\n/, "the module follows the subsystem's decision under its new identifier");
  for (const file of commits[0].files) for (const forbidden of ["Agent-M-", "drafter-a", "model-a", /JOB-\d{8}-\d{4}-[0-9a-f]{4}/.exec(commits[0].message)[0], "ARC-900", "ARC-901", "ARC-902"]) assert.ok(!file.text.includes(forbidden), `${file.path} does not hold ${forbidden}`);
  for (const id of ["ARC-001", "ARC-002", "ARC-003"]) assert.equal(await badge(fake, id), "open", `${id} reads open`);
  assert.deepEqual(recordsOf(fake).filter((path) => !/\/UC-00[12]-/.test(path)), [], "no approval record was written");
});

// ---------------------------------------------------------------- main flow 10

// TST-448212 · level: system · module: system
// guards: UC-022; SEVERAL FILES ARE ACCEPTED IN ONE CLICK; ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; AN APPROVAL NAMES THE EXACT TEXT; ONE CLICK PER DECISION
// given: the four files of the architecture written open by Write proposals; the page of the whole architecture, #decision/id=all
// input: step 10 the author presses Accept all 4 shown
// expect: the page lists the decision that states the system first, then the subsystem's decision, the module file, then the further decision, with the button "Accept all 4 shown"; the click makes one commit on main holding one record per file — four, nothing else —, each naming the blob of the text shown; it names the accepting person; afterwards the four read accepted, the page shows no file, and the list of the decisions shows ARC-001 to ARC-003 accepted
test("TST-448212: UC-022 step 10 — Accept all N shown accepts the whole architecture in one commit with one record per file", async () => {
  ready();
  const fake = fakeProduct();
  await writeProposals(await derive(fake));
  const all = await show(fake, { id: "all" });
  assert.deepEqual(filesOf(all), ["ARC-001", "ARC-002", "MOD-lending", "ARC-003"]);
  assert.equal(byClass(all, "button", "accept-all")[0].textContent, "Accept all 4 shown");
  const before = fake.writes().length, shown = fake.files(), head = fake.head();
  click(byClass(all, "button", "accept-all")[0]);
  await until(() => byClass(all, "p", "nothing").length === 1, "the page drawn again");
  assert.equal(fake.writes().length, before + 1, "one commit");
  const accepted = fake.writes().at(-1);
  assert.equal(accepted.branch, "main");
  assert.equal(accepted.expectedHead, head, "on the head that was read");
  assert.deepEqual(accepted.files.map((file) => file.path.replace(/-[0-9a-f]{12}\.md$/, "")), ["docs/approvals/ARC-001", "docs/approvals/ARC-002", "docs/approvals/MOD-lending", "docs/approvals/ARC-003"], "one record per file shown, nothing else");
  const named = accepted.files.map((file) => /^blob: (\S+)$/m.exec(file.text)[1]);
  const blobs = ["docs/architecture/ARC-001-system.md", "docs/architecture/ARC-002-lending.md", "docs/architecture/MOD-lending.md", "docs/architecture/ARC-003-the-loan-package.md"]
    .map((path) => approvalOf(path, shown[path]).text.match(/^blob: (\S+)$/m)[1]);
  assert.deepEqual(named, blobs, "each record names the blob of the text shown");
  assert.match(accepted.message, /Accepted by Agent M · library\./);
  const states = [...statuses(await fake.host.readSnapshot("main"))].filter(([path]) => path.startsWith("docs/architecture/")).map(([path, status]) => [path, status.status]);
  assert.deepEqual(states, [["docs/architecture/ARC-001-system.md", "accepted"], ["docs/architecture/ARC-002-lending.md", "accepted"], ["docs/architecture/ARC-003-the-loan-package.md", "accepted"], ["docs/architecture/MOD-lending.md", "accepted"]]);
  assert.deepEqual(filesOf(await show(fake, { id: "all" })), [], "the page shows no file");
  for (const id of ["ARC-001", "ARC-002", "ARC-003"]) assert.equal(await badge(fake, id), "accepted", `${id} reads accepted`);
});

// ---------------------------------------------------------------- the postcondition

// TST-448213 · level: system · module: system
// guards: UC-022; A GENERATED ARTIFACT IS A PROPOSAL; AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT; AN ARCHITECTURE IS CHECKED BY REVIEW, NOT BY TESTS; A REUSE DECISION RECORDS ITS DUE DILIGENCE
// given: the ready product; a derivation in which the reviewer first finds one thing the drafter answers, written by Write proposals, not accepted
// input: the product's files and commits after the run; the requests each endpoint received
// expect: the product holds the four kinds of file as open files — the decision that states the system, the subsystem's decision, the further decision and the module file — and no approval record names any of them; the draft was checked once complete by a participant that received the entire project — the whole SPEC, both use cases —, and its finding stands in the job's record with the drafter's answer, the findings left none; the page and the commits made no call to a test or CI run: the only commits are the job's record (twice) and the architecture, no workflow or test file was written and no other origin was called; the further decision's due diligence names where and when each fact was read
test("TST-448213: UC-022 postcondition — the first architecture stands as open files, checked as a whole, without a test or CI run, and its reuse decision carries a due diligence", async () => {
  const seen = endpoints({ drafter: [reply(draftOf()), reply(draftOf(), [{ finding: lineOf(SYSTEM_FINDING), how: "answered", text: "the system's decision names the shelf" }])],
    reviewer: [reply({ findings: [SYSTEM_FINDING] }), reply({ findings: [] })], registry: REG });
  const fake = fakeProduct();
  await writeProposals(await derive(fake));
  const states = [...statuses(await fake.host.readSnapshot("main"))].filter(([path]) => path.startsWith("docs/architecture/"));
  assert.deepEqual(states.map(([path, status]) => [path, status.status]), [["docs/architecture/ARC-001-system.md", "open"], ["docs/architecture/ARC-002-lending.md", "open"], ["docs/architecture/ARC-003-the-loan-package.md", "open"], ["docs/architecture/MOD-lending.md", "open"]]);
  assert.ok(seen.reviewer[0].sent.includes("Every book stands on a shelf.") && seen.reviewer[0].sent.includes(UC1.trim()) && seen.reviewer[0].sent.includes(UC2.trim()), "the reviewer received the entire project");
  const record = jobRecord(fake).text;
  assert.match(record, /### Round 1 — 1 finding\n- docs\/architecture\/ARC-900-system\.md:9: warning: the shelf belongs to no subsystem[^\n]*\n {2}- answered: the system's decision names the shelf/);
  assert.match(record, /Left: none · stopped because: passed · limit: 5/);
  const paths = fake.writes().flatMap((change) => change.files.map((file) => file.path));
  assert.ok(paths.every((path) => /^docs\/(jobs|architecture)\//.test(path)), `only the record and the architecture are written: ${paths.join(", ")}`);
  assert.ok(!paths.some((path) => path.startsWith(".github/") || /\.test\./.test(path)), "no workflow and no test file");
  assert.deepEqual(seen.outside, [], "no other origin was called");
  const further = fake.files()["docs/architecture/ARC-003-the-loan-package.md"];
  assert.match(further, /## Due diligence\n[^]*\| loan-lib \(npm\) - chosen \| MIT \| yes \|[^\n]*\| https:\/\/registry\.npmjs\.org\/loan-lib[^\n]* \| \d{4}-\d{2}-\d{2} \|/);
});

// ---------------------------------------------------------------- 1a, 1b, 1c

// TST-448214 · level: system · module: system
// guards: UC-022; ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES
// given: a product whose UC-002 has no approval record (UC-001 accepted); the same product once UC-002's record is committed
// input: 1a the person opens the drafting page; chooses drafter-a and reviewer-b and shows the run panel; then opens the page again after the record
// expect: an error finding names UC-002 and not UC-001 under the rule ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES and its correction names UC-008, with a link Review UC-002 to the review page of that use case in the product; the panel lists the finding as blocking and offers no Run; nothing is sent and nothing is written; counter-proof — once the record names UC-002's text, the page finds nothing and the panel offers Run
test("TST-448214: UC-022 1a — an open use case is named with the way to its review, and nothing is derived until it is accepted", async () => {
  const seen = ready();
  const fake = fakeProduct(without(READY, "docs/approvals/UC-002"));
  const target = await show(fake);
  const found = byClass(target, "p", "finding");
  assert.equal(found.length, 1);
  assert.ok(found[0].className.split(" ").includes("error"));
  assert.match(found[0].textContent, /UC-002/);
  assert.ok(!/UC-001/.test(found[0].textContent), "the accepted use case is not named");
  assert.match(found[0].textContent, /\(UC-008\)/);
  assert.match(found[0].textContent, /\[ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES\]/);
  const links = find(target, (node) => node.localName === "a" && node.textContent === "Review UC-002");
  assert.deepEqual(links.map((link) => link.getAttribute("href")), [`#use-case/id=UC-002/product=${encodeURIComponent("https://github.com/alice/library")}`]);
  const panel = await panelFor(target);
  assert.equal(runButtons(panel).length, 0, "no Run");
  assert.match(byClass(panel, "li", "blocking")[0].textContent, /UC-002/);
  assert.equal(seen.drafter.length + seen.reviewer.length, 0, "nothing sent");
  assert.equal(fake.writes().length, 0, "nothing written");

  fake.land({ [approvalOf(UC2_PATH, UC2).path]: approvalOf(UC2_PATH, UC2).text });
  const accepted = await show(fake);
  assert.deepEqual(byClass(accepted, "p", "finding"), [], "counter-proof: nothing is found once UC-002 is accepted");
  assert.equal(runButtons(await panelFor(accepted)).length, 1, "and Run is offered");
});

// TST-448215 · level: system · module: system
// guards: UC-022; THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE
// given: a product whose change queue holds an entry for A NEW RULE that no record decides; the ready product's use cases accepted
// input: 1b the person opens the page, shows the panel for drafter-a and reviewer-b, and presses Run
// expect: a warning finding names the entry's proposal and says that the architecture is derived from the SPEC as it stands, with a link to the SPEC changes (#spec-entry) to decide them first; the panel still offers Run; after Run the drafter's request holds the SPEC as it stands, A LOAN HAS A DUE DATE and A BOOK IS SHELVED, and nothing of the open entry, A NEW RULE
test("TST-448215: UC-022 1b — an open SPEC change is named with the choice to decide it first, and the architecture is derived from the SPEC as it stands", async () => {
  const seen = ready();
  const entry = `${QUEUE}/01-a-rule.md`;
  const fake = fakeProduct({ ...READY, [`${QUEUE}/index.md`]: text("# SPEC approvals — queue lending", "", "| Nr | Datei |", "|---|---|", "| 01 | `SPEC.md` |"), [entry]: text("**A NEW RULE** *(Product Owner)*", "A rule.") });
  const target = await show(fake);
  const found = byClass(target, "p", "finding")[0];
  assert.ok(found.className.split(" ").includes("warning"));
  assert.ok(found.textContent.includes(entry), found.textContent);
  assert.match(found.textContent, /the architecture is derived from the SPEC as it stands/);
  assert.deepEqual(find(target, (node) => node.localName === "a" && node.className.split(" ").includes("decide-first")).map((link) => link.getAttribute("href")), [`#spec-entry/product=${encodeURIComponent("https://github.com/alice/library")}`]);
  const panel = await panelFor(target);
  assert.equal(runButtons(panel).length, 1, "Run is offered");
  await run(target);
  assert.equal(seen.drafter.length, 1);
  assert.ok(seen.drafter[0].sent.includes("Every loan states the date by which the book is returned.") && seen.drafter[0].sent.includes("Every book stands on a shelf."), "the SPEC as it stands");
  assert.ok(!seen.drafter[0].sent.includes("A NEW RULE"), "nothing of the open entry");
});

// TST-448216 · level: system · module: system
// guards: UC-022; THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE
// given: a product that holds an architecture decision already, ARC-001
// input: 1c the person opens the page, chooses drafter-a and reviewer-b and shows the panel
// expect: an error finding says the product has an architecture already and that a first one is not drafted beside it, with a link naming UC-023 to the list of the decisions, from which one is changed; the panel offers no Run; nothing is sent, nothing is written
test("TST-448216: UC-022 1c — an existing architecture leads to UC-023, and no first architecture is drafted beside it", async () => {
  const seen = ready();
  const fake = fakeProduct({ ...READY, "docs/architecture/ARC-001-system.md": text("---", "id: ARC-001", "title: System", "---", "# ARC-001 System") });
  const target = await show(fake);
  const found = byClass(target, "p", "finding")[0];
  assert.ok(found.className.split(" ").includes("error"));
  assert.match(found.textContent, /the product has an architecture already: a first architecture is not drafted beside it/);
  const leading = find(target, (node) => node.localName === "a" && node.className.split(" ").includes("change-architecture"));
  assert.deepEqual(leading.map((link) => [link.textContent, link.getAttribute("href")]), [["Change the architecture (UC-023)", `#decision/product=${encodeURIComponent("https://github.com/alice/library")}`]]);
  const panel = await panelFor(target);
  assert.equal(runButtons(panel).length, 0, "no Run");
  assert.equal(seen.drafter.length + seen.reviewer.length, 0, "nothing sent");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// ---------------------------------------------------------------- 2a, 3a, 4a

// TST-448217 · level: system · module: system
// guards: UC-022; NO REVIEWER IS THE DRAFTER
// given: three instances: (a) whose list holds drafter-a and a person; (b) drafter-a and twin-a, which use the same model; (c) drafter-a and far-c, with a product that links the restricted source SRC-secret whose entry permits "this machine" only; and, as a counter-proof, the full list
// input: 2a the person chooses drafter-a on the page of each and shows the run panel
// expect: no reviewer is offered and a paragraph names the reason — (a) no participant other than drafter-a can draft text, (b) no other participant that can draft text uses another model, (c) no participant of another model processes data at a place SRC-secret permits —; the panel lists NO REVIEWER IS THE DRAFTER as blocking and offers no Run; nothing is sent; counter-proof — with the full list, reviewer-b is offered and the panel offers Run
test("TST-448217: UC-022 2a — when no participant qualifies as reviewer, Run stays off and names the reason", async () => {
  const seen = ready();
  const cases = [
    [registerOf(DRAFTER_ROW, READER_ROW), READY, {}, /No participant other than drafter-a can draft text, so none can review its draft\./],
    [registerOf(DRAFTER_ROW, TWIN_ROW, READER_ROW), READY, {}, /No other participant that can draft text uses another model than model-a\./],
    [registerOf(DRAFTER_ROW, FAR_ROW, READER_ROW), { ...READY, "docs/sources.md": SECRET_LINK }, { "docs/sources/SRC-secret.md": SECRET_ENTRY }, /No participant that uses another model than drafter-a processes data at a place that SRC-secret permit\./],
  ];
  for (const [register, files, entries, reason] of cases) {
    const target = await show(fakeProduct(files), { id: "draft" }, { register, entries });
    choose(target, "participant", "drafter-a");
    assert.deepEqual(participantNames(target, "reviewer"), []);
    assert.match(byClass(target, "p", "no-reviewer")[0].textContent, reason);
    click(byClass(target, "button", "prepare")[0]);
    await until(() => byClass(target, "section", "run-panel").length === 1, "the run panel");
    const panel = byClass(target, "section", "run-panel")[0];
    assert.equal(runButtons(panel).length, 0, "no Run");
    assert.match(byClass(panel, "li", "blocking")[0].textContent, /\[NO REVIEWER IS THE DRAFTER\]/);
  }
  assert.equal(seen.drafter.length + seen.reviewer.length, 0, "nothing sent");
  const full = await show(fakeProduct());
  choose(full, "participant", "drafter-a");
  assert.ok(participantNames(full, "reviewer").includes("reviewer-b"), "counter-proof: a reviewer of another model is offered");
  assert.equal(runButtons(await panelFor(full)).length, 1, "and Run is offered");
});

// TST-448218 · level: system · module: system
// guards: UC-022; NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY
// given: the ready product; small-d, whose context holds 50000 tokens, and drafter-a, whose context holds 300000
// input: 3a the person chooses small-d as drafter with reviewer-b and shows the panel; then small-d as reviewer of drafter-a; then drafter-a again
// expect: the panel names small-d as unable to hold what it would receive, with the size, 88211 tokens, and its context, 50000, and lists all seven parts for it — none left out —; it offers no Run; as reviewer small-d is named the same way; nothing is sent and nothing is written; counter-proof — drafter-a, still choosable on the same page, gives a panel that names nothing as not fitting and offers Run
test("TST-448218: UC-022 3a — a participant whose context cannot hold the input is named with the sizes, nothing is truncated or sent, and a larger one is choosable", async () => {
  const seen = ready();
  const fake = fakeProduct();
  const target = await show(fake);
  const panel = await panelFor(target, "small-d", "reviewer-b");
  const notFitting = byClass(panel, "p", "not-fitting");
  assert.deepEqual(notFitting.map((node) => node.textContent), ["small-d cannot hold what it would receive: 88211 tokens, its context holds 50000"]);
  assert.deepEqual(byClass(byClass(panel, "section", "destination")[0], "li", "part").map((item) => item.textContent.split(" — ")[0]), ["SPEC.md", UC1_PATH, UC2_PATH, ...CHAPTERS], "no part is left out");
  assert.equal(runButtons(target).length, 0, "no Run");
  const asReviewer = await panelFor(target, "drafter-a", "small-d");
  assert.deepEqual(byClass(asReviewer, "p", "not-fitting").map((node) => node.textContent.split(" cannot")[0]), ["small-d"], "the same holds for the reviewer");
  assert.equal(runButtons(target).length, 0, "no Run");
  assert.equal(seen.drafter.length + seen.reviewer.length, 0, "nothing sent");
  assert.equal(fake.writes().length, 0, "nothing written");
  const larger = await panelFor(target, "drafter-a", "reviewer-b");
  assert.deepEqual(byClass(larger, "p", "not-fitting"), [], "counter-proof: a participant with a larger context fits");
  assert.equal(runButtons(larger).length, 1, "and Run is offered");
});

// TST-448219 · level: system · module: system
// guards: UC-022; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK; ONE CLICK PER DECISION
// given: the ready product; the drafting page with drafter-a and reviewer-b chosen and the panel shown
// input: 4a the author does not press Run: the page is left as it is, and then the other buttons of the page are looked at
// expect: nothing is sent to either endpoint and nothing is written to the product, the job's record included; no job record exists; the panel's Run is still the one button that starts the job
test("TST-448219: UC-022 4a — without the click on Run nothing is sent and nothing is written", async () => {
  const seen = ready();
  const fake = fakeProduct();
  const target = await show(fake);
  await panelFor(target);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(seen.drafter.length + seen.reviewer.length + seen.registry.length, 0, "nothing sent");
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(jobRecord(fake).path, undefined, "no job record exists");
  assert.equal(runButtons(target).length, 1, "Run is the one button that starts the job");
});

// ---------------------------------------------------------------- 5a, 6a, 6b, 6c

// TST-448220 · level: system · module: system
// guards: UC-022; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; EVERY ARTIFACT NAMES ITS ORIGIN; A FINDING READS LIKE A COMPILER MESSAGE
// given: the ready product; a drafter whose first draft lets the system's decision be forced by a requirement A MADE UP RULE and by a use case UC-099, and whose second draft is the corrected one
// input: 5a the person presses Run; the requests and what the product holds are read; the author writes the proposals
// expect: the second request to the drafter carries two findings in the compiler's form under the rule EVERY ARTIFACT NAMES ITS ORIGIN, one naming A MADE UP RULE and one naming UC-099, both as errors that match no requirement or use case; the reviewer is asked in each round; the draft the author sees names neither; after Write proposals no file but the job's record, which holds the findings, holds either name and SPEC.md is as it was — Agent M invented no requirement
test("TST-448220: UC-022 5a — a draft that names a requirement or use case that does not exist goes back, and Agent M invents none", async () => {
  const bad = draftOf({ system: { forced: ["A MADE UP RULE", "UC-099", LOAN] } });
  const seen = endpoints({ drafter: [reply(bad), reply(draftOf())], reviewer: [reply({ findings: [] })], registry: REG });
  const fake = fakeProduct();
  const target = await derive(fake);
  assert.equal(seen.drafter.length, 2, "the drafter is asked again");
  assert.equal(seen.reviewer.length, 2, "and the reviewer in each round");
  const found = findingsOf(seen.drafter[1]);
  assert.equal(found.length, 2, found.join("\n"));
  for (const each of found) {
    assert.match(each, COMPILER);
    assert.match(each, /^ARC-900:\d+: error: forced_by "[^"]+" matches no requirement or use case \[EVERY ARTIFACT NAMES ITS ORIGIN\]/);
  }
  assert.ok(found.some((each) => each.includes('"A MADE UP RULE"')) && found.some((each) => each.includes('"UC-099"')));
  assert.ok(!editorOf(target, ARC_DRAFT).value.includes("A MADE UP RULE") && !editorOf(target, ARC_DRAFT).value.includes("UC-099"), "the author sees the corrected draft");
  await writeProposals(target);
  assert.ok(!Object.entries(fake.files()).some(([path, body]) => !path.startsWith("docs/jobs/") && (body.includes("A MADE UP RULE") || body.includes("UC-099"))), "no file but the job's record, which holds the findings, holds either name");
  assert.equal(fake.files()["SPEC.md"], SPEC, "the SPEC is as it was");
});

// TST-448221 · level: system · module: system
// guards: UC-022; THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN; A FINDING READS LIKE A COMPILER MESSAGE
// given: the ready product; a reviewer that finds the same thing in every round, which the drafter does not correct
// input: 6a the person presses Run; the page is read; the author presses Write proposals all the same
// expect: the loop ends at the second round, which leaves the finding as it was (stopped because: unchanged); the page shows the draft with the list of findings left — one finding in the compiler's form, as a warning —, Left: 1 finding, the rounds with the finding in each, and the buttons to write it, change it (Check this edit, the editors) and start again; Write proposals writes the architecture with the finding left
test("TST-448221: UC-022 6a — findings left after the last round are shown in the compiler's form, and the author may write, change or start again", async () => {
  const seen = endpoints({ drafter: [reply(draftOf())], reviewer: [reply({ findings: [SYSTEM_FINDING] })], registry: REG });
  const fake = fakeProduct();
  const target = await derive(fake);
  assert.deepEqual([seen.drafter.length, seen.reviewer.length], [2, 2], "asked twice: the second round leaves the finding as it was");
  const left = byClass(byClass(target, "section", "architecture-result")[0], "ul", "left")[0];
  assert.deepEqual(find(left, (node) => node.localName === "li").map((item) => item.textContent), [lineOf(SYSTEM_FINDING).replace(/\.$/, "")]);
  assert.match(lineOf(SYSTEM_FINDING), COMPILER);
  assert.ok(find(left, (node) => node.localName === "li")[0].className.split(" ").includes("warning"), "a warning");
  assert.match(byClass(target, "p", "left-count")[0].textContent, /^Left: 1 finding$/);
  assert.equal(byClass(target, "section", "round").length, 2);
  for (const name of ["write-proposals", "check-edit", "start-again"]) assert.equal(byClass(target, "button", name).length, 1, `${name} is offered`);
  await writeProposals(target);
  assert.equal(writes(fake).length, 1, "the author wrote it all the same");
  assert.match(jobRecord(fake).text, /Left: 1 finding · stopped because: unchanged · limit: 5/);
});

// TST-448222 · level: system · module: system
// guards: UC-022; AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT; THE CORRECTION LOOP HAS A FIXED LIMIT
// given: the ready product; (a) a reviewer whose answers can never be read; (b) a reviewer whose first answer cannot be read and whose second can, finding nothing
// input: 6b the person presses Run for each; the requests, the page and the job's record are read
// expect: (a) the reviewer is asked again within the round limit, five times, the drafter only once; the draft is shown marked not checked — "The draft is not checked because a reviewer answer could not be read." —, and the job's record ends stopped because: not checked; (b) counter-proof — the reviewer is asked twice, the drafter once, nothing is marked not checked and the record says stopped because: passed
test("TST-448222: UC-022 6b — a reviewer's answer that cannot be read counts as a check not done: it is asked again within the limit, and else the draft is shown not checked", async () => {
  const never = endpoints({ drafter: [reply(draftOf())], reviewer: [{ not: "an envelope" }], registry: REG });
  const fake = fakeProduct();
  const target = await derive(fake);
  assert.deepEqual([never.drafter.length, never.reviewer.length], [1, 5], "asked again within the limit, without the drafter");
  assert.deepEqual(byClass(target, "p", "not-checked").map((node) => node.textContent), ["The draft is not checked because a reviewer answer could not be read."]);
  assert.match(jobRecord(fake).text, /stopped because: not checked · limit: 5/);

  const later = endpoints({ drafter: [reply(draftOf())], reviewer: [{ not: "an envelope" }, reply({ findings: [] })], registry: REG });
  const other = fakeProduct();
  const second = await derive(other);
  assert.deepEqual([later.drafter.length, later.reviewer.length], [1, 2], "counter-proof: a readable answer ends the asking");
  assert.deepEqual(byClass(second, "p", "not-checked"), []);
  assert.match(jobRecord(other).text, /stopped because: passed · limit: 5/);
});

// TST-448223 · level: system · module: system
// guards: UC-022; A REVIEW FINDING IS WEIGHED BEFORE IT IS ACTED ON; A REVIEWER'S FINDING IS A WARNING
// given: the ready product; a reviewer whose finding the drafter does not correct but answers with the reason that the system's decision already names the shelf
// input: 6c the person presses Run; the rounds on the page and the job's record are read
// expect: the finding and the drafter's answer, "answered: …" with its reason, stand side by side in the first round's list of the page; the answered finding is settled: the loop ends passed, Left: none; the record holds the answer beneath the finding
test("TST-448223: UC-022 6c — a finding the drafter answers instead of correcting stands beside its answer, and the author decides which holds", async () => {
  ready();
  const answered = [{ finding: lineOf(SYSTEM_FINDING), how: "answered", text: "the system's decision names the shelf in its context" }];
  const seen = endpoints({ drafter: [reply(draftOf()), reply(draftOf(), answered)], reviewer: [reply({ findings: [SYSTEM_FINDING] })], registry: REG });
  const fake = fakeProduct();
  const target = await derive(fake);
  assert.equal(seen.drafter.length, 2);
  const first = byClass(byClass(target, "section", "round")[0], "li", "finding")[0];
  assert.match(first.textContent, /the shelf belongs to no subsystem/);
  assert.equal(byClass(first, "span", "answer")[0].textContent, "answered: the system's decision names the shelf in its context", "the answer stands beside the finding");
  assert.match(byClass(target, "p", "left-count")[0].textContent, /^Left: none$/);
  assert.match(jobRecord(fake).text, /\[A SUBSYSTEM IS CHECKED AGAINST THE SYSTEM\] — [^\n]*\n {2}- answered: the system's decision names the shelf in its context/);
});

// ---------------------------------------------------------------- 7a, 7b, 7c, 7d

// TST-448224 · level: system · module: system
// guards: UC-022; DUE DILIGENCE IS FETCHED, NOT RECALLED; A REUSE DECISION RECORDS ITS DUE DILIGENCE
// given: the ready product; a further decision that chooses missing-lib, a package its registry does not know, against shelf-lib
// input: 7a the person presses Run; the table, the findings of the steps and Write proposals are read
// expect: known positive — the registry answered 404 for missing-lib at https://registry.npmjs.org/missing-lib; its row says "not found - the name may be invented", does not claim a licence or a release, and holds that address under "Read from" and the date; a warning under DUE DILIGENCE IS FETCHED, NOT RECALLED names missing-lib and the address; the candidate that exists, shelf-lib, has its facts; the warning does not block Write proposals
test("TST-448224: UC-022 7a — a candidate that its registry does not know is listed as not found, with the address that was queried", async () => {
  endpoints({ drafter: [reply(draftOf({ candidate: "missing-lib" }))], reviewer: [reply({ findings: [] })], registry: registryOf(["shelf-lib", "Apache-2.0"]) });
  const fake = fakeProduct();
  const target = await derive(fake);
  const rows = find(byClass(target, "section", "due-diligence")[0], (node) => node.localName === "tr").map((each) => find(each, (node) => node.localName === "td").map((cell) => cell.textContent.trim())).filter((cells) => cells.length);
  assert.equal(rows.length, 2, "known positive: both candidates have a row");
  assert.equal(rows[0][0], "missing-lib (npm) - chosen");
  assert.match(rows[0][1], /^not found - the name may be invented$/);
  assert.deepEqual(rows[0].slice(3, 8), ["-", "-", "-", "-", "-"], "no release, no issue count, no adoption is claimed");
  assert.equal(rows[0][8], "https://registry.npmjs.org/missing-lib", "the address that was queried");
  assert.match(rows[0][9], /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(rows[1][0], "shelf-lib (npm)");
  assert.equal(rows[1][1], "Apache-2.0");
  const warnings = byClass(target, "ul", "step-findings")[0];
  assert.deepEqual(find(warnings, (node) => node.localName === "li").map((item) => item.textContent),
    ["docs/architecture/ARC-902-the-loan-package.md:20: warning: missing-lib was not found at https://registry.npmjs.org/missing-lib [DUE DILIGENCE IS FETCHED, NOT RECALLED] — check the candidate's name or choose another candidate"]);
  await writeProposals(target);
  assert.equal(writes(fake).length, 1, "the warning does not block the write");
});

// TST-448225 · level: system · module: system
// guards: UC-022; A REUSE DECISION RECORDS ITS DUE DILIGENCE
// given: the ready product; a further decision that chooses blocked-lib, whose registry the browser cannot call (the fetch fails); (a) a product with the job workflow and a CI agent; (b) a product without
// input: 7b the person presses Run; the findings of the steps and the decision's editor are read; the author presses Write proposals
// expect: the registry npm is named with the address that could not be read and the reason, as an error under A REUSE DECISION RECORDS ITS DUE DILIGENCE; the decision is shown without a due-diligence section; Write proposals writes nothing — no file of docs/architecture/ — and says the due diligence is missing for that decision, naming the registry; (a) it names the CI route and the CI agent that would fetch the facts, (b) it says a participant that can reach the web would
test("TST-448225: UC-022 7b — a registry that cannot be read from the browser is named, the decision is shown without due diligence, and it cannot be written", async () => {
  for (const [files, register, offered] of [[{ ...READY, [WORKFLOW]: "name: Agent M jobs\n" }, REGISTER, /Try ci hosted with ci-agent\.$/], [READY, registerOf(DRAFTER_ROW, REVIEWER_ROW, READER_ROW), /Try a participant that can reach the web\.$/]]) {
    endpoints({ drafter: [reply(draftOf({ candidate: "blocked-lib" }))], reviewer: [reply({ findings: [] })], registry: { "https://registry.npmjs.org/blocked-lib": new TypeError("Failed to fetch"), ...registryOf(["shelf-lib", "MIT"]) } });
    const fake = fakeProduct(files);
    const target = await derive(fake, { options: { register } });
    assert.deepEqual(find(byClass(target, "ul", "step-findings")[0], (node) => node.localName === "li").map((item) => item.textContent),
      ["docs/architecture/ARC-902-the-loan-package.md:20: error: the registry npm could not be read at https://registry.npmjs.org/blocked-lib: Failed to fetch [A REUSE DECISION RECORDS ITS DUE DILIGENCE] — fetch the facts through a participant that can reach the web"]);
    assert.ok(!editorOf(target, REUSE_DRAFT).value.includes("## Due diligence"), "the decision is shown without due diligence");
    await writeProposals(target);
    assert.equal(writes(fake).length, 0, "nothing of the architecture is written");
    assert.match(byClass(target, "p", "due-diligence-missing")[0].textContent, /^The due diligence is missing for docs\/architecture\/ARC-902-the-loan-package\.md; nothing was written\. Registry: npm\./);
    assert.match(byClass(target, "p", "due-diligence-missing")[0].textContent, offered);
  }
});

// TST-448226 · level: system · module: system
// guards: UC-022; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S; DUE DILIGENCE IS FETCHED, NOT RECALLED
// given: the ready product, whose LICENSE is MIT; (a) a candidate under GPL-3.0 against one under MIT; (b) a candidate whose registry record has no licence against one whose licence is "SEE LICENSE IN LICENSE.txt"
// input: 7c the person presses Run for each; the rows of the due-diligence table are read
// expect: (a) the GPL-3.0 candidate's row says it is not known to be compatible with the product's licence and the MIT candidate's says yes; (b) the row of the candidate without a licence shows no licence and says the compatibility is not checked, and the row of the unknown licence says it is not known to be compatible; the product's licence stands beside the table; the author decides — Write proposals still writes
test("TST-448226: UC-022 7c — a licence that is restrictive, unknown or missing is said so in the candidate's row", async () => {
  const cells = (target) => find(byClass(target, "section", "due-diligence")[0], (node) => node.localName === "tr").map((each) => find(each, (node) => node.localName === "td").map((cell) => cell.textContent.trim())).filter((row) => row.length);
  endpoints({ drafter: [reply(draftOf({ candidate: "gpl-lib" }))], reviewer: [reply({ findings: [] })], registry: registryOf(["gpl-lib", "GPL-3.0"], ["shelf-lib", "MIT"]) });
  const fake = fakeProduct();
  const first = await derive(fake);
  assert.deepEqual(cells(first).map((row) => [row[0], row[1], row[2]]), [["gpl-lib (npm) - chosen", "GPL-3.0", "not known to be compatible"], ["shelf-lib (npm)", "MIT", "yes"]]);
  assert.match(byClass(first, "section", "due-diligence")[0].textContent, /Product licence: MIT\./);
  await writeProposals(first);
  assert.equal(writes(fake).length, 1, "the author decides, and writes");

  const record = (licence) => ({ ...(licence === undefined ? {} : { license: licence }), repository: { url: "https://github.com/alice/loan-lib" }, "dist-tags": { latest: "1.1.0" }, versions: { "1.0.0": {}, "1.1.0": {} },
    time: { "1.0.0": "2024-01-01T00:00:00.000Z", "1.1.0": "2025-01-01T00:00:00.000Z" } });
  endpoints({ drafter: [reply(draftOf())], reviewer: [reply({ findings: [] })], registry: { "https://registry.npmjs.org/loan-lib": record(undefined), "https://registry.npmjs.org/shelf-lib": record("SEE LICENSE IN LICENSE.txt") } });
  const second = await derive(fakeProduct());
  assert.deepEqual(cells(second).map((row) => [row[0], row[1], row[2]]), [["loan-lib (npm) - chosen", "-", "not checked"], ["shelf-lib (npm)", "SEE LICENSE IN LICENSE.txt", "not known to be compatible"]]);
});

// TST-448227 · level: system · module: system
// guards: UC-022; A PRODUCT DECLARES ITS LICENCE; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S
// given: a product with no LICENSE file; a candidate under MIT and an alternative under Apache-2.0
// input: 7d the person presses Run; the due-diligence section is read; the author presses Write proposals
// expect: the section says No product LICENSE was found and that the product's licence decides what it may reuse; every candidate's compatibility reads not checked, though their own licences are read; Write proposals writes the architecture and no LICENSE file — the author adds it by a commit of their own
test("TST-448227: UC-022 7d — a product without a LICENSE file has every candidate's licence marked not checked, and the panel says why", async () => {
  ready();
  const fake = fakeProduct(without(READY, "LICENSE"));
  const target = await derive(fake);
  const section = byClass(target, "section", "due-diligence")[0];
  assert.match(NORMALISED(section), /No product LICENSE was found; the product's licence decides what it may reuse\./);
  const rows = find(section, (node) => node.localName === "tr").map((each) => find(each, (node) => node.localName === "td").map((cell) => cell.textContent.trim())).filter((row) => row.length);
  assert.deepEqual(rows.map((row) => [row[0], row[1], row[2]]), [["loan-lib (npm) - chosen", "MIT", "not checked"], ["shelf-lib (npm)", "Apache-2.0", "not checked"]]);
  await writeProposals(target);
  assert.equal(writes(fake).length, 1);
  assert.ok(!("LICENSE" in fake.files()), "no LICENSE file is written");
});

// ---------------------------------------------------------------- 10a

// TST-448228 · level: system · module: system
// guards: UC-022; ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; SEVERAL FILES ARE ACCEPTED IN ONE CLICK
// given: the architecture written open; then UC-002, which ARC-001 names, changed on the default branch so that its record no longer names its text
// input: 10a the author opens the page of the whole architecture and presses Accept all
// expect: ARC-001 is shown with a section that names UC-002 as what is not accepted; the click makes one commit with the records of the other three files — ARC-002, MOD-lending, ARC-003 — and none for ARC-001; the message of the page names ARC-001 as left out because it rests on what is not accepted, and UC-002; ARC-001 still reads open, and the page shows it, alone, with Accept all 1 shown
test("TST-448228: UC-022 10a — a file that names a use case that is not accepted is shown, left out of the acceptance, and named with what is still open", async () => {
  ready();
  const fake = fakeProduct();
  await writeProposals(await derive(fake));
  fake.land({ [UC2_PATH]: UC2.replace("Shelve a book.", "Shelve a book at once.") });
  const all = await show(fake, { id: "all" });
  assert.deepEqual(filesOf(all), ["ARC-001", "ARC-002", "MOD-lending", "ARC-003"]);
  assert.deepEqual(byClass(fileOf(all, "ARC-001"), "li", "open-name").map((item) => item.textContent), ["UC-002"], "the file names what is not accepted");
  click(byClass(all, "button", "accept-all")[0]);
  await until(() => byClass(all, "p", "result").length === 1, "the message");
  const accepted = fake.writes().at(-1);
  assert.deepEqual(accepted.files.map((file) => file.path.replace(/-[0-9a-f]{12}\.md$/, "")), ["docs/approvals/ARC-002", "docs/approvals/MOD-lending", "docs/approvals/ARC-003"]);
  assert.match(byClass(all, "p", "result")[0].textContent, /ARC-001 was left out: rests on what is not accepted \(UC-002\)\./);
  assert.equal(await badge(fake, "ARC-001"), "open");
  const again = await show(fake, { id: "all" });
  assert.deepEqual(filesOf(again), ["ARC-001"]);
  assert.equal(byClass(again, "button", "accept-all")[0].textContent, "Accept all 1 shown");
});

// ---------------------------------------------------------------- what UC-022 asks and the pages do not do yet

// TST-448229 · level: system · module: system
// guards: UC-022; WHAT A PERSON DECIDES IS NOT SENT BACK
// given: the ready product; a reviewer that finds that the requirement A BOOK IS SHELVED cannot be kept by the architecture, under the rule A CONFLICT IS DECIDED BY A PERSON, which the kind leaves to the person
// input: step 6 the person presses Run; the requests and the page that shows the draft are read
// expect: known positive — the finding is not sent back: the drafter is asked once, the reviewer once, and the job's record holds it under "For a person:"; the finding is shown to the author on the page that shows the draft, with the file and line, in the compiler's form
test("TST-448229: UC-022 6 — a finding that only the author can decide is not sent back but shown to the author", async () => {
  const conflict = { artifact: ARC_DRAFT, line: 9, rule: "A CONFLICT IS DECIDED BY A PERSON", what: "the requirement A BOOK IS SHELVED cannot be kept by this architecture", fix: "the author decides whether to keep the requirement" };
  const seen = endpoints({ drafter: [reply(draftOf())], reviewer: [reply({ findings: [conflict] })], registry: REG });
  const fake = fakeProduct();
  const target = await derive(fake);
  assert.deepEqual([seen.drafter.length, seen.reviewer.length], [1, 1], "known positive: the finding is not sent back");
  assert.match(jobRecord(fake).text, /For a person:\n- docs\/architecture\/ARC-900-system\.md:9: warning: the requirement A BOOK IS SHELVED cannot be kept by this architecture \[A CONFLICT IS DECIDED BY A PERSON\]/, "known positive: the record holds it for a person");
  assert.ok(NORMALISED(byClass(target, "section", "architecture-result")[0]).includes(`${ARC_DRAFT}:9: warning: the requirement A BOOK IS SHELVED cannot be kept by this architecture [A CONFLICT IS DECIDED BY A PERSON] — the author decides whether to keep the requirement`),
    "the author is shown it");
});

// TST-448230 · level: system · module: system
// guards: UC-022; A REUSE DECISION RECORDS ITS DUE DILIGENCE
// given: the ready product; the draft shown after Run, whose reuse decision chooses loan-lib against shelf-lib, each offered as a choice
// input: step 8 the author picks shelf-lib among the choices of the reuse decision, and presses Write proposals
// expect: known positive — the decision offers both candidates as choices; the decision written names shelf-lib as the chosen candidate and loan-lib as an alternative
test("TST-448230: UC-022 8 — the author may pick a different alternative for a reuse decision", async () => {
  ready();
  const fake = fakeProduct();
  const target = await derive(fake);
  const choices = byClass(target, "input", "reuse-candidate");
  assert.deepEqual(choices.map((box) => box.value), ["loan-lib (npm) - chosen", "shelf-lib (npm)"], "known positive: both candidates are choices");
  const other = choices.find((box) => box.value === "shelf-lib (npm)");
  other.checked = true;
  other.dispatchEvent(new Event("change"));
  await writeProposals(target);
  const written = fake.files()["docs/architecture/ARC-003-the-loan-package.md"];
  assert.match(written, /\| shelf-lib \| npm \|[^\n]*\| chosen \|/, "shelf-lib is the chosen candidate");
  assert.doesNotMatch(written, /\| loan-lib \| npm \|[^\n]*\| chosen \|/, "loan-lib is not");
});

// TST-448231 · level: system · module: system
// guards: UC-022; DUE DILIGENCE IS FETCHED, NOT RECALLED
// given: the ready product; a further decision that chooses missing-lib, which its registry does not know, against shelf-lib
// input: 7a the person presses Run; the choices the page offers for the reuse decision are read
// expect: known positive — the candidate that exists, shelf-lib, is offered as a choice; missing-lib, "not found — the name may be invented", is not proposed: it is not among the choices
test("TST-448231: UC-022 7a — a candidate that is not found is not proposed", async () => {
  endpoints({ drafter: [reply(draftOf({ candidate: "missing-lib" }))], reviewer: [reply({ findings: [] })], registry: registryOf(["shelf-lib", "Apache-2.0"]) });
  const target = await derive(fakeProduct());
  const choices = byClass(target, "input", "reuse-candidate").map((box) => box.value);
  assert.ok(choices.includes("shelf-lib (npm)"), "known positive: the candidate that exists is offered");
  assert.ok(!choices.some((value) => value.startsWith("missing-lib")), `missing-lib is not proposed: ${choices.join(", ")}`);
});

// TST-448232 · level: system · module: system
// guards: UC-022; EVERY STEP EXPLAINS ITSELF; A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S
// given: the ready product; a further decision that chooses gpl-lib (GPL-3.0) for an MIT product
// input: 7c the person presses Run; the folded explanations of the page that shows the draft are read
// expect: known positive — the candidate's row says GPL-3.0 is not known to be compatible; the page holds a folded explanation of what a licence permits — a permissive and a copyleft licence, and that a licence can restrict how the product may be distributed —, beside the table the author decides by
test("TST-448232: UC-022 7c — the author decides with a folded explanation of what a licence permits", async () => {
  endpoints({ drafter: [reply(draftOf({ candidate: "gpl-lib" }))], reviewer: [reply({ findings: [] })], registry: registryOf(["gpl-lib", "GPL-3.0"], ["shelf-lib", "MIT"]) });
  const target = await derive(fakeProduct());
  assert.match(byClass(target, "section", "due-diligence")[0].textContent, /gpl-lib \(npm\) - chosen\s*GPL-3\.0\s*not known to be compatible/, "known positive: the row says so");
  const folded = find(byClass(target, "section", "architecture-result")[0], (node) => node.localName === "details").map(NORMALISED);
  assert.ok(folded.some((each) => /permissive/.test(each) && /copyleft/.test(each) && /restrict how your own product may be distributed/.test(each)), `a folded explanation of what a licence permits: ${folded.length} found`);
});
