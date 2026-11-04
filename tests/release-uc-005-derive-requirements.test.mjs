// Release tests of the requirements UC-005 "Derive requirements from a source" realises, each checked from what an author reads on the draft page of the SPEC changes, from the requests the fixture model endpoint received, and from the
// commits the fixture hosts of the product and of the instance received: the source a requirement names, its four fields, one statement, the check it names, the proposal that a person accepts, where the page sends, the version that
// produced it, its origin, the queue entering the default branch open, one click for each decision, what a requirement constrains, the existing requirements the participant sees, nothing left out silently, the four classes, exact
// duplicates, the classification shown to a person, a change under the existing name, a duplicate adding a source, a conflict decided by a person, candidates deduplicated among themselves, the impact list, the current text beside a
// candidate, the correction loop with its findings, its limit and its rounds, and chapter 8. TST-579301 maps every requirement UC-005 realises to the release tests that guard it.
// Run: node --test tests/release-uc-005-derive-requirements.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-spec-changes
// Module: MOD-job-runner
// Guards: UC-005
// Level: release
//
// Written for the release testing of sprint 142 by developer-sonnet-j (ITM-579). The `Agent-M-Participant` trailers of the code UC-005's flow runs name developer-opus-e, developer-opus-f, developer-sonnet-a, -b, -c, -d, -e, -f and -k,
// developer-terra-a, developer-opus-a and scrum-master-opus-c; most commits of it carry no trailer. developer-sonnet-j built ITM-659 (storedToken), ITM-1315 (Accept disabled on a file that rests on what is not accepted) and ITM-1274
// (entryImpact, entryView's read of an entry's files) among the code the flow touches: UC-005 realises no requirement of the token that WITHOUT A TOKEN, GITHUB'S WEB INTERFACE IS THE FALLBACK names, and no case here walks Accept or the page of
// an entry, which UC-006 and the system case TST-579217 walk. The release team works from the specification and the pages, so each case ends at what a person reads on the page, at the request the fixture endpoint received, and at the files the
// fixture host received. Where the page and the SPEC or UC-005 disagree the case follows the text and is marked `todo` with the word FINDING. Readings the texts leave open, which the cases state:
//   - "the artifact's own text names none of them" (AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT) is read of the proposal itself, the section text of the entry, which becomes the SPEC; the rationale and the index of the queue are
//     records beside it, and UC-005 step 8 asks each entry to record the version, participant, model and date.
//   - THE MODEL'S CLASSIFICATION IS MEASURED, NOT TRUSTED has a rate that is reported, not gated, in tests/test_derivation_classes.py; the case here checks the part that is not a rate: every classification is shown to a person, who can
//     change it, and what is written follows the person's class.
//   - "a participant shown without its place fails" (THE PAGE NAMES WHERE IT SENDS) is read as: the panel prints the place the register declares for each destination, so that two participants of two places print two places.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { DRAFTER, INSTANCE_SPEC, LOAN, LOAN_RULE, MAIN_FILE, PRODUCT_FILES, RENEW, SHELF, SHELF_RULE,
  byClass, candidate, click, classOf, find, findingLines, groupsOf, itemOf, participantRow, registerOf, restoreFetch, scripted, setClass, sourceFiles, text, world, write, writtenFiles } from "./uc-005-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const UC = "docs/use-cases/UC-005-derive-requirements-from-a-source.md";
const SELF = "tests/release-uc-005-derive-requirements.test.mjs";
const textOf = (node) => node.textContent;
test.afterEach(() => restoreFetch());

// ---------------------------------------------------------------- the map

// Each requirement UC-005 realises, with the release tests that guard it: this file's, and those other writers wrote. A requirement with no test named is left, and the map says to whom.
const EVIDENCE = {
  "A REQUIREMENT HAS A REGISTERED SOURCE": [[SELF, "TST-579302"], ["tests/release-uc-015-link-sources.test.mjs", "TST-639006"]],
  "A REQUIREMENT HAS FOUR FIELDS": [[SELF, "TST-579303"]],
  "ONE STATEMENT PER REQUIREMENT": [[SELF, "TST-579304"]],
  "A REQUIREMENT NAMES ITS CHECK": [[SELF, "TST-579305"]],
  "A GENERATED ARTIFACT IS A PROPOSAL": [[SELF, "TST-579306"]],
  "THE PAGE NAMES WHERE IT SENDS": [[SELF, "TST-579307"]],
  "AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT": [[SELF, "TST-579308"]],
  "EVERY ARTIFACT NAMES ITS ORIGIN": [[SELF, "TST-579309"]],
  "A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN": [[SELF, "TST-579310"]],
  "ONE CLICK PER DECISION": [[SELF, "TST-579311"]],
  "A REQUIREMENT NAMES WHAT IT CONSTRAINS": [[SELF, "TST-579312"]],
  "DERIVATION SEES THE EXISTING REQUIREMENTS": [[SELF, "TST-579313"], ["tests/test_derivation_context.py", "TST-414100"]],
  "NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY": [[SELF, "TST-579314"], ["tests/test_derivation_context.py", "TST-414101"]],
  "A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT": [[SELF, "TST-579315"], ["tests/test_derivation_classes.py", "TST-415100"]],
  "EXACT DUPLICATES ARE FOUND WITHOUT A MODEL": [[SELF, "TST-579316"], ["tests/release-itm-1335-change-of-itself.test.mjs", "TST-1335101"]],
  "THE MODEL'S CLASSIFICATION IS MEASURED, NOT TRUSTED": [[SELF, "TST-579317"]],
  "A CHANGE IS PROPOSED UNDER THE EXISTING NAME": [[SELF, "TST-579318"], ["tests/release-itm-1335-change-of-itself.test.mjs", "TST-1335102"], ["tests/release-itm-1317-change-under-own-name.test.mjs", "TST-1317101"]],
  "A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT": [[SELF, "TST-579319"], ["tests/test_derivation_classes.py", "TST-415100"]],
  "A CONFLICT IS DECIDED BY A PERSON": [[SELF, "TST-579320"], ["tests/test_derivation_classes.py", "TST-415100"]],
  "CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES": [[SELF, "TST-579321"], ["tests/test_derivation_classes.py", "TST-415100"]],
  "A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST": [[SELF, "TST-579322"], ["tests/release-uc-006-batched-reads.test.mjs", "TST-479201"], ["tests/release-itm-1274-entry-impact-without-rationale.test.mjs", "TST-1274301"]],
  "NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT": [[SELF, "TST-579323"]],
  "A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT": [[SELF, "TST-579324"]],
  "A FINDING READS LIKE A COMPILER MESSAGE": [[SELF, "TST-579325"]],
  "AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED": [[SELF, "TST-579326"]],
  "WHAT A PERSON DECIDES IS NOT SENT BACK": [[SELF, "TST-579327"]],
  "THE CORRECTION LOOP HAS A FIXED LIMIT": [[SELF, "TST-579328"]],
  "THE ROUNDS ARE COUNTED AND SHOWN": [[SELF, "TST-579329"]],
  "A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING": [[SELF, "TST-579330"], ["tests/test_job_reading_checkout.py", "TST-417100"]],
};

