// System tests of UC-007 "Derive use cases from requirements": the precondition (accepted requirements, a participant that can draft text), the main flow from the selection of the requirements to the use cases
// written open on the default branch, the alternative flows 4a (a name that matches no requirement is removed), 4b (a use case that realises no requirement is proposed and marked) and 6a (a use case with the
// same goal becomes a change of that file), the correction loop with its limit, and the postcondition (one Markdown file each, none accepted). TST-580201 maps every flow of UC-007 to the system test that walks it.
// Run: node --test tests/system-uc-007-derive-use-cases-from-requirements.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-artifact-edits
// Module: MOD-job-runner
// Module: MOD-job-catalogue
// Module: MOD-job-ledger
// Module: MOD-runtimes
// Module: MOD-approvals
// Module: MOD-documents
// Guards: UC-007
// Level: system
//
// Written for ITM-580 by developer-sonnet-k. The world is tests/uc-007-harness.mjs: the product alice/thesis-tool is a repository in memory, the drafting page of the use cases is drawn into the fixture DOM, and the
// model endpoint is a fake `fetch`. Each test states its input and its expected result in its own text (given / input / expect) from UC-007, before it runs; none reads an expected value from a document. The
// counter-proofs are recorded in the pull request. Readings the texts leave open, which the cases state:
//   - "The author selects the requirements … by default all that no use case realises yet" (step 1) is read as the tick boxes of the drafting page (`use-case/draft`), the requirements of the SPEC that no use case
//     realises ticked (MOD-review-pages, `<k>/draft`).
//   - "Agent M assigns identifiers UC-<nnn>" (step 5) is read as the writer open-files giving each new use case the next free number of the head, one after the other in the order drafted (MOD-artifact-edits).
//   - "marks the use case for review" (4a, 4b) is read as the note `note: …` in the end of the job's record, shown beside the open use case on its page (MOD-review-pages, `<k>/<id>`).
//   - "until the drafts pass or the limit of rounds is reached" is read with MOD-job-runner's three ends of the loop: passed, the limit of the kind (five), or a round that leaves the findings as they were.
//   - A participant "that can draft text" is read as the participants the page lists: the instance's list entries that declare it (MOD-review-pages, `<k>/draft`).

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { FILES, LOAN, READER_ROW, RENEW, SHELF, UC1, UC1_PATH, UNKNOWN, WORKFLOW, accept, badge, byClass, click, draft, endpoint, fakeProduct, jobRecord, onDisk, panelFor, pathOf, realFetch,
  registerOf, renew, reply, runButtons, shelve, show, tick, useCase } from "./uc-007-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SELF = "tests/system-uc-007-derive-use-cases-from-requirements.test.mjs";
const CHAPTER = onDisk("docs/sources/SRC-vibe-coding/2026-10-05/08_requirements-engineering.md");
const SENTENCE = "You draft use cases for the requirements below.";
const useCaseWrites = (fake) => fake.writes().filter((change) => change.files.some((file) => file.path.startsWith("docs/use-cases/")));
const pathsOf = (fake) => Object.keys(fake.files()).filter((path) => path.startsWith("docs/use-cases/")).sort();
const SECTIONS = ["Postcondition", "Precondition", "Actors", "Main flow", "Alternative flows"];

test.afterEach(() => { globalThis.fetch = realFetch; });

// ---------------------------------------------------------------- the map

// Each flow of UC-007, with the system test that walks it.
const FLOWS = {
  "precondition": [[SELF, "TST-580202"]],
  "main flow, 1 the selection of the requirements": [[SELF, "TST-580203"]],
  "main flow, 2 the participant and the run panel": [[SELF, "TST-580204"]],
  "main flow, 3 what is sent": [[SELF, "TST-580205"]],
  "main flow, 4 and 6 the use cases returned are written open": [[SELF, "TST-580206"], [SELF, "TST-580213"]],
  "main flow, 5 the checks and the correction loop": [[SELF, "TST-580207"], [SELF, "TST-580212"]],
  "4a": [[SELF, "TST-580209"]],
  "4b": [[SELF, "TST-580210"]],
  "6a": [[SELF, "TST-580211"]],
  "postcondition": [[SELF, "TST-580208"]],
};

