// Release tests of UC-022 "Derive the system architecture from requirements and use cases": each requirement UC-022 realises whose check is a test, checked from the requests the fake model endpoints and the fake registry
// received, the commits the product received and the pages the person reads — the files of the architecture as one decision, one module and one folder each, the draft checked as a whole by a reviewer of another model, its
// findings in the compiler's form and the correction loop with its limit and its rounds, the due diligence of a reuse decision, the architecture written open and accepted in one click, and the job's input. TST-448301 maps
// every requirement UC-022 realises to a release test that guards it, and names each requirement the SPEC leaves to review.
// Run: node --test tests/release-uc-022-derive-the-architecture.test.mjs
//
// Module: MOD-review-pages
// Module: MOD-job-runner
// Module: MOD-reuse-facts
// Module: MOD-approvals
// Module: MOD-artifact-edits
// Guards: UC-022
// Level: release
//
// Written for the release testing of sprint 142 by developer-sonnet-k (ITM-448). The Agent-M-Participant trailers of the code of UC-022 (git log --format='%h %(trailers:key=Agent-M-Participant)' -- src/review-pages
// src/job-runner src/reuse-facts src/approvals src/artifact-edits src/job-catalogue src/runtimes src/job-ledger src/documents) name developer-sonnet-k for ITM-1318 (the reviewer of an architecture draft receives the
// whole architecture), ITM-1317 (classifyCandidates leaves the artifact a candidate changes out of the search for a duplicate), ITM-1271 (the notes of the job that wrote a file), ITM-1355 (the links of a product's review
// page keep the product), ITM-1378 (queueJob names the endpoint and the secret on the CI route), ITM-1384, ITM-1349, ITM-1350, ITM-1346, ITM-1357, ITM-1358, ITM-1359 and ITM-1067 among others; most of the other commits
// there carry no trailer, so that their authors cannot be read. The behaviour of those items is guarded here in no release case, except where a requirement reaches it by another path of the code:
//   - what ITM-1318 built, that the reviewer of a draft receives the whole architecture of the default branch, is left out: THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT and NOTHING IS LEFT OUT OF AN
//     ARCHITECTURE PROMPT SILENTLY name, for the reviewer, tests/release-itm-1318-reviewer-whole-architecture.test.mjs (TST-1318102 and TST-1318103, written by developer-sonnet-l, who built none of it); the cases below guard
//     what the drafter is sent and what the page names;
//   - the links of the findings of the page (ITM-1355), the CI route's record (ITM-1378) and the notes of a job (ITM-1271) are asserted in no case of this file; the system cases
//     (tests/system-uc-022-derive-the-architecture.test.mjs), which the rule does not restrict, walk them.
// The world is tests/uc-022-harness.mjs; the release team works from the specification and the files: each case ends at the request a fixture received, at what the product holds and at what the page says. Readings the
// texts leave open, which the cases state:
//   - "the draft is checked only once it is complete, and then as a whole" (AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE) is read with the counter-proof of its check: a draft that lacks the decision stating the whole
//     architecture is not sent to the reviewer.
//   - "the person sees only the corrected draft" (AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT, A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT) is read as: the editors of the page that shows the draft hold
//     the corrected text, and the first draft's text stands on the page nowhere.
//   - "In one fixed text form" (A FINDING READS LIKE A COMPILER MESSAGE) is read as `<artifact>:<line>: <error|warning>: <what> [<RULE>] — <correction>.`, MOD-text-tools' form.
//   - "Shown with the draft" (THE ROUNDS ARE COUNTED AND SHOWN) is read as the page that shows the draft after Run, and the rounds of the job's record on the page of the whole architecture.
//   - "Who decided" (ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON) is read as the commit the page makes through the host connected with the person's token, whose message names the accepting person.
//   - "Names the Agent M version" (AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT) is read as the trailer Agent-M-Version, which the tab fills with the commit of the instance it read.
//   - "An error must be fixed, a warning fixed or justified": every finding of Agent M's own checks is an error and every finding of the reviewer a warning, as the cases show.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { statuses } from "../src/approvals/index.mjs";
import { historyMarks } from "../src/text-tools/index.mjs";
import { ARC_DRAFT, DRAFTER_ROW, FAR_ROW, INSTANCE_COMMIT, LOAN, MOD_DRAFT, READER_ROW, READY, REGISTER, REUSE_DRAFT, REVIEWER_ROW, SECRET_ENTRY, SECRET_LINK, SHELF, SPEC, SUB_DRAFT, TWIN_ROW, UC1, UC1_PATH, UC2,
  UC2_PATH, WORKFLOW, approvalOf, architecturePaths, badge, byClass, choose, click, decision, derive, draftOf, editorOf, endpoints, fakeProduct, fileOf, filesOf, find, jobRecord, moduleFile, onDisk,
  packageData, panelFor, participantNames, realFetch, recordsOf, registerOf, registryOf, reply, run, runButtons, show, text, until, useCase, without, writeProposals, writesTo } from "./uc-022-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SELF = "tests/release-uc-022-derive-the-architecture.test.mjs";
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
const cellsOf = (target) => find(byClass(target, "section", "due-diligence")[0], (node) => node.localName === "tr").map((each) => find(each, (node) => node.localName === "td").map((cell) => cell.textContent.trim())).filter((row) => row.length);
const WRITTEN = ["docs/architecture/ARC-001-system.md", "docs/architecture/ARC-002-lending.md", "docs/architecture/ARC-003-the-loan-package.md", "docs/architecture/MOD-lending.md"];
/** The architecture derived and written open: the product after Write proposals. */
async function written(fake = fakeProduct(), extra = {}) {
  ready(extra);
  const target = await derive(fake);
  await writeProposals(target);
  return fake;
}

test.afterEach(() => { globalThis.fetch = realFetch; });

// ---------------------------------------------------------------- the map

// Each requirement UC-022 realises whose check is a test, with the release tests that guard it.
const OTHER_1318 = "tests/release-itm-1318-reviewer-whole-architecture.test.mjs";
const EVIDENCE = {
  "ONE ARCHITECTURE DECISION, ONE FILE": [[SELF, "TST-448302"]],
  "AN ARCHITECTURE DECISION STATES CONTEXT, DECISION, ALTERNATIVES AND CONSEQUENCES": [[SELF, "TST-448303"]],
  "ONE MODULE, ONE FILE": [[SELF, "TST-448304"]],
  "A MODULE FILE IS REVIEWED AS AN ARCHITECTURE DECISION IS": [[SELF, "TST-448305"]],
  "A MODULE IS A FOLDER": [[SELF, "TST-448306"]],
  "ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES": [[SELF, "TST-448307"]],
  "THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE": [[SELF, "TST-448308"]],
  "THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT": [[SELF, "TST-448309"], [OTHER_1318, "TST-1318102"]],
  "NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY": [[SELF, "TST-448310"], [OTHER_1318, "TST-1318103"]],
  "ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS": [[SELF, "TST-448311"]],
  "AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE": [[SELF, "TST-448312"]],
  "AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT": [[SELF, "TST-448313"]],
  "NO REVIEWER IS THE DRAFTER": [[SELF, "TST-448314"]],
  "A REVIEWER'S FINDING IS A WARNING": [[SELF, "TST-448315"]],
  "A REUSE DECISION RECORDS ITS DUE DILIGENCE": [[SELF, "TST-448316"]],
  "DUE DILIGENCE IS FETCHED, NOT RECALLED": [[SELF, "TST-448317"]],
  "A PRODUCT DECLARES ITS LICENCE": [[SELF, "TST-448318"]],
  "A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S": [[SELF, "TST-448319"]],
  "EVERY ARTIFACT NAMES ITS ORIGIN": [[SELF, "TST-448320"]],
  "DIAGRAMS ARE MERMAID IN MARKDOWN": [[SELF, "TST-448321"]],
  "A GENERATED ARTIFACT IS A PROPOSAL": [[SELF, "TST-448322"]],
  "A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN": [[SELF, "TST-448323"]],
  "ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON": [[SELF, "TST-448324"]],
  "SEVERAL FILES ARE ACCEPTED IN ONE CLICK": [[SELF, "TST-448325"]],
  "ONE REVIEW LAYOUT FOR EVERY PRODUCT": [[SELF, "TST-448326"]],
  "AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT": [[SELF, "TST-448327"]],
  "A DOCUMENT HOLDS NO HISTORY": [[SELF, "TST-448328"]],
  "THE PAGE NAMES WHERE IT SENDS": [[SELF, "TST-448329"]],
  "RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS": [[SELF, "TST-448330"]],
  "EVERY STEP EXPLAINS ITSELF": [[SELF, "TST-448331"], [SELF, "TST-448332"]],
  "A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT": [[SELF, "TST-448333"]],
  "A FINDING READS LIKE A COMPILER MESSAGE": [[SELF, "TST-448334"]],
  "AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED": [[SELF, "TST-448335"]],
  "WHAT A PERSON DECIDES IS NOT SENT BACK": [[SELF, "TST-448336"]],
  "THE CORRECTION LOOP HAS A FIXED LIMIT": [[SELF, "TST-448337"]],
  "THE ROUNDS ARE COUNTED AND SHOWN": [[SELF, "TST-448338"]],
  "AN ARCHITECTURE JOB RECEIVES THE CHAPTERS ON MODELING, ARCHITECTURE, DESIGN AND IMPLEMENTATION": [[SELF, "TST-448339"]],
};
// The requirements UC-022 realises that the SPEC checks at review and by no test; each is named here and has no release test.
const REVIEW = ["AN ARCHITECTURE IS THE ORGANISATION OF THE WHOLE SYSTEM", "AN ARCHITECTURE STATES STRUCTURE, INTERACTION AND STRATEGY", "A SYSTEM IS DECOMPOSED INTO SUBSYSTEMS AND MODULES", "A MODULE BELONGS TO ONE SUBSYSTEM",
  "AN ARCHITECTURE IS DOCUMENTED IN FOUR VIEWS", "THE USE CASES ARE THE SCENARIOS OF THE ARCHITECTURE", "THE ARCHITECTURE DOES NOT RESTATE THE USE CASES", "THE ARCHITECTURE IS CUT BY FUNCTION, NOT BY USE-CASE STEP",
  "AN ARCHITECTURE NAMES ITS PATTERNS", "AN ARCHITECTURE STAYS AT THE LEVEL OF MODULES", "DIVIDE AND CONQUER", "DESIGN TO TEST", "KEEP IT SIMPLE", "YOU AREN'T GONNA NEED IT", "DON'T REPEAT YOURSELF", "LEAST ASTONISHMENT",
  "OPEN FOR EXTENSION, CLOSED FOR CHANGE", "DEVELOP AGAINST INTERFACES", "AN INTERFACE TELLS ITS USER WHAT TO CONSIDER", "AN INTERFACE HIDES ITS IMPLEMENTATION", "A REMOTE INTERFACE NAMES HOW IT FAILS", "A MODULE INTERFACE IS MINIMAL",
  "MODULES DEPEND ON EACH OTHER WITHOUT A CYCLE", "ONE DECISION STATES THE WHOLE ARCHITECTURE", "ONE DECISION PER SUBSYSTEM", "A MODULE STATES ITS RESPONSIBILITY AND ITS INTERFACES", "AN INTERFACE STATES ITS TYPES",
  "A DATA FORMAT IS DEFINED ONCE", "AN ARCHITECTURE IS DERIVED FROM THE WHOLE TO ITS MODULES", "AN ARCHITECTURE IS CHECKED BY REVIEW, NOT BY TESTS", "THE ARCHITECTURE IS REVIEWED AGAINST THE SPECIFICATION",
  "EVERY USE CASE IS CHECKED AGAINST THE ARCHITECTURE", "A SUBSYSTEM IS CHECKED AGAINST THE SYSTEM", "A MODULE IS CHECKED AGAINST ITS SUBSYSTEM", "A REVIEW FINDING IS WEIGHED BEFORE IT IS ACTED ON", "ONE CLICK PER DECISION"];