// TST-579301 · level: release · module: system
// guards: UC-005
// given: UC-005 as committed text, whose `realises` lists twenty-nine requirements, and the release tests named in EVIDENCE
// input: read UC-005's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-005 realises these twenty-nine requirements; each has at least one release test named; each test named stands in its file with the level release and guards that requirement; no release case of this file is by a writer of the behaviour it guards (the header names the trailers read)
test("TST-579301: UC-005 every requirement it realises has a release test that guards it", () => {
  const front = /^realises:\n((?:  - .*\n)+)/m.exec(read(UC))?.[1] ?? "";
  const realised = front.split("\n").filter(Boolean).map((line) => line.replace(/^ {2}- /, ""));
  assert.equal(realised.length, 29, "known positive: UC-005 realises twenty-nine requirements");
  assert.deepEqual([...realised].sort(), Object.keys(EVIDENCE).sort(), "the map holds exactly the requirements UC-005 realises");
  for (const [requirement, named] of Object.entries(EVIDENCE)) {
    assert.ok(named.length > 0, `${requirement}: a test is named`);
    for (const [file, id] of named) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${requirement}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${requirement}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(requirement), `${id} guards ${requirement}`);
    }
  }
});

// ---------------------------------------------------------------- helpers

/** A world, the page prepared with main.md and drafter-a, Run pressed; -> { w, prepared, panel }. */
async function derived(answers, options = {}) {
  const w = await world({ answers, ...options });
  const prepared = await w.prepare({ files: [MAIN_FILE], ...(options.prepare ?? {}) });
  const panel = await w.run(prepared);
  return { w, prepared, panel };
}
const sectionOf = (w) => Object.entries(writtenFiles(w)).find(([path]) => path.endsWith("01-lending.md"))?.[1];
const rationaleOf = (w) => Object.entries(writtenFiles(w)).find(([path]) => path.endsWith("01-lending.begruendung.md"))?.[1];
const blocksOf = (section) => [...section.matchAll(/\*\*([^*\n]+)\*\* \*\(([^)\n]*)\)\*\n([^\n]*)\n\*Check:\* ([^\n]*)/g)].map((match) => ({ name: match[1], sources: match[2], rule: match[3], check: match[4] }));
const NEW_FINE = candidate("A FINE IS CHARGED", { rule: "A late loan is charged a fine.", passage: "ch. 5" });

// ---------------------------------------------------------------- the source, the four fields, the check

// TST-579302 · level: release · module: system
// guards: A REQUIREMENT HAS A REGISTERED SOURCE; UC-005
// given: a product that links SRC-policy, which the instance's register holds; the endpoint answers A FINE IS CHARGED (the job's source) and AN EXTERNAL RULE IS NAMED, which points to SRC-unlinked, a source the product does not link
// input: Run; Write proposals
// expect: every requirement the written queue adds names SRC-policy, a source the register holds and the product's links file lists; AN EXTERNAL RULE IS NAMED is written nowhere and the panel lists it under "Link first" with SRC-unlinked; known positive: A FINE IS CHARGED is written
test("TST-579302: a requirement the derivation writes names a registered source the product links, and a candidate of an unlinked source is not written", async () => {
  const { w, prepared, panel } = await derived({ candidates: [NEW_FINE, candidate("AN EXTERNAL RULE IS NAMED", { rule: "An external rule is named.", source: "SRC-unlinked" })] });
  assert.match(textOf(byClass(panel, "section", "unlinked-candidates")[0]), /AN EXTERNAL RULE IS NAMED: SRC-unlinked is not linked/);
  await write(prepared.page);
  const section = sectionOf(w);
  const added = blocksOf(section).filter((block) => block.name === "A FINE IS CHARGED");
  assert.equal(added.length, 1, "known positive");
  const registered = Object.keys(sourceFiles()).filter((path) => /^docs\/sources\/SRC-[^/]+\.md$/.test(path)).map((path) => path.split("/").at(-1).replace(/\.md$/, ""));
  assert.deepEqual(registered.sort(), ["SRC-handbook", "SRC-policy"], "the register holds these sources");
  for (const block of blocksOf(section)) for (const item of block.sources.split(";").map((each) => each.trim().split(",")[0])) assert.ok(registered.includes(item), `${block.name} names ${item}, a registered source`);
  assert.ok(!section.includes("AN EXTERNAL RULE IS NAMED"));
  assert.ok(w.product.files()["docs/sources.md"].includes("| SRC-policy |"), "the product links SRC-policy");
});

// TST-579303 · level: release · module: system
// guards: A REQUIREMENT HAS FOUR FIELDS; UC-005
// given: the endpoint's first answer holds A NO RULE without a rule and A NO CHECK without a check; its second answer fixes both; and, apart, an answer of candidates that have all four fields
// input: Run; read the second request and the panel; Write proposals
// expect: the second request holds an error under A REQUIREMENT HAS FOUR FIELDS for "no rule" and one for "no check"; every requirement written has a name, a source in parentheses, a rule and a check, each on its own line; counter-proof: candidates with all four fields are answered once, with no finding
test("TST-579303: a candidate without one of the four fields goes back, and every requirement written has name, source, rule and check", async () => {
  const fixed = [candidate("A NO RULE", { rule: "Every member has a rule." }), candidate("A NO CHECK", { rule: "Every member has a check." })];
  const first = [candidate("A NO RULE", { rule: "" }), candidate("A NO CHECK", { rule: "Every member has a check.", check: "" })];
  const { w, prepared } = await derived(({ n }) => ({ draft: { candidates: n === 1 ? first : fixed } }));
  assert.equal(w.requests.length, 2);
  const lines = findingLines(w.requests[1].prompt);
  assert.ok(lines.some((line) => /^A NO RULE:\d+: error: no rule \[A REQUIREMENT HAS FOUR FIELDS\]/.test(line)), lines.join("\n"));
  assert.ok(lines.some((line) => /^A NO CHECK:\d+: error: no check \[A REQUIREMENT HAS FOUR FIELDS\]/.test(line)), lines.join("\n"));
  await write(prepared.page);
  const blocks = blocksOf(sectionOf(w));
  for (const name of ["A NO RULE", "A NO CHECK"]) {
    const block = blocks.find((each) => each.name === name);
    assert.ok(block, `${name} is written`);
    assert.ok(block.sources.length > 0 && block.rule.length > 0 && block.check.length > 0, `${name} has all four fields`);
  }
  const whole = await derived({ candidates: fixed });
  assert.equal(whole.w.requests.length, 1, "counter-proof: four fields, one request");
});

// TST-579304 · level: release · module: system
// guards: ONE STATEMENT PER REQUIREMENT; UC-005
// given: the endpoint answers A FINE IS CHARGED AND REPORTED, whose rule says "and", A TOGGLE WORKS, whose rule says "additionally", and A BOOK IS COUNTED, whose rule is one statement; it never changes its draft
// input: Run
// expect: the second request lists a warning under ONE STATEMENT PER REQUIREMENT for the rule with "and" and one for the rule with "additionally", each telling to split the rule or keep it with a one-line reason, and none for A BOOK IS COUNTED; the loop ends with both warnings left, which the panel lists
test("TST-579304: a rule that says \"and\" or \"additionally\" is sent back as a warning, and a rule of one statement is not", async () => {
  const { w, panel } = await derived({ candidates: [candidate("A FINE IS CHARGED AND REPORTED", { rule: "A late loan is charged a fine and reported." }),
    candidate("A TOGGLE WORKS", { rule: "A toggle works additionally." }), candidate("A BOOK IS COUNTED", { rule: "Every book is counted." })] });
  const lines = findingLines(w.requests[1].prompt);
  assert.equal(lines.length, 2);
  assert.match(lines[0], /^A FINE IS CHARGED AND REPORTED:\d+: warning: the rule contains "and" \[ONE STATEMENT PER REQUIREMENT\] — split it into two requirements, or keep it and give a one-line reason\.$/);
  assert.match(lines[1], /^A TOGGLE WORKS:\d+: warning: the rule contains "additionally" \[ONE STATEMENT PER REQUIREMENT\] — split it into two requirements, or keep it and give a one-line reason\.$/);
  assert.ok(!lines.join("\n").includes("A BOOK IS COUNTED"));
  assert.equal(byClass(panel, "li", "left").length, 2);
});