// TST-580201 · level: system · module: system
// guards: UC-007
// given: UC-007 as committed text, whose alternative flows are 4a, 4b and 6a, and the system tests named in FLOWS
// input: read UC-007's alternative flows, and the declarations of the test files named for each flow
// expect: known positive — UC-007 names the three alternative flows 4a, 4b and 6a; FLOWS holds each of them, the precondition, the main flow's steps and the postcondition; each test named stands in its file with the level system and guards UC-007
test("TST-580201: UC-007 every flow has a system test that walks it", () => {
  const text = read("docs/use-cases/UC-007-derive-use-cases-from-requirements.md");
  const alternatives = [...text.matchAll(/^- \*\*(\d+[a-z])\. /gm)].map((match) => match[1]);
  assert.deepEqual(alternatives, ["4a", "4b", "6a"], "known positive: UC-007's alternative flows");
  for (const flow of alternatives) assert.ok(Object.keys(FLOWS).includes(flow), `${flow} has a system test`);
  for (const [flow, tests] of Object.entries(FLOWS)) {
    for (const [file, id] of tests) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${flow}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${flow}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "system", `${id} is a system test`);
      assert.ok((declared.guards ?? []).includes("UC-007"), `${id} guards UC-007`);
    }
  }
});

// ---------------------------------------------------------------- the precondition

// TST-580202 · level: system · module: system
// guards: UC-007; THE PAGE NAMES WHERE IT SENDS
// given: a product with the accepted requirements A LOAN HAS A DUE DATE, A BOOK IS SHELVED and A MEMBER CAN RENEW ONCE in its SPEC; an instance whose list holds two model endpoints and a CI agent that declare draft text and a person that does not; then an instance whose list holds the person only
// input: the person opens the drafting page of the use cases for each
// expect: the page lists the three requirements and the three drafting participants — the endpoints and the CI agent, each with where it processes data —, not the person; with the person only, no participant is listed, no run panel is shown after Show the run panel, and no Run is offered; nothing is written and nothing is sent
test("TST-580202: UC-007 precondition — the requirements of the SPEC and the participants that can draft text are what the page offers", async () => {
  const requests = endpoint(reply([shelve()]));
  const fake = fakeProduct();
  const target = await show(fake);
  assert.deepEqual(byClass(target, "input", "requirement").map((box) => box.value).sort(), [LOAN, RENEW, SHELF].sort(), "known positive: the requirements are listed");
  const listed = byClass(target, "li", "participant");
  assert.deepEqual(listed.map((item) => item.getAttribute("data-name")).sort(), ["ci-agent", "drafter-a", "drafter-small"]);
  for (const item of listed) assert.ok(byClass(item, "span", "place")[0]?.textContent.length > 0, `${item.getAttribute("data-name")} states where it processes data`);

  const nobody = await show(fakeProduct(), { id: "draft" }, { register: registerOf(READER_ROW) });
  assert.equal(byClass(nobody, "li", "participant").length, 0, "no participant is listed");
  click(byClass(nobody, "button", "prepare")[0]);
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(byClass(nobody, "section", "run-panel").length, 0, "no run panel");
  assert.equal(runButtons(nobody).length, 0, "no Run");
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(requests.length, 0, "nothing sent");
});

// ---------------------------------------------------------------- main flow 1

// TST-580203 · level: system · module: system
// guards: UC-007; ONE CLICK PER DECISION
// given: a product whose SPEC holds A LOAN HAS A DUE DATE, realised by UC-001, and A BOOK IS SHELVED and A MEMBER CAN RENEW ONCE, realised by no use case
// input: step 1 the person opens the drafting page, and reads the selection; then unticks both and ticks A LOAN HAS A DUE DATE only, chooses drafter-a and shows the run panel
// expect: known positive — the three requirements are listed; by default exactly the two that no use case realises are ticked; after the person's change the run panel names A LOAN HAS A DUE DATE as the requirement sent and neither of the others; nothing is written and nothing is sent
test("TST-580203: UC-007 step 1 — the requirements no use case realises are ticked by default, and the person's selection is what the run panel names", async () => {
  const requests = endpoint(reply([shelve()]));
  const fake = fakeProduct();
  const target = await show(fake);
  const boxes = byClass(target, "input", "requirement");
  assert.deepEqual(boxes.map((box) => box.value).sort(), [LOAN, RENEW, SHELF].sort(), "known positive: the three requirements are listed");
  assert.deepEqual(boxes.filter((box) => box.checked).map((box) => box.value).sort(), [RENEW, SHELF].sort(), "by default those no use case realises");
  tick(target, [LOAN]);
  const panel = await panelFor(target, "drafter-a");
  const sent = byClass(panel, "li", "part").map((item) => item.textContent.split(" — ")[0]);
  assert.ok(sent.includes(LOAN), `the requirement chosen is named: ${sent.join("; ")}`);
  assert.ok(!sent.includes(SHELF) && !sent.includes(RENEW), "the requirements not chosen are not named");
  assert.equal(fake.writes().length, 0, "nothing written");
  assert.equal(requests.length, 0, "nothing sent");
});