// The check line of a requirement in the SPEC: what follows `*Check:*` up to the next requirement.
const checkOf = (spec, name) => {
  const at = spec.indexOf(`**${name}**`);
  return at < 0 ? null : /\*Check:\*([^]*?)(?=\n\n\*\*|\n## |$)/.exec(spec.slice(at, at + 1800))?.[1].replace(/\s+/g, " ").trim() ?? null;
};

// TST-448301 · level: release · module: system
// guards: UC-022
// given: UC-022 as committed text, whose `realises` lists seventy-three requirements, the SPEC, and the release tests named in EVIDENCE
// input: read UC-022's list of the requirements it realises, the check line of each in the SPEC, and the declarations of the test files named for each
// expect: known positive — UC-022 realises seventy-three requirements; the SPEC checks thirty-seven by a test and thirty-six at review; each of the thirty-seven has at least one release test named, each of the others is named in REVIEW, and EVIDENCE and REVIEW together name exactly the requirements UC-022 realises; each test named stands in its file with the level release and guards that requirement
test("TST-448301: UC-022 every requirement it realises whose check is a test has a release test that guards it, and every one left to review is named", () => {
  const useCase = read("docs/use-cases/UC-022-derive-the-architecture.md");
  const front = useCase.slice(useCase.indexOf("realises:"), useCase.indexOf("\n---", useCase.indexOf("realises:")));
  const realised = [...front.matchAll(/^ {2}- (.+)$/gm)].map((match) => match[1]);
  assert.equal(realised.length, 73, "known positive: UC-022 realises seventy-three requirements");
  const spec = read("SPEC.md");
  const atReview = realised.filter((name) => /no automatic check; at review/.test(checkOf(spec, name) ?? ""));
  assert.equal(atReview.length, 36, "the SPEC checks thirty-six at review");
  assert.deepEqual([...atReview].sort(), [...REVIEW].sort(), "REVIEW names exactly those");
  const byTest = realised.filter((name) => !atReview.includes(name));
  assert.equal(byTest.length, 37);
  assert.deepEqual(Object.keys(EVIDENCE).sort(), [...byTest].sort(), "EVIDENCE names exactly the requirements checked by a test");
  for (const [name, tests] of Object.entries(EVIDENCE)) {
    assert.ok(tests.length > 0, `${name} names a test`);
    for (const [file, id] of tests) {
      assert.ok(existsSync(new URL(`../${file}`, import.meta.url)), `${name}: ${file} exists`);
      const declared = testDeclarations(file, read(file)).find((each) => each.id === id);
      assert.ok(declared, `${name}: ${id} is declared in ${file}`);
      assert.equal(declared.level, "release", `${id} is a release test`);
      assert.ok((declared.guards ?? []).includes(name), `${id} guards ${name}`);
    }
  }
});

// ---------------------------------------------------------------- the files of the architecture

// TST-448302 · level: release · module: system
// guards: ONE ARCHITECTURE DECISION, ONE FILE; UC-022
// given: the ready product; a drafter that returns three decisions, ARC-900, ARC-901 and ARC-902, and a module; and, for the counter-proof, a first draft whose second decision carries the identifier of the first
// input: Run, Write proposals; the files of docs/architecture/ afterwards
// expect: each decision is a file of its own named docs/architecture/ARC-<nnn>-<slug>.md that holds exactly one identifier, the number of its name; the three numbers differ and none is a placeholder of the draft (ARC-900 to ARC-902); counter-proof — the draft whose file holds an identifier other than the one of its name goes back with a finding that names both, and the file written is the corrected one
test("TST-448302: UC-022 each architecture decision is one file, named for its one identifier", async () => {
  const fake = await written();
  const decisions = architecturePaths(fake).filter((path) => /\/ARC-/.test(path));
  assert.equal(decisions.length, 3);
  const numbers = decisions.map((path) => {
    const number = /^docs\/architecture\/(ARC-\d{3})-[a-z0-9-]+\.md$/.exec(path)?.[1];
    assert.ok(number, `${path} is named docs/architecture/ARC-<nnn>-<slug>.md`);
    assert.deepEqual([...fake.files()[path].matchAll(/^id: (ARC-\d+)$/gm)].map((match) => match[1]), [number], `${path} holds one identifier, the one of its name`);
    return number;
  });
  assert.equal(new Set(numbers).size, 3, "the numbers differ");
  assert.ok(!numbers.some((number) => /ARC-90\d/.test(number)), "no placeholder identifier");

  const clash = draftOf();
  clash.files[1].text = clash.files[1].text.replace("id: ARC-901", "id: ARC-900");
  const seen = endpoints({ drafter: [reply(clash), reply(draftOf())], reviewer: [reply({ findings: [] })], registry: REG });
  const other = fakeProduct();
  await writeProposals(await derive(other));
  assert.ok(findingsOf(seen.drafter[1]).some((each) => each.startsWith("ARC-900:2: error: the key id is ARC-900, and the identifier its path gives is ARC-901")), "counter-proof: the file with another identifier goes back");
  assert.deepEqual([...other.files()["docs/architecture/ARC-002-lending.md"].matchAll(/^id: (\S+)$/gm)].map((match) => match[1]), ["ARC-002"], "and the corrected one is written");
});

// TST-448303 · level: release · module: system
// guards: AN ARCHITECTURE DECISION STATES CONTEXT, DECISION, ALTERNATIVES AND CONSEQUENCES; UC-022
// given: the ready product; for each of the sections Context, Decision, Alternatives and Consequences a drafter that first returns the system's decision without that section and then the complete draft
// input: Run for each of the four; the requests, and the decisions the product holds after Write proposals
// expect: for each section the second request carries one finding of the rule AN ARCHITECTURE DECISION STATES CONTEXT, DECISION, ALTERNATIVES AND CONSEQUENCES that names the missing section; every decision written holds all four sections; counter-proof — a complete draft is asked once
test("TST-448303: UC-022 a drafted decision without one of its four sections goes back naming the section", async () => {
  for (const name of ["Context", "Decision", "Alternatives", "Consequences"]) {
    const seen = endpoints({ drafter: [reply(draftOf({ system: { drop: [name] } })), reply(draftOf())], reviewer: [reply({ findings: [] })], registry: REG });
    const fake = fakeProduct();
    await writeProposals(await derive(fake));
    assert.equal(seen.drafter.length, 2, `${name}: asked again`);
    const found = findingsOf(seen.drafter[1]);
    assert.equal(found.length, 1, `${name}: ${found.join("\n")}`);
    assert.match(found[0], /\[AN ARCHITECTURE DECISION STATES CONTEXT, DECISION, ALTERNATIVES AND CONSEQUENCES\]/);
    assert.ok(found[0].includes(`## ${name}`), `${name}: the finding names the section`);
    for (const path of architecturePaths(fake).filter((each) => /\/ARC-/.test(each))) for (const each of ["Context", "Decision", "Alternatives", "Consequences"]) assert.ok(fake.files()[path].includes(`## ${each}\n`), `${path} holds ${each}`);
  }
  const whole = ready();
  await derive(fakeProduct());
  assert.equal(whole.drafter.length, 1, "counter-proof: a complete draft is asked once");
});

// TST-448304 · level: release · module: system
// guards: ONE MODULE, ONE FILE; UC-022
// given: the ready product; a drafter that returns the module MOD-lending; and, for the counter-proof, a first draft whose module file holds the identifier MOD-desk
// input: Run, Write proposals; the file of the module and the page of the whole architecture; the requests
// expect: the module is the single file docs/architecture/MOD-lending.md, holding one identifier, MOD-lending; the page of the whole architecture shows it as the module MOD-lending; counter-proof — the draft whose module file holds another identifier than the one of its name goes back with a finding that names both
test("TST-448304: UC-022 each module is one file named docs/architecture/MOD-<slug>.md, reviewed as the module of that name", async () => {
  const fake = fakeProduct();
  ready();
  const target = await derive(fake);
  const shown = await show(fake, { id: "all" });
  assert.deepEqual(filesOf(shown), [], "nothing is written before the click");
  await writeProposals(target);
  const modules = architecturePaths(fake).filter((path) => /\/MOD-/.test(path));
  assert.deepEqual(modules, ["docs/architecture/MOD-lending.md"]);
  assert.deepEqual([...fake.files()[modules[0]].matchAll(/^id: (MOD-[a-z0-9-]+)$/gm)].map((match) => match[1]), ["MOD-lending"]);
  assert.ok(fileOf(await show(fake, { id: "all" }), "MOD-lending"), "the page shows it as the module MOD-lending");

  const wrong = draftOf();
  wrong.files[3].text = wrong.files[3].text.replace("id: MOD-lending", "id: MOD-desk");
  const seen = endpoints({ drafter: [reply(wrong), reply(draftOf())], reviewer: [reply({ findings: [] })], registry: REG });
  await derive(fakeProduct());
  assert.ok(findingsOf(seen.drafter[1]).some((each) => each.startsWith("MOD-desk:2: error: the key id is MOD-desk, and the identifier its path gives is MOD-lending")), "counter-proof: the other identifier goes back");
});

// TST-448305 · level: release · module: system
// guards: A MODULE FILE IS REVIEWED AS AN ARCHITECTURE DECISION IS; UC-022
// given: the architecture written open; a person's approval record that names the text of MOD-lending alone
// input: the page of the whole architecture, the list of the module files and the statuses before and after the record
// expect: without a record the module file reads open in the list of the modules and stands, with the decisions, among the four files of the page of the whole architecture, Accept all 4 shown; counter-proof — a record that names another text does not accept it: the file reads changed since acceptance; with the record naming its text it reads accepted, the page shows the three decisions only, Accept all 3 shown, and the decisions still read open
test("TST-448305: UC-022 a module file is open until a record names its text, and is reviewed with the decisions", async () => {
  const fake = await written();
  const path = "docs/architecture/MOD-lending.md";
  assert.equal(await badge(fake, "MOD-lending", "module"), "open", "without a record it is open");
  const all = await show(fake, { id: "all" });
  assert.deepEqual(filesOf(all), ["ARC-001", "ARC-002", "MOD-lending", "ARC-003"]);
  assert.equal(byClass(all, "button", "accept-all")[0].textContent, "Accept all 4 shown");

  const stale = approvalOf(path, fake.files()[path].replace("It manages loans and returns.", "It manages loans."), "module");
  fake.land({ [stale.path]: stale.text });
  assert.equal(await badge(fake, "MOD-lending", "module"), "changed since acceptance", "counter-proof: a record of another text does not accept it");

  const record = approvalOf(path, fake.files()[path], "module");
  fake.land({ [record.path]: record.text });
  assert.equal(await badge(fake, "MOD-lending", "module"), "accepted", "with the record naming its text it is accepted");
  const after = await show(fake, { id: "all" });
  assert.deepEqual(filesOf(after), ["ARC-001", "ARC-002", "ARC-003"]);
  assert.equal(byClass(after, "button", "accept-all")[0].textContent, "Accept all 3 shown");
  assert.equal(await badge(fake, "ARC-001"), "open");
});

// TST-448306 · level: release · module: system
// guards: A MODULE IS A FOLDER; UC-022
// given: the ready product; (a) a draft whose module MOD-lending has the folder src/desk/; (b) a draft whose module has no folder key; each followed by the complete draft, whose module has the folder src/lending/
// input: Run for each; the requests, and the module file written
// expect: (a) the second request carries a finding of the rule A MODULE IS A FOLDER that says the folder src/desk/ is not named after the identifier and what to name it, lending; (b) a finding of the same rule that says the key folder is required; the module written has the folder src/lending/, named after MOD-lending
test("TST-448306: UC-022 a drafted module is one folder named after its identifier, or goes back", async () => {
  const swapped = draftOf();
  swapped.files[3].text = moduleFile({ folder: "src/desk/" });
  const without = draftOf();
  without.files[3].text = moduleFile().replace("folder: src/lending/\n", "");
  for (const [bad, wanted] of [[swapped, /^MOD-lending:\d+: error: MOD-lending has the folder src\/desk\/, which is not named after its identifier \[A MODULE IS A FOLDER\] — name the folder lending\./],
    [without, /^MOD-lending:\d+: error: the key folder is required, and left out \[A MODULE IS A FOLDER\]/]]) {
    const seen = endpoints({ drafter: [reply(bad), reply(draftOf())], reviewer: [reply({ findings: [] })], registry: REG });
    const fake = fakeProduct();
    await writeProposals(await derive(fake));
    assert.equal(seen.drafter.length, 2);
    const found = findingsOf(seen.drafter[1]);
    assert.equal(found.length, 1, found.join("\n"));
    assert.match(found[0], wanted);
    assert.match(fake.files()["docs/architecture/MOD-lending.md"], /\nfolder: src\/lending\/\n/);
  }
});

// ---------------------------------------------------------------- the preconditions

// TST-448307 · level: release · module: system
// guards: ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES; UC-022
// given: a product whose UC-002 has no approval record; the same product whose UC-002 is changed since its record; the ready product
// input: the person opens the drafting page, chooses drafter-a and reviewer-b and shows the run panel, for each
// expect: for the open and for the changed use case an error under the rule ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES names UC-002 and not UC-001, the panel offers no Run and nothing is sent to either endpoint; counter-proof — for the ready product the panel offers Run
test("TST-448307: UC-022 an architecture is not derived while a use case is open or changed since its acceptance", async () => {
  const seen = ready();
  const open = fakeProduct(without(READY, "docs/approvals/UC-002"));
  const changed = fakeProduct({ ...READY, [UC2_PATH]: UC2.replace("Shelve a book.", "Shelve a book at once.") });
  for (const fake of [open, changed]) {
    const target = await show(fake);
    const found = byClass(target, "p", "finding");
    assert.equal(found.length, 1);
    assert.match(found[0].textContent, /^error: use cases that are not accepted: UC-002 \((is open|has changed since it was accepted)\)/);
    assert.match(found[0].textContent, /\[ARCHITECTURE IS DESIGNED ONLY AGAINST ACCEPTED USE CASES\]/);
    assert.ok(!/UC-001/.test(found[0].textContent));
    assert.equal(runButtons(await panelFor(target)).length, 0, "no Run");
  }
  assert.equal(seen.drafter.length + seen.reviewer.length, 0, "nothing sent");
  assert.equal(runButtons(await panelFor(await show(fakeProduct()))).length, 1, "counter-proof: the ready product offers Run");
});

// TST-448308 · level: release · module: system
// guards: THE FIRST ARCHITECTURE IS DESIGNED AS A WHOLE; UC-022
// given: a product with three requirements and three accepted use cases; a product that holds an architecture decision already
// input: the person opens the drafting page of each and shows the run panel
// expect: the first page lists all three requirements and all three use cases as covered, and offers no selection among them — no checkbox, no choice —; the second says it has an architecture already, names UC-023, and its panel offers no Run
test("TST-448308: UC-022 the first architecture covers every requirement and every use case with no selection, and is not drafted beside an existing one", async () => {
  ready();
  const target = await show(fakeProduct(three()));
  const covers = byClass(target, "section", "covers")[0];
  assert.deepEqual(byClass(covers, "li", "requirement").map((item) => item.textContent).sort(), [LOAN, RENEW, SHELF].sort());
  assert.deepEqual(byClass(covers, "li", "use-case").map((item) => item.textContent), ["UC-001", "UC-002", "UC-003"]);
  assert.equal(find(target, (node) => node.localName === "input" && (node.type === "checkbox" || node.type === "text")).length, 0, "no selection");
  assert.equal(find(target, (node) => node.localName === "select").length, 0, "no choice");

  const existing = await show(fakeProduct({ ...READY, "docs/architecture/ARC-001-system.md": text("---", "id: ARC-001", "title: System", "---", "# ARC-001 System") }));
  assert.match(byClass(existing, "p", "finding")[0].textContent, /the product has an architecture already/);
  assert.ok(find(existing, (node) => node.localName === "a").some((link) => /UC-023/.test(link.textContent)), "UC-023 is named");
  assert.equal(runButtons(await panelFor(existing)).length, 0, "no Run");
});
const RENEW = "A MEMBER CAN RENEW ONCE";
const UC3_PATH = "docs/use-cases/UC-003-renew-a-loan.md";
const UC3 = useCase("UC-003", "Renew a loan", [RENEW]);
/** The ready product with a third requirement and a third accepted use case. */
const three = () => ({ ...READY, "SPEC.md": `${SPEC}\n**${RENEW}** *(Product Owner)*\nA member renews a loan at most once.\n*Check:* \`tests/renew.test.mjs\`\n`, [UC3_PATH]: UC3, [approvalOf(UC3_PATH, UC3).path]: approvalOf(UC3_PATH, UC3).text });

// TST-448309 · level: release · module: system
// guards: THE ARCHITECTURE'S PARTICIPANTS RECEIVE THE WHOLE PROJECT; UC-022
// given: a product with three requirements and three accepted use cases; drafter-a and reviewer-b; and, for the counter-proof, the same product with a fourth use case that has no record
// input: Run; the request the drafter receives is read; the page of the second product
// expect: the request holds the whole SPEC, with all three requirements and their rules, and UC-001, UC-002 and UC-003 each whole; it holds no part named for the architecture, since the product has none; counter-proof — with the fourth use case open the page names UC-004, the panel offers no Run and nothing of it is sent
test("TST-448309: UC-022 the drafter receives the whole SPEC and every accepted use case", async () => {
  const seen = ready();
  const files = three();
  await derive(fakeProduct(files));
  assert.equal(seen.drafter.length, 1);
  const sent = seen.drafter[0].sent;
  assert.ok(sent.includes(files["SPEC.md"].trim()), "the whole SPEC");
  for (const [id, body] of [["UC-001", UC1], ["UC-002", UC2], ["UC-003", UC3]]) assert.ok(sent.includes(body.trim()), `${id} whole`);
  assert.ok(!sent.includes("The whole architecture as it stands"), "no architecture part: the product has none");

  const UC4_PATH = "docs/use-cases/UC-004-reserve-a-book.md", UC4 = useCase("UC-004", "Reserve a book", [SHELF]);
  const target = await show(fakeProduct({ ...files, [UC4_PATH]: UC4 }));
  assert.match(byClass(target, "p", "finding")[0].textContent, /UC-004/, "counter-proof: the fourth use case is open and named");
  assert.equal(runButtons(await panelFor(target)).length, 0, "no Run");
  assert.equal(seen.drafter.length, 1, "and nothing of it is sent");
});

// TST-448310 · level: release · module: system
// guards: NOTHING IS LEFT OUT OF AN ARCHITECTURE PROMPT SILENTLY; UC-022
// given: the ready product; small-d, whose context holds 50000 tokens, which the input exceeds; drafter-a, whose context holds it
// input: the person chooses small-d as drafter, then as reviewer, and shows the run panel; then drafter-a with reviewer-b
// expect: the panel names small-d as not fitting with the size of the input and the context, for the drafter and for the reviewer; it lists for it every part of the input — SPEC.md, both use cases and the four chapters —, none left out; it offers no Run and nothing is sent; counter-proof — drafter-a with reviewer-b names nothing as not fitting and offers Run
test("TST-448310: UC-022 a participant that cannot hold the input is named, nothing is left out or sent", async () => {
  const seen = ready();
  const target = await show(fakeProduct());
  for (const [drafter, reviewer, name] of [["small-d", "reviewer-b", "small-d"], ["drafter-a", "small-d", "small-d"]]) {
    const panel = await panelFor(target, drafter, reviewer);
    const notFitting = byClass(panel, "p", "not-fitting");
    assert.equal(notFitting.length, 1);
    assert.match(notFitting[0].textContent, new RegExp(`^${name} cannot hold what it would receive: \\d+ tokens, its context holds 50000$`));
    for (const destination of byClass(panel, "section", "destination")) assert.equal(byClass(destination, "li", "part").length, 7, "every part is listed");
    assert.equal(runButtons(target).length, 0, "no Run");
  }
  assert.equal(seen.drafter.length + seen.reviewer.length, 0, "nothing sent");
  const fits = await panelFor(target, "drafter-a", "reviewer-b");
  assert.deepEqual(byClass(fits, "p", "not-fitting"), [], "counter-proof: a larger context fits");
  assert.equal(runButtons(fits).length, 1);
});

// TST-448311 · level: release · module: system
// guards: ARCHITECTURE RESTS ON ACCEPTED ARTIFACTS; UC-022
// given: the architecture written open; UC-002, which ARC-001 names, changed so that no record names its text; then a record that names its changed text
// input: Accept all on the page of the whole architecture, twice
// expect: the first click records the other three files and leaves out ARC-001, which the page names with UC-002; counter-proof — once the record names UC-002's text, the page shows ARC-001 and its click records it
test("TST-448311: UC-022 a file of the architecture is not accepted while a use case it names is not", async () => {
  const fake = await written();
  const changedText = UC2.replace("Shelve a book.", "Shelve a book at once.");
  fake.land({ [UC2_PATH]: changedText });
  const all = await show(fake, { id: "all" });
  click(byClass(all, "button", "accept-all")[0]);
  await until(() => byClass(all, "p", "result").length === 1, "the message");
  assert.match(byClass(all, "p", "result")[0].textContent, /ARC-001 was left out: rests on what is not accepted \(UC-002\)\./);
  assert.deepEqual(fake.writes().at(-1).files.map((file) => file.path.replace(/-[0-9a-f]{12}\.md$/, "")), ["docs/approvals/ARC-002", "docs/approvals/MOD-lending", "docs/approvals/ARC-003"]);
  assert.equal(await badge(fake, "ARC-001"), "open");

  fake.land({ [approvalOf(UC2_PATH, changedText).path]: approvalOf(UC2_PATH, changedText).text });
  const again = await show(fake, { id: "all" });
  assert.deepEqual(filesOf(again), ["ARC-001"]);
  assert.deepEqual(byClass(fileOf(again, "ARC-001"), "li", "open-name"), [], "nothing is open any more");
  click(byClass(again, "button", "accept-all")[0]);
  await until(() => byClass(again, "p", "nothing").length === 1, "the page drawn again");
  assert.equal(await badge(fake, "ARC-001"), "accepted", "counter-proof: it is accepted once UC-002 is");
});

// ---------------------------------------------------------------- the check of the whole

// TST-448312 · level: release · module: system
// guards: AN ARCHITECTURE IS CHECKED WHEN IT IS COMPLETE; UC-022
// given: the ready product; (a) a drafter that returns the complete draft; (b) a drafter that returns a draft without the decision that states the whole architecture — every decision refines another
// input: Run for each; the requests the reviewer receives
// expect: known positive (a) — the reviewer is sent the complete draft, all four files, in one request; counter-proof (b) — no review starts for a draft that lacks the decision stating the whole architecture: the reviewer is not asked while the draft lacks it
test("TST-448312: UC-022 the draft is checked by the reviewer only once it is complete", async () => {
  const complete = ready();
  await derive(fakeProduct());
  assert.equal(complete.reviewer.length, 1, "known positive: the complete draft is checked");
  for (const path of [ARC_DRAFT, SUB_DRAFT, REUSE_DRAFT, MOD_DRAFT]) assert.ok(complete.reviewer[0].sent.includes(path), `known positive: the reviewer receives ${path}`);

  const incomplete = draftOf();
  incomplete.files = incomplete.files.filter((file) => file.path !== ARC_DRAFT);
  const seen = endpoints({ drafter: [reply(incomplete)], reviewer: [reply({ findings: [] })], registry: REG });
  await derive(fakeProduct());
  assert.equal(seen.reviewer.length, 0, "no review starts for a draft that lacks the decision stating the whole architecture");
});

// TST-448313 · level: release · module: system
// guards: AN ARCHITECTURE DRAFT IS CHECKED BEFORE A PERSON SEES IT; UC-022
// given: the ready product; a reviewer that first finds one thing in the system's decision and then nothing; a drafter whose second draft has the sentence "The shelf belongs to the lending subsystem." that the first lacks
// input: Run; the page that shows the draft, and the product's commits
// expect: the editors of the page hold the second draft, with the sentence, and the first draft's text — without it — stands in no editor; the reviewer was asked on the first draft and again on the second; nothing was written to the architecture before the person's click
test("TST-448313: UC-022 the draft is checked and corrected before the person sees it, and the person sees the corrected draft", async () => {
  const corrected = draftOf();
  corrected.files[0].text = corrected.files[0].text.replace("The library is a desk and a shelf.", "The library is a desk and a shelf. The shelf belongs to the lending subsystem.");
  const seen = endpoints({ drafter: [reply(draftOf()), reply(corrected)], reviewer: [reply({ findings: [SYSTEM_FINDING] }), reply({ findings: [] })], registry: REG });
  const fake = fakeProduct();
  const target = await derive(fake);
  assert.deepEqual([seen.drafter.length, seen.reviewer.length], [2, 2]);
  assert.ok(seen.reviewer[0].sent.includes("The library is a desk and a shelf.") && !seen.reviewer[0].sent.includes("The shelf belongs to the lending subsystem."), "the reviewer checked the first draft");
  assert.ok(seen.reviewer[1].sent.includes("The shelf belongs to the lending subsystem."), "and then the second");
  assert.ok(editorOf(target, ARC_DRAFT).value.includes("The shelf belongs to the lending subsystem."), "the person sees the corrected draft");
  assert.notEqual(editorOf(target, ARC_DRAFT).value, draftOf().files[0].text, "and the first draft stands in no editor");
  assert.deepEqual(architecturePaths(fake), [], "nothing is written before the click");
});

// TST-448314 · level: release · module: system
// guards: NO REVIEWER IS THE DRAFTER; UC-022
// given: an instance whose list holds drafter-a (model-a), twin-a (model-a), reviewer-b (model-b); and a list of drafter-a and twin-a only
// input: the person chooses drafter-a on the page of each and shows the run panel
// expect: the reviewers offered after drafter-a are reviewer-b only — not drafter-a itself and not twin-a, which uses its model —; with the list of the two of the same model no reviewer is offered, the panel lists NO REVIEWER IS THE DRAFTER as blocking, offers no Run and nothing is sent; counter-proof — a reviewer of another model is accepted: Run is offered with reviewer-b
test("TST-448314: UC-022 a reviewer that is the drafter or uses its model is refused before anything is sent", async () => {
  const seen = ready();
  const target = await show(fakeProduct(), { id: "draft" }, { register: registerOf(DRAFTER_ROW, TWIN_ROW, REVIEWER_ROW, READER_ROW) });
  choose(target, "participant", "drafter-a");
  assert.deepEqual(participantNames(target, "reviewer"), ["reviewer-b"]);
  assert.equal(runButtons(await panelFor(target, "drafter-a", "reviewer-b")).length, 1, "counter-proof: another model is accepted");

  const same = await show(fakeProduct(), { id: "draft" }, { register: registerOf(DRAFTER_ROW, TWIN_ROW, READER_ROW) });
  choose(same, "participant", "drafter-a");
  assert.deepEqual(participantNames(same, "reviewer"), []);
  click(byClass(same, "button", "prepare")[0]);
  await until(() => byClass(same, "section", "run-panel").length === 1, "the run panel");
  const panel = byClass(same, "section", "run-panel")[0];
  assert.match(byClass(panel, "li", "blocking")[0].textContent, /\[NO REVIEWER IS THE DRAFTER\]/);
  assert.equal(runButtons(panel).length, 0, "no Run");
  assert.equal(seen.drafter.length + seen.reviewer.length, 0, "nothing sent");
});

// TST-448315 · level: release · module: system
// guards: A REVIEWER'S FINDING IS A WARNING; UC-022
// given: the ready product; a reviewer that gives its finding as an error; (a) a drafter that answers it justified, with a reason; (b) a drafter that leaves it unanswered
// input: Run for each; the requests, the page and the job's record
// expect: the finding goes back to the drafter as a warning; (a) a justification ends the loop: the finding is settled, the loop stopped because passed, nothing left; (b) counter-proof — an unanswered finding does not: the loop ends at a round that leaves it as it was, stopped because unchanged, one finding left
test("TST-448315: UC-022 a reviewer's finding is a warning: justified it ends the loop, unanswered it does not", async () => {
  const finding = { ...SYSTEM_FINDING, kind: "error" };
  const justified = [{ finding: lineOf(SYSTEM_FINDING), how: "justified", text: "the system's decision names the shelf" }];
  const a = endpoints({ drafter: [reply(draftOf()), reply(draftOf(), justified)], reviewer: [reply({ findings: [finding] })], registry: REG });
  const first = fakeProduct();
  const target = await derive(first);
  assert.deepEqual(findingsOf(a.drafter[1]), [lineOf(SYSTEM_FINDING)], "it goes back as a warning");
  assert.match(jobRecord(first).text, /stopped because: passed · limit: 5/);
  assert.match(byClass(target, "p", "left-count")[0].textContent, /^Left: none$/);

  const b = endpoints({ drafter: [reply(draftOf())], reviewer: [reply({ findings: [finding] })], registry: REG });
  const second = fakeProduct();
  const other = await derive(second);
  assert.equal(b.drafter.length, 2, "asked once more, and then the round left it as it was");
  assert.match(jobRecord(second).text, /stopped because: unchanged · limit: 5/);
  assert.match(byClass(other, "p", "left-count")[0].textContent, /^Left: 1 finding$/, "counter-proof: the unanswered finding is left");
});

// ---------------------------------------------------------------- the due diligence

// TST-448316 · level: release · module: system
// guards: A REUSE DECISION RECORDS ITS DUE DILIGENCE; UC-022
// given: the ready product; a further decision that adopts loan-lib against shelf-lib; and, for the counter-proof, the same with a registry the browser cannot call
// input: Run, Write proposals; the files written
// expect: the further decision is written with a section Due diligence that holds a row for the candidate and one for its alternative; the other decisions, which adopt nothing, have none; counter-proof — with the registry unreachable the decision is shown without the section and Write proposals writes no file of the architecture
test("TST-448316: UC-022 a reuse decision is written with its due diligence, and not without", async () => {
  const fake = await written();
  const files = fake.files();
  assert.match(files["docs/architecture/ARC-003-the-loan-package.md"], /\n## Due diligence\n[^]*\| loan-lib \(npm\) - chosen \|[^]*\| shelf-lib \(npm\) \|/);
  assert.ok(!files["docs/architecture/ARC-001-system.md"].includes("## Due diligence") && !files["docs/architecture/ARC-002-lending.md"].includes("## Due diligence"), "a decision that adopts nothing has none");

  endpoints({ drafter: [reply(draftOf({ candidate: "blocked-lib" }))], reviewer: [reply({ findings: [] })], registry: { "https://registry.npmjs.org/blocked-lib": new TypeError("Failed to fetch"), ...registryOf(["shelf-lib", "MIT"]) } });
  const blocked = fakeProduct();
  const target = await derive(blocked);
  assert.ok(!editorOf(target, REUSE_DRAFT).value.includes("## Due diligence"), "counter-proof: shown without the section");
  await writeProposals(target);
  assert.equal(writes(blocked).length, 0, "and not written");
  assert.equal(byClass(target, "p", "due-diligence-missing").length, 1);
});

// TST-448317 · level: release · module: system
// guards: DUE DILIGENCE IS FETCHED, NOT RECALLED; UC-022
// given: the ready product; a registry that serves loan-lib under BSD-3-Clause with three releases and 777 downloads a month, which no default of the page holds, and does not know missing-lib; a further decision that chooses loan-lib against shelf-lib, and, for the counter-proof, one that chooses missing-lib
// input: Run; the registry's requests and the rows of the due-diligence table
// expect: the row of loan-lib shows what the registry served — BSD-3-Clause, 3 releases, 777 downloads last month — and, for each fact row, an address read from (https://registry.npmjs.org/loan-lib among them) and the date it was read; counter-proof — the row of missing-lib says not found - the name may be invented, holds the address queried, claims no licence, release or adoption, and is dated
test("TST-448317: UC-022 every fact of the due diligence is read from the registry and names the address and the date", async () => {
  const served = { ...packageData("BSD-3-Clause"), versions: { "1.0.0": {}, "1.1.0": {}, "1.2.0": {} }, time: { "1.0.0": "2023-05-05T00:00:00.000Z", "1.1.0": "2024-01-01T00:00:00.000Z", "1.2.0": "2025-06-01T00:00:00.000Z" }, "dist-tags": { latest: "1.2.0" } };
  const seen = ready({ registry: { "https://registry.npmjs.org/loan-lib": served, "https://api.npmjs.org/downloads/point/last-month/loan-lib": { downloads: 777 }, ...registryOf(["shelf-lib", "MIT"]) } });
  const rows = cellsOf(await derive(fakeProduct()));
  assert.ok(seen.registry.includes("https://registry.npmjs.org/loan-lib") && seen.registry.includes("https://api.npmjs.org/downloads/point/last-month/loan-lib"), "the registry was asked");
  assert.deepEqual([rows[0][1], rows[0][3], rows[0][4], rows[0][5], rows[0][7]], ["BSD-3-Clause", "1.0.0 on 2023-05-05", "1.2.0 on 2025-06-01", "3", "777 downloads last month"]);
  for (const row of rows) {
    assert.match(row[8], /^https:\/\/registry\.npmjs\.org\//, "an address read from");
    assert.match(row[9], /^\d{4}-\d{2}-\d{2}$/, "and the date");
  }

  endpoints({ drafter: [reply(draftOf({ candidate: "missing-lib" }))], reviewer: [reply({ findings: [] })], registry: registryOf(["shelf-lib", "MIT"]) });
  const missing = cellsOf(await derive(fakeProduct()))[0];
  assert.equal(missing[0], "missing-lib (npm) - chosen");
  assert.equal(missing[1], "not found - the name may be invented", "counter-proof: a package the registry does not know is not recalled");
  assert.deepEqual(missing.slice(3, 8), ["-", "-", "-", "-", "-"]);
  assert.equal(missing[8], "https://registry.npmjs.org/missing-lib");
  assert.match(missing[9], /^\d{4}-\d{2}-\d{2}$/);
});

// TST-448318 · level: release · module: system
// guards: A PRODUCT DECLARES ITS LICENCE; UC-022
// given: a product with a LICENSE file (MIT) and a product without; a candidate under MIT in both
// input: Run for each; the due-diligence section
// expect: with the file, the section states the product's licence, MIT, and the candidate is read compatible with it; without it, the section says No product LICENSE was found and that the product's licence decides what it may reuse, and the candidate's compatibility reads not checked
test("TST-448318: UC-022 the product's own licence is read from its LICENSE file, and its absence is said", async () => {
  ready();
  const with_ = byClass(await derive(fakeProduct()), "section", "due-diligence")[0];
  assert.match(with_.textContent, /Product licence: MIT\./);
  assert.deepEqual(cellsOf(await derive(fakeProduct())).map((row) => row[2]), ["yes", "yes"]);
  ready();
  const absent = await derive(fakeProduct(without(READY, "LICENSE")));
  assert.match(NORMALISED(byClass(absent, "section", "due-diligence")[0]), /No product LICENSE was found; the product's licence decides what it may reuse\./);
  assert.deepEqual(cellsOf(absent).map((row) => row[2]), ["not checked", "not checked"]);
});

// TST-448319 · level: release · module: system
// guards: A REUSED LICENCE IS SHOWN AGAINST THE PRODUCT'S; UC-022
// given: an MIT product; a candidate under GPL-3.0 against one under MIT; and, for the counter-proof, an MIT candidate against an MIT alternative
// input: Run for each; the rows of the due-diligence table
// expect: the GPL-3.0 candidate is marked not known to be compatible with the product's licence and the MIT alternative is read yes; counter-proof — a table whose candidates are both under MIT marks neither
test("TST-448319: UC-022 a candidate whose licence is not known to be compatible with the product's is marked", async () => {
  endpoints({ drafter: [reply(draftOf({ candidate: "gpl-lib" }))], reviewer: [reply({ findings: [] })], registry: registryOf(["gpl-lib", "GPL-3.0"], ["shelf-lib", "MIT"]) });
  assert.deepEqual(cellsOf(await derive(fakeProduct())).map((row) => [row[0], row[1], row[2]]), [["gpl-lib (npm) - chosen", "GPL-3.0", "not known to be compatible"], ["shelf-lib (npm)", "MIT", "yes"]]);
  endpoints({ drafter: [reply(draftOf())], reviewer: [reply({ findings: [] })], registry: registryOf(["loan-lib", "MIT"], ["shelf-lib", "MIT"]) });
  assert.deepEqual(cellsOf(await derive(fakeProduct())).map((row) => row[2]), ["yes", "yes"], "counter-proof: an MIT candidate is not marked");
});

// ---------------------------------------------------------------- what the files hold

// TST-448320 · level: release · module: system
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; UC-022
// given: the ready product; a first draft whose system's decision is forced by A MADE UP RULE and UC-099, and one whose decision has no forced_by; each followed by the complete draft
// input: Run for each, Write proposals; the requests and the files written
// expect: the first draft goes back with findings under EVERY ARTIFACT NAMES ITS ORIGIN naming A MADE UP RULE and UC-099 as matching no requirement or use case, the second with the finding that the key forced_by is required; every decision written names the requirements and use cases that force it and every module the requirements it realises, each a requirement of the SPEC or a use case of the product
test("TST-448320: UC-022 a decision names what forces it and a module what it realises, or the draft goes back", async () => {
  const unknown = draftOf({ system: { forced: ["A MADE UP RULE", "UC-099", LOAN] } });
  const bare = draftOf();
  bare.files[0].text = bare.files[0].text.replace(/forced_by:[^]*?---\n/, "---\n");
  const first = endpoints({ drafter: [reply(unknown), reply(draftOf())], reviewer: [reply({ findings: [] })], registry: REG });
  await derive(fakeProduct());
  const found = findingsOf(first.drafter[1]);
  assert.ok(found.some((each) => each.includes('"A MADE UP RULE" matches no requirement or use case [EVERY ARTIFACT NAMES ITS ORIGIN]')) && found.some((each) => each.includes('"UC-099" matches no requirement or use case [EVERY ARTIFACT NAMES ITS ORIGIN]')));
  const second = endpoints({ drafter: [reply(bare), reply(draftOf())], reviewer: [reply({ findings: [] })], registry: REG });
  const fake = fakeProduct();
  await writeProposals(await derive(fake));
  assert.deepEqual(findingsOf(second.drafter[1]), ["ARC-900:1: error: the key forced_by is required, and left out [EVERY ARTIFACT NAMES ITS ORIGIN] — give the key forced_by a value."]);
  const known = new Set([LOAN, SHELF, "UC-001", "UC-002"]);
  for (const path of WRITTEN) {
    const front = fake.files()[path].split("\n---\n")[0].split("\n");
    const key = path.includes("/MOD-") ? "realises" : "forced_by";
    const names = [];
    for (let at = front.indexOf(`${key}:`) + 1; at > 0 && /^ {2}- /.test(front[at] ?? ""); at += 1) names.push(front[at].slice(4));
    assert.ok(names.length > 0, `${path} names its origin under ${key}`);
    for (const name of names) assert.ok(known.has(name), `${path}: ${name} exists`);
  }
});

// TST-448321 · level: release · module: system
// guards: DIAGRAMS ARE MERMAID IN MARKDOWN; UC-022
// given: the ready product; a first draft whose system's decision draws its view as an image, ![view](docs/view.png), and the corrected draft with a Mermaid block
// input: Run, Write proposals; the requests and the files written
// expect: the second request carries a finding of the rule DIAGRAMS ARE MERMAID IN MARKDOWN that names the image; every decision written draws its diagram as a block ```mermaid and none holds an image
test("TST-448321: UC-022 a drafted diagram that is an image goes back, and the decisions written draw theirs in Mermaid", async () => {
  const image = draftOf();
  image.files[0].text = image.files[0].text.replace("```mermaid", "![view](docs/view.png)\n\n```mermaid");
  const seen = endpoints({ drafter: [reply(image), reply(draftOf())], reviewer: [reply({ findings: [] })], registry: REG });
  const fake = fakeProduct();
  await writeProposals(await derive(fake));
  const found = findingsOf(seen.drafter[1]).filter((each) => each.includes("[DIAGRAMS ARE MERMAID IN MARKDOWN]"));
  assert.equal(found.length, 1, "known positive: the image is found");
  assert.ok(found[0].includes("docs/view.png"));
  for (const path of WRITTEN.filter((each) => each.includes("/ARC-"))) {
    assert.match(fake.files()[path], /\n```mermaid\n[^]*\n```\n/, `${path} draws its diagram in Mermaid`);
    assert.ok(!/!\[[^\]]*\]\(/.test(fake.files()[path]), `${path} holds no image`);
  }
});

// TST-448322 · level: release · module: system
// guards: A GENERATED ARTIFACT IS A PROPOSAL; UC-022
// given: the architecture written by the job; then a person's record that names the text of ARC-001; then ARC-001 changed by another writer
// input: the list of the decisions after each step
// expect: the job added no approval record, and the four files read open; after the record ARC-001 reads accepted and ARC-002 and ARC-003 still open; after the change ARC-001 reads changed since acceptance, and the job added no record
test("TST-448322: UC-022 what the job generates counts as a proposal until a person accepts it", async () => {
  const fake = await written();
  const records = recordsOf(fake);
  assert.deepEqual(records.filter((path) => /\/(ARC|MOD)-/.test(path)), [], "the job added no record of the architecture");
  for (const id of ["ARC-001", "ARC-002", "ARC-003"]) assert.equal(await badge(fake, id), "open");
  const path = "docs/architecture/ARC-001-system.md";
  const record = approvalOf(path, fake.files()[path], "architecture-decision");
  fake.land({ [record.path]: record.text });
  assert.equal(await badge(fake, "ARC-001"), "accepted");
  assert.equal(await badge(fake, "ARC-002"), "open");
  assert.equal(await badge(fake, "ARC-003"), "open");
  fake.land({ [path]: fake.files()[path].replace("The system is two folders.", "The system is two folders and a record.") });
  assert.equal(await badge(fake, "ARC-001"), "changed since acceptance");
  assert.equal(recordsOf(fake).length, records.length + 1, "the only new record is the person's");
});

// TST-448323 · level: release · module: system
// guards: A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; UC-022
// given: the ready product, whose default branch is main; the draft shown after Run
// input: Write proposals; every commit the product received
// expect: every commit of the job and of the writing is made on the default branch main itself, none on another branch; the architecture is written by one commit on the head that was read; the four files read open in the lists and in the statuses; counter-proof — a record that names a file's text accepts it
test("TST-448323: UC-022 the architecture enters the default branch directly and counts as open", async () => {
  const fake = await written();
  assert.deepEqual([...new Set(fake.writes().map((change) => change.branch))], ["main"], "every commit is on the default branch");
  assert.equal(writes(fake).length, 1, "one commit writes the architecture");
  assert.match(writes(fake)[0].expectedHead, /^[0-9a-f]{40}$/, "on the head that was read");
  const states = [...statuses(await fake.host.readSnapshot("main"))].filter(([file]) => file.startsWith("docs/architecture/")).map(([, status]) => status.status);
  assert.deepEqual(states, ["open", "open", "open", "open"]);
  const path = "docs/architecture/MOD-lending.md";
  const record = approvalOf(path, fake.files()[path], "module");
  fake.land({ [record.path]: record.text });
  assert.equal(await badge(fake, "MOD-lending", "module"), "accepted", "counter-proof: a record that names the text accepts it");
});

// ---------------------------------------------------------------- the acceptance

// TST-448324 · level: release · module: system
// guards: ACCEPTANCE IS A COMMIT BY THE ACCEPTING PERSON; UC-022
// given: the architecture written open; the page of the whole architecture, with the person's token for the product
// input: Accept all 4 shown; the commit the product received
// expect: the acceptance is one commit on the default branch main, on the head that was read, whose message names the accepting person — Agent M · library, the name of the token — and the files accepted, and which adds approval records under docs/approvals/ and nothing else
test("TST-448324: UC-022 the acceptance is a commit of the accepting person that adds approval records", async () => {
  const fake = await written();
  const head = fake.head(), before = fake.writes().length;
  const all = await show(fake, { id: "all" });
  click(byClass(all, "button", "accept-all")[0]);
  await until(() => byClass(all, "p", "nothing").length === 1, "the page drawn again");
  assert.equal(fake.writes().length, before + 1, "one commit");
  const commit = fake.writes().at(-1);
  assert.equal(commit.branch, "main");
  assert.equal(commit.expectedHead, head, "on the head that was read");
  assert.match(commit.message, /^accept ARC-001, ARC-002, MOD-lending, ARC-003 \(Agent M dashboard\)\n\nAccepted by Agent M · library\.\n$/);
  assert.ok(commit.files.every((file) => /^docs\/approvals\/[A-Za-z0-9-]+-[0-9a-f]{12}\.md$/.test(file.path)), "records and nothing else");
});

// TST-448325 · level: release · module: system
// guards: SEVERAL FILES ARE ACCEPTED IN ONE CLICK; UC-022
// given: the architecture written open and shown on the page of the whole architecture; (a) all four files as shown; (b) MOD-lending changed after it was shown; (c) UC-002, which ARC-001 names, changed so that its record no longer names it
// input: Accept all N shown, for each
// expect: (a) one commit with four records, one for each file shown and none for a file that was not shown, each naming the blob of the text shown; (b) the records of the other three, MOD-lending named as left out, changed since shown; (c) no record for ARC-001, which the page names as resting on what is not accepted, and UC-002
test("TST-448325: UC-022 Accept all N shown records every file shown in one commit, and leaves out and names a file that changed or rests on what is not accepted", async () => {
  const names = (commit) => commit.files.map((file) => file.path.replace(/-[0-9a-f]{12}\.md$/, "").replace("docs/approvals/", ""));
  const a = await written();
  const shown = a.files(), pageA = await show(a, { id: "all" }), countA = a.writes().length;
  click(byClass(pageA, "button", "accept-all")[0]);
  await until(() => byClass(pageA, "p", "nothing").length === 1, "the page drawn again");
  assert.equal(a.writes().length, countA + 1);
  assert.deepEqual(names(a.writes().at(-1)), ["ARC-001", "ARC-002", "MOD-lending", "ARC-003"]);
  const inOrder = [WRITTEN[0], WRITTEN[1], WRITTEN[3], WRITTEN[2]];
  assert.deepEqual(a.writes().at(-1).files.map((file) => /^blob: (\S+)$/m.exec(file.text)[1]), inOrder.map((path) => /^blob: (\S+)$/m.exec(approvalOf(path, shown[path]).text)[1]), "each names the blob of the text shown");

  const b = await written();
  const pageB = await show(b, { id: "all" });
  b.land({ "docs/architecture/MOD-lending.md": b.files()["docs/architecture/MOD-lending.md"].replace("It manages loans and returns.", "It manages loans, returns and fines.") });
  click(byClass(pageB, "button", "accept-all")[0]);
  await until(() => byClass(pageB, "p", "result").length === 1, "the message");
  assert.deepEqual(names(b.writes().at(-1)), ["ARC-001", "ARC-002", "ARC-003"]);
  assert.match(byClass(pageB, "p", "result")[0].textContent, /MOD-lending was left out: changed since shown/);

  const c = await written();
  const pageC = await show(c, { id: "all" });
  c.land({ [UC2_PATH]: UC2.replace("Shelve a book.", "Shelve a book at once.") });
  click(byClass(pageC, "button", "accept-all")[0]);
  await until(() => byClass(pageC, "p", "result").length === 1, "the message");
  assert.deepEqual(names(c.writes().at(-1)), ["ARC-002", "MOD-lending", "ARC-003"]);
  assert.match(byClass(pageC, "p", "result")[0].textContent, /ARC-001 was left out: rests on what is not accepted \(UC-002\)/);
});

// TST-448326 · level: release · module: system
// guards: ONE REVIEW LAYOUT FOR EVERY PRODUCT; UC-022
// given: the ready product; the architecture derived, written and accepted
// input: every path the page wrote to the product
// expect: the architecture is under docs/architecture/, the approval records under docs/approvals/, the job's records under docs/jobs/ and nothing else is written — no file outside docs/ and no use case; the use cases stay under docs/use-cases/, as they were
test("TST-448326: UC-022 the architecture, its records and the job's records are written to the folders of the review layout", async () => {
  const fake = await written();
  const all = await show(fake, { id: "all" });
  click(byClass(all, "button", "accept-all")[0]);
  await until(() => byClass(all, "p", "nothing").length === 1, "the page drawn again");
  const paths = [...new Set(fake.writes().flatMap((change) => change.files.map((file) => file.path)))];
  assert.equal(paths.length, 9, "known positive: the job's record, the four files and their four records were written");
  assert.ok(paths.every((path) => /^docs\/(architecture|approvals|jobs)\//.test(path)), `every path is in the layout: ${paths.join(", ")}`);
  assert.equal(fake.files()[UC1_PATH], UC1);
  assert.equal(fake.files()[UC2_PATH], UC2);
});

// TST-448327 · level: release · module: system
// guards: AN ARTIFACT RECORDS THE VERSION THAT PRODUCED IT; UC-022
// given: the ready product, drafter-a (model-a) with reviewer-b; the draft written
// input: the commit that wrote the architecture and the four files
// expect: the message of the commit ends with the lines Agent-M-Version (naming the instance commit the page read), Agent-M-Job, Agent-M-Kind derive-architecture, Agent-M-Participant drafter-a, Agent-M-Model model-a and Agent-M-Rounds; none of the four files names the version, the job, the participant, the model or the rounds
test("TST-448327: UC-022 the commit names the version, the participant and the model that produced the architecture, and the files name none of them", async () => {
  const fake = await written();
  const [commit] = writes(fake);
  const lines = commit.message.split("\n").slice(-6);
  assert.match(lines[0], new RegExp(`^Agent-M-Version: ${INSTANCE_COMMIT}, commit ${INSTANCE_COMMIT}$`));
  assert.match(lines[1], /^Agent-M-Job: JOB-\d{8}-\d{4}-[0-9a-f]{4}$/);
  assert.deepEqual(lines.slice(2), ["Agent-M-Kind: derive-architecture", "Agent-M-Participant: drafter-a", "Agent-M-Model: model-a", "Agent-M-Rounds: 1"]);
  for (const file of commit.files) for (const forbidden of ["Agent-M", "drafter-a", "model-a", INSTANCE_COMMIT, lines[1].slice("Agent-M-Job: ".length)]) assert.ok(!file.text.includes(forbidden), `${file.path} does not name ${forbidden}`);
});

// TST-448328 · level: release · module: system
// guards: A DOCUMENT HOLDS NO HISTORY; UC-022
// given: the ready product; a first draft whose system's decision carries a stamp of change, "Changed on 2026-10-01: it was one folder before.", and the complete draft; the mark is one MOD-text-tools finds
// input: Run; the requests
// expect: known positive — the stamp is a mark of history, and a draft without it is asked once; the draft with the stamp goes back with a finding of the rule A DOCUMENT HOLDS NO HISTORY that names the stamp, and the decision the person sees holds none
test("TST-448328: UC-022 a drafted decision that carries a stamp of change goes back", async () => {
  const stamped = draftOf();
  stamped.files[0].text = stamped.files[0].text.replace("The system is two folders.", "The system is two folders. Changed on 2026-10-01: it was one folder before.");
  assert.equal(historyMarks(stamped.files[0].text).length, 1, "known positive: the stamp is a mark of history");
  const plain = ready();
  await derive(fakeProduct());
  assert.equal(plain.drafter.length, 1, "known positive: a draft without the stamp is asked once");
  const seen = endpoints({ drafter: [reply(stamped), reply(draftOf())], reviewer: [reply({ findings: [] })], registry: REG });
  const target = await derive(fakeProduct());
  assert.equal(seen.drafter.length, 2, "the draft with the stamp goes back");
  assert.ok(findingsOf(seen.drafter[1]).some((each) => each.includes("[A DOCUMENT HOLDS NO HISTORY]") && each.includes("Changed on 2026-10-01")));
  assert.ok(!editorOf(target, ARC_DRAFT).value.includes("Changed on 2026-10-01"));
});

// ---------------------------------------------------------------- what the page says it sends

// TST-448329 · level: release · module: system
// guards: THE PAGE NAMES WHERE IT SENDS; UC-022
// given: the ready product; far-c, which processes data in a server in Singapore, chosen as drafter with reviewer-b, which processes at this machine
// input: the person shows the run panel
// expect: the panel names the destination far-c as drafter with the place a server in Singapore and the destination reviewer-b as reviewer with the place this machine, each with its model; nothing is sent and nothing is written before Run; counter-proof — a participant shown without its place would fail: every destination of the panel names a place
test("TST-448329: UC-022 before the run the page names each destination with where it processes data", async () => {
  const seen = ready();
  const fake = fakeProduct();
  const target = await show(fake);
  const panel = await panelFor(target, "far-c", "reviewer-b");
  const destinations = byClass(panel, "section", "destination");
  assert.match(destinations[0].textContent, /^far-c — drafter/);
  assert.match(destinations[0].textContent, /model: model-c; processes data at: a server in Singapore/);
  assert.match(destinations[1].textContent, /^reviewer-b — reviewer/);
  assert.match(destinations[1].textContent, /model: model-b; processes data at: this machine/);
  for (const destination of destinations) assert.match(destination.textContent, /processes data at: \S/, "every destination names a place");
  assert.equal(seen.drafter.length + seen.reviewer.length + seen.registry.length, 0, "nothing sent");
  assert.equal(fake.writes().length, 0, "nothing written");
});

// TST-448330 · level: release · module: system
// guards: RESTRICTED CONTENT GOES ONLY WHERE ITS SOURCE PERMITS; UC-022
// given: the product links the restricted source SRC-secret, whose register entry permits "this machine" only; far-c processes data in Singapore, ci-agent in the USA; and, for the counter-proof, a product that links no source
// input: the person opens the page and chooses drafter-a
// expect: far-c and ci-agent are offered neither as drafter nor as reviewer; drafter-a, reviewer-b, small-d and twin-a are; counter-proof — for the product that links no source, far-c and ci-agent are offered
test("TST-448330: UC-022 a participant whose place a linked restricted source forbids is not offered", async () => {
  ready();
  const unlinked = await show(fakeProduct());
  assert.ok(participantNames(unlinked).includes("far-c") && participantNames(unlinked).includes("ci-agent"), "counter-proof: offered without the link");
  const target = await show(fakeProduct({ ...READY, "docs/sources.md": SECRET_LINK }), { id: "draft" }, { entries: { "docs/sources/SRC-secret.md": SECRET_ENTRY } });
  assert.deepEqual(participantNames(target), ["drafter-a", "reviewer-b", "small-d", "twin-a"]);
  choose(target, "participant", "drafter-a");
  assert.deepEqual(participantNames(target, "reviewer"), ["reviewer-b", "small-d"]);
});

// ---------------------------------------------------------------- every step explains itself

// TST-448331 · level: release · module: system
// guards: EVERY STEP EXPLAINS ITSELF; UC-022
// given: the ready product; the drafting page and the page of the whole architecture
// input: the folded explanations of each page are read
// expect: the drafting page carries four folded explanations — what an architecture is, the drafting participant, the reviewing participant and the run panel —, each a details with the summary What is this? and an explanation in full sentences; the page of the whole architecture carries the explanation of accepting, which says that accepting is a commit under the person's own account
test("TST-448331: UC-022 the steps that ask something of the person carry a folded explanation", async () => {
  ready();
  const fake = fakeProduct();
  const target = await show(fake);
  await panelFor(target);
  const folded = find(target, (node) => node.localName === "details");
  assert.equal(folded.length, 4);
  for (const each of folded) {
    assert.equal(find(each, (node) => node.localName === "summary")[0].textContent, "What is this?");
    assert.ok(NORMALISED(each).length > 200, "an explanation in full sentences");
  }
  assert.match(NORMALISED(folded[0]), /^What is this\?An architecture is the fundamental organization of a system/);
  assert.match(NORMALISED(folded[1]), /^What is this\?The participant is the model or agent that writes the draft\./);
  assert.match(NORMALISED(folded[2]), /^What is this\?Before you see the draft, a second participant, the reviewing participant,/);
  assert.match(NORMALISED(folded[3]), /^What is this\?The run panel appears before anything is sent\./);
  await written(fake);
  const all = await show(fake, { id: "all" });
  assert.match(NORMALISED(find(all, (node) => node.localName === "details")[0]), /^What is this\?Accepting is a commit made under your own account/);
});

// TST-448332 · level: release · module: system
// guards: EVERY STEP EXPLAINS ITSELF; UC-022
// given: the ready product; the draft shown after Run, which asks the author to change it, to choose a library and to press Write proposals
// input: the folded explanations inside the shown draft are read
// expect: known positive — the drafting page's four folded explanations are there; the shown draft carries a folded explanation of its own, a details with the summary What is this? inside the drafted architecture, for the step that asks the author to review, change and write the draft
test("TST-448332: UC-022 the step that shows the draft and asks the author to write it carries a folded explanation", async () => {
  ready();
  const target = await derive(fakeProduct());
  assert.equal(find(target, (node) => node.localName === "details").length >= 4, true, "known positive: the explanations of the page are there");
  const inside = find(byClass(target, "section", "architecture-result")[0], (node) => node.localName === "details");
  assert.ok(inside.length > 0 && inside.every((each) => find(each, (node) => node.localName === "summary")[0].textContent === "What is this?"), "the draft carries a folded explanation of its own");
});

// ---------------------------------------------------------------- the correction loop

// TST-448333 · level: release · module: system
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; UC-022
// given: the ready product; (a) a first draft whose system's decision lacks the section Alternatives and names A MADE UP RULE, followed by the corrected draft; (b) a passing draft
// input: Run for each; the requests and the page
// expect: (a) the participant is asked a second time, and the second request holds the first draft and, under the heading of the findings, both findings; the person sees only the corrected draft: the editors hold a decision with its Alternatives and without the made-up name; the reviewer is asked on each draft; (b) counter-proof — a draft that passes is not sent back: one request
test("TST-448333: UC-022 a draft that fails a check goes back to its participant, and the person sees the corrected draft", async () => {
  const bad = draftOf({ system: { drop: ["Alternatives"], forced: ["A MADE UP RULE", LOAN] } });
  const seen = endpoints({ drafter: [reply(bad), reply(draftOf())], reviewer: [reply({ findings: [] })], registry: REG });
  const target = await derive(fakeProduct());
  assert.equal(seen.drafter.length, 2);
  assert.ok(seen.drafter[1].sent.includes("## Findings to fix or answer") && seen.drafter[1].sent.includes("A MADE UP RULE"), "the draft and its findings go back");
  assert.equal(findingsOf(seen.drafter[1]).length, 2);
  assert.ok(editorOf(target, ARC_DRAFT).value.includes("## Alternatives") && !editorOf(target, ARC_DRAFT).value.includes("A MADE UP RULE"), "the person sees the corrected draft");
  assert.equal(seen.reviewer.length, 2, "the reviewer checked each draft");
  const plain = ready();
  await derive(fakeProduct());
  assert.equal(plain.drafter.length, 1, "counter-proof: a passing draft is not sent back");
});

// TST-448334 · level: release · module: system
// guards: A FINDING READS LIKE A COMPILER MESSAGE; UC-022
// given: the ready product; a first draft with A MADE UP RULE and without the section Alternatives, and a reviewer that finds one thing in the first round
// input: Run; the findings of the second request, and the round record of the job
// expect: known positive — three findings go back, two errors of Agent M's checks and the reviewer's warning; each is one line in the form `<artifact>:<line>: <error|warning>: <what> [<RULE>] — <correction>.`, naming the artifact, a line, the kind, the rule by its name in capitals and the correction expected; the job's record holds the same three lines; counter-proof — the same finding without its rule does not match the form
test("TST-448334: UC-022 every finding sent back names the artifact, the line, the kind, the rule and the correction in one text form", async () => {
  const bad = draftOf({ system: { drop: ["Alternatives"], forced: ["A MADE UP RULE", LOAN] } });
  const seen = endpoints({ drafter: [reply(bad), reply(draftOf())], reviewer: [reply({ findings: [SYSTEM_FINDING] }), reply({ findings: [] })], registry: REG });
  const fake = fakeProduct();
  await derive(fake);
  const found = findingsOf(seen.drafter[1]);
  assert.equal(found.length, 3, `known positive: ${found.join("\n")}`);
  assert.deepEqual(found.map((each) => /^\S+:\d+: (error|warning)/.exec(each)[1]).sort(), ["error", "error", "warning"]);
  for (const each of found) assert.match(each, COMPILER);
  const rounds = jobRecord(fake).text.split("## Rounds")[1];
  for (const each of found) assert.ok(rounds.includes(`- ${each}`), `the record holds ${each.slice(0, 60)}`);
  assert.doesNotMatch("ARC-900:9: warning: the shelf belongs to no subsystem — give the shelf a subsystem.", COMPILER, "counter-proof: a finding with no rule is not in the form");
});

// TST-448335 · level: release · module: system
// guards: AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; UC-022
// given: the ready product; (a) a drafter whose draft names A MADE UP RULE and that answers the error justified, with a reason, keeping the draft; (b) a drafter that fixes the error in its second draft
// input: Run for each; the requests, the page and the job's record
// expect: (a) a justification does not settle an error: the loop ends only at a round that leaves it as it was — two requests, stopped because: unchanged —, the page shows the error left, and every finding of the run is of the kind error; the record shows the justification under the finding; (b) counter-proof — an error fixed ends the loop: two requests, stopped because: passed, nothing left; the warning case is TST-448315
test("TST-448335: UC-022 an error is not settled by a justification; it is fixed, or it is left to the person", async () => {
  const bad = draftOf({ system: { forced: ["A MADE UP RULE", LOAN] } });
  const finding = "ARC-900:5: error: forced_by \"A MADE UP RULE\" matches no requirement or use case [EVERY ARTIFACT NAMES ITS ORIGIN] — use an existing name or remove the line.";
  const seen = endpoints({ drafter: [reply(bad), reply(bad, [{ finding, how: "justified", text: "the rule is wanted" }])], reviewer: [reply({ findings: [] })], registry: REG });
  const fake = fakeProduct();
  const target = await derive(fake);
  assert.equal(seen.drafter.length, 2);
  assert.ok(findingsOf(seen.drafter[1]).every((each) => /^\S+:\d+: error: /.test(each)), "every finding is an error");
  const left = find(byClass(target, "ul", "left")[0], (node) => node.localName === "li");
  assert.equal(left.length, 1, "the error is left, and shown");
  assert.match(jobRecord(fake).text, /- ARC-900:5: error: forced_by "A MADE UP RULE"[^\n]*\n {2}- justified: the rule is wanted/);
  assert.match(jobRecord(fake).text, /stopped because: unchanged · limit: 5/);

  const fixed = endpoints({ drafter: [reply(bad), reply(draftOf())], reviewer: [reply({ findings: [] })], registry: REG });
  const other = fakeProduct();
  const second = await derive(other);
  assert.equal(fixed.drafter.length, 2);
  assert.equal(byClass(second, "ul", "left").length, 0, "nothing left");
  assert.match(jobRecord(other).text, /stopped because: passed · limit: 5/, "counter-proof: a fixed error ends the loop");
});

// TST-448336 · level: release · module: system
// guards: WHAT A PERSON DECIDES IS NOT SENT BACK; UC-022
// given: the ready product; (a) a reviewer that finds that the requirement A BOOK IS SHELVED cannot be kept, under the rule A CONFLICT IS DECIDED BY A PERSON; (b) a reviewer that finds a subsystem missing, under A SUBSYSTEM IS CHECKED AGAINST THE SYSTEM
// input: Run for each; the requests and the job's record
// expect: (a) the finding goes to the person and not back: the drafter is asked once, no request holds a section of findings, and the record lists it under For a person; (b) counter-proof — the finding of another rule goes back: the drafter is asked a second time, with the finding in its request
test("TST-448336: UC-022 a finding the SPEC leaves to a person is not sent back to the participant", async () => {
  const conflict = { artifact: ARC_DRAFT, line: 9, rule: "A CONFLICT IS DECIDED BY A PERSON", what: "the requirement A BOOK IS SHELVED cannot be kept by this architecture", fix: "the author decides whether to keep the requirement" };
  const a = endpoints({ drafter: [reply(draftOf())], reviewer: [reply({ findings: [conflict] })], registry: REG });
  const fake = fakeProduct();
  await derive(fake);
  assert.equal(a.drafter.length, 1, "nothing is sent back");
  assert.ok(!a.drafter[0].sent.includes("## Findings to fix or answer"));
  assert.match(jobRecord(fake).text, /For a person:\n- docs\/architecture\/ARC-900-system\.md:9: warning: the requirement A BOOK IS SHELVED cannot be kept/);
  const b = endpoints({ drafter: [reply(draftOf())], reviewer: [reply({ findings: [SYSTEM_FINDING] })], registry: REG });
  await derive(fakeProduct());
  assert.equal(b.drafter.length, 2, "counter-proof: a finding of another rule goes back");
  assert.ok(b.drafter[1].sent.includes("## Findings to fix or answer"));
});

// TST-448337 · level: release · module: system
// guards: THE CORRECTION LOOP HAS A FIXED LIMIT; UC-022
// given: the ready product; (a) a drafter that never fixes its error: each draft names another unknown requirement, so that every round has another finding; (b) a drafter that answers the same flawed draft every time
// input: Run for each; the run panel before it, the job's start record, the requests and the page
// expect: the limit is stated before the first round — the panel says at most 5 rounds and the start record, committed before the end, says `limit: 5` —; (a) the drafter is asked exactly 5 times and the page shows the remaining finding; (b) it is asked twice, once more than a round without change, and the page shows the remaining finding
test("TST-448337: UC-022 the loop ends after the number of rounds fixed before the first, or at a round without change, and the finding left is shown", async () => {
  const drafts = [1, 2, 3, 4, 5].map((number) => reply(draftOf({ system: { forced: [`AN UNKNOWN RULE ${number}`, LOAN] } })));
  const a = endpoints({ drafter: drafts, reviewer: [reply({ findings: [] })], registry: REG });
  const fake = fakeProduct();
  const target = await show(fake);
  const panel = await panelFor(target);
  assert.match(panel.textContent, /Correction rounds: at most 5/);
  assert.equal(a.drafter.length, 0);
  await run(target);
  assert.equal(a.drafter.length, 5, "asked exactly limit times");
  const starts = fake.writes().filter((change) => change.files.some((file) => file.path.startsWith("docs/jobs/")));
  assert.match(starts[0].files[0].text, /^limit: 5$/m, "the start record states the limit");
  assert.ok(!starts[0].files[0].text.includes("## End"), "and it was committed before the end");
  assert.equal(find(byClass(target, "ul", "left")[0], (node) => node.localName === "li").length, 1, "the remaining finding is shown");
  assert.match(byClass(target, "ul", "left")[0].textContent, /AN UNKNOWN RULE 5/);

  const bad = draftOf({ system: { forced: ["A MADE UP RULE", LOAN] } });
  const b = endpoints({ drafter: [reply(bad)], reviewer: [reply({ findings: [] })], registry: REG });
  const other = await derive(fakeProduct());
  assert.equal(b.drafter.length, 2, "once more than a round without change");
  assert.equal(find(byClass(other, "ul", "left")[0], (node) => node.localName === "li").length, 1);
});

// TST-448338 · level: release · module: system
// guards: THE ROUNDS ARE COUNTED AND SHOWN; UC-022
// given: the ready product; a reviewer that finds one thing in the first round and nothing in the second
// input: Run, Write proposals; the page, the job's record, the commit, and the page of the whole architecture
// expect: the page shows the rounds the draft needed — two, round 1 with its finding and round 2 without one, and Left: none —; the job's record holds Round 1 with its finding and Round 2 without, and the line `Left: none · stopped because: passed · limit: 5`; the commit that writes the architecture ends with Agent-M-Rounds: 2; the page of the whole architecture shows the same two rounds from the record
test("TST-448338: UC-022 the number of correction rounds and the findings of each are shown with the draft and recorded with it", async () => {
  endpoints({ drafter: [reply(draftOf()), reply(draftOf(), [{ finding: lineOf(SYSTEM_FINDING), how: "fixed", text: null }])], reviewer: [reply({ findings: [SYSTEM_FINDING] }), reply({ findings: [] })], registry: REG });
  const fake = fakeProduct();
  const target = await derive(fake);
  const rounds = byClass(byClass(target, "section", "rounds")[0], "section", "round");
  assert.deepEqual(rounds.map((round) => round.getAttribute("data-number")), ["1", "2"]);
  assert.match(rounds[0].textContent, /^Round 1 — 1 finding.*the shelf belongs to no subsystem/);
  assert.match(rounds[1].textContent, /^Round 2 — no finding/);
  assert.match(byClass(target, "p", "left-count")[0].textContent, /^Left: none$/);
  const record = jobRecord(fake).text.split("## Rounds")[1];
  assert.match(record, /### Round 1 — 1 finding\n- docs\/architecture\/ARC-900-system\.md:9: warning: the shelf belongs to no subsystem/);
  assert.match(record, /### Round 2 — no finding\n\nLeft: none · stopped because: passed · limit: 5/);
  await writeProposals(target);
  assert.match(writes(fake)[0].message, /\nAgent-M-Rounds: 2$/);
  const all = await show(fake, { id: "all" });
  assert.deepEqual(byClass(byClass(all, "section", "rounds")[0], "section", "round").map((round) => round.getAttribute("data-number")), ["1", "2"]);
  assert.match(byClass(all, "p", "left-count")[0].textContent, /^Left: none$/);
});

// ---------------------------------------------------------------- the job's input

// TST-448339 · level: release · module: system
// guards: AN ARCHITECTURE JOB RECEIVES THE CHAPTERS ON MODELING, ARCHITECTURE, DESIGN AND IMPLEMENTATION; UC-022
// given: the ready product, the instance holding the book *Vibe Coding* as files; drafter-a and reviewer-b
// input: Run; the request each endpoint received, and the job's record
// expect: each request holds the files of chapters 9, 10, 11 and 12 whole — byte for byte as the instance holds them — and none of chapters 8, 13, 14 and 15, whole; the job's record lists the four chapters among its inputs with the version of the book; counter-proof — the same search finds the chapters' files in the request, so that the others are absent by the same check
test("TST-448339: UC-022 the job's input gives chapters 9 to 12 of the book in full and no other chapter", async () => {
  const seen = ready();
  const fake = fakeProduct();
  await derive(fake);
  for (const request of [seen.drafter[0], seen.reviewer[0]]) {
    for (const file of CHAPTERS) {
      const chapter = onDisk(BOOK + file);
      assert.ok(chapter.length > 10000, `known positive: ${file} is read from the disk`);
      assert.ok(request.sent.includes(chapter), `${file} is in the request, whole`);
    }
    for (const file of ["08_requirements-engineering.md", "13_software-testing.md", "14_software-evolution-and-maintenance.md", "15_software-project-management.md"]) {
      const other = onDisk(BOOK + file);
      assert.ok(other.length > 1000, `${file} is read`);
      assert.ok(!request.sent.includes(other), `${file} is not in the request`);
      assert.ok(!request.sent.includes(other.split("\n").find((line) => /^# Chapter/.test(line))), `${file}'s title is not in the request`);
    }
  }
  for (const file of CHAPTERS) assert.match(jobRecord(fake).text, new RegExp(`^ {2}- ${file} — SRC-vibe-coding 2026-10-05, version hash [0-9a-f]{64}$`, "m"));
});