// TST-579305 · level: release · module: system
// guards: A REQUIREMENT NAMES ITS CHECK; UC-005
// given: the endpoint answers A CHECK WITHOUT A TEST, whose check is "by looking at it", A CHECK AT REVIEW, whose check is "no automatic check; at review", and A CHECK WITH A TEST, whose check names `tests/fixture.test.mjs`
// input: Run
// expect: the second request lists an error under A REQUIREMENT NAMES ITS CHECK for A CHECK WITHOUT A TEST — "the check names neither a test nor review" — and none for the other two
test("TST-579305: a check that names neither a test nor review goes back as an error, and a check that names either does not", async () => {
  const { w } = await derived({ candidates: [candidate("A CHECK WITHOUT A TEST", { rule: "A thing is checked.", check: "by looking at it" }), candidate("A CHECK AT REVIEW", { rule: "A thing is reviewed.", check: "no automatic check; at review" }),
    candidate("A CHECK WITH A TEST", { rule: "A thing is tested.", check: "`tests/fixture.test.mjs` — a fixture thing" })] });
  const lines = findingLines(w.requests[1].prompt);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^A CHECK WITHOUT A TEST:\d+: error: the check names neither a test nor review \[A REQUIREMENT NAMES ITS CHECK\] — /);
});

// ---------------------------------------------------------------- the proposal, the page, the version, the origin

// TST-579306 · level: release · module: system
// guards: A GENERATED ARTIFACT IS A PROPOSAL; UC-005
// given: the endpoint answers a new requirement and a change; the person's token is stored
// input: Run; Write proposals; draw the list of the SPEC changes
// expect: SPEC.md and every file the product held are byte for byte as they were; the written entries are listed open, none in SPEC, and no approval record exists below docs/approvals/
test("TST-579306: what the derivation writes is a proposal: the SPEC is unchanged and the entries are open until a person accepts them", async () => {
  const { w, prepared } = await derived({ candidates: [NEW_FINE, candidate("THE DUE DATE IS SHOWN", { class: "change", of: LOAN, rule: "Every loan shows its due date." })] });
  const before = w.product.files();
  await write(prepared.page);
  const after = w.product.files();
  for (const [path, body] of Object.entries(before)) assert.equal(after[path], body, `${path} is as it was`);
  const [folder] = [...new Set(Object.keys(writtenFiles(w)).map((path) => path.split("/")[2]))];
  const list = await w.draw({});
  const row = find(list, (node) => node.localName === "tr" && node.getAttribute("data-id") === `spec-${folder}-01`)[0];
  assert.ok(row, "the entry is listed");
  assert.equal(byClass(row, "span", "badge")[0].textContent, "open");
  assert.deepEqual(Object.keys(after).filter((path) => path.startsWith("docs/approvals/")), []);
});

// TST-579307 · level: release · module: system
// guards: THE PAGE NAMES WHERE IT SENDS; UC-005
// given: the register lists drafter-a, which processes data on this machine, and far-d, which processes data at NHR@FAU, Erlangen; both reach the endpoint ep1
// input: show the run panel for drafter-a, then for far-d; press Run for far-d
// expect: before Run each panel names its one destination, the participant with its model and the place its register entry declares, and nothing has been sent; after Run every request went to the endpoint the destination uses (https://ep1.example.test/v1/chat/completions) and to no other origin
test("TST-579307: before Run the panel names each destination with the place where it processes data, and the run sends only there", async () => {
  const register = registerOf(DRAFTER, participantRow("far-d", { place: "NHR@FAU, Erlangen", model: "model-b" }));
  const w = await world({ instance: { register }, answers: { candidates: [] } });
  const near = await w.prepare({ files: [MAIN_FILE], participant: "drafter-a" });
  assert.match(textOf(near.panel), /drafter-a — drafter[\s\S]*model: model-a; processes data at: this machine/);
  assert.equal(byClass(near.panel, "section", "destination").length, 1);
  assert.equal(w.requests.length, 0);
  const far = await w.prepare({ page: near.page, files: [MAIN_FILE], participant: "far-d" });
  assert.match(textOf(far.panel), /far-d — drafter[\s\S]*model: model-b; processes data at: NHR@FAU, Erlangen/);
  assert.doesNotMatch(textOf(far.panel), /this machine/);
  assert.equal(w.requests.length, 0);
  await w.run(far);
  assert.ok(w.requests.length > 0, "known positive: the endpoint was asked");
  assert.equal(w.requests.length, w.requests.filter((request) => request.body.model === "m").length, "every request is the endpoint's: the fixture network refuses any other origin");
});

// TST-579308 · level: release · module: system
// guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; UC-005
// given: the endpoint answers a new requirement for drafter-a, whose model is model-a; the instance is at the commit abc123def4567890abc123def4567890abc123de
// input: Run; Write proposals
// expect: the commit that writes the queue ends with the trailers Agent-M-Version (naming the instance commit), Agent-M-Participant: drafter-a and Agent-M-Model: model-a; the proposal itself, the section text of the entry, names none of the three
test("TST-579308: the commit of a derived queue names the Agent M version, the participant and the model, and the proposal's own text names none", async () => {
  const { w, prepared } = await derived({ candidates: [NEW_FINE] });
  await write(prepared.page);
  const [commit] = w.proposals();
  assert.match(commit.message, /^Agent-M-Version: abc123def4567890abc123def4567890abc123de, commit abc123def4567890abc123def4567890abc123de$/m);
  assert.match(commit.message, /^Agent-M-Participant: drafter-a$/m);
  assert.match(commit.message, /^Agent-M-Model: model-a$/m);
  const proposal = sectionOf(w);
  for (const named of ["drafter-a", "model-a", "abc123def4567890abc123def4567890abc123de", "Agent M"]) assert.ok(!proposal.includes(named), `the proposal does not name ${named}`);
});

// TST-579309 · level: release · module: system
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; UC-005
// given: the endpoint answers A FINE IS CHARGED from the passage ch. 5 and A SHELF IS LABELLED from the passage ch. 6, both new
// input: Run; Write proposals
// expect: each requirement written names its source and its passage in its own source field (SRC-policy, ch. 5; SRC-policy, ch. 6); the rationale of the entry names the source SRC-policy and both passages as its origin
test("TST-579309: a derived requirement and its entry name the source and the passage they descend from", async () => {
  const { w, prepared } = await derived({ candidates: [NEW_FINE, candidate("A SHELF IS LABELLED", { rule: "Every shelf is labelled.", passage: "ch. 6" })] });
  await write(prepared.page);
  const blocks = blocksOf(sectionOf(w));
  assert.equal(blocks.find((block) => block.name === "A FINE IS CHARGED").sources, "SRC-policy, ch. 5");
  assert.equal(blocks.find((block) => block.name === "A SHELF IS LABELLED").sources, "SRC-policy, ch. 6");
  assert.match(rationaleOf(w), /\*\*Origin\.\*\* Source SRC-policy, passages: ch\. 5; ch\. 6\./);
});

