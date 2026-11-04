// Release tests of UC-007 "Derive use cases from requirements": each requirement UC-007 realises, checked from the requests the fake model endpoint received, the commits the product received and the page
// the person reads — a use case that realises named requirements, has its five parts and a Mermaid diagram, is Markdown naming its origin, is a proposal that enters the default branch as open, one file each;
// a draft that fails a check goes back to its participant in findings that read like a compiler's, an error is fixed and a warning fixed or justified, what a person decides is not sent back, the loop has a
// fixed limit and its rounds are counted and shown; and the job receives chapter 8. TST-580301 maps every requirement UC-007 realises to a release test that guards it.
// Run: node --test tests/release-uc-007-derive-use-cases-from-requirements.test.mjs
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
// Level: release
//
// Written for the release testing of sprint 142 by developer-sonnet-k (ITM-580). The Agent-M-Participant trailers of the code of UC-007 (git log --format='%h %(trailers:key=Agent-M-Participant)' -- src/review-pages
// src/artifact-edits src/job-runner, and src/job-catalogue src/documents src/runtimes src/job-ledger) name developer-sonnet-k for ITM-1271 (the notes of the job that wrote a file), ITM-1317 (classifyCandidates leaves
// the artifact a candidate changes out of the search for a duplicate), ITM-1346, ITM-1349, ITM-1350, ITM-1355, ITM-1357, ITM-1358, ITM-1359 and ITM-1378; most of the other commits there carry no trailer, so that their
// authors cannot be read. None of the sixteen requirements below is the behaviour of one of those items: the case that shows a note beside a use case (4b) and the case of a change of an existing use case (6a)
// are system cases (tests/system-uc-007-derive-use-cases-from-requirements.test.mjs), which the rule does not restrict. No release case is left for another writer. The world is tests/uc-007-harness.mjs; the
// release team works from the specification and the files: each case ends at the request a fixture received, at what the product holds and at what the page says. Readings the texts leave open, which the cases state:
//   - WHAT A PERSON DECIDES IS NOT SENT BACK, read for this kind: the kind derive-use-cases names no rule that it leaves to a person (its `person_decides` is empty), so that a use case classed `conflict` is no finding;
//     TST-580315 shows that such a draft is not sent back, and that a finding of the loop is.
//   - AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED, read for this kind: the checks of derive-use-cases — document-schema, graph-checks and candidate-classes — find errors only, and the kind has no
//     reviewing participant, whose findings are the warnings; TST-580314 therefore shows the half about an error, and that every finding of these runs is an error.
//   - "In one fixed text form" (A FINDING READS LIKE A COMPILER MESSAGE) is read as `<artifact>:<line>: <error|warning>: <what> [<RULE>] — <correction>.`, MOD-text-tools' form, the one the module file of
//     MOD-job-runner states in its round record.
//   - "Shown with the draft" (THE ROUNDS ARE COUNTED AND SHOWN) is read as the page that shows the draft's result, the drafting page after Run.
//   - "The person sees only the corrected draft" (A DRAFT THAT FAILS A CHECK GOES BACK) is read as: of the use cases the product received, none is the first draft.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { testDeclarations } from "../src/test-document/index.mjs";
import { LOAN, RENEW, SHELF, SPEC, UC1, UC1_PATH, UNKNOWN, accept, badge, byClass, draft, endpoint, fakeProduct, find, jobRecord, onDisk, panelFor, pathOf, realFetch, renew, reply, runButtons, shelve,
  show, tick, useCase } from "./uc-007-harness.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const SELF = "tests/release-uc-007-derive-use-cases-from-requirements.test.mjs";