// ---------------------------------------------------------------- main flow 2

// TST-580204 · level: system · module: system
// guards: UC-007; THE PAGE NAMES WHERE IT SENDS; ONE CLICK PER DECISION; THE DASHBOARD WRITES ONLY ON A PERSON'S CLICK
// given: the drafting page with A BOOK IS SHELVED and A MEMBER CAN RENEW ONCE ticked; the participant drafter-a (its context 200000 tokens) and drafter-small (its context 2000 tokens, which the chapter alone exceeds)
// input: step 2 the person chooses drafter-a and shows the run panel; then chooses drafter-small and shows it; the book and the use cases are read from the product and the instance
// expect: the panel of drafter-a names the destination drafter-a, its model and where it processes data, the content to be sent — the two requirements, UC-001, the book's chapter 8 file — and the limit of five correction rounds, and offers exactly one Run; nothing is written and nothing is sent before the click; the panel of drafter-small says that it cannot hold what it would receive, naming the sizes, and offers no Run
test("TST-580204: UC-007 step 2 — the run panel names the destination and the content, offers one Run, and sends nothing until it is pressed", async () => {
  const requests = endpoint(reply([shelve()]));
  const fake = fakeProduct();
  const target = await show(fake);
  const panel = await panelFor(target, "drafter-a");
  const shown = panel.textContent;
  assert.match(shown, /drafter-a/);
  assert.match(shown, /example-model/);
  assert.match(shown, /processes data at: this machine/);
  for (const wanted of [SHELF, RENEW, "docs/use-cases/UC-001-check-out-a-book.md", "08_requirements-engineering.md"]) assert.ok(shown.includes(wanted), `the panel names ${wanted}`);
  assert.ok(!shown.includes("10_architectural-design.md"), "no other chapter");
  assert.match(shown, /Correction rounds: at most 5/);
  assert.equal(runButtons(target).length, 1, "one Run on the page");
  assert.equal(runButtons(panel).length, 1, "and it is the panel's");
  assert.equal(fake.writes().length, 0, "nothing written before the click");
  assert.equal(requests.length, 0, "nothing sent before the click");

  const small = await panelFor(await show(fake), "drafter-small");
  assert.match(small.textContent, /drafter-small cannot hold what it would receive: \d+ tokens, its context holds 2000/);
  assert.equal(runButtons(small).length, 0, "no Run for a participant that cannot hold the input");
  assert.equal(requests.length, 0);
});

// ---------------------------------------------------------------- main flow 3