// TST-579310 · level: release · module: system
// guards: A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; UC-005
// given: the endpoint answers a new requirement; the product's default branch is trunk
// input: Run; Write proposals
// expect: the queue is committed directly to trunk, on the head the page read, in one commit and on no other branch; the entry is open: no approval record names it and no decision row exists in the queue's decision file
test("TST-579310: the derived queue enters the default branch directly and is open until an approval names it", async () => {
  const { w, prepared } = await derived({ candidates: [NEW_FINE] });
  const headBefore = w.product.head();
  await write(prepared.page);
  const [commit] = w.proposals();
  assert.equal(commit.branch, "trunk");
  assert.equal(commit.expectedHead, headBefore);
  assert.equal(w.proposals().length, 1);
  const decisions = Object.entries(writtenFiles(w)).find(([path]) => path.endsWith("entscheidungen.md"))[1];
  assert.doesNotMatch(decisions, /\|/, "no decision row");
  assert.deepEqual(Object.keys(w.product.files()).filter((path) => path.startsWith("docs/approvals/")), []);
});

// TST-579311 · level: release · module: system
// guards: ONE CLICK PER DECISION; UC-005
// given: the run panel is shown and the endpoint answers a new requirement
// input: the person presses Run once, then Write proposals once
// expect: Run alone sends the request and returns the candidates, with no further click; Write proposals alone writes the queue, in one commit, with no further click; a script's click on either does nothing
test("TST-579311: Run and Write proposals are one click each and decide everything that follows", async () => {
  const w = await world({ answers: { candidates: [NEW_FINE] } });
  const prepared = await w.prepare({ files: [MAIN_FILE] });
  find(prepared.page, (node) => node.localName === "button" && node.textContent === "Run")[0].dispatchEvent(scripted("click"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(w.requests.length, 0);
  const panel = await w.run(prepared);
  assert.equal(w.requests.length, 1);
  byClass(panel, "button", "write-proposals")[0].dispatchEvent(scripted("click"));
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.deepEqual(w.proposals(), []);
  await write(prepared.page);
  assert.equal(w.proposals().length, 1);
});

// ---------------------------------------------------------------- what a requirement constrains, what the participant sees

// TST-579312 · level: release · module: system
// guards: A REQUIREMENT NAMES WHAT IT CONSTRAINS; UC-005
// given: the instance holds its own SPEC; the endpoint answers A FINE IS CHARGED, which constrains the product, and A GATE NAMES ITS DECIDER, which constrains the process; and, apart, an answer whose candidate does not say what it constrains
// input: Run; Write proposals; and apart Run with the candidate that says nothing of it
// expect: the process requirement is written to the instance's queue only and the product requirement to the product's queue only; the panel marks the process candidate "Constrains the process."; the candidate that says nothing of what it constrains goes back to the participant as an answer that cannot be read, naming `constrains`
test("TST-579312: a requirement stands where it is what it constrains: the product's in the product's queue, the process's in the instance's", async () => {
  const { w, prepared, panel } = await derived({ candidates: [NEW_FINE, candidate("A GATE NAMES ITS DECIDER", { rule: "Every gate names its decider.", constrains: "process" })] }, { instance: { spec: INSTANCE_SPEC } });
  assert.deepEqual(byClass(panel, "p", "constrains-process").map(textOf), ["Constrains the process."]);
  await write(prepared.page);
  const product = Object.values(writtenFiles(w)).join("\n");
  assert.match(product, /\*\*A FINE IS CHARGED\*\*/);
  assert.doesNotMatch(product.split("\n").filter((line) => !line.startsWith("|")).join("\n"), /A GATE NAMES ITS DECIDER/);
  const instance = w.instance.writes();
  assert.equal(instance.length, 1);
  assert.ok(instance[0].files.some((file) => file.text.includes("**A GATE NAMES ITS DECIDER**")));
  assert.ok(instance[0].files.every((file) => !file.text.includes("A FINE IS CHARGED")));

  const silent = candidate("A FINE IS CHARGED", { rule: "A late loan is charged a fine." });
  delete silent.constrains;
  const apart = await derived(({ n }) => ({ draft: { candidates: [n === 1 ? silent : NEW_FINE] } }));
  assert.equal(apart.w.requests.length, 2);
  assert.match(findingLines(apart.w.requests[1].prompt).concat(apart.w.requests[1].prompt.split("\n")).join("\n"), /the answer cannot be read: [^\n]*constrains/);
});

// TST-579313 · level: release · module: system
// guards: DERIVATION SEES THE EXISTING REQUIREMENTS; UC-005
// given: a product whose SPEC holds two requirements and which has two open change queues, the first proposing A MEMBER CAN RENEW ONCE and the second proposing A MEMBER CAN RESERVE A BOOK
// input: show the run panel and press Run
// expect: the panel counts "4 existing requirements included."; the request holds every one of the four with its name, its rule and its state — the two of the SPEC "in SPEC", the two of the queues "open"
test("TST-579313: every requirement of the SPEC and of its open queues is part of the input the participant receives", async () => {
  const RESERVE = "A MEMBER CAN RESERVE A BOOK", reserve = text("## 3. Reservations", "", `**${RESERVE}** *(SRC-policy, ch. 4)*`, "Every member reserves a book.", "*Check:* `tests/reserve.test.mjs`");
  const second = { "docs/spec-freigaben/2026-10-21_reservations/index.md": text("# SPEC approvals - queue 2026-10-21 · reservations", "", "**Zieldatei aller Einträge:** `SPEC.md`", "", "| Nr | Datei | Anker (Überschrift, wortgetreu) | bis (exklusiv) | Commits |", "|---|---|---|---|---|", "| 01 | `SPEC.md` | ## 3. Reservations | — | — |"),
    "docs/spec-freigaben/2026-10-21_reservations/entscheidungen.md": text("# Decisions - queue 2026-10-21 reservations", "", "Append-only."), "docs/spec-freigaben/2026-10-21_reservations/01-reservations.md": reserve,
    "docs/spec-freigaben/2026-10-21_reservations/01-reservations.begruendung.md": text("# 3. Reservations: added", "", "**The change.** Adds a section.", "", "**Why.** Members reserve.", "", "**Impact list.**", `- ${RESERVE}: new; nothing names it yet.`, "", "**Origin.** fixture.") };
  const { w, prepared } = await derived({ candidates: [] }, { files: { ...PRODUCT_FILES, ...second } });
  assert.deepEqual(byClass(prepared.page, "p", "requirements-included").map(textOf), ["4 existing requirements included."]);
  const sent = w.requests[0].prompt;
  for (const [name, rule, state] of [[LOAN, LOAN_RULE, "in SPEC"], [SHELF, SHELF_RULE, "in SPEC"], [RENEW, "Every member renews a loan once.", "open"], [RESERVE, "Every member reserves a book.", "open"]]) {
    assert.ok(sent.includes(`**${name}**`), `${name} is sent`);
    assert.ok(sent.includes(rule), `${name}'s rule is sent`);
    assert.match(sent, new RegExp(`State: ${state}[^\\n]*\\n\\*\\*${name}\\*\\*`));
  }
});

// TST-579314 · level: release · module: system
// guards: NO REQUIREMENT IS LEFT OUT OF THE CONTEXT SILENTLY; UC-005
// given: the register lists small-d, whose context is 20 tokens, and big-d, whose context holds the input; the product has three existing requirements
// input: show the run panel for small-d; then for big-d and press Run
// expect: for small-d the page names the participant, the size it would receive and the context it holds, offers no Run and sends nothing; for big-d the one request holds all three existing requirements, none left out
test("TST-579314: when the existing requirements do not fit, nothing is sent and the page says so; when they fit, none is left out", async () => {
  const register = registerOf(DRAFTER, participantRow("small-d", { context: 20 }), participantRow("big-d", { context: 400000 }));
  const w = await world({ instance: { register }, answers: { candidates: [] } });
  const small = await w.prepare({ files: [MAIN_FILE], participant: "small-d" });
  assert.match(byClass(small.page, "p", "not-fitting")[0].textContent, /^small-d cannot hold what it would receive: \d+ tokens, its context holds 20$/);
  assert.equal(find(small.page, (node) => node.localName === "button" && node.textContent === "Run").length, 0);
  assert.equal(w.requests.length, 0);
  const big = await w.prepare({ page: small.page, files: [MAIN_FILE], participant: "big-d" });
  await w.run(big);
  for (const name of [LOAN, SHELF, RENEW]) assert.ok(w.requests[0].prompt.includes(`**${name}**`), `${name} is sent`);
});

// ---------------------------------------------------------------- the four classes

const FOUR_CLASSES = [NEW_FINE, candidate("THE DUE DATE IS SHOWN", { class: "change", of: LOAN, rule: "Every loan shows the date by which the book is returned, on the receipt.", passage: "ch. 1" }),
  candidate("A BOOK STANDS ON A SHELF", { class: "duplicate", of: SHELF, rule: SHELF_RULE, passage: "ch. 2" }), candidate("THE DUE DATE MAY BE HIDDEN", { class: "conflict", of: LOAN, rule: "A loan may hide its due date.", passage: "ch. 3" })];

// TST-579315 · level: release · module: system
// guards: A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT; UC-005
// given: the endpoint answers a new candidate, a change of A LOAN HAS A DUE DATE, a duplicate of A BOOK IS SHELVED and a conflict with A LOAN HAS A DUE DATE; and, apart, a change that names a requirement nothing holds (A BOOK IS NOT HERE), which a second answer fixes
// input: Run; and apart Run for the change that names nothing
// expect: the panel groups the four candidates as new, change, duplicate and conflict, each of the requirement it names; the change that names nothing goes back as an error under A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT naming "A BOOK IS NOT HERE", and the panel then shows the fixed class
test("TST-579315: every candidate is a new requirement, a change, a duplicate or a conflict, the last three of a named existing requirement", async () => {
  const { panel } = await derived({ candidates: FOUR_CLASSES });
  assert.deepEqual(groupsOf(panel), { change: ["THE DUE DATE IS SHOWN"], conflict: ["THE DUE DATE MAY BE HIDDEN"], duplicate: ["A BOOK STANDS ON A SHELF"], new: ["A FINE IS CHARGED"] });
  assert.equal(byClass(itemOf(panel, "THE DUE DATE IS SHOWN"), "input", "of")[0].value, LOAN);
  assert.equal(byClass(itemOf(panel, "A BOOK STANDS ON A SHELF"), "input", "of")[0].value, SHELF);
  assert.equal(byClass(itemOf(panel, "THE DUE DATE MAY BE HIDDEN"), "input", "of")[0].value, LOAN);
  const nothing = candidate("A BAD CHANGE", { class: "change", of: "A BOOK IS NOT HERE", rule: "A change of nothing." });
  const fixed = candidate("A BAD CHANGE", { class: "change", of: SHELF, rule: "A change of the shelf." });
  const apart = await derived(({ n }) => ({ draft: { candidates: [n === 1 ? nothing : fixed] } }));
  assert.match(findingLines(apart.w.requests[1].prompt)[0], /^A BAD CHANGE:\d+: error: "A BAD CHANGE" is classed change of "A BOOK IS NOT HERE", which no part of the job shows \[A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT\] — /);
  assert.deepEqual(groupsOf(apart.panel), { change: ["A BAD CHANGE"] });
  assert.equal(byClass(itemOf(apart.panel, "A BAD CHANGE"), "input", "of")[0].value, SHELF);
});

// TST-579316 · level: release · module: system
// guards: EXACT DUPLICATES ARE FOUND WITHOUT A MODEL; UC-005
// given: the endpoint answers, in every round, A BOOK STANDS ON A SHELF with the rule of A BOOK IS SHELVED in other capitals and spacing, classed new, and A LOAN HAS A DUE DATE with another rule than the existing one, classed change
// input: Run
// expect: the panel shows the first as a duplicate of A BOOK IS SHELVED although the model classed it new, and the second as a change of A LOAN HAS A DUE DATE, since a name alone is no duplicate; the second request names the exact duplicate in a finding "class it as duplicate of A BOOK IS SHELVED"
test("TST-579316: a candidate whose rule equals an existing rule is a duplicate whatever the model said, and a name alone is no duplicate", async () => {
  const { w, panel } = await derived({ candidates: [candidate("A BOOK STANDS ON A SHELF", { rule: "every  BOOK stands on a shelf." }),
    candidate(LOAN, { class: "change", of: LOAN, rule: "Every loan states its due date at its start." })] });
  assert.deepEqual(groupsOf(panel), { change: [LOAN], duplicate: ["A BOOK STANDS ON A SHELF"] });
  assert.equal(byClass(itemOf(panel, "A BOOK STANDS ON A SHELF"), "input", "of")[0].value, SHELF);
  assert.match(findingLines(w.requests[1].prompt).join("\n"), /class it as duplicate of A BOOK IS SHELVED/);
});

// TST-579317 · level: release · module: system
// guards: THE MODEL'S CLASSIFICATION IS MEASURED, NOT TRUSTED; UC-005
// given: the endpoint classes A FINE IS CHARGED as new; the person moves it to a duplicate of A BOOK IS SHELVED; its rate of right classes is reported by tests/test_derivation_classes.py and not gated here
// input: Run; read the class of each candidate; move A FINE IS CHARGED to duplicate of A BOOK IS SHELVED; Write proposals
// expect: every candidate is shown with its class in a field the person changes, and nothing is written before the person writes; what is written follows the person's class: A BOOK IS SHELVED gets the source of the candidate and A FINE IS CHARGED is written as no requirement of its own
test("TST-579317: the model's classes are shown to the person, who can change them, and what is written follows the person's", async () => {
  const { w, prepared, panel } = await derived({ candidates: [NEW_FINE, candidate("A SHELF IS LABELLED", { rule: "Every shelf is labelled.", passage: "ch. 6" })] });
  for (const name of ["A FINE IS CHARGED", "A SHELF IS LABELLED"]) assert.equal(byClass(itemOf(panel, name), "select", "class").length, 1, `${name}'s class is a field`);
  assert.equal(classOf(panel, "A FINE IS CHARGED"), "new");
  assert.deepEqual(w.proposals(), [], "nothing is written before the person writes");
  setClass(panel, "A FINE IS CHARGED", "duplicate", SHELF);
  await write(prepared.page);
  const blocks = blocksOf(sectionOf(w));
  assert.ok(!blocks.some((block) => block.name === "A FINE IS CHARGED"), "no requirement of its own");
  assert.match(blocks.find((block) => block.name === SHELF).sources, /SRC-policy, ch\. 5/);
  assert.ok(blocks.some((block) => block.name === "A SHELF IS LABELLED"), "the candidate left as the model classed it is written as it was");
});

// ---------------------------------------------------------------- change, duplicate, conflict, deduplication

// TST-579318 · level: release · module: system
// guards: A CHANGE IS PROPOSED UNDER THE EXISTING NAME; UC-005
// given: the endpoint answers THE DUE DATE IS SHOWN, a change of A LOAN HAS A DUE DATE with a new rule and check; and, apart, two candidates that change A LOAN HAS A DUE DATE
// input: Run; Write proposals; and apart Write proposals with the two changes
// expect: the entry holds the requirement under the name A LOAN HAS A DUE DATE with the candidate's rule and check and its sources kept and added to, no requirement named THE DUE DATE IS SHOWN, and every other byte of the section as the SPEC has it; with two changes of one requirement nothing is written and the page says the two cannot both stand
test("TST-579318: a change is proposed under the existing name, the rest of the section as it was, and two changes of one requirement are refused", async () => {
  const change = candidate("THE DUE DATE IS SHOWN", { class: "change", of: LOAN, rule: "Every loan shows the date by which the book is returned.", check: "`tests/due.test.mjs`", passage: "ch. 1" });
  const { w, prepared } = await derived({ candidates: [change] });
  await write(prepared.page);
  const section = sectionOf(w);
  assert.ok(section.startsWith("## 1. Lending\n"));
  assert.ok(section.includes(`**${LOAN}** *(SRC-handbook, ch. 1; SRC-policy, ch. 1)*\nEvery loan shows the date by which the book is returned.\n*Check:* \`tests/due.test.mjs\``));
  assert.ok(!section.includes("THE DUE DATE IS SHOWN"));
  assert.ok(section.includes(`**${SHELF}** *(SRC-handbook, ch. 2)*\n${SHELF_RULE}\n*Check:* \`tests/shelf.test.mjs\``), "the other requirement is as it was");

  const twice = await derived({ candidates: [change, candidate("THE DUE DATE IS SHOWN ON PAPER", { class: "change", of: LOAN, rule: "Every loan shows its due date on paper.", passage: "ch. 1" })] });
  await write(twice.prepared.page);
  assert.deepEqual(twice.w.proposals(), []);
  assert.match(byClass(twice.prepared.page, "p", "result").map(textOf).join(" "), /change A LOAN HAS A DUE DATE: one block would replace the other/);
});

// TST-579319 · level: release · module: system
// guards: A DUPLICATE ADDS A SOURCE, NOT A REQUIREMENT; UC-005
// given: the endpoint answers A BOOK STANDS ON A SHELF, a duplicate of A BOOK IS SHELVED (source SRC-handbook, ch. 2) from the passage ch. 4 of SRC-policy
// input: Run; Write proposals
// expect: the entry has no new requirement: the section holds the same two requirements as the SPEC, A BOOK IS SHELVED with its rule and check byte for byte and the source "SRC-policy, ch. 4" added after "SRC-handbook, ch. 2"
test("TST-579319: a candidate that restates a requirement is proposed as an added source of it, never as a requirement", async () => {
  const { w, prepared } = await derived({ candidates: [candidate("A BOOK STANDS ON A SHELF", { class: "duplicate", of: SHELF, rule: SHELF_RULE, passage: "ch. 4" })] });
  await write(prepared.page);
  const section = sectionOf(w);
  assert.deepEqual(blocksOf(section).map((block) => block.name), [LOAN, SHELF]);
  assert.ok(section.includes(`**${SHELF}** *(SRC-handbook, ch. 2; SRC-policy, ch. 4)*\n${SHELF_RULE}\n*Check:* \`tests/shelf.test.mjs\``));
  assert.ok(!section.includes("A BOOK STANDS ON A SHELF"));
});

// TST-579320 · level: release · module: system
// guards: A CONFLICT IS DECIDED BY A PERSON; UC-005
// given: the endpoint answers THE DUE DATE MAY BE HIDDEN, a conflict with A LOAN HAS A DUE DATE, from SRC-policy (normative); the existing requirement's source SRC-handbook is informational
// input: Run; Write proposals with the conflict left; then the person classes it as a change of A LOAN HAS A DUE DATE and writes again
// expect: the conflict stands on the panel beside A LOAN HAS A DUE DATE with both sources and their authorities; with the conflict left nothing is applied and nothing is dropped from the panel: no entry is written and the conflict is still listed; once decided, a second entry, 02, is added to the section's queue, which holds entry 01 already, and it holds A LOAN HAS A DUE DATE with the candidate's rule
test("TST-579320: a conflict is shown beside what it contradicts, neither applied nor dropped until the person decides, and then written as decided", async () => {
  const { w, prepared, panel } = await derived({ candidates: [candidate("THE DUE DATE MAY BE HIDDEN", { class: "conflict", of: LOAN, rule: "A loan may hide its due date.", passage: "ch. 3" }), NEW_FINE] });
  const item = textOf(itemOf(panel, "THE DUE DATE MAY BE HIDDEN"));
  assert.match(item, /SRC-policy is normative\./);
  assert.match(item, new RegExp(`${LOAN}[\\s\\S]*SRC-handbook, ch\\. 1 \\(informational\\)`));
  await write(prepared.page);
  assert.ok(!sectionOf(w).includes("THE DUE DATE MAY BE HIDDEN") && !sectionOf(w).includes("A loan may hide"), "not applied");
  assert.equal(classOf(panel, "THE DUE DATE MAY BE HIDDEN"), "conflict", "not dropped from the panel");
  setClass(panel, "THE DUE DATE MAY BE HIDDEN", "change", LOAN);
  await write(prepared.page);
  const decided = Object.entries(writtenFiles(w)).filter(([path]) => path.endsWith("02-lending.md")).map(([, body]) => body);
  assert.equal(decided.length, 1, "the decided conflict is the second entry of the section's queue, which already holds entry 01 (UC-005 step 8: each entry in its section's queue)");
  assert.ok(decided[0].includes(`**${LOAN}** *(SRC-handbook, ch. 1; SRC-policy, ch. 3)*\nA loan may hide its due date.`));
});

// TST-579321 · level: release · module: system
// guards: CANDIDATES ARE DEDUPLICATED AMONG THEMSELVES; UC-005
// given: the endpoint answers A FINE IS CHARGED (passage ch. 5) and LATE LOANS COST A FINE (passage ch. 6), which state the same rule, both new
// input: Run; Write proposals
// expect: the written section holds the rule "A late loan is charged a fine." once, in one requirement, whose source names both passages ch. 5 and ch. 6
test("TST-579321: candidates of one run that state the same rule are written as one requirement naming every passage", async () => {
  const { w, prepared } = await derived({ candidates: [NEW_FINE, candidate("LATE LOANS COST A FINE", { rule: "a late loan is charged a fine.", passage: "ch. 6" })] });
  await write(prepared.page);
  const added = blocksOf(sectionOf(w)).filter((block) => block.rule.toLowerCase() === "a late loan is charged a fine.");
  assert.equal(added.length, 1);
  assert.match(added[0].sources, /ch\. 5/);
  assert.match(added[0].sources, /ch\. 6/);
});

// ---------------------------------------------------------------- the impact list, the current text

// TST-579322 · level: release · module: system
// guards: A REQUIREMENT IS NOT CHANGED WITHOUT AN IMPACT LIST; UC-005
// given: the product holds UC-001, which realises A LOAN HAS A DUE DATE; the endpoint answers a change of A LOAN HAS A DUE DATE and a new requirement
// input: Run; Write proposals
// expect: the entry's rationale lists, under its impact list, A LOAN HAS A DUE DATE with UC-001 as what names it, and the new requirement as new with nothing naming it; the queue's index holds the entry as a row of its entry table and names no requirement; the impact list is written with the proposal, not after it
test("TST-579322: a change of a requirement is written with the list of what names it", async () => {
  const { w, prepared } = await derived({ candidates: [candidate("THE DUE DATE IS SHOWN", { class: "change", of: LOAN, rule: "Every loan shows its due date.", passage: "ch. 1" }), NEW_FINE] });
  await write(prepared.page);
  assert.equal(w.proposals().length, 1, "one commit holds the proposal and its impact list");
  assert.match(rationaleOf(w), /\*\*Impact list\.\*\*\n- A LOAN HAS A DUE DATE: named by UC-001 \(realises\)\.\n- A FINE IS CHARGED: new; nothing names it yet\./);
  const index = Object.entries(writtenFiles(w)).find(([path]) => path.endsWith("/index.md"))[1];
  assert.match(index, /\| 01 \| `SPEC.md` \| ## 1\. Lending \| — \| — \|/, "the queue's index holds the entry as a row of its table, whose columns are Nr, Datei, Anker, bis and Commits");
  assert.doesNotMatch(index, /UC-001/, "what names a requirement stands in the rationale's impact list, not in the index");
});

// TST-579323 · level: release · module: system
// guards: NO PROPOSAL WITHOUT THE CURRENT TEXT BESIDE IT; UC-005
// given: the endpoint answers a change of, a duplicate of and a conflict with requirements the SPEC holds, and a new candidate
// input: Run; read each candidate's item; change the requirement a candidate refers to by typing another name into its field
// expect: beside each of the three candidates stands the requirement it refers to as the SPEC holds it — its name, its whole rule, its sources with their authority and its check —, not a summary; the new candidate says it refers to no current requirement; typing another name shows that requirement's text instead
test("TST-579323: each candidate stands beside the whole current text of the requirement it refers to", async () => {
  const { panel } = await derived({ candidates: FOUR_CLASSES });
  const beside = (name) => textOf(byClass(itemOf(panel, name), "section", "current-requirement")[0]);
  for (const name of ["THE DUE DATE IS SHOWN", "THE DUE DATE MAY BE HIDDEN"]) {
    for (const part of [LOAN, LOAN_RULE, "Sources: SRC-handbook, ch. 1 (informational)", "Check: tests/loan.test.mjs"]) assert.ok(beside(name).includes(part), `${name}: ${part}`);
  }
  for (const part of [SHELF, SHELF_RULE, "Sources: SRC-handbook, ch. 2 (informational)", "Check: tests/shelf.test.mjs"]) assert.ok(beside("A BOOK STANDS ON A SHELF").includes(part), part);
  assert.match(beside("A FINE IS CHARGED"), /This candidate refers to no current requirement\./);
  const field = byClass(itemOf(panel, "THE DUE DATE IS SHOWN"), "input", "of")[0];
  field.value = SHELF;
  field.dispatchEvent(new Event("input"));
  assert.ok(beside("THE DUE DATE IS SHOWN").includes(SHELF_RULE));
  assert.ok(!beside("THE DUE DATE IS SHOWN").includes(LOAN_RULE));
});

// ---------------------------------------------------------------- the correction loop

// TST-579324 · level: release · module: system
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; UC-005
// given: the endpoint's first answer holds A MEMBER CAN RENEW TWICE without a check; its second answer corrects it; and, apart, an endpoint that gives the same flawed answer to every request
// input: Run; read the second request and the panel; and apart Run with the flawed endpoint
// expect: the second request holds the finding and the draft it concerns, and the participant is asked once more; the panel shows only the corrected check, not the first draft's; counter-proof: with the participant that never corrects, the person sees the flawed draft with its finding left
test("TST-579324: a draft that fails a check goes back with its findings, and the person sees the corrected draft", async () => {
  const flawed = candidate("A MEMBER CAN RENEW TWICE", { rule: "Every member renews a loan twice.", check: "" });
  const fixed = candidate("A MEMBER CAN RENEW TWICE", { rule: "Every member renews a loan twice.", check: "`tests/renew-twice.test.mjs`" });
  const { w, panel } = await derived(({ n }) => ({ draft: { candidates: [n === 1 ? flawed : fixed] } }));
  assert.equal(w.requests.length, 2);
  assert.match(w.requests[1].prompt, /A MEMBER CAN RENEW TWICE:\d+: error: no check \[A REQUIREMENT HAS FOUR FIELDS\]/);
  assert.match(w.requests[1].prompt, /"check": ""/, "the draft it concerns goes back with the finding");
  assert.equal(byClass(itemOf(panel, "A MEMBER CAN RENEW TWICE"), "textarea", "candidate-check").length + byClass(panel, "li", "left").length, 0, "no finding is left");
  const stubborn = await derived({ candidates: [flawed] });
  assert.equal(byClass(stubborn.panel, "li", "left").length, 1, "counter-proof: the finding is shown to the person");
});

// TST-579325 · level: release · module: system
// guards: A FINDING READS LIKE A COMPILER MESSAGE; UC-005
// given: the endpoint answers six flawed candidates, one for each kind of finding the checks give: a missing rule, a name not in capitals, a check that names no test, a rule with "additionally", a change naming nothing and an exact duplicate of an existing rule
// input: Run
// expect: every finding line of the second request is `<artifact>:<line>: <error|warning>: <what> [<rule>] — <fix>`: it names the artifact and a line, a kind, the rule by name in capitals between brackets, and the correction expected after a dash; six findings, each of its candidate's rule
test("TST-579325: every finding sent back names the artifact and line, its kind, its rule and the correction expected, in one form", async () => {
  const { w } = await derived({ candidates: [candidate("A NO RULE", { rule: "" }), candidate("a lower case name", { rule: "A thing is lower." }), candidate("A CHECK WITHOUT A TEST", { rule: "A thing is checked.", check: "by looking at it" }),
    candidate("A TOGGLE WORKS", { rule: "A toggle works additionally." }), candidate("A BAD CHANGE", { class: "change", of: "A BOOK IS NOT HERE", rule: "A change of nothing." }), candidate("A BOOK STANDS ON A SHELF", { rule: SHELF_RULE })] });
  const lines = findingLines(w.requests[1].prompt);
  assert.equal(lines.length, 6, lines.join("\n"));
  for (const line of lines) assert.match(line, /^[^\n:]+:\d+: (error|warning): [^\n]+ \[[A-Z][A-Z ,'-]+\] — [^\n]+\.$/, line);
  assert.deepEqual(lines.map((line) => /\[([^\]]+)\]/.exec(line)[1]), ["A REQUIREMENT HAS FOUR FIELDS", "EVERY ARTIFACT HAS AN IDENTIFIER", "A REQUIREMENT NAMES ITS CHECK", "ONE STATEMENT PER REQUIREMENT", "A CANDIDATE IS NEW, A CHANGE, A DUPLICATE OR A CONFLICT", "EXACT DUPLICATES ARE FOUND WITHOUT A MODEL"]);
});

// TST-579326 · level: release · module: system
// guards: AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; UC-005
// given: one endpoint answers a candidate whose rule says "and" and, to the finding, justifies it in one line; another answers a candidate without a check and, to the finding, says it is justified
// input: Run each
// expect: the justified warning ends the loop after round 2 with nothing left; the error that is only "justified" does not: the loop asks again and ends, the draft unchanged, with the error left on the panel; counter-proof: an error fixed ends the loop
test("TST-579326: a justified warning ends the loop, an error that is not fixed does not", async () => {
  const warned = candidate("A FINE IS CHARGED AND REPORTED", { rule: "A late loan is charged a fine and reported." });
  const justified = await derived(({ n, prompt }) => ({ draft: { candidates: [warned] }, answers: n === 1 ? [] : findingLines(prompt).map((finding) => ({ finding, how: "justified", text: "A charge and its report are one event." })) }));
  assert.equal(justified.w.requests.length, 2);
  assert.deepEqual(byClass(justified.panel, "li", "left").map(textOf), []);
  const noCheck = candidate("A MEMBER CAN RENEW TWICE", { rule: "Every member renews a loan twice.", check: "" });
  const argued = await derived(({ n, prompt }) => ({ draft: { candidates: [noCheck] }, answers: n === 1 ? [] : findingLines(prompt).map((finding) => ({ finding, how: "justified", text: "It needs none." })) }));
  assert.equal(byClass(argued.panel, "li", "left").length, 1, "the error is left");
  assert.ok(argued.w.requests.length >= 2);
  const fixed = await derived(({ n, prompt }) => ({ draft: { candidates: [n === 1 ? noCheck : { ...noCheck, check: "`tests/renew-twice.test.mjs`" }] }, answers: n === 1 ? [] : findingLines(prompt).map((finding) => ({ finding, how: "fixed" })) }));
  assert.equal(fixed.w.requests.length, 2);
  assert.deepEqual(byClass(fixed.panel, "li", "left").map(textOf), [], "counter-proof: the fixed error ends the loop");
});

// TST-579327 · level: release · module: system
// guards: WHAT A PERSON DECIDES IS NOT SENT BACK; UC-005
// given: the endpoint's first answer holds a conflict with A LOAN HAS A DUE DATE and a candidate without a check; its second answer fixes the check and leaves the conflict
// input: Run; read the second request; read the panel
// expect: the finding of the missing check goes back (known positive) and no message to the participant names the conflict's candidate THE DUE DATE MAY BE HIDDEN as a finding; the conflict stands on the panel for the person, in the class conflict
test("TST-579327: a conflict is shown to the person and never sent back to the participant", async () => {
  const conflict = candidate("THE DUE DATE MAY BE HIDDEN", { class: "conflict", of: LOAN, rule: "A loan may hide its due date.", passage: "ch. 3" });
  const first = [conflict, candidate("A MEMBER CAN RENEW TWICE", { rule: "Every member renews a loan twice.", check: "" })], second = [conflict, candidate("A MEMBER CAN RENEW TWICE", { rule: "Every member renews a loan twice." })];
  const { w, panel } = await derived(({ n }) => ({ draft: { candidates: n === 1 ? first : second } }));
  assert.equal(w.requests.length, 2);
  const lines = findingLines(w.requests[1].prompt);
  assert.equal(lines.length, 1, "known positive: the missing check goes back");
  assert.ok(lines.every((line) => !line.includes("THE DUE DATE MAY BE HIDDEN")));
  assert.deepEqual(groupsOf(panel).conflict, ["THE DUE DATE MAY BE HIDDEN"]);
});

// TST-579328 · level: release · module: system
// guards: THE CORRECTION LOOP HAS A FIXED LIMIT; UC-005
// given: the run panel states "Correction rounds: at most 5"; one endpoint never fixes its error and changes its candidate's name in every round; another gives the same flawed answer every round
// input: Run each
// expect: the first endpoint is asked exactly 5 times and the panel reads "Correction rounds: 5" with the finding left; the second is asked twice, the findings unchanged after round 2, and the panel reads "Correction rounds: 2" with the finding left
test("TST-579328: the loop ends at the limit stated before the first round, or earlier when a round leaves the findings unchanged", async () => {
  const names = ["A MEMBER CAN RENEW ONCE A YEAR", "A MEMBER CAN RENEW TWICE A YEAR", "A MEMBER CAN RENEW THRICE A YEAR", "A MEMBER CAN RENEW FOUR TIMES A YEAR", "A MEMBER CAN RENEW FIVE TIMES A YEAR", "A MEMBER CAN RENEW SIX TIMES A YEAR"];
  const moving = await derived(({ n }) => ({ draft: { candidates: [candidate(names[n - 1], { rule: "Every member renews a loan.", check: "" })] } }));
  assert.match(textOf(moving.prepared.panel), /Correction rounds: at most 5/);
  assert.equal(moving.w.requests.length, 5);
  assert.deepEqual(byClass(moving.panel, "p", "rounds").map(textOf), ["Correction rounds: 5"]);
  assert.equal(byClass(moving.panel, "li", "left").length, 1);
  const same = await derived({ candidates: [candidate("A MEMBER CAN RENEW TWICE", { rule: "Every member renews a loan.", check: "" })] });
  assert.equal(same.w.requests.length, 2);
  assert.deepEqual(byClass(same.panel, "p", "rounds").map(textOf), ["Correction rounds: 2"]);
  assert.equal(byClass(same.panel, "li", "left").length, 1);
});

// TST-579329 · level: release · module: system
// guards: THE ROUNDS ARE COUNTED AND SHOWN; UC-005
// given: the endpoint's first answer holds a candidate without a check and a rule with "and"; its second answer fixes the check and justifies the warning
// input: Run
// expect: the panel shows "Correction rounds: 2"; the job's record, committed with the end of the job, holds a section Rounds with "Round 1 — 2 findings" listing both findings and how each was answered (fixed, justified with its line), "Round 2 — 1 finding" listing the justified warning, and the line "Left: none · stopped because: passed · limit: 5"
test("TST-579329: the number of rounds and the findings of each are shown with the draft and recorded with the job", async () => {
  const first = candidate("A FINE IS CHARGED AND REPORTED", { rule: "A late loan is charged a fine and reported.", check: "" });
  const { w, panel } = await derived(({ n, prompt }) => ({ draft: { candidates: [n === 1 ? first : { ...first, check: "`tests/fine.test.mjs`" }] },
    answers: n === 1 ? [] : findingLines(prompt).map((finding) => (finding.includes(": warning: ") ? { finding, how: "justified", text: "One event." } : { finding, how: "fixed" })) }));
  assert.deepEqual(byClass(panel, "p", "rounds").map(textOf), ["Correction rounds: 2"]);
  const record = w.records().at(-1).text;
  assert.match(record, /### Round 1 — 2 findings\n- A FINE IS CHARGED AND REPORTED:\d+: error: no check \[A REQUIREMENT HAS FOUR FIELDS\]/);
  assert.match(record, /- A FINE IS CHARGED AND REPORTED:\d+: warning: the rule contains "and" \[ONE STATEMENT PER REQUIREMENT\][^\n]*\n  - justified: One event\./);
  assert.match(record, /\n  - fixed\n/);
  assert.match(record, /### Round 2 — 1 finding\n- A FINE IS CHARGED AND REPORTED:\d+: warning: the rule contains "and"/);
  assert.match(record, /Left: none · stopped because: passed · limit: 5/);
});

// TST-579330 · level: release · module: system
// guards: A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING; UC-005
// given: the book's chapter 8 in the instance's checkout, docs/sources/SRC-vibe-coding/2026-10-05/08_requirements-engineering.md
// input: show the run panel and press Run
// expect: the panel names the chapter's file as a part it sends; the request holds the chapter in full, every character of the file
test("TST-579330: the derivation sends chapter 8 of the book in full", async () => {
  const { w, prepared } = await derived({ candidates: [] });
  assert.match(textOf(prepared.panel), /08_requirements-engineering\.md — SRC-vibe-coding 2026-10-05/);
  const chapter = read("docs/sources/SRC-vibe-coding/2026-10-05/08_requirements-engineering.md");
  assert.ok(chapter.length > 20000, "known positive: the chapter is long");
  assert.ok(w.requests[0].prompt.includes(chapter.trim()), "the whole chapter is in the request");
});