const BOOK = "docs/sources/SRC-vibe-coding/2026-10-05/";
const SECTIONS = ["Postcondition", "Precondition", "Actors", "Main flow", "Alternative flows"];
// A fenced Mermaid block and its opening fence, built without a backquote in the file (the reader of declarations counts them).
const TICKS = "\x60\x60\x60";
const DIAGRAM = new RegExp("\\n" + TICKS + "mermaid\\n[^]*\\n" + TICKS + "\\n");
const FENCED = new RegExp("\\n" + TICKS + "mermaid\\n");
const COMPILER = /^\S+:\d+: (error|warning): .+ \[[A-Z0-9 ,'.-]+\] — .+\.$/;
const useCaseWrites = (fake) => fake.writes().filter((change) => change.files.some((file) => file.path.startsWith("docs/use-cases/")));
const pathsOf = (fake) => Object.keys(fake.files()).filter((path) => path.startsWith("docs/use-cases/")).sort();
const findingsOf = (request) => request.sent.slice(request.sent.indexOf("## Findings to fix or answer")).split("\n").filter((line) => /^\S+:\d+: (error|warning): /.test(line));
const SHELVED = pathOf("UC-002", "shelve-a-book");

test.afterEach(() => { globalThis.fetch = realFetch; });

// ---------------------------------------------------------------- the map

// Each requirement UC-007 realises, with the release tests of this file that guard it.
const EVIDENCE = {
  "A USE CASE REALISES NAMED REQUIREMENTS": [[SELF, "TST-580302"]],
  "A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION": [[SELF, "TST-580303"]],
  "DIAGRAMS ARE MERMAID IN MARKDOWN": [[SELF, "TST-580304"], [SELF, "TST-580305"]],
  "ARTIFACTS ARE MARKDOWN": [[SELF, "TST-580306"]],
  "EVERY ARTIFACT NAMES ITS ORIGIN": [[SELF, "TST-580307"]],
  "A GENERATED ARTIFACT IS A PROPOSAL": [[SELF, "TST-580308"]],
  "ONE USE CASE, ONE FILE": [[SELF, "TST-580309"]],
  "A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN": [[SELF, "TST-580310"]],
  "ONE CLICK PER DECISION": [[SELF, "TST-580311"]],
  "A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT": [[SELF, "TST-580312"]],
  "A FINDING READS LIKE A COMPILER MESSAGE": [[SELF, "TST-580313"]],
  "AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED": [[SELF, "TST-580314"]],
  "WHAT A PERSON DECIDES IS NOT SENT BACK": [[SELF, "TST-580315"]],
  "THE CORRECTION LOOP HAS A FIXED LIMIT": [[SELF, "TST-580316"]],
  "THE ROUNDS ARE COUNTED AND SHOWN": [[SELF, "TST-580317"], [SELF, "TST-580318"]],
  "A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING": [[SELF, "TST-580319"]],
};

// TST-580301 · level: release · module: system
// guards: UC-007
// given: UC-007 as committed text, whose `realises` lists sixteen requirements, and the release tests named in EVIDENCE
// input: read UC-007's list of the requirements it realises, and the declarations of the test files named for each
// expect: known positive — UC-007 realises these sixteen requirements; each has at least one test named; EVIDENCE names no requirement UC-007 does not realise; each test named stands in its file with the level release and guards that requirement
test("TST-580301: UC-007 every requirement it realises has a release test that guards it", () => {
  const text = read("docs/use-cases/UC-007-derive-use-cases-from-requirements.md");
  const front = text.slice(text.indexOf("realises:"), text.indexOf("\n---", text.indexOf("realises:")));
  const realised = [...front.matchAll(/^ {2}- (.+)$/gm)].map((match) => match[1]);
  assert.equal(realised.length, 16, "known positive: UC-007 realises sixteen requirements");
  for (const name of realised) assert.ok(name in EVIDENCE, `${name} has a release test`);
  assert.deepEqual(Object.keys(EVIDENCE).filter((name) => !realised.includes(name)), [], "EVIDENCE names no requirement UC-007 does not realise");
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

// ---------------------------------------------------------------- A USE CASE REALISES NAMED REQUIREMENTS

// TST-580302 · level: release · module: system
// guards: A USE CASE REALISES NAMED REQUIREMENTS; UC-007
// given: the product whose SPEC holds A BOOK IS SHELVED and not AN UNKNOWN RULE; the drafting page with A BOOK IS SHELVED ticked; (a) the endpoint first answers a use case that realises AN UNKNOWN RULE, then one that realises A BOOK IS SHELVED; (b) the endpoint answers at once a use case that realises A BOOK IS SHELVED
// input: Run for each; the requests, and the use cases the product received
// expect: (a) the second request carries a finding of the rule A USE CASE REALISES NAMED REQUIREMENTS that names AN UNKNOWN RULE; the use case written realises A BOOK IS SHELVED, a name of the SPEC, and no other; (b) counter-proof — one request, no finding, the same name written
test("TST-580302: UC-007 a drafted use case that names a requirement the product lacks goes back, and the one written realises names of the SPEC", async () => {
  const requests = endpoint(reply([shelve([UNKNOWN])]), reply([shelve([SHELF])]));
  const fake = fakeProduct();
  await draft(fake, { names: [SHELF] });
  assert.equal(requests.length, 2);
  const found = findingsOf(requests[1]);
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], /\[A USE CASE REALISES NAMED REQUIREMENTS\]/);
  assert.ok(found[0].includes(UNKNOWN));
  const text = fake.files()[SHELVED];
  assert.match(text, /\nrealises:\n {2}- A BOOK IS SHELVED\n---\n/);
  assert.ok(!text.includes(UNKNOWN));

  const plain = endpoint(reply([shelve([SHELF])]));
  const other = fakeProduct();
  await draft(other, { names: [SHELF] });
  assert.equal(plain.length, 1, "counter-proof: a name of the SPEC is asked once");
  assert.match(other.files()[SHELVED], /\nrealises:\n {2}- A BOOK IS SHELVED\n---\n/);
});

// ---------------------------------------------------------------- A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION

// TST-580303 · level: release · module: system
// guards: A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked; for each of the sections Actors, Precondition, Main flow, Alternative flows and Postcondition an endpoint that first answers a use case without that section and then the complete one
// input: Run for each of the five; the requests, and the use case written
// expect: for each section the second request carries a finding of the rule A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION that names the missing section, and the use case written holds all five sections; counter-proof — a complete use case is asked once
test("TST-580303: UC-007 a drafted use case without one of its five parts goes back naming the part", async () => {
  for (const name of SECTIONS) {
    const requests = endpoint(reply([shelve([SHELF], { without: [name] })]), reply([shelve([SHELF])]));
    const fake = fakeProduct();
    await draft(fake, { names: [SHELF] });
    assert.equal(requests.length, 2, `${name}: asked again`);
    const found = findingsOf(requests[1]);
    assert.equal(found.length, 1, `${name}: ${found.join("\n")}`);
    assert.match(found[0], /\[A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION\]/);
    assert.ok(found[0].includes(`## ${name}`), `${name}: the finding names the section`);
    for (const each of SECTIONS) assert.ok(fake.files()[SHELVED].includes(`## ${each}\n`), `${name}: the use case written holds ${each}`);
  }
  const whole = endpoint(reply([shelve([SHELF])]));
  await draft(fakeProduct(), { names: [SHELF] });
  assert.equal(whole.length, 1, "counter-proof: a complete use case is asked once");
});

// ---------------------------------------------------------------- DIAGRAMS ARE MERMAID IN MARKDOWN

// TST-580304 · level: release · module: system
// guards: DIAGRAMS ARE MERMAID IN MARKDOWN; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked; an endpoint that first answers a use case whose diagram is an image, ![overview](docs/overview.png), and then the use case with the diagram as a Mermaid block
// input: Run; the requests, and the use case written
// expect: the second request carries a finding of the rule DIAGRAMS ARE MERMAID IN MARKDOWN that names the image; the use case written holds a block ```mermaid and no image
test("TST-580304: UC-007 a drafted diagram that is an image goes back, and the use case written draws its diagram in Mermaid", async () => {
  const withImage = shelve([SHELF]);
  withImage.text = withImage.text.replace("## Alternative flows", "![overview](docs/overview.png)\n\n## Alternative flows");
  const requests = endpoint(reply([withImage]), reply([shelve([SHELF])]));
  const fake = fakeProduct();
  await draft(fake, { names: [SHELF] });
  assert.equal(requests.length, 2);
  const found = findingsOf(requests[1]).filter((line) => line.includes("[DIAGRAMS ARE MERMAID IN MARKDOWN]"));
  assert.equal(found.length, 1, "known positive: the image is found");
  assert.ok(found[0].includes("docs/overview.png"));
  assert.match(fake.files()[SHELVED], DIAGRAM);
  assert.ok(!fake.files()[SHELVED].includes("!["), "no image");
});

// TST-580305 · level: release · module: system
// guards: DIAGRAMS ARE MERMAID IN MARKDOWN; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked; (a) an endpoint that answers a use case with an image instead of its diagram, then the use case with a Mermaid block; (b) an endpoint that first answers a use case with no diagram at all, then the use case with a Mermaid block
// input: Run for each; the requests
// expect: known positive (a) — the second request carries the finding of the rule DIAGRAMS ARE MERMAID IN MARKDOWN; (b) UC-007 step 5 has Agent M check, without a model, that a draft holds a Mermaid diagram: the second request carries a finding of the rule DIAGRAMS ARE MERMAID IN MARKDOWN that names the use case and says the diagram is missing, and the use case written holds a Mermaid block
test("TST-580305: UC-007 a drafted use case with no diagram goes back", async () => {
  const withImage = shelve([SHELF], { diagram: false });
  withImage.text = withImage.text.replace("## Alternative flows", "![overview](docs/overview.png)\n\n## Alternative flows");
  const known = endpoint(reply([withImage]), reply([shelve([SHELF])]));
  await draft(fakeProduct(), { names: [SHELF] });
  assert.equal(known.length, 2, "known positive: a draft with an image is asked again");
  assert.ok(findingsOf(known[1]).some((line) => line.includes("[DIAGRAMS ARE MERMAID IN MARKDOWN]")), "known positive: the finding of the image");

  const requests = endpoint(reply([shelve([SHELF], { diagram: false })]), reply([shelve([SHELF])]));
  const fake = fakeProduct();
  await draft(fake, { names: [SHELF] });
  assert.equal(requests.length, 2, "a use case with no diagram is asked again");
  const found = findingsOf(requests[1]);
  assert.equal(found.length, 1, found.join("\n"));
  assert.match(found[0], /\[DIAGRAMS ARE MERMAID IN MARKDOWN\]/);
  assert.match(fake.files()[SHELVED], FENCED);
});

// ---------------------------------------------------------------- ARTIFACTS ARE MARKDOWN

// TST-580306 · level: release · module: system
// guards: ARTIFACTS ARE MARKDOWN; UC-007
// given: the drafting page with A BOOK IS SHELVED and A MEMBER CAN RENEW ONCE ticked, the endpoint answering two use cases
// input: Run; every file the product received from the job, by path and by text
// expect: every path written is a Markdown file — the two use cases under docs/use-cases/ and the job's record under docs/jobs/ —; each use case begins with its front matter and holds its diagram as a block ```mermaid; no file holds an image
test("TST-580306: UC-007 everything the job writes is Markdown, with its diagrams in Mermaid", async () => {
  endpoint(reply([shelve(), renew()]));
  const fake = fakeProduct();
  await draft(fake, { names: [SHELF, RENEW] });
  const written = fake.writes().flatMap((change) => change.files);
  assert.ok(written.length >= 3, "known positive: the use cases and the record were written");
  for (const file of written) assert.match(file.path, /^docs\/(use-cases|jobs)\/[A-Za-z0-9-]+\.md$/, file.path);
  for (const file of written.filter((each) => each.path.startsWith("docs/use-cases/"))) {
    assert.ok(file.text.startsWith("---\nid: UC-"), `${file.path} begins with its front matter`);
    assert.match(file.text, DIAGRAM, file.path + " draws its diagram in Mermaid");
  }
  assert.ok(!written.some((file) => /!\[[^\]]*\]\(/.test(file.text)), "no image");
});

// ---------------------------------------------------------------- EVERY ARTIFACT NAMES ITS ORIGIN

// TST-580307 · level: release · module: system
// guards: EVERY ARTIFACT NAMES ITS ORIGIN; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked, the endpoint answering the use case that realises it; and a second world whose endpoint answers a use case that realises no requirement
// input: Run for each; the use case written, and the job's record
// expect: the use case names the requirement it descends from — realises A BOOK IS SHELVED, a requirement that stands in the SPEC —; the job's record names the requirement it works on and the pins of its inputs; counter-proof — the use case that names no requirement is marked in the job's record by the note that it realises none
test("TST-580307: UC-007 a drafted use case names the requirements it descends from, and one that names none is marked", async () => {
  endpoint(reply([shelve([SHELF])]));
  const fake = fakeProduct();
  await draft(fake, { names: [SHELF] });
  const names = [...fake.files()[SHELVED].matchAll(/^ {2}- (A [A-Z ]+)$/gm)].map((match) => match[1]);
  assert.deepEqual(names, [SHELF], "the use case names the requirement it realises");
  assert.ok(SPEC.includes(`**${names[0]}**`), "which stands in the SPEC");
  const record = jobRecord(fake).text;
  assert.match(record, /^works_on:\n {2}- A BOOK IS SHELVED$/m);
  assert.match(record, /^inputs:\n(?: {2}- .+\n)+/m);

  endpoint(reply([shelve([])]));
  const none = fakeProduct();
  await draft(none, { names: [SHELF] });
  assert.match(none.files()[SHELVED], /\nrealises:\n---\n/);
  assert.match(jobRecord(none).text, /note: UC-002 realises no requirement/, "counter-proof: the use case without an origin is marked");
});

// ---------------------------------------------------------------- A GENERATED ARTIFACT IS A PROPOSAL

// TST-580308 · level: release · module: system
// guards: A GENERATED ARTIFACT IS A PROPOSAL; UC-007
// given: a use case drafted by a participant and written by the job, no approval record naming its text; then a person's record naming it; then a second job that drafts a change of that use case
// input: the product read as the dashboard reads it after each step
// expect: the run added no approval record and the use case reads open; after the person's record it reads accepted; counter-proof — after the second job changed it, it reads changed since acceptance, and no record was added by the job
test("TST-580308: UC-007 what the job generates counts as a proposal until a person accepts it", async () => {
  endpoint(reply([shelve([SHELF])]));
  const fake = fakeProduct();
  await draft(fake, { names: [SHELF] });
  assert.deepEqual(Object.keys(fake.files()).filter((path) => path.startsWith("docs/approvals/")), []);
  assert.equal(await badge(fake, "UC-002"), "open");
  await accept(fake, SHELVED);
  assert.equal(await badge(fake, "UC-002"), "accepted");
  const records = Object.keys(fake.files()).filter((path) => path.startsWith("docs/approvals/"));
  assert.equal(records.length, 1, "the person's record");

  const changed = { path: SHELVED, class: "change", of: "UC-002", text: useCase({ id: "UC-002", title: "Shelve a book", realises: [SHELF], alternatives: "- **1a. The shelf is full.** The member is told." }) };
  endpoint(reply([changed]));
  await draft(fake, { names: [SHELF] });
  assert.equal(fake.files()[SHELVED], changed.text, "known positive: the second job changed the use case");
  assert.deepEqual(Object.keys(fake.files()).filter((path) => path.startsWith("docs/approvals/")), records, "the job added no record");
  assert.equal(await badge(fake, "UC-002"), "changed since acceptance");
});

// ---------------------------------------------------------------- ONE USE CASE, ONE FILE

// TST-580309 · level: release · module: system
// guards: ONE USE CASE, ONE FILE; UC-007
// given: the product with UC-001; the drafting page with A BOOK IS SHELVED and A MEMBER CAN RENEW ONCE ticked, the endpoint answering two use cases that carry the placeholder identifiers UC-900 and UC-901
// input: Run; the files of docs/use-cases/ afterwards
// expect: the product holds three files there, each named docs/use-cases/UC-<nnn>-<slug>.md; each holds exactly one identifier — the number of its name —, the three numbers differ, and neither new file carries UC-900 or UC-901; UC-001's file is as it was
test("TST-580309: UC-007 each use case is one file named for its identifier, and no two share an identifier", async () => {
  endpoint(reply([shelve(), renew()]));
  const fake = fakeProduct();
  await draft(fake, { names: [SHELF, RENEW] });
  const paths = pathsOf(fake);
  assert.equal(paths.length, 3);
  const numbers = [];
  for (const path of paths) {
    const number = /^docs\/use-cases\/(UC-\d{3})-[a-z0-9-]+\.md$/.exec(path)?.[1];
    assert.ok(number, `${path} is named docs/use-cases/UC-<nnn>-<slug>.md`);
    numbers.push(number);
    const text = fake.files()[path];
    assert.deepEqual([...text.matchAll(/^id: (UC-\d+)$/gm)].map((match) => match[1]), [number], `${path} holds one identifier, the one of its name`);
    assert.ok(!/UC-90[01]/.test(text), `${path} carries no placeholder identifier`);
  }
  assert.equal(new Set(numbers).size, 3, "the identifiers differ");
  assert.equal(fake.files()[UC1_PATH], UC1);
});

// ---------------------------------------------------------------- A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN

// TST-580310 · level: release · module: system
// guards: A REVIEWED ARTIFACT ENTERS THE DEFAULT BRANCH AS OPEN; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked, the endpoint answering the use case; the product's default branch main
// input: Run; every commit the product received; the list of use cases; then a person's record that names the text
// expect: the use case is written by a commit on the default branch itself — every commit of the job is made on main, none on another branch, and no pull request is opened —; the commit is made on the head that was read; the list reads the use case open; counter-proof — once a record names the text it reads accepted
test("TST-580310: UC-007 the use case enters the default branch directly and counts as open", async () => {
  endpoint(reply([shelve([SHELF])]));
  const fake = fakeProduct();
  await draft(fake, { names: [SHELF] });
  const commits = fake.writes();
  assert.ok(commits.length >= 2, "known positive: the job's commits were made");
  assert.deepEqual([...new Set(commits.map((change) => change.branch))], ["main"], "every commit is on the default branch");
  const written = useCaseWrites(fake);
  assert.equal(written.length, 1);
  assert.deepEqual(written[0].files.map((file) => file.path), [SHELVED]);
  assert.match(written[0].expectedHead, /^[0-9a-f]{40}$/, "on the head that was read");
  assert.equal(await badge(fake, "UC-002"), "open");
  await accept(fake, SHELVED);
  assert.equal(await badge(fake, "UC-002"), "accepted", "counter-proof: a record that names the text accepts it");
});

// ---------------------------------------------------------------- ONE CLICK PER DECISION

// TST-580311 · level: release · module: system
// guards: ONE CLICK PER DECISION; UC-007
// given: the drafting page with the participant chosen and the run panel shown, A BOOK IS SHELVED and A MEMBER CAN RENEW ONCE ticked
// input: the person presses Run, once, and does nothing more
// expect: before the click nothing is written and nothing is sent, and the panel holds one button, Run; after that one click the two use cases are written and the list reads them open — no further click, no second button, no save — and the endpoint was asked once
test("TST-580311: UC-007 one click on Run is the whole decision: everything that follows is done by Agent M", async () => {
  const requests = endpoint(reply([shelve(), renew()]));
  const fake = fakeProduct();
  const target = await show(fake);
  tick(target, [SHELF, RENEW]);
  const panel = await panelFor(target, "drafter-a");
  assert.deepEqual(find(panel, (node) => node.localName === "button").map((node) => node.textContent), ["Run"], "the panel holds one button");
  assert.equal(fake.writes().length, 0, "nothing written before the click");
  assert.equal(requests.length, 0, "nothing sent before the click");
  runButtons(panel)[0].dispatchEvent(new Event("click"));
  const limit = Date.now() + 5000;
  while (byClass(target, "ul", "written").length === 0 && Date.now() < limit) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 1);
  assert.equal(pathsOf(fake).length, 3, "the use cases are written");
  assert.equal(await badge(fake, "UC-002"), "open");
  assert.equal(await badge(fake, "UC-003"), "open");
  assert.equal(runButtons(target).length, 1, "no further button to press");
});

// ---------------------------------------------------------------- A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT

// TST-580312 · level: release · module: system
// guards: A DRAFT THAT FAILS A CHECK GOES BACK TO ITS PARTICIPANT; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked; (a) an endpoint that first answers a use case with AN UNKNOWN RULE under realises, then the corrected use case; (b) an endpoint that answers a passing use case at once
// input: Run for each; the requests, the use cases the product received and what the page shows
// expect: (a) the participant is asked a second time, and the second request holds the first draft and its finding; the person sees only the corrected draft — the product received one use case, the corrected one, and the page says two correction rounds with nothing left; (b) counter-proof — a draft that passes is not sent back: one request
test("TST-580312: UC-007 a draft that fails a check goes back to its participant, and the person sees the corrected draft", async () => {
  const first = shelve([UNKNOWN]);
  const requests = endpoint(reply([first]), reply([shelve([SHELF])]));
  const fake = fakeProduct();
  const page = await draft(fake, { names: [SHELF] });
  assert.equal(requests.length, 2);
  assert.ok(requests[1].sent.includes("AN UNKNOWN RULE") && requests[1].sent.includes("## Findings to fix or answer"), "the draft and its findings go back");
  const written = useCaseWrites(fake);
  assert.equal(written.length, 1);
  assert.deepEqual(written[0].files.map((file) => file.path), [SHELVED]);
  assert.ok(!written[0].files[0].text.includes(UNKNOWN), "the first draft is not what the person sees");
  assert.equal(byClass(page, "p", "rounds")[0].textContent, "Correction rounds: 2");
  assert.equal(byClass(page, "li", "left").length, 0);

  const plain = endpoint(reply([shelve([SHELF])]));
  await draft(fakeProduct(), { names: [SHELF] });
  assert.equal(plain.length, 1, "counter-proof: a passing draft is not sent back");
});

// ---------------------------------------------------------------- A FINDING READS LIKE A COMPILER MESSAGE

// TST-580313 · level: release · module: system
// guards: A FINDING READS LIKE A COMPILER MESSAGE; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked; an endpoint that first answers a use case with AN UNKNOWN RULE under realises, without the section Postcondition and with its diagram as an image, then the corrected use case
// input: Run; the findings of the second request, and the round record of the job
// expect: known positive — three findings are sent back; each is one line in the form `<artifact>:<line>: error: <what> [<RULE>] — <correction>.`, names the drafted artifact, a line number, the kind error, a rule by its name in capitals and the correction expected; the job's record holds the same three lines; counter-proof — the same finding without its rule does not match the form
test("TST-580313: UC-007 every finding sent back names the artifact, the line, the kind, the rule and the correction in one text form", async () => {
  const flawed = shelve([UNKNOWN], { diagram: false, without: ["Postcondition"] });
  flawed.text = flawed.text.replace("## Alternative flows", "![overview](docs/overview.png)\n\n## Alternative flows");
  const requests = endpoint(reply([flawed]), reply([shelve([SHELF])]));
  const fake = fakeProduct();
  await draft(fake, { names: [SHELF] });
  const found = findingsOf(requests[1]);
  assert.ok(found.length >= 3, `known positive: the findings are sent back: ${found.join("\n")}`);
  for (const line of found) {
    assert.match(line, COMPILER);
    assert.ok(line.startsWith("docs/use-cases/UC-900-shelve-a-book.md:") || line.startsWith("UC-900:"), `${line} names the artifact`);
    assert.match(line, /^\S+:\d+: error: /);
  }
  const record = jobRecord(fake).text.split("## Rounds")[1];
  for (const line of found) assert.ok(record.includes(`- ${line}`), `the job's record holds ${line.slice(0, 60)}`);
  assert.doesNotMatch("UC-900:8: error: realises \"AN UNKNOWN RULE\" matches no requirement — use an existing name or remove the line.", COMPILER, "counter-proof: a finding with no rule is not in the form");
});

// ---------------------------------------------------------------- AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED

// TST-580314 · level: release · module: system
// guards: AN ERROR MUST BE FIXED, A WARNING FIXED OR JUSTIFIED; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked; (a) an endpoint that answers a use case without the section Postcondition and, to the finding, answers `justified` with a one-line reason, keeping the draft; (b) an endpoint that answers the same use case and then the use case with the section
// input: Run for each; the requests, the page and the job's record
// expect: (a) a justification does not settle an error: the drafter is asked again and the loop ends only at a round that leaves the finding as it was — two requests, stopped because: unchanged —, the page shows the error left, and the record shows the justification under the finding and the finding in the next round; every finding of the run is of the kind error; (b) counter-proof — an error fixed ends the loop: two requests, stopped because: passed, nothing left
test("TST-580314: UC-007 an error is not settled by a justification; it is fixed, or it is left to the person", async () => {
  const first = reply([shelve([SHELF], { without: ["Postcondition"] })]);
  const finding = "UC-900:1: error: the section ## Postcondition is required, and missing [A USE CASE HAS ACTOR, PRECONDITION, FLOW AND POSTCONDITION] — add the section ## Postcondition.";
  const justified = { draft: first.draft, answers: [{ finding, how: "justified", text: "the postcondition is not needed" }] };
  const requests = endpoint(first, justified);
  const fake = fakeProduct();
  const page = await draft(fake, { names: [SHELF] });
  assert.equal(requests.length, 2);
  assert.ok(findingsOf(requests[1]).every((line) => /^\S+:\d+: error: /.test(line)), "every finding is an error");
  assert.equal(byClass(page, "li", "left").length, 1, "the error is left, and shown");
  const rounds = jobRecord(fake).text.split("## Rounds")[1];
  assert.match(rounds, /- UC-900:1: error: the section ## Postcondition[^\n]*\n {2}- justified: the postcondition is not needed/);
  assert.match(rounds, /### Round 2 — 1 finding/);
  assert.match(rounds, /stopped because: unchanged/);

  const fixed = endpoint(first, reply([shelve([SHELF])]));
  const other = fakeProduct();
  const second = await draft(other, { names: [SHELF] });
  assert.equal(fixed.length, 2);
  assert.equal(byClass(second, "li", "left").length, 0);
  assert.match(jobRecord(other).text, /stopped because: passed/, "counter-proof: a fixed error ends the loop");
});

// ---------------------------------------------------------------- WHAT A PERSON DECIDES IS NOT SENT BACK

// TST-580315 · level: release · module: system
// guards: WHAT A PERSON DECIDES IS NOT SENT BACK; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked; (a) an endpoint that answers a use case classed conflict with the existing UC-001; (b) an endpoint that answers a use case with AN UNKNOWN RULE
// input: Run for each; the requests
// expect: the kind leaves no rule to a person, so that (a) the class conflict is no finding and nothing of it goes back — one request, no section of findings in it, and nothing left on the page; (b) counter-proof — the finding of the unknown name is sent back to the participant in a second request
test("TST-580315: UC-007 a conflict is no finding of the loop and goes back to nobody, while a finding of a check does", async () => {
  const conflict = { ...shelve([SHELF]), class: "conflict", of: "UC-001" };
  const requests = endpoint(reply([conflict]));
  const page = await draft(fakeProduct(), { names: [SHELF] });
  assert.equal(requests.length, 1, "nothing is sent back");
  assert.ok(!requests[0].sent.includes("## Findings to fix or answer"));
  assert.equal(byClass(page, "li", "left").length, 0);

  const error = endpoint(reply([shelve([UNKNOWN])]), reply([shelve([SHELF])]));
  await draft(fakeProduct(), { names: [SHELF] });
  assert.equal(error.length, 2, "counter-proof: a finding of a check goes back");
  assert.ok(error[1].sent.includes("## Findings to fix or answer"));
});

// ---------------------------------------------------------------- THE CORRECTION LOOP HAS A FIXED LIMIT

// TST-580316 · level: release · module: system
// guards: THE CORRECTION LOOP HAS A FIXED LIMIT; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked; (a) a participant that never fixes its error: each answer lacks another section, so that every round has another finding; (b) a participant that answers the same flawed use case every time
// input: Run for each; the run panel before it, the job's start record, the requests and the page
// expect: the limit is stated before the first round — the panel says at most 5 rounds and the start record, committed before the first request, says `limit: 5` —; (a) the participant is asked exactly 5 times and the page shows the remaining finding; (b) it is asked twice, once more than a round without change, and the page shows the remaining finding; in both the draft is written with its finding left
test("TST-580316: UC-007 the loop ends after the number of rounds fixed before the first, or at a round without change, and the finding left is shown", async () => {
  const sections = SECTIONS.map((name) => reply([shelve([SHELF], { without: [name] })]));
  const requests = endpoint(...sections);
  const fake = fakeProduct();
  const target = await show(fake);
  tick(target, [SHELF]);
  const panel = await panelFor(target, "drafter-a");
  assert.match(panel.textContent, /Correction rounds: at most 5/);
  assert.equal(requests.length, 0);
  runButtons(panel)[0].dispatchEvent(new Event("click"));
  const limit = Date.now() + 5000;
  while (byClass(target, "ul", "written").length === 0 && Date.now() < limit) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(requests.length, 5, "asked exactly limit times");
  const starts = fake.writes().filter((change) => change.files.some((file) => file.path.startsWith("docs/jobs/")));
  assert.match(starts[0].files[0].text, /^limit: 5$/m, "the start record states the limit");
  assert.ok(!starts[0].files[0].text.includes("## End"), "and it was committed before the end");
  assert.equal(byClass(target, "li", "left").length, 1, "the remaining finding is shown");
  assert.deepEqual(pathsOf(fake), [UC1_PATH, SHELVED].sort(), "the draft is written with its finding left");

  const same = endpoint(reply([shelve([SHELF], { without: ["Postcondition"] })]));
  const other = fakeProduct();
  const page = await draft(other, { names: [SHELF] });
  assert.equal(same.length, 2, "once more than a round without change");
  assert.equal(byClass(page, "li", "left").length, 1);
  assert.deepEqual(pathsOf(other), [UC1_PATH, SHELVED].sort());
});

// ---------------------------------------------------------------- THE ROUNDS ARE COUNTED AND SHOWN

// TST-580317 · level: release · module: system
// guards: THE ROUNDS ARE COUNTED AND SHOWN; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked; an endpoint that first answers a use case with AN UNKNOWN RULE and then the corrected use case
// input: Run; the page, and the job's record
// expect: the page shows the number of correction rounds the draft needed, 2; the job's record holds, with the draft's job, Round 1 with its finding and Round 2 without one, and the line `Left: none · stopped because: passed · limit: 5`
test("TST-580317: UC-007 the number of correction rounds is shown with the draft, and the rounds are recorded with it", async () => {
  endpoint(reply([shelve([UNKNOWN])]), reply([shelve([SHELF])]));
  const fake = fakeProduct();
  const page = await draft(fake, { names: [SHELF] });
  assert.equal(byClass(page, "p", "rounds")[0].textContent, "Correction rounds: 2");
  const rounds = jobRecord(fake).text.split("## Rounds")[1];
  assert.match(rounds, /### Round 1 — 1 finding\n- UC-900:\d+: error: .*\[A USE CASE REALISES NAMED REQUIREMENTS\]/);
  assert.match(rounds, /### Round 2 — no finding\n\nLeft: none · stopped because: passed · limit: 5/);
});

// TST-580318 · level: release · module: system
// guards: THE ROUNDS ARE COUNTED AND SHOWN; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked; an endpoint that first answers a use case without the section Postcondition and then the corrected use case, so that the first round found one finding which the second round no longer has
// input: Run; the page that shows the draft's result
// expect: known positive — the page shows 2 correction rounds and the use case written; it shows the findings of each round with the draft, so that the finding of round 1, the missing section Postcondition, is on the page although the second round left nothing
test("TST-580318: UC-007 the findings of each round are shown with the draft", async () => {
  endpoint(reply([shelve([SHELF], { without: ["Postcondition"] })]), reply([shelve([SHELF])]));
  const fake = fakeProduct();
  const page = await draft(fake, { names: [SHELF] });
  assert.equal(byClass(page, "p", "rounds")[0].textContent, "Correction rounds: 2", "known positive: the rounds are counted on the page");
  assert.match(byClass(page, "ul", "written")[0].textContent, /UC-002-shelve-a-book/, "known positive: the use case is written");
  assert.match(page.textContent, /## Postcondition is required|the section ## Postcondition is required, and missing/, "the finding of round 1 is on the page");
});

// ---------------------------------------------------------------- A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING

// TST-580319 · level: release · module: system
// guards: A REQUIREMENTS JOB RECEIVES THE CHAPTER ON REQUIREMENTS ENGINEERING; UC-007
// given: the drafting page with A BOOK IS SHELVED ticked, the instance holding the book *Vibe Coding* as files; the endpoint answering a use case
// input: Run; the request the endpoint received, and the job's record
// expect: the request holds the file of chapter 8, 08_requirements-engineering.md, whole — byte for byte as the instance holds it —; it holds none of chapters 9, 10, 11, 12 and 13, whole or by their title line; the job's record lists that chapter among its inputs with the version of the book; counter-proof — the same search finds the chapter's file in the request, so that the others are absent by the same check
test("TST-580319: UC-007 the job's input gives chapter 8 of the book in full and no other chapter", async () => {
  const requests = endpoint(reply([shelve([SHELF])]));
  const fake = fakeProduct();
  await draft(fake, { names: [SHELF] });
  assert.equal(requests.length, 1);
  const sent = requests[0].sent;
  const chapter = onDisk(`${BOOK}08_requirements-engineering.md`);
  assert.ok(chapter.length > 50000, "known positive: the chapter is read from the disk");
  assert.ok(sent.includes(chapter), "chapter 8 is in the request, whole");
  for (const file of ["09_system-modeling.md", "10_architectural-design.md", "11_agentic-design-and-control-patterns.md", "12_implementation-and-version-control.md", "13_software-testing.md"]) {
    const other = onDisk(`${BOOK}${file}`);
    assert.ok(other.length > 1000, `${file} is read`);
    assert.ok(!sent.includes(other), `${file} is not in the request`);
    assert.ok(!sent.includes(other.split("\n").find((line) => /^# Chapter/.test(line))), `${file}'s title is not in the request`);
  }
  assert.match(jobRecord(fake).text, /^ {2}- 08_requirements-engineering\.md — SRC-vibe-coding 2026-10-05, version hash [0-9a-f]{64}$/m);
});