// TST-580205 · level: system · module: system
// guards: UC-007; A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING; EVERY MODEL READS AGENT M'S AGENTS.MD FIRST; ONE DEFINITION, THREE DRIVERS
// given: the drafting page with A BOOK IS SHELVED and A MEMBER CAN RENEW ONCE ticked, the product holding UC-001, and the participant drafter-a whose endpoint answers a use case for A BOOK IS SHELVED
// input: step 3 the person presses Run on the panel; the one request the endpoint receives is read
// expect: one request, with the participant's key as its authorisation, whose text begins with Agent M's AGENTS.md and then holds the first sentence of the kind's prompt, the two requirements chosen with their rules and not the rule of A LOAN HAS A DUE DATE, UC-001 whole, and the book's chapter 8 whole; the sentence of the prompt stands in src/job-catalogue/kinds/derive-use-cases/prompt.md and in no other file below src/
test("TST-580205: UC-007 step 3 — Agent M sends the chosen requirements, every existing use case, chapter 8 and the use-case prompt, after its AGENTS.md", async () => {
  const requests = endpoint(reply([shelve()]));
  const fake = fakeProduct();
  await draft(fake, { names: [SHELF, RENEW] });
  assert.equal(requests.length, 1, "the endpoint is asked once");
  assert.equal(requests[0].headers.Authorization, "Bearer sk-UC007-FIXTURE-KEY-0123456789");
  const sent = requests[0].sent;
  assert.ok(sent.startsWith(onDisk("AGENTS.md").slice(0, 200)), "the request begins with AGENTS.md");
  assert.ok(sent.indexOf(SENTENCE) > 0, "the prompt follows");
  for (const wanted of ["Every book stands on a shelf.", "A member renews a loan at most once.", UC1.trim(), CHAPTER]) assert.ok(sent.includes(wanted), `the request holds ${wanted.slice(0, 50)}`);
  assert.ok(!sent.includes("Every loan states the date by which the book is returned."), "the requirement not chosen is not sent");
  assert.deepEqual(requests.outside, [], "nothing went elsewhere");
  const holders = [];
  const walk = (dir) => { for (const entry of readdirOf(dir)) { if (entry.endsWith("/")) walk(dir + entry); else if (/\.(mjs|md|json|yml|html)$/.test(entry) && read(dir + entry).includes(SENTENCE)) holders.push(dir + entry); } };
  walk("src/");
  assert.deepEqual(holders, ["src/job-catalogue/kinds/derive-use-cases/prompt.md"], "the prompt stands once");
});
const readdirOf = (dir) => readdirSync(new URL(`../${dir}`, import.meta.url)).filter((name) => name !== "node_modules" && name !== "vendor")
  .map((name) => (statSync(new URL(`../${dir}${name}`, import.meta.url)).isDirectory() ? `${name}/` : name));

// ---------------------------------------------------------------- main flow 4 to 6

// TST-580206 · level: system · module: system
// guards: UC-007; ONE USE CASE, ONE FILE; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT
// given: the drafting page with A BOOK IS SHELVED and A MEMBER CAN RENEW ONCE ticked; the endpoint answers two use cases, UC-900 for the first and UC-901 for the second, each with its five parts, a Mermaid diagram and the requirement it realises, both passing the checks
// input: steps 4 to 6 the person presses Run; the commits the product received, the list of use cases and the job's record are read
// expect: one request; the page says one correction round and names the two files written, docs/use-cases/UC-002-shelve-a-book.md and docs/use-cases/UC-003-renew-a-loan.md — the identifiers assigned by Agent M in the order drafted, not UC-900 and UC-901 —, each the drafted text with its identifier replaced; both files in one commit on the default branch main whose message ends with the lines naming Agent M's version, the job, the kind, the participant, its model and the rounds; UC-001 is as it was; the list shows UC-002 and UC-003 open; the job's record ends done naming that commit and the two files, and holds the round record
test("TST-580206: UC-007 the main flow — the drafted use cases are given identifiers and written, one file each, open on the default branch", async () => {
  const requests = endpoint(reply([shelve(), renew()]));
  const fake = fakeProduct();
  const page = await draft(fake, { names: [SHELF, RENEW] });
  assert.equal(requests.length, 1);
  assert.equal(byClass(page, "p", "rounds")[0].textContent, "Correction rounds: 1");
  assert.equal(byClass(page, "li", "left").length, 0, "nothing left");
  assert.deepEqual(byClass(page, "ul", "written")[0].textContent.split("docs/").filter(Boolean).sort(), ["use-cases/UC-002-shelve-a-book.md", "use-cases/UC-003-renew-a-loan.md"]);
  const drafted = [shelve(), renew()];
  assert.equal(fake.files()[pathOf("UC-002", "shelve-a-book")], drafted[0].text.replaceAll("UC-900", "UC-002"));
  assert.equal(fake.files()[pathOf("UC-003", "renew-a-loan")], drafted[1].text.replaceAll("UC-901", "UC-003"));
  assert.equal(fake.files()[UC1_PATH], UC1, "UC-001 is as it was");
  const written = useCaseWrites(fake);
  assert.equal(written.length, 1, "one commit for the use cases");
  assert.equal(written[0].branch, "main");
  assert.deepEqual(written[0].files.map((file) => file.path), [pathOf("UC-002", "shelve-a-book"), pathOf("UC-003", "renew-a-loan")]);
  assert.match(written[0].message, /^draft UC-002, UC-003 as open files\n\nAgent-M-Version: .+\nAgent-M-Job: JOB-\d{8}-\d{4}-[0-9a-f]{4}\nAgent-M-Kind: derive-use-cases\nAgent-M-Participant: drafter-a\nAgent-M-Model: example-model\nAgent-M-Rounds: 1$/);
  assert.equal(await badge(fake, "UC-002"), "open");
  assert.equal(await badge(fake, "UC-003"), "open");
  const record = jobRecord(fake).text;
  assert.match(record, /^kind: derive-use-cases$/m);
  assert.match(record, /^works_on:\n {2}- A BOOK IS SHELVED\n {2}- A MEMBER CAN RENEW ONCE$/m);
  assert.match(record, /## End[^]*state: done\nresults: commit [0-9a-f]{40}, file docs\/use-cases\/UC-002-shelve-a-book\.md, file docs\/use-cases\/UC-003-renew-a-loan\.md/);
  assert.match(record, /### Round 1 — no finding/);
});

// ---------------------------------------------------------------- main flow 5

// TST-580207 · level: system · module: system
// guards: UC-007; A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; A FINDING READS LIKE A COMPILER MESSAGE; THE ROUNDS ARE COUNTED AND SHOWN
// given: the drafting page with A BOOK IS SHELVED ticked; the endpoint first answers a use case that realises AN UNKNOWN RULE and lacks the section Postcondition, then the corrected use case
// input: step 5 the person presses Run; the two requests and what the product received are read
// expect: two requests; the second holds the first draft and, under the heading of the findings, the two findings in the form `<artifact>:<line>: error: <what> [<RULE>] — <correction>.`, one naming A USE CASE REALISES NAMED REQUIREMENTS and one naming A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION; the page says two correction rounds and leaves nothing; the use case written is the corrected one — the use cases the product received hold neither the unknown name nor a file without the section —; the job's record holds Round 1 with its two findings, in the order of their lines, and Round 2 without one
test("TST-580207: UC-007 step 5 — a draft that fails a check goes back with its findings, and only the corrected draft is written", async () => {
  const first = shelve([UNKNOWN], { without: ["Postcondition"] });
  const requests = endpoint(reply([first]), reply([shelve([SHELF])]));
  const fake = fakeProduct();
  const page = await draft(fake, { names: [SHELF] });
  assert.equal(requests.length, 2, "the drafter is asked again");
  const second = requests[1].sent;
  assert.ok(second.includes(first.text.split("\n")[1]) && second.includes("AN UNKNOWN RULE"), "the first draft goes back");
  const findings = second.slice(second.indexOf("## Findings to fix or answer")).split("\n").filter((line) => /^\S+:\d+: (error|warning): /.test(line));
  assert.equal(findings.length, 2, findings.join("\n"));
  for (const line of findings) assert.match(line, /^\S+:\d+: (error|warning): .+ \[[A-Z ,'-]+\] — .+\.$/);
  assert.ok(findings.some((line) => line.includes("[A USE CASE REALISES NAMED REQUIREMENTS]")));
  assert.ok(findings.some((line) => line.includes("[A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION]")));
  assert.equal(byClass(page, "p", "rounds")[0].textContent, "Correction rounds: 2");
  assert.equal(byClass(page, "li", "left").length, 0, "nothing left");
  const every = useCaseWrites(fake).flatMap((change) => change.files.map((file) => file.text)).join("\n");
  assert.ok(every.length > 0 && !every.includes("AN UNKNOWN RULE"), "no use case written holds the unknown name");
  assert.equal(fake.files()[pathOf("UC-002", "shelve-a-book")], shelve([SHELF]).text.replaceAll("UC-900", "UC-002"), "the corrected use case is the one written");
  const rounds = jobRecord(fake).text.split("## Rounds")[1];
  assert.match(rounds, /### Round 1 — 2 findings\n/);
  assert.match(rounds, /\n- UC-900:\d+: error: [^\n]*\[A USE CASE REALISES NAMED REQUIREMENTS\]/);
  assert.match(rounds, /\n- UC-900:\d+: error: [^\n]*\[A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION\]/);
  assert.match(rounds, /### Round 2 — no finding\n\nLeft: none · stopped because: passed · limit: 5/);
});

// TST-580212 · level: system · module: system
// guards: UC-007; THE CORRECTION LOOP HAS A FIXED LIMIT; THE ROUNDS ARE COUNTED AND SHOWN
// given: the drafting page with A BOOK IS SHELVED ticked; (a) an endpoint that answers, round after round, the use case lacking another section — five different findings; (b) an endpoint that always answers the same use case without the section Postcondition
// input: step 5 the person presses Run for each
// expect: (a) the drafter is asked exactly five times, the limit the panel stated; the page says five correction rounds and shows the finding left, which names the section Alternative flows; the use case is written open all the same; the record ends with Left: 1 finding · stopped because: limit; (b) the drafter is asked twice, since the second round leaves the finding as it was; the page shows the finding left; the record says stopped because: unchanged
test("TST-580212: UC-007 step 5 — the loop ends at the limit of rounds, or at a round that changes nothing, and what is left is shown", async () => {
  const sections = SECTIONS.map((name) => reply([shelve([SHELF], { without: [name] })]));
  const requests = endpoint(...sections);
  const fake = fakeProduct();
  const page = await draft(fake, { names: [SHELF] });
  assert.equal(requests.length, 5, "asked exactly five times");
  assert.equal(byClass(page, "p", "rounds")[0].textContent, "Correction rounds: 5");
  const left = byClass(page, "li", "left").map((item) => item.textContent);
  assert.equal(left.length, 1);
  assert.match(left[0], /## Alternative flows/);
  assert.deepEqual(pathsOf(fake), [UC1_PATH, pathOf("UC-002", "shelve-a-book")].sort(), "the draft is written open all the same");
  assert.match(jobRecord(fake).text, /Left: 1 finding · stopped because: limit · limit: 5/);

  const same = endpoint(reply([shelve([SHELF], { without: ["Postcondition"] })]));
  const other = fakeProduct();
  const second = await draft(other, { names: [SHELF] });
  assert.equal(same.length, 2, "asked twice");
  assert.equal(byClass(second, "p", "rounds")[0].textContent, "Correction rounds: 2");
  assert.match(byClass(second, "li", "left")[0].textContent, /## Postcondition/);
  assert.match(jobRecord(other).text, /stopped because: unchanged/);
});

// ---------------------------------------------------------------- the postcondition

// TST-580208 · level: system · module: system
// guards: UC-007; A GENERATED ARTIFACT IS A PROPOSAL; ONE USE CASE, ONE FILE; ARTIFACTS ARE MARKDOWN
// given: the drafting page with A BOOK IS SHELVED and A MEMBER CAN RENEW ONCE ticked and two use cases drafted, written by Run; then a person's approval record that names the text of UC-002 as it stands
// input: the product's files after the run; the list of use cases; the acceptance of UC-002 alone
// expect: each proposed use case is one Markdown file under docs/use-cases/ that names the requirement it realises; the run added no approval record and no use case is accepted: both read open; after the record for UC-002, UC-002 reads accepted and UC-003 still open
test("TST-580208: UC-007 postcondition — each use case is one Markdown file naming its requirements, and none counts as accepted until its own acceptance", async () => {
  endpoint(reply([shelve(), renew()]));
  const fake = fakeProduct();
  await draft(fake, { names: [SHELF, RENEW] });
  const [two, three] = [pathOf("UC-002", "shelve-a-book"), pathOf("UC-003", "renew-a-loan")];
  assert.match(fake.files()[two], /^---\nid: UC-002\n[^]*\nrealises:\n {2}- A BOOK IS SHELVED\n---\n# UC-002 /);
  assert.match(fake.files()[three], /^---\nid: UC-003\n[^]*\nrealises:\n {2}- A MEMBER CAN RENEW ONCE\n---\n# UC-003 /);
  assert.deepEqual(pathsOf(fake).filter((path) => !path.endsWith(".md")), [], "every file is Markdown");
  assert.deepEqual(Object.keys(fake.files()).filter((path) => path.startsWith("docs/approvals/")), [], "no approval record was written");
  assert.equal(await badge(fake, "UC-002"), "open");
  assert.equal(await badge(fake, "UC-003"), "open");
  await accept(fake, two);
  assert.equal(await badge(fake, "UC-002"), "accepted", "accepted by its own record");
  assert.equal(await badge(fake, "UC-003"), "open", "the other is not");
});

// ---------------------------------------------------------------- 4a, 4b, 6a

// TST-580209 · level: system · module: system
// guards: UC-007; A USE CASE REALISES NAMED REQUIREMENTS; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY
// given: the drafting page with A BOOK IS SHELVED ticked; the endpoint always answers the use case that realises A BOOK IS SHELVED and AN UNKNOWN RULE
// input: 4a the person presses Run; the product's files and the job's record are read, and the page of the use case written
// expect: the drafter is asked twice (the second round leaves the finding as it was); the page names no problem; the use case written, UC-002, realises A BOOK IS SHELVED alone — the name AN UNKNOWN RULE is removed, no requirement is invented —; the job's record ends done and holds a note that names UC-002 and AN UNKNOWN RULE; the page of UC-002 shows that note beside the open use case
test("TST-580209: UC-007 4a — a name that still matches no requirement after the last round is removed, and the use case is marked for review", async () => {
  const requests = endpoint(reply([shelve([SHELF, UNKNOWN])]));
  const fake = fakeProduct();
  const page = await draft(fake, { names: [SHELF] });
  assert.equal(requests.length, 2, "asked twice");
  assert.deepEqual(byClass(page, "p", "problem").map((node) => node.textContent), [], "no problem on the page");
  const path = pathOf("UC-002", "shelve-a-book");
  assert.match(fake.files()[path], /\nrealises:\n {2}- A BOOK IS SHELVED\n---\n/, "the unknown name is removed and the known one stays");
  assert.ok(!fake.files()[path].includes(UNKNOWN));
  const record = jobRecord(fake).text;
  assert.match(record, /## End[^]*state: done/, "the job ends with its record");
  assert.match(record, /note: [^\n]*UC-002[^\n]*AN UNKNOWN RULE/);
  const notes = byClass(await show(fake, { id: "UC-002" }), "section", "job-notes");
  assert.equal(notes.length, 1);
  assert.match(notes[0].textContent, /UC-002/);
  assert.match(notes[0].textContent, /AN UNKNOWN RULE/);
});

// TST-580210 · level: system · module: system
// guards: UC-007; A USE CASE REALISES NAMED REQUIREMENTS; A GENERATED ARTIFACT IS A PROPOSAL
// given: the drafting page with A BOOK IS SHELVED ticked; the endpoint answers a use case that realises no requirement
// input: 4b the person presses Run; the product's files, the job's record and the page of the use case written are read
// expect: the drafter is asked once; the use case is proposed all the same — written as UC-002, open, its realises list empty —; the job's record ends done with the note `note: UC-002 realises no requirement`; the page of UC-002 shows that note beside the use case; the page of UC-001 shows no such note
test("TST-580210: UC-007 4b — a use case that realises no requirement is proposed anyway and marked", async () => {
  const requests = endpoint(reply([shelve([])]));
  const fake = fakeProduct();
  const page = await draft(fake, { names: [SHELF] });
  assert.equal(requests.length, 1);
  assert.deepEqual(byClass(page, "p", "problem").map((node) => node.textContent), []);
  const path = pathOf("UC-002", "shelve-a-book");
  assert.match(fake.files()[path], /\nrealises:\n---\n/, "it realises nothing");
  assert.equal(await badge(fake, "UC-002"), "open");
  assert.match(jobRecord(fake).text, /## End[^]*state: done[^]*results: [^\n]*note: UC-002 realises no requirement/);
  const notes = byClass(await show(fake, { id: "UC-002" }), "section", "job-notes");
  assert.equal(notes.length, 1);
  assert.match(notes[0].textContent, /UC-002 realises no requirement/);
  assert.equal(byClass(await show(fake, { id: "UC-001" }), "section", "job-notes").length, 0, "no note beside UC-001");
});

// TST-580211 · level: system · module: system
// guards: UC-007; ONE USE CASE, ONE FILE; A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN
// given: a product whose UC-001 Check out a book is accepted by a record; the drafting page with A LOAN HAS A DUE DATE ticked; (a) the endpoint answers a use case classed change of UC-001 with a further alternative flow; (b) the endpoint answers a use case classed new that states the title of UC-001, with a further alternative flow
// input: 6a the person presses Run for each
// expect: (a) one request; no new identifier — the use case files are UC-001 alone —; UC-001's file holds the drafted text with the identifier UC-001 and reads changed since acceptance; (b) the drafter is asked twice, the second request naming the exact duplicate of UC-001 as a finding of the rule EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; the draft left unchanged is written as a change of UC-001's file and no file UC-002 exists
test("TST-580211: UC-007 6a — a use case with the same goal as an existing one is proposed as a change of that file, not under a new identifier", async () => {
  const flows = "- **1a. The book is out.** The member is told when it is back.\n- **1b. The member owes a fine.** The loan is refused.";
  const changed = useCase({ id: "UC-001", title: "Check out a book", realises: [LOAN], alternatives: flows });
  const accepted = async () => { const fake = fakeProduct(); await accept(fake, UC1_PATH); assert.equal(await badge(fake, "UC-001"), "accepted", "known positive: UC-001 is accepted"); return fake; };

  const requests = endpoint(reply([{ path: UC1_PATH, class: "change", of: "UC-001", text: changed }]));
  const fake = await accepted();
  await draft(fake, { names: [LOAN] });
  assert.equal(requests.length, 1);
  assert.deepEqual(pathsOf(fake), [UC1_PATH], "no new file");
  assert.equal(fake.files()[UC1_PATH], changed);
  assert.equal(await badge(fake, "UC-001"), "changed since acceptance");

  const asNew = { path: pathOf("UC-900", "check-out-a-book"), class: "new", text: useCase({ id: "UC-900", title: "Check out a book", realises: [LOAN], alternatives: flows }) };
  const second = endpoint(reply([asNew]));
  const other = await accepted();
  await draft(other, { names: [LOAN] });
  assert.equal(second.length, 2, "asked twice");
  assert.match(second[1].sent, /\[EXACT DUPLICATES ARE FOUND WITHOUT A MODEL\]/);
  assert.deepEqual(pathsOf(other), [UC1_PATH], "no file UC-002");
  assert.equal(other.files()[UC1_PATH], asNew.text.replaceAll("UC-900", "UC-001"));
  assert.equal(await badge(other, "UC-001"), "changed since acceptance");
});

// ---------------------------------------------------------------- another participant

// TST-580213 · level: system · module: system
// guards: UC-007; A JOB IS RECORDED IN ITS PRODUCT REPOSITORY; ONE CLICK PER DECISION
// given: a product that holds the job workflow, the drafting page with A BOOK IS SHELVED ticked, and the CI agent ci-agent as the deriving participant
// input: steps 2 and 3 the person chooses ci-agent, shows the run panel and presses Run
// expect: the run panel names ci-agent and where it processes data; nothing is sent from the tab; the page says the job is queued on the route ci hosted, naming its identifier; one commit holds the job's start record docs/jobs/<job>.md and nothing else, naming the kind derive-use-cases, A BOOK IS SHELVED and ci-agent; no use case is written
test("TST-580213: UC-007 the participant may be an agent of the list — the job is queued on its route and its start is recorded", async () => {
  const requests = endpoint(reply([shelve()]));
  const fake = fakeProduct({ ...FILES, [WORKFLOW]: "name: Agent M jobs\n" });
  const target = await show(fake);
  tick(target, [SHELF]);
  const panel = await panelFor(target, "ci-agent");
  assert.match(panel.textContent, /ci-agent/);
  assert.match(panel.textContent, /GitHub Actions in the USA/);
  const page = await (async () => { click(runButtons(target)[0]); while (byClass(target, "p", "queued").length === 0 && byClass(target, "p", "problem").length === 0) await new Promise((resolve) => setImmediate(resolve)); return target; })();
  assert.equal(requests.length, 0, "nothing sent from the tab");
  assert.match(byClass(page, "p", "queued")[0].textContent, /^Job JOB-\d{8}-\d{4}-[0-9a-f]{4} is queued on the route ci hosted/);
  assert.equal(fake.writes().length, 1, "one commit");
  assert.deepEqual(fake.writes()[0].files.map((file) => file.path.replace(/JOB-[^.]+/, "JOB")), ["docs/jobs/JOB.md"]);
  const record = fake.writes()[0].files[0].text;
  assert.match(record, /^kind: derive-use-cases$/m);
  assert.match(record, /^participant: ci-agent$/m);
  assert.match(record, /^works_on:\n {2}- A BOOK IS SHELVED$/m);
  assert.equal(pathsOf(fake).length, 1, "no use case written");
});
